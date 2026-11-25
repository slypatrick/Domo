// Domo API — Cloudflare Worker + D1. No dependencies.
// Static files in /public are served by the assets binding; this worker handles /api/*.

const DAY = 864e5;
const SESSION_DAYS = 60;
const BLIND_DAYS = 14; // a review becomes public when both sides have reviewed, or after 14 days
const STATUSES = ['new', 'noanswer', 'confirmed', 'shipped', 'delivered', 'refused', 'cancelled'];
const REVIEWABLE = ['delivered', 'refused'];
// Why a delivery failed. Only a refusal by the customer, not contested (or contested and rejected), counts against them.
const FAIL_CAUSES = {
  customer: 'Refusé par le client à la livraison',
  unreachable: 'Client injoignable ou absent',
  address: 'Adresse introuvable ou erronée',
  seller: 'Erreur de la boutique (article, prix, retard)',
  courier: 'Problème de livraison (retard, colis abîmé)',
  other: 'Autre motif',
};
const COUNTS_AGAINST = "status='refused' AND COALESCE(fail_cause,'customer')='customer' AND COALESCE(fail_contest,'rejected')='rejected'";
const TAGS = {
  customer: ['Paiement rapide', 'Joignable', 'Adresse précise', 'Poli', 'Injoignable', 'Colis refusé', 'Adresse incorrecte'],
  seller: ['Produit conforme', 'Livraison rapide', 'Bon contact', 'Emballage soigné', 'Produit non conforme', 'Retard', 'Prix différent'],
};

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const rid = (n = 12) => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(n))))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sha256 = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));

async function hashPass(pw, salt = rid(16), iterations = 100000) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations }, key, 256);
  return `pbkdf2$${iterations}$${salt}$${hex(bits)}`;
}
async function checkPass(pw, stored) {
  const [, it, salt] = String(stored).split('$');
  const again = await hashPass(pw, salt, +it);
  if (again.length !== stored.length) return false;
  let diff = 0;
  for (let i = 0; i < again.length; i++) diff |= again.charCodeAt(i) ^ stored.charCodeAt(i);
  return diff === 0;
}

const normPhone = p => {
  let d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('00216')) d = d.slice(5); else if (d.startsWith('216') && d.length === 11) d = d.slice(3);
  return d;
};
const okPhone = d => /^[2-9]\d{7}$/.test(d);
const str = (v, max, field, required = false) => {
  const s = String(v ?? '').trim();
  if (required && !s) fail(400, `Champ requis : ${field}`);
  if (s.length > max) fail(400, `${field} : ${max} caractères maximum`);
  return s;
};
const money = (v, field) => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || n < 0 || n > 1e6) fail(400, `Montant invalide : ${field}`);
  return Math.round(n * 1000) / 1000;
};
const REF_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const normRef = r => String(r || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
// Fixed-window rate limit kept in D1 (shared across isolates). Fails open if the table is unavailable.
async function rateLimit(env, req, name, max, windowSec) {
  try {
    const ip = req.headers.get('cf-connecting-ip') || 'unknown';
    const w = Math.floor(Date.now() / (windowSec * 1000));
    const row = await env.DB.prepare('INSERT INTO rate_hits (k, w, n) VALUES (?1, ?2, 1) ON CONFLICT(k, w) DO UPDATE SET n = n + 1 RETURNING n').bind(name + ':' + ip, w).first();
    if (Math.random() < 0.02) await env.DB.prepare('DELETE FROM rate_hits WHERE w < ?').bind(w - 5).run();
    if (row && row.n > max) fail(429, 'Trop de tentatives. Réessayez dans une minute.');
  } catch (e) { if (e instanceof HttpError) throw e; }
}
const fmtRef = r => r ? r.slice(0, 2) + '-' + r.slice(2) : '';
async function genRef(env) {
  for (let i = 0; i < 6; i++) {
    const b = crypto.getRandomValues(new Uint8Array(6));
    const ref = 'DM' + [...b].map(x => REF_ABC[x % REF_ABC.length]).join('');
    if (!(await env.DB.prepare('SELECT 1 FROM orders WHERE ref=?').bind(ref).first())) return ref;
  }
  fail(500, 'Impossible de générer un identifiant');
}
const RESERVED = ['api', 'admin', 'wsel', 'domo', 'shop', 'app', 'track', 'suivi', 'login', 'www'];
const slugify = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
async function uniqueSlug(env, base, selfId = '') {
  let root = slugify(base); if (root.length < 3) root = 'boutique-' + root;
  root = root.replace(/-+$/,'');
  for (let i = 0; i < 20; i++) {
    const cand = i ? `${root.slice(0, 26)}-${i + 1}` : root;
    if (RESERVED.includes(cand)) continue;
    const hit = await env.DB.prepare('SELECT id FROM users WHERE slug=?').bind(cand).first();
    if (!hit || hit.id === selfId) return cand;
  }
  return `${root.slice(0, 20)}-${rid(3).toLowerCase().replace(/[^a-z0-9]/g, 'x')}`;
}
async function genStoreCode(env, shop) {
  const letters = String(shop || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().split(/[^A-Z]+/).filter(Boolean);
  let pre = letters.length >= 2 ? letters[0][0] + letters[1][0] : (letters[0] || 'WS').slice(0, 2).padEnd(2, 'S');
  pre = pre.replace(/[IO]/g, m => m === 'I' ? 'J' : 'Q');
  for (let i = 0; i < 8; i++) {
    const b = crypto.getRandomValues(new Uint8Array(4));
    const code = pre + [...b].map(x => REF_ABC[x % REF_ABC.length]).join('');
    if (!(await env.DB.prepare('SELECT 1 FROM users WHERE store_code=?').bind(code).first())) return code;
  }
  return 'WS' + rid(4).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
}
const fmtCode = c => c ? c.slice(0, 2) + '-' + c.slice(2) : '';
const secureFee = sub => Math.min(15, Math.max(2, Math.round(sub * 0.03 * 10) / 10));
const DISPUTE_REASONS = ['Produit non conforme', 'Produit endommagé', 'Article manquant', 'Mauvaise taille ou couleur', 'Autre'];
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,authorization', 'access-control-max-age': '86400' };
const firstName = n => String(n || '').trim().split(/\s+/)[0] || '';
// Customers appear to others as "Amira B." — sellers as their shop name.
const displayName = u => u.role === 'seller'
  ? (u.shop || u.name)
  : [firstName(u.name), (String(u.name).trim().split(/\s+/)[1] || '').charAt(0)].filter(Boolean).join(' ') + (String(u.name).trim().split(/\s+/)[1] ? '.' : '');

const meView = u => ({
  id: u.id, role: u.role, name: u.name, phone: u.phone, city: u.city || '', shop: u.shop || '',
  verified: !!u.phone_verified, settings: JSON.parse(u.settings || '{}'), created_at: u.created_at,
  slug: u.slug || '', api_key_hint: u.api_key_hint || '', bio: u.bio || '', cover: u.cover || '', logo: u.logo || '', store_code: fmtCode(u.store_code),
  avatar: u.avatar || '', prefs: jparse(u.prefs, {}), seller_verified: !!u.seller_verified, pickup: jparse(u.pickup, null),
});
const jparse = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
const publicView = u => ({ id: u.id, role: u.role, name: displayName(u), city: jparse(u.prefs, {}).hideCity ? '' : (u.city || ''), verified: !!u.phone_verified, since: u.created_at, avatar: u.avatar || '',
  ...(u.role === 'seller' ? { logo: u.logo || '', slug: u.slug || '', code: fmtCode(u.store_code), vs: !!u.seller_verified } : {}) });

/* ---------------- auth ---------------- */
async function createSession(env, userId) {
  const token = rid(32);
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256(token), userId, Date.now() + SESSION_DAYS * DAY).run();
  return token;
}
async function createDriverSession(env, driverId) {
  const token = 'drv_' + rid(32);
  await env.DB.prepare('INSERT INTO driver_sessions (token_hash, driver_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256(token), driverId, Date.now() + SESSION_DAYS * DAY).run();
  return token;
}
async function currentUser(req, env) {
  const m = (req.headers.get('authorization') || '').match(/^Bearer (.+)$/);
  if (!m) return null;
  if (m[1].startsWith('drv_')) {
    const d = await env.DB.prepare('SELECT d.* FROM driver_sessions s JOIN drivers d ON d.id = s.driver_id WHERE s.token_hash = ? AND s.expires_at > ?')
      .bind(await sha256(m[1]), Date.now()).first();
    return d ? { ...d, role: 'driver' } : null;
  }
  return env.DB.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?')
    .bind(await sha256(m[1]), Date.now()).first();
}

/* ---------------- trust score ---------------- */
const VISIBLE = `(r.created_at < ?2 OR EXISTS (SELECT 1 FROM reviews r2 WHERE r2.order_id = r.order_id AND r2.author_id = r.target_id))`;

// Buyer reliability is private and per shop: a seller only sees their own history with a buyer (scope = seller id).
// Without a scope (the buyer's own profile, public pages) no score is computed for buyers.
async function trust(env, user, scope) {
  const cutoff = Date.now() - BLIND_DAYS * DAY;
  const rv = await env.DB.prepare(`SELECT COUNT(*) n, COALESCE(SUM(rating),0) s FROM reviews r WHERE r.target_id = ?1 AND ${VISIBLE}${user.role === 'customer' && scope ? ' AND r.author_id = ?3' : ''}`)
    .bind(...(user.role === 'customer' && scope ? [user.id, cutoff, scope] : [user.id, cutoff])).first();
  const n = rv.n, avg = n ? Math.round((rv.s / n) * 10) / 10 : null;
  if (user.role === 'customer') {
    const o = await env.DB.prepare(`SELECT COALESCE(SUM(status='delivered'),0) d, COALESCE(SUM(${COUNTS_AGAINST}),0) r, COALESCE(SUM(status='cancelled'),0) c, COALESCE(SUM(status='refused' AND fail_contest='open'),0) k, COALESCE(SUM(status='refused'),0) rr FROM orders WHERE customer_id = ?${scope ? ' AND seller_id = ?' : ''}`)
      .bind(...(scope ? [user.id, scope] : [user.id])).first();
    // Delivery reliability counts most (70%). Both parts start from a neutral prior so one bad order can't sink a new customer.
    const reliability = (o.d + 3) / (o.d + o.r + 4);
    const rating = (rv.s + 3 * 3.5) / (n + 3);
    const score = Math.round(100 * (0.7 * reliability + 0.3 * rating / 5));
    const level = !user.phone_verified ? 'unverified' : o.d + o.r + n < 3 ? 'new' : score >= 80 ? 'trusted' : score >= 60 ? 'average' : 'risky';
    return { score, level, delivered: o.d, refused: o.r, cancelled: o.c, contested: o.k, excluded: o.rr - o.r - o.k, reviews: n, avg };
  }
  const o = await env.DB.prepare(`SELECT COALESCE(SUM(status='delivered'),0) d FROM orders WHERE seller_id = ?`).bind(user.id).first();
  const score = Math.round(20 * (rv.s + 4 * 3.5) / (n + 4));
  const level = n < 3 ? 'new' : score >= 80 ? 'trusted' : score >= 60 ? 'average' : 'risky';
  return { score, level, delivered: o.d, reviews: n, avg };
}

async function card(env, user, scope) {
  if (user.role === 'customer' && !scope) return { ...publicView(user), trust: { level: 'private', delivered: 0, refused: 0, reviews: 0, avg: null, score: 0 }, badges: [] };
  return { ...publicView(user), trust: await trust(env, user, scope), badges: user.role === 'customer' ? [] : (await userBadges(env, user)).earned };
}

/* ---------------- orders ---------------- */
const ORDER_FIELDS = ['name', 'phone', 'gov', 'addr', 'items', 'price', 'cost', 'courier', 'ret', 'src', 'notes'];
function cleanOrder(b, partial = false) {
  const o = {};
  const has = k => !partial || b[k] !== undefined;
  if (has('name')) o.name = str(b.name, 80, 'nom', true);
  if (has('phone')) { o.phone = normPhone(b.phone); if (!okPhone(o.phone)) fail(400, 'Numéro invalide : 8 chiffres tunisiens'); }
  if (has('gov')) o.gov = str(b.gov, 40, 'gouvernorat');
  if (has('addr')) o.addr = str(b.addr, 200, 'adresse');
  if (has('items')) o.items = str(b.items, 300, 'produits', true);
  if (has('price')) { o.price = money(b.price, 'prix'); if (!o.price) fail(400, 'Ajoutez le prix total'); }
  for (const k of ['cost', 'courier', 'ret']) if (has(k)) o[k] = money(b[k], k);
  if (has('src')) o.src = str(b.src, 20, 'source');
  if (has('notes')) o.notes = str(b.notes, 300, 'notes');
  if (b.carrier !== undefined) o.carrier = str(b.carrier, 40, 'transporteur') || null;
  if (b.carrier_ref !== undefined) o.carrier_ref = str(b.carrier_ref, 60, 'numéro de suivi') || null;
  return o;
}
async function verifiedCustomerId(env, phone) {
  const c = await env.DB.prepare("SELECT id FROM users WHERE role='customer' AND phone=? AND phone_verified=1").bind(phone).first();
  return c ? c.id : null;
}
async function withReviewFlags(env, rows, me) {
  if (!rows.length) return rows;
  const ids = rows.map(r => r.id);
  const marks = ids.map(() => '?').join(',');
  const mine = await env.DB.prepare(`SELECT order_id FROM reviews WHERE author_id = ? AND order_id IN (${marks})`).bind(me.id, ...ids).all();
  const done = new Set(mine.results.map(r => r.order_id));
  return rows.map(r => ({ ...r, reviewed: done.has(r.id) }));
}

/* ---------------- notifications + Web Push (RFC 8030 / 8291 / 8292) ---------------- */
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const ub64 = s => { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
async function hkdf(salt, ikm, info, len) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8));
}
// aes128gcm content encoding for one push message (RFC 8291 + RFC 8188, single record)
async function encryptPush(p256dh, authSecret, plaintext) {
  const uaPub = ub64(p256dh), auth = ub64(authSecret);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(auth, shared, cat(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(enc.encode(plaintext), new Uint8Array([2]))));
  return cat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPub.length]), asPub, ct);
}
let vapidKey = null;
async function vapidHeader(env, endpoint) {
  if (!vapidKey) {
    const jwk = JSON.parse(env.VAPID_PRIVATE_JWK);
    vapidKey = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  }
  const h = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const c = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT || 'mailto:support@domo.tn' })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, vapidKey, enc.encode(`${h}.${c}`));
  return `vapid t=${h}.${c}.${b64u(sig)}, k=${env.VAPID_PUBLIC_KEY}`;
}
async function sendPush(env, sub, payload, { ttl = 86400, urgency = 'normal' } = {}) {
  const body = await encryptPush(sub.p256dh, sub.auth, JSON.stringify(payload));
  const r = await fetch(sub.endpoint, { method: 'POST', body, headers: {
    authorization: await vapidHeader(env, sub.endpoint), ttl: String(ttl), urgency,
    'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream' } });
  const table = sub._t === 'driver' ? 'driver_push' : 'push_subs';
  if (r.status === 404 || r.status === 410) await env.DB.prepare(`DELETE FROM ${table} WHERE id=?`).bind(sub.id).run();
  else if (r.ok) await env.DB.prepare(`UPDATE ${table} SET last_ok=? WHERE id=?`).bind(Date.now(), sub.id).run();
  else console.error('push', r.status, await r.text().catch(() => ''));
  return r.status;
}
// notify a user: store in the bell (unless store:false) and push to every device they enabled
async function notify(env, userId, n) {
  if (!userId) return;
  const t = Date.now();
  if (n.store !== false) await env.DB.prepare('INSERT INTO notifications (id, user_id, type, title, body, url, created_at) VALUES (?,?,?,?,?,?,?)')
    .bind(rid(), userId, n.type, n.title.slice(0, 120), n.body.slice(0, 300), n.url || null, t).run();
  if (!env.VAPID_PRIVATE_JWK || !env.VAPID_PUBLIC_KEY) return;
  const target = await env.DB.prepare('SELECT id, role, prefs, link_id FROM users WHERE id=?').bind(userId).first();
  if (!target) return;
  const cat = NOTIF_CAT[n.type] || 'account';
  if (jparse(target.prefs, {}).n?.[cat] === false) return; // muted category: stays in the bell only
  // A device subscribed from the person's other space (buyer/seller) still gets it; the link opens the right space.
  const subs = (await env.DB.prepare('SELECT * FROM push_subs WHERE user_id=?1 OR (?2 IS NOT NULL AND user_id IN (SELECT id FROM users WHERE link_id=?2)) ORDER BY created_at DESC LIMIT 10')
    .bind(userId, target.link_id).all()).results;
  if (!subs.length) return;
  const badge = (await env.DB.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read_at IS NULL').bind(userId).first()).n;
  const url = n.url || '/';
  await Promise.all(subs.map(sub => {
    const u = sub.user_id === userId ? url : withAs(url, target.role);
    return sendPush(env, sub, { title: n.title, body: n.body, url: u, tag: n.tag || n.type, type: n.type, badge, call: !!n.call }, { ttl: n.ttl || 86400, urgency: n.urgency || (n.call ? 'high' : 'normal') }).catch(e => console.error('push fail', e));
  }));
}
const NOTIF_CAT = { order: 'orders', claim: 'orders', status: 'orders', dispute: 'orders', delivery: 'orders', message: 'messages', call: 'messages', review: 'reviews', verification: 'account', badge: 'account', test: 'account' };
const withAs = (url, role) => { const [path, hash = ''] = String(url).split('#'); return path + (path.includes('?') ? '&' : '?') + 'as=' + role + (hash ? '#' + hash : ''); };
async function notifyDriver(env, driverId, n) {
  if (!driverId || !env.VAPID_PRIVATE_JWK || !env.VAPID_PUBLIC_KEY) return;
  const subs = (await env.DB.prepare('SELECT * FROM driver_push WHERE driver_id=? ORDER BY created_at DESC LIMIT 5').bind(driverId).all()).results;
  await Promise.all(subs.map(sub => sendPush(env, { ...sub, _t: 'driver' }, { title: n.title, body: n.body, url: n.url || '/#tournee', tag: n.tag || 'job', type: 'delivery', badge: 0 }, { urgency: n.urgency || 'high' }).catch(e => console.error('push fail', e))));
}
async function notifyAdmins(env, n) {
  const phones = adminPhones(env);
  if (!phones.length) return;
  const rows = (await env.DB.prepare(`SELECT id FROM users WHERE phone IN (${phones.map(() => '?').join(',')}) AND role='seller'`).bind(...phones).all()).results;
  const ids = rows.length ? rows : (await env.DB.prepare(`SELECT id FROM users WHERE phone IN (${phones.map(() => '?').join(',')})`).bind(...phones).all()).results;
  await Promise.all(ids.map(r => notify(env, r.id, n).catch(() => {})));
}
const adminPhones = env => String(env.ADMIN_PHONES || '').split(/[,\s]+/).map(normPhone).filter(okPhone);
const isAdmin = (env, me) => !!me && me.role !== 'driver' && adminPhones(env).includes(me.phone);
const bg = (ctx, p) => { const q = Promise.resolve(p).catch(e => console.error('bg', e)); if (ctx && ctx.waitUntil) ctx.waitUntil(q); return q; };
const dt = n => (Math.round(n * 1000) / 1000).toLocaleString('fr-FR') + ' DT';

/* ---------------- router ---------------- */
const routes = [];
const on = (method, pattern, handler, opts = {}) =>
  routes.push({ method, pattern, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler, ...opts });

// --- accounts
on('POST', '/api/auth/register', async ({ env, body, ctx }) => {
  if (body.role === 'driver') return registerDriver(env, body, ctx);
  const role = body.role === 'seller' ? 'seller' : body.role === 'customer' ? 'customer' : fail(400, 'Choisissez vendeur ou client');
  const name = str(body.name, 80, 'nom', true);
  const phone = normPhone(body.phone);
  if (!okPhone(phone)) fail(400, 'Numéro invalide : 8 chiffres tunisiens');
  const password = String(body.password || '');
  if (password.length < 8) fail(400, 'Mot de passe : 8 caractères minimum');
  const shop = role === 'seller' ? str(body.shop, 60, 'nom de la boutique', true) : null;
  const city = str(body.city, 40, 'ville');
  if (await env.DB.prepare('SELECT 1 FROM users WHERE role=? AND phone=?').bind(role, phone).first())
    fail(409, 'Un compte existe déjà avec ce numéro. Connectez-vous.');
  const user = { id: rid(), role, name, phone, pass: await hashPass(password), city, shop, settings: '{}', phone_verified: 0, created_at: Date.now() };
  const slug = role === 'seller' ? await uniqueSlug(env, shop) : null;
  const storeCode = role === 'seller' ? await genStoreCode(env, shop) : null;
  await env.DB.prepare('INSERT INTO users (id, role, name, phone, pass, city, shop, settings, phone_verified, created_at, slug, store_code) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(user.id, role, name, phone, user.pass, city, shop, '{}', 0, user.created_at, slug, storeCode).run();
  let linked = 0;
  if (role === 'customer' && body.claim) linked = await linkByClaim(env, user, String(body.claim));
  const fresh = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(user.id).first();
  return json({ token: await createSession(env, user.id), user: meView(fresh), linked }, 201);
}, { public: true });

on('POST', '/api/auth/login', async ({ env, req, body }) => {
  await rateLimit(env, req, 'login', 12, 300);
  const phone = normPhone(body.phone);
  if (body.role === 'driver') {
    const d = await env.DB.prepare('SELECT * FROM drivers WHERE phone=?').bind(phone).first();
    if (!d || !(await checkPass(String(body.password || ''), d.pass))) fail(401, 'Numéro ou mot de passe incorrect');
    if (d.status === 'suspended') fail(403, 'Compte livreur suspendu. Contactez Domo.');
    await env.DB.prepare('DELETE FROM driver_sessions WHERE driver_id=? AND expires_at < ?').bind(d.id, Date.now()).run();
    return json({ token: await createDriverSession(env, d.id), user: driverView(d) });
  }
  const role = body.role === 'seller' ? 'seller' : 'customer';
  const user = await env.DB.prepare('SELECT * FROM users WHERE role=? AND phone=?').bind(role, phone).first();
  if (!user || !(await checkPass(String(body.password || ''), user.pass))) fail(401, 'Numéro ou mot de passe incorrect');
  await env.DB.prepare('DELETE FROM sessions WHERE user_id=? AND expires_at < ?').bind(user.id, Date.now()).run();
  return json({ token: await createSession(env, user.id), user: meView(user) });
}, { public: true });

// --- password reset (admin-assisted: the team sends a one-time link on WhatsApp; no SMS provider yet)
const RESET_ROLES = ['seller', 'customer', 'driver'];
async function findAccount(env, role, phone) {
  return role === 'driver' ? env.DB.prepare('SELECT id, name, phone FROM drivers WHERE phone=?').bind(phone).first()
    : env.DB.prepare('SELECT id, name, phone FROM users WHERE role=? AND phone=?').bind(role, phone).first();
}
on('POST', '/api/auth/forgot', async ({ env, req, body }) => {
  await rateLimit(env, req, 'forgot', 5, 3600);
  const role = RESET_ROLES.includes(body.role) ? body.role : fail(400, 'Type de compte inconnu');
  const phone = normPhone(body.phone);
  if (!okPhone(phone)) fail(400, 'Numéro invalide : 8 chiffres tunisiens');
  // same answer whether or not the account exists, so the form cannot be used to find accounts
  if (await findAccount(env, role, phone)) {
    const open = await env.DB.prepare('SELECT 1 FROM pw_resets WHERE role=? AND phone=? AND used_at IS NULL AND created_at > ?').bind(role, phone, Date.now() - DAY).first();
    if (!open) await env.DB.prepare('INSERT INTO pw_resets (id, role, phone, created_at) VALUES (?,?,?,?)').bind(rid(), role, phone, Date.now()).run();
  }
  return json({ ok: true });
}, { public: true });
on('POST', '/api/admin/resets/:id/link', async ({ env, me, params }) => {
  adminOnly(env, me);
  const r = await env.DB.prepare('SELECT * FROM pw_resets WHERE id=? AND used_at IS NULL').bind(params.id).first();
  if (!r) fail(404, 'Demande introuvable ou déjà utilisée');
  const acct = await findAccount(env, r.role, r.phone);
  if (!acct) fail(404, 'Compte introuvable');
  const token = rid(24), now = Date.now();
  await env.DB.prepare('UPDATE pw_resets SET token_hash=?, expires_at=?, link_at=? WHERE id=?').bind(await sha256(token), now + DAY, now, r.id).run();
  return json({ url: `https://app.domo.tn/?reset=${token}`, phone: r.phone, name: acct.name, role: r.role });
});
on('POST', '/api/auth/reset', async ({ env, req, body }) => {
  await rateLimit(env, req, 'reset', 10, 3600);
  const token = String(body.token || '');
  const password = String(body.password || '');
  if (password.length < 8) fail(400, 'Mot de passe : 8 caractères minimum');
  const r = token && await env.DB.prepare('SELECT * FROM pw_resets WHERE token_hash=? AND used_at IS NULL').bind(await sha256(token)).first();
  if (!r || !r.expires_at || r.expires_at < Date.now()) fail(410, 'Ce lien a expiré ou a déjà servi. Demandez-en un nouveau.');
  const acct = await findAccount(env, r.role, r.phone);
  if (!acct) fail(404, 'Compte introuvable');
  const pass = await hashPass(password), now = Date.now();
  if (r.role === 'driver') {
    await env.DB.batch([env.DB.prepare('UPDATE drivers SET pass=? WHERE id=?').bind(pass, acct.id), env.DB.prepare('DELETE FROM driver_sessions WHERE driver_id=?').bind(acct.id), env.DB.prepare('UPDATE pw_resets SET used_at=? WHERE id=?').bind(now, r.id)]);
    const d = await env.DB.prepare('SELECT * FROM drivers WHERE id=?').bind(acct.id).first();
    return json({ token: await createDriverSession(env, d.id), user: driverView(d) });
  }
  await env.DB.batch([env.DB.prepare('UPDATE users SET pass=? WHERE id=?').bind(pass, acct.id), env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(acct.id), env.DB.prepare('UPDATE pw_resets SET used_at=? WHERE id=?').bind(now, r.id)]);
  const u = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(acct.id).first();
  return json({ token: await createSession(env, u.id), user: meView(u) });
}, { public: true });

on('POST', '/api/auth/logout', async ({ env, req }) => {
  const m = (req.headers.get('authorization') || '').match(/^Bearer (.+)$/);
  if (m) await env.DB.prepare(m[1].startsWith('drv_') ? 'DELETE FROM driver_sessions WHERE token_hash=?' : 'DELETE FROM sessions WHERE token_hash=?').bind(await sha256(m[1])).run();
  return json({ ok: true });
});

on('GET', '/api/me', async ({ env, me }) => {
  if (me.role === 'driver') return json({ user: driverView(me), config: { pay: driverPay(env) } });
  if (me.role === 'seller' && !me.slug) {
    me.slug = await uniqueSlug(env, me.shop || me.name, me.id);
    await env.DB.prepare('UPDATE users SET slug=? WHERE id=?').bind(me.slug, me.id).run();
  }
  if (me.role === 'seller' && !me.store_code) {
    me.store_code = await genStoreCode(env, me.shop || me.name);
    await env.DB.prepare('UPDATE users SET store_code=? WHERE id=?').bind(me.store_code, me.id).run();
  }
  const links = (me.link_id ? (await env.DB.prepare('SELECT role FROM users WHERE link_id=? AND id<>?').bind(me.link_id, me.id).all()).results.map(r => r.role) : []);
  const drv = await env.DB.prepare('SELECT status FROM drivers WHERE phone=?').bind(me.phone).first();
  const ver = me.role === 'seller' ? await env.DB.prepare('SELECT status, note, created_at, reviewed_at FROM verifications WHERE user_id=? ORDER BY created_at DESC LIMIT 1').bind(me.id).first() : null;
  const b = await userBadges(env, me, true);
  return json({ user: { ...meView(me), links, driver: drv ? drv.status : null, admin: isAdmin(env, me) }, trust: await trust(env, me),
    badges: b.earned, badges_next: b.next, verification: ver || null, config: { deliveryFee: deliveryFee(env) } });
});

on('PATCH', '/api/me', async ({ env, me, body }) => {
  if (me.role === 'driver') return patchDriver(env, me, body);
  if (body.password) {
    if (!(await checkPass(String(body.current || ''), me.pass))) fail(400, 'Mot de passe actuel incorrect');
  }
  if (body.avatar !== undefined) {
    const key = ownKey(body.avatar, me);
    const old = me.avatar;
    await env.DB.prepare('UPDATE users SET avatar=? WHERE id=?').bind(key || null, me.id).run();
    if (old && old !== key) await deleteMedia(env, old);
  }
  if (body.prefs !== undefined) {
    const cur = jparse(me.prefs, {}), p = body.prefs || {};
    if (p.n) { cur.n = cur.n || {}; for (const k of ['orders', 'messages', 'reviews', 'account']) if (p.n[k] !== undefined) cur.n[k] = !!p.n[k]; }
    if (p.hideCity !== undefined) cur.hideCity = !!p.hideCity;
    if (p.theme !== undefined) cur.theme = ['system', 'light', 'dark'].includes(p.theme) ? p.theme : 'system';
    await env.DB.prepare('UPDATE users SET prefs=? WHERE id=?').bind(JSON.stringify(cur), me.id).run();
  }
  if (me.role === 'seller' && body.pickup !== undefined) {
    const k = body.pickup || {};
    const pk = { addr: str(k.addr, 200, 'adresse de ramassage'), gov: str(k.gov, 40, 'gouvernorat'), phone: k.phone ? normPhone(k.phone) : '', notes: str(k.notes, 200, 'instructions') };
    const ll = cleanLL(k.lat, k.lng); if (ll) { pk.lat = ll.lat; pk.lng = ll.lng; }
    if (pk.phone && !okPhone(pk.phone)) fail(400, 'Téléphone de ramassage invalide');
    await env.DB.prepare('UPDATE users SET pickup=? WHERE id=?').bind(JSON.stringify(pk), me.id).run();
  }
  const name = body.name !== undefined ? str(body.name, 80, 'nom', true) : me.name;
  const city = body.city !== undefined ? str(body.city, 40, 'ville') : me.city;
  const shop = me.role === 'seller' && body.shop !== undefined ? str(body.shop, 60, 'boutique', true) : me.shop;
  let settings = JSON.parse(me.settings || '{}');
  if (me.role === 'seller' && body.settings) {
    const s = body.settings;
    if (s.tpl !== undefined) settings.tpl = str(s.tpl, 1000, 'message');
    if (s.courier !== undefined) settings.courier = money(s.courier, 'frais livreur');
    if (s.ret !== undefined) settings.ret = money(s.ret, 'frais retour');
    if (s.shipFee !== undefined) settings.shipFee = money(s.shipFee, 'frais de livraison client');
    if (s.secure !== undefined) settings.secure = !!s.secure;
  }
  if (me.role === 'seller') {
    const upd = {};
    if (body.bio !== undefined) upd.bio = str(body.bio, 500, 'bio');
    for (const k of ['cover', 'logo']) if (body[k] !== undefined) upd[k] = ownKey(body[k], me);
    const keys = Object.keys(upd);
    if (keys.length) {
      const old = await env.DB.prepare('SELECT cover, logo FROM users WHERE id=?').bind(me.id).first();
      await env.DB.prepare(`UPDATE users SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=?`).bind(...keys.map(k => upd[k] || null), me.id).run();
      for (const k of ['cover', 'logo']) if (k in upd && old[k] && old[k] !== upd[k]) await deleteMedia(env, old[k]);
    }
  }
  if (me.role === 'seller' && body.slug !== undefined) {
    const want = slugify(body.slug);
    if (want.length < 3 || RESERVED.includes(want)) fail(400, 'Lien : 3 à 30 caractères, lettres, chiffres et tirets');
    const hit = await env.DB.prepare('SELECT id FROM users WHERE slug=?').bind(want).first();
    if (hit && hit.id !== me.id) fail(409, 'Ce lien est déjà pris');
    await env.DB.prepare('UPDATE users SET slug=? WHERE id=?').bind(want, me.id).run();
  }
  if (body.password) {
    if (String(body.password).length < 8) fail(400, 'Mot de passe : 8 caractères minimum');
    await env.DB.prepare('UPDATE users SET pass=? WHERE id=?').bind(await hashPass(String(body.password)), me.id).run();
  }
  await env.DB.prepare('UPDATE users SET name=?, city=?, shop=?, settings=? WHERE id=?').bind(name, city, shop, JSON.stringify(settings), me.id).run();
  const u = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(me.id).first();
  return json({ user: meView(u) });
});

// Deleting an account removes reviews about you; reviews you wrote stay but become anonymous.
on('DELETE', '/api/me', async ({ env, me }) => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(me.id),
    env.DB.prepare('UPDATE orders SET customer_id=NULL WHERE customer_id=?').bind(me.id),
    env.DB.prepare('DELETE FROM users WHERE id=?').bind(me.id),
  ]);
  return json({ ok: true });
});

