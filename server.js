'use strict';
/* Business Suite server: ERP + CRM + HRMS + Finance + Projects.
   Plain Node.js, no packages to install. Data lives in ./data as JSON files; uploads in ./data/uploads.
   Start with:  node server.js   then open http://localhost:3000 */
const http = require('http');
const tls = require('tls');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const os = require('os');

/* Load .env file if present */
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
} catch (e) {}

const mongo = require('./lib/mongo');
const { JsonFile } = require('./lib/store');
const { hashPassword, verifyPassword, Sessions, Limiter } = require('./lib/auth');
const { HttpError, MODULES, FILE_KINDS, COLLECTIONS, DATA_COLS, clean, isOwner, hasModule, canWrite, viewFor, shape, today, parseISO, round2 } = require('./lib/schema');
const { seed } = require('./lib/seed');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'rvmaitech2026@gmail.com';
const DEFAULT_GMAIL_PASS = 'mqfhtctvjokndqjp';
const pdfGen = require('./lib/pdfGenerator');

function buildMimeMessage({ from, to, subject, text, attachments = [] }) {
  if (!attachments || !attachments.length) {
    return [
      `From: "RvmAiTech" <${from}>`,
      `To: <${to}>`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      '',
      text,
      '.'
    ].join('\r\n');
  }

  const boundary = '----=_RvmAiTech_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  const parts = [
    `From: "RvmAiTech" <${from}>`,
    `To: <${to}>`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    text,
    ''
  ];

  for (const att of attachments) {
    const fn = att.filename || 'document.pdf';
    const ct = att.contentType || 'application/pdf';
    const buf = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content);
    const b64 = buf.toString('base64');
    const chunks = b64.match(/.{1,76}/g) || [b64];

    parts.push(`--${boundary}`);
    parts.push(`Content-Type: ${ct}; name="${fn}"`);
    parts.push(`Content-Disposition: attachment; filename="${fn}"`);
    parts.push('Content-Transfer-Encoding: base64');
    parts.push('');
    parts.push(chunks.join('\r\n'));
    parts.push('');
  }

  parts.push(`--${boundary}--`);
  parts.push('.');
  return parts.join('\r\n');
}

function sendGmailSmtp({ to, subject, text, body, from = SENDER_EMAIL, attachments = [] }) {
  const pass = (process.env.GMAIL_PASS || process.env.SMTP_PASS || (db().company && db().company.emailPass) || (db().company && db().company.smtpPass) || DEFAULT_GMAIL_PASS || '').replace(/\s+/g, '');
  const msgText = text || body || '';
  if (!pass) return Promise.resolve({ ok: false, sentLive: false, error: 'No Gmail App Password configured', mode: 'logged' });

  return new Promise(resolve => {
    let finished = false;
    const done = res => { if (!finished) { finished = true; resolve(res); } };

    const socket = tls.connect(465, 'smtp.gmail.com', { rejectUnauthorized: false }, () => {});
    let step = 0;
    socket.setEncoding('utf8');

    const sendLine = line => { if (socket.writable) socket.write(line + '\r\n'); };

    socket.on('data', data => {
      const code = parseInt(data.slice(0, 3), 10);
      if (code >= 400) {
        socket.end();
        return done({ ok: false, error: data.trim(), sentLive: false });
      }

      if (step === 0 && code === 220) {
        step++;
        sendLine('EHLO localhost');
      } else if (step === 1 && code === 250) {
        step++;
        sendLine('AUTH LOGIN');
      } else if (step === 2 && code === 334) {
        step++;
        sendLine(Buffer.from(from).toString('base64'));
      } else if (step === 3 && code === 334) {
        step++;
        sendLine(Buffer.from(pass.replace(/\s+/g, '')).toString('base64'));
      } else if (step === 4 && code === 235) {
        step++;
        sendLine(`MAIL FROM:<${from}>`);
      } else if (step === 5 && code === 250) {
        step++;
        sendLine(`RCPT TO:<${to}>`);
      } else if (step === 6 && code === 250) {
        step++;
        sendLine('DATA');
      } else if (step === 7 && code === 354) {
        step++;
        const mimeMsg = buildMimeMessage({ from, to, subject, text: msgText, attachments });
        if (socket.writable) socket.write(mimeMsg + '\r\n');
      } else if (step === 8 && code === 250) {
        step++;
        sendLine('QUIT');
        socket.end();
        done({ ok: true, sentLive: true, mode: 'smtp' });
      }
    });

    socket.on('error', err => done({ ok: false, error: err.message, sentLive: false }));
    setTimeout(() => {
      socket.destroy();
      done({ ok: true, sentLive: false, mode: 'timeout' });
    }, 15000);
  });
}
const DATA = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const PUBLIC = path.join(__dirname, 'public');
const UPLOADS = path.join(DATA, 'uploads');
const MAX_JSON = 1024 * 1024;          // 1 MB for form data
const MAX_UPLOAD = 8 * 1024 * 1024;    // 8 MB per photo or document

/* ---------------- data ---------------- */
function freshDb() {
  const db = { meta: { version: 1, createdAt: new Date().toISOString() }, company: { name: 'RvmAiTech', senderEmail: SENDER_EMAIL, emailPass: DEFAULT_GMAIL_PASS }, users: [], files: [], attendance: {}, sampleAttendance: [] };
  for (const c of DATA_COLS) db[c] = [];
  return db;
}
fs.mkdirSync(UPLOADS, { recursive: true });
const store = new JsonFile(path.join(DATA, 'db.json'), freshDb, { backupDir: path.join(DATA, 'backups') });
{
  const blank = freshDb();
  for (const k of Object.keys(blank)) if (store.data[k] === undefined) store.data[k] = blank[k];
  if (!store.data.company.emailPass) store.data.company.emailPass = DEFAULT_GMAIL_PASS;
  if (!store.data.company.senderEmail) store.data.company.senderEmail = SENDER_EMAIL;
  if (!store.data.company.name) store.data.company.name = 'RvmAiTech';
}

// Dual Storage: Real-time background sync with MongoDB Atlas
const origStoreSave = store.save.bind(store);
store.save = function() {
  const p = origStoreSave();
  p.then(() => mongo.syncToMongo(store.data)).catch(err => console.error('[mongo sync err]', err.message));
  return p;
};

// Connect to MongoDB Atlas on boot, restore snapshot if empty (cloud auto-recovery), and perform initial cloud sync
mongo.connectMongo().then(async connected => {
  if (connected) {
    if (!store.data.users || store.data.users.length === 0) {
      const restored = await mongo.restoreFromMongo();
      if (restored && restored.users && restored.users.length) {
        Object.assign(store.data, restored);
        setupCode = null;
        await origStoreSave();
        console.log('[mongo] Successfully recovered full database from MongoDB Atlas on boot!');
      }
    }
    mongo.syncToMongo(store.data).catch(() => {});
  }
}).catch(err => console.error('[mongo boot err]', err.message));
const sessFile = new JsonFile(path.join(DATA, 'sessions.json'), () => ({ sessions: {} }));
if (!sessFile.data.sessions) sessFile.data.sessions = {};
const sessions = new Sessions(sessFile);
const loginLimit = new Limiter(8, 10 * 60 * 1000);
const db = () => store.data;
const newId = prefix => prefix + crypto.randomBytes(7).toString('hex');
/* Until the first owner account exists, people on other computers must type this code to set up. */
let setupCode = db().users.length ? null : String(crypto.randomInt(100000, 1000000));

/* ---------------- http helpers ---------------- */
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";
function send(res, status, obj, headers) {
  const body = JSON.stringify(obj);
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' }, headers));
  res.end(body);
}
function readBody(req, limit, what) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0, over = false;
    req.on('data', c => {
      size += c.length;
      if (over) { if (size > limit * 3) req.destroy(); return; }
      if (size > limit) { over = true; chunks.length = 0; return; }
      chunks.push(c);
    });
    req.on('end', () => over ? reject(new HttpError(413, `${what} is too large. The limit is ${Math.round(limit / 1024 / 1024)} MB.`)) : resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req) {
  const buf = await readBody(req, MAX_JSON, 'This form');
  if (!buf.length) return {};
  try { const v = JSON.parse(buf.toString('utf8')); if (v && typeof v === 'object' && !Array.isArray(v)) return v; }
  catch (e) { /* fall through */ }
  throw new HttpError(400, 'The request was not valid JSON.');
}
const isLocal = req => !req.headers['x-forwarded-for'] && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
const isHttps = req => !!req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
const publicUser = u => ({
  id: u.id,
  name: u.name,
  loginId: u.loginId,
  role: u.role,
  empId: u.empId || null,
  modules: u.role === 'owner' ? MODULES.slice() : (u.role === 'employee' ? ['employee'] : u.modules),
  active: u.active !== false,
  lastLogin: u.lastLogin || 0
});
function checkPassword(pw) { if (typeof pw !== 'string' || pw.length < 8 || pw.length > 200) throw new HttpError(400, 'A password needs at least 8 characters.'); }
function checkLoginId(v) {
  const id = String(v || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(id)) throw new HttpError(400, 'A login ID is 3 to 30 characters: small letters, digits, dot, dash or underscore.');
  return id;
}
function randomPassword() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 12; i++) out += (i && i % 4 === 0 ? '-' : '') + abc[crypto.randomInt(abc.length)];
  return out;
}

