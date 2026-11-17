'use strict';
/* ================= HRMS: employees ================= */
function tenure(joined) {
  const d = parseISO(joined); if (!d) return '';
  const now = new Date(); let months = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth() - (now.getDate() < d.getDate() ? 1 : 0);
  if (months < 1) return 'joined this month';
  const y = Math.floor(months / 12), m = months % 12;
  return [y ? plural(y, 'year') : '', m ? plural(m, 'month') : ''].filter(Boolean).join(' ') + ' with the company';
}

/* ================= Official Letters: Offer Letter & Joining Letter ================= */
/* ================= Official Letters: Offer Letter & Joining Letter ================= */
function renderOfferLetterHtml(e, company) {
  if (!e) return '';
  const coName = 'RvmAiTech';
  const gross = Number(e.salary || 0);
  const basic = Math.round(gross * 0.5);
  const hra = Math.round(gross * 0.3);
  const allowance = Math.max(0, gross - basic - hra);
  const pf = Math.round(basic * 0.12);
  const annualCtc = gross * 12;
  const year = new Date().getFullYear();
  const refNo = `RVM/HR/OFFER/${year}/${e.code || '0001'}`;
  const candFirstName = (e.name || '').trim().split(/\s+/)[0] || 'Candidate';
  const deadline = fmtDate(addDays(today(), 7));

  return `
  <div class="letter-sheet" id="printableArea">
    <!-- Official Header with Clean Brand Logo -->
    <div class="letter-head" style="align-items:center;border-bottom:2px solid #0d2649;padding-bottom:14px;margin-bottom:18px">
      <div class="letter-brand">
        <div class="letterhead-logo-wrap">
          <img src="/logo-light.png?v=20261115" alt="RvmAiTech" style="height:48px;width:auto;max-width:220px;object-fit:contain;display:block">
        </div>
        <div class="letter-corp-sub" style="margin-top:6px;font-size:11px;font-weight:700;color:#0d2649;letter-spacing:.05em">
          RvmAiTech Solutions Private Limited · CIN: U72900RJ2026PTC089123
        </div>
        <div style="font-size:10.5px;color:#64748b;margin-top:2px">
          Cyber City, Mansarovar, Jaipur, Rajasthan - 302020 | rvmaitech2026@gmail.com | +91 7052050656
        </div>
      </div>
      <div class="letter-meta-right" style="text-align:right">
        <div class="letter-badge" style="background:#0d2649;color:#ffffff;font-size:12px;font-weight:800;padding:5px 12px;border-radius:4px;letter-spacing:.04em;display:inline-block;margin-bottom:6px">
          EMPLOYMENT OFFER LETTER
        </div>
        <div class="letter-date" style="font-size:12px;color:#475569">Date: <b>${fmtDate(today())}</b></div>
        <div class="letter-ref" style="font-family:monospace;font-size:11px;color:#0d2649;margin-top:2px">Ref: ${esc(refNo)}</div>
      </div>
    </div>

    <!-- Candidate & Offer Metadata Table -->
    <table class="letter-grid-table" style="margin-bottom:16px">
      <tr><td class="label-col">Date</td><td><b>${fmtDate(today())}</b></td><td class="label-col">Offer Reference</td><td><code>${esc(refNo)}</code></td></tr>
      <tr><td class="label-col">Candidate</td><td><b>${esc(e.name)}</b></td><td class="label-col">Email / Phone</td><td>${esc(e.email || 'candidate@gmail.com')} / ${esc(e.phone || '+91 7052050656')}</td></tr>
      <tr><td class="label-col">Address</td><td colspan="3">${esc(e.address || 'Plot No. 42, RIICO Tech Zone, Mansarovar, Jaipur, Rajasthan - 302020')}</td></tr>
    </table>

    <p style="margin:16px 0 10px;font-size:13.5px">Dear <b>${esc(candFirstName)}</b>,</p>
    <p style="margin:0 0 16px;line-height:1.6;font-size:12.5px;color:#1e293b">
      We are pleased to offer you employment with <b>RvmAiTech</b> (the “Company”) on the terms set out in this letter. This offer is subject to satisfactory verification of information and documents provided by you and completion of joining formalities.
    </p>

    <!-- 1. Position and reporting -->
    <div class="letter-section-title">1. Position and reporting</div>
    <div class="letter-box" style="margin:8px 0 14px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;font-size:12.5px">
        <div><b>Designation:</b> ${esc(e.role || 'Software Developer')}</div>
        <div><b>Department:</b> ${esc(e.dept || 'Technology Department')}</div>
        <div><b>Employment Type:</b> Full-time (Permanent)</div>
        <div><b>Reporting To:</b> Vivek Kumar Bhardwaj (Founder & CEO)</div>
        <div><b>Work Location:</b> Cyber City, Mansarovar, Jaipur (Hybrid / On-site)</div>
        <div><b>Proposed Joining Date:</b> <b>${fmtDate(e.joined)}</b></div>
      </div>
    </div>

    <!-- 2. Compensation -->
    <div class="letter-section-title">2. Compensation</div>
    <p style="margin:8px 0 14px;line-height:1.6;font-size:12.5px;color:#1e293b">
      Your annual Cost to Company (CTC) will be <b>${inr(annualCtc)}</b> (<b>${esc(inrWords(annualCtc))}</b>), subject to applicable taxes and statutory deductions. The detailed salary structure is in Annexure A. CTC is not the same as monthly take-home pay. Variable pay, incentives and reimbursements are governed by written Company policy.
    </p>

    <!-- 3. Probation and confirmation -->
    <div class="letter-section-title">3. Probation and confirmation</div>
    <p style="margin:8px 0 14px;line-height:1.6;font-size:12.5px;color:#1e293b">
      Your initial probation period will be <b>3 months</b> from the date of joining. It may be extended in writing based on performance, conduct, attendance, role suitability and business requirements. Confirmation, if applicable, will be communicated in writing.
    </p>

    <!-- 4. Working hours, attendance and leave -->
    <div class="letter-section-title">4. Working hours, attendance and leave</div>
    <p style="margin:8px 0 14px;line-height:1.6;font-size:12.5px;color:#1e293b">
      Normal working schedule: <b>Monday to Saturday, 09:00 AM – 05:00 PM (8 Hours / Day)</b>, subject to business requirements and applicable law. Attendance, holidays, leave eligibility, approval and remote-work arrangements are governed by current Company policies.
    </p>

    <!-- 5. Duties, conduct and policies -->
    <div class="letter-section-title">5. Duties, conduct and policies</div>
    <p style="margin:8px 0 14px;line-height:1.6;font-size:12.5px;color:#1e293b">
      You will perform the responsibilities associated with your role and other reasonable duties assigned by the Company. You must comply with the code of conduct, information-security rules, IT/asset-use rules, anti-harassment policy, data-protection requirements and lawful workplace instructions.
    </p>

    <!-- 6. Confidentiality and intellectual property -->
    <div class="letter-section-title">6. Confidentiality and intellectual property</div>
    <p style="margin:8px 0 14px;line-height:1.6;font-size:12.5px;color:#1e293b">
      During and after employment, you must protect confidential, proprietary, customer, employee, technical and business information. Work product, inventions, designs, software, source code and documentation created in the course of employment or using Company resources will be governed by a separate written confidentiality/IP agreement and applicable law.
    </p>

    <!-- 7. Background and document verification -->
    <div class="letter-section-title">7. Background and document verification</div>
    <p style="margin:8px 0 14px;line-height:1.6;font-size:12.5px;color:#1e293b">
      This offer is conditional upon verification, as applicable, of identity, address, education, previous employment, references and other role-relevant information. Material misrepresentation or forged documents may result in withdrawal of the offer or action in accordance with law and Company policy.
    </p>

    <!-- 8. Notice period and separation -->
    <div class="letter-section-title">8. Notice period and separation</div>
    <p style="margin:8px 0 14px;line-height:1.6;font-size:12.5px;color:#1e293b">
      Notice requirements: <b>30 days</b> or as stated in the detailed employment agreement and applicable policy. Notice pay, waiver, handover and final settlement will be handled under the applicable agreement, policy and law. Nothing in this letter limits statutory rights.
    </p>

    <!-- 9. Pre-joining documents -->
    <div class="letter-section-title">9. Pre-joining documents</div>
    <p style="margin:8px 0 14px;line-height:1.6;font-size:12.5px;color:#1e293b">
      Please provide, as applicable: government photo ID and address proof; PAN and bank details through a secure HR/payroll channel; education and professional certificates; previous employment/relieving documents; photograph; emergency contact details; and signed confidentiality, IP and policy acknowledgements.
    </p>

    <!-- 10. Acceptance of offer -->
    <div class="letter-section-title">10. Acceptance of offer</div>
    <p style="margin:8px 0 16px;line-height:1.6;font-size:12.5px;color:#1e293b">
      Please sign and return a copy by <b>${esc(deadline)}</b>. This offer remains open until that date unless extended in writing. Employment commences after you report for duty and complete required joining formalities.
    </p>

    <!-- Sign-off -->
    <div style="margin:24px 0 20px">
      <p style="margin:0 0 16px;font-size:13px;color:#1e293b">We look forward to welcoming you to <b>RvmAiTech</b>.</p>
      <div>
        <b>For RvmAiTech</b><br><br>
        <div style="height:36px;border-bottom:1.5px solid #0d2649;width:210px;margin-bottom:4px"></div>
        <b>[Authorised Signatory]</b><br>
        <span style="font-size:12.5px"><b>Vivek Kumar Bhardwaj</b> | Founder & CEO</span><br>
        <span style="font-size:11px;color:#475569">Cyber City, Mansarovar, Jaipur | rvmaitech2026@gmail.com | +91 7052050656</span>
      </div>
    </div>

    <!-- Candidate Acceptance Section -->
    <div class="letter-section-title">CANDIDATE ACCEPTANCE</div>
    <p style="margin:8px 0 12px;font-size:12px;color:#334155;line-height:1.5">
      I, <b>${esc(e.name)}</b>, have read, understood and accept the terms of this offer, subject to the detailed employment agreement and applicable law.
    </p>
    <table class="letter-grid-table">
      <tr><td class="label-col">Signature</td><td style="height:36px;vertical-align:bottom">________________________________</td><td class="label-col">Date</td><td>${fmtDate(today())}</td></tr>
      <tr><td class="label-col">Name</td><td><b>${esc(e.name)}</b></td><td class="label-col">Place</td><td>Jaipur, Rajasthan</td></tr>
    </table>

    <!-- Annexure A - Compensation Structure -->
    <div class="letter-section-title" style="margin-top:24px">ANNEXURE A — COMPENSATION STRUCTURE</div>
    <p style="margin:4px 0 10px;font-size:11px;color:#64748b">Illustrative template only. HR/Payroll has verified all amounts before issuing.</p>
    <table class="letter-grid-table">
      <thead>
        <tr><th>Component</th><th style="text-align:right">Monthly (INR)</th><th style="text-align:right">Annual (INR)</th></tr>
      </thead>
      <tbody>
        <tr><td>Basic Salary (50%)</td><td style="text-align:right">${inr(basic)}</td><td style="text-align:right">${inr(basic * 12)}</td></tr>
        <tr><td>House Rent Allowance (HRA 30%)</td><td style="text-align:right">${inr(hra)}</td><td style="text-align:right">${inr(hra * 12)}</td></tr>
        <tr><td>Special / Other Allowance (20%)</td><td style="text-align:right">${inr(allowance)}</td><td style="text-align:right">${inr(allowance * 12)}</td></tr>
        <tr><td>Employer PF, if applicable</td><td style="text-align:right">${inr(pf)}</td><td style="text-align:right">${inr(pf * 12)}</td></tr>
        <tr><td>Gratuity provision, if applicable</td><td style="text-align:right">₹0 (As per Act)</td><td style="text-align:right">₹0</td></tr>
        <tr><td>Other benefits / variable pay</td><td style="text-align:right">₹0 (Performance)</td><td style="text-align:right">₹0</td></tr>
        ${e.expectedSalary ? `<tr><td style="color:#475569;font-weight:600">Candidate Expected Salary</td><td style="text-align:right;color:#475569;font-weight:600">${inr(e.expectedSalary)}</td><td style="text-align:right;color:#475569;font-weight:600">${inr(e.expectedSalary * 12)}</td></tr>` : ''}
        <tr style="background:#f1f5f9;font-weight:900;border-top:2px solid #0d2649">
          <td>AGREED / OFFERED TOTAL CTC</td><td style="text-align:right;color:#0d2649;font-size:13px">${inr(gross)}</td><td style="text-align:right;color:#0d2649;font-size:13px">${inr(annualCtc)}</td>
        </tr>
      </tbody>
    </table>
    <p style="font-size:11px;color:#64748b;line-height:1.5;margin-bottom:18px">
      Employee deductions, where applicable, may include employee PF, ESI, professional tax, income-tax/TDS and other lawful deductions. Actual take-home pay depends on the final salary structure and statutory rules.
    </p>

    <!-- HR Issue Checklist Box -->
    <div class="letter-box" style="background:#fff7ed;border:1px solid #fed7aa;border-left:4px solid #f47b20;font-size:11px;color:#9a3412;margin-top:16px">
      <b>HR ISSUE CHECKLIST — REMOVE BEFORE SENDING TO CANDIDATE</b>
      <div style="margin-top:6px;line-height:1.6">
        ✓ Verify legal employer name, registered address, CIN/LLPIN (if applicable) and authorised signatory.<br>
        ✓ Confirm designation, location, CTC breakup, probation, notice period, leave and working hours.<br>
        ✓ Check applicable state employment requirements and current labour-law applicability.<br>
        ✓ Attach detailed employment agreement and relevant policies; obtain Indian employment counsel/CA review.
      </div>
    </div>
  </div>`;
}

function showOfferLetterModal(e) {
  if (!e) return;
  dlg.className = 'dlg dlg-doc';
  const companyName = (S.company && S.company.name) || 'RvmAiTech';
  const year = new Date().getFullYear();
  const subject = `Welcome to ${companyName} - Employment Offer Letter (${e.code || e.name})`;
  const bodyText = `Dear ${e.name},\n\nPlease find your Official Offer Letter from ${companyName}.\nPosition: ${e.role}\nDepartment: ${e.dept}\nGross Monthly Salary: Rs. ${Number(e.salary || 0).toLocaleString('en-IN')}\nShift: 8 Hours / Day (09:00 AM - 05:00 PM)\nDate of Joining: ${fmtDate(e.joined)}\n\nPlease sign in to your employee portal: ${location.origin}\n\nWarm regards,\nHR Department - ${companyName}`;
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(e.email || '')}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;

  dlg.innerHTML = `
    <div class="dlg-doc-topbar no-print">
      <div>
        <h2 style="margin:0;font-size:17px;font-weight:900;color:#0d2649">Official Employment Offer Letter</h2>
        <p style="margin:2px 0 0;font-size:12px;color:#475569"><b>${esc(e.name)}</b> · Employee Code: <b>${esc(e.code)}</b> · ${esc(e.role || 'Staff')}</p>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <button type="button" class="btn btn-primary" onclick="printDoc('printableArea')">🖨️ Print A4</button>
        <a href="/api/pdf/offer-letter/${esc(e.id)}" target="_blank" download="Offer_Letter_${esc(e.code || 'EMP')}.pdf" class="btn" style="background:#0284c7;color:#fff;border-color:#0284c7;font-weight:700">📥 Download PDF File</a>
        ${e.email ? `<a href="${esc(gmailUrl)}" target="_blank" rel="noopener" class="btn" style="background:#ea4335;border-color:#ea4335;color:#fff;font-weight:700">🚀 Send in Gmail</a>` : ''}
        <button type="button" class="btn" id="btnSendOfferEmail" style="background:#059669;color:#fff;border-color:#059669;font-weight:700">✉️ Send PDF to Email</button>
        <button type="button" class="btn" data-x="cancel">Close</button>
      </div>
    </div>
    <div class="dlg-doc-scroll">
      ${renderOfferLetterHtml(e, S.company)}
    </div>`;

  $('#btnSendOfferEmail', dlg).onclick = async () => {
    const btn = $('#btnSendOfferEmail', dlg);
    btn.disabled = true; btn.textContent = 'Sending...';
    try {
      const res = await api('POST', `/api/employees/${encodeURIComponent(e.id)}/send-email`);
      toast(res.sentLive ? `Offer letter delivered to ${e.email}!` : `Offer letter prepared & logged to Outbox!`, 'good');
      btn.textContent = 'Sent ✓';
    } catch (err) {
      toast(err.message || 'Could not send email.', 'bad');
      btn.disabled = false; btn.textContent = '✉️ Send to Email';
    }
  };

  dlg.showModal();
}
window.showOfferLetterModal = showOfferLetterModal;

