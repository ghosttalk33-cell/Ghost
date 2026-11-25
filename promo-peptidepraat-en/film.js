// PeptidePraat promo. Pure function of time: window.seek(t) paints frame t. 96 bpm, 32 beats, 20 s.
// Real assets only: crops of the site's own sections (assets/*.png), its logo SVG, its fonts and words.
import * as M from './lib/motion.js';
const { W, H, FORMAT, E, TAU, prog, lerp, clamp, springU, SPRING, wobble, font, text, cover, rrect, fitSize, hash01 } = M;

const P = FORMAT.portrait, S = FORMAT.safe;
const C = { paper: '#f6f8fb', white: '#ffffff', navy: '#0d2238', ink: '#1c2733', mute: '#4a5868', line: '#d5dde8', blue: '#1d4f91', blueHi: '#2f66ad', orange: '#f2a23a' };
const D = 'Display', MONO = 'Mono';

function bg(ctx, col = C.paper) {
  ctx.fillStyle = col; ctx.fillRect(0, 0, W, H);
  // faint dotted grid, like lab paper
  ctx.fillStyle = col === C.navy ? 'rgba(255,255,255,0.05)' : 'rgba(13,34,56,0.05)';
  for (let y = 40; y < H; y += 60) for (let x = 40; x < W; x += 60) ctx.fillRect(x, y, 3, 3);
}
function kicker(ctx, str, x, y, k, col = C.blue, align = 'left') {
  if (k <= 0) return;
  ctx.save(); ctx.globalAlpha = clamp(k);
  const f = font(P ? 34 : 30, 400, MONO);
  ctx.font = f; ctx.letterSpacing = '6px';
  const w = ctx.measureText(str).width;
  const x0 = align === 'center' ? x - (w + 90) / 2 : x;
  ctx.fillStyle = col; ctx.fillRect(x0, y - 11, 64 * clamp(k), 3);
  ctx.fillText(str, x0 + 90, y);
  ctx.letterSpacing = '0px'; ctx.restore();
}
// rows of words rising inside a clip; each row [[word, color], ...]
function lines(ctx, rows, x, y, size, lh, appear, align = 'left', weight = 700) {
  const f = font(size, weight, D);
  ctx.font = f; ctx.letterSpacing = `${-size * 0.03}px`;
  rows.forEach((row, i) => {
    const k = appear(i); if (k <= 0) return;
    const full = row.map((w) => w[0]).join(' ');
    let cx = align === 'center' ? x - ctx.measureText(full).width / 2 : x;
    ctx.save(); ctx.beginPath(); ctx.rect(0, y + i * lh - size * 1.0, W, size * 1.32); ctx.clip();
    row.forEach(([w, col]) => {
      ctx.fillStyle = col; ctx.fillText(w, cx, y + i * lh + (1 - clamp(k)) * size * 1.2);
      cx += ctx.measureText(w + ' ').width;
    });
    ctx.restore();
  });
  ctx.letterSpacing = '0px';
}
function shot(ctx, img, x, y, w, h, opt = {}) {
  ctx.save(); ctx.shadowColor = 'rgba(13,34,56,0.22)'; ctx.shadowBlur = 70; ctx.shadowOffsetY = 28;
  rrect(ctx, x, y, w, h, 28); ctx.fillStyle = C.white; ctx.fill(); ctx.restore();
  cover(ctx, img, x, y, w, h, { radius: 28, ...opt });
  rrect(ctx, x, y, w, h, 28); ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
}
// the brand mark, from assets/logo/mark.svg (viewBox 48)
const BUBBLE = new Path2D('M14 2h20a12 12 0 0 1 12 12v14a12 12 0 0 1-12 12H23l-11 7v-7.2A12 12 0 0 1 2 28V14A12 12 0 0 1 14 2z');
function mark(ctx, cx, cy, size, k = 1, draw = 1) {
  if (k <= 0) return;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(size / 48 * k, size / 48 * k); ctx.translate(-24, -24.5);
  ctx.fillStyle = C.navy; ctx.fill(BUBBLE);
  const pts = [[11, 26], [19.5, 15], [28.5, 26], [37, 15]];
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const seg = 3 * clamp(draw);
  ctx.beginPath(); ctx.moveTo(...pts[0]);
  for (let i = 1; i <= Math.ceil(seg); i++) { const f = Math.min(1, seg - (i - 1)); ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)); }
  ctx.stroke();
  pts.forEach(([x, y], i) => {
    const d = clamp(draw * 3 - i + 0.3); if (d <= 0) return;
    ctx.beginPath(); ctx.arc(x, y, (i === 3 ? 4.4 : 3.6) * d, 0, TAU); ctx.fillStyle = i === 3 ? C.orange : '#fff'; ctx.fill();
  });
  ctx.restore();
}

