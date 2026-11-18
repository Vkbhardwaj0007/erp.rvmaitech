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
const zlib = require('zlib');

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
const docOcr = require('./lib/documentOcr');

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
}

function buildMimeMessage({ from, to, subject, text, html, attachments = [] }) {
  if (!attachments || !attachments.length) {
    if (html) {
      const altBoundary = '----=_RvmAlt_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      return [
        `From: "RvmAiTech Solutions" <${from}>`,
        `To: <${to}>`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
        '',
        `--${altBoundary}`,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 7bit',
        '',
        text || '',
        '',
        `--${altBoundary}`,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: 7bit',
        '',
        html,
        '',
        `--${altBoundary}--`,
        '.'
      ].join('\r\n');
    }
    return [
      `From: "RvmAiTech Solutions" <${from}>`,
      `To: <${to}>`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      '',
      text,
      '.'
    ].join('\r\n');
  }

  const mixedBoundary = '----=_RvmMixed_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  const parts = [
    `From: "RvmAiTech Solutions" <${from}>`,
    `To: <${to}>`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    '',
    `--${mixedBoundary}`
  ];

  if (html) {
    const altBoundary = '----=_RvmAlt_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const textB64 = Buffer.from(text || '', 'utf8').toString('base64').match(/.{1,76}/g) || [''];
    const htmlB64 = Buffer.from(html || '', 'utf8').toString('base64').match(/.{1,76}/g) || [''];
    parts.push(
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      '',
      `--${altBoundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      textB64.join('\r\n'),
      '',
      `--${altBoundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      htmlB64.join('\r\n'),
      '',
      `--${altBoundary}--`,
      ''
    );
  } else {
    const textB64 = Buffer.from(text || '', 'utf8').toString('base64').match(/.{1,76}/g) || [''];
    parts.push(
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      textB64.join('\r\n'),
      ''
    );
  }

  for (const att of attachments) {
    const fn = att.filename || 'document.pdf';
    const ct = att.contentType || 'application/pdf';
    const buf = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content);
    const b64 = buf.toString('base64');
    const chunks = b64.match(/.{1,76}/g) || [b64];

    parts.push(`--${mixedBoundary}`);
    parts.push(`Content-Type: ${ct}; name="${fn}"`);
    parts.push(`Content-Disposition: attachment; filename="${fn}"`);
    parts.push('Content-Transfer-Encoding: base64');
    parts.push('');
    parts.push(chunks.join('\r\n'));
    parts.push('');
  }

  parts.push(`--${mixedBoundary}--`);
  parts.push('.');
  return parts.join('\r\n');
}

function sendGmailSmtp({ to, subject, text, body, html, from = SENDER_EMAIL, attachments = [] }) {
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
        const mimeMsg = buildMimeMessage({ from, to, subject, text: msgText, html, attachments });
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
    }, 60000);
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

  if (params.col === 'employees' && doc.candidateId) {
    const cand = (db().candidates || []).find(c => c.id === doc.candidateId);
    if (cand) {
      cand.status = 'Joined / Converted';
      cand.convertedEmpId = doc.id;
      cand.joinedAt = Date.now();
      if (cand.resumeId) {
        const rFile = (db().files || []).find(f => f.id === cand.resumeId);
        if (rFile && !db().files.some(f => f.employeeId === doc.id && f.kind === 'Resume')) {
          db().files.push({
            id: newId('f'),
            employeeId: doc.id,
            kind: 'Resume',
            name: rFile.name || 'Resume.pdf',
            mime: rFile.mime,
            size: rFile.size,
            stored: rFile.stored,
            uploadedAt: Date.now(),
            uploadedBy: user.id
          });
        }
      }
    }
  }

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

