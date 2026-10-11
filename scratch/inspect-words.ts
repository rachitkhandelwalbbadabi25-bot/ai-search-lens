import { fetchLivePage } from '../src/lib/tinyfish-fetch';
import * as cheerio from 'cheerio';

async function test() {
  const res = await fetchLivePage('https://aihireflow.in/');
  const $ = cheerio.load(res.html);

  // Total visible text (only excluding script, style, noscript, svg, hidden)
  const cloneAll = $('body').clone();
  cloneAll.find('script, style, noscript, svg, iframe, template, [hidden]').remove();
  const textAll = cloneAll.text().replace(/\s+/g, ' ').trim();
  const wordsAll = textAll ? textAll.split(/\s+/).filter(Boolean) : [];

  // Main content text (also excluding nav, footer, header, cookie notices)
  const cloneMain = $('body').clone();
  cloneMain.find('script, style, noscript, svg, iframe, template, [hidden], nav, footer, header, [role="navigation"], [role="banner"], [role="contentinfo"]').remove();
  const textMain = cloneMain.text().replace(/\s+/g, ' ').trim();
  const wordsMain = textMain ? textMain.split(/\s+/).filter(Boolean) : [];

  console.log('Total visible words:', wordsAll.length);
  console.log('Main content words:', wordsMain.length);
  console.log('Headings count:', $('h1, h2, h3, h4, h5, h6').length);
}

test();
