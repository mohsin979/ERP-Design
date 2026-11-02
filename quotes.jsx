/* HOF Pulse ERP — Quotes: sales quotations for a Contact, Deal or Customer.

   A quotation is a workspace record of its own (App: `quotes`), linked to the record it's for.
   Building one is six steps (QuoteBuilder):
     1. Basics — the record (when not started from one), the recipient's name and email, the
        quote's title, a description (rich text) and how long it's valid;
     2. Services — a saved quote template, or services added one by one from the catalog (Tools →
        Services): each with its name, description and milestones (name, description, price —
        the price editable for this quote); the services subtotal;
     3. Payment Terms — installments (a description and a share of the total), then the discount
        on the services subtotal (a percentage or an AED amount) and 5% VAT on the discounted
        subtotal, down to the total;
     4. Terms & Conditions — rich text;
     5. E-Signature — Require e-signature adds a signature section for the customer;
     6. Branding — the quotation as the customer sees it, in the workspace's brand (Marketing →
        Brand); Save as template, Save as draft, Send.
   A quote keeps its own copy of each service as quoted. Sending marks it Sent and puts the
   quote and its email on the record's activity. Nothing is really emailed or signed (the
   prototype has no mailbox and no signing service).

   Quote templates (Settings → Templates → Quote Templates, each with a code) hold a configured
   quote's services and milestones, payment terms, discount and VAT, and terms; picking one on
   the Services step fills those in.

   Shown on the record's Quotes tab (RecordQuotesTab) and on Tools → Quotes (QuotesPage), both
   with the same quotation view (QuoteDocument). */

const QUOTE_STATUS = {draft:{label:'Draft', tone:'neutral'}, sent:{label:'Sent', tone:'info'}, signed:{label:'Signed', tone:'success'}};
const QUOTE_VAT_RATE = 5;   // the default VAT (%), on the discounted subtotal
const qid = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
// A service's total in a quote: its milestones' prices (a quote saved before them: its price).
const quoteItemTotal = (it) => (it.milestones || []).some(m => m.price != null && m.price !== '')
  ? it.milestones.reduce((s, m) => s + (Number(m.price) || 0), 0) : Number(it.price) || 0;
/* The quote's money, top to bottom: services subtotal − discount = discounted subtotal; + VAT =
   total. A quote saved before VAT had none. */
function quoteTotals(q){
  const subtotal = round2((q.items || []).reduce((s, it) => s + quoteItemTotal(it), 0));
  const d = q.discount || {type:'percent', value:0}, dv = Math.max(0, Number(d.value) || 0);
  const discount = round2(d.type === 'amount' ? Math.min(dv, subtotal) : subtotal * Math.min(dv, 100) / 100);
  const discounted = round2(subtotal - discount);
  const vatRate = q.vatRate == null ? 0 : Number(q.vatRate) || 0;
  const vat = round2(discounted * vatRate / 100);
  return {subtotal, discount, discounted, vatRate, vat, total:round2(discounted + vat)};
}
const quoteTotal = (q) => quoteTotals(q).total;
const installmentAmount = (q, inst) => round2(quoteTotal(q) * (Number(inst.percent) || 0) / 100);
/* An installment's tentative payment: days after the quote is sent (`{type:'days', days}`, "Day 0"),
   a calendar date (`{type:'date', date:'YYYY-MM-DD'}`), or a delivery milestone — due when that
   share of the work is delivered (`{type:'delivery', at:20}`, "At 20% delivery"). */
const fmtTentative = (due) => !due ? '' : due.type === 'date' ? fmtQuoteDate(due.date)
  : due.type === 'delivery' ? (due.at === '' || due.at == null ? '' : `At ${Number(due.at)}% delivery`)
  : due.days === '' || due.days == null ? '' : `Day ${Number(due.days)}`;
const tentativeOk = (due) => !!due && (due.type === 'date' ? /^\d{4}-\d{2}-\d{2}$/.test(due.date || '')
  : due.type === 'delivery' ? due.at !== '' && due.at != null && Number(due.at) > 0 && Number(due.at) <= 100
  : due.days !== '' && due.days != null && Number.isInteger(Number(due.days)) && Number(due.days) >= 0);
// The real date: a Day N counts from the quote's sent date; a delivery milestone has none.
const tentativeDate = (due, sentAt) => !due || due.type === 'delivery' ? '' : due.type === 'date' ? due.date : sentAt ? ymdOf(new Date(new Date(sentAt).getTime() + (Number(due.days) || 0) * 86400000)) : '';
const normalizeDue = (due) => !due ? due : due.type === 'days' ? {type:'days', days:Number(due.days)} : due.type === 'delivery' ? {type:'delivery', at:Number(due.at)} : due;
const DUE_DAY0 = () => ({type:'days', days:0});
const quoteNumber = (quotes) => {
  const year = new Date().getFullYear();
  const n = (quotes || []).reduce((mx, q) => { const m = /-(\d+)$/.exec(q.number || ''); return m ? Math.max(mx, Number(m[1])) : mx; }, 0) + 1;
  return `Q-${year}-${String(n).padStart(3, '0')}`;
};
const fmtQuoteDate = (v) => { if(!v) return ''; const d = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : new Date(v); return d.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}); };
// A service as quoted: its name, description and milestones with their prices.
const quoteItemOf = (s) => { const svc = withMilestonePrices(s);
  return {id:qid('qi'), serviceId:s.id, name:s.name, description:s.description || '', milestones:(svc.milestones || []).map(m => ({...m, id:qid('qm'), price:Number(m.price) || 0}))}; };
// A quote saved before milestone prices: its service price on the first milestone.
const withItemMilestonePrices = (it) => (it.milestones || []).some(m => m.price != null) || !(it.milestones || []).length ? it
  : {...it, milestones:it.milestones.map((m, i) => ({...m, price: i === 0 ? Number(it.price) || 0 : 0}))};
const copyItems = (items) => (items || []).map(it => ({...withItemMilestonePrices(it), id:qid('qi'), milestones:(withItemMilestonePrices(it).milestones || []).map(m => ({...m, id:qid('qm')}))}));

/* ── Quote templates (Settings → Templates → Quote Templates) ── */
const SAMPLE_QUOTE_TERMS = '<ol><li>Fees are payable as set out in the payment terms; work on each stage starts once its installment is received.</li><li>Government, translation and courier fees are not included and are charged at cost.</li><li>Fees for work already performed are non-refundable.</li></ol>';
const SAMPLE_QUOTE_TEMPLATES = () => {
  const svc = SAMPLE_SERVICES();
  const item = (id) => quoteItemOf(svc.find(s => s.id === id));
  return [{id:'qt-1', code:'QT-001', name:'US NIW Standard', items:[item('svc-1')],
    installments:[{id:'qi-a', description:'On signing the agreement', percent:40, due:{type:'days', days:0}}, {id:'qi-b', description:'On petition filing', percent:40, due:{type:'days', days:60}}, {id:'qi-c', description:'On the USCIS decision', percent:20, due:{type:'days', days:180}}],
    discount:{type:'percent', value:0}, vatRate:QUOTE_VAT_RATE, terms:SAMPLE_QUOTE_TERMS, createdBy:'Waleed bin Zaman', createdAt:new Date(2026, 8, 1, 10, 0)}];
};
const quoteTemplatesOf = (data) => data.quoteTemplates || (SEED ? SAMPLE_QUOTE_TEMPLATES() : []);
const nextTemplateCode = (list) => `QT-${String((list || []).reduce((mx, t) => { const m = /(\d+)$/.exec(t.code || ''); return m ? Math.max(mx, Number(m[1])) : mx; }, 0) + 1).padStart(3, '0')}`;