function extractAadhaarDetails(buf, mime) {
  let text = '';
  try {
    if (mime === 'application/pdf') {
      const raw = buf.toString('latin1');
      text += ' ' + raw;
      const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
      let m;
      while ((m = streamRegex.exec(raw)) !== null) {
        try {
          const inflated = zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('utf-8');
          text += ' ' + inflated;
        } catch (_) {}
      }
    } else {
      text = buf.toString('utf-8', 0, Math.min(buf.length, 65536));
    }
  } catch (err) {
    console.warn('Aadhaar extraction parse error:', err);
  }

  let aadhaarNo = null;
  const noMatch = text.match(/\b([2-9]\d{3}\s\d{4}\s\d{4})\b/) || text.match(/\b([2-9]\d{11})\b/);
  if (noMatch) {
    const rawNo = noMatch[1].replace(/\s+/g, '');
    aadhaarNo = rawNo.slice(0, 4) + ' ' + rawNo.slice(4, 8) + ' ' + rawNo.slice(8, 12);
  }

  let address = null;
  const addrMatch = text.match(/(?:Address[:\s]|To[:\s]|S\/O[:\s]|D\/O[:\s]|W\/O[:\s]|C\/O[:\s])([\s\S]{15,300}?\b[1-9]\d{5}\b)/i);
  if (addrMatch) {
    address = addrMatch[1]
      .replace(/[\r\n\t]+/g, ', ')
      .replace(/[()\\/]/g, ' ')
      .replace(/\s+,/g, ',')
      .replace(/,\s*,/g, ',')
      .replace(/\s+/g, ' ')
      .replace(/^[:\s,]+/, '')
      .trim();
  }

  return { aadhaarNo, address };
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
  const file = {
    id,
    employeeId: emp.id,
    kind,
    name,
    mime: type[0],
    size: buf.length,
    stored: id + '.' + type[1],
    dataBase64: buf.length <= 4 * 1024 * 1024 ? buf.toString('base64') : undefined,
    uploadedAt: Date.now(),
    uploadedBy: user.id
  };
  await fsp.writeFile(path.join(UPLOADS, file.stored), buf);
  if (kind === 'photo') {
    const old = db().files.find(f => f.id === emp.photoId);
    if (old) await removeFile(old);
    emp.photoId = id;
  }

  // --- Intelligent OCR & Strict KYC Document Validation ---
  let ocrResult = null;
  let extractedSummary = {};
  if (kind !== 'photo') {
    try {
      ocrResult = await docOcr.processDocumentOcr(buf, type[0], kind, name, emp.name, emp.parentsName);
    } catch (ocrErr) {
      console.warn('[File Upload OCR Error]:', ocrErr);
    }

    if (ocrResult && ocrResult.success) {
      const detected = ocrResult.docType;
      const ex = ocrResult.extracted || {};
      extractedSummary = ex;

      // 1. STRICT SLOT VERIFICATION (Reject Mismatched Documents)
      if (kind === 'Aadhaar Card' || /aadhaar|adhar/i.test(kind)) {
        if (detected === 'College Certificate') {
          throw new HttpError(400, '❌ Galat Document: Yeh Marksheet / College Certificate hai, Aadhaar Card nahi! Kripya candidate ka asli Aadhaar Card upload karein.');
        }
        if (detected === 'Internal HR Document') {
          throw new HttpError(400, '❌ Galat Document: Yeh Company ka Joining / Appointment Letter hai, Aadhaar Card nahi! Kripya candidate ka asli Aadhaar Card upload karein.');
        }
        if (detected === 'PAN Card') {
          throw new HttpError(400, '❌ Galat Slot: Yeh PAN Card hai! Kripya ise "Upload PAN" button par upload karein, Aadhaar slot me nahi.');
        }
        if (detected === 'Rent Agreement') {
          throw new HttpError(400, '❌ Galat Document: Yeh Rent Agreement hai, Aadhaar Card nahi!');
        }
        if (detected !== 'Aadhaar Card' && ocrResult.rawTextLength >= 50) {
          throw new HttpError(400, '❌ Invalid Aadhaar: Upload kiye gaye document me Aadhaar Card ki jaankari (UIDAI / 12-digit UID) nahi mili. Kripya saaf Aadhaar Card upload karein.');
        }
      } else if (kind === 'PAN Card' || /pan/i.test(kind)) {
        if (detected === 'Aadhaar Card') {
          throw new HttpError(400, '❌ Galat Slot: Yeh Aadhaar Card hai! Kripya ise "Upload Aadhaar" button par upload karein.');
        }
        if (detected === 'College Certificate') {
          throw new HttpError(400, '❌ Galat Document: Yeh Marksheet / Diploma hai, PAN Card nahi!');
        }
        if (detected === 'Internal HR Document') {
          throw new HttpError(400, '❌ Galat Document: Yeh Joining / Appointment Letter hai, PAN Card nahi!');
        }
        if (detected !== 'PAN Card' && ocrResult.rawTextLength >= 50) {
          throw new HttpError(400, '❌ Invalid PAN: Upload kiye gaye document me 10-digit PAN Card number nahi mila. Kripya saaf PAN Card upload karein.');
        }
      } else if (kind === 'College Certificate' || /college|degree|certificate/i.test(kind)) {
        if (detected === 'Aadhaar Card' || detected === 'PAN Card') {
          throw new HttpError(400, '❌ Galat Document: Yeh Identity Proof (Aadhaar/PAN) hai! Kripya College Degree ya Marksheet upload karein.');
        }
        if (detected === 'Internal HR Document') {
          throw new HttpError(400, '❌ Galat Document: Yeh Company Joining Letter hai, College Certificate nahi.');
        }
      }

      // 2. CANDIDATE NAME VERIFICATION (Reject documents of different person)
      if ((kind === 'Aadhaar Card' || kind === 'PAN Card') && ocrResult.rawTextLength >= 60) {
        if (ocrResult.nameMatch && !ocrResult.nameMatch.matched) {
          throw new HttpError(400, `❌ Name Mismatch: Document par naam candidate '${emp.name}' se match nahi kar raha hai! Yeh document kisi aur vyakti ka lag raha hai. Kripya candidate ka apna asli document upload karein.`);
        }
      }

      // Auto-detect & refine document type if high confidence
      if (ocrResult.confidence === 'high' && detected && detected !== 'Other') {
        file.kind = detected;
      }

      // 3. APPLY EXTRACTED ENTITIES
      if (file.kind === 'Aadhaar Card') {
        if (ex.aadhaarNumber) {
          emp.aadhaarNumber = ex.aadhaarNumber;
          if (!emp.idNumber) {
            emp.idNumber = ex.aadhaarNumber;
            emp.idType = 'Aadhaar';
          }
        }
        if (ex.address) {
          emp.permAddress = ex.address;
          if (!emp.address) emp.address = ex.address;
        }
        if (ex.parentsName && !emp.parentsName) emp.parentsName = ex.parentsName;
        if (ex.dob && !emp.dob) emp.dob = ex.dob;
      } else if (file.kind === 'PAN Card') {
        if (ex.panNumber) {
          emp.panNumber = ex.panNumber;
          if (!emp.idNumber || emp.idType === 'PAN') {
            emp.idNumber = ex.panNumber;
            emp.idType = 'PAN';
          }
        }
      } else if (file.kind === 'Rent Agreement') {
        if (ex.livingStatus) emp.livingStatus = ex.livingStatus;
        if (ex.roomOwnerName && !emp.roomOwnerName) emp.roomOwnerName = ex.roomOwnerName;
        if (ex.roomOwnerPhone && !emp.roomOwnerPhone) emp.roomOwnerPhone = ex.roomOwnerPhone;
        if (ex.roomAddress && !emp.roomAddress) emp.roomAddress = ex.roomAddress;
      } else if (file.kind === 'College Certificate') {
        if (ex.highestCollege && !emp.highestCollege) emp.highestCollege = ex.highestCollege;
      } else if (file.kind === 'Experience Letter') {
        if (ex.previousEmployer && !emp.previousEmployer) emp.previousEmployer = ex.previousEmployer;
      }
    }
  }

  // Clean replacement for unique statutory proofs (replace older file of same kind)
  if (['Aadhaar Card', 'PAN Card', 'College Certificate', 'Rent Agreement'].includes(file.kind)) {
    const prevFiles = (db().files || []).filter(f => f.employeeId === emp.id && f.kind === file.kind && f.id !== file.id);
    for (const pf of prevFiles) {
      await removeFile(pf).catch(() => {});
    }
  }

  db().files.push(file);
  delete emp.sample;
  await store.save();
  send(res, 201, {
    id,
    kind: file.kind,
    extracted: extractedSummary,
    permAddress: emp.permAddress,
    aadhaarNumber: emp.aadhaarNumber,
    panNumber: emp.panNumber,
    roomOwnerName: emp.roomOwnerName,
    highestCollege: emp.highestCollege
  });
});
route('GET', '/api/files/:id', {}, async ({ req, res, user, params }) => {
  const f = db().files && db().files.find(x => x.id === params.id);
  if (!f) throw new HttpError(404, 'File not found.');
  const full = path.join(UPLOADS, f.stored);
  if ((!fs.existsSync(full) || fs.statSync(full).size === 0) && f.dataBase64) {
    try {
      await fsp.writeFile(full, Buffer.from(f.dataBase64, 'base64'));
    } catch (_) {}
  }
  if (!/^f[0-9a-f]+\.(jpg|png|webp|pdf)$/.test(f.stored) || !fs.existsSync(full)) throw new HttpError(404, 'File not found on disk.');
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

/* ---- employee KYC verification and update ---- */
route('POST', '/api/employees/:id/kyc', { mod: ['hrms'] }, async ({ req, res, user, params }) => {
  const emp = findDoc('employees', params.id);
  const b = await readJson(req);
  if (b.parentsName !== undefined) emp.parentsName = String(b.parentsName || '').trim();
  if (b.parentsPhone !== undefined) emp.parentsPhone = String(b.parentsPhone || '').trim();
  if (b.siblingName !== undefined) emp.siblingName = String(b.siblingName || '').trim();
  if (b.siblingPhone !== undefined) emp.siblingPhone = String(b.siblingPhone || '').trim();
  if (b.livingStatus !== undefined) emp.livingStatus = String(b.livingStatus || 'Own House').trim();
  if (b.roomOwnerName !== undefined) emp.roomOwnerName = String(b.roomOwnerName || '').trim();
  if (b.roomOwnerPhone !== undefined) emp.roomOwnerPhone = String(b.roomOwnerPhone || '').trim();
  if (b.roomAddress !== undefined) emp.roomAddress = String(b.roomAddress || '').trim();
  if (b.bankName !== undefined) emp.bankName = String(b.bankName || '').trim();
  if (b.bankAccount !== undefined) emp.bankAccount = String(b.bankAccount || '').trim();
  if (b.bankIfsc !== undefined) emp.bankIfsc = String(b.bankIfsc || '').trim().toUpperCase();
  if (b.bankAccountHolder !== undefined) emp.bankAccountHolder = String(b.bankAccountHolder || '').trim();
  if (b.panNumber !== undefined) emp.panNumber = String(b.panNumber || '').trim().toUpperCase();
  if (b.aadhaarNumber !== undefined) emp.aadhaarNumber = String(b.aadhaarNumber || '').trim();
  if (b.uanNumber !== undefined) emp.uanNumber = String(b.uanNumber || '').trim();
  if (b.esicNumber !== undefined) emp.esicNumber = String(b.esicNumber || '').trim();
  if (b.highestCollege !== undefined) emp.highestCollege = String(b.highestCollege || '').trim();
  if (b.permAddress !== undefined && b.permAddress) emp.permAddress = String(b.permAddress || '').trim();
  if (b.address !== undefined && b.address) emp.address = String(b.address || '').trim();
  if (b.kycNotes !== undefined) emp.kycNotes = String(b.kycNotes || '').trim();
  if (b.kycStatus !== undefined) emp.kycStatus = String(b.kycStatus || 'Pending Verification').trim();
  delete emp.sample;
  await store.save();
  send(res, 200, { ok: true, emp });
});

route('POST', '/api/employees/:id/kyc/verify', { mod: ['hrms'] }, async ({ req, res, user, params }) => {
  const emp = findDoc('employees', params.id);
  emp.kycStatus = 'Verified & Cleared';
  emp.kycVerifiedAt = today();
  emp.kycVerifiedBy = user.name || 'HR Operations';
  delete emp.sample;
  await store.save();
  send(res, 200, { ok: true, kycStatus: emp.kycStatus, kycVerifiedAt: emp.kycVerifiedAt, kycVerifiedBy: emp.kycVerifiedBy });
});

route('POST', '/api/employees/:id/kyc/sync-aadhaar', { mod: ['hrms'] }, async ({ req, res, user, params }) => {
  const emp = findDoc('employees', params.id);
  const aadhaarFiles = (db().files || []).filter(f => f.employeeId === emp.id && (/aadhaar|adhar/i.test(f.kind) || /aadhaar|adhar/i.test(f.name)));
  if (!aadhaarFiles.length) throw new HttpError(404, 'No Aadhaar document found for this employee. Please upload an Aadhaar card first.');

  let extracted = null;
  for (const f of aadhaarFiles) {
    const full = path.join(UPLOADS, f.stored);
    let buf = null;
    if (fs.existsSync(full)) {
      try { buf = await fsp.readFile(full); } catch (_) {}
    } else if (f.dataBase64) {
      try {
        buf = Buffer.from(f.dataBase64, 'base64');
        await fsp.writeFile(full, buf).catch(() => {});
      } catch (_) {}
    }
    if (buf) {
      try {
        const ocrRes = await docOcr.processDocumentOcr(buf, f.mime, f.kind, f.name, emp.name, emp.parentsName);
        if (ocrRes && ocrRes.extracted && (ocrRes.extracted.address || ocrRes.extracted.aadhaarNumber)) {
          extracted = ocrRes.extracted;
          if (extracted.address) {
            emp.permAddress = extracted.address;
            if (!emp.address) emp.address = extracted.address;
          }
          if (extracted.aadhaarNumber) {
            emp.aadhaarNumber = extracted.aadhaarNumber;
            if (!emp.idNumber) {
              emp.idNumber = extracted.aadhaarNumber;
              emp.idType = 'Aadhaar';
            }
          }
          if (extracted.parentsName && !emp.parentsName) emp.parentsName = extracted.parentsName;
          break;
        }
      } catch (err) {
        console.warn('OCR error during sync-aadhaar:', err);
      }
    }
  }
  if (!extracted || !extracted.address) {
    throw new HttpError(400, 'Could not detect text address automatically from the uploaded Aadhaar file. Please enter the permanent address manually.');
  }
  delete emp.sample;
  await store.save();
  send(res, 200, { ok: true, address: emp.permAddress, aadhaarNo: emp.aadhaarNumber, parentsName: emp.parentsName });
});

/* Re-scan, reclassify and deduplicate all existing documents of an employee */
route('POST', '/api/employees/:id/kyc/reclassify-documents', { mod: ['hrms'] }, async ({ req, res, user, params }) => {
  const emp = findDoc('employees', params.id);
  const empFiles = (db().files || []).filter(f => f.employeeId === emp.id && f.kind !== 'photo');
  let updatedCount = 0;

  for (const f of empFiles) {
    const full = path.join(UPLOADS, f.stored);
    let buf = null;
    if (fs.existsSync(full)) {
      try { buf = await fsp.readFile(full); } catch (_) {}
    } else if (f.dataBase64) {
      try {
        buf = Buffer.from(f.dataBase64, 'base64');
        await fsp.writeFile(full, buf).catch(() => {});
      } catch (_) {}
    }
    if (buf) {
      const ocrRes = await docOcr.processDocumentOcr(buf, f.mime, f.kind, f.name, emp.name, emp.parentsName);
      if (ocrRes && ocrRes.docType && ocrRes.docType !== 'Other') {
        f.kind = ocrRes.docType;
        updatedCount++;
      }
      if (ocrRes && ocrRes.extracted) {
        const ex = ocrRes.extracted;
        if (f.kind === 'Aadhaar Card') {
          if (ex.aadhaarNumber) {
            emp.aadhaarNumber = ex.aadhaarNumber;
            if (!emp.idNumber) { emp.idNumber = ex.aadhaarNumber; emp.idType = 'Aadhaar'; }
          }
          if (ex.address) {
            emp.permAddress = ex.address;
            if (!emp.address) emp.address = ex.address;
          }
          if (ex.parentsName && !emp.parentsName) emp.parentsName = ex.parentsName;
          if (ex.dob && !emp.dob) emp.dob = ex.dob;
        } else if (f.kind === 'PAN Card') {
          if (ex.panNumber) {
            emp.panNumber = ex.panNumber;
            if (!emp.idNumber || emp.idType === 'PAN') { emp.idNumber = ex.panNumber; emp.idType = 'PAN'; }
          }
          if (ex.parentsName && !emp.parentsName) emp.parentsName = ex.parentsName;
          if (ex.dob && !emp.dob) emp.dob = ex.dob;
        } else if (f.kind === 'College Certificate') {
          if (ex.highestCollege && !emp.highestCollege) emp.highestCollege = ex.highestCollege;
        }
      }
    }
  }

  // Deduplicate files of same kind (e.g. keeping only the latest Aadhaar/PAN/College certificate)
  const uniqueKinds = ['Aadhaar Card', 'PAN Card', 'College Certificate', 'Rent Agreement'];
  for (const uk of uniqueKinds) {
    const matching = (db().files || [])
      .filter(f => f.employeeId === emp.id && f.kind === uk)
      .sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));
    if (matching.length > 1) {
      // Keep matching[0], remove the rest
      for (let i = 1; i < matching.length; i++) {
        await removeFile(matching[i]).catch(() => {});
      }
    }
  }

  // Sanitize PAN vs Aadhaar numbers
  if (emp.panNumber && /^\d{12}$/.test(emp.panNumber.replace(/\s+/g, ''))) {
    if (!emp.aadhaarNumber) emp.aadhaarNumber = docOcr.cleanAadhaarNo(emp.panNumber);
    emp.panNumber = '';
  }

  delete emp.sample;
  await store.save();
  send(res, 200, {
    ok: true,
    updatedCount,
    address: emp.permAddress,
    aadhaarNo: emp.aadhaarNumber,
    panNo: emp.panNumber,
    parentsName: emp.parentsName,
    message: `Re-scanned & corrected ${updatedCount} document(s)`
  });
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
  let portalUrl = 'https://erp-rvmaitech.onrender.com';
  if (host && host.includes('render.com')) {
    portalUrl = `https://${host.replace(/^https?:\/\//, '')}`;
  }
  send(res, 200, {
    ok: true,
    empId: emp.id,
    name: emp.name,
    email: emp.email || '',
    loginId,
    tempPassword: tempPass,
    portalUrl
  });
});

