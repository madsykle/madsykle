const https = require('https');
const http = require('http');
const fs = require('fs');

const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
const LASTFM_USER = process.env.LASTFM_USER;

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
      res.on('error', reject);
    });
  });
}

async function fetchImageBase64(url) {
  if (!url || url.includes('2a96cbd8b46e442fc41c2b86b821562f') || !url.startsWith('http')) return null;
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        fetchImageBase64(res.headers.location).then(resolve);
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const ct = res.headers['content-type'] || 'image/jpeg';
        resolve(`data:${ct};base64,${buf.toString('base64')}`);
      });
      res.on('error', () => resolve(null));
    });
    req.on('error', () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
  });
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function trunc(str, max) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function generateSVG({ trackName, artistName, isPlaying, imageBase64 }) {
  const track  = esc(trunc(trackName  || 'nothing', 34));
  const artist = esc(trunc(artistName || '—', 30));
  const dot    = isPlaying ? '#39d353' : '#555';
  const label  = isPlaying ? 'NOW PLAYING' : 'LAST PLAYED';
  const barW   = isPlaying ? 260 : 0;

  const art = imageBase64
    ? `<image href="${imageBase64}" x="9" y="27" width="82" height="82" preserveAspectRatio="xMidYMid slice" clip-path="url(#artClip)"/>`
    : `<rect x="9" y="27" width="82" height="82" fill="#111827"/>
       <text x="50" y="76" text-anchor="middle" font-family="monospace" font-size="26" fill="#1e293b">♫</text>`;

  return `<svg width="560" height="160" viewBox="0 0 560 160" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<defs>
  <clipPath id="artClip"><rect x="9" y="27" width="82" height="82"/></clipPath>
  <linearGradient id="titleBar" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#0a0a18"/>
    <stop offset="100%" stop-color="#141428"/>
  </linearGradient>
  <linearGradient id="btn" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#d8d8d8"/>
    <stop offset="100%" stop-color="#b0b0b0"/>
  </linearGradient>
  <linearGradient id="prog" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#3b82f6"/>
    <stop offset="100%" stop-color="#1d4ed8"/>
  </linearGradient>
</defs>

<!-- Outer chrome -->
<rect width="560" height="160" fill="#000" rx="2"/>
<rect x="1" y="1" width="558" height="158" fill="#fff" rx="1"/>
<rect x="2" y="2" width="556" height="156" fill="#c0c0c0"/>
<rect x="3" y="3" width="554" height="154" fill="#868686"/>
<rect x="4" y="4" width="552" height="152" fill="#c0c0c0"/>

<!-- Title bar -->
<rect x="5" y="5" width="550" height="19" fill="url(#titleBar)"/>
<text x="280" y="17.5" text-anchor="middle" font-family="'Arial Narrow','Arial',sans-serif"
  font-size="10" font-weight="bold" fill="#c8c8e8" letter-spacing="3">WINAMP</text>
<!-- Menu btn -->
<rect x="7" y="8" width="14" height="13" fill="#c0c0c0" stroke="#444" stroke-width="0.5" rx="1"/>
<text x="14" y="18" text-anchor="middle" font-family="Arial" font-size="7" fill="#333">≡</text>
<!-- Close btn -->
<rect x="543" y="8" width="14" height="13" fill="#c0c0c0" stroke="#444" stroke-width="0.5" rx="1"/>
<text x="550" y="18" text-anchor="middle" font-family="Arial" font-size="10" fill="#333">×</text>
<!-- Shade btn -->
<rect x="527" y="8" width="14" height="13" fill="#c0c0c0" stroke="#444" stroke-width="0.5" rx="1"/>
<text x="534" y="18" text-anchor="middle" font-family="Arial" font-size="8" fill="#333">▪</text>

<!-- Main display -->
<rect x="5" y="25" width="550" height="95" fill="#0b0c14"/>
<rect x="5" y="25" width="550" height="1" fill="#333"/>

<!-- Album art -->
${art}
<rect x="9" y="27" width="82" height="82" fill="none" stroke="#1e293b" stroke-width="1"/>

<!-- Right panel -->
<rect x="97" y="27" width="454" height="95" fill="#0b0c14"/>

<!-- Status dot + label -->
<circle cx="108" cy="35" r="4.5" fill="${dot}"/>
<text x="120" y="38.5" font-family="'Courier New',monospace" font-size="8.5"
  fill="#4a6fa5" letter-spacing="1.5">${label}</text>

<!-- Track name -->
<text x="100" y="58" font-family="'Courier New',monospace" font-size="14"
  font-weight="bold" fill="#e2e8f0" letter-spacing="0.3">${track}</text>

<!-- Artist -->
<text x="100" y="76" font-family="'Courier New',monospace" font-size="11"
  fill="#64748b" letter-spacing="0.3">${artist}</text>

<!-- Tech row -->
<rect x="97" y="87" width="454" height="18" fill="#07080f"/>
<rect x="100" y="90" width="58" height="11" fill="#050611"/>
<text x="129" y="99" text-anchor="middle" font-family="'Courier New',monospace"
  font-size="8.5" fill="#3b6ea8">320 Kbps</text>
<rect x="163" y="90" width="44" height="11" fill="#050611"/>
<text x="185" y="99" text-anchor="middle" font-family="'Courier New',monospace"
  font-size="8.5" fill="#3b6ea8">44 KHz</text>
<rect x="212" y="90" width="52" height="11" fill="#050611"/>
<text x="238" y="99" text-anchor="middle" font-family="'Courier New',monospace"
  font-size="8.5" fill="${isPlaying ? '#22c55e' : '#374151'}">STEREO</text>

<!-- EQ / PL -->
<rect x="506" y="90" width="20" height="11" fill="#c0c0c0" stroke="#808080" stroke-width="0.5"/>
<text x="516" y="99" text-anchor="middle" font-family="Arial" font-size="7.5"
  font-weight="bold" fill="#111">EQ</text>
<rect x="528" y="90" width="20" height="11" fill="#c0c0c0" stroke="#808080" stroke-width="0.5"/>
<text x="538" y="99" text-anchor="middle" font-family="Arial" font-size="7.5"
  font-weight="bold" fill="#111">PL</text>

<!-- Progress bar -->
<rect x="5" y="121" width="550" height="11" fill="#07080f"/>
<rect x="8" y="123" width="544" height="7" fill="#050611" rx="1"/>
<rect x="8" y="123" width="${barW}" height="7" fill="url(#prog)" rx="1" opacity="0.85"/>
${isPlaying ? `<rect x="${8 + barW - 2}" y="122" width="4" height="9" fill="#93c5fd" rx="1"/>` : ''}

<!-- Controls bar -->
<rect x="5" y="133" width="550" height="22" fill="#c0c0c0"/>
<rect x="5" y="133" width="550" height="1" fill="#e8e8e8"/>
<rect x="5" y="154" width="550" height="1" fill="#888"/>

<!-- Playback buttons -->
${[['⏮',8],['⏪',44],['▶',80],['⏸',116],['■',152],['⏭',188],['⏏',224]].map(([icon, x]) => `
<rect x="${x}" y="135" width="32" height="18" fill="url(#btn)" stroke="#808080" stroke-width="0.5" rx="1"/>
<rect x="${x+1}" y="136" width="30" height="8" fill="#e8e8e8" opacity="0.4" rx="1"/>
<text x="${x+16}" y="148" text-anchor="middle" font-family="'Segoe UI Emoji','Apple Color Emoji',sans-serif"
  font-size="10" fill="#111">${icon}</text>`).join('')}

<!-- Shuffle / Rep -->
<rect x="420" y="135" width="52" height="18" fill="url(#btn)" stroke="#808080" stroke-width="0.5" rx="1"/>
<text x="446" y="147" text-anchor="middle" font-family="Arial" font-size="8.5" fill="#111">Shuffle</text>
<rect x="476" y="135" width="35" height="18" fill="url(#btn)" stroke="#808080" stroke-width="0.5" rx="1"/>
<text x="493" y="147" text-anchor="middle" font-family="Arial" font-size="8.5" fill="#111">Rep</text>

<!-- Bottom + right chrome -->
<rect x="0" y="155" width="560" height="5" fill="#000"/>
<rect x="555" y="0" width="5" height="160" fill="#000"/>
</svg>`;
}

async function main() {
  let svgData = {
    trackName: 'nothing playing',
    artistName: '—',
    isPlaying: false,
    imageBase64: null,
  };

  try {
    const data = await fetchJSON(
      `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks` +
      `&user=${LASTFM_USER}&api_key=${LASTFM_API_KEY}&format=json&limit=1`
    );
    const tracks = data.recenttracks?.track;
    if (tracks) {
      const track = Array.isArray(tracks) ? tracks[0] : tracks;
      const isPlaying = track['@attr']?.nowplaying === 'true';
      const imgUrl = track.image?.[2]?.['#text'] || track.image?.[1]?.['#text'];
      svgData = {
        trackName: track.name,
        artistName: track.artist?.['#text'] || String(track.artist),
        isPlaying,
        imageBase64: await fetchImageBase64(imgUrl),
      };
      console.log(`${isPlaying ? '▶' : '■'} ${svgData.trackName} — ${svgData.artistName}`);
    }
  } catch (e) {
    console.error('Last.fm fetch failed:', e.message);
  }

  fs.writeFileSync('winamp.svg', generateSVG(svgData));
}

main();
