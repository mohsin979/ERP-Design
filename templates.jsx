/* HOF Pulse ERP — Settings → Templates: Email Templates, Email Sequences, Quote Templates,
   Playbooks (playbooks.jsx) and Services (services.jsx — the service catalog, moved here from the
   CRM navigation).

   Foundational for now (to be refined later):
     Email Templates — reusable emails: Email Template Name, Subject and Email Format — Simple
       Text Body, Default HTML Template or Custom HTML Template (emails.jsx: the formats, the
       sender's signature, Fetch Property, the preview) — with a live preview beside the fields
       ({{first_name}} and the fetched properties are filled in for the recipient). Used by the
       email composer (emails.jsx), sequences and workflows. Assign Template (2026-11-16; the
       shared picker, usersTeams.jsx AssignPeopleModal — offered as a template is created, and in
       its menus after): the teams and users who may pick it when writing an email, with whoever
       made it; one assigned to no one is everyone's (templateUsable).
     Email Sequences — a named, ordered list of templates, each sent a set time after the one
       before, as its template is (subject, format, content, signature). Used by workflows'
       Enroll in Email Sequence ("Choose email sequence template"). Its panel is the wide email
       panel: each email has its template, Edit Email — the sequence's own copy of that email,
       the template untouched — and When: After Days (days, weeks or months after the email
       before it) or Specific Date (a record enrolled after that date isn't sent that email).
       Clone Sequence (its menus) copies one. Enrolled (2026-11-16): the
       records with emails of the sequence still scheduled — each with how many have been sent
       and how many are left, and Exit, which cancels the ones left (as Exit Email Sequence).
     Quote Templates — a configured quote (quotes.jsx): its services and milestones, payment
       terms, discount and VAT, and terms; each has a code (QT-001…). Created here (the quote
       builder's Services and Payment Terms fields) or from a quote (Save as template); listed,
       viewed — as the quotation it makes, on the letterhead, with sample details — renamed and
       deleted here.
   Email templates and sequences are created, viewed, edited and deleted here; a template or sequence a workflow (or a
   sequence) uses can't be deleted until it's no longer used, so nothing that runs loses its email.
   One shape for every tab: the tabs row (as Users & Teams), the list with its icon-only Add
   (StCta) opening the creation side panel (CreatePanelFrame, Field rows), and a detail panel
   (DetailPanel: title, separator, label | value fields, the content). */

/* Each tab is a kind of template with its own permissions (Edit Permissions → Templates): a tab
   shows to those who may view some of its items, and each item's actions follow View / Create /
   Edit / Delete by who created it (items made before creators were recorded are no one's). */
const TEMPLATE_TABS = [{id:'templates', label:'Email Templates', icon:'envelope', kind:'emailTemplates'}, {id:'sequences', label:'Email Sequences', icon:'listBullets', kind:'emailSequences'},
  {id:'quoteTemplates', label:'Quote Templates', icon:'quote', kind:'quoteTemplates'}, {id:'playbooks', label:'Playbooks', icon:'playbook', kind:'playbooks'},
  {id:'services', label:'Services', icon:'services', kind:'services'}];
const SEQUENCE_UNITS = ['Days', 'Weeks', 'Months'];
const SEQUENCE_WHEN = [{value:'after', label:'After Days'}, {value:'date', label:'Specific Date'}];
// Where a template or sequence is used: workflows (any of their settings) and, for templates, sequences.
// A workflow's current version only — one it was used in before (its version history) doesn't count.
const usedInWorkflows = (data, id) => (data.workflows || []).filter(w => { const {history, ...now} = w; return JSON.stringify(now).includes(`"${id}"`); });

/* Who may pick an email template when writing an email (decided 2026-11-16): everyone while it's
   assigned to no one; once assigned, the people it's assigned to and whoever made it. */
const templateUsable = (t, data) => { if(assignmentEmpty(t.assignedTo)) return true;
  const me = (data.users || []).find(u => u.name === CURRENT_USER.name);
  return creatorOf(t) === CURRENT_USER.name || (!!me && assignedUserIds(t.assignedTo, data).includes(me.id)); };
/* Every sequence's active enrollments, by sequence: the records with emails of it still scheduled
   — {object, record, sent, left}. Sent: the enrollment's own emails that have gone (`enrollId`,
   workflowEngine.jsx sendEmails); for one made before enrollments were marked, the sequence's
   length less what's left. */
function sequenceEnrollments(hub, sequences){
  const out = {};
  if(!hub) return out;
  hubObjects().forEach(object => Object.entries((hub.activities || {})[object] || {}).forEach(([rid, acts]) => {
    const bySeq = {};
    (acts || []).forEach(a => { if(a.type === 'email' && a.sequenceId) (bySeq[a.sequenceId] = bySeq[a.sequenceId] || []).push(a); });
    Object.entries(bySeq).forEach(([sid, mine]) => {
      const left = mine.filter(a => a.status === 'scheduled');
      const seq = left.length && sequences.find(q => q.id === sid), record = seq && (hub.records[object] || []).find(r => String(r.id) === String(rid));
      if(!record) return;
      const eid = left[0].enrollId, sent = eid ? mine.filter(a => a.enrollId === eid && a.status !== 'scheduled').length : Math.max(0, seq.emails.length - left.length);
      (out[sid] = out[sid] || []).push({object, record, sent, left:left.length});
    });
  }));
  return out;
}
/* The Enrolled cell: how many, opening the list — each record (its name opens it), how far its
   enrollment has got, and Exit. */
