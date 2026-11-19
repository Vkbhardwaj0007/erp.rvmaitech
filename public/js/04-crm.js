'use strict';
/* ================= CRM: leads, client details, process tracker & email communications ================= */
const STAGE_TONE = { New: 'info', Contacted: 'info', Qualified: 'warn', Proposal: 'warn', Won: 'good', Lost: 'bad' };

const CRM_PROCESS_STEPS = [
  {
    key: 'New',
    stepNo: 1,
    short: 'Inquiry Logged',
    title: 'Inquiry & Audit Request',
    desc: 'Client audit / project request received with full plant & contact details.',
    nextHint: 'Client ko call / WhatsApp karke requirement confirm karein aur Audit Date finalize karein.',
    tasks: [
      { id: 'inquiry_logged', label: 'Client inquiry & audit form details recorded' },
      { id: 'details_reviewed', label: 'Industry, machines count & challenges reviewed' }
    ]
  },
  {
    key: 'Contacted',
    stepNo: 2,
    short: 'Discovery & Schedule',
    title: 'Client Contacted & Audit Scheduled',
    desc: 'Initial discussion completed via phone / WhatsApp and On-Site / Online audit slot fixed.',
    nextHint: 'Scheduled date par Technical / Plant Audit complete karein aur OEE / PLC scope finalize karein.',
    tasks: [
      { id: 'client_called', label: 'Initial call / WhatsApp discovery completed' },
      { id: 'audit_scheduled', label: 'On-Site / Online audit date & mode confirmed' }
    ]
  },
  {
    key: 'Qualified',
    stepNo: 3,
    short: 'Technical Audit',
    title: 'Site / Technical Audit & Qualification',
    desc: 'Plant / online technical audit done; machines, challenges & technical BOQ assessed.',
    nextHint: 'Official Techno-Commercial Quotation taiyar karke client ko Email / WhatsApp par bhejein.',
    tasks: [
      { id: 'audit_done', label: 'On-Site / Online technical audit completed' },
      { id: 'scope_finalized', label: 'BOQ, automation scope & solution architecture finalized' }
    ]
  },
  {
    key: 'Proposal',
    stepNo: 4,
    short: 'Quotation & Proposal',
    title: 'Quotation & Commercial Proposal Sent',
    desc: 'Official quotation shared with pricing, delivery timeline & payment terms.',
    nextHint: 'Commercial negotiation close karein aur Purchase Order (PO) / Advance confirmation lein.',
    tasks: [
      { id: 'quote_sent', label: 'Official Quotation / Proposal PDF dispatched' },
      { id: 'commercial_aligned', label: 'Commercial negotiation & terms aligned' }
    ]
  },
  {
    key: 'Won',
    stepNo: 5,
    short: 'Order Confirmed',
    title: 'Order Confirmed & Project Onboarding',
    desc: 'PO received, deal won, client converted to Customer & project execution started.',
    nextHint: 'Process Complete! Customer account active hai aur project delivery shuru ho chuki hai.',
    tasks: [
      { id: 'po_received', label: 'Purchase Order (PO) & advance received' },
      { id: 'customer_onboarded', label: 'Converted to Customer & execution kicked off' }
    ]
  }
];

const CRM_AUDIT_MODES = [
  'On-Site Company / Plant Visit',
  'Online Technical Audit (Video Call)',
  'Hybrid (Online + Site Visit)',
  'Consultation Only'
];

const CRM_INDUSTRIES = [
  'Automotive & Auto Components',
  'Manufacturing & Heavy Engineering',
  'FMCG & Packaging',
  'Pharmaceuticals & Chemicals',
  'Smart Parking & Real Estate',
  'Logistics & Warehousing',
  'Textiles & Plastics',
  'Electronics & Electricals',
  'Food & Beverages',
  'Other'
];

const CRM_EMAIL_TEMPLATES = [
  {
    name: 'Audit Booking Confirmation & Schedule',
    subject: 'Confirmation: Technical / Plant Automation Audit Booking | RvmAiTech',
    body: `Dear Client,\n\nThank you for booking a Technical / Plant Automation Audit with RvmAiTech.\n\nOur engineering team has reviewed your company details and automation objectives. We would like to confirm our audit schedule and align on the technical scope, machine/line details, and key challenges you want to improve.\n\nPlease reply with your confirmation or reach us on WhatsApp at +91 70520 50656.\n\nLooking forward to working with you.`
  },
  {
    name: 'Proposal & Official Quotation',
    subject: 'Official Quotation & Automation Proposal | RvmAiTech',
    body: `Dear Client,\n\nThank you for reaching out to RvmAiTech.\n\nWe are pleased to submit our comprehensive Techno-Commercial Automation Proposal & Quotation tailored for your facility (PLC/MDMS/OEE, IoT Telemetry, and Smart Automation).\n\nPlease review the attached scope and let us know a convenient time for a commercial discussion.\n\nLooking forward to partnering with you.`
  },
  {
    name: 'Site Inspection & Follow-up',
    subject: 'Follow-up regarding Technical Audit & Site Visit | RvmAiTech',
    body: `Dear Client,\n\nI hope this email finds you well.\n\nI am writing to follow up regarding your automation and audit requirements. Our team is ready to conduct the technical inspection to evaluate machine connectivity, PLC/SCADA layout, and improvement ROI.\n\nPlease let us know your availability for this week.`
  },
  {
    name: 'Thank You & Company Introduction',
    subject: 'Thank you for connecting with RvmAiTech - Industrial & Smart Automation',
    body: `Dear Client,\n\nThank you for expressing interest in RvmAiTech's enterprise solutions. We specialize in Industrial Automation (PLC, MDMS, OEE), Smart Parking Systems, IoT Telemetry, and Custom ERP/MES platforms.\n\nOur engineering team is at your disposal for any queries or live technical demonstrations.\n\nHave a great day ahead!`
  }
];

/* Parse all rich client/audit details from both structured fields AND legacy formatted note text */
function parseLeadDetails(l) {
  const note = String((l && l.note) || '');
  const src = String((l && l.source) || '');
  const extractLine = (pattern) => {
    const m = note.match(new RegExp(`(?:^|\\n)\\s*-?\\s*(?:${pattern})\\s*:\\s*([^\\r\\n]+)`, 'i'));
    return m && m[1] ? m[1].trim() : '';
  };

  let auditScope = (l && l.auditScope) || extractLine('Audit\\s*Scope');
  if (!auditScope) {
    const svc = extractLine('Service\\s*\\/\\s*Category');
    if (svc) auditScope = svc.replace(/^\[COMPANY AUDIT\]\s*/i, '').split('—')[0].trim();
  }
  if (!auditScope) {
    const sm = src.match(/Website Audit Booking\s*\((.+)\)$/i);
    if (sm) auditScope = sm[1].trim();
  }

  const auditMode = (l && l.auditMode) || extractLine('Audit\\s*Mode');
  const industry = (l && l.industry) || extractLine('Industry(?:\\s*\\/\\s*Sector)?');
  const location = (l && l.location) || extractLine('Location(?:\\s*\\/\\s*City)?|Plant\\s*\\/\\s*Office\\s*City');
  const machinesCount = (l && l.machinesCount) || extractLine('Facility\\s*Scale\\s*\\/\\s*Machines|No\\.?\\s*of\\s*Machines(?:\\s*\\/\\s*Lines)?');
  const preferredDate = (l && l.preferredDate) || extractLine('Preferred(?:\\s*Audit)?\\s*Date');
  const challenges = (l && l.challenges) || extractLine('Key\\s*Challenges\\s*\\/\\s*Goals|Current\\s*Challenges');
  const timeline = (l && l.timeline) || extractLine('Timeline');
  const company = (l && l.company) || extractLine('Company\\s*\\/\\s*Plant') || '';
  const contactRole = (l && l.contactRole) || '';

  return {
    auditScope: auditScope || '',
    auditMode: auditMode || '',
    industry: industry || '',
    location: location || '',
    machinesCount: machinesCount || '',
    preferredDate: preferredDate || '',
    challenges: challenges || '',
    timeline: timeline || '',
    company,
    contactRole
  };
}

