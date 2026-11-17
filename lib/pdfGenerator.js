const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const LOGO_PATH = fs.existsSync(path.join(__dirname, '..', 'public', 'logo-rvm-original.png'))
  ? path.join(__dirname, '..', 'public', 'logo-rvm-original.png')
  : path.join(__dirname, '..', 'public', 'logo-for-white-bg.png');

function inr(n) {
  n = Math.round(Number(n) || 0);
  return 'Rs. ' + n.toLocaleString('en-IN');
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
}

function docToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);
    doc.end();
  });
}

function drawHeader(doc, company, title, badgeColor = '#0d2649') {
  const co = company || {};
  const coName = co.name || 'RvmAiTech Solutions Private Limited';
  const startY = 32;

  if (fs.existsSync(LOGO_PATH)) {
    try {
      doc.image(LOGO_PATH, 40, startY, { width: 145 });
    } catch (e) {
      doc.fontSize(16).fillColor('#0d2649').text('RvmAiTech', 40, startY);
    }
  } else {
    doc.fontSize(16).fillColor('#0d2649').text('RvmAiTech', 40, startY);
  }

  // Right-aligned Badge Title
  doc.rect(340, startY, 215, 24).fill(badgeColor);
  doc.fontSize(8.5).fillColor('#ffffff').font('Helvetica-Bold')
     .text(title.toUpperCase(), 340, startY + 7, { width: 215, align: 'center' });

  // Company details below logo
  doc.fontSize(8.5).fillColor('#0d2649').font('Helvetica-Bold')
     .text(coName, 40, startY + 44);
  doc.fontSize(7.5).fillColor('#475569').font('Helvetica')
     .text('CIN: U72900RJ2026PTC089123 | GSTIN: 08AABCR1234F1Z0 | PAN: AAACE0836F', 40, startY + 56)
     .text('Cyber City, Mansarovar, Jaipur, Rajasthan - 302020 | rvmaitech2026@gmail.com | +91 7052050656', 40, startY + 67);

  // Divider line
  doc.moveTo(40, startY + 79).lineTo(555, startY + 79).lineWidth(1.5).strokeColor('#0d2649').stroke();
  doc.y = startY + 88;
}

function drawFooter(doc, company, pageNum = 1, totalPages = 1) {
  const pageBottom = 786;
  doc.moveTo(40, pageBottom).lineTo(555, pageBottom).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
  doc.fontSize(7.5).fillColor('#64748b').font('Helvetica')
     .text('RvmAiTech Solutions Pvt. Ltd. · Registered Office: Cyber City, Mansarovar, Jaipur - 302020 · www.rvmaitech.com', 40, pageBottom + 4, { align: 'center', width: 515, lineBreak: false });
  if (totalPages > 1) {
    doc.fontSize(7).fillColor('#94a3b8').font('Helvetica')
       .text(`Page ${pageNum} of ${totalPages}`, 40, pageBottom + 14, { align: 'center', width: 515, lineBreak: false });
  }
}

