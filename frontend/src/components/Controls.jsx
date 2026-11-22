import React from 'react';
import { Play, Pause, Flag, Download, Plus, Bot, Zap, Square } from 'lucide-react';

export default function Controls({
  gameStatus,
  isEngineThinking,
  isDemoMode = false,
  onNewGame,
  onTogglePause,
  onResign,
  onExportPgn,
  onTriggerEngineMove,
  onToggleDemo,
}) {
  const isPaused = gameStatus === 'paused';
  const isGameOver = ['checkmate', 'stalemate', 'draw', 'resigned'].includes(gameStatus);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 p-2 sm:p-2.5 bg-white/95 border border-neutral-200/90 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.04)] backdrop-blur-md">
      {/* Primary Action: New Game (Electric Lime Pill) */}
      <button
        onClick={onNewGame}
        disabled={isDemoMode}
        className="flex items-center space-x-1.5 px-4 py-2 rounded-full bg-[#ccff00] hover:bg-[#d9ff33] text-neutral-950 font-bold text-xs transition-all shadow-[0_2px_10px_rgba(204,255,0,0.3)] disabled:opacity-50 active:scale-95"
      >
        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
        <span>New Game</span>
      </button>

      {/* Demo Button */}
      <button
        onClick={onToggleDemo}
        className={`flex items-center space-x-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all active:scale-95 ${
          isDemoMode
            ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-sm'
            : 'bg-black hover:bg-neutral-800 text-white shadow-sm'
        }`}
        title={isDemoMode ? 'Stop autonomous demo' : 'Auto-play match with 6-DOF robot arm'}
      >
        {isDemoMode ? <Square className="w-3.5 h-3.5 fill-current" /> : <Zap className="w-3.5 h-3.5 text-[#ccff00] fill-current" />}
        <span>{isDemoMode ? 'Stop Demo' : 'Run Demo'}</span>
      </button>

      {/* Trigger AI Move Button */}
      {!isGameOver && (
        <button
          onClick={onTriggerEngineMove}
          disabled={isEngineThinking || isPaused || isDemoMode}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-medium transition-all disabled:opacity-40 active:scale-95"
          title="Force AI engine to compute and make a move"
        >
          <Bot className="w-3.5 h-3.5 text-neutral-700" />
          <span>AI Move</span>
        </button>
      )}

      {/* Pause / Resume Button */}
      {!isGameOver && (
        <button
          onClick={onTogglePause}
          className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-full border text-xs font-medium transition-all active:scale-95 ${
            isPaused
              ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
              : 'bg-white hover:bg-neutral-50 text-neutral-700 border-neutral-200'
          }`}
        >
          {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-600 fill-current" /> : <Pause className="w-3.5 h-3.5 text-amber-600 fill-current" />}
          <span>{isPaused ? 'Resume' : 'Pause'}</span>
        </button>
      )}

      {/* Resign Button */}
      {!isGameOver && (
        <button
          onClick={onResign}
          disabled={isDemoMode}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-full bg-white hover:bg-rose-50 text-rose-600 border border-neutral-200 text-xs font-medium transition-all disabled:opacity-40 active:scale-95"
        >
          <Flag className="w-3.5 h-3.5" />
          <span>Resign</span>
        </button>
      )}

      {/* Export PGN Button */}
      <button
        onClick={onExportPgn}
        className="flex items-center space-x-1.5 px-3.5 py-2 rounded-full bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-200 text-xs font-medium transition-all active:scale-95"
        title="Download match .pgn file"
      >
        <Download className="w-3.5 h-3.5 text-neutral-500" />
        <span>PGN</span>
      </button>
    </div>
  );
}
