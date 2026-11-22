import React from 'react';

export default function EvaluationBar({ scoreCp = 0, isMate = false, mateIn = null }) {
  let whitePercent = 50;

  if (isMate) {
    whitePercent = (mateIn && mateIn > 0) ? 100 : 0;
  } else if (scoreCp !== null && scoreCp !== undefined) {
    const winProb = 1 / (1 + Math.pow(10, -scoreCp / 400));
    whitePercent = Math.max(5, Math.min(95, Math.round(winProb * 100)));
  }

  let label = '0.0';
  if (isMate && mateIn !== null) {
    label = `M${Math.abs(mateIn)}`;
  } else if (scoreCp !== null && scoreCp !== undefined) {
    const pawns = scoreCp / 100;
    label = (pawns >= 0 ? '+' : '') + pawns.toFixed(1);
  }

  return (
    <div className="flex flex-col items-center select-none h-full py-1">
      <div className="text-[10px] font-mono font-bold text-neutral-400 mb-1">
        EVAL
      </div>
      <div className="relative w-3.5 sm:w-4 h-full min-h-[300px] bg-neutral-900 rounded-full border border-neutral-300 overflow-hidden flex flex-col justify-end shadow-inner">
        {/* White evaluation fill from bottom */}
        <div
          className="w-full bg-white transition-all duration-500 ease-out"
          style={{ height: `${whitePercent}%` }}
        />

        {/* Center line (0.0 evaluation) */}
        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-neutral-400/60" />

        {/* Score indicator badge */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 px-1 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-tighter transition-all duration-300 shadow-sm ${
            whitePercent >= 50
              ? 'bottom-2 text-neutral-950 bg-[#ccff00]'
              : 'top-2 text-white bg-black'
          }`}
        >
          {label}
        </div>
      </div>
      <div className="text-[9px] font-mono text-neutral-500 mt-1 font-semibold">
        {whitePercent}% W
      </div>
    </div>
  );
}
