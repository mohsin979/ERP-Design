/* HOF Pulse ERP — Settings → Templates: Email Templates, Email Sequences, Quote Templates,
   Playbooks (playbooks.jsx) and Services (services.jsx — the service catalog, moved here from the
   CRM navigation).

   Foundational for now (to be refined later):
     Email Templates — reusable emails: Email Template Name, Subject and Email Format — Simple
       Text Body, Default HTML Template or Custom HTML Template (emails.jsx: the formats, the
       signature, the preview) — with a live preview beside the fields ({{first_name}} is filled
       in for the recipient). Used by the email composer (emails.jsx), sequences and workflows.
     Email Sequences — a named, ordered list of templates, each sent a set time after the one
       before, as its template is (subject, format, content, signature). Used by workflows'
       Enroll in Email Sequence ("Choose email sequence template").
     Quote Templates — a configured quote (quotes.jsx): its services and milestones, payment
       terms, discount and VAT, and terms; each has a code (QT-001…). Created here (the quote
       builder's Services and Payment Terms fields) or from a quote (Save as template); listed,
       viewed, renamed and deleted here.
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
const SEQUENCE_UNITS = ['Hours', 'Days', 'Weeks'];
// Where a template or sequence is used: workflows (any of their settings) and, for templates, sequences.
// A workflow's current version only — one it was used in before (its version history) doesn't count.
const usedInWorkflows = (data, id) => (data.workflows || []).filter(w => { const {history, ...now} = w; return JSON.stringify(now).includes(`"${id}"`); });

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

function SequenceFormPanel({initial, templates, onCancel, onSave}){
  const [s, setS] = React.useState(() => ({name:(initial && initial.name) || '',
    emails:((initial && initial.emails) || [{templateId:'', delay:{amount:'1', unit:'Days'}}]).map((e, i) => ({key:`se-${i}-${Math.random().toString(36).slice(2, 6)}`, ...e, delay:{...e.delay}}))}));
  const setEmail = (i, p) => setS(x => ({...x, emails:x.emails.map((e, j) => j === i ? {...e, ...p} : e)}));
  const move = (i, d) => setS(x => { const n = x.emails.slice(); const [m] = n.splice(i, 1); n.splice(i + d, 0, m); return {...x, emails:n}; });
  const ok = !!s.name.trim() && s.emails.length > 0 && s.emails.every(e => e.templateId && Number(e.delay.amount) >= 0 && e.delay.amount !== '');
  const iconBtn = (icon, title, onClick, disabled) => <button type="button" title={title} disabled={disabled} onClick={onClick}
    style={{border:'none', background:'transparent', cursor: disabled ? 'default' : 'pointer', display:'flex', padding:4, opacity: disabled ? .35 : 1}}><Icon name={icon} size={13} color={T.gray600}/></button>;
  const save = () => onSave({name:s.name.trim(), emails:s.emails.map(({key, ...e}) => e)});
  return (
    <CreatePanelFrame title={initial ? 'Edit Email Sequence' : 'Add Email Sequence'} onClose={onCancel} actions={panelActions(onCancel, initial ? 'Save Changes' : 'Add Email Sequence', ok, save)}>
      {stack(<>
      <Field label="Name"><input autoFocus value={s.name} onChange={e=>setS(x => ({...x, name:e.target.value}))} placeholder="e.g. New client onboarding" style={fieldText}/></Field>
      <Field label="Emails"><div style={{display:'flex', flexDirection:'column', gap:8, paddingTop:2}}>
        {s.emails.map((e, i) => (
          <div key={e.key} style={{border:`1px solid ${T.attioLine}`, borderRadius:10, padding:10, display:'flex', flexDirection:'column', gap:8}}>
            <div style={{display:'flex', alignItems:'center', gap:6}}>
              <span style={{fontSize:12.5, fontWeight:600, color:T.attioText, flex:1}}>Email {i + 1}</span>
              {iconBtn('arrowUp', 'Move up', ()=>move(i, -1), i === 0)}
              {iconBtn('arrowDown', 'Move down', ()=>move(i, 1), i === s.emails.length - 1)}
              {iconBtn('trash', 'Remove email', ()=>setS(x => ({...x, emails:x.emails.filter((_, j) => j !== i)})), s.emails.length === 1)}
            </div>
            <FormSelect value={e.templateId} placeholder="Select email template" options={templates.map(t => ({value:t.id, label:t.name}))} onChange={(v)=>setEmail(i, {templateId:v})}/>
            {/* Sent as the template is: its subject, format, content and signature. */}
            {(() => { const tpl = templates.find(t => t.id === e.templateId); return tpl && (
              <div style={{fontSize:12, color:T.attioMuted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{emailFormatLabel(templateContentOf(tpl).format)} · {tpl.subject}</div>); })()}
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <span style={{fontSize:12.5, color:T.gray600, whiteSpace:'nowrap'}}>{i === 0 ? 'Send after' : 'Then after'}</span>
              <input value={e.delay.amount} onChange={ev=>setEmail(i, {delay:{...e.delay, amount:ev.target.value.replace(/[^0-9]/g, '')}})} inputMode="numeric" aria-label={`Email ${i + 1} delay`}
                style={{...fieldText, width:80, fontVariantNumeric:'tabular-nums'}}/>
              <div style={{width:130}}><FormSelect value={e.delay.unit} placeholder="Select unit" options={SEQUENCE_UNITS} onChange={(v)=>setEmail(i, {delay:{...e.delay, unit:v || 'Days'}})}/></div>
            </div>
          </div>
        ))}
        <button type="button" onClick={()=>setS(x => ({...x, emails:[...x.emails, {key:`se-${Date.now().toString(36)}`, templateId:'', delay:{amount:'1', unit:'Days'}}]}))}
          style={{alignSelf:'flex-start', display:'inline-flex', alignItems:'center', gap:6, border:'none', background:'transparent', padding:'4px 0', fontSize:13, fontWeight:500, color:T.attioText, cursor:'pointer', fontFamily:'inherit'}}>
          <Icon name="plus" size={13} color={T.gray600}/> Add Email
        </button>
      </div></Field>
      </>)}
    </CreatePanelFrame>
  );
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
        <span style={QUOTE_SECTION}>Payment terms</span>
        <QuotePaymentFields q={t} set={set} checks={checks}/>
        {divider}
        <span style={QUOTE_SECTION}>Terms & conditions</span>
        <RichTextEditor value={t.terms} onChange={(v)=>set({terms:v})} minHeight={200} ariaLabel="Terms and conditions"/>
      </div>
    </CreatePanelFrame>
  );
}

