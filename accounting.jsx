/* HOF Pulse ERP — Accounting: a record's payment structures (record detail → Accounting tab, on
   Contacts, Deals and Customers).

   One payment structure per record ("Payment Terms"): every record starts with it — one payment
   of the whole amount, Unpaid (the default terms) — and none is created by hand. Edit Payment Terms
   sets its plan (PaymentTermsFields — the same fields on a quote's Payment Terms step and a
   document's Add Payment Term), one of three types (decided 2026-11-12):
     One-Time Payment    — currency, amount, invoice issue date (Quote Signed or a fixed date) and
       due date (Due on Receipt, Net 7 … Net 60, a custom date or a custom number of days). Update
       Status marks it Paid (the payment date: today or an earlier day; evidence optional) or, once
       Paid, Unpaid again: the payment is reversed — kept on the terms (`reversed`) and in the
       record's activity; a payment's date never changes. Its amount can be edited at any time;
       while Paid, the payment follows it (paid in full).
     Installment Payment — currency, total amount; a deposit (a fixed amount or a percentage of the
       total) with its own invoice issue date and due date; the rest in equal installments, due
       every 30 days after the deposit, each invoiced on its due date, 1 to 3 days or a week before,
       or a custom number of days before (1 day by default). Edit on the schedule sets each amount
       and date and adds or deletes installments: the schedule then bills what's set, whether or
       not it adds up to the total (decided 2026-11-12).
     Recurring Payment   — a subscription: the same amount every month (30 days) or year, its first
       invoice issued when the quote is signed or on a fixed date, each due by its terms; for a
       number of years, or until cancelled (Cancel Subscription).
   The plan makes the payments (planSchedule) — real dated installments, so the Accounting
   properties, Forecasted Cash, Cash Invoiced (an installment is invoiced on its invoice date,
   invoicedOn) and workflows read every type alike. Quote Signed waits for the record's quote to be
   signed: until then the dates read "Day N" from signing (datePlansOnSigning dates them).
   Switching type keeps what's recorded: a paid One-Time Payment becomes the paid deposit (Recurring
   isn't offered then); once an installment is paid the type is fixed, as the terms are. Each
   One-Time change (paid, reversed, amount) and each switch is in the record's activity (Payment).
   Terms saved before plans keep their installments as they were; edited, they open as a plan (planOf).
   Its ⋯ (One-Time: Edit at any time; Installment and Recurring: until the first payment is recorded):
     Edit Payment Terms — the panel above.
     Cancel Subscription — (until cancelled) the day it ends: nothing is invoiced after it; what's
       invoiced by then stays owed. Once cancelled, the terms can't be edited.
     Pull from quote    — a quote sent to the record (Sent or Signed) fills the structure with its
       payment terms (its plan for the quote's total; saved before plans: its installments, a
       "Day N" counting from the quote's sent date), marked "Imported from Quote". Each quote can be
       pulled once. Payments can be recorded once the quote is signed.
   A record saved with more than one structure (before this rule) keeps one — the one with
   payments, else a quote's, else its own (primaryTermsOf) — and the others stay, archived:
   viewable, read-only, never deleted.

   Installment payments only move forward (no edit or undo until a correction workflow is defined):
     Unpaid          — nothing received.
     Partially Paid  — an amount received (less than the installment); the rest becomes its own
                       installment, linked to the original ("Balance of …"), with its own amount,
                       expected date and status. The original keeps its amount and payment.
     Paid            — the installment's outstanding amount received in full.
   Each payment is its own record: amount (more than 0), date (today or earlier), who recorded it,
   and optional evidence — an uploaded screenshot (≤2 MB) and / or a payment gateway or reference
   link. A part payment's balance is expected today or later.

   A customer with a deal shows its deal's Payment Terms (termsHolderOf): one structure for the sale.

   Recording payments and manual structures need edit access to the record; everyone who can see
   it sees its structures. A record with payments recorded can't be deleted (recordHasPayments) —
   by hand, in bulk or by a workflow — so no recorded cash leaves Cash Received or Goals. */

const ACCOUNTING_RECORD_TYPES = ['contacts', 'deals', 'customers'];
/* A structure's currency: its quote's, the deal amount's (the default terms), or the one chosen
   when its terms are edited (the default currency to start with). Its payments are in it; totals
   across records convert to the default currency. Saved before currencies could be chosen: AED. */
const scheduleCurrency = (s) => (s && s.currency) || LEGACY_CURRENCY;
const PAYMENT_STATUS = {unpaid:{label:'Unpaid', tone:'warn'}, partial:{label:'Partially Paid', tone:'info'}, paid:{label:'Paid', tone:'success'}};
const acId = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
// An installment's money: received (its payments), whether its rest moved to a balance installment, what's outstanding, its status.
function installmentState(schedule, inst){
  const received = r2((inst.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0));
  const balance = (schedule.installments || []).find(x => x.parentId === inst.id) || null;
  const outstanding = balance ? 0 : Math.max(0, r2(inst.amount - received));
  // Nothing received is Unpaid, even on an installment with no amount yet (the default terms of a contact or customer).
  const status = received > 0 && received >= inst.amount - 0.005 ? 'paid' : received > 0 ? 'partial' : 'unpaid';
  return {received, balance, outstanding, status};
}
// The structure's total (the quote's, or the one set here); without installments, all of it is outstanding.
function scheduleTotals(schedule){
  const top = (schedule.installments || []).filter(x => !x.parentId);
  const all = schedule.installments || [];
  const total = r2(schedule.total != null ? schedule.total : top.reduce((s, x) => s + x.amount, 0));
  const received = r2(all.reduce((s, x) => s + installmentState(schedule, x).received, 0));
  return {total, received, outstanding: all.length ? r2(all.reduce((s, x) => s + installmentState(schedule, x).outstanding, 0)) : r2(total - received)};
}
// Edit access to the record (Settings → Users & Teams permissions); no permission system → yes.
function recordEditable(object, record){
  if(!ACCESS.user || !ACCESS.perms) return true;
  const p = ACCESS.perms[object];
  return !!(p && p.enabled && permissionCovers(p.edit, object, record));
}
// The quotes on the record (its own).
const recordQuotes = (hub, object, record) => (hub.quotes || []).filter(q => q.object === object && String(q.recordId) === String(record.id));
const hasPayments = (s) => (s.installments || []).some(x => (x.payments || []).length);
/* The payment type (see the header): set when the terms are saved; before that, untouched default
   terms — one installment, no due date — are One-Time, anything else Installment. A Subscription
   (saved before Recurring) is Recurring. */
const PAYMENT_TYPE_LABEL = {'one-time':'One-Time Payment', installments:'Installment Payment', recurring:'Recurring Payment'};
const PAYMENT_TYPES = [['one-time', 'One-Time'], ['installments', 'Installment'], ['recurring', 'Recurring']];
const RECURRING_FREQUENCY = {weekly:'Weekly', monthly:'Monthly', yearly:'Yearly'};
const paymentTypeOf = (s) => s.paymentType === 'subscription' ? 'recurring' : s.paymentType || (s.source === 'manual' && (s.installments || []).length === 1 && !s.installments[0].dueDate ? 'one-time' : 'installments');
/* Whose Payment Terms a record shows: a customer with a deal shows its deal's (one structure for the
   sale — the Accounting tab, the Accounting columns and workflows all read it); anything else its own. */
const termsHolderOf = (object, record) => object === 'customers' && record && (record.dealIds || []).length ? {object:'deals', id:record.dealIds[0]} : {object, id:record ? record.id : null};
// Whether a record has payments recorded (in any of its payment terms): such a record can't be deleted.
const recordHasPayments = (object, id, list = WF_LIVE.accounting) => (list || []).some(s => s.object === object && String(s.recordId) === String(id) && hasPayments(s));
// A record's one payment structure among those saved for it (see the header); the rest are archived.
function primaryTermsOf(list){
  if(!list || !list.length) return null;
  const paid = list.filter(hasPayments);
  return paid.length ? paid[paid.length - 1] : list.find(s => s.source !== 'manual') || list.find(s => !s.isDefault) || list[0];
}
/* A quote's payment structure, as pulled: its plan (the quote's total, in its currency), dated from
   the day it was signed (not signed yet: dated when it is — datePlansOnSigning). A quote saved
   before plans: its installments as they were. */
const scheduleFromQuote = (q, object, record) => {
  const head = {id:`qs-${q.id}`, source:'quote', quoteId:q.id, quoteNumber:q.number, quoteTitle:q.title, object, recordId:record.id, createdAt:q.createdAt, createdBy:q.createdBy, total:quoteTotal(q), currency:quoteCurrency(q)};
  if(q.payment){
    const plan = newPaymentPlan({...q.payment, amount:quoteTotal(q), currency:quoteCurrency(q)}), signedOn = q.status === 'signed' ? dayOf(q.signedAt) : '';
    const installments = planSchedule(plan, {id:head.id, signedOn});
    return {...head, paymentType:plan.paymentType, plan, ...(signedOn ? {signedOn} : {}), total:r2(installments.reduce((a, x) => a + x.amount, 0)), installments};
  }
  return {...head, installments:(q.installments || []).map((x, i) => ({id:`qs-${q.id}-${x.id || i}`, parentId:null, description:x.description, percent:Number(x.percent) || 0,
    amount:installmentAmount(q, x), dueDate:tentativeDate(x.due, q.sentAt), tentative: x.due && x.due.type !== 'date' ? fmtTentative(x.due) : '', payments:[]}))};
};
/* The default payment terms every Contact, Deal and Customer starts with while it has none of its
   own: one installment — First installment, 100%, Unpaid — the total the deal's amount, following it
   while the terms are untouched (0 for a contact or customer until it's set). A real structure (edited, paid or replaced like any other),
   so the record's First Installment Status reads Unpaid for workflows. No due date is invented:
   it's set when the terms are edited (Forecasted Cash counts installments by due date). */
const defaultTermsOf = (id, object, recordId, total, startDate, createdAt, currency) => ({id, source:'manual', isDefault:true, object, recordId, createdAt, createdBy:'System',
  title:'Payment terms', total, ...(currency ? {currency} : {}), startDate, terms:[{id:id + 't', description:'First installment', percent:100, due:null}],
  installments:[{id:id + 'i', parentId:null, description:'First installment', percent:100, amount:total, dueDate:'', tentative:'', payments:[]}]});
