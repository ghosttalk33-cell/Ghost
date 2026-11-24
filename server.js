// Ghost Crawler — volledige website-audit met webinterface.
// Geen dependencies nodig: vereist Node.js 18 of nieuwer.
// Start: node server.js  → open http://localhost:3000

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const tls = require('tls');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || undefined; // op een server: 127.0.0.1 (achter Caddy)
const auth = require('./auth')({ dir: __dirname });
if (require.main === module && auth.cli(process.argv.slice(2))) process.exit();
const USER_AGENT = 'Mozilla/5.0 (compatible; GhostCrawler/3.0)';
const SCANS_DIR = path.join(__dirname, 'scans');
const FILE_EXT = /\.(jpe?g|png|gif|svg|webp|avif|ico|bmp|pdf|docx?|xlsx?|pptx?|csv|txt|zip|rar|7z|gz|tar|mp3|wav|mp4|avi|mov|wmv|webm|css|js|mjs|woff2?|ttf|eot|otf|xml|json|rss|apk|exe|dmg)$/i;
// Pagina's die bots niets opleveren (winkelwagen, afrekenen, uitloggen, filters…). Inlog- en adminpagina's worden wél gescand.
const SMART_SKIP = /\/(cart|winkelwagen|winkelmand|checkout|afrekenen|kassa|logout|uitloggen|wishlist|verlanglijst|compare|vergelijk)(\/|$)|[?&](add-to-cart|add_to_wishlist|remove_item|orderby|filter_|min_price|max_price|replytocom|share|action=|redirect_to|s=)|\/feed\/?$|\/comment-page-|\/wp-json\//i;

// ---------- Hulpfuncties ----------

const sleep = ms => new Promise(r => setTimeout(r, ms));
const bareHost = h => h.replace(/^www\./i, '').toLowerCase();

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(Number(n)); } catch { return ''; } })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return ''; } });
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function getAttr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? decodeEntities(m[2] ?? m[3] ?? m[4] ?? '') : null;
}

function errText(err) {
  if (err.name === 'TimeoutError') return 'Time-out';
  const code = err.cause?.code || '';
  const map = {
    ENOTFOUND: 'Domein niet gevonden', ECONNREFUSED: 'Verbinding geweigerd', ECONNRESET: 'Verbinding verbroken',
    CERT_HAS_EXPIRED: 'SSL-certificaat verlopen', UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'SSL-certificaat ongeldig',
    ERR_TLS_CERT_ALTNAME_INVALID: 'SSL-certificaat hoort niet bij dit domein', DEPTH_ZERO_SELF_SIGNED_CERT: 'Zelfondertekend SSL-certificaat',
    UND_ERR_CONNECT_TIMEOUT: 'Time-out bij verbinden',
  };
  return map[code] || code || err.message;
}

async function get(url, { method = 'GET', timeout = 15000, redirect = 'follow' } = {}) {
  return fetch(url, {
    method, redirect,
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'nl,en;q=0.8' },
    signal: AbortSignal.timeout(timeout),
  });
}

async function readLimited(res, max = 200000) {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks = []; let size = 0;
  while (size < max) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); size += value.length;
  }
  reader.cancel().catch(() => {});
  return Buffer.concat(chunks).toString('utf8');
}

const STOP = new Set(('de het een en van in is op te dat die voor met zijn er niet aan om ook als bij of door over naar uit tot je jij jouw wij we ons onze u uw ze zij hun hij haar wat wie waar hoe dan maar nog wel geen meer kan kunnen wordt worden werd heeft hebben had was waren zal zou dit deze ik me mijn mij al alle veel zo nu nieuw heel per via na tussen onder tegen zonder hier daar ja nee welke elk elke andere omdat want dus toch zelfs alleen sinds' +
  ' the a an and or of to in is on for with that this it as at by from be are was were will can your you we our us they their he she his her its not no all any more most new about into than then so if what which who how when where also has have had do does just only other some such these those up out over my me i lees home menu contact privacy cookies').split(' '));

function syllables(word) {
  const m = word.toLowerCase().match(/[aeiouyàáâäèéêëìíîïòóôöùúûü]+/g);
  return Math.max(1, m ? m.length : 1);
}

// ---------- Technologie-herkenning ----------

