/* HOF Pulse ERP — Playbooks (Settings → Templates → Playbooks).

   A playbook is a short reference document for calls: a name and up to three sections, each a
   Section Header and a Text Description. Created and edited like a Form (forms.jsx): one wide
   side panel — the sections managed on the left, the playbook as it reads during a call on the
   right. Chosen before dialing and shown beside the call (callPanel.jsx); it is not a tab on the
   record detail pages. Stored in settings data (`playbooks`). */

const PLAYBOOK_MAX_SECTIONS = 3;
const playbookId = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const SAMPLE_PLAYBOOKS = () => [
  {id:'pb-discovery', name:'Discovery Call', createdAt:new Date('2026-10-20T10:00:00'), sections:[
    {id:'pb-d-1', header:'Open the call', text:'Introduce yourself and HOF Migration. Confirm the customer has 20 minutes, and say what the call will cover: their goals, their background, and the next step.'},
    {id:'pb-d-2', header:'Understand their goals', text:'Which country and programme are they interested in — Canada PR, Australia, US NIW?\nWho is applying: alone, or with a spouse and children?\nWhen do they want to move?'},
    {id:'pb-d-3', header:'Close with a next step', text:'Summarise what you heard. Offer the eligibility assessment and book the follow-up before the call ends.'},
  ]},
  {id:'pb-fee', name:'Fee Discussion', createdAt:new Date('2026-10-22T15:30:00'), sections:[
    {id:'pb-f-1', header:'Recap the service', text:'Remind them of the programme and the services included in the quotation.'},
    {id:'pb-f-2', header:'Explain the payment terms', text:'Walk through the installments and when each one is due. Ask whether the customer is willing to pay, and when.'},
  ]},
];
// Saved playbooks, else the sample CRM instance's samples (another instance starts with none).
const playbooksOf = (data) => (data && data.playbooks) || (ACTIVE_CRM.sample ? SAMPLE_PLAYBOOKS() : []);

/* A playbook's sections as they read: header, then its text (line breaks kept). */
function PlaybookSections({playbook, empty = 'No sections yet.'}){
  const sections = (playbook && playbook.sections) || [];
  if(!sections.length) return <div style={{fontSize:13, color:T.attioMuted}}>{empty}</div>;
  return (
    <div style={{display:'flex', flexDirection:'column', gap:18}}>
      {sections.map((s, i) => (
        <div key={s.id || i} style={{display:'flex', flexDirection:'column', gap:6}}>
          <div style={{fontSize:14, fontWeight:600, color: s.header ? T.attioText : T.attioFaint}}>{s.header || `Section ${i + 1}`}</div>
          <div style={{fontSize:13, lineHeight:1.6, color: s.text ? T.attioText : T.attioFaint, whiteSpace:'pre-wrap', overflowWrap:'anywhere'}}>{s.text || 'No text yet.'}</div>
        </div>
      ))}
    </div>
  );
}

