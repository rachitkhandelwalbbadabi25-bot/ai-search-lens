'use client';

import React from 'react';
import { FinalAuditReport } from '@/types/audit';
import { Code2, Search, Cpu, FileText, BookmarkCheck } from 'lucide-react';

interface CategoryCardsProps {
  categories: FinalAuditReport['categories'];
}

export const CategoryCards: React.FC<CategoryCardsProps> = ({ categories }) => {
  const cards = [
    {
      key: 'technicalSeo',
      name: 'Technical SEO',
      icon: Code2,
      data: categories.technicalSeo,
      weight: 25,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      key: 'searchVisibility',
      name: 'Search Visibility',
      icon: Search,
      data: categories.searchVisibility,
      weight: 25,
      color: 'from-violet-500 to-indigo-500',
    },
    {
      key: 'aiReadability',
      name: 'AI Readability',
      icon: Cpu,
      data: categories.aiReadability,
      weight: 25,
      color: 'from-emerald-500 to-teal-500',
    },
    {
      key: 'contentIntent',
      name: 'Content & Intent',
      icon: FileText,
      data: categories.contentIntent,
      weight: 15,
      color: 'from-amber-500 to-orange-500',
    },
    {
      key: 'citationReadiness',
      name: 'Citation Readiness',
      icon: BookmarkCheck,
      data: categories.citationReadiness,
      weight: 10,
      color: 'from-rose-500 to-pink-500',
    },
  ];

  return (
    <div className="w-full space-y-4">
      <h2 className="text-lg font-bold text-white tracking-tight">Audit Category Breakdown</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const { score, maxScore, status, summary } = card.data;
          const percentage = Math.round((score / maxScore) * 100);

          return (
            <div key={card.key} className="glass-panel-interactive rounded-xl p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${card.color} flex items-center justify-center text-white shadow-md`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                    status === 'good' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    status === 'warning' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                    status === 'unverified' ? 'bg-slate-800 text-slate-400 border border-slate-700' :
                    'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {status}
                  </span>
                </div>

                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">{card.name}</h3>

                <div className="mt-2 flex items-baseline space-x-1">
                  <span className="text-2xl font-extrabold text-white">{score}</span>
                  <span className="text-xs text-slate-400 font-semibold">/ {maxScore}</span>
                </div>
              </div>

              <div>
                {/* Progress bar */}
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden mb-2">
                  <div
                    className={`h-full bg-gradient-to-r ${card.color} transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2">{summary}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
