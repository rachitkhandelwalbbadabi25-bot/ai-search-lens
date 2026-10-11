import { fetchLivePage } from '../src/lib/tinyfish-fetch';
import { extractPageEvidence } from '../src/lib/evidence-extractor';

async function main() {
  const targetUrl = 'https://aihireflow.in/';
  console.log(`Fetching live page: ${targetUrl}...`);
  const result = await fetchLivePage(targetUrl);
  console.log(`Fetch completed! Status: ${result.statusCode}, Bytes: ${result.html.length}, viaTinyFish: ${result.viaTinyFish}`);

  const evidence = extractPageEvidence(result.html, targetUrl, result.statusCode, result.pageTitle, result.metaDescription);

  console.log('\n--- EXTRACTED EVIDENCE FOR AI HIREFLOW ---');
  console.log('Title:', evidence.title);
  console.log('Viewport Signal:', JSON.stringify(evidence.evidenceState?.head.viewport, null, 2));
  console.log('Has Viewport Meta:', evidence.hasViewportMeta);
  console.log('Entity Publisher Evidence:', JSON.stringify(evidence.evidenceState?.entityPublisher, null, 2));
  console.log('Organization Name:', evidence.organizationName);
  console.log('Organization Confidence:', evidence.organizationConfidence);
  console.log('Copyright Text:', evidence.copyrightText);
  console.log('Copyright Holder:', evidence.copyrightHolder);
  console.log('Social Links:', evidence.socialProfileLinks);
  console.log('Has About Link:', evidence.hasAboutLink);
  console.log('Has Contact Link:', evidence.hasContactLink);
  console.log('Has Careers Link:', evidence.hasCareersLink);

  // Print head meta tags in HTML
  console.log('\n--- HEAD META TAGS IN FETCHED HTML ---');
  const metaMatches = result.html.match(/<meta[^>]+>/gi);
  if (metaMatches) {
    metaMatches.forEach(m => console.log('  ', m));
  } else {
    console.log('No <meta> tags matched regex');
  }

  // Print anchor tags in HTML
  console.log('\n--- ANCHOR TAGS IN FETCHED HTML ---');
  const aMatches = result.html.match(/<a[^>]+>[\s\S]*?<\/a>/gi);
  if (aMatches) {
    aMatches.slice(0, 30).forEach(a => console.log('  ', a.replace(/\s+/g, ' ').slice(0, 120)));
  } else {
    console.log('No <a> tags matched regex');
  }
}

main().catch(err => {
  console.error('Inspection error:', err);
});
