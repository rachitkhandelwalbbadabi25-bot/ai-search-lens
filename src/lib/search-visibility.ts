import {
  CompetitorSnippet,
  ConfidenceLevel,
  GeneratedQuery,
  QueryVisibilityResult,
  SearchVisibilityData,
  SerpQueryKind,
  VisibilityTier,
} from '@/types/audit';

/**
 * Search visibility model (non-binary).
 *
 *   Position 1–3   -> Excellent  (1.00)
 *   Position 4–10  -> Strong     (0.85)
 *   Position 11–20 -> Moderate   (0.60)
 *   Position 21–50 -> Limited    (0.35)
 *   Position 51+   -> Weak       (0.15)
 *   Not in returned results -> Not observed (0.00)
 *   SERP unavailable        -> Unknown (excluded from scoring)
 *
 * Queries are weighted: brand 0.5, brand+category 0.25, intent/user 0.25, renormalized
 * across queries that actually returned usable SERP data.
 */

export const MIN_RESULTS_FOR_EVIDENCE = 3;

export function tierForPosition(pos: number | null): VisibilityTier {
  if (pos === null) return 'Not observed';
  if (pos <= 3) return 'Excellent';
  if (pos <= 10) return 'Strong';
  if (pos <= 20) return 'Moderate';
  if (pos <= 50) return 'Limited';
  return 'Weak';
}

const TIER_VALUE: Record<VisibilityTier, number> = {
  Excellent: 1.0,
  Strong: 0.85,
  Moderate: 0.6,
  Limited: 0.35,
  Weak: 0.15,
  'Not observed': 0,
  Unknown: 0,
};

const KIND_WEIGHT: Record<SerpQueryKind, number> = {
  brand: 0.5,
  brand_category: 0.25,
  intent: 0.25,
  user: 0.25,
};

