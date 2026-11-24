/* HOF Pulse ERP — Accounting: a record's Payment Plans (record detail → Accounting tab, on
   Contacts, Deals and Customers). Invoicing: invoices.jsx.

   Payment Plans (were Payment Terms; decided 2026-11-12): a record has any number of them, none to
   start with — Add Payment Plan makes one, and signing a quote or a document with a payment term
   makes one from it (plansOnQuoteSigned; documents.jsx plansFromDocument), linked to it ("From
   Quote" / "From Document"). Each has a number (PP-<year>-<nnnn>) and sits in one of the tab's
   three tabs: Active; Paid — every payment reconciled and nothing left to bill (planState); Frozen.
   Marking the payment that settles a plan switches the tab to Paid, where the plan now is (2026-11-23).
   A plan's fields (PaymentTermsFields — the same on a quote's Payment Plan step and a document's
   Add Payment Plan) are one of three types:
     One-Time Payment    — currency, amount, invoice issue date (Quote Signed or a fixed date) and
       due date (Due on Receipt, Net 7 … Net 60, a custom date or a custom number of days). Update
       Status marks it Paid (the payment date: today or an earlier day; proof required) or, once
       Paid, Unpaid again: the payment is reversed — kept on the plan (`reversed`) and in the
       record's activity; a payment's date never changes. Once Paid its amount is fixed.
     Installment Payment — currency, total amount; a deposit (a fixed amount or a percentage of the
       total) with its own invoice issue date and due date; the rest in equal installments, due
       every 30 days after the deposit, each invoiced on its due date, 1 to 3 days or a week before,
       or a custom number of days before (1 day by default). Edit on the schedule sets each amount
       and date, names an installment (the Deposit stays the Deposit; unnamed: "Installment N")
       and adds or deletes installments: the schedule then bills what's set, whether or not it
       adds up to the total. Since 2026-11-24 an edited installment's Invoice Issue Date and
       Payment Due Date are each optional — empty, a Day (N days from Day 0: the signing or the
       fixed date) or a Date (DayOrDateField: a menu, Day and Date each opening a panel beside it);
       Edit starts with the dates the schedule had, as Days until the plan is dated. Empty: no date,
       no invoice until one is set.
   Discount & Tax (2026-11-24): every plan has Amount, Discount (% or an amount) and VAT (%; 5 on a
   new plan, none on one saved before) down to its Total (planMoney) — the Total its payments split.
   A plan and a quote link (2026-11-24): Add Payment Plan's Quote pulls a draft or sent quote in
   (its terms, its services subtotal as the Amount, its discount — a Referral Discount added in as
   an amount — and its VAT: the same Total), and a quote's Payment Plan step can start from one of
   its record's plans (quotes.jsx). Linked (`linkedPlanId` on the quote, `quoteId` on the plan,
   "From Q-…"), signing the quote updates that plan — the next revision (revisePlan) — and makes
   no other. A plan made from a signed quote can still be edited; its changed invoices are
   archived and issued again.
     Recurring Payment   — a subscription: the same amount every month (30 days) or year, its first
       invoice issued when the quote is signed or on a fixed date, each due by its terms; for a
       number of years, or until cancelled (Cancel Subscription).
   The plan makes the payments (planSchedule) — real dated installments, so the Accounting
   properties, Forecasted Cash and workflows read every type alike — and every payment its own
   invoice (invoices.jsx), issued on its invoice date. Quote Signed waits for the record's quote to
   be signed: until then the dates read "Day N" from signing (plansOnQuoteSigned dates them).
   Editing (⋯ Edit Payment Plan, at any time — frozen too): a payment with anything paid on it keeps
   its amount and dates (shown locked); the rest follow the new plan. Each save is a revision
   (`revision`, the ones before in `revisions`); an issued, unpaid invoice whose payment changed is
   archived and the payment invoiced again (archiveChangedInvoices). A paid One-Time Payment can
   become an Installment Payment's paid deposit (Recurring isn't offered then); otherwise the type
   is fixed once anything's paid. Creating, editing, freezing and each One-Time change are in the
   record's activity (Payment).
   Freeze: Save and Freeze when adding one, or Freeze Plan at the top of its panel. Frozen, no
   invoice is issued and no payment recorded; its invoices and payments stay. Unfreeze Plan brings
   it back — what fell due meanwhile is invoiced then. Cancel Subscription (until cancelled, ⋯): the
   day it ends — nothing is invoiced after it; what's invoiced by then stays owed. Once cancelled,
   the plan can't be edited.
   Records saved before plans: their untouched starting terms are dropped (migratePlans); the rest
   are plans, numbered in the order they were made, their installments as they were (edited, they
   open as a plan — planOf).

   Installment payments only move forward (no edit or undo until a correction workflow is defined):
     Unpaid          — nothing received.
     Partially Paid  — an amount received (less than the installment); the rest becomes its own
                       payment, linked to the original ("Balance of …"), with its own amount,
                       expected date, status and invoice (the original's is archived, keeping what
                       was received). The original keeps its amount and payment.
     Paid            — the installment's outstanding amount received in full: its invoice Paid.
   Each payment is its own record: amount (more than 0), date (today or earlier), who recorded it,
   and its proof — an uploaded screenshot (≤2 MB) and / or a payment gateway or reference link (one
   of them required). A part payment's balance is expected today or later.

   Whose plans a record shows (planScopeOf; decided 2026-11-16): its own, those of every record
   above it and of every record below it — Contact → Deal → Customer, by their links, whatever the
   link's type — and never a sibling's. A contact's show on its deals and customers; a deal's on its
   contacts and its customers, not on the contact's other deals; a customer's on its deals and
   contacts, not on the deal's other customers. It's one plan wherever it shows: edited, frozen and
   paid from any of them (its activity on the record it was added to), named there by a tag with
   that record, and counted in each one's Accounting properties — the dashboard and Goals count a
   plan once.

   Recording payments and editing plans need edit access to the record; everyone who can see
   it sees its plans. A record with payments recorded can't be deleted (recordHasPayments) —
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
  return !!(p && p.enabled && permissionCovers(p.edit, object, record, 'edit'));
}
const hasPayments = (s) => (s.installments || []).some(x => (x.payments || []).length);
/* The payment type (see the header): set when the terms are saved; before that, untouched default
   terms — one installment, no due date — are One-Time, anything else Installment. A Subscription
   (saved before Recurring) is Recurring. */
const PAYMENT_TYPE_LABEL = {'one-time':'One-Time Payment', installments:'Installment Payment', recurring:'Recurring Payment'};
const PAYMENT_TYPES = [['one-time', 'One-Time'], ['installments', 'Installment'], ['recurring', 'Recurring']];
const RECURRING_FREQUENCY = {weekly:'Weekly', monthly:'Monthly', yearly:'Yearly'};
const paymentTypeOf = (s) => s.paymentType === 'subscription' ? 'recurring' : s.paymentType || (s.source === 'manual' && (s.installments || []).length === 1 && !s.installments[0].dueDate ? 'one-time' : 'installments');
/* Whose Payment Plans a record shows (see the header): its own, and those of the records above
   and below it — Contact → Deal → Customer, by their links — never a sibling's. `records`:
   {contacts, deals, customers}, or the workflow engine's one list of them all (WF_LIVE.records). */
const planLinksMemo = new WeakMap();   // a records list → who's linked to whom, worked out once
function planLinks(records){
  const flat = Array.isArray(records), key = flat ? records : (records && records.deals) || null;
  const customersIn = flat ? null : (records && records.customers) || [];
  const hit = key && planLinksMemo.get(key);
  if(hit && hit.customers === customersIn) return hit;
  const deals = flat ? records.filter(r => recordObjectOf(r.id) === 'deals') : key || [];
  const customers = flat ? records.filter(r => recordObjectOf(r.id) === 'customers') : customersIn;
  const push = (m, k, v) => { k = String(k); m.has(k) ? m.get(k).push(v) : m.set(k, [v]); };
  const links = {customers:customersIn, contactDeals:new Map(), contactCustomers:new Map(), dealCustomers:new Map(), dealContacts:new Map()};
  deals.forEach(d => { links.dealContacts.set(String(d.id), contactIdsOf(d)); contactIdsOf(d).forEach(c => push(links.contactDeals, c, d.id)); });
  customers.forEach(c => { contactIdsOf(c).forEach(x => push(links.contactCustomers, x, c.id)); (c.dealIds || []).forEach(d => push(links.dealCustomers, d, c.id)); });
  if(key) planLinksMemo.set(key, links);
  return links;
}
// The records whose plans a record shows, as "<object>|<id>" (itself first). The same records show its own plans.
function planScopeOf(object, record, records = WF_LIVE.records){
  if(!record) return [];
  const l = planLinks(records), id = String(record.id), of = (m, k) => m.get(String(k)) || [], as = (o) => (x) => `${o}|${x}`;
  const own = `${object}|${id}`;
  if(object === 'contacts'){ const deals = of(l.contactDeals, id);
    return [...new Set([own, ...deals.map(as('deals')), ...[...of(l.contactCustomers, id), ...deals.flatMap(d => of(l.dealCustomers, d))].map(as('customers'))])]; }
  if(object === 'deals') return [...new Set([own, ...contactIdsOf(record).map(as('contacts')), ...of(l.dealCustomers, id).map(as('customers'))])];
  if(object === 'customers'){ const deals = record.dealIds || [];
    return [...new Set([own, ...deals.map(as('deals')), ...[...contactIdsOf(record), ...deals.flatMap(d => of(l.dealContacts, d))].map(as('contacts'))])]; }
  return [own];
}
// Whether a record has payments recorded (in a plan of its own): such a record can't be deleted.
const recordHasPayments = (object, id, list = WF_LIVE.accounting) => (list || []).some(s => s.object === object && String(s.recordId) === String(id) && hasPayments(s));
// The plans a record shows: its own, then those shared with it (planScopeOf).
const plansByRecordMemo = new WeakMap();
const plansByRecord = (list) => { let m = list && plansByRecordMemo.get(list);
  if(!m){ m = new Map(); (list || []).forEach(s => { const k = `${s.object}|${s.recordId}`; m.has(k) ? m.get(k).push(s) : m.set(k, [s]); }); if(list) plansByRecordMemo.set(list, m); }
  return m; };
const recordPlansOf = (list, object, record, records) => { const by = plansByRecord(list); return planScopeOf(object, record, records).flatMap(k => by.get(k) || []); };
// A plan's payments that carry what's owed: each one, or the balance its rest moved to.
const livePayments = (s) => (s.installments || []).filter(i => !(s.installments || []).some(x => x.parentId === i.id));
/* Where a plan is (the Accounting tab's tabs): Frozen; Paid — every payment reconciled and nothing
   more to bill (a subscription until cancelled: once cancelled); else Active. */
const PLAN_STATES = [{id:'active', name:'Active', icon:'coins'}, {id:'paid', name:'Paid', icon:'check'}, {id:'frozen', name:'Frozen', icon:'freeze'}];
const planState = (s) => s.frozen ? 'frozen' : (s.installments || []).length && livePayments(s).every(i => installmentState(s, i).status === 'paid')
  && (!planOngoing(s.plan) || !!s.cancelledOn) ? 'paid' : 'active';
// A plan's number: PP-<year>-<nnnn>, from a counter that only goes up (store.jsx `ids.paymentPlans`).
const nextPlanNumber = (list, at) => { ensureIdFloor('paymentPlans', quoteSeqFloor(list));
  return `PP-${new Date(at || Date.now()).getFullYear()}-${String(newRecordId('paymentPlans')).padStart(4, '0')}`; };
