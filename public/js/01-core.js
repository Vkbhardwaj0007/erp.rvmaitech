'use strict';
/* ================= helpers ================= */
const $ = (s, r) => (r || document).querySelector(s);
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const pad = n => String(n).padStart(2, '0');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const isoOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = () => isoOf(new Date());
const parseISO = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const fmtDate = s => { const d = parseISO(s); return d ? d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() : '—'; };
const fmtDay = s => { const d = parseISO(s); return d ? d.getDate() + ' ' + MON[d.getMonth()] : '—'; };
const addDays = (s, n) => { const d = parseISO(s) || new Date(); d.setDate(d.getDate() + n); return isoOf(d); };
const dayDiff = (a, b) => { const x = parseISO(a), y = parseISO(b); return x && y ? Math.round((y - x) / 864e5) : 0; };
const monthOf = s => String(s || '').slice(0, 7);
const monthName = ym => { const p = String(ym).split('-'); return MONTHS[+p[1] - 1] + ' ' + p[0]; };
const shiftMonth = (ym, n) => { const p = ym.split('-'); const d = new Date(+p[0], +p[1] - 1 + n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
const daysIn = ym => { const p = ym.split('-'); return new Date(+p[0], +p[1], 0).getDate(); };
/* Indian financial year runs April to March. */
const fyStart = iso => { const d = parseISO(iso) || new Date(); return (d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1) + '-04-01'; };
const fyLabel = iso => { const y = +fyStart(iso).slice(0, 4); return 'FY ' + y + '-' + pad((y + 1) % 100); };
const isSunday = iso => { const d = parseISO(iso); return !!d && d.getDay() === 0; };

/* Indian digit grouping: 1,25,000. Short form uses lakh (L) and crore (Cr). */
const inr = n => { n = Math.round(num(n)); return (n < 0 ? '−₹' : '₹') + Math.abs(n).toLocaleString('en-IN'); };
const cut = x => String(+x.toFixed(x >= 100 ? 0 : x >= 10 ? 1 : 2));
/* Thresholds sit just under the round figure so 99,960 reads as 1 L, not 100K. */
const inrShort = n => { n = num(n); const a = Math.abs(n), s = n < 0 ? '−₹' : '₹'; return a >= 9995000 ? s + cut(a / 1e7) + ' Cr' : a >= 99950 ? s + cut(a / 1e5) + ' L' : a >= 1e3 ? s + cut(a / 1e3) + 'K' : s + Math.round(a); };
const qty = n => num(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const round2 = n => Math.round(num(n) * 100) / 100;
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''));
const sum = (arr, fn) => arr.reduce((s, x) => s + num(fn(x)), 0);
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const fileSize = b => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';

/* Indian Rupee Number to Words Converter */
function inrWords(n) {
  n = Math.round(Number(n) || 0);
  if (n === 0) return 'INR Zero Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function convert(num) {
    if (num < 20) return a[num];
    if (num < 100) return b[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + a[num % 10] : '');
    if (num < 1000) return a[Math.floor(num / 100)] + ' Hundred' + (num % 100 !== 0 ? ' and ' + convert(num % 100) : '');
    if (num < 100000) return convert(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 !== 0 ? ' ' + convert(num % 1000) : '');
    if (num < 10000000) return convert(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 !== 0 ? ' ' + convert(num % 100000) : '');
    return convert(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 !== 0 ? ' ' + convert(num % 10000000) : '');
  }
  return 'INR ' + convert(n) + ' Only';
}
window.inrWords = inrWords;

class UserError extends Error {}

/* ================= state ================= */
const LISTS = ['products', 'customers', 'leads', 'invoices', 'quotations', 'proformas', 'purchases', 'issues', 'employees', 'leaves', 'projects', 'expenses', 'files', 'users', 'worklogs', 'tasks'];
const STAGES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];
const OPEN_STAGES = ['New', 'Contacted', 'Qualified', 'Proposal'];
const SOURCES = ['Referral', 'Website', 'Walk-in', 'Phone call', 'Exhibition', 'Social media', 'Other'];
const LEAVE_TYPES = ['Casual', 'Sick', 'Earned', 'Unpaid'];
const ID_TYPES = ['Aadhaar', 'PAN', 'Voter ID', 'Driving licence', 'Passport', 'Other'];
const DOC_KINDS = ['Aadhaar Card', 'PAN Card', 'Resume / CV', 'Offer letter', 'Certificate', 'Address proof', 'Bank document', 'ID proof', 'Other'];
const EXPENSE_CATS = ['Rent', 'Electricity', 'Transport', 'Office', 'Repairs', 'Marketing', 'Taxes and fees', 'Other'];
const PROJECT_STATUS = ['Planned', 'Running', 'On hold', 'Completed', 'Delivered'];
const MODULE_NAMES = { erp: 'ERP', crm: 'CRM', hrms: 'HRMS', finance: 'Finance', projects: 'Projects', employee: 'Employee Portal' };
const MARKS = { P: 'Present', A: 'Absent', H: 'Half day', L: 'Leave', U: 'Unpaid leave', O: 'Overtime' };