/* Quote Templates: code, name, what it holds; New (the panel above), View (the template's contents), Rename, Delete. */
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
    {key:'payment', label:'Payment Terms', width:180}, {key:'createdBy', label:'Created By', width:160}, {key:'created', label:'Created', width:150}];
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
  const section = {...QUOTE_SECTION, marginBottom:8};
  const totals = open ? quoteTotals(open) : null;
  const row = (l, v, key) => <div key={key} style={{display:'flex', justifyContent:'space-between', gap:12, fontSize:13, color:T.attioText, padding:'4px 0'}}><span>{l}</span><span style={{fontVariantNumeric:'tabular-nums'}}>{v}</span></div>;
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
            <div>
              <div style={section}>Services</div>
              {(open.items || []).map(it => (
                <div key={it.id} style={{padding:'8px 0', borderTop:`1px solid ${T.attioLine}`}}>
                  <div style={{display:'flex', justifyContent:'space-between', gap:12}}><span style={{fontSize:13.5, fontWeight:600, color:T.attioText}}>{it.name}</span>
                    <span style={{fontSize:13, fontVariantNumeric:'tabular-nums'}}>{fmtMoney(quoteItemTotal(it), quoteCurrency(open))}</span></div>
                  {(it.milestones || []).map(m => <div key={m.id} style={{display:'flex', justifyContent:'space-between', gap:12, fontSize:12.5, color:T.attioMuted, padding:'3px 0 0 12px'}}>
                    <span>{m.name}</span><span style={{fontVariantNumeric:'tabular-nums'}}>{fmtMoney(m.price, quoteCurrency(open))}</span></div>)}
                </div>
              ))}
            </div>
            <div>
              <div style={section}>Payment terms</div>
              <PaymentPlanTable rows={quoteSchedule(open)} currency={quoteCurrency(open)} ongoing={planOngoing(quotePlanOf(open))}/>
            </div>
            <div>
              <div style={section}>Discount & tax</div>
              {row('Services subtotal', fmtMoney(totals.subtotal, quoteCurrency(open)))}
              {row(`Discount${open.discount && open.discount.type === 'percent' ? ` (${open.discount.value}%)` : ''}`, `− ${fmtMoney(totals.discount, quoteCurrency(open))}`)}
              {row(`VAT (${totals.vatRate}%)`, fmtMoney(totals.vat, quoteCurrency(open)))}
              <div style={{borderTop:`1px solid ${T.attioText}`, marginTop:4}}>{row('Total', fmtMoney(totals.total, quoteCurrency(open)))}</div>
            </div>
            <div>
              <div style={section}>Terms & conditions</div>
              {richIsEmpty(richHtmlOf(open.terms)) ? <div style={{fontSize:13, color:T.attioMuted}}>None.</div> : <RichTextView html={open.terms} style={{fontSize:12.5}}/>}
            </div>
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
  const [toast, setToast] = React.useState(null);
  const say = (m) => { setToast(m); setTimeout(()=>setToast(null), TOAST_MS); };
  const templates = emailTemplatesOf(data), sequences = emailSequencesOf(data);
  const setTemplates = (fn) => setData(d => ({...d, emailTemplates:fn(emailTemplatesOf(d))}));
  const setSequences = (fn) => setData(d => ({...d, emailSequences:fn(emailSequencesOf(d))}));
  const templateName = (id) => (templates.find(t => t.id === id) || {}).name || 'Deleted template';
  /* A sequence is also in use while records are enrolled in it (its emails still scheduled for
     them): it can't be deleted until they've gone out or the records exit it. */
  const hub = useRecordHub();
  const enrolledIn = (id) => !hub ? 0 : Object.values(hub.activities || {}).reduce((n, byRec) => n + Object.values(byRec || {})
    .filter(list => (list || []).some(a => a.type === 'email' && a.status === 'scheduled' && a.sequenceId === id)).length, 0);
  const usage = (kind, id) => {
    const ws = usedInWorkflows(data, id);
    const seqs = kind === 'templates' ? sequences.filter(s => s.emails.some(e => e.templateId === id)) : [];
    const enrolled = kind === 'sequences' ? enrolledIn(id) : 0;
    return [...ws.map(w => `${w.name || 'Workflow'} (workflow)`), ...seqs.map(s => `${s.name} (sequence)`), ...(enrolled ? [`${enrolled} enrolled record${enrolled === 1 ? '' : 's'}`] : [])];
  };
  const isT = tab === 'templates';
  const list = (isT ? templates : sequences).filter(x => can('view', x));
  const open = list.find(x => x.id === openId) || null;
  const cols = isT ? [{key:'name', label:'Template Name', width:240}, {key:'subject', label:'Subject', width:320}, {key:'usedBy', label:'Used By', width:120}, {key:'createdBy', label:'Created By', width:170}]
    : [{key:'name', label:'Sequence Name', width:240}, {key:'steps', label:'Emails', width:110}, {key:'span', label:'Templates', width:380}, {key:'usedBy', label:'Used By', width:120}, {key:'createdBy', label:'Created By', width:170}];
  const rows = list.map(x => isT ? {id:x.id, name:x.name, subject:x.subject, usedBy:usage('templates', x.id).length, createdBy:creatorOf(x)}
    : {id:x.id, name:x.name, steps:x.emails.length, span:x.emails.map(e => templateName(e.templateId)).join(' → '), usedBy:usage('sequences', x.id).length, createdBy:creatorOf(x)});
  const noun = isT ? 'template' : 'sequence', Noun = isT ? 'Template' : 'Sequence';
  // Bulk Actions: Delete — one in use (by a sequence or a workflow) is skipped, as its Delete refuses.
  const listBulk = useTableBulkDelete({rows:list, noun, canDelete:(x) => can('delete', x) && !usage(tab, x.id).length, skipNote:'in use or not yours to delete',
    remove:(ids) => { (isT ? setTemplates : setSequences)(xs => xs.filter(x => !ids.includes(x.id))); if(ids.includes(openId)) setOpenId(null); }, onDone:(n) => say(`${bulkPlural(n, noun)} deleted`)});
  const schema = {
    properties:cols, noun, searchKeys:['name', 'subject'], fillWidth:true, canCreateProperty:false, boards:false, bulkActions:listBulk.bulkActions,
    filterProps:[{key:'name', label:'Name', type:'text'}, {key:'usedBy', label:'Used By', type:'number'}], selectValues:{},
    renderCell:(key, r) => key === 'name' ? <ContactName name={r.name} onOpen={()=>setOpenId(r.id)} style={{fontSize:'inherit', fontWeight:500}}/> : undefined,
    renderActions:(r) => { const x = list.find(y => y.id === r.id);
      return <RowActionsMenu title={`${Noun} Actions`} width={MENU_W} items={[{label:`View ${Noun}`, onClick:()=>setOpenId(r.id)},
        ...(can('edit', x) ? [{label:`Edit ${Noun}`, onClick:()=>setForm({kind:tab, initial:x})}] : []),
        ...(can('delete', x) ? [{label:`Delete ${Noun}`, danger:true, onClick:()=>setDeleting({kind:tab, item:x})}] : [])]}/>; },
  };
  const save = (vals) => {
    const editing = form.initial;
    if(form.kind === 'templates'){
      const t = vals;
      if(editing) setTemplates(ts => ts.map(x => x.id === editing.id ? {...x, ...t} : x));
      else setTemplates(ts => [...ts, {id:`et-${Date.now().toString(36)}`, createdBy:CURRENT_USER.name, ...t}]);
    } else {
      if(editing) setSequences(ss => ss.map(x => x.id === editing.id ? {...x, ...vals} : x));
      else setSequences(ss => [...ss, {id:`es-${Date.now().toString(36)}`, createdBy:CURRENT_USER.name, ...vals}]);
    }
    say(editing ? 'Saved' : `${form.kind === 'templates' ? 'Template' : 'Sequence'} created`);
    setForm(null);
  };
  const used = deleting ? usage(deleting.kind, deleting.item.id) : [];
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
          <RecordViewsModule key={tab} schema={schema} rows={rows} columns={cols.map(c => c.key)} storeKey={`views:templates-${tab}`}
            defaultViews={[{id:`tv-${tab}`, name: isT ? 'All Templates' : 'All Sequences', sort:{key:'name', dir:'asc'}}]}
            actions={() => can('create') && <button onClick={()=>{ setOpenId(null); setForm({kind:tab}); }} title={isT ? 'Add Email Template' : 'Add Email Sequence'} aria-label={isT ? 'Add Email Template' : 'Add Email Sequence'} style={toolbarIconButton}><Icon name="plus" size={14} color={T.gray800}/></button>}
            overlay={form ? (form.kind === 'templates'
                ? <TemplateFormPanel key={form.initial ? form.initial.id : 'new'} initial={form.initial} onCancel={()=>setForm(null)} onSave={save}/>
                : <SequenceFormPanel key={form.initial ? form.initial.id : 'new'} initial={form.initial} templates={templates} onCancel={()=>setForm(null)} onSave={save}/>)
              : open && <DetailPanel title={open.name} onClose={()=>setOpenId(null)}
              menuItems={[...(can('edit', open) ? [{label:`Edit ${Noun}`, onClick:()=>setForm({kind:tab, initial:open})}] : []), ...(can('delete', open) ? [{label:`Delete ${Noun}`, danger:true, onClick:()=>setDeleting({kind:tab, item:open})}] : [])]}
              fields={[...(isT ? [['Subject', open.subject], ['Email Format', emailFormatLabel(templateContentOf(open).format)]] : [['Emails', String(open.emails.length)]]), ['Used By', usage(tab, open.id).length ? usage(tab, open.id).join(', ') : 'Not used'], ['Created By', creatorOf(open)]]}>
                {isT ? <div style={{display:'flex', flexDirection:'column', gap:8}}><EmailHtmlFrame html={emailHtmlOf(templateContentOf(open))}/>
                    {templateContentOf(open).format === 'simple' && <EmailAttachmentList list={templateContentOf(open).attachments}/>}</div>
                  : <ol style={{margin:0, padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:10}}>
                      {open.emails.map((e, i) => (
                        <li key={i} style={{display:'flex', gap:10, alignItems:'baseline'}}>
                          <span style={{fontSize:12, color:T.attioMuted, width:70, flexShrink:0}}>{i === 0 ? 'After' : 'Then'} {e.delay.amount} {String(e.delay.unit).toLowerCase()}</span>
                          <span style={{fontSize:13, color:T.attioText}}>{templateName(e.templateId)}</span>
                        </li>
                      ))}
                    </ol>}
            </DetailPanel>}/>
        </div>}
      </SettingsPage>
      {listBulk.bulkModal}
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

Object.assign(window, {TemplatesSettings});