const planTitle = (s) => `${s.number ? `${s.number} · ` : ''}${PAYMENT_TYPE_LABEL[paymentTypeOf(s)]}`;
/* Plans saved before (Payment Terms): the untouched starting terms every record had go (a record
   starts with none now); the rest are numbered in the order they were made. */
function migratePlans(list){
  const kept = (list || []).filter(s => s && !(s.isDefault && !hasPayments(s)));
  const time = (s) => new Date(s.createdAt).getTime() || 0;
  const num = new Map(kept.filter(s => !s.number).sort((a, b) => time(a) - time(b)).map(s => [s.id, nextPlanNumber(kept, s.createdAt)]));
  return num.size ? kept.map(s => num.has(s.id) ? {...s, number:num.get(s.id), revision:s.revision || 1} : s) : kept;
}
/* A quote's money as a plan's (2026-11-24): Amount = the services subtotal, Discount = the quote's
   (with a Referral Discount: the two together, as an amount), VAT = the quote's rate — so the plan's
   Total is the quote's total. The quote's payment terms with it, in the quote's currency. */
const quotePlanMoney = (q) => { const t = quoteTotals(q), d = q.discount || {};
  return {amount:t.subtotal, vatRate:t.vatRate, discount: t.referralDiscount > 0 ? {type:'amount', value:r2(t.discount + t.referralDiscount)}
    : {type:d.type === 'amount' ? 'amount' : 'percent', value:Number(d.value) || 0}}; };
const planFromQuote = (q) => newPaymentPlan({...(q.payment || {}), ...quotePlanMoney(q), currency:quoteCurrency(q)});
/* A quote's Payment Plan, made when it's signed (plansOnQuoteSigned): its plan (the quote's money, in
   its currency), dated from the day it was signed. A quote saved before plans: its installments as
   they were. */
const scheduleFromQuote = (q, object, record) => {
  const head = {id:`qs-${q.id}`, source:'quote', quoteId:q.id, quoteNumber:q.number, quoteTitle:q.title, object, recordId:record.id, createdAt:q.createdAt, createdBy:q.createdBy, total:quoteTotal(q), currency:quoteCurrency(q)};
  if(q.payment){
    const plan = planFromQuote(q), signedOn = q.status === 'signed' ? dayOf(q.signedAt) : '';
    const installments = planSchedule(plan, {id:head.id, signedOn});
    return {...head, paymentType:plan.paymentType, plan, ...(signedOn ? {signedOn} : {}), total:r2(installments.reduce((a, x) => a + x.amount, 0)), installments};
  }
  return {...head, installments:(q.installments || []).map((x, i) => ({id:`qs-${q.id}-${x.id || i}`, parentId:null, description:x.description, percent:Number(x.percent) || 0,
    amount:installmentAmount(q, x), dueDate:tentativeDate(x.due, q.sentAt), tentative: x.due && x.due.type !== 'date' ? fmtTentative(x.due) : '', payments:[]}))};
};
/* The starting terms every record had before Payment Plans (one installment, the deal's amount),
   saved compactly while untouched: read back so migratePlans can drop them. */
const defaultTermsOf = (id, object, recordId, total, startDate, createdAt, currency) => ({id, source:'manual', isDefault:true, object, recordId, createdAt, createdBy:'System',
  title:'Payment terms', total, ...(currency ? {currency} : {}), startDate, terms:[{id:id + 't', description:'First installment', percent:100, due:null}],
  installments:[{id:id + 'i', parentId:null, description:'First installment', percent:100, amount:total, dueDate:'', tentative:'', payments:[]}]});
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
                 installment's name (`name`), amount and dates as set (`rows`, one per installment — added or
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
  return {paymentType:'one-time', currency:defaultCurrency(), amount:'', discount:{type:'percent', value:''}, issue:{type:'signed'}, due:{type:'net', days:0}, lead:1,
    depositBy:'percent', depositPercent:'', count:'', schedule:'every30', rows:[], frequency:'monthly', ...p,
    duration: months && !years ? 'months' : p.duration === 'ongoing' ? 'ongoing' : 'years', ...(years ? {count:Number(p.count) / 12} : {})}; };
/* A plan's money (2026-11-24): its Amount, less its Discount (a percentage of the amount, or an
   amount — never more than it), plus VAT on what's left (`vatRate`, %; a plan saved before VAT has
   none) = the Total its payments split. A quote's plan takes the quote's total instead (`total`). */
const planMoney = (plan) => { const amount = r2((plan || {}).amount), d = (plan || {}).discount || {}, dv = Math.max(0, Number(d.value) || 0);
  const discount = r2(d.type === 'amount' ? Math.min(dv, amount) : amount * Math.min(dv, 100) / 100);
  const discounted = r2(amount - discount), vatRate = Number((plan || {}).vatRate) || 0, vat = r2(discounted * vatRate / 100);
  return {amount, discount, discounted, vatRate, vat, total:r2(discounted + vat)}; };
const discountWithin = (d, base) => !d || d.value === '' || d.value == null || (Number(d.value) >= 0 && (d.type === 'amount' ? Number(d.value) <= base : Number(d.value) <= 100));
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
   of a subscription until cancelled. `cancelledOn`: no invoice after it. `locked`: payments with
   something paid on them, by id — they keep their amount and dates ({amount, invoiceDate, dueDate}). */
function planSchedule(plan, {id = 'pt', signedOn = '', total, asOf = ymdOf(new Date()), preview = 1, cancelledOn = '', locked} = {}){
  const type = paymentTypeOf(plan), amount = r2(total != null ? total : planMoney(plan).total), byDate = (plan.issue || {}).type === 'date';
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
    /* An edited installment's dates (2026-11-24, `rowDates:'own'`): each a Date, a Day (N days from
       Day 0 — the deposit's invoice day: the signing or the fixed date) or nothing — then it has no
       date and isn't invoiced until one is set. Edited before: a date not set is the 30-day one. */
    const ownDates = custom && plan.rowDates === 'own', dayAt = (d) => at(start.date ? addDays(start.date, Number(d)) : '', start.fixed);
    for(let k = 1; k <= n; k++){
      const o = over[k - 1] || {}, set = (v) => v !== '' && v != null;
      const pickDate = (date, d, fallback) => set(date) ? at(date, true) : set(d) ? dayAt(d) : ownDates ? at('', false) : fallback();
      const du = pickDate(o.dueDate, o.dueDay, () => at(depositDue.date ? addDays(depositDue.date, INSTALLMENT_INTERVAL * k) : '', depositDue.fixed));
      const inv = pickDate(o.invoiceDate, o.invoiceDay, () => after(du, -lead));
      rows.push(row(`${id}-i${k}`, String(o.name || '').trim() || `Installment ${k}`, set(o.amount) ? r2(o.amount) : custom ? 0 : k === n ? r2(rest - each * (n - 1)) : each, inv, du));
    }
  }
  if(locked) rows = rows.map(x => locked[x.id] ? {...x, amount:locked[x.id].amount, invoiceDate:locked[x.id].invoiceDate || '', dueDate:locked[x.id].dueDate || '', invoiceTentative:'', tentative:'', locked:true} : x);
  const sum = rows.reduce((a, x) => a + x.amount, 0);
  return rows.map(x => ({...x, percent: sum ? x.amount / sum * 100 : 0}));
}
const planTotal = (plan, total) => r2(planSchedule(plan, {total}).reduce((a, x) => a + x.amount, 0));
const ymdOk = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
const countOk = (v, max = PLAN_MAX_COUNT) => v !== '' && v != null && Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= max;
const daysOk = (v, max) => /^\d+$/.test(String(v ?? '')) && Number(v) <= max;
// Complete: an amount, its dates set, a deposit under the total, a number; an edited schedule's every amount set.
function planOk(plan, total){
  const amount = Number(total != null ? total : planMoney(plan).total), issue = plan.issue || {}, due = plan.due || {}, type = paymentTypeOf(plan);
  if(!(amount > 0) || (issue.type === 'date' && !ymdOk(issue.date))) return false;
  // A plan's own discount (not a quote's): within its amount (or 100%); VAT a percentage.
  if(total == null && (!discountWithin(plan.discount, r2(plan.amount)) || !(plan.vatRate == null || plan.vatRate === '' || (Number(plan.vatRate) >= 0 && Number(plan.vatRate) <= 100)))) return false;
  const dueOk = due.type === 'date' ? ymdOk(due.date) && !(issue.type === 'date' && due.date < issue.date) : due.type !== 'days' || daysOk(due.days, 3650);
  if(type === 'recurring') return dueOk && (plan.duration === 'ongoing' || countOk(plan.count, plan.duration === 'months' ? PLAN_MAX_COUNT : PLAN_MAX_YEARS));
  if(type === 'one-time') return dueOk;
  const pct = Number(plan.depositPercent);
  if(!(dueOk && daysOk(plan.lead, PLAN_MAX_LEAD) && pct > 0 && pct < 100 && countOk(plan.count))) return false;
  // An edited schedule: every amount set; an invoice never after its payment's due date (as Days too).
  const dayOk = (plan.rows || []).every(o => !(o.invoiceDay !== '' && o.invoiceDay != null && o.dueDay !== '' && o.dueDay != null && Number(o.invoiceDay) > Number(o.dueDay)));
  return plan.schedule !== 'custom' || (dayOk && planSchedule(plan, {total}).every(x => x.amount > 0 && !(x.invoiceDate && x.dueDate && x.invoiceDate > x.dueDate)));
}
// A plan as saved: numbers as numbers; an edited schedule's rows, as many as the installments.
const dayNumOrEmpty = (v) => v === '' || v == null || !Number.isFinite(Number(v)) ? '' : Math.round(Number(v));
const normalizePlan = (p) => ({...p, amount:r2(p.amount), discount:{type:(p.discount || {}).type === 'amount' ? 'amount' : 'percent', value:Number((p.discount || {}).value) || 0},
  ...(p.vatRate == null || p.vatRate === '' ? {vatRate:undefined} : {vatRate:Number(p.vatRate) || 0}), depositPercent:p.depositPercent === '' ? '' : Number(p.depositPercent), count:p.count === '' ? '' : Number(p.count), lead:Number(p.lead) || 0,
  issue:p.issue.type === 'date' ? {type:'date', date:p.issue.date || ''} : {type:'signed'}, due:p.due.type === 'date' ? {type:'date', date:p.due.date || ''} : {type:p.due.type, days:Number(p.due.days) || 0},
  rows:p.schedule === 'custom' ? (p.rows || []).slice(0, planCount(p)).map(x => ({amount:x.amount === '' || x.amount == null ? '' : r2(x.amount), invoiceDate:x.invoiceDate || '', dueDate:x.dueDate || '',
    invoiceDay:x.invoiceDate ? '' : dayNumOrEmpty(x.invoiceDay), dueDay:x.dueDate ? '' : dayNumOrEmpty(x.dueDay), ...(String(x.name || '').trim() ? {name:String(x.name).trim()} : {})})) : []});
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
// A plan linked to a quote (made from it, or pulled from it — 2026-11-24) waits for that quote only.
const quoteSignedOn = (quotes, s) => { const signed = (quotes || []).filter(q => q.status === 'signed' && q.signedAt);
  const own = signed.find(q => q.id === s.quoteId); if(own) return dayOf(own.signedAt);
  if(s.quoteId) return '';
  return signed.filter(q => q.object === s.object && String(q.recordId) === String(s.recordId)).map(q => dayOf(q.signedAt)).sort().pop() || ''; };