/* 1. Employment Offer Letter PDF - Corporate Executive 2-Page Standard */
async function generateOfferLetterPdf(e, company) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 32, bottom: 20, left: 40, right: 40 }
  });
  const co = company || {};
  const gross = Number(e.salary || 0);
  const basic = Math.round(gross * 0.5);
  const hra = Math.round(gross * 0.3);
  const special = Math.max(0, gross - basic - hra);
  const annualCtc = gross * 12;
  const refNo = `RAT/HR/OFFER/${new Date().getFullYear()}/${e.code || 'EMP-001'}`;

  // ===================== PAGE 1 =====================
  drawHeader(doc, co, 'Employment Offer Letter', '#0d2649');

  const topY = doc.y;
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0d2649').text('Date: ', 40, topY, { continued: true })
     .font('Helvetica').fillColor('#1e293b').text(fmtDate(new Date()));
  doc.font('Helvetica-Bold').fillColor('#0d2649').text('Ref: ', 360, topY, { continued: true, width: 195, align: 'right' })
     .font('Helvetica').fillColor('#1e293b').text(refNo);

  doc.y = topY + 14;

  // Candidate Dossier Box
  const boxTop = doc.y;
  doc.rect(40, boxTop, 515, 68).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.fillColor('#0f172a').fontSize(8.5);

  doc.font('Helvetica-Bold').fillColor('#0d2649').text('Candidate Name:', 50, boxTop + 8, { width: 95 })
     .font('Helvetica').fillColor('#0f172a').text(e.name || 'Candidate', 145, boxTop + 8);
  doc.font('Helvetica-Bold').fillColor('#0d2649').text('Employee Code:', 320, boxTop + 8, { width: 95 })
     .font('Helvetica').fillColor('#0f172a').text(e.code || 'EMP-001', 415, boxTop + 8);

  doc.font('Helvetica-Bold').fillColor('#0d2649').text('Designation / Role:', 50, boxTop + 22, { width: 95 })
     .font('Helvetica').fillColor('#0f172a').text(e.role || 'Staff', 145, boxTop + 22);
  doc.font('Helvetica-Bold').fillColor('#0d2649').text('Department:', 320, boxTop + 22, { width: 95 })
     .font('Helvetica').fillColor('#0f172a').text(e.dept || 'Operations Department', 415, boxTop + 22);

  const candEmail = e.email || 'vivekbhardwaj7005@gmail.com';
  const candPhone = e.phone || '+91 7052050656';
  doc.font('Helvetica-Bold').fillColor('#0d2649').text('Email & Phone:', 50, boxTop + 36, { width: 95 })
     .font('Helvetica').fillColor('#0f172a').text(`${candEmail} · ${candPhone}`, 145, boxTop + 36);
  doc.font('Helvetica-Bold').fillColor('#0d2649').text('Date of Joining:', 320, boxTop + 36, { width: 95 })
     .font('Helvetica').fillColor('#0f172a').text(fmtDate(e.joined), 415, boxTop + 36);

  doc.font('Helvetica-Bold').fillColor('#0d2649').text('Work Location:', 50, boxTop + 50, { width: 95 })
     .font('Helvetica').fillColor('#0f172a').text(e.address || 'Cyber City, Mansarovar, Jaipur, Rajasthan', 145, boxTop + 50);

  doc.y = boxTop + 76;

  // Subject Banner
  doc.rect(40, doc.y, 515, 18).fill('#e0f2fe');
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0369a1')
     .text('SUBJECT: FORMAL OFFER OF EMPLOYMENT & LETTER OF APPOINTMENT', 50, doc.y + 5);

  doc.y += 24;

  // Formal Welcome Letter Prose
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a').text(`Dear ${e.name || 'Candidate'},`);
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(8.2).fillColor('#334155').text(
    `With reference to your application, technical evaluations, and discussions with our leadership team, we are pleased to offer you employment with RvmAiTech Solutions Private Limited ("Company") as ${e.role || 'Staff'} in our ${e.dept || 'Engineering'} Department.\n\n` +
    'Your technical aptitude, engineering discipline, and professional background align strongly with our core mission of delivering cutting-edge Intelligent Automation, Smart Parking ANPR, Embedded IoT, and Enterprise Software solutions. We are excited to welcome you to our innovation team.'
  );
  doc.moveDown(0.4);

  // Key Position Specifications Box
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0d2649').text('KEY APPOINTMENT SPECIFICATIONS & SHIFT STANDARDS:');
  doc.moveDown(0.25);

  const specY = doc.y;
  doc.rect(40, specY, 515, 62).fillAndStroke('#f1f5f9', '#cbd5e1');
  doc.fontSize(8);

  doc.font('Helvetica-Bold').fillColor('#0d2649').text('• Operational Shift:', 50, specY + 8, { width: 110 })
     .font('Helvetica').fillColor('#0f172a').text('Standard 8 Hours per day, Monday through Saturday (09:00 AM to 05:00 PM).', 160, specY + 8);
  doc.font('Helvetica-Bold').fillColor('#0d2649').text('• Daily Work Reports:', 50, specY + 22, { width: 110 })
     .font('Helvetica').fillColor('#0f172a').text('Mandatory daily logging ("Kal kya kiya, aaj kya karenge") on the HRMS portal.', 160, specY + 22);
  doc.font('Helvetica-Bold').fillColor('#0d2649').text('• Probation Period:', 50, specY + 36, { width: 110 })
     .font('Helvetica').fillColor('#0f172a').text('3 Months from the date of reporting, extendable based on performance review.', 160, specY + 36);
  doc.font('Helvetica-Bold').fillColor('#0d2649').text('• Notice Period:', 50, specY + 50, { width: 110 })
     .font('Helvetica').fillColor('#0f172a').text('30 Days written notice or gross salary in lieu thereof, with complete handover.', 160, specY + 50);

  doc.y = specY + 70;

  // Remuneration Structure (Annexure A)
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0d2649').text('ANNEXURE A: COMPENSATION & REMUNERATION STRUCTURE (INR):');
  doc.moveDown(0.25);

  const tblY = doc.y;
  doc.rect(40, tblY, 515, 18).fill('#0d2649');
  doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
  doc.text('Salary Component Breakdown', 50, tblY + 5);
  doc.text('Monthly Gross (INR)', 300, tblY + 5, { width: 95, align: 'right' });
  doc.text('Annual CTC (INR)', 405, tblY + 5, { width: 95, align: 'right' });
  doc.text('% Share', 510, tblY + 5, { width: 35, align: 'right' });

  const rows = [
    ['Basic Salary (Core Retainer 50%)', inr(basic), inr(basic * 12), '50%'],
    ['House Rent Allowance - HRA (30%)', inr(hra), inr(hra * 12), '30%'],
    ['Special Technical / Shift Allowance (20%)', inr(special), inr(special * 12), '20%']
  ];

  let rY = tblY + 18;
  doc.font('Helvetica').fontSize(8).fillColor('#0f172a');
  rows.forEach(([comp, m, a, pct], idx) => {
    doc.rect(40, rY, 515, 16).fillAndStroke(idx % 2 === 0 ? '#f8fafc' : '#ffffff', '#e2e8f0');
    doc.fillColor('#1e293b');
    doc.text(comp, 50, rY + 4);
    doc.text(m, 300, rY + 4, { width: 95, align: 'right' });
    doc.text(a, 405, rY + 4, { width: 95, align: 'right' });
    doc.text(pct, 510, rY + 4, { width: 35, align: 'right' });
    rY += 16;
  });

  // Total Gross Row
  doc.rect(40, rY, 515, 20).fillAndStroke('#e0edff', '#1d4ed8');
  doc.fillColor('#1d4ed8').font('Helvetica-Bold').fontSize(8.5);
  doc.text('Total Agreed Gross Salary & Annual CTC', 50, rY + 5.5);
  doc.text(inr(gross), 300, rY + 5.5, { width: 95, align: 'right' });
  doc.text(inr(annualCtc), 405, rY + 5.5, { width: 95, align: 'right' });
  doc.text('100%', 510, rY + 5.5, { width: 35, align: 'right' });

  doc.y = rY + 22;

  // Remuneration Policy Notes
  doc.font('Helvetica').fontSize(7.2).fillColor('#64748b').text(
    '1. Salary Disbursement: Net monthly salary is credited on or before the 7th of every calendar month directly to your designated bank account.\n' +
    '2. Statutory Deductions: Income Tax (TDS), PF, ESIC, and Professional Tax shall be deducted as applicable per statutory norms.\n' +
    '3. Annual Appraisal: Performance reviews and increments are appraised annually based on technical milestone achievement.'
  );

  doc.moveDown(0.2);
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0284c7').text(
    '>>> Continued on Page 2: Detailed Terms & Conditions of Employment, Code of Conduct, and Executive Signatures.',
    40, doc.y, { align: 'center', width: 515, lineBreak: false }
  );

  drawFooter(doc, co, 1, 2);

  // ===================== PAGE 2 =====================
  doc.addPage();
  drawHeader(doc, co, 'Terms & Executive Acceptance', '#0d2649');

  // Page 2 Header Banner
  doc.rect(40, doc.y, 515, 18).fill('#0d2649');
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#ffffff')
     .text('ANNEXURE B: COMPREHENSIVE TERMS & CONDITIONS OF EMPLOYMENT', 50, doc.y + 5);

  doc.y += 24;

  const clauses = [
    ['1. Standard Operational Shift & Daily Logging: ',
     'Your standard working shift is 8 Hours per day, Monday through Saturday (09:00 AM to 05:00 PM). Punctual attendance check-in on the Employee Portal and submission of daily work progress ("Kal kya kiya, aaj kya karenge") are mandatory for departmental synchronization and project deadlines.'],

    ['2. Probation & Permanent Confirmation: ',
     'You shall be on probation for a period of 3 months from the date of joining. Upon successful completion of your probation and satisfactory appraisal of your technical performance, conduct, and attendance, your appointment will be formally confirmed in writing.'],

    ['3. Intellectual Property & Source Code Assignment: ',
     'All intellectual property including IoT firmware binaries, source code, micro-controller schematics, PCB designs, AI/ANPR algorithms, technical documentation, and project deliverables conceived, developed, or contributed to by you during the course of employment shall remain the sole, absolute, and exclusive proprietary property of RvmAiTech Solutions Private Limited worldwide without royalty obligation.'],

    ['4. Confidentiality & Non-Disclosure (Strict NDA): ',
     'You shall maintain strict confidentiality regarding company trade secrets, proprietary algorithms, financial data, client contracts, and architectural designs. You agree not to disclose, publish, or utilize such confidential information during or subsequent to your employment without prior written authorization from the CEO.'],

    ['5. Workstation, Equipment & Company Assets: ',
     'Any hardware testing kits, development computers, sensors, cameras, or specialized tools assigned to you must be maintained with high technical care. All assets remain company property and must be returned intact immediately upon separation or upon request by HR.'],

    ['6. Code of Conduct & Non-Compete: ',
     'You agree to uphold high standards of professional ethics, integrity, and workplace discipline. You shall not engage in any outside commercial employment, freelancing, moonlighting, or consulting, nor engage in any business activity competing directly with RvmAiTech Solutions Private Limited during your tenure.'],

    ['7. Termination & Notice Period: ',
     'Either party may terminate this employment agreement by providing a 30-day written notice or gross remuneration in lieu thereof. The company reserves the right to terminate employment immediately without notice in cases of gross misconduct, willful breach of confidentiality, or unauthorized absence.'],

    ['8. Comprehensive Handover on Separation: ',
     'Prior to release from employment, you must effectuate a comprehensive knowledge transfer, document all pending codebases/firmware, and return all credentials, digital keys, and physical assets.'],

    ['9. Background & Credential Verification: ',
     'This offer is strictly conditional upon satisfactory verification of your Aadhaar Card, PAN Card, educational certificates, prior work experience (if applicable), and background references. Any misrepresentation discovered at any stage shall render this appointment void ab initio.']
  ];

  clauses.forEach(([title, text]) => {
    doc.font('Helvetica-Bold').fontSize(7.4).fillColor('#0d2649').text(title, 40, doc.y, { continued: true })
       .font('Helvetica').fillColor('#334155').text(text);
    doc.moveDown(0.2);
  });

  doc.moveDown(0.15);
  doc.font('Helvetica-Bold').fontSize(7.8).fillColor('#0d2649')
     .text('We welcome you to RvmAiTech Solutions Private Limited and wish you a distinguished, rewarding, and inspiring career with us.');

  // Dual Signature Blocks
  const sigY = 645;
  doc.rect(40, sigY, 250, 115).fillAndStroke('#ffffff', '#cbd5e1');
  doc.rect(305, sigY, 250, 115).fillAndStroke('#ffffff', '#cbd5e1');

  // Left Signatory (Company)
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0d2649')
     .text('For RvmAiTech Solutions Private Limited', 50, sigY + 8);
  doc.font('Helvetica').fontSize(7).fillColor('#64748b')
     .text('Corporate Executive Office, Jaipur', 50, sigY + 20);

  // Corporate Digital Seal Stamp Graphic
  const sealX = 230, sealY = sigY + 58, radius = 28;
  doc.circle(sealX, sealY, radius).lineWidth(1.2).strokeColor('#0d2649').stroke();
  doc.circle(sealX, sealY, radius - 3).lineWidth(0.6).strokeColor('#f47b20').stroke();
  doc.fontSize(4.5).font('Helvetica-Bold').fillColor('#0d2649')
     .text('RVMAITECH SOLUTIONS', sealX - 26, sealY - 14, { width: 52, align: 'center' })
     .text('★ VERIFIED ★', sealX - 26, sealY - 4, { width: 52, align: 'center' })
     .text('SEAL & APPROVAL', sealX - 26, sealY + 6, { width: 52, align: 'center' });

  doc.moveTo(50, sigY + 70).lineTo(185, sigY + 70).lineWidth(0.8).strokeColor('#0d2649').stroke();
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a')
     .text('Vivek Kumar Bhardwaj', 50, sigY + 75);
  doc.font('Helvetica').fontSize(7.5).fillColor('#475569')
     .text('Founder & Chief Executive Officer (CEO)', 50, sigY + 86);
  doc.font('Helvetica').fontSize(7).fillColor('#64748b')
     .text('Date: ' + fmtDate(new Date()), 50, sigY + 98);

  // Right Signatory (Candidate)
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0d2649')
     .text('Candidate Acceptance & Acknowledgment', 315, sigY + 8);
  doc.font('Helvetica').fontSize(7).fillColor('#64748b')
     .text('I have read, understood, and accept the offer of employment.', 315, sigY + 20);
  doc.moveTo(315, sigY + 70).lineTo(495, sigY + 70).lineWidth(0.8).strokeColor('#0d2649').stroke();
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a')
     .text(`Accepted by: ${e.name || 'Candidate'}`, 315, sigY + 75);
  doc.font('Helvetica').fontSize(7.5).fillColor('#475569')
     .text('Candidate Signature: ______________________', 315, sigY + 86);
  doc.font('Helvetica').fontSize(7).fillColor('#64748b')
     .text('Date: _______________ | Place: _____________', 315, sigY + 98);

  drawFooter(doc, co, 2, 2);
  return docToBuffer(doc);
}

