'use strict';
/* ================= small UI pieces ================= */
function toast(msg, tone) {
  const el = document.createElement('div');
  el.className = 'toast' + (tone ? ' toast-' + tone : '');
  el.textContent = msg;
  const box = $('#toasts');
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();   // never bury the page under old messages
  setTimeout(() => el.remove(), tone === 'bad' ? 5600 : 3200);
}
const stamp = (text, tone) => `<span class="stamp stamp-${tone || 'mute'}">${esc(text)}</span>`;
/* Show a control only to logins that may change that module's records. */
const W = (mod, html) => (can(mod) ? html : '');
function head(mod, title, sub, actions) {
  const isCompanyHead = (mod && S.company && (mod.toLowerCase() === (S.company.name || '').toLowerCase() || mod.toLowerCase().includes('rvmaitech'))) || title === 'Everything at a glance';
  if (isCompanyHead) {
    return `<header class="vhead" style="align-items:center">
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <img src="/logo-light.png" alt="RvmAiTech" class="vhead-brand-logo" style="height:44px;max-width:190px;object-fit:contain;display:block">
        <div style="border-left:2px solid var(--rule);padding-left:14px">
          <div class="eyebrow" style="margin-bottom:2px">INDUSTRIAL AUTOMATION & AI</div>
          <h1 style="margin:0">${esc(title)}</h1>
          ${sub ? `<p class="vsub" style="margin-top:2px">${sub}</p>` : ''}
        </div>
      </div>
      <div class="vactions">${actions || ''}</div>
    </header>`;
  }
  return `<header class="vhead"><div><div class="eyebrow">${esc(mod)}</div><h1>${esc(title)}</h1>${sub ? `<p class="vsub">${sub}</p>` : ''}</div><div class="vactions">${actions || ''}</div></header>`;
}
function searchBox(view, ph) {
  return `<input class="search" type="search" id="q-${view}" data-input="search" data-view="${view}" value="${esc(S.ui.q[view] || '')}" placeholder="${esc(ph)}" aria-label="${esc(ph)}">`;
}
function filterSel(key, label, opts) {
  const cur = S.ui.filter[key] || '';
  return `<select id="flt-${key}" data-change="filter" data-key="${key}" aria-label="${esc(label)}"><option value="">${esc(label)}</option>${opts.map(o => { const v = typeof o === 'string' ? o : o.value, l = typeof o === 'string' ? o : o.label; return `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
}
function table(headCells, rows, foot) {
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${headCells.map(h => typeof h === 'string' ? `<th>${esc(h)}</th>` : `<th class="num">${esc(h.n)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody>${foot ? `<tfoot>${foot}</tfoot>` : ''}</table></div>`;
}
function empty(title, text, action) {
  return `<div class="empty"><h3>${esc(title)}</h3><p>${esc(text)}</p>${action || ''}</div>`;
}
const matches = (q, ...parts) => !q || parts.join(' ').toLowerCase().includes(q);
const query = view => String(S.ui.q[view] || '').trim().toLowerCase();
function tile(label, value, sub, href) {
  const plainVal = String(value || '').replace(/<[^>]*>/g, '');
  const sizeCls = plainVal.length > 18 ? ' tile-value-sm' : plainVal.length > 11 ? ' tile-value-md' : '';
  const inner = `<div class="tile-label">${esc(label)}</div><div class="tile-value${sizeCls}">${value}</div><div class="tile-sub">${sub || ''}</div>`;
  return href ? `<a class="tile" href="${href}">${inner}</a>` : `<div class="tile">${inner}</div>`;
}
function stepper(action, label, nextDisabled) {
  return `<span class="stepper"><button class="btn btn-sm" data-action="${action}" data-dir="-1" aria-label="Previous">‹</button><span class="cur">${esc(label)}</span><button class="btn btn-sm" data-action="${action}" data-dir="1" aria-label="Next"${nextDisabled ? ' disabled' : ''}>›</button></span>`;
}
/* A person's photo, or their initials. Photos are only served to HR and the owner. */
function avatar(e, size) {
  const cls = 'avatar' + (size ? ' ' + size : '');
  if (e && e.photoId && can('hrms')) return `<span class="${cls}"><img src="/api/files/${esc(e.photoId)}" alt=""></span>`;
  return `<span class="${cls}" aria-hidden="true">${esc(initials(e && e.name))}</span>`;
}
/* Horizontal bars for a short list of amounts. rows: [{ name, value, text }] */
function hbars(rows) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return `<div class="hbars">${rows.map(r => `<div class="hbar"><span class="hbar-name">${esc(r.name)}</span><span class="hbar-track"><span class="hbar-fill" style="width:${(r.value / max * 60).toFixed(1)}%"></span><span class="hbar-val">${r.text}</span></span></div>`).join('')}</div>`;
}

/* ================= dialog and forms ================= */
const dlg = $('#dlg');
if (dlg) {
  const origShowModal = dlg.showModal ? dlg.showModal.bind(dlg) : null;
  if (origShowModal) {
    dlg.showModal = function() {
      document.body.classList.add('has-open-dlg');
      return origShowModal();
    };
  }
  dlg.addEventListener('close', () => document.body.classList.remove('has-open-dlg'));
}

function closeDlg() {
  document.body.classList.remove('has-open-dlg');
  if (dlg.open) {
    try { dlg.close(); } catch (e) {}
  }
  dlg.removeAttribute('open');
  dlg.className = 'dlg';
  dlg.innerHTML = '';
}
dlg.addEventListener('click', ev => {
  if (ev.target === dlg || ev.target.closest('[data-x="cancel"]')) closeDlg();
});

/* Rock-solid A4 Print Engine for Chrome, Edge & Firefox */
window.printDoc = function(target) {
  let el = typeof target === 'string' ? document.getElementById(target) : (target && target.nodeType === 1 ? target : null);
  if (!el) {
    el = document.getElementById('printableArea') || document.querySelector('.a4-page, .letter-sheet, .payslip-wrap, .challan-wrap, .challan-sheet, .idcard-container');
  }
  if (!el) {
    window.print();
    return;
  }

  // Remove any previous print container
  const old = document.getElementById('isolatedPrintSheet');
  if (old) old.remove();

  // Create isolated print container attached directly to <body>
  const printSheet = document.createElement('div');
  printSheet.id = 'isolatedPrintSheet';
  printSheet.className = 'print-active-sheet';
  printSheet.innerHTML = el.outerHTML;

  // Make sure all image URLs inside printSheet are absolute
  printSheet.querySelectorAll('img').forEach(img => {
    img.src = img.src;
  });

  document.body.appendChild(printSheet);
  document.body.classList.add('printing-active-document');

  const cleanup = () => {
    document.body.classList.remove('printing-active-document');
    const cur = document.getElementById('isolatedPrintSheet');
    if (cur) cur.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  // Trigger main window print directly
  setTimeout(() => {
    window.focus();
    window.print();
    // Safety fallback cleanup
    setTimeout(cleanup, 2500);
  }, 120);
};

/* Helper for direct 1-click A4 PDF file download */
window.downloadPdf = function(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  if (filename) a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 100);
};

/* Rock-solid A4 Print Engine for Chrome, Edge & Firefox */
window.printDoc = function(target) {
  let el = typeof target === 'string' ? document.getElementById(target) : (target && target.nodeType === 1 ? target : null);
  if (!el) {
    el = document.getElementById('printableArea') || document.querySelector('.a4-page, .letter-sheet, .payslip-wrap, .challan-wrap, .challan-sheet, .idcard-container');
  }
  if (!el) {
    window.print();
    return;
  }

  // Remove any previous print container
  const old = document.getElementById('isolatedPrintSheet');
  if (old) old.remove();

  // Create isolated print container attached directly to <body>
  const printSheet = document.createElement('div');
  printSheet.id = 'isolatedPrintSheet';
  printSheet.className = 'print-active-sheet';
  printSheet.innerHTML = el.outerHTML;

  // Make sure all image URLs inside printSheet are absolute
  printSheet.querySelectorAll('img').forEach(img => {
    img.src = img.src;
  });

  document.body.appendChild(printSheet);
  document.body.classList.add('printing-active-document');

  const cleanup = () => {
    document.body.classList.remove('printing-active-document');
    const cur = document.getElementById('isolatedPrintSheet');
    if (cur) cur.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  // Trigger main window print directly
  setTimeout(() => {
    window.focus();
    window.print();
    // Safety fallback cleanup
    setTimeout(cleanup, 2500);
  }, 120);
};

/* Helper for direct 1-click A4 PDF file download */
window.downloadPdf = function(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  if (filename) a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 100);
};

function fieldHtml(f, v) {
  const id = 'f-' + f.name;
  const val = v == null ? (f.value == null ? '' : f.value) : v;
  const req = f.required ? ' required' : '';
  let ctl;
  if (f.type === 'select') {
    ctl = `<select id="${id}" name="${f.name}"${req}>${f.placeholder != null ? `<option value="">${esc(f.placeholder)}</option>` : ''}${f.options.map(o => { const ov = typeof o === 'string' ? o : o.value, ol = typeof o === 'string' ? o : o.label; return `<option value="${esc(ov)}"${String(ov) === String(val) ? ' selected' : ''}>${esc(ol)}</option>`; }).join('')}</select>`;
  } else if (f.type === 'checks') {
    const on = Array.isArray(val) ? val : [];
    ctl = `<div class="checks" id="${id}" role="group" aria-label="${esc(f.label)}">${f.options.length ? f.options.map((o, i) => `<label class="check"><input type="checkbox" id="${id}-${i}" name="${f.name}" value="${esc(o.value)}"${on.includes(o.value) ? ' checked' : ''}><span>${esc(o.label)}</span></label>`).join('') : '<span class="muted">Nothing to choose yet.</span>'}</div>`;
  } else if (f.type === 'textarea') {
    ctl = `<textarea id="${id}" name="${f.name}" rows="${f.rows || 3}" maxlength="${f.maxlength || 600}"${req}>${esc(val)}</textarea>`;
  } else {
    ctl = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(val)}"${req}${f.min != null ? ` min="${f.min}"` : ''}${f.max != null ? ` max="${f.max}"` : ''}${f.step ? ` step="${f.step}"` : ''}${f.type === 'number' ? ' inputmode="decimal"' : ` maxlength="${f.maxlength || 160}"`}${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''}${f.autocomplete ? ` autocomplete="${f.autocomplete}"` : ''}>`;
  }
  const label = f.type === 'checks' ? `<span class="lbl">${esc(f.label)}</span>` : `<label for="${id}">${esc(f.label)}${f.required ? '' : ' <span class="opt">optional</span>'}</label>`;
  return `<div class="field${f.full || f.type === 'checks' ? ' field-full' : ''}">${label}${ctl}${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}</div>`;
}
function readForm(form, fields) {
  const fd = new FormData(form), out = {};
  for (const f of fields) {
    if (f.type === 'checks') { out[f.name] = fd.getAll(f.name).map(String); continue; }
    const raw = String(fd.get(f.name) == null ? '' : fd.get(f.name));
    out[f.name] = f.type === 'number' ? num(raw) : f.type === 'password' ? raw : raw.trim();
  }
  return out;
}
/* cfg: { title, sub, fields, values, submit, onSubmit(values) } */
function openForm(cfg) {
  const vals = cfg.values || {};
  dlg.className = 'dlg dlg-fullscreen' + (cfg.className ? ' ' + cfg.className : '');
  dlg.innerHTML = `
    <form class="form" id="dlgForm">
      <div class="form-head" style="display:flex; justify-content:space-between; align-items:flex-start; flex-shrink:0;">
        <div>
          <h2 class="dlg-title" style="margin:0;">${esc(cfg.title)}</h2>
          ${cfg.sub ? `<p class="dlg-sub" style="margin:4px 0 0;">${esc(cfg.sub)}</p>` : ''}
        </div>
        <button type="button" class="btn btn-sm" data-x="cancel" aria-label="Close" style="padding:4px 12px; font-weight:700; font-size:15px; border-radius:8px;">✕</button>
      </div>
      <div class="fields">
        ${cfg.fields.map(f => fieldHtml(f, vals[f.name])).join('')}
      </div>
      <div class="form-err" id="formErr" role="alert"></div>
      <div class="dlg-actions">
        <button type="button" class="btn" data-x="cancel" style="padding:10px 24px; font-size:14px; font-weight:700;">Cancel</button>
        <button type="submit" class="btn btn-primary" id="dlgSubmit" style="padding:10px 32px; font-size:14.5px; font-weight:800;">💾 Save</button>
      </div>
    </form>`;
  const form = $('#dlgForm', dlg);
  form.addEventListener('submit', ev => { ev.preventDefault(); runSubmit(form, () => cfg.onSubmit(readForm(form, cfg.fields))); });
  dlg.showModal();
}
async function runSubmit(form, fn, keepOpen) {
  const btn = form.querySelector('[type="submit"]'), err = form.querySelector('.form-err');
  const label = btn.textContent;
  err.textContent = ''; btn.disabled = true; btn.textContent = 'Saving…';
  try { await fn(); if (!keepOpen) closeDlg(); }
  catch (e) {
    if (!(e instanceof UserError)) console.error(e);
    err.textContent = e instanceof UserError ? e.message : 'Something went wrong. Try again.';
  }
  if (btn.isConnected) { btn.disabled = false; btn.textContent = label; }
}
function confirmBox(title, body, ok) {
  return new Promise(resolve => {
    let answer = false;
    dlg.className = 'dlg dlg-sm';
    dlg.innerHTML = `<div class="form"><h2 class="dlg-title">${esc(title)}</h2><p class="dlg-body">${esc(body)}</p><div class="dlg-actions"><button type="button" class="btn" data-x="cancel">Cancel</button><button type="button" class="btn btn-danger" id="dlgOk">${esc(ok || 'Delete')}</button></div></div>`;
    $('#dlgOk', dlg).addEventListener('click', () => { answer = true; closeDlg(); });
    dlg.addEventListener('close', () => resolve(answer), { once: true });
    dlg.showModal();
  });
}

