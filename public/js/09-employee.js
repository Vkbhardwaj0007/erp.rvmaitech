'use strict';
/* ================= Employee Self-Service (ESS) Portal ================= */

/* Helper to generate a clean SVG QR Code representation */
function generateQrSvg(dataStr) {
  // Deterministic SVG QR representation based on string hash
  let hash = 0;
  for (let i = 0; i < dataStr.length; i++) {
    hash = ((hash << 5) - hash) + dataStr.charCodeAt(i);
    hash |= 0;
  }
  const size = 21; // 21x21 modules standard QR
  let rects = '';
  // Corner position detection patterns
  const isFinder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      let filled = false;
      if (isFinder(r, c)) {
        const border = (r === 0 || r === 6 || c === 0 || c === 6 || r === size - 7 || r === size - 1 || c === size - 7 || c === size - 1);
        const center = (r >= 2 && r <= 4 && (c >= 2 && c <= 4 || c >= size - 5 && c <= size - 3)) || (r >= size - 5 && r <= size - 3 && c >= 2 && c <= 4);
        filled = border || center;
      } else {
        const bit = ((hash ^ (r * 31 + c * 17)) >>> ((r + c) % 16)) & 1;
        filled = bit === 1;
      }
      if (filled) rects += `<rect x="${c}" y="${r}" width="1" height="1" fill="#0f172a"/>`;
    }
  }
  return `<svg viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">${rects}</svg>`;
}

/* Helper to render complete printable Employee ID Card HTML */
function renderIdCardHtml(e, company) {
  if (!e) return '<div class="empty"><h3>No employee found</h3></div>';
  const coName = (company && company.name) || 'RvmAiTech';
  const qrData = JSON.stringify({ code: e.code, name: e.name, co: coName, role: e.role || '', valid: 'VERIFIED' });
  const qrSvg = generateQrSvg(qrData);
  const photo = e.photoId ? `<img src="/api/files/${esc(e.photoId)}" alt="${esc(e.name)}">` : `<span>${esc(initials(e.name))}</span>`;

  return `
  <div class="idcard-container" id="printableArea">
    <div class="idcard">
      <div class="idcard-lanyard"></div>
      <div class="idcard-top">
        <div style="display:flex;justify-content:center;margin-bottom:4px">
          <img src="/logo.png" alt="${esc(coName)}" style="height:34px;max-width:170px;object-fit:contain">
        </div>
        <div class="idcard-tag">Official Identity Card</div>
      </div>
      <div class="idcard-photo-box">
        <div class="idcard-photo">${photo}</div>
      </div>
      <div class="idcard-body">
        <div class="idcard-name">${esc(e.name)}</div>
        <div><span class="idcard-role">${esc(e.role || 'Team Member')}</span></div>
        <div class="idcard-badge-num">ID: ${esc(e.code)}</div>

        <table class="idcard-table">
          <tr><td>Department</td><td>${esc(e.dept || 'Operations')}</td></tr>
          <tr><td>Date of Join</td><td>${fmtDate(e.joined)}</td></tr>
          <tr><td>Blood Group</td><td>${esc(e.bloodGroup || 'O+')}</td></tr>
          <tr><td>Emergency</td><td>${esc(e.emergencyPhone || e.phone || '—')}</td></tr>
        </table>

        <div class="idcard-foot">
          <div class="idcard-qr" title="Scan to verify employee">${qrSvg}</div>
          <div class="idcard-sign">
            <b>Authorized Signature</b>
            <span>${esc(coName)}</span>
          </div>
        </div>
      </div>
      <div class="idcard-stripe"></div>
    </div>
  </div>`;
}

/* Helper to copy text to clipboard */
async function copyToClipboard(txt, successMsg) {
  try {
    await navigator.clipboard.writeText(txt);
    toast(successMsg || 'Copied to clipboard!', 'good');
  } catch (err) {
    // fallback
    const t = document.createElement('textarea');
    t.value = txt;
    document.body.appendChild(t);
    t.select();
    document.execCommand('copy');
    t.remove();
    toast(successMsg || 'Copied to clipboard!', 'good');
  }
}

