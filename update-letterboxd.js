const https = require('https');
const http  = require('http');
const fs    = require('fs');

const LETTERBOXD_USER = process.env.LETTERBOXD_USER || 'madsykle';

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function trunc(s, n) { return s.length > n ? s.slice(0,n-1)+'…' : s; }

async function fetchText(url) {
  return new Promise((res,rej) => {
    https.get(url, { headers:{'User-Agent':'Mozilla/5.0'} }, r => {
      let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(d)); r.on('error',rej);
    });
  });
}

async function fetchImageBase64(url) {
  if (!url || !url.startsWith('http')) return null;
  return new Promise(res => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers:{'User-Agent':'Mozilla/5.0'} }, r => {
      if (r.statusCode === 301 || r.statusCode === 302) { fetchImageBase64(r.headers.location).then(res); return; }
      const chunks = [];
      r.on('data', c => chunks.push(c));
      r.on('end', () => {
        const ct = r.headers['content-type'] || 'image/jpeg';
        res(`data:${ct};base64,${Buffer.concat(chunks).toString('base64')}`);
      });
      r.on('error', () => res(null));
    });
    req.on('error', () => res(null));
    req.setTimeout(10000, () => { req.destroy(); res(null); });
  });
}

function parseRSS(xml) {
  const itemMatch = xml.match(/<item>([\s\S]*?)<\/item>/);
  if (!itemMatch) return null;
  const item = itemMatch[1];

  const titleRaw = (item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || item.match(/<title>([\s\S]*?)<\/title>/))?.[1] || '';
  const commaIdx = titleRaw.lastIndexOf(', ');
  let filmTitle, rating;
  if (commaIdx !== -1 && /[★½]/.test(titleRaw.slice(commaIdx))) {
    filmTitle = titleRaw.slice(0, commaIdx).trim();
    rating    = titleRaw.slice(commaIdx + 2).trim();
  } else {
    filmTitle = titleRaw.trim();
    rating    = '';
  }

  const yearMatch = item.match(/(\d{4})<\/p>/) || item.match(/Watched in (\d{4})/);
  const year = yearMatch?.[1] || '';

  const descRaw = (item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || [])[1] || '';
  const imgMatch = descRaw.match(/<img src="([^"]+)"/);
  const posterUrl = imgMatch?.[1] || '';

  return { filmTitle, rating, year, posterUrl };
}

function generateSVG({ filmTitle, rating, year, imageBase64 }) {
  const title = esc(trunc(filmTitle || 'untitled', 34));
  const stars = esc(rating || '');
  const yr    = year ? esc(String(year)) : '';

  const art = imageBase64
    ? `<image href="${imageBase64}" x="0" y="0" width="134" height="200" preserveAspectRatio="xMidYMid slice" clip-path="url(#pc)"/>`
    : `<rect x="0" y="0" width="134" height="200" fill="#0a0b14"/>
       <text x="67" y="107" text-anchor="middle" font-family="Georgia,serif" font-size="28" fill="#151722">▭</text>`;

  return `<svg width="800" height="200" viewBox="0 0 800 200" xmlns="http://www.w3.org/2000/svg">
<defs><clipPath id="pc"><rect width="134" height="200"/></clipPath></defs>
<rect width="800" height="200" fill="#0b0c15"/>
${art}
<rect x="134" y="0" width="666" height="200" fill="#0b0c15"/>
<line x1="134" y1="0" x2="134" y2="200" stroke="#1c1e2e" stroke-width="1"/>
<text x="154" y="33" font-family="'Courier New',monospace" font-size="8" fill="#374151" letter-spacing="3">RECENTLY WATCHED</text>
<text x="152" y="88" font-family="Georgia,'Times New Roman',serif" font-size="26" font-weight="bold" fill="#e8ecf4">${title}</text>
${yr ? `<text x="154" y="112" font-family="'Courier New',monospace" font-size="11" fill="#374151">${yr}</text>` : ''}
<text x="154" y="${yr ? '146' : '134'}" font-family="Georgia,serif" font-size="17" fill="#d97706" letter-spacing="2">${stars}</text>
<g fill="#070810">
  ${[14,50,86,122,158,176].map(y=>`<rect x="4" y="${y}" width="7" height="10" rx="1.5"/>`).join('')}
  ${[14,50,86,122,158,176].map(y=>`<rect x="789" y="${y}" width="7" height="10" rx="1.5"/>`).join('')}
</g>
<text x="772" y="188" text-anchor="end" font-family="'Courier New',monospace" font-size="7" fill="#161824" letter-spacing="2.5">LETTERBOXD</text>
<rect width="800" height="200" fill="none" stroke="#1a1c2c" stroke-width="1"/>
</svg>`;
}

async function main() {
  let d = { filmTitle:'nothing yet', rating:'', year:'', imageBase64:null };
  try {
    const xml = await fetchText(`https://letterboxd.com/${LETTERBOXD_USER}/rss/`);
    const parsed = parseRSS(xml);
    if (parsed) {
      d = { ...parsed, imageBase64: await fetchImageBase64(parsed.posterUrl) };
      console.log(`✦ ${d.filmTitle} ${d.rating}`);
    }
  } catch(e) { console.error('letterboxd error:', e.message); }
  fs.writeFileSync('letterboxd.svg', generateSVG(d));
}
main();
