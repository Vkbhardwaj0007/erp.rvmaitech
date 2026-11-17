'use strict';
/* ================= DAILY WORK REPORT & PROJECT MANAGEMENT HUB ================= */

/* Helper to calculate deadline status */
function deadlineInfo(targetDate, status) {
  if (status === 'Completed') return { text: 'Completed', cls: 'good' };
  if (!targetDate) return { text: 'No deadline set', cls: 'mute' };
  const diff = dayDiff(today(), targetDate);
  if (diff < 0) return { text: `Overdue by ${Math.abs(diff)} days!`, cls: 'late', diff };
  if (diff === 0) return { text: 'Due Today!', cls: 'warn', diff: 0 };
  if (diff === 1) return { text: 'Due Tomorrow', cls: 'warn', diff: 1 };
  return { text: `${diff} days remaining`, cls: diff <= 5 ? 'warn' : 'good', diff };
}

/* ================= 1. Daily Work Reports ================= */
V['daily-work-reports'] = D => {
  const allLogs = (S.worklogs || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const fEmp = S.ui.filter.reportEmp || '';
  const fProj = S.ui.filter.reportProj || '';
  const fDate = S.ui.filter.reportDate || '';

  let rows = allLogs;
  if (fEmp) rows = rows.filter(w => w.empId === fEmp);
  if (fProj) rows = rows.filter(w => w.projectId === fProj);
  if (fDate) rows = rows.filter(w => w.date === fDate);

  const t = today();
  const todayLogs = allLogs.filter(w => w.date === t);
  const runningProjects = S.projects.filter(p => p.status === 'Running');
  const pendingTasks = (S.tasks || []).filter(t => t.status !== 'Completed');
  const openBlockers = allLogs.filter(w => w.blockers && w.date >= addDays(t, -7));

  const cardsHtml = rows.map(w => {
    const e = D.emp.get(w.empId) || { name: 'Unknown', role: '', code: '' };
    const p = w.projectId ? D.proj.get(w.projectId) : null;
    return `
      <div class="worklog-card">
        <div class="worklog-card-head">
          <div class="person" style="gap:10px">
            ${avatar(e)}
            <div>
              <div class="worklog-who">${esc(e.name)} <span class="sub" style="display:inline">(${esc(e.code)})</span></div>
              <div class="worklog-sub">${esc([e.role, e.dept].filter(Boolean).join(' · '))} · <b>${fmtDate(w.date)}</b></div>
            </div>
          </div>
          ${p ? `<span class="stamp stamp-info" title="Site: ${esc(p.location || '')}">${esc(p.name)}</span>` : '<span class="stamp stamp-mute">General Tasks</span>'}
        </div>
        <div class="worklog-section">
          <div class="worklog-section-title">Kal kya kaam kiya tha (Accomplished)</div>
          <p>${esc(w.yesterdayWork)}</p>
        </div>
        <div class="worklog-section">
          <div class="worklog-section-title">Aaj kya kaam hai (Today's Plan)</div>
          <p>${esc(w.todayWork)}</p>
        </div>
        ${w.blockers ? `<div class="worklog-blocker"><b>Blocker / Issue:</b> ${esc(w.blockers)}</div>` : ''}
      </div>`;
  }).join('');

  const tiles = `
    <div class="tiles">
      ${tile("Today's Reports", `${todayLogs.length} submitted`, `out of ${activeEmps().length} active staff`, '#daily-work-reports')}
      ${tile('Running Projects', String(runningProjects.length), `${S.projects.length} total projects`, '#project-manager')}
      ${tile('Pending Tasks', String(pendingTasks.length), 'assigned across team', '#task-allocation')}
      ${tile('Open Blockers (7d)', String(openBlockers.length), openBlockers.length ? 'Attention required' : 'All clear', '#daily-work-reports')}
    </div>`;

  return head('DAILY WORK REPORT', 'Daily Work Reports', `Track "Kal kya kiya, aaj kya karenge" updates from all employees. Total <b>${allLogs.length}</b> reports logged`,
      `<button class="btn" data-action="work-assign-new">Assign Work to Staff</button>
       <a class="btn btn-primary" href="#project-manager">Project Hub & Deadlines</a>
       <button class="btn" data-action="worklog-export">Export CSV</button>`)
    + tiles
    + `<div class="toolbar">
        <select id="flt-reportEmp" data-change="filter" data-key="reportEmp" aria-label="Filter by employee">
          <option value="">All Employees (${S.employees.length})</option>
          ${S.employees.map(e => `<option value="${esc(e.id)}"${e.id === fEmp ? ' selected' : ''}>${esc(e.name)} (${esc(e.code)})</option>`).join('')}
        </select>
        <select id="flt-reportProj" data-change="filter" data-key="reportProj" aria-label="Filter by project">
          <option value="">All Projects (${S.projects.length})</option>
          ${S.projects.map(p => `<option value="${esc(p.id)}"${p.id === fProj ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}
        </select>
        <input type="date" id="flt-reportDate" data-change="filter" data-key="reportDate" value="${esc(fDate)}" max="${today()}" placeholder="Filter date">
      </div>`
    + (allLogs.length === 0 ? empty('No daily work reports yet', 'Employees can submit their yesterday and today work updates from their Employee Self-Service portal.')
      : rows.length === 0 ? empty('Nothing matches', 'No reports found for the selected filters.')
      : `<div class="worklog-grid">${cardsHtml}</div>`);
};

/* ================= 2. Task Assignment & Department Planner ================= */
function openDeptPlannerModal(presetDept, presetEmpId) {
  const emps = activeEmps();
  if (!emps.length) return toast('Add active employees under HRMS first.', 'warn');
  const depts = [...new Set(emps.map(e => e.dept || 'General Operations'))].sort();
  const curDept = presetDept || depts[0] || 'General Operations';

  dlg.className = 'dlg dlg-wide';
  dlg.innerHTML = `
    <form class="form" id="deptPlanForm">
      <h2 class="dlg-title">⚡ Daily Department Task Planner</h2>
      <p class="dlg-sub">Department select karein aur aaj ka kaam sabhi staff ko ek saath ya individual assign karein.</p>

      <div class="fields">
        <div class="field">
          <label for="dp-dept">Select Department</label>
          <select id="dp-dept" name="dept">
            ${depts.map(d => `<option value="${esc(d)}"${d === curDept ? ' selected' : ''}>${esc(d)} (${emps.filter(e => (e.dept || 'General Operations') === d).length} staff)</option>`).join('')}
          </select>
        </div>

        <div class="field">
          <label for="dp-proj">Project (Optional)</label>
          <select id="dp-proj" name="projectId">
            <option value="">General Work / No specific project</option>
            ${S.projects.map(p => `<option value="${esc(p.id)}">${esc(p.name)} (${esc(p.location || 'Site')})</option>`).join('')}
          </select>
        </div>

        <div class="field field-full">
          <label>Assign To Employees in this Department</label>
          <div id="dp-emp-list" class="checks" style="max-height:160px;overflow-y:auto;border:1px solid var(--rule);padding:8px;border-radius:6px"></div>
        </div>

        <div class="field field-full">
          <label for="dp-title">Aaj kya kaam karna hai? (Action Item / Task) <span style="color:var(--bad)">*</span></label>
          <input id="dp-title" name="title" required placeholder="e.g. Inspect parking sensor slots, verify RFID entry gate & sync daily logs">
        </div>

        <div class="field">
          <label for="dp-due">Deadline / Due Date</label>
          <input id="dp-due" name="dueDate" type="date" value="${today()}" required>
        </div>

        <div class="field">
          <label for="dp-prio">Priority</label>
          <select id="dp-prio" name="priority">
            <option value="High">High Priority</option>
            <option value="Medium" selected>Medium Priority</option>
            <option value="Low">Low Priority</option>
          </select>
        </div>

        <div class="field field-full">
          <label for="dp-desc">Task Instructions / Details (Optional)</label>
          <textarea id="dp-desc" name="desc" rows="2" placeholder="Specific guidelines, targets, or site notes for today..."></textarea>
        </div>
      </div>

      <div class="dlg-actions">
        <button type="button" class="btn" data-x="cancel">Cancel</button>
        <button type="submit" class="btn btn-primary" id="btnSubmitDeptTasks">Assign Today's Work</button>
      </div>
    </form>`;

  const deptSel = $('#dp-dept', dlg);
  const empListBox = $('#dp-emp-list', dlg);

  function renderEmpCheckboxes(dept) {
    const list = emps.filter(e => (e.dept || 'General Operations') === dept);
    empListBox.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;width:100%">
        <span style="font-size:12px;font-weight:700">Staff Members (${list.length}):</span>
        <button type="button" class="link-btn" id="btnCheckAll" style="font-size:11.5px">Select All</button>
      </div>
      ${list.map(e => `
        <label class="check" style="margin-bottom:4px">
          <input type="checkbox" name="empIds" value="${esc(e.id)}"${(!presetEmpId || e.id === presetEmpId) ? ' checked' : ''}>
          <span><b>${esc(e.name)}</b> <span class="sub" style="display:inline">(${esc(e.role || 'Staff')} · ${esc(e.code)})</span></span>
        </label>
      `).join('')}`;

    const checkAllBtn = $('#btnCheckAll', dlg);
    if (checkAllBtn) {
      checkAllBtn.addEventListener('click', () => {
        const cbs = empListBox.querySelectorAll('input[type="checkbox"]');
        const allOn = Array.from(cbs).every(c => c.checked);
        cbs.forEach(c => c.checked = !allOn);
        checkAllBtn.textContent = allOn ? 'Select All' : 'Deselect All';
      });
    }
  }

  deptSel.addEventListener('change', () => renderEmpCheckboxes(deptSel.value));
  renderEmpCheckboxes(curDept);

  $('#deptPlanForm', dlg).addEventListener('submit', async ev => {
    ev.preventDefault();
    const form = ev.target;
    const fd = new FormData(form);
    const chosenEmpIds = fd.getAll('empIds').map(String);
    if (!chosenEmpIds.length) return toast('Please select at least one employee to assign.', 'warn');

    const title = String(fd.get('title') || '').trim();
    if (!title) return toast('Please enter a task title.', 'warn');
    const dept = String(fd.get('dept') || '');
    const projectId = String(fd.get('projectId') || '');
    const dueDate = String(fd.get('dueDate') || today());
    const priority = String(fd.get('priority') || 'Medium');
    const desc = String(fd.get('desc') || '').trim();
    const assignedBy = S.user ? S.user.name : 'Project Manager';

    const submitBtn = $('#btnSubmitDeptTasks', dlg);
    submitBtn.disabled = true; submitBtn.textContent = 'Assigning...';

    try {
      for (const empId of chosenEmpIds) {
        await dbAdd('tasks', {
          title,
          dept,
          projectId,
          empId,
          dueDate,
          priority,
          status: 'To Do',
          assignedBy,
          desc
        });
      }
      closeDlg();
      toast(`Today's work assigned to ${chosenEmpIds.length} staff in ${dept}!`, 'good');
    } catch (e) {
      toast(e.message || 'Could not assign tasks.', 'bad');
      submitBtn.disabled = false; submitBtn.textContent = "Assign Today's Work";
    }
  });

  dlg.showModal();
}

