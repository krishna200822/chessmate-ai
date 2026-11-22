import React, { useState, useEffect } from 'react';
import { X, Cpu, ShieldCheck, Zap, Shield, Scale, Check } from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  currentSettings,
  stockfishAvailable,
  installInstructions,
  onSave,
}) {
  const [elo, setElo] = useState(1500);
  const [depth, setDepth] = useState(10);
  const [thinkTime, setThinkTime] = useState(1.0);
  const [style, setStyle] = useState('balanced');
  const [humanColor, setHumanColor] = useState('white');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (currentSettings) {
      setElo(currentSettings.elo || 1500);
      setDepth(currentSettings.depth || 10);
      setThinkTime(currentSettings.think_time || 1.0);
      setStyle(currentSettings.style || 'balanced');
      setHumanColor(currentSettings.human_color || 'white');
    }
  }, [currentSettings]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      elo: Number(elo),
      depth: Number(depth),
      think_time: Number(thinkTime),
      style,
      human_color: humanColor,
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 500);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-neutral-200/90 rounded-3xl w-full max-w-lg shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-900">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-neutral-900 font-sans">
                Engine & System Settings
              </h3>
              <p className="text-xs text-neutral-500 font-sans">Fine-tune Stockfish AI playstyle & depth</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-900 p-1.5 rounded-full hover:bg-neutral-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-sm font-sans max-h-[80vh] overflow-y-auto">
          {/* Stockfish Engine Status Banner */}
          <div
            className={`p-3.5 rounded-2xl border flex flex-col space-y-1.5 text-xs ${
              stockfishAvailable
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <div className="flex items-center space-x-2 font-semibold font-sans">
              <ShieldCheck className="w-4 h-4" />
              <span>
                {stockfishAvailable ? 'Stockfish 16 UCI Online' : 'Built-in Heuristic Engine'}
              </span>
            </div>
            {!stockfishAvailable && installInstructions && (
              <details className="mt-1 font-mono text-[11px]">
                <summary className="cursor-pointer text-neutral-900 font-bold hover:underline">
                  View Stockfish setup guide
                </summary>
                <pre className="mt-2 p-2.5 rounded-xl bg-white border border-neutral-200 text-[10px] whitespace-pre-wrap text-neutral-700 leading-relaxed">
                  {installInstructions}
                </pre>
              </details>
            )}
          </div>

          {/* 1. ELO Rating Slider (800 - 2800) */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="text-neutral-700 font-bold">AI Skill Level (ELO)</label>
              <span className="text-neutral-950 font-bold px-2.5 py-0.5 rounded-full bg-[#ccff00] text-xs font-mono">
                {elo} ELO
              </span>
            </div>
            <input
              type="range"
              min="800"
              max="2800"
              step="50"
              value={elo}
              onChange={(e) => setElo(e.target.value)}
              className="w-full h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-black"
            />
            <div className="flex justify-between text-[10px] font-mono text-neutral-400">
              <span>800 (Beginner)</span>
              <span>1800 (Club)</span>
              <span>2800 (Grandmaster)</span>
            </div>
          </div>

          {/* 2. Think Time & Search Depth */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <label className="text-neutral-700 font-bold">Think Time</label>
                <span className="text-neutral-900 font-mono font-bold">{thinkTime}s</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="5.0"
                step="0.2"
                value={thinkTime}
                onChange={(e) => setThinkTime(e.target.value)}
                className="w-full h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-black"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <label className="text-neutral-700 font-bold">Search Depth</label>
                <span className="text-neutral-900 font-mono font-bold">d={depth}</span>
              </div>
              <input
                type="range"
                min="2"
                max="24"
                step="1"
                value={depth}
                onChange={(e) => setDepth(e.target.value)}
                className="w-full h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-black"
              />
            </div>
          </div>

          {/* 3. Playing Style Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-neutral-700">
              Tactical Playing Style
            </label>
            <div className="grid grid-cols-3 gap-2.5 text-xs">
              {[
                {
                  id: 'aggressive',
                  name: 'Aggressive',
                  desc: 'Attacks & checks',
                  icon: Zap,
                },
                {
                  id: 'balanced',
                  name: 'Balanced',
                  desc: 'Solid optimal',
                  icon: Scale,
                },
                {
                  id: 'defensive',
                  name: 'Defensive',
                  desc: 'King safety & trades',
                  icon: Shield,
                },
              ].map((item) => {
                const IconComponent = item.icon;
                const isSelected = style === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setStyle(item.id)}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                      isSelected
                        ? 'bg-black text-white border-black shadow-sm'
                        : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    <IconComponent className={`w-4 h-4 mb-2 ${isSelected ? 'text-[#ccff00]' : 'text-neutral-400'}`} />
                    <div>
                      <div className="font-bold text-xs">{item.name}</div>
                      <div className={`text-[10px] mt-0.5 leading-tight ${isSelected ? 'text-neutral-300' : 'text-neutral-400'}`}>
                        {item.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Human Color Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-neutral-700">
              Human Color
            </label>
            <div className="grid grid-cols-2 gap-3 text-xs font-sans">
              <button
                type="button"
                onClick={() => setHumanColor('white')}
                className={`py-2.5 px-3 rounded-2xl border flex items-center justify-center space-x-2 transition-all ${
                  humanColor === 'white'
                    ? 'bg-neutral-900 text-white border-neutral-900 font-bold shadow-sm'
                    : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                <span>White (You move first)</span>
              </button>
              <button
                type="button"
                onClick={() => setHumanColor('black')}
                className={`py-2.5 px-3 rounded-2xl border flex items-center justify-center space-x-2 transition-all ${
                  humanColor === 'black'
                    ? 'bg-neutral-900 text-white border-neutral-900 font-bold shadow-sm'
                    : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                <span>Black (Robot moves first)</span>
              </button>
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 rounded-full bg-[#ccff00] hover:bg-[#d9ff33] text-neutral-950 font-bold text-xs tracking-wide transition-all shadow-[0_2px_10px_rgba(204,255,0,0.3)] flex items-center justify-center space-x-2 active:scale-98"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Settings Saved!</span>
                </>
              ) : (
                <span>Save & Apply Configuration</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