/* 2. Official Joining Letter & Appointment Order PDF */
async function generateJoiningLetterPdf(e, company) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const co = company || {};
  drawHeader(doc, co, 'Appointment & Joining Order', '#0284c7');

  const refNo = `RAT/HR/JOIN/${new Date().getFullYear()}/${e.code || 'EMP-001'}`;
  const topY = doc.y;

  doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0284c7').text('Date: ', 40, topY, { continued: true })
     .font('Helvetica').fillColor('#1e293b').text(fmtDate(new Date()));
  doc.font('Helvetica-Bold').fillColor('#0284c7').text('Order Ref: ', 360, topY, { continued: true, width: 195, align: 'right' })
     .font('Helvetica').fillColor('#1e293b').text(refNo);

  doc.y = topY + 14;

  // Onboarding Dossier Box
  const boxTop = doc.y;
  doc.rect(40, boxTop, 515, 62).fillAndStroke('#f0f9ff', '#bae6fd');
  doc.fillColor('#0f172a').fontSize(8.5);

  doc.font('Helvetica-Bold').fillColor('#0369a1').text('Employee Name:', 50, boxTop + 8, { width: 90 })
     .font('Helvetica').fillColor('#0f172a').text(e.name || 'Employee', 140, boxTop + 8);
  doc.font('Helvetica-Bold').fillColor('#0369a1').text('Employee Code:', 320, boxTop + 8, { width: 90 })
     .font('Helvetica').fillColor('#0f172a').text(e.code || 'EMP-001', 415, boxTop + 8);

  doc.font('Helvetica-Bold').fillColor('#0369a1').text('Designation / Role:', 50, boxTop + 23, { width: 90 })
     .font('Helvetica').fillColor('#0f172a').text(e.role || 'Staff', 140, boxTop + 23);
  doc.font('Helvetica-Bold').fillColor('#0369a1').text('Department:', 320, boxTop + 23, { width: 90 })
     .font('Helvetica').fillColor('#0f172a').text(e.dept || 'Operations Department', 415, boxTop + 23);

  doc.font('Helvetica-Bold').fillColor('#0369a1').text('Confirmed Joining:', 50, boxTop + 38, { width: 90 })
     .font('Helvetica').fillColor('#0f172a').text(fmtDate(e.joined), 140, boxTop + 38);
  doc.font('Helvetica-Bold').fillColor('#0369a1').text('Gross Salary:', 320, boxTop + 38, { width: 90 })
     .font('Helvetica').fillColor('#0f172a').text(`${inr(e.salary)} / month`, 415, boxTop + 38);

  doc.y = boxTop + 69;

  // Subject Banner
  doc.rect(40, doc.y, 515, 17).fill('#ecfdf5');
  doc.font('Helvetica-Bold').fontSize(8.2).fillColor('#047857')
     .text(`SUBJECT: OFFICIAL APPOINTMENT ORDER & COMMENCEMENT OF DUTIES — ${e.code || 'EMP-001'}`, 50, doc.y + 4.5);

  doc.y += 22;

  // Formal Certification
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a').text('TO WHOM IT MAY CONCERN / APPOINTMENT CERTIFICATION:');
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(8).fillColor('#334155').text(
    `This is to formally certify that ${e.name} has completed the required onboarding formalities and has officially reported for duty ` +
    `at RvmAiTech Solutions Private Limited with effect from ${fmtDate(e.joined)}. ` +
    `The employee is formally inducted into the ${e.dept || 'Engineering'} Department as ${e.role || 'Staff'}.`
  );
  doc.moveDown(0.4);

  // Corporate IT & Facility Provisioning Box
  doc.font('Helvetica-Bold').fontSize(8.2).fillColor('#0d2649').text('CORPORATE WORKSTATION & SYSTEM PROVISIONING:');
  doc.moveDown(0.25);

  const provBoxTop = doc.y;
  doc.rect(40, provBoxTop, 515, 68).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.fillColor('#0f172a').fontSize(7.8);

  doc.font('Helvetica-Bold').text('1. Enterprise HRMS Portal Access:', 50, provBoxTop + 8);
  doc.font('Helvetica').text('Provisioned under official Employee Self-Service (ESS) with secure Scrypt credential authentication.', 50, provBoxTop + 18);

  doc.font('Helvetica-Bold').text('2. Standard Operational Shift & Attendance:', 50, provBoxTop + 30);
  doc.font('Helvetica').text('8-Hour Standard Daily Shift (09:00 AM - 05:00 PM) with daily punch-in & daily task submission required.', 50, provBoxTop + 40);

  doc.font('Helvetica-Bold').text('3. Identity Badge & Security Clearance:', 50, provBoxTop + 52);
  doc.font('Helvetica').text('CR-80 Official Photo Identity Card issued for workplace and client project installation site authorization.', 50, provBoxTop + 62);

  doc.y = provBoxTop + 76;

  // Onboarding Code of Conduct Clauses
  doc.font('Helvetica-Bold').fontSize(8.2).fillColor('#0d2649').text('OPERATIONAL GUIDELINES & WORKPLACE POLICIES:');
  doc.moveDown(0.2);

  const joinClauses = [
    ['1. Daily Work Reports ("Kal kya kiya, aaj kya karenge"): ', 'All team members must maintain daily work transparency by submitting previous-day deliverables and today\'s plan on the HRMS portal.'],
    ['2. Information Security & IP Protection: ', 'Strict confidentiality must be observed regarding client proprietary data, IoT firmware binaries, source codes, and passwords.'],
    ['3. Asset Responsibility: ', 'Computing equipment, testing sensors, and development boards provided by the company must be handled with appropriate technical care.'],
    ['4. Leaves & Shift Regularization: ', 'Planned leaves must be submitted via the Employee Portal in advance for departmental supervisor approval.'],
    ['5. Original Document Submission: ', 'Personnel file completion requires digital scan uploads of Aadhaar, PAN card, and academic credentials within 7 days.']
  ];

  joinClauses.forEach(([title, text]) => {
    doc.font('Helvetica-Bold').fontSize(7.6).fillColor('#0f172a').text(title, 40, doc.y, { continued: true })
       .font('Helvetica').fillColor('#334155').text(text);
    doc.moveDown(0.18);
  });

  doc.moveDown(0.15);
  doc.font('Helvetica-Bold').fontSize(7.8).fillColor('#0284c7')
     .text('The management congratulates you on your appointment and looks forward to your impactful contributions.');

  // Dual Signatures
  const sigY = 680;
  doc.rect(40, sigY, 245, 90).fillAndStroke('#ffffff', '#cbd5e1');
  doc.rect(310, sigY, 245, 90).fillAndStroke('#ffffff', '#cbd5e1');

  doc.font('Helvetica-Bold').fontSize(8).fillColor('#0284c7')
     .text('For RvmAiTech Solutions Private Limited', 50, sigY + 8);
  doc.font('Helvetica').fontSize(7).fillColor('#64748b')
     .text('Human Resources & Talent Management', 50, sigY + 20);
  doc.moveTo(50, sigY + 58).lineTo(230, sigY + 58).lineWidth(0.8).strokeColor('#0284c7').stroke();
  doc.font('Helvetica-Bold').fontSize(7.8).fillColor('#0f172a')
     .text('Head of HR Operations', 50, sigY + 62);
  doc.font('Helvetica').fontSize(7).fillColor('#475569')
     .text('RvmAiTech Corporate Office, Jaipur', 50, sigY + 73);

  doc.font('Helvetica-Bold').fontSize(8).fillColor('#0284c7')
     .text('Employee Reporting Acknowledgement', 320, sigY + 8);
  doc.font('Helvetica').fontSize(7).fillColor('#64748b')
     .text('I confirm reporting for duty and receipt of credentials.', 320, sigY + 20);
  doc.moveTo(320, sigY + 58).lineTo(500, sigY + 58).lineWidth(0.8).strokeColor('#0284c7').stroke();
  doc.font('Helvetica-Bold').fontSize(7.8).fillColor('#0f172a')
     .text(`Signed by: ${e.name || 'Employee'}`, 320, sigY + 62);
  doc.font('Helvetica').fontSize(7).fillColor('#475569')
     .text(`Joining Date Verified: ${fmtDate(e.joined)}`, 320, sigY + 73);

  drawFooter(doc);
  return docToBuffer(doc);
}

