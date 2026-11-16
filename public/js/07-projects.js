'use strict';
/* ================= Projects: what is running, where, who leads it and who is on it ================= */
const PROJECT_TONE = { Planned: 'info', Running: 'good', 'On hold': 'warn', Completed: 'mute' };
const projectClient = (D, p) => p.customerId && D.cust.get(p.customerId) ? custLabel(D.cust.get(p.customerId)) : (p.client || '');
function projectDates(p) {
  if (!p.start && !p.end) return 'Dates not set';
  const t = today();
  let tail = '';
  if (p.status === 'Completed') tail = '';
  else if (p.end && p.end < t) tail = ` · <span class="due">${plural(dayDiff(p.end, t), 'day')} past target</span>`;
  else if (p.end && p.status === 'Running') tail = ` · ${plural(dayDiff(t, p.end), 'day')} left`;
  else if (p.start && p.start > t) tail = ` · starts in ${plural(dayDiff(t, p.start), 'day')}`;
  return `${p.start ? fmtDay(p.start) : '—'} to ${p.end ? fmtDate(p.end) : '—'}${tail}`;
}
function meter(pct) { const v = Math.max(0, Math.min(100, num(pct))); return `<div class="meter-row"><div class="meter" role="img" aria-label="${v}% complete"><span style="width:${v}%"></span></div><span>${v}%</span></div>`; }
V.projects = D => {
  const q = query('projects'), f = S.ui.filter.pstatus || '';
  const order = { Running: 0, 'On hold': 1, Planned: 2, Completed: 3 };
  const rows = S.projects.filter(p => matches(q, p.name, p.location, projectClient(D, p), empName(D, p.leadId)) && (!f || p.status === f))
    .sort((a, b) => order[a.status] - order[b.status] || String(a.end || '9').localeCompare(String(b.end || '9')));
  const running = S.projects.filter(p => p.status === 'Running');
  const busy = new Set(running.flatMap(p => [p.leadId].concat(p.memberIds || []).filter(Boolean)));
  const cards = rows.map(p => {
    const lead = D.emp.get(p.leadId), team = (p.memberIds || []).map(id => D.emp.get(id)).filter(Boolean);
    const sent = S.issues.filter(i => i.projectId === p.id).sort(byNewest);
    return `<article class="pcard"><div class="pcard-top"><div><h3>${esc(p.name)}</h3><div class="pmeta">${esc([projectClient(D, p), p.location].filter(Boolean).join(' · ') || 'Client and location not set')}</div></div>${stamp(p.status, PROJECT_TONE[p.status])}</div>
      ${meter(p.progress)}
      <div class="prow"><span>Lead</span><span>${lead ? `<span class="person">${avatar(lead, 'sm')}<span><b>${esc(lead.name)}</b>${lead.role ? ` <span class="muted">· ${esc(lead.role)}</span>` : ''}</span></span>` : '<span class="due">No lead assigned</span>'}</span></div>
      <div class="prow"><span>Team</span><span class="team">${team.length ? team.map(e => `<span class="chip">${avatar(e, 'sm')}${esc(e.name)}</span>`).join('') : '<span class="muted">Nobody assigned yet</span>'}</span></div>
      <div class="prow"><span>Dates</span><span>${projectDates(p)}</span></div>
      ${sent.length ? `<div class="prow"><span>Material</span><span>${sent.slice(0, 3).map(i => `${esc(i.productName)} × ${qty(i.qty)}`).join(', ')}${sent.length > 3 ? `, and ${sent.length - 3} more` : ''}<span class="pmeta" style="display:block">Last sent ${fmtDay(sent[0].date)}${D.emp.get(sent[0].takenById) ? ' with ' + esc(D.emp.get(sent[0].takenById).name) : ''}${sent[0].via ? ', by ' + esc(String(sent[0].via).toLowerCase()) : ''}</span></span></div>` : ''}
      ${p.note ? `<div class="prow"><span>Note</span><span>${esc(p.note)}</span></div>` : ''}
      <div class="pcard-foot">${W('projects', `<button class="link-btn" data-action="proj-hub-open" data-id="${esc(p.id)}" style="font-weight:700;color:var(--accent)">📂 Details & Tasks</button> <button class="link-btn" data-action="proj-edit" data-id="${esc(p.id)}">Edit</button> <button class="link-btn danger" data-action="proj-del" data-id="${esc(p.id)}">Delete</button>`)}</div></article>`;
  });
  return head('PROJECTS', 'All projects', `<b>${running.length}</b> running · <b>${busy.size}</b> people on site work · <b>${D.attn.late.length}</b> past their target date`,
      W('projects', '<button class="btn btn-primary" data-action="proj-new">New project</button>'))
    + `<div class="toolbar">${searchBox('projects', 'Search project, place, client or lead')}${filterSel('pstatus', 'All statuses', PROJECT_STATUS)}</div>`
    + (S.projects.length === 0 ? empty('No projects yet', 'Add each job you are running: where it is, who leads it and who is working on it. The owner sees them all in one place.', W('projects', '<button class="btn btn-primary" data-action="proj-new">New project</button>'))
      : rows.length === 0 ? empty('Nothing matches', 'Try a different search or status.')
      : `<div class="pgrid">${cards.join('')}</div>`);
};
function projectForm(p) {
  const emps = activeEmps().map(e => ({ value: e.id, label: e.role ? `${e.name} (${e.role})` : e.name }));
  openForm({
    title: p ? 'Edit project' : 'New project', wide: true,
    fields: [
      { name: 'name', label: 'Project name', required: true, full: true, maxlength: 140 },
      { name: 'customerId', label: 'Client', type: 'select', placeholder: 'Not in the customer list', options: S.customers.slice().sort(byName).map(c => ({ value: c.id, label: custLabel(c) })) },
      { name: 'client', label: 'Client name, if not in the list' },
      { name: 'location', label: 'Location / site', placeholder: 'Site address or area' },
      { name: 'status', label: 'Status', type: 'select', options: PROJECT_STATUS, value: 'Planned' },
      { name: 'start', label: 'Start date', type: 'date' },
      { name: 'end', label: 'Target end date', type: 'date' },
      { name: 'leadId', label: 'Project lead', type: 'select', placeholder: 'Not assigned', options: emps },
      { name: 'progress', label: 'Work done (%)', type: 'number', min: 0, max: 100, step: 1, value: 0 },
      { name: 'memberIds', label: 'Team working on it', type: 'checks', options: emps },
      { name: 'note', label: 'Notes', type: 'textarea', full: true }
    ],
    values: p || {},
    onSubmit: v => {
      if (v.progress < 0 || v.progress > 100) throw new UserError('Work done must be between 0 and 100.');
      v.memberIds = v.memberIds.filter(id => id !== v.leadId);
      return p ? dbUpdate('projects', p.id, v).then(() => toast('Project updated')) : dbAdd('projects', v).then(() => toast('Project added'));
    }
  });
}
ACT['proj-new'] = () => projectForm(null);
ACT['proj-hub-open'] = el => {
  S.ui.activePmProject = el.dataset.id;
  location.hash = 'project-manager';
};
ACT['proj-edit'] = el => projectForm(S.projects.find(p => p.id === el.dataset.id));
ACT['proj-del'] = async el => {
  const p = S.projects.find(x => x.id === el.dataset.id); if (!p) return;
  if (await confirmBox('Delete project?', `${p.name} will be removed. Stock already issued to it stays in the issue register.`)) save(() => dbDelete('projects', p.id), 'Project deleted');
};

