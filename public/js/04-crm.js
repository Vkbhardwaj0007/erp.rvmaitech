'use strict';
/* ================= CRM: leads & email communications ================= */
const STAGE_TONE = { New: 'info', Contacted: 'info', Qualified: 'warn', Proposal: 'warn', Won: 'good', Lost: 'mute' };

const CRM_EMAIL_TEMPLATES = [
  {
    name: 'Parking System Proposal & Quotation',
    subject: 'Quotation & Project Proposal - Smart Parking Automation | RvmAiTech',
    body: `Dear Client,\n\nThank you for reaching out to RvmAiTech.\n\nWe are pleased to submit our comprehensive Smart Parking Management & Automation Proposal for your facility. Our integrated solution includes RFID boom barriers, ultrasonic parking slot sensors, digital display guidance boards, and real-time cloud analytics.\n\nPlease review the attached requirements and let us know a convenient time for a technical discussion.\n\nLooking forward to working with you.`
  },
  {
    name: 'Site Inspection & Follow-up',
    subject: 'Follow-up regarding Site Inspection & Parking Automation Setup | RvmAiTech',
    body: `Dear Client,\n\nI hope this email finds you well.\n\nI am writing to follow up on our recent discussion regarding your parking infrastructure and automation requirements. We would like to schedule a site inspection visit to evaluate the entry/exit points, cabling layout, and sensor placement.\n\nPlease let us know your availability for this week.`
  },
  {
    name: 'Meeting Scheduled / Confirmation',
    subject: 'Meeting Confirmation: Smart Parking Project Discussion | RvmAiTech',
    body: `Dear Client,\n\nThis is to confirm our scheduled meeting to discuss your commercial parking automation project and scope of work.\n\nIf you need to invite additional team members or reschedule, please feel free to let us know.\n\nWe look forward to meeting with you.`
  },
  {
    name: 'Thank You & Company Introduction',
    subject: 'Thank you for connecting with RvmAiTech - Smart Automation Solutions',
    body: `Dear Client,\n\nThank you for expressing interest in RvmAiTech's enterprise solutions. We specialize in cutting-edge Smart Parking, IoT telemetry, ERP automation, and facility management systems.\n\nOur team is at your disposal for any queries or tailored product demonstrations.\n\nHave a great day ahead!`
  }
];

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
      const res = await api('POST', '/api/crm/send-email', {
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

function followCell(l) {
  if (!l.followUp || !OPEN_STAGES.includes(l.stage)) return '<span class="muted">—</span>';
  const d = dayDiff(today(), l.followUp);
  return `<span class="nowrap">${fmtDay(l.followUp)}</span> ${d < 0 ? stamp(plural(-d, 'day') + ' late', 'bad') : d === 0 ? stamp('Today', 'warn') : ''}`;
}

V['crm-leads'] = D => {
  const q = query('crm-leads'), f = S.ui.filter.stage || '';
  const rows = S.leads.filter(l => matches(q, l.name, l.company, l.phone, l.email, l.source) && (!f || l.stage === f))
    .sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage) || String(a.followUp || '9').localeCompare(String(b.followUp || '9')));
  const open = S.leads.filter(l => OPEN_STAGES.includes(l.stage));

  const body = rows.map(l => `
    <tr>
      <td>
        <b>${esc(l.name)}</b>
        <span class="sub">${esc(l.company || '')}</span>
      </td>
      <td class="nowrap">
        <div>${esc(l.phone || '—')}</div>
        ${l.email ? `<span class="sub">${esc(l.email)}</span>` : ''}
      </td>
      <td>${esc(l.source || '—')}</td>
      <td>
        ${can('crm') ? `<select class="inline" id="stage-${esc(l.id)}" data-change="lead-stage" data-id="${esc(l.id)}" aria-label="Stage for ${esc(l.name)}">${STAGES.map(s => `<option${s === l.stage ? ' selected' : ''}>${s}</option>`).join('')}</select>` : stamp(l.stage, STAGE_TONE[l.stage])}
      </td>
      <td class="num">${inr(l.value)}</td>
      <td>${esc(empName(D, l.ownerId))}</td>
      <td>${followCell(l)}</td>
      <td class="acts">
        <button class="link-btn" data-action="crm-email-lead" data-id="${esc(l.id)}" style="font-weight:700;color:var(--accent,#0284c7)" title="Send email from rvmaitech2026@gmail.com">📧 Email</button>
        <button class="link-btn" data-action="quote-lead" data-id="${esc(l.id)}" style="font-weight:700;color:#f97316;margin-left:4px" title="Generate Official Quotation">📄 Quotation</button>
        ${W('crm', `${l.stage === 'Won' && !l.customerId ? `<button class="link-btn" data-action="lead-convert" data-id="${esc(l.id)}">Make customer</button> ` : ''}<button class="link-btn" data-action="lead-edit" data-id="${esc(l.id)}">Edit</button> <button class="link-btn danger" data-action="lead-del" data-id="${esc(l.id)}">Delete</button>`)}
        ${l.customerId ? ` ${stamp('Customer', 'good')}` : ''}
      </td>
    </tr>`);

  return head('CRM', 'Leads', `<b>${open.length}</b> open leads worth <b>${inr(sum(open, l => l.value))}</b> · <b>${D.attn.follow.length}</b> follow-ups due`,
      `<button class="btn" data-action="crm-email-direct">📧 Compose Client Email</button>`
      + W('crm', '<button class="btn btn-primary" data-action="lead-new">Add lead</button>'))
    + `<div class="toolbar">${searchBox('crm-leads', 'Search name, company, email or phone')}${filterSel('stage', 'All stages', STAGES)}</div>`
    + (S.leads.length === 0 ? empty('No leads yet', 'Add enquiries here, set follow-ups, and send emails directly from rvmaitech2026@gmail.com.', W('crm', '<button class="btn btn-primary" data-action="lead-new">Add lead</button>'))
      : rows.length === 0 ? empty('Nothing matches', 'Try a different search or stage.')
      : table(['Lead', 'Contact', 'Source', 'Stage', { n: 'Deal value' }, 'Owner', 'Follow-up', ''], body));
};

