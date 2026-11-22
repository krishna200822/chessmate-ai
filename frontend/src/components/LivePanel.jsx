import React, { useEffect, useRef } from 'react';
import { Activity, Move, Sparkles } from 'lucide-react';

export default function LivePanel({
  engineSettings,
  isEngineThinking,
  moves = [],
  armProgress = null,
  capturedPieces = { white: [], black: [] },
}) {
  const scrollContainerRef = useRef(null);

  // Auto-scroll moves list to bottom when new move arrives without scrolling window
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [moves]);

  // Group moves into pairs (White move, Black move)
  const pairedMoves = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairedMoves.push({
      number: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1] || null,
    });
  }

  // Get latest engine move explanation
  const latestEngineMove = [...moves].reverse().find((m) => m.explanation);

  return (
    <div className="flex flex-col h-full bg-white/95 border border-neutral-200/90 rounded-3xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.04)] backdrop-blur-md">
      {/* 1. Header: Engine & Arm Telemetry */}
      <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-neutral-900" />
          <h3 className="text-xs font-bold tracking-tight text-neutral-900 font-sans">
            Match Telemetry
          </h3>
        </div>

        {isEngineThinking ? (
          <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-[#ccff00]/25 border border-[#ccff00] text-[11px] font-bold text-neutral-950 font-mono">
            <span className="w-2 h-2 rounded-full bg-neutral-950 animate-ping" />
            <span>AI THINKING...</span>
          </div>
        ) : (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-neutral-100 text-[11px] font-medium text-neutral-600 font-sans">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>READY</span>
          </div>
        )}
      </div>

      {/* 2. Arm Real-Time Execution Status Card */}
      {armProgress && armProgress.total > 0 && (
        <div className="p-3.5 bg-neutral-50/80 border-b border-neutral-100">
          <div className="flex items-center justify-between text-xs font-mono mb-1.5">
            <span className="text-neutral-950 font-bold uppercase tracking-wide flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-[#ccff00] shadow-[0_0_8px_#ccff00] animate-pulse" />
              <span>{armProgress.step || 'ROBOT ARM TRAJECTORY'}</span>
            </span>
            <span className="text-neutral-500 text-[11px]">
              Step {armProgress.index || 1} / {armProgress.total}
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-neutral-200 h-1.5 rounded-full overflow-hidden mb-1">
            <div
              className="bg-[#ccff00] h-full transition-all duration-300 ease-out"
              style={{ width: `${Math.round((armProgress.progress || 0) * 100)}%` }}
            />
          </div>
          <p className="text-[11px] font-sans text-neutral-600 truncate">
            {armProgress.description || 'Executing trajectory...'}
          </p>
        </div>
      )}

      {/* 3. Engine Parameters Metric Chips */}
      <div className="grid grid-cols-4 gap-2 p-3 bg-neutral-50/50 border-b border-neutral-100 text-center font-sans">
        <div className="bg-white p-2 rounded-2xl border border-neutral-200/80 shadow-sm">
          <div className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">ELO</div>
          <div className="text-neutral-950 font-mono font-bold text-xs mt-0.5">{engineSettings.elo || 1500}</div>
        </div>
        <div className="bg-white p-2 rounded-2xl border border-neutral-200/80 shadow-sm">
          <div className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">DEPTH</div>
          <div className="text-neutral-950 font-mono font-bold text-xs mt-0.5">{engineSettings.depth || 10}</div>
        </div>
        <div className="bg-white p-2 rounded-2xl border border-neutral-200/80 shadow-sm">
          <div className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">TIME</div>
          <div className="text-neutral-950 font-mono font-bold text-xs mt-0.5">{engineSettings.think_time || 1.0}s</div>
        </div>
        <div className="bg-white p-2 rounded-2xl border border-neutral-200/80 shadow-sm">
          <div className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">STYLE</div>
          <div className="text-neutral-950 font-mono font-bold text-xs mt-0.5 uppercase truncate">
            {engineSettings.style || 'BAL'}
          </div>
        </div>
      </div>

      {/* 4. Captured Pieces Tally */}
      <div className="px-4 py-2.5 border-b border-neutral-100 flex items-center justify-between text-xs font-mono bg-neutral-50/30">
        <div className="flex items-center space-x-1">
          <span className="text-neutral-400 text-[10px] font-bold">WHITE:</span>
          <span className="text-neutral-800 tracking-wider font-semibold">
            {capturedPieces.white?.join(' ') || '—'}
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="text-neutral-400 text-[10px] font-bold">BLACK:</span>
          <span className="text-neutral-800 tracking-wider font-semibold">
            {capturedPieces.black?.join(' ') || '—'}
          </span>
        </div>
      </div>

      {/* 5. Move List Container */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-3.5 space-y-1 font-mono text-xs max-h-[280px]">
        {pairedMoves.length === 0 ? (
          <div className="h-32 flex flex-col items-center justify-center text-neutral-400 font-sans">
            <Move className="w-5 h-5 mb-2 opacity-40 text-neutral-400" />
            <p className="text-xs">Awaiting first move...</p>
          </div>
        ) : (
          pairedMoves.map((pair) => (
            <div
              key={pair.number}
              className="grid grid-cols-12 py-1.5 px-2.5 rounded-xl hover:bg-neutral-100 transition-colors"
            >
              <span className="col-span-2 text-neutral-400 font-bold">{pair.number}.</span>
              <span className="col-span-5 text-neutral-900 font-semibold">
                {pair.white.san}
                {pair.white.is_check && <span className="text-rose-500 ml-0.5 font-bold">+</span>}
              </span>
              <span className="col-span-5 text-neutral-600">
                {pair.black ? (
                  <>
                    {pair.black.san}
                    {pair.black.is_check && <span className="text-rose-500 ml-0.5 font-bold">+</span>}
                  </>
                ) : (
                  '...'
                )}
              </span>
            </div>
          ))
        )}
      </div>

      {/* 6. AI Move Explanation Footer Card */}
      {latestEngineMove && latestEngineMove.explanation && (
        <div className="p-4 border-t border-neutral-100 bg-neutral-50/90">
          <div className="flex items-center space-x-1.5 text-xs font-sans font-bold text-neutral-900 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>AI Rationale:</span>
          </div>
          <p className="text-xs text-neutral-600 italic font-serif leading-relaxed">
            "{latestEngineMove.explanation}"
          </p>
        </div>
      )}
    </div>
  );
}
