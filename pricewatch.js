// Ghost Prijsvolger / Ghost Price Tracker
// Vergelijkt prijzen en COA's van peptide-webshops, per regio (nl = Nederland/EU in euro, us = Verenigde Staten in dollar).
// Leest Shopify (products.json), WooCommerce (Store API) en andere shops (JSON-LD / productpagina's).
// Kan zelf shops vinden via zoekmachines (Brave Search API, Bing en DuckDuckGo).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REGIONS = {
  nl: {
    label: 'Nederland', currency: 'EUR', lang: 'nl', bingCc: 'NL', bingLang: 'nl', ddg: 'nl-nl', brave: 'NL',
    queries: ['peptiden kopen', 'peptides kopen', 'research peptides kopen', 'peptide webshop nederland', 'peptides kopen nederland', 'peptiden webshop',
      'bpc-157 kopen', 'tb-500 kopen', 'bpc 157 tb 500 kopen', 'retatrutide kopen', 'tirzepatide peptide kopen', 'semaglutide peptide kopen', 'ghk-cu kopen',
      'ipamorelin kopen', 'cjc-1295 kopen', 'mots-c kopen', 'epitalon kopen', 'melanotan 2 kopen', 'pt-141 kopen', 'nad+ peptide kopen',
      'peptides bestellen ideal', 'research peptides belgië', 'peptides kopen europa', 'buy research peptides netherlands', 'peptide shop europe', 'research peptides eu shop',
      'buy peptides europe', 'research peptides europe shipping', 'buy bpc-157 europe', 'buy retatrutide europe', 'buy tirzepatide peptide europe', 'peptides eu warehouse',
      'research peptides euro prices', 'buy peptides netherlands', 'peptide shop belgium', 'research peptides germany', 'peptide kaufen', 'peptide kaufen deutschland',
      'bpc 157 kaufen', 'forschungspeptide kaufen', 'retatrutide kaufen', 'peptides acheter europe', 'peptide vendor europe janoshik', 'eu peptide vendor third party tested'],
    fit(sig) {
      let s = 0; const r = [];
      if (/\.(nl|be)$/.test(sig.host)) { s += 3; r.push('.' + sig.host.split('.').pop() + '-domein'); }
      if (/\.(eu|de|fr|es|it|at|pl|cz|dk|se|fi|pt|ie)$/.test(sig.host)) { s += 1; r.push('Europees domein'); }
      if (sig.currency === 'EUR') { s += 3; r.push('prijzen in euro'); }
      if (/^nl/i.test(sig.lang)) { s += 2; r.push('Nederlandstalig'); }
      if (/ideal|bancontact|postnl|nederland|belgi[eë]|verzending|bezorging|winkelwagen|afrekenen/i.test(sig.text)) { s += 1; r.push('NL-kenmerken'); }
      if (/ships? (to|within) (the )?(netherlands|europe|eu)|shipping (to|within) (the )?(eu|europe)|eu warehouse|europe(an)? warehouse|ships from (the )?(eu|europe|netherlands)/i.test(sig.text)) { s += 2; r.push('verzendt in Europa'); }
      if (sig.currency === 'USD' && !/europ|\beu\b|netherlands/i.test(sig.text)) { s -= 3; r.push('dollarprijzen'); }
      if (sig.currency === 'GBP') s -= 1;
      return { score: s, ok: s >= 3, reasons: r };
    },
  },
  us: {
    label: 'United States', currency: 'USD', lang: 'en', bingCc: 'US', bingLang: 'en', ddg: 'us-en', brave: 'US',
    queries: ['buy research peptides usa', 'research peptides for sale usa', 'peptide shop usa', 'buy peptides online usa', 'research peptides made in usa',
      'buy bpc-157 usa', 'buy tb-500 research peptide', 'bpc-157 tb-500 blend for sale', 'retatrutide research peptide for sale', 'tirzepatide research peptide buy',
      'semaglutide research peptide buy', 'buy ghk-cu peptide', 'ipamorelin cjc-1295 buy', 'mots-c peptide for sale', 'epitalon peptide buy', 'nad+ peptide buy usa',
      'peptide vendor janoshik tested', 'best research peptide vendors usa', 'third party tested peptides usa', 'lab tested research peptides usa shop',
      'research peptides fast shipping usa', 'peptides ships from usa', 'cagrilintide research peptide', 'tesamorelin peptide for sale', 'pt-141 peptide buy usa'],
    fit(sig) {
      let s = 0; const r = [];
      if (sig.currency === 'USD') { s += 3; r.push('USD prices'); }
      if (/\.(com|us|net|org|shop|store|co|io|bio|health|xyz)$/.test(sig.host)) { s += 1; }
      if (/\.us$/.test(sig.host)) { s += 1; r.push('.us domain'); }
      if (/^en/i.test(sig.lang) || !sig.lang) { s += 1; r.push('English'); }
      if (/usa|united states|ships? (from|within) (the )?(us|usa|united states)|domestic shipping|usps|ups ground|fedex|zelle|cash ?app|venmo|made in (the )?usa/i.test(sig.text)) { s += 2; r.push('US signals'); }
      if (/\.(co\.uk|uk|ca|com\.au|au|nz|nl|be|de|fr|es|it|eu)$/.test(sig.host)) { s -= 3; r.push('foreign domain'); }
      if (sig.currency && !['USD'].includes(sig.currency)) { s -= 3; r.push(sig.currency + ' prices'); }
      return { score: s, ok: s >= 3, reasons: r };
    },
  },
};

// Domeinen die geen webshop zijn (social media, nieuws, wiki, marktplaatsen…)
const NOT_SHOP = /(^|\.)(reddit|youtube|youtu|facebook|meta|instagram|tiktok|twitter|x|wikipedia|wikimedia|amazon|ebay|bol|marktplaats|aliexpress|alibaba|temu|etsy|walmart|pubmed|ncbi|nih|sciencedirect|springer|frontiersin|mdpi|researchgate|healthline|webmd|mayoclinic|medicalnewstoday|examine|verywellhealth|clevelandclinic|drugs|rxlist|medium|quora|trustpilot|google|bing|duckduckgo|linkedin|pinterest|tumblr|substack|wordpress|blogspot|github|fda|europa|rivm|thuisarts|nu|nos|ad|telegraaf|volkskrant|nytimes|cnn|bbc|forbes|businessinsider|vice|apple|spotify|podcasts|goodrx|hims|ro|everlywell|sciencedaily|newsweek|statnews|wired|theguardian|independent|dailymail|nypost|yahoo|msn|t|discord|whatsapp|telegram)\.[a-z.]+$|\.gov(\.[a-z]+)?$|\.edu$|\.mil$/i;