// --- seller: orders
const sellerOnly = me => { if (me.role !== 'seller') fail(403, 'Réservé aux vendeurs'); };

on('GET', '/api/orders', async ({ env, me }) => {
  sellerOnly(me);
  const rows = (await env.DB.prepare('SELECT * FROM orders WHERE seller_id=? ORDER BY created_at DESC LIMIT 2000').bind(me.id).all()).results;
  const customerIds = [...new Set(rows.map(r => r.customer_id).filter(Boolean))];
  const cards = {};
  await Promise.all(customerIds.map(async id => {
    const u = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first();
    if (u) cards[id] = await card(env, u, me.id);
  }));
  const out = await withReviewFlags(env, rows, me);
  const dIds = [...new Set(rows.map(r => r.driver_id).filter(Boolean))];
  const dn = {};
  if (dIds.length) for (const d of (await env.DB.prepare(`SELECT id, name, phone FROM drivers WHERE id IN (${dIds.map(() => '?').join(',')})`).bind(...dIds).all()).results) dn[d.id] = { name: d.name, phone: d.phone };
  return json({ orders: out.map(r => ({ ...r, customer: r.customer_id ? cards[r.customer_id] || null : null, driver: r.driver_id ? dn[r.driver_id] || null : null })) });
});

async function insertOrder(env, sellerId, o, byRole, idem) {
  idem = typeof idem === 'string' && /^[\w-]{8,64}$/.test(idem) ? idem : null;
  if (idem) { const dup = await env.DB.prepare('SELECT * FROM orders WHERE seller_id=? AND idem=?').bind(sellerId, idem).first(); if (dup) return { ...dup, duplicate: true }; }
  if (idem) o = { ...o, idem };
  const t = Date.now();
  const row = { id: rid(), seller_id: sellerId, customer_id: await verifiedCustomerId(env, o.phone), status: 'new', attempts: 0, claim_token: rid(18), ref: await genRef(env), created_at: t, updated_at: t, ...o };
  const cols = Object.keys(row);
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO orders (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).bind(...cols.map(k => row[k] ?? null)),
    env.DB.prepare('INSERT INTO order_events (order_id, status, by_role, at) VALUES (?,?,?,?)').bind(row.id, 'new', byRole, t),
  ]);
  return row;
}

on('POST', '/api/orders', async ({ env, me, body }) => {
  sellerOnly(me);
  const row = await insertOrder(env, me.id, cleanOrder(body), 'seller', body.idem);
  return json({ order: row }, row.duplicate ? 200 : 201);
});

on('PATCH', '/api/orders/:id', async ({ env, me, body, params, ctx }) => {
  sellerOnly(me);
  const cur = await env.DB.prepare('SELECT * FROM orders WHERE id=? AND seller_id=?').bind(params.id, me.id).first();
  if (!cur) fail(404, 'Commande introuvable');
  const upd = cleanOrder(body, true);
  if (upd.phone && upd.phone !== cur.phone) upd.customer_id = await verifiedCustomerId(env, upd.phone);
  const stmts = [];
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) fail(400, 'Statut invalide');
    if (body.status !== cur.status && ['assigned', 'picked', 'returning'].includes(cur.delivery) && ['shipped', 'delivered', 'refused', 'new', 'noanswer'].includes(body.status))
      fail(409, 'Un livreur Domo s’occupe de ce colis : son statut se met à jour automatiquement.');
    if (body.status === 'cancelled' && cur.delivery === 'assigned') fail(409, 'Un livreur Domo est attribué : annulez d’abord le ramassage.');
    if (body.status !== cur.status && cur.delivery === 'requested' && !['confirmed'].includes(body.status)) { upd.delivery = null; upd.delivery_fee = 0; }
    if (body.status !== cur.status) {
      const reviewed = await env.DB.prepare('SELECT 1 FROM reviews WHERE order_id=? LIMIT 1').bind(cur.id).first();
      if (reviewed) fail(409, 'Cette commande a déjà été évaluée : son statut ne peut plus changer.');
      upd.status = body.status;
      if (body.status === 'refused') { upd.fail_cause = FAIL_CAUSES[body.cause] ? body.cause : 'other'; upd.fail_contest = null; }
      else if (cur.status === 'refused') { upd.fail_cause = null; upd.fail_contest = null; upd.fail_contest_note = null; upd.fail_contest_at = null; }
      stmts.push(env.DB.prepare('INSERT INTO order_events (order_id, status, by_role, at) VALUES (?,?,?,?)').bind(cur.id, body.status, 'seller', Date.now()));
    }
  }
  if (body.attempts !== undefined) upd.attempts = Math.max(0, Math.min(99, parseInt(body.attempts, 10) || 0));
  upd.updated_at = Date.now();
  const keys = Object.keys(upd);
  stmts.unshift(env.DB.prepare(`UPDATE orders SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=?`).bind(...keys.map(k => upd[k]), cur.id));
  await env.DB.batch(stmts);
  const custId = upd.customer_id !== undefined ? upd.customer_id : cur.customer_id;
  if (upd.status) await staleBadges(env, me.id, custId);
  const CUST_MSG = { confirmed: ['Commande confirmée', 'La boutique prépare votre colis.'], shipped: ['Votre colis est en route 🚚', 'Préparez le montant pour la livraison.'], delivered: ['Commande livrée', 'Merci ! Donnez votre avis sur la boutique.'] };
  if (upd.status && custId && CUST_MSG[upd.status]) {
    const [t1, b1] = CUST_MSG[upd.status];
    bg(ctx, notify(env, custId, { type: 'status', title: `${t1} · ${fmtRef(cur.ref)}`, body: `${me.shop} · ${b1}`, url: `/?track=${fmtRef(cur.ref)}`, tag: 'order-' + cur.id }));
  }
  return json({ order: await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(cur.id).first() });
});

on('DELETE', '/api/orders/:id', async ({ env, me, params }) => {
  sellerOnly(me);
  const cur = await env.DB.prepare('SELECT id FROM orders WHERE id=? AND seller_id=?').bind(params.id, me.id).first();
  if (!cur) fail(404, 'Commande introuvable');
  if (await env.DB.prepare('SELECT 1 FROM reviews WHERE order_id=? LIMIT 1').bind(cur.id).first())
    fail(409, 'Une commande évaluée ne peut pas être supprimée.');
  await env.DB.prepare('DELETE FROM orders WHERE id=?').bind(cur.id).run();
  return json({ ok: true });
});

// Seller checks a phone number while typing an order.
// Public trust only for customers who created an account and verified their number; otherwise only this seller's own history.
on('GET', '/api/lookup', async ({ env, me, url }) => {
  sellerOnly(me);
  const phone = normPhone(url.searchParams.get('phone'));
  if (!okPhone(phone)) return json({ customer: null, own: null });
  const own = await env.DB.prepare(`SELECT COALESCE(SUM(status='delivered'),0) d, COALESCE(SUM(${COUNTS_AGAINST}),0) r, COALESCE(SUM(status='cancelled'),0) c FROM orders WHERE seller_id=? AND phone=?`)
    .bind(me.id, phone).first();
  const u = await env.DB.prepare("SELECT * FROM users WHERE role='customer' AND phone=? AND phone_verified=1").bind(phone).first();
  return json({ customer: u ? await card(env, u, me.id) : null, own });
});

// --- customer
on('GET', '/api/my-orders', async ({ env, me }) => {
  if (me.role !== 'customer') fail(403, 'Réservé aux clients');
  const rows = (await env.DB.prepare(`SELECT o.id, o.ref, o.items, o.price, o.gov, o.status, o.created_at, o.claim_token, o.seller_id, o.secure, o.secure_fee, o.dispute_status
    FROM orders o WHERE o.customer_id=? ORDER BY o.created_at DESC LIMIT 500`).bind(me.id).all()).results;
  const sellers = {};
  await Promise.all([...new Set(rows.map(r => r.seller_id))].map(async id => {
    const u = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first();
    if (u) sellers[id] = await card(env, u);
  }));
  const out = await withReviewFlags(env, rows, me);
  return json({ orders: out.map(r => ({ ...r, seller: sellers[r.seller_id] || null })) });
});

// --- claim links (sent to the customer on WhatsApp). Opening one proves access to that phone's WhatsApp.
async function orderByClaim(env, token) {
  const o = await env.DB.prepare('SELECT * FROM orders WHERE claim_token=?').bind(token).first();
  if (!o) fail(404, 'Lien invalide ou expiré');
  return o;
}
async function linkByClaim(env, user, token) {
  const o = await orderByClaim(env, token);
  if (o.phone !== user.phone) fail(403, 'Ce lien concerne un autre numéro de téléphone');
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET phone_verified=1 WHERE id=?').bind(user.id),
    env.DB.prepare('UPDATE orders SET customer_id=? WHERE phone=? AND customer_id IS NULL').bind(user.id, user.phone),
  ]);
  const n = await env.DB.prepare('SELECT COUNT(*) n FROM orders WHERE customer_id=?').bind(user.id).first();
  return n.n;
}

on('GET', '/api/claim/:token', async ({ env, params }) => {
  const o = await orderByClaim(env, params.token);
  const seller = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(o.seller_id).first();
  return json({
    order: { ref: o.ref, items: o.items, price: o.price, gov: o.gov, addr: o.addr, status: o.status, created_at: o.created_at, name: firstName(o.name),
      secure: !!o.secure, secure_fee: o.secure_fee, dispute_status: o.dispute_status, dispute_reason: o.dispute_reason, dispute_note: o.dispute_note },
    canDispute: await canDispute(env, o), disputeReasons: DISPUTE_REASONS,
    seller: await card(env, seller),
    canRespond: ['new', 'noanswer'].includes(o.status),
    located: o.loc_src === 'client',
    fail_cause: o.status === 'refused' ? (o.fail_cause || 'customer') : null, fail_label: o.status === 'refused' ? FAIL_CAUSES[o.fail_cause || 'customer'] : null,
    fail_contest: o.fail_contest, canContest: o.status === 'refused' && (o.fail_cause || 'customer') === 'customer' && !o.fail_contest && Date.now() - o.updated_at < 60 * DAY,
    linked: !!o.customer_id,
  });
}, { public: true });

