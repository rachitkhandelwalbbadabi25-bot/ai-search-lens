import { extractPageEvidence } from '../src/lib/evidence-extractor';
import { evaluateTechnicalSeo } from '../src/lib/engines/seo-engine';
import { evaluateAiReadabilityAndContent } from '../src/lib/engines/ai-readability-engine';
import { calculateAuditScores } from '../src/lib/engines/scoring-engine';
import { inferPageType, recommendSchemaTypes } from '../src/lib/page-context';
import { classifyRedirect } from '../src/lib/redirect-analyzer';
import { generateSerpQueries, isSloganLike } from '../src/lib/serp-query-generator';
import { assessVisibility } from '../src/lib/search-visibility';
import { PageStructureData, SearchVisibilityData } from '../src/types/audit';

async function runTests() {
  console.log('====================================================');
  console.log('   SEO AUDITOR LOGIC HARDENING & REGRESSION SUITE   ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // Test A — Missing H1 Severity != CRITICAL
  // ----------------------------------------------------
  {
    const html = '<html><head><title>Test Page Title Here</title></head><body><p>Some text</p></body></html>';
    const evidence = extractPageEvidence(html, 'https://example.com/test', 200);
    const findings = evaluateTechnicalSeo(evidence);
    const h1Finding = findings.find(f => f.id === 'seo-missing-h1');
    assert(
      !!h1Finding && h1Finding.severity !== 'CRITICAL',
      'Test A — Missing H1 severity is non-critical (MEDIUM/LOW)',
      `Observed severity: ${h1Finding?.severity}`
    );
  }

  // ----------------------------------------------------
  // Test B — No H1 -> No "Weak Primary Definition Below H1"
  // ----------------------------------------------------
  {
    const html = '<html><head><title>Test Page Title Here</title></head><body><p>Some text</p></body></html>';
    const evidence = extractPageEvidence(html, 'https://example.com/test', 200);
    const mockSearch: SearchVisibilityData = {
      queryUsed: 'Test', isInferredQuery: true, targetPresentInSerp: true, targetDomainPresentInSerp: true,
      targetRankPosition: 1, targetSerpTitle: 'Test', targetSerpSnippet: 'Test', topCompetitors: [],
      searchIntent: 'Informational', queryPageAlignmentScore: 100, isSearchUnverified: false
    };
    const aiResult = await evaluateAiReadabilityAndContent(evidence, mockSearch);
    const weakDefFinding = aiResult.aiReadabilityFindings.find(f => f.id === 'ai-weak-page-definition');
    assert(
      !weakDefFinding,
      'Test B — No "Weak Primary Page Definition Below H1" finding when H1 is missing'
    );
  }

  // ----------------------------------------------------
  // Test C — Missing Canonical -> No Automatic High/Critical Severity
  // ----------------------------------------------------
  {
    const html = '<html><head><title>Test Page Title Here</title></head><body><h1>Main Title</h1></body></html>';
    const evidence = extractPageEvidence(html, 'https://example.com/clean-url', 200);
    const findings = evaluateTechnicalSeo(evidence);
    const canonicalFinding = findings.find(f => f.id === 'seo-missing-canonical');
    assert(
      !!canonicalFinding && (canonicalFinding.severity === 'INFO' || canonicalFinding.severity === 'LOW'),
      'Test C — Missing canonical without duplicate evidence has INFO/LOW severity',
      `Observed severity: ${canonicalFinding?.severity}`
    );
  }

  // ----------------------------------------------------
  // Test D — No Schema -> No Claim That AI Requires Schema
  // ----------------------------------------------------
  {
    const html = '<html><head><title>Test Page Title Here</title></head><body><h1>Main Title</h1></body></html>';
    const evidence = extractPageEvidence(html, 'https://example.com/test', 200);
    const mockSearch: SearchVisibilityData = {
      queryUsed: 'Test', isInferredQuery: true, targetPresentInSerp: true, targetDomainPresentInSerp: true,
      targetRankPosition: 1, targetSerpTitle: 'Test', targetSerpSnippet: 'Test', topCompetitors: [],
      searchIntent: 'Informational', queryPageAlignmentScore: 100, isSearchUnverified: false
    };
    const aiResult = await evaluateAiReadabilityAndContent(evidence, mockSearch);
    const schemaFinding = aiResult.citationReadinessFindings.find(f => f.id === 'citation-unattributed-claims');
    const hasAbsoluteClaim = schemaFinding
      ? /require schema to cite|require explicit schema|no json-ld = poor/i.test(schemaFinding.whyItMatters + schemaFinding.recommendedFix)
      : false;
    assert(
      !hasAbsoluteClaim,
      'Test D — Citation findings do NOT claim AI systems require schema to cite pages'
    );
  }

  // ----------------------------------------------------
  // Test E — Homepage Schema Recommendation
  // ----------------------------------------------------
  {
    const rec = recommendSchemaTypes('homepage', []);
    assert(
      rec.recommended.includes('Organization') && rec.recommended.includes('WebSite'),
      'Test E — Homepage schema recommendation suggests Organization & WebSite',
      `Recommended: ${rec.recommended.join(', ')}`
    );
  }

  // ----------------------------------------------------
  // Test F — Article Schema Recommendation
  // ----------------------------------------------------
  {
    const rec = recommendSchemaTypes('article', []);
    assert(
      rec.recommended.includes('Article'),
      'Test F — Article schema recommendation suggests Article schema',
      `Recommended: ${rec.recommended.join(', ')}`
    );
  }

  // ----------------------------------------------------
  // Test G — Login Page Word Count -> No High Thin-Content Warning
  // ----------------------------------------------------
  {
    const html = '<html><head><title>Sign In - App</title></head><body><h1>Sign In</h1><form><input type="password"></form></body></html>';
    const evidence = extractPageEvidence(html, 'https://example.com/login', 200);
    evidence.wordCount = 37;
    evidence.pageType = inferPageType(evidence);
    const mockSearch: SearchVisibilityData = {
      queryUsed: 'Sign In', isInferredQuery: true, targetPresentInSerp: false, targetDomainPresentInSerp: true,
      targetRankPosition: null, targetSerpTitle: null, targetSerpSnippet: null, topCompetitors: [],
      searchIntent: 'Navigational', queryPageAlignmentScore: 50, isSearchUnverified: false
    };
    const aiResult = await evaluateAiReadabilityAndContent(evidence, mockSearch);
    const thinFinding = aiResult.contentIntentFindings.find(f => f.id === 'content-thin-word-count');
    assert(
      !thinFinding || thinFinding.severity === 'LOW' || thinFinding.severity === 'INFO',
      'Test G — Login page with 37 words does not trigger a High/Critical thin content warning',
      `Observed thin finding severity: ${thinFinding?.severity || 'None'}`
    );
  }

  // ----------------------------------------------------
  // Test H — Intentional Redirect Disclosed & Not Critical
  // ----------------------------------------------------
  {
    const redirect = classifyRedirect({
      requestedUrl: 'https://example.com/old-page',
      finalUrl: 'https://example.com/new-page',
      hops: [{ url: 'https://example.com/old-page', status: 301, location: 'https://example.com/new-page' }],
      isLoop: false,
      traceAvailable: true,
    });
    const evidence: PageStructureData = {
      statusCode: 200, url: 'https://example.com/new-page', finalUrl: 'https://example.com/new-page',
      requestedUrl: 'https://example.com/old-page', isRedirected: true, redirect,
      title: 'New Page', titleLength: 8, metaDescription: 'Desc', metaDescriptionLength: 4, canonical: null,
      robotsMeta: null, headings: [{ level: 'h1', text: 'New Page' }], h1Count: 1, mainBodyText: 'Text',
      wordCount: 100, structuredDataTypes: [], rawSchemaBlocks: [], totalImages: 0, missingAltCount: 0,
      imagesWithoutAlt: [], internalLinksCount: 0, externalLinksCount: 0, hasHttps: true, hasViewportMeta: true,
    };
    const findings = evaluateTechnicalSeo(evidence);
    const redirectFinding = findings.find(f => f.id === 'seo-page-redirected');
    assert(
      !!redirectFinding && redirectFinding.severity !== 'CRITICAL' && redirectFinding.severity !== 'HIGH',
      'Test H — Intentional 301 path redirect is disclosed as INFO/LOW severity',
      `Observed severity: ${redirectFinding?.severity}`
    );
  }

  // ----------------------------------------------------
  // Test I — Redirect Loop -> High/Critical Severity
  // ----------------------------------------------------
  {
    const redirect = classifyRedirect({
      requestedUrl: 'https://example.com/loop-a',
      finalUrl: 'https://example.com/loop-b',
      hops: [
        { url: 'https://example.com/loop-a', status: 302, location: 'https://example.com/loop-b' },
        { url: 'https://example.com/loop-b', status: 302, location: 'https://example.com/loop-a' },
      ],
      isLoop: true,
      traceAvailable: true,
    });
    const evidence: PageStructureData = {
      statusCode: 200, url: 'https://example.com/loop-b', finalUrl: 'https://example.com/loop-b',
      requestedUrl: 'https://example.com/loop-a', isRedirected: true, redirect,
      title: 'Loop', titleLength: 4, metaDescription: null, metaDescriptionLength: 0, canonical: null,
      robotsMeta: null, headings: [], h1Count: 0, mainBodyText: '', wordCount: 0, structuredDataTypes: [],
      rawSchemaBlocks: [], totalImages: 0, missingAltCount: 0, imagesWithoutAlt: [], internalLinksCount: 0,
      externalLinksCount: 0, hasHttps: true, hasViewportMeta: true,
    };
    const findings = evaluateTechnicalSeo(evidence);
    const redirectFinding = findings.find(f => f.id === 'seo-page-redirected');
    assert(
      !!redirectFinding && (redirectFinding.severity === 'CRITICAL' || redirectFinding.severity === 'HIGH'),
      'Test I — Redirect loop is identified as CRITICAL/HIGH severity',
      `Observed severity: ${redirectFinding?.severity}`
    );
  }

  // ----------------------------------------------------
  // Test J — SERP Query -> No Marketing Slogans Used
  // ----------------------------------------------------
  {
    const slogans = [
      "GitHub Change is constant. GitHub keeps you ahead.",
      "Shopify The All",
      "The AI workspace that works for you.",
      "Build something people want",
    ];
    const detectedSlogans = slogans.map(s => isSloganLike(s));
    assert(
      detectedSlogans.every(Boolean),
      'Test J — Slogan detector identifies marketing slogans correctly',
      `Slogan check flags: ${JSON.stringify(detectedSlogans)}`
    );

    const githubEvidence: PageStructureData = {
      statusCode: 200, url: 'https://github.com/', finalUrl: 'https://github.com/',
      title: 'GitHub · Change is constant. GitHub keeps you ahead.', titleLength: 50,
      metaDescription: 'GitHub is where over 100 million developers shape the future of software, together.',
      metaDescriptionLength: 85, canonical: 'https://github.com/', robotsMeta: null,
      headings: [{ level: 'h1', text: 'Build and ship software on a single developer platform' }], h1Count: 1,
      mainBodyText: 'Developer platform code host repositories pull requests', wordCount: 300,
      structuredDataTypes: ['Organization'], rawSchemaBlocks: [], totalImages: 0, missingAltCount: 0,
      imagesWithoutAlt: [], internalLinksCount: 0, externalLinksCount: 0, hasHttps: true, hasViewportMeta: true,
    };
    const queries = generateSerpQueries(githubEvidence, 'homepage');
    const queryStrings = queries.map(q => q.query);
    assert(
      !queryStrings.some(q => isSloganLike(q)),
      'Test J — Generated SERP queries exclude marketing slogans',
      `Generated queries: ${JSON.stringify(queryStrings)}`
    );
  }

  // ----------------------------------------------------
  // Test K — Insufficient SERP Evidence -> Search Visibility = Unknown
  // ----------------------------------------------------
  {
    const visibility = assessVisibility([]);
    assert(
      Boolean(visibility.isSearchUnverified) && visibility.visibilityTier === 'Unknown',
      'Test K — Insufficient SERP evidence sets search visibility status to Unknown/Unverified',
      `Tier: ${visibility.visibilityTier}, Unverified: ${visibility.isSearchUnverified}`
    );
  }

  // ----------------------------------------------------
  // Test L — Score Consistency Reconciliation
  // ----------------------------------------------------
  {
    const html = '<html><head><title>Short Title</title></head><body><h2>Subheading</h2><p>Brief text</p></body></html>';
    const evidence = extractPageEvidence(html, 'https://example.com/test', 200);
    const tech = evaluateTechnicalSeo(evidence);
    const mockSearch: SearchVisibilityData = {
      queryUsed: 'Test', isInferredQuery: true, targetPresentInSerp: false, targetDomainPresentInSerp: false,
      targetRankPosition: null, targetSerpTitle: null, targetSerpSnippet: null, topCompetitors: [],
      searchIntent: 'Informational', queryPageAlignmentScore: 40, isSearchUnverified: false, visibilityScore: 0.3
    };
    const ai = await evaluateAiReadabilityAndContent(evidence, mockSearch);
    const scores = calculateAuditScores(tech, ai.aiReadabilityFindings, ai.contentIntentFindings, ai.citationReadinessFindings, mockSearch);

    const sumCategoryScores =
      scores.categories.technicalSeo.score +
      scores.categories.searchVisibility.score +
      scores.categories.aiReadability.score +
      scores.categories.contentIntent.score +
      scores.categories.citationReadiness.score;

    const sumDeductions = scores.allFindings.reduce((sum, f) => sum + f.deductionPoints, 0);
    const reconciledWithDeductions = 100 - sumDeductions;

    assert(
      scores.overallScore === sumCategoryScores && scores.overallScore === reconciledWithDeductions,
      'Test L — Final score mathematically reconciles with category sum AND 100 - total deductions',
      `overallScore=${scores.overallScore}, sumCategoryScores=${sumCategoryScores}, 100-sumDeductions=${reconciledWithDeductions}`
    );
  }

  console.log('\n====================================================');
  console.log(` SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
