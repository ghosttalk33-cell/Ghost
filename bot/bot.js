// Ghost-bot: een alles-in-1 Telegram-assistent, met de functies van Grok nagebouwd.
//
//   chatten met geheugen · Denk-modus · DeepSearch (zoeken + bronnen) · foto's en PDF's lezen
//   persona's · geplande taken en herinneringen · Gmail lezen en (na jouw OK) versturen
//   je prijsvolger bedienen · optioneel afbeeldingen maken (xAI)
//
// Start: cd ~/Ghost/bot && npm install && node bot.js     (instellingen in bot/.env, zie .env.voorbeeld)
// Alleen de eigenaar (OWNER_ID) kan de bot gebruiken.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

// ---------------------------------------------------------------- instellingen (.env)
function loadEnv(file) {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !line.trim().startsWith('#') && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
}
loadEnv(path.join(HERE, '.env'));
process.env.TZ ||= 'Europe/Amsterdam';

const CFG = {
  telegram: process.env.TELEGRAM_TOKEN || '',
  owner: String(process.env.OWNER_ID || ''),
  model: process.env.MODEL_SNEL || process.env.MODEL || 'claude-haiku-5-5',   // gewone vragen: goedkoop
  modelSlim: process.env.MODEL_SLIM || 'claude-opus-5-5',                     // /denk en /deepsearch
  limietDag: Number(process.env.LIMIET_DAG ?? 0.5),     // dollar per dag
  limietMaand: Number(process.env.LIMIET_MAAND ?? 10),  // dollar per maand
  mailUser: process.env.MAIL_USER || '',
  mailPass: (process.env.MAIL_PASS || '').replace(/\s+/g, ''),
  imapHost: process.env.MAIL_IMAP_HOST || 'imap.gmail.com',
  smtpHost: process.env.MAIL_SMTP_HOST || 'smtp.gmail.com',
  xaiKey: process.env.XAI_API_KEY || '',
  xaiImageModel: process.env.XAI_IMAGE_MODEL || 'grok-imagine-image',
  pwPort: process.env.PW_PORT || process.env.PORT || 3000,
  region: process.env.REGIO || 'nl',
};
if (!CFG.telegram) { console.error('TELEGRAM_TOKEN ontbreekt in bot/.env (zie .env.voorbeeld)'); process.exit(1); }
if (!process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY ontbreekt in bot/.env (zie .env.voorbeeld)'); process.exit(1); }

const claude = new Anthropic();
const DATA = path.join(HERE, 'data');
fs.mkdirSync(DATA, { recursive: true });
const STATE_FILE = path.join(DATA, 'state.json');

// ---------------------------------------------------------------- opslag
let S = { history: [], persona: 'standaard', deep: false, memory: [], tasks: [], cost: { day: '', dayUsd: 0, month: '', monthUsd: 0, totalUsd: 0 } };
try { S = { ...S, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) }; } catch {}
const save = () => fs.writeFileSync(STATE_FILE, JSON.stringify(S, null, 1));
const pending = new Map();   // mails die op jouw OK wachten (alleen in het geheugen)