function EnrolledMenu({list, onOpen, onExit}){
  const width = 340;
  const [pos, setPos] = React.useState(null);
  const z = useFloatZ(!!pos);
  const btnRef = React.useRef(null), menuRef = React.useRef(null);
  const close = () => setPos(null);
  const open = () => { const r = btnRef.current.getBoundingClientRect(), height = Math.min(list.length, 6) * 52 + 14;
    setPos({top: window.innerHeight - r.bottom < height + 8 ? Math.max(8, r.top - height - 4) : r.bottom + 4, left:Math.max(8, Math.min(r.left, window.innerWidth - width - 8))}); };
  React.useEffect(() => {
    if(!pos) return;
    const onDown = (e) => { if(menuRef.current && !menuRef.current.contains(e.target) && !btnRef.current.contains(e.target)) close(); };
    const onKey = (e) => { if(e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey); window.addEventListener('resize', close);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); window.removeEventListener('resize', close); };
  }, [pos]);
  if(!list.length) return <span style={{color:T.attioMuted, fontVariantNumeric:'tabular-nums'}}>0</span>;
  return (
    <div onMouseDown={e=>e.stopPropagation()} style={{display:'flex'}}>
      <button ref={btnRef} type="button" title="Enrolled" aria-expanded={!!pos} onClick={e=>{ e.stopPropagation(); pos ? close() : open(); }}
        style={{display:'inline-flex', alignItems:'center', gap:6, height:26, padding:'0 8px', borderRadius:8, border:`1px solid ${T.borderStrong}`, background: pos ? T.headerBg : '#fff',
          fontSize:13, color:T.attioText, cursor:'pointer', fontFamily:'inherit', fontVariantNumeric:'tabular-nums'}}>
        {list.length}<Icon name="chevDown" size={T.chevronSize} color={T.gray600} style={{transform: pos ? 'rotate(180deg)' : 'none'}}/>
      </button>
      {pos && ReactDOM.createPortal(
        <div ref={menuRef} onMouseDown={e=>e.stopPropagation()} style={{position:'fixed', top:pos.top, left:pos.left, width, zIndex:z, maxHeight:326, overflowY:'auto',
          background:'#fff', border:`1px solid ${T.border}`, borderRadius:10, padding:6, boxShadow:'0 4px 16px rgba(16,24,40,.12)', fontWeight:400, textAlign:'left'}}>
          {list.map(e => (
            <div key={`${e.object}:${e.record.id}`} style={{display:'flex', alignItems:'center', gap:10, padding:'7px 8px', borderRadius:6}}>
              <div style={{flex:1, minWidth:0}}>
                <ContactName name={e.record.name || '—'} onOpen={()=>{ close(); onOpen(e); }} style={{fontSize:13, fontWeight:500}}/>
                <div style={{fontSize:12, color:T.attioMuted, whiteSpace:'nowrap', fontVariantNumeric:'tabular-nums'}}>{e.sent} of {e.sent + e.left} sent · {e.left} left</div>
              </div>
              <button type="button" onClick={()=>{ close(); onExit(e); }} style={{...btnSecondarySm, height:26, padding:'0 10px'}}>Exit</button>
            </div>
          ))}
        </div>, document.body)}
    </div>
  );
}

/* Sample enrollments (the sample CRM; added once, with the sample sequences — app.jsx): a few
   records part-way through a sequence. Each is the sequence's emails as an enrollment makes them
   (workflowEngine.jsx sendEmails): the first ones sent, the rest scheduled ahead.
   → {contacts, deals, customers}: {record id: its emails}. */
function sampleSequenceEnrollments(records, data){
  const DAY = 86400000, now = Date.now();
  const pick = (object, i, ok) => (records[object] || []).filter(r => EMAIL_ADDRESS.test(String(r.email || '').trim()) && (!ok || ok(r)))[i];
  const owes = (r) => !!extendedValueText('acc:nextPaymentAmount', r);   // Payment Follow-up: records with a payment still to come
  // [sequence, record type, which record (among those with an email address), how many emails have gone]
  const plan = [['es-onboarding', 'customers', 0, 1], ['es-onboarding', 'customers', 1, 2], ['es-onboarding', 'customers', 2, 0], ['es-payment', 'deals', 0, 1, owes], ['es-payment', 'deals', 1, 0, owes],
    ['es-documents', 'contacts', 0, 2], ['es-documents', 'contacts', 1, 1], ['es-consultation', 'deals', 2, 1]];
  const out = {contacts:{}, deals:{}, customers:{}};
  plan.forEach(([seqId, object, index, gone, ok], n) => {
    const seq = emailSequencesOf(data).find(q => q.id === seqId), record = pick(object, index, ok);
    if(!seq || !record) return;
    const owner = userLabel(record.owner), person = {name:record.name || ''}, enrollId = `en-sample-${n}`, key = object === 'contacts' ? 'contactId' : object === 'deals' ? 'dealId' : 'customerId';
    out[object][record.id] = [...(out[object][record.id] || []), ...seq.emails.map((e, i) => {
      const tpl = emailTemplatesOf(data).find(t => t.id === e.templateId);
      if(!tpl) return null;
      const content = templateContentOf(tpl), sent = i < gone, at = new Date(sent ? now - (gone - i) * 2 * DAY : now + (i - gone + 1) * 3 * DAY);
      const html = fillEmailTokens(fillFirstName(emailHtmlOf(content, undefined, owner), person), {object, record, records, data});
      return {id:`${enrollId}-${i}`, [key]:record.id, type:'email', at, direction:'sent', title:fillFirstName(tpl.subject || tpl.name, person), body:emailTextOf({format:'custom', html}), html,
        ...(content.format === 'simple' && content.attachments.length ? {attachments:content.attachments} : {}), templateId:tpl.id, sequenceId:seq.id, enrollId, to:[String(record.email).trim()],
        status: sent ? 'sent' : 'scheduled', scheduledFor:at, source:'team', by:owner};
    }).filter(Boolean)];
  });
  return out;
}

