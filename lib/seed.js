'use strict';
/* Example records, dated relative to today, so a new install opens with something to look at.
   Every record is flagged sample:true and can be removed in one click by the owner. */
const { isoOf, parseISO, round2 } = require('./schema');

function seed(db) {
  const now = new Date();
  const day = off => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off); return isoOf(d); };
  /* A working day: Sundays move one day later. */
  const work = off => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off); if (d.getDay() === 0) d.setDate(d.getDate() + 1); return isoOf(d); };
  const add = (col, doc) => { db[col].push(Object.assign(doc, { sample: true, createdAt: Date.now() })); return doc; };

  /* ---- products ---- */
  const P = [
    ['p01', 'LED-9W', 'LED Bulb 9W', 'Lighting', 'pcs', 600, 150, 58, 89],
    ['p02', 'LED-BAT20', 'LED Batten 20W', 'Lighting', 'pcs', 120, 40, 185, 265],
    ['p03', 'FAN-1200', 'Ceiling Fan 1200 mm', 'Fans', 'pcs', 60, 15, 1350, 1790],
    ['p04', 'WIRE-1.5', 'Copper Wire 1.5 sq mm, 90 m coil', 'Wires', 'coil', 80, 20, 1180, 1460],
    ['p05', 'WIRE-2.5', 'Copper Wire 2.5 sq mm, 90 m coil', 'Wires', 'coil', 50, 15, 1890, 2320],
    ['p06', 'SW-6A', 'Modular Switch 6A', 'Switches', 'pcs', 900, 150, 28, 46],
    ['p07', 'SOC-16A', 'Modular Socket 16A', 'Switches', 'pcs', 400, 100, 74, 118],
    ['p08', 'MCB-32DP', 'MCB 32A Double Pole', 'Protection', 'pcs', 150, 40, 310, 445],
    ['p09', 'DB-8WAY', 'Distribution Board 8 Way', 'Protection', 'pcs', 30, 10, 920, 1280],
    ['p10', 'PVC-25', 'PVC Conduit Pipe 25 mm, 3 m', 'Conduits', 'pcs', 600, 120, 42, 64],
    ['p11', 'TL-DRILL', 'Drill Machine 13 mm', 'Tools', 'pcs', 6, 1, 2400, 3100],
    ['p12', 'TL-METER', 'Digital Multimeter', 'Tools', 'pcs', 8, 2, 650, 900],
    ['p13', 'TL-HELMET', 'Safety Helmet', 'Tools', 'pcs', 20, 5, 180, 260]
  ];
  const prod = {};
  for (const [id, sku, name, category, unit, opening, reorder, cost, price] of P) prod[id] = add('products', { id, sku, name, category, unit, opening, reorder, cost, price, gst: 18 });

  /* ---- customers ---- */
  [['c01', 'Suresh Gupta', 'Gupta Electric Store', 'Jaipur'], ['c02', 'Meena Agarwal', 'Agarwal Hardware', 'Indore'], ['c03', 'Faisal Khan', 'Khan Lighting House', 'Lucknow'],
   ['c04', 'Ramesh Patel', 'Patel Builders', 'Ahmedabad'], ['c05', 'Lakshmi Iyer', 'Iyer Interiors', 'Pune'], ['c06', 'Vikram Chauhan', 'Chauhan Constructions', 'Jaipur'],
   ['c07', 'Nisha Bansal', 'Bansal Home Decor', 'Delhi'], ['c08', "Joseph D'Souza", "D'Souza Electricals", 'Mumbai']
  ].forEach(([id, name, company, city], i) => add('customers', { id, name, company, phone: '99999 0000' + (i + 1), email: '', city, gstin: '', address: '', fromLead: '' }));

  /* ---- employees ---- */
  const E = [
    ['e01', 'Rajesh Verma', 'Sales', 'Sales Manager', '2021-04-12', 58000, 'Jaipur'],
    ['e02', 'Priya Nair', 'Sales', 'Sales Executive', '2023-07-03', 32000, 'Kochi'],
    ['e03', 'Imran Sheikh', 'Projects', 'Site Supervisor', '2024-01-15', 30000, 'Bhopal'],
    ['e04', 'Sunita Yadav', 'Accounts', 'Accountant', '2022-09-01', 38000, 'Lucknow'],
    ['e05', 'Manoj Kumar', 'Warehouse', 'Store Incharge', '2020-11-20', 27000, 'Patna'],
    ['e06', 'Deepak Rawat', 'Projects', 'Electrician', '2024-06-10', 16000, 'Dehradun'],
    ['e07', 'Anjali Deshmukh', 'HR', 'HR Executive', '2023-02-06', 34000, 'Nagpur'],
    ['e08', 'Harpreet Singh', 'Admin', 'Office Admin', '2022-03-14', 26000, 'Ludhiana']
  ];
  E.forEach(([id, name, dept, role, joined, salary, town], i) => add('employees', {
    id, code: 'EMP-00' + (i + 1), name, dept, role, phone: '99999 0010' + (i + 1), email: '', joined, salary, status: 'Active', dob: '',
    address: `Flat ${12 + i}, Sample Residency, Jaipur`, permAddress: `House ${40 + i}, Main Road, ${town}`, idType: '', idNumber: '',
    emergencyName: '', emergencyPhone: '', photoId: ''
  }));

  /* ---- sales invoices ---- */
  const I = [
    [158, 'c01', 'e02', [['p01', 200], ['p06', 300]], 'full'], [144, 'c04', 'e01', [['p04', 20], ['p08', 40]], 'full'],
    [126, 'c02', 'e02', [['p10', 150], ['p07', 100]], 'full'], [109, 'c06', 'e01', [['p03', 15], ['p05', 12]], 'full'],
    [91, 'c03', 'e02', [['p02', 40], ['p01', 150]], 'full'], [76, 'c05', 'e01', [['p03', 10], ['p06', 200], ['p07', 80]], 'full'],
    [62, 'c04', 'e01', [['p05', 14], ['p09', 12], ['p08', 30]], 'full'], [44, 'c08', 'e02', [['p04', 18], ['p10', 120]], 20000],
    [35, 'c06', 'e01', [['p03', 13], ['p09', 10], ['p05', 12]], 0], [20, 'c07', 'e02', [['p02', 30], ['p01', 120], ['p06', 150]], 'full'],
    [9, 'c01', 'e02', [['p03', 10], ['p08', 25], ['p07', 60]], 15000], [2, 'c04', 'e01', [['p09', 8], ['p04', 15], ['p10', 100]], 0],
    [0, 'c05', 'e02', [['p01', 60], ['p07', 40]], 0]
  ];
  I.forEach(([ago, customerId, salesId, lines, paid], i) => {
    const items = lines.map(([p, q]) => ({ productId: p, name: prod[p].name, qty: q, rate: prod[p].price, gst: 18 }));
    const sub = items.reduce((a, it) => a + it.qty * it.rate, 0), tax = round2(sub * 0.18), total = Math.round(sub + tax);
    const got = paid === 'full' ? total : paid;
    add('invoices', {
      id: 'i' + String(i + 1).padStart(2, '0'), no: 'INV-' + String(i + 1).padStart(4, '0'), date: day(-ago), customerId, salesId, items,
      subtotal: sub, tax, total, paid: got, payments: got ? [{ date: day(-Math.max(0, ago - (paid === 'full' ? 12 : 4))), amount: got }] : []
    });
  });

  /* ---- purchases ---- */
  [[102, 'Northline Cables', 'p04', 40, 'Received'], [58, 'Brightway Lighting Co', 'p01', 300, 'Received'], [26, 'Kaveri Switchgear', 'p08', 60, 'Received'],
   [5, 'Kaveri Switchgear', 'p09', 25, 'Ordered'], [3, 'Skyline Fans', 'p03', 30, 'Ordered']
  ].forEach(([ago, vendor, productId, qty, status], i) => add('purchases', Object.assign(
    { id: 'o0' + (i + 1), no: 'PO-000' + (i + 1), date: day(-ago), vendor, productId, qty, cost: prod[productId].cost, status },
    status === 'Received' ? { receivedOn: day(-ago + 4) } : {})));

  /* ---- leads ---- */
  [['Anita Rao', 'Rao Developers', 'Referral', 'Proposal', 480000, 'e01', -2, 'Quote sent for wiring material, three towers'],
   ['Karan Mehta', 'Mehta Hardware Mart', 'Walk-in', 'Qualified', 150000, 'e02', 2, 'Wants monthly supply of switches and sockets'],
   ['Sana Qureshi', 'Qureshi Interiors', 'Website', 'Contacted', 90000, 'e02', 0, 'Asked for lighting catalogue'],
   ['Bhavesh Shah', 'Shah Electricals', 'Phone call', 'New', 60000, 'e02', 3, ''],
   ['Ritu Malhotra', 'Malhotra Constructions', 'Exhibition', 'Proposal', 320000, 'e01', 5, 'Comparing our rates with one other supplier'],
   ['Thomas Mathew', 'Mathew and Sons', 'Referral', 'Qualified', 210000, 'e01', -4, 'Needs fans and MCBs for a school project'],
   ['Pooja Saxena', 'Saxena Home Solutions', 'Social media', 'New', 45000, 'e02', 4, ''],
   ['Gurpreet Kaur', 'Kaur Lighting Studio', 'Website', 'Won', 175000, 'e01', null, 'First order confirmed on phone'],
   ['Naveen Pillai', 'Pillai Projects', 'Exhibition', 'Lost', 260000, 'e02', null, 'Went with a cheaper supplier'],
   ['Farah Ali', 'Ali Electric Works', 'Phone call', 'Contacted', 70000, 'e02', 7, '']
  ].forEach(([name, company, source, stage, value, ownerId, follow, note], i) => add('leads', {
    id: 'l' + String(i + 1).padStart(2, '0'), name, company, phone: '99999 0020' + i, email: '', source, stage, value, ownerId,
    followUp: follow == null ? '' : day(follow), note, customerId: ''
  }));

  /* ---- projects ---- */
  [['j01', 'Shanti Residency wiring', 'c04', 'SG Highway site, Ahmedabad', 'Running', -40, 20, 'e03', ['e06', 'e05'], 60, 'Block A and B complete. Block C conduit work in progress.'],
   ['j02', 'Showroom lighting fit-out', 'c05', 'Baner, Pune', 'Running', -12, 10, 'e01', ['e06'], 35, 'Client wants warm white battens in the display area.'],
   ['j03', 'Site office electricals', 'c06', 'Ajmer Road, Jaipur', 'On hold', -25, 15, 'e03', ['e06'], 20, 'Waiting for the civil contractor to finish the slab.'],
   ['j04', 'Store rewiring', 'c07', 'Karol Bagh, Delhi', 'Planned', 6, 30, 'e01', ['e03'], 0, ''],
   ['j05', 'Godown lighting upgrade', 'c01', 'VKI Area, Jaipur', 'Completed', -90, -55, 'e03', ['e06', 'e05'], 100, 'Handed over. Final bill raised.']
  ].forEach(([id, name, customerId, location, status, s, e, leadId, memberIds, progress, note]) =>
    add('projects', { id, name, customerId, client: '', location, status, start: day(s), end: day(e), leadId, memberIds, progress, note }));

  /* ---- stock issues: material to sites, and daily-use items held by staff ---- */
  [[-30, 'p04', 20, 'site', 'j01', '', 'e03', 'Company tempo', 'For Block A and B', 0],
   [-30, 'p10', 50, 'site', 'j01', '', 'e03', 'Company tempo', '', 0],
   [-16, 'p06', 60, 'site', 'j01', '', 'e06', 'By hand', 'Switch plates for Block B', 0],
   [-9, 'p02', 12, 'site', 'j02', '', 'e06', 'Courier', 'Sent by road transport', 0],
   [-9, 'p01', 40, 'site', 'j02', '', 'e06', 'Courier', '', 0],
   [-6, 'p08', 10, 'site', '', 'Service call, Mansarovar, Jaipur', 'e06', 'Bike', 'Customer repair job', 4],
   [-45, 'p11', 1, 'daily', '', '', 'e06', 'By hand', '', 0],
   [-45, 'p13', 2, 'daily', '', '', 'e06', 'By hand', '', 0],
   [-38, 'p11', 1, 'daily', '', '', 'e03', 'By hand', '', 0],
   [-38, 'p12', 1, 'daily', '', '', 'e03', 'By hand', '', 0],
   [-20, 'p12', 1, 'daily', '', '', 'e05', 'By hand', 'For testing incoming stock', 0],
   [-20, 'p13', 2, 'daily', '', '', 'e05', 'By hand', '', 1]
  ].forEach(([ago, productId, qty, kind, projectId, destination, takenById, via, note, returnedQty], i) => add('issues', Object.assign(
    { id: 's' + String(i + 1).padStart(2, '0'), no: 'ISS-' + String(i + 1).padStart(4, '0'), date: day(ago), productId, productName: prod[productId].name, unit: prod[productId].unit,
      qty, kind, projectId, destination, takenById, via, note, returnedQty },
    returnedQty ? { returnedOn: day(ago + 3) } : {})));

  /* ---- leave ---- */
  const leave = (id, empId, type, a, b, reason, status) => {
    const from = work(a), to = b === a ? from : work(b);
    let days = 0; for (const d = parseISO(from), end = parseISO(to); d <= end; d.setDate(d.getDate() + 1)) if (d.getDay() !== 0) days++;
    return add('leaves', { id, empId, type, from, to: to < from ? from : to, days: Math.max(1, days), reason, status });
  };
  const sick = leave('v01', 'e03', 'Sick', -9, -8, 'Fever', 'Approved');
  const unpaid = leave('v02', 'e02', 'Unpaid', -5, -5, 'Personal work', 'Approved');
  leave('v03', 'e06', 'Casual', 4, 5, 'Family function', 'Pending');
  const earned = leave('v04', 'e08', 'Earned', -19, -17, 'Travel to home town', 'Approved');
  leave('v05', 'e05', 'Casual', 7, 7, 'Personal work', 'Rejected');

  /* ---- attendance: last month and this month up to yesterday ---- */
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const onLeave = (id, iso) => [sick, unpaid, earned].some(l => l.empId === id && l.from <= iso && iso <= l.to);
  let k = 0;
  for (const d = new Date(first); isoOf(d) < isoOf(now); d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0) continue;
    const iso = isoOf(d), marks = {};
    for (const [id] of E) {
      if (onLeave(id, iso)) continue;
      k++;
      marks[id] = k % 37 === 0 ? 'A' : k % 53 === 0 ? 'H' : 'P';
    }
    db.attendance[iso] = marks;
    db.sampleAttendance.push(iso);
  }

  /* ---- expenses ---- */
  [[-33, 'Rent', 45000, 'Shop and godown rent', 'Landlord'], [-3, 'Rent', 45000, 'Shop and godown rent', 'Landlord'], [-28, 'Electricity', 8200, 'Monthly bill', 'Electricity board'],
   [-21, 'Transport', 3400, 'Tempo hire to Ahmedabad site', 'Transporter'], [-14, 'Office', 1850, 'Stationery and printer ink', ''], [-8, 'Transport', 2100, 'Courier charges, Pune', 'Courier company'],
   [-6, 'Repairs', 2600, 'Godown shutter repair', ''], [-1, 'Office', 640, 'Tea and snacks', ''], [0, 'Transport', 950, 'Fuel for bike', '']
  ].forEach(([ago, category, amount, note, paidTo], i) => add('expenses', { id: 'x0' + (i + 1), date: day(ago), category, amount, note, paidTo }));
}

module.exports = { seed };