// ---------------------------------------------------------------- Telegram
const TG = `https://api.telegram.org/bot${CFG.telegram}`;
async function tg(method, body) {
  const r = await fetch(`${TG}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!j.ok) throw new Error(`Telegram ${method}: ${j.description}`);
  return j.result;
}
async function send(chatId, text, extra = {}) {
  text = String(text || '').trim() || '(leeg antwoord)';
  for (let i = 0; i < text.length; i += 3900) {
    await tg('sendMessage', { chat_id: chatId, text: text.slice(i, i + 3900), disable_web_page_preview: true, ...(i + 3900 >= text.length ? extra : {}) });
  }
}
async function downloadFile(fileId) {
  const f = await tg('getFile', { file_id: fileId });
  const r = await fetch(`https://api.telegram.org/file/bot${CFG.telegram}/${f.file_path}`);
  return { buf: Buffer.from(await r.arrayBuffer()), name: path.basename(f.file_path) };
}
function typing(chatId) {
  const tick = () => tg('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});
  tick(); const t = setInterval(tick, 4500);
  return () => clearInterval(t);
}

// ---------------------------------------------------------------- persona's (zoals Grok's modi en companions)
const PERSONAS = {
  standaard: 'Je bent behulpzaam, direct en eerlijk, met een vleugje humor. Je zegt het als je iets niet weet.',
  grappig: 'Je bent grappig, brutaal en sarcastisch, zoals Grok in "fun mode". Je blijft wel inhoudelijk correct en behulpzaam.',
  zakelijk: 'Je bent een zakelijke assistent: kort, gestructureerd, professioneel. Geen grappen.',
  docent: 'Je bent een geduldige docent. Je legt stap voor stap uit in eenvoudige woorden, met voorbeelden, en checkt of het duidelijk is.',
  coach: 'Je bent een motiverende coach: positief, concreet, met kleine haalbare stappen.',
  marketeer: 'Je bent een ervaren marketeer voor webshops: pakkende teksten, social posts, productbeschrijvingen en SEO-titels.',
};

function systemPrompt() {
  const mem = S.memory.length ? '\n\nWat je over de gebruiker onthouden hebt:\n' + S.memory.map((m) => `- [${m.id}] ${m.text}`).join('\n') : '';
  return `Je bent Ghost, een persoonlijke alles-in-1 assistent in Telegram voor één gebruiker. Antwoord in de taal van de gebruiker (meestal Nederlands).
${PERSONAS[S.persona] || PERSONAS.standaard}

Telegram toont geen Markdown: gebruik geen **, # of tabellen. Gebruik korte alinea's en opsommingen met •. Zet links gewoon als volledige URL.

Je kunt:
• op internet zoeken en pagina's lezen (web_search, web_fetch). Doe dat bij actuele vragen, prijzen, nieuws of als je het niet zeker weet, en noem je bronnen.
• foto's, screenshots en PDF's bekijken die de gebruiker stuurt.
• de prijsvolger van de gebruiker gebruiken (prijs_goedkoopste, prijs_dalingen, prijs_scan) voor peptideprijzen van webshops.
• Gmail lezen (mail_lijst, mail_lees) en mails opstellen (mail_versturen). mail_versturen verstuurt NIET zelf: de gebruiker krijgt een knop om te bevestigen. Zeg dat erbij.
• taken en herinneringen plannen (taak_maken, taak_lijst, taak_verwijderen), bijv. "elke ochtend om 8 uur nieuws samenvatten".
• dingen onthouden over de gebruiker (onthoud, vergeet) als die dat vraagt of als het duidelijk nuttig is voor later.${CFG.xaiKey ? '\n• afbeeldingen maken (afbeelding_maken).' : ''}

Grenzen: geen medisch advies of doseringen voor peptiden; die zijn "research use only". Help niet met hacken van anderen, spam of iets illegaals.
Wees beknopt: kort antwoord tenzij de gebruiker om meer vraagt. De huidige datum en tijd staan bovenaan elk bericht van de gebruiker.${mem}`;
}

// ---------------------------------------------------------------- tools
const NEW_WEB = /opus-5|opus-4-[678]|sonnet-5|sonnet-4-6|fable|mythos/;
const webTools = (model, deep) => NEW_WEB.test(model)
  ? [{ type: 'web_search_20260209', name: 'web_search', max_uses: deep ? 8 : 3 }, { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: deep ? 8 : 3 }]
  : [{ type: 'web_search_20250305', name: 'web_search', max_uses: deep ? 8 : 3 }, { type: 'web_fetch_20250910', name: 'web_fetch', max_uses: deep ? 8 : 3 }];
const TOOLS = [
  { name: 'prijs_goedkoopste', description: 'Goedkoopste prijs per mg per peptide uit de prijsvolger (alleen producten op voorraad). Optioneel filter op peptide.',
    input_schema: { type: 'object', properties: { peptide: { type: 'string', description: 'bijv. "BPC-157" of "Retatrutide"; leeg = overzicht' } } } },
  { name: 'prijs_dalingen', description: 'Recente prijsdalingen, prijsstijgingen en nieuwe producten uit de prijsvolger.',
    input_schema: { type: 'object', properties: { aantal: { type: 'integer', description: 'max aantal, standaard 15' } } } },
  { name: 'prijs_scan', description: 'Start nu een nieuwe prijsscan van alle shops in de prijsvolger.', input_schema: { type: 'object', properties: {} } },
  { name: 'mail_lijst', description: 'Lijst van recente mails in de Gmail-inbox (afzender, onderwerp, datum, uid).',
    input_schema: { type: 'object', properties: {
      aantal: { type: 'integer', description: 'standaard 10, max 30' },
      alleen_ongelezen: { type: 'boolean' },
      zoek: { type: 'string', description: 'zoekterm in afzender, onderwerp of tekst' } } } },
  { name: 'mail_lees', description: 'Lees de volledige tekst van één mail op uid.',
    input_schema: { type: 'object', properties: { uid: { type: 'integer' } }, required: ['uid'] } },
  { name: 'mail_versturen', description: 'Stel een mail op. De gebruiker krijgt hem te zien met een knop Versturen/Annuleren; pas na die bevestiging wordt hij verstuurd.',
    input_schema: { type: 'object', properties: {
      aan: { type: 'string' }, onderwerp: { type: 'string' }, tekst: { type: 'string' },
      antwoord_op_uid: { type: 'integer', description: 'uid van de mail waarop dit een antwoord is (optioneel)' } },
      required: ['aan', 'onderwerp', 'tekst'] } },
  { name: 'taak_maken', description: 'Plan een taak of herinnering. Op het tijdstip voert de assistent "opdracht" uit en stuurt het resultaat. Voor een simpele herinnering: opdracht = "Herinner me eraan: ...".',
    input_schema: { type: 'object', properties: {
      soort: { type: 'string', enum: ['eenmalig', 'dagelijks', 'wekelijks', 'interval'] },
      tijd: { type: 'string', description: 'HH:MM (eenmalig/dagelijks/wekelijks)' },
      datum: { type: 'string', description: 'YYYY-MM-DD (alleen eenmalig; leeg = vandaag of morgen)' },
      weekdag: { type: 'integer', description: '0=zondag … 6=zaterdag (alleen wekelijks)' },
      minuten: { type: 'integer', description: 'elke zoveel minuten (alleen interval, minimaal 15)' },
      opdracht: { type: 'string' } }, required: ['soort', 'opdracht'] } },
  { name: 'taak_lijst', description: 'Toon alle geplande taken.', input_schema: { type: 'object', properties: {} } },
  { name: 'taak_verwijderen', description: 'Verwijder een geplande taak op id.', input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'onthoud', description: 'Onthoud een feit over de gebruiker voor latere gesprekken.', input_schema: { type: 'object', properties: { feit: { type: 'string' } }, required: ['feit'] } },
  { name: 'vergeet', description: 'Vergeet een onthouden feit op id.', input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
];
if (CFG.xaiKey) TOOLS.push({ name: 'afbeelding_maken', description: 'Maak een afbeelding met AI op basis van een beschrijving (Engels werkt het best) en stuur die naar de gebruiker.',
  input_schema: { type: 'object', properties: { beschrijving: { type: 'string' } }, required: ['beschrijving'] } });

const sid = () => crypto.randomBytes(3).toString('hex');
const pwDir = path.join(ROOT, 'data', CFG.region);
const loadPw = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(pwDir, f), 'utf8')); } catch { return d; } };
const eur = (v) => (v == null ? '?' : '€' + Number(v).toFixed(2).replace('.', ','));