/* Sample quotations for the sample records: drafts and sent quotes on a contact, deals and a customer. */
const SAMPLE_QUOTES = (services) => {
  const svc = (id) => quoteItemOf(services.find(s => s.id === id));
  const contactId = (name) => (SAMPLE_CONTACTS.find(c => c.name === name) || {}).id;
  const person = (name) => { const c = SAMPLE_CONTACTS.find(x => x.name === name) || {}; return {name, email:c.email || ''}; };
  const thirds = [{id:'in-1', description:'On signing the agreement', percent:40, due:{type:'days', days:0}}, {id:'in-2', description:'On filing', percent:40, due:{type:'days', days:60}}, {id:'in-3', description:'On the decision', percent:20, due:{type:'days', days:180}}];
  const base = {discount:{type:'percent', value:0}, vatRate:QUOTE_VAT_RATE, terms:SAMPLE_QUOTE_TERMS};
  return [
    {...base, id:'q-1', number:'Q-2026-001', title:'US NIW Petition', object:'deals', recordId:'deal-3', recipient:person('Ahmed Raza'), items:[svc('svc-1')], installments:thirds, eSignature:true,
      validUntil:'2026-11-06', description:'', status:'sent', createdAt:new Date(2026, 8, 7, 11, 20), sentAt:new Date(2026, 8, 7, 11, 40), createdBy:'Asim Ali'},
    {...base, id:'q-2', number:'Q-2026-002', title:'Canada Express Entry with spouse', object:'customers', recordId:'cust-4', recipient:person('Ali Raza Shah'), items:[svc('svc-2'), svc('svc-4')],
      installments:[{id:'in-4', description:'On signing the agreement', percent:50, due:{type:'days', days:0}}, {id:'in-5', description:'On the ITA', percent:50, due:{type:'date', date:'2026-12-15'}}], discount:{type:'amount', value:2500}, eSignature:true,
      validUntil:'2026-10-26', description:'', status:'sent', createdAt:new Date(2026, 8, 26, 15, 5), sentAt:new Date(2026, 8, 26, 15, 30), createdBy:'Asim Ali'},
    {...base, id:'q-3', number:'Q-2026-003', title:'US NIW Petition and RFE cover', object:'deals', recordId:'deal-6', recipient:person('Zainab Hussain'), items:[svc('svc-1'), svc('svc-5')], installments:thirds,
      validUntil:'2026-11-12', description:'<p>The <b>RFE Response</b> applies only if USCIS issues a Request for Evidence.</p>', status:'draft', createdAt:new Date(2026, 9, 12, 10, 0), createdBy:'Hamza Siddiqui'},
    {...base, id:'q-4', number:'Q-2026-004', title:'Australia Skilled Migration', object:'contacts', recordId:contactId('Sara Malik'), recipient:person('Sara Malik'), items:[svc('svc-3'), svc('svc-6')],
      installments:[], discount:{type:'percent', value:10}, validUntil:'2026-11-14', description:'', status:'draft', createdAt:new Date(2026, 9, 14, 16, 45), createdBy:'Ali Noor'},
  ].filter(q => q.recordId != null);
};

function QuoteStatusPill({status}){ return <StatusPill status={status} map={QUOTE_STATUS}/>; }

/* The quotation as the customer sees it — in the workspace's brand (logo, primary and secondary
   colours from Marketing → Brand): who it's for, the services and their milestones, the money
   (subtotal, discount, VAT, total), the payment terms, the terms and conditions, and — when an
   e-signature is required — the customer's signature section. */
function QuoteDocument({quote}){
  const hub = useRecordHub();
  const brand = workspaceBrand();
  const record = hubRecord(hub, quote.object, quote.recordId);
  const t = quoteTotals(quote);
  const muted = {fontSize:12, color:T.attioMuted};
  const section = {fontSize:11, fontWeight:700, letterSpacing:.6, textTransform:'uppercase', color:brand.colors.secondary, marginBottom:10};
  const money = {fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap'};
  const sumRow = (label, value, strong) => (
    <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:12, padding:'5px 0', fontSize: strong ? 15 : 13, fontWeight: strong ? 700 : 400, color:T.attioText}}>
      <span>{label}</span><span style={money}>{value}</span>
    </div>
  );
  const installments = quote.installments || [];
  return (
    <div style={{border:`1px solid ${T.border}`, borderRadius:12, overflow:'hidden', background:'#fff'}}>
      <div style={{height:4, background:brand.colors.primary}}/>
      <div style={{padding:'22px 24px', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, borderBottom:`1px solid ${T.attioLine}`, flexWrap:'wrap'}}>
        <div style={{display:'flex', alignItems:'center', gap:10, minWidth:0}}><WorkspaceLockup ws={brand}/></div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:11, fontWeight:600, letterSpacing:.6, textTransform:'uppercase', color:brand.colors.secondary}}>Quotation</div>
          <div style={{fontSize:15, fontWeight:600, color:T.attioText, fontVariantNumeric:'tabular-nums'}}>{quote.number}</div>
        </div>
      </div>
      <div style={{padding:'18px 24px', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:16, borderBottom:`1px solid ${T.attioLine}`}}>
        <div><div style={muted}>Prepared for</div><div style={{fontSize:13.5, fontWeight:500, color:T.attioText}}>{quote.recipient.name || '—'}</div>
          <div style={{fontSize:12.5, color:T.attioMuted, overflowWrap:'anywhere'}}>{quote.recipient.email}</div></div>
        <div><div style={muted}>{HUB_NOUN[quote.object]}</div><div style={{fontSize:13.5, color:T.attioText}}>{record ? record.name : '—'}</div></div>
        <div><div style={muted}>Date</div><div style={{fontSize:13.5, color:T.attioText}}>{fmtQuoteDate(quote.sentAt || quote.createdAt)}</div></div>
        <div><div style={muted}>Valid until</div><div style={{fontSize:13.5, color:T.attioText}}>{fmtQuoteDate(quote.validUntil) || '—'}</div></div>
      </div>
      <div style={{padding:'20px 24px', display:'flex', flexDirection:'column', gap:22}}>
        <div>
          <div style={{fontSize:17, fontWeight:600, color:T.attioText}}>{quote.title}</div>
          <RichTextView html={quote.description} style={{fontSize:13, color:T.attioMuted, marginTop:6}}/>
          {quote.notes && <div style={{marginTop:6, fontSize:12.5, color:T.attioMuted, lineHeight:1.55, whiteSpace:'pre-line'}}>{quote.notes}</div>}
        </div>

        {/* Services — name, description, then each milestone: name, description, price. */}
        <div>
          <div style={section}>Services</div>
          {(quote.items || []).map(raw => { const it = withItemMilestonePrices(raw); return (
            <div key={it.id} style={{borderTop:`1px solid ${T.attioLine}`, padding:'14px 0', display:'flex', flexDirection:'column', gap:10}}>
              <div>
                <div style={{fontSize:14, fontWeight:600, color:T.attioText}}>{it.name}</div>
                <RichTextView html={it.description} style={{fontSize:12.5, color:T.attioMuted, marginTop:4}}/>
              </div>
              {(it.milestones || []).map((m, i) => (
                <div key={m.id || i} style={{display:'flex', gap:12, alignItems:'baseline', paddingLeft:12, borderLeft:`2px solid ${T.attioLine}`}}>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:13, fontWeight:500, color:T.attioText}}>{m.name}</div>
                    {m.description && <div style={{fontSize:12.5, color:T.attioMuted, lineHeight:1.5}}>{m.description}</div>}
                  </div>
                  <span style={{...money, fontSize:13, color:T.attioText}}>{fmtMoney(m.price)}</span>
                </div>
              ))}
            </div>
          ); })}
          {!(quote.items || []).length && <div style={{fontSize:13, color:T.attioMuted, padding:'12px 0'}}>No services yet.</div>}
        </div>

        {/* The money: subtotal, discount, discounted subtotal, VAT, total. */}
        <div style={{marginLeft:'auto', width:'100%', maxWidth:340}}>
          {sumRow('Services subtotal', fmtMoney(t.subtotal))}
          {t.discount > 0 && <>
            {sumRow(`Discount${quote.discount && quote.discount.type === 'percent' ? ` (${Number(quote.discount.value)}%)` : ''}`, `− ${fmtMoney(t.discount)}`)}
            {sumRow('Discounted subtotal', fmtMoney(t.discounted))}
          </>}
          {quote.vatRate != null && sumRow(`VAT (${t.vatRate}%)`, fmtMoney(t.vat))}
          <div style={{borderTop:`2px solid ${brand.colors.primary}`, marginTop:6, paddingTop:6}}>{sumRow('Total', fmtMoney(t.total), true)}</div>
        </div>

        {installments.length > 0 && (
          <div>
            <div style={section}>Payment terms</div>
            <div style={{display:'flex', gap:12, padding:'0 0 6px', fontSize:11.5, color:T.attioMuted}}>
              <span style={{width:22}}/><span style={{flex:1}}>Installment</span><span style={{width:52, textAlign:'right'}}>Percentage</span>
              <span style={{width:110, textAlign:'right'}}>Tentative date</span><span style={{width:120, textAlign:'right'}}>Amount</span>
            </div>
            {installments.map((inst, i) => (
              <div key={inst.id || i} style={{display:'flex', gap:12, alignItems:'baseline', padding:'7px 0', borderTop:`1px solid ${T.attioLine}`, fontSize:13, color:T.attioText}}>
                <span style={{width:22, color:T.attioMuted, fontVariantNumeric:'tabular-nums'}}>{i + 1}.</span>
                <span style={{flex:1, minWidth:0}}>{inst.description}</span>
                <span style={{...money, color:T.attioMuted, width:52, textAlign:'right'}}>{Number(inst.percent) || 0}%</span>
                <span style={{...money, color:T.attioMuted, width:110, textAlign:'right'}}>{fmtTentative(inst.due) || '—'}</span>
                <span style={{...money, width:120, textAlign:'right'}}>{fmtMoney(installmentAmount(quote, inst))}</span>
              </div>
            ))}
          </div>
        )}

        {!richIsEmpty(richHtmlOf(quote.terms)) && (
          <div>
            <div style={section}>Terms & conditions</div>
            <RichTextView html={quote.terms} style={{fontSize:12.5}}/>
          </div>
        )}

        {/* E-signature: the customer signs here. */}
        {quote.eSignature && <QuoteSignaturePreview name={quote.recipient.name}/>}
      </div>
    </div>
  );
}

