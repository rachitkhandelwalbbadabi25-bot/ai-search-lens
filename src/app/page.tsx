'use client';

import React, { useState } from 'react';
import { Header } from '@/components/Header';
import { LandingInput } from '@/components/LandingInput';
import { ProgressStepper } from '@/components/ProgressStepper';
import { ScoreOverview } from '@/components/ScoreOverview';
import { CategoryCards } from '@/components/CategoryCards';
import { PriorityFixes } from '@/components/PriorityFixes';
import { EvidenceInspector } from '@/components/EvidenceInspector';
import { FinalAuditReport } from '@/types/audit';
import { RotateCcw, Sparkles } from 'lucide-react';

export default function HomePage() {
  const [isAuditing, setIsAuditing] = useState(false);
  const [report, setReport] = useState<FinalAuditReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleStartAudit = async (targetUrl: string, query?: string) => {
    setIsAuditing(true);
    setErrorMessage(null);
    setReport(null);

    try {
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl, query }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Audit request failed. Please check the URL.');
      }

      setReport(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setErrorMessage(message);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleReset = () => {
    setReport(null);
    setErrorMessage(null);
    setIsAuditing(false);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between selection:bg-cyan-500/30 selection:text-cyan-200">
      <div>
        <Header />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {!report && (
            <>
              <LandingInput
                onStartAudit={handleStartAudit}
                isLoading={isAuditing}
                errorMessage={errorMessage}
              />
              <ProgressStepper isAuditing={isAuditing} />
            </>
          )}

          {report && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Back / New Audit Bar */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center space-x-2 text-xs font-bold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 px-4 py-2 rounded-xl border border-slate-800 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 text-cyan-400" />
                  <span>Audit Another Webpage</span>
                </button>

                <div className="text-xs text-slate-400 flex items-center space-x-1.5 font-mono">
                  <span>Audit Timestamp:</span>
                  <span className="text-slate-200">{new Date(report.auditTimestamp).toLocaleTimeString()}</span>
                </div>
              </div>

              {/* 1. Score Overview & Header */}
              <ScoreOverview report={report} />

              {/* 2. Category Cards */}
              <CategoryCards categories={report.categories} />

              {/* 3. Priority Fixes */}
              <PriorityFixes fixes={report.priorityFixes} />

              {/* 4. Evidence Inspector */}
              <EvidenceInspector exactDetails={report.exactPageDetails} targetUrl={report.targetContext.normalizedUrl} />
            </div>
          )}
        </main>
      </div>

      <footer className="w-full border-t border-slate-800/80 bg-slate-950/80 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500 space-y-1">
          <p className="flex items-center justify-center space-x-1 font-medium">
            <span>AI Search Lens — SEO Page Auditor</span>
            <span>•</span>
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Powered by TinyFish Technical Bounty Drop 001</span>
          </p>
          <p className="text-[11px] text-slate-400">
            Strictly preserves exact page auditing (<code className="text-slate-300">/pricing</code>, <code className="text-slate-300">/blog</code>, <code className="text-slate-300">/docs</code>). No domain-only reductions or fabricated evidence.
          </p>
        </div>
      </footer>
    </div>
  );
}