/* ================= Projects: Delivered & Completed History ================= */
V['proj-history'] = D => {
  const q = (S.ui.q['proj-history'] || '').toLowerCase().trim();
  const allDelivered = S.projects.filter(p => p.status === 'Completed' || p.status === 'Delivered' || p.progress >= 100);

  const rows = allDelivered.filter(p => {
    if (!q) return true;
    const match = [p.name, p.code, p.client, p.location, projectClient(D, p), empName(D, p.leadId)].join(' ').toLowerCase();
    return match.includes(q);
  }).sort((a, b) => String(b.deliveredOn || b.end || '').localeCompare(String(a.deliveredOn || a.end || '')));

  const totalDeliveredVal = sum(rows, p => num(p.budget) || 0);

  const cards = rows.map(p => {
    const lead = D.emp.get(p.leadId);
    const team = (p.memberIds || []).map(id => D.emp.get(id)).filter(Boolean);
    const clientName = projectClient(D, p);
    const val = num(p.budget) || 0;
    const depts = p.departments || ['Technology Department', 'Operations Department'];

    return `
      <article class="pcard" style="border:1.5px solid #059669; box-shadow:0 8px 24px rgba(5,150,105,0.15); background:linear-gradient(145deg, #0e1e38 0%, #15294a 100%);">
        <div class="pcard-top">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-family:monospace; background:rgba(16,185,129,0.2); color:#34d399; border:1px solid rgba(16,185,129,0.4); padding:2px 7px; border-radius:4px; font-weight:700; font-size:12px;">${esc(p.code || 'PRJ')}</span>
              <h3 style="margin:0; font-size:16.5px; color:#f8fafc;">${esc(p.name)}</h3>
            </div>
            <div class="pmeta" style="margin-top:5px; color:#94a3b8;">
              <b>Client:</b> ${esc(clientName || 'Commercial Client')} · 📍 ${esc(p.location || 'Jaipur')}
            </div>
          </div>
          <span class="stamp stamp-good" style="font-size:12px; padding:4px 10px;">✓ DELIVERED 100%</span>
        </div>

        <div style="background:rgba(15,23,42,0.6); padding:10px 14px; border-radius:8px; margin:10px 0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; border:1px solid rgba(255,255,255,0.06);">
          <div>
            <span style="font-size:11px; text-transform:uppercase; color:#94a3b8; font-weight:600;">Project Contract Value</span>
            <div style="font-size:18px; font-weight:800; color:#38bdf8;">${val ? inr(val) : 'Custom Contract'}</div>
          </div>
          <div style="text-align:right;">
            <span style="font-size:11px; text-transform:uppercase; color:#94a3b8; font-weight:600;">Delivery &amp; Handover Date</span>
            <div style="font-size:14px; font-weight:700; color:#34d399;">📅 ${fmtDate(p.deliveredOn || p.end || today())}</div>
          </div>
        </div>

        <div class="prow">
          <span>Project Lead</span>
          <span>${lead ? `<span class="person">${avatar(lead, 'sm')}<span><b>${esc(lead.name)}</b> <span class="muted">· ${esc(lead.role || '')}</span></span></span>` : '<span class="muted">Vivek Kumar Bhardwaj (Founder)</span>'}</span>
        </div>

        <div class="prow">
          <span>Departments</span>
          <span style="display:flex; flex-wrap:wrap; gap:4px;">
            ${depts.map(d => `<span style="font-size:11px; background:rgba(59,130,246,0.15); color:#93c5fd; padding:1px 6px; border-radius:4px; border:1px solid rgba(59,130,246,0.3);">${esc(d.replace(' Department', ''))}</span>`).join('')}
          </span>
        </div>

        <div class="prow">
          <span>Deployment Team</span>
          <span class="team">${team.length ? team.map(e => `<span class="chip">${avatar(e, 'sm')}${esc(e.name)}</span>`).join('') : '<span class="muted">Site Engineers &amp; Technicians</span>'}</span>
        </div>

        ${p.note ? `<div class="prow"><span>Handover Notes</span><span style="color:#cbd5e1; font-size:12.5px;">${esc(p.note)}</span></div>` : ''}

        <div class="pcard-foot" style="border-top:1px solid rgba(255,255,255,0.08); padding-top:10px; margin-top:12px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:12px; color:#10b981; font-weight:700;">🟢 Commissioned &amp; Operational</span>
          <button class="btn btn-primary btn-sm" data-action="proj-cert" data-id="${esc(p.id)}" style="display:inline-flex; align-items:center; gap:6px;">
            📜 Handover Certificate
          </button>
        </div>
      </article>
    `;
  });

  return head('PROJECTS', 'Project History (Delivered & Completed Projects)',
      `Archive of <b>${allDelivered.length}</b> delivered client installations · Total delivered turnover: <b>${inr(totalDeliveredVal)}</b>`,
      `<a href="#projects" class="btn btn-outline">‹ Active Running Projects</a> <a href="#fin-home" class="btn btn-primary">💼 Finance Dashboard</a>`)
    + `<div class="tiles four" style="margin-bottom:16px;">
        ${tile('Delivered Projects', plural(allDelivered.length, 'project'), '100% completed & handed over')}
        ${tile('Total Project Turnover', inrShort(totalDeliveredVal), `${inr(totalDeliveredVal)} contract revenue`)}
        ${tile('Average Project Value', inrShort(allDelivered.length ? totalDeliveredVal / allDelivered.length : 0), 'per delivered installation')}
        ${tile('Handover Status', '100% Verified', 'Official delivery signoff completed')}
      </div>`
    + `<div class="toolbar">
        ${searchBox('proj-history', 'Search delivered project, client, site location, lead...')}
      </div>`
    + (rows.length === 0
      ? empty('No delivered projects match your search', 'All 100% completed projects are preserved here in the permanent archive.')
      : `<div class="pgrid">${cards.join('')}</div>`);
};

