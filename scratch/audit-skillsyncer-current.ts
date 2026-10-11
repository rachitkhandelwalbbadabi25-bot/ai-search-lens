import { validateAndNormalizeUrl } from '../src/lib/url-validator';
import { fetchLivePage } from '../src/lib/tinyfish-fetch';
import { extractPageEvidence } from '../src/lib/evidence-extractor';
import { performTinyFishSearch } from '../src/lib/tinyfish-search';
import { evaluateTechnicalSeo } from '../src/lib/engines/seo-engine';
import { evaluateAiReadabilityAndContent } from '../src/lib/engines/ai-readability-engine';
import { calculateAuditScores } from '../src/lib/engines/scoring-engine';
import { inferPageType } from '../src/lib/page-context';
import { classifyRedirect, traceRedirects } from '../src/lib/redirect-analyzer';
import { generateSerpQueries } from '../src/lib/serp-query-generator';

async function main() {
  const target = 'https://skillsyncer.com/';
  console.log(`Starting audit for: ${target}`);

  const targetContext = validateAndNormalizeUrl(target);
  const [traceResult, fetchResult] = await Promise.all([
    traceRedirects(targetContext.normalizedUrl, 10, 8000),
    fetchLivePage(targetContext.normalizedUrl),
  ]);

  const finalUrl = fetchResult.url || traceResult.finalUrl || targetContext.normalizedUrl;
  const isRedirected = targetContext.normalizedUrl.replace(/\/$/, '').toLowerCase() !== finalUrl.replace(/\/$/, '').toLowerCase();

  const redirectAnalysis = classifyRedirect({
    requestedUrl: targetContext.normalizedUrl,
    finalUrl,
    hops: traceResult.hops,
    isLoop: traceResult.isLoop,
    traceAvailable: traceResult.traceAvailable,
  });

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

  const pageType = inferPageType(structure);
  structure.pageType = pageType;

  console.log('\n--- EXTRACTED EVIDENCE ---');
  console.log(`Status Code: ${fetchResult.statusCode}`);
  console.log(`Viewport:`, structure.evidenceState?.head.viewport);
  console.log(`Canonical:`, structure.evidenceState?.head.canonical, `URL: ${structure.canonical}`);
  console.log(`Structured Data:`, structure.evidenceState?.structuredData);
  console.log(`Images: total=${structure.totalImages}, missingAlt=${structure.missingAltCount}`);
  console.log(`Headings Count: ${structure.headings.length}, H1 Count: ${structure.h1Count}`);
  console.log(`Word Count: total=${structure.totalWordCount}, main=${structure.mainContentWordCount}, raw=${structure.wordCount}`);

  const generatedQueries = generateSerpQueries(structure, pageType);
  console.log('\nGenerated Queries:', generatedQueries);
  const searchData = await performTinyFishSearch(finalUrl, generatedQueries, targetContext.isRootDomain);

  console.log('\n--- SEARCH DATA ---');
  console.log(`Search Status: ${searchData.searchStatus}`);
  console.log(`Visibility Tier: ${searchData.visibilityTier}`);
  console.log(`Rank Position: ${searchData.targetRankPosition}`);
  console.log(`Query Used: ${searchData.queryUsed}`);
  console.log(`Is Inferred: ${searchData.isInferredQuery}`);
  console.log(`Search Unverified: ${searchData.isSearchUnverified}`);

  const aiAnalysisResult = await evaluateAiReadabilityAndContent(structure, searchData);
  const technicalFindings = evaluateTechnicalSeo(structure);

  const scoringResult = calculateAuditScores(
    technicalFindings,
    aiAnalysisResult.aiReadabilityFindings,
    aiAnalysisResult.contentIntentFindings,
    aiAnalysisResult.citationReadinessFindings,
    searchData
  );

  console.log('\n--- AUDIT RESULTS ---');
  console.log(`Overall Score: ${scoringResult.overallScore}/100`);
  console.log('Category Scores:', {
    technicalSeo: `${scoringResult.categories.technicalSeo.score}/${scoringResult.categories.technicalSeo.maxScore}`,
    searchVisibility: `${scoringResult.categories.searchVisibility.score}/${scoringResult.categories.searchVisibility.maxScore}`,
    aiReadability: `${scoringResult.categories.aiReadability.score}/${scoringResult.categories.aiReadability.maxScore}`,
    contentIntent: `${scoringResult.categories.contentIntent.score}/${scoringResult.categories.contentIntent.maxScore}`,
    citationReadiness: `${scoringResult.categories.citationReadiness.score}/${scoringResult.categories.citationReadiness.maxScore}`,
  });

  console.log('\n--- ALL FINDINGS ---');
  for (const f of scoringResult.allFindings) {
    console.log(`- [${f.category}] [${f.severity}] (${f.deductionPoints > 0 ? '-' + f.deductionPoints : '0'} pts) ${f.title}`);
    console.log(`  Observed: ${f.evidence.observed}`);
  }
}

main().catch(console.error);
