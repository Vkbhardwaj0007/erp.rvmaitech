'use strict';
/* What each list of records looks like, who may read or change it, and the checks made before saving. */

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const MODULES = ['erp', 'crm', 'hrms', 'finance', 'projects', 'employee'];
const STAGES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];
const SOURCES = ['Referral', 'Website', 'Walk-in', 'Phone call', 'Exhibition', 'Social media', 'Other'];
const LEAVE_TYPES = ['Casual', 'Sick', 'Earned', 'Unpaid'];
const ID_TYPES = ['', 'Aadhaar', 'PAN', 'Voter ID', 'Driving licence', 'Passport', 'Other'];
const EXPENSE_CATS = ['Rent', 'Electricity', 'Transport', 'Office', 'Repairs', 'Marketing', 'Taxes and fees', 'Other'];
const PROJECT_STATUS = ['Planned', 'Running', 'On hold', 'Completed', 'Delivered'];
const FILE_KINDS = ['photo', 'ID proof', 'Address proof', 'Certificate', 'Offer letter', 'Bank document', 'Aadhaar Card', 'PAN Card', 'Resume', 'Experience Letter', 'Other'];

const pad = x => String(x).padStart(2, '0');
const isoOf = dt => dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
const today = () => isoOf(new Date());
function parseISO(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
  if (!m) return null;
  const dt = new Date(+m[1], +m[2] - 1, +m[3]);
  return dt.getFullYear() === +m[1] && dt.getMonth() === +m[2] - 1 && dt.getDate() === +m[3] ? dt : null;
}
const round2 = x => Math.round(x * 100) / 100;
function nextNo(list, key, prefix, width) {
  let max = 0;
  for (const x of list) { const m = /(\d+)\s*$/.exec(String(x[key] || '')); if (m) max = Math.max(max, +m[1]); }
  return prefix + String(max + 1).padStart(width, '0');
}
function leaveDays(from, to) {
  let count = 0;
  for (const dt = parseISO(from), end = parseISO(to); dt <= end; dt.setDate(dt.getDate() + 1)) if (dt.getDay() !== 0) count++;
  return count;
}

/* ---------- field types ---------- */
const s = (label, max = 160, x) => Object.assign({ t: 'str', label, max }, x);
const n = (label, min = 0, max = 1e12, x) => Object.assign({ t: 'num', label, min, max }, x);
const d = (label, x) => Object.assign({ t: 'date', label }, x);
const e = (label, values, x) => Object.assign({ t: 'enum', label, values }, x);
const r = (label, col, x) => Object.assign({ t: 'ref', label, col }, x);
const REQ = { req: true };

function coerce(f, v, db) {
  const bad = msg => { throw new HttpError(400, msg); };
  switch (f.t) {
    case 'str': {
      const x = String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
      if (x.length > f.max) bad(`${f.label} is too long. Keep it under ${f.max} characters.`);
      return x;
    }
    case 'num': {
      const x = typeof v === 'number' ? v : (String(v == null ? '' : v).trim() === '' ? NaN : Number(v));
      if (!Number.isFinite(x)) bad(`${f.label} must be a number.`);
      if (x < f.min || x > f.max) bad(`${f.label} must be between ${f.min} and ${f.max}.`);
      return x;
    }
    case 'date': {
      const x = String(v == null ? '' : v).trim();
      if (x !== '' && !parseISO(x)) bad(`${f.label} is not a valid date.`);
      return x;
    }
    case 'enum': {
      const x = String(v == null ? '' : v);
      if (!f.values.includes(x)) bad(`${f.label}: "${x.slice(0, 30)}" is not one of the allowed choices.`);
      return x;
    }
    case 'ref': {
      const x = String(v == null ? '' : v);
      if (x !== '' && !db[f.col].some(o => o.id === x)) bad(`${f.label}: that record no longer exists. Reload the page and choose again.`);
      return x;
    }
    case 'refs': {
      if (!Array.isArray(v)) bad(`${f.label} must be a list.`);
      const ids = [...new Set(v.map(String))].slice(0, 200);
      for (const x of ids) if (!db[f.col].some(o => o.id === x)) bad(`${f.label}: one of the chosen records no longer exists. Reload the page and choose again.`);
      return ids;
    }
    default: throw new Error('unknown field type ' + f.t);
  }
}
/* Keep only known fields, in the right type. With `partial`, missing fields are left alone. */
function clean(fields, input, db, partial) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'The request body must be a JSON object.');
  const out = {};
  for (const [k, f] of Object.entries(fields)) {
    if (input[k] === undefined) {
      if (partial) continue;
      if (f.req) throw new HttpError(400, `${f.label} is required.`);
      out[k] = f.def !== undefined ? f.def : (f.t === 'num' ? 0 : f.t === 'refs' ? [] : '');
      continue;
    }
    out[k] = coerce(f, input[k], db);
    if (f.req && out[k] === '') throw new HttpError(400, `${f.label} is required.`);
    if (f.positive && !(out[k] > 0)) throw new HttpError(400, `${f.label} must be more than zero.`);
  }
  return out;
}
function unique(db, col, key, doc, old, label) {
  const v = String(doc[key] == null ? '' : doc[key]).toLowerCase();
  if (v && db[col].some(x => x !== old && String(x[key] || '').toLowerCase() === v)) throw new HttpError(409, `Another record already uses this ${label}.`);
}