on('POST', '/api/claim/:token/respond', async ({ env, params, body, ctx }) => {
  const o = await orderByClaim(env, params.token);
  if (!['new', 'noanswer'].includes(o.status)) fail(409, 'Cette commande a déjà été traitée');
  const status = body.action === 'confirm' ? 'confirmed' : body.action === 'cancel' ? 'cancelled' : fail(400, 'Action invalide');
  const t = Date.now();
  await env.DB.batch([
    env.DB.prepare('UPDATE orders SET status=?, updated_at=? WHERE id=?').bind(status, t, o.id),
    env.DB.prepare('INSERT INTO order_events (order_id, status, by_role, at) VALUES (?,?,?,?)').bind(o.id, status, 'customer', t),
  ]);
  bg(ctx, notify(env, o.seller_id, status === 'confirmed'
    ? { type: 'status', title: `${firstName(o.name)} a confirmé ${fmtRef(o.ref)}`, body: `${o.items.slice(0, 80)} · prête à expédier`, url: '/#commandes', tag: 'order-' + o.id }
    : { type: 'status', title: `${firstName(o.name)} a annulé ${fmtRef(o.ref)}`, body: o.items.slice(0, 100), url: '/#commandes', tag: 'order-' + o.id }));
  return json({ status });
}, { public: true });

on('POST', '/api/claim/:token/contest', async ({ env, req, params, body, ctx }) => {
  await rateLimit(env, req, 'contest', 5, 3600);
  const o = await orderByClaim(env, params.token);
  if (o.status !== 'refused' || (o.fail_cause || 'customer') !== 'customer') fail(409, 'Rien à contester sur cette commande');
  if (o.fail_contest) fail(409, 'Une contestation existe déjà pour cette commande');
  const note = str(body.note, 500, 'explication');
  if (!note || note.length < 10) fail(400, 'Expliquez en quelques mots ce qui s’est passé');
  await env.DB.prepare("UPDATE orders SET fail_contest='open', fail_contest_note=?, fail_contest_at=? WHERE id=?").bind(note, Date.now(), o.id).run();
  await staleBadges(env, o.seller_id, o.customer_id);
  bg(ctx, notify(env, o.seller_id, { type: 'dispute', title: `Refus contesté · ${fmtRef(o.ref)}`, body: `${firstName(o.name)} conteste le refus : « ${note.slice(0, 90)} ». L’équipe Domo examine.`, url: '/#commandes', tag: 'order-' + o.id }));
  bg(ctx, notifyAdmins(env, { type: 'admin', title: `Contestation de refus · ${fmtRef(o.ref)}`, body: note.slice(0, 120), url: '/#admin/contestations' }));
  return json({ ok: true });
}, { public: true });

on('POST', '/api/claim/:token/location', async ({ env, req, params, body }) => {
  await rateLimit(env, req, 'loc', 20, 300);
  const o = await orderByClaim(env, params.token);
  if (['delivered', 'refused', 'cancelled', 'returned'].includes(o.status)) fail(409, 'Cette commande est terminée');
  const ll = cleanLL(body.lat, body.lng);
  if (!ll) fail(400, 'Position hors de Tunisie ou invalide');
  await env.DB.prepare("UPDATE orders SET lat=?, lng=?, loc_src='client', updated_at=? WHERE id=?").bind(ll.lat, ll.lng, Date.now(), o.id).run();
  return json({ ok: true });
}, { public: true });

async function canDispute(env, o) {
  if (!o.secure || o.status !== 'delivered' || o.dispute_status) return false;
  const ev = await env.DB.prepare("SELECT MAX(at) at FROM order_events WHERE order_id=? AND status='delivered'").bind(o.id).first();
  return !!ev.at && Date.now() - ev.at <= 7 * DAY;
}
on('POST', '/api/claim/:token/dispute', async ({ env, params, body, ctx }) => {
  const o = await orderByClaim(env, params.token);
  if (!(await canDispute(env, o))) fail(409, !o.secure ? 'Cette commande n’a pas l’achat sécurisé.' : o.dispute_status ? 'Un signalement existe déjà pour cette commande.' : o.status !== 'delivered' ? 'Vous pourrez signaler un problème après la livraison.' : 'Le délai de 7 jours après la livraison est dépassé.');
  const reason = DISPUTE_REASONS.includes(body.reason) ? body.reason : fail(400, 'Choisissez un motif');
  const details = str(body.details, 600, 'détails', true);
  await env.DB.prepare("UPDATE orders SET dispute_status='open', dispute_reason=?, dispute_details=?, dispute_at=?, updated_at=? WHERE id=?").bind(reason, details, Date.now(), Date.now(), o.id).run();
  bg(ctx, notify(env, o.seller_id, { type: 'dispute', title: `Problème signalé · ${fmtRef(o.ref)}`, body: `${firstName(o.name)} : ${reason}. Répondez rapidement.`, url: '/#commandes', tag: 'dispute-' + o.id, urgency: 'high' }));
  return json({ ok: true });
}, { public: true });

on('PATCH', '/api/orders/:id/dispute', async ({ env, me, params, body, ctx }) => {
  sellerOnly(me);
  const o = await env.DB.prepare('SELECT * FROM orders WHERE id=? AND seller_id=?').bind(params.id, me.id).first();
  if (!o) fail(404, 'Commande introuvable');
  if (o.dispute_status !== 'open') fail(409, 'Aucun signalement ouvert');
  const res = ['refunded', 'replaced', 'rejected'].includes(body.resolution) ? body.resolution : fail(400, 'Choisissez une solution');
  const note = str(body.note, 400, 'message', res === 'rejected');
  await env.DB.prepare('UPDATE orders SET dispute_status=?, dispute_note=?, dispute_resolved_at=?, updated_at=? WHERE id=?').bind(res, note, Date.now(), Date.now(), o.id).run();
  const RES = { replaced: 'La boutique vous envoie un échange', refunded: 'La boutique reprend l’article et vous rembourse', rejected: 'La boutique a répondu à votre signalement' };
  if (o.customer_id) bg(ctx, notify(env, o.customer_id, { type: 'dispute', title: `${RES[res]} · ${fmtRef(o.ref)}`, body: note || 'Ouvrez Domo pour voir les détails.', url: '/#mes-commandes', tag: 'dispute-' + o.id }));
  return json({ order: await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(o.id).first() });
});

// --- store directory: search by name, product, category, city, or store ID
on('GET', '/api/stores', async ({ env, url }) => {
  const q = str(url.searchParams.get('q'), 60, 'recherche');
  const cat = str(url.searchParams.get('cat'), 30, 'catégorie');
  const city = str(url.searchParams.get('city'), 40, 'ville');
  const code = normRef(q);
  let exact = null;
  if (/^[A-Z]{2}[A-Z0-9]{4}$/.test(code)) {
    const u = await env.DB.prepare("SELECT * FROM users WHERE role='seller' AND store_code=?").bind(code).first();
    if (u) exact = u.id;
  }
  const like = `%${q.replace(/[%_]/g, '')}%`, likeCat = `%${cat.replace(/[%_]/g, '')}%`;
  const where = ["u.role='seller'", 'EXISTS (SELECT 1 FROM products p WHERE p.seller_id=u.id AND p.active=1)'], args = [];
  if (q && !exact) { where.push('(u.shop LIKE ? OR u.bio LIKE ? OR u.city LIKE ? OR EXISTS (SELECT 1 FROM products p WHERE p.seller_id=u.id AND p.active=1 AND (p.name LIKE ? OR p.category LIKE ?)))'); args.push(like, like, like, like, like); }
  if (exact) { where.push('u.id=?'); args.push(exact); }
  if (cat) { where.push('EXISTS (SELECT 1 FROM products p WHERE p.seller_id=u.id AND p.active=1 AND p.category LIKE ?)'); args.push(likeCat); }
  if (city) { where.push('u.city LIKE ?'); args.push(`%${city.replace(/[%_]/g, '')}%`); }
  const rows = (await env.DB.prepare(`SELECT u.* FROM users u WHERE ${where.join(' AND ')} LIMIT 40`).bind(...args).all()).results;
  const stores = await Promise.all(rows.map(async u => {
    const prods = (await env.DB.prepare('SELECT name, price, image, category FROM products WHERE seller_id=? AND active=1 ORDER BY (image IS NULL), sort LIMIT 60').bind(u.id).all()).results;
    const cats = {}; for (const p of prods) if (p.category) cats[p.category] = (cats[p.category] || 0) + 1;
    return { ...(await card(env, u)), featured: !!(u.featured_until && u.featured_until > Date.now()), cover: u.cover || '', bio: (u.bio || '').slice(0, 160), products: prods.length, minPrice: prods.length ? Math.min(...prods.map(p => p.price)) : null,
      thumbs: prods.filter(p => p.image).slice(0, 4).map(p => p.image), categories: Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(c => c[0]) };
  }));
  const rank = { trusted: 3, average: 2, new: 1, risky: 0 };
  stores.sort((a, b) => (exact ? 0 : (b.featured - a.featured)) || (rank[b.trust.level] - rank[a.trust.level]) || (b.trust.score - a.trust.score) || a.name.localeCompare(b.name));
  return json({ stores, exact: !!exact });
}, { public: true, cors: true });

on('GET', '/api/stores/meta', async ({ env }) => {
  const cats = (await env.DB.prepare("SELECT category c, COUNT(DISTINCT seller_id) n FROM products WHERE active=1 AND category IS NOT NULL AND category<>'' GROUP BY category ORDER BY n DESC, c LIMIT 14").all()).results;
  const cities = (await env.DB.prepare("SELECT city c, COUNT(*) n FROM users u WHERE role='seller' AND city IS NOT NULL AND city<>'' AND EXISTS (SELECT 1 FROM products p WHERE p.seller_id=u.id AND p.active=1) GROUP BY city ORDER BY n DESC LIMIT 10").all()).results;
  return json({ categories: cats.map(x => x.c), cities: cities.map(x => x.c) });
}, { public: true, cors: true });

on('GET', '/api/stores/code/:code', async ({ env, params }) => {
  const u = await env.DB.prepare("SELECT slug FROM users WHERE role='seller' AND store_code=?").bind(normRef(params.code)).first();
  if (!u || !u.slug) fail(404, 'Aucune boutique avec ce code');
  return json({ slug: u.slug });
}, { public: true, cors: true });

on('POST', '/api/claim/:token/link', async ({ env, me, params }) => {
  if (me.role !== 'customer') fail(403, 'Connectez-vous avec un compte client');
  return json({ linked: await linkByClaim(env, me, params.token) });
});

// --- reviews
on('POST', '/api/reviews', async ({ env, me, body, ctx }) => {
  const o = await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(String(body.order_id || '')).first();
  if (!o) fail(404, 'Commande introuvable');
  let target;
  if (me.role === 'seller') {
    if (o.seller_id !== me.id) fail(403, 'Commande d’un autre vendeur');
    if (!o.customer_id) fail(400, 'Ce client n’a pas de compte vérifié');
    target = o.customer_id;
  } else {
    if (o.customer_id !== me.id) fail(403, 'Cette commande n’est pas à vous');
    target = o.seller_id;
  }
  if (!REVIEWABLE.includes(o.status)) fail(400, 'Vous pourrez évaluer après la livraison ou le refus du colis');
  const rating = parseInt(body.rating, 10);
  if (!(rating >= 1 && rating <= 5)) fail(400, 'Note entre 1 et 5');
  const allowed = TAGS[me.role === 'seller' ? 'customer' : 'seller'];
  const tags = (Array.isArray(body.tags) ? body.tags : []).filter(t => allowed.includes(t)).slice(0, 5);
  const comment = str(body.comment, 400, 'commentaire');
  try {
    await env.DB.prepare('INSERT INTO reviews (id, order_id, author_id, target_id, rating, tags, comment, created_at) VALUES (?,?,?,?,?,?,?,?)')
      .bind(rid(), o.id, me.id, target, rating, JSON.stringify(tags), comment, Date.now()).run();
  } catch (e) {
    if (String(e).includes('UNIQUE')) fail(409, 'Vous avez déjà évalué cette commande');
    throw e;
  }
  const back = await env.DB.prepare('SELECT 1 FROM reviews WHERE order_id=? AND author_id=?').bind(o.id, target).first();
  await staleBadges(env, me.id, target);
  bg(ctx, notify(env, target, { type: 'review', title: 'Nouvel avis reçu', body: back ? `${me.role === 'seller' ? me.shop : firstName(me.name)} vous a évalué. L’avis est maintenant visible.` : `${me.role === 'seller' ? me.shop : firstName(me.name)} vous a évalué. Évaluez à votre tour pour le voir.`, url: '/#avis', tag: 'review-' + o.id }));
  return json({ ok: true }, 201);
});

on('GET', '/api/profile/:id', async ({ env, me, params }) => {
  const u = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(params.id).first();
  if (!u) fail(404, 'Profil introuvable');
  const cutoff = Date.now() - BLIND_DAYS * DAY;
  const rows = (await env.DB.prepare(`SELECT r.id, r.rating, r.tags, r.comment, r.reply, r.reported, r.created_at, a.role a_role, a.name a_name, a.shop a_shop
    FROM reviews r LEFT JOIN users a ON a.id = r.author_id WHERE r.target_id = ?1 AND ${VISIBLE} ORDER BY r.created_at DESC LIMIT 50`)
    .bind(u.id, cutoff).all()).results;
  const isMe = u.id === me.id;
  let hidden = 0;
  if (isMe) hidden = (await env.DB.prepare(`SELECT COUNT(*) n FROM reviews r WHERE r.target_id = ?1 AND NOT ${VISIBLE}`).bind(u.id, cutoff).first()).n;
  return json({
    profile: await card(env, u, u.role === 'customer' && me.role === 'seller' ? me.id : null),
    isMe, hidden,
    reviews: rows.map(r => ({
      id: r.id, rating: r.rating, tags: JSON.parse(r.tags || '[]'), comment: r.comment, reply: r.reply, reported: !!r.reported, created_at: r.created_at,
      author: r.a_role ? displayName({ role: r.a_role, name: r.a_name, shop: r.a_shop }) : 'Compte supprimé',
    })),
  });
});

on('GET', '/api/reviews/todo', async ({ env, me }) => {
  const sql = me.role === 'seller'
    ? `SELECT o.id, o.items, o.price, o.status, o.created_at, o.name who FROM orders o WHERE o.seller_id=? AND o.customer_id IS NOT NULL`
    : `SELECT o.id, o.items, o.price, o.status, o.created_at, u.shop who FROM orders o JOIN users u ON u.id=o.seller_id WHERE o.customer_id=?`;
  const rows = (await env.DB.prepare(`${sql} AND o.status IN ('delivered','refused')
    AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.order_id=o.id AND r.author_id=?) ORDER BY o.created_at DESC LIMIT 100`).bind(me.id, me.id).all()).results;
  return json({ todo: rows, tags: TAGS[me.role === 'seller' ? 'customer' : 'seller'] });
});

on('POST', '/api/reviews/:id/reply', async ({ env, me, params, body }) => {
  const r = await env.DB.prepare('SELECT * FROM reviews WHERE id=?').bind(params.id).first();
  if (!r || r.target_id !== me.id) fail(404, 'Avis introuvable');
  if (r.reply) fail(409, 'Vous avez déjà répondu');
  await env.DB.prepare('UPDATE reviews SET reply=? WHERE id=?').bind(str(body.text, 400, 'réponse', true), r.id).run();
  return json({ ok: true });
});

on('POST', '/api/reviews/:id/report', async ({ env, me, params, body }) => {
  const r = await env.DB.prepare('SELECT * FROM reviews WHERE id=?').bind(params.id).first();
  if (!r || r.target_id !== me.id) fail(404, 'Avis introuvable');
  await env.DB.prepare('UPDATE reviews SET reported=1, report_reason=? WHERE id=?').bind(str(body.reason, 300, 'motif', true), r.id).run();
  return json({ ok: true });
});

