import React, { useState } from 'react';
import { Sliders, X, RotateCcw, Check, Info } from 'lucide-react';

export default function WeightConfigModal({ isOpen, onClose }) {
  const [weights, setWeights] = useState({
    semantic: 0.40,
    identifier: 0.20,
    discipline: 0.15,
    location: 0.10,
    wbs: 0.10,
    temporal: 0.05
  });

  const [thresholds, setThresholds] = useState({
    high: 0.85,
    medium: 0.60
  });

  if (!isOpen) return null;

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  const resetDefaults = () => {
    setWeights({
      semantic: 0.40,
      identifier: 0.20,
      discipline: 0.15,
      location: 0.10,
      wbs: 0.10,
      temporal: 0.05
    });
    setThresholds({
      high: 0.85,
      medium: 0.60
    });
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="panel-card max-w-xl w-full p-6 space-y-5 bg-[#111111] border-[#2A2A2A] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#D4AF37]/10 text-[#D4AF37]">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#EAEAEA]">Reconciliation Engine Weights & Policies</h3>
              <p className="text-xs text-[#A3A3A3]">Configure multi-signal scoring weights and review thresholds</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#A3A3A3] hover:text-[#D4AF37] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Weights Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-[#EAEAEA]">
            <span>Context Signal Weights</span>
            <span className={`font-mono text-xs ${Math.abs(totalWeight - 1.0) < 0.01 ? 'text-[#10B981]' : 'text-[#EF4444] font-bold'}`}>
              Sum: {(totalWeight * 100).toFixed(0)}% {Math.abs(totalWeight - 1.0) >= 0.01 && '(Must equal 100%)'}
            </span>
          </div>

          <div className="space-y-2.5 text-xs bg-[#0A0A0A] p-4 rounded-lg border border-[#2A2A2A]">
            {Object.entries(weights).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <span className="capitalize text-[#EAEAEA] w-32">{key} Similarity</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={val}
                  onChange={(e) => setWeights({ ...weights, [key]: parseFloat(e.target.value) })}
                  className="w-full accent-[#D4AF37] cursor-pointer"
                />
                <span className="font-mono text-[#F4D06F] w-12 text-right font-semibold">
                  {(val * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Confidence Thresholds */}
        <div className="space-y-3">
          <span className="text-xs font-semibold text-[#EAEAEA]">Routing Policy Thresholds</span>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-[#0A0A0A] p-3 rounded-lg border border-[#2A2A2A] space-y-1.5">
              <label className="text-[#A3A3A3]">High Confidence (Auto-Process)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.05"
                  min="0.5"
                  max="1.0"
                  value={thresholds.high}
                  onChange={(e) => setThresholds({ ...thresholds, high: parseFloat(e.target.value) })}
                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] focus:border-[#D4AF37] outline-none rounded px-2 py-1 text-xs text-[#10B981] font-mono font-semibold"
                />
                <span className="text-[#A3A3A3] font-mono">(&ge; {(thresholds.high * 100).toFixed(0)}%)</span>
              </div>
            </div>

            <div className="bg-[#0A0A0A] p-3 rounded-lg border border-[#2A2A2A] space-y-1.5">
              <label className="text-[#A3A3A3]">Medium Confidence (Planner Review)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.05"
                  min="0.3"
                  max="0.9"
                  value={thresholds.medium}
                  onChange={(e) => setThresholds({ ...thresholds, medium: parseFloat(e.target.value) })}
                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] focus:border-[#D4AF37] outline-none rounded px-2 py-1 text-xs text-[#F59E0B] font-mono font-semibold"
                />
                <span className="text-[#A3A3A3] font-mono">(&ge; {(thresholds.medium * 100).toFixed(0)}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-[#2A2A2A]">
          <button 
            onClick={resetDefaults}
            className="btn-outline text-xs"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-secondary text-xs">
              Cancel
            </button>
            <button onClick={onClose} className="btn-primary text-xs">
              <Check className="w-3.5 h-3.5" />
              <span>Save Configuration</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
