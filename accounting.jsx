/* HOF Pulse ERP — Accounting: a record's payment structures (record detail → Accounting tab, on
   Contacts, Deals and Customers).

   One payment structure per record ("Payment Terms"): every record starts with it — a First
   installment, Unpaid (the default terms) — and none is created by hand. Its ⋯ (until the first
   payment is recorded):
     Edit Payment Terms — the title, the total, a start date and the installments (rename them,
       their percentage, Day N from the start date or a calendar date), as on a quote.
     Add installment    — the same editor with a new installment to fill in.
     Pull from quote    — a quote sent to the record (Sent or Signed) fills the structure with its
       payment terms (total and installments: description, percentage, amount, tentative date — a
       "Day N" counting from the quote's sent date), marked "Imported from Quotation". Each quote
       can be pulled once. Payments can be recorded once the quote is signed.
   A record saved with more than one structure (before this rule) keeps one — the one with
   payments, else a quote's, else its own (primaryTermsOf) — and the others stay, archived:
   viewable, read-only, never deleted.

   Payments only move forward (no edit or undo until a correction workflow is defined):
     Unpaid          — nothing received.
     Partially Paid  — an amount received (less than the installment); the rest becomes its own
                       installment, linked to the original ("Balance of …"), with its own amount,
                       expected date and status. The original keeps its amount and payment.
     Paid            — the installment's outstanding amount received in full.
   Each payment is its own record: amount, date, who recorded it, and optional evidence — an
   uploaded screenshot (≤2 MB) and / or a payment gateway or reference link.

   Recording payments and manual structures need edit access to the record; everyone who can see
   it sees its structures. */

const ACCOUNTING_RECORD_TYPES = ['contacts', 'deals', 'customers'];
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
// A record's one payment structure among those saved for it (see the header); the rest are archived.
function primaryTermsOf(list){
  if(!list || !list.length) return null;
  const paid = list.filter(hasPayments);
  return paid.length ? paid[paid.length - 1] : list.find(s => s.source !== 'manual') || list.find(s => !s.isDefault) || list[0];
}
// A structure's installments as editable terms (a quote's become set dates or Day 0).
const termsOfSchedule = (s) => s.source === 'manual' && s.terms ? s.terms
  : (s.installments || []).filter(x => !x.parentId).map(x => ({id:x.id, description:x.description, percent:x.percent, due: x.dueDate ? {type:'date', date:x.dueDate} : {type:'days', days:0}}));
// A quote's payment structure, as pulled.
const scheduleFromQuote = (q, object, record) => ({
  id:`qs-${q.id}`, source:'quote', quoteId:q.id, quoteNumber:q.number, quoteTitle:q.title, object, recordId:record.id, createdAt:q.createdAt, createdBy:q.createdBy, total:quoteTotal(q),
  installments:(q.installments || []).map((x, i) => ({id:`qs-${q.id}-${x.id || i}`, parentId:null, description:x.description, percent:Number(x.percent) || 0,
    amount:installmentAmount(q, x), dueDate:tentativeDate(x.due, q.sentAt), tentative: x.due && x.due.type !== 'date' ? fmtTentative(x.due) : '', payments:[]})),
});
/* The default payment terms every Contact, Deal and Customer starts with while it has none of its
   own: one installment — First installment, 100%, Unpaid — the total the deal's amount (0 for a
   contact or customer until it's set). A real structure (edited, paid or replaced like any other),
   so the record's First Installment Status reads Unpaid for workflows. No due date is invented:
   it's set when the terms are edited (Forecasted Cash counts installments by due date). */
const defaultTermsOf = (id, object, recordId, total, startDate, createdAt) => ({id, source:'manual', isDefault:true, object, recordId, createdAt, createdBy:'System',
  title:'Payment terms', total, startDate, terms:[{id:id + 't', description:'First installment', percent:100, due:null}],
  installments:[{id:id + 'i', parentId:null, description:'First installment', percent:100, amount:total, dueDate:'', tentative:'', payments:[]}]});
const defaultPaymentTerms = (object, record) =>
  defaultTermsOf(acId('ps'), object, record.id, object === 'deals' ? r2(Number(record.amount) || 0) : 0, ymdOf(new Date()), new Date());
/* Saved compactly while untouched (every record has them, and browser storage is small); once
   edited or paid they're saved in full like any other structure. */
