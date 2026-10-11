import { AuditFinding, PageStructureData, PageType } from '@/types/audit';
import { makeFinding } from './finding-utils';
import { detectBrand, inferPageType, isRootOrLocaleRoot, PAGE_TYPE_LABEL, STOP_WORDS, UTILITY_PAGE_TYPES } from '../page-context';
import { classifyRedirect } from '../redirect-analyzer';

/**
 * Executes Technical SEO rules against extracted page evidence.
 *
 * Every rule follows: Evidence -> Context -> Confidence -> Severity -> Recommendation.
 * Severity is reserved as follows:
 *   CRITICAL: page cannot be indexed/reached as intended (noindex on indexable page, redirect loop)
 *   HIGH:     strong, well-evidenced issue (missing title, no HTTPS, long redirect chain)
 *   MEDIUM:   structural/on-page opportunity with clear evidence (missing H1, missing meta description)
 *   LOW:      minor or context-dependent opportunity
 *   INFO:     disclosed observation, no score impact
 */
export function evaluateTechnicalSeo(data: PageStructureData): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const pageType: PageType = data.pageType || inferPageType(data);
  const pageLabel = PAGE_TYPE_LABEL[pageType];
  const isUtility = UTILITY_PAGE_TYPES.includes(pageType);
  const { brand } = detectBrand(data);

  // 0. Robots noindex
  const robots = (data.robotsMeta || '').toLowerCase();
  if (/\bnoindex\b|\bnone\b/.test(robots)) {
    const intentional = pageType === 'login' || pageType === 'dashboard';
    findings.push(makeFinding({
      id: 'seo-noindex',
      category: 'technical_seo',
      severity: intentional ? 'INFO' : 'CRITICAL',
      title: intentional ? 'Page Is Excluded From Indexing (Likely Intentional)' : 'Page Is Excluded From Search Indexing (noindex)',
      evidence: {
        source: 'fetch',
        location: '<meta name="robots">',
        observed: `robots="${data.robotsMeta}"`,
        expected: 'No noindex directive on pages intended to appear in search.',
      },
      context: intentional
        ? `Detected page type: ${pageLabel}. Account/authentication pages are commonly excluded from search on purpose.`
        : `Detected page type: ${pageLabel}. This page type is normally intended to be indexable.`,
      whyItMatters: 'A noindex directive instructs search engines not to include the page in results, regardless of other optimizations.',
      recommendedFix: intentional
        ? 'No action needed if this page should stay out of search results.'
        : 'If this page is meant to rank, remove "noindex" from the robots meta tag (and any X-Robots-Tag header). If exclusion is intentional, no action is needed.',
      expectedImpact: intentional ? 'None \u2014 informational.' : 'Allows the page to be considered for indexing.',
      confidence: intentional ? 0.7 : 0.9,
      deductionPoints: 10,
    }));
  }

  // 1. Title Tag
  if (!data.title) {
    findings.push(makeFinding({
      id: 'seo-missing-title',
      category: 'technical_seo',
      severity: 'HIGH',
      title: 'Missing Page Title Tag',
      evidence: {
        source: 'fetch',
        location: '<head> > <title>',
        observed: 'No <title> tag found in HTML head.',
        expected: 'A descriptive title naming the page topic and brand.',
      },
      whyItMatters: 'The title is a primary relevance signal and is commonly used as the search result headline.',
      recommendedFix: 'Add a concise <title> that states what this page is about, followed by the brand name.',
      expectedImpact: 'Clearer search result headline and stronger topical relevance signal.',
      confidence: 1.0,
      deductionPoints: 5,
    }));
  } else {
    const title = data.title.trim();
    const titleNorm = title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const brandNorm = brand.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isBrandOnly = titleNorm === brandNorm || (brandNorm.length > 0 && titleNorm.replace(brandNorm, '').length <= 3);

    // Repetition: any meaningful word used 3+ times
    const counts: Record<string, number> = {};
    title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w))
      .forEach(w => { counts[w] = (counts[w] || 0) + 1; });
    const repeated = Object.entries(counts).filter(([, c]) => c >= 3).map(([w]) => w);
    // Approximate SERP display width (~600px at ~8.5px avg/char ≈ 70 chars)
    const approxPx = Math.round(title.length * 8.5);
    const isVerbose = title.length > 70 || repeated.length > 0;

    if (isBrandOnly && !isRootOrLocaleRoot(safePath(data.finalUrl || data.url)) && !isUtility) {
      findings.push(makeFinding({
        id: 'seo-title-not-descriptive',
        category: 'technical_seo',
        severity: 'LOW',
        title: 'Title Does Not Describe This Specific Page',
        evidence: {
          source: 'fetch',
          location: '<head> > <title>',
          observed: `"${title}" (brand-only title on a non-homepage URL)`,
          expected: 'A title naming the page topic, e.g. "<Topic> | Brand".',
        },
        context: `Detected page type: ${pageLabel}. Brand-only titles are fine on homepages but make sub-pages indistinguishable in search results.`,
        whyItMatters: 'When several pages share the same brand-only title, search engines and users have less information to tell them apart.',
        recommendedFix: `Prefix the title with the specific topic of this page (e.g. "<page topic> | ${brand}").`,
        expectedImpact: 'Clearer differentiation of this page in search results.',
        confidence: 0.8,
        deductionPoints: 2,
      }));
    } else if (title.length < 10 && !isBrandOnly) {
      findings.push(makeFinding({
        id: 'seo-short-title',
        category: 'technical_seo',
        severity: 'LOW',
        title: 'Page Title May Be Too Brief',
        evidence: {
          source: 'fetch',
          location: '<head> > <title>',
          observed: `"${title}" (${title.length} characters)`,
          expected: 'A title that names the page topic and brand.',
        },
        context: 'Very short titles that are not the brand name itself rarely convey the page topic.',
        whyItMatters: 'A title that omits the topic gives search engines and users little context about the page.',
        recommendedFix: 'Expand the title to include the core topic of the page and the brand name.',
        expectedImpact: 'Clearer relevance signal for the page topic.',
        confidence: 0.7,
        deductionPoints: 1,
      }));
    } else if (isVerbose) {
      const reasons: string[] = [];
      if (title.length > 70) reasons.push(`${title.length} characters (~${approxPx}px estimated width)`);
      if (repeated.length) reasons.push(`repeats "${repeated.join('", "')}" 3+ times`);
      findings.push(makeFinding({
        id: 'seo-long-title',
        category: 'technical_seo',
        severity: 'LOW',
        title: 'Title May Be Overly Long or Verbose',
        evidence: {
          source: 'fetch',
          location: '<head> > <title>',
          observed: `"${title}" \u2014 ${reasons.join('; ')}`,
          expected: 'Key topic terms near the beginning; concise wording without repetition.',
        },
        context: 'Search engines do not use a fixed character limit; display depends on pixel width and the query. This is a minor presentation issue, not a ranking failure.',
        whyItMatters: 'Long or repetitive titles may be rewritten or displayed differently in search results, which can hide the most important terms.',
        recommendedFix: 'Keep the primary topic and brand near the start and remove repeated or filler words.',
        expectedImpact: 'More predictable presentation of the title in search results.',
        confidence: 0.6,
        deductionPoints: 1,
      }));
    }
  }

  // 2. Meta Description
  if (!data.metaDescription) {
    findings.push(makeFinding({
      id: 'seo-missing-description',
      category: 'technical_seo',
      severity: isUtility ? 'LOW' : 'MEDIUM',
      title: 'Missing Meta Description Tag',
      evidence: {
        source: 'fetch',
        location: '<head> > <meta name="description">',
        observed: 'No meta description tag found.',
        expected: 'A meta description summarizing the page (roughly 120\u2013160 characters).',
      },
      context: `Detected page type: ${pageLabel}.${isUtility ? ' Utility/application pages are rarely search landing pages, so impact is limited.' : ''}`,
      whyItMatters: 'Without a meta description, search engines generate a snippet from page text, which may not represent the page well.',
      recommendedFix: 'Add a <meta name="description"> that states what the page offers and who it is for.',
      expectedImpact: 'More control over the search result snippet.',
      confidence: 1.0,
      deductionPoints: isUtility ? 1 : 3,
    }));
  } else if (data.metaDescriptionLength < 50) {
    findings.push(makeFinding({
      id: 'seo-short-description',
      category: 'technical_seo',
      severity: 'LOW',
      title: 'Meta Description is Brief',
      evidence: {
        source: 'fetch',
        location: '<head> > <meta name="description">',
        observed: `"${data.metaDescription}" (${data.metaDescriptionLength} characters)`,
        expected: 'A description of roughly 120\u2013160 characters.',
      },
      whyItMatters: 'Very brief descriptions provide limited context in search results and may be replaced by auto-generated snippets.',
      recommendedFix: 'Expand the description to summarize the page purpose and its main benefit.',
      expectedImpact: 'More informative search snippet.',
      confidence: 0.8,
      deductionPoints: 1,
    }));
  }

  // 3. H1 Heading & Hierarchy (respects 3-state evidence)
  const h1Status = data.evidenceState?.headings.h1Status;
  const domInspected = data.evidenceState?.domInspected ?? true;

  if (h1Status === 'NOT_FOUND') {
    findings.push(makeFinding({
      id: 'seo-missing-h1',
      category: 'technical_seo',
      severity: isUtility ? 'LOW' : 'MEDIUM',
      title: 'Missing Primary H1 Heading',
      evidence: {
        source: 'fetch',
        location: 'body > h1',
        observed: `0 <h1> tags found on the ${data.renderedDom ? 'rendered' : 'fetched'} page.`,
        expected: 'One <h1> stating the primary topic of the page.',
      },
      context: `Detected page type: ${pageLabel}. A missing H1 does not prevent indexing; it weakens the explicit statement of the page topic.`,
      whyItMatters: 'The H1 is a clear, machine-readable statement of what the page is about for search engines, assistive technology and answer systems.',
      recommendedFix: 'Add a single visible <h1> near the top of the main content that names the page topic.',
      expectedImpact: 'Clearer topical signal and document outline.',
      confidence: data.renderedDom ? 0.95 : 0.8,
      deductionPoints: isUtility ? 1 : 3,
    }));
  } else if (h1Status === 'FOUND' && data.h1Count > 1) {
    findings.push(makeFinding({
      id: 'seo-multiple-h1',
      category: 'technical_seo',
      severity: 'LOW',
      title: 'Multiple <h1> Headings Found',
      evidence: {
        source: 'fetch',
        location: 'body > h1',
        observed: `${data.h1Count} <h1> tags detected on the page.`,
        expected: 'One primary <h1>, with sub-sections using <h2>\u2013<h6>.',
      },
      context: 'HTML allows multiple H1 elements and search engines process them; having a single primary H1 makes document structure unambiguous.',
      whyItMatters: 'Multiple primary headings may make document hierarchy less explicit.',
      recommendedFix: 'Keep one <h1> for the main page topic and demote section titles to <h2>.',
      expectedImpact: 'Cleaner heading hierarchy.',
      confidence: 0.7,
      deductionPoints: 1,
    }));
  }

  // 3b. Heading Hierarchy Skipped Levels Check (Non-alarmist)
  const detailedHeadings = data.evidenceState?.headings.headings || [];
  if (domInspected && detailedHeadings.length > 1) {
    let skippedFindingAdded = false;
    for (let i = 0; i < detailedHeadings.length - 1; i++) {
      const current = detailedHeadings[i];
      const next = detailedHeadings[i + 1];
      if (next.level > current.level + 1 && !skippedFindingAdded) {
        skippedFindingAdded = true;
        findings.push(makeFinding({
          id: 'seo-heading-hierarchy-skipped',
          category: 'technical_seo',
          severity: 'LOW',
          title: 'Heading Hierarchy Skips Structural Levels',
          evidence: {
            source: 'fetch',
            location: `body > <${current.tag}> -> <${next.tag}>`,
            observed: `<${current.tag}> "${current.text.slice(0, 30)}" is followed directly by <${next.tag}> "${next.text.slice(0, 30)}".`,
            expected: `Sequential heading levels (e.g. <${current.tag}> followed by <h${current.level + 1}> or another <${current.tag}>).`,
          },
          context: 'Skipped heading levels do not cause search penalties; sequential headings improve document outlines.',
          whyItMatters: 'A sequential heading hierarchy (H1 -> H2 -> H3) helps assistive technologies and answer systems navigate section boundaries.',
          recommendedFix: `Consider using <h${current.level + 1}> for major subtopics before nesting <${next.tag}>.`,
          expectedImpact: 'More consistent document outline.',
          confidence: 0.7,
          deductionPoints: 1,
        }));
      }
    }
  }

  // 4. Canonical (contextual)
  const pageUrl = data.finalUrl || data.url;
  const variantEvidence = detectVariantEvidence(data);
  if (!data.canonical) {
    findings.push(makeFinding({
      id: 'seo-missing-canonical',
      category: 'technical_seo',
      severity: variantEvidence ? 'MEDIUM' : 'INFO',
      title: variantEvidence ? 'No Canonical URL With URL Variants Present' : 'No Explicit Canonical URL Detected',
      evidence: {
        source: 'fetch',
        location: '<head> > <link rel="canonical">',
        observed: 'No rel="canonical" link detected.',
        expected: `<link rel="canonical" href="${stripQuery(pageUrl)}">`,
      },
      context: variantEvidence
        ? `Duplicate/variant evidence: ${variantEvidence}.`
        : 'No duplicate or parameterized URL variants were observed for this page.',
      whyItMatters: 'A canonical tells search engines which URL to consolidate signals into when the same content is reachable at multiple URLs. Without variants, its absence has little practical effect.',
      recommendedFix: variantEvidence
        ? 'Add a self-referencing canonical pointing to the clean, preferred URL so parameterized variants consolidate to it.'
        : 'Optional: consider adding a self-referencing canonical if duplicate or variant URLs (tracking parameters, filters, trailing-slash variants) may exist.',
      expectedImpact: variantEvidence ? 'Consolidated indexing signals across URL variants.' : 'Preventive; no measurable impact expected without variants.',
      confidence: 0.9,
      deductionPoints: variantEvidence ? 2 : 0,
    }));
  } else {
    let canonicalAbs = data.canonical;
    try { canonicalAbs = new URL(data.canonical, pageUrl).toString(); } catch { /* keep raw */ }
    if (!sameUrlLoose(canonicalAbs, pageUrl)) {
      const pointsToHome = isRootOrLocaleRoot(safePath(canonicalAbs)) && !isRootOrLocaleRoot(safePath(pageUrl));
      findings.push(makeFinding({
        id: 'seo-canonical-mismatch',
        category: 'technical_seo',
        severity: pointsToHome ? 'MEDIUM' : 'INFO',
        title: pointsToHome ? 'Canonical Points to the Homepage' : 'Canonical Points to a Different URL',
        evidence: {
          source: 'fetch',
          location: '<head> > <link rel="canonical">',
          observed: `Canonical: ${canonicalAbs} | Page: ${pageUrl}`,
          expected: 'Canonical matching the page URL, unless consolidation to another URL is intended.',
        },
        context: pointsToHome
          ? 'A sub-page declaring the homepage as canonical asks search engines to index the homepage instead of this page.'
          : 'Cross-URL canonicals are often intentional (e.g. locale or parameter consolidation).',
        whyItMatters: 'Search engines may index the canonical target instead of this URL.',
        recommendedFix: pointsToHome
          ? 'If this page should rank on its own, set the canonical to this page\u2019s own URL.'
          : 'Verify that consolidating this URL into the canonical target is intentional.',
        expectedImpact: pointsToHome ? 'Allows this page to be indexed as itself.' : 'Informational.',
        confidence: pointsToHome ? 0.8 : 0.7,
        deductionPoints: pointsToHome ? 3 : 0,
      }));
    }
  }

  // 5. Image Alt Attributes
  if (data.totalImages >= 3 && data.missingAltCount > 0) {
    const missingRatio = data.missingAltCount / data.totalImages;
    if (missingRatio > 0.25) {
      findings.push(makeFinding({
        id: 'seo-missing-image-alts',
        category: 'technical_seo',
        severity: 'LOW',
        title: 'Images Missing Alt Attributes',
        evidence: {
          source: 'fetch',
          location: 'body > img',
          observed: `${data.missingAltCount} of ${data.totalImages} images have no alt attribute.`,
          expected: 'Descriptive alt text on informative images; alt="" on decorative images.',
        },
        whyItMatters: 'Alt text makes images understandable to screen readers and image search.',
        recommendedFix: 'Add descriptive alt text to informative images and alt="" to purely decorative ones.',
        expectedImpact: 'Better accessibility and image discoverability.',
        confidence: 0.85,
        deductionPoints: 2,
      }));
    }
  }

  // 6. HTTPS
  if (!data.hasHttps) {
    findings.push(makeFinding({
      id: 'seo-no-https',
      category: 'technical_seo',
      severity: 'HIGH',
      title: 'Page Not Served Over Secure HTTPS',
      evidence: { source: 'fetch', location: 'protocol', observed: 'http:// scheme', expected: 'https:// secure scheme' },
      whyItMatters: 'HTTPS is a lightweight ranking signal and browsers flag non-HTTPS pages as not secure.',
      recommendedFix: 'Serve the page over HTTPS and 301-redirect HTTP requests to the HTTPS URL.',
      expectedImpact: 'User trust and consistent indexing of the secure URL.',
      confidence: 1.0,
      deductionPoints: 5,
    }));
  }

  // 7. Mobile viewport (respects 3-state evidence model)
  const vpStatus = data.evidenceState?.head.viewport.status ?? (data.hasViewportMeta ? 'FOUND' : 'NOT_FOUND');
  if (vpStatus === 'NOT_FOUND' && !data.hasViewportMeta && !isUtility) {
    findings.push(makeFinding({
      id: 'seo-missing-viewport',
      category: 'technical_seo',
      severity: 'LOW',
      title: 'No Mobile Viewport Meta Tag',
      evidence: { source: 'fetch', location: '<head> > <meta name="viewport">', observed: 'No viewport meta tag detected in head.', expected: '<meta name="viewport" content="width=device-width, initial-scale=1">' },
      whyItMatters: 'Search engines index the mobile rendering of pages; without a viewport tag, mobile rendering may be scaled down.',
      recommendedFix: 'Add a responsive viewport meta tag.',
      expectedImpact: 'Correct mobile rendering.',
      confidence: 0.75,
      deductionPoints: 2,
    }));
  }

  // 8. Redirect (disclosed always; severity depends on redirect kind)
  if (data.isRedirected || (data.redirect && data.redirect.kind !== 'none')) {
    findings.push(buildRedirectFinding(data, pageLabel));
  }

  return findings;
}

