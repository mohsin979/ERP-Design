/* HOF Pulse ERP — Documents: business documents for a Contact, Deal or Customer (Tools → Documents
   and the record's Documents tab), a light document editor — no stepper, no sections.

   A document is a workspace record of its own (App: `documents`), linked to the record it's for.
   The builder (DocumentBuilder) is the page itself, on the open branch's Digital Letterhead
   (BrandedDocument, quotes.jsx), written in place. Above it: the document's name (the file's name —
   lists, emails; not on the page), then the toolbar — the rich-text editor's (bold, italic,
   underline, lists, link), the text size in numbers, Image, then Add Record Info, Add Payment Plan
   and Add Signature, which put an element where the cursor is:
     Record Info  — a record (one search over every record, by name) and which of its details go
                    in (its name, email, phone and address to start with): put in as ordinary text
                    under "Prepared for" — edited like the rest (decided 2026-11-12);
     Payment Plan — the record Accounting's Payment Plan panel (accounting.jsx): One-Time,
                    Installment or Recurring, the same fields and data, its invoice issue date
                    "Document Signed" or a fixed date; shown as its payments (planSchedule) — dated
                    from the day the document is signed by everyone (until then: Day N);
     Signature    — a signer's name and email, and their signature area; any number of them.
   The record it belongs to (its Documents tab, its activity): the one it was started from, else
   the record of its first Record Info; without either it stands alone — in Tools → Documents only,
   with no record activity. The page shows "# <number>" and the date (made, then sent) under the
   logo, then the body. The body is HTML (richText.jsx, RICH_DOC); an element sits in it as an empty placeholder,
   its data in `embeds` by id, drawn the same way in the editor and wherever the document is shown
   (embedHtml). Clicking one in the editor opens it; its × takes it out.
   Send Document opens Send Document (SendDocumentModal): its signers (from its signature blocks)
   and the recipients to send it to (the record's person to start with; any number). Sending goes
   to every signer — each with their own signing link — and every recipient (decided 2026-11-12).
   The link (#s~<CRM branch>~<document>~<signature>, PublicSignPage) opens the document with that
   signer's area marked; they type their name to sign there. No identity is checked: anyone with
   the link can sign that area. A signature is left in the branch's signing inbox (as a public
   form's response, forms.jsx) and the app takes it in (DocumentSignInbox).
   The lifecycle is the quotes': Draft (Edit, Send, Delete) → Sent (each signer's link can be
   copied; "1 of 2 signed") → Signed once every signature is (no edit or delete). A sent one keeps
   the brand it went out with. Its number (DOC-<year>-<nnnn>) comes from a counter that only goes
   up. Created, sent and each signature go on the record's activity; sending puts its emails there
   too. Nothing is really emailed. Once signed by everyone, each payment plan in it becomes a
   Payment Plan on its record (plansFromDocument — on the record that holds its plans, dated from
   the signing, "From DOC-…"); a document without a record makes none. Documents saved before (sections of blocks) open as one body
   (upgradeDocument); their Assignable recipient and Signable flag are no longer used. Permissions:
   the record type's Tools → Documents (Users & Teams). */

const DOCUMENT_STATUS = {draft:{label:'Draft', tone:'neutral'}, sent:{label:'Sent', tone:'info'}, signed:{label:'Signed', tone:'success'}};
const docId = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
// Numbers from a counter that only goes up (store.jsx `ids.documents`), never below one used; `preview`: the next, not taken.
const documentNumber = (docs, preview) => {
  ensureIdFloor('documents', quoteSeqFloor(docs));
  const n = preview ? Math.max(peekRecordId('documents'), quoteSeqFloor(docs)) : newRecordId('documents');
  return `DOC-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`;
};
const DocumentStatusPill = ({status}) => <StatusPill status={status} map={DOCUMENT_STATUS}/>;
const docEmailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
const escHtml = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ── Elements in the text ── */
// The elements a body holds, in order: [{kind, id}].
const bodyEmbeds = (html) => { const box = document.createElement('div'); box.innerHTML = html || '';
  return [...box.querySelectorAll('[data-embed]')].map(n => ({kind:n.getAttribute('data-embed'), id:n.getAttribute('data-id')})); };
// Its signers, in the order their signature blocks appear: [{id, name, email, signedAt?, signedName?}].
const documentSigners = (d) => bodyEmbeds(d.body).filter(e => e.kind === 'signature').map(e => ({id:e.id, ...((d.embeds || {})[e.id] || {})})).filter(s => s.name);
const signProgress = (d) => { const all = documentSigners(d); return `${all.filter(s => s.signedAt).length} of ${all.length} signed`; };
/* A payment term as the document shows it: "Payment Terms" and its type, then its payments
   (planSchedule, accounting.jsx: each one's invoice and due dates and amount) and their total.
   `signedOn`: the day the document was signed — a Document Signed plan is dated from it (until
   then: Day N). A subscription until cancelled: its first cycles, then "Until cancelled". Saved
   before plans: as a plan (planOf). */