// --- products (seller catalogue shown on the public order page)
const cleanProduct = (b, partial) => {
  const p = {};
  if (!partial || b.name !== undefined) p.name = str(b.name, 80, 'produit', true);
  if (!partial || b.price !== undefined) { p.price = money(b.price, 'prix'); if (!p.price) fail(400, 'Ajoutez un prix'); }
  if (b.active !== undefined) p.active = b.active ? 1 : 0;
  if (b.category !== undefined) p.category = str(b.category, 30, 'catégorie') || null;
  if (b.description !== undefined) p.description = str(b.description, 600, 'description') || null;
  if (b.image !== undefined) p.image = b.image ? String(b.image) : null;
  if (b.sort !== undefined) p.sort = Math.max(0, Math.min(9999, parseInt(b.sort, 10) || 0));
  if (b.cost !== undefined) p.cost = b.cost === '' || b.cost === null ? null : money(b.cost, 'coût');
  if (b.stock !== undefined) p.stock = b.stock === '' || b.stock === null ? null : Math.max(0, Math.min(99999, parseInt(b.stock, 10) || 0));
  for (const k of ['sizes', 'colors']) if (b[k] !== undefined) {
    const list = (Array.isArray(b[k]) ? b[k] : String(b[k] || '').split(/[,;\n]/)).map(x => String(x).trim().slice(0, 20)).filter(Boolean);
    const uniq = [...new Set(list)].slice(0, 12);
    p[k] = uniq.length ? JSON.stringify(uniq) : null;
  }
  return p;
};
const optList = v => { try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };
on('GET', '/api/products', async ({ env, me }) => {
  sellerOnly(me);
  return json({ products: (await env.DB.prepare('SELECT * FROM products WHERE seller_id=? ORDER BY sort, created_at').bind(me.id).all()).results });
});
on('POST', '/api/products', async ({ env, me, body }) => {
  sellerOnly(me);
  if (body.image) body.image = ownKey(body.image, me);
  const n = (await env.DB.prepare('SELECT COUNT(*) n FROM products WHERE seller_id=?').bind(me.id).first()).n;
  if (n >= 200) fail(400, '200 produits maximum');
  const p = { id: rid(), seller_id: me.id, active: 1, sort: n, created_at: Date.now(), category: null, description: null, image: null, sizes: null, colors: null, ...cleanProduct(body) };
  await env.DB.prepare('INSERT INTO products (id, seller_id, name, price, active, sort, created_at, category, description, image, sizes, colors) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(p.id, p.seller_id, p.name, p.price, p.active, p.sort, p.created_at, p.category, p.description, p.image, p.sizes, p.colors).run();
  if (p.cost != null || p.stock != null) await env.DB.prepare('UPDATE products SET cost=?, stock=? WHERE id=?').bind(p.cost ?? null, p.stock ?? null, p.id).run();
  return json({ product: p }, 201);
});
on('PATCH', '/api/products/:id', async ({ env, me, body, params }) => {
  sellerOnly(me);
  if (body.image) body.image = ownKey(body.image, me);
  const before = await env.DB.prepare('SELECT image FROM products WHERE id=? AND seller_id=?').bind(params.id, me.id).first();
  if (!before) fail(404, 'Produit introuvable');
  const p = cleanProduct(body, true), keys = Object.keys(p);
  if (!keys.length) fail(400, 'Rien à modifier');
  const r = await env.DB.prepare(`UPDATE products SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=? AND seller_id=?`).bind(...keys.map(k => p[k]), params.id, me.id).run();
  if (!r.meta.changes) fail(404, 'Produit introuvable');
  if ('image' in p && before.image && before.image !== p.image) await deleteMedia(env, before.image);
  return json({ ok: true });
});
on('DELETE', '/api/products/:id', async ({ env, me, params }) => {
  sellerOnly(me);
  const before = await env.DB.prepare('SELECT image FROM products WHERE id=? AND seller_id=?').bind(params.id, me.id).first();
  await env.DB.prepare('DELETE FROM products WHERE id=? AND seller_id=?').bind(params.id, me.id).run();
  if (before && before.image) await deleteMedia(env, before.image);
  return json({ ok: true });
});

// --- public shop page + order form (link for Facebook Page, Marketplace, Instagram, website)
async function shopBySlug(env, slug) {
  const u = await env.DB.prepare("SELECT * FROM users WHERE role='seller' AND slug=?").bind(slugify(slug)).first();
  if (!u) fail(404, 'Boutique introuvable');
  return u;
}
on('GET', '/api/shop/:slug', async ({ env, params }) => {
  const u = await shopBySlug(env, params.slug);
  const products = (await env.DB.prepare('SELECT id, name, price, image, category, description, sizes, colors, stock FROM products WHERE seller_id=? AND active=1 ORDER BY sort, created_at').bind(u.id).all()).results
    .map(p => ({ ...p, sizes: optList(p.sizes), colors: optList(p.colors) }));
  const s = JSON.parse(u.settings || '{}');
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
  const cutoff = Date.now() - BLIND_DAYS * DAY;
  const reviews = (await env.DB.prepare(`SELECT r.rating, r.tags, r.comment, r.reply, r.created_at, a.role a_role, a.name a_name, a.shop a_shop
    FROM reviews r LEFT JOIN users a ON a.id = r.author_id WHERE r.target_id = ?1 AND ${VISIBLE} ORDER BY r.created_at DESC LIMIT 10`).bind(u.id, cutoff).all()).results
    .map(r => ({ rating: r.rating, tags: JSON.parse(r.tags || '[]'), comment: r.comment, reply: r.reply, created_at: r.created_at,
      author: r.a_role ? displayName({ role: r.a_role, name: r.a_name, shop: r.a_shop }) : 'Compte supprimé' }));
  return json({ shop: { ...(await card(env, u)), bio: u.bio || '', cover: u.cover || '', logo: u.logo || '' }, products, categories, reviews, shipFee: s.shipFee ?? 7, secure: false, securePolicy: { rate: 0.03, min: 2, max: 15, days: 7 } });
}, { public: true, cors: true });

const SOURCES = ['Facebook', 'Marketplace', 'Instagram', 'TikTok', 'WhatsApp', 'Site web', 'Domo', 'Autre'];
on('POST', '/api/shop/:slug/orders', async ({ env, params, body, ctx }) => {
  if (body.website) fail(400, 'Requête refusée'); // honeypot field, invisible to people
  const u = await shopBySlug(env, params.slug);
  const s = JSON.parse(u.settings || '{}');
  const phone = normPhone(body.phone);
  if (!okPhone(phone)) fail(400, 'Numéro invalide : 8 chiffres tunisiens');
  const recent = await env.DB.prepare('SELECT COUNT(*) n FROM orders WHERE seller_id=? AND phone=? AND created_at > ?').bind(u.id, phone, Date.now() - DAY).first();
  if (recent.n >= 5) fail(429, 'Trop de commandes avec ce numéro aujourd’hui. Contactez la boutique.');
  const lines = Array.isArray(body.items) ? body.items.slice(0, 30) : [];
  let items = [], total = 0, costTotal = 0;
  const take = {};
  if (lines.length) {
    const ids = lines.map(l => String(l.product_id));
    const rows = (await env.DB.prepare(`SELECT id, name, price, sizes, colors, cost, stock FROM products WHERE seller_id=? AND active=1 AND id IN (${ids.map(() => '?').join(',')})`).bind(u.id, ...ids).all()).results;
    const byId = Object.fromEntries(rows.map(r => [r.id, r]));
    for (const l of lines) {
      const p = byId[String(l.product_id)], q = Math.max(1, Math.min(20, parseInt(l.qty, 10) || 1));
      if (!p) fail(400, 'Un produit n’est plus disponible, rechargez la page');
      take[p.id] = (take[p.id] || 0) + q;
      if (p.stock != null && take[p.id] > p.stock) fail(409, p.stock ? `Plus que ${p.stock} « ${p.name} » en stock` : `« ${p.name} » est en rupture de stock`);
      costTotal += (p.cost || 0) * q;
      const sz = optList(p.sizes), co = optList(p.colors), opt = [];
      if (sz.length) { if (!sz.includes(String(l.size || ''))) fail(400, `Choisissez la taille pour « ${p.name} »`); opt.push(String(l.size)); }
      if (co.length) { if (!co.includes(String(l.color || ''))) fail(400, `Choisissez la couleur pour « ${p.name} »`); opt.push(String(l.color)); }
      items.push(`${p.name}${opt.length ? ` (${opt.join(', ')})` : ''} ×${q}`); total += p.price * q;
    }
  }
  const free = str(body.request, 300, 'demande');
  if (!items.length && !free) fail(400, 'Choisissez au moins un produit');
  if (items.length && String(body.addr || '').trim().length < 5) fail(400, 'Indiquez votre adresse de livraison');
  if (free) items.push(free);
  const shipFee = s.shipFee ?? 7;
  const secure = false; // protected purchase is frozen (strategy D3)
  const fee = secure ? secureFee(total) : 0;
  const o = cleanOrder({
    name: body.name, phone, gov: body.gov, addr: body.addr, items: items.join(', '),
    price: total ? total + shipFee + fee : 0.001, // price 0.001 = "à fixer par le vendeur" for free-text requests
    courier: s.courier ?? 7, ret: s.ret ?? 7, src: SOURCES.includes(body.src) ? body.src : 'Site web', notes: body.notes,
    ...(costTotal ? { cost: costTotal } : {}),
  });
  if (!total) o.notes = ['Prix à confirmer par la boutique', o.notes].filter(Boolean).join(' · ');
  if (secure) { o.secure = 1; o.secure_fee = fee; }
  const row = await insertOrder(env, u.id, o, 'customer', body.idem);
  if (row.duplicate) return json({ ref: fmtRef(row.ref), claim: row.claim_token, total: total ? total + shipFee + fee : null, secure, secure_fee: fee, duplicate: true });
  for (const [pid, q] of Object.entries(take)) await env.DB.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id=? AND stock IS NOT NULL').bind(q, pid).run();
  bg(ctx, notify(env, u.id, { type: 'order', title: `Nouvelle commande ${fmtRef(row.ref)}`, body: `${firstName(o.name)} · ${o.items.slice(0, 80)} · ${total ? dt(o.price) : 'prix à fixer'}${secure ? ' · achat sécurisé' : ''}`, url: '/#commandes', tag: 'order-' + row.id }));
  return json({ ref: fmtRef(row.ref), claim: row.claim_token, total: total ? total + shipFee + fee : null, secure, secure_fee: fee }, 201);
}, { public: true, cors: true });

// --- public tracking by order ID (no name, phone or address returned)
on('GET', '/api/track/:ref', async ({ env, req, params }) => {
  await rateLimit(env, req, 'track', 30, 60);
  const ref = normRef(params.ref);
  if (!/^(DM|WS)[A-Z0-9]{6}$/.test(ref)) fail(400, 'Identifiant invalide. Format : DM-XXXXXX');
  const o = await env.DB.prepare('SELECT * FROM orders WHERE ref=?').bind(ref).first();
  if (!o) fail(404, 'Aucune commande avec cet identifiant');
  const seller = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(o.seller_id).first();
  const events = (await env.DB.prepare('SELECT status, by_role, at FROM order_events WHERE order_id=? ORDER BY at, id').bind(o.id).all()).results;
  return json({
    order: { ref: fmtRef(o.ref), items: o.items, price: o.price, gov: o.gov, status: o.status, created_at: o.created_at, updated_at: o.updated_at, secure: !!o.secure, dispute_status: o.dispute_status, carrier: o.carrier || null, carrier_ref: o.carrier_ref || null,
      delivery: o.delivery, driver: o.driver_id && ['assigned', 'picked'].includes(o.delivery) ? firstName((await env.DB.prepare('SELECT name FROM drivers WHERE id=?').bind(o.driver_id).first())?.name) : null },
    events, seller: await card(env, seller),
  });
}, { public: true, cors: true });

// --- seller API key for websites / shop systems (server-to-server)
on('POST', '/api/me/api-key', async ({ env, me }) => {
  sellerOnly(me);
  const key = 'wsk_' + rid(24);
  await env.DB.prepare('UPDATE users SET api_key_hash=?, api_key_hint=? WHERE id=?').bind(await sha256(key), key.slice(-4), me.id).run();
  return json({ key, hint: key.slice(-4) }, 201);
});
on('DELETE', '/api/me/api-key', async ({ env, me }) => {
  sellerOnly(me);
  await env.DB.prepare('UPDATE users SET api_key_hash=NULL, api_key_hint=NULL WHERE id=?').bind(me.id).run();
  return json({ ok: true });
});
on('POST', '/api/v1/orders', async ({ env, me, body, ctx }) => {
  const o = cleanOrder({ ...body, src: SOURCES.includes(body.src) ? body.src : 'Site web' });
  const ext = str(body.external_id, 80, 'external_id');
  if (ext) {
    const dup = await env.DB.prepare('SELECT ref, claim_token FROM orders WHERE seller_id=? AND external_id=?').bind(me.id, ext).first();
    if (dup) return json({ ref: fmtRef(dup.ref), duplicate: true, confirm_url: null });
    o.external_id = ext;
  }
  const row = await insertOrder(env, me.id, o, 'seller');
  bg(ctx, notify(env, me.id, { type: 'order', title: `Nouvelle commande du site ${fmtRef(row.ref)}`, body: `${firstName(o.name)} · ${o.items.slice(0, 80)} · ${dt(o.price)}`, url: '/#commandes', tag: 'order-' + row.id }));
  return json({ ref: fmtRef(row.ref), status: row.status, claim_token: row.claim_token }, 201);
}, { apikey: true, cors: true });
on('GET', '/api/v1/orders/:ref', async ({ env, me, params }) => {
  const o = await env.DB.prepare('SELECT ref, external_id, status, items, price, created_at, updated_at FROM orders WHERE seller_id=? AND ref=?').bind(me.id, normRef(params.ref)).first();
  if (!o) fail(404, 'Commande introuvable');
  return json({ order: { ...o, ref: fmtRef(o.ref) } });
}, { apikey: true, cors: true });

// --- media (shop covers, logos, product photos)
const MEDIA_TYPES = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };
const MAX_MEDIA = 1.5 * 1024 * 1024;
function ownKey(key, me) {
  key = String(key || '');
  if (!key) return '';
  if (!new RegExp(`^u/${me.id}/[A-Za-z0-9_-]{8,40}\\.(webp|jpg|png)$`).test(key)) fail(400, 'Image invalide');
  return key;
}
async function deleteMedia(env, key) {
  try {
    if (env.MEDIA) await env.MEDIA.delete(key);
    await env.DB.prepare('DELETE FROM media WHERE key=?').bind(key).run();
  } catch (e) { console.error('media delete', e); }
}
on('POST', '/api/media', async ({ env, me, req }) => {
  if (me.role !== 'seller' && me.role !== 'customer') fail(403, 'Non autorisé');
  const type = (req.headers.get('content-type') || '').split(';')[0].trim();
  if (!MEDIA_TYPES[type]) fail(415, 'Format accepté : WebP, JPEG ou PNG');
  const buf = await req.arrayBuffer();
  if (!buf.byteLength) fail(400, 'Image vide');
  if (buf.byteLength > MAX_MEDIA) fail(413, 'Image trop lourde (1,5 Mo maximum)');
  const count = (await env.DB.prepare('SELECT COUNT(*) n FROM media WHERE owner_id=?').bind(me.id).first()).n;
  if (!env.MEDIA && count >= 400) fail(400, 'Limite d’images atteinte');
  const key = `u/${me.id}/${rid(12)}.${MEDIA_TYPES[type]}`;
  if (env.MEDIA) await env.MEDIA.put(key, buf, { httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' } });
  else await env.DB.prepare('INSERT INTO media (key, owner_id, type, data, size, created_at) VALUES (?,?,?,?,?,?)').bind(key, me.id, type, buf, buf.byteLength, Date.now()).run();
  return json({ key, url: '/media/' + key }, 201);
}, { raw: true });

async function serveMedia(req, env, url, ctx) {
  const key = decodeURIComponent(url.pathname.slice('/media/'.length));
  if (!/^u\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.(webp|jpg|png)$/.test(key)) return new Response('Not found', { status: 404 });
  const cache = caches.default;
  const hit = await cache.match(req);
  if (hit) return hit;
  let res;
  if (env.MEDIA) {
    const obj = await env.MEDIA.get(key);
    if (obj) res = new Response(obj.body, { headers: { 'content-type': obj.httpMetadata?.contentType || 'image/webp' } });
  }
  if (!res) {
    const row = await env.DB.prepare('SELECT type, data FROM media WHERE key=?').bind(key).first();
    if (row) res = new Response(new Uint8Array(row.data), { headers: { 'content-type': row.type } });
  }
  if (!res) return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });
  res.headers.set('cache-control', 'public, max-age=31536000, immutable');
  res.headers.set('x-content-type-options', 'nosniff');
  if (ctx && ctx.waitUntil) ctx.waitUntil(cache.put(req, res.clone()));
  return res;
}

// --- in-app messaging (customer <-> seller)
async function convFor(env, id, me) {
  const c = await env.DB.prepare('SELECT * FROM conversations WHERE id=?').bind(id).first();
  if (!c || (c.seller_id !== me.id && c.customer_id !== me.id)) fail(404, 'Conversation introuvable');
  return c;
}
const otherId = (c, me) => c.seller_id === me.id ? c.customer_id : c.seller_id;
async function convView(env, c, me) {
  const o = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(otherId(c, me)).first();
  return { id: c.id, other: o ? await card(env, o) : null, last_at: c.last_at, last_text: c.last_text,
    unread: me.role === 'seller' ? c.seller_unread : c.customer_unread };
}
async function addMessage(env, c, senderId, kind, body, meta) {
  const t = Date.now(), m = { id: rid(), conv_id: c.id, sender_id: senderId, kind, body, meta: meta ? JSON.stringify(meta) : null, created_at: t };
  const toSeller = senderId !== c.seller_id;
  await env.DB.batch([
    env.DB.prepare('INSERT INTO messages (id, conv_id, sender_id, kind, body, meta, created_at) VALUES (?,?,?,?,?,?,?)').bind(m.id, m.conv_id, m.sender_id, m.kind, m.body, m.meta, m.created_at),
    env.DB.prepare(`UPDATE conversations SET last_at=?, last_text=?, ${toSeller ? 'seller_unread=seller_unread+1' : 'customer_unread=customer_unread+1'} WHERE id=?`).bind(t, body.slice(0, 120), c.id),
  ]);
  return m;
}
on('GET', '/api/conversations', async ({ env, me }) => {
  const col = me.role === 'seller' ? 'seller_id' : 'customer_id';
  const rows = (await env.DB.prepare(`SELECT * FROM conversations WHERE ${col}=? ORDER BY last_at DESC LIMIT 200`).bind(me.id).all()).results;
  return json({ conversations: await Promise.all(rows.map(c => convView(env, c, me))) });
});
on('POST', '/api/conversations', async ({ env, me, body }) => {
  let sellerId, customerId;
  if (me.role === 'customer') {
    const sel = body.slug ? await env.DB.prepare("SELECT id FROM users WHERE role='seller' AND slug=?").bind(slugify(body.slug)).first()
      : await env.DB.prepare("SELECT id FROM users WHERE role='seller' AND id=?").bind(String(body.seller_id || '')).first();
    if (!sel) fail(404, 'Boutique introuvable');
    sellerId = sel.id; customerId = me.id;
  } else {
    const cu = await env.DB.prepare('SELECT 1 FROM orders WHERE seller_id=? AND customer_id=? LIMIT 1').bind(me.id, String(body.customer_id || '')).first();
    if (!cu) fail(403, 'Vous pouvez écrire aux clients qui ont commandé chez vous avec un compte Domo');
    sellerId = me.id; customerId = String(body.customer_id);
  }
  await env.DB.prepare('INSERT OR IGNORE INTO conversations (id, seller_id, customer_id, created_at, last_at) VALUES (?,?,?,?,?)').bind(rid(), sellerId, customerId, Date.now(), Date.now()).run();
  const c = await env.DB.prepare('SELECT * FROM conversations WHERE seller_id=? AND customer_id=?').bind(sellerId, customerId).first();
  return json({ conversation: await convView(env, c, me) });
});
on('GET', '/api/conversations/:id/messages', async ({ env, me, params, url }) => {
  const c = await convFor(env, params.id, me);
  const after = parseInt(url.searchParams.get('after') || '0', 10) || 0;
  const rows = (await env.DB.prepare(after
      ? 'SELECT * FROM messages WHERE conv_id=? AND created_at>? ORDER BY created_at ASC LIMIT 200'
      : 'SELECT * FROM (SELECT * FROM messages WHERE conv_id=? ORDER BY created_at DESC LIMIT 200) ORDER BY created_at ASC')
    .bind(...(after ? [c.id, after] : [c.id])).all()).results;
  const mine = me.role === 'seller' ? 'seller_unread' : 'customer_unread';
  if (c[mine]) await env.DB.prepare(`UPDATE conversations SET ${mine}=0 WHERE id=?`).bind(c.id).run();
  const other = me.role === 'seller' ? c.customer_unread : c.seller_unread; // 0 = the other side has read everything
  return json({ messages: rows.map(m => ({ ...m, meta: m.meta ? JSON.parse(m.meta) : null, mine: m.sender_id === me.id })), conversation: await convView(env, c, me), seen: other === 0 });
});
on('POST', '/api/conversations/:id/messages', async ({ env, me, params, body, ctx }) => {
  const c = await convFor(env, params.id, me);
  const text = str(body.body, 1000, 'message', !body.order_ref);
  let meta = null, kind = 'text';
  if (body.order_ref) {
    const o = await env.DB.prepare('SELECT ref, items, price, status FROM orders WHERE ref=? AND seller_id=? AND customer_id=?').bind(normRef(body.order_ref), c.seller_id, c.customer_id).first();
    if (!o) fail(404, 'Commande introuvable dans cette conversation');
    meta = { ref: fmtRef(o.ref), items: o.items, price: o.price, status: o.status }; kind = 'order';
  }
  const recent = (await env.DB.prepare('SELECT COUNT(*) n FROM messages WHERE conv_id=? AND sender_id=? AND created_at>?').bind(c.id, me.id, Date.now() - 60000).first()).n;
  if (recent >= 30) fail(429, 'Trop de messages, patientez une minute');
  const m = await addMessage(env, c, me.id, kind, text || `Commande ${meta.ref}`, meta);
  bg(ctx, notify(env, otherId(c, me), { store: false, type: 'message', title: me.role === 'seller' ? me.shop : displayName(me), body: kind === 'order' ? `Commande ${meta.ref} partagée` : text.slice(0, 140), url: '/#messages', tag: 'msg-' + c.id }));
  return json({ message: { ...m, meta, mine: true } }, 201);
});
on('GET', '/api/orders-with/:convId', async ({ env, me, params }) => {
  const c = await convFor(env, params.convId, me);
  const rows = (await env.DB.prepare('SELECT ref, items, price, status, created_at FROM orders WHERE seller_id=? AND customer_id=? ORDER BY created_at DESC LIMIT 20').bind(c.seller_id, c.customer_id).all()).results;
  return json({ orders: rows.map(o => ({ ...o, ref: fmtRef(o.ref) })) });
});