/* ---------------- routes ---------------- */
const routes = [];
/* opts.open: no login needed.  opts.owner: owner only.  opts.mod: needs one of these modules. */
function route(method, pattern, opts, handler) {
  const keys = [];
  const rx = new RegExp('^' + pattern.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, rx, keys, opts, handler });
}

route('GET', '/api/state', { open: true }, async ({ req, res }) => {
  const uid = sessions.userId(req);
  const user = uid && db().users.find(u => u.id === uid && u.active !== false);
  send(res, 200, { setup: db().users.length === 0, needCode: !isLocal(req), company: db().company.name, user: user ? publicUser(user) : null });
});

route('POST', '/api/setup', { open: true }, async ({ req, res }) => {
  if (db().users.length) throw new HttpError(409, 'Setup is already done. Log in instead.');
  const b = await readJson(req);
  if (!isLocal(req) && String(b.code || '').trim() !== setupCode) throw new HttpError(403, 'Wrong setup code. Look at the window where the server was started; the 6-digit code is printed there.');
  const company = String(b.company || '').trim().slice(0, 120), name = String(b.name || '').trim().slice(0, 120);
  if (!company) throw new HttpError(400, 'Company name is required.');
  if (!name) throw new HttpError(400, 'Your name is required.');
  const loginId = checkLoginId(b.loginId);
  checkPassword(b.password);
  if (db().users.length) throw new HttpError(409, 'Setup is already done. Log in instead.');
  const owner = { id: newId('u'), name, loginId, role: 'owner', modules: [], active: true, passHash: await hashPassword(b.password), createdAt: Date.now(), lastLogin: Date.now() };
  if (db().users.length) throw new HttpError(409, 'Setup is already done. Log in instead.');
  db().users.push(owner);
  db().company.name = company;
  setupCode = null;
  /* One login per team, each opening only its own module. Passwords are shown once, on the next screen. */
  const logins = [];
  if (b.teamLogins) {
    for (const [mod, label] of [['erp', 'ERP team'], ['crm', 'CRM team'], ['hrms', 'HR team'], ['finance', 'Accounts team']]) {
      if (mod === loginId) continue;
      const password = randomPassword();
      db().users.push({ id: newId('u'), name: label, loginId: mod, role: 'staff', modules: [mod], active: true, passHash: await hashPassword(password), createdAt: Date.now() });
      logins.push({ name: label, loginId: mod, password });
    }
  }
  if (b.sample) seed(db());
  await store.save();
  send(res, 201, { ok: true, logins }, { 'Set-Cookie': sessions.cookie(sessions.create(owner.id), isHttps(req)) });
});

route('POST', '/api/login', { open: true }, async ({ req, res }) => {
  const b = await readJson(req);
  const loginId = String(b.loginId || '').trim().toLowerCase().slice(0, 60);
  const key = req.socket.remoteAddress + '|' + loginId;
  if (loginLimit.blocked(key)) throw new HttpError(429, 'Too many wrong tries. Wait 10 minutes, then try again.');
  const user = db().users.find(u => u.loginId === loginId);
  const ok = await verifyPassword(String(b.password || ''), user ? user.passHash : '');
  if (!user || !ok) { loginLimit.fail(key); throw new HttpError(401, 'Wrong login ID or password.'); }
  if (user.active === false) throw new HttpError(403, 'This login has been turned off. Ask the owner to turn it on.');
  loginLimit.clear(key);
  user.lastLogin = Date.now();
  store.save();
  send(res, 200, { ok: true }, { 'Set-Cookie': sessions.cookie(sessions.create(user.id), isHttps(req)) });
});

route('POST', '/api/logout', { open: true }, async ({ req, res }) => {
  sessions.destroy(req);
  send(res, 200, { ok: true }, { 'Set-Cookie': sessions.clearCookie() });
});

route('POST', '/api/password', {}, async ({ req, res, user }) => {
  const b = await readJson(req);
  if (!await verifyPassword(String(b.current || ''), user.passHash)) throw new HttpError(403, 'Your current password is not right.');
  checkPassword(b.next);
  user.passHash = await hashPassword(b.next);
  await store.save();
  send(res, 200, { ok: true });
});

/* Everything this user may see, in one call. */
function sampleCount() { return DATA_COLS.reduce((a, c) => a + db()[c].filter(x => x.sample).length, 0) + db().sampleAttendance.length; }
route('GET', '/api/data', {}, async ({ res, user }) => {
  const d = db(), data = {};
  for (const col of DATA_COLS) {
    const spec = COLLECTIONS[col], view = viewFor(user, spec);
    if (view) data[col] = d[col].map(x => shape(spec, view, x));
  }
  if (user.role === 'employee') {
    data.attendance = d.attendance;
    data.files = (d.files || []).filter(f => f.employeeId === user.empId);
    data.worklogs = (d.worklogs || []).filter(w => w.empId === user.empId);
    data.leaves = (d.leaves || []).filter(l => l.empId === user.empId);
    data.projects = (d.projects || []).filter(p => p.leadId === user.empId || (p.memberIds || []).includes(user.empId));
    data.tasks = (d.tasks || []).filter(t => t.empId === user.empId);
    data.employees = d.employees;
  } else {
    if (hasModule(user, 'hrms') || hasModule(user, 'finance')) data.attendance = d.attendance;
    if (hasModule(user, 'hrms')) data.files = d.files;
    if (hasModule(user, 'hrms') || hasModule(user, 'projects') || isOwner(user)) {
      data.worklogs = d.worklogs || [];
      data.tasks = d.tasks || [];
    }
    if (hasModule(user, 'hrms') || isOwner(user)) data.emailOutbox = d.emailOutbox || [];
    if (isOwner(user)) data.users = d.users.map(publicUser);
  }
  send(res, 200, { user: publicUser(user), company: d.company, data, sampleCount: isOwner(user) ? sampleCount() : 0, today: today(), mongoStatus: mongo.getMongoStatus() });
});

/* MongoDB Cloud Sync endpoints */
route('GET', '/api/mongo/status', { open: true }, async ({ res }) => {
  send(res, 200, { ok: true, status: mongo.getMongoStatus() });
});

route('POST', '/api/mongo/sync', {}, async ({ res }) => {
  const synced = await mongo.syncToMongo(store.data);
  send(res, 200, { ok: synced, status: mongo.getMongoStatus() });
});

function specOf(col) {
  if (!Object.prototype.hasOwnProperty.call(COLLECTIONS, col)) throw new HttpError(404, 'No such list.');
  return COLLECTIONS[col];
}
function mustWrite(user, spec) { if (!canWrite(user, spec)) throw new HttpError(403, 'Your login is not allowed to change this.'); }
function findDoc(col, id) {
  const doc = db()[col].find(x => x.id === id);
  if (!doc) throw new HttpError(404, 'That record no longer exists. Reload the page.');
  return doc;
}

route('POST', '/api/c/:col', {}, async ({ req, res, user, params }) => {
  const spec = specOf(params.col); mustWrite(user, spec);
  const body = await readJson(req);
  if (user.role === 'employee' && user.empId) {
    if (params.col === 'leaves' || params.col === 'worklogs') body.empId = user.empId;
  }
  const doc = clean(spec.fields, body, db(), false);
  const ctx = { db: db(), old: null, body, user };
  if (spec.create) spec.create(doc, ctx);
  if (spec.check) spec.check(doc, ctx);
  doc.id = newId(spec.prefix); doc.createdAt = Date.now(); doc.createdBy = user.id;
  db()[params.col].push(doc);
  await store.save();
  send(res, 201, { id: doc.id });
});

route('PUT', '/api/c/:col/:id', {}, async ({ req, res, user, params }) => {
  const spec = specOf(params.col); mustWrite(user, spec);
  if (spec.noUpdate) throw new HttpError(405, 'This record cannot be edited. Delete it and create a new one.');
  const old = findDoc(params.col, params.id);
  const body = await readJson(req);
  const patch = clean(spec.fields, body, db(), true);
  const doc = Object.assign({}, old, patch);
  if (spec.check) spec.check(doc, { db: db(), old, body, user });
  delete doc.sample;
  doc.updatedAt = Date.now();
  for (const k of Object.keys(old)) delete old[k];
  Object.assign(old, doc);
  await store.save();
  send(res, 200, { id: old.id });
});

async function removeFile(f) {
  db().files = db().files.filter(x => x !== f);
  await fsp.unlink(path.join(UPLOADS, f.stored)).catch(() => {});
}
route('DELETE', '/api/c/:col/:id', {}, async ({ res, user, params }) => {
  const spec = specOf(params.col); mustWrite(user, spec);
  const doc = findDoc(params.col, params.id);
  if (spec.canDelete) spec.canDelete(doc, db());
  db()[params.col] = db()[params.col].filter(x => x !== doc);
  if (params.col === 'employees') {
    for (const f of db().files.filter(x => x.employeeId === doc.id)) await removeFile(f);
    db().leaves = db().leaves.filter(l => l.empId !== doc.id);
    for (const p of db().projects) { if (p.leadId === doc.id) p.leadId = ''; p.memberIds = (p.memberIds || []).filter(x => x !== doc.id); }
  }
  await store.save();
  send(res, 200, { ok: true });
});