// The creation panels' Cancel / Save pair.
const panelActions = (onCancel, label, ok, onSave) => <><StSecondary label="Cancel" onClick={onCancel}/><StCta label={label} disabled={!ok} onClick={()=>ok && onSave()}/></>;

/* New / Edit Email Template: Email Template Name, Subject, Email Format and its content on the
   left, the preview on the right (emails.jsx EmailSplit). */
function TemplateFormPanel({initial, onCancel, onSave}){
  const [name, setName] = React.useState((initial && initial.name) || '');
  const [subject, setSubject] = React.useState((initial && initial.subject) || '');
  const [content, setContent] = React.useState(() => initial ? templateContentOf(initial) : newEmailContent());
  const ok = !!name.trim() && !!subject.trim() && emailContentReady(content);
  const save = () => onSave({name:name.trim(), subject:subject.trim(), ...emailContentToSave(content)});
  return (
    <CreatePanelFrame title={initial ? 'Edit Email Template' : 'Add Email Template'} onClose={onCancel} width={EMAIL_PANEL_W} flush
      actions={panelActions(onCancel, initial ? 'Save Changes' : 'Add Email Template', ok, save)}>
      <EmailSplit form={<>
        <Field label="Email Template Name"><input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Document request" style={fieldText}/></Field>
        <Field label="Subject"><input value={subject} onChange={e=>setSubject(e.target.value)} style={fieldText}/></Field>
        <EmailContentFields value={content} setValue={setContent}/>
      </>} preview={<EmailPreview content={content} subject={subject}/>}/>
    </CreatePanelFrame>
  );
}

/* A sequence email's own copy (2026-11-16): Edit Email opens the email as the sequence will send
   it — its subject, format and content — and keeps the edit on that step only; the template
   stays as it is. The email panel's shape (TemplateFormPanel), without a name. */
function SequenceEmailPanel({initial, onCancel, onSave}){
  const [subject, setSubject] = React.useState(initial.subject || '');
  const [content, setContent] = React.useState(() => templateContentOf(initial));
  const ok = !!subject.trim() && emailContentReady(content);
  return (
    <CreatePanelFrame title="Edit Email" onClose={onCancel} width={EMAIL_PANEL_W} flush zIndex={90}
      actions={panelActions(onCancel, 'Save Changes', ok, ()=>onSave({subject:subject.trim(), ...emailContentToSave(content)}))}>
      <EmailSplit form={<>
        <Field label="Subject"><input autoFocus value={subject} onChange={e=>setSubject(e.target.value)} style={fieldText}/></Field>
        <EmailContentFields value={content} setValue={setContent}/>
      </>} preview={<EmailPreview content={content} subject={subject}/>}/>
    </CreatePanelFrame>
  );
}
/* A sequence's email as it goes out: its own copy where it has one (Edit Email), else its template. */
const sequenceEmailOf = (e, templates) => e.email || (templates || []).find(t => t.id === e.templateId) || null;
// When a sequence's email goes: "After 2 days" / "Then 1 week" / "On Nov 20, 2026".
const sequenceWhenLabel = (e, i) => e.when === 'date' ? `On ${fmtQuoteDate(e.date) || '—'}` : `${i === 0 ? 'After' : 'Then'} ${e.delay.amount} ${String(e.delay.unit).toLowerCase()}`;
/* Add / Edit Email Sequence — the wide panel (the email panel's): the name and the emails on the
   left, the chosen email as it reads on the right. Each email: its template, Edit Email (its own
   copy, above), and When — After Days (a number of days, weeks or months after the email before
   it) or Specific Date. */
