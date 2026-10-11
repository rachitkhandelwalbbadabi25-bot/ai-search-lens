import { PageStructureData, PageType } from '@/types/audit';

/**
 * Page context layer.
 *
 * Every rule in the auditor should first ask "what kind of page is this?" before
 * deciding whether a detected signal is actually a problem. This module infers:
 *  - page type (homepage, article, product, login, dashboard, app, ...)
 *  - brand / entity name
 *  - page-type-appropriate schema.org recommendations
 */

const MULTI_PART_TLDS = /\.(co|com|org|net|gov|ac|edu)\.[a-z]{2}$/i;

/** Returns the registrable label of a hostname, e.g. developer.mozilla.org -> "mozilla". */
export function getHostRoot(hostname: string): string {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  const labels = host.split('.');
  if (labels.length <= 1) return host;
  if (MULTI_PART_TLDS.test(host) && labels.length >= 3) return labels[labels.length - 3];
  return labels[labels.length - 2];
}

const normalizeToken = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Splits a title into segments on common brand separators. */
export function splitTitleSegments(title: string): string[] {
  return title
    .split(/\s+[|\u2013\u2014\u00b7\u2022\-:]\s+|\s*[|\u00b7\u2022]\s*|:\s+|,\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Detects the brand/entity name from (in priority order):
 * og:site_name, Organization/WebSite JSON-LD name, title segment matching the hostname,
 * then the capitalized hostname root.
 */
export function detectBrand(data: Pick<PageStructureData, 'title' | 'ogSiteName' | 'schemaOrgName' | 'url' | 'headings'>): {
  brand: string;
  source: 'og:site_name' | 'schema' | 'title' | 'hostname';
} {
  let hostname = '';
  try { hostname = new URL(data.url).hostname; } catch { hostname = data.url; }
  const hostRoot = getHostRoot(hostname);

  const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
  if (data.ogSiteName && clean(data.ogSiteName).length >= 2 && clean(data.ogSiteName).length <= 40) {
    return { brand: clean(data.ogSiteName), source: 'og:site_name' };
  }
  if (data.schemaOrgName && clean(data.schemaOrgName).length >= 2 && clean(data.schemaOrgName).length <= 40) {
    return { brand: clean(data.schemaOrgName), source: 'schema' };
  }
  if (data.title) {
    const segments = splitTitleSegments(data.title);
    // Prefer a segment whose normalized form matches the hostname root
    const match = segments.find(seg => {
      const n = normalizeToken(seg);
      return n.length >= 2 && (n === hostRoot || (hostRoot.length >= 4 && n.includes(hostRoot) && seg.split(/\s+/).length <= 4) || (n.length >= 4 && hostRoot.includes(n)));
    });
    if (match) return { brand: match, source: 'title' };
    // Try to find the brand as a word sequence inside the title (e.g. "... by Notion")
    const words = data.title.split(/\s+/);
    for (let len = 3; len >= 1; len--) {
      for (let i = 0; i + len <= words.length; i++) {
        const phrase = words.slice(i, i + len).join(' ').replace(/[^\w\s.&'-]/g, '').trim();
        if (phrase && normalizeToken(phrase) === hostRoot) return { brand: phrase, source: 'title' };
      }
    }
  }
  const fallback = hostRoot.charAt(0).toUpperCase() + hostRoot.slice(1);
  return { brand: fallback, source: 'hostname' };
}

const LOCALE_CODES = new Set([
  'en', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'sv', 'no', 'da', 'fi', 'pl', 'ru', 'ja', 'zh', 'ko', 'hi', 'ar', 'tr',
  'he', 'vi', 'th', 'cs', 'el', 'hu', 'ro', 'us', 'uk', 'gb', 'in', 'au', 'ca', 'br', 'mx', 'jp', 'cn', 'kr', 'sg',
  'ae', 'nz', 'ie', 'za', 'at', 'ch', 'be', 'se', 'dk', 'hk', 'tw', 'my', 'ph', 'eu', 'latam',
]);

export function isLocaleSegment(seg: string): boolean {
  const s = seg.toLowerCase();
  if (/^[a-z]{2}[-_][a-z]{2,4}$/.test(s)) return true; // en-us, pt_br, zh-hant
  return LOCALE_CODES.has(s);
}

/** True when a path is the site root or a bare locale root like /in or /en-us. */
export function isRootOrLocaleRoot(pathname: string): boolean {
  const segs = pathname.split('/').filter(Boolean);
  if (segs.length === 0) return true;
  return segs.length === 1 && isLocaleSegment(segs[0]);
}

/**
 * Infers the page type from URL path, structured data, OpenGraph, form/interaction
 * signals and content shape. The first matching strong signal wins; weak signals
 * fall through to 'other'.
 */
export function inferPageType(data: PageStructureData): PageType {
  let pathname = '/';
  try { pathname = new URL(data.finalUrl || data.url).pathname.toLowerCase(); } catch { /* ignore */ }
  const path = pathname;
  const types = (data.structuredDataTypes || []).map(t => t.toLowerCase());
  const ogType = (data.ogType || '').toLowerCase();
  const title = (data.title || '').toLowerCase();
  const words = data.wordCount || 0;
  const interactive = data.interactiveElementCount || 0;

  // 1. Authentication / account utility pages
  if (/(^|\/)(login|log-in|signin|sign-in|signup|sign-up|register|auth|sso|forgot-password|reset-password)(\/|$)/.test(path) ||
      (data.hasPasswordInput && words < 250) ||
      /^(log in|sign in|sign up|login|create (an )?account)\b/.test(title)) {
    return 'login';
  }
  // 2. Dashboards / account areas
  if (/(^|\/)(dashboard|account|settings|admin|console|workspace|inbox|my)(\/|$)/.test(path)) {
    return 'dashboard';
  }
  // 3. Explicit structured data / OpenGraph type
  if (types.some(t => /^(article|newsarticle|blogposting|techarticle|scholarlyarticle|report)$/.test(t)) || ogType === 'article') return 'article';
  if (types.includes('jobposting')) return 'job';
  if (types.includes('product') && !isRootOrLocaleRoot(path)) return 'product';
  if (types.includes('profilepage') || ogType === 'profile') return 'profile';

  // 4. Homepage (site root or bare locale root)
  if (isRootOrLocaleRoot(path)) return 'homepage';

  // 5. Path conventions
  if (/(^|\/)(pricing|plans|price)(\/|$)/.test(path)) return 'pricing';
  if (/(^|\/)(jobs?|careers?|positions|openings)\/[^/]+/.test(path)) return 'job';
  if (/(^|\/)(docs?|documentation|reference|guide|guides|manual|api|learn|wiki|kb|knowledge-base|tutorials?)(\/|$)/.test(path) ||
      types.includes('techarticle') || types.includes('faqpage')) return 'documentation';
  if (/(^|\/)(blog|news|articles?|posts?|stories|insights|press|magazine)\/[^/]+/.test(path) || /\/\d{4}\/\d{2}\//.test(path)) return 'article';
  if (/(^|\/)(products?|item|p|shop|store)\/[^/]+/.test(path)) return 'product';
  if (/(^|\/)(u|user|users|people|profile|profiles|team\/[^/]+|@[^/]+)(\/|$)/.test(path) || /\/@[^/]+/.test(path)) return 'profile';
  if (/(^|\/)(category|categories|collections?|tags?|topics?)(\/|$)/.test(path)) return 'category';
  if (/(^|\/)(app|play|arena|editor|studio|playground|tool|tools|game|games|chat)(\/|$)/.test(path) && words < 400) return 'app';

  // 6. Content-shape fallbacks: interactive application surface with little prose
  if (interactive >= 6 && words < 200 && (data.paragraphCount || 0) <= 3) return 'app';
  if ((data.paragraphCount || 0) >= 6 && words >= 600 && (data.hasDateSignal || data.hasAuthorSignal)) return 'article';

  return 'other';
}

export const PAGE_TYPE_LABEL: Record<PageType, string> = {
  homepage: 'homepage',
  article: 'article / editorial page',
  documentation: 'documentation / reference page',
  product: 'product page',
  pricing: 'pricing page',
  job: 'job posting',
  profile: 'profile page',
  login: 'login / authentication page',
  dashboard: 'dashboard / account page',
  app: 'interactive application page',
  category: 'category / listing page',
  other: 'general content page',
};

/** Page types where low word count is expected and not a content-quality signal. */
export const UTILITY_PAGE_TYPES: PageType[] = ['login', 'dashboard', 'app'];

/**
 * Page-type-aware schema.org recommendations. Returns the set of types that would be
 * relevant for this page, and which of those were already detected.
 */
export function recommendSchemaTypes(pageType: PageType, detected: string[]): {
  recommended: string[];
  missing: string[];
  rationale: string;
} {
  const has = (t: string) => detected.some(d => d.toLowerCase() === t.toLowerCase());
  let recommended: string[] = [];
  let rationale = '';
  switch (pageType) {
    case 'homepage':
      recommended = ['Organization', 'WebSite'];
      rationale = 'Homepages typically identify the organization and the site itself.';
      break;
    case 'article':
      recommended = ['Article', 'BreadcrumbList'];
      rationale = 'Editorial pages can declare article metadata (headline, author, dates) and their position in the site.';
      break;
    case 'documentation':
      recommended = ['TechArticle', 'BreadcrumbList'];
      rationale = 'Reference pages can declare document metadata and their position in the documentation hierarchy.';
      break;
    case 'product':
      recommended = ['Product', 'BreadcrumbList'];
      rationale = 'Product pages can declare product name, offers and reviews where those are visible on the page.';
      break;
    case 'job':
      recommended = ['JobPosting', 'BreadcrumbList'];
      rationale = 'Job pages can be eligible for job search experiences when they declare JobPosting data.';
      break;
    case 'profile':
      recommended = ['ProfilePage'];
      rationale = 'Profile pages can declare the person or organization the page is about.';
      break;
    case 'category':
      recommended = ['CollectionPage', 'BreadcrumbList'];
      rationale = 'Listing pages can declare their collection and hierarchy.';
      break;
    case 'login':
    case 'dashboard':
    case 'app':
      recommended = [];
      rationale = 'Application and account pages generally do not benefit from page-level schema.';
      break;
    default:
      recommended = ['WebPage', 'BreadcrumbList'];
      rationale = 'General pages can declare basic WebPage and breadcrumb context.';
  }

  // Organization-like types satisfy "Organization"
  const orgLike = /^(organization|corporation|localbusiness|educationalorganization|ngo|onlinestore|onlinebusiness)$/i;
  const articleLike = /^(article|newsarticle|blogposting|techarticle|scholarlyarticle|report)$/i;
  const profileLike = /^(profilepage|person)$/i;

  const missing = recommended.filter(t => {
    if (t === 'Organization') return !detected.some(d => orgLike.test(d));
    if (t === 'Article' || t === 'TechArticle') return !detected.some(d => articleLike.test(d));
    if (t === 'ProfilePage' || t === 'Person') return !detected.some(d => profileLike.test(d));
    if (t === 'WebPage') return !detected.some(d => /page$/i.test(d));
    return !has(t);
  });

  return { recommended, missing, rationale };
}

/** Very small stop-word list used for topic term extraction. */
export const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'to', 'of', 'in', 'on', 'with', 'by', 'at', 'from', 'is', 'are', 'be',
  'your', 'you', 'our', 'we', 'us', 'it', 'its', 'this', 'that', 'as', 'all', 'one', 'new', 'get', 'more',
  'home', 'page', 'welcome', 'official', 'site', 'website', 'how', 'what', 'why', 'best', 'free',
]);

export function topicTerms(text: string, exclude: string[] = []): string[] {
  const ex = new Set(exclude.flatMap(e => e.toLowerCase().split(/\s+/)));
  return Array.from(new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !STOP_WORDS.has(w) && !ex.has(w))
  ));
}