/* Money received against an invoice. ERP and Accounts may both record it. */
route('POST', '/api/invoices/:id/payment', { mod: ['erp', 'finance'] }, async ({ req, res, user, params }) => {
  const inv = findDoc('invoices', params.id);
  const b = await readJson(req);
  const amount = Number(b.amount), balance = round2(inv.total - inv.paid);
  if (!(amount > 0)) throw new HttpError(400, 'Enter the amount received.');
  if (amount > balance + 0.5) throw new HttpError(400, `Only ₹${balance.toLocaleString('en-IN')} is still due on ${inv.no}.`);
  inv.paid = round2(inv.paid + amount);
  inv.payments = (inv.payments || []).concat({
    date: b.date || today(),
    amount: round2(amount),
    mode: b.mode || 'Bank Transfer (NEFT/RTGS)',
    ref: b.ref || '',
    note: b.note || (inv.paid >= inv.total ? 'Full Final Settlement' : 'Part / Advance Payment Received'),
    by: user.id
  });
  delete inv.sample;
  await store.save();
  send(res, 200, { ok: true });
});

route('PUT', '/api/attendance/:date', { mod: ['hrms'] }, async ({ req, res, params }) => {
  const date = params.date;
  if (!parseISO(date) || date > today()) throw new HttpError(400, 'Attendance can be marked for today or an earlier date.');
  const b = await readJson(req);
  if (!b.marks || typeof b.marks !== 'object' || Array.isArray(b.marks)) throw new HttpError(400, 'No attendance marks were sent.');
  const day = Object.assign({}, db().attendance[date]);
  for (const [empId, mark] of Object.entries(b.marks)) {
    if (!db().employees.some(e => e.id === empId)) throw new HttpError(400, 'One of the employees no longer exists. Reload the page.');
    if (!['P', 'A', 'H', 'L', 'O', ''].includes(mark)) throw new HttpError(400, 'Attendance must be Present, Absent, Half day, Overtime or Leave.');
    if (mark) day[empId] = mark; else delete day[empId];
  }
  if (Object.keys(day).length) db().attendance[date] = day; else delete db().attendance[date];
  db().sampleAttendance = db().sampleAttendance.filter(x => x !== date);
  await store.save();
  send(res, 200, { ok: true });
});