// ---------------------------------------------------------------- scenes (local beats 0..4)
function sHook(ctx, u) {
  bg(ctx);
  const x = P ? S.x + 10 : 150, size = P ? Math.min(185, fitSize(ctx, 'Peptides,', 700, D, S.w - 10, 185, -0.03)) : 180, lh = size * 0.98;
  const y0 = P ? H * 0.42 : H * 0.42;
  kicker(ctx, P ? 'INDEPENDENT REFERENCE' : 'INDEPENDENT REFERENCE · NETHERLANDS', x, y0 - size * 1.1, E.outQuint(prog(u, -0.4, 0.4)));
  lines(ctx, [[['Peptides,', C.navy]], [['ranked by', C.navy]], [['evidence.', C.blue]]], x, y0, size, lh,
    (i) => springU(u, -0.3 + i * 0.8, SPRING.snappy));
  // the orange dot of the logo lands on the full stop
  const dk = springU(u, 2.0, SPRING.bouncy);
  if (dk > 0) {
    ctx.font = font(size, 700, D); ctx.letterSpacing = `${-size * 0.03}px`;
    const wx = x + ctx.measureText('evidence').width + size * 0.06; ctx.letterSpacing = '0px';
    ctx.beginPath(); ctx.arc(wx, y0 + 2 * lh - size * 0.06, size * 0.085 * dk, 0, TAU); ctx.fillStyle = C.orange; ctx.fill();
  }
  const sk = E.outQuint(prog(u, 2.4, 3.1));
  ctx.save(); ctx.globalAlpha = sk;
  const sub = P ? ['What has been studied, in whom,', 'and what nobody knows yet.'] : ['What has been studied, in whom, and what nobody knows yet.'];
  sub.forEach((l, i) => text(ctx, l, x, y0 + 2 * lh + (P ? 140 : 120) + i * 62 + (1 - sk) * 20, font(P ? 50 : 46, 400, D), C.mute));
  ctx.restore();
}
function sLadder(ctx, u, IMG) {
  bg(ctx);
  const im = IMG.ladder;
  const w = P ? W - 2 * 60 : 760, h = w * im.height / im.width;
  const x = P ? 60 : W - 150 - w, y = P ? H * 0.38 : (H - h) / 2;
  const k = springU(u, -0.4, SPRING.gentle);
  ctx.save(); ctx.translate(0, (1 - k) * H * 0.6); shot(ctx, im, x, y, w, h, { zoom: 1.0 * 1.03 ** prog(u, 0, 4) }); ctx.restore();
  const tx = P ? S.x + 10 : 150, ty = P ? S.y + 170 : H * 0.42;
  // count up to 30
  const n = Math.round(30 * E.outCubic(prog(u, 0, 1.6)));
  const nk = springU(u, -0.2, SPRING.snappy);
  if (nk > 0) text(ctx, String(n), tx, ty + (1 - nk) * 60, font(P ? 260 : 280, 700, D), C.blue, 'left', -8);
  lines(ctx, [[['dossiers', C.navy]], [['by', C.navy], ['level', C.navy], ['of', C.navy], ['evidence.', C.navy]]], tx, ty + (P ? 120 : 130), P ? 84 : 84, P ? 90 : 92,
    (i) => springU(u, 0.4 + i * 0.4, SPRING.snappy));
}
const STEPS = [['01', 'Learn the language'], ['02', 'Read research at the right level'], ['03', 'Read documents, not logos'], ['04', 'Join in within the limits']];
function sRoute(ctx, u) {
  bg(ctx, C.navy);
  const x = P ? S.x + 10 : 150, y0 = P ? S.y + 230 : 250, size = P ? 120 : 112;
  kicker(ctx, 'START HERE', x, y0 - size * 1.05, E.outQuint(prog(u, -0.4, 0.3)), C.orange);
  lines(ctx, P ? [[['Don’t', '#fff'], ['start', '#fff']], [['with', '#fff'], ['a', '#fff'], ['vial.', C.orange]]] : [[['Don’t', '#fff'], ['start', '#fff'], ['with', '#fff'], ['a', '#fff'], ['vial.', C.orange]]],
    x, y0, size, size * 1.02, (i) => springU(u, -0.3 + i * 0.3, SPRING.snappy));
  STEPS.forEach(([n, t], i) => {
    const k = springU(u, 0.7 + i * 0.6, SPRING.snappy); if (k <= 0) return;
    let bx, by, bw, bh;
    if (P) { bw = W - 2 * S.x; bh = 150; bx = S.x; by = y0 + size * 1.02 + 120 + i * (bh + 24); }
    else { bw = 385; bh = 330; bx = 150 + i * (bw + 25); by = 480; }
    ctx.save(); ctx.translate(0, (1 - k) * 200); ctx.globalAlpha = clamp(k * 1.5);
    rrect(ctx, bx, by, bw, bh, 22); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 2; ctx.stroke();
    text(ctx, n, bx + 36, by + (P ? 92 : 70), font(P ? 34 : 30, 400, MONO), C.orange, 'left', 4);
    const tf = P ? 50 : 46;
    if (P) text(ctx, t, bx + 120, by + 92, font(fitSize(ctx, t, 700, D, bw - 160, tf), 700, D), '#fff');
    else {
      const ws = t.split(' '), rows = []; let cur = '';
      ctx.font = font(tf, 700, D);
      ws.forEach((w) => { const tr = cur ? cur + ' ' + w : w; if (ctx.measureText(tr).width > bw - 72) { rows.push(cur); cur = w; } else cur = tr; });
      rows.push(cur);
      rows.forEach((r, j) => text(ctx, r, bx + 36, by + 150 + j * 56, font(tf, 700, D), '#fff'));
    }
    ctx.restore();
  });
}
function sPan(ctx, u, IMG, key, kick, rowsP, rowsL, panFrom, panTo) {
  bg(ctx);
  const im = IMG[key];
  const x = P ? 40 : 150, w = W - 2 * x;
  const h = P ? H * 0.46 : H * 0.58, y = P ? H * 0.36 : H * 0.34;
  const k = springU(u, -0.4, SPRING.gentle);
  const z = P ? 1.0 : 1.12;
  const fx = lerp(panFrom, panTo, E.inOutSine(prog(u, 0, 4)));
  ctx.save(); ctx.translate(0, (1 - k) * H * 0.6); shot(ctx, im, x, y, w, h, { zoom: z, fx, fy: 0.3 }); ctx.restore();
  const tx = P ? S.x + 10 : 150, ty = P ? S.y + 200 : 230, size = P ? 110 : 104;
  kicker(ctx, kick, tx, ty - size * 1.05, E.outQuint(prog(u, -0.3, 0.4)));
  lines(ctx, P ? rowsP : rowsL, tx, ty, size, size * 1.02, (i) => springU(u, -0.2 + i * 0.35, SPRING.snappy));
}
const sDossiers = (c, u, I) => sPan(c, u, I, 'dossiers', 'FROM THE ENCYCLOPEDIA', [[['Most-read', C.navy]], [['dossiers', C.blue]]], [[['Most-read', C.navy], ['dossiers', C.blue]]], 0.0, 1.0);
const sArtikelen = (c, u, I) => sPan(c, u, I, 'artikelen', 'NEW', [[['Just', C.navy], ['published', C.blue]]], [[['Just', C.navy], ['published', C.blue]]], 0.0, 0.85);
function sCoa(ctx, u, IMG) {
  bg(ctx);
  const im = IMG.coa;
  const w = P ? W - 2 * 50 : 1000, h = w * im.height / im.width;
  const x = P ? 50 : 120, y = P ? H * 0.46 : (H - h) / 2;
  const k = springU(u, -0.4, SPRING.gentle);
  ctx.save(); ctx.translate((1 - k) * (P ? 0 : -W * 0.5), (1 - k) * (P ? H * 0.5 : 0)); shot(ctx, im, x, y, w, h); ctx.restore();
  // seven steps, ticking one per half beat
  const tx = P ? S.x + 10 : W - 650, ty = P ? S.y + 250 : H * 0.42;
  kicker(ctx, 'COA GUIDE', tx, ty - (P ? 230 : 230), E.outQuint(prog(u, -0.3, 0.4)), C.blue);
  const step = clamp(Math.floor(prog(u, 0.2, 3.2) * 7) + 1, 1, 7);
  const sk = springU(u, 0.1, SPRING.snappy);
  if (sk > 0) {
    text(ctx, `${step}`, tx, ty + (1 - sk) * 60, font(P ? 240 : 240, 700, D), C.navy, 'left', -6);
    ctx.font = font(P ? 240 : 240, 700, D); const nw = ctx.measureText('7').width;
    text(ctx, '/ 7', tx + nw + 24, ty, font(P ? 80 : 80, 400, D), C.mute);
  }
  for (let i = 0; i < 7; i++) {
    const on = i < step;
    rrect(ctx, tx + i * 62, ty + 50, 48, 12, 6); ctx.fillStyle = on ? C.blue : C.line; ctx.fill();
  }
  const lk = E.outQuint(prog(u, 0.8, 1.4));
  ctx.save(); ctx.globalAlpha = lk;
  (P ? ['steps to read a COA.'] : ['steps to read', 'a COA.']).forEach((l, i) => text(ctx, l, tx, ty + 140 + i * 56, font(P ? 52 : 48, 700, D), C.navy));
  ctx.restore();
}
function sPartner(ctx, u, IMG) {
  bg(ctx);
  const x = P ? S.x + 10 : 150, y0 = P ? S.y + 200 : 260, size = P ? 120 : 116;
  kicker(ctx, 'PARTNERSHIPS', x, y0 - size * 1.05, E.outQuint(prog(u, -0.4, 0.3)));
  lines(ctx, [[['Partner', C.navy], ['of', C.navy]], [['PeptidePraat:', C.navy]]], x, y0, size, size * 1.02, (i) => springU(u, -0.3 + i * 0.3, SPRING.snappy));
  // the real chip from the site's partner row, scaled up
  const ck = springU(u, 0.6, SPRING.bouncy);
  if (ck > 0) {
    const im = IMG.chip, cw = P ? 760 : 700, ch = cw * im.height / im.width;
    const cx = x, cy = y0 + size * 1.02 + (P ? 70 : 60);
    ctx.save(); ctx.translate(cx, cy + ch / 2); ctx.scale(ck, ck);
    ctx.shadowColor = 'rgba(13,34,56,0.18)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
    rrect(ctx, 0, -ch / 2, cw, ch, ch * 0.18); ctx.fillStyle = '#fff'; ctx.fill(); ctx.shadowColor = 'transparent';
    cover(ctx, im, 0, -ch / 2, cw, ch, { radius: ch * 0.18 });
    ctx.restore();
  }
  const uk = E.outQuint(prog(u, 1.2, 1.8));
  ctx.save(); ctx.globalAlpha = uk;
  text(ctx, 'itidelabs.com', x, y0 + size * 1.02 + (P ? 70 : 60) + (P ? 290 : 260), font(P ? 60 : 54, 700, D), C.blue);
  ctx.restore();
  // three ITide vials (cut out), stepping in on the beat
  const vials = ['tb500', 'glow', 'klow'];
  const floor = P ? H * 0.87 : H * 0.8, vh = P ? 640 : 560;
  vials.forEach((n, i) => {
    const k = springU(u, 0.4 + i * 0.4, SPRING.bouncy); if (k <= 0) return;
    const im = IMG['it_' + n], vw = vh * im.width / im.height;
    const cx = P ? W / 2 + (i - 1) * 320 : W * 0.6 + i * 230;
    const g = ctx.createRadialGradient(cx, floor, 0, cx, floor, vw * 0.7);
    g.addColorStop(0, 'rgba(13,34,56,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.globalAlpha = clamp(k * 1.5); ctx.fillStyle = g;
    ctx.save(); ctx.translate(cx, floor); ctx.scale(1, 0.18); ctx.beginPath(); ctx.arc(0, 0, vw * 0.7, 0, TAU); ctx.fill(); ctx.restore();
    ctx.drawImage(im, cx - vw / 2, floor - vh - (1 - k) * 240, vw, vh);
    ctx.restore();
  });
}
function sNoHype(ctx, u) {
  bg(ctx, C.navy);
  const cx = W / 2, size = P ? 140 : 140, y0 = H / 2 - size * 1.0;
  const rows = [['No sales.', '#fff'], ['No dosing.', '#fff'], ['No hype.', C.orange]];
  rows.forEach(([t, col], i) => {
    const k = springU(u, -0.3 + i * 0.9, SPRING.snappy); if (k <= 0) return;
    const s = Math.min(size, fitSize(ctx, t, 700, D, P ? S.w : W * 0.8, size, -0.03));
    ctx.save(); ctx.beginPath(); ctx.rect(0, y0 + i * size * 1.08 - size, W, size * 1.3); ctx.clip();
    text(ctx, t, cx, y0 + i * size * 1.08 + (1 - clamp(k)) * size * 1.2, font(s, 700, D), col, 'center', -s * 0.03);
    ctx.restore();
  });
  const sk = E.outQuint(prog(u, 2.6, 3.2));
  ctx.save(); ctx.globalAlpha = sk;
  text(ctx, 'Explained with sources and a level of evidence.', cx, y0 + 3 * size * 1.08 + 30, font(P ? 46 : 44, 400, D), 'rgba(255,255,255,0.75)', 'center');
  ctx.restore();
}
function sEnd(ctx, u) {
  bg(ctx);
  const cy = P ? H * 0.38 : H * 0.36;
  const mk = springU(u, -0.3, SPRING.bouncy);
  const q = 0.06 * wobble(u - 0.1, 2, 4);
  ctx.save(); ctx.translate(W / 2, cy); ctx.scale(1 + q, 1 - q); ctx.translate(-W / 2, -cy);
  mark(ctx, W / 2, cy, P ? 260 : 230, mk, prog(u, 0, 1.0));
  ctx.restore();
  // wordmark: Peptide (bold) + Praat (regular), as on the site
  const ws = P ? 130 : 120, wy = cy + (P ? 250 : 230);
  const wk = springU(u, 0.3, SPRING.snappy);
  if (wk > 0) {
    ctx.font = font(ws, 700, D); ctx.letterSpacing = `${-ws * 0.03}px`; const a = ctx.measureText('Peptide').width;
    ctx.font = font(ws, 400, D); const b = ctx.measureText('Praat').width; ctx.letterSpacing = '0px';
    const x0 = W / 2 - (a + b) / 2;
    ctx.save(); ctx.beginPath(); ctx.rect(0, wy - ws, W, ws * 1.3); ctx.clip(); ctx.translate(0, (1 - clamp(wk)) * ws * 1.2);
    text(ctx, 'Peptide', x0, wy, font(ws, 700, D), C.navy, 'left', -ws * 0.03);
    text(ctx, 'Praat', x0 + a, wy, font(ws, 400, D), C.navy, 'left', -ws * 0.03);
    ctx.restore();
  }
  const bk = springU(u, 0.9, SPRING.bouncy);
  if (bk > 0) {
    const f = font(P ? 58 : 52, 700, D); ctx.font = f;
    const label = 'peptidepraat.nl  →', bw = ctx.measureText(label).width + 110, bh = P ? 124 : 110;
    ctx.save(); ctx.translate(W / 2, wy + 70 + bh / 2); ctx.scale(lerp(0.7, 1, bk), lerp(0.7, 1, bk));
    rrect(ctx, -bw / 2, -bh / 2, bw, bh, 18); ctx.fillStyle = C.navy; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, 3);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.restore();
  }
  kicker(ctx, 'INDEPENDENT REFERENCE', W / 2, wy + (P ? 290 : 265), E.outQuint(prog(u, 1.6, 2.2)), C.blue, 'center');
  const rk = E.outQuint(prog(u, 2.2, 2.8));
  ctx.save(); ctx.globalAlpha = rk * 0.9;
  text(ctx, 'Educational reference. Not medical advice.', W / 2, P ? H - S.y - 20 : H - 80, font(P ? 36 : 32, 400, D), C.mute, 'center');
  ctx.restore();
}

