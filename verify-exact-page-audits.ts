import { validateAndNormalizeUrl } from './src/lib/url-validator';
import { fetchLivePage } from './src/lib/tinyfish-fetch';
import { extractPageEvidence } from './src/lib/evidence-extractor';
import { evaluateTechnicalSeo } from './src/lib/engines/seo-engine';
import { evaluateAiReadabilityAndContent } from './src/lib/engines/ai-readability-engine';
import { calculateAuditScores } from './src/lib/engines/scoring-engine';
import { prioritizeFindings } from './src/lib/engines/recommendation-engine';
import { inferPageType } from './src/lib/page-context';
import { classifyRedirect, traceRedirects } from './src/lib/redirect-analyzer';
import { generateSerpQueries } from './src/lib/serp-query-generator';
import { performTinyFishSearch } from './src/lib/tinyfish-search';

const TARGET_SITES = [
  'https://wordpress.org/',
  'https://github.com/',
  'https://shopify.com/',
  'https://en.wikipedia.org/wiki/Search_engine_optimization',
  'https://developer.mozilla.org/en-US/docs/Web/HTML',
  'https://www.notion.so/',
  'https://www.ycombinator.com/',
  'https://www.aihireflow.in/',
  'https://unfoldd.ai/',
  'https://unfoldd.ai/arena',
];

async function testAudit(url: string) {
  console.log(`\n==================================================`);
  console.log(` AUDITING TARGET: ${url}`);
  console.log(`==================================================`);

  const targetContext = validateAndNormalizeUrl(url);

  // 1. Fetch & Redirect Trace
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

  // 2. Extract DOM Evidence
  const structure = extractPageEvidence(
    fetchResult.html,
    finalUrl,
    fetchResult.statusCode,
    fetchResult.pageTitle,
    fetchResult.metaDescription
  );
  structure.isRedirected = isRedirected;
  structure.finalUrl = finalUrl;
  structure.requestedUrl = targetContext.normalizedUrl;
  structure.redirect = redirectAnalysis;
  structure.renderedDom = fetchResult.viaTinyFish;

  // 3. Page Type & Brand
  const pageType = inferPageType(structure);
  structure.pageType = pageType;

  // 4. SERP Queries
  const queries = generateSerpQueries(structure, pageType);
  const searchData = await performTinyFishSearch(finalUrl, queries, targetContext.isRootDomain);

  // 5. Run Engines
  const aiAnalysisResult = await evaluateAiReadabilityAndContent(structure, searchData);
  const technicalFindings = evaluateTechnicalSeo(structure);
  const scoringResult = calculateAuditScores(
    technicalFindings,
    aiAnalysisResult.aiReadabilityFindings,
    aiAnalysisResult.contentIntentFindings,
    aiAnalysisResult.citationReadinessFindings,
    searchData
  );

  const priorityFixes = prioritizeFindings(scoringResult.allFindings);

  console.log(`  Page Title: "${structure.title || 'None'}"`);
  console.log(`  Page Type:  ${pageType}`);
  console.log(`  SERP Queries: ${queries.map(q => `"${q.query}" (${q.kind})`).join(', ')}`);
  console.log(`  Redirect Kind: ${redirectAnalysis.kind} (Hops: ${redirectAnalysis.httpRedirectCount})`);
  console.log(`  Overall Score: ${scoringResult.overallScore}/100`);
  console.log(`  Category Breakdown:`);
  console.log(`    Technical SEO:    ${scoringResult.categories.technicalSeo.score}/25`);
  console.log(`    Search Visibility:${scoringResult.categories.searchVisibility.score}/25 (${searchData.visibilityTier || 'Unknown'})`);
  console.log(`    AI Readability:   ${scoringResult.categories.aiReadability.score}/25`);
  console.log(`    Content & Intent: ${scoringResult.categories.contentIntent.score}/15`);
  console.log(`    Citation Readiness:${scoringResult.categories.citationReadiness.score}/10`);
  console.log(`  Total Findings: ${scoringResult.allFindings.length}, Top Fixes: ${priorityFixes.length}`);
  
  // Reconcile mathematical score
  const sumCat = scoringResult.categories.technicalSeo.score +
    scoringResult.categories.searchVisibility.score +
    scoringResult.categories.aiReadability.score +
    scoringResult.categories.contentIntent.score +
    scoringResult.categories.citationReadiness.score;
  const sumDeductions = scoringResult.allFindings.reduce((acc, f) => acc + f.deductionPoints, 0);

  console.log(`  Score Reconciliation: overallScore=${scoringResult.overallScore} | sumCat=${sumCat} | 100-sumDeductions=${100 - sumDeductions} -> ${scoringResult.overallScore === sumCat && scoringResult.overallScore === (100 - sumDeductions) ? 'RECONCILED ✓' : 'MISMATCH ✗'}`);
}

async function main() {
  for (const site of TARGET_SITES) {
    try {
      await testAudit(site);
    } catch (err) {
      console.error(`Audit failed for ${site}:`, err);
    }
  }
}

main().catch(console.error);