/* Sending a quote: Sent, and the quote and its email on the record's activity. */
function sendQuoteVia(hub, q){
  const sentAt = new Date();
  const t = quoteTotals(q);
  hub.setQuotes(qs => qs.map(x => x.id === q.id ? {...x, status:'sent', sentAt} : x));
  hub.add(q.object, q.recordId, {type:'quote', status:'sent', title:`${q.number} · ${q.title}`, quoteId:q.id, total:t.total, source:'you', by:null});
  hub.add(q.object, q.recordId, {type:'email', direction:'sent', status:'sent', to:[q.recipient.email].filter(Boolean), source:'you', by:null, quoteId:q.id,
    title:`Quotation ${q.number}: ${q.title}`,
    body:`Hi ${emailFirstName(q.recipient.name) || 'there'},\n\nPlease find your quotation ${q.number} for ${q.title} below.\n\n`
      + (q.items || []).map(it => `${it.name} — ${fmtMoney(quoteItemTotal(it))}`).join('\n')
      + `\n\nSubtotal: ${fmtMoney(t.subtotal)}` + (t.discount ? `\nDiscount: − ${fmtMoney(t.discount)}` : '') + (q.vatRate != null ? `\nVAT (${t.vatRate}%): ${fmtMoney(t.vat)}` : '')
      + `\nTotal: ${fmtMoney(t.total)}` + (q.validUntil ? `\nValid until ${fmtQuoteDate(q.validUntil)}.` : '')
      + ((q.installments || []).length ? `\n\nPayment terms:\n` + q.installments.map((x, i) => `${i + 1}. ${x.description} — ${x.percent}% — ${fmtMoney(installmentAmount(q, x))}${fmtTentative(x.due) ? ` — ${fmtTentative(x.due)}` : ''}`).join('\n') : '')
      + (q.eSignature ? `\n\nPlease review and sign the quotation.` : '') + `\n\nKind regards,\n${CURRENT_USER.name}`});
  hub.toast(`Quote ${q.number} sent`);
}

/* ── The builder (new, or editing a draft) ── the creation side panel (CreatePanelFrame), wider
   for its six steps, which run down their own column on the left; the step's content on the
   right — on Basics, under Record Type and the record when it isn't known (Tools → Quotes). */
const QUOTE_STEPS = ['Basics', 'Services', 'Payment Terms', 'Terms & Conditions', 'E-Signature', 'Branding'];
const QUOTE_STEPPER_W = 200, QUOTE_PANEL_W = 1160;
/* `mode` 'new' (`object` / `id`: the record it's for, when started from one) or 'edit' (`id`: the
   quote). Always full height at the CRM's right edge (placement 'fixed'), wherever it's opened.
   `onClose(saved)`: the saved quote, or nothing (cancelled). */