module.exports = function createPriceWatch({ get, readLimited, decodeEntities, stripTags, getAttr, errText, dir, region }) {
  const R = REGIONS[region];
  const BASE = R.currency;
  const DATA = path.join(dir, 'data', region);
  const file = n => path.join(DATA, n);
  const load = (n, d) => { try { return JSON.parse(fs.readFileSync(file(n), 'utf8')); } catch { return d; } };
  const save = (n, v) => { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(file(n), JSON.stringify(v)); };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  let shops = load('shops.json', []);
  let settings = Object.assign({ autoHours: 0, lastAuto: 0, autoDiscoverDays: 0, lastDiscover: 0, autoAdd: true, braveKey: '', extraQueries: [], alerts: [] }, load('settings.json', {}));
  let discovered = load('discovered.json', []);
  let job = { running: false, queue: [], current: null, phase: '', done: 0, total: 0, log: [] };
  let rates = { EUR: 1, USD: 1.08, GBP: 0.85, CAD: 1.48, AUD: 1.65, CHF: 0.95, SEK: 11.4, NOK: 11.6, DKK: 7.46, PLN: 4.3, CZK: 25, HUF: 395, RON: 4.97 };
  let ratesAt = 0;
  const L = (nl, en) => region === 'nl' ? nl : en;

  // ---------- Peptiden herkennen ----------
  const PEPTIDES = [
    ['BPC-157', /bpc[\s-]?157/i], ['TB-500', /tb[\s-]?500|thymosin[\s-]?beta|\btb[\s-]?4\b/i],
    ['Semaglutide', /semaglutide|\bsema\b|glp[\s-]?1[\s-]?s\b|\bbig[\s-]?s\b/i], ['Tirzepatide', /tirzepatide|\btirz(e|ep)?\b|glp[\s-]?2[\s-]?t\b|\bbig[\s-]?t\b|ly[\s-]?3298176/i],
    ['Retatrutide', /retatrutide|\breta\b|glp[\s-]?3[\s-]?r?\b|\bbig[\s-]?r\b|ly[\s-]?3437943/i], ['Cagrilintide', /cagrilintide|\bcagri\b/i], ['Survodutide', /survodutide|bi[\s-]?456906/i],
    ['Mazdutide', /mazdutide|ly[\s-]?3305677|ibi[\s-]?362/i], ['Liraglutide', /liraglutide/i], ['Dulaglutide', /dulaglutide/i], ['Exenatide', /exenatide|exendin[\s-]?4/i],
    ['Lixisenatide', /lixisenatide/i], ['Pramlintide', /pramlintide/i], ['Amycretin', /amycretin/i], ['Pemvidutide', /pemvidutide/i], ['Ecnoglutide', /ecnoglutide/i],
    ['Efinopegdutide', /efinopegdutide/i], ['Orforglipron', /orforglipron/i], ['Maridebart cafraglutide', /maridebart|maritide/i], ['Teduglutide', /teduglutide/i],
    ['Glepaglutide', /glepaglutide/i], ['Apraglutide', /apraglutide/i], ['Dapiglutide', /dapiglutide/i], ['Cotadutide', /cotadutide/i], ['5-Amino-1MQ', /5[\s-]?amino[\s-]?1[\s-]?mq/i],
    ['SLU-PP-332', /slu[\s-]?pp[\s-]?332/i], ['Ipamorelin', /ipamorelin/i], ['CJC-1295', /cjc[\s-]?1295/i],
    ['Sermorelin', /sermorelin/i], ['Tesamorelin', /tesamorelin/i], ['GHRP-2', /ghrp[\s-]?2/i], ['GHRP-6', /ghrp[\s-]?6/i], ['Hexarelin', /hexarelin/i],
    ['GHK-Cu', /ghk[\s-]?cu|copper[\s-]?peptide/i], ['AHK-Cu', /ahk[\s-]?cu/i], ['MOTS-c', /mots[\s-]?c/i], ['SS-31', /ss[\s-]?31|elamipretide/i],
    ['Epitalon', /epitalon|epithalon/i], ['Selank', /selank/i], ['Semax', /semax/i], ['PT-141', /pt[\s-]?141|bremelanotide/i],
    ['Melanotan II', /melanotan[\s-]?(2|ii)\b|\bmt[\s-]?(2|ii)\b/i], ['Melanotan I', /melanotan[\s-]?(1|i)\b|\bmt[\s-]?(1|i)\b/i],
    ['NAD+', /\bnad\b|nad\+/i], ['AOD-9604', /aod[\s-]?9604/i], ['HGH Fragment 176-191', /frag(ment)?[\s-]?176|176[\s-]?191/i],
    ['IGF-1 LR3', /igf[\s-]?1/i], ['KPV', /\bkpv\b/i], ['LL-37', /\bll[\s-]?37\b/i], ['DSIP', /\bdsip\b/i], ['Kisspeptin', /kisspeptin/i],
    ['Oxytocin', /oxytocin/i], ['Thymosin Alpha-1', /thymosin[\s-]?alpha|\bta[\s-]?1\b/i], ['Thymalin', /thymalin/i], ['Humanin', /humanin/i],
    ['Dihexa', /dihexa/i], ['Pinealon', /pinealon/i], ['Gonadorelin', /gonadorelin/i], ['HCG', /\bhcg\b/i], ['Follistatin', /follistatin/i],
    ['MGF / PEG-MGF', /\bmgf\b/i], ['Snap-8', /snap[\s-]?8/i], ['Cerebrolysin', /cerebrolysin/i], ['VIP', /\bvip\b/i], ['Glutathione', /glutathione/i],
    ['Bacteriostatic water', /bac(teriostatic|teriostatisch)?[\s-]?water|\bbac\s?h2o\b/i],
  ];
  // Merk- en blendnamen die shops gebruiken, vertaald naar de echte stoffen
  const BLENDS = [
    [/cagri[\s-]?sema/i, ['Cagrilintide', 'Semaglutide']],
    [/\bklow\b/i, ['BPC-157', 'TB-500', 'GHK-Cu', 'KPV']],
    [/\bglow\b/i, ['BPC-157', 'TB-500', 'GHK-Cu']],
    [/wolverine/i, ['BPC-157', 'TB-500']],
  ];
  function identify(text) {
    const found = PEPTIDES.filter(([, re]) => re.test(text)).map(([n]) => n);
    for (const [re, names] of BLENDS) if (re.test(text)) for (const n of names) if (!found.includes(n)) found.push(n);
    return found.filter(n => !(n === 'Melanotan I' && found.includes('Melanotan II')));
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
      const cm = t.match(/(\d+)\s?(?:x|×)\s?\d/i) || t.match(/(\d+)\s?(?:vials?|flesjes?|flacons?|pcs|stuks|ampullen|ampoules|bottles?)\b/i) || t.match(/(?:kit|box|pack|set)\s?(?:of\s)?(\d+)/i);
      const count = cm ? Math.min(100, parseInt(cm[1])) : 1;
      return { mg: mg || null, iu: iu || null, count };
    }
    return { mg: null, iu: null, count: 1 };
  }
  const doseLabel = o => o.mg ? (o.count > 1 ? `${o.count}× ` : '') + (o.mg < 1 ? Math.round(o.mg * 1000) + ' mcg' : +o.mg.toFixed(3) + ' mg') : o.iu ? o.iu + ' IU' : '';

  // ---------- COA's herkennen ----------
  const COA_RE = /\bcoa\b|c\.o\.a|certificate[\s-]?of[\s-]?analysis|analysecertificaat|certificaat|lab[\s-]?(test|result|report|rapport|uitslag)|third[\s-]?party|janoshik|hplc|mass[\s-]?spec|\bms[\s-]?report|purity[\s-]?(test|report)/i;
  const LABS = [['Janoshik', /janoshik/i], ['Chromate', /chromate/i], ['Freedom Diagnostics', /freedom[\s-]?diagnostics/i], ['MZ Biolabs', /mz[\s-]?bio/i],
    ['Vanguard Laboratory', /vanguard/i], ['Colmaric', /colmaric/i], ['Eurofins', /eurofins/i], ['SGS', /\bsgs\b/i], ['Intertek', /intertek/i], ['ACS Lab', /acs[\s-]?lab/i],
    ['Analytical Solutions', /analytical[\s-]?solutions/i], ['TrustPointe', /trustpointe/i], ['Peptide Test', /peptidetest/i]];
  function findCoas(html, base) {
    if (!html) return { links: [], labs: [], purity: null, verifiable: false, mentions: false };
    const links = new Map();
    const add = (u, label) => {
      try {
        const url = new URL(decodeEntities(u), base).href;
        if (!/^https?:/.test(url) || links.has(url)) return;
        links.set(url, { url, label: (label || '').replace(/\s+/g, ' ').slice(0, 80), lab: (LABS.find(([, re]) => re.test(url + ' ' + label)) || [])[0] || '' });
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
      if (src && !src.startsWith('data:') && (COA_RE.test(alt) || /coa|certificate|janoshik|lab[-_]?test|hplc/i.test(src))) add(src, alt.trim() || 'COA image');
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

  // ---------- Shopinformatie (betaalmethodes, verzending, land) ----------
  function shopInfo(html, origin) {
    const text = stripTags(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' '));
    const all = text + ' ' + html;
    const pay = [['iDEAL', /ideal/i], ['Bancontact', /bancontact/i], ['Creditcard', /visa|mastercard|credit ?card|amex|american express/i], ['PayPal', /paypal/i],
      ['Apple Pay', /apple ?pay/i], ['Google Pay', /google ?pay/i], ['Klarna', /klarna/i], ['Crypto', /crypto|bitcoin|\bbtc\b|\busdt\b|ethereum|litecoin|coinbase commerce|nowpayments/i],
      ['Zelle', /zelle/i], ['Cash App', /cash ?app/i], ['Venmo', /venmo/i], ['Bank transfer', /bank ?transfer|overboeking|wire transfer|\bach\b|sepa/i], ['Stripe', /stripe/i]]
      .filter(([, re]) => re.test(all)).map(([n]) => n);
    const fs1 = text.match(/(free (?:us |domestic )?shipping|gratis verzend(?:ing|en)|free delivery|gratis bezorg(?:ing|d))[^.]{0,40}?(?:over|vanaf|boven|from|above|orders over|on orders over|bij)\s*([€$£]\s?\d[\d.,]*|\d[\d.,]*\s?(?:€|eur|euro|usd|\$))/i);
    const from = text.match(/(?:ships?|shipped|shipping|verzonden|verzending|verzenden)\s(?:from|out of|vanuit|uit)\s(?:the\s|our\s)?(usa|us|united states|eu|europe|europa|netherlands|nederland|china|hong kong|uk|united kingdom|canada|germany|duitsland|belgi[eë]|poland|polen|spain|spanje)\b/i);
    const disc = text.match(/(\d{1,2})\s?%\s?(?:off|korting|discount)/i);
    const email = (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0] || '';
    return {
      payments: pay, freeShipping: fs1 ? fs1[2].trim().replace(/[.,]+$/, '') : '', shipsFrom: from ? from[1] : '', discount: disc ? disc[1] + '%' : '',
      email: /\.(png|jpe?g|webp|svg)$/i.test(email) ? '' : email, trustpilot: /trustpilot/i.test(html), telegram: /t\.me\//i.test(html),
      ruo: /research (use|purposes) only|not for human (consumption|use)|niet voor menselijke consumptie|alleen voor onderzoek/i.test(text),
    };
  }

  function signals(html, url, currencyHint) {
    const host = new URL(url).host.replace(/^www\./, '');
    const lang = ((html.match(/<html[^>]*\slang=["']?([a-z-]+)/i) || [])[1] || '').toLowerCase();
    let currency = currencyHint || (html.match(/Shopify\.currency\s*=\s*\{"active":"([A-Z]{3})"/) || [])[1] || (html.match(/"priceCurrency"\s*:\s*"([A-Z]{3})"/) || [])[1] || (html.match(/woocommerce-Price-currencySymbol">([^<]+)</) || [])[1];
    if (currency && currency.length !== 3) currency = /€|&euro;/.test(currency) ? 'EUR' : /\$|&#36;/.test(currency) ? 'USD' : /£|&pound;/.test(currency) ? 'GBP' : '';
    if (!currency) {
      const e = (html.match(/€\s?\d|\d\s?€|&euro;/g) || []).length, d = (html.match(/\$\s?\d|&#36;\s?\d/g) || []).length, p = (html.match(/£\s?\d|&pound;/g) || []).length;
      currency = e > d && e > p ? 'EUR' : d > e && d > p ? 'USD' : p > 0 ? 'GBP' : '';
    }
    return { host, lang, currency, text: stripTags(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')).slice(0, 60000) };
  }

  // ---------- Valuta ----------
  async function loadRates() {
    if (Date.now() - ratesAt < 12 * 3600e3) return;
    try {
      const r = await get('https://api.frankfurter.app/latest?from=EUR', { timeout: 8000 });
      const d = await r.json();
      if (d.rates) { rates = { EUR: 1, ...d.rates }; ratesAt = Date.now(); }
    } catch { ratesAt = Date.now() - 11 * 3600e3; }
  }
  const toBase = (p, cur) => {
    if (p == null) return null;
    const eur = p / (rates[(cur || BASE).toUpperCase()] || 1);
    return Math.round(eur * (rates[BASE] || 1) * 100) / 100;
  };

  // ---------- Logboek en JSON ----------
  const log = msg => { job.log.push({ t: Date.now(), msg }); if (job.log.length > 300) job.log.shift(); };
  const getJson = async (url, timeout = 20000) => {
    const r = await get(url, { timeout });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const ct = r.headers.get('content-type') || '';
    const txt = await r.text();
    if (!ct.includes('json') && !/^\s*[\[{]/.test(txt)) throw new Error('No JSON');
    return JSON.parse(txt);
  };

  // ---------- Shops uitlezen ----------
  async function scanShopify(shop, origin, homeHtml) {
    const currency = (homeHtml.match(/Shopify\.currency\s*=\s*\{"active":"([A-Z]{3})"/) || [])[1] || (homeHtml.match(/"currency(?:Code)?"\s*:\s*"([A-Z]{3})"/) || [])[1] || BASE;
    const offers = [];
    for (let page = 1; page <= 20; page++) {
      job.phase = `${shop.name}: ${L('producten ophalen', 'fetching products')} (${page})…`;
      const d = await getJson(`${origin}/products.json?limit=250&page=${page}`);
      const prods = d.products || [];
      for (const p of prods) {
        const coa = findCoas(p.body_html || '', origin);
        for (const v of p.variants || []) {
          offers.push({
            productId: String(p.id), variantId: String(v.id), name: p.title, variant: v.title === 'Default Title' ? '' : v.title,
            url: `${origin}/products/${p.handle}${p.variants.length > 1 ? '?variant=' + v.id : ''}`, pageUrl: `${origin}/products/${p.handle}`,
            price: parseFloat(v.price), compareAt: v.compare_at_price ? parseFloat(v.compare_at_price) : null, currency,
            inStock: v.available !== false, coa, image: p.images?.[0]?.src || '',
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
    const price = pr => pr && pr.price != null && pr.price !== '' ? parseInt(pr.price) / Math.pow(10, pr.currency_minor_unit ?? 2) : null;
    for (let page = 1; page <= 30; page++) {
      job.phase = `${shop.name}: ${L('producten ophalen', 'fetching products')} (${page})…`;
      const prods = await getJson(`${api}?per_page=100&page=${page}`);
      if (!Array.isArray(prods)) break;
      for (const p of prods) {
        const coa = findCoas((p.description || '') + (p.short_description || ''), origin);
        const img = p.images?.[0]?.src || '';
        if (p.type === 'variable' && (p.variations || []).length) {
          let vars = [];
          try { vars = await getJson(`${api}?type=variation&parent=${p.id}&per_page=100`); } catch {}
          if (!Array.isArray(vars) || !vars.length) {
            offers.push({ productId: String(p.id), variantId: String(p.id), name: decodeEntities(p.name), variant: L('vanaf', 'from'), url: p.permalink, pageUrl: p.permalink,
              price: price(p.prices), currency: p.prices?.currency_code || BASE, inStock: p.is_in_stock !== false, coa, image: img,
              attrs: (p.variations || []).map(v => (v.attributes || []).map(a => a.value).join(' ')).join(', ') });
            continue;
          }
          for (const v of vars) {
            const label = (v.variation || (v.attributes || []).map(a => a.value).join(' ') || decodeEntities(v.name).replace(decodeEntities(p.name), '')).replace(/^[\s,–-]+/, '');
            const reg = v.prices?.regular_price !== v.prices?.price ? price({ price: v.prices?.regular_price, currency_minor_unit: v.prices?.currency_minor_unit }) : null;
            offers.push({ productId: String(p.id), variantId: String(v.id), name: decodeEntities(p.name), variant: decodeEntities(label), url: v.permalink || p.permalink, pageUrl: p.permalink,
              price: price(v.prices), compareAt: reg, currency: v.prices?.currency_code || p.prices?.currency_code || BASE, inStock: v.is_in_stock !== false, coa, image: img });
          }
          await sleep(120);
        } else {
          const reg = p.prices?.regular_price !== p.prices?.price ? price({ price: p.prices?.regular_price, currency_minor_unit: p.prices?.currency_minor_unit }) : null;
          offers.push({ productId: String(p.id), variantId: String(p.id), name: decodeEntities(p.name), variant: '', url: p.permalink, pageUrl: p.permalink,
            price: price(p.prices), compareAt: reg, currency: p.prices?.currency_code || BASE, inStock: p.is_in_stock !== false, coa, image: img });
        }
      }
      if (prods.length < 100) break;
      await sleep(300);
    }
    return offers;
  }

  async function findProductUrls(origin) {
    const urls = new Set();
    const isProduct = u => /\/(product|products|produkt|produit|producto|shop|winkel|p|item)\/[^/?#]+/i.test(new URL(u).pathname) && !/\/(category|categorie|product-category|tag|page|collections?)\/?/i.test(new URL(u).pathname.replace(/\/products\//, '/x/'));
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
      const queue = [origin + '/'], seen = new Set(queue);
      let pages = 0;
      while (queue.length && pages < 40) {
        const u = queue.shift(); pages++;
        job.phase = `${L('Productpagina\'s zoeken', 'Finding product pages')} (${pages})…`;
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
    const img = (html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)/i) || [])[1] || '';
    const vm = html.match(/data-product_variations=["']([^"']+)["']/);
    if (vm) {
      try {
        const vars = JSON.parse(decodeEntities(vm[1]));
        const cur = signals(html, url).currency || BASE;
        for (const v of vars) out.push({ productId: url, variantId: String(v.variation_id), name: name0, variant: Object.values(v.attributes || {}).join(' '), url, pageUrl: url,
          price: v.display_price, compareAt: v.display_regular_price !== v.display_price ? v.display_regular_price : null, currency: cur, inStock: v.is_in_stock !== false, coa, image: img });
        if (out.length) return out;
      } catch {}
    }
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
            out.push({ productId: url, variantId: url + '#' + out.length, name: decodeEntities(p.name || name0), variant: x.name && x.name !== p.name ? decodeEntities(x.name) : (o['@type'] === 'AggregateOffer' ? L('vanaf', 'from') : ''),
              url: x.url || url, pageUrl: url, price: pr, currency: x.priceCurrency || o.priceCurrency || BASE, inStock: !/OutOfStock|SoldOut/i.test(x.availability || ''), coa, image: img });
          }
        }
      }
      if (out.length) return out;
    }
    const pm = html.match(/<meta[^>]+(?:property|name)=["'](?:product|og):price:amount["'][^>]*content=["']([\d.,]+)/i);
    if (pm) {
      const cm = html.match(/<meta[^>]+(?:property|name)=["'](?:product|og):price:currency["'][^>]*content=["']([A-Z]{3})/i);
      out.push({ productId: url, variantId: url, name: name0, variant: '', url, pageUrl: url, price: parseFloat(pm[1].replace(',', '.')), currency: cm ? cm[1] : BASE, inStock: true, coa, image: img });
    }
    return out;
  }

  async function scanGeneric(shop, origin) {
    job.phase = `${shop.name}: ${L('productpagina\'s zoeken', 'finding product pages')}…`;
    const urls = await findProductUrls(origin);
    if (!urls.length) throw new Error(L('Geen productpagina\'s gevonden', 'No product pages found'));
    const offers = [];
    let i = 0, n = 0;
    const worker = async () => {
      while (i < urls.length) {
        const u = urls[i++];
        try { const r = await get(u, { timeout: 20000 }); if (r.ok) offers.push(...parseProductPage(await r.text(), r.url || u)); } catch {}
        n++;
        job.phase = `${shop.name}: ${L('productpagina\'s lezen', 'reading product pages')} (${n}/${urls.length})…`;
        await sleep(150);
      }
    };
    await Promise.all(Array.from({ length: 3 }, worker));
    return offers;
  }

  async function scanShopCoaPages(origin, homeHtml) {
    const cands = ['/coa', '/coas', '/pages/coa', '/pages/coas', '/lab-results', '/pages/lab-results', '/lab-testing', '/pages/lab-testing', '/certificates', '/certificates-of-analysis', '/third-party-testing', '/pages/third-party-testing', '/testing', '/lab-reports', '/analyses', '/certificaten'];
    for (const m of (homeHtml || '').matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      if (COA_RE.test(stripTags(m[2])) || /\/(coa|lab|certific|test)/i.test(m[1])) { try { const u = new URL(decodeEntities(m[1]), origin); if (u.origin === origin) cands.unshift(u.pathname); } catch {} }
    }
    const pages = [], seen = new Set();
    for (const p of [...new Set(cands)].slice(0, 20)) {
      try {
        const r = await get(origin + p, { timeout: 12000 });
        if (!r.ok || seen.has(r.url)) continue;
        seen.add(r.url);
        const c = findCoas(await r.text(), r.url);
        if (c.links.length) pages.push({ url: r.url, coa: c });
      } catch {}
    }
    return pages;
  }

  function enrich(o, shop) {
    const peps = identify(o.name).length ? identify(o.name) : identify(`${o.name} ${o.variant || ''}`);
    const dose = parseDose(o.variant, o.name, o.attrs);
    const totalMg = dose.mg ? Math.round(dose.mg * dose.count * 1000) / 1000 : null;
    const priceBase = toBase(o.price, o.currency);
    const e = {
      ...o, shopId: shop.id, shop: shop.name, peptides: peps, peptide: peps.length ? peps.join(' + ') : null,
      mg: dose.mg, iu: dose.iu, count: dose.count, totalMg, priceBase,
      perMg: totalMg && priceBase ? Math.round(priceBase / totalMg * 1000) / 1000 : null,
      key: `${shop.id}|${o.variantId}`,
    };
    e.dose = doseLabel(e);
    return e;
  }

  async function scanShop(shop) {
    const origin = new URL(shop.url).origin;
    const t0 = Date.now();
    log(`▶ ${shop.name}`);
    await loadRates();
    let offers = [], platform = '', homeHtml = '';
    try {
      job.phase = `${shop.name}: ${L('platform herkennen', 'detecting platform')}…`;
      try { const r = await get(origin + '/', { timeout: 20000 }); homeHtml = await readLimited(r, 600000); } catch {}
      try { offers = await scanShopify(shop, origin, homeHtml); platform = 'Shopify'; } catch {}
      if (!offers.length) { try { offers = await scanWoo(shop, origin); platform = 'WooCommerce'; } catch {} }
      if (!offers.length) { offers = await scanGeneric(shop, origin); platform = L('Overig', 'Other'); }
    } catch (e) {
      shop.lastError = errText(e); shop.lastScan = Date.now();
      log(`✖ ${shop.name}: ${shop.lastError}`);
      saveShops(); return;
    }
    offers = offers.filter(o => o.price != null && !Number.isNaN(o.price) && o.price > 0);

    const pages = [...new Set(offers.filter(o => !o.coa?.links?.length && platform !== L('Overig', 'Other')).map(o => o.pageUrl))].slice(0, 250);
    let n = 0, pi = 0;
    const pageCoa = new Map();
    const worker = async () => {
      while (pi < pages.length) {
        const u = pages[pi++];
        try { const r = await get(u, { timeout: 15000 }); if (r.ok) pageCoa.set(u, findCoas(await r.text(), u)); } catch {}
        n++;
        job.phase = `${shop.name}: ${L('COA\'s zoeken', 'looking for COAs')} (${n}/${pages.length})…`;
        await sleep(150);
      }
    };
    await Promise.all(Array.from({ length: 3 }, worker));
    for (const o of offers) if (pageCoa.has(o.pageUrl)) o.coa = mergeCoa(o.coa, pageCoa.get(o.pageUrl));

    job.phase = `${shop.name}: ${L('COA-pagina zoeken', 'looking for COA page')}…`;
    const coaPages = await scanShopCoaPages(origin, homeHtml);
    const enriched = offers.map(o => enrich(o, shop));
    for (const cp of coaPages) for (const l of cp.coa.links) {
      const peps = identify(l.label + ' ' + decodeURIComponent(l.url));
      if (!peps.length) continue;
      for (const o of enriched) if (o.peptide && peps.some(p => o.peptides.includes(p)) && !(o.coa?.links || []).some(x => x.url === l.url)) {
        o.coa = mergeCoa(o.coa, { links: [{ ...l, viaPage: cp.url }], labs: l.lab ? [l.lab] : [], verifiable: /janoshik\.com\/tests|verify/i.test(l.url) });
      }
    }

    const hist = load('history.json', {});
    const changes = load('changes.json', []);
    const now = Date.now();
    for (const o of enriched) {
      const h = hist[o.key] || (hist[o.key] = []);
      const last = h[h.length - 1];
      if (last && last.p !== o.price) changes.unshift({ t: now, key: o.key, shop: shop.name, shopId: shop.id, name: o.name, variant: o.variant, url: o.url, peptide: o.peptide, old: last.p, new: o.price, currency: o.currency });
      if (last && last.s === 0 && o.inStock) changes.unshift({ t: now, key: o.key, shop: shop.name, shopId: shop.id, name: o.name, variant: o.variant, url: o.url, peptide: o.peptide, new: o.price, currency: o.currency, restock: true });
      if (!last || last.p !== o.price || (last.s ? 1 : 0) !== (o.inStock ? 1 : 0) || now - last.t > 20 * 3600e3) h.push({ t: now, p: o.price, s: o.inStock ? 1 : 0 });
      if (h.length > 150) h.splice(0, h.length - 150);
      o.history = h.slice(-40);
      o.lowest = Math.min(...h.map(x => x.p));
    }
    const prev = load(`offers-${shop.id}.json`, []);
    const prevKeys = new Set(prev.map(o => o.key));
    if (prevKeys.size) for (const o of enriched.filter(o => !prevKeys.has(o.key))) changes.unshift({ t: now, key: o.key, shop: shop.name, shopId: shop.id, name: o.name, variant: o.variant, url: o.url, peptide: o.peptide, new: o.price, currency: o.currency, isNew: true });
    save('history.json', hist);
    save('changes.json', changes.slice(0, 800));
    save(`offers-${shop.id}.json`, enriched);

    const sig = signals(homeHtml, origin, enriched[0]?.currency);
    Object.assign(shop, {
      platform, lastScan: now, lastError: '', products: new Set(enriched.map(o => o.productId)).size, offers: enriched.length,
      peptideProducts: new Set(enriched.filter(o => o.peptide && o.peptide !== 'Bacteriostatic water').map(o => o.productId)).size,
      withCoa: enriched.filter(o => o.coa?.links?.length).length, coaPages: coaPages.map(c => c.url), durationMs: now - t0,
      currency: sig.currency || enriched[0]?.currency || '', info: shopInfo(homeHtml, origin), fit: R.fit(sig),
      title: stripTags((homeHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').slice(0, 80),
    });
    saveShops();
    checkAlerts(enriched);
    log(`✔ ${shop.name}: ${enriched.length} ${L('prijzen', 'prices')} (${platform}), ${shop.withCoa} ${L('met COA', 'with COA')}`);
  }

  // ---------- Prijsalarmen ----------
  function checkAlerts(offers) {
    const hits = load('alert-hits.json', []);
    const seen = new Set(hits.map(h => h.alertId + '|' + h.key + '|' + h.price));
    let added = 0;
    for (const a of settings.alerts || []) {
      for (const o of offers) {
        if (o.peptide !== a.peptide || !o.inStock) continue;
        if (a.dose && o.dose !== a.dose) continue;
        if (a.coaOnly && !(o.coa?.links || []).length) continue;
        const okPerMg = a.maxPerMg ? o.perMg != null && o.perMg <= a.maxPerMg : true;
        const okPrice = a.maxPrice ? o.priceBase != null && o.priceBase <= a.maxPrice : true;
        if (!(okPerMg && okPrice)) continue;
        const k = a.id + '|' + o.key + '|' + o.price;
        if (seen.has(k)) continue;
        seen.add(k); added++;
        hits.unshift({ t: Date.now(), alertId: a.id, key: o.key, shop: o.shop, name: o.name, variant: o.variant, url: o.url, peptide: o.peptide, dose: o.dose, price: o.price, priceBase: o.priceBase, perMg: o.perMg, currency: o.currency });
      }
    }
    if (added) { save('alert-hits.json', hits.slice(0, 300)); log(`🔔 ${added} ${L('nieuwe alarm-treffers', 'new alert matches')}`); }
  }

  // ---------- Shops zoeken (ontdekken) ----------
  // Alleen zoekresultaten die echt over peptiden gaan (titel, beschrijving of adres)
  const RELEVANT = /peptid|bpc[\s-]?157|tb[\s-]?500|semaglut|tirzepat|retatrut|cagrilint|ipamorelin|cjc[\s-]?1295|ghk[\s-]?cu|mots[\s-]?c|epitalon|selank|semax|pt[\s-]?141|melanotan|tesamorelin|sermorelin|aod[\s-]?9604|glp[\s-]?[123]|research chem|kisspeptin|thymosin/i;
  async function searchWeb(q) {
    const found = new Set();
    const add = (u, text = '') => {
      try {
        const x = new URL(u);
        if (!/^https?:$/.test(x.protocol)) return;
        if (!RELEVANT.test(text + ' ' + x.hostname + x.pathname)) return;
        found.add(x.origin);
      } catch {}
    };
    if (process.env.PW_SEARCH_URL) { // alleen voor tests
      try { const r = await fetch(`${process.env.PW_SEARCH_URL}?q=${encodeURIComponent(q)}&region=${region}`); for (const u of await r.json()) found.add(new URL(u).origin); } catch {}
      return [...found];
    }
    if (settings.braveKey) {
      try {
        const r = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&country=${R.brave}&count=20&safesearch=strict`, {
          headers: { Accept: 'application/json', 'X-Subscription-Token': settings.braveKey }, signal: AbortSignal.timeout(15000) });
        const d = await r.json();
        for (const x of d.web?.results || []) add(x.url, `${x.title || ''} ${x.description || ''}`);
      } catch (e) { log('Brave: ' + errText(e)); }
    }
    try {
      const r = await get(`https://www.bing.com/search?q=${encodeURIComponent(q)}&cc=${R.bingCc}&setlang=${R.bingLang}&count=30&adlt=strict`, { timeout: 15000 });
      const html = await r.text();
      for (const m of html.matchAll(/<li class="b_algo"[\s\S]*?<\/li>/g)) {
        const h = (m[0].match(/<h2[^>]*>\s*<a[^>]+href="([^"]+)"/) || [])[1];
        if (!h) continue;
        let u = decodeEntities(h);
        const enc = (u.match(/[?&]u=a1([^&]+)/) || [])[1];
        if (enc) { try { u = Buffer.from(enc.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); } catch {} }
        add(u, stripTags(m[0]));
      }
    } catch {}
    try {
      const r = await get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}&kl=${R.ddg}&kp=1`, { timeout: 15000 });
      const html = await r.text();
      for (const m of html.matchAll(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=class="result__a"|$)/g)) {
        let u = decodeEntities(m[1]);
        const enc = (u.match(/[?&]uddg=([^&]+)/) || [])[1];
        if (enc) u = decodeURIComponent(enc);
        if (u.startsWith('//')) u = 'https:' + u;
        const snip = (m[3].match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/) || [])[1] || '';
        add(u, stripTags(m[2] + ' ' + snip));
      }
    } catch {}
    return [...found];
  }

  async function verifyShop(origin) {
    const out = { origin, host: new URL(origin).host.replace(/^www\./, ''), checked: Date.now() };
    let html = '';
    try {
      const r = await get(origin + '/', { timeout: 15000 });
      html = await readLimited(r, 600000);
      out.origin = new URL(r.url).origin;
      out.host = new URL(r.url).host.replace(/^www\./, '');
    } catch (e) { return { ...out, status: 'error', reason: errText(e) }; }
    if (NOT_SHOP.test(out.host)) return { ...out, status: 'notshop', reason: L('geen webshop', 'not a shop') };
    out.title = stripTags((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').slice(0, 80);
    let peps = new Set(), platform = '', currency = '';
    try {
      const d = await getJson(origin + '/products.json?limit=250&page=1', 12000);
      for (const p of d.products || []) identify(p.title).filter(x => x !== 'Bacteriostatic water').forEach(x => peps.add(x));
      platform = 'Shopify';
      currency = (html.match(/Shopify\.currency\s*=\s*\{"active":"([A-Z]{3})"/) || [])[1] || '';
    } catch {}
    if (!platform) {
      try {
        const d = await getJson(origin + '/wp-json/wc/store/v1/products?per_page=100&page=1', 12000);
        if (Array.isArray(d)) {
          platform = 'WooCommerce';
          for (const p of d) identify(decodeEntities(p.name)).filter(x => x !== 'Bacteriostatic water').forEach(x => peps.add(x));
          currency = d[0]?.prices?.currency_code || '';
        }
      } catch {}
    }
    if (!platform) {
      const text = stripTags(html);
      identify(text).filter(x => x !== 'Bacteriostatic water').forEach(x => peps.add(x));
      if (!/(€|\$|£)\s?\d|\d\s?(€|eur|usd)|add.to.cart|in winkelwagen|add to bag|winkelmand|checkout|afrekenen/i.test(html)) peps = new Set();
      platform = L('Overig', 'Other');
    }
    out.platform = platform;
    out.peptides = [...peps];
    if (peps.size < 2) return { ...out, status: 'notshop', reason: L('geen peptidewebshop', 'no peptide shop') + ` (${peps.size})` };
    const sig = signals(html, out.origin, currency);
    out.currency = sig.currency;
    out.lang = sig.lang;
    out.fit = R.fit(sig);
    out.info = shopInfo(html, out.origin);
    return { ...out, status: out.fit.ok ? 'shop' : 'otherregion', reason: out.fit.reasons.join(', ') };
  }

  async function discover() {
    const queries = [...R.queries, ...(settings.extraQueries || [])];
    const known = new Set([...shops.map(s => new URL(s.url).host.replace(/^www\./, '')), ...discovered.map(d => d.host)]);
    const candidates = new Set();
    let qi = 0, engineHits = 0;
    for (const q of queries) {
      qi++;
      job.phase = `${L('Zoeken', 'Searching')} (${qi}/${queries.length}): "${q}" · ${candidates.size} ${L('kandidaten', 'candidates')}`;
      const res = await searchWeb(q);
      engineHits += res.length;
      for (const o of res) { const h = new URL(o).host.replace(/^www\./, ''); if (!known.has(h) && !NOT_SHOP.test(h)) candidates.add(new URL(o).origin); }
      await sleep(1200 + Math.random() * 800);
    }
    if (!engineHits) {
      log(L('✖ Zoekmachines gaven geen resultaten (geblokkeerd?). Vul een Brave Search API-sleutel in bij Shops → Shops zoeken.', '✖ Search engines returned no results (blocked?). Add a Brave Search API key under Shops → Find shops.'));
    }
    log(`🔎 ${candidates.size} ${L('nieuwe websites gevonden, controleren…', 'new websites found, checking…')}`);
    const list = [...candidates].slice(0, 250);
    let i = 0, n = 0, foundShops = 0;
    const worker = async () => {
      while (i < list.length) {
        const o = list[i++];
        const host = new URL(o).host.replace(/^www\./, '');
        if (known.has(host)) { n++; continue; }
        known.add(host);
        let v;
        try { v = await verifyShop(o); } catch (e) { v = { origin: o, host, status: 'error', reason: errText(e), checked: Date.now() }; }
        n++;
        job.phase = `${L('Websites controleren', 'Checking websites')} (${n}/${list.length}) · ${foundShops} ${L('shops', 'shops')}`;
        if (known.has(v.host) && v.host !== host) { /* doorverwijzing naar bekende shop */ }
        if (process.env.PW_VERBOSE && v.status !== 'shop') log(`  · ${v.host}: ${v.status}${v.reason ? ' (' + v.reason + ')' : ''}${v.currency ? ' ' + v.currency : ''}`);
        discovered = discovered.filter(d => d.host !== v.host);
        discovered.unshift(v);
        if (v.status === 'shop') {
          foundShops++;
          log(`✔ ${L('Shop gevonden', 'Shop found')}: ${v.host} (${v.peptides.length} ${L('peptiden', 'peptides')}, ${v.currency || '?'})`);
          if (settings.autoAdd && !shops.some(s => new URL(s.url).host.replace(/^www\./, '') === v.host)) {
            const shop = { id: crypto.randomBytes(4).toString('hex'), url: v.origin, name: v.host, added: Date.now(), discovered: true };
            shops.push(shop); saveShops();
            job.queue.push({ type: 'scan', id: shop.id });
            job.total++;
          }
        }
        save('discovered.json', discovered.slice(0, 1500));
        await sleep(200);
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    settings.lastDiscover = Date.now(); saveSettings();
    log(`🔎 ${L('Klaar', 'Done')}: ${foundShops} ${L('nieuwe shops', 'new shops')}`);
  }

  function saveShops() { save('shops.json', shops); }
  function saveSettings() { save('settings.json', settings); }

  async function runQueue() {
    if (job.running) return;
    job.running = true; job.done = 0; job.total = job.queue.length;
    while (job.queue.length) {
      const task = job.queue.shift();
      try {
        if (task.type === 'discover') { job.current = L('Shops zoeken', 'Finding shops'); await discover(); }
        else {
          const shop = shops.find(s => s.id === task.id);
          if (!shop) { job.done++; continue; }
          job.current = shop.name;
          await scanShop(shop);
        }
      } catch (e) { log('✖ ' + e.message); }
      job.done++;
    }
    job.running = false; job.current = null; job.phase = '';
  }
  function enqueue(tasks) {
    for (const t of tasks) if (!job.queue.some(q => q.type === t.type && q.id === t.id)) { job.queue.push(t); if (job.running) job.total++; }
    runQueue();
  }

  const timer = setInterval(() => {
    if (job.running) return;
    if (settings.autoDiscoverDays > 0 && Date.now() - (settings.lastDiscover || 0) > settings.autoDiscoverDays * 864e5) {
      settings.lastDiscover = Date.now(); saveSettings();
      log('⏰ ' + L('Automatisch shops zoeken', 'Automatic shop search'));
      enqueue([{ type: 'discover' }]);
    } else if (settings.autoHours > 0 && Date.now() - (settings.lastAuto || 0) > settings.autoHours * 3600e3) {
      settings.lastAuto = Date.now(); saveSettings();
      log('⏰ ' + L('Automatische scan', 'Automatic scan'));
      enqueue(shops.map(s => ({ type: 'scan', id: s.id })));
    }
  }, 60e3);

  // ---------- API ----------
  const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  async function body(req) { let b = ''; for await (const c of req) { b += c; if (b.length > 1e6) break; } try { return JSON.parse(b || '{}'); } catch { return {}; } }
  const publicSettings = () => ({ ...settings, braveKey: settings.braveKey ? '••••' + settings.braveKey.slice(-4) : '' });

  const handle = async function handle(req, res, p) {
    if (p === '/state') {
      const offers = shops.flatMap(s => load(`offers-${s.id}.json`, []));
      return json(res, 200, { region, base: BASE, shops, offers, settings: publicSettings(), job: { ...job, queue: job.queue.length, log: job.log.slice(-60) },
        changes: load('changes.json', []).slice(0, 300), alertHits: load('alert-hits.json', []).slice(0, 200), discovered: discovered.slice(0, 400), rates, ratesAt });
    }
    if (p === '/job') return json(res, 200, { ...job, queue: job.queue.length, log: job.log.slice(-60) });
    if (p === '/shops' && req.method === 'POST') {
      const b = await body(req);
      const added = [];
      for (let raw of String(b.url || '').split(/[\s,]+/).filter(Boolean)) {
        if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
        let u; try { u = new URL(raw); } catch { continue; }
        const h = u.host.replace(/^www\./, '');
        if (shops.some(s => new URL(s.url).host.replace(/^www\./, '') === h)) continue;
        const shop = { id: crypto.randomBytes(4).toString('hex'), url: u.origin, name: h, added: Date.now() };
        shops.push(shop); added.push(shop);
      }
      saveShops();
      if (added.length) enqueue(added.map(s => ({ type: 'scan', id: s.id })));
      return json(res, 200, { added });
    }
    const dm = p.match(/^\/shops\/([0-9a-f]+)$/);
    if (dm && req.method === 'DELETE') {
      const s = shops.find(x => x.id === dm[1]);
      shops = shops.filter(x => x.id !== dm[1]); saveShops();
      try { fs.unlinkSync(file(`offers-${dm[1]}.json`)); } catch {}
      if (s) { const h = new URL(s.url).host.replace(/^www\./, ''); discovered = discovered.map(d => d.host === h ? { ...d, status: 'removed' } : d); save('discovered.json', discovered); }
      return json(res, 200, { ok: true });
    }
    if (p === '/scan' && req.method === 'POST') {
      const b = await body(req);
      enqueue((b.id ? [b.id] : shops.map(s => s.id)).map(id => ({ type: 'scan', id })));
      return json(res, 200, { ok: true });
    }
    if (p === '/discover' && req.method === 'POST') { enqueue([{ type: 'discover' }]); return json(res, 200, { ok: true }); }
    if (p === '/settings' && req.method === 'POST') {
      const b = await body(req);
      if ('autoHours' in b) { settings.autoHours = Math.max(0, Math.min(168, parseInt(b.autoHours) || 0)); settings.lastAuto = Date.now(); }
      if ('autoDiscoverDays' in b) { settings.autoDiscoverDays = Math.max(0, Math.min(60, parseInt(b.autoDiscoverDays) || 0)); settings.lastDiscover = Date.now(); }
      if ('autoAdd' in b) settings.autoAdd = !!b.autoAdd;
      if ('braveKey' in b && !String(b.braveKey).startsWith('••••')) settings.braveKey = String(b.braveKey).trim();
      if ('extraQueries' in b) settings.extraQueries = String(b.extraQueries).split('\n').map(s => s.trim()).filter(Boolean).slice(0, 50);
      saveSettings();
      return json(res, 200, publicSettings());
    }
    if (p === '/alerts' && req.method === 'POST') {
      const b = await body(req);
      if (!b.peptide) return json(res, 400, { error: 'peptide' });
      const a = { id: crypto.randomBytes(4).toString('hex'), peptide: b.peptide, dose: b.dose || '', maxPerMg: parseFloat(b.maxPerMg) || null, maxPrice: parseFloat(b.maxPrice) || null, coaOnly: !!b.coaOnly, created: Date.now() };
      settings.alerts = [...(settings.alerts || []), a]; saveSettings();
      checkAlerts(shops.flatMap(s => load(`offers-${s.id}.json`, [])));
      return json(res, 200, a);
    }
    const am = p.match(/^\/alerts\/([0-9a-f]+)$/);
    if (am && req.method === 'DELETE') {
      settings.alerts = (settings.alerts || []).filter(a => a.id !== am[1]); saveSettings();
      save('alert-hits.json', load('alert-hits.json', []).filter(h => h.alertId !== am[1]));
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { error: 'Unknown' });
  };

  // ---------- Zonder webserver gebruiken (GitHub Actions) ----------
  handle.addShops = urls => {
    for (let raw of urls) {
      if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
      let u; try { u = new URL(raw); } catch { continue; }
      const h = u.host.replace(/^www\./, '');
      if (shops.some(s => new URL(s.url).host.replace(/^www\./, '') === h)) continue;
      shops.push({ id: crypto.randomBytes(4).toString('hex'), url: u.origin, name: h, added: Date.now() });
    }
    saveShops();
  };
  handle.configure = obj => { Object.assign(settings, obj); saveSettings(); };
  handle.needsDiscover = days => !shops.length || Date.now() - (settings.lastDiscover || 0) > days * 864e5;
  handle.run = async ({ discover = false, scan = true } = {}) => {
    const tasks = [];
    if (discover) tasks.push({ type: 'discover' });
    if (scan) tasks.push(...shops.map(s => ({ type: 'scan', id: s.id })));
    enqueue(tasks);
    while (job.running || job.queue.length) await sleep(1000);
  };
  handle.exportState = () => ({
    region, base: BASE, static: true, generated: Date.now(), shops, offers: shops.flatMap(s => load(`offers-${s.id}.json`, [])),
    settings: { alerts: [], autoAdd: settings.autoAdd, lastDiscover: settings.lastDiscover }, job: { running: false, log: job.log.slice(-80) },
    changes: load('changes.json', []).slice(0, 300), alertHits: [], discovered: discovered.slice(0, 400), rates, ratesAt,
  });
  // Gevonden 'shops' waar geen enkele prijs uit te halen viel weer opruimen (bijv. klinieken of blogs)
  handle.pruneFailed = () => {
    const bad = shops.filter(s => s.discovered && s.lastError && !s.offers);
    for (const s of bad) {
      const h = new URL(s.url).host.replace(/^www\./, '');
      discovered = discovered.map(d => d.host === h ? { ...d, status: 'notshop', reason: L('geen prijzen gevonden', 'no prices found') } : d);
      log(`🧹 ${s.name}: ${L('verwijderd (geen prijzen gevonden)', 'removed (no prices found)')}`);
    }
    shops = shops.filter(s => !bad.includes(s));
    saveShops(); save('discovered.json', discovered.slice(0, 1500));
  };
  handle.stop = () => clearInterval(timer);
  handle.onLog = fn => { const orig = job.log.push.bind(job.log); job.log.push = x => { fn(x.msg); return orig(x); }; };
  return handle;
};

module.exports.REGIONS = REGIONS;
