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

// ---------------------------------------------------------------- S1 hook: BLACK FRIDAY −20%   (u 0..4)
function sHook(ctx, u) {
  bg(ctx, 0.5, 0.5, 0.8);
  // brand hex, huge, turning slowly behind the number
  ctx.save();
  ctx.translate(W / 2, H * (P ? 0.47 : 0.5)); ctx.rotate(0.15 + u * 0.05);
  const hk = springU(u, -0.6, SPRING.gentle);
  logoHex(ctx, 0, 0, (P ? 1500 : 1300) * lerp(0.6, 1, hk), clamp(hk * 1.1), 0, 0.14);
  ctx.restore();

  ctx.save();
  shake(ctx, u, -0.25, 18);
  const str = '−20%';
  const size = fitSize(ctx, str, 700, DISPLAY, P ? S.w * 0.98 : W * 0.62, 520, -0.04);
  const f = font(size, 700, DISPLAY);
  const L = layout(ctx, str, f, -0.04 * size);
  const x0 = (W - L.width) / 2;
  const base = P ? H * 0.56 : H * 0.64;
  const starts = [-0.25, 0.5, 1, 1.5];
  L.glyphs.forEach((g, j) => {
    const k = springU(u, starts[j], SPRING.bouncy);
    if (k <= 0) return;
    const q = 0.12 * wobble(u - starts[j] - 0.15, 2.4, 5);
    glyph(ctx, g.ch, x0 + g.cx, base - (1 - k) * 420, f, C.deal, 1 + q, 1 - q, (1 - k) * 0.25);
  });

  // BLACK FRIDAY over, "op alles" under
  const tk = E.outQuint(prog(u, -0.2, 0.5));
  const lab = font(P ? 64 : 58, 700, UI);
  ctx.save(); ctx.globalAlpha = tk;
  text(ctx, 'BLACK FRIDAY', W / 2, base - size * 0.92 - (1 - tk) * 40, lab, C.ink, 'center', P ? 14 : 12);
  ctx.restore();
  const ok = springU(u, 2, SPRING.snappy);
  if (ok > 0) {
    lines(ctx, [[['op', C.ink], ['alles', C.ink]]], W / 2, base + (P ? 175 : 135), font(P ? 150 : 110, 700, DISPLAY), 150, () => ok, 'center');
    const sk = E.outQuint(prog(u, 2.5, 3.2));
    ctx.save(); ctx.globalAlpha = sk;
    text(ctx, 't/m Cyber Monday 30 nov', W / 2, base + (P ? 290 : 220) + (1 - sk) * 24, font(P ? 54 : 44, 500, UI), C.mute, 'center');
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- S2 four real vials + the site's h1   (u 4..8)
function sHero(ctx, u, IMG, o = { headline: true, dive: true }) {
  bg(ctx, 0.5, 0.65, 1);
  const img = IMG.heroM;
  // log-space push, accelerating into the NAD+ vial (x ~0.605 of the image) for the match cut at 8
  const push = 1.0 * (1.12) ** prog(u, 3.5, 7.2);
  const dive = o.dive ? E.inCubic(prog(u, 7.1, 8)) : 0;
  const z = push * (P ? 3.0 : 2.6) ** dive;
  const iw = P ? W * 1.9 : W * 0.78;
  const ih = iw * img.height / img.width;
  const cy = P ? H * 0.66 : H * 0.7;
  const fx = lerp(0.5, 0.605, dive), fy = lerp(0.5, 0.55, dive);
  ctx.save();
  ctx.translate(W / 2, cy); ctx.scale(z, z);
  ctx.translate(-iw * fx, -ih * fy);
  ctx.drawImage(img, 0, 0, iw, ih);
  ctx.restore();

  // headline (the site's own h1), word rows rising on the beat; leaves upward on the dive
  const out = o.dive ? E.inBack(prog(u, 7.0, 7.7), 1.4) : 0;
  if (!o.headline) return heroNoHead(ctx, u);
  const size = P ? 112 : 92;
  const rows = P
    ? [[['Research', C.ink], ['peptides,', C.ink]], [['helder', 'grad'], ['en', 'grad'], ['discreet', 'grad']], [['geleverd.', C.ink]]]
    : [[['Research', C.ink], ['peptides,', C.ink], ['helder', 'grad']], [['en', 'grad'], ['discreet', 'grad'], ['geleverd.', C.ink]]];
  const starts = P ? [4.5, 5.25, 6] : [4.5, 5.25];
  const y0 = P ? S.y + 150 : 140;
  ctx.save(); ctx.translate(0, -out * (H * 0.6));
  lines(ctx, rows, W / 2, y0, font(size, 700, DISPLAY), size * 1.08, (i) => springU(u, starts[i] - 0.2, SPRING.snappy), 'center');
  // pill under the headline, as on the site
  const pk = springU(u, 6.4, SPRING.snappy);
  if (pk > 0 && P) {
    ctx.save(); ctx.globalAlpha = clamp(pk);
    pill(ctx, '●  Research use only · Nederland & België', W / 2, y0 + size * 1.08 * (rows.length - 1) + (P ? 60 : 50),
      font(P ? 36 : 30, 500, UI), { stroke: '#14495a', ink: C.cyanHi, fillC: 'rgba(8,40,52,0.7)', h: P ? 76 : 64, padX: 28, align: 'center', scale: lerp(0.8, 1, pk) });
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- S3-5 one vial per promise   (u 8..20)
const USPS = [
  { u0: 8, img: 'v11', n: '01', title: ['COA van', 'jouw batch'], sub: 'Bij elke bestelling', side: 1 },
  { u0: 12, img: 'v6', n: '02', title: ['Discreet', 'verpakt'], sub: 'Neutrale verzending', side: -1 },
  { u0: 16, img: 'v23', n: '03', title: ['1–2', 'werkdagen'], sub: 'NL meestal binnen 1–2 werkdagen · iDEAL', side: 1 },
];
function sUsp(ctx, u, IMG, d) {
  const lu = u - d.u0;
  const vx = P ? W / 2 : (d.side > 0 ? W * 0.3 : W * 0.7);
  const vy = P ? H * 0.33 : H * 0.5;
  bg(ctx, vx / W, vy / H, 1.25);
  // vial: first one drops in with a squash (the drop), the others ride in on the whip
  const vs = P ? 940 : 1000;
  const drop = d.drop ? springU(u, d.u0 - 0.3, SPRING.bouncy) : 1;
  const q = d.drop ? 0.05 * wobble(lu - 0.2, 2.2, 5) : 0;
  const bob = 10 * Math.sin(lu * 0.8);
  const zz = 1.0 * (1.08) ** prog(lu, -0.5, 4);
  ctx.save();
  ctx.translate(vx, vy + vs * 0.42 - (1 - drop) * H * 0.7 + bob);
  ctx.scale(zz * (1 + q), zz * (1 - q));
  ctx.drawImage(IMG[d.img], -vs / 2, -vs * 0.92, vs, vs);
  ctx.restore();

  // copy: number, title (two rows), sub; slides in from the vial's far side
  const tx = P ? S.x + 10 : (d.side > 0 ? W * 0.55 : W * 0.08);
  const ty = P ? H * 0.62 : H * 0.4;
  const tsize = P ? 150 : 140;
  const k = (i) => springU(u, d.u0 + 0.1 + i * 0.35, SPRING.snappy);
  const nk = k(0);
  if (nk > 0) {
    ctx.save(); ctx.globalAlpha = clamp(nk);
    text(ctx, d.n, tx + (1 - nk) * 60, ty - tsize * 0.95, font(P ? 46 : 42, 700, UI), C.cyan, 'left', 6);
    ctx.fillStyle = C.cyan; ctx.fillRect(tx + 80 + (1 - nk) * 60, ty - tsize * 0.95 - 16, 70 * nk, 4);
    ctx.restore();
  }
  lines(ctx, [[[d.title[0], C.ink]], [[d.title[1], 'grad']]], tx, ty, font(tsize, 700, DISPLAY), tsize * 1.0, (i) => k(i));
  const sk = k(2);
  if (sk > 0) {
    ctx.save(); ctx.globalAlpha = clamp(sk);
    const sf = font(P ? 56 : 48, 500, UI);
    const sub = d.sub.split(' · ');
    sub.forEach((s, i) => text(ctx, s, tx + (1 - sk) * 40, ty + tsize * 1.0 + (P ? 100 : 90) + i * (P ? 66 : 58), sf, i ? C.cyanHi : '#cbd5e1'));
    ctx.restore();
  }
}

// ---------------------------------------------------------------- S6 the range: tilted wall of real product photos   (u 20..24)
const WALL = ['p2', 'p5', 'p11', 'p12', 'p14', 'p6', 'p28', 'p24', 'p16', 'p9', 'p22', 'p23', 'p20', 'p17', 'p18', 'p25'];
function sRange(ctx, u, IMG) {
  bg(ctx, 0.5, 0.5, 0.6);
  const lu = u - 20;
  const cell = P ? 360 : 340, gap = 26;
  const scroll = lu * 70;
  const land = springU(u, 19.6, SPRING.gentle);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-0.2);
  ctx.scale(lerp(1.25, 1, land), lerp(1.25, 1, land));
  const cols = 9, rowsN = 9;
  for (let r = -4; r <= 4; r++) {
    const dir = r % 2 ? 1 : -1;
    for (let c = -5; c <= 5; c++) {
      const idx = ((r * 5 + c) % WALL.length + WALL.length * 4) % WALL.length;
      const x = c * (cell + gap) + dir * scroll + (r % 2 ? (cell + gap) / 2 : 0);
      const y = r * (cell + gap);
      rrect(ctx, x - cell / 2, y - cell / 2, cell, cell, 28);
      ctx.fillStyle = C.card; ctx.fill();
      cover(ctx, IMG[WALL[idx]], x - cell / 2, y - cell / 2, cell, cell, { radius: 28, zoom: 1.02 });
      rrect(ctx, x - cell / 2, y - cell / 2, cell, cell, 28);
      ctx.strokeStyle = C.line; ctx.lineWidth = 3; ctx.stroke();
    }
  }
  ctx.restore();

  // dark panel with the claim + a real price card (Big R 20 mg: €140,00 → €112,00 on the site)
  const pk = springU(u, 20.3, SPRING.snappy);
  const pw = P ? W - 2 * S.x : 980, ph = P ? 600 : 520;
  const px = (W - pw) / 2, py = P ? H * 0.5 - ph / 2 : (H - ph) / 2;
  ctx.save();
  ctx.translate(0, (1 - pk) * 500);
  ctx.globalAlpha = clamp(pk * 1.5);
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 80;
  rrect(ctx, px, py, pw, ph, 40); ctx.fillStyle = 'rgba(8,12,24,0.94)'; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = C.line; ctx.lineWidth = 3; ctx.stroke();
  const ix = px + 60;
  text(ctx, 'ASSORTIMENT', ix, py + 100, font(38, 700, UI), C.cyan, 'left', 6);
  text(ctx, '16 producten', ix, py + 215, font(P ? 120 : 112, 700, DISPLAY), C.ink, 'left', -2);
  text(ctx, 'Vaste, duidelijke prijzen', ix, py + 290, font(50, 500, UI), '#cbd5e1');
  if (V !== 'bf') {
    const ok = springU(u, 21.5, SPRING.snappy);
    if (ok > 0) {
      pill(ctx, '●  Op voorraad', ix, py + ph - 200, font(44, 700, UI), { fillC: 'rgba(52,211,153,0.12)', stroke: 'rgba(52,211,153,0.5)', ink: '#6ee7b7', h: 84, padX: 30, scale: ok });
      text(ctx, 'COA bij elke bestelling', ix, py + ph - 50, font(44, 500, UI), C.cyanHi);
    }
  }
  if (V !== 'bf') { ctx.restore(); return; }
  // price row
  const ry = py + ph - 120;
  text(ctx, 'Big R · 20 mg', ix, ry - 70, font(38, 500, UI), C.mute);
  ctx.font = font(72, 700, DISPLAY);
  const ow = ctx.measureText('€140,00').width;
  ctx.fillStyle = C.mute; ctx.fillText('€140,00', ix, ry + 20);
  const st = E.outCubic(prog(u, 22, 22.35));
  if (st > 0) { ctx.fillStyle = C.deal; ctx.fillRect(ix - 6, ry - 6, (ow + 12) * st, 7); }
  const nk = springU(u, 22.5, SPRING.bouncy);
  if (nk > 0) {
    const nx = ix + ow + 40;
    ctx.save(); ctx.translate(nx, ry + 20); ctx.scale(nk, nk);
    text(ctx, '€112,00', 0, 0, font(88, 700, DISPLAY), C.ink);
    ctx.restore();
    const dk = springU(u, 23, SPRING.snappy);
    if (dk > 0) pill(ctx, '−20%', px + pw - 60 - 190, ry - 50, font(46, 700, UI), { fillC: C.deal, ink: C.dealInk, h: 84, padX: 30, scale: dk });
  }
  ctx.restore();
}

// ---------------------------------------------------------------- S7 three steps   (u 24..28)
const STEPS = [['01', 'Kies je producten'], ['02', 'Vul je gegevens in'], ['03', 'Betaal en ontvang']];
function sSteps(ctx, u) {
  bg(ctx, 0.5, 0.3, 0.8);
  const col = E.inBack(prog(u, 27.2, 27.9), 1.6);       // collapse into the logo at the centre
  const tk = springU(u, 23.8, SPRING.snappy);
  ctx.save();
  ctx.translate(W / 2, endLogoY()); ctx.scale(1 - col, 1 - col); ctx.translate(-W / 2, -endLogoY());
  const tx = P ? S.x + 10 : 140, ty = P ? S.y + 170 : 250;
  ctx.save(); ctx.globalAlpha = clamp(tk);
  text(ctx, 'HOE WERKT BESTELLEN', tx, ty - (P ? 150 : 135) + (1 - tk) * 30, font(P ? 40 : 36, 700, UI), C.cyan, 'left', 6);
  ctx.restore();
  lines(ctx, P ? [[['In', C.ink], ['drie', C.ink], ['stappen', C.ink]], [['geregeld', 'grad']]] : [[['In', C.ink], ['drie', C.ink], ['stappen', C.ink], ['geregeld', 'grad']]],
    tx, ty, font(P ? 120 : 110, 700, DISPLAY), P ? 128 : 120, (i) => springU(u, 23.8 + i * 0.25, SPRING.snappy));
  STEPS.forEach(([n, t], i) => {
    const k = springU(u, 24.5 + i * 0.5, SPRING.snappy);
    if (k <= 0) return;
    let x, y, w, h;
    if (P) { w = W - 2 * S.x; h = 236; x = S.x; y = ty + 250 + i * (h + 30); }
    else { w = 520; h = 470; x = 140 + i * (w + 50); y = 420; }
    ctx.save();
    ctx.translate(0, (1 - k) * 260); ctx.globalAlpha = clamp(k * 1.4);
    rrect(ctx, x, y, w, h, 34); ctx.fillStyle = C.card; ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 3; ctx.stroke();
    text(ctx, `STAP ${n}`, x + 48, y + 80, font(36, 700, UI), C.cyan, 'left', 6);
    const big = font(P ? 74 : 70, 700, DISPLAY);
    if (P) text(ctx, t, x + 48, y + 180, big, C.ink);
    else { const ws = t.split(' '); text(ctx, ws.slice(0, 2).join(' '), x + 48, y + 300, big, C.ink); text(ctx, ws.slice(2).join(' '), x + 48, y + 380, big, C.ink); }
    ctx.fillStyle = C.cyan; ctx.fillRect(x + 48, y + h - 40, 90 * clamp(k), 5);
    ctx.restore();
  });
  ctx.restore();
  // the logo hex starts drawing at the point everything collapses into
  if (u > 27.4) logoHex(ctx, W / 2, endLogoY(), 300 * E.outBack(prog(u, 27.4, 28.1)), prog(u, 27.4, 28.2), 0);
}

// ---------------------------------------------------------------- S8 end card   (u 28..32)
const endLogoY = () => (P ? H * 0.34 : H * 0.28);
function sEnd(ctx, u) {
  bg(ctx, 0.5, 0.35, 1.1);
  const ly = endLogoY();
  const lk = 1 + 0.06 * wobble(u - 28, 2, 4);
  logoHex(ctx, W / 2, ly, 300 * lk, prog(u, 27.4, 28.2), springU(u, 28.3, SPRING.bouncy));
  // wordmark as on the site: "NL" white, "Peptides" cyan
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
  // URL as the site's CTA button
  const bk = springU(u, 28.8, SPRING.bouncy);
  const by = wy + (P ? 90 : 70);
  if (bk > 0) {
    const bf = font(P ? 60 : 54, 700, UI);
    ctx.save(); ctx.globalAlpha = clamp(bk);
    ctx.shadowColor = 'rgba(34,211,238,0.35)'; ctx.shadowBlur = 50;
    pill(ctx, 'nlpeptideshop.nl  →', W / 2, by, bf, { fillC: C.cyan, ink: '#04131a', h: P ? 132 : 116, padX: 60, align: 'center', scale: lerp(0.7, 1, bk) });
    ctx.restore();
  }
  // deal + compliance line
  const dk = springU(u, 29.5, SPRING.bouncy);
  if (dk > 0 && V !== 'bf') pill(ctx, 'COA bij elke bestelling · discreet verzonden', W / 2, by + (P ? 175 : 150), font(P ? 40 : 36, 700, UI),
    { fillC: 'rgba(34,211,238,0.10)', stroke: 'rgba(34,211,238,0.5)', ink: C.cyanHi, h: P ? 84 : 74, padX: 34, align: 'center', scale: dk });
  else if (dk > 0) pill(ctx, 'Black Friday: 20% korting t/m 30 nov', W / 2, by + (P ? 175 : 150), font(P ? 42 : 38, 700, UI),
    { fillC: 'rgba(253,230,138,0.12)', stroke: 'rgba(253,230,138,0.55)', ink: C.deal, h: P ? 84 : 74, padX: 34, align: 'center', scale: dk });
  const rk = E.outQuint(prog(u, 30, 30.6));
  ctx.save(); ctx.globalAlpha = rk * 0.9;
  text(ctx, 'Research use only · Nederland & België', W / 2, P ? H - S.y - 40 + 0 : H - 80, font(P ? 36 : 32, 500, UI), C.mute, 'center');
  ctx.restore();
}

// ---------------------------------------------------------------- hero without headline (tijdloos: the hook already said it)
function heroNoHead(ctx, u) {
  const y0 = P ? S.y + 120 : 70;
  const pk = springU(u, 4.3, SPRING.snappy);
  if (pk > 0) {
    ctx.save(); ctx.globalAlpha = clamp(pk);
    pill(ctx, '●  Research use only · Nederland & België', W / 2, y0, font(P ? 38 : 32, 500, UI),
      { stroke: '#14495a', ink: C.cyanHi, fillC: 'rgba(8,40,52,0.7)', h: P ? 80 : 68, padX: 30, align: 'center', scale: lerp(0.8, 1, pk) });
    ctx.restore();
  }
  const rows = P ? [[['Een', C.ink], ['overzichtelijk', C.ink]], [['assortiment', C.ink], ['met', C.ink]], [['vaste', 'grad'], ['prijzen.', 'grad']]]
    : [[['Een', C.ink], ['overzichtelijk', C.ink], ['assortiment', C.ink]], [['met', C.ink], ['vaste', 'grad'], ['prijzen.', 'grad']]];
  const size = P ? 92 : 72;
  lines(ctx, rows, W / 2, y0 + (P ? 210 : 150), font(size, 700, DISPLAY), size * 1.1, (i) => springU(u, 4.8 + i * 0.5, SPRING.snappy), 'center');
}

// ---------------------------------------------------------------- type hook (tijdloos): the site's h1, one row per beat   (orig u 0..4)
function sTypeHook(ctx, u) {
  bg(ctx, 0.5, 0.5, 0.8);
  ctx.save();
  ctx.translate(W / 2, H * 0.5); ctx.rotate(0.15 + u * 0.05);
  const hk = springU(u, -0.6, SPRING.gentle);
  logoHex(ctx, 0, 0, (P ? 1500 : 1300) * lerp(0.6, 1, hk), clamp(hk * 1.1), 0, 0.12);
  ctx.restore();
  const rows = P
    ? [[['Research', C.ink]], [['peptides,', C.ink]], [['helder', 'grad'], ['en', 'grad']], [['discreet', 'grad']], [['geleverd.', C.ink]]]
    : [[['Research', C.ink], ['peptides,', C.ink]], [['helder', 'grad'], ['en', 'grad'], ['discreet', 'grad']], [['geleverd.', C.ink]]];
  const size = P ? 170 : 150, lh = size * 1.02;
  const y0 = H / 2 - (rows.length * lh) / 2 + size * 0.8;
  const starts = P ? [-0.25, 0.5, 1.2, 1.9, 2.6] : [-0.25, 0.9, 2];
  lines(ctx, rows, W / 2, y0, font(size, 700, DISPLAY), lh, (i) => springU(u, starts[i], SPRING.snappy), 'center');
}
const HITS_TYPE = (P ? [-0.25, 0.5, 1.2, 1.9, 2.6] : [-0.25, 0.9, 2]).map((b, i) => [b, 'row', i ? 'tick' : 'impact']);

// ---------------------------------------------------------------- product roll (assortiment): one vial per beat   (orig u 0..8)
const ROLL = [['p2', 'Big R'], ['p6', 'BPC-157'], ['p11', 'NAD+'], ['p9', 'GHK-Cu'], ['p17', 'Semax'], ['p23', 'Klow'], ['p14', 'Tesamorelin'], ['p16', 'KPV']];
function sRoll(ctx, u, IMG) {
  bg(ctx, 0.5, P ? 0.4 : 0.5, 1.2);
  const vs = P ? 900 : 860;
  const vx = P ? W / 2 : W * 0.32, vy = P ? H * 0.36 : H * 0.5;
  const i = clamp(Math.floor(u + 0.4), 0, ROLL.length - 1);
  for (const j of [i - 1, i]) {
    if (j < 0) continue;
    const k = springU(u, j - 0.4, SPRING.snappy), kn = j + 1 < ROLL.length ? springU(u, j + 0.6, SPRING.snappy) : 0;
    const x = vx + (1 - k) * W * 0.9 - kn * W * 0.9;
    ctx.drawImage(IMG['m' + ROLL[j][0]], x - vs / 2, vy - vs / 2, vs, vs);
  }
  // label + counter
  const tx = P ? S.x + 10 : W * 0.6;
  text(ctx, 'ALLE PRODUCTEN', tx, P ? H * 0.66 : H * 0.36, font(P ? 40 : 36, 700, UI), C.cyan, 'left', 6);
  // name: rolls up per beat inside a clip
  const nsize = P ? 150 : 130, ny = P ? H * 0.66 + 175 : H * 0.36 + 160;
  ctx.save(); ctx.beginPath(); ctx.rect(0, ny - nsize * 0.95, W, nsize * 1.25); ctx.clip();
  for (const j of [i - 1, i]) {
    if (j < 0) continue;
    const k = springU(u, j - 0.35, SPRING.snappy), kn = j + 1 < ROLL.length ? springU(u, j + 0.6, SPRING.snappy) : 0;
    text(ctx, ROLL[j][1], tx, ny + (1 - k) * nsize * 1.2 - kn * nsize * 1.2, font(nsize, 700, DISPLAY), j % 2 ? C.ink : C.cyanHi);
  }
  ctx.restore();
  const ck = E.outQuint(prog(u, 0.5, 1.2));
  ctx.save(); ctx.globalAlpha = ck;
  text(ctx, `${String(i + 1).padStart(2, '0')} / 16`, tx, ny + (P ? 100 : 90), font(P ? 48 : 42, 500, UI), '#cbd5e1');
  ctx.restore();
}
const HITS_ROLL = ROLL.map((_, j) => [j - 0.4 + (j ? 0 : 0.15), 'vial', j ? 'pop' : 'impact', { pitch: ['A5', 'C6', 'E6', 'A5', 'D6', 'E6', 'G6', 'A6'][j] }]);

// ---------------------------------------------------------------- help (vertrouwen): the site's contact block   (orig u 0..4)
function sHelp(ctx, u) {
  bg(ctx, 0.5, 0.35, 0.9);
  const tx = P ? S.x + 10 : 140, ty = P ? S.y + 230 : 300;
  const tk = springU(u, -0.3, SPRING.snappy);
  ctx.save(); ctx.globalAlpha = clamp(tk);
  text(ctx, 'CONTACT', tx, ty - (P ? 170 : 150), font(P ? 40 : 36, 700, UI), C.cyan, 'left', 6);
  ctx.restore();
  lines(ctx, [[['Vragen?', C.ink]], [['We', 'grad'], ['helpen', 'grad'], ['je', 'grad'], ['graag.', 'grad']]], tx, ty, font(P ? 100 : 120, 700, DISPLAY), P ? 112 : 130,
    (i) => springU(u, -0.3 + i * 0.4, SPRING.snappy));
  const cards = [['Word lid van de', 'WhatsApp-community', '#25d366'], ['Liever mailen?', 'We reageren snel', C.cyan]];
  cards.forEach(([a, b, col], i) => {
    const k = springU(u, 1 + i * 0.5, SPRING.snappy);
    if (k <= 0) return;
    let x, y, w, h;
    if (P) { w = W - 2 * S.x; h = 230; x = S.x; y = ty + 220 + i * (h + 30); }
    else { w = 780; h = 260; x = 140 + i * (w + 60); y = 560; }
    ctx.save(); ctx.translate(0, (1 - k) * 240); ctx.globalAlpha = clamp(k * 1.4);
    rrect(ctx, x, y, w, h, 34); ctx.fillStyle = C.card; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 80, y + h / 2, 34, 0, TAU); ctx.fillStyle = col; ctx.fill();
    text(ctx, a, x + 150, y + h / 2 - 12, font(P ? 46 : 44, 500, UI), '#cbd5e1');
    text(ctx, b, x + 150, y + h / 2 + 58, font(P ? 64 : 60, 700, DISPLAY), C.ink);
    ctx.restore();
  });
}
const HITS_HELP = [[-0.3, 'title', 'thud'], [1, 'card 1', 'pop', { pitch: 'A5' }], [1.5, 'card 2', 'pop', { pitch: 'E6' }]];

// ---------------------------------------------------------------- edit per variant
// Each scene: [start beat, draw fn, the beat its internal timings were written for, opts, its own hits (orig beats)]
const usp = (i, drop) => (c, u, I) => sUsp(c, u, I, { ...USPS[i], drop });
const HITS_HOOK = [[-0.25, 'minus', 'impact'], [0.5, 'two', 'pop', { pitch: 'A5' }], [1, 'zero', 'pop', { pitch: 'C6' }], [1.5, 'percent', 'pop', { pitch: 'E6' }], [2, 'op alles', 'tick']];
const HITS_HERO_HEAD = [[4.5, 'h1', 'tick'], [5.25, 'h2', 'tick'], [6, 'h3', 'tick']];
const HITS_HERO_NOHEAD = [[4.3, 'pill', 'pop', { pitch: 'A5' }], [4.8, 'r1', 'tick'], [5.3, 'r2', 'tick'], [5.8, 'r3', 'tick']];
const HITS_DIVE = [[7.3, 'push into vial', 'whoosh', { len: 0.5, from: 500, to: 2600 }]];
const HITS_USP = (b) => [[b, 'usp', 'thud']];
const HITS_RANGE = V === 'bf' ? [[20, 'range', 'thud'], [22, 'strike', 'tick'], [22.5, 'price', 'pop', { pitch: 'A5' }]] : [[20, 'range', 'thud'], [21.5, 'op voorraad', 'pop', { pitch: 'A5' }]];
const HITS_STEPS = [[24, 'steps', 'impact'], [24.5, 's1', 'tick'], [25, 's2', 'tick'], [25.5, 's3', 'tick'], [27.3, 'collapse', 'whoosh', { len: 0.5, from: 2400, to: 500 }]];
const HITS_END = [[28, 'end', 'impact'], [28.5, 'logo', 'bell', { pitch: 'A5' }], [29.5, 'pill', 'pop', { pitch: 'E6' }]];

const hero = (o) => (c, u, I) => sHero(c, u, I, o);
const EDITS = {
  bf: [[0, sHook, 0, HITS_HOOK], [4, hero({ headline: true, dive: true }), 4, [...HITS_HERO_HEAD, ...HITS_DIVE]], [8, usp(0, true), 8, HITS_USP(8)],
    [12, usp(1), 12, HITS_USP(12)], [16, usp(2), 16, HITS_USP(16)], [20, sRange, 20, HITS_RANGE], [24, sSteps, 24, HITS_STEPS], [28, sEnd, 28, HITS_END]],
  tijdloos: [[0, sTypeHook, 0, HITS_TYPE], [4, hero({ headline: false, dive: true }), 4, [...HITS_HERO_NOHEAD, ...HITS_DIVE]], [8, usp(0, true), 8, HITS_USP(8)],
    [12, usp(1), 12, HITS_USP(12)], [16, usp(2), 16, HITS_USP(16)], [20, sRange, 20, HITS_RANGE], [24, sSteps, 24, HITS_STEPS], [28, sEnd, 28, HITS_END]],
  assortiment: [[0, sRoll, 0, HITS_ROLL], [8, hero({ headline: true, dive: false }), 4, HITS_HERO_HEAD], [12, sRange, 20, HITS_RANGE],
    [16, usp(0), 8, HITS_USP(8)], [20, usp(1), 12, HITS_USP(12)], [24, sSteps, 24, HITS_STEPS], [28, sEnd, 28, HITS_END]],
  vertrouwen: [[0, usp(0, true), 8, HITS_USP(8)], [4, usp(1), 12, HITS_USP(12)], [8, usp(2), 16, HITS_USP(16)], [12, hero({ headline: true, dive: false }), 4, HITS_HERO_HEAD],
    [16, sRange, 20, HITS_RANGE], [20, sHelp, 0, HITS_HELP], [24, sSteps, 24, HITS_STEPS], [28, sEnd, 28, HITS_END]],
};
const SCENES = EDITS[V];
// whip on every boundary except into the end card (cards collapse into the logo) and out of a hero that dives
const DIRS = [[1, 0], [-1, 0], [0, 1]];
const WHIPS = {};
SCENES.forEach(([b], i) => {
  if (i === 0) return;
  const prev = SCENES[i - 1];
  if (SCENES[i][1] === sEnd) return;
  if (V === 'bf' || V === 'tijdloos') { if (b === 8) return; }   // hero dives into the NAD+ vial: match cut
  WHIPS[b] = DIRS[Object.keys(WHIPS).length % 3];
});
const HITS = [];
SCENES.forEach(([s, , o, hits]) => hits.forEach(([b, ...rest]) => HITS.push([b + s - o, ...rest])));
Object.keys(WHIPS).forEach((b, i) => HITS.push([Number(b) - 0.5, 'whip', 'whoosh', { len: 0.45, from: i % 2 ? 2400 : 600, to: i % 2 ? 600 : 2400, pan: i % 2 ? 0.3 : -0.3 }]));
HITS.sort((a, b) => a[0] - b[0]);

function sceneAt(u) { let i = 0; while (i + 1 < SCENES.length && u >= SCENES[i + 1][0]) i++; return i; }
const drawScene = (i, ctx, u, IMG) => { const [s, f, o] = SCENES[i]; f(ctx, u - s + o, IMG); };

function mask(img, { rx = 0.62, ry = 1.2, inner = 0.38, cy = 0.5, edge = null } = {}) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); const w = c.width, h = c.height;
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'destination-in';
  if (edge) {
    const m = document.createElement('canvas'); m.width = w; m.height = h;
    const mx = m.getContext('2d');
    const gx = mx.createLinearGradient(0, 0, w, 0);
    gx.addColorStop(0, 'rgba(0,0,0,0)'); gx.addColorStop(edge, '#000'); gx.addColorStop(1 - edge, '#000'); gx.addColorStop(1, 'rgba(0,0,0,0)');
    mx.fillStyle = gx; mx.fillRect(0, 0, w, h);
    mx.globalCompositeOperation = 'destination-in';
    const gy = mx.createLinearGradient(0, 0, 0, h);
    gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(0.12, '#000'); gy.addColorStop(0.8, '#000'); gy.addColorStop(1, 'rgba(0,0,0,0)');
    mx.fillStyle = gy; mx.fillRect(0, 0, w, h);
    x.drawImage(m, 0, 0);
  } else {
    x.translate(w / 2, h * cy); x.scale(rx, ry);
    const g = x.createRadialGradient(0, 0, w * inner, 0, 0, w * 0.5);
    g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(-w, -h, 2 * w, 2 * h);
  }
  return c;
}

