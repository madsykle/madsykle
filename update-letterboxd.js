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
  // Format: "Film Title, ★★★★½" or "Film Title"
  const commaIdx = titleRaw.lastIndexOf(', ');
  let filmTitle, rating;
  if (commaIdx !== -1 && /[★½]/.test(titleRaw.slice(commaIdx))) {
    filmTitle = titleRaw.slice(0, commaIdx).trim();
    rating    = titleRaw.slice(commaIdx + 2).trim();
  } else {
    filmTitle = titleRaw.trim();
    rating    = '';
  }

  // Year from film link or title — Letterboxd RSS sometimes has year in description
  const yearMatch = item.match(/(\d{4})<\/p>/) || item.match(/Watched in (\d{4})/);
  const year = yearMatch?.[1] || '';

  // Poster from description img
  const descRaw = (item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || [])[1] || '';
  const imgMatch = descRaw.match(/<img src="([^"]+)"/);
  const posterUrl = imgMatch?.[1] || '';

  return { filmTitle, rating, year, posterUrl };
}

function generateSVG({ filmTitle, rating, year, imageBase64 }) {
  const title = esc(trunc(filmTitle || 'unknown', 36));
  const stars = rating || '';
  const yr    = year ? esc(String(year)) : '';

  const art = imageBase64
    ? `<image href="${imageBase64}" x="0" y="0" width="134" height="200" preserveAspectRatio="xMidYMid slice" clip-path="url(#posterClip)"/>`
    : `<rect x="0" y="0" width="134" height="200" fill="#090b14"/>
       <text x="67" y="108" text-anchor="middle" font-family="monospace" font-size="26" fill="#111827">▭</text>`;

  return `<svg width="800" height="200" viewBox="0 0 800 200" xmlns="http://www.w3.org/2000/svg">
<defs>
  <clipPath id="posterClip"><rect width="134" height="200"/></clipPath>
  <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#07080e"/>
    <stop offset="100%" stop-color="#07080e" stop-opacity="0"/>
  </linearGradient>
</defs>
<rect width="800" height="200" fill="#07080e"/>
${art}
<rect x="68" y="0" width="100" height="200" fill="url(#fade)"/>
<line x1="158" y1="28" x2="158" y2="172" stroke="#12141f" stroke-width="1"/>
<text x="178" y="37" font-family="'Courier New',monospace" font-size="8" fill="#1a1f2a" letter-spacing="2.5">RECENTLY WATCHED</text>
<text x="176" y="86" font-family="'Courier New',monospace" font-size="23" font-weight="bold" fill="#dde1ed" letter-spacing="0.2">${title}</text>
${yr ? `<text x="178" y="108" font-family="'Courier New',monospace" font-size="12" fill="#1e2030">${yr}</text>` : ''}
<text x="178" y="${yr ? '138' : '128'}" font-family="'Courier New',monospace" font-size="16" fill="#1e3050" letter-spacing="2">${stars}</text>
<g fill="#050609">
  ${[16,52,88,124,160].map(y=>`<rect x="6" y="${y}" width="8" height="10" rx="1"/>`).join('')}
  ${[16,52,88,124,160].map(y=>`<rect x="786" y="${y}" width="8" height="10" rx="1"/>`).join('')}
</g>
<text x="774" y="187" text-anchor="end" font-family="'Courier New',monospace" font-size="7.5" fill="#0f101a" letter-spacing="2">LETTERBOXD</text>
<rect width="800" height="200" fill="none" stroke="#0d0e18" stroke-width="1"/>
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
