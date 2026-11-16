'use strict';
/* ================= Finance: dashboard ================= */
const paymentsOn = test => S.invoices.reduce((a, i) => a + sum((i.payments || []).filter(p => test(p.date)), p => p.amount), 0);
/* What the staff cost for one day: every active salary divided by the days in this month. */
function staffPerDay() { return sum(activeEmps(), e => e.salary) / daysIn(today().slice(0, 7)); }
function monthSummary(ym) {
  const inv = invoicesIn(ym);
  const revenue = billed(inv), gst = sum(inv, i => i.tax);
  const purchases = sum(S.purchases.filter(p => monthOf(p.date) === ym), p => num(p.qty) * num(p.cost));
  const salaries = sum(activeEmps(), e => e.salary);
  const expenses = sum(S.expenses.filter(x => monthOf(x.date) === ym), x => x.amount);
  return { revenue, gst, net: revenue - gst, purchases, salaries, expenses, surplus: revenue - gst - purchases - salaries - expenses };
}
V['fin-home'] = D => {
  const t = today(), m = t.slice(0, 7), fy = fyStart(t);
  const todayInv = S.invoices.filter(i => i.date === t), monthInv = invoicesIn(m), fyInv = S.invoices.filter(i => i.date >= fy);
  const emps = activeEmps(), dim = daysIn(m), perDay = staffPerDay();
  const s = monthSummary(m);

  // All-time Company Lifetime Turnover Metrics
  const allInvoices = S.invoices || [];
  const allTimeTurnover = billed(allInvoices);
  const allTimeCollected = sum(allInvoices, i => i.paid);
  const allTimeDue = sum(allInvoices, balanceOf);
  const deliveredProjects = S.projects.filter(p => p.status === 'Completed' || p.status === 'Delivered' || p.progress >= 100);
  const deliveredTurnover = sum(deliveredProjects, p => num(p.budget) || 0) || allTimeTurnover;

  const cats = EXPENSE_CATS.map(c => { const v = sum(S.expenses.filter(x => monthOf(x.date) === m && x.category === c), x => x.amount); return { name: c, value: v, text: `<b>${inr(v)}</b>` }; }).filter(r => r.value).sort((a, b) => b.value - a.value);

  // Single Lifetime Turnover KPI card in tiles
  const tiles = `<div class="tiles five">
    ${tile('Lifetime Turnover', inrShort(allTimeTurnover), `${inr(allTimeTurnover)} all-time`, '#proj-history')}
    ${tile('Revenue in ' + MONTHS[+m.slice(5) - 1], inrShort(billed(monthInv)), plural(monthInv.length, 'invoice') + ', month to date')}
    ${tile('Money to collect', inrShort(allTimeDue), D.attn.overdue.length ? `<span class="due">${plural(D.attn.overdue.length, 'invoice')} overdue</span>` : 'nothing overdue', '#fin-receivables')}
    ${tile('Received (Total Bank)', inrShort(allTimeCollected), `${inrShort(paymentsOn(d => monthOf(d) === m))} this month`, '#fin-receivables')}
    ${tile('Staff cost per day', inrShort(perDay), `${plural(emps.length, 'employee')} · ${inr(perDay)} a day`, '#fin-staff-costs')}
  </div>`;
  const line = (label, v, neg) => `<tr><td${neg ? ' class="neg"' : ''}>${label}</td><td class="num">${neg && v ? inr(-v) : inr(v)}</td></tr>`;
  return head('FINANCE', 'Finance dashboard', `${DAYS[parseISO(t).getDay()]}, ${fmtDate(t)} · ${fyLabel(t)}`, W('finance', '<button class="btn btn-primary" data-action="exp-new">Add expense</button>'))
    + tiles + `<div class="cols"><div class="stack">
      <section class="card"><h2>Revenue by month</h2><p class="card-sub">Invoice totals including GST. This month is month to date.</p>${salesChart('fin')}</section>
      <section class="card staff-cost-exec-card" style="background:linear-gradient(145deg, #0e1e38 0%, #15294a 100%); border:1px solid #1e3a68; border-radius:12px; padding:22px; box-shadow:0 8px 24px rgba(0,0,0,0.25);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
          <div>
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-size:22px;">💼</span>
              <h2 style="margin:0; font-size:18px; font-weight:700; color:#f1f5f9;">Staff Daily Payroll &amp; Workforce Cost</h2>
            </div>
            <p class="card-sub" style="margin:6px 0 0 0; color:#94a3b8; font-size:13px;">Daily workforce burn rate across ${dim} days in ${MONTHS[+m.slice(5) - 1]}. Click below to open full breakdown.</p>
          </div>
          <a href="#fin-staff-costs" class="btn btn-primary" style="display:inline-flex; align-items:center; gap:8px; font-weight:600; text-decoration:none; padding:9px 18px; font-size:13.5px; border-radius:8px; box-shadow:0 4px 12px rgba(37,99,235,0.35);">
            <span>Open Staff Cost Sheet</span> <span style="font-size:15px;">➔</span>
          </a>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:12px; margin-bottom:16px;">
          <div style="background:rgba(10, 25, 47, 0.7); padding:12px 14px; border-radius:8px; border-left:3.5px solid #38bdf8;">
            <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#94a3b8; font-weight:600;">Daily Burn Rate</div>
            <div style="font-size:20px; font-weight:800; color:#38bdf8; margin-top:3px;">${inr(perDay)}<span style="font-size:11px; font-weight:500; color:#94a3b8;"> / day</span></div>
          </div>
          <div style="background:rgba(10, 25, 47, 0.7); padding:12px 14px; border-radius:8px; border-left:3.5px solid #34d399;">
            <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#94a3b8; font-weight:600;">Monthly Payroll</div>
            <div style="font-size:20px; font-weight:800; color:#34d399; margin-top:3px;">${inr(s.salaries)}</div>
          </div>
          <div style="background:rgba(10, 25, 47, 0.7); padding:12px 14px; border-radius:8px; border-left:3.5px solid #fbbf24;">
            <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#94a3b8; font-weight:600;">Active Team</div>
            <div style="font-size:20px; font-weight:800; color:#fbbf24; margin-top:3px;">${emps.length} <span style="font-size:11px; font-weight:500; color:#94a3b8;">members</span></div>
          </div>
          <div style="background:rgba(10, 25, 47, 0.7); padding:12px 14px; border-radius:8px; border-left:3.5px solid #a78bfa;">
            <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#94a3b8; font-weight:600;">Avg / Employee</div>
            <div style="font-size:20px; font-weight:800; color:#a78bfa; margin-top:3px;">${inr(emps.length ? perDay / emps.length : 0)}<span style="font-size:11px; font-weight:500; color:#94a3b8;"> / day</span></div>
          </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(15, 23, 42, 0.6); padding:11px 16px; border-radius:8px; border:1px solid rgba(255,255,255,0.06); font-size:13px; flex-wrap:wrap; gap:8px;">
          <span style="color:#cbd5e1;">👥 Total ${emps.length} active employees across Technology, Operations, HR, Sales &amp; Finance.</span>
          <a href="#fin-staff-costs" style="color:#60a5fa; font-weight:600; text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
            <span>View Full Details &amp; Breakdown</span> ➔
          </a>
        </div>
      </section>
    </div><div class="stack">
      <section class="card"><h2>${MONTHS[+m.slice(5) - 1]} so far</h2><p class="card-sub">A rough picture, not final accounts.</p><table class="mini">
        ${line('Billed to customers, with GST', s.revenue)}${line('Less GST collected, payable to government', s.gst, true)}${line('Purchase orders placed', s.purchases, true)}${line('Salaries, full month', s.salaries, true)}${line('Other expenses', s.expenses, true)}
        <tr class="total"><td>Estimated surplus</td><td class="num${s.surplus < 0 ? ' due' : ''}">${inr(s.surplus)}</td></tr></table>
        <p class="note">Estimate only. It counts the full month's salaries against sales made so far, and purchases at their order value. Ask your accountant for final figures.</p></section>
      <section class="card"><h2>Where the money went</h2><p class="card-sub">Expenses this month by category.</p>${cats.length ? hbars(cats) : '<p class="muted">No expenses recorded this month.</p>'}</section>
    </div></div>`;
};