const packPaymentTerms = (list) => list.map(s => {
  if(!s.isDefault) return s;
  const fresh = defaultTermsOf(s.id, s.object, s.recordId, s.total, s.startDate, s.createdAt);
  return JSON.stringify(s) === JSON.stringify(fresh) ? {defaultTerms:[s.id, s.object, s.recordId, s.total, s.startDate, +new Date(s.createdAt)]} : s;
});
const unpackPaymentTerms = (list) => (list || []).map(s => s && s.defaultTerms
  ? (([id, object, recordId, total, startDate, at]) => defaultTermsOf(id, object, recordId, total, startDate, new Date(at)))(s.defaultTerms) : s);
// A manual structure's installments from its definition: amounts from the total, dates from the start date.
const manualInstallments = (def) => (def.terms || []).map(x => ({id:x.id, parentId:null, description:x.description, percent:Number(x.percent) || 0,
  amount:r2((Number(def.total) || 0) * (Number(x.percent) || 0) / 100),
  dueDate: x.due && x.due.type === 'delivery' ? '' : x.due && x.due.type === 'date' ? x.due.date : def.startDate ? ymdOf(new Date(new Date(`${def.startDate}T00:00:00`).getTime() + (Number(x.due && x.due.days) || 0) * 86400000)) : '',
  tentative: x.due && x.due.type !== 'date' ? fmtTentative(x.due) : '', payments:[]}));

/* ── Edit Payment Terms: the side panel ── a title, the total, the start date (Day 0) and the
   installments, as on a quote. `addRow`: opened from Add installment — a new installment to fill in. */
