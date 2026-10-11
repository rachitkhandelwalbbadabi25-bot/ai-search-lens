import { fetchLivePage } from '../src/lib/tinyfish-fetch';
import { extractPageEvidence } from '../src/lib/evidence-extractor';
import { performTinyFishSearch } from '../src/lib/tinyfish-search';
import { evaluateTechnicalSeo } from '../src/lib/engines/seo-engine';
import { evaluateAiReadabilityAndContent } from '../src/lib/engines/ai-readability-engine';
import { calculateAuditScores } from '../src/lib/engines/scoring-engine';
import { inferPageType } from '../src/lib/page-context';
import { generateSerpQueries } from '../src/lib/serp-query-generator';

async function main() {
  console.log('=== RUNNING FULL AUDIT PIPELINE FOR https://velona.in/ ===');

  const fetchResult = await fetchLivePage('https://velona.in/');
  const structure = extractPageEvidence(
    fetchResult.html,
    fetchResult.url,
    fetchResult.statusCode,
    fetchResult.pageTitle,
    fetchResult.metaDescription,
    { renderedDom: fetchResult.viaTinyFish }
  );
  structure.renderedDom = fetchResult.viaTinyFish;

  const pageType = inferPageType(structure);
  structure.pageType = pageType;

  const generatedQueries = generateSerpQueries(structure, pageType);
  const searchData = await performTinyFishSearch(fetchResult.url, generatedQueries, true);
  const aiResult = await evaluateAiReadabilityAndContent(structure, searchData);
  const techFindings = evaluateTechnicalSeo(structure);

  const scoring = calculateAuditScores(
    techFindings,
    aiResult.aiReadabilityFindings,
    aiResult.contentIntentFindings,
    aiResult.citationReadinessFindings,
    searchData
  );

  console.log('\n--- SCORES ---');
  console.log(`Overall Score: ${scoring.overallScore}/100`);
  console.log(`Technical SEO: ${scoring.categories.technicalSeo.score}/${scoring.categories.technicalSeo.maxScore}`);
  console.log(`Search Visibility: ${scoring.categories.searchVisibility.score}/${scoring.categories.searchVisibility.maxScore}`);
  console.log(`AI Readability: ${scoring.categories.aiReadability.score}/${scoring.categories.aiReadability.maxScore}`);
  console.log(`Content & Intent: ${scoring.categories.contentIntent.score}/${scoring.categories.contentIntent.maxScore}`);
  console.log(`Citation Readiness: ${scoring.categories.citationReadiness.score}/${scoring.categories.citationReadiness.maxScore}`);

  console.log('\n--- ALL FINDINGS ---');
  for (const f of scoring.allFindings) {
    console.log(`\n- ID: ${f.id} [${f.category}] (deduction: ${f.deductionPoints})`);
    console.log(`  Title: ${f.title}`);
    console.log(`  Observed: ${f.evidence.observed}`);
    console.log(`  Expected: ${f.evidence.expected}`);
  }
}

main().catch(console.error);
