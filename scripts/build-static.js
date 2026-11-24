// Bouwt de openbare prijzensite voor GitHub Pages.
// Draait in GitHub Actions: zoekt shops, scant prijzen en schrijft site/ (HTML + state.json).
// Lokaal proberen: node scripts/build-static.js

const fs = require('fs');
const path = require('path');
const helpers = require('../server.js');
const createPriceWatch = require('../pricewatch');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'site');
const PAGES = { nl: 'prijzen', us: 'prices' };
const DISCOVER_DAYS = parseInt(process.env.DISCOVER_DAYS || '7');
const FORCE_DISCOVER = process.env.DISCOVER === 'true';
const REGIONS = (process.env.REGIONS || 'nl,us').split(',');

const readList = f => {
  try {
    return fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').map(l => l.replace(/#.*/, '').trim()).filter(Boolean);
  } catch { return []; }
};

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const template = fs.readFileSync(path.join(ROOT, 'public', 'pricewatch.html'), 'utf8');
  const summary = {};

  for (const region of REGIONS) {
    const t0 = Date.now();
    const pw = createPriceWatch({ ...helpers, dir: ROOT, region });
    pw.onLog(msg => console.log(`[${region}] ${msg}`));
    pw.configure({ autoAdd: true, ...(process.env.BRAVE_API_KEY ? { braveKey: process.env.BRAVE_API_KEY } : {}) });
    pw.addShops(readList(`shops-${region}.txt`));
    const discover = FORCE_DISCOVER || pw.needsDiscover(DISCOVER_DAYS);
    console.log(`[${region}] start · shops zoeken: ${discover ? 'ja' : 'nee'}`);
    await pw.run({ discover, scan: true });
    pw.pruneFailed();
    pw.stop();

    const state = pw.exportState();
    const dir = path.join(OUT, PAGES[region]);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(state));
    fs.writeFileSync(path.join(dir, 'index.html'), template.replace('__REGION__', region).replace("window.REGION = '", "window.STATIC = true; window.REGION = '"));
    summary[region] = { shops: state.shops.length, offers: state.offers.length, minutes: Math.round((Date.now() - t0) / 6e4) };
    console.log(`[${region}] klaar: ${state.shops.length} shops, ${state.offers.length} prijzen`);
  }

  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  fs.writeFileSync(path.join(OUT, 'index.html'), `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#0f1117"><title>Ghost Prijsvolger</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f1117;color:#e6e8ee;font:16px/1.5 system-ui,sans-serif;padding:16px}
main{width:100%;max-width:380px}h1{font-size:22px}a{display:block;background:#171a23;border:1px solid #2a2f3d;border-radius:12px;padding:18px;margin:10px 0;color:#e6e8ee;text-decoration:none;font-weight:600}
a small{display:block;color:#8b90a0;font-weight:400}</style></head><body><main><h1>💰 Ghost Prijsvolger</h1>
<a href="prijzen/">🇳🇱 Nederland<small>Peptideprijzen in euro</small></a><a href="prices/">🇺🇸 United States<small>Peptide prices in USD</small></a></main></body></html>`);
  console.log('Samenvatting:', JSON.stringify(summary));
})().catch(e => { console.error(e); process.exit(1); });