function renderJoiningLetterHtml(e, company) {
  if (!e) return '';
  const coName = 'RvmAiTech';
  const gross = Number(e.salary || 0);
  const year = new Date().getFullYear();
  const refNo = `RVM/HR/OFFER/${year}/${e.code || '0001'}`;

  return `
  <div class="letter-sheet" id="printableArea">
    <!-- Official Header with Clean Brand Logo -->
    <div class="letter-head" style="align-items:center;border-bottom:2px solid #0d2649;padding-bottom:14px;margin-bottom:18px">
      <div class="letter-brand">
        <div class="letterhead-logo-wrap">
          <img src="/logo-light.png?v=20261115" alt="RvmAiTech" style="height:48px;width:auto;max-width:220px;object-fit:contain;display:block">
        </div>
        <div class="letter-corp-sub" style="margin-top:6px;font-size:11px;font-weight:700;color:#0d2649;letter-spacing:.05em">
          RvmAiTech Solutions Private Limited · HR & Talent Operations
        </div>
        <div style="font-size:10.5px;color:#64748b;margin-top:2px">
          Cyber City, Mansarovar, Jaipur, Rajasthan - 302020 | rvmaitech2026@gmail.com | +91 7052050656
        </div>
      </div>
      <div class="letter-meta-right" style="text-align:right">
        <div class="letter-badge letter-badge-good" style="background:#059669;color:#ffffff;font-size:12px;font-weight:800;padding:5px 12px;border-radius:4px;letter-spacing:.04em;display:inline-block;margin-bottom:6px">
          JOINING LETTER & EMPLOYEE JOINING FORM
        </div>
        <div class="letter-date" style="font-size:12px;color:#475569">Date: <b>${fmtDate(today())}</b></div>
        <div class="letter-ref" style="font-family:monospace;font-size:11px;color:#059669;margin-top:2px">Ref: RAT/JOIN/${year}/${esc(e.code || 'EMP')}</div>
      </div>
    </div>

    <!-- PART A — EMPLOYEE JOINING CONFIRMATION -->
    <div class="letter-section-title">PART A — EMPLOYEE JOINING CONFIRMATION</div>
    <table class="letter-grid-table" style="margin-bottom:14px">
      <tr><td class="label-col">Date of Joining</td><td><b>${fmtDate(e.joined)}</b></td><td class="label-col">Employee ID</td><td><code>${esc(e.code)}</code></td></tr>
      <tr><td class="label-col">Offer Reference</td><td><code>${esc(refNo)}</code></td><td class="label-col">Employee Name</td><td><b>${esc(e.name)}</b></td></tr>
      <tr><td class="label-col">Designation</td><td>${esc(e.role || 'Staff')}</td><td class="label-col">Department</td><td>${esc(e.dept || 'Operations')}</td></tr>
      <tr><td class="label-col">Reporting Manager</td><td>Vivek Kumar Bhardwaj (Founder & CEO)</td><td class="label-col">Work Location</td><td>Cyber City, Mansarovar, Jaipur (On-site / Hybrid)</td></tr>
    </table>

    <div class="letter-box" style="margin:12px 0 16px;line-height:1.6;font-size:12.5px;color:#1e293b">
      <b>To,</b><br>
      The HR Department<br>
      <b>RvmAiTech Solutions Private Limited</b><br>
      Cyber City, Mansarovar, Jaipur, Rajasthan<br><br>
      <b>Subject: Confirmation of Joining</b><br><br>
      Dear HR Team,<br>
      I, <b>${esc(e.name)}</b>, confirm that I have joined RvmAiTech on <b>${fmtDate(e.joined)}</b> as <b>${esc(e.role || 'Staff')}</b> in the <b>${esc(e.dept || 'Operations')}</b> department. I acknowledge receipt of the employment offer and agree to comply with applicable employment terms, Company policies, confidentiality obligations and lawful instructions.<br><br>
      I confirm that the information and documents submitted by me are true and complete to the best of my knowledge. I will promptly inform HR of any change in my personal, contact, bank or statutory details.<br><br>
      Sincerely,<br>
      <b>${esc(e.name)}</b><br>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:20px">
        <div>Signature: __________________________</div>
        <div>Date: <b>${fmtDate(e.joined)}</b></div>
      </div>
    </div>

    <!-- PART B — EMPLOYEE INFORMATION FORM -->
    <div class="letter-section-title">PART B — EMPLOYEE INFORMATION FORM</div>
    <table class="letter-grid-table" style="margin-bottom:16px">
      <tr><td class="label-col">Full Legal Name</td><td><b>${esc(e.name)}</b></td><td class="label-col">Preferred Name</td><td>${esc((e.name || '').trim().split(/\s+/)[0])}</td></tr>
      <tr><td class="label-col">Date of Birth</td><td>${e.dob ? fmtDate(e.dob) : '15 Aug 1998'}</td><td class="label-col">Personal Email</td><td>${esc(e.email || 'employee@gmail.com')}</td></tr>
      <tr><td class="label-col">Mobile Number</td><td>${esc(e.phone || '+91 7052050656')}</td><td class="label-col">Emergency Contact</td><td>Father / Guardian (+91 9876500000)</td></tr>
      <tr><td class="label-col">Current Address</td><td colspan="3">${esc(e.address || 'Plot No. 42, RIICO Tech Zone, Mansarovar, Jaipur, Rajasthan - 302020')}</td></tr>
      <tr><td class="label-col">Permanent Address</td><td colspan="3">${esc(e.address || 'Plot No. 42, RIICO Tech Zone, Mansarovar, Jaipur, Rajasthan - 302020')}</td></tr>
      <tr><td class="label-col">PAN</td><td><code>${esc(e.pan || 'ABCDE1234F')}</code></td><td class="label-col">Bank Details</td><td>HDFC Bank | A/C: 5010048892110 | IFSC: HDFC0001234</td></tr>
      <tr><td class="label-col">UAN / PF</td><td><code>101234567890 (Active)</code></td><td class="label-col">ESI IP Number</td><td><code>12345678901234567</code></td></tr>
      <tr><td class="label-col">Previous Employer</td><td colspan="3">${esc(e.prevEmployer || 'Tech Solutions Pvt Ltd (Experience verified)')}</td></tr>
    </table>

    <!-- PART C — DOCUMENTS CHECKLIST -->
    <div class="letter-section-title">PART C — DOCUMENTS CHECKLIST</div>
    <div class="letter-box" style="margin:8px 0 14px;font-size:12px;line-height:1.7">
      <div class="letter-checklist-item"><span class="letter-check-box">✓</span> <span>Identity and address proof verified by authorised HR personnel.</span></div>
      <div class="letter-checklist-item"><span class="letter-check-box">✓</span> <span>PAN details collected securely for payroll/tax purposes.</span></div>
      <div class="letter-checklist-item"><span class="letter-check-box">✓</span> <span>Bank proof / cancelled cheque verified for salary transfer.</span></div>
      <div class="letter-checklist-item"><span class="letter-check-box">✓</span> <span>Education and professional certificates checked, where relevant.</span></div>
      <div class="letter-checklist-item"><span class="letter-check-box">✓</span> <span>Previous employment documents checked, where applicable.</span></div>
      <div class="letter-checklist-item"><span class="letter-check-box">✓</span> <span>Photograph and emergency contact recorded.</span></div>
      <div class="letter-checklist-item"><span class="letter-check-box">✓</span> <span>Signed offer / employment agreement received.</span></div>
      <div class="letter-checklist-item"><span class="letter-check-box">✓</span> <span>Confidentiality, IP and acceptable-use acknowledgements completed, where applicable.</span></div>
      <p style="font-size:11px;color:#64748b;margin:8px 0 0">
        Do not collect or circulate unnecessary identity data. Store copies only where legally necessary, restrict access and follow the Company’s data-retention and security policy.
      </p>
    </div>

    <!-- PART D — HR / IT / ADMIN ONBOARDING -->
    <div class="letter-section-title">PART D — HR / IT / ADMIN ONBOARDING</div>
    <table class="letter-grid-table" style="margin-bottom:14px">
      <thead><tr><th>Task</th><th>Owner</th><th>Status</th><th>Date / Remarks</th></tr></thead>
      <tbody>
        <tr><td>Employee ID and HRMS profile</td><td>HR</td><td><b style="color:#059669">Complete (✓)</b></td><td>ID: ${esc(e.code)} generated & active</td></tr>
        <tr><td>Attendance / access setup</td><td>HR / Admin</td><td><b style="color:#059669">Complete (✓)</b></td><td>Biometric & RFID card registered</td></tr>
        <tr><td>Official email and system access</td><td>IT</td><td><b style="color:#059669">Complete (✓)</b></td><td>${esc(e.userLoginId || (e.code ? e.code.toLowerCase() : 'emp'))}@rvmaitech.com</td></tr>
        <tr><td>Laptop / assets issue and acknowledgement</td><td>IT / Admin</td><td><b style="color:#059669">Complete (✓)</b></td><td>Device allocated & logged</td></tr>
        <tr><td>Department induction and role goals</td><td>Manager</td><td><b style="color:#059669">Complete (✓)</b></td><td>Role targets & KPIs communicated</td></tr>
        <tr><td>Policy and safety orientation</td><td>HR / Manager</td><td><b style="color:#059669">Complete (✓)</b></td><td>Code of Conduct & Safety guidelines briefed</td></tr>
        <tr><td>Payroll setup / statutory enrolment</td><td>Payroll / HR</td><td><b style="color:#059669">Complete (✓)</b></td><td>Salary bank linkage & tax profile done</td></tr>
      </tbody>
    </table>

    <!-- PART E — COMPANY ASSET ACKNOWLEDGEMENT -->
    <div class="letter-section-title">PART E — COMPANY ASSET ACKNOWLEDGEMENT</div>
    <p style="margin:6px 0 10px;font-size:12px;color:#334155;line-height:1.5">
      I acknowledge receipt of the Company assets listed below and agree to use them responsibly, protect them from loss or unauthorised access, and return them upon request or separation, subject to applicable law and Company policy.
    </p>
    <table class="letter-grid-table" style="margin-bottom:14px">
      <thead><tr><th>Asset</th><th>Asset ID / Serial No.</th><th>Condition</th><th>Employee Initials</th></tr></thead>
      <tbody>
        <tr><td>Laptop / Workstation</td><td>RAT-IT-LP-${esc(e.code || '001')}</td><td>Brand New / Excellent</td><td style="text-align:center">[ ${esc(initials(e.name))} ]</td></tr>
        <tr><td>Official Access Card / RFID</td><td>RAT-SEC-ID-${esc(e.code || '001')}</td><td>Active</td><td style="text-align:center">[ ${esc(initials(e.name))} ]</td></tr>
        <tr><td>Hardware Development Kit / Tools</td><td>RAT-LAB-DEV-04</td><td>Functional / Verified</td><td style="text-align:center">[ ${esc(initials(e.name))} ]</td></tr>
      </tbody>
    </table>
    <div style="display:flex;justify-content:space-between;margin:16px 0 20px;font-size:12px">
      <div>Employee Signature: ____________________</div>
      <div>HR/Admin Signature: ____________________</div>
    </div>

    <!-- PART F — HR COMPLETION & APPROVAL -->
    <div class="letter-section-title">PART F — HR COMPLETION & APPROVAL</div>
    <table class="letter-grid-table" style="margin-bottom:14px">
      <tr><td class="label-col">Joining Documents</td><td><b style="color:#059669">Complete (All verified)</b></td><td class="label-col">Background Verification</td><td><b style="color:#059669">Cleared (Positive report)</b></td></tr>
      <tr><td class="label-col">Payroll Setup</td><td><b style="color:#059669">Complete (Active in payroll run)</b></td><td class="label-col">System Access</td><td><b style="color:#059669">Active (ERP & HRMS portal)</b></td></tr>
      <tr><td class="label-col">Approved By</td><td><b>Vivek Kumar Bhardwaj</b> (Founder & CEO)</td><td class="label-col">Approval Date</td><td>${fmtDate(e.joined)}</td></tr>
      <tr><td class="label-col">HR Remarks</td><td colspan="3">Onboarding completed successfully. Employee enrolled in HRMS and assigned to ${esc(e.dept || 'Operations')}.</td></tr>
      <tr><td class="label-col">Employee File Ref</td><td colspan="3"><code>HRMS-FILE-${esc(e.code || 'RAT-001')}</code></td></tr>
    </table>

    <!-- IMPORTANT HR NOTE -->
    <div class="letter-box" style="background:#f1f5f9;border:1px solid #cbd5e1;font-size:11px;color:#475569;margin-top:16px;line-height:1.5">
      <b>IMPORTANT HR NOTE:</b><br>
      This joining form records onboarding and joining details; it does not replace the offer letter, detailed employment agreement, statutory registers, mandatory notices or state-specific employment documentation. Adapt it to the employee’s state, role, employment category and current Indian legal requirements. Do not ask employees to sign blank or incomplete forms.
    </div>
  </div>`;
}

function showJoiningLetterModal(e) {
  if (!e) return;
  dlg.className = 'dlg dlg-doc';
  const companyName = (S.company && S.company.name) || 'RvmAiTech';
  const subject = `Welcome to ${companyName} - Appointment & Joining Letter (${e.code || e.name})`;
  const bodyText = `Dear ${e.name},\n\nPlease find your Official Joining & Appointment Letter from ${companyName}.\nEmployee Code: ${e.code}\nDepartment: ${e.dept}\nJoining Date: ${fmtDate(e.joined)}\nShift Standard: 8 Hours / Day\n\nPlease sign in to your employee portal: ${location.origin}\n\nWarm regards,\nHR Department - ${companyName}`;
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(e.email || '')}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;

  dlg.innerHTML = `
    <div class="dlg-doc-topbar no-print">
      <div>
        <h2 style="margin:0;font-size:17px;font-weight:900;color:#0d2649">Official Appointment &amp; Joining Letter</h2>
        <p style="margin:2px 0 0;font-size:12px;color:#475569"><b>${esc(e.name)}</b> · Employee Code: <b>${esc(e.code)}</b> · ${esc(e.role || 'Staff')}</p>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <button type="button" class="btn btn-primary" onclick="printDoc('printableArea')">🖨️ Print A4</button>
        <a href="/api/pdf/joining-letter/${esc(e.id)}" target="_blank" download="Joining_Letter_${esc(e.code || 'EMP')}.pdf" class="btn" style="background:#0284c7;color:#fff;border-color:#0284c7;font-weight:700">📥 Download PDF File</a>
        ${e.email ? `<a href="${esc(gmailUrl)}" target="_blank" rel="noopener" class="btn" style="background:#ea4335;border-color:#ea4335;color:#fff;font-weight:700">🚀 Send in Gmail</a>` : ''}
        <button type="button" class="btn" id="btnSendJoiningEmail" style="background:#059669;color:#fff;border-color:#059669;font-weight:700">✉️ Send PDF to Email</button>
        <button type="button" class="btn" data-x="cancel">Close</button>
      </div>
    </div>
    <div class="dlg-doc-scroll">
      ${renderJoiningLetterHtml(e, S.company)}
    </div>`;

  $('#btnSendJoiningEmail', dlg).onclick = async () => {
    const btn = $('#btnSendJoiningEmail', dlg);
    btn.disabled = true; btn.textContent = 'Sending...';
    try {
      const res = await api('POST', `/api/employees/${encodeURIComponent(e.id)}/send-email`);
      toast(res.sentLive ? `Joining letter delivered to ${e.email}!` : `Joining letter prepared & logged to Outbox!`, 'good');
      btn.textContent = 'Sent ✓';
    } catch (err) {
      toast(err.message || 'Could not send email.', 'bad');
      btn.disabled = false; btn.textContent = '✉️ Send to Email';
    }
  };

  dlg.showModal();
}
window.showJoiningLetterModal = showJoiningLetterModal;

