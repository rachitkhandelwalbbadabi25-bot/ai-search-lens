import { AuditFinding, CategoryScore, FinalAuditReport, SearchVisibilityData } from '@/types/audit';
import { makeFinding } from './finding-utils';

export interface ScoringEngineResult {
  overallScore: number;
  categories: FinalAuditReport['categories'];
  allFindings: AuditFinding[];
}

const CATEGORY_BUDGETS = {
  technical_seo: 25,
  search_visibility: 25,
  ai_readability: 25,
  content_intent: 15,
  citation_readiness: 10,
} as const;

/**
 * Normalizes finding deductions within a category so that the sum of applied
 * deduction points never exceeds the category's maximum budget.
 */
function normalizeCategoryFindings(findings: AuditFinding[], budget: number): {
  score: number;
  normalizedFindings: AuditFinding[];
} {
  const totalRaw = findings.reduce((sum, f) => sum + f.deductionPoints, 0);
  if (totalRaw <= budget) {
    return {
      score: budget - totalRaw,
      normalizedFindings: findings.map(f => ({ ...f, rawDeductionPoints: f.rawDeductionPoints ?? f.deductionPoints })),
    };
  }

  // Raw deductions exceed category budget -> category score drops to 0.
  // Scale finding deductions proportionally so their sum equals budget exactly.
  const factor = budget / totalRaw;
  let allocated = 0;

  const normalizedFindings = findings.map((f, idx) => {
    const raw = f.deductionPoints;
    let applied = Math.floor(raw * factor);
    if (idx === findings.length - 1) {
      applied = budget - allocated; // absorb rounding remainder on last item
    }
    allocated += applied;
    return {
      ...f,
      rawDeductionPoints: f.rawDeductionPoints ?? raw,
      deductionPoints: applied,
    };
  });

  return {
    score: 0,
    normalizedFindings,
  };
}

/**
 * Calculates 0-100 overall score and category scores with guaranteed mathematical consistency:
 *
 *   overallScore === sum(category scores) === 100 - sum(finding deductions)
 */
