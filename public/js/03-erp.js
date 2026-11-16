'use strict';
/* ================= ERP: inventory ================= */
V['erp-inventory'] = D => {
  const q = query('erp-inventory'), cat = S.ui.filter.cat || '';
  const cats = [...new Set(S.products.map(p => p.category).filter(Boolean))].sort();
  const rows = S.products.filter(p => matches(q, p.name, p.sku, p.category) && (!cat || p.category === cat)).sort(byName);
  const value = sum(S.products, p => Math.max(0, D.stock.get(p.id) || 0) * num(p.cost));
  const body = rows.map(p => {
    const s = D.stock.get(p.id) || 0, st = stockState(p, D);
    return `<tr><td class="mono nowrap">${esc(p.sku)}</td><td><b>${esc(p.name)}</b><span class="sub">${esc(p.category || 'Uncategorised')}</span></td><td class="num${s <= 0 ? ' due' : ''}">${qty(s)} <span class="muted">${esc(p.unit || 'pcs')}</span></td><td class="num">${qty(p.reorder)}</td><td>${stamp(st.label, st.tone)}</td><td class="num">${inr(p.cost)}</td><td class="num">${inr(p.price)}</td><td class="num">${inr(Math.max(0, s) * num(p.cost))}</td><td class="acts">${W('erp', `<button class="link-btn" data-action="product-edit" data-id="${esc(p.id)}">Edit</button> <button class="link-btn danger" data-action="product-del" data-id="${esc(p.id)}">Delete</button>`)}</td></tr>`;
  });
  return head('ERP', 'Inventory', `<b>${S.products.length}</b> products · stock worth <b>${inr(value)}</b> at cost · <b>${D.attn.low.length}</b> need reordering`,
      W('erp', '<button class="btn btn-primary" data-action="product-new">Add product</button>'))
    + `<div class="toolbar">${searchBox('erp-inventory', 'Search name, SKU or category')}${filterSel('cat', 'All categories', cats)}</div>`
    + (S.products.length === 0 ? empty('No products yet', 'Add what you buy and sell. Stock updates by itself when you record purchases and invoices.', W('erp', '<button class="btn btn-primary" data-action="product-new">Add product</button>'))
      : rows.length === 0 ? empty('Nothing matches', 'Try a different search or category.')
      : table(['SKU', 'Product', { n: 'On hand' }, { n: 'Reorder at' }, 'Status', { n: 'Cost' }, { n: 'Price' }, { n: 'Stock value' }, ''], body))
    + `<p class="note">On hand = opening stock + purchases marked received − quantity invoiced − stock sent out on issue and not yet returned.</p>`;
};
function productForm(p) {
  openForm({
    title: p ? 'Edit product' : 'Add product',
    fields: [
      { name: 'sku', label: 'SKU / item code', required: true },
      { name: 'name', label: 'Product name', required: true },
      { name: 'category', label: 'Category' },
      { name: 'unit', label: 'Unit', value: 'pcs', placeholder: 'pcs, box, kg' },
      { name: 'opening', label: 'Opening stock', type: 'number', min: 0, step: 'any', required: true, hint: 'Quantity you had before recording anything here.' },
      { name: 'reorder', label: 'Reorder level', type: 'number', min: 0, step: 'any', value: 0, hint: 'Flag as low at or below this.' },
      { name: 'cost', label: 'Cost price (₹)', type: 'number', min: 0, step: 'any', required: true },
      { name: 'price', label: 'Selling price (₹)', type: 'number', min: 0, step: 'any', required: true },
      { name: 'gst', label: 'GST %', type: 'number', min: 0, max: 40, step: 'any', value: 18 }
    ],
    values: p || {},
    onSubmit: v => {
      if (S.products.some(x => x.id !== (p && p.id) && String(x.sku).toLowerCase() === v.sku.toLowerCase())) throw new UserError('Another product already uses this SKU.');
      return p ? dbUpdate('products', p.id, v).then(() => toast('Product updated'))
        : dbAdd('products', Object.assign(v, { createdAt: Date.now() })).then(() => toast('Product added'));
    }
  });
}
ACT['product-new'] = () => productForm(null);
ACT['product-edit'] = el => productForm(S.products.find(p => p.id === el.dataset.id));
ACT['product-del'] = async el => {
  const p = S.products.find(x => x.id === el.dataset.id); if (!p) return;
  const used = S.invoices.filter(i => (i.items || []).some(it => it.productId === p.id)).length + S.purchases.filter(x => x.productId === p.id).length;
  if (used) return toast(`${p.name} is used in ${plural(used, 'invoice or purchase', 'invoices and purchases')}. Delete those first.`, 'bad');
  if (await confirmBox('Delete product?', `${p.name} (${p.sku}) will be removed from inventory.`)) save(() => dbDelete('products', p.id), 'Product deleted');
};

/* ================= ERP: sales invoices, quotations & proforma invoices ================= */
V['erp-sales'] = D => {
  const q = query('erp-sales'), f = S.ui.filter.inv || '';
  const m = today().slice(0, 7);
  const curTab = S.ui.erpSalesTab || 'invoices';
  const qtnCount = (S.quotations || []).length;
  const piCount = (S.proformas || []).length;
  const invCount = S.invoices.length;

  const tabBar = `
    <div style="display:flex;gap:8px;margin-bottom:14px;border-bottom:1px solid #1e293b;padding-bottom:10px">
      <button class="btn ${curTab === 'invoices' ? 'btn-primary' : ''}" data-action="erp-sales-tab" data-tab="invoices" style="font-weight:700">🧾 Sales Invoices (${invCount})</button>
      <button class="btn ${curTab === 'quotations' ? 'btn-primary' : ''}" data-action="erp-sales-tab" data-tab="quotations" style="font-weight:700">📄 Project Quotations (${qtnCount})</button>
      <button class="btn ${curTab === 'proformas' ? 'btn-primary' : ''}" data-action="erp-sales-tab" data-tab="proformas" style="font-weight:700">📋 Proforma Invoices (PI) (${piCount})</button>
    </div>
  `;

  if (curTab === 'proformas') {
    const pRows = (S.proformas || []).filter(pi => matches(q, pi.no, pi.companyName, pi.contactPerson, pi.projectName, pi.projectCategory, pi.paymentType))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.no || '').localeCompare(String(a.no || '')));
    const body = pRows.map(pi => {
      const isFull = String(pi.paymentType || '').toLowerCase().includes('full');
      const payable = isFull ? (pi.totalAmount || 0) : (pi.advanceAmount || Math.round((pi.totalAmount || 0) * 0.5));
      return `<tr>
        <td class="mono nowrap"><button class="link-btn" data-action="proj-pi-view" data-id="${esc(pi.id)}"><b>${esc(pi.no || 'RVM/PI')}</b></button></td>
        <td class="nowrap">${fmtDate(pi.date)}<div class="sub">Valid: ${fmtDate(pi.validUntil)}</div></td>
        <td><b>${esc(pi.companyName || pi.contactPerson || '—')}</b><div class="sub">${esc(pi.contactPerson ? pi.contactPerson + ' · ' : '')}${esc(pi.phone || pi.email || '')}</div></td>
        <td><b>${esc(pi.projectName || '—')}</b><div class="sub">${esc(pi.projectCategory || 'Software / Hardware / Industrial Automation')}</div></td>
        <td><span class="stamp ${isFull ? 'stamp-good' : 'stamp-warn'}">${isFull ? 'Full Payment' : 'Advance Payment'}</span><div class="sub">${isFull ? '100% Full' : `${pi.advancePct || 50}% Advance`}</div></td>
        <td class="num">${inr(pi.totalAmount || 0)}</td>
        <td class="num" style="font-weight:800;color:#0284c7">${inr(payable)}</td>
        <td class="acts" style="white-space:nowrap">
          <button class="link-btn" data-action="proj-pi-view" data-id="${esc(pi.id)}">👁️ View</button>
          <a href="/api/pdf/proforma/${esc(pi.id)}" target="_blank" download="Proforma_${esc((pi.no || pi.id).replace(/[^a-zA-Z0-9_-]/g, ''))}.pdf" class="link-btn" style="color:#0284c7;font-weight:700">📥 PDF</a>
          <button class="link-btn" data-action="proj-pi-edit" data-id="${esc(pi.id)}">✏️ Edit</button>
          ${W('erp', `<button class="link-btn danger" data-action="proj-pi-del" data-id="${esc(pi.id)}">Delete</button>`)}
        </td>
      </tr>`;
    });
    const foot = `<tr><td colspan="5">${plural(pRows.length, 'proforma invoice')}</td><td class="num">${inr(sum(pRows, x => x.totalAmount || 0))}</td><td class="num" style="font-weight:800;color:#0284c7">${inr(sum(pRows, x => String(x.paymentType || '').toLowerCase().includes('full') ? (x.totalAmount || 0) : (x.advanceAmount || 0)))}</td><td></td></tr>`;
    return head('ERP', 'Proforma Invoices (PI)', `Total PI Count: <b>${piCount}</b> · Total PI Value: <b>${inr(sum(S.proformas || [], x => x.totalAmount || 0))}</b>`,
        W('erp', '<button class="btn btn-primary" data-action="proj-pi-new">📋 + New Proforma (PI)</button> <button class="btn" data-action="proj-quote-new" style="margin-left:8px">📄 + New Quotation</button> <button class="btn" data-action="inv-new" style="margin-left:8px">New invoice</button>'))
      + tabBar
      + `<div class="toolbar">${searchBox('erp-sales', 'Search PI no., client, or project')}</div>`
      + ((S.proformas || []).length === 0 ? empty('No proforma invoices yet', 'Create an official 8-Section RvmAiTech Proforma Invoice with Advance / Full Payment selection and PDF export.', W('erp', '<button class="btn btn-primary" data-action="proj-pi-new">📋 + Create First PI</button>'))
        : pRows.length === 0 ? empty('Nothing matches', 'Try a different search query.')
        : table(['PI Number', 'Date', 'Client', 'Project Details', 'Payment Type', { n: 'Total Value' }, { n: 'Payable Amount' }, 'Actions'], body, foot))
      + `<p class="note">Official RvmAiTech Proforma Invoice (PI) Format (Software | Hardware | Industrial Automation). Supports Advance PI &amp; Full PI with live % split and downloadable PDF.</p>`;
  }

  if (curTab === 'quotations') {
    const qRows = (S.quotations || []).filter(qtn => matches(q, qtn.no, qtn.companyName, qtn.contactPerson, qtn.projectName, qtn.projectCategory))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.no || '').localeCompare(String(a.no || '')));
    const body = qRows.map(qtn => {
      return `<tr>
        <td class="mono nowrap"><button class="link-btn" data-action="proj-quote-view" data-id="${esc(qtn.id)}"><b>${esc(qtn.no || 'RVM/QTN')}</b></button></td>
        <td class="nowrap">${fmtDate(qtn.date)}<div class="sub">Valid: ${fmtDate(qtn.validUntil)}</div></td>
        <td><b>${esc(qtn.companyName || qtn.contactPerson || '—')}</b><div class="sub">${esc(qtn.contactPerson ? qtn.contactPerson + ' · ' : '')}${esc(qtn.phone || qtn.email || '')}</div></td>
        <td><b>${esc(qtn.projectName || '—')}</b><div class="sub">${esc(qtn.projectCategory || 'Software / Hardware / Industrial Automation')}</div></td>
        <td class="num">${inr(qtn.basicCost || 0)}</td>
        <td class="num">${inr(qtn.gstAmount || 0)}</td>
        <td class="num" style="font-weight:800;color:#38bdf8">${inr(qtn.totalAmount || 0)}</td>
        <td class="acts" style="white-space:nowrap">
          <button class="link-btn" data-action="proj-quote-view" data-id="${esc(qtn.id)}">👁️ View</button>
          <a href="/api/pdf/quotation/${esc(qtn.id)}" target="_blank" download="Quotation_${esc((qtn.no || qtn.id).replace(/[^a-zA-Z0-9_-]/g, ''))}.pdf" class="link-btn" style="color:#0284c7;font-weight:700">📥 PDF</a>
          <button class="link-btn" data-action="proj-quote-edit" data-id="${esc(qtn.id)}">✏️ Edit</button>
          ${W('erp', `<button class="link-btn danger" data-action="proj-quote-del" data-id="${esc(qtn.id)}">Delete</button>`)}
        </td>
      </tr>`;
    });
    const foot = `<tr><td colspan="4">${plural(qRows.length, 'quotation')}</td><td class="num">${inr(sum(qRows, x => x.basicCost || 0))}</td><td class="num">${inr(sum(qRows, x => x.gstAmount || 0))}</td><td class="num" style="font-weight:800;color:#38bdf8">${inr(sum(qRows, x => x.totalAmount || 0))}</td><td></td></tr>`;
    return head('ERP', 'Project Quotations', `Total Project Quotations: <b>${qtnCount}</b> · Active Quotation Value: <b>${inr(sum(S.quotations || [], x => x.totalAmount || 0))}</b>`,
        W('erp', '<button class="btn btn-primary" data-action="proj-quote-new">📄 + New Project Quotation</button> <button class="btn" data-action="proj-pi-new" style="margin-left:8px;background:#0284c7;color:#fff;font-weight:700">📋 + New Proforma (PI)</button> <button class="btn" data-action="inv-new" style="margin-left:8px">New invoice</button>'))
      + tabBar
      + `<div class="toolbar">${searchBox('erp-sales', 'Search quotation no., client, or project')}</div>`
      + ((S.quotations || []).length === 0 ? empty('No project quotations yet', 'Click below to create an official 8-Section RvmAiTech Project Quotation with PDF export.', W('erp', '<button class="btn btn-primary" data-action="proj-quote-new">📄 + Create New Quotation</button>'))
        : qRows.length === 0 ? empty('Nothing matches', 'Try a different search query.')
        : table(['Quotation No', 'Date', 'Client', 'Project Details', { n: 'Basic Cost' }, { n: 'GST (18%)' }, { n: 'Grand Total' }, 'Actions'], body, foot))
      + `<p class="note">Official RvmAiTech Project Quotation Format (Software | Hardware | Industrial Automation). Includes 8-section commercial scope, delivery timeline, payment terms, and downloadable PDF.</p>`;
  }

  const rows = S.invoices.filter(i => matches(q, i.no, custLabel(D.cust.get(i.customerId)), (D.cust.get(i.customerId) || {}).name) && (!f || invStatus(i) === f))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.no).localeCompare(String(a.no)));
  const body = rows.map(i => {
    const st = invStatus(i), bal = balanceOf(i), items = i.items || [];
    const first = items[0] ? `${items[0].name} × ${qty(items[0].qty)}` : '—';
    return `<tr><td class="mono nowrap"><button class="link-btn" data-action="inv-view" data-id="${esc(i.id)}">${esc(i.no)}</button></td><td class="nowrap">${fmtDate(i.date)}</td><td><b>${esc(custLabel(D.cust.get(i.customerId)))}</b><span class="sub">${esc(first)}${items.length > 1 ? ` + ${items.length - 1} more` : ''}</span></td><td class="num">${inr(i.total)}</td><td class="num">${inr(i.paid)}</td><td class="num${st === 'Overdue' ? ' due' : ''}">${bal ? inr(bal) : '—'}</td><td>${stamp(st, INV_TONE[st])}${st === 'Overdue' ? `<span class="sub">${plural(dayDiff(dueDate(i), today()), 'day')} late</span>` : ''}</td><td class="acts">${W('erp', `${bal ? `<button class="link-btn" data-action="inv-pay" data-id="${esc(i.id)}">Record payment</button> ` : ''}<button class="link-btn danger" data-action="inv-del" data-id="${esc(i.id)}">Delete</button>`)}</td></tr>`;
  });
  const foot = `<tr><td colspan="3">${plural(rows.length, 'invoice')}</td><td class="num">${inr(sum(rows, i => i.total))}</td><td class="num">${inr(sum(rows, i => i.paid))}</td><td class="num">${inr(sum(rows, balanceOf))}</td><td colspan="2"></td></tr>`;
  return head('ERP', 'Sales invoices', `Billed in ${esc(MONTHS[+m.slice(5) - 1])}: <b>${inr(sum(S.invoices.filter(i => monthOf(i.date) === m), i => i.total))}</b> · to collect: <b>${inr(sum(S.invoices, balanceOf))}</b>`,
      W('erp', '<button class="btn btn-primary" data-action="inv-new">New invoice</button> <button class="btn" data-action="proj-quote-new" style="margin-left:8px;background:#0d2649;color:#38bdf8;border-color:#38bdf8;font-weight:700">📄 + New Project Quotation</button> <button class="btn" data-action="proj-pi-new" style="margin-left:8px;background:#0284c7;color:#fff;font-weight:700">📋 + New Proforma (PI)</button>'))
    + tabBar
    + `<div class="toolbar">${searchBox('erp-sales', 'Search invoice no. or customer')}${filterSel('inv', 'All statuses', ['Unpaid', 'Part paid', 'Overdue', 'Paid'])}</div>`
    + (S.invoices.length === 0 ? empty('No invoices yet', 'Create an invoice to bill a customer. Stock comes down and the amount shows under the customer.', W('erp', '<button class="btn btn-primary" data-action="inv-new">New invoice</button>'))
      : rows.length === 0 ? empty('Nothing matches', 'Try a different search or status.')
      : table(['Invoice', 'Date', 'Customer', { n: 'Total' }, { n: 'Received' }, { n: 'Balance' }, 'Status', ''], body, foot))
    + `<p class="note">Payment terms are 30 days from the invoice date. Totals include GST.</p>`;
};

/* Indian Rupee Number to Words Converter for Invoices & Challans */
function inrWords(n) {
  n = Math.round(Number(n) || 0);
  if (n === 0) return 'INR Zero Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function convert(num) {
    if (num < 20) return a[num];
    if (num < 100) return b[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + a[num % 10] : '');
    if (num < 1000) return a[Math.floor(num / 100)] + ' Hundred' + (num % 100 !== 0 ? ' and ' + convert(num % 100) : '');
    if (num < 100000) return convert(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 !== 0 ? ' ' + convert(num % 1000) : '');
    if (num < 10000000) return convert(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 !== 0 ? ' ' + convert(num % 100000) : '');
    return convert(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 !== 0 ? ' ' + convert(num % 10000000) : '');
  }
  return 'INR ' + convert(n) + ' Only';
}

