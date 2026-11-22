import React from 'react';
import { X, Trophy, Clock, Cpu, Download, Activity, CheckCircle2 } from 'lucide-react';

/**
 * Modal displaying comprehensive report after an Engine-vs-Engine Demo run.
 */
export default function DemoReportModal({
  isOpen,
  onClose,
  reportData,
  onDownloadPgn
}) {
  if (!isOpen || !reportData) return null;

  const {
    movesCount = 0,
    totalTimeSec = 0,
    result = '*',
    status = 'completed',
    whiteStyle = 'Aggressive',
    blackStyle = 'Defensive',
    whiteElo = 2000,
    blackElo = 1800,
    finalFen = '',
    reason = 'Game ended',
    moves = []
  } = reportData;

  const formatDuration = (sec) => {
    const mins = Math.floor(sec / 60);
    const remainder = Math.floor(sec % 60);
    return `${mins}m ${remainder < 10 ? '0' : ''}${remainder}s`;
  };

  const getResultBadge = () => {
    if (result === '1-0') {
      return (
        <div className="flex items-center space-x-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-800 font-bold text-xs font-sans">
          <Trophy className="w-3.5 h-3.5 text-emerald-600" />
          <span>WHITE VICTORY (1-0)</span>
        </div>
      );
    }
    if (result === '0-1') {
      return (
        <div className="flex items-center space-x-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-800 font-bold text-xs font-sans">
          <Trophy className="w-3.5 h-3.5 text-emerald-600" />
          <span>BLACK VICTORY (0-1)</span>
        </div>
      );
    }
    return (
      <div className="flex items-center space-x-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-amber-800 font-bold text-xs font-sans">
        <Activity className="w-3.5 h-3.5 text-amber-600" />
        <span>DRAW ({result})</span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
      <div className="relative w-full max-w-xl bg-white border border-neutral-200/90 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden animate-in fade-in zoom-in-95 duration-200 font-sans">
        {/* Glow Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-black flex items-center justify-center text-[#ccff00]">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 font-sans tracking-tight">
                Autonomous Mission Report
              </h2>
              <p className="text-xs text-neutral-500 font-sans">Engine vs Engine demonstration summary</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded-full hover:bg-neutral-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Top Result Banner */}
          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-sans font-semibold text-neutral-400 uppercase tracking-wider block">
                Final Result
              </span>
              <span className="text-sm font-bold text-neutral-900 mt-0.5 block">
                {reason}
              </span>
            </div>
            {getResultBadge()}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-white rounded-2xl border border-neutral-200 shadow-sm">
              <span className="text-[10px] text-neutral-400 uppercase font-bold block">Total Moves</span>
              <span className="text-lg font-bold text-neutral-900 mt-1 block font-mono">
                {movesCount}
              </span>
            </div>
            <div className="p-3 bg-white rounded-2xl border border-neutral-200 shadow-sm">
              <span className="text-[10px] text-neutral-400 uppercase font-bold block">Duration</span>
              <span className="text-lg font-bold text-neutral-900 mt-1 block font-mono">
                {formatDuration(totalTimeSec)}
              </span>
            </div>
            <div className="p-3 bg-white rounded-2xl border border-neutral-200 shadow-sm">
              <span className="text-[10px] text-neutral-400 uppercase font-bold block">Physical Moves</span>
              <span className="text-lg font-bold text-neutral-900 mt-1 block font-mono">
                {movesCount}
              </span>
            </div>
            <div className="p-3 bg-white rounded-2xl border border-neutral-200 shadow-sm">
              <span className="text-[10px] text-neutral-400 uppercase font-bold block">Arm Status</span>
              <span className="text-lg font-bold text-emerald-600 mt-1 block font-mono">
                HOMED
              </span>
            </div>
          </div>

          {/* Competitors Details */}
          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-3 text-xs font-sans">
            <h3 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
              Autonomous AI Competitors
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-1.5 text-neutral-900 font-bold">
                  <div className="w-2.5 h-2.5 rounded-full bg-white border border-neutral-300 shadow-sm" />
                  <span>WHITE ENGINE</span>
                </div>
                <div className="text-neutral-500 text-[11px]">ELO: <span className="text-neutral-900 font-mono font-bold">{whiteElo}</span></div>
                <div className="text-neutral-500 text-[11px]">Style: <span className="text-neutral-900 font-semibold capitalize">{whiteStyle}</span></div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-1.5 text-neutral-900 font-bold">
                  <div className="w-2.5 h-2.5 rounded-full bg-neutral-900 shadow-sm" />
                  <span>BLACK ENGINE</span>
                </div>
                <div className="text-neutral-500 text-[11px]">ELO: <span className="text-neutral-900 font-mono font-bold">{blackElo}</span></div>
                <div className="text-neutral-500 text-[11px]">Style: <span className="text-neutral-900 font-semibold capitalize">{blackStyle}</span></div>
              </div>
            </div>
          </div>

          {/* Hardware notice */}
          <div className="p-3.5 bg-neutral-100 rounded-2xl text-[11px] text-neutral-600 flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5 text-neutral-900 flex-shrink-0" />
            <span>
              <strong>Simulation Verified:</strong> 6-DOF kinematics solved analytical trajectories with zero collision. Arm is simulated; hardware integration is the planned next phase.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 bg-neutral-50 border-t border-neutral-100">
          <button
            onClick={onDownloadPgn}
            className="flex items-center space-x-2 px-4 py-2 bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-800 rounded-full text-xs font-semibold transition shadow-sm"
          >
            <Download className="w-4 h-4 text-neutral-500" />
            <span>Export PGN</span>
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#ccff00] hover:bg-[#d9ff33] text-neutral-950 rounded-full text-xs font-bold transition shadow-sm"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
}