/* ---------- collections ----------
   write: modules that may add, change and delete.   read: module -> view ('full' or a named cut-down view).
   check(doc, ctx): runs on create and update with the merged record. ctx = { db, old, patch, user }. */
const COLLECTIONS = {
  products: {
    prefix: 'p', write: ['erp'], read: { erp: 'full' },
    fields: {
      sku: s('SKU', 40, REQ), name: s('Product name', 120, REQ), category: s('Category', 60), unit: s('Unit', 20, { def: 'pcs' }),
      opening: n('Opening stock'), reorder: n('Reorder level'), cost: n('Cost price'), price: n('Selling price'), gst: n('GST %', 0, 40, { def: 18 })
    },
    check: (doc, ctx) => unique(ctx.db, 'products', 'sku', doc, ctx.old, 'SKU'),
    canDelete: (doc, db) => {
      const used = db.invoices.filter(i => i.items.some(it => it.productId === doc.id)).length + db.purchases.filter(p => p.productId === doc.id).length + db.issues.filter(i => i.productId === doc.id).length;
      if (used) throw new HttpError(409, `${doc.name} is used in ${used} invoice, purchase or issue record${used === 1 ? '' : 's'}. Delete those first.`);
    }
  },
  customers: {
    prefix: 'c', write: ['crm', 'erp'], read: { crm: 'full', erp: 'full', finance: 'full', projects: 'lite' },
    views: { lite: ['id', 'name', 'company', 'city'] },
    fields: {
      name: s('Contact name', 120, REQ), company: s('Company', 120), phone: s('Phone', 30), email: s('Email', 120), city: s('City', 60),
      gstin: s('GSTIN', 15), address: s('Address', 300), fromLead: r('Lead', 'leads')
    },
    check: doc => {
      doc.gstin = String(doc.gstin || '').toUpperCase();
      if (doc.gstin && !/^[0-9A-Z]{15}$/.test(doc.gstin)) throw new HttpError(400, 'A GSTIN has 15 letters and digits. Check it, or leave it empty.');
    },
    canDelete: (doc, db) => {
      const used = db.invoices.filter(i => i.customerId === doc.id).length;
      if (used) throw new HttpError(409, `This customer has ${used} invoice${used === 1 ? '' : 's'}. Delete those first.`);
    }
  },
  leads: {
    prefix: 'l', write: ['crm'], read: { crm: 'full' },
    fields: {
      name: s('Contact name', 120, REQ), company: s('Company', 120), phone: s('Phone', 30), email: s('Email', 120),
      source: e('Source', SOURCES, { def: 'Referral' }), stage: e('Stage', STAGES, { def: 'New' }), value: n('Deal value'),
      ownerId: r('Owner', 'employees'), followUp: d('Follow-up date'), note: s('Notes', 600), customerId: r('Customer', 'customers')
    }
  },
  quotations: {
    prefix: 'qtn', write: ['erp', 'crm'], read: { erp: 'full', crm: 'full' },
    fields: {
      no: s('Quotation No'),
      date: d('Quotation Date'),
      validUntil: d('Valid Until'),
      companyName: s('Company Name'),
      contactPerson: s('Contact Person'),
      email: s('Email'),
      phone: s('Phone'),
      address: s('Address'),
      gstin: s('GSTIN'),
      projectName: s('Project Name'),
      projectCategory: s('Project Category'),
      projectDesc: s('Project Description', 1000),
      scopeOfWork: s('Scope of Work', 1500),
      basicCost: n('Basic Cost'),
      gstRate: n('GST Rate %'),
      gstAmount: n('GST Amount'),
      totalAmount: n('Total Amount'),
      minDays: n('Min Days'),
      maxDays: n('Max Days'),
      estimatedDelivery: s('Estimated Delivery'),
      advancePct: n('Advance %'),
      milestonePct: n('Milestone %'),
      finalPct: n('Final %'),
      signatoryName: s('Signatory Name'),
      signatoryRole: s('Signatory Role'),
      signDate: d('Sign Date')
    }
  },
  proformas: {
    prefix: 'pi', write: ['erp', 'crm', 'finance'], read: { erp: 'full', crm: 'full', finance: 'full' },
    fields: {
      no: s('PI Number'),
      date: d('PI Date'),
      validUntil: d('Valid Until'),
      paymentType: s('Payment Type'),
      companyName: s('Client Company Name'),
      contactPerson: s('Contact Person'),
      email: s('Client Email'),
      phone: s('Client Phone'),
      address: s('Billing Address'),
      gstin: s('Client GSTIN'),
      projectName: s('Project Name'),
      projectId: s('Project ID'),
      projectCategory: s('Project Category'),
      projectDesc: s('Project Description', 1000),
      expectedDelivery: s('Expected Delivery'),
      basicCost: n('Basic Project Cost'),
      gstRate: n('GST Rate %'),
      gstAmount: n('GST Amount'),
      totalAmount: n('Total Project Value'),
      advancePct: n('Advance Percentage %'),
      advanceAmount: n('Advance Amount'),
      remainingAmount: n('Remaining Amount'),
      accountHolder: s('Account Holder Name'),
      bankName: s('Bank Name'),
      accountNo: s('Account Number'),
      ifsc: s('IFSC Code'),
      branch: s('Branch'),
      upiId: s('UPI ID'),
      signatoryName: s('Signatory Name'),
      signatoryRole: s('Signatory Role'),
      signDate: d('Sign Date')
    }
  },
  proformas: {
    prefix: 'pi', write: ['erp', 'crm', 'finance'], read: { erp: 'full', crm: 'full', finance: 'full' },
    fields: {
      no: s('PI Number'),
      date: d('PI Date'),
      validUntil: d('Valid Until'),
      paymentType: s('Payment Type'),
      companyName: s('Client Company Name'),
      contactPerson: s('Contact Person'),
      email: s('Client Email'),
      phone: s('Client Phone'),
      address: s('Billing Address'),
      gstin: s('Client GSTIN'),
      projectName: s('Project Name'),
      projectId: s('Project ID'),
      projectCategory: s('Project Category'),
      projectDesc: s('Project Description', 1000),
      expectedDelivery: s('Expected Delivery'),
      basicCost: n('Basic Project Cost'),
      gstRate: n('GST Rate %'),
      gstAmount: n('GST Amount'),
      totalAmount: n('Total Project Value'),
      advancePct: n('Advance Percentage %'),
      advanceAmount: n('Advance Amount'),
      remainingAmount: n('Remaining Amount'),
      accountHolder: s('Account Holder Name'),
      bankName: s('Bank Name'),
      accountNo: s('Account Number'),
      ifsc: s('IFSC Code'),
      branch: s('Branch'),
      upiId: s('UPI ID'),
      signatoryName: s('Signatory Name'),
      signatoryRole: s('Signatory Role'),
      signDate: d('Sign Date')
    }
  },
  quotations: {
    prefix: 'qtn', write: ['erp', 'crm'], read: { erp: 'full', crm: 'full' },
    fields: {
      no: s('Quotation No'),
      date: d('Quotation Date'),
      validUntil: d('Valid Until'),
      companyName: s('Company Name'),
      contactPerson: s('Contact Person'),
      email: s('Email'),
      phone: s('Phone'),
      address: s('Address'),
      gstin: s('GSTIN'),
      projectName: s('Project Name'),
      projectCategory: s('Project Category'),
      projectDesc: s('Project Description', 1000),
      scopeOfWork: s('Scope of Work', 1500),
      basicCost: n('Basic Cost'),
      gstRate: n('GST Rate %'),
      gstAmount: n('GST Amount'),
      totalAmount: n('Total Amount'),
      minDays: n('Min Days'),
      maxDays: n('Max Days'),
      estimatedDelivery: s('Estimated Delivery'),
      advancePct: n('Advance %'),
      milestonePct: n('Milestone %'),
      finalPct: n('Final %'),
      signatoryName: s('Signatory Name'),
      signatoryRole: s('Signatory Role'),
      signDate: d('Sign Date')
    }
  },
  invoices: {
    prefix: 'i', write: ['erp'], read: { erp: 'full', finance: 'full', crm: 'full' }, noUpdate: true,
    fields: {
      date: d('Invoice date', REQ),
      customerId: r('Customer', 'customers', REQ),
      salesId: r('Sold by', 'employees'),
      challanNo: s('Challan No.', 40),
      buyerPo: s('Buyer PO / Order No.', 60),
      poDate: d('PO Date'),
      dispatchThrough: s('Dispatched through', 80),
      vehicleNo: s('Vehicle / Transport No.', 40),
      paymentTerms: s('Terms of Payment', 120)
    },
    /* Items and totals are built here, never taken from the browser. */
    create: (doc, ctx) => {
      const raw = ctx.body.items;
      if (!Array.isArray(raw) || !raw.length) throw new HttpError(400, 'Add at least one item to the invoice.');
      if (raw.length > 100) throw new HttpError(400, 'An invoice can have at most 100 items.');
      doc.items = raw.map(it => {
        const p = ctx.db.products.find(x => x.id === String(it && it.productId));
        if (!p) throw new HttpError(400, 'One of the items no longer exists. Reload the page and choose again.');
        const q = Number(it.qty), rate = Number(it.rate), gst = Number(it.gst);
        if (!(q > 0) || q > 1e9) throw new HttpError(400, `Quantity for ${p.name} must be more than zero.`);
        if (!(rate >= 0) || rate > 1e10) throw new HttpError(400, `Rate for ${p.name} is not valid.`);
        if (!(gst >= 0 && gst <= 40)) throw new HttpError(400, `GST % for ${p.name} must be between 0 and 40.`);
        return { productId: p.id, name: p.name, hsn: p.sku || '998719', qty: q, unit: p.unit || 'NOS', rate, gst };
      });
      const sub = doc.items.reduce((a, it) => a + it.qty * it.rate, 0), tax = doc.items.reduce((a, it) => a + it.qty * it.rate * it.gst / 100, 0);
      doc.subtotal = round2(sub);
      doc.tax = round2(tax);
      doc.total = Math.round(sub + tax);
      doc.no = nextNo(ctx.db.invoices, 'no', 'INV-', 4);

      // Support 50% or custom Advance Payment entry at creation
      const adv = Number(ctx.body.paid || ctx.body.advanceAmount || 0);
      if (adv > 0) {
        const paidAmt = Math.min(doc.total, round2(adv));
        doc.paid = paidAmt;
        doc.payments = [{
          date: doc.date || today(),
          amount: paidAmt,
          mode: String(ctx.body.paymentMode || 'Bank Transfer (NEFT/RTGS)'),
          ref: String(ctx.body.paymentRef || 'ADVANCE-50'),
          note: String(ctx.body.paymentNote || '50% Advance Payment Received'),
          by: ctx.user ? ctx.user.id : 'system'
        }];
      } else {
        doc.paid = 0;
        doc.payments = [];
      }
      doc.paymentTerms = String(ctx.body.paymentTerms || (doc.paid > 0 ? '50% Advance Received, Balance on Delivery' : '100% on Delivery'));
      doc.challanNo = String(ctx.body.challanNo || doc.no.replace('INV-', 'CHL-'));
      doc.buyerPo = String(ctx.body.buyerPo || '');
      doc.poDate = String(ctx.body.poDate || '');
      doc.dispatchThrough = String(ctx.body.dispatchThrough || 'Hand Delivery / Transport');
      doc.vehicleNo = String(ctx.body.vehicleNo || '');
    }
  },
  purchases: {
    prefix: 'o', write: ['erp'], read: { erp: 'full', finance: 'full' },
    fields: {
      vendor: s('Vendor', 120, REQ), date: d('Order date', REQ), productId: r('Product', 'products', REQ),
      qty: n('Quantity', 0, 1e9, { positive: true, req: true }), cost: n('Rate per unit'), status: e('Status', ['Ordered', 'Received'], { def: 'Ordered' })
    },
    create: (doc, ctx) => {
      doc.no = nextNo(ctx.db.purchases, 'no', 'PO-', 4);
      if (!doc.cost) doc.cost = (ctx.db.products.find(p => p.id === doc.productId) || {}).cost || 0;
    },
    check: (doc, ctx) => { if (doc.status === 'Received' && !doc.receivedOn) doc.receivedOn = today(); if (doc.status !== 'Received') delete doc.receivedOn; }
  },
  /* Stock sent out without an invoice: material to a project or site, or daily-use items handed to staff. */
  issues: {
    prefix: 's', write: ['erp'], read: { erp: 'full', projects: 'full' },
    fields: {
      date: d('Date', REQ), productId: r('Item', 'products', REQ), qty: n('Quantity', 0, 1e9, { positive: true, req: true }),
      kind: e('Type', ['site', 'daily'], { def: 'site' }), projectId: r('Project', 'projects'), destination: s('Sent to', 160),
      takenById: r('Taken by', 'employees'), via: s('Sent by', 120), note: s('Note', 300), returnedQty: n('Returned quantity')
    },
    create: (doc, ctx) => { doc.no = nextNo(ctx.db.issues, 'no', 'ISS-', 4); doc.returnedQty = 0; },
    check: (doc, ctx) => {
      const p = ctx.db.products.find(x => x.id === doc.productId);
      doc.productName = p ? p.name : doc.productName || '';
      doc.unit = p ? p.unit || 'pcs' : doc.unit || 'pcs';
      if (doc.kind === 'daily' && !doc.takenById) throw new HttpError(400, 'Choose the employee who is taking this item.');
      if (doc.kind === 'site' && !doc.projectId && !doc.destination) throw new HttpError(400, 'Say where the material is going: choose a project or type the place.');
      if (doc.returnedQty > doc.qty) throw new HttpError(400, `Only ${doc.qty} went out, so at most ${doc.qty} can come back.`);
      if (doc.returnedQty > 0 && !doc.returnedOn) doc.returnedOn = today();
    }
  },
  employees: {
    prefix: 'e', write: ['hrms'], read: { hrms: 'full', finance: 'pay', erp: 'lite', crm: 'lite', projects: 'lite', employee: 'full' },
    views: { lite: ['id', 'code', 'name', 'dept', 'role', 'status'], pay: ['id', 'code', 'name', 'dept', 'role', 'status', 'joined', 'salary', 'expectedSalary'] },
    fields: {
      code: s('Employee code', 20), name: s('Full name', 120, REQ), dept: s('Department', 60), role: s('Designation', 80),
      phone: s('Phone', 30), email: s('Email', 120), joined: d('Date of joining', REQ), salary: n('Salary'), expectedSalary: n('Expected salary'), status: e('Status', ['Active', 'Registered', 'Left'], { def: 'Registered' }),
      dob: d('Date of birth'), bloodGroup: s('Blood group', 10), address: s('Current address', 300), permAddress: s('Permanent address', 300),
      idType: e('ID proof type', ID_TYPES, { def: '' }), idNumber: s('ID proof number', 40),
      emergencyName: s('Emergency contact name', 80), emergencyPhone: s('Emergency contact phone', 30),
      userLoginId: s('User login ID', 60), tempPassword: s('Temporary password', 60),
      shift: s('Shift schedule', 120),
      dailyOt: s('Daily OT record', 2000)
    },
    create: (doc, ctx) => { if (!doc.code) doc.code = nextNo(ctx.db.employees, 'code', 'EMP-', 3); doc.photoId = ''; },
    check: (doc, ctx) => { if (!doc.code) throw new HttpError(400, 'Employee code is required.'); unique(ctx.db, 'employees', 'code', doc, ctx.old, 'employee code'); }
  },
  leaves: {
    prefix: 'v', write: ['hrms', 'employee'], read: { hrms: 'full', finance: 'full', employee: 'full' },
    fields: {
      empId: r('Employee', 'employees', REQ), type: e('Leave type', LEAVE_TYPES, { def: 'Casual' }), from: d('From date', REQ), to: d('To date', REQ),
      reason: s('Reason', 200), status: e('Status', ['Pending', 'Approved', 'Rejected'], { def: 'Pending' })
    },
    check: (doc, ctx) => {
      if (doc.to < doc.from) throw new HttpError(400, 'The "To" date must be on or after the "From" date.');
      if ((parseISO(doc.to) - parseISO(doc.from)) / 864e5 > 90) throw new HttpError(400, 'A single request can cover at most 90 days.');
      doc.days = leaveDays(doc.from, doc.to);
      if (!doc.days) throw new HttpError(400, 'These dates fall on a Sunday, which is already the weekly off.');
      if (ctx.old && ctx.old.status !== doc.status) doc.decidedOn = today();
    }
  },
  worklogs: {
    prefix: 'w', write: ['hrms', 'projects', 'employee'], read: { hrms: 'full', projects: 'full', employee: 'full' },
    fields: {
      empId: r('Employee', 'employees', REQ), date: d('Date', REQ), projectId: r('Project', 'projects'),
      yesterdayWork: s("Yesterday's work", 1000, REQ), todayWork: s("Today's work", 1000, REQ), blockers: s('Blockers / Notes', 500)
    }
  },
  projects: {
    prefix: 'j', write: ['projects', 'hrms'], read: { projects: 'full', hrms: 'full', erp: 'lite', employee: 'full' },
    views: { lite: ['id', 'name', 'location', 'status'] },
    fields: {
      code: s('Project code', 30), name: s('Project name', 140, REQ), customerId: r('Client', 'customers'), client: s('Client name', 120), location: s('Location / Site', 160),
      status: e('Status', PROJECT_STATUS, { def: 'Planned' }), start: d('Start date'), end: d('Target end date / Deadline'),
      deliveredOn: d('Delivered date'), deliveredBy: s('Delivered by', 120),
      leadId: r('Project lead / Manager', 'employees'), memberIds: { t: 'refs', label: 'Team members', col: 'employees' },
      progress: n('Progress %', 0, 100), budget: n('Budget / Deal value'), note: s('Notes', 600)
    },
    check: doc => { if (doc.start && doc.end && doc.end < doc.start) throw new HttpError(400, 'The target end date must be on or after the start date.'); }
  },
  tasks: {
    prefix: 'k', write: ['projects', 'hrms', 'employee'], read: { projects: 'full', hrms: 'full', employee: 'full' },
    fields: {
      title: s('Task title', 160, REQ), projectId: r('Project', 'projects'), empId: r('Assigned to', 'employees', REQ),
      dept: s('Department', 60), assignedBy: s('Assigned by', 120), dueDate: d('Deadline / Due date', REQ),
      priority: e('Priority', ['High', 'Medium', 'Low'], { def: 'Medium' }),
      status: e('Status', ['To Do', 'In Progress', 'Completed', 'Delayed'], { def: 'To Do' }),
      desc: s('Task description / instructions', 1000), completedOn: d('Completed on')
    },
    check: (doc, ctx) => {
      if (!doc.dept && doc.empId) {
        const e = ctx.db.employees.find(x => x.id === doc.empId);
        if (e && e.dept) doc.dept = e.dept;
      }
      if (doc.status === 'Completed' && !doc.completedOn) doc.completedOn = today();
      if (doc.status !== 'Completed') delete doc.completedOn;
    }
  },
  expenses: {
    prefix: 'x', write: ['finance'], read: { finance: 'full' },
    fields: {
      date: d('Date', REQ), category: e('Category', EXPENSE_CATS, { def: 'Other' }), amount: n('Amount', 0, 1e11, { positive: true, req: true }),
      paidTo: s('Paid to', 120), note: s('Note', 300)
    }
  }
};
const DATA_COLS = Object.keys(COLLECTIONS);

const isOwner = user => user.role === 'owner';
const hasModule = (user, mod) => isOwner(user) || user.modules.includes(mod);
const canWrite = (user, spec) => isOwner(user) || spec.write.some(m => user.modules.includes(m));
/* The widest view of a collection this user may read: 'full', a named view, or null. */
function viewFor(user, spec) {
  if (isOwner(user)) return 'full';
  const views = user.modules.map(m => spec.read[m]).filter(Boolean);
  if (!views.length) return null;
  if (views.includes('full')) return 'full';
  return views.sort((a, b) => spec.views[b].length - spec.views[a].length)[0];
}
function shape(spec, view, doc) {
  if (view === 'full') return doc;
  const out = {};
  for (const k of spec.views[view]) if (doc[k] !== undefined) out[k] = doc[k];
  return out;
}

module.exports = { HttpError, MODULES, FILE_KINDS, COLLECTIONS, DATA_COLS, clean, isOwner, hasModule, canWrite, viewFor, shape, today, parseISO, isoOf, nextNo, round2 };
