// ITide Laboratories promo. Pure function of time; beats on the 96 bpm grid. Variant from film.json: sale | brand.
// Assets: crops of the client's own screenshots of itidelabs.com (assets/products/*.png).
import * as M from './lib/motion.js';
const { W, H, FORMAT, E, TAU, prog, lerp, clamp, springU, SPRING, wobble, font, text, rrect, cover, fitSize, hash01 } = M;
const CFG0 = await fetch('film.json').then((r) => r.json());
const V = CFG0.variant || 'sale';
const P = FORMAT.portrait, S = FORMAT.safe;
const C = { paper: '#f3f4f6', white: '#ffffff', navy: '#0f1b2d', navy2: '#16253d', ink: '#0b1220', mute: '#5b6472', blue: '#1f5fbf', blueHi: '#3b82f6', red: '#d7262f', redHi: '#ef4444' };
const DISPLAY = 'Display', UI = 'UI';
const DARK = V === 'brand' || V === 'quality' || V === 'hero';
const BG = DARK ? C.navy : C.paper, FG = DARK ? C.white : C.navy;

let BGU = 0;
function bg(ctx, col = BG) {
  ctx.fillStyle = col; ctx.fillRect(0, 0, W, H);
  if (V === 'quality' && col === BG) {
    const sz = P ? 260 : 280; ctx.save(); ctx.font = font(sz, 700, DISPLAY);
    const word = '99% PURITY  ·  ', ww = ctx.measureText(word).width;
    [0.2, 0.52, 0.84].forEach((fy, r) => {
      const off = ((BGU * 110 * (r % 2 ? 1 : -1) + r * 300) % ww + ww) % ww;
      ctx.strokeStyle = 'rgba(147,197,253,0.13)'; ctx.lineWidth = 3;
      for (let x = -off; x < W; x += ww) ctx.strokeText(word, x, H * fy);
    });
    ctx.restore();
  }
  if (DARK) {
    const g = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, Math.max(W, H) * 0.7);
    g.addColorStop(0, 'rgba(59,130,246,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
}
// condensed caps, per-row rise inside a clip (rows: [[str, color], ...] one per line)
function rows(ctx, list, x, y, size, lh, appear, align = 'left', track = 0) {
  list.forEach(([str, col], i) => {
    const k = appear(i); if (k <= 0) return;
    ctx.save(); ctx.beginPath(); ctx.rect(0, y + i * lh - size * 0.95, W, size * 1.1); ctx.clip();
    text(ctx, str, x, y + i * lh + (1 - clamp(k)) * size * 1.05, font(size, 700, DISPLAY), col, align, track);
    ctx.restore();
  });
}
function chip(ctx, label, x, y, size, { fillC, ink, dash, stroke, h, padX = 30, align = 'left', scale = 1, f = DISPLAY, w8 = 700, track = 2 } = {}) {
  ctx.font = font(size, w8, f); ctx.letterSpacing = `${track}px`;
  const w = ctx.measureText(label).width + padX * 2; h = h || size * 1.7;
  const x0 = align === 'center' ? x - w / 2 : x;
  ctx.save(); ctx.translate(x0 + w / 2, y + h / 2); ctx.scale(scale, scale); ctx.translate(-(x0 + w / 2), -(y + h / 2));
  rrect(ctx, x0, y, w, h, 12);
  if (fillC) { ctx.fillStyle = fillC; ctx.fill(); }
  if (stroke) { ctx.setLineDash(dash ? [12, 8] : []); ctx.strokeStyle = stroke; ctx.lineWidth = 4; ctx.stroke(); ctx.setLineDash([]); }
  ctx.fillStyle = ink; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillText(label, x0 + padX, y + h / 2 + 2);
  ctx.textBaseline = 'alphabetic'; ctx.restore(); ctx.letterSpacing = '0px';
  return w;
}
function card(ctx, img, x, y, w, h, opt = {}) {
  ctx.save(); ctx.shadowColor = 'rgba(15,27,45,0.35)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
  rrect(ctx, x, y, w, h, 34); ctx.fillStyle = C.white; ctx.fill(); ctx.restore();
  cover(ctx, img, x, y, w, h, { radius: 34, ...opt });
}
// wordmark: "ITide" + LABORATORIES rule, set in the brand's condensed style
function wordmark(ctx, cx, y, size, col, k = 1) {
  ctx.save(); ctx.globalAlpha = clamp(k);
  ctx.font = font(size, 700, DISPLAY); const a = ctx.measureText('IT').width;
  ctx.font = font(size, 500, UI); const b = ctx.measureText('ide').width;
  const x = cx - (a + b) / 2;
  text(ctx, 'IT', x, y, font(size, 700, DISPLAY), col);
  text(ctx, 'ide', x + a, y, font(size * 0.98, 500, UI), col, 'left', -size * 0.02);
  text(ctx, 'LABORATORIES', cx, y + size * 0.42, font(size * 0.16, 500, UI), DARK ? '#93c5fd' : C.blue, 'center', size * 0.07);
  ctx.fillStyle = DARK ? '#93c5fd' : C.blue; ctx.fillRect(cx - (a + b) * 0.52, y + size * 0.52, (a + b) * 1.04 * clamp(k), 4);
  ctx.restore();
}
// FOR RESEARCH USE ONLY band (as on the site)
function band(ctx, y, h, u, col = C.navy, ink = 'rgba(255,255,255,0.75)', speed = 90) {
  ctx.fillStyle = col; ctx.fillRect(0, y, W, h);
  ctx.font = font(h * 0.42, 500, UI); ctx.letterSpacing = `${h * 0.08}px`;
  const s = 'FOR RESEARCH USE ONLY  ·  ', sw = ctx.measureText(s).width;
  const off = ((u * speed) % sw + sw) % sw;
  ctx.fillStyle = ink; ctx.textBaseline = 'middle';
  for (let x = -off; x < W; x += sw) ctx.fillText(s, x, y + h / 2 + 2);
  ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '0px';
}

// ---------------------------------------------------------------- scenes (local beats, each 4 long unless noted)
function sSaleHook(ctx, u) {          // red sale banner as on the site: HOLIDAY SALE · 25% OFF · XMAS25
  bg(ctx, C.red);
  // lights string along the top edge, like the site's banner
  for (let i = 0; i < 24; i++) {
    const x = (i + 0.5) * W / 24, y = (P ? 210 : 120) + 18 * Math.sin(i * 1.1);
    const on = 0.5 + 0.5 * Math.sin(u * 3 + i * 1.7);
    ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fillStyle = ['#fde047', '#22c55e', '#60a5fa', '#f472b6'][i % 4]; ctx.globalAlpha = 0.5 + 0.5 * on; ctx.fill(); ctx.globalAlpha = 1;
  }
  const k = (i) => springU(u, -0.3 + i * 0.5, SPRING.snappy);
  const cx = W / 2;
  rows(ctx, [['HOLIDAY SALE', '#fff']], cx, P ? H * 0.36 : H * 0.3, P ? 130 : 120, 0, k, 'center', 6);
  const big = Math.min(P ? 330 : 300, fitSize(ctx, '25% OFF', 700, DISPLAY, P ? S.w : W * 0.8, 400, 0.04));
  const pk = springU(u, 0.5, SPRING.bouncy);
  if (pk > 0) {
    ctx.save(); ctx.translate(cx, P ? H * 0.56 : H * 0.64); const q = 0.08 * wobble(u - 0.7, 2.2, 5); ctx.scale(pk * (1 + q), pk * (1 - q));
    text(ctx, '25% OFF', 0, 0, font(big, 700, DISPLAY), '#fff', 'center', 4); ctx.restore();
  }
  const ck = springU(u, 1.5, SPRING.bouncy);
  if (ck > 0) chip(ctx, 'XMAS25', cx, P ? H * 0.62 : H * 0.72, P ? 90 : 72, { stroke: '#fff', dash: true, ink: '#fff', align: 'center', scale: ck, padX: 44, track: 8 });
  const tk = E.outQuint(prog(u, 2.2, 2.8));
  ctx.save(); ctx.globalAlpha = tk;
  text(ctx, 'USE CODE AT CHECKOUT', cx, P ? H * 0.62 + 230 : H * 0.72 + 170, font(P ? 44 : 38, 500, UI), 'rgba(255,255,255,0.85)', 'center', 6);
  ctx.restore();
}
function sBrandHook(ctx, u) {         // wordmark builds, then RESEARCH-GRADE
  bg(ctx);
  const wk = springU(u, -0.3, SPRING.gentle);
  ctx.save(); ctx.translate(W / 2, H * (P ? 0.42 : 0.45)); const z = lerp(1.25, 1, wk); ctx.scale(z, z); ctx.translate(-W / 2, -H * (P ? 0.42 : 0.45));
  wordmark(ctx, W / 2, H * (P ? 0.42 : 0.45), P ? 300 : 280, C.white, wk);
  ctx.restore();
  rows(ctx, [['RESEARCH-GRADE', C.blueHi]], W / 2, H * (P ? 0.62 : 0.78), P ? 110 : 100, 0, () => springU(u, 1.4, SPRING.snappy), 'center', 6);
}
function sHeroPhoto(ctx, u, IMG) {    // the site's hero photo: ITide sign + four vials, slow push
  bg(ctx);
  const k = springU(u, -0.4, SPRING.gentle);
  const w = P ? W - 2 * 50 : W * 0.5, h = P ? w * 1.09 : H * 0.86;
  const x = P ? (W - w) / 2 : W * 0.05, y = P ? H * 0.335 : (H - h) / 2;
  ctx.save(); ctx.translate(0, (1 - k) * H * 0.6);
  card(ctx, IMG.hero, x, y, w, h, { zoom: 1.0 * 1.04 ** prog(u, 0, 4), fy: P ? 0.55 : 0.3 });
  ctx.restore();
  const tx = P ? S.x + 10 : W * 0.6, ty = P ? S.y + 100 : H * 0.42;
  const hs = P ? Math.min(130, fitSize(ctx, V !== 'sale' ? 'RESEARCH-GRADE' : 'ALL PEPTIDES', 700, DISPLAY, S.w, 130, 0.02)) : Math.min(110, fitSize(ctx, V !== 'sale' ? 'RESEARCH-GRADE' : 'ALL PEPTIDES', 700, DISPLAY, W * 0.36, 130, 0.02));
  rows(ctx, [[V !== 'sale' ? 'RESEARCH-GRADE' : 'ALL PEPTIDES', FG], [V !== 'sale' ? 'PEPTIDES.' : '25% OFF.', V !== 'sale' ? (DARK ? C.blueHi : C.blue) : C.red]], tx, ty, hs, hs * 1.02,
    (i) => springU(u, 0.4 + i * 0.4, SPRING.snappy), 'left', 2);
  const sk = E.outQuint(prog(u, 1.4, 2));
  ctx.save(); ctx.globalAlpha = sk;
  text(ctx, '99% PURITY · ITIDELABS.COM', tx, ty + (P ? 225 : 220), font(P ? 40 : 34, 500, UI), DARK ? '#93c5fd' : C.blue, 'left', 5);
  ctx.restore();
}
const VIALS = [['v_bpc', 'BPC-157', '10MG', 0.9], ['v_tb500', 'TB-500', '10MG', 0.5], ['v_nad', 'NAD+', '500MG', 0.5]];
// a cut-out vial standing on the floor line, with a soft shadow and a faint reflection
function vialOn(ctx, im, cx, floor, h, alpha = 1) {
  const w = h * im.width / im.height;
  ctx.save(); ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(cx, floor, 0, cx, floor, w * 0.7);
  g.addColorStop(0, DARK ? 'rgba(0,0,0,0.55)' : 'rgba(15,27,45,0.28)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.save(); ctx.translate(cx, floor); ctx.scale(1, 0.18); ctx.beginPath(); ctx.arc(0, 0, w * 0.7, 0, TAU); ctx.fill(); ctx.restore();
  ctx.drawImage(im, cx - w / 2, floor - h, w, h);
  ctx.restore();
}
const LINE = [['tb500', 'TB-500', '10MG'], ['nad', 'NAD+', '500MG'], ['glow', 'GLOW', '70MG'], ['klow', 'KLOW', '80MG']];
function sLineup(ctx, u, IMG) {
  bg(ctx);
  const n = LINE.length, slot = P ? (W - 2 * 40) / n : 360;
  const x0 = W / 2 - (slot * (n - 1)) / 2, floor0 = H * 0.72, vh = P ? 470 : 600;
  LINE.forEach(([img, name, mg], i) => {
    const k = springU(u, -0.3 + i * 0.4, SPRING.bouncy); if (k <= 0) return;
    const cx = P ? W / 2 + (i % 2 ? 1 : -1) * W * 0.23 : x0 + i * slot, im = IMG['cut_' + img];
    const floor = P ? (i < 2 ? H * 0.44 : H * 0.8) : floor0;
    const q = 0.05 * wobble(u + 0.3 - i * 0.4 - 0.2, 2.2, 5);
    ctx.save(); ctx.translate(cx, floor); ctx.scale(1 + q, 1 - q); ctx.translate(-cx, -floor);
    vialOn(ctx, im, cx, floor - (1 - k) * 260, vh, clamp(k * 1.5));
    ctx.restore();
    const lk = springU(u, 0.3 + i * 0.4, SPRING.snappy); if (lk <= 0) return;
    ctx.save(); ctx.globalAlpha = clamp(lk);
    text(ctx, name, cx, floor + (P ? 110 : 100) + (1 - lk) * 30, font(P ? 54 : 56, 700, DISPLAY), FG, 'center', 1);
    text(ctx, mg + ' · 99%', cx, floor + (P ? 158 : 146) + (1 - lk) * 30, font(P ? 28 : 28, 500, UI), C.mute, 'center', 3);
    ctx.restore();
  });
  rows(ctx, [['THE CATALOGUE', FG]], W / 2, P ? S.y + 120 : 150, P ? 120 : 100, 0, () => springU(u, -0.3, SPRING.snappy), 'center', 4);
}
function sPrice(ctx, u, IMG) {        // Big R 20mg: $125.00 -> $85.00 (the site's product page)
  bg(ctx);
  const k = springU(u, -0.3, SPRING.gentle);
  const vh = P ? 760 : 760, vw = vh * 0.43;
  const vx = P ? W / 2 - vw / 2 : W * 0.26, vy = P ? S.y + 60 : (H - vh) / 2 - 20;
  ctx.save(); ctx.translate(0, (1 - k) * H * 0.5);
  vialOn(ctx, IMG.cut_bigr, vx + vw / 2, vy + vh, vh);
  ctx.restore();
  const tx = P ? S.x + 10 : W * 0.56, ty = P ? vy + vh + 150 : H * 0.42;
  rows(ctx, [['BIG R 20MG', FG]], tx, ty, P ? 130 : 130, 0, () => springU(u, 0.3, SPRING.snappy), 'left', 2);
  if (V === 'sale') {
    const pf = font(P ? 80 : 80, 700, DISPLAY);
    const ok = springU(u, 1, SPRING.snappy);
    if (ok > 0) {
      ctx.save(); ctx.globalAlpha = clamp(ok);
      text(ctx, '$125.00', tx, ty + 130, pf, C.mute); ctx.font = pf; const ow = ctx.measureText('$125.00').width;
      const st = E.outCubic(prog(u, 1.5, 1.85)); ctx.fillStyle = C.mute; ctx.fillRect(tx - 6, ty + 100, (ow + 12) * st, 7);
      ctx.restore();
      const nk = springU(u, 2, SPRING.bouncy);
      if (nk > 0) { ctx.save(); ctx.translate(tx + ow + 40, ty + 130); ctx.scale(nk, nk); text(ctx, '$85.00', 0, 0, font(P ? 110 : 110, 700, DISPLAY), C.red); ctx.restore(); }
    }
  } else {
    const sk = E.outQuint(prog(u, 1, 1.6));
    ctx.save(); ctx.globalAlpha = sk;
    text(ctx, '20MG · 99% PURITY', tx, ty + 90, font(P ? 50 : 46, 500, UI), '#93c5fd', 'left', 4);
    text(ctx, 'Not for human or veterinary use.', tx, ty + 170, font(P ? 42 : 38, 500, UI), 'rgba(255,255,255,0.65)');
    ctx.restore();
  }
}
function sVial(ctx, u, IMG, [img, name, mg, fx], side) {   // brand: one vial per 4 beats, big
  bg(ctx);
  const k = springU(u, -0.5, SPRING.gentle);
  const vw = P ? 640 : 480, vh = vw * 1.85;
  const vx = P ? W / 2 - vw / 2 : (side > 0 ? W * 0.14 : W * 0.86 - vw), vy = P ? S.y + 20 : (H - vh) / 2;
  ctx.save(); ctx.translate(0, (1 - k) * 200);
  card(ctx, IMG[img], vx, vy, vw, vh, { fx, fy: 0.35, zoom: 1.0 * 1.08 ** prog(u, 0, 4) });
  ctx.restore();
  const tx = P ? S.x + 10 : (side > 0 ? W * 0.54 : W * 0.1), ty = P ? vy + vh + 170 : H * 0.48;
  rows(ctx, [[name, C.white], [mg, C.blueHi]], tx, ty, P ? 170 : 170, P ? 160 : 160, (i) => springU(u, 0.2 + i * 0.35, SPRING.snappy), 'left', 2);
  const sk = E.outQuint(prog(u, 1, 1.6));
  ctx.save(); ctx.globalAlpha = sk;
  text(ctx, '99% PURITY · RESEARCH USE ONLY', tx, ty + (P ? 250 : 250), font(P ? 38 : 34, 500, UI), '#93c5fd', 'left', 5);
  ctx.restore();
}
function sKlow(ctx, u, IMG) {
  bg(ctx);
  const k = springU(u, -0.4, SPRING.gentle);
  const w = P ? W - 2 * 40 : W * 0.5, h = w * IMG.klow_card.height / IMG.klow_card.width;
  const x = P ? 40 : W * 0.06, y = P ? H * 0.36 : (H - h) / 2;
  ctx.save(); ctx.translate((1 - k) * (P ? 0 : -W * 0.6), (1 - k) * (P ? H * 0.5 : 0));
  card(ctx, IMG.klow_card, x, y, w, h, { zoom: 1.0 * 1.06 ** prog(u, 0, 4) });
  ctx.restore();
  const tx = P ? S.x + 10 : W * 0.62, ty = P ? S.y + 110 : H * 0.4;
  rows(ctx, [['KLOW 80MG', C.white], ['BPC-157 · TB-500', C.blueHi], ['GHK-CU · KPV', C.blueHi]], tx, ty, P ? 110 : 96, P ? 112 : 100, (i) => springU(u, 0.3 + i * 0.3, SPRING.snappy), 'left', 2);
  const sk = E.outQuint(prog(u, 1.4, 2));
  ctx.save(); ctx.globalAlpha = sk;
  text(ctx, '99% PURITY · NOT FOR HUMAN OR VETERINARY USE', tx, ty + (P ? 300 : 270), font(P ? 30 : 26, 500, UI), '#93c5fd', 'left', 4);
  ctx.restore();
}
const CARDS = {
  ipa: ['c_ipamorelin', 'IPAMORELIN', '10MG'], glow: ['c_glow', 'GLOW', '70MG'], cagri: ['c_cagri', 'CAGRILINTIDE', '10MG'],
  bigt: ['c_bigt', 'BIG T', '50MG'], klow: ['c_klow', 'KLOW', '80MG'],
};
function sCard(ctx, u, IMG, key, side = 1) {
  bg(ctx);
  const [img, name, mg] = CARDS[key], im = IMG[img];
  const k = springU(u, -0.5, SPRING.gentle);
  const w = P ? Math.min(im.width * 1.04, W - 80) : 820, h = w * im.height / im.width;
  const x = P ? (W - w) / 2 : (side > 0 ? W * 0.06 : W * 0.94 - w), y = P ? S.y + 10 : (H - h) / 2;
  ctx.save(); ctx.translate((1 - k) * side * (P ? 0 : -W * 0.5), (1 - k) * (P ? H * 0.4 : 0));
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 70; ctx.shadowOffsetY = 26;
  rrect(ctx, x, y, w, h, 30); ctx.fillStyle = C.navy; ctx.fill(); ctx.restore();
  cover(ctx, im, x, y, w, h, { radius: 30, zoom: 1.0 * 1.03 ** prog(u, 0, 4) });
  ctx.restore();
  const tx = P ? S.x + 10 : (side > 0 ? W * 0.56 : W * 0.08), ty = P ? y + h + 170 : H * 0.42;
  const ns = Math.min(P ? 150 : 140, fitSize(ctx, name, 700, DISPLAY, P ? S.w : W * 0.38, 160, 0.02));
  rows(ctx, [[name, FG], [mg + ' · 99%', DARK ? C.blueHi : C.blue]], tx, ty, ns, ns * 0.95, (i) => springU(u, 0.2 + i * 0.35, SPRING.snappy), 'left', 2);
  const ck = springU(u, 1.2, SPRING.snappy);
  if (ck > 0) chip(ctx, 'CERTIFICATE OF ANALYSIS', tx, ty + ns + (P ? 40 : 40), P ? 38 : 34,
    { stroke: DARK ? '#93c5fd' : C.blue, ink: DARK ? '#93c5fd' : C.blue, scale: ck, f: UI, w8: 700, track: 4, padX: 28 });
}
function cardGrid(ctx, u, IMG, alpha) {
  const keys = ['ipa', 'glow', 'cagri', 'bigt', 'klow', 'ipa'];
  const cs = P ? 470 : 440, gap = 30, cols = P ? 2 : 4;
  const rowsN = P ? 4 : 2;
  const gw = cols * cs + (cols - 1) * gap, x0 = (W - gw) / 2 - (u * 20) % (cs + gap) + (cs + gap) / 2;
  ctx.save(); ctx.globalAlpha = alpha;
  for (let r = 0; r < rowsN + 1; r++) for (let c = -1; c < cols + 1; c++) {
    const im = IMG[CARDS[keys[(r * 3 + c + 12) % keys.length]][0]];
    const x = x0 + c * (cs + gap), y = (P ? 200 : 40) + r * (cs + gap) - (u * 30) % (cs + gap);
    rrect(ctx, x, y, cs, cs, 24); ctx.fillStyle = C.navy; ctx.fill();
    cover(ctx, im, x, y, cs, cs, { radius: 24 });
  }
  ctx.restore();
}
// roll: the product cards one after another, 2.4 beats each, both on screen during the slide
const ROLLK = ['ipa', 'glow', 'cagri', 'bigt', 'klow'];
function sRollCards(ctx, u, IMG) {
  bg(ctx);
  const SL = 2.4, i = clamp(Math.floor((u + 0.4) / SL), 0, ROLLK.length - 1);
  for (const j of [i - 1, i]) {
    if (j < 0) continue;
    const im = IMG[CARDS[ROLLK[j]][0]];
    const k = springU(u, j * SL - 0.4, SPRING.snappy), kn = j + 1 < ROLLK.length ? springU(u, (j + 1) * SL - 0.4, SPRING.snappy) : 0;
    const w = P ? 880 : 800, h = w * im.height / im.width;
    const cx = (P ? W / 2 : W * 0.3) + (1 - k) * W - kn * W, y = P ? S.y + 20 : (H - h) / 2;
    ctx.save(); ctx.shadowColor = 'rgba(15,27,45,0.35)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
    rrect(ctx, cx - w / 2, y, w, h, 30); ctx.fillStyle = C.navy; ctx.fill(); ctx.restore();
    cover(ctx, im, cx - w / 2, y, w, h, { radius: 30 });
  }
  const tx = P ? S.x + 10 : W * 0.6, ty = P ? H * 0.7 : H * 0.48;
  text(ctx, 'THE CATALOGUE', tx, ty - (P ? 150 : 160), font(P ? 40 : 36, 700, UI), DARK ? '#93c5fd' : C.blue, 'left', 6);
  ctx.save(); ctx.beginPath(); ctx.rect(0, ty - 160, W, 190); ctx.clip();
  for (const j of [i - 1, i]) {
    if (j < 0) continue;
    const k = springU(u, j * SL - 0.35, SPRING.snappy), kn = j + 1 < ROLLK.length ? springU(u, (j + 1) * SL - 0.35, SPRING.snappy) : 0;
    const name = CARDS[ROLLK[j]][1], ns = Math.min(150, fitSize(ctx, name, 700, DISPLAY, P ? S.w : W * 0.36, 150, 0.02));
    text(ctx, name, tx, ty + (1 - k) * 180 - kn * 180, font(ns, 700, DISPLAY), j % 2 ? (DARK ? C.blueHi : C.blue) : FG, 'left', 2);
  }
  ctx.restore();
  const mi = clamp(Math.floor((u + 0.1) / SL), 0, ROLLK.length - 1);
  text(ctx, `${CARDS[ROLLK[mi]][2]} · 99% PURITY`, tx, ty + (P ? 80 : 75), font(P ? 44 : 40, 500, UI), DARK ? 'rgba(255,255,255,0.7)' : C.mute, 'left', 4);
}
// quality statements, one per beat
function sQuality(ctx, u) {
  bg(ctx);
  const cx = W / 2;
  const k = (i) => springU(u, -0.3 + i * 0.8, SPRING.bouncy);
  const big = P ? 380 : 340;
  const k0 = k(0);
  if (k0 > 0) { ctx.save(); ctx.translate(cx, H * (P ? 0.4 : 0.45)); ctx.scale(k0, k0); text(ctx, '99%', 0, 0, font(big, 700, DISPLAY), FG, 'center', 2); ctx.restore(); }
  rows(ctx, [['PURITY', DARK ? C.blueHi : C.blue]], cx, H * (P ? 0.4 : 0.45) + (P ? 150 : 130), P ? 130 : 110, 0, () => springU(u, 0.2, SPRING.snappy), 'center', 10);
  const c1 = k(1);
  if (c1 > 0) chip(ctx, 'CERTIFICATE OF ANALYSIS', cx, H * (P ? 0.55 : 0.68), P ? 52 : 44, { fillC: DARK ? C.blue : C.navy, ink: '#fff', align: 'center', scale: c1, f: UI, w8: 700, track: 5, padX: 40 });
  const c2 = k(2);
  if (c2 > 0) chip(ctx, 'FOR RESEARCH USE ONLY', cx, H * (P ? 0.55 : 0.68) + (P ? 150 : 120), P ? 44 : 38, { stroke: DARK ? '#93c5fd' : C.blue, ink: DARK ? '#93c5fd' : C.blue, align: 'center', scale: c2, f: UI, w8: 700, track: 5, padX: 36 });
}
function sCode(ctx, u) {              // sale: code + tap to copy
  bg(ctx);
  band(ctx, P ? S.y - 60 : 0, P ? 90 : 80, u);
  const cx = W / 2;
  rows(ctx, [['USE CODE', FG]], cx, P ? H * 0.34 : H * 0.32, P ? 140 : 120, 0, () => springU(u, -0.3, SPRING.snappy), 'center', 6);
  const ck = springU(u, 0.4, SPRING.bouncy);
  if (ck > 0) chip(ctx, 'XMAS25', cx, P ? H * 0.4 : H * 0.4, P ? 170 : 150, { fillC: C.red, ink: '#fff', align: 'center', scale: ck * (1 + 0.04 * Math.sin(u * 4) * prog(u, 1, 1.5)), padX: 60, track: 12 });
  const tk = springU(u, 1.3, SPRING.snappy);
  if (tk > 0) chip(ctx, 'TAP TO COPY', cx, P ? H * 0.4 + 360 : H * 0.4 + 320, P ? 46 : 40, { stroke: C.red, dash: true, ink: C.red, align: 'center', scale: tk, f: UI, w8: 700, track: 6 });
  const sk = E.outQuint(prog(u, 2, 2.6));
  ctx.save(); ctx.globalAlpha = sk;
  text(ctx, '25% OFF · HOLIDAY SALE', cx, P ? H * 0.4 + 560 : H * 0.4 + 470, font(P ? 56 : 48, 700, DISPLAY), C.mute, 'center', 6);
  ctx.restore();
}
function sCatalogue(ctx, u, IMG) {    // brand: research-use band + SHOP FULL CATALOGUE
  bg(ctx);
  const hk = springU(u, -0.3, SPRING.gentle);
  cardGrid(ctx, u, IMG, 0.5 * hk);
  ctx.fillStyle = 'rgba(15,27,45,0.62)'; ctx.fillRect(0, 0, W, H);
  band(ctx, H * 0.3, P ? 110 : 100, u, C.navy2, 'rgba(255,255,255,0.85)', 160);
  band(ctx, H * 0.3 + (P ? 130 : 120), P ? 110 : 100, -u, C.blue, 'rgba(255,255,255,0.9)', 160);
  rows(ctx, [['SHOP FULL', C.white], ['CATALOGUE', C.blueHi]], W / 2, H * (P ? 0.58 : 0.7), P ? 150 : 130, P ? 150 : 130, (i) => springU(u, 0.6 + i * 0.4, SPRING.snappy), 'center', 4);
}
function sEnd(ctx, u) {               // local 0..4
  bg(ctx);
  if (V === 'sale') band(ctx, 0, P ? 90 : 70, u, C.red, '#fff');
  const wk = springU(u, -0.2, SPRING.bouncy);
  ctx.save(); const cy = P ? H * 0.38 : H * 0.36; ctx.translate(W / 2, cy); ctx.scale(lerp(0.7, 1, wk), lerp(0.7, 1, wk)); ctx.translate(-W / 2, -cy);
  wordmark(ctx, W / 2, cy, P ? 260 : 230, FG, wk); ctx.restore();
  const bk = springU(u, 0.6, SPRING.bouncy);
  const by = P ? H * 0.38 + 220 : H * 0.36 + 190;
  if (bk > 0) chip(ctx, 'ITIDELABS.COM', W / 2, by, P ? 64 : 58, { fillC: DARK ? C.blue : C.navy, ink: '#fff', align: 'center', scale: lerp(0.7, 1, bk), padX: 54, track: 4 });
  const dk = springU(u, 1.4, SPRING.bouncy);
  if (dk > 0) {
    if (V === 'sale') chip(ctx, '25% OFF WITH XMAS25', W / 2, by + (P ? 190 : 165), P ? 48 : 42, { stroke: C.red, dash: true, ink: C.red, align: 'center', scale: dk, padX: 36, track: 4 });
    else chip(ctx, '99% PURITY · RESEARCH-GRADE', W / 2, by + (P ? 190 : 165), P ? 44 : 38, { stroke: '#93c5fd', ink: '#93c5fd', align: 'center', scale: dk, padX: 36, track: 4 });
  }
  const rk = E.outQuint(prog(u, 2, 2.6));
  ctx.save(); ctx.globalAlpha = rk * 0.85;
  text(ctx, 'For research use only. Not for human or veterinary use.', W / 2, P ? H - S.y - 30 : H - 70, font(P ? 32 : 28, 500, UI), DARK ? 'rgba(255,255,255,0.6)' : C.mute, 'center');
  ctx.restore();
}

// ---------------------------------------------------------------- edit
const EDITS = {
  sale: [[0, sSaleHook, [[-0.3, 'banner', 'impact'], [0.5, '25', 'impact'], [1.5, 'code', 'pop', { pitch: 'E6' }]]],
    [4, sHeroPhoto, [[0.4, 'r1', 'tick'], [0.8, 'r2', 'tick']]],
    [8, sLineup, [[-0.2, 'v1', 'pop', { pitch: 'A5' }], [0.4, 'v2', 'pop', { pitch: 'C6' }], [1.0, 'v3', 'pop', { pitch: 'E6' }]]],
    [12, sPrice, [[0.3, 'name', 'tick'], [1.5, 'strike', 'tick'], [2, 'price', 'impact']]],
    [16, sCode, [[0.4, 'code', 'impact'], [1.3, 'copy', 'pop', { pitch: 'A5' }]]],
    [20, (c, u, I) => sLineup(c, u, I), []],
    [24, sCatalogueLight, [[0.6, 'shop', 'tick'], [1.0, 'cat', 'tick']]],
    [28, sEnd, [[-0.2, 'logo', 'impact'], [0.6, 'url', 'bell', { pitch: 'A5' }], [1.4, 'chip', 'pop', { pitch: 'E6' }]]]],
  brand: [[0, sBrandHook, [[-0.3, 'logo', 'impact'], [1.4, 'grade', 'tick']]],
    [4, sHeroPhoto, [[0.4, 'r1', 'tick'], [0.8, 'r2', 'tick']]],
    [8, (c, u, I) => sCard(c, u, I, 'ipa', 1), [[0, 'v', 'thud'], [1.2, 'coa', 'pop', { pitch: 'A5' }]]],
    [12, (c, u, I) => sCard(c, u, I, 'glow', -1), [[0, 'v', 'thud'], [1.2, 'coa', 'pop', { pitch: 'C6' }]]],
    [16, (c, u, I) => sCard(c, u, I, 'cagri', 1), [[0, 'v', 'thud'], [1.2, 'coa', 'pop', { pitch: 'E6' }]]],
    [20, (c, u, I) => sCard(c, u, I, 'klow', -1), [[0, 'v', 'thud'], [1.2, 'coa', 'pop', { pitch: 'A5' }]]],
    [24, sCatalogue, [[0.6, 'shop', 'tick'], [1.0, 'cat', 'tick']]],
    [28, sEnd, [[-0.2, 'logo', 'impact'], [0.6, 'url', 'bell', { pitch: 'A5' }], [1.4, 'chip', 'pop', { pitch: 'E6' }]]]],
};
function sCatalogueLight(ctx, u, IMG) { sCatalogue(ctx, u, IMG); }
// sale: the second lineup slot (20-24) shows the hero photo again with the band instead, for variety
EDITS.sale[5] = [20, (c, u, I) => sCard(c, u, I, 'klow', -1), [[0, 'card', 'thud'], [1.2, 'coa', 'pop', { pitch: 'A5' }]]];
function sLineupDark(ctx, u, IMG) {
  // the four-vial hero photo, full bleed with a slow pan, + "RESEARCH USE ONLY" band
  const k = springU(u, -0.4, SPRING.gentle);
  ctx.save(); ctx.globalAlpha = clamp(k * 1.4);
  cover(ctx, IMG.hero, 0, 0, W, H, { zoom: 1.05 * 1.12 ** prog(u, 0, 4), fx: lerp(0.3, 0.7, prog(u, 0, 4)), fy: 0.7 });
  ctx.restore();
  band(ctx, P ? H - S.y - 40 : H - 110, P ? 100 : 90, u, C.navy, 'rgba(255,255,255,0.9)');
}
EDITS.roll = [[0, sRollCards, ROLLK.map((_, j) => [j * 2.4 - 0.4, 'card', j ? 'pop' : 'impact', { pitch: ['A5', 'C6', 'E6', 'G6', 'A6'][j] }])],
  [12, sHeroPhoto, [[0.4, 'r1', 'tick'], [0.8, 'r2', 'tick']]],
  [16, sLineup, [[-0.2, 'v1', 'pop', { pitch: 'A5' }], [0.4, 'v2', 'pop', { pitch: 'C6' }], [1.0, 'v3', 'pop', { pitch: 'E6' }]]],
  [20, sQuality, [[-0.3, '99', 'impact'], [0.5, 'coa', 'pop', { pitch: 'A5' }], [1.3, 'ruo', 'pop', { pitch: 'E6' }]]],
  [24, sCatalogue, [[0.6, 'shop', 'tick'], [1.0, 'cat', 'tick']]],
  [28, sEnd, [[-0.2, 'logo', 'impact'], [0.6, 'url', 'bell', { pitch: 'A5' }], [1.4, 'chip', 'pop', { pitch: 'E6' }]]]];
EDITS.quality = [[0, sQuality, [[-0.3, '99', 'impact'], [0.5, 'coa', 'pop', { pitch: 'A5' }], [1.3, 'ruo', 'pop', { pitch: 'E6' }]]],
  [4, (c, u, I) => sCard(c, u, I, 'bigt', 1), [[0, 'v', 'thud'], [1.2, 'coa', 'pop', { pitch: 'A5' }]]],
  [8, (c, u, I) => sCard(c, u, I, 'glow', -1), [[0, 'v', 'thud'], [1.2, 'coa', 'pop', { pitch: 'C6' }]]],
  [12, sHeroPhoto, [[0.4, 'r1', 'tick'], [0.8, 'r2', 'tick']]],
  [16, (c, u, I) => sCard(c, u, I, 'ipa', 1), [[0, 'v', 'thud'], [1.2, 'coa', 'pop', { pitch: 'E6' }]]],
  [20, (c, u, I) => sCard(c, u, I, 'klow', -1), [[0, 'v', 'thud'], [1.2, 'coa', 'pop', { pitch: 'A5' }]]],
  [24, sCatalogue, [[0.6, 'shop', 'tick'], [1.0, 'cat', 'tick']]],
  [28, sEnd, [[-0.2, 'logo', 'impact'], [0.6, 'url', 'bell', { pitch: 'A5' }], [1.4, 'chip', 'pop', { pitch: 'E6' }]]]];
// ================================================================ HERO cut (36 s, 60 beats @100 bpm)
const ALL = [['bigr_hd', 'GLP-3 R', '20MG'], ['glp2t_hd', 'GLP-2 T', '30MG'], ['cagrilintide', 'CAGRILINTIDE', '10MG'], ['bpc157', 'BPC-157', '10MG'],
  ['ghkcu', 'GHK-CU', '100MG'], ['tb500', 'TB-500', '10MG'], ['nad', 'NAD+', '500MG'], ['ss31_hd', 'SS-31', '10MG'],
  ['tesamorelin_hd', 'TESAMORELIN', '5MG'], ['semax', 'SEMAX', '10MG'], ['melanotan1', 'MELANOTAN 1', '10MG'], ['sermorelin', 'SERMORELIN', '10MG'],
  ['wolverine', 'WOLVERINE', '20MG'], ['glow_hd', 'GLOW', '70MG'], ['ace031', 'ACE-031', '1MG'], ['klow', 'KLOW', '80MG']];
// soft spotlight cone from the top
function spot(ctx, cx, amt = 1, col = '59,130,246') {
  const g = ctx.createRadialGradient(cx, H * 0.15, 0, cx, H * 0.55, Math.max(W, H) * 0.6);
  g.addColorStop(0, `rgba(${col},${0.32 * amt})`); g.addColorStop(0.5, `rgba(${col},${0.10 * amt})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function sCold(ctx, u, IMG) {            // black, a light sweep reveals the wordmark, then the line
  ctx.fillStyle = '#05080f'; ctx.fillRect(0, 0, W, H);
  const sweep = prog(u, -0.3, 1.6);
  spot(ctx, lerp(-W * 0.2, W * 1.2, E.inOutCubic(sweep)), Math.sin(Math.PI * sweep) * 1.4);
  spot(ctx, W / 2, E.outCubic(prog(u, 1.2, 2.4)) * 0.8);
  const wk = E.outCubic(prog(u, 0.2, 1.6));
  const cy = H * (P ? 0.44 : 0.46);
  ctx.save(); ctx.translate(W / 2, cy); const z = lerp(1.35, 1, wk); ctx.scale(z, z); ctx.translate(-W / 2, -cy);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W * E.inOutCubic(prog(u, 0, 1.4)) + W * 0.02, H); ctx.clip();
  wordmark(ctx, W / 2, cy, P ? 330 : 300, C.white, wk);
  ctx.restore(); ctx.restore();
  rows(ctx, [['RESEARCH-GRADE PEPTIDES', C.blueHi]], W / 2, cy + (P ? 300 : 280), P ? Math.min(90, fitSize(ctx, 'RESEARCH-GRADE PEPTIDES', 700, DISPLAY, S.w, 90, 0.06)) : 84, 0,
    () => springU(u, 2.2, SPRING.snappy), 'center', 6);
}
function sArmy(ctx, u, IMG) {            // all eight vials rise in a row, one per half beat
  bg(ctx); spot(ctx, W / 2, 1.1);
  const ARMY = ALL.filter(([img]) => img !== 'ace031'), n = ARMY.length;
  const vh = P ? 300 : 300, floor = H * 0.8;
  const span = W - 230, step = span / (n - 1), x0 = (W - span) / 2;
  ARMY.forEach(([img], i) => {
    const k = springU(u, -0.4 + i * 0.2, SPRING.bouncy); if (k <= 0) return;
    const row = Math.floor(i / 5), inRow = row < 2 ? 5 : n - 10, col = i % 5;
    const cx = P ? W / 2 + (col - (inRow - 1) / 2) * (W - 120) / 5 : x0 + i * step;
    const fl = P ? H * [0.45, 0.65, 0.85][row] : floor;
    vialOn(ctx, IMG['cut_' + img], cx, fl + (1 - k) * 300, vh, clamp(k * 1.5));
  });
  rows(ctx, [['EVERY VIAL.', C.white], ['ONE STANDARD.', C.blueHi]], W / 2, P ? S.y + 110 : 150, P ? 110 : 100, P ? 112 : 102,
    (i) => springU(u, 1.2 + i * 0.5, SPRING.snappy), 'center', 4);
}
function sSpin(ctx, u, IMG, idx, side) { // one vial in the spotlight: flips in, giant name behind, specs on the side
  bg(ctx, '#070c18');
  const [img, name, mg] = ALL[idx];
  // giant outlined name behind, sliding
  const gs = P ? 340 : 360;
  ctx.save(); ctx.font = font(gs, 700, DISPLAY);
  const gw = ctx.measureText(name).width;
  ctx.strokeStyle = 'rgba(147,197,253,0.16)'; ctx.lineWidth = 4;
  for (let r2 = 0; r2 < 3; r2++) {
    const off = ((u * 70 * (r2 % 2 ? 1 : -1) + r2 * 500) % (gw + 200) + (gw + 200)) % (gw + 200);
    for (let x = -off; x < W; x += gw + 200) ctx.strokeText(name, x, H * (0.3 + r2 * 0.3));
  }
  ctx.restore();
  const cx = P ? W / 2 : (side > 0 ? W * 0.32 : W * 0.68);
  spot(ctx, cx, 1.3);
  const flip = E.outCubic(prog(u, -0.4, 0.5));
  const vh = P ? 820 : 760, floor = P ? H * 0.66 : H * 0.88;
  const im = IMG['cut_' + img];
  ctx.save(); ctx.translate(cx, floor); ctx.scale(Math.max(0.03, Math.abs(Math.cos((1 - flip) * Math.PI / 2))), 1);
  const z = 1.0 * 1.06 ** prog(u, 0, 4); ctx.scale(z, z); ctx.translate(-cx, -floor);
  vialOn(ctx, im, cx, floor + 6 * Math.sin(u * 1.2), vh, clamp(flip * 1.4));
  ctx.restore();
  const tx = P ? S.x + 10 : (side > 0 ? W * 0.58 : W * 0.08), ty = P ? floor + 140 : H * 0.42;
  const ns = Math.min(P ? 130 : 140, fitSize(ctx, name, 700, DISPLAY, P ? S.w : W * 0.36, 150, 0.02));
  rows(ctx, [[name, C.white], [mg + ' · 99%', C.blueHi]], tx, ty, ns, ns, (i) => springU(u, 0.4 + i * 0.35, SPRING.snappy), 'left', 2);
  const ck = springU(u, 1.4, SPRING.snappy);
  if (ck > 0) chip(ctx, 'CERTIFICATE OF ANALYSIS', tx, ty + ns + 40, P ? 36 : 32, { stroke: '#93c5fd', ink: '#93c5fd', scale: ck, f: UI, w8: 700, track: 4, padX: 26 });
}
function sOrbit(ctx, u, IMG) {           // the eight vials on a turning carousel
  bg(ctx, '#070c18'); spot(ctx, W / 2, 1.2);
  const n = ALL.length, cx = W / 2, cy = P ? H * 0.6 : H * 0.6;
  const rx = P ? W * 0.36 : W * 0.34, ry = P ? 150 : 110;
  const turn = u * 0.42 + 0.3;
  const items = ALL.map(([img], i) => { const a = turn + i * TAU / n; return { img, a, z: Math.sin(a) }; }).sort((a, b) => a.z - b.z);
  const k = springU(u, -0.4, SPRING.gentle);
  for (const it of items) {
    const depth = (it.z + 1) / 2;
    const vh = (P ? 440 : 380) * lerp(0.55, 1.05, depth) * k;
    const x = cx + Math.cos(it.a) * rx, fl = cy + it.z * ry + vh * 0.5;
    ctx.save(); ctx.globalAlpha = lerp(0.35, 1, depth);
    vialOn(ctx, IMG['cut_' + it.img], x, fl, vh);
    ctx.restore();
  }
  rows(ctx, [['THE FULL', C.white], ['CATALOGUE.', C.blueHi]], W / 2, P ? S.y + 110 : 150, P ? 120 : 110, P ? 120 : 110,
    (i) => springU(u, 0.2 + i * 0.4, SPRING.snappy), 'center', 4);
}
function sPartner(ctx, u, IMG) {
  bg(ctx); spot(ctx, W / 2, 0.9);
  const cy = P ? H * 0.42 : H * 0.42;
  rows(ctx, [['TRUSTED PARTNER OF', '#93c5fd']], W / 2, cy - (P ? 200 : 170), P ? 64 : 58, 0, () => springU(u, -0.3, SPRING.snappy), 'center', 10);
  const pk = springU(u, 0.3, SPRING.bouncy);
  if (pk > 0) {   // PeptidePraat wordmark (bold + regular), as on peptidepraat.nl
    const ws = P ? 140 : 140; ctx.save(); ctx.translate(W / 2, cy); ctx.scale(pk, pk);
    ctx.font = font(ws, 700, UI); const a = ctx.measureText('Peptide').width; ctx.font = font(ws, 500, UI); const b = ctx.measureText('Praat').width;
    text(ctx, 'Peptide', -(a + b) / 2, 0, font(ws, 700, UI), C.white); text(ctx, 'Praat', -(a + b) / 2 + a, 0, font(ws, 500, UI), C.white);
    ctx.restore();
  }
  const ck = springU(u, 1.0, SPRING.bouncy);
  if (ck > 0) {
    const im = IMG.chip, cw = P ? 620 : 560, ch = cw * im.height / im.width;
    ctx.save(); ctx.translate(W / 2, cy + (P ? 140 : 120) + ch / 2); ctx.scale(ck, ck);
    rrect(ctx, -cw / 2, -ch / 2, cw, ch, ch * 0.18); ctx.fillStyle = '#fff'; ctx.fill();
    cover(ctx, im, -cw / 2, -ch / 2, cw, ch, { radius: ch * 0.18 }); ctx.restore();
  }
  const tk = E.outQuint(prog(u, 1.8, 2.4));
  ctx.save(); ctx.globalAlpha = tk;
  text(ctx, 'Independent peptide reference · peptidepraat.nl', W / 2, cy + (P ? 400 : 330), font(P ? 36 : 32, 500, UI), 'rgba(255,255,255,0.7)', 'center');
  ctx.restore();
}
EDITS.hero = [
  [0, sCold, [[-0.3, 'sweep', 'whoosh', { len: 1.2, from: 300, to: 2000 }], [0.2, 'logo', 'impact'], [2.2, 'line', 'tick']]],
  [4, sArmy, [...ALL.slice(0, 15).map((_, i) => [-0.4 + i * 0.2, 'vial', i % 2 ? 'tick' : 'pop', { pitch: ['A5', 'C6', 'E6', 'G6'][i % 4] }]), [1.2, 'l1', 'impact'], [1.7, 'l2', 'thud']]],
  [8, sHeroPhoto, [[0.4, 'r1', 'tick'], [0.8, 'r2', 'tick']]],
  [12, (c, u, I) => sSpin(c, u, I, 0, 1), [[0, 'flip', 'thud'], [1.4, 'coa', 'pop', { pitch: 'A5' }]]],
  [16, (c, u, I) => sSpin(c, u, I, 1, -1), [[0, 'flip', 'thud'], [1.4, 'coa', 'pop', { pitch: 'C6' }]]],
  [20, (c, u, I) => sSpin(c, u, I, 2, 1), [[0, 'flip', 'thud'], [1.4, 'coa', 'pop', { pitch: 'E6' }]]],
  [24, (c, u, I) => sSpin(c, u, I, ALL.length - 1, -1), [[0, 'flip', 'thud'], [1.4, 'coa', 'pop', { pitch: 'A6' }]]],
  [28, sOrbit, [[-0.4, 'ring', 'impact'], [0.2, 't1', 'tick'], [0.6, 't2', 'tick']]],
  [36, sRollCards, ROLLK.map((_, j) => [j * 2.4 - 0.4, 'card', j ? 'pop' : 'impact', { pitch: ['A5', 'C6', 'E6', 'G6', 'A6'][j] }])],
  [48, sQuality, [[-0.3, '99', 'impact'], [0.5, 'coa', 'pop', { pitch: 'A5' }], [1.3, 'ruo', 'pop', { pitch: 'E6' }]]],
  [52, sPartner, [[-0.3, 'kicker', 'tick'], [0.3, 'pp', 'impact'], [1.0, 'chip', 'pop', { pitch: 'E6' }]]],
  [56, sEnd, [[-0.2, 'logo', 'impact'], [0.6, 'url', 'bell', { pitch: 'A5' }], [1.4, 'chip', 'pop', { pitch: 'E6' }]]],
];
const SCENES = EDITS[V];
const DIRS = [[1, 0], [-1, 0], [0, 1]];
const WHIPS = {};
SCENES.forEach(([b], i) => { if (i > 0) WHIPS[b] = DIRS[(i - 1) % 3]; });
const HITS = [];
SCENES.forEach(([s, , hits]) => hits.forEach(([b, ...r]) => HITS.push([b + s, ...r])));
Object.keys(WHIPS).forEach((b, i) => HITS.push([Number(b) - 0.5, 'whip', 'whoosh', { len: 0.45, from: i % 2 ? 2400 : 600, to: i % 2 ? 600 : 2400 }]));
HITS.sort((a, b) => a[0] - b[0]);
function sceneAt(u) { let i = 0; while (i + 1 < SCENES.length && u >= SCENES[i + 1][0]) i++; return i; }
const drawScene = (i, ctx, u, IMG) => SCENES[i][1](ctx, u - SCENES[i][0], IMG);

M.film({
  fonts: [font(100, 700, DISPLAY), font(40, 500, UI), font(40, 700, UI)],
  images: Object.fromEntries([['hero', 'assets/products/hero.png'], ['v_big', 'assets/products/v_big.png'], ...['c_ipamorelin', 'c_glow', 'c_cagri', 'c_bigt', 'c_klow'].map((k) => [k, `assets/products/${k}.png`]), ...['bigr', 'bigt', 'cagrilintide', 'glow', 'ipamorelin', 'klow', 'nad', 'tb500', 'ace031', 'ss31', 'sermorelin', 'tesamorelin', 'ghkcu', 'bpc157', 'glp2t_hd', 'ss31_hd', 'tesamorelin_hd', 'semax', 'melanotan1', 'bigr_hd', 'wolverine', 'glow_hd'].map((n) => ['cut_' + n, `assets/products/cut/${n}.png`]), ['chip', 'assets/partner_chip.png']]),
  hits: HITS,
  draw(ctx, u, t, IMG) {
    BGU = u;
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
    ctx.save(); ctx.globalAlpha = 0.03; ctx.globalCompositeOperation = 'overlay';
    for (let i = 0; i < 1200; i++) {
      ctx.fillStyle = hash01(i + 99, f) > 0.5 ? '#fff' : '#000';
      ctx.fillRect(hash01(i, f + 1) * W, hash01(i + 7777, f + 3) * H, 3, 3);
    }
    ctx.restore();
  },
});