function buildRedirectFinding(data: PageStructureData, pageLabel: string): AuditFinding {
  const requested = data.requestedUrl || data.redirect?.requestedUrl || data.url;
  const finalUrl = data.finalUrl || data.url;
  const r = data.redirect || classifyRedirect({ requestedUrl: requested, finalUrl, traceAvailable: false });
  const statusText = r.hops.length ? r.hops.map(h => h.status).join(' \u2192 ') : r.isClientSide ? 'client-side (no HTTP 3xx observed)' : 'not traced';
  const observed = `Requested ${requested} \u2192 final ${finalUrl} | hops: ${r.httpRedirectCount} | status: ${statusText}`;

  type Rule = { severity: AuditFinding['severity']; points: number; title: string; context: string; fix: string; confidence: number };
  const base = 'The requested URL redirects to another destination. Verify that this redirect is intentional and that the destination satisfies the original page intent.';
  let rule: Rule;
  switch (r.kind) {
    case 'loop':
      rule = { severity: 'CRITICAL', points: 10, title: 'Redirect Loop Detected', confidence: 0.95,
        context: 'The redirect sequence revisits a URL it already passed through, so neither users nor crawlers can reach a final page.',
        fix: 'Fix the redirect rules so the URL resolves to a single final destination with one 301/308 hop.' };
      break;
    case 'chain':
      rule = { severity: 'HIGH', points: 4, title: 'Multi-Hop Redirect Chain', confidence: 0.9,
        context: `${r.httpRedirectCount} HTTP redirects occur before the final page. Long chains slow crawling and users, and some crawlers stop following after several hops.`,
        fix: `${base} Point the original URL directly at the final destination with a single permanent (301/308) redirect.` };
      break;
    case 'to_homepage':
      rule = { severity: 'MEDIUM', points: 3, title: 'Specific Page Redirects to the Homepage', confidence: 0.7,
        context: 'A specific path resolving to the site root can indicate removed content. Search engines may treat such redirects as soft 404s if the homepage does not satisfy the original intent.',
        fix: `${base} If the original page was removed, redirect to the closest equivalent page or return 404/410; if it should exist, restore its content.` };
      break;
    case 'cross_domain':
      rule = { severity: 'LOW', points: 1, title: 'Requested URL Redirects to Another Domain', confidence: 0.7,
        context: 'Cross-domain redirects are often intentional (rebrand, consolidation) but transfer the audit to a different site.',
        fix: base };
      break;
    case 'path_change':
      rule = r.permanent
        ? { severity: 'INFO', points: 0, title: 'Requested URL Permanently Redirects to a New URL', confidence: 0.8,
            context: 'A permanent (301/308) redirect to a different, non-homepage URL is the standard way to move content.', fix: base }
        : { severity: 'LOW', points: 1, title: 'Requested URL Redirects to a Different URL', confidence: 0.7,
            context: r.permanent === false ? 'The redirect is temporary (302/303/307); if the move is permanent, a 301/308 communicates that more clearly.' : 'The redirect type could not be confirmed.',
            fix: `${base} If the move is permanent, use a 301/308 redirect.` };
      break;
    case 'locale':
      rule = { severity: 'INFO', points: 0, title: 'Locale / Regional Redirect Detected', confidence: 0.75,
        context: 'Redirects between locale or regional paths (e.g. /in \u2192 /, / \u2192 /en-US/) are commonly intentional internationalization behavior.',
        fix: `${base} If regional pages exist, ensure hreflang annotations describe the locale variants.` };
      break;
    case 'normalization':
      rule = { severity: 'INFO', points: 0, title: 'URL Normalization Redirect (Protocol / www / Trailing Slash)', confidence: 0.9,
        context: 'The redirect only normalizes the URL format, which is standard canonicalization.',
        fix: 'No action needed. Optionally link internally to the final URL format to avoid the extra hop.' };
      break;
    default:
      rule = { severity: 'LOW', points: 1, title: 'Target URL Redirected to Different Page', confidence: 0.6,
        context: 'The redirect could not be classified with certainty.', fix: base };
  }

  // Client-side (JavaScript/meta refresh) redirects are processed less reliably than HTTP redirects
  if (r.isClientSide && rule.severity !== 'CRITICAL' && rule.severity !== 'HIGH') {
    rule = {
      ...rule,
      severity: rule.severity === 'INFO' ? 'LOW' : rule.severity,
      points: Math.max(rule.points, 1),
      context: `${rule.context} The redirect appears to happen client-side (no HTTP 3xx observed), which crawlers may process less reliably than a server-side 301/308.`,
    };
  }

  return makeFinding({
    id: 'seo-page-redirected',
    category: 'technical_seo',
    severity: rule.severity,
    title: rule.title,
    evidence: {
      source: 'fetch',
      location: r.isClientSide ? 'Client-side redirect' : 'HTTP redirect',
      observed,
      expected: 'Intentional redirect to a destination that satisfies the original page intent (single 301/308 hop when permanent).',
    },
    context: `${rule.context} Audit evidence reflects the final destination (${pageLabel}).`,
    whyItMatters: 'Redirects determine which URL search engines index and where users land; unintended redirects can remove pages from search.',
    recommendedFix: rule.fix,
    expectedImpact: rule.points > 0 ? 'Predictable indexing of the intended URL.' : 'Informational \u2014 disclosed for transparency.',
    confidence: rule.confidence,
    deductionPoints: rule.points,
  });
}

function safePath(u: string): string {
  try { return new URL(u).pathname; } catch { return '/'; }
}

function stripQuery(u: string): string {
  return u.replace(/[?#].*$/, '');
}

function sameUrlLoose(a: string, b: string): boolean {
  const n = (u: string) => u.toLowerCase().replace(/#.*$/, '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  return n(a) === n(b);
}

/** Returns a description of observed duplicate/variant URL evidence, or null. */
export function detectVariantEvidence(data: PageStructureData): string | null {
  const urls = [data.requestedUrl, data.finalUrl, data.url].filter(Boolean) as string[];
  for (const u of urls) {
    try {
      const parsed = new URL(u);
      if (parsed.search && parsed.search.length > 1) {
        const keys = Array.from(parsed.searchParams.keys());
        return `URL contains query parameters (${keys.slice(0, 4).join(', ') || parsed.search})`;
      }
    } catch { /* ignore */ }
  }
  if (data.redirect && data.redirect.kind === 'normalization' && data.redirect.httpRedirectCount === 0 && data.redirect.isClientSide) {
    return 'URL format variants resolve without an HTTP redirect';
  }
  return null;
}