/* Parse & compute live Process Progress (Completed vs Pending) for a lead */
function parseProcessChecks(l) {
  let obj = {};
  if (l && l.processChecks) {
    if (typeof l.processChecks === 'object') obj = Object.assign({}, l.processChecks);
    else { try { obj = JSON.parse(l.processChecks) || {}; } catch (_) { obj = {}; } }
  }
  // Automatically mark tasks of strictly completed prior stages as done unless explicitly false
  const idx = CRM_PROCESS_STEPS.findIndex(s => s.key === (l && l.stage));
  if (idx >= 0) {
    if (obj.inquiry_logged === undefined) obj.inquiry_logged = true;
    for (let i = 0; i < idx; i++) {
      for (const t of CRM_PROCESS_STEPS[i].tasks) {
        if (obj[t.id] === undefined) obj[t.id] = true;
      }
    }
    if (l.stage === 'Won') {
      for (const t of CRM_PROCESS_STEPS[4].tasks) {
        if (t.id === 'po_received' && obj[t.id] === undefined) obj[t.id] = true;
        if (t.id === 'customer_onboarded' && l.customerId) obj[t.id] = true;
      }
    }
  }
  return obj;
}

function getLeadProcessInfo(l) {
  const isLost = l.stage === 'Lost';
  const activeIdx = isLost ? -1 : Math.max(0, CRM_PROCESS_STEPS.findIndex(s => s.key === l.stage));
  const checks = parseProcessChecks(l);
  const allTasks = CRM_PROCESS_STEPS.flatMap(s => s.tasks);
  const doneTasks = allTasks.filter(t => !!checks[t.id]);
  const completedSteps = isLost ? [] : CRM_PROCESS_STEPS.slice(0, l.stage === 'Won' ? 5 : activeIdx);
  const currentStep = isLost ? null : CRM_PROCESS_STEPS[activeIdx];
  const pendingSteps = isLost ? [] : (l.stage === 'Won' ? [] : CRM_PROCESS_STEPS.slice(activeIdx + 1));
  const nextStep = (!isLost && activeIdx >= 0 && activeIdx < CRM_PROCESS_STEPS.length - 1) ? CRM_PROCESS_STEPS[activeIdx + 1] : null;
  const prevStep = (!isLost && activeIdx > 0) ? CRM_PROCESS_STEPS[activeIdx - 1] : null;

  // Progress % blends stage progress & granular checklist completion
  let pct = 0;
  if (isLost) {
    pct = Math.round((doneTasks.length / allTasks.length) * 100);
  } else if (l.stage === 'Won') {
    pct = 100;
  } else {
    const taskPct = Math.round((doneTasks.length / allTasks.length) * 100);
    const stageMin = Math.round((activeIdx / CRM_PROCESS_STEPS.length) * 100) + 10;
    pct = Math.min(95, Math.max(stageMin, taskPct));
  }

  return {
    isLost,
    activeIdx,
    checks,
    allTasks,
    doneTasks,
    completedSteps,
    currentStep,
    pendingSteps,
    nextStep,
    prevStep,
    pct
  };
}

function cleanWaPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length === 10 ? '91' + digits : digits;
}

