import { AuditFinding, PageStructureData, SearchVisibilityData } from '@/types/audit';
import { getGeminiClient } from '../gemini-client';
import { detectBrand, inferPageType, PAGE_TYPE_LABEL, recommendSchemaTypes, UTILITY_PAGE_TYPES } from '../page-context';
import { makeFinding } from './finding-utils';

export interface AnalysisEngineResult {
  aiReadabilityFindings: AuditFinding[];
  contentIntentFindings: AuditFinding[];
  citationReadinessFindings: AuditFinding[];
  executiveSummary: {
    headline: string;
    overview: string;
    visibilityVsReadabilityStatus: string;
  };
}

/**
 * Evaluates AI Readability, Content & Intent Alignment, and Citation Readiness.
 * Uses Gemini structured evaluation when GEMINI_API_KEY is available,
 * with deterministic contextual heuristic fallbacks when offline.
 */
export async function evaluateAiReadabilityAndContent(
  structure: PageStructureData,
  searchData: SearchVisibilityData
): Promise<AnalysisEngineResult> {
  const gemini = getGeminiClient();

  if (gemini) {
    try {
      const result = await runGeminiEvaluation(gemini, structure, searchData);
      if (result) return result;
    } catch (err) {
      console.warn('[AI Evaluation Engine] Gemini prompt call failed, falling back to heuristics:', err);
    }
  }

  // Contextual heuristic evaluation fallback
  return runHeuristicEvaluation(structure, searchData);
}

/**
 * Structured Gemini LLM Evaluation
 */
