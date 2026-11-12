/* HOF Pulse ERP — Invoices: one invoice per payment of a Payment Plan (accounting.jsx), and
   Tools → Invoices (decided 2026-11-12).

   Every payment instance of a plan — a deposit, an installment, a subscription's cycle, the balance
   left by a part payment — has its own invoice, a record of its own (App: `invoices`), linked to
   its plan (`planId`, the plan's number and the revision it was issued under) and its payment
   (`instId`). An invoice is issued, automatically, on the payment's invoice date (the plan's
   configuration: Quote / Document Signed, a fixed date, the installments' and cycles' timing):
   InvoiceIssuer issues what's due on every change and as the day turns — none while the plan is
   frozen (what fell due meanwhile is issued once it's unfrozen). Recording a payment issues the
   payment's invoice first if it has none yet. Each invoice gets the next number (INV-<year>-<nnnn>,
   a counter per CRM branch that only goes up) and is sent to the record's person: an email with
   the invoice on the record's activity (nothing is really emailed).

   An issued invoice is never changed. It keeps what it was issued with — amount, currency, dates,
   the person, the brand, the plan's payments as they were (`structure`) — and only moves:
     Sent        — issued, not paid, its due date not passed;
     Outstanding — its due date passed unpaid (worked out from the date, nothing stored);
     Paid        — its payment reconciled (accounting.jsx: proof required) — the PAID stamp;
     Archived    — superseded: the plan was edited and this payment's amount or dates changed
                   (a new invoice is issued from the new plan), or a part payment was recorded on it
                   (the balance has its own invoice; this one keeps what was received). An archived
                   invoice never becomes Paid; it can be deleted (Tools → Invoices).
   A One-Time payment reversed (Unpaid again) takes its invoice back to Sent / Outstanding, the
   reversal kept on it (`reversals`).
   Invoices saved before this (the payment terms' installments) were issued once, quietly — no
   emails — for every payment whose invoice date had passed, numbered in date order; paid ones Paid.

   Tools → Invoices: the Quotes table (views, search, filters, columns) with four views — Sent,
   Outstanding, Paid, Archived — and the invoice in a side panel (InvoiceDocument: the Digital
   Letterhead, the payment, the plan's payments with this one marked; no services). Each is also
   on its record's Accounting tab, under its plan. Permissions: the record type's Tools → Invoices
   (Users & Teams). */

const INVOICE_STATUS = {sent:{label:'Sent', tone:'info'}, outstanding:{label:'Outstanding', tone:'warn'}, paid:{label:'Paid', tone:'success'}, archived:{label:'Archived', tone:'neutral'}};
const invoiceToday = () => ymdOf(new Date());
// Sent until its due date has passed unpaid (Outstanding); Paid once reconciled; Archived once superseded.
const invoiceStatusOf = (inv, today = invoiceToday()) => inv.status === 'archived' ? 'archived' : inv.status === 'paid' ? 'paid' : inv.dueDate && inv.dueDate < today ? 'outstanding' : 'sent';
const InvoiceStatusPill = ({invoice}) => <StatusPill status={invoiceStatusOf(invoice)} map={INVOICE_STATUS}/>;
// The next number: from a counter that only goes up (store.jsx `ids.invoices`), never below one used.
const invoiceNumber = (list, year) => {
  ensureIdFloor('invoices', quoteSeqFloor(list));
  return `INV-${year || new Date().getFullYear()}-${String(newRecordId('invoices')).padStart(4, '0')}`;
};
// A payment's invoice that counts: the one issued or paid (an archived one no longer does).
const currentInvoiceOf = (invoices, planId, instId) => (invoices || []).find(v => v.planId === planId && v.instId === instId && v.status !== 'archived') || null;
const planInvoices = (invoices, planId) => (invoices || []).filter(v => v.planId === planId);
const paidSum = (inst) => r2((inst.payments || []).reduce((a, p) => a + (Number(p.amount) || 0), 0));
const paidDays = (inst) => (inst.payments || []).map(p => dayOf(p.paidOn)).filter(Boolean).sort();
/* The day a payment's invoice is issued: its invoice date (the plan's), else — saved before plans —
   the day it was invoiced; a balance: the day of the part payment that left it. Paid before then:
   the day it was paid. Terms saved before plans with none of these have no invoice date to follow:
   their invoice comes with a payment, or once the plan is edited. */