function leadForm(l) {
  openForm({
    title: l ? 'Edit lead' : 'Add lead',
    fields: [
      { name: 'name', label: 'Contact name', required: true },
      { name: 'company', label: 'Company' },
      { name: 'phone', label: 'Phone', type: 'tel' },
      { name: 'email', label: 'Email (for sending quotations & updates)', type: 'email' },
      { name: 'source', label: 'Source', type: 'select', options: SOURCES, value: 'Referral' },
      { name: 'stage', label: 'Stage', type: 'select', options: STAGES, value: 'New' },
      { name: 'value', label: 'Expected deal value (₹)', type: 'number', min: 0, step: 'any', value: 0 },
      { name: 'ownerId', label: 'Owner', type: 'select', placeholder: 'Not assigned', options: activeEmps().map(e => ({ value: e.id, label: e.name })) },
      { name: 'followUp', label: 'Next follow-up', type: 'date' },
      { name: 'note', label: 'Notes', type: 'textarea', full: true }
    ],
    values: l || {},
    onSubmit: v => l ? dbUpdate('leads', l.id, v).then(() => toast('Lead updated'))
      : dbAdd('leads', Object.assign(v, { createdAt: Date.now() })).then(() => toast('Lead added'))
  });
}

ACT['lead-new'] = () => leadForm(null);
ACT['lead-edit'] = el => leadForm(S.leads.find(l => l.id === el.dataset.id));
ACT['lead-del'] = async el => {
  const l = S.leads.find(x => x.id === el.dataset.id); if (!l) return;
  if (await confirmBox('Delete lead?', `${l.name}${l.company ? ' of ' + l.company : ''} will be removed.`)) save(() => dbDelete('leads', l.id), 'Lead deleted');
};
function setStage(id, stage) {
  const l = S.leads.find(x => x.id === id); if (!l || l.stage === stage || !STAGES.includes(stage)) return;
  save(() => dbUpdate('leads', id, { stage }), stage === 'Won' ? `${l.name} marked won. Use "Make customer" to start billing.` : `${l.name} moved to ${stage}`);
}
CHG['lead-stage'] = el => setStage(el.dataset.id, el.value);
ACT['lead-move'] = el => { const l = S.leads.find(x => x.id === el.dataset.id); if (l) setStage(l.id, STAGES[STAGES.indexOf(l.stage) + num(el.dataset.dir)]); };
ACT['lead-convert'] = el => {
  const l = S.leads.find(x => x.id === el.dataset.id); if (!l || l.customerId) return;
  save(async () => {
    const id = await dbAdd('customers', { name: l.name, company: l.company || '', phone: l.phone || '', email: l.email || '', city: '', gstin: '', fromLead: l.id, createdAt: Date.now() });
    await dbUpdate('leads', l.id, { customerId: id });
  }, `${l.company || l.name} is now a customer`);
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
  if (typeof renderQuotationModal === 'function') {
    renderQuotationModal({
      no: 'RVM/QT/2026-27/' + (l.id.slice(-4).toUpperCase()),
      date: today(),
      customer: {
        name: l.name,
        company: l.company || l.name,
        phone: l.phone || '+91 70650 03066',
        email: l.email || 'client@itsybizz.com',
        address: 'DLF Phase 1, Sector-32 Faridabad, Haryana'
      },
      items: [
        { name: 'Industrial ESP32-S3 Control Board With 8-Channel Digital Input & Output (WVSH0557)', hsn: '85371000', qty: 8, rate: Math.max(1000, Math.round(Number(l.value || 36000) / 8)), discount: 3, gst: 18 }
      ],
      paymentTerms: '50% Advance with PO, 50% on Delivery'
    });
  }
};