function QuoteBuilder({mode, id, object, onClose, placement = 'fixed'}){
  const hub = useRecordHub();
  const existing = mode === 'edit' ? hub.quotes.find(q => q.id === id) : null;
  const recordId0 = mode === 'new' && object && id != null ? id : null;
  const [step, setStep] = React.useState(0);
  const [target, setTarget] = React.useState(() => existing ? {object:existing.object, id:existing.recordId} : {object:object || 'contacts', id:recordId0});
  const fixedRecord = !!existing || (mode === 'new' && object && recordId0 != null);
  const person0 = target.id != null ? hubRecordPerson(hub, target.object, target.id) : null;
  const [q, setQ] = React.useState(() => existing ? {...JSON.parse(JSON.stringify(existing)), description:existing.description || richHtmlOf(existing.notes || ''), notes:undefined,
      items:(existing.items || []).map(withItemMilestonePrices), installments:(existing.installments || []).map((x, i) => ({...x, due:x.due || (i === 0 ? DUE_DAY0() : {type:'days', days:''})})), discount:existing.discount || {type:'percent', value:''},
      vatRate:existing.vatRate ?? QUOTE_VAT_RATE, terms:existing.terms || '', eSignature:!!existing.eSignature} : {
    title:'', recipient:{name:(person0 && person0.name) || '', email:(person0 && person0.email) || ''}, description:'', items:[], installments:[],
    discount:{type:'percent', value:''}, vatRate:QUOTE_VAT_RATE, terms:'', eSignature:false, templateId:null,
    validUntil:ymdOf(new Date(Date.now() + 30 * 86400000))});
  const set = (p) => setQ(x => ({...x, ...p}));
  // A record picked here fills in its person.
  React.useEffect(() => { if(fixedRecord) return; const p = target.id != null ? hubRecordPerson(hub, target.object, target.id) : null; set({recipient:{name:(p && p.name) || '', email:(p && p.email) || ''}}); }, [target.object, target.id]);
  const [pick, setPick] = React.useState('');
  const [expanded, setExpanded] = React.useState(false);   // Branding: the quotation in a larger modal
  const [templating, setTemplating] = React.useState(null); // Save as template: its name
  const templates = quoteTemplatesOf(hub.data);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((q.recipient.email || '').trim());
  const priceOk = (v) => v !== '' && v != null && Number.isFinite(Number(v)) && Number(v) >= 0;
  const totals = quoteTotals({...q, items:q.items});
  const instSum = q.installments.reduce((s, x) => s + (Number(x.percent) || 0), 0);
  const discountOk = q.discount.value === '' || (Number(q.discount.value) >= 0 && (q.discount.type === 'amount' ? Number(q.discount.value) <= totals.subtotal : Number(q.discount.value) <= 100));
  const installmentsOk = !q.installments.length || (q.installments.every(x => x.description.trim() && Number(x.percent) > 0 && tentativeOk(x.due)) && Math.abs(instSum - 100) < 0.001);
  const stepOk = [target.id != null && !!q.recipient.name.trim() && validEmail, q.items.length > 0 && q.items.every(it => it.milestones.every(m => priceOk(m.price))),
    discountOk && installmentsOk, true, true, true];
  const draft = () => ({...q, title:q.title.trim() || (q.items[0] && q.items[0].name) || 'Quotation', recipient:{name:q.recipient.name.trim(), email:q.recipient.email.trim()},
    items:q.items.map(it => ({...it, milestones:it.milestones.map(m => ({...m, price:Number(m.price)}))})),
    installments:q.installments.map(x => ({...x, description:x.description.trim(), percent:Number(x.percent), due:normalizeDue(x.due)})),
    discount:{type:q.discount.type, value:Number(q.discount.value) || 0}, object:target.object, recordId:target.id});
  const save = (andSend) => {
    let saved;
    if(existing){ saved = {...existing, ...draft()}; hub.setQuotes(qs => qs.map(x => x.id === existing.id ? saved : x)); }
    else {
      saved = {...draft(), id:`q-${Date.now().toString(36)}`, number:quoteNumber(hub.quotes), status:'draft', createdAt:new Date(), createdBy:CURRENT_USER.name};
      hub.setQuotes(qs => [...qs, saved]);
      hub.add(saved.object, saved.recordId, {type:'quote', status:'draft', title:`${saved.number} · ${saved.title}`, quoteId:saved.id, total:quoteTotal(saved), source:'you', by:null});
    }
    if(andSend) sendQuoteVia(hub, saved); else hub.toast(existing ? 'Quote saved' : `Quote ${saved.number} saved as draft`);
    onClose(saved);
  };
  // A saved template fills in the services and milestones, payment terms, discount and VAT, and terms.
  const useTemplate = (tid) => {
    const t = templates.find(x => x.id === tid); if(!t) return;
    set({templateId:t.id, items:copyItems(t.items), installments:(t.installments || []).map((x, i) => ({...x, id:qid('in'), due:x.due || (i === 0 ? DUE_DAY0() : {type:'days', days:''})})), discount:{type:(t.discount || {}).type || 'percent', value:(t.discount || {}).value || ''},
      vatRate:t.vatRate ?? QUOTE_VAT_RATE, terms:t.terms || '', title:q.title || t.name});
  };
  const saveTemplate = (name) => {
    const d = draft();
    const t = {id:`qt-${Date.now().toString(36)}`, code:nextTemplateCode(templates), name, items:d.items, installments:d.installments, discount:d.discount, vatRate:d.vatRate, terms:d.terms,
      createdBy:CURRENT_USER.name, createdAt:new Date()};
    hub.setData(x => ({...x, quoteTemplates:[...quoteTemplatesOf(x), t]}));
    setTemplating(null); hub.toast(`Template ${t.code} saved`);
  };
  const catalog = hub.services.filter(s => !q.items.some(it => it.serviceId === s.id));
  const label = {fontSize:12.5, color:T.gray600, marginBottom:6, display:'block'};
  const section = {fontSize:11, fontWeight:600, color:T.attioFaint, textTransform:'uppercase', letterSpacing:.4};
  const money = {fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap'};
  const setMilestone = (iid, mid, p) => set({items:q.items.map(it => it.id !== iid ? it : {...it, milestones:it.milestones.map(m => m.id === mid ? {...m, ...p} : m)})});
  const setInst = (iid, p) => set({installments:q.installments.map(x => x.id === iid ? {...x, ...p} : x)});
  const preview = {...draft(), number: existing ? existing.number : quoteNumber(hub.quotes), createdAt: existing ? existing.createdAt : new Date(), status:'draft'};
  const sumRow = (l, v, strong) => <div style={{display:'flex', justifyContent:'space-between', gap:12, padding:'6px 0', fontSize: strong ? 15 : 13, fontWeight: strong ? 700 : 400, color:T.attioText}}><span>{l}</span><span style={money}>{v}</span></div>;
  const brand = workspaceBrand();
  const last = QUOTE_STEPS.length - 1;
  return (
    <CreatePanelFrame title={existing ? `Edit Quote ${existing.number}` : 'New Quote'} onClose={()=>onClose()} placement={placement} width={QUOTE_PANEL_W} flush
      actions={<>
        {step > 0 && <StSecondary label="Back" onClick={()=>setStep(s => s - 1)}/>}
        <StSecondary label="Cancel" onClick={()=>onClose()}/>
        {step < last ? <StCta label="Next" disabled={!stepOk[step]} onClick={()=>setStep(s => s + 1)}/>
          : <><StSecondary label="Save as template" onClick={()=>setTemplating(q.title.trim() || (q.items[0] && q.items[0].name) || '')}/>
              <StSecondary label={existing ? 'Save changes' : 'Save as draft'} onClick={()=>save(false)}/><StCta label="Send quote" onClick={()=>save(true)}/></>}
      </>}>
      {/* The steps, in their own column on the left. */}
      <div style={{width:QUOTE_STEPPER_W, flexShrink:0, borderRight:`1px solid ${T.border}`, padding:'16px 12px', display:'flex', flexDirection:'column', gap:2}}>
        {QUOTE_STEPS.map((st, i) => {
          const reachable = i <= step || stepOk.slice(0, i).every(Boolean);
          return (
            <button key={st} type="button" onClick={()=>{ if(reachable) setStep(i); }}
              style={{display:'flex', alignItems:'center', gap:10, border:'none', borderRadius:8, padding:'8px 10px', textAlign:'left', fontFamily:'inherit',
                background: i === step ? T.headerBg : 'transparent', cursor: reachable ? 'pointer' : 'default',
                fontSize:13, fontWeight: i === step ? 600 : 400, color: i === step ? T.attioText : T.attioMuted}}>
              <span style={{width:20, height:20, borderRadius:9999, fontSize:11, fontWeight:600, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                background: i <= step ? T.black : '#fff', color: i <= step ? '#fff' : T.attioMuted, border: i <= step ? 'none' : `1px solid ${T.borderStrong}`}}>{i + 1}</span>
              {st}
            </button>
          );
        })}
      </div>
      <div style={{flex:1, minWidth:0, display:'flex', flexDirection:'column'}}>
        {!fixedRecord && step === 0 && <div style={{padding:'16px 20px', borderBottom:`1px solid ${T.border}`, flexShrink:0}}><CreateRecordField value={target} onChange={setTarget}/></div>}
        <div style={{flex:1, minHeight:0, overflowY:'auto', padding:20, display:'flex', flexDirection:'column', gap:16}}>

          {/* 1 · Basics */}
          {step === 0 && stack(<>
            <Field label="Recipient name"><input value={q.recipient.name} onChange={e=>set({recipient:{...q.recipient, name:e.target.value}})} style={fieldText}/></Field>
            <Field label="Recipient email"><input value={q.recipient.email} onChange={e=>set({recipient:{...q.recipient, email:e.target.value}})}
              style={{...fieldText, borderColor: q.recipient.email && !validEmail ? T.red : T.borderStrong}}/></Field>
            <Field label="Quote title"><input value={q.title} onChange={e=>set({title:e.target.value})} placeholder="The first service's name, unless you name it" style={fieldText}/></Field>
            <Field label="Description"><RichTextEditor value={q.description} onChange={(v)=>set({description:v})} ariaLabel="Quote description"/></Field>
            <Field label="Valid until"><DateField value={q.validUntil} onChange={(v)=>set({validUntil:v})}/></Field>
          </>)}

          {/* 2 · Services */}
          {step === 1 && <>
            <div style={{display:'grid', gridTemplateColumns:'minmax(0, 1fr) minmax(0, 1fr)', gap:12, alignItems:'end'}}>
              <div style={{minWidth:0}}><label style={label}>Quote template</label>
                <FormSelect value={q.templateId || ''} placeholder={templates.length ? 'Select a quote template' : 'No quote templates yet'}
                  options={templates.map(t => ({value:t.id, label:`${t.code} · ${t.name}`}))} onChange={useTemplate}/></div>
              <div style={{display:'flex', alignItems:'flex-end', gap:8, minWidth:0}}>
                <div style={{flex:1, minWidth:0}}><label style={label}>Add a service</label>
                  <SearchableSelect value={pick} options={catalog.map(s => ({value:s.id, label:`${s.name} · ${fmtMoney(servicePrice(withMilestonePrices(s)), s.currency)}`}))} onChange={setPick}
                    placeholder={hub.services.length ? 'Select a service' : 'No services yet — add them in Tools → Services'} searchPlaceholder="Search services"/></div>
                <StCta label="Add" disabled={!pick} onClick={()=>{ const s = hub.services.find(x => x.id === pick); if(s){ set({items:[...q.items, quoteItemOf(s)], title:q.title || s.name}); setPick(''); } }}/>
              </div>
            </div>
            {q.items.map(it => (
              <div key={it.id} style={{border:`1px solid ${T.attioLine}`, borderRadius:12, padding:16, display:'flex', flexDirection:'column', gap:12}}>
                <div style={{display:'flex', alignItems:'flex-start', gap:10}}>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:14.5, fontWeight:600, color:T.attioText}}>{it.name}</div>
                    <RichTextView html={it.description} style={{fontSize:12.5, color:T.attioMuted, marginTop:4}}/>
                  </div>
                  <button type="button" title="Remove service" onClick={()=>set({items:q.items.filter(x => x.id !== it.id)})} style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:4}}>
                    <Icon name="trash" size={14} color={T.gray600}/></button>
                </div>
                {it.milestones.map((m, i) => (
                  <div key={m.id} style={{display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:8, background:T.headerBg}}>
                    <span style={{width:20, height:20, borderRadius:9999, background:'#fff', border:`1px solid ${T.attioLine}`, fontSize:11, fontWeight:600, color:T.attioText,
                      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontVariantNumeric:'tabular-nums'}}>{i + 1}</span>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:13, fontWeight:500, color:T.attioText}}>{m.name}</div>
                      {m.description && <div style={{fontSize:12.5, color:T.attioMuted, lineHeight:1.45}}>{m.description}</div>}
                    </div>
                    <div style={{width:150, flexShrink:0, position:'relative'}}>
                      <span style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:12, color:T.attioMuted, pointerEvents:'none'}}>{DEAL_CURRENCY}</span>
                      <input value={m.price} onChange={e=>setMilestone(it.id, m.id, {price:e.target.value.replace(/[^0-9.]/g, '')})} inputMode="decimal" aria-label={`${m.name} price`}
                        style={{...fieldText, paddingLeft:44, textAlign:'right', fontVariantNumeric:'tabular-nums', borderColor: priceOk(m.price) ? T.borderStrong : T.red}}/>
                    </div>
                  </div>
                ))}
                <div style={{display:'flex', justifyContent:'flex-end', gap:12, fontSize:12.5, color:T.attioMuted}}>
                  <span>Service total</span><span style={{...money, color:T.attioText, fontWeight:500}}>{fmtMoney(quoteItemTotal(it))}</span>
                </div>
              </div>
            ))}
            {!q.items.length && <div style={{fontSize:13, color:T.attioMuted}}>Add the services this quote is for, or start from a quote template.</div>}
            {q.items.length > 0 && <div style={{borderTop:`1px solid ${T.border}`, paddingTop:8}}>{sumRow('Services subtotal', fmtMoney(totals.subtotal), true)}</div>}
          </>}

          {/* 3 · Payment Terms — installments, then the discount and VAT. */}
          {step === 2 && <>
            <InstallmentsEditor rows={q.installments} onChange={(rows)=>set({installments:rows})} total={totals.total} newId={()=>qid('in')}/>
            <div style={{borderTop:`1px solid ${T.border}`, margin:'4px -20px 0'}}/>
            <span style={section}>Discount & tax</span>
            <div style={{maxWidth:420, width:'100%', alignSelf:'flex-end'}}>
              {sumRow('Services subtotal', fmtMoney(totals.subtotal))}
              <div style={{display:'flex', alignItems:'center', gap:10, padding:'6px 0'}}>
                <span style={{flex:1, fontSize:13, color:T.attioText}}>Discount</span>
                <div role="radiogroup" aria-label="Discount type" style={{display:'inline-flex', border:`1px solid ${T.borderStrong}`, borderRadius:8, overflow:'hidden'}}>
                  {[['percent', '%'], ['amount', DEAL_CURRENCY]].map(([k, l]) => (
                    <button key={k} type="button" role="radio" aria-checked={q.discount.type === k} onClick={()=>set({discount:{...q.discount, type:k}})}
                      style={{border:'none', cursor:'pointer', padding:'5px 10px', fontSize:12.5, fontWeight:500, fontFamily:'inherit', background: q.discount.type === k ? T.black : 'transparent', color: q.discount.type === k ? '#fff' : T.gray600}}>{l}</button>
                  ))}
                </div>
                <input value={q.discount.value} onChange={e=>set({discount:{...q.discount, value:e.target.value.replace(/[^0-9.]/g, '')}})} inputMode="decimal" placeholder="0" aria-label="Discount"
                  style={{...fieldText, width:110, textAlign:'right', fontVariantNumeric:'tabular-nums', borderColor: discountOk ? T.borderStrong : T.red}}/>
              </div>
              {sumRow('Discount amount', `− ${fmtMoney(totals.discount)}`)}
              {sumRow('Discounted subtotal', fmtMoney(totals.discounted))}
              {sumRow(`VAT (${totals.vatRate}% of the discounted subtotal)`, fmtMoney(totals.vat))}
              <div style={{borderTop:`2px solid ${T.attioText}`, marginTop:6, paddingTop:4}}>{sumRow('Total', fmtMoney(totals.total), true)}</div>
            </div>
          </>}

          {/* 4 · Terms & Conditions */}
          {step === 3 && <>
            <span style={section}>Terms & conditions</span>
            <RichTextEditor value={q.terms} onChange={(v)=>set({terms:v})} minHeight={260} ariaLabel="Terms and conditions"/>
          </>}

          {/* 5 · E-Signature */}
          {step === 4 && <>
            <label style={{display:'flex', alignItems:'center', gap:10, fontSize:13.5, color:T.attioText, cursor:'pointer', alignSelf:'flex-start'}}>
              <UtToggle on={q.eSignature} onChange={(v)=>set({eSignature:v})}/> Require e-signature
            </label>
            {q.eSignature && <div style={{opacity:.95}}><QuoteSignaturePreview name={q.recipient.name}/></div>}
          </>}

          {/* 6 · Branding — the quotation in the workspace's brand. */}
          {step === 5 && <>
            <div style={{display:'flex', alignItems:'center', gap:12, padding:'10px 12px', border:`1px solid ${T.attioLine}`, borderRadius:10}}>
              <WorkspaceLockup ws={brand}/>
              <div style={{flex:1}}/>
              {[brand.colors.primary, brand.colors.secondary].map((c, i) => <span key={i} title={i ? 'Secondary colour' : 'Primary colour'} style={{width:18, height:18, borderRadius:9999, background:c, border:`1px solid ${T.attioLine}`}}/>)}
              <button type="button" onClick={()=>setExpanded(true)} style={btnSecondarySm}><Icon name="expand" size={13} color={T.gray600}/> Expand</button>
            </div>
            <QuoteDocument quote={preview}/>
          </>}
        </div>
      </div>
      {expanded && ReactDOM.createPortal(
        <StModal title={`Quote ${preview.number}`} width={880} onCancel={()=>setExpanded(false)}>
          <div style={{maxHeight:'70vh', overflowY:'auto'}}><QuoteDocument quote={preview}/></div>
        </StModal>, document.body)}
      {templating != null && ReactDOM.createPortal(
        <StModal title="Save as template" primary="Save template" canSubmit={!!templating.trim()} onCancel={()=>setTemplating(null)} onSubmit={()=>saveTemplate(templating.trim())}>
          <div><label style={fieldLabel}>Template name</label><input autoFocus value={templating} onChange={e=>setTemplating(e.target.value)} style={fieldInput}/></div>
          <div style={{fontSize:12.5, color:T.attioMuted}}>Code {nextTemplateCode(templates)}</div>
        </StModal>, document.body)}
    </CreatePanelFrame>
  );
}
/* ── Installments editor ── shared by the quote's Payment Terms and Accounting's payment
   structures: each row is the installment's description, its share (percentage and amount in one
   field — editing either recalculates the other from the total), its tentative payment (Days or
   Date) and that payment's value, and a remove. The chip shows the allocated
   percentage against 100%. `rows`: [{id, description, percent, due}]; `total`: the amount the
   percentages are of. */