/* New / Edit playbook — the Form editor's frame: details and sections on the left, preview on the right. */
function PlaybookEditorPanel({playbook, onCancel, onSave}){
  const [name, setName] = React.useState(playbook ? playbook.name : '');
  const [sections, setSections] = React.useState(() => playbook && playbook.sections.length
    ? playbook.sections.map(s => ({...s})) : [{id:playbookId('pbs'), header:'', text:''}]);
  const setSection = (id, p) => setSections(ss => ss.map(s => s.id === id ? {...s, ...p} : s));
  const move = (i, d) => setSections(ss => { const n = ss.slice(); const [s] = n.splice(i, 1); n.splice(i + d, 0, s); return n; });
  const full = sections.length >= PLAYBOOK_MAX_SECTIONS;
  const problems = [];
  if(!name.trim()) problems.push('Give the playbook a name.');
  if(!sections.length) problems.push('Add at least one section.');
  if(sections.some(s => !s.header.trim())) problems.push('Every section needs a header.');
  if(sections.some(s => !s.text.trim())) problems.push('Every section needs text.');
  const ok = !problems.length;
  const save = () => ok && onSave({name:name.trim(), sections:sections.map(s => ({id:s.id, header:s.header.trim(), text:s.text.trim()}))});
  const iconBtn = (icon, title, onClick, disabled) => <button type="button" title={title} aria-label={title} disabled={disabled} onClick={onClick}
    style={{border:'none', background:'transparent', cursor: disabled ? 'default' : 'pointer', display:'flex', padding:4, opacity: disabled ? .35 : 1}}><Icon name={icon} size={13} color={T.gray600}/></button>;
  const label = {fontSize:12.5, color:T.attioMuted};
  const sectionLabel = {fontSize:11, fontWeight:600, color:T.attioFaint, textTransform:'uppercase', letterSpacing:.4};
  return (
    <CreatePanelFrame title={playbook ? 'Edit Playbook' : 'New Playbook'} onClose={onCancel} placement="fixed" width="min(1120px, calc(100vw - 72px))" flush more={false}
      actions={<>
        <StSecondary label="Cancel" onClick={onCancel}/>
        <StCta label={playbook ? 'Save changes' : 'Create playbook'} disabled={!ok} onClick={save}/>
      </>}>
      {/* Left — the playbook's name, then its sections. */}
      <div style={{flex:1, minWidth:0, overflowY:'auto', padding:20, display:'flex', flexDirection:'column', gap:16}}>
        <span style={sectionLabel}>Playbook details</span>
        <Field label="Playbook name" wide><input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Discovery Call" style={fieldText}/></Field>
        <div style={{borderTop:`1px solid ${T.border}`, margin:'4px -20px 0'}}/>
        <span style={sectionLabel}>Sections · {sections.length} of {PLAYBOOK_MAX_SECTIONS}</span>
        {sections.map((s, i) => (
          <div key={s.id} style={{border:`1px solid ${T.attioLine}`, borderRadius:12, padding:16, display:'flex', flexDirection:'column', gap:14}}>
            <div style={{display:'flex', alignItems:'center', gap:6}}>
              <span style={{flex:1, fontSize:14, fontWeight:500, color:T.attioText, fontVariantNumeric:'tabular-nums'}}>Section # {i + 1}</span>
              {iconBtn('arrowUp', 'Move up', ()=>move(i, -1), i === 0)}
              {iconBtn('arrowDown', 'Move down', ()=>move(i, 1), i === sections.length - 1)}
              {iconBtn('trash', 'Remove section', ()=>setSections(ss => ss.filter(x => x.id !== s.id)))}
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:6}}>
              <span style={label}>Section Header</span>
              <input value={s.header} onChange={e=>setSection(s.id, {header:e.target.value})} placeholder="e.g. Open the call" aria-label={`Section ${i + 1} header`} style={fieldText}/>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:6}}>
              <span style={label}>Text Description</span>
              <textarea value={s.text} onChange={e=>setSection(s.id, {text:e.target.value})} rows={5} aria-label={`Section ${i + 1} text`}
                placeholder="What to say or ask in this part of the call" style={{...fieldText, resize:'vertical', lineHeight:1.5}}/>
            </div>
          </div>
        ))}
        <button type="button" disabled={full} onClick={()=>!full && setSections(ss => [...ss, {id:playbookId('pbs'), header:'', text:''}])}
          title={full ? `A playbook has at most ${PLAYBOOK_MAX_SECTIONS} sections` : undefined}
          style={{...btnSecondarySm, alignSelf:'flex-start', opacity: full ? .45 : 1, cursor: full ? 'default' : 'pointer'}}>
          <Icon name="plus" size={12} color={T.gray600}/> Add section
        </button>
        {full && <span style={{fontSize:12.5, color:T.attioMuted}}>A playbook has at most {PLAYBOOK_MAX_SECTIONS} sections.</span>}
      </div>
      {/* Right — the playbook as it reads during a call. */}
      <div style={{width:420, flexShrink:0, overflowY:'auto', padding:20, borderLeft:`1px solid ${T.border}`, background:T.headerBg}}>
        <div style={{...sectionLabel, marginBottom:10}}>Preview</div>
        <div style={{background:'#fff', border:`1px solid ${T.attioLine}`, borderRadius:10, padding:16, display:'flex', flexDirection:'column', gap:14}}>
          <div style={{fontSize:15, fontWeight:600, color: name.trim() ? T.attioText : T.attioFaint}}>{name.trim() || 'Playbook name'}</div>
          <PlaybookSections playbook={{sections}}/>
        </div>
      </div>
    </CreatePanelFrame>
  );
}