const defaultPaymentTerms = (object, record) =>
  defaultTermsOf(acId('ps'), object, record.id, object === 'deals' ? r2(Number(record.amount) || 0) : 0, ymdOf(new Date()), new Date(), object === 'deals' ? record.currency : undefined);
/* Saved compactly while untouched (every record has them, and browser storage is small); once
   edited or paid they're saved in full like any other structure. */
const packPaymentTerms = (list) => list.map(s => {
  if(!s.isDefault) return s;
  const fresh = defaultTermsOf(s.id, s.object, s.recordId, s.total, s.startDate, s.createdAt, s.currency);
  return JSON.stringify(s) === JSON.stringify(fresh) ? {defaultTerms:[s.id, s.object, s.recordId, s.total, s.startDate, +new Date(s.createdAt), ...(s.currency ? [s.currency] : [])]} : s;
});
const unpackPaymentTerms = (list) => (list || []).map(s => s && s.defaultTerms
  ? (([id, object, recordId, total, startDate, at, currency]) => defaultTermsOf(id, object, recordId, total, startDate, new Date(at), currency))(s.defaultTerms) : s);
/* ── Payment terms: a plan and the schedule it makes (decided 2026-11-12) ──
   A plan {paymentType, currency, amount, issue, due, lead, depositBy, depositPercent, count,
   schedule, rows, frequency, duration}:
     issue — when the first invoice is issued (Installment: the deposit's; Recurring: the first
             cycle's): {type:'signed'} — the quote is signed (a document: the document) — or
             {type:'date', date};
     due   — when an invoice is due after it's issued: {type:'net', days} (Due on Receipt is Net 0;
             Net 7 … 60), {type:'days', days} (Custom Days) or {type:'date', date} (Custom Date —
             Recurring: the first cycle's, each later one's moving with its cycle);
     lead  — an installment's Invoice Issue Date: on its due date (0), 1, 2, 3 or 7 days before it,
             or a custom number of days (`leadCustom`); 1 by default.
   One-Time    — `amount`, invoiced on `issue`, due by `due`.
   Installment — `amount` is the total. The deposit — `depositPercent` of it, entered as a fixed
                 amount or a percentage (`depositBy`; an amount typed is kept exactly) — is invoiced
                 on `issue` and due by `due`. The rest is `count` equal installments (the last takes
                 the cents) due every 30 days after the deposit is due, each invoiced `lead` days
                 before. Edited (`schedule:'custom'`, what Edit on the schedule turns it into): each
                 installment's amount and dates as set (`rows`, one per installment — added or
                 deleted there; a date not set: the 30-day one), billed as set: nothing makes it add
                 up to the total.
   Recurring   — the same `amount` every billing cycle, Monthly (every 30 days) or Yearly (every 12
                 months) from `issue`, each cycle invoiced on its day and due by `due`; for `count`
                 years (`duration:'years'`; saved before: months), or until cancelled
                 (`duration:'ongoing'`): billed cycle by cycle — the ones invoiced by today and the
                 next (rollSubscription, on every load) — until the subscription is cancelled
                 (`cancelledOn`: no invoice after it; RecordAccounting's Cancel Subscription).
   Waiting for signing, a plan has no dates: "Day N" counts from it. Row ids come from the
   structure's id, so they stay the same through an edit (payments, invoices, workflow marks). */
const RECURRING_UNIT = {weekly:'Week', monthly:'Month', yearly:'Year'};
const DUE_TERMS = [['net-0', 'Due on Receipt'], ['net-7', 'Net 7'], ['net-15', 'Net 15'], ['net-30', 'Net 30'], ['net-45', 'Net 45'], ['net-60', 'Net 60'], ['days', 'Custom Days'], ['date', 'Custom Date']];
const INVOICE_TIMING = [{value:'0', label:'On the day of payment'}, {value:'1', label:'1 day before'}, {value:'2', label:'2 days before'}, {value:'3', label:'3 days before'}, {value:'7', label:'1 week before'}, {value:'custom', label:'Custom'}];
const SUBSCRIPTION_DURATION = [{value:'years', label:'Number of Years'}, {value:'ongoing', label:'Until Agreement Is Cancelled'}];
const INSTALLMENT_INTERVAL = 30, PLAN_MAX_COUNT = 120, PLAN_MAX_YEARS = 10, PLAN_MAX_LEAD = 365;
/* A subscription saved for months (or, before durations, a count of monthly cycles) is those
   months — as years when they make whole years (the same cycles). */
const newPaymentPlan = (p = {}) => {
  const months = (p.paymentType === 'recurring' || p.paymentType === 'subscription') && (p.duration === 'months' || (!p.duration && p.frequency !== 'yearly' && Number(p.count) > 0));
  const years = months && Number(p.count) % 12 === 0;
  return {paymentType:'one-time', currency:defaultCurrency(), amount:'', issue:{type:'signed'}, due:{type:'net', days:0}, lead:1,
    depositBy:'percent', depositPercent:'', count:'', schedule:'every30', rows:[], frequency:'monthly', ...p,
    duration: months && !years ? 'months' : p.duration === 'ongoing' ? 'ongoing' : 'years', ...(years ? {count:Number(p.count) / 12} : {})}; };
const dayOf = (v) => !v ? '' : typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ymdOf(new Date(v));
const addDays = (ymd, n) => ymdOf(new Date(new Date(`${ymd}T00:00:00`).getTime() + n * 86400000));
const addMonths = (ymd, n) => { const [y, m, d] = ymd.split('-').map(Number), last = new Date(y, m - 1 + n + 1, 0).getDate(); return ymdOf(new Date(y, m - 1 + n, Math.min(d, last))); };
const planCount = (plan) => Math.min(PLAN_MAX_COUNT, Math.max(0, Math.floor(Number(plan.count) || 0)));
const planOngoing = (plan) => !!plan && paymentTypeOf(plan) === 'recurring' && plan.duration === 'ongoing';
// A fixed-length subscription's billing cycles: its months or years at its frequency.
const planCycles = (plan) => { const c = planCount(plan), yearly = plan.frequency === 'yearly';
  return plan.duration === 'years' ? (yearly ? c : c * 12) : yearly ? Math.ceil(c / 12) : c; };
/* The payments a plan makes. `total`: the amount when it isn't the plan's own (a quote's total).
   `signedOn`: the day it was signed. `asOf`: today. `preview`: at least this many billing cycles
   of a subscription until cancelled. `cancelledOn`: no invoice after it. */
function planSchedule(plan, {id = 'pt', signedOn = '', total, asOf = ymdOf(new Date()), preview = 1, cancelledOn = ''} = {}){
  const type = paymentTypeOf(plan), amount = r2(total != null ? total : plan.amount), byDate = (plan.issue || {}).type === 'date';
  // A date and whether it's known (else counted from day 0: today, until the signing).
  const at = (date, fixed) => ({date, fixed});
  const signedDay = byDate ? '' : dayOf(signedOn), start = byDate ? at(plan.issue.date || '', true) : at(signedDay || asOf, !!signedDay);
  const after = (x, n) => at(x.date ? addDays(x.date, n) : '', x.fixed);
  const due = plan.due || {type:'net', days:0};
  const dueAfter = (inv) => due.type === 'date' ? at(due.date || '', true) : after(inv, Number(due.days) || 0);
  const lead = type === 'installments' ? Number(plan.lead) || 0 : 0, day = (x) => `Day ${Math.round((new Date(`${x.date}T00:00:00`) - new Date(`${asOf}T00:00:00`)) / 86400000)}`;
  const row = (rid, description, amt, inv, du) => ({id:rid, parentId:null, description, amount:amt,
    invoiceDate: inv.fixed ? inv.date : '', dueDate: du.fixed ? du.date : '', invoiceTentative: !inv.fixed && inv.date ? day(inv) : '', tentative: !du.fixed && du.date ? day(du) : '', payments:[]});
  let rows = [];
  if(type === 'one-time') rows = [row(`${id}-p`, 'Payment', amount, start, dueAfter(start))];
  else if(type === 'recurring'){
    const yearly = plan.frequency === 'yearly', step = plan.frequency === 'weekly' ? 7 : 30, unit = RECURRING_UNIT[plan.frequency] || 'Month';
    const ongoing = plan.duration === 'ongoing', cycles = ongoing ? 1200 : planCycles(plan);
    const cycle = (ymd, i) => yearly ? addMonths(ymd, 12 * i) : addDays(ymd, step * i);
    for(let i = 0; i < cycles; i++){
      const inv = at(start.date ? cycle(start.date, i) : '', start.fixed);
      if(cancelledOn && inv.date && inv.date > cancelledOn) break;
      // A custom due date is the first cycle's; each later cycle's moves with it.
      rows.push(row(`${id}-r${i + 1}`, `${unit} ${i + 1}`, amount, inv, due.type === 'date' ? at(due.date ? cycle(due.date, i) : '', true) : dueAfter(inv)));
      // Until cancelled: what's invoiced by today, then the next (and a preview's few).
      if(ongoing && rows.length >= preview && (!inv.fixed || !inv.date || inv.date > asOf)) break;
    }
  } else {
    const n = planCount(plan), deposit = Math.min(amount, r2(amount * (Number(plan.depositPercent) || 0) / 100)), rest = r2(amount - deposit), each = n ? Math.floor(rest / n * 100) / 100 : 0;
    // Edited: each installment's own amount (none set yet: 0) and dates.
    const depositDue = dueAfter(start), custom = plan.schedule === 'custom', over = custom ? plan.rows || [] : [];
    rows = [row(`${id}-d`, 'Deposit', deposit, start, depositDue)];
    for(let k = 1; k <= n; k++){
      const o = over[k - 1] || {}, set = (v) => v !== '' && v != null;
      const du = set(o.dueDate) ? at(o.dueDate, true) : at(depositDue.date ? addDays(depositDue.date, INSTALLMENT_INTERVAL * k) : '', depositDue.fixed);
      const inv = set(o.invoiceDate) ? at(o.invoiceDate, true) : after(du, -lead);
      rows.push(row(`${id}-i${k}`, `Installment ${k}`, set(o.amount) ? r2(o.amount) : custom ? 0 : k === n ? r2(rest - each * (n - 1)) : each, inv, du));
    }
  }
  const sum = rows.reduce((a, x) => a + x.amount, 0);
  return rows.map(x => ({...x, percent: sum ? x.amount / sum * 100 : 0}));
}
const planTotal = (plan, total) => r2(planSchedule(plan, {total}).reduce((a, x) => a + x.amount, 0));
const ymdOk = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
const countOk = (v, max = PLAN_MAX_COUNT) => v !== '' && v != null && Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= max;
const daysOk = (v, max) => /^\d+$/.test(String(v ?? '')) && Number(v) <= max;
// Complete: an amount, its dates set, a deposit under the total, a number; an edited schedule's every amount set.
function planOk(plan, total){
  const amount = Number(total != null ? total : plan.amount), issue = plan.issue || {}, due = plan.due || {}, type = paymentTypeOf(plan);
  if(!(amount > 0) || (issue.type === 'date' && !ymdOk(issue.date))) return false;
  const dueOk = due.type === 'date' ? ymdOk(due.date) && !(issue.type === 'date' && due.date < issue.date) : due.type !== 'days' || daysOk(due.days, 3650);
  if(type === 'recurring') return dueOk && (plan.duration === 'ongoing' || countOk(plan.count, plan.duration === 'months' ? PLAN_MAX_COUNT : PLAN_MAX_YEARS));
  if(type === 'one-time') return dueOk;
  const pct = Number(plan.depositPercent);
  if(!(dueOk && daysOk(plan.lead, PLAN_MAX_LEAD) && pct > 0 && pct < 100 && countOk(plan.count))) return false;
  return plan.schedule !== 'custom' || planSchedule(plan, {total}).every(x => x.amount > 0 && !(x.invoiceDate && x.dueDate && x.invoiceDate > x.dueDate));
}
// A plan as saved: numbers as numbers; an edited schedule's rows, as many as the installments.
const normalizePlan = (p) => ({...p, amount:r2(p.amount), depositPercent:p.depositPercent === '' ? '' : Number(p.depositPercent), count:p.count === '' ? '' : Number(p.count), lead:Number(p.lead) || 0,
  issue:p.issue.type === 'date' ? {type:'date', date:p.issue.date || ''} : {type:'signed'}, due:p.due.type === 'date' ? {type:'date', date:p.due.date || ''} : {type:p.due.type, days:Number(p.due.days) || 0},
  rows:p.schedule === 'custom' ? (p.rows || []).slice(0, planCount(p)).map(x => ({amount:x.amount === '' || x.amount == null ? '' : r2(x.amount), invoiceDate:x.invoiceDate || '', dueDate:x.dueDate || ''})) : []});
