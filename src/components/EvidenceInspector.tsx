'use client';

import React, { useState } from 'react';
import { FinalAuditReport } from '@/types/audit';
import { Code, Database, Heading, Tag, Image as ImageIcon } from 'lucide-react';

interface EvidenceInspectorProps {
  exactDetails: FinalAuditReport['exactPageDetails'];
  targetUrl: string;
}

export const EvidenceInspector: React.FC<EvidenceInspectorProps> = ({ exactDetails, targetUrl }) => {
  const [activeTab, setActiveTab] = useState<'meta' | 'headings' | 'schema' | 'images'>('meta');

  return (
    <div className="w-full space-y-4">
      <h2 className="text-lg font-bold text-white tracking-tight">Exact Page Evidence Inspector</h2>

      <div className="glass-panel rounded-xl overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/80 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('meta')}
            className={`px-4 py-3 text-xs font-bold flex items-center space-x-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'meta'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Title & Metadata</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('headings')}
            className={`px-4 py-3 text-xs font-bold flex items-center space-x-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'headings'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Heading className="w-3.5 h-3.5" />
            <span>Headings ({exactDetails.headings.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('schema')}
            className={`px-4 py-3 text-xs font-bold flex items-center space-x-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'schema'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Structured Data ({exactDetails.structuredDataTypes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('images')}
            className={`px-4 py-3 text-xs font-bold flex items-center space-x-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'images'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Images & Alt Text ({exactDetails.totalImages})</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-5 font-mono text-xs text-slate-300">
          {activeTab === 'meta' && (
            <div className="space-y-4">
              <div>
                <span className="text-slate-500 block text-[11px] font-semibold uppercase mb-1">Target URL</span>
                <span className="text-cyan-300 bg-slate-900 px-2 py-1 rounded border border-slate-800 break-all">{targetUrl}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px] font-semibold uppercase mb-1">Page Title</span>
                <span className="text-white bg-slate-900 px-2 py-1 rounded border border-slate-800 block">{exactDetails.title || 'Missing'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px] font-semibold uppercase mb-1">Meta Description</span>
                <span className="text-slate-300 bg-slate-900 px-2 py-1 rounded border border-slate-800 block">{exactDetails.metaDescription || 'Missing'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px] font-semibold uppercase mb-1">Canonical URL</span>
                <span className="text-slate-300 bg-slate-900 px-2 py-1 rounded border border-slate-800 block">{exactDetails.canonical || 'Missing'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px] font-semibold uppercase mb-1">Robots Directives</span>
                <span className="text-slate-300 bg-slate-900 px-2 py-1 rounded border border-slate-800 block">{exactDetails.robotsDirectives || 'Indexable (Default)'}</span>
              </div>
            </div>
          )}

          {activeTab === 'headings' && (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
              {exactDetails.headings.length === 0 ? (
                <p className="text-slate-500 italic">No heading elements found on page.</p>
              ) : (
                exactDetails.headings.map((h, i) => (
                  <div key={i} className="flex items-start space-x-2 py-1 border-b border-slate-800/60 last:border-0">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      h.level === 'h1' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {h.level}
                    </span>
                    <span className="text-slate-200">{h.text}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'schema' && (
            <div className="space-y-3">
              <div>
                <span className="text-slate-500 block text-[11px] font-semibold uppercase mb-1.5">Detected Schema Types</span>
                {exactDetails.structuredDataTypes.length === 0 ? (
                  <span className="text-amber-400">No supported Schema.org markup detected</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {exactDetails.structuredDataTypes.map((type, i) => (
                      <span key={i} className="px-2.5 py-1 rounded bg-indigo-950/80 border border-indigo-800/60 text-indigo-300 text-xs font-semibold">
                        {type}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'images' && (
            <div className="space-y-3">
              <div className="flex items-center space-x-4">
                <div>
                  <span className="text-slate-500 block text-[11px]">Total Images</span>
                  <span className="text-white font-bold text-sm">{exactDetails.totalImages}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Missing Alt Text</span>
                  <span className={`font-bold text-sm ${exactDetails.missingAltCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {exactDetails.missingAltCount}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