V['task-allocation'] = D => {
  const allTasks = S.tasks || [];
  const q = query('task-allocation');
  const fProj = S.ui.filter.taskProj || '';
  const fEmp = S.ui.filter.taskEmp || '';
  const fStatus = S.ui.filter.taskStatus || '';
  const fDept = S.ui.filter.taskDept || '';
  const tab = S.ui.taskTab || 'board';

  const t = today();
  const todoCount = allTasks.filter(k => k.status === 'To Do').length;
  const inProgCount = allTasks.filter(k => k.status === 'In Progress').length;
  const compCount = allTasks.filter(k => k.status === 'Completed').length;
  const overdueCount = allTasks.filter(k => k.status !== 'Completed' && k.dueDate && k.dueDate < t).length;

  const emps = activeEmps();
  const depts = [...new Set(emps.map(e => e.dept || 'General Operations'))].sort();

  const DEPT_META = {
    'Administration Department': { icon: '🏢', color: '#f59e0b', bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.35)', desc: 'Office facilities, legal compliance, procurement & administration' },
    'Executive Leadership': { icon: '👑', color: '#ec4899', bg: 'rgba(236,72,153,0.14)', border: 'rgba(236,72,153,0.35)', desc: 'Strategic direction, executive governance, founders & board' },
    'Finance & Accounts Department': { icon: '💰', color: '#10b981', bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.35)', desc: 'Financial planning, accounting, vendor bills, payroll & compliance' },
    'Human Resources Department': { icon: '👥', color: '#8b5cf6', bg: 'rgba(139,92,246,0.14)', border: 'rgba(139,92,246,0.35)', desc: 'Talent hiring, HR operations, employee onboarding & records' },
    'Operations Department': { icon: '⚙️', color: '#06b6d4', bg: 'rgba(6,182,212,0.14)', border: 'rgba(6,182,212,0.35)', desc: 'On-site execution, equipment deployment, field operations & maintenance' },
    'Sales & Marketing Department': { icon: '📈', color: '#3b82f6', bg: 'rgba(59,130,246,0.14)', border: 'rgba(59,130,246,0.35)', desc: 'Client acquisition, pitches, CRM management & corporate revenue' },
    'Technology Department': { icon: '💻', color: '#6366f1', bg: 'rgba(99,102,241,0.14)', border: 'rgba(99,102,241,0.35)', desc: 'ANPR software, IoT hardware, AI algorithms & cloud engineering' }
  };

  const renderEmpCard = (e, dept) => {
    const todayEmpTasks = allTasks.filter(k => k.empId === e.id && (k.dueDate === t || (k.dueDate < t && k.status !== 'Completed')));
    return `
      <div class="dept-emp-card">
        <div class="dept-emp-top">
          <div class="person" style="gap:10px">
            ${avatar(e, 'sm')}
            <div>
              <b style="color:var(--ink);font-size:14px">${esc(e.name)}</b>
              <span class="sub" style="color:var(--ink-2);font-size:11.5px">${esc(e.code)} · ${esc(e.role || 'Staff')}</span>
            </div>
          </div>
          <button class="link-btn" data-action="quick-task-add" data-emp="${esc(e.id)}" data-dept="${esc(dept)}" title="Assign today's task to ${esc(e.name)}">+ Assign Work</button>
        </div>
        ${todayEmpTasks.length ? todayEmpTasks.map(k => `
          <div class="dept-task-mini">
            <div style="flex:1">
              <b>${esc(k.title)}</b>
              <div style="font-size:11px;color:var(--ink-2);margin-top:3px">
                ${k.projectId ? `<span class="stamp stamp-info" style="font-size:10px;max-width:160px;overflow:hidden;text-overflow:ellipsis" title="${esc((D.proj.get(k.projectId) || {}).name || 'Project')}">${esc((D.proj.get(k.projectId) || {}).name || 'Project')}</span> · ` : ''}
                <span class="task-badge task-prio-${esc(k.priority || 'Medium')}" style="font-size:10px">${esc(k.priority || 'Medium')}</span>
                ${k.dueDate < t ? `<span class="stamp stamp-bad" style="font-size:10px">Overdue</span>` : ''}
              </div>
            </div>
            <select class="task-status-sel" data-change="task-status-change" data-id="${esc(k.id)}" style="font-size:11px;padding:3px 6px">
              ${['To Do', 'In Progress', 'Completed'].map(st => `<option value="${st}"${k.status === st ? ' selected' : ''}>${st}</option>`).join('')}
            </select>
          </div>
        `).join('') : '<div class="muted" style="font-size:12px;font-style:italic;padding:4px 0">No task assigned for today yet.</div>'}
      </div>`;
  };

  // 1. Department Overview Cards (Clean, modern individual cards)
  const deptCardsHtml = depts.map(dept => {
    const meta = DEPT_META[dept] || { icon: '📂', color: '#38bdf8', bg: 'rgba(56,189,248,0.14)', border: 'rgba(56,189,248,0.35)', desc: 'Department team and work operations' };
    const deptEmps = emps.filter(e => (e.dept || 'General Operations') === dept);
    const empIds = new Set(deptEmps.map(e => e.id));
    const deptTasks = allTasks.filter(k => empIds.has(k.empId) || k.dept === dept);
    const todayTasks = deptTasks.filter(k => k.dueDate === t || (k.dueDate < t && k.status !== 'Completed'));
    const activeTasks = todayTasks.filter(k => k.status !== 'Completed');
    const doneTasks = todayTasks.filter(k => k.status === 'Completed');
    const overdueTasks = todayTasks.filter(k => k.status !== 'Completed' && k.dueDate < t);

    const previewEmps = deptEmps.slice(0, 4);
    const remainingCount = deptEmps.length - previewEmps.length;

    const avatarsHtml = previewEmps.map(e => `
      <div title="${esc(e.name)} (${esc(e.role || 'Staff')})" style="display:inline-block;margin-right:-8px;border:2px solid var(--paper);border-radius:50%">
        ${avatar(e, 'sm')}
      </div>
    `).join('') + (remainingCount > 0 ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.12);color:var(--ink);font-size:11px;font-weight:700;border:2px solid var(--paper);margin-left:8px">+${remainingCount}</span>` : '');

    return `
      <div class="dept-overview-card" data-action="dept-open" data-dept="${esc(dept)}" style="border-top: 4px solid ${meta.color}; cursor: pointer">
        <div class="dept-card-header">
          <div style="display:flex;align-items:center;gap:12px">
            <div class="dept-card-icon" style="background:${meta.bg};border:1px solid ${meta.border}">
              <span style="font-size:22px">${meta.icon}</span>
            </div>
            <div>
              <h3 class="dept-card-title">${esc(dept)}</h3>
              <p class="dept-card-desc">${esc(meta.desc)}</p>
            </div>
          </div>
          <span class="stamp stamp-info" style="font-weight:800;font-size:12px;padding:4px 10px">${deptEmps.length} STAFF</span>
        </div>

        <div class="dept-card-stats">
          <div class="dept-card-stat-pill">
            <span class="sub">Total Staff</span>
            <b>${deptEmps.length}</b>
          </div>
          <div class="dept-card-stat-pill">
            <span class="sub">Active Tasks</span>
            <b style="color:${activeTasks.length ? '#38bdf8' : 'var(--ink-2)'}">${activeTasks.length}</b>
          </div>
          <div class="dept-card-stat-pill">
            <span class="sub">Done Today</span>
            <b style="color:${doneTasks.length ? '#4ade80' : 'var(--ink-2)'}">${doneTasks.length}</b>
          </div>
          <div class="dept-card-stat-pill">
            <span class="sub">Overdue</span>
            <b style="color:${overdueTasks.length ? '#f87171' : 'var(--ink-2)'}">${overdueTasks.length}</b>
          </div>
        </div>

        <div class="dept-card-footer">
          <div style="display:flex;align-items:center">
            ${avatarsHtml}
          </div>
          <div style="display:flex;gap:8px" onclick="event.stopPropagation()">
            <button class="btn btn-sm btn-outline" data-action="dept-quick-plan" data-dept="${esc(dept)}" title="Assign Tasks to ${esc(dept)}">⚡ Assign</button>
            <button class="btn btn-sm btn-primary" data-action="dept-open" data-dept="${esc(dept)}">📂 Open Department &raquo;</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 2. Opened Department View (Revealed when card is opened)
  const activeDept = S.ui.activeDept;
  let openedDeptHtml = '';
  if (activeDept) {
    const activeMeta = DEPT_META[activeDept] || { icon: '📂', color: '#38bdf8', bg: 'rgba(56,189,248,0.14)', border: 'rgba(56,189,248,0.35)', desc: 'Department team and work operations' };
    const activeDeptEmps = emps.filter(e => (e.dept || 'General Operations') === activeDept);
    const activeDeptEmpCardsHtml = activeDeptEmps.map(e => renderEmpCard(e, activeDept)).join('');

    openedDeptHtml = `
      <div class="dept-opened-view">
        <div class="dept-opened-banner" style="border-left:4px solid ${activeMeta.color}">
          <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
            <button class="btn btn-outline" data-action="dept-back" style="display:inline-flex;align-items:center;gap:6px;font-weight:700">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              &lsaquo; All Department Cards
            </button>
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:26px">${activeMeta.icon}</span>
              <div>
                <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--ink)">${esc(activeDept)}</h2>
                <span style="font-size:12px;color:var(--ink-2)">${esc(activeMeta.desc)} &middot; <b>${activeDeptEmps.length} Staff Members</b></span>
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <select class="dept-nav-dropdown" data-change="dept-switch" style="font-size:12px;padding:6px 10px;border-radius:6px">
              <option value="">Switch Department...</option>
              ${depts.map(d => `<option value="${esc(d)}"${d === activeDept ? ' selected' : ''}>${DEPT_META[d] ? DEPT_META[d].icon + ' ' : ''}${esc(d)} (${emps.filter(x => (x.dept || 'General Operations') === d).length} Staff)</option>`).join('')}
            </select>
            <button class="btn btn-primary" data-action="dept-quick-plan" data-dept="${esc(activeDept)}">⚡ Assign Department Work</button>
          </div>
        </div>

        ${activeDeptEmps.length === 0
          ? empty('No staff in ' + activeDept, 'Add employees with department set to ' + activeDept + ' under HRMS.')
          : `<div class="dept-emp-grid">${activeDeptEmpCardsHtml}</div>`}
      </div>
    `;
  }

  // 3. Side-by-Side Columns View (Optional toggle mode)
  const deptColumnsHtml = depts.map(dept => {
    const deptEmps = emps.filter(e => (e.dept || 'General Operations') === dept);
    const empCardsHtml = deptEmps.map(e => renderEmpCard(e, dept)).join('');
    return `
      <div class="dept-col">
        <div class="dept-col-hdr">
          <div class="dept-col-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 00-3-3.87"></path><path d="M16 3.13a4 4 0 010 7.75"></path></svg>
            ${esc(dept)}
            <span class="stamp stamp-info">${deptEmps.length} staff</span>
          </div>
          <button class="btn btn-sm btn-primary" data-action="dept-quick-plan" data-dept="${esc(dept)}">⚡ Assign Dept</button>
        </div>
        ${empCardsHtml}
      </div>`;
  }).join('');

  // 2. All Tasks Table HTML
  let filteredTasks = allTasks.filter(k => {
    const e = D.emp.get(k.empId) || {};
    const p = D.proj.get(k.projectId) || {};
    const matchQ = matches(q, k.title, k.desc, e.name, e.code, p.name);
    return matchQ && (!fProj || k.projectId === fProj) && (!fEmp || k.empId === fEmp) && (!fStatus || k.status === fStatus) && (!fDept || (k.dept || e.dept) === fDept);
  }).sort((a, b) => {
    if (a.status === 'Completed' && b.status !== 'Completed') return 1;
    if (a.status !== 'Completed' && b.status === 'Completed') return -1;
    return String(a.dueDate || '9').localeCompare(String(b.dueDate || '9'));
  });

  const tableRows = filteredTasks.map(k => {
    const e = D.emp.get(k.empId) || { name: 'Unassigned', code: '' };
    const p = D.proj.get(k.projectId);
    const dInfo = deadlineInfo(k.dueDate, k.status);

    return `
      <tr>
        <td>
          <b>${esc(k.title)}</b>
          ${k.desc ? `<div class="sub">${esc(k.desc)}</div>` : ''}
          ${k.assignedBy ? `<div class="sub" style="font-size:11px">Assigned by: ${esc(k.assignedBy)}</div>` : ''}
        </td>
        <td>
          <button class="link-btn person" data-action="emp-open" data-id="${esc(e.id || '')}" style="padding:0">
            ${avatar(e)}
            <div>
              <b style="color:var(--ink)">${esc(e.name)}</b>
              <span class="sub">${esc(e.dept || 'Staff')} · ${esc(e.code || '')}</span>
            </div>
          </button>
        </td>
        <td>
          ${p ? `<b>${esc(p.name)}</b><span class="sub">${esc(p.location || 'Site')}</span>` : '<span class="muted">General</span>'}
        </td>
        <td>
          <span class="task-badge task-prio-${esc(k.priority || 'Medium')}">${esc(k.priority || 'Medium')}</span>
        </td>
        <td class="nowrap">
          <div><b>${fmtDate(k.dueDate)}</b></div>
          <span class="stamp stamp-${dInfo.cls}">${esc(dInfo.text)}</span>
        </td>
        <td>
          <select class="task-status-sel" data-change="task-status-change" data-id="${esc(k.id)}">
            ${['To Do', 'In Progress', 'Completed', 'Delayed'].map(st => `<option value="${st}"${k.status === st ? ' selected' : ''}>${st}</option>`).join('')}
          </select>
        </td>
        <td class="acts">
          <button class="link-btn" data-action="task-edit" data-id="${esc(k.id)}">Edit</button>
          <button class="link-btn danger" data-action="task-del" data-id="${esc(k.id)}">Delete</button>
        </td>
      </tr>`;
  });

  const viewMode = S.ui.deptViewMode || 'cards';
  let boardContent = '';
  if (emps.length === 0) {
    boardContent = empty('No active employees', 'Add employees under HRMS to start planning daily work for each department.');
  } else if (viewMode === 'columns') {
    boardContent = `<div class="dept-board">${deptColumnsHtml}</div>`;
  } else {
    // Cards mode (Default)
    if (activeDept && depts.includes(activeDept)) {
      boardContent = openedDeptHtml;
    } else {
      boardContent = `
        <div style="margin:10px 0 16px;font-size:13px;color:var(--ink-2);display:flex;align-items:center;gap:8px">
          <span style="font-size:16px">ℹ️</span>
          <span><b>7 Department Cards:</b> Kisi bhi department card pe click karein ya <b>Open Department</b> button dabayein us department ke staff aur aaj ke tasks dekhne ke liye.</span>
        </div>
        <div class="dept-cards-grid">${deptCardsHtml}</div>
      `;
    }
  }

  return head('DAILY WORK REPORT', 'Assign Work & Tasks', `Daily department task planner & allocation: Sabhi departments ko aaj ka kaam yahin se assign karein. Total <b>${allTasks.length}</b> tasks`,
      `<button class="btn btn-primary" data-action="dept-planner">⚡ Daily Department Task Planner</button>
       <button class="btn" data-action="work-assign-new">+ Assign Single Task</button>`)
    + `<div class="tabs">
        <button class="tab-btn${tab === 'board' ? ' active' : ''}" data-action="task-tab-change" data-tab="board">⚡ Department Daily Board (Aaj Ka Kaam)</button>
        <button class="tab-btn${tab === 'list' ? ' active' : ''}" data-action="task-tab-change" data-tab="list">All Tasks List & Deadlines (${allTasks.length})</button>
      </div>`
    + `<div class="toolbar" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div class="chips">
          ${stamp(`${allTasks.length} Total Tasks`, 'info')}
          ${stamp(`${todoCount} To Do`, 'mute')}
          ${stamp(`${inProgCount} In Progress`, 'info')}
          ${stamp(`${compCount} Completed`, 'good')}
          ${stamp(`${overdueCount} Overdue`, overdueCount ? 'bad' : 'mute')}
        </div>
        ${tab === 'board' ? `
          <div style="display:flex;align-items:center;gap:6px">
            <button class="btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-outline'}" data-action="dept-view-toggle" data-mode="cards" title="View 7 Department Cards">🗂️ 7 Department Cards</button>
            <button class="btn btn-sm ${viewMode === 'columns' ? 'btn-primary' : 'btn-outline'}" data-action="dept-view-toggle" data-mode="columns" title="View all columns side by side">📊 Expanded Columns</button>
          </div>
        ` : ''}
      </div>`
    + (tab === 'board'
        ? boardContent
        : `
          <div class="toolbar">
            ${searchBox('task-allocation', 'Search task, employee or project')}
            <select id="flt-taskDept" data-change="filter" data-key="taskDept">
              <option value="">All Departments</option>
              ${depts.map(d => `<option value="${esc(d)}"${d === fDept ? ' selected' : ''}>${esc(d)}</option>`).join('')}
            </select>
            <select id="flt-taskProj" data-change="filter" data-key="taskProj">
              <option value="">All Projects</option>
              ${S.projects.map(p => `<option value="${esc(p.id)}"${p.id === fProj ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}
            </select>
            <select id="flt-taskEmp" data-change="filter" data-key="taskEmp">
              <option value="">All Employees</option>
              ${S.employees.map(e => `<option value="${esc(e.id)}"${e.id === fEmp ? ' selected' : ''}>${esc(e.name)} (${esc(e.code)})</option>`).join('')}
            </select>
            <select id="flt-taskStatus" data-change="filter" data-key="taskStatus">
              <option value="">All Statuses</option>
              ${['To Do', 'In Progress', 'Completed', 'Delayed'].map(s => `<option value="${s}"${s === fStatus ? ' selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          ${filteredTasks.length === 0 ? empty('No tasks match', 'Try changing search or filters.') : table(['Task & Instructions', 'Assigned Staff', 'Project', 'Priority', 'Deadline', 'Status', ''], tableRows)}
        `);
};

/* Form to assign a single task */
function openTaskForm(t) {
  const emps = activeEmps();
  if (!emps.length) return toast('Add employees first under HRMS.', 'warn');
  const projs = S.projects;

  openForm({
    title: t ? 'Edit Assigned Task' : 'Assign Work / Task to Staff',
    sub: 'Specify the task, assign an employee, choose the project and set a firm deadline.',
    submit: t ? 'Update Task' : 'Assign Task',
    wide: true,
    fields: [
      { name: 'title', label: 'Task Title / Action Item', required: true, placeholder: 'e.g. Set up parking entry sensors and calibrate RFID gate' },
      { name: 'empId', label: 'Assign To (Employee)', type: 'select', required: true, options: emps.map(e => ({ value: e.id, label: `${e.name} (${e.code} · ${e.role || 'Staff'})` })), value: t ? t.empId : emps[0].id },
      { name: 'projectId', label: 'Project (Kahan ka project hai)', type: 'select', options: [{ value: '', label: 'General / No specific project' }].concat(projs.map(p => ({ value: p.id, label: `${p.name} (${p.location || 'Site'})` }))), value: t ? t.projectId : '' },
      { name: 'dueDate', label: 'Deadline / Due Date', type: 'date', required: true, value: t ? t.dueDate : today() },
      { name: 'priority', label: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'], value: t ? t.priority : 'Medium' },
      { name: 'status', label: 'Status', type: 'select', options: ['To Do', 'In Progress', 'Completed', 'Delayed'], value: t ? t.status : 'To Do' },
      { name: 'assignedBy', label: 'Assigned By (Manager / Lead)', value: t ? t.assignedBy : (S.user ? S.user.name : 'Project Manager') },
      { name: 'desc', label: 'Detailed Instructions / Notes', type: 'textarea', rows: 3, placeholder: 'Specific requirements, site instructions, or deliverables expected...' }
    ],
    values: t || {},
    onSubmit: async v => {
      const emp = S.employees.find(x => x.id === v.empId);
      if (emp && emp.dept) v.dept = emp.dept;
      if (t) {
        await dbUpdate('tasks', t.id, v);
        toast('Task updated successfully!', 'good');
      } else {
        await dbAdd('tasks', v);
        toast(`Task assigned to ${emp ? emp.name : 'Staff'} with deadline ${fmtDate(v.dueDate)}!`, 'good');
      }
    }
  });
}

ACT['dept-planner'] = () => openDeptPlannerModal(null, null);
ACT['dept-quick-plan'] = el => openDeptPlannerModal(el.dataset.dept, null);
ACT['quick-task-add'] = el => openDeptPlannerModal(el.dataset.dept, el.dataset.emp);
ACT['dept-open'] = (el, ev) => {
  if (ev && ev.target && ev.target.closest('button, select, input, a')) return;
  S.ui.activeDept = el.dataset.dept;
  scheduleRender();
};
ACT['dept-back'] = () => {
  S.ui.activeDept = null;
  scheduleRender();
};
ACT['dept-view-toggle'] = el => {
  S.ui.deptViewMode = el.dataset.mode;
  scheduleRender();
};
CHG['dept-switch'] = el => {
  S.ui.activeDept = el.value || null;
  scheduleRender();
};
ACT['task-tab-change'] = el => { S.ui.taskTab = el.dataset.tab; scheduleRender(); };
ACT['work-assign-new'] = () => openTaskForm(null);
ACT['task-edit'] = el => openTaskForm(S.tasks.find(x => x.id === el.dataset.id));
ACT['task-del'] = async el => {
  const t = S.tasks.find(x => x.id === el.dataset.id);
  if (!t) return;
  if (await confirmBox('Delete assigned task?', `Task "${t.title}" will be deleted.`)) {
    save(() => dbDelete('tasks', t.id), 'Task deleted');
  }
};
CHG['task-status-change'] = async el => {
  const id = el.dataset.id;
  const status = el.value;
  try {
    await dbUpdate('tasks', id, { status });
    toast(`Task status updated to ${status}`, 'good');
  } catch (e) {
    toast('Could not update status', 'bad');
  }
};

/* ================= 3. Project Management Hub & Deadlines ================= */
V['project-manager'] = D => {
  const q = query('project-manager');
  const fStatus = S.ui.filter.pmStatus || '';
  const fLead = S.ui.filter.pmLead || '';
  const viewMode = S.ui.pmViewMode || 'cards';

  let projects = S.projects.filter(p => {
    const lead = D.emp.get(p.leadId) || {};
    return matches(q, p.name, p.client, p.location, lead.name) && (!fStatus || p.status === fStatus) && (!fLead || p.leadId === fLead);
  });

  projects = projects.sort((a, b) => {
    if (a.status === 'Running' && b.status !== 'Running') return -1;
    if (a.status !== 'Running' && b.status === 'Running') return 1;
    return String(a.end || '9').localeCompare(String(b.end || '9'));
  });

  // 1. Compact Project Overview Cards Grid
  const pmCardsGridHtml = projects.map(p => {
    const lead = D.emp.get(p.leadId);
    const teamMembers = (p.memberIds || []).map(id => D.emp.get(id)).filter(Boolean);
    const dInfo = deadlineInfo(p.end, p.status);
    const pTasks = (S.tasks || []).filter(t => t.projectId === p.id);
    const pTasksDone = pTasks.filter(t => t.status === 'Completed').length;
    const pLogs = (S.worklogs || []).filter(w => w.projectId === p.id);

    const statusTone = p.status === 'Running' ? 'good' : p.status === 'Planned' ? 'info' : p.status === 'Completed' ? 'mute' : 'warn';
    const statusColor = p.status === 'Running' ? '#22c55e' : p.status === 'Planned' ? '#38bdf8' : p.status === 'Completed' ? '#94a3b8' : '#f59e0b';

    const previewMembers = teamMembers.slice(0, 4);
    const remainingCount = teamMembers.length - previewMembers.length;
    const teamAvatarsHtml = previewMembers.map(m => `
      <div title="${esc(m.name)} (${esc(m.role || 'Staff')})" style="display:inline-block;margin-right:-8px;border:2px solid var(--paper);border-radius:50%">
        ${avatar(m, 'sm')}
      </div>
    `).join('') + (remainingCount > 0 ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.12);color:var(--ink);font-size:11px;font-weight:700;border:2px solid var(--paper);margin-left:8px">+${remainingCount}</span>` : '');

    return `
      <div class="pm-overview-card" data-action="pm-card-open" data-id="${esc(p.id)}" style="border-top: 4px solid ${statusColor}; cursor: pointer">
        <div class="pm-card-top">
          <div style="flex:1;padding-right:8px">
            <h3 class="pm-card-title">${esc(p.name)}</h3>
            <p class="pm-card-sub">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              <b>Site:</b> ${esc(p.location || 'Site not specified')}
            </p>
          </div>
          <span class="stamp stamp-${statusTone}" style="font-weight:800;font-size:12px;padding:3px 9px">${esc(p.status)}</span>
        </div>

        <div style="font-size:12.5px;color:var(--ink-2);display:flex;justify-content:space-between;align-items:center;gap:8px">
          <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Client: <b style="color:var(--ink)">${esc(p.client || 'Internal Project')}</b></span>
          ${p.budget ? `<span style="color:#38bdf8;font-weight:700;white-space:nowrap">${inr(p.budget)}</span>` : ''}
        </div>

        <!-- Project Lead Mini -->
        <div style="background:var(--sheet);border:1px solid var(--rule);border-radius:8px;padding:8px 12px;display:flex;align-items:center;gap:10px">
          <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#0284c7,#0369a1);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;flex-shrink:0">
            ${lead ? esc(initials(lead.name)) : '?'}
          </div>
          <div style="overflow:hidden;flex:1">
            <div style="font-size:13px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${lead ? esc(lead.name) : '<span class="due">No Lead Assigned</span>'}
            </div>
            <div style="font-size:11px;color:var(--ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              Project Lead / Manager ${lead && lead.phone ? `· ${esc(lead.phone)}` : ''}
            </div>
          </div>
        </div>

        <!-- Progress & Timeline -->
        <div style="display:flex;flex-direction:column;gap:6px">
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px">
            <span style="font-weight:700;color:var(--ink)">Progress: <span style="color:#38bdf8">${num(p.progress)}%</span></span>
            <span class="stamp stamp-${dInfo.cls}" style="font-size:11px;padding:2px 7px">${esc(dInfo.text)}</span>
          </div>
          ${meter(p.progress)}
        </div>

        <!-- 3 Metrics row -->
        <div class="pm-card-stats-row">
          <div class="pm-stat-pill">
            <span class="sub">Team</span>
            <b>${teamMembers.length} Staff</b>
          </div>
          <div class="pm-stat-pill">
            <span class="sub">Tasks</span>
            <b>${pTasksDone}/${pTasks.length} Done</b>
          </div>
          <div class="pm-stat-pill">
            <span class="sub">Updates</span>
            <b>${pLogs.length} Reports</b>
          </div>
        </div>

        <!-- Footer -->
        <div class="pm-card-footer">
          <div style="display:flex;align-items:center">
            ${teamAvatarsHtml || '<span class="muted" style="font-size:11px">No members</span>'}
          </div>
          <div style="display:flex;gap:6px" onclick="event.stopPropagation()">
            <button class="btn btn-sm btn-outline" data-action="pm-task-add" data-id="${esc(p.id)}" title="Assign Task">+ Task</button>
            <button class="btn btn-sm btn-primary" data-action="pm-card-open" data-id="${esc(p.id)}">📂 Open Details &raquo;</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 2. Opened Project Full Details View
  const activeProj = S.projects.find(x => x.id === S.ui.activePmProject);
  let openedProjectHtml = '';

  if (activeProj) {
    const p = activeProj;
    const lead = D.emp.get(p.leadId);
    const teamMembers = (p.memberIds || []).map(id => D.emp.get(id)).filter(Boolean);
    const dInfo = deadlineInfo(p.end, p.status);
    const pTasks = (S.tasks || []).filter(t => t.projectId === p.id);
    const pTasksDone = pTasks.filter(t => t.status === 'Completed').length;
    const pLogs = (S.worklogs || []).filter(w => w.projectId === p.id);

    const statusTone = p.status === 'Running' ? 'good' : p.status === 'Planned' ? 'info' : p.status === 'Completed' ? 'mute' : 'warn';
    const statusColor = p.status === 'Running' ? '#22c55e' : p.status === 'Planned' ? '#38bdf8' : p.status === 'Completed' ? '#94a3b8' : '#f59e0b';

    openedProjectHtml = `
      <div class="pm-opened-view">
        <!-- Top Navigation Strip -->
        <div class="pm-opened-banner" style="border-left:4px solid ${statusColor}">
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <button class="btn btn-outline" data-action="pm-back" style="display:inline-flex;align-items:center;gap:6px;font-weight:700">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              &lsaquo; All Project Cards
            </button>
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:22px">🏗️</span>
              <div>
                <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--ink)">${esc(p.name)}</h2>
                <span style="font-size:12px;color:var(--ink-2)"><b>Site:</b> ${esc(p.location || 'Location not specified')} &middot; Client: <b>${esc(p.client || 'Internal')}</b></span>
              </div>
            </div>
            <span class="stamp stamp-${statusTone}" style="font-weight:800;font-size:12px">${esc(p.status)}</span>
          </div>

          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <select class="pm-nav-dropdown" data-change="pm-switch" style="font-size:12px;padding:6px 10px;border-radius:6px">
              <option value="">Switch Project...</option>
              ${S.projects.map(pj => `<option value="${esc(pj.id)}"${pj.id === p.id ? ' selected' : ''}>${esc(pj.name)} (${esc(pj.status)})</option>`).join('')}
            </select>
            <button class="btn btn-primary" data-action="pm-task-add" data-id="${esc(p.id)}">+ Assign Task</button>
            <button class="btn" data-action="pm-progress" data-id="${esc(p.id)}">Update %</button>
            <button class="btn" data-action="pm-edit" data-id="${esc(p.id)}">✏️ Edit</button>
            <button class="btn btn-outline danger" data-action="pm-del" data-id="${esc(p.id)}">🗑️</button>
          </div>
        </div>

        <!-- 4 Key Metrics Dashboard Cards -->
        <div class="pm-details-metrics-grid">
          <div class="pm-detail-metric-card" style="border-top:3px solid #38bdf8">
            <div class="sub" style="font-size:11px;font-weight:700;color:var(--ink-2)">WORK PROGRESS</div>
            <div style="font-size:24px;font-weight:800;color:#38bdf8;margin:4px 0">${num(p.progress)}%</div>
            ${meter(p.progress)}
            <div style="font-size:11.5px;color:var(--ink-2);margin-top:4px">${p.progress >= 100 ? 'Project 100% Completed' : `${100 - num(p.progress)}% remaining work`}</div>
          </div>

          <div class="pm-detail-metric-card" style="border-top:3px solid #22c55e">
            <div class="sub" style="font-size:11px;font-weight:700;color:var(--ink-2)">TIMELINE & DEADLINE</div>
            <div style="font-size:15px;font-weight:800;color:var(--ink);margin:4px 0">${p.start ? fmtDate(p.start) : 'Started'} → ${p.end ? fmtDate(p.end) : 'No deadline'}</div>
            <span class="stamp stamp-${dInfo.cls}" style="align-self:flex-start;font-size:11px;margin-top:6px">${esc(dInfo.text)}</span>
          </div>

          <div class="pm-detail-metric-card" style="border-top:3px solid #8b5cf6">
            <div class="sub" style="font-size:11px;font-weight:700;color:var(--ink-2)">TASKS STATUS</div>
            <div style="font-size:24px;font-weight:800;color:#8b5cf6;margin:4px 0">${pTasksDone} / ${pTasks.length}</div>
            <div style="font-size:12px;color:var(--ink-2)">${pTasks.length - pTasksDone} pending tasks</div>
          </div>

          <div class="pm-detail-metric-card" style="border-top:3px solid #f59e0b">
            <div class="sub" style="font-size:11px;font-weight:700;color:var(--ink-2)">TEAM & UPDATES</div>
            <div style="font-size:24px;font-weight:800;color:#f59e0b;margin:4px 0">${teamMembers.length} Staff</div>
            <div style="font-size:12px;color:var(--ink-2)">${pLogs.length} daily work logs filed</div>
          </div>
        </div>

        <!-- Project Lead / Manager Banner -->
        <div class="pm-lead-badge" style="border-radius:10px">
          <div class="pm-lead-avatar">${lead ? esc(initials(lead.name)) : '?'}</div>
          <div class="pm-lead-info" style="flex:1">
            <b>${lead ? esc(lead.name) : '<span class="due">No Project Manager / Lead assigned</span>'}</b>
            <span>${lead ? `Project Lead / Manager · ${esc(lead.role || '')} · 📞 ${esc(lead.phone || 'No phone')} · ✉️ ${esc(lead.email || '')}` : 'Edit project to assign a lead'}</span>
          </div>
          ${lead ? `<button class="btn btn-sm btn-outline" data-action="quick-task-add" data-emp="${esc(lead.id)}" data-dept="${esc(lead.dept || '')}">+ Assign to Lead</button>` : ''}
        </div>

        <!-- Notes / Requirements (if any) -->
        ${p.note ? `
          <div style="background:var(--paper);border:1px solid var(--rule);border-radius:10px;padding:14px 18px">
            <b style="font-size:12px;text-transform:uppercase;color:var(--ink-2);display:block;margin-bottom:4px">Project Notes & Specifications:</b>
            <p style="margin:0;font-size:13.5px;color:var(--ink);line-height:1.5">${esc(p.note)}</p>
          </div>
        ` : ''}

        <!-- Assigned Team Members Section -->
        <div style="background:var(--sheet);border:1px solid var(--rule);border-radius:12px;padding:18px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <h3 style="margin:0;font-size:15px;font-weight:800;color:var(--ink);display:flex;align-items:center;gap:8px">
              👥 Assigned Team Members (${teamMembers.length})
            </h3>
            <button class="btn btn-sm btn-outline" data-action="pm-edit" data-id="${esc(p.id)}">Manage Team</button>
          </div>
          <div class="pm-team-grid">
            ${teamMembers.length ? teamMembers.map(m => `
              <div class="pm-team-emp-card">
                <div style="display:flex;align-items:center;gap:10px">
                  ${avatar(m, 'sm')}
                  <div>
                    <b style="color:var(--ink);font-size:13px;display:block">${esc(m.name)}</b>
                    <span style="color:var(--ink-2);font-size:11px">${esc(m.code)} · ${esc(m.role || 'Staff')}</span>
                  </div>
                </div>
                <button class="link-btn" data-action="quick-task-add" data-emp="${esc(m.id)}" data-dept="${esc(m.dept || '')}" title="Assign task to ${esc(m.name)}">+ Task</button>
              </div>
            `).join('') : '<div class="muted" style="padding:10px 0;font-size:13px">No team members assigned yet. Click "Manage Team" or "Edit" to assign staff members.</div>'}
          </div>
        </div>

        <!-- Project Tasks Section -->
        <div style="background:var(--paper);border:1px solid var(--rule);border-radius:12px;padding:18px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <div>
              <h3 style="margin:0;font-size:15px;font-weight:800;color:var(--ink)">
                📋 Tasks Assigned to this Project (${pTasks.length})
              </h3>
              <span style="font-size:12px;color:var(--ink-2)">Sabhi tasks jo is project ke liye assigned hain.</span>
            </div>
            <button class="btn btn-sm btn-primary" data-action="pm-task-add" data-id="${esc(p.id)}">+ Assign New Task</button>
          </div>

          ${pTasks.length ? `
            <div style="overflow-x:auto">
              <table class="table" style="margin:0">
                <thead>
                  <tr>
                    <th>Task & Instructions</th>
                    <th>Assigned Staff</th>
                    <th>Priority</th>
                    <th>Deadline</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  ${pTasks.map(k => {
                    const e = D.emp.get(k.empId) || { name: 'Unassigned', code: '' };
                    const tDInfo = deadlineInfo(k.dueDate, k.status);
                    return `
                      <tr>
                        <td>
                          <b>${esc(k.title)}</b>
                          ${k.desc ? `<div class="sub" style="font-size:11.5px">${esc(k.desc)}</div>` : ''}
                        </td>
                        <td>
                          <div style="display:flex;align-items:center;gap:8px">
                            ${avatar(e, 'sm')}
                            <div>
                              <b>${esc(e.name)}</b>
                              <span class="sub" style="font-size:11px">${esc(e.code)} · ${esc(e.role || 'Staff')}</span>
                            </div>
                          </div>
                        </td>
                        <td><span class="task-badge task-prio-${esc(k.priority || 'Medium')}">${esc(k.priority || 'Medium')}</span></td>
                        <td class="nowrap">
                          <div><b>${fmtDate(k.dueDate)}</b></div>
                          <span class="stamp stamp-${tDInfo.cls}" style="font-size:10px">${esc(tDInfo.text)}</span>
                        </td>
                        <td>
                          <select class="task-status-sel" data-change="task-status-change" data-id="${esc(k.id)}" style="font-size:11px;padding:2px 5px">
                            ${['To Do', 'In Progress', 'Completed'].map(st => `<option value="${st}"${k.status === st ? ' selected' : ''}>${st}</option>`).join('')}
                          </select>
                        </td>
                        <td class="acts">
                          <button class="link-btn" data-action="task-edit" data-id="${esc(k.id)}">Edit</button>
                          <button class="link-btn danger" data-action="task-del" data-id="${esc(k.id)}">Delete</button>
                        </td>
                      </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div style="text-align:center;padding:30px 10px">
              <p class="muted" style="margin-bottom:12px;font-size:13.5px">No specific tasks have been assigned to this project yet.</p>
              <button class="btn btn-sm btn-primary" data-action="pm-task-add" data-id="${esc(p.id)}">+ Assign First Task</button>
            </div>
          `}
        </div>

        <!-- Daily Work Reports Filed for this Project -->
        <div style="background:var(--sheet);border:1px solid var(--rule);border-radius:12px;padding:18px">
          <h3 style="margin:0 0 12px;font-size:15px;font-weight:800;color:var(--ink)">
            📝 Daily Work Reports Filed (${pLogs.length})
          </h3>
          ${pLogs.length ? `
            <div style="display:flex;flex-direction:column;gap:8px">
              ${pLogs.slice(0, 10).map(w => {
                const wEmp = D.emp.get(w.empId) || {};
                return `
                  <div style="background:var(--paper);border:1px solid var(--rule);border-radius:8px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
                    <div>
                      <div style="display:flex;align-items:center;gap:8px">
                        <b>${esc(wEmp.name || 'Staff')}</b>
                        <span class="stamp stamp-info" style="font-size:10px">${fmtDate(w.date)}</span>
                        ${w.hours ? `<span class="stamp" style="font-size:10px">${w.hours} hrs</span>` : ''}
                      </div>
                      <p style="margin:4px 0 0;font-size:12.5px;color:var(--ink-2)">${esc(w.desc || 'Daily work progress logged')}</p>
                    </div>
                  </div>`;
              }).join('')}
            </div>
          ` : '<span class="muted" style="font-size:12.5px">No daily work reports logged yet for this project.</span>'}
        </div>
      </div>
    `;
  }

  // 3. Side-by-Side All Expanded View (Fallback toggle)
  const fullExpandedHtml = projects.map(p => {
    const lead = D.emp.get(p.leadId);
    const teamMembers = (p.memberIds || []).map(id => D.emp.get(id)).filter(Boolean);
    const dInfo = deadlineInfo(p.end, p.status);
    const pTasks = (S.tasks || []).filter(t => t.projectId === p.id);
    const pTasksDone = pTasks.filter(t => t.status === 'Completed').length;
    const pLogs = (S.worklogs || []).filter(w => w.projectId === p.id);

    return `
      <div class="pm-card">
        <div class="pm-card-top">
          <div>
            <h3 class="pm-card-title">${esc(p.name)}</h3>
            <p class="pm-card-sub">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              <b>Site Location:</b> ${esc(p.location || 'Location not specified')}
            </p>
          </div>
          <span class="stamp stamp-${p.status === 'Running' ? 'good' : p.status === 'Planned' ? 'info' : p.status === 'Completed' ? 'mute' : 'warn'}">${esc(p.status)}</span>
        </div>

        <div style="font-size:12.5px;color:var(--ink-2)">
          <span>Client: <b>${esc(p.client || 'Internal Project')}</b></span>
          ${p.budget ? ` · Budget: <b>${inr(p.budget)}</b>` : ''}
        </div>

        <!-- Project Lead / Manager -->
        <div class="pm-lead-badge">
          <div class="pm-lead-avatar">${lead ? esc(initials(lead.name)) : '?'}</div>
          <div class="pm-lead-info">
            <b>${lead ? esc(lead.name) : '<span class="due">No Project Manager / Lead assigned</span>'}</b>
            <span>${lead ? `Project Lead / Manager · ${esc(lead.role || '')} · ${esc(lead.phone || '')}` : 'Edit project to assign a lead'}</span>
          </div>
        </div>

        <!-- Team Members Working on this Project -->
        <div>
          <div style="font-size:11.5px;font-weight:700;color:var(--ink-2);margin-bottom:6px">
            ASSIGNED TEAM MEMBERS (${teamMembers.length})
          </div>
          <div class="pm-team-chips">
            ${teamMembers.length ? teamMembers.map(m => `
              <span class="pm-member-chip" title="${esc(m.role || '')}">
                ${avatar(m, 'sm')}
                <b>${esc(m.name)}</b>
                <span style="opacity:0.7">(${esc(m.code)})</span>
              </span>
            `).join('') : '<span class="muted" style="font-size:12px">No team members assigned yet. Use Edit to add staff.</span>'}
          </div>
        </div>

        <!-- Timeline & Deadlines -->
        <div class="pm-deadline-box ${dInfo.cls}">
          <div>
            <div><b>Timeline:</b> ${p.start ? fmtDate(p.start) : 'Started'} → <b>${p.end ? fmtDate(p.end) : 'No deadline'}</b></div>
            <div style="font-size:11.5px;margin-top:2px">${esc(dInfo.text)}</div>
          </div>
          <div style="text-align:right">
            <b>${num(p.progress)}%</b>
            <div style="font-size:11px">Progress</div>
          </div>
        </div>
        ${meter(p.progress)}

        <!-- Tasks & Work Updates Summary -->
        <div class="pm-summary-bar">
          <span>Tasks: <b>${pTasksDone}/${pTasks.length}</b> completed</span>
          <span>Daily Updates: <b>${pLogs.length}</b> reports</span>
        </div>

        ${p.note ? `<p style="margin:0;font-size:12px;color:var(--ink-2);line-height:1.3">${esc(p.note)}</p>` : ''}

        <div class="pcard-foot" style="border-top:1px solid var(--rule-2);padding-top:10px;margin-top:auto">
          <button class="link-btn" data-action="pm-card-open" data-id="${esc(p.id)}">View Details</button>
          <button class="link-btn" data-action="pm-task-add" data-id="${esc(p.id)}">+ Assign Task</button>
          <button class="link-btn" data-action="pm-progress" data-id="${esc(p.id)}">Update %</button>
          <button class="link-btn" data-action="pm-edit" data-id="${esc(p.id)}">Edit</button>
          <button class="link-btn danger" data-action="pm-del" data-id="${esc(p.id)}">Delete</button>
        </div>
      </div>`;
  }).join('');

  let pmContent = '';
  if (S.projects.length === 0) {
    pmContent = empty('No projects created yet', 'Add your projects with location, assigned project lead, team members, start date and deadlines.', '<button class="btn btn-primary" data-action="pm-new-project">Add New Project</button>');
  } else if (projects.length === 0) {
    pmContent = empty('Nothing matches', 'Try changing your search or status filter.');
  } else if (viewMode === 'expanded') {
    pmContent = `<div class="pm-grid">${fullExpandedHtml}</div>`;
  } else {
    // Cards mode (Default)
    if (activeProj) {
      pmContent = openedProjectHtml;
    } else {
      pmContent = `
        <div style="margin:10px 0 16px;font-size:13px;color:var(--ink-2);display:flex;align-items:center;gap:8px">
          <span style="font-size:16px">ℹ️</span>
          <span><b>Project Cards Overview:</b> Kisi bhi project card pe click karein ya <b>Open Details</b> button dabayein us project ke sabhi team members, tasks aur complete timeline dekhne ke liye.</span>
        </div>
        <div class="pm-cards-grid">${pmCardsGridHtml}</div>
      `;
    }
  }

  return head('DAILY WORK REPORT', 'Project Hub & Deadlines', `Complete project oversight: Project Managers, team assignments, site locations, start dates, and firm deadlines. Total <b>${S.projects.length}</b> projects`,
      `<button class="btn btn-primary" data-action="pm-new-project">Add New Project</button>
       <button class="btn" data-action="work-assign-new">Assign Task to Team</button>`)
    + `<div class="toolbar" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex:1">
          ${searchBox('project-manager', 'Search project name, client, location, or manager')}
          <select id="flt-pmStatus" data-change="filter" data-key="pmStatus">
            <option value="">All Statuses</option>
            ${PROJECT_STATUS.map(s => `<option value="${s}"${s === fStatus ? ' selected' : ''}>${s}</option>`).join('')}
          </select>
          <select id="flt-pmLead" data-change="filter" data-key="pmLead">
            <option value="">All Project Managers / Leads</option>
            ${S.employees.map(e => `<option value="${esc(e.id)}"${e.id === fLead ? ' selected' : ''}>${esc(e.name)}</option>`).join('')}
          </select>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <button class="btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-outline'}" data-action="pm-view-toggle" data-mode="cards" title="View Project Cards">🗂️ Project Cards</button>
          <button class="btn btn-sm ${viewMode === 'expanded' ? 'btn-primary' : 'btn-outline'}" data-action="pm-view-toggle" data-mode="expanded" title="View all expanded side by side">📊 Expanded View</button>
        </div>
      </div>`
    + pmContent;
};

/* Project Create / Edit Form */
function openPmProjectForm(p) {
  const emps = activeEmps();
  const custs = S.customers;

  openForm({
    title: p ? 'Edit Project Details' : 'Add New Project',
    sub: 'Project location, Project Manager / Lead, assigned team members, start date aur deadline specify karein.',
    submit: p ? 'Save Project' : 'Create Project',
    wide: true,
    fields: [
      { name: 'name', label: 'Project Name', required: true, placeholder: 'e.g. Smart Parking System - Terminal 1' },
      { name: 'location', label: 'Site / Location (Kahan ka project hai)', required: true, placeholder: 'e.g. Sector 62, Noida / Airport Phase 2' },
      { name: 'client', label: 'Client / Organization', placeholder: 'e.g. Metro Rail Corp / Municipal Corp' },
      { name: 'leadId', label: 'Project Manager / Lead (Kon lead kar raha hai)', type: 'select', options: [{ value: '', label: 'Choose Project Lead' }].concat(emps.map(e => ({ value: e.id, label: `${e.name} (${e.role || 'Staff'})` }))), value: p ? p.leadId : '' },
      { name: 'memberIds', label: 'Assigned Team Members (Kon sa employee kaam kar raha hai)', type: 'checks', options: emps.map(e => ({ value: e.id, label: `${e.name} (${e.code} · ${e.role || 'Staff'})` })), value: p ? (p.memberIds || []) : [] },
      { name: 'start', label: 'Start Date (Kab start hua tha)', type: 'date', required: true, value: p ? p.start : today() },
      { name: 'end', label: 'Target Deadline (Kab tak chalega / Deadline)', type: 'date', required: true, value: p ? p.end : addDays(today(), 30) },
      { name: 'status', label: 'Project Status', type: 'select', options: PROJECT_STATUS, value: p ? p.status : 'Running' },
      { name: 'progress', label: 'Current Progress % (0 to 100)', type: 'number', min: 0, max: 100, value: p ? p.progress : 0 },
      { name: 'budget', label: 'Project Budget / Value (₹)', type: 'number', min: 0, value: p ? p.budget : 0 },
      { name: 'note', label: 'Project Scope & Notes', type: 'textarea', rows: 3, placeholder: 'Key milestones, site requirements, special instructions...' }
    ],
    values: p || {},
    onSubmit: async v => {
      if (p) {
        await dbUpdate('projects', p.id, v);
        toast('Project updated successfully!', 'good');
      } else {
        await dbAdd('projects', v);
        toast(`Project "${v.name}" created with deadline ${fmtDate(v.end)}!`, 'good');
      }
    }
  });
}

ACT['pm-new-project'] = () => openPmProjectForm(null);
ACT['pm-card-open'] = (el, ev) => {
  if (ev && ev.target && ev.target.closest('button, select, input, a')) return;
  S.ui.activePmProject = el.dataset.id;
  scheduleRender();
};
ACT['pm-back'] = () => {
  S.ui.activePmProject = null;
  scheduleRender();
};
ACT['pm-view-toggle'] = el => {
  S.ui.pmViewMode = el.dataset.mode;
  scheduleRender();
};
CHG['pm-switch'] = el => {
  S.ui.activePmProject = el.value || null;
  scheduleRender();
};
ACT['pm-edit'] = el => openPmProjectForm(S.projects.find(x => x.id === el.dataset.id));
ACT['pm-del'] = async el => {
  const p = S.projects.find(x => x.id === el.dataset.id);
  if (!p) return;
  if (await confirmBox('Delete project?', `Project "${p.name}" will be deleted. Past stock issues and invoices will keep their record.`)) {
    if (S.ui.activePmProject === p.id) S.ui.activePmProject = null;
    save(() => dbDelete('projects', p.id), 'Project deleted');
  }
};
ACT['pm-task-add'] = el => {
  const p = S.projects.find(x => x.id === el.dataset.id);
  if (p) openTaskForm({ projectId: p.id });
};
ACT['pm-progress'] = el => {
  const p = S.projects.find(x => x.id === el.dataset.id);
  if (!p) return;
  openForm({
    title: `Update Progress %: ${p.name}`,
    submit: 'Save Progress',
    fields: [
      { name: 'progress', label: 'Progress %', type: 'number', min: 0, max: 100, required: true, value: p.progress },
      { name: 'status', label: 'Status', type: 'select', options: PROJECT_STATUS, value: p.progress >= 100 ? 'Completed' : p.status }
    ],
    onSubmit: async v => {
      await dbUpdate('projects', p.id, v);
      toast('Progress updated!', 'good');
    }
  });
};

/* ================= 4. Employee View of My Assigned Tasks ================= */
V['emp-tasks'] = D => {
  const me = myEmployee();
  if (!me) return empty('Employee Profile Not Found', 'Log in as an employee to see assigned tasks.');
  const myTasks = (S.tasks || []).filter(t => t.empId === me.id).sort((a, b) => {
    if (a.status === 'Completed' && b.status !== 'Completed') return 1;
    if (a.status !== 'Completed' && b.status === 'Completed') return -1;
    return String(a.dueDate || '9').localeCompare(String(b.dueDate || '9'));
  });

  const pending = myTasks.filter(t => t.status !== 'Completed');

  const rows = myTasks.map(t => {
    const p = D.proj.get(t.projectId);
    const dInfo = deadlineInfo(t.dueDate, t.status);

    return `
      <tr>
        <td>
          <b>${esc(t.title)}</b>
          ${t.desc ? `<div class="sub">${esc(t.desc)}</div>` : ''}
          ${t.assignedBy ? `<div class="sub" style="font-size:11px">Assigned by: ${esc(t.assignedBy)}</div>` : ''}
        </td>
        <td>${p ? `<b>${esc(p.name)}</b><span class="sub">${esc(p.location || 'Site')}</span>` : '<span class="muted">General</span>'}</td>
        <td><span class="task-badge task-prio-${esc(t.priority || 'Medium')}">${esc(t.priority || 'Medium')}</span></td>
        <td class="nowrap">
          <div><b>${fmtDate(t.dueDate)}</b></div>
          <span class="stamp stamp-${dInfo.cls}">${esc(dInfo.text)}</span>
        </td>
        <td>
          <select class="task-status-sel" data-change="task-status-change" data-id="${esc(t.id)}">
            ${['To Do', 'In Progress', 'Completed'].map(st => `<option value="${st}"${t.status === st ? ' selected' : ''}>${st}</option>`).join('')}
          </select>
        </td>
      </tr>`;
  });

  return head('EMPLOYEE WORKSPACE', 'My Assigned Tasks', `Tasks assigned to you by project managers with deadlines. <b>${pending.length}</b> pending`, '')
    + (myTasks.length === 0 ? empty('No tasks assigned to you', 'Your manager has not assigned any tasks to you yet.')
      : table(['Task & Instructions', 'Project', 'Priority', 'Deadline', 'Status'], rows));
};

