import { fetchLivePage } from '../src/lib/tinyfish-fetch';
import { extractPageEvidence } from '../src/lib/evidence-extractor';

async function main() {
  console.log('Fetching https://velona.in/ ...');
  const res = await fetchLivePage('https://velona.in/');
  console.log('viaTinyFish:', res.viaTinyFish);
  console.log('statusCode:', res.statusCode);
  console.log('HTML length:', res.html.length);

  const ev = extractPageEvidence(
    res.html,
    res.url,
    res.statusCode,
    res.pageTitle,
    res.metaDescription,
    { renderedDom: res.viaTinyFish }
  );

  console.log('\n--- EXTRACTED EVIDENCE ---');
  console.log('Title:', ev.title);
  console.log('Meta Description:', ev.metaDescription);
  console.log('Viewport Signal:', ev.evidenceState?.head.viewport);
  console.log('Canonical Signal:', ev.evidenceState?.head.canonical);
  console.log('Structured Data Types:', ev.structuredDataTypes);
  console.log('Structured Data Status:', ev.evidenceState?.structuredData.status);
  console.log('Structured Data Details:', JSON.stringify(ev.evidenceState?.structuredData.typesWithDetails, null, 2));
  console.log('H1 Status:', ev.evidenceState?.headings.h1Status);
  console.log('H1 Count:', ev.h1Count);
  console.log('Headings:', JSON.stringify(ev.headings, null, 2));
}

main().catch(console.error);