function SequenceFormPanel({initial, templates, onCancel, onSave}){
  const [s, setS] = React.useState(() => ({name:(initial && initial.name) || '',
    emails:((initial && initial.emails) || [{templateId:'', delay:{amount:'1', unit:'Days'}}]).map((e, i) => ({key:`se-${i}-${Math.random().toString(36).slice(2, 6)}`, ...e, delay:{amount:'1', unit:'Days', ...e.delay}}))}));
  const [shown, setShown] = React.useState(() => s.emails[0].key);   // the email previewed
  const [editing, setEditing] = React.useState(null);                // the email being edited (its key)
  const setEmail = (i, p) => setS(x => ({...x, emails:x.emails.map((e, j) => j === i ? {...e, ...p} : e)}));
  const move = (i, d) => setS(x => { const n = x.emails.slice(); const [m] = n.splice(i, 1); n.splice(i + d, 0, m); return {...x, emails:n}; });
  const whenOk = (e) => e.when === 'date' ? /^\d{4}-\d{2}-\d{2}$/.test(e.date || '') : Number(e.delay.amount) >= 0 && e.delay.amount !== '';
  const ok = !!s.name.trim() && s.emails.length > 0 && s.emails.every(e => e.templateId && whenOk(e));
  const iconBtn = (icon, title, onClick, disabled) => <button type="button" title={title} disabled={disabled} onClick={onClick}
    style={{border:'none', background:'transparent', cursor: disabled ? 'default' : 'pointer', display:'flex', padding:4, opacity: disabled ? .35 : 1}}><Icon name={icon} size={13} color={T.gray600}/></button>;
  // Saved: an After Days email keeps no date, a Specific Date one its date (its delay stays, unused).
  const save = () => onSave({name:s.name.trim(), emails:s.emails.map(({key, date, when, ...e}) => when === 'date' ? {...e, when, date} : e)});
  const current = s.emails.find(e => e.key === shown) || s.emails[0], email = sequenceEmailOf(current, templates);
  const edited = s.emails.find(e => e.key === editing), editedEmail = edited && sequenceEmailOf(edited, templates);
  return (<>
    <CreatePanelFrame title={initial ? 'Edit Email Sequence' : 'Add Email Sequence'} onClose={onCancel} width={EMAIL_PANEL_W} flush
      actions={panelActions(onCancel, initial ? 'Save Changes' : 'Add Email Sequence', ok, save)}>
      <EmailSplit form={<>
      <Field label="Name"><input autoFocus value={s.name} onChange={e=>setS(x => ({...x, name:e.target.value}))} placeholder="e.g. New client onboarding" style={fieldText}/></Field>
      <Field label="Emails"><div style={{display:'flex', flexDirection:'column', gap:8, paddingTop:2}}>
        {s.emails.map((e, i) => (
          <div key={e.key} onMouseDown={()=>setShown(e.key)} style={{border:`1px solid ${e.key === current.key ? T.gray400 : T.attioLine}`, borderRadius:10, padding:10, display:'flex', flexDirection:'column', gap:8}}>
            <div style={{display:'flex', alignItems:'center', gap:6}}>
              <span style={{fontSize:12.5, fontWeight:600, color:T.attioText, flex:1}}>Email {i + 1}</span>
              {iconBtn('arrowUp', 'Move up', ()=>move(i, -1), i === 0)}
              {iconBtn('arrowDown', 'Move down', ()=>move(i, 1), i === s.emails.length - 1)}
              {iconBtn('trash', 'Remove email', ()=>setS(x => ({...x, emails:x.emails.filter((_, j) => j !== i)})), s.emails.length === 1)}
            </div>
            {/* Another template in its place: the email's own edits go with the old one. */}
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <div style={{flex:1, minWidth:0}}><FormSelect value={e.templateId} placeholder="Select email template" options={templates.map(t => ({value:t.id, label:t.name}))}
                onChange={(v)=>v !== e.templateId && setEmail(i, {templateId:v, email:undefined})}/></div>
              <StSecondary label="Edit Email" disabled={!sequenceEmailOf(e, templates)} onClick={()=>setEditing(e.key)}/>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <span style={{fontSize:12.5, color:T.gray600, whiteSpace:'nowrap'}}>When</span>
              <div style={{width:150}}><FormSelect value={e.when === 'date' ? 'date' : 'after'} options={SEQUENCE_WHEN} ariaLabel={`Email ${i + 1} when`}
                onChange={(v)=>v && setEmail(i, {when: v === 'date' ? 'date' : undefined})}/></div>
              {e.when === 'date' ? <div style={{width:180}}><DateField required value={e.date || ''} onChange={(v)=>setEmail(i, {date:v})} ariaLabel={`Email ${i + 1} date`}/></div> : <>
                <input value={e.delay.amount} onChange={ev=>setEmail(i, {delay:{...e.delay, amount:ev.target.value.replace(/[^0-9]/g, '')}})} inputMode="numeric" aria-label={`Email ${i + 1} delay`}
                  style={{...fieldText, width:80, fontVariantNumeric:'tabular-nums'}}/>
                {/* (A sequence saved in hours keeps them.) */}
                <div style={{width:130}}><FormSelect value={e.delay.unit} placeholder="Select unit" options={SEQUENCE_UNITS.includes(e.delay.unit) ? SEQUENCE_UNITS : [e.delay.unit, ...SEQUENCE_UNITS]}
                  onChange={(v)=>setEmail(i, {delay:{...e.delay, unit:v || 'Days'}})}/></div>
              </>}
            </div>
          </div>
        ))}
        <button type="button" onClick={()=>setS(x => ({...x, emails:[...x.emails, {key:`se-${Date.now().toString(36)}`, templateId:'', delay:{amount:'1', unit:'Days'}}]}))}
          style={{alignSelf:'flex-start', display:'inline-flex', alignItems:'center', gap:6, border:'none', background:'transparent', padding:'4px 0', fontSize:13, fontWeight:500, color:T.attioText, cursor:'pointer', fontFamily:'inherit'}}>
          <Icon name="plus" size={13} color={T.gray600}/> Add Email
        </button>
      </div></Field>
      </>} preview={email ? <EmailPreview content={templateContentOf(email)} subject={email.subject || email.name || ''}/> : null}/>
    </CreatePanelFrame>
    {edited && editedEmail && <SequenceEmailPanel key={edited.key} initial={{...editedEmail, subject:editedEmail.subject || editedEmail.name || ''}} onCancel={()=>setEditing(null)}
      onSave={(email)=>{ setS(x => ({...x, emails:x.emails.map(e => e.key === edited.key ? {...e, email} : e)})); setShown(edited.key); setEditing(null); }}/>}
  </>);
}

