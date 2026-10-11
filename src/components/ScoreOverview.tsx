'use client';

import React from 'react';
import { FinalAuditReport } from '@/types/audit';
import { ShieldCheck, AlertTriangle, ExternalLink, Sparkles } from 'lucide-react';

interface ScoreOverviewProps {
  report: FinalAuditReport;
}

export const ScoreOverview: React.FC<ScoreOverviewProps> = ({ report }) => {
  const { overallScore, targetContext, summary, isPartialAudit, partialAuditReason } = report;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10 shadow-emerald-500/20';
    if (score >= 60) return 'text-amber-400 border-amber-500/40 bg-amber-500/10 shadow-amber-500/20';
    return 'text-rose-400 border-rose-500/40 bg-rose-500/10 shadow-rose-500/20';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent — High Search + AI Readiness';
    if (score >= 60) return 'Good — Moderate Optimization Opportunities Remain';
    return 'Critical Fixes Required for Search & AI Visibility';
  };

  return (
    <div className="w-full space-y-6">
      {targetContext.isRedirected && (
        <div className="p-4 rounded-xl bg-amber-950/70 border border-amber-500/50 flex items-start space-x-3 text-amber-200 text-xs sm:text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-amber-300">
              Target Page Redirect Disclosed: The requested URL redirected to a different destination.
            </div>
            <div className="text-amber-200/90 text-xs space-y-1 mt-1">
              <p>
                <span className="font-semibold text-slate-300">Requested Target URL:</span>{' '}
                <code className="font-mono bg-black/40 px-1.5 py-0.5 rounded text-amber-200">{targetContext.normalizedUrl}</code>
              </p>
              <p>
                <span className="font-semibold text-slate-300">Final Rendered Destination:</span>{' '}
                <code className="font-mono bg-black/40 px-1.5 py-0.5 rounded text-amber-200">{targetContext.finalUrl}</code>
              </p>
              <p className="text-slate-400 italic mt-1">
                Notice: The evidence below reflects the rendered document of the final destination page. A Technical SEO finding has been recorded for this redirect behavior.
              </p>
            </div>
          </div>
        </div>
      )}

      {isPartialAudit && (
        <div className="p-4 rounded-xl bg-amber-950/60 border border-amber-800/60 flex items-start space-x-3 text-amber-200 text-xs sm:text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-amber-300">Partial Audit Disclosed:</span>{' '}
            {partialAuditReason || 'Search visibility could not be verified via TinyFish Search. Technical SEO and AI readability findings are fully available.'}
          </div>
        </div>
      )}

      {/* Primary Header Card */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300 text-xs font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>Exact Target Lock</span>
              </span>
              {!targetContext.isRootDomain && (
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px] font-semibold">
                  Page Audit Path: {targetContext.pathname}
                </span>
              )}
              {targetContext.isRedirected && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-semibold">
                  Redirected → {targetContext.redirectPathname || '/'}
                </span>
              )}
            </div>

            <a
              href={targetContext.normalizedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center space-x-2 text-lg sm:text-2xl font-bold text-white hover:text-cyan-300 transition-colors break-all"
            >
              <span>{targetContext.normalizedUrl}</span>
              <ExternalLink className="w-5 h-5 text-slate-500 group-hover:text-cyan-400 transition-colors shrink-0" />
            </a>

            <p className="text-xs sm:text-sm text-slate-400 font-medium">
              {getScoreLabel(overallScore)}
            </p>
          </div>

          {/* Glowing Circular Score Badge */}
          <div className="shrink-0 flex items-center space-x-4">
            <div className={`w-28 h-28 sm:w-32 sm:h-32 rounded-2xl border-2 flex flex-col items-center justify-center shadow-xl backdrop-blur-xl ${getScoreColor(overallScore)}`}>
              <span className="text-4xl sm:text-5xl font-extrabold tracking-tight">{overallScore}</span>
              <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase mt-0.5">/ 100 Score</span>
            </div>
          </div>
        </div>
      </div>

      {/* Executive Summary & Visibility vs Readability Connection Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel rounded-xl p-5 space-y-2">
          <div className="flex items-center space-x-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Audit Overview</span>
          </div>
          <h3 className="text-base font-bold text-white">{summary.headline}</h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{summary.overview}</p>
        </div>

        <div className="glass-panel rounded-xl p-5 space-y-2">
          <div className="flex items-center space-x-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>Search Visibility ↔ AI Readability Connection</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {summary.visibilityVsReadabilityStatus}
          </p>
        </div>
      </div>
    </div>
  );
};