route('POST', '/api/employees/:id/send-email', { mod: ['hrms'] }, async ({ req, res, user, params }) => {
  const emp = findDoc('employees', params.id);
  if (!emp.email) throw new HttpError(400, 'Employee does not have an email address recorded. Please add an email in employee details first.');
  const host = req.headers.host || `localhost:${PORT}`;
  let portalUrl = 'https://erp-rvmaitech.onrender.com';
  if (host && host.includes('render.com')) {
    portalUrl = `https://${host.replace(/^https?:\/\//, '')}`;
  }

  // Ensure guaranteed login ID and temporary password
  const loginId = emp.userLoginId || (emp.code ? emp.code.toLowerCase().replace(/[^a-z0-9]/g, '') : 'emp');
  let tempPass = emp.tempPassword;
  let userAccount = db().users.find(x => x.empId === emp.id || x.loginId === loginId);
  if (!tempPass || tempPass === 'Check with HR' || !userAccount) {
    tempPass = Math.random().toString(36).slice(2, 6) + '-' + Math.random().toString(36).slice(2, 6) + '-' + Math.random().toString(36).slice(2, 6);
    emp.tempPassword = tempPass;
    emp.userLoginId = loginId;
    emp.status = 'Registered';
    const passHash = await hashPassword(tempPass);
    if (!userAccount) {
      userAccount = {
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
      db().users.push(userAccount);
    } else {
      userAccount.passHash = passHash;
      userAccount.active = true;
      userAccount.role = 'employee';
      userAccount.empId = emp.id;
      userAccount.loginId = loginId;
    }
    await store.save();
  }

  const companyName = db().company.name || 'RvmAiTech Solutions Private Limited';
  const basic = Math.round(Number(emp.salary || 0) * 0.5);
  const hra = Math.round(Number(emp.salary || 0) * 0.3);
  const allowance = Math.max(0, Number(emp.salary || 0) - basic - hra);
  const annualCtc = Number(emp.salary || 0) * 12;
  const year = new Date().getFullYear();

  const cleanCode = (emp.code || 'EMP').replace(/[^a-zA-Z0-9_-]/g, '');
  const offerFileName = `Offer_Letter_${cleanCode}.pdf`;
  const joinFileName = `Joining_Letter_${cleanCode}.pdf`;
  const idCardFileName = `Employee_ID_Card_${cleanCode}.pdf`;

  const offerUrl = `${portalUrl}/api/pdf/offer-letter/${emp.id}`;
  const joinUrl = `${portalUrl}/api/pdf/joining-letter/${emp.id}`;
  const idCardUrl = `${portalUrl}/api/pdf/id-card/${emp.id}`;

  const subject = `Welcome to ${companyName} - Employment Offer Letter & Portal Login (${emp.code || emp.name})`;

  const bodyText = `Namaste ${emp.name},

Congratulations! We are delighted to welcome you to RvmAiTech Solutions Private Limited.
Your employee registration is complete. Your official Employee Self-Service (ESS) Portal login details and attached onboarding letters are provided below:

============================================================
🔑 YOUR EMPLOYEE PORTAL CREDENTIALS
============================================================
Portal Website:       ${portalUrl}
Your Login ID:        ${loginId}
Temporary Password:   ${tempPass}

Login URL: ${portalUrl}
(Please sign in using your Login ID & Temporary Password to mark attendance, submit daily work updates "Kal kya kiya, aaj kya karenge", view salary slips, and access your profile).

============================================================
1. OFFICIAL OFFER LETTER SUMMARY
============================================================
Reference No: RAT/HR/OFFER/${year}/${emp.code || 'EMP'}
Employee Code: ${emp.code || 'EMP-001'}
Designation / Role: ${emp.role || 'Staff'}
Department: ${emp.dept || 'Operations'}
Gross Monthly Salary: Rs. ${Number(emp.salary || 0).toLocaleString('en-IN')} / month
Annual CTC: Rs. ${annualCtc.toLocaleString('en-IN')} per annum
Standard Shift: 8 Hours / Day (09:00 AM - 05:00 PM)
Date of Joining: ${emp.joined || today()}

Salary Structure:
  - Basic Salary (50%): Rs. ${basic.toLocaleString('en-IN')} / month
  - House Rent Allowance (HRA 30%): Rs. ${hra.toLocaleString('en-IN')} / month
  - Special / Shift Allowance (20%): Rs. ${allowance.toLocaleString('en-IN')} / month

============================================================
2. JOINING CONFIRMATION & APPOINTMENT
============================================================
Reference No: RAT/HR/JOIN/${year}/${emp.code || 'EMP'}
Confirmed Joining: ${emp.joined || today()}
Designation: ${emp.role || 'Staff'}

============================================================
3. ATTACHED OFFICIAL PDF DOCUMENTS
============================================================
1. ${offerFileName} — Direct Download: ${offerUrl}
2. ${joinFileName} — Direct Download: ${joinUrl}
3. ${idCardFileName} — Direct Download: ${idCardUrl}

For any queries, please reply to this email (${SENDER_EMAIL}).

Warm regards,
HR Operations Team
RvmAiTech Solutions Private Limited
Cyber City, Mansarovar, Jaipur, Rajasthan - 302020
`;

  const bodyHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${subject}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #0f172a; line-height: 1.5; }
  .email-wrap { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #cbd5e1; }
  .email-header { background: #0d2649; padding: 28px 24px 22px; text-align: center; border-bottom: 4px solid #f47b20; }
  .email-header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
  .email-header p { color: #38bdf8; margin: 6px 0 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
  .email-body { padding: 28px 24px; }
  .greeting { font-size: 16px; font-weight: 700; color: #0d2649; margin-bottom: 12px; }
  .lead-text { font-size: 14px; color: #334155; margin-bottom: 22px; line-height: 1.6; }
  .creds-card { background: linear-gradient(135deg, #0d2649 0%, #123a72 100%); border-radius: 10px; padding: 22px; margin: 24px 0; color: #ffffff; box-shadow: 0 4px 16px rgba(13,38,73,0.3); border-left: 6px solid #f47b20; }
  .creds-title { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #38bdf8; margin: 0 0 14px; }
  .creds-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  .creds-table td { padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.12); font-size: 13.5px; }
  .creds-table td:first-child { color: #cbd5e1; font-weight: 600; width: 38%; }
  .creds-table td:last-child { color: #ffffff; font-weight: 700; font-family: monospace; font-size: 14.5px; }
  .creds-badge { background: rgba(56,189,248,0.2); color: #38bdf8; padding: 3px 8px; border-radius: 4px; border: 1px solid rgba(56,189,248,0.35); }
  .btn-login { display: block; text-align: center; background: #f47b20; color: #ffffff !important; font-size: 15px; font-weight: 800; text-decoration: none; padding: 14px 20px; border-radius: 8px; box-shadow: 0 4px 14px rgba(244,123,32,0.4); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 10px; }
  .section-title { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #0d2649; margin: 24px 0 10px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
  .info-grid { width: 100%; border-collapse: collapse; margin-bottom: 16px; background: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; }
  .info-grid td { padding: 8px 12px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
  .info-grid td:first-child { font-weight: 600; color: #64748b; width: 40%; }
  .info-grid td:last-child { font-weight: 700; color: #0f172a; }
  .docs-box { background: #f0f9ff; border: 1.5px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 20px 0; }
  .doc-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e0f2fe; font-size: 13px; }
  .doc-row:last-child { border-bottom: 0; }
  .doc-name { font-weight: 700; color: #0369a1; }
  .doc-link { color: #0284c7; text-decoration: underline; font-weight: 700; font-size: 12px; }
  .footer { background: #f8fafc; padding: 20px 24px; text-align: center; font-size: 11.5px; color: #64748b; border-top: 1px solid #e2e8f0; line-height: 1.6; }
</style>
</head>
<body>
  <div class="email-wrap">
    <div class="email-header">
      <h1>RvmAiTech Solutions</h1>
      <p>Intelligent Automation & Enterprise Systems</p>
    </div>
    
    <div class="email-body">
      <div class="greeting">Namaste ${emp.name},</div>
      <div class="lead-text">
        Congratulations and welcome to <b>RvmAiTech Solutions Private Limited</b>! Your employee onboarding has been confirmed. Below are your official <b>HRMS Employee Portal Login credentials</b> and attached onboarding documents.
      </div>

      <!-- PORTAL LOGIN CREDENTIALS BOX -->
      <div class="creds-card">
        <div class="creds-title">🔑 YOUR EMPLOYEE PORTAL LOGIN DETAILS</div>
        <table class="creds-table">
          <tr>
            <td>Portal Website:</td>
            <td><a href="${portalUrl}" style="color:#38bdf8;text-decoration:underline;">${portalUrl}</a></td>
          </tr>
          <tr>
            <td>Your Login ID:</td>
            <td><span class="creds-badge">${loginId}</span></td>
          </tr>
          <tr>
            <td>Temporary Password:</td>
            <td><span class="creds-badge">${tempPass}</span></td>
          </tr>
        </table>
        
        <a href="${portalUrl}" class="btn-login" target="_blank" rel="noopener">
          👉 Click Here to Open Portal & Login
        </a>
      </div>

      <p style="font-size:12.5px;color:#475569;margin:-8px 0 20px;">
        💡 <b>What you can do after logging in:</b> Mark daily attendance, submit daily work updates ("Kal kya kiya, aaj kya karenge"), view your monthly salary payslips, and access your project tasks.
      </p>

      <!-- APPOINTMENT SUMMARY -->
      <div class="section-title">📋 Employment Appointment Summary</div>
      <table class="info-grid">
        <tr>
          <td>Employee Code:</td>
          <td>${emp.code || 'EMP-001'}</td>
        </tr>
        <tr>
          <td>Designation / Role:</td>
          <td>${emp.role || 'Staff'}</td>
        </tr>
        <tr>
          <td>Department:</td>
          <td>${emp.dept || 'Operations'}</td>
        </tr>
        <tr>
          <td>Gross Monthly Salary:</td>
          <td>₹${Number(emp.salary || 0).toLocaleString('en-IN')} / month</td>
        </tr>
        <tr>
          <td>Annual CTC:</td>
          <td>₹${annualCtc.toLocaleString('en-IN')} per annum</td>
        </tr>
        <tr>
          <td>Operational Shift:</td>
          <td>8 Hours / Day (09:00 AM – 05:00 PM)</td>
        </tr>
        <tr>
          <td>Reporting Date:</td>
          <td>${fmtDate(emp.joined)}</td>
        </tr>
      </table>

      <!-- ATTACHED DOCUMENTS -->
      <div class="docs-box">
        <div style="font-size:12.5px;font-weight:800;color:#0369a1;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em">
          📎 3 Official PDF Documents Attached to this Email:
        </div>
        <div class="doc-row">
          <span class="doc-name">📄 1. Employment Offer Letter (${cleanCode})</span>
          <a href="${offerUrl}" class="doc-link" target="_blank">Download PDF</a>
        </div>
        <div class="doc-row">
          <span class="doc-name">📜 2. Appointment & Joining Order (${cleanCode})</span>
          <a href="${joinUrl}" class="doc-link" target="_blank">Download PDF</a>
        </div>
        <div class="doc-row">
          <span class="doc-name">🪪 3. Official Employee ID Card (${cleanCode})</span>
          <a href="${idCardUrl}" class="doc-link" target="_blank">Download PDF</a>
        </div>
      </div>

      <p style="font-size:12.5px;color:#64748b;margin-top:20px;">
        For any onboarding queries or documentation assistance, please contact HR Operations at <a href="mailto:${SENDER_EMAIL}" style="color:#0284c7;">${SENDER_EMAIL}</a>.
      </p>
    </div>

    <div class="footer">
      <b>RvmAiTech Solutions Private Limited</b><br>
      CIN: U72900RJ2026PTC089123 · GSTIN: 08AABCR1234F1Z0 · PAN: AAACE0836F<br>
      Registered Office: Cyber City, Mansarovar, Jaipur, Rajasthan - 302020<br>
      Official Support: ${SENDER_EMAIL} · +91 7052050656
    </div>
  </div>
</body>
</html>`;

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

  const attachments = [];
  if (offerPdf) attachments.push({ filename: offerFileName, content: offerPdf, contentType: 'application/pdf' });
  if (joinPdf) attachments.push({ filename: joinFileName, content: joinPdf, contentType: 'application/pdf' });
  if (idCardPdf) attachments.push({ filename: idCardFileName, content: idCardPdf, contentType: 'application/pdf' });

  const fullEmailText = bodyText;
  const smtpRes = await sendGmailSmtp({ to: emp.email, subject, text: fullEmailText, html: bodyHtml, from: SENDER_EMAIL, attachments });

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

/* ---------------- Recruitment & Candidate Hiring Endpoints ---------------- */
route('POST', '/api/careers/apply', { open: true }, async ({ req, res }) => {
  const b = await readJson(req);
  const name = String(b.name || b.fullName || '').trim().slice(0, 120);
  const email = String(b.email || '').trim().slice(0, 120);
  const phone = String(b.phone || b.whatsapp || '').trim().slice(0, 30);
  const role = String(b.role || b.position || 'General application').trim().slice(0, 80);
  if (!name || !email || !phone) throw new HttpError(400, 'Name, email and phone number are required.');

  // Handle uploaded base64 resume if present
  let resumeId = '';
  let resumeName = String(b.resumeName || b.fileName || 'Resume.pdf').replace(/[\u0000-\u001F\u007F"\\/:*?<>|]/g, '').trim().slice(0, 150) || 'Resume.pdf';
  if (b.resumeData || b.resumeBase64 || b.resume) {
    try {
      const rawData = String(b.resumeData || b.resumeBase64 || b.resume);
      const base64Str = rawData.includes('base64,') ? rawData.split('base64,')[1] : rawData;
      const buf = Buffer.from(base64Str, 'base64');
      if (buf.length > 0 && buf.length <= 12 * 1024 * 1024) {
        resumeId = newId('f');
        let ext = 'pdf';
        let mime = 'application/pdf';
        const lower = resumeName.toLowerCase();
        if (lower.endsWith('.docx')) { ext = 'docx'; mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'; }
        else if (lower.endsWith('.doc')) { ext = 'doc'; mime = 'application/msword'; }
        else if (lower.endsWith('.png')) { ext = 'png'; mime = 'image/png'; }
        else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) { ext = 'jpg'; mime = 'image/jpeg'; }
        const stored = resumeId + '.' + ext;
        await fsp.writeFile(path.join(UPLOADS, stored), buf);
        db().files = db().files || [];
        db().files.push({
          id: resumeId,
          kind: 'Resume',
          name: resumeName,
          mime,
          size: buf.length,
          stored,
          dataBase64: buf.length <= 4 * 1024 * 1024 ? buf.toString('base64') : undefined,
          uploadedAt: Date.now()
        });
      }
    } catch (err) {
      console.error('[apply] Failed to save resume buffer:', err);
    }
  }

  // Parse salary / CTC
  let expSalaryNum = Number(b.expectedSalary || 0);
  if (!expSalaryNum && (b.expectedCtc || b.expectedSalary)) {
    const rawCtc = String(b.expectedCtc || b.expectedSalary || '');
    const m = rawCtc.match(/(\d+(\.\d+)?)/);
    if (m) {
      const val = parseFloat(m[1]);
      expSalaryNum = rawCtc.toLowerCase().includes('lpa') ? Math.round((val * 100000) / 12) : Math.round(val);
    }
  }

  db().candidates = db().candidates || [];
  const cand = {
    id: newId('cand'),
    name,
    email,
    phone,
    role,
    dept: String(b.dept || b.department || 'Engineering').trim().slice(0, 60),
    qualification: String(b.qualification || b.highestQualification || '').trim().slice(0, 120),
    experience: String(b.experience || b.totalExperience || 'Fresher').trim().slice(0, 60),
    linkedin: String(b.linkedin || b.portfolio || b.portfolioUrl || '').trim().slice(0, 250),
    currentCompany: String(b.currentCompany || '').trim().slice(0, 120),
    currentDesignation: String(b.currentDesignation || b.currentRole || '').trim().slice(0, 120),
    currentCtc: String(b.currentCtc || b.currentSalary || '').trim().slice(0, 60),
    expectedCtc: String(b.expectedCtc || (expSalaryNum ? `₹${(expSalaryNum * 12 / 100000).toFixed(1)} LPA` : '')).trim().slice(0, 60),
    expectedSalary: expSalaryNum,
    offeredSalary: Number(b.offeredSalary || expSalaryNum || 0),
    noticePeriod: String(b.noticePeriod || '').trim().slice(0, 60),
    whyHire: String(b.whyHire || b.whyShouldWeHireYou || b.coverLetter || '').trim().slice(0, 2000),
    resumeId,
    resumeName: resumeId ? resumeName : (b.resumeName || ''),
    resumeUrl: String(b.resumeUrl || '').trim().slice(0, 500),
    interviewDate: String(b.interviewDate || '').trim(),
    joiningDate: String(b.joiningDate || '').trim(),
    status: 'Applied',
    source: String(b.source || 'Website Careers Form').trim().slice(0, 60),
    notes: String(b.notes || b.message || b.whyHire || 'Applied via website careers form').trim().slice(0, 1000),
    address: String(b.address || b.location || b.currentLocation || '').trim().slice(0, 300),
    createdAt: Date.now()
  };
  db().candidates.push(cand);
  await store.save();
  send(res, 201, { ok: true, id: cand.id, message: 'Application submitted successfully! Our HR team will contact you.' });
});

/* Serve candidate resume file directly (inline view/download) - fallback to dynamic Executive CV PDF */
route('GET', '/api/candidates/:id/resume', { open: true }, async ({ req, res, params }) => {
  db().candidates = db().candidates || [];
  const cand = db().candidates.find(c => c.id === params.id);
  if (!cand) throw new HttpError(404, 'Candidate not found.');

  // If candidate has an external resume URL (e.g. Google Drive) and no uploaded file
  if (cand.resumeUrl && !cand.resumeId) {
    res.writeHead(302, { Location: cand.resumeUrl });
    return res.end();
  }

  const f = db().files && db().files.find(x => x.id === cand.resumeId);
  let fileBuf = null;
  let mime = (f && f.mime) || 'application/pdf';
  let filename = (f && f.name) || `${(cand.name || 'Candidate').replace(/\s+/g, '_')}_Resume.pdf`;

  if (f && f.stored) {
    const full = path.join(UPLOADS, f.stored);
    if (fs.existsSync(full)) {
      try { fileBuf = await fsp.readFile(full); } catch (_) {}
    } else if (f.dataBase64) {
      try {
        fileBuf = Buffer.from(f.dataBase64, 'base64');
        await fsp.writeFile(full, fileBuf).catch(() => {});
      } catch (_) {}
    }
  }

  // Fallback: If resume file not on disk or not uploaded, generate official Candidate CV PDF
  if (!fileBuf) {
    try {
      fileBuf = await pdfGen.generateCandidateResumePdf(cand, db().company);
      mime = 'application/pdf';
      filename = `${(cand.name || 'Candidate').replace(/\s+/g, '_')}_Resume.pdf`;
      const genId = f ? f.id : newId('f');
      const stored = genId + '.pdf';
      await fsp.writeFile(path.join(UPLOADS, stored), fileBuf).catch(() => {});
      if (!cand.resumeId) {
        cand.resumeId = genId;
        cand.resumeName = filename;
        db().files = db().files || [];
        db().files.push({
          id: genId,
          kind: 'Resume',
          name: filename,
          mime: 'application/pdf',
          size: fileBuf.length,
          stored,
          dataBase64: fileBuf.length <= 4 * 1024 * 1024 ? fileBuf.toString('base64') : undefined,
          uploadedAt: Date.now()
        });
        await store.save().catch(() => {});
      }
    } catch (pdfErr) {
      console.error('[resume] Failed to generate dynamic CV PDF:', pdfErr);
      throw new HttpError(500, 'Unable to generate candidate resume document.');
    }
  }

  res.removeHeader('Content-Security-Policy');
  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Length': fileBuf.length,
    'Cache-Control': 'private, max-age=600',
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(filename)}`
  });
  res.end(fileBuf);
});

/* Upload or replace candidate resume from HRMS */
route('POST', '/api/candidates/:id/resume', { mod: ['hrms'] }, async ({ req, res, user, params, query }) => {
  db().candidates = db().candidates || [];
  const cand = db().candidates.find(c => c.id === params.id);
  if (!cand) throw new HttpError(404, 'Candidate not found.');

  const buf = await readBody(req, 12 * 1024 * 1024, 'Resume file');
  let type = sniff(buf);
  let ext = 'pdf', mime = 'application/pdf';
  const name = String(query.get('name') || 'Resume.pdf').replace(/[\u0000-\u001F\u007F"\\/:*?<>|]/g, '').trim().slice(0, 150) || 'Resume.pdf';
  const lower = name.toLowerCase();

  if (type) {
    mime = type[0];
    ext = type[1];
  } else if (lower.endsWith('.docx')) {
    ext = 'docx'; mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  } else if (lower.endsWith('.doc')) {
    ext = 'doc'; mime = 'application/msword';
  } else if (lower.endsWith('.pdf')) {
    ext = 'pdf'; mime = 'application/pdf';
  } else {
    throw new HttpError(415, 'Only PDF, DOC or DOCX files can be uploaded as resume.');
  }

  const id = newId('f');
  const stored = id + '.' + ext;
  await fsp.writeFile(path.join(UPLOADS, stored), buf);

  db().files = db().files || [];
  db().files.push({
    id,
    kind: 'Resume',
    name,
    mime,
    size: buf.length,
    stored,
    dataBase64: buf.length <= 4 * 1024 * 1024 ? buf.toString('base64') : undefined,
    uploadedAt: Date.now(),
    uploadedBy: user.id
  });

  cand.resumeId = id;
  cand.resumeName = name;
  await store.save();

  send(res, 201, { ok: true, resumeId: id, resumeName: name });
});

/* ---- Schedule Interview & Dispatch Official Call Letter PDF & Email ---- */
route('POST', '/api/candidates/:id/schedule-interview', { mod: ['hrms'] }, async ({ req, res, user, params }) => {
  db().candidates = db().candidates || [];
  const cand = db().candidates.find(c => c.id === params.id);
  if (!cand) throw new HttpError(404, 'Candidate not found.');
  if (!cand.email) throw new HttpError(400, 'Candidate does not have an email address recorded. Please add an email in candidate details first.');

  const b = await readJson(req);
  cand.status = 'Interview Scheduled';
  cand.interviewDate = String(b.interviewDate || cand.interviewDate || today()).trim();
  cand.interviewTime = String(b.interviewTime || cand.interviewTime || '11:00 AM').trim();
  cand.interviewMode = String(b.interviewMode || cand.interviewMode || 'Offline (In-Person)').trim();
  cand.interviewLocation = String(b.interviewLocation || cand.interviewLocation || db().company.address || 'Sharmik Vihar, Sec 31, Faridabad, Haryana - 121003').trim();
  cand.interviewer = String(b.interviewer || cand.interviewer || 'Vivek Kumar Bhardwaj / HR Team').trim();
  if (b.notes !== undefined) cand.notes = String(b.notes || '').trim();
  cand.interviewSentAt = Date.now();

  let interviewPdf = null;
  try {
    interviewPdf = await pdfGen.generateInterviewLetterPdf(cand, db().company);
  } catch (err) {
    console.error('Interview PDF generation error:', err);
  }

  const pdfFileName = `Interview_Call_Letter_${cand.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  const subject = `Interview Invitation from RvmAiTech - ${cand.role || 'Position'} | ${cand.name}`;

  const bodyText = `Dear ${cand.name},

Greetings from RvmAiTech!

We are pleased to inform you that your application for the position of ${cand.role || 'Staff'} has been shortlisted.
We would like to invite you for an interview. Please find the interview details below:

Interview Details
Company: RvmAiTech
Position: ${cand.role || 'Staff'}
Interview Date: ${fmtDate(cand.interviewDate)}
Interview Time: ${cand.interviewTime || '11:00 AM'}
Interview Mode: ${cand.interviewMode || 'Offline (In-Person)'}
Interview Location: ${cand.interviewLocation}
Interviewer: ${cand.interviewer}

Important Instructions:
• Please join or arrive 10–15 minutes before the scheduled time.
• Keep your updated resume/CV ready.
• Carry relevant documents and certificates if attending offline.
• Please ensure a stable internet connection for an online interview.
• If you are unable to attend at the scheduled time, inform us in advance.
• Kindly reply to this email to confirm your availability.

We look forward to meeting you.

Best Regards,
HR Department
RvmAiTech
Email: rvmaitech2026@gmail.com
WhatsApp: 7052050656
Smart Solutions. Intelligent Automation. Reliable Technology.
`;

  const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; background: #f8fafc; margin: 0; padding: 20px; line-height: 1.6; }
.card { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
.header { background: linear-gradient(135deg, #0d2649 0%, #0284c7 100%); padding: 24px 28px; color: #ffffff; }
.header h1 { margin: 0; font-size: 21px; font-weight: 800; letter-spacing: -0.02em; }
.header p { margin: 4px 0 0; font-size: 13px; color: #bae6fd; }
.content { padding: 26px 28px; }
.salutation { font-size: 15.5px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
.msg { font-size: 13.5px; color: #334155; margin-bottom: 20px; }
.details-box { background: #f0f9ff; border: 1.5px solid #0284c7; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px; }
.details-title { font-size: 13.5px; font-weight: 800; color: #0369a1; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; border-bottom: 1px solid #bae6fd; padding-bottom: 6px; }
.table { width: 100%; border-collapse: collapse; font-size: 13px; }
.table td { padding: 5px 0; vertical-align: top; }
.table td.lbl { width: 140px; font-weight: 700; color: #0369a1; }
.table td.val { font-weight: 600; color: #0f172a; }
.inst-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px; }
.inst-title { font-size: 13px; font-weight: 800; color: #0d2649; text-transform: uppercase; margin-bottom: 8px; }
.inst-list { margin: 0; padding-left: 20px; font-size: 13px; color: #334155; }
.inst-list li { margin-bottom: 5px; }
.footer { background: #f1f5f9; padding: 18px 28px; font-size: 12px; color: #475569; border-top: 1px solid #e2e8f0; }
.footer b { color: #0d2649; }
.tagline { color: #0284c7; font-weight: 700; font-size: 11.5px; margin-top: 6px; }
</style></head>
<body>
<div class="card">
  <div class="header">
    <h1>RvmAiTech Solutions</h1>
    <p>Official Interview Invitation & Shortlisting Notification</p>
  </div>
  <div class="content">
    <div class="salutation">Dear ${cand.name},</div>
    <div class="msg">
      Greetings from <b>RvmAiTech</b>!<br><br>
      We are pleased to inform you that your application for the position of <b>${cand.role || 'Staff'}</b> has been shortlisted.<br>
      We would like to invite you for an interview. Please find the interview details below:
    </div>

    <div class="details-box">
      <div class="details-title">📅 Interview Details</div>
      <table class="table">
        <tr><td class="lbl">Company:</td><td class="val">RvmAiTech Solutions Private Limited</td></tr>
        <tr><td class="lbl">Position:</td><td class="val">${cand.role || 'Staff'}</td></tr>
        <tr><td class="lbl">Interview Date:</td><td class="val">${fmtDate(cand.interviewDate)}</td></tr>
        <tr><td class="lbl">Interview Time:</td><td class="val">${cand.interviewTime || '11:00 AM'}</td></tr>
        <tr><td class="lbl">Interview Mode:</td><td class="val">${cand.interviewMode || 'Offline (In-Person)'}</td></tr>
        <tr><td class="lbl">Interview Location:</td><td class="val">${cand.interviewLocation}</td></tr>
        <tr><td class="lbl">Interviewer:</td><td class="val">${cand.interviewer}</td></tr>
        ${cand.notes ? `<tr><td class="lbl">Special Note:</td><td class="val">${cand.notes}</td></tr>` : ''}
      </table>
    </div>

    <div class="inst-box">
      <div class="inst-title">📋 Important Instructions:</div>
      <ul class="inst-list">
        <li>Please join or arrive 10–15 minutes before the scheduled time.</li>
        <li>Keep your updated resume/CV ready.</li>
        <li>Carry relevant documents and certificates if attending offline.</li>
        <li>Please ensure a stable internet connection for an online interview.</li>
        <li>If you are unable to attend at the scheduled time, inform us in advance.</li>
        <li><b>Kindly reply to this email to confirm your availability.</b></li>
      </ul>
    </div>

    <p style="font-size:13px;color:#334155;margin:0 0 14px;">
      <b>Attached Document:</b> Official signed PDF Call Letter (<b>${pdfFileName}</b>) is attached with this email for your records and security gate entry.
    </p>

    <p style="font-size:13.5px;color:#0f172a;margin:0;">
      We look forward to meeting you.<br><br>
      Best Regards,<br>
      <b>HR Department</b><br>
      RvmAiTech
    </p>
  </div>
  <div class="footer">
    <b>Email:</b> <a href="mailto:rvmaitech2026@gmail.com">rvmaitech2026@gmail.com</a> | <b>WhatsApp:</b> 7052050656<br>
    <b>Office Address:</b> Sharmik Vihar, Sec 31, Faridabad, Haryana - 121003<br>
    <div class="tagline">Smart Solutions. Intelligent Automation. Reliable Technology.</div>
  </div>
</div>
</body></html>`;

  const attachments = [];
  if (interviewPdf) {
    attachments.push({
      filename: pdfFileName,
      content: interviewPdf,
      contentType: 'application/pdf'
    });
  }

  let emailSent = false, emailError = null;
  try {
    const smtpRes = await sendGmailSmtp({
      to: cand.email,
      subject,
      text: bodyText,
      html: htmlBody,
      from: SENDER_EMAIL,
      attachments
    });
    emailSent = !!(smtpRes && smtpRes.ok);
    if (!emailSent && smtpRes && smtpRes.error) emailError = smtpRes.error;
  } catch (mErr) {
    console.error('SMTP interview invite error:', mErr);
    emailError = mErr.message;
  }

  db().emailOutbox = db().emailOutbox || [];
  db().emailOutbox.push({
    id: newId('em'),
    to: cand.email,
    recipientName: cand.name,
    subject,
    body: bodyText,
    sentAt: Date.now(),
    status: emailSent ? 'Sent' : 'Failed',
    error: emailError,
    type: 'Interview Invitation',
    attachmentsCount: attachments.length
  });

  await store.save();
  send(res, 200, { ok: true, emailSent, emailError, interviewDate: cand.interviewDate, interviewTime: cand.interviewTime });
});

route('GET', '/api/candidates/:id/interview-letter', { open: true }, async ({ req, res, params }) => {
  db().candidates = db().candidates || [];
  const cand = db().candidates.find(c => c.id === params.id);
  if (!cand) throw new HttpError(404, 'Candidate not found.');

  const pdf = await pdfGen.generateInterviewLetterPdf(cand, db().company);
  const pdfName = `Interview_Call_Letter_${cand.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  res.removeHeader('Content-Security-Policy');
  res.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Length': pdf.length,
    'Cache-Control': 'private, max-age=300',
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(pdfName)}`
  });
  res.end(pdf);
});

route('POST', '/api/candidates/:id/send-offer', { mod: ['hrms'] }, async ({ req, res, user, params }) => {
  db().candidates = db().candidates || [];
  const cand = db().candidates.find(c => c.id === params.id);
  if (!cand) throw new HttpError(404, 'Candidate not found.');
  if (!cand.email) throw new HttpError(400, 'Candidate does not have an email address recorded.');

  const companyName = db().company.name || 'RvmAiTech Solutions Private Limited';
  const salary = Number(cand.offeredSalary || cand.expectedSalary || 25000);
  const basic = Math.round(salary * 0.5);
  const hra = Math.round(salary * 0.3);
  const special = Math.max(0, salary - basic - hra);
  const annualCtc = salary * 12;
  const joiningDate = cand.joiningDate || fmtDate(new Date(Date.now() + 7 * 864e5));

  const pseudoEmp = {
    code: 'OFFER-' + cand.id.slice(-4).toUpperCase(),
    name: cand.name,
    email: cand.email,
    phone: cand.phone,
    role: cand.role || 'Staff',
    dept: cand.dept || 'Engineering',
    salary,
    joined: cand.joiningDate || today(),
    address: cand.address || 'Cyber City, Mansarovar, Jaipur',
    idNumber: 'To be verified at joining',
    emergencyName: 'Family Contact',
    emergencyPhone: cand.phone
  };

  const offerPdf = await pdfGen.generateOfferLetterPdf(pseudoEmp, db().company);
  const joinPdf = await pdfGen.generateJoiningLetterPdf(pseudoEmp, db().company);

  const cleanName = (cand.name || 'Candidate').replace(/[^a-zA-Z0-9_-]/g, '_');
  const offerFileName = `Offer_Letter_${cleanName}.pdf`;
  const joinFileName = `Joining_Form_${cleanName}.pdf`;

  const subject = `Job Offer: ${cand.role || 'Position'} at ${companyName} - Welcome!`;

  const bodyText = `Dear ${cand.name},

Congratulations! We are delighted to formally extend this Job Offer of Employment with RvmAiTech Solutions Private Limited for the position of ${cand.role || 'Staff'} in our ${cand.dept || 'Engineering'} Department.

We were highly impressed by your technical competence, background, and interview evaluation. Below is the summary of your proposed appointment:

============================================================
📋 EMPLOYMENT OFFER & REMUNERATION SUMMARY
============================================================
Position / Role:     ${cand.role || 'Staff'}
Department:          ${cand.dept || 'Engineering'}
Offered Gross:       Rs. ${salary.toLocaleString('en-IN')} / month
Annual CTC:          Rs. ${annualCtc.toLocaleString('en-IN')} per annum
Proposed Joining:    ${joiningDate}
Work Location:       Cyber City, Mansarovar, Jaipur (On-site / Hybrid)
Standard Shift:      8 Hours / Day (09:00 AM - 05:00 PM, Mon-Sat)

Salary Breakdown:
  - Basic Salary (50%): Rs. ${basic.toLocaleString('en-IN')} / month
  - HRA (30%): Rs. ${hra.toLocaleString('en-IN')} / month
  - Special Technical Allowance (20%): Rs. ${special.toLocaleString('en-IN')} / month

============================================================
📎 ATTACHED OFFICIAL DOCUMENTS (PLEASE REVIEW & SIGN)
============================================================
1. ${offerFileName} — Comprehensive 2-Page Corporate Offer Letter
2. ${joinFileName} — Employee Joining Form & Asset Onboarding Agreement

Please review the attached documents, sign the acceptance copy, and confirm your joining schedule. 

IMPORTANT NOTE:
Upon your physical or virtual reporting on the joining date, our HR Operations will complete your statutory enrollment in the HRMS system, and your official Employee Portal Login ID and Password will be issued to you.

We look forward to welcoming you to the RvmAiTech family!

Warm regards,
HR Operations Team
RvmAiTech Solutions Private Limited
Cyber City, Mansarovar, Jaipur, Rajasthan - 302020
Email: ${SENDER_EMAIL} | +91 7052050656
`;

  const bodyHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #0f172a; line-height: 1.5; }
  .email-wrap { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #cbd5e1; }
  .email-header { background: #0d2649; padding: 28px 24px 22px; text-align: center; border-bottom: 4px solid #059669; }
  .email-header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; }
  .email-header p { color: #86efac; margin: 6px 0 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
  .email-body { padding: 28px 24px; }
  .greeting { font-size: 16px; font-weight: 700; color: #0d2649; margin-bottom: 12px; }
  .lead-text { font-size: 14px; color: #334155; margin-bottom: 22px; line-height: 1.6; }
  .offer-card { background: linear-gradient(135deg, #059669 0%, #047857 100%); border-radius: 10px; padding: 20px; margin: 20px 0; color: #ffffff; border-left: 6px solid #f47b20; }
  .offer-title { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #86efac; margin: 0 0 12px; }
  .offer-table { width: 100%; border-collapse: collapse; }
  .offer-table td { padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.15); font-size: 13.5px; }
  .offer-table td:first-child { color: #dcfce7; font-weight: 600; width: 40%; }
  .offer-table td:last-child { color: #ffffff; font-weight: 700; }
  .docs-box { background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; padding: 16px; margin: 20px 0; }
  .doc-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #bbf7d0; font-size: 13px; }
  .doc-row:last-child { border-bottom: 0; }
  .doc-name { font-weight: 700; color: #166534; }
  .notice-box { background: #f8fafc; border: 1px dashed #94a3b8; border-radius: 6px; padding: 12px; font-size: 12px; color: #475569; margin-top: 18px; }
  .footer { background: #f8fafc; padding: 20px 24px; text-align: center; font-size: 11.5px; color: #64748b; border-top: 1px solid #e2e8f0; line-height: 1.6; }
</style>
</head>
<body>
  <div class="email-wrap">
    <div class="email-header">
      <h1>RvmAiTech Solutions</h1>
      <p>Official Employment Offer & Appointment Notice</p>
    </div>
    <div class="email-body">
      <div class="greeting">Dear ${cand.name},</div>
      <div class="lead-text">
        Congratulations! Following your application and interview evaluations, we are pleased to offer you employment with <b>RvmAiTech Solutions Private Limited</b> as <b>${cand.role || 'Staff'}</b>.
      </div>
      <div class="offer-card">
        <div class="offer-title">💼 OFFER HIGHLIGHTS</div>
        <table class="offer-table">
          <tr><td>Role / Position:</td><td>${cand.role || 'Staff'}</td></tr>
          <tr><td>Department:</td><td>${cand.dept || 'Engineering'}</td></tr>
          <tr><td>Monthly Gross Salary:</td><td>₹${salary.toLocaleString('en-IN')} / month</td></tr>
          <tr><td>Annual CTC:</td><td>₹${annualCtc.toLocaleString('en-IN')} per annum</td></tr>
          <tr><td>Target Joining Date:</td><td>${joiningDate}</td></tr>
          <tr><td>Work Location:</td><td>Cyber City, Mansarovar, Jaipur</td></tr>
        </table>
      </div>
      <div class="docs-box">
        <div style="font-size:12.5px;font-weight:800;color:#166534;margin-bottom:8px;text-transform:uppercase;">
          📎 2 Official Documents Attached (Review & Sign):
        </div>
        <div class="doc-row">
          <span class="doc-name">📄 1. Employment Offer Letter (${cleanName})</span>
          <span style="font-size:12px;color:#166534;font-weight:700;">Attached PDF</span>
        </div>
        <div class="doc-row">
          <span class="doc-name">📜 2. Official Joining Letter & Employee Form (${cleanName})</span>
          <span style="font-size:12px;color:#166534;font-weight:700;">Attached PDF</span>
        </div>
      </div>
      <div class="notice-box">
        🔒 <b>Next Steps & Portal Access:</b> Please review the attached Offer Letter and sign your acceptance. On your confirmed reporting date, HR will register you into the company HRMS system, and your personalized <b>Employee Portal Login ID & Temporary Password</b> will be sent to you automatically.
      </div>
    </div>
    <div class="footer">
      <b>RvmAiTech Solutions Private Limited</b><br>
      Cyber City, Mansarovar, Jaipur, Rajasthan - 302020<br>
      Official Support: ${SENDER_EMAIL} · +91 7052050656
    </div>
  </div>
</body>
</html>`;

  const attachments = [
    { filename: offerFileName, content: offerPdf, contentType: 'application/pdf' },
    { filename: joinFileName, content: joinPdf, contentType: 'application/pdf' }
  ];

  const smtpRes = await sendGmailSmtp({ to: cand.email, subject, text: bodyText, html: bodyHtml, from: SENDER_EMAIL, attachments });

  cand.status = 'Offer Sent';
  cand.offerSentAt = Date.now();
  await store.save();

  db().emailOutbox = db().emailOutbox || [];
  db().emailOutbox.push({
    id: newId('m'),
    from: SENDER_EMAIL,
    to: cand.email,
    name: cand.name,
    subject,
    body: bodyText,
    sentAt: Date.now(),
    sentBy: user.name,
    hasAttachment: true,
    attachmentName: `${offerFileName}, ${joinFileName}`,
    status: smtpRes.sentLive ? 'Delivered (Offer Letter & Joining Form)' : 'Logged (Sent to Candidate)'
  });
  await store.save();

  send(res, 200, {
    ok: true,
    sent: true,
    to: cand.email,
    subject,
    sentLive: smtpRes.sentLive,
    message: `Offer Letter & Joining Form successfully dispatched to ${cand.name} (${cand.email})!`
  });
});

route('POST', '/api/candidates/:id/convert-to-employee', { mod: ['hrms'] }, async ({ req, res, user, params }) => {
  db().candidates = db().candidates || [];
  const cand = db().candidates.find(c => c.id === params.id);
  if (!cand) throw new HttpError(404, 'Candidate not found.');

  const b = await readJson(req);
  const salary = Number(b.salary || cand.offeredSalary || cand.expectedSalary || 25000);
  const joined = String(b.joined || cand.joiningDate || today()).trim();
  const address = String(b.address || cand.address || 'Cyber City, Mansarovar, Jaipur').trim();

  // Create Employee
  const emps = db().employees || [];
  let maxCode = 0;
  for (const x of emps) {
    const m = /(\d+)\s*$/.exec(String(x.code || ''));
    if (m) maxCode = Math.max(maxCode, +m[1]);
  }
  const nextCode = 'EMP-' + String(maxCode + 1).padStart(3, '0');
  const cleanLoginId = nextCode.toLowerCase().replace(/[^a-z0-9]/g, '');
  const tempPass = Math.random().toString(36).slice(2, 6) + '-' + Math.random().toString(36).slice(2, 6) + '-' + Math.random().toString(36).slice(2, 6);

  const emp = {
    id: newId('e'),
    code: nextCode,
    name: String(b.name || cand.name).trim(),
    dept: String(b.dept || cand.dept || 'Engineering').trim(),
    role: String(b.role || cand.role || 'Staff').trim(),
    phone: String(b.phone || cand.phone).trim(),
    email: String(b.email || cand.email).trim(),
    joined,
    salary,
    expectedSalary: salary,
    status: 'Registered',
    dob: String(b.dob || '').trim(),
    bloodGroup: String(b.bloodGroup || 'B+').trim(),
    address,
    permAddress: String(b.permAddress || address).trim(),
    idType: String(b.idType || 'Aadhaar').trim(),
    idNumber: String(b.idNumber || '').trim(),
    emergencyName: String(b.emergencyName || 'Family Contact').trim(),
    emergencyPhone: String(b.emergencyPhone || cand.phone).trim(),
    userLoginId: cleanLoginId,
    tempPassword: tempPass,
    createdAt: Date.now(),
    createdBy: user.id
  };

  db().employees.push(emp);
  cand.status = 'Joined / Converted';
  cand.convertedEmpId = emp.id;

  // Create User Account
  const passHash = await hashPassword(tempPass);
  let userAccount = db().users.find(x => x.loginId === cleanLoginId || x.empId === emp.id);
  if (!userAccount) {
    db().users.push({
      id: newId('u'),
      name: emp.name,
      loginId: cleanLoginId,
      role: 'employee',
      empId: emp.id,
      modules: ['employee'],
      active: true,
      passHash,
      createdAt: Date.now()
    });
  } else {
    userAccount.passHash = passHash;
    userAccount.active = true;
    userAccount.role = 'employee';
    userAccount.empId = emp.id;
  }
  await store.save();

  // Send Automatic Welcome & Credentials Email with ID Card, Joining Confirmation & Offer Letter!
  const portalUrl = 'https://erp-rvmaitech.onrender.com';
  const companyName = db().company.name || 'RvmAiTech Solutions Private Limited';
  const cleanCode = emp.code.replace(/[^a-zA-Z0-9_-]/g, '');

  let offerPdf = null, joinPdf = null, idCardPdf = null;
  try { offerPdf = await pdfGen.generateOfferLetterPdf(emp, db().company); } catch (e) {}
  try { joinPdf = await pdfGen.generateJoiningLetterPdf(emp, db().company); } catch (e) {}
  try { idCardPdf = await pdfGen.generateIdCardPdf(emp, db().company); } catch (e) {}

  const offerFileName = `Offer_Letter_${cleanCode}.pdf`;
  const joinFileName = `Joining_Letter_${cleanCode}.pdf`;
  const idCardFileName = `Employee_ID_Card_${cleanCode}.pdf`;

  const subject = `Welcome to ${companyName} - Employee Portal Login & Credentials (${emp.code})`;
  const bodyText = `Namaste ${emp.name},

Congratulations on officially joining RvmAiTech Solutions Private Limited!
Your onboarding registration is complete in our HRMS system. Your official Employee Self-Service (ESS) Portal login details and documents are provided below:

============================================================
🔑 YOUR EMPLOYEE PORTAL CREDENTIALS
============================================================
Portal Website:       ${portalUrl}
Your Login ID:        ${cleanLoginId}
Temporary Password:   ${tempPass}

Login URL: ${portalUrl}
(Please sign in using your Login ID & Temporary Password to mark attendance, submit daily work updates "Kal kya kiya, aaj kya karenge", view salary payslips, and manage your tasks).

============================================================
📋 EMPLOYEE APPOINTMENT DETAILS
============================================================
Employee Code:        ${emp.code}
Designation / Role:   ${emp.role}
Department:           ${emp.dept}
Date of Joining:      ${fmtDate(emp.joined)}
Shift Schedule:       8 Hours / Day (09:00 AM - 05:00 PM, Mon-Sat)

============================================================
📎 3 ATTACHED OFFICIAL PDF DOCUMENTS
============================================================
1. ${idCardFileName} — Official Photo ID Card
2. ${joinFileName} — Complete Joining Letter & Information Record
3. ${offerFileName} — Appointment & Remuneration Terms

For any assistance, please contact HR Operations at ${SENDER_EMAIL}.

Warm regards,
HR Operations Team
RvmAiTech Solutions Private Limited
Cyber City, Mansarovar, Jaipur, Rajasthan - 302020
`;

  const bodyHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #0f172a; line-height: 1.5; }
  .email-wrap { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #cbd5e1; }
  .email-header { background: #0d2649; padding: 28px 24px 22px; text-align: center; border-bottom: 4px solid #f47b20; }
  .email-header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; }
  .email-header p { color: #38bdf8; margin: 6px 0 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
  .email-body { padding: 28px 24px; }
  .greeting { font-size: 16px; font-weight: 700; color: #0d2649; margin-bottom: 12px; }
  .lead-text { font-size: 14px; color: #334155; margin-bottom: 22px; line-height: 1.6; }
  .creds-card { background: linear-gradient(135deg, #0d2649 0%, #123a72 100%); border-radius: 10px; padding: 22px; margin: 24px 0; color: #ffffff; border-left: 6px solid #f47b20; }
  .creds-title { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #38bdf8; margin: 0 0 14px; }
  .creds-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  .creds-table td { padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.12); font-size: 13.5px; }
  .creds-table td:first-child { color: #cbd5e1; font-weight: 600; width: 38%; }
  .creds-table td:last-child { color: #ffffff; font-weight: 700; font-family: monospace; font-size: 14.5px; }
  .creds-badge { background: rgba(56,189,248,0.2); color: #38bdf8; padding: 3px 8px; border-radius: 4px; border: 1px solid rgba(56,189,248,0.35); }
  .btn-login { display: block; text-align: center; background: #f47b20; color: #ffffff !important; font-size: 15px; font-weight: 800; text-decoration: none; padding: 14px 20px; border-radius: 8px; box-shadow: 0 4px 14px rgba(244,123,32,0.4); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 10px; }
  .docs-box { background: #f0f9ff; border: 1.5px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 20px 0; }
  .doc-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e0f2fe; font-size: 13px; }
  .doc-row:last-child { border-bottom: 0; }
  .doc-name { font-weight: 700; color: #0369a1; }
  .footer { background: #f8fafc; padding: 20px 24px; text-align: center; font-size: 11.5px; color: #64748b; border-top: 1px solid #e2e8f0; line-height: 1.6; }
</style>
</head>
<body>
  <div class="email-wrap">
    <div class="email-header">
      <h1>RvmAiTech Solutions</h1>
      <p>Employee Self-Service (ESS) Portal Credentials</p>
    </div>
    <div class="email-body">
      <div class="greeting">Namaste ${emp.name},</div>
      <div class="lead-text">
        Welcome to the team! Your employee onboarding has been confirmed. Below are your official <b>HRMS Employee Portal Login credentials</b>:
      </div>
      <div class="creds-card">
        <div class="creds-title">🔑 YOUR EMPLOYEE PORTAL LOGIN DETAILS</div>
        <table class="creds-table">
          <tr><td>Portal Website:</td><td><a href="${portalUrl}" style="color:#38bdf8;text-decoration:underline;">${portalUrl}</a></td></tr>
          <tr><td>Your Login ID:</td><td><span class="creds-badge">${cleanLoginId}</span></td></tr>
          <tr><td>Temporary Password:</td><td><span class="creds-badge">${tempPass}</span></td></tr>
        </table>
        <a href="${portalUrl}" class="btn-login" target="_blank" rel="noopener">👉 Click Here to Open Portal & Login</a>
      </div>
      <div class="docs-box">
        <div style="font-size:12.5px;font-weight:800;color:#0369a1;margin-bottom:8px;text-transform:uppercase;">
          📎 3 Official PDF Documents Attached:
        </div>
        <div class="doc-row"><span class="doc-name">🪪 1. Employee Photo ID Card</span><span style="font-size:12px;color:#0369a1;font-weight:700;">Attached</span></div>
        <div class="doc-row"><span class="doc-name">📜 2. Complete Joining Letter & Form</span><span style="font-size:12px;color:#0369a1;font-weight:700;">Attached</span></div>
        <div class="doc-row"><span class="doc-name">📄 3. Employment Offer Letter</span><span style="font-size:12px;color:#0369a1;font-weight:700;">Attached</span></div>
      </div>
    </div>
    <div class="footer">
      <b>RvmAiTech Solutions Private Limited</b><br>
      Cyber City, Mansarovar, Jaipur, Rajasthan - 302020 · Support: ${SENDER_EMAIL}
    </div>
  </div>
</body>
</html>`;

  const attachments = [];
  if (idCardPdf) attachments.push({ filename: idCardFileName, content: idCardPdf, contentType: 'application/pdf' });
  if (joinPdf) attachments.push({ filename: joinFileName, content: joinPdf, contentType: 'application/pdf' });
  if (offerPdf) attachments.push({ filename: offerFileName, content: offerPdf, contentType: 'application/pdf' });

  const smtpRes = await sendGmailSmtp({ to: emp.email, subject, text: bodyText, html: bodyHtml, from: SENDER_EMAIL, attachments });

  db().emailOutbox = db().emailOutbox || [];
  db().emailOutbox.push({
    id: newId('m'),
    from: SENDER_EMAIL,
    to: emp.email,
    name: emp.name,
    subject,
    body: bodyText,
    sentAt: Date.now(),
    sentBy: user.name,
    hasAttachment: attachments.length > 0,
    attachmentName: `${idCardFileName}, ${joinFileName}, ${offerFileName}`,
    status: smtpRes.sentLive ? 'Delivered (Credentials + 3 PDFs)' : 'Logged (Sent to Employee)'
  });
  await store.save();

  send(res, 201, {
    ok: true,
    emp,
    creds: { loginId: cleanLoginId, tempPassword: tempPass, portalUrl },
    sentLive: smtpRes.sentLive,
    message: `Employee ${emp.name} (${emp.code}) registered in HRMS and portal credentials emailed automatically!`
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
  const isPublicWebhook = url.pathname === '/api/inquiries' || url.pathname === '/api/public/lead' || url.pathname === '/api/leads/inquiry' || url.pathname === '/api/careers/apply';
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
