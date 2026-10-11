'use client';

import React, { useEffect, useState } from 'react';
import { Check, Loader2, Sparkles } from 'lucide-react';

interface ProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed';
}

interface ProgressStepperProps {
  isAuditing: boolean;
}

const INITIAL_STEPS: ProgressStep[] = [
  { id: 'step-1', label: 'URL validated & exact target locked', status: 'pending' },
  { id: 'step-2', label: 'Reading live page structure via TinyFish Fetch', status: 'pending' },
  { id: 'step-3', label: 'Extracting DOM metadata, headings & JSON-LD schema', status: 'pending' },
  { id: 'step-4', label: 'Investigating search discoverability via TinyFish Search', status: 'pending' },
  { id: 'step-5', label: 'Evaluating AI readability & citation extractability', status: 'pending' },
  { id: 'step-6', label: 'Calculating deterministic score & prioritized fixes', status: 'pending' },
];

export const ProgressStepper: React.FC<ProgressStepperProps> = ({ isAuditing }) => {
  const [steps, setSteps] = useState<ProgressStep[]>(INITIAL_STEPS);

  useEffect(() => {
    if (!isAuditing) {
      setSteps(INITIAL_STEPS);
      return;
    }

    // Step 1: Immediately completed
    setSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'completed' } : i === 1 ? { ...s, status: 'running' } : s));

    const timer1 = setTimeout(() => {
      setSteps(prev => prev.map((s, i) => i <= 1 ? { ...s, status: 'completed' } : i === 2 ? { ...s, status: 'running' } : s));
    }, 1500);

    const timer2 = setTimeout(() => {
      setSteps(prev => prev.map((s, i) => i <= 2 ? { ...s, status: 'completed' } : i === 3 ? { ...s, status: 'running' } : s));
    }, 3500);

    const timer3 = setTimeout(() => {
      setSteps(prev => prev.map((s, i) => i <= 3 ? { ...s, status: 'completed' } : i === 4 ? { ...s, status: 'running' } : s));
    }, 6000);

    const timer4 = setTimeout(() => {
      setSteps(prev => prev.map((s, i) => i <= 4 ? { ...s, status: 'completed' } : i === 5 ? { ...s, status: 'running' } : s));
    }, 8500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [isAuditing]);

  if (!isAuditing) return null;

  return (
    <div className="w-full max-w-xl mx-auto my-6 p-6 rounded-2xl glass-panel border border-cyan-500/20 shadow-xl">
      <div className="flex items-center space-x-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-4">
        <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" />
        <span>Live Audit Pipeline in Progress</span>
      </div>

      <div className="space-y-3">
        {steps.map((step) => (
          <div key={step.id} className="flex items-center space-x-3 text-sm">
            <div className="shrink-0">
              {step.status === 'completed' && (
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5" />
                </div>
              )}
              {step.status === 'running' && (
                <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 flex items-center justify-center">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                </div>
              )}
              {step.status === 'pending' && (
                <div className="w-6 h-6 rounded-full bg-slate-900 border border-slate-800 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                  •
                </div>
              )}
            </div>

            <span
              className={`text-xs sm:text-sm font-medium transition-colors ${
                step.status === 'completed'
                  ? 'text-slate-200'
                  : step.status === 'running'
                  ? 'text-cyan-300 font-semibold'
                  : 'text-slate-500'
              }`}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
