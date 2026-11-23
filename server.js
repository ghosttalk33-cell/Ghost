// Ghost Crawler — volledige website-scan met webinterface.
// Geen dependencies nodig: vereist Node.js 18 of nieuwer.
// Start: node server.js  → open http://localhost:3000

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const USER_AGENT = 'Mozilla/5.0 (compatible; GhostCrawler/2.0)';
const FILE_EXT = /\.(jpe?g|png|gif|svg|webp|avif|ico|bmp|pdf|docx?|xlsx?|pptx?|csv|txt|zip|rar|7z|gz|tar|mp3|wav|mp4|avi|mov|wmv|webm|css|js|mjs|woff2?|ttf|eot|otf|xml|json|rss|apk|exe|dmg)$/i;

// ---------- Hulpfuncties ----------

const sleep = ms => new Promise(r => setTimeout(r, ms));

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

// ---------- Pagina-analyse ----------

function parsePage(html, pageUrl) {
  const noScript = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const page = new URL(pageUrl);

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]) : '';

  let description = '', robotsMeta = '', viewport = false, ogTitle = false, ogImage = false;
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const n = (getAttr(tag, 'name') || getAttr(tag, 'property') || '').toLowerCase();
    const c = getAttr(tag, 'content') || '';
    if (n === 'description') description = c.trim();
    else if (n === 'robots' || n === 'googlebot') robotsMeta += c.toLowerCase() + ' ';
    else if (n === 'viewport') viewport = true;
    else if (n === 'og:title') ogTitle = true;
    else if (n === 'og:image') ogImage = true;
  }

  let canonical = '';
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    if ((getAttr(tag, 'rel') || '').toLowerCase().split(/\s+/).includes('canonical')) {
      try { canonical = new URL(getAttr(tag, 'href') || '', pageUrl).href; } catch {}
    }
  }

  const htmlTag = html.match(/<html\b[^>]*>/i);
  const lang = htmlTag ? (getAttr(htmlTag[0], 'lang') || '') : '';

  const h1 = (noScript.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi) || []).map(stripTags).filter(Boolean);
  const h2Count = (noScript.match(/<h2\b/gi) || []).length;

  let base = pageUrl;
  const baseTag = html.match(/<base\b[^>]*>/i);
  if (baseTag) { const href = getAttr(baseTag[0], 'href'); if (href) try { base = new URL(href, pageUrl).href; } catch {} }

  const internal = new Set(), external = new Set();
  let nofollowLinks = 0;
  for (const tag of noScript.match(/<a\b[^>]*>/gi) || []) {
    const href = getAttr(tag, 'href');
    if (!href || /^(javascript:|mailto:|tel:|sms:|#|data:)/i.test(href.trim())) continue;
    if ((getAttr(tag, 'rel') || '').toLowerCase().includes('nofollow')) nofollowLinks++;
    try {
      const u = new URL(href.trim(), base);
      if (!/^https?:$/.test(u.protocol)) continue;
      u.hash = '';
      (u.host === page.host ? internal : external).add(u.href);
    } catch {}
  }

  let images = 0, imagesNoAlt = 0;
  for (const tag of noScript.match(/<img\b[^>]*>/gi) || []) {
    images++;
    if (getAttr(tag, 'alt') === null) imagesNoAlt++;
  }

  let mixedContent = 0;
  if (page.protocol === 'https:') {
    mixedContent = (html.match(/<(img|script|iframe|source|video|audio|embed)\b[^>]*\ssrc\s*=\s*["']?http:\/\//gi) || []).length
      + (html.match(/<link\b[^>]*\shref\s*=\s*["']?http:\/\/[^>]*rel\s*=\s*["']?stylesheet/gi) || []).length;
  }

  const structuredData = /application\/ld\+json/i.test(html) || /itemscope/i.test(html);

  const emails = [...new Set(
    (decodeEntities(noScript).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])
      .map(e => e.toLowerCase())
      .filter(e => !/\.(png|jpe?g|gif|svg|webp)$/i.test(e) && !/(sentry|example|domain)\./.test(e))
  )];

  const text = stripTags(noScript);
  const wordCount = text ? text.split(' ').length : 0;
  const contentHash = wordCount >= 50 ? crypto.createHash('md5').update(text.toLowerCase()).digest('hex').slice(0, 12) : null;

  return {
    title, description, robotsMeta: robotsMeta.trim(), viewport, ogTitle, ogImage, canonical, lang,
    h1, h2Count, images, imagesNoAlt, mixedContent, structuredData, emails, wordCount, contentHash,
    internal: [...internal], external: [...external], nofollowLinks, text,
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
  const info = { found: false, rules: [], sitemaps: [] };
  try {
    const res = await get(origin + '/robots.txt', { timeout: 8000 });
    if (!res.ok || !(res.headers.get('content-type') || '').includes('text/plain')) return info;
    info.found = true;
    let applies = false, lastWasAgent = false;
    for (const raw of (await res.text()).split(/\r?\n/)) {
      const line = raw.replace(/#.*/, '').trim();
      const idx = line.indexOf(':');
      if (idx < 0) continue;
      const key = line.slice(0, idx).trim().toLowerCase();
      const val = line.slice(idx + 1).trim();
      if (key === 'sitemap') { info.sitemaps.push(val); continue; }
      if (key === 'user-agent') {
        const match = val === '*' || /ghostcrawler/i.test(val);
        applies = lastWasAgent ? applies || match : match;
        lastWasAgent = true;
        continue;
      }
      lastWasAgent = false;
      if (applies && (key === 'disallow' || key === 'allow') && val) info.rules.push({ allow: key === 'allow', path: val });
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
  while (todo.length && fetched < 15 && found.size < limit && !isCancelled()) {
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

async function siteChecks(start, robots) {
  const c = { https: start.protocol === 'https:', robots: robots.found, sitemaps: robots.sitemaps.slice(0, 5) };
  try {
    const r = await get('http://' + start.host + start.pathname, { redirect: 'manual', timeout: 8000 });
    const loc = r.headers.get('location') || '';
    c.httpRedirect = r.status >= 300 && r.status < 400 && loc.startsWith('https://');
  } catch { c.httpRedirect = null; }
  try {
    const r = await get(start.href, { timeout: 15000 });
    const h = r.headers;
    c.status = r.status;
    c.headers = {
      hsts: !!h.get('strict-transport-security'),
      csp: !!h.get('content-security-policy'),
      xfo: !!h.get('x-frame-options') || /frame-ancestors/i.test(h.get('content-security-policy') || ''),
      xcto: (h.get('x-content-type-options') || '').toLowerCase() === 'nosniff',
      referrer: !!h.get('referrer-policy'),
    };
    c.server = [h.get('server'), h.get('x-powered-by')].filter(Boolean).join(' · ');
    c.compression = h.get('content-encoding') || '';
    await r.arrayBuffer().catch(() => {});
  } catch (e) { c.error = errText(e); }
  if (!c.sitemaps.length) {
    try {
      const r = await get(start.origin + '/sitemap.xml', { timeout: 8000 });
      const body = r.ok ? await r.text() : '';
      if (/<(urlset|sitemapindex)/i.test(body)) c.sitemaps = [start.origin + '/sitemap.xml'];
    } catch {}
  }
  return c;
}

// ---------- Crawler ----------

async function crawl(opts, emit, isCancelled) {
  const start = new URL(opts.url);
  const num = (v, d, min, max) => { const n = parseInt(v); return Math.min(Math.max(Number.isNaN(n) ? d : n, min), max); };
  const maxPages = num(opts.maxPages, 100, 1, 5000);
  const maxDepth = num(opts.maxDepth, 5, 0, 50);
  const delay = num(opts.delay, 100, 0, 10000);
  const concurrency = num(opts.concurrency, 4, 1, 10);
  const sameHost = opts.sameHost !== false;
  const respectRobots = opts.respectRobots !== false;
  const useSitemap = opts.useSitemap !== false;
  const checkLinks = opts.checkLinks !== false;
  const include = opts.include ? new RegExp(opts.include, 'i') : null;
  const exclude = opts.exclude ? new RegExp(opts.exclude, 'i') : null;
  const keywords = (opts.keywords || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean).slice(0, 10);

  emit('phase', { text: 'robots.txt en website-instellingen controleren…' });
  const robots = await loadRobots(start.origin);
  const site = await siteChecks(start, robots);
  emit('site', site);

  const seen = new Set([start.href]);
  const queue = [{ url: start.href, depth: 0, from: null }];
  const linkTargets = new Map(); // externe links + bestanden → pagina's waarop ze staan
  let skippedRobots = 0;

  const shouldVisit = u => {
    let parsed;
    try { parsed = new URL(u); } catch { return false; }
    if (sameHost && parsed.host !== start.host) return false;
    if (FILE_EXT.test(parsed.pathname)) return false;
    if (include && !include.test(u)) return false;
    if (exclude && exclude.test(u)) return false;
    if (respectRobots && parsed.origin === start.origin && !robotsAllowed(robots.rules, u)) { skippedRobots++; return false; }
    return true;
  };

  let sitemapUrls = [];
  if (useSitemap && site.sitemaps.length) {
    emit('phase', { text: 'Sitemap lezen…' });
    sitemapUrls = await loadSitemap(site.sitemaps, maxPages * 3, isCancelled);
    emit('sitemap', { count: sitemapUrls.length, urls: sitemapUrls.slice(0, 5000) });
  }

  const addTarget = (url, from) => {
    let t = linkTargets.get(url);
    if (!t) { t = []; linkTargets.set(url, t); }
    if (t.length < 20) t.push(from);
  };

  emit('start', { url: start.href, maxPages, maxDepth, keywords });
  emit('phase', { text: 'Pagina\'s scannen…' });

  let done = 0, active = 0, sitemapAdded = false;

  async function visit(item) {
    const t0 = Date.now();
    const r = { url: item.url, depth: item.depth, from: item.from, viaSitemap: !!item.viaSitemap };
    try {
      const res = await get(item.url);
      r.status = res.status;
      r.finalUrl = res.url !== item.url ? res.url : undefined;
      r.contentType = (res.headers.get('content-type') || '').split(';')[0];
      if (r.contentType.includes('html')) {
        const html = await res.text();
        r.timeMs = Date.now() - t0;
        r.size = Buffer.byteLength(html);
        const info = parsePage(html, res.url || item.url);
        const { text, internal, external, ...rest } = info;
        Object.assign(r, rest);
        r.links = internal.slice(0, 500);
        r.linkCount = internal.length + external.length;
        r.externalCount = external.length;
        r.matches = keywordMatches(text, keywords);
        const noFollow = /nofollow/.test(info.robotsMeta);
        for (const l of external) addTarget(l, item.url);
        for (const l of internal) {
          if (FILE_EXT.test(new URL(l).pathname)) { addTarget(l, item.url); continue; }
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
        // Pagina's uit de sitemap die niet via links gevonden zijn ook scannen
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

  // Externe links en bestanden controleren
  if (checkLinks && !isCancelled() && linkTargets.size) {
    const targets = [...linkTargets.entries()].slice(0, 400);
    emit('phase', { text: `${targets.length} externe links en bestanden controleren…` });
    let i = 0;
    const worker = async () => {
      while (i < targets.length && !isCancelled()) {
        const [url, from] = targets[i++];
        const t0 = Date.now();
        const out = { url, from, external: new URL(url).host !== start.host };
        try {
          let res = await get(url, { method: 'HEAD', timeout: 10000 });
          if ([403, 405, 501, 400].includes(res.status)) {
            res = await get(url, { timeout: 12000 });
            res.body?.cancel().catch(() => {});
          }
          out.status = res.status;
        } catch (err) {
          out.status = 0;
          out.error = errText(err);
        }
        out.timeMs = Date.now() - t0;
        emit('link', out);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
  }

  emit('done', { done, cancelled: isCancelled(), remaining: queue.length, skippedRobots });
}

// ---------- Scan-taken (lopen door als de browser even weg is) ----------

const jobs = new Map();

function startJob(opts) {
  const id = crypto.randomBytes(6).toString('hex');
  const job = { id, events: [], listeners: new Set(), finished: false, cancelled: false, created: Date.now() };
  jobs.set(id, job);
  const emit = (event, data) => {
    const msg = { event, data };
    job.events.push(msg);
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
  // Oude scans opruimen
  for (const [k, j] of jobs) if (j.finished && Date.now() - j.created > 6 * 3600e3) jobs.delete(k);
  return id;
}

// ---------- HTTP-server ----------

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/scan' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let opts;
    try {
      opts = JSON.parse(body || '{}');
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

  const file = url.pathname === '/' ? '/index.html' : url.pathname;
  const root = path.join(__dirname, 'public');
  const full = path.join(root, path.normalize(file));
  if (!full.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Niet gevonden'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  👻 Ghost Crawler draait op http://localhost:${PORT}\n`);
  console.log('  Open dit adres in je browser. Stoppen: CTRL + C\n');
});