async function runGeminiEvaluation(
  gemini: any,
  structure: PageStructureData,
  searchData: SearchVisibilityData
): Promise<AnalysisEngineResult | null> {
  const pageType = structure.pageType || inferPageType(structure);
  const pageLabel = PAGE_TYPE_LABEL[pageType];

  const totalWords = structure.totalWordCount ?? structure.wordCount;
  const mainWords = structure.mainContentWordCount ?? structure.wordCount;

  const prompt = `
You are an expert AI Search & Readability Auditor evaluating a webpage.

URL: ${structure.url}
Page Type: ${pageLabel} (${pageType})
Page Title: ${structure.title || 'N/A'}
Meta Description: ${structure.metaDescription || 'N/A'}
Total Visible Word Count: ${totalWords}
Main Content Word Count: ${mainWords}
All Structured Data Types (JSON-LD, Microdata, RDFa): ${JSON.stringify(structure.structuredDataTypes)}
Headings: ${JSON.stringify(structure.headings.slice(0, 15))}
Search Query Evaluated: ${searchData.queryUsed}
Intro text below H1: ${structure.introText || 'N/A'}
Main Body Text Sample:
${structure.mainBodyText.slice(0, 3000)}

Perform a strict evaluation across 3 categories:
1. AI Readability: Is the page purpose clearly defined near the H1 (if H1 exists)? Is heading hierarchy clear? Are paragraphs concise and answer-friendly?
   CRITICAL RULE: DO NOT evaluate "definition below H1" if no H1 exists!
2. Content & Intent: Does content fulfill search intent for "${searchData.queryUsed}" without flippant word count penalties? Note page type (${pageLabel}). Login, app, or dashboard pages with brief text are NORMAL.
3. Citation Readiness: Are there machine-readable or visible entity signals (brand, organization, author, sameAs, about/contact links)?
   CRITICAL RULE: Structured data is ONLY ONE SIGNAL. Do NOT claim "AI systems require schema to cite pages" or "No JSON-LD = poor citation probability".

Return ONLY valid JSON matching this exact structure:
{
  "executiveSummary": {
    "headline": "Short punchy summary line",
    "overview": "2-3 sentences explaining overall page state (clearly stating ${totalWords} total visible words across page structure)",
    "visibilityVsReadabilityStatus": "Clear explanation connecting search discoverability with AI readability"
  },
  "findings": [
    {
      "id": "ai-finding-id",
      "category": "ai_readability" | "content_intent" | "citation_readiness",
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO",
      "title": "Clear finding title",
      "location": "e.g. Below H1 / Section 2",
      "observed": "Observed issue text",
      "expected": "Expected improvement",
      "context": "Contextual reasoning (e.g. page type)",
      "whyItMatters": "Why AI models/search engines benefit from this",
      "recommendedFix": "Concrete fix instruction",
      "expectedImpact": "Expected benefit",
      "confidence": 0.9,
      "deductionPoints": 3
    }
  ]
}
`;

  const response = await gemini.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
    },
  });

  const rawText = response.text || '';
  if (!rawText) return null;

  const parsed = JSON.parse(rawText);
  const rawFindings: any[] = parsed.findings || [];

  const aiReadabilityFindings: AuditFinding[] = [];
  const contentIntentFindings: AuditFinding[] = [];
  const citationReadinessFindings: AuditFinding[] = [];

  const h1Status = structure.evidenceState?.headings.h1Status;
  const sdStatus = structure.evidenceState?.structuredData.status;
  const hasH1 = h1Status === 'FOUND' && structure.headings.some(h => h.level === 'h1');

  const isRenderedDom = structure.renderedDom ?? true;
  const isUnverifiedShell = !isRenderedDom && mainWords < 15;

  rawFindings.forEach((f, idx) => {
    // Enforcement: DO NOT allow weak definition below H1 if no H1 exists or H1 is UNVERIFIED
    if (!hasH1 && f.id && f.id.includes('weak-page-definition')) return;
    // Enforcement: DO NOT allow missing schema findings if sdStatus is UNVERIFIED
    if (sdStatus === 'UNVERIFIED' && f.id && (f.id.includes('schema') || f.id.includes('citation-unattributed') || f.id.includes('missing-recommended-schema'))) return;
    // Enforcement: DO NOT allow thin content penalties if content depth is UNVERIFIED
    if (isUnverifiedShell && f.id && (f.id.includes('thin-word-count') || f.id.includes('utility-empty') || f.id.includes('content-depth'))) return;

    const category = f.category || 'ai_readability';
    const finding = makeFinding({
      id: f.id || `ai-${category}-${idx}`,
      category,
      severity: f.severity || 'MEDIUM',
      title: f.title || 'Readability Optimization Opportunity',
      evidence: {
        source: 'analysis',
        location: f.location || 'Body content',
        observed: f.observed || 'Vague description',
        expected: f.expected || 'Clear definition',
      },
      context: f.context || `Page type: ${pageLabel}`,
      whyItMatters: f.whyItMatters || 'AI models rely on clear structure.',
      recommendedFix: f.recommendedFix || 'Add clear, structured content.',
      expectedImpact: f.expectedImpact || 'Increased machine readability.',
      confidence: typeof f.confidence === 'number' ? f.confidence : 0.85,
      deductionPoints: typeof f.deductionPoints === 'number' ? f.deductionPoints : 3,
    });

    if (category === 'content_intent') contentIntentFindings.push(finding);
    else if (category === 'citation_readiness') citationReadinessFindings.push(finding);
    else aiReadabilityFindings.push(finding);
  });

  let overviewText: string;
  if (!isRenderedDom && totalWords === 0) {
    overviewText = `The ${pageLabel} at ${structure.url} was inspected via initial static HTML shell (0 visible words extracted prior to client-side JS rendering).`;
  } else if (!isRenderedDom && totalWords < 15) {
    overviewText = `The ${pageLabel} at ${structure.url} was inspected via initial static HTML payload (${totalWords} visible words extracted prior to client-side JS rendering).`;
  } else {
    overviewText = `The ${pageLabel} at ${structure.url} contains ${totalWords} total visible words (${mainWords} main-content words) across ${structure.headings.length} headings.`;
  }

  const geminiOverview = parsed.executiveSummary?.overview;
  const finalOverview = (!isRenderedDom && totalWords < 15) ? overviewText : (geminiOverview || overviewText);

  return {
    aiReadabilityFindings,
    contentIntentFindings,
    citationReadinessFindings,
    executiveSummary: {
      headline: parsed.executiveSummary?.headline || 'Page Audited for Search and AI Visibility',
      overview: finalOverview,
      visibilityVsReadabilityStatus: parsed.executiveSummary?.visibilityVsReadabilityStatus || 'The page structure has been evaluated for AI crawler extractability.',
    },
  };
}

