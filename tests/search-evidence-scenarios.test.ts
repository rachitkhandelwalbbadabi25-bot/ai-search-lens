import assert from 'node:assert';
import { extractPageEvidence } from '../src/lib/evidence-extractor';
import { evaluateTechnicalSeo } from '../src/lib/engines/seo-engine';
import { evaluateAiReadabilityAndContent } from '../src/lib/engines/ai-readability-engine';
import { calculateAuditScores } from '../src/lib/engines/scoring-engine';
import { assessVisibility, buildQueryResult } from '../src/lib/search-visibility';
import { GeneratedQuery, QueryVisibilityResult, SearchVisibilityData } from '../src/types/audit';

async function runScenarioTests() {
  console.log('====================================================');
  console.log('   SEARCH EVIDENCE STATES & SCENARIO RECONCILIATION   ');
  console.log('====================================================\n');

  // Real Velona HTML structure
  const velonaHtml = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Velona, Unified AI APIs for Indian Developers</title>
        <meta name="description" content="Velona provides unified AI APIs for Indian developers paid in Indian Rupees with high performance, instant setup, and zero management overhead.">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
        <link rel="canonical" href="https://velona.in/">
        <script type="application/ld+json">
          { "@context": "https://schema.org", "@type": "Organization", "name": "Velona", "url": "https://velona.in" }
        </script>
        <script type="application/ld+json">
          { "@context": "https://schema.org", "@type": "SoftwareApplication", "name": "Velona API" }
        </script>
      </head>
      <body>
        <main>
          <h1>Every AI model. One API. Paid in Rupees.</h1>
          <p>Full substantive paragraph describing the platform and offerings for developers in India. Velona offers unified API access across multiple foundation models with simple billing in Indian Rupees, high availability guarantees, enterprise security features, and developer-friendly documentation. Developers can easily route requests between OpenAI, Anthropic, Google Gemini, and open-source models through a single ultra-reliable endpoint while paying in local currency with transparent usage metrics.</p>
          <h3>Gateway pulse, live</h3>
          <h2>Everything Indian developers need</h2>
          <p>Velona eliminates the friction of managing separate API subscriptions, international credit cards, and complex multi-vendor invoice reconciliation. Our platform provides high throughput, ultralow latency routing, automated fallbacks across model providers, granular rate limiting, team access controls, and real-time observability dashboards built specifically for fast-growing engineering teams in India. We empower software builders with reliable scalable infrastructure tailored for domestic payment systems and low latency regional edge deployments. Our unified developer platform supports seamless API key rotation, automated usage alerts, comprehensive SDKs for Node.js, Python, and Go, as well as enterprise SLA guarantees with round-the-clock technical support.</p>
        </main>
      </body>
    </html>
  `;

  const pageEvidence = extractPageEvidence(velonaHtml, 'https://velona.in/', 200);
  pageEvidence.pageType = 'homepage';

  const queries: GeneratedQuery[] = [
    { query: 'Velona', kind: 'brand', source: 'Brand name' },
    { query: 'Velona developer platform', kind: 'brand_category', source: 'Brand + Category' },
    { query: 'Unified AI APIs for Indian Developers', kind: 'intent', source: 'Primary Intent' },
  ];

  // =========================================================================
  // SCENARIO A: Successful search where exact page is NOT found in window
  // =========================================================================
  console.log('--- SCENARIO A: Search Executed Successfully, Target NOT Found ---');
  {
    // Mock 10 competitor results that do not contain velona.in
    const competitorResults = [
      { title: 'AI Gateway - Model Aggregation', url: 'https://example-competitor1.com/api', snippet: 'Fast AI APIs' },
      { title: 'OpenRouter - Unified AI', url: 'https://openrouter.ai/models', snippet: 'Unified interface for LLMs' },
      { title: 'Together AI', url: 'https://together.ai/', snippet: 'Inference platform' },
      { title: 'Groq Cloud', url: 'https://groq.com/', snippet: 'Fast inference' },
      { title: 'Anyscale Endpoints', url: 'https://anyscale.com/', snippet: 'Ray serving' },
    ];

    const resultsA: QueryVisibilityResult[] = queries.map(q =>
      buildQueryResult(q, competitorResults, 'https://velona.in/', 'bing', true)
    );

    const searchDataA = assessVisibility(resultsA);

    assert.strictEqual(searchDataA.isSearchUnverified, false, 'Scenario A: isSearchUnverified is false');
    assert.strictEqual(searchDataA.searchStatus, 'NOT_FOUND', 'Scenario A: searchStatus is NOT_FOUND');
    assert.strictEqual(searchDataA.visibilityTier, 'Not observed', 'Scenario A: visibilityTier is Not observed');
    assert.strictEqual(searchDataA.evidenceSufficient, true, 'Scenario A: evidenceSufficient is true');
    assert.strictEqual(searchDataA.targetPresentInSerp, false, 'Scenario A: targetPresentInSerp is false');

    const techA = evaluateTechnicalSeo(pageEvidence);
    const aiResA = await evaluateAiReadabilityAndContent(pageEvidence, searchDataA);
    const scoringA = calculateAuditScores(
      techA,
      aiResA.aiReadabilityFindings,
      aiResA.contentIntentFindings,
      aiResA.citationReadinessFindings,
      searchDataA
    );

    console.log('Scenario A Category Breakdown:', {
      technicalSeo: `${scoringA.categories.technicalSeo.score}/${scoringA.categories.technicalSeo.maxScore}`,
      searchVisibility: `${scoringA.categories.searchVisibility.score}/${scoringA.categories.searchVisibility.maxScore}`,
      aiReadability: `${scoringA.categories.aiReadability.score}/${scoringA.categories.aiReadability.maxScore}`,
      contentIntent: `${scoringA.categories.contentIntent.score}/${scoringA.categories.contentIntent.maxScore}`,
      citationReadiness: `${scoringA.categories.citationReadiness.score}/${scoringA.categories.citationReadiness.maxScore}`,
      overall: `${scoringA.overallScore}/100`,
    });

    // Validations for Scenario A:
    assert.strictEqual(scoringA.categories.technicalSeo.score, 24, 'Technical SEO score is 24 (only -1 for heading skip)');
    assert.strictEqual(scoringA.categories.searchVisibility.score, 17, 'Search Visibility score is 17 (-8 for not observed)');
    assert.strictEqual(scoringA.categories.aiReadability.score, 25, 'AI Readability score is 25');
    assert.strictEqual(scoringA.categories.contentIntent.score, 15, 'Content & Intent score is 15');
    assert.strictEqual(scoringA.categories.citationReadiness.score, 10, 'Citation Readiness score is 10 (WebSite is INFO 0 pts)');

    const sumA =
      scoringA.categories.technicalSeo.score +
      scoringA.categories.searchVisibility.score +
      scoringA.categories.aiReadability.score +
      scoringA.categories.contentIntent.score +
      scoringA.categories.citationReadiness.score;

    assert.strictEqual(scoringA.overallScore, sumA, 'Overall score equals sum of category scores (91)');
    assert.strictEqual(scoringA.overallScore, 91, 'Scenario A overall score is exactly 91/100');
    console.log('[PASS] Scenario A passed with verified mathematical reconciliation (91/100)\n');
  }

  // =========================================================================
  // SCENARIO B: Provider unavailable or search unverified
  // =========================================================================
  console.log('--- SCENARIO B: Search Provider Unavailable / Insufficient Evidence ---');
  {
    // Simulation of provider failure (returns null or empty for all queries)
    const resultsB: QueryVisibilityResult[] = queries.map(q =>
      buildQueryResult(q, null, 'https://velona.in/', 'none', true)
    );

    const searchDataB = assessVisibility(resultsB);

    assert.strictEqual(searchDataB.isSearchUnverified, true, 'Scenario B: isSearchUnverified is true');
    assert.strictEqual(searchDataB.searchStatus, 'UNVERIFIED', 'Scenario B: searchStatus is UNVERIFIED');
    assert.strictEqual(searchDataB.visibilityTier, 'Unknown', 'Scenario B: visibilityTier is Unknown');
    assert.strictEqual(searchDataB.evidenceSufficient, false, 'Scenario B: evidenceSufficient is false');

    const techB = evaluateTechnicalSeo(pageEvidence);
    const aiResB = await evaluateAiReadabilityAndContent(pageEvidence, searchDataB);
    const scoringB = calculateAuditScores(
      techB,
      aiResB.aiReadabilityFindings,
      aiResB.contentIntentFindings,
      aiResB.citationReadinessFindings,
      searchDataB
    );

    console.log('Scenario B Category Breakdown:', {
      technicalSeo: `${scoringB.categories.technicalSeo.score}/${scoringB.categories.technicalSeo.maxScore}`,
      searchVisibility: `${scoringB.categories.searchVisibility.score}/${scoringB.categories.searchVisibility.maxScore}`,
      aiReadability: `${scoringB.categories.aiReadability.score}/${scoringB.categories.aiReadability.maxScore}`,
      contentIntent: `${scoringB.categories.contentIntent.score}/${scoringB.categories.contentIntent.maxScore}`,
      citationReadiness: `${scoringB.categories.citationReadiness.score}/${scoringB.categories.citationReadiness.maxScore}`,
      overall: `${scoringB.overallScore}/100`,
    });

    // Validations for Scenario B:
    assert.strictEqual(scoringB.categories.technicalSeo.score, 24, 'Technical SEO score is 24');
    assert.strictEqual(scoringB.categories.searchVisibility.score, 25, 'Search Visibility score is 25 (0 penalty for unverified)');
    assert.strictEqual(scoringB.categories.aiReadability.score, 25, 'AI Readability score is 25');
    assert.strictEqual(scoringB.categories.contentIntent.score, 15, 'Content & Intent score is 15');
    assert.strictEqual(scoringB.categories.citationReadiness.score, 10, 'Citation Readiness score is 10');

    const sumB =
      scoringB.categories.technicalSeo.score +
      scoringB.categories.searchVisibility.score +
      scoringB.categories.aiReadability.score +
      scoringB.categories.contentIntent.score +
      scoringB.categories.citationReadiness.score;

    assert.strictEqual(scoringB.overallScore, sumB, 'Overall score equals sum of category scores (99)');
    assert.strictEqual(scoringB.overallScore, 99, 'Scenario B overall score is exactly 99/100');
    console.log('[PASS] Scenario B passed with verified mathematical reconciliation (99/100)\n');
  }

  console.log('====================================================');
  console.log(' ALL SEARCH SCENARIOS VERIFIED ACCURATELY! ');
  console.log('====================================================');
}

runScenarioTests().catch(err => {
  console.error(err);
  process.exit(1);
});