// --- in-app voice calls: WebRTC signalling through D1 (offer/answer/ICE); media is peer-to-peer and encrypted (DTLS-SRTP)
const RING_MS = 45000;
async function callFor(env, id, me) {
  const k = await env.DB.prepare('SELECT * FROM calls WHERE id=?').bind(id).first();
  if (!k || (k.caller_id !== me.id && k.callee_id !== me.id)) fail(404, 'Appel introuvable');
  return k;
}
async function finishCall(env, k, status) {
  const t = Date.now();
  const r = await env.DB.prepare("UPDATE calls SET status=?, ended_at=? WHERE id=? AND status IN ('ringing','accepted')").bind(status, t, k.id).run();
  if (!r.meta.changes) return;
  const c = await env.DB.prepare('SELECT * FROM conversations WHERE id=?').bind(k.conv_id).first();
  if (!c) return;
  const dur = k.answered_at ? Math.round((t - k.answered_at) / 1000) : 0;
  const body = status === 'ended' && dur ? `Appel vocal · ${Math.floor(dur / 60)} min ${String(dur % 60).padStart(2, '0')} s` : status === 'declined' ? 'Appel refusé' : 'Appel manqué';
  await addMessage(env, c, k.caller_id, 'call', body, { status, duration: dur });
  if (status === 'missed') {
    const caller = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(k.caller_id).first();
    await notify(env, k.callee_id, { store: false, type: 'call', title: `Appel manqué · ${caller ? (caller.role === 'seller' ? caller.shop : displayName(caller)) : ''}`, body: 'Ouvrez la conversation pour rappeler.', url: '/#messages', tag: 'call-' + k.id }).catch(() => {});
  }
}
on('GET', '/api/push/key', async ({ env }) => json({ key: env.VAPID_PUBLIC_KEY || null }), { public: true });
on('POST', '/api/push/subscribe', async ({ env, me, body, req }) => {
  const ep = String(body.endpoint || ''), k = body.keys || {};
  if (!(env.PUSH_ALLOW_ANY ? /^https?:\/\// : /^https:\/\//).test(ep) || ep.length > 800 || !k.p256dh || !k.auth || String(k.p256dh).length > 200 || String(k.auth).length > 60) fail(400, 'Abonnement invalide');
  const host = new URL(ep).hostname;
  if (!/(\.|^)(googleapis\.com|mozilla\.com|mozaws\.net|push\.apple\.com|windows\.com|notify\.windows\.com)$/.test(host) && !env.PUSH_ALLOW_ANY) fail(400, 'Service de notification non reconnu');
  if (me.role === 'driver') {
    await env.DB.prepare('INSERT INTO driver_push (id, driver_id, endpoint, p256dh, auth, ua, created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET driver_id=excluded.driver_id, p256dh=excluded.p256dh, auth=excluded.auth, ua=excluded.ua')
      .bind(rid(), me.id, ep, String(k.p256dh), String(k.auth), (req.headers.get('user-agent') || '').slice(0, 200), Date.now()).run();
    return json({ ok: true });
  }
  await env.DB.prepare('INSERT INTO push_subs (id, user_id, endpoint, p256dh, auth, ua, created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id, p256dh=excluded.p256dh, auth=excluded.auth, ua=excluded.ua')
    .bind(rid(), me.id, ep, String(k.p256dh), String(k.auth), (req.headers.get('user-agent') || '').slice(0, 200), Date.now()).run();
  return json({ ok: true });
});
on('POST', '/api/push/unsubscribe', async ({ env, me, body }) => {
  if (me.role === 'driver') { await env.DB.prepare('DELETE FROM driver_push WHERE driver_id=? AND endpoint=?').bind(me.id, String(body.endpoint || '')).run(); return json({ ok: true }); }
  await env.DB.prepare('DELETE FROM push_subs WHERE user_id=? AND endpoint=?').bind(me.id, String(body.endpoint || '')).run();
  return json({ ok: true });
});
on('POST', '/api/push/test', async ({ env, me }) => {
  if (me.role === 'driver') {
    const c = (await env.DB.prepare('SELECT COUNT(*) n FROM driver_push WHERE driver_id=?').bind(me.id).first()).n;
    if (!c) fail(400, 'Activez d’abord les notifications sur cet appareil');
    await notifyDriver(env, me.id, { title: 'Notifications activées ✅', body: 'Vous serez prévenu de chaque nouvelle course.', tag: 'test' });
    return json({ ok: true, devices: c });
  }
  const n = (await env.DB.prepare('SELECT COUNT(*) n FROM push_subs WHERE user_id=?').bind(me.id).first()).n;
  if (!n) fail(400, 'Activez d’abord les notifications sur cet appareil');
  await notify(env, me.id, { type: 'test', title: 'Notifications activées ✅', body: 'Vous serez prévenu des commandes, messages et appels.', url: '/', tag: 'test' });
  return json({ ok: true, devices: n });
});
on('GET', '/api/notifications', async ({ env, me }) => {
  if (me.role === 'driver') return json({ notifications: [], unread: 0, devices: (await env.DB.prepare('SELECT COUNT(*) n FROM driver_push WHERE driver_id=?').bind(me.id).first()).n });
  const rows = (await env.DB.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100').bind(me.id).all()).results;
  const devices = (await env.DB.prepare('SELECT COUNT(*) n FROM push_subs WHERE user_id=?').bind(me.id).first()).n;
  return json({ notifications: rows, unread: rows.filter(r => !r.read_at).length, devices });
});
on('POST', '/api/notifications/read', async ({ env, me, body }) => {
  if (body.all) await env.DB.prepare('UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL').bind(Date.now(), me.id).run();
  else if (body.id) await env.DB.prepare('UPDATE notifications SET read_at=? WHERE user_id=? AND id=?').bind(Date.now(), me.id, String(body.id)).run();
  return json({ ok: true });
});
on('GET', '/api/inbox/poll', async ({ env, me }) => {
  const now = Date.now();
  if (me.role === 'driver') {
    await env.DB.prepare('UPDATE drivers SET last_seen=? WHERE id=?').bind(now, me.id).run();
    const j = await env.DB.prepare("SELECT COUNT(*) n, COALESCE(MAX(delivery_assigned_at),0) last FROM orders WHERE driver_id=? AND delivery IN ('assigned','picked','returning')").bind(me.id).first();
    return json({ unread: 0, notifs: 0, call: null, jobs: j.n, jobsAt: j.last, status: me.status });
  }
  const stale = (await env.DB.prepare("SELECT * FROM calls WHERE status='ringing' AND created_at<? AND (caller_id=? OR callee_id=?)").bind(now - RING_MS, me.id, me.id).all()).results;
  for (const k of stale) await finishCall(env, k, 'missed');
  const col = me.role === 'seller' ? 'seller' : 'customer';
  const u = await env.DB.prepare(`SELECT COALESCE(SUM(${col}_unread),0) n FROM conversations WHERE ${col}_id=?`).bind(me.id).first();
  const k = await env.DB.prepare("SELECT * FROM calls WHERE callee_id=? AND status='ringing' AND created_at>=? ORDER BY created_at DESC LIMIT 1").bind(me.id, now - RING_MS).first();
  let call = null;
  if (k) {
    const caller = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(k.caller_id).first();
    call = { id: k.id, conv_id: k.conv_id, offer: JSON.parse(k.offer), from: caller ? await card(env, caller) : null };
  }
  const nu = (await env.DB.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read_at IS NULL').bind(me.id).first()).n;
  const other = me.link_id ? (await env.DB.prepare('SELECT COUNT(*) n FROM notifications WHERE read_at IS NULL AND user_id IN (SELECT id FROM users WHERE link_id=? AND id<>?)').bind(me.link_id, me.id).first()).n : 0;
  const admin = isAdmin(env, me) ? await adminCounts(env) : null;
  return json({ unread: u.n, notifs: nu, call, other, admin });
});
on('GET', '/api/calls/ice', async ({ env }) => {
  const iceServers = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
  if (env.TURN_KEY_ID && env.TURN_KEY_API_TOKEN) {
    try {
      const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
        method: 'POST', headers: { authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify({ ttl: 7200 }) });
      if (r.ok) { const d = await r.json(); iceServers.push(...(d.iceServers ? [].concat(d.iceServers) : [])); }
    } catch (e) { console.error('turn', e); }
  }
  return json({ iceServers, relay: iceServers.length > 1 });
});
on('POST', '/api/calls', async ({ env, me, body, ctx }) => {
  const c = await convFor(env, String(body.conv_id || ''), me);
  if (!body.offer || typeof body.offer.sdp !== 'string' || body.offer.sdp.length > 20000) fail(400, 'Offre invalide');
  const callee = otherId(c, me);
  const busy = await env.DB.prepare("SELECT 1 FROM calls WHERE (callee_id=? OR caller_id=?) AND ((status='ringing' AND created_at>?) OR (status='accepted' AND answered_at>?)) LIMIT 1").bind(callee, callee, Date.now() - RING_MS, Date.now() - 3 * 3600e3).first();
  if (busy) fail(409, 'Votre correspondant est déjà en ligne. Réessayez dans un instant.');
  const k = { id: rid(), conv_id: c.id, caller_id: me.id, callee_id: callee, offer: JSON.stringify({ type: 'offer', sdp: body.offer.sdp }), created_at: Date.now() };
  await env.DB.prepare('INSERT INTO calls (id, conv_id, caller_id, callee_id, offer, created_at) VALUES (?,?,?,?,?,?)').bind(k.id, k.conv_id, k.caller_id, k.callee_id, k.offer, k.created_at).run();
  bg(ctx, notify(env, callee, { store: false, type: 'call', call: true, title: `Appel entrant · ${me.role === 'seller' ? me.shop : displayName(me)}`, body: 'Touchez pour ouvrir Domo et répondre.', url: '/#messages', tag: 'call-' + k.id, ttl: 45, urgency: 'high' }));
  return json({ id: k.id }, 201);
});
on('GET', '/api/calls/:id', async ({ env, me, params, url }) => {
  let k = await callFor(env, params.id, me);
  if (k.status === 'ringing' && Date.now() - k.created_at > RING_MS) { await finishCall(env, k, 'missed'); k = await callFor(env, params.id, me); }
  const from = parseInt(url.searchParams.get('ci') || '0', 10) || 0;
  const ice = JSON.parse(k.caller_id === me.id ? k.callee_ice : k.caller_ice);
  return json({ status: k.status, answer: k.answer ? JSON.parse(k.answer) : null, ice: ice.slice(from), next: ice.length, answered_at: k.answered_at });
});
on('POST', '/api/calls/:id/answer', async ({ env, me, params, body }) => {
  const k = await callFor(env, params.id, me);
  if (k.callee_id !== me.id) fail(403, 'Seule la personne appelée peut répondre');
  if (!body.answer || typeof body.answer.sdp !== 'string' || body.answer.sdp.length > 20000) fail(400, 'Réponse invalide');
  const r = await env.DB.prepare("UPDATE calls SET status='accepted', answer=?, answered_at=? WHERE id=? AND status='ringing'").bind(JSON.stringify({ type: 'answer', sdp: body.answer.sdp }), Date.now(), k.id).run();
  if (!r.meta.changes) fail(409, 'L’appel est terminé');
  return json({ ok: true });
});
on('POST', '/api/calls/:id/ice', async ({ env, me, params, body }) => {
  const k = await callFor(env, params.id, me);
  const list = (Array.isArray(body.candidates) ? body.candidates : []).slice(0, 20).filter(c => c && typeof c.candidate === 'string' && c.candidate.length < 600);
  if (!list.length) return json({ ok: true });
  const col = k.caller_id === me.id ? 'caller_ice' : 'callee_ice';
  await env.DB.batch(list.map(c => env.DB.prepare(`UPDATE calls SET ${col}=json_insert(${col}, '$[#]', json(?)) WHERE id=? AND json_array_length(${col})<60`)
    .bind(JSON.stringify({ candidate: c.candidate, sdpMid: c.sdpMid ?? null, sdpMLineIndex: c.sdpMLineIndex ?? null }), k.id)));
  return json({ ok: true });
});
on('POST', '/api/calls/:id/end', async ({ env, me, params, body }) => {
  const k = await callFor(env, params.id, me);
  const status = k.status === 'accepted' ? 'ended' : (k.callee_id === me.id && body.reason === 'declined') ? 'declined' : 'missed';
  await finishCall(env, k, status);
  return json({ ok: true, status });
});

/* ---------------- entry ---------------- */
/* =====================================================================
   Spaces (buyer / seller / driver), badges, verified sellers,
   Domo delivery (dispatch, drivers, cash, payouts) and the admin console.
   ===================================================================== */
const deliveryFee = env => Number(env.DELIVERY_FEE || 8);
const driverPay = env => Number(env.DRIVER_PAY || 4);
const VEHICLES = ['moto', 'voiture', 'velo', 'pied'];
const driverView = d => ({ id: d.id, role: 'driver', name: d.name, phone: d.phone, city: d.city || '', zones: d.zones || '', vehicle: d.vehicle || '', status: d.status, available: !!d.available, prefs: jparse(d.prefs, {}), created_at: d.created_at });
const adminOnly = (env, me) => { if (!isAdmin(env, me)) fail(403, 'Réservé à l’équipe Domo'); };
const PIONEER_UNTIL = Date.UTC(2027, 6, 1);

// ---------- badges ----------
// Stats are cached on the user row (badges / badges_at) and recomputed when stale or invalidated by an event.
async function badgeStats(env, u) {
  if (u.role === 'seller') {
    const o = await env.DB.prepare(`SELECT COALESCE(SUM(status='delivered'),0) d, COALESCE(SUM(dispute_status IS NOT NULL),0) disp, COALESCE(SUM(delivery='delivered'),0) domo FROM orders WHERE seller_id=?`).bind(u.id).first();
    const rv = await env.DB.prepare('SELECT COUNT(*) n, COALESCE(AVG(rating),0) a FROM reviews WHERE target_id=?').bind(u.id).first();
    const ship = (await env.DB.prepare(`SELECT (SELECT MIN(at) FROM order_events e WHERE e.order_id=o.id AND e.status='confirmed') c, (SELECT MIN(at) FROM order_events e WHERE e.order_id=o.id AND e.status='shipped') s
      FROM orders o WHERE o.seller_id=? AND o.status IN ('shipped','delivered','refused') ORDER BY o.created_at DESC LIMIT 100`).bind(u.id).all()).results
      .filter(r => r.c && r.s && r.s >= r.c).map(r => (r.s - r.c) / 36e5).sort((a, b) => a - b);
    return { d: o.d, disp: o.disp, domo: o.domo, n: rv.n, avg: Math.round(rv.a * 10) / 10, shipN: ship.length, shipMed: ship.length ? ship[Math.floor(ship.length / 2)] : null };
  }
  const o = await env.DB.prepare(`SELECT COALESCE(SUM(status='delivered'),0) d, COALESCE(SUM(${COUNTS_AGAINST}),0) r FROM orders WHERE customer_id=?`).bind(u.id).first();
  const w = await env.DB.prepare('SELECT COUNT(*) n FROM reviews WHERE author_id=?').bind(u.id).first();
  const loyal = await env.DB.prepare(`SELECT COALESCE(MAX(c),0) m FROM (SELECT COUNT(*) c FROM orders WHERE customer_id=? AND status='delivered' GROUP BY seller_id)`).bind(u.id).first();
  return { d: o.d, r: o.r, w: w.n, loyal: loyal.m };
}
const tier = (cur, goal) => ({ cur: Math.min(cur, goal), goal, ok: cur >= goal });
const BADGES = {
  seller: [
    { id: 'verified', label: 'Vendeur vérifié', icon: 'shield', desc: 'Identité contrôlée par l’équipe Domo.', how: 'Envoyez votre pièce d’identité ou votre RNE depuis Compte → Vérification.', calc: (s, u) => tier(u.seller_verified ? 1 : 0, 1) },
    { id: 'd500', group: 'd', label: '500 livraisons', icon: 'box', desc: '500 commandes livrées avec Domo.', calc: s => tier(s.d, 500) },
    { id: 'd100', group: 'd', label: '100 livraisons', icon: 'box', desc: '100 commandes livrées avec Domo.', calc: s => tier(s.d, 100) },
    { id: 'd10', group: 'd', label: '10 livraisons', icon: 'box', desc: 'Les 10 premières commandes livrées.', calc: s => tier(s.d, 10) },
    { id: 'toprated', label: 'Très bien noté', icon: 'star', desc: 'Note moyenne de 4,5 ou plus, sur au moins 5 avis.', how: 'Il faut 5 avis et une moyenne d’au moins 4,5.', calc: s => ({ cur: s.avg >= 4.5 ? Math.min(s.n, 5) : 0, goal: 5, ok: s.n >= 5 && s.avg >= 4.5 }) },
    { id: 'fast', label: 'Expédition rapide', icon: 'track', desc: 'Expédie en moins de 24 h après confirmation (médiane).', how: 'Expédiez au moins 5 colis, la plupart en moins de 24 h.', calc: s => ({ cur: s.shipMed != null && s.shipMed <= 24 ? Math.min(s.shipN, 5) : 0, goal: 5, ok: s.shipN >= 5 && s.shipMed <= 24 }) },
    { id: 'nodispute', label: 'Zéro litige', icon: 'check', desc: 'Au moins 20 commandes livrées sans aucun problème signalé.', calc: s => ({ cur: s.disp ? 0 : Math.min(s.d, 20), goal: 20, ok: !s.disp && s.d >= 20 }) },
    { id: 'domo', label: 'Livré par Domo', icon: 'track', desc: 'Au moins 5 colis livrés par les livreurs Domo.', calc: s => tier(s.domo, 5) },
    { id: 'pioneer', label: 'Pionnier', icon: 'spark', desc: 'Parmi les premières boutiques sur Domo.', hidden: true, calc: (s, u) => tier(u.created_at < PIONEER_UNTIL ? 1 : 0, 1) },
  ],
  customer: [
    { id: 'phone', label: 'Numéro confirmé', icon: 'check', desc: 'Le client a ouvert un lien de commande envoyé à ce numéro.', how: 'Ouvrez le lien d’une commande reçu sur WhatsApp et liez-le à votre compte.', calc: (s, u) => tier(u.phone_verified ? 1 : 0, 1) },
    { id: 'reliable', label: 'Client fiable', icon: 'shield', desc: 'Au moins 5 colis acceptés, aucun refus de sa part.', calc: s => ({ cur: s.r ? 0 : Math.min(s.d, 5), goal: 5, ok: !s.r && s.d >= 5 }) },
    { id: 'c50', group: 'c', label: '50 colis acceptés', icon: 'box', desc: '50 commandes reçues et payées.', calc: s => tier(s.d, 50) },
    { id: 'c10', group: 'c', label: '10 colis acceptés', icon: 'box', desc: '10 commandes reçues et payées.', calc: s => tier(s.d, 10) },
    { id: 'loyal', label: 'Client fidèle', icon: 'heart', desc: '3 commandes livrées ou plus dans la même boutique.', calc: s => tier(s.loyal, 3) },
    { id: 'reviewer', label: 'Avis utiles', icon: 'star', desc: 'A laissé au moins 5 avis honnêtes.', calc: s => tier(s.w, 5) },
    { id: 'pioneer', label: 'Pionnier', icon: 'spark', desc: 'Parmi les premiers clients sur Domo.', hidden: true, calc: (s, u) => tier(u.created_at < PIONEER_UNTIL ? 1 : 0, 1) },
  ],
};
async function userBadges(env, u, withNext = false) {
  const defs = BADGES[u.role];
  if (!defs) return { earned: [], next: [] };
  let st = jparse(u.badges, null);
  if (!st || !u.badges_at || Date.now() - u.badges_at > 6 * 36e5) {
    st = await badgeStats(env, u);
    await env.DB.prepare('UPDATE users SET badges=?, badges_at=? WHERE id=?').bind(JSON.stringify(st), Date.now(), u.id).run();
  }
  const earned = [], next = [], groups = {};
  const view = b => ({ id: b.id, label: b.label, icon: b.icon, desc: b.desc });
  const later = (b, r) => ({ ...view(b), how: b.how || '', cur: r.cur, goal: r.goal });
  for (const b of defs) {
    const r = b.calc(st, u);
    if (b.group) { (groups[b.group] = groups[b.group] || []).push({ b, r }); continue; }
    if (r.ok) earned.push(view(b)); else if (withNext && !b.hidden) next.push(later(b, r));
  }
  for (const g of Object.values(groups)) { // tiers are listed highest first
    const top = g.find(x => x.r.ok);
    if (top) earned.push(view(top.b));
    const nx = [...g].reverse().find(x => !x.r.ok);
    if (withNext && nx) next.push(later(nx.b, nx.r));
  }
  return { earned, next };
}
async function staleBadges(env, ...ids) {
  ids = ids.filter(Boolean);
  if (ids.length) await env.DB.prepare(`UPDATE users SET badges_at=NULL WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).run();
}

// ---------- one person, several spaces ----------
async function switchTo(env, me, role) {
  if (!me.link_id) fail(404, 'Aucun autre espace lié à ce compte');
  const u = await env.DB.prepare('SELECT * FROM users WHERE link_id=? AND role=?').bind(me.link_id, role).first();
  if (!u) fail(404, 'Aucun autre espace lié à ce compte');
  return json({ token: await createSession(env, u.id), user: meView(u) });
}
on('POST', '/api/account/switch', async ({ env, me, body }) => switchTo(env, me, body.role === 'seller' ? 'seller' : 'customer'));

// Add the other space (buyer -> seller or seller -> buyer). Same phone, same password, linked.
on('POST', '/api/account/add-role', async ({ env, me, body }) => {
  const role = body.role === 'seller' ? 'seller' : body.role === 'customer' ? 'customer' : fail(400, 'Espace inconnu');
  if (role === me.role) fail(400, 'Vous êtes déjà dans cet espace');
  const linkId = me.link_id || me.id;
  const existing = await env.DB.prepare('SELECT * FROM users WHERE role=? AND phone=?').bind(role, me.phone).first();
  if (existing) {
    if (existing.link_id && existing.link_id === me.link_id) return switchTo(env, me, role);
    // An account already exists with this number: prove it is yours with its password, then link both.
    if (!body.password) fail(409, role === 'seller' ? 'Une boutique existe déjà avec ce numéro. Entrez son mot de passe pour la relier.' : 'Un compte client existe déjà avec ce numéro. Entrez son mot de passe pour le relier.');
    if (!(await checkPass(String(body.password), existing.pass))) fail(401, 'Mot de passe incorrect');
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET link_id=? WHERE id=?').bind(linkId, me.id),
      env.DB.prepare('UPDATE users SET link_id=? WHERE id=?').bind(linkId, existing.id),
    ]);
    return json({ token: await createSession(env, existing.id), user: meView({ ...existing, link_id: linkId }), linked: true });
  }
  const shop = role === 'seller' ? str(body.shop, 60, 'nom de la boutique', true) : null;
  const city = body.city !== undefined ? str(body.city, 40, 'ville') : me.city;
  const id = rid(), t = Date.now();
  const slug = role === 'seller' ? await uniqueSlug(env, shop) : null;
  const code = role === 'seller' ? await genStoreCode(env, shop) : null;
  await env.DB.batch([
    env.DB.prepare('INSERT INTO users (id, role, name, phone, pass, city, shop, settings, phone_verified, created_at, slug, store_code, link_id, avatar, prefs) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(id, role, me.name, me.phone, me.pass, city, shop, '{}', 0, t, slug, code, linkId, null, me.prefs || '{}'),
    env.DB.prepare('UPDATE users SET link_id=? WHERE id=?').bind(linkId, me.id),
  ]);
  const u = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first();
  return json({ token: await createSession(env, id), user: meView(u) }, 201);
});

// Sign out of every other device.
on('POST', '/api/account/sessions/revoke', async ({ env, me, req }) => {
  const m = (req.headers.get('authorization') || '').match(/^Bearer (.+)$/);
  const keep = m ? await sha256(m[1]) : '';
  if (me.role === 'driver') await env.DB.prepare('DELETE FROM driver_sessions WHERE driver_id=? AND token_hash<>?').bind(me.id, keep).run();
  else await env.DB.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').bind(me.id, keep).run();
  return json({ ok: true });
}, { driver: true });

// ---------- drivers: apply, profile ----------
async function registerDriver(env, body, ctx) {
  const name = str(body.name, 80, 'nom', true);
  const phone = normPhone(body.phone);
  if (!okPhone(phone)) fail(400, 'Numéro invalide : 8 chiffres tunisiens');
  const password = String(body.password || '');
  if (password.length < 8) fail(400, 'Mot de passe : 8 caractères minimum');
  if (await env.DB.prepare('SELECT 1 FROM drivers WHERE phone=?').bind(phone).first()) fail(409, 'Une candidature existe déjà avec ce numéro. Connectez-vous.');
  const d = { id: rid(), name, phone, pass: await hashPass(password), city: str(body.city, 40, 'ville'), zones: (z => /^[\d\s+]{6,}$/.test(z || '') ? null : z)(str(body.zones, 200, 'zones')), vehicle: VEHICLES.includes(body.vehicle) ? body.vehicle : 'moto', created_at: Date.now() };
  await env.DB.prepare('INSERT INTO drivers (id, name, phone, pass, city, zones, vehicle, status, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(d.id, d.name, d.phone, d.pass, d.city, d.zones, d.vehicle, 'pending', d.created_at).run();
  bg(ctx, notifyAdmins(env, { type: 'account', title: 'Nouvelle candidature livreur', body: `${name} · ${d.city || 'ville ?'} · ${d.vehicle}`, url: '/#admin/livreurs', tag: 'drv-apply' }));
  return json({ token: await createDriverSession(env, d.id), user: driverView({ ...d, status: 'pending', available: 0 }) }, 201);
}
// A logged-in buyer or seller applies with the same phone and password.
on('POST', '/api/account/driver-apply', async ({ env, me, body, ctx }) => {
  if (await env.DB.prepare('SELECT 1 FROM drivers WHERE phone=?').bind(me.phone).first()) fail(409, 'Vous avez déjà postulé avec ce numéro.');
  const id = rid();
  await env.DB.prepare('INSERT INTO drivers (id, name, phone, pass, city, zones, vehicle, status, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(id, me.name, me.phone, me.pass, str(body.city, 40, 'ville') || me.city || '', str(body.zones, 200, 'zones'), VEHICLES.includes(body.vehicle) ? body.vehicle : 'moto', 'pending', Date.now()).run();
  bg(ctx, notifyAdmins(env, { type: 'account', title: 'Nouvelle candidature livreur', body: `${me.name} · ${body.city || me.city || ''}`, url: '/#admin/livreurs', tag: 'drv-apply' }));
  return json({ ok: true, status: 'pending' }, 201);
});
async function patchDriver(env, me, body) {
  const upd = {};
  if (body.name !== undefined) upd.name = str(body.name, 80, 'nom', true);
  if (body.city !== undefined) upd.city = str(body.city, 40, 'ville');
  if (body.zones !== undefined) upd.zones = str(body.zones, 200, 'zones');
  if (body.vehicle !== undefined) upd.vehicle = VEHICLES.includes(body.vehicle) ? body.vehicle : 'moto';
  if (body.available !== undefined) { if (me.status !== 'active') fail(403, 'Votre compte n’est pas encore activé'); upd.available = body.available ? 1 : 0; }
  if (body.prefs !== undefined) { const cur = jparse(me.prefs, {}); if (body.prefs.theme !== undefined) cur.theme = ['system', 'light', 'dark'].includes(body.prefs.theme) ? body.prefs.theme : 'system'; upd.prefs = JSON.stringify(cur); }
  if (body.password) {
    if (!(await checkPass(String(body.current || ''), me.pass))) fail(400, 'Mot de passe actuel incorrect');
    if (String(body.password).length < 8) fail(400, 'Mot de passe : 8 caractères minimum');
    upd.pass = await hashPass(String(body.password));
  }
  const keys = Object.keys(upd);
  if (keys.length) await env.DB.prepare(`UPDATE drivers SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=?`).bind(...keys.map(k => upd[k]), me.id).run();
  return json({ user: driverView(await env.DB.prepare('SELECT * FROM drivers WHERE id=?').bind(me.id).first()) });
}

// ---------- private documents + seller verification ----------
on('POST', '/api/docs', async ({ env, me, req }) => {
  sellerOnly(me);
  const type = (req.headers.get('content-type') || '').split(';')[0].trim();
  if (!MEDIA_TYPES[type]) fail(415, 'Format accepté : WebP, JPEG ou PNG');
  const buf = await req.arrayBuffer();
  if (!buf.byteLength) fail(400, 'Image vide');
  if (buf.byteLength > MAX_MEDIA) fail(413, 'Image trop lourde (1,5 Mo maximum)');
  const n = (await env.DB.prepare('SELECT COUNT(*) n FROM docs WHERE owner_id=?').bind(me.id).first()).n;
  if (n >= 12) fail(400, 'Trop de documents envoyés. Contactez Domo.');
  const key = `d/${me.id}/${rid(12)}.${MEDIA_TYPES[type]}`;
  await env.DB.prepare('INSERT INTO docs (key, owner_id, type, data, size, created_at) VALUES (?,?,?,?,?,?)').bind(key, me.id, type, buf, buf.byteLength, Date.now()).run();
  return json({ key }, 201);
}, { raw: true });
const ownDoc = (key, me) => { key = String(key || ''); if (!key) return ''; if (!new RegExp(`^d/${me.id}/[A-Za-z0-9_-]{8,40}\\.(webp|jpg|png)$`).test(key)) fail(400, 'Document invalide'); return key; };
on('POST', '/api/verification', async ({ env, me, body, ctx }) => {
  sellerOnly(me);
  if (me.seller_verified) fail(400, 'Votre boutique est déjà vérifiée');
  const last = await env.DB.prepare('SELECT status FROM verifications WHERE user_id=? ORDER BY created_at DESC LIMIT 1').bind(me.id).first();
  if (last && last.status === 'pending') fail(409, 'Votre demande est déjà en cours d’examen');
  const docType = ['cin', 'rne', 'patente'].includes(body.doc_type) ? body.doc_type : fail(400, 'Choisissez le type de document');
  const front = ownDoc(body.front, me) || fail(400, 'Ajoutez la photo du document');
  const back = ownDoc(body.back, me);
  const legal = str(body.legal_name, 100, 'nom légal', true);
  if (!body.consent) fail(400, 'Acceptez le traitement de vos documents pour continuer');
  await env.DB.prepare('INSERT INTO verifications (id, user_id, legal_name, doc_type, doc_front, doc_back, status, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind(rid(), me.id, legal, docType, front, back || null, 'pending', Date.now()).run();
  bg(ctx, notifyAdmins(env, { type: 'verification', title: 'Demande de vérification', body: `${me.shop} · ${legal}`, url: '/#admin/verifications', tag: 'verif' }));
  return json({ ok: true, status: 'pending' }, 201);
});

// ---------- seller: Domo delivery ----------
on('POST', '/api/orders/:id/delivery', async ({ env, me, params, body, ctx }) => {
  sellerOnly(me);
  const o = await env.DB.prepare('SELECT * FROM orders WHERE id=? AND seller_id=?').bind(params.id, me.id).first();
  if (!o) fail(404, 'Commande introuvable');
  const t = Date.now();
  if (body.action === 'request') {
    if (o.status !== 'confirmed') fail(400, 'Confirmez d’abord la commande avec le client');
    if (o.delivery && !['returned'].includes(o.delivery)) fail(409, 'Un livreur Domo est déjà demandé pour ce colis');
    const pk = jparse(me.pickup, null);
    if (!pk || !pk.addr || !pk.gov) fail(400, 'Ajoutez votre adresse de ramassage dans Réglages → Livraison Domo');
    if (!o.addr && !o.gov) fail(400, 'Ajoutez l’adresse du client avant de demander un livreur');
    await env.DB.prepare("UPDATE orders SET delivery='requested', driver_id=NULL, delivery_fee=?, delivery_requested_at=?, delivery_assigned_at=NULL, delivery_attempts=0, delivery_note=NULL, updated_at=? WHERE id=?")
      .bind(deliveryFee(env), t, t, o.id).run();
    bg(ctx, notifyAdmins(env, { type: 'delivery', title: `Ramassage demandé · ${fmtRef(o.ref)}`, body: `${me.shop} (${pk.gov}) → ${o.gov || 'client'} · ${dt(o.price)}`, url: '/#admin', tag: 'pickup-' + o.id }));
  } else if (body.action === 'cancel') {
    if (!['requested', 'assigned'].includes(o.delivery)) fail(409, 'Le colis est déjà récupéré : contactez Domo.');
    await env.DB.prepare('UPDATE orders SET delivery=NULL, driver_id=NULL, delivery_fee=0, updated_at=? WHERE id=?').bind(t, o.id).run();
    if (o.driver_id) bg(ctx, notifyDriver(env, o.driver_id, { title: `Course annulée · ${fmtRef(o.ref)}`, body: `${me.shop} a annulé le ramassage.`, tag: 'job-' + o.id }));
  } else fail(400, 'Action inconnue');
  return json({ order: await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(o.id).first() });
});
// What Domo owes the seller for orders delivered by Domo drivers.
on('GET', '/api/payouts', async ({ env, me }) => {
  sellerOnly(me);
  const rows = (await env.DB.prepare(`SELECT id, ref, name, price, delivery, delivery_fee, cash_collected, cash_settled_at, payout_at, delivered_at, updated_at FROM orders
    WHERE seller_id=? AND delivery IN ('delivered','returned') ORDER BY COALESCE(delivered_at, updated_at) DESC LIMIT 200`).bind(me.id).all()).results;
  let pending = 0, inTransit = 0, paid = 0;
  for (const r of rows) {
    const net = (r.delivery === 'delivered' ? (r.cash_collected || 0) : 0) - (r.delivery_fee || 0);
    if (r.payout_at) paid += net; else if (r.delivery === 'delivered' && !r.cash_settled_at) inTransit += net; else pending += net;
  }
  return json({ rows: rows.map(r => ({ ...r, ref: fmtRef(r.ref) })), pending, inTransit, paid, fee: deliveryFee(env) });
});

// ---------- driver app ----------
const jobView = (o, seller, cust) => {
  const pk = jparse(seller?.pickup, {}) || {};
  return {
    id: o.id, ref: fmtRef(o.ref), items: o.items, price: o.price, delivery: o.delivery, status: o.status, attempts: o.delivery_attempts, note: o.delivery_note,
    assigned_at: o.delivery_assigned_at, picked_at: o.picked_at, delivered_at: o.delivered_at, cash: o.cash_collected, settled: !!o.cash_settled_at,
    pickup: { shop: seller?.shop || '', addr: pk.addr || '', gov: pk.gov || '', phone: ['delivered', 'returned'].includes(o.delivery) ? '' : (pk.phone || seller?.phone || ''), notes: pk.notes || '' },
    customer: { located: o.loc_src === 'client', lat: o.loc_src === 'client' ? o.lat : null, lng: o.loc_src === 'client' ? o.lng : null, name: o.name, phone: ['delivered', 'returned'].includes(o.delivery) ? '' : o.phone, addr: o.addr || '', gov: o.gov || '', notes: o.notes || '', trust: cust ? cust.trust?.level : null },
  };
};
async function jobsFor(env, where, args) {
  const rows = (await env.DB.prepare(`SELECT * FROM orders WHERE ${where} ORDER BY COALESCE(delivery_assigned_at, delivery_requested_at) DESC LIMIT 200`).bind(...args).all()).results;
  const sellers = {};
  for (const id of [...new Set(rows.map(r => r.seller_id))]) sellers[id] = await env.DB.prepare('SELECT id, shop, phone, pickup FROM users WHERE id=?').bind(id).first();
  return rows.map(o => jobView(o, sellers[o.seller_id]));
}
// ---------- driver map: geocoding, stop order, road geometry ----------
const GOV_LL = { Ariana: [36.862, 10.195], 'Béja': [36.725, 9.182], 'Ben Arous': [36.753, 10.228], Bizerte: [37.274, 9.873], 'Gabès': [33.881, 10.098], Gafsa: [34.425, 8.784], Jendouba: [36.501, 8.780], Kairouan: [35.678, 10.096], Kasserine: [35.167, 8.836], 'Kébili': [33.705, 8.969], 'Le Kef': [36.174, 8.705], Mahdia: [35.504, 11.062], 'La Manouba': [36.808, 10.097], 'Médenine': [33.355, 10.505], Monastir: [35.777, 10.826], Nabeul: [36.456, 10.737], Sfax: [34.740, 10.760], 'Sidi Bouzid': [35.038, 9.485], Siliana: [36.085, 9.371], Sousse: [35.826, 10.637], Tataouine: [32.930, 10.452], Tozeur: [33.920, 8.134], Tunis: [36.806, 10.181], Zaghouan: [36.403, 10.143] };
function cleanLL(lat, lng) {
  lat = Number(lat); lng = Number(lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < 30 || lat > 37.6 || lng < 7.4 || lng > 11.8) return null; // Tunisia bounding box
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = { 'user-agent': 'Domo/1.0 (+https://domo.tn; support@domo.tn)', 'accept-language': 'fr' };
// Nominatim allows one request per second: new addresses are capped per call, and every answer (even "not found") is cached.
async function geocode(env, q, budget) {
  const key = q.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 200);
  const hit = await env.DB.prepare('SELECT lat, lng FROM geocache WHERE q=?').bind(key).first();
  if (hit) return hit.lat == null ? null : { lat: hit.lat, lng: hit.lng };
  if (budget.n <= 0) return undefined;
  budget.n--;
  const wait = budget.last ? 1100 - (Date.now() - budget.last) : 0;
  if (wait > 0) await sleep(wait);
  budget.last = Date.now();
  try {
    const r = await fetch('https://nominatim.openstreetmap.org/search?' + new URLSearchParams({ q: key, format: 'jsonv2', countrycodes: 'tn', limit: '1' }), { headers: UA });
    if (!r.ok) return undefined;
    const j = await r.json();
    const g = j[0] ? cleanLL(j[0].lat, j[0].lon) : null;
    await env.DB.prepare('INSERT OR REPLACE INTO geocache (q, lat, lng, at) VALUES (?,?,?,?)').bind(key, g ? g.lat : null, g ? g.lng : null, Date.now()).run();
    return g;
  } catch { return undefined; }
}
async function locate(env, p, budget) {
  const ll = cleanLL(p.lat, p.lng);
  if (ll) return { ...ll, prec: 'gps' };
  if (p.addr) {
    // Full address first, then its parts on their own (street names before neighbourhoods), without house numbers.
    const tries = [[p.addr, p.gov, 'Tunisie']];
    const parts = String(p.addr).split(/[,;\n]/).map(x => x.replace(/\b\d+\s*(bis|ter)?\b/gi, '').replace(/\s+/g, ' ').trim()).filter(x => x.length > 2);
    const street = x => /\b(rue|avenue|av\.?|bd|boulevard|route|nahj|impasse|cité|cite|résidence|residence)\b/i.test(x);
    for (const x of [...parts.filter(street), ...parts.filter(x => !street(x))]) if (parts.length > 1 || x !== p.addr) tries.push([x, p.gov, 'Tunisie']);
    for (const t of tries.slice(0, 4)) { const g = await geocode(env, t.filter(Boolean).join(', '), budget); if (g) return { ...g, prec: 'address' }; }
  }
  if (p.gov && GOV_LL[p.gov]) return { lat: GOV_LL[p.gov][0], lng: GOV_LL[p.gov][1], prec: 'area' };
  return null;
}
const hav = (a, b) => { const R = 6371000, t = Math.PI / 180, dl = (b.lat - a.lat) * t, dn = (b.lng - a.lng) * t;
  const x = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const OSRM = 'https://router.project-osrm.org';
async function osrm(path) {
  try { const r = await fetch(OSRM + path, { headers: UA }); if (!r.ok) return null; const j = await r.json(); return j.code === 'Ok' ? j : null; } catch { return null; }
}
// Order the stops: nearest feasible stop first, then improve by moving single stops (or-opt) and reversing segments (2-opt),
// always keeping every pickup before its delivery.
function orderStops(n, D, need, hasStart) {
  if (n <= 12) { // exact: dynamic programming over subsets, pickups before deliveries
    const N = 1 << n, dp = new Float64Array(N * n).fill(Infinity), par = new Int8Array(N * n).fill(-1);
    for (let v = 0; v < n; v++) if (need[v + 1] == null) dp[(1 << v) * n + v] = hasStart ? D[0][v + 1] : 0;
    for (let m = 1; m < N; m++) for (let u = 0; u < n; u++) {
      const c = dp[m * n + u]; if (c === Infinity) continue;
      for (let v = 0; v < n; v++) {
        if (m & (1 << v)) continue;
        const q = need[v + 1]; if (q != null && !(m & (1 << (q - 1)))) continue;
        const k = (m | (1 << v)) * n + v, nc = c + D[u + 1][v + 1];
        if (nc < dp[k]) { dp[k] = nc; par[k] = u; }
      }
    }
    let last = 0; for (let u = 1; u < n; u++) if (dp[(N - 1) * n + u] < dp[(N - 1) * n + last]) last = u;
    if (dp[(N - 1) * n + last] < Infinity) {
      const seq = []; let m = N - 1, u = last;
      while (u >= 0) { seq.push(u + 1); const pu = par[m * n + u]; m &= ~(1 << u); u = pu; }
      return seq.reverse();
    }
  }
  const ok = seq => { const at = {}; seq.forEach((v, i) => { at[v] = i; }); return seq.every(v => need[v] == null || at[need[v]] < at[v]); };
  const cost = seq => { let c = 0, prev = hasStart ? 0 : null; for (const v of seq) { if (prev != null) c += D[prev][v]; prev = v; } return c; };
  const left = new Set(Array.from({ length: n }, (_, i) => i + 1)), seq = [];
  let cur = hasStart ? 0 : null;
  while (left.size) {
    let best = null, bc = Infinity;
    for (const v of left) { if (need[v] != null && left.has(need[v])) continue; const c = cur == null ? 0 : D[cur][v]; if (c < bc) { bc = c; best = v; } }
    if (best == null) best = [...left][0];
    seq.push(best); left.delete(best); cur = best;
  }
  let bestC = cost(seq), improved = true, guard = 0;
  while (improved && guard++ < 60) {
    improved = false;
    for (let i = 0; i < seq.length; i++) for (let j = 0; j < seq.length; j++) {
      if (i === j) continue;
      const t = seq.slice(); const [v] = t.splice(i, 1); t.splice(j, 0, v);
      if (ok(t)) { const c = cost(t); if (c < bestC - 1) { seq.splice(0, seq.length, ...t); bestC = c; improved = true; } }
    }
    for (let i = 0; i < seq.length - 1; i++) for (let j = i + 1; j < seq.length; j++) {
      const t = seq.slice(0, i).concat(seq.slice(i, j + 1).reverse(), seq.slice(j + 1));
      if (ok(t)) { const c = cost(t); if (c < bestC - 1) { seq.splice(0, seq.length, ...t); bestC = c; improved = true; } }
    }
  }
  return seq;
}
on('GET', '/api/driver/route', async ({ env, me, url }) => {
  if (me.role !== 'driver' || me.status !== 'active') fail(403, 'Réservé aux livreurs actifs');
  const start = cleanLL(url.searchParams.get('lat'), url.searchParams.get('lng'));
  const rows = (await env.DB.prepare("SELECT * FROM orders WHERE driver_id=? AND delivery IN ('assigned','picked','returning') ORDER BY COALESCE(delivery_assigned_at, delivery_requested_at) LIMIT 24").bind(me.id).all()).results;
  const sellers = {};
  for (const id of [...new Set(rows.map(r => r.seller_id))]) sellers[id] = await env.DB.prepare('SELECT id, shop, phone, pickup FROM users WHERE id=?').bind(id).first();
  const budget = { n: 6, last: 0 }, stops = [], pickIdx = {};
  const job = o => ({ id: o.id, ref: fmtRef(o.ref), price: o.price, name: firstName(o.name), items: (o.items || '').slice(0, 80) });
  for (const o of rows) {
    const s = sellers[o.seller_id] || {}, pk = jparse(s.pickup, {}) || {};
    const shopPlace = { lat: pk.lat, lng: pk.lng, addr: pk.addr, gov: pk.gov };
    const custPlace = { lat: o.lat, lng: o.lng, addr: o.addr, gov: o.gov };
    if (o.delivery === 'assigned') {
      if (pickIdx[o.seller_id] == null) {
        pickIdx[o.seller_id] = stops.length;
        stops.push({ kind: 'pickup', title: s.shop || 'Boutique', addr: [pk.addr, pk.gov].filter(Boolean).join(', '), place: shopPlace, jobs: [] });
      }
      stops[pickIdx[o.seller_id]].jobs.push(job(o));
      stops.push({ kind: 'drop', title: firstName(o.name), addr: [o.addr, o.gov].filter(Boolean).join(', '), place: custPlace, jobs: [job(o)], after: pickIdx[o.seller_id] });
    } else if (o.delivery === 'picked') {
      stops.push({ kind: 'drop', title: firstName(o.name), addr: [o.addr, o.gov].filter(Boolean).join(', '), place: custPlace, jobs: [job(o)] });
    } else {
      stops.push({ kind: 'return', title: s.shop || 'Boutique', addr: [pk.addr, pk.gov].filter(Boolean).join(', '), place: shopPlace, jobs: [job(o)] });
    }
  }
  if (!stops.length) return json({ start, stops: [], geometry: [], distance: 0, duration: 0, provider: 'none' });
  for (const st of stops) st.loc = await locate(env, st.place, budget);
  const placed = stops.filter(st => st.loc), unplaced = stops.filter(st => !st.loc);
  // index 0 = driver position (if any), then placed stops 1..n
  const pts = [start || placed[0].loc, ...placed.map(st => st.loc)], n = placed.length;
  const need = [null, ...placed.map(st => { if (st.after == null) return null; const k = placed.indexOf(stops[st.after]); return k < 0 ? null : k + 1; })];
  let D = null, provider = 'estimate';
  const coords = pts.map(p => `${p.lng},${p.lat}`).join(';');
  if (pts.length <= 25) { const t = await osrm(`/table/v1/driving/${coords}?annotations=duration`); if (t && t.durations) { D = t.durations.map(r => r.map(x => (x == null ? 1e7 : x))); provider = 'osrm'; } }
  if (!D) D = pts.map(a => pts.map(b => hav(a, b) * 1.35 / 8.3)); // straight line × road factor, ~30 km/h
  const seq = orderStops(n, D, need, !!start);
  const ordered = seq.map(i => placed[i - 1]);
  const path = (start ? [start] : []).concat(ordered.map(st => st.loc));
  let geometry = path.map(p => [p.lat, p.lng]), distance = 0, duration = 0, legs = [];
  if (path.length >= 2) {
    const r = await osrm(`/route/v1/driving/${path.map(p => `${p.lng},${p.lat}`).join(';')}?overview=full&geometries=geojson`);
    if (r && r.routes && r.routes[0]) {
      const rt = r.routes[0]; geometry = rt.geometry.coordinates.map(([x, y]) => [y, x]); distance = rt.distance; duration = rt.duration; legs = rt.legs.map(l => l.duration);
    } else {
      for (let i = 1; i < path.length; i++) { const d = hav(path[i - 1], path[i]) * 1.35; distance += d; legs.push(d / 8.3); }
      duration = legs.reduce((a, b) => a + b, 0);
    }
  }
  let acc = 0;
  const out = ordered.map((st, i) => {
    const leg = start ? legs[i] : (i ? legs[i - 1] : 0); acc += leg || 0;
    return { seq: i + 1, kind: st.kind, title: st.title, addr: st.addr, lat: st.loc.lat, lng: st.loc.lng, prec: st.loc.prec, eta: Math.round(acc), jobs: st.jobs };
  });
  for (const st of unplaced) out.push({ seq: null, kind: st.kind, title: st.title, addr: st.addr, lat: null, lng: null, prec: 'none', eta: null, jobs: st.jobs });
  return json({ start, stops: out, geometry, distance: Math.round(distance), duration: Math.round(duration), provider });
}, { driver: true });

on('GET', '/api/driver/jobs', async ({ env, me }) => {
  if (me.role !== 'driver') fail(403, 'Réservé aux livreurs');
  if (me.status !== 'active') return json({ active: [], done: [], cash: { held: 0 }, stats: {}, status: me.status });
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const active = await jobsFor(env, "driver_id=? AND delivery IN ('assigned','picked','returning')", [me.id]);
  const done = await jobsFor(env, "driver_id=? AND delivery IN ('delivered','returned') AND updated_at>=?", [me.id, Date.now() - 7 * DAY]);
  const c = await env.DB.prepare("SELECT COALESCE(SUM(cash_collected),0) held, COUNT(*) n FROM orders WHERE driver_id=? AND delivery='delivered' AND cash_settled_at IS NULL").bind(me.id).first();
  const m0 = new Date(); m0.setDate(1); m0.setHours(0, 0, 0, 0);
  const st = await env.DB.prepare("SELECT COALESCE(SUM(delivery='delivered' AND delivered_at>=?1),0) today, COALESCE(SUM(delivery IN ('delivered','returned') AND updated_at>=?2),0) month, COALESCE(SUM(delivery='delivered'),0) total FROM orders WHERE driver_id=?3")
    .bind(dayStart.getTime(), m0.getTime(), me.id).first();
  return json({ active, done, cash: { held: c.held, count: c.n }, stats: { ...st, pay: driverPay(env), earnings: st.month * driverPay(env) }, status: me.status, available: !!me.available });
}, { driver: true });
on('POST', '/api/driver/jobs/:id', async ({ env, me, params, body, ctx }) => {
  if (me.role !== 'driver' || me.status !== 'active') fail(403, 'Réservé aux livreurs actifs');
  const o = await env.DB.prepare('SELECT * FROM orders WHERE id=? AND driver_id=?').bind(params.id, me.id).first();
  if (!o) fail(404, 'Course introuvable');
  const seller = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(o.seller_id).first();
  const t = Date.now(), ref = fmtRef(o.ref), dn = firstName(me.name);
  const ev = st => env.DB.prepare('INSERT INTO order_events (order_id, status, by_role, at) VALUES (?,?,?,?)').bind(o.id, st, 'driver', t);
  const note = str(body.note, 200, 'note');
  const a = body.action;
  if (a === 'picked') {
    if (o.delivery !== 'assigned') fail(409, 'Cette course n’est pas à récupérer');
    await env.DB.batch([env.DB.prepare("UPDATE orders SET delivery='picked', picked_at=?, status='shipped', updated_at=? WHERE id=?").bind(t, t, o.id), ...(o.status !== 'shipped' ? [ev('shipped')] : [])]);
    bg(ctx, notify(env, o.seller_id, { type: 'delivery', title: `Colis récupéré · ${ref}`, body: `${dn} (livreur Domo) est en route vers ${o.name}.`, url: '/#commandes', tag: 'order-' + o.id }));
    if (o.customer_id) bg(ctx, notify(env, o.customer_id, { type: 'status', title: `Votre colis est en route 🚚 · ${ref}`, body: `${seller.shop} · Livreur Domo : ${dn}. Préparez ${dt(o.price)}.`, url: `/?track=${ref}`, tag: 'order-' + o.id }));
  } else if (a === 'delivered') {
    if (o.delivery !== 'picked') fail(409, 'Récupérez d’abord le colis');
    const amount = body.amount === undefined ? o.price : money(body.amount, 'montant encaissé');
    await env.DB.batch([env.DB.prepare("UPDATE orders SET delivery='delivered', delivered_at=?, status='delivered', cash_collected=?, delivery_note=?, updated_at=? WHERE id=?").bind(t, amount, note || null, t, o.id), ev('delivered')]);
    await staleBadges(env, o.seller_id, o.customer_id);
    bg(ctx, notify(env, o.seller_id, { type: 'delivery', title: `Livré · ${ref}`, body: `${o.name} a payé ${dt(amount)} au livreur Domo.${Math.abs(amount - o.price) > 0.01 ? ` (prévu : ${dt(o.price)})` : ''}`, url: '/#commandes', tag: 'order-' + o.id }));
    if (o.customer_id) bg(ctx, notify(env, o.customer_id, { type: 'status', title: `Commande livrée · ${ref}`, body: `${seller.shop} · Merci ! Donnez votre avis sur la boutique.`, url: `/?track=${ref}`, tag: 'order-' + o.id }));
  } else if (a === 'refused') {
    if (o.delivery !== 'picked') fail(409, 'Récupérez d’abord le colis');
    const cause = FAIL_CAUSES[body.cause] ? body.cause : fail(400, 'Choisissez la raison de l’échec');
    await env.DB.batch([env.DB.prepare("UPDATE orders SET delivery='returning', status='refused', fail_cause=?, fail_contest=NULL, delivery_note=?, updated_at=? WHERE id=?").bind(cause, note || FAIL_CAUSES[cause], t, o.id), ev('refused')]);
    await staleBadges(env, o.seller_id, o.customer_id);
    bg(ctx, notify(env, o.seller_id, { type: 'delivery', title: `Colis non livré · ${ref}`, body: `${FAIL_CAUSES[cause]}${note ? ` : ${note}` : ''}. ${dn} vous le ramène.`, url: '/#commandes', tag: 'order-' + o.id }));
  } else if (a === 'noanswer') {
    if (!['assigned', 'picked'].includes(o.delivery)) fail(409, 'Action impossible');
    await env.DB.prepare('UPDATE orders SET delivery_attempts=delivery_attempts+1, delivery_note=?, updated_at=? WHERE id=?').bind(note || 'Client injoignable', t, o.id).run();
    bg(ctx, notify(env, o.seller_id, { type: 'delivery', title: `Client injoignable · ${ref}`, body: `${dn} n’arrive pas à joindre ${o.name} (tentative ${o.delivery_attempts + 1}). Relancez-le sur WhatsApp.`, url: '/#commandes', tag: 'order-' + o.id }));
  } else if (a === 'returned') {
    if (o.delivery !== 'returning') fail(409, 'Ce colis n’est pas en retour');
    await env.DB.prepare("UPDATE orders SET delivery='returned', updated_at=? WHERE id=?").bind(t, o.id).run();
    bg(ctx, notify(env, o.seller_id, { type: 'delivery', title: `Colis rendu · ${ref}`, body: `${dn} vous a rendu le colis refusé.`, url: '/#commandes', tag: 'order-' + o.id }));
  } else fail(400, 'Action inconnue');
  return json({ job: (await jobsFor(env, 'id=?', [o.id]))[0] });
}, { driver: true });

// ---------- admin console ----------
on('GET', '/api/admin/contests', async ({ env, me, url }) => {
  adminOnly(env, me);
  const st = ['open', 'accepted', 'rejected'].includes(url.searchParams.get('status')) ? url.searchParams.get('status') : 'open';
  const rows = (await env.DB.prepare('SELECT o.*, u.shop FROM orders o JOIN users u ON u.id=o.seller_id WHERE o.fail_contest=? ORDER BY o.fail_contest_at DESC LIMIT 100').bind(st).all()).results;
  const out = [];
  for (const o of rows) {
    const ev = (await env.DB.prepare('SELECT status, by_role, at FROM order_events WHERE order_id=? ORDER BY at').bind(o.id).all()).results;
    out.push({ id: o.id, ref: fmtRef(o.ref), shop: o.shop, name: o.name, phone: o.phone, items: o.items, price: o.price, cause: FAIL_CAUSES[o.fail_cause || 'customer'],
      sellerNote: o.delivery_note || null, driven: !!o.driver_id, note: o.fail_contest_note, at: o.fail_contest_at, events: ev });
  }
  return json({ contests: out });
});
on('POST', '/api/admin/contests/:id', async ({ env, me, params, body, ctx }) => {
  adminOnly(env, me);
  const o = await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(params.id).first();
  if (!o || o.fail_contest !== 'open') fail(404, 'Contestation introuvable ou déjà traitée');
  const d = body.decision === 'accepted' ? 'accepted' : body.decision === 'rejected' ? 'rejected' : fail(400, 'Décision invalide');
  await env.DB.prepare('UPDATE orders SET fail_contest=? WHERE id=?').bind(d, o.id).run();
  await staleBadges(env, o.seller_id, o.customer_id);
  const txt = d === 'accepted' ? 'Contestation acceptée : ce refus ne compte plus dans l’historique du client.' : 'Contestation refusée : le refus reste dans l’historique du client.';
  bg(ctx, notify(env, o.seller_id, { type: 'dispute', title: `Décision Domo · ${fmtRef(o.ref)}`, body: txt, url: '/#commandes', tag: 'order-' + o.id }));
  if (o.customer_id) bg(ctx, notify(env, o.customer_id, { type: 'status', title: `Décision sur votre contestation · ${fmtRef(o.ref)}`, body: txt, url: `/?o=${o.claim_token}`, tag: 'order-' + o.id }));
  return json({ ok: true });
});

async function adminCounts(env) {
  const contests = (await env.DB.prepare("SELECT COUNT(*) n FROM orders WHERE fail_contest='open'").first()).n;
  const r = await env.DB.prepare(`SELECT
    (SELECT COUNT(*) FROM verifications WHERE status='pending') verif,
    (SELECT COUNT(*) FROM orders WHERE delivery='requested') pickups,
    (SELECT COUNT(*) FROM boost_requests WHERE status='new') boost,
    (SELECT COUNT(*) FROM drivers WHERE status='pending') drivers`).first();
  return { ...r, contests };
}
on('GET', '/api/admin/metrics', async ({ env, me, url }) => {
  adminOnly(env, me);
  const days = Math.max(7, Math.min(90, parseInt(url.searchParams.get('days'), 10) || 30));
  const now = Date.now(), from = now - days * DAY, prevFrom = from - days * DAY;
  const one = (q, ...a) => env.DB.prepare(q).bind(...a).first();
  const all = async (q, ...a) => (await env.DB.prepare(q).bind(...a).all()).results;
  const t = await one(`SELECT
      (SELECT COUNT(*) FROM users WHERE role='seller') sellers,
      (SELECT COUNT(*) FROM users WHERE role='seller' AND created_at>=?1) signups,
      (SELECT COUNT(*) FROM users WHERE role='seller' AND created_at>=?2 AND created_at<?1) signups_prev,
      (SELECT COUNT(*) FROM users WHERE role='customer') customers,
      (SELECT COUNT(*) FROM orders WHERE created_at>=?1) orders,
      (SELECT COUNT(*) FROM orders WHERE created_at>=?2 AND created_at<?1) orders_prev,
      (SELECT COUNT(*) FROM orders WHERE created_at>=?1 AND status IN ('confirmed','shipped','delivered')) confirmed,
      (SELECT COUNT(*) FROM orders WHERE created_at>=?1 AND status='delivered') delivered,
      (SELECT COUNT(*) FROM orders WHERE created_at>=?1 AND status='refused') refused,
      (SELECT COUNT(*) FROM orders WHERE created_at>=?1 AND status IN ('shipped','delivered','refused')) shipped,
      (SELECT COALESCE(SUM(price),0) FROM orders WHERE created_at>=?1 AND status='delivered' AND price>1) gmv,
      (SELECT COUNT(DISTINCT seller_id) FROM orders WHERE created_at>=?3) active7,
      (SELECT COUNT(DISTINCT seller_id) FROM orders WHERE created_at>=?1) active,
      (SELECT COUNT(*) FROM products WHERE active=1) products,
      (SELECT COUNT(*) FROM reviews WHERE created_at>=?1) reviews,
      (SELECT COUNT(*) FROM boost_requests WHERE status='new') boost_new`, from, prevFrom, now - 7 * DAY);
  const activated = (await one(`SELECT COUNT(*) n FROM (SELECT o.seller_id FROM orders o JOIN users u ON u.id=o.seller_id
      WHERE o.status IN ('confirmed','shipped','delivered') AND o.created_at <= u.created_at + 30*86400000 GROUP BY o.seller_id HAVING COUNT(*)>=5)`)).n;
  const series = await all(`SELECT CAST((created_at-?1)/86400000 AS INTEGER) d, COUNT(*) n FROM orders WHERE created_at>=?1 GROUP BY d`, from);
  const sseries = await all(`SELECT CAST((created_at-?1)/86400000 AS INTEGER) d, COUNT(*) n FROM users WHERE role='seller' AND created_at>=?1 GROUP BY d`, from);
  const byDay = (rows) => { const a = Array(days).fill(0); for (const r of rows) if (r.d >= 0 && r.d < days) a[r.d] = r.n; return a; };
  const causes = await all(`SELECT COALESCE(fail_cause,'customer') c, COUNT(*) n FROM orders WHERE status='refused' AND created_at>=? GROUP BY c ORDER BY n DESC`, from);
  const gov = await all(`SELECT gov g, COUNT(*) n, SUM(status='refused') r FROM orders WHERE created_at>=? AND gov IS NOT NULL AND gov<>'' GROUP BY gov ORDER BY n DESC LIMIT 8`, from);
  const top = await all(`SELECT u.id, u.shop, u.slug, u.phone, COUNT(o.id) n, SUM(o.status IN ('confirmed','shipped','delivered')) c, SUM(o.status='delivered') d, SUM(o.status='refused') r, MAX(o.created_at) last
      FROM orders o JOIN users u ON u.id=o.seller_id WHERE o.created_at>=? GROUP BY u.id ORDER BY n DESC LIMIT 10`, from);
  const fresh = await all(`SELECT u.id, u.shop, u.name, u.phone, u.slug, u.created_at,
      (SELECT COUNT(*) FROM orders o WHERE o.seller_id=u.id) orders, (SELECT COUNT(*) FROM products p WHERE p.seller_id=u.id) products
      FROM users u WHERE u.role='seller' ORDER BY u.created_at DESC LIMIT 15`);
  const stuck = fresh.filter(x => !x.orders && now - x.created_at > DAY);
  const resets = (await all(`SELECT r.id, r.role, r.phone, r.created_at, r.link_at, COALESCE(u.name, d.name) name FROM pw_resets r LEFT JOIN users u ON u.role=r.role AND u.phone=r.phone LEFT JOIN drivers d ON r.role='driver' AND d.phone=r.phone WHERE r.used_at IS NULL AND r.created_at > ? ORDER BY r.created_at DESC LIMIT 20`, now - 7 * DAY).catch(() => [])) || [];
  return json({ resets, days, totals: { ...t, activated }, orders: byDay(series), signups: byDay(sseries), causes: causes.map(x => ({ ...x, label: FAIL_CAUSES[x.c] || x.c })), gov, top, fresh, stuck, counts: await adminCounts(env) });
});

on('GET', '/api/admin/overview', async ({ env, me }) => {
  adminOnly(env, me);
  const c = await adminCounts(env);
  const cash = await env.DB.prepare("SELECT COALESCE(SUM(cash_collected),0) held FROM orders WHERE delivery='delivered' AND cash_settled_at IS NULL").first();
  const due = await env.DB.prepare("SELECT COALESCE(SUM(CASE WHEN delivery='delivered' THEN cash_collected ELSE 0 END) - SUM(delivery_fee),0) due FROM orders WHERE delivery IN ('delivered','returned') AND payout_at IS NULL AND (delivery='returned' OR cash_settled_at IS NOT NULL)").first();
  const active = await env.DB.prepare("SELECT COUNT(*) n FROM orders WHERE delivery IN ('assigned','picked','returning')").first();
  return json({ ...c, cashHeld: cash.held, payoutsDue: due.due, active: active.n, fee: deliveryFee(env), pay: driverPay(env) });
});
on('GET', '/api/admin/verifications', async ({ env, me, url }) => {
  adminOnly(env, me);
  const st = ['pending', 'approved', 'rejected'].includes(url.searchParams.get('status')) ? url.searchParams.get('status') : 'pending';
  const rows = (await env.DB.prepare('SELECT v.*, u.shop, u.name, u.phone, u.city, u.slug, u.created_at u_since FROM verifications v JOIN users u ON u.id=v.user_id WHERE v.status=? ORDER BY v.created_at DESC LIMIT 100').bind(st).all()).results;
  const out = [];
  for (const v of rows) {
    const u = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(v.user_id).first();
    out.push({ ...v, seller: u ? await card(env, u) : null });
  }
  return json({ verifications: out });
});
on('GET', '/api/admin/docs/:owner/:file', async ({ env, me, params }) => {
  adminOnly(env, me);
  const row = await env.DB.prepare('SELECT type, data FROM docs WHERE key=?').bind(`d/${params.owner}/${params.file}`).first();
  if (!row) fail(404, 'Document introuvable');
  return new Response(new Uint8Array(row.data), { headers: { 'content-type': row.type, 'cache-control': 'private, no-store' } });
});
on('POST', '/api/admin/verifications/:id', async ({ env, me, params, body, ctx }) => {
  adminOnly(env, me);
  const v = await env.DB.prepare('SELECT * FROM verifications WHERE id=?').bind(params.id).first();
  if (!v) fail(404, 'Demande introuvable');
  if (v.status !== 'pending') fail(409, 'Demande déjà traitée');
  const t = Date.now();
  if (body.action === 'approve') {
    await env.DB.batch([
      env.DB.prepare("UPDATE verifications SET status='approved', reviewed_at=?, reviewed_by=? WHERE id=?").bind(t, me.id, v.id),
      env.DB.prepare('UPDATE users SET seller_verified=1, seller_verified_at=?, badges_at=NULL WHERE id=?').bind(t, v.user_id),
    ]);
    bg(ctx, notify(env, v.user_id, { type: 'verification', title: 'Boutique vérifiée ✅', body: 'Le badge « Vendeur vérifié » apparaît maintenant sur votre vitrine.', url: '/#compte', tag: 'verif' }));
  } else if (body.action === 'reject') {
    const note = str(body.note, 300, 'motif', true);
    await env.DB.prepare("UPDATE verifications SET status='rejected', note=?, reviewed_at=?, reviewed_by=? WHERE id=?").bind(note, t, me.id, v.id).run();
    bg(ctx, notify(env, v.user_id, { type: 'verification', title: 'Vérification refusée', body: note, url: '/#compte', tag: 'verif' }));
  } else fail(400, 'Action inconnue');
  return json({ ok: true });
});
on('POST', '/api/admin/sellers/:id/unverify', async ({ env, me, params }) => {
  adminOnly(env, me);
  await env.DB.prepare('UPDATE users SET seller_verified=0, seller_verified_at=NULL, badges_at=NULL WHERE id=? AND role=?').bind(params.id, 'seller').run();
  return json({ ok: true });
});
on('GET', '/api/admin/deliveries', async ({ env, me, url }) => {
  adminOnly(env, me);
  const view = url.searchParams.get('view') || 'requested';
  const where = view === 'active' ? "delivery IN ('assigned','picked','returning')" : view === 'done' ? "delivery IN ('delivered','returned') AND updated_at>=?" : "delivery='requested'";
  const rows = (await env.DB.prepare(`SELECT * FROM orders WHERE ${where} ORDER BY COALESCE(delivery_assigned_at, delivery_requested_at) DESC LIMIT 200`).bind(...(view === 'done' ? [Date.now() - 7 * DAY] : [])).all()).results;
  const sellers = {}, drivers = {};
  for (const id of [...new Set(rows.map(r => r.seller_id))]) sellers[id] = await env.DB.prepare('SELECT id, shop, phone, pickup, seller_verified FROM users WHERE id=?').bind(id).first();
  for (const id of [...new Set(rows.map(r => r.driver_id).filter(Boolean))]) drivers[id] = await env.DB.prepare('SELECT id, name, phone FROM drivers WHERE id=?').bind(id).first();
  return json({ jobs: rows.map(o => ({ ...jobView(o, sellers[o.seller_id]), requested_at: o.delivery_requested_at, fee: o.delivery_fee, driver: o.driver_id ? drivers[o.driver_id] || null : null, verified: !!sellers[o.seller_id]?.seller_verified })) });
});
on('POST', '/api/admin/deliveries/:id/assign', async ({ env, me, params, body, ctx }) => {
  adminOnly(env, me);
  const o = await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(params.id).first();
  if (!o || !['requested', 'assigned'].includes(o.delivery)) fail(409, 'Cette course ne peut plus être attribuée');
  const t = Date.now();
  if (!body.driver_id) {
    await env.DB.prepare("UPDATE orders SET delivery='requested', driver_id=NULL, delivery_assigned_at=NULL, updated_at=? WHERE id=?").bind(t, o.id).run();
    if (o.driver_id) bg(ctx, notifyDriver(env, o.driver_id, { title: `Course retirée · ${fmtRef(o.ref)}`, body: 'Domo a réattribué cette course.', tag: 'job-' + o.id }));
    return json({ ok: true });
  }
  const d = await env.DB.prepare("SELECT * FROM drivers WHERE id=? AND status='active'").bind(String(body.driver_id)).first();
  if (!d) fail(404, 'Livreur introuvable ou inactif');
  await env.DB.prepare("UPDATE orders SET delivery='assigned', driver_id=?, delivery_assigned_at=?, updated_at=? WHERE id=?").bind(d.id, t, t, o.id).run();
  const seller = await env.DB.prepare('SELECT shop, pickup FROM users WHERE id=?').bind(o.seller_id).first();
  const pk = jparse(seller.pickup, {}) || {};
  bg(ctx, notifyDriver(env, d.id, { title: `Nouvelle course · ${fmtRef(o.ref)}`, body: `Ramassage : ${seller.shop} (${pk.gov || ''}) → ${o.name}, ${o.gov || ''} · ${dt(o.price)} à encaisser`, tag: 'job-' + o.id }));
  if (o.driver_id && o.driver_id !== d.id) bg(ctx, notifyDriver(env, o.driver_id, { title: `Course retirée · ${fmtRef(o.ref)}`, body: 'Domo a réattribué cette course.', tag: 'job-' + o.id }));
  bg(ctx, notify(env, o.seller_id, { type: 'delivery', title: `Livreur attribué · ${fmtRef(o.ref)}`, body: `${firstName(d.name)} passera récupérer le colis.`, url: '/#commandes', tag: 'order-' + o.id }));
  return json({ ok: true });
});
on('GET', '/api/admin/drivers', async ({ env, me }) => {
  adminOnly(env, me);
  const rows = (await env.DB.prepare(`SELECT d.id, d.name, d.phone, d.city, d.zones, d.vehicle, d.status, d.available, d.created_at, d.last_seen,
    (SELECT COUNT(*) FROM orders o WHERE o.driver_id=d.id AND o.delivery IN ('assigned','picked','returning')) active,
    (SELECT COALESCE(SUM(cash_collected),0) FROM orders o WHERE o.driver_id=d.id AND o.delivery='delivered' AND o.cash_settled_at IS NULL) held,
    (SELECT COUNT(*) FROM orders o WHERE o.driver_id=d.id AND o.delivery='delivered') delivered
    FROM drivers d ORDER BY (d.status='pending') DESC, (d.status='active') DESC, d.available DESC, d.name LIMIT 300`).all()).results;
  return json({ drivers: rows.map(r => ({ ...r, available: !!r.available })) });
});
on('POST', '/api/admin/drivers', async ({ env, me, body }) => {
  adminOnly(env, me);
  const name = str(body.name, 80, 'nom', true), phone = normPhone(body.phone);
  if (!okPhone(phone)) fail(400, 'Numéro invalide');
  const password = String(body.password || '');
  if (password.length < 8) fail(400, 'Mot de passe : 8 caractères minimum');
  if (await env.DB.prepare('SELECT 1 FROM drivers WHERE phone=?').bind(phone).first()) fail(409, 'Un livreur existe déjà avec ce numéro');
  await env.DB.prepare('INSERT INTO drivers (id, name, phone, pass, city, zones, vehicle, status, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(rid(), name, phone, await hashPass(password), str(body.city, 40, 'ville'), str(body.zones, 200, 'zones'), VEHICLES.includes(body.vehicle) ? body.vehicle : 'moto', 'active', Date.now()).run();
  return json({ ok: true }, 201);
});
on('PATCH', '/api/admin/drivers/:id', async ({ env, me, params, body }) => {
  adminOnly(env, me);
  const d = await env.DB.prepare('SELECT * FROM drivers WHERE id=?').bind(params.id).first();
  if (!d) fail(404, 'Livreur introuvable');
  if (body.status !== undefined) {
    if (!['active', 'suspended', 'rejected'].includes(body.status)) fail(400, 'Statut invalide');
    const busy = (await env.DB.prepare("SELECT COUNT(*) n FROM orders WHERE driver_id=? AND delivery IN ('assigned','picked','returning')").bind(d.id).first()).n;
    if (body.status !== 'active' && busy) fail(409, `Ce livreur a ${busy} course(s) en cours : réattribuez-les d’abord.`);
    await env.DB.prepare('UPDATE drivers SET status=?, available=CASE WHEN ?=\'active\' THEN available ELSE 0 END WHERE id=?').bind(body.status, body.status, d.id).run();
    if (body.status !== 'active') await env.DB.prepare('DELETE FROM driver_sessions WHERE driver_id=?').bind(d.id).run();
    if (body.status === 'active' && d.status !== 'active') await notifyDriver(env, d.id, { title: 'Bienvenue dans l’équipe Domo 🎉', body: 'Votre compte livreur est activé. Passez « En service » pour recevoir des courses.', tag: 'welcome' });
  }
  return json({ ok: true });
});
on('POST', '/api/admin/drivers/:id/settle', async ({ env, me, params }) => {
  adminOnly(env, me);
  const r = await env.DB.prepare("SELECT COALESCE(SUM(cash_collected),0) s, COUNT(*) n FROM orders WHERE driver_id=? AND delivery='delivered' AND cash_settled_at IS NULL").bind(params.id).first();
  await env.DB.prepare("UPDATE orders SET cash_settled_at=? WHERE driver_id=? AND delivery='delivered' AND cash_settled_at IS NULL").bind(Date.now(), params.id).run();
  return json({ ok: true, amount: r.s, count: r.n });
});
on('GET', '/api/admin/payouts', async ({ env, me }) => {
  adminOnly(env, me);
  const rows = (await env.DB.prepare(`SELECT o.seller_id, u.shop, u.phone, COUNT(*) n,
      COALESCE(SUM(CASE WHEN o.delivery='delivered' THEN o.cash_collected ELSE 0 END),0) cash, COALESCE(SUM(o.delivery_fee),0) fees
    FROM orders o JOIN users u ON u.id=o.seller_id
    WHERE o.delivery IN ('delivered','returned') AND o.payout_at IS NULL AND (o.delivery='returned' OR o.cash_settled_at IS NOT NULL)
    GROUP BY o.seller_id ORDER BY cash DESC LIMIT 200`).all()).results;
  const transit = await env.DB.prepare("SELECT COALESCE(SUM(cash_collected),0) s FROM orders WHERE delivery='delivered' AND cash_settled_at IS NULL").first();
  return json({ sellers: rows.map(r => ({ ...r, due: Math.round((r.cash - r.fees) * 1000) / 1000 })), inTransit: transit.s });
});
on('POST', '/api/admin/payouts/:sellerId', async ({ env, me, params, ctx }) => {
  adminOnly(env, me);
  const w = "seller_id=? AND delivery IN ('delivered','returned') AND payout_at IS NULL AND (delivery='returned' OR cash_settled_at IS NOT NULL)";
  const r = await env.DB.prepare(`SELECT COALESCE(SUM(CASE WHEN delivery='delivered' THEN cash_collected ELSE 0 END) - SUM(delivery_fee),0) due, COUNT(*) n FROM orders WHERE ${w}`).bind(params.sellerId).first();
  if (!r.n) fail(400, 'Rien à verser');
  await env.DB.prepare(`UPDATE orders SET payout_at=? WHERE ${w}`).bind(Date.now(), params.sellerId).run();
  bg(ctx, notify(env, params.sellerId, { type: 'delivery', title: 'Versement Domo effectué 💸', body: `${dt(r.due)} pour ${r.n} colis livrés par Domo.`, url: '/#stats', tag: 'payout' }));
  return json({ ok: true, amount: r.due, count: r.n });
});

/* ---------------- Domo Boost (visibility + social media management) ---------------- */
const BOOST_PACKS = {
  essentiel: { id: 'essentiel', name: 'Essentiel', price: 149, featureDays: 7, tagline: 'On gère votre Instagram ou votre Facebook',
    features: ['1 réseau géré par Domo : Instagram ou Facebook', '8 publications designées et 4 stories par mois', 'Profil optimisé : bio, couverture, stories à la une', 'Retouche de 10 photos produit', 'À la une dans Explorer 1 semaine par mois', 'Domo Pro inclus et rapport mensuel'] },
  croissance: { id: 'croissance', name: 'Croissance', price: 299, featureDays: 14, tagline: 'Instagram et Facebook, publicité comprise', popular: true,
    features: ['Instagram et Facebook gérés par Domo', '12 publications, 8 stories et 2 Reels par mois', 'Réponses aux commentaires et messages, jours ouvrés', '1 campagne publicitaire par mois, créée et suivie', 'Retouche de 20 photos produit', 'À la une 2 semaines par mois, Domo Pro inclus'] },
  premium: { id: 'premium', name: 'Premium', price: 549, featureDays: 30, tagline: 'Tout votre marketing digital, de A à Z',
    features: ['Instagram, Facebook et TikTok gérés par Domo', '20 publications, 15 stories et 4 Reels ou TikToks par mois', 'Messages et commentaires chaque jour, commandes saisies dans Domo', 'Stratégie mensuelle et jusqu’à 3 campagnes publicitaires', 'Retouche de 40 photos produit, 1 collaboration influenceur par mois', 'À la une tout le mois, appel bilan mensuel'] },
};
const BOOST_EXTRAS = [
  { id: 'setup', name: 'Création ou refonte de page (bio, couverture, stories à la une)', price: 120, unit: 'une fois' },
  { id: 'post', name: 'Publication designée', price: 25, unit: 'la publication', qty: true },
  { id: 'reel', name: 'Reel : script, montage, sous-titres', price: 60, unit: 'le Reel', qty: true },
  { id: 'photo', name: 'Retouche photo produit', price: 3, unit: 'la photo', qty: true },
  { id: 'adsetup', name: 'Création d’une campagne publicitaire', price: 80, unit: 'la campagne', qty: true },
  { id: 'adsmgmt', name: 'Gestion de vos pubs (15 % du budget, minimum 60 DT)', price: 60, unit: 'par mois, minimum' },
  { id: 'story', name: 'Story sur les pages Domo', price: 15, unit: 'la story', qty: true },
  { id: 'feature', name: 'À la une dans Explorer', price: 40, unit: 'la semaine', qty: true },
];
const BOOST_STATUS = ['new', 'active', 'done', 'cancelled'];
const boostView = r => ({ id: r.id, pack: r.pack || null, extras: jparse(r.extras, []), note: r.note || '', total: r.total, status: r.status,
  adminNote: r.admin_note || '', createdAt: r.created_at, startedAt: r.started_at || null, endsAt: r.ends_at || null });
function boostQuote(packId, extras) {
  const pack = packId ? BOOST_PACKS[packId] : null;
  if (packId && !pack) fail(400, 'Pack inconnu');
  const items = [];
  for (const e of Array.isArray(extras) ? extras.slice(0, 20) : []) {
    const def = BOOST_EXTRAS.find(x => x.id === e?.id);
    if (!def) continue;
    const qty = def.qty ? Math.max(1, Math.min(200, Math.floor(Number(e.qty) || 1))) : 1;
    if (!items.some(i => i.id === def.id)) items.push({ id: def.id, name: def.name, price: def.price, qty, unit: def.unit });
  }
  if (!pack && !items.length) fail(400, 'Choisissez un pack ou au moins un service');
  const total = (pack ? pack.price : 0) + items.reduce((s, i) => s + i.price * i.qty, 0);
  return { pack, items, total: Math.round(total * 1000) / 1000 };
}
on('GET', '/api/boost', async ({ env, me }) => {
  if (me.role !== 'seller') fail(403, 'Réservé aux vendeurs');
  const rows = (await env.DB.prepare('SELECT * FROM boost_requests WHERE user_id=? ORDER BY created_at DESC LIMIT 30').bind(me.id).all()).results;
  const fu = (await env.DB.prepare('SELECT featured_until FROM users WHERE id=?').bind(me.id).first())?.featured_until || 0;
  return json({ packs: Object.values(BOOST_PACKS), extras: BOOST_EXTRAS, requests: rows.map(boostView), featuredUntil: fu > Date.now() ? fu : null });
});
on('POST', '/api/boost/requests', async ({ env, me, body, ctx }) => {
  if (me.role !== 'seller') fail(403, 'Réservé aux vendeurs');
  const q = boostQuote(body.pack || null, body.extras);
  const note = str(body.note, 600, 'message');
  const open = await env.DB.prepare("SELECT COUNT(*) n FROM boost_requests WHERE user_id=? AND status='new'").bind(me.id).first();
  if (open.n >= 3) fail(429, 'Vous avez déjà 3 demandes en attente. L’équipe vous contacte très vite.');
  const id = 'bst_' + rid(9).replace(/[^A-Za-z0-9]/g, 'x');
  await env.DB.prepare('INSERT INTO boost_requests (id, user_id, pack, extras, note, total, status, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind(id, me.id, q.pack ? q.pack.id : null, JSON.stringify(q.items), note || null, q.total, 'new', Date.now()).run();
  bg(ctx, notifyAdmins(env, { type: 'verification', title: 'Nouvelle demande Domo Boost', body: `${me.shop || me.name} : ${q.pack ? q.pack.name : 'sur mesure'}, ${dt(q.total)}`, url: '/#admin', tag: 'boost' }));
  const row = await env.DB.prepare('SELECT * FROM boost_requests WHERE id=?').bind(id).first();
  return json({ request: boostView(row) });
});
on('DELETE', '/api/boost/requests/:id', async ({ env, me, params }) => {
  const r = await env.DB.prepare('SELECT * FROM boost_requests WHERE id=? AND user_id=?').bind(params.id, me.id).first();
  if (!r) fail(404, 'Demande introuvable');
  if (r.status !== 'new') fail(400, 'Cette demande est déjà prise en charge : écrivez à l’équipe pour la modifier.');
  await env.DB.prepare("UPDATE boost_requests SET status='cancelled' WHERE id=?").bind(r.id).run();
  return json({ ok: true });
});
on('GET', '/api/admin/boost', async ({ env, me, url }) => {
  adminOnly(env, me);
  const st = BOOST_STATUS.includes(url.searchParams.get('status')) ? url.searchParams.get('status') : 'new';
  const rows = (await env.DB.prepare('SELECT b.*, u.shop, u.name, u.phone, u.city, u.slug, u.featured_until FROM boost_requests b JOIN users u ON u.id=b.user_id WHERE b.status=? ORDER BY b.created_at DESC LIMIT 100').bind(st).all()).results;
  return json({ requests: rows.map(r => ({ ...boostView(r), shop: r.shop || r.name, phone: r.phone, city: r.city || '', slug: r.slug || '', featuredUntil: r.featured_until && r.featured_until > Date.now() ? r.featured_until : null })) });
});
on('PATCH', '/api/admin/boost/:id', async ({ env, me, params, body, ctx }) => {
  adminOnly(env, me);
  const r = await env.DB.prepare('SELECT * FROM boost_requests WHERE id=?').bind(params.id).first();
  if (!r) fail(404, 'Demande introuvable');
  const status = body.status;
  if (!BOOST_STATUS.includes(status)) fail(400, 'Statut invalide');
  const note = body.adminNote !== undefined ? str(body.adminNote, 400, 'note') : r.admin_note;
  const now = Date.now();
  let started = r.started_at, ends = r.ends_at;
  if (status === 'active' && r.status !== 'active') {
    started = now; ends = now + 30 * 864e5;
    const extras = jparse(r.extras, []);
    const days = (r.pack && BOOST_PACKS[r.pack] ? BOOST_PACKS[r.pack].featureDays : 0) + extras.filter(e => e.id === 'feature').reduce((s, e) => s + 7 * (e.qty || 1), 0);
    if (days) {
      const u = await env.DB.prepare('SELECT featured_until FROM users WHERE id=?').bind(r.user_id).first();
      const from = Math.max(now, u?.featured_until || 0);
      await env.DB.prepare('UPDATE users SET featured_until=? WHERE id=?').bind(from + days * 864e5, r.user_id).run();
    }
    bg(ctx, notify(env, r.user_id, { type: 'badge', title: 'Domo Boost activé 🚀', body: r.pack && BOOST_PACKS[r.pack] ? `Votre pack ${BOOST_PACKS[r.pack].name} démarre aujourd’hui.` : 'Vos services sur mesure démarrent aujourd’hui.', url: '/#boost', tag: 'boost' }));
  }
  if (status === 'cancelled' && r.status === 'new') bg(ctx, notify(env, r.user_id, { type: 'badge', title: 'Demande Domo Boost', body: note || 'Votre demande a été clôturée. Écrivez-nous pour en parler.', url: '/#boost', tag: 'boost' }));
  await env.DB.prepare('UPDATE boost_requests SET status=?, admin_note=?, started_at=?, ends_at=? WHERE id=?').bind(status, note || null, started || null, ends || null, r.id).run();
  return json({ request: boostView(await env.DB.prepare('SELECT * FROM boost_requests WHERE id=?').bind(r.id).first()) });
});

// Routes a driver session may call (everything else answers 403 for drivers).
for (const r of routes) if (['GET /api/me', 'PATCH /api/me', 'POST /api/auth/logout', 'POST /api/push/subscribe', 'POST /api/push/unsubscribe', 'POST /api/push/test', 'GET /api/notifications', 'POST /api/notifications/read', 'GET /api/inbox/poll'].includes(r.method + ' ' + r.pattern)) r.driver = true;


const xesc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function shopSitemap(env, url) {
  const rows = (await env.DB.prepare("SELECT u.slug FROM users u WHERE u.role='seller' AND u.slug IS NOT NULL AND EXISTS (SELECT 1 FROM products p WHERE p.seller_id=u.id AND p.active=1) ORDER BY u.created_at DESC LIMIT 5000").all()).results;
  const body = rows.map(r => `<url><loc>${url.origin}/s/${xesc(encodeURIComponent(r.slug))}</loc></url>`).join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
// Public shop link: same app page, with the shop's own title, description and image in the head so links preview well and can be indexed.
async function shopPage(req, env, url, slug) {
  const res = await env.ASSETS.fetch(new Request(new URL('/', url), req));
  let u = null;
  try { u = await shopBySlug(env, slug); } catch {}
  if (!u) return new Response('Boutique introuvable', { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' }, });
  const n = (await env.DB.prepare('SELECT COUNT(*) c FROM products WHERE seller_id=? AND active=1').bind(u.id).first())?.c || 0;
  const title = `${u.shop} — boutique sur Domo`;
  const desc = (u.bio || `${u.shop}${u.city ? ' à ' + u.city : ''} : ${n} produit${n > 1 ? 's' : ''}, paiement à la livraison, commande confirmée sur WhatsApp.`).replace(/\s+/g, ' ').slice(0, 200);
  const key = [u.cover, u.logo].find(x => typeof x === 'string' && /^u\/[\w-]+\/[\w.-]+$/.test(x));
  const img = key ? `${url.origin}/media/${key}` : `${url.origin}/icon-512.png`;
  const canon = `${url.origin}/s/${encodeURIComponent(u.slug)}`;
  const tags = `<meta property="og:type" content="website"><meta property="og:title" content="${xesc(title)}"><meta property="og:description" content="${xesc(desc)}"><meta property="og:image" content="${xesc(img)}"><meta property="og:url" content="${xesc(canon)}"><meta name="twitter:card" content="summary_large_image"><link rel="canonical" href="${xesc(canon)}"><script>history.replaceState(null,'','/?shop='+${JSON.stringify(encodeURIComponent(u.slug))}+(location.search?'&'+location.search.slice(1):''))</script>`;
  return new HTMLRewriter()
    .on('title', { element(e) { e.setInnerContent(title); } })
    .on('meta[name="description"]', { element(e) { e.setAttribute('content', desc); } })
    .on('head', { element(e) { e.append(tags, { html: true }); } })
    .transform(res);
}

// Security headers on every HTML page. Shop pages opened with ?embed=1 may be framed by sellers' own sites.
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' https://cloudflareinsights.com; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'";
function secure(res, url) {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('text/html')) return res;
  const r = new Response(res.body, res);
  const embed = url.searchParams.get('embed') === '1';
  r.headers.set('Content-Security-Policy', CSP + (embed ? '' : "; frame-ancestors 'none'"));
  if (!embed) r.headers.set('X-Frame-Options', 'DENY');
  r.headers.set('Strict-Transport-Security', 'max-age=31536000');
  r.headers.set('X-Content-Type-Options', 'nosniff');
  r.headers.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self)');
  return r;
}
export default {
  async fetch(req, env, ctx) {
    return secure(await route(req, env, ctx), new URL(req.url));
  },
};
async function route(req, env, ctx) {
  {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/media/') && req.method === 'GET') return serveMedia(req, env, url, ctx);
    if (req.method === 'GET' && url.pathname === '/robots.txt') return new Response(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /media/\n\nSitemap: ${url.origin}/sitemap.xml\n`, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
    if (req.method === 'GET' && url.pathname === '/sitemap.xml') return shopSitemap(env, url);
    const sm = req.method === 'GET' && url.pathname.match(/^\/s\/([a-z0-9-]{1,40})\/?$/);
    if (sm) return shopPage(req, env, url, sm[1]);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    const corsPath = /^\/api\/(shop|track|v1|stores)(\/|$)/.test(url.pathname);
    if (req.method === 'OPTIONS') return new Response(null, { status: corsPath ? 204 : 405, headers: corsPath ? CORS : {} });
    const res = await handle(req, env, url, ctx);
    if (corsPath) for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
    return res;
  }
}

async function handle(req, env, url, ctx) {
    try {
      const route = routes.find(r => r.method === req.method && r.re.test(url.pathname));
      if (!route) fail(404, 'Route inconnue');
      const params = url.pathname.match(route.re).groups || {};
      let body = {};
      if (['POST', 'PATCH', 'PUT'].includes(req.method) && !route.raw) {
        const text = await req.text();
        if (text.length > 20000) fail(413, 'Requête trop grande');
        try { body = text ? JSON.parse(text) : {}; } catch { fail(400, 'JSON invalide'); }
      }
      let me;
      if (route.apikey) {
        const m = (req.headers.get('authorization') || '').match(/^Bearer (wsk_[\w-]+)$/);
        me = m ? await env.DB.prepare("SELECT * FROM users WHERE role='seller' AND api_key_hash=?").bind(await sha256(m[1])).first() : null;
        if (!me) fail(401, 'Clé API invalide');
      } else {
        me = await currentUser(req, env);
        if (!route.public && !me) fail(401, 'Session expirée, reconnectez-vous');
        if (me && me.role === 'driver' && !route.driver && !route.public) fail(403, 'Réservé aux vendeurs et clients');
      }
      return await route.handler({ req, env, url, params, body, me, ctx });
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'Erreur serveur' }, 500);
    }
}
