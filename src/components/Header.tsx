import React from 'react';
import { Eye, Sparkles, ShieldCheck } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="w-full border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Eye className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg tracking-tight text-white">AI Search Lens</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Page Auditor
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Search + AI Visibility Auditor</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden md:flex items-center space-x-2 text-xs text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Exact Page Lock Preserved</span>
          </div>
          <div className="flex items-center space-x-1.5 text-xs text-indigo-300 bg-indigo-950/50 px-3 py-1.5 rounded-lg border border-indigo-800/50">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-medium">TinyFish Engine</span>
          </div>
        </div>
      </div>
    </header>
  );
};
