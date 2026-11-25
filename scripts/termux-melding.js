#!/usr/bin/env node
// Telefoonmeldingen voor de prijsvolger (Termux + Termux:API).
//
// Kijkt elke minuut in data/<regio>/ naar nieuwe prijsalarm-treffers en prijsdalingen
// en stuurt per nieuw item een Android-melding (termux-notification). Tik op de melding
// om de productpagina te openen. Zonder Termux:API wordt de melding alleen geprint.
//
//   node scripts/termux-melding.js              NL, alarmen + dalingen van minstens 5%
//   MIN_DROP=10 node scripts/termux-melding.js  alleen dalingen van minstens 10%
//   REGIO=us node scripts/termux-melding.js     de USA-prijsvolger
//   ONCE=1 node scripts/termux-melding.js       één keer kijken en stoppen (voor cron)
//
// Wat al gemeld is, staat in data/<regio>/melding-state.json, dus je krijgt niets dubbel.

const fs = require('fs');
const path = require('path');
const { execFile, execFileSync } = require('child_process');

const REGIO = (process.env.REGIO || 'nl').toLowerCase();
const MIN_DROP = Number(process.env.MIN_DROP || 5);          // procent
const INTERVAL = Number(process.env.INTERVAL || 60) * 1000;  // ms
const DATA = path.join(__dirname, '..', 'data', REGIO);
const STATE = path.join(DATA, 'melding-state.json');
const SYM = { EUR: '€', USD: '$', GBP: '£' };

const load = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch { return d; } };
const money = (v, c) => (v == null ? '?' : (SYM[c] || (c ? c + ' ' : '')) + Number(v).toFixed(2).replace('.', REGIO === 'nl' ? ',' : '.'));

let hasApi = false;
try { execFileSync('sh', ['-c', 'command -v termux-notification'], { stdio: 'ignore' }); hasApi = true; } catch {}

function notify(id, title, content, url) {
  console.log(`${new Date().toLocaleString("nl-NL")}  ${title}\n   ${content}${url ? '\n   ' + url : ''}`);
  if (!hasApi) return;
  const args = ['--id', String(id), '--title', title, '--content', content, '--group', 'prijsvolger', '--priority', 'high'];
  if (url) args.push('--action', `termux-open-url '${url.replace(/'/g, '')}'`);
  execFile('termux-notification', args, (err) => { if (err) console.error('termux-notification mislukt:', err.message); });
}

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return null; }
}
function writeState(s) {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(s));
}

let n = 0;
function check() {
  const hits = load('alert-hits.json', []);
  const changes = load('changes.json', []);
  let state = readState();
  if (!state) {
    // eerste keer: alles wat er al is telt als gezien, alleen nieuwe dingen worden gemeld
    state = { since: Date.now(), seen: [] };
    for (const h of hits) state.seen.push('a|' + h.alertId + '|' + h.key + '|' + h.price);
    for (const c of changes) state.seen.push('d|' + c.key + '|' + c.t);
    writeState(state);
    console.log(`👀 Meldingen actief (${REGIO.toUpperCase()}, dalingen ≥ ${MIN_DROP}%)${hasApi ? '' : ' — Termux:API niet gevonden, alleen tekst'}`);
    return;
  }
  const seen = new Set(state.seen);
  const fresh = [];

  for (const h of hits) {
    const k = 'a|' + h.alertId + '|' + h.key + '|' + h.price;
    if (seen.has(k)) continue;
    seen.add(k);
    const per = h.perMg != null ? ` · ${money(h.perMg, h.currency)}/mg` : '';
    fresh.push(['🔔 Prijsalarm: ' + (h.peptide || h.name), `${h.shop}: ${h.name}${h.variant ? ' ' + h.variant : ''} voor ${money(h.price, h.currency)}${per}`, h.url]);
  }
  for (const c of changes) {
    const k = 'd|' + c.key + '|' + c.t;
    if (seen.has(k)) continue;
    seen.add(k);
    if (c.old == null || c.new == null || c.new >= c.old) continue;          // alleen dalingen
    const pct = Math.round((1 - c.new / c.old) * 100);
    if (pct < MIN_DROP) continue;
    fresh.push([`📉 −${pct}% ${c.peptide || c.name}`, `${c.shop}: ${c.name}${c.variant ? ' ' + c.variant : ''} ${money(c.old, c.currency)} → ${money(c.new, c.currency)}`, c.url]);
  }

  // bij een grote scan niet 50 meldingen: na 5 stuks één samenvatting
  fresh.slice(0, 5).forEach(([t, c, u]) => notify(1000 + (n++ % 50), t, c, u));
  if (fresh.length > 5) notify(999, `💰 Nog ${fresh.length - 5} prijsmeldingen`, 'Open de prijsvolger voor het overzicht.', `http://localhost:${process.env.PORT || 3000}/${REGIO === 'us' ? 'prices' : 'prijzen'}.html`);

  state.seen = [...seen].slice(-3000);
  writeState(state);
}

check();
if (!process.env.ONCE) setInterval(check, INTERVAL);
