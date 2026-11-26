// Thanksgiving greeting for the "Wholesale Kits from Phoenix AZ" group. Pure function of time.
// 100 bpm, 40 beats, 24 s. Everything is drawn in code: no prices, no health claims, research use only.
import * as M from './lib/motion.js';
const { W, H, FORMAT, E, TAU, prog, lerp, clamp, springU, SPRING, wobble, font, text, rrect, fitSize, hash01, noise1 } = M;

const P = FORMAT.portrait, SQ = FORMAT.square, S = FORMAT.safe;
const C = {
  night: '#1a0d07', deep: '#2b1309', brown: '#4a2210', rust: '#b4441a', orange: '#e8731c', amber: '#f5a623', gold: '#ffd27a',
  cream: '#fff4e0', red: '#d7262f', redHi: '#ff5a4e', glass: 'rgba(255,255,255,0.18)', navy: '#1f2f5a',
};
const D = 'Display', SCRIPT = 'Script', UI = 'UI';

// ---------------------------------------------------------------- background: warm sunset + drifting leaves
function bg(ctx, u, warm = 1) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, C.night); g.addColorStop(0.55, C.deep); g.addColorStop(1, '#5a2410');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const r = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, Math.max(W, H) * 0.7);
  r.addColorStop(0, `rgba(245,166,35,${0.28 * warm})`); r.addColorStop(0.5, `rgba(180,68,26,${0.12 * warm})`); r.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
}
// maple-ish leaf path, size 1 unit
function leafPath(ctx) {
  ctx.beginPath();
  const pts = [[0, -1], [0.18, -0.55], [0.62, -0.72], [0.45, -0.3], [0.95, -0.15], [0.5, 0.1], [0.62, 0.48], [0.15, 0.3], [0, 0.65], [-0.15, 0.3], [-0.62, 0.48], [-0.5, 0.1], [-0.95, -0.15], [-0.45, -0.3], [-0.62, -0.72], [-0.18, -0.55]];
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}
const LEAF_COLS = ['#e8731c', '#b4441a', '#f5a623', '#d7262f', '#c9581f', '#ffb347'];
function leaves(ctx, u, n = 26, alpha = 1, front = false) {
  for (let i = 0; i < n; i++) {
    const seed = i * 7 + (front ? 999 : 0);
    const size = (front ? 46 : 26) + hash01(seed, 3) * (front ? 40 : 28);
    const speed = 0.06 + hash01(seed, 5) * 0.06;
    const y = ((hash01(seed, 7) + u * speed) % 1.15 - 0.08) * H;
    const x = hash01(seed, 11) * W + Math.sin(u * 0.9 + i) * 60 + noise1(u * 0.3 + i, 4) * 40;
    ctx.save(); ctx.globalAlpha = alpha * (front ? 0.95 : 0.55);
    ctx.translate(x, y); ctx.rotate(u * (0.6 + hash01(seed, 13)) * (i % 2 ? 1 : -1)); ctx.scale(size, size * (0.7 + 0.3 * Math.cos(u * 1.3 + i)));
    leafPath(ctx); ctx.fillStyle = LEAF_COLS[i % LEAF_COLS.length]; ctx.fill();
    ctx.restore();
  }
}
function glowText(ctx, str, x, y, f, col, glow, align = 'center', blur = 40) {
  ctx.save(); ctx.font = f; ctx.textAlign = align; ctx.shadowColor = glow; ctx.shadowBlur = blur; ctx.fillStyle = col;
  ctx.fillText(str, x, y); ctx.restore();
}
function rowsUp(ctx, list, x, y, lh, appear, align = 'center') {
  list.forEach(([str, f, col, track = 0], i) => {
    const k = appear(i); if (k <= 0) return;
    ctx.save(); ctx.globalAlpha = clamp(k * 1.5);
    text(ctx, str, x, y + i * lh + (1 - clamp(k)) * 50, f, col, align, track);
    ctx.restore();
  });
}