/* ================= Finance: money to collect ================= */
V['fin-receivables'] = D => {
  const rows = S.invoices.filter(i => balanceOf(i) >= 0.5).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const body = rows.map(i => {
    const st = invStatus(i), late = dayDiff(dueDate(i), today());
    return `<tr><td class="mono nowrap"><button class="link-btn" data-action="inv-view" data-id="${esc(i.id)}">${esc(i.no)}</button></td><td><b>${esc(custLabel(D.cust.get(i.customerId)))}</b><span class="sub">${esc((D.cust.get(i.customerId) || {}).phone || '')}</span></td><td class="nowrap">${fmtDate(i.date)}</td><td class="nowrap">${fmtDate(dueDate(i))}${late > 0 ? `<span class="sub due">${plural(late, 'day')} late</span>` : ''}</td><td class="num">${inr(i.total)}</td><td class="num">${inr(i.paid)}</td><td class="num${st === 'Overdue' ? ' due' : ''}"><b>${inr(balanceOf(i))}</b></td><td>${stamp(st, INV_TONE[st])}</td><td class="acts">${can('finance') || can('erp') ? `<button class="link-btn" data-action="inv-pay" data-id="${esc(i.id)}">Record payment</button>` : ''}</td></tr>`;
  });
  const recent = S.invoices.flatMap(i => (i.payments || []).map(p => ({ p, i }))).sort((a, b) => String(b.p.date).localeCompare(String(a.p.date))).slice(0, 8);
  return head('FINANCE', 'Money to collect', `<b>${inr(sum(rows, balanceOf))}</b> due on <b>${rows.length}</b> invoices · <b>${inr(sum(rows.filter(i => invStatus(i) === 'Overdue'), balanceOf))}</b> of it overdue`)
    + (rows.length === 0 ? empty('Nothing to collect', 'Every invoice is fully paid.') : table(['Invoice', 'Customer', 'Billed on', 'Due', { n: 'Total' }, { n: 'Received' }, { n: 'Balance' }, 'Status', ''], body, `<tr><td colspan="4">${plural(rows.length, 'invoice')}</td><td class="num">${inr(billed(rows))}</td><td class="num">${inr(sum(rows, i => i.paid))}</td><td class="num">${inr(sum(rows, balanceOf))}</td><td colspan="2"></td></tr>`))
    + `<h2 class="sect">Payments received lately</h2>`
    + (recent.length ? table(['Date', 'Invoice', 'Customer', { n: 'Amount' }], recent.map(({ p, i }) => `<tr><td class="nowrap">${fmtDate(p.date)}</td><td class="mono">${esc(i.no)}</td><td>${esc(custLabel(D.cust.get(i.customerId)))}</td><td class="num">${inr(p.amount)}</td></tr>`)) : '<p class="muted">No payments recorded yet.</p>')
    + `<p class="note">Payment terms are 30 days from the invoice date.</p>`;
};