/* Helper to open Compose Email Modal from rvmaitech2026@gmail.com */
function openCrmEmailModal(targetEmail, targetName, leadId, customerId) {
  dlg.className = 'dlg dlg-wide';
  const defaultTpl = CRM_EMAIL_TEMPLATES[0];

  dlg.innerHTML = `
    <form class="form" id="crmEmailForm">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid var(--rule);padding-bottom:12px;margin-bottom:12px">
        <div>
          <h2 class="dlg-title" style="margin:0">📧 Send Email to Client</h2>
          <p class="dlg-sub" style="margin:2px 0 0">Sent from official address: <b>rvmaitech2026@gmail.com</b></p>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <img src="/logo.png" alt="RvmAiTech" style="height:32px;width:auto;max-width:160px;object-fit:contain;display:block">
          <span class="stamp stamp-good">Official Dispatch</span>
        </div>
      </div>

      <div class="fields">
        <div class="field">
          <label for="cem-from">From Address (Official)</label>
          <input id="cem-from" value="rvmaitech2026@gmail.com (RvmAiTech Official)" readonly style="background:rgba(255,255,255,0.08);color:var(--heading);border:1px solid var(--rule);font-weight:700">
        </div>

        <div class="field">
          <label for="cem-to">Recipient Email (To) <span style="color:var(--bad)">*</span></label>
          <input id="cem-to" name="to" type="email" required value="${esc(targetEmail || '')}" placeholder="client@example.com">
        </div>

        <div class="field field-full">
          <label for="cem-tpl">Select Ready Template (Optional)</label>
          <select id="cem-tpl">
            <option value="">-- Choose an Email Template (Auto-fill) --</option>
            ${CRM_EMAIL_TEMPLATES.map((tpl, i) => `<option value="${i}">${esc(tpl.name)}</option>`).join('')}
          </select>
        </div>

        <div class="field field-full">
          <label for="cem-sub">Subject Line <span style="color:var(--bad)">*</span></label>
          <input id="cem-sub" name="subject" required value="${esc(defaultTpl.subject)}" placeholder="e.g. Quotation & Project Proposal">
        </div>

        <div class="field field-full">
          <label for="cem-body">Email Message Content <span style="color:var(--bad)">*</span></label>
          <textarea id="cem-body" name="message" rows="7" required placeholder="Type your email message...">${esc(defaultTpl.body)}</textarea>
        </div>
      </div>

      <p class="note">This email will be dispatched directly from <b>rvmaitech2026@gmail.com</b> and logged into the CRM history.</p>

      <div class="dlg-actions" style="flex-wrap:wrap">
        <button type="button" class="btn" data-x="cancel">Cancel</button>
        <button type="button" class="btn" id="btnCrmGmailWeb">Open in Gmail Web</button>
        <button type="button" class="btn" id="btnCrmCopyEmail">Copy Message</button>
        <button type="submit" class="btn btn-primary" id="btnCrmSendNow">Send Email Now</button>
      </div>
    </form>`;

  const tplSel = $('#cem-tpl', dlg);
  const subInp = $('#cem-sub', dlg);
  const bodyInp = $('#cem-body', dlg);

  tplSel.addEventListener('change', () => {
    const idx = tplSel.value;
    if (idx !== '') {
      const tpl = CRM_EMAIL_TEMPLATES[idx];
      subInp.value = tpl.subject;
      bodyInp.value = tpl.body;
    }
  });

  $('#btnCrmCopyEmail', dlg).addEventListener('click', () => {
    const txt = `Subject: ${subInp.value}\n\n${bodyInp.value}`;
    copyToClipboard(txt, 'Email message copied to clipboard!');
  });

  $('#btnCrmGmailWeb', dlg).addEventListener('click', () => {
    const to = $('#cem-to', dlg).value.trim();
    const su = subInp.value.trim();
    const bd = bodyInp.value.trim();
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(su)}&body=${encodeURIComponent(bd)}`;
    window.open(gmailUrl, '_blank');
  });

  $('#crmEmailForm', dlg).addEventListener('submit', async ev => {
    ev.preventDefault();
    const form = ev.target;
    const to = form.to.value.trim();
    const subject = form.subject.value.trim();
    const message = form.message.value.trim();

    const sendBtn = $('#btnCrmSendNow', dlg);
    sendBtn.disabled = true; sendBtn.textContent = 'Sending...';

    try {
      await api('POST', '/api/crm/send-email', {
        to,
        subject,
        message,
        leadId: leadId || '',
        customerId: customerId || ''
      });
      closeDlg();
      toast(`Email sent to ${to} from rvmaitech2026@gmail.com!`, 'good');
      await refresh();
    } catch (err) {
      toast(err.message || 'Could not send email.', 'bad');
      sendBtn.disabled = false; sendBtn.textContent = 'Send Email Now';
    }
  });

  dlg.showModal();
}

/* Full Client & Audit Dossier Modal showing EVERY field submitted by client + live process status */
function openLeadDossierModal(l) {
  if (!l) return;
  const info = parseLeadDetails(l);
  const proc = getLeadProcessInfo(l);
  const waNum = cleanWaPhone(l.phone);
  const ownerEmp = (S.employees || []).find(e => e.id === l.ownerId);

  dlg.className = 'dlg dlg-wide';
  dlg.innerHTML = `
    <div class="form">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:2px solid var(--rule);padding-bottom:12px;margin-bottom:14px;flex-wrap:wrap">
        <div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <h2 class="dlg-title" style="margin:0">${esc(info.company || l.name)}</h2>
            ${stamp(l.stage, STAGE_TONE[l.stage] || 'info')}
            <span class="stamp stamp-good" style="font-size:11px">${proc.pct}% Process Complete</span>
          </div>
          <p class="dlg-sub" style="margin:4px 0 0">Contact: <b>${esc(l.name)}</b>${info.contactRole ? ` (${esc(info.contactRole)})` : ''} · Received: ${l.createdAt ? fmtDate(isoOf(new Date(l.createdAt))) : '—'}</p>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${waNum ? `<a class="btn btn-sm" href="https://wa.me/${esc(waNum)}" target="_blank" rel="noopener" style="background:#16a34a;color:#fff;border-color:#16a34a;font-weight:700">💬 WhatsApp</a>` : ''}
          ${l.phone ? `<a class="btn btn-sm" href="tel:${esc(l.phone)}" style="font-weight:700">📞 Call</a>` : ''}
          <button type="button" class="btn btn-sm" id="ld-email">📧 Email</button>
          <button type="button" class="btn btn-sm" id="ld-quote" style="background:#f97316;color:#fff;border-color:#f97316;font-weight:700">📄 Quotation</button>
        </div>
      </div>

      <!-- 1. Complete Audit & Technical Requirement Details (All Website Form Fields) -->
      <div style="background:rgba(2,132,199,0.08);border:1.5px solid rgba(56,189,248,0.3);border-radius:10px;padding:14px;margin-bottom:14px">
        <div style="font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#38bdf8;margin-bottom:10px">🏭 Complete Client Audit &amp; Requirement Details</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:10px">
          <div class="crm-detail-box" style="grid-column:1 / -1">
            <span class="crm-detail-lbl">What would you like us to Audit / Scope</span>
            <b style="font-size:14px;color:var(--ink)">${esc(info.auditScope || l.source || 'Not specified')}</b>
          </div>
          <div class="crm-detail-box">
            <span class="crm-detail-lbl">Preferred Audit Mode</span>
            <b>${info.auditMode ? (/online|video/i.test(info.auditMode) ? '💻 ' : '🏭 ') + esc(info.auditMode) : 'Not specified'}</b>
          </div>
          <div class="crm-detail-box">
            <span class="crm-detail-lbl">Company / Organization Name</span>
            <b>${esc(info.company || 'Not specified')}</b>
          </div>
          <div class="crm-detail-box">
            <span class="crm-detail-lbl">Industry / Sector</span>
            <b>${esc(info.industry || 'Not specified')}</b>
          </div>
          <div class="crm-detail-box">
            <span class="crm-detail-lbl">Contact Person Name &amp; Role</span>
            <b>${esc(l.name)}${info.contactRole ? ` — ${esc(info.contactRole)}` : ''}</b>
          </div>
          <div class="crm-detail-box">
            <span class="crm-detail-lbl">Phone / WhatsApp Number</span>
            <b>${l.phone ? `<a href="tel:${esc(l.phone)}" style="color:#38bdf8">${esc(l.phone)}</a>` : 'Not specified'}</b>
          </div>
          <div class="crm-detail-box">
            <span class="crm-detail-lbl">Official Email</span>
            <b>${l.email ? `<a href="mailto:${esc(l.email)}" style="color:#38bdf8">${esc(l.email)}</a>` : 'Not specified'}</b>
          </div>
          <div class="crm-detail-box">
            <span class="crm-detail-lbl">Plant / Office City &amp; State</span>
            <b>📍 ${esc(info.location || 'Not specified')}</b>
          </div>
          <div class="crm-detail-box">
            <span class="crm-detail-lbl">No. of Machines / Lines</span>
            <b>⚙️ ${esc(info.machinesCount || 'Not specified')}</b>
          </div>
          <div class="crm-detail-box">
            <span class="crm-detail-lbl">Preferred Audit Date</span>
            <b>📅 ${info.preferredDate ? fmtDate(info.preferredDate) : 'Not specified'}</b>
          </div>
          <div class="crm-detail-box">
            <span class="crm-detail-lbl">Expected Deal Value &amp; Owner</span>
            <b>${inr(l.value || 0)} · ${esc(ownerEmp ? ownerEmp.name : 'Unassigned')}</b>
          </div>
          <div class="crm-detail-box" style="grid-column:1 / -1">
            <span class="crm-detail-lbl">Current Challenges / What Client Wants to Improve</span>
            <div style="font-size:13px;color:var(--ink);font-weight:600;white-space:pre-wrap;margin-top:2px">${esc(info.challenges || 'No challenges specified')}</div>
          </div>
        </div>
      </div>

      <!-- 2. Live Process Progress Summary -->
      <div style="background:var(--paper);border:1px solid var(--rule);border-radius:10px;padding:14px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
          <div style="font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink)">📊 Process Status — Kaha Tak Hua vs Kya Baki Hai</div>
          <b style="color:#10b981;font-size:13px">${proc.pct}% Complete (${proc.isLost ? 'Closed / Lost' : `Step ${proc.activeIdx + 1} of ${CRM_PROCESS_STEPS.length}`})</b>
        </div>
        <div class="proc-bar-track" style="margin-bottom:12px"><div class="proc-bar-fill" style="width:${proc.pct}%"></div></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:10px">
          <div class="proc-summary-col proc-col-done">
            <div class="proc-col-head">✅ Completed Till Now (Ho Chuka Hai)</div>
            ${proc.doneTasks.length
              ? `<ul>${proc.doneTasks.map(t => `<li>✓ ${esc(t.label)}</li>`).join('')}</ul>`
              : '<div class="muted" style="font-size:12px">Inquiry logged — ready to start discovery call.</div>'}
          </div>
          <div class="proc-summary-col proc-col-pending">
            <div class="proc-col-head">⏳ Pending Steps (Abhi Baki Hai)</div>
            ${proc.isLost
              ? '<div style="font-size:12px;color:#ef4444;font-weight:600">Marked Lost — reopen to resume process.</div>'
              : proc.pendingSteps.length || (proc.allTasks.length - proc.doneTasks.length > 0)
                ? `<ul>${proc.allTasks.filter(t => !proc.checks[t.id]).map(t => `<li>○ ${esc(t.label)}</li>`).join('')}</ul>`
                : '<div style="font-size:12px;color:#10b981;font-weight:700">🎉 All process steps completed!</div>'}
          </div>
        </div>
      </div>

      <div class="dlg-actions" style="flex-wrap:wrap;justify-content:space-between">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" class="btn" id="ld-edit">✏️ Edit All Details</button>
          <button type="button" class="btn" id="ld-open-proc">📊 Open in Process Tracker</button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${can('crm') && proc.nextStep ? `<button type="button" class="btn btn-primary" id="ld-advance">🚀 Advance to: ${esc(proc.nextStep.short)} →</button>` : ''}
          <button type="button" class="btn" data-x="cancel">Close</button>
        </div>
      </div>
    </div>`;

  $('#ld-email', dlg).addEventListener('click', () => { closeDlg(); openCrmEmailModal(l.email, l.name, l.id, null); });
  $('#ld-quote', dlg).addEventListener('click', () => { closeDlg(); ACT['quote-lead']({ dataset: { id: l.id } }); });
  $('#ld-edit', dlg).addEventListener('click', () => { closeDlg(); leadForm(l); });
  $('#ld-open-proc', dlg).addEventListener('click', () => { closeDlg(); location.hash = '#crm-pipeline'; });
  const advBtn = $('#ld-advance', dlg);
  if (advBtn && proc.nextStep) {
    advBtn.addEventListener('click', () => {
      closeDlg();
      setStage(l.id, proc.nextStep.key);
    });
  }
  dlg.showModal();
}

function followCell(l) {
  if (!l.followUp || !OPEN_STAGES.includes(l.stage)) return '<span class="muted">—</span>';
  const d = dayDiff(today(), l.followUp);
  return `<span class="nowrap">${fmtDay(l.followUp)}</span> ${d < 0 ? stamp(plural(-d, 'day') + ' late', 'bad') : d === 0 ? stamp('Today', 'warn') : ''}`;
}

/* ================= CRM: Leads & Full Client Details ================= */
V['crm-leads'] = D => {
  const q = query('crm-leads'), f = S.ui.filter.stage || '';
  const rows = S.leads.filter(l => {
    const info = parseLeadDetails(l);
    return matches(q, l.name, l.company, l.phone, l.email, l.source, info.auditScope, info.industry, info.location, info.challenges) && (!f || l.stage === f);
  }).sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage) || (b.createdAt || 0) - (a.createdAt || 0));

  const open = S.leads.filter(l => OPEN_STAGES.includes(l.stage));

  const body = rows.map(l => {
    const info = parseLeadDetails(l);
    const proc = getLeadProcessInfo(l);
    const waNum = cleanWaPhone(l.phone);
    return `
    <tr style="cursor:pointer" onclick="if(!event.target.closest('button,a,select,input')){ACT['lead-view']({dataset:{id:'${esc(l.id)}'}})}">
      <td style="max-width:210px">
        <b style="font-size:13.5px;color:var(--ink);display:block">${esc(info.company || l.name)}</b>
        <div style="font-size:12px;color:#38bdf8;font-weight:700;margin-top:2px">${esc(l.name)}${info.contactRole ? ` <span style="font-weight:400;color:var(--ink-2)">(${esc(info.contactRole)})</span>` : ''}</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
          ${info.industry ? `<span class="crm-chip">🏭 ${esc(info.industry)}</span>` : ''}
          ${info.location ? `<span class="crm-chip">📍 ${esc(info.location)}</span>` : ''}
        </div>
      </td>
      <td style="max-width:190px">
        <div style="font-size:12.5px;font-weight:600">${l.phone ? `<a href="tel:${esc(l.phone)}" style="color:var(--ink)">${esc(l.phone)}</a>` : '—'}
          ${waNum ? ` <a href="https://wa.me/${esc(waNum)}" target="_blank" rel="noopener" title="Chat on WhatsApp" style="text-decoration:none;font-size:12px">💬</a>` : ''}
        </div>
        ${l.email ? `<div style="font-size:11.5px;color:var(--ink-2);word-break:break-all;margin-top:2px">${esc(l.email)}</div>` : ''}
      </td>
      <td style="max-width:260px">
        <div style="font-size:12px;font-weight:700;color:var(--ink);line-height:1.3">${esc(info.auditScope || l.source || 'General Inquiry')}</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
          ${info.auditMode ? `<span class="crm-chip crm-chip-blue">${/online|video/i.test(info.auditMode) ? '💻' : '🏭'} ${esc(info.auditMode)}</span>` : ''}
          ${info.machinesCount ? `<span class="crm-chip">⚙️ ${esc(info.machinesCount)} Machines</span>` : ''}
          ${info.preferredDate ? `<span class="crm-chip crm-chip-warn">📅 ${fmtDate(info.preferredDate)}</span>` : ''}
        </div>
        ${info.challenges ? `<div style="font-size:11px;color:var(--ink-2);margin-top:4px">🎯 <b>Goal:</b> ${esc(info.challenges.slice(0, 80))}${info.challenges.length > 80 ? '…' : ''}</div>` : ''}
      </td>
      <td style="min-width:150px" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:700;margin-bottom:4px">
          <span style="color:#38bdf8">${proc.isLost ? 'Closed (Lost)' : `Step ${proc.activeIdx + 1}/5`}</span>
          <span style="color:#10b981">${proc.pct}%</span>
        </div>
        <div class="proc-bar-track" style="height:6px;margin-bottom:6px"><div class="proc-bar-fill" style="width:${proc.pct}%"></div></div>
        ${can('crm') ? `<select class="inline" style="width:100%" id="stage-${esc(l.id)}" data-change="lead-stage" data-id="${esc(l.id)}" aria-label="Stage for ${esc(l.name)}">${STAGES.map(s => `<option${s === l.stage ? ' selected' : ''}>${s}</option>`).join('')}</select>` : stamp(l.stage, STAGE_TONE[l.stage])}
      </td>
      <td style="max-width:130px">
        <div style="font-weight:800;color:var(--ink)">${inr(l.value)}</div>
        <div style="font-size:11px;color:var(--ink-2);margin-top:2px">👤 ${esc(empName(D, l.ownerId))}</div>
        <div style="font-size:11px;margin-top:2px">${followCell(l)}</div>
      </td>
      <td class="acts" style="white-space:normal;min-width:135px" onclick="event.stopPropagation()">
        <div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end">
          <button class="btn btn-sm" data-action="lead-view" data-id="${esc(l.id)}" style="background:rgba(56,189,248,0.14);color:#38bdf8;font-weight:700;padding:3px 8px" title="View All Client & Audit Details">👁️ All Details</button>
          <a class="btn btn-sm" href="#crm-pipeline" style="background:rgba(16,185,129,0.14);color:#10b981;font-weight:700;padding:3px 8px" title="Open Process Tracker">📊 Process</a>
          <button class="btn btn-sm" data-action="crm-email-lead" data-id="${esc(l.id)}" style="padding:3px 8px" title="Send email from rvmaitech2026@gmail.com">📧</button>
          <button class="btn btn-sm" data-action="quote-lead" data-id="${esc(l.id)}" style="color:#f97316;font-weight:700;padding:3px 8px" title="Generate Official Quotation">📄 Quote</button>
          ${W('crm', `
            ${l.stage === 'Won' && !l.customerId ? `<button class="btn btn-sm btn-primary" data-action="lead-convert" data-id="${esc(l.id)}" style="padding:3px 8px">✓ Make Customer</button>` : ''}
            <button class="btn btn-sm btn-outline" data-action="lead-edit" data-id="${esc(l.id)}" style="padding:3px 7px" title="Edit Lead">✏️</button>
            <button class="btn btn-sm btn-outline" data-action="lead-del" data-id="${esc(l.id)}" style="padding:3px 7px;color:#ef4444" title="Delete Lead">🗑️</button>
          `)}
          ${l.customerId ? ` ${stamp('Customer', 'good')}` : ''}
        </div>
      </td>
    </tr>`;
  });

  return head('CRM', 'Leads & Client Details', `<b>${open.length}</b> active clients in process worth <b>${inr(sum(open, l => l.value))}</b> · <b>${D.attn.follow.length}</b> follow-ups due`,
      `<a class="btn" href="#crm-pipeline" style="font-weight:700">📊 Open Process Tracker</a>`
      + `<button class="btn" data-action="crm-email-direct">📧 Compose Client Email</button>`
      + W('crm', '<button class="btn btn-primary" data-action="lead-new">+ Add Lead / Client</button>'))
    + `<div class="toolbar">${searchBox('crm-leads', 'Search client, company, city, industry, phone or audit scope')}${filterSel('stage', 'All stages', STAGES)}</div>`
    + (S.leads.length === 0 ? empty('No leads yet', 'Client audit bookings from website and manual leads will appear here with complete details.', W('crm', '<button class="btn btn-primary" data-action="lead-new">+ Add Lead / Client</button>'))
      : rows.length === 0 ? empty('Nothing matches', 'Try a different search or stage.')
      : table(['Client & Company', 'Contact', 'Audit & Requirement Details', 'Process Progress', 'Deal & Follow-up', ''], body));
};

function leadForm(l) {
  const info = l ? parseLeadDetails(l) : {};
  const mergedValues = l ? Object.assign({}, l, {
    company: info.company || l.company || '',
    contactRole: info.contactRole || l.contactRole || '',
    auditScope: info.auditScope || '',
    auditMode: info.auditMode || '',
    industry: info.industry || '',
    location: info.location || '',
    machinesCount: info.machinesCount || '',
    preferredDate: info.preferredDate || '',
    challenges: info.challenges || '',
    timeline: info.timeline || ''
  }) : { stage: 'New', source: 'Website', value: 0 };

  openForm({
    title: l ? `Edit Client & Audit Details — ${l.company || l.name}` : 'Add New Client Lead / Audit Booking',
    wide: true,
    sub: 'Enter complete company, contact, plant audit mode, machine scale, and project challenges.',
    fields: [
      { type: 'heading', label: '👤 1. Client & Organization Details' },
      { name: 'company', label: 'Company / Organization Name', placeholder: 'e.g. V High Tech Technology Pvt Ltd' },
      { name: 'industry', label: 'Industry / Sector', type: 'select', placeholder: 'Select Industry', options: CRM_INDUSTRIES },
      { name: 'name', label: 'Contact Person Name', required: true, placeholder: 'Full name' },
      { name: 'contactRole', label: 'Contact Role / Designation', placeholder: 'e.g. Plant Head, Director, Manager' },
      { name: 'phone', label: 'Phone / WhatsApp Number', type: 'tel', placeholder: '+91 …' },
      { name: 'email', label: 'Official Email', type: 'email', placeholder: 'client@company.com' },
      { name: 'location', label: 'Plant / Office City & State', placeholder: 'e.g. Noida, Uttar Pradesh' },
      { name: 'source', label: 'Lead Source', placeholder: 'Website Audit Booking / Referral / Walk-in' },

      { type: 'heading', label: '🏭 2. Audit & Technical Scope' },
      { name: 'auditScope', label: 'What would you like us to Audit / Requirement', full: true, placeholder: 'e.g. Factory / Plant Automation & OEE Audit (MDMS & PLC)' },
      { name: 'auditMode', label: 'Preferred Audit Mode', type: 'select', placeholder: 'Select Audit Mode', options: CRM_AUDIT_MODES },
      { name: 'machinesCount', label: 'No. of Machines / Lines', placeholder: 'e.g. 10' },
      { name: 'preferredDate', label: 'Preferred Audit Date', type: 'date' },
      { name: 'timeline', label: 'Expected Timeline', placeholder: 'e.g. 30–90 Days' },
      { name: 'challenges', label: 'Current Challenges / What Client Wants to Improve', type: 'textarea', rows: 3, full: true, placeholder: 'Describe current bottlenecks, OEE / PLC / parking requirements...' },

      { type: 'heading', label: '📊 3. Process Stage & Deal Tracking' },
      { name: 'stage', label: 'Current Process Stage', type: 'select', options: STAGES, value: 'New' },
      { name: 'value', label: 'Expected Deal Value (₹)', type: 'number', min: 0, step: 'any', value: 0 },
      { name: 'ownerId', label: 'Assigned Owner', type: 'select', placeholder: 'Not assigned', options: activeEmps().map(e => ({ value: e.id, label: e.name })) },
      { name: 'followUp', label: 'Next Follow-up Date', type: 'date' },
      { name: 'note', label: 'Internal Notes & Remarks', type: 'textarea', rows: 2, full: true }
    ],
    values: mergedValues,
    onSubmit: v => l ? dbUpdate('leads', l.id, v).then(() => toast('Client details updated'))
      : dbAdd('leads', Object.assign(v, { processChecks: JSON.stringify({ inquiry_logged: true }), createdAt: Date.now() })).then(() => toast('Client lead added'))
  });
}

ACT['lead-new'] = () => leadForm(null);
ACT['lead-view'] = el => openLeadDossierModal(S.leads.find(l => l.id === el.dataset.id));
ACT['lead-edit'] = el => leadForm(S.leads.find(l => l.id === el.dataset.id));
ACT['lead-del'] = async el => {
  const l = S.leads.find(x => x.id === el.dataset.id); if (!l) return;
  if (await confirmBox('Delete lead?', `${l.name}${l.company ? ' of ' + l.company : ''} will be removed.`)) save(() => dbDelete('leads', l.id), 'Lead deleted');
};
function setStage(id, stage) {
  const l = S.leads.find(x => x.id === id); if (!l || l.stage === stage || !STAGES.includes(stage)) return;
  const checks = parseProcessChecks(l);
  const targetIdx = CRM_PROCESS_STEPS.findIndex(s => s.key === stage);
  if (targetIdx >= 0) {
    for (let i = 0; i < targetIdx; i++) {
      for (const t of CRM_PROCESS_STEPS[i].tasks) checks[t.id] = true;
    }
    if (stage === 'Won') checks.po_received = true;
  }
  const stepObj = CRM_PROCESS_STEPS.find(s => s.key === stage);
  const label = stepObj ? `Step ${stepObj.stepNo}: ${stepObj.title}` : stage;
  save(() => dbUpdate('leads', id, { stage, processChecks: JSON.stringify(checks) }),
    stage === 'Won' ? `🎉 ${l.company || l.name} — Order Confirmed! Use "Convert to Customer" to start billing.` : `${l.company || l.name} moved to ${label}`);
}
CHG['lead-stage'] = el => setStage(el.dataset.id, el.value);
ACT['lead-set-stage'] = el => setStage(el.dataset.id, el.dataset.stage);
ACT['lead-move'] = el => { const l = S.leads.find(x => x.id === el.dataset.id); if (l) setStage(l.id, STAGES[STAGES.indexOf(l.stage) + num(el.dataset.dir)]); };
CHG['lead-task-toggle'] = el => {
  const id = el.dataset.id, taskId = el.dataset.task;
  const l = S.leads.find(x => x.id === id); if (!l || !taskId) return;
  const checks = parseProcessChecks(l);
  checks[taskId] = !!el.checked;
  save(() => dbUpdate('leads', id, { processChecks: JSON.stringify(checks) }), el.checked ? '✓ Milestone marked completed' : 'Milestone marked pending');
};
ACT['lead-convert'] = el => {
  const l = S.leads.find(x => x.id === el.dataset.id); if (!l || l.customerId) return;
  const info = parseLeadDetails(l);
  const checks = parseProcessChecks(l);
  checks.po_received = true;
  checks.customer_onboarded = true;
  save(async () => {
    const id = await dbAdd('customers', {
      name: l.name,
      company: info.company || l.company || '',
      phone: l.phone || '',
      email: l.email || '',
      city: info.location || '',
      gstin: '',
      fromLead: l.id,
      createdAt: Date.now()
    });
    await dbUpdate('leads', l.id, { customerId: id, stage: 'Won', processChecks: JSON.stringify(checks) });
  }, `${l.company || l.name} is now an active Customer`);
};

/* Actions to trigger email compose */
ACT['crm-email-lead'] = el => {
  const l = S.leads.find(x => x.id === el.dataset.id);
  if (l) openCrmEmailModal(l.email, l.name, l.id, null);
};
ACT['crm-email-cust'] = el => {
  const c = S.customers.find(x => x.id === el.dataset.id);
  if (c) openCrmEmailModal(c.email, c.name, null, c.id);
};
ACT['crm-email-direct'] = () => openCrmEmailModal('', '', null, null);

ACT['quote-lead'] = el => {
  const l = S.leads.find(x => x.id === el.dataset.id);
  if (!l) return;
  const info = parseLeadDetails(l);
  if (typeof renderQuotationModal === 'function') {
    renderQuotationModal({
      no: 'RVM/QT/2026-27/' + (l.id.slice(-4).toUpperCase()),
      date: today(),
      customer: {
        name: l.name,
        company: info.company || l.company || l.name,
        phone: l.phone || '+91 70650 03066',
        email: l.email || 'client@company.com',
        address: info.location || 'Faridabad, Haryana'
      },
      items: [
        { name: info.auditScope || 'Industrial Automation & Control Solution', hsn: '85371000', qty: Math.max(1, Number(info.machinesCount) || 1), rate: Math.max(1000, Math.round(Number(l.value || 50000) / Math.max(1, Number(info.machinesCount) || 1))), discount: 0, gst: 18 }
      ],
      paymentTerms: '50% Advance with PO, 50% on Delivery'
    });
  }
};

/* ================= CRM: Professional Client & Audit Process Tracker ================= */
V['crm-pipeline'] = D => {
  const q = query('crm-pipeline');
  const f = S.ui.filter.procStage || '';

  const allLeads = (S.leads || []).slice().sort((a, b) => {
    const ai = a.stage === 'Lost' ? 99 : STAGES.indexOf(a.stage);
    const bi = b.stage === 'Lost' ? 99 : STAGES.indexOf(b.stage);
    return ai - bi || (b.createdAt || 0) - (a.createdAt || 0);
  });

  const filtered = allLeads.filter(l => {
    const info = parseLeadDetails(l);
    return matches(q, l.name, l.company, l.phone, l.email, info.auditScope, info.industry, info.location, info.challenges) && (!f || l.stage === f);
  });

  const open = allLeads.filter(l => OPEN_STAGES.includes(l.stage));
  const won = allLeads.filter(l => l.stage === 'Won');
  const lost = allLeads.filter(l => l.stage === 'Lost');
  const pendingAudits = allLeads.filter(l => l.stage === 'New' || l.stage === 'Contacted');
  const pendingQuotes = allLeads.filter(l => l.stage === 'Qualified' || l.stage === 'Proposal');
  const avgPct = allLeads.length ? Math.round(allLeads.reduce((s, l) => s + getLeadProcessInfo(l).pct, 0) / allLeads.length) : 0;

  const kpiStrip = `
    <div class="proc-kpis">
      <div class="proc-kpi">
        <span class="proc-kpi-lbl">Active Clients in Process</span>
        <b class="proc-kpi-val">${open.length}</b>
        <span class="proc-kpi-sub">${allLeads.length} total · Avg ${avgPct}% done</span>
      </div>
      <div class="proc-kpi">
        <span class="proc-kpi-lbl">Audit Pending / Scheduled</span>
        <b class="proc-kpi-val" style="color:#38bdf8">${pendingAudits.length}</b>
        <span class="proc-kpi-sub">Inquiry &amp; Discovery stages</span>
      </div>
      <div class="proc-kpi">
        <span class="proc-kpi-lbl">Audit Done / Proposal Pending</span>
        <b class="proc-kpi-val" style="color:#f59e0b">${pendingQuotes.length}</b>
        <span class="proc-kpi-sub">Quotation &amp; Commercial stages</span>
      </div>
      <div class="proc-kpi">
        <span class="proc-kpi-lbl">Orders Confirmed (Won)</span>
        <b class="proc-kpi-val" style="color:#10b981">${won.length}</b>
        <span class="proc-kpi-sub">Open Value: ${inrShort(sum(open, l => l.value))}${won.length + lost.length ? ` · ${Math.round(won.length / (won.length + lost.length) * 100)}% Win` : ''}</span>
      </div>
    </div>`;

  const processCards = filtered.map(l => {
    const info = parseLeadDetails(l);
    const proc = getLeadProcessInfo(l);
    const waNum = cleanWaPhone(l.phone);
    const remainingTasks = proc.allTasks.filter(t => !proc.checks[t.id]);

    const stepperHtml = CRM_PROCESS_STEPS.map((st, idx) => {
      const isDone = !proc.isLost && (l.stage === 'Won' ? true : idx < proc.activeIdx);
      const isCurrent = !proc.isLost && l.stage !== 'Won' && idx === proc.activeIdx;
      const cls = isDone ? 'done' : isCurrent ? 'current' : 'pending';
      return `
        <button type="button" class="proc-step proc-step-${cls}" ${can('crm') ? `data-action="lead-set-stage" data-id="${esc(l.id)}" data-stage="${esc(st.key)}"` : 'disabled'} title="Click to set stage: Step ${st.stepNo} - ${esc(st.title)}">
          <div class="proc-step-circle">${isDone ? '✓' : st.stepNo}</div>
          <div class="proc-step-meta">
            <div class="proc-step-tag">${isDone ? 'DONE' : isCurrent ? 'IN PROGRESS' : 'PENDING'}</div>
            <div class="proc-step-title">${esc(st.short)}</div>
          </div>
        </button>`;
    }).join('<div class="proc-step-line"></div>');

    return `
      <article class="proc-card${proc.isLost ? ' proc-card-lost' : l.stage === 'Won' ? ' proc-card-won' : ''}">
        <!-- Card Top Header -->
        <div class="proc-card-head">
          <div style="min-width:0;flex:1">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <h3 class="proc-client-title">${esc(info.company || l.name)}</h3>
              ${stamp(proc.isLost ? 'Closed / Lost' : (proc.currentStep ? `Step ${proc.currentStep.stepNo}: ${proc.currentStep.short}` : l.stage), STAGE_TONE[l.stage] || 'info')}
              ${l.customerId ? stamp('Active Customer ✓', 'good') : ''}
            </div>
            <div class="proc-client-sub">
              <span>👤 <b>${esc(l.name)}</b>${info.contactRole ? ` (${esc(info.contactRole)})` : ''}</span>
              ${l.phone ? `<span>· 📞 <a href="tel:${esc(l.phone)}">${esc(l.phone)}</a>${waNum ? ` <a href="https://wa.me/${esc(waNum)}" target="_blank" rel="noopener" title="WhatsApp">💬</a>` : ''}</span>` : ''}
              ${l.email ? `<span>· ✉️ <a href="mailto:${esc(l.email)}">${esc(l.email)}</a></span>` : ''}
              <span>· Owner: <b>${esc(empName(D, l.ownerId))}</b></span>
            </div>
          </div>

          <div class="proc-head-right">
            <div class="proc-pct-pill" style="${proc.pct === 100 ? 'border-color:#10b981;color:#10b981' : proc.isLost ? 'border-color:#ef4444;color:#ef4444' : ''}">
              <span class="proc-pct-num">${proc.pct}%</span>
              <span class="proc-pct-lbl">${proc.isLost ? 'Closed' : l.stage === 'Won' ? 'Completed' : `Step ${proc.activeIdx + 1} / 5`}</span>
            </div>
            <div style="text-align:right">
              <div style="font-size:15px;font-weight:800;color:var(--ink)">${inr(l.value || 0)}</div>
              <div style="font-size:11px;color:var(--ink-2)">Follow-up: ${followCell(l)}</div>
            </div>
          </div>
        </div>

        <!-- Client Audit & Technical Specs Strip (ALL Details Visible) -->
        <div class="proc-specs-strip">
          <div class="proc-spec"><span class="proc-spec-lbl">Audit / Scope</span><b>${esc(info.auditScope || l.source || 'General Inquiry')}</b></div>
          <div class="proc-spec"><span class="proc-spec-lbl">Audit Mode</span><b>${info.auditMode ? (/online|video/i.test(info.auditMode) ? '💻 ' : '🏭 ') + esc(info.auditMode) : '—'}</b></div>
          <div class="proc-spec"><span class="proc-spec-lbl">Industry</span><b>${esc(info.industry || '—')}</b></div>
          <div class="proc-spec"><span class="proc-spec-lbl">Plant / City</span><b>📍 ${esc(info.location || '—')}</b></div>
          <div class="proc-spec"><span class="proc-spec-lbl">Machines / Lines</span><b>⚙️ ${esc(info.machinesCount || '—')}</b></div>
          <div class="proc-spec"><span class="proc-spec-lbl">Preferred Date</span><b>📅 ${info.preferredDate ? fmtDate(info.preferredDate) : '—'}</b></div>
          <div class="proc-spec" style="flex:1.4;min-width:160px"><span class="proc-spec-lbl">Challenges / Goal</span><b>🎯 ${esc(info.challenges || '—')}</b></div>
        </div>

        <!-- Progress Bar + 5-Stage Visual Process Stepper -->
        <div class="proc-stepper-wrap">
          <div class="proc-bar-track" style="margin-bottom:12px"><div class="proc-bar-fill" style="width:${proc.pct}%"></div></div>
          <div class="proc-stepper">${stepperHtml}</div>
        </div>

        <!-- Two-Column Professional Breakdown: Kaha Tak Hua (Done) vs Kya-Kya Baki Hai (Pending) -->
        <div class="proc-breakdown">
          <!-- Column 1: Completed So Far -->
          <div class="proc-panel proc-panel-done">
            <div class="proc-panel-head">
              <span>✅ Kaha Tak Hua (Completed Steps)</span>
              <span class="proc-panel-count">${proc.doneTasks.length} / ${proc.allTasks.length} tasks</span>
            </div>
            <div class="proc-checklist">
              ${proc.doneTasks.length
                ? proc.doneTasks.map(t => `
                  <label class="proc-chk proc-chk-done">
                    <input type="checkbox" checked ${can('crm') ? `data-change="lead-task-toggle" data-id="${esc(l.id)}" data-task="${esc(t.id)}"` : 'disabled'}>
                    <span>${esc(t.label)}</span>
                  </label>`).join('')
                : '<div class="muted" style="font-size:12px">No milestones ticked yet.</div>'}
            </div>
          </div>

          <!-- Column 2: Pending / Remaining -->
          <div class="proc-panel proc-panel-pending">
            <div class="proc-panel-head">
              <span>⏳ Kya-Kya Baki Hai (Remaining Process)</span>
              <span class="proc-panel-count">${remainingTasks.length} pending</span>
            </div>
            ${!proc.isLost && proc.currentStep ? `
              <div class="proc-next-callout">
                <b>Next Action (${esc(proc.currentStep.title)}):</b> ${esc(proc.currentStep.nextHint)}
              </div>` : ''}
            <div class="proc-checklist">
              ${proc.isLost
                ? '<div style="font-size:12px;color:#ef4444;font-weight:600">This client process is marked Lost. Click "Reopen Process" below to resume.</div>'
                : remainingTasks.length
                  ? remainingTasks.map(t => `
                    <label class="proc-chk">
                      <input type="checkbox" ${can('crm') ? `data-change="lead-task-toggle" data-id="${esc(l.id)}" data-task="${esc(t.id)}"` : 'disabled'}>
                      <span>${esc(t.label)}</span>
                    </label>`).join('')
                  : '<div style="font-size:12.5px;color:#10b981;font-weight:700">🎉 Sabhi steps complete ho chuke hain! Client fully onboarded.</div>'}
            </div>
          </div>
        </div>

        <!-- Action Footer -->
        <div class="proc-card-foot">
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-sm" data-action="lead-view" data-id="${esc(l.id)}" style="background:rgba(56,189,248,0.14);color:#38bdf8;font-weight:700">👁️ All Client Details</button>
            <button class="btn btn-sm" data-action="crm-email-lead" data-id="${esc(l.id)}">📧 Send Email</button>
            <button class="btn btn-sm" data-action="quote-lead" data-id="${esc(l.id)}" style="color:#f97316;font-weight:700">📄 Quotation</button>
            ${W('crm', `<button class="btn btn-sm btn-outline" data-action="lead-edit" data-id="${esc(l.id)}">✏️ Edit</button>`)}
          </div>
          ${W('crm', `
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
              ${proc.isLost
                ? `<button class="btn btn-sm btn-primary" data-action="lead-set-stage" data-id="${esc(l.id)}" data-stage="New">🔄 Reopen Process</button>`
                : `
                  ${proc.prevStep ? `<button class="btn btn-sm btn-outline" data-action="lead-set-stage" data-id="${esc(l.id)}" data-stage="${esc(proc.prevStep.key)}">← Back: ${esc(proc.prevStep.short)}</button>` : ''}
                  ${proc.nextStep ? `<button class="btn btn-sm btn-primary" data-action="lead-set-stage" data-id="${esc(l.id)}" data-stage="${esc(proc.nextStep.key)}" style="font-weight:700">🚀 Next Step: ${esc(proc.nextStep.short)} →</button>` : ''}
                  ${l.stage === 'Won' && !l.customerId ? `<button class="btn btn-sm btn-primary" data-action="lead-convert" data-id="${esc(l.id)}" style="background:#059669;border-color:#059669;font-weight:700">✓ Convert to Customer</button>` : ''}
                  ${l.stage !== 'Won' ? `<button class="btn btn-sm btn-outline" data-action="lead-set-stage" data-id="${esc(l.id)}" data-stage="Lost" style="color:#ef4444">✕ Mark Lost</button>` : ''}
                `}
            </div>
          `)}
        </div>
      </article>`;
  });

  return head('CRM', 'Client & Audit Process Tracker', `Track every client step-by-step: <b>Completed vs Pending</b> · Active value <b>${inr(sum(open, l => l.value))}</b>`,
      `<a class="btn" href="#crm-leads">📋 Leads Table</a>`
      + `<button class="btn" data-action="crm-email-direct">📧 Compose Email</button>`
      + W('crm', '<button class="btn btn-primary" data-action="lead-new">+ Add Lead / Client</button>'))
    + (allLeads.length === 0
      ? empty('No active client processes yet', 'Website audit bookings and new leads appear here with step-by-step completion tracking.', W('crm', '<button class="btn btn-primary" data-action="lead-new">+ Add Lead / Client</button>'))
      : kpiStrip
        + `<div class="toolbar">${searchBox('crm-pipeline', 'Search company, client, city, industry or audit scope')}${filterSel('procStage', 'All process stages', STAGES)}</div>`
        + (filtered.length === 0
          ? empty('No matching clients', 'Try changing your search or stage filter.')
          : `<div class="proc-list">${processCards.join('')}</div>`));
};

/* ================= CRM: customers ================= */
V['crm-customers'] = D => {
  const q = query('crm-customers');
  const rows = S.customers.filter(c => matches(q, c.name, c.company, c.phone, c.email, c.city, c.gstin)).sort((a, b) => custLabel(a).localeCompare(custLabel(b)));

  const body = rows.map(c => {
    const inv = S.invoices.filter(i => i.customerId === c.id), out = sum(inv, balanceOf);
    return `
      <tr>
        <td>
          <b>${esc(custLabel(c))}</b>
          <span class="sub">${esc(c.company ? c.name : '')}</span>
        </td>
        <td class="nowrap">
          <div>${esc(c.phone || '—')}</div>
          ${c.email ? `<span class="sub">${esc(c.email)}</span>` : ''}
        </td>
        <td>${esc(c.city || '—')}</td>
        <td class="mono">${esc(c.gstin || '—')}</td>
        <td class="num">${inv.length}</td>
        <td class="num">${inr(sum(inv, i => i.total))}</td>
        <td class="num${out ? ' due' : ''}">${out ? inr(out) : '—'}</td>
        <td class="acts">
          <button class="link-btn" data-action="crm-email-cust" data-id="${esc(c.id)}" style="font-weight:700;color:var(--accent,#0284c7)">📧 Email</button>
          ${W('erp', `<button class="link-btn" data-action="inv-new" data-customer="${esc(c.id)}">New invoice</button> `)}
          ${W('crm', `<button class="link-btn" data-action="cust-edit" data-id="${esc(c.id)}">Edit</button> <button class="link-btn danger" data-action="cust-del" data-id="${esc(c.id)}">Delete</button>`)}
        </td>
      </tr>`;
  });

  return head('CRM', 'Customers', `<b>${S.customers.length}</b> customers · <b>${inr(sum(S.invoices, balanceOf))}</b> outstanding`,
      `<button class="btn" data-action="crm-email-direct">📧 Compose Email</button>`
      + W('crm', '<button class="btn btn-primary" data-action="cust-new">Add customer</button>'))
    + `<div class="toolbar">${searchBox('crm-customers', 'Search name, company, email, city or GSTIN')}</div>`
    + (S.customers.length === 0 ? empty('No customers yet', 'Add customers here, or mark a lead as won and turn it into a customer in one click.', W('crm', '<button class="btn btn-primary" data-action="cust-new">Add customer</button>'))
      : rows.length === 0 ? empty('Nothing matches', 'Try a different search.')
      : table(['Customer', 'Contact', 'City', 'GSTIN', { n: 'Invoices' }, { n: 'Billed' }, { n: 'Outstanding' }, ''], body));
};

function customerForm(c) {
  openForm({
    title: c ? 'Edit customer' : 'Add customer',
    fields: [
      { name: 'name', label: 'Contact name', required: true },
      { name: 'company', label: 'Company / shop name' },
      { name: 'phone', label: 'Phone', type: 'tel' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'city', label: 'City' },
      { name: 'gstin', label: 'GSTIN', placeholder: '15 characters' }
    ],
    values: c || {},
    onSubmit: v => {
      v.gstin = v.gstin.toUpperCase();
      if (v.gstin && !/^[0-9A-Z]{15}$/.test(v.gstin)) throw new UserError('A GSTIN has 15 letters and digits. Check it, or leave it empty.');
      return c ? dbUpdate('customers', c.id, v).then(() => toast('Customer updated'))
        : dbAdd('customers', Object.assign(v, { createdAt: Date.now() })).then(() => toast('Customer added'));
    }
  });
}
ACT['cust-new'] = () => customerForm(null);
ACT['cust-edit'] = el => customerForm(S.customers.find(c => c.id === el.dataset.id));
ACT['cust-del'] = async el => {
  const c = S.customers.find(x => x.id === el.dataset.id); if (!c) return;
  const n = S.invoices.filter(i => i.customerId === c.id).length;
  if (n) return toast(`${custLabel(c)} has ${plural(n, 'invoice')}. Delete those first.`, 'bad');
  if (await confirmBox('Delete customer?', `${custLabel(c)} will be removed.`)) save(() => dbDelete('customers', c.id), 'Customer deleted');
};

/* ================= CRM: dashboard ================= */
V['crm-home'] = D => {
  const open = S.leads.filter(l => OPEN_STAGES.includes(l.stage));
  const won = S.leads.filter(l => l.stage === 'Won'), lost = S.leads.filter(l => l.stage === 'Lost').length;
  const toConvert = won.filter(l => !l.customerId);
  const t = today();
  const items = D.attn.follow.slice(0, 6).map(l => { const late = dayDiff(l.followUp, t); return attnItem('#crm-pipeline', `Follow up with ${esc(l.name)}${late ? `, ${plural(late, 'day')} late` : ' today'}`, `${esc(l.company || '')} · ${esc(l.stage)} · ${inrShort(l.value)} · ${esc(empName(D, l.ownerId))}`, late > 3); });
  toConvert.slice(0, 3).forEach(l => items.push(attnItem('#crm-pipeline', `${esc(l.name)} is won but not yet a customer`, `${esc(l.company || '')} · ${inrShort(l.value)} · use "Convert to Customer" to start billing`, false)));

  const sentEmails = (S.emailOutbox || []).slice().reverse().slice(0, 5);

  const tiles = `
    <div class="tiles">
      ${tile('Active Clients', String(open.length), `${S.leads.filter(l => l.stage === 'New').length} new audit requests`, '#crm-leads')}
      ${tile('Process Tracker', inrShort(sum(open, l => l.value)), `${open.length} clients in process`, '#crm-pipeline')}
      ${tile('Official Sender', 'rvmaitech2026@gmail.com', 'Emails sent directly from here', '#crm-home')}
      ${tile('Win Rate', won.length + lost ? Math.round(won.length / (won.length + lost) * 100) + '%' : '—', `${won.length} won, ${lost} lost`, '#crm-pipeline')}
    </div>`;

  const stageRows = CRM_PROCESS_STEPS.slice(0, 4).map(st => {
    const ls = S.leads.filter(l => l.stage === st.key);
    return { name: `Step ${st.stepNo}: ${st.short}`, value: Math.max(ls.length, sum(ls, l => l.value)), text: `<b>${plural(ls.length, 'client')}</b> · ${inrShort(sum(ls, l => l.value))}` };
  });
  const srcCounts = {};
  for (const l of S.leads) {
    const k = /website audit/i.test(l.source || '') ? 'Website Audit Booking' : (l.source || 'Other');
    srcCounts[k] = (srcCounts[k] || 0) + 1;
  }
  const srcRows = Object.entries(srcCounts).map(([name, value]) => ({ name, value, text: `<b>${value}</b>` })).sort((a, b) => b.value - a.value);

  return head('CRM', 'CRM Dashboard & Client Communications', `<b>${S.customers.length}</b> customers · <b>${S.leads.length}</b> leads · Official Sender: <b>rvmaitech2026@gmail.com</b>`,
      `<a class="btn" href="#crm-pipeline" style="font-weight:700">📊 Process Tracker</a>`
      + `<button class="btn btn-primary" data-action="crm-email-direct">📧 Compose Client Email</button>`
      + W('crm', '<button class="btn" data-action="lead-new">+ Add Lead</button>'))
    + (S.leads.length === 0 && S.customers.length === 0 ? empty('No leads or customers yet', 'Add your first enquiry, track every process step, and send quotations directly from rvmaitech2026@gmail.com.', W('crm', '<button class="btn btn-primary" data-action="lead-new">+ Add Lead</button>'))
      : tiles + `<div class="cols">
          <div class="stack">
            <section class="card">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <h2>Recent Emails Sent (from rvmaitech2026@gmail.com)</h2>
                <button class="link-btn" data-action="crm-email-direct">+ New Email</button>
              </div>
              <p class="card-sub">Client communications, proposals &amp; onboarding emails.</p>
              ${sentEmails.length ? `
                <table class="mini">
                  <thead><tr><th>To</th><th>Subject</th><th>Sent By</th><th class="num">Time</th></tr></thead>
                  <tbody>
                    ${sentEmails.map(m => `
                      <tr>
                        <td><b>${esc(m.to)}</b></td>
                        <td>${esc(m.subject)}</td>
                        <td>${esc(m.sentBy || 'Staff')}</td>
                        <td class="num">${fmtDate(isoOf(new Date(m.sentAt)))}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : '<p class="muted">No emails logged yet. Click Compose Client Email above to send your first message.</p>'}
            </section>

            <section class="card">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                <h2>Process Stage Breakdown</h2>
                <a class="link-btn" href="#crm-pipeline">Open Process Tracker →</a>
              </div>
              <p class="card-sub">Active clients across every step of the audit &amp; sales process.</p>
              ${open.length ? hbars(stageRows) : '<p class="muted">No active clients in process right now.</p>'}
            </section>
          </div>

          <div class="stack">
            <section class="card">
              <h2>To Do &amp; Follow-ups</h2>
              <p class="card-sub">Follow-ups due and deals waiting for action.</p>
              ${attnList(items, 'All clear. No follow-ups are due.')}
            </section>

            <section class="card">
              <h2>Where Leads Come From</h2>
              <p class="card-sub">Count of all leads by source.</p>
              ${srcRows.length ? hbars(srcRows) : '<p class="muted">No leads yet.</p>'}
            </section>
          </div>
        </div>`);
};