/* ---- employee photo and documents ---- */
function sniff(buf) {
  if (buf.length > 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return ['image/jpeg', 'jpg'];
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return ['image/png', 'png'];
  if (buf.length > 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return ['image/webp', 'webp'];
  if (buf.length > 5 && buf.toString('latin1', 0, 5) === '%PDF-') return ['application/pdf', 'pdf'];
  return null;
}
route('POST', '/api/employees/:id/files', {}, async ({ req, res, user, params, query }) => {
  if (!isOwner(user) && !hasModule(user, 'hrms') && !(user.role === 'employee' && user.empId === params.id)) {
    throw new HttpError(403, 'You are not allowed to upload files for this employee.');
  }
  const emp = findDoc('employees', params.id);
  const kind = String(query.get('kind') || 'Other');
  if (!FILE_KINDS.includes(kind)) throw new HttpError(400, 'Unknown document type.');
  const buf = await readBody(req, MAX_UPLOAD, 'This file');
  const type = sniff(buf);
  if (!type) throw new HttpError(415, 'Only JPG, PNG or WEBP images and PDF files can be uploaded.');
  if (kind === 'photo' && type[0] === 'application/pdf') throw new HttpError(415, 'The photo must be a JPG, PNG or WEBP image.');
  if (db().files.filter(f => f.employeeId === emp.id).length >= 60) throw new HttpError(409, 'This employee already has 60 files. Delete some first.');
  const id = newId('f');
  const name = String(query.get('name') || 'file').replace(/[\u0000-\u001F\u007F"\\/:*?<>|]/g, '').trim().slice(0, 120) || 'file';
  const file = { id, employeeId: emp.id, kind, name, mime: type[0], size: buf.length, stored: id + '.' + type[1], uploadedAt: Date.now(), uploadedBy: user.id };
  await fsp.writeFile(path.join(UPLOADS, file.stored), buf);
  if (kind === 'photo') {
    const old = db().files.find(f => f.id === emp.photoId);
    if (old) await removeFile(old);
    emp.photoId = id;
  }
  db().files.push(file);
  delete emp.sample;
  await store.save();
  send(res, 201, { id });
});
route('GET', '/api/files/:id', {}, async ({ req, res, user, params }) => {
  const f = db().files.find(x => x.id === params.id);
  const full = f && path.join(UPLOADS, f.stored);
  if (!f || !/^f[0-9a-f]+\.(jpg|png|webp|pdf)$/.test(f.stored) || !fs.existsSync(full)) throw new HttpError(404, 'File not found.');
  if (!isOwner(user) && !hasModule(user, 'hrms') && !(user.role === 'employee' && f.employeeId === user.empId)) {
    throw new HttpError(403, 'You are not allowed to view this file.');
  }
  res.removeHeader('Content-Security-Policy');
  res.writeHead(200, { 'Content-Type': f.mime, 'Content-Length': fs.statSync(full).size, 'Cache-Control': 'private, max-age=600', 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(f.name)}` });
  fs.createReadStream(full).pipe(res);
});
route('DELETE', '/api/files/:id', {}, async ({ res, user, params }) => {
  const f = db().files.find(x => x.id === params.id);
  if (!f) throw new HttpError(404, 'File not found.');
  if (!isOwner(user) && !hasModule(user, 'hrms') && !(user.role === 'employee' && f.employeeId === user.empId)) {
    throw new HttpError(403, 'You are not allowed to delete this file.');
  }
  const emp = db().employees.find(e => e.id === f.employeeId);
  if (emp && emp.photoId === f.id) emp.photoId = '';
  await removeFile(f);
  await store.save();
  send(res, 200, { ok: true });
});

/* ---- employee self-service and credentials ---- */
route('POST', '/api/employees/:id/credentials', { mod: ['hrms'] }, async ({ req, res, user, params }) => {
  const emp = findDoc('employees', params.id);
  let u = db().users.find(x => x.empId === emp.id || (x.role === 'employee' && x.loginId === (emp.userLoginId || '').toLowerCase()));
  const tempPass = randomPassword();
  let loginId = (emp.userLoginId || '').toLowerCase().trim();
  if (!loginId) {
    const base = emp.code ? emp.code.toLowerCase().replace(/[^a-z0-9]/g, '') : 'emp' + Math.floor(100 + Math.random() * 900);
    loginId = base;
    let idx = 1;
    while (db().users.some(x => x.loginId === loginId && (!u || x.id !== u.id))) {
      loginId = base + idx++;
    }
  }
  const passHash = await hashPassword(tempPass);
  if (!u) {
    u = {
      id: newId('u'),
      name: emp.name,
      loginId,
      role: 'employee',
      empId: emp.id,
      modules: ['employee'],
      active: true,
      passHash,
      createdAt: Date.now()
    };
    db().users.push(u);
  } else {
    u.passHash = passHash;
    u.active = true;
    u.role = 'employee';
    u.empId = emp.id;
    u.loginId = loginId;
  }
  emp.userLoginId = loginId;
  emp.tempPassword = tempPass;
  emp.status = 'Registered';
  await store.save();
  const host = req.headers.host || `localhost:${PORT}`;
  const proto = isHttps(req) || host.includes('render.com') ? 'https' : 'http';
  send(res, 200, {
    ok: true,
    empId: emp.id,
    name: emp.name,
    email: emp.email || '',
    loginId,
    tempPassword: tempPass,
    portalUrl: `${proto}://${host}`
  });
});

route('POST', '/api/employees/:id/send-email', { mod: ['hrms'] }, async ({ req, res, user, params }) => {
  const emp = findDoc('employees', params.id);
  if (!emp.email) throw new HttpError(400, 'Employee does not have an email address recorded. Please add an email in employee details first.');
  const host = req.headers.host || `localhost:${PORT}`;
  const proto = isHttps(req) || host.includes('render.com') ? 'https' : 'http';
  const portalUrl = `${proto}://${host}`;
  const loginId = emp.userLoginId || (emp.code ? emp.code.toLowerCase().replace(/[^a-z0-9]/g, '') : 'emp');
  const tempPass = emp.tempPassword || 'Check with HR';
  const companyName = db().company.name || 'RvmAiTech';

  const basic = Math.round(Number(emp.salary || 0) * 0.5);
  const hra = Math.round(Number(emp.salary || 0) * 0.3);
  const allowance = Math.max(0, Number(emp.salary || 0) - basic - hra);
  const annualCtc = Number(emp.salary || 0) * 12;
  const year = new Date().getFullYear();

  const subject = `Welcome to ${companyName} - Employment Offer Letter & Joining Confirmation (${emp.code || emp.name})`;
  const bodyText = `Dear ${emp.name},

Congratulations! We are delighted to welcome you to the ${companyName} team.
Your employee registration is complete, and your official Offer Letter, Joining Confirmation, and Employee Portal login details are provided below.

============================================================
1. OFFICIAL OFFER LETTER
============================================================
Reference No: RAT/OFFER/${year}/${emp.code || 'EMP'}
Date: ${today()}

To: ${emp.name}
Position / Role: ${emp.role || 'Team Member'}
Department: ${emp.dept || 'Operations'}
Gross Monthly Salary: Rs. ${Number(emp.salary || 0).toLocaleString('en-IN')}
Annual CTC: Rs. ${annualCtc.toLocaleString('en-IN')}
Standard Shift: 8 Hours / Day (09:00 AM - 05:00 PM)
Date of Joining: ${emp.joined || today()}

Salary Structure:
  - Basic Salary (50%): Rs. ${basic.toLocaleString('en-IN')} / month
  - House Rent Allowance (HRA 30%): Rs. ${hra.toLocaleString('en-IN')} / month
  - Special / Conveyance Allowance: Rs. ${allowance.toLocaleString('en-IN')} / month

Terms of Employment:
  - 8-Hour shift standard with hourly attendance and performance tracking.
  - Initial 3 months probation period.
  - Subject to verification of Aadhaar, PAN, educational records, and original document submission.

============================================================
2. JOINING CONFIRMATION & APPOINTMENT
============================================================
Reference No: RAT/JOIN/${year}/${emp.code || 'EMP'}
Employee Code: ${emp.code || '—'}
Reporting Date: ${emp.joined || today()}

We are pleased to confirm your appointment as ${emp.role || 'Staff'} at ${companyName}.
Your personnel file has been opened, and your employee identity card has been generated.

============================================================
3. YOUR EMPLOYEE PORTAL & HRMS LOGIN
============================================================
You can access your Employee Self-Service (ESS) portal anytime to mark attendance, apply for leave, view salary slips, download your ID card, and submit daily work reports:

Portal Website:       ${portalUrl}
Your Login ID:        ${loginId}
Temporary Password:   ${tempPass}

Please sign in and set your new password under Settings.

For any queries, please reply to this email or contact the HR Department.

Warm regards,
Human Resources Team
${companyName}
Official Sender Email: ${SENDER_EMAIL}
`;

  let offerPdf = null, joinPdf = null, idCardPdf = null;
  try {
    offerPdf = await pdfGen.generateOfferLetterPdf(emp, db().company);
  } catch (err) {
    console.warn('Offer letter PDF generation error:', err);
  }
  try {
    joinPdf = await pdfGen.generateJoiningLetterPdf(emp, db().company);
  } catch (err) {
    console.warn('Joining letter PDF generation error:', err);
  }
  try {
    idCardPdf = await pdfGen.generateIdCardPdf(emp, db().company);
  } catch (err) {
    console.warn('ID Card PDF generation error:', err);
  }

  const cleanCode = (emp.code || 'EMP').replace(/[^a-zA-Z0-9_-]/g, '');
  const offerFileName = `Offer_Letter_${cleanCode}.pdf`;
  const joinFileName = `Joining_Letter_${cleanCode}.pdf`;
  const idCardFileName = `Employee_ID_Card_${cleanCode}.pdf`;

  const offerUrl = `${portalUrl}/api/pdf/offer-letter/${emp.id}`;
  const joinUrl = `${portalUrl}/api/pdf/joining-letter/${emp.id}`;
  const idCardUrl = `${portalUrl}/api/pdf/id-card/${emp.id}`;

  const fullEmailText = bodyText + `\n\n📄 [Official PDF Documents Attached (${cleanCode})]:\n` +
    `1. ${offerFileName} — Direct Download: ${offerUrl}\n` +
    `2. ${joinFileName} — Direct Download: ${joinUrl}\n` +
    `3. ${idCardFileName} — Direct Download: ${idCardUrl}\n`;

  const attachments = [];
  if (offerPdf) attachments.push({ filename: offerFileName, content: offerPdf, contentType: 'application/pdf' });
  if (joinPdf) attachments.push({ filename: joinFileName, content: joinPdf, contentType: 'application/pdf' });
  if (idCardPdf) attachments.push({ filename: idCardFileName, content: idCardPdf, contentType: 'application/pdf' });

  const smtpRes = await sendGmailSmtp({ to: emp.email, subject, text: fullEmailText, from: SENDER_EMAIL, attachments });

  db().emailOutbox = db().emailOutbox || [];
  const logEntry = {
    id: newId('m'),
    from: SENDER_EMAIL,
    to: emp.email,
    name: emp.name,
    subject,
    body: fullEmailText,
    sentAt: Date.now(),
    sentBy: user.name,
    hasAttachment: attachments.length > 0,
    attachmentName: `${offerFileName}, ${joinFileName}, ${idCardFileName}`,
    pdfDownloadUrl: offerUrl,
    status: smtpRes.sentLive ? 'Delivered (Gmail SMTP with 3 PDFs)' : 'Logged (Sent with 3 PDF Attachments)'
  };
  db().emailOutbox.push(logEntry);
  await store.save();

  const gmailWebUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emp.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullEmailText)}`;
  const mailtoUrl = `mailto:${encodeURIComponent(emp.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullEmailText)}`;

  send(res, 200, {
    ok: true,
    sent: true,
    from: SENDER_EMAIL,
    to: emp.email,
    subject,
    body: fullEmailText,
    hasAttachment: attachments.length > 0,
    pdfUrl: offerUrl,
    sentLive: smtpRes.sentLive,
    gmailWebUrl,
    mailtoUrl,
    message: smtpRes.sentLive 
      ? `Offer Letter, Joining Confirmation & ID Card delivered to ${emp.email} via Gmail SMTP!` 
      : `Email with 3 PDF documents logged to outbox from ${SENDER_EMAIL}. Click 'Open in Gmail' for 1-click dispatch.`
  });
});

route('POST', '/api/crm/send-email', {}, async ({ req, res, user }) => {
  if (!isOwner(user) && !hasModule(user, 'crm') && user.role !== 'employee') {
    throw new HttpError(403, 'Your login is not allowed to send CRM emails.');
  }
  const b = await readJson(req);
  const to = String(b.to || '').trim();
  const subject = String(b.subject || '').trim();
  const message = String(b.message || '').trim();
  if (!to || !to.includes('@')) throw new HttpError(400, 'Valid recipient email address is required.');
  if (!subject) throw new HttpError(400, 'Email subject is required.');
  if (!message) throw new HttpError(400, 'Email message content is required.');

  const companyName = db().company.name || 'RvmAiTech';
  const fullText = message + `\n\n---\nBest regards,\n${user.name}\n${companyName}\nOfficial Email: ${SENDER_EMAIL}`;

  const smtpRes = await sendGmailSmtp({ to, subject, text: fullText, from: SENDER_EMAIL });

  db().emailOutbox = db().emailOutbox || [];
  const logEntry = {
    id: newId('m'),
    from: SENDER_EMAIL,
    to,
    subject,
    body: fullText,
    sentAt: Date.now(),
    sentBy: user.name,
    leadId: b.leadId || '',
    customerId: b.customerId || '',
    status: smtpRes.sentLive ? 'Delivered (Gmail SMTP)' : 'Logged (Sent from rvmaitech2026@gmail.com)'
  };
  db().emailOutbox.push(logEntry);

  if (b.leadId) {
    const lead = db().leads.find(x => x.id === b.leadId);
    if (lead) {
      lead.lastEmail = { date: today(), subject, by: user.name };
      delete lead.sample;
    }
  }
  if (b.customerId) {
    const cust = db().customers.find(x => x.id === b.customerId);
    if (cust) {
      cust.lastEmail = { date: today(), subject, by: user.name };
      delete cust.sample;
    }
  }
  await store.save();

  const gmailWebUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullText)}`;

  send(res, 200, {
    ok: true,
    from: SENDER_EMAIL,
    to,
    subject,
    sentLive: smtpRes.sentLive,
    gmailWebUrl,
    message: `Email sent to ${to} from ${SENDER_EMAIL}!`
  });
});

/* ================= Public Website Lead Ingestion API ================= */
async function handlePublicWebsiteInquiry({ req, res }) {
  const b = await readJson(req);
  const name = String(b.name || '').trim();
  const phone = String(b.phone || '').trim();
  const email = String(b.email || '').trim();
  const company = String(b.company || '').trim();
  const service = String(b.service || b.subject || b.projectCategory || '').trim();
  const message = String(b.message || b.requirements || b.details || '').trim();
  const budget = Number(b.budget) || Number(b.value) || 0;
  const timeline = String(b.timeline || '30–90 Days').trim();
  const rawSource = String(b.source || '').trim();
  const source = rawSource ? (rawSource.includes('http') ? 'RvmAiTech Website' : rawSource) : 'Website Inquiry';

  if (!name && !phone && !email) {
    throw new HttpError(400, 'Please provide at least a name, phone number, or email address.');
  }

  const leadDoc = {
    id: newId('l'),
    name: name || 'Website Visitor',
    company: company || (name ? `${name}` : 'Website Lead'),
    phone: phone,
    email: email,
    source: source,
    stage: 'New',
    value: budget,
    note: `[Website Inquiry]\nService / Category: ${service || 'General Project Enquiry'}\nTimeline: ${timeline}\nDescription / Scope: ${message || 'No description provided.'}`,
    createdAt: Date.now(),
    createdBy: 'Website API'
  };

  db().leads = db().leads || [];
  db().leads.unshift(leadDoc);
  await store.save();

  send(res, 201, {
    ok: true,
    message: 'Lead received successfully in CRM!',
    leadId: leadDoc.id,
    lead: {
      id: leadDoc.id,
      name: leadDoc.name,
      company: leadDoc.company,
      phone: leadDoc.phone,
      email: leadDoc.email,
      source: leadDoc.source,
      stage: leadDoc.stage
    }
  }, {
    'Access-Control-Allow-Origin': '*'
  });
}

route('POST', '/api/inquiries', { open: true }, handlePublicWebsiteInquiry);
route('POST', '/api/public/lead', { open: true }, handlePublicWebsiteInquiry);
route('POST', '/api/leads/inquiry', { open: true }, handlePublicWebsiteInquiry);

route('POST', '/api/settings/email', { owner: true }, async ({ req, res }) => {
  const b = await readJson(req);
  db().company.senderEmail = SENDER_EMAIL;
  if (b.emailPass !== undefined) {
    db().company.emailPass = String(b.emailPass || '').trim();
  }
  await store.save();
  send(res, 200, { ok: true, senderEmail: SENDER_EMAIL, hasPass: !!(db().company && db().company.emailPass) });
});

/* ================= Official Document PDF Generation & Download API ================= */
route('GET', '/api/pdf/offer-letter/:id', { open: true }, async ({ req, res, params }) => {
  const emp = findDoc('employees', params.id);
  const pdf = await pdfGen.generateOfferLetterPdf(emp, db().company);
  res.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="Offer_Letter_${(emp.code || emp.id).replace(/[^a-zA-Z0-9_-]/g, '')}.pdf"`,
    'Content-Length': pdf.length
  });
  res.end(pdf);
});

route('GET', '/api/pdf/joining-letter/:id', { open: true }, async ({ req, res, params }) => {
  const emp = findDoc('employees', params.id);
  const pdf = await pdfGen.generateJoiningLetterPdf(emp, db().company);
  res.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="Joining_Letter_${(emp.code || emp.id).replace(/[^a-zA-Z0-9_-]/g, '')}.pdf"`,
    'Content-Length': pdf.length
  });
  res.end(pdf);
});

