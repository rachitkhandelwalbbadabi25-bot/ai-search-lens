import * as cheerio from 'cheerio';
import { extractWordCountMetrics, countWords } from './word-count-utility';
import {
  BaseEvidenceSignal,
  DetailedHeadingItem,
  EntityPublisherEvidence,
  EvidenceStatus,
  HeadMetadataEvidence,
  HeadingEvidence,
  PageEvidenceState,
  PageHeading,
  PageStructureData,
  SchemaTypeDetail,
  StructuredDataEvidence,
} from '@/types/audit';

/**
 * Parses raw HTML payload to extract exact DOM evidence, metadata, structured data,
 * heading hierarchy, and content structure, populating a 3-state evidence model
 * (FOUND, NOT_FOUND, UNVERIFIED) to avoid treating extraction failures as SEO problems.
 */
export function extractPageEvidence(
  html: string,
  targetUrl: string,
  statusCode: number,
  overrideTitle?: string | null,
  overrideDescription?: string | null,
  options?: { renderedDom?: boolean }
): PageStructureData {
  let headInspected = true;
  let domInspected = true;
  let inspectionReason: string | undefined;

  if (statusCode >= 400 || statusCode === 0 || !html || typeof html !== 'string' || html.trim().length === 0) {
    headInspected = false;
    domInspected = false;
    inspectionReason = `Page fetch failed or raw HTML was empty (HTTP status ${statusCode})`;
  } else {
    const trimmed = html.trim();
    const hasTags = /<[a-z][\s\S]*>/i.test(trimmed);
    if (!hasTags && trimmed.length < 50) {
      headInspected = false;
      domInspected = false;
      inspectionReason = `Source HTML payload does not contain HTML markup (${trimmed.slice(0, 100)})`;
    }
  }

  const $ = cheerio.load(html || '<html><head></head><body></body></html>');
  let parsedTargetUrl: URL;
  try {
    parsedTargetUrl = new URL(targetUrl);
  } catch {
    parsedTargetUrl = new URL('https://example.com');
  }

  // 1. Title & Meta Description Extraction
  let titleStr = $('head > title').text().trim() || $('title').first().text().trim() || null;
  if ((!titleStr || titleStr.length === 0) && overrideTitle) {
    titleStr = overrideTitle.trim();
  }

  let descStr = $('head > meta[name="description" i]').attr('content') || 
                $('meta[name="description" i]').attr('content') || null;
  if ((!descStr || descStr.length === 0) && overrideDescription) {
    descStr = overrideDescription.trim();
  }

  const titleSignal: BaseEvidenceSignal<string> = titleStr
    ? { status: 'FOUND', value: titleStr, source: 'head > title', snippet: `<title>${titleStr}</title>` }
    : headInspected ? { status: 'NOT_FOUND', value: null, source: 'head' } : { status: 'UNVERIFIED', value: null, reason: inspectionReason || 'head unavailable' };

  const descSignal: BaseEvidenceSignal<string> = descStr
    ? { status: 'FOUND', value: descStr, source: 'head > meta[name="description"]', snippet: `<meta name="description" content="${descStr}">` }
    : headInspected ? { status: 'NOT_FOUND', value: null, source: 'head' } : { status: 'UNVERIFIED', value: null, reason: inspectionReason || 'head unavailable' };

  // Helper for heading text extraction preserving spaces between inline nodes
  const extractHeadingText = (elem: any): string => {
    const clone = $(elem).clone();
    clone.find('br').replaceWith(' ');
    const contents = clone.contents();
    const parts: string[] = [];
    contents.each((_, child) => {
      const t = $(child).text().trim();
      if (t) parts.push(t);
    });
    if (parts.length > 1) {
      return parts.join(' ').replace(/\s+/g, ' ').trim();
    }
    return clone.text().replace(/\s+/g, ' ').trim();
  };

  // 2. Canonical, Viewport, Robots Meta
  let foundViewportVal: string | null = null;
  let foundViewportElem = false;

  $('meta').each((_, elem) => {
    const name = ($(elem).attr('name') || '').trim().toLowerCase();
    const content = ($(elem).attr('content') || '').trim();
    const property = ($(elem).attr('property') || '').trim().toLowerCase();
    const httpEquiv = ($(elem).attr('http-equiv') || '').trim().toLowerCase();

    if (
      name === 'viewport' ||
      property === 'viewport' ||
      httpEquiv === 'viewport' ||
      (content && (content.toLowerCase().includes('width=') || content.toLowerCase().includes('initial-scale=')))
    ) {
      foundViewportElem = true;
      if (content && !foundViewportVal) {
        foundViewportVal = content;
      }
    }
  });

  // Raw HTML fallback for Viewport Meta (if DOM parser missed it due to malformed tags or outer placement)
  if (!foundViewportElem && html) {
    const viewportRegex = /<meta\s+[^>]*name=["']?viewport["']?[^>]*>/i;
    const viewportMatch = html.match(viewportRegex);
    if (viewportMatch) {
      foundViewportElem = true;
      const contentMatch = viewportMatch[0].match(/content=["']([^"']+)["']/i);
      if (contentMatch) {
        foundViewportVal = contentMatch[1].trim();
      }
    } else {
      const viewportContentRegex = /<meta\s+[^>]*content=["']?[^"'>]*(width=|initial-scale=)[^"'>]*["']?[^>]*>/i;
      const viewportContentMatch = html.match(viewportContentRegex);
      if (viewportContentMatch) {
        foundViewportElem = true;
        const contentMatch = viewportContentMatch[0].match(/content=["']([^"']+)["']/i);
        if (contentMatch) {
          foundViewportVal = contentMatch[1].trim();
        }
      }
    }
  }

  const viewportSignal: BaseEvidenceSignal<string> = foundViewportElem
    ? {
        status: 'FOUND',
        value: foundViewportVal || 'width=device-width',
        source: 'head > meta[name="viewport"]',
        snippet: foundViewportVal ? `<meta name="viewport" content="${foundViewportVal}">` : `<meta name="viewport">`,
      }
    : headInspected
    ? { status: 'NOT_FOUND', value: null, source: 'head' }
    : { status: 'UNVERIFIED', value: null, reason: inspectionReason || 'head unavailable' };

  // Canonical URL Detection
  let canonicalVal: string | null = null;
  $('link').each((_, elem) => {
    const rel = ($(elem).attr('rel') || '').trim().toLowerCase();
    const relTokens = rel.split(/\s+/);
    if (relTokens.includes('canonical')) {
      const href = ($(elem).attr('href') || '').trim();
      if (href && !canonicalVal) {
        canonicalVal = href;
      }
    }
  });

  // Raw HTML fallback for Canonical URL
  if (!canonicalVal && html) {
    const canonicalRegex = /<link\s+[^>]*rel=["']?[^"'>]*canonical[^"'>]*["']?[^>]*href=["']?([^"'\s>]+)["']?/i;
    const altCanonicalRegex = /<link\s+[^>]*href=["']?([^"'\s>]+)["']?[^>]*rel=["']?[^"'>]*canonical/i;
    const match = html.match(canonicalRegex) || html.match(altCanonicalRegex);
    if (match && match[1]) {
      canonicalVal = match[1].trim();
    }
  }

  // Normalize relative canonical URL
  if (canonicalVal) {
    try {
      canonicalVal = new URL(canonicalVal, targetUrl).href;
    } catch {
      // Keep raw canonical if URL parsing fails
    }
  }

  const canonicalSignal: BaseEvidenceSignal<string> = canonicalVal !== null
    ? { status: 'FOUND', value: canonicalVal, source: 'head > link[rel="canonical"]', snippet: `<link rel="canonical" href="${canonicalVal}">` }
    : headInspected ? { status: 'NOT_FOUND', value: null, source: 'head' } : { status: 'UNVERIFIED', value: null, reason: inspectionReason || 'head unavailable' };

  const robotsVal = $('meta[name="robots" i]').attr('content')?.trim() || null;
  const robotsSignal: BaseEvidenceSignal<string> = robotsVal !== null
    ? { status: 'FOUND', value: robotsVal, source: 'head > meta[name="robots"]', snippet: `<meta name="robots" content="${robotsVal}">` }
    : headInspected ? { status: 'NOT_FOUND', value: null, source: 'head' } : { status: 'UNVERIFIED', value: null, reason: inspectionReason || 'head unavailable' };

  // 3. OpenGraph & Twitter Card Meta
  const ogTitle = $('meta[property="og:title" i], meta[name="og:title" i]').attr('content')?.trim() || null;
  const ogDescription = $('meta[property="og:description" i], meta[name="og:description" i]').attr('content')?.trim() || null;
  const ogSiteName = $('meta[property="og:site_name" i], meta[name="og:site_name" i]').attr('content')?.trim() || null;
  const ogType = $('meta[property="og:type" i], meta[name="og:type" i]').attr('content')?.trim() || null;
  const hasOg = !!(ogTitle || ogDescription || ogSiteName || ogType || $('meta[property^="og:" i]').length > 0);

  const openGraph = hasOg
    ? { status: 'FOUND' as EvidenceStatus, title: ogTitle, description: ogDescription, siteName: ogSiteName, type: ogType, source: 'head > meta[property^="og:"]' }
    : headInspected ? { status: 'NOT_FOUND' as EvidenceStatus, source: 'head' } : { status: 'UNVERIFIED' as EvidenceStatus, reason: inspectionReason || 'head unavailable' };

  const twCard = $('meta[name="twitter:card" i], meta[property="twitter:card" i]').attr('content')?.trim() || null;
  const twTitle = $('meta[name="twitter:title" i], meta[property="twitter:title" i]').attr('content')?.trim() || null;
  const twDesc = $('meta[name="twitter:description" i], meta[property="twitter:description" i]').attr('content')?.trim() || null;
  const hasTw = !!(twCard || twTitle || twDesc || $('meta[name^="twitter:" i]').length > 0);

  const twitterCard = hasTw
    ? { status: 'FOUND' as EvidenceStatus, card: twCard, title: twTitle, description: twDesc, source: 'head > meta[name^="twitter:"]' }
    : headInspected ? { status: 'NOT_FOUND' as EvidenceStatus, source: 'head' } : { status: 'UNVERIFIED' as EvidenceStatus, reason: inspectionReason || 'head unavailable' };

  const headMetadataEvidence: HeadMetadataEvidence = {
    title: titleSignal,
    metaDescription: descSignal,
    viewport: viewportSignal,
    canonical: canonicalSignal,
    robotsMeta: robotsSignal,
    openGraph,
    twitterCard,
  };

  // 4. Headings Hierarchy (H1-H6)
  const detailedHeadings: DetailedHeadingItem[] = [];
  const pageHeadings: PageHeading[] = [];
  let h1Count = 0;
  let h2Count = 0;
  let headingOrder = 0;

  const headingClone = $('body').length > 0 ? $('body').clone() : $('html').clone();
  headingClone.find('script, style, template').remove();

  headingClone.find('h1, h2, h3, h4, h5, h6').each((_, elem) => {
    if ($(elem).parents('script, style, template').length > 0) return;
    const tagName = elem.tagName.toLowerCase() as PageHeading['level'];
    const text = extractHeadingText(elem);
    if (text) {
      headingOrder++;
      const levelNum = parseInt(tagName.replace('h', ''), 10);
      if (tagName === 'h1') h1Count++;
      if (tagName === 'h2') h2Count++;
      pageHeadings.push({ level: tagName, text });
      detailedHeadings.push({
        level: levelNum,
        tag: tagName,
        text,
        order: headingOrder,
        selector: `${tagName}:nth-of-type(${detailedHeadings.filter(h => h.tag === tagName).length + 1})`,
      });
    }
  });

  const isRendered = options?.renderedDom ?? true;
  const headingsStatus: EvidenceStatus = detailedHeadings.length > 0 ? 'FOUND' : domInspected ? 'NOT_FOUND' : 'UNVERIFIED';
  const h1Status: EvidenceStatus = h1Count > 0 ? 'FOUND' : (domInspected && isRendered) ? 'NOT_FOUND' : 'UNVERIFIED';

  const headingEvidence: HeadingEvidence = {
    status: headingsStatus,
    h1Status,
    count: detailedHeadings.length,
    h1Count,
    h2Count,
    headings: detailedHeadings,
    source: 'body > h1..h6',
    reason: domInspected ? undefined : (inspectionReason || 'DOM unavailable'),
  };

  // 5. Schema.org / Structured Data (JSON-LD, Microdata, RDFa)
  const jsonLdTypesSet = new Set<string>();
  const jsonLdDetails: SchemaTypeDetail[] = [];
  const rawSchemaBlocks: string[] = [];
  const sameAsLinks: string[] = [];
  let schemaOrgName: string | null = null;
  let jsonLdAuthor = false;
  let jsonLdDate = false;
  let jsonLdPublisher = false;
  let authorName: string | undefined;
  let publisherName: string | undefined;

  const unescapeHtml = (str: string) => str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'");

  const cleanJsonLdText = (raw: string) => {
    let cleaned = raw.trim();
    cleaned = cleaned.replace(/^\/\*\s*<!\[CDATA\[\s*\*\//i, '').replace(/\/\*\s*\]\]>\s*\*\/$/i, '');
    cleaned = cleaned.replace(/^<!--/i, '').replace(/-->$/i, '');
    return unescapeHtml(cleaned);
  };

  const normalizeSchemaType = (raw: string): string | null => {
    if (!raw || typeof raw !== 'string') return null;
    let cleaned = raw.trim();
    cleaned = cleaned.replace(/^https?:\/\/(www\.)?schema\.org\/?/i, '');
    cleaned = cleaned.replace(/^schema:/i, '');
    cleaned = cleaned.split(/[\/#]/).filter(Boolean).pop() || cleaned;
    cleaned = cleaned.trim();
    if (/^[A-Za-z][A-Za-z0-9_-]*$/.test(cleaned)) {
      return cleaned;
    }
    return null;
  };

  const isSchemaOrgUrl = (url: string): boolean => {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim().toLowerCase();
    return (
      trimmed.includes('schema.org') ||
      trimmed.startsWith('https://schema.org') ||
      trimmed.startsWith('http://schema.org') ||
      trimmed.startsWith('//schema.org')
    );
  };

  const hasSchemaContext = (ctx: any): boolean => {
    if (!ctx) return false;
    if (typeof ctx === 'string') {
      return isSchemaOrgUrl(ctx);
    }
    if (Array.isArray(ctx)) {
      return ctx.some(item => hasSchemaContext(item));
    }
    if (typeof ctx === 'object') {
      if (ctx['@vocab'] && typeof ctx['@vocab'] === 'string' && isSchemaOrgUrl(ctx['@vocab'])) {
        return true;
      }
      if (ctx['@context']) {
        return hasSchemaContext(ctx['@context']);
      }
    }
    return false;
  };

  const walkJsonLd = (obj: any, depth = 0, parentSchemaContext = false) => {
    if (!obj || depth > 15) return;
    if (Array.isArray(obj)) {
      obj.forEach(item => walkJsonLd(item, depth + 1, parentSchemaContext));
      return;
    }
    if (typeof obj !== 'object') return;

    let isSchemaContext = parentSchemaContext;
    if (obj['@context'] !== undefined) {
      isSchemaContext = hasSchemaContext(obj['@context']);
    }

    const rawTypes = obj['@type'];
    const entityId = typeof obj['@id'] === 'string' ? obj['@id'].trim() : undefined;

    if (rawTypes) {
      const typesArray = Array.isArray(rawTypes) ? rawTypes : [rawTypes];
      typesArray.forEach((t: unknown) => {
        if (typeof t === 'string') {
          const isExplicitSchemaUrl = isSchemaOrgUrl(t) || /^schema:/i.test(t);
          if (isSchemaContext || isExplicitSchemaUrl) {
            const norm = normalizeSchemaType(t);
            if (norm) {
              jsonLdTypesSet.add(norm);
              jsonLdDetails.push({
                type: norm,
                format: 'JSON-LD',
                source: 'script[type="application/ld+json"]',
                entityId,
              });
            }
          }
        }
      });
    }

    if (obj['@graph']) {
      walkJsonLd(obj['@graph'], depth + 1, isSchemaContext);
    }

    Object.keys(obj).forEach(key => {
      if (key !== '@type' && key !== '@graph' && typeof obj[key] === 'object') {
        walkJsonLd(obj[key], depth + 1, isSchemaContext);
      }
    });
  };

  const walkEntitySignals = (obj: any, depth: number) => {
    if (!obj || depth > 15) return;
    if (Array.isArray(obj)) {
      obj.forEach(o => walkEntitySignals(o, depth + 1));
      return;
    }
    if (typeof obj !== 'object') return;
    const types: string[] = Array.isArray(obj['@type'])
      ? obj['@type'].map((t: any) => normalizeSchemaType(String(t)) || String(t))
      : obj['@type']
      ? [normalizeSchemaType(String(obj['@type'])) || String(obj['@type'])]
      : [];

    if (!schemaOrgName && typeof obj.name === 'string' && types.some(t => /^(Organization|Corporation|WebSite|LocalBusiness|EducationalOrganization|NGO|OnlineStore|OnlineBusiness)$/i.test(t))) {
      schemaOrgName = obj.name.trim();
    }
    if (obj.sameAs) {
      const list = Array.isArray(obj.sameAs) ? obj.sameAs : [obj.sameAs];
      list.forEach((s: unknown) => { if (typeof s === 'string' && s.trim()) sameAsLinks.push(s.trim()); });
    }
    if (obj.author || obj.creator) {
      jsonLdAuthor = true;
      const auth = obj.author || obj.creator;
      if (typeof auth === 'object' && typeof auth.name === 'string') authorName = auth.name.trim();
      else if (typeof auth === 'string') authorName = auth.trim();
    }
    if (obj.publisher) {
      jsonLdPublisher = true;
      if (typeof obj.publisher === 'object' && typeof obj.publisher.name === 'string') publisherName = obj.publisher.name.trim();
      else if (typeof obj.publisher === 'string') publisherName = obj.publisher.trim();
    }
    if (obj.datePublished || obj.dateModified) jsonLdDate = true;
    Object.keys(obj).forEach(k => {
      if (k !== '@type' && typeof obj[k] === 'object') walkEntitySignals(obj[k], depth + 1);
    });
  };

  $('script[type="application/ld+json"]').each((_, elem) => {
    const rawContent = $(elem).html();
    if (rawContent && rawContent.trim()) {
      const cleaned = cleanJsonLdText(rawContent);
      rawSchemaBlocks.push(cleaned);
      try {
        const json = JSON.parse(cleaned);
        walkJsonLd(json, 0);
        walkEntitySignals(json, 0);
      } catch {
        // Malformed JSON block ignored
      }
    }
  });

  const jsonLdTypes = Array.from(jsonLdTypesSet);

  // Microdata (itemscope/itemtype)
  const microdataTypesSet = new Set<string>();
  const microdataDetails: SchemaTypeDetail[] = [];
  $('[itemscope]').each((_, elem) => {
    const rawType = ($(elem).attr('itemtype') || '').trim();
    const entityId = ($(elem).attr('itemid') || '').trim() || undefined;
    if (rawType) {
      rawType.split(/\s+/).forEach(t => {
        if (isSchemaOrgUrl(t)) {
          const norm = normalizeSchemaType(t);
          if (norm) {
            microdataTypesSet.add(norm);
            microdataDetails.push({
              type: norm,
              format: 'Microdata',
              source: 'itemscope/itemtype',
              entityId,
            });
          }
        }
      });
    }
  });
  $('[itemprop="sameAs"]').each((_, elem) => {
    const href = $(elem).attr('href') || $(elem).attr('content');
    if (href && href.trim()) sameAsLinks.push(href.trim());
  });

  // RDFa (typeof/vocab)
  const rdfaTypesSet = new Set<string>();
  const rdfaDetails: SchemaTypeDetail[] = [];
  $('[typeof]').each((_, elem) => {
    const rawTypeof = ($(elem).attr('typeof') || '').trim();
    if (!rawTypeof) return;

    // Check if current element or any parent has vocab/prefix pointing to schema.org
    let hasSchemaVocab = false;
    let current: any = $(elem);
    while (current && current.length > 0 && !hasSchemaVocab) {
      const vocab = (current.attr('vocab') || '').trim().toLowerCase();
      const prefix = (current.attr('prefix') || '').trim().toLowerCase();
      if (vocab.includes('schema.org')) {
        hasSchemaVocab = true;
      } else if (prefix.includes('schema:') && prefix.includes('schema.org')) {
        hasSchemaVocab = true;
      }
      const parentNode: any = current.parent();
      current = parentNode.length && parentNode.get(0)?.type === 'tag' ? parentNode : null;
    }

    const entityId = ($(elem).attr('resource') || $(elem).attr('about') || '').trim() || undefined;

    rawTypeof.split(/\s+/).forEach(t => {
      let isSchema = false;
      if (isSchemaOrgUrl(t)) {
        isSchema = true;
      } else if (/^schema:/i.test(t)) {
        isSchema = true;
      } else if (hasSchemaVocab) {
        isSchema = true;
      }

      if (isSchema) {
        const norm = normalizeSchemaType(t);
        if (norm) {
          rdfaTypesSet.add(norm);
          rdfaDetails.push({
            type: norm,
            format: 'RDFa',
            source: 'typeof',
            entityId,
          });
        }
      }
    });
  });

  const microdataArr = Array.from(microdataTypesSet);
  const rdfaArr = Array.from(rdfaTypesSet);
  const uniqueSchemaTypes = Array.from(new Set([...jsonLdTypes, ...microdataArr, ...rdfaArr]));

  // Deduplicate details by type + format
  const allDetails = [...jsonLdDetails, ...microdataDetails, ...rdfaDetails];
  const typesWithDetailsMap = new Map<string, SchemaTypeDetail>();
  allDetails.forEach(d => {
    const key = `${d.type}|${d.format}`;
    if (!typesWithDetailsMap.has(key)) {
      typesWithDetailsMap.set(key, d);
    }
  });
  const typesWithDetails = Array.from(typesWithDetailsMap.values());

  const jsonLdStatus: EvidenceStatus = rawSchemaBlocks.length > 0 ? 'FOUND' : domInspected ? 'NOT_FOUND' : 'UNVERIFIED';
  const microdataStatus: EvidenceStatus = microdataArr.length > 0 ? 'FOUND' : domInspected ? 'NOT_FOUND' : 'UNVERIFIED';
  const rdfaStatus: EvidenceStatus = rdfaArr.length > 0 ? 'FOUND' : domInspected ? 'NOT_FOUND' : 'UNVERIFIED';

  const formatsDetected: ('json-ld' | 'microdata' | 'rdfa')[] = [];
  if (jsonLdStatus === 'FOUND') formatsDetected.push('json-ld');
  if (microdataStatus === 'FOUND') formatsDetected.push('microdata');
  if (rdfaStatus === 'FOUND') formatsDetected.push('rdfa');

  const overallSdStatus: EvidenceStatus = formatsDetected.length > 0 ? 'FOUND' : domInspected ? 'NOT_FOUND' : 'UNVERIFIED';

  const structuredDataEvidence: StructuredDataEvidence = {
    status: overallSdStatus,
    formatsDetected,
    types: uniqueSchemaTypes,
    typesWithDetails,
    schemaOrgName,
    jsonLd: {
      status: jsonLdStatus,
      count: rawSchemaBlocks.length,
      types: jsonLdTypes,
      blocks: rawSchemaBlocks.slice(0, 5),
      source: 'script[type="application/ld+json"]',
      reason: jsonLdStatus === 'UNVERIFIED' ? (inspectionReason || 'DOM unavailable') : undefined,
    },
    microdata: {
      status: microdataStatus,
      count: microdataArr.length,
      types: microdataArr,
      source: '[itemscope][itemtype]',
      reason: microdataStatus === 'UNVERIFIED' ? (inspectionReason || 'DOM unavailable') : undefined,
    },
    rdfa: {
      status: rdfaStatus,
      count: rdfaArr.length,
      types: rdfaArr,
      source: '[typeof]',
      reason: rdfaStatus === 'UNVERIFIED' ? (inspectionReason || 'DOM unavailable') : undefined,
    },
    source: 'DOM inspection (JSON-LD + Microdata + RDFa)',
    reason: overallSdStatus === 'UNVERIFIED' ? (inspectionReason || 'DOM unavailable') : undefined,
  };

  // 6. Entity / Publisher Link & Attribute Extraction
  const socialHosts = /(^|\.)(twitter\.com|x\.com|linkedin\.com|facebook\.com|instagram\.com|youtube\.com|github\.com|tiktok\.com|threads\.net)$/i;
  const socialProfileLinks = new Map<string, { url: string; platform: string; source: string }>();

  let foundAbout: { href: string; text: string; source: string } | null = null;
  let foundContact: { href: string; text: string; source: string } | null = null;
  let foundCareers: { href: string; text: string; source: string } | null = null;
  let authorElementFound: { name?: string; source: string } | null = null;
  let hasEmail = false;
  let hasPhone = false;

  $('a[href], button[data-href], area[href]').each((_, elem) => {
    const href = ($(elem).attr('href') || $(elem).attr('data-href') || '').trim();
    const text = $(elem).text().replace(/\s+/g, ' ').trim();
    const ariaLabel = ($(elem).attr('aria-label') || '').trim();
    const titleAttr = ($(elem).attr('title') || '').trim();
    const combinedLabel = `${text} ${ariaLabel} ${titleAttr}`.trim().toLowerCase();

    if (href.startsWith('mailto:')) {
      hasEmail = true;
    }
    if (href.startsWith('tel:')) {
      hasPhone = true;
    }

    let linkUrl: URL | null = null;
    try { linkUrl = new URL(href, targetUrl); } catch { /* ignore */ }
    const path = linkUrl ? linkUrl.pathname.toLowerCase() : href.toLowerCase();

    if (!foundAbout) {
      if (/(^|\/)(about|about-us|about_us|company|our-company|who-we-are|our-story|company\/about)(\/|$|\?|#|\.)/i.test(path) ||
          /\b(about|about\s+us|our\s+company|our\s+story|who\s+we\s+are|company\s+overview|learn\s+about\s+us)\b/i.test(combinedLabel)) {
        foundAbout = { href, text: text || ariaLabel || titleAttr || 'About', source: `a[href="${href}"]` };
      }
    }

    if (!foundContact) {
      if (/(^|\/)(contact|contact-us|contact_us|get-in-touch|support|help\/contact)(\/|$|\?|#|\.)/i.test(path) ||
          href.startsWith('mailto:') ||
          /\b(contact|contact\s+us|get\s+in\s+touch|talk\s+to\s+us|reach\s+us|support|customer\s+support|help\s+desk)\b/i.test(combinedLabel)) {
        foundContact = { href, text: text || ariaLabel || titleAttr || 'Contact', source: `a[href="${href}"]` };
      }
    }

    if (!foundCareers) {
      if (/(^|\/)(careers|jobs|join-us|work-with-us)(\/|$|\?|#|\.)/i.test(path) ||
          /\b(careers|jobs|join\s+us|work\s+with\s+us|we're\s+hiring|open\s+positions)\b/i.test(combinedLabel)) {
        foundCareers = { href, text: text || ariaLabel || titleAttr || 'Careers', source: `a[href="${href}"]` };
      }
    }

    if (linkUrl) {
      const host = linkUrl.hostname.toLowerCase().replace(/^www\./, '');
      const targetHost = parsedTargetUrl.hostname.toLowerCase().replace(/^www\./, '');
      if (socialHosts.test(host) && host !== targetHost) {
        const platform = host.split('.')[0];
        if (!socialProfileLinks.has(linkUrl.toString())) {
          socialProfileLinks.set(linkUrl.toString(), { url: linkUrl.toString(), platform, source: `a[href="${href}"]` });
        }
      }
    }
  });

  // Check email in body text if not found in mailto
  if (!hasEmail) {
    const bodyText = $('body').text();
    const emailMatch = bodyText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
    if (emailMatch && !/\.(png|jpg|jpeg|gif|svg|webp|js|css|d\.ts)$/i.test(emailMatch[0])) {
      hasEmail = true;
    }
  }

  // Include social profile URLs from Schema.org sameAs links
  sameAsLinks.forEach(link => {
    try {
      const u = new URL(link, targetUrl);
      const host = u.hostname.toLowerCase().replace(/^www\./, '');
      const targetHost = parsedTargetUrl.hostname.toLowerCase().replace(/^www\./, '');
      if (socialHosts.test(host) && host !== targetHost) {
        const platform = host.split('.')[0];
        if (!socialProfileLinks.has(u.toString())) {
          socialProfileLinks.set(u.toString(), { url: u.toString(), platform, source: 'schema sameAs' });
        }
      }
    } catch { /* ignore */ }
  });

  // Author signal
  if (jsonLdAuthor) {
    authorElementFound = { name: authorName || 'JSON-LD Author', source: 'script[type="application/ld+json"]' };
  } else if ($('meta[name="author" i]').length > 0) {
    const val = $('meta[name="author" i]').attr('content')?.trim();
    authorElementFound = { name: val || 'Meta Author', source: 'meta[name="author"]' };
  } else if ($('[rel="author"], [itemprop="author"], .author, .byline, [class*="byline"]').length > 0) {
    const text = $('[rel="author"], [itemprop="author"], .author, .byline').first().text().trim();
    authorElementFound = { name: text || 'Author element', source: 'DOM element (.author / rel="author")' };
  }

  const dateSignalFound = jsonLdDate || $('meta[property="article:published_time" i], meta[property="article:modified_time" i], [itemprop="datePublished"], [itemprop="dateModified"], time[datetime]').length > 0;
  const dateVal = $('time[datetime]').attr('datetime') || $('meta[property="article:published_time" i]').attr('content') || null;

  // Copyright signal
  let copyrightText: string | null = null;
  let copyrightHolder: string | null = null;
  const footerText = $('footer, .footer, #footer, [class*="copyright"], [id*="copyright"]').text().replace(/\s+/g, ' ').trim() || $('body').text().replace(/\s+/g, ' ').trim();
  const cpMatch = footerText.match(/([©\u00a9]|copyright|\(c\))\s*(?:(?:19|20)\d{2}\s*[-–—]?\s*)?(?:(?:19|20)\d{2}\s*)?([^.,;\n\r<]{2,60})/i);
  if (cpMatch) {
    copyrightText = cpMatch[0].trim();
    const rawHolder = cpMatch[2].replace(/\b(all\s+rights\s+reserved|reserved)\b/gi, '').replace(/[.,;]+$/, '').trim();
    if (rawHolder && rawHolder.length >= 2 && rawHolder.length <= 50) {
      copyrightHolder = rawHolder;
    }
  }

  // Publisher signal
  const publisherFound = jsonLdPublisher || !!schemaOrgName || !!copyrightHolder || $('meta[name="publisher" i]').length > 0;
  const publisherVal = publisherName || schemaOrgName || copyrightHolder || $('meta[name="publisher" i]').attr('content') || null;

  // Organization Identity & Confidence Calculation
  const orgSources: string[] = [];
  let detectedOrgName: string | null = null;

  if (schemaOrgName) {
    detectedOrgName = schemaOrgName;
    orgSources.push('schema');
  }
  if (ogSiteName) {
    if (!detectedOrgName) detectedOrgName = ogSiteName;
    orgSources.push('og:site_name');
  }
  if (copyrightHolder) {
    if (!detectedOrgName) detectedOrgName = copyrightHolder;
    orgSources.push('copyright');
  }
  if ($('meta[name="publisher" i]').length > 0) {
    orgSources.push('meta[name="publisher"]');
  }

  let hostRoot = '';
  try { hostRoot = parsedTargetUrl.hostname.toLowerCase().replace(/^www\./, '').split('.')[0]; } catch { /* ignore */ }
  if (titleStr && hostRoot && hostRoot.length >= 3) {
    const titleSegs = titleStr.split(/\s+[|\u2013\u2014\u00b7\u2022\-:]\s+/);
    const titleMatch = titleSegs.find(s => s.toLowerCase().includes(hostRoot));
    if (titleMatch) {
      if (!detectedOrgName) detectedOrgName = titleMatch.trim();
      orgSources.push('title');
    }
  }

  let orgConfidence: import('@/types/audit').EntityConfidenceTier = 'none';
  if (detectedOrgName) {
    const strongSources = orgSources.filter(s => s === 'schema' || s === 'og:site_name' || s === 'copyright');
    if (strongSources.length >= 2 || (schemaOrgName && (foundAbout || foundContact || socialProfileLinks.size > 0))) {
      orgConfidence = 'strong';
    } else if (strongSources.length >= 1 || orgSources.length >= 2) {
      orgConfidence = 'moderate';
    } else {
      orgConfidence = 'weak';
    }
  }

  type LinkEv = { href: string; text: string; source: string };

  const targetAbout = foundAbout as LinkEv | null;
  const aboutSignal: BaseEvidenceSignal<LinkEv> = targetAbout
    ? { status: 'FOUND', value: targetAbout, source: targetAbout.source }
    : domInspected ? { status: 'NOT_FOUND', value: null, source: 'body' } : { status: 'UNVERIFIED', value: null, reason: inspectionReason || 'DOM unavailable' };

  const targetContact = foundContact as LinkEv | null;
  const contactSignal: BaseEvidenceSignal<LinkEv> = targetContact
    ? { status: 'FOUND', value: targetContact, source: targetContact.source }
    : domInspected ? { status: 'NOT_FOUND', value: null, source: 'body' } : { status: 'UNVERIFIED', value: null, reason: inspectionReason || 'DOM unavailable' };

  const targetCareers = foundCareers as LinkEv | null;
  const careersSignal: BaseEvidenceSignal<LinkEv> = targetCareers
    ? { status: 'FOUND', value: targetCareers, source: targetCareers.source }
    : domInspected ? { status: 'NOT_FOUND', value: null, source: 'body' } : { status: 'UNVERIFIED', value: null, reason: inspectionReason || 'DOM unavailable' };

  const socialLinksArr = Array.from(socialProfileLinks.values());
  const socialSignal = socialLinksArr.length > 0
    ? { status: 'FOUND' as EvidenceStatus, links: socialLinksArr, source: 'a[href] / schema' }
    : domInspected ? { status: 'NOT_FOUND' as EvidenceStatus, links: [], source: 'body' } : { status: 'UNVERIFIED' as EvidenceStatus, links: [], reason: inspectionReason || 'DOM unavailable' };

  const authorSignal: BaseEvidenceSignal<{ name?: string; source: string }> = authorElementFound
    ? { status: 'FOUND', value: authorElementFound, source: authorElementFound.source }
    : domInspected ? { status: 'NOT_FOUND', value: null, source: 'body' } : { status: 'UNVERIFIED', value: null, reason: inspectionReason || 'DOM unavailable' };

  const publisherSignal: BaseEvidenceSignal<{ name?: string; source: string }> = publisherFound
    ? { status: 'FOUND', value: { name: publisherVal || undefined, source: 'schema / meta / copyright' }, source: 'schema / meta / copyright' }
    : domInspected ? { status: 'NOT_FOUND', value: null, source: 'body' } : { status: 'UNVERIFIED', value: null, reason: inspectionReason || 'DOM unavailable' };

  const dateSignal: BaseEvidenceSignal<{ date?: string; source: string }> = dateSignalFound
    ? { status: 'FOUND', value: { date: dateVal || undefined, source: 'meta / time tag' }, source: 'meta / time tag' }
    : domInspected ? { status: 'NOT_FOUND', value: null, source: 'body' } : { status: 'UNVERIFIED', value: null, reason: inspectionReason || 'DOM unavailable' };

  const uniqueSameAs = Array.from(new Set(sameAsLinks)).slice(0, 20);
  const sameAsSignal: BaseEvidenceSignal<string[]> = uniqueSameAs.length > 0
    ? { status: 'FOUND', value: uniqueSameAs, source: 'schema / microdata' }
    : domInspected ? { status: 'NOT_FOUND', value: [], source: 'schema' } : { status: 'UNVERIFIED', value: [], reason: inspectionReason || 'DOM unavailable' };

  const copyrightSignal: BaseEvidenceSignal<{ text: string; holder?: string; source: string }> = copyrightText
    ? { status: 'FOUND', value: { text: copyrightText, holder: copyrightHolder || undefined, source: 'footer / body' }, source: 'footer / body' }
    : domInspected ? { status: 'NOT_FOUND', value: null, source: 'body' } : { status: 'UNVERIFIED', value: null, reason: inspectionReason || 'DOM unavailable' };

  const emailSignal: BaseEvidenceSignal<boolean> = hasEmail
    ? { status: 'FOUND', value: true, source: 'mailto / body text' }
    : domInspected ? { status: 'NOT_FOUND', value: false, source: 'body' } : { status: 'UNVERIFIED', value: false, reason: inspectionReason || 'DOM unavailable' };

  const phoneSignal: BaseEvidenceSignal<boolean> = hasPhone
    ? { status: 'FOUND', value: true, source: 'tel / body text' }
    : domInspected ? { status: 'NOT_FOUND', value: false, source: 'body' } : { status: 'UNVERIFIED', value: false, reason: inspectionReason || 'DOM unavailable' };

  const orgIdentitySignal = {
    status: orgConfidence !== 'none' ? ('FOUND' as EvidenceStatus) : domInspected ? ('NOT_FOUND' as EvidenceStatus) : ('UNVERIFIED' as EvidenceStatus),
    name: detectedOrgName,
    confidence: orgConfidence,
    sources: orgSources,
  };

  const overallEpStatus: EvidenceStatus = (
    aboutSignal.status === 'FOUND' ||
    contactSignal.status === 'FOUND' ||
    careersSignal.status === 'FOUND' ||
    socialSignal.status === 'FOUND' ||
    authorSignal.status === 'FOUND' ||
    publisherSignal.status === 'FOUND' ||
    orgIdentitySignal.status === 'FOUND' ||
    copyrightSignal.status === 'FOUND'
  ) ? 'FOUND' : domInspected ? 'NOT_FOUND' : 'UNVERIFIED';

  const entityPublisherEvidence: EntityPublisherEvidence = {
    status: overallEpStatus,
    aboutLink: aboutSignal,
    contactLink: contactSignal,
    careersLink: careersSignal,
    socialProfiles: socialSignal,
    authorSignal,
    publisherSignal,
    dateSignal,
    sameAsLinks: sameAsSignal,
    copyrightSignal,
    emailContact: emailSignal,
    phoneContact: phoneSignal,
    organizationIdentity: orgIdentitySignal,
  };

  const evidenceState: PageEvidenceState = {
    headInspected,
    domInspected,
    head: headMetadataEvidence,
    headings: headingEvidence,
    structuredData: structuredDataEvidence,
    entityPublisher: entityPublisherEvidence,
  };

  // 7. Clean Visible Main Body Text & Word Count
  const wordMetrics = extractWordCountMetrics(html);
  const rawText = wordMetrics.mainContentText;
  const wordCount = wordMetrics.totalWordCount;
  const totalWordCount = wordMetrics.totalWordCount;
  const mainContentWordCount = wordMetrics.mainContentWordCount;
  const bodyClone = $('body').clone();
  bodyClone.find('script, style, svg, noscript, nav, footer, iframe').remove();

  // 8. Images Analysis
  let totalImages = 0;
  let missingAltCount = 0;
  const imagesWithoutAlt: { src: string; alt: string }[] = [];

  $('img').each((_, elem) => {
    totalImages++;
    const alt = $(elem).attr('alt');
    const src = $(elem).attr('src') || $(elem).attr('data-src') || '';
    if (alt === undefined || alt.trim() === '') {
      missingAltCount++;
      if (imagesWithoutAlt.length < 5) {
        imagesWithoutAlt.push({ src: src.slice(0, 100), alt: '' });
      }
    }
  });

  // 9. Links Counts Analysis
  let internalLinksCount = 0;
  let externalLinksCount = 0;

  $('a[href]').each((_, elem) => {
    const href = $(elem).attr('href')?.trim();
    if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
      try {
        const linkUrl = new URL(href, targetUrl);
        if (linkUrl.hostname === parsedTargetUrl.hostname) {
          internalLinksCount++;
        } else {
          externalLinksCount++;
        }
      } catch {
        // Invalid link format ignored
      }
    }
  });

  // 10. Paragraph & Content Structure Analysis
  const countWords = (t: string) => (t ? t.split(/\s+/).filter(Boolean).length : 0);
  let paragraphCount = 0;
  let answerFriendlyParagraphs = 0;
  let longParagraphs = 0;
  let firstParagraphText = '';
  bodyClone.find('p').each((_, elem) => {
    const t = $(elem).text().replace(/\s+/g, ' ').trim();
    const wc = countWords(t);
    if (wc === 0) return;
    paragraphCount++;
    if (wc >= 15 && wc <= 80) answerFriendlyParagraphs++;
    if (wc > 150) longParagraphs++;
    if (!firstParagraphText && wc >= 8) firstParagraphText = t.slice(0, 600);
  });
  const listCount = bodyClone.find('ul, ol, dl').filter((_, el) => $(el).find('li, dt').length >= 2).length;
  const tableCount = bodyClone.find('table').length;

  let introText = '';
  const firstH1 = $('h1').filter((_, el) => $(el).text().trim().length > 0).first();
  if (firstH1.length) {
    let node: any = firstH1;
    for (let level = 0; level < 4 && countWords(introText) < 25 && node && node.length; level++) {
      let sib = node.next();
      let guard = 0;
      while (sib.length && guard < 8 && countWords(introText) < 25) {
        guard++;
        const tag = (sib.get(0)?.tagName || '').toLowerCase();
        if (/^h[1-2]$/.test(tag)) break;
        if (!['script', 'style', 'noscript', 'svg', 'nav', 'footer'].includes(tag)) {
          const c = sib.clone();
          c.find('script, style, noscript, svg, nav').remove();
          const t = c.text().replace(/\s+/g, ' ').trim();
          if (t) introText = `${introText} ${t}`.trim();
        }
        sib = sib.next();
      }
      node = node.parent();
      if (node.is('body') || node.is('html')) break;
    }
    introText = introText.slice(0, 600);
  }

  const formCount = $('form').length;
  const hasPasswordInput = $('input[type="password" i]').length > 0;
  const interactiveElementCount =
    $('button').length + $('input:not([type="hidden" i])').length + $('select').length + $('textarea').length;

  const htmlLang = $('html').attr('lang')?.trim() || null;

  return {
    statusCode,
    url: targetUrl,
    finalUrl: targetUrl,
    title: titleSignal.value || null,
    titleLength: titleSignal.value ? titleSignal.value.length : 0,
    metaDescription: descSignal.value || null,
    metaDescriptionLength: descSignal.value ? descSignal.value.length : 0,
    canonical: canonicalSignal.value || null,
    robotsMeta: robotsSignal.value || null,
    headings: pageHeadings,
    h1Count,
    mainBodyText: rawText.slice(0, 8000),
    wordCount,
    totalWordCount,
    mainContentWordCount,
    structuredDataTypes: uniqueSchemaTypes,
    rawSchemaBlocks: rawSchemaBlocks.slice(0, 5),
    totalImages,
    missingAltCount,
    imagesWithoutAlt,
    internalLinksCount,
    externalLinksCount,
    hasHttps: parsedTargetUrl.protocol === 'https:',
    hasViewportMeta: viewportSignal.status === 'FOUND',
    renderedDom: isRendered,
    ogTitle,
    ogDescription,
    ogSiteName,
    ogType,
    htmlLang,
    microdataTypes: microdataArr,
    rdfaTypes: rdfaArr,
    hasJsonLd: jsonLdStatus === 'FOUND',
    schemaOrgName,
    sameAsLinks: uniqueSameAs,
    socialProfileLinks: socialLinksArr.map(l => l.url),
    hasAboutLink: aboutSignal.status === 'FOUND',
    hasContactLink: contactSignal.status === 'FOUND',
    hasCareersLink: careersSignal.status === 'FOUND',
    hasAuthorSignal: authorSignal.status === 'FOUND',
    hasPublisherSignal: publisherSignal.status === 'FOUND',
    hasDateSignal: dateSignal.status === 'FOUND',
    organizationName: orgIdentitySignal.name,
    organizationConfidence: orgIdentitySignal.confidence,
    copyrightText: copyrightSignal.value?.text || null,
    copyrightHolder: copyrightSignal.value?.holder || null,
    hasEmailContact: emailSignal.status === 'FOUND',
    hasPhoneContact: phoneSignal.status === 'FOUND',
    introText,
    firstParagraphText,
    paragraphCount,
    answerFriendlyParagraphs,
    longParagraphs,
    listCount,
    tableCount,
    formCount,
    hasPasswordInput,
    interactiveElementCount,
    evidenceState,
  };
}