function invoiceIssueDay(s, inst){
  const parent = inst.parentId && (s.installments || []).find(x => x.id === inst.parentId);
  const base = dayOf(inst.invoiceDate) || dayOf(inst.invoicedAt) || (parent ? paidDays(parent).slice(-1)[0] || '' : '');
  const paid = paidDays(inst)[0];
  return paid && (!base || paid < base) ? paid : base;
}
// The plan's payments as an invoice shows them (kept on it as they were when it was issued).
const invoiceStructure = (s) => (s.installments || []).filter(x => !(s.installments || []).some(b => b.parentId === x.id))
  .map(x => ({id:x.id, description:x.description, amount:x.amount, dueDate:x.dueDate || '', tentative:x.tentative || ''}));
// A new invoice for a payment of plan `s`, issued `on` (a day), as it stands now.
function buildInvoice(hub, s, inst, {on, number, brandId}){
  const person = hubRecordPerson(hub, s.object, s.recordId) || {name:'', email:''};
  return {id:acId('inv'), number, planId:s.id, planNumber:s.number || '', revision:s.revision || 1, instId:inst.id, object:s.object, recordId:s.recordId,
    description:inst.description, paymentType:paymentTypeOf(s), amount:r2(inst.amount), currency:scheduleCurrency(s),
    issueDate:on, dueDate:dayOf(inst.dueDate) || on, plannedIssue:dayOf(inst.invoiceDate) || '', issuedAt:new Date().toISOString(),
    billTo:{name:person.name || '', email:person.email || ''}, brandId, structure:invoiceStructure(s), ongoing:planOngoing(s.plan), status:'issued'};
}
// The email an issued invoice goes out in (on the record's activity, as a sent quote's).
function logInvoiceEmail(hub, inv){
  if(!hub.add) return;
  hub.add(inv.object, inv.recordId, {type:'email', direction:'sent', status:'sent', to:[inv.billTo.email].filter(Boolean), source:'you', by:null, invoiceId:inv.id,
    title:`Invoice ${inv.number}: ${inv.description}`,
    body:`Hi ${emailFirstName(inv.billTo.name) || 'there'},\n\nPlease find your invoice ${inv.number} for ${inv.description} (${PAYMENT_TYPE_LABEL[inv.paymentType] || 'Payment'}${inv.planNumber ? `, ${inv.planNumber}` : ''}).\n\n`
      + `Amount: ${fmtMoney(inv.amount, inv.currency)}\nIssued: ${fmtQuoteDate(inv.issueDate)}\nDue: ${fmtQuoteDate(inv.dueDate)}\n\nKind regards,\n${CURRENT_USER.name}`});
}
// Issue invoices for `items` [{s, inst, on}] — numbered in that order — sent unless `quiet`.
function issueInvoices(hub, items, {quiet} = {}){
  if(!items.length) return [];
  const brandId = keepQuoteBrand();
  let all = [...(hub.invoices || [])];
  const made = items.map(({s, inst, on}) => { const v = buildInvoice(hub, s, inst, {on, number:invoiceNumber(all, on.slice(0, 4)), brandId}); all = [...all, v]; return v; });
  hub.setInvoices(list => [...list, ...made.filter(v => !currentInvoiceOf(list, v.planId, v.instId))]);
  if(!quiet) made.forEach(v => logInvoiceEmail(hub, v));
  return made;
}
/* The payments due an invoice by `today`: its issue day has come, it has an amount, it has none
   yet and nothing is paid on it (a payment issues its own), its plan isn't frozen; a payment whose
   rest moved to a balance has had its own. */