/* 3. Official Employee Photo ID Card PDF */
async function generateIdCardPdf(e, company) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const co = company || {};
  drawHeader(doc, co, 'Official Corporate ID Card', '#0d2649');

  const topY = doc.y + 10;
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#0d2649')
     .text('PRINTABLE CR-80 SPECIFICATION IDENTITY BADGE (FRONT & REVERSE):', 40, topY);
  doc.font('Helvetica').fontSize(8).fillColor('#64748b')
     .text('Standard CR-80 Card Size: 85.6 mm x 53.98 mm · Official RvmAiTech Corporate Credential', 40, topY + 14);

  // FRONT CARD (Left, width: 242 pt, height: 350 pt)
  const cardW = 242;
  const cardH = 360;
  const card1X = 45;
  const card2X = 305;
  const cardY = topY + 36;

  // Front Card Outline
  doc.roundedRect(card1X, cardY, cardW, cardH, 12).fillAndStroke('#ffffff', '#0d2649');

  // Top Navy Header
  doc.roundedRect(card1X, cardY, cardW, 60, 12).fill('#0d2649');
  doc.rect(card1X, cardY + 40, cardW, 20).fill('#0d2649'); // cover bottom rounded corners of header

  if (fs.existsSync(LOGO_PATH)) {
    try {
      doc.image(LOGO_PATH, card1X + 45, cardY + 8, { width: 150 });
    } catch (err) {
      doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold').text('RvmAiTech', card1X, cardY + 18, { width: cardW, align: 'center' });
    }
  } else {
    doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold').text('RvmAiTech', card1X, cardY + 18, { width: cardW, align: 'center' });
  }

  // Accent Line
  doc.rect(card1X, cardY + 60, cardW, 4).fill('#f47b20');

  // Photo Avatar Box
  const photoY = cardY + 76;
  doc.roundedRect(card1X + (cardW - 80) / 2, photoY, 80, 85, 8).fillAndStroke('#f1f5f9', '#0d2649');
  doc.fontSize(28).font('Helvetica-Bold').fillColor('#0d2649')
     .text((e.name || 'EMP').split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase(), card1X, photoY + 28, { width: cardW, align: 'center' });

  // Employee Name
  doc.fontSize(12.5).font('Helvetica-Bold').fillColor('#0d2649')
     .text(e.name || 'Employee Name', card1X + 10, photoY + 95, { width: cardW - 20, align: 'center' });

  // Role Badge
  doc.roundedRect(card1X + 30, photoY + 115, cardW - 60, 18, 9).fill('#e0f2fe');
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0369a1')
     .text((e.role || 'Staff').toUpperCase(), card1X + 30, photoY + 120, { width: cardW - 60, align: 'center' });

  // Details Grid
  const detY = photoY + 142;
  const labelW = 75;
  const fRows = [
    ['Emp Code:', e.code || 'EMP-001'],
    ['Department:', e.dept || 'Operations'],
    ['Blood Group:', e.bloodGroup || 'B+'],
    ['Joining Date:', fmtDate(e.joined)],
    ['Valid Until:', '31 Dec 2029']
  ];

  doc.fontSize(7.8);
  fRows.forEach(([lbl, val], idx) => {
    const cy = detY + idx * 14;
    doc.font('Helvetica-Bold').fillColor('#475569').text(lbl, card1X + 20, cy, { width: labelW });
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(val, card1X + 20 + labelW, cy, { width: cardW - 40 - labelW });
  });

  // Front Footer
  doc.roundedRect(card1X, cardY + cardH - 24, cardW, 24, 12).fill('#0d2649');
  doc.rect(card1X, cardY + cardH - 24, cardW, 12).fill('#0d2649');
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#38bdf8')
     .text('AUTHORIZED IDENTITY BADGE · OFFICIAL', card1X, cardY + cardH - 16, { width: cardW, align: 'center' });

  // BACK CARD (Right, width: 242 pt, height: 360 pt)
  doc.roundedRect(card2X, cardY, cardW, cardH, 12).fillAndStroke('#ffffff', '#0d2649');

  // Back Header
  doc.roundedRect(card2X, cardY, cardW, 35, 12).fill('#0d2649');
  doc.rect(card2X, cardY + 20, cardW, 15).fill('#0d2649');
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff')
     .text('TERMS OF ISSUANCE & INSTRUCTIONS', card2X, cardY + 12, { width: cardW, align: 'center' });

  doc.rect(card2X, cardY + 35, cardW, 3).fill('#38bdf8');

  // Terms on Back
  const bTermsY = cardY + 46;
  doc.fontSize(7.2).font('Helvetica').fillColor('#334155');
  doc.text('1. This card is the property of RvmAiTech Solutions Private Limited and is non-transferable.', card2X + 15, bTermsY, { width: cardW - 30 });
  doc.moveDown(0.4);
  doc.text('2. The cardholder must display this badge on company premises and client project installations at all times.', card2X + 15, doc.y, { width: cardW - 30 });
  doc.moveDown(0.4);
  doc.text('3. In case of loss or damage, report immediately to the HR Operations department.', card2X + 15, doc.y, { width: cardW - 30 });
  doc.moveDown(0.4);
  doc.text('4. If found, please return to the Registered Office below.', card2X + 15, doc.y, { width: cardW - 30 });

  // Address Box
  const addrY = doc.y + 10;
  doc.rect(card2X + 15, addrY, cardW - 30, 48).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.fontSize(7.2).font('Helvetica-Bold').fillColor('#0d2649')
     .text('Registered Office & Lab:', card2X + 22, addrY + 6);
  doc.font('Helvetica').fontSize(6.8).fillColor('#475569')
     .text('Cyber City, Mansarovar, Jaipur, Rajasthan - 302020\nEmail: rvmaitech2026@gmail.com\nHelpline: +91 7052050656 | www.rvmaitech.com', card2X + 22, addrY + 17, { width: cardW - 44 });

  // Emergency Contact Block
  const emgY = addrY + 56;
  doc.rect(card2X + 15, emgY, cardW - 30, 32).fillAndStroke('#fef2f2', '#fecaca');
  doc.fontSize(7.2).font('Helvetica-Bold').fillColor('#b91c1c')
     .text('Emergency Helpline & Reporting:', card2X + 22, emgY + 5);
  doc.font('Helvetica').fontSize(7).fillColor('#7f1d1d')
     .text(`Contact: ${e.emergencyPhone || e.phone || '+91 7052050656'} (${e.emergencyName || 'HR Operations'})`, card2X + 22, emgY + 17);

  // Authorised Signatory Seal on Back
  const authY = emgY + 42;
  doc.moveTo(card2X + 35, authY + 30).lineTo(card2X + cardW - 35, authY + 30).lineWidth(0.8).strokeColor('#0d2649').stroke();
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0d2649')
     .text('Vivek Kumar Bhardwaj', card2X, authY + 34, { width: cardW, align: 'center' });
  doc.fontSize(6.8).font('Helvetica').fillColor('#64748b')
     .text('Founder & CEO · Authorised Corporate Seal', card2X, authY + 44, { width: cardW, align: 'center' });

  // Back Footer
  doc.roundedRect(card2X, cardY + cardH - 24, cardW, 24, 12).fill('#0d2649');
  doc.rect(card2X, cardY + cardH - 24, cardW, 12).fill('#0d2649');
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#ffffff')
     .text('RVMAITECH SOLUTIONS PRIVATE LIMITED', card2X, cardY + cardH - 16, { width: cardW, align: 'center' });

  drawFooter(doc);
  return docToBuffer(doc);
}

/* 3. Sales Tax Invoice & Delivery Challan PDF */
async function generateInvoicePdf(i, cust, company) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  drawHeader(doc, company, 'Tax Invoice & Challan', '#0f172a');

  const c = cust || {};
  doc.fontSize(8.5).font('Helvetica');
  doc.text(`Invoice No: ${i.no || 'INV-0001'}`, 40, doc.y);
  doc.text(`Challan No: ${i.challanNo || 'CHL-0001'}`, 240, doc.y);
  doc.text(`Date: ${fmtDate(i.date)}`, 450, doc.y);
  doc.moveDown(0.6);

  // Customer Billed To Box
  const boxTop = doc.y;
  doc.rect(40, boxTop, 515, 55).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.fillColor('#0f172a').fontSize(8.5);
  doc.font('Helvetica-Bold').text('Billed To Customer / Client:', 50, boxTop + 8);
  doc.font('Helvetica').text(`${c.company || c.name || 'Valued Client'}`, 50, boxTop + 20);
  doc.text(`Address: ${c.address || 'Mansarovar, Jaipur, Rajasthan'} | GSTIN: ${c.gstin || '08AABCT9999Z1'}`, 50, boxTop + 32);
  doc.text(`Contact: ${c.phone || '—'} | Email: ${c.email || '—'}`, 50, boxTop + 44);

  doc.y = boxTop + 68;

  // Items Table
  const tblY = doc.y;
  doc.rect(40, tblY, 515, 18).fill('#0f172a');
  doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
  doc.text('#', 45, tblY + 5);
  doc.text('Item Description / Service', 65, tblY + 5);
  doc.text('Qty', 290, tblY + 5);
  doc.text('Rate (Rs.)', 340, tblY + 5);
  doc.text('GST %', 420, tblY + 5);
  doc.text('Total (Rs.)', 480, tblY + 5);

  let rY = tblY + 18;
  const items = i.items || [];
  doc.font('Helvetica').fontSize(8).fillColor('#0f172a');
  items.forEach((it, idx) => {
    const itTot = (Number(it.qty) || 1) * (Number(it.rate) || 0) * (1 + (Number(it.gst) || 18) / 100);
    doc.rect(40, rY, 515, 18).fillAndStroke(idx % 2 === 0 ? '#f8fafc' : '#ffffff', '#e2e8f0');
    doc.text(String(idx + 1), 45, rY + 5);
    doc.text(it.name || it.productId || 'Item', 65, rY + 5, { width: 220, ellipsis: true });
    doc.text(String(it.qty || 1), 290, rY + 5);
    doc.text(inr(it.rate), 340, rY + 5);
    doc.text(`${it.gst || 18}%`, 420, rY + 5);
    doc.text(inr(itTot), 480, rY + 5);
    rY += 18;
  });

  // Summary Box
  doc.y = rY + 12;
  const sumY = doc.y;
  doc.rect(300, sumY, 255, 80).fillAndStroke('#f8fafc', '#0f172a');
  doc.fillColor('#0f172a').fontSize(8.5);
  doc.font('Helvetica').text('Subtotal:', 310, sumY + 8).text(inr(i.subtotal || i.total * 0.84), 450, sumY + 8, { align: 'right', width: 95 });
  doc.text('Total GST Tax:', 310, sumY + 22).text(inr(i.tax || i.total * 0.16), 450, sumY + 22, { align: 'right', width: 95 });
  doc.font('Helvetica-Bold').text('Grand Total:', 310, sumY + 36).text(inr(i.total), 450, sumY + 36, { align: 'right', width: 95 });
  doc.fillColor('#059669').text('Advance Paid:', 310, sumY + 50).text(inr(i.advanceAmount || i.paid || 0), 450, sumY + 50, { align: 'right', width: 95 });
  doc.fillColor('#dc2626').text('Balance Due:', 310, sumY + 64).text(inr((i.total || 0) - (i.paid || 0)), 450, sumY + 64, { align: 'right', width: 95 });

  // Bank Account Box
  doc.rect(40, sumY, 250, 80).fillAndStroke('#f1f5f9', '#cbd5e1');
  doc.fillColor('#0d2649').fontSize(8).font('Helvetica-Bold');
  doc.text('Bank & Payment Details:', 50, sumY + 8);
  doc.font('Helvetica').fontSize(7.5).fillColor('#334155');
  doc.text('Bank Name: HDFC Bank Limited', 50, sumY + 22);
  doc.text('A/C Name: RvmAiTech Solutions Pvt. Ltd.', 50, sumY + 34);
  doc.text('A/C Number: 50200088921455 · IFSC: HDFC0001234', 50, sumY + 46);
  doc.text('UPI / QR Pay: 7052050656@hdfcbank', 50, sumY + 58);

  // Signatures
  doc.y = 670;
  doc.rect(40, 670, 240, 70).stroke('#cbd5e1');
  doc.rect(315, 670, 240, 70).stroke('#cbd5e1');
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text('Customer / Receiver Signature & Stamp', 50, 678);
  doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text('Goods received in good condition', 50, 720);
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text('For RvmAiTech Solutions Pvt. Ltd.', 325, 678);
  doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text('Authorized Signatory', 325, 720);

  drawFooter(doc, company);
  return docToBuffer(doc);
}