// ---- mail
async function imap(fn) {
  if (!CFG.mailUser || !CFG.mailPass) throw new Error('Mail is niet ingesteld: zet MAIL_USER en MAIL_PASS (Gmail-app-wachtwoord) in bot/.env');
  const { ImapFlow } = await import('imapflow');
  const c = new ImapFlow({ host: CFG.imapHost, port: 993, secure: true, auth: { user: CFG.mailUser, pass: CFG.mailPass }, logger: false });
  await c.connect();
  const lock = await c.getMailboxLock('INBOX');
  try { return await fn(c); } finally { lock.release(); await c.logout().catch(() => {}); }
}
async function sendMail(m) {
  const nodemailer = (await import('nodemailer')).default;
  const t = nodemailer.createTransport({ host: CFG.smtpHost, port: 465, secure: true, auth: { user: CFG.mailUser, pass: CFG.mailPass } });
  await t.sendMail({ from: CFG.mailUser, to: m.aan, subject: m.onderwerp, text: m.tekst, ...(m.messageId ? { inReplyTo: m.messageId, references: m.messageId } : {}) });
}

// ---- taken
function nextRun(t, from = Date.now()) {
  const [hh, mm] = String(t.tijd || '09:00').split(':').map(Number);
  const at = (d) => { const x = new Date(d); x.setHours(hh, mm, 0, 0); return x; };
  if (t.soort === 'interval') return from + Math.max(15, t.minuten || 60) * 60e3;
  if (t.soort === 'eenmalig') {
    if (t.datum) { const [y, mo, d] = t.datum.split('-').map(Number); return new Date(y, mo - 1, d, hh, mm).getTime(); }
    let x = at(from); if (x.getTime() <= from) x.setDate(x.getDate() + 1); return x.getTime();
  }
  let x = at(from);
  if (t.soort === 'wekelijks') { while (x.getDay() !== (t.weekdag ?? 1) || x.getTime() <= from) { x.setDate(x.getDate() + 1); x = at(x); } return x.getTime(); }
  if (x.getTime() <= from) x.setDate(x.getDate() + 1);
  return x.getTime();
}
const fmtTask = (t) => `[${t.id}] ${t.soort}${t.soort === 'interval' ? ` elke ${t.minuten} min` : ` ${t.soort === 'wekelijks' ? ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'][t.weekdag ?? 1] + ' ' : ''}${t.datum ? t.datum + ' ' : ''}${t.tijd || ''}`} → ${t.opdracht}  (volgende: ${new Date(t.next).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })})`;

async function runTool(name, input, ctx) {
  switch (name) {
    case 'prijs_goedkoopste': {
      const shops = loadPw('shops.json', []);
      const best = {}; const count = {};
      for (const s of shops) for (const o of loadPw(`offers-${s.id}.json`, [])) {
        if (!o.peptide || !o.inStock || !(o.perMg > 0) || /water/i.test(o.peptide)) continue;
        if (input.peptide && !o.peptide.toLowerCase().includes(String(input.peptide).toLowerCase())) continue;
        count[o.peptide] = (count[o.peptide] || 0) + 1;
        if (!best[o.peptide] || o.perMg < best[o.peptide].perMg) best[o.peptide] = o;
      }
      const list = Object.keys(best).sort((a, b) => count[b] - count[a]).slice(0, input.peptide ? 10 : 15);
      if (!list.length) return shops.length ? 'Geen prijzen gevonden voor dat filter.' : 'De prijsvolger heeft nog geen gescande prijzen.';
      return list.map((p) => { const o = best[p]; return `${p}: ${eur(o.perMg)}/mg · ${o.shop} · ${o.name}${o.variant ? ' ' + o.variant : ''} ${eur(o.priceBase ?? o.price)} · ${o.url}`; }).join('\n');
    }
    case 'prijs_dalingen': {
      const ch = loadPw('changes.json', []).slice(0, Math.min(40, input.aantal || 15));
      if (!ch.length) return 'Nog geen prijswijzigingen bekend.';
      return ch.map((c) => `${new Date(c.t).toLocaleDateString('nl-NL')} ${c.shop}: ${c.name}${c.variant ? ' ' + c.variant : ''} ` +
        (c.isNew ? `NIEUW ${eur(c.new)}` : c.restock ? `weer op voorraad ${eur(c.new)}` : `${eur(c.old)} → ${eur(c.new)} (${c.new < c.old ? '−' : '+'}${Math.round(Math.abs(1 - c.new / c.old) * 100)}%)`) + ` · ${c.url}`).join('\n');
    }
    case 'prijs_scan': {
      const r = await fetch(`http://127.0.0.1:${CFG.pwPort}/api/pw/${CFG.region}/scan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .catch(() => null);
      return r && r.ok ? 'Scan gestart. Prijsdalingen komen binnen als melding; vraag over een paar minuten opnieuw naar de prijzen.' : 'Kon de prijsvolger niet bereiken. Draait de server (sh ~/Ghost/scripts/termux-start.sh)?';
    }
    case 'mail_lijst':
      return imap(async (c) => {
        const q = input.zoek ? { or: [{ from: input.zoek }, { subject: input.zoek }, { body: input.zoek }] } : { all: true };
        if (input.alleen_ongelezen) q.seen = false;
        const uids = ((await c.search(q, { uid: true })) || []).slice(-Math.min(30, input.aantal || 10));
        if (!uids.length) return 'Geen mails gevonden.';
        const out = [];
        for await (const m of c.fetch(uids, { envelope: true, flags: true }, { uid: true })) {
          const f = m.envelope.from?.[0] || {};
          out.push(`uid ${m.uid} · ${m.flags?.has('\\Seen') ? '' : '● '}${new Date(m.envelope.date).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${f.name || ''} <${f.address || ''}> · ${m.envelope.subject || '(geen onderwerp)'}`);
        }
        return out.reverse().join('\n');
      });
    case 'mail_lees':
      return imap(async (c) => {
        const m = await c.fetchOne(String(input.uid), { source: true }, { uid: true });
        if (!m) return 'Mail niet gevonden.';
        const { simpleParser } = await import('mailparser');
        const p = await simpleParser(m.source);
        const body = (p.text || String(p.html || '').replace(/<[^>]+>/g, ' ')).replace(/\n{3,}/g, '\n\n').slice(0, 12000);
        return `Van: ${p.from?.text}\nAan: ${p.to?.text}\nDatum: ${p.date?.toLocaleString('nl-NL')}\nOnderwerp: ${p.subject}\nMessage-ID: ${p.messageId}\n${p.attachments?.length ? 'Bijlagen: ' + p.attachments.map((a) => a.filename).join(', ') + '\n' : ''}\n${body}`;
      });
    case 'mail_versturen': {
      if (!CFG.mailUser || !CFG.mailPass) return 'Mail is niet ingesteld: zet MAIL_USER en MAIL_PASS in bot/.env.';
      let messageId = null;
      if (input.antwoord_op_uid) messageId = await imap(async (c) => (await c.fetchOne(String(input.antwoord_op_uid), { envelope: true }, { uid: true }))?.envelope?.messageId || null).catch(() => null);
      const id = sid();
      pending.set(id, { ...input, messageId });
      await send(ctx.chatId, `✉️ Concept\nAan: ${input.aan}\nOnderwerp: ${input.onderwerp}\n\n${input.tekst}`, {
        reply_markup: { inline_keyboard: [[{ text: 'Versturen ✅', callback_data: `send:${id}` }, { text: 'Annuleren ❌', callback_data: `cancel:${id}` }]] } });
      return 'Concept getoond met knoppen. De mail is NIET verstuurd tot de gebruiker op Versturen tikt.';
    }
    case 'taak_maken': {
      const t = { id: sid(), soort: input.soort, tijd: input.tijd, datum: input.datum, weekdag: input.weekdag, minuten: input.minuten, opdracht: input.opdracht };
      t.next = nextRun(t);
      if (!(t.next > Date.now())) return 'Dat tijdstip ligt in het verleden.';
      S.tasks.push(t); save();
      return 'Gepland: ' + fmtTask(t);
    }
    case 'taak_lijst': return S.tasks.length ? S.tasks.map(fmtTask).join('\n') : 'Geen geplande taken.';
    case 'taak_verwijderen': {
      const n = S.tasks.length; S.tasks = S.tasks.filter((t) => t.id !== input.id); save();
      return n === S.tasks.length ? 'Taak niet gevonden.' : 'Taak verwijderd.';
    }
    case 'onthoud': { const m = { id: sid(), text: String(input.feit).slice(0, 500) }; S.memory.push(m); save(); return `Onthouden [${m.id}].`; }
    case 'vergeet': { const n = S.memory.length; S.memory = S.memory.filter((m) => m.id !== input.id); save(); return n === S.memory.length ? 'Niet gevonden.' : 'Vergeten.'; }
    case 'afbeelding_maken': {
      const r = await fetch('https://api.x.ai/v1/images/generations', { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CFG.xaiKey}` },
        body: JSON.stringify({ model: CFG.xaiImageModel, prompt: input.beschrijving, n: 1 }) });
      const j = await r.json().catch(() => ({}));
      const url = j?.data?.[0]?.url;
      if (!url) return 'Afbeelding maken mislukt: ' + (j?.error?.message || j?.error || r.status);
      await tg('sendPhoto', { chat_id: ctx.chatId, photo: url });
      return 'Afbeelding is naar de gebruiker gestuurd.';
    }
  }
  return `Onbekende tool ${name}`;
}