/* ================= Finance: expenses ================= */
V['fin-expenses'] = D => {
  const ym = S.ui.expMonth;
  const rows = S.expenses.filter(x => monthOf(x.date) === ym).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const body = rows.map(x => `<tr><td class="nowrap">${fmtDate(x.date)}</td><td>${stamp(x.category, 'mute')}</td><td>${esc(x.paidTo || '—')}</td><td>${esc(x.note || '—')}</td><td class="num"><b>${inr(x.amount)}</b></td><td class="acts">${W('finance', `<button class="link-btn" data-action="exp-edit" data-id="${esc(x.id)}">Edit</button> <button class="link-btn danger" data-action="exp-del" data-id="${esc(x.id)}">Delete</button>`)}</td></tr>`);
  return head('FINANCE', 'Expenses', `<b>${inr(sum(rows, x => x.amount))}</b> spent in ${esc(monthName(ym))}`,
      stepper('exp-month', monthName(ym), ym >= today().slice(0, 7)) + W('finance', '<button class="btn btn-primary" data-action="exp-new">Add expense</button>'))
    + (rows.length === 0 ? empty('No expenses in ' + monthName(ym), 'Record rent, electricity, transport and other running costs here. Salaries and purchases are counted from their own modules.', W('finance', '<button class="btn btn-primary" data-action="exp-new">Add expense</button>'))
      : table(['Date', 'Category', 'Paid to', 'Note', { n: 'Amount' }, ''], body, `<tr><td colspan="4">${plural(rows.length, 'entry', 'entries')}</td><td class="num">${inr(sum(rows, x => x.amount))}</td><td></td></tr>`));
};
function expenseForm(x) {
  openForm({
    title: x ? 'Edit expense' : 'Add expense',
    fields: [
      { name: 'date', label: 'Date', type: 'date', required: true, value: today(), max: today() },
      { name: 'category', label: 'Category', type: 'select', options: EXPENSE_CATS, value: 'Other' },
      { name: 'amount', label: 'Amount (₹)', type: 'number', min: 0, step: 'any', required: true },
      { name: 'paidTo', label: 'Paid to' },
      { name: 'note', label: 'Note', full: true }
    ],
    values: x || {},
    onSubmit: v => {
      if (v.amount <= 0) throw new UserError('Amount must be more than zero.');
      S.ui.expMonth = v.date.slice(0, 7);
      return x ? dbUpdate('expenses', x.id, v).then(() => toast('Expense updated')) : dbAdd('expenses', v).then(() => toast('Expense added'));
    }
  });
}
ACT['exp-new'] = () => expenseForm(null);
ACT['exp-edit'] = el => expenseForm(S.expenses.find(x => x.id === el.dataset.id));
ACT['exp-del'] = async el => {
  const x = S.expenses.find(e => e.id === el.dataset.id); if (!x) return;
  if (await confirmBox('Delete expense?', `${x.category}, ${inr(x.amount)} on ${fmtDate(x.date)} will be deleted.`)) save(() => dbDelete('expenses', x.id), 'Expense deleted');
};
ACT['exp-month'] = el => { const n = shiftMonth(S.ui.expMonth, num(el.dataset.dir)); if (n <= today().slice(0, 7)) { S.ui.expMonth = n; scheduleRender(); } };