// The last column takes the rest of the row, so the remove icon sits at its far right.
const INST_COLS = '22px 200px 200px 200px 200px minmax(28px, 1fr)';
/* `label`: what the percentage is of, for screen readers (the installment's share, or the delivery reached). */
function PercentAmountField({percent, total, onPercent, index, label = 'percentage', amountLabel = 'amount'}){
  const [amountText, setAmountText] = React.useState(null);   // while the amount is being typed
  const amount = (Number(total) || 0) * (Number(percent) || 0) / 100;
  const box = {display:'flex', alignItems:'stretch', border:`1px solid ${T.borderStrong}`, borderRadius:8, background:'#fff', overflow:'hidden', height:34};
  const input = {border:'none', outline:'none', fontSize:13, fontFamily:'inherit', color:T.attioText, background:'transparent', textAlign:'right', fontVariantNumeric:'tabular-nums', minWidth:0};
  const unit = {fontSize:12, color:T.attioMuted, display:'flex', alignItems:'center'};
  return (
    <div style={box}>
      <div style={{display:'flex', alignItems:'center', gap:4, padding:'0 10px', flex:'1 1 0', minWidth:0}}>
        <input value={percent} onChange={e=>onPercent(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0" aria-label={`Installment ${index + 1} ${label}`} style={{...input, width:'100%'}}/>
        <span style={unit}>%</span>
      </div>
      <span style={{width:1, background:T.borderStrong, margin:'6px 0'}}/>
      <div style={{display:'flex', alignItems:'center', gap:4, padding:'0 10px', flex:'1 1 0', minWidth:0}}>
        <span style={unit}>{DEAL_CURRENCY}</span>
        {/* The amount needs the total it's a share of; until there's one, it says so. */}
        <input value={amountText != null ? amountText : (Number(total) > 0 ? String(Math.round(amount * 100) / 100) : '')} inputMode="decimal"
          placeholder={Number(total) > 0 ? '0' : 'Set total'} title={Number(total) > 0 ? undefined : 'Enter the total first'} aria-label={`Installment ${index + 1} ${amountLabel}`}
          disabled={!(Number(total) > 0)}
          onFocus={()=>setAmountText(Number(total) > 0 ? String(Math.round(amount * 100) / 100) : '')} onBlur={()=>setAmountText(null)}
          onChange={e=>{ const v = e.target.value.replace(/[^0-9.]/g, ''); setAmountText(v); if(Number(total) > 0) onPercent(v === '' ? '' : String(Math.round(Number(v) / Number(total) * 10000) / 100)); }}
          style={{...input, flex:1, width:'100%'}}/>
      </div>
    </div>
  );
}
// Delivery milestones are not offered for now (they'll come later); one saved before still shows.
const TENTATIVE_TYPES = [['days', 'Days'], ['date', 'Date']];
function TentativeTypeField({value, onChange, index}){
  const v = value || {type:'days', days:''};
  return (
    <div role="radiogroup" aria-label={`Installment ${index + 1} tentative payment`} style={{display:'flex', height:34, border:`1px solid ${T.borderStrong}`, borderRadius:8, overflow:'hidden'}}>
      {TENTATIVE_TYPES.map(([k, l]) => (
        <button key={k} type="button" role="radio" aria-checked={v.type === k}
          onClick={()=>v.type !== k && onChange(k === 'days' ? {type:'days', days:''} : k === 'date' ? {type:'date', date:''} : {type:'delivery', at:''})}
          style={{flex:1, border:'none', cursor:'pointer', padding:0, fontSize:12, fontWeight:500, fontFamily:'inherit', background: v.type === k ? T.black : 'transparent', color: v.type === k ? '#fff' : T.gray600}}>{l}</button>
      ))}
    </div>
  );
}
function TentativeValueField({value, onChange, index, total}){
  const v = value || {type:'days', days:''};
  const affix = {position:'absolute', top:'50%', transform:'translateY(-50%)', fontSize:12.5, color:T.attioMuted, pointerEvents:'none'};
  if(v.type === 'date') return <DateField value={v.date || ''} onChange={(d)=>onChange({type:'date', date:d})} ariaLabel={`Installment ${index + 1} date`}/>;
  // Delivery: the share of the work delivered when it's due, in %.
  if(v.type === 'delivery') return (
    <div style={{position:'relative'}}>
      <input value={v.at ?? ''} onChange={e=>onChange({type:'delivery', at:e.target.value.replace(/[^0-9.]/g, '')})} inputMode="decimal" placeholder="0" aria-label={`Installment ${index + 1} delivery milestone`}
        style={{...fieldText, paddingRight:88, textAlign:'right', fontVariantNumeric:'tabular-nums'}}/>
      <span style={{...affix, right:10}}>% delivered</span>
    </div>
  );
  return (
    <div style={{position:'relative'}}>
      <span style={{...affix, left:10}}>Day</span>
      <input value={v.days ?? ''} onChange={e=>onChange({type:'days', days:e.target.value.replace(/[^0-9]/g, '')})} inputMode="numeric" placeholder="0" aria-label={`Installment ${index + 1} days`}
        style={{...fieldText, paddingLeft:40, textAlign:'right', fontVariantNumeric:'tabular-nums'}}/>
    </div>
  );
}
function InstallmentsEditor({rows, onChange, total, newId, title = 'Installments'}){
  const sum = Math.round(rows.reduce((s, x) => s + (Number(x.percent) || 0), 0) * 100) / 100;
  const ok = rows.length > 0 && Math.abs(sum - 100) < 0.001;
  const setRow = (id, p) => onChange(rows.map(x => x.id === id ? {...x, ...p} : x));
  const head = {fontSize:11.5, color:T.attioMuted};
  return (
    <div style={{display:'flex', flexDirection:'column', gap:10}}>
      <div style={{display:'flex', alignItems:'center', gap:10}}>
        <span style={{fontSize:11, fontWeight:600, color:T.attioFaint, textTransform:'uppercase', letterSpacing:.4}}>{title}</span>
        {/* Allocated against the required 100%. */}
        <span title="Allocated percentage" style={{display:'inline-flex', alignItems:'center', gap:5, height:24, padding:'0 10px', borderRadius:9999, fontSize:12.5, fontWeight:600,
          fontVariantNumeric:'tabular-nums', background: ok ? '#ECFDF3' : '#FFFAEB', color: ok ? '#027A48' : '#B54708', border:`1px solid ${ok ? '#ABEFC6' : '#FEDF89'}`}}>
          {ok && <Icon name="check" size={11} color="#027A48"/>}{sum}% / 100%</span>
      </div>
      {rows.length > 0 && (
        <div style={{display:'grid', gridTemplateColumns:INST_COLS, gap:12, ...head}}>
          <span/><span>Installment</span><span>Percentage · Amount</span><span>Tentative payment</span><span>Due</span><span/>
        </div>
      )}
      {rows.map((x, i) => (
        <div key={x.id} style={{display:'grid', gridTemplateColumns:INST_COLS, gap:12, alignItems:'center'}}>
          <span style={{fontSize:12, color:T.attioMuted, fontVariantNumeric:'tabular-nums'}}>{i + 1}.</span>
          <input value={x.description} onChange={e=>setRow(x.id, {description:e.target.value})} placeholder="Installment description" aria-label={`Installment ${i + 1} description`} style={fieldText}/>
          <PercentAmountField percent={x.percent} total={total} onPercent={(pc)=>setRow(x.id, {percent:pc})} index={i}/>
          <TentativeTypeField value={x.due} onChange={(due)=>setRow(x.id, {due})} index={i}/>
          <TentativeValueField value={x.due} onChange={(due)=>setRow(x.id, {due})} index={i} total={total}/>
          <button type="button" title="Remove installment" onClick={()=>onChange(rows.filter(y => y.id !== x.id))}
            style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', justifyContent:'center', padding:4, justifySelf:'end'}}><Icon name="trash" size={14} color={T.gray600}/></button>
        </div>
      ))}
      <div>
        <button type="button" onClick={()=>onChange([...rows, {id:newId(), description:'', percent: rows.length ? String(Math.max(0, Math.round((100 - sum) * 100) / 100)) : '100',
          due: rows.length ? {type:'days', days:''} : {type:'days', days:0}}])} style={btnSecondarySm}>
          <Icon name="plus" size={12} color={T.gray600}/> Add installment</button>
      </div>
    </div>
  );
}
// The signature section as it appears on the quotation (E-Signature step).
function QuoteSignaturePreview({name}){
  const brand = workspaceBrand();
  return (
    <div style={{border:`1.5px dashed ${brand.colors.primary}`, borderRadius:10, padding:'16px 18px', display:'flex', flexDirection:'column', gap:14}}>
      <div style={{display:'flex', alignItems:'center', gap:8}}>
        <Icon name="edit" size={14} color={brand.colors.primary}/>
        <span style={{fontSize:12, fontWeight:700, letterSpacing:.6, textTransform:'uppercase', color:brand.colors.primary}}>Customer signature</span>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:16}}>
        {[['Name', name], ['Signature', ''], ['Date', '']].map(([label, value]) => (
          <div key={label}>
            <div style={{height:30, borderBottom:`1px solid ${T.attioText}`, fontSize:13, color:T.attioText, display:'flex', alignItems:'flex-end', paddingBottom:4}}>{value}</div>
            <div style={{fontSize:12, color:T.attioMuted, marginTop:4}}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* A quote's actions, wherever it's shown: Edit and Send (drafts), Delete. */
function quoteActions(hub, q, {onDelete, onEdit, onSign} = {}){
  return [
    ...(q.status === 'sent' && onSign ? [{label:'Mark as signed', onClick:()=>onSign(q)}] : []),
    ...(q.status === 'draft' ? [{label:'Edit quote', onClick:()=>onEdit ? onEdit(q.id) : hub.editQuote(q.id)}, {label:'Send quote', onClick:()=>sendQuoteVia(hub, q)}] : []),
    {label:'Delete quote', danger:true, onClick:()=>onDelete && onDelete(q)},
  ];
}
/* A sent quote's signed copy came back: when it was signed, and the copy (optional, ≤2 MB). The
   quote becomes Signed; its payment terms can then be pulled into the record's Accounting. */
const readUpload = (file, maxBytes = 2 * 1024 * 1024) => new Promise((resolve, reject) => {
  if(!file) return resolve(null);
  if(file.size > maxBytes) return reject(new Error('The file is larger than 2 MB.'));
  const r = new FileReader(); r.onload = () => resolve({name:file.name, size:file.size, type:file.type, dataUrl:r.result}); r.onerror = () => reject(new Error('The file could not be read.')); r.readAsDataURL(file);
});
function SignQuoteModal({quote, onCancel, onSigned}){
  const hub = useRecordHub();
  const [date, setDate] = React.useState(() => ymdOf(new Date()));
  const [copy, setCopy] = React.useState(null);
  const [error, setError] = React.useState('');
  const pickFile = (f) => readUpload(f).then(v => { setCopy(v); setError(''); }).catch(e => setError(e.message));
  const save = () => {
    hub.setQuotes(qs => qs.map(x => x.id === quote.id ? {...x, status:'signed', signedAt:date, signedCopy:copy} : x));
    hub.add(quote.object, quote.recordId, {type:'quote', status:'signed', title:`${quote.number} · ${quote.title} signed`, quoteId:quote.id, total:quoteTotal(quote), source:'you', by:null});
    hub.toast(`Quote ${quote.number} marked as signed`);
    onSigned && onSigned();
  };
  return ReactDOM.createPortal(
    <StModal title={`Mark ${quote.number} as signed`} primary="Mark as signed" canSubmit={!!date} onCancel={onCancel} onSubmit={save}>
      <div><label style={fieldLabel}>Signed on</label><DateField required value={date} onChange={setDate}/></div>
      <div>
        <label style={fieldLabel}>Signed copy</label>
        <EvidenceFile value={copy} onChange={pickFile} onClear={()=>setCopy(null)} accept=".pdf,image/*"/>
        {error && <div style={{fontSize:12, color:T.red, marginTop:4}}>{error}</div>}
      </div>
    </StModal>, document.body);
}
// An uploaded file (signed copy, payment screenshot): its name and size, or Upload.
/* `tall`: the empty state is a taller box with Upload file in its centre (Update Status). */
function EvidenceFile({value, onChange, onClear, accept, tall}){
  const ref = React.useRef(null);
  return value ? (
    <div style={{display:'flex', alignItems:'center', gap:8, border:`1px solid ${T.attioLine}`, borderRadius:8, padding:'7px 10px'}}>
      <Icon name="paperclip" size={13} color={T.gray600}/>
      <span style={{flex:1, minWidth:0, fontSize:13, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{value.name}</span>
      <span style={{fontSize:12, color:T.attioMuted}}>{Math.max(1, Math.round(value.size / 1024))} KB</span>
      <button type="button" title="Remove file" onClick={onClear} style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:2}}><Icon name="close" size={11} color={T.gray600}/></button>
    </div>
  ) : (<>
    <input ref={ref} type="file" accept={accept} style={{display:'none'}} onChange={e=>{ onChange(e.target.files[0]); e.target.value = ''; }}/>
    <button type="button" onClick={()=>ref.current.click()} style={tall
      ? {...btnSecondarySm, width:'100%', height:74, justifyContent:'center', fontSize:13, border:`1px solid ${T.borderStrong}`}
      : btnSecondarySm}><Icon name="paperclip" size={13} color={T.gray600}/> Upload file</button>
  </>);
}
function DeleteQuoteModal({quote, onCancel, onDeleted}){
  const hub = useRecordHub();
  return (
    <StModal title="Delete quote" primary="Delete quote" danger onCancel={onCancel}
      onSubmit={()=>{ hub.setQuotes(qs => qs.filter(x => x.id !== quote.id)); hub.toast(`Quote ${quote.number} deleted`); onDeleted && onDeleted(); }}>
      <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>{quote.number} · {quote.title} will be deleted. The record's activity keeps that it was {quote.status === 'sent' ? 'sent' : 'created'}.</div>
    </StModal>
  );
}

/* ── A record's Quotes tab ── its quotes on the left, the selected one on the right. */
function QuoteNavItem({q, selected, onSelect}){
  const [h, setH] = React.useState(false);
  return (
    <div onClick={onSelect} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{padding:'10px 20px', cursor:'pointer', background: selected ? '#F4F5F7' : h ? T.headerBg : 'transparent', display:'flex', flexDirection:'column', gap:4}}>
      <div style={{display:'flex', alignItems:'center', gap:8}}>
        <span style={{fontSize:12, color:T.attioMuted, fontVariantNumeric:'tabular-nums'}}>{q.number}</span>
        <QuoteStatusPill status={q.status}/>
        <span style={{flex:1}}/>
        <span style={{fontSize:12, color:T.attioMuted}}>{fmtQuoteDate(q.sentAt || q.createdAt)}</span>
      </div>
      <div style={{display:'flex', alignItems:'baseline', gap:8}}>
        <span style={{flex:1, minWidth:0, fontSize:13, fontWeight:500, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{q.title}</span>
        <span style={{fontSize:12.5, color:T.attioText, fontVariantNumeric:'tabular-nums'}}>{fmtMoney(quoteTotal(q))}</span>
      </div>
    </div>
  );
}
function RecordQuotesTab({contact}){
  const hub = useRecordHub(), ra = useRecordAccess();
  const object = ra ? ra.object : 'contacts', record = ra ? ra.record : contact;
  const can = (action) => !ra || toolCan(object, record, 'quotes', action);
  const list = hub.quotes.filter(q => q.object === object && String(q.recordId) === String(record.id)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const [selectedId, setSelectedId] = React.useState(null);
  const [deleting, setDeleting] = React.useState(null);
  const [builder, setBuilder] = React.useState(null);   // {mode:'new'} | {mode:'edit', id}: the creation panel over this tab
  const [signing, setSigning] = React.useState(null);   // the sent quote being marked as signed
  const selected = list.find(q => q.id === selectedId) || list[0] || null;
  const actions = selected ? quoteActions(hub, selected, {onDelete:setDeleting, onEdit:(qid)=>setBuilder({mode:'edit', id:qid}), onSign:setSigning}).filter(it => /^Delete/.test(it.label) ? can('delete') : /^Edit/.test(it.label) ? can('edit') : true) : [];
  return (
    <div style={{flex:1, minHeight:0, display:'flex', flexDirection:'column'}}>
      <div style={{display:'flex', alignItems:'center', gap:10, padding:'12px 20px', borderBottom:`1px solid ${T.border}`, flexShrink:0}}>
        <span style={{fontSize:13, color:T.attioMuted}}>{plural(list.length, 'quote')}</span>
        <div style={{flex:1}}/>
        {can('create') && <button onClick={()=>setBuilder({mode:'new'})} style={{...btnPrimarySm(), display:'inline-flex', alignItems:'center', gap:6}}><Icon name="plus" size={13} color="#fff"/> New quote</button>}
      </div>
      <div style={{flex:1, minHeight:0, display:'flex', overflow:'hidden', position:'relative'}}>
        <div style={{width:380, flexShrink:0, overflowY:'auto', borderRight:`1px solid ${T.border}`, padding:'8px 0'}}>
          {list.map(q => <QuoteNavItem key={q.id} q={q} selected={selected && selected.id === q.id} onSelect={()=>setSelectedId(q.id)}/>)}
          {!list.length && <div style={{fontSize:13, color:T.attioMuted, padding:'24px 20px', textAlign:'center'}}>No quotes yet.</div>}
        </div>
        <div style={{flex:1, minWidth:0, minHeight:0, display:'flex', flexDirection:'column'}}>
          {selected && (
            <DetailFrame head={<span style={{fontSize:13, color:T.attioMuted}}>{selected.number} · created by {selected.createdBy}{selected.status === 'signed' ? ` · signed ${fmtQuoteDate(selected.signedAt)}` : ''}</span>}
              actions={<>{selected.status === 'draft' && can('edit') && headerBtn('Edit', ()=>setBuilder({mode:'edit', id:selected.id}))}
                {selected.status === 'draft' && <button onClick={()=>sendQuoteVia(hub, selected)} style={btnPrimarySm()}>Send</button>}
                {selected.status === 'sent' && can('edit') && <button onClick={()=>setSigning(selected)} style={btnPrimarySm()}>Mark as signed</button>}
                {selected.signedCopy && <a href={selected.signedCopy.dataUrl} download={selected.signedCopy.name} style={{...btnSecondarySm, textDecoration:'none'}}><Icon name="paperclip" size={13} color={T.gray600}/> Signed copy</a>}
                <DetailMoreMenu items={actions.filter(it => !/^(Edit|Send|Mark)/.test(it.label))}/></>}>
              <QuoteDocument quote={selected}/>
            </DetailFrame>
          )}
        </div>
        {/* New / edit: the creation panel over this tab — the record is this one. */}
        {builder && <QuoteBuilder key={builder.id || 'new'} {...(builder.mode === 'new' ? {mode:'new', object, id:record.id} : builder)}
          onClose={(saved)=>{ setBuilder(null); if(saved) setSelectedId(saved.id); }}/>}
      </div>
      {deleting && <DeleteQuoteModal quote={deleting} onCancel={()=>setDeleting(null)} onDeleted={()=>{ setDeleting(null); setSelectedId(null); }}/>}
      {signing && <SignQuoteModal quote={signing} onCancel={()=>setSigning(null)} onSigned={()=>setSigning(null)}/>}
    </div>
  );
}

// A quote activity opened from the Activity feed: the quotation (if it still exists).
function QuoteActivityDetail({a, contact}){
  const hub = useRecordHub();
  const q = hub && hub.quotes.find(x => x.id === a.quoteId);
  return (
    <DetailFrame head={activityHead(a, contact)}>
      {q ? <QuoteDocument quote={q}/> : <div style={{fontSize:13, color:T.attioMuted}}>This quote was deleted.</div>}
    </DetailFrame>
  );
}

/* ── Tools → Quotes ── every quotation in the workspace. */
const QUOTE_COLUMNS = [
  {key:'number', label:'Quote', width:130}, {key:'title', label:'Title', width:240}, {key:'recordName', label:'Record', width:200}, {key:'objectLabel', label:'Record Type', width:130},
  {key:'recipientName', label:'Recipient', width:180}, {key:'totalText', label:'Total', width:140}, {key:'statusLabel', label:'Status', width:110},
  {key:'createdText', label:'Created', width:140}, {key:'createdBy', label:'Created By', width:160},
];
function QuotesPage(){
  const hub = useRecordHub();
  const [openId, setOpenId] = React.useState(null);
  const [builder, setBuilder] = React.useState(null);   // {mode:'new'} | {mode:'edit', id}: the creation panel
  const [signing, setSigning] = React.useState(null);
  const [deleting, setDeleting] = React.useState(null);
  const rows = hub.quotes.map(q => { const r = hubRecord(hub, q.object, q.recordId); return {...q, recordName:r ? r.name : '—', objectLabel:HUB_NOUN[q.object],
    recipientName:q.recipient.name, total:quoteTotal(q), totalText:fmtMoney(quoteTotal(q)), statusLabel:QUOTE_STATUS[q.status].label, createdText:fmtQuoteDate(q.createdAt)}; });
  const open = hub.quotes.find(q => q.id === openId) || null;
  const edit = (qid) => { setOpenId(null); setBuilder({mode:'edit', id:qid}); };
  // Bulk Actions: Delete (as a quote's Delete).
  const quoteBulk = useTableBulkDelete({rows:hub.quotes, noun:'quote',
    remove:(ids) => { hub.setQuotes(qs => qs.filter(q => !ids.includes(q.id))); if(ids.includes(openId)) setOpenId(null); }, onDone:(n) => hub.toast(`${bulkPlural(n, 'quote')} deleted`)});
  const schema = {
    properties:QUOTE_COLUMNS, noun:'quote', searchKeys:['number', 'title', 'recordName', 'recipientName'], canCreateProperty:false, bulkActions:quoteBulk.bulkActions,
    filterProps:[{key:'statusLabel', label:'Status', type:'select'}, {key:'objectLabel', label:'Record Type', type:'select'}, {key:'total', label:'Total', type:'number'},
      {key:'createdBy', label:'Created By', type:'select'}],
    selectValues:{statusLabel:['Draft', 'Sent', 'Signed'], objectLabel:['Contact', 'Deal', 'Customer'], createdBy:[...new Set(hub.quotes.map(q => q.createdBy).filter(Boolean))]},
    renderCell:(key, r) => key === 'number' ? <ContactName name={r.number} onOpen={()=>setOpenId(r.id)} style={{fontSize:'inherit', fontWeight:500}}/>
      : key === 'recordName' && r.recordName !== '—' ? <HubRecordLink object={r.object} id={r.recordId} name={r.recordName}/>
      : key === 'statusLabel' ? <QuoteStatusPill status={r.status}/> : undefined,
    renderActions:(r) => <RowActionsMenu title="Quote actions" width={MENU_W} items={[{label:'View quote', onClick:()=>setOpenId(r.id)}, ...quoteActions(hub, hub.quotes.find(q => q.id === r.id), {onDelete:setDeleting, onEdit:edit, onSign:setSigning})]}/>,
  };
  return (
    <div style={{flex:1, minWidth:0, minHeight:0, display:'flex', flexDirection:'column', position:'relative', overflow:'hidden'}}>
      <RecordViewsModule inset="page" schema={schema} rows={rows} columns={QUOTE_COLUMNS.map(c => c.key)}
        defaultViews={[{id:'qv-all', name:'All Quotes', sort:{key:'number', dir:'desc'}},
          {id:'qv-draft', name:'Drafts', filters:{nodes:[{id:'f-qd', kind:'row', joinOp:'AND', prop:'statusLabel', op:'is', value:'Draft', value2:'', values:[]}]}},
          {id:'qv-sent', name:'Sent', filters:{nodes:[{id:'f-qs', kind:'row', joinOp:'AND', prop:'statusLabel', op:'is', value:'Sent', value2:'', values:[]}]}}]}
        actions={() => <button onClick={()=>{ setOpenId(null); setBuilder({mode:'new'}); }} title="New quote" style={toolbarIconButton}><Icon name="plus" size={14} color={T.gray800}/></button>}
        overlay={builder ? <QuoteBuilder key={builder.id || 'new'} {...builder} onClose={(saved)=>{ setBuilder(null); if(saved) setOpenId(saved.id); }}/>
          : open && <PageSidePanel width={560} title={`${open.number} · ${open.title}`} subtitle={`${QUOTE_STATUS[open.status].label} · ${fmtMoney(quoteTotal(open))}`}
          onClose={()=>setOpenId(null)} menuItems={quoteActions(hub, open, {onDelete:setDeleting, onEdit:edit, onSign:setSigning})}>
          <div style={{flex:1, overflowY:'auto', padding:'4px 20px 24px'}}><QuoteDocument quote={open}/></div>
        </PageSidePanel>}/>
      {quoteBulk.bulkModal}
      {deleting && <DeleteQuoteModal quote={deleting} onCancel={()=>setDeleting(null)} onDeleted={()=>{ if(openId === deleting.id) setOpenId(null); setDeleting(null); }}/>}
      {signing && <SignQuoteModal quote={signing} onCancel={()=>setSigning(null)} onSigned={()=>setSigning(null)}/>}
    </div>
  );
}

Object.assign(window, {InstallmentsEditor, tentativeOk, normalizeDue, readUpload, EvidenceFile, fmtTentative, tentativeDate, installmentAmount, SAMPLE_QUOTES, SAMPLE_QUOTE_TEMPLATES, quoteTemplatesOf, quoteTotals, quoteItemTotal, nextTemplateCode, copyItems, QuoteBuilder, QuoteDocument, RecordQuotesTab, QuoteActivityDetail, QuotesPage, quoteTotal, QUOTE_STATUS, sendQuoteVia});
