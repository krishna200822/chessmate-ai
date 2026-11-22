import React from 'react';
import { Cpu, History, Settings as SettingsIcon, Bot, Zap, Square, Activity } from 'lucide-react';

export default function Navbar({
  wsStatus,
  stockfishAvailable,
  armStatus,
  turn,
  gameStatus,
  isDemoMode = false,
  onOpenSettings,
  onOpenHistory,
  onToggleDemo,
}) {
  return (
    <header className="sticky top-2 z-40 px-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between rounded-full bg-white/90 backdrop-blur-md border border-neutral-200/90 shadow-[0_10px_30px_rgba(0,0,0,0.05)] px-4 sm:px-6 py-2.5 transition-all">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white shadow-sm">
            <Bot className="w-4 h-4 text-[#ccff00]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold tracking-tight text-sm sm:text-base text-neutral-900 font-sans">
                ChessMate <span className="font-serif italic font-normal text-neutral-500">AI</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ccff00] text-neutral-950 font-bold tracking-wider font-mono shadow-sm">
                6-DOF
              </span>
            </div>
          </div>
        </div>

        {/* Telemetry Status Bar */}
        <div className="hidden lg:flex items-center space-x-2.5 text-xs font-sans">
          {/* Active Agent Badge */}
          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-neutral-50 border border-neutral-200/80 text-neutral-700">
            <span
              className={`w-2 h-2 rounded-full ${
                wsStatus === 'connected'
                  ? 'bg-emerald-500'
                  : wsStatus === 'connecting'
                  ? 'bg-amber-400'
                  : 'bg-rose-500'
              }`}
            />
            <span className="text-[11px] font-medium">
              {wsStatus === 'connected' ? 'Agent Active' : wsStatus}
            </span>
          </div>

          {/* Engine Pill */}
          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-neutral-50 border border-neutral-200/80 text-neutral-700">
            <Cpu className="w-3.5 h-3.5 text-neutral-500" />
            <span className="text-[11px] font-medium">
              {stockfishAvailable ? 'Stockfish 16 UCI' : 'Built-in Engine'}
            </span>
          </div>

          {/* Arm Status Pill */}
          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-neutral-50 border border-neutral-200/80 text-neutral-700">
            <div
              className={`w-2 h-2 rounded-full ${
                armStatus === 'moving'
                  ? 'bg-[#ccff00] shadow-[0_0_8px_#ccff00] animate-pulse'
                  : 'bg-neutral-400'
              }`}
            />
            <span className="text-[11px] font-medium">
              Arm: <span className="font-semibold text-neutral-900 uppercase">{armStatus}</span>
            </span>
          </div>

          {/* Turn Pill */}
          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-neutral-950 text-white font-medium text-[11px]">
            <span className="text-neutral-400">Turn:</span>
            <span className="font-bold text-[#ccff00] uppercase tracking-wider">{turn}</span>
            {gameStatus === 'paused' && (
              <span className="ml-1 text-[9px] px-1.5 py-0.2 bg-amber-400/20 text-amber-300 rounded-full font-bold">
                PAUSED
              </span>
            )}
            {isDemoMode && (
              <span className="ml-1 text-[9px] px-1.5 py-0.2 bg-[#ccff00]/20 text-[#ccff00] rounded-full font-bold animate-pulse">
                DEMO
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {onToggleDemo && (
            <button
              onClick={onToggleDemo}
              className={`flex items-center space-x-1.5 px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm ${
                isDemoMode
                  ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200'
                  : 'bg-[#ccff00] hover:bg-[#d9ff33] text-neutral-950 shadow-[0_2px_10px_rgba(204,255,0,0.3)]'
              }`}
              title="Auto-play full game with simulated 6-DOF arm movements"
            >
              {isDemoMode ? (
                <Square className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Zap className="w-3.5 h-3.5 fill-current" />
              )}
              <span className="hidden sm:inline">{isDemoMode ? 'STOP DEMO' : 'RUN DEMO'}</span>
            </button>
          )}

          <button
            onClick={onOpenHistory}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-200 text-xs transition-colors shadow-sm font-medium"
            title="Game History & Replay"
          >
            <History className="w-3.5 h-3.5 text-neutral-500" />
            <span className="hidden md:inline">History</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-200 text-xs transition-colors shadow-sm font-medium"
            title="Engine & Match Settings"
          >
            <SettingsIcon className="w-3.5 h-3.5 text-neutral-500" />
            <span className="hidden md:inline">Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
}
