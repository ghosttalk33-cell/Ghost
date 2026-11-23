// Ghost Crawler — eenvoudige website-crawler met webinterface.
// Geen dependencies nodig: vereist Node.js 18 of nieuwer.
// Start: node server.js  → open http://localhost:3000

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const USER_AGENT = 'GhostCrawler/1.0 (+https://github.com/)';

// ---------- HTML-hulpfuncties ----------

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function getAttr(tag, name) {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? decodeEntities(m[2] ?? m[3] ?? m[4] ?? '') : null;
}

function parsePage(html, pageUrl) {
  const clean = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]) : '';

  let description = '';
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const n = (getAttr(tag, 'name') || getAttr(tag, 'property') || '').toLowerCase();
    if (n === 'description' || (!description && n === 'og:description')) {
      description = getAttr(tag, 'content') || description;
    }
  }

  const h1 = (clean.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi) || []).map(stripTags).filter(Boolean);

  // <base href> respecteren
  let base = pageUrl;
  const baseTag = html.match(/<base\b[^>]*>/i);
  if (baseTag) {
    const href = getAttr(baseTag[0], 'href');
    if (href) try { base = new URL(href, pageUrl).href; } catch {}
  }

  const links = new Set();
  for (const tag of clean.match(/<a\b[^>]*>/gi) || []) {
    const href = getAttr(tag, 'href');
    if (!href || /^(javascript:|mailto:|tel:|#)/i.test(href.trim())) continue;
    try {
      const u = new URL(href.trim(), base);
      if (!/^https?:$/.test(u.protocol)) continue;
      u.hash = '';
      links.add(u.href);
    } catch {}
  }

  const images = new Set();
  for (const tag of clean.match(/<img\b[^>]*>/gi) || []) {
    const src = getAttr(tag, 'src');
    if (!src || src.startsWith('data:')) continue;
    try { images.add(new URL(src, base).href); } catch {}
  }

  const emails = new Set(
    (decodeEntities(html).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])
      .filter(e => !/\.(png|jpe?g|gif|svg|webp)$/i.test(e))
  );

  const text = stripTags(clean);
  const wordCount = text ? text.split(' ').length : 0;

  return { title, description, h1, links: [...links], images: [...images], emails: [...emails], wordCount };
}

// ---------- robots.txt ----------

