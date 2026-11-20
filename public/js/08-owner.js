'use strict';
/* ================= Owner: everything in one place ================= */
V.overview = D => {
  const t = today(), m = t.slice(0, 7), a = D.attn, d = parseISO(t);
  const todayInv = S.invoices.filter(i => i.date === t), monthInv = invoicesIn(m);
  const open = S.leads.filter(l => OPEN_STAGES.includes(l.stage));
  const emps = activeEmps(), marks = emps.map(e => markOf(e.id, t));
  const present = marks.filter(x => x === 'P' || x === 'H').length, anyMarked = marks.some(Boolean);
  const running = S.projects.filter(p => p.status === 'Running').sort((x, y) => String(x.end || '9').localeCompare(String(y.end || '9')));
  const others = S.projects.filter(p => p.status === 'On hold' || p.status === 'Planned');
  const perDay = staffPerDay();
  const title = head(S.company.name || 'Your company', 'Everything at a glance', `${DAYS[d.getDay()]}, ${fmtDate(t)} · ${fyLabel(t)}`, '<a class="btn" href="#projects">All projects</a><a class="btn btn-primary" href="#fin-home">Finance</a>');
  if (!['products', 'customers', 'employees', 'projects', 'invoices', 'leads'].some(c => S[c].length)) {
    return title + empty('Your books are empty', 'Start with the basics: your staff, your products and your customers. Then add the projects you are running. Every module builds on those lists.',
      `<div class="vactions" style="justify-content:center"><a class="btn btn-primary" href="#hr-employees">Add employees</a><a class="btn" href="#erp-inventory">Add products</a><a class="btn" href="#crm-customers">Add customers</a><a class="btn" href="#admin-users">Create team logins</a></div>`);
  }
  const tiles = `<div class="tiles eight">
    ${tile('Revenue today', inrShort(billed(todayInv)), plural(todayInv.length, 'invoice') + ' billed today', '#fin-home')}
    ${tile('Revenue in ' + MONTHS[d.getMonth()], inrShort(billed(monthInv)), `${MON[+shiftMonth(m, -1).slice(5) - 1]} closed at ${inrShort(billed(invoicesIn(shiftMonth(m, -1))))}`, '#fin-home')}
    ${tile('Money to collect', inrShort(sum(S.invoices, balanceOf)), a.overdue.length ? `<span class="due">${plural(a.overdue.length, 'invoice')} overdue</span>` : 'nothing overdue', '#fin-receivables')}
    ${tile('Staff cost per day', inrShort(perDay), `${plural(emps.length, 'employee')} · ${inrShort(sum(emps, e => e.salary))} a month`, '#fin-home')}
    ${tile('Projects running', String(running.length), `${others.length} planned or on hold${a.late.length ? `, <span class="due">${a.late.length} late</span>` : ''}`, '#projects')}
    ${tile('Staff in today', anyMarked ? `${present}<span class="muted" style="font-size:.55em"> of ${emps.length}</span>` : '—', anyMarked ? `${marks.filter(x => x === 'A').length} absent, ${marks.filter(x => x === 'L' || x === 'U').length} on leave` : isSunday(t) ? 'Sunday, weekly off' : 'attendance not marked yet', '#hr-attendance')}
    ${tile('Open pipeline', inrShort(sum(open, l => l.value)), plural(open.length, 'open lead'), '#crm-pipeline')}
    ${tile('Stock to reorder', String(a.low.length), `stock worth ${inrShort(sum(S.products, p => Math.max(0, D.stock.get(p.id) || 0) * num(p.cost)))} on hand`, '#erp-inventory')}
  </div>`;

  const deptIcons = {
    'Technology Department': '💻',
    'Operations Department': '⚙️',
    'Finance & Accounts Department': '📊',
    'Human Resources Department': '👥',
    'Sales & Marketing Department': '📢',
    'Administration Department': '🏢',
    'Executive Leadership': '👑'
  };

  const allDepts = [
    'Technology Department',
    'Operations Department',
    'Finance & Accounts Department',
    'Human Resources Department',
    'Sales & Marketing Department',
    'Administration Department'
  ];

  const activeDeptFilter = S.ui.ownerDeptFilter || 'all';

  // 1. "Kon se Project pe Kon sa Department Kaam Kar Raha Hai" Matrix HTML
  const allProjects = S.projects.slice().sort((a, b) => (b.status === 'Running' ? 1 : 0) - (a.status === 'Running' ? 1 : 0));
  const projectDeptMatrixHtml = allProjects.map(p => {
    const lead = D.emp.get(p.leadId) || {};
    const team = (p.memberIds || []).map(id => D.emp.get(id)).filter(Boolean);
    const pTasks = (S.tasks || []).filter(k => k.projectId === p.id);
    
    // Departments involved in this project (either declared or having team/tasks)
    const pDepts = p.departments && p.departments.length ? p.departments
      : [...new Set(team.map(e => e.dept).concat(pTasks.map(k => k.dept)).filter(Boolean))];

    return `
      <div class="card pmatrix-card" style="margin-bottom:16px;border-left:4px solid ${p.status === 'Running' ? 'var(--good,#10b981)' : 'var(--accent,#f47b20)'}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:10px">
          <div>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="stamp stamp-${p.status === 'Running' ? 'good' : 'info'}">${esc(p.status)}</span>
              <h3 style="margin:0;font-size:17px;font-weight:800;color:var(--heading)">${esc(p.name)}</h3>
            </div>
            <p class="card-sub" style="margin:3px 0 0">
              Client: <b>${esc(p.client || 'Internal')}</b> · Site: <b>${esc(p.location || 'HQ')}</b> · Lead: <b>${esc(lead.name || 'Unassigned')}</b> (${esc(lead.role || 'Lead')})
            </p>
          </div>
          <div style="text-align:right">
            <span style="font-size:12px;font-weight:700;color:var(--ink-2)">${projectDates(p)}</span>
            <div style="width:140px;margin-top:4px">${meter(p.progress)}</div>
          </div>
        </div>

        ${p.note ? `<p style="font-size:12.5px;color:var(--ink-2);background:var(--sheet);padding:8px 12px;border-radius:6px;border:1px solid var(--rule);margin-bottom:12px">💡 <b>Executive Scope:</b> ${esc(p.note)}</p>` : ''}

        <!-- Multi-Department Breakdown for this Project -->
        <div style="margin-top:10px">
          <div style="font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin-bottom:8px">
            🏢 Departments Working on This Project (${pDepts.length} Departments Active):
          </div>
          <div class="pmatrix-dept-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px">
            ${pDepts.map(dName => {
              const dEmps = team.filter(e => e.dept === dName);
              const dTasks = pTasks.filter(k => k.dept === dName || dEmps.some(e => e.id === k.empId));
              const icon = deptIcons[dName] || '📂';
              return `
                <div class="pmatrix-dept-box" style="background:var(--sheet);border:1px solid var(--rule);border-radius:8px;padding:10px 12px">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                    <span style="font-weight:800;font-size:13px;color:var(--heading)">${icon} ${esc(dName)}</span>
                    <span class="stamp stamp-info" style="font-size:10px">${dEmps.length} staff</span>
                  </div>
                  <div style="font-size:11.5px;color:var(--ink-2);margin-bottom:6px">
                    <b>Staff:</b> ${dEmps.length ? dEmps.map(e => esc(e.name)).join(', ') : 'Collaborating engineers'}
                  </div>
                  <div style="border-top:1px dashed var(--rule);padding-top:6px;font-size:11.5px">
                    <b>Active Deliverable:</b>
                    ${dTasks.length ? `<span style="color:var(--ink)">${esc(dTasks[0].title)}</span>` : '<span class="muted">Ongoing milestone execution</span>'}
                  </div>
                </div>`;
            }).join('')}
          </div>
        </div>
      </div>`;
  }).join('');

  // 2. "Kon Kya Kar Raha Hai" Live Department Staff Work Tracker
  let displayEmps = emps;
  if (activeDeptFilter !== 'all') {
    displayEmps = emps.filter(e => e.dept === activeDeptFilter);
  }

  const staffWorkCardsHtml = displayEmps.map(e => {
    const todayTasks = (S.tasks || []).filter(k => k.empId === e.id);
    const activeTask = todayTasks.find(k => k.dueDate === t || k.status === 'In Progress') || todayTasks[0];
    const taskProj = activeTask && activeTask.projectId ? D.proj.get(activeTask.projectId) : null;
    const icon = deptIcons[e.dept] || '👤';

    return `
      <div class="dept-emp-card" style="display:flex;flex-direction:column;justify-content:space-between">
        <div>
          <div class="dept-emp-top" style="margin-bottom:8px">
            <div class="person" style="gap:8px">
              ${avatar(e, 'sm')}
              <div>
                <b>${esc(e.name)}</b>
                <span class="sub">${esc(e.code)} · ${icon} ${esc(e.role || 'Staff')}</span>
              </div>
            </div>
            <button class="link-btn" data-action="quick-task-add" data-emp="${esc(e.id)}" data-dept="${esc(e.dept || '')}" title="Assign task to ${esc(e.name)}">+ Assign Work</button>
          </div>

          <!-- Current Project Badge -->
          <div style="margin-bottom:6px;min-width:0">
            ${taskProj ? `<span class="stamp stamp-info" style="font-size:11px;max-width:100%;white-space:normal;display:inline-block;line-height:1.35;padding:4px 10px;border-radius:8px" title="Project: ${esc(taskProj.name)}">📁 Project: <b>${esc(taskProj.name)}</b></span>`
              : `<span class="stamp stamp-mute" style="font-size:11px;max-width:100%;display:inline-block;padding:3px 8px;border-radius:6px">General Department Operations</span>`}
          </div>

          <!-- Today's Active Task ("Kya Kar Raha Hai") -->
          <div style="background:var(--paper);border:1px solid var(--rule);border-radius:6px;padding:8px 10px;font-size:12px;margin-bottom:6px">
            <div style="font-weight:700;color:var(--heading);margin-bottom:3px;display:flex;align-items:center;justify-content:space-between">
              <span>🎯 Today's Task:</span>
              ${activeTask ? `<span class="task-badge task-prio-${esc(activeTask.priority || 'Medium')}" style="font-size:10px">${esc(activeTask.priority || 'Medium')}</span>` : ''}
            </div>
            ${activeTask ? `
              <div style="color:var(--ink);font-weight:600">${esc(activeTask.title)}</div>
              <div style="margin-top:4px;font-size:11px;color:var(--ink-2);display:flex;justify-content:space-between;align-items:center">
                <span>Status: <b>${esc(activeTask.status || 'In Progress')}</b></span>
                <span>Due: ${esc(fmtDate(activeTask.dueDate))}</span>
              </div>
            ` : `<span class="muted" style="font-style:italic">No specific task assigned for today yet.</span>`}
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--ink-2);border-top:1px solid var(--rule-2);padding-top:6px">
          <span>8-Hour Shift (09:00 - 17:00)</span>
          <a href="#hr-timesheet" onclick="S.ui.timesheetEmpId='${esc(e.id)}'" style="font-weight:700;color:var(--accent)">⏱️ View Timesheet & Hours →</a>
        </div>
      </div>`;
  }).join('');

  /* Most urgent first, across every module. */
  const items = [];
  const more = (list, n, href, label) => { if (list.length > n) items.push(attnItem(href, `${list.length - n} more ${label}`, 'Open the list to see them', false)); };
  a.late.slice(0, 2).forEach(p => items.push(attnItem('#projects', `${esc(p.name)} is ${plural(dayDiff(p.end, t), 'day')} past its target date`, `${esc(p.status)} · ${num(p.progress)}% done · lead ${esc(empName(D, p.leadId))}`, true)));
  more(a.late, 2, '#projects', 'late projects');
  a.overdue.slice(0, 3).forEach(i => items.push(attnItem('#fin-receivables', `${esc(i.no)} is ${plural(dayDiff(dueDate(i), t), 'day')} overdue`, `${esc(custLabel(D.cust.get(i.customerId)))} owes ${inr(balanceOf(i))}`, true)));
  more(a.overdue, 3, '#fin-receivables', 'overdue invoices');
  a.low.slice(0, 3).forEach(p => items.push(lowStockItem(D, p)));
  more(a.low, 3, '#erp-inventory', 'products running low');
  a.follow.slice(0, 2).forEach(l => { const late = dayDiff(l.followUp, t); items.push(attnItem('#crm-leads', `Follow up with ${esc(l.name)}${late ? `, ${plural(late, 'day')} late` : ' today'}`, `${esc(l.company || '')} · ${esc(l.stage)} · ${inrShort(l.value)} · ${esc(empName(D, l.ownerId))}`, false)); });
  more(a.follow, 2, '#crm-leads', 'follow-ups due');
  a.pending.slice(0, 2).forEach(l => items.push(attnItem('#hr-leave', `${esc(empName(D, l.empId))} asked for ${plural(num(l.days), 'day')} of ${esc(String(l.type).toLowerCase())} leave`, `From ${fmtDay(l.from)} · waiting for a decision`, false)));
  if (a.unmarked) items.push(attnItem('#hr-attendance', 'Attendance is not marked for today', `${plural(emps.length, 'employee')} to mark`, false));
  const incomplete = emps.filter(e => missingRecords(e).length).length;
  if (incomplete) items.push(attnItem('#hr-home', `${plural(incomplete, 'employee profile')} incomplete`, 'Photo, address or ID proof is missing', false));

  return title + tiles + `
    <!-- 1. Founder & CEO Command Center: Kon se Project pe Kon sa Department Kaam Kar Raha Hai -->
    <div class="stack" style="margin-top:20px">
      <section class="card" style="padding:22px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;border-bottom:2px solid var(--rule);padding-bottom:12px">
          <div>
            <h2 style="margin:0;font-size:20px;display:flex;align-items:center;gap:8px">
              🏢 Projects &amp; Multi-Department Collaboration Matrix
            </h2>
            <p class="card-sub" style="margin:3px 0 0">
              <b>Founder / CEO View:</b> Kon se Project pe Kon sa Department kaam kar raha hai (Technology, Operations, Sales &amp; Marketing, Finance, Admin).
            </p>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <a class="btn btn-primary btn-sm" href="#project-manager">⚡ Full Project Hub &amp; Deadlines</a>
            <button class="btn btn-sm" data-action="work-assign-new">+ Assign Single Task</button>
          </div>
        </div>
        ${projectDeptMatrixHtml}
      </section>

      <!-- 2. "Kon Kya Kar Raha Hai" Live Department Daily Work Board -->
      <section class="card" style="padding:22px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;border-bottom:2px solid var(--rule);padding-bottom:12px">
          <div>
            <h2 style="margin:0;font-size:20px;display:flex;align-items:center;gap:8px">
              👥 Department Live Work Tracker — "Kon Kya Kar Raha Hai"
            </h2>
            <p class="card-sub" style="margin:3px 0 0">
              Total <b>${emps.length}</b> staff across <b>6 Core Departments</b> · Live task assignments &amp; daily shift status.
            </p>
          </div>
          <button class="btn btn-primary btn-sm" data-action="dept-planner">⚡ Daily Department Task Planner</button>
        </div>

        <!-- Department Filter Pills -->
        <div class="tabs" style="margin-bottom:16px">
          <button type="button" class="tab-btn${activeDeptFilter === 'all' ? ' active' : ''}" onclick="S.ui.ownerDeptFilter='all'; render();">
            All Staff (${emps.length})
          </button>
          ${allDepts.map(dName => {
            const count = emps.filter(e => e.dept === dName).length;
            const icon = deptIcons[dName] || '📁';
            return `
              <button type="button" class="tab-btn${activeDeptFilter === dName ? ' active' : ''}" onclick="S.ui.ownerDeptFilter='${esc(dName)}'; render();">
                ${icon} ${esc(dName.replace(' Department', ''))} (${count})
              </button>`;
          }).join('')}
        </div>

        <!-- Department Employee Work Cards Grid -->
        <div class="dept-board" style="margin-top:14px">
          ${staffWorkCardsHtml}
        </div>
      </section>
    </div>

    <!-- 3. Financials, Monthly Revenue & Urgent Alerts -->
    <div class="cols" style="margin-top:20px">
      <div class="stack">
        <section class="card">
          <h2>Revenue by Month</h2>
          <p class="card-sub">Invoice totals including GST. ${MON[d.getMonth()]} is month to date.</p>
          ${salesChart('own')}
        </section>
      </div>
      <section class="card">
        <h2>Needs Attention</h2>
        <p class="card-sub">Across projects, money, stock, sales and staff.</p>
        ${attnList(items, 'All clear. Nothing is late, overdue or running low.')}
      </section>
    </div>`;
};

