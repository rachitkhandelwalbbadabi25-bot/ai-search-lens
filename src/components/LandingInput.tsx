'use client';

import React, { useState } from 'react';
import { Search, ArrowRight, Link2, HelpCircle, AlertCircle, CheckCircle2 } from 'lucide-react';

interface LandingInputProps {
  onStartAudit: (url: string, query?: string) => void;
  isLoading: boolean;
  errorMessage?: string | null;
}

const SAMPLE_URLS = [
  { label: '/pricing', url: 'https://vercel.com/pricing', query: 'vercel pricing plans' },
  { label: '/blog/post', url: 'https://stripe.com/blog', query: 'stripe payment processing guide' },
  { label: '/docs/getting-started', url: 'https://docs.github.com/en/get-started', query: 'github docs quickstart' },
  { label: '/product/suite', url: 'https://linear.app/features', query: 'linear issue tracking tool' },
];

export const LandingInput: React.FC<LandingInputProps> = ({ onStartAudit, isLoading, errorMessage }) => {
  const [url, setUrl] = useState('');
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onStartAudit(url.trim(), query.trim() || undefined);
    }
  };

  const handleSelectSample = (sampleUrl: string, sampleQuery: string) => {
    setUrl(sampleUrl);
    setQuery(sampleQuery);
  };

  return (
    <div className="w-full max-w-3xl mx-auto my-8 sm:my-12 px-4">
      <div className="text-center mb-8 sm:mb-10">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-800/40 text-cyan-300 text-xs font-medium mb-4">
          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
          <span>Page-Level SEO & AI Search Auditor</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4 leading-tight">
          Audit any webpage for <br className="hidden sm:inline" />
          <span className="text-gradient-cyan">Search + AI Visibility</span>
        </h1>
        <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
          Paste any specific URL (<code className="text-cyan-300 bg-slate-900 px-1.5 py-0.5 rounded">/pricing</code>, <code className="text-cyan-300 bg-slate-900 px-1.5 py-0.5 rounded">/blog</code>, <code className="text-cyan-300 bg-slate-900 px-1.5 py-0.5 rounded">/docs</code>). Discover how discoverable, readable, and citeable your exact page is for AI engines.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="glass-panel rounded-2xl p-4 sm:p-6 shadow-2xl relative z-10">
        {errorMessage && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-950/80 border border-rose-800/60 flex items-start space-x-3 text-rose-200 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-300">Validation Notice</p>
              <p className="text-xs text-rose-200/90 mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="target-url-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Exact Webpage URL <span className="text-cyan-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Link2 className="w-5 h-5" />
              </div>
              <input
                id="target-url-input"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="example.com/pricing"
                disabled={isLoading}
                required
                className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 text-sm sm:text-base font-mono transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="optional-query-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Optional Target Search Query
              </label>
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <HelpCircle className="w-3 h-3 text-slate-400" />
                Influences search discoverability
              </span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                id="optional-query-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. best AI resume analyzer for students"
                disabled={isLoading}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-xs sm:text-sm transition-all"
              />
            </div>
          </div>

          <button
            id="audit-page-submit-button"
            type="submit"
            disabled={isLoading || !url.trim()}
            className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-bold text-sm sm:text-base shadow-lg shadow-cyan-500/25 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Auditing Page Content & Search...</span>
              </>
            ) : (
              <>
                <span>Audit Page</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-400 font-medium">Try example URLs:</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {SAMPLE_URLS.map((sample) => (
              <button
                key={sample.label}
                type="button"
                onClick={() => handleSelectSample(sample.url, sample.query)}
                className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-800 hover:border-cyan-500/30 transition-colors font-mono"
              >
                {sample.label}
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
};