/* Registration Success & Documents Modal */
function showRegistrationSuccessModal(e, creds, emailRes) {
  dlg.className = 'dlg dlg-wide';
  let loginUrl = (creds && creds.portalUrl) || location.origin;
  if (loginUrl.includes('render.com') || (!loginUrl.includes('localhost') && !loginUrl.includes('127.0.0.1'))) {
    loginUrl = loginUrl.replace(/^http:\/\//, 'https://');
  }
  const loginId = (creds && creds.loginId) || e.userLoginId || (e.code ? e.code.toLowerCase().replace(/[^a-z0-9]/g, '') : 'emp');
  const pass = (creds && creds.tempPassword) || e.tempPassword || 'Check with HR';
  const companyName = (S.company && S.company.name) || 'RvmAiTech Solutions Private Limited';

  const isLiveSent = emailRes && emailRes.sentLive;
  const fullEmailText = `Namaste ${e.name},

Congratulations and Welcome to ${companyName}!
Your Employee Registration is confirmed. Below are your official Offer Letter, Joining Details, and HRMS Employee Portal Login.

OFFER & APPOINTMENT SUMMARY:
- Employee Code: ${e.code}
- Role / Designation: ${e.role || 'Staff'}
- Department: ${e.dept || 'Operations'}
- Gross Monthly Salary: ₹${Number(e.salary || 0).toLocaleString('en-IN')}
- Annual CTC: ₹${(Number(e.salary || 0) * 12).toLocaleString('en-IN')}
- Shift Standard: 8 Hours / Day (09:00 AM - 05:00 PM)
- Date of Joining: ${fmtDate(e.joined)}

YOUR EMPLOYEE PORTAL CREDENTIALS:
- Portal URL: ${loginUrl}
- Login ID: ${loginId}
- Temporary Password: ${pass}

You can login to mark daily attendance, submit daily work reports ("Kal kya kiya, aaj kya karenge"), view salary slips, and download your official company ID Card.

Best regards,
HR Operations - ${companyName}
Official Email: rvmaitech2026@gmail.com`;

  const gmailUrl = (emailRes && emailRes.gmailWebUrl) || `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(e.email || '')}&su=${encodeURIComponent(`Welcome to ${companyName} - Offer Letter & Joining Details (${e.code})`)}&body=${encodeURIComponent(fullEmailText)}`;

  dlg.innerHTML = `
    <div class="form">
      <div style="border-bottom:1px solid var(--rule);padding-bottom:12px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
          <div>
            <h2 class="dlg-title" style="margin:0;color:#166534">🎉 Employee Registered Successfully!</h2>
            <p class="dlg-sub" style="margin:4px 0 0"><b>${esc(e.name)}</b> (${esc(e.code)}) · ${esc(e.role || 'Staff')} · ${esc(e.dept || 'Operations')}</p>
          </div>
          <button type="button" class="btn btn-sm" data-x="cancel">✕ Close</button>
        </div>
      </div>

      <div class="reg-modal-box">
        <div style="display:flex;align-items:center;gap:12px">
          <span style="font-size:24px">${isLiveSent ? '✅' : '⚡'}</span>
          <div>
            <b style="color:#166534;font-size:14px">
              ${isLiveSent ? `Welcome, Offer Letter & Joining Details Delivered via SMTP to ${esc(e.email)}!`
                : emailRes ? `Automatic Email Prepared & Logged from rvmaitech2026@gmail.com for ${esc(e.email || 'employee')}!`
                : `Portal Account & Login Credentials Generated for ${esc(e.name)}!`}
            </b>
            <div style="font-size:12px;color:#15803d;margin-top:2px">
              Official Sender: <b>rvmaitech2026@gmail.com</b> · Employee Email: <b>${esc(e.email || 'Not provided')}</b>
            </div>
          </div>
        </div>
      </div>

      <h3 style="font-size:13px;margin:16px 0 8px;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-2);font-weight:800">
        1. Official Documents & Letters (View / Download / Print)
      </h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:18px">
        <button type="button" class="btn" id="btnOpenOffer" style="padding:12px;display:flex;align-items:center;gap:10px;text-align:left;border:1px solid var(--rule)">
          <span style="font-size:24px">📄</span>
          <div>
            <b style="display:block;color:#0284c7;font-size:13px">Offer Letter</b>
            <span style="font-size:11px;color:var(--ink-2)">CTC & 8-hr shift breakdown</span>
          </div>
        </button>

        <button type="button" class="btn" id="btnOpenJoining" style="padding:12px;display:flex;align-items:center;gap:10px;text-align:left;border:1px solid var(--rule)">
          <span style="font-size:24px">📜</span>
          <div>
            <b style="display:block;color:#0369a1;font-size:13px">Joining Letter</b>
            <span style="font-size:11px;color:var(--ink-2)">Appointment order & terms</span>
          </div>
        </button>

        <button type="button" class="btn" id="btnOpenIdCard" style="padding:12px;display:flex;align-items:center;gap:10px;text-align:left;border:1px solid var(--rule)">
          <span style="font-size:24px">🪪</span>
          <div>
            <b style="display:block;color:#0f766e;font-size:13px">Employee ID Card</b>
            <span style="font-size:11px;color:var(--ink-2)">CR-80 badge with QR code</span>
          </div>
        </button>
      </div>

      <h3 style="font-size:13px;margin:16px 0 8px;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-2);font-weight:800">
        2. Employee Portal Credentials
      </h3>
      <div class="cred-box" style="margin-bottom:18px">
        <div class="cred-row"><span>Portal Website:</span> <a href="${esc(loginUrl)}" target="_blank" rel="noopener"><b>${esc(loginUrl)}</b></a></div>
        <div class="cred-row"><span>Employee Email:</span> <b>${esc(e.email || '—')}</b></div>
        <div class="cred-row"><span>Login ID:</span> <code>${esc(loginId)}</code></div>
        <div class="cred-row"><span>Temporary Password:</span> <code>${esc(pass)}</code></div>
      </div>

      <h3 style="font-size:13px;margin:16px 0 8px;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-2);font-weight:800">
        3. Email Dispatch Options (Automatic & Manual)
      </h3>
      <div class="reg-modal-actions">
        ${e.email ? `
          <a href="${esc(gmailUrl)}" target="_blank" rel="noopener" class="btn btn-primary" style="background:#ea4335;border-color:#ea4335;color:#fff;display:inline-flex;align-items:center;gap:6px">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
            🚀 Open & Send in Gmail (1-Click)
          </a>
          <button type="button" class="btn" id="btnManualSendEmail">
            ✉️ Resend via Server SMTP
          </button>
        ` : '<span class="muted" style="font-size:12px">No email address recorded for employee.</span>'}
        <button type="button" class="btn" id="btnCopyAllDetails">📋 Copy Letters & Login</button>
        <button type="button" class="btn" id="btnGoProfileNow">📂 Upload Original Documents</button>
        <button type="button" class="btn" data-x="cancel">Done</button>
      </div>
    </div>`;

  $('#btnOpenOffer', dlg).onclick = () => showOfferLetterModal(e);
  $('#btnOpenJoining', dlg).onclick = () => showJoiningLetterModal(e);
  $('#btnOpenIdCard', dlg).onclick = () => showIdCardModal(e);
  $('#btnCopyAllDetails', dlg).onclick = () => copyToClipboard(fullEmailText, 'Offer letter, joining details and login copied to clipboard!');

  if ($('#btnManualSendEmail', dlg)) {
    $('#btnManualSendEmail', dlg).onclick = async () => {
      const btn = $('#btnManualSendEmail', dlg);
      btn.disabled = true; btn.textContent = 'Sending via SMTP...';
      try {
        const res = await api('POST', `/api/employees/${encodeURIComponent(e.id)}/send-email`);
        if (res.sentLive) {
          toast(`Email with PDF delivered directly to ${e.email} via Gmail SMTP!`, 'good');
          btn.textContent = 'Delivered ✓';
        } else {
          toast(res.error ? `SMTP Error: ${res.error}` : `Email logged to Outbox. Click 🚀 Open in Gmail button to dispatch.`, 'warn');
          btn.textContent = 'Sent via Web Gmail';
          btn.disabled = false;
        }
      } catch (err) {
        toast(err.message || 'Could not send email.', 'bad');
        btn.disabled = false; btn.textContent = '✉️ Retry Send via SMTP';
      }
    };
  }

  $('#btnGoProfileNow', dlg).onclick = () => {
    closeDlg();
    S.ui.profile = e.id;
    scheduleRender();
  };

  dlg.showModal();
}
window.showRegistrationSuccessModal = showRegistrationSuccessModal;

function showCredentialsModal(e, creds) {
  showRegistrationSuccessModal(e, creds, null);
}

function showIdCardModal(e) {
  dlg.className = 'dlg dlg-wide';
  dlg.innerHTML = `
    <div class="form">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--rule);padding-bottom:10px">
        <div>
          <h2 class="dlg-title" style="margin:0">Official Employee Identity Card</h2>
          <p class="dlg-sub" style="margin:2px 0 0">${esc(e.name)} · ${esc(e.code)}</p>
        </div>
        <div class="vactions">
          <a href="/api/pdf/id-card/${esc(e.id)}" target="_blank" download="ID_Card_${esc(e.code || 'EMP')}.pdf" class="btn" style="background:#0284c7;color:#fff;border-color:#0284c7;font-weight:700">📥 Download PDF</a>
          <button type="button" class="btn btn-primary" onclick="printDoc('printableArea')">Print / Save PDF</button>
          <button type="button" class="btn" data-x="cancel">Close</button>
        </div>
      </div>
      <div style="padding:16px 0">
        ${renderIdCardHtml(e, S.company)}
      </div>
      <p class="note" style="text-align:center">Standard identity badge size (CR-80). Press Print to print directly or save as PDF.</p>
    </div>`;
  dlg.showModal();
}

/* Helper to render & show printable Official Salary Slip Modal */
function showPayslipModal(e, month) {
  if (!e) return;
  month = month || S.ui.payMonth || today().slice(0, 7);
  dlg.className = 'dlg dlg-wide';

  function renderSlipContent(curMonth) {
    const payRows = payroll(curMonth);
    const dim = daysIn(curMonth);
    const r = payRows.find(x => x.e.id === e.id) || {
      e, gross: num(e.salary), payable: dim, lop: 0, lopAmt: 0,
      pf: Math.round(num(e.salary) * 0.5 * 0.12), pt: num(e.salary) > 15000 ? 200 : 0,
      net: num(e.salary) - Math.round(num(e.salary) * 0.5 * 0.12) - (num(e.salary) > 15000 ? 200 : 0),
      dim
    };

    const dailyRate = r.gross / r.dim;
    const hourlyRate = dailyRate / 8; // 8-hour shift standard
    const basic = Math.round(r.gross * 0.5);
    const hra = Math.round(r.gross * 0.3);
    const allowance = Math.max(0, r.gross - basic - hra);
    const totalDeductions = (r.lopAmt || 0) + (r.pf || 0) + (r.pt || 0);
    const coName = (S.company && S.company.name) || 'RvmAiTech';

    dlg.innerHTML = `
      <div class="form">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--rule);padding-bottom:10px;flex-wrap:wrap;gap:10px">
          <div>
            <h2 class="dlg-title" style="margin:0">Official Salary Slip (${esc(e.name)})</h2>
            <p class="dlg-sub" style="margin:2px 0 0">${esc(e.code)} · ${esc(e.role || 'Staff')} · 8-Hour Shift Standard</p>
          </div>
          <div style="display:flex;align-items:center;gap:8px" class="no-print">
            <span class="stepper">
              <button type="button" class="btn btn-sm" id="btnPrevSlipMonth" title="Previous Month">‹</button>
              <span class="cur" style="font-weight:700">${esc(monthName(curMonth))}</span>
              <button type="button" class="btn btn-sm" id="btnNextSlipMonth" title="Next Month"${curMonth >= today().slice(0, 7) ? ' disabled' : ''}>›</button>
            </span>
            <button type="button" class="btn btn-primary" onclick="printDoc('printableArea')">Print / Save PDF</button>
            <button type="button" class="btn" data-x="cancel">Close</button>
          </div>
        </div>

        <div style="padding:14px 0" id="printableArea">
          <div class="payslip-wrap" style="box-shadow:none;border:1px solid #cbd5e1">
            <div class="payslip-hdr">
              <div>
                <div class="logo-badge-dark"><img src="/logo-light.png?v=20261115" alt="RvmAiTech" style="height:42px;width:auto;max-width:180px;object-fit:contain;display:block"></div>
                <div class="payslip-sub" style="margin-top:6px">Official Employee Salary Statement · Confidential</div>
              </div>
              <div>
                <div class="payslip-title">SALARY SLIP</div>
                <div class="payslip-sub">${esc(monthName(curMonth))}</div>
              </div>
            </div>

            <div class="payslip-meta">
              <div><b>Employee Code:</b> ${esc(e.code)}</div>
              <div><b>Full Name:</b> ${esc(e.name)}</div>
              <div><b>Designation / Role:</b> ${esc(e.role || 'Team Member')}</div>
              <div><b>Department:</b> ${esc(e.dept || 'Operations')}</div>
              <div><b>Date of Joining:</b> ${fmtDate(e.joined)}</div>
              <div><b>Shift Standard:</b> 8 Hours / Day (09:00 - 17:00)</div>
              <div><b>Paid Days:</b> ${r.payable} of ${r.dim} days</div>
              <div><b>Loss of Pay (LOP):</b> ${r.lop || 0} days</div>
            </div>

            <div style="background:#f1f5f9;border-radius:8px;padding:8px 12px;margin-bottom:14px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:12px">
              <div><b>Monthly Gross:</b> ${inr(r.gross)}</div>
              <div><b>Daily Rate (Gross ÷ ${r.dim}):</b> ₹${Math.round(dailyRate).toLocaleString('en-IN')}/day</div>
              <div><b>Hourly Rate (8-hr Shift):</b> ₹${hourlyRate.toFixed(2)}/hr</div>
            </div>

            <div class="payslip-grid">
              <div>
                <table class="payslip-col-table">
                  <thead><tr><th>Earnings Breakdown</th><th class="num">Amount (₹)</th></tr></thead>
                  <tbody>
                    <tr><td>Basic Salary (50%)</td><td class="num">${inr(basic)}</td></tr>
                    <tr><td>House Rent Allowance (HRA 30%)</td><td class="num">${inr(hra)}</td></tr>
                    <tr><td>Special / Conveyance Allowance</td><td class="num">${inr(allowance)}</td></tr>
                    <tr style="font-weight:700;border-top:1px solid #cbd5e1"><td>Total Gross Earnings</td><td class="num">${inr(r.gross)}</td></tr>
                  </tbody>
                </table>
              </div>
              <div>
                <table class="payslip-col-table">
                  <thead><tr><th>Deductions</th><th class="num">Amount (₹)</th></tr></thead>
                  <tbody>
                    <tr><td>Loss of Pay (LOP Deduction)</td><td class="num">${r.lopAmt ? inr(r.lopAmt) : '₹0'}</td></tr>
                    <tr><td>Provident Fund (PF - 12%)</td><td class="num">${inr(r.pf)}</td></tr>
                    <tr><td>Professional Tax (PT)</td><td class="num">${r.pt ? inr(r.pt) : '₹0'}</td></tr>
                    <tr style="font-weight:700;border-top:1px solid #cbd5e1"><td>Total Deductions</td><td class="num">${inr(totalDeductions)}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="payslip-net">
              <div>
                <div>Net Take-Home Salary</div>
                <span style="font-size:12px;opacity:0.85">Payable for ${esc(monthName(curMonth))}</span>
              </div>
              <div><b>${inr(r.net)}</b></div>
            </div>

            <div style="margin-top:20px;display:flex;justify-content:space-between;align-items:flex-end;font-size:11px;color:#64748b">
              <div>System generated salary slip · Generated on ${fmtDate(today())}</div>
              <div style="text-align:right">
                <div style="font-weight:700;color:#0f172a">For ${esc(coName)}</div>
                <div style="margin-top:24px;border-top:1px dashed #94a3b8;padding-top:4px">Authorized Signatory</div>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    const prevBtn = $('#btnPrevSlipMonth', dlg);
    const nextBtn = $('#btnNextSlipMonth', dlg);
    if (prevBtn) prevBtn.onclick = () => renderSlipContent(shiftMonth(curMonth, -1));
    if (nextBtn) nextBtn.onclick = () => renderSlipContent(shiftMonth(curMonth, 1));
  }

  renderSlipContent(month);
  dlg.showModal();
}
window.showPayslipModal = showPayslipModal;

ACT['payslip-open'] = el => {
  const e = S.employees.find(x => x.id === el.dataset.id);
  if (e) showPayslipModal(e);
};

V['hr-employees'] = D => {
  if (S.ui.profile && D.emp.get(S.ui.profile)) return profileView(D, D.emp.get(S.ui.profile));
  const q = query('hr-employees'), f = S.ui.filter.dept || '';
  const tab = S.ui.tab || 'all';
  const depts = [...new Set(S.employees.map(e => e.dept).filter(Boolean))].sort();

  let rows = S.employees.filter(e => matches(q, e.name, e.code, e.dept, e.role, e.phone, e.email) && (!f || e.dept === f));
  if (tab === 'registered') rows = rows.filter(e => e.status === 'Registered');
  else if (tab === 'active') rows = rows.filter(e => e.status === 'Active');

  rows = rows.sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')));
  const act = activeEmps();
  const registeredCount = S.employees.filter(e => e.status === 'Registered').length;

  const body = rows.map(e => {
    const miss = missingRecords(e), docs = S.files.filter(x => x.employeeId === e.id && x.kind !== 'photo').length;
    return `<tr style="cursor:pointer" onclick="if(!event.target.closest('button,a,input,label')){location.hash='#hr-employees';S.ui.profile='${esc(e.id)}';scheduleRender();}">
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          ${avatar(e)}
          <div>
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-family:monospace;background:rgba(59,130,246,0.18);color:#60a5fa;border:1px solid rgba(59,130,246,0.35);padding:1px 6px;border-radius:4px;font-weight:700;font-size:11.5px">${esc(e.code)}</span>
              <b style="color:var(--ink);font-size:13.5px">${esc(e.name)}</b>
            </div>
            <div class="sub" style="font-size:11.5px;color:#94a3b8;margin-top:2px">${esc([e.role, e.dept].filter(Boolean).join(' · '))}</div>
          </div>
        </div>
      </td>
      <td class="nowrap">
        <div><b>${esc(e.phone || '—')}</b></div>
        <span class="sub" style="font-size:11px">${esc(e.email || '')}</span>
      </td>
      <td class="nowrap">${fmtDate(e.joined)}</td>
      <td class="num font-bold" style="color:#38bdf8">${inr(e.salary)}</td>
      <td class="num">${e.expectedSalary ? `<span style="color:#fbbf24;font-weight:600">${inr(e.expectedSalary)}</span>` : '<span class="muted">—</span>'}</td>
      <td>
        ${e.status === 'Registered' ? stamp('Registered', 'info') : e.status === 'Left' ? stamp('Left', 'mute') : stamp('Active', 'good')}
        <span class="sub" style="font-size:11px;margin-top:2px">${miss.length ? '⚠️ ' + miss.length + ' pending doc' : '✓ Verified'}</span>
      </td>
      <td class="acts" style="white-space:nowrap;text-align:right">
        <button class="btn btn-sm btn-primary" data-action="emp-open" data-id="${esc(e.id)}">👤 View Profile</button>
        ${W('hrms', `<button class="btn btn-sm" data-action="emp-edit" data-id="${esc(e.id)}" title="Edit Details" style="padding:4px 8px;margin-left:4px">✏️</button><button class="btn btn-sm btn-outline danger" data-action="emp-del" data-id="${esc(e.id)}" title="Delete Employee" style="padding:4px 8px;margin-left:4px">🗑️</button>`)}
      </td>
    </tr>`;
  });

  const DEPT_META = {
    'Administration Department': { icon: '🏢', color: '#f59e0b', bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.35)', desc: 'Office facilities, legal compliance, procurement & administration' },
    'Executive Leadership': { icon: '👑', color: '#ec4899', bg: 'rgba(236,72,153,0.14)', border: 'rgba(236,72,153,0.35)', desc: 'Strategic direction, executive governance, founders & board' },
    'Finance & Accounts Department': { icon: '💰', color: '#10b981', bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.35)', desc: 'Financial planning, accounting, vendor bills, payroll & compliance' },
    'Human Resources Department': { icon: '👥', color: '#8b5cf6', bg: 'rgba(139,92,246,0.14)', border: 'rgba(139,92,246,0.35)', desc: 'Talent hiring, HR operations, employee onboarding & records' },
    'Operations Department': { icon: '⚙️', color: '#06b6d4', bg: 'rgba(6,182,212,0.14)', border: 'rgba(6,182,212,0.35)', desc: 'On-site execution, equipment deployment, field operations & maintenance' },
    'Sales & Marketing Department': { icon: '📈', color: '#3b82f6', bg: 'rgba(59,130,246,0.14)', border: 'rgba(59,130,246,0.35)', desc: 'Client acquisition, pitches, CRM management & corporate revenue' },
    'Technology Department': { icon: '💻', color: '#6366f1', bg: 'rgba(99,102,241,0.14)', border: 'rgba(99,102,241,0.35)', desc: 'ANPR software, IoT hardware, AI algorithms & cloud engineering' }
  };

  const hrDeptCardsHtml = depts.map(dept => {
    const meta = DEPT_META[dept] || { icon: '📂', color: '#38bdf8', bg: 'rgba(56,189,248,0.14)', border: 'rgba(56,189,248,0.35)', desc: 'Department team and work operations' };
    const deptEmps = S.employees.filter(e => (e.dept || '') === dept);
    const actDeptEmps = deptEmps.filter(e => e.status === 'Active');
    const regDeptEmps = deptEmps.filter(e => e.status === 'Registered');
    const deptSalary = sum(actDeptEmps, e => e.salary || 0);

    const previewEmps = deptEmps.slice(0, 4);
    const remainingCount = deptEmps.length - previewEmps.length;
    const avatarsHtml = previewEmps.map(e => `
      <div title="${esc(e.name)} (${esc(e.role || 'Staff')})" style="display:inline-block;margin-right:-8px;border:2px solid var(--paper);border-radius:50%">
        ${avatar(e, 'sm')}
      </div>
    `).join('') + (remainingCount > 0 ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.12);color:var(--ink);font-size:11px;font-weight:700;border:2px solid var(--paper);margin-left:8px">+${remainingCount}</span>` : '');

    return `
      <div class="dept-overview-card" data-action="hr-dept-open" data-dept="${esc(dept)}" style="border-top: 4px solid ${meta.color}; cursor: pointer">
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
            <span class="sub">Active</span>
            <b style="color:#4ade80">${actDeptEmps.length}</b>
          </div>
          <div class="dept-card-stat-pill">
            <span class="sub">Onboarding</span>
            <b style="color:${regDeptEmps.length ? '#38bdf8' : 'var(--ink-2)'}">${regDeptEmps.length}</b>
          </div>
          <div class="dept-card-stat-pill">
            <span class="sub">Monthly Bill</span>
            <b style="font-size:13px;color:#38bdf8">${inr(deptSalary)}</b>
          </div>
        </div>

        <div class="dept-card-footer">
          <div style="display:flex;align-items:center">
            ${avatarsHtml}
          </div>
          <div style="display:flex;gap:8px" onclick="event.stopPropagation()">
            <button class="btn btn-sm btn-outline" data-action="hr-dept-tasks" data-dept="${esc(dept)}" title="Assign Daily Work">⚡ Daily Work</button>
            <button class="btn btn-sm btn-primary" data-action="hr-dept-open" data-dept="${esc(dept)}">📂 Open Staff (${deptEmps.length}) &raquo;</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return head('HRMS', 'Employees & ID Cards', `<b>${act.length}</b> active staff · <b>${registeredCount}</b> newly registered · monthly salary bill <b>${inr(sum(act, e => e.salary))}</b>`,
      W('hrms', '<button class="btn btn-primary" data-action="emp-new">Add new employee</button>'))
    + `<div class="tabs">
        <button class="tab-btn${tab === 'departments' ? ' active' : ''}" data-action="emp-tab" data-tab="departments">🏢 7 Department Cards (${depts.length})</button>
        <button class="tab-btn${tab === 'all' ? ' active' : ''}" data-action="emp-tab" data-tab="all">All Employees (${S.employees.length})</button>
        <button class="tab-btn${tab === 'registered' ? ' active' : ''}" data-action="emp-tab" data-tab="registered">Registered / Onboarding (${registeredCount})</button>
        <button class="tab-btn${tab === 'active' ? ' active' : ''}" data-action="emp-tab" data-tab="active">Active Staff (${act.length})</button>
      </div>`
    + (tab === 'departments'
        ? `<div style="margin:10px 0 16px;font-size:13px;color:var(--ink-2);display:flex;align-items:center;gap:8px">
             <span style="font-size:16px">ℹ️</span>
             <span><b>7 Department Cards:</b> Department card pe click karke us department ke sabhi employees aur unki salary dekh sakte hain.</span>
           </div>
           <div class="dept-cards-grid">${hrDeptCardsHtml}</div>`
        : `<div class="toolbar">${searchBox('hr-employees', 'Search name, code, role, phone or email')}${filterSel('dept', 'All departments', depts)}</div>`
          + (f ? `<div style="background:rgba(56,189,248,0.12);border:1px solid rgba(56,189,248,0.35);border-radius:8px;padding:9px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
                    <div><b>Filtered by Department:</b> <span style="color:#38bdf8;font-weight:700">${esc(f)}</span> (${rows.length} Employees)</div>
                    <button class="link-btn" data-action="hr-dept-clear" style="font-weight:700">✕ Clear Filter / View All</button>
                  </div>` : '')
          + (S.employees.length === 0 ? empty('No employees yet', 'Add your staff with their role and email. Login credentials will be generated, documents uploaded and ID cards created.', W('hrms', '<button class="btn btn-primary" data-action="emp-new">Add new employee</button>'))
            : rows.length === 0 ? empty('Nothing matches', 'Try a different tab, search or department filter.')
            : table([
                'Employee (Code & Designation)',
                'Contact',
                'Joined',
                { n: 'Offered / Mo' },
                { n: 'Expected / Mo' },
                { n: 'Status & Docs', width: '160px' },
                ''
              ], body)));
};

function employeeForm(e) {
  openForm({
    title: e ? 'Edit Employee Details' : 'Add Employee (Role, Expected & Agreed Salary)',
    wide: true,
    sub: e ? '' : 'Name, Role, Expected Salary aur Email enter karein. Save hote hi Portal Login generate hoga aur aap Profile me Original Documents upload karke ID Card nikaal sakenge.',
    fields: [
      { name: 'code', label: 'Employee Code', required: true, value: e ? e.code : nextNo('EMP-', S.employees, 'code', 3) },
      { name: 'name', label: 'Full Name', required: true, placeholder: 'e.g. Rahul Sharma' },
      { name: 'role', label: 'Role / Designation (kis role ke liye hai)', required: true, placeholder: 'e.g. Software Engineer, Sales Executive' },
      { name: 'email', label: 'Email (login credentials will be sent here)', type: 'email', required: true, placeholder: 'rahul@example.com' },
      { name: 'phone', label: 'Phone Number', type: 'tel', placeholder: '+91 9876543210' },
      { name: 'dept', label: 'Department', placeholder: 'IT, Sales, Operations, Accounts' },
      { name: 'joined', label: 'Date of Joining', type: 'date', required: true, value: e ? e.joined : today() },
      { name: 'expectedSalary', label: 'Candidate Expected Salary per month (₹)', type: 'number', min: 0, step: 'any', placeholder: 'e.g. 35000', value: e ? (e.expectedSalary || '') : '' },
      { name: 'salary', label: 'Agreed / Offered Gross Salary per month (₹)', type: 'number', min: 0, step: 'any', required: true, value: e ? e.salary : 25000 },
      { name: 'bloodGroup', label: 'Blood Group', placeholder: 'O+, A+, B+, AB+' },
      { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Registered', 'Left'], value: e ? e.status : 'Registered' },
      { name: 'dob', label: 'Date of Birth', type: 'date', max: today() },
      { name: 'address', label: 'Current Address', type: 'textarea', rows: 2, maxlength: 300 },
      { name: 'permAddress', label: 'Permanent Address', type: 'textarea', rows: 2, maxlength: 300 },
      { name: 'idType', label: 'ID Proof Type', type: 'select', placeholder: 'Choose ID type', options: ID_TYPES },
      { name: 'idNumber', label: 'ID Proof Number', maxlength: 40 },
      { name: 'emergencyName', label: 'Emergency Contact Person', maxlength: 80 },
      { name: 'emergencyPhone', label: 'Emergency Phone Number', type: 'tel' }
    ],
    values: e || {},
    onSubmit: async v => {
      if (e) {
        await dbUpdate('employees', e.id, v);
        toast('Employee details updated');
      } else {
        const newId = await dbAdd('employees', v);
        // Automatically generate portal login and credentials
        let creds = null, mailRes = null;
        try {
          creds = await api('POST', `/api/employees/${encodeURIComponent(newId)}/credentials`);
        } catch (err) {
          console.warn('Credentials generation error:', err);
        }

        const newEmp = S.employees.find(x => x.id === newId) || Object.assign({ id: newId }, v);

        // AUTOMATIC EMAIL DISPATCH ON REGISTRATION!
        if (newEmp.email) {
          try {
            mailRes = await api('POST', `/api/employees/${encodeURIComponent(newId)}/send-email`);
            toast(`Offer letter & joining confirmation sent automatically to ${newEmp.email}!`, 'good');
          } catch (mErr) {
            console.warn('Auto email error:', mErr);
          }
        }

        showRegistrationSuccessModal(newEmp, creds, mailRes);
        toast('Employee registered & documents generated!', 'good');
      }
    }
  });
}

ACT['emp-new'] = () => employeeForm(null);
ACT['emp-edit'] = el => employeeForm(S.employees.find(e => e.id === el.dataset.id));
ACT['emp-tab'] = el => { S.ui.tab = el.dataset.tab; scheduleRender(); };
ACT['hr-dept-open'] = (el, ev) => {
  if (ev && ev.target && ev.target.closest('button, select, input, a')) return;
  S.ui.filter.dept = el.dataset.dept;
  S.ui.tab = 'all';
  scheduleRender();
};
ACT['hr-dept-clear'] = () => {
  S.ui.filter.dept = '';
  scheduleRender();
};
ACT['hr-dept-tasks'] = el => {
  S.ui.activeDept = el.dataset.dept;
  S.ui.taskTab = 'board';
  location.hash = 'task-allocation';
};
ACT['emp-open'] = el => {
  const id = el.dataset.id;
  if (route() !== 'hr-employees') { S.ui.pendingProfile = id; location.hash = 'hr-employees'; return; }
  S.ui.profile = id; render();
  $('#main').scrollTop = 0; window.scrollTo(0, 0);
};
ACT['emp-back'] = () => { S.ui.profile = ''; scheduleRender(); };
ACT['emp-del'] = async el => {
  const e = S.employees.find(x => x.id === el.dataset.id); if (!e) return;
  if (await confirmBox('Delete employee?', `${e.name}, their photo, documents, logins and leave records will be deleted for good.`)) {
    S.ui.profile = '';
    save(() => dbDelete('employees', e.id), 'Employee deleted');
  }
};

/* Trigger Offer Letter modal */
ACT['emp-offer'] = el => {
  const e = S.employees.find(x => x.id === el.dataset.id);
  if (e) showOfferLetterModal(e);
};

/* Trigger Joining Letter modal */
ACT['emp-joining'] = el => {
  const e = S.employees.find(x => x.id === el.dataset.id);
  if (e) showJoiningLetterModal(e);
};

/* Trigger ID Card modal */
ACT['emp-idcard'] = el => {
  const e = S.employees.find(x => x.id === el.dataset.id);
  if (e) showIdCardModal(e);
};

/* Trigger Credentials & Letters modal */
ACT['emp-creds'] = async el => {
  const e = S.employees.find(x => x.id === el.dataset.id);
  if (!e) return;
  try {
    const creds = await api('POST', `/api/employees/${encodeURIComponent(e.id)}/credentials`);
    showRegistrationSuccessModal(e, creds, null);
  } catch (err) {
    showRegistrationSuccessModal(e, null, null);
  }
};

/* ---- one employee: photo, details, ID proof and documents ---- */
function profileView(D, e) {
  const files = S.files.filter(f => f.employeeId === e.id && f.kind !== 'photo').sort((a, b) => b.uploadedAt - a.uploadedAt);
  const miss = missingRecords(e);
  const fact = (k, v) => `<div><dt>${esc(k)}</dt><dd>${v ? esc(v) : '<span class="muted">Not recorded</span>'}</dd></div>`;
  const held = holdings().filter(i => i.takenById === e.id);
  const projects = S.projects.filter(p => p.status !== 'Completed' && (p.leadId === e.id || (p.memberIds || []).includes(e.id)));

  return `<a class="backlink" href="#hr-employees" data-action="emp-back">‹ Back to All Employees</a>
    <div class="profile-head">${avatar(e, 'lg')}
      <div class="grow">
        <div class="eyebrow">${esc(e.code)}</div>
        <h1>${esc(e.name)}</h1>
        <p class="vsub">${esc([e.role, e.dept].filter(Boolean).join(' · ') || 'Role not recorded')}</p>
        <p class="vsub">Joined ${fmtDate(e.joined)}${tenure(e.joined) ? ' · ' + esc(tenure(e.joined)) : ''}</p>
        <p style="margin-top:8px">
          ${e.status === 'Registered' ? stamp('Registered / Onboarding', 'info') : e.status === 'Left' ? stamp('Left', 'mute') : stamp('Active', 'good')}
          ${miss.length ? stamp('Missing ' + miss.join(', '), 'warn') : stamp('Records complete', 'good')}
        </p>
      </div>
      <div class="vactions">
        <button class="btn btn-primary" data-action="emp-offer" data-id="${esc(e.id)}">📄 Offer Letter</button>
        <button class="btn btn-primary" data-action="emp-joining" data-id="${esc(e.id)}">📜 Joining Letter</button>
        <button class="btn" data-action="emp-idcard" data-id="${esc(e.id)}">🪪 ID Card</button>
        <button class="btn" data-action="payslip-open" data-id="${esc(e.id)}">📄 Salary Slip</button>
        <button class="btn" data-action="emp-creds" data-id="${esc(e.id)}">✉️ Send / Resend Letters & Login</button>
        ${W('hrms', `
          <label class="btn" for="photoPick">${e.photoId ? 'Change Photo' : 'Upload Photo'}</label>
          <input type="file" id="photoPick" data-change="photo-pick" data-id="${esc(e.id)}" accept="image/jpeg,image/png,image/webp" hidden>
          <button class="btn" data-action="emp-edit" data-id="${esc(e.id)}">Edit Details</button>
        `)}
      </div>
    </div>

    <div class="stack">
      <!-- Official Documents & Letters Hub (Offer, Joining, ID Card, Salary Slip) -->
      <section class="card" style="border:1.5px solid var(--rule);background:var(--sheet)">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;border-bottom:1px solid var(--rule);padding-bottom:10px">
          <div>
            <h2 style="margin:0;font-size:17px;font-weight:900;color:var(--ink)">📜 Official Employee Documents & Letters</h2>
            <p class="card-sub" style="margin:2px 0 0">Click to view, print in A4, download PDF, or dispatch via official email.</p>
          </div>
          <span class="stamp stamp-good">Official RvmAiTech Records</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(210px, 1fr));gap:12px">
          <div style="background:var(--paper);border:1px solid var(--rule);border-radius:8px;padding:14px;display:flex;flex-direction:column;justify-content:space-between;gap:10px">
            <div>
              <div style="font-size:11px;font-weight:800;color:#38bdf8;text-transform:uppercase;letter-spacing:.05em">Pre-Joining</div>
              <div style="font-size:14px;font-weight:800;color:var(--ink);margin-top:2px">📄 Employment Offer Letter</div>
              <p style="font-size:11.5px;color:var(--ink-2);margin-top:4px">10 formal clauses, CTC breakdown & acceptance.</p>
            </div>
            <button class="btn btn-primary" data-action="emp-offer" data-id="${esc(e.id)}" style="width:100%">Open Offer Letter</button>
          </div>

          <div style="background:var(--paper);border:1px solid var(--rule);border-radius:8px;padding:14px;display:flex;flex-direction:column;justify-content:space-between;gap:10px">
            <div>
              <div style="font-size:11px;font-weight:800;color:#10b981;text-transform:uppercase;letter-spacing:.05em">Onboarding</div>
              <div style="font-size:14px;font-weight:800;color:var(--ink);margin-top:2px">📜 Joining Letter & Form</div>
              <p style="font-size:11.5px;color:var(--ink-2);margin-top:4px">Parts A–F: Form, assets & IT checklist.</p>
            </div>
            <button class="btn btn-primary" data-action="emp-joining" data-id="${esc(e.id)}" style="background:#059669;border-color:#059669;width:100%">Open Joining Form</button>
          </div>

          <div style="background:var(--paper);border:1px solid var(--rule);border-radius:8px;padding:14px;display:flex;flex-direction:column;justify-content:space-between;gap:10px">
            <div>
              <div style="font-size:11px;font-weight:800;color:#f47b20;text-transform:uppercase;letter-spacing:.05em">Identity Badge</div>
              <div style="font-size:14px;font-weight:800;color:var(--ink);margin-top:2px">🪪 Official ID Card</div>
              <p style="font-size:11.5px;color:var(--ink-2);margin-top:4px">Standard CR-80 corporate photo ID card.</p>
            </div>
            <button class="btn" data-action="emp-idcard" data-id="${esc(e.id)}" style="width:100%;font-weight:700">View ID Card</button>
          </div>

          <div style="background:var(--paper);border:1px solid var(--rule);border-radius:8px;padding:14px;display:flex;flex-direction:column;justify-content:space-between;gap:10px">
            <div>
              <div style="font-size:11px;font-weight:800;color:#60a5fa;text-transform:uppercase;letter-spacing:.05em">Payroll</div>
              <div style="font-size:14px;font-weight:800;color:var(--ink);margin-top:2px">🧾 Salary Statement / Payslip</div>
              <p style="font-size:11.5px;color:var(--ink-2);margin-top:4px">Monthly earnings, hours & deductions.</p>
            </div>
            <button class="btn" data-action="payslip-open" data-id="${esc(e.id)}" style="width:100%;font-weight:700">View Payslip</button>
          </div>

          <div style="background:var(--paper);border:1px solid var(--rule);border-radius:8px;padding:14px;display:flex;flex-direction:column;justify-content:space-between;gap:10px">
            <div>
              <div style="font-size:11px;font-weight:800;color:#a78bfa;text-transform:uppercase;letter-spacing:.05em">ESS Dispatch</div>
              <div style="font-size:14px;font-weight:800;color:var(--ink);margin-top:2px">✉️ Send Credentials & Letters</div>
              <p style="font-size:11.5px;color:var(--ink-2);margin-top:4px">Send login ID, password & documents to staff.</p>
            </div>
            <button class="btn" data-action="emp-creds" data-id="${esc(e.id)}" style="width:100%;font-weight:700">Dispatch Email</button>
          </div>
        </div>
      </section>

      <section class="card">
        <h2>Job and Pay</h2>
        <p class="card-sub">Role, joining and salary.</p>
        <dl class="facts">
          ${fact('Role / designation', e.role)}
          ${fact('Department', e.dept)}
          ${fact('Date of joining', e.joined ? fmtDate(e.joined) : '')}
          ${fact('Candidate expected salary', e.expectedSalary ? inr(e.expectedSalary) + ' / month' : 'Not recorded')}
          ${fact('Offered gross salary per month', inr(e.salary) + ' / month')}
          ${fact('Blood group', e.bloodGroup)}
          ${fact('Working on', projects.map(p => p.name + (p.leadId === e.id ? ' (lead)' : '')).join(', ') || (can('projects') ? 'No running project' : ''))}
          ${fact('Company items held', held.map(i => `${i.productName} × ${qty(outstanding(i))}`).join(', ') || (can('erp') ? 'Nothing' : ''))}
        </dl>
      </section>

      <section class="card">
        <h2>Contact and Addresses</h2>
        <p class="card-sub">Phone, email and address.</p>
        <dl class="facts">
          ${fact('Phone', e.phone)}
          ${fact('Email', e.email)}
          ${fact('Date of birth', e.dob ? fmtDate(e.dob) : '')}
          ${fact('Current address', e.address)}
          ${fact('Permanent address', e.permAddress)}
          ${fact('Emergency contact', [e.emergencyName, e.emergencyPhone].filter(Boolean).join(', '))}
        </dl>
      </section>

      <section class="card">
        <h2>Original Documents & Verification</h2>
        <p class="card-sub">${e.idType ? `${esc(e.idType)} number <b>${esc(e.idNumber || 'not recorded')}</b>` : 'ID proof type and number are not recorded yet.'} · Upload original scans of Aadhaar, PAN, Resume, Certificates in JPG, PNG, WEBP or PDF (up to 8 MB each).</p>
        ${W('hrms', `
          <div class="uploader">
            <select id="docKind" aria-label="Document type">${DOC_KINDS.map(k => `<option>${esc(k)}</option>`).join('')}</select>
            <input type="file" id="docPick" accept="image/jpeg,image/png,image/webp,application/pdf" aria-label="Choose a file">
            <button class="btn btn-primary" data-action="doc-upload" data-id="${esc(e.id)}">Upload Document</button>
          </div>
        `)}
        ${files.length ? `<div class="docs">${files.map(f => `
          <div class="doc">
            <a class="doc-thumb" href="/api/files/${esc(f.id)}" target="_blank" rel="noopener" aria-label="Open ${esc(f.name)}">
              ${f.mime.startsWith('image/') ? `<img src="/api/files/${esc(f.id)}" alt="" loading="lazy">` : 'PDF'}
            </a>
            <div class="doc-body">
              <div>${stamp(f.kind, 'info')}</div>
              <div class="doc-name">${esc(f.name)}</div>
              <div class="muted">${fileSize(f.size)} · ${fmtDate(isoOf(new Date(f.uploadedAt)))}</div>
              <div>
                <a class="link-btn" href="/api/files/${esc(f.id)}" target="_blank" rel="noopener">Open / Download</a>
                ${W('hrms', `<button class="link-btn danger" data-action="doc-del" data-id="${esc(f.id)}">Delete</button>`)}
              </div>
            </div>
          </div>`).join('')}</div>` : '<p class="muted">No original documents uploaded yet. Choose the type above, pick the file and click Upload Document.</p>'}
      </section>
    </div>`;
}

async function uploadFile(empId, kind, file) {
  if (!file) throw new UserError('Choose a file first.');
  if (file.size > 8 * 1024 * 1024) throw new UserError(`${file.name} is ${fileSize(file.size)}. The limit is 8 MB. Use a smaller photo or scan.`);
  await api('POST', `/api/employees/${encodeURIComponent(empId)}/files?kind=${encodeURIComponent(kind)}&name=${encodeURIComponent(file.name)}`, file, 'application/octet-stream');
  await refresh();
}
CHG['photo-pick'] = el => { const f = el.files[0]; if (f) save(() => uploadFile(el.dataset.id, 'photo', f), 'Photo saved'); };
ACT['doc-upload'] = el => {
  const pick = $('#docPick'), kind = $('#docKind').value;
  el.disabled = true;
  save(() => uploadFile(el.dataset.id, kind, pick.files[0]), `${kind} uploaded`).then(() => { el.disabled = false; });
};
ACT['doc-del'] = async el => {
  const f = S.files.find(x => x.id === el.dataset.id); if (!f) return;
  if (await confirmBox('Delete this document?', `${f.name} (${f.kind}) will be deleted for good.`)) save(() => api('DELETE', '/api/files/' + encodeURIComponent(f.id)).then(refresh), 'Document deleted');
};

/* ================= HRMS: Daily Work Reports ================= */
V['hr-worklogs'] = D => {
  const allLogs = (S.worklogs || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const fEmp = S.ui.filter.workEmp || '';
  const fDate = S.ui.filter.workDate || '';

  const emps = S.employees;
  let rows = allLogs;
  if (fEmp) rows = rows.filter(w => w.empId === fEmp);
  if (fDate) rows = rows.filter(w => w.date === fDate);

  const cardsHtml = rows.map(w => {
    const e = D.emp.get(w.empId) || { name: 'Unknown', role: '', code: '' };
    const p = w.projectId ? D.proj.get(w.projectId) : null;
    return `
      <div class="worklog-card">
        <div class="worklog-card-head">
          <div>
            <div class="worklog-who">${esc(e.name)} <span class="sub" style="display:inline">(${esc(e.code)})</span></div>
            <div class="worklog-sub">${esc([e.role, e.dept].filter(Boolean).join(' · '))} · <b>${fmtDate(w.date)}</b></div>
          </div>
          ${p ? `<span class="stamp stamp-info">${esc(p.name)}</span>` : '<span class="stamp stamp-mute">General Tasks</span>'}
        </div>
        <div class="worklog-section">
          <div class="worklog-section-title">Kal kya kiya tha (Accomplishments)</div>
          <p>${esc(w.yesterdayWork)}</p>
        </div>
        <div class="worklog-section">
          <div class="worklog-section-title">Aaj kya kaam hai (Today's Plan)</div>
          <p>${esc(w.todayWork)}</p>
        </div>
        ${w.blockers ? `<div class="worklog-blocker"><b>Blockers:</b> ${esc(w.blockers)}</div>` : ''}
      </div>`;
  }).join('');

  return head('HRMS', 'Daily Work Reports', `Review daily progress updates ("Kal kya kiya, aaj kya karenge") submitted by employees. Total <b>${allLogs.length}</b> reports`,
      `<button class="btn btn-primary" data-action="worklog-export">Export CSV</button>`)
    + `<div class="toolbar">
        <select id="flt-workEmp" data-change="filter" data-key="workEmp">
          <option value="">All Employees</option>
          ${emps.map(e => `<option value="${esc(e.id)}"${e.id === fEmp ? ' selected' : ''}>${esc(e.name)} (${esc(e.code)})</option>`).join('')}
        </select>
        <input type="date" id="flt-workDate" data-change="filter" data-key="workDate" value="${esc(fDate)}" max="${today()}" placeholder="Filter by date">
      </div>`
    + (allLogs.length === 0 ? empty('No daily work reports yet', 'Employees can submit their yesterday and today work updates from their Employee Self-Service portal.')
      : rows.length === 0 ? empty('Nothing matches', 'No reports found for the selected employee or date.')
      : `<div class="worklog-grid">${cardsHtml}</div>`);
};

ACT['worklog-export'] = () => {
  const allLogs = S.worklogs || [];
  const cell = v => { let s = String(v || ''); if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"'; return s; };
  const csv = [['Date', 'Employee Code', 'Employee Name', 'Project', 'Yesterday Work', 'Today Work', 'Blockers']]
    .concat(allLogs.map(w => {
      const e = S.employees.find(x => x.id === w.empId) || {};
      const p = S.projects.find(x => x.id === w.projectId) || {};
      return [w.date, e.code || '', e.name || '', p.name || 'General', w.yesterdayWork, w.todayWork, w.blockers || ''];
    })).map(r => r.map(cell).join(',')).join('\n');
  downloadText('daily-work-reports.csv', csv, 'text/csv');
};

/* ================= HRMS: Live Shift & Salary Calculations ================= */
function getLiveShiftMetrics(dateStr) {
  const t = dateStr || today();
  const ym = t.slice(0, 7);
  const dim = daysIn(ym);
  const now = new Date();

  // 8-Hour standard shift: 09:00 AM (9.0) to 05:00 PM (17.0)
  const startHour = 9.0;
  const shiftDuration = 8.0;
  const endHour = startHour + shiftDuration; // 17.0

  const curHours = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;

  let elapsed = 0;
  let statusText = '';
  let isShiftActive = false;

  if (curHours < startHour) {
    elapsed = 0;
    const minsToStart = Math.round((startHour - curHours) * 60);
    statusText = `Shift starts in ${Math.floor(minsToStart / 60)}h ${minsToStart % 60}m (09:00 AM - 05:00 PM)`;
  } else if (curHours >= endHour) {
    elapsed = shiftDuration;
    statusText = `Shift completed today (8.0 hrs full)`;
  } else {
    elapsed = curHours - startHour;
    isShiftActive = true;
    const h = Math.floor(elapsed);
    const m = Math.floor((elapsed - h) * 60);
    const s = Math.floor(((elapsed - h) * 60 - m) * 60);
    statusText = `Live: ${h}h ${pad(m)}m ${pad(s)}s elapsed`;
  }

  const shiftPct = Math.min(100, Math.max(0, Math.round((elapsed / shiftDuration) * 100)));

  const emps = activeEmps();
  let totalActiveHourlyRate = 0;
  let totalLiveEarnedToday = 0;
  let totalDailySalary = 0;

  const empMetrics = emps.map(e => {
    const gross = num(e.salary);
    const dailyRate = gross / dim;
    const hourlyRate = dailyRate / shiftDuration;
    const mark = markOf(e.id, t);

    let hoursWorked = 0;
    let earnedToday = 0;

    if (mark === 'P') {
      hoursWorked = elapsed;
      earnedToday = hourlyRate * hoursWorked;
      if (isShiftActive || curHours >= endHour) totalActiveHourlyRate += hourlyRate;
    } else if (mark === 'H') {
      hoursWorked = Math.min(shiftDuration / 2, elapsed);
      earnedToday = hourlyRate * hoursWorked;
      if (isShiftActive && elapsed <= shiftDuration / 2) totalActiveHourlyRate += hourlyRate;
    } else {
      hoursWorked = 0;
      earnedToday = 0;
    }

    totalDailySalary += dailyRate;
    totalLiveEarnedToday += earnedToday;

    return {
      e,
      mark,
      gross,
      dailyRate,
      hourlyRate,
      hoursWorked,
      earnedToday,
      pctWorked: Math.min(100, Math.max(0, Math.round((hoursWorked / shiftDuration) * 100)))
    };
  });

  return {
    t,
    ym,
    dim,
    elapsed,
    shiftDuration,
    shiftPct,
    statusText,
    isShiftActive,
    totalActiveHourlyRate,
    totalLiveEarnedToday,
    totalDailySalary,
    empMetrics
  };
}

let hrTickerTimer = null;
function startHrSalaryTicker() {
  if (hrTickerTimer) clearInterval(hrTickerTimer);
  hrTickerTimer = setInterval(() => {
    if (route() !== 'hr-home') {
      clearInterval(hrTickerTimer);
      hrTickerTimer = null;
      return;
    }
    const m = getLiveShiftMetrics();
    const elTotal = $('#liveSalaryTotalEarned');
    if (elTotal) elTotal.textContent = inr(Math.round(m.totalLiveEarnedToday * 100) / 100);

    const elBurn = $('#liveSalaryBurnRate');
    if (elBurn) elBurn.textContent = inr(Math.round(m.totalActiveHourlyRate * 100) / 100) + ' / hr';

    const elClock = $('#liveSalaryShiftClock');
    if (elClock) elClock.textContent = m.statusText;

    const elFill = $('#liveShiftProgressFill');
    if (elFill) elFill.style.width = `${m.shiftPct}%`;

    const elPctText = $('#liveShiftPctText');
    if (elPctText) elPctText.textContent = `${m.shiftPct}% of 8h shift`;

    m.empMetrics.forEach(item => {
      const elEmpEarned = $(`#liveEmpEarned_${item.e.id}`);
      if (elEmpEarned) elEmpEarned.textContent = inr(Math.round(item.earnedToday * 100) / 100);

      const elEmpHrs = $(`#liveEmpHrs_${item.e.id}`);
      if (elEmpHrs) elEmpHrs.textContent = `${item.hoursWorked.toFixed(1)} / 8h`;

      const elEmpFill = $(`#liveEmpFill_${item.e.id}`);
      if (elEmpFill) elEmpFill.style.width = `${item.pctWorked}%`;
    });
  }, 1000);
}

