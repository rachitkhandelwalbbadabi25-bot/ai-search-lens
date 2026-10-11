import * as cheerio from 'cheerio';

export interface WordCountMetrics {
  totalWordCount: number;
  mainContentWordCount: number;
  totalVisibleText: string;
  mainContentText: string;
}

/**
 * Counts words in a string in a whitespace-, punctuation-, and Unicode-consistent manner.
 * Handles repeated whitespace, tabs, newlines, and multi-word boundary punctuation.
 */
export function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  // Normalize whitespace (space, tab, newline, non-breaking space)
  const normalized = text.replace(/[\s\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+/g, ' ').trim();
  if (!normalized) return 0;

  // Split on whitespace tokens
  const tokens = normalized.split(' ');
  let count = 0;

  for (const token of tokens) {
    if (!token) continue;
    // Check if token contains printable letter/number characters (Unicode aware)
    if (/[^\s\p{P}]/u.test(token) || /[\p{L}\p{N}]/u.test(token) || /\w/u.test(token)) {
      count++;
    }
  }

  return count;
}

/**
 * Extracts visible text and main content text from HTML, returning standardized word count metrics.
 */
export function extractWordCountMetrics(html: string): WordCountMetrics {
  if (!html || typeof html !== 'string' || !html.trim()) {
    return {
      totalWordCount: 0,
      mainContentWordCount: 0,
      totalVisibleText: '',
      mainContentText: '',
    };
  }

  try {
    const $ = cheerio.load(html);

    // 1. Total Visible Text Extraction
    // Select body (or html if body does not exist)
    const bodyOrHtml = $('body').length > 0 ? $('body') : $('html');
    const totalClone = bodyOrHtml.clone();

    // Exclude scripts, styles, hidden implementation text, and non-visible elements
    totalClone
      .find('script, style, noscript, svg, iframe, template, [hidden], [style*="display: none"], [style*="display:none"], [aria-hidden="true"]')
      .remove();

    const totalVisibleText = totalClone.text().replace(/\s+/g, ' ').trim();
    const totalWordCount = countWords(totalVisibleText);

    // 2. Main Content Text Extraction
    const mainClone = bodyOrHtml.clone();

    // Exclude non-visible elements AND navigation, header, footer, cookie notices, repeated UI text
    mainClone
      .find(
        [
          'script',
          'style',
          'noscript',
          'svg',
          'iframe',
          'template',
          '[hidden]',
          '[style*="display: none"]',
          '[style*="display:none"]',
          '[aria-hidden="true"]',
          'nav',
          'footer',
          'header',
          '[role="navigation"]',
          '[role="banner"]',
          '[role="contentinfo"]',
          '[role="dialog"]',
          '.cookie-banner',
          '.cookie-consent',
          '.cookie-notice',
          '#cookie-banner',
          '.nav',
          '.navbar',
          '.site-header',
          '.site-footer',
        ].join(', ')
      )
      .remove();

    const rawMainText = mainClone.text().replace(/\s+/g, ' ').trim();

    // Deduplicate repeated UI/content fragments
    const mainContentText = deduplicateTextFragments(rawMainText);
    const mainContentWordCount = countWords(mainContentText);

    return {
      totalWordCount,
      mainContentWordCount,
      totalVisibleText,
      mainContentText,
    };
  } catch {
    return {
      totalWordCount: 0,
      mainContentWordCount: 0,
      totalVisibleText: '',
      mainContentText: '',
    };
  }
}

/**
 * Deduplicates repeated text blocks/sentences to prevent double-counting duplicate content.
 */
export function deduplicateTextFragments(text: string): string {
  if (!text) return '';

  // Split into sentence/chunk fragments
  const chunks = text.split(/(?<=[.!?])\s+/);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    // Filter out duplicate sentence chunks if they are substantial (> 10 chars)
    if (trimmed.length > 10 && seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
  }

  return result.join(' ');
}