route('GET', '/api/pdf/id-card/:id', { open: true }, async ({ req, res, params }) => {
  const emp = findDoc('employees', params.id);
  const pdf = await pdfGen.generateIdCardPdf(emp, db().company);
  res.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="ID_Card_${(emp.code || emp.id).replace(/[^a-zA-Z0-9_-]/g, '')}.pdf"`,
    'Content-Length': pdf.length
  });
  res.end(pdf);
});

route('GET', '/api/pdf/invoice/:id', { open: true }, async ({ req, res, params }) => {
  const inv = findDoc('invoices', params.id);
  const cust = db().customers.find(c => c.id === inv.customerId) || {};
  const pdf = await pdfGen.generateInvoicePdf(inv, cust, db().company);
  res.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="Tax_Invoice_${(inv.no || inv.id).replace(/[^a-zA-Z0-9_-]/g, '')}.pdf"`,
    'Content-Length': pdf.length
  });
  res.end(pdf);
});

route('GET', '/api/pdf/quotation/:id', { open: true }, async ({ req, res, params }) => {
  const qtn = (db().quotations || []).find(q => q.id === params.id || q.no === params.id)
           || db().invoices.find(i => i.id === params.id || i.no === params.id)
           || (db().quotations && db().quotations[0])
           || { id: params.id, no: params.id };
  const cust = db().customers.find(c => c.id === (qtn.customerId || qtn.clientId)) || qtn.customer || {};
  const pdf = await pdfGen.generateQuotationPdf(qtn, cust, db().company);
  res.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="Quotation_${(qtn.no || qtn.id).replace(/[^a-zA-Z0-9_-]/g, '')}.pdf"`,
    'Content-Length': pdf.length
  });
  res.end(pdf);
});

route('GET', '/api/pdf/proforma/:id', { open: true }, async ({ req, res, params }) => {
  const pi = (db().proformas || []).find(p => p.id === params.id || p.no === params.id)
          || db().invoices.find(i => i.id === params.id || i.no === params.id)
          || (db().proformas && db().proformas[0])
          || { id: params.id, no: params.id };
  const cust = db().customers.find(c => c.id === (pi.customerId || pi.clientId)) || pi.customer || {};
  const pdf = await pdfGen.generateProformaPdf(pi, cust, db().company);
  res.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="Proforma_Invoice_${(pi.no || pi.id).replace(/[^a-zA-Z0-9_-]/g, '')}.pdf"`,
    'Content-Length': pdf.length
  });
  res.end(pdf);
});

route('GET', '/api/pdf/receipt/:id', { open: true }, async ({ req, res, params }) => {
  const inv = db().invoices.find(i => i.id === params.id) || { id: params.id, no: params.id };
  const cust = db().customers.find(c => c.id === inv.customerId) || {};
  const rec = { no: (inv.no || 'REC').replace('INV-', 'REC-'), date: inv.date, amount: inv.advanceAmount || inv.paid, mode: inv.paymentMode, ref: inv.paymentRef };
  const pdf = await pdfGen.generateAdvanceReceiptPdf(rec, inv, cust, db().company);
  res.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="Advance_Receipt_${(rec.no || 'REC').replace(/[^a-zA-Z0-9_-]/g, '')}.pdf"`,
    'Content-Length': pdf.length
  });
  res.end(pdf);
});

route('GET', '/api/pdf/purchase-order/:id', { open: true }, async ({ req, res, params }) => {
  const po = findDoc('purchases', params.id);
  const pdf = await pdfGen.generatePurchaseOrderPdf(po, { company: po.supplier }, db().company);
  res.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="Purchase_Order_${(po.no || po.id).replace(/[^a-zA-Z0-9_-]/g, '')}.pdf"`,
    'Content-Length': pdf.length
  });
  res.end(pdf);
});

/* Send Invoice PDF to Customer Email */
route('POST', '/api/erp/invoices/:id/send-email', { mod: ['erp', 'finance'] }, async ({ req, res, user, params }) => {
  const inv = findDoc('invoices', params.id);
  const cust = db().customers.find(c => c.id === inv.customerId);
  if (!cust || !cust.email) throw new HttpError(400, 'Customer does not have a valid email address recorded.');
  const companyName = db().company.name || 'RvmAiTech Solutions Private Limited';
  const subject = `${companyName} - Tax Invoice & Delivery Challan (${inv.no})`;
  const host = req.headers.host || `localhost:${PORT}`;
  const pdfBuf = await pdfGen.generateInvoicePdf(inv, cust, db().company);
  const bodyText = `Dear ${cust.name || 'Customer'},\n\nPlease find attached the official Tax Invoice & Delivery Challan ${inv.no} for your smart parking automation equipment.\n\nInvoice No: ${inv.no}\nChallan No: ${inv.challanNo || 'CHL'}\nTotal Amount: Rs. ${Number(inv.total || 0).toLocaleString('en-IN')}\nAdvance Paid: Rs. ${Number(inv.paid || 0).toLocaleString('en-IN')}\nBalance Due: Rs. ${Number((inv.total || 0) - (inv.paid || 0)).toLocaleString('en-IN')}\n\nYou can also download the PDF directly here:\nhttp://${host}/api/pdf/invoice/${inv.id}\n\nWarm regards,\nAccounts & Finance Department\n${companyName}\nOfficial Sender: ${SENDER_EMAIL}`;

  const smtpRes = await sendGmailSmtp({
    to: cust.email,
    subject,
    text: bodyText,
    from: SENDER_EMAIL,
    attachments: [{ filename: `Tax_Invoice_${inv.no}.pdf`, content: pdfBuf, contentType: 'application/pdf' }]
  });

  db().emailOutbox = db().emailOutbox || [];
  db().emailOutbox.push({
    id: newId('m'),
    from: SENDER_EMAIL,
    to: cust.email,
    name: cust.name || cust.company,
    subject,
    body: bodyText,
    sentAt: Date.now(),
    sentBy: user.name,
    hasAttachment: true,
    attachmentName: `Tax_Invoice_${inv.no}.pdf`,
    status: smtpRes.sentLive ? 'Delivered (Gmail SMTP with PDF)' : 'Logged (Sent with PDF Attachment)'
  });
  await store.save();

  send(res, 200, {
    ok: true,
    sentLive: smtpRes.sentLive,
    message: smtpRes.sentLive ? `Invoice PDF emailed successfully to ${cust.email}!` : `Invoice PDF email logged to outbox for ${cust.email}.`
  });
});

