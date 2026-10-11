import { fetchLivePage } from '../src/lib/tinyfish-fetch';
import * as cheerio from 'cheerio';

async function checkHeadings() {
  const res = await fetchLivePage('https://skillsyncer.com/');
  const $ = cheerio.load(res.html);

  console.log('--- ALL HEADINGS IN RAW HTML ---');
  let count = 0;
  $('*').each((i, el) => {
    const tag = el.tagName?.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      count++;
      console.log(`${count}. <${tag}> ${$(el).text().replace(/\s+/g, ' ').trim()} (parent: ${$(el).parent().get(0)?.tagName}, class: ${$(el).attr('class')})`);
    }
  });

  console.log('\n--- CHECK FOR HIDDEN / SCRIPT / TEMPLATE HEADINGS ---');
  $('template').each((i, el) => {
    const $t = cheerio.load($(el).html() || '');
    $t('h1, h2, h3, h4, h5, h6').each((j, hel) => {
      console.log(`Template heading: <${hel.tagName}> ${$t(hel).text().trim()}`);
    });
  });

  // Check regex for <h1 in raw HTML
  const rawH1Matches = res.html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi);
  console.log('Regex <h1 matches:', rawH1Matches?.length);
  rawH1Matches?.forEach((m, i) => console.log(`H1 #${i}:`, m));
}

checkHeadings().catch(console.error);
