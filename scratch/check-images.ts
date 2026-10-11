import { fetchLivePage } from '../src/lib/tinyfish-fetch';
import * as cheerio from 'cheerio';

async function checkImages() {
  const res = await fetchLivePage('https://skillsyncer.com/');
  const $ = cheerio.load(res.html);

  console.log('--- ALL IMG TAGS IN RAW HTML ---');
  $('img').each((i, el) => {
    console.log(i, 'HTML:', $.html(el));
    console.log('   parent:', $(el).parent().get(0)?.tagName, 'alt attr:', $(el).attr('alt'));
  });

  console.log('\n--- ALL SVG / PICTURE / SOURCE TAGS ---');
  console.log('SVG count:', $('svg').length);
  console.log('picture count:', $('picture').length);
  console.log('source count:', $('source').length);
  
  // Check if any img tags exist inside template or noscript or comments
  const rawHtml = res.html;
  const rawImgMatches = rawHtml.match(/<img\b[^>]*>/gi);
  console.log('Regex <img matches in raw HTML:', rawImgMatches?.length);
  rawImgMatches?.forEach((m, i) => console.log(`Regex ${i}:`, m));

  // Check SVG elements that have role="img" or aria-label
  $('svg[role="img"], svg[aria-label]').each((i, el) => {
    console.log(`SVG img ${i}:`, $(el).attr('role'), $(el).attr('aria-label'));
  });
}

checkImages().catch(console.error);