/* 4. Purchase Order (PO) PDF */
async function generatePurchaseOrderPdf(p, vendor, company) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  drawHeader(doc, company, 'Purchase Order (PO)', '#0d2649');

  const v = vendor || {};
  doc.fontSize(8.5).font('Helvetica');
  doc.text(`PO Number: ${p.no || 'PO-2026-0001'}`, 40, doc.y);
  doc.text(`Date: ${fmtDate(p.date)}`, 300, doc.y);
  doc.text(`Status: ${p.status || 'On order'}`, 450, doc.y);
  doc.moveDown(0.6);

  // Vendor Details
  const boxTop = doc.y;
  doc.rect(40, boxTop, 515, 55).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.fillColor('#0f172a').fontSize(8.5);
  doc.font('Helvetica-Bold').text('Supplier / Vendor Name:', 50, boxTop + 8);
  doc.font('Helvetica').text(`${v.company || v.name || p.supplier || 'Approved Vendor'}`, 50, boxTop + 20);
  doc.text(`Address: ${v.address || 'Industrial Area, Jaipur, Rajasthan'}`, 50, boxTop + 32);
  doc.text(`Contact: ${v.phone || '—'} | Email: ${v.email || '—'}`, 50, boxTop + 44);

  doc.y = boxTop + 68;

  // PO Line Items
  const tblY = doc.y;
  doc.rect(40, tblY, 515, 18).fill('#0d2649');
  doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
  doc.text('#', 45, tblY + 5);
  doc.text('Item Description', 65, tblY + 5);
  doc.text('Qty', 320, tblY + 5);
  doc.text('Unit Cost (Rs.)', 380, tblY + 5);
  doc.text('Total Cost (Rs.)', 470, tblY + 5);

  let rY = tblY + 18;
  const tot = (Number(p.qty) || 1) * (Number(p.cost) || 0);
  doc.rect(40, rY, 515, 20).fillAndStroke('#f8fafc', '#e2e8f0');
  doc.fillColor('#0f172a').font('Helvetica').fontSize(8);
  doc.text('1', 45, rY + 6);
  doc.text(p.productName || 'Smart Parking Hardware / Equipment', 65, rY + 6, { width: 240, ellipsis: true });
  doc.text(String(p.qty || 1), 320, rY + 6);
  doc.text(inr(p.cost), 380, rY + 6);
  doc.text(inr(tot), 470, rY + 6);

  // Total
  rY += 20;
  doc.rect(340, rY + 10, 215, 30).fillAndStroke('#e2e8f0', '#0d2649');
  doc.fillColor('#0d2649').font('Helvetica-Bold').fontSize(9.5)
     .text('Total Purchase Order Value:', 350, rY + 20)
     .text(inr(tot), 470, rY + 20, { width: 75, align: 'right' });

  // Signatures
  doc.y = 670;
  doc.rect(40, 670, 240, 70).stroke('#cbd5e1');
  doc.rect(315, 670, 240, 70).stroke('#cbd5e1');
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#0d2649').text('Vendor Acceptance', 50, 678);
  doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text('Authorized Supplier Signatory', 50, 720);
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#0d2649').text('For RvmAiTech Solutions Pvt. Ltd.', 325, 678);
  doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text('Purchase & Procurement Head', 325, 720);

  drawFooter(doc, company);
  return docToBuffer(doc);
}