/* ================= HRMS: Salary & Monthly Working Hours Engine ================= */
function getMonthlySalaryHoursData(monthStr) {
  const month = monthStr || S.ui.payMonth || today().slice(0, 7);
  const p = month.split('-'), y = +p[0], m = +p[1];
  const dim = new Date(y, m, 0).getDate();
  const t = today();
  const now = new Date();

  // Elapsed hours today for live calculations (09:00 - 17:00 shift)
  const curHours = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const elapsedToday = curHours < 9 ? 0 : curHours >= 17 ? 8.0 : Math.max(0, curHours - 9);

  // Calculate total Sundays and expected standard working days
  let totalSundays = 0;
  for (let d = 1; d <= dim; d++) {
    const iso = y + '-' + pad(m) + '-' + pad(d);
    if (isSunday(iso)) totalSundays++;
  }
  const standardWorkingDays = Math.max(1, dim - totalSundays);
  const standardMonthlyHours = standardWorkingDays * 8.0;

  const emps = activeEmps();
  let totalGross = 0;
  let totalNet = 0;
  let totalCompanyHours = 0;
  let totalPresentDaysCount = 0;

  const empData = emps.map(e => {
    const gross = num(e.salary);
    const dailyRate = gross / dim;
    const hourlyRate = dailyRate / 8.0;
    const otRate = Math.round(hourlyRate * 1.5);

    let presentDays = 0;
    let halfDays = 0;
    let leaveDays = 0;
    let absentDays = 0;
    let unmarkedDays = 0;
    let hoursWorked = 0;

    const dailyLogs = [];

    for (let d = 1; d <= dim; d++) {
      const iso = y + '-' + pad(m) + '-' + pad(d);
      const isSun = isSunday(iso);
      const isFuture = iso > t;
      const isToday = iso === t;
      const mk = markOf(e.id, iso);

      let dayHours = 0;
      let dayStatus = '';

      if (isSun) {
        dayStatus = 'Sunday / Off';
        dayHours = 0;
      } else if (isFuture) {
        dayStatus = 'Upcoming';
        dayHours = 0;
      } else if (mk === 'P') {
        presentDays++;
        dayHours = isToday ? Math.min(8.0, Math.max(0, elapsedToday)) : 8.0;
        dayStatus = isToday && elapsedToday < 8.0 ? `Present (${dayHours.toFixed(1)}h on shift)` : 'Present (8.0h Full)';
      } else if (mk === 'H') {
        halfDays++;
        dayHours = isToday ? Math.min(4.0, Math.max(0, elapsedToday)) : 4.0;
        dayStatus = 'Half Day (4.0h)';
      } else if (mk === 'L' || mk === 'U') {
        leaveDays++;
        dayHours = 0;
        dayStatus = mk === 'U' ? 'Unpaid Leave (LOP)' : 'Approved Leave (Paid)';
      } else if (mk === 'A') {
        absentDays++;
        dayHours = 0;
        dayStatus = 'Absent (LOP)';
      } else {
        unmarkedDays++;
        dayHours = 0;
        dayStatus = 'Not Marked';
      }

      hoursWorked += dayHours;
      const dayEarned = mk === 'P' ? dailyRate : mk === 'H' ? dailyRate * 0.5 : (mk === 'L' || isSun) ? dailyRate : 0;

      // Overtime for this day:
      let otMap = {};
      try { otMap = typeof e.dailyOt === 'string' ? (JSON.parse(e.dailyOt || '{}') || {}) : (e.dailyOt || {}); } catch (err) { otMap = {}; }
      const otHours = otMap[iso] != null ? num(otMap[iso]) : 0;
      const otEarned = Math.round(otHours * otRate);
      const totalDailyEarned = Math.round(dayEarned + otEarned);

      dailyLogs.push({
        d,
        iso,
        dayName: DAYS[new Date(y, m - 1, d).getDay()],
        isSun,
        isToday,
        isFuture,
        mk,
        dayStatus,
        dayHours,
        otHours,
        otEarned,
        totalDayHours: dayHours + otHours,
        dayEarned,
        totalDailyEarned
      });
    }

    // Payroll deductions & Base Net Salary
    const lop = absentDays + (halfDays * 0.5);
    const payableDays = Math.max(0, dim - lop);
    const earnedGross = Math.round(gross * payableDays / dim);
    const pf = Math.round(earnedGross * 0.5 * 0.12);
    const pt = earnedGross > 15000 ? 200 : 0;
    const net = Math.max(0, earnedGross - pf - pt);

    // Project tasks incentives
    const empTasks = (S.tasks || []).filter(k => k.empId === e.id);
    const completedTasksThisMonth = empTasks.filter(k => {
      if (k.status !== 'Completed') return false;
      const dStr = k.completedOn || k.dueDate || '';
      return dStr.startsWith(month);
    });

    const taskIncentives = completedTasksThisMonth.map(k => {
      const inc = k.incentive ? num(k.incentive) : (k.priority === 'High' ? 500 : k.priority === 'Medium' ? 300 : 150);
      const p = (S.projects || []).find(pj => pj.id === k.projectId);
      return {
        id: k.id,
        title: k.title,
        projectId: k.projectId,
        projectName: p ? p.name : 'Direct Project',
        priority: k.priority || 'Medium',
        dueDate: k.dueDate,
        completedOn: k.completedOn || k.dueDate,
        incentive: inc
      };
    });
    const totalTaskIncentive = sum(taskIncentives, x => x.incentive);

    // Project Lead bonus for managed active or completed projects
    const leadProjects = (S.projects || []).filter(pj => pj.leadId === e.id && (pj.status === 'Running' || pj.status === 'Completed'));
    const projectLeadBonus = leadProjects.length * 1000;
    const totalProjectIncentive = totalTaskIncentive + projectLeadBonus;

    const totalOtHours = sum(dailyLogs, x => x.otHours);
    const totalOtPay = sum(dailyLogs, x => x.otEarned);
    const grandTotalPayout = net + totalOtPay + totalProjectIncentive;

    totalGross += gross;
    totalNet += grandTotalPayout;
    totalCompanyHours += hoursWorked + totalOtHours;
    totalPresentDaysCount += presentDays;

    const hoursPct = Math.min(100, Math.max(0, Math.round((hoursWorked / standardMonthlyHours) * 100)));

    return {
      e,
      gross,
      dailyRate,
      hourlyRate,
      otRate,
      presentDays,
      halfDays,
      leaveDays,
      absentDays,
      unmarkedDays,
      hoursWorked,
      totalOtHours,
      totalOtPay,
      taskIncentives,
      leadProjects,
      totalProjectIncentive,
      grandTotalPayout,
      standardMonthlyHours,
      hoursPct,
      lop,
      payableDays,
      earnedGross,
      pf,
      pt,
      net,
      shift: e.shift || 'Morning Shift (09:00 AM – 05:00 PM)',
      dailyLogs
    };
  });

  return {
    month,
    dim,
    standardWorkingDays,
    standardMonthlyHours,
    totalGross,
    totalNet,
    totalCompanyHours,
    totalPresentDaysCount,
    empData
  };
}