/* ================= Owner: logins and access ================= */
const moduleChecks = () => Object.keys(MODULE_NAMES).map(m => ({ value: m, label: MODULE_NAMES[m] }));
V['admin-users'] = () => {
  const body = S.users.slice().sort((a, b) => (a.role === 'owner' ? 0 : 1) - (b.role === 'owner' ? 0 : 1) || byName(a, b)).map(u => {
    const roleBadge = u.role === 'owner'
      ? stamp(u.title ? `${u.title}: everything` : 'Owner: everything', 'good')
      : u.modules.map(m => stamp(MODULE_NAMES[m], 'info')).join(' ');
    const kycBadge = u.kycGateActive
      ? ` ${stamp('🔒 KYC Policy Pending', 'warn')}`
      : u.kycCompleted
      ? ` ${stamp('✓ KYC Verified', 'good')}`
      : '';
    return `<tr><td><b>${esc(u.name)}</b>${u.title ? `<span class="sub">${esc(u.title)}${u.email ? ' · ' + esc(u.email) : ''}</span>` : ''}${u.id === S.user.id ? '<span class="sub">This is you</span>' : ''}</td><td class="mono">${esc(u.loginId)}</td><td>${roleBadge}${kycBadge}</td><td>${u.active ? stamp('On', 'good') : stamp('Turned off', 'mute')}</td><td class="nowrap">${u.lastLogin ? fmtDate(isoOf(new Date(u.lastLogin))) : '<span class="muted">Never</span>'}</td><td class="acts">${u.role === 'owner' && u.id === S.user.id ? '' : `<button class="link-btn" data-action="user-edit" data-id="${esc(u.id)}">Edit access</button> <button class="link-btn" data-action="user-pass" data-id="${esc(u.id)}">Reset password</button>${u.role === 'owner' ? '' : ` <button class="link-btn danger" data-action="user-del" data-id="${esc(u.id)}">Delete</button>`}`}</td></tr>`;
  });
  return head('ADMIN', 'Logins and access', `<b>${S.users.length}</b> logins · each one opens only the modules you tick`,
      '<button class="btn" data-action="edit-company">Change company name</button><button class="btn btn-primary" data-action="user-new">Add login</button>')
    + table(['Name', 'Login ID', 'Can open & KYC Policy', 'Status', 'Last login', ''], body)
    + `<p class="note">An ERP login sees only ERP, an HRMS login only HRMS, and so on. Only the owner/co-founder login sees every module, this page and the overview. Passwords are stored scrambled and cannot be read back: if someone forgets theirs, use Reset password.</p>`;
};
ACT['user-new'] = () => openForm({
  title: 'Add login', sub: 'Give one to each person or team.', submit: 'Create login',
  fields: [
    { name: 'name', label: 'Name', required: true, placeholder: 'Person or team name' },
    { name: 'loginId', label: 'Login ID', required: true, placeholder: 'small letters, no spaces', autocomplete: 'off', maxlength: 30 },
    { name: 'password', label: 'Password', type: 'password', required: true, full: true, hint: 'At least 8 characters. Tell it to them in person.', autocomplete: 'new-password', maxlength: 200 },
    { name: 'modules', label: 'Can open', type: 'checks', options: moduleChecks() }
  ],
  onSubmit: v => api('POST', '/api/users', v).then(refresh).then(() => toast('Login created'))
});
ACT['user-edit'] = el => {
  const u = S.users.find(x => x.id === el.dataset.id); if (!u) return;
  openForm({
    title: 'Edit access', sub: `Login ID: ${u.loginId}`,
    fields: [
      { name: 'name', label: 'Name', required: true },
      { name: 'active', label: 'Status', type: 'select', options: [{ value: 'on', label: 'On: can log in' }, { value: 'off', label: 'Turned off: cannot log in' }] },
      { name: 'modules', label: 'Can open', type: 'checks', options: moduleChecks() }
    ],
    values: { name: u.name, active: u.active ? 'on' : 'off', modules: u.modules },
    onSubmit: v => api('PUT', '/api/users/' + encodeURIComponent(u.id), { name: v.name, active: v.active === 'on', modules: v.modules }).then(refresh).then(() => toast('Access updated'))
  });
};
ACT['user-pass'] = el => {
  const u = S.users.find(x => x.id === el.dataset.id); if (!u) return;
  openForm({
    title: 'Reset password', sub: `For ${u.name} (${u.loginId}). They are logged out everywhere.`, submit: 'Set new password',
    fields: [{ name: 'password', label: 'New password', type: 'password', required: true, full: true, hint: 'At least 8 characters.', autocomplete: 'new-password', maxlength: 200 }],
    onSubmit: v => api('PUT', '/api/users/' + encodeURIComponent(u.id), { password: v.password }).then(() => toast('Password changed'))
  });
};
ACT['user-del'] = async el => {
  const u = S.users.find(x => x.id === el.dataset.id); if (!u) return;
  if (await confirmBox('Delete login?', `${u.name} (${u.loginId}) will no longer be able to log in. Records they entered stay.`)) save(() => api('DELETE', '/api/users/' + encodeURIComponent(u.id)).then(refresh), 'Login deleted');
};
ACT['edit-company'] = () => openForm({
  title: 'Company name', sub: 'Shown in the sidebar and on invoices.',
  fields: [{ name: 'name', label: 'Company name', required: true, full: true }],
  values: { name: S.company.name },
  onSubmit: v => api('PUT', '/api/company', v).then(refresh).then(() => toast('Company name changed'))
});
ACT['clear-sample'] = async () => {
  if (!await confirmBox('Remove sample data?', `This deletes the ${S.sampleCount} example records. Anything you added or edited stays. Logins are not touched.`, 'Remove sample data')) return;
  save(() => api('POST', '/api/sample/clear').then(refresh), 'Sample data removed. The books are now yours.');
};