/* A plan's rows as it makes them now (`patch`: dated from a signing, cancelled) — a row kept keeps
   everything but its dates (payments, invoices, balances), and a dated one with something paid on
   it its dates too; a row the plan no longer makes (a cycle after a cancellation) stays only when
   something's paid on it. */
function refreshSchedule(s, patch = {}){
  const next = {...s, ...patch}, all = next.installments || [], top = all.filter(x => !x.parentId);
  const fresh = planSchedule(next.plan, {id:next.id, signedOn:next.signedOn, cancelledOn:next.cancelledOn});
  const withKids = (x) => [x, ...all.filter(b => b.parentId === x.id).flatMap(withKids)];
  const paidTree = (x) => (x.payments || []).length > 0 || all.some(b => b.parentId === x.id && paidTree(b));
  const used = new Set();
  const rows = fresh.flatMap(f => { const o = top.find(x => x.id === f.id) || (fresh.length === 1 && top.length === 1 ? top[0] : null);
    if(!o) return [f]; used.add(o.id);
    return withKids((o.payments || []).length && o.dueDate ? o : {...o, invoiceDate:f.invoiceDate, dueDate:f.dueDate, invoiceTentative:f.invoiceTentative, tentative:f.tentative}); });
  const installments = [...rows, ...top.filter(x => !used.has(x.id) && paidTree(x)).flatMap(withKids)];
  return {...next, installments, total:r2(installments.filter(x => !x.parentId).reduce((a, x) => a + x.amount, 0))};
}
const withSignedOn = (s, on) => refreshSchedule(s, {signedOn:on});
// A subscription until cancelled: billed up to today and the next cycle (on every load, app.jsx).
const rollSubscription = (s) => s && planOngoing(s.plan) && !s.archived ? refreshSchedule(s) : s;
/* A quote signed (quotes.jsx): the plans waiting for it — on its record and set to Quote Signed — get
   their dates, and the quote's own Payment Plan is made (once; with payment terms and a total), on
   its record, dated from the signing — its invoices due by then are issued at
   once (invoices.jsx). A quote saved before plans has no invoice dates: each payment is invoiced on
   its due date. */
/* A quote linked to a plan (`linkedPlanId` — the quote started from the plan, or the plan was pulled
   from the quote; 2026-11-24): signing updates that plan instead — the signed quote's terms and money
   as its next revision (revisePlan: what's paid stays), dated from the signing, its changed invoices
   archived and issued again. A linked plan that can't take it (cancelled, or paid on with another
   payment type) leaves the quote to make its own plan, as before. */
function plansOnQuoteSigned(hub, quote, signedAt){
  const on = dayOf(signedAt), holder = hubRecord(hub, quote.object, quote.recordId), signedQuote = {...quote, status:'signed', signedAt};
  const linked0 = quote.linkedPlanId && quote.payment ? (hub.accounting || []).find(s => s.id === quote.linkedPlanId) : null;
  const plan1 = linked0 ? planFromQuote(signedQuote) : null;
  const revised = linked0 ? revisePlan(linked0, plan1, {signedOn: plan1.issue.type === 'signed' ? on : '', by:'System'}) : null;
  const linked = revised ? {...revised, source:'quote', quoteId:quote.id, quoteNumber:quote.number, quoteTitle:quote.title} : null;
  const make = !linked && holder && (quote.payment || (quote.installments || []).length) && quoteTotal(quote) > 0 && !(hub.accounting || []).some(s => s.quoteId === quote.id && s.id !== quote.linkedPlanId);
  const made = make ? scheduleFromQuote(signedQuote, quote.object, holder) : null;
  const plan = made ? {...made, number:nextPlanNumber(hub.accounting), revision:1, createdAt:new Date(), createdBy:'System',
    ...(made.plan ? {} : {installments:made.installments.map(x => x.dueDate && !x.invoiceDate ? {...x, invoiceDate:x.dueDate} : x)})} : null;
  // Plans waiting for "Quote Signed" on its record are dated from it — not one linked to another quote.
  hub.setAccounting(list => [...list.map(s => linked && s.id === linked.id ? linked : !s.plan || (s.plan.issue || {}).type === 'date' || s.signedOn || (s.quoteId && s.quoteId !== quote.id)
    || !(s.quoteId === quote.id || (s.object === quote.object && String(s.recordId) === String(quote.recordId))) ? s : withSignedOn(s, on)),
    ...(plan && !list.some(s => s.quoteId === quote.id) ? [plan] : [])]);
  if(linked){
    hub.setInvoices && hub.setInvoices(list => archiveChangedInvoices(list, linked));
    hub.add(linked.object, linked.recordId, {type:'payment', action:'Payment plan edited', detail:`${planTitle(linked)} · revision ${linked.revision} · from ${quote.number}`, source:'you', by:'System'});
  }
  if(plan) hub.add(plan.object, plan.recordId, {type:'payment', action:'Payment plan created', detail:`${planTitle(plan)} · from ${quote.number}`, source:'you', by:'System'});
}
/* A plan's next revision (2026-11-24, out of RecordAccounting's edit so a signed linked quote can
   make one too): its payments are made by the new plan (planSchedule), except those with something
   paid on them, which stay as they are (with their balances); a payment kept through the edit keeps
   the invoice it had issued before plans. A paid One-Time payment stays: One-Time, as it is;
   Installment, the deposit. Reversed payments stay. The revision before is kept in `revisions`.
   Null when it can't be made: cancelled, or paid on and the type changed (not from One-Time). */