const normalizeUrlForMatch = (u: string) => u.toLowerCase().replace(/[?#].*$/, '').replace(/\/$/, '').replace(/^https?:\/\/(www\.)?/, '');

/**
 * Builds a per-query visibility result from raw SERP items.
 */
export function buildQueryResult(
  q: GeneratedQuery,
  rawResults: { title?: string; url?: string; link?: string; snippet?: string; description?: string; position?: number }[] | null,
  targetUrl: string,
  provider: 'tinyfish' | 'bing' | 'none',
  isRootTarget: boolean
): QueryVisibilityResult {
  if (!rawResults || rawResults.length < MIN_RESULTS_FOR_EVIDENCE) {
    return {
      query: q.query, kind: q.kind, ok: false, resultsCount: rawResults?.length || 0,
      exactPosition: null, domainPosition: null, relevantPosition: null, tier: 'Unknown', provider, topResults: [],
    };
  }

  let targetHost = '';
  try { targetHost = new URL(targetUrl).hostname.toLowerCase().replace(/^www\./, ''); } catch { /* ignore */ }
  const normTarget = normalizeUrlForMatch(targetUrl);

  let exactPosition: number | null = null;
  let domainPosition: number | null = null;
  const topResults: CompetitorSnippet[] = [];

  rawResults.forEach((item, index) => {
    const pos = item.position || index + 1;
    const rawItemUrl = item.url || item.link || '';
    if (!rawItemUrl) return;
    let itemHost = '';
    try { itemHost = new URL(rawItemUrl).hostname.toLowerCase().replace(/^www\./, ''); } catch { itemHost = rawItemUrl.toLowerCase(); }
    const isExact = normalizeUrlForMatch(rawItemUrl) === normTarget;
    const isDomain = !!targetHost && (itemHost === targetHost || itemHost.endsWith(`.${targetHost}`) || targetHost.endsWith(`.${itemHost}`));
    if (isExact && exactPosition === null) exactPosition = pos;
    if (isDomain && domainPosition === null) domainPosition = pos;
    if (topResults.length < 5) {
      topResults.push({
        title: item.title || 'Search Result',
        url: rawItemUrl,
        snippet: item.snippet || item.description || '',
        isTargetDomain: isDomain,
        isExactTargetUrl: isExact,
        position: pos,
      });
    }
  });

  // Brand queries are satisfied by any page of the domain (usually the homepage).
  // Intent queries need the exact page; domain presence earns partial credit (handled in scoring).
  let relevantPosition: number | null;
  if (q.kind === 'brand' || q.kind === 'brand_category') relevantPosition = domainPosition;
  else relevantPosition = exactPosition ?? (isRootTarget ? domainPosition : null);

  return {
    query: q.query, kind: q.kind, ok: true, resultsCount: rawResults.length,
    exactPosition, domainPosition, relevantPosition,
    tier: tierForPosition(relevantPosition), provider, topResults,
  };
}

function queryValue(r: QueryVisibilityResult): number {
  const base = TIER_VALUE[r.tier];
  if ((r.kind === 'intent' || r.kind === 'user') && r.relevantPosition === null && r.domainPosition !== null) {
    // Exact page absent but the domain ranks: partial credit
    return TIER_VALUE[tierForPosition(r.domainPosition)] * 0.5;
  }
  return base;
}

export function tierForScore(score: number): VisibilityTier {
  if (score >= 0.9) return 'Excellent';
  if (score >= 0.7) return 'Strong';
  if (score >= 0.5) return 'Moderate';
  if (score >= 0.3) return 'Limited';
  if (score > 0) return 'Weak';
  return 'Not observed';
}

/**
 * Aggregates query results into SearchVisibilityData. Evidence is "sufficient" only when
 * the brand query succeeded, or at least two queries succeeded. Otherwise visibility is
 * Unknown and must not be penalized.
 */
export function assessVisibility(results: QueryVisibilityResult[]): SearchVisibilityData {
  const ok = results.filter(r => r.ok);
  const brandOk = ok.some(r => r.kind === 'brand');
  const evidenceSufficient = brandOk || ok.length >= 2;

  const primary = results.find(r => r.kind === 'user') || results.find(r => r.kind === 'intent') || results.find(r => r.kind === 'brand_category') || results[0];
  const queryUsed = primary?.query || '';
  const anyExact = ok.find(r => r.exactPosition !== null);
  const anyDomain = ok.find(r => r.domainPosition !== null);
  const bestForDisplay = anyExact || anyDomain || ok[0];
  const topHit = bestForDisplay?.topResults.find(t => t.isExactTargetUrl) || bestForDisplay?.topResults.find(t => t.isTargetDomain) || null;

  const base: SearchVisibilityData = {
    queryUsed,
    isInferredQuery: !results.some(r => r.kind === 'user'),
    targetPresentInSerp: !!anyExact,
    targetDomainPresentInSerp: !!anyDomain,
    targetRankPosition: anyExact?.exactPosition ?? anyDomain?.domainPosition ?? null,
    targetSerpTitle: topHit?.title || null,
    targetSerpSnippet: topHit?.snippet || null,
    topCompetitors: (primary && primary.ok ? primary : bestForDisplay)?.topResults || [],
    searchIntent: /pricing|plans|buy|price/i.test(queryUsed) ? 'Transactional / Commercial' : 'Informational',
    queryPageAlignmentScore: anyExact ? 95 : anyDomain ? 70 : 40,
    queries: results,
  };

  if (!evidenceSufficient) {
    return {
      ...base,
      searchStatus: 'UNVERIFIED',
      isSearchUnverified: true,
      evidenceSufficient: false,
      visibilityTier: 'Unknown',
      visibilityScore: undefined,
      visibilityConfidence: 'LOW',
      searchErrorMessage: 'Search visibility could not be confidently determined from the available SERP evidence. Technical, AI-readability and content checks are still available.',
      searchedAt: new Date().toISOString(),
      provider: results[0]?.provider || 'none',
    };
  }

  let wSum = 0;
  let vSum = 0;
  for (const r of ok) {
    const w = KIND_WEIGHT[r.kind];
    wSum += w;
    vSum += w * queryValue(r);
  }
  const visibilityScore = wSum > 0 ? vSum / wSum : 0;
  const viaTinyFish = ok.every(r => r.provider === 'tinyfish');
  const visibilityConfidence: ConfidenceLevel =
    ok.length >= 3 && viaTinyFish ? 'HIGH' : ok.length >= 2 ? 'MEDIUM' : 'LOW';
  const tier = tierForScore(visibilityScore);
  const searchStatus = (tier === 'Not observed' && !anyExact && !anyDomain) ? 'NOT_FOUND' : 'FOUND';
  const primaryProvider = ok.find(r => r.provider !== 'none')?.provider || 'none';

  return {
    ...base,
    searchStatus,
    isSearchUnverified: false,
    evidenceSufficient: true,
    visibilityTier: tier,
    visibilityScore,
    visibilityConfidence,
    searchedAt: new Date().toISOString(),
    provider: primaryProvider,
  };
}