/* ================= CRM: pipeline ================= */
V['crm-pipeline'] = D => {
  const won = S.leads.filter(l => l.stage === 'Won').length, lost = S.leads.filter(l => l.stage === 'Lost').length;
  const open = S.leads.filter(l => OPEN_STAGES.includes(l.stage));
  const lanes = STAGES.map((s, si) => {
    const ls = S.leads.filter(l => l.stage === s).sort((a, b) => num(b.value) - num(a.value));
    return `
      <section class="lane" data-stage="${s}" aria-label="${s}">
        <div class="lane-head">
          <div class="lane-name"><span>${s}</span><span>${ls.length}</span></div>
          <div class="lane-sum">${inr(sum(ls, l => l.value))}</div>
        </div>
        <div class="lane-body">
          ${ls.map(l => `
            <article class="lead"${can('crm') ? ' draggable="true"' : ''} data-lead="${esc(l.id)}">
              <div class="lead-name">${esc(l.name)}</div>
              <div class="lead-co">${esc(l.company || '')}</div>
              <div class="lead-row">
                <span class="lead-val">${inrShort(l.value)}</span>
                <span>${followCell(l)}</span>
              </div>
              <div class="lead-row" style="margin-top:6px;align-items:center">
                <button class="link-btn" data-action="crm-email-lead" data-id="${esc(l.id)}" style="font-size:11.5px;padding:2px 4px">📧 Email</button>
                <button class="link-btn" data-action="quote-lead" data-id="${esc(l.id)}" style="font-size:11.5px;padding:2px 4px;color:#f97316;margin-left:4px">📄 Quote</button>
                ${W('crm', `
                  <span class="lead-move">
                    <button data-action="lead-move" data-dir="-1" data-id="${esc(l.id)}" aria-label="Move back"${si === 0 ? ' disabled' : ''}>‹</button>
                    <button data-action="lead-move" data-dir="1" data-id="${esc(l.id)}" aria-label="Move forward"${si === STAGES.length - 1 ? ' disabled' : ''}>›</button>
                  </span>`)}
              </div>
            </article>
          `).join('') || '<div class="lane-empty">No leads here</div>'}
        </div>
      </section>`;
  });

  return head('CRM', 'Pipeline', `Open pipeline <b>${inr(sum(open, l => l.value))}</b>${won + lost ? ` · win rate <b>${Math.round(won / (won + lost) * 100)}%</b> of closed leads` : ''}`,
      `<button class="btn" data-action="crm-email-direct">📧 Compose Email</button>`
      + W('crm', '<button class="btn btn-primary" data-action="lead-new">Add lead</button>'))
    + (S.leads.length === 0 ? empty('No leads yet', 'Leads you add show up here by stage, so you can see where every deal stands.', W('crm', '<button class="btn btn-primary" data-action="lead-new">Add lead</button>'))
      : `<div class="board">${lanes.join('')}</div>${W('crm', '<p class="note">Drag a card to another column, or use the arrows on the card.</p>')}`);
};

