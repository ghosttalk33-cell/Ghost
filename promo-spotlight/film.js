// NL Peptides: Black Friday promo. Pure function of time: window.seek(t) paints frame t.
// Timing in beats (u) on the measured grid (128 bpm, 32 beats). Plan: docs/shotlist.md.
import * as M from './lib/motion.js';

const { W, H, FORMAT, E, TAU, prog, lerp, clamp, springU, SPRING, wobble, font, layout, glyph, text,
  cover, rrect, fitSize, shake, noise1, hash01 } = M;

// Brand tokens from assets/brand.json (site: nlpeptideshop.nl).
const C = {
  night: '#050a16', card: '#0d1322', line: '#1f2a3d', ink: '#eef2f8', mute: '#9aa6b8',
  cyan: '#22d3ee', cyanHi: '#67e8f9', cyanLo: '#0891b2', violet: '#818cf8', deal: '#fde68a', dealInk: '#1a1405',
};
const DISPLAY = 'Display', UI = 'UI';
const CFG0 = await fetch('film.json').then((r) => r.json());
const V = CFG0.variant || 'bf';   // bf | tijdloos | assortiment | vertrouwen
const P = FORMAT.portrait;
const S = FORMAT.safe;


// ---------------------------------------------------------------- shared drawing

function bg(ctx, gx = 0.5, gy = 0.45, amt = 1) {
  ctx.fillStyle = C.night; ctx.fillRect(0, 0, W, H);
  const r = Math.max(W, H) * 0.7;
  const g = ctx.createRadialGradient(W * gx, H * gy, 0, W * gx, H * gy, r);
  g.addColorStop(0, `rgba(34,140,200,${0.22 * amt})`);
  g.addColorStop(0.5, `rgba(20,60,120,${0.08 * amt})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

function cyanGrad(ctx, x0, x1) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, C.cyanHi); g.addColorStop(0.55, C.cyan); g.addColorStop(1, C.violet);
  return g;
}

// The brand hex from assets/logo/icon_0.svg (viewBox 64): M32 10 l19 11 v22 L32 54 13 43 V21 z
const HEX = [[32, 10], [51, 21], [51, 43], [32, 54], [13, 43], [13, 21]];
function hexPath(ctx, cx, cy, size, p = 1) {
  const pts = HEX.map(([x, y]) => [cx + (x - 32) * size / 64, cy + (y - 32) * size / 64]);
  ctx.beginPath();
  const segs = 6 * clamp(p);
  ctx.moveTo(...pts[0]);
  for (let i = 1; i <= Math.ceil(segs); i++) {
    const a = pts[(i - 1) % 6], b = pts[i % 6], f = Math.min(1, segs - (i - 1));
    ctx.lineTo(lerp(a[0], b[0], f), lerp(a[1], b[1], f));
  }
  if (p >= 1) ctx.closePath();
}
function logoHex(ctx, cx, cy, size, draw = 1, dot = 1, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(cx - size / 2, cy - size / 2, cx + size / 2, cy + size / 2);
  g.addColorStop(0, C.cyanHi); g.addColorStop(1, C.cyanLo);
  ctx.strokeStyle = g; ctx.lineWidth = size * 5 / 64; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (draw > 0) { hexPath(ctx, cx, cy, size, draw); ctx.stroke(); }
  if (dot > 0) {
    ctx.beginPath(); ctx.arc(cx, cy, size * 6 / 64 * dot, 0, TAU); ctx.fillStyle = g; ctx.fill();
  }
  ctx.restore();
}

// Word-wrapped text block; returns line baselines. Each line is an array of [word, color].
function lines(ctx, rows, x, y, f, lh, appear, align = 'left') {
  ctx.font = f;
  rows.forEach((row, i) => {
    const k = appear ? appear(i) : 1;
    if (k <= 0) return;
    const full = row.map((w) => w[0]).join(' ');
    let cx = align === 'center' ? x - ctx.measureText(full).width / 2 : x;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, y + i * lh - lh * 0.95, W, lh * 1.25); ctx.clip();
    const dy = (1 - k) * lh;
    row.forEach(([w, col]) => {
      ctx.fillStyle = col === 'grad' ? cyanGrad(ctx, cx, cx + ctx.measureText(w).width) : col;
      ctx.fillText(w, cx, y + i * lh + dy);
      cx += ctx.measureText(w + ' ').width;
    });
    ctx.restore();
  });
}

function pill(ctx, label, x, y, f, { fillC, ink, stroke, padX = 34, h = 84, align = 'left', scale = 1 } = {}) {
  ctx.font = f;
  const w = ctx.measureText(label).width + padX * 2;
  const x0 = align === 'center' ? x - w / 2 : x;
  ctx.save();
  ctx.translate(x0 + w / 2, y + h / 2); ctx.scale(scale, scale); ctx.translate(-(x0 + w / 2), -(y + h / 2));
  rrect(ctx, x0, y, w, h, h / 2);
  if (fillC) { ctx.fillStyle = fillC; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2.5; ctx.stroke(); }
  ctx.fillStyle = ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x0 + padX, y + h / 2 + 2);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
  return w;
}

// ================================================================ shared end card (u 28..32)
const endY = () => (P ? H * 0.36 : H * 0.3);
function endCard(ctx, u, { logoFrom = 27.4 } = {}) {
  const ly = endY();
  const lk = 1 + 0.06 * wobble(u - 28, 2, 4);
  logoHex(ctx, W / 2, ly, 300 * lk, prog(u, logoFrom, logoFrom + 0.8), springU(u, 28.3, SPRING.bouncy));
  const wf = font(P ? 120 : 110, 700, DISPLAY);
  const wk = springU(u, 28.2, SPRING.snappy);
  ctx.font = wf;
  const w1 = ctx.measureText('NL ').width, w2 = ctx.measureText('Peptides').width;
  const wx = W / 2 - (w1 + w2) / 2, wy = ly + (P ? 300 : 280);
  if (wk > 0) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, wy - 140, W, 175); ctx.clip();
    ctx.translate(0, (1 - wk) * 150);
    ctx.fillStyle = C.ink; ctx.fillText('NL', wx, wy);
    ctx.fillStyle = cyanGrad(ctx, wx + w1, wx + w1 + w2); ctx.fillText('Peptides', wx + w1, wy);
    ctx.restore();
  }
  const bk = springU(u, 28.8, SPRING.bouncy);
  const by = wy + (P ? 90 : 70);
  if (bk > 0) {
    ctx.save(); ctx.globalAlpha = clamp(bk);
    ctx.shadowColor = 'rgba(34,211,238,0.35)'; ctx.shadowBlur = 50;
    pill(ctx, 'nlpeptideshop.nl  →', W / 2, by, font(P ? 60 : 54, 700, UI), { fillC: C.cyan, ink: '#04131a', h: P ? 132 : 116, padX: 60, align: 'center', scale: lerp(0.7, 1, bk) });
    ctx.restore();
  }
  const dk = springU(u, 29.5, SPRING.bouncy);
  if (dk > 0) pill(ctx, 'COA bij elke bestelling · discreet verzonden', W / 2, by + (P ? 175 : 150), font(P ? 40 : 36, 700, UI),
    { fillC: 'rgba(34,211,238,0.10)', stroke: 'rgba(34,211,238,0.5)', ink: C.cyanHi, h: P ? 84 : 74, padX: 34, align: 'center', scale: dk });
  const rk = E.outQuint(prog(u, 30, 30.6));
  ctx.save(); ctx.globalAlpha = rk * 0.9;
  text(ctx, 'Research use only · Nederland & België', W / 2, P ? H - S.y - 40 : H - 80, font(P ? 36 : 32, 500, UI), C.mute, 'center');
  ctx.restore();
}
const HITS_END = [[28, 'end', 'impact'], [28.5, 'logo', 'bell', { pitch: 'A5' }], [29.5, 'pill', 'pop', { pitch: 'E6' }]];

// ================================================================ D: SPOTLIGHT
// One vial holds the centre; it turns on each downbeat to the next product; giant words run behind it.
const SPOT = [
  { img: 'p11', tint: '#b45309', word: 'HELDER', cap: ['Research peptides,', 'helder en discreet geleverd.'] },
  { img: 'p6', tint: '#64748b', word: 'DISCREET', cap: ['Discreet verpakt,', 'neutrale verzending.'] },
  { img: 'p23', tint: '#1d4ed8', word: 'COA', cap: ['De labtest (COA) van jouw', 'batch bij elke bestelling.'] },
  { img: 'p9', tint: '#c2410c', word: 'iDEAL', cap: ['Je bestelt in een paar klikken', 'en betaalt via iDEAL.'] },
  { img: 'p17', tint: '#6d28d9', word: '1–2 DAGEN', cap: ['In NL meestal binnen', '1–2 werkdagen.'] },
  { img: 'p28', tint: '#0f766e', word: '16 PRODUCTEN', cap: ['Een overzichtelijk assortiment', 'met vaste prijzen.'] },
  { img: 'p2', tint: '#334155', word: 'NL & BE', cap: ['Research use only.', 'Nederland & België.'] },
];
function spotIndex(u) { return clamp(Math.floor((u + 0.7) / 4), 0, SPOT.length - 1); }
function sSpot(ctx, u, IMG) {
  const i = spotIndex(u), it = SPOT[i];
  // background: night + a wash in the vial's cap colour, crossfaded around the turn
  ctx.fillStyle = C.night; ctx.fillRect(0, 0, W, H);
  const wash = (k, col) => {
    const g = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, Math.max(W, H) * 0.75);
    g.addColorStop(0, col + Math.round(0x55 * k).toString(16).padStart(2, '0'));
    g.addColorStop(1, '#00000000');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  };
  const turnIn = prog(u, i * 4 - 0.7, i * 4 - 0.05);
  if (i > 0 && turnIn < 1) wash(1 - turnIn, SPOT[i - 1].tint);
  wash(i === 0 ? 1 : turnIn, it.tint);

  // marquee: three rows of giant outlined words, the middle one solid, alternating directions
  const size = P ? 300 : 330;
  ctx.save();
  ctx.font = font(size, 700, DISPLAY);
  const word = it.word + '  ·  ';
  const ww = ctx.measureText(word).width;
  const rowsY = P ? [H * 0.24, H * 0.46, H * 0.68] : [H * 0.28, H * 0.6, H * 0.92];
  rowsY.forEach((y, r) => {
    const dir = r % 2 ? 1 : -1;
    const off = ((u * 120 * dir + r * 400) % ww + ww) % ww;
    const k = springU(u, i * 4 - 0.1 + r * 0.12, SPRING.snappy);   // each row snaps in after the turn
    ctx.save();
    ctx.beginPath(); ctx.rect(0, y - size * 0.9, W, size * 1.05); ctx.clip();
    ctx.translate(0, (1 - k) * size * 0.9);
    for (let x = -off; x < W; x += ww) {
      if (r === 1) { ctx.fillStyle = 'rgba(238,242,248,0.16)'; ctx.fillText(word, x, y); }
      else { ctx.strokeStyle = 'rgba(103,232,249,0.32)'; ctx.lineWidth = 4; ctx.strokeText(word, x, y); }
    }
    ctx.restore();
  });
  ctx.restore();

  // the vial: rises at the start, turns (scaleX through 0) on each downbeat, gently floats
  const rise = springU(u, -0.4, SPRING.gentle);
  const end = E.inOutCubic(prog(u, 27.2, 28.2));
  const vs = (P ? 1150 : 760) * lerp(1, 0.55, end);
  const vx = W / 2, vy = lerp(P ? H * 0.45 : H * 0.42, P ? H * 0.2 : H * 0.18, end) + (1 - rise) * H * 0.8 + 12 * Math.sin(u * 0.7);
  let sx = 1, img = IMG['m' + it.img];
  if (i > 0 && u < i * 4) {
    const p = prog(u, i * 4 - 0.7, i * 4 - 0.05);
    sx = Math.abs(Math.cos(p * Math.PI));
    if (p < 0.5) img = IMG['m' + SPOT[i - 1].img];
  }
  const fadeOut = 1 - prog(u, 27.6, 28.1);
  if (fadeOut > 0) {
    ctx.save(); ctx.globalAlpha = fadeOut;
    ctx.translate(vx, vy); ctx.scale(Math.max(0.02, sx), 1);
    ctx.drawImage(img, -vs / 2, -vs / 2, vs, vs);
    ctx.restore();
  }

  // caption (the site's own sentences), bottom; rises after each turn
  if (u < 27.6) {
    const cs = P ? 76 : 64;
    const cy = P ? H - S.y - 130 : H - 170;
    lines(ctx, [[[it.cap[0], C.ink]], [[it.cap[1], 'grad']]], W / 2, cy, font(cs, 700, DISPLAY), cs * 1.15,
      (r) => springU(u, i * 4 + 0.3 + r * 0.25, SPRING.snappy) - E.inCubic(prog(u, i * 4 + 2.9, i * 4 + 3.25)), 'center');
  }
  // small counter top-left
  ctx.save(); ctx.globalAlpha = 0.9 * (1 - end);
  text(ctx, `${String(i + 1).padStart(2, '0')} / ${String(SPOT.length).padStart(2, '0')}`, S.x + 10, S.y + (P ? 0 : 40), font(P ? 40 : 36, 700, UI), C.cyan, 'left', 6);
  ctx.restore();

  if (u >= 27.4) endCard(ctx, u);
}
const HITS_SPOT = [[-0.4, 'rise', 'impact'], ...SPOT.slice(1).map((_, j) => [(j + 1) * 4 - 0.7, 'turn', 'whoosh', { len: 0.4, from: 600, to: 2400 }]),
  ...SPOT.slice(1).map((_, j) => [(j + 1) * 4, 'land', 'thud']), [27.2, 'shrink', 'whoosh', { len: 0.5, from: 2400, to: 500 }], ...HITS_END];

// ================================================================ E: BESTELLEN (the real mobile site, scrolled in a phone)
const TILE = 4096, PAGE_W = 1170, PAGE_SCALE = 3;           // mobile_full_clean.jpg: 390 css px wide @3x, tiled
const SCROLL = [[0, 52], [4, 1030], [8, 1330], [12, 1650], [16, 7010], [20, 7350], [24, 7990]];   // css px per beat key
const CALLOUTS = [
  [0, 'Je bestelt in een', 'paar klikken.'],
  [4, 'De labtest (COA) van', 'jouw batch, altijd.'],
  [8, '16 producten,', 'vaste prijzen.'],
  [12, 'Kies je variant,', 'in je winkelmand.'],
  [16, 'Geen account nodig.', 'Direct een bestelnummer.'],
  [20, 'Betaal via iDEAL.', 'Discreet verzonden.'],
  [24, 'Vragen? WhatsApp', 'of mail ons.'],
];
function drawPage(ctx, IMG, scrollCss, x, y, w, h) {
  // draw the real page (cropped to the screen) from its tiles
  const s = w / PAGE_W;                  // screen px per image px
  const top = scrollCss * PAGE_SCALE, vis = h / s;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  for (let t = Math.floor(top / TILE); t * TILE < top + vis; t++) {
    const im = IMG['mob' + t]; if (!im) continue;
    ctx.drawImage(im, x, y + (t * TILE - top) * s, w, im.height * s);
  }
  ctx.restore();
}
function sOrder(ctx, u, IMG) {
  bg(ctx, P ? 0.5 : 0.62, 0.55, 1.1);
  const out = E.inOutCubic(prog(u, 27.2, 28.2));
  // phone geometry (390 x 844 css screen)
  const ph = P ? 1480 : 940, pw = ph * 390 / 844;
  const inK = springU(u, -0.5, SPRING.gentle);
  const px = P ? W / 2 : W * 0.68, py = P ? H * 0.7 : H * 0.52;
  const tilt = (1 - inK) * 0.35 + 0.04 * Math.sin(u * 0.4) * (1 - out);
  ctx.save();
  ctx.translate(px + out * (P ? 0 : W * 0.6), py + (1 - inK) * H * 0.9 + out * (P ? H : 0));
  ctx.rotate(tilt);
  // gentle push toward the screen in the middle section
  const z = 1.0 * (1.12) ** E.inOutSine(prog(u, 11, 13)) / (1.12) ** E.inOutSine(prog(u, 15, 17));
  ctx.scale(z, z);
  const x = -pw / 2, y = -ph / 2;
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 90; ctx.shadowOffsetY = 30;
  rrect(ctx, x - 22, y - 22, pw + 44, ph + 44, 78); ctx.fillStyle = '#0b0f19'; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#2a3447'; ctx.lineWidth = 4; ctx.stroke();
  // screen with the real site, scrolling on spring keys
  const sc = M.springKeys(u, SCROLL, { stiffness: 60, damping: 14 });
  ctx.save(); rrect(ctx, x, y, pw, ph, 58); ctx.clip();
  ctx.fillStyle = '#060b1a'; ctx.fillRect(x, y, pw, ph);
  drawPage(ctx, IMG, sc, x, y, pw, ph);
  ctx.restore();
  // dynamic island
  rrect(ctx, -pw * 0.16, y + 22, pw * 0.32, 34, 17); ctx.fillStyle = '#000'; ctx.fill();
  ctx.restore();

  // callout: the line for this section, beside (landscape) or above (portrait) the phone
  const ci = clamp(Math.floor(u / 4), 0, CALLOUTS.length - 1);
  const [cu, a, b] = CALLOUTS[ci];
  if (u < 27.4) {
    const cs = Math.min(fitSize(ctx, a, 700, DISPLAY, P ? S.w : W * 0.42, P ? 92 : 96), fitSize(ctx, b, 700, DISPLAY, P ? S.w : W * 0.42, P ? 92 : 96));
    const cx = P ? S.x + 10 : 140, cy = P ? S.y + 90 : H * 0.42;
    const k = (r) => springU(u, cu + 0.2 + r * 0.3, SPRING.snappy) - E.inCubic(prog(u, cu + 3.4, cu + 3.85));
    ctx.save(); ctx.globalAlpha = clamp(k(0) * 1.3);
    text(ctx, `STAP ${['01', '01', '01', '01', '02', '03', '—'][ci]}`.replace('STAP —', 'CONTACT'), cx, cy - cs - 30, font(P ? 40 : 38, 700, UI), C.cyan, 'left', 6);
    ctx.restore();
    lines(ctx, [[[a, C.ink]], [[b, 'grad']]], cx, cy, font(cs, 700, DISPLAY), cs * 1.08, k);
  }
  if (u >= 27.4) endCard(ctx, u);
}
const HITS_ORDER = [[-0.5, 'phone in', 'impact'], ...SCROLL.slice(1).map(([b]) => [b - 0.1, 'scroll', 'whoosh', { len: 0.5, from: 2200, to: 700 }]),
  ...CALLOUTS.map(([b]) => [b + 0.2, 'callout', 'tick']), [27.2, 'phone out', 'whoosh', { len: 0.5, from: 2400, to: 500 }], ...HITS_END];

// ================================================================ harness
function mask(img, { rx = 0.62, ry = 1.2, inner = 0.38, cy = 0.5 } = {}) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); const w = c.width, h = c.height;
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'destination-in';
  x.translate(w / 2, h * cy); x.scale(rx, ry);
  const g = x.createRadialGradient(0, 0, w * inner, 0, 0, w * 0.5);
  g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(-w, -h, 2 * w, 2 * h);
  return c;
}
const images = V === 'spotlight'
  ? Object.fromEntries(SPOT.map((s) => [s.img, `assets/products/${s.img}.png`]))
  : Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7].map((t) => ['mob' + t, `assets/site/mob_${t}.jpg`]));
M.film({
  fonts: [font(100, 700, DISPLAY), font(40, 500, UI), font(40, 700, UI)],
  images,
  hits: (V === 'spotlight' ? HITS_SPOT : HITS_ORDER).sort((a, b) => a[0] - b[0]),
  init(ctx, IMG) { if (V === 'spotlight') SPOT.forEach((s) => { IMG['m' + s.img] = mask(IMG[s.img]); }); },
  draw(ctx, u, t, IMG) { (V === 'spotlight' ? sSpot : sOrder)(ctx, u, IMG); },
  post(ctx, u, t) {
    const f = Math.floor(t * 60);
    ctx.save(); ctx.globalAlpha = 0.035; ctx.globalCompositeOperation = 'overlay';
    for (let i = 0; i < 1400; i++) {
      const x = hash01(i, f + 1) * W, y = hash01(i + 7777, f + 3) * H;
      ctx.fillStyle = hash01(i + 99, f) > 0.5 ? '#fff' : '#000';
      ctx.fillRect(x, y, 3, 3);
    }
    ctx.restore();
  },
});
