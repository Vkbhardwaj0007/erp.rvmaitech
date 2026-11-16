'use strict';
/* Passwords (scrypt), login sessions (random token in an HttpOnly cookie) and a small login rate limiter. */
const crypto = require('crypto');
const util = require('util');
const scrypt = util.promisify(crypto.scrypt);

const COOKIE = 'suite_sid';
const SESSION_MS = 12 * 60 * 60 * 1000;      // a login lasts 12 hours after the last activity
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(String(pw), salt, 64);
  return 'scrypt$' + salt.toString('hex') + '$' + hash.toString('hex');
}
async function verifyPassword(pw, stored) {
  const parts = String(stored || '').split('$');
  /* Always do the work, so a wrong login ID takes as long as a wrong password. */
  const salt = parts[0] === 'scrypt' && parts[1] ? Buffer.from(parts[1], 'hex') : Buffer.alloc(16);
  const want = parts[0] === 'scrypt' && parts[2] ? Buffer.from(parts[2], 'hex') : Buffer.alloc(64);
  const got = await scrypt(String(pw), salt, 64);
  return parts[0] === 'scrypt' && want.length === got.length && crypto.timingSafeEqual(got, want);
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

class Sessions {
  constructor(file) { this.file = file; this.prune(); }
  get map() { return this.file.data.sessions; }
  create(uid) {
    const token = crypto.randomBytes(32).toString('hex');
    this.map[sha(token)] = { uid, exp: Date.now() + SESSION_MS };
    this.file.save();
    return token;
  }
  /* Returns the user id for a request, or null. Extends the session while it is in use. */
  userId(req) {
    const token = parseCookies(req.headers.cookie)[COOKIE];
    if (!token) return null;
    const s = this.map[sha(token)];
    if (!s) return null;
    const now = Date.now();
    if (s.exp < now) { delete this.map[sha(token)]; this.file.save(); return null; }
    if (s.exp - now < SESSION_MS - 5 * 60 * 1000) { s.exp = now + SESSION_MS; this.file.save(); }
    return s.uid;
  }
  destroy(req) {
    const token = parseCookies(req.headers.cookie)[COOKIE];
    if (token && this.map[sha(token)]) { delete this.map[sha(token)]; this.file.save(); }
  }
  destroyUser(uid) {
    let changed = false;
    for (const k of Object.keys(this.map)) if (this.map[k].uid === uid) { delete this.map[k]; changed = true; }
    if (changed) this.file.save();
  }
  prune() {
    const now = Date.now(); let changed = false;
    for (const k of Object.keys(this.map)) if (this.map[k].exp < now) { delete this.map[k]; changed = true; }
    if (changed) this.file.save();
  }
  cookie(token, secure) { return `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(SESSION_MS / 1000)}${secure ? '; Secure' : ''}`; }
  clearCookie() { return `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`; }
}

/* At most `max` failed tries per key in `windowMs`. */
class Limiter {
  constructor(max, windowMs) { this.max = max; this.windowMs = windowMs; this.hits = new Map(); }
  blocked(key) { const h = this.hits.get(key); return !!h && Date.now() - h.first < this.windowMs && h.count >= this.max; }
  fail(key) {
    const now = Date.now(), h = this.hits.get(key);
    if (!h || now - h.first >= this.windowMs) this.hits.set(key, { first: now, count: 1 }); else h.count++;
    if (this.hits.size > 5000) for (const [k, v] of this.hits) if (now - v.first >= this.windowMs) this.hits.delete(k);
  }
  clear(key) { this.hits.delete(key); }
}

module.exports = { hashPassword, verifyPassword, Sessions, Limiter };