/* ================= everyone: password and log out ================= */
ACT['my-password'] = () => openForm({
  title: 'Change your password', submit: 'Change password',
  fields: [
    { name: 'current', label: 'Current password', type: 'password', required: true, full: true, autocomplete: 'current-password', maxlength: 200 },
    { name: 'next', label: 'New password', type: 'password', required: true, full: true, hint: 'At least 8 characters.', autocomplete: 'new-password', maxlength: 200 }
  ],
  onSubmit: v => api('POST', '/api/password', v).then(() => toast('Password changed'))
});
ACT.logout = async () => {
  try { await api('POST', '/api/logout'); } catch (e) { /* log out on this side anyway */ }
  S.status = 'login'; S.user = null; closeDlg(); location.hash = ''; render();
};

/* ================= sign in, KYC policy gate, and first-time setup ================= */
CHG['kyc-policy-check'] = el => {
  S.ui.kycPolicyAccepted = !!el.checked;
  render();
};
ACT['kyc-policy-unlock'] = async el => {
  if (!S.ui.kycPolicyAccepted) {
    return toast('Please tick the Policy Agreement checkbox first.', 'warn');
  }
  el.disabled = true;
  const oldTxt = el.textContent;
  el.textContent = '⏳ Verifying Policy & Unlocking Access...';
  try {
    const res = await api('POST', '/api/auth/complete-kyc-policy', { acceptedPolicy: true });
    toast(res.message || '🎉 KYC Verified! Full Co-Founder Portal Access Unlocked!', 'good');
    S.ui.kycPolicyAccepted = false;
    await loadData();
    S.status = S.kycGateRequired ? 'kyc-gate' : 'ready';
    render();
  } catch (err) {
    toast(err.message || 'Could not complete KYC verification.', 'bad');
    el.disabled = false;
    el.textContent = oldTxt;
  }
};