// ---------------------------------------------------------------- kosten (dollar per miljoen tokens)
const PRICES = { 'claude-haiku-5-5': [0.10, 0.50], 'claude-sonnet-5-5': [2, 10], 'claude-opus-5-5': [4, 20], 'claude-opus-5': [5, 25], 'claude-fable-5-2': [8, 40] };
function addCost(model, u) {
  const [pi, po] = PRICES[model] || PRICES['claude-opus-5-5'];
  const usd = ((u.input_tokens || 0) * pi + (u.cache_creation_input_tokens || 0) * pi * 1.25 + (u.cache_read_input_tokens || 0) * pi * 0.1 + (u.output_tokens || 0) * po) / 1e6
    + (u.server_tool_use?.web_search_requests || 0) * 0.01;
  const day = new Date().toISOString().slice(0, 10), month = day.slice(0, 7), c = S.cost;
  if (c.day !== day) { c.day = day; c.dayUsd = 0; }
  if (c.month !== month) { c.month = month; c.monthUsd = 0; }
  c.dayUsd += usd; c.monthUsd += usd; c.totalUsd = (c.totalUsd || 0) + usd;
  return usd;
}
function spent() {
  const d = new Date().toISOString().slice(0, 10), c = S.cost;
  return { day: c.day === d ? c.dayUsd : 0, month: c.month === d.slice(0, 7) ? c.monthUsd : 0, total: c.totalUsd || 0 };
}
function budgetLeft() {
  const k = spent();
  if (CFG.limietDag > 0 && k.day >= CFG.limietDag) return `Daglimiet bereikt ($${k.day.toFixed(2)} van $${CFG.limietDag}). Morgen kan ik weer. (LIMIET_DAG in bot/.env)`;
  if (CFG.limietMaand > 0 && k.month >= CFG.limietMaand) return `Maandlimiet bereikt ($${k.month.toFixed(2)} van $${CFG.limietMaand}). Volgende maand kan ik weer. (LIMIET_MAAND in bot/.env)`;
  return null;
}
const usd2eur = (v) => '€' + (v * 0.93).toFixed(2).replace('.', ',');

