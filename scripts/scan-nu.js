#!/usr/bin/env node
// "Scan nu": start meteen een prijsscan en meld op je telefoon wanneer hij klaar is.
// Bedoeld voor een Termux:Widget-knop op je startscherm (zie TERMUX.md), maar werkt ook gewoon:
//
//   node ~/Ghost/scripts/scan-nu.js          NL-prijsvolger
//   REGIO=us node ~/Ghost/scripts/scan-nu.js de USA-prijsvolger
//
// Draait de server niet, dan start hij hem eerst (scripts/termux-start.sh).

const { execFile, execFileSync, spawnSync } = require('child_process');
const path = require('path');

const REGIO = (process.env.REGIO || 'nl').toLowerCase();
const PORT = process.env.PORT || 3000;
const API = `http://127.0.0.1:${PORT}/api/pw/${REGIO}`;
const PAGE = `http://localhost:${PORT}/${REGIO === 'us' ? 'prices' : 'prijzen'}.html`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let hasApi = false;
try { execFileSync('sh', ['-c', 'command -v termux-notification'], { stdio: 'ignore' }); hasApi = true; } catch {}
function notify(title, content, ongoing = false) {
  console.log(`${title}  ${content}`);
  if (!hasApi) return;
  const args = ['--id', '997', '--title', title, '--content', content, '--group', 'prijsvolger', '--action', `termux-open-url '${PAGE}'`];
  if (ongoing) args.push('--ongoing', '--alert-once'); else args.push('--priority', 'high');
  execFile('termux-notification', args, () => {});
}

async function api(p, opts) {
  const r = await fetch(API + p, { ...opts, signal: AbortSignal.timeout(10000) });
  if (r.status === 401 || r.redirected) throw new Error('inloggen nodig');
  return r.json();
}

async function serverUp() {
  try { await api('/job'); return true; } catch (e) { if (e.message === 'inloggen nodig') throw e; return false; }
}

(async () => {
  if (!(await serverUp())) {
    notify('⏳ Server starten…', 'Even geduld');
    spawnSync('sh', [path.join(__dirname, 'termux-start.sh')], { stdio: 'ignore' });
    for (let i = 0; i < 20 && !(await serverUp()); i++) await sleep(1500);
    if (!(await serverUp())) return notify('❌ Server start niet', 'Kijk in ~/Ghost/data/server.log');
  }

  const before = await api('/job');
  if (!before.running) await api('/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  notify('🔎 Prijzen scannen…', before.running ? 'Er liep al een scan, ik volg hem' : 'Gestart', true);

  const t0 = Date.now();
  let last = '';
  while (Date.now() - t0 < 3 * 3600e3) {
    await sleep(5000);
    let j;
    try { j = await api('/job'); } catch { continue; }
    if (!j.running && !j.queue) break;
    const line = j.total ? `${j.done}/${j.total} shops${j.current ? ' · ' + j.current : ''}` : (j.phase || 'bezig…');
    if (line !== last) { notify('🔎 Prijzen scannen…', line, true); last = line; }
  }

  const s = await api('/state');
  const shops = s.shops.filter((x) => x.lastScan > t0 - 60e3);
  const prices = shops.reduce((n, x) => n + (x.offers || 0), 0);
  const errors = shops.filter((x) => x.lastError).length;
  notify('✅ Scan klaar', `${prices} prijzen uit ${shops.length} ${shops.length === 1 ? 'shop' : 'shops'}${errors ? ` · ${errors} met fout` : ''}. Tik om te bekijken.`);
})().catch((e) => notify('❌ Scan mislukt', e.message === 'inloggen nodig'
  ? 'De server vraagt om inloggen. Scan via de website.' : e.message));