const S = {
  status: 'boot',            // boot | setup | login | creds | ready
  user: null, company: { name: '' }, needCode: false, creds: [],
  products: [], customers: [], leads: [], invoices: [], quotations: [], proformas: [], purchases: [], issues: [], employees: [], leaves: [], projects: [], expenses: [], files: [], users: [], worklogs: [], tasks: [], emailOutbox: [],
  attendance: {}, sampleCount: 0,
  ui: { q: {}, filter: {}, attDate: today(), payMonth: today().slice(0, 7), expMonth: today().slice(0, 7), profile: '', tab: 'all', attPage: 1, attPerPage: 30, attTab: 'daily' }
};
const isOwner = () => !!S.user && S.user.role === 'owner';
const isEmployee = () => !!S.user && S.user.role === 'employee';
const can = mod => !!S.user && (S.user.role === 'owner' || (S.user.modules && S.user.modules.includes(mod)));
const myEmployee = () => (S.user && S.user.empId ? S.employees.find(e => e.id === S.user.empId) : null) || S.employees[0] || null;

/* ================= talking to the server ================= */
async function api(method, url, body, rawType) {
  const opt = { method, headers: { 'X-Requested-With': 'fetch' }, credentials: 'same-origin' };
  if (rawType) { opt.headers['Content-Type'] = rawType; opt.body = body; }
  else if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  let res;
  try { res = await fetch(url, opt); }
  catch (e) { throw new UserError('Cannot reach the server. Check that it is running and that you are connected.'); }
  let data = null;
  try { data = await res.json(); } catch (e) { /* no JSON body */ }
  if (res.status === 401 && S.status === 'ready') {
    S.status = 'login'; S.user = null; render();
    throw new UserError('Your session has ended. Log in again.');
  }
  if (!res.ok) throw new UserError((data && data.error) || `Something went wrong (error ${res.status}). Try again.`);
  return data || {};
}
async function loadData() {
  const r = await api('GET', '/api/data');
  S.user = r.user; S.company = r.company || { name: '' }; S.sampleCount = r.sampleCount || 0;
  for (const k of LISTS) S[k] = r.data[k] || [];
  S.attendance = r.data.attendance || {};
}
const refresh = async () => { await loadData(); scheduleRender(); };
async function dbAdd(col, data) { const r = await api('POST', '/api/c/' + col, data); await refresh(); return r.id; }
async function dbUpdate(col, id, patch) { await api('PUT', '/api/c/' + col + '/' + encodeURIComponent(id), patch); await refresh(); }
async function dbDelete(col, id) { await api('DELETE', '/api/c/' + col + '/' + encodeURIComponent(id)); await refresh(); }
/* Run a change started from a button. Shows the result as a toast. */
async function save(fn, okMsg) {
  try { await fn(); if (okMsg) toast(okMsg); return true; }
  catch (e) { if (!(e instanceof UserError)) console.error(e); toast(e instanceof UserError ? e.message : 'Could not save. Try again.', 'bad'); return false; }
}

/* ================= derived values ================= */
const mapById = arr => new Map(arr.map(x => [x.id, x]));
function derive() {
  const D = { prod: mapById(S.products), cust: mapById(S.customers), emp: mapById(S.employees), proj: mapById(S.projects) };
  /* Stock on hand = opening + purchases received − invoiced − sent out on issue (less what came back). */
  D.stock = new Map(S.products.map(p => [p.id, num(p.opening)]));
  const move = (id, n) => { if (D.stock.has(id)) D.stock.set(id, D.stock.get(id) + n); };
  for (const po of S.purchases) if (po.status === 'Received') move(po.productId, num(po.qty));
  for (const inv of S.invoices) for (const it of (inv.items || [])) move(it.productId, -num(it.qty));
  for (const is of S.issues) move(is.productId, -outstanding(is));
  D.attn = attention(D);
  return D;
}
const outstanding = is => Math.max(0, num(is.qty) - num(is.returnedQty));
const balanceOf = inv => Math.max(0, num(inv.total) - num(inv.paid));
const dueDate = inv => addDays(inv.date, 30);
function invStatus(inv) {
  if (balanceOf(inv) < 0.5) return 'Paid';
  if (dueDate(inv) < today()) return 'Overdue';
  return num(inv.paid) > 0 ? 'Part paid' : 'Unpaid';
}
const INV_TONE = { 'Paid': 'good', 'Overdue': 'bad', 'Part paid': 'warn', 'Unpaid': 'info' };
function stockState(p, D) {
  const s = D.stock.get(p.id) || 0;
  if (s <= 0) return { label: 'Out of stock', tone: 'bad' };
  if (s <= num(p.reorder)) return { label: 'Low', tone: 'warn' };
  return { label: 'In stock', tone: 'good' };
}
const custLabel = c => c ? (c.company || c.name || '—') : '—';
const empName = (D, id) => { const e = D.emp.get(id); return e ? e.name : '—'; };
const activeEmps = () => S.employees.filter(e => e.status !== 'Left').sort(byName);
const billed = list => sum(list, i => i.total);
const invoicesIn = ym => S.invoices.filter(i => monthOf(i.date) === ym);