// ---------------------------------------------------------------- edit
const SCENES = [
  [0, sHook, [[-0.3, 'r1', 'impact'], [0.5, 'r2', 'tick'], [1.3, 'r3', 'tick'], [2.0, 'dot', 'pop', { pitch: 'E6' }]]],
  [4, sLadder, [[-0.2, 'count', 'thud'], [1.6, 'thirty', 'pop', { pitch: 'A5' }]]],
  [8, sRoute, [[-0.3, 'title', 'impact'], [0.7, 's1', 'tick'], [1.3, 's2', 'tick'], [1.9, 's3', 'tick'], [2.5, 's4', 'tick']]],
  [12, sDossiers, [[-0.2, 'title', 'thud']]],
  [16, sCoa, [[0.1, 'n', 'thud'], ...[1, 2, 3, 4, 5, 6].map((i) => [0.2 + i * 3 / 7, 'step', 'tick'])]],
  [20, sArtikelen, [[-0.2, 'title', 'thud']]],
  [24, sPartner, [[-0.3, 'title', 'impact'], [0.4, 'v1', 'pop', { pitch: 'A5' }], [0.6, 'chip', 'thud'], [0.8, 'v2', 'pop', { pitch: 'C6' }], [1.2, 'v3', 'pop', { pitch: 'E6' }]]],
  [28, sNoHype, [[-0.3, 'g1', 'impact'], [0.6, 'g2', 'impact'], [1.5, 'g3', 'impact']]],
  [32, sEnd, [[-0.3, 'mark', 'impact'], [0.3, 'word', 'bell', { pitch: 'A5' }], [0.9, 'url', 'pop', { pitch: 'E6' }]]],
];
const DIRS = [[1, 0], [0, 1], [-1, 0]];
const WHIPS = {};
SCENES.forEach(([b], i) => { if (i > 0) WHIPS[b] = DIRS[(i - 1) % 3]; });
const HITS = [];
SCENES.forEach(([s, , hits]) => hits.forEach(([b, ...r]) => HITS.push([b + s, ...r])));
Object.keys(WHIPS).forEach((b, i) => HITS.push([Number(b) - 0.5, 'whip', 'whoosh', { len: 0.45, from: i % 2 ? 2400 : 600, to: i % 2 ? 600 : 2400 }]));
HITS.sort((a, b) => a[0] - b[0]);
function sceneAt(u) { let i = 0; while (i + 1 < SCENES.length && u >= SCENES[i + 1][0]) i++; return i; }
const drawScene = (i, ctx, u, IMG) => SCENES[i][1](ctx, u - SCENES[i][0], IMG);

M.film({
  fonts: [font(100, 700, D), font(40, 400, D), font(30, 400, MONO)],
  images: Object.fromEntries([...['ladder', 'dossiers', 'artikelen', 'coa'].map((k) => [k, `assets/${k}.png`]), ['chip', 'assets/partner_chip.png'], ...['tb500', 'glow', 'klow'].map((n) => ['it_' + n, `assets/itide/${n}.png`])]),
  hits: HITS,
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
    ctx.save(); ctx.globalAlpha = 0.025; ctx.globalCompositeOperation = 'overlay';
    for (let i = 0; i < 1000; i++) {
      ctx.fillStyle = hash01(i + 99, f) > 0.5 ? '#fff' : '#000';
      ctx.fillRect(hash01(i, f + 1) * W, hash01(i + 7777, f + 3) * H, 3, 3);
    }
    ctx.restore();
  },
});