function invoiceForm(customerId) {
  if (!S.customers.length) return toast('Add a customer first, under CRM › Customers.', 'warn');
  if (!S.products.length) return toast('Add a product first, under ERP › Inventory.', 'warn');
  const D = derive();
  const lines = [{ productId: '', qty: 1, rate: '', gst: 18 }];
  const no = nextNo('INV-', S.invoices, 'no', 4);
  const chlNo = no.replace('INV-', 'CHL-');
  const prodOpts = S.products.slice().sort(byName);
  dlg.className = 'dlg dlg-fullscreen';
  dlg.innerHTML = `<form class="form" id="dlgForm">
    <div class="form-head" style="display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
      <div>
        <h2 class="dlg-title" style="margin:0">New Sales Tax Invoice &amp; Delivery Challan</h2>
        <p class="dlg-sub" style="margin:3px 0 0">${esc(no)} · Challan: ${esc(chlNo)} · Stock auto-deducted</p>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <span class="stamp stamp-good">GST Tax Invoice Ready</span>
        <button type="button" class="btn btn-sm" data-x="cancel" aria-label="Close" style="padding:4px 12px;font-weight:700;font-size:15px;border-radius:8px">✕</button>
      </div>
    </div>

    <div class="form-scroll">
      <div class="fields" style="overflow:visible;padding:0">
        ${fieldHtml({ name: 'customerId', label: 'Billed Customer / Client', type: 'select', required: true, placeholder: 'Choose a customer', options: S.customers.slice().sort(byName).map(c => ({ value: c.id, label: c.company ? `${c.company} (${c.name})` : c.name })) }, customerId)}
        ${fieldHtml({ name: 'date', label: 'Invoice / Challan Date', type: 'date', required: true, max: today() }, today())}
        ${fieldHtml({ name: 'salesId', label: 'Sold by (Sales Executive)', type: 'select', placeholder: 'Not set', options: activeEmps().map(e => ({ value: e.id, label: `${e.name} (${e.dept || 'Staff'})` })) }, '')}
      </div>

      <!-- 50% Advance Payment & Dispatch Information Box -->
      <div style="background:var(--sheet);border:1.5px solid var(--rule);border-radius:9px;padding:14px 16px;margin:4px 0">
        <div style="font-weight:800;font-size:13.5px;color:var(--heading);margin-bottom:10px;display:flex;align-items:center;gap:8px">
          <span>💳 Payment Terms &amp; Advance Deposit Entry (e.g. 50% Advance)</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px">
          <div>
            <label class="lbl" style="font-size:12px;font-weight:700">Payment Terms</label>
            <select id="inv-terms-sel" class="input" style="font-size:12.5px;font-weight:600">
              <option value="50_advance" selected>🟢 50% Advance + 50% Balance on Delivery</option>
              <option value="100_advance">100% Full Advance Payment</option>
              <option value="custom_advance">Custom Advance Amount (₹)</option>
              <option value="zero_advance">100% Due on Delivery / Net 30 Days</option>
            </select>
          </div>
          <div>
            <label class="lbl" style="font-size:12px;font-weight:700">Advance Amount Received (₹)</label>
            <input type="number" id="inv-adv-amt" class="input" placeholder="Advance amount" step="any" style="font-weight:700;color:var(--good,#10b981)">
            <div id="inv-adv-hint" style="font-size:11px;color:var(--good,#10b981);font-weight:700;margin-top:2px">⚡ 50% Advance Auto-Calculated</div>
          </div>
          <div>
            <label class="lbl" style="font-size:12px;font-weight:700">Payment Mode</label>
            <select id="inv-pay-mode" class="input" style="font-size:12.5px">
              <option value="Bank Transfer (NEFT/RTGS)">Bank Transfer (NEFT/RTGS)</option>
              <option value="UPI / QR Code (7052050656)">UPI / QR Code (7052050656)</option>
              <option value="Cheque / Demand Draft">Cheque / Demand Draft</option>
              <option value="Cash Receipt">Cash Receipt</option>
            </select>
          </div>
          <div>
            <label class="lbl" style="font-size:12px;font-weight:700">Transaction / UTR / Cheque Ref</label>
            <input type="text" id="inv-pay-ref" class="input" placeholder="e.g. UTR-7052050656 / Cheque #">
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-top:12px;border-top:1px dashed var(--rule);padding-top:10px">
          <div>
            <label class="lbl" style="font-size:12px;font-weight:700">Buyer Order / PO No.</label>
            <input type="text" id="inv-buyer-po" class="input" placeholder="e.g. PO-2026-RVM892">
          </div>
          <div>
            <label class="lbl" style="font-size:12px;font-weight:700">Buyer PO Date</label>
            <input type="date" id="inv-po-date" class="input" value="${today()}">
          </div>
          <div>
            <label class="lbl" style="font-size:12px;font-weight:700">Dispatched Through</label>
            <input type="text" id="inv-dispatch-through" class="input" value="By Hand to Party / Vehicle" placeholder="Courier / By Hand">
          </div>
          <div>
            <label class="lbl" style="font-size:12px;font-weight:700">Motor Vehicle / LR No.</label>
            <input type="text" id="inv-vehicle-no" class="input" placeholder="e.g. RJ-14-EA-7005">
          </div>
        </div>
      </div>

      <!-- Items Section -->
      <div class="lines-head"><span>Item / Service</span><span>Qty</span><span>Rate ₹</span><span>GST %</span><span class="num">Amount</span><span></span></div>
      <div class="lines" id="lines"></div>
      <div><button type="button" class="btn btn-sm" id="addLine">+ Add Another Item / Service</button></div>
      <div class="totals" id="totals" style="margin-top:14px"></div>
      <div class="form-err" id="formErr" role="alert"></div>
    </div>

    <div class="dlg-actions">
      <button type="button" class="btn" data-x="cancel" style="padding:10px 24px;font-size:14px;font-weight:700">Cancel</button>
      <button type="submit" class="btn btn-primary" style="padding:10px 32px;font-size:14.5px;font-weight:800">💾 Save Invoice &amp; Record Advance</button>
    </div>
  </form>`;

  const form = $('#dlgForm', dlg), linesEl = $('#lines', dlg);
  const amount = ln => num(ln.qty) * num(ln.rate) * (1 + num(ln.gst) / 100);
  const warnText = ln => { if (!ln.productId) return ''; const have = D.stock.get(ln.productId) || 0; return num(ln.qty) > have ? `Only ${qty(Math.max(0, have))} in stock. You can still save.` : ''; };
  
  const totals = () => {
    const sub = sum(lines, l => l.productId ? num(l.qty) * num(l.rate) : 0);
    const tax = sum(lines, l => l.productId ? num(l.qty) * num(l.rate) * num(l.gst) / 100 : 0);
    const tot = Math.round(sub + tax);
    const termsSel = $('#inv-terms-sel', dlg);
    const terms = termsSel ? termsSel.value : '50_advance';
    const advInput = $('#inv-adv-amt', dlg);
    
    if (advInput && !advInput.dataset.userEdited) {
      if (terms === '50_advance') advInput.value = Math.round(tot * 0.5);
      else if (terms === '100_advance') advInput.value = tot;
      else if (terms === 'zero_advance') advInput.value = 0;
    }
    const curAdv = advInput ? num(advInput.value) : Math.round(tot * 0.5);
    const bal = Math.max(0, tot - curAdv);

    $('#totals', dlg).innerHTML = `
      <div><span>Total Taxable Subtotal</span><span>${inr(sub)}</span></div>
      <div><span>GST (18%)</span><span>${inr(tax)}</span></div>
      <div class="grand"><span>Total Invoice Amount</span><span>${inr(tot)}</span></div>
      <div style="color:var(--good,#10b981);font-weight:700"><span>🟢 Advance Payment Received</span><span>${inr(curAdv)}</span></div>
      <div style="color:${bal ? 'var(--warn,#f47b20)' : 'var(--good,#10b981)'};font-weight:700"><span>🔴 Balance Due on Delivery</span><span>${inr(bal)}</span></div>`;
    return { sub, tax, tot, curAdv, bal };
  };

  const draw = () => {
    linesEl.innerHTML = lines.map((ln, i) => `<div class="line" data-i="${i}">
      <select id="ln-p-${i}" data-f="productId" aria-label="Item ${i + 1}"><option value="">Choose an item or service</option>${prodOpts.map(p => `<option value="${esc(p.id)}"${p.id === ln.productId ? ' selected' : ''}>${esc(p.name)} (${qty(D.stock.get(p.id) || 0)} in stock)</option>`).join('')}</select>
      <input id="ln-q-${i}" data-f="qty" type="number" min="0" step="any" inputmode="decimal" value="${esc(ln.qty)}" aria-label="Quantity">
      <input id="ln-r-${i}" data-f="rate" type="number" min="0" step="any" inputmode="decimal" value="${esc(ln.rate)}" aria-label="Rate in rupees">
      <input id="ln-g-${i}" data-f="gst" type="number" min="0" max="40" step="any" inputmode="decimal" value="${esc(ln.gst)}" aria-label="GST percent">
      <output>${ln.productId ? inr(amount(ln)) : '—'}</output>
      <button type="button" class="icon-btn" data-rm="${i}" aria-label="Remove item ${i + 1}"${lines.length < 2 ? ' disabled' : ''}>✕</button>
      <div class="line-warn">${esc(warnText(ln))}</div></div>`).join('');
    totals();
  };

  $('#inv-terms-sel', dlg).addEventListener('change', () => {
    delete $('#inv-adv-amt', dlg).dataset.userEdited;
    totals();
  });
  $('#inv-adv-amt', dlg).addEventListener('input', () => {
    $('#inv-adv-amt', dlg).dataset.userEdited = '1';
    totals();
  });

  linesEl.addEventListener('change', ev => {
    const row = ev.target.closest('.line'); if (!row || ev.target.dataset.f !== 'productId') return;
    const ln = lines[+row.dataset.i], p = D.prod.get(ev.target.value);
    ln.productId = ev.target.value;
    if (p) { ln.rate = num(p.price); ln.gst = p.gst == null ? 18 : num(p.gst); }
    draw();
    const q = $('#ln-q-' + row.dataset.i, dlg); if (q) q.focus();
  });
  linesEl.addEventListener('input', ev => {
    const row = ev.target.closest('.line'), f = ev.target.dataset.f; if (!row || !f || f === 'productId') return;
    const ln = lines[+row.dataset.i]; ln[f] = ev.target.value;
    row.querySelector('output').textContent = ln.productId ? inr(amount(ln)) : '—';
    row.querySelector('.line-warn').textContent = warnText(ln);
    totals();
  });
  linesEl.addEventListener('click', ev => { const b = ev.target.closest('[data-rm]'); if (b && lines.length > 1) { lines.splice(+b.dataset.rm, 1); draw(); } });
  $('#addLine', dlg).addEventListener('click', () => { lines.push({ productId: '', qty: 1, rate: '', gst: 18 }); draw(); const s = $('#ln-p-' + (lines.length - 1), dlg); if (s) s.focus(); });
  
  form.addEventListener('submit', ev => {
    ev.preventDefault();
    runSubmit(form, async () => {
      const fd = new FormData(form);
      const items = lines.filter(l => l.productId).map(l => ({ productId: l.productId, name: (D.prod.get(l.productId) || {}).name || '', qty: num(l.qty), rate: num(l.rate), gst: num(l.gst) }));
      if (!items.length) throw new UserError('Add at least one item to the invoice.');
      if (items.some(it => it.qty <= 0)) throw new UserError('Every item needs a quantity above zero.');
      const t = totals();
      const termsSel = $('#inv-terms-sel', dlg);
      const termsLabel = termsSel.options[termsSel.selectedIndex].text;
      const advAmount = num($('#inv-adv-amt', dlg).value);
      const paymentMode = $('#inv-pay-mode', dlg).value;
      const paymentRef = $('#inv-pay-ref', dlg).value.trim();
      const buyerPo = $('#inv-buyer-po', dlg).value.trim();
      const poDate = $('#inv-po-date', dlg).value;
      const dispatchThrough = $('#inv-dispatch-through', dlg).value.trim();
      const vehicleNo = $('#inv-vehicle-no', dlg).value.trim();

      await dbAdd('invoices', {
        no,
        date: String(fd.get('date')),
        customerId: String(fd.get('customerId')),
        salesId: String(fd.get('salesId') || ''),
        items,
        subtotal: round2(t.sub),
        tax: round2(t.tax),
        total: Math.round(t.sub + t.tax),
        advanceAmount: advAmount,
        paid: advAmount,
        paymentMode,
        paymentRef: paymentRef || (advAmount > 0 ? 'ADVANCE-50' : ''),
        paymentNote: advAmount > 0 ? '50% Advance Payment Received' : '',
        paymentTerms: termsLabel,
        challanNo: chlNo,
        buyerPo,
        poDate,
        dispatchThrough,
        vehicleNo,
        createdAt: Date.now()
      });
      toast(`Invoice ${no} saved with ${advAmount > 0 ? inr(advAmount) + ' advance payment recorded!' : '0 advance'}`);
    });
  });
  draw();
  dlg.showModal();
}
ACT['inv-new'] = el => invoiceForm(el.dataset.customer || '');

/* ================= Universal B2B Commercial Documents Lifecycle Bar ================= */
function renderDocLifecycleNav(activeType, docId, inv, cust) {
  const i = inv || (docId ? S.invoices.find(x => x.id === docId) : null);
  const targetId = i ? i.id : (docId || '');
  return `
    <div class="doc-cycle-nav no-print">
      <span style="font-size:10.5px;font-weight:900;color:#38bdf8;text-transform:uppercase;letter-spacing:.05em;margin-right:2px">Commercial Flow:</span>
      <button type="button" class="cycle-pill ${activeType === 'quote' ? 'active' : ''}" data-action="nav-quote" data-id="${esc(targetId)}" title="1. Order मिलने से पहले">1. 📄 Quotation (कोटेशन)</button>
      <span class="cycle-arrow">➔</span>
      <button type="button" class="cycle-pill ${activeType === 'pi' ? 'active' : ''}" data-action="nav-pi" data-id="${esc(targetId)}" title="2. Advance मांगने के लिए">2. 📋 Proforma Invoice (PI)</button>
      <span class="cycle-arrow">➔</span>
      <button type="button" class="cycle-pill ${activeType === 'receipt' ? 'active' : ''}" data-action="nav-receipt" data-id="${esc(targetId)}" title="3. Advance मिलने पर">3. 🧾 Advance Receipt (50%)</button>
      <span class="cycle-arrow">➔</span>
      <button type="button" class="cycle-pill ${activeType === 'invoice' ? 'active' : ''}" data-action="nav-invoice" data-id="${esc(targetId)}" title="4. Taxable supply / Dispatch पर">4. 🚚 Tax Invoice &amp; Challan</button>
      <span class="cycle-arrow" style="margin:0 4px">|</span>
      <button type="button" class="cycle-pill ${activeType === 'po' ? 'active' : ''}" data-action="nav-po" data-id="${esc(targetId)}" title="5. खरीदने से पहले">5. 📦 Purchase Order (PO)</button>
    </div>
  `;
}

/* ================= Official Material Out Challan & Tax Invoice View (Image 6 & Image 2 Format) ================= */
ACT['inv-view'] = el => {
  const i = S.invoices.find(x => x.id === el.dataset.id); if (!i) return;
  const D = derive(), c = D.cust.get(i.customerId) || {}, st = invStatus(i), bal = balanceOf(i);
  const chlNo = i.challanNo || i.no.replace('INV-', 'CHL-');
  const payments = i.payments || [];
  const primaryPayment = payments[0] || (i.paid > 0 ? { date: i.date, amount: i.paid, mode: i.paymentMode || 'UPI / QR Code (7052050656)', ref: i.paymentRef || '2551540' } : null);

  dlg.className = 'dlg dlg-doc';
  dlg.innerHTML = `
    <!-- Top Modal Actions Bar -->
    <div class="dlg-doc-topbar no-print">
      <div style="display:flex;align-items:center;gap:10px">
        <h2 style="margin:0;font-size:17px;font-weight:900;color:#0d2649">Material Out Challan &amp; Tax Invoice · ${esc(i.no)}</h2>
        <span class="stamp stamp-${st === 'Paid' ? 'good' : st === 'Part paid' ? 'warn' : 'info'}">${esc(st)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <button type="button" class="btn btn-primary" onclick="printDoc('printableArea')">🖨️ Print A4</button>
        <a href="/api/pdf/invoice/${esc(i.id)}" target="_blank" download="Tax_Invoice_${esc(i.no)}.pdf" class="btn" style="background:#0284c7;color:#fff;border-color:#0284c7;font-weight:700">📥 Download PDF File</a>
        ${c && c.email ? `<button type="button" class="btn" id="btnEmailInvoicePdf" style="background:#059669;color:#fff;border-color:#059669;font-weight:700">📧 Email PDF to Client</button>` : ''}
        <button type="button" class="btn" data-action="nav-pi" data-id="${esc(i.id)}" style="font-weight:700">📋 Proforma (PI)</button>
        ${i.paid > 0 ? `<button type="button" class="btn" style="background:#ecfdf5;color:#065f46;border:1px solid #10b981;font-weight:700" data-action="nav-receipt" data-id="${esc(i.id)}">🧾 50% Advance Receipt</button>` : ''}
        ${bal && (can('erp') || can('finance')) ? `
          <button type="button" class="btn btn-primary" data-action="inv-pay" data-id="${esc(i.id)}">💳 Record Balance (Due: ${inr(bal)})</button>
        ` : ''}
        <button type="button" class="btn" data-x="cancel">Close</button>
      </div>
    </div>

    <div class="dlg-doc-scroll">
      ${renderDocLifecycleNav('invoice', i.id, i, c)}

      <!-- Official A4 Material Out Challan & Tax Invoice (Image 6 & Image 2 Exact Format) -->
      <div id="printableArea" class="a4-page challan-wrap">
      <table class="challan-sheet">
        <!-- Title Bar -->
        <tr>
          <td colspan="2" style="padding:0">
            <div class="challan-title-bar">
              <span style="font-size:12px;font-weight:800;letter-spacing:.05em">MATERIAL OUT</span>
              <h2>DELIVERY CHALLAN &amp; TAX INVOICE</h2>
              <span>(ORIGINAL FOR RECIPIENT)</span>
            </div>
          </td>
        </tr>

        <!-- Row 1: Left Company Info vs Right Challan Metadata -->
        <tr>
          <!-- Left: Company Details -->
          <td class="challan-col challan-col-left" style="width:52%;border-bottom:1px solid #000">
            <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:8px">
              <img src="/logo-light.png?v=20261115" alt="RvmAiTech" style="height:38px;width:auto;max-width:160px;object-fit:contain;display:block">
              <div>
                <div style="font-size:14px;font-weight:900;letter-spacing:.02em;color:#000">RvmAiTech Solutions Private Limited</div>
                <div style="font-size:11px;color:#334155;margin-top:2px">Innovate · Automate · Grow · Smart Solutions for a Smarter Business</div>
              </div>
            </div>
            <div style="font-size:11px;color:#000;line-height:1.45">
              Plot No. 42, RIICO Industrial Area, Mansarovar, Jaipur, Rajasthan - 302020<br>
              <b>GSTIN/UIN:</b> 08AABCR1234F1Z0 · <b>State:</b> Rajasthan, Code: 08<br>
              <b>CIN:</b> U72900RJ2021PTC078942 · <b>Company PAN:</b> AAACE0836F<br>
              <b>Contact:</b> +91 7052050656 · <b>Email:</b> rvmaitech2026@gmail.com · <b>Web:</b> www.rvmaitech.com
            </div>
          </td>

          <!-- Right: Challan & Invoice Metadata Grid -->
          <td class="challan-col" style="width:48%;border-bottom:1px solid #000;padding:6px 10px">
            <div class="challan-meta-row">
              <span class="challan-meta-lbl">Challan No.</span>
              <span class="challan-meta-val" style="font-size:13px;font-weight:900;color:#000">${esc(chlNo)}</span>
            </div>
            <div class="challan-meta-row">
              <span class="challan-meta-lbl">Invoice No.</span>
              <span class="challan-meta-val" style="font-size:12.5px;font-weight:800;color:#000">${esc(i.no)}</span>
            </div>
            <div class="challan-meta-row">
              <span class="challan-meta-lbl">Dated</span>
              <span class="challan-meta-val">${fmtDate(i.date)}</span>
            </div>
            <div class="challan-meta-row">
              <span class="challan-meta-lbl">Mode / Terms of Payment</span>
              <span class="challan-meta-val" style="color:#059669;font-weight:800">
                ${esc(i.paymentTerms || (i.paid > 0 ? '50% Advance Received, Balance on Delivery' : '100% on Delivery'))}
              </span>
            </div>
            <div class="challan-meta-row">
              <span class="challan-meta-lbl">Buyer's Order / PO No.</span>
              <span class="challan-meta-val">${esc(i.buyerPo || 'PO-2026-RVM' + String(i.no).slice(-3))}</span>
            </div>
            <div class="challan-meta-row">
              <span class="challan-meta-lbl">PO Reference Date</span>
              <span class="challan-meta-val">${esc(i.poDate ? fmtDate(i.poDate) : fmtDate(i.date))}</span>
            </div>
            <div class="challan-meta-row">
              <span class="challan-meta-lbl">Dispatched Through</span>
              <span class="challan-meta-val">${esc(i.dispatchThrough || 'By Hand to Party')}</span>
            </div>
            <div class="challan-meta-row">
              <span class="challan-meta-lbl">Motor Vehicle / LR No.</span>
              <span class="challan-meta-val">${esc(i.vehicleNo || 'RJ-14-EA-7005')}</span>
            </div>
            <div class="challan-meta-row">
              <span class="challan-meta-lbl">Nature of Processing</span>
              <span class="challan-meta-val">Industrial Automation Supply &amp; Turnkey Execution</span>
            </div>
          </td>
        </tr>

        <!-- Row 2: Dispatch To & Party Consignee Details -->
        <tr>
          <td class="challan-col challan-col-left" style="border-bottom:1px solid #000">
            <div style="font-weight:800;text-transform:uppercase;font-size:10.5px;color:#475569;margin-bottom:4px">Dispatch To (Consignee):</div>
            <div style="font-size:12.5px;font-weight:800;color:#000">${esc(c.company || c.name || 'Consignee')}</div>
            <div style="font-size:11.5px;margin-top:2px;color:#1e293b">
              ${c.address ? esc(c.address) + '<br>' : ''}
              ${c.city ? esc(c.city) + ', ' : ''}State: <b>${esc(c.state || 'Rajasthan')}</b> (Code: 08)<br>
              <b>GSTIN/UIN:</b> ${esc(c.gstin || '08AAACI4441C1ZX')}<br>
              <b>Contact:</b> ${esc(c.phone || '+91 7052050656')} · ${esc(c.email || '')}
            </div>
          </td>
          <td class="challan-col" style="border-bottom:1px solid #000">
            <div style="font-weight:800;text-transform:uppercase;font-size:10.5px;color:#475569;margin-bottom:4px">Billed Party (Buyer):</div>
            <div style="font-size:12.5px;font-weight:800;color:#000">${esc(c.company || c.name || 'Billed Party')}</div>
            <div style="font-size:11.5px;margin-top:2px;color:#1e293b">
              Attn: <b>${esc(c.name || 'Accounts Dept')}</b><br>
              ${c.address ? esc(c.address) + '<br>' : ''}
              ${c.city ? esc(c.city) + ', ' : ''}State: <b>${esc(c.state || 'Rajasthan')}</b><br>
              <b>GSTIN/UIN:</b> ${esc(c.gstin || '08AAACI4441C1ZX')}
            </div>
          </td>
        </tr>

        <!-- Row 3: Items Table -->
        <tr>
          <td colspan="2" style="padding:0">
            <table class="challan-tbl">
              <thead>
                <tr>
                  <th style="width:40px;text-align:center">Sl No.</th>
                  <th>Description of Goods / Automation Services</th>
                  <th style="width:80px">HSN/SAC</th>
                  <th style="width:70px;text-align:center">Quantity</th>
                  <th style="width:90px;text-align:right">Rate (₹)</th>
                  <th style="width:50px;text-align:center">per</th>
                  <th style="width:110px;text-align:right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${(i.items || []).map((it, idx) => `
                  <tr>
                    <td style="text-align:center">${idx + 1}</td>
                    <td>
                      <b>${esc(it.name)}</b>
                      <div style="font-size:10.5px;color:#475569">GST @ ${it.gst || 18}% · Turnkey Supply &amp; Calibration</div>
                    </td>
                    <td class="mono">${esc(it.hsn || '998719')}</td>
                    <td style="text-align:center;font-weight:700">${qty(it.qty)}</td>
                    <td style="text-align:right" class="mono">${inr(it.rate)}</td>
                    <td style="text-align:center">${esc(it.unit || 'NOS')}</td>
                    <td style="text-align:right;font-weight:800" class="mono">${inr(num(it.qty) * num(it.rate))}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </td>
        </tr>

        <!-- Row 4: Tax Totals & 50% Advance Breakdown -->
        <tr>
          <td colspan="2" style="padding:10px 14px;border-bottom:1px solid #000">
            <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:20px;align-items:flex-start">
              <!-- Left side: In Words & Advance Summary -->
              <div>
                <div style="font-size:11.5px;color:#000;margin-bottom:8px">
                  <b>Amount Chargeable (in words):</b><br>
                  <span style="font-size:12.5px;font-weight:800;color:#0d2649">${esc(inrWords(i.total))}</span>
                </div>

                <!-- Advance Payment Entry Box -->
                ${primaryPayment ? `
                  <div class="challan-adv-banner">
                    <div>
                      <div style="font-size:12px;font-weight:900;color:#065f46">
                        🟢 50% ADVANCE PAYMENT RECORDED &amp; SAVED
                      </div>
                      <div style="font-size:11px;color:#047857;margin-top:2px">
                        Received on <b>${fmtDate(primaryPayment.date)}</b> via <b>${esc(primaryPayment.mode || 'Bank Transfer')}</b><br>
                        Transaction / UTR: <b>${esc(primaryPayment.ref || 'CONFIRMED-50')}</b>
                      </div>
                    </div>
                    <div style="font-size:16px;font-weight:900;color:#065f46;text-align:right">
                      ${inr(primaryPayment.amount)}
                      <div style="font-size:10px;text-transform:uppercase;color:#047857">Advance Credited</div>
                    </div>
                  </div>
                ` : `
                  <div style="background:#fff7ed;border:1px solid #f97316;padding:8px 10px;border-radius:4px;font-size:11.5px;color:#9a3412">
                    ⚠️ <b>Payment Status:</b> 100% Payment due on site delivery &amp; client sign-off.
                  </div>
                `}
              </div>

              <!-- Right side: Financial Numbers -->
              <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:8px 12px">
                <div class="challan-meta-row">
                  <span class="challan-meta-lbl">Total Taxable Value (Subtotal)</span>
                  <span class="challan-meta-val mono">${inr(i.subtotal)}</span>
                </div>
                <div class="challan-meta-row">
                  <span class="challan-meta-lbl">CGST (9%)</span>
                  <span class="challan-meta-val mono">${inr(round2(i.tax / 2))}</span>
                </div>
                <div class="challan-meta-row">
                  <span class="challan-meta-lbl">SGST (9%)</span>
                  <span class="challan-meta-val mono">${inr(round2(i.tax / 2))}</span>
                </div>
                <div class="challan-meta-row" style="border-top:1.5px solid #000;border-bottom:1.5px solid #000;padding:6px 0;margin:4px 0">
                  <span style="font-weight:900;font-size:13.5px;color:#000">GRAND TOTAL (Invoice Value)</span>
                  <span style="font-weight:900;font-size:14px;color:#000" class="mono">${inr(i.total)}</span>
                </div>
                <div class="challan-meta-row" style="color:#059669">
                  <span style="font-weight:800;color:#059669">(-) Advance Received (50%)</span>
                  <span style="font-weight:900;color:#059669" class="mono">-${inr(i.paid)}</span>
                </div>
                <div class="challan-meta-row" style="background:#fef2f2;border:1px solid #ef4444;border-radius:4px;padding:6px 8px;margin-top:6px">
                  <span style="font-weight:900;color:#dc2626;font-size:12.5px">🔴 BALANCE DUE ON DELIVERY</span>
                  <span style="font-weight:900;color:#dc2626;font-size:13.5px" class="mono">${inr(bal)}</span>
                </div>
              </div>
            </div>
          </td>
        </tr>

        <!-- Row 5: Signatures & Footer -->
        <tr>
          <td colspan="2" style="padding:10px 14px">
            <div class="challan-sign-row">
              <div class="challan-sign-box">
                <div style="color:#64748b;font-weight:600">Prepared by:</div>
                <div style="font-size:12px;font-weight:800;margin-top:24px;color:#000">Billing Executive</div>
                <div style="font-size:10px;color:#64748b">Finance &amp; Accounts Dept</div>
              </div>
              <div class="challan-sign-box">
                <div style="color:#64748b;font-weight:600">Verified by:</div>
                <div style="font-size:12px;font-weight:800;margin-top:24px;color:#000">Accounts Manager</div>
                <div style="font-size:10px;color:#64748b">Verified &amp; Reconciled</div>
              </div>
              <div class="challan-sign-box" style="text-align:right">
                <div style="color:#000;font-weight:800;font-size:11.5px">for RvmAiTech Solutions Private Limited</div>
                <div style="margin-top:20px;font-weight:900;font-size:12px;color:#0d2649">Vivek Kumar Bhardwaj</div>
                <div style="font-size:10.5px;color:#64748b">Authorised Signatory</div>
              </div>
            </div>

            <div style="text-align:center;font-size:10px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:6px;margin-top:8px">
              This is a Computer Generated Document. Subject to Jaipur Jurisdiction.
            </div>
          </td>
        </tr>
      </table>
      </div>
    </div>`;

  const btnEmailInv = $('#btnEmailInvoicePdf', dlg);
  if (btnEmailInv) {
    btnEmailInv.onclick = async () => {
      btnEmailInv.disabled = true; btnEmailInv.textContent = 'Sending PDF...';
      try {
        const res = await api('POST', `/api/erp/invoices/${encodeURIComponent(i.id)}/send-email`);
        toast(res.sentLive ? `Invoice PDF emailed to ${c.email}!` : `Invoice PDF email prepared & logged to Outbox!`, 'good');
        showEmailDispatchModal({ docType: 'Tax Invoice', docNo: i.no, clientEmail: c.email || '', res });
        btnEmailInv.textContent = 'Sent ✓';
      } catch (err) {
        toast(err.message || 'Could not send invoice email.', 'bad');
        btnEmailInv.disabled = false; btnEmailInv.textContent = '📧 Email PDF to Client';
      }
    };
  }

  if (!dlg.open) dlg.showModal();
};

/* ================= Email Dispatch Modal (Gmail Web & App Password Helper) ================= */
function showEmailDispatchModal({ docType, docNo, clientEmail, res }) {
  const existingModal = document.getElementById('emailStatusOverlay');
  if (existingModal) existingModal.remove();

  const isLive = !!(res && res.sentLive);
  const gmailUrl = (res && res.gmailWebUrl) || `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(clientEmail)}&su=${encodeURIComponent((docType || 'Document') + ': ' + (docNo || ''))}`;
  const dlUrl = (res && res.downloadUrl) || '';

  const overlay = document.createElement('div');
  overlay.id = 'emailStatusOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:999999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px);box-sizing:border-box;';

  overlay.innerHTML = `
    <div style="background:#0b1329;border:1.5px solid ${isLive ? '#10b981' : '#38bdf8'};border-radius:12px;max-width:580px;width:100%;box-shadow:0 25px 50px -12px rgba(0,0,0,0.85);overflow:hidden;box-sizing:border-box">
      <div style="padding:16px 20px;background:${isLive ? '#064e3b' : '#0d2649'};display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #1e293b">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:24px">${isLive ? '✅' : '📬'}</span>
          <div>
            <div style="font-size:15px;font-weight:900;color:#fff">${isLive ? 'Email Sent Successfully to Inbox!' : 'Email Prepared &amp; Logged to Outbox!'}</div>
            <div style="font-size:11px;color:#94a3b8">Doc: <b>${esc(docNo || '')}</b> · Recipient: <b style="color:#38bdf8">${esc(clientEmail || '')}</b></div>
          </div>
        </div>
        <button type="button" id="btnEmailClose" style="background:transparent;border:none;color:#94a3b8;font-size:20px;cursor:pointer;padding:4px 8px;border-radius:4px">✕</button>
      </div>

      <div style="padding:20px;color:#cbd5e1;font-size:13px;line-height:1.6">
        ${isLive ? `
          <p style="margin:0 0 16px;color:#a7f3d0">
            Aapka email Google Official SMTP server se client ke inbox (<b>${esc(clientEmail)}</b>) par safely deliver ho gaya hai. Outbox me delivery status <b>Sent ✓</b> mark ho chuka hai.
          </p>
        ` : `
          <div style="background:#1e293b;border-left:4px solid #f59e0b;padding:12px 14px;border-radius:6px;margin-bottom:16px">
            <b style="color:#fbbf24;display:block;margin-bottom:4px">💡 Email Inbox me kyun nahi pohncha?</b>
            Google Gmail security policy ke mutabiq direct server-to-inbox background dispatch ke liye Google <b>16-digit App Password</b> mangta hai. Iske bina email ERP Outbox me safely record ho jata hai, par Google ke mail server par login nahi hota.
          </div>

          <div style="margin-bottom:16px">
            <b>Aap direct 1-click me email send kar sakte hain:</b>
            <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">
              <a href="${gmailUrl}" target="_blank" class="btn" style="background:#ea4335;color:#fff;border-color:#ea4335;font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 16px;text-decoration:none;border-radius:6px;font-size:13px">
                🚀 1-Click Send via Gmail Web (Direct Inbox Delivery)
              </a>
              <span style="font-size:11px;color:#94a3b8;text-align:center">Is button par click karte hi Gmail compose screen to, subject aur text ke sath khul jayegi — bas 1 click me send!</span>
            </div>
          </div>

          <div style="border-top:1px solid #1e293b;padding-top:14px;margin-top:14px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <span style="font-weight:700;font-size:12px;color:#38bdf8">🔑 Automatic Background SMTP Chahiye? (Enter Gmail App Password)</span>
            </div>
            <div style="display:flex;gap:8px">
              <input type="password" id="inputSmtpAppPass" placeholder="Enter 16-digit Google App Password" class="form-control mono" style="font-size:12px;flex:1">
              <button type="button" id="btnSaveAppPass" class="btn btn-primary" style="font-weight:700;white-space:nowrap;padding:6px 14px">💾 Save Password</button>
            </div>
            <span style="font-size:10px;color:#64748b;display:block;margin-top:4px">Google Account &gt; Security &gt; 2-Step Verification &gt; App Passwords se 16 digit code yahan daalein.</span>
          </div>
        `}
      </div>

      <div style="padding:12px 20px;background:#060d1f;border-top:1px solid #1e293b;display:flex;justify-content:flex-end;gap:10px">
        ${dlUrl ? `<a href="${dlUrl}" target="_blank" download class="btn" style="font-size:12px;font-weight:700">📥 Download PDF</a>` : ''}
        <button type="button" id="btnEmailDone" class="btn btn-primary" style="font-size:12px;font-weight:700;padding:6px 16px">Done</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const closeMe = () => overlay.remove();
  const cBtn = overlay.querySelector('#btnEmailClose');
  if (cBtn) cBtn.onclick = closeMe;
  const dBtn = overlay.querySelector('#btnEmailDone');
  if (dBtn) dBtn.onclick = closeMe;

  const btnSavePass = overlay.querySelector('#btnSaveAppPass');
  if (btnSavePass) {
    btnSavePass.onclick = async () => {
      const passInp = overlay.querySelector('#inputSmtpAppPass');
      const val = passInp ? passInp.value.trim() : '';
      if (!val) {
        toast('Kripya 16-digit Gmail App Password enter karein.', 'bad');
        return;
      }
      btnSavePass.disabled = true;
      btnSavePass.textContent = 'Saving...';
      try {
        await api('POST', '/api/settings/smtp', { emailPass: val });
        toast('Gmail App Password successfully saved! Ab emails direct inbox me deliver honge.', 'good');
        btnSavePass.textContent = 'Saved ✓';
      } catch (err) {
        toast(err.message || 'Could not save password.', 'bad');
        btnSavePass.disabled = false;
        btnSavePass.textContent = '💾 Save Password';
      }
    };
  }
}

