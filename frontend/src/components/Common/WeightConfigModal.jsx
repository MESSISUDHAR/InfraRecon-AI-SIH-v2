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
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="panel-card max-w-xl w-full p-6 space-y-5 bg-slate-900 border-slate-700 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Reconciliation Engine Weights & Policies</h3>
              <p className="text-xs text-slate-400">Configure multi-signal scoring weights and review thresholds</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Weights Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>Context Signal Weights</span>
            <span className={`font-mono text-xs ${Math.abs(totalWeight - 1.0) < 0.01 ? 'text-emerald-400' : 'text-rose-400 font-bold'}`}>
              Sum: {(totalWeight * 100).toFixed(0)}% {Math.abs(totalWeight - 1.0) >= 0.01 && '(Must equal 100%)'}
            </span>
          </div>

          <div className="space-y-2.5 text-xs bg-slate-950/60 p-4 rounded-lg border border-slate-800">
            {Object.entries(weights).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <span className="capitalize text-slate-300 w-32">{key} Similarity</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={val}
                  onChange={(e) => setWeights({ ...weights, [key]: parseFloat(e.target.value) })}
                  className="w-full accent-brand-500"
                />
                <span className="font-mono text-slate-200 w-12 text-right">
                  {(val * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Confidence Thresholds */}
        <div className="space-y-3">
          <span className="text-xs font-semibold text-slate-300">Routing Policy Thresholds</span>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-1.5">
              <label className="text-slate-400">High Confidence (Auto-Process)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.05"
                  min="0.5"
                  max="1.0"
                  value={thresholds.high}
                  onChange={(e) => setThresholds({ ...thresholds, high: parseFloat(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-emerald-400 font-mono"
                />
                <span className="text-slate-500 font-mono">(&ge; {(thresholds.high * 100).toFixed(0)}%)</span>
              </div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-1.5">
              <label className="text-slate-400">Medium Confidence (Planner Review)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.05"
                  min="0.3"
                  max="0.9"
                  value={thresholds.medium}
                  onChange={(e) => setThresholds({ ...thresholds, medium: parseFloat(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-amber-400 font-mono"
                />
                <span className="text-slate-500 font-mono">(&ge; {(thresholds.medium * 100).toFixed(0)}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
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