/* ================= chart tooltip ================= */
const tip = $('#tip');
function showTip(el, x, y) {
  tip.textContent = '';
  const b = document.createElement('b'); b.textContent = el.dataset.tipV;
  tip.append(b, document.createTextNode(el.dataset.tipL || ''));
  tip.hidden = false;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2)) + 'px';
  tip.style.top = Math.max(8, y - h - 12) + 'px';
}
document.addEventListener('pointermove', ev => {
  const el = ev.target.closest && ev.target.closest('[data-tip-v]');
  if (el) showTip(el, ev.clientX, ev.clientY);
  else if (!tip.hidden && !(document.activeElement && document.activeElement.matches && document.activeElement.matches('[data-tip-v]'))) tip.hidden = true;
});
document.addEventListener('focusin', ev => {
  const el = ev.target.closest && ev.target.closest('[data-tip-v]');
  if (el) { const r = el.getBoundingClientRect(); showTip(el, r.left + r.width / 2, r.top + r.height * 0.35); }
});
document.addEventListener('focusout', () => { tip.hidden = true; });

/* ================= column chart ================= */
let CHARTS = {};
function niceStep(maxV, n) {
  const raw = maxV / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}
/* Register six months of billing as a chart and return its placeholder. */
function salesChart(key) {
  const m = today().slice(0, 7), rows = [];
  for (let k = 5; k >= 0; k--) { const ym = shiftMonth(m, -k); rows.push({ label: MON[+ym.slice(5) - 1], full: monthName(ym), value: billed(invoicesIn(ym)) }); }
  CHARTS[key] = rows;
  return `<div class="chart" data-chart="${key}" role="group" aria-label="Billing by month, last six months"></div><details class="astable"><summary>Show as table</summary><table>${rows.map(r => `<tr><td>${esc(r.full)}</td><td class="num">${inr(r.value)}</td></tr>`).join('')}</table></details>`;
}
function mountCharts() {
  document.querySelectorAll('[data-chart]').forEach(el => {
    const data = CHARTS[el.dataset.chart]; if (!data) return;
    const Wd = Math.max(260, Math.floor(el.clientWidth || 560)), H = 220, mt = 22, mr = 8, mb = 26, ml = 52;
    const iw = Wd - ml - mr, ih = H - mt - mb;
    const maxV = Math.max(1000, ...data.map(r => r.value));
    const step = niceStep(maxV, 4), top = step * Math.ceil(maxV / step);
    const unit = top >= 1e7 ? [1e7, ' Cr'] : top >= 1e5 ? [1e5, ' L'] : [1e3, 'K'];   // one unit for the whole axis
    const tick = v => v === 0 ? '0' : '₹' + String(+(v / unit[0]).toFixed(2)) + unit[1];
    const y = v => mt + ih - v / top * ih;
    const band = iw / data.length, bw = Math.min(24, band * 0.5);
    let g = '';
    for (let v = 0; v <= top + 1e-6; v += step) g += `<line class="${v === 0 ? 'axis' : 'grid'}" x1="${ml}" x2="${Wd - mr}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${ml - 8}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end">${tick(v)}</text>`;
    data.forEach((r, i) => {
      const x = ml + i * band + (band - bw) / 2, y0 = y(0), y1 = y(r.value), h = y0 - y1, rad = Math.min(4, h), last = i === data.length - 1;
      g += `<rect class="hit" tabindex="0" role="img" aria-label="${esc(r.full)}: ${esc(inr(r.value))}" data-tip-v="${esc(inr(r.value))}" data-tip-l="${esc(r.full)}${last ? ', month to date' : ''}" x="${(ml + i * band).toFixed(1)}" y="${mt}" width="${band.toFixed(1)}" height="${ih}"/>`;
      g += h > 0.5 ? `<path class="bar" d="M${x.toFixed(1)},${y0.toFixed(1)}V${(y1 + rad).toFixed(1)}Q${x.toFixed(1)},${y1.toFixed(1)} ${(x + rad).toFixed(1)},${y1.toFixed(1)}H${(x + bw - rad).toFixed(1)}Q${(x + bw).toFixed(1)},${y1.toFixed(1)} ${(x + bw).toFixed(1)},${(y1 + rad).toFixed(1)}V${y0.toFixed(1)}Z"/>` : `<path class="bar" d=""/>`;
      g += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${r.label}</text>`;
      if (last) g += `<text class="val" x="${(x + bw / 2).toFixed(1)}" y="${(y1 - 7).toFixed(1)}" text-anchor="middle">${esc(inrShort(r.value))}</text>`;
    });
    el.innerHTML = `<svg width="${Wd}" height="${H}" viewBox="0 0 ${Wd} ${H}">${g}</svg>`;
  });
}

/* ================= navigation ================= */
function navGroups() {
  const g = [];
  if (isEmployee()) {
    g.push({
      label: 'MY WORKSPACE',
      items: [
        ['emp-dashboard', 'My Dashboard'],
        ['emp-tasks', 'My Assigned Tasks'],
        ['emp-worklogs', 'Daily Work Updates'],
        ['emp-attendance', 'My Attendance'],
        ['emp-leave', 'Apply Leave'],
        ['emp-salary', 'My Salary Slips'],
        ['emp-idcard', 'My ID Card']
      ]
    });
    return g;
  }
  if (isOwner()) g.push({ label: '', items: [['overview', 'Overview']] });

  // Dedicated Sidebar Heading: DAILY WORK REPORT
  g.push({
    label: 'DAILY WORK REPORT',
    items: [
      ['daily-work-reports', 'Daily Work Reports'],
      ['task-allocation', 'Assign Work & Tasks'],
      ['project-manager', 'Project Hub & Deadlines']
    ]
  });

  if (can('projects')) g.push({ label: 'PROJECTS', items: [['projects', 'All projects'], ['proj-history', 'Project history (Delivered)']] });
  if (can('erp')) g.push({ label: 'ERP', items: [['erp-home', 'ERP dashboard'], ['erp-inventory', 'Inventory'], ['erp-issues', 'Stock issue register'], ['erp-holdings', 'Who holds what'], ['erp-sales', 'Sales invoices'], ['erp-purchases', 'Purchases']] });
  if (can('crm')) g.push({ label: 'CRM', items: [['crm-home', 'CRM dashboard'], ['crm-leads', 'Leads'], ['crm-pipeline', 'Pipeline'], ['crm-customers', 'Customers']] });
  if (can('hrms')) g.push({ label: 'HRMS', items: [['hr-home', 'HR dashboard'], ['hr-candidates', '🎯 Candidates & Hiring'], ['hr-salary-hub', 'Salary & Hours Dashboard'], ['hr-timesheet', 'Staff Timesheet & Tracking'], ['hr-employees', 'Employees & ID Cards'], ['hr-attendance', 'Attendance'], ['hr-leave', 'Leave'], ['hr-payroll', 'Payroll']] });
  if (can('finance')) g.push({ label: 'FINANCE', items: [['fin-home', 'Finance dashboard'], ['fin-receivables', 'Money to collect'], ['fin-expenses', 'Expenses'], ['fin-staff-costs', 'Staff daily costs']] });
  if (isOwner()) g.push({ label: 'ADMIN', items: [['admin-users', 'Logins and access']] });
  return g;
}
function route() {
  const all = navGroups().flatMap(g => g.items.map(i => i[0]));
  const h = location.hash.replace(/^#/, '');
  if (h && V[h]) return h;
  return all.includes(h) ? h : (all[0] || '');
}
function renderNav(D) {
  const cur = route(), a = D.attn;
  const overdueTasks = (S.tasks || []).filter(t => t.status !== 'Completed' && t.dueDate && t.dueDate < today());
  const lateProjects = S.projects.filter(p => p.status === 'Running' && p.end && p.end < today());
  const myPendingTasks = isEmployee() ? (S.tasks || []).filter(t => t.empId === (S.user && S.user.empId) && t.status !== 'Completed') : [];
  const newCandidates = (S.candidates || []).filter(c => c.status === 'Applied');

  const badges = {
    'hr-candidates': [newCandidates.length, false],
    'task-allocation': [overdueTasks.length, true],
    'project-manager': [lateProjects.length, true],
    'emp-tasks': [myPendingTasks.length, false],
    'erp-inventory': [a.low.length, a.low.some(p => (D.stock.get(p.id) || 0) <= 0)],
    'erp-sales': [can('erp') ? a.overdue.length : 0, true],
    'fin-receivables': [a.overdue.length, true],
    'crm-leads': [a.follow.length, false],
    'hr-leave': [a.pending.length, false],
    'projects': [a.late.length, true]
  };
  $('#nav').innerHTML = navGroups().map(g => `<div class="nav-group">${g.label ? `<div class="nav-label">${g.label}</div>` : ''}${g.items.map(([id, label]) => {
    const b = badges[id];
    return `<a href="#${id}"${id === cur ? ' aria-current="page"' : ''}>${label}${b && b[0] ? `<span class="badge${b[1] ? ' badge-bad' : ''}" title="Needs attention">${b[0]}</span>` : ''}</a>`;
  }).join('')}</div>`).join('');
  $('#companyName').textContent = S.company.name || 'Your company';
  const u = S.user;
  $('#brandSub').textContent = isOwner() ? 'Owner view' : isEmployee() ? 'Employee Self-Service' : (u.modules || []).map(m => MODULE_NAMES[m]).join(' · ');
  $('#sideFoot').innerHTML = `<div class="who"><b>${esc(u.name)}</b><span>${isOwner() ? 'Owner, sees everything' : isEmployee() ? 'Employee portal · ' + esc(u.loginId) : 'Login: ' + esc(u.loginId)}</span></div><div class="who-acts"><button class="link-btn" data-action="my-password">Change password</button><button class="link-btn" data-action="logout">Log out</button></div>`;
}
function renderBanner() {
  const el = $('#banner');
  const html = isOwner() && S.sampleCount > 0 ? `<div class="banner"><span><strong>Sample data.</strong> ${S.sampleCount} example records are loaded so you can see how each module works. Anything you add or edit is kept as your own.</span><button class="btn btn-sm" data-action="clear-sample">Remove sample data</button></div>` : '';
  if (el.innerHTML !== html) el.innerHTML = html;
}

/* ================= render loop ================= */
const V = {};
let raf = 0;
function scheduleRender() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); }
function render() {
  const ready = S.status === 'ready';
  $('#app').hidden = !ready;
  $('#auth').hidden = ready || S.status === 'boot';
  if (!ready) { if (S.status !== 'boot') renderAuth(); return; }
  if ($('#auth').dataset.screen) { $('#auth').innerHTML = ''; $('#auth').dataset.screen = ''; }   // never keep a typed password around
  const view = $('#view'), r = route();
  const ae = document.activeElement;
  const keep = ae && ae.id && view.contains(ae) ? { id: ae.id, s: ae.selectionStart, e: ae.selectionEnd } : null;
  CHARTS = {};
  const D = derive();
  view.innerHTML = V[r] ? V[r](D) : empty('Nothing to open', 'This login has no modules switched on. Ask the owner to give it access.');
  renderNav(D);
  renderBanner();
  mountCharts();
  document.title = (S.company.name || 'Business Suite') + ' · Business Suite';
  if (keep) {
    const el = document.getElementById(keep.id);
    if (el && el !== document.activeElement) { el.focus({ preventScroll: true }); try { if (keep.s != null) el.setSelectionRange(keep.s, keep.e); } catch (e) { /* not a text field */ } }
  }
}
window.addEventListener('hashchange', () => {
  if (S.status !== 'ready') return;
  S.ui.profile = S.ui.pendingProfile || '';
  S.ui.pendingProfile = '';
  render();
  $('#main').scrollTop = 0; window.scrollTo(0, 0);
  const cur = $('#nav a[aria-current="page"]');
  if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
});
window.addEventListener('resize', debounce(() => mountCharts(), 150));

/* ================= delegated events ================= */
const ACT = {}, CHG = {};
ACT['toggle-theme'] = () => { toggleAppTheme(); };
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = ACT[el.dataset.action];
  if (fn) { ev.preventDefault(); fn(el, ev); }
});
document.addEventListener('change', ev => {
  const el = ev.target.closest('[data-change]');
  if (el && CHG[el.dataset.change]) CHG[el.dataset.change](el, ev);
});
document.addEventListener('input', ev => {
  const el = ev.target.closest('[data-input="search"]');
  if (el) { S.ui.q[el.dataset.view] = el.value; scheduleRender(); }
});
CHG.filter = el => { S.ui.filter[el.dataset.key] = el.value; scheduleRender(); };

/* One row of a "needs attention" list. Title and sub-line are HTML, already escaped by the caller. */
const attnItem = (href, t, s, bad) => `<li><a class="${bad ? 'bad' : ''}" href="${href}"><span class="t">${t}</span><span class="s">${s}</span></a></li>`;
const attnList = (items, clear) => items.length ? `<ul class="attn">${items.join('')}</ul>` : `<p class="allclear">${esc(clear)}</p>`;
function lowStockItem(D, p) {
  const s = D.stock.get(p.id) || 0;
  const onOrder = sum(S.purchases.filter(x => x.productId === p.id && x.status !== 'Received'), x => x.qty);
  return attnItem('#erp-inventory', `${esc(p.name)} ${s <= 0 ? 'is out of stock' : `is down to ${qty(s)} ${esc(p.unit || 'pcs')}`}`, `Reorder level ${qty(p.reorder)}${onOrder ? ` · ${qty(onOrder)} already on order` : ' · nothing on order'}`, s <= 0);
}
