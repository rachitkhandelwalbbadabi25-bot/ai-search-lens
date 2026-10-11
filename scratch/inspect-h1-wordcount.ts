import { fetchLivePage } from '../src/lib/tinyfish-fetch';
import { extractPageEvidence } from '../src/lib/evidence-extractor';

async function main() {
  console.log('Fetching https://aihireflow.in/ ...');
  const res = await fetchLivePage('https://aihireflow.in/');
  console.log('viaTinyFish:', res.viaTinyFish);
  console.log('HTML length:', res.html.length);
  const evidence = extractPageEvidence(res.html, res.url, res.statusCode);
  evidence.renderedDom = res.viaTinyFish;
  console.log('domInspected:', evidence.evidenceState?.domInspected);
  console.log('h1Status:', evidence.evidenceState?.headings.h1Status);
  console.log('h1Count:', evidence.h1Count);
  console.log('headings:', evidence.headings);
  console.log('wordCount:', evidence.wordCount);
  console.log('mainBodyText length:', evidence.mainBodyText.length);
  console.log('introText:', evidence.introText);
}

main().catch(console.error);