/* New quote template: a name (and its code), then the quote builder's Services and Payment Terms
   fields and the terms — in one panel, the builder's width. */
function QuoteTemplateFormPanel({templates, onCancel, onSave}){
  const [t, setT] = React.useState({name:'', title:'', items:[], payment:newPaymentPlan(), discount:{type:'percent', value:''}, vatRate:QUOTE_VAT_RATE, terms:'', currency:defaultCurrency()});
  const set = (p) => setT(x => ({...x, ...p}));
  const checks = quoteConfigChecks(t);
  const ok = !!t.name.trim() && checks.itemsOk && checks.discountOk && checks.paymentOk;
  const save = () => onSave({name:t.name.trim(), ...normalizeQuoteConfig(t), vatRate:t.vatRate, terms:t.terms, currency:t.currency});
  const divider = <div style={{borderTop:`1px solid ${T.border}`, margin:'4px -20px 0'}}/>;
  return (
    <CreatePanelFrame title="Add Quote Template" width={QUOTE_PANEL_W} onClose={onCancel} actions={panelActions(onCancel, 'Add Quote Template', ok, save)}>
      <div style={{display:'flex', flexDirection:'column', gap:16}}>
        {stack(<>
          <Field label="Name"><input autoFocus value={t.name} onChange={e=>set({name:e.target.value})} placeholder="e.g. US NIW Standard" style={fieldText}/></Field>
          <Field label="Code"><ReadValue>{nextTemplateCode(templates)}</ReadValue></Field>
        </>)}
        {divider}
        <span style={QUOTE_SECTION}>Services</span>
        <QuoteServicesFields q={t} set={set} checks={checks}/>
        {divider}
        <span style={QUOTE_SECTION}>Payment plan</span>
        <QuotePaymentFields q={t} set={set} checks={checks}/>
        {divider}
        <span style={QUOTE_SECTION}>Terms & conditions</span>
        <RichTextEditor value={t.terms} onChange={(v)=>set({terms:v})} minHeight={200} ariaLabel="Terms and conditions"/>
      </div>
    </CreatePanelFrame>
  );
}

/* A quote template as the quotation a customer would get (quotes.jsx QuoteDocument), with sample
   details where a quote has its own: who it's for, its record, number and dates. */
const sampleQuoteOf = (t) => ({...t, number:`Q-${new Date().getFullYear()}-0000`, title:t.title || t.name, object:'deals', recordId:null,
  sampleRecord:{name:'Sample Deal'}, recipient:{name:'Sample Client', email:'sample.client@email.com'}, createdAt:new Date(),
  validUntil:ymdOf(new Date(Date.now() + 30 * 86400000)), eSignature:true, status:'draft'});