async function loadRobots(origin) {
  try {
    const res = await fetch(origin + '/robots.txt', {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const lines = (await res.text()).split(/\r?\n/);
    const rules = [];
    let applies = false;
    let lastWasAgent = false;
    for (const raw of lines) {
      const line = raw.replace(/#.*/, '').trim();
      const idx = line.indexOf(':');
      if (idx < 0) continue;
      const key = line.slice(0, idx).trim().toLowerCase();
      const val = line.slice(idx + 1).trim();
      if (key === 'user-agent') {
        const match = val === '*' || USER_AGENT.toLowerCase().startsWith(val.toLowerCase());
        applies = lastWasAgent ? applies || match : match;
        lastWasAgent = true;
        continue;
      }
      lastWasAgent = false;
      if (!applies) continue;
      if ((key === 'disallow' || key === 'allow') && val) rules.push({ allow: key === 'allow', path: val });
    }
    return rules;
  } catch {
    return [];
  }
}

function robotsAllowed(rules, url) {
  const p = new URL(url);
  const target = p.pathname + p.search;
  let best = null;
  for (const r of rules) {
    const re = new RegExp('^' + r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    if (re.test(target) && (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow))) {
      best = r;
    }
  }
  return !best || best.allow;
}

// ---------- Crawler ----------

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function crawl(opts, send, isCancelled) {
  const start = new URL(opts.url);
  const maxPages = Math.min(Math.max(parseInt(opts.maxPages) || 50, 1), 2000);
  const maxDepth = Math.min(Math.max(Number.isNaN(parseInt(opts.maxDepth)) ? 3 : parseInt(opts.maxDepth), 0), 20);
  const delay = Math.max(parseInt(opts.delay) || 0, 0);
  const concurrency = Math.min(Math.max(parseInt(opts.concurrency) || 3, 1), 10);
  const sameHost = opts.sameHost !== false;
  const respectRobots = opts.respectRobots !== false;
  const include = opts.include ? new RegExp(opts.include, 'i') : null;
  const exclude = opts.exclude ? new RegExp(opts.exclude, 'i') : null;

  const robots = respectRobots ? await loadRobots(start.origin) : [];
  const seen = new Set([start.href]);
  const queue = [{ url: start.href, depth: 0, from: null }];
  let done = 0;
  let active = 0;

  send('start', { url: start.href, maxPages, maxDepth });

  const shouldVisit = u => {
    let parsed;
    try { parsed = new URL(u); } catch { return false; }
    if (sameHost && parsed.host !== start.host) return false;
    if (/\.(jpe?g|png|gif|svg|webp|ico|pdf|zip|rar|7z|gz|mp3|mp4|avi|mov|wmv|css|js|woff2?|ttf|eot|xml|json)$/i.test(parsed.pathname)) return false;
    if (include && !include.test(u)) return false;
    if (exclude && exclude.test(u)) return false;
    if (respectRobots && parsed.origin === start.origin && !robotsAllowed(robots, u)) return false;
    return true;
  };

  async function visit(item) {
    const t0 = Date.now();
    const result = { url: item.url, depth: item.depth, from: item.from };
    try {
      const res = await fetch(item.url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      });
      result.status = res.status;
      result.finalUrl = res.url;
      result.contentType = res.headers.get('content-type') || '';
      if (result.contentType.includes('text/html')) {
        const html = await res.text();
        result.size = Buffer.byteLength(html);
        const info = parsePage(html, res.url || item.url);
        Object.assign(result, info, { linkCount: info.links.length, imageCount: info.images.length });
        if (item.depth < maxDepth) {
          for (const link of info.links) {
            if (seen.has(link) || seen.size >= maxPages * 20) continue;
            if (!shouldVisit(link)) continue;
            seen.add(link);
            queue.push({ url: link, depth: item.depth + 1, from: item.url });
          }
        }
        delete result.links;
      }
    } catch (err) {
      result.status = 0;
      result.error = err.name === 'TimeoutError' ? 'Timeout' : (err.cause?.code || err.message);
    }
    result.timeMs = Date.now() - t0;
    done++;
    send('page', { ...result, done, queued: queue.length });
  }

  await new Promise(resolve => {
    const pump = async () => {
      if (isCancelled()) { if (active === 0) resolve(); return; }
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
      if (active === 0 && (!queue.length || done >= maxPages)) resolve();
    };
    pump();
  });

  send('done', { done, cancelled: isCancelled(), remaining: queue.length });
}

// ---------- HTTP-server ----------

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/crawl') {
    const opts = Object.fromEntries(url.searchParams);
    opts.sameHost = opts.sameHost !== 'false';
    opts.respectRobots = opts.respectRobots !== 'false';
    try {
      let u = (opts.url || '').trim();
      if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
      opts.url = new URL(u).href;
      if (opts.include) new RegExp(opts.include);
      if (opts.exclude) new RegExp(opts.exclude);
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Ongeldige URL of patroon: ' + e.message }));
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    let cancelled = false;
    req.on('close', () => { cancelled = true; });
    const send = (event, data) => {
      if (!cancelled) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    try {
      await crawl(opts, send, () => cancelled);
    } catch (e) {
      send('failure', { error: e.message });
    }
    return res.end();
  }

  const file = url.pathname === '/' ? '/index.html' : url.pathname;
  const full = path.join(__dirname, 'public', path.normalize(file).replace(/^(\.\.[\/\\])+/, ''));
  if (!full.startsWith(path.join(__dirname, 'public'))) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Niet gevonden'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  👻 Ghost Crawler draait op http://localhost:${PORT}\n`);
});