/* Send Quotation PDF to Customer Email */
route('POST', '/api/erp/quotations/:id/send-email', { mod: ['erp', 'crm', 'finance'] }, async ({ req, res, user, params }) => {
  const qtn = (db().quotations || []).find(q => q.id === params.id || q.no === params.id)
           || db().invoices.find(i => i.id === params.id || i.no === params.id);
  if (!qtn) throw new HttpError(404, 'Quotation not found.');
  const cust = db().customers.find(c => c.id === (qtn.customerId || qtn.clientId)) || {};
  const targetEmail = qtn.email || cust.email;
  if (!targetEmail) throw new HttpError(400, 'Client does not have a valid email address recorded.');
  const companyName = db().company.name || 'RvmAiTech Solutions Private Limited';
  const qNo = qtn.no || 'RVM/QTN/2026/001';
  const subject = `${companyName} - Project Quotation (${qNo}): ${qtn.projectName || 'Commercial Offer'}`;
  const host = req.headers.host || `localhost:${PORT}`;
  const pdfBuf = await pdfGen.generateQuotationPdf(qtn, cust, db().company);
  const bodyText = `Dear ${qtn.contactPerson || cust.name || 'Valued Client'},\n\nPlease find attached the official commercial quotation ${qNo} for "${qtn.projectName || 'Project'}" from ${companyName}.\n\nQuotation No: ${qNo}\nProject Name: ${qtn.projectName || 'Project'}\nCategory: ${qtn.projectCategory || 'Software / Hardware / Industrial Automation'}\nBasic Cost: Rs. ${Number(qtn.basicCost || 0).toLocaleString('en-IN')}\nGST (18%): Rs. ${Number(qtn.gstAmount || 0).toLocaleString('en-IN')}\nGrand Total: Rs. ${Number(qtn.totalAmount || 0).toLocaleString('en-IN')}\n\nYou can also download the PDF directly here:\nhttp://${host}/api/pdf/quotation/${qtn.id}\n\nWarm regards,\nVivek Kumar Bhardwaj\nCEO / Founder\n${companyName}\nOfficial Email: ${SENDER_EMAIL} · WhatsApp: 7052050656`;

  const smtpRes = await sendGmailSmtp({
    to: targetEmail,
    subject,
    body: bodyText,
    attachments: [{
      filename: `Quotation_${qNo.replace(/[^a-zA-Z0-9_-]/g, '')}.pdf`,
      content: pdfBuf
    }]
  });

  db().emailOutbox.push({
    id: `em_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: 'quotation_pdf',
    docId: qtn.id,
    to: targetEmail,
    name: qtn.contactPerson || qtn.companyName || cust.name,
    subject,
    body: bodyText,
    sentAt: Date.now(),
    sentBy: user.name,
    hasAttachment: true,
    attachmentName: `Quotation_${qNo}.pdf`,
    status: smtpRes.sentLive ? 'Delivered (Gmail SMTP with PDF)' : 'Logged (Sent with PDF Attachment)'
  });
  await store.save();

  const qtnGmailWebUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(targetEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;

  send(res, 200, {
    ok: true,
    sentLive: smtpRes.sentLive,
    mode: smtpRes.mode || (smtpRes.sentLive ? 'smtp' : 'logged'),
    gmailWebUrl: qtnGmailWebUrl,
    downloadUrl: `http://${host}/api/pdf/quotation/${qtn.id}`,
    message: smtpRes.sentLive ? `Quotation PDF emailed successfully to ${targetEmail}!` : `Quotation PDF email logged to outbox for ${targetEmail}.`
  });
});

/* Send Proforma Invoice (PI) PDF to Customer Email */
route('POST', '/api/erp/proformas/:id/send-email', { mod: ['erp', 'crm', 'finance'] }, async ({ req, res, user, params }) => {
  const pi = (db().proformas || []).find(p => p.id === params.id || p.no === params.id)
          || db().invoices.find(i => i.id === params.id || i.no === params.id);
  if (!pi) throw new HttpError(404, 'Proforma Invoice not found.');
  const cust = db().customers.find(c => c.id === (pi.customerId || pi.clientId)) || {};
  const targetEmail = pi.email || cust.email;
  if (!targetEmail) throw new HttpError(400, 'Client does not have a valid email address recorded.');
  const companyName = db().company.name || 'RvmAiTech Solutions Private Limited';
  const piNo = pi.no || 'RVM/PI/2026/001';
  const subject = `${companyName} - Proforma Invoice (${piNo}): ${pi.projectName || 'Payment Request'}`;
  const host = req.headers.host || `localhost:${PORT}`;
  const pdfBuf = await pdfGen.generateProformaPdf(pi, cust, db().company);
  const isFullPayment = String(pi.paymentType || '').toLowerCase().includes('full');
  const payTypeLabel = isFullPayment ? 'Full Payment' : 'Advance Payment';
  const payableAmt = isFullPayment ? (pi.totalAmount || 0) : (pi.advanceAmount || Math.round((pi.totalAmount || 0) * 0.5));

  const bodyText = `Dear ${pi.contactPerson || cust.name || 'Valued Client'},\n\nPlease find attached the official Proforma Invoice (PI) ${piNo} for "${pi.projectName || 'Project'}" from ${companyName}.\n\nPI Number: ${piNo}\nProject Name: ${pi.projectName || 'Project'}\nPayment Type: ${payTypeLabel}\nTotal Project Value: Rs. ${Number(pi.totalAmount || 0).toLocaleString('en-IN')}\nPayable Now (${isFullPayment ? '100% Full' : (pi.advancePct || 50) + '% Advance'}): Rs. ${Number(payableAmt).toLocaleString('en-IN')}\n\nBank Account for NEFT/RTGS/IMPS:\nBank: ${pi.bankName || 'ICICI Bank'}\nAccount: ${pi.accountNo || '348451000002'}\nIFSC: ${pi.ifsc || 'ICIC0003484'}\nBranch: ${pi.branch || 'Mansarovar, Jaipur'}\nUPI ID: ${pi.upiId || '7052050656@icici'}\n\nYou can also download the PDF directly here:\nhttp://${host}/api/pdf/proforma/${pi.id}\n\nWarm regards,\nFinance & Accounts Department\n${companyName}\nOfficial Email: ${SENDER_EMAIL} · WhatsApp: 7052050656`;

  const smtpRes = await sendGmailSmtp({
    to: targetEmail,
    subject,
    text: bodyText,
    body: bodyText,
    attachments: [{
      filename: `Proforma_Invoice_${piNo.replace(/[^a-zA-Z0-9_-]/g, '')}.pdf`,
      content: pdfBuf
    }]
  });

  db().emailOutbox.push({
    id: `em_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: 'proforma_pdf',
    docId: pi.id,
    to: targetEmail,
    name: pi.contactPerson || pi.companyName || cust.name,
    subject,
    body: bodyText,
    sentAt: Date.now(),
    sentBy: user.name,
    hasAttachment: true,
    attachmentName: `Proforma_${piNo}.pdf`,
    status: smtpRes.sentLive ? 'Delivered (Gmail SMTP with PDF)' : 'Logged (Sent with PDF Attachment)'
  });
  await store.save();

  const piGmailWebUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(targetEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;

  send(res, 200, {
    ok: true,
    sentLive: smtpRes.sentLive,
    mode: smtpRes.mode || (smtpRes.sentLive ? 'smtp' : 'logged'),
    gmailWebUrl: piGmailWebUrl,
    downloadUrl: `http://${host}/api/pdf/proforma/${pi.id}`,
    message: smtpRes.sentLive ? `Proforma Invoice PDF emailed successfully to ${targetEmail}!` : `Proforma PDF email logged to outbox for ${targetEmail}.`
  });
});

/* Save / Configure Gmail App Password */
route('POST', '/api/settings/smtp', { open: true }, async ({ req, res }) => {
  const b = await readJson(req).catch(() => ({}));
  const pass = String(b.emailPass || b.pass || '').trim();
  db().company = db().company || {};
  db().company.emailPass = pass;
  await store.save();
  send(res, 200, { ok: true, hasPass: !!pass, message: pass ? 'Gmail App Password saved successfully!' : 'Gmail App Password cleared.' });
});
route('GET', '/api/settings/smtp', { open: true }, async ({ res }) => {
  const hasPass = !!(process.env.GMAIL_PASS || process.env.SMTP_PASS || (db().company && db().company.emailPass));
  send(res, 200, { ok: true, configured: hasPass, sender: SENDER_EMAIL });
});