function revisePlan(s0, plan, {signedOn = '', by = CURRENT_USER.name, at = new Date()} = {}){
  if(!s0 || s0.cancelledOn) return null;
  const was = paymentTypeOf(s0), first = s0.installments[0], paidOne = was === 'one-time' && hasPayments(s0) ? first : null;
  if(was !== 'one-time' && hasPayments(s0) && plan.paymentType !== was) return null;
  const old = s0.installments || [], used = new Set(), tops = old.filter(x => !x.parentId);
  // Saved before plans: the plan's payments take theirs, by place (their payments and invoices stay with them).
  const fresh = planSchedule(plan, {id:s0.id, signedOn, locked:paidOne ? null : lockedOf(s0)}).map((f, i) => !s0.plan && tops[i] ? {...f, id:tops[i].id} : f);
  const kids = (x) => old.filter(b => b.parentId === x.id).flatMap(b => [b, ...kids(b)]);
  const paidTree = (x) => (x.payments || []).length > 0 || kids(x).some(k => (k.payments || []).length);
  const rows = fresh.flatMap((f, i) => {
    if(paidOne && i === 0){ used.add(first.id); return [{...first, description: plan.paymentType === 'one-time' ? first.description : 'Deposit'}]; }
    const o = old.find(x => x.id === f.id && !x.parentId);
    if(o && paidTree(o)){ used.add(o.id); return [o, ...kids(o)]; }
    return [o && o.invoicedAt ? {...f, invoicedAt:o.invoicedAt} : f];
  });
  const installments = [...rows, ...old.filter(x => !x.parentId && !used.has(x.id) && paidTree(x)).flatMap(x => [x, ...kids(x)])];
  const total = r2(installments.filter(x => !x.parentId).reduce((a, x) => a + x.amount, 0));
  const {signedOn: _was, ...keep} = s0;
  return {...keep, paymentType:plan.paymentType, currency:plan.currency, total, plan, ...(signedOn ? {signedOn} : {}), installments, revision:(s0.revision || 1) + 1,
    revisions:[...(s0.revisions || []), {revision:s0.revision || 1, paymentType:was, currency:scheduleCurrency(s0), total:s0.total, plan:s0.plan || null, savedAt:at, savedBy:by}]};
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
/* ── A Payment Plan's fields ── the Payment Plan panel's (Accounting, Documents) and a quote's
   Payment Plan step (`total`: the quote's — no currency or amount here then). Every
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
   document's "Document Signed"). `paid`: a paid One-Time payment ({amount, invoiceDate, dueDate}) —
   its amount and dates fixed; switched to Installment it's the deposit, as paid; Recurring isn't
   offered then. `locked`: the plan's payments with something paid on them, by id (planSchedule) —
   shown as they are, not editable, and the type and currency fixed; `scheduleId`: the plan's id
   (its payments' ids). `signedOn`: the day it's already signed (Accounting: the record's quote), so
   the schedule shows its dates. */
const PT_W = 280, PT_H = 36;
/* A discount's control (a quote's Discount and Referral Discount, a plan's Discount): % or an amount
   in `currency`, then the value; red while it's out of range (`ok`). */
function DiscountControl({label, value, onChange, currency, ok = true}){
  const d = value || {type:'percent', value:''};
  return (
    <div style={{display:'flex', alignItems:'center', gap:10, padding:'6px 0'}}>
      <span style={{flex:1, fontSize:13, color:T.attioText}}>{label}</span>
      <div role="radiogroup" aria-label={`${label} type`} style={{display:'inline-flex', border:`1px solid ${T.borderStrong}`, borderRadius:8, overflow:'hidden'}}>
        {[['percent', '%'], ['amount', currency]].map(([k, l]) => (
          <button key={k} type="button" role="radio" aria-checked={d.type === k} onClick={()=>onChange({...d, type:k})}
            style={{border:'none', cursor:'pointer', padding:'5px 10px', fontSize:12.5, fontWeight:500, fontFamily:'inherit', background: d.type === k ? T.black : 'transparent', color: d.type === k ? '#fff' : T.gray600}}>{l}</button>
        ))}
      </div>
      <input value={d.value ?? ''} onChange={e=>onChange({...d, value:e.target.value.replace(/[^0-9.]/g, '')})} inputMode="decimal" placeholder="0" aria-label={label}
        style={{...fieldText, width:110, textAlign:'right', fontVariantNumeric:'tabular-nums', borderColor: ok ? T.borderStrong : T.red}}/>
    </div>);
}
/* An edited installment's invoice or due date (2026-11-24): empty, a Day (N days from Day 0 — the
   signing or the plan's fixed date) or a Date. The field opens a menu — Day and Date, each opening
   its own panel beside it (a number of days; a month calendar), and Clear once something's set.
   `value` {day, date}; `onChange({day, date})` — one of them set, or both ''. */
const fmtDayOrDate = (v) => v && v.date ? fmtQuoteDate(v.date) : v && v.day !== '' && v.day != null ? `Day ${v.day}` : '';
function DayOrDateField({value, onChange, ariaLabel}){
  const [pos, setPos] = React.useState(null);           // the menu: {top, left, up}
  const [sub, setSub] = React.useState(null);           // 'day' | 'date': the panel open beside the menu
  const [days, setDays] = React.useState('');
  const [month, setMonth] = React.useState(null);
  const ref = React.useRef(null), menuRef = React.useRef(null);
  const z = useFloatZ(!!pos);
  const v = value || {}, shown = fmtDayOrDate(v);
  const MENU_W = 168, PANEL_W = 264, PANEL_H = 300;
  // Under (or above) the field, from its left edge; the panel opens on the menu's right, or its left when there's no room.
  const open = () => { const r = ref.current.getBoundingClientRect(), up = window.innerHeight - r.bottom < PANEL_H + 8;
    const flip = r.left + MENU_W + PANEL_W + 12 > window.innerWidth, left = Math.max(8, Math.min(r.left, window.innerWidth - MENU_W - 8));
    setPos({top: up ? Math.max(8, r.top - 4) : r.bottom + 4, up, flip, ...(flip ? {right:window.innerWidth - left - MENU_W} : {left})});
    setSub(null); setDays(v.day !== '' && v.day != null ? String(v.day) : ''); const d = fromYmd(v.date) || new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); };
  const close = () => { setPos(null); setSub(null); };
  React.useEffect(() => {
    if(!pos) return;
    const down = (e) => { if(!(menuRef.current && menuRef.current.contains(e.target)) && !(ref.current && ref.current.contains(e.target))) close(); };
    const key = (e) => { if(e.key === 'Escape'){ e.stopPropagation(); close(); } };
    const onScroll = (e) => { if(!(menuRef.current && menuRef.current.contains(e.target))) close(); };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key, true); window.addEventListener('scroll', onScroll, true);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key, true); window.removeEventListener('scroll', onScroll, true); };
  }, [pos]);
  const setDay = () => { if(days === '') return; onChange({day:Math.round(Number(days)), date:''}); close(); };
  const pickDate = (d) => { onChange({day:'', date:d}); close(); };
  const item = (id, label) => (
    <div role="menuitem" aria-haspopup="true" aria-expanded={sub === id} onMouseEnter={()=>setSub(id)} onClick={()=>setSub(id)}
      style={{display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:6, fontSize:13, color:T.attioText, cursor:'pointer', background: sub === id ? T.headerBg : 'transparent'}}>
      <span style={{flex:1}}>{label}</span><Icon name="chevDown" size={11} color={T.gray600} style={{transform:`rotate(${pos && pos.flip ? 90 : -90}deg)`}}/>
    </div>);
  const cells = [];
  if(month){ const first = month.getDay(), n = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for(let i = 0; i < first; i++) cells.push(null);
    for(let d = 1; d <= n; d++) cells.push(ymd(new Date(month.getFullYear(), month.getMonth(), d))); }
  const step = (n) => setMonth(m => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const nav = (dir) => <button type="button" aria-label={dir < 0 ? 'Previous month' : 'Next month'} onClick={()=>step(dir)} style={{width:28, height:28, border:'none', borderRadius:6, background:'transparent',
    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center'}}><Icon name="chevDown" size={12} color={T.gray600} style={{transform:`rotate(${dir < 0 ? 90 : -90}deg)`}}/></button>;
  const floating = {background:'#fff', border:`1px solid ${T.border}`, borderRadius:10, boxShadow:'0 4px 16px rgba(16,24,40,.12)', boxSizing:'border-box', fontFamily:"'DM Sans', sans-serif"};
  return (
    <div style={{position:'relative', minWidth:0}}>
      <button ref={ref} type="button" aria-label={ariaLabel} aria-haspopup="menu" aria-expanded={!!pos} onClick={()=>pos ? close() : open()}
        style={{...fieldInput, height:PT_H, boxSizing:'border-box', width:'100%', display:'flex', alignItems:'center', gap:8, cursor:'pointer', textAlign:'left',
          borderColor: pos ? T.blue : T.borderStrong, color: shown ? T.attioText : T.gray400}}>
        <span style={{flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontVariantNumeric:'tabular-nums'}}>{shown || 'Not set'}</span>
        <Icon name="calendar" size={14} color={T.gray600}/>
      </button>
      {pos && ReactDOM.createPortal(
        <div ref={menuRef} data-hof-floating="" style={{position:'fixed', zIndex:z, ...(pos.flip ? {right:pos.right, flexDirection:'row-reverse'} : {left:pos.left}),
          ...(pos.up ? {bottom:window.innerHeight - pos.top} : {top:pos.top}), display:'flex', alignItems: pos.up ? 'flex-end' : 'flex-start', gap:4}}>
          <div role="menu" aria-label={ariaLabel} style={{...floating, width:MENU_W, padding:6}}>
            {item('day', 'Day')}{item('date', 'Date')}
            {shown && <>
              <div style={{height:1, background:T.border, margin:'4px 0'}}/>
              <div role="menuitem" onMouseEnter={()=>setSub(null)} onClick={()=>{ onChange({day:'', date:''}); close(); }}
                style={{padding:'7px 10px', borderRadius:6, fontSize:13, color:T.attioText, cursor:'pointer'}}>Clear</div>
            </>}
          </div>
          {sub === 'day' && (
            <div style={{...floating, width:PANEL_W, padding:12, display:'flex', flexDirection:'column', gap:10}}>
              <div style={{display:'flex', alignItems:'center', gap:8, border:`1px solid ${T.borderStrong}`, borderRadius:8, padding:'0 10px', height:PT_H}}>
                <span style={{fontSize:12.5, color:T.attioMuted}}>Day</span>
                <input autoFocus value={days} onChange={e=>setDays(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} onKeyDown={e=>{ if(e.key === 'Enter'){ e.preventDefault(); setDay(); } }}
                  inputMode="numeric" placeholder="30" aria-label="Day number" style={{flex:1, minWidth:0, border:'none', outline:'none', fontSize:13, fontFamily:'inherit', color:T.attioText, background:'transparent', textAlign:'right', fontVariantNumeric:'tabular-nums'}}/>
              </div>
              <StCta label="Set Day" disabled={days === ''} onClick={setDay}/>
            </div>)}
          {sub === 'date' && month && (
            <div style={{...floating, width:PANEL_W, padding:8, display:'flex', flexDirection:'column', gap:4}}>
              <div style={{display:'flex', alignItems:'center', gap:4}}>{nav(-1)}
                <span style={{flex:1, textAlign:'center', fontSize:13, fontWeight:600, color:T.attioText}}>{month.toLocaleDateString('en-US', {month:'long', year:'numeric', timeZone:LOCAL_TZ})}</span>{nav(1)}</div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:2, fontSize:12, color:T.attioMuted, textAlign:'center', padding:'2px 0 4px', borderBottom:`1px solid ${T.border}`}}>
                {DATE_WEEKDAYS.map(d => <span key={d}>{d}</span>)}</div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:2, paddingTop:2}}>
                {cells.map((c, i) => c ? <DateOption key={c} label={Number(c.slice(8))} on={c === v.date} today={c === ymd(new Date())} onPick={()=>pickDate(c)}/> : <span key={`b${i}`}/>)}</div>
            </div>)}
        </div>, document.body)}
    </div>
  );
}
// `head`: a field above Payment Type, in its column (Add Payment Plan's Quote).
function PaymentTermsFields({plan, onChange, total, currency, signedLabel = 'Quote Signed', paid, signedOn, locked, scheduleId, head}){
  const set = (p) => onChange({...plan, ...p}), type = paymentTypeOf(plan), inQuote = total != null;
  const money = planMoney(plan), amount = Number(inQuote ? total : money.total) || 0, cur = currency || plan.currency, unit = RECURRING_UNIT[plan.frequency] || 'Month';
  const section = {fontSize:11, fontWeight:600, color:T.attioFaint, textTransform:'uppercase', letterSpacing:.4};
  const divider = <div style={{borderTop:`1px solid ${T.border}`, margin:'8px -20px 4px'}}/>;
  const control = {...fieldControl, height:PT_H, boxSizing:'border-box'}, dateInput = {...fieldInput, height:PT_H, boxSizing:'border-box'};
  const box = {display:'flex', alignItems:'center', gap:6, border:`1px solid ${T.borderStrong}`, borderRadius:8, padding:'0 10px', height:PT_H, boxSizing:'border-box', background:'#fff', minWidth:0};
  const bare = {flex:1, minWidth:0, border:'none', outline:'none', fontSize:13, fontFamily:'inherit', color:T.attioText, background:'transparent', textAlign:'right', fontVariantNumeric:'tabular-nums'};
  const affix = {fontSize:12, color:T.attioMuted, whiteSpace:'nowrap'};
  // A field: its input, and the one a choice adds beside it — the same size.
  // `req` (2026-11-23): the field's required mark — every field of the plan is required; a fixed (paid) value shows none.
  const F = (label, a, b, req = true) => <Field label={label} wide required={req}><div style={{display:'grid', gridTemplateColumns:`${PT_W}px ${PT_W}px`, gap:12}}>{a}{b || <span/>}</div></Field>;
  const pick = (value, options, onPick, label) => <Dropdown required value={value} options={options} controlStyle={control} ariaLabel={label} onChange={onPick}/>;
  const num = (value, onValue, label, before, after, decimal) => <div style={box}>{before && <span style={affix}>{before}</span>}
    <input value={value ?? ''} onChange={e=>onValue(e.target.value.replace(decimal ? /[^0-9.]/g : /[^0-9]/g, ''))} inputMode={decimal ? 'decimal' : 'numeric'} placeholder="0" aria-label={label} style={bare}/>
    {after && <span style={affix}>{after}</span>}</div>;
  const date = (value, onValue, label, placeholder) => <DateField required value={value || ''} onChange={onValue} ariaLabel={label} inputStyle={dateInput} placeholder={placeholder || 'Select date'}/>;
  // Fixed (something's paid on it): the value as it is.
  const fixed = (text, status) => <div style={{display:'flex', alignItems:'center', gap:10, height:PT_H, fontSize:13, color:T.attioText, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap'}}>
    {text}{status && <StatusPill status={status} map={PAYMENT_STATUS}/>}</div>;
  const lockedAny = !!locked && Object.keys(locked).length > 0, paidOneTime = !!paid && type === 'one-time';
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
  const rows = type !== 'one-time' && ready ? planSchedule(plan, {id:scheduleId, total, signedOn, preview:3, locked}) : [];
  // An installment before a paid one stays (the paid one keeps its place).
  const lastLocked = rows.reduce((m, x, i) => x.locked ? i : m, 0), depositFixed = !!paid || !!(rows[0] && rows[0].locked);
  const custom = type === 'installments' && plan.schedule === 'custom';
  // Edit: the schedule as it stands, each installment's amount set on its row (its dates the 30-day ones until changed).
  const [editOn, setEditing] = React.useState(false), editing = editOn && custom;
  /* Each installment's dates as the schedule has them now (2026-11-24): a date once the plan is
     dated, else its Day — each one can be changed or cleared. Edited before (no `rowDates`): the
     same, so nothing moves. */
  const dayNum = (t) => { const m = /^Day (-?\d+)$/.exec(t || ''); return m ? Number(m[1]) : ''; };
  const edit = () => { if(!custom || plan.rowDates !== 'own') set({schedule:'custom', rowDates:'own', rows:rows.slice(1).map((x, k) => ({...((plan.rows || [])[k] || {}), amount:String(x.amount),
    invoiceDate:x.invoiceDate || '', dueDate:x.dueDate || '', invoiceDay: x.invoiceDate ? '' : dayNum(x.invoiceTentative), dueDay: x.dueDate ? '' : dayNum(x.tentative)}))}); setEditing(true); };
  const own = () => Array.from({length:planCount(plan)}, (_, i) => (plan.rows || [])[i] || {});
  const setRow = (k, p) => set({rows:own().map((o, i) => i === k ? {...o, ...p} : o)});
  const addRow = () => set({count:planCount(plan) + 1, rows:[...own(), {amount:'', invoiceDate:'', dueDate:'', invoiceDay:'', dueDay:''}]});
  const deleteRow = (k) => set({count:planCount(plan) - 1, rows:own().filter((_, i) => i !== k)});
  const cols = 'minmax(0, 1fr) 170px 170px 170px 28px';
  return (<>
    {stack(<>
      {head}
      <Field label="Payment Type" required>{(
        <div role="radiogroup" aria-label="Payment type" style={{display:'inline-flex', border:`1px solid ${T.borderStrong}`, borderRadius:8, overflow:'hidden', background:'#fff'}}>
          {PAYMENT_TYPES.map(([id, l]) => { const off = id !== type && (paid ? id === 'recurring' : lockedAny); return (
            <button key={id} type="button" role="radio" aria-checked={type === id} disabled={off} onClick={()=>!off && set({paymentType:id})}
              style={{border:'none', cursor: off ? 'default' : 'pointer', padding:'6px 14px', fontSize:12.5, fontWeight:500, fontFamily:'inherit', whiteSpace:'nowrap', opacity: off ? .45 : 1,
                background: type === id ? T.black : 'transparent', color: type === id ? '#fff' : T.gray600}}>{l}</button>); })}
        </div>)}</Field>
      {!inQuote && <>
        {F('Currency', paid || lockedAny ? fixed(cur) : pick(cur, currencyOptions(), (c)=>c && set({currency:c}), 'Currency'), null, !(paid || lockedAny))}
        {F('Amount', paidOneTime ? fixed(fmtMoney(paid.amount, cur), 'paid')
          : num(plan.amount, (v)=>set({amount:v}), 'Amount', cur, null, true), null, !paidOneTime)}
      </>}
      {type === 'one-time' && (paidOneTime ? <>{F('Invoice Issue Date', fixed(fmtQuoteDate(paid.invoiceDate) || '—'), null, false)}{F('Due Date', fixed(fmtQuoteDate(paid.dueDate) || '—'), null, false)}</>
        : <>{issueField('Invoice Issue Date')}{dueField('Due Date')}</>)}
      {type === 'recurring' && <>
        {F('Billing Frequency', pick(plan.frequency === 'yearly' ? 'yearly' : 'monthly', [{value:'monthly', label:'Monthly'}, {value:'yearly', label:'Yearly'}], (v)=>set({frequency:v}), 'Billing frequency'))}
        {issueField('Invoice Issue Date')}
        {dueField('Due Date')}
        {/* Saved before for months that aren't whole years: those months, until changed. */}
        {F('Duration', pick(plan.duration, plan.duration === 'months' ? [{value:'months', label:'Number of Months'}, ...SUBSCRIPTION_DURATION] : SUBSCRIPTION_DURATION, (v)=>set({duration:v}), 'Subscription duration'),
          plan.duration !== 'ongoing' && num(plan.count, (v)=>set({count:v}), plan.duration === 'months' ? 'Number of months' : 'Number of years', null, plan.duration === 'months' ? 'months' : 'years'))}
      </>}
    </>)}
    {/* Discount & Tax (2026-11-24; a plan's own — a quote has its own under its plan): the quote's
        summary — Amount, Discount, Discounted amount, VAT, Total — the Total what the payments split. */}
    {!inQuote && !paidOneTime && <>
      {divider}<span style={section}>Discount & Tax</span>
      <div style={{maxWidth:420, width:'100%', alignSelf:'flex-end'}}>
        {quoteSumRow('Amount', fmtMoney(money.amount, cur))}
        <DiscountControl label="Discount" value={plan.discount} currency={cur} ok={discountWithin(plan.discount, money.amount)} onChange={(d)=>set({discount:d})}/>
        {quoteSumRow('Discount amount', `− ${fmtMoney(money.discount, cur)}`)}
        {quoteSumRow('Discounted amount', fmtMoney(money.discounted, cur))}
        <div style={{display:'flex', alignItems:'center', gap:10, padding:'6px 0'}}>
          <span style={{flex:1, fontSize:13, color:T.attioText}}>VAT</span>
          <div style={{...box, width:110, height:32}}>
            <input value={plan.vatRate ?? ''} onChange={e=>set({vatRate:e.target.value.replace(/[^0-9.]/g, '')})} inputMode="decimal" placeholder="0" aria-label="VAT percentage" style={bare}/>
            <span style={affix}>%</span></div>
        </div>
        {quoteSumRow('VAT amount', fmtMoney(money.vat, cur))}
        <div style={{borderTop:`2px solid ${T.attioText}`, marginTop:6, paddingTop:4}}>{quoteSumRow('Total', fmtMoney(money.total, cur), true)}</div>
      </div>
    </>}
    {type === 'installments' && <>
      {divider}<span style={section}>Deposit</span>
      {stack(<>
        {/* Paid (a paid One-Time payment, or anything paid on it): the deposit as it is. */}
        {depositFixed ? <>
          {F('Amount', fixed(fmtMoney(paid ? paid.amount : rows[0].amount, cur), paid ? 'paid' : locked[rows[0].id].status), null, false)}
          {F('Invoice Issue Date', fixed(fmtQuoteDate(paid ? paid.invoiceDate : rows[0].invoiceDate) || '—'), null, false)}
          {F('Due Date', fixed(fmtQuoteDate(paid ? paid.dueDate : rows[0].dueDate) || '—'), null, false)}
        </> : <>
          {F('Amount', pick(byAmount ? 'amount' : 'percent', [{value:'amount', label:'Fixed Amount'}, {value:'percent', label:'Percentage of Total'}], (v)=>{ setTyped(null); set({depositBy:v}); }, 'Deposit type'), depositInput)}
          {issueField('Invoice Issue Date')}
          {dueField('Due Date')}
        </>}
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
          {rows.map((x, i) => x.locked ? (
            <div key={x.id} style={{display:'grid', gridTemplateColumns:cols, gap:10, alignItems:'center'}}>
              <span style={{fontSize:13, color:T.attioText}}>{x.description}</span>
              {fixed(fmtMoney(x.amount, cur), locked[x.id].status)}{fixed(fmtQuoteDate(x.invoiceDate) || '—')}{fixed(fmtQuoteDate(x.dueDate) || '—')}<span/>
            </div>
          ) : (
            <div key={x.id} style={{display:'grid', gridTemplateColumns:cols, gap:10, alignItems:'center'}}>
              {/* The deposit is the Deposit; an installment's name can be changed (empty: "Installment N"). */}
              {i === 0 ? <span style={{fontSize:13, color:T.attioText}}>{x.description}</span>
                : <input value={((plan.rows || [])[i - 1] || {}).name ?? ''} onChange={e=>setRow(i - 1, {name:e.target.value})} placeholder={`Installment ${i}`} aria-label={`Installment ${i} name`}
                    style={{...fieldInput, height:PT_H, boxSizing:'border-box', minWidth:0}}/>}
              {i === 0
                ? paid ? <span style={{fontSize:13, color:T.attioText, fontVariantNumeric:'tabular-nums'}}>{fmtMoney(x.amount, cur)}</span>
                  : num(typed != null && byAmount ? typed : String(x.amount), (v)=>{ setTyped(v); set({depositBy:'amount', depositPercent: v === '' || !(amount > 0) ? '' : Number(v) / amount * 100}); }, 'Deposit amount', cur, null, true)
                : num(((plan.rows || [])[i - 1] || {}).amount ?? (x.amount ? String(x.amount) : ''), (v)=>setRow(i - 1, {amount:v}), `${x.description} amount`, cur, null, true)}
              {/* The deposit's dates are the plan's; an installment's: empty, a Day or a Date (DayOrDateField). */}
              {i === 0 ? date(issue.type === 'date' ? issue.date : x.invoiceDate, (v)=>set({issue:{type:'date', date:v}}), `${x.description} invoice issue date`, x.invoiceTentative)
                : (o => <DayOrDateField value={{day:o.invoiceDay ?? '', date:o.invoiceDate || ''}} onChange={(d)=>setRow(i - 1, {invoiceDay:d.day, invoiceDate:d.date})} ariaLabel={`${x.description} invoice issue date`}/>)((plan.rows || [])[i - 1] || {})}
              {i === 0 ? date(due.type === 'date' ? due.date : x.dueDate, (v)=>set({due:{type:'date', date:v}}), `${x.description} payment due date`, x.tentative)
                : (o => <DayOrDateField value={{day:o.dueDay ?? '', date:o.dueDate || ''}} onChange={(d)=>setRow(i - 1, {dueDay:d.day, dueDate:d.date})} ariaLabel={`${x.description} payment due date`}/>)((plan.rows || [])[i - 1] || {})}
              {/* The deposit stays; an installment can go while one is left (not one before a paid one). */}
              {i > 0 && i > lastLocked && rows.length > 2 ? <button type="button" title={`Delete ${x.description}`} onClick={()=>deleteRow(i - 1)}
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

/* ── A Payment Plan's side panel ── PaymentTermsFields, saved as a plan (`onSave(plan, {freeze})`).
   `initial`: the plan, and `paid` for a paid One-Time payment. `isNew`: Add Payment Plan — Save and
   Save and Freeze. An existing plan: Freeze Plan / Unfreeze Plan at the top (`frozen`, `onFreeze`),
   at once. `locked` / `scheduleId` / `signedOn`: PaymentTermsFields'. `heading` / `zIndex` /
   `signedLabel`: Documents' Add Payment Plan, over its builder. */
/* `quotes` (Add Payment Plan, 2026-11-24): the quotes it can be pulled from — picking one fills the
   plan with the quote's terms and money (planFromQuote) and links the two (`onSave(plan, {freeze,
   quoteId})`): signing that quote then updates this plan. */
function PaymentStructurePanel({initial, onCancel, onSave, heading, zIndex, signedLabel, signedOn, locked, scheduleId, isNew, frozen, onFreeze, quotes}){
  const paid = initial && initial.paid;
  const [plan, setPlan] = React.useState(() => newPaymentPlan(initial ? (({paid: _, ...p}) => p)(initial) : undefined));
  const [quoteId, setQuoteId] = React.useState('');
  const pullQuote = (id) => { const q = (quotes || []).find(x => x.id === id); if(!q) return; setQuoteId(id); setPlan(planFromQuote(q)); };
  // A paid One-Time payment as the deposit: its amount, the total more than it.
  const net = planMoney(plan).total;
  const view = paid && plan.paymentType === 'installments' ? {...plan, depositBy:'amount', depositPercent: net > 0 ? paid.amount / net * 100 : ''} : plan;
  const def = () => normalizePlan(view);
  const ok = planOk(paid && view.paymentType === 'one-time' ? {...view, amount:paid.amount, discount:null, vatRate:0} : view);
  // Saved untouched, an existing plan stays exactly as it is (a quote's stay the quote's, invoices and all).
  const opened = React.useRef(JSON.stringify(plan)).current;
  const save = (freeze) => ok && (!isNew && JSON.stringify(plan) === opened ? onCancel() : onSave(def(), {freeze, quoteId:quoteId || undefined}));
  return (
    <CreatePanelFrame title={heading || (isNew ? 'Add Payment Plan' : 'Edit Payment Plan')} onClose={onCancel} placement="fixed" width={920} zIndex={zIndex}
      headerActions={onFreeze && <button type="button" onClick={onFreeze} style={{...btnSecondarySm, display:'inline-flex', alignItems:'center', gap:6}}>
        <Icon name={frozen ? 'unfreeze' : 'freeze'} size={13} color={T.gray600}/>{frozen ? 'Unfreeze Plan' : 'Freeze Plan'}</button>}
      actions={<>
        <StSecondary label="Cancel" onClick={onCancel}/>
        {isNew && <StSecondary label="Save and Freeze" disabled={!ok} onClick={()=>save(true)}/>}
        <StCta label="Save" disabled={!ok} onClick={()=>save(false)}/>
      </>}>
      <PaymentTermsFields plan={view} onChange={setPlan} signedLabel={signedLabel} paid={paid} signedOn={signedOn} locked={locked} scheduleId={scheduleId}
        head={isNew && (quotes || []).length > 0 && <Field label="Quote" wide><div style={{display:'grid', gridTemplateColumns:`${PT_W}px ${PT_W}px`, gap:12}}>
          <Dropdown value={quoteId} placeholder="Select quote" ariaLabel="Quote" controlStyle={{...fieldControl, height:PT_H, boxSizing:'border-box'}}
            options={quotes.map(q => ({value:q.id, label:`${q.number} · ${q.title} · ${fmtMoney(quoteTotal(q), quoteCurrency(q))}`}))} onChange={pullQuote}/><span/></div></Field>}/>
    </CreatePanelFrame>
  );
}

/* Cancel Subscription: the day it ends (today or later) — no invoice after it; what's invoiced by
   then stays owed (RecordAccounting). */
function CancelSubscriptionModal({onCancel, onSave}){
  const today = ymdOf(new Date()), [on, setOn] = React.useState(today), ok = ymdOk(on) && on >= today;
  return ReactDOM.createPortal(
    <StModal title="Cancel Subscription" primary="Cancel Subscription" canSubmit={ok} width={424} onCancel={onCancel} onSubmit={()=>ok && onSave(on)}>
      <div><label style={fieldLabel}>Cancellation Date<Req/></label><DateField required value={on} onChange={setOn} ariaLabel="Cancellation date"/></div>
    </StModal>, document.body);
}

/* ── Update an installment's status: Paid or Partially Paid, with the payment and its evidence
   (required: a screenshot or a reference link — saving reconciles it and its invoice is Paid) ──
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
  const linkOk = !link.trim() || /^https?:\/\/\S+$/i.test(link.trim()), proofOk = !!file || !!link.trim();
  // Paid today or earlier; the rest of a part payment is expected today or later.
  const today = ymdOf(new Date()), paidOnOk = !!paidOn && paidOn <= today, expectedOk = !partial || (!!expected && expected >= today);
  // A payment needs something owed: an installment of 0 (terms whose total isn't set yet) takes none.
  const ok = wasPaid ? unpaid : unpaid || (due > 0 && paidOnOk && amountOk && linkOk && proofOk && expectedOk);
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
            <div><label style={fieldLabel}>Amount received ({cur})<Req/></label>
              <input autoFocus value={amount} onChange={e=>setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0"
                style={{...fieldInput, fontVariantNumeric:'tabular-nums', borderColor: amount && !amountOk ? T.red : T.borderStrong}}/>
              {amount && !amountOk && <div style={{fontSize:12, color:T.red, marginTop:4}}>Less than {fmtMoney(due, cur)} — a full payment is Paid.</div>}
            </div>
            <div><label style={fieldLabel}>Remaining Balance Expected On<Req/></label><DateField required value={expected} onChange={setExpected}/>
              {expected && !expectedOk && <div style={{fontSize:12, color:T.red, marginTop:4}}>Choose today or a later date.</div>}</div>
          </>}
          {!unpaid && !wasPaid && <>
          <div><label style={fieldLabel}>Payment Date<Req/></label><DateField required value={paidOn} onChange={setPaidOn}/>
            {paidOn && !paidOnOk && <div style={{fontSize:12, color:T.red, marginTop:4}}>A payment can't be dated in the future.</div>}</div>
          <div>
            <label style={fieldLabel}>Payment Evidence<Req/> <span style={{color:T.attioMuted, fontWeight:400}}>· a screenshot or a link</span></label>
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

/* One Payment Plan, laid straight into the tab: its number and type, where it came from, its
   totals, then the payments across the full width — Installment, Amount, Status, Invoice, Invoice
   Date, Due Date, Actions — each on one line (a date not set yet: Day N from signing); under them,
   its archived invoices. Narrower than its columns, the table scrolls sideways and Actions stays
   in view. */
const SCHEDULE_COLS = 'minmax(200px, 2fr) minmax(112px, 1fr) minmax(124px, 1fr) minmax(130px, 1fr) minmax(120px, 1fr) minmax(120px, 1fr) 150px';
const SCHEDULE_MIN_W = 956;
// A One-Time payment: one row — Amount, Status, Invoice, Invoice Date, Due Date, Paid On, Actions.
const ONE_TIME_COLS = 'minmax(140px, 1fr) minmax(124px, 1fr) minmax(130px, 1fr) minmax(120px, 1fr) minmax(120px, 1fr) minmax(120px, 1fr) 250px';
const ONE_TIME_MIN_W = 1004;
// A payment's invoice and due dates as the table shows them: the date, else Day N, else —; saved before plans, the invoice it had.
const invoiceCell = (inst) => fmtQuoteDate(inst.invoiceDate || inst.invoicedAt) || inst.invoiceTentative || '—';
const dueCell = (inst) => fmtQuoteDate(inst.dueDate) || inst.tentative || '—';
// A payment's invoice: its number, opening it (none issued yet: —).
const InvoiceLink = ({invoice, onOpen}) => invoice
  ? <button type="button" onClick={()=>onOpen(invoice)} title={INVOICE_STATUS[invoiceStatusOf(invoice)].label}
      style={{...formTextAction, fontWeight:400, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap', padding:0}}>{invoice.number}</button>
  : <span style={{color:T.attioMuted}}>—</span>;
// A source pill: the quote or document a plan was made from (gone if it was deleted).
/* `self`: the record whose page this is — named, not a link. */
function PlanSourcePill({icon, label, target, onOpen, title, self}){
  const link = target && !self;
  return (<>
    <button type="button" disabled={!link} onClick={()=>link && onOpen(target)} title={target ? title || target.number : undefined}
      style={{display:'inline-flex', alignItems:'center', gap:5, border:'none', fontFamily:'inherit', fontSize:11.5, fontWeight:500, padding:'2px 8px', borderRadius:9999,
        background:T.blueLight, color:T.blue, whiteSpace:'nowrap', cursor: link ? 'pointer' : 'default'}}>
      <Icon name={icon} size={11} color={T.blue}/>
      <span className={link ? LINK_CLASS : undefined}>{label}</span></button>
    {!target && <span style={{fontSize:12, color:T.attioMuted, whiteSpace:'nowrap'}}>Deleted</span>}
  </>);
}
// `canEdit`: edit the plan and record payments (Payment Plans → Edit); a frozen plan takes no payments.
function PaymentScheduleCard({schedule, canEdit, invoices, owner, onOpenRecord, quote, doc, onPay, onView, onEdit, onOpenQuote, onOpenDocument, onCancelSubscription, onOpenInvoice}){
  const t = scheduleTotals(schedule), type = paymentTypeOf(schedule), oneTime = type === 'one-time', frozen = !!schedule.frozen;
  const [showArchived, setShowArchived] = React.useState(false);
  const ownerIsOpen = useIsOpenRecord(owner && owner.object, owner && owner.record && owner.record.id);
  const mine = planInvoices(invoices, schedule.id), archived = mine.filter(v => v.status === 'archived');
  const invoiceOf = (inst) => mine.find(v => v.instId === inst.id && v.status !== 'archived') || null;
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
  const canPay = canEdit && !frozen;
  return (
    <div style={{borderBottom:`1px solid ${T.border}`, paddingBottom:8}}>
      <div style={{padding:'16px 24px 14px', display:'flex', flexDirection:'column', gap:12}}>
        {/* The KPIs, ⋯ on the right; under them one line: its number, when and by whom it was made. */}
        <div style={{display:'flex', alignItems:'flex-start', gap:8}}>
          <div style={{flex:1, minWidth:0, display:'flex', gap:8, flexWrap:'wrap'}}>
            {summary('Total', t.total)}{summary('Received', t.received, '#027A48')}{summary('Outstanding', t.outstanding, t.outstanding > 0 ? '#B54708' : null)}
          </div>
          {/* Edit: at any time, frozen too (what's paid stays as it is); not once cancelled. A
              subscription until cancelled: Cancel Subscription, once. */}
          {canEdit && (
            <RowActionsMenu title="Payment Plan Actions" items={[
              {label:'Edit Payment Plan', disabled:!!schedule.cancelledOn, onClick:onEdit},
              ...(planOngoing(schedule.plan) && !schedule.cancelledOn ? [{label:'Cancel Subscription', danger:true, onClick:onCancelSubscription}] : [])]}/>
          )}
        </div>
        <div style={{display:'flex', alignItems:'center', gap:8, minWidth:0, flexWrap:'wrap'}}>
          <span style={{fontSize:12, color:T.attioMuted}}>{schedule.number ? `${schedule.number} · ` : ''}Created {fmtQuoteDate(schedule.createdAt)} by {schedule.createdBy}</span>
          {frozen && <StatusPill status="frozen" map={{frozen:{label:`Frozen ${fmtQuoteDate(schedule.frozen.at)}`, tone:'info'}}}/>}
          {/* A subscription until cancelled, once cancelled: nothing invoiced after the day. */}
          {schedule.cancelledOn && <StatusPill status="cancelled" map={{cancelled:{label:`Cancelled ${fmtQuoteDate(schedule.cancelledOn)}`, tone:'danger'}}}/>}
          {/* Made from a quote or a document: links to it. */}
          {schedule.source === 'quote' && <PlanSourcePill icon="quote" label={`From ${schedule.quoteNumber || 'Quote'}`} target={quote} onOpen={onOpenQuote}/>}
          {schedule.source === 'document' && <PlanSourcePill icon="files" label={`From ${schedule.documentNumber || 'Document'}`} target={doc} onOpen={onOpenDocument}/>}
          {/* Shared with this record: the record it was added to. */}
          {owner && owner.record && <PlanSourcePill icon={owner.object} label={owner.record.name} title={typeSingular(owner.object, 'Record')} target={owner.record} self={ownerIsOpen} onOpen={(r)=>onOpenRecord(owner.object, r)}/>}
        </div>
      </div>
      {oneTime ? <OneTimePaymentRow schedule={schedule} canAct={canPay} invoice={invoiceOf(schedule.installments[0] || {})} head={head} cell={cell} num={num} clip={clip} actionsCol={actionsCol} onPay={onPay} onView={onView} onOpenInvoice={onOpenInvoice}/> : (
      <div style={{overflowX:'auto'}}>
        <div style={{minWidth:SCHEDULE_MIN_W}}>
          <div style={{display:'grid', gridTemplateColumns:SCHEDULE_COLS, background:T.headerBg, borderTop:`1px solid ${T.attioLine}`, borderBottom:`1px solid ${T.attioLine}`}}>
            <span style={{...head, paddingLeft:24}}>Installment</span><span style={{...head, justifyContent:'flex-end'}}>Amount</span>
            <span style={head}>Status</span><span style={head}>Invoice</span><span style={head}>Invoice Date</span><span style={head}>Due Date</span><span style={{...head, ...actionsCol, background:T.headerBg}}>Actions</span>
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
                    <ViolationMark inst={inst.id}/></span>
                  <span style={cell}><InvoiceLink invoice={invoiceOf(inst)} onOpen={onOpenInvoice}/></span>
                  <span style={{...cell, fontVariantNumeric:'tabular-nums'}}><span style={clip}>{invoiceCell(inst)}</span></span>
                  <span style={{...cell, fontVariantNumeric:'tabular-nums'}}><span style={clip}>{dueCell(inst)}</span></span>
                  <span style={{...cell, ...actionsCol, background:'#fff'}}>
                    {st.status === 'unpaid' && canPay && <button onClick={()=>onPay(inst)} style={{...btnSecondarySm, height:26, padding:'0 10px', whiteSpace:'nowrap'}}>Update status</button>}
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
      {/* Archived invoices: superseded by an edit, or by a part payment's balance — kept, read-only. */}
      {archived.length > 0 && <div style={{padding:'10px 24px 4px'}}>
        <button type="button" onClick={()=>setShowArchived(v => !v)} style={{...formTextAction, display:'inline-flex', alignItems:'center', gap:6}}>
          <Icon name="chevDown" size={11} color={T.gray600} style={{transform: showArchived ? 'none' : 'rotate(-90deg)'}}/>Archived invoices ({archived.length})</button>
        {showArchived && <div style={{display:'flex', flexDirection:'column', marginTop:6}}>
          {archived.map(v => (
            <div key={v.id} style={{display:'flex', alignItems:'center', gap:12, padding:'6px 0', borderTop:`1px solid ${T.attioLine}`, fontSize:13, color:T.attioText}}>
              <span style={{width:130}}><InvoiceLink invoice={v} onOpen={onOpenInvoice}/></span>
              <span style={{flex:1, minWidth:0, ...clip}}>{v.description}</span>
              <span style={{fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap'}}>{fmtMoney(v.amount, v.currency)}</span>
              <span style={{width:200, color:T.attioMuted, whiteSpace:'nowrap'}}>{v.archivedReason === 'partial' ? 'Part paid' : 'Superseded'} {fmtQuoteDate(v.archivedAt)}</span>
            </div>))}
        </div>}
      </div>}
    </div>
  );
}
/* A One-Time payment in the tab: its amount, status, invoice, invoice and due dates and the date
   it was paid (the date it was made is the card's); Update status (Paid, or back to Unpaid) and
   View payment. */
function OneTimePaymentRow({schedule, canAct, invoice, head, cell, num, clip, actionsCol, onPay, onView, onOpenInvoice}){
  const inst = schedule.installments[0], st = installmentState(schedule, inst);
  const paidOn = st.status === 'paid' ? (inst.payments[inst.payments.length - 1] || {}).paidOn : null;
  return (
    <div style={{overflowX:'auto'}}>
      <div style={{minWidth:ONE_TIME_MIN_W}}>
        <div style={{display:'grid', gridTemplateColumns:ONE_TIME_COLS, background:T.headerBg, borderTop:`1px solid ${T.attioLine}`, borderBottom:`1px solid ${T.attioLine}`}}>
          <span style={{...head, paddingLeft:24, justifyContent:'flex-end'}}>Amount</span><span style={head}>Status</span><span style={head}>Invoice</span><span style={head}>Invoice Date</span><span style={head}>Due Date</span><span style={head}>Paid On</span>
          <span style={{...head, ...actionsCol, background:T.headerBg}}>Actions</span>
        </div>
        <div style={{display:'grid', gridTemplateColumns:ONE_TIME_COLS, borderBottom:`1px solid ${T.attioLine}`}}>
          <span style={{...num, paddingLeft:24}}>{fmtMoney(inst.amount, scheduleCurrency(schedule))}</span>
          <span style={{...cell, gap:6}}><PaymentStatusPill status={st.status}/><ViolationMark inst={inst.id}/></span>
          <span style={cell}><InvoiceLink invoice={invoice} onOpen={onOpenInvoice}/></span>
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

/* ── The record's Accounting tab ── its Payment Plans in three status pills (Active, Paid, Frozen —
   the look of Tools → Tasks' views; no heading), Add Payment Plan beside them, each plan's side
   panel, payments and invoices. A plan shows its KPIs (Total, Received, Outstanding) with ⋯, then
   one line: its number, when and by whom it was made (and Frozen / Cancelled / From … / the record
   it was added to, when that's another one). */
// The plans are the record's own and those shared with it (planScopeOf); a new one is the record's own.
function AccountingTab({object, record}){ return <RecordAccounting object={object} record={record}/>; }
/* Terms saved before plans open as a plan (planOf): their payments, by place, are the plan's — the
   first the deposit (one alone: the payment), the next Installment 1, 2… (`planIdsOf`: the plan's id
   for each, in order). */
const planIdsOf = (s) => { const tops = (s.installments || []).filter(x => !x.parentId);
  return tops.map((x, i) => s.plan ? x.id : tops.length < 2 ? `${s.id}-p` : i === 0 ? `${s.id}-d` : `${s.id}-i${i}`); };
// A plan's payments with something paid on them, as they stay through an edit (PaymentTermsFields' `locked`), by the plan's ids.
const lockedOf = (s) => { const ids = planIdsOf(s);
  return Object.fromEntries((s.installments || []).filter(x => !x.parentId).map((x, i) => [ids[i], x]).filter(([, x]) => (x.payments || []).length)
    .map(([id, x]) => [id, {amount:x.amount, invoiceDate:x.invoiceDate || dayOf(x.invoicedAt) || '', dueDate:x.dueDate || '', status:installmentState(s, x).status}])); };
function RecordAccounting({object, record}){
  const hub = useRecordHub();
  const [tab, setTab] = React.useState('active');
  const [paying, setPaying] = React.useState(null);   // {scheduleId, instId}
  const [viewing, setViewing] = React.useState(null); // {scheduleId, instId}: View payment
  const [editing, setEditing] = React.useState(null); // {id} | {isNew:true}: the plan's side panel
  const [cancelling, setCancelling] = React.useState(null); // the subscription being cancelled (its id)
  const [quoteOpen, setQuoteOpen] = React.useState(null); // the quotation a plan was made from
  const [docOpen, setDocOpen] = React.useState(null);     // the document a plan was made from
  const [invoiceOpen, setInvoiceOpen] = React.useState(null); // an invoice's id
  // Payment Plans permissions (Records → <Object> → Accounting), by the record's owner.
  const can = (action) => paymentTermsCan(action, object, record);
  const canEdit = can('edit');
  const all = recordPlansOf(hub.accounting, object, record, hub.records);
  // A plan shared with this record: the record it was added to (its tag).
  const ownerOf = (s) => s.object === object && sameId(s.recordId, record.id) ? null
    : {object:s.object, record:((hub.records || {})[s.object] || []).find(r => sameId(r.id, s.recordId)) || null};
  const invoices = hub.invoices || [];
  const time = (s) => new Date(s.createdAt).getTime() || 0;
  const shown = all.filter(s => planState(s) === tab).sort((a, b) => time(b) - time(a));
  // Plan changes, payments and switches, in the activity (Payment) of the record the plan was added to.
  const logPayment = (plan, action, change) => hub.add(plan.object, plan.recordId, {type:'payment', action, ...change, source:'you', by:CURRENT_USER.name});
  /* Recording a payment (not on a frozen plan): its invoice — issued now if it has none yet — is
     Paid; a part payment archives it (keeping what was received) and the balance is a new payment,
     invoiced today (InvoiceIssuer). */
  const savePayment = (scheduleId, instId, v) => {
    const base = all.find(s => s.id === scheduleId), inst0 = base && base.installments.find(x => x.id === instId);
    if(!inst0 || base.frozen || !(Number(v.amount) > 0) || installmentState(base, inst0).status !== 'unpaid') return;   // a payment is more than 0; forward only
    // "Payment received" on the record's trail for every payment (2026-11-18 — was "Marked Paid", One-Time plans only).
    logPayment(base, 'Payment received', {detail:`${fmtMoney(v.amount, scheduleCurrency(base))} · ${inst0.description || 'Payment'}${v.status === 'partial' ? ' · part payment' : ''} · Paid on ${fmtQuoteDate(v.paidOn)}`});
    const today = ymdOf(new Date()), at = new Date();
    const payment = {id:acId('pay'), amount:v.amount, paidOn:v.paidOn, recordedAt:at, recordedBy:CURRENT_USER.name, evidence:(v.evidence.file || v.evidence.link) ? v.evidence : null};
    const invoice = currentInvoiceOf(invoices, base.id, instId) || issueInvoices(hub, [{s:base, inst:inst0, on:today}])[0];
    hub.setAccounting(list => {
      const s = list.find(x => x.id === scheduleId) || base;
      const inst = s.installments.find(x => x.id === instId);
      if(!inst || installmentState(s, inst).status !== 'unpaid') return list;
      let installments = s.installments.map(x => x.id === instId ? {...x, payments:[...(x.payments || []), payment]} : x);
      if(v.status === 'partial'){
        const remaining = r2(inst.amount - v.amount);
        const total = scheduleTotals(s).total || 1;
        const balance = {id:acId('pi'), parentId:inst.id, description:`Balance of ${inst.description}`, percent:r2(remaining / total * 100), amount:remaining, invoiceDate:today, dueDate:v.expected, tentative:'', payments:[]};
        const i = installments.findIndex(x => x.id === instId);
        installments = [...installments.slice(0, i + 1), balance, ...installments.slice(i + 1)];
      }
      return list.map(x => x.id === scheduleId ? {...s, installments} : x);
    });
    if(invoice) hub.setInvoices(list => list.map(x => x.id !== invoice.id ? x : v.status === 'partial'
      ? {...x, status:'archived', archivedAt:at.toISOString(), archivedReason:'partial', received:r2(v.amount)}
      : {...x, status:'paid', paidOn:v.paidOn, paymentId:payment.id, paidAt:at.toISOString()}));
    setPaying(null);
    // The payment that settles the plan — nothing left to pay — takes the person to Paid, where the plan now is (2026-11-23).
    if(v.status !== 'partial' && planState({...base, installments:base.installments.map(x => x.id === instId ? {...x, payments:[...(x.payments || []), payment]} : x)}) === 'paid') setTab('paid');
    hub.toast(paymentTypeOf(base) === 'one-time' ? 'Payment marked as paid' : v.status === 'paid' ? 'Installment marked as paid' : 'Partial payment recorded');
  };
  /* A paid One-Time payment back to Unpaid: its payment moves to the plan's `reversed` list (who and
     when) — out of Cash Received, never deleted — its invoice back to unpaid (the reversal kept on
     it), and the record's activity says so. */
  const reversePayment = (scheduleId, instId) => {
    const base = all.find(s => s.id === scheduleId), inst = base && base.installments.find(x => x.id === instId);
    if(!inst || paymentTypeOf(base) !== 'one-time' || !(inst.payments || []).length) return;
    const at = new Date(), pays = inst.payments, amount = r2(pays.reduce((a, p) => a + (Number(p.amount) || 0), 0));
    hub.setAccounting(list => list.map(s => s.id !== scheduleId ? s : {...s,
      reversed:[...(s.reversed || []), ...pays.map(p => ({...p, instId, reversedAt:at, reversedBy:CURRENT_USER.name}))],
      installments:s.installments.map(x => x.id === instId ? {...x, payments:[]} : x)}));
    hub.setInvoices(list => list.map(x => x.planId === scheduleId && x.instId === instId && x.status === 'paid'
      ? (({paidOn, paymentId, paidAt, ...rest}) => ({...rest, status:'issued', reversals:[...(x.reversals || []), {amount, paidOn, reversedAt:at.toISOString(), reversedBy:CURRENT_USER.name}]}))(x) : x));
    logPayment(base, 'Marked Unpaid', {detail:`${fmtMoney(amount, scheduleCurrency(base))} paid on ${fmtQuoteDate(pays[pays.length - 1].paidOn)} reversed`});
    setPaying(null);
    hub.toast('Payment marked as unpaid');
  };
  // The day a plan's Quote Signed / Document Signed counts from: its document's signing, else the record's quote.
  const signedOnOf = (s) => s && s.source === 'document' ? s.signedOn || '' : quoteSignedOn(hub.quotes, s || {object, recordId:record.id});
  /* The quotes a new plan can be pulled from (2026-11-24): on the records whose plans this one shows,
     a draft or sent quote (not expired, not signed — signing makes its own) with a payment plan and a
     total, not linked to a plan already. */
  const scope = new Set(planScopeOf(object, record, hub.records));
  const pullableQuotes = (hub.quotes || []).filter(q => scope.has(`${q.object}|${q.recordId}`) && (q.status === 'draft' || q.status === 'sent') && !quoteExpired(q)
    && q.payment && quoteTotal(q) > 0 && !(q.linkedPlanId && (hub.accounting || []).some(s => s.id === q.linkedPlanId)));
  // Add Payment Plan: a new plan on the record — numbered, frozen at once with Save and Freeze.
  /* Pulled from a quote (`quoteId`, 2026-11-24): linked to it — "From <quote>", waiting for that
     quote's signing (not another's), and the quote's `linkedPlanId` this plan, so signing it updates
     this plan rather than making another. */
  const createPlan = (plan, {freeze, quoteId} = {}) => {
    const q = quoteId && (hub.quotes || []).find(x => x.id === quoteId);
    const id = acId('ps'), signedOn = plan.issue.type === 'signed' ? (q ? '' : signedOnOf(null)) : '', at = new Date();
    const installments = planSchedule(plan, {id, signedOn});
    const s = {id, number:nextPlanNumber(hub.accounting), source: q ? 'quote' : 'manual', ...(q ? {quoteId:q.id, quoteNumber:q.number, quoteTitle:q.title} : {}),
      object, recordId:record.id, createdAt:at, createdBy:CURRENT_USER.name,
      paymentType:plan.paymentType, currency:plan.currency, total:r2(installments.reduce((a, x) => a + x.amount, 0)), plan, ...(signedOn ? {signedOn} : {}), installments, revision:1,
      ...(freeze ? {frozen:{at, by:CURRENT_USER.name}, freezes:[{action:'frozen', at, by:CURRENT_USER.name}]} : {})};
    hub.setAccounting(list => [...list, s]);
    if(q) hub.setQuotes(qs => qs.map(x => x.id === q.id ? {...x, linkedPlanId:id} : x));
    logPayment(s, 'Payment plan created', {detail:`${planTitle(s)} · ${fmtMoney(s.total, s.currency)}${q ? ` · from ${q.number}` : ''}${freeze ? ' · frozen' : ''}`});
    setEditing(null); setTab(freeze ? 'frozen' : 'active');
    hub.toast(freeze ? `${s.number} saved and frozen` : `${s.number} saved`);
  };
  /* Saving a plan's edit: a new revision (revisePlan). Issued, unpaid invoices whose payment changed
     are archived (archiveChangedInvoices) and invoiced again. */
  const editPlan = (plan) => {
    const s0 = all.find(s => s.id === (editing && editing.id));
    const was = s0 && paymentTypeOf(s0);
    const next = revisePlan(s0, plan, {signedOn: plan.issue.type === 'signed' ? signedOnOf(s0) : ''});
    if(!next) return;
    const total = next.total;
    hub.setAccounting(list => list.map(s => s.id === s0.id ? next : s));
    hub.setInvoices(list => archiveChangedInvoices(list, next));
    if(was !== plan.paymentType) logPayment(s0, 'Payment type changed', {from:PAYMENT_TYPE_LABEL[was], to:PAYMENT_TYPE_LABEL[plan.paymentType]});
    logPayment(s0, 'Payment plan edited', {detail:`${planTitle(next)} · revision ${next.revision} · ${fmtMoney(total, plan.currency)}`});
    setEditing(null);
    hub.toast(`${s0.number || 'Payment plan'} saved`);
  };
  /* Freeze / Unfreeze (the plan's side panel): frozen, no invoices are issued and no payments
     recorded; unfrozen, what fell due meanwhile is invoiced. Each in the plan's `freezes` and the
     record's activity. */
  const freezePlan = (id, on) => {
    const s0 = all.find(s => s.id === id); if(!s0 || !!s0.frozen === on) return;
    const at = new Date(), by = CURRENT_USER.name;
    hub.setAccounting(list => list.map(s => s.id !== id ? s : {...s, frozen: on ? {at, by} : null, freezes:[...(s.freezes || []), {action: on ? 'frozen' : 'unfrozen', at, by}]}));
    logPayment(s0, on ? 'Payment plan frozen' : 'Payment plan unfrozen', {detail:planTitle(s0)});
    hub.toast(on ? `${s0.number} frozen` : `${s0.number} unfrozen`);
  };
  /* Cancel Subscription (until cancelled): from the day chosen nothing more is invoiced — the cycles
     after it go, unless something's paid on them; what's invoiced by then stays owed. In the
     record's activity (Payment). */
  const cancelSubscription = (id, on) => {
    const s0 = all.find(s => s.id === id); if(!s0 || !planOngoing(s0.plan) || s0.cancelledOn) return;
    hub.setAccounting(list => list.map(s => s.id === id ? refreshSchedule(s, {cancelledOn:on}) : s));
    logPayment(s0, 'Subscription cancelled', {detail:`${planTitle(s0)} · no invoices after ${fmtQuoteDate(on)}`});
    setCancelling(null);
    hub.toast('Subscription cancelled');
  };
  const payingSchedule = paying && all.find(s => s.id === paying.scheduleId);
  const payingInst = payingSchedule && !payingSchedule.frozen && payingSchedule.installments.find(x => x.id === paying.instId);
  const viewingSchedule = viewing && all.find(s => s.id === viewing.scheduleId);
  const viewingInst = viewingSchedule && viewingSchedule.installments.find(x => x.id === viewing.instId);
  const openedQuote = quoteOpen && (hub.quotes || []).find(q => q.id === quoteOpen);
  const openedDoc = docOpen && (hub.documents || []).find(d => d.id === docOpen);
  const openedInvoice = invoiceOpen && invoices.find(v => v.id === invoiceOpen);
  const editingSchedule = editing && editing.id && all.find(s => s.id === editing.id);
  const editingType = editingSchedule && paymentTypeOf(editingSchedule), editingPaid = editingType === 'one-time' && hasPayments(editingSchedule) ? editingSchedule.installments[0] : null;
  // The plan to edit (saved before plans: as one — planOf); a paid One-Time payment's amount and dates.
  const editingPlan = editingSchedule ? {...planOf(editingSchedule), currency:editingSchedule.currency || (scheduleTotals(editingSchedule).total > 0 ? LEGACY_CURRENCY : defaultCurrency()),
    ...(editingPaid ? {paid:{id:editingPaid.id, amount:installmentState(editingSchedule, editingPaid).received, invoiceDate:editingPaid.invoiceDate || editingPaid.invoicedAt || '', dueDate:editingPaid.dueDate || ''}} : {})} : null;
  const card = (s) => (
    <PaymentScheduleCard key={s.id} schedule={s} canEdit={canEdit} invoices={invoices} owner={ownerOf(s)} onOpenRecord={(o, r)=>hub.openRecord(o, r.id)}
      quote={s.source === 'quote' ? (hub.quotes || []).find(q => q.id === s.quoteId) || null : null}
      doc={s.source === 'document' ? (hub.documents || []).find(d => d.id === s.documentId) || null : null}
      onPay={(inst)=>setPaying({scheduleId:s.id, instId:inst.id})} onView={(inst)=>setViewing({scheduleId:s.id, instId:inst.id})}
      onEdit={()=>setEditing({id:s.id})} onOpenQuote={(q)=>setQuoteOpen(q.id)} onOpenDocument={(d)=>setDocOpen(d.id)}
      onCancelSubscription={()=>setCancelling(s.id)} onOpenInvoice={(v)=>setInvoiceOpen(v.id)}/>
  );
  if(!can('view')) return <div style={{flex:1, padding:'48px 24px', textAlign:'center', fontSize:13, color:T.gray400}}>You don't have access to this record's payment plans.</div>;
  return (
    <div style={{flex:1, minHeight:0, minWidth:0, display:'flex', flexDirection:'column', position:'relative'}}>
      {/* Active / Paid / Frozen as status pills (as Tools → Tasks' views), Add Payment Plan on the right. */}
      <div style={{display:'flex', alignItems:'center', gap:8, padding:'12px 20px', borderBottom:`1px solid ${T.border}`, flexShrink:0}}>
        {PLAN_STATES.map(st => <button key={st.id} onClick={()=>setTab(st.id)} style={viewPillStyle(tab === st.id)}>{st.name}</button>)}
        <div style={{flex:1}}/>
        {can('create') && <button onClick={()=>setEditing({isNew:true})} style={{...btnPrimarySm(), display:'inline-flex', alignItems:'center', gap:6}}><Icon name="plus" size={13} color="#fff"/> Add Payment Plan</button>}
      </div>
      <div style={{flex:1, minHeight:0, overflowY:'auto', paddingBottom:32, display:'flex', flexDirection:'column'}}>
        {shown.map(card)}
        {!shown.length && <EmptyState compact title={`No ${tab} payment plans`}/>}
      </div>
      {payingInst && <PaymentModal schedule={payingSchedule} inst={payingInst} oneTime={paymentTypeOf(payingSchedule) === 'one-time'} onCancel={()=>setPaying(null)}
        onSave={(v)=>savePayment(payingSchedule.id, payingInst.id, v)} onReverse={()=>reversePayment(payingSchedule.id, payingInst.id)}/>}
      {cancelling && <CancelSubscriptionModal onCancel={()=>setCancelling(null)} onSave={(on)=>cancelSubscription(cancelling, on)}/>}
      {viewingInst && <PaymentVerificationModal inst={viewingInst} currency={scheduleCurrency(viewingSchedule)} onClose={()=>setViewing(null)}/>}
      {editing && editing.isNew && <PaymentStructurePanel key="new" isNew initial={newPaymentPlan({vatRate:QUOTE_VAT_RATE})} signedOn={signedOnOf(null)} quotes={pullableQuotes} onCancel={()=>setEditing(null)} onSave={createPlan}/>}
      {editing && editingPlan && <PaymentStructurePanel key={editing.id} initial={editingPlan} signedOn={signedOnOf(editingSchedule)} scheduleId={editingSchedule.id}
        locked={editingPaid ? null : lockedOf(editingSchedule)} signedLabel={editingSchedule.source === 'document' ? 'Document Signed' : undefined}
        frozen={!!editingSchedule.frozen} onFreeze={canEdit ? ()=>freezePlan(editingSchedule.id, !editingSchedule.frozen) : null}
        heading={`Edit Payment Plan · ${editingSchedule.number || ''}`} onCancel={()=>setEditing(null)} onSave={editPlan}/>}
      {/* The quotation or document a plan was made from, as on Tools; an invoice. */}
      {openedQuote && <PageSidePanel title={openedQuote.number} onClose={()=>setQuoteOpen(null)}>
        <div style={{flex:1, overflowY:'auto', padding:'4px 20px 24px'}}><QuoteDocument quote={openedQuote}/></div>
      </PageSidePanel>}
      {openedDoc && <PageSidePanel title={openedDoc.number} onClose={()=>setDocOpen(null)}>
        <div style={{flex:1, overflowY:'auto', padding:'4px 20px 24px'}}><DocumentView doc={openedDoc}/></div>
      </PageSidePanel>}
      {openedInvoice && <InvoicePanel invoice={openedInvoice} onClose={()=>setInvoiceOpen(null)}/>}
    </div>
  );
}

Object.assign(window, {RECURRING_FREQUENCY, rollSubscription, refreshSchedule, planOngoing, newPaymentPlan, planSchedule, planTotal, planOk, planOf, planOfShares, normalizePlan, invoicedOn, dayOf,
  plansOnQuoteSigned, PaymentTermsFields, PaymentPlanTable, PAYMENT_TYPE_LABEL, paymentTypeOf, scheduleCurrency, hasPayments, recordHasPayments, planScopeOf, recordPlansOf, livePayments,
  PLAN_STATES, planState, nextPlanNumber, planTitle, migratePlans, defaultTermsOf, unpackPaymentTerms, AccountingTab, ACCOUNTING_RECORD_TYPES, installmentState, scheduleTotals});