M.film({
  fonts: [font(100, 700, DISPLAY), font(40, 500, UI), font(40, 700, UI)],
  images: Object.fromEntries([['hero', 'assets/products/hero.png'], ...WALL.map((k) => [k, `assets/products/${k}.png`])]),
  hits: HITS,
  init(ctx, IMG) {
    IMG.heroM = mask(IMG.hero, { edge: 0.08 });
    IMG.v11 = mask(IMG.p11); IMG.v6 = mask(IMG.p6); IMG.v23 = mask(IMG.p23);
    if (V === 'assortiment') ROLL.forEach(([k]) => { IMG['m' + k] = mask(IMG[k]); });
  },
  draw(ctx, u, t, IMG) {
    for (const [b, [dx, dy]] of Object.entries(WHIPS).map(([b, v]) => [Number(b), v])) {
      if (u >= b - 0.5 && u < b + 0.12) {
        const e = E.inOutCubic(prog(u, b - 0.5, b + 0.12));
        ctx.save(); ctx.translate(-dx * e * W, -dy * e * H); drawScene(sceneAt(b - 0.01), ctx, u, IMG); ctx.restore();
        ctx.save(); ctx.translate(dx * (1 - e) * W, dy * (1 - e) * H); drawScene(sceneAt(b), ctx, u, IMG); ctx.restore();
        return;
      }
    }
    drawScene(sceneAt(u), ctx, u, IMG);
  },
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