/* ================= Finance: staff daily costs ================= */
V['fin-staff-costs'] = D => {
  const t = today(), m = t.slice(0, 7), dim = daysIn(m);
  const emps = activeEmps().slice().sort((a, b) => num(b.salary) - num(a.salary));
  const totalSal = sum(emps, e => e.salary), perDay = staffPerDay();
  const depts = Array.from(new Set(emps.map(e => e.dept).filter(Boolean))).sort();
  const q = (S.ui.q['fin-staff'] || '').toLowerCase().trim();
  const fDept = S.ui.filter['fin-dept'] || '';

  const filtered = emps.filter(e => {
    if (fDept && e.dept !== fDept) return false;
    if (q) {
      const match = [e.name, e.code, e.role, e.dept].join(' ').toLowerCase();
      if (!match.includes(q)) return false;
    }
    return true;
  });

  const rows = filtered.map(e => {
    const sal = num(e.salary);
    const dayCost = sal / dim;
    const hrCost = dayCost / 8;
    const pct = totalSal > 0 ? ((sal / totalSal) * 100).toFixed(1) : '0';
    return `<tr>
      <td class="mono font-bold"><span style="font-family:monospace; background:rgba(59,130,246,0.15); color:#60a5fa; border:1px solid rgba(59,130,246,0.3); padding:2px 8px; border-radius:4px; font-weight:700; font-size:12px;">${esc(e.code || 'EMP')}</span></td>
      <td><b>${esc(e.name)}</b><span class="sub">${esc([e.role, e.dept].filter(Boolean).join(' · '))}</span></td>
      <td class="num"><b>${inr(sal)}</b></td>
      <td class="num" style="color:#38bdf8;"><b>${inr(dayCost)}</b></td>
      <td class="num muted">${inr(hrCost)}</td>
      <td class="num"><span style="background:rgba(148,163,184,0.12); color:#cbd5e1; padding:2px 7px; border-radius:4px; font-weight:600; font-size:11.5px;">${pct}%</span></td>
    </tr>`;
  });

  const filtSal = sum(filtered, e => e.salary);
  const filtDay = filtSal / dim;
  const filtHr = filtDay / 8;

  const foot = `<tr>
    <td colspan="2"><b>Total (${plural(filtered.length, 'employee')})</b></td>
    <td class="num"><b>${inr(filtSal)}</b></td>
    <td class="num" style="color:#38bdf8;"><b>${inr(filtDay)}</b></td>
    <td class="num muted"><b>${inr(filtHr)}</b></td>
    <td class="num"><b>${totalSal > 0 ? ((filtSal / totalSal) * 100).toFixed(1) : 0}%</b></td>
  </tr>`;

  return head('FINANCE', 'Staff Daily Costs Breakdown',
      `Gross monthly salary ÷ ${dim} days in ${MONTHS[+m.slice(5) - 1]} · Total workforce burn: <b>${inr(perDay)}/day</b>`,
      `<a class="btn btn-outline" href="#fin-home">‹ Back to Finance Dashboard</a> <button class="btn btn-primary" onclick="printDoc('printableArea')">🖨️ Print Cost Sheet</button>`)
    + `<div class="tiles four" style="margin-bottom:16px;">
        ${tile('Total Daily Burn', inrShort(perDay), `${inr(perDay)} every single day`)}
        ${tile('Monthly Payroll', inrShort(totalSal), `${plural(emps.length, 'staff member')}`)}
        ${tile('Avg Cost / Employee', inrShort(emps.length ? perDay / emps.length : 0), `${inr(emps.length ? perDay / emps.length : 0)} / day`)}
        ${tile('Hourly Burn Rate', inrShort(perDay / 8), `Assuming 8 hr work shift / day`)}
      </div>`
    + `<div class="toolbar">
        ${searchBox('fin-staff', 'Search employee name, EMP ID, role or department...')}
        ${filterSel('fin-dept', 'All Departments', depts)}
      </div>`
    + (filtered.length === 0
      ? empty('No employees found', 'Try adjusting your search query or department filter.')
      : `<div id="printableArea">` + table([
          'EMP ID',
          'Employee & Department',
          { n: 'Monthly Gross' },
          { n: 'Cost Per Day' },
          { n: 'Cost Per Hour (8h)' },
          { n: 'Payroll Share' }
        ], rows, foot) + `</div>`)
    + `<p class="note">Workforce daily cost is computed by distributing gross monthly CTC across ${dim} days in the active month. Hourly burn assumes standard 8-hour operational shifts.</p>`;
};