function renderAuth() {
  const el = $('#auth');
  // For kyc-gate, always re-render live so OCR loading spinners and verified statuses update immediately
  if (S.status !== 'kyc-gate' && el.dataset.screen === S.status) return;
  el.dataset.screen = S.status;

  if (S.status === 'kyc-gate') {
    const u = S.user || {};
    const emp = (S.employees || []).find(e => e.id === u.empId) || (S.employees || [])[0] || { id: u.empId || '', name: u.name || '' };
    const files = (S.files || []).filter(f => f.employeeId === emp.id);
    const aadhaarFile = files.find(f => /aadhaar|adhar/i.test(f.kind || ''));
    const panFile = files.find(f => /pan/i.test(f.kind || ''));
    const upAadhaar = typeof getKycUploadState === 'function' ? getKycUploadState(emp.id, 'Aadhaar Card') : null;
    const upPan = typeof getKycUploadState === 'function' ? getKycUploadState(emp.id, 'PAN Card') : null;
    const bothUploaded = !!(aadhaarFile && panFile);
    const agreed = !!S.ui.kycPolicyAccepted;
    const canUnlock = bothUploaded && agreed && !upAadhaar && !upPan;
    const doneSteps = (aadhaarFile ? 1 : 0) + (panFile ? 1 : 0) + (agreed ? 1 : 0);

    el.innerHTML = `
      <div class="auth-card kyc-gate-card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:2px solid var(--rule);padding-bottom:14px;margin-bottom:16px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:12px">
            <img src="/logo-dark.png" alt="RvmAiTech" style="height:36px;width:auto;display:block">
            <div>
              <div class="eyebrow" style="margin:0;color:#f59e0b">🔒 MANDATORY IDENTITY &amp; ACCESS POLICY</div>
              <h1 style="margin:2px 0 0;font-size:20px">${esc(S.company.name || 'RvmAiTech')} — Executive KYC Verification</h1>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span class="stamp stamp-info">${esc(u.title || (u.role === 'owner' ? 'Co-Founder / Executive' : 'Staff'))}</span>
            <button type="button" class="btn btn-sm" data-action="my-password">🔑 Change Password</button>
            <button type="button" class="btn btn-sm btn-outline" data-action="logout">Log Out</button>
          </div>
        </div>

        <div style="background:rgba(245,158,11,0.10);border:1.5px solid rgba(245,158,11,0.35);border-radius:10px;padding:12px 14px;margin-bottom:16px">
          <div style="font-weight:800;font-size:14px;color:var(--ink)">Welcome, ${esc(u.name || 'Executive')}${u.title ? ` (${esc(u.title)})` : ''}!</div>
          <p style="margin:5px 0 0;font-size:12.5px;color:var(--ink-2);line-height:1.5">
            <b>Company Security Policy:</b> Portal ka poora access (<b>ERP, CRM, HRMS, Finance, Projects &amp; Admin</b>) unlock karne se pehle aapko apna <b>asli Aadhaar Card</b> aur <b>PAN Card</b> upload karke OCR verify karwana anivarya (mandatory) hai. Fake document, face photo ya kisi aur vyakti ka ID automatically reject ho jayega.
          </p>
          <div style="display:flex;align-items:center;gap:10px;margin-top:10px">
            <div class="proc-bar-track" style="flex:1;height:7px"><div class="proc-bar-fill" style="width:${Math.round((doneSteps / 3) * 100)}%"></div></div>
            <b style="font-size:11.5px;color:${canUnlock ? '#10b981' : '#38bdf8'}">${doneSteps} / 3 Steps Ready</b>
          </div>
        </div>

        <!-- Mandatory Document Upload Grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:12px;margin-bottom:16px">
          <!-- Step 1: Original Aadhaar Card -->
          <div style="background:var(--paper);border:1.5px solid ${upAadhaar ? '#38bdf8' : aadhaarFile ? '#10b981' : '#f59e0b'};border-radius:10px;padding:14px;display:flex;flex-direction:column;justify-content:space-between;gap:10px">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
                <b style="font-size:14px;color:var(--ink)">1. 🪪 Original Aadhaar Card</b>
                ${upAadhaar
                  ? `<span class="stamp stamp-info" style="font-size:10.5px">⏳ Scanning OCR...</span>`
                  : aadhaarFile
                    ? `<span class="stamp stamp-good" style="font-size:10.5px">Verified ✓</span>`
                    : `<span class="stamp stamp-warn" style="font-size:10.5px">Required ⚠️</span>`}
              </div>
              <div style="font-size:12px;color:var(--ink-2);margin-top:6px">UID Number: <b style="color:var(--ink)">${esc(emp.aadhaarNumber || 'Upload Aadhaar to auto-verify')}</b></div>
              <div style="font-size:11.5px;color:#38bdf8;margin-top:6px;background:rgba(56,189,248,0.08);padding:7px 9px;border-radius:6px;border:1px dashed rgba(56,189,248,0.35)">
                <b>📍 Permanent Address (OCR Auto-Extracted):</b><br>${esc(emp.permAddress || 'Aadhaar upload karte hi address automatically verify hoga')}
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${upAadhaar
                ? renderOcrLoadingBox(upAadhaar)
                : `${aadhaarFile ? `<a class="btn btn-sm" href="/api/files/${esc(aadhaarFile.id)}" target="_blank" rel="noopener">👁️ View</a>` : ''}
                   <label class="btn btn-sm btn-primary" for="gate-aadhaar-${esc(emp.id)}" style="cursor:pointer;flex:1;text-align:center">${aadhaarFile ? 'Re-upload Aadhaar' : '📤 Upload Original Aadhaar'}</label>
                   <input type="file" id="gate-aadhaar-${esc(emp.id)}" data-change="kyc-quick-upload" data-id="${esc(emp.id)}" data-kind="Aadhaar Card" accept="image/jpeg,image/png,image/webp,application/pdf" hidden>`}
            </div>
          </div>

          <!-- Step 2: Original PAN Card -->
          <div style="background:var(--paper);border:1.5px solid ${upPan ? '#38bdf8' : panFile ? '#10b981' : '#f59e0b'};border-radius:10px;padding:14px;display:flex;flex-direction:column;justify-content:space-between;gap:10px">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
                <b style="font-size:14px;color:var(--ink)">2. 💳 Original PAN Card</b>
                ${upPan
                  ? `<span class="stamp stamp-info" style="font-size:10.5px">⏳ Scanning OCR...</span>`
                  : panFile
                    ? `<span class="stamp stamp-good" style="font-size:10.5px">Verified ✓</span>`
                    : `<span class="stamp stamp-warn" style="font-size:10.5px">Required ⚠️</span>`}
              </div>
              <div style="font-size:12px;color:var(--ink-2);margin-top:6px">PAN Number: <b style="color:var(--ink)">${esc(emp.panNumber || 'Upload PAN to auto-verify')}</b></div>
              <div style="font-size:11.5px;color:var(--ink-2);margin-top:6px;background:rgba(148,163,184,0.08);padding:7px 9px;border-radius:6px;border:1px solid var(--rule)">
                <b>👤 Father's / Guardian Name:</b> ${esc(emp.parentsName || 'Will auto-extract from PAN/Aadhaar')}<br>
                <b>🎂 Date of Birth:</b> ${emp.dob ? fmtDate(emp.dob) : 'Will auto-extract from document'}
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${upPan
                ? renderOcrLoadingBox(upPan)
                : `${panFile ? `<a class="btn btn-sm" href="/api/files/${esc(panFile.id)}" target="_blank" rel="noopener">👁️ View</a>` : ''}
                   <label class="btn btn-sm btn-primary" for="gate-pan-${esc(emp.id)}" style="cursor:pointer;flex:1;text-align:center">${panFile ? 'Re-upload PAN' : '📤 Upload Original PAN'}</label>
                   <input type="file" id="gate-pan-${esc(emp.id)}" data-change="kyc-quick-upload" data-id="${esc(emp.id)}" data-kind="PAN Card" accept="image/jpeg,image/png,image/webp,application/pdf" hidden>`}
            </div>
          </div>
        </div>

        <!-- Step 3: Policy Terms & Consent -->
        <div style="background:rgba(148,163,184,0.07);border:1px solid var(--rule);border-radius:10px;padding:12px 14px;margin-bottom:16px">
          <div style="font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;color:#38bdf8;margin-bottom:6px">📜 3. RvmAiTech Mandatory Executive KYC &amp; Access Policy</div>
          <ul style="margin:0 0 10px;padding-left:18px;font-size:12px;color:var(--ink-2);line-height:1.55">
            <li>Only genuine, original government-issued <b>Aadhaar Card</b> and <b>PAN Card</b> belonging to <b>${esc(u.name || 'the account holder')}</b> are permitted.</li>
            <li>Automated OCR strictly verifies identity &amp; authenticity — uploaded documents are archived in RvmAiTech's official statutory &amp; governance register.</li>
            <li>Full access to ERP, CRM, HRMS, Finance, Projects, and Admin modules unlocks strictly after successful verification and policy acceptance.</li>
          </ul>
          <label class="proc-chk" style="padding:8px 10px;border-radius:8px;background:var(--paper);border:1px solid ${agreed ? '#10b981' : 'var(--rule)'}">
            <input type="checkbox" id="kycPolicyAgree" data-change="kyc-policy-check" ${agreed ? 'checked' : ''}>
            <span style="font-size:12.5px;font-weight:600;color:var(--ink)">I confirm that the uploaded Aadhaar Card &amp; PAN Card are my authentic original documents and I agree to RvmAiTech's Mandatory Executive KYC &amp; Governance Policy.</span>
          </label>
        </div>

        <button type="button" class="btn btn-primary" data-action="kyc-policy-unlock" ${canUnlock ? '' : 'disabled'} style="width:100%;padding:12px 16px;font-size:14px;font-weight:800;${canUnlock ? 'background:#059669;border-color:#059669;' : 'opacity:0.55;cursor:not-allowed;'}">
          ${canUnlock
            ? '🔓 Accept Policy &amp; Unlock Full Co-Founder Portal Access'
            : !bothUploaded
              ? '🔒 Upload &amp; Verify Both Original Aadhaar Card &amp; PAN Card First'
              : '🔒 Tick the Policy Agreement Checkbox Above to Unlock'}
        </button>
      </div>`;
    return;
  }

  if (S.status === 'setup') {
    el.innerHTML = `<form class="auth-card wide" id="setupForm"><div class="eyebrow">FIRST-TIME SETUP</div><h1>Create the owner account</h1><p>The owner login sees every module. You will make separate logins for ERP, CRM, HRMS and Finance, each of which opens only its own module.</p>
      <div class="fields">
        ${fieldHtml({ name: 'company', label: 'Company name', required: true, full: true })}
        ${fieldHtml({ name: 'name', label: 'Your name', required: true })}
        ${fieldHtml({ name: 'loginId', label: 'Owner login ID', required: true, value: 'owner', autocomplete: 'username', maxlength: 30 })}
        ${fieldHtml({ name: 'password', label: 'Owner password', type: 'password', required: true, full: true, hint: 'At least 8 characters. There is no "forgot password" for the owner, so keep it safe.', autocomplete: 'new-password', maxlength: 200 })}
        ${S.needCode ? fieldHtml({ name: 'code', label: 'Setup code', required: true, full: true, hint: 'The 6-digit code printed in the window where the server was started.', autocomplete: 'off' }) : ''}
      </div>
      <label class="check"><input type="checkbox" id="f-teamLogins" name="teamLogins" checked><span>Create the four team logins now<small>Login IDs erp, crm, hrms and finance, each with its own password shown on the next screen.</small></span></label>
      <label class="check"><input type="checkbox" id="f-sample" name="sample" checked><span>Load sample data<small>Example products, customers, staff, projects and invoices, so every screen has something to show. One click removes them later.</small></span></label>
      <div class="form-err" role="alert"></div><button type="submit" class="btn btn-primary">Create account and open the dashboard</button></form>`;
    const form = $('#setupForm');
    form.addEventListener('submit', ev => {
      ev.preventDefault();
      runSubmit(form, async () => {
        const fd = new FormData(form);
        const r = await api('POST', '/api/setup', { company: String(fd.get('company') || '').trim(), name: String(fd.get('name') || '').trim(), loginId: String(fd.get('loginId') || '').trim(), password: String(fd.get('password') || ''), code: String(fd.get('code') || '').trim(), teamLogins: fd.get('teamLogins') === 'on', sample: fd.get('sample') === 'on' });
        await loadData();
        S.creds = r.logins || [];
        S.status = S.creds.length ? 'creds' : 'ready';
        render();
      }, true);
    });
  } else if (S.status === 'creds') {
    el.innerHTML = `<div class="auth-card wide"><div class="eyebrow">WRITE THESE DOWN NOW</div><h1>Team logins created</h1><p>These passwords are shown only this once. Give each team its own login. You can reset any of them later under Admin › Logins and access.</p>
      <table class="creds"><thead><tr><th>For</th><th>Login ID</th><th>Password</th><th>Opens</th></tr></thead><tbody>${S.creds.map(c => `<tr><td>${esc(c.name)}</td><td><code>${esc(c.loginId)}</code></td><td><code>${esc(c.password)}</code></td><td>${esc(MODULE_NAMES[c.loginId] || '')} only</td></tr>`).join('')}</tbody></table>
      <div class="vactions"><button class="btn" id="credsSave">Download as a text file</button><button class="btn btn-primary" id="credsDone">I have noted them. Open the dashboard</button></div></div>`;
    $('#credsSave').addEventListener('click', () => downloadText('team-logins.txt', `Team logins for ${S.company.name}\r\nAddress: ${location.origin}\r\n\r\n` + S.creds.map(c => `${c.name}\r\n  Login ID: ${c.loginId}\r\n  Password: ${c.password}\r\n`).join('\r\n') + '\r\nKeep this file private. Delete it after handing the passwords over.\r\n'));
    $('#credsDone').addEventListener('click', () => { S.creds = []; S.status = 'ready'; render(); });
  } else {
    el.innerHTML = `<form class="auth-card" id="loginForm">
      <div style="text-align:center;margin-bottom:18px">
        <img src="/logo-dark.png" alt="RvmAiTech" style="height:44px;width:auto;display:inline-block">
      </div>
      <div class="eyebrow" style="text-align:center">${esc(S.company.name || 'RvmAiTech')}</div>
      <h1 style="text-align:center;margin-top:2px">Sign in to Portal</h1>
      <p style="text-align:center">Employee Self-Service, HRMS, CRM, ERP & Management Suite</p>
      <div class="fields" style="grid-template-columns:minmax(0,1fr)">
        ${fieldHtml({ name: 'loginId', label: 'Login ID', required: true, autocomplete: 'username', maxlength: 60 })}
        ${fieldHtml({ name: 'password', label: 'Password', type: 'password', required: true, autocomplete: 'current-password', maxlength: 200 })}
      </div><div class="form-err" role="alert"></div><button type="submit" class="btn btn-primary" style="width:100%;padding:10px 0;font-size:14px">Sign in</button></form>`;
    const form = $('#loginForm');
    form.addEventListener('submit', ev => {
      ev.preventDefault();
      runSubmit(form, async () => {
        const fd = new FormData(form);
        await api('POST', '/api/login', { loginId: String(fd.get('loginId') || '').trim(), password: String(fd.get('password') || '') });
        await loadData();
        S.status = S.kycGateRequired ? 'kyc-gate' : 'ready';
        render();
      }, true);
    });
    const first = $('#f-loginId'); if (first) first.focus();
  }
}

/* ================= start ================= */
async function boot() {
  try {
    const st = await api('GET', '/api/state');
    S.company = { name: st.company || '' }; S.needCode = !!st.needCode;
    if (st.setup) S.status = 'setup';
    else if (st.user) { await loadData(); S.status = S.kycGateRequired ? 'kyc-gate' : 'ready'; }
    else S.status = 'login';
  } catch (e) {
    $('#auth').hidden = false;
    $('#auth').innerHTML = `<div class="auth-card"><h1>Cannot reach the server</h1><p>${esc(e.message || 'Check that the server window is still open, then reload this page.')}</p></div>`;
    return;
  }
  render();
}
/* Pick up other people's changes: when you come back to the tab, and every 45 seconds while it is open. */
async function quietRefresh() {
  if (S.status !== 'ready' || dlg.open || document.visibilityState !== 'visible') return;
  const ae = document.activeElement;
  if (ae && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName) && ae.type !== 'search') return;
  try { await loadData(); scheduleRender(); } catch (e) { /* shown on the next action */ }
}
window.addEventListener('focus', quietRefresh);
setInterval(quietRefresh, 45000);
boot();