document.addEventListener('dragstart', ev => { const c = ev.target.closest && ev.target.closest('[data-lead]'); if (c && ev.dataTransfer) { ev.dataTransfer.setData('text/plain', c.dataset.lead); ev.dataTransfer.effectAllowed = 'move'; } });
document.addEventListener('dragover', ev => { const lane = ev.target.closest && ev.target.closest('.lane'); if (lane) { ev.preventDefault(); lane.classList.add('over'); } });
document.addEventListener('dragleave', ev => { const lane = ev.target.closest && ev.target.closest('.lane'); if (lane && !lane.contains(ev.relatedTarget)) lane.classList.remove('over'); });
document.addEventListener('drop', ev => {
  const lane = ev.target.closest && ev.target.closest('.lane'); if (!lane) return;
  ev.preventDefault(); lane.classList.remove('over');
  const id = ev.dataTransfer && ev.dataTransfer.getData('text/plain');
  if (id) setStage(id, lane.dataset.stage);
});

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
  const items = D.attn.follow.slice(0, 6).map(l => { const late = dayDiff(l.followUp, t); return attnItem('#crm-leads', `Follow up with ${esc(l.name)}${late ? `, ${plural(late, 'day')} late` : ' today'}`, `${esc(l.company || '')} · ${esc(l.stage)} · ${inrShort(l.value)} · ${esc(empName(D, l.ownerId))}`, late > 3); });
  toConvert.slice(0, 3).forEach(l => items.push(attnItem('#crm-leads', `${esc(l.name)} is won but not yet a customer`, `${esc(l.company || '')} · ${inrShort(l.value)} · use "Make customer" to start billing`, false)));

  const sentEmails = (S.emailOutbox || []).slice().reverse().slice(0, 5);

  const tiles = `
    <div class="tiles">
      ${tile('Open leads', String(open.length), `${S.leads.filter(l => l.stage === 'New').length} new enquiries`, '#crm-leads')}
      ${tile('Pipeline value', inrShort(sum(open, l => l.value)), 'expected deal value', '#crm-pipeline')}
      ${tile('Official Sender', 'rvmaitech2026@gmail.com', 'Emails sent directly from here', '#crm-home')}
      ${tile('Win rate', won.length + lost ? Math.round(won.length / (won.length + lost) * 100) + '%' : '—', `${won.length} won, ${lost} lost`, '#crm-pipeline')}
    </div>`;

  const stageRows = OPEN_STAGES.map(s => { const ls = S.leads.filter(l => l.stage === s); return { name: s, value: sum(ls, l => l.value), text: `<b>${inrShort(sum(ls, l => l.value))}</b> · ${plural(ls.length, 'lead')}` }; });
  const srcRows = SOURCES.map(s => { const n = S.leads.filter(l => l.source === s).length; return { name: s, value: n, text: `<b>${n}</b>` }; }).filter(r => r.value).sort((a, b) => b.value - a.value);

  return head('CRM', 'CRM Dashboard & Client Communications', `<b>${S.customers.length}</b> customers · <b>${S.leads.length}</b> leads · Official Sender: <b>rvmaitech2026@gmail.com</b>`,
      `<button class="btn btn-primary" data-action="crm-email-direct">📧 Compose Client Email</button>`
      + W('crm', '<button class="btn" data-action="lead-new">Add lead</button>'))
    + (S.leads.length === 0 && S.customers.length === 0 ? empty('No leads or customers yet', 'Add your first enquiry, set a follow-up date, and send quotations directly from rvmaitech2026@gmail.com.', W('crm', '<button class="btn btn-primary" data-action="lead-new">Add lead</button>'))
      : tiles + `<div class="cols">
          <div class="stack">
            <section class="card">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <h2>Recent Emails Sent (from rvmaitech2026@gmail.com)</h2>
                <button class="link-btn" data-action="crm-email-direct">+ New Email</button>
              </div>
              <p class="card-sub">Client communications, proposals & onboarding emails.</p>
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
              <h2>Pipeline by Stage</h2>
              <p class="card-sub">Expected value of open leads.</p>
              ${open.length ? hbars(stageRows) : '<p class="muted">No open leads right now.</p>'}
            </section>
          </div>

          <div class="stack">
            <section class="card">
              <h2>To Do & Follow-ups</h2>
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
