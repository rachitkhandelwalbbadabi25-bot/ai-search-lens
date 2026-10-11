import { fetchLivePage } from '../src/lib/tinyfish-fetch';
import * as cheerio from 'cheerio';

async function inspectSkillSyncer() {
  const url = 'https://skillsyncer.com/';
  console.log('Fetching', url);
  const result = await fetchLivePage(url);
  console.log('Status:', result.statusCode);
  console.log('viaTinyFish:', result.viaTinyFish);
  console.log('HTML length:', result.html?.length);

  const $ = cheerio.load(result.html);
  
  // Head inspection
  console.log('\n--- HEAD TAGS ---');
  $('meta').each((i, el) => {
    const name = $(el).attr('name');
    const property = $(el).attr('property');
    const content = $(el).attr('content');
    if (name || property) {
      console.log(`meta [name=${name}, property=${property}] content="${content}"`);
    }
  });

  $('link').each((i, el) => {
    const rel = $(el).attr('rel');
    const href = $(el).attr('href');
    console.log(`link [rel=${rel}] href="${href}"`);
  });

  // Scripts (JSON-LD)
  console.log('\n--- JSON-LD SCRIPTS ---');
  $('script[type="application/ld+json"]').each((i, el) => {
    console.log(`Script ${i}:`, $(el).html());
  });

  // Images
  console.log('\n--- IMAGES ---');
  const imgs = $('img');
  console.log('Total img elements:', imgs.length);
  imgs.each((i, el) => {
    console.log(`Img ${i}: src="${$(el).attr('src')}" alt="${$(el).attr('alt')}" data-src="${$(el).attr('data-src')}" loading="${$(el).attr('loading')}"`);
  });

  // Also check <picture>, <source>, <svg>, background-image, or noscript img
  console.log('Picture elements:', $('picture').length);
  console.log('Noscript img elements:', $('noscript img').length);

  // Headings
  console.log('\n--- HEADINGS ---');
  const headings = $('h1, h2, h3, h4, h5, h6');
  console.log('Total headings:', headings.length);
  headings.each((i, el) => {
    console.log(`${el.tagName.toUpperCase()}: "${$(el).text().replace(/\s+/g, ' ').trim()}"`);
  });
}

inspectSkillSyncer().catch(console.error);
