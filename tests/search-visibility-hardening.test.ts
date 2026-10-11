import { calculateAuditScores } from '../src/lib/engines/scoring-engine';
import { generateSerpQueries, isSloganLike } from '../src/lib/serp-query-generator';
import { assessVisibility, buildQueryResult } from '../src/lib/search-visibility';
import { AuditFinding, PageStructureData, SearchVisibilityData } from '../src/types/audit';

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
  } else {
    console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    process.exitCode = 1;
  }
}

async function runSearchVisibilityHardeningTests() {
  console.log('====================================================');
  console.log('   PHASE 5 — SEARCH VISIBILITY & SERP SUITE         ');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // TEST A — Excellent Tier Has 0 Score Deduction (Problem A Fix)
  // ----------------------------------------------------
  {
    const searchData: SearchVisibilityData = {
      queryUsed: 'OpenAI AI research',
      isInferredQuery: false,
      targetPresentInSerp: true,
      targetDomainPresentInSerp: true,
      targetRankPosition: 1,
      targetSerpTitle: 'OpenAI',
      targetSerpSnippet: 'OpenAI is an AI research and deployment company.',
      topCompetitors: [],
      searchIntent: 'Informational',
      queryPageAlignmentScore: 100,
      isSearchUnverified: false,
      visibilityTier: 'Excellent',
      visibilityScore: 1.0,
      evidenceSufficient: true,
    };

    const scores = calculateAuditScores([], [], [], [], searchData);
    const searchCat = scores.categories.searchVisibility;
    const searchFinding = scores.allFindings.find(f => f.category === 'search_visibility');

    assert(searchCat.score === 25, 'TEST A — Excellent tier receives 25/25 category score');
    assert(searchFinding?.deductionPoints === 0, 'TEST A — Excellent tier has ZERO deduction points');
  }

  // ----------------------------------------------------
  // TEST B — Unverified Search Has 0 Score Deduction (Problem B Fix)
  // ----------------------------------------------------
  {
    const searchData: SearchVisibilityData = {
      queryUsed: '',
      isInferredQuery: true,
      targetPresentInSerp: false,
      targetDomainPresentInSerp: false,
      targetRankPosition: null,
      targetSerpTitle: null,
      targetSerpSnippet: null,
      topCompetitors: [],
      searchIntent: 'Informational',
      queryPageAlignmentScore: 0,
      isSearchUnverified: true,
      visibilityTier: 'Unknown',
      evidenceSufficient: false,
      searchErrorMessage: 'SERP provider unreachable.',
    };

    const scores = calculateAuditScores([], [], [], [], searchData);
    const searchCat = scores.categories.searchVisibility;

    assert(searchCat.score === 25, 'TEST B — Unverified search receives 25/25 category score (no penalty)');
    assert(searchCat.status === 'unverified', 'TEST B — Category status is unverified');
  }

  // ----------------------------------------------------
  // TEST C — Not Observed Tier Has Non-Destructive LOW Deduction (Problem B Fix)
  // ----------------------------------------------------
  {
    const searchData: SearchVisibilityData = {
      queryUsed: 'Niche Tech Tool Pricing',
      isInferredQuery: true,
      targetPresentInSerp: false,
      targetDomainPresentInSerp: false,
      targetRankPosition: null,
      targetSerpTitle: null,
      targetSerpSnippet: null,
      topCompetitors: [],
      searchIntent: 'Commercial',
      queryPageAlignmentScore: 40,
      isSearchUnverified: false,
      visibilityTier: 'Not observed',
      visibilityScore: 0,
      evidenceSufficient: true,
    };

    const scores = calculateAuditScores([], [], [], [], searchData);
    const searchCat = scores.categories.searchVisibility;
    const finding = scores.allFindings.find(f => f.id === 'search-visibility-not-observed');

    assert(searchCat.score === 17, 'TEST C — Not observed tier receives 17/25 score (non-destructive 8pt deduction)');
    assert(finding?.severity === 'LOW', 'TEST C — Finding severity is LOW (not CRITICAL/HIGH)');
    assert(!finding?.evidence.observed.includes('not indexed'), 'TEST C — Finding does NOT claim page is unindexed');
  }

  // ----------------------------------------------------
  // TEST D — Strong & Moderate Tier Deductions
  // ----------------------------------------------------
  {
    const strongSearch: SearchVisibilityData = {
      queryUsed: 'Dev Platform',
      isInferredQuery: true,
      targetPresentInSerp: true,
      targetDomainPresentInSerp: true,
      targetRankPosition: 5,
      targetSerpTitle: 'Dev Platform',
      targetSerpSnippet: 'Platform snippet',
      topCompetitors: [],
      searchIntent: 'Informational',
      queryPageAlignmentScore: 85,
      isSearchUnverified: false,
      visibilityTier: 'Strong',
      visibilityScore: 0.85,
      evidenceSufficient: true,
    };

    const scores = calculateAuditScores([], [], [], [], strongSearch);
    assert(scores.categories.searchVisibility.score === 22, 'TEST D — Strong tier (rank #5) score is 22/25 (3pt deduction)');
  }

  // ----------------------------------------------------
  // TEST E — Query Generation Filters Slogans & Uses Canonical / Title / H1
  // ----------------------------------------------------
  {
    const pageData: PageStructureData = {
      statusCode: 200,
      url: 'https://example.com/docs/api-reference',
      finalUrl: 'https://example.com/docs/api-reference',
      canonical: 'https://example.com/docs/api-reference',
      title: 'Example Corp · Change is constant. We keep you ahead.',
      titleLength: 50,
      metaDescription: 'API Reference documentation for developers.',
      metaDescriptionLength: 45,
      robotsMeta: null,
      headings: [{ level: 'h1', text: 'API Reference Documentation' }],
      h1Count: 1,
      mainBodyText: 'Comprehensive API documentation for authentication and webhooks.',
      wordCount: 400,
      structuredDataTypes: ['TechArticle'],
      rawSchemaBlocks: [],
      totalImages: 0,
      missingAltCount: 0,
      imagesWithoutAlt: [],
      internalLinksCount: 10,
      externalLinksCount: 2,
      hasHttps: true,
      hasViewportMeta: true,
    };

    const queries = generateSerpQueries(pageData, 'documentation');
    const queryTexts = queries.map(q => q.query);

    assert(queryTexts.length >= 2, 'TEST E — Generated at least 2 queries');
    assert(!queryTexts.some(q => isSloganLike(q)), 'TEST E — All generated queries exclude marketing slogans');
    assert(queryTexts.some(q => q.toLowerCase().includes('api reference') || q.toLowerCase().includes('example')), 'TEST E — Queries capture core page intent');
  }

  // ----------------------------------------------------
  // TEST F — Safe Language Check Across Search Findings
  // ----------------------------------------------------
  {
    const notObservedSearch: SearchVisibilityData = {
      queryUsed: 'Test',
      isInferredQuery: true,
      targetPresentInSerp: false,
      targetDomainPresentInSerp: false,
      targetRankPosition: null,
      targetSerpTitle: null,
      targetSerpSnippet: null,
      topCompetitors: [],
      searchIntent: 'Informational',
      queryPageAlignmentScore: 40,
      isSearchUnverified: false,
      visibilityTier: 'Not observed',
      visibilityScore: 0,
      evidenceSufficient: true,
    };

    const scores = calculateAuditScores([], [], [], [], notObservedSearch);
    const unsafePhrases = ['not indexed', 'unindexed', 'cannot find this page', 'invisible to search'];
    const allFindingText = JSON.stringify(scores.allFindings).toLowerCase();
    const hasUnsafePhrase = unsafePhrases.some(p => allFindingText.includes(p));

    assert(!hasUnsafePhrase, 'TEST F — Search findings contain NO unsafe claims like "not indexed"');
  }
}

runSearchVisibilityHardeningTests().catch(err => {
  console.error('Search Visibility Hardening Test error:', err);
  process.exit(1);
});