/* ================= Official Project Quotation Form & 8-Section PDF Viewer ================= */
function openProjectQuotationForm(existing) {
  const isEdit = !!(existing && existing.id);
  const qtn = existing || {};
  const nextNumber = isEdit ? (qtn.no || 'RVM/QTN/2026/001') : nextNo('RVM/QTN/2026/', S.quotations || [], 'no', 3);
  const D = derive();

  dlg.className = 'dlg dlg-fullscreen';
  dlg.innerHTML = `
    <form class="form" id="dlgForm" style="display:flex;flex-direction:column;height:100%;margin:0">
      <div class="form-head" style="display:flex;justify-content:space-between;align-items:center;flex-shrink:0;padding:16px 24px;border-bottom:1px solid #1e293b;background:#0b1329">
        <div>
          <h2 class="dlg-title" style="margin:0;font-size:18px;font-weight:800;color:#fff">${isEdit ? '✏️ Edit Project Quotation' : '📄 New Project Quotation (RvmAiTech Official)'}</h2>
          <p class="dlg-sub" style="margin:2px 0 0;font-size:12px;color:#94a3b8">8-Section Official Template · SOFTWARE | HARDWARE | INDUSTRIAL AUTOMATION · A4 PDF Ready</p>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <button type="submit" class="btn btn-primary" style="padding:6px 16px;font-weight:700">💾 Save &amp; View Quotation</button>
          <button type="button" class="btn btn-sm" data-x="cancel" aria-label="Close" style="padding:4px 12px;font-weight:700;font-size:15px;border-radius:8px">✕</button>
        </div>
      </div>

      <div class="form-scroll" style="flex:1 1 0%;min-height:0;overflow-y:auto;overflow-x:hidden;padding:20px 24px;box-sizing:border-box;display:flex;flex-direction:column;gap:18px">
        <!-- Quotation Reference & Dates -->
        <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px 20px;box-sizing:border-box;width:100%;flex-shrink:0;overflow:visible">
          <div style="font-size:12px;font-weight:800;color:#38bdf8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">Quotation Reference &amp; Validity</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:14px;box-sizing:border-box;width:100%">
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Quotation No. *</label>
              <input type="text" name="no" id="qtnNo" value="${esc(nextNumber)}" required class="form-control" style="font-family:monospace;font-weight:700">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Quotation Date *</label>
              <input type="date" name="date" id="qtnDate" value="${esc(qtn.date || today())}" required class="form-control">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Valid Until *</label>
              <input type="date" name="validUntil" id="qtnValidUntil" value="${esc(qtn.validUntil || addDays(today(), 30))}" required class="form-control">
            </div>
          </div>
        </div>

        <!-- 1. CLIENT DETAILS -->
        <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px 20px;box-sizing:border-box;width:100%;flex-shrink:0;overflow:visible">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
            <div style="font-size:12px;font-weight:800;color:#38bdf8;text-transform:uppercase;letter-spacing:.05em">1. CLIENT DETAILS</div>
            <div style="font-size:11px;color:#94a3b8;display:flex;align-items:center;flex-wrap:wrap;gap:6px">
              <span>Auto-fill from CRM Customer:</span>
              <select id="qtnCustomerSelect" class="form-control" style="background:#1e293b;color:#f8fafc;border:1px solid #334155;border-radius:4px;padding:3px 8px;font-size:11px;width:auto;max-width:240px">
                <option value="">-- Choose Existing Customer --</option>
                ${(S.customers || []).map(c => `<option value="${esc(c.id)}">${esc(c.company || c.name)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:14px;box-sizing:border-box;width:100%">
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Company Name *</label>
              <input type="text" name="companyName" id="qtnCompanyName" value="${esc(qtn.companyName || '')}" required placeholder="e.g. Havells India Manufacturing Plant" class="form-control">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Contact Person *</label>
              <input type="text" name="contactPerson" id="qtnContactPerson" value="${esc(qtn.contactPerson || '')}" required placeholder="e.g. Sanjay Rathore" class="form-control">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Email (PDF will be sent here) *</label>
              <input type="email" name="email" id="qtnEmail" value="${esc(qtn.email || '')}" required placeholder="client@example.com" class="form-control">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Phone *</label>
              <input type="text" name="phone" id="qtnPhone" value="${esc(qtn.phone || '')}" placeholder="+91 98290 XXXXX" class="form-control">
            </div>
            <div style="grid-column: 1 / -1;min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Address</label>
              <input type="text" name="address" id="qtnAddress" value="${esc(qtn.address || '')}" placeholder="Plot / Street, Industrial Area, City, State - PIN" class="form-control">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">GSTIN (if applicable)</label>
              <input type="text" name="gstin" id="qtnGstin" value="${esc(qtn.gstin || '')}" placeholder="08AAACH1234F1Z9" class="form-control mono">
            </div>
          </div>
        </div>

        <!-- 2. PROJECT DETAILS -->
        <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px 20px;box-sizing:border-box;width:100%;flex-shrink:0;overflow:visible">
          <div style="font-size:12px;font-weight:800;color:#38bdf8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">2. PROJECT DETAILS</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:14px;box-sizing:border-box;width:100%;margin-bottom:12px">
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Project Name *</label>
              <input type="text" name="projectName" id="qtnProjectName" value="${esc(qtn.projectName || '')}" required placeholder="e.g. Smart Parking ANPR & Fastag Automation" class="form-control">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Project Category *</label>
              <select name="projectCategory" id="qtnProjectCategory" class="form-control">
                <option value="Software | Hardware | Industrial Automation" ${qtn.projectCategory === 'Software | Hardware | Industrial Automation' ? 'selected' : ''}>Software | Hardware | Industrial Automation</option>
                <option value="Software Development & Cloud IoT" ${qtn.projectCategory === 'Software Development & Cloud IoT' ? 'selected' : ''}>Software Development &amp; Cloud IoT</option>
                <option value="Hardware & Embedded Systems" ${qtn.projectCategory === 'Hardware & Embedded Systems' ? 'selected' : ''}>Hardware &amp; Embedded Systems</option>
                <option value="Industrial Automation & PLC Solutions" ${qtn.projectCategory === 'Industrial Automation & PLC Solutions' ? 'selected' : ''}>Industrial Automation &amp; PLC Solutions</option>
              </select>
            </div>
          </div>
          <div style="margin-bottom:12px;min-width:0;box-sizing:border-box">
            <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Project Description (Brief Summary) *</label>
            <textarea name="projectDesc" id="qtnProjectDesc" rows="2" class="form-control" required placeholder="Brief Project Description...">${esc(qtn.projectDesc || '')}</textarea>
          </div>
          <div style="min-width:0;box-sizing:border-box">
            <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Scope of Work (Features, Development, Installation and Deliverables) *</label>
            <textarea name="scopeOfWork" id="qtnScopeOfWork" rows="4" class="form-control" required placeholder="Features, Development, Installation and Deliverables...">${esc(qtn.scopeOfWork || '')}</textarea>
          </div>
        </div>

        <!-- 3. PROJECT COST ESTIMATION -->
        <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px 20px;box-sizing:border-box;width:100%;flex-shrink:0;overflow:visible">
          <div style="font-size:12px;font-weight:800;color:#38bdf8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">3. PROJECT COST ESTIMATION</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(190px, 1fr));gap:14px;align-items:flex-end;box-sizing:border-box;width:100%">
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Project Basic Cost (₹) *</label>
              <input type="number" name="basicCost" id="qtnBasicCost" value="${qtn.basicCost || 250000}" required min="0" step="500" class="form-control mono" style="font-size:15px;font-weight:700">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">GST Rate (%)</label>
              <input type="number" name="gstRate" id="qtnGstRate" value="${qtn.gstRate || 18}" readonly class="form-control mono" style="background:#1e293b;color:#94a3b8">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">GST @ 18% (₹)</label>
              <input type="number" name="gstAmount" id="qtnGstAmount" value="${qtn.gstAmount || Math.round((qtn.basicCost || 250000) * 0.18)}" readonly class="form-control mono" style="background:#1e293b;font-weight:700">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#38bdf8;margin-bottom:4px">Grand Total (Including GST) (₹)</label>
              <input type="number" name="totalAmount" id="qtnTotalAmount" value="${qtn.totalAmount || ((qtn.basicCost || 250000) + Math.round((qtn.basicCost || 250000) * 0.18))}" readonly class="form-control mono" style="background:#0d2649;border-color:#38bdf8;color:#38bdf8;font-size:16px;font-weight:800">
            </div>
          </div>
          <p style="margin:8px 0 0;font-size:11px;color:#64748b">
            <b>GST Calculation:</b> Basic Project Cost × 18% · Final GST treatment will be as applicable under Indian GST regulations.
          </p>
        </div>

        <!-- 4. PROJECT DELIVERY TIMELINE -->
        <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px 20px;box-sizing:border-box;width:100%;flex-shrink:0;overflow:visible">
          <div style="font-size:12px;font-weight:800;color:#38bdf8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">4. PROJECT DELIVERY TIMELINE</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:14px;box-sizing:border-box;width:100%">
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Minimum Development Time (Days)</label>
              <input type="number" name="minDays" value="${qtn.minDays || 30}" min="1" class="form-control">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Maximum Development Time (Days)</label>
              <input type="number" name="maxDays" value="${qtn.maxDays || 90}" min="1" class="form-control">
            </div>
            <div style="grid-column: 1 / -1;min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Estimated Delivery Notes</label>
              <input type="text" name="estimatedDelivery" value="${esc(qtn.estimatedDelivery || 'As per project complexity and approved scope.')}" class="form-control">
            </div>
          </div>
          <div style="font-size:11px;color:#64748b;margin-top:8px;line-height:1.4">
            • Actual delivery timeline will be mutually agreed upon and confirmed in the final Project Work Order.<br>
            • Timeline starts after client's written approval / PO, receipt of advance, and required project documents.
          </div>
        </div>

        <!-- 5. PAYMENT TERMS -->
        <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px 20px;box-sizing:border-box;width:100%;flex-shrink:0;overflow:visible">
          <div style="font-size:12px;font-weight:800;color:#38bdf8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">5. PAYMENT TERMS</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(170px, 1fr));gap:14px;align-items:center;box-sizing:border-box;width:100%">
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Advance Payment (%)</label>
              <input type="number" name="advancePct" id="qtnAdvPct" value="${qtn.advancePct !== undefined ? qtn.advancePct : 50}" min="0" max="100" class="form-control">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Milestone Payment (%)</label>
              <input type="number" name="milestonePct" id="qtnMilPct" value="${qtn.milestonePct !== undefined ? qtn.milestonePct : 30}" min="0" max="100" class="form-control">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Final Payment (%)</label>
              <input type="number" name="finalPct" id="qtnFinPct" value="${qtn.finalPct !== undefined ? qtn.finalPct : 20}" min="0" max="100" class="form-control">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Total Split (%)</label>
              <div id="qtnPctTotal" style="font-size:16px;font-weight:800;color:#10b981;padding:7px 12px;background:#1e293b;border-radius:6px;text-align:center">100%</div>
            </div>
          </div>
          <p style="margin:8px 0 0;font-size:11px;color:#64748b">Applicable GST will be charged as per the tax invoice and GST rules.</p>
        </div>

        <!-- 8. QUOTATION ACCEPTANCE SIGNATORY -->
        <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px 20px;box-sizing:border-box;width:100%;flex-shrink:0;overflow:visible">
          <div style="font-size:12px;font-weight:800;color:#38bdf8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">8. QUOTATION ACCEPTANCE (SIGNATORY)</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(210px, 1fr));gap:14px;box-sizing:border-box;width:100%">
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">For RvmAiTech - Authorized Signatory</label>
              <input type="text" name="signatoryName" value="${esc(qtn.signatoryName || 'Vivek Kumar Bhardwaj')}" class="form-control" required>
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Signatory Designation</label>
              <input type="text" name="signatoryRole" value="${esc(qtn.signatoryRole || 'CEO / Founder')}" class="form-control" required>
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Sign Date</label>
              <input type="date" name="signDate" value="${esc(qtn.signDate || today())}" class="form-control">
            </div>
          </div>
        </div>
      </div>

      <div class="form-foot" style="display:flex;justify-content:flex-end;gap:10px;padding:14px 24px;border-top:1px solid #1e293b;background:#0b1329;flex-shrink:0">
        <button type="button" class="btn" data-x="cancel">Cancel</button>
        <button type="submit" class="btn btn-primary" style="padding:8px 20px;font-weight:700">💾 Save &amp; Generate Quotation</button>
      </div>
    </form>
  `;

  // Auto-fill from Customer dropdown
  const custSel = $('#qtnCustomerSelect', dlg);
  if (custSel) {
    custSel.addEventListener('change', () => {
      const custId = custSel.value;
      const c = (S.customers || []).find(x => x.id === custId);
      if (c) {
        if ($('#qtnCompanyName', dlg)) $('#qtnCompanyName', dlg).value = c.company || c.name || '';
        if ($('#qtnContactPerson', dlg)) $('#qtnContactPerson', dlg).value = c.contact || c.name || '';
        if ($('#qtnEmail', dlg)) $('#qtnEmail', dlg).value = c.email || '';
        if ($('#qtnPhone', dlg)) $('#qtnPhone', dlg).value = c.phone || '';
        if ($('#qtnAddress', dlg)) $('#qtnAddress', dlg).value = c.address || '';
        if ($('#qtnGstin', dlg)) $('#qtnGstin', dlg).value = c.gstin || '';
      }
    });
  }

  // Cost calculation
  const inpCost = $('#qtnBasicCost', dlg);
  const inpGstAmt = $('#qtnGstAmount', dlg);
  const inpTotal = $('#qtnTotalAmount', dlg);
  const reCalc = () => {
    const cost = Math.max(0, Number(inpCost.value) || 0);
    const gst = Math.round(cost * 0.18);
    const tot = cost + gst;
    inpGstAmt.value = gst;
    inpTotal.value = tot;
  };
  inpCost.addEventListener('input', reCalc);

  // Payment % calculation
  const pAdv = $('#qtnAdvPct', dlg), pMil = $('#qtnMilPct', dlg), pFin = $('#qtnFinPct', dlg), pTot = $('#qtnPctTotal', dlg);
  const reCalcPct = () => {
    const sumPct = (Number(pAdv.value) || 0) + (Number(pMil.value) || 0) + (Number(pFin.value) || 0);
    pTot.textContent = sumPct + '%';
    pTot.style.color = sumPct === 100 ? '#10b981' : '#f43f5e';
  };
  [pAdv, pMil, pFin].forEach(inp => inp && inp.addEventListener('input', reCalcPct));

  // Form submit
  $('#dlgForm', dlg).addEventListener('submit', async ev => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const cost = Number(fd.get('basicCost')) || 0;
    const gst = Math.round(cost * 0.18);
    const tot = cost + gst;
    const payload = {
      no: String(fd.get('no') || '').trim(),
      date: String(fd.get('date') || today()),
      validUntil: String(fd.get('validUntil') || addDays(today(), 30)),
      companyName: String(fd.get('companyName') || '').trim(),
      contactPerson: String(fd.get('contactPerson') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      address: String(fd.get('address') || '').trim(),
      gstin: String(fd.get('gstin') || '').trim(),
      projectName: String(fd.get('projectName') || '').trim(),
      projectCategory: String(fd.get('projectCategory') || 'Software | Hardware | Industrial Automation').trim(),
      projectDesc: String(fd.get('projectDesc') || '').trim(),
      scopeOfWork: String(fd.get('scopeOfWork') || '').trim(),
      basicCost: cost,
      gstRate: 18,
      gstAmount: gst,
      totalAmount: tot,
      minDays: Number(fd.get('minDays')) || 30,
      maxDays: Number(fd.get('maxDays')) || 90,
      estimatedDelivery: String(fd.get('estimatedDelivery') || 'As per project complexity and approved scope.').trim(),
      advancePct: Number(fd.get('advancePct')) || 50,
      milestonePct: Number(fd.get('milestonePct')) || 30,
      finalPct: Number(fd.get('finalPct')) || 20,
      signatoryName: String(fd.get('signatoryName') || 'Vivek Kumar Bhardwaj').trim(),
      signatoryRole: String(fd.get('signatoryRole') || 'CEO / Founder').trim(),
      signDate: String(fd.get('signDate') || today())
    };

    try {
      if (isEdit) {
        await dbUpdate('quotations', existing.id, payload);
        payload.id = existing.id;
        toast('Quotation updated successfully!', 'good');
      } else {
        const newId = await dbAdd('quotations', payload);
        payload.id = newId;
        toast('Quotation created successfully!', 'good');
      }
      renderQuotationModal(payload);
    } catch (err) {
      toast(err.message || 'Could not save quotation.', 'bad');
    }
  });

  if (!dlg.open) dlg.showModal();
}

/* ================= Official 8-Section RvmAiTech Project Quotation Modal ================= */
function renderQuotationModal(q) {
  dlg.className = 'dlg dlg-doc';
  const D = derive();
  const c = q.customer || (q.customerId ? D.cust.get(q.customerId) : null) || {};

  const docId = q.id || q.no || 'qtn-001';
  const qNo = q.no || 'RVM/QTN/2026/001';
  const qDate = q.date || today();
  const validDate = q.validUntil || addDays(qDate, 30);

  // 1. Client Details
  const clientCompany = q.companyName || c.company || c.name || 'Havells India Manufacturing Plant';
  const contactName = q.contactPerson || c.contact || c.name || 'Sanjay Rathore';
  const clientEmail = q.email || c.email || 'sanjay.rathore@havells.com';
  const clientPhone = q.phone || c.phone || '+91 98290 11014';
  const clientAddress = q.address || c.address || 'Plot No. 14, Industrial Area, Neemrana, Rajasthan - 301705';
  const clientGstin = q.gstin || c.gstin || '08AAACH1234F1Z9';

  // 2. Project Details
  const projName = q.projectName || (q.items && q.items[0] && q.items[0].name) || 'MDMS — Machine Data Management & OEE Cloud Automation';
  const projCat = q.projectCategory || 'Software | Hardware | Industrial Automation';
  const projDesc = q.projectDesc || q.desc || 'Turnkey industrial IoT automation solution with PLC data acquisition, vibration & temperature sensors, edge gateway sync, and real-time cloud OEE monitoring dashboard.';
  const scopeText = q.scopeOfWork || '1. Installation of 12 industrial edge sensor nodes.\n2. RS485 / Modbus PLC gateway integration.\n3. Cloud web dashboard for real-time machine uptime and breakdown alerts.\n4. Staff training, user manual, and 12-month on-site technical support.';

  // 3. Project Cost Estimation
  const basicCost = Number(q.basicCost !== undefined ? q.basicCost : (q.items && q.items.length ? q.items.reduce((a, it) => a + (Number(it.qty) * Number(it.rate)), 0) : 450000));
  const gstRate = Number(q.gstRate || 18);
  const gstAmount = Number(q.gstAmount !== undefined ? q.gstAmount : Math.round(basicCost * (gstRate / 100)));
  const totalAmount = Number(q.totalAmount !== undefined ? q.totalAmount : (basicCost + gstAmount));

  // 4. Delivery Timeline
  const minDays = q.minDays || 30;
  const maxDays = q.maxDays || 90;
  const estDelivery = q.estimatedDelivery || 'As per project complexity and approved scope.';

  // 5. Payment Terms
  const advPct = q.advancePct !== undefined ? q.advancePct : 50;
  const milPct = q.milestonePct !== undefined ? q.milestonePct : 30;
  const finPct = q.finalPct !== undefined ? q.finalPct : 20;

  // 8. Signatory
  const sigName = q.signatoryName || 'Vivek Kumar Bhardwaj';
  const sigRole = q.signatoryRole || 'CEO / Founder';
  const sigDate = q.signDate || qDate;

  dlg.innerHTML = `
    <!-- Top Action Bar -->
    <div class="dlg-doc-topbar no-print">
      <div>
        <h2 style="margin:0;font-size:17px;font-weight:900;color:#0d2649">Quotation · ${esc(qNo)}</h2>
        <p style="margin:2px 0 0;font-size:12px;color:#475569">Client: <b>${esc(clientCompany)}</b> · Project: <b>${esc(projName)}</b></p>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <button type="button" class="btn btn-primary" onclick="printDoc('printableArea')">🖨️ Print A4</button>
        <a href="/api/pdf/quotation/${esc(docId)}" target="_blank" download="Quotation_${esc((qNo || 'RVM_QTN').replace(/[^a-zA-Z0-9_-]/g, ''))}.pdf" class="btn" style="background:#0284c7;color:#fff;border-color:#0284c7;font-weight:700">📥 Download PDF File</a>
        <button type="button" class="btn" id="btnEmailQuotePdf" style="background:#059669;color:#fff;border-color:#059669;font-weight:700">📧 Email PDF to Client</button>
        <button type="button" class="btn" id="btnEditQuote" style="background:#f59e0b;color:#000;border-color:#f59e0b;font-weight:700">✏️ Edit Details</button>
        <button type="button" class="btn" data-x="cancel">Close</button>
      </div>
    </div>

    <div class="dlg-doc-scroll">
      ${renderDocLifecycleNav('quote', docId, null, { name: contactName, company: clientCompany, email: clientEmail })}

      <!-- Printable A4 Quotation Sheet (Matches Exact 8-Section RvmAiTech Template) -->
      <div id="printableArea" class="qtn-proj-sheet a4-page">
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:2px solid #0d2649;margin-bottom:12px">
          <div>
            <img src="/logo-light.png?v=20261115" alt="RvmAiTech" style="height:44px;width:auto;max-width:180px;object-fit:contain;display:block;margin-bottom:4px">
            <div style="font-size:8.5px;font-weight:900;letter-spacing:.06em;color:#0284c7;text-transform:uppercase">SOFTWARE | HARDWARE | INDUSTRIAL AUTOMATION</div>
          </div>
          <div style="text-align:right">
            <div style="background:#0d2649;color:#ffffff;font-size:12px;font-weight:900;padding:4px 14px;border-radius:4px;display:inline-block;letter-spacing:.05em;margin-bottom:6px">PROJECT QUOTATION</div>
            <div style="font-size:11px;color:#0f172a;line-height:1.4">
              <b>Quotation No.:</b> <span class="mono" style="font-weight:800;color:#0d2649">${esc(qNo)}</span><br>
              <b>Quotation Date:</b> ${fmtDate(qDate)}<br>
              <b>Valid Until:</b> ${fmtDate(validDate)}
            </div>
          </div>
        </div>

        <!-- 1. CLIENT DETAILS -->
        <div class="qtn-sec-banner">1. CLIENT DETAILS</div>
        <div class="qtn-sec-box">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <div><b>Company Name:</b> ${esc(clientCompany)}</div>
              <div style="margin-top:3px"><b>Contact Person:</b> ${esc(contactName)}</div>
              <div style="margin-top:3px"><b>Email:</b> ${esc(clientEmail)}</div>
            </div>
            <div>
              <div><b>Phone:</b> ${esc(clientPhone)}</div>
              <div style="margin-top:3px"><b>Address:</b> ${esc(clientAddress)}</div>
              <div style="margin-top:3px"><b>GSTIN:</b> <span class="mono">${esc(clientGstin || 'Unregistered / Not applicable')}</span></div>
            </div>
          </div>
        </div>

        <!-- 2. PROJECT DETAILS -->
        <div class="qtn-sec-banner">2. PROJECT DETAILS</div>
        <div class="qtn-sec-box">
          <div style="margin-bottom:6px"><b>Project Name:</b> <span style="font-size:12px;font-weight:800;color:#0d2649">${esc(projName)}</span></div>
          <div style="margin-bottom:6px"><b>Project Category:</b> <span style="font-weight:700;color:#0284c7">${esc(projCat)}</span></div>
          <div style="margin-bottom:6px"><b>Project Description:</b><br><span style="color:#334155;white-space:pre-line">${esc(projDesc)}</span></div>
          <div><b>Scope of Work:</b><br><span style="color:#334155;white-space:pre-line">${esc(scopeText)}</span></div>
        </div>

        <!-- 3. PROJECT COST ESTIMATION -->
        <div class="qtn-sec-banner">3. PROJECT COST ESTIMATION</div>
        <table class="qtn-table-est">
          <thead>
            <tr>
              <th>Description</th>
              <th style="width:140px;text-align:right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><b>Project Basic Cost</b></td>
              <td style="text-align:right;font-weight:700" class="mono">${inr(basicCost)}</td>
            </tr>
            <tr>
              <td>GST @ ${gstRate}%</td>
              <td style="text-align:right" class="mono">${inr(gstAmount)}</td>
            </tr>
            <tr style="background:#f1f5f9;border-top:1.5px solid #0d2649;border-bottom:1.5px solid #0d2649">
              <td style="font-size:12px;font-weight:900;color:#0d2649">Grand Total (Including GST)</td>
              <td style="text-align:right;font-size:13px;font-weight:900;color:#0d2649" class="mono">${inr(totalAmount)}</td>
            </tr>
          </tbody>
        </table>
        <div style="font-size:10px;color:#64748b;margin-bottom:8px">
          <b>GST Calculation:</b> Basic Project Cost × 18%<br>
          Final GST treatment will be as applicable under Indian GST regulations.
        </div>

        <!-- 4. PROJECT DELIVERY TIMELINE -->
        <div class="qtn-sec-banner">4. PROJECT DELIVERY TIMELINE</div>
        <div class="qtn-sec-box">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px">
            <div><b>Minimum Development Time:</b> ${esc(minDays)} Days</div>
            <div><b>Maximum Development Time:</b> ${esc(maxDays)} Days</div>
          </div>
          <div style="margin-bottom:6px"><b>Estimated Delivery:</b> ${esc(estDelivery)}</div>
          <div style="color:#475569;margin-bottom:4px">The actual delivery timeline will be mutually agreed upon and confirmed in the final Project Work Order.</div>
          <div style="color:#475569">
            <b>The project timeline will start after:</b>
            <div style="padding-left:14px;margin-top:2px">
              • Client's written approval / Purchase Order.<br>
              • Receipt of agreed advance payment.<br>
              • Receipt of all required project information, documents and resources.
            </div>
          </div>
        </div>

        <!-- 5. PAYMENT TERMS -->
        <div class="qtn-sec-banner">5. PAYMENT TERMS</div>
        <div style="font-size:10.5px;color:#334155;margin-bottom:6px">Payment will be made according to the mutually agreed project payment schedule:</div>
        <table class="qtn-table-est" style="margin-bottom:4px">
          <thead>
            <tr>
              <th>Payment Stage</th>
              <th style="width:140px;text-align:right">Percentage</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Advance Payment</td>
              <td style="text-align:right;font-weight:700" class="mono">${esc(advPct)}%</td>
            </tr>
            <tr>
              <td>Development / Milestone Payment</td>
              <td style="text-align:right;font-weight:700" class="mono">${esc(milPct)}%</td>
            </tr>
            <tr>
              <td>Final Payment</td>
              <td style="text-align:right;font-weight:700" class="mono">${esc(finPct)}%</td>
            </tr>
            <tr style="background:#f1f5f9;font-weight:900;border-top:1.5px solid #0d2649">
              <td>Total</td>
              <td style="text-align:right" class="mono">100%</td>
            </tr>
          </tbody>
        </table>
        <div style="font-size:10px;color:#64748b;margin-bottom:8px">Applicable GST will be charged as per the tax invoice and GST rules.</div>

        <!-- 6. PROJECT DELAY & CHANGE POLICY -->
        <div class="qtn-sec-banner">6. PROJECT DELAY &amp; CHANGE POLICY</div>
        <div class="qtn-sec-box" style="font-size:10.5px;line-height:1.5">
          • Any delay caused by late approvals, missing information, pending payments or client-side dependencies may extend the delivery timeline.<br>
          • Additional features or changes outside the approved project scope may require additional charges and revised timelines.<br>
          • Any revised delivery date will be communicated to the client in writing.<br>
          • RvmAiTech and the client will mutually agree on any revised project schedule.
        </div>

        <!-- 7. TERMS & CONDITIONS -->
        <div class="qtn-sec-banner">7. TERMS &amp; CONDITIONS</div>
        <div class="qtn-sec-box" style="font-size:10.5px;line-height:1.5">
          • This quotation is based on the scope of work mentioned above.<br>
          • Work will commence after written approval and receipt of the agreed advance.<br>
          • Hardware components, third-party licenses, hosting, travel and other external expenses will be included only if specifically mentioned in this quotation.<br>
          • Any additional work will be quoted separately.<br>
          • Final deliverables and project handover will be provided according to the approved scope and payment terms.<br>
          • Applicable taxes will be charged as per prevailing laws.
        </div>

        <!-- 8. QUOTATION ACCEPTANCE -->
        <div class="qtn-sec-banner">8. QUOTATION ACCEPTANCE</div>
        <div style="font-size:10.5px;color:#334155;margin-bottom:6px">
          I/We accept the project scope, commercial terms, pricing and delivery conditions mentioned in this quotation.
        </div>
        <div class="qtn-accept-grid">
          <div class="qtn-accept-box">
            <div style="font-weight:900;color:#0d2649;border-bottom:1px solid #cbd5e1;padding-bottom:3px;margin-bottom:6px">For RvmAiTech</div>
            <div>Authorized Signatory: __________________</div>
            <div>Name: <b>${esc(sigName)}</b></div>
            <div>Designation: <b>${esc(sigRole)}</b></div>
            <div>Date: <b>${fmtDate(sigDate)}</b></div>
          </div>
          <div class="qtn-accept-box">
            <div style="font-weight:900;color:#0d2649;border-bottom:1px solid #cbd5e1;padding-bottom:3px;margin-bottom:6px">Client Acceptance</div>
            <div>Client Name: __________________</div>
            <div>Company Name: <b>${esc(clientCompany)}</b></div>
            <div>Authorized Signature &amp; Stamp: __________________</div>
            <div>Date: __________________</div>
          </div>
        </div>

        <!-- Footer -->
        <div style="margin-top:14px;border-top:1px solid #cbd5e1;padding-top:8px;text-align:center;font-size:10px;color:#64748b;line-height:1.5">
          <b>RvmAiTech</b> · Email: <a href="mailto:rvmaitech2026@gmail.com" style="color:#0284c7">rvmaitech2026@gmail.com</a> · WhatsApp: <b>7052050656</b><br>
          <i>Smart Solutions. Intelligent Automation. Reliable Technology.</i>
        </div>
      </div>
    </div>
  `;

  // Edit details button
  const btnEdit = $('#btnEditQuote', dlg);
  if (btnEdit) {
    btnEdit.addEventListener('click', () => {
      openProjectQuotationForm(q);
    });
  }

  // Email PDF button
  const btnEmail = $('#btnEmailQuotePdf', dlg);
  if (btnEmail) {
    btnEmail.onclick = async () => {
      btnEmail.disabled = true; btnEmail.textContent = 'Sending PDF...';
      try {
        const res = await api('POST', `/api/erp/quotations/${encodeURIComponent(docId)}/send-email`);
        toast(res.sentLive ? `Quotation PDF emailed to ${clientEmail}!` : `Quotation PDF prepared & logged to Outbox!`, 'good');
        btnEmail.textContent = 'Sent ✓';
        showEmailDispatchModal({ docType: 'Project Quotation', docNo: qNo, clientEmail, res });
      } catch (err) {
        toast(err.message || 'Could not send quotation email.', 'bad');
        btnEmail.disabled = false; btnEmail.textContent = '📧 Email PDF to Client';
      }
    };
  }

  if (!dlg.open) dlg.showModal();
}

/* ================= Official Proforma Invoice (PI) Form & 8-Section PDF Viewer ================= */
function openProformaInvoiceForm(existing) {
  const isEdit = !!(existing && existing.id);
  const pi = existing || {};
  const nextNumber = isEdit ? (pi.no || 'RVM/PI/2026/001') : nextNo('RVM/PI/2026/', S.proformas || [], 'no', 3);
  const isFull = String(pi.paymentType || '').toLowerCase().includes('full');
  const basicCostVal = Number(pi.basicCost !== undefined ? pi.basicCost : 450000);
  const gstAmtVal = Number(pi.gstAmount !== undefined ? pi.gstAmount : Math.round(basicCostVal * 0.18));
  const totVal = Number(pi.totalAmount !== undefined ? pi.totalAmount : (basicCostVal + gstAmtVal));
  const advPctVal = isFull ? 100 : (Number(pi.advancePct !== undefined ? pi.advancePct : 50));
  const advAmtVal = isFull ? totVal : (Number(pi.advanceAmount !== undefined ? pi.advanceAmount : Math.round(totVal * 0.5)));
  const remAmtVal = isFull ? 0 : Math.max(0, totVal - advAmtVal);

  dlg.className = 'dlg dlg-fullscreen';
  dlg.innerHTML = `
    <form class="form" id="dlgForm" style="display:flex;flex-direction:column;height:100%;margin:0">
      <div class="form-head" style="display:flex;justify-content:space-between;align-items:center;flex-shrink:0;padding:16px 24px;border-bottom:1px solid #1e293b;background:#0b1329">
        <div>
          <h2 class="dlg-title" style="margin:0;font-size:18px;font-weight:800;color:#fff">${isEdit ? '✏️ Edit Proforma Invoice (PI)' : '📋 New Proforma Invoice (PI) · RvmAiTech Official'}</h2>
          <p class="dlg-sub" style="margin:2px 0 0;font-size:12px;color:#94a3b8">8-Section Official Format · Advance PI / Full PI · SOFTWARE | HARDWARE | INDUSTRIAL AUTOMATION</p>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <button type="submit" class="btn btn-primary" style="padding:6px 16px;font-weight:700">💾 Save &amp; Generate PI</button>
          <button type="button" class="btn btn-sm" data-x="cancel" aria-label="Close" style="padding:4px 12px;font-weight:700;font-size:15px;border-radius:8px">✕</button>
        </div>
      </div>

      <div class="form-scroll" style="flex:1 1 0%;min-height:0;overflow-y:auto;overflow-x:hidden;padding:20px 24px;box-sizing:border-box;display:flex;flex-direction:column;gap:18px">
        <!-- PI Reference & Dates & Payment Type Dropdown -->
        <div style="background:#0f172a;border:1.5px solid #0284c7;border-radius:8px;padding:16px 20px;box-sizing:border-box;width:100%;flex-shrink:0;overflow:visible">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid #1e293b;padding-bottom:8px;flex-wrap:wrap;gap:8px">
            <div style="font-size:13px;font-weight:900;color:#38bdf8;text-transform:uppercase;letter-spacing:.05em">PI Reference, Validity &amp; Payment Type</div>
            <div id="piPctBadge" style="background:#0284c7;color:#fff;font-weight:800;font-size:12px;padding:4px 12px;border-radius:12px">
              ${isFull ? '100% Full Payment' : `${advPctVal}% Advance PI`}
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(210px, 1fr));gap:14px;box-sizing:border-box;width:100%">
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">PI Number *</label>
              <input type="text" name="no" id="piNo" value="${esc(nextNumber)}" required class="form-control mono" style="font-weight:700">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">PI Date *</label>
              <input type="date" name="date" id="piDate" value="${esc(pi.date || today())}" required class="form-control">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Valid Until *</label>
              <input type="date" name="validUntil" id="piValidUntil" value="${esc(pi.validUntil || addDays(today(), 30))}" required class="form-control">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:800;color:#38bdf8;margin-bottom:4px">Payment Type Selection *</label>
              <select name="paymentType" id="piPaymentType" class="form-control" style="font-weight:800;background:#0d2649;color:#38bdf8;border-color:#38bdf8;width:100%;max-width:100%;box-sizing:border-box">
                <option value="Advance Payment" ${!isFull ? 'selected' : ''}>OPTION A: Advance Payment (Advance PI)</option>
                <option value="Full Payment" ${isFull ? 'selected' : ''}>OPTION B: Full Payment (100% Full PI)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- 1. SELLER DETAILS (Company Info Card) -->
        <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:12px 18px;box-sizing:border-box;width:100%;flex-shrink:0;overflow:visible">
          <div style="font-size:11.5px;font-weight:800;color:#38bdf8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">1. SELLER DETAILS</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(210px, 1fr));gap:10px;font-size:11px;color:#94a3b8;box-sizing:border-box;width:100%">
            <div style="min-width:0"><b>Company:</b> <span style="color:#fff">RvmAiTech Solutions Private Limited</span></div>
            <div style="min-width:0"><b>GSTIN:</b> <span style="color:#fff" class="mono">08AABCR1234F1Z0</span></div>
            <div style="min-width:0"><b>Email:</b> <span style="color:#fff">rvmaitech2026@gmail.com</span></div>
            <div style="min-width:0"><b>WhatsApp:</b> <span style="color:#fff">7052050656</span></div>
            <div style="grid-column: 1 / -1;min-width:0"><b>Registered Business Address:</b> <span style="color:#cbd5e1">Plot No. 42, RIICO Industrial Area, Mansarovar, Jaipur, Rajasthan - 302020</span></div>
          </div>
        </div>

        <!-- 2. CLIENT DETAILS -->
        <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px 20px;box-sizing:border-box;width:100%;flex-shrink:0;overflow:visible">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:gap:8px">
            <div style="font-size:12px;font-weight:800;color:#38bdf8;text-transform:uppercase;letter-spacing:.05em">2. CLIENT DETAILS</div>
            <div style="font-size:11px;color:#94a3b8;display:flex;align-items:center;flex-wrap:wrap;gap:6px">
              <span>Auto-fill from CRM Customer:</span>
              <select id="piCustomerSelect" class="form-control" style="background:#1e293b;color:#f8fafc;border:1px solid #334155;border-radius:4px;padding:3px 8px;font-size:11px;width:auto;max-width:240px">
                <option value="">-- Choose Existing Customer --</option>
                ${(S.customers || []).map(c => `<option value="${esc(c.id)}">${esc(c.company || c.name)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:14px;box-sizing:border-box;width:100%">
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Client / Company Name *</label>
              <input type="text" name="companyName" id="piCompanyName" value="${esc(pi.companyName || '')}" required placeholder="e.g. Havells India Manufacturing Plant" class="form-control">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Contact Person *</label>
              <input type="text" name="contactPerson" id="piContactPerson" value="${esc(pi.contactPerson || '')}" required placeholder="e.g. Sanjay Rathore" class="form-control">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Client Email (For PDF dispatch) *</label>
              <input type="email" name="email" id="piEmail" value="${esc(pi.email || '')}" required placeholder="client@example.com" class="form-control">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Client Phone *</label>
              <input type="text" name="phone" id="piPhone" value="${esc(pi.phone || '')}" placeholder="+91 98290 XXXXX" class="form-control">
            </div>
            <div style="grid-column: 1 / -1;min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Billing Address</label>
              <input type="text" name="address" id="piAddress" value="${esc(pi.address || '')}" placeholder="Plot / Street, Industrial Area, City, State - PIN" class="form-control">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Client GSTIN (if applicable)</label>
              <input type="text" name="gstin" id="piGstin" value="${esc(pi.gstin || '')}" placeholder="08AAACH1234F1Z9" class="form-control mono">
            </div>
          </div>
        </div>

        <!-- 3. PROJECT DETAILS -->
        <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px 20px;box-sizing:border-box;width:100%;flex-shrink:0;overflow:visible">
          <div style="font-size:12px;font-weight:800;color:#38bdf8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">3. PROJECT DETAILS</div>
          
          <!-- Row 1: Project Name & Project ID -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:14px;box-sizing:border-box;width:100%;margin-bottom:12px">
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Project Name *</label>
              <input type="text" name="projectName" id="piProjectName" value="${esc(pi.projectName || '')}" required placeholder="e.g. Smart Parking ANPR & Fastag Automation" class="form-control" style="width:100%;box-sizing:border-box">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Project ID</label>
              <input type="text" name="projectId" id="piProjectId" value="${esc(pi.projectId || 'PRJ-001')}" placeholder="PRJ-001" class="form-control mono" style="width:100%;box-sizing:border-box">
            </div>
          </div>

          <!-- Row 2: Project Category & Expected Delivery (Clean separate columns, zero overlap) -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:14px;box-sizing:border-box;width:100%;margin-bottom:12px">
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Project Category *</label>
              <select name="projectCategory" id="piProjectCategory" class="form-control" style="width:100%;box-sizing:border-box">
                <option value="Software | Hardware | Industrial Automation" ${pi.projectCategory === 'Software | Hardware | Industrial Automation' ? 'selected' : ''}>Software | Hardware | Industrial Automation</option>
                <option value="Software Development & Cloud IoT" ${pi.projectCategory === 'Software Development & Cloud IoT' ? 'selected' : ''}>Software Development &amp; Cloud IoT</option>
                <option value="Hardware & Embedded Systems" ${pi.projectCategory === 'Hardware & Embedded Systems' ? 'selected' : ''}>Hardware &amp; Embedded Systems</option>
                <option value="Industrial Automation & PLC Solutions" ${pi.projectCategory === 'Industrial Automation & PLC Solutions' ? 'selected' : ''}>Industrial Automation &amp; PLC Solutions</option>
              </select>
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Expected Delivery</label>
              <input type="text" name="expectedDelivery" id="piExpectedDelivery" value="${esc(pi.expectedDelivery || '30–90 Days')}" class="form-control" style="width:100%;box-sizing:border-box">
            </div>
          </div>

          <!-- Row 3: Project Description -->
          <div style="min-width:0;box-sizing:border-box">
            <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Project Description *</label>
            <textarea name="projectDesc" id="piProjectDesc" rows="2" class="form-control" required placeholder="Brief Project Description..." style="width:100%;box-sizing:border-box">${esc(pi.projectDesc || '')}</textarea>
          </div>
        </div>

        <!-- 4. PROJECT PAYMENT DETAILS (Cost & GST) -->
        <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px 20px;box-sizing:border-box;width:100%;flex-shrink:0;overflow:visible">
          <div style="font-size:12px;font-weight:800;color:#38bdf8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">4. PROJECT PAYMENT DETAILS</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(190px, 1fr));gap:14px;align-items:flex-end;box-sizing:border-box;width:100%">
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Basic Project Cost (₹) *</label>
              <input type="number" name="basicCost" id="piBasicCost" value="${basicCostVal}" required min="0" step="500" class="form-control mono" style="font-size:15px;font-weight:700">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">GST Rate (%)</label>
              <input type="number" name="gstRate" id="piGstRate" value="${pi.gstRate || 18}" readonly class="form-control mono" style="background:#1e293b;color:#94a3b8">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">GST @ 18% (₹)</label>
              <input type="number" name="gstAmount" id="piGstAmount" value="${gstAmtVal}" readonly class="form-control mono" style="background:#1e293b;font-weight:700">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#38bdf8;margin-bottom:4px">Total Project Value (₹)</label>
              <input type="number" name="totalAmount" id="piTotalAmount" value="${totVal}" readonly class="form-control mono" style="background:#0d2649;border-color:#38bdf8;color:#38bdf8;font-size:16px;font-weight:800">
            </div>
          </div>
        </div>

        <!-- 5. PAYMENT TYPE – SELECT ONE (Live Interactive Amount & % Auto-Sync) -->
        <div style="background:#0f172a;border:1.5px solid #0284c7;border-radius:8px;padding:16px 20px;box-sizing:border-box;width:100%;flex-shrink:0;overflow:visible">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
            <div style="font-size:12.5px;font-weight:800;color:#38bdf8;text-transform:uppercase;letter-spacing:.05em">5. PAYMENT TYPE CONFIGURATION (AMOUNT &amp; % AUTO-CALCULATION)</div>
            <span style="font-size:11px;color:#94a3b8">💡 <i>Amount enter karte hi % auto show hoga!</i></span>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(210px, 1fr));gap:14px;background:#1e293b;border-radius:8px;padding:14px;box-sizing:border-box;width:100%">
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:800;color:#38bdf8;margin-bottom:4px">Advance Amount (₹) *</label>
              <input type="number" name="advanceAmount" id="piAdvAmount" value="${advAmtVal}" min="0" step="100" class="form-control mono" style="font-size:16px;font-weight:800;background:#0d2649;color:#38bdf8;border:1.5px solid #38bdf8">
              <span style="font-size:10px;color:#94a3b8;display:block;margin-top:2px">Type amount here to auto-calculate %</span>
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:800;color:#38bdf8;margin-bottom:4px">Advance Percentage (%) *</label>
              <input type="number" name="advancePct" id="piAdvPct" value="${advPctVal}" min="0" max="100" step="0.1" class="form-control mono" style="font-size:16px;font-weight:800">
              <span style="font-size:10px;color:#94a3b8;display:block;margin-top:2px">Type % here to auto-calculate amount</span>
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Remaining Balance Amount (₹)</label>
              <input type="number" name="remainingAmount" id="piRemainingAmount" value="${remAmtVal}" readonly class="form-control mono" style="background:#0f172a;font-weight:700;color:#cbd5e1">
              <span style="font-size:10px;color:#64748b;display:block;margin-top:2px">Payable upon project milestones / delivery</span>
            </div>
          </div>
          <p style="margin:10px 0 0;font-size:11px;color:#94a3b8">
            <b>Payment Due:</b> <span id="piPaymentDueText">${isFull ? 'Full payment before project commencement.' : 'As per agreed advance payment terms.'}</span>
          </p>
        </div>

        <!-- 6. BANK / PAYMENT DETAILS (Industrial Bank Presets Dropdown) -->
        <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px 20px;box-sizing:border-box;width:100%;flex-shrink:0;overflow:visible">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
            <div style="font-size:12px;font-weight:800;color:#38bdf8;text-transform:uppercase;letter-spacing:.05em">6. BANK / PAYMENT DETAILS</div>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:11px;color:#94a3b8;font-weight:700">🏢 Select Industrial Bank:</span>
              <select id="piBankSelect" class="form-control" style="font-size:11px;padding:5px 10px;width:auto;border-color:#38bdf8;background:#1e293b;color:#38bdf8;font-weight:800">
                <option value="ICICI" ${(!pi.bankName || pi.bankName.includes('ICICI')) ? 'selected' : ''}>ICICI Bank (Corporate Current A/c)</option>
                <option value="SBI" ${(pi.bankName && pi.bankName.includes('SBI')) ? 'selected' : ''}>State Bank of India - SBI (Industrial Branch)</option>
                <option value="HDFC" ${(pi.bankName && pi.bankName.includes('HDFC')) ? 'selected' : ''}>HDFC Bank (Commercial Banking)</option>
                <option value="AXIS" ${(pi.bankName && (pi.bankName.includes('AXIS') || pi.bankName.includes('Axis'))) ? 'selected' : ''}>Axis Bank (Corporate Banking)</option>
                <option value="KOTAK" ${(pi.bankName && pi.bankName.includes('Kotak')) ? 'selected' : ''}>Kotak Mahindra Bank (Industrial Accounts)</option>
                <option value="PNB" ${(pi.bankName && pi.bankName.includes('PNB')) ? 'selected' : ''}>Punjab National Bank - PNB</option>
                <option value="BOB" ${(pi.bankName && (pi.bankName.includes('Baroda') || pi.bankName.includes('BOB'))) ? 'selected' : ''}>Bank of Baroda - BOB</option>
                <option value="CUSTOM">Custom / Other Bank</option>
              </select>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(210px, 1fr));gap:14px;box-sizing:border-box;width:100%">
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Account Holder Name</label>
              <input type="text" name="accountHolder" id="piAccountHolder" value="${esc(pi.accountHolder || 'RvmAiTech Solutions Private Limited')}" class="form-control">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Bank Name</label>
              <input type="text" name="bankName" id="piBankName" value="${esc(pi.bankName || 'ICICI Bank')}" class="form-control">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Account Number</label>
              <input type="text" name="accountNo" id="piAccountNo" value="${esc(pi.accountNo || '348451000002')}" class="form-control mono">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">IFSC Code</label>
              <input type="text" name="ifsc" id="piIfsc" value="${esc(pi.ifsc || 'ICIC0003484')}" class="form-control mono">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Branch</label>
              <input type="text" name="branch" id="piBranch" value="${esc(pi.branch || 'Mansarovar, Jaipur')}" class="form-control">
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">UPI ID</label>
              <input type="text" name="upiId" id="piUpiId" value="${esc(pi.upiId || '7052050656@icici')}" class="form-control mono">
            </div>
          </div>
        </div>

        <!-- 8. AUTHORIZATION & SIGNATORY -->
        <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px 20px;box-sizing:border-box;width:100%;flex-shrink:0;overflow:visible">
          <div style="font-size:12px;font-weight:800;color:#38bdf8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">8. AUTHORIZATION (SIGNATORY)</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(210px, 1fr));gap:14px;box-sizing:border-box;width:100%">
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Authorized Signatory Name</label>
              <input type="text" name="signatoryName" value="${esc(pi.signatoryName || 'Vivek Kumar Bhardwaj')}" class="form-control" required>
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Signatory Designation</label>
              <input type="text" name="signatoryRole" value="${esc(pi.signatoryRole || 'CEO / Founder')}" class="form-control" required>
            </div>
            <div style="min-width:0;box-sizing:border-box">
              <label style="display:block;font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px">Sign Date</label>
              <input type="date" name="signDate" value="${esc(pi.signDate || today())}" class="form-control">
            </div>
          </div>
        </div>
      </div>

      <div class="form-foot" style="display:flex;justify-content:flex-end;gap:10px;padding:14px 24px;border-top:1px solid #1e293b;background:#0b1329;flex-shrink:0">
        <button type="button" class="btn" data-x="cancel">Cancel</button>
        <button type="submit" class="btn btn-primary" style="padding:8px 20px;font-weight:700">💾 Save &amp; Generate PI</button>
      </div>
    </form>
  `;

  // Auto-fill from Customer dropdown
  const custSel = $('#piCustomerSelect', dlg);
  if (custSel) {
    custSel.addEventListener('change', () => {
      const custId = custSel.value;
      const c = (S.customers || []).find(x => x.id === custId);
      if (c) {
        if ($('#piCompanyName', dlg)) $('#piCompanyName', dlg).value = c.company || c.name || '';
        if ($('#piContactPerson', dlg)) $('#piContactPerson', dlg).value = c.contact || c.name || '';
        if ($('#piEmail', dlg)) $('#piEmail', dlg).value = c.email || '';
        if ($('#piPhone', dlg)) $('#piPhone', dlg).value = c.phone || '';
        if ($('#piAddress', dlg)) $('#piAddress', dlg).value = c.address || '';
        if ($('#piGstin', dlg)) $('#piGstin', dlg).value = c.gstin || '';
      }
    });
  }

  // Industrial Banks Presets (SBI, ICICI, AXIS, HDFC, Kotak, PNB, BOB)
  const industrialBankPresets = {
    ICICI: {
      bankName: 'ICICI Bank',
      accountNo: '348451000002',
      ifsc: 'ICIC0003484',
      branch: 'Mansarovar, Jaipur',
      upiId: '7052050656@icici'
    },
    SBI: {
      bankName: 'State Bank of India (SBI)',
      accountNo: '409120008891',
      ifsc: 'SBIN0031852',
      branch: 'RIICO Industrial Area, Mansarovar, Jaipur',
      upiId: '7052050656@sbi'
    },
    HDFC: {
      bankName: 'HDFC Bank',
      accountNo: '50200084729103',
      ifsc: 'HDFC0001854',
      branch: 'RIICO Tech Zone, Mansarovar, Jaipur',
      upiId: '7052050656@hdfcbank'
    },
    AXIS: {
      bankName: 'Axis Bank',
      accountNo: '923020048192041',
      ifsc: 'UTIB0002188',
      branch: 'Mansarovar Industrial Area, Jaipur',
      upiId: '7052050656@axisbank'
    },
    KOTAK: {
      bankName: 'Kotak Mahindra Bank',
      accountNo: '841120004921',
      ifsc: 'KKBK0003541',
      branch: 'Jaipur Main Industrial Branch',
      upiId: '7052050656@kotak'
    },
    PNB: {
      bankName: 'Punjab National Bank (PNB)',
      accountNo: '1842002100049120',
      ifsc: 'PUNB0184200',
      branch: 'Industrial Area, Jaipur',
      upiId: '7052050656@pnb'
    },
    BOB: {
      bankName: 'Bank of Baroda (BOB)',
      accountNo: '29850200001890',
      ifsc: 'BARB0MANSAR',
      branch: 'Mansarovar, Jaipur',
      upiId: '7052050656@barodampay'
    }
  };

  const selBank = $('#piBankSelect', dlg);
  if (selBank) {
    selBank.addEventListener('change', () => {
      const bKey = selBank.value;
      if (industrialBankPresets[bKey]) {
        const b = industrialBankPresets[bKey];
        if ($('#piBankName', dlg)) $('#piBankName', dlg).value = b.bankName;
        if ($('#piAccountNo', dlg)) $('#piAccountNo', dlg).value = b.accountNo;
        if ($('#piIfsc', dlg)) $('#piIfsc', dlg).value = b.ifsc;
        if ($('#piBranch', dlg)) $('#piBranch', dlg).value = b.branch;
        if ($('#piUpiId', dlg)) $('#piUpiId', dlg).value = b.upiId;
      }
    });
  }

  // Cost and Payment Calculation logic with 2-way live sync
  const inpCost = $('#piBasicCost', dlg);
  const inpGstAmt = $('#piGstAmount', dlg);
  const inpTotal = $('#piTotalAmount', dlg);
  const selPayType = $('#piPaymentType', dlg);
  const inpAdvPct = $('#piAdvPct', dlg);
  const inpAdvAmt = $('#piAdvAmount', dlg);
  const inpRemAmt = $('#piRemainingAmount', dlg);
  const badgePct = $('#piPctBadge', dlg);
  const dueTxt = $('#piPaymentDueText', dlg);

  const syncAll = (source) => {
    const cost = Math.max(0, Number(inpCost.value) || 0);
    const gst = Math.round(cost * 0.18);
    const tot = cost + gst;
    inpGstAmt.value = gst;
    inpTotal.value = tot;

    const isFullPay = selPayType.value === 'Full Payment';
    if (dueTxt) dueTxt.textContent = isFullPay ? 'Full payment before project commencement.' : 'As per agreed advance payment terms.';

    if (isFullPay) {
      inpAdvPct.value = 100;
      inpAdvAmt.value = tot;
      inpRemAmt.value = 0;
      inpAdvPct.disabled = true;
      inpAdvAmt.disabled = true;
      if (badgePct) badgePct.textContent = '100% Full Payment';
    } else {
      inpAdvPct.disabled = false;
      inpAdvAmt.disabled = false;

      if (source === 'amount') {
        const amt = Math.max(0, Math.min(tot, Number(inpAdvAmt.value) || 0));
        const pct = tot > 0 ? (Math.round((amt / tot) * 100 * 10) / 10) : 0;
        inpAdvPct.value = pct;
        inpRemAmt.value = Math.max(0, tot - amt);
        if (badgePct) badgePct.textContent = pct + '% Advance PI';
      } else {
        const pct = Math.max(0, Math.min(100, Number(inpAdvPct.value) || 50));
        const amt = Math.round(tot * (pct / 100));
        inpAdvAmt.value = amt;
        inpRemAmt.value = Math.max(0, tot - amt);
        if (badgePct) badgePct.textContent = pct + '% Advance PI';
      }
    }
  };

  inpCost.addEventListener('input', () => syncAll('cost'));
  selPayType.addEventListener('change', () => syncAll('type'));
  inpAdvAmt.addEventListener('input', () => syncAll('amount'));
  inpAdvPct.addEventListener('input', () => syncAll('pct'));

  // Submit Handler
  $('#dlgForm', dlg).addEventListener('submit', async ev => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const cost = Number(fd.get('basicCost')) || 0;
    const gst = Math.round(cost * 0.18);
    const tot = cost + gst;
    const isFullPay = fd.get('paymentType') === 'Full Payment';
    const advPct = isFullPay ? 100 : (Number(fd.get('advancePct')) || 50);
    const advAmt = isFullPay ? tot : (Number(fd.get('advanceAmount')) || Math.round(tot * 0.5));
    const remAmt = isFullPay ? 0 : Math.max(0, tot - advAmt);

    const payload = {
      no: String(fd.get('no') || '').trim(),
      date: String(fd.get('date') || today()),
      validUntil: String(fd.get('validUntil') || addDays(today(), 30)),
      paymentType: String(fd.get('paymentType') || 'Advance Payment'),
      companyName: String(fd.get('companyName') || '').trim(),
      contactPerson: String(fd.get('contactPerson') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      address: String(fd.get('address') || '').trim(),
      gstin: String(fd.get('gstin') || '').trim(),
      projectName: String(fd.get('projectName') || '').trim(),
      projectId: String(fd.get('projectId') || 'PRJ-001').trim(),
      projectCategory: String(fd.get('projectCategory') || 'Software | Hardware | Industrial Automation').trim(),
      projectDesc: String(fd.get('projectDesc') || '').trim(),
      expectedDelivery: String(fd.get('expectedDelivery') || '30–90 Days').trim(),
      basicCost: cost,
      gstRate: 18,
      gstAmount: gst,
      totalAmount: tot,
      advancePct: advPct,
      advanceAmount: advAmt,
      remainingAmount: remAmt,
      accountHolder: String(fd.get('accountHolder') || 'RvmAiTech Solutions Private Limited').trim(),
      bankName: String(fd.get('bankName') || 'ICICI Bank').trim(),
      accountNo: String(fd.get('accountNo') || '348451000002').trim(),
      ifsc: String(fd.get('ifsc') || 'ICIC0003484').trim(),
      branch: String(fd.get('branch') || 'Mansarovar, Jaipur').trim(),
      upiId: String(fd.get('upiId') || '7052050656@icici').trim(),
      signatoryName: String(fd.get('signatoryName') || 'Vivek Kumar Bhardwaj').trim(),
      signatoryRole: String(fd.get('signatoryRole') || 'CEO / Founder').trim(),
      signDate: String(fd.get('signDate') || today())
    };

    try {
      if (isEdit) {
        await dbUpdate('proformas', existing.id, payload);
        payload.id = existing.id;
        toast('Proforma Invoice updated successfully!', 'good');
      } else {
        const newId = await dbAdd('proformas', payload);
        payload.id = newId;
        toast('Proforma Invoice created successfully!', 'good');
      }
      renderProformaInvoiceModal(payload);
    } catch (err) {
      toast(err.message || 'Could not save Proforma Invoice.', 'bad');
    }
  });

  if (!dlg.open) dlg.showModal();
}

/* ================= Official 8-Section RvmAiTech Proforma Invoice (PI) Modal ================= */
function renderProformaInvoiceModal(pi) {
  dlg.className = 'dlg dlg-doc';
  const D = derive();
  const c = pi.customer || (pi.customerId ? D.cust.get(pi.customerId) : null) || {};

  const docId = pi.id || pi.no || 'pi-001';
  const piNo = pi.no || 'RVM/PI/2026/001';
  const piDate = pi.date || today();
  const validDate = pi.validUntil || addDays(piDate, 30);
  const isFullPayment = String(pi.paymentType || '').toLowerCase().includes('full');
  const payTypeLabel = isFullPayment ? 'Full Payment' : 'Advance Payment';

  // 1. Seller Details
  const sellerCompany = 'RvmAiTech Solutions Private Limited';
  const sellerEmail = 'rvmaitech2026@gmail.com';
  const sellerPhone = '7052050656';
  const sellerGstin = '08AABCR1234F1Z0';
  const sellerAddress = 'Plot No. 42, RIICO Industrial Area, Mansarovar, Jaipur, Rajasthan - 302020';

  // 2. Client Details
  const clientCompany = pi.companyName || c.company || c.name || 'Havells India Manufacturing Plant';
  const contactName = pi.contactPerson || c.contact || c.name || 'Sanjay Rathore';
  const clientEmail = pi.email || c.email || 'sanjay.rathore@havells.com';
  const clientPhone = pi.phone || c.phone || '+91 98290 11014';
  const clientAddress = pi.address || c.address || 'Plot No. 14, Industrial Area, Neemrana, Rajasthan - 301705';
  const clientGstin = pi.gstin || c.gstin || '08AAACH1234F1Z9';

  // 3. Project Details
  const projName = pi.projectName || (pi.items && pi.items[0] && pi.items[0].name) || 'MDMS — Machine Data Management & OEE Cloud Automation';
  const projId = pi.projectId || 'PRJ-001';
  const projCat = pi.projectCategory || 'Software | Hardware | Industrial Automation';
  const projDesc = pi.projectDesc || pi.desc || 'Turnkey industrial IoT automation solution with PLC data acquisition, vibration & temperature sensors, edge gateway sync, and real-time cloud OEE monitoring dashboard.';
  const expDelivery = pi.expectedDelivery || '30–90 Days';

  // 4. Cost Details
  const basicCost = Number(pi.basicCost !== undefined ? pi.basicCost : (pi.items && pi.items.length ? pi.items.reduce((a, it) => a + (Number(it.qty) * Number(it.rate)), 0) : 450000));
  const gstRate = Number(pi.gstRate || 18);
  const gstAmount = Number(pi.gstAmount !== undefined ? pi.gstAmount : Math.round(basicCost * (gstRate / 100)));
  const totalAmount = Number(pi.totalAmount !== undefined ? pi.totalAmount : (basicCost + gstAmount));

  // 5. Payment Type Details
  const advPct = isFullPayment ? 100 : (Number(pi.advancePct !== undefined ? pi.advancePct : 50));
  const advAmount = isFullPayment ? totalAmount : (Number(pi.advanceAmount !== undefined ? pi.advanceAmount : Math.round(totalAmount * (advPct / 100))));
  const remAmount = isFullPayment ? 0 : Math.max(0, totalAmount - advAmount);

  // 6. Bank Details
  const accountHolder = pi.accountHolder || 'RvmAiTech Solutions Private Limited';
  const bankName = pi.bankName || 'ICICI Bank';
  const accountNo = pi.accountNo || '348451000002';
  const ifsc = pi.ifsc || 'ICIC0003484';
  const branch = pi.branch || 'Mansarovar, Jaipur';
  const upiId = pi.upiId || '7052050656@icici';

  // 8. Signatory
  const sigName = pi.signatoryName || 'Vivek Kumar Bhardwaj';
  const sigRole = pi.signatoryRole || 'CEO / Founder';
  const sigDate = pi.signDate || piDate;

  dlg.innerHTML = `
    <!-- Top Action Bar -->
    <div class="dlg-doc-topbar no-print">
      <div>
        <h2 style="margin:0;font-size:17px;font-weight:900;color:#0d2649">Proforma Invoice (PI) · ${esc(piNo)}</h2>
        <p style="margin:2px 0 0;font-size:12px;color:#475569">Type: <b style="color:#0284c7">${esc(payTypeLabel)}</b> · Client: <b>${esc(clientCompany)}</b> · Payable: <b style="color:#059669">${inr(advAmount)}</b></p>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <button type="button" class="btn btn-primary" onclick="printDoc('printableArea')">🖨️ Print A4</button>
        <a href="/api/pdf/proforma/${esc(docId)}" target="_blank" download="Proforma_Invoice_${esc(piNo.replace(/[^a-zA-Z0-9_-]/g, ''))}.pdf" class="btn" style="background:#0284c7;color:#fff;border-color:#0284c7;font-weight:700">📥 Download PDF File</a>
        <button type="button" class="btn" id="btnEmailPiPdf" style="background:#059669;color:#fff;border-color:#059669;font-weight:700">📧 Email PI to Client</button>
        <button type="button" class="btn" id="btnEditPi" style="background:#f59e0b;color:#000;border-color:#f59e0b;font-weight:700">✏️ Edit Details</button>
        <button type="button" class="btn" data-x="cancel">Close</button>
      </div>
    </div>

    <div class="dlg-doc-scroll">
      ${renderDocLifecycleNav('pi', docId, null, { name: contactName, company: clientCompany, email: clientEmail })}

      <!-- Printable A4 Proforma Invoice Sheet (Matches Exact 8-Section RvmAiTech Template) -->
      <div id="printableArea" class="pi-proj-sheet a4-page">
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:2px solid #0284c7;margin-bottom:12px">
          <div>
            <img src="/logo-light.png?v=20261115" alt="RvmAiTech" style="height:44px;width:auto;max-width:180px;object-fit:contain;display:block;margin-bottom:4px">
            <div style="font-size:8.5px;font-weight:900;letter-spacing:.06em;color:#0284c7;text-transform:uppercase">SOFTWARE | HARDWARE | INDUSTRIAL AUTOMATION</div>
          </div>
          <div style="text-align:right">
            <div style="background:#0284c7;color:#ffffff;font-size:12px;font-weight:900;padding:4px 14px;border-radius:4px;display:inline-block;letter-spacing:.05em;margin-bottom:6px">PROFORMA INVOICE (PI)</div>
            <div style="font-size:11px;color:#0f172a;line-height:1.4">
              <b>PI Number:</b> <span class="mono" style="font-weight:800;color:#0284c7">${esc(piNo)}</span><br>
              <b>PI Date:</b> ${fmtDate(piDate)}<br>
              <b>Valid Until:</b> ${fmtDate(validDate)}<br>
              <b>Payment Type:</b> <span style="font-weight:800;color:${isFullPayment ? '#10b981' : '#0284c7'}">${esc(payTypeLabel)}</span>
            </div>
          </div>
        </div>

        <!-- 1. SELLER DETAILS -->
        <div class="pi-sec-banner">1. SELLER DETAILS</div>
        <div class="qtn-sec-box">
          <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:12px">
            <div>
              <div><b>Company Name:</b> ${esc(sellerCompany)}</div>
              <div style="margin-top:3px"><b>Email:</b> ${esc(sellerEmail)}</div>
              <div style="margin-top:3px"><b>WhatsApp:</b> ${esc(sellerPhone)}</div>
            </div>
            <div>
              <div><b>GSTIN:</b> <span class="mono">${esc(sellerGstin)}</span></div>
              <div style="margin-top:3px"><b>Business Address:</b> ${esc(sellerAddress)}</div>
            </div>
          </div>
        </div>

        <!-- 2. CLIENT DETAILS -->
        <div class="pi-sec-banner">2. CLIENT DETAILS</div>
        <div class="qtn-sec-box">
          <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:12px">
            <div>
              <div><b>Client / Company Name:</b> ${esc(clientCompany)}</div>
              <div style="margin-top:3px"><b>Contact Person:</b> ${esc(contactName)}</div>
              <div style="margin-top:3px"><b>Email:</b> ${esc(clientEmail)}</div>
            </div>
            <div>
              <div><b>Phone:</b> ${esc(clientPhone)}</div>
              <div style="margin-top:3px"><b>Billing Address:</b> ${esc(clientAddress)}</div>
              <div style="margin-top:3px"><b>GSTIN:</b> <span class="mono">${esc(clientGstin || 'Unregistered / Not applicable')}</span></div>
            </div>
          </div>
        </div>

        <!-- 3. PROJECT DETAILS -->
        <div class="pi-sec-banner">3. PROJECT DETAILS</div>
        <div class="qtn-sec-box">
          <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:12px;margin-bottom:6px">
            <div><b>Project Name:</b> <span style="font-size:12px;font-weight:800;color:#0d2649">${esc(projName)}</span></div>
            <div><b>Project ID:</b> <span class="mono" style="font-weight:800">${esc(projId)}</span></div>
          </div>
          <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:12px;margin-bottom:6px">
            <div><b>Project Category:</b> <span style="font-weight:700;color:#0284c7">${esc(projCat)}</span></div>
            <div><b>Expected Delivery:</b> <b>${esc(expDelivery)}</b></div>
          </div>
          <div><b>Project Description:</b><br><span style="color:#334155;white-space:pre-line">${esc(projDesc)}</span></div>
        </div>

        <!-- 4. PROJECT PAYMENT DETAILS -->
        <div class="pi-sec-banner">4. PROJECT PAYMENT DETAILS</div>
        <table class="qtn-table-est">
          <thead>
            <tr>
              <th style="background:#0284c7">Description</th>
              <th style="width:140px;text-align:right;background:#0284c7">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><b>Basic Project Cost</b></td>
              <td style="text-align:right;font-weight:700" class="mono">${inr(basicCost)}</td>
            </tr>
            <tr>
              <td>GST @ ${gstRate}%</td>
              <td style="text-align:right" class="mono">${inr(gstAmount)}</td>
            </tr>
            <tr style="background:#f0f9ff;border-top:1.5px solid #0284c7;border-bottom:1.5px solid #0284c7">
              <td style="font-size:12px;font-weight:900;color:#0d2649">Total Project Value</td>
              <td style="text-align:right;font-size:13px;font-weight:900;color:#0284c7" class="mono">${inr(totalAmount)}</td>
            </tr>
          </tbody>
        </table>

        <!-- 5. PAYMENT TYPE – SELECT ONE -->
        <div class="pi-sec-banner">5. PAYMENT TYPE – SELECT ONE</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:14px;margin-bottom:10px;width:100%;box-sizing:border-box">
          <!-- Option A Card -->
          <div class="pi-opt-card ${!isFullPayment ? 'active' : ''}" style="box-sizing:border-box;min-width:0">
            <div style="font-size:11px;font-weight:900;color:${!isFullPayment ? '#0284c7' : '#64748b'};margin-bottom:6px">
              ${!isFullPayment ? '● OPTION A: ADVANCE PAYMENT (SELECTED)' : '○ OPTION A: ADVANCE PAYMENT'}
            </div>
            <div>Total Project Value: <b class="mono">${inr(totalAmount)}</b></div>
            <div>Advance Percentage: <b style="color:#0284c7">${advPct}%</b></div>
            <div style="font-size:12px;font-weight:800;color:#059669;margin-top:2px">Advance Amount: <span class="mono">${inr(advAmount)}</span></div>
            <div style="margin-top:2px">Remaining Amount: <span class="mono">${inr(remAmount)}</span></div>
            <div style="font-size:10px;color:#64748b;margin-top:4px"><b>Payment Due:</b> As per agreed advance payment terms.</div>
          </div>

          <!-- Option B Card -->
          <div class="pi-opt-card ${isFullPayment ? 'active' : ''}" style="box-sizing:border-box;min-width:0">
            <div style="font-size:11px;font-weight:900;color:${isFullPayment ? '#0284c7' : '#64748b'};margin-bottom:6px">
              ${isFullPayment ? '● OPTION B: FULL PAYMENT (SELECTED)' : '○ OPTION B: FULL PAYMENT'}
            </div>
            <div>Total Project Value: <b class="mono">${inr(totalAmount)}</b></div>
            <div>Payment Percentage: <b style="color:#10b981">100%</b></div>
            <div style="font-size:12px;font-weight:800;color:#059669;margin-top:2px">Total Payable Amount: <span class="mono">${inr(totalAmount)}</span></div>
            <div style="margin-top:2px">Remaining Amount: <span class="mono">INR 0</span></div>
            <div style="font-size:10px;color:#64748b;margin-top:4px"><b>Payment Due:</b> Full payment before project commencement.</div>
          </div>
        </div>

        <!-- 6. BANK / PAYMENT DETAILS -->
        <div class="pi-sec-banner">6. BANK / PAYMENT DETAILS</div>
        <div class="qtn-sec-box">
          <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:12px">
            <div>
              <div><b>Account Holder Name:</b> ${esc(accountHolder)}</div>
              <div style="margin-top:3px"><b>Bank Name:</b> ${esc(bankName)}</div>
              <div style="margin-top:3px"><b>Account Number:</b> <span class="mono" style="font-weight:800">${esc(accountNo)}</span></div>
            </div>
            <div>
              <div><b>IFSC Code:</b> <span class="mono" style="font-weight:800">${esc(ifsc)}</span></div>
              <div style="margin-top:3px"><b>Branch:</b> ${esc(branch)}</div>
              <div style="margin-top:3px"><b>UPI ID:</b> <span class="mono" style="font-weight:800;color:#0284c7">${esc(upiId)}</span></div>
            </div>
          </div>
        </div>

        <!-- 7. PAYMENT TERMS & CONDITIONS -->
        <div class="pi-sec-banner">7. PAYMENT TERMS &amp; CONDITIONS</div>
        <div class="qtn-sec-box" style="font-size:10.5px;line-height:1.5">
          • This document is a Proforma Invoice and payment request, not a final Tax Invoice.<br>
          • Project work will commence after written approval, required project inputs and receipt of the agreed payment.<br>
          • For advance payment, the remaining balance will be payable according to the approved payment schedule.<br>
          • For full payment, the entire quoted amount must be received before project commencement.<br>
          • Any additional features or changes outside the approved scope will be charged separately.<br>
          • Project delivery is estimated between 30 and 90 days, depending on project complexity and approved scope.<br>
          • GST and tax invoices will be handled according to applicable Indian GST regulations.<br>
          • Payment confirmation will be shared after the amount is credited to the company's bank account.
        </div>

        <!-- 8. AUTHORIZATION -->
        <div class="pi-sec-banner">8. AUTHORIZATION</div>
        <div class="qtn-accept-grid">
          <div class="qtn-accept-box">
            <div style="font-weight:900;color:#0284c7;border-bottom:1px solid #cbd5e1;padding-bottom:3px;margin-bottom:6px">For RvmAiTech</div>
            <div>Authorized Signatory: ______________________</div>
            <div>Name: <b>${esc(sigName)}</b></div>
            <div>Designation: <b>${esc(sigRole)}</b></div>
            <div>Date: <b>${fmtDate(sigDate)}</b></div>
          </div>
          <div class="qtn-accept-box">
            <div style="font-weight:900;color:#0284c7;border-bottom:1px solid #cbd5e1;padding-bottom:3px;margin-bottom:6px">Client Payment Confirmation</div>
            <div>Client Name: ______________________</div>
            <div>Company Name: <b>${esc(clientCompany)}</b></div>
            <div>Signature &amp; Stamp: ______________________</div>
          </div>
        </div>

        <!-- Footer -->
        <div style="margin-top:14px;border-top:1px solid #cbd5e1;padding-top:8px;text-align:center;font-size:10px;color:#64748b;line-height:1.5">
          <b>RvmAiTech</b> · Email: <a href="mailto:rvmaitech2026@gmail.com" style="color:#0284c7">rvmaitech2026@gmail.com</a> · WhatsApp: <b>7052050656</b><br>
          <i>Smart Solutions. Intelligent Automation. Reliable Technology.</i>
        </div>
      </div>
    </div>
  `;

  // Edit details button
  const btnEdit = $('#btnEditPi', dlg);
  if (btnEdit) {
    btnEdit.addEventListener('click', () => {
      openProformaInvoiceForm(pi);
    });
  }

  // Email PDF button
  const btnEmail = $('#btnEmailPiPdf', dlg);
  if (btnEmail) {
    btnEmail.onclick = async () => {
      btnEmail.disabled = true; btnEmail.textContent = 'Sending PDF...';
      try {
        const res = await api('POST', `/api/erp/proformas/${encodeURIComponent(docId)}/send-email`);
        toast(res.sentLive ? `Proforma Invoice PDF emailed to ${clientEmail}!` : `Proforma Invoice PDF prepared & logged to Outbox!`, 'good');
        btnEmail.textContent = 'Sent ✓';
        showEmailDispatchModal({ docType: 'Proforma Invoice (PI)', docNo: piNo, clientEmail, res });
      } catch (err) {
        toast(err.message || 'Could not send proforma invoice email.', 'bad');
        btnEmail.disabled = false; btnEmail.textContent = '📧 Email PI to Client';
      }
    };
  }

  if (!dlg.open) dlg.showModal();
}

/* ================= Official Advance Payment Receipt Voucher (Image 4 Advance Payment Invoice Format) ================= */
function renderAdvanceReceiptModal(payment, invoice) {
  dlg.className = 'dlg dlg-doc';
  const D = derive();
  const c = (invoice && D.cust.get(invoice.customerId)) || { name: 'BTS Technology (RAHUL)', company: 'BTS Technology', gstin: '08AAACI4441C1ZX', address: 'Plot 102, RIICO Tech Zone, Mansarovar, Jaipur' };
  const amt = payment ? payment.amount : (invoice ? invoice.paid : 50000);
  const recNo = 'ADV-' + (invoice ? String(invoice.no).replace('INV-', '') : '2026-0003');
  const docId = invoice ? invoice.id : '';

  dlg.innerHTML = `
    <!-- Top Action Bar -->
    <div class="dlg-doc-topbar no-print">
      <div>
        <h2 style="margin:0;font-size:17px;font-weight:900;color:#0d2649">Advance Payment Receipt Voucher · ${esc(recNo)}</h2>
        <p style="margin:2px 0 0;font-size:12px;color:#475569">Stage: <b>3. Advance मिलने पर (Advance Payment Receipt)</b> · Received: <b style="color:#059669">${inr(amt)}</b></p>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <button type="button" class="btn btn-primary" onclick="printDoc('printableArea')">🖨️ Print A4</button>
        <a href="/api/pdf/receipt/${esc(docId || 'REC')}" target="_blank" download="Advance_Receipt_${esc(recNo)}.pdf" class="btn" style="background:#0284c7;color:#fff;border-color:#0284c7;font-weight:700">📥 Download PDF File</a>
        <button type="button" class="btn" id="btnEmailAdvRec" style="background:#0284c7;color:#fff;border-color:#0284c7;font-weight:700">📧 Email Receipt to Client</button>
        ${invoice ? `<button type="button" class="btn" data-action="nav-invoice" data-id="${esc(invoice.id)}" style="background:#059669;color:#fff;border-color:#059669;font-weight:700">🚚 4. Dispatch &amp; Delivery Challan</button>` : ''}
        <button type="button" class="btn" data-x="cancel">Close</button>
      </div>
    </div>

    <div class="dlg-doc-scroll">
      ${renderDocLifecycleNav('receipt', docId, invoice, c)}

      <!-- Printable A4 Advance Payment Receipt Sheet (Matches Image 4 FO Layout) -->
      <div id="printableArea" class="a4-page" style="padding:22px 28px;border:2px solid #059669">
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:2px solid #059669;margin-bottom:14px">
          <div style="display:flex;align-items:flex-start;gap:14px">
            <img src="/logo-light.png?v=20261115" alt="RvmAiTech" style="height:44px;width:auto;max-width:180px;object-fit:contain;display:block">
            <div>
              <div style="font-family:'Space Grotesk',sans-serif;font-size:16px;font-weight:900;color:#0d2649">RvmAiTech Solutions Private Limited</div>
              <div style="font-size:11px;color:#334155;margin-top:2px">Plot No. 42, RIICO Industrial Area, Mansarovar, Jaipur - 302020</div>
              <div style="font-size:10.5px;color:#475569">GSTIN: 08AABCR1234F1Z0 · CIN: U72900RJ2021PTC078942 · PAN: AAACE0836F</div>
            </div>
          </div>
          <div style="text-align:right">
            <h1 style="font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:900;letter-spacing:.04em;color:#059669;margin:0 0 4px">ADVANCE PAYMENT INVOICE / RECEIPT</h1>
            <div style="font-size:11.5px;color:#334155;line-height:1.4">
              <b>Receipt No:</b> <span class="mono" style="font-weight:800;color:#000">${esc(recNo)}</span><br>
              <b>Date of Credit:</b> ${fmtDate(payment ? payment.date : (invoice ? invoice.date : today()))}<br>
              <b>Status:</b> <span style="font-weight:900;color:#059669">CREDITED &amp; VERIFIED</span>
            </div>
          </div>
        </div>

        <!-- Supplier vs Customer Grid (Matches Image 4) -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px">
          <div style="border:1px solid #cbd5e1;border-radius:6px;padding:10px 14px;background:#f8fafc">
            <div style="font-size:11px;font-weight:900;color:#0284c7;text-transform:uppercase;margin-bottom:3px">SUPPLIER (Payee):</div>
            <div style="font-weight:800;color:#0f172a">RvmAiTech Solutions Private Limited</div>
            <div style="font-size:11px;color:#475569;margin-top:2px;line-height:1.4">
              Plot No. 42, RIICO Industrial Area, Mansarovar, Jaipur - 302020<br>
              <b>GSTIN/UIN:</b> 08AABCR1234F1Z0 · State: Rajasthan (08)
            </div>
          </div>
          <div style="border:1px solid #cbd5e1;border-radius:6px;padding:10px 14px;background:#f8fafc">
            <div style="font-size:11px;font-weight:900;color:#0284c7;text-transform:uppercase;margin-bottom:3px">CUSTOMER (Payer):</div>
            <div style="font-weight:800;color:#0f172a">${esc(c.company || c.name)}</div>
            <div style="font-size:11px;color:#475569;margin-top:2px;line-height:1.4">
              ${c.address ? esc(c.address) + '<br>' : ''}
              <b>GSTIN/UIN:</b> ${esc(c.gstin || '08AAACI4441C1ZX')} · <b>Phone:</b> ${esc(c.phone || '+91 7052050656')}
            </div>
          </div>
        </div>

        <!-- Payment Info Banner (Image 4 Blue Ribbon) -->
        <div style="background:#0284c7;color:#fff;border-radius:6px;padding:12px 18px;display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:14px;align-items:center;margin-bottom:16px">
          <div>
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;opacity:0.85">Payment Method:</div>
            <div style="font-size:14px;font-weight:900">${esc(payment ? payment.mode : 'UPI / QR Code (7052050656)')}</div>
          </div>
          <div>
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;opacity:0.85">Bank Ref / UTR / Cheque:</div>
            <div style="font-size:13px;font-weight:800" class="mono">${esc(payment ? payment.ref : '2551540')}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;opacity:0.85">Amount Credited:</div>
            <div style="font-size:17px;font-weight:900" class="mono">${inr(amt)}</div>
          </div>
        </div>

        <!-- Receipt Particulars Table -->
        <table class="quote-tbl" style="margin-bottom:14px">
          <thead>
            <tr>
              <th style="width:40px;text-align:center">#</th>
              <th>Description of Goods / Automation Project</th>
              <th style="width:120px;text-align:right">Total Order Value</th>
              <th style="width:130px;text-align:right">Advance Paid (Credited)</th>
              <th style="width:130px;text-align:right">Balance Due on Delivery</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align:center">1</td>
              <td>
                <div style="font-weight:800;font-size:12.5px;color:#0f172a">
                  ${invoice && invoice.items && invoice.items[0] ? esc(invoice.items[0].name) : 'SMART PARKING SYSTEM (Turnkey Supply &amp; Calibration)'}
                </div>
                <div style="font-size:10.5px;color:#059669;font-weight:700">Advance Deposit Verified &amp; Bank Reconciled</div>
              </td>
              <td style="text-align:right" class="mono">${inr(invoice ? invoice.total : amt * 2)}</td>
              <td style="text-align:right;font-weight:900;color:#059669" class="mono">${inr(amt)}</td>
              <td style="text-align:right;font-weight:900;color:#dc2626" class="mono">${inr(invoice ? balanceOf(invoice) : amt)}</td>
            </tr>
          </tbody>
        </table>

        <!-- In Words & Stamp -->
        <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:16px;border-top:1.5px solid #059669;padding-top:12px;margin-bottom:14px">
          <div>
            <div style="font-size:11.5px;color:#000;margin-bottom:6px">
              <b>Amount Received (in words):</b><br>
              <span style="font-size:13px;font-weight:900;color:#059669">${esc(inrWords(amt))}</span>
            </div>
            <div style="font-size:11px;color:#475569;line-height:1.4">
              <b>Reference Invoice:</b> ${esc(invoice ? invoice.no : 'INV-2026-0003')}<br>
              This voucher acknowledges receipt of advance payment. Final Tax Invoice and Material Out Delivery Challan are prepared for dispatch.
            </div>
          </div>
          <div style="text-align:right">
            <div style="display:inline-block;border:2px dashed #059669;background:#f0fdf4;border-radius:6px;padding:8px 14px;text-align:center;margin-bottom:8px">
              <div style="font-size:12px;font-weight:900;color:#059669;letter-spacing:.05em">✅ OFFICIAL ADVANCE RECEIPT</div>
              <div style="font-size:10px;color:#166534">50% Advance Credited &amp; Reconciled</div>
            </div>
            <div style="font-size:11px;font-weight:800;color:#0d2649">for RvmAiTech Solutions Private Limited</div>
            <div style="margin-top:20px;font-size:12px;font-weight:900;color:#000">Vivek Kumar Bhardwaj</div>
            <div style="font-size:10px;color:#475569">Authorised Signatory / Accounts Desk</div>
          </div>
        </div>
      </div>
    </div>
  `;

  $('#btnEmailAdvRec', dlg).addEventListener('click', () => {
    closeDlg();
    openCrmEmailModal(c.email || 'client@btstech.in', c.name || 'Client', null, null);
  });

  const btnEmailInv = $('#btnEmailInvoicePdf', dlg);
  if (btnEmailInv) {
    btnEmailInv.onclick = async () => {
      btnEmailInv.disabled = true; btnEmailInv.textContent = 'Sending PDF...';
      try {
        const res = await api('POST', `/api/erp/invoices/${encodeURIComponent(i.id)}/send-email`);
        toast(res.sentLive ? `Invoice PDF emailed to ${c.email}!` : `Invoice PDF email prepared & logged to Outbox!`, 'good');
        btnEmailInv.textContent = 'Sent ✓';
      } catch (err) {
        toast(err.message || 'Could not send invoice email.', 'bad');
        btnEmailInv.disabled = false; btnEmailInv.textContent = '📧 Email PDF to Client';
      }
    };
  }

  if (!dlg.open) dlg.showModal();
}

/* ================= Record Payment on Existing Invoice ================= */
ACT['inv-pay'] = el => {
  const i = S.invoices.find(x => x.id === el.dataset.id); if (!i) return;
  const bal = balanceOf(i);
  closeDlg();
  
  dlg.className = 'dlg';
  dlg.innerHTML = `
    <form class="form" id="payRecordForm">
      <h2 class="dlg-title">Record Payment for ${esc(i.no)}</h2>
      <p class="dlg-sub">Total: <b>${inr(i.total)}</b> · Paid: <b>${inr(i.paid)}</b> · Current Balance Due: <b style="color:var(--bad)">${inr(bal)}</b></p>
      
      <div style="display:flex;gap:8px;margin:10px 0">
        <button type="button" class="btn btn-sm" id="btnPay50">⚡ Pay 50% Balance (${inr(Math.round(bal * 0.5))})</button>
        <button type="button" class="btn btn-sm btn-primary" id="btnPayFull">⚡ Pay Full Balance (${inr(bal)})</button>
      </div>

      <div class="fields">
        <div class="field">
          <label class="lbl">Amount Received (₹) *</label>
          <input type="number" name="amount" id="payAmountInput" class="input" min="1" max="${bal}" step="any" value="${bal}" required>
        </div>
        <div class="field">
          <label class="lbl">Payment Date</label>
          <input type="date" name="date" class="input" value="${today()}" required>
        </div>
        <div class="field">
          <label class="lbl">Payment Mode</label>
          <select name="mode" class="input">
            <option value="UPI / QR Code (7052050656)">UPI / QR Code (7052050656)</option>
            <option value="Bank Transfer (NEFT/RTGS)">Bank Transfer (NEFT/RTGS)</option>
            <option value="Cheque / Demand Draft">Cheque / Demand Draft</option>
            <option value="Cash Receipt">Cash Receipt</option>
          </select>
        </div>
        <div class="field">
          <label class="lbl">Transaction / UTR / Cheque Ref</label>
          <input type="text" name="ref" class="input" placeholder="e.g. UTR-2551540">
        </div>
      </div>
      <div class="field" style="margin-top:10px">
        <label class="lbl">Payment Note</label>
        <input type="text" name="note" class="input" value="${bal <= i.total * 0.5 ? 'Balance Settlement' : 'Part Payment Received'}">
      </div>

      <div class="dlg-actions" style="margin-top:16px">
        <button type="button" class="btn" data-x="cancel">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Payment Entry</button>
      </div>
    </form>`;

  $('#btnPay50', dlg).addEventListener('click', () => {
    $('#payAmountInput', dlg).value = Math.round(bal * 0.5);
  });
  $('#btnPayFull', dlg).addEventListener('click', () => {
    $('#payAmountInput', dlg).value = bal;
  });

  $('#payRecordForm', dlg).addEventListener('submit', async ev => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const amt = Number(fd.get('amount'));
    if (amt <= 0 || amt > bal + 0.5) return toast(`Enter an amount between ₹1 and ${inr(bal)}`, 'bad');

    await api('POST', `/api/invoices/${encodeURIComponent(i.id)}/payment`, {
      amount: amt,
      date: fd.get('date'),
      mode: fd.get('mode'),
      ref: fd.get('ref'),
      note: fd.get('note')
    });
    closeDlg();
    toast(`Payment of ${inr(amt)} recorded for ${i.no}`, 'good');
    await refresh();
    const updated = S.invoices.find(x => x.id === i.id);
    if (updated) {
      const p = (updated.payments && updated.payments[updated.payments.length - 1]) || { date: today(), amount: amt, mode: fd.get('mode'), ref: fd.get('ref') };
      renderAdvanceReceiptModal(p, updated);
    }
  });

  dlg.showModal();
};