function leaveOn(empId, date) { return S.leaves.find(l => l.empId === empId && l.status === 'Approved' && l.from <= date && date <= l.to); }
/* A day's mark: what was marked by hand, else an approved leave covering that day. */
function markOf(empId, date) {
  const m = (S.attendance[date] || {})[empId];
  if (m) return m;
  const l = leaveOn(empId, date);
  return l ? (l.type === 'Unpaid' ? 'U' : 'L') : '';
}
/* What each person still holds of the daily-use items. */
function holdings() {
  return S.issues.filter(i => i.kind === 'daily' && outstanding(i) > 0)
    .sort((a, b) => String(a.takenById).localeCompare(String(b.takenById)) || String(a.date).localeCompare(String(b.date)));
}
function projectLate(p) { return p.end && p.end < today() && p.status !== 'Completed'; }
function missingRecords(e) {
  const out = [];
  if (!e.photoId) out.push('photo');
  if (!e.idType || !e.idNumber || !S.files.some(f => f.employeeId === e.id && f.kind === 'ID proof')) out.push('ID proof');
  if (!e.address || !e.permAddress) out.push('address');
  return out;
}

function attention(D) {
  const t = today();
  const low = S.products.filter(p => stockState(p, D).tone !== 'good').sort((a, b) => (D.stock.get(a.id) || 0) - (D.stock.get(b.id) || 0));
  const overdue = S.invoices.filter(i => invStatus(i) === 'Overdue').sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const follow = S.leads.filter(l => OPEN_STAGES.includes(l.stage) && l.followUp && l.followUp <= t).sort((a, b) => String(a.followUp).localeCompare(String(b.followUp)));
  const pending = S.leaves.filter(l => l.status === 'Pending');
  const act = activeEmps();
  const unmarked = can('hrms') && !isSunday(t) && act.length > 0 && act.every(e => !markOf(e.id, t));
  const late = S.projects.filter(projectLate);
  return { low, overdue, follow, pending, unmarked, late };
}

function payroll(month) {
  const p = month.split('-'), y = +p[0], m = +p[1];
  const dim = new Date(y, m, 0).getDate(), t = today();
  return activeEmps().map(e => {
    let lop = 0, notJoined = 0, unmarked = 0;
    for (let d = 1; d <= dim; d++) {
      const iso = y + '-' + pad(m) + '-' + pad(d);
      if (e.joined && iso < e.joined) { notJoined++; continue; }
      if (iso > t) continue;
      const mk = markOf(e.id, iso);
      if (mk === 'A' || mk === 'U') lop += 1;
      else if (mk === 'H') lop += 0.5;
      else if (!mk && !isSunday(iso)) unmarked++;
    }
    const gross = num(e.salary);
    const payable = Math.max(0, dim - lop - notJoined);
    const earned = Math.round(gross * payable / dim);
    const pf = Math.round(earned * 0.5 * 0.12);
    const pt = earned > 15000 ? 200 : 0;
    return { e, gross, dim, payable, lop: lop + notJoined, lopAmt: gross - earned, pf, pt, net: earned - pf - pt, unmarked };
  });
}
function nextNo(prefix, arr, key, width) {
  let max = 0;
  for (const x of arr) { const m = /(\d+)\s*$/.exec(String(x[key] || '')); if (m) max = Math.max(max, +m[1]); }
  return prefix + String(max + 1).padStart(width, '0');
}
function downloadText(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ================= Theme Switcher Support ================= */
function getAppTheme() {
  const explicit = document.documentElement.getAttribute('data-theme');
  if (explicit) return explicit;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function setAppTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('bs_theme', t); } catch (e) {}
  if (typeof scheduleRender === 'function') scheduleRender();
}
function toggleAppTheme() {
  setAppTheme(getAppTheme() === 'dark' ? 'light' : 'dark');
}
try {
  const savedTheme = localStorage.getItem('bs_theme');
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
} catch (e) {}