/* Settings → Templates → Playbooks: the list (as Quote Templates), View (DetailPanel) / Edit / Delete, New playbook (icon-only Add). */
function PlaybooksTab({data, setData, say}){
  const list = playbooksOf(data);
  const setList = (fn) => setData(d => ({...d, playbooks:fn(playbooksOf(d))}));
  const [openId, setOpenId] = React.useState(null);
  const [editing, setEditing] = React.useState(null);   // {playbook?}
  const [deleting, setDeleting] = React.useState(null);
  const can = (action, p) => templateCan('playbooks', action, p);
  const shown = list.filter(p => can('view', p));
  const open = shown.find(p => p.id === openId) || null;
  const cols = [{key:'name', label:'Playbook Name', width:260}, {key:'sections', label:'Sections', width:420}, {key:'created', label:'Created', width:150}, {key:'createdBy', label:'Created By', width:170}];
  const rows = shown.map(p => ({id:p.id, createdBy:creatorOf(p), name:p.name, sections:p.sections.map(s => s.header).join(' · '), created:p.createdAt ? fmtQuoteDate(p.createdAt) : ''}));
  const actions = (p) => [{label:'View playbook', onClick:()=>setOpenId(p.id)}, ...(can('edit', p) ? [{label:'Edit playbook', onClick:()=>setEditing({playbook:p})}] : []),
    ...(can('delete', p) ? [{label:'Delete playbook', danger:true, onClick:()=>setDeleting(p)}] : [])];
  const schema = {
    properties:cols, noun:'playbook', searchKeys:['name', 'sections'], canCreateProperty:false, boards:false, selectable:false,
    filterProps:[{key:'name', label:'Name', type:'text'}], selectValues:{},
    renderCell:(key, r) => key === 'name' ? <ContactName name={r.name} onOpen={()=>setOpenId(r.id)} style={{fontSize:'inherit', fontWeight:500}}/> : undefined,
    renderActions:(r) => <RowActionsMenu title="Actions" width={MENU_W} items={actions(list.find(p => p.id === r.id))}/>,
  };
  const save = (vals) => {
    const p = editing.playbook;
    if(p) setList(ps => ps.map(x => x.id === p.id ? {...x, ...vals} : x));
    else setList(ps => [...ps, {id:playbookId('pb'), createdAt:new Date(), createdBy:CURRENT_USER.name, ...vals}]);
    say(p ? 'Saved' : 'Playbook created');
    setEditing(null);
  };
  return (
    <div style={{display:'flex', flexDirection:'column', flex:1, minHeight:0}}>
      <RecordViewsModule schema={schema} rows={rows} columns={cols.map(c => c.key)} storeKey="views:templates-playbooks"
        defaultViews={[{id:'tv-playbooks', name:'All Playbooks', sort:{key:'name', dir:'asc'}}]}
        actions={() => can('create') && <StCta icon="plus" title="New playbook" onClick={()=>{ setOpenId(null); setEditing({}); }}/>}
        overlay={open && <DetailPanel width={520} title={open.name} onClose={()=>setOpenId(null)} menuItems={actions(open).filter(it => !/^View/.test(it.label))}
          fields={[['Sections', String(open.sections.length)], ['Created', open.createdAt ? fmtQuoteDate(open.createdAt) : ''], ['Created by', creatorOf(open)]]}>
          <PlaybookSections playbook={open}/>
        </DetailPanel>}/>
      {editing && <PlaybookEditorPanel playbook={editing.playbook} onCancel={()=>setEditing(null)} onSave={save}/>}
      {deleting && <StModal title="Delete playbook" primary="Delete" danger onCancel={()=>setDeleting(null)}
        onSubmit={()=>{ setList(ps => ps.filter(p => p.id !== deleting.id)); if(openId === deleting.id) setOpenId(null); setDeleting(null); say('Deleted'); }}>
        <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>{deleting.name} will be deleted. It won't be offered on calls any more.</div>
      </StModal>}
    </div>
  );
}

Object.assign(window, {PlaybooksTab, PlaybookSections, PlaybookEditorPanel, playbooksOf, PLAYBOOK_MAX_SECTIONS});