ACT['inv-del'] = async el => {
  const i = S.invoices.find(x => x.id === el.dataset.id); if (!i) return;
  if (await confirmBox('Delete invoice?', `${i.no} for ${inr(i.total)} will be deleted and its items go back into stock.`)) save(() => dbDelete('invoices', i.id), 'Invoice deleted');
};

/* ================= ERP: purchases ================= */
V['erp-purchases'] = D => {
  const q = query('erp-purchases');
  const rows = S.purchases.filter(p => matches(q, p.no, p.vendor, (D.prod.get(p.productId) || {}).name))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.no).localeCompare(String(a.no)));
  const pendingAmt = sum(S.purchases.filter(p => p.status !== 'Received'), p => num(p.qty) * num(p.cost));
  const body = rows.map(p => {
    const pr = D.prod.get(p.productId), got = p.status === 'Received';
    const tot = num(p.qty) * num(p.cost);
    const linkedInv = S.invoices.find(i => i.poNo === p.no || i.buyerPo === p.no || i.purchaseId === p.id);
    return `<tr>
      <td class="mono nowrap"><button class="link-btn" data-action="po-view" data-id="${esc(p.id)}"><b>${esc(p.no)}</b></button></td>
      <td class="nowrap">${fmtDate(p.date)}</td>
      <td><b>${esc(p.vendor)}</b></td>
      <td>${esc(pr ? pr.name : 'Product')}</td>
      <td class="num">${qty(p.qty)}</td>
      <td class="num font-bold">${inr(p.cost)}</td>
      <td class="num font-bold" style="color:#38bdf8">${inr(tot)}</td>
      <td>
        ${stamp(got ? 'Received' : 'On order', got ? 'good' : 'warn')}
        ${linkedInv ? `<div style="margin-top:3px"><span class="stamp stamp-good" style="font-size:10.5px">Bill: ${esc(linkedInv.no)}</span></div>` : ''}
      </td>
      <td class="acts" style="white-space:nowrap;text-align:right">
        <button class="btn btn-sm btn-primary" data-action="po-view" data-id="${esc(p.id)}" title="View A4 Purchase Order">📄 View PO</button>
        ${linkedInv ? `
          <button class="btn btn-sm btn-good" data-action="inv-view" data-id="${esc(linkedInv.id)}" title="View Generated Tax Invoice / Bill" style="background:#059669;color:#fff;border-color:#059669;font-weight:700">🧾 View Bill (${esc(linkedInv.no)})</button>
        ` : `
          <button class="btn btn-sm" data-action="po-gen-bill" data-id="${esc(p.id)}" title="Generate Sales Tax Invoice / Bill for this PO" style="background:#d97706;border-color:#d97706;color:#fff;font-weight:700">⚡ Generate Bill</button>
        `}
        <button class="btn btn-sm" data-action="po-email" data-id="${esc(p.id)}" style="background:#0284c7;color:#fff;border-color:#0284c7;font-weight:700" title="Send PO / Bill via Email">📧 Email</button>
        ${got ? '' : `<button class="btn btn-sm" data-action="po-receive" data-id="${esc(p.id)}">Receive</button>`}
        <button class="btn btn-sm btn-outline danger" data-action="po-del" data-id="${esc(p.id)}" title="Delete PO">🗑️</button>
      </td>
    </tr>`;
  });
  return head('ERP', 'Purchases & Purchase Orders', `<b>${S.purchases.filter(p => p.status !== 'Received').length}</b> on order worth <b>${inr(pendingAmt)}</b> · Total PO value: <b>${inr(sum(S.purchases, p => num(p.qty) * num(p.cost)))}</b>`,
      W('erp', '<button class="btn btn-primary" data-action="po-new">New purchase order</button>'))
    + `<div class="toolbar">${searchBox('erp-purchases', 'Search PO no., vendor or product')}</div>`
    + (S.purchases.length === 0 ? empty('No purchases yet', 'Record what you order from vendors. Stock goes up when you mark an order as received, and generate bills in 1-click.', W('erp', '<button class="btn btn-primary" data-action="po-new">New purchase order</button>'))
      : rows.length === 0 ? empty('Nothing matches', 'Try a different search.')
      : table(['PO', 'Date', 'Vendor', 'Product', { n: 'Qty' }, { n: 'Rate' }, { n: 'Amount' }, 'Status', ''], body));
};

