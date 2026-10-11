import { GeneratedQuery, QueryVisibilityResult, SearchVisibilityData } from '@/types/audit';
import * as cheerio from 'cheerio';
import { assessVisibility, buildQueryResult } from './search-visibility';

/**
 * Decodes base64 redirection URLs used by search engines like Bing.
 */
function decodeSerpUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  if (rawUrl.includes('uddg=')) {
    try {
      const u = new URL('https:' + (rawUrl.startsWith('//') ? rawUrl : '//' + rawUrl));
      const uddg = u.searchParams.get('uddg');
      if (uddg) return decodeURIComponent(uddg);
    } catch {
      // ignore
    }
  }
  if (rawUrl.includes('bing.com/ck/a')) {
    try {
      const u = new URL(rawUrl);
      const rawU = u.searchParams.get('u');
      if (rawU) {
        const b64 = rawU.startsWith('a1') ? rawU.slice(2) : rawU;
        const decoded = Buffer.from(b64, 'base64').toString('utf-8');
        if (decoded.startsWith('http')) return decoded;
      }
    } catch {
      // ignore
    }
  }
  return rawUrl;
}

type RawSerpItem = { title?: string; url?: string; link?: string; snippet?: string; description?: string; position?: number };

/** Queries the TinyFish Search API. Returns null on failure / empty results. */
async function searchViaTinyFish(query: string, apiKey: string): Promise<RawSerpItem[] | null> {
  try {
    const tinyfishUrl = `https://agent.tinyfish.ai/v1/search?query=${encodeURIComponent(query)}`;
    const response = await fetch(tinyfishUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });
    console.log(`[TinyFish Search] "${query}" -> ${response.status} ${response.statusText}`);
    if (!response.ok) return null;
    const data = await response.json();
    const results: RawSerpItem[] = data.results || data.organic_results || data.items || [];
    return Array.isArray(results) && results.length > 0 ? results : null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[TinyFish Search] API call failed for query "${query}": ${msg}`);
    return null;
  }
}

/** Live Bing SERP fallback. Returns null on failure / empty results. */
async function searchViaBing(query: string): Promise<RawSerpItem[] | null> {
  try {
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=20`;
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const html = await response.text();
    const $ = cheerio.load(html);
    const parsed: RawSerpItem[] = [];
    $('li.b_algo').each((_, elem) => {
      const title = $(elem).find('h2 a').text().replace(/\s+/g, ' ').trim();
      const rawUrl = $(elem).find('h2 a').attr('href') || '';
      const snippet = $(elem).find('div.b_caption p, p.b_lineclamp2').text().replace(/\s+/g, ' ').trim();
      const cleanUrl = decodeSerpUrl(rawUrl);
      if (title && cleanUrl && cleanUrl.startsWith('http')) parsed.push({ title, url: cleanUrl, snippet });
    });
    console.log(`[TinyFish Search Fallback] Bing "${query}" -> ${parsed.length} organic results`);
    return parsed.length > 0 ? parsed : null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[TinyFish Search Fallback] Bing fetch for "${query}" failed: ${msg}`);
    return null;
  }
}

async function runQuery(q: GeneratedQuery, targetUrl: string, isRootTarget: boolean, apiKey?: string): Promise<QueryVisibilityResult> {
  if (apiKey) {
    const results = await searchViaTinyFish(q.query, apiKey);
    if (results) return buildQueryResult(q, results, targetUrl, 'tinyfish', isRootTarget);
  }
  const fallback = await searchViaBing(q.query);
  if (fallback) return buildQueryResult(q, fallback, targetUrl, 'bing', isRootTarget);
  return buildQueryResult(q, null, targetUrl, 'none', isRootTarget);
}

/**
 * Investigates search visibility across multiple generated queries
 * (brand, brand + category, primary intent) using TinyFish Search with a live SERP fallback.
 * Queries run in parallel; results are aggregated by the tiered visibility model.
 */
export async function performTinyFishSearch(
  targetUrl: string,
  queries: GeneratedQuery[],
  isRootTarget: boolean = false
): Promise<SearchVisibilityData> {
  const startTime = Date.now();
  const apiKey = process.env.TINYFISH_API_KEY;
  console.log(`[TinyFish Search] ${apiKey ? 'API key detected' : 'TINYFISH_API_KEY missing — using SERP fallback'}; queries=${JSON.stringify(queries.map(q => `${q.kind}:${q.query}`))}`);

  if (queries.length === 0) {
    return assessVisibility([]);
  }

  const results = await Promise.all(queries.map(q => runQuery(q, targetUrl, isRootTarget, apiKey)));
  const assessed = assessVisibility(results);
  console.log(`[TinyFish Search] Visibility tier=${assessed.visibilityTier}, sufficient=${assessed.evidenceSufficient}, ` +
    `per-query=${JSON.stringify(results.map(r => ({ q: r.query, ok: r.ok, pos: r.relevantPosition, tier: r.tier, via: r.provider })))} (${Date.now() - startTime}ms)`);
  return assessed;
}