/* 5. Project Quotation PDF (Matches Exact 8-Section RvmAiTech Template) */
async function generateQuotationPdf(q, cust, company) {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 18, bottom: 10, left: 36, right: 36 }, bufferPages: true, compress: false });
  const c = cust || {};

  const qNo = q.no || 'RVM/QTN/2026/001';
  const qDate = fmtDate(q.date || new Date());
  const validUntil = fmtDate(q.validUntil || (q.date ? new Date(new Date(q.date).getTime() + 30 * 86400000) : new Date(Date.now() + 30 * 86400000)));

  // 1. Client Details
  const companyName = q.companyName || c.company || c.name || '[Client Company Name]';
  const contactPerson = q.contactPerson || c.contact || c.name || '[Client Name]';
  const clientEmail = q.email || c.email || '[Client Email]';
  const clientPhone = q.phone || c.phone || '[Client Phone]';
  const clientAddress = q.address || c.address || '[Client Address]';
  const clientGstin = q.gstin || c.gstin || '[Client GSTIN, if applicable]';

  // 2. Project Details
  const projectName = q.projectName || q.name || 'Smart Industrial Automation System';
  const projectCategory = q.projectCategory || 'Software / Hardware / Industrial Automation';
  const projectDesc = q.projectDesc || q.desc || 'Turnkey embedded hardware, IoT sensor telemetry, and cloud management software platform.';
  const scopeOfWork = q.scopeOfWork || 'Hardware supply, edge gateway integration, web dashboard deployment, site commissioning, and deliverables.';

  // 3. Cost Estimation
  const basicCost = Number(q.basicCost || q.subtotal || (q.items && q.items.length ? q.items.reduce((a, it) => a + (Number(it.qty) * Number(it.rate)), 0) : 250000));
  const gstRate = Number(q.gstRate || 18);
  const gstAmount = Number(q.gstAmount) || Math.round(basicCost * (gstRate / 100));
  const totalAmount = Number(q.totalAmount || q.total) || (basicCost + gstAmount);

  // 4. Timeline
  const minDays = q.minDays || 30;
  const maxDays = q.maxDays || 90;
  const estimatedDelivery = q.estimatedDelivery || 'As per project complexity and approved scope.';

  // 5. Payment Terms
  const advancePct = q.advancePct !== undefined ? q.advancePct : 50;
  const milestonePct = q.milestonePct !== undefined ? q.milestonePct : 30;
  const finalPct = q.finalPct !== undefined ? q.finalPct : 20;

  // 8. Signatory
  const signatoryName = q.signatoryName || 'Vivek Kumar Bhardwaj';
  const signatoryRole = q.signatoryRole || 'CEO / Founder';
  const signDate = fmtDate(q.signDate || q.date || new Date());

  const maxY = 792;

  function drawSectionBanner(d, title, yPos) {
    d.rect(36, yPos, 523, 17).fill('#0d2649');
    d.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold').text(title, 42, yPos + 4);
    d.fillColor('#0f172a').font('Helvetica');
    return yPos + 19;
  }

  function drawPageHeader(isFirstPage) {
    let yPos = 22;
    const logoW = isFirstPage ? 130 : 105;
    const logoH = Math.round(logoW * (300 / 1126));

    if (fs.existsSync(LOGO_PATH)) {
      try {
        doc.image(LOGO_PATH, 36, yPos, { width: logoW });
      } catch (e) {
        doc.fontSize(15).fillColor('#0d2649').font('Helvetica-Bold').text('RvmAiTech', 36, yPos);
      }
    } else {
      doc.fontSize(15).fillColor('#0d2649').font('Helvetica-Bold').text('RvmAiTech', 36, yPos);
    }

    const subY = yPos + logoH + 4;
    doc.fontSize(7.5).fillColor('#0284c7').font('Helvetica-Bold').text('SOFTWARE | HARDWARE | INDUSTRIAL AUTOMATION', 36, subY);

    if (isFirstPage) {
      doc.rect(345, yPos, 214, 21).fill('#0d2649');
      doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold').text('PROJECT QUOTATION', 345, yPos + 5.5, { width: 214, align: 'center' });

      doc.fillColor('#0f172a').fontSize(8).font('Helvetica');
      doc.text(`Quotation No.: ${qNo}`, 345, yPos + 25, { width: 214, align: 'right' });
      doc.text(`Quotation Date: ${qDate}`, 345, yPos + 36, { width: 214, align: 'right' });
      doc.text(`Valid Until: ${validUntil}`, 345, yPos + 47, { width: 214, align: 'right' });
    } else {
      doc.fontSize(9).fillColor('#0d2649').font('Helvetica-Bold').text('PROJECT QUOTATION (Continued)', 340, yPos + 5, { width: 219, align: 'right' });
      doc.fontSize(7.5).fillColor('#475569').font('Helvetica').text(`Ref: ${qNo}`, 340, yPos + 18, { width: 219, align: 'right' });
    }

    const lineY = Math.max(subY + 11, isFirstPage ? (yPos + 71) : (yPos + 35));
    doc.moveTo(36, lineY).lineTo(559, lineY).strokeColor('#0d2649').lineWidth(1.3).stroke();
    return lineY + 6;
  }

  function ensureSpace(neededHeight) {
    if (y + neededHeight > maxY) {
      doc.addPage();
      y = drawPageHeader(false);
    }
  }

  // Draw Page 1 Header
  let y = drawPageHeader(true);

  // 1. CLIENT DETAILS
  ensureSpace(58);
  y = drawSectionBanner(doc, '1. CLIENT DETAILS', y);
  doc.rect(36, y, 523, 52).stroke('#cbd5e1');
  doc.fontSize(8).fillColor('#0f172a');
  doc.font('Helvetica-Bold').text('Company Name: ', 44, y + 6, { continued: true }).font('Helvetica').text(companyName);
  doc.font('Helvetica-Bold').text('Contact Person: ', 44, y + 21, { continued: true }).font('Helvetica').text(contactPerson);
  doc.font('Helvetica-Bold').text('Email: ', 44, y + 36, { continued: true }).font('Helvetica').text(clientEmail);
  doc.font('Helvetica-Bold').text('Phone: ', 300, y + 6, { continued: true }).font('Helvetica').text(clientPhone);
  doc.font('Helvetica-Bold').text('Address: ', 300, y + 21, { continued: true }).font('Helvetica').text(clientAddress, { width: 250, height: 12, ellipsis: true });
  doc.font('Helvetica-Bold').text('GSTIN: ', 300, y + 36, { continued: true }).font('Helvetica').text(clientGstin);
  y += 58;

  // 2. PROJECT DETAILS
  ensureSpace(68);
  y = drawSectionBanner(doc, '2. PROJECT DETAILS', y);
  doc.rect(36, y, 523, 62).stroke('#cbd5e1');
  doc.fontSize(8);
  doc.font('Helvetica-Bold').text('Project Name: ', 44, y + 6, { continued: true }).font('Helvetica').text(projectName);
  doc.font('Helvetica-Bold').text('Project Category: ', 340, y + 6, { continued: true }).font('Helvetica').text(projectCategory);
  doc.font('Helvetica-Bold').text('Project Description: ', 44, y + 22, { continued: true }).font('Helvetica').text(projectDesc, { width: 505, height: 15, ellipsis: true });
  doc.font('Helvetica-Bold').text('Scope of Work: ', 44, y + 40, { continued: true }).font('Helvetica').text(scopeOfWork, { width: 505, height: 16, ellipsis: true });
  y += 68;

  // 3. PROJECT COST ESTIMATION
  ensureSpace(88);
  y = drawSectionBanner(doc, '3. PROJECT COST ESTIMATION', y);
  doc.rect(36, y, 523, 17).fill('#0d2649');
  doc.fillColor('#fff').fontSize(8.5).font('Helvetica-Bold');
  doc.text('Description', 44, y + 4.5);
  doc.text('Amount', 440, y + 4.5, { width: 110, align: 'right' });

  let cY = y + 17;
  doc.fillColor('#0f172a').font('Helvetica').fontSize(8);
  doc.rect(36, cY, 523, 16).fillAndStroke('#f8fafc', '#e2e8f0');
  doc.fillColor('#0f172a').text('Project Basic Cost', 44, cY + 4);
  doc.text(inr(basicCost), 440, cY + 4, { width: 110, align: 'right' });

  cY += 16;
  doc.rect(36, cY, 523, 16).fillAndStroke('#ffffff', '#e2e8f0');
  doc.fillColor('#0f172a').text(`GST @ ${gstRate}%`, 44, cY + 4);
  doc.text(inr(gstAmount), 440, cY + 4, { width: 110, align: 'right' });

  cY += 16;
  doc.rect(36, cY, 523, 19).fillAndStroke('#e2e8f0', '#0d2649');
  doc.fillColor('#0d2649').font('Helvetica-Bold');
  doc.text('Grand Total (Including GST)', 44, cY + 4.5);
  doc.text(inr(totalAmount), 440, cY + 4.5, { width: 110, align: 'right' });

  cY += 20;
  doc.fontSize(7.2).font('Helvetica').fillColor('#64748b');
  doc.text(`GST Calculation: Basic Project Cost × ${gstRate}%. Final GST treatment will be as applicable under Indian GST regulations.`, 44, cY);
  y = cY + 14;

  // 4. PROJECT DELIVERY TIMELINE
  ensureSpace(66);
  y = drawSectionBanner(doc, '4. PROJECT DELIVERY TIMELINE', y);
  doc.rect(36, y, 523, 58).stroke('#cbd5e1');
  doc.fontSize(8).fillColor('#0f172a');
  doc.font('Helvetica-Bold').text('Minimum Development Time: ', 44, y + 6, { continued: true }).font('Helvetica').text(`${minDays} Days`);
  doc.font('Helvetica-Bold').text('Maximum Development Time: ', 290, y + 6, { continued: true }).font('Helvetica').text(`${maxDays} Days`);
  doc.font('Helvetica-Bold').text('Estimated Delivery: ', 44, y + 20, { continued: true }).font('Helvetica').text(estimatedDelivery);
  doc.fontSize(7.2).font('Helvetica').text('Actual timeline confirmed in final Work Order. Timeline starts after written PO, advance payment & resources.', 44, y + 33, { width: 505 });
  doc.fontSize(6.8).fillColor('#475569');
  doc.text('• Client approval / Purchase Order   • Receipt of agreed advance payment   • Delivery of all client technical inputs', 44, y + 45);
  y += 64;

  // 5. PAYMENT TERMS
  ensureSpace(80);
  y = drawSectionBanner(doc, '5. PAYMENT TERMS', y);
  doc.rect(36, y, 523, 15).fill('#0d2649');
  doc.fillColor('#fff').fontSize(8).font('Helvetica-Bold');
  doc.text('Payment Stage', 44, y + 4);
  doc.text('Percentage', 440, y + 4, { width: 110, align: 'right' });

  let ptY = y + 15;
  doc.fillColor('#0f172a').font('Helvetica').fontSize(7.8);
  doc.rect(36, ptY, 523, 13).fillAndStroke('#f8fafc', '#e2e8f0');
  doc.text('Advance Payment', 44, ptY + 3);
  doc.text(`${advancePct}%`, 440, ptY + 3, { width: 110, align: 'right' });

  ptY += 13;
  doc.rect(36, ptY, 523, 13).fillAndStroke('#ffffff', '#e2e8f0');
  doc.text('Development / Milestone Payment', 44, ptY + 3);
  doc.text(`${milestonePct}%`, 440, ptY + 3, { width: 110, align: 'right' });

  ptY += 13;
  doc.rect(36, ptY, 523, 13).fillAndStroke('#f8fafc', '#e2e8f0');
  doc.text('Final Payment', 44, ptY + 3);
  doc.text(`${finalPct}%`, 440, ptY + 3, { width: 110, align: 'right' });

  ptY += 13;
  doc.rect(36, ptY, 523, 15).fillAndStroke('#e2e8f0', '#0d2649');
  doc.font('Helvetica-Bold').fillColor('#0d2649');
  doc.text('Total', 44, ptY + 3.5);
  doc.text('100%', 440, ptY + 3.5, { width: 110, align: 'right' });
  y = ptY + 20;

  // 6. PROJECT DELAY & CHANGE POLICY
  ensureSpace(48);
  y = drawSectionBanner(doc, '6. PROJECT DELAY & CHANGE POLICY', y);
  doc.rect(36, y, 523, 40).stroke('#cbd5e1');
  doc.fontSize(7.2).fillColor('#334155');
  doc.text('• Delays from late approvals, missing info, or client-side dependencies may extend project delivery timeline.', 44, y + 4.5);
  doc.text('• Additional scope changes outside approved quotation require separate commercials and revised schedules.', 44, y + 16);
  doc.text('• Any revised delivery milestones will be communicated in writing and mutually approved.', 44, y + 27.5);
  y += 46;

  // 7. TERMS & CONDITIONS
  ensureSpace(52);
  y = drawSectionBanner(doc, '7. TERMS & CONDITIONS', y);
  doc.rect(36, y, 523, 44).stroke('#cbd5e1');
  doc.fontSize(7.2).fillColor('#334155');
  doc.text('• Work commences upon written approval / Purchase Order and receipt of agreed advance payment.', 44, y + 4.5);
  doc.text('• Hardware components, 3rd party licenses, cloud hosting, and travel included only if specifically stated.', 44, y + 14.5);
  doc.text('• Final deliverables, source code and handover provided per approved scope and full payment realization.', 44, y + 24.5);
  doc.text('• Applicable taxes and statutory GST charged as per prevailing Government of India regulations.', 44, y + 34.5);
  y += 50;

  // 8. QUOTATION ACCEPTANCE
  ensureSpace(82);
  y = drawSectionBanner(doc, '8. QUOTATION ACCEPTANCE', y);
  doc.fontSize(7.5).fillColor('#0f172a').text('I/We accept the project scope, commercial terms, pricing and delivery conditions mentioned in this quotation.', 44, y + 3);
  y += 14;

  const sigW = 256;
  const sigH = 74;
  doc.rect(36, y, sigW, sigH).stroke('#cbd5e1');
  doc.rect(303, y, sigW, sigH).stroke('#cbd5e1');

  doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0d2649').text('For RvmAiTech', 44, y + 6);
  doc.font('Helvetica').fontSize(7.5).fillColor('#475569');
  doc.text('Authorized Signatory: __________________________', 44, y + 22);
  doc.text(`Name: ${signatoryName}  |  Role: ${signatoryRole}`, 44, y + 38);
  doc.text(`Date: ${signDate}`, 44, y + 54);

  doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0d2649').text('Client Acceptance', 311, y + 6);
  doc.font('Helvetica').fontSize(7.5).fillColor('#475569');
  doc.text('Client Name: __________________________', 311, y + 22);
  doc.text(`Company Name: ${companyName}`, 311, y + 38, { width: 240, ellipsis: true });
  doc.text('Authorized Signature & Stamp: __________________________', 311, y + 54);

  // Corporate footers on all pages
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const footerY = 806;
    doc.moveTo(36, footerY).lineTo(559, footerY).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
    doc.fontSize(6.8).fillColor('#64748b').text(
      `Page ${i + 1} of ${range.count}  |  RvmAiTech  |  Email: rvmaitech2026@gmail.com  |  WhatsApp: 7052050656  |  Smart Solutions. Intelligent Automation. Reliable Technology.`,
      36, footerY + 4,
      { align: 'center', width: 523, lineBreak: false }
    );
  }

  return docToBuffer(doc);
}