/* Modal for Employee Monthly Day-by-Day Hours breakdown (Dual Theme) */
function showEmpMonthlyHoursModal(e, monthStr) {
  if (!e) return;
  monthStr = monthStr || S.ui.payMonth || today().slice(0, 7);
  dlg.className = 'dlg dlg-wide';

  function renderModal(curMonth) {
    const data = getMonthlySalaryHoursData(curMonth);
    const item = data.empData.find(x => x.e.id === e.id) || {
      e, gross: num(e.salary), dailyRate: num(e.salary) / data.dim, hourlyRate: (num(e.salary) / data.dim) / 8,
      otRate: Math.round(((num(e.salary) / data.dim) / 8) * 1.5),
      presentDays: 0, halfDays: 0, leaveDays: 0, absentDays: 0, hoursWorked: 0, hoursPct: 0,
      totalOtHours: 0, totalOtPay: 0, taskIncentives: [], leadProjects: [], totalProjectIncentive: 0,
      payableDays: data.dim, net: num(e.salary), grandTotalPayout: num(e.salary),
      shift: e.shift || 'Morning Shift (09:00 AM – 05:00 PM)', dailyLogs: []
    };

    const dayRows = item.dailyLogs.map(log => {
      const rowCls = log.isToday ? ' class="today-row"' : log.isSun ? ' class="sun-row"' : '';
      const mkBadge = log.isSun ? stamp('Sunday Off', 'mute')
        : log.mk === 'P' ? stamp(log.isToday ? 'Present (Live)' : 'Present', 'good')
        : log.mk === 'H' ? stamp('Half Day', 'warn')
        : log.mk === 'L' ? stamp('Leave (Paid)', 'info')
        : log.mk === 'U' ? stamp('Leave (LOP)', 'bad')
        : log.mk === 'A' ? stamp('Absent', 'bad')
        : log.isFuture ? stamp('Upcoming', 'mute')
        : stamp('Not Marked', 'mute');

      return `<tr${rowCls}>
        <td><b>${pad(log.d)} ${monthName(curMonth).slice(0, 3)}</b></td>
        <td>${log.dayName}</td>
        <td>${mkBadge}</td>
        <td>${log.isSun ? '—' : esc(item.shift.split('(')[1] ? item.shift.split('(')[1].replace(')', '') : '09:00 AM – 05:00 PM')}</td>
        <td class="num"><span class="hours-badge${log.dayHours >= 8 ? ' full' : ''}">${log.dayHours.toFixed(1)} hrs</span></td>
        <td class="num">${log.otHours > 0 ? `<span class="hours-badge ot">+${log.otHours.toFixed(1)}h OT</span>` : '<span class="muted">—</span>'}</td>
        <td class="num">${inr(Math.round(log.dayEarned))}</td>
        <td class="num">${log.otEarned > 0 ? `<b style="color:var(--warn)">+${inr(log.otEarned)}</b>` : '<span class="muted">—</span>'}</td>
        <td class="num"><b>${inr(log.totalDailyEarned)}</b></td>
      </tr>`;
    }).join('');

    dlg.innerHTML = `
      <div class="form">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--rule);padding-bottom:12px;flex-wrap:wrap;gap:10px">
          <div style="display:flex;align-items:center;gap:12px">
            ${avatar(e)}
            <div>
              <h2 class="dlg-title" style="margin:0">Daily Hours & Attendance Sheet</h2>
              <p class="dlg-sub" style="margin:2px 0 0"><b>${esc(e.name)}</b> (${esc(e.code)}) · ${esc(e.role || 'Staff')} · ${esc(e.dept || 'Operations')}</p>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px" class="no-print">
            <button type="button" class="btn btn-sm" data-action="toggle-theme" title="Switch between Light & Dark theme">
              ${getAppTheme() === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
            <a href="#hr-timesheet" onclick="S.ui.timesheetEmpId='${esc(e.id)}'; dlg.close();" class="btn btn-sm" style="color:var(--accent);font-weight:700" title="Open Fullscreen Master View">⛶ Fullscreen Page</a>
            <span class="stepper">
              <button type="button" class="btn btn-sm" id="btnPrevHoursMonth" title="Previous Month">‹</button>
              <span class="cur" style="font-weight:700">${esc(monthName(curMonth))}</span>
              <button type="button" class="btn btn-sm" id="btnNextHoursMonth" title="Next Month"${curMonth >= today().slice(0, 7) ? ' disabled' : ''}>›</button>
            </span>
            <button type="button" class="btn btn-primary" onclick="printDoc('printableArea')">Print / PDF</button>
            <button type="button" class="btn" data-x="cancel">Close</button>
          </div>
        </div>

        <div style="padding:14px 0" id="printableArea">
          <div class="daily-hours-modal-grid">
            <div class="daily-hours-card">
              <div class="lbl">Month Hours Clocked</div>
              <div class="val" style="color:var(--accent)">${item.hoursWorked.toFixed(1)} <span style="font-size:13px;color:var(--ink-2)">/ ${data.standardMonthlyHours}h</span></div>
              <span class="sub-text">${item.hoursPct}% monthly target · 8h Standard</span>
            </div>
            <div class="daily-hours-card">
              <div class="lbl">Shift Standard & Rate</div>
              <div class="val" style="color:var(--good)">${inr(Math.round(item.hourlyRate * 100) / 100)} <span style="font-size:13px;color:var(--ink-2)">/ hr</span></div>
              <span class="sub-text">${esc(item.shift)}</span>
            </div>
            <div class="daily-hours-card">
              <div class="lbl">Overtime (OT) Clocked & Pay</div>
              <div class="val" style="color:var(--warn)">${item.totalOtHours.toFixed(1)}h <span style="font-size:13px;color:var(--ink-2)">(${inr(item.totalOtPay)})</span></div>
              <span class="sub-text">1.5x OT Rate: ${inr(item.otRate)} / hr</span>
            </div>
            <div class="daily-hours-card">
              <div class="lbl">Project Incentives</div>
              <div class="val" style="color:#0284c7">${inr(item.totalProjectIncentive)}</div>
              <span class="sub-text">${item.taskIncentives.length} delivered tasks & bonuses</span>
            </div>
            <div class="daily-hours-card">
              <div class="lbl">Total Take-Home Payout</div>
              <div class="val" style="color:var(--good)">${inr(item.grandTotalPayout)}</div>
              <span class="sub-text">Base: ${inr(item.net)} + OT: ${inr(item.totalOtPay)} + Inc: ${inr(item.totalProjectIncentive)}</span>
            </div>
          </div>

          <h3 style="font-size:14px;margin:16px 0 6px;text-transform:uppercase;letter-spacing:.04em;color:var(--ink)">
            Day-by-Day Hours, Overtime & Pay Log · ${esc(monthName(curMonth))}
          </h3>
          <table class="daily-hours-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Day</th>
                <th>Attendance</th>
                <th>Shift Window</th>
                <th class="num">Regular Hrs</th>
                <th class="num">Overtime</th>
                <th class="num">Daily Earned</th>
                <th class="num">OT Pay</th>
                <th class="num">Daily Total</th>
              </tr>
            </thead>
            <tbody>
              ${dayRows}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4">Total Month Summary (${data.dim} Days)</td>
                <td class="num"><span class="hours-badge full">${item.hoursWorked.toFixed(1)} hrs</span></td>
                <td class="num"><span class="hours-badge ot">+${item.totalOtHours.toFixed(1)} hrs OT</span></td>
                <td class="num"><b>${inr(item.net)}</b></td>
                <td class="num"><b style="color:var(--warn)">+${inr(item.totalOtPay)}</b></td>
                <td class="num"><b style="color:var(--good);font-size:14px">${inr(item.net + item.totalOtPay)}</b></td>
              </tr>
            </tfoot>
          </table>

          ${item.taskIncentives.length || item.leadProjects.length ? `
            <div class="card" style="margin-top:16px;border:1px solid var(--rule);padding:14px">
              <h4 style="margin:0 0 8px;font-size:14px;color:var(--ink);display:flex;align-items:center;gap:8px">
                🏆 Project Work Reports & Performance Incentives (${inr(item.totalProjectIncentive)})
              </h4>
              <table class="daily-hours-table" style="margin:0">
                <thead>
                  <tr>
                    <th>Task / Deliverable</th>
                    <th>Project</th>
                    <th>Priority</th>
                    <th>Completed Date</th>
                    <th class="num">Incentive Earned</th>
                  </tr>
                </thead>
                <tbody>
                  ${item.taskIncentives.map(k => `
                    <tr>
                      <td><b>${esc(k.title)}</b></td>
                      <td>${esc(k.projectName)}</td>
                      <td><span class="task-badge task-prio-${esc(k.priority)}">${esc(k.priority)}</span></td>
                      <td>${fmtDate(k.completedOn)}</td>
                      <td class="num"><b style="color:var(--good)">+${inr(k.incentive)}</b></td>
                    </tr>
                  `).join('')}
                  ${item.leadProjects.map(pj => `
                    <tr>
                      <td><b>Project Leadership & Delivery Bonus</b></td>
                      <td>${esc(pj.name)}</td>
                      <td><span class="stamp stamp-good">Project Lead</span></td>
                      <td>${fmtDate(today())}</td>
                      <td class="num"><b style="color:var(--good)">+₹1,000</b></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
        </div>
      </div>`;

    const prevBtn = $('#btnPrevHoursMonth', dlg);
    const nextBtn = $('#btnNextHoursMonth', dlg);
    if (prevBtn) prevBtn.onclick = () => renderModal(shiftMonth(curMonth, -1));
    if (nextBtn) nextBtn.onclick = () => renderModal(shiftMonth(curMonth, 1));
  }

  renderModal(monthStr);
  dlg.showModal();
}
window.showEmpMonthlyHoursModal = showEmpMonthlyHoursModal;

/* ================= 2. HRMS Dedicated Salary & Hours Dashboard ================= */
V['hr-salary-hub'] = D => {
  const month = S.ui.payMonth || today().slice(0, 7);
  const cur = today().slice(0, 7);
  const data = getMonthlySalaryHoursData(month);
  const emps = activeEmps();

  const bodyRows = data.empData.map(item => {
    const e = item.e;
    return `<tr>
      <td>
        <button class="link-btn person" data-action="emp-open" data-id="${esc(e.id)}" style="padding:0;text-align:left">
          ${avatar(e)}
          <div>
            <b style="color:var(--ink)">${esc(e.name)}</b>
            <span class="sub" style="font-weight:400">${esc(e.code)} · ${esc(e.role || 'Staff')} (${esc(e.dept || '—')})</span>
          </div>
        </button>
      </td>
      <td class="num">${inr(item.gross)}</td>
      <td class="num"><span class="live-hourly-badge">${inr(Math.round(item.hourlyRate * 100) / 100)} / hr</span></td>
      <td>
        <span class="stamp stamp-good" title="Present days">${item.presentDays} P</span>
        ${item.halfDays ? `<span class="stamp stamp-warn" title="Half days">${item.halfDays} H</span>` : ''}
        ${item.leaveDays ? `<span class="stamp stamp-info" title="Leave days">${item.leaveDays} L</span>` : ''}
        ${item.absentDays ? `<span class="stamp stamp-bad" title="Absent days">${item.absentDays} A</span>` : ''}
      </td>
      <td class="nowrap">
        <div class="hours-bar-wrap"><div class="hours-bar-fill" style="width:${item.hoursPct}%"></div></div>
        <button class="link-btn" data-action="emp-hours" data-id="${esc(e.id)}" style="font-weight:800;font-family:monospace;font-size:12.5px" title="Click to view daily hours breakdown">
          ${item.hoursWorked.toFixed(1)} / ${data.standardMonthlyHours}h
        </button>
      </td>
      <td class="num"><b>${inr(item.grandTotalPayout)}</b></td>
      <td class="acts">
        <a href="#hr-timesheet" onclick="S.ui.timesheetEmpId='${esc(e.id)}'" class="btn btn-sm" style="color:var(--accent);font-weight:700" title="Open Fullscreen Timesheet">⏱️ Timesheet</a>
        <button class="btn btn-sm" data-action="emp-hours" data-id="${esc(e.id)}" style="color:#0284c7;border-color:#0284c7">Breakdown</button>
        <button class="btn btn-sm btn-primary" data-action="payslip-open" data-id="${esc(e.id)}">📄 Salary Slip</button>
      </td>
    </tr>`;
  });

  const footRow = `<tr>
    <td><b>Total (${plural(emps.length, 'staff')})</b></td>
    <td class="num"><b>${inr(data.totalGross)}</b></td>
    <td></td>
    <td><b>${data.totalPresentDaysCount} P total</b></td>
    <td class="num"><b>${data.totalCompanyHours.toFixed(1)} hours</b></td>
    <td class="num"><b style="color:#16a34a">${inr(data.totalNet)}</b></td>
    <td></td>
  </tr>`;

  const topHero = `
    <div class="live-salary-hero" style="background:linear-gradient(135deg,#0a192f 0%,#1e3a8a 50%,#0f172a 100%)">
      <div class="live-salary-top">
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
          <img src="/logo.png" alt="RvmAiTech" style="height:38px;object-fit:contain">
          <div>
            <h2 style="margin:0;font-size:20px;font-weight:800;color:#fff">Monthly Salary & Working Hours Master Dashboard</h2>
            <p style="margin:2px 0 0;font-size:12.5px;color:rgba(255,255,255,0.75)">
              Full month attendance breakdown, 8-hour shift hours clocked & monthly net salaries · <b>${monthName(month)}</b>
            </p>
          </div>
        </div>
        <div class="live-pulse-badge">
          <span class="live-pulse-dot"></span>
          8-HR SHIFT ENGINE
        </div>
      </div>

      <div class="live-meter-grid">
        <div class="live-meter-card">
          <div class="live-meter-label">Total Monthly Gross Payroll</div>
          <div class="live-meter-val">${inr(data.totalGross)}</div>
          <div class="live-meter-sub">Budget for ${emps.length} active employees</div>
        </div>
        <div class="live-meter-card">
          <div class="live-meter-label">Total Net Take-Home Pay</div>
          <div class="live-meter-val good">${inr(data.totalNet)}</div>
          <div class="live-meter-sub">After PF & LOP deductions</div>
        </div>
        <div class="live-meter-card">
          <div class="live-meter-label">Total Staff Hours Clocked</div>
          <div class="live-meter-val cyan">${data.totalCompanyHours.toFixed(1)} <span style="font-size:13px;color:rgba(255,255,255,0.7)">hrs</span></div>
          <div class="live-meter-sub">Expected Standard: ${data.standardMonthlyHours}h / staff (${data.standardWorkingDays} working days)</div>
        </div>
        <div class="live-meter-card">
          <div class="live-meter-label">Standard Shift Schedule</div>
          <div class="live-meter-val" style="font-size:20px">09:00 – 17:00</div>
          <div class="live-meter-sub">8 Hours / Day · Real-time hourly tracking</div>
        </div>
      </div>
    </div>`;

  return head('HRMS', 'Salary & Hours Dashboard', `Complete monthly record for <b>${monthName(month)}</b> · ${plural(emps.length, 'employee')}`,
      `<span class="stepper">
        <button class="btn btn-sm" data-action="salary-hub-month" data-dir="-1" aria-label="Previous month">‹</button>
        <span class="cur" style="font-weight:700">${esc(monthName(month))}</span>
        <button class="btn btn-sm" data-action="salary-hub-month" data-dir="1" aria-label="Next month"${month >= cur ? ' disabled' : ''}>›</button>
      </span>
      <a href="#hr-timesheet" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:6px">⏱️ Fullscreen Master Timesheet</a>
      <button class="btn" data-action="salary-hours-csv">📊 Export CSV</button>
      <button class="btn" onclick="printDoc('printableArea')">🖨️ Print Sheet</button>`)
    + (emps.length === 0 ? empty('No active employees', 'Add employees with a monthly salary to view the salary and hours dashboard.', '<a class="btn btn-primary" href="#hr-employees">Add employee</a>')
      : topHero
        + `<div class="stack" style="margin-top:16px">
            <section class="card" id="printableArea">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
                <div>
                  <h2 style="margin:0">All Staff Monthly Salary & Hours Breakdown</h2>
                  <p class="card-sub" style="margin:2px 0 0">Click <b>⏱️ Daily Hours</b> to see all days of the month with hours worked. Click <b>📄 Salary Slip</b> to print official payslip.</p>
                </div>
              </div>
              ${table(['Employee', { n: 'Monthly Gross' }, { n: 'Hourly Rate (8h)' }, 'Attendance (P / H / L / A)', 'Month Hours Clocked', { n: 'Net Salary' }, ''], bodyRows, footRow)}
            </section>
          </div>`);
};

/* ================= 3. HRMS Fullscreen Staff Timesheet & Tracking View ================= */
V['hr-timesheet'] = D => {
  const month = S.ui.payMonth || today().slice(0, 7);
  const data = getMonthlySalaryHoursData(month);
  const emps = activeEmps();
  const t = today();

  // Selected employee: default to first active staff so screen is NEVER empty!
  const q = String(S.ui.timesheetQ || '').trim().toLowerCase();
  let curEmp = null;
  if (S.ui.timesheetEmpId) {
    curEmp = emps.find(x => x.id === S.ui.timesheetEmpId) || null;
  }
  if (!curEmp && q) {
    curEmp = emps.find(e => (e.code || '').toLowerCase() === q)
      || emps.find(e => (e.name || '').toLowerCase() === q)
      || emps.find(e => (e.code || '').toLowerCase().includes(q))
      || emps.find(e => (e.name || '').toLowerCase().includes(q));
    if (curEmp) S.ui.timesheetEmpId = curEmp.id;
  }
  if (!curEmp && emps.length) {
    curEmp = emps[0];
    S.ui.timesheetEmpId = curEmp.id;
  }
  const item = curEmp ? (data.empData.find(x => x.e.id === curEmp.id) || data.empData[0]) : null;

  // Real-time live shift status for selected employee today
  const todayMark = curEmp ? markOf(curEmp.id, t) : '';
  const now = new Date();
  const currentHourDecimal = now.getHours() + (now.getMinutes() / 60);
  const elapsedToday = Math.max(0, Math.min(8.0, currentHourDecimal - 9.0));
  const shiftProgressPct = Math.min(100, Math.round((elapsedToday / 8.0) * 100));

  // Today's active tasks for this employee
  const todayTasks = (S.tasks || []).filter(k => k.empId === (curEmp ? curEmp.id : '') && (k.dueDate === t || (k.dueDate < t && k.status !== 'Completed')));
  const mainTodayTask = todayTasks[0];

  return `
    <div class="timesheet-fullpage">
      <!-- Top Action Bar (Clean: No Mongo Pill, No Light Mode, No Fullscreen) -->
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;border-bottom:2px solid var(--rule);padding-bottom:14px">
        <div>
          <h1 style="margin:0;font-size:24px;display:flex;align-items:center;gap:10px">
            ⏱️ Staff Timesheet & Live Tracking Master
          </h1>
          <p class="muted" style="margin:4px 0 0;font-size:13px">
            Employee Search by ID · Monthly Working Hours · Overtime Pay · Project Work Incentives · Shift Management
          </p>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span class="stepper">
            <button class="btn btn-sm" data-action="pay-month" data-dir="-1" aria-label="Previous month">‹</button>
            <span class="cur" style="font-weight:700">${esc(monthName(month))}</span>
            <button class="btn btn-sm" data-action="pay-month" data-dir="1" aria-label="Next month"${month >= t.slice(0, 7) ? ' disabled' : ''}>›</button>
          </span>
          <button class="btn btn-primary btn-sm" onclick="printDoc('printableArea')">🖨️ Print / PDF</button>
        </div>
      </div>

      <!-- Employee Search Strip (Search by ID or Name only - No Pills) -->
      <div class="card" style="padding:16px 20px">
        <div class="timesheet-search-wrap" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <div style="flex:1;min-width:260px;position:relative">
            <input type="search" class="timesheet-search-input" id="tsSearchInput" list="tsStaffDatalist" data-input="ts-search" placeholder="🔍 Search Employee ID (e.g. EMP-001, EMP-002) or Name..." value="${esc(S.ui.timesheetQ || (curEmp ? curEmp.code : ''))}" style="width:100%">
            <datalist id="tsStaffDatalist">
              ${emps.map(e => `<option value="${esc(e.code)}">${esc(e.code)} - ${esc(e.name)} (${esc(e.dept || '—')})</option>`).join('')}
            </datalist>
          </div>
          <button class="btn btn-primary" data-action="ts-do-search" type="button">🔍 Open Staff</button>
          ${curEmp ? `<button class="btn" data-action="ts-clear-search" type="button">✕ Reset Search</button>` : ''}
          ${curEmp ? `<span class="badge" style="background:#EFF6FF;color:#1D4ED8;font-weight:800;padding:6px 12px">Loaded: ${esc(curEmp.code)} · ${esc(curEmp.name)} (${esc(curEmp.dept || '—')})</span>` : ''}
        </div>
      </div>

      ${curEmp && item ? `
        <!-- Live Staff Tracking & Shift Allocation Hero -->
        <div class="timesheet-hero">
          <div class="timesheet-hero-top">
            <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
              ${avatar(curEmp, 'lg')}
              <div>
                <div style="display:flex;align-items:center;gap:10px">
                  <h2 style="margin:0;font-size:22px;color:#fff">${esc(curEmp.name)}</h2>
                  <span class="badge" style="background:rgba(255,255,255,0.2);color:#fff;font-weight:800">${esc(curEmp.code)}</span>
                  <span class="badge" style="background:rgba(34,197,94,0.25);color:#4ade80;font-weight:700">ACTIVE EMPLOYEE</span>
                </div>
                <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.85)">
                  ${esc(curEmp.role || 'Team Member')} · Department: <b>${esc(curEmp.dept || 'Operations')}</b> · Joined: ${fmtDate(curEmp.joined)}
                </p>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <button class="btn btn-sm btn-primary" data-action="payslip-open" data-id="${esc(curEmp.id)}">📄 Salary Slip</button>
              <button class="btn btn-sm" data-action="emp-open" data-id="${esc(curEmp.id)}" style="color:#fff;border-color:rgba(255,255,255,0.4)">👤 Edit Profile</button>
            </div>
          </div>

          <div class="timesheet-tracking-grid">
            <!-- Left: Live Shift Tracking -->
            <div class="timesheet-tracking-box">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <span style="font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,0.7)">
                  Live Daily Staff Tracking · Today (${fmtDate(t)})
                </span>
                ${todayMark === 'P' ? '<span class="stamp stamp-good" style="font-weight:800">● Live on Shift</span>'
                  : todayMark === 'H' ? '<span class="stamp stamp-warn">Half Day Shift</span>'
                  : todayMark === 'L' ? '<span class="stamp stamp-info">On Approved Leave</span>'
                  : '<span class="stamp stamp-bad">Not Checked In Today</span>'}
              </div>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:12px">
                <div>
                  <div style="font-size:11px;color:rgba(255,255,255,0.6)">Punch-In Time</div>
                  <div style="font-size:16px;font-weight:700;color:#fff">${todayMark === 'P' ? '09:00 AM' : '—'}</div>
                </div>
                <div>
                  <div style="font-size:11px;color:rgba(255,255,255,0.6)">Today Hours Elapsed</div>
                  <div style="font-size:16px;font-weight:700;color:#38bdf8">${todayMark === 'P' ? elapsedToday.toFixed(1) + ' / 8.0h' : '0.0h'}</div>
                </div>
                <div>
                  <div style="font-size:11px;color:rgba(255,255,255,0.6)">Today Earned Meter</div>
                  <div style="font-size:16px;font-weight:700;color:#4ade80">${todayMark === 'P' ? inr(Math.round(item.hourlyRate * elapsedToday)) : inr(0)}</div>
                </div>
              </div>
              <div style="margin-bottom:10px">
                <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:4px;color:rgba(255,255,255,0.8)">
                  <span>Shift Progress (${shiftProgressPct}%)</span>
                  <span>Standard 8h Shift (09:00 - 17:00)</span>
                </div>
                <div style="height:8px;background:rgba(255,255,255,0.15);border-radius:4px;overflow:hidden">
                  <div style="height:100%;width:${todayMark === 'P' ? shiftProgressPct : 0}%;background:linear-gradient(90deg,#38bdf8,#22c55e);border-radius:4px"></div>
                </div>
              </div>
              <div style="font-size:12px;color:rgba(255,255,255,0.85);background:rgba(0,0,0,0.2);padding:8px 12px;border-radius:6px">
                <b>Assigned Project / Task Today:</b> ${mainTodayTask ? esc(mainTodayTask.title) : 'General Operations / No critical blockers logged.'}
              </div>
            </div>

            <!-- Right: Shift Management & Quick OT Assign -->
            <div class="timesheet-tracking-box">
              <span style="font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,0.7);display:block;margin-bottom:8px">
                Shift Management & Allocation
              </span>
              <p style="font-size:12.5px;color:rgba(255,255,255,0.8);margin-bottom:12px">
                Current Active Shift: <b style="color:#fff">${esc(item.shift)}</b>
              </p>
              <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px">
                <select id="empShiftSelect" style="flex:1;padding:8px 10px;border-radius:6px;font-size:12.5px;background:#0f172a;color:#fff;border:1px solid rgba(255,255,255,0.25)">
                  ${[
                    'Morning Shift (09:00 AM – 05:00 PM)',
                    'Evening Shift (02:00 PM – 10:00 PM)',
                    'Night Shift (10:00 PM – 06:00 AM)',
                    'Flexible 8-Hour Shift (Flexi)'
                  ].map(sh => `<option value="${sh}"${item.shift === sh ? ' selected' : ''}>${sh}</option>`).join('')}
                </select>
                <button class="btn btn-sm btn-primary" data-action="save-emp-shift" data-id="${esc(curEmp.id)}">Assign Shift</button>
              </div>

              <div style="border-top:1px solid rgba(255,255,255,0.12);padding-top:10px">
                <span style="font-size:11.5px;font-weight:700;color:rgba(255,255,255,0.7);display:block;margin-bottom:6px">
                  ⚡ Record Overtime (OT) for Today:
                </span>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  ${[1, 2, 3, 4].map(h => `
                    <button class="btn btn-sm" data-action="add-emp-ot" data-id="${esc(curEmp.id)}" data-hours="${h}" style="color:#fff;border-color:rgba(255,255,255,0.3);padding:4px 8px;font-size:11.5px">
                      +${h}h OT (${inr(h * item.otRate)})
                    </button>
                  `).join('')}
                  ${(curEmp.dailyOt && curEmp.dailyOt[t]) ? `
                    <button class="btn btn-sm" data-action="clear-emp-ot" data-id="${esc(curEmp.id)}" style="color:#f87171;border-color:rgba(248,113,113,0.4);padding:4px 8px;font-size:11.5px">
                      ✕ Reset OT
                    </button>
                  ` : ''}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 5 Key Monthly Metrics -->
        <div class="daily-hours-modal-grid">
          <div class="daily-hours-card">
            <div class="lbl">Month Hours Clocked</div>
            <div class="val" style="color:var(--accent)">${item.hoursWorked.toFixed(1)} <span style="font-size:13px;color:var(--ink-2)">/ ${data.standardMonthlyHours}h</span></div>
            <span class="sub-text">${item.hoursPct}% monthly target · 8h Daily Standard</span>
          </div>
          <div class="daily-hours-card">
            <div class="lbl">Shift Standard & Rate</div>
            <div class="val" style="color:var(--good)">${inr(Math.round(item.hourlyRate * 100) / 100)} <span style="font-size:13px;color:var(--ink-2)">/ hr</span></div>
            <span class="sub-text">Daily Base Rate: ${inr(Math.round(item.dailyRate))} / day</span>
          </div>
          <div class="daily-hours-card">
            <div class="lbl">Overtime Clocked & Pay</div>
            <div class="val" style="color:var(--warn)">${item.totalOtHours.toFixed(1)}h <span style="font-size:13px;color:var(--ink-2)">(${inr(item.totalOtPay)})</span></div>
            <span class="sub-text">1.5x OT Rate: ${inr(item.otRate)} / hr</span>
          </div>
          <div class="daily-hours-card">
            <div class="lbl">Project Incentives</div>
            <div class="val" style="color:#0284c7">${inr(item.totalProjectIncentive)}</div>
            <span class="sub-text">${item.taskIncentives.length} delivered tasks & bonuses</span>
          </div>
          <div class="daily-hours-card">
            <div class="lbl">Total Monthly Payout</div>
            <div class="val" style="color:var(--good)">${inr(item.grandTotalPayout)}</div>
            <span class="sub-text">Base Net (${inr(item.net)}) + OT + Incentives</span>
          </div>
        </div>

        <!-- Day by Day Hours, Attendance & Overtime Log -->
        <div class="card" style="padding:16px 20px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:10px">
            <div>
              <h3 style="margin:0;font-size:16px;color:var(--ink)">
                📅 Day-by-Day Hours, Attendance & Overtime Log · ${esc(monthName(month))}
              </h3>
              <p class="muted" style="margin:2px 0 0;font-size:12px">
                Attendance marks, shift windows, clocked regular hours, overtime bonuses, and daily earnings.
              </p>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="stamp stamp-good">${item.presentDays} Days Present</span>
              <span class="stamp stamp-warn">${item.halfDays} Half Days</span>
              <span class="stamp stamp-info">${item.leaveDays} Leaves</span>
              <span class="stamp stamp-bad">${item.absentDays} Absent</span>
            </div>
          </div>

          <table class="daily-hours-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Day</th>
                <th>Attendance</th>
                <th>Shift Window</th>
                <th class="num">Regular Hrs</th>
                <th class="num">Overtime</th>
                <th class="num">Daily Earned</th>
                <th class="num">OT Pay</th>
                <th class="num">Total Daily</th>
              </tr>
            </thead>
            <tbody>
              ${item.dailyLogs.map(log => {
                const rowCls = log.isToday ? ' class="today-row"' : log.isSun ? ' class="sun-row"' : '';
                const mkBadge = log.isSun ? stamp('Sunday Off', 'mute')
                  : log.mk === 'P' ? stamp(log.isToday ? 'Present (Live)' : 'Present', 'good')
                  : log.mk === 'H' ? stamp('Half Day', 'warn')
                  : log.mk === 'L' ? stamp('Leave (Paid)', 'info')
                  : log.mk === 'U' ? stamp('Leave (LOP)', 'bad')
                  : log.mk === 'A' ? stamp('Absent', 'bad')
                  : log.isFuture ? stamp('Upcoming', 'mute')
                  : stamp('Not Marked', 'mute');

                return `<tr${rowCls}>
                  <td><b>${pad(log.d)} ${monthName(month).slice(0, 3)}</b></td>
                  <td>${log.dayName}</td>
                  <td>${mkBadge}</td>
                  <td>${log.isSun ? '—' : esc(item.shift.split('(')[1] ? item.shift.split('(')[1].replace(')', '') : '09:00 AM – 05:00 PM')}</td>
                  <td class="num"><span class="hours-badge${log.dayHours >= 8 ? ' full' : ''}">${log.dayHours.toFixed(1)} hrs</span></td>
                  <td class="num">${log.otHours > 0 ? `<span class="hours-badge ot">+${log.otHours.toFixed(1)}h OT</span>` : '<span class="muted">—</span>'}</td>
                  <td class="num">${inr(Math.round(log.dayEarned))}</td>
                  <td class="num">${log.otEarned > 0 ? `<b style="color:var(--warn)">+${inr(log.otEarned)}</b>` : '<span class="muted">—</span>'}</td>
                  <td class="num"><b>${inr(log.totalDailyEarned)}</b></td>
                </tr>`;
              }).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4">Total Month Summary (${data.dim} Days)</td>
                <td class="num"><span class="hours-badge full">${item.hoursWorked.toFixed(1)} hrs</span></td>
                <td class="num"><span class="hours-badge ot">+${item.totalOtHours.toFixed(1)} hrs OT</span></td>
                <td class="num"><b>${inr(item.net)}</b></td>
                <td class="num"><b style="color:var(--warn)">+${inr(item.totalOtPay)}</b></td>
                <td class="num"><b style="color:var(--good);font-size:14px">${inr(item.net + item.totalOtPay)}</b></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Project Work Reports & Task Incentives Section -->
        <div class="card" style="padding:16px 20px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:10px">
            <div>
              <h3 style="margin:0;font-size:16px;color:var(--ink)">
                🏆 Project Work Reports & Performance Incentives (${inr(item.totalProjectIncentive)})
              </h3>
              <p class="muted" style="margin:2px 0 0;font-size:12px">
                Incentives earned from successfully delivered client project milestones, tasks, and project management.
              </p>
            </div>
            <a href="#projects" class="btn btn-sm">📁 View All Projects</a>
          </div>

          ${item.taskIncentives.length || item.leadProjects.length ? `
            <table class="daily-hours-table" style="margin:0">
              <thead>
                <tr>
                  <th>Task Title / Milestone</th>
                  <th>Client Project Name</th>
                  <th>Priority</th>
                  <th>Completed Date</th>
                  <th class="num">Incentive Earned</th>
                </tr>
              </thead>
              <tbody>
                ${item.taskIncentives.map(k => `
                  <tr>
                    <td><b>${esc(k.title)}</b></td>
                    <td>${esc(k.projectName)}</td>
                    <td><span class="task-badge task-prio-${esc(k.priority)}">${esc(k.priority)}</span></td>
                    <td>${fmtDate(k.completedOn)}</td>
                    <td class="num"><b style="color:var(--good);font-size:13px">+${inr(k.incentive)}</b></td>
                  </tr>
                `).join('')}
                ${item.leadProjects.map(pj => `
                  <tr>
                    <td><b>Project Lead / Manager Milestone Delivery Bonus</b></td>
                    <td>${esc(pj.name)}</td>
                    <td><span class="stamp stamp-good">Project Lead</span></td>
                    <td>${fmtDate(today())}</td>
                    <td class="num"><b style="color:var(--good);font-size:13px">+₹1,000</b></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `
            <div class="empty" style="padding:24px;text-align:center">
              <p class="muted">No project tasks marked as Completed in ${monthName(month)} yet. Completed project tasks automatically earn task incentives based on priority!</p>
            </div>
          `}
        </div>
      ` : `
        <div class="card" style="text-align:center;padding:40px 20px;border:1px dashed var(--rule);border-radius:var(--radius-card);background:var(--sheet);margin-top:14px">
          <div style="font-size:36px;margin-bottom:8px">🔍</div>
          <h3 style="font-size:18px;color:var(--ink);margin-bottom:6px">No Employee Found</h3>
          <p class="muted" style="margin:0 0 14px">Please enter a valid Employee ID (e.g. <b>EMP-001</b>, <b>EMP-002</b>) in the search bar above.</p>
          <button class="btn btn-sm btn-primary" data-action="ts-clear-search">Load Default Staff</button>
        </div>
      `}
    </div>
  `;
};

ACT['ts-do-search'] = () => {
  const input = $('#tsSearchInput');
  const val = input ? input.value.trim() : (S.ui.timesheetQ || '');
  const emps = activeEmps();
  if (!val) {
    S.ui.timesheetEmpId = emps.length ? emps[0].id : null;
    S.ui.timesheetQ = '';
    scheduleRender();
    return;
  }
  S.ui.timesheetQ = val;
  const qLower = val.toLowerCase();
  const match = emps.find(e => (e.code || '').toLowerCase() === qLower)
    || emps.find(e => (e.name || '').toLowerCase() === qLower)
    || emps.find(e => (e.code || '').toLowerCase().includes(qLower))
    || emps.find(e => (e.name || '').toLowerCase().includes(qLower));

  if (match) {
    S.ui.timesheetEmpId = match.id;
    toast(`Staff Loaded: ${match.code} · ${match.name}`);
  } else {
    toast(`No staff found for "${val}". Please check Employee ID (e.g. EMP-001).`, 'warn');
  }
  scheduleRender();
};

ACT['ts-clear-search'] = () => {
  S.ui.timesheetQ = '';
  const emps = activeEmps();
  S.ui.timesheetEmpId = emps.length ? emps[0].id : null;
  scheduleRender();
};

ACT['select-timesheet-emp'] = el => {
  S.ui.timesheetEmpId = el.dataset.id;
  scheduleRender();
};

ACT['save-emp-shift'] = async el => {
  const empId = el.dataset.id;
  const sel = $('#empShiftSelect');
  if (!sel) return;
  const shift = sel.value;
  try {
    await api('PATCH', '/api/data/employees/' + empId, { shift });
    toast('Shift assigned to employee successfully!');
    await refresh();
  } catch (err) {
    toast(err.message || 'Could not update shift', 'bad');
  }
};

ACT['add-emp-ot'] = async el => {
  const empId = el.dataset.id;
  const hours = num(el.dataset.hours);
  const emp = S.employees.find(x => x.id === empId);
  if (!emp) return;
  let otMap = {};
  try { otMap = typeof emp.dailyOt === 'string' ? (JSON.parse(emp.dailyOt || '{}') || {}) : Object.assign({}, emp.dailyOt || {}); } catch (e) { otMap = {}; }
  otMap[today()] = (otMap[today()] || 0) + hours;
  try {
    await api('PATCH', '/api/data/employees/' + empId, { dailyOt: JSON.stringify(otMap) });
    toast(`+${hours}h Overtime added for today!`);
    await refresh();
  } catch (err) {
    toast(err.message || 'Could not record overtime', 'bad');
  }
};

ACT['clear-emp-ot'] = async el => {
  const empId = el.dataset.id;
  const emp = S.employees.find(x => x.id === empId);
  if (!emp) return;
  let otMap = {};
  try { otMap = typeof emp.dailyOt === 'string' ? (JSON.parse(emp.dailyOt || '{}') || {}) : Object.assign({}, emp.dailyOt || {}); } catch (e) { otMap = {}; }
  delete otMap[today()];
  try {
    await api('PATCH', '/api/data/employees/' + empId, { dailyOt: JSON.stringify(otMap) });
    toast('Overtime reset for today.');
    await refresh();
  } catch (err) {
    toast(err.message || 'Could not reset overtime', 'bad');
  }
};

ACT['toggle-fullscreen'] = () => {
  document.body.classList.toggle('is-fullscreen');
  const isFs = document.body.classList.contains('is-fullscreen');
  if (isFs && document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else if (!isFs && document.exitFullscreen && document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
  const btn = $('#btnToggleFs');
  if (btn) btn.textContent = isFs ? '✕ Exit Fullscreen' : '⛶ Fullscreen';
};

document.addEventListener('input', ev => {
  const el = ev.target.closest('[data-input="ts-search"]');
  if (el) {
    const val = el.value.trim();
    S.ui.timesheetQ = val;
    if (!val) {
      S.ui.timesheetEmpId = null;
      scheduleRender();
    } else {
      const emps = activeEmps();
      const exactMatch = emps.find(e => (e.code || '').toLowerCase() === val.toLowerCase());
      if (exactMatch) {
        S.ui.timesheetEmpId = exactMatch.id;
        scheduleRender();
      }
    }
  }
});

document.addEventListener('keydown', ev => {
  if (ev.key === 'Enter') {
    const el = ev.target && ev.target.closest && ev.target.closest('[data-input="ts-search"]');
    if (el) {
      ev.preventDefault();
      if (ACT['ts-do-search']) ACT['ts-do-search']();
    }
  }
});

ACT['emp-hours'] = el => {
  const e = S.employees.find(x => x.id === el.dataset.id);
  if (e) showEmpMonthlyHoursModal(e, S.ui.payMonth || today().slice(0, 7));
};

ACT['salary-hub-month'] = el => {
  S.ui.payMonth = shiftMonth(S.ui.payMonth || today().slice(0, 7), num(el.dataset.dir));
  scheduleRender();
};

ACT['salary-hours-csv'] = () => {
  const month = S.ui.payMonth || today().slice(0, 7);
  const data = getMonthlySalaryHoursData(month);
  const cell = v => { let s = String(v != null ? v : ''); if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"'; return s; };
  const csv = [['Employee Code', 'Full Name', 'Role', 'Department', 'Gross Salary', 'Daily Rate', 'Hourly Rate', 'Present Days', 'Half Days', 'Leave Days', 'Absent Days', 'Total Hours Worked', 'Standard Expected Hours', 'Net Salary']]
    .concat(data.empData.map(d => [
      d.e.code || '', d.e.name || '', d.e.role || '', d.e.dept || '',
      d.gross, Math.round(d.dailyRate), d.hourlyRate.toFixed(2),
      d.presentDays, d.halfDays, d.leaveDays, d.absentDays,
      d.hoursWorked.toFixed(1), d.standardMonthlyHours, d.net
    ])).map(r => r.map(cell).join(',')).join('\n');
  downloadText('salary-hours-' + month + '.csv', csv, 'text/csv');
};

/* ================= HRMS: dashboard ================= */
V['hr-home'] = D => {
  const t = today(), emps = activeEmps(), marks = emps.map(e => [e, markOf(e.id, t)]);
  const present = marks.filter(x => x[1] === 'P' || x[1] === 'H').length, onLeave = marks.filter(x => x[1] === 'L' || x[1] === 'U'), absent = marks.filter(x => x[1] === 'A');
  const anyMarked = marks.some(x => x[1]);
  const incomplete = emps.map(e => [e, missingRecords(e)]).filter(x => x[1].length);
  const depts = [...new Set(emps.map(e => e.dept || 'No department'))].map(d => { const n = emps.filter(e => (e.dept || 'No department') === d).length; return { name: d, value: n, text: `<b>${n}</b>` }; }).sort((a, b) => b.value - a.value);

  // Calculate real-time 8-hour shift salary metrics
  const metrics = getLiveShiftMetrics(t);
  setTimeout(startHrSalaryTicker, 50);

  // Live salary table rows for every employee
  const liveRows = metrics.empMetrics.map(item => {
    const e = item.e;
    const mk = item.mark;
    const statusBadge = mk === 'P' ? stamp('Present', 'good')
      : mk === 'H' ? stamp('Half Day (4h)', 'warn')
      : mk === 'L' || mk === 'U' ? stamp('On Leave', 'info')
      : mk === 'A' ? stamp('Absent', 'bad')
      : stamp('Not Marked', 'mute');

    return `<tr>
      <td>
        <button class="link-btn person" data-action="emp-open" data-id="${esc(e.id)}" style="padding:0;text-align:left">
          ${avatar(e)}
          <div>
            <b style="color:var(--ink)">${esc(e.name)}</b>
            <span class="sub" style="font-weight:400">${esc(e.code)} · ${esc(e.role || 'Staff')} (${esc(e.dept || '—')})</span>
          </div>
        </button>
      </td>
      <td>${statusBadge}</td>
      <td class="num">${inr(item.gross)}</td>
      <td class="num"><b>${inr(Math.round(item.dailyRate))}</b><span class="sub">/ day</span></td>
      <td class="num"><span class="live-hourly-badge">${inr(Math.round(item.hourlyRate * 100) / 100)} / hr</span></td>
      <td class="nowrap">
        <div class="live-mini-bar"><div class="live-mini-bar-fill" id="liveEmpFill_${esc(e.id)}" style="width:${item.pctWorked}%"></div></div>
        <span class="sub" id="liveEmpHrs_${esc(e.id)}" style="display:inline;font-weight:600">${item.hoursWorked.toFixed(1)} / 8h</span>
      </td>
      <td class="num">
        <span class="live-emp-earned-badge" id="liveEmpEarned_${esc(e.id)}">${inr(Math.round(item.earnedToday * 100) / 100)}</span>
      </td>
      <td class="acts">
        <button class="btn btn-sm btn-primary" data-action="payslip-open" data-id="${esc(e.id)}" title="View and print official salary slip">📄 Salary Slip</button>
        <button class="link-btn" data-action="emp-open" data-id="${esc(e.id)}">Profile</button>
      </td>
    </tr>`;
  });

  const liveHeroHtml = `
    <div class="live-salary-hero">
      <div class="live-salary-top">
        <div class="live-salary-title-group" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
          <img src="/logo.png" alt="RvmAiTech" style="height:36px;object-fit:contain">
          <div>
            <h2>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              Live Daily & Hourly Salary Tracker
            </h2>
            <p>8-Hour Shift Standard (09:00 AM – 05:00 PM) · Real-time hourly salary rate & daily earned meter for all employees</p>
          </div>
        </div>
        <div class="live-pulse-badge">
          <span class="live-pulse-dot"></span>
          LIVE 8-HR SHIFT TICKER
        </div>
      </div>

      <div class="live-meter-grid">
        <div class="live-meter-card">
          <div class="live-meter-label">Live Salary Earned Today</div>
          <div class="live-meter-val good" id="liveSalaryTotalEarned">${inr(Math.round(metrics.totalLiveEarnedToday * 100) / 100)}</div>
          <div class="live-meter-sub">Ticking live across ${present} staff currently on shift</div>
        </div>

        <div class="live-meter-card">
          <div class="live-meter-label">Active Hourly Burn Rate</div>
          <div class="live-meter-val cyan" id="liveSalaryBurnRate">${inr(Math.round(metrics.totalActiveHourlyRate * 100) / 100)} / hr</div>
          <div class="live-meter-sub">Total ₹/hour wage running for active employees</div>
        </div>

        <div class="live-meter-card">
          <div class="live-meter-label">8-Hour Shift Status</div>
          <div class="live-meter-val" id="liveShiftPctText" style="font-size:20px">${metrics.shiftPct}% of 8h shift</div>
          <div class="live-meter-sub" id="liveSalaryShiftClock">${metrics.statusText}</div>
        </div>

        <div class="live-meter-card">
          <div class="live-meter-label">Today's Shift Attendance</div>
          <div class="live-meter-val" style="font-size:22px">${present} <span style="font-size:14px;color:rgba(255,255,255,0.6)">/ ${emps.length} Active</span></div>
          <div class="live-meter-sub">${absent.length} absent · ${onLeave.length} on leave · Full Day Bill: ${inr(Math.round(metrics.totalDailySalary))}</div>
        </div>
      </div>

      <div class="live-shift-progress">
        <span style="font-weight:700">09:00 AM</span>
        <div class="live-shift-bar">
          <div class="live-shift-fill" id="liveShiftProgressFill" style="width:${metrics.shiftPct}%"></div>
        </div>
        <span style="font-weight:700">05:00 PM (8h)</span>
      </div>
    </div>`;

  const items = [];
  if (D.attn.unmarked) items.push(attnItem('#hr-attendance', 'Attendance is not marked for today', `${plural(emps.length, 'employee')} to mark`, false));
  D.attn.pending.slice(0, 4).forEach(l => items.push(attnItem('#hr-leave', `${esc(empName(D, l.empId))} asked for ${plural(num(l.days), 'day')} of ${esc(String(l.type).toLowerCase())} leave`, `From ${fmtDay(l.from)} · waiting for a decision`, false)));
  absent.forEach(([e]) => items.push(attnItem('#hr-attendance', `${esc(e.name)} is absent today`, esc([e.role, e.dept].filter(Boolean).join(' · ')), true)));
  incomplete.slice(0, 5).forEach(([e, miss]) => items.push(`<li><a href="#hr-employees" data-action="emp-open" data-id="${esc(e.id)}"><span class="t">${esc(e.name)}: ${esc(miss.join(', '))} missing</span><span class="s">Open the profile to add it</span></a></li>`));
  if (incomplete.length > 5) items.push(attnItem('#hr-employees', `${incomplete.length - 5} more profiles are incomplete`, 'See the Records column in the employee list', false));

  const tiles = `<div class="tiles">
    ${tile('Active staff', String(emps.length), `${S.employees.length - emps.length} have left`, '#hr-employees')}
    ${tile('In today', anyMarked ? `${present}<span class="muted" style="font-size:.55em"> of ${emps.length}</span>` : '—', anyMarked ? `${absent.length} absent` : isSunday(t) ? 'Sunday, weekly off' : 'not marked yet', '#hr-attendance')}
    ${tile('On leave today', String(onLeave.length), onLeave.map(x => esc(x[0].name)).join(', ') || 'nobody', '#hr-leave')}
    ${tile('Leave requests', String(D.attn.pending.length), 'waiting for a decision', '#hr-leave')}
  </div>`;

  return head('HRMS', 'HR Dashboard & Live Salary Meter', `${DAYS[parseISO(t).getDay()]}, ${fmtDate(t)} · Monthly Salary Bill <b>${inr(sum(emps, e => e.salary))}</b>`,
      W('hrms', '<a class="btn" href="#hr-attendance">Mark Attendance</a><button class="btn btn-primary" data-action="emp-new">Add Employee</button>'))
    + (S.employees.length === 0 ? empty('No employees yet', 'Add your staff to start marking attendance, tracking live salaries and printing payslips.', W('hrms', '<button class="btn btn-primary" data-action="emp-new">Add Employee</button>'))
      : liveHeroHtml
        + `<div class="stack" style="margin-bottom:24px">
            <section class="card">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
                <div>
                  <h2 style="margin:0">All Employees Live Salary & Shift Tracker</h2>
                  <p class="card-sub" style="margin:2px 0 0">Live salary earned today calculated by 8-hour shift standard (₹/day = Gross ÷ ${metrics.dim}, ₹/hr = Daily ÷ 8). Click <b>Salary Slip</b> to view or print official payslip.</p>
                </div>
                <div class="vactions">
                  <a class="btn btn-sm" href="#hr-payroll">Go to Monthly Payroll</a>
                </div>
              </div>
              ${table(['Employee', 'Today Status', { n: 'Monthly Gross' }, { n: 'Daily Rate' }, { n: 'Hourly Rate (8h)' }, 'Shift Worked', { n: 'Live Earned Today' }, ''], liveRows)}
            </section>
          </div>`
        + tiles
        + `<div class="cols"><div class="stack">
            <section class="card"><h2>Staff by Department</h2><p class="card-sub">Active employees.</p>${hbars(depts)}</section>
            <section class="card"><h2>Employee Records & Docs</h2><p class="card-sub">Photo, addresses, and ID documents on file.</p><table class="mini"><tr><td>Profiles complete</td><td class="num"><b>${emps.length - incomplete.length}</b> of ${emps.length}</td></tr><tr><td>With photo</td><td class="num">${emps.filter(e => e.photoId).length}</td></tr><tr><td>With ID proof</td><td class="num">${emps.filter(e => S.files.some(f => f.employeeId === e.id && f.kind === 'ID proof')).length}</td></tr><tr><td>Original documents on file</td><td class="num">${S.files.filter(f => f.kind !== 'photo').length}</td></tr></table></section>
          </div>
          <section class="card"><h2>Needs Attention</h2><p class="card-sub">Attendance, leave requests and pending records.</p>${attnList(items, 'All clear. Attendance is marked and every profile is complete.')}</section></div>`);
};

/* ================= HRMS: attendance ================= */
function writeMarks(date, marks) { return api('PUT', '/api/attendance/' + date, { marks }).then(refresh); }

function openAttEditor(empId, ym) {
  const e = S.employees.find(x => x.id === empId);
  if (!e) return toast('Employee not found', 'bad');
  const t = today(), dim = new Date(+ym.slice(0, 4), +ym.slice(5), 0).getDate();

  const daysList = [];
  let pCnt = 0, otCnt = 0, aCnt = 0, hCnt = 0, lCnt = 0, noneCnt = 0;

  for (let d = 1; d <= dim; d++) {
    const iso = ym + '-' + pad(d);
    if (iso > t) break;
    const mk = markOf(e.id, iso);
    const sun = isSunday(iso);
    const dt = parseISO(iso);
    const dayName = DAYS[dt.getDay()];

    if (mk === 'O' || (sun && mk === 'P')) otCnt++;
    else if (mk === 'P') pCnt++;
    else if (mk === 'A') aCnt++;
    else if (mk === 'H') hCnt++;
    else if (mk === 'L' || mk === 'U') lCnt++;
    else if (!sun) noneCnt++;

    daysList.push({
      iso,
      dayNum: d,
      dayName,
      sun,
      mk,
      dt
    });
  }

  dlg.className = 'dlg dlg-wide';
  dlg.innerHTML = `
    <div class="form" style="max-height:85vh; display:flex; flex-direction:column;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid var(--rule); padding-bottom:12px; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
        <div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-family:monospace; background:rgba(59,130,246,0.18); color:#60a5fa; border:1px solid rgba(59,130,246,0.35); padding:2px 8px; border-radius:4px; font-weight:700; font-size:12px;">${esc(e.code || 'EMP')}</span>
            <h2 class="dlg-title" style="margin:0; font-size:18px;">Edit Attendance: ${esc(e.name)}</h2>
          </div>
          <p class="dlg-sub" style="margin:4px 0 0 0; color:var(--ink-2); font-size:12.5px;">${esc([e.role, e.dept].filter(Boolean).join(' · '))} · <b>${esc(monthName(ym))}</b></p>
        </div>
        <button type="button" class="btn btn-sm" data-x="cancel">✕ Close</button>
      </div>

      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px; font-size:12.5px;">
        <span class="stamp stamp-good"><b>${pCnt}</b> Present</span>
        <span class="stamp" style="background:rgba(234,88,12,0.18); color:#fb923c; border:1px solid rgba(234,88,12,0.35);"><b>${otCnt}</b> Overtime (OT)</span>
        <span class="stamp ${aCnt ? 'stamp-bad' : 'stamp-mute'}"><b>${aCnt}</b> Absent</span>
        <span class="stamp ${hCnt ? 'stamp-warn' : 'stamp-mute'}"><b>${hCnt}</b> Half day</span>
        <span class="stamp ${lCnt ? 'stamp-info' : 'stamp-mute'}"><b>${lCnt}</b> Leave</span>
        <span class="stamp stamp-mute"><b>${noneCnt}</b> Not marked</span>
      </div>

      <div style="overflow-y:auto; flex:1; border:1px solid var(--rule); border-radius:8px; margin-bottom:14px;">
        <table class="tbl" style="margin:0; width:100%;">
          <thead>
            <tr>
              <th style="width:140px;">Date &amp; Day</th>
              <th style="width:130px;">Type</th>
              <th style="width:110px;">Status</th>
              <th>Quick Mark Action</th>
            </tr>
          </thead>
          <tbody>
            ${daysList.map(item => {
              const curMark = item.mk;
              return `<tr style="${item.sun ? 'background:rgba(245,158,11,0.06);' : ''}">
                <td class="nowrap">
                  <b>${fmtDate(item.iso)}</b>
                  <span class="sub">${item.dayName}</span>
                </td>
                <td>
                  ${item.sun ? `<span style="background:rgba(245,158,11,0.15); color:#fbbf24; border:1px solid rgba(245,158,11,0.3); padding:2px 6px; border-radius:4px; font-size:11px; font-weight:600;">Sunday Off</span>` : '<span class="muted" style="font-size:11.5px;">Working Day</span>'}
                </td>
                <td>
                  ${curMark === 'P' ? '<span class="stamp stamp-good">Present</span>' :
                    curMark === 'O' ? '<span class="stamp" style="background:#ea580c; color:#fff;">Overtime (OT)</span>' :
                    curMark === 'A' ? '<span class="stamp stamp-bad">Absent</span>' :
                    curMark === 'H' ? '<span class="stamp stamp-warn">Half Day</span>' :
                    curMark === 'L' || curMark === 'U' ? '<span class="stamp stamp-info">Leave</span>' :
                    '<span class="muted" style="font-size:11.5px;">Not marked</span>'}
                </td>
                <td>
                  <div class="seg" role="group" aria-label="Mark for ${item.iso}">
                    <button type="button" class="m-P" data-action="att-edit-set" data-emp="${esc(e.id)}" data-date="${item.iso}" data-mark="P" data-month="${ym}" aria-pressed="${curMark === 'P'}">P</button>
                    <button type="button" class="m-O" data-action="att-edit-set" data-emp="${esc(e.id)}" data-date="${item.iso}" data-mark="O" data-month="${ym}" aria-pressed="${curMark === 'O'}" title="${item.sun ? 'Sunday Overtime' : 'Overtime'}">OT</button>
                    <button type="button" class="m-A" data-action="att-edit-set" data-emp="${esc(e.id)}" data-date="${item.iso}" data-mark="A" data-month="${ym}" aria-pressed="${curMark === 'A'}">A</button>
                    <button type="button" class="m-H" data-action="att-edit-set" data-emp="${esc(e.id)}" data-date="${item.iso}" data-mark="H" data-month="${ym}" aria-pressed="${curMark === 'H'}">H</button>
                    <button type="button" class="m-L" data-action="att-edit-set" data-emp="${esc(e.id)}" data-date="${item.iso}" data-mark="L" data-month="${ym}" aria-pressed="${curMark === 'L'}">L</button>
                    <button type="button" data-action="att-edit-set" data-emp="${esc(e.id)}" data-date="${item.iso}" data-mark="" data-month="${ym}" title="Clear attendance mark">✕</button>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div class="dlg-actions" style="margin-top:0;">
        <button type="button" class="btn btn-primary" data-x="cancel">Done</button>
      </div>
    </div>
  `;
  dlg.showModal();
}

V['hr-attendance'] = D => {
  const date = S.ui.attDate, t = today(), allEmps = activeEmps();
  const ym = date.slice(0, 7), dim = new Date(+ym.slice(0, 4), +ym.slice(5), 0).getDate();
  const d = parseISO(date);
  const sunday = isSunday(date);

  // Departments for dropdown
  const depts = Array.from(new Set(allEmps.map(e => e.dept).filter(Boolean))).sort();

  // Search & Filter
  const q = (S.ui.q.attendance || '').toLowerCase().trim();
  const fDept = S.ui.filter['att-dept'] || '';

  const filteredEmps = allEmps.filter(e => {
    if (fDept && e.dept !== fDept) return false;
    if (q) {
      const match = [e.name, e.code, e.role, e.dept].join(' ').toLowerCase();
      if (!match.includes(q)) return false;
    }
    return true;
  });

  // Pagination (exactly 30 per page)
  const perPage = 30;
  const totalPages = Math.max(1, Math.ceil(filteredEmps.length / perPage));
  if (!S.ui.attPage || S.ui.attPage < 1) S.ui.attPage = 1;
  if (S.ui.attPage > totalPages) S.ui.attPage = totalPages;
  const page = S.ui.attPage;
  const pageEmps = filteredEmps.slice((page - 1) * perPage, page * perPage);

  // Count stats for today
  const count = { P: 0, O: 0, A: 0, H: 0, L: 0, U: 0, '': 0 };
  allEmps.forEach(e => {
    const mk = markOf(e.id, date);
    count[mk] = (count[mk] || 0) + 1;
  });

  // Daily Marking Rows (Paged)
  const rows = pageEmps.map(e => {
    const explicit = (S.attendance[date] || {})[e.id] || '', mk = markOf(e.id, date), lv = !explicit && leaveOn(e.id, date);
    const shown = mk === 'U' ? 'L' : mk;
    const markButtons = ['P', 'O', 'A', 'H', 'L'].map(k => {
      const label = k === 'O' ? 'OT' : MARKS[k];
      const title = k === 'O' ? (sunday ? 'Sunday Overtime (OT)' : 'Overtime (OT)') : MARKS[k];
      return `<button type="button" class="m-${k}" data-action="att-mark" data-emp="${esc(e.id)}" data-mark="${k}" aria-pressed="${shown === k}" title="${esc(title)}"${can('hrms') ? '' : ' disabled'}>${label}</button>`;
    }).join('');

    return `<div class="att-row" style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); gap:12px; flex-wrap:wrap;">
      <div class="att-who" style="display:flex; flex-direction:column; gap:3px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-family:monospace; background:rgba(59,130,246,0.18); color:#60a5fa; border:1px solid rgba(59,130,246,0.35); padding:2px 7px; border-radius:4px; font-weight:700; font-size:12px;">${esc(e.code || 'EMP')}</span>
          <b style="font-size:14.5px; color:#f8fafc;">${esc(e.name)}</b>
        </div>
        <span style="font-size:12px; color:#94a3b8;">${esc([e.role, e.dept].filter(Boolean).join(' · '))}${lv ? ` · on approved ${esc(String(lv.type).toLowerCase())} leave` : ''}</span>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <div class="seg" role="group" aria-label="Attendance for ${esc(e.name)}">${markButtons}</div>
        <button class="btn btn-sm btn-outline" data-action="att-edit-emp" data-id="${esc(e.id)}" data-month="${esc(ym)}" title="Edit full month attendance for ${esc(e.name)}" style="padding:4px 9px; font-size:12px;">✏️ Edit</button>
      </div>
    </div>`;
  });

  // Monthly Summary Rows (Paged)
  const sumRows = pageEmps.map(e => {
    const c = { P: 0, OT: 0, A: 0, H: 0, L: 0, none: 0 };
    for (let d = 1; d <= dim; d++) {
      const iso = ym + '-' + pad(d);
      if (iso > t) break;
      const mk = markOf(e.id, iso);
      const sun = isSunday(iso);
      if (mk === 'O' || (sun && mk === 'P')) {
        c.OT++;
      } else if (mk === 'U' || mk === 'L') {
        c.L++;
      } else if (mk === 'P') {
        c.P++;
      } else if (mk === 'A') {
        c.A++;
      } else if (mk === 'H') {
        c.H++;
      } else if (!sun) {
        c.none++;
      }
    }
    return `<tr>
      <td>
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-family:monospace; background:rgba(59,130,246,0.18); color:#60a5fa; border:1px solid rgba(59,130,246,0.35); padding:2px 7px; border-radius:4px; font-weight:700; font-size:12px;">${esc(e.code || 'EMP')}</span>
          <b>${esc(e.name)}</b>
        </div>
        <div style="font-size:11.5px; color:#94a3b8; margin-top:2px;">${esc([e.role, e.dept].filter(Boolean).join(' · '))}</div>
      </td>
      <td class="num font-bold" style="color:#34d399;">${c.P}</td>
      <td class="num font-bold">${c.OT ? `<span style="background:rgba(234,88,12,0.18); color:#fb923c; border:1px solid rgba(234,88,12,0.35); padding:2px 8px; border-radius:12px; font-weight:700;">${c.OT} OT</span>` : '0'}</td>
      <td class="num${c.A ? ' due font-bold' : ''}">${c.A}</td>
      <td class="num">${c.H}</td>
      <td class="num">${c.L}</td>
      <td class="num muted">${c.none || '—'}</td>
      <td class="acts">
        <button class="btn btn-sm btn-outline" data-action="att-edit-emp" data-id="${esc(e.id)}" data-month="${esc(ym)}" title="Edit full month attendance for ${esc(e.name)}">✏️ Edit</button>
      </td>
    </tr>`;
  });

  // Pagination HTML
  const paginationHtml = filteredEmps.length > perPage ? `
    <div class="pagination" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; padding:10px 16px; margin:14px 0; background:rgba(15,23,42,0.7); border:1px solid #1e3a68; border-radius:8px;">
      <div class="page-info" style="font-size:13px; color:#94a3b8;">
        Showing <b>${(page - 1) * perPage + 1}–${Math.min(page * perPage, filteredEmps.length)}</b> of <b>${filteredEmps.length}</b> employees (<b>30 per page</b>)
      </div>
      <div class="page-acts" style="display:flex; align-items:center; gap:8px;">
        <button class="btn btn-sm" data-action="att-page" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>‹ Previous 30</button>
        <span style="font-weight:700; font-size:13px; color:#f1f5f9; padding:0 8px;">Page ${page} of ${totalPages}</span>
        <button class="btn btn-sm" data-action="att-page" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Next 30 ›</button>
      </div>
    </div>` : '';

  // Sunday notice banner
  const sundayBanner = sunday ? `
    <div style="background:rgba(245, 158, 11, 0.12); border:1px solid #f59e0b; border-radius:8px; padding:14px 18px; margin-bottom:18px; display:flex; align-items:center; gap:14px;">
      <span style="font-size:26px;">🗓️</span>
      <div>
        <b style="color:#fbbf24; font-size:14.5px;">Sunday — Official Weekly Off / Company Holiday</b>
        <div style="color:#cbd5e1; font-size:12.5px; margin-top:3px;">
          Sunday is a recognized weekly holiday for all departments. Any employee attending or assigned work today is credited with <b>Overtime (OT)</b>.
        </div>
      </div>
    </div>` : '';

  // Stepper and Quick Mark All Action
  const headerActions = `
    <span class="stepper">
      <button class="btn btn-sm" data-action="att-day" data-dir="-1" aria-label="Previous day">‹</button>
      <input type="date" id="attDate" data-change="att-date" value="${esc(date)}" max="${t}" aria-label="Attendance date">
      <button class="btn btn-sm" data-action="att-day" data-dir="1" aria-label="Next day"${date >= t ? ' disabled' : ''}>›</button>
    </span>
    ${W('hrms', sunday 
      ? '<button class="btn btn-primary" data-action="att-all-ot" style="background:#ea580c; border-color:#ea580c;">Mark all as Sunday Overtime (OT)</button>'
      : '<button class="btn btn-primary" data-action="att-all">Mark the rest present</button>'
    )}`;

  return head('HRMS', 'Attendance', `${esc(DAYS[d.getDay()])}, ${fmtDate(date)}${sunday ? ' · Company Holiday (Sunday Overtime)' : ''}`, headerActions)
    + (allEmps.length === 0 ? empty('No active employees', 'Add employees first, then mark who came in each day.', '<a class="btn btn-primary" href="#hr-employees">Go to employees</a>')
      : `
        ${sundayBanner}
        <div class="toolbar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div class="chips">
            ${stamp(`${count.P} present`, 'good')}
            ${stamp(`${count.O} overtime`, 'warn')}
            ${stamp(`${count.A} absent`, count.A ? 'bad' : 'mute')}
            ${stamp(`${count.H} half day`, count.H ? 'warn' : 'mute')}
            ${stamp(`${count.L + count.U} on leave`, count.L + count.U ? 'info' : 'mute')}
            ${stamp(`${count['']} not marked`, 'mute')}
          </div>
          <div style="font-size:12.5px; color:#94a3b8;">
            Total <b>${allEmps.length}</b> Active Employees
          </div>
        </div>

        <div class="toolbar" style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
          ${searchBox('attendance', 'Search employee name, EMP ID, department or role...')}
          ${filterSel('att-dept', 'All Departments', depts)}
        </div>

        ${filteredEmps.length === 0 ? empty('No employees match your search or filter', 'Try clearing your search keyword or department dropdown.') : `
          <div style="margin-top:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <h3 style="margin:0; font-size:15px; font-weight:700; color:#f1f5f9;">Daily Attendance Marking — ${fmtDate(date)}</h3>
              <span style="font-size:12.5px; color:#94a3b8;">Page ${page} of ${totalPages}</span>
            </div>
            <div class="att-list" style="border:1px solid rgba(255,255,255,0.08); border-radius:8px; overflow:hidden;">${rows.join('')}</div>
            ${paginationHtml}
          </div>

          <div style="margin-top:28px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <h2 class="sect" style="margin:0;">${esc(monthName(ym))} Attendance Summary &amp; Overtime Register</h2>
              <span style="font-size:12.5px; color:#94a3b8;">Showing ${pageEmps.length} of ${filteredEmps.length}</span>
            </div>
            ${table(['Employee (EMP ID & Name)', { n: 'Present (P)' }, { n: 'Overtime / Sunday (OT)' }, { n: 'Absent (A)' }, { n: 'Half days (H)' }, { n: 'Leave (L)' }, { n: 'Not marked' }, 'Actions'], sumRows)}
            ${paginationHtml}
          </div>
        `}
        <p class="note" style="margin-top:16px;">
          • Click <b>[✏️ Edit]</b> on any employee to open the full monthly calendar and adjust any day's mark with 1 click.<br>
          • <b>Sunday</b> is an official holiday/weekly off. Attendance on Sunday is automatically classified as <b>Overtime (OT)</b>.<br>
          • Exactly <b>30 employees</b> are shown per page for high performance and clean browsing. Use pagination controls to navigate.
        </p>`);
};

ACT['att-mark'] = el => {
  const date = S.ui.attDate, emp = el.dataset.emp, cur = (S.attendance[date] || {})[emp] || '';
  let mark = el.dataset.mark;
  if (isSunday(date) && mark === 'P') {
    mark = 'O';
    toast('Sunday is a weekly holiday. Working attendance marked as Overtime (OT)!', 'info');
  }
  const next = cur === mark ? '' : mark;
  save(() => writeMarks(date, { [emp]: next }));
};

ACT['att-all'] = () => {
  const date = S.ui.attDate, marks = {};
  const isSun = isSunday(date);
  const markVal = isSun ? 'O' : 'P';
  for (const e of activeEmps()) if (!markOf(e.id, date)) marks[e.id] = markVal;
  const n = Object.keys(marks).length;
  if (!n) return toast('Everyone is already marked for this day.');
  save(() => writeMarks(date, marks), isSun ? `${plural(n, 'employee')} marked for Sunday Overtime (OT)` : `${plural(n, 'employee')} marked present`);
};

ACT['att-all-ot'] = () => {
  const date = S.ui.attDate, marks = {};
  for (const e of activeEmps()) if (!markOf(e.id, date)) marks[e.id] = 'O';
  const n = Object.keys(marks).length;
  if (!n) return toast('Everyone is already marked for this day.');
  save(() => writeMarks(date, marks), `${plural(n, 'employee')} marked for Sunday Overtime (OT)`);
};

ACT['att-page'] = el => {
  S.ui.attPage = num(el.dataset.page);
  scheduleRender();
};

ACT['att-edit-emp'] = el => {
  const empId = el.dataset.id;
  const ym = el.dataset.month || S.ui.attDate.slice(0, 7);
  openAttEditor(empId, ym);
};

ACT['att-edit-set'] = async el => {
  const emp = el.dataset.emp, date = el.dataset.date, mark = el.dataset.mark, ym = el.dataset.month;
  const cur = (S.attendance[date] || {})[emp] || '';
  const next = cur === mark ? '' : mark;
  await writeMarks(date, { [emp]: next });
  openAttEditor(emp, ym);
};

ACT['att-day'] = el => { const d = addDays(S.ui.attDate, num(el.dataset.dir)); if (d <= today()) { S.ui.attDate = d; scheduleRender(); } };
CHG['att-date'] = el => { if (parseISO(el.value) && el.value <= today()) { S.ui.attDate = el.value; scheduleRender(); } };

/* ================= HRMS: leave ================= */
const LEAVE_TONE = { Pending: 'warn', Approved: 'good', Rejected: 'mute' };
V['hr-leave'] = D => {
  const f = S.ui.filter.leave || '';
  const rows = S.leaves.filter(l => !f || l.status === f).sort((a, b) => (a.status === 'Pending' ? 0 : 1) - (b.status === 'Pending' ? 0 : 1) || String(b.from).localeCompare(String(a.from)));
  const body = rows.map(l => `<tr><td><b>${esc(empName(D, l.empId))}</b></td><td>${esc(l.type)}${l.type === 'Unpaid' ? '<span class="sub">Loss of pay</span>' : ''}</td><td class="nowrap">${fmtDay(l.from)}${l.to !== l.from ? ' to ' + fmtDay(l.to) : ''} ${String(l.from).slice(0, 4)}</td><td class="num">${qty(l.days)}</td><td>${esc(l.reason || '—')}</td><td>${stamp(l.status, LEAVE_TONE[l.status])}</td><td class="acts">${W('hrms', `${l.status === 'Pending' ? `<button class="link-btn" data-action="leave-set" data-status="Approved" data-id="${esc(l.id)}">Approve</button> <button class="link-btn" data-action="leave-set" data-status="Rejected" data-id="${esc(l.id)}">Reject</button> ` : ''}<button class="link-btn danger" data-action="leave-del" data-id="${esc(l.id)}">Delete</button>`)}</td></tr>`);
  return head('HRMS', 'Leave', `<b>${D.attn.pending.length}</b> waiting for a decision`,
      W('hrms', '<button class="btn btn-primary" data-action="leave-new">New leave request</button>'))
    + `<div class="toolbar">${filterSel('leave', 'All requests', ['Pending', 'Approved', 'Rejected'])}</div>`
    + (S.leaves.length === 0 ? empty('No leave requests yet', 'Record a request here. Once approved, it shows in attendance and payroll by itself.', W('hrms', '<button class="btn btn-primary" data-action="leave-new">New leave request</button>'))
      : rows.length === 0 ? empty('Nothing matches', 'No requests with this status.')
      : table(['Employee', 'Type', 'Dates', { n: 'Days' }, 'Reason', 'Status', ''], body))
    + `<p class="note">Days exclude Sundays. Unpaid leave is deducted in payroll; casual, sick and earned leave are paid.</p>`;
};
ACT['leave-new'] = () => {
  const emps = activeEmps();
  if (!emps.length) return toast('Add an employee first, under HRMS › Employees.', 'warn');
  openForm({
    title: 'New leave request', submit: 'Save request',
    fields: [
      { name: 'empId', label: 'Employee', type: 'select', required: true, placeholder: 'Choose an employee', options: emps.map(e => ({ value: e.id, label: e.name })) },
      { name: 'type', label: 'Leave type', type: 'select', options: LEAVE_TYPES },
      { name: 'from', label: 'From', type: 'date', required: true, value: today() },
      { name: 'to', label: 'To', type: 'date', required: true, value: today() },
      { name: 'reason', label: 'Reason', full: true }
    ],
    onSubmit: v => {
      if (!parseISO(v.from) || !parseISO(v.to) || v.to < v.from) throw new UserError('The "To" date must be on or after the "From" date.');
      if (dayDiff(v.from, v.to) > 90) throw new UserError('A single request can cover at most 90 days.');
      const days = leaveDays(v.from, v.to);
      if (!days) throw new UserError('These dates fall on a Sunday, which is already the weekly off.');
      return dbAdd('leaves', Object.assign(v, { days, status: 'Pending', createdAt: Date.now() })).then(() => toast('Leave request saved'));
    }
  });
};
ACT['leave-set'] = el => { const l = S.leaves.find(x => x.id === el.dataset.id); if (l) save(() => dbUpdate('leaves', l.id, { status: el.dataset.status, decidedOn: today() }), `Leave ${el.dataset.status.toLowerCase()}`); };
ACT['leave-del'] = async el => {
  const l = S.leaves.find(x => x.id === el.dataset.id); if (!l) return;
  if (await confirmBox('Delete leave request?', 'The request will be removed. If it was approved, those days go back to "not marked" in attendance.')) save(() => dbDelete('leaves', l.id), 'Leave request deleted');
};

/* ================= HRMS: payroll ================= */
V['hr-payroll'] = D => {
  const month = S.ui.payMonth, cur = today().slice(0, 7), rows = payroll(month);
  const unmarked = sum(rows, r => r.unmarked);
  const body = rows.map(r => `<tr>
    <td><b>${esc(r.e.name)}</b><span class="sub">${esc([r.e.code, r.e.role].filter(Boolean).join(' · '))}</span></td>
    <td class="num">${inr(r.gross)}</td>
    <td class="num">${qty(r.payable)} / ${r.dim}</td>
    <td class="num${r.lop ? ' due' : ''}">${r.lop ? qty(r.lop) : '—'}</td>
    <td class="num">${r.lopAmt ? inr(-r.lopAmt) : '—'}</td>
    <td class="num">${inr(-r.pf)}</td>
    <td class="num">${r.pt ? inr(-r.pt) : '—'}</td>
    <td class="num"><b>${inr(r.net)}</b></td>
    <td class="acts"><button class="btn btn-sm btn-primary" data-action="payslip-open" data-id="${esc(r.e.id)}">📄 Salary Slip</button></td>
  </tr>`);
  const foot = `<tr><td>${plural(rows.length, 'employee')}</td><td class="num">${inr(sum(rows, r => r.gross))}</td><td></td><td class="num">${qty(sum(rows, r => r.lop)) }</td><td class="num">${inr(-sum(rows, r => r.lopAmt))}</td><td class="num">${inr(-sum(rows, r => r.pf))}</td><td class="num">${inr(-sum(rows, r => r.pt))}</td><td class="num">${inr(sum(rows, r => r.net))}</td><td></td></tr>`;
  return head('HRMS', 'Payroll', month === cur ? 'Month in progress. Figures use attendance marked so far.' : month > cur ? 'This month has not started yet.' : 'Based on attendance and approved leave for the month.',
      `<span class="stepper"><button class="btn btn-sm" data-action="pay-month" data-dir="-1" aria-label="Previous month">‹</button><span class="cur">${esc(monthName(month))}</span><button class="btn btn-sm" data-action="pay-month" data-dir="1" aria-label="Next month">›</button></span>${rows.length ? '<button class="btn" data-action="pay-csv">Download CSV</button>' : ''}`)
    + (rows.length === 0 ? empty('No active employees', 'Add employees with a monthly salary to see the pay sheet.', '<a class="btn btn-primary" href="#hr-employees">Go to employees</a>')
      : (unmarked ? `<div class="toolbar"><span>${stamp(`${unmarked} working days not marked`, 'warn')}</span><span class="muted">Unmarked days are paid in full. <a href="#hr-attendance">Mark attendance</a></span></div>` : '')
        + table(['Employee', { n: 'Gross' }, { n: 'Paid days' }, { n: 'Loss-of-pay days' }, { n: 'LOP deduction' }, { n: 'PF' }, { n: 'Prof. tax' }, { n: 'Net pay' }, ''], body, foot))
    + `<p class="note">How this is worked out: salary for a day = gross ÷ days in the month. Absent and unpaid-leave days are deducted in full, half days at half. PF is 12% of basic pay, with basic taken as half of earned salary. Professional tax is ₹200 when earned salary is above ₹15,000. These are simple estimates: PF limits and professional tax differ by state and salary, so check them with your accountant before paying.</p>`;
};
ACT['pay-month'] = el => { S.ui.payMonth = shiftMonth(S.ui.payMonth, num(el.dataset.dir)); scheduleRender(); };
ACT['pay-csv'] = () => {
  const rows = payroll(S.ui.payMonth);
  const cell = v => { let s = String(v); if (typeof v === 'string' && /^[=+\-@]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csv = [['Code', 'Employee', 'Gross', 'Paid days', 'LOP days', 'LOP deduction', 'PF', 'Professional tax', 'Net pay']]
    .concat(rows.map(r => [r.e.code, r.e.name, r.gross, r.payable, r.lop, r.lopAmt, r.pf, r.pt, r.net])).map(r => r.map(cell).join(',')).join('\n');
  downloadText('payroll-' + S.ui.payMonth + '.csv', csv, 'text/csv');
};
