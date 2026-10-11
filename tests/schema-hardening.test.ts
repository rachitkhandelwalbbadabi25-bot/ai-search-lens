import { extractPageEvidence } from '../src/lib/evidence-extractor';
import { evaluateAiReadabilityAndContent } from '../src/lib/engines/ai-readability-engine';
import { recommendSchemaTypes } from '../src/lib/page-context';
import { SearchVisibilityData } from '../src/types/audit';

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
  } else {
    console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    process.exitCode = 1;
  }
}

const mockSearch: SearchVisibilityData = {
  queryUsed: 'Test Query',
  isInferredQuery: true,
  targetPresentInSerp: true,
  targetDomainPresentInSerp: true,
  targetRankPosition: 1,
  targetSerpTitle: 'Test Title',
  targetSerpSnippet: 'Test Snippet',
  topCompetitors: [],
  searchIntent: 'Informational',
  queryPageAlignmentScore: 100,
  isSearchUnverified: false,
};

async function runSchemaHardeningTests() {
  console.log('====================================================');
  console.log('   PHASE 3 — SCHEMA DETECTION & RECOMMENDATION SUITE ');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // TEST A — JSON-LD Organization
  // ----------------------------------------------------
  {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Test Organization"
        }
        </script>
      </head>
      <body></body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://example.com', 200);
    const sd = ev.evidenceState!.structuredData;
    const orgDetail = sd.typesWithDetails?.find(d => d.type === 'Organization');

    assert(sd.status === 'FOUND', 'TEST A — Status is FOUND');
    assert(sd.types.includes('Organization'), 'TEST A — Organization detected');
    assert(!!orgDetail && orgDetail.format === 'JSON-LD', 'TEST A — Format is JSON-LD');
  }

  // ----------------------------------------------------
  // TEST B — JSON-LD WebSite
  // ----------------------------------------------------
  {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "Test WebSite"
        }
        </script>
      </head>
      <body></body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://example.com', 200);
    const sd = ev.evidenceState!.structuredData;

    assert(sd.types.includes('WebSite'), 'TEST B — WebSite detected');
  }

  // ----------------------------------------------------
  // TEST C — JSON-LD @graph
  // ----------------------------------------------------
  {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "Organization", "name": "Graph Org" },
            { "@type": "WebSite", "name": "Graph Site" },
            { "@type": "BreadcrumbList" }
          ]
        }
        </script>
      </head>
      <body></body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://example.com', 200);
    const sd = ev.evidenceState!.structuredData;

    assert(
      sd.types.includes('Organization') && sd.types.includes('WebSite') && sd.types.includes('BreadcrumbList'),
      'TEST C — JSON-LD @graph all three types detected',
      `Observed types: ${sd.types.join(', ')}`
    );
  }

  // ----------------------------------------------------
  // TEST D — JSON-LD array
  // ----------------------------------------------------
  {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">
        [
          { "@context": "https://schema.org", "@type": "Organization" },
          { "@context": "https://schema.org", "@type": "WebSite" }
        ]
        </script>
      </head>
      <body></body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://example.com', 200);
    const sd = ev.evidenceState!.structuredData;

    assert(
      sd.types.includes('Organization') && sd.types.includes('WebSite'),
      'TEST D — JSON-LD top-level array all types detected'
    );
  }

  // ----------------------------------------------------
  // TEST E — Microdata Organization
  // ----------------------------------------------------
  {
    const html = `
      <html>
      <body>
        <div itemscope itemtype="https://schema.org/Organization">
          <span itemprop="name">Microdata Org</span>
        </div>
      </body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://example.com', 200);
    const sd = ev.evidenceState!.structuredData;
    const orgDetail = sd.typesWithDetails?.find(d => d.type === 'Organization');

    assert(sd.types.includes('Organization'), 'TEST E — Microdata Organization detected');
    assert(!!orgDetail && orgDetail.format === 'Microdata', 'TEST E — Format is Microdata');
  }

  // ----------------------------------------------------
  // TEST F — RDFa Organization
  // ----------------------------------------------------
  {
    const html = `
      <html vocab="https://schema.org/">
      <body>
        <div typeof="Organization">
          <span property="name">RDFa Org</span>
        </div>
      </body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://example.com', 200);
    const sd = ev.evidenceState!.structuredData;
    const orgDetail = sd.typesWithDetails?.find(d => d.type === 'Organization');

    assert(sd.types.includes('Organization'), 'TEST F — RDFa Organization detected');
    assert(!!orgDetail && orgDetail.format === 'RDFa', 'TEST F — Format is RDFa');
  }

  // ----------------------------------------------------
  // TEST G — No Schema
  // ----------------------------------------------------
  {
    const html = '<html><head><title>No Schema Page</title></head><body><h1>Hello</h1></body></html>';
    const ev = extractPageEvidence(html, 'https://example.com', 200);
    const sd = ev.evidenceState!.structuredData;

    assert(sd.status === 'NOT_FOUND', 'TEST G — Valid HTML with no schema has NOT_FOUND status (not UNVERIFIED)');
  }

  // ----------------------------------------------------
  // TEST H — Schema source unavailable
  // ----------------------------------------------------
  {
    const ev = extractPageEvidence('', 'https://example.com/error', 500);
    const sd = ev.evidenceState!.structuredData;
    const aiResult = await evaluateAiReadabilityAndContent(ev, mockSearch);
    const hasSchemaFinding = aiResult.citationReadinessFindings.some(f =>
      f.id.includes('schema') || f.id.includes('citation-unattributed')
    );

    assert(sd.status === 'UNVERIFIED', 'TEST H — Fetch status 500 results in UNVERIFIED structuredData');
    assert(!hasSchemaFinding, 'TEST H — UNVERIFIED status produces NO missing-schema finding');
  }

  // ----------------------------------------------------
  // TEST I — Duplicate schema formats
  // ----------------------------------------------------
  {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">
        { "@context": "https://schema.org", "@type": "Organization" }
        </script>
      </head>
      <body>
        <div itemscope itemtype="https://schema.org/Organization"></div>
      </body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://example.com', 200);
    const sd = ev.evidenceState!.structuredData;
    const orgCount = sd.types.filter(t => t === 'Organization').length;

    assert(orgCount === 1, 'TEST I — Organization appears exactly once in normalized types array');
  }

  // ----------------------------------------------------
  // TEST J — Homepage recommendation
  // ----------------------------------------------------
  {
    const html = '<html><head><title>Homepage</title></head><body><h1>Welcome</h1></body></html>';
    const ev = extractPageEvidence(html, 'https://example.com/', 200);
    ev.pageType = 'homepage';
    const aiResult = await evaluateAiReadabilityAndContent(ev, mockSearch);
    const finding = aiResult.citationReadinessFindings.find(f => f.id === 'citation-unattributed-claims');

    assert(
      !!finding && finding.recommendedFix.includes('Organization') && finding.recommendedFix.includes('WebSite'),
      'TEST J — Homepage with no schema recommends Organization and WebSite'
    );
  }

  // ----------------------------------------------------
  // TEST K — Article recommendation
  // ----------------------------------------------------
  {
    const html = '<html><head><title>Article Title</title></head><body><h1>Article</h1><p>Text</p></body></html>';
    const ev = extractPageEvidence(html, 'https://example.com/blog/post-1', 200);
    ev.pageType = 'article';
    const aiResult = await evaluateAiReadabilityAndContent(ev, mockSearch);
    const finding = aiResult.citationReadinessFindings.find(f => f.id === 'citation-unattributed-claims');

    assert(
      !!finding && finding.recommendedFix.includes('Article'),
      'TEST K — Article page with no schema recommends Article schema'
    );
  }

  // ----------------------------------------------------
  // TEST L — Product recommendation
  // ----------------------------------------------------
  {
    const html = '<html><head><title>Awesome Product</title></head><body><h1>Awesome Product</h1></body></html>';
    const ev = extractPageEvidence(html, 'https://example.com/product/123', 200);
    ev.pageType = 'product';
    const aiResult = await evaluateAiReadabilityAndContent(ev, mockSearch);
    const finding = aiResult.citationReadinessFindings.find(f => f.id === 'citation-unattributed-claims');

    assert(
      !!finding && finding.recommendedFix.includes('Product'),
      'TEST L — Product page with no schema recommends Product schema'
    );
  }

  // ----------------------------------------------------
  // TEST M — App / dashboard / login
  // ----------------------------------------------------
  {
    const html = '<html><head><title>Sign In</title></head><body><h1>Sign In</h1></body></html>';
    const ev = extractPageEvidence(html, 'https://example.com/login', 200);
    ev.pageType = 'login';
    const aiResult = await evaluateAiReadabilityAndContent(ev, mockSearch);
    const schemaFinding = aiResult.citationReadinessFindings.find(f =>
      f.id === 'citation-unattributed-claims' || f.id === 'citation-missing-recommended-schema'
    );

    assert(
      !schemaFinding,
      'TEST M — Login/app page with no schema produces NO inappropriate schema recommendation'
    );
  }

  // ----------------------------------------------------
  // TEST N — Existing schema suppresses recommendation
  // ----------------------------------------------------
  {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">
        { "@context": "https://schema.org", "@type": "Organization", "name": "Existing Org" }
        </script>
      </head>
      <body><h1>Homepage</h1></body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://example.com/', 200);
    ev.pageType = 'homepage';
    const aiResult = await evaluateAiReadabilityAndContent(ev, mockSearch);
    const rec = recommendSchemaTypes('homepage', ev.structuredDataTypes);

    assert(!rec.missing.includes('Organization'), 'TEST N — Organization suppressed from missing list when already present');
    const finding = aiResult.citationReadinessFindings.find(f => f.id === 'citation-missing-recommended-schema');
    if (finding) {
      assert(!finding.recommendedFix.includes('Organization'), 'TEST N — Finding does NOT ask to add Organization again');
    } else {
      assert(true, 'TEST N — No missing Organization finding');
    }
  }

  // ----------------------------------------------------
  // TEST O — Non-Schema RDFa
  // ----------------------------------------------------
  {
    const html = `
      <html vocab="http://ogp.me/ns#">
      <body>
        <div typeof="article">
          <span property="title">Non-Schema Article</span>
        </div>
      </body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://example.com', 200);
    const sd = ev.evidenceState!.structuredData;

    assert(!sd.types.includes('article') && !sd.types.includes('Article'), 'TEST O — Non-Schema.org RDFa vocabulary not classified as Schema.org');
  }

  // ----------------------------------------------------
  // REAL-WORLD FIXTURES SUITE
  // ----------------------------------------------------

  // Microsoft-like fixture
  {
    const msFixture = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Microsoft – Cloud, Computers, Apps & Gaming</title>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "Organization", "name": "Microsoft", "url": "https://www.microsoft.com" },
            { "@type": "WebSite", "name": "Microsoft", "url": "https://www.microsoft.com" }
          ]
        }
        </script>
      </head>
      <body><h1>Microsoft</h1></body>
      </html>
    `;
    const ev = extractPageEvidence(msFixture, 'https://microsoft.com', 200);
    const sd = ev.evidenceState!.structuredData;
    assert(sd.types.includes('Organization') && sd.types.includes('WebSite'), 'REAL-WORLD FIXTURE — Microsoft JSON-LD graph parsed correctly');
  }

  // Stripe-like fixture
  {
    const stripeFixture = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Stripe | Financial Infrastructure for the Internet</title>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Corporation",
          "name": "Stripe",
          "url": "https://stripe.com"
        }
        </script>
      </head>
      <body>
        <div itemscope itemtype="https://schema.org/BreadcrumbList"></div>
      </body>
      </html>
    `;
    const ev = extractPageEvidence(stripeFixture, 'https://stripe.com', 200);
    const sd = ev.evidenceState!.structuredData;
    assert(sd.types.includes('Corporation') && sd.types.includes('BreadcrumbList'), 'REAL-WORLD FIXTURE — Stripe Corporation & Microdata BreadcrumbList detected');
  }

  // AWS-like fixture
  {
    const awsFixture = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>AWS Documentation</title>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "TechArticle",
          "headline": "Getting Started with Amazon S3"
        }
        </script>
      </head>
      <body><h1>Amazon S3 Guide</h1></body>
      </html>
    `;
    const ev = extractPageEvidence(awsFixture, 'https://docs.aws.amazon.com', 200);
    const sd = ev.evidenceState!.structuredData;
    assert(sd.types.includes('TechArticle'), 'REAL-WORLD FIXTURE — AWS TechArticle detected');
  }
}

runSchemaHardeningTests().catch(err => {
  console.error('Schema Hardening Test error:', err);
  process.exit(1);
});
