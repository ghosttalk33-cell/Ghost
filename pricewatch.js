// Ghost Prijsvolger — vergelijkt prijzen en COA's (certificaten van analyse) van peptide-webshops.
// Ondersteunt Shopify (products.json), WooCommerce (Store API) en andere shops (JSON-LD op productpagina's).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = function createPriceWatch({ get, readLimited, decodeEntities, stripTags, getAttr, errText, dir }) {
  const DATA = path.join(dir, 'data');
  const file = n => path.join(DATA, n);
  const load = (n, d) => { try { return JSON.parse(fs.readFileSync(file(n), 'utf8')); } catch { return d; } };
  const save = (n, v) => { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(file(n), JSON.stringify(v)); };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  let shops = load('pw-shops.json', []);
  let settings = load('pw-settings.json', { autoHours: 0, lastAuto: 0 });
  let job = { running: false, queue: [], current: null, phase: '', done: 0, total: 0, log: [] };
  let rates = { EUR: 1, USD: 1.08, GBP: 0.85, CAD: 1.48, AUD: 1.65, CHF: 0.95, SEK: 11.4, NOK: 11.6, DKK: 7.46, PLN: 4.3, CZK: 25, HUF: 395, RON: 4.97 };
  let ratesAt = 0;

  // ---------- Peptiden herkennen ----------
  const PEPTIDES = [
    ['BPC-157', /bpc[\s-]?157/i], ['TB-500', /tb[\s-]?500|thymosin[\s-]?beta|\btb[\s-]?4\b/i],
    ['Semaglutide', /semaglutide|\bsema\b|glp[\s-]?1[\s-]?s\b/i], ['Tirzepatide', /tirzepatide|\btirz(e|ep)?\b|glp[\s-]?2[\s-]?t\b/i],
    ['Retatrutide', /retatrutide|\breta\b|glp[\s-]?3[\s-]?r?\b/i], ['Cagrilintide', /cagrilintide|\bcagri\b/i], ['Survodutide', /survodutide/i],
    ['Mazdutide', /mazdutide/i], ['Liraglutide', /liraglutide/i], ['Ipamorelin', /ipamorelin/i], ['CJC-1295', /cjc[\s-]?1295/i],
    ['Sermorelin', /sermorelin/i], ['Tesamorelin', /tesamorelin/i], ['GHRP-2', /ghrp[\s-]?2/i], ['GHRP-6', /ghrp[\s-]?6/i], ['Hexarelin', /hexarelin/i],
    ['GHK-Cu', /ghk[\s-]?cu|copper[\s-]?peptide/i], ['AHK-Cu', /ahk[\s-]?cu/i], ['MOTS-c', /mots[\s-]?c/i], ['SS-31', /ss[\s-]?31|elamipretide/i],
    ['Epitalon', /epitalon|epithalon/i], ['Selank', /selank/i], ['Semax', /semax/i], ['PT-141', /pt[\s-]?141|bremelanotide/i],
    ['Melanotan II', /melanotan[\s-]?(2|ii)\b|\bmt[\s-]?(2|ii)\b/i], ['Melanotan I', /melanotan[\s-]?(1|i)\b|\bmt[\s-]?(1|i)\b/i],
    ['NAD+', /\bnad\b|nad\+/i], ['AOD-9604', /aod[\s-]?9604/i], ['HGH Fragment 176-191', /frag(ment)?[\s-]?176|176[\s-]?191/i],
    ['IGF-1 LR3', /igf[\s-]?1/i], ['KPV', /\bkpv\b/i], ['LL-37', /\bll[\s-]?37\b/i], ['DSIP', /\bdsip\b/i], ['Kisspeptin', /kisspeptin/i],
    ['Oxytocin', /oxytocin/i], ['Thymosin Alpha-1', /thymosin[\s-]?alpha|\bta[\s-]?1\b/i], ['Thymalin', /thymalin/i], ['Humanin', /humanin/i],
    ['Dihexa', /dihexa/i], ['Pinealon', /pinealon/i], ['Gonadorelin', /gonadorelin/i], ['HCG', /\bhcg\b/i], ['Follistatin', /follistatin/i],
    ['MGF / PEG-MGF', /\bmgf\b/i], ['Snap-8', /snap[\s-]?8/i], ['Cerebrolysin', /cerebrolysin/i], ['VIP', /\bvip\b/i], ['Glutathione', /glutathione/i],
    ['Bacteriostatisch water', /bac(teriostatic|teriostatisch)?[\s-]?water|\bbac\s?h2o\b/i],
  ];
  function identify(text) {
    const found = PEPTIDES.filter(([, re]) => re.test(text)).map(([n]) => n);
    // Melanotan I/II en TB-500/Thymosin alpha niet dubbel tellen
    const uniq = found.filter(n => !(n === 'Melanotan I' && found.includes('Melanotan II')));
    return uniq;
  }

  function parseDose(...texts) {
    for (const t of texts) {
      if (!t) continue;
      const doses = [...t.matchAll(/(\d+(?:[.,]\d+)?)\s?(mg|mcg|µg|ug|iu)\b/gi)].map(m => {
        const v = parseFloat(m[1].replace(',', '.'));
        const unit = m[2].toLowerCase();
        return unit === 'iu' ? { iu: v } : { mg: unit === 'mg' ? v : v / 1000 };
      });
      if (!doses.length) continue;
      const mg = doses.filter(d => d.mg).reduce((s, d) => s + d.mg, 0);
      const iu = doses.filter(d => d.iu).reduce((s, d) => s + d.iu, 0);
      const cm = t.match(/(\d+)\s?(?:x|×)\s?\d/i) || t.match(/(\d+)\s?(?:vials?|flesjes?|flacons?|pcs|stuks|ampullen|ampoules)\b/i) || t.match(/(?:kit|box|pack|set)\s?(?:of\s)?(\d+)/i);
      const count = cm ? Math.min(100, parseInt(cm[1])) : 1;
      return { mg: mg || null, iu: iu || null, count };
    }
    return { mg: null, iu: null, count: 1 };
  }

  // ---------- COA's herkennen ----------
  const COA_RE = /\bcoa\b|c\.o\.a|certificate[\s-]?of[\s-]?analysis|analysecertificaat|certificaat|lab[\s-]?(test|result|report|rapport|uitslag)|third[\s-]?party|janoshik|hplc|mass[\s-]?spec|\bms[\s-]?report|purity[\s-]?(test|report)/i;
  const LABS = [['Janoshik', /janoshik/i], ['Chromate', /chromate/i], ['Freedom Diagnostics', /freedom[\s-]?diagnostics/i], ['MZ Biolabs', /mz[\s-]?bio/i],
    ['Vanguard Laboratory', /vanguard/i], ['Colmaric', /colmaric/i], ['Eurofins', /eurofins/i], ['SGS', /\bsgs\b/i], ['Intertek', /intertek/i], ['ACS Lab', /acs[\s-]?lab/i],
    ['Analytical Solutions', /analytical[\s-]?solutions/i], ['TrustPointe', /trustpointe/i]];
  function findCoas(html, base) {
    if (!html) return { links: [], labs: [], purity: null, verifiable: false, mentions: false };
    const links = new Map();
    const add = (u, label) => {
      try {
        const url = new URL(decodeEntities(u), base).href;
        if (!/^https?:/.test(url) || links.has(url)) return;
        links.set(url, { url, label: (label || '').slice(0, 80), lab: (LABS.find(([, re]) => re.test(url + ' ' + label)) || [])[0] || '' });
      } catch {}
    };
    for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
      const tag = '<a ' + m[1] + '>';
      const href = getAttr(tag, 'href') || '';
      const text = stripTags(m[2]) + ' ' + (getAttr(tag, 'title') || '') + ' ' + ((m[2].match(/alt=["']([^"']*)/i) || [])[1] || '');
      if (href && (COA_RE.test(text) || COA_RE.test(href) || /janoshik\.com/i.test(href))) add(href, text.trim() || 'COA');
    }
    for (const tag of html.match(/<img\b[^>]*>/gi) || []) {
      const src = getAttr(tag, 'data-src') || getAttr(tag, 'data-large_image') || getAttr(tag, 'src') || '';
      const alt = (getAttr(tag, 'alt') || '') + ' ' + (getAttr(tag, 'title') || '');
      if (src && !src.startsWith('data:') && (COA_RE.test(alt) || /coa|certificate|janoshik|lab[-_]?test|hplc/i.test(src))) add(src, alt.trim() || 'COA-afbeelding');
    }
    for (const m of html.matchAll(/https?:\/\/[^\s"'<>]+\.pdf/gi)) if (/coa|certificate|analysis|janoshik|lab|test|hplc/i.test(m[0])) add(m[0], 'PDF');
    const text = stripTags(html);
    const labs = new Set([...links.values()].map(l => l.lab).filter(Boolean));
    for (const [n, re] of LABS) if (re.test(text)) labs.add(n);
    const pm = text.match(/(?:purity|zuiverheid|reinheit|pureza)[^0-9]{0,25}(\d{2}(?:[.,]\d{1,3})?)\s?%/i) || text.match(/(\d{2}(?:[.,]\d{1,3})?)\s?%\s*(?:purity|pure|zuiver|hplc)/i);
    const purity = pm ? parseFloat(pm[1].replace(',', '.')) : null;
    return {
      links: [...links.values()].slice(0, 10), labs: [...labs], purity: purity && purity >= 50 && purity <= 100 ? purity : null,
      verifiable: [...links.keys()].some(u => /janoshik\.com\/tests|verify|verification/i.test(u)),
      mentions: COA_RE.test(text),
    };
  }
  const mergeCoa = (a, b) => ({
    links: [...new Map([...(a?.links || []), ...(b?.links || [])].map(l => [l.url, l])).values()].slice(0, 10),
    labs: [...new Set([...(a?.labs || []), ...(b?.labs || [])])],
    purity: a?.purity ?? b?.purity ?? null,
    verifiable: !!(a?.verifiable || b?.verifiable),
    mentions: !!(a?.mentions || b?.mentions),
  });

  // ---------- Valuta ----------
  async function loadRates() {
    if (Date.now() - ratesAt < 12 * 3600e3) return;
    try {
      const r = await get('https://api.frankfurter.app/latest?from=EUR', { timeout: 8000 });
      const d = await r.json();
      if (d.rates) { rates = { EUR: 1, ...d.rates }; ratesAt = Date.now(); }
    } catch { ratesAt = Date.now() - 11 * 3600e3; }
  }
  const toEur = (p, cur) => p == null ? null : Math.round(p / (rates[(cur || 'EUR').toUpperCase()] || 1) * 100) / 100;

  // ---------- Shops uitlezen ----------
  const log = msg => { job.log.push({ t: Date.now(), msg }); if (job.log.length > 200) job.log.shift(); };
  const getJson = async (url, timeout = 20000) => {
    const r = await get(url, { timeout });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const ct = r.headers.get('content-type') || '';
    const txt = await r.text();
    if (!ct.includes('json') && !/^\s*[\[{]/.test(txt)) throw new Error('Geen JSON');
    return JSON.parse(txt);
  };

  async function scanShopify(shop, origin) {
    let currency = 'EUR';
    try {
      const r = await get(origin + '/', { timeout: 15000 });
      const h = await readLimited(r, 400000);
      const m = h.match(/Shopify\.currency\s*=\s*\{"active":"([A-Z]{3})"/) || h.match(/"currency(?:Code)?"\s*:\s*"([A-Z]{3})"/);
      if (m) currency = m[1];
    } catch {}
    const offers = [];
    for (let page = 1; page <= 20; page++) {
      job.phase = `${shop.name}: producten ophalen (pagina ${page})…`;
      const d = await getJson(`${origin}/products.json?limit=250&page=${page}`);
      const prods = d.products || [];
      for (const p of prods) {
        const coa = findCoas(p.body_html || '', origin);
        for (const v of p.variants || []) {
          offers.push({
            productId: String(p.id), variantId: String(v.id), name: p.title, variant: v.title === 'Default Title' ? '' : v.title,
            url: `${origin}/products/${p.handle}${p.variants.length > 1 ? '?variant=' + v.id : ''}`, pageUrl: `${origin}/products/${p.handle}`,
            price: parseFloat(v.price), compareAt: v.compare_at_price ? parseFloat(v.compare_at_price) : null, currency,
            inStock: v.available !== false, coa, type: p.product_type || '',
          });
        }
      }
      if (prods.length < 250) break;
      await sleep(300);
    }
    return offers;
  }

  async function scanWoo(shop, origin) {
    const offers = [];
    const api = origin + '/wp-json/wc/store/v1/products';
    const price = pr => pr ? parseInt(pr.price) / Math.pow(10, pr.currency_minor_unit ?? 2) : null;
    for (let page = 1; page <= 30; page++) {
      job.phase = `${shop.name}: producten ophalen (pagina ${page})…`;
      const prods = await getJson(`${api}?per_page=100&page=${page}`);
      if (!Array.isArray(prods)) break;
      for (const p of prods) {
        const coa = findCoas((p.description || '') + (p.short_description || ''), origin);
        if (p.type === 'variable' && (p.variations || []).length) {
          let vars = [];
          try { vars = await getJson(`${api}?type=variation&parent=${p.id}&per_page=100`); } catch {}
          if (!Array.isArray(vars) || !vars.length) {
            // Varianten niet opvraagbaar: gebruik de prijsrange
            offers.push({ productId: String(p.id), variantId: String(p.id), name: decodeEntities(p.name), variant: '', url: p.permalink, pageUrl: p.permalink,
              price: price(p.prices), currency: p.prices?.currency_code || 'EUR', inStock: p.is_in_stock !== false, coa,
              attrs: (p.variations || []).map(v => (v.attributes || []).map(a => a.value).join(' ')).join(', ') });
            continue;
          }
          for (const v of vars) {
            const label = (v.variation || (v.attributes || []).map(a => a.value).join(' ') || decodeEntities(v.name).replace(decodeEntities(p.name), '')).replace(/^[\s,–-]+/, '');
            offers.push({ productId: String(p.id), variantId: String(v.id), name: decodeEntities(p.name), variant: decodeEntities(label), url: v.permalink || p.permalink, pageUrl: p.permalink,
              price: price(v.prices), compareAt: v.prices?.regular_price !== v.prices?.price ? price({ price: v.prices?.regular_price, currency_minor_unit: v.prices?.currency_minor_unit }) : null,
              currency: v.prices?.currency_code || p.prices?.currency_code || 'EUR', inStock: v.is_in_stock !== false, coa });
          }
          await sleep(120);
        } else {
          offers.push({ productId: String(p.id), variantId: String(p.id), name: decodeEntities(p.name), variant: '', url: p.permalink, pageUrl: p.permalink,
            price: price(p.prices), compareAt: p.prices?.regular_price !== p.prices?.price ? price({ price: p.prices?.regular_price, currency_minor_unit: p.prices?.currency_minor_unit }) : null,
            currency: p.prices?.currency_code || 'EUR', inStock: p.is_in_stock !== false, coa });
        }
      }
      if (prods.length < 100) break;
      await sleep(300);
    }
    return offers;
  }

  // Andere shops: productpagina's zoeken via sitemap of links, en JSON-LD / WooCommerce-variantdata uitlezen
  async function findProductUrls(origin) {
    const urls = new Set();
    const isProduct = u => /\/(product|products|produkt|produit|producto|shop|winkel|p)\/[^/?#]+/i.test(new URL(u).pathname) && !/\/(category|categorie|tag|page)\//i.test(u);
    const sitemaps = [origin + '/product-sitemap.xml', origin + '/wp-sitemap-posts-product-1.xml', origin + '/sitemap_products_1.xml', origin + '/sitemap_index.xml', origin + '/sitemap.xml'];
    const seenSm = new Set();
    while (sitemaps.length && seenSm.size < 12 && urls.size < 1500) {
      const sm = sitemaps.shift();
      if (seenSm.has(sm)) continue;
      seenSm.add(sm);
      try {
        const r = await get(sm, { timeout: 15000 });
        if (!r.ok) continue;
        const xml = await r.text();
        const locs = [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi)].map(m => decodeEntities(m[1]));
        if (/<sitemapindex/i.test(xml)) { for (const l of locs) if (/product/i.test(l)) sitemaps.unshift(l); }
        else for (const l of locs) { try { if (isProduct(l)) urls.add(l); } catch {} }
      } catch {}
      if (urls.size) break;
    }
    if (!urls.size) {
      // Links volgen vanaf de homepage en categoriepagina's
      const queue = [origin + '/'], seen = new Set(queue);
      let pages = 0;
      while (queue.length && pages < 40) {
        const u = queue.shift(); pages++;
        job.phase = `Productpagina's zoeken (${pages})…`;
        try {
          const r = await get(u, { timeout: 15000 });
          const html = await r.text();
          for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)/gi)) {
            try {
              const l = new URL(decodeEntities(m[1]), u); l.hash = '';
              if (l.origin !== origin) continue;
              if (isProduct(l.href)) urls.add(l.href);
              else if (!seen.has(l.href) && /shop|winkel|categor|collection|store|peptide|product/i.test(l.pathname) && queue.length < 200) { seen.add(l.href); queue.push(l.href); }
            } catch {}
          }
        } catch {}
        await sleep(150);
      }
    }
    return [...urls].slice(0, 600);
  }

  function parseProductPage(html, url) {
    const out = [];
    const coa = findCoas(html, url);
    const name0 = stripTags((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '') || stripTags((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '');
    // WooCommerce varianten
    const vm = html.match(/data-product_variations=["']([^"']+)["']/);
    if (vm) {
      try {
        const vars = JSON.parse(decodeEntities(vm[1]));
        const cur = (html.match(/"priceCurrency"\s*:\s*"([A-Z]{3})"/) || [])[1] || 'EUR';
        for (const v of vars) out.push({ productId: url, variantId: String(v.variation_id), name: name0, variant: Object.values(v.attributes || {}).join(' '), url, pageUrl: url,
          price: v.display_price, compareAt: v.display_regular_price !== v.display_price ? v.display_regular_price : null, currency: cur, inStock: v.is_in_stock !== false, coa });
        if (out.length) return out;
      } catch {}
    }
    // JSON-LD Product
    for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
      let data; try { data = JSON.parse(m[1].trim()); } catch { continue; }
      const items = [];
      const walk = o => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(walk); const t = [].concat(o['@type'] || []); if (t.includes('Product')) items.push(o); if (o['@graph']) walk(o['@graph']); if (o.hasVariant) walk(o.hasVariant); };
      walk(data);
      for (const p of items) {
        for (const o of [].concat(p.offers || [])) {
          const list = o['@type'] === 'AggregateOffer' && o.offers ? [].concat(o.offers) : [o];
          for (const x of list) {
            const pr = parseFloat(x.price ?? x.lowPrice ?? x.priceSpecification?.price);
            if (Number.isNaN(pr)) continue;
            out.push({ productId: url, variantId: url + '#' + out.length, name: decodeEntities(p.name || name0), variant: x.name && x.name !== p.name ? decodeEntities(x.name) : (o['@type'] === 'AggregateOffer' ? 'vanaf' : ''),
              url: x.url || url, pageUrl: url, price: pr, currency: x.priceCurrency || o.priceCurrency || 'EUR', inStock: !/OutOfStock|SoldOut/i.test(x.availability || ''), coa });
          }
        }
      }
      if (out.length) return out;
    }
    // Meta-tags (og/product:price)
    const pm = html.match(/<meta[^>]+(?:property|name)=["'](?:product|og):price:amount["'][^>]*content=["']([\d.,]+)/i);
    if (pm) {
      const cm = html.match(/<meta[^>]+(?:property|name)=["'](?:product|og):price:currency["'][^>]*content=["']([A-Z]{3})/i);
      out.push({ productId: url, variantId: url, name: name0, variant: '', url, pageUrl: url, price: parseFloat(pm[1].replace(',', '.')), currency: cm ? cm[1] : 'EUR', inStock: true, coa });
    }
    return out;
  }

  async function scanGeneric(shop, origin) {
    job.phase = `${shop.name}: productpagina's zoeken…`;
    const urls = await findProductUrls(origin);
    if (!urls.length) throw new Error('Geen productpagina\'s gevonden');
    const offers = [];
    let i = 0, n = 0;
    const worker = async () => {
      while (i < urls.length) {
        const u = urls[i++];
        try {
          const r = await get(u, { timeout: 20000 });
          if (r.ok) offers.push(...parseProductPage(await r.text(), r.url || u));
        } catch {}
        n++;
        job.phase = `${shop.name}: productpagina's lezen (${n}/${urls.length})…`;
        await sleep(150);
      }
    };
    await Promise.all(Array.from({ length: 3 }, worker));
    return offers;
  }

  // Aparte COA-pagina van de shop zoeken (bijv. /coa, /lab-results)
  async function scanShopCoaPages(origin) {
    const cands = ['/coa', '/coas', '/pages/coa', '/pages/coas', '/lab-results', '/pages/lab-results', '/lab-testing', '/pages/lab-testing', '/certificates', '/certificates-of-analysis', '/third-party-testing', '/pages/third-party-testing', '/testing', '/lab-reports', '/analyses', '/certificaten'];
    try {
      const r = await get(origin + '/', { timeout: 15000 });
      const html = await r.text();
      for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
        if (COA_RE.test(stripTags(m[2])) || /\/(coa|lab|certific|test)/i.test(m[1])) { try { const u = new URL(decodeEntities(m[1]), origin); if (u.origin === origin) cands.unshift(u.pathname); } catch {} }
      }
    } catch {}
    const pages = [];
    const seen = new Set();
    for (const p of [...new Set(cands)].slice(0, 20)) {
      try {
        const r = await get(origin + p, { timeout: 12000 });
        if (!r.ok || seen.has(r.url)) continue;
        seen.add(r.url);
        const html = await r.text();
        const c = findCoas(html, r.url);
        if (c.links.length) pages.push({ url: r.url, coa: c });
      } catch {}
    }
    return pages;
  }

  function enrich(o, shop) {
    const text = `${o.name} ${o.variant || ''}`;
    const peps = identify(o.name).length ? identify(o.name) : identify(text);
    const dose = parseDose(o.variant, o.name, o.attrs);
    const totalMg = dose.mg ? Math.round(dose.mg * dose.count * 1000) / 1000 : null;
    const priceEur = toEur(o.price, o.currency);
    return {
      ...o, shopId: shop.id, shop: shop.name, peptides: peps, peptide: peps.length ? peps.join(' + ') : null,
      mg: dose.mg, iu: dose.iu, count: dose.count, totalMg, priceEur,
      perMg: totalMg && priceEur ? Math.round(priceEur / totalMg * 1000) / 1000 : null,
      key: `${shop.id}|${o.variantId}`,
    };
  }

  async function scanShop(shop) {
    const origin = new URL(shop.url).origin;
    const t0 = Date.now();
    log(`▶ ${shop.name} scannen…`);
    await loadRates();
    let offers = [], platform = '';
    try {
      job.phase = `${shop.name}: platform herkennen…`;
      try { offers = await scanShopify(shop, origin); platform = 'Shopify'; } catch {}
      if (!offers.length) { try { offers = await scanWoo(shop, origin); platform = 'WooCommerce'; } catch {} }
      if (!offers.length) { offers = await scanGeneric(shop, origin); platform = 'Overig'; }
    } catch (e) {
      shop.lastError = errText(e);
      shop.lastScan = Date.now();
      log(`✖ ${shop.name}: ${shop.lastError}`);
      saveShops();
      return;
    }
    offers = offers.filter(o => o.price != null && !Number.isNaN(o.price));

    // Productpagina's openen voor COA's (als de beschrijving er geen had)
    const pages = [...new Set(offers.filter(o => !o.coa?.links?.length && platform !== 'Overig').map(o => o.pageUrl))].slice(0, 250);
    let n = 0, pi = 0;
    const pageCoa = new Map();
    const worker = async () => {
      while (pi < pages.length) {
        const u = pages[pi++];
        try { const r = await get(u, { timeout: 15000 }); if (r.ok) pageCoa.set(u, findCoas(await r.text(), u)); } catch {}
        n++;
        job.phase = `${shop.name}: COA's zoeken op productpagina's (${n}/${pages.length})…`;
        await sleep(150);
      }
    };
    if (shop.deepCoa !== false) await Promise.all(Array.from({ length: 3 }, worker));
    for (const o of offers) if (pageCoa.has(o.pageUrl)) o.coa = mergeCoa(o.coa, pageCoa.get(o.pageUrl));

    job.phase = `${shop.name}: COA-pagina zoeken…`;
    const coaPages = await scanShopCoaPages(origin);
    let enriched = offers.map(o => enrich(o, shop));
    // Links van een algemene COA-pagina koppelen aan producten met dezelfde peptide
    for (const cp of coaPages) for (const l of cp.coa.links) {
      const peps = identify(l.label + ' ' + decodeURIComponent(l.url));
      if (!peps.length) continue;
      for (const o of enriched) if (o.peptide && peps.some(p => o.peptides.includes(p)) && !(o.coa?.links || []).some(x => x.url === l.url)) {
        o.coa = mergeCoa(o.coa, { links: [{ ...l, viaPage: cp.url }], labs: l.lab ? [l.lab] : [], verifiable: /janoshik\.com\/tests|verify/i.test(l.url) });
      }
    }

    // Prijsgeschiedenis en veranderingen
    const hist = load('pw-history.json', {});
    const changes = load('pw-changes.json', []);
    const now = Date.now();
    for (const o of enriched) {
      const h = hist[o.key] || (hist[o.key] = []);
      const last = h[h.length - 1];
      if (last && last.p !== o.price) {
        changes.unshift({ t: now, key: o.key, shop: shop.name, shopId: shop.id, name: o.name, variant: o.variant, url: o.url, peptide: o.peptide, old: last.p, new: o.price, currency: o.currency });
      }
      if (!last || last.p !== o.price || now - last.t > 20 * 3600e3) h.push({ t: now, p: o.price, s: o.inStock ? 1 : 0 });
      if (h.length > 120) h.splice(0, h.length - 120);
      o.history = h.slice(-30);
      o.lowest = Math.min(...h.map(x => x.p));
    }
    const prevKeys = new Set((load(`pw-offers-${shop.id}.json`, [])).map(o => o.key));
    const newOnes = enriched.filter(o => prevKeys.size && !prevKeys.has(o.key));
    for (const o of newOnes) changes.unshift({ t: now, key: o.key, shop: shop.name, shopId: shop.id, name: o.name, variant: o.variant, url: o.url, peptide: o.peptide, new: o.price, currency: o.currency, isNew: true });
    save('pw-history.json', hist);
    save('pw-changes.json', changes.slice(0, 500));
    save(`pw-offers-${shop.id}.json`, enriched);

    Object.assign(shop, {
      platform, lastScan: now, lastError: '', products: new Set(enriched.map(o => o.productId)).size, offers: enriched.length,
      withCoa: enriched.filter(o => o.coa?.links?.length).length, coaPages: coaPages.map(c => c.url), durationMs: now - t0,
    });
    saveShops();
    log(`✔ ${shop.name}: ${enriched.length} prijzen (${platform}), ${shop.withCoa} met COA`);
  }

  function saveShops() { save('pw-shops.json', shops); }

  async function runQueue() {
    if (job.running) return;
    job.running = true;
    job.total = job.queue.length; job.done = 0;
    while (job.queue.length) {
      const id = job.queue.shift();
      const shop = shops.find(s => s.id === id);
      if (!shop) continue;
      job.current = shop.name;
      try { await scanShop(shop); } catch (e) { log(`✖ ${shop.name}: ${e.message}`); }
      job.done++;
    }
    job.running = false; job.current = null; job.phase = '';
  }
  function enqueue(ids) {
    for (const id of ids) if (!job.queue.includes(id)) job.queue.push(id);
    if (job.running) job.total = job.done + job.queue.length + 1;
    runQueue();
  }

  // Automatisch scannen
  setInterval(() => {
    if (settings.autoHours > 0 && !job.running && Date.now() - (settings.lastAuto || 0) > settings.autoHours * 3600e3) {
      settings.lastAuto = Date.now(); save('pw-settings.json', settings);
      log('⏰ Automatische scan gestart');
      enqueue(shops.map(s => s.id));
    }
  }, 60e3);

  // ---------- API ----------
  const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  async function body(req) { let b = ''; for await (const c of req) { b += c; if (b.length > 1e6) break; } try { return JSON.parse(b || '{}'); } catch { return {}; } }

  return async function handle(req, res, url) {
    const p = url.pathname.replace('/api/pw', '');
    if (p === '/state') {
      const offers = shops.flatMap(s => load(`pw-offers-${s.id}.json`, []));
      return json(res, 200, { shops, offers, settings, job: { ...job, log: job.log.slice(-30) }, changes: load('pw-changes.json', []).slice(0, 200), rates, ratesAt });
    }
    if (p === '/job') return json(res, 200, { ...job, log: job.log.slice(-30) });
    if (p === '/shops' && req.method === 'POST') {
      const b = await body(req);
      const added = [];
      for (let raw of String(b.url || '').split(/[\s,]+/).filter(Boolean)) {
        if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
        let u; try { u = new URL(raw); } catch { continue; }
        if (shops.some(s => new URL(s.url).host.replace(/^www\./, '') === u.host.replace(/^www\./, ''))) continue;
        const shop = { id: crypto.randomBytes(4).toString('hex'), url: u.origin, name: u.host.replace(/^www\./, ''), added: Date.now() };
        shops.push(shop); added.push(shop);
      }
      saveShops();
      if (added.length) enqueue(added.map(s => s.id));
      return json(res, 200, { added });
    }
    const dm = p.match(/^\/shops\/([0-9a-f]+)$/);
    if (dm && req.method === 'DELETE') {
      shops = shops.filter(s => s.id !== dm[1]); saveShops();
      try { fs.unlinkSync(file(`pw-offers-${dm[1]}.json`)); } catch {}
      return json(res, 200, { ok: true });
    }
    if (p === '/scan' && req.method === 'POST') {
      const b = await body(req);
      enqueue(b.id ? [b.id] : shops.map(s => s.id));
      return json(res, 200, { ok: true });
    }
    if (p === '/settings' && req.method === 'POST') {
      const b = await body(req);
      settings.autoHours = Math.max(0, Math.min(168, parseInt(b.autoHours) || 0));
      settings.lastAuto = Date.now();
      save('pw-settings.json', settings);
      return json(res, 200, settings);
    }
    return json(res, 404, { error: 'Onbekend' });
  };
};