/* 6. Official Proforma Invoice (PI) PDF (Matches Exact 8-Section RvmAiTech Template) */
async function generateProformaPdf(pi, cust, company) {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 18, bottom: 10, left: 36, right: 36 }, bufferPages: true, compress: false });
  const c = cust || {};

  const piNo = pi.no || 'RVM/PI/2026/001';
  const piDate = fmtDate(pi.date || new Date());
  const validUntil = fmtDate(pi.validUntil || (pi.date ? new Date(new Date(pi.date).getTime() + 30 * 86400000) : new Date(Date.now() + 30 * 86400000)));
  const isFullPayment = String(pi.paymentType || '').toLowerCase().includes('full');
  const paymentTypeLabel = isFullPayment ? 'Full Payment' : 'Advance Payment';

  // 1. Seller Details
  const sellerCompany = 'RvmAiTech Solutions Private Limited';
  const sellerEmail = 'rvmaitech2026@gmail.com';
  const sellerPhone = '7052050656';
  const sellerGstin = '08AABCR1234F1Z0';
  const sellerAddress = 'Plot No. 42, RIICO Industrial Area, Mansarovar, Jaipur, Rajasthan - 302020';

  // 2. Client Details
  const companyName = pi.companyName || c.company || c.name || '[Client Company Name]';
  const contactPerson = pi.contactPerson || c.contact || c.name || '[Contact Person]';
  const clientEmail = pi.email || c.email || '[Client Email]';
  const clientPhone = pi.phone || c.phone || '[Client Phone]';
  const clientAddress = pi.address || c.address || 'Jaipur, Rajasthan';
  const clientGstin = pi.gstin || c.gstin || 'Unregistered / N/A';

  // 3. Project Details
  const projectName = pi.projectName || pi.name || 'Smart Industrial Automation System';
  const projectId = pi.projectId || 'PRJ-001';
  const projectCategory = pi.projectCategory || 'Software / Hardware / Industrial Automation';
  const projectDesc = pi.projectDesc || pi.desc || 'Turnkey embedded hardware, IoT sensor telemetry, and cloud management software platform.';
  const expectedDelivery = pi.expectedDelivery || '30–90 Days';

  // 4. Cost Details
  const basicCost = Number(pi.basicCost !== undefined ? pi.basicCost : (pi.subtotal || (pi.items && pi.items.length ? pi.items.reduce((a, it) => a + (Number(it.qty) * Number(it.rate)), 0) : 450000)));
  const gstRate = Number(pi.gstRate || 18);
  const gstAmount = Number(pi.gstAmount) || Math.round(basicCost * (gstRate / 100));
  const totalAmount = Number(pi.totalAmount || pi.total) || (basicCost + gstAmount);

  // 5. Payment Type Options
  let advPct = isFullPayment ? 100 : (Number(pi.advancePct) || 50);
  let advAmount = isFullPayment ? totalAmount : (Number(pi.advanceAmount) || Math.round(totalAmount * (advPct / 100)));
  let remAmount = isFullPayment ? 0 : (totalAmount - advAmount);

  // 6. Bank Details
  const accountHolder = pi.accountHolder || 'RvmAiTech Solutions Private Limited';
  const bankName = pi.bankName || 'State Bank of India (SBI)';
  const accountNo = pi.accountNo || '409120008891';
  const ifsc = pi.ifsc || 'SBIN0031852';
  const branch = pi.branch || 'RIICO Industrial Area, Mansarovar, Jaipur';
  const upiId = pi.upiId || '7052050656@sbi';

  // 8. Signatory
  const signatoryName = pi.signatoryName || 'Vivek Kumar Bhardwaj';
  const signatoryRole = pi.signatoryRole || 'CEO / Founder';
  const signDate = fmtDate(pi.signDate || pi.date || new Date());

  const maxY = 792;

  function drawSectionBanner(d, title, yPos) {
    d.rect(36, yPos, 523, 17).fill('#0284c7');
    d.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold').text(title, 42, yPos + 4);
    d.fillColor('#0f172a').font('Helvetica');
    return yPos + 19;
  }

  function drawPageHeader(isFirstPage) {
    let yPos = 22;
    const logoW = isFirstPage ? 130 : 100;
    const logoH = Math.round(logoW * (300 / 1126));

    if (fs.existsSync(LOGO_PATH)) {
      try {
        doc.image(LOGO_PATH, 36, yPos, { width: logoW });
      } catch (e) {
        doc.fontSize(15).fillColor('#0d2649').font('Helvetica-Bold').text('RvmAiTech', 36, yPos);
      }
    } else {
      doc.fontSize(15).fillColor('#0d2649').font('Helvetica-Bold').text('RvmAiTech', 36, yPos);
    }

    const subY = yPos + logoH + 4;
    doc.fontSize(7.5).fillColor('#0284c7').font('Helvetica-Bold').text('SOFTWARE | HARDWARE | INDUSTRIAL AUTOMATION', 36, subY);

    if (isFirstPage) {
      doc.rect(345, yPos, 214, 21).fill('#0284c7');
      doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold').text('PROFORMA INVOICE (PI)', 345, yPos + 5.5, { width: 214, align: 'center' });

      doc.fillColor('#0f172a').fontSize(8).font('Helvetica');
      doc.text(`PI Number: ${piNo}`, 345, yPos + 25, { width: 214, align: 'right' });
      doc.text(`PI Date: ${piDate}`, 345, yPos + 36, { width: 214, align: 'right' });
      doc.text(`Valid Until: ${validUntil}`, 345, yPos + 47, { width: 214, align: 'right' });
      doc.font('Helvetica-Bold').fillColor('#0284c7').text(`Payment Type: ${paymentTypeLabel}`, 345, yPos + 58, { width: 214, align: 'right' });
    } else {
      doc.fontSize(9).fillColor('#0284c7').font('Helvetica-Bold').text('PROFORMA INVOICE (Continued)', 340, yPos + 5, { width: 219, align: 'right' });
      doc.fontSize(7.5).fillColor('#475569').font('Helvetica').text(`Ref: ${piNo}`, 340, yPos + 18, { width: 219, align: 'right' });
    }

    const lineY = Math.max(subY + 11, isFirstPage ? (yPos + 73) : (yPos + 34));
    doc.moveTo(36, lineY).lineTo(559, lineY).strokeColor('#0284c7').lineWidth(1.3).stroke();
    return lineY + 6;
  }

  function ensureSpace(neededHeight) {
    if (y + neededHeight > maxY) {
      doc.addPage();
      y = drawPageHeader(false);
    }
  }

  // Draw Page 1 Header
  let y = drawPageHeader(true);

  // 1. SELLER DETAILS
  ensureSpace(58);
  y = drawSectionBanner(doc, '1. SELLER DETAILS', y);
  doc.rect(36, y, 523, 50).stroke('#cbd5e1');
  doc.fontSize(8).fillColor('#0f172a');
  doc.font('Helvetica-Bold').text('Company Name: ', 44, y + 6, { continued: true }).font('Helvetica').text(sellerCompany);
  doc.font('Helvetica-Bold').text('Email: ', 44, y + 20, { continued: true }).font('Helvetica').text(sellerEmail);
  doc.font('Helvetica-Bold').text('WhatsApp: ', 44, y + 34, { continued: true }).font('Helvetica').text(sellerPhone);
  doc.font('Helvetica-Bold').text('GSTIN: ', 290, y + 6, { continued: true }).font('Helvetica').text(sellerGstin);
  doc.font('Helvetica-Bold').text('Business Address: ', 290, y + 20, { continued: true }).font('Helvetica').text(sellerAddress, { width: 260, height: 26, ellipsis: true });
  y += 56;

  // 2. CLIENT DETAILS
  ensureSpace(58);
  y = drawSectionBanner(doc, '2. CLIENT DETAILS', y);
  doc.rect(36, y, 523, 50).stroke('#cbd5e1');
  doc.fontSize(8).fillColor('#0f172a');
  doc.font('Helvetica-Bold').text('Client / Company: ', 44, y + 6, { continued: true }).font('Helvetica').text(companyName);
  doc.font('Helvetica-Bold').text('Contact Person: ', 44, y + 20, { continued: true }).font('Helvetica').text(contactPerson);
  doc.font('Helvetica-Bold').text('Client Email: ', 44, y + 34, { continued: true }).font('Helvetica').text(clientEmail);
  doc.font('Helvetica-Bold').text('Client Phone: ', 290, y + 6, { continued: true }).font('Helvetica').text(clientPhone);
  doc.font('Helvetica-Bold').text('Client GSTIN: ', 290, y + 20, { continued: true }).font('Helvetica').text(clientGstin);
  doc.font('Helvetica-Bold').text('Billing Address: ', 290, y + 34, { continued: true }).font('Helvetica').text(clientAddress, { width: 260, height: 14, ellipsis: true });
  y += 56;

  // 3. PROJECT DETAILS
  ensureSpace(66);
  y = drawSectionBanner(doc, '3. PROJECT DETAILS', y);
  doc.rect(36, y, 523, 58).stroke('#cbd5e1');
  doc.fontSize(8);
  doc.font('Helvetica-Bold').text('Project Name: ', 44, y + 6, { continued: true }).font('Helvetica').text(projectName);
  doc.font('Helvetica-Bold').text('Project ID: ', 360, y + 6, { continued: true }).font('Helvetica').text(projectId);
  doc.font('Helvetica-Bold').text('Project Category: ', 44, y + 21, { continued: true }).font('Helvetica').text(projectCategory);
  doc.font('Helvetica-Bold').text('Expected Delivery: ', 360, y + 21, { continued: true }).font('Helvetica').text(expectedDelivery);
  doc.font('Helvetica-Bold').text('Project Description: ', 44, y + 36, { continued: true }).font('Helvetica').text(projectDesc, { width: 505, height: 18, ellipsis: true });
  y += 64;

  // 4. PROJECT PAYMENT DETAILS (Cost Estimation Table)
  ensureSpace(76);
  y = drawSectionBanner(doc, '4. PROJECT PAYMENT DETAILS', y);
  doc.rect(36, y, 523, 17).fill('#0284c7');
  doc.fillColor('#fff').fontSize(8.5).font('Helvetica-Bold');
  doc.text('Description', 44, y + 4.5);
  doc.text('Amount', 440, y + 4.5, { width: 110, align: 'right' });

  let cY = y + 17;
  doc.fillColor('#0f172a').font('Helvetica').fontSize(8);
  doc.rect(36, cY, 523, 16).fillAndStroke('#f0f9ff', '#e2e8f0');
  doc.fillColor('#0f172a').text('Basic Project Cost', 44, cY + 4);
  doc.text(inr(basicCost), 440, cY + 4, { width: 110, align: 'right' });

  cY += 16;
  doc.rect(36, cY, 523, 16).fillAndStroke('#ffffff', '#e2e8f0');
  doc.fillColor('#0f172a').text(`GST @ ${gstRate}%`, 44, cY + 4);
  doc.text(inr(gstAmount), 440, cY + 4, { width: 110, align: 'right' });

  cY += 16;
  doc.rect(36, cY, 523, 19).fillAndStroke('#bae6fd', '#0284c7');
  doc.fillColor('#0d2649').font('Helvetica-Bold').fontSize(8.5);
  doc.text('Total Project Value (Including GST)', 44, cY + 4.5);
  doc.text(inr(totalAmount), 440, cY + 4.5, { width: 110, align: 'right' });
  y = cY + 25;

  // 5. PAYMENT TYPE – SELECT ONE (Side-by-side cleanly styled cards with vector radio bullets)
  ensureSpace(88);
  y = drawSectionBanner(doc, '5. PAYMENT TYPE – SELECT ONE', y);

  const optBoxTop = y;
  const boxW = 256;
  const boxH = 78;

  // Option A Card
  doc.rect(36, optBoxTop, boxW, boxH).fillAndStroke(!isFullPayment ? '#f0f9ff' : '#ffffff', !isFullPayment ? '#0284c7' : '#cbd5e1');
  if (!isFullPayment) {
    doc.circle(46, optBoxTop + 10, 4.5).fillAndStroke('#0284c7', '#0284c7');
    doc.circle(46, optBoxTop + 10, 2).fill('#ffffff');
  } else {
    doc.circle(46, optBoxTop + 10, 4.5).stroke('#94a3b8');
  }
  doc.fillColor(!isFullPayment ? '#0284c7' : '#64748b').fontSize(8.5).font('Helvetica-Bold');
  doc.text('OPTION A: ADVANCE PAYMENT ' + (!isFullPayment ? '(SELECTED)' : ''), 56, optBoxTop + 6.5);
  doc.font('Helvetica').fontSize(8).fillColor('#0f172a');
  doc.text(`Total Project Value: ${inr(totalAmount)}`, 46, optBoxTop + 21);
  doc.text(`Advance Percentage: ${advPct}%`, 46, optBoxTop + 33);
  doc.font('Helvetica-Bold').fillColor('#059669').text(`Advance Amount: ${inr(advAmount)}`, 46, optBoxTop + 45);
  doc.font('Helvetica').fillColor('#0f172a').text(`Remaining Balance: ${inr(remAmount)}`, 46, optBoxTop + 57);
  doc.fontSize(7.2).fillColor('#64748b').text('Payment Due: As per agreed advance terms.', 46, optBoxTop + 67.5);

  // Option B Card
  const optBLeft = 303;
  doc.rect(optBLeft, optBoxTop, boxW, boxH).fillAndStroke(isFullPayment ? '#f0f9ff' : '#ffffff', isFullPayment ? '#0284c7' : '#cbd5e1');
  if (isFullPayment) {
    doc.circle(optBLeft + 10, optBoxTop + 10, 4.5).fillAndStroke('#0284c7', '#0284c7');
    doc.circle(optBLeft + 10, optBoxTop + 10, 2).fill('#ffffff');
  } else {
    doc.circle(optBLeft + 10, optBoxTop + 10, 4.5).stroke('#94a3b8');
  }
  doc.fillColor(isFullPayment ? '#0284c7' : '#64748b').fontSize(8.5).font('Helvetica-Bold');
  doc.text('OPTION B: FULL PAYMENT ' + (isFullPayment ? '(SELECTED)' : ''), optBLeft + 20, optBoxTop + 6.5);
  doc.font('Helvetica').fontSize(8).fillColor('#0f172a');
  doc.text(`Total Project Value: ${inr(totalAmount)}`, optBLeft + 12, optBoxTop + 21);
  doc.text('Payment Percentage: 100%', optBLeft + 12, optBoxTop + 33);
  doc.font('Helvetica-Bold').fillColor('#059669').text(`Total Payable: ${inr(totalAmount)}`, optBLeft + 12, optBoxTop + 45);
  doc.font('Helvetica').fillColor('#0f172a').text('Remaining Balance: INR 0', optBLeft + 12, optBoxTop + 57);
  doc.fontSize(7.2).fillColor('#64748b').text('Payment Due: Full payment before project start.', optBLeft + 12, optBoxTop + 67.5);

  // 6. BANK / PAYMENT DETAILS
  y = optBoxTop + boxH + 6;
  ensureSpace(58);
  y = drawSectionBanner(doc, '6. BANK / PAYMENT DETAILS', y);
  doc.rect(36, y, 523, 50).stroke('#cbd5e1');
  doc.fontSize(8).fillColor('#0f172a');
  doc.font('Helvetica-Bold').text('Account Holder: ', 44, y + 6, { continued: true }).font('Helvetica').text(accountHolder);
  doc.font('Helvetica-Bold').text('Bank Name: ', 44, y + 20, { continued: true }).font('Helvetica').text(bankName);
  doc.font('Helvetica-Bold').text('Account Number: ', 44, y + 34, { continued: true }).font('Helvetica').text(accountNo);
  doc.font('Helvetica-Bold').text('IFSC Code: ', 290, y + 6, { continued: true }).font('Helvetica').text(ifsc);
  doc.font('Helvetica-Bold').text('Branch: ', 290, y + 20, { continued: true }).font('Helvetica').text(branch);
  doc.font('Helvetica-Bold').text('UPI ID: ', 290, y + 34, { continued: true }).font('Helvetica').text(upiId);
  y += 56;

  // 7. PAYMENT TERMS & CONDITIONS (2 Balanced Columns)
  ensureSpace(62);
  y = drawSectionBanner(doc, '7. PAYMENT TERMS & CONDITIONS', y);
  doc.rect(36, y, 523, 54).stroke('#cbd5e1');
  doc.fontSize(7.2).fillColor('#334155');
  doc.text('• This document is a Proforma Invoice, not a final Tax Invoice.', 44, y + 5);
  doc.text('• Project work starts upon written PO and receipt of agreed payment.', 44, y + 17);
  doc.text('• Balance payable according to approved milestone schedule.', 44, y + 29);
  doc.text('• Additional scope changes outside quotation will be billed separately.', 44, y + 41);

  doc.text('• For full payment, entire quoted amount due before project kickoff.', 295, y + 5);
  doc.text('• Estimated delivery between 30 and 90 days as per project scope.', 295, y + 17);
  doc.text('• GST and tax invoices handled per prevailing Indian regulations.', 295, y + 29);
  doc.text('• Payment receipt shared immediately upon credit to company account.', 295, y + 41);
  y += 60;

  // 8. AUTHORIZATION
  ensureSpace(82);
  y = drawSectionBanner(doc, '8. AUTHORIZATION & SIGNATURE', y);

  const sigBoxW = 256;
  const sigBoxH = 74;
  doc.rect(36, y, sigBoxW, sigBoxH).stroke('#cbd5e1');
  doc.rect(303, y, sigBoxW, sigBoxH).stroke('#cbd5e1');

  doc.fontSize(8.5).fillColor('#0284c7').font('Helvetica-Bold').text('For RvmAiTech', 44, y + 6);
  doc.font('Helvetica').fontSize(7.8).fillColor('#0f172a');
  doc.text('Authorized Signatory: __________________________', 44, y + 24);
  doc.text(`Name: ${signatoryName}  |  Role: ${signatoryRole}`, 44, y + 40);
  doc.text(`Date: ${signDate}`, 44, y + 56);

  doc.fontSize(8.5).fillColor('#0284c7').font('Helvetica-Bold').text('Client Payment Confirmation', 311, y + 6);
  doc.font('Helvetica').fontSize(7.8).fillColor('#0f172a');
  doc.text('Client Name: __________________________', 311, y + 24);
  doc.text(`Company Name: ${companyName}`, 311, y + 40, { width: 240, ellipsis: true });
  doc.text('Authorized Signature & Stamp: __________________________', 311, y + 56);

  // Corporate footers on all pages
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const footerY = 806;
    doc.moveTo(36, footerY).lineTo(559, footerY).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
    doc.fontSize(6.8).fillColor('#64748b').text(
      `Page ${i + 1} of ${range.count}  |  RvmAiTech  |  Email: rvmaitech2026@gmail.com  |  WhatsApp: 7052050656  |  Smart Solutions. Intelligent Automation. Reliable Technology.`,
      36, footerY + 4,
      { align: 'center', width: 523, lineBreak: false }
    );
  }

  return docToBuffer(doc);
}


