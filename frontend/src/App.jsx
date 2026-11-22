import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import EvaluationBar from './components/EvaluationBar';
import Chessboard from './components/Chessboard';
import ArmCanvas from './components/ArmCanvas';
import LivePanel from './components/LivePanel';
import Controls from './components/Controls';
import SettingsModal from './components/SettingsModal';
import HistoryModal from './components/HistoryModal';
import DemoReportModal from './components/DemoReportModal';
import { api } from './services/api';
import { GameWebSocket } from './services/websocket';

export default function App() {
  // Game State
  const [game, setGame] = useState(null);
  const [displayedFen, setDisplayedFen] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  const [activeMove, setActiveMove] = useState(null);
  const [scoreCp, setScoreCp] = useState(0);
  const [isEngineThinking, setIsEngineThinking] = useState(false);
  const isEngineThinkingRef = useRef(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Settings State
  const [settings, setSettings] = useState({
    elo: 1500,
    depth: 10,
    think_time: 1.0,
    style: 'balanced',
    human_color: 'white',
  });
  const [stockfishAvailable, setStockfishAvailable] = useState(false);
  const [installInstructions, setInstallInstructions] = useState(null);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDemoReportOpen, setIsDemoReportOpen] = useState(false);
  const [demoReportData, setDemoReportData] = useState(null);

  // Demo Mode State
  const [isDemoMode, setIsDemoMode] = useState(false);
  const isDemoRunningRef = useRef(false);
  const demoStartTimeRef = useRef(0);

  // Arm Simulation State
  const [armStatus, setArmStatus] = useState('standby'); // standby, planning, moving
  const [armProgress, setArmProgress] = useState(null);
  const [trajectoryWaypoints, setTrajectoryWaypoints] = useState([]);
  const [isArmMoving, setIsArmMoving] = useState(false);
  const isArmMovingRef = useRef(false);
  const armCompleteCallbackRef = useRef(null);
  const pendingGameUpdateRef = useRef(null);

  useEffect(() => {
    isArmMovingRef.current = isArmMoving;
  }, [isArmMoving]);

  useEffect(() => {
    isEngineThinkingRef.current = isEngineThinking;
  }, [isEngineThinking]);

  // WebSocket State
  const [wsStatus, setWsStatus] = useState('connecting');
  const wsRef = useRef(null);

  // Initial Load: Fetch Settings & Start Game
  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    try {
      // 1. Fetch system settings
      const currentSettings = await api.getSettings();
      setSettings(currentSettings);
      setStockfishAvailable(currentSettings.stockfish_available);
      setInstallInstructions(currentSettings.install_instructions);

      // 2. Start initial game
      await startNewGame(currentSettings);
    } catch (err) {
      showToast(err.message || 'Error connecting to backend server');
    }
  };

  const startNewGame = async (gameConfig = settings) => {
    try {
      const newGame = await api.newGame({
        human_color: gameConfig.human_color || 'white',
        elo: gameConfig.elo,
        depth: gameConfig.depth,
        think_time: gameConfig.think_time,
        style: gameConfig.style,
      });

      setGame(newGame);
      setDisplayedFen(newGame.fen);
      setLastMove(null);
      setActiveMove(null);
      setIsArmMoving(false);
      setScoreCp(0);
      setTrajectoryWaypoints([]);
      setArmProgress(null);
      setArmStatus('standby');

      // Setup WebSocket connection for this game
      setupWebSocket(newGame.id);

      // If human is Black, trigger engine's opening move
      if (newGame.human_color === 'black' && newGame.turn === 'white') {
        setTimeout(() => {
          executeEngineMove(newGame.id, newGame.fen);
        }, 600);
      }
    } catch (err) {
      showToast(`Failed starting new game: ${err.message}`);
    }
  };

  const setupWebSocket = (gameId) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new GameWebSocket(gameId, (status) => {
      setWsStatus(status);
    });

    // Listen for board_update
    ws.on('board_update', (data) => {
      if (isArmMovingRef.current || isEngineThinkingRef.current || isEngineThinking) {
        // While a move is being planned or the arm is moving, buffer backend updates
        // so pieces do NOT teleport before placement is complete!
        pendingGameUpdateRef.current = data;
        return;
      }
      setGame((prev) => ({
        ...prev,
        ...data,
      }));
      if (data.fen) {
        setDisplayedFen(data.fen);
      }
    });

    // Listen for engine_thinking
    ws.on('engine_thinking', (data) => {
      setIsEngineThinking(true);
      isEngineThinkingRef.current = true;
    });

    // Listen for arm_progress
    ws.on('arm_progress', (data) => {
      setArmStatus('moving');
      setArmProgress(data);
    });

    // Listen for game_over
    ws.on('game_over', (data) => {
      setIsEngineThinking(false);
      isEngineThinkingRef.current = false;
      setArmStatus('standby');
      showToast(`Game Over: ${data.result} (${data.status})`);
    });

    wsRef.current = ws;
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Human Player Move
  const handlePlayerMove = async (uciMove) => {
    if (!game || isEngineThinking || isEngineThinkingRef.current || isArmMovingRef.current || game.status === 'paused') return;

    const from = uciMove.slice(0, 2);
    const to = uciMove.slice(2, 4);
    const fenBeforePlayer = displayedFen || game.fen;

    // 1. Immediately lock arm state so pieces don't teleport
    setIsArmMoving(true);
    isArmMovingRef.current = true;
    setArmStatus('moving');
    setActiveMove({ from, to, uci: uciMove });
    setLastMove({ from, to });
    pendingGameUpdateRef.current = null;

    try {
      // 2. Fetch arm plan and submit move to backend in parallel
      const planPromise = api.getArmPlan(uciMove, fenBeforePlayer, null, false);
      const movePromise = api.makeMove(game.id, uciMove);

      const [playerPlan, updatedGame] = await Promise.all([planPromise, movePromise]);
      pendingGameUpdateRef.current = updatedGame;

      // 3. Callback triggered strictly when the 3D arm finishes its physical trajectory
      armCompleteCallbackRef.current = () => {
        const finalGame = pendingGameUpdateRef.current || updatedGame;
        setArmStatus('standby');
        setIsArmMoving(false);
        isArmMovingRef.current = false;
        setActiveMove(null);
        setDisplayedFen(finalGame.fen);
        setGame(finalGame);

        // 4. Trigger engine reply ONLY after arm movement completely finishes
        if (finalGame.status === 'in_progress') {
          executeEngineMove(finalGame.id, finalGame.fen);
        }
      };

      if (playerPlan && playerPlan.steps && playerPlan.steps.length > 0) {
        const waypoints = [];
        playerPlan.steps.forEach((step) => {
          if (step.waypoints) {
            waypoints.push(...step.waypoints);
          }
        });
        setTrajectoryWaypoints(waypoints);
        if (playerPlan.steps[0]) {
          setArmProgress({
            step: playerPlan.steps[0].step_name,
            index: 1,
            total: playerPlan.steps.length,
            description: playerPlan.steps[0].description,
            progress: 0.1,
          });
        }
      } else {
        armCompleteCallbackRef.current?.();
      }
    } catch (err) {
      console.error('Player move error:', err);
      setIsArmMoving(false);
      isArmMovingRef.current = false;
      setActiveMove(null);
      setArmStatus('standby');
      showToast(err.message || 'Illegal Move');
    }
  };

  // AI Engine Move Execution & 3D Arm Trajectory
  const executeEngineMove = async (gameId = game?.id, fenBeforeEngine = null) => {
    if (!gameId) return;

    setIsEngineThinking(true);
    isEngineThinkingRef.current = true;
    setIsArmMoving(true);
    isArmMovingRef.current = true;
    setArmStatus('planning');

    try {
      const priorFen = fenBeforeEngine || displayedFen || game?.fen;
      const res = await api.engineMove(gameId);
      setIsEngineThinking(false);
      isEngineThinkingRef.current = false;

      const from = res.move.slice(0, 2);
      const to = res.move.slice(2, 4);

      // Lock arm state before animating
      setArmStatus('moving');
      setActiveMove({ from, to, uci: res.move });
      setLastMove({ from, to });
      pendingGameUpdateRef.current = res.game;

      if (res.evaluation && res.evaluation.score_cp !== undefined) {
        setScoreCp(res.evaluation.score_cp);
      }

      // Callback triggered strictly when the 3D arm finishes its physical trajectory
      armCompleteCallbackRef.current = () => {
        const finalGame = pendingGameUpdateRef.current || res.game;
        setArmStatus('standby');
        setIsArmMoving(false);
        isArmMovingRef.current = false;
        setActiveMove(null);
        setDisplayedFen(finalGame.fen);
        setGame(finalGame);
      };

      // Generate 6-DOF Arm Trajectory for the engine's move
      try {
        const plan = await api.getArmPlan(res.move, priorFen, null, false);
        if (plan && plan.steps && plan.steps.length > 0) {
          const waypoints = [];
          plan.steps.forEach((step) => {
            if (step.waypoints) {
              waypoints.push(...step.waypoints);
            }
          });
          setTrajectoryWaypoints(waypoints);
          setArmProgress({
            step: plan.steps[0].step_name,
            index: 1,
            total: plan.steps.length,
            description: plan.steps[0].description,
            progress: 0.1,
          });
        } else {
          armCompleteCallbackRef.current?.();
        }
      } catch (armErr) {
        console.warn('Arm trajectory generation warning:', armErr);
        armCompleteCallbackRef.current?.();
      }
    } catch (err) {
      setIsEngineThinking(false);
      isEngineThinkingRef.current = false;
      setArmStatus('standby');
      setIsArmMoving(false);
      isArmMovingRef.current = false;
      setActiveMove(null);
      showToast(`Engine error: ${err.message}`);
    }
  };

  // Controls Handlers
  const handleTogglePause = async () => {
    if (!game) return;
    try {
      if (game.status === 'paused') {
        const resumed = await api.resumeGame(game.id);
        setGame(resumed);
        showToast('Game resumed.');
      } else {
        const paused = await api.pauseGame(game.id);
        setGame(paused);
        showToast('Game paused.');
      }
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleResign = async () => {
    if (!game) return;
    if (!window.confirm('Are you sure you want to resign this match?')) return;
    try {
      const resigned = await api.resignGame(game.id, game.human_color);
      setGame(resigned);
      showToast(`Resigned. Result: ${resigned.result}`);
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleExportPgn = () => {
    if (!game || !game.pgn) {
      showToast('No PGN available for current game.');
      return;
    }
    // Copy to clipboard
    navigator.clipboard.writeText(game.pgn);

    // Also download file
    const blob = new Blob([game.pgn], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chessmate_game_${game.id.slice(0, 8)}.pgn`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('PGN copied to clipboard & downloaded!');
  };

  const handleSaveSettings = async (newSettings) => {
    try {
      const updated = await api.updateSettings(newSettings);
      setSettings(updated);
      showToast('Settings saved successfully.');
    } catch (err) {
      showToast(`Error updating settings: ${err.message}`);
    }
  };

  // Autonomous Demo Mode Loop (Engine vs Engine with 6-DOF Arm Animation)
  const handleToggleDemo = async () => {
    if (isDemoMode) {
      // User clicked STOP DEMO
      isDemoRunningRef.current = false;
      setIsDemoMode(false);
      setIsArmMoving(false);
      setActiveMove(null);
      const totalElapsed = (Date.now() - demoStartTimeRef.current) / 1000;
      setDemoReportData({
        movesCount: game?.moves?.length || 0,
        totalTimeSec: totalElapsed,
        result: game?.result || '*',
        status: game?.status || 'stopped',
        reason: 'Autonomous demo stopped by operator.',
        whiteStyle: 'Aggressive',
        blackStyle: 'Balanced',
        whiteElo: 2000,
        blackElo: 1800,
        moves: game?.moves || [],
        finalFen: game?.fen || '',
        pgn: game?.pgn || '',
      });
      setIsDemoReportOpen(true);
      showToast('Demo halted. Generating mission report...');
      return;
    }

    // Start Demo Mode
    try {
      showToast('Initializing Autonomous Engine vs Engine match...');
      const newGame = await api.newGame({
        human_color: 'white',
        elo: 1800,
        style: 'balanced',
      });
      setGame(newGame);
      setDisplayedFen(newGame.fen);
      setLastMove(null);
      setActiveMove(null);
      setIsArmMoving(false);
      setScoreCp(0);
      setupWebSocket(newGame.id);

      setIsDemoMode(true);
      isDemoRunningRef.current = true;
      demoStartTimeRef.current = Date.now();

      // Launch automated move execution loop
      setTimeout(() => {
        runDemoStep(newGame.id, newGame.fen);
      }, 800);
    } catch (err) {
      showToast(`Failed to initialize demo: ${err.message}`);
    }
  };

  const runDemoStep = async (gameId, currentFen) => {
    if (!isDemoRunningRef.current) return;

    setIsEngineThinking(true);
    isEngineThinkingRef.current = true;
    setIsArmMoving(true);
    isArmMovingRef.current = true;
    setArmStatus('planning');

    try {
      const priorFen = currentFen || displayedFen || game?.fen;
      const res = await api.engineMove(gameId);
      setIsEngineThinking(false);
      isEngineThinkingRef.current = false;

      const from = res.move.slice(0, 2);
      const to = res.move.slice(2, 4);

      // Keep 3D board pieces at starting positions while arm articulates
      setActiveMove({ from, to, uci: res.move });
      setLastMove({ from, to });
      setArmStatus('moving');
      pendingGameUpdateRef.current = res.game;

      if (res.evaluation && res.evaluation.score_cp !== undefined) {
        setScoreCp(res.evaluation.score_cp);
      }

      // Arm animation completion handler for demo mode
      armCompleteCallbackRef.current = () => {
        const finalGame = pendingGameUpdateRef.current || res.game;
        setArmStatus('standby');
        setIsArmMoving(false);
        isArmMovingRef.current = false;
        setActiveMove(null);
        setDisplayedFen(finalGame.fen);
        setGame(finalGame);

        // Check if match is concluded
        const isOver = ['checkmate', 'stalemate', 'draw', 'resigned'].includes(res.game.status);
        if (isOver || !isDemoRunningRef.current) {
          isDemoRunningRef.current = false;
          setIsDemoMode(false);
          const totalElapsed = (Date.now() - demoStartTimeRef.current) / 1000;
          setDemoReportData({
            movesCount: res.game.moves.length,
            totalTimeSec: totalElapsed,
            result: res.game.result,
            status: res.game.status,
            reason: res.game.status === 'checkmate' ? `Checkmate! Final: ${res.game.result}` : `Game finished (${res.game.status})`,
            whiteStyle: 'Aggressive',
            blackStyle: 'Balanced',
            whiteElo: 2000,
            blackElo: 1800,
            moves: res.game.moves,
            finalFen: res.game.fen,
            pgn: res.game.pgn,
          });
          setIsDemoReportOpen(true);
          showToast(`Demo Finished: ${res.game.result} (${res.game.status})`);
        } else {
          // Schedule next turn cleanly after piece has been physically placed
          setTimeout(() => {
            if (isDemoRunningRef.current) {
              runDemoStep(gameId, res.game.fen);
            }
          }, 800);
        }
      };

      // Generate & animate 6-DOF arm trajectory
      try {
        const plan = await api.getArmPlan(res.move, priorFen, null, false);
        if (plan && plan.steps && plan.steps.length > 0) {
          const waypoints = [];
          plan.steps.forEach((s) => {
            if (s.waypoints) waypoints.push(...s.waypoints);
          });
          setTrajectoryWaypoints(waypoints);
          if (plan.steps[0]) {
            setArmProgress({
              step: plan.steps[0].step_name,
              index: 1,
              total: plan.steps.length,
              description: plan.steps[0].description,
              progress: 0.1,
            });
          }
        } else {
          armCompleteCallbackRef.current?.();
        }
      } catch (armErr) {
        console.warn('Arm demo plan warning:', armErr);
        armCompleteCallbackRef.current?.();
      }
    } catch (err) {
      isDemoRunningRef.current = false;
      setIsDemoMode(false);
      setIsEngineThinking(false);
      isEngineThinkingRef.current = false;
      setArmStatus('standby');
      setIsArmMoving(false);
      isArmMovingRef.current = false;
      setActiveMove(null);
      showToast(`Demo terminated on engine error: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfcfd] text-[#0a0a0a] flex flex-col font-sans selection:bg-[#ccff00] selection:text-black pb-8 editorial-grid-bg">
      {/* 1. Header Navigation Bar (Floating Pill) */}
      <Navbar
        wsStatus={wsStatus}
        stockfishAvailable={stockfishAvailable}
        armStatus={armStatus}
        turn={game?.turn || 'white'}
        gameStatus={game?.status || 'in_progress'}
        isDemoMode={isDemoMode}
        onToggleDemo={handleToggleDemo}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
      />

      {/* Toast Notification Banner (Floating Minimalist Pill) */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-50 bg-black text-white px-4 py-2 rounded-full border border-neutral-800 shadow-2xl text-xs font-sans font-medium animate-in fade-in slide-in-from-top-2 duration-200 flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-[#ccff00] shadow-[0_0_8px_#ccff00] animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 2. Main Control Room Telemetry Workspace */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-3 sm:p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 mt-2">
        {/* Left Column: Interactive 2D Chessboard + Evaluation Bar */}
        <section className="lg:col-span-5 flex flex-col items-center justify-start space-y-4">
          <div className="flex items-center space-x-3 w-full justify-center">
            {/* Evaluation Bar */}
            <div className="h-[340px] sm:h-[440px] md:h-[480px]">
              <EvaluationBar
                scoreCp={scoreCp}
                isMate={game?.is_checkmate}
                mateIn={game?.is_checkmate ? 0 : null}
              />
            </div>

            {/* 2D Chessboard */}
            <Chessboard
              fen={displayedFen || game?.fen}
              legalMoves={game?.legal_moves || []}
              lastMove={lastMove}
              isCheck={game?.is_check}
              turn={game?.turn}
              humanColor={game?.human_color || 'white'}
              disabled={isEngineThinking || isArmMoving || game?.status === 'paused' || ['checkmate', 'stalemate', 'draw', 'resigned'].includes(game?.status)}
              onMakeMove={handlePlayerMove}
            />
          </div>

          {/* Action Controls Strip */}
          <div className="w-full max-w-[500px]">
            <Controls
              gameStatus={game?.status || 'in_progress'}
              isEngineThinking={isEngineThinking}
              isDemoMode={isDemoMode}
              onNewGame={() => startNewGame()}
              onTogglePause={handleTogglePause}
              onResign={handleResign}
              onExportPgn={handleExportPgn}
              onTriggerEngineMove={() => executeEngineMove(game?.id)}
              onToggleDemo={handleToggleDemo}
            />
          </div>
        </section>

        {/* Center Column: 3D Three.js Robotic Arm Simulation */}
        <section className="lg:col-span-4 h-[440px] sm:h-[500px] lg:h-auto min-h-[440px] flex flex-col">
          <ArmCanvas
            trajectoryWaypoints={trajectoryWaypoints}
            activeStep={armProgress}
            activeMove={activeMove}
            move={activeMove}
            fromSquare={activeMove?.from}
            toSquare={activeMove?.to}
            fen={displayedFen || game?.fen}
            armStatus={armStatus}
            onAnimationComplete={() => armCompleteCallbackRef.current?.()}
          />
        </section>

        {/* Right Column: Live Telemetry, Engine Analysis, & Moves History */}
        <section className="lg:col-span-3 h-[440px] sm:h-[500px] lg:h-auto min-h-[440px] flex flex-col">
          <LivePanel
            engineSettings={settings}
            isEngineThinking={isEngineThinking}
            moves={game?.moves || []}
            armProgress={armProgress}
            capturedPieces={game?.captures || { white: [], black: [] }}
          />
        </section>
      </main>

      {/* 3. Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentSettings={settings}
        stockfishAvailable={stockfishAvailable}
        installInstructions={installInstructions}
        onSave={handleSaveSettings}
      />

      {/* 4. History Modal */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onSelectGame={(selected) => {
          setGame(selected);
          setDisplayedFen(selected.fen);
          setActiveMove(null);
          setIsArmMoving(false);
          setIsHistoryOpen(false);
          setupWebSocket(selected.id);
        }}
      />

      {/* 5. Autonomous Demo Report Modal */}
      <DemoReportModal
        isOpen={isDemoReportOpen}
        onClose={() => setIsDemoReportOpen(false)}
        reportData={demoReportData}
        onDownloadPgn={handleExportPgn}
      />
    </div>
  );
}