/* Terms saved before plans, as a plan to edit (saved again, they're the plan's): a Subscription is
   Recurring from its first due date; installments a deposit (the first) and the rest in equal parts;
   a One-Time payment its amount. `x`: a payment structure, a document's payment term or a plan. */
function planOf(x){
  if(!x) return newPaymentPlan();
  if(x.plan) return newPaymentPlan(x.plan);
  if(x.issue) return newPaymentPlan(x);
  const currency = x.currency || defaultCurrency(), type = paymentTypeOf(x);
  if(type === 'recurring') return newPaymentPlan({paymentType:'recurring', currency, amount:x.amount ?? '', frequency:x.frequency || 'monthly', count:x.count ?? '', ...(x.firstDue ? {issue:{type:'date', date:x.firstDue}} : {})});
  const amounts = x.installments ? x.installments.filter(i => !i.parentId).map(i => r2(i.amount))
    : (x.terms || []).map(t => t.amount != null && t.amount !== '' ? r2(t.amount) : r2((Number(x.total) || 0) * (Number(t.percent) || 0) / 100));
  const total = x.total != null && x.total !== '' ? r2(x.total) : r2(amounts.reduce((a, v) => a + v, 0));
  if(type === 'one-time' || amounts.length < 2) return newPaymentPlan({currency, amount:total || ''});
  return newPaymentPlan({paymentType:'installments', currency, amount:total, depositPercent: total ? amounts[0] / total * 100 : '', count:amounts.length - 1});
}
// A quote's installments saved before plans (shares of its total), as a plan: the first the deposit.
const planOfShares = (list) => !(list || []).length ? newPaymentPlan()
  : list.length === 1 ? newPaymentPlan() : newPaymentPlan({paymentType:'installments', depositPercent:Number(list[0].percent) || '', count:list.length - 1});
// An installment's invoice: issued on its invoice date once that's come (or recorded, before plans).
const invoicedOn = (inst, today = ymdOf(new Date())) => inst.invoicedAt || (inst.invoiceDate && inst.invoiceDate <= today ? inst.invoiceDate : '');
// The day a "Quote Signed" plan counts from: its quote's signing, else the record's latest signed quote.
const quoteSignedOn = (quotes, s) => { const signed = (quotes || []).filter(q => q.status === 'signed' && q.signedAt);
  const own = signed.find(q => q.id === s.quoteId); if(own) return dayOf(own.signedAt);
  return signed.filter(q => q.object === s.object && String(q.recordId) === String(s.recordId)).map(q => dayOf(q.signedAt)).sort().pop() || ''; };
/* Payment terms' rows as their plan makes them now (`patch`: dated from a signing, cancelled) —
   a row kept keeps everything but its dates (payments, invoices, balances); a row the plan no
   longer makes (a cycle after a cancellation) stays only when something's paid on it. */
function refreshSchedule(s, patch = {}){
  const next = {...s, ...patch}, all = next.installments || [], top = all.filter(x => !x.parentId);
  const fresh = planSchedule(next.plan, {id:next.id, signedOn:next.signedOn, cancelledOn:next.cancelledOn});
  const withKids = (x) => [x, ...all.filter(b => b.parentId === x.id).flatMap(withKids)];
  const paidTree = (x) => (x.payments || []).length > 0 || all.some(b => b.parentId === x.id && paidTree(b));
  const used = new Set();
  const rows = fresh.flatMap(f => { const o = top.find(x => x.id === f.id) || (fresh.length === 1 && top.length === 1 ? top[0] : null);
    if(!o) return [f]; used.add(o.id);
    return withKids({...o, invoiceDate:f.invoiceDate, dueDate:f.dueDate, invoiceTentative:f.invoiceTentative, tentative:f.tentative}); });
  const installments = [...rows, ...top.filter(x => !used.has(x.id) && paidTree(x)).flatMap(withKids)];
  return {...next, installments, total:r2(installments.filter(x => !x.parentId).reduce((a, x) => a + x.amount, 0))};
}
const withSignedOn = (s, on) => refreshSchedule(s, {signedOn:on});
// A subscription until cancelled: billed up to today and the next cycle (on every load, app.jsx).
const rollSubscription = (s) => s && planOngoing(s.plan) && !s.archived ? refreshSchedule(s) : s;
/* A quote signed (quotes.jsx): the payment terms waiting for it — pulled from it, or on its record
   and set to Quote Signed — get their dates. */
function datePlansOnSigning(hub, quote, signedAt){
  const on = dayOf(signedAt);
  hub.setAccounting(list => list.map(s => !s.plan || (s.plan.issue || {}).type === 'date' || s.signedOn
    || !(s.quoteId === quote.id || (s.object === quote.object && String(s.recordId) === String(quote.recordId))) ? s : withSignedOn(s, on)));
}

/* A schedule as a table: each payment's name, invoice date, due date (or Day N) and amount, then
   the total — or, for a subscription until cancelled (`ongoing`), "Until cancelled". The plan's
   preview, a quote's and a document's payment terms. */