function paymentEmbedHtml(pt, brand, signedOn){
  const plan = planOf(pt), cur = plan.currency || defaultCurrency(), money = (v) => escHtml(fmtMoney(v, cur));
  const muted = `color:${T.attioMuted}`, num = 'font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right';
  const kind = PAYMENT_TYPE_LABEL[plan.paymentType] + (plan.paymentType === 'recurring' ? ` · ${RECURRING_FREQUENCY[plan.frequency] || 'Monthly'}` : '');
  const rows = planSchedule(plan, {id:'pt', signedOn, preview:3}), when = (d, t) => escHtml(fmtQuoteDate(d) || t || '—');
  return `<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:8px">`
    + `<span style="font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:${brand.colors.secondary}">Payment Plan</span>`
    + `<span style="font-size:12px;${muted}">${escHtml(kind)}</span></div>`
    + `<div style="display:flex;gap:12px;padding:0 0 6px;font-size:11.5px;${muted}"><span style="flex:1">Payment</span>`
    + `<span style="width:110px;text-align:right">Invoice</span><span style="width:110px;text-align:right">Due</span><span style="width:120px;text-align:right">Amount</span></div>`
    + rows.map(x => `<div style="display:flex;gap:12px;align-items:baseline;padding:7px 0;border-top:1px solid ${T.attioLine};font-size:13px;color:${T.attioText}">`
      + `<span style="flex:1;min-width:0">${escHtml(x.description)}</span><span style="width:110px;${num};${muted}">${when(x.invoiceDate, x.invoiceTentative)}</span>`
      + `<span style="width:110px;${num};${muted}">${when(x.dueDate, x.tentative)}</span><span style="width:120px;${num}">${money(x.amount)}</span></div>`).join('')
    + (planOngoing(plan) ? `<div style="border-top:2px solid ${brand.colors.primary};margin-top:2px;padding-top:7px;font-size:13px;${muted}">Until cancelled</div>`
      : `<div style="display:flex;justify-content:space-between;gap:12px;border-top:2px solid ${brand.colors.primary};margin-top:2px;padding-top:7px;font-size:13px;font-weight:700;color:${T.attioText}">`
      + `<span>Total</span><span style="${num}">${money(rows.reduce((a, x) => a + x.amount, 0))}</span></div>`);
}
// A signature block: the signer's name and email, their signature area and the date (filled once signed). `mine`: the signer's own, marked (their link).
function signatureEmbedHtml(sg, brand, mine){
  const line = (value, label) => `<div><div style="min-height:30px;border-bottom:1px solid ${T.attioText};display:flex;align-items:flex-end;padding-bottom:4px;font-size:13px;color:${T.attioText};overflow-wrap:anywhere">${value}</div>`
    + `<div style="font-size:12px;color:${T.attioMuted};margin-top:4px">${label}</div></div>`;
  const signed = !!sg.signedAt;
  return `<div style="border:1.5px dashed ${brand.colors.primary};border-radius:10px;padding:14px 16px;background:${mine ? T.blueLight : '#fff'}">`
    + `<div style="font-size:12px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:${brand.colors.primary};margin-bottom:12px">Signature</div>`
    + `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px">`
    + line(escHtml(sg.name), 'Name') + line(escHtml(sg.email), 'Email')
    + line(signed ? `<span style="font-family:'Snell Roundhand','Segoe Script','Brush Script MT',cursive;font-size:21px;line-height:1">${escHtml(sg.signedName)}</span>` : '', 'Signature')
    + line(signed ? escHtml(fmtQuoteDate(sg.signedAt)) : '', 'Date') + `</div></div>`;
}
// Record info as the document shows it: the name, then each detail — name, email, phone and address as lines, others "Label: value".
const recordInfoPlain = (f) => ['name', 'email', 'phone'].includes(f.key) || ['Location', 'Email', 'Phone Number'].includes(f.type);
// Record info as the text it becomes: "Prepared for", the name in bold, each detail on its own line; then a line to write on.
const recordInfoText = (fields) => `<p><span data-size="12">Prepared for</span><br>` + (fields || []).map(f => f.key === 'name' ? `<b>${escHtml(f.value)}</b>`
  : recordInfoPlain(f) ? escHtml(f.value).replace(/\n/g, '<br>') : `${escHtml(f.label)}: ${escHtml(f.value)}`).join('<br>') + `</p><p><br></p>`;
// An element's HTML; in the editor (`editing`) with its × (Remove).
const embedHtml = (kind, data, brand, editing, mine, signedOn) => (kind === 'payment' ? paymentEmbedHtml(data, brand, signedOn) : kind === 'record' ? recordInfoText(data.fields) : signatureEmbedHtml(data, brand, mine))
  + (editing ? `<button type="button" data-embed-remove title="Remove" aria-label="Remove">×</button>` : '');

/* Saved before (sections of Text, Image and Payment Terms blocks, a Signable one's customer
   signature): one body — a section's title bold and large, its blocks in order; its payment terms
   an Installment Payment counted from when it was sent (or made); the customer signature a block. */
function upgradeDocument(d){
  if(!d) return d;
  // Record Info saved as an element (before it became text): its text in its place.
  if(d.body != null && /data-embed="record"/.test(d.body)){
    const box = document.createElement('div'); box.innerHTML = d.body;
    box.querySelectorAll('[data-embed="record"]').forEach(n => { const data = (d.embeds || {})[n.getAttribute('data-id')], t = document.createElement('div');
      t.innerHTML = data ? recordInfoText(data.fields) : ''; n.replaceWith(...t.childNodes); });
    return {...d, body:sanitizeRichText(box.innerHTML, RICH_DOC), embeds:Object.fromEntries(Object.entries(d.embeds || {}).filter(([, e]) => e.kind !== 'record'))};
  }
  if(d.body != null || !Array.isArray(d.sections)) return d;
  const embeds = {}; let html = '';
  d.sections.forEach((s, si) => {
    if(s.title) html += `<p><span data-size="lg"><b>${escHtml(s.title)}</b></span></p>`;
    (s.blocks || []).forEach((b, bi) => {
      if(b.type === 'text') html += richHtmlOf(b.html || '');
      else if(b.type === 'image' && b.image) html += `<p><img src="${b.image.dataUrl}"></p>`;
      else if(b.type === 'payment' && (b.installments || []).length){ const id = `${d.id}-pt-${si}-${bi}`;
        embeds[id] = {kind:'payment', paymentType:'installments', title:s.title || 'Payment Terms', total:Number(b.total) || 0, currency:b.currency, startDate:ymdOf(new Date(d.sentAt || d.createdAt)), terms:b.installments};
        html += `<div data-embed="payment" data-id="${id}"></div>`; }
    });
  });
  if(d.signable && d.recipient){ const id = `${d.id}-sg`;
    embeds[id] = {kind:'signature', name:d.recipient.name, email:d.recipient.email, ...(d.status === 'signed' ? {signedAt:d.signedAt, signedName:d.recipient.name} : {})};
    html += `<div data-embed="signature" data-id="${id}"></div>`; }
  const {sections, signedCopy, ...rest} = d;
  return {...rest, body:sanitizeRichText(html, RICH_DOC), embeds};
}

