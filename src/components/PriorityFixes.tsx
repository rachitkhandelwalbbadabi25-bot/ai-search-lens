'use client';

import React from 'react';
import { AuditFinding } from '@/types/audit';
import { AlertCircle, AlertTriangle, Info, CheckCircle, Wrench, FileCode2 } from 'lucide-react';

interface PriorityFixesProps {
  fixes: AuditFinding[];
}

export const PriorityFixes: React.FC<PriorityFixesProps> = ({ fixes }) => {
  if (!fixes || fixes.length === 0) {
    return (
      <div className="glass-panel rounded-xl p-6 text-center space-y-2">
        <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
        <h3 className="text-base font-bold text-white">No Critical Issues Detected</h3>
        <p className="text-xs text-slate-400">Your page meets technical SEO and AI readability best practices.</p>
      </div>
    );
  }

  const getSeverityBadge = (severity: AuditFinding['severity']) => {
    switch (severity) {
      case 'CRITICAL':
        return {
          icon: AlertCircle,
          class: 'bg-rose-950/80 border-rose-700/60 text-rose-300',
        };
      case 'HIGH':
        return {
          icon: AlertTriangle,
          class: 'bg-orange-950/80 border-orange-700/60 text-orange-300',
        };
      case 'MEDIUM':
        return {
          icon: Info,
          class: 'bg-amber-950/80 border-amber-700/60 text-amber-300',
        };
      case 'LOW':
      default:
        return {
          icon: Info,
          class: 'bg-slate-900 border-slate-700 text-slate-300',
        };
    }
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white tracking-tight">Prioritized Actionable Fixes</h2>
        <span className="text-xs text-slate-400 font-semibold">{fixes.length} Total Findings</span>
      </div>

      <div className="space-y-4">
        {fixes.map((item, index) => {
          const badge = getSeverityBadge(item.severity);
          const SeverityIcon = badge.icon;

          return (
            <div key={item.id} className="glass-panel-interactive rounded-xl p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center space-x-2.5">
                  <span className="w-6 h-6 rounded-md bg-slate-900 border border-slate-800 text-xs font-bold text-cyan-400 flex items-center justify-center shrink-0">
                    #{index + 1}
                  </span>
                  <span className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${badge.class}`}>
                    <SeverityIcon className="w-3.5 h-3.5" />
                    <span>{item.severity}</span>
                  </span>
                  <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    -{item.deductionPoints} pts
                  </span>
                </div>

                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-900/60 px-2.5 py-0.5 rounded">
                  {item.category.replace('_', ' ')}
                </span>
              </div>

              <h3 className="text-base font-bold text-white">{item.title}</h3>

              {/* Observed Evidence Box */}
              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 text-xs space-y-1">
                <div className="flex items-center space-x-1.5 text-cyan-300 font-semibold">
                  <FileCode2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Observed Page Evidence ({item.evidence.location})</span>
                </div>
                <p className="text-slate-300 font-mono text-[11px] leading-relaxed break-all bg-slate-900/60 p-2 rounded border border-slate-800">
                  {item.evidence.observed || 'No specific DOM snippet'}
                </p>
              </div>

              {/* Why It Matters */}
              <div className="text-xs text-slate-300 leading-relaxed">
                <strong className="text-slate-200">Why it matters:</strong> {item.whyItMatters}
              </div>

              {/* Recommended Fix Box */}
              <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-xs space-y-1">
                <div className="flex items-center space-x-1.5 text-emerald-300 font-semibold">
                  <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Recommended Actionable Fix</span>
                </div>
                <p className="text-slate-200 leading-relaxed">{item.recommendedFix}</p>
                {item.expectedImpact && (
                  <p className="text-[11px] text-emerald-400/90 font-medium pt-1">
                    Expected Benefit: {item.expectedImpact}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