function invoicesDueOn(accounting, invoices, today){
  const has = new Set((invoices || []).filter(v => v.status !== 'archived').map(v => `${v.planId}|${v.instId}`));
  return (accounting || []).flatMap(s => s.frozen ? [] : (s.installments || []).filter(i => i.amount > 0 && !has.has(`${s.id}|${i.id}`) && !(i.payments || []).length
    && !(s.installments || []).some(x => x.parentId === i.id)).map(inst => ({s, inst, on:invoiceIssueDay(s, inst)})).filter(x => x.on && x.on <= today));
}
/* A plan saved with changes (accounting.jsx): its unpaid invoices whose payment changed — its amount,
   due date or invoice date, or gone from the plan — are archived (superseded at the revision before
   `s`'s); the plan's next sync issues the new ones. */
function archiveChangedInvoices(list, s){
  const at = new Date().toISOString();
  return list.map(v => {
    if(v.planId !== s.id || v.status !== 'issued') return v;
    const inst = (s.installments || []).find(x => x.id === v.instId);
    const changed = !inst || r2(inst.amount) !== r2(v.amount) || (dayOf(inst.dueDate) || '') !== (v.dueDate || '') || (!!inst.invoiceDate && dayOf(inst.invoiceDate) !== v.plannedIssue && !!v.plannedIssue);
    return changed ? {...v, status:'archived', archivedAt:at, archivedReason:'superseded', archivedRevision:(s.revision || 2) - 1} : v;
  });
}
/* Invoices for the payment terms saved before invoicing: once, quietly — every payment whose issue
   day has passed, numbered in date order; a paid one Paid, a part-paid one archived (its balance
   has its own). */
function backfillInvoices(hub, today){
  const items = (hub.accounting || []).flatMap(s => (s.installments || []).filter(i => i.amount > 0 && !currentInvoiceOf(hub.invoices, s.id, i.id))
    .map(inst => ({s, inst, on:invoiceIssueDay(s, inst)})).filter(x => x.on && x.on <= today))
    .sort((a, b) => a.on.localeCompare(b.on));
  if(!items.length) return;
  const brandId = keepQuoteBrand();
  let all = [...(hub.invoices || [])];
  const made = items.map(({s, inst, on}) => {
    let v = buildInvoice(hub, s, inst, {on, number:invoiceNumber(all, on.slice(0, 4)), brandId});
    const split = (s.installments || []).some(x => x.parentId === inst.id), received = paidSum(inst);
    if(split) v = {...v, status:'archived', archivedAt:new Date().toISOString(), archivedReason:'partial', received};
    else if(received > 0 && received >= inst.amount - 0.005){ const last = inst.payments[inst.payments.length - 1];
      v = {...v, status:'paid', paidOn:dayOf(last.paidOn), paymentId:last.id, paidAt:last.recordedAt || new Date().toISOString()}; }
    all = [...all, v]; return v;
  });
  hub.setInvoices(list => [...list, ...made]);
}
/* The issuing: on every change of the plans and invoices, and as the day turns — what's due is
   issued, dated the day it's issued (the first time, the backfill — dated when each was invoiced).
   A tab whose data is out of date leaves it to the current one. */
function InvoiceIssuer(){
  const hub = useRecordHub();
  const [day, setDay] = React.useState(invoiceToday);
  const issued = React.useRef(new Set());   // issued here, until the invoices show them
  React.useEffect(() => { const t = setInterval(() => setDay(invoiceToday()), 60000); return () => clearInterval(t); }, []);
  const backfilled = !!(hub.data || {}).invoicesBackfilled;
  React.useEffect(() => {
    if(DB.isStale()) return;
    if(!backfilled){ backfillInvoices(hub, day); hub.setData(d => ({...d, invoicesBackfilled:true})); return; }
    const seen = new Set((hub.invoices || []).map(v => `${v.planId}|${v.instId}`));
    issued.current.forEach(k => seen.has(k) && issued.current.delete(k));
    const due = invoicesDueOn(hub.accounting, hub.invoices, day).filter(x => !issued.current.has(`${x.s.id}|${x.inst.id}`));
    if(!due.length) return;
    due.forEach(x => issued.current.add(`${x.s.id}|${x.inst.id}`));
    // In the order they fell due, each issued today (a day passed while frozen, or before a signing dated back: today).
    issueInvoices(hub, due.sort((a, b) => a.on.localeCompare(b.on)).map(x => ({...x, on:day})));
  }, [hub.accounting, hub.invoices, day, backfilled]);
  return null;
}