/* Quote Templates: code, name, what it holds; New (the panel above), View (the quotation it makes, with sample details), Rename, Delete. */
function QuoteTemplatesTab({data, setData, say}){
  const can = (action, t) => templateCan('quoteTemplates', action, t);
  const all = quoteTemplatesOf(data), list = all.filter(t => can('view', t));
  const setList = (fn) => setData(d => ({...d, quoteTemplates:fn(quoteTemplatesOf(d))}));
  const [openId, setOpenId] = React.useState(null);
  const [creating, setCreating] = React.useState(false);
  const [renaming, setRenaming] = React.useState(null);   // {id, name}
  const [deleting, setDeleting] = React.useState(null);
  const open = list.find(t => t.id === openId) || null;
  const cols = [{key:'code', label:'Code', width:110}, {key:'name', label:'Template Name', width:240}, {key:'services', label:'Services', width:280},
    {key:'payment', label:'Payment Plan', width:180}, {key:'createdBy', label:'Created By', width:160}, {key:'created', label:'Created', width:150}];
  const rows = list.map(t => ({id:t.id, code:t.code, name:t.name, services:(t.items || []).map(it => it.name).join(', '), payment:PAYMENT_TYPE_LABEL[quotePlanOf(t).paymentType],
    createdBy:creatorOf(t), created:fmtQuoteDate(t.createdAt)}));
  const actions = (t) => [{label:'View Template', onClick:()=>setOpenId(t.id)}, ...(can('edit', t) ? [{label:'Rename Template', onClick:()=>setRenaming({id:t.id, name:t.name})}] : []),
    ...(can('delete', t) ? [{label:'Delete Template', danger:true, onClick:()=>setDeleting(t)}] : [])];
  // Bulk Actions → Delete, as the row's (the ones the person may delete).
  const qtBulk = useTableBulkDelete({rows, noun:'template', canDelete:(r) => can('delete', list.find(t => t.id === r.id)), skipNote:'not yours to delete',
    remove:(ids) => { setList(ts => ts.filter(t => !ids.includes(t.id))); if(ids.includes(openId)) setOpenId(null); }, onDone:(n) => say(`${bulkPlural(n, 'template')} deleted`)});
  const schema = {
    properties:cols, noun:'template', searchKeys:['code', 'name', 'services'], canCreateProperty:false, boards:false, bulkActions:qtBulk.bulkActions,
    filterProps:[{key:'name', label:'Name', type:'text'}, {key:'createdBy', label:'Created By', type:'select'}], selectValues:{createdBy:[...new Set(list.map(t => t.createdBy).filter(Boolean))]},
    renderCell:(key, r) => key === 'name' ? <ContactName name={r.name} onOpen={()=>setOpenId(r.id)} style={{fontSize:'inherit', fontWeight:500}}/>
      : undefined,
    renderActions:(r) => <RowActionsMenu title="Template Actions" width={MENU_W} items={actions(list.find(t => t.id === r.id))}/>,
  };
  const totals = open ? quoteTotals(open) : null;
  const create = (vals) => {
    const t = {id:`qt-${Date.now().toString(36)}`, code:nextTemplateCode(all), createdBy:CURRENT_USER.name, createdAt:new Date(), ...vals};
    setList(ts => [...ts, t]); setCreating(false); setOpenId(t.id); say(`Template ${t.code} created`);
  };
  return (
    <div style={{display:'flex', flexDirection:'column', flex:1, minHeight:0}}>
      <RecordViewsModule schema={schema} rows={rows} columns={cols.map(c => c.key)} storeKey="views:templates-quoteTemplates"
        defaultViews={[{id:'tv-quoteTemplates', name:'All Quote Templates', sort:{key:'code', dir:'asc'}}]}
        actions={() => can('create') && <button onClick={()=>{ setOpenId(null); setCreating(true); }} title="Add Quote Template" aria-label="Add Quote Template" style={toolbarIconButton}><Icon name="plus" size={14} color={T.gray800}/></button>}
        overlay={creating ? <QuoteTemplateFormPanel templates={all} onCancel={()=>setCreating(false)} onSave={create}/>
          : open && <DetailPanel title={open.name} onClose={()=>setOpenId(null)} menuItems={actions(open).filter(it => !/^View/.test(it.label))}
          fields={[['Code', open.code], ['Services', String((open.items || []).length)], ['Total', fmtMoney(totals.total, quoteCurrency(open))], ['Created', fmtQuoteDate(open.createdAt)], ['Created By', creatorOf(open)]]}>
            <QuoteDocument quote={sampleQuoteOf(open)}/>
        </DetailPanel>}/>
      {renaming && <StModal title="Rename Template" primary="Rename Template" canSubmit={!!renaming.name.trim()} onCancel={()=>setRenaming(null)}
        onSubmit={()=>{ setList(ts => ts.map(t => t.id === renaming.id ? {...t, name:renaming.name.trim()} : t)); setRenaming(null); say('Template renamed'); }}>
        <div><label style={fieldLabel}>Template Name</label><input autoFocus value={renaming.name} onChange={e=>setRenaming(r => ({...r, name:e.target.value}))} style={fieldInput}/></div>
      </StModal>}
      {qtBulk.bulkModal}
      {deleting && <StModal title="Delete Template" primary="Delete Template" danger onCancel={()=>setDeleting(null)}
        onSubmit={()=>{ setList(ts => ts.filter(t => t.id !== deleting.id)); if(openId === deleting.id) setOpenId(null); setDeleting(null); say('Template deleted'); }}>
        <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>{deleting.code} · {deleting.name} will be deleted. Quotes made from it keep what they were given. This can't be undone.</div>
      </StModal>}
    </div>
  );
}