// ---------------------------------------------------------------- a research vial with a red flip-off cap (drawn)
function vial(ctx, cx, bottom, h, label = 'RESEARCH', tilt = 0) {
  const w = h * 0.42;
  ctx.save(); ctx.translate(cx, bottom); ctx.rotate(tilt);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 4, w * 0.6, w * 0.12, 0, 0, TAU); ctx.fill();
  const bodyH = h * 0.68, neckH = h * 0.1, capH = h * 0.2;
  // glass body
  rrect(ctx, -w / 2, -bodyH, w, bodyH, w * 0.18);
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(0.18, 'rgba(255,255,255,0.45)'); g.addColorStop(0.35, 'rgba(255,255,255,0.12)');
  g.addColorStop(0.85, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(255,255,255,0.30)');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1.5, h * 0.008); ctx.stroke();
  // white powder cake at the bottom
  rrect(ctx, -w / 2 + w * 0.06, -bodyH * 0.22, w * 0.88, bodyH * 0.18, w * 0.1); ctx.fillStyle = 'rgba(255,250,240,0.9)'; ctx.fill();
  // label
  rrect(ctx, -w / 2, -bodyH * 0.78, w, bodyH * 0.42, 3); ctx.fillStyle = C.cream; ctx.fill();
  ctx.fillStyle = C.red; ctx.fillRect(-w / 2, -bodyH * 0.78, w, bodyH * 0.07);
  ctx.fillStyle = '#3a1a0c'; ctx.textAlign = 'center'; ctx.font = font(Math.max(8, w * 0.17), 700, D);
  ctx.fillText(label, 0, -bodyH * 0.53);
  ctx.font = font(Math.max(6, w * 0.1), 500, UI); ctx.fillText('research use only', 0, -bodyH * 0.43);
  // neck + crimp
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-w * 0.28, -bodyH - neckH, w * 0.56, neckH);
  const cg = ctx.createLinearGradient(-w * 0.36, 0, w * 0.36, 0);
  cg.addColorStop(0, '#9aa0a6'); cg.addColorStop(0.4, '#eef1f4'); cg.addColorStop(1, '#8a9096');
  ctx.fillStyle = cg; rrect(ctx, -w * 0.36, -bodyH - neckH - capH * 0.35, w * 0.72, capH * 0.45, 4); ctx.fill();
  // red flip-off cap
  const rg = ctx.createLinearGradient(-w * 0.38, 0, w * 0.38, 0);
  rg.addColorStop(0, '#9e1a1f'); rg.addColorStop(0.35, C.redHi); rg.addColorStop(1, '#8a161b');
  ctx.fillStyle = rg; rrect(ctx, -w * 0.38, -bodyH - neckH - capH, w * 0.76, capH * 0.7, w * 0.12); ctx.fill();
  ctx.restore();
}
// clear clamshell kit with 10 vials (like the group photo)
function kit(ctx, cx, cy, w, k, u, label) {
  const h = w * 0.42;
  ctx.save(); ctx.translate(cx, cy);
  rrect(ctx, -w / 2, -h / 2, w, h, 26);
  ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 4; ctx.stroke();
  const n = 10, gap = (w - 60) / n;
  for (let i = 0; i < n; i++) {
    const kk = clamp((k - i * 0.06) * 2.2);
    if (kk <= 0) continue;
    const x = -w / 2 + 30 + gap * (i + 0.5), drop = (1 - E.outBack(kk, 1.6)) * -h;
    vial(ctx, x, h / 2 - 16 + drop, h * 0.84, label);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- simple USA flag
function flag(ctx, x, y, w, wave = 0) {
  const h = w * 0.53, stripes = 13;
  ctx.save(); ctx.translate(x, y);
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 ? '#ffffff' : '#c8102e';
    ctx.beginPath();
    for (let s = 0; s <= 20; s++) { const sx = s / 20 * w; const yy = i * h / stripes + Math.sin(s / 20 * TAU + wave) * w * 0.02 * (s / 20); s ? ctx.lineTo(sx, yy) : ctx.moveTo(sx, yy); }
    for (let s = 20; s >= 0; s--) { const sx = s / 20 * w; const yy = (i + 1) * h / stripes + Math.sin(s / 20 * TAU + wave) * w * 0.02 * (s / 20); ctx.lineTo(sx, yy); }
    ctx.fill();
  }
  ctx.fillStyle = '#0a3161'; ctx.fillRect(0, 0, w * 0.4, h * 7 / 13);
  ctx.fillStyle = '#fff';
  for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) { ctx.beginPath(); ctx.arc(w * 0.4 * (c + 0.5) / 6, h * 7 / 13 * (r + 0.5) / 5, w * 0.012, 0, TAU); ctx.fill(); }
  ctx.restore();
}
// saguaro cactus silhouette
function saguaro(ctx, x, base, h) {
  const w = h * 0.16;
  ctx.save(); ctx.fillStyle = '#20100a';
  rrect(ctx, x - w / 2, base - h, w, h, w / 2); ctx.fill();
  rrect(ctx, x - w * 2.1, base - h * 0.62, w * 0.8, h * 0.32, w * 0.4); ctx.fill();
  rrect(ctx, x - w * 2.1, base - h * 0.36, w * 1.7, w * 0.8, w * 0.4); ctx.fill();
  rrect(ctx, x + w * 1.3, base - h * 0.78, w * 0.8, h * 0.4, w * 0.4); ctx.fill();
  rrect(ctx, x + w * 0.4, base - h * 0.45, w * 1.7, w * 0.8, w * 0.4); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- scenes (local beats 0..8)
function sHello(ctx, u) {                     // HAPPY THANKSGIVING
  bg(ctx, u); leaves(ctx, u, 30, 0.8);
  const cy = P ? H * 0.36 : H * 0.44;
  const sk = springU(u, -0.2, SPRING.bouncy);
  const ss = Math.min(P ? 240 : 170, fitSize(ctx, 'Happy', 400, SCRIPT, S.w, 260));
  if (sk > 0) {
    ctx.save(); ctx.translate(W / 2, cy - ss * 0.35); const q = 0.06 * wobble(u - 0.2, 2, 4); ctx.scale(sk * (1 + q), sk * (1 - q)); ctx.rotate(-0.05);
    glowText(ctx, 'Happy', 0, 0, font(ss, 400, SCRIPT), C.gold, 'rgba(255,190,80,0.7)');
    ctx.restore();
  }
  const ts = Math.min(P ? 170 : 150, fitSize(ctx, 'THANKSGIVING', 700, D, S.w * 0.98, 200, 0.02));
  ctx.font = font(ts, 700, D);
  const word = 'THANKSGIVING', wid = ctx.measureText(word).width;
  let x = W / 2 - wid / 2;
  [...word].forEach((ch, i) => {
    const k = springU(u, 0.6 + i * 0.07, SPRING.bouncy);
    const cw = ctx.measureText(ch).width;
    if (k > 0) {
      ctx.save(); ctx.translate(x + cw / 2, cy + ts * 0.75); ctx.scale(k, k);
      glowText(ctx, ch, 0, 0, font(ts, 700, D), i % 2 ? C.amber : C.cream, 'rgba(232,115,28,0.6)', 'center', 30);
      ctx.restore();
    }
    x += cw;
  });
  const fk = springU(u, 2.4, SPRING.snappy);
  if (fk > 0) {
    ctx.save(); ctx.globalAlpha = clamp(fk);
    const fw = P ? 120 : 100;
    flag(ctx, W / 2 - fw / 2, cy + ts * 1.05, fw, u * 3);
    text(ctx, 'FROM PHOENIX, ARIZONA', W / 2, cy + ts * 1.05 + fw * 0.53 + (P ? 70 : 60), font(P ? 46 : 40, 700, UI), C.cream, 'center', 8);
    ctx.restore();
  }
  if (P) for (let i = 0; i < 5; i++) {
    const k = springU(u, 3.2 + i * 0.15, SPRING.bouncy); if (k <= 0) continue;
    vial(ctx, W / 2 + (i - 2) * 190, H * 0.86 + (1 - k) * 300, 300 - Math.abs(i - 2) * 30, 'KIT', (i - 2) * 0.06);
  }
  leaves(ctx, u, 6, 1, true);
}
function sThankful(ctx, u) {                  // THANKFUL FOR 42 OF YOU
  bg(ctx, u, 1.2); leaves(ctx, u, 22, 0.6);
  const cy = H * (P ? 0.44 : 0.38);
  rowsUp(ctx, [['THIS YEAR WE\'RE', font(P ? 70 : 64, 700, D), C.cream, 4], ['THANKFUL FOR', font(P ? 70 : 64, 700, D), C.amber, 4]], W / 2, cy - (P ? 220 : 190), P ? 80 : 74, (i) => springU(u, -0.2 + i * 0.4, SPRING.snappy));
  const n = Math.round(42 * E.outCubic(prog(u, 0.8, 3)));
  const nk = springU(u, 0.6, SPRING.bouncy);
  if (nk > 0) {
    ctx.save(); ctx.translate(W / 2, cy + (P ? 200 : 170)); ctx.scale(nk, nk);
    glowText(ctx, String(n), 0, 0, font(P ? 400 : 330, 700, D), C.gold, 'rgba(245,166,35,0.8)', 'center', 60);
    ctx.restore();
  }
  const ok = springU(u, 3.2, SPRING.snappy);
  if (ok > 0) glowText(ctx, 'of you', W / 2, cy + (P ? 330 : 280) + (1 - clamp(ok)) * 40, font(P ? 110 : 96, 400, SCRIPT), C.cream, 'rgba(255,190,80,0.5)');
  // little people dots in a ring: one per member
  for (let i = 0; i < 42; i++) {
    const k = clamp((u - 0.8 - i * 0.05) * 3); if (k <= 0) continue;
    const a = i / 42 * TAU - Math.PI / 2 + u * 0.05, rr = P ? 430 : 380;
    ctx.beginPath(); ctx.arc(W / 2 + Math.cos(a) * rr, cy + 80 + Math.sin(a) * rr * (P ? 1.05 : 0.95), 10 * k, 0, TAU);
    ctx.fillStyle = i % 3 ? C.amber : C.redHi; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1;
  }
  leaves(ctx, u, 5, 1, true);
}
function sKits(ctx, u) {                      // WHOLESALE KITS, 10 vials each
  bg(ctx, u); leaves(ctx, u, 14, 0.4);
  const kw = P ? W - 120 : W * 0.86, cy = P ? H * 0.5 : H * 0.55;
  const k = prog(u, -0.3, 2.2);
  const lk = springU(u, -0.5, SPRING.gentle);
  ctx.save(); ctx.translate(0, (1 - lk) * H * 0.4);
  kit(ctx, W / 2, cy, kw, k, u, 'KIT');
  ctx.restore();
  rowsUp(ctx, [['WHOLESALE', font(P ? 150 : 120, 700, D), C.cream, 6], ['KITS', font(P ? 150 : 120, 700, D), C.amber, 6]],
    W / 2, P ? S.y + 140 : 150, P ? 150 : 120, (i) => springU(u, -0.3 + i * 0.35, SPRING.snappy));
  const tk = springU(u, 2.4, SPRING.snappy);
  if (tk > 0) {
    ctx.save(); ctx.globalAlpha = clamp(tk);
    const ty = cy + kw * 0.21 + (P ? 110 : 80);
    text(ctx, '10 VIALS PER KIT', W / 2, ty, font(P ? 56 : 46, 700, UI), C.gold, 'center', 10);
    ctx.restore();
  }
}
function sPhoenix(ctx, u) {                   // SHIPPING FROM PHOENIX, AZ
  // desert sunset
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2a0f2e'); g.addColorStop(0.45, '#c2410c'); g.addColorStop(0.7, '#f59e0b'); g.addColorStop(1, '#7c2d12');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const sunY = H * 0.62 - E.outCubic(prog(u, -0.5, 3)) * H * 0.06;
  const sr = P ? 260 : 220;
  const sg = ctx.createRadialGradient(W / 2, sunY, 0, W / 2, sunY, sr * 2.2);
  sg.addColorStop(0, 'rgba(255,236,180,1)'); sg.addColorStop(0.35, 'rgba(255,190,90,0.9)'); sg.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
  ctx.beginPath(); ctx.arc(W / 2, sunY, sr, 0, TAU); ctx.fillStyle = '#ffe6a8'; ctx.fill();
  // mountains
  ctx.fillStyle = '#3b1408';
  ctx.beginPath(); ctx.moveTo(0, H * 0.72);
  for (let x = 0; x <= W; x += 40) ctx.lineTo(x, H * 0.72 - (Math.sin(x * 0.006) * 0.5 + 0.5) * H * 0.06 - noise1(x * 0.01, 9) * 30);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
  ctx.fillStyle = '#1f0b06'; ctx.fillRect(0, H * 0.78, W, H * 0.22);
  // cacti grow in
  [[0.14, 0.34], [0.86, 0.4], [0.32, 0.2], [0.7, 0.18]].forEach(([fx, fh], i) => {
    const k = springU(u, 0.2 + i * 0.25, SPRING.bouncy); if (k <= 0) return;
    saguaro(ctx, W * fx, H * 0.8, H * fh * k);
  });
  rowsUp(ctx, [['SHIPPING FROM', font(P ? 64 : 56, 700, UI), C.cream, 10], ['PHOENIX, AZ', font(P ? 170 : 140, 700, D), '#fff', 4]],
    W / 2, P ? S.y + 140 : 150, P ? 170 : 140, (i) => springU(u, -0.2 + i * 0.4, SPRING.snappy));
  const fk = springU(u, 1.6, SPRING.bouncy);
  if (fk > 0) { ctx.save(); ctx.globalAlpha = clamp(fk); flag(ctx, W / 2 - (P ? 90 : 75), P ? S.y + 380 : 380, P ? 180 : 150, u * 3); ctx.restore(); }
  const vk = springU(u, 2.4, SPRING.snappy);
  if (vk > 0) { ctx.save(); ctx.globalAlpha = clamp(vk); text(ctx, 'ACROSS THE USA 🚚'.replace(' 🚚', ''), W / 2, H * 0.9, font(P ? 50 : 42, 700, UI), C.gold, 'center', 12); ctx.restore(); }
  leaves(ctx, u, 4, 0.9, true);
}
function sEnd(ctx, u) {                       // From our family to yours
  bg(ctx, u, 1.3); leaves(ctx, u, 30, 0.7);
  const cy = H * (P ? 0.26 : 0.22);
  // cornucopia-like ring of vials
  for (let i = 0; i < 7; i++) {
    const k = springU(u, -0.3 + i * 0.12, SPRING.bouncy); if (k <= 0) continue;
    const a = (i - 3) * 0.3, rr = P ? 520 : 400;
    const x = W / 2 + Math.sin(a) * rr, y = cy + (P ? 560 : 400) - (1 - Math.cos(a)) * rr * 0.55;
    vial(ctx, x, y + (1 - k) * 200, (P ? 260 : 190) * (1 - Math.abs(i - 3) * 0.07), 'KIT', a * 0.25);
  }
  const sk = springU(u, 0.4, SPRING.bouncy);
  if (sk > 0) {
    ctx.save(); ctx.translate(W / 2, cy); ctx.scale(sk, sk); ctx.rotate(-0.04);
    glowText(ctx, 'From our family', 0, -40, font(P ? 110 : 96, 400, SCRIPT), C.gold, 'rgba(255,190,80,0.7)');
    glowText(ctx, 'to yours', 0, P ? 90 : 80, font(P ? 110 : 96, 400, SCRIPT), C.cream, 'rgba(255,190,80,0.5)');
    ctx.restore();
  }
  const by = P ? H * 0.7 : H * 0.74;
  const tk = springU(u, 1.2, SPRING.snappy);
  if (tk > 0) {
    ctx.save(); ctx.globalAlpha = clamp(tk);
    const ts = Math.min(P ? 84 : 70, fitSize(ctx, 'HAPPY THANKSGIVING', 700, D, S.w, 90, 0.04));
    text(ctx, 'HAPPY THANKSGIVING', W / 2, by, font(ts, 700, D), C.cream, 'center', 6);
    text(ctx, 'WHOLESALE KITS · PHOENIX AZ', W / 2, by + (P ? 80 : 66), font(P ? 40 : 34, 700, UI), C.amber, 'center', 8);
    ctx.restore();
  }
  const pk = springU(u, 2.0, SPRING.bouncy);
  if (pk > 0) {
    ctx.save(); ctx.translate(W / 2, by + (P ? 175 : 140)); ctx.scale(pk, pk);
    ctx.font = font(P ? 40 : 34, 700, UI); const lbl = '📌'.replace('📌', '') + 'PRICE LIST IS PINNED IN THE GROUP', bw = ctx.measureText(lbl).width + 70, bh = P ? 90 : 76;
    rrect(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2); ctx.fillStyle = C.red; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(lbl, 0, 3); ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }
  const rk = E.outQuint(prog(u, 3, 3.8));
  ctx.save(); ctx.globalAlpha = rk * 0.8;
  text(ctx, 'For research use only. Not for human consumption.', W / 2, H - (P ? S.y - 40 : 60), font(P ? 30 : 26, 500, UI), C.cream, 'center');
  ctx.restore();
}

// ---------------------------------------------------------------- edit
const SCENES = [
  [0, sHello, [[-0.2, 'happy', 'impact'], ...'THANKSGIVING'.split('').map((_, i) => [0.6 + i * 0.07, 'l', i % 3 ? 'tick' : 'pop', { pitch: ['C6', 'E6', 'G6'][i % 3] }]), [2.4, 'flag', 'bell', { pitch: 'G5' }]]],
  [8, sThankful, [[-0.2, 'r1', 'tick'], [0.2, 'r2', 'tick'], [0.6, 'num', 'impact'], [3.0, '42', 'pop', { pitch: 'A5' }], [3.2, 'of you', 'bell', { pitch: 'E6' }]]],
  [16, sKits, [[-0.3, 'w1', 'thud'], [0.05, 'w2', 'thud'], ...Array.from({ length: 10 }, (_, i) => [-0.3 + i * 0.25 / 2.2 * 2.5 + 0.35, 'vial', 'pop', { pitch: ['C6', 'D6', 'E6', 'G6', 'A6'][i % 5] }]), [2.4, 'tag', 'tick']]],
  [24, sPhoenix, [[-0.2, 's1', 'tick'], [0.2, 'phx', 'impact'], [1.6, 'flag', 'bell', { pitch: 'A5' }], [2.4, 'usa', 'tick']]],
  [32, sEnd, [[-0.3, 'vials', 'impact'], [0.4, 'family', 'bell', { pitch: 'C6' }], [1.2, 'happy', 'tick'], [2.0, 'pin', 'pop', { pitch: 'E6' }]]],
];
const DIRS = [[0, 1], [1, 0], [-1, 0], [0, 1]];
const WHIPS = {};
SCENES.forEach(([b], i) => { if (i > 0) WHIPS[b] = DIRS[(i - 1) % DIRS.length]; });
const HITS = [];
SCENES.forEach(([s, , hits]) => hits.forEach(([b, ...r]) => HITS.push([b + s, ...r])));
Object.keys(WHIPS).forEach((b, i) => HITS.push([Number(b) - 0.5, 'whip', 'whoosh', { len: 0.45, from: i % 2 ? 2400 : 600, to: i % 2 ? 600 : 2400 }]));
HITS.sort((a, b) => a[0] - b[0]);
function sceneAt(u) { let i = 0; while (i + 1 < SCENES.length && u >= SCENES[i + 1][0]) i++; return i; }
const drawScene = (i, ctx, u) => SCENES[i][1](ctx, u - SCENES[i][0]);

M.film({
  fonts: [font(100, 700, D), font(100, 400, SCRIPT), font(40, 500, UI), font(40, 700, UI)],
  images: {},
  hits: HITS,
  draw(ctx, u) {
    for (const [b, [dx, dy]] of Object.entries(WHIPS).map(([b, v]) => [Number(b), v])) {
      if (u >= b - 0.5 && u < b + 0.12) {
        const e = E.inOutCubic(prog(u, b - 0.5, b + 0.12));
        ctx.save(); ctx.translate(-dx * e * W, -dy * e * H); drawScene(sceneAt(b - 0.01), ctx, u); ctx.restore();
        ctx.save(); ctx.translate(dx * (1 - e) * W, dy * (1 - e) * H); drawScene(sceneAt(b), ctx, u); ctx.restore();
        return;
      }
    }
    drawScene(sceneAt(u), ctx, u);
  },
  post(ctx, u, t) {
    const f = Math.floor(t * 60);
    ctx.save(); ctx.globalAlpha = 0.035; ctx.globalCompositeOperation = 'overlay';
    for (let i = 0; i < 1000; i++) { ctx.fillStyle = hash01(i + 99, f) > 0.5 ? '#fff' : '#000'; ctx.fillRect(hash01(i, f + 1) * W, hash01(i + 7777, f + 3) * H, 3, 3); }
    ctx.restore();
    // vignette
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  },
});