/* Send Quotation PDF to Customer Email */
route('POST', '/api/erp/quotations/:id/send-email', { mod: ['erp', 'crm', 'finance'] }, async ({ req, res, user, params }) => {
  const qtn = (db().quotations || []).find(q => q.id === params.id || q.no === params.id)
           || db().invoices.find(i => i.id === params.id || i.no === params.id);
  if (!qtn) throw new HttpError(404, 'Quotation not found.');
  const cust = db().customers.find(c => c.id === (qtn.customerId || qtn.clientId)) || {};
  const targetEmail = qtn.email || cust.email;
  if (!targetEmail) throw new HttpError(400, 'Client does not have a valid email address recorded.');
  const companyName = db().company.name || 'RvmAiTech Solutions Private Limited';
  const qNo = qtn.no || 'RVM/QTN/2026/001';
  const subject = `${companyName} - Project Quotation (${qNo}): ${qtn.projectName || 'Commercial Offer'}`;
  const host = req.headers.host || `localhost:${PORT}`;
  const pdfBuf = await pdfGen.generateQuotationPdf(qtn, cust, db().company);
  const bodyText = `Dear ${qtn.contactPerson || cust.name || 'Valued Client'},\n\nPlease find attached the official commercial quotation ${qNo} for "${qtn.projectName || 'Project'}" from ${companyName}.\n\nQuotation No: ${qNo}\nProject Name: ${qtn.projectName || 'Project'}\nCategory: ${qtn.projectCategory || 'Software / Hardware / Industrial Automation'}\nBasic Cost: Rs. ${Number(qtn.basicCost || 0).toLocaleString('en-IN')}\nGST (18%): Rs. ${Number(qtn.gstAmount || 0).toLocaleString('en-IN')}\nGrand Total: Rs. ${Number(qtn.totalAmount || 0).toLocaleString('en-IN')}\n\nYou can also download the PDF directly here:\nhttp://${host}/api/pdf/quotation/${qtn.id}\n\nWarm regards,\nVivek Kumar Bhardwaj\nCEO / Founder\n${companyName}\nOfficial Email: ${SENDER_EMAIL} · WhatsApp: 7052050656`;

  const smtpRes = await sendGmailSmtp({
    to: targetEmail,
    subject,
    body: bodyText,
    attachments: [{
      filename: `Quotation_${qNo.replace(/[^a-zA-Z0-9_-]/g, '')}.pdf`,
      content: pdfBuf
    }]
  });

  db().emailOutbox.push({
    id: `em_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: 'quotation_pdf',
    docId: qtn.id,
    to: targetEmail,
    name: qtn.contactPerson || qtn.companyName || cust.name,
    subject,
    body: bodyText,
    sentAt: Date.now(),
    sentBy: user.name,
    hasAttachment: true,
    attachmentName: `Quotation_${qNo}.pdf`,
    status: smtpRes.sentLive ? 'Delivered (Gmail SMTP with PDF)' : 'Logged (Sent with PDF Attachment)'
  });
  await store.save();

  const qtnGmailWebUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(targetEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;

  send(res, 200, {
    ok: true,
    sentLive: smtpRes.sentLive,
    mode: smtpRes.mode || (smtpRes.sentLive ? 'smtp' : 'logged'),
    gmailWebUrl: qtnGmailWebUrl,
    downloadUrl: `http://${host}/api/pdf/quotation/${qtn.id}`,
    message: smtpRes.sentLive ? `Quotation PDF emailed successfully to ${targetEmail}!` : `Quotation PDF email logged to outbox for ${targetEmail}.`
  });
});

/* Send Proforma Invoice (PI) PDF to Customer Email */
route('POST', '/api/erp/proformas/:id/send-email', { mod: ['erp', 'crm', 'finance'] }, async ({ req, res, user, params }) => {
  const pi = (db().proformas || []).find(p => p.id === params.id || p.no === params.id)
          || db().invoices.find(i => i.id === params.id || i.no === params.id);
  if (!pi) throw new HttpError(404, 'Proforma Invoice not found.');
  const cust = db().customers.find(c => c.id === (pi.customerId || pi.clientId)) || {};
  const targetEmail = pi.email || cust.email;
  if (!targetEmail) throw new HttpError(400, 'Client does not have a valid email address recorded.');
  const companyName = db().company.name || 'RvmAiTech Solutions Private Limited';
  const piNo = pi.no || 'RVM/PI/2026/001';
  const subject = `${companyName} - Proforma Invoice (${piNo}): ${pi.projectName || 'Payment Request'}`;
  const host = req.headers.host || `localhost:${PORT}`;
  const pdfBuf = await pdfGen.generateProformaPdf(pi, cust, db().company);
  const isFullPayment = String(pi.paymentType || '').toLowerCase().includes('full');
  const payTypeLabel = isFullPayment ? 'Full Payment' : 'Advance Payment';
  const payableAmt = isFullPayment ? (pi.totalAmount || 0) : (pi.advanceAmount || Math.round((pi.totalAmount || 0) * 0.5));

  const bodyText = `Dear ${pi.contactPerson || cust.name || 'Valued Client'},\n\nPlease find attached the official Proforma Invoice (PI) ${piNo} for "${pi.projectName || 'Project'}" from ${companyName}.\n\nPI Number: ${piNo}\nProject Name: ${pi.projectName || 'Project'}\nPayment Type: ${payTypeLabel}\nTotal Project Value: Rs. ${Number(pi.totalAmount || 0).toLocaleString('en-IN')}\nPayable Now (${isFullPayment ? '100% Full' : (pi.advancePct || 50) + '% Advance'}): Rs. ${Number(payableAmt).toLocaleString('en-IN')}\n\nBank Account for NEFT/RTGS/IMPS:\nBank: ${pi.bankName || 'ICICI Bank'}\nAccount: ${pi.accountNo || '348451000002'}\nIFSC: ${pi.ifsc || 'ICIC0003484'}\nBranch: ${pi.branch || 'Mansarovar, Jaipur'}\nUPI ID: ${pi.upiId || '7052050656@icici'}\n\nYou can also download the PDF directly here:\nhttp://${host}/api/pdf/proforma/${pi.id}\n\nWarm regards,\nFinance & Accounts Department\n${companyName}\nOfficial Email: ${SENDER_EMAIL} · WhatsApp: 7052050656`;

  const smtpRes = await sendGmailSmtp({
    to: targetEmail,
    subject,
    text: bodyText,
    body: bodyText,
    attachments: [{
      filename: `Proforma_Invoice_${piNo.replace(/[^a-zA-Z0-9_-]/g, '')}.pdf`,
      content: pdfBuf
    }]
  });

  db().emailOutbox.push({
    id: `em_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: 'proforma_pdf',
    docId: pi.id,
    to: targetEmail,
    name: pi.contactPerson || pi.companyName || cust.name,
    subject,
    body: bodyText,
    sentAt: Date.now(),
    sentBy: user.name,
    hasAttachment: true,
    attachmentName: `Proforma_${piNo}.pdf`,
    status: smtpRes.sentLive ? 'Delivered (Gmail SMTP with PDF)' : 'Logged (Sent with PDF Attachment)'
  });
  await store.save();

  const piGmailWebUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(targetEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;

  send(res, 200, {
    ok: true,
    sentLive: smtpRes.sentLive,
    mode: smtpRes.mode || (smtpRes.sentLive ? 'smtp' : 'logged'),
    gmailWebUrl: piGmailWebUrl,
    downloadUrl: `http://${host}/api/pdf/proforma/${pi.id}`,
    message: smtpRes.sentLive ? `Proforma Invoice PDF emailed successfully to ${targetEmail}!` : `Proforma PDF email logged to outbox for ${targetEmail}.`
  });
});

/* Save / Configure Gmail App Password */
route('POST', '/api/settings/smtp', { open: true }, async ({ req, res }) => {
  const b = await readJson(req).catch(() => ({}));
  const pass = String(b.emailPass || b.pass || '').trim();
  db().company = db().company || {};
  db().company.emailPass = pass;
  await store.save();
  send(res, 200, { ok: true, hasPass: !!pass, message: pass ? 'Gmail App Password saved successfully!' : 'Gmail App Password cleared.' });
});
route('GET', '/api/settings/smtp', { open: true }, async ({ res }) => {
  const hasPass = !!(process.env.GMAIL_PASS || process.env.SMTP_PASS || (db().company && db().company.emailPass));
  send(res, 200, { ok: true, configured: hasPass, sender: SENDER_EMAIL });
});

/* Send PO PDF to Vendor Email */
route('POST', '/api/erp/purchase-orders/:id/send-email', { mod: ['erp'] }, async ({ req, res, user, params }) => {
  const po = findDoc('purchases', params.id);
  const b = await readJson(req).catch(() => ({}));
  const vendorEmail = b.to || po.vendorEmail || 'vendor@example.com';
  const companyName = db().company.name || 'RvmAiTech Solutions Private Limited';
  const subject = `Official Purchase Order (PO) - ${po.no} from ${companyName}`;
  const host = req.headers.host || `localhost:${PORT}`;
  const pdfBuf = await pdfGen.generatePurchaseOrderPdf(po, { company: po.supplier, email: vendorEmail }, db().company);
  const bodyText = `Dear ${po.supplier || 'Vendor'},\n\nPlease find attached our official Purchase Order ${po.no}.\n\nPO No: ${po.no}\nItem: ${po.productName || 'Equipment'}\nQuantity: ${po.qty}\nUnit Cost: Rs. ${Number(po.cost || 0).toLocaleString('en-IN')}\nTotal PO Value: Rs. ${Number((po.qty || 1) * (po.cost || 0)).toLocaleString('en-IN')}\n\nYou can also download the PDF directly here:\nhttp://${host}/api/pdf/purchase-order/${po.id}\n\nPlease confirm receipt and dispatch schedule.\n\nWarm regards,\nProcurement Department\n${companyName}\nOfficial Sender: ${SENDER_EMAIL}`;

  const smtpRes = await sendGmailSmtp({
    to: vendorEmail,
    subject,
    text: bodyText,
    from: SENDER_EMAIL,
    attachments: [{ filename: `Purchase_Order_${po.no}.pdf`, content: pdfBuf, contentType: 'application/pdf' }]
  });

  db().emailOutbox = db().emailOutbox || [];
  db().emailOutbox.push({
    id: newId('m'),
    from: SENDER_EMAIL,
    to: vendorEmail,
    name: po.supplier,
    subject,
    body: bodyText,
    sentAt: Date.now(),
    sentBy: user.name,
    hasAttachment: true,
    attachmentName: `Purchase_Order_${po.no}.pdf`,
    status: smtpRes.sentLive ? 'Delivered (Gmail SMTP with PDF)' : 'Logged (Sent with PDF Attachment)'
  });
  await store.save();

  send(res, 200, {
    ok: true,
    sentLive: smtpRes.sentLive,
    message: smtpRes.sentLive ? `PO PDF emailed successfully to ${vendorEmail}!` : `PO PDF email logged to outbox for ${vendorEmail}.`
  });
});