/* `pullable`: the quotes sent to the record whose terms aren't pulled yet; `onPull(quote)` fills the terms with one. */
function PaymentStructurePanel({initial, addRow, onCancel, onSave, pullable = [], onPull}){
  const [pickOpen, setPickOpen] = React.useState(false);
  const [title, setTitle] = React.useState(initial ? initial.title : '');
  const [total, setTotal] = React.useState(initial ? String(initial.total) : '');
  const [startDate, setStartDate] = React.useState(initial ? initial.startDate : ymdOf(new Date()));
  const [terms, setTerms] = React.useState(() => [...(initial ? initial.terms.map(x => ({...x, percent:String(x.percent), due:{...x.due}}))
    : [{id:acId('mt'), description:'', percent:'100', due:{type:'days', days:0}}]), ...(addRow ? [{id:acId('mt'), description:'', percent:'', due:{type:'days', days:0}}] : [])]);
  const setTerm = (id, p) => setTerms(ts => ts.map(x => x.id === id ? {...x, ...p} : x));
  const sum = terms.reduce((s, x) => s + (Number(x.percent) || 0), 0);
  const totalOk = total !== '' && Number(total) > 0;
  const ok = !!title.trim() && totalOk && !!startDate && terms.length > 0 && terms.every(x => x.description.trim() && Number(x.percent) > 0 && tentativeOk(x.due)) && Math.abs(sum - 100) < 0.001;
  const money = {fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap'};
  const section = {fontSize:11, fontWeight:600, color:T.attioFaint, textTransform:'uppercase', letterSpacing:.4};
  const save = () => ok && onSave({title:title.trim(), total:r2(total), startDate,
    terms:terms.map(x => ({...x, description:x.description.trim(), percent:Number(x.percent), due:normalizeDue(x.due)}))});
  return (
    <CreatePanelFrame title={initial ? 'Edit Payment Terms' : 'New Payment Terms'} onClose={onCancel} placement="fixed" width={1000} actions={<>
      <StSecondary label="Cancel" onClick={onCancel}/>
      <StCta label="Save" disabled={!ok} onClick={save}/>
    </>}>
      {/* Pull from quote: a sent quote's payment terms, brought in as they are. */}
      {onPull && pullable.length > 0 && (
        <div style={{display:'flex', alignItems:'center', gap:10, padding:'12px 14px', marginBottom:18, border:`1px solid ${T.attioLine}`, borderRadius:10, background:T.headerBg}}>
          <Icon name="quote" size={15} color={T.gray600}/>
          <span style={{flex:1, fontSize:13, color:T.attioText}}>Pull payment terms from a sent quote</span>
          <div style={{position:'relative'}}>
            <button type="button" disabled={!pullable.length} onClick={()=>setPickOpen(o => !o)}
              style={{...btnSecondarySm, opacity: pullable.length ? 1 : .5, cursor: pullable.length ? 'pointer' : 'default'}}>
              Pull from quote <Icon name="chevDown" size={11} color={T.gray600}/></button>
            <MenuShell open={pickOpen} onClose={()=>setPickOpen(false)} anchorRight width={340}>
              {pullable.map(q => (
                <div key={q.id} onClick={()=>{ setPickOpen(false); onPull(q); }} style={{padding:'9px 12px', cursor:'pointer', display:'flex', flexDirection:'column', gap:2}}
                  onMouseEnter={e=>e.currentTarget.style.background = T.headerBg} onMouseLeave={e=>e.currentTarget.style.background = 'transparent'}>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <span style={{fontSize:13, fontWeight:500, color:T.attioText}}>{q.number}</span><QuoteStatusPill status={q.status}/>
                    <span style={{flex:1}}/><span style={{fontSize:12.5, color:T.attioText, fontVariantNumeric:'tabular-nums'}}>{fmtMoney(quoteTotal(q))}</span>
                  </div>
                  <span style={{fontSize:12, color:T.attioMuted}}>{q.title} · {plural((q.installments || []).length, 'installment')}</span>
                </div>
              ))}
            </MenuShell>
          </div>
        </div>
      )}
      {stack(<>
        <Field label="Title"><input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Visa application fees" style={fieldText}/></Field>
        <Field label={`Total (${DEAL_CURRENCY})`}><input value={total} onChange={e=>setTotal(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0"
          style={{...fieldText, fontVariantNumeric:'tabular-nums'}}/></Field>
        <Field label="Start date (Day 0)"><DateField required value={startDate} onChange={setStartDate}/></Field>
      </>)}
      <div style={{borderTop:`1px solid ${T.border}`, margin:'18px -20px 14px'}}/>
      <InstallmentsEditor rows={terms} onChange={setTerms} total={totalOk ? Number(total) : 0} newId={()=>acId('mt')}/>
    </CreatePanelFrame>
  );
}

/* ── Update an installment's status: Paid or Partially Paid, with the payment and its evidence ── */
function PaymentModal({schedule, inst, onCancel, onSave}){
  const st = installmentState(schedule, inst);
  const due = r2(inst.amount - st.received);
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
  const ok = unpaid || (!!paidOn && amountOk && linkOk && (!partial || !!expected));
  const radio = (k, label) => (
    <label key={k} style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:T.attioText, cursor:'pointer'}}>
      <input type="radio" name="payment-status" checked={status === k} onChange={()=>setStatus(k)}/> {label}
    </label>
  );
  return ReactDOM.createPortal(
    <StModal title="Update Status" primary={unpaid ? 'Save' : 'Save payment'} canSubmit={ok} width={676} onCancel={onCancel}
      onSubmit={()=>ok && (unpaid ? onCancel() : onSave({status, amount: partial ? r2(amt) : due, paidOn, expected, evidence:{file, link:link.trim()}}))}>
      {/* Two columns: the installment's figures on the left, the payment on the right. */}
      <div style={{display:'grid', gridTemplateColumns:'minmax(0, 1fr) 1px minmax(0, 1.2fr)', columnGap:14, minHeight:310}}>
        <div style={{display:'flex', flexDirection:'column', gap:14}}>
          <PayDetail label="Installment">{inst.description}</PayDetail>
          <PayDetail label="Outstanding">{fmtMoney(due)}</PayDetail>
          {partial && <PayDetail label="Remaining balance">{fmtMoney(amountOk && amount ? r2(due - amt) : due)}</PayDetail>}
        </div>
        <div style={{background:T.border}}/>
        <div style={{display:'flex', flexDirection:'column', gap:14, minWidth:0}}>
          <div style={{display:'flex', gap:20}}>{radio('paid', 'Paid')}{radio('partial', 'Partially Paid')}{radio('unpaid', 'Unpaid')}</div>
          {partial && <>
            <div><label style={fieldLabel}>Amount received ({DEAL_CURRENCY})</label>
              <input autoFocus value={amount} onChange={e=>setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0"
                style={{...fieldInput, fontVariantNumeric:'tabular-nums', borderColor: amount && !amountOk ? T.red : T.borderStrong}}/>
              {amount && !amountOk && <div style={{fontSize:12, color:T.red, marginTop:4}}>Less than {fmtMoney(due)} — a full payment is Paid.</div>}
            </div>
            <div><label style={fieldLabel}>Remaining balance expected on</label><DateField required value={expected} onChange={setExpected}/></div>
          </>}
          {!unpaid && <>
          <div><label style={fieldLabel}>Payment date</label><DateField required value={paidOn} onChange={setPaidOn}/></div>
          <div>
            <label style={fieldLabel}>Payment evidence</label>
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
function PaymentVerificationModal({inst, onClose}){
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
          <PayDetail label="Amount">{fmtMoney(inst.amount)}</PayDetail>
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

/* One set of payment terms, laid straight into the tab: its title and totals, then the
   installments table across the full width — Installment, Percentage, Amount, Status,
   Tentative, Due date, Actions — each on one line, with its payments below it. Narrower than its columns,
   the table scrolls sideways and Actions stays in view. */
const SCHEDULE_COLS = 'minmax(220px, 2fr) minmax(96px, 1fr) minmax(112px, 1fr) minmax(124px, 1fr) minmax(140px, 1fr) minmax(120px, 1fr) 150px';
const SCHEDULE_MIN_W = 962;
// `canEdit`: edit the terms and record payments (Payment Terms → Edit).
// `archived`: a record's extra structure saved before one-per-record — shown read-only.
function PaymentScheduleCard({schedule, canEdit, canPay, quote, pullable, archived, onPay, onView, onEdit, onAdd, onOpenQuote}){
  const t = scheduleTotals(schedule);
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
      <div style={{fontSize:14, fontWeight:600, color: tone || T.attioText, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap', marginTop:1}}>{fmtMoney(value)}</div>
    </div>
  );
  return (
    <div style={{borderBottom:`1px solid ${T.border}`, paddingBottom:8}}>
      <div style={{padding:'16px 24px 14px', display:'flex', flexDirection:'column', gap:12}}>
        <div style={{display:'flex', alignItems:'flex-start', gap:8}}>
          <div style={{flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:2}}>
            <div style={{display:'flex', alignItems:'center', gap:8, minWidth:0}}>
              <span style={{fontSize:14, fontWeight:600, color:T.attioText, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{schedule.source === 'manual' ? schedule.title : schedule.quoteTitle}</span>
              {/* Imported: links to the quotation it came from (gone if it was deleted). */}
              {schedule.source !== 'manual' && <>
                <button type="button" disabled={!quote} onClick={()=>quote && onOpenQuote(quote)} title={quote ? quote.number : undefined}
                  style={{display:'inline-flex', alignItems:'center', gap:5, border:'none', fontFamily:'inherit', fontSize:11.5, fontWeight:500, padding:'2px 8px', borderRadius:9999,
                    background:T.blueLight, color:T.blue, whiteSpace:'nowrap', cursor: quote ? 'pointer' : 'default'}}>
                  <Icon name="quote" size={11} color={T.blue}/>
                  <span style={quote ? {textDecorationLine:'underline', textUnderlineOffset:2} : undefined}>Imported from Quotation</span></button>
                {!quote && <span style={{fontSize:12, color:T.attioMuted, whiteSpace:'nowrap'}}>Quote deleted</span>}
              </>}
            </div>
            <span style={{fontSize:12, color:T.attioMuted}}>Created {fmtQuoteDate(schedule.createdAt)} by {schedule.createdBy}</span>
          </div>
          {/* Edit, Add installment and Pull from quote: until the first payment is recorded — payments
              are never removed. Archived terms (`archived`) have none. */}
          {canEdit && !archived && (
            <RowActionsMenu title="Payment terms actions" items={[
              {label:'Edit Payment Terms', disabled:hasPayments(schedule), onClick:onEdit},
              {label:'Add installment', disabled:hasPayments(schedule), onClick:onAdd},
              ...(pullable && pullable.length ? [{label:'Pull from quote', disabled:hasPayments(schedule), onClick:onEdit}] : [])]}/>
          )}
        </div>
        <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          {summary('Total', t.total)}{summary('Received', t.received, '#027A48')}{summary('Outstanding', t.outstanding, t.outstanding > 0 ? '#B54708' : null)}
        </div>
      </div>
      <div style={{overflowX:'auto'}}>
        <div style={{minWidth:SCHEDULE_MIN_W}}>
          <div style={{display:'grid', gridTemplateColumns:SCHEDULE_COLS, background:T.headerBg, borderTop:`1px solid ${T.attioLine}`, borderBottom:`1px solid ${T.attioLine}`}}>
            <span style={{...head, paddingLeft:24}}>Installment</span><span style={{...head, justifyContent:'flex-end'}}>Percentage</span><span style={{...head, justifyContent:'flex-end'}}>Amount</span>
            <span style={head}>Status</span><span style={head}>Tentative</span><span style={head}>Due date</span><span style={{...head, ...actionsCol, background:T.headerBg}}>Actions</span>
          </div>
          {!schedule.installments.length && <div style={{padding:'14px 24px', fontSize:13, color:T.attioMuted}}>No installments.</div>}
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
                  <span style={num}>{r2(inst.percent)}%</span>
                  <span style={num}>{fmtMoney(inst.amount)}</span>
                  {/* Its invoice (`invoicedAt`: when the installment was invoiced), on hover. */}
                  <span style={{...cell, gap:6}} title={inst.invoicedAt ? `Invoiced ${fmtQuoteDate(inst.invoicedAt)}` : 'Not invoiced yet'}><PaymentStatusPill status={st.status}/>
                    {/* A workflow violation about this installment (e.g. it must be paid by now). */}
                    {!archived && <ViolationMark inst={inst.id}/>}</span>
                  <span style={cell}><span style={clip} title={inst.tentative || undefined}>{inst.tentative || '—'}</span></span>
                  <span style={{...cell, fontVariantNumeric:'tabular-nums'}}><span style={clip}>{fmtQuoteDate(inst.dueDate) || '—'}</span></span>
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
      </div>
    </div>
  );
}

/* ── The record's Accounting tab ── its one Payment Terms (primaryTermsOf); any archived ones
   under it, read-only. */
function AccountingTab({object, record}){
  const hub = useRecordHub();
  const [paying, setPaying] = React.useState(null);   // {scheduleId, instId}
  const [viewing, setViewing] = React.useState(null); // {scheduleId, instId}: View payment
  const [editing, setEditing] = React.useState(null); // {id, add?}: the Edit Payment Terms panel
  const [showArchived, setShowArchived] = React.useState(false);
  const [quoteOpen, setQuoteOpen] = React.useState(null); // the quotation opened from "Imported from Quotation"
  // Payment Terms permissions (Records → <Object> → Accounting), by the record's owner.
  const can = (action) => paymentTermsCan(action, object, record);
  const canEdit = can('edit');
  const stored = (hub.accounting || []).filter(s => s.object === object && String(s.recordId) === String(record.id));
  const quotes = recordQuotes(hub, object, record);
  // Quotes sent to the record whose terms haven't been pulled yet.
  const pullable = quotes.filter(q => ['sent', 'signed'].includes(q.status) && !(hub.accounting || []).some(s => s.quoteId === q.id));
  const all = stored;
  const primary = primaryTermsOf(stored), archivedList = stored.filter(s => s !== primary);
  // Pull from quote fills the one structure (same id) — only while nothing is paid; once per quote.
  const pull = (q) => {
    if(!primary || hasPayments(primary) || (hub.accounting || []).some(s => s.quoteId === q.id)) return;
    hub.setAccounting(list => list.some(s => s.quoteId === q.id) ? list
      : list.map(s => s.id === primary.id ? {...scheduleFromQuote(q, object, record), id:primary.id, createdAt:primary.createdAt, createdBy:primary.createdBy} : s));
    setEditing(null);
    hub.toast(`Payment terms pulled from ${q.number}`);
  };
  // Recording a payment: the structure (a quote's, as it stands) is saved with the payment.
  const savePayment = (scheduleId, instId, v) => {
    const base = all.find(s => s.id === scheduleId); if(!base) return;
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
    hub.toast(v.status === 'paid' ? 'Installment marked as paid' : 'Partial payment recorded');
  };
  // Saving the terms: they become the record's own (a quote's terms edited here are no longer the quote's).
  const saveManual = (def) => {
    const id = editing && editing.id;
    hub.setAccounting(list => list.map(s => s.id === id && !hasPayments(s)
      ? {id:s.id, source:'manual', object:s.object, recordId:s.recordId, createdAt:s.createdAt, createdBy:s.createdBy, ...def, installments:manualInstallments(def)} : s));
    setEditing(null);
    hub.toast('Payment terms saved');
  };
  const payingSchedule = paying && all.find(s => s.id === paying.scheduleId);
  const payingInst = payingSchedule && payingSchedule.installments.find(x => x.id === paying.instId);
  const viewingSchedule = viewing && all.find(s => s.id === viewing.scheduleId);
  const viewingInst = viewingSchedule && viewingSchedule.installments.find(x => x.id === viewing.instId);
  const openedQuote = quoteOpen && quotes.find(q => q.id === quoteOpen);
  const editingSchedule = editing && all.find(s => s.id === editing.id);
  const editingDef = editingSchedule ? {title:editingSchedule.source === 'manual' ? editingSchedule.title : editingSchedule.quoteTitle, total:scheduleTotals(editingSchedule).total,
    startDate:editingSchedule.startDate || ymdOf(new Date()), terms:termsOfSchedule(editingSchedule)} : null;
  const card = (s, archived) => {
    const quote = s.source !== 'manual' ? quotes.find(q => q.id === s.quoteId) || null : null;
    return <PaymentScheduleCard key={s.id} schedule={s} quote={quote} archived={archived} canEdit={canEdit} pullable={pullable}
      canPay={s.source === 'manual' || hasPayments(s) || (quote && quote.status === 'signed')}
      onPay={(inst)=>setPaying({scheduleId:s.id, instId:inst.id})} onView={(inst)=>setViewing({scheduleId:s.id, instId:inst.id})}
      onEdit={()=>setEditing({id:s.id})} onAdd={()=>setEditing({id:s.id, add:true})} onOpenQuote={(q)=>setQuoteOpen(q.id)}/>;
  };
  if(!can('view')) return <div style={{flex:1, padding:'48px 24px', textAlign:'center', fontSize:13, color:T.gray400}}>You don't have access to this record's payment terms.</div>;
  return (
    <div style={{flex:1, minHeight:0, minWidth:0, display:'flex', flexDirection:'column', position:'relative'}}>
      <div style={{display:'flex', alignItems:'center', gap:10, padding:'12px 20px', borderBottom:`1px solid ${T.border}`, flexShrink:0}}>
        <span style={{fontSize:13, fontWeight:600, color:T.attioText}}>Payment Terms</span>
      </div>
      <div style={{flex:1, minHeight:0, overflowY:'auto', paddingBottom:32, display:'flex', flexDirection:'column'}}>
        {primary && card(primary, false)}
        {!primary && <div style={{padding:'40px 0', textAlign:'center', fontSize:13, color:T.attioMuted}}>No payment terms yet.</div>}
        {/* Archived: extra structures saved before one-per-record — read-only. */}
        {archivedList.length > 0 && <>
          <button type="button" onClick={()=>setShowArchived(v => !v)} style={{...formTextAction, alignSelf:'flex-start', margin:'14px 24px 6px', display:'inline-flex', alignItems:'center', gap:6}}>
            <Icon name="chevDown" size={11} color={T.gray600} style={{transform: showArchived ? 'none' : 'rotate(-90deg)'}}/>
            Archived payment terms ({archivedList.length})
          </button>
          {showArchived && archivedList.map(s => card(s, true))}
        </>}
      </div>
      {payingInst && <PaymentModal schedule={payingSchedule} inst={payingInst} onCancel={()=>setPaying(null)} onSave={(v)=>savePayment(payingSchedule.id, payingInst.id, v)}/>}
      {viewingInst && <PaymentVerificationModal inst={viewingInst} onClose={()=>setViewing(null)}/>}
      {editing && editingDef && <PaymentStructurePanel key={`${editing.id}-${editing.add ? 'add' : 'edit'}`} initial={editingDef} addRow={!!editing.add}
        onCancel={()=>setEditing(null)} onSave={saveManual} pullable={pullable} onPull={pull}/>}
      {/* The quotation, as on Tools → Quotes. */}
      {openedQuote && <PageSidePanel width={560} title={`${openedQuote.number} · ${openedQuote.title}`} subtitle={`${QUOTE_STATUS[openedQuote.status].label} · ${fmtMoney(quoteTotal(openedQuote))}`}
        onClose={()=>setQuoteOpen(null)}>
        <div style={{flex:1, overflowY:'auto', padding:'4px 20px 24px'}}><QuoteDocument quote={openedQuote}/></div>
      </PageSidePanel>}
    </div>
  );
}

Object.assign(window, {primaryTermsOf, hasPayments, defaultPaymentTerms, packPaymentTerms, unpackPaymentTerms, AccountingTab, ACCOUNTING_RECORD_TYPES, installmentState, scheduleTotals});
