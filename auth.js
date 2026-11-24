// Inloggen voor Ghost Crawler.
// Zolang er geen gebruikers zijn (bijv. op je eigen telefoon), staat inloggen uit.
//
// Gebruikers beheren:
//   GHOST_PASSWORD='geheim' node server.js user add <naam> <rol>   (rol: admin | nl | us)
//   node server.js user del <naam>
//   node server.js user list
//
// Rollen:  admin = alles  ·  nl = alleen de Nederlandse prijsvolger  ·  us = alleen de Amerikaanse prijsvolger

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = function createAuth({ dir }) {
  const DATA = path.join(dir, 'data');
  const USERS = path.join(DATA, 'users.json');
  const SECRET = path.join(DATA, 'secret.key');
  const ROLES = { admin: 'alles', nl: 'Prijsvolger NL', us: 'Price tracker US' };
  const HOME = { admin: '/', nl: '/prijzen.html', us: '/prices.html' };
  const ALLOW = {
    nl: p => ['/prijzen.html', '/prijzen'].includes(p) || p.startsWith('/api/pw/nl/'),
    us: p => ['/prices.html', '/prices'].includes(p) || p.startsWith('/api/pw/us/'),
  };

  const loadUsers = () => { try { return JSON.parse(fs.readFileSync(USERS, 'utf8')); } catch { return []; } };
  const saveUsers = u => { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(USERS, JSON.stringify(u, null, 2), { mode: 0o600 }); };
  function secret() {
    try { return fs.readFileSync(SECRET); } catch {
      fs.mkdirSync(DATA, { recursive: true });
      const s = crypto.randomBytes(32);
      fs.writeFileSync(SECRET, s, { mode: 0o600 });
      return s;
    }
  }
  const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');
  const sign = v => crypto.createHmac('sha256', secret()).update(v).digest('base64url');

  // ---------- Opdrachtregel ----------
  function cli(args) {
    if (args[0] !== 'user') return false;
    const [, cmd, name, role] = args;
    const users = loadUsers();
    if (cmd === 'list') {
      if (!users.length) console.log('Geen gebruikers: inloggen staat uit.');
      for (const u of users) console.log(`${u.name}  (${u.role}: ${ROLES[u.role]})`);
    } else if (cmd === 'add') {
      const pw = process.env.GHOST_PASSWORD;
      if (!name || !ROLES[role] || !pw || pw.length < 6) {
        console.log("Gebruik: GHOST_PASSWORD='wachtwoord' node server.js user add <naam> <admin|nl|us>   (wachtwoord min. 6 tekens)");
        process.exitCode = 1; return true;
      }
      const salt = crypto.randomBytes(16).toString('hex');
      const rest = users.filter(u => u.name.toLowerCase() !== name.toLowerCase());
      rest.push({ name, role, salt, hash: hashPw(pw, salt), created: new Date().toISOString() });
      saveUsers(rest);
      console.log(`✔ Gebruiker "${name}" opgeslagen (${ROLES[role]}).`);
    } else if (cmd === 'del') {
      saveUsers(users.filter(u => u.name.toLowerCase() !== String(name).toLowerCase()));
      console.log(`✔ Gebruiker "${name}" verwijderd.`);
    } else {
      console.log('Gebruik: node server.js user <list|add|del> …');
    }
    return true;
  }

  // ---------- Sessies ----------
  function sessionUser(req) {
    const m = (req.headers.cookie || '').match(/(?:^|;\s*)ghost_session=([^;]+)/);
    if (!m) return null;
    const [name64, exp, sig] = decodeURIComponent(m[1]).split('.');
    if (!name64 || !exp || !sig || Date.now() > +exp) return null;
    const expect = sign(name64 + '.' + exp);
    if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
    const name = Buffer.from(name64, 'base64url').toString();
    return loadUsers().find(u => u.name === name) || null;
  }

  const attempts = new Map();
  const clientIp = req => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function loginPage(res, next, error, status = 200) {
    const en = /prices|\/us\//.test(next);
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(`<!doctype html><html lang="${en ? 'en' : 'nl'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#0f1117">
<title>${en ? 'Sign in' : 'Inloggen'} · Ghost</title><style>
:root{--bg:#0f1117;--panel:#171a23;--border:#2a2f3d;--text:#e6e8ee;--muted:#8b90a0;--accent:#8b7bff;--err:#f2555a}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:16px}
form{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:24px;width:100%;max-width:360px}h1{margin:0 0 4px;font-size:22px}p{color:var(--muted);margin:0 0 18px;font-size:14px}
label{display:block;color:var(--muted);font-size:12px;margin:12px 0 4px}input{width:100%;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:9px;padding:12px;font:inherit;font-size:16px}
input:focus{outline:2px solid var(--accent);outline-offset:-1px}button{width:100%;margin-top:18px;background:var(--accent);color:#fff;border:0;border-radius:9px;padding:12px;font:inherit;font-weight:600}
.err{color:var(--err);font-size:14px;margin-top:12px}</style></head><body>
<form method="post" action="/login"><h1>👻 Ghost</h1><p>${en ? 'Sign in to continue' : 'Log in om verder te gaan'}</p>
<input type="hidden" name="next" value="${esc(next)}">
<label>${en ? 'Username' : 'Gebruikersnaam'}</label><input name="user" autocomplete="username" autocapitalize="off" required autofocus>
<label>${en ? 'Password' : 'Wachtwoord'}</label><input name="pass" type="password" autocomplete="current-password" required>
<button>${en ? 'Sign in' : 'Inloggen'}</button>${error ? `<div class="err">${esc(error)}</div>` : ''}</form></body></html>`);
  }

  // Geeft true als het verzoek door mag; anders is er al een antwoord gestuurd.
  async function check(req, res, url) {
    const users = loadUsers();
    const p = url.pathname;
    if (!users.length) {
      if (p === '/logout' || p === '/login') { res.writeHead(302, { Location: '/' }); res.end(); return false; }
      return true;
    }

    if (p === '/login' && req.method === 'POST') {
      const ip = clientIp(req);
      const a = attempts.get(ip) || { n: 0, t: Date.now() };
      if (Date.now() - a.t > 15 * 60e3) { a.n = 0; a.t = Date.now(); }
      let body = '';
      for await (const c of req) { body += c; if (body.length > 10000) break; }
      const f = new URLSearchParams(body);
      const next = (f.get('next') || '').startsWith('/') && !f.get('next').startsWith('//') ? f.get('next') : '';
      if (a.n >= 8) return loginPage(res, next, 'Te veel pogingen. Probeer het over 15 minuten opnieuw. / Too many attempts, try again in 15 minutes.', 429), false;
      const u = users.find(x => x.name.toLowerCase() === String(f.get('user') || '').trim().toLowerCase());
      const ok = u && crypto.timingSafeEqual(Buffer.from(hashPw(String(f.get('pass') || ''), u.salt), 'hex'), Buffer.from(u.hash, 'hex'));
      if (!ok) {
        a.n++; attempts.set(ip, a);
        await new Promise(r => setTimeout(r, 600));
        return loginPage(res, next, 'Onjuiste gebruikersnaam of wachtwoord. / Wrong username or password.', 401), false;
      }
      attempts.delete(ip);
      const exp = Date.now() + 30 * 864e5;
      const name64 = Buffer.from(u.name).toString('base64url');
      const value = `${name64}.${exp}.${sign(name64 + '.' + exp)}`;
      const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
      const target = next && (u.role === 'admin' || (ALLOW[u.role] && ALLOW[u.role](next.split('?')[0]))) ? next : HOME[u.role];
      res.writeHead(302, { 'Set-Cookie': `ghost_session=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 86400}${secure}`, Location: target });
      res.end();
      return false;
    }
    if (p === '/logout') {
      res.writeHead(302, { 'Set-Cookie': 'ghost_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0', Location: '/login' });
      res.end();
      return false;
    }

    const user = sessionUser(req);
    if (!user) {
      if (p.startsWith('/api/')) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end('{"error":"login"}'); return false; }
      if (p === '/login') return loginPage(res, url.searchParams.get('next') || ''), false;
      res.writeHead(302, { Location: '/login?next=' + encodeURIComponent(p + url.search) });
      res.end();
      return false;
    }
    if (p === '/login') { res.writeHead(302, { Location: HOME[user.role] }); res.end(); return false; }
    if (p === '/api/me') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ name: user.name, role: user.role })); return false; }
    if (user.role === 'admin' || (ALLOW[user.role] && ALLOW[user.role](p))) return true;
    if (p.startsWith('/api/')) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end('{"error":"forbidden"}'); return false; }
    res.writeHead(302, { Location: HOME[user.role] });
    res.end();
    return false;
  }

  return { cli, check, enabled: () => loadUsers().length > 0 };
};
