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
  const track  = esc(trunc(trackName  || 'nothing', 38));
  const artist = esc(trunc(artistName || '—', 34));
  const dot    = isPlaying ? '#39d353' : '#2a2a3a';
  const label  = isPlaying ? 'NOW PLAYING' : 'LAST PLAYED';
  const labelC = isPlaying ? '#2a4a2a' : '#222230';
  const barW   = isPlaying ? 340 : 0;
  const progC  = isPlaying ? '#1e3a6a' : '#111';

  const art = imageBase64
    ? `<image href="${imageBase64}" x="0" y="0" width="176" height="200" preserveAspectRatio="xMidYMid slice" clip-path="url(#artClip)"/>`
    : `<rect x="0" y="0" width="176" height="200" fill="#090b14"/>
       <text x="88" y="108" text-anchor="middle" font-family="monospace" font-size="30" fill="#111827">♫</text>`;

  return `<svg width="800" height="200" viewBox="0 0 800 200" xmlns="http://www.w3.org/2000/svg">
<defs>
  <clipPath id="artClip"><rect width="176" height="200"/></clipPath>
  <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#07080e"/>
    <stop offset="100%" stop-color="#07080e" stop-opacity="0"/>
  </linearGradient>
</defs>
<rect width="800" height="200" fill="#07080e"/>
${art}
<rect x="100" y="0" width="100" height="200" fill="url(#fade)"/>
<line x1="200" y1="28" x2="200" y2="172" stroke="#12141f" stroke-width="1"/>
<circle cx="220" cy="34" r="3.5" fill="${dot}"/>
<text x="232" y="37.5" font-family="'Courier New',monospace" font-size="8" fill="${labelC}" letter-spacing="2.5">${label}</text>
<text x="218" y="82" font-family="'Courier New',monospace" font-size="23" font-weight="bold" fill="#dde1ed" letter-spacing="0.2">${track}</text>
<text x="220" y="104" font-family="'Courier New',monospace" font-size="13" fill="#272a3a">${artist}</text>
<rect x="220" y="132" width="554" height="1" fill="#0e1018"/>
<rect x="220" y="132" width="${barW}" height="1" fill="${progC}"/>
${isPlaying ? `<circle cx="${220+barW}" cy="132.5" r="3" fill="#1e3a6a"/>` : ''}
<text x="220" y="162" font-family="'Courier New',monospace" font-size="9" fill="#15161f" letter-spacing="6">⏮  ⏪  ▶  ⏸  ⏭</text>
<text x="774" y="187" text-anchor="end" font-family="'Courier New',monospace" font-size="7.5" fill="#0f101a" letter-spacing="3.5">WINAMP</text>
<rect width="800" height="200" fill="none" stroke="#0d0e18" stroke-width="1"/>
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
      d = { trackName: t.name, artistName: t.artist?.['#text'] || String(t.artist), isPlaying, imageBase64: await fetchImageBase64(t.image?.[2]?.['#text']) };
      console.log(`${isPlaying?'▶':'■'} ${d.trackName} — ${d.artistName}`);
    }
  } catch(e) { console.error('lastfm error:', e.message); }
  fs.writeFileSync('winamp.svg', generateSVG(d));
}
main();
