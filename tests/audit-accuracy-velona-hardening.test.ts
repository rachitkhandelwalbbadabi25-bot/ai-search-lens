import assert from 'node:assert';
import { extractPageEvidence } from '../src/lib/evidence-extractor';
import { evaluateTechnicalSeo } from '../src/lib/engines/seo-engine';
import { evaluateAiReadabilityAndContent } from '../src/lib/engines/ai-readability-engine';
import { calculateAuditScores } from '../src/lib/engines/scoring-engine';

async function runTests() {
  console.log('====================================================');
  console.log('   AUDIT ACCURACY & VELONA HARDENING REGRESSION SUITE   ');
  console.log('====================================================\n');

  // Test 1: Viewport found with standard and reversed attribute order
  {
    const htmlStandard = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body></body></html>`;
    const evStandard = extractPageEvidence(htmlStandard, 'https://example.com/t1a', 200);
    assert.strictEqual(evStandard.evidenceState?.head.viewport.status, 'FOUND', 'Test 1a: Standard viewport status is FOUND');

    const htmlReversed = `<!DOCTYPE html><html><head><meta content="width=device-width, initial-scale=1.0" name="VIEWPORT"></head><body></body></html>`;
    const evReversed = extractPageEvidence(htmlReversed, 'https://example.com/t1b', 200);
    assert.strictEqual(evReversed.evidenceState?.head.viewport.status, 'FOUND', 'Test 1b: Reversed attribute viewport status is FOUND');
    console.log('[PASS] Test 1 — Viewport found with standard and reversed attribute order');
  }

  // Test 2: Viewport absent in complete, verifiable HTML
  {
    const htmlNoViewport = `<!DOCTYPE html><html><head><title>No Viewport</title></head><body><p>Hello</p></body></html>`;
    const ev = extractPageEvidence(htmlNoViewport, 'https://example.com/t2', 200);
    assert.strictEqual(ev.evidenceState?.head.viewport.status, 'NOT_FOUND', 'Test 2: Viewport status is NOT_FOUND for complete HTML');
    const tech = evaluateTechnicalSeo(ev);
    assert(tech.some(f => f.id === 'seo-missing-viewport' || f.id === 'seo-no-viewport'), 'Test 2: Generates missing-viewport finding for verified NOT_FOUND');
    console.log('[PASS] Test 2 — Viewport absent in complete, verifiable HTML');
  }

  // Test 3: Viewport evidence unverified after extraction failure
  {
    const ev = extractPageEvidence('', 'https://example.com/t3', 500);
    assert.strictEqual(ev.evidenceState?.head.viewport.status, 'UNVERIFIED', 'Test 3: Viewport status is UNVERIFIED on fetch failure');
    const tech = evaluateTechnicalSeo(ev);
    assert(!tech.some(f => f.id === 'seo-missing-viewport' || f.id === 'seo-no-viewport'), 'Test 3: UNVERIFIED status does NOT generate missing-viewport finding');
    console.log('[PASS] Test 3 — Viewport evidence unverified after extraction failure');
  }

  // Test 4: Canonical present in a complete document
  {
    const htmlCanonical = `<!DOCTYPE html><html><head><link rel="canonical alternate" href="https://example.com/canonical-url"></head><body></body></html>`;
    const ev = extractPageEvidence(htmlCanonical, 'https://example.com/canonical-url', 200);
    assert.strictEqual(ev.evidenceState?.head.canonical.status, 'FOUND', 'Test 4: Canonical status is FOUND with combined rel tokens');
    assert.strictEqual(ev.canonical, 'https://example.com/canonical-url', 'Test 4: Canonical URL correctly extracted');
    console.log('[PASS] Test 4 — Canonical present in a complete document');
  }

  // Test 5: Canonical absent in complete, verifiable HTML
  {
    const htmlNoCanonical = `<!DOCTYPE html><html><head><title>No Canonical</title></head><body></body></html>`;
    const ev = extractPageEvidence(htmlNoCanonical, 'https://example.com/t5', 200);
    assert.strictEqual(ev.evidenceState?.head.canonical.status, 'NOT_FOUND', 'Test 5: Canonical status is NOT_FOUND when absent');
    console.log('[PASS] Test 5 — Canonical absent in complete, verifiable HTML');
  }

  // Test 6: Canonical unverified when extraction fails
  {
    const ev = extractPageEvidence('', 'https://example.com/t6', 500);
    assert.strictEqual(ev.evidenceState?.head.canonical.status, 'UNVERIFIED', 'Test 6: Canonical status is UNVERIFIED on fetch failure');
    console.log('[PASS] Test 6 — Canonical unverified when extraction fails');
  }

  // Test 7: JSON-LD Organization detection
  {
    const htmlOrg = `
      <!DOCTYPE html>
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "Velona Inc"
            }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const ev = extractPageEvidence(htmlOrg, 'https://example.com/t7', 200);
    assert(ev.structuredDataTypes.includes('Organization'), 'Test 7: Organization schema detected');
    console.log('[PASS] Test 7 — JSON-LD Organization detection');
  }

  // Test 8: SoftwareApplication detection
  {
    const htmlApp = `
      <!DOCTYPE html>
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "Velona API Gateway",
              "operatingSystem": "All"
            }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const ev = extractPageEvidence(htmlApp, 'https://example.com/t8', 200);
    assert(ev.structuredDataTypes.includes('SoftwareApplication'), 'Test 8: SoftwareApplication schema detected');
    console.log('[PASS] Test 8 — SoftwareApplication detection');
  }

  // Test 9: WebSite detection and exact missing-type reporting
  {
    const htmlOrgOnly = `
      <!DOCTYPE html>
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "Velona"
            }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const ev = extractPageEvidence(htmlOrgOnly, 'https://velona.in/', 200);
    ev.pageType = 'homepage';
    const searchData: any = { queryUsed: 'velona', targetPresentInSerp: false };
    const res = await evaluateAiReadabilityAndContent(ev, searchData);
    const schemaFinding = res.citationReadinessFindings.find(f => f.id === 'citation-missing-recommended-schema');

    assert(schemaFinding, 'Test 9: Finding created for missing optional WebSite schema');
    assert.strictEqual(schemaFinding.severity, 'INFO', 'Test 9: Severity is INFO when Organization is present');
    assert.strictEqual(schemaFinding.deductionPoints, 0, 'Test 9: deductionPoints is 0 when Organization is present');
    assert(schemaFinding.title.includes('WebSite'), 'Test 9: Exact missing type WebSite reported');
    console.log('[PASS] Test 9 — WebSite detection and exact missing-type reporting');
  }

  // Test 10: Multiple JSON-LD scripts, arrays, and `@graph`
  {
    const htmlMulti = `
      <!DOCTYPE html>
      <html>
        <head>
          <script type="application/ld+json">
            [
              { "@context": "https://schema.org", "@type": "Organization", "name": "Velona" },
              { "@context": "https://schema.org", "@type": "Offer", "price": "10", "priceCurrency": "INR" }
            ]
          </script>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@graph": [
                { "@type": "SoftwareApplication", "name": "Velona Platform" }
              ]
            }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const ev = extractPageEvidence(htmlMulti, 'https://velona.in/', 200);
    assert(ev.structuredDataTypes.includes('Organization'), 'Test 10: Organization detected from array');
    assert(ev.structuredDataTypes.includes('Offer'), 'Test 10: Offer detected from array');
    assert(ev.structuredDataTypes.includes('SoftwareApplication'), 'Test 10: SoftwareApplication detected from @graph');
    console.log('[PASS] Test 10 — Multiple JSON-LD scripts, arrays, and @graph');
  }

  // Test 11: Complete H1 text extraction with nested spans and whitespace
  {
    const htmlH1Spans = `
      <!DOCTYPE html>
      <html>
        <body>
          <h1><span>Every AI model.</span><span>One API.</span><span>Paid in Rupees.</span></h1>
        </body>
      </html>
    `;
    const ev = extractPageEvidence(htmlH1Spans, 'https://velona.in/', 200);
    const h1Text = ev.headings.find(h => h.level === 'h1')?.text;
    assert.strictEqual(h1Text, 'Every AI model. One API. Paid in Rupees.', 'Test 11: H1 text extracted with space between spans');
    console.log('[PASS] Test 11 — Complete H1 text extraction with nested spans and whitespace');
  }

  // Test 12: H1-to-H3 hierarchy detection
  {
    const htmlH1H3 = `
      <!DOCTYPE html>
      <html>
        <body>
          <h1>Every AI model. One API. Paid in Rupees.</h1>
          <h3>Gateway pulse, live</h3>
          <h2>Everything Indian developers need</h2>
        </body>
      </html>
    `;
    const ev = extractPageEvidence(htmlH1H3, 'https://velona.in/', 200);
    const tech = evaluateTechnicalSeo(ev);
    const skipFinding = tech.find(f => f.id === 'seo-heading-hierarchy-skipped');
    assert(skipFinding, 'Test 12: H1 directly followed by H3 triggers seo-heading-hierarchy-skipped');
    assert.strictEqual(skipFinding.deductionPoints, 1, 'Test 12: Deduction points is 1');
    console.log('[PASS] Test 12 — H1-to-H3 hierarchy detection');
  }

  // Test 13: Genuine H1 missing versus unverified
  {
    const htmlNoH1 = `<!DOCTYPE html><html><body><p>No H1 here</p></body></html>`;
    const evRendered = extractPageEvidence(htmlNoH1, 'https://example.com/t13a', 200, null, null, { renderedDom: true });
    assert.strictEqual(evRendered.evidenceState?.headings.h1Status, 'NOT_FOUND', 'Test 13a: Rendered HTML missing H1 is NOT_FOUND');
    const techRendered = evaluateTechnicalSeo(evRendered);
    assert(techRendered.some(f => f.id === 'seo-missing-h1'), 'Test 13a: Generates missing-H1 finding');

    const evUnverified = extractPageEvidence(htmlNoH1, 'https://example.com/t13b', 200, null, null, { renderedDom: false });
    assert.strictEqual(evUnverified.evidenceState?.headings.h1Status, 'UNVERIFIED', 'Test 13b: Static HTML shell with 0 H1 is UNVERIFIED');
    const techUnverified = evaluateTechnicalSeo(evUnverified);
    assert(!techUnverified.some(f => f.id === 'seo-missing-h1'), 'Test 13b: Does NOT generate missing-H1 finding');
    console.log('[PASS] Test 13 — Genuine H1 missing versus unverified');
  }

  // Test 14: SERP evidence with an exact matching URL and observed position
  {
    const searchData: any = {
      queryUsed: 'Velona',
      isInferredQuery: false,
      targetPresentInSerp: true,
      targetDomainPresentInSerp: true,
      targetRankPosition: 1,
      targetSerpTitle: 'Velona - Unified AI APIs',
      targetSerpSnippet: 'One API for 300+ AI models...',
      topCompetitors: [],
      searchIntent: 'brand',
      queryPageAlignmentScore: 95,
      isSearchUnverified: false,
      visibilityTier: 'Excellent',
      visibilityScore: 1.0,
      queries: [
        {
          query: 'Velona',
          kind: 'brand',
          ok: true,
          resultsCount: 10,
          exactPosition: 1,
          domainPosition: 1,
          relevantPosition: 1,
          tier: 'Excellent',
          provider: 'tinyfish',
          topResults: [],
        },
      ],
    };
    const scoring = calculateAuditScores([], [], [], [], searchData);
    assert.strictEqual(scoring.categories.searchVisibility.score, 25, 'Test 14: Rank #1 receives 25/25 Search Visibility score');
    const excellentFinding = scoring.allFindings.find(f => f.id === 'search-visibility-excellent');
    assert(excellentFinding, 'Test 14: Search visibility excellent finding created');
    assert.strictEqual(excellentFinding.deductionPoints, 0, 'Test 14: Zero score deduction applied');
    console.log('[PASS] Test 14 — SERP evidence with exact matching URL and observed position');
  }

  // Test 15: Search visibility unverified when no actual result evidence exists
  {
    const searchData: any = {
      queryUsed: 'Velona',
      isInferredQuery: false,
      targetPresentInSerp: false,
      targetDomainPresentInSerp: false,
      targetRankPosition: null,
      topCompetitors: [],
      searchIntent: 'brand',
      queryPageAlignmentScore: 50,
      isSearchUnverified: true,
      searchErrorMessage: 'SERP API connection unverified',
      visibilityTier: 'Unknown',
    };
    const scoring = calculateAuditScores([], [], [], [], searchData);
    assert.strictEqual(scoring.categories.searchVisibility.score, 25, 'Test 15: Unverified search visibility receives 25/25 score (0 penalty)');
    assert.strictEqual(scoring.categories.searchVisibility.status, 'unverified', 'Test 15: Category status is unverified');
    console.log('[PASS] Test 15 — Search visibility unverified when no actual result evidence exists');
  }

  // Test 16: Informational findings having zero score deduction
  {
    const infoFinding = {
      id: 'test-info-finding',
      category: 'citation_readiness' as const,
      severity: 'INFO' as const,
      title: 'Optional Structured Data Opportunity',
      evidence: { source: 'analysis' as const, location: 'head', observed: 'Info only', expected: 'Optional schema' },
      context: 'Informational note',
      whyItMatters: 'Optional enhancement',
      recommendedFix: 'Add optional schema',
      expectedImpact: 'Minor',
      confidence: 0.9,
      deductionPoints: 0,
    };
    const scoring = calculateAuditScores([], [], [], [infoFinding], { isSearchUnverified: true } as any);
    assert.strictEqual(scoring.categories.citationReadiness.score, 10, 'Test 16: INFO finding with 0 deduction points does NOT reduce category score');
    console.log('[PASS] Test 16 — Informational findings having zero score deduction');
  }

  // Test 17: Category totals and overall score reconciliation
  // Test 17: Category totals and overall score reconciliation
  {
    const htmlFull = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Velona, Unified AI APIs for Indian Developers</title>
          <meta name="description" content="Velona provides unified AI APIs for Indian developers paid in Indian Rupees with high performance, instant setup, and zero management overhead.">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link rel="canonical" href="https://velona.in/">
          <script type="application/ld+json">
            { "@context": "https://schema.org", "@type": "Organization", "name": "Velona" }
          </script>
          <script type="application/ld+json">
            { "@context": "https://schema.org", "@type": "SoftwareApplication", "name": "Velona API" }
          </script>
        </head>
        <body>
          <h1>Every AI model. One API. Paid in Rupees.</h1>
          <p>Full substantive paragraph describing the platform and offerings for developers in India. Velona offers unified API access across multiple foundation models with simple billing in Indian Rupees, high availability guarantees, enterprise security features, and developer-friendly documentation. Developers can integrate top AI models instantly using a single unified interface with complete transparency on usage and costs.</p>
          <h3>Gateway pulse, live</h3>
          <h2>Everything Indian developers need</h2>
          <p>Velona eliminates the friction of managing separate API subscriptions, international credit cards, and complex multi-vendor invoice reconciliation. Our platform provides high throughput, ultralow latency routing, automated fallbacks across model providers, granular rate limiting, team access controls, and real-time observability dashboards built specifically for fast-growing engineering teams in India. We empower software builders with reliable scalable infrastructure tailored for domestic payment systems and low latency regional edge deployments. Our unified developer platform supports seamless API key rotation, automated usage alerts, comprehensive SDKs for Node.js, Python, and Go, as well as enterprise SLA guarantees with round-the-clock technical support.</p>
        </body>
      </html>
    `;
    const ev = extractPageEvidence(htmlFull, 'https://velona.in/', 200);
    ev.pageType = 'homepage';
    const tech = evaluateTechnicalSeo(ev);
    const searchData: any = { isSearchUnverified: true };
    const aiRes = await evaluateAiReadabilityAndContent(ev, searchData);
    const scoring = calculateAuditScores(
      tech,
      aiRes.aiReadabilityFindings,
      aiRes.contentIntentFindings,
      aiRes.citationReadinessFindings,
      searchData
    );

    const sumCategory =
      scoring.categories.technicalSeo.score +
      scoring.categories.searchVisibility.score +
      scoring.categories.aiReadability.score +
      scoring.categories.contentIntent.score +
      scoring.categories.citationReadiness.score;

    assert.strictEqual(scoring.overallScore, sumCategory, 'Test 17: Overall score equals sum of category scores');
    assert.strictEqual(scoring.overallScore, 99, 'Test 17: Overall score for Velona full evidence is 99/100 (24 + 25 + 25 + 15 + 10)');
    console.log('[PASS] Test 17 — Category totals and overall score reconciliation');
  }

  // Test 18: Regression tests for existing exact-target and redirect behavior
  {
    const htmlRedirect = `<!DOCTYPE html><html><head><link rel="canonical" href="https://velona.in/"></head><body><h1>Title</h1><h2>H2</h2></body></html>`;
    const ev = extractPageEvidence(htmlRedirect, 'https://velona.in/', 200);
    ev.isRedirected = true;
    ev.finalUrl = 'https://velona.in/';
    ev.requestedUrl = 'http://velona.in/';
    ev.redirect = {
      requestedUrl: 'http://velona.in/',
      finalUrl: 'https://velona.in/',
      hops: [],
      httpRedirectCount: 1,
      isClientSide: false,
      isLoop: false,
      kind: 'normalization',
      permanent: true,
      traceAvailable: true,
    };
    const tech = evaluateTechnicalSeo(ev);
    const redirectFinding = tech.find(f => f.id === 'seo-page-redirected');
    assert(redirectFinding, 'Test 18: HTTP to HTTPS upgrade creates informational notice');
    assert.strictEqual(redirectFinding.deductionPoints, 0, 'Test 18: HTTP to HTTPS upgrade has 0 deduction points');
    console.log('[PASS] Test 18 — Regression tests for existing exact-target and redirect behavior');
  }

  console.log('\n====================================================');
  console.log(' ALL 18 AUDIT ACCURACY & VELONA TESTS PASSED CLEANLY!');
  console.log('====================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