// ---------------------------------------------------------------- het brein (Claude, tool-loop)
async function ask(userContent, { chatId, deep = S.deep, history = S.history, keep = true } = {}) {
  const over = budgetLeft();
  if (over) return '💸 ' + over;
  const model = deep ? CFG.modelSlim : CFG.model;
  const stamp = { type: 'text', text: `[${new Date().toLocaleString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}]` };
  const content = typeof userContent === 'string' ? [stamp, { type: 'text', text: userContent }] : [stamp, ...userContent];
  const messages = [...history, { role: 'user', content }];
  const effort = deep ? 'high' : 'low';
  const fallbackOk = /opus-5|sonnet-5-5|fable-5/.test(model);
  let finalText = '';
  for (let step = 0; step < (deep ? 12 : 6); step++) {
    const res = await claude.beta.messages.create({
      model,
      max_tokens: deep ? 16000 : 4000,
      cache_control: { type: 'ephemeral' },
      system: systemPrompt(),
      messages,
      tools: [...webTools(model, deep), ...TOOLS],
      thinking: { type: 'adaptive' },
      output_config: { effort },
      ...(fallbackOk ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
    });
    addCost(res.model || model, res.usage || {}); save();
    messages.push({ role: 'assistant', content: res.content });
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    if (text) finalText = text;
    if (res.stop_reason === 'refusal') { finalText ||= 'Daar kan ik je niet mee helpen.'; break; }
    if (res.stop_reason === 'pause_turn') continue;
    if (res.stop_reason !== 'tool_use') break;
    const results = await Promise.all(res.content.filter((b) => b.type === 'tool_use').map(async (b) => {
      try { return { type: 'tool_result', tool_use_id: b.id, content: String(await runTool(b.name, b.input || {}, { chatId })).slice(0, 30000) }; }
      catch (e) { return { type: 'tool_result', tool_use_id: b.id, content: 'Fout: ' + e.message, is_error: true }; }
    }));
    messages.push({ role: 'user', content: results });
  }
  if (keep) {
    // alleen tekst bewaren in het geheugen van het gesprek (foto's worden een notitie)
    const plain = typeof userContent === 'string' ? userContent
      : userContent.map((b) => (b.type === 'text' ? b.text : b.type === 'image' ? '[foto]' : '[document]')).join('\n');
    S.history.push({ role: 'user', content: plain }, { role: 'assistant', content: finalText || '(geen tekst)' });
    S.history = S.history.slice(-16); save();
  }
  return finalText;
}

// ---------------------------------------------------------------- berichten verwerken
const HELP = `👻 Ghost-bot. Stuur gewoon een bericht, foto, screenshot of PDF.

/nieuw · nieuw gesprek beginnen
/denk · Denk-modus aan/uit (grondiger, iets trager)
/deepsearch <vraag> · diep onderzoek op internet met bronnen
/persona · kies een stijl (${Object.keys(PERSONAS).join(', ')})
/taken · geplande taken en herinneringen
/geheugen · wat ik over je onthouden heb
/prijs [peptide] · goedkoopste prijzen uit je prijsvolger
/scan · nu een prijsscan starten
/mail · je laatste mails
/kosten · wat de bot je kost${CFG.xaiKey ? '\n/afbeelding <beschrijving> · afbeelding maken' : ''}

Voorbeelden:
• "Herinner me morgen om 9 uur aan de bestelling"
• "Elke ochtend om 8 uur: nieuws over retatrutide"
• "Heb ik ongelezen mails? Vat ze samen"
• "Beantwoord de laatste mail van Jan: dat ik vrijdag lever"`;

async function handle(msg) {
  const chatId = msg.chat.id;
  const from = String(msg.from?.id || '');
  if (!CFG.owner) return send(chatId, `Jouw Telegram-ID is ${from}.\nZet in bot/.env:  OWNER_ID=${from}\nen start de bot opnieuw. Daarna reageer ik alleen nog op jou.`);
  if (from !== CFG.owner) return;   // vreemden negeren
  S.chatId = chatId;

  let text = (msg.text || msg.caption || '').trim();
  const cmd = text.match(/^\/(\w+)(?:@\w+)?\s*([\s\S]*)$/);
  if (cmd) {
    const [, c, arg] = cmd;
    if (c === 'start' || c === 'help') return send(chatId, HELP);
    if (c === 'nieuw') { S.history = []; save(); return send(chatId, '🧹 Nieuw gesprek. Waar kan ik mee helpen?'); }
    if (c === 'denk') { S.deep = !S.deep; save(); return send(chatId, S.deep ? '🧠 Denk-modus AAN: slim brein, grondiger (duurder en iets trager).' : '⚡ Denk-modus UIT: snel en goedkoop.'); }
    if (c === 'persona') {
      if (arg && PERSONAS[arg.toLowerCase()]) { S.persona = arg.toLowerCase(); save(); return send(chatId, `🎭 Persona: ${S.persona}`); }
      return send(chatId, `🎭 Huidige persona: ${S.persona}\nKies met /persona <naam>: ${Object.keys(PERSONAS).join(', ')}`);
    }
    if (c === 'taken') return send(chatId, S.tasks.length ? '⏰ Geplande taken:\n' + S.tasks.map(fmtTask).join('\n') + '\n\nVerwijderen: "verwijder taak <id>"' : 'Geen geplande taken. Zeg bijv. "elke ochtend om 8 uur het weer".');
    if (c === 'geheugen') return send(chatId, S.memory.length ? '🧠 Onthouden:\n' + S.memory.map((m) => `[${m.id}] ${m.text}`).join('\n') : 'Ik heb nog niets onthouden. Zeg "onthoud dat …".');
    if (c === 'prijs') return send(chatId, await runTool('prijs_goedkoopste', { peptide: arg || undefined }, { chatId }));
    if (c === 'scan') return send(chatId, await runTool('prijs_scan', {}, { chatId }));
    if (c === 'kosten') {
      const k = spent();
      return send(chatId, `💸 Kosten (schatting)\nVandaag: ${usd2eur(k.day)} (limiet ${usd2eur(CFG.limietDag)})\nDeze maand: ${usd2eur(k.month)} (limiet ${usd2eur(CFG.limietMaand)})\nTotaal: ${usd2eur(k.total)}\n\nGewone vragen: ${CFG.model}\n/denk en /deepsearch: ${CFG.modelSlim}`);
    }
    if (c === 'mail') text = 'Laat mijn laatste 10 mails zien en vat kort samen wat belangrijk is.';
    else if (c === 'deepsearch') {
      if (!arg) return send(chatId, 'Gebruik: /deepsearch <je vraag>');
      text = `DeepSearch: onderzoek dit grondig op internet. Zoek meerdere keren met verschillende zoektermen, lees de beste bronnen, vergelijk ze en schrijf een helder rapport met de belangrijkste bevindingen en een lijst met bronnen (URL's).\n\nVraag: ${arg}`;
      await send(chatId, '🔎 DeepSearch gestart, dit kan een minuut duren…');
      const stop = typing(chatId);
      try { return send(chatId, await ask(text, { chatId, deep: true })); } finally { stop(); }
    } else if (c === 'afbeelding') {
      if (!CFG.xaiKey) return send(chatId, 'Afbeeldingen maken staat uit: zet XAI_API_KEY in bot/.env.');
      text = `Maak een afbeelding: ${arg}`;
    } else if (!['mail'].includes(c)) return send(chatId, 'Onbekend commando. /help voor de lijst.');
  }

  // inhoud opbouwen: tekst + eventuele foto / document
  const content = [];
  try {
    if (msg.photo?.length) {
      const { buf } = await downloadFile(msg.photo[msg.photo.length - 1].file_id);
      content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: buf.toString('base64') } });
    } else if (msg.document) {
      const mt = msg.document.mime_type || '';
      if (msg.document.file_size > 20e6) return send(chatId, 'Dat bestand is te groot (max 20 MB).');
      const { buf } = await downloadFile(msg.document.file_id);
      if (mt === 'application/pdf') content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } });
      else if (/^image\/(png|jpeg|gif|webp)$/.test(mt)) content.push({ type: 'image', source: { type: 'base64', media_type: mt, data: buf.toString('base64') } });
      else if (/^text\/|json|csv|xml/.test(mt) || /\.(txt|md|csv|json|log)$/i.test(msg.document.file_name || '')) content.push({ type: 'text', text: `Bestand ${msg.document.file_name}:\n${buf.toString('utf8').slice(0, 100000)}` });
      else return send(chatId, `Dit bestandstype (${mt || 'onbekend'}) kan ik niet lezen. Stuur een PDF, foto of tekstbestand.`);
    } else if (msg.voice || msg.audio || msg.video_note) {
      return send(chatId, '🎙️ Spraakberichten kan ik nog niet verstaan. Tip: gebruik de microfoon op je toetsenbord om in te spreken als tekst.');
    }
  } catch (e) { return send(chatId, 'Kon het bestand niet ophalen: ' + e.message); }
  if (text) content.push({ type: 'text', text });
  if (!content.length) return;
  if (!text) content.push({ type: 'text', text: 'Wat zie je hier? Leg het kort uit.' });

  const stop = typing(chatId);
  try { await send(chatId, await ask(content, { chatId })); }
  catch (e) { await send(chatId, '⚠️ Er ging iets mis: ' + (e?.message || e)); console.error(e); }
  finally { stop(); }
}