/**
 * Contextual Heuristic Evaluation (Used when offline or no API key)
 */
function runHeuristicEvaluation(
  structure: PageStructureData,
  searchData: SearchVisibilityData
): AnalysisEngineResult {
  const aiReadabilityFindings: AuditFinding[] = [];
  const contentIntentFindings: AuditFinding[] = [];
  const citationReadinessFindings: AuditFinding[] = [];

  const pageType = structure.pageType || inferPageType(structure);
  const pageLabel = PAGE_TYPE_LABEL[pageType];
  const isUtility = UTILITY_PAGE_TYPES.includes(pageType);

  const totalWords = structure.totalWordCount ?? structure.wordCount;
  const mainWords = structure.mainContentWordCount ?? structure.wordCount;
  const isRenderedDom = structure.renderedDom ?? true;
  const isUnverifiedShell = !isRenderedDom && mainWords < 15;

  // ----------------------------------------------------
  // 1. AI READABILITY EVALUATION
  // ----------------------------------------------------
  const headingsStatus = structure.evidenceState?.headings.status;
  const h1Status = structure.evidenceState?.headings.h1Status;
  const domInspected = structure.evidenceState?.domInspected ?? true;

  const firstH1 = structure.headings.find(h => h.level === 'h1');
  const hasValidH1 = h1Status === 'FOUND' && !!firstH1;

  // Rule 1: Definition Below H1 (STRICT DEPENDENCY: ONLY IF H1 EXISTS & IS FOUND)
  if (hasValidH1 && firstH1 && !isUtility) {
    const intro = (structure.introText || '').trim();
    const introWords = intro ? intro.split(/\s+/).length : 0;
    if (introWords < 12) {
      aiReadabilityFindings.push(makeFinding({
        id: 'ai-weak-page-definition',
        category: 'ai_readability',
        severity: 'MEDIUM',
        title: 'Weak Primary Page Definition Immediately Below H1',
        evidence: {
          source: 'analysis',
          location: `Below <h1> ("${firstH1.text.slice(0, 40)}")`,
          observed: introWords > 0 ? `Intro text below H1 is brief (${introWords} words): "${intro.slice(0, 100)}..."` : 'No introductory summary or lead paragraph directly following H1 heading.',
          expected: 'A clear, 1-2 sentence core definition or purpose statement immediately under the primary H1.',
        },
        context: `Evaluated because primary <h1> exists on this ${pageLabel}.`,
        whyItMatters: 'AI answer systems often extract the lead paragraph following the primary heading to generate direct summaries.',
        recommendedFix: 'Place a concise 1-2 sentence summary directly under the H1 stating what this page offers.',
        expectedImpact: 'Improves AI answer engine summary extraction accuracy.',
        confidence: 0.85,
        deductionPoints: 3,
      }));
    }
  }

  // Rule 2: Heading Subheadings Check (CONTEXTUAL BY PAGE TYPE & WORD COUNT)
  if (domInspected && headingsStatus !== 'UNVERIFIED') {
    const h2Count = structure.headings.filter(h => h.level === 'h2').length;
    let expectH2 = false;

    if (pageType === 'article' || pageType === 'documentation') {
      expectH2 = mainWords >= 500 && (structure.paragraphCount || 0) >= 4;
    } else if (pageType === 'product' || pageType === 'category' || pageType === 'job' || pageType === 'profile' || pageType === 'other') {
      expectH2 = mainWords >= 600 && (structure.paragraphCount || 0) >= 5;
    } else if (pageType === 'homepage') {
      expectH2 = mainWords >= 800 && (structure.paragraphCount || 0) >= 6;
    }

    if (h2Count === 0 && expectH2) {
      aiReadabilityFindings.push(makeFinding({
        id: 'ai-missing-h2-subheadings',
        category: 'ai_readability',
        severity: 'LOW',
        title: 'Lack of Structural <h2> Subheadings',
        evidence: {
          source: 'fetch',
          location: 'body > h2',
          observed: `0 <h2> section headings found across ${mainWords} main-content words and ${structure.paragraphCount || 0} paragraphs.`,
          expected: 'Descriptive <h2> subheadings organizing major content sections.',
        },
        context: `Detected page type: ${pageLabel}. Long content pages benefit from semantic section division.`,
        whyItMatters: 'Descriptive subheadings can make long content easier for search engines, assistive technologies, and answer systems to interpret.',
        recommendedFix: 'Divide major content sections with descriptive <h2> headings every 150-300 words.',
        expectedImpact: 'Clearer semantic section division for AI answer systems.',
        confidence: 0.85,
        deductionPoints: 2,
      }));
    }
  }

  // Rule 3: Paragraph Answer-Friendliness
  if (structure.paragraphCount && structure.paragraphCount >= 4) {
    if (structure.answerFriendlyParagraphs === 0 && structure.longParagraphs && structure.longParagraphs >= 2) {
      aiReadabilityFindings.push(makeFinding({
        id: 'ai-dense-paragraphs',
        category: 'ai_readability',
        severity: 'LOW',
        title: 'Dense Paragraph Blocks',
        evidence: {
          source: 'analysis',
          location: 'body > p',
          observed: `${structure.longParagraphs} paragraphs exceed 150 words with no 15-80 word summary paragraphs.`,
          expected: 'Answer-friendly paragraphs (15-80 words) for key concepts.',
        },
        context: 'Long block paragraphs are harder for answer engines to extract cleanly without truncation.',
        whyItMatters: 'Concise paragraphs allow AI systems to extract standalone direct answers.',
        recommendedFix: 'Break long paragraphs into focused 2-3 sentence blocks summarizing key facts.',
        expectedImpact: 'Easier snippet extraction for conversational search.',
        confidence: 0.75,
        deductionPoints: 1,
      }));
    }
  }

  // ----------------------------------------------------
  // 2. CONTENT & INTENT EVALUATION (CONTEXTUAL THIN CONTENT)
  // ----------------------------------------------------
  if (!isUnverifiedShell) {
    if (isUtility) {
      // Utility pages (login, app, dashboard) are NOT flagged for low word count!
      if (mainWords < 15) {
        contentIntentFindings.push(makeFinding({
          id: 'content-utility-empty',
          category: 'content_intent',
          severity: 'LOW',
          title: 'Minimal Body Content on Application Page',
          evidence: {
            source: 'fetch',
            location: 'body text',
            observed: `Main content text contains ${mainWords} words.`,
            expected: 'Clear UI labels and basic usage instructions.',
          },
          context: `Detected page type: ${pageLabel}. Interactive application surfaces naturally have low word counts and are not expected to be long articles.`,
          whyItMatters: 'UI components should provide sufficient labels for accessibility and search engine context.',
          recommendedFix: 'Ensure main UI buttons, forms, and actions have clear aria-labels or visual heading titles.',
          expectedImpact: 'Better accessibility and UI clarity.',
          confidence: 0.7,
          deductionPoints: 1,
        }));
      }
    } else {
      // Editorial / informative / commercial pages
      const minExpectedWords = pageType === 'article' || pageType === 'documentation' ? 400 : 150;
      if (mainWords < minExpectedWords) {
        const isArticle = pageType === 'article' || pageType === 'documentation';
        contentIntentFindings.push(makeFinding({
          id: 'content-thin-word-count',
          category: 'content_intent',
          severity: isArticle ? 'MEDIUM' : 'LOW',
          title: `Brief Page Content Depth (${mainWords} main-content words)`,
          evidence: {
            source: 'fetch',
            location: 'body text',
            observed: `Main content text contains ${mainWords} words (total visible page text: ${totalWords} words).`,
            expected: `Comprehensive main content depth (at least ${minExpectedWords} words for a ${pageLabel}).`,
          },
          context: `Detected page type: ${pageLabel}. Word count alone is not an SEO flaw, but brief informative pages may lack sufficient depth for competitive queries.`,
          whyItMatters: 'Pages with thorough coverage of user questions tend to align better with search intent.',
          recommendedFix: isArticle
            ? 'Expand the article to cover key background context, examples, or common questions related to the topic.'
            : 'Ensure the page clearly explains the core offering, key features, and primary user benefits.',
          expectedImpact: 'Greater topical completeness for target search queries.',
          confidence: 0.8,
          deductionPoints: isArticle ? 3 : 1,
        }));
      }
    }
  }

  // ----------------------------------------------------
  // 3. CITATION READINESS EVALUATION
  // ----------------------------------------------------
  const sdStatus = structure.evidenceState?.structuredData.status ?? (structure.structuredDataTypes.length > 0 ? 'FOUND' : 'NOT_FOUND');
  const schemaRec = recommendSchemaTypes(pageType, structure.structuredDataTypes);
  const { brand } = detectBrand(structure);

  const hasAnySchema = structure.structuredDataTypes.length > 0;
  const hasJsonLd = structure.hasJsonLd || false;

  // CRITICAL RULE: If structured data status is UNVERIFIED, DO NOT generate missing-schema findings or schema recommendations!
  if (sdStatus !== 'UNVERIFIED') {
    if (schemaRec.missing.length > 0) {
      const isCompletelyMissing = !hasAnySchema;
      citationReadinessFindings.push(makeFinding({
        id: isCompletelyMissing ? 'citation-unattributed-claims' : 'citation-missing-recommended-schema',
        category: 'citation_readiness',
        severity: isCompletelyMissing ? 'LOW' : 'INFO',
        title: isCompletelyMissing ? 'Relevant Structured Data Not Detected' : `Optional Secondary Structured Data Opportunity (${schemaRec.missing.join(', ')})`,
        evidence: {
          source: 'analysis',
          location: 'structured data (JSON-LD / Microdata / RDFa)',
          observed: isCompletelyMissing
            ? 'No supported Schema.org markup was found in the inspected page content.'
            : `Detected schema types (${structure.structuredDataTypes.join(', ')}), but missing optional: ${schemaRec.missing.join(', ')}.`,
          expected: `Structured data appropriate for ${pageLabel} (${schemaRec.recommended.join(', ')}).`,
        },
        context: `Detected page type: ${pageLabel}. ${schemaRec.rationale}`,
        whyItMatters: 'Structured data can provide explicit machine-readable entity and relationship signals for search engines and answer systems.',
        recommendedFix: `Consider adding ${schemaRec.missing.join(' and ')} structured data in JSON-LD format.`,
        expectedImpact: 'May support search features and clearer entity interpretation.',
        confidence: 0.85,
        deductionPoints: isCompletelyMissing ? 2 : 0,
      }));
    } else if (!hasJsonLd && hasAnySchema) {
      // Has Microdata or RDFa, but no JSON-LD
      citationReadinessFindings.push(makeFinding({
        id: 'citation-no-json-ld',
        category: 'citation_readiness',
        severity: 'INFO',
        title: 'No JSON-LD Structured Data Detected (Microdata / RDFa Present)',
        evidence: {
          source: 'fetch',
          location: '<script type="application/ld+json">',
          observed: `Detected Microdata/RDFa types: ${structure.structuredDataTypes.join(', ')}, but no JSON-LD script block.`,
          expected: 'JSON-LD format is recommended by Google and major search engines for ease of maintenance.',
        },
        context: 'Structured data is present via Microdata or RDFa. JSON-LD is preferred for easier maintenance but is functionally equivalent.',
        whyItMatters: 'JSON-LD is easier to maintain independently of HTML markup.',
        recommendedFix: 'Optional: migrate existing Microdata/RDFa markup to JSON-LD format.',
        expectedImpact: 'Simplifies structured data updates.',
        confidence: 0.8,
        deductionPoints: 0,
      }));
    }
  }

  // Check Entity & Organization signals (Multi-signal citation evaluation)
  const epStatus = structure.evidenceState?.entityPublisher.status ?? 'NOT_FOUND';

  const hasEntitySignal =
    (structure.sameAsLinks && structure.sameAsLinks.length > 0) ||
    (structure.socialProfileLinks && structure.socialProfileLinks.length > 0) ||
    structure.hasAboutLink ||
    structure.hasContactLink ||
    structure.hasCareersLink ||
    structure.schemaOrgName ||
    structure.organizationName ||
    structure.copyrightText ||
    structure.hasEmailContact;

  if (!hasEntitySignal && !isUtility && epStatus !== 'UNVERIFIED') {
    citationReadinessFindings.push(makeFinding({
      id: 'citation-weak-entity-signals',
      category: 'citation_readiness',
      severity: 'LOW',
      title: 'Limited Visible Entity & Publisher Signals',
      evidence: {
        source: 'analysis',
        location: 'footer / body links / metadata',
        observed: 'No clear organization, contact, about, or social profile signal was found in the inspected page evidence.',
        expected: 'Visible publisher identity signals (such as About, Contact, or Brand metadata).',
      },
      context: `Brand identified as "${brand}". Explicit publisher identity signals reinforce trust for search and answer engines.`,
      whyItMatters: 'Search engines and answer systems evaluate brand identity and publisher authority when attributing sources.',
      recommendedFix: `Consider adding clear links to an About page, Contact page, or organization details for ${brand}.`,
      expectedImpact: 'Helps search and answer engines verify publisher identity and source credibility.',
      confidence: 0.75,
      deductionPoints: 1,
    }));
  }

  // Executive summary status
  const visibilityVsReadabilityStatus = searchData.isSearchUnverified
    ? 'Search visibility could not be confirmed from available SERP evidence. On-page structure and entity signals have been evaluated for machine readability.'
    : searchData.targetPresentInSerp
    ? `This page ranks in top search results. Clear heading structure and entity context support its AI extractability.`
    : `This page is indexable. Optimizing semantic section headings and entity context can improve both search positioning and AI extractability.`;

  let overviewText: string;
  if (!isRenderedDom && totalWords === 0) {
    overviewText = `The ${pageLabel} at ${structure.url} was inspected via initial static HTML shell (0 visible words extracted prior to client-side JS rendering).`;
  } else if (!isRenderedDom && totalWords < 15) {
    overviewText = `The ${pageLabel} at ${structure.url} was inspected via initial static HTML payload (${totalWords} visible words extracted prior to client-side JS rendering).`;
  } else {
    overviewText = `The ${pageLabel} at ${structure.url} contains ${totalWords} total visible words (${mainWords} main-content words) across ${structure.headings.length} headings.`;
  }

  return {
    aiReadabilityFindings,
    contentIntentFindings,
    citationReadinessFindings,
    executiveSummary: {
      headline: searchData.targetPresentInSerp
        ? 'Strong Search Position with Machine-Readability Structure'
        : 'Actionable Page Optimizations for Search & AI Visibility',
      overview: overviewText,
      visibilityVsReadabilityStatus,
    },
  };
}
