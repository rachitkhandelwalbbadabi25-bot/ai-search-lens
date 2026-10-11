import { fetchLivePage } from './lib/tinyfish-fetch';
import { extractPageEvidence } from './lib/evidence-extractor';
import crypto from 'node:crypto';

const TEST_URLS = [
  'https://www.aihireflow.in/',
  'https://www.aihireflow.in/campus',
  'https://www.aihireflow.in/pricing',
  'https://stripe.com/',
  'https://stripe.com/pricing',
  'https://stripe.com/blog',
];

function getContentHash(text: string): string {
  return crypto.createHash('md5').update(text || '').digest('hex').slice(0, 12);
}

async function inspectRedirects() {
  console.log('=== EXACT PAGE REDIRECT & EVIDENCE INSPECTOR ===\n');

  for (const targetUrl of TEST_URLS) {
    console.log(`==================================================`);
    console.log(`REQUESTED URL: ${targetUrl}`);
    console.log(`==================================================`);

    // 1. Direct HTTP Fetch Redirect Check
    try {
      const directRes = await fetch(targetUrl, {
        method: 'GET',
        redirect: 'manual', // Don't auto-follow redirects to inspect 301/302
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      });

      console.log(`Direct HTTP Status: ${directRes.status} ${directRes.statusText}`);
      const redirectLocation = directRes.headers.get('location');
      if (directRes.status >= 300 && directRes.status < 400) {
        console.log(`[HTTP REDIRECT DETECTED] Redirects to: ${redirectLocation}`);
      } else {
        console.log(`[NO HTTP REDIRECT] Server returned HTTP ${directRes.status} directly.`);
      }
    } catch (err: any) {
      console.log(`Direct fetch error: ${err.message}`);
    }

    // 2. TinyFish Fetch Execution & Evidence Analysis
    try {
      const fetchResult = await fetchLivePage(targetUrl);
      console.log(`\nTinyFish Fetch Results:`);
      console.log(`  Requested URL: ${targetUrl}`);
      console.log(`  Final URL returned: ${fetchResult.url}`);
      console.log(`  Is Redirected?: ${fetchResult.url.replace(/\/$/, '') !== targetUrl.replace(/\/$/, '')}`);
      console.log(`  Via TinyFish API: ${fetchResult.viaTinyFish}`);
      console.log(`  HTML Length: ${fetchResult.html.length} bytes`);

      const structure = extractPageEvidence(
        fetchResult.html,
        targetUrl,
        fetchResult.statusCode,
        fetchResult.pageTitle,
        fetchResult.metaDescription
      );

      const hash = getContentHash(structure.mainBodyText);

      console.log(`  Title: "${structure.title}"`);
      console.log(`  Canonical: "${structure.canonical}"`);
      console.log(`  H1: "${structure.headings.find(h => h.level === 'h1')?.text || 'None'}"`);
      console.log(`  Word Count: ${structure.wordCount}`);
      console.log(`  Heading Count: ${structure.headings.length}`);
      console.log(`  Content MD5 Hash: ${hash}`);
    } catch (err: any) {
      console.error(`TinyFish fetch error: ${err.message}`);
    }

    console.log('\n');
  }
}

inspectRedirects().catch(console.error);