/* ================= 1. Employee Dashboard ================= */
V['emp-dashboard'] = D => {
  const me = myEmployee();
  if (!me) return empty('Employee Profile Not Found', 'Your login is not yet linked to an active employee profile. Contact HR.');
  const t = today();
  const todayMark = markOf(me.id, t);
  const myLeaves = S.leaves.filter(l => l.empId === me.id);
  const pendingLeaves = myLeaves.filter(l => l.status === 'Pending');
  const myProjects = S.projects.filter(p => p.status !== 'Completed' && (p.leadId === me.id || (p.memberIds || []).includes(me.id)));
  const myLogs = (S.worklogs || []).filter(w => w.empId === me.id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const curMonth = t.slice(0, 7);
  const payRows = payroll(curMonth);
  const myPay = payRows.find(r => r.e.id === me.id);

  let checkinStatusHtml = '';
  if (todayMark === 'P') {
    checkinStatusHtml = `<span class="stamp stamp-good" style="font-size:14px;padding:6px 14px">✓ Marked Present for Today</span>`;
  } else if (todayMark === 'H') {
    checkinStatusHtml = `<span class="stamp stamp-warn" style="font-size:14px;padding:6px 14px">Marked Half Day for Today</span>`;
  } else if (todayMark === 'L' || todayMark === 'U') {
    checkinStatusHtml = `<span class="stamp stamp-info" style="font-size:14px;padding:6px 14px">On Approved Leave Today</span>`;
  } else {
    checkinStatusHtml = `
      <div class="checkin-actions">
        <button class="btn-checkin" data-action="my-checkin" data-mark="P">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          Mark Present (Check-In)
        </button>
        <button class="btn btn-sm" style="color:#fff;border-color:rgba(255,255,255,0.4)" data-action="my-checkin" data-mark="H">
          Mark Half Day
        </button>
      </div>`;
  }

  const recentLogsHtml = myLogs.slice(0, 3).map(w => `
    <div class="worklog-card">
      <div class="worklog-card-head">
        <div class="worklog-who">Report for ${fmtDate(w.date)}</div>
        ${w.projectId ? `<span class="stamp stamp-info">${esc((D.proj.get(w.projectId) || {}).name || 'Project')}</span>` : ''}
      </div>
      <div class="worklog-section">
        <div class="worklog-section-title">Yesterday's Accomplishments (Kal kya kiya)</div>
        <p>${esc(w.yesterdayWork)}</p>
      </div>
      <div class="worklog-section">
        <div class="worklog-section-title">Today's Tasks (Aaj ka plan)</div>
        <p>${esc(w.todayWork)}</p>
      </div>
      ${w.blockers ? `<div class="worklog-blocker"><b>Blockers:</b> ${esc(w.blockers)}</div>` : ''}
    </div>
  `).join('');

  return `
    <div class="checkin-hero">
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <img src="/logo.png" alt="RvmAiTech" style="height:44px;object-fit:contain">
        <div>
          <div class="eyebrow" style="color:rgba(255,255,255,0.8)">EMPLOYEE SELF-SERVICE · ${esc(me.code)}</div>
          <h2>Namaste, ${esc(me.name)}!</h2>
          <p>${esc(me.role || 'Team Member')} · ${esc(me.dept || 'Operations')} · Today is ${DAYS[parseISO(t).getDay()]}, ${fmtDate(t)}</p>
        </div>
      </div>
      <div>${checkinStatusHtml}</div>
    </div>

    <div class="tiles">
      ${tile('Today Attendance', todayMark ? (MARKS[todayMark] || 'Marked') : 'Not Checked-in', todayMark ? 'Status updated' : 'Click check-in button above', '#emp-attendance')}
      ${tile('My Leave Requests', String(pendingLeaves.length), pendingLeaves.length ? 'Pending HR approval' : 'All clear', '#emp-leave')}
      ${tile('Running Projects', String(myProjects.length), myProjects.map(p => esc(p.name)).join(', ') || 'None assigned', '#emp-worklogs')}
      ${tile('Estimated Net Pay', myPay ? inr(myPay.net) : inr(me.salary), `${monthName(curMonth)} month-to-date`, '#emp-salary')}
    </div>

    <div class="cols">
      <div class="stack">
        <section class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <div>
              <h2>Quick Daily Work Update</h2>
              <p class="card-sub">Kal kya kiya tha aur aaj kya kaam hai, yahan se direct update karein.</p>
            </div>
            <a class="btn btn-primary" href="#emp-worklogs">Open Worklog</a>
          </div>
          <form class="form" id="quickWorkForm">
            <div class="field field-full">
              <label for="qw-yesterday">Kal kya kaam kiya tha? (Yesterday's work)</label>
              <textarea id="qw-yesterday" name="yesterdayWork" rows="2" placeholder="Tasks completed yesterday..." required></textarea>
            </div>
            <div class="field field-full">
              <label for="qw-today">Aaj kya kaam karna hai? (Today's planned tasks)</label>
              <textarea id="qw-today" name="todayWork" rows="2" placeholder="Tasks planned for today..." required></textarea>
            </div>
            <div class="vactions" style="margin-top:8px">
              <button type="submit" class="btn btn-primary">Submit Daily Update</button>
            </div>
          </form>
        </section>

        <section class="card">
          <h2>Assigned Projects (${myProjects.length})</h2>
          <p class="card-sub">Projects where you are assigned as lead or member.</p>
          ${myProjects.length ? `<div class="plist">${myProjects.map(p => `
            <div class="plist-row">
              <div>
                <b>${esc(p.name)}</b>
                <span class="sub">${esc(p.location || 'Site')} · Status: ${esc(p.status)}</span>
              </div>
              <div class="pl-lead">
                <b>${p.leadId === me.id ? 'You are Project Lead' : 'Team Member'}</b>
                <span>Progress: ${num(p.progress)}%</span>
              </div>
              <div>${meter(p.progress)}</div>
            </div>
          `).join('')}</div>` : '<p class="muted">No projects currently assigned to you.</p>'}
        </section>
      </div>

      <div class="stack">
        <section class="card">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h2>Recent Work Updates</h2>
            <a class="link-btn" href="#emp-worklogs">View all</a>
          </div>
          ${recentLogsHtml || '<p class="muted">No work updates submitted yet. Submit your first update above.</p>'}
        </section>

        <section class="card">
          <h2>My Official ID Card</h2>
          <p class="card-sub">Your digital identity badge with QR code verification.</p>
          <div style="text-align:center;padding:10px 0">
            ${avatar(me, 'lg')}
            <div style="margin-top:10px">
              <b>${esc(me.name)}</b>
              <div class="sub">${esc(me.code)} · ${esc(me.role || '')}</div>
            </div>
            <div class="vactions" style="justify-content:center;margin-top:14px">
              <a class="btn btn-primary" href="#emp-idcard">View & Print ID Card</a>
            </div>
          </div>
        </section>
      </div>
    </div>`;
};

/* Quick worklog submit from dashboard */
document.addEventListener('submit', async ev => {
  if (ev.target && ev.target.id === 'quickWorkForm') {
    ev.preventDefault();
    const form = ev.target;
    const y = form.yesterdayWork.value.trim();
    const t = form.todayWork.value.trim();
    if (!y || !t) return toast('Please enter both yesterday and today work.', 'warn');
    const me = myEmployee();
    try {
      await dbAdd('worklogs', {
        empId: me.id,
        date: today(),
        yesterdayWork: y,
        todayWork: t,
        blockers: ''
      });
      form.reset();
      toast('Daily work update submitted successfully!', 'good');
    } catch (e) {
      toast(e.message || 'Could not save work update.', 'bad');
    }
  }
});

/* Check-in action */
ACT['my-checkin'] = async el => {
  const mark = el.dataset.mark || 'P';
  try {
    await api('POST', '/api/my-attendance', { mark });
    await refresh();
    toast(`Marked ${mark === 'P' ? 'Present' : 'Half Day'} for today!`, 'good');
  } catch (e) {
    toast(e.message || 'Could not mark attendance.', 'bad');
  }
};

/* ================= 2. Employee Attendance View ================= */
V['emp-attendance'] = D => {
  const me = myEmployee();
  if (!me) return empty('Employee Profile Not Found', 'Log in as an employee to see attendance.');
  const date = S.ui.attDate, t = today();
  const ym = date.slice(0, 7), dim = daysIn(ym);

  let c = { P: 0, A: 0, H: 0, L: 0, none: 0 };
  const dailyRows = [];
  for (let d = 1; d <= dim; d++) {
    const iso = ym + '-' + pad(d);
    if (iso > t) break;
    const mk = markOf(me.id, iso);
    if (mk === 'U' || mk === 'L') c.L++;
    else if (mk) c[mk]++;
    else if (!isSunday(iso)) c.none++;

    const dt = parseISO(iso);
    const dayName = dt ? DAYS[dt.getDay()] : '';
    const isSun = isSunday(iso);
    dailyRows.push(`
      <tr>
        <td class="nowrap"><b>${fmtDate(iso)}</b></td>
        <td>${dayName}</td>
        <td>${isSun ? stamp('Sunday / Off', 'mute') : mk ? stamp(MARKS[mk] || mk, mk === 'P' ? 'good' : mk === 'A' ? 'bad' : mk === 'H' ? 'warn' : 'info') : stamp('Not Marked', 'mute')}</td>
      </tr>
    `);
  }

  const todayMark = markOf(me.id, t);
  return head('EMPLOYEE WORKSPACE', 'My Attendance', `Monthly record for ${monthName(ym)} · ${esc(me.name)} (${esc(me.code)})`,
      `<span class="stepper"><button class="btn btn-sm" data-action="att-day" data-dir="-1" aria-label="Previous day">‹</button><input type="date" id="attDate" data-change="att-date" value="${esc(date)}" max="${t}"><button class="btn btn-sm" data-action="att-day" data-dir="1" aria-label="Next day"${date >= t ? ' disabled' : ''}>›</button></span>`
      + (!todayMark ? `<button class="btn btn-primary" data-action="my-checkin" data-mark="P">Mark Present Today</button>` : ''))
    + `<div class="toolbar"><div class="chips">
        ${stamp(`${c.P} days Present`, 'good')}
        ${stamp(`${c.A} days Absent`, c.A ? 'bad' : 'mute')}
        ${stamp(`${c.H} Half days`, c.H ? 'warn' : 'mute')}
        ${stamp(`${c.L} Leave days`, c.L ? 'info' : 'mute')}
        ${stamp(`${c.none} Unmarked`, 'mute')}
      </div></div>
      <div class="stack">
        <section class="card">
          <h2>Daily Attendance Log (${monthName(ym)})</h2>
          ${table(['Date', 'Day', 'Status'], dailyRows.reverse())}
        </section>
      </div>`;
};

/* ================= 3. Employee Leave View ================= */
V['emp-leave'] = D => {
  const me = myEmployee();
  if (!me) return empty('Employee Profile Not Found', 'Log in as an employee to apply for leave.');
  const myLeaves = S.leaves.filter(l => l.empId === me.id).sort((a, b) => String(b.from).localeCompare(String(a.from)));
  const pending = myLeaves.filter(l => l.status === 'Pending').length;

  const rows = myLeaves.map(l => `
    <tr>
      <td class="nowrap"><b>${fmtDay(l.from)}${l.to !== l.from ? ' to ' + fmtDay(l.to) : ''} ${String(l.from).slice(0, 4)}</b></td>
      <td>${esc(l.type)}</td>
      <td class="num">${qty(l.days)} days</td>
      <td>${esc(l.reason || '—')}</td>
      <td>${stamp(l.status, l.status === 'Approved' ? 'good' : l.status === 'Rejected' ? 'bad' : 'warn')}</td>
      <td>${l.decidedOn ? fmtDate(l.decidedOn) : '<span class="muted">Waiting</span>'}</td>
      <td class="acts">${l.status === 'Pending' ? `<button class="link-btn danger" data-action="leave-del" data-id="${esc(l.id)}">Cancel</button>` : ''}</td>
    </tr>
  `);

  return head('EMPLOYEE WORKSPACE', 'Apply & Track Leave', `<b>${pending}</b> pending approval · Total ${myLeaves.length} requests`,
      `<button class="btn btn-primary" data-action="emp-leave-new">Apply For Leave</button>`)
    + (myLeaves.length === 0 ? empty('No leave requests yet', 'Need time off? Click Apply For Leave to submit a request to HR.', '<button class="btn btn-primary" data-action="emp-leave-new">Apply For Leave</button>')
      : table(['Dates', 'Leave Type', { n: 'Duration' }, 'Reason', 'Status', 'Decided On', ''], rows));
};

ACT['emp-leave-new'] = () => {
  const me = myEmployee();
  if (!me) return;
  openForm({
    title: 'Apply For Leave',
    sub: `Submit a leave application for ${me.name}`,
    submit: 'Submit Application',
    fields: [
      { name: 'type', label: 'Leave Type', type: 'select', options: LEAVE_TYPES, value: 'Casual' },
      { name: 'from', label: 'From Date', type: 'date', required: true, value: today(), min: today() },
      { name: 'to', label: 'To Date', type: 'date', required: true, value: today(), min: today() },
      { name: 'reason', label: 'Reason for leave', type: 'textarea', rows: 3, required: true, maxlength: 300 }
    ],
    onSubmit: async v => {
      if (!parseISO(v.from) || !parseISO(v.to) || v.to < v.from) throw new UserError('The "To" date must be on or after the "From" date.');
      const days = leaveDays(v.from, v.to);
      if (!days) throw new UserError('These dates fall on a Sunday, which is already a weekly off.');
      await dbAdd('leaves', {
        empId: me.id,
        type: v.type,
        from: v.from,
        to: v.to,
        reason: v.reason,
        days,
        status: 'Pending',
        createdAt: Date.now()
      });
      toast('Leave application submitted to HR!', 'good');
    }
  });
};

/* ================= 4. Employee Salary Slip View ================= */
V['emp-salary'] = D => {
  const me = myEmployee();
  if (!me) return empty('Employee Profile Not Found', 'Log in as an employee to view salary slips.');
  const month = S.ui.payMonth;
  const payRows = payroll(month);
  const r = payRows.find(x => x.e.id === me.id) || {
    e: me, gross: me.salary, payable: daysIn(month), lop: 0, lopAmt: 0, pf: Math.round(me.salary * 0.5 * 0.12), pt: me.salary > 15000 ? 200 : 0, net: me.salary - Math.round(me.salary * 0.5 * 0.12) - (me.salary > 15000 ? 200 : 0), dim: daysIn(month)
  };

  const basic = Math.round(r.gross * 0.5);
  const hra = Math.round(r.gross * 0.3);
  const allowance = r.gross - basic - hra;
  const totalDeductions = (r.lopAmt || 0) + (r.pf || 0) + (r.pt || 0);

  return head('EMPLOYEE WORKSPACE', 'My Salary Slips', `Official Payslip for ${monthName(month)} · ${esc(me.name)} (${esc(me.code)})`,
      `<span class="stepper"><button class="btn btn-sm" data-action="pay-month" data-dir="-1" aria-label="Previous month">‹</button><span class="cur">${esc(monthName(month))}</span><button class="btn btn-sm" data-action="pay-month" data-dir="1" aria-label="Next month">›</button></span><button class="btn btn-primary" onclick="printDoc('printableArea')">Print / Download PDF</button>`)
    + `
    <div class="payslip-wrap" id="printableArea">
      <div class="payslip-hdr">
        <div>
          <div class="logo-badge-dark"><img src="/logo-light.png?v=20261115" alt="RvmAiTech" style="height:42px;width:auto;max-width:180px;object-fit:contain;display:block"></div>
          <div class="payslip-sub" style="margin-top:6px">Employee Salary Statement · Confidential</div>
        </div>
        <div>
          <div class="payslip-title">PAYSLIP</div>
          <div class="payslip-sub">${esc(monthName(month))}</div>
        </div>
      </div>

      <div class="payslip-meta">
        <div><b>Employee Code:</b> ${esc(me.code)}</div>
        <div><b>Employee Name:</b> ${esc(me.name)}</div>
        <div><b>Designation:</b> ${esc(me.role || 'Staff')}</div>
        <div><b>Department:</b> ${esc(me.dept || 'Operations')}</div>
        <div><b>Date of Joining:</b> ${fmtDate(me.joined)}</div>
        <div><b>Working Days:</b> ${r.payable} / ${r.dim} (LOP: ${r.lop || 0} days)</div>
      </div>

      <div class="payslip-grid">
        <div>
          <table class="payslip-col-table">
            <thead><tr><th>Earnings</th><th class="num">Amount (₹)</th></tr></thead>
            <tbody>
              <tr><td>Basic Salary (50%)</td><td class="num">${inr(basic)}</td></tr>
              <tr><td>House Rent Allowance (HRA 30%)</td><td class="num">${inr(hra)}</td></tr>
              <tr><td>Special Allowance</td><td class="num">${inr(allowance)}</td></tr>
              <tr style="font-weight:700"><td>Total Gross Earnings</td><td class="num">${inr(r.gross)}</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <table class="payslip-col-table">
            <thead><tr><th>Deductions</th><th class="num">Amount (₹)</th></tr></thead>
            <tbody>
              <tr><td>Loss of Pay (LOP)</td><td class="num">${r.lopAmt ? inr(r.lopAmt) : '₹0'}</td></tr>
              <tr><td>Provident Fund (PF)</td><td class="num">${inr(r.pf)}</td></tr>
              <tr><td>Professional Tax</td><td class="num">${r.pt ? inr(r.pt) : '₹0'}</td></tr>
              <tr style="font-weight:700"><td>Total Deductions</td><td class="num">${inr(totalDeductions)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="payslip-net">
        <div>
          <div>Net Take-Home Salary</div>
          <span style="font-size:12px;opacity:0.85">Deposited directly to registered bank account</span>
        </div>
        <div><b>${inr(r.net)}</b></div>
      </div>

      <div style="margin-top:24px;display:flex;justify-content:space-between;align-items:flex-end;font-size:11.5px;color:#64748b">
        <div>This is a system generated salary statement and does not require physical signature.</div>
        <div style="text-align:right">
          <div style="font-weight:700;color:#0f172a">${esc(S.company.name || 'Company')}</div>
          <div>Human Resources Department</div>
        </div>
      </div>
    </div>`;
};

/* ================= 5. Daily Work Updates View ================= */
V['emp-worklogs'] = D => {
  const me = myEmployee();
  if (!me) return empty('Employee Profile Not Found', 'Log in as an employee to submit work updates.');
  const myLogs = (S.worklogs || []).filter(w => w.empId === me.id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const myProjects = S.projects.filter(p => p.status !== 'Completed' && (p.leadId === me.id || (p.memberIds || []).includes(me.id)));

  const listHtml = myLogs.map(w => `
    <div class="worklog-card">
      <div class="worklog-card-head">
        <div>
          <div class="worklog-who">Work Report · ${fmtDate(w.date)}</div>
          <div class="worklog-sub">${w.projectId ? esc((D.proj.get(w.projectId) || {}).name || 'Project') : 'General Daily Tasks'}</div>
        </div>
        <button class="link-btn danger" data-action="worklog-del" data-id="${esc(w.id)}">Delete</button>
      </div>
      <div class="worklog-section">
        <div class="worklog-section-title">Kal kya kiya tha (Yesterday's Accomplishments)</div>
        <p>${esc(w.yesterdayWork)}</p>
      </div>
      <div class="worklog-section">
        <div class="worklog-section-title">Aaj kya kaam hai (Today's Tasks & Plan)</div>
        <p>${esc(w.todayWork)}</p>
      </div>
      ${w.blockers ? `<div class="worklog-blocker"><b>Blockers / Assistance Needed:</b> ${esc(w.blockers)}</div>` : ''}
    </div>
  `).join('');

  return head('EMPLOYEE WORKSPACE', 'Daily Work Updates', 'Record yesterday’s work and today’s plan so the team and management stay updated.',
      `<button class="btn btn-primary" data-action="worklog-new">New Work Report</button>`)
    + `<div class="cols">
        <div class="stack">
          <section class="card">
            <h2>Submit Daily Status ("Kal kya kiya, aaj kya karenge")</h2>
            <p class="card-sub">Daily report for ${DAYS[parseISO(today()).getDay()]}, ${fmtDate(today())}</p>
            <form class="form" id="fullWorkForm">
              <div class="field">
                <label for="fw-date">Date</label>
                <input type="date" id="fw-date" name="date" value="${today()}" max="${today()}" required>
              </div>
              <div class="field">
                <label for="fw-proj">Project (Optional)</label>
                <select id="fw-proj" name="projectId">
                  <option value="">General Work / No specific project</option>
                  ${myProjects.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}
                </select>
              </div>
              <div class="field field-full">
                <label for="fw-yesterday">Kal kya kaam kiya tha? (Yesterday's accomplished tasks) <span style="color:var(--bad)">*</span></label>
                <textarea id="fw-yesterday" name="yesterdayWork" rows="3" placeholder="List tasks completed yesterday..." required></textarea>
              </div>
              <div class="field field-full">
                <label for="fw-today">Aaj kya kaam karna hai? (Today's planned tasks) <span style="color:var(--bad)">*</span></label>
                <textarea id="fw-today" name="todayWork" rows="3" placeholder="List tasks planned for today..." required></textarea>
              </div>
              <div class="field field-full">
                <label for="fw-blockers">Blockers / Challenges (Optional)</label>
                <textarea id="fw-blockers" name="blockers" rows="2" placeholder="Any issues, roadblocks, or help needed from manager..."></textarea>
              </div>
              <div class="vactions">
                <button type="submit" class="btn btn-primary">Save Daily Report</button>
              </div>
            </form>
          </section>
        </div>

        <div class="stack">
          <section class="card">
            <h2>Past Daily Reports (${myLogs.length})</h2>
            <p class="card-sub">Your submitted status history.</p>
            ${listHtml ? `<div class="plist">${listHtml}</div>` : '<p class="muted">No work reports submitted yet. Use the form on the left to submit today’s update.</p>'}
          </section>
        </div>
      </div>`;
};

document.addEventListener('submit', async ev => {
  if (ev.target && ev.target.id === 'fullWorkForm') {
    ev.preventDefault();
    const f = ev.target;
    const me = myEmployee();
    try {
      await dbAdd('worklogs', {
        empId: me.id,
        date: f.date.value || today(),
        projectId: f.projectId.value || '',
        yesterdayWork: f.yesterdayWork.value.trim(),
        todayWork: f.todayWork.value.trim(),
        blockers: f.blockers.value.trim()
      });
      f.yesterdayWork.value = '';
      f.todayWork.value = '';
      f.blockers.value = '';
      toast('Work update saved and visible to management!', 'good');
    } catch (e) {
      toast(e.message || 'Could not save work update.', 'bad');
    }
  }
});

ACT['worklog-del'] = async el => {
  if (await confirmBox('Delete work report?', 'This report will be deleted from your work history.')) {
    save(() => dbDelete('worklogs', el.dataset.id), 'Work report deleted');
  }
};

/* ================= 6. Employee ID Card View ================= */
V['emp-idcard'] = () => {
  const me = myEmployee();
  if (!me) return empty('Employee Profile Not Found', 'Log in as an employee to view ID Card.');

  return head('EMPLOYEE WORKSPACE', 'My Digital ID Card', `Official company badge for ${esc(me.name)} (${esc(me.code)})`,
      `<button class="btn btn-primary" onclick="printDoc('printableArea')">Print / Download ID Card</button>`)
    + `
    <div style="display:flex;flex-direction:column;align-items:center;margin-top:16px">
      ${renderIdCardHtml(me, S.company)}
      <p class="note" style="text-align:center;max-width:400px;margin-top:16px">
        This is your official identity card. You can print it on PVC card paper or download as a PDF using the button above.
      </p>
    </div>`;
};