ACT['po-new'] = el => {
  if (!S.products.length) return toast('Add a product first, under ERP › Inventory.', 'warn');
  const pre = el.dataset.product ? S.products.find(p => p.id === el.dataset.product) : null;
  const no = nextNo('PO-', S.purchases, 'no', 4);
  openForm({
    title: 'New purchase order', sub: no, submit: 'Save order',
    fields: [
      { name: 'vendor', label: 'Vendor', required: true },
      { name: 'date', label: 'Order date', type: 'date', required: true, value: today() },
      { name: 'productId', label: 'Product', type: 'select', required: true, placeholder: 'Choose a product', full: true, options: S.products.slice().sort(byName).map(p => ({ value: p.id, label: `${p.name} (${p.sku})` })) },
      { name: 'qty', label: 'Quantity', type: 'number', min: 1, step: 'any', required: true },
      { name: 'cost', label: 'Rate per unit (₹)', type: 'number', min: 0, step: 'any', required: true, hint: 'Leave 0 to use the product cost price.' },
      { name: 'status', label: 'Status', type: 'select', options: [{ value: 'Ordered', label: 'On order' }, { value: 'Received', label: 'Already received' }] }
    ],
    values: pre ? { productId: pre.id, cost: pre.cost } : { cost: 0 },
    onSubmit: v => {
      if (v.qty <= 0) throw new UserError('Quantity must be above zero.');
      const p = S.products.find(x => x.id === v.productId);
      if (!v.cost && p) v.cost = num(p.cost);
      return dbAdd('purchases', Object.assign(v, { no, createdAt: Date.now() })).then(id => {
        toast(`${no} saved`);
        setTimeout(() => {
          const created = S.purchases.find(x => x.no === no || x.id === id);
          if (created) renderPurchaseOrderModal(created);
        }, 350);
      });
    }
  });
};

