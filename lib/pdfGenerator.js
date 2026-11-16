const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const LOGO_PATH = path.join(__dirname, '..', 'public', 'logo-for-white-bg.png');

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
  const startY = 35;

  if (fs.existsSync(LOGO_PATH)) {
    try {
      doc.image(LOGO_PATH, 40, startY, { width: 140 });
    } catch (e) {
      doc.fontSize(16).fillColor('#0d2649').text('RvmAiTech', 40, startY);
    }
  } else {
    doc.fontSize(16).fillColor('#0d2649').text('RvmAiTech', 40, startY);
  }

  // Right-aligned Badge Title
  doc.rect(370, startY, 185, 24).fill(badgeColor);
  doc.fontSize(9.5).fillColor('#ffffff').text(title.toUpperCase(), 370, startY + 7, { width: 185, align: 'center' });

  // Company details below logo
  doc.fontSize(8.5).fillColor('#0d2649').font('Helvetica-Bold')
     .text(coName, 40, startY + 44);
  doc.fontSize(7.5).fillColor('#475569').font('Helvetica')
     .text('CIN: U72900RJ2026PTC089123 | GSTIN: 08AABCR1234F1Z0 | PAN: AAACE0836F', 40, startY + 56)
     .text('Cyber City, Mansarovar, Jaipur, Rajasthan - 302020 | rvmaitech2026@gmail.com | +91 7052050656', 40, startY + 67);

  // Divider line
  doc.moveTo(40, startY + 80).lineTo(555, startY + 80).lineWidth(1.5).strokeColor('#0d2649').stroke();
  doc.y = startY + 90;
}

function drawFooter(doc, company) {
  const pageBottom = 780;
  doc.moveTo(40, pageBottom).lineTo(555, pageBottom).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
  doc.fontSize(7.5).fillColor('#64748b').font('Helvetica')
     .text('RvmAiTech Solutions Pvt. Ltd. · Registered Office: Cyber City, Mansarovar, Jaipur - 302020 · www.rvmaitech.com', 40, pageBottom + 6, { align: 'center', width: 515 });
}

/* 1. Employment Offer Letter PDF */
async function generateOfferLetterPdf(e, company) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  drawHeader(doc, company, 'Employment Offer Letter', '#0d2649');

  const gross = Number(e.salary || 0);
  const basic = Math.round(gross * 0.5);
  const hra = Math.round(gross * 0.3);
  const special = gross - basic - hra;
  const annualCtc = gross * 12;
  const refNo = `RVM/HR/OFFER/${new Date().getFullYear()}/${e.code || '0001'}`;

  doc.fontSize(8.5).font('Helvetica');
  doc.text(`Date: ${fmtDate(new Date())}`, 40, doc.y);
  doc.text(`Ref: ${refNo}`, 400, doc.y - 10, { align: 'right' });
  doc.moveDown(0.8);

  // Candidate Box
  const boxTop = doc.y;
  doc.rect(40, boxTop, 515, 45).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.fillColor('#0f172a').fontSize(8.5);
  doc.font('Helvetica-Bold').text('Candidate Name: ', 50, boxTop + 8, { continued: true }).font('Helvetica').text(e.name || 'Candidate');
  doc.font('Helvetica-Bold').text('Designation: ', 300, boxTop + 8, { continued: true }).font('Helvetica').text(e.role || 'Staff');
  doc.font('Helvetica-Bold').text('Email / Phone: ', 50, boxTop + 24, { continued: true }).font('Helvetica').text(`${e.email || '—'} / ${e.phone || '—'}`);
  doc.font('Helvetica-Bold').text('Joining Date: ', 300, boxTop + 24, { continued: true }).font('Helvetica').text(fmtDate(e.joined));

  doc.y = boxTop + 55;
  doc.fontSize(9).font('Helvetica-Bold').text(`Dear ${e.name ? e.name.split(' ')[0] : 'Candidate'},`);
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(8.5).text('We are pleased to offer you employment with RvmAiTech Solutions Private Limited on the terms set out below. This offer is subject to satisfactory verification of credentials.');
  doc.moveDown(0.5);

  // Compensation Table
  doc.font('Helvetica-Bold').fontSize(9).text('Compensation & Salary Structure (INR):');
  doc.moveDown(0.3);

  const tblY = doc.y;
  doc.rect(40, tblY, 515, 18).fill('#0d2649');
  doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
  doc.text('Salary Component', 50, tblY + 5);
  doc.text('Monthly (Rs.)', 320, tblY + 5);
  doc.text('Annual (Rs.)', 440, tblY + 5);

  const rows = [
    ['Basic Salary (50%)', inr(basic), inr(basic * 12)],
    ['House Rent Allowance - HRA (30%)', inr(hra), inr(hra * 12)],
    ['Special / Other Allowance (20%)', inr(special), inr(special * 12)],
    ['Total Monthly Gross Salary', inr(gross), inr(annualCtc)]
  ];

  let rY = tblY + 18;
  doc.font('Helvetica').fontSize(8).fillColor('#0f172a');
  rows.forEach(([comp, m, a], idx) => {
    const isTotal = idx === rows.length - 1;
    doc.rect(40, rY, 515, 18).fillAndStroke(isTotal ? '#e2e8f0' : (idx % 2 === 0 ? '#f8fafc' : '#ffffff'), '#cbd5e1');
    doc.fillColor(isTotal ? '#0d2649' : '#0f172a');
    if (isTotal) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
    doc.text(comp, 50, rY + 5);
    doc.text(m, 320, rY + 5);
    doc.text(a, 440, rY + 5);
    rY += 18;
  });

  doc.y = rY + 12;
  doc.font('Helvetica-Bold').fontSize(8.5).text('Key Terms & Conditions:');
  doc.font('Helvetica').fontSize(8);
  const terms = [
    '1. Working Hours: Standard operational shift is 8 hours/day, Monday to Saturday (09:00 AM to 05:00 PM).',
    '2. Probation Period: 3 months from the date of joining, extendable based on performance review.',
    '3. Confidentiality: You agree to keep all proprietary source code, credentials, and company data confidential.',
    '4. Notice Period: 30 days written notice required prior to separation or resignation.'
  ];
  terms.forEach(t => {
    doc.text(t);
    doc.moveDown(0.2);
  });

  // Signatures
  doc.y = 660;
  doc.rect(40, 660, 240, 75).stroke('#cbd5e1');
  doc.rect(315, 660, 240, 75).stroke('#cbd5e1');

  doc.fontSize(8).font('Helvetica-Bold').fillColor('#0d2649');
  doc.text('For RvmAiTech Solutions Pvt. Ltd.', 50, 668);
  doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text('Authorized Signatory / HR Operations', 50, 715);

  doc.fontSize(8).font('Helvetica-Bold').fillColor('#0d2649');
  doc.text('Candidate Acceptance Signature', 325, 668);
  doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text(`I accept this offer (${e.name || ''})`, 325, 715);

  drawFooter(doc, company);
  return docToBuffer(doc);
}