const TECH = [
  ['WordPress', /wp-content|wp-includes/i], ['WooCommerce', /woocommerce/i], ['Elementor', /elementor/i], ['Divi', /et_pb_|divi/i],
  ['Yoast SEO', /yoast/i], ['Rank Math', /rank-math|rankmath/i], ['Shopify', /cdn\.shopify\.com|Shopify\.theme/i], ['Wix', /static\.wixstatic\.com|wix\.com/i],
  ['Squarespace', /squarespace/i], ['Webflow', /webflow/i], ['Joomla', /\/media\/jui\/|joomla/i], ['Drupal', /drupal/i], ['Magento', /mage\/|magento/i],
  ['PrestaShop', /prestashop/i], ['Lightspeed', /lightspeed|seoshop/i], ['Next.js', /__NEXT_DATA__|\/_next\//], ['Nuxt', /__NUXT__|\/_nuxt\//],
  ['React', /react(-dom)?(\.production)?(\.min)?\.js|data-reactroot/i], ['Vue', /vue(\.min)?\.js|data-v-[0-9a-f]{6}/i], ['Angular', /ng-version=/i],
  ['jQuery', /jquery(\.min)?\.js/i], ['Bootstrap', /bootstrap(\.min)?\.(css|js)/i], ['Tailwind CSS', /tailwind/i],
  ['Google Tag Manager', /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{4,}/], ['Google Analytics', /google-analytics\.com|gtag\/js\?id=G-|gtag\/js\?id=UA-|['"]G-[A-Z0-9]{6,}['"]/],
  ['Google Ads', /googleadservices|gtag\/js\?id=AW-|AW-\d{6,}/], ['Facebook Pixel', /connect\.facebook\.net\/[^"']*fbevents|fbq\(/],
  ['TikTok Pixel', /analytics\.tiktok\.com/i], ['LinkedIn Insight', /snap\.licdn\.com/i], ['Hotjar', /hotjar/i], ['Microsoft Clarity', /clarity\.ms/i],
  ['Pinterest Tag', /pintrk|s\.pinimg\.com\/ct/i], ['Matomo', /matomo|piwik/i], ['Plausible', /plausible\.io/i],
  ['Google reCAPTCHA', /recaptcha/i], ['Cloudflare', /cdn-cgi|cloudflare/i], ['Google Fonts', /fonts\.googleapis\.com/i], ['Font Awesome', /font-?awesome/i],
  ['Mollie', /mollie/i], ['Stripe', /js\.stripe\.com/i], ['PayPal', /paypal\.com\/sdk/i], ['Trustpilot', /trustpilot/i], ['Kiyoh', /kiyoh/i],
  ['Mailchimp', /mailchimp|list-manage\.com/i], ['HubSpot', /hs-scripts|hubspot/i], ['Intercom', /intercom/i], ['Tawk.to', /tawk\.to/i], ['WhatsApp-knop', /wa\.me\/|api\.whatsapp\.com/i],
  ['Cookiebot', /cookiebot/i], ['CookieYes', /cookieyes|cookie-law-info/i], ['Complianz', /complianz|cmplz/i], ['OneTrust', /onetrust|cookielaw\.org/i],
  ['Usercentrics', /usercentrics/i], ['Borlabs Cookie', /borlabs/i], ['Cookie Notice', /cookie-notice/i], ['Iubenda', /iubenda/i], ['Termly', /termly/i],
];
const TRACKERS = ['Google Analytics', 'Google Ads', 'Facebook Pixel', 'TikTok Pixel', 'LinkedIn Insight', 'Hotjar', 'Microsoft Clarity', 'Pinterest Tag'];
const CONSENT = ['Cookiebot', 'CookieYes', 'Complianz', 'OneTrust', 'Usercentrics', 'Borlabs Cookie', 'Cookie Notice', 'Iubenda', 'Termly'];

function detectTech(html) {
  const found = TECH.filter(([, re]) => re.test(html)).map(([n]) => n);
  const gen = html.match(/<meta[^>]+name=["']generator["'][^>]*content=["']([^"']+)/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']generator/i);
  return { found, generator: gen ? decodeEntities(gen[1]) : '' };
}

// ---------- Pagina-analyse ----------

const SOCIAL = /^(https?:\/\/)?(www\.|nl\.|m\.)?(facebook\.com|instagram\.com|linkedin\.com|twitter\.com|x\.com|youtube\.com|tiktok\.com|pinterest\.[a-z]+|threads\.net)\/(?!sharer|share|intent|dialog|plugins|watch\?|embed)[^?#]+/i;
const GENERIC_LINK = new Set(['klik hier', 'hier', 'lees meer', 'meer', 'meer info', 'meer informatie', 'bekijk', 'bekijk meer', 'click here', 'here', 'read more', 'more', 'learn more', 'link']);

function parsePage(html, pageUrl) {
  const page = new URL(pageUrl);
  const noComments = html.replace(/<!--[\s\S]*?-->/g, '');
  const headPart = (noComments.match(/<head\b[\s\S]*?<\/head>/i) || [''])[0];
  const jsonLd = [...noComments.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  const noScript = noComments.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<noscript[\s\S]*?<\/noscript>/gi, '').replace(/<svg[\s\S]*?<\/svg>/gi, '');

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]) : '';

  let description = '', robotsMeta = '', viewport = false, ogTitle = false, ogImage = false, twitterCard = false;
  for (const tag of headPart.match(/<meta\b[^>]*>/gi) || html.match(/<meta\b[^>]*>/gi) || []) {
    const n = (getAttr(tag, 'name') || getAttr(tag, 'property') || '').toLowerCase();
    const c = getAttr(tag, 'content') || '';
    if (n === 'description') description = c.trim();
    else if (n === 'robots' || n === 'googlebot') robotsMeta += c.toLowerCase() + ' ';
    else if (n === 'viewport') viewport = true;
    else if (n === 'og:title') ogTitle = true;
    else if (n === 'og:image') ogImage = true;
    else if (n === 'twitter:card') twitterCard = true;
  }

  let canonical = '', hreflang = 0, stylesheets = 0;
  for (const tag of noComments.match(/<link\b[^>]*>/gi) || []) {
    const rel = (getAttr(tag, 'rel') || '').toLowerCase().split(/\s+/);
    if (rel.includes('canonical')) { try { canonical = new URL(getAttr(tag, 'href') || '', pageUrl).href; } catch {} }
    if (rel.includes('alternate') && getAttr(tag, 'hreflang')) hreflang++;
    if (rel.includes('stylesheet')) stylesheets++;
  }

  const scriptTags = noComments.match(/<script\b[^>]*>/gi) || [];
  const scripts = scriptTags.filter(t => getAttr(t, 'src')).length;
  const renderBlocking = (headPart.match(/<script\b[^>]*>/gi) || [])
    .filter(t => getAttr(t, 'src') && !/\s(async|defer)\b/i.test(t) && !/type\s*=\s*["']?module/i.test(t)).length;

  const htmlTag = html.match(/<html\b[^>]*>/i);
  const lang = htmlTag ? (getAttr(htmlTag[0], 'lang') || '') : '';

  // Koppen
  const headings = [...noScript.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map(m => ({ l: +m[1], t: stripTags(m[2]).slice(0, 120) }));
  const h1 = headings.filter(h => h.l === 1).map(h => h.t).filter(Boolean);
  const h2Count = headings.filter(h => h.l === 2).length;
  let headingSkip = '';
  for (let i = 1; i < headings.length; i++) {
    if (headings[i].l > headings[i - 1].l + 1) { headingSkip = `H${headings[i - 1].l} → H${headings[i].l}`; break; }
  }

  let base = pageUrl;
  const baseTag = html.match(/<base\b[^>]*>/i);
  if (baseTag) { const href = getAttr(baseTag[0], 'href'); if (href) try { base = new URL(href, pageUrl).href; } catch {} }

  // Links
  const internal = new Set(), external = new Set(), socials = new Set(), phones = new Set();
  let nofollowLinks = 0, emptyLinks = 0, httpLinks = 0;
  const genericLinks = new Set();
  for (const m of noScript.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const tag = '<a ' + m[1] + '>';
    const href = (getAttr(tag, 'href') || '').trim();
    const inner = m[2];
    const text = stripTags(inner);
    const label = text || getAttr(tag, 'aria-label') || getAttr(tag, 'title') || (inner.match(/<img\b[^>]*>/i) ? getAttr(inner.match(/<img\b[^>]*>/i)[0], 'alt') : '') || '';
    if (href && !label.trim()) emptyLinks++;
    if (GENERIC_LINK.has(text.toLowerCase().replace(/[»›→…\.]+$/, '').trim())) genericLinks.add(text);
    if (/^tel:/i.test(href)) { phones.add(decodeURIComponent(href.slice(4)).replace(/[^\d+]/g, '')); continue; }
    if (!href || /^(javascript:|mailto:|sms:|#|data:)/i.test(href)) continue;
    if ((getAttr(tag, 'rel') || '').toLowerCase().includes('nofollow')) nofollowLinks++;
    try {
      const u = new URL(href, base);
      if (!/^https?:$/.test(u.protocol)) continue;
      u.hash = '';
      if (SOCIAL.test(u.href)) socials.add(u.origin + u.pathname.replace(/\/$/, ''));
      if (bareHost(u.host) === bareHost(page.host)) {
        internal.add(u.href);
        if (page.protocol === 'https:' && u.protocol === 'http:') httpLinks++;
      } else external.add(u.href);
    } catch {}
  }

  // Afbeeldingen
  let images = 0, imagesNoAlt = 0;
  const imgSrcs = new Set();
  for (const tag of noScript.match(/<img\b[^>]*>/gi) || []) {
    images++;
    if (getAttr(tag, 'alt') === null) imagesNoAlt++;
    const src = getAttr(tag, 'src') || getAttr(tag, 'data-src') || getAttr(tag, 'data-lazy-src');
    if (src && !src.startsWith('data:') && imgSrcs.size < 60) { try { imgSrcs.add(new URL(src, base).href); } catch {} }
  }

  // Formulieren en knoppen (toegankelijkheid)
  const labelFor = new Set([...noScript.matchAll(/<label\b[^>]*\sfor\s*=\s*["']?([^"'\s>]+)/gi)].map(m => m[1]));
  let formNoLabel = 0;
  for (const m of noScript.matchAll(/<(input|select|textarea)\b[^>]*>/gi)) {
    const tag = m[0];
    const type = (getAttr(tag, 'type') || '').toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) continue;
    const id = getAttr(tag, 'id');
    if (getAttr(tag, 'aria-label') || getAttr(tag, 'aria-labelledby') || getAttr(tag, 'title') || (id && labelFor.has(id))) continue;
    // binnen een <label> genest?
    const before = noScript.slice(Math.max(0, m.index - 400), m.index);
    if (before.lastIndexOf('<label') > before.lastIndexOf('</label>')) continue;
    formNoLabel++;
  }
  let buttonNoText = 0;
  for (const m of noScript.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
    const tag = '<b ' + m[1] + '>';
    if (!stripTags(m[2]) && !getAttr(tag, 'aria-label') && !getAttr(tag, 'title') && !/<img[^>]+alt=["'][^"']+/i.test(m[2])) buttonNoText++;
  }

  let mixedContent = 0;
  if (page.protocol === 'https:') {
    mixedContent = (html.match(/<(img|script|iframe|source|video|audio|embed)\b[^>]*\ssrc\s*=\s*["']?http:\/\//gi) || []).length
      + (html.match(/<link\b[^>]*\shref\s*=\s*["']?http:\/\/[^>]*rel\s*=\s*["']?stylesheet/gi) || []).length;
  }

  // Gestructureerde data
  const schemaTypes = new Set();
  for (const block of jsonLd) {
    try {
      const walk = o => {
        if (!o || typeof o !== 'object') return;
        if (Array.isArray(o)) return o.forEach(walk);
        const t = o['@type'];
        if (t) (Array.isArray(t) ? t : [t]).forEach(x => schemaTypes.add(String(x)));
        if (o['@graph']) walk(o['@graph']);
      };
      walk(JSON.parse(block.trim()));
    } catch {}
  }
  if (/itemscope/i.test(html)) for (const m of html.matchAll(/itemtype=["']https?:\/\/schema\.org\/(\w+)/gi)) schemaTypes.add(m[1]);

  const emails = [...new Set(
    (decodeEntities(noScript).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])
      .map(e => e.toLowerCase())
      .filter(e => !/\.(png|jpe?g|gif|svg|webp)$/i.test(e) && !/(sentry|example|domain|wixpress)\./.test(e))
  )];

  // Tekst, woorden, leesbaarheid
  const mainPart = (noScript.match(/<main\b[\s\S]*?<\/main>/i) || noScript.match(/<article\b[\s\S]*?<\/article>/i) || [noScript.replace(/<(header|footer|nav)\b[\s\S]*?<\/\1>/gi, ' ')])[0];
  const text = stripTags(noScript);
  const mainText = stripTags(mainPart);
  const wordCount = text ? text.split(' ').length : 0;
  const contentHash = wordCount >= 50 ? crypto.createHash('md5').update(mainText.toLowerCase()).digest('hex').slice(0, 12) : null;
  const freq = new Map();
  for (const w of mainText.toLowerCase().match(/[a-zà-ÿ][a-zà-ÿ'-]{2,}/g) || []) {
    if (STOP.has(w) || w.length < 4) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  const topWords = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  let readability = null;
  const pText = (noScript.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || []).map(stripTags).filter(t => t.split(' ').length > 4).join(' ');
  const pWords = pText.match(/[A-Za-zÀ-ÿ]+/g) || [];
  if (pWords.length >= 80) {
    const sentences = Math.max(1, (pText.match(/[.!?]+(\s|$)/g) || []).length);
    const syl = pWords.reduce((s, w) => s + syllables(w), 0);
    // Flesch-Douma (Nederlandse variant van Flesch Reading Ease)
    readability = Math.round(Math.max(0, Math.min(100, 206.84 - 77 * (syl / pWords.length) - 0.93 * (pWords.length / sentences))));
  }

  return {
    title, description, robotsMeta: robotsMeta.trim(), viewport, ogTitle, ogImage, twitterCard, canonical, hreflang, lang,
    h1, h2Count, headingSkip, headings: headings.slice(0, 40), images, imagesNoAlt, mixedContent,
    structuredData: schemaTypes.size > 0, schemaTypes: [...schemaTypes], emails, phones: [...phones].filter(p => p.length >= 8), socials: [...socials],
    wordCount, contentHash, topWords, readability, scripts, stylesheets, renderBlocking,
    emptyLinks, genericLinks: [...genericLinks].slice(0, 5), formNoLabel, buttonNoText, httpLinks,
    textRatio: html.length ? Math.round(text.length / html.length * 100) : 0,
    internal: [...internal], external: [...external], imgSrcs: [...imgSrcs], nofollowLinks, text,
  };
}

function keywordMatches(text, keywords) {
  if (!keywords.length) return null;
  const lower = text.toLowerCase();
  const out = {};
  for (const k of keywords) {
    let count = 0, idx = lower.indexOf(k), first = idx;
    while (idx !== -1) { count++; idx = lower.indexOf(k, idx + k.length); }
    if (count) {
      const s = Math.max(0, first - 70), e = Math.min(text.length, first + k.length + 70);
      out[k] = { count, snippet: (s > 0 ? '…' : '') + text.slice(s, e) + (e < text.length ? '…' : '') };
    }
  }
  return out;
}

// ---------- robots.txt en sitemap ----------

async function loadRobots(origin) {
  const info = { found: false, rules: [], sitemaps: [], blocksAll: false };
  try {
    const res = await get(origin + '/robots.txt', { timeout: 8000 });
    if (!res.ok || !(res.headers.get('content-type') || '').includes('text/plain')) return info;
    info.found = true;
    let applies = false, lastWasAgent = false, star = false;
    for (const raw of (await res.text()).split(/\r?\n/)) {
      const line = raw.replace(/#.*/, '').trim();
      const idx = line.indexOf(':');
      if (idx < 0) continue;
      const key = line.slice(0, idx).trim().toLowerCase();
      const val = line.slice(idx + 1).trim();
      if (key === 'sitemap') { info.sitemaps.push(val); continue; }
      if (key === 'user-agent') {
        const match = val === '*' || /ghostcrawler/i.test(val);
        star = lastWasAgent ? star || val === '*' : val === '*';
        applies = lastWasAgent ? applies || match : match;
        lastWasAgent = true;
        continue;
      }
      lastWasAgent = false;
      if (applies && (key === 'disallow' || key === 'allow') && val) {
        info.rules.push({ allow: key === 'allow', path: val });
        if (star && key === 'disallow' && val === '/') info.blocksAll = true;
      }
    }
  } catch {}
  return info;
}

function robotsAllowed(rules, url) {
  const p = new URL(url);
  const target = p.pathname + p.search;
  let best = null;
  for (const r of rules) {
    const re = new RegExp('^' + r.path.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*'));
    if (re.test(target) && (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow))) best = r;
  }
  return !best || best.allow;
}

async function loadSitemap(urls, limit, isCancelled) {
  const found = new Set();
  const todo = [...urls];
  let fetched = 0;
  while (todo.length && fetched < 20 && found.size < limit && !isCancelled()) {
    const sm = todo.shift();
    fetched++;
    try {
      const res = await get(sm, { timeout: 15000 });
      if (!res.ok) continue;
      const xml = await res.text();
      const locs = [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi)].map(m => decodeEntities(m[1]));
      if (/<sitemapindex/i.test(xml)) todo.push(...locs);
      else for (const l of locs) { if (found.size >= limit) break; found.add(l); }
    } catch {}
  }
  return [...found];
}

// ---------- Website-checks ----------

function sslInfo(host) {
  return new Promise(resolve => {
    const sock = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false, timeout: 8000 }, () => {
      const c = sock.getPeerCertificate();
      const out = c && c.valid_to ? {
        validTo: new Date(c.valid_to).toISOString(),
        daysLeft: Math.floor((new Date(c.valid_to) - Date.now()) / 864e5),
        issuer: c.issuer?.O || c.issuer?.CN || '',
        authorized: sock.authorized, error: sock.authorizationError ? String(sock.authorizationError) : '',
        protocol: sock.getProtocol(),
      } : null;
      sock.end();
      resolve(out);
    });
    sock.on('error', () => resolve(null));
    sock.on('timeout', () => { sock.destroy(); resolve(null); });
  });
}

// Veelvoorkomende lekken. Elke check controleert de inhoud, zodat een nette 404-pagina geen vals alarm geeft.
const EXPOSURES = [
  { path: '/.env', label: '.env-bestand met wachtwoorden/sleutels', sev: 'error', test: (b, r) => r.status === 200 && /^[A-Z][A-Z0-9_]+\s*=/m.test(b) && !/<html/i.test(b) },
  { path: '/.git/HEAD', label: 'Git-map openbaar (broncode te downloaden)', sev: 'error', test: (b, r) => r.status === 200 && /^ref:\s*refs\//.test(b.trim()) },
  { path: '/.git/config', label: 'Git-configuratie openbaar', sev: 'error', test: (b, r) => r.status === 200 && /\[core\]/.test(b) },
  { path: '/wp-config.php.bak', label: 'Back-up van wp-config (databasewachtwoord)', sev: 'error', test: (b, r) => r.status === 200 && /DB_PASSWORD/.test(b) },
  { path: '/wp-config.php~', label: 'Back-up van wp-config (databasewachtwoord)', sev: 'error', test: (b, r) => r.status === 200 && /DB_PASSWORD/.test(b) },
  { path: '/backup.zip', label: 'Back-upbestand openbaar', sev: 'error', test: (b, r) => r.status === 200 && b.startsWith('PK') },
  { path: '/backup.sql', label: 'Databaseback-up openbaar', sev: 'error', test: (b, r) => r.status === 200 && /(CREATE TABLE|INSERT INTO)/i.test(b) },
  { path: '/phpinfo.php', label: 'phpinfo() openbaar (serverdetails)', sev: 'error', test: (b, r) => r.status === 200 && /phpinfo\(\)|PHP Version/i.test(b) },
  { path: '/.DS_Store', label: '.DS_Store (lijst met bestanden)', sev: 'warn', test: (b, r) => r.status === 200 && b.includes('Bud1') },
  { path: '/server-status', label: 'Apache server-status openbaar', sev: 'warn', test: (b, r) => r.status === 200 && /Apache Server Status/i.test(b) },
  { path: '/wp-json/wp/v2/users', label: 'WordPress-gebruikersnamen op te vragen', sev: 'warn', test: (b, r) => r.status === 200 && /"slug"\s*:/.test(b) },
  { path: '/?author=1', label: 'WordPress-gebruikersnaam via ?author=1', sev: 'info', test: (b, r) => /\/author\/[^/]+\/?$/.test(r.url) },
  { path: '/xmlrpc.php', label: 'XML-RPC staat aan (doelwit voor inlogaanvallen)', sev: 'info', test: (b, r) => /XML-RPC server accepts POST requests only/i.test(b) },
  { path: '/readme.html', label: 'WordPress readme.html (verraadt versie)', sev: 'info', test: (b, r) => r.status === 200 && /WordPress/i.test(b) && /<html/i.test(b) },
  { path: '/wp-content/uploads/', label: 'Mapinhoud zichtbaar (directory listing)', sev: 'warn', test: (b, r) => r.status === 200 && /<title>Index of/i.test(b) },
  { path: '/wp-content/debug.log', label: 'WordPress debug.log openbaar', sev: 'error', test: (b, r) => r.status === 200 && /PHP (Notice|Warning|Fatal|Deprecated)/i.test(b) },
  // Extra gelekte bestanden (alleen meekijken, geen aanvallen)
  { path: '/.env.local', label: '.env.local met instellingen/sleutels', sev: 'error', test: (b, r) => r.status === 200 && /^[A-Z][A-Z0-9_]+\s*=/m.test(b) && !/<html/i.test(b) },
  { path: '/.env.production', label: '.env.production met instellingen/sleutels', sev: 'error', test: (b, r) => r.status === 200 && /^[A-Z][A-Z0-9_]+\s*=/m.test(b) && !/<html/i.test(b) },
  { path: '/.env.backup', label: 'Back-up van .env-bestand', sev: 'error', test: (b, r) => r.status === 200 && /^[A-Z][A-Z0-9_]+\s*=/m.test(b) && !/<html/i.test(b) },
  { path: '/.htpasswd', label: '.htpasswd met gebruikersnamen/wachtwoordhashes', sev: 'error', test: (b, r) => r.status === 200 && /^[^:\s]+:\$?[\w./$]+$/m.test(b) && !/<html/i.test(b) },
  { path: '/.htaccess', label: '.htaccess leesbaar (serverregels zichtbaar)', sev: 'warn', test: (b, r) => r.status === 200 && /(RewriteRule|RewriteEngine|AuthType|<Files|Order allow)/i.test(b) && !/<html/i.test(b) },
  { path: '/.aws/credentials', label: 'AWS-sleutels openbaar', sev: 'error', test: (b, r) => r.status === 200 && /aws_access_key_id/i.test(b) },
  { path: '/config.php.bak', label: 'Back-up van config.php (broncode/wachtwoorden)', sev: 'error', test: (b, r) => r.status === 200 && /<\?php|define\s*\(|password/i.test(b) && !/<html/i.test(b) },
  { path: '/configuration.php.bak', label: 'Back-up van Joomla-configuratie', sev: 'error', test: (b, r) => r.status === 200 && /\$password|public \$/i.test(b) && !/<html/i.test(b) },
  { path: '/database.sql', label: 'Databaseback-up (database.sql) openbaar', sev: 'error', test: (b, r) => r.status === 200 && /(CREATE TABLE|INSERT INTO)/i.test(b) },
  { path: '/dump.sql', label: 'Databaseback-up (dump.sql) openbaar', sev: 'error', test: (b, r) => r.status === 200 && /(CREATE TABLE|INSERT INTO)/i.test(b) },
  { path: '/db.sql', label: 'Databaseback-up (db.sql) openbaar', sev: 'error', test: (b, r) => r.status === 200 && /(CREATE TABLE|INSERT INTO)/i.test(b) },
  { path: '/site.zip', label: 'Back-upbestand (site.zip) openbaar', sev: 'error', test: (b, r) => r.status === 200 && b.startsWith('PK') },
  { path: '/website.zip', label: 'Back-upbestand (website.zip) openbaar', sev: 'error', test: (b, r) => r.status === 200 && b.startsWith('PK') },
  { path: '/backup.tar.gz', label: 'Back-upbestand (backup.tar.gz) openbaar', sev: 'error', test: (b, r) => r.status === 200 && (r.headers.get('content-type') || '').includes('gzip') },
  { path: '/error_log', label: 'Foutenlog (error_log) openbaar', sev: 'warn', test: (b, r) => r.status === 200 && /PHP (Notice|Warning|Fatal|Parse)|\[error\]/i.test(b) && !/<html/i.test(b) },
  { path: '/storage/logs/laravel.log', label: 'Laravel-logbestand openbaar', sev: 'error', test: (b, r) => r.status === 200 && /(production\.ERROR|testing\.ERROR|local\.ERROR|stacktrace)/i.test(b) },
  { path: '/info.php', label: 'info.php openbaar (serverdetails)', sev: 'error', test: (b, r) => r.status === 200 && /phpinfo\(\)|PHP Version/i.test(b) },
  { path: '/test.php', label: 'test.php openbaar (mogelijk serverdetails)', sev: 'warn', test: (b, r) => r.status === 200 && /phpinfo\(\)|PHP Version/i.test(b) },
  { path: '/adminer.php', label: 'Adminer (database-beheertool) openbaar', sev: 'error', test: (b, r) => r.status === 200 && /Adminer|Login - Adminer/i.test(b) },
  { path: '/phpmyadmin/', label: 'phpMyAdmin bereikbaar', sev: 'warn', test: (b, r) => r.status === 200 && /phpMyAdmin/i.test(b) },
  { path: '/.svn/entries', label: 'SVN-map openbaar (broncode)', sev: 'error', test: (b, r) => r.status === 200 && /^(dir|\d+)\s*$/m.test(b) && !/<html/i.test(b) },
  { path: '/.hg/requires', label: 'Mercurial-map openbaar (broncode)', sev: 'error', test: (b, r) => r.status === 200 && /revlogv|store/i.test(b) && !/<html/i.test(b) },
  { path: '/.idea/workspace.xml', label: 'Editor-map (.idea) openbaar', sev: 'warn', test: (b, r) => r.status === 200 && /<project/i.test(b) },
  { path: '/composer.lock', label: 'composer.lock (exacte pakketversies zichtbaar)', sev: 'info', test: (b, r) => r.status === 200 && /"packages"/.test(b) },
  { path: '/package.json', label: 'package.json (pakketversies zichtbaar)', sev: 'info', test: (b, r) => r.status === 200 && /"dependencies"|"devDependencies"/.test(b) && !/<html/i.test(b) },
  { path: '/sftp-config.json', label: 'sftp-config.json (FTP-wachtwoord)', sev: 'error', test: (b, r) => r.status === 200 && /"host"|"password"/i.test(b) },
  { path: '/.well-known/.env', label: 'Verstopt .env-bestand', sev: 'error', test: (b, r) => r.status === 200 && /^[A-Z][A-Z0-9_]+\s*=/m.test(b) && !/<html/i.test(b) },
];

// Verouderde bibliotheken met bekende lekken (versie uit de HTML halen, alleen lezen)
const OLD_LIBS = [
  { name: 'jQuery', re: /jquery[-.]?(\d+\.\d+(?:\.\d+)?)(?:\.min)?\.js/i, safe: [3, 5], note: 'Versies onder 3.5 hebben bekende XSS-lekken (CVE-2020-11022/11023).' },
  { name: 'Bootstrap', re: /bootstrap[-.]?(\d+\.\d+(?:\.\d+)?)(?:\.min)?\.(?:js|css)/i, safe: [4, 3, 3], note: 'Versies onder 4.3.1 hebben XSS-lekken.' },
  { name: 'AngularJS', re: /angular[-.]?(\d+\.\d+(?:\.\d+)?)(?:\.min)?\.js/i, safe: [1, 8], note: 'AngularJS (1.x) wordt niet meer onderhouden en krijgt geen beveiligingsupdates meer.' },
  { name: 'Lodash', re: /lodash[-.]?(\d+\.\d+(?:\.\d+)?)(?:\.min)?\.js/i, safe: [4, 17, 21], note: 'Versies onder 4.17.21 hebben prototype-pollution-lekken.' },
  { name: 'Moment.js', re: /moment[-.]?(\d+\.\d+(?:\.\d+)?)(?:\.min)?\.js/i, safe: [2, 29, 4], note: 'Versies onder 2.29.4 hebben een ReDoS-lek (CVE-2022-31129).' },
];
const cmpVer = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const x = a[i] ?? 0, y = b[i] ?? 0; if (x !== y) return x - y; } return 0; };
function detectOldLibs(html) {
  const out = [];
  for (const lib of OLD_LIBS) {
    const m = html.match(lib.re);
    if (!m) continue;
    if (cmpVer(m[1].split('.').map(Number), lib.safe) < 0) out.push({ name: lib.name, version: m[1], note: lib.note });
  }
  return out;
}

const LOGIN_PATHS = ['/wp-login.php', '/wp-admin/', '/admin', '/admin/', '/administrator/', '/login', '/inloggen', '/user/login', '/admin/login', '/account/login', '/my-account/', '/mijn-account/', '/beheer', '/cms', '/backend'];

async function siteChecks(start, robots, securityChecks, isCancelled) {
  const c = { https: start.protocol === 'https:', robots: robots.found, robotsBlocksAll: robots.blocksAll, sitemaps: robots.sitemaps.slice(0, 5) };
  const jobs = [];

  jobs.push((async () => {
    try {
      const r = await get('http://' + start.host + start.pathname, { redirect: 'manual', timeout: 8000 });
      const loc = r.headers.get('location') || '';
      c.httpRedirect = r.status >= 300 && r.status < 400 && loc.startsWith('https://');
    } catch { c.httpRedirect = null; }
  })());

  jobs.push((async () => {
    // www en zonder www moeten naar één versie leiden
    const other = start.host.startsWith('www.') ? start.host.slice(4) : 'www.' + start.host;
    try {
      const r = await get(start.protocol + '//' + other + '/', { timeout: 8000 });
      await r.arrayBuffer().catch(() => {});
      c.wwwVariant = other;
      c.wwwRedirect = new URL(r.url).host === start.host;
    } catch { c.wwwRedirect = null; }
  })());

  jobs.push((async () => {
    try {
      const t0 = Date.now();
      const r = await get(start.href, { timeout: 15000 });
      c.ttfb = Date.now() - t0;
      const h = r.headers;
      c.status = r.status;
      c.headers = {
        hsts: !!h.get('strict-transport-security'),
        csp: !!h.get('content-security-policy'),
        xfo: !!h.get('x-frame-options') || /frame-ancestors/i.test(h.get('content-security-policy') || ''),
        xcto: (h.get('x-content-type-options') || '').toLowerCase() === 'nosniff',
        referrer: !!h.get('referrer-policy'),
        permissions: !!h.get('permissions-policy'),
      };
      c.server = [h.get('server'), h.get('x-powered-by')].filter(Boolean).join(' · ');
      c.serverVersionLeak = /\d+\.\d+/.test(c.server);
      c.compression = h.get('content-encoding') || '';
      c.http2 = null;
      // CORS verkeerd ingesteld: alles toestaan, zeker met credentials, is riskant
      const acao = h.get('access-control-allow-origin') || '';
      const acac = (h.get('access-control-allow-credentials') || '').toLowerCase() === 'true';
      c.corsWildcard = acao === '*' ? (acac ? 'credentials' : 'wildcard') : '';
      c.cookies = (typeof h.getSetCookie === 'function' ? h.getSetCookie() : []).map(ck => {
        const name = ck.split('=')[0];
        return { name, secure: /;\s*secure/i.test(ck), httpOnly: /;\s*httponly/i.test(ck), sameSite: (ck.match(/samesite=(\w+)/i) || [])[1] || '' };
      });
      const html = await r.text();
      c.tech = detectTech(html);
      c.oldLibs = detectOldLibs(html);
      const gen = html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)/i);
      c.generatorVersion = gen && /\d+\.\d+/.test(gen[1]) ? gen[1] : '';
      c.favicon = /<link[^>]+rel=["'][^"']*icon/i.test(html);
    } catch (e) { c.error = errText(e); }
  })());

  jobs.push((async () => {
    // Een pagina die niet bestaat moet een echte 404 geven ("soft 404" is slecht voor SEO)
    try {
      const r = await get(start.origin + '/ghost-crawler-test-' + crypto.randomBytes(4).toString('hex'), { timeout: 10000 });
      await r.arrayBuffer().catch(() => {});
      c.notFoundStatus = r.status;
    } catch { c.notFoundStatus = null; }
  })());

  if (start.protocol === 'https:') jobs.push((async () => { c.ssl = await sslInfo(start.hostname); })());

  jobs.push((async () => {
    try {
      const r = await get(start.origin + '/.well-known/security.txt', { timeout: 8000 });
      const b = r.ok ? await readLimited(r, 5000) : '';
      c.securityTxt = /contact:/i.test(b);
    } catch { c.securityTxt = false; }
  })());

  if (!c.sitemaps.length) jobs.push((async () => {
    for (const p of ['/sitemap.xml', '/sitemap_index.xml', '/wp-sitemap.xml']) {
      try {
        const r = await get(start.origin + p, { timeout: 8000 });
        const body = r.ok ? await readLimited(r, 20000) : '';
        if (/<(urlset|sitemapindex)/i.test(body)) { c.sitemaps = [start.origin + p]; return; }
      } catch {}
    }
  })());

  await Promise.all(jobs);

  c.loginPages = [];
  if (securityChecks && !isCancelled()) {
    const seenLogin = new Set();
    await Promise.all(LOGIN_PATHS.map(async p => {
      try {
        const r = await get(start.origin + p, { timeout: 10000 });
        const b = await readLimited(r, 150000);
        if (r.status === 200 && /type\s*=\s*["']?password/i.test(b) && !seenLogin.has(r.url)) {
          seenLogin.add(r.url);
          c.loginPages.push({ path: p, url: r.url, captcha: /recaptcha|hcaptcha|turnstile/i.test(b), twoFactor: /two.?factor|2fa|authenticator|wordfence/i.test(b) });
        }
      } catch {}
    }));
  }

  c.exposures = [];
  if (securityChecks && !isCancelled()) {
    await Promise.all(EXPOSURES.map(async x => {
      try {
        const r = await get(start.origin + x.path, { timeout: 10000 });
        const b = await readLimited(r, 50000);
        if (x.test(b, r)) c.exposures.push({ path: x.path, label: x.label, sev: x.sev });
      } catch {}
    }));
    c.securityChecked = true;
  }
  return c;
}

// ---------- Crawler ----------

async function crawl(opts, emit, isCancelled) {
  let start = new URL(opts.url);
  try {
    const r = await get(start.href, { timeout: 15000 });
    await r.arrayBuffer().catch(() => {});
    if (r.url && bareHost(new URL(r.url).host) === bareHost(start.host)) start = new URL(r.url);
  } catch {}

  const num = (v, d, min, max) => { const n = parseInt(v); return Math.min(Math.max(Number.isNaN(n) ? d : n, min), max); };
  const maxPages = num(opts.maxPages, 200, 1, 5000);
  const maxDepth = num(opts.maxDepth, 10, 0, 50);
  const delay = num(opts.delay, 100, 0, 10000);
  const concurrency = num(opts.concurrency, 4, 1, 10);
  const sameHost = opts.sameHost !== false;
  const respectRobots = opts.respectRobots !== false;
  const useSitemap = opts.useSitemap !== false;
  const checkLinks = opts.checkLinks !== false;
  const checkImages = opts.checkImages !== false;
  const smartSkip = opts.smartSkip !== false;
  const securityChecks = opts.securityChecks !== false;
  const include = opts.include ? new RegExp(opts.include, 'i') : null;
  const exclude = opts.exclude ? new RegExp(opts.exclude, 'i') : null;
  const keywords = (opts.keywords || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean).slice(0, 10);

  emit('phase', { text: 'Beveiliging, SSL en website-instellingen controleren…' });
  const robots = await loadRobots(start.origin);
  const site = await siteChecks(start, robots, securityChecks, isCancelled);
  emit('site', site);

  const seen = new Set([start.href]);
  const queue = [{ url: start.href, depth: 0, from: null }];
  const linkTargets = new Map();
  const imageTargets = new Map();
  let skippedRobots = 0, skippedSmart = 0;

  const shouldVisit = u => {
    let parsed;
    try { parsed = new URL(u); } catch { return false; }
    if (sameHost && bareHost(parsed.host) !== bareHost(start.host)) return false;
    if (FILE_EXT.test(parsed.pathname)) return false;
    if (smartSkip && SMART_SKIP.test(parsed.pathname + parsed.search)) { skippedSmart++; return false; }
    if (include && !include.test(u)) return false;
    if (exclude && exclude.test(u)) return false;
    if (respectRobots && bareHost(parsed.host) === bareHost(start.host) && !robotsAllowed(robots.rules, u)) { skippedRobots++; return false; }
    return true;
  };

  let sitemapUrls = [];
  if (useSitemap && site.sitemaps.length) {
    emit('phase', { text: 'Sitemap lezen…' });
    sitemapUrls = await loadSitemap(site.sitemaps, Math.max(maxPages * 3, 500), isCancelled);
    emit('sitemap', { count: sitemapUrls.length, urls: sitemapUrls.slice(0, 10000) });
  }

  const addTarget = (map, url, from) => {
    let t = map.get(url);
    if (!t) { t = []; map.set(url, t); }
    if (t.length < 20 && !t.includes(from)) t.push(from);
  };

  emit('start', { url: start.href, maxPages, maxDepth, keywords });
  emit('phase', { text: 'Pagina\'s scannen…' });

  let done = 0, active = 0, sitemapAdded = false;

  async function visit(item) {
    const t0 = Date.now();
    const r = { url: item.url, depth: item.depth, from: item.from, viaSitemap: !!item.viaSitemap };
    try {
      const res = await get(item.url);
      r.ttfb = Date.now() - t0;
      r.status = res.status;
      r.finalUrl = res.url !== item.url ? res.url : undefined;
      r.contentType = (res.headers.get('content-type') || '').split(';')[0];
      r.compressed = !!res.headers.get('content-encoding');
      r.cacheControl = res.headers.get('cache-control') || '';
      if (r.contentType.includes('html')) {
        const html = await res.text();
        r.timeMs = Date.now() - t0;
        r.size = Buffer.byteLength(html);
        const info = parsePage(html, res.url || item.url);
        const { text, internal, external, imgSrcs, ...rest } = info;
        Object.assign(r, rest);
        r.tech = detectTech(html).found;
        r.links = internal.slice(0, 500);
        r.linkCount = internal.length + external.length;
        r.externalCount = external.length;
        r.matches = keywordMatches(text, keywords);
        const noFollow = /nofollow/.test(info.robotsMeta);
        for (const l of external) addTarget(linkTargets, l, item.url);
        for (const s of imgSrcs) addTarget(imageTargets, s, item.url);
        for (const l of internal) {
          if (FILE_EXT.test(new URL(l).pathname)) { addTarget(linkTargets, l, item.url); continue; }
          if (noFollow || item.depth >= maxDepth || seen.has(l) || seen.size >= maxPages * 30) continue;
          if (!shouldVisit(l)) continue;
          seen.add(l);
          queue.push({ url: l, depth: item.depth + 1, from: item.url });
        }
      } else {
        await res.arrayBuffer().catch(() => {});
      }
    } catch (err) {
      r.status = 0;
      r.error = errText(err);
    }
    r.timeMs ??= Date.now() - t0;
    done++;
    emit('page', { ...r, done, queued: queue.length });
  }

  await new Promise(resolve => {
    const pump = () => {
      if (isCancelled()) { if (active === 0) resolve(); return; }
      if (!queue.length && !sitemapAdded && active === 0) {
        sitemapAdded = true;
        for (const u of sitemapUrls) {
          if (!seen.has(u) && shouldVisit(u)) { seen.add(u); queue.push({ url: u, depth: 1, from: null, viaSitemap: true }); }
        }
      }
      while (active < concurrency && queue.length && done + active < maxPages) {
        const item = queue.shift();
        active++;
        (async () => {
          await visit(item);
          if (delay) await sleep(delay);
          active--;
          pump();
        })();
      }
      if (active === 0 && (done >= maxPages || (!queue.length && sitemapAdded))) resolve();
    };
    pump();
  });

  async function runChecks(entries, event, workerFn) {
    let i = 0;
    const worker = async () => {
      while (i < entries.length && !isCancelled()) {
        const [url, from] = entries[i++];
        emit(event, { url, from, ...(await workerFn(url)) });
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
  }

  if (checkImages && !isCancelled() && imageTargets.size) {
    const entries = [...imageTargets.entries()].slice(0, 500);
    emit('phase', { text: `${entries.length} afbeeldingen controleren (kapot of te groot)…` });
    await runChecks(entries, 'image', async url => {
      const t0 = Date.now();
      try {
        let res = await get(url, { method: 'HEAD', timeout: 10000 });
        if ([403, 405, 501, 400].includes(res.status) || (res.ok && !res.headers.get('content-length'))) {
          res = await get(url, { timeout: 15000 });
          const buf = res.ok ? await res.arrayBuffer().catch(() => null) : null;
          return { status: res.status, bytes: buf ? buf.byteLength : null, type: res.headers.get('content-type') || '', timeMs: Date.now() - t0 };
        }
        return { status: res.status, bytes: parseInt(res.headers.get('content-length')) || null, type: res.headers.get('content-type') || '', timeMs: Date.now() - t0 };
      } catch (err) { return { status: 0, error: errText(err), timeMs: Date.now() - t0 }; }
    });
  }

  if (checkLinks && !isCancelled() && linkTargets.size) {
    const entries = [...linkTargets.entries()].slice(0, 500);
    emit('phase', { text: `${entries.length} externe links en bestanden controleren…` });
    await runChecks(entries, 'link', async url => {
      const t0 = Date.now();
      const external = bareHost(new URL(url).host) !== bareHost(start.host);
      try {
        let res = await get(url, { method: 'HEAD', timeout: 10000 });
        if ([403, 405, 501, 400].includes(res.status)) {
          res = await get(url, { timeout: 12000 });
          res.body?.cancel().catch(() => {});
        }
        return { external, status: res.status, timeMs: Date.now() - t0 };
      } catch (err) { return { external, status: 0, error: errText(err), timeMs: Date.now() - t0 }; }
    });
  }

  emit('done', { done, cancelled: isCancelled(), remaining: queue.length, skippedRobots, skippedSmart });
}

// ---------- Scan-taken (lopen door als de browser even weg is) ----------

const jobs = new Map();

function startJob(opts) {
  const id = crypto.randomBytes(6).toString('hex');
  const job = { id, events: [], listeners: new Set(), finished: false, cancelled: false, created: Date.now() };
  jobs.set(id, job);
  const emit = (event, data) => {
    job.events.push({ event, data });
    const n = job.events.length;
    for (const res of job.listeners) res.write(`id: ${n}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  crawl(opts, emit, () => job.cancelled)
    .catch(e => emit('failure', { error: e.message }))
    .finally(() => {
      job.finished = true;
      for (const res of job.listeners) res.end();
      job.listeners.clear();
    });
  for (const [k, j] of jobs) if (j.finished && Date.now() - j.created > 6 * 3600e3) jobs.delete(k);
  return id;
}

// ---------- Geschiedenis ----------

function listHistory() {
  try {
    return fs.readdirSync(SCANS_DIR).filter(f => f.endsWith('.json')).map(f => {
      try {
        const meta = JSON.parse(fs.readFileSync(path.join(SCANS_DIR, f.replace(/\.json$/, '.meta')), 'utf8'));
        return { file: f, ...meta };
      } catch { return null; }
    }).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date));
  } catch { return []; }
}

// ---------- Prijsvolger ----------

const createPriceWatch = require('./pricewatch');
const helpers = { get, readLimited, decodeEntities, stripTags, getAttr, errText };
module.exports = helpers;
const priceWatch = require.main === module ? {
  nl: createPriceWatch({ ...helpers, dir: __dirname, region: 'nl' }),
  us: createPriceWatch({ ...helpers, dir: __dirname, region: 'us' }),
} : {};
const PW_PAGES = { '/prijzen.html': 'nl', '/prijzen': 'nl', '/prices.html': 'us', '/prices': 'us' };

// ---------- HTTP-server ----------

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
async function readBody(req, max = 100e6) {
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > max) throw new Error('Te groot'); }
  return body;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (!(await auth.check(req, res, url))) return;

  const pwm = url.pathname.match(/^\/api\/pw\/(nl|us)(\/.*)$/);
  if (pwm) return priceWatch[pwm[1]](req, res, pwm[2]);
  if (PW_PAGES[url.pathname]) {
    return fs.readFile(path.join(__dirname, 'public', 'pricewatch.html'), 'utf8', (err, html) => {
      if (err) { res.writeHead(500); return res.end('pricewatch.html ontbreekt'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(html.replace('__REGION__', PW_PAGES[url.pathname]));
    });
  }

  if (url.pathname === '/api/scan' && req.method === 'POST') {
    let opts;
    try {
      opts = JSON.parse(await readBody(req, 1e6) || '{}');
      let u = String(opts.url || '').trim();
      if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
      opts.url = new URL(u).href;
      if (opts.include) new RegExp(opts.include);
      if (opts.exclude) new RegExp(opts.exclude);
    } catch (e) {
      return json(res, 400, { error: 'Ongeldige invoer: ' + e.message });
    }
    return json(res, 200, { id: startJob(opts) });
  }

  if (url.pathname === '/api/events') {
    const job = jobs.get(url.searchParams.get('id'));
    if (!job) return json(res, 404, { error: 'Scan niet gevonden' });
    const from = parseInt(req.headers['last-event-id'] || url.searchParams.get('from') || '0') || 0;
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('retry: 2000\n\n');
    job.events.slice(from).forEach((m, i) => res.write(`id: ${from + i + 1}\nevent: ${m.event}\ndata: ${JSON.stringify(m.data)}\n\n`));
    if (job.finished) { res.write('event: closed\ndata: {}\n\n'); return res.end(); }
    job.listeners.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 15000);
    req.on('close', () => { clearInterval(ping); job.listeners.delete(res); });
    return;
  }

  if (url.pathname === '/api/job') {
    const job = jobs.get(url.searchParams.get('id'));
    return job ? json(res, 200, { finished: job.finished }) : json(res, 404, { error: 'Scan niet gevonden' });
  }

  if (url.pathname === '/api/stop' && req.method === 'POST') {
    const job = jobs.get(url.searchParams.get('id'));
    if (job) job.cancelled = true;
    return json(res, 200, { ok: true });
  }

  if (url.pathname === '/api/history' && req.method === 'GET') return json(res, 200, listHistory());

  if (url.pathname === '/api/history' && req.method === 'POST') {
    try {
      const data = JSON.parse(await readBody(req));
      const host = (data.host || 'site').replace(/[^a-z0-9.-]/gi, '_');
      const date = new Date().toISOString();
      const name = `${host}_${date.replace(/[:.]/g, '-')}`;
      fs.mkdirSync(SCANS_DIR, { recursive: true });
      fs.writeFileSync(path.join(SCANS_DIR, name + '.json'), JSON.stringify(data.state));
      fs.writeFileSync(path.join(SCANS_DIR, name + '.meta'), JSON.stringify({ host: data.host, url: data.url, date, score: data.score, pages: data.pages, counts: data.counts, issues: data.issues }));
      return json(res, 200, { file: name + '.json' });
    } catch (e) { return json(res, 400, { error: e.message }); }
  }

  const hm = url.pathname.match(/^\/api\/history\/([\w.-]+\.json)$/);
  if (hm) {
    const file = path.join(SCANS_DIR, hm[1]);
    if (req.method === 'DELETE') {
      try { fs.unlinkSync(file); fs.unlinkSync(file.replace(/\.json$/, '.meta')); } catch {}
      return json(res, 200, { ok: true });
    }
    return fs.readFile(file, (err, data) => {
      if (err) return json(res, 404, { error: 'Niet gevonden' });
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(data);
    });
  }

  const file = url.pathname === '/' ? '/index.html' : url.pathname;
  const root = path.join(__dirname, 'public');
  const full = path.join(root, path.normalize(file));
  if (!full.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Niet gevonden'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

if (require.main === module) server.listen(PORT, HOST, () => {
  console.log(`\n  👻 Ghost Crawler v3 draait op http://localhost:${PORT}\n`);
  console.log(`  🇳🇱 Prijsvolger NL:   http://localhost:${PORT}/prijzen.html`);
  console.log(`  🇺🇸 Price tracker US: http://localhost:${PORT}/prices.html\n`);
  console.log(auth.enabled() ? '  🔒 Inloggen staat aan.\n' : '');
  console.log('  Open dit adres in je browser. Stoppen: CTRL + C\n');
});
