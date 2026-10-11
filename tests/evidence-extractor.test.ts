import { extractPageEvidence } from '../src/lib/evidence-extractor';
import { evaluateTechnicalSeo } from '../src/lib/engines/seo-engine';
import { evaluateAiReadabilityAndContent } from '../src/lib/engines/ai-readability-engine';
import { PageStructureData, SearchVisibilityData } from '../src/types/audit';

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
  } else {
    console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    process.exitCode = 1;
  }
}

async function runEvidenceExtractorTests() {
  console.log('====================================================');
  console.log('   EVIDENCE EXTRACTOR RELIABILITY HARDENING SUITE  ');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // TEST A — Complete metadata page
  // ----------------------------------------------------
  {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <title>Complete Test Page Title</title>
        <meta name="description" content="This is a complete test description for evidence extraction testing.">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="robots" content="index, follow">
        <link rel="canonical" href="https://example.com/complete">
        <meta property="og:title" content="OG Complete Title">
        <meta property="og:description" content="OG Complete Description">
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Complete Corp",
          "url": "https://example.com",
          "sameAs": ["https://twitter.com/completecorp"]
        }
        </script>
      </head>
      <body>
        <h1>Primary Heading Here</h1>
        <h2>Subheading Section 1</h2>
        <a href="/about-us">About Us</a>
        <a href="/contact-us">Contact Support</a>
        <a href="https://github.com/completecorp">GitHub Profile</a>
      </body>
      </html>
    `;

    const evidence = extractPageEvidence(html, 'https://example.com/complete', 200);
    const state = evidence.evidenceState!;

    assert(state.headInspected && state.domInspected, 'TEST A — Head and DOM successfully inspected');
    assert(state.head.title.status === 'FOUND' && state.head.title.value === 'Complete Test Page Title', 'TEST A — Title is FOUND');
    assert(state.head.metaDescription.status === 'FOUND' && Boolean(state.head.metaDescription.value?.includes('complete test description')), 'TEST A — Meta description is FOUND');
    assert(state.head.viewport.status === 'FOUND', 'TEST A — Viewport is FOUND');
    assert(state.head.canonical.status === 'FOUND' && state.head.canonical.value === 'https://example.com/complete', 'TEST A — Canonical is FOUND');
    assert(state.head.robotsMeta.status === 'FOUND', 'TEST A — Robots meta is FOUND');
    assert(state.headings.h1Status === 'FOUND' && state.headings.h1Count === 1, 'TEST A — H1 is FOUND');
    assert(state.structuredData.status === 'FOUND' && state.structuredData.types.includes('Organization'), 'TEST A — Structured data is FOUND with Organization');
    assert(state.entityPublisher.aboutLink.status === 'FOUND', 'TEST A — About link is FOUND');
    assert(state.entityPublisher.contactLink.status === 'FOUND', 'TEST A — Contact link is FOUND');
    assert(state.entityPublisher.socialProfiles.status === 'FOUND', 'TEST A — Social profile is FOUND');
  }

  // ----------------------------------------------------
  // TEST B — Valid page with genuinely missing elements
  // ----------------------------------------------------
  {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Minimal Valid Page</title>
      </head>
      <body>
        <p>Just plain text content without headings or schema.</p>
      </body>
      </html>
    `;

    const evidence = extractPageEvidence(html, 'https://example.com/minimal', 200);
    const state = evidence.evidenceState!;

    assert(state.headInspected && state.domInspected, 'TEST B — Head and DOM inspected for minimal page');
    assert(state.head.viewport.status === 'NOT_FOUND', 'TEST B — Viewport status is NOT_FOUND (not UNVERIFIED)');
    assert(state.head.canonical.status === 'NOT_FOUND', 'TEST B — Canonical status is NOT_FOUND');
    assert(state.headings.h1Status === 'NOT_FOUND', 'TEST B — H1 status is NOT_FOUND');
    assert(state.structuredData.status === 'NOT_FOUND', 'TEST B — Structured data status is NOT_FOUND');
    assert(state.entityPublisher.aboutLink.status === 'NOT_FOUND', 'TEST B — About link status is NOT_FOUND');
  }

  // ----------------------------------------------------
  // TEST C — Extraction unavailable
  // ----------------------------------------------------
  {
    const evidence500 = extractPageEvidence('', 'https://example.com/failed', 500);
    const state500 = evidence500.evidenceState!;

    assert(!state500.headInspected && !state500.domInspected, 'TEST C — Head and DOM inspection marked false for failed fetch');
    assert(state500.head.viewport.status === 'UNVERIFIED', 'TEST C — Viewport status is UNVERIFIED on fetch failure');
    assert(state500.head.title.status === 'UNVERIFIED', 'TEST C — Title status is UNVERIFIED on fetch failure');
    assert(state500.headings.h1Status === 'UNVERIFIED', 'TEST C — H1 status is UNVERIFIED on fetch failure');
    assert(state500.structuredData.status === 'UNVERIFIED', 'TEST C — Structured data status is UNVERIFIED on fetch failure');
    assert(Boolean(state500.head.viewport.reason?.includes('failed')), 'TEST C — Explicit reason provided for UNVERIFIED state');
  }

  // ----------------------------------------------------
  // TEST D — JSON-LD Detection
  // ----------------------------------------------------
  {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": ["WebSite", "Organization"],
          "name": "Acme Inc"
        }
        </script>
      </head>
      <body></body>
      </html>
    `;

    const evidence = extractPageEvidence(html, 'https://example.com', 200);
    const sd = evidence.evidenceState!.structuredData;

    assert(sd.status === 'FOUND', 'TEST D — JSON-LD overall status FOUND');
    assert(sd.jsonLd.status === 'FOUND', 'TEST D — jsonLd format status FOUND');
    assert(sd.types.includes('WebSite') && sd.types.includes('Organization'), 'TEST D — WebSite and Organization types detected');
    assert(sd.schemaOrgName === 'Acme Inc', 'TEST D — Schema name extracted correctly');
  }

  // ----------------------------------------------------
  // TEST E — Microdata Detection
  // ----------------------------------------------------
  {
    const html = `
      <html>
      <body>
        <div itemscope itemtype="https://schema.org/Organization">
          <span itemprop="name">Microdata Org</span>
          <link itemprop="sameAs" href="https://twitter.com/microdataorg">
        </div>
      </body>
      </html>
    `;

    const evidence = extractPageEvidence(html, 'https://example.com', 200);
    const sd = evidence.evidenceState!.structuredData;

    assert(sd.status === 'FOUND', 'TEST E — Structured data FOUND via Microdata');
    assert(sd.microdata.status === 'FOUND', 'TEST E — microdata format status FOUND');
    assert(sd.types.includes('Organization'), 'TEST E — Microdata Organization type detected');
    assert((evidence.sameAsLinks || []).includes('https://twitter.com/microdataorg'), 'TEST E — Microdata sameAs link extracted');
  }

  // ----------------------------------------------------
  // TEST F — RDFa Detection
  // ----------------------------------------------------
  {
    const html = `
      <html vocab="https://schema.org/">
      <body>
        <div typeof="Organization">
          <span property="name">RDFa Corp</span>
        </div>
      </body>
      </html>
    `;

    const evidence = extractPageEvidence(html, 'https://example.com', 200);
    const sd = evidence.evidenceState!.structuredData;

    assert(sd.status === 'FOUND', 'TEST F — Structured data FOUND via RDFa');
    assert(sd.rdfa.status === 'FOUND', 'TEST F — rdfa format status FOUND');
    assert(sd.types.includes('Organization'), 'TEST F — RDFa Organization type detected');
  }

  // ----------------------------------------------------
  // TEST G — Headings Detection & Ordering
  // ----------------------------------------------------
  {
    const html = `
      <html>
      <body>
        <h1>The Main Headline</h1>
        <h2>First Subheading</h2>
        <h2>Second Subheading</h2>
        <h3>Nested Section</h3>
      </body>
      </html>
    `;

    const evidence = extractPageEvidence(html, 'https://example.com', 200);
    const headings = evidence.evidenceState!.headings;

    assert(headings.status === 'FOUND', 'TEST G — Headings status is FOUND');
    assert(headings.h1Count === 1 && headings.h2Count === 2, 'TEST G — H1 count=1, H2 count=2');
    assert(headings.headings[0].text === 'The Main Headline' && headings.headings[0].level === 1, 'TEST G — H1 ordering & level correct');
    assert(headings.headings[1].text === 'First Subheading' && headings.headings[1].level === 2, 'TEST G — H2 ordering & level correct');
  }

  // ----------------------------------------------------
  // TEST H — Publisher & Entity Links (href, aria-label, title)
  // ----------------------------------------------------
  {
    const html = `
      <html>
      <body>
        <a href="/company/about" aria-label="Our Story">Read More</a>
        <a href="https://help.example.com" title="Contact Us">Help Desk</a>
        <a href="https://linkedin.com/company/example">LinkedIn</a>
        <a href="https://x.com/example">X Profile</a>
      </body>
      </html>
    `;

    const evidence = extractPageEvidence(html, 'https://example.com', 200);
    const ep = evidence.evidenceState!.entityPublisher;

    assert(ep.aboutLink.status === 'FOUND', 'TEST H — About link detected via href pattern & aria-label');
    assert(ep.contactLink.status === 'FOUND', 'TEST H — Contact link detected via title attribute');
    assert(ep.socialProfiles.status === 'FOUND' && ep.socialProfiles.links.length === 2, 'TEST H — Social profiles detected (LinkedIn, X)');
  }

  // ----------------------------------------------------
  // TEST I — Real-world Failure Pattern Fixtures
  // ----------------------------------------------------

  // OpenAI-like fixture: HTML containing JSON-LD inside script and H1
  {
    const openAiFixture = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>OpenAI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "OpenAI",
          "url": "https://openai.com",
          "sameAs": ["https://twitter.com/OpenAI", "https://linkedin.com/company/openai"]
        }
        </script>
      </head>
      <body>
        <h1>Creating safe AGI that benefits all of humanity</h1>
        <h2>Research Overview</h2>
        <a href="/about">About OpenAI</a>
        <a href="/contact">Contact Sales</a>
      </body>
      </html>
    `;

    const evidence = extractPageEvidence(openAiFixture, 'https://openai.com', 200);
    const ep = evidence.evidenceState!.entityPublisher;
    const sd = evidence.evidenceState!.structuredData;

    assert(evidence.evidenceState!.head.viewport.status === 'FOUND', 'TEST I (OpenAI) — Viewport FOUND');
    assert(sd.status === 'FOUND' && sd.types.includes('Organization'), 'TEST I (OpenAI) — Schema Organization FOUND');
    assert(evidence.evidenceState!.headings.h1Count === 1, 'TEST I (OpenAI) — H1 FOUND');
    assert(ep.aboutLink.status === 'FOUND' && ep.contactLink.status === 'FOUND', 'TEST I (OpenAI) — About & Contact FOUND');
    assert(ep.socialProfiles.links.length >= 2, 'TEST I (OpenAI) — Social profiles FOUND');
  }

  // Hugging Face-like fixture: Links with aria-label & SVG icons
  {
    const huggingFaceFixture = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Hugging Face – The AI community building the future.</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body>
        <h1>The AI community building the future.</h1>
        <a href="https://github.com/huggingface" aria-label="GitHub Repository">
          <svg><path d="..."></path></svg>
        </a>
        <a href="https://twitter.com/huggingface" aria-label="Follow us on Twitter">
          <svg><path d="..."></path></svg>
        </a>
        <a href="/join-us" aria-label="About Hugging Face">About</a>
      </body>
      </html>
    `;

    const evidence = extractPageEvidence(huggingFaceFixture, 'https://huggingface.co', 200);
    const ep = evidence.evidenceState!.entityPublisher;

    assert(evidence.evidenceState!.headings.h1Count === 1, 'TEST I (HuggingFace) — H1 FOUND');
    assert(ep.socialProfiles.status === 'FOUND' && ep.socialProfiles.links.length === 2, 'TEST I (HuggingFace) — Social links found via SVG links with aria-label');
    assert(ep.aboutLink.status === 'FOUND', 'TEST I (HuggingFace) — About link FOUND');
  }

  // Stack Overflow-like fixture: RDFa / Microdata metadata
  {
    const stackOverflowFixture = `
      <!DOCTYPE html>
      <html typeof="schema:WebSite">
      <head>
        <title>Stack Overflow - Where Developers Learn, Share, & Build Careers</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body>
        <h1>Every developer has a tab open to Stack Overflow</h1>
        <h2>For teams</h2>
        <a href="/company/about">About Company</a>
        <a href="https://stackoverflow.co/contact">Contact Us</a>
      </body>
      </html>
    `;

    const evidence = extractPageEvidence(stackOverflowFixture, 'https://stackoverflow.com', 200);
    const sd = evidence.evidenceState!.structuredData;
    const ep = evidence.evidenceState!.entityPublisher;

    assert(sd.status === 'FOUND' && sd.types.includes('WebSite'), 'TEST I (StackOverflow) — WebSite RDFa detected');
    assert(ep.aboutLink.status === 'FOUND' && ep.contactLink.status === 'FOUND', 'TEST I (StackOverflow) — About & Contact FOUND');
  }

  // ----------------------------------------------------
  // PHASE 2 — HEADING LOGIC HARDENING TESTS (TESTS A - L)
  // ----------------------------------------------------

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

  // Phase 2 — TEST A: One H1
  {
    const html = '<html><body><h1>Main topic headline</h1></body></html>';
    const ev = extractPageEvidence(html, 'https://example.com', 200);
    assert(ev.evidenceState!.headings.h1Status === 'FOUND' && ev.h1Count === 1, 'Phase 2 TEST A — One H1 FOUND');
  }

  // Phase 2 — TEST B: No H1
  {
    const html = '<html><body><p>Some paragraph content without H1 heading.</p></body></html>';
    const ev = extractPageEvidence(html, 'https://example.com', 200);
    const tech = evaluateTechnicalSeo(ev);
    assert(ev.evidenceState!.headings.h1Status === 'NOT_FOUND' && tech.some(f => f.id === 'seo-missing-h1'), 'Phase 2 TEST B — No H1 NOT_FOUND & seo-missing-h1 generated');
  }

  // Phase 2 — TEST C: Multiple H1
  {
    const html = '<html><body><h1>First Topic Headline</h1><h1>Second Topic Headline</h1></body></html>';
    const ev = extractPageEvidence(html, 'https://example.com', 200);
    const tech = evaluateTechnicalSeo(ev);
    assert(ev.h1Count === 2 && tech.some(f => f.id === 'seo-multiple-h1'), 'Phase 2 TEST C — Multiple H1 count=2 & seo-multiple-h1 generated');
  }

  // Phase 2 — TEST D: H1 + H2 hierarchy
  {
    const html = '<html><body><h1>Main Topic</h1><h2>Sub Section 1</h2><h2>Sub Section 2</h2></body></html>';
    const ev = extractPageEvidence(html, 'https://example.com', 200);
    assert(ev.headings.length === 3 && ev.headings[0].level === 'h1' && ev.headings[1].level === 'h2', 'Phase 2 TEST D — Heading levels & ordering preserved');
  }

  // Phase 2 — TEST E: No H2 on short homepage
  {
    const html = '<html><body><h1>Homepage Title</h1><p>Short homepage content paragraph with under 100 words.</p></body></html>';
    const ev = extractPageEvidence(html, 'https://example.com/', 200);
    ev.pageType = 'homepage';
    const ai = await evaluateAiReadabilityAndContent(ev, mockSearch);
    assert(!ai.aiReadabilityFindings.some(f => f.id === 'ai-missing-h2-subheadings'), 'Phase 2 TEST E — No automatic H2 finding on short homepage');
  }

  // Phase 2 — TEST F: No H2 on app/dashboard
  {
    const html = '<html><body><h1>Dashboard Title</h1><button>Action Button</button></body></html>';
    const ev = extractPageEvidence(html, 'https://example.com/dashboard', 200);
    ev.pageType = 'dashboard';
    const ai = await evaluateAiReadabilityAndContent(ev, mockSearch);
    assert(!ai.aiReadabilityFindings.some(f => f.id === 'ai-missing-h2-subheadings'), 'Phase 2 TEST F — No automatic H2 finding on app/dashboard');
  }

  // Phase 2 — TEST G: Long article with no H2
  {
    const longPara = '<p>This is a long and comprehensive paragraph of editorial content detailing essential background context, deep technical analysis, and extensive explanations across the entire article topic without subheadings.</p>';
    const paragraphs = Array(20).fill(longPara).join('');
    const html = `<html><body><h1>Long Article Title</h1>${paragraphs}</body></html>`;
    const ev = extractPageEvidence(html, 'https://example.com/blog/article-1', 200);
    ev.pageType = 'article';
    const ai = await evaluateAiReadabilityAndContent(ev, mockSearch);
    assert(ai.aiReadabilityFindings.some(f => f.id === 'ai-missing-h2-subheadings'), 'Phase 2 TEST G — Structural H2 subheadings finding generated on long article with 0 H2');
  }

  // Phase 2 — TEST H: H1 + intro paragraph
  {
    const html = '<html><body><h1>Main Topic Heading</h1><p>This is a complete, clear introductory summary paragraph explaining the core offering and purpose of this page.</p></body></html>';
    const ev = extractPageEvidence(html, 'https://example.com/article', 200);
    ev.pageType = 'article';
    const ai = await evaluateAiReadabilityAndContent(ev, mockSearch);
    assert(!ai.aiReadabilityFindings.some(f => f.id === 'ai-weak-page-definition'), 'Phase 2 TEST H — NO weak page definition finding when H1 has clear intro paragraph');
  }

  // Phase 2 — TEST I: H1 + descriptive div
  {
    const html = '<html><body><h1>Main Topic Heading</h1><div class="hero-subtitle">Descriptive hero subtitle text explaining product offering clearly in a div container.</div></body></html>';
    const ev = extractPageEvidence(html, 'https://example.com/product', 200);
    ev.pageType = 'product';
    const ai = await evaluateAiReadabilityAndContent(ev, mockSearch);
    assert(!ai.aiReadabilityFindings.some(f => f.id === 'ai-weak-page-definition'), 'Phase 2 TEST I — NO weak page definition finding when H1 has descriptive div subtitle');
  }

  // Phase 2 — TEST J: No H1 (MANDATORY DEPENDENCY FIX TEST)
  {
    const html = '<html><body><h2>Subheading Only</h2><p>Paragraph content without any H1 element on page.</p></body></html>';
    const ev = extractPageEvidence(html, 'https://example.com/no-h1', 200);
    ev.pageType = 'article';
    const tech = evaluateTechnicalSeo(ev);
    const ai = await evaluateAiReadabilityAndContent(ev, mockSearch);
    assert(tech.some(f => f.id === 'seo-missing-h1'), 'Phase 2 TEST J — Missing H1 finding generated');
    assert(!ai.aiReadabilityFindings.some(f => f.id === 'ai-weak-page-definition'), 'Phase 2 TEST J — MANDATORY DEPENDENCY FIX: NO weak page definition finding generated when H1 is missing');
  }

  // Phase 2 — TEST K: DOM extraction unavailable
  {
    const ev = extractPageEvidence('', 'https://example.com/failed', 500);
    const tech = evaluateTechnicalSeo(ev);
    const ai = await evaluateAiReadabilityAndContent(ev, mockSearch);
    assert(ev.evidenceState!.headings.status === 'UNVERIFIED', 'Phase 2 TEST K — Heading evidence is UNVERIFIED');
    assert(!tech.some(f => f.id === 'seo-missing-h1'), 'Phase 2 TEST K — NO missing-H1 finding generated when extraction is UNVERIFIED');
    assert(!ai.aiReadabilityFindings.some(f => f.id === 'ai-missing-h2-subheadings'), 'Phase 2 TEST K — NO missing-H2 finding generated when extraction is UNVERIFIED');
  }

  // Phase 2 — TEST L: Heading hierarchy
  {
    const html = '<html><body><h1>Main Topic</h1><h4>Direct H4 Jump</h4><h2>Section B</h2></body></html>';
    const ev = extractPageEvidence(html, 'https://example.com/hierarchy', 200);
    const tech = evaluateTechnicalSeo(ev);
    const hierarchyFinding = tech.find(f => f.id === 'seo-heading-hierarchy-skipped');
    assert(!!hierarchyFinding && hierarchyFinding.severity === 'LOW', 'Phase 2 TEST L — Heading hierarchy skipped levels finding generated with LOW severity');
  }

  // ----------------------------------------------------
  // TARGETED FIX — Viewport attribute variations
  // ----------------------------------------------------
  {
    const htmlA = '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>';
    const evA = extractPageEvidence(htmlA, 'https://example.com', 200);
    assert(evA.evidenceState?.head.viewport.status === 'FOUND', 'Viewport Test A — Standard viewport FOUND');

    const htmlB = '<html><head><meta content="width=device-width, initial-scale=1" name="viewport"></head><body></body></html>';
    const evB = extractPageEvidence(htmlB, 'https://example.com', 200);
    assert(evB.evidenceState?.head.viewport.status === 'FOUND', 'Viewport Test B — Reversed attribute order FOUND');

    const htmlC = '<html><head><META NAME="Viewport" CONTENT="width=device-width"></head><body></body></html>';
    const evC = extractPageEvidence(htmlC, 'https://example.com', 200);
    assert(evC.evidenceState?.head.viewport.status === 'FOUND', 'Viewport Test C — Mixed case viewport FOUND');

    const htmlD = '<html><head><title>No VP</title></head><body></body></html>';
    const evD = extractPageEvidence(htmlD, 'https://example.com', 200);
    assert(evD.evidenceState?.head.viewport.status === 'NOT_FOUND', 'Viewport Test D — Missing viewport NOT_FOUND');

    const evE = extractPageEvidence('', 'https://example.com/err', 500);
    const techE = evaluateTechnicalSeo(evE);
    assert(evE.evidenceState?.head.viewport.status === 'UNVERIFIED', 'Viewport Test E — Head extraction failure UNVERIFIED');
    assert(!techE.some(f => f.id === 'seo-missing-viewport'), 'Viewport Test E — UNVERIFIED status produces NO missing-viewport finding');
  }

  console.log('\n====================================================');
  console.log(' ALL EVIDENCE EXTRACTOR REGRESSION TESTS COMPLETED ');
  console.log('====================================================');
}

runEvidenceExtractorTests().catch(err => {
  console.error('Evidence Extractor Test execution error:', err);
  process.exit(1);
});
