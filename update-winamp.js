const https = require('https');
const http  = require('http');
const fs    = require('fs');

const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
const LASTFM_USER    = process.env.LASTFM_USER;

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function trunc(s, n) { return s.length > n ? s.slice(0,n-1)+'…' : s; }

async function fetchJSON(url) {
  return new Promise((res,rej) => {
    https.get(url, r => {
      let d=''; r.on('data',c=>d+=c); r.on('end',()=>{try{res(JSON.parse(d))}catch(e){rej(e)}}); r.on('error',rej);
    });
  });
}

async function fetchImageBase64(url) {
  if (!url || url.includes('2a96cbd8b46e442fc41c2b86b821562f') || !url.startsWith('http')) return null;
  return new Promise(res => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, r => {
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
    req.setTimeout(8000, () => { req.destroy(); res(null); });
  });
}

function generateSVG({ trackName, artistName, isPlaying, imageBase64 }) {
  const track  = esc(trunc(trackName  || 'nothing', 36));
  const artist = esc(trunc(artistName || '—', 32));
  const dot    = isPlaying ? '#22c55e' : '#1f2937';
  const label  = isPlaying ? 'NOW PLAYING' : 'LAST PLAYED';
  const barW   = isPlaying ? 420 : 0;

  const art = imageBase64
    ? `<image href="${imageBase64}" x="0" y="0" width="162" height="200" preserveAspectRatio="xMidYMid slice" clip-path="url(#ac)"/>`
    : `<rect x="0" y="0" width="162" height="200" fill="#0a0b14"/>
       <text x="81" y="107" text-anchor="middle" font-family="Georgia,serif" font-size="32" fill="#151722">♫</text>`;

  return `<svg width="800" height="200" viewBox="0 0 800 200" xmlns="http://www.w3.org/2000/svg">
<defs><clipPath id="ac"><rect width="162" height="200"/></clipPath></defs>
<rect width="800" height="200" fill="#0b0c15"/>
${art}
<rect x="162" y="0" width="638" height="200" fill="#0b0c15"/>
<line x1="162" y1="0" x2="162" y2="200" stroke="#1c1e2e" stroke-width="1"/>
<circle cx="182" cy="30" r="3.5" fill="${dot}"/>
<text x="194" y="33.5" font-family="'Courier New',monospace" font-size="8" fill="#374151" letter-spacing="3">${label}</text>
<text x="180" y="84" font-family="Georgia,'Times New Roman',serif" font-size="26" font-weight="bold" fill="#e8ecf4">${track}</text>
<text x="182" y="108" font-family="'Courier New',monospace" font-size="12" fill="#4b5563">${artist}</text>
<rect x="180" y="136" width="596" height="1.5" fill="#1a1d2e" rx="1"/>
<rect x="180" y="136" width="${barW}" height="1.5" fill="#2563eb" rx="1" opacity="0.9"/>
${isPlaying ? `<circle cx="${180+barW}" cy="136.8" r="3.5" fill="#3b82f6"/>` : ''}
<text x="182" y="166" font-family="'Courier New',monospace" font-size="10" fill="#1f2937" letter-spacing="8">⏮  ⏪  ▶  ⏸  ⏭</text>
<text x="772" y="188" text-anchor="end" font-family="'Courier New',monospace" font-size="7" fill="#161824" letter-spacing="4">WINAMP</text>
<rect width="800" height="200" fill="none" stroke="#1a1c2c" stroke-width="1"/>
</svg>`;
}

async function main() {
  let d = { trackName:'nothing', artistName:'—', isPlaying:false, imageBase64:null };
  try {
    const data = await fetchJSON(`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${LASTFM_USER}&api_key=${LASTFM_API_KEY}&format=json&limit=1`);
    const tracks = data.recenttracks?.track;
    if (tracks) {
      const t = Array.isArray(tracks) ? tracks[0] : tracks;
      const isPlaying = t['@attr']?.nowplaying === 'true';
      d = {
        trackName: t.name,
        artistName: t.artist?.['#text'] || String(t.artist),
        isPlaying,
        imageBase64: await fetchImageBase64(t.image?.[2]?.['#text']),
      };
      console.log(`${isPlaying?'▶':'■'} ${d.trackName} — ${d.artistName}`);
    }
  } catch(e) { console.error('lastfm error:', e.message); }
  fs.writeFileSync('winamp.svg', generateSVG(d));
}
main();