/* ── The document as it reads ── */
// The body with its elements drawn in (`mine`: a signer's own area, marked).
function DocumentBodyView({doc, brand, mine}){
  const embeds = doc.embeds || {};
  const html = React.useMemo(() => {
    const box = document.createElement('div'); box.innerHTML = sanitizeRichText(richHtmlOf(doc.body || ''), RICH_DOC);
    box.querySelectorAll('[data-embed]').forEach(n => { const id = n.getAttribute('data-id'), data = embeds[id];
      if(!data){ n.remove(); return; } n.innerHTML = embedHtml(n.getAttribute('data-embed'), data, brand, false, id === mine, doc.status === 'signed' ? doc.signedAt : ''); });
    return box.innerHTML;
  }, [doc.body, JSON.stringify(embeds), brand, mine, doc.sentAt]);
  if(richIsEmpty(html)) return null;
  return <><RichTextStyles/><div className="hof-rich" style={{fontSize:14, color:T.attioText, lineHeight:1.6}} dangerouslySetInnerHTML={{__html:html}}/></>;
}
// The page: the letterhead with the number and the date (made, then sent) under the logo, then `body`.
function DocumentSheet({doc, brand, body}){
  const line = {fontSize:13, color:T.attioText, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap'};
  return (
    <BrandedDocument brand={brand} label="Document" number={doc.number} noNumber
      beneathLogo={<div style={{display:'flex', flexDirection:'column', gap:2}}>
        <span style={line}><span style={{color:T.attioMuted}}>#</span> {doc.number}</span>
        <span style={line}>{fmtQuoteDate(doc.sentAt || doc.createdAt)}</span>
      </div>}>
      <div style={{padding:'20px 24px 24px'}}>{body}</div>
    </BrandedDocument>
  );
}
function DocumentView({doc}){
  const brand = quoteBrand(doc);
  return <DocumentSheet doc={doc} brand={brand} body={<DocumentBodyView doc={doc} brand={brand}/>}/>;
}
// The record a document belongs to, if any.
const docRecordOf = (hub, d) => d.recordId != null && d.object ? hubRecord(hub, d.object, d.recordId) : null;

/* ── Sending ── Sent, the brand it went out with, the recipients it went to; the document on the
   record's activity and an email to every signer (with their link) and every recipient. */
const signLink = (d, sigId, crmId = ACTIVE_CRM.id) => `${window.location.origin}${window.location.pathname}#s~${crmId}~${d.id}~${sigId}`;
// (sameEmail: workspaces.jsx.)
// The body as an email's plain text: paragraphs apart; a payment term as its lines; signature blocks left out.
function documentPlain(d){
  const box = document.createElement('div'); box.innerHTML = sanitizeRichText(richHtmlOf(d.body || ''), RICH_DOC);
  box.querySelectorAll('[data-embed]').forEach(n => { const data = (d.embeds || {})[n.getAttribute('data-id')];
    if(data && data.kind === 'record'){ const p = document.createElement('p'); p.innerHTML = (data.fields || []).map(f => escHtml(recordInfoPlain(f) || f.key === 'name' ? f.value : `${f.label}: ${f.value}`)).join('<br>'); n.replaceWith(p); return; }
    if(!data || data.kind !== 'payment'){ n.remove(); return; }
    const plan = planOf(data), cur = plan.currency || defaultCurrency();
    const lines = [`Payment plan (${PAYMENT_TYPE_LABEL[plan.paymentType]}):`, ...planSchedule(plan, {signedOn: d.status === 'signed' ? d.signedAt : '', preview:3})
      .map((x, i) => `${i + 1}. ${x.description} — ${fmtMoney(x.amount, cur)} — due ${fmtQuoteDate(x.dueDate) || x.tentative}`), ...(planOngoing(plan) ? ['Until cancelled'] : [])];
    const p = document.createElement('p'); p.innerHTML = lines.map(escHtml).join('<br>'); n.replaceWith(p); });
  box.innerHTML = box.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|div)>/gi, '\n');
  return box.textContent.replace(/\n{3,}/g, '\n\n').trim();
}
function sendDocumentVia(hub, d, recipients = []){
  const signers = documentSigners(d);
  if(!signers.length && !recipients.length) return;
  const sentAt = new Date(), brandId = keepQuoteBrand();
  hub.setDocuments(ds => ds.map(x => x.id === d.id ? {...x, status:'sent', sentAt, brandId, recipients} : x));
  // On its record's activity — a document without a record has none.
  const log = (a) => { if(d.recordId != null && d.object) hub.add(d.object, d.recordId, a); };
  log({type:'document', status:'sent', title:`${d.number} · ${d.title}`, documentId:d.id, source:'you', by:null});
  const content = documentPlain(d);
  const mail = (to, name, extra) => log({type:'email', direction:'sent', status:'sent', to:[to], source:'you', by:null, documentId:d.id,
    title:`${d.title} (${d.number})`, body:`Hi ${emailFirstName(name) || 'there'},\n\nPlease find ${d.title} (${d.number}) below.` + (content ? `\n\n${content}` : '') + extra + `\n\nKind regards,\n${CURRENT_USER.name}`});
  signers.forEach(s => mail(s.email, s.name, `\n\nPlease review and sign the document here:\n${signLink(d, s.id)}`));
  // Each recipient once; a signer already has it.
  recipients.filter((r, i) => !signers.some(s => sameEmail(s.email, r.email)) && recipients.findIndex(x => sameEmail(x.email, r.email)) === i).forEach(r => mail(r.email, r.name, ''));
  hub.toast(`Document ${d.number} sent`);
}
/* ── Send Document ── its signers (from its signature blocks; each gets a link to sign) and the
   recipients it goes to — the record's person to start with (`initial`), any number. */
function SendDocumentModal({doc, initial, onCancel, onSend}){
  const signers = documentSigners(doc);
  const [rows, setRows] = React.useState(() => initial && initial.email && !signers.some(s => sameEmail(s.email, initial.email)) ? [{id:docId('rc'), name:initial.name || '', email:initial.email}] : []);
  const set = (id, p) => setRows(rs => rs.map(r => r.id === id ? {...r, ...p} : r));
  const ok = rows.every(r => r.name.trim() && docEmailOk(r.email)) && signers.length + rows.length > 0;
  const head = {fontSize:12.5, fontWeight:500, color:T.gray600};
  return ReactDOM.createPortal(
    <StModal title="Send Document" primary="Send" canSubmit={ok} width={600} onCancel={onCancel}
      onSubmit={()=>ok && onSend(rows.map(r => ({name:r.name.trim(), email:r.email.trim()})))}>
      {signers.length > 0 && <div style={{display:'flex', flexDirection:'column', gap:8}}>
        <span style={head}>Signers</span>
        {signers.map(s => (
          <div key={s.id} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 12px', border:`1px solid ${T.attioLine}`, borderRadius:8, fontSize:13, color:T.attioText}}>
            <Icon name="edit" size={13} color={T.gray600}/><span style={{fontWeight:500}}>{s.name}</span>
            <span style={{flex:1, minWidth:0, color:T.attioMuted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.email}</span>
          </div>
        ))}
      </div>}
      <div style={{display:'flex', flexDirection:'column', gap:8}}>
        <span style={head}>Recipients</span>
        {rows.map((r, i) => (
          <div key={r.id} style={{display:'flex', alignItems:'center', gap:8}}>
            <input autoFocus={i === rows.length - 1 && !r.name} value={r.name} onChange={e=>set(r.id, {name:e.target.value})} placeholder="Name" aria-label={`Recipient ${i + 1} name`} style={{...fieldInput, flex:'1 1 0', minWidth:0}}/>
            <input value={r.email} onChange={e=>set(r.id, {email:e.target.value})} placeholder="Email" aria-label={`Recipient ${i + 1} email`}
              style={{...fieldInput, flex:'1.3 1 0', minWidth:0, borderColor: r.email && !docEmailOk(r.email) ? T.red : T.borderStrong}}/>
            <button type="button" title="Remove Recipient" aria-label="Remove Recipient" onClick={()=>setRows(rs => rs.filter(x => x.id !== r.id))}
              style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:4}}><Icon name="close" size={12} color={T.gray600}/></button>
          </div>
        ))}
        <div><button type="button" onClick={()=>setRows(rs => [...rs, {id:docId('rc'), name:'', email:''}])} style={btnSecondarySm}><Icon name="plus" size={12} color={T.gray600}/> Add Recipient</button></div>
      </div>
    </StModal>, document.body);
}
// A document's actions, wherever it's shown: each waiting signer's link (sent), Edit and Send — Send Document (drafts), Delete (not signed).
function documentActions(hub, d, {onDelete, onEdit, onSend} = {}){
  const waiting = d.status === 'sent' ? documentSigners(d).filter(s => !s.signedAt) : [];
  return [
    ...waiting.map(s => ({label:`Copy Link for ${s.name}`, onClick:()=>copyText(signLink(d, s.id)).then(ok => hub.toast(ok ? 'Signing link copied' : 'Copy failed'))})),
    ...(d.status === 'draft' ? [{label:'Edit Document', onClick:()=>onEdit && onEdit(d.id)}] : []),
    ...(d.status === 'draft' && onSend ? [{label:'Send Document', onClick:()=>onSend(d)}] : []),
    ...(d.status !== 'signed' ? [{label:'Delete Document', danger:true, onClick:()=>onDelete && onDelete(d)}] : []),
  ];
}
function DeleteDocumentModal({doc, onCancel, onDeleted}){
  const hub = useRecordHub();
  return (
    <StModal title="Delete Document" primary="Delete Document" danger onCancel={onCancel}
      onSubmit={()=>{ hub.setDocuments(ds => ds.filter(x => x.id !== doc.id)); hub.toast(`Document ${doc.number} deleted`); onDeleted && onDeleted(); }}>
      <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>{doc.number} · {doc.title} will be deleted. The record's activity keeps that it was {doc.status === 'sent' ? 'sent' : 'created'}. This can't be undone.</div>
    </StModal>
  );
}

