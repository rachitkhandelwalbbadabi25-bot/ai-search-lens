import assert from 'node:assert';
import { extractPageEvidence } from '../src/lib/evidence-extractor';
import { countWords, extractWordCountMetrics } from '../src/lib/word-count-utility';
import { evaluateTechnicalSeo } from '../src/lib/engines/seo-engine';
import { evaluateAiReadabilityAndContent } from '../src/lib/engines/ai-readability-engine';

async function runTests() {
  console.log('Running H1 Detection & Content Word-Count Consistency Tests...\n');

  // Test A: H1 found in initial HTML
  {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Test Page</title></head>
        <body>
          <h1>Primary Page Heading</h1>
          <p>Some initial content here.</p>
        </body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://example.com/test-a', 200, null, null, { renderedDom: false });
    assert.strictEqual(ev.evidenceState?.headings.h1Status, 'FOUND', 'Test A: h1Status should be FOUND when h1 is in initial HTML');
    assert.strictEqual(ev.h1Count, 1, 'Test A: h1Count should be 1');
    console.log('✔ Test A passed: H1 found in initial HTML');
  }

  // Test B: H1 absent from complete, verifiable HTML
  {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Verifiable Page</title></head>
        <body>
          <h2>Section Heading Only</h2>
          <p>Content without any H1 tag.</p>
        </body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://example.com/test-b', 200, null, null, { renderedDom: true });
    assert.strictEqual(ev.evidenceState?.headings.h1Status, 'NOT_FOUND', 'Test B: h1Status should be NOT_FOUND for complete rendered HTML with 0 H1');
    assert.strictEqual(ev.h1Count, 0, 'Test B: h1Count should be 0');
    console.log('✔ Test B passed: H1 absent from complete, verifiable HTML');
  }

  // Test C: H1 unavailable because extraction failed
  {
    const ev = extractPageEvidence('', 'https://example.com/test-c', 500, null, null, { renderedDom: false });
    assert.strictEqual(ev.evidenceState?.headings.h1Status, 'UNVERIFIED', 'Test C: h1Status should be UNVERIFIED on fetch failure');
    assert.strictEqual(ev.evidenceState?.domInspected, false, 'Test C: domInspected should be false');
    console.log('✔ Test C passed: H1 unavailable because extraction failed');
  }

  // Test D: H1 present only after rendering, when rendered-DOM evidence is available
  {
    const staticHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>SPA Shell</title></head>
        <body>
          <div id="root"></div>
        </body>
      </html>
    `;
    const renderedHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>SPA Shell</title></head>
        <body>
          <div id="root">
            <h1>JS Rendered Title</h1>
            <p>Rendered content paragraph.</p>
          </div>
        </body>
      </html>
    `;
    const staticEv = extractPageEvidence(staticHtml, 'https://example.com/test-d', 200, null, null, { renderedDom: false });
    assert.strictEqual(staticEv.evidenceState?.headings.h1Status, 'UNVERIFIED', 'Test D1: Static SPA shell with 0 H1 should be UNVERIFIED when renderedDom is false');

    const renderedEv = extractPageEvidence(renderedHtml, 'https://example.com/test-d', 200, null, null, { renderedDom: true });
    assert.strictEqual(renderedEv.evidenceState?.headings.h1Status, 'FOUND', 'Test D2: Rendered DOM with H1 should be FOUND');
    assert.strictEqual(renderedEv.h1Count, 1, 'Test D2: h1Count should be 1 after JS rendering');
    console.log('✔ Test D passed: H1 present after JS rendering with rendered-DOM evidence');
  }

  // Test E: Title text must not be treated as an H1
  {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Page Title Is Not An H1 Tag</title></head>
        <body>
          <p>Body text without H1.</p>
        </body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://example.com/test-e', 200);
    assert.strictEqual(ev.h1Count, 0, 'Test E: Title text in <title> must not increment h1Count');
    assert.strictEqual(ev.headings.some(h => h.level === 'h1'), false, 'Test E: No h1 entry in headings array');
    console.log('✔ Test E passed: Title text is not treated as an H1');
  }

  // Test F: Script strings containing `<h1>` must not count as real headings
  {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <script>
            const template = "<h1>String inside script tag</h1>";
          </script>
        </head>
        <body>
          <p>Body text here.</p>
        </body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://example.com/test-f', 200);
    assert.strictEqual(ev.h1Count, 0, 'Test F: <h1> inside <script> string must not be counted as a real heading');
    assert.strictEqual(ev.headings.length, 0, 'Test F: Headings array should be empty');
    console.log('✔ Test F passed: Script strings containing <h1> are ignored');
  }

  // Test G: Word-count utility handles repeated whitespace
  {
    const text = '  Hello    \n\t   World   \u00A0  with   spaces  ';
    const count = countWords(text);
    assert.strictEqual(count, 4, 'Test G: Should count exactly 4 words despite whitespace');
    console.log('✔ Test G passed: Word-count utility handles repeated whitespace');
  }

  // Test H: Script and style content is excluded
  {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>body { color: red; font-size: 16px; }</style>
          <script>var foo = 'bar'; console.log(foo);</script>
        </head>
        <body>
          <p>Visible content text here.</p>
        </body>
      </html>
    `;
    const metrics = extractWordCountMetrics(html);
    assert.strictEqual(metrics.totalWordCount, 4, 'Test H: totalWordCount should only count visible content words (4 words)');
    assert.strictEqual(metrics.mainContentWordCount, 4, 'Test H: mainContentWordCount should only count visible content words (4 words)');
    console.log('✔ Test H passed: Script and style content is excluded');
  }

  // Test I: Navigation and footer handling follows the defined metric
  {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Nav and Footer Test</title></head>
        <body>
          <nav>Home Services About Contact Us</nav>
          <main>
            <p>This is the primary main content text for the page.</p>
          </main>
          <footer>Privacy Policy Terms of Service Copyright 2026</footer>
        </body>
      </html>
    `;
    const metrics = extractWordCountMetrics(html);
    assert.strictEqual(metrics.totalWordCount, 22, 'Test I: totalWordCount includes nav + main + footer (22 words)');
    assert.strictEqual(metrics.mainContentWordCount, 10, 'Test I: mainContentWordCount excludes nav and footer (10 words)');
    console.log('✔ Test I passed: Navigation and footer handling follows defined metrics');
  }

  // Test J: Duplicate content is not counted twice unintentionally
  {
    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <p>Unique main sentence for testing deduplication logic.</p>
          <p>Unique main sentence for testing deduplication logic.</p>
        </body>
      </html>
    `;
    const metrics = extractWordCountMetrics(html);
    assert.strictEqual(metrics.mainContentWordCount, 7, 'Test J: Main content deduplicates identical sentence chunks');
    console.log('✔ Test J passed: Duplicate content is not double-counted');
  }

  // Test K: Unicode text is handled consistently
  {
    const text = 'Résumé for AI-driven flow 👋 in Munich';
    const count = countWords(text);
    assert.strictEqual(count, 7, 'Test K: Handles Unicode accents, hyphens, and emojis cleanly (7 words)');
    console.log('✔ Test K passed: Unicode text is handled consistently');
  }

  // Test L: Overview labels match their actual word-count metrics
  {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Overview Label Test</title></head>
        <body>
          <nav>Nav item 1 Nav item 2 Nav item 3</nav>
          <main>
            <h1>Test Title</h1>
            <p>Main body content goes here.</p>
          </main>
          <footer>Footer text item</footer>
        </body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://example.com/test-l', 200);
    const searchData: any = { queryUsed: 'test', targetPresentInSerp: false };
    const res = await evaluateAiReadabilityAndContent(ev, searchData);

    assert(res.executiveSummary.overview.includes('total visible words'), 'Test L: Overview should contain "total visible words" label');
    assert(res.executiveSummary.overview.includes('main-content words'), 'Test L: Overview should contain "main-content words" label');
    console.log('✔ Test L passed: Overview labels match actual word-count metrics');
  }

  // Test M: Content-depth finding uses the intended main-content metric
  {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Brief Content Test</title></head>
        <body>
          <nav>Nav item 1 Nav item 2 Nav item 3 Nav item 4 Nav item 5</nav>
          <main>
            <h1>Short Page</h1>
            <p>Very brief content.</p>
          </main>
          <footer>Footer link 1 Footer link 2 Footer link 3 Footer link 4</footer>
        </body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://example.com/test-m', 200);
    ev.pageType = 'article';
    const searchData: any = { queryUsed: 'test', targetPresentInSerp: false };
    const res = await evaluateAiReadabilityAndContent(ev, searchData);

    const depthFinding = res.contentIntentFindings.find(f => f.id === 'content-thin-word-count');
    assert(depthFinding, 'Test M: Should generate content-thin-word-count finding for brief article content');
    assert(depthFinding.title.includes('main-content words'), 'Test M: Finding title must explicitly state main-content words');
    assert(depthFinding.evidence.observed.includes('Main content text contains'), 'Test M: Observed evidence must state main content words');
    console.log('✔ Test M passed: Content-depth finding uses intended main-content metric');
  }

  // Test N: Unverified content does not create a confirmed missing-H1 finding
  {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Unverified SPA</title></head>
        <body>
          <div id="root"></div>
        </body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://example.com/test-n', 200, null, null, { renderedDom: false });
    assert.strictEqual(ev.evidenceState?.headings.h1Status, 'UNVERIFIED', 'Test N: h1Status is UNVERIFIED when renderedDom is false');

    const techFindings = evaluateTechnicalSeo(ev);
    const missingH1 = techFindings.find(f => f.id === 'seo-missing-h1');
    assert.strictEqual(missingH1, undefined, 'Test N: UNVERIFIED h1Status must NOT generate a missing-H1 finding');
    console.log('✔ Test N passed: Unverified content does not create a confirmed missing-H1 finding');
  }

  // Test P: Unrendered static shell with zero words: no content-depth deduction
  {
    const html = `<!DOCTYPE html><html><head><title>SPA Shell</title></head><body><div id="app"></div></body></html>`;
    const ev = extractPageEvidence(html, 'https://example.com/test-p', 200, null, null, { renderedDom: false });
    ev.pageType = 'article';
    const searchData: any = { queryUsed: 'test', targetPresentInSerp: false };
    const res = await evaluateAiReadabilityAndContent(ev, searchData);

    const thinFinding = res.contentIntentFindings.find(f => f.id === 'content-thin-word-count' || f.id === 'content-utility-empty');
    assert.strictEqual(thinFinding, undefined, 'Test P: Unrendered static shell with 0 words must NOT generate a thin content deduction');
    assert(res.executiveSummary.overview.includes('was inspected via initial static HTML shell'), 'Test P: Overview explains static HTML shell inspection');
    console.log('✔ Test P passed: Unrendered static shell with zero words produces no content-depth deduction');
  }

  // Test Q: Rendered DOM with zero words: existing confirmed thin-content evaluation applies
  {
    const html = `<!DOCTYPE html><html><head><title>Empty Rendered Page</title></head><body><div id="app"></div></body></html>`;
    const ev = extractPageEvidence(html, 'https://example.com/test-q', 200, null, null, { renderedDom: true });
    ev.pageType = 'article';
    const searchData: any = { queryUsed: 'test', targetPresentInSerp: false };
    const res = await evaluateAiReadabilityAndContent(ev, searchData);

    const thinFinding = res.contentIntentFindings.find(f => f.id === 'content-thin-word-count');
    assert(thinFinding, 'Test Q: Rendered DOM with 0 words MUST generate a confirmed thin content finding');
    assert.strictEqual(thinFinding.deductionPoints, 3, 'Test Q: Deduction points for article thin content must be 3');
    console.log('✔ Test Q passed: Rendered DOM with zero words generates confirmed thin-content finding');
  }

  // Test R: Substantive static HTML with at least 15 main-content words: existing evaluation applies
  {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Static Brief Page</title></head>
        <body>
          <p>This is a static HTML page that contains thirty words of initial body content for evaluating static content depth without requiring client side javascript rendering to execute.</p>
        </body>
      </html>
    `;
    const ev = extractPageEvidence(html, 'https://example.com/test-r', 200, null, null, { renderedDom: false });
    ev.pageType = 'article';
    const searchData: any = { queryUsed: 'test', targetPresentInSerp: false };
    const res = await evaluateAiReadabilityAndContent(ev, searchData);

    const thinFinding = res.contentIntentFindings.find(f => f.id === 'content-thin-word-count');
    assert(thinFinding, 'Test R: Substantive static HTML (< minExpectedWords) MUST be evaluated normally');
    assert(thinFinding.title.includes('main-content words'), 'Test R: Finding title includes main-content words');
    console.log('✔ Test R passed: Substantive static HTML with >= 15 words is evaluated normally');
  }

  console.log('\nAll 18 H1 & Word-Count Consistency Tests Passed Successfully!');
}

runTests().catch(err => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