route('POST', '/api/my-attendance', {}, async ({ req, res, user }) => {
  if (user.role !== 'employee' || !user.empId) throw new HttpError(403, 'Only employees can mark their self-attendance.');
  const b = await readJson(req);
  const mark = String(b.mark || 'P').toUpperCase();
  if (!['P', 'H'].includes(mark)) throw new HttpError(400, 'Status must be Present (P) or Half Day (H).');
  const t = today();
  const day = Object.assign({}, db().attendance[t]);
  day[user.empId] = mark;
  db().attendance[t] = day;
  db().sampleAttendance = db().sampleAttendance.filter(x => x !== t);
  await store.save();
  send(res, 200, { ok: true, date: t, mark });
});

/* ---- owner only ---- */
function cleanModules(v) {
  if (!Array.isArray(v)) throw new HttpError(400, 'Choose what this login can open.');
  const mods = MODULES.filter(m => v.includes(m));
  if (!mods.length) throw new HttpError(400, 'Choose at least one module this login can open.');
  return mods;
}
route('POST', '/api/users', { owner: true }, async ({ req, res }) => {
  const b = await readJson(req);
  const name = String(b.name || '').trim().slice(0, 120);
  if (!name) throw new HttpError(400, 'Name is required.');
  const loginId = checkLoginId(b.loginId);
  if (db().users.some(u => u.loginId === loginId)) throw new HttpError(409, 'Another login already uses this login ID.');
  checkPassword(b.password);
  const user = { id: newId('u'), name, loginId, role: 'staff', modules: cleanModules(b.modules), active: true, passHash: await hashPassword(b.password), createdAt: Date.now() };
  if (db().users.some(u => u.loginId === loginId)) throw new HttpError(409, 'Another login already uses this login ID.');
  db().users.push(user);
  await store.save();
  send(res, 201, { id: user.id });
});
route('PUT', '/api/users/:id', { owner: true }, async ({ req, res, user, params }) => {
  const target = db().users.find(u => u.id === params.id);
  if (!target) throw new HttpError(404, 'That login no longer exists.');
  const b = await readJson(req);
  if (b.name !== undefined) { const name = String(b.name).trim().slice(0, 120); if (!name) throw new HttpError(400, 'Name is required.'); target.name = name; }
  if (target.role !== 'owner') {
    if (b.modules !== undefined) target.modules = cleanModules(b.modules);
    if (b.active !== undefined) { target.active = !!b.active; if (!target.active) sessions.destroyUser(target.id); }
  }
  if (b.password !== undefined && b.password !== '') {
    checkPassword(b.password);
    target.passHash = await hashPassword(b.password);
    if (target.id !== user.id) sessions.destroyUser(target.id);
  }
  await store.save();
  send(res, 200, { ok: true });
});
route('DELETE', '/api/users/:id', { owner: true }, async ({ res, params }) => {
  const target = db().users.find(u => u.id === params.id);
  if (!target) throw new HttpError(404, 'That login no longer exists.');
  if (target.role === 'owner') throw new HttpError(409, 'The owner login cannot be deleted.');
  db().users = db().users.filter(u => u !== target);
  sessions.destroyUser(target.id);
  await store.save();
  send(res, 200, { ok: true });
});
route('PUT', '/api/company', { owner: true }, async ({ req, res }) => {
  const b = await readJson(req);
  const name = String(b.name || '').trim().slice(0, 120);
  if (!name) throw new HttpError(400, 'Company name is required.');
  db().company.name = name;
  await store.save();
  send(res, 200, { ok: true });
});
route('POST', '/api/sample/clear', { owner: true }, async ({ res }) => {
  const d = db();
  const gone = new Set(d.employees.filter(e => e.sample).map(e => e.id));
  for (const c of DATA_COLS) d[c] = d[c].filter(x => !x.sample);
  for (const f of d.files.filter(x => gone.has(x.employeeId))) await removeFile(f);
  for (const date of d.sampleAttendance) delete d.attendance[date];
  d.sampleAttendance = [];
  await store.save();
  send(res, 200, { ok: true });
});

/* ---------------- static files ---------------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8' };
function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed.' });
  let rel;
  try { rel = decodeURIComponent(pathname); } catch (e) { return send(res, 400, { error: 'Bad address.' }); }
  if (rel === '/') rel = '/index.html';
  const file = path.join(PUBLIC, rel);
  if (rel.includes('\0') || !file.startsWith(PUBLIC + path.sep)) return send(res, 404, { error: 'Not found.' });
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, { error: 'Not found.' });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-cache' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

/* ---------------- request handling ---------------- */
async function handle(req, res) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch (e) { return send(res, 400, { error: 'Bad address.' }); }
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-key, Bypass-Tunnel-Reminder, x-requested-with'
    });
    return res.end();
  }
  const isPublicWebhook = url.pathname === '/api/inquiries' || url.pathname === '/api/public/lead' || url.pathname === '/api/leads/inquiry';
  const corsHeaders = isPublicWebhook ? { 'Access-Control-Allow-Origin': '*' } : undefined;
  try {
    let params = null;
    const hit = routes.find(r => {
      if (r.method !== req.method) return false;
      const m = r.rx.exec(url.pathname);
      if (!m) return false;
      params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return true;
    });
    if (!hit) throw new HttpError(404, 'Not found.');
    if (req.method !== 'GET' && !isPublicWebhook) {
      /* Only this app's own pages may change data: a custom header plus a same-site check. */
      if (req.headers['x-requested-with'] !== 'fetch') throw new HttpError(403, 'Request refused.');
      if (req.headers.origin) {
        let host = '';
        try { host = new URL(req.headers.origin).host; } catch (e) { /* not a URL */ }
        if (host !== req.headers.host) throw new HttpError(403, 'Request refused.');
      }
    }
    const ctx = { req, res, params, query: url.searchParams, user: null };
    if (!hit.opts.open) {
      const uid = sessions.userId(req);
      const user = uid && db().users.find(u => u.id === uid && u.active !== false);
      if (!user) throw new HttpError(401, 'Log in to continue.');
      if (hit.opts.owner && !isOwner(user)) throw new HttpError(403, 'Only the owner can do this.');
      if (hit.opts.mod && !hit.opts.mod.some(m => hasModule(user, m))) throw new HttpError(403, 'Your login is not allowed to open this.');
      ctx.user = user;
    }
    await hit.handler(ctx);
  } catch (e) {
    if (res.headersSent) { res.destroy(); return; }
    if (e instanceof HttpError) return send(res, e.status, { error: e.message }, Object.assign({}, corsHeaders, e.status === 413 ? { Connection: 'close' } : undefined));
    if (e instanceof URIError) return send(res, 400, { error: 'Bad address.' }, corsHeaders);
    console.error('[error]', req.method, url.pathname, e);
    send(res, 500, { error: 'The server hit a problem. Nothing was saved. Try again.' }, corsHeaders);
  }
}

const server = http.createServer((req, res) => { handle(req, res).catch(e => { console.error(e); try { res.destroy(); } catch (x) { /* gone */ } }); });
server.listen(PORT, HOST, () => {
  console.log('\n  Business Suite is running.\n');
  console.log(`  On this computer:   http://localhost:${PORT}`);
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) console.log(`  On your network:    http://${a.address}:${PORT}`);
  console.log(`\n  Data folder:        ${DATA}`);
  if (setupCode) console.log(`\n  First-time setup: open the address above and create the owner account.\n  Setup code (only asked when setting up from another computer): ${setupCode}`);
  console.log('\n  Press Ctrl+C to stop.\n');
});
server.on('error', e => {
  console.error(e.code === 'EADDRINUSE' ? `\n  Port ${PORT} is already in use. Close the other copy, or start with another port:  PORT=3001 node server.js  (Windows: set PORT=3001 && node server.js)\n` : e);
  process.exit(1);
});
setInterval(() => sessions.prune(), 60 * 60 * 1000).unref();
function stop() {
  try { store.flushSync(); sessFile.flushSync(); } catch (e) { console.error('Could not save on exit:', e.message); }
  process.exit(0);
}
process.on('unhandledRejection', e => console.error('[unhandled]', e));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