export function calculateAuditScores(
  technicalFindings: AuditFinding[],
  aiReadabilityFindings: AuditFinding[],
  contentIntentFindings: AuditFinding[],
  citationReadinessFindings: AuditFinding[],
  searchData: SearchVisibilityData
): ScoringEngineResult {
  // 1. Search Visibility Findings & Score
  const searchFindings: AuditFinding[] = [];
  let searchScoreNum = 25;

  const isUnverified = Boolean(searchData.isSearchUnverified || searchData.searchStatus === 'UNVERIFIED');
  if (isUnverified) {
    searchScoreNum = 25;
    searchFindings.push(makeFinding({
      id: 'search-unverified',
      category: 'search_visibility',
      severity: 'INFO',
      title: 'Search Visibility Unverified (No Score Penalty)',
      evidence: {
        source: 'search',
        location: `SERP investigation`,
        observed: searchData.searchErrorMessage || 'Insufficient SERP evidence retrieved.',
        expected: 'Confidently verified search engine ranking position.',
      },
      context: 'Search visibility was not penalized because reliable SERP evidence could not be established.',
      whyItMatters: 'Disclosing unverified search status ensures overall score remains objective and evidence-based.',
      recommendedFix: 'No action required on page code. Search visibility can be re-tested when SERP data is reachable.',
      expectedImpact: 'Informational \u2014 zero deduction applied.',
      confidence: 0.5,
      deductionPoints: 0,
    }));
  } else {
    // Verified search visibility calculation
    const tier = searchData.visibilityTier || (searchData.targetPresentInSerp ? 'Strong' : searchData.targetDomainPresentInSerp ? 'Limited' : 'Weak');

    if (tier === 'Excellent' || (typeof searchData.targetRankPosition === 'number' && searchData.targetRankPosition >= 1 && searchData.targetRankPosition <= 3)) {
      // Excellent tier receives full budget (25/25) with ZERO penalty
      searchScoreNum = 25;
      searchFindings.push(makeFinding({
        id: 'search-visibility-excellent',
        category: 'search_visibility',
        severity: 'INFO',
        title: 'Search Visibility: Excellent (Position Top 3)',
        evidence: {
          source: 'search',
          location: 'SERP queries evaluated',
          observed: searchData.targetRankPosition
            ? `Page ranked at top position #${searchData.targetRankPosition} for query "${searchData.queryUsed}".`
            : 'Page achieved top 3 ranking in evaluated search results.',
          expected: 'Top search result position (1\u20133).',
        },
        context: 'Excellent search presence confirmed. Zero score deduction applied.',
        whyItMatters: 'Top 3 ranking maximizes organic search click-through rate.',
        recommendedFix: 'Maintain current content quality and link authority.',
        expectedImpact: 'High organic search referral traffic.',
        confidence: 0.95,
        deductionPoints: 0,
      }));
    } else if (tier === 'Not observed') {
      // Not observed in checked window: LOW severity non-destructive deduction (8 points)
      searchScoreNum = 17;
      const searchDeduction = 8;
      searchFindings.push(makeFinding({
        id: 'search-visibility-not-observed',
        category: 'search_visibility',
        severity: 'LOW',
        title: 'Search Visibility: Not Observed in Checked Result Window',
        evidence: {
          source: 'search',
          location: 'SERP queries evaluated',
          observed: 'The exact page was not observed within the checked search result window.',
          expected: 'Page appearing in top search result positions for target intent queries.',
        },
        context: 'Not being observed in the checked search window does not mean the page lacks indexing; it indicates an opportunity to strengthen search relevance.',
        whyItMatters: 'Top search positioning improves discoverability for relevant query terms.',
        recommendedFix: 'Optimize page title keywords, H1 headings, and internal links pointing to this page.',
        expectedImpact: 'Improves SERP discoverability over time.',
        confidence: 0.75,
        deductionPoints: searchDeduction,
      }));
    } else {
      // Tier is Strong, Moderate, Limited, or Weak
      const tierDeductions: Record<import('@/types/audit').VisibilityTier, number> = {
        Excellent: 0,
        Strong: 3,
        Moderate: 7,
        Limited: 11,
        Weak: 15,
        'Not observed': 8,
        Unknown: 0,
      };
      const searchDeduction = tierDeductions[tier] ?? 7;
      searchScoreNum = 25 - searchDeduction;

      searchFindings.push(makeFinding({
        id: 'search-visibility-tier',
        category: 'search_visibility',
        severity: searchScoreNum >= 20 ? 'LOW' : searchScoreNum >= 14 ? 'MEDIUM' : 'HIGH',
        title: `Search Visibility Tier: ${tier}`,
        evidence: {
          source: 'search',
          location: 'SERP queries evaluated',
          observed: searchData.targetRankPosition
            ? `Page ranked at position #${searchData.targetRankPosition} for query "${searchData.queryUsed}".`
            : `Page observed with ${tier.toLowerCase()} positioning for evaluated search queries.`,
          expected: 'Page appearing in top search result positions (1\u20133) for target intent queries.',
        },
        context: `Evaluated visibility tier: ${tier}.`,
        whyItMatters: 'Higher search ranking directly increases discoverability and referral traffic to the page.',
        recommendedFix: 'Improve page topic alignment, title tag keywords, and internal link authority pointing to this page.',
        expectedImpact: 'Higher search engine positioning and referral traffic.',
        confidence: 0.85,
        deductionPoints: searchDeduction,
      }));
    }
  }

  // 2. Normalize every category to guarantee mathematical reconciliation
  const techNorm = normalizeCategoryFindings(technicalFindings, CATEGORY_BUDGETS.technical_seo);
  const searchNorm = normalizeCategoryFindings(searchFindings, CATEGORY_BUDGETS.search_visibility);
  const aiNorm = normalizeCategoryFindings(aiReadabilityFindings, CATEGORY_BUDGETS.ai_readability);
  const contentNorm = normalizeCategoryFindings(contentIntentFindings, CATEGORY_BUDGETS.content_intent);
  const citationNorm = normalizeCategoryFindings(citationReadinessFindings, CATEGORY_BUDGETS.citation_readiness);

  const technicalSeo: CategoryScore = {
    score: techNorm.score,
    maxScore: CATEGORY_BUDGETS.technical_seo,
    status: techNorm.score >= 20 ? 'good' : techNorm.score >= 14 ? 'warning' : 'critical',
    summary: techNorm.score >= 20 ? 'Solid technical SEO foundation.' : 'Technical SEO opportunities detected.',
  };

  const searchVisibility: CategoryScore = {
    score: searchNorm.score,
    maxScore: CATEGORY_BUDGETS.search_visibility,
    status: isUnverified ? 'unverified' : searchNorm.score >= 20 ? 'good' : searchNorm.score >= 14 ? 'warning' : 'critical',
    summary: isUnverified
      ? 'Search visibility unverified (zero penalty applied).'
      : searchNorm.score >= 20
      ? 'Strong search presence across evaluated queries.'
      : 'Search discoverability optimization recommended.',
  };

  const aiReadability: CategoryScore = {
    score: aiNorm.score,
    maxScore: CATEGORY_BUDGETS.ai_readability,
    status: aiNorm.score >= 20 ? 'good' : aiNorm.score >= 14 ? 'warning' : 'critical',
    summary: aiNorm.score >= 20 ? 'Content structure is clear for AI models.' : 'Structural readability enhancements recommended.',
  };

  const contentIntent: CategoryScore = {
    score: contentNorm.score,
    maxScore: CATEGORY_BUDGETS.content_intent,
    status: contentNorm.score >= 12 ? 'good' : contentNorm.score >= 8 ? 'warning' : 'critical',
    summary: contentNorm.score >= 12 ? 'Content aligns with target intent.' : 'Content depth or intent alignment improvements recommended.',
  };

  const citationReadiness: CategoryScore = {
    score: citationNorm.score,
    maxScore: CATEGORY_BUDGETS.citation_readiness,
    status: citationNorm.score >= 8 ? 'good' : citationNorm.score >= 5 ? 'warning' : 'critical',
    summary: citationNorm.score >= 8 ? 'Strong machine-readable entity signals.' : 'Machine-readable entity signals can be enhanced.',
  };

  const overallScore = technicalSeo.score + searchVisibility.score + aiReadability.score + contentIntent.score + citationReadiness.score;

  const allFindings = [
    ...techNorm.normalizedFindings,
    ...searchNorm.normalizedFindings,
    ...aiNorm.normalizedFindings,
    ...contentNorm.normalizedFindings,
    ...citationNorm.normalizedFindings,
  ];

  return {
    overallScore,
    categories: {
      technicalSeo,
      searchVisibility,
      aiReadability,
      contentIntent,
      citationReadiness,
    },
    allFindings,
  };
}
