import { extractPageEvidence } from '../src/lib/evidence-extractor';
import { evaluateAiReadabilityAndContent } from '../src/lib/engines/ai-readability-engine';
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

async function runEntityPublisherHardeningTests() {
  console.log('====================================================');
  console.log('   PHASE 4 — ENTITY & PUBLISHER SIGNALS SUITE       ');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // TEST A — Organization Schema
  // ----------------------------------------------------
  {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Acme Corp"
        }
        </script>
      </head>
      <body></body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://example.com', 200);
    const ep = ev.evidenceState!.entityPublisher;

    assert(ep.status === 'FOUND', 'TEST A — Overall entityPublisher status is FOUND');
    assert(ep.publisherSignal.status === 'FOUND', 'TEST A — Publisher signal is FOUND');
    assert(ep.organizationIdentity?.name === 'Acme Corp', 'TEST A — Organization name extracted from Schema');
  }

  // ----------------------------------------------------
  // TEST B — og:site_name
  // ----------------------------------------------------
  {
    const html = `
      <html>
      <head>
        <meta property="og:site_name" content="OpenAI" />
      </head>
      <body></body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://openai.com', 200);
    const ep = ev.evidenceState!.entityPublisher;

    assert(ep.organizationIdentity?.name === 'OpenAI', 'TEST B — Organization name extracted from og:site_name');
    assert(ep.organizationIdentity?.status === 'FOUND', 'TEST B — Organization identity status is FOUND');
  }

  // ----------------------------------------------------
  // TEST C — About link
  // ----------------------------------------------------
  {
    const html = `
      <html>
      <body>
        <footer>
          <a href="/about-us">About Us</a>
        </footer>
      </body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://example.com', 200);
    const ep = ev.evidenceState!.entityPublisher;

    assert(ep.aboutLink.status === 'FOUND', 'TEST C — About link is FOUND');
    assert(ep.aboutLink.value?.text === 'About Us', 'TEST C — About link text correct');
  }

  // ----------------------------------------------------
  // TEST D — Contact link
  // ----------------------------------------------------
  {
    const html = `
      <html>
      <body>
        <a href="/contact">Contact Us</a>
      </body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://example.com', 200);
    const ep = ev.evidenceState!.entityPublisher;

    assert(ep.contactLink.status === 'FOUND', 'TEST D — Contact link is FOUND');
  }

  // ----------------------------------------------------
  // TEST E — Contact mailto
  // ----------------------------------------------------
  {
    const html = `
      <html>
      <body>
        <a href="mailto:hello@example.com">Email Us</a>
      </body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://example.com', 200);
    const ep = ev.evidenceState!.entityPublisher;

    assert(ep.emailContact?.status === 'FOUND', 'TEST E — Email contact signal is FOUND');
    assert(ep.contactLink.status === 'FOUND', 'TEST E — Contact link is FOUND via mailto');
  }

  // ----------------------------------------------------
  // TEST F — Social links
  // ----------------------------------------------------
  {
    const html = `
      <html>
      <body>
        <a href="https://www.linkedin.com/company/example">LinkedIn</a>
        <a href="https://x.com/example">X</a>
        <a href="https://github.com/example">GitHub</a>
        <a href="https://youtube.com/@example">YouTube</a>
      </body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://example.com', 200);
    const ep = ev.evidenceState!.entityPublisher;
    const platforms = ep.socialProfiles.links.map(l => l.platform);

    assert(ep.socialProfiles.status === 'FOUND', 'TEST F — Social profiles status is FOUND');
    assert(
      platforms.includes('linkedin') && platforms.includes('x') && platforms.includes('github') && platforms.includes('youtube'),
      'TEST F — All 4 social platforms detected'
    );
  }

  // ----------------------------------------------------
  // TEST G — Careers
  // ----------------------------------------------------
  {
    const html = `
      <html>
      <body>
        <a href="/careers">Join Our Team</a>
      </body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://example.com', 200);
    const ep = ev.evidenceState!.entityPublisher;

    assert(ep.careersLink?.status === 'FOUND', 'TEST G — Careers link is FOUND');
  }

  // ----------------------------------------------------
  // TEST H — Copyright
  // ----------------------------------------------------
  {
    const html = `
      <html>
      <body>
        <footer>
          <p>© 2026 Example Inc. All rights reserved.</p>
        </footer>
      </body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://example.com', 200);
    const ep = ev.evidenceState!.entityPublisher;

    assert(ep.copyrightSignal?.status === 'FOUND', 'TEST H — Copyright signal is FOUND');
    assert(ep.copyrightSignal?.value?.holder === 'Example Inc', 'TEST H — Copyright holder correctly extracted');
  }

  // ----------------------------------------------------
  // TEST I — sameAs
  // ----------------------------------------------------
  {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Stripe",
          "sameAs": [
            "https://www.linkedin.com/company/stripe",
            "https://x.com/stripe"
          ]
        }
        </script>
      </head>
      <body></body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://stripe.com', 200);
    const ep = ev.evidenceState!.entityPublisher;

    assert(ep.sameAsLinks.status === 'FOUND', 'TEST I — sameAsLinks status is FOUND');
    assert(ep.socialProfiles.links.some(l => l.platform === 'linkedin'), 'TEST I — Social profile extracted from schema sameAs');
  }

  // ----------------------------------------------------
  // TEST J — Article Publisher vs Author
  // ----------------------------------------------------
  {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": "Test Article",
          "author": { "@type": "Person", "name": "Jane Doe" },
          "publisher": { "@type": "Organization", "name": "Tech Publishing Co" }
        }
        </script>
      </head>
      <body></body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://example.com/blog/1', 200);
    const ep = ev.evidenceState!.entityPublisher;

    assert(ep.authorSignal.value?.name === 'Jane Doe', 'TEST J — Author signal name is Jane Doe');
    assert(ep.publisherSignal.value?.name === 'Tech Publishing Co', 'TEST J — Publisher signal name is Tech Publishing Co');
    assert(ep.authorSignal.value?.name !== ep.publisherSignal.value?.name, 'TEST J — Author and Publisher remain separate');
  }

  // ----------------------------------------------------
  // TEST K — No Signals (Valid Page)
  // ----------------------------------------------------
  {
    const html = '<html><head><title>Bare Page</title></head><body><h1>Hello World</h1></body></html>';
    const ev = extractPageEvidence(html, 'https://example.com', 200);
    const ep = ev.evidenceState!.entityPublisher;

    assert(ep.aboutLink.status === 'NOT_FOUND', 'TEST K — About link is NOT_FOUND (not UNVERIFIED)');
    assert(ep.socialProfiles.status === 'NOT_FOUND', 'TEST K — Social profiles is NOT_FOUND');
    assert(ep.status === 'NOT_FOUND', 'TEST K — Overall entityPublisher status is NOT_FOUND');
  }

  // ----------------------------------------------------
  // TEST L — Extraction Failure (Fetch Error)
  // ----------------------------------------------------
  {
    const ev = extractPageEvidence('', 'https://example.com/error', 500);
    const ep = ev.evidenceState!.entityPublisher;
    const aiResult = await evaluateAiReadabilityAndContent(ev, mockSearch);
    const entityFinding = aiResult.citationReadinessFindings.find(f => f.id === 'citation-weak-entity-signals');

    assert(ep.aboutLink.status === 'UNVERIFIED', 'TEST L — Fetch status 500 sets About status to UNVERIFIED');
    assert(ep.status === 'UNVERIFIED', 'TEST L — Overall entity status is UNVERIFIED');
    assert(!entityFinding, 'TEST L — UNVERIFIED entity state generates NO missing-entity finding');
  }

  // ----------------------------------------------------
  // TEST M — Dashboard / Login Page
  // ----------------------------------------------------
  {
    const html = '<html><head><title>Sign In</title></head><body><h1>Sign In</h1></body></html>';
    const ev = extractPageEvidence(html, 'https://example.com/login', 200);
    ev.pageType = 'login';
    const aiResult = await evaluateAiReadabilityAndContent(ev, mockSearch);
    const entityFinding = aiResult.citationReadinessFindings.find(f => f.id === 'citation-weak-entity-signals');

    assert(!entityFinding, 'TEST M — Login/app page with no entity signals produces NO missing-entity finding');
  }

  // ----------------------------------------------------
  // TEST N — False Positive Protection (Plain text without link)
  // ----------------------------------------------------
  {
    const html = '<html><body><p>Follow us on LinkedIn for updates!</p></body></html>';
    const ev = extractPageEvidence(html, 'https://example.com', 200);
    const ep = ev.evidenceState!.entityPublisher;

    assert(ep.socialProfiles.status === 'NOT_FOUND', 'TEST N — Plain text mention without <a> element does NOT produce a social link');
  }

  // ----------------------------------------------------
  // TEST O — JavaScript False Positive
  // ----------------------------------------------------
  {
    const html = `
      <html>
      <head>
        <script>
          var config = { aboutUrl: "/about" };
        </script>
      </head>
      <body><h1>Main Content</h1></body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://example.com', 200);
    const ep = ev.evidenceState!.entityPublisher;

    assert(ep.aboutLink.status === 'NOT_FOUND', 'TEST O — JS string occurrence of "/about" does NOT trigger About link detection');
  }

  // ----------------------------------------------------
  // TEST P — Relative URLs Normalization
  // ----------------------------------------------------
  {
    const html = `
      <html>
      <body>
        <a href="/about-us/">About Us</a>
        <a href="../contact">Contact</a>
        <a href="https://example.com/careers">Careers</a>
      </body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://example.com/product/1', 200);
    const ep = ev.evidenceState!.entityPublisher;

    assert(ep.aboutLink.status === 'FOUND', 'TEST P — Relative /about-us/ normalized and detected');
    assert(ep.contactLink.status === 'FOUND', 'TEST P — Relative ../contact normalized and detected');
    assert(ep.careersLink?.status === 'FOUND', 'TEST P — Absolute /careers detected');
  }

  // ----------------------------------------------------
  // TEST Q — Entity Deduplication & Confidence
  // ----------------------------------------------------
  {
    const html = `
      <html>
      <head>
        <title>Microsoft – Cloud, Computers, Apps & Gaming</title>
        <meta property="og:site_name" content="Microsoft" />
        <script type="application/ld+json">
        { "@context": "https://schema.org", "@type": "Organization", "name": "Microsoft" }
        </script>
      </head>
      <body>
        <footer>
          <p>© 2026 Microsoft Corporation</p>
        </footer>
      </body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://microsoft.com', 200);
    const ep = ev.evidenceState!.entityPublisher;

    assert(ep.organizationIdentity?.name === 'Microsoft', 'TEST Q — Single organization name "Microsoft" extracted');
    assert(ep.organizationIdentity?.confidence === 'strong', 'TEST Q — Multi-source signals yield "strong" confidence');
    assert(ep.organizationIdentity?.sources.length! >= 3, 'TEST Q — Multiple evidence sources aggregated');
  }

  // ----------------------------------------------------
  // TEST R — Weak Title Signal Alone
  // ----------------------------------------------------
  {
    const html = '<html><head><title>WidgetCorp Services</title></head><body><h1>Services</h1></body></html>';
    const ev = extractPageEvidence(html, 'https://widgetcorp.com/services', 200);
    const ep = ev.evidenceState!.entityPublisher;

    assert(ep.organizationIdentity?.confidence === 'weak', 'TEST R — Title segment alone yields "weak" confidence tier');
  }
}

runEntityPublisherHardeningTests().catch(err => {
  console.error('Entity Publisher Hardening Test error:', err);
  process.exit(1);
});