function PaymentPlanTable({rows, currency, rule, ongoing}){
  const money = {fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap', textAlign:'right'};
  const when = (date, day) => fmtQuoteDate(date) || day || '—';
  return (<div>
    <div style={{display:'flex', gap:12, padding:'0 0 6px', fontSize:11.5, color:T.attioMuted}}>
      <span style={{flex:1}}>Payment</span><span style={{width:92, textAlign:'right'}}>Invoice</span><span style={{width:92, textAlign:'right'}}>Due</span><span style={{width:110, textAlign:'right'}}>Amount</span>
    </div>
    {rows.map(x => (
      <div key={x.id} style={{display:'flex', gap:12, alignItems:'baseline', padding:'7px 0', borderTop:`1px solid ${T.attioLine}`, fontSize:13, color:T.attioText}}>
        <span style={{flex:1, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{x.description}</span>
        <span style={{...money, width:92, color:T.attioMuted}}>{when(x.invoiceDate, x.invoiceTentative)}</span>
        <span style={{...money, width:92, color:T.attioMuted}}>{when(x.dueDate, x.tentative)}</span>
        <span style={{...money, width:110}}>{fmtMoney(x.amount, currency)}</span>
      </div>
    ))}
    {ongoing ? <div style={{borderTop:`${rule ? 2 : 1}px solid ${rule || T.attioLine}`, marginTop:2, paddingTop:7, fontSize:13, color:T.attioMuted}}>Until cancelled</div>
      : <div style={{display:'flex', justifyContent:'space-between', gap:12, borderTop:`${rule ? 2 : 1}px solid ${rule || T.attioLine}`, marginTop:2, paddingTop:7, fontSize:13, fontWeight:600, color:T.attioText}}>
        <span>Total</span><span style={money}>{fmtMoney(r2(rows.reduce((a, x) => a + x.amount, 0)), currency)}</span>
      </div>}
  </div>);
}
/* ── The payment terms' fields ── the Edit Payment Terms panel's (Accounting, Documents) and a
   quote's Payment Terms step (`total`: the quote's — no currency or amount here then). Every
   input the same size, one per row, a second one beside it when a choice needs it (a fixed date,
   custom days, a number):
     One-Time    — Currency, Amount, Invoice Issue Date, Due Date;
     Installment — Currency, Total Amount; Deposit: its amount (Fixed Amount or Percentage of Total
                   Amount, the other shown beside it), Invoice Issue Date, Due Date; Installments:
                   Number, Invoice Issue Date (days before each is due); then the schedule — Edit
                   makes every amount and date editable, the deposit's too, and installments added
                   or deleted;
     Recurring   — Currency, Amount, Billing Frequency, Invoice Issue Date, Due Date, Duration (a
                   number of years, or until cancelled);
   then the schedule they make. `signedLabel`: the issue date's first option ("Quote Signed", a
   document's "Document Signed"). `paid`: a paid One-Time payment ({amount}) — switched to
   Installment it's the deposit, as paid; Recurring isn't offered then. `signedOn`: the day it's
   already signed (Accounting: the record's quote), so the schedule shows its dates. */
const PT_W = 280, PT_H = 36;
function PaymentTermsFields({plan, onChange, total, currency, signedLabel = 'Quote Signed', paid, signedOn}){
  const set = (p) => onChange({...plan, ...p}), type = paymentTypeOf(plan), inQuote = total != null;
  const amount = Number(inQuote ? total : plan.amount) || 0, cur = currency || plan.currency, unit = RECURRING_UNIT[plan.frequency] || 'Month';
  const section = {fontSize:11, fontWeight:600, color:T.attioFaint, textTransform:'uppercase', letterSpacing:.4};
  const divider = <div style={{borderTop:`1px solid ${T.border}`, margin:'8px -20px 4px'}}/>;
  const control = {...fieldControl, height:PT_H, boxSizing:'border-box'}, dateInput = {...fieldInput, height:PT_H, boxSizing:'border-box'};
  const box = {display:'flex', alignItems:'center', gap:6, border:`1px solid ${T.borderStrong}`, borderRadius:8, padding:'0 10px', height:PT_H, boxSizing:'border-box', background:'#fff', minWidth:0};
  const bare = {flex:1, minWidth:0, border:'none', outline:'none', fontSize:13, fontFamily:'inherit', color:T.attioText, background:'transparent', textAlign:'right', fontVariantNumeric:'tabular-nums'};
  const affix = {fontSize:12, color:T.attioMuted, whiteSpace:'nowrap'};
  // A field: its input, and the one a choice adds beside it — the same size.
  const F = (label, a, b) => <Field label={label} wide><div style={{display:'grid', gridTemplateColumns:`${PT_W}px ${PT_W}px`, gap:12}}>{a}{b || <span/>}</div></Field>;
  const pick = (value, options, onPick, label) => <Dropdown required value={value} options={options} controlStyle={control} ariaLabel={label} onChange={onPick}/>;
  const num = (value, onValue, label, before, after, decimal) => <div style={box}>{before && <span style={affix}>{before}</span>}
    <input value={value ?? ''} onChange={e=>onValue(e.target.value.replace(decimal ? /[^0-9.]/g : /[^0-9]/g, ''))} inputMode={decimal ? 'decimal' : 'numeric'} placeholder="0" aria-label={label} style={bare}/>
    {after && <span style={affix}>{after}</span>}</div>;
  const date = (value, onValue, label, placeholder) => <DateField required value={value || ''} onChange={onValue} ariaLabel={label} inputStyle={dateInput} placeholder={placeholder || 'Select date'}/>;
  const issue = plan.issue || {type:'signed'}, due = plan.due || {type:'net', days:0};
  const issueField = (label) => F(label, pick(issue.type, [{value:'signed', label:signedLabel}, {value:'date', label:'Fixed Date'}], (v)=>set({issue: v === 'date' ? {type:'date', date:issue.date || ''} : {type:'signed'}}), label),
    issue.type === 'date' && date(issue.date, (v)=>set({issue:{type:'date', date:v}}), label));
  const dueField = (label) => F(label, pick(due.type === 'net' ? `net-${Number(due.days) || 0}` : due.type, DUE_TERMS.map(([value, l]) => ({value, label:l})),
      (v)=>set({due: v === 'date' ? {type:'date', date:''} : v === 'days' ? {type:'days', days:''} : {type:'net', days:Number(v.slice(4))}}), label),
    due.type === 'date' ? date(due.date, (v)=>set({due:{type:'date', date:v}}), label) : due.type === 'days' && num(due.days, (v)=>set({due:{type:'days', days:v}}), `${label} days`, null, 'days'));
  // An installment's invoice: on its due date, days or a week before, or a custom number of days before.
  const leadPick = plan.leadCustom || !INVOICE_TIMING.some(o => o.value === String(plan.lead ?? '')) ? 'custom' : String(plan.lead);
  const timingField = F('Invoice Issue Date', pick(leadPick, INVOICE_TIMING, (v)=>set(v === 'custom' ? {leadCustom:true} : {lead:Number(v), leadCustom:false}), 'Invoice issue date'),
    leadPick === 'custom' && num(plan.lead, (v)=>set({lead:v}), 'Invoice issue days before', null, 'days before'));
  // The deposit: a fixed amount or a percentage of the total, the other worked out beside it.
  const pct = Number(plan.depositPercent) || 0, depositAmount = r2(amount * pct / 100), byAmount = plan.depositBy === 'amount';
  const [typed, setTyped] = React.useState(null);   // the amount as it's typed, kept exactly
  const depositInput = byAmount
    ? num(typed != null ? typed : plan.depositPercent === '' ? '' : String(depositAmount), (v)=>{ setTyped(v); set({depositPercent: v === '' || !(amount > 0) ? '' : Number(v) / amount * 100}); }, 'Deposit amount', cur, plan.depositPercent === '' ? '' : `${Math.round(pct * 100) / 100}%`, true)
    : num(plan.depositPercent === '' ? '' : String(Math.round(pct * 10000) / 10000), (v)=>set({depositPercent:v}), 'Deposit percentage', null, `%${plan.depositPercent === '' ? '' : ` · ${fmtMoney(depositAmount, cur)}`}`, true);
  const ready = planOk({...plan, schedule: plan.schedule === 'custom' ? 'every30' : plan.schedule}, total);
  const rows = type !== 'one-time' && ready ? planSchedule(plan, {total, signedOn, preview:3}) : [];
  const custom = type === 'installments' && plan.schedule === 'custom';
  // Edit: the schedule as it stands, each installment's amount set on its row (its dates the 30-day ones until changed).
  const [editOn, setEditing] = React.useState(false), editing = editOn && custom;
  const edit = () => { if(!custom) set({schedule:'custom', rows:rows.slice(1).map(x => ({amount:String(x.amount), invoiceDate:'', dueDate:''}))}); setEditing(true); };
  const own = () => Array.from({length:planCount(plan)}, (_, i) => (plan.rows || [])[i] || {});
  const setRow = (k, p) => set({rows:own().map((o, i) => i === k ? {...o, ...p} : o)});
  const addRow = () => set({count:planCount(plan) + 1, rows:[...own(), {amount:'', invoiceDate:'', dueDate:''}]});
  const deleteRow = (k) => set({count:planCount(plan) - 1, rows:own().filter((_, i) => i !== k)});
  const cols = 'minmax(0, 1fr) 170px 170px 170px 28px';
  return (<>
    {stack(<>
      <Field label="Payment Type">{(
        <div role="radiogroup" aria-label="Payment type" style={{display:'inline-flex', border:`1px solid ${T.borderStrong}`, borderRadius:8, overflow:'hidden', background:'#fff'}}>
          {PAYMENT_TYPES.map(([id, l]) => { const off = id === 'recurring' && !!paid; return (
            <button key={id} type="button" role="radio" aria-checked={type === id} disabled={off} onClick={()=>!off && set({paymentType:id})}
              style={{border:'none', cursor: off ? 'default' : 'pointer', padding:'6px 14px', fontSize:12.5, fontWeight:500, fontFamily:'inherit', whiteSpace:'nowrap', opacity: off ? .45 : 1,
                background: type === id ? T.black : 'transparent', color: type === id ? '#fff' : T.gray600}}>{l}</button>); })}
        </div>)}</Field>
      {!inQuote && <>
        {F('Currency', pick(cur, currencyOptions(), (c)=>c && set({currency:c}), 'Currency'))}
        {F(type === 'installments' ? 'Total Amount' : 'Amount', num(plan.amount, (v)=>set({amount:v}), type === 'installments' ? 'Total amount' : 'Amount', cur, null, true))}
      </>}
      {type === 'one-time' && <>{issueField('Invoice Issue Date')}{dueField('Due Date')}</>}
      {type === 'recurring' && <>
        {F('Billing Frequency', pick(plan.frequency === 'yearly' ? 'yearly' : 'monthly', [{value:'monthly', label:'Monthly'}, {value:'yearly', label:'Yearly'}], (v)=>set({frequency:v}), 'Billing frequency'))}
        {issueField('Invoice Issue Date')}
        {dueField('Due Date')}
        {/* Saved before for months that aren't whole years: those months, until changed. */}
        {F('Duration', pick(plan.duration, plan.duration === 'months' ? [{value:'months', label:'Number of Months'}, ...SUBSCRIPTION_DURATION] : SUBSCRIPTION_DURATION, (v)=>set({duration:v}), 'Subscription duration'),
          plan.duration !== 'ongoing' && num(plan.count, (v)=>set({count:v}), plan.duration === 'months' ? 'Number of months' : 'Number of years', null, plan.duration === 'months' ? 'months' : 'years'))}
      </>}
    </>)}
    {type === 'installments' && <>
      {divider}<span style={section}>Deposit</span>
      {stack(<>
        {paid ? F('Amount', <div style={{display:'flex', alignItems:'center', gap:10, height:PT_H, fontSize:13, color:T.attioText, fontVariantNumeric:'tabular-nums'}}>{fmtMoney(paid.amount, cur)}<StatusPill status="paid" map={PAYMENT_STATUS}/></div>)
          : F('Amount', pick(byAmount ? 'amount' : 'percent', [{value:'amount', label:'Fixed Amount'}, {value:'percent', label:'Percentage of Total Amount'}], (v)=>{ setTyped(null); set({depositBy:v}); }, 'Deposit type'), depositInput)}
        {issueField('Invoice Issue Date')}
        {dueField('Due Date')}
      </>)}
      {divider}<span style={section}>Installments</span>
      {stack(<>
        {F('Number', num(plan.count, (v)=>{ set({count:v}); custom && setEditing(true); }, 'Number of installments'))}
        {timingField}
      </>)}
    </>}
    {rows.length > 0 && <>
      {divider}
      <div style={{display:'flex', alignItems:'center', gap:10, minHeight:28, marginBottom:6}}>
        <span style={{...section, flex:1}}>{type === 'installments' ? 'Installment Schedule' : 'Schedule'}</span>
        {type === 'installments' && !editing && <button type="button" onClick={edit} style={{...btnSecondarySm, padding:'4px 10px'}}><Icon name="edit" size={12} color={T.gray600}/> Edit</button>}
      </div>
      {editing ? (
        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          <div style={{display:'grid', gridTemplateColumns:cols, gap:10, fontSize:11.5, color:T.attioMuted}}>
            <span>Payment</span><span>Amount</span><span>Invoice Issue Date</span><span>Payment Due Date</span><span/></div>
          {rows.map((x, i) => (
            <div key={x.id} style={{display:'grid', gridTemplateColumns:cols, gap:10, alignItems:'center'}}>
              <span style={{fontSize:13, color:T.attioText}}>{x.description}</span>
              {i === 0
                ? paid ? <span style={{fontSize:13, color:T.attioText, fontVariantNumeric:'tabular-nums'}}>{fmtMoney(x.amount, cur)}</span>
                  : num(typed != null && byAmount ? typed : String(x.amount), (v)=>{ setTyped(v); set({depositBy:'amount', depositPercent: v === '' || !(amount > 0) ? '' : Number(v) / amount * 100}); }, 'Deposit amount', cur, null, true)
                : num(((plan.rows || [])[i - 1] || {}).amount ?? (x.amount ? String(x.amount) : ''), (v)=>setRow(i - 1, {amount:v}), `${x.description} amount`, cur, null, true)}
              {date(i === 0 ? (issue.type === 'date' ? issue.date : x.invoiceDate) : ((plan.rows || [])[i - 1] || {}).invoiceDate || x.invoiceDate,
                (v)=>i === 0 ? set({issue:{type:'date', date:v}}) : setRow(i - 1, {invoiceDate:v}), `${x.description} invoice issue date`, x.invoiceTentative)}
              {date(i === 0 ? (due.type === 'date' ? due.date : x.dueDate) : ((plan.rows || [])[i - 1] || {}).dueDate || x.dueDate,
                (v)=>i === 0 ? set({due:{type:'date', date:v}}) : setRow(i - 1, {dueDate:v}), `${x.description} payment due date`, x.tentative)}
              {/* The deposit stays; an installment can go while one is left. */}
              {i > 0 && rows.length > 2 ? <button type="button" title={`Delete ${x.description}`} onClick={()=>deleteRow(i - 1)}
                style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', justifyContent:'center', padding:4}}><Icon name="trash" size={14} color={T.gray600}/></button> : <span/>}
            </div>
          ))}
          {planCount(plan) < PLAN_MAX_COUNT && <button type="button" onClick={addRow}
            style={{alignSelf:'flex-start', display:'inline-flex', alignItems:'center', gap:6, border:'none', background:'transparent', padding:'4px 0', fontSize:13, fontWeight:500, color:T.attioText, cursor:'pointer', fontFamily:'inherit'}}>
            <Icon name="plus" size={13} color={T.gray600}/> Add Installment</button>}
        </div>
      ) : <PaymentPlanTable rows={rows} currency={cur} ongoing={planOngoing(plan)}/>}
    </>}
  </>);
}

/* ── Edit Payment Terms: the side panel ── PaymentTermsFields, saved as a plan (`onSave(plan)`).
   `initial`: the plan, and `paid` for a paid One-Time payment. `pullable`: the quotes sent to the
   record whose terms aren't pulled yet; `onPull(quote)` fills the terms with one. `heading` /
   `zIndex` / `signedLabel`: Documents' Add Payment Term, over its builder. `signedOn`: PaymentTermsFields'. */
function PaymentStructurePanel({initial, onCancel, onSave, pullable = [], onPull, heading, zIndex, signedLabel, signedOn}){
  const paid = initial && initial.paid;
  const [plan, setPlan] = React.useState(() => newPaymentPlan(initial ? (({paid: _, ...p}) => p)(initial) : undefined));
  const [pickOpen, setPickOpen] = React.useState(false);
  // A paid One-Time payment as the deposit: its amount, the total more than it.
  const view = paid && plan.paymentType === 'installments' ? {...plan, depositBy:'amount', depositPercent: Number(plan.amount) > 0 ? paid.amount / Number(plan.amount) * 100 : ''} : plan;
  const def = () => normalizePlan(view);
  const ok = planOk(view);
  // Saved untouched, the terms stay exactly as they are (a quote's stay the quote's, invoices and all).
  const opened = React.useRef(JSON.stringify(plan)).current;
  const save = () => ok && (JSON.stringify(plan) === opened ? onCancel() : onSave(def()));
  return (
    <CreatePanelFrame title={heading || 'Edit Payment Terms'} onClose={onCancel} placement="fixed" width={920} zIndex={zIndex} actions={<>
      <StSecondary label="Cancel" onClick={onCancel}/>
      <StCta label="Save" disabled={!ok} onClick={save}/>
    </>}>
      {/* Pull from quote: a sent quote's payment terms, brought in as they are. */}
      {onPull && pullable.length > 0 && (
        <div style={{display:'flex', alignItems:'center', gap:10, padding:'12px 14px', marginBottom:18, border:`1px solid ${T.attioLine}`, borderRadius:10, background:T.headerBg}}>
          <Icon name="quote" size={15} color={T.gray600}/>
          <span style={{flex:1, fontSize:13, color:T.attioText}}>Pull payment terms from a sent quote</span>
          <div style={{position:'relative'}}>
            <button type="button" onClick={()=>setPickOpen(o => !o)} style={btnSecondarySm}>Pull from Quote <Icon name="chevDown" size={11} color={T.gray600}/></button>
            <MenuShell open={pickOpen} onClose={()=>setPickOpen(false)} anchorRight width={340}>
              {/* One line each (menu copy never wraps): the quote's number, title and total. */}
              {pullable.map(q => <MenuItem key={q.id} label={`${q.number} · ${q.title} · ${fmtMoney(quoteTotal(q), quoteCurrency(q))}`} onClick={()=>{ setPickOpen(false); onPull(q); }}/>)}
            </MenuShell>
          </div>
        </div>
      )}
      <PaymentTermsFields plan={view} onChange={setPlan} signedLabel={signedLabel} paid={paid} signedOn={signedOn}/>
    </CreatePanelFrame>
  );
}

/* Cancel Subscription: the day it ends (today or later) — no invoice after it; what's invoiced by
   then stays owed (RecordAccounting). */
function CancelSubscriptionModal({onCancel, onSave}){
  const today = ymdOf(new Date()), [on, setOn] = React.useState(today), ok = ymdOk(on) && on >= today;
  return ReactDOM.createPortal(
    <StModal title="Cancel Subscription" primary="Cancel Subscription" canSubmit={ok} width={424} onCancel={onCancel} onSubmit={()=>ok && onSave(on)}>
      <div><label style={fieldLabel}>Cancellation Date</label><DateField required value={on} onChange={setOn} ariaLabel="Cancellation date"/></div>
    </StModal>, document.body);
}

/* ── Update an installment's status: Paid or Partially Paid, with the payment and its evidence ──
   `oneTime`: a One-Time payment — Paid or Unpaid; once Paid, Unpaid reverses it (`onReverse`). */
function PaymentModal({schedule, inst, oneTime, onCancel, onSave, onReverse}){
  const st = installmentState(schedule, inst), cur = scheduleCurrency(schedule);
  const due = r2(inst.amount - st.received);
  const wasPaid = !!oneTime && st.status === 'paid', last = wasPaid ? inst.payments[inst.payments.length - 1] : null;
  const [status, setStatus] = React.useState('paid');
  const [amount, setAmount] = React.useState('');
  const [paidOn, setPaidOn] = React.useState(() => ymdOf(new Date()));
  const [expected, setExpected] = React.useState(() => inst.dueDate && inst.dueDate > ymdOf(new Date()) ? inst.dueDate : ymdOf(new Date(Date.now() + 30 * 86400000)));
  const [file, setFile] = React.useState(null);
  const [link, setLink] = React.useState('');
  const [error, setError] = React.useState('');
  const partial = status === 'partial';
  // Unpaid: the installment stays as it is — no payment is recorded.
  const unpaid = status === 'unpaid';
  const amt = Number(amount);
  const amountOk = !partial || (amount !== '' && amt > 0 && amt < due);
  const linkOk = !link.trim() || /^https?:\/\/\S+$/i.test(link.trim());
  // Paid today or earlier; the rest of a part payment is expected today or later.
  const today = ymdOf(new Date()), paidOnOk = !!paidOn && paidOn <= today, expectedOk = !partial || (!!expected && expected >= today);
  // A payment needs something owed: an installment of 0 (terms whose total isn't set yet) takes none.
  const ok = wasPaid ? unpaid : unpaid || (due > 0 && paidOnOk && amountOk && linkOk && expectedOk);
  const radio = (k, label) => (
    <label key={k} style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:T.attioText, cursor:'pointer'}}>
      <input type="radio" name="payment-status" checked={status === k} onChange={()=>setStatus(k)}/> {label}
    </label>
  );
  return ReactDOM.createPortal(
    <StModal title="Update Status" primary={unpaid || wasPaid ? 'Save' : 'Save Payment'} canSubmit={ok} width={676} onCancel={onCancel}
      onSubmit={()=>ok && (wasPaid ? onReverse() : unpaid ? onCancel() : onSave({status, amount: partial ? r2(amt) : due, paidOn, expected, evidence:{file, link:link.trim()}}))}>
      {/* Two columns: the installment's figures on the left, the payment on the right. */}
      <div style={{display:'grid', gridTemplateColumns:'minmax(0, 1fr) 1px minmax(0, 1.2fr)', columnGap:14, minHeight:310}}>
        <div style={{display:'flex', flexDirection:'column', gap:14}}>
          <PayDetail label={oneTime ? 'Payment' : 'Installment'}>{oneTime ? PAYMENT_TYPE_LABEL['one-time'] : inst.description}</PayDetail>
          <PayDetail label={wasPaid ? 'Amount' : 'Outstanding'}>{fmtMoney(wasPaid ? st.received : due, cur)}</PayDetail>
          {partial && <PayDetail label="Remaining balance">{fmtMoney(amountOk && amount ? r2(due - amt) : due, cur)}</PayDetail>}
        </div>
        <div style={{background:T.border}}/>
        <div style={{display:'flex', flexDirection:'column', gap:14, minWidth:0}}>
          <div style={{display:'flex', gap:20}}>{radio('paid', 'Paid')}{!oneTime && radio('partial', 'Partially Paid')}{radio('unpaid', 'Unpaid')}</div>
          {/* A paid One-Time payment: its date; Unpaid reverses the payment, which stays in the record's activity. */}
          {wasPaid && (unpaid
            ? <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>The payment of {fmtMoney(st.received, cur)} on {fmtQuoteDate(last.paidOn)} will be reversed. It stays in the record's activity.</div>
            : <PayDetail label="Payment Date">{fmtQuoteDate(last.paidOn)}</PayDetail>)}
          {partial && <>
            <div><label style={fieldLabel}>Amount received ({cur})</label>
              <input autoFocus value={amount} onChange={e=>setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0"
                style={{...fieldInput, fontVariantNumeric:'tabular-nums', borderColor: amount && !amountOk ? T.red : T.borderStrong}}/>
              {amount && !amountOk && <div style={{fontSize:12, color:T.red, marginTop:4}}>Less than {fmtMoney(due, cur)} — a full payment is Paid.</div>}
            </div>
            <div><label style={fieldLabel}>Remaining Balance Expected On</label><DateField required value={expected} onChange={setExpected}/>
              {expected && !expectedOk && <div style={{fontSize:12, color:T.red, marginTop:4}}>Choose today or a later date.</div>}</div>
          </>}
          {!unpaid && !wasPaid && <>
          <div><label style={fieldLabel}>Payment Date</label><DateField required value={paidOn} onChange={setPaidOn}/>
            {paidOn && !paidOnOk && <div style={{fontSize:12, color:T.red, marginTop:4}}>A payment can't be dated in the future.</div>}</div>
          <div>
            <label style={fieldLabel}>Payment Evidence</label>
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              <EvidenceFile tall value={file} accept="image/*,.pdf" onClear={()=>setFile(null)} onChange={(f)=>readUpload(f).then(v => { setFile(v); setError(''); }).catch(e => setError(e.message))}/>
              <input value={link} onChange={e=>setLink(e.target.value)} placeholder="Payment gateway or reference link (https://…)" aria-label="Reference link"
                style={{...fieldInput, borderColor: linkOk ? T.borderStrong : T.red}}/>
              {error && <div style={{fontSize:12, color:T.red}}>{error}</div>}
            </div>
          </div>
          </>}
        </div>
      </div>
    </StModal>, document.body);
}

function PaymentStatusPill({status}){ return <StatusPill status={status} map={PAYMENT_STATUS}/>; }
// A label / value line in the payment modals.
const PayDetail = ({label, children}) => (
  <div style={{display:'flex', justifyContent:'space-between', gap:12, fontSize:13, color:T.attioText}}>
    <span style={{whiteSpace:'nowrap'}}>{label}</span>
    <span style={{fontWeight:600, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontVariantNumeric:'tabular-nums'}}>{children}</span>
  </div>
);
/* ── View payment ── the installment, its amount and its payment evidence: a gateway link
   (online) opens the gateway; an uploaded screenshot opens to the right of the details. */
function PaymentSuccessIcon(){
  return (
    <svg width={64} height={64} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx={32} cy={32} r={32} fill="#ECFDF3"/>
      <circle cx={32} cy={32} r={23} fill="#D1FADF"/>
      <path d="M22.5 32.5l6.5 6.5 12.5-13" stroke="#039855" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function PaymentVerificationModal({inst, currency, onClose}){
  const [shown, setShown] = React.useState(null);   // the payment whose screenshot is open
  const a = {...formTextAction, fontWeight:400};
  const evidence = (inst.payments || []).map(p => {
    const ev = p.evidence || {};
    if(ev.link) return <a key={p.id} href={ev.link} target="_blank" rel="noopener noreferrer" style={a}>Payment gateway</a>;
    if(ev.file && /^image\//.test(ev.file.type || '')) return <button key={p.id} type="button" onClick={()=>setShown(shown && shown.id === p.id ? null : p)} style={a}>Payment Image</button>;
    if(ev.file) return <a key={p.id} href={ev.file.dataUrl} download={ev.file.name} style={a}>{ev.file.name}</a>;
    return null;
  }).filter(Boolean);
  return ReactDOM.createPortal(
    <StModal title="View Payment" hideCancel width={shown ? 860 : 424} onCancel={onClose}>
      <div style={{display:'grid', gridTemplateColumns: shown ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', gap:20}}>
        <div style={{display:'flex', flexDirection:'column', gap:14, minHeight:280}}>
          <div style={{display:'flex', justifyContent:'center', padding:'4px 0 6px'}}><PaymentSuccessIcon/></div>
          <PayDetail label="Installment">{inst.description}</PayDetail>
          {/* What was paid on it (a part payment's amount, not the installment's). */}
          <PayDetail label="Amount">{fmtMoney(r2((inst.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0)), currency)}</PayDetail>
          <div style={{display:'flex', justifyContent:'space-between', gap:12, fontSize:13, color:T.attioText}}>
            <span style={{whiteSpace:'nowrap'}}>Payment Evidence</span>
            <span style={{display:'flex', gap:10, minWidth:0}}>{evidence.length ? evidence : <span style={{color:T.attioMuted}}>—</span>}</span>
          </div>
        </div>
        {shown && (
          <img src={shown.evidence.file.dataUrl} alt={shown.evidence.file.name}
            style={{display:'block', width:'100%', maxHeight:520, objectFit:'contain', borderRadius:10, border:`1px solid ${T.attioLine}`, background:T.headerBg}}/>
        )}
      </div>
    </StModal>, document.body);
}

/* One set of payment terms, laid straight into the tab: its payment type and totals, then the
   payments across the full width — Installment, Amount, Status, Invoice Date, Due Date, Actions —
   each on one line (a date not set yet: Day N from signing). Narrower than its columns, the table
   scrolls sideways and Actions stays in view. */
const SCHEDULE_COLS = 'minmax(200px, 2fr) minmax(112px, 1fr) minmax(124px, 1fr) minmax(120px, 1fr) minmax(120px, 1fr) 150px';
const SCHEDULE_MIN_W = 826;
// A One-Time payment: one row — Amount, Status, Invoice Date, Due Date, Paid On, Actions.
const ONE_TIME_COLS = 'minmax(140px, 1fr) minmax(124px, 1fr) minmax(120px, 1fr) minmax(120px, 1fr) minmax(120px, 1fr) 250px';
const ONE_TIME_MIN_W = 874;
// A payment's invoice and due dates as the table shows them: the date, else Day N, else —; saved before plans, the invoice it had.
const invoiceCell = (inst) => fmtQuoteDate(inst.invoiceDate || inst.invoicedAt) || inst.invoiceTentative || '—';
const dueCell = (inst) => fmtQuoteDate(inst.dueDate) || inst.tentative || '—';
// `canEdit`: edit the terms and record payments (Payment Terms → Edit).
// `archived`: a record's extra structure saved before one-per-record — shown read-only.
function PaymentScheduleCard({schedule, canEdit, canPay, quote, pullable, archived, onPay, onView, onEdit, onOpenQuote, onCancelSubscription}){
  const t = scheduleTotals(schedule), type = paymentTypeOf(schedule), oneTime = type === 'one-time';
  // Every row (header included) one line, at the record tables' row height.
  const head = {fontSize:11.5, fontWeight:500, color:T.attioMuted, height:T.attioRowH, padding:'0 12px', display:'flex', alignItems:'center', whiteSpace:'nowrap'};
  const cell = {fontSize:13, color:T.attioText, height:T.attioRowH, padding:'0 12px', minWidth:0, display:'flex', alignItems:'center', whiteSpace:'nowrap'};
  // One line: longer text ends in an ellipsis (its full value on hover).
  const clip = {minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'};
  const num = {...cell, justifyContent:'flex-end', fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap'};
  // Actions: the sticky last column, as on the record tables.
  const actionsCol = {position:'sticky', right:0, zIndex:1, borderLeft:`1px solid ${T.attioLine}`};
  // Compact KPIs: a label over its value.
  const summary = (label, value, tone) => (
    <div style={{minWidth:150, padding:'8px 12px', border:`1px solid ${T.attioLine}`, borderRadius:8}}>
      <div style={{fontSize:12, color:T.attioMuted, whiteSpace:'nowrap'}}>{label}</div>
      <div style={{fontSize:14, fontWeight:600, color: tone || T.attioText, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap', marginTop:1}}>{fmtMoney(value, scheduleCurrency(schedule))}</div>
    </div>
  );
  return (
    <div style={{borderBottom:`1px solid ${T.border}`, paddingBottom:8}}>
      <div style={{padding:'16px 24px 14px', display:'flex', flexDirection:'column', gap:12}}>
        <div style={{display:'flex', alignItems:'flex-start', gap:8}}>
          <div style={{flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:2}}>
            <div style={{display:'flex', alignItems:'center', gap:8, minWidth:0}}>
              <span style={{fontSize:14, fontWeight:600, color:T.attioText, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{PAYMENT_TYPE_LABEL[type]}{type === 'recurring' && schedule.plan ? ` · ${RECURRING_FREQUENCY[schedule.plan.frequency] || 'Monthly'}` : ''}</span>
              {/* A subscription until cancelled, once cancelled: nothing invoiced after the day. */}
              {schedule.cancelledOn && <StatusPill status="cancelled" map={{cancelled:{label:`Cancelled ${fmtQuoteDate(schedule.cancelledOn)}`, tone:'danger'}}}/>}
              {/* Imported: links to the quotation it came from (gone if it was deleted). */}
              {schedule.source !== 'manual' && <>
                <button type="button" disabled={!quote} onClick={()=>quote && onOpenQuote(quote)} title={quote ? quote.number : undefined}
                  style={{display:'inline-flex', alignItems:'center', gap:5, border:'none', fontFamily:'inherit', fontSize:11.5, fontWeight:500, padding:'2px 8px', borderRadius:9999,
                    background:T.blueLight, color:T.blue, whiteSpace:'nowrap', cursor: quote ? 'pointer' : 'default'}}>
                  <Icon name="quote" size={11} color={T.blue}/>
                  <span style={quote ? {textDecorationLine:'underline', textUnderlineOffset:2} : undefined}>Imported from Quote</span></button>
                {!quote && <span style={{fontSize:12, color:T.attioMuted, whiteSpace:'nowrap'}}>Quote deleted</span>}
              </>}
            </div>
            <span style={{fontSize:12, color:T.attioMuted}}>Created {fmtQuoteDate(schedule.createdAt)} by {schedule.createdBy}</span>
          </div>
          {/* Edit and Pull from quote: until the first payment is recorded — payments are never
              removed. A One-Time payment's Edit stays (its amount and type can change). A
              subscription until cancelled: Cancel Subscription, once; cancelled, nothing more.
              Archived terms (`archived`) have none. */}
          {canEdit && !archived && (
            <RowActionsMenu title="Payment Terms Actions" items={[
              {label:'Edit Payment Terms', disabled:(!oneTime && hasPayments(schedule)) || !!schedule.cancelledOn, onClick:onEdit},
              ...(pullable && pullable.length ? [{label:'Pull from Quote', disabled:hasPayments(schedule) || !!schedule.cancelledOn, onClick:onEdit}] : []),
              ...(planOngoing(schedule.plan) && !schedule.cancelledOn ? [{label:'Cancel Subscription', danger:true, onClick:onCancelSubscription}] : [])]}/>
          )}
        </div>
        <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          {summary('Total', t.total)}{summary('Received', t.received, '#027A48')}{summary('Outstanding', t.outstanding, t.outstanding > 0 ? '#B54708' : null)}
        </div>
      </div>
      {oneTime ? <OneTimePaymentRow schedule={schedule} canAct={canEdit && canPay && !archived} archived={archived} head={head} cell={cell} num={num} clip={clip} actionsCol={actionsCol} onPay={onPay} onView={onView}/> : (
      <div style={{overflowX:'auto'}}>
        <div style={{minWidth:SCHEDULE_MIN_W}}>
          <div style={{display:'grid', gridTemplateColumns:SCHEDULE_COLS, background:T.headerBg, borderTop:`1px solid ${T.attioLine}`, borderBottom:`1px solid ${T.attioLine}`}}>
            <span style={{...head, paddingLeft:24}}>Installment</span><span style={{...head, justifyContent:'flex-end'}}>Amount</span>
            <span style={head}>Status</span><span style={head}>Invoice Date</span><span style={head}>Due Date</span><span style={{...head, ...actionsCol, background:T.headerBg}}>Actions</span>
          </div>
          {!schedule.installments.length && <div style={{padding:'14px 24px', fontSize:13, color:T.attioMuted}}>No installments</div>}
          {schedule.installments.map(inst => {
            const st = installmentState(schedule, inst);
            const parent = inst.parentId && schedule.installments.find(x => x.id === inst.parentId);
            return (
              <div key={inst.id} style={{borderBottom:`1px solid ${T.attioLine}`}}>
                <div style={{display:'grid', gridTemplateColumns:SCHEDULE_COLS}}>
                  <span style={{...cell, gap:6, paddingLeft: parent ? 40 : 24}}>
                    {parent && <span style={{color:T.attioMuted}}>↳</span>}
                    <span style={{minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={inst.description}>{inst.description}</span>
                  </span>
                  <span style={num}>{fmtMoney(inst.amount, scheduleCurrency(schedule))}</span>
                  <span style={{...cell, gap:6}}><PaymentStatusPill status={st.status}/>
                    {/* A workflow violation about this installment (e.g. it must be paid by now). */}
                    {!archived && <ViolationMark inst={inst.id}/>}</span>
                  <span style={{...cell, fontVariantNumeric:'tabular-nums'}}><span style={clip}>{invoiceCell(inst)}</span></span>
                  <span style={{...cell, fontVariantNumeric:'tabular-nums'}}><span style={clip}>{dueCell(inst)}</span></span>
                  <span style={{...cell, ...actionsCol, background:'#fff'}}>
                    {st.status === 'unpaid' && canEdit && canPay && !archived && <button onClick={()=>onPay(inst)} style={{...btnSecondarySm, height:26, padding:'0 10px', whiteSpace:'nowrap'}}>Update status</button>}
                    {(inst.payments || []).length > 0 && (
                      <button onClick={()=>onView(inst)} style={{...formTextAction, display:'inline-flex', alignItems:'center', gap:6, whiteSpace:'nowrap'}}>
                        <Icon name="check" size={12} color="#027A48"/> View payment</button>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>)}
    </div>
  );
}
/* A One-Time payment in the tab: its amount, status, invoice and due dates and the date it was
   paid (the date it was made is the card's); Update status (Paid, or back to Unpaid) and View payment. */
function OneTimePaymentRow({schedule, canAct, archived, head, cell, num, clip, actionsCol, onPay, onView}){
  const inst = schedule.installments[0], st = installmentState(schedule, inst);
  const paidOn = st.status === 'paid' ? (inst.payments[inst.payments.length - 1] || {}).paidOn : null;
  return (
    <div style={{overflowX:'auto'}}>
      <div style={{minWidth:ONE_TIME_MIN_W}}>
        <div style={{display:'grid', gridTemplateColumns:ONE_TIME_COLS, background:T.headerBg, borderTop:`1px solid ${T.attioLine}`, borderBottom:`1px solid ${T.attioLine}`}}>
          <span style={{...head, paddingLeft:24, justifyContent:'flex-end'}}>Amount</span><span style={head}>Status</span><span style={head}>Invoice Date</span><span style={head}>Due Date</span><span style={head}>Paid On</span>
          <span style={{...head, ...actionsCol, background:T.headerBg}}>Actions</span>
        </div>
        <div style={{display:'grid', gridTemplateColumns:ONE_TIME_COLS, borderBottom:`1px solid ${T.attioLine}`}}>
          <span style={{...num, paddingLeft:24}}>{fmtMoney(inst.amount, scheduleCurrency(schedule))}</span>
          <span style={{...cell, gap:6}}><PaymentStatusPill status={st.status}/>{!archived && <ViolationMark inst={inst.id}/>}</span>
          <span style={{...cell, fontVariantNumeric:'tabular-nums'}}><span style={clip}>{invoiceCell(inst)}</span></span>
          <span style={{...cell, fontVariantNumeric:'tabular-nums'}}><span style={clip}>{dueCell(inst)}</span></span>
          <span style={{...cell, fontVariantNumeric:'tabular-nums'}}><span style={clip}>{paidOn ? fmtQuoteDate(paidOn) : '—'}</span></span>
          <span style={{...cell, ...actionsCol, background:'#fff', gap:12}}>
            {canAct && <button onClick={()=>onPay(inst)} style={{...btnSecondarySm, height:26, padding:'0 10px', whiteSpace:'nowrap'}}>Update status</button>}
            {(inst.payments || []).length > 0 && (
              <button onClick={()=>onView(inst)} style={{...formTextAction, display:'inline-flex', alignItems:'center', gap:6, whiteSpace:'nowrap'}}>
                <Icon name="check" size={12} color="#027A48"/> View payment</button>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── The record's Accounting tab ── its one Payment Terms (primaryTermsOf); any archived ones
   under it, read-only. */
// A customer with a deal: the deal's Payment Terms (termsHolderOf), as the deal shows them.
function AccountingTab({object, record}){
  const hub = useRecordHub(), holder = termsHolderOf(object, record);
  const deal = holder.object !== object ? (((hub && hub.records) || {}).deals || []).find(d => d.id === holder.id) : null;
  return deal ? <RecordAccounting key={deal.id} object="deals" record={deal}/> : <RecordAccounting object={object} record={record}/>;
}
function RecordAccounting({object, record}){
  const hub = useRecordHub();
  const [paying, setPaying] = React.useState(null);   // {scheduleId, instId}
  const [viewing, setViewing] = React.useState(null); // {scheduleId, instId}: View payment
  const [editing, setEditing] = React.useState(null); // {id}: the Edit Payment Terms panel
  const [cancelling, setCancelling] = React.useState(null); // the subscription being cancelled (its id)
  const [showArchived, setShowArchived] = React.useState(false);
  const [quoteOpen, setQuoteOpen] = React.useState(null); // the quotation opened from "Imported from Quote"
  // Payment Terms permissions (Records → <Object> → Accounting), by the record's owner.
  const can = (action) => paymentTermsCan(action, object, record);
  const canEdit = can('edit');
  const stored = (hub.accounting || []).filter(s => s.object === object && String(s.recordId) === String(record.id));
  const quotes = recordQuotes(hub, object, record);
  // Quotes sent to the record whose terms haven't been pulled yet (an expired one can't be).
  const pullable = quotes.filter(q => ['sent', 'signed'].includes(q.status) && !quoteExpired(q) && !(hub.accounting || []).some(s => s.quoteId === q.id));
  const all = stored;
  const primary = primaryTermsOf(stored), archivedList = stored.filter(s => s !== primary);
  // Pull from quote fills the one structure (same id) — only while nothing is paid; once per quote.
  const pull = (q) => {
    if(!primary || hasPayments(primary) || (hub.accounting || []).some(s => s.quoteId === q.id)) return;
    hub.setAccounting(list => list.some(s => s.quoteId === q.id) ? list
      : list.map(s => s.id === primary.id ? {...scheduleFromQuote(q, object, record), id:primary.id, createdAt:primary.createdAt, createdBy:primary.createdBy, ...(s.reversed ? {reversed:s.reversed} : {})} : s));
    setEditing(null);
    hub.toast(`Payment terms pulled from ${q.number}`);
  };
  // A One-Time payment's changes and a payment type switch, in the record's activity (Payment).
  const logPayment = (action, change) => hub.add(object, record.id, {type:'payment', action, ...change, source:'you', by:CURRENT_USER.name});
  // Recording a payment: the structure (a quote's, as it stands) is saved with the payment.
  const savePayment = (scheduleId, instId, v) => {
    const base = all.find(s => s.id === scheduleId); if(!base || !(Number(v.amount) > 0)) return;   // a payment is more than 0
    if(paymentTypeOf(base) === 'one-time') logPayment('Marked Paid', {detail:`${fmtMoney(v.amount, scheduleCurrency(base))} · Paid on ${fmtQuoteDate(v.paidOn)}`});
    hub.setAccounting(list => {
      const s = list.find(x => x.id === scheduleId) || base;
      const inst = s.installments.find(x => x.id === instId);
      if(!inst || installmentState(s, inst).status !== 'unpaid') return list;   // forward only
      const payment = {id:acId('pay'), amount:v.amount, paidOn:v.paidOn, recordedAt:new Date(), recordedBy:CURRENT_USER.name,
        evidence:(v.evidence.file || v.evidence.link) ? v.evidence : null};
      let installments = s.installments.map(x => x.id === instId ? {...x, payments:[...(x.payments || []), payment]} : x);
      if(v.status === 'partial'){
        const remaining = r2(inst.amount - v.amount);
        const total = scheduleTotals(s).total || 1;
        const balance = {id:acId('pi'), parentId:inst.id, description:`Balance of ${inst.description}`, percent:r2(remaining / total * 100), amount:remaining, dueDate:v.expected, tentative:'', payments:[]};
        const at = installments.findIndex(x => x.id === instId);
        installments = [...installments.slice(0, at + 1), balance, ...installments.slice(at + 1)];
      }
      const next = {...s, installments};
      return list.some(x => x.id === scheduleId) ? list.map(x => x.id === scheduleId ? next : x) : [...list, next];
    });
    setPaying(null);
    hub.toast(paymentTypeOf(base) === 'one-time' ? 'Payment marked as paid' : v.status === 'paid' ? 'Installment marked as paid' : 'Partial payment recorded');
  };
  /* A paid One-Time payment back to Unpaid: its payment moves to the terms' `reversed` list (who and
     when) — out of Cash Received, never deleted — and the record's activity says so. */
  const reversePayment = (scheduleId, instId) => {
    const base = all.find(s => s.id === scheduleId), inst = base && base.installments.find(x => x.id === instId);
    if(!inst || paymentTypeOf(base) !== 'one-time' || !(inst.payments || []).length) return;
    const at = new Date(), pays = inst.payments;
    hub.setAccounting(list => list.map(s => s.id !== scheduleId ? s : {...s,
      reversed:[...(s.reversed || []), ...pays.map(p => ({...p, instId, reversedAt:at, reversedBy:CURRENT_USER.name}))],
      installments:s.installments.map(x => x.id === instId ? {...x, payments:[]} : x)}));
    logPayment('Marked Unpaid', {detail:`${fmtMoney(r2(pays.reduce((a, p) => a + (Number(p.amount) || 0), 0)), scheduleCurrency(base))} paid on ${fmtQuoteDate(pays[pays.length - 1].paidOn)} reversed`});
    setPaying(null);
    hub.toast('Payment marked as unpaid');
  };
  /* Saving the terms (a plan): they become the record's own (a quote's terms edited here are no
     longer the quote's), their payments made by the plan (planSchedule) — Quote Signed dated from
     the record's signed quote (none yet: when one is signed). A payment kept through the edit (the
     same id) keeps its invoice — invoicing is history. A paid One-Time payment keeps its payment:
     of the new amount (One-Time), or as the deposit (Installment). Reversed payments (`reversed`)
     stay whatever the type. Installment and Recurring terms with payments aren't edited (their ⋯
     Edit is off). */
  const saveManual = (plan) => {
    const id = editing && editing.id, s0 = all.find(s => s.id === id);
    if(!s0) return;
    const was = paymentTypeOf(s0), first = s0.installments[0], paidOne = was === 'one-time' && hasPayments(s0) ? first : null;
    if(was !== 'one-time' && hasPayments(s0)) return;
    const signedOn = plan.issue.type === 'signed' ? quoteSignedOn(hub.quotes, s0) : '';
    const installments = planSchedule(plan, {id:s0.id, signedOn}).map(x => { const o = s0.installments.find(p => p.id === x.id); return o && o.invoicedAt ? {...x, invoicedAt:o.invoicedAt} : x; });
    // One-Time to One-Time: the same payment (its id, its payments now of the amount); a paid one to Installment: the deposit, as paid.
    if(first && (paidOne || (was === 'one-time' && plan.paymentType === 'one-time'))) installments[0] = {...installments[0], id:first.id, createdAt:first.createdAt, ...(first.invoicedAt ? {invoicedAt:first.invoicedAt} : {}),
      payments: plan.paymentType === 'one-time' ? (first.payments || []).map(p => ({...p, amount:installments[0].amount})) : first.payments};
    const total = r2(installments.reduce((a, x) => a + x.amount, 0));
    const next = {id:s0.id, source:'manual', object:s0.object, recordId:s0.recordId, createdAt:s0.createdAt, createdBy:s0.createdBy, ...(s0.reversed ? {reversed:s0.reversed} : {}),
      paymentType:plan.paymentType, currency:plan.currency, total, plan, ...(signedOn ? {signedOn} : {}), installments};
    hub.setAccounting(list => list.map(s => s.id === id ? next : s));
    const before = fmtMoney(scheduleTotals(s0).total, scheduleCurrency(s0)), after = fmtMoney(total, plan.currency);
    if(was !== plan.paymentType) logPayment('Payment type changed', {from:PAYMENT_TYPE_LABEL[was], to:PAYMENT_TYPE_LABEL[plan.paymentType]});
    else if(was === 'one-time' && before !== after) logPayment('Amount changed', {from:before, to:after});
    setEditing(null);
    hub.toast('Payment terms saved');
  };
  /* Cancel Subscription (until cancelled): from the day chosen nothing more is invoiced — the cycles
     after it go, unless something's paid on them; what's invoiced by then stays owed. In the
     record's activity (Payment). */
  const cancelSubscription = (id, on) => {
    const s0 = all.find(s => s.id === id); if(!s0 || !planOngoing(s0.plan) || s0.cancelledOn) return;
    hub.setAccounting(list => list.map(s => s.id === id ? refreshSchedule(s, {cancelledOn:on}) : s));
    logPayment('Subscription cancelled', {detail:`No invoices after ${fmtQuoteDate(on)}`});
    setCancelling(null);
    hub.toast('Subscription cancelled');
  };
  const payingSchedule = paying && all.find(s => s.id === paying.scheduleId);
  const payingInst = payingSchedule && payingSchedule.installments.find(x => x.id === paying.instId);
  const viewingSchedule = viewing && all.find(s => s.id === viewing.scheduleId);
  const viewingInst = viewingSchedule && viewingSchedule.installments.find(x => x.id === viewing.instId);
  const openedQuote = quoteOpen && quotes.find(q => q.id === quoteOpen);
  const editingSchedule = editing && all.find(s => s.id === editing.id);
  const editingType = editingSchedule && paymentTypeOf(editingSchedule), editingPaid = editingType === 'one-time' && hasPayments(editingSchedule) ? editingSchedule.installments[0] : null;
  // The terms as a plan to edit (saved before plans: as one — planOf); a paid One-Time payment's amount.
  const editingPlan = editingSchedule ? {...planOf(editingSchedule), currency:editingSchedule.currency || (scheduleTotals(editingSchedule).total > 0 ? LEGACY_CURRENCY : defaultCurrency()),
    ...(editingPaid ? {paid:{id:editingPaid.id, amount:installmentState(editingSchedule, editingPaid).received}} : {})} : null;
  const card = (s, archived) => {
    const quote = s.source !== 'manual' ? quotes.find(q => q.id === s.quoteId) || null : null;
    return <PaymentScheduleCard key={s.id} schedule={s} quote={quote} archived={archived} canEdit={canEdit} pullable={pullable}
      canPay={s.source === 'manual' || hasPayments(s) || (quote && quote.status === 'signed')}
      onPay={(inst)=>setPaying({scheduleId:s.id, instId:inst.id})} onView={(inst)=>setViewing({scheduleId:s.id, instId:inst.id})}
      onEdit={()=>setEditing({id:s.id})} onOpenQuote={(q)=>setQuoteOpen(q.id)} onCancelSubscription={()=>setCancelling(s.id)}/>;
  };
  if(!can('view')) return <div style={{flex:1, padding:'48px 24px', textAlign:'center', fontSize:13, color:T.gray400}}>You don't have access to this record's payment terms.</div>;
  return (
    <div style={{flex:1, minHeight:0, minWidth:0, display:'flex', flexDirection:'column', position:'relative'}}>
      <div style={{display:'flex', alignItems:'center', gap:10, padding:'12px 20px', borderBottom:`1px solid ${T.border}`, flexShrink:0}}>
        <span style={{fontSize:13, fontWeight:600, color:T.attioText}}>Payment Terms</span>
      </div>
      <div style={{flex:1, minHeight:0, overflowY:'auto', paddingBottom:32, display:'flex', flexDirection:'column'}}>
        {primary && card(primary, false)}
        {!primary && <EmptyState compact title="No payment terms yet"/>}
        {/* Archived: extra structures saved before one-per-record — read-only. */}
        {archivedList.length > 0 && <>
          <button type="button" onClick={()=>setShowArchived(v => !v)} style={{...formTextAction, alignSelf:'flex-start', margin:'14px 24px 6px', display:'inline-flex', alignItems:'center', gap:6}}>
            <Icon name="chevDown" size={11} color={T.gray600} style={{transform: showArchived ? 'none' : 'rotate(-90deg)'}}/>
            Archived payment terms ({archivedList.length})
          </button>
          {showArchived && archivedList.map(s => card(s, true))}
        </>}
      </div>
      {payingInst && <PaymentModal schedule={payingSchedule} inst={payingInst} oneTime={paymentTypeOf(payingSchedule) === 'one-time'} onCancel={()=>setPaying(null)}
        onSave={(v)=>savePayment(payingSchedule.id, payingInst.id, v)} onReverse={()=>reversePayment(payingSchedule.id, payingInst.id)}/>}
      {cancelling && <CancelSubscriptionModal onCancel={()=>setCancelling(null)} onSave={(on)=>cancelSubscription(cancelling, on)}/>}
      {viewingInst && <PaymentVerificationModal inst={viewingInst} currency={scheduleCurrency(viewingSchedule)} onClose={()=>setViewing(null)}/>}
      {editing && editingPlan && <PaymentStructurePanel key={editing.id} initial={editingPlan} signedOn={quoteSignedOn(hub.quotes, editingSchedule)}
        onCancel={()=>setEditing(null)} onSave={saveManual} pullable={hasPayments(editingSchedule) ? [] : pullable} onPull={pull}/>}
      {/* The quotation, as on Tools → Quotes. */}
      {openedQuote && <PageSidePanel title={openedQuote.number}
        onClose={()=>setQuoteOpen(null)}>
        <div style={{flex:1, overflowY:'auto', padding:'4px 20px 24px'}}><QuoteDocument quote={openedQuote}/></div>
      </PageSidePanel>}
    </div>
  );
}

Object.assign(window, {RECURRING_FREQUENCY, rollSubscription, refreshSchedule, planOngoing, newPaymentPlan, planSchedule, planTotal, planOk, planOf, planOfShares, normalizePlan, invoicedOn, dayOf, datePlansOnSigning, PaymentTermsFields, PaymentPlanTable, PAYMENT_TYPE_LABEL, paymentTypeOf, scheduleCurrency, primaryTermsOf, hasPayments, recordHasPayments, termsHolderOf, defaultPaymentTerms, defaultTermsOf, packPaymentTerms, unpackPaymentTerms, AccountingTab, ACCOUNTING_RECORD_TYPES, installmentState, scheduleTotals});