/* 7. Advance Payment Receipt Voucher PDF */
async function generateAdvanceReceiptPdf(rec, invoice, cust, company) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  drawHeader(doc, company, 'Advance Payment Receipt', '#059669');

  const c = cust || {};
  doc.fontSize(8.5).font('Helvetica');
  doc.text(`Receipt Voucher No: ${rec.no || 'REC-2026-0001'}`, 40, doc.y);
  doc.text(`Invoice Ref: ${invoice ? invoice.no : 'ADVANCE'}`, 260, doc.y);
  doc.text(`Date: ${fmtDate(rec.date)}`, 450, doc.y);
  doc.moveDown(0.6);

  const boxTop = doc.y;
  doc.rect(40, boxTop, 515, 65).fillAndStroke('#ecfdf5', '#a7f3d0');
  doc.fillColor('#0f172a').fontSize(8.5);
  doc.font('Helvetica-Bold').text('Received With Thanks From:', 50, boxTop + 8);
  doc.font('Helvetica').text(`${c.company || c.name || 'Valued Client'}`, 50, boxTop + 20);
  doc.font('Helvetica-Bold').text('Amount Received: ', 50, boxTop + 34).fillColor('#059669').text(inr(rec.amount || (invoice ? invoice.advanceAmount : 0)));
  doc.fillColor('#0f172a').font('Helvetica').text(`Payment Mode: ${rec.mode || 'UPI / QR Code (7052050656)'} | Ref: ${rec.ref || 'ADV-50'}`, 50, boxTop + 48);

  doc.y = boxTop + 85;
  doc.rect(40, doc.y, 515, 80).fillAndStroke('#f8fafc', '#cbd5e1');
  const bY = doc.y;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#065f46').text('Receipt Acknowledgement Details:', 50, bY + 10);
  doc.font('Helvetica').fontSize(8.5).fillColor('#334155');
  doc.text('This voucher serves as official acknowledgement of the advance deposit received against smart parking automation supply.', 50, bY + 26, { width: 495 });
  doc.text(`Current Outstanding Balance: ${invoice ? inr(invoice.total - (invoice.paid || 0)) : 'Rs. 0'}`, 50, bY + 54);

  doc.y = 670;
  doc.rect(40, 670, 240, 70).stroke('#cbd5e1');
  doc.rect(315, 670, 240, 70).stroke('#cbd5e1');
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#059669').text('Client Payer Acknowledgement', 50, 678);
  doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text('Paid By: Client Authorized Person', 50, 720);
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#059669').text('For RvmAiTech Solutions Pvt. Ltd.', 325, 678);
  doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text('Accounts & Finance Signatory', 325, 720);

  drawFooter(doc, company);
  return docToBuffer(doc);
}

module.exports = {
  generateOfferLetterPdf,
  generateJoiningLetterPdf,
  generateIdCardPdf,
  generateInvoicePdf,
  generatePurchaseOrderPdf,
  generateQuotationPdf,
  generateProformaPdf,
  generateAdvanceReceiptPdf
};

