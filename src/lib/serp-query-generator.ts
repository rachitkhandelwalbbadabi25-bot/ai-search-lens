import { GeneratedQuery, PageStructureData, PageType } from '@/types/audit';
import { detectBrand, splitTitleSegments } from './page-context';

/**
 * SERP query-generation layer.
 *
 * Strategy (max 3 queries, deduplicated):
 *   1. Brand / entity query            e.g. "GitHub"
 *   2. Brand + inferred category       e.g. "GitHub developer platform"
 *   3. Primary page intent             e.g. "Search engine optimization" (Wikipedia article)
 *      or the user-supplied query when provided.
 *
 * Marketing slogans and arbitrary sentences are never used as queries.
 */

/** Detects slogan-like / sentence-like text that is not a realistic search query. */
export function isSloganLike(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  const words = t.split(/\s+/);
  if (words.length > 8) return true;
  // Sentence punctuation inside or at the end ("Change is constant. GitHub keeps you ahead.")
  if (/[.!?]\s+\S/.test(t) || /[.!?]$/.test(t)) return true;
  // Second-person / first-person marketing voice
  if (/\b(you|your|you're|we|our|us|we're|let's)\b/i.test(t)) return true;
  // Imperative marketing openers
  if (/^(build|ship|create|start|get|discover|meet|make|join|try|unlock|transform|grow|power|bring|turn|say)\b/i.test(t)) return true;
  // Fragment that ends on a function word ("The All", "Built for")
  if (/\b(the|a|an|and|or|for|to|of|with|that|all|in|on)$/i.test(t)) return true;
  // Too short to carry topical meaning (after removing leading articles)
  const content = t.replace(/^(the|a|an)\s+/i, '');
  if (content.replace(/[^a-z0-9]/gi, '').length < 3) return true;
  return false;
}

interface CategoryRule {
  category: string;
  pattern: RegExp;
  /** Optional refinement when another pattern also matches. */
  refine?: { pattern: RegExp; category: string };
}

// Ordered by specificity. Scores are accumulated across fields, highest wins.
const CATEGORY_RULES: CategoryRule[] = [
  { category: 'ecommerce platform', pattern: /\b(e-?commerce|online store|sell online|commerce platform|storefront|point of sale)\b/g },
  { category: 'developer platform', pattern: /\b(developer platform|developers?|repositor(y|ies)|source code|pull requests?|open source projects?|devops|ci\/cd)\b/g },
  { category: 'documentation', pattern: /\b(documentation|docs|reference|tutorials?|guides?|api reference)\b/g,
    refine: { pattern: /\b(html|css|javascript|web (technologies|development|platform|apis?)|open web)\b/, category: 'web development documentation' } },
  { category: 'encyclopedia', pattern: /\b(encyclopedia|encyclopaedia)\b/g },
  { category: 'startup accelerator', pattern: /\b(accelerator|startups?|seed funding|early[- ]stage|founders?)\b/g },
  { category: 'productivity workspace', pattern: /\b(workspace|note[- ]taking|notes|wikis?|project management|productivity|docs and projects)\b/g },
  { category: 'hiring platform', pattern: /\b(hiring|recruit(ing|ment|ers?)?|interviews?|candidates?|applicant tracking|talent|job seekers?)\b/g },
  { category: 'website and blog platform', pattern: /\b(blog(ging)?|publishing platform|website builder|cms|content management|create (a )?website)\b/g },
  { category: 'payments platform', pattern: /\b(payments?|payment processing|billing|invoic(e|ing)|checkout)\b/g },
  { category: 'learning platform', pattern: /\b(courses?|learn(ing)?|students?|education(al)?|lessons?|bootcamp)\b/g },
  { category: 'competition platform', pattern: /\b(arena|leaderboards?|compete|competitions?|challenges?|tournaments?|hackathons?)\b/g },
  { category: 'game', pattern: /\b(games?|gaming|play now|multiplayer)\b/g },
  { category: 'news', pattern: /\b(news|breaking|headlines|journalism)\b/g },
  { category: 'design tool', pattern: /\b(design tool|prototyp(e|ing)|ui design|whiteboard)\b/g },
  { category: 'analytics platform', pattern: /\b(analytics|dashboards?|metrics|insights platform)\b/g },
  { category: 'AI platform', pattern: /\b(ai[- ]powered|artificial intelligence|llms?|ai agents?|machine learning)\b/g },
];

/**
 * Infers a short category phrase for the brand from weighted page fields.
 * Returns null when no category has meaningful support (better no query than a bad one).
 */
export function inferCategory(fields: { title?: string | null; meta?: string | null; h1?: string | null; og?: string | null; intro?: string | null }): string | null {
  const weighted: [string, number][] = [
    [fields.title || '', 3],
    [fields.meta || '', 2],
    [fields.og || '', 2],
    [fields.h1 || '', 2],
    [fields.intro || '', 1],
  ];
  const all = weighted.map(([t]) => t).join(' ').toLowerCase();
  let best: { category: string; score: number } | null = null;
  for (const rule of CATEGORY_RULES) {
    let score = 0;
    for (const [text, weight] of weighted) {
      const m = text.toLowerCase().match(rule.pattern);
      if (m) score += m.length * weight;
    }
    if (score > 0 && (!best || score > best.score)) {
      let category = rule.category;
      if (rule.refine && rule.refine.pattern.test(all)) category = rule.refine.category;
      best = { category, score };
    }
  }
  // Require at least moderate support (e.g. one title hit, or meta + intro)
  if (!best || best.score < 2) return null;
  return best.category;
}

export function cleanQuery(q: string): string {
  return q
    .replace(/\+/g, ' ')
    .replace(/[^\p{L}\p{N}\s.'&-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.'&-]+|[\s.'&-]+$/g, '')
    .trim();
}

/** Converts a URL slug to words: /wiki/Search_engine_optimization -> "Search engine optimization". */
export function slugToWords(pathname: string): string | null {
  const segs = pathname.split('/').filter(Boolean);
  if (segs.length === 0) return null;
  let last = decodeURIComponent(segs[segs.length - 1]).replace(/\.(html?|php|aspx?)$/i, '');
  if (/^\d+$/.test(last) || /^[a-f0-9-]{16,}$/i.test(last)) return null; // ids / hashes
  last = last.replace(/[-_+]+/g, ' ').trim();
  if (last.length < 3) return null;
  return last;
}

/**
 * Picks a descriptive (non-slogan) topic phrase from title / H1 / OG title, excluding the brand.
 */
export function extractTopicPhrase(candidates: (string | null | undefined)[], brand: string): string | null {
  const brandNorm = brand.toLowerCase();
  for (const cand of candidates) {
    if (!cand) continue;
    const segments = splitTitleSegments(cand);
    for (const seg of segments) {
      let s = seg.trim();
      if (!s || s.toLowerCase() === brandNorm) continue;
      // Strip brand mentions and leading articles
      s = s.replace(new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'ig'), '').trim();
      s = s.replace(/^(the|a|an)\s+/i, '').trim();
      if (!s || isSloganLike(s)) continue;
      if (s.split(/\s+/).length < 1 || s.length < 4) continue;
      return s;
    }
  }
  return null;
}

/**
 * Generates up to three SERP queries for visibility measurement.
 */
export function generateSerpQueries(
  data: PageStructureData,
  pageType: PageType,
  userQuery?: string
): GeneratedQuery[] {
  const { brand, source: brandSource } = detectBrand(data);
  const h1 = data.headings.find(h => h.level === 'h1')?.text || null;
  let pathname = '/';
  try { pathname = new URL(data.finalUrl || data.url).pathname; } catch { /* ignore */ }

  const queries: GeneratedQuery[] = [];
  const push = (q: GeneratedQuery) => {
    const cleaned = cleanQuery(q.query);
    if (!cleaned) return;
    if (queries.some(e => e.query.toLowerCase() === cleaned.toLowerCase())) return;
    queries.push({ ...q, query: cleaned });
  };

  // 1. Brand / entity query (always first, never a slogan)
  push({ query: brand, kind: 'brand', source: `Brand/entity detected from ${brandSource}` });

  // 2. Brand + inferred category
  const category = inferCategory({
    title: data.title,
    meta: data.metaDescription,
    h1,
    og: data.ogDescription,
    intro: data.introText || data.firstParagraphText,
  });
  if (category && !brand.toLowerCase().includes(category.toLowerCase())) {
    // Avoid repeating words already in the brand ("MDN Web Docs" + "web development documentation" is fine)
    push({ query: `${brand} ${category}`, kind: 'brand_category', source: `Category "${category}" inferred from title/meta/H1/intro` });
  }

  // 3. Primary page intent (user query takes precedence)
  if (userQuery && userQuery.trim()) {
    push({ query: userQuery, kind: 'user', source: 'User-supplied query' });
  } else {
    const isRootLike = pageType === 'homepage';
    const topic = extractTopicPhrase([data.title, h1, data.ogTitle], brand);
    const slug = isRootLike ? null : slugToWords(pathname);

    if (pageType === 'article' || pageType === 'documentation') {
      // Informational pages: users search the topic itself
      const t = topic || slug;
      if (t) push({ query: t, kind: 'intent', source: topic ? 'Descriptive topic from title/H1' : 'URL path slug' });
    } else if (!isRootLike) {
      // Commercial / utility sub-pages: brand + page topic (e.g. "AI HireFlow pricing")
      const t = slug && !isSloganLike(slug) ? slug : topic;
      if (t) push({ query: `${brand} ${t}`, kind: 'intent', source: slug ? 'Brand + URL path topic' : 'Brand + descriptive topic from title/H1' });
    } else if (topic && topic.split(/\s+/).length >= 2) {
      // Homepage: only use a descriptive, non-slogan title phrase
      push({ query: topic, kind: 'intent', source: 'Descriptive (non-slogan) homepage title phrase' });
    }
  }

  return queries.slice(0, 3);
}