/* ── Add Signature ── the signer's name and email. */
function SignatureModal({initial, isNew, onCancel, onSave}){
  const [name, setName] = React.useState(initial.name || '');
  const [email, setEmail] = React.useState(initial.email || '');
  const ok = !!name.trim() && docEmailOk(email);
  return ReactDOM.createPortal(
    <StModal title={isNew ? 'Add Signature' : 'Edit Signature'} primary={isNew ? 'Add Signature' : 'Save Changes'} canSubmit={ok} onCancel={onCancel}
      onSubmit={()=>ok && onSave({name:name.trim(), email:email.trim()})}>
      <div><label style={fieldLabel}>Signer Name</label><input autoFocus value={name} onChange={e=>setName(e.target.value)} style={fieldInput}/></div>
      <div><label style={fieldLabel}>Signer Email</label><input value={email} onChange={e=>setEmail(e.target.value)}
        style={{...fieldInput, borderColor: email && !docEmailOk(email) ? T.red : T.borderStrong}}/></div>
    </StModal>, document.body);
}

/* ── Add Record Info ── a record (one search over every record, by name, under its record type)
   and which of its details go in: its properties with a value — name, email, phone and address
   ticked to start with. They go in as text, as they are now (recordInfoText). */
const DOC_PLURAL = {contacts:'Contacts', deals:'Deals', customers:'Customers'};
const recordInfoStarts = (f) => ['name', 'email', 'phone'].includes(f.key) || f.type === 'Location';
// Each value as the record shows it: an amount with its currency, a pipeline and stage by name, a date with its year.
const recordInfoFields = (hub, object, rec) => objectProperties(hub.data, object).map(p => {
  const ck = amountCurrencyKey(p), raw = rec[p.key], type = propertyTypeId(p.type);
  const value = ck ? (raw === '' || raw == null ? '' : moneyText(raw, rec[ck]))
    : type === 'Pipeline' || p.key === 'pipeline' ? ((pipelineById2(hub.data, raw) || {}).label || '')
    : type === 'Pipeline stage' || p.key === 'stage' ? stageLabelOf(hub.data, rec.pipeline, raw)
    : ['Date', 'Timestamp'].includes(type) ? String(raw ?? '') : String(formatPropertyValueOf(p, raw) ?? '');
  return {key:p.key, label:p.label, type, value:value.trim()};
}).filter(f => f.value && f.value !== '—');
function RecordInfoModal({defaultRecord, onCancel, onSave}){
  const hub = useRecordHub();
  const [rec, setRec] = React.useState(() => defaultRecord || null);
  const [keys, setKeys] = React.useState(null);   // null: the ones ticked to start with
  const record = rec && rec.id != null ? hubRecord(hub, rec.object, rec.id) : null;
  const fields = React.useMemo(() => record ? recordInfoFields(hub, rec.object, record) : [], [rec && rec.object, rec && rec.id]);
  const chosen = keys || fields.filter(recordInfoStarts).map(f => f.key);
  // Each option keeps its record's own id (a contact's is a number).
  const options = React.useMemo(() => hubObjects().flatMap(o => ((hub.records || {})[o] || []).map(r => ({value:`${o}~${r.id}`, label:r.name || '—', section:typePlural(o, DOC_PLURAL[o]), rec:{object:o, id:r.id}}))), [hub.records]);
  const ok = !!record && fields.some(f => chosen.includes(f.key));
  const toggle = (k) => setKeys(chosen.includes(k) ? chosen.filter(x => x !== k) : [...chosen, k]);
  return ReactDOM.createPortal(
    <StModal title="Add Record Info" primary="Add Record Info" canSubmit={ok} width={560} onCancel={onCancel}
      onSubmit={()=>ok && onSave({object:rec.object, recordId:rec.id, recordName:record.name, fields:fields.filter(f => chosen.includes(f.key))})}>
      <div><label style={fieldLabel}>Record</label>
        <SearchableSelect value={rec && rec.id != null ? `${rec.object}~${rec.id}` : ''} options={options} placeholder="Select record" searchPlaceholder="Search records"
          onChange={(v)=>{ const o = options.find(x => x.value === v); if(o){ setRec(o.rec); setKeys(null); } }}/></div>
      {record && <div><label style={fieldLabel}>Details</label>
        <div style={{border:`1px solid ${T.attioLine}`, borderRadius:8, maxHeight:300, overflowY:'auto'}}>
          {fields.map(f => (
            <div key={f.key} onClick={()=>toggle(f.key)} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderBottom:`1px solid ${T.attioLine}`, cursor:'pointer', fontSize:13}}>
              <RowCheckbox checked={chosen.includes(f.key)} onChange={()=>toggle(f.key)}/>
              <span style={{width:170, flexShrink:0, color:T.attioText, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{f.label}</span>
              <span style={{flex:1, minWidth:0, color:T.attioMuted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{f.value}</span>
            </div>
          ))}
        </div></div>}
    </StModal>, document.body);
}

/* ── The builder (new, or editing a draft) ── the page, written in place: the name and the toolbar
   above it. `mode` 'new' (`object` / `id`: the record it's for, when started from one) or 'edit'
   (`id`: the document). `onClose(saved)`: the saved document, or nothing (cancelled). Send Document
   saves it, then asks whom to send it to. */
const DOC_PAGE_W = 880, DOC_PANEL_W = 1360;
function DocumentBuilder({mode, id, object, onClose, placement = 'fixed'}){
  const hub = useRecordHub();
  const existing = mode === 'edit' ? hub.documents.find(d => d.id === id) : null;
  const recordId0 = mode === 'new' && object && id != null ? id : null;
  // Its record: the one it was started from (or saved with), else that of its first Record Info.
  const base = existing ? (existing.recordId != null && existing.object ? {object:existing.object, id:existing.recordId} : null) : (object && recordId0 != null ? {object, id:recordId0} : null);
  const personOf = (t) => { const p = t && t.id != null ? hubRecordPerson(hub, t.object, t.id) : null; return {name:(p && p.name) || '', email:(p && p.email) || ''}; };
  const [d, setD] = React.useState(() => existing ? {title:existing.title || '', body:existing.body || '', embeds:{...(existing.embeds || {})}} : {title:'', body:'', embeds:{}});
  const [toolbarEl, setToolbarEl] = React.useState(null);
  const [editing, setEditing] = React.useState(null);   // {kind, id, isNew}: an element's panel
  const [sending, setSending] = React.useState(false);  // Send Document: whom to send it to
  const insertRef = React.useRef(null);                  // the editor's insert, for an element added from its panel
  const brand = orgBrand();
  const embeds = {key:JSON.stringify(d.embeds), render:(kind, eid) => d.embeds[eid] ? embedHtml(kind, d.embeds[eid], brand, true) : '',
    onOpen:(kind, eid) => d.embeds[eid] && setEditing({kind, id:eid})};
  const signers = bodyEmbeds(d.body).filter(e => e.kind === 'signature' && d.embeds[e.id]);
  const [linked, setLinked] = React.useState(null);   // the record of its first Record Info (without one of its own)
  const target = base || linked;
  const ok = true;
  const draft = () => { const used = new Set(bodyEmbeds(d.body).map(e => e.id));
    return {title:d.title.trim() || 'Untitled document', object:target ? target.object : null, recordId:target ? target.id : null, body:d.body,
      embeds:Object.fromEntries(Object.entries(d.embeds).filter(([k]) => used.has(k)))}; };
  // `recipients`: sent at once, to them (Send Document).
  const save = (recipients) => {
    let saved;
    if(existing){ saved = {...existing, ...draft()}; hub.setDocuments(ds => ds.map(x => x.id === existing.id ? saved : x)); }
    else {
      saved = {...draft(), id:docId('doc'), number:documentNumber(hub.documents), status:'draft', createdAt:new Date(), createdBy:CURRENT_USER.name};
      hub.setDocuments(ds => [...ds, saved]);
      if(saved.recordId != null) hub.add(saved.object, saved.recordId, {type:'document', status:'draft', title:`${saved.number} · ${saved.title}`, documentId:saved.id, source:'you', by:null});
    }
    if(recipients) sendDocumentVia(hub, saved, recipients); else hub.toast(existing ? 'Document saved' : `Document ${saved.number} saved as draft`);
    onClose(saved);
  };
  // An element configured in its panel: kept by id; a new one goes where the cursor was (once its data is in).
  const saveEmbed = (data) => {
    const {id:eid, kind, isNew} = editing;
    setD(x => ({...x, embeds:{...x.embeds, [eid]:{kind, ...data}}}));
    setEditing(null);
    if(isNew && insertRef.current){ const insert = insertRef.current; setTimeout(() => insert(`<div data-embed="${kind}" data-id="${eid}"></div><p><br></p>`), 0); }
  };
  // Record Info: its text where the cursor was; the first one's record is the document's (without one of its own).
  const addRecordInfo = ({object:o, recordId, fields}) => {
    const insert = insertRef.current; setEditing(null);
    if(!target) setLinked({object:o, id:recordId});
    if(insert) setTimeout(() => insert(recordInfoText(fields)), 0);
  };
  const tools = ({insert, keep}) => [['record', 'Add Record Info', 'contacts'], ['payment', 'Add Payment Plan', 'coins'], ['signature', 'Add Signature', 'edit']].map(([kind, label, icon]) => (
    <button key={kind} type="button" onMouseDown={e=>{ e.preventDefault(); keep(); }} onClick={()=>{ insertRef.current = insert; setEditing({kind, id:docId({record:'ri', payment:'pt', signature:'sg'}[kind]), isNew:true}); }}
      style={{...btnSecondarySm, height:26, padding:'0 10px'}}><Icon name={icon} size={12} color={T.gray600}/> {label}</button>
  ));
  const preview = {...draft(), number: existing ? existing.number : documentNumber(hub.documents, true), createdAt: existing ? existing.createdAt : new Date(), status:'draft'};
  const editingData = editing && d.embeds[editing.id];
  // A new signature starts with the record's person — the first one only.
  const firstSigner = signers.length ? {name:'', email:''} : personOf(target);
  return (
    <CreatePanelFrame title={existing ? 'Edit Document' : 'Add Document'} onClose={()=>onClose()} placement={placement} width={DOC_PANEL_W} flush
      actions={<>
        <StSecondary label="Cancel" onClick={()=>onClose()}/>
        <StSecondary label={existing ? 'Save Changes' : 'Save as Draft'} disabled={!ok} onClick={()=>ok && save()}/>
        <StCta label="Send Document" disabled={!ok} onClick={()=>ok && setSending(true)}/>
      </>}>
      <div style={{flex:1, minWidth:0, minHeight:0, display:'flex', flexDirection:'column'}}>
        {/* The document's name (the file's, not on the page). */}
        <div style={{padding:'12px 20px', borderBottom:`1px solid ${T.border}`, flexShrink:0}}>
          <input autoFocus value={d.title} onChange={e=>setD(x => ({...x, title:e.target.value}))} placeholder="Document name" aria-label="Document name"
            style={{...fieldText, fontSize:14, fontWeight:600}}/>
        </div>
        {/* The toolbar, above the page (the editor's). */}
        <div ref={setToolbarEl} style={{padding:'4px 16px', borderBottom:`1px solid ${T.border}`, background:'#fff', flexShrink:0, minHeight:34, display:'flex', alignItems:'center'}}/>
        {/* The page: the document as it reads, written in place. */}
        <div style={{flex:1, minHeight:0, overflowY:'auto', background:T.headerBg, padding:'24px 20px'}}>
          <div style={{maxWidth:DOC_PAGE_W, margin:'0 auto'}}>
            <DocumentSheet doc={preview} brand={brand}
              body={<RichTextEditor page sizes images embeds={embeds} tools={tools} toolbarTarget={toolbarEl} value={d.body} onChange={(v)=>setD(x => ({...x, body:v}))}
                minHeight={380} placeholder="Start writing…" ariaLabel="Document"/>}/>
          </div>
        </div>
      </div>
      {editing && editing.kind === 'payment' && <PaymentStructurePanel zIndex={95} heading={editing.isNew ? 'Add Payment Plan' : 'Edit Payment Plan'} signedLabel="Document Signed"
        initial={editingData ? planOf((({kind, ...p}) => p)(editingData)) : newPaymentPlan({issue:{type:'signed'}})}
        onCancel={()=>setEditing(null)} onSave={(def)=>saveEmbed(def)}/>}
      {editing && editing.kind === 'record' && <RecordInfoModal defaultRecord={target} onCancel={()=>setEditing(null)} onSave={addRecordInfo}/>}
      {editing && editing.kind === 'signature' && <SignatureModal isNew={editing.isNew} initial={editingData || firstSigner} onCancel={()=>setEditing(null)} onSave={saveEmbed}/>}
      {sending && <SendDocumentModal doc={preview} initial={personOf(target)} onCancel={()=>setSending(false)} onSend={(recipients)=>{ setSending(false); save(recipients); }}/>}
    </CreatePanelFrame>
  );
}

/* ── A record's Documents tab ── its documents on the left, the selected one on the right (as Quotes). */
function DocumentNavItem({d, selected, onSelect}){
  const [h, setH] = React.useState(false);
  return (
    <div onClick={onSelect} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{padding:'10px 20px', cursor:'pointer', background: selected ? '#F4F5F7' : h ? T.headerBg : 'transparent', display:'flex', flexDirection:'column', gap:4}}>
      <div style={{display:'flex', alignItems:'center', gap:8}}>
        <span style={{fontSize:12, color:T.attioMuted, fontVariantNumeric:'tabular-nums'}}>{d.number}</span>
        <DocumentStatusPill status={d.status}/>
        <span style={{flex:1}}/>
        <span style={{fontSize:12, color:T.attioMuted}}>{fmtQuoteDate(d.sentAt || d.createdAt)}</span>
      </div>
      <div style={{display:'flex', alignItems:'baseline', gap:8}}>
        <span style={{flex:1, minWidth:0, fontSize:13, fontWeight:500, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{d.title}</span>
        {d.status === 'sent' && documentSigners(d).length > 0 && <span style={{fontSize:12.5, color:T.attioMuted, whiteSpace:'nowrap'}}>{signProgress(d)}</span>}
      </div>
    </div>
  );
}
// The detail's line under the head: number, maker, and the signing (who's signed, or when it was).
const documentHeadText = (d) => `${d.number} · created by ${d.createdBy}${d.status === 'signed' ? ` · signed ${fmtQuoteDate(d.signedAt)}` : d.status === 'sent' && documentSigners(d).length ? ` · ${signProgress(d)}` : ''}`;
function RecordDocumentsTab({contact}){
  const hub = useRecordHub(), ra = useRecordAccess();
  const object = ra ? ra.object : 'contacts', record = ra ? ra.record : contact;
  const can = (action) => !ra || toolCan(object, record, 'documents', action);
  const list = (hub.documents || []).filter(d => d.object === object && String(d.recordId) === String(record.id)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const [selectedId, setSelectedId] = React.useState(null);
  const [deleting, setDeleting] = React.useState(null);
  const [builder, setBuilder] = React.useState(null);   // {mode:'new'} | {mode:'edit', id}: the builder over this tab
  const [sending, setSending] = React.useState(null);   // the draft being sent (Send Document)
  const selected = list.find(d => d.id === selectedId) || list[0] || null;
  const actions = selected ? documentActions(hub, selected, {onDelete:setDeleting, onEdit:(did)=>setBuilder({mode:'edit', id:did}), onSend:setSending}).filter(it => /^Delete/.test(it.label) ? can('delete') : /^Edit/.test(it.label) ? can('edit') : true) : [];
  return (
    <div style={{flex:1, minHeight:0, display:'flex', flexDirection:'column'}}>
      <div style={{display:'flex', alignItems:'center', gap:10, padding:'12px 20px', borderBottom:`1px solid ${T.border}`, flexShrink:0}}>
        <span style={{fontSize:13, color:T.attioMuted}}>{plural(list.length, 'document')}</span>
        <div style={{flex:1}}/>
        {can('create') && <button onClick={()=>setBuilder({mode:'new'})} style={{...btnPrimarySm(), display:'inline-flex', alignItems:'center', gap:6}}><Icon name="plus" size={13} color="#fff"/> Add Document</button>}
      </div>
      <div style={{flex:1, minHeight:0, display:'flex', overflow:'hidden', position:'relative'}}>
        <div style={{width:380, flexShrink:0, overflowY:'auto', borderRight:`1px solid ${T.border}`, padding:'8px 0'}}>
          {list.map(d => <DocumentNavItem key={d.id} d={d} selected={selected && selected.id === d.id} onSelect={()=>setSelectedId(d.id)}/>)}
          {!list.length && <EmptyState compact title="No documents yet"/>}
        </div>
        <div style={{flex:1, minWidth:0, minHeight:0, display:'flex', flexDirection:'column'}}>
          {selected && (
            <DetailFrame head={<span style={{fontSize:13, color:T.attioMuted}}>{documentHeadText(selected)}</span>}
              actions={<>{selected.status === 'draft' && can('edit') && headerBtn('Edit', ()=>setBuilder({mode:'edit', id:selected.id}))}
                {selected.status === 'draft' && <button onClick={()=>setSending(selected)} style={btnPrimarySm()}>Send</button>}
                {actions.some(it => !/^(Edit|Send)/.test(it.label)) && <DetailMoreMenu items={actions.filter(it => !/^(Edit|Send)/.test(it.label))}/>}</>}>
              <DocumentView doc={selected}/>
            </DetailFrame>
          )}
        </div>
        {builder && <DocumentBuilder key={builder.id || 'new'} {...(builder.mode === 'new' ? {mode:'new', object, id:record.id} : builder)}
          onClose={(saved)=>{ setBuilder(null); if(saved) setSelectedId(saved.id); }}/>}
      </div>
      {deleting && <DeleteDocumentModal doc={deleting} onCancel={()=>setDeleting(null)} onDeleted={()=>{ setDeleting(null); setSelectedId(null); }}/>}
      {sending && <SendDocumentModal doc={sending} initial={hubRecordPerson(hub, sending.object, sending.recordId)} onCancel={()=>setSending(null)}
        onSend={(recipients)=>{ sendDocumentVia(hub, sending, recipients); setSending(null); }}/>}
    </div>
  );
}

// A document activity opened from the Activity feed: the document (if it still exists).
function DocumentActivityDetail({a, contact}){
  const hub = useRecordHub();
  const d = hub && (hub.documents || []).find(x => x.id === a.documentId);
  return (
    <DetailFrame head={activityHead(a, contact)}>
      {d ? <DocumentView doc={d}/> : <div style={{fontSize:13, color:T.attioMuted}}>This document was deleted.</div>}
    </DetailFrame>
  );
}

/* ── Tools → Documents ── every document in the workspace (as Tools → Quotes). */
const DOCUMENT_COLUMNS = [
  {key:'number', label:'Document', width:150}, {key:'title', label:'Title', width:260}, {key:'recordName', label:'Record', width:200}, {key:'objectLabel', label:'Record Type', width:130},
  {key:'recipientName', label:'Recipient', width:180}, {key:'statusLabel', label:'Status', width:130}, {key:'createdText', label:'Created', width:140}, {key:'createdBy', label:'Created By', width:160},
];
function DocumentsPage(){
  const hub = useRecordHub();
  const [openId, setOpenId] = React.useState(null);
  const [builder, setBuilder] = React.useState(null);   // {mode:'new'} | {mode:'edit', id}
  const [deleting, setDeleting] = React.useState(null);
  const [sending, setSending] = React.useState(null);   // the draft being sent (Send Document)
  const docs = hub.documents || [];
  const rows = docs.map(d => { const r = docRecordOf(hub, d); return {...d, recordName:r ? r.name : '—', objectLabel:d.object ? HUB_NOUN[d.object] : '',
    recipientName:(d.recipients || []).map(r => r.name).join(', ') || (d.recipient ? d.recipient.name : ''), statusLabel:DOCUMENT_STATUS[d.status].label, createdText:fmtQuoteDate(d.createdAt)}; });
  const open = docs.find(d => d.id === openId) || null;
  const edit = (did) => { setOpenId(null); setBuilder({mode:'edit', id:did}); };
  // Bulk Actions: Delete (as a document's Delete).
  const docBulk = useTableBulkDelete({rows:docs, noun:'document', canDelete:(d) => d.status !== 'signed', skipNote:'already signed',
    remove:(ids) => { hub.setDocuments(ds => ds.filter(d => !ids.includes(d.id))); if(ids.includes(openId)) setOpenId(null); }, onDone:(n) => hub.toast(`${bulkPlural(n, 'document')} deleted`)});
  const schema = {
    properties:DOCUMENT_COLUMNS, noun:'document', searchKeys:['number', 'title', 'recordName', 'recipientName'], canCreateProperty:false, bulkActions:docBulk.bulkActions,
    filterProps:[{key:'statusLabel', label:'Status', type:'select'}, {key:'objectLabel', label:'Record Type', type:'select'}, {key:'createdBy', label:'Created By', type:'select'}],
    selectValues:{statusLabel:['Draft', 'Sent', 'Signed'], objectLabel:['Contact', 'Deal', 'Customer'], createdBy:[...new Set(docs.map(d => d.createdBy).filter(Boolean))]},
    renderCell:(key, r) => key === 'number' ? <ContactName name={r.number} onOpen={()=>setOpenId(r.id)} style={{fontSize:'inherit', fontWeight:500}}/>
      : key === 'recordName' && r.recordName !== '—' ? <HubRecordLink object={r.object} id={r.recordId} name={r.recordName}/>
      : key === 'statusLabel' ? <DocumentStatusPill status={r.status}/> : undefined,
    renderActions:(r) => <RowActionsMenu title="Document Actions" width={MENU_W} items={[{label:'View Document', onClick:()=>setOpenId(r.id)}, ...documentActions(hub, docs.find(d => d.id === r.id), {onDelete:setDeleting, onEdit:edit, onSend:setSending})]}/>,
  };
  return (
    <div style={{flex:1, minWidth:0, minHeight:0, display:'flex', flexDirection:'column', position:'relative', overflow:'hidden'}}>
      <RecordViewsModule inset="page" schema={schema} rows={rows} columns={DOCUMENT_COLUMNS.map(c => c.key)}
        defaultViews={[{id:'docv-all', name:'All Documents', sort:{key:'number', dir:'desc'}},
          {id:'docv-draft', name:'Drafts', filters:{nodes:[{id:'f-docd', kind:'row', joinOp:'AND', prop:'statusLabel', op:'is', value:'Draft', value2:'', values:[]}]}},
          {id:'docv-sent', name:'Sent', filters:{nodes:[{id:'f-docs', kind:'row', joinOp:'AND', prop:'statusLabel', op:'is', value:'Sent', value2:'', values:[]}]}}]}
        actions={() => <button onClick={()=>{ setOpenId(null); setBuilder({mode:'new'}); }} title="Add Document" aria-label="Add Document" style={toolbarIconButton}><Icon name="plus" size={14} color={T.gray800}/></button>}
        overlay={builder ? <DocumentBuilder key={builder.id || 'new'} {...builder} onClose={(saved)=>{ setBuilder(null); if(saved) setOpenId(saved.id); }}/>
          : open && <PageSidePanel title={open.number} onClose={()=>setOpenId(null)} menuItems={documentActions(hub, open, {onDelete:setDeleting, onEdit:edit, onSend:setSending})}>
            <div style={{flex:1, overflowY:'auto', padding:'4px 20px 24px'}}><DocumentView doc={open}/></div>
          </PageSidePanel>}/>
      {docBulk.bulkModal}
      {deleting && <DeleteDocumentModal doc={deleting} onCancel={()=>setDeleting(null)} onDeleted={()=>{ if(openId === deleting.id) setOpenId(null); setDeleting(null); }}/>}
      {sending && <SendDocumentModal doc={sending} initial={sending.recordId != null && sending.object ? hubRecordPerson(hub, sending.object, sending.recordId) : null} onCancel={()=>setSending(null)}
        onSend={(recipients)=>{ sendDocumentVia(hub, sending, recipients); setSending(null); }}/>}
    </div>
  );
}

/* ── Signing ── #s~<CRM branch>~<document>~<signature>: the document alone, for the signer, signed
   in or not. A signature is left in the branch's signing inbox (store.jsx DB), taken in by the app
   (DocumentSignInbox) — while it's open (the storage event, or a check every few seconds with
   SQLite), else when it next opens. */
const SIGN_INBOX_KEY = (crmId) => `hof-erp-sign-inbox:${crmId}`;
const documentSignRoute = (hash) => { const m = /^#s~([A-Za-z0-9._-]+)~([A-Za-z0-9._-]+)~([A-Za-z0-9._-]+)$/.exec(hash || ''); return m ? {crmId:m[1], docId:m[2], sigId:m[3]} : null; };
const readSignInbox = (crmId) => { try { return JSON.parse(DB.fresh(SIGN_INBOX_KEY(crmId)) || '[]') || []; } catch(e){ return []; } };
const writeSignInbox = (crmId, list) => { try { DB.setItem(SIGN_INBOX_KEY(crmId), JSON.stringify(list)); DB.flush(); return true; } catch(e){ return false; } };
function PublicSignPage({route}){
  // The document as the branch last saved it, in the brand it went out with.
  const found = React.useMemo(() => {
    if(!ORG_REGISTRY.crm.some(c => c.id === route.crmId)) return null;
    let saved = null; try { const raw = DB.getItem(crmStoreKey(route.crmId)); saved = raw ? JSON.parse(raw) : null; } catch(e){}
    const raw = saved && (saved.documents || []).find(x => x.id === route.docId);
    if(!raw) return null;
    const doc = upgradeDocument(raw), b = (doc.brandId && (saved.quoteBrands || {})[doc.brandId]) || crmBrandOf(route.crmId);
    return {doc, brand:{...b, colors:{...DEFAULT_BRAND(), ...(b.colors || {})}}};
  }, []);
  const doc = found && found.doc, sig = doc && (doc.embeds || {})[route.sigId];
  const [name, setName] = React.useState(sig ? sig.name : '');
  const [done, setDone] = React.useState(null);   // {name, at}: signed here
  const [failed, setFailed] = React.useState(false);
  const waiting = React.useMemo(() => readSignInbox(route.crmId).find(r => r.docId === route.docId && r.sigId === route.sigId) || null, [done]);
  const signedBy = done || (sig && sig.signedAt ? {name:sig.signedName, at:sig.signedAt} : waiting);
  const open = !!sig && doc.status === 'sent' && documentSigners(doc).some(s => s.id === route.sigId);
  const shown = doc && sig && signedBy ? {...doc, embeds:{...doc.embeds, [route.sigId]:{...sig, signedAt:signedBy.at, signedName:signedBy.name}}} : doc;
  const sign = () => { const n = name.trim(); if(!n) return; const at = new Date().toISOString();
    if(writeSignInbox(route.crmId, [...readSignInbox(route.crmId), {id:docId('sgn'), docId:route.docId, sigId:route.sigId, name:n, at}])) setDone({name:n, at}); else setFailed(true); };
  const bar = {background:'#fff', border:`1px solid ${T.border}`, borderRadius:12, padding:'14px 16px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', fontSize:13, color:T.attioText};
  return (
    <div style={{minHeight:'100%', background:T.headerBg, padding:'32px 16px', boxSizing:'border-box', overflowY:'auto'}}>
      <div style={{maxWidth:DOC_PAGE_W, margin:'0 auto', display:'flex', flexDirection:'column', gap:12}}>
        {!doc || !sig ? <div style={{...bar, flexDirection:'column', textAlign:'center', padding:'28px 16px'}}>
            <div style={{fontSize:16, fontWeight:600}}>This document isn’t available</div>
            <div style={{color:T.attioMuted}}>The link may be wrong, or the document was deleted.</div></div>
          : <>
            <div style={bar}>
              {signedBy ? <span>Signed by <b>{signedBy.name}</b> on {fmtQuoteDate(signedBy.at)}. Thank you.</span>
                : !open ? <span>This document isn’t open for signing.</span>
                : <>
                  <span style={{flex:'1 1 220px', minWidth:0}}>Signing as <b>{sig.name}</b> · {sig.email}</span>
                  <input value={name} onChange={e=>setName(e.target.value)} placeholder="Type your full name" aria-label="Your full name" style={{...fieldText, flex:'0 1 240px', minWidth:0}}/>
                  <StCta label="Sign" disabled={!name.trim()} onClick={sign}/>
                  {failed && <span style={{flex:'1 1 100%', fontSize:12.5, color:T.red}}>Your signature couldn’t be saved. Please try again.</span>}
                </>}
            </div>
            <DocumentSheet doc={shown} brand={found.brand}
              body={<DocumentBodyView doc={shown} brand={found.brand} mine={route.sigId}/>}/>
          </>}
      </div>
    </div>
  );
}
/* A document signed by everyone: each payment plan in it becomes a Payment Plan on its record (once
   each — `documentId` and the element's id), on the record that holds its plans, dated from the
   signing; with no record, none. Its invoices due by then are issued at once (invoices.jsx). */
function plansFromDocument(hub, d){
  const rec = d.recordId != null && d.object ? hubRecord(hub, d.object, d.recordId) : null;
  if(!rec) return;
  const h = termsHolderOf(d.object, rec), signedOn = dayOf(d.signedAt);
  let list = hub.accounting || [];
  const made = bodyEmbeds(d.body).filter(e => e.kind === 'payment').map(e => ({eid:e.id, data:(d.embeds || {})[e.id]})).filter(x => x.data)
    .filter(x => !list.some(s => s.documentId === d.id && s.embedId === x.eid)).map(({eid, data}) => {
      const plan = normalizePlan(planOf((({kind, ...p}) => p)(data)));
      if(!(Number(plan.amount) > 0)) return null;
      const id = acId('ps'), dated = (plan.issue || {}).type === 'signed' ? signedOn : '';
      const installments = planSchedule(plan, {id, signedOn:dated});
      const s = {id, number:nextPlanNumber(list), source:'document', documentId:d.id, documentNumber:d.number, embedId:eid, object:h.object, recordId:h.id, createdAt:new Date(), createdBy:'System',
        paymentType:plan.paymentType, currency:plan.currency, total:Math.round(installments.reduce((a, x) => a + x.amount, 0) * 100) / 100, plan, ...(dated ? {signedOn:dated} : {}), installments, revision:1};
      list = [...list, s];
      return s;
    }).filter(Boolean);
  if(!made.length) return;
  hub.setAccounting(all => [...all, ...made.filter(s => !all.some(x => x.documentId === d.id && x.embedId === s.embedId))]);
  made.forEach(s => hub.add(s.object, s.recordId, {type:'payment', action:'Payment plan created', detail:`${planTitle(s)} · from ${d.number}`, source:'you', by:'System'}));
}
/* The app's side of the inbox: each signature (once) fills its signer's area; a document whose
   areas are all signed is Signed — its payment plans become Payment Plans. Each goes on the
   record's activity, by the signer. */
function DocumentSignInbox(){
  const hub = useRecordHub();
  const live = React.useRef(hub); live.current = hub;
  React.useEffect(() => {
    const crmId = ACTIVE_CRM.id;
    const take = () => {
      if(DB.isStale()) return;   // a tab whose data is out of date leaves them to the current one
      const pending = readSignInbox(crmId);
      if(!pending.length) return;
      const hub = live.current, docs = hub.documents || [];
      // Taken once each; one for a document this tab doesn't have (yet) stays.
      writeSignInbox(crmId, pending.filter(r => !docs.some(d => d.id === r.docId)));
      const next = {};
      pending.forEach(r => {
        const d = next[r.docId] || docs.find(x => x.id === r.docId), sig = d && (d.embeds || {})[r.sigId];
        if(!d || !sig || sig.signedAt || d.status !== 'sent') return;
        next[d.id] = {...d, embeds:{...d.embeds, [r.sigId]:{...sig, signedAt:r.at, signedName:r.name}}};
        if(d.recordId != null && d.object) hub.add(d.object, d.recordId, {type:'document', status:'signed', title:`${d.number} · ${d.title} signed by ${r.name}`, documentId:d.id, source:'other', by:r.name, at:new Date(r.at)});
        if(hub.toast) hub.toast(`${d.number} signed by ${r.name}`);
      });
      Object.values(next).forEach(d => { const all = documentSigners(d);
        if(all.length && all.every(s => s.signedAt)) next[d.id] = {...d, status:'signed', signedAt:ymdOf(new Date(all.reduce((mx, s) => Math.max(mx, new Date(s.signedAt).getTime()), 0)))}; });
      if(Object.keys(next).length) hub.setDocuments(ds => ds.map(d => next[d.id] || d));
      Object.values(next).filter(d => d.status === 'signed').forEach(d => plansFromDocument(hub, d));
    };
    take();
    const onStorage = (e) => { if(e.key === SIGN_INBOX_KEY(crmId)) take(); };
    window.addEventListener('storage', onStorage);
    const poll = DB.sqlite ? setInterval(take, 4000) : null;
    return () => { window.removeEventListener('storage', onStorage); if(poll) clearInterval(poll); };
  }, []);
  return null;
}

Object.assign(window, {DOCUMENT_STATUS, documentNumber, upgradeDocument, DocumentView, DocumentBuilder, RecordDocumentsTab, DocumentActivityDetail, DocumentsPage, sendDocumentVia,
  documentSignRoute, PublicSignPage, DocumentSignInbox, plansFromDocument});