function TemplatesSettings({data, setData}){
  const tabs = TEMPLATE_TABS.filter(t => templateCan(t.kind, 'view'));
  const [tabPicked, setTab] = React.useState('templates');
  const tab = tabs.some(t => t.id === tabPicked) ? tabPicked : (tabs[0] || {}).id;
  const kind = (TEMPLATE_TABS.find(t => t.id === tab) || {}).kind;
  const can = (action, item) => templateCan(kind, action, item);
  const [form, setForm] = React.useState(null);        // {kind, initial?}
  const [openId, setOpenId] = React.useState(null);
  const [deleting, setDeleting] = React.useState(null);  // {kind, item}
  const [assigning, setAssigning] = React.useState(null);   // the email template being assigned (its id)
  const [exiting, setExiting] = React.useState(null);       // {seq, object, record, left}: an enrollment about to be exited
  const [toast, setToast] = React.useState(null);
  const say = (m) => { setToast(m); setTimeout(()=>setToast(null), TOAST_MS); };
  const templates = emailTemplatesOf(data), sequences = emailSequencesOf(data);
  const setTemplates = (fn) => setData(d => ({...d, emailTemplates:fn(emailTemplatesOf(d))}));
  const setSequences = (fn) => setData(d => ({...d, emailSequences:fn(emailSequencesOf(d))}));
  const templateName = (id) => (templates.find(t => t.id === id) || {}).name || 'Deleted template';
  /* A sequence is also in use while records are enrolled in it (its emails still scheduled for
     them): it can't be deleted until they've gone out or the records exit it. */
  const hub = useRecordHub(), engineCtx = useWorkflowEngineCtx();
  const enrollments = React.useMemo(() => sequenceEnrollments(hub, sequences), [hub && hub.activities, hub && hub.records, sequences]);
  const enrolledIn = (id) => (enrollments[id] || []).length;
  const usage = (kind, id) => {
    const ws = usedInWorkflows(data, id);
    const seqs = kind === 'templates' ? sequences.filter(s => s.emails.some(e => e.templateId === id)) : [];
    const enrolled = kind === 'sequences' ? enrolledIn(id) : 0;
    return [...ws.map(w => `${w.name || 'Workflow'} (workflow)`), ...seqs.map(s => `${s.name} (sequence)`), ...(enrolled ? [`${enrolled} enrolled record${enrolled === 1 ? '' : 's'}`] : [])];
  };
  const isT = tab === 'templates';
  const list = (isT ? templates : sequences).filter(x => can('view', x));
  const open = list.find(x => x.id === openId) || null;
  const cols = isT ? [{key:'name', label:'Template Name', width:240}, {key:'usedBy', label:'Used By', width:120}, {key:'createdBy', label:'Created By', width:170}]
    : [{key:'name', label:'Sequence Name', width:240}, {key:'enrolled', label:'Enrolled', width:130}, {key:'usedBy', label:'Used By', width:120}, {key:'createdBy', label:'Created By', width:170}];
  // (A template's subject isn't a column; the search still reads it.)
  const rows = list.map(x => isT ? {id:x.id, name:x.name, subject:x.subject, usedBy:usage('templates', x.id).length, createdBy:creatorOf(x)}
    : {id:x.id, name:x.name, enrolled:enrolledIn(x.id), usedBy:usage('sequences', x.id).length, createdBy:creatorOf(x)});
  const noun = isT ? 'template' : 'sequence', Noun = isT ? 'Template' : 'Sequence';
  // Bulk Actions: Delete — one in use (by a sequence or a workflow) is skipped, as its Delete refuses.
  const listBulk = useTableBulkDelete({rows:list, noun, canDelete:(x) => can('delete', x) && !usage(tab, x.id).length, skipNote:'in use or not yours to delete',
    remove:(ids) => { (isT ? setTemplates : setSequences)(xs => xs.filter(x => !ids.includes(x.id))); if(ids.includes(openId)) setOpenId(null); }, onDone:(n) => say(`${bulkPlural(n, noun)} deleted`)});
  const schema = {
    properties:cols, noun, searchKeys:['name', 'subject'], fillWidth:true, canCreateProperty:false, boards:false, bulkActions:listBulk.bulkActions,
    filterProps:[{key:'name', label:'Name', type:'text'}, {key:'usedBy', label:'Used By', type:'number'}, ...(isT ? [{key:'createdBy', label:'Created By', type:'select'}] : [])],
    selectValues: isT ? {createdBy:[...new Set(rows.map(r => r.createdBy).filter(Boolean))]} : {},
    renderCell:(key, r) => key === 'name' ? <ContactName name={r.name} onOpen={()=>setOpenId(r.id)} style={{fontSize:'inherit', fontWeight:500}}/>
      : key === 'enrolled' ? <EnrolledMenu list={enrollments[r.id] || []} onOpen={(e)=>hub.openRecord(e.object, e.record.id)} onExit={(e)=>setExiting({...e, seq:list.find(q => q.id === r.id)})}/> : undefined,
    renderActions:(r) => { const x = list.find(y => y.id === r.id);
      return <RowActionsMenu title={`${Noun} Actions`} width={MENU_W} items={[{label:`View ${Noun}`, onClick:()=>setOpenId(r.id)},
        ...(can('edit', x) ? [{label:`Edit ${Noun}`, onClick:()=>setForm({kind:tab, initial:x})}, ...(isT ? [{label:'Assign Template', onClick:()=>setAssigning(x.id)}] : [])] : []),
        ...(!isT && can('create') ? [{label:'Clone Sequence', onClick:()=>clone(x)}] : []),
        ...(can('delete', x) ? [{label:`Delete ${Noun}`, danger:true, onClick:()=>setDeleting({kind:tab, item:x})}] : [])]}/>; },
  };
  const save = (vals) => {
    const editing = form.initial;
    if(form.kind === 'templates'){
      const t = vals;
      if(editing) setTemplates(ts => ts.map(x => x.id === editing.id ? {...x, ...t} : x));
      // A new template: who it's for comes next (Assign Template).
      else { const id = `et-${Date.now().toString(36)}`; setTemplates(ts => [...ts, {id, createdBy:CURRENT_USER.name, ...t}]); setAssigning(id); }
    } else {
      if(editing) setSequences(ss => ss.map(x => x.id === editing.id ? {...x, ...vals} : x));
      else setSequences(ss => [...ss, {id:`es-${Date.now().toString(36)}`, createdBy:CURRENT_USER.name, ...vals}]);
    }
    say(editing ? 'Saved' : `${form.kind === 'templates' ? 'Template' : 'Sequence'} created`);
    setForm(null);
  };
  const used = deleting ? usage(deleting.kind, deleting.item.id) : [];
  // Clone Sequence: the same emails under "<name> copy" (as a cloned view is named), the person's own.
  const clone = (x) => { const id = `es-${Date.now().toString(36)}`;
    setSequences(ss => [...ss, {...JSON.parse(JSON.stringify(x)), id, name:`${x.name} copy`, createdBy:CURRENT_USER.name}]); setOpenId(id); say('Sequence cloned'); };
  const assigned = assigning && templates.find(t => t.id === assigning);
  const exit = () => {
    const {seq, object, record} = exiting;
    const n = engineCtx ? engineCtx.api.exitSequence(object === 'contacts' ? String(record.id) : record.id, seq.id) : 0;
    setExiting(null); say(`${record.name || 'Record'} exited · ${bulkPlural(n, 'email')} cancelled`);
  };
  return (
    <div style={{position:'relative', flex:1, minHeight:0, display:'flex', flexDirection:'column', overflow:'hidden'}}>
      <SettingsPage fill>
        {/* The tabs row as Users & Teams: no gap under it — the view row's own padding sets the space. */}
        <div style={{display:'flex', gap:8, borderBottom:`1px solid ${T.borderStrong}`, flexShrink:0}}>
          {tabs.map(t => <UtTab key={t.id} icon={t.icon} label={t.label} active={tab === t.id} onClick={()=>{ setTab(t.id); setOpenId(null); }}/>)}
        </div>
        {!tab ? <div style={{...stTextB, padding:'24px 0'}}>You don't have access to any templates.</div> :
        tab === 'quoteTemplates' ? <QuoteTemplatesTab data={data} setData={setData} say={say}/> :
        tab === 'playbooks' ? <PlaybooksTab data={data} setData={setData} say={say}/> :
        tab === 'services' ? <ServicesPage/> :
        <div style={{display:'flex', flexDirection:'column', flex:1, minHeight:0}}>
          <RecordViewsModule key={tab} schema={schema} rows={rows} columns={cols.map(c => c.key)} storeKey={isT ? 'views:templates-templates' : 'views:templates-sequences-v2' /* v2: Enrolled in place of Emails and Templates */}
            defaultViews={[{id:`tv-${tab}`, name: isT ? 'All Templates' : 'All Sequences', sort:{key:'name', dir:'asc'}}]}
            actions={() => can('create') && <button onClick={()=>{ setOpenId(null); setForm({kind:tab}); }} title={isT ? 'Add Email Template' : 'Add Email Sequence'} aria-label={isT ? 'Add Email Template' : 'Add Email Sequence'} style={toolbarIconButton}><Icon name="plus" size={14} color={T.gray800}/></button>}
            overlay={form ? (form.kind === 'templates'
                ? <TemplateFormPanel key={form.initial ? form.initial.id : 'new'} initial={form.initial} onCancel={()=>setForm(null)} onSave={save}/>
                : <SequenceFormPanel key={form.initial ? form.initial.id : 'new'} initial={form.initial} templates={templates} onCancel={()=>setForm(null)} onSave={save}/>)
              : open && <DetailPanel title={open.name} onClose={()=>setOpenId(null)}
              menuItems={[...(can('edit', open) ? [{label:`Edit ${Noun}`, onClick:()=>setForm({kind:tab, initial:open})}, ...(isT ? [{label:'Assign Template', onClick:()=>setAssigning(open.id)}] : [])] : []),
                ...(!isT && can('create') ? [{label:'Clone Sequence', onClick:()=>clone(open)}] : []),
                ...(can('delete', open) ? [{label:`Delete ${Noun}`, danger:true, onClick:()=>setDeleting({kind:tab, item:open})}] : [])]}
              fields={[...(isT ? [['Subject', open.subject], ['Email Format', emailFormatLabel(templateContentOf(open).format)], ['Assigned To', assignmentLabel(open.assignedTo, data)]] : [['Emails', String(open.emails.length)]]),
                ['Used By', usage(tab, open.id).length ? usage(tab, open.id).join(', ') : 'Not used'], ['Created By', creatorOf(open)]]}>
                {isT ? <div style={{display:'flex', flexDirection:'column', gap:8}}><EmailHtmlFrame html={emailHtmlOf(templateContentOf(open))}/>
                    {templateContentOf(open).format === 'simple' && <EmailAttachmentList list={templateContentOf(open).attachments}/>}</div>
                  : <ol style={{margin:0, padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:10}}>
                      {open.emails.map((e, i) => (
                        <li key={i} style={{display:'flex', gap:10, alignItems:'baseline'}}>
                          <span style={{fontSize:12, color:T.attioMuted, width:110, flexShrink:0}}>{sequenceWhenLabel(e, i)}</span>
                          <span style={{fontSize:13, color:T.attioText}}>{templateName(e.templateId)}</span>
                        </li>
                      ))}
                    </ol>}
            </DetailPanel>}/>
        </div>}
      </SettingsPage>
      {listBulk.bulkModal}
      {assigned && <AssignPeopleModal key={assigned.id} title="Assign Template" value={assigned.assignedTo} data={data} onCancel={()=>setAssigning(null)}
        onSave={(a)=>{ setTemplates(ts => ts.map(t => t.id === assigned.id ? {...t, assignedTo:a} : t)); setAssigning(null); say('Template assigned'); }}/>}
      {exiting && <StModal title="Exit Sequence" primary="Exit Sequence" danger onCancel={()=>setExiting(null)} onSubmit={exit}>
        <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>{exiting.record.name || 'This record'} leaves {exiting.seq.name}. {bulkPlural(exiting.left, 'scheduled email')} won't be sent.</div>
      </StModal>}
      {deleting && <StModal title={`Delete ${deleting.kind === 'templates' ? 'template' : 'sequence'}`} primary={used.length ? null : 'Delete'} danger onCancel={()=>setDeleting(null)}
        onSubmit={()=>{ (deleting.kind === 'templates' ? setTemplates : setSequences)(xs => xs.filter(x => x.id !== deleting.item.id)); if(openId === deleting.item.id) setOpenId(null); setDeleting(null); say(deleting.kind === 'templates' ? 'Email template deleted' : 'Sequence deleted'); }}>
        <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>
          {used.length ? `${deleting.item.name} is used by ${used.join(', ')}. Remove it there first, then delete it.` : `${deleting.item.name} will be deleted. This can't be undone.`}
        </div>
      </StModal>}
      <CopyToast message={toast}/>
    </div>
  );
}
SETTINGS_PAGES['settings.templates'] = TemplatesSettings;

Object.assign(window, {TemplatesSettings, templateUsable, sequenceEnrollments, sampleSequenceEnrollments});