async function handleCallback(cb) {
  if (String(cb.from?.id) !== CFG.owner) return;
  const [act, id] = String(cb.data || '').split(':');
  const m = pending.get(id);
  const chatId = cb.message.chat.id;
  await tg('editMessageReplyMarkup', { chat_id: chatId, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {});
  if (!m) { await tg('answerCallbackQuery', { callback_query_id: cb.id, text: 'Dit concept is verlopen.' }); return; }
  pending.delete(id);
  if (act === 'cancel') { await tg('answerCallbackQuery', { callback_query_id: cb.id, text: 'Geannuleerd' }); return send(chatId, '❌ Mail niet verstuurd.'); }
  try { await sendMail(m); await tg('answerCallbackQuery', { callback_query_id: cb.id, text: 'Verstuurd' }); await send(chatId, `✅ Mail verstuurd naar ${m.aan}.`); }
  catch (e) { await tg('answerCallbackQuery', { callback_query_id: cb.id, text: 'Mislukt' }); await send(chatId, '⚠️ Versturen mislukt: ' + e.message); }
}

// ---------------------------------------------------------------- taken uitvoeren
let taskBusy = false;
setInterval(async () => {
  if (taskBusy || !S.chatId) return;
  const due = S.tasks.filter((t) => t.next <= Date.now());
  if (!due.length) return;
  taskBusy = true;
  try {
    for (const t of due) {
      if (t.soort === 'eenmalig') S.tasks = S.tasks.filter((x) => x.id !== t.id); else t.next = nextRun(t);
      save();
      try {
        const out = await ask(`Geplande taak (${t.soort}): ${t.opdracht}\nVoer dit nu uit en geef direct het resultaat. Is het alleen een herinnering, herinner de gebruiker er dan kort en vriendelijk aan.`,
          { chatId: S.chatId, history: [], keep: false });
        await send(S.chatId, `⏰ ${out}`);
      } catch (e) { await send(S.chatId, `⚠️ Taak "${t.opdracht}" mislukt: ${e.message}`); }
    }
  } finally { taskBusy = false; }
}, 30e3);

// ---------------------------------------------------------------- Telegram uitlezen (long polling)
let offset = 0;
console.log(`👻 Ghost-bot gestart (gewoon: ${CFG.model}, slim: ${CFG.modelSlim}, limiet $${CFG.limietDag}/dag, $${CFG.limietMaand}/maand).`);
await tg('setMyCommands', { commands: [
  ['nieuw', 'Nieuw gesprek'], ['denk', 'Denk-modus aan/uit'], ['deepsearch', 'Diep onderzoek met bronnen'], ['persona', 'Stijl kiezen'],
  ['taken', 'Geplande taken'], ['geheugen', 'Wat ik onthouden heb'], ['prijs', 'Goedkoopste prijzen'], ['scan', 'Prijsscan starten'],
  ['mail', 'Laatste mails'], ['kosten', 'Wat kost de bot'], ...(CFG.xaiKey ? [['afbeelding', 'Afbeelding maken']] : []), ['help', 'Uitleg'],
].map(([command, description]) => ({ command, description })) }).catch((e) => console.error(e.message));

for (;;) {
  try {
    const ups = await tg('getUpdates', { offset, timeout: 50, allowed_updates: ['message', 'callback_query'] });
    for (const u of ups) {
      offset = u.update_id + 1;
      if (u.message) handle(u.message).catch((e) => console.error(e));
      else if (u.callback_query) handleCallback(u.callback_query).catch((e) => console.error(e));
    }
  } catch (e) {
    console.error('Telegram:', e.message);
    if (/Unauthorized|Not Found/i.test(e.message)) { console.error('TELEGRAM_TOKEN klopt niet.'); process.exit(1); }
    await new Promise((r) => setTimeout(r, 5000));
  }
}