/* ── The invoice ── on the brand it was issued with: who it's for, its dates, the payment it's for
   and its amount, then the plan's payments with this one marked. Paid: the PAID stamp, beside the
   amount. */
function PaidStamp({on}){
  return (
    <div aria-label="Paid" style={{flexShrink:0, alignSelf:'center', transform:'rotate(-12deg)', border:'3px solid #12B76A', borderRadius:10, padding:'6px 18px 5px',
      color:'#12B76A', textAlign:'center', pointerEvents:'none', margin:'0 6px'}}>
      <div style={{fontSize:30, fontWeight:800, letterSpacing:5, lineHeight:1}}>PAID</div>
      {on && <div style={{fontSize:11, fontWeight:600, letterSpacing:.4, marginTop:3}}>{fmtQuoteDate(on)}</div>}
    </div>
  );
}
function InvoiceDocument({invoice}){
  const hub = useRecordHub();
  const brand = quoteBrand(invoice), record = hubRecord(hub, invoice.object, invoice.recordId);
  const status = invoiceStatusOf(invoice), cur = invoice.currency;
  const muted = {fontSize:12, color:T.attioMuted};
  const section = {fontSize:11, fontWeight:700, letterSpacing:.6, textTransform:'uppercase', color:brand.colors.secondary, marginBottom:10};
  const money = {fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap'};
  const cell = (label, value) => <div><div style={muted}>{label}</div><div style={{fontSize:13.5, color:T.attioText, overflowWrap:'anywhere'}}>{value || '—'}</div></div>;
  const rows = invoice.structure || [];
  return (
    <div style={{position:'relative'}}>
      <BrandedDocument brand={brand} label="Invoice" number={invoice.number}>
        <div style={{padding:'18px 24px', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:16, borderBottom:`1px solid ${T.attioLine}`}}>
          <div><div style={muted}>Bill to</div><div style={{fontSize:13.5, fontWeight:500, color:T.attioText}}>{invoice.billTo.name || '—'}</div>
            <div style={{fontSize:12.5, color:T.attioMuted, overflowWrap:'anywhere'}}>{invoice.billTo.email}</div></div>
          {cell(HUB_NOUN[invoice.object], record ? record.name : '')}
          {cell('Issue date', fmtQuoteDate(invoice.issueDate))}
          {cell('Due date', fmtQuoteDate(invoice.dueDate))}
        </div>
        <div style={{padding:'20px 24px', display:'flex', flexDirection:'column', gap:22}}>
          <div>
            <div style={section}>Payment</div>
            <div style={{display:'flex', alignItems:'flex-start', gap:16, flexWrap:'wrap'}}>
              <div style={{flex:1, minWidth:180}}>
                <div style={{fontSize:16, fontWeight:600, color:T.attioText}}>{invoice.description}</div>
                <div style={{fontSize:12.5, color:T.attioMuted, marginTop:3}}>{PAYMENT_TYPE_LABEL[invoice.paymentType] || 'Payment'}{invoice.planNumber ? ` · Payment plan ${invoice.planNumber}` : ''}</div>
              </div>
              {status === 'paid' && <PaidStamp on={invoice.paidOn}/>}
              <div style={{textAlign:'right'}}>
                <div style={muted}>Amount due</div>
                <div style={{...money, fontSize:22, fontWeight:700, color:T.attioText}}>{fmtMoney(invoice.amount, cur)}</div>
                <div style={{marginTop:4}}><StatusPill status={status} map={INVOICE_STATUS}/></div>
              </div>
            </div>
          </div>
          {rows.length > 0 && (
            <div>
              <div style={section}>Payment plan</div>
              <div style={{display:'flex', gap:12, padding:'0 0 6px', fontSize:11.5, color:T.attioMuted}}>
                <span style={{flex:1}}>Payment</span><span style={{width:110, textAlign:'right'}}>Due</span><span style={{width:120, textAlign:'right'}}>Amount</span></div>
              {rows.map(x => { const me = x.id === invoice.instId; return (
                <div key={x.id} style={{display:'flex', gap:12, alignItems:'baseline', padding:'7px 8px', margin:'0 -8px', borderTop:`1px solid ${T.attioLine}`, fontSize:13,
                  color:T.attioText, fontWeight: me ? 600 : 400, background: me ? T.headerBg : 'transparent', borderRadius: me ? 6 : 0}}>
                  <span style={{flex:1, minWidth:0}}>{x.description}{me && <span style={{fontWeight:500, color:T.attioMuted}}> · this invoice</span>}</span>
                  <span style={{...money, width:110, textAlign:'right', color:T.attioMuted}}>{fmtQuoteDate(x.dueDate) || x.tentative || '—'}</span>
                  <span style={{...money, width:120, textAlign:'right'}}>{fmtMoney(x.amount, cur)}</span>
                </div>); })}
              {invoice.ongoing && <div style={{borderTop:`1px solid ${T.attioLine}`, paddingTop:7, fontSize:13, color:T.attioMuted}}>Until cancelled</div>}
            </div>
          )}
        </div>
      </BrandedDocument>
    </div>
  );
}
// An invoice in a side panel (Tools → Invoices, the record's Accounting tab): the document; an archived one can be deleted.
function InvoicePanel({invoice, onClose, onDelete}){
  const note = invoice.status === 'archived' ? `Archived ${fmtQuoteDate(invoice.archivedAt)} · ${invoice.archivedReason === 'partial'
    ? `part payment of ${fmtMoney(invoice.received || 0, invoice.currency)} recorded; the balance has its own invoice` : `superseded by revision ${(invoice.archivedRevision || 1) + 1} of the plan`}` : '';
  return (
    <PageSidePanel title={invoice.number} onClose={onClose} menuItems={onDelete && invoice.status === 'archived' ? [{label:'Delete Invoice', danger:true, onClick:()=>onDelete(invoice)}] : undefined}>
      <div style={{flex:1, overflowY:'auto', padding:'4px 20px 24px', display:'flex', flexDirection:'column', gap:12}}>
        {note && <div style={{fontSize:12.5, color:T.attioMuted, padding:'8px 12px', borderRadius:8, background:T.headerBg}}>{note}</div>}
        <InvoiceDocument invoice={invoice}/>
      </div>
    </PageSidePanel>
  );
}
function DeleteInvoiceModal({invoice, onCancel, onDeleted}){
  const hub = useRecordHub();
  return (
    <StModal title="Delete Invoice" primary="Delete Invoice" danger onCancel={onCancel}
      onSubmit={()=>{ hub.setInvoices(list => list.filter(v => !(v.id === invoice.id && v.status === 'archived'))); hub.toast(`Invoice ${invoice.number} deleted`); onDeleted && onDeleted(); }}>
      <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>Archived invoice {invoice.number} will be deleted. This can't be undone.</div>
    </StModal>
  );
}

/* ── Tools → Invoices ── the Quotes table: Sent, Outstanding, Paid, Archived. */
const INVOICE_COLUMNS = [
  {key:'number', label:'Invoice', width:140}, {key:'recordName', label:'Record', width:200}, {key:'objectLabel', label:'Record Type', width:130},
  {key:'planNumber', label:'Payment Plan', width:150}, {key:'description', label:'Payment', width:170}, {key:'amountText', label:'Amount', width:140, money:true},
  {key:'currency', label:'Currency', width:110}, {key:'issueText', label:'Issue Date', width:130}, {key:'dueText', label:'Due Date', width:130}, {key:'statusLabel', label:'Status', width:130},
];
const invoiceView = (id, name, status) => ({id, name, sort:{key:'number', dir:'desc'}, filters:{nodes:[{id:`f-${id}`, kind:'row', joinOp:'AND', prop:'statusLabel', op:'is', value:status, value2:'', values:[]}]}});
function InvoicesPage(){
  const hub = useRecordHub();
  const [openId, setOpenId] = React.useState(null);
  const [deleting, setDeleting] = React.useState(null);
  const today = invoiceToday();
  const can = (v, action) => { const r = hubRecord(hub, v.object, v.recordId); return !r || toolCan(v.object, r, 'invoices', action); };
  const visible = (hub.invoices || []).filter(v => can(v, 'view'));
  const rows = visible.map(v => { const r = hubRecord(hub, v.object, v.recordId); return {...v, recordName:r ? r.name : '—', objectLabel:HUB_NOUN[v.object],
    amountValue:toDefaultCurrency(v.amount, v.currency), amountText:fmtMoney(v.amount, v.currency), issueText:fmtQuoteDate(v.issueDate), dueText:fmtQuoteDate(v.dueDate),
    statusLabel:INVOICE_STATUS[invoiceStatusOf(v, today)].label}; });
  const open = visible.find(v => v.id === openId) || null;
  const deletable = (v) => v.status === 'archived' && can(v, 'delete');
  // Bulk Actions: Delete — archived invoices only.
  const bulk = useTableBulkDelete({rows:visible, noun:'invoice', canDelete:deletable, skipNote:'not archived',
    remove:(ids) => { hub.setInvoices(list => list.filter(v => !(ids.includes(v.id) && v.status === 'archived'))); if(ids.includes(openId)) setOpenId(null); },
    onDone:(n) => hub.toast(`${bulkPlural(n, 'invoice')} deleted`)});
  const schema = {
    properties:INVOICE_COLUMNS, noun:'invoice', searchKeys:['number', 'recordName', 'planNumber', 'description'], canCreateProperty:false, bulkActions:bulk.bulkActions,
    filterProps:[{key:'statusLabel', label:'Status', type:'select'}, {key:'objectLabel', label:'Record Type', type:'select'}, {key:'currency', label:'Currency', type:'select'},
      {key:'amountValue', label:'Amount', type:'number'}],
    selectValues:{statusLabel:Object.values(INVOICE_STATUS).map(s => s.label), objectLabel:['Contact', 'Deal', 'Customer'], currency:[...new Set(visible.map(v => v.currency))]},
    renderCell:(key, r) => key === 'number' ? <ContactName name={r.number} onOpen={()=>setOpenId(r.id)} style={{fontSize:'inherit', fontWeight:500}}/>
      : key === 'recordName' && r.recordName !== '—' ? <HubRecordLink object={r.object} id={r.recordId} name={r.recordName}/>
      : key === 'statusLabel' ? <StatusPill status={invoiceStatusOf(r, today)} map={INVOICE_STATUS}/> : undefined,
    renderActions:(r) => <RowActionsMenu title="Invoice Actions" width={MENU_W} items={[{label:'View Invoice', onClick:()=>setOpenId(r.id)},
      ...(deletable(r) ? [{label:'Delete Invoice', danger:true, onClick:()=>setDeleting(visible.find(v => v.id === r.id))}] : [])]}/>,
  };
  return (
    <div style={{flex:1, minWidth:0, minHeight:0, display:'flex', flexDirection:'column', position:'relative', overflow:'hidden'}}>
      <RecordViewsModule inset="page" schema={schema} rows={rows} columns={INVOICE_COLUMNS.map(c => c.key)} storeKey="views:invoices"
        defaultViews={[invoiceView('iv-sent', 'Sent', 'Sent'), invoiceView('iv-outstanding', 'Outstanding', 'Outstanding'), invoiceView('iv-paid', 'Paid', 'Paid'), invoiceView('iv-archived', 'Archived', 'Archived')]}
        overlay={open && <InvoicePanel invoice={open} onClose={()=>setOpenId(null)} onDelete={deletable(open) ? setDeleting : null}/>}/>
      {bulk.bulkModal}
      {deleting && <DeleteInvoiceModal invoice={deleting} onCancel={()=>setDeleting(null)} onDeleted={()=>{ if(openId === deleting.id) setOpenId(null); setDeleting(null); }}/>}
    </div>
  );
}

Object.assign(window, {INVOICE_STATUS, invoiceStatusOf, InvoiceStatusPill, currentInvoiceOf, planInvoices, invoiceIssueDay, buildInvoice, issueInvoices, invoicesDueOn,
  archiveChangedInvoices, InvoiceIssuer, InvoiceDocument, InvoicePanel, DeleteInvoiceModal, InvoicesPage});