/* 2. Official Joining Letter PDF */
async function generateJoiningLetterPdf(e, company) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  drawHeader(doc, company, 'Official Joining Letter', '#0284c7');

  const refNo = `RVM/HR/JOIN/${new Date().getFullYear()}/${e.code || '0001'}`;

  doc.fontSize(8.5).font('Helvetica');
  doc.text(`Date: ${fmtDate(new Date())}`, 40, doc.y);
  doc.text(`Ref: ${refNo}`, 400, doc.y - 10, { align: 'right' });
  doc.moveDown(0.8);

  const boxTop = doc.y;
  doc.rect(40, boxTop, 515, 60).fillAndStroke('#f0f9ff', '#bae6fd');
  doc.fillColor('#0f172a').fontSize(8.5);
  doc.font('Helvetica-Bold').text('Employee Code: ', 50, boxTop + 8, { continued: true }).font('Helvetica').text(e.code || '—');
  doc.font('Helvetica-Bold').text('Employee Name: ', 300, boxTop + 8, { continued: true }).font('Helvetica').text(e.name || '—');
  doc.font('Helvetica-Bold').text('Designation: ', 50, boxTop + 24, { continued: true }).font('Helvetica').text(e.role || 'Staff');
  doc.font('Helvetica-Bold').text('Department: ', 300, boxTop + 24, { continued: true }).font('Helvetica').text(e.dept || 'Operations');
  doc.font('Helvetica-Bold').text('Confirmed Joining Date: ', 50, boxTop + 40, { continued: true }).font('Helvetica').text(fmtDate(e.joined));
  doc.font('Helvetica-Bold').text('Gross Monthly Salary: ', 300, boxTop + 40, { continued: true }).font('Helvetica').text(inr(e.salary));

  doc.y = boxTop + 75;
  doc.fontSize(9.5).font('Helvetica-Bold').text('APPOINTMENT & JOINING CONFIRMATION');
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(8.5).text(`This is to formally certify that ${e.name} has officially reported for duty and joined RvmAiTech Solutions Private Limited with effect from ${fmtDate(e.joined)}.`);
  doc.moveDown(0.5);

  doc.text('Your corporate credentials, identity card, and employee workstation access have been provisioned in the internal Enterprise ERP & HRMS system.');
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').text('Employee Responsibilities & Code of Conduct:');
  doc.font('Helvetica').fontSize(8);
  doc.text('• Comply with all company cybersecurity, intellectual property, and data protection guidelines.');
  doc.text('• Punctual attendance marking through the HRMS terminal (09:00 AM shift start).');
  doc.text('• All original identity documents (Aadhaar, PAN, Education certificates) must be verified on portal.');

  doc.y = 660;
  doc.rect(40, 660, 240, 75).stroke('#cbd5e1');
  doc.rect(315, 660, 240, 75).stroke('#cbd5e1');
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#0284c7').text('For RvmAiTech Solutions Pvt. Ltd.', 50, 668);
  doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text('Head of HR & Talent Operations', 50, 715);
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#0284c7').text('Employee Acknowledgement', 325, 668);
  doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text(`Joined Duty: ${e.name || ''}`, 325, 715);

  drawFooter(doc, company);
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
  generateInvoicePdf,
  generatePurchaseOrderPdf,
  generateQuotationPdf,
  generateProformaPdf,
  generateAdvanceReceiptPdf
};