ACT['po-receive'] = el => { const p = S.purchases.find(x => x.id === el.dataset.id); if (p) save(() => dbUpdate('purchases', p.id, { status: 'Received', receivedOn: today() }), `${p.no} received. Stock updated.`); };
ACT['po-del'] = async el => {
  const p = S.purchases.find(x => x.id === el.dataset.id); if (!p) return;
  if (await confirmBox('Delete purchase order?', `${p.no} from ${p.vendor} will be deleted.${p.status === 'Received' ? ' Its quantity will be taken back out of stock.' : ''}`)) save(() => dbDelete('purchases', p.id), 'Purchase order deleted');
};

/* ================= Official Purchase Order (Image 2 PO Template Format) ================= */
function renderPurchaseOrderModal(p) {
  dlg.className = 'dlg dlg-doc';
  const D = derive();
  const pr = D.prod.get(p.productId) || { name: 'Smart Parking System', sku: 'SPS-2026', unit: 'NOS' };
  const tot = num(p.qty) * num(p.cost);
  const isGot = p.status === 'Received';
  const docId = p.id || '';
  const linkedInv = S.invoices.find(i => i.poNo === p.no || i.buyerPo === p.no || i.purchaseId === p.id);

  dlg.innerHTML = `
    <!-- Top Action Bar -->
    <div class="dlg-doc-topbar no-print">
      <div>
        <h2 style="margin:0;font-size:17px;font-weight:900;color:#0d2649">Purchase Order (PO) · ${esc(p.no)}</h2>
        <span class="stamp stamp-${isGot ? 'good' : 'warn'}">${esc(isGot ? 'Received' : 'On order')}</span>
        ${linkedInv ? `<span class="stamp stamp-good" style="margin-left:6px">Bill: ${esc(linkedInv.no)}</span>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <button type="button" class="btn btn-primary" onclick="printDoc('printableArea')">🖨️ Print A4</button>
        <a href="/api/pdf/purchase-order/${esc(p.id)}" target="_blank" download="Purchase_Order_${esc(p.no)}.pdf" class="btn" style="background:#0284c7;color:#fff;border-color:#0284c7;font-weight:700">📥 Download PDF File</a>
        <button type="button" class="btn" id="btnPoEmail" style="background:#059669;color:#fff;border-color:#059669;font-weight:700">📧 Send PO PDF to Vendor</button>
        ${linkedInv ? `
          <button type="button" class="btn" data-action="inv-view" data-id="${esc(linkedInv.id)}" style="background:#059669;color:#fff;border-color:#059669;font-weight:800">🧾 View Linked Bill (${esc(linkedInv.no)})</button>
        ` : `
          <button type="button" class="btn" id="btnPoGenBill" style="background:#d97706;color:#fff;border-color:#d97706;font-weight:800">⚡ Generate Bill / Tax Invoice</button>
        `}
        ${!isGot && can('erp') ? `<button type="button" class="btn btn-primary" data-action="po-receive" data-id="${esc(p.id)}">Mark received</button>` : ''}
        <button type="button" class="btn" data-x="cancel">Close</button>
      </div>
    </div>

    <div class="dlg-doc-scroll">
      ${renderDocLifecycleNav('po', docId, null, null)}

      <!-- Printable A4 Purchase Order Sheet (Matches Image 2 PO Template) -->
      <div id="printableArea" class="a4-page" style="padding:22px 28px;border:1.5px solid #0f172a">
        <!-- Document Title -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:2px solid #0f172a;margin-bottom:14px">
          <div>
            <h1 style="font-family:'Space Grotesk',sans-serif;font-size:26px;font-weight:900;letter-spacing:.04em;color:#0d2649;margin:0 0 4px">Purchase Order</h1>
            <div style="font-size:11.5px;color:#334155;line-height:1.4">
              <b>PO no.</b> <span class="mono" style="font-weight:800;color:#000">${esc(p.no)}</span><br>
              <b>PO date:</b> ${fmtDate(p.date)}<br>
              <b>Status:</b> <span style="font-weight:800;color:${isGot ? '#059669' : '#d97706'}">${esc(p.status)}</span>
            </div>
          </div>
          <div style="text-align:right">
            <img src="/logo-light.png?v=20261115" alt="RvmAiTech" style="height:44px;width:auto;max-width:180px;object-fit:contain;display:inline-block;margin-bottom:4px">
            <div style="font-size:11px;color:#334155;line-height:1.4">
              <b>Buyer: RvmAiTech Solutions Pvt Ltd</b><br>
              Plot No. 42, RIICO Ind. Area, Mansarovar, Jaipur<br>
              <b>GSTIN:</b> 08AABCR1234F1Z0 · <b>PAN:</b> AAACE0836F
            </div>
          </div>
        </div>

        <!-- Supplier Name vs Buyer Name Grid (Matches Image 2) -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:10px 14px;margin-bottom:14px">
          <div>
            <div style="font-size:10.5px;font-weight:900;text-transform:uppercase;color:#0d2649;letter-spacing:.05em;margin-bottom:3px">Supplier Name &amp; Address:</div>
            <div style="font-size:13px;font-weight:900;color:#0f172a">${esc(p.vendor)}</div>
            <div style="font-size:11px;color:#475569;margin-top:2px;line-height:1.45">
              Industrial Automation Supplier &amp; Component Partner<br>
              <b>Attn:</b> Order Fulfillment &amp; Dispatch Desk
            </div>
          </div>
          <div>
            <div style="font-size:10.5px;font-weight:900;text-transform:uppercase;color:#0d2649;letter-spacing:.05em;margin-bottom:3px">Buyer Name &amp; Delivery Address:</div>
            <div style="font-size:13px;font-weight:900;color:#0f172a">RvmAiTech Solutions Private Limited</div>
            <div style="font-size:11px;color:#475569;margin-top:2px;line-height:1.45">
              Plot No. 42, RIICO Industrial Area, Mansarovar, Jaipur - 302020<br>
              <b>Contact:</b> +91 7052050656 · <b>Attn:</b> Technology &amp; Operations Dept
            </div>
          </div>
        </div>

        <!-- Items Table (Quantity | Description | Unit Price | Amount) -->
        <table class="quote-tbl" style="margin-bottom:14px">
          <thead>
            <tr>
              <th style="width:70px;text-align:center">Quantity</th>
              <th>Description</th>
              <th style="width:120px;text-align:right">Unit Price (₹)</th>
              <th style="width:130px;text-align:right">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align:center;font-weight:900;font-size:13px">${qty(p.qty)} ${esc(pr.unit || 'NOS')}</td>
              <td>
                <div style="font-weight:800;font-size:13px;color:#0f172a">${esc(pr.name)}</div>
                <div style="font-size:10.5px;color:#64748b">SKU: ${esc(pr.sku || 'SPS-2026')} · Industrial Grade Specification</div>
              </td>
              <td style="text-align:right" class="mono">${inr(p.cost)}</td>
              <td style="text-align:right;font-weight:900;font-size:13px" class="mono">${inr(tot)}</td>
            </tr>
          </tbody>
        </table>

        <!-- Total, Delivery Date & Payment Terms Grid (Matches Image 2) -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;border-top:1.5px solid #0f172a;padding-top:12px;margin-bottom:14px">
          <div>
            <div style="font-size:11px;line-height:1.6">
              <b>Delivery Date:</b> Within 7–10 Business Days<br>
              <b>Payment Terms:</b> 30 Days from material delivery &amp; QA inspection<br>
              <b>Quality Acceptance:</b> Subject to incoming testing at Jaipur R&amp;D facility.
            </div>
          </div>
          <div style="text-align:right;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:8px 14px">
            <div style="font-size:12px;color:#475569">Total PO Amount:</div>
            <div style="font-size:18px;font-weight:900;color:#0d2649" class="mono">${inr(tot)}</div>
            <div style="font-size:10.5px;color:#059669;margin-top:3px"><b>In Words:</b> ${esc(inrWords(tot))}</div>
          </div>
        </div>

        <!-- Signatures & Copies (Matches Image 2 Footer) -->
        <div style="border-top:1px dashed #cbd5e1;padding-top:10px;display:flex;justify-content:space-between;align-items:flex-end;font-size:11px">
          <div>
            <b>Authorised by:</b> Vivek Kumar Bhardwaj<br>
            <b>Date:</b> ${fmtDate(p.date)}<br>
            <div style="font-size:10px;color:#64748b;margin-top:4px">
              <i>Original: Supplier / Copy 1: Warehouse / Copy 2: Accounts</i>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;font-weight:800;color:#0d2649">for RvmAiTech Solutions Private Limited</div>
            <div style="margin-top:25px;font-size:12px;font-weight:900;color:#000">Managing Director</div>
            <div style="font-size:10px;color:#059669;font-weight:700">Official Purchase Authorization Seal</div>
          </div>
        </div>
      </div>
    </div>
  `;

  $('#btnPoEmail', dlg).addEventListener('click', () => {
    closeDlg();
    openPoEmailModal(p, pr, tot);
  });

  const genBtn = $('#btnPoGenBill', dlg);
  if (genBtn) {
    genBtn.addEventListener('click', () => {
      const b = document.createElement('button');
      b.dataset.id = p.id;
      ACT['po-gen-bill'](b);
    });
  }

  const btnEmailInv = $('#btnEmailInvoicePdf', dlg);
  if (btnEmailInv) {
    btnEmailInv.onclick = async () => {
      btnEmailInv.disabled = true; btnEmailInv.textContent = 'Sending PDF...';
      try {
        const res = await api('POST', `/api/erp/invoices/${encodeURIComponent(i.id)}/send-email`);
        toast(res.sentLive ? `Invoice PDF emailed to ${c.email}!` : `Invoice PDF email prepared & logged to Outbox!`, 'good');
        btnEmailInv.textContent = 'Sent ✓';
      } catch (err) {
        toast(err.message || 'Could not send invoice email.', 'bad');
        btnEmailInv.disabled = false; btnEmailInv.textContent = '📧 Email PDF to Client';
      }
    };
  }

  if (!dlg.open) dlg.showModal();
}

/* 1-Click Generate Tax Invoice & Bill for Purchase Order */
ACT['po-gen-bill'] = async el => {
  const p = S.purchases.find(x => x.id === el.dataset.id);
  if (!p) return;
  const D = derive();
  const pr = D.prod.get(p.productId) || { name: 'Smart Parking System', sku: 'SPS-2026', unit: 'NOS' };
  const tot = num(p.qty) * num(p.cost);

  let cust = S.customers.find(c => (c.company || c.name || '').toLowerCase() === (p.vendor || '').toLowerCase());
  if (!cust) {
    const custId = await dbAdd('customers', {
      name: p.vendor,
      company: p.vendor,
      phone: '9829011000',
      email: 'vendor.' + (p.vendor.toLowerCase().replace(/[^a-z0-9]/g, '')) + '@gmail.com',
      address: 'Industrial Area, Rajasthan',
      gstin: '08AABCT8842A1Z5',
      state: 'Rajasthan',
      createdAt: Date.now()
    });
    cust = S.customers.find(c => c.id === custId) || { id: custId, name: p.vendor, company: p.vendor };
  }

  const no = nextNo('INV-', S.invoices, 'no', 4);
  const chlNo = nextNo('CHL-', S.invoices, 'challanNo', 4);
  const gstRate = 18;
  const subTotal = tot;
  const taxAmt = Math.round(subTotal * gstRate / 100);
  const totalAmt = subTotal + taxAmt;
  const advAmt = Math.round(totalAmt * 0.5);

  const newInv = {
    no,
    challanNo: chlNo,
    date: today(),
    customerId: cust.id,
    poNo: p.no,
    buyerPo: p.no,
    poDate: p.date,
    purchaseId: p.id,
    paymentTerms: '50_advance',
    advanceAmount: advAmt,
    status: 'Part paid',
    lines: [
      {
        productId: p.productId,
        productName: pr.name,
        qty: p.qty,
        rate: p.cost,
        gst: gstRate,
        amount: totalAmt
      }
    ],
    subtotal: subTotal,
    tax: taxAmt,
    total: totalAmt,
    payments: [
      {
        id: 'PAY-' + Date.now(),
        date: today(),
        amount: advAmt,
        mode: 'Bank Transfer (NEFT/RTGS)',
        ref: 'ADV-' + p.no
      }
    ],
    createdAt: Date.now()
  };

  const invId = await dbAdd('invoices', newInv);
  toast(`🎉 Tax Invoice & Bill ${no} successfully generated for PO ${p.no}!`, 'good');

  setTimeout(() => {
    const created = S.invoices.find(x => x.id === invId || x.no === no);
    if (created) {
      const b = document.createElement('button');
      b.dataset.id = created.id;
      ACT['inv-view'](b);
    }
  }, 350);
};

/* Modal to Send PO Bill via Official Email (rvmaitech2026@gmail.com) */
function openPoEmailModal(p, pr, tot) {
  dlg.className = 'dlg dlg-wide';
  const prName = pr ? pr.name : 'Ordered Items';
  const defaultSubject = `Official Purchase Order: ${p.no} | RvmAiTech Solutions Pvt Ltd`;
  const defaultBody = `Dear Team ${p.vendor},

We are pleased to issue our official Purchase Order (${p.no}) for the procurement of ${prName}.

Purchase Order Summary:
-------------------------------------------
• PO Number     : ${p.no}
• Order Date    : ${fmtDate(p.date)}
• Product / Item: ${prName}
• Quantity      : ${qty(p.qty)}
• Unit Rate     : ${inr(p.cost)}
• Total Amount  : ${inr(tot)} (${inrWords(tot)})
• Delivery Site : Plot No. 42, RIICO Industrial Area, Mansarovar, Jaipur - 302020
-------------------------------------------

Please confirm receipt of this Purchase Order and advise estimated dispatch date.

Warm regards,

Vivek Kumar Bhardwaj
Founder & Managing Director
RvmAiTech Solutions Private Limited
Email: rvmaitech2026@gmail.com
Phone: +91 7052050656
Web: www.rvmaitech.com`;

  dlg.innerHTML = `
    <form class="form" id="poEmailForm">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid var(--rule);padding-bottom:12px;margin-bottom:12px">
        <div>
          <h2 class="dlg-title" style="margin:0">📧 Send Purchase Order (${esc(p.no)}) via Email</h2>
          <p class="dlg-sub" style="margin:2px 0 0">Dispatched from official address: <b>rvmaitech2026@gmail.com</b></p>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <img src="/logo-light.png?v=20261115" alt="RvmAiTech" style="height:32px;width:auto;max-width:160px;object-fit:contain;display:block">
          <span class="stamp stamp-good">PO Dispatch</span>
        </div>
      </div>

      <div class="fields">
        <div class="field">
          <label>From Address (Official)</label>
          <input value="rvmaitech2026@gmail.com (RvmAiTech Official)" readonly style="background:rgba(255,255,255,0.08);color:var(--heading);border:1px solid var(--rule);font-weight:700">
        </div>
        <div class="field">
          <label>Recipient Email (Vendor / Client) *</label>
          <input type="email" id="po-to" name="to" required value="client@btstech.in" placeholder="vendor@example.com / client@company.com" style="border:1px solid var(--accent)">
        </div>
      </div>

      <div class="field" style="margin-top:10px">
        <label>Subject Line *</label>
        <input name="subject" required value="${esc(defaultSubject)}" style="font-weight:700">
      </div>

      <div class="field" style="margin-top:10px">
        <label>Email Message Content *</label>
        <textarea name="message" rows="12" required style="font-family:inherit;font-size:12.5px;line-height:1.45">${esc(defaultBody)}</textarea>
      </div>

      <div class="dlg-actions" style="margin-top:16px;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:11px;color:var(--muted)">
          ℹ️ Sent directly via Google Mail Server &amp; recorded in Outbox
        </div>
        <div style="display:flex;gap:8px">
          <button type="button" class="btn" data-x="cancel">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btnSendPoNow">⚡ Send PO Email Now</button>
        </div>
      </div>
    </form>
  `;

  $('#poEmailForm', dlg).addEventListener('submit', async ev => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const to = fd.get('to').trim();
    const subject = fd.get('subject').trim();
    const message = fd.get('message').trim();

    const sendBtn = $('#btnSendPoNow', dlg);
    sendBtn.disabled = true; sendBtn.textContent = 'Sending...';

    try {
      await api('POST', `/api/erp/purchase-orders/${encodeURIComponent(p.id)}/send-email`, {
        to,
        subject,
        message
      });
      closeDlg();
      toast(`Purchase Order PDF for ${p.no} emailed to ${to} successfully!`, 'good');
    } catch (err) {
      toast(err.message || 'Could not send email.', 'bad');
      sendBtn.disabled = false; sendBtn.textContent = '⚡ Send PO Email Now';
    }
  });

  const btnEmailInv = $('#btnEmailInvoicePdf', dlg);
  if (btnEmailInv) {
    btnEmailInv.onclick = async () => {
      btnEmailInv.disabled = true; btnEmailInv.textContent = 'Sending PDF...';
      try {
        const res = await api('POST', `/api/erp/invoices/${encodeURIComponent(i.id)}/send-email`);
        toast(res.sentLive ? `Invoice PDF emailed to ${c.email}!` : `Invoice PDF email prepared & logged to Outbox!`, 'good');
        btnEmailInv.textContent = 'Sent ✓';
      } catch (err) {
        toast(err.message || 'Could not send invoice email.', 'bad');
        btnEmailInv.disabled = false; btnEmailInv.textContent = '📧 Email PDF to Client';
      }
    };
  }

  if (!dlg.open) dlg.showModal();
}

/* ================= Lifecycle Navigation & Action Handlers ================= */
ACT['nav-quote'] = el => {
  const i = S.invoices.find(x => x.id === el.dataset.id) || S.invoices[0];
  const D = derive();
  const c = i ? (D.cust.get(i.customerId) || {}) : (S.customers[0] || {});
  renderQuotationModal({
    no: i ? (i.challanNo ? i.challanNo.replace('CHL-', 'QT-') : i.no.replace('INV-', 'QT-')) : 'RVM/QT/2026-27/0003',
    date: i ? i.date : today(),
    customer: c,
    items: (i && i.items) ? i.items : null,
    invoiceId: i ? i.id : ''
  });
};

ACT['nav-pi'] = el => {
  const targetId = el && el.dataset.id;
  const p = (S.proformas || []).find(x => x.id === targetId || x.no === targetId) || (S.proformas && S.proformas[0]);
  if (p) {
    renderProformaInvoiceModal(p);
  } else {
    const q = (S.quotations || []).find(x => x.id === targetId || x.no === targetId);
    if (q) {
      openProformaInvoiceForm({
        companyName: q.companyName,
        contactPerson: q.contactPerson,
        email: q.email,
        phone: q.phone,
        address: q.address,
        gstin: q.gstin,
        projectName: q.projectName,
        projectCategory: q.projectCategory,
        projectDesc: q.projectDesc,
        basicCost: q.basicCost,
        gstRate: q.gstRate || 18,
        gstAmount: q.gstAmount,
        totalAmount: q.totalAmount,
        advancePct: q.advancePct || 50
      });
    } else {
      openProformaInvoiceForm();
    }
  }
};

ACT['proj-pi-new'] = () => openProformaInvoiceForm();
ACT['proj-pi-edit'] = el => {
  const p = (S.proformas || []).find(x => x.id === el.dataset.id);
  if (p) openProformaInvoiceForm(p);
};
ACT['proj-pi-view'] = el => {
  const p = (S.proformas || []).find(x => x.id === el.dataset.id);
  if (p) renderProformaInvoiceModal(p);
};
ACT['proj-pi-del'] = el => {
  const p = (S.proformas || []).find(x => x.id === el.dataset.id);
  if (p && confirm(`Delete Proforma Invoice ${p.no || p.id}?`)) {
    save(() => dbDelete('proformas', p.id), 'Proforma Invoice deleted.');
  }
};

ACT['nav-receipt'] = el => {
  const i = S.invoices.find(x => x.id === el.dataset.id) || S.invoices[0];
  if (i) {
    const p = (i.payments && i.payments[0]) || { date: i.date, amount: (i.paid || Math.round(i.total * 0.5)), mode: i.paymentMode || 'UPI / QR Code (7052050656)', ref: i.paymentRef || '2551540' };
    renderAdvanceReceiptModal(p, i);
  } else {
    toast('No invoice found to view receipt', 'warn');
  }
};

ACT['nav-invoice'] = el => {
  const i = S.invoices.find(x => x.id === el.dataset.id) || S.invoices[0];
  if (i) {
    ACT['inv-view']({ dataset: { id: i.id } });
  } else {
    toast('No invoice created yet', 'warn');
  }
};

ACT['nav-po'] = el => {
  const p = S.purchases[0] || { no: 'PO-0001', date: today(), vendor: 'VSAD', qty: 1, cost: 10000000, status: 'Received' };
  renderPurchaseOrderModal(p);
};

ACT['proj-quote-new'] = () => openProjectQuotationForm();
ACT['proj-quote-edit'] = el => {
  const q = (S.quotations || []).find(x => x.id === el.dataset.id);
  if (q) openProjectQuotationForm(q);
};
ACT['proj-quote-view'] = el => {
  const q = (S.quotations || []).find(x => x.id === el.dataset.id);
  if (q) renderQuotationModal(q);
};
ACT['proj-quote-del'] = el => {
  const q = (S.quotations || []).find(x => x.id === el.dataset.id);
  if (q && confirm(`Delete quotation ${q.no || q.id}?`)) {
    save(() => dbDelete('quotations', q.id), 'Quotation deleted.');
  }
};
ACT['erp-sales-tab'] = el => {
  S.ui.erpSalesTab = el.dataset.tab;
  scheduleRender();
};

ACT['quote-sample'] = () => {
  const q = (S.quotations && S.quotations[0]);
  if (q) renderQuotationModal(q);
  else openProjectQuotationForm();
};

ACT['quote-from-inv'] = el => {
  const i = S.invoices.find(x => x.id === el.dataset.id); if (!i) return;
  const D = derive(), c = D.cust.get(i.customerId) || {};
  renderQuotationModal({
    no: (i.challanNo ? i.challanNo.replace('CHL-', 'QT-') : i.no.replace('INV-', 'QT-')),
    date: i.date,
    customer: c,
    items: i.items,
    paymentTerms: i.paymentTerms || '50% Advance with PO, 50% on Delivery',
    invoiceId: i.id
  });
};

ACT['adv-receipt-view'] = el => {
  const i = S.invoices.find(x => x.id === el.dataset.id); if (!i) return;
  const p = (i.payments && i.payments[0]) || { date: i.date, amount: (i.paid || Math.round(i.total * 0.5)), mode: i.paymentMode || 'UPI / QR Code (7052050656)', ref: i.paymentRef || '2551540' };
  renderAdvanceReceiptModal(p, i);
};

ACT['po-view'] = el => {
  const p = S.purchases.find(x => x.id === el.dataset.id);
  if (p) renderPurchaseOrderModal(p);
};

ACT['po-email'] = el => {
  const p = S.purchases.find(x => x.id === el.dataset.id);
  if (!p) return;
  const D = derive();
  const pr = D.prod.get(p.productId);
  openPoEmailModal(p, pr, num(p.qty) * num(p.cost));
};

/* ================= ERP: stock issue register =================
   Stock that leaves without an invoice: material sent to a project or site, and daily-use items handed to staff. */
function issueTo(D, i) {
  if (i.kind === 'daily') return 'With staff, daily use';
  const p = D.proj.get(i.projectId);
  return p ? p.name : (i.destination || (i.projectId ? 'Project removed' : '—'));
}
function issueState(i) {
  if (outstanding(i) === 0) return ['Returned', 'good'];
  if (i.kind === 'daily') return ['With staff', 'info'];
  return num(i.returnedQty) > 0 ? ['Part returned', 'warn'] : ['Sent', 'mute'];
}
const byNewest = (a, b) => String(b.date).localeCompare(String(a.date)) || String(b.no).localeCompare(String(a.no));
V['erp-issues'] = D => {
  const q = query('erp-issues'), f = S.ui.filter.issueKind || '';
  const rows = S.issues.filter(i => matches(q, i.no, i.productName, issueTo(D, i), empName(D, i.takenById), i.via, i.destination) && (!f || i.kind === f)).sort(byNewest);
  const body = rows.map(i => {
    const st = issueState(i), p = D.proj.get(i.projectId);
    return `<tr><td class="mono nowrap">${esc(i.no)}</td><td class="nowrap">${fmtDate(i.date)}</td><td><b>${esc(i.productName)}</b>${i.note ? `<span class="sub">${esc(i.note)}</span>` : ''}</td><td class="num nowrap">${qty(i.qty)} <span class="muted">${esc(i.unit || 'pcs')}</span></td><td><b>${esc(issueTo(D, i))}</b><span class="sub">${esc(i.kind === 'daily' ? '' : p ? (p.location || '') : (i.projectId ? '' : ''))}${p && i.destination ? ' · ' + esc(i.destination) : ''}</span></td><td>${esc(empName(D, i.takenById))}</td><td>${esc(i.via || '—')}</td><td class="num">${num(i.returnedQty) ? qty(i.returnedQty) : '—'}</td><td>${stamp(st[0], st[1])}</td><td class="acts">${W('erp', `${outstanding(i) > 0 ? `<button class="link-btn" data-action="issue-return" data-id="${esc(i.id)}">Record return</button> ` : ''}<button class="link-btn danger" data-action="issue-del" data-id="${esc(i.id)}">Delete</button>`)}</td></tr>`;
  });
  const month = today().slice(0, 7);
  return head('ERP', 'Stock issue register', `<b>${S.issues.filter(i => monthOf(i.date) === month).length}</b> issues this month · <b>${holdings().length}</b> daily-use items out with staff`,
      W('erp', '<button class="btn btn-primary" data-action="issue-new">Issue stock</button>'))
    + `<div class="toolbar">${searchBox('erp-issues', 'Search item, project, place or person')}${filterSel('issueKind', 'All types', [{ value: 'site', label: 'Sent to a project or site' }, { value: 'daily', label: 'Daily-use, with staff' }])}</div>`
    + (S.issues.length === 0 ? empty('Nothing issued yet', 'Record every item that leaves the store without an invoice: what went, where, who took it and how it was sent.', W('erp', '<button class="btn btn-primary" data-action="issue-new">Issue stock</button>'))
      : rows.length === 0 ? empty('Nothing matches', 'Try a different search or type.')
      : table(['Issue', 'Date', 'Item', { n: 'Qty' }, 'Went to', 'Taken by', 'Sent by', { n: 'Returned' }, 'Status', ''], body))
    + `<p class="note">Issued stock comes off the stock on hand. When something comes back, record the return and it goes back into stock.</p>`;
};
ACT['issue-new'] = el => {
  if (!S.products.length) return toast('Add a product first, under ERP › Inventory.', 'warn');
  if (!activeEmps().length) return toast('No employees are on record yet. Ask HR to add them first.', 'warn');
  const D = derive();
  openForm({
    title: 'Issue stock', sub: 'For anything leaving the store without an invoice.', submit: 'Save issue', wide: true,
    fields: [
      { name: 'kind', label: 'What is this for', type: 'select', options: [{ value: 'site', label: 'Material for a project or site' }, { value: 'daily', label: 'Daily-use item for a staff member' }] },
      { name: 'date', label: 'Date', type: 'date', required: true, value: today(), max: today() },
      { name: 'productId', label: 'Item', type: 'select', required: true, placeholder: 'Choose an item', options: S.products.slice().sort(byName).map(p => ({ value: p.id, label: `${p.name} (${qty(D.stock.get(p.id) || 0)} in stock)` })) },
      { name: 'qty', label: 'Quantity', type: 'number', min: 0, step: 'any', required: true, value: 1 },
      { name: 'projectId', label: 'Project', type: 'select', placeholder: 'Not for a listed project', options: S.projects.filter(p => p.status !== 'Completed').sort(byName).map(p => ({ value: p.id, label: p.location ? `${p.name} (${p.location})` : p.name })) },
      { name: 'destination', label: 'Place it is going to', placeholder: 'Site address or area', hint: 'Needed when no project is chosen.' },
      { name: 'takenById', label: 'Who is taking it', type: 'select', required: true, placeholder: 'Choose a person', options: activeEmps().map(e => ({ value: e.id, label: e.role ? `${e.name} (${e.role})` : e.name })) },
      { name: 'via', label: 'Sent by', placeholder: 'Company tempo, courier, bike, by hand' },
      { name: 'note', label: 'Note', full: true }
    ],
    values: { kind: el.dataset.kind || 'site' },
    onSubmit: v => {
      const have = D.stock.get(v.productId) || 0;
      if (v.qty <= 0) throw new UserError('Quantity must be more than zero.');
      if (v.qty > have) throw new UserError(`Only ${qty(Math.max(0, have))} in stock. Reduce the quantity or record the purchase first.`);
      if (v.kind === 'daily') { v.projectId = ''; v.destination = ''; }
      return dbAdd('issues', v).then(() => toast('Issue saved. Stock updated.'));
    }
  });
};
ACT['issue-return'] = el => {
  const i = S.issues.find(x => x.id === el.dataset.id); if (!i) return;
  const out = outstanding(i);
  openForm({
    title: 'Record return', sub: `${i.no} · ${i.productName} · ${qty(out)} ${i.unit || 'pcs'} still out`, submit: 'Save return',
    fields: [{ name: 'qty', label: 'Quantity coming back', type: 'number', min: 0, max: out, step: 'any', required: true, full: true, value: out }],
    onSubmit: v => {
      if (v.qty <= 0 || v.qty > out) throw new UserError(`Enter a quantity between 1 and ${qty(out)}.`);
      return dbUpdate('issues', i.id, { returnedQty: num(i.returnedQty) + v.qty }).then(() => toast('Return recorded. Stock updated.'));
    }
  });
};
ACT['issue-del'] = async el => {
  const i = S.issues.find(x => x.id === el.dataset.id); if (!i) return;
  if (await confirmBox('Delete this issue?', `${i.no} (${i.productName} × ${qty(i.qty)}) will be deleted and that quantity goes back into stock.`)) save(() => dbDelete('issues', i.id), 'Issue deleted');
};

/* ================= ERP: who holds what ================= */
V['erp-holdings'] = D => {
  const q = query('erp-holdings');
  const rows = holdings().filter(i => matches(q, i.productName, empName(D, i.takenById)));
  const people = new Set(holdings().map(i => i.takenById)).size;
  let last = '';
  const body = rows.map(i => {
    const e = D.emp.get(i.takenById), first = i.takenById !== last; last = i.takenById;
    return `<tr><td>${first ? `<span class="person">${avatar(e)}<div><b>${esc(e ? e.name : 'Employee removed')}</b><span class="sub">${esc(e ? [e.code, e.role].filter(Boolean).join(' · ') : '')}</span></div></span>` : ''}</td><td><b>${esc(i.productName)}</b>${i.note ? `<span class="sub">${esc(i.note)}</span>` : ''}</td><td class="num">${qty(outstanding(i))} <span class="muted">${esc(i.unit || 'pcs')}</span></td><td class="nowrap">${fmtDate(i.date)}<span class="sub">${plural(dayDiff(i.date, today()), 'day')} ago</span></td><td class="mono nowrap">${esc(i.no)}</td><td class="acts">${W('erp', `<button class="link-btn" data-action="issue-return" data-id="${esc(i.id)}">Record return</button>`)}</td></tr>`;
  });
  return head('ERP', 'Who holds what', `<b>${sum(holdings(), outstanding)}</b> daily-use items are with <b>${people}</b> staff`,
      W('erp', '<button class="btn btn-primary" data-action="issue-new" data-kind="daily">Give an item to staff</button>'))
    + `<div class="toolbar">${searchBox('erp-holdings', 'Search person or item')}</div>`
    + (holdings().length === 0 ? empty('Nobody is holding anything', 'When you hand a tool, phone, helmet or any daily-use item to a staff member, record it here so you always know who has it.', W('erp', '<button class="btn btn-primary" data-action="issue-new" data-kind="daily">Give an item to staff</button>'))
      : rows.length === 0 ? empty('Nothing matches', 'Try a different search.')
      : table(['With', 'Item', { n: 'Qty held' }, 'Since', 'Issue', ''], body));
};

/* ================= ERP: dashboard ================= */
V['erp-home'] = D => {
  const m = today().slice(0, 7);
  const value = sum(S.products, p => Math.max(0, D.stock.get(p.id) || 0) * num(p.cost));
  const out = D.attn.low.filter(p => (D.stock.get(p.id) || 0) <= 0).length;
  const onOrder = S.purchases.filter(p => p.status !== 'Received');
  const recent = S.issues.slice().sort(byNewest).slice(0, 6);
  const tiles = `<div class="tiles">
    ${tile('Stock value', inrShort(value), `${plural(S.products.length, 'product')}, at cost`, '#erp-inventory')}
    ${tile('To reorder', String(D.attn.low.length), out ? `<span class="due">${out} out of stock</span>` : 'none out of stock', '#erp-inventory')}
    ${tile('Billed in ' + MONTHS[+m.slice(5) - 1], inrShort(billed(invoicesIn(m))), plural(invoicesIn(m).length, 'invoice'), '#erp-sales')}
    ${tile('On order', inrShort(sum(onOrder, p => num(p.qty) * num(p.cost))), plural(onOrder.length, 'purchase order'), '#erp-purchases')}
  </div>`;
  return head('ERP', 'ERP dashboard', `${DAYS[parseISO(today()).getDay()]}, ${fmtDate(today())}`, W('erp', '<button class="btn" data-action="issue-new">Issue stock</button><button class="btn btn-primary" data-action="inv-new">New invoice</button>'))
    + tiles + `<div class="cols"><div class="stack">
      <section class="card"><h2>Billing by month</h2><p class="card-sub">Invoice totals including GST. This month is month to date.</p>${salesChart('erp')}</section>
      <section class="card"><h2>Latest stock sent out</h2><p class="card-sub">What left the store without an invoice, and who took it.</p>${recent.length ? `<table class="mini">${recent.map(i => `<tr><td class="nowrap muted">${fmtDay(i.date)}</td><td><b>${esc(i.productName)}</b> × ${qty(i.qty)}</td><td>${esc(issueTo(D, i))}</td><td>${esc(empName(D, i.takenById))}</td></tr>`).join('')}</table><p class="note"><a href="#erp-issues">Open the stock issue register</a></p>` : '<p class="muted">Nothing has been issued yet.</p>'}</section>
    </div>
    <section class="card"><h2>Running low</h2><p class="card-sub">At or below the reorder level.</p>${attnList(D.attn.low.slice(0, 8).map(p => lowStockItem(D, p)), 'All stock is above its reorder level.')}</section></div>`;
};
