/* HOF Pulse ERP — Services (Settings → Templates → Services; a kind of template).
   Settings & Administration permissions (Templates → Services) decide who sees, creates, edits and
   deletes each service (by who created it — the sample services are no one's).

   The workspace's service catalog — what quotations are built from (quotes.jsx). A service has
   a name, a description (rich text, richText.jsx) and either its milestones — Enable milestones:
   the stages the service is delivered in, each with a name, a description and a price, the
   service's price their sum — or, milestones off, one price — in the service's currency (the
   default one to start with, Settings → Defaults; the sample services are in AED). Services are
   created, viewed, edited and deleted here, and created from the quote builder and the Quotes
   page too (the same panel); a quotation keeps its own copy of a service as it was quoted, so
   changing or deleting a service never changes a quote already made.
   Detail panels (DetailPanel, PanelFields) — every template's: the title, a separator, the
   structured information as label | value rows, then the content. */

const SAMPLE_SERVICES = () => {
  const ms = (pairs) => pairs.map(([name, description], i) => ({id:`ms-${i + 1}`, name, description}));
  // Each sample's price spread across its milestones (in 500s; the rest on the last).
  const priced = (svc) => { const n = svc.milestones.length, each = Math.floor(svc.price / n / 500) * 500;
    return {...svc, milestones:svc.milestones.map((m, i) => ({...m, price: i < n - 1 ? each : svc.price - each * (n - 1)}))}; };
  return [
    {id:'svc-1', name:'US NIW Petition', price:45000, currency:DEAL_CURRENCY, created:'Aug 2, 2026',
      description:'End-to-end preparation and filing of a US National Interest Waiver (EB-2 NIW) petition, from the welcome call to the visa decision.',
      milestones:ms([['Welcome Call', 'Introduce the case team, confirm the timeline and the documents needed.'],
        ['Phase 1 Document Collection', 'Identity, education and employment documents.'],
        ['Independent Expert Evaluation', 'Expert opinion letters supporting the national interest.'],
        ['Petition Preparation & Review', 'Drafting the petition letter and the evidence index, then the client review.'],
        ['Petition Filing', 'Forms filed with USCIS and the tracking notice shared.'],
        ['Visa Interview Preparation', 'Mock interview and document check before the appointment.']])},
    {id:'svc-2', name:'Canada Express Entry', price:32000, currency:DEAL_CURRENCY, created:'Aug 2, 2026',
      description:'Federal skilled immigration through Express Entry, with Provincial Nominee Program options where they help the score.',
      milestones:ms([['Initial Welcome Call', 'Eligibility review and a CRS score estimate.'], ['Educational Credential Assessment', 'ECA through WES or an equivalent body.'],
        ['Language Test', 'IELTS or CELPIP registration and results.'], ['Express Entry Profile', 'Profile created and entered in the pool.'],
        ['ITA & Application', 'Invitation to Apply, then the full application.'], ['COPR', 'Confirmation of Permanent Residence and landing guidance.']])},
    {id:'svc-3', name:'Australia Skilled Migration', price:38000, currency:DEAL_CURRENCY, created:'Aug 4, 2026',
      description:'Subclass 189 / 190 skilled visa, from the skills assessment to the visa grant.',
      milestones:ms([['Skills Assessment', 'Assessment with the relevant authority for the nominated occupation.'], ['EOI Submission', 'Expression of Interest lodged in SkillSelect.'],
        ['State Nomination', 'Nomination application where the subclass needs it.'], ['Visa Lodgement', 'Visa application lodged after the invitation.'],
        ['Visa Grant', 'Grant letter and first-entry guidance.']])},
    {id:'svc-4', name:'Spouse Sponsorship', price:18500, currency:DEAL_CURRENCY, created:'Aug 9, 2026',
      description:'Sponsorship of a spouse or common-law partner, alongside the main application or after landing.',
      milestones:ms([['Eligibility Review', 'Relationship evidence and sponsor eligibility.'], ['Document Collection', 'Marriage certificate, photos and relationship history.'],
        ['Application Filing', 'Sponsorship and residence applications filed.'], ['Biometrics & Medicals', 'Appointments booked and completed.']])},
    {id:'svc-5', name:'RFE Response', price:9000, currency:DEAL_CURRENCY, created:'Aug 20, 2026',
      description:'Analysis of a Request for Evidence and a complete response within the USCIS deadline.',
      milestones:ms([['RFE Analysis', 'What USCIS asks for and the strategy to answer it.'], ['Evidence Collection', 'New letters and documents gathered.'],
        ['Response Filing', 'The response package filed and tracked.']])},
    {id:'svc-6', name:'IELTS Preparation Support', price:3500, currency:DEAL_CURRENCY, created:'Sep 1, 2026',
      description:'Coaching for the IELTS General test, timed to the client’s immigration timeline.',
      milestones:ms([['Diagnostic Test', 'A baseline score in all four modules.'], ['Coaching Sessions', 'Eight one-to-one sessions.'], ['Mock Tests', 'Two full timed mock tests with feedback.']])},
  ].map(priced);
};
// Whole amounts as they are; a fraction (a discount, VAT, an installment) to two decimals.
const fmtMoney = (n, currency = defaultCurrency()) => n === '' || n == null || isNaN(n) ? ''
  : `${currency} ${Number.isInteger(Number(n)) ? formatAmount(Number(n)) : Number(n).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
/* Milestone prices. A service saved before they existed keeps its price on its first milestone. */
const withMilestonePrices = (s) => (s.milestones || []).some(m => m.price != null) || !(s.milestones || []).length ? s
  : {...s, milestones:s.milestones.map((m, i) => ({...m, price: i === 0 ? Number(s.price) || 0 : 0}))};
const servicePrice = (s) => (s.milestones || []).length ? s.milestones.reduce((sum, m) => sum + (Number(m.price) || 0), 0) : Number(s.price) || 0;
const richPlain = (html) => { const d = document.createElement('div'); d.innerHTML = richHtmlOf(html); return d.textContent.replace(/\s+/g, ' ').trim(); };
const serviceRow = (s) => ({...s, createdBy:creatorOf(s), price:servicePrice(s), priceText:fmtMoney(servicePrice(s), s.currency), milestoneCount:(s.milestones || []).length, description:richPlain(s.description)});

/* A side panel over the page (a service, a quotation, an activity on the Tools pages): the
   Contact side panel's header, its content scrolling below. `divided`: a separator under the header. */
function PageSidePanel({title, subtitle, onClose, menuItems, children, width = 460, divided}){
  return (
    <ContentSidePanel width={width} zIndex={75} style={{background:'#fff', borderLeft:`1px solid ${T.border}`, boxShadow:'-8px 0 24px rgba(16,24,40,.08)', display:'flex', flexDirection:'column'}}>
      <div style={divided ? {borderBottom:`1px solid ${T.border}`, flexShrink:0} : {flexShrink:0}}><SidePanelHeader title={title} subtitle={subtitle} onClose={onClose} menuItems={menuItems}/></div>
      <div style={{flex:1, minHeight:0, display:'flex', flexDirection:'column', overflow:'hidden'}}>{children}</div>
    </ContentSidePanel>
  );
}
/* A detail panel's structured information: label | value rows, as a record panel's properties. */
function PanelFields({rows}){
  return (
    <div>
      {rows.filter(Boolean).map(([label, value]) => (
        <div key={label} style={{display:'flex', alignItems:'baseline', gap:12, padding:'7px 0', borderBottom:`1px solid ${T.attioLine}`, minHeight:32}}>
          <span style={{width:120, flexShrink:0, fontSize:12.5, color:T.attioMuted}}>{label}</span>
          <span style={{fontSize:13, color:T.attioText, minWidth:0, overflowWrap:'anywhere', fontVariantNumeric:'tabular-nums'}}>{value === '' || value == null ? '—' : value}</span>
        </div>
      ))}
    </div>
  );
}
/* A template's detail panel: one title, a separator, its fields (label | value), then its content. */
function DetailPanel({title, onClose, menuItems, width, fields, children}){
  return (
    <PageSidePanel width={width} title={title} onClose={onClose} menuItems={menuItems} divided>
      <div style={{flex:1, overflowY:'auto', padding:'8px 20px 24px', display:'flex', flexDirection:'column', gap:18}}>
        {fields && <PanelFields rows={fields}/>}
        {children}
      </div>
    </PageSidePanel>
  );
}

/* Milestones, edited in order: name, description and price per milestone, add, move, remove. */
function MilestonesEditor({value, onChange, currency}){
  const list = value || [];
  const set = (i, p) => onChange(list.map((m, j) => j === i ? {...m, ...p} : m));
  const move = (i, d) => { const n = list.slice(); const [m] = n.splice(i, 1); n.splice(i + d, 0, m); onChange(n); };
  const iconBtn = (icon, title, onClick, disabled) => <button type="button" title={title} disabled={disabled} onClick={onClick}
    style={{border:'none', background:'transparent', cursor: disabled ? 'default' : 'pointer', display:'flex', padding:4, opacity: disabled ? .35 : 1}}>
    <Icon name={icon} size={13} color={T.gray600}/></button>;
  return (
    <div style={{display:'flex', flexDirection:'column', gap:8}}>
      {list.map((m, i) => (
        <div key={m.id} style={{border:`1px solid ${T.attioLine}`, borderRadius:10, padding:10, display:'flex', flexDirection:'column', gap:8}}>
          <div style={{display:'flex', alignItems:'center', gap:6}}>
            <span style={{fontSize:12, color:T.attioMuted, width:22, flexShrink:0, fontVariantNumeric:'tabular-nums'}}>{i + 1}.</span>
            <input value={m.name} onChange={e=>set(i, {name:e.target.value})} placeholder="Milestone name" aria-label={`Milestone ${i + 1} name`} style={{...fieldInput, flex:1}}/>
            {iconBtn('arrowUp', 'Move up', ()=>move(i, -1), i === 0)}
            {iconBtn('arrowDown', 'Move down', ()=>move(i, 1), i === list.length - 1)}
            {iconBtn('trash', 'Remove milestone', ()=>onChange(list.filter((_, j) => j !== i)))}
          </div>
          <textarea value={m.description} onChange={e=>set(i, {description:e.target.value})} rows={2} placeholder="Description" aria-label={`Milestone ${i + 1} description`}
            style={{...fieldInput, resize:'vertical', lineHeight:1.5, marginLeft:28, width:'calc(100% - 28px)'}}/>
          <div style={{display:'flex', alignItems:'center', gap:8, marginLeft:28}}>
            <span style={{fontSize:12.5, color:T.attioMuted}}>Price ({currency})</span>
            <input value={m.price ?? ''} onChange={e=>set(i, {price:e.target.value.replace(/[^0-9.]/g, '')})} inputMode="decimal" placeholder="0" aria-label={`Milestone ${i + 1} price`}
              style={{...fieldInput, width:140, textAlign:'right', fontVariantNumeric:'tabular-nums'}}/>
          </div>
        </div>
      ))}
      <button type="button" onClick={()=>onChange([...list, {id:`ms-${Date.now().toString(36)}`, name:'', description:'', price:''}])}
        style={{alignSelf:'flex-start', display:'inline-flex', alignItems:'center', gap:6, border:'none', background:'transparent', padding:'4px 0', fontSize:13, fontWeight:500, color:T.attioText, cursor:'pointer', fontFamily:'inherit'}}>
        <Icon name="plus" size={13} color={T.gray600}/> Add milestone
      </button>
    </div>
  );
}

/* New / edit service: the creation side panel (CreatePanelFrame) over the catalog — Name,
   Description (rich text), Enable milestones: on, Milestones with their prices and the Price they
   add up to; off, the Price; Cancel and Save at the bottom. `zIndex`: over the quote builder. */
function ServiceFormPanel({initial, onCancel, onSave, zIndex}){
  const [s, setS] = React.useState(() => ({name:'', description:'', milestones:[], price:'', ...(initial ? withMilestonePrices(initial) : {}),
    currency:(initial && initial.currency) || defaultCurrency()}));
  const [withMilestones, setWithMilestones] = React.useState(() => !initial || (initial.milestones || []).length > 0);
  const set = (p) => setS(x => ({...x, ...p}));
  const priceOk = (v) => v !== '' && v != null && Number.isFinite(Number(v)) && Number(v) >= 0;
  const ok = !!s.name.trim() && (withMilestones ? s.milestones.length > 0 && s.milestones.every(m => m.name.trim() && priceOk(m.price)) : priceOk(s.price));
  const total = withMilestones ? s.milestones.reduce((sum, m) => sum + (Number(m.price) || 0), 0) : Number(s.price) || 0;
  const save = () => onSave({...s, name:s.name.trim(), description:s.description || '', price:total, currency:s.currency,
    milestones: withMilestones ? s.milestones.map(m => ({...m, name:m.name.trim(), description:(m.description || '').trim(), price:Number(m.price)})) : []});
  return (
    <CreatePanelFrame title={initial ? 'Edit Service' : 'New Service'} onClose={onCancel} zIndex={zIndex} actions={<>
      <StSecondary label="Cancel" onClick={onCancel}/>
      <StCta label="Save" disabled={!ok} onClick={()=>ok && save()}/>
    </>}>
      {stack(<>
        <Field label="Name"><input autoFocus value={s.name} onChange={e=>set({name:e.target.value})} placeholder="e.g. US NIW Petition" style={fieldText}/></Field>
        <Field label="Description"><RichTextEditor value={s.description} onChange={(v)=>set({description:v})} ariaLabel="Service description"/></Field>
        <Field label="Currency"><FormSelect value={s.currency} options={currencyOptions()} onChange={(c)=>c && set({currency:c})}/></Field>
        <Field label="Enable milestones"><label style={{display:'inline-flex', alignItems:'center', minHeight:34, cursor:'pointer'}}><UtToggle on={withMilestones} onChange={setWithMilestones}/></label></Field>
        {withMilestones && <Field label="Milestones"><div style={{paddingTop:2}}><MilestonesEditor value={s.milestones} currency={s.currency} onChange={(v)=>set({milestones:v})}/></div></Field>}
        {withMilestones
          ? <Field label="Price"><ReadValue>{fmtMoney(total, s.currency)}</ReadValue></Field>
          : <Field label="Price"><div style={{position:'relative', width:200}}>
              <span style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:12, color:T.attioMuted, pointerEvents:'none'}}>{s.currency}</span>
              <input value={s.price ?? ''} onChange={e=>set({price:e.target.value.replace(/[^0-9.]/g, '')})} inputMode="decimal" placeholder="0" aria-label="Price"
                style={{...fieldText, paddingLeft:44, textAlign:'right', fontVariantNumeric:'tabular-nums'}}/>
            </div></Field>}
      </>)}
    </CreatePanelFrame>
  );
}
// A new service as the catalog keeps it (ServicesPage, the quote builder and the Quotes page).
const newServiceRecord = (vals) => ({id:`svc-${Date.now().toString(36)}`, created:todayLabel(), createdBy:CURRENT_USER.name, ...vals});

/* The service's fields, then its description and milestones (none when milestones are off). */
function ServiceDetail({service: raw}){
  const service = withMilestonePrices(raw);
  return (<>
    <PanelFields rows={[['Price', fmtMoney(servicePrice(service), service.currency)], ['Milestones', service.milestones.length ? String(service.milestones.length) : 'Off'],
      ['Created', service.created], ['Created by', creatorOf(service)]]}/>
    {!richIsEmpty(richHtmlOf(service.description)) && <RichTextView html={service.description} style={{lineHeight:1.6}}/>}
    {service.milestones.length > 0 && <div>
        <div style={{fontSize:11, fontWeight:600, color:T.attioFaint, textTransform:'uppercase', letterSpacing:.4, marginBottom:8}}>Milestones · {service.milestones.length}</div>
        <ol style={{margin:0, padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:10}}>
          {service.milestones.map((m, i) => (
            <li key={m.id} style={{display:'flex', gap:10}}>
              <span style={{width:22, height:22, borderRadius:9999, background:T.headerBg, border:`1px solid ${T.attioLine}`, fontSize:11, fontWeight:600, color:T.attioText,
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontVariantNumeric:'tabular-nums'}}>{i + 1}</span>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:13, fontWeight:500, color:T.attioText}}>{m.name}</div>
                {m.description && <div style={{fontSize:12.5, color:T.attioMuted, lineHeight:1.5, marginTop:2}}>{m.description}</div>}
              </div>
              <span style={{fontSize:13, color:T.attioText, whiteSpace:'nowrap', fontVariantNumeric:'tabular-nums'}}>{fmtMoney(m.price, service.currency)}</span>
            </li>
          ))}
        </ol>
      </div>}
  </>);
}

const SERVICE_COLUMNS = [
  {key:'name', label:'Service Name', width:240}, {key:'priceText', label:'Price', width:150}, {key:'milestoneCount', label:'Milestones', width:120},
  {key:'description', label:'Description', width:360}, {key:'created', label:'Created', width:140}, {key:'createdBy', label:'Created By', width:170},
];
function ServicesPage(){
  const hub = useRecordHub();
  const services = hub.services, setServices = hub.setServices;
  const [form, setForm] = React.useState(null);        // {initial?}
  const [openId, setOpenId] = React.useState(null);
  const [deleting, setDeleting] = React.useState(null);
  const can = (action, s) => templateCan('services', action, s);
  const shown = services.filter(s => can('view', s));
  const open = shown.find(s => s.id === openId) || null;
  const quotedIn = (id) => hub.quotes.filter(q => (q.items || []).some(it => it.serviceId === id)).length;
  // Bulk Actions: Delete (as a service's Delete).
  const serviceBulk = useTableBulkDelete({rows:shown, noun:'service', canDelete:(s) => can('delete', s), skipNote:'not yours to delete',
    remove:(ids) => { setServices(ss => ss.filter(s => !ids.includes(s.id))); if(ids.includes(openId)) setOpenId(null); }, onDone:(n) => hub.toast(`${bulkPlural(n, 'service')} deleted`)});
  const schema = {
    properties:SERVICE_COLUMNS, noun:'service', searchKeys:['name', 'description'], canCreateProperty:false, bulkActions:serviceBulk.bulkActions,
    filterProps:[{key:'name', label:'Service Name', type:'text'}, {key:'price', label:'Price', type:'number'}, {key:'milestoneCount', label:'Milestones', type:'number'}],
    selectValues:{},
    renderCell:(key, r) => key === 'name' ? <ContactName name={r.name} onOpen={()=>setOpenId(r.id)} style={{fontSize:'inherit', fontWeight:500}}/> : undefined,
    renderActions:(r) => { const s = services.find(x => x.id === r.id);
      return <RowActionsMenu title="Service actions" width={MENU_W} items={[
        {label:'View service', onClick:()=>setOpenId(r.id)}, ...(can('edit', s) ? [{label:'Edit service', onClick:()=>setForm({initial:s})}] : []),
        ...(can('delete', s) ? [{label:'Delete service', danger:true, onClick:()=>setDeleting(s)}] : [])]}/>; },
  };
  const save = (vals) => {
    if(form.initial) setServices(ss => ss.map(s => s.id === form.initial.id ? {...s, ...vals} : s));
    else { const rec = newServiceRecord(vals); setServices(ss => [...ss, rec]); setOpenId(rec.id); }
    setForm(null);
    hub.toast(form.initial ? 'Service saved' : 'Service created');
  };
  return (
    <div style={{flex:1, minWidth:0, minHeight:0, display:'flex', flexDirection:'column', position:'relative', overflow:'hidden'}}>
      <RecordViewsModule schema={schema} rows={shown.map(serviceRow)} columns={SERVICE_COLUMNS.map(c => c.key)}
        defaultViews={[{id:'svcv-all', name:'All Services', sort:{key:'name', dir:'asc'}}]}
        actions={() => can('create') && <StCta icon="plus" title="New service" onClick={()=>{ setOpenId(null); setForm({}); }}/>}
        overlay={form ? <ServiceFormPanel key={form.initial ? form.initial.id : 'new'} initial={form.initial} onCancel={()=>setForm(null)} onSave={save}/>
          : open && <DetailPanel title={open.name} onClose={()=>setOpenId(null)}
          menuItems={[...(can('edit', open) ? [{label:'Edit service', onClick:()=>setForm({initial:open})}] : []), ...(can('delete', open) ? [{label:'Delete service', danger:true, onClick:()=>setDeleting(open)}] : [])]}>
          <ServiceDetail service={open}/>
        </DetailPanel>}/>
      {serviceBulk.bulkModal}
      {deleting && <StModal title="Delete service" primary="Delete service" danger onCancel={()=>setDeleting(null)}
        onSubmit={()=>{ setServices(ss => ss.filter(s => s.id !== deleting.id)); if(openId === deleting.id) setOpenId(null); setDeleting(null); hub.toast('Service deleted'); }}>
        <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>
          {deleting.name} will be removed from the catalog.{quotedIn(deleting.id) ? ` ${plural(quotedIn(deleting.id), 'quotation')} that include it keep it as it was quoted.` : ''}
        </div>
      </StModal>}
    </div>
  );
}

Object.assign(window, {SAMPLE_SERVICES, withMilestonePrices, servicePrice, ServicesPage, ServiceFormPanel, newServiceRecord, MilestonesEditor, PageSidePanel, PanelFields, DetailPanel, fmtMoney});
