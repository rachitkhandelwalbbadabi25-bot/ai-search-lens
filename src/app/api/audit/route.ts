import { NextRequest, NextResponse } from 'next/server';
import { validateAndNormalizeUrl, ValidationError } from '@/lib/url-validator';
import { fetchLivePage, FetchError } from '@/lib/tinyfish-fetch';
import { extractPageEvidence } from '@/lib/evidence-extractor';
import { performTinyFishSearch } from '@/lib/tinyfish-search';
import { evaluateTechnicalSeo } from '@/lib/engines/seo-engine';
import { evaluateAiReadabilityAndContent } from '@/lib/engines/ai-readability-engine';
import { calculateAuditScores } from '@/lib/engines/scoring-engine';
import { prioritizeFindings } from '@/lib/engines/recommendation-engine';
import { inferPageType } from '@/lib/page-context';
import { classifyRedirect, traceRedirects } from '@/lib/redirect-analyzer';
import { generateSerpQueries } from '@/lib/serp-query-generator';
import { FinalAuditReport } from '@/types/audit';

export const maxDuration = 45; // 45 seconds serverless execution limit

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json().catch(() => ({}));
    const rawUrl = body.url;
    const userQuery = body.query;

    if (!rawUrl || typeof rawUrl !== 'string') {
      return NextResponse.json(
        { error: 'Enter a valid public webpage URL, such as example.com/pricing.' },
        { status: 400 }
      );
    }

    // 1. URL Validation, Normalization & Target Lock
    const targetContext = validateAndNormalizeUrl(rawUrl);
    console.log(`[Audit Started] targetUrl="${targetContext.normalizedUrl}", isRootDomain=${targetContext.isRootDomain}`);

    // 2. Parallel HTTP Redirect Trace & Live Target Page Fetch
    const [traceResult, fetchResult] = await Promise.all([
      traceRedirects(targetContext.normalizedUrl, 10, 8000),
      fetchLivePage(targetContext.normalizedUrl),
    ]);

    const finalUrl = fetchResult.url || traceResult.finalUrl || targetContext.normalizedUrl;
    const requestedNorm = targetContext.normalizedUrl.replace(/\/$/, '').toLowerCase();
    const finalNorm = finalUrl.replace(/\/$/, '').toLowerCase();
    const isRedirected = requestedNorm !== finalNorm;

    if (isRedirected) {
      targetContext.isRedirected = true;
      targetContext.finalUrl = finalUrl;
      try {
        targetContext.redirectPathname = new URL(finalUrl).pathname;
      } catch {
        targetContext.redirectPathname = finalUrl;
      }
      console.log(`[Redirect Detected] Target "${targetContext.normalizedUrl}" -> "${finalUrl}" (hops=${traceResult.hops.length})`);
    }

    const redirectAnalysis = classifyRedirect({
      requestedUrl: targetContext.normalizedUrl,
      finalUrl,
      hops: traceResult.hops,
      isLoop: traceResult.isLoop,
      traceAvailable: traceResult.traceAvailable,
    });

    // 3. Extract DOM Evidence & Metadata
    const structure = extractPageEvidence(
      fetchResult.html,
      finalUrl,
      fetchResult.statusCode,
      fetchResult.pageTitle,
      fetchResult.metaDescription,
      { renderedDom: fetchResult.viaTinyFish }
    );
    structure.isRedirected = isRedirected;
    structure.finalUrl = finalUrl;
    structure.requestedUrl = targetContext.normalizedUrl;
    structure.redirect = redirectAnalysis;
    structure.renderedDom = fetchResult.viaTinyFish;

    // 4. Infer Page Type
    const pageType = inferPageType(structure);
    structure.pageType = pageType;
    console.log(`[Page Context] Inferred pageType="${pageType}" for URL "${finalUrl}"`);

    // 5. Generate SERP Queries & Run Search Investigation
    const generatedQueries = generateSerpQueries(structure, pageType, userQuery);
    console.log(`[SERP Queries] Generated: ${JSON.stringify(generatedQueries.map(q => q.query))}`);
    const searchData = await performTinyFishSearch(finalUrl, generatedQueries, targetContext.isRootDomain);

    // 6. Run AI Readability & Citation Analysis
    const aiAnalysisResult = await evaluateAiReadabilityAndContent(structure, searchData);

    // 7. Evaluate Technical SEO Rules
    const technicalFindings = evaluateTechnicalSeo(structure);

    // 8. Calculate Authoritative Scores
    const scoringResult = calculateAuditScores(
      technicalFindings,
      aiAnalysisResult.aiReadabilityFindings,
      aiAnalysisResult.contentIntentFindings,
      aiAnalysisResult.citationReadinessFindings,
      searchData
    );

    // 9. Prioritize Actionable Recommendations
    const priorityFixes = prioritizeFindings(scoringResult.allFindings);

    // 10. Assemble Final Audit Report
    const report: FinalAuditReport = {
      targetContext,
      auditTimestamp: new Date().toISOString(),
      isPartialAudit: !!searchData.isSearchUnverified,
      partialAuditReason: searchData.searchErrorMessage,
      overallScore: scoringResult.overallScore,
      summary: aiAnalysisResult.executiveSummary,
      categories: scoringResult.categories,
      priorityFixes,
      allFindings: scoringResult.allFindings,
      exactPageDetails: {
        title: structure.title,
        metaDescription: structure.metaDescription,
        canonical: structure.canonical,
        headings: structure.headings,
        structuredDataTypes: structure.structuredDataTypes,
        totalImages: structure.totalImages,
        missingAltCount: structure.missingAltCount,
        robotsDirectives: structure.robotsMeta,
        wordCount: structure.wordCount,
        totalWordCount: structure.totalWordCount ?? structure.wordCount,
        mainContentWordCount: structure.mainContentWordCount ?? structure.wordCount,
        hasHttps: structure.hasHttps,
        pageType,
        microdataTypes: structure.microdataTypes,
        rdfaTypes: structure.rdfaTypes,
      },
      searchEvidence: searchData.queries ? {
        queries: searchData.queries,
        visibilityTier: searchData.visibilityTier || 'Unknown',
        evidenceSufficient: !searchData.isSearchUnverified,
      } : undefined,
    };

    console.log(`[Audit Complete] ${targetContext.normalizedUrl} -> Overall Score: ${report.overallScore}/100, SearchVerified: ${!report.isPartialAudit} (${Date.now() - startTime}ms)`);

    return NextResponse.json(report, { status: 200 });

  } catch (err) {
    console.error('[Audit API Failure]:', err);

    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof FetchError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }

    const message = err instanceof Error ? err.message : 'An unexpected error occurred while auditing the webpage.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