function openHandoverCertificate(p) {
  if (!p) return;
  dlg.className = 'dlg dlg-doc';
  const clientName = (p.customerId && S.customers.find(c => c.id === p.customerId)) ? (S.customers.find(c => c.id === p.customerId).company || S.customers.find(c => c.id === p.customerId).name) : (p.client || 'Client Organization');
  const lead = S.employees.find(e => e.id === p.leadId);
  const certNo = `CERT-DELIV-${p.code || p.id.toUpperCase()}-2026`;
  const delivDate = p.deliveredOn || p.end || today();
  const val = num(p.budget) || 0;

  dlg.innerHTML = `
    <div class="dlg-doc-topbar no-print">
      <div style="display:flex; align-items:center; gap:10px;">
        <h2 style="margin:0; font-size:17px; font-weight:800; color:#0d2649;">Project Handover &amp; Completion Certificate</h2>
        <span class="stamp stamp-good">DELIVERED &amp; COMMISSIONED</span>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-primary" onclick="printDoc('printableArea')">🖨️ Print / Save A4 Certificate PDF</button>
        <button class="btn" data-x="cancel">Close</button>
      </div>
    </div>

    <div class="dlg-doc-scroll">
      <div id="printableArea" class="letter-sheet" style="border:2px solid #0d2649; padding:32px 36px; max-width:820px; margin:0 auto; background:#ffffff; color:#0f172a; font-family:'Inter',system-ui,sans-serif;">
        <!-- Header with Brand Logo -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2.5px solid #0d2649; padding-bottom:14px; margin-bottom:18px;">
          <div>
            <div style="height:44px; display:flex; align-items:center; margin-bottom:6px;">
              <img src="/logo-light.png?v=20261115" alt="RvmAiTech" style="height:40px; width:auto; max-width:180px; object-fit:contain; display:block;">
            </div>
            <div style="font-size:11px; color:#475569; font-weight:600;">
              <b>RvmAiTech</b> · Smart Parking &amp; Industrial Automation<br>
              Cyber City, Mansarovar, Jaipur · rvmaitech2026@gmail.com · +91 7052050656
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#0284c7;">Certificate of Completion</div>
            <div style="font-family:monospace; font-size:12.5px; font-weight:700; color:#0d2649; margin-top:2px;">Ref: ${certNo}</div>
            <div style="font-size:11px; color:#64748b; margin-top:2px;">Handover Date: <b>${fmtDate(delivDate)}</b></div>
          </div>
        </div>

        <div style="text-align:center; margin:20px 0 24px;">
          <h1 style="font-family:'Space Grotesk',sans-serif; font-size:22px; font-weight:900; letter-spacing:0.04em; color:#0d2649; margin:0; text-transform:uppercase;">
            Project Completion &amp; Handover Certificate
          </h1>
          <p style="margin:6px 0 0; font-size:12.5px; color:#475569;">
            This is to certify that the project detailed below has been 100% installed, commissioned, tested, and handed over to the client in full working order.
          </p>
        </div>

        <!-- Project Details Box -->
        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:16px; margin-bottom:20px;">
          <table style="width:100%; border-collapse:collapse; font-size:12.5px;">
            <tr>
              <td style="padding:6px 8px; width:35%; color:#64748b; font-weight:600;">Project Name:</td>
              <td style="padding:6px 8px; width:65%; font-weight:700; color:#0f172a; font-size:14px;">${esc(p.name)}</td>
            </tr>
            <tr style="border-top:1px solid #e2e8f0;">
              <td style="padding:6px 8px; color:#64748b; font-weight:600;">Client Organization:</td>
              <td style="padding:6px 8px; font-weight:700; color:#0f172a;">${esc(clientName)}</td>
            </tr>
            <tr style="border-top:1px solid #e2e8f0;">
              <td style="padding:6px 8px; color:#64748b; font-weight:600;">Site / Facility Location:</td>
              <td style="padding:6px 8px; color:#0f172a;">${esc(p.location || 'Client Facility')}</td>
            </tr>
            <tr style="border-top:1px solid #e2e8f0;">
              <td style="padding:6px 8px; color:#64748b; font-weight:600;">Execution Period:</td>
              <td style="padding:6px 8px; color:#0f172a;">${p.start ? fmtDate(p.start) : '—'} to ${fmtDate(delivDate)}</td>
            </tr>
            <tr style="border-top:1px solid #e2e8f0;">
              <td style="padding:6px 8px; color:#64748b; font-weight:600;">Total Contract Value:</td>
              <td style="padding:6px 8px; font-weight:800; color:#0284c7; font-size:13.5px;">${val ? inr(val) + ' (Turnover Billed)' : 'As per Commercial Agreement'}</td>
            </tr>
            <tr style="border-top:1px solid #e2e8f0;">
              <td style="padding:6px 8px; color:#64748b; font-weight:600;">Project Lead / Manager:</td>
              <td style="padding:6px 8px; color:#0f172a;">${lead ? esc(lead.name) + ' (' + esc(lead.role) + ')' : 'Vivek Kumar Bhardwaj'}</td>
            </tr>
            <tr style="border-top:1px solid #e2e8f0;">
              <td style="padding:6px 8px; color:#64748b; font-weight:600;">Delivery &amp; Operational Status:</td>
              <td style="padding:6px 8px; font-weight:700; color:#059669;">100% Commissioned &amp; Live In Production</td>
            </tr>
          </table>
        </div>

        <!-- Scope of Delivery & Acceptance Checklist -->
        <div style="margin-bottom:24px;">
          <div style="font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:#0d2649; margin-bottom:8px;">Scope of Work &amp; Commissioning Verification:</div>
          <table style="width:100%; border-collapse:collapse; font-size:11.5px; border:1px solid #cbd5e1;">
            <thead>
              <tr style="background:#f1f5f9; border-bottom:1px solid #cbd5e1;">
                <th style="padding:8px 10px; text-align:left;">Deliverable / Subsystem</th>
                <th style="padding:8px 10px; text-align:left;">Specification &amp; Scope</th>
                <th style="padding:8px 10px; text-align:center; width:110px;">Verification</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding:8px 10px; font-weight:600;">Hardware &amp; Equipment Installation</td>
                <td style="padding:8px 10px; color:#475569;">Boom barriers, RFID readers, ultrasonic sensors, loop detectors, power supply &amp; surge protection.</td>
                <td style="padding:8px 10px; text-align:center; color:#059669; font-weight:700;">✓ Verified &amp; Passed</td>
              </tr>
              <tr style="border-top:1px solid #e2e8f0;">
                <td style="padding:8px 10px; font-weight:600;">Firmware &amp; ANPR Edge Deployment</td>
                <td style="padding:8px 10px; color:#475569;">License plate recognition engine calibrated for high accuracy day/night IR camera frames.</td>
                <td style="padding:8px 10px; text-align:center; color:#059669; font-weight:700;">✓ Verified &amp; Passed</td>
              </tr>
              <tr style="border-top:1px solid #e2e8f0;">
                <td style="padding:8px 10px; font-weight:600;">Software &amp; Cloud Analytics Integration</td>
                <td style="padding:8px 10px; color:#475569;">Real-time parking slot occupancy monitoring, automated cashier POS app and cloud telemetry dashboard.</td>
                <td style="padding:8px 10px; text-align:center; color:#059669; font-weight:700;">✓ Verified &amp; Passed</td>
              </tr>
              <tr style="border-top:1px solid #e2e8f0;">
                <td style="padding:8px 10px; font-weight:600;">Operator Training &amp; Documentation</td>
                <td style="padding:8px 10px; color:#475569;">Operational manuals, emergency barrier release keys, safety protocols, and staff training completed.</td>
                <td style="padding:8px 10px; text-align:center; color:#059669; font-weight:700;">✓ Verified &amp; Passed</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Acceptance Statement -->
        <p style="font-size:12px; line-height:1.6; color:#1e293b; margin-bottom:30px;">
          The client acknowledges receipt of the hardware, software configuration, documentation, and operational keys. Both parties confirm that the project deliverables satisfy all agreed requirements, warranties, and commercial terms.
        </p>

        <!-- Signatures -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:30px; margin-top:20px; page-break-inside:avoid;">
          <div style="border-top:1.5px solid #0d2649; padding-top:8px;">
            <b>For RvmAiTech (Vendor Signatory)</b><br>
            <div style="height:32px;"></div>
            <span style="font-size:12.5px; font-weight:700; color:#0d2649;">Vivek Kumar Bhardwaj</span><br>
            <span style="font-size:11px; color:#475569;">Founder &amp; Chief Executive Officer</span><br>
            <span style="font-size:10.5px; color:#64748b;">RvmAiTech · Jaipur, Rajasthan</span>
          </div>

          <div style="border-top:1.5px solid #0d2649; padding-top:8px;">
            <b>For ${esc(clientName)} (Client Acceptance)</b><br>
            <div style="height:32px;"></div>
            <span style="font-size:12.5px; font-weight:700; color:#0d2649;">[ Authorized Signatory ]</span><br>
            <span style="font-size:11px; color:#475569;">Designation: Project Director / Operations Head</span><br>
            <span style="font-size:10.5px; color:#64748b;">Date: ${fmtDate(delivDate)} · Signature &amp; Stamp</span>
          </div>
        </div>
      </div>
    </div>
  `;
  dlg.showModal();
}

ACT['proj-cert'] = el => openHandoverCertificate(S.projects.find(p => p.id === el.dataset.id));

