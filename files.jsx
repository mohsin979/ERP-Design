/* HOF Pulse ERP — Files on a record (Contacts, Deals, Customers → Files tab).

   A file is one of the record's activities (type 'file'), so it shows in the record's activity
   feed and in Activity's filters like everything else. Two lists, as pills over the tab:
     Added files — uploaded to the record by a user;
     Received    — attachments that came in with the record's emails.
   Each list has search and filters (File Type, Date Added, Added By) — the activity feeds'
   toolbar. A file opens in the right pane: its preview (images), name, description and
   details; Edit renames it or changes the description; ⋯ downloads or deletes it. Deleting
   removes the file and leaves a "File deleted" activity, so the record keeps that it was there.
   What a person can do follows their Files permissions on the record (Edit Permissions → Tools). */

const FILE_MAX_BYTES = 2 * 1024 * 1024;   // kept in this browser with the record — small files only in the prototype
const FILE_KINDS = [
  {kind:'PDF',          test:(n, m) => /\.pdf$/i.test(n) || m === 'application/pdf'},
  {kind:'Image',        test:(n, m) => /^image\//.test(m || '') || /\.(png|jpe?g|gif|webp|svg|heic)$/i.test(n)},
  {kind:'Document',     test:(n) => /\.(docx?|rtf|txt|odt|pages)$/i.test(n)},
  {kind:'Spreadsheet',  test:(n) => /\.(xlsx?|csv|numbers|ods)$/i.test(n)},
];
const fileKindOf = (f) => (FILE_KINDS.find(k => k.test(f.name || '', f.mime || '')) || {kind:'Other'}).kind;
const fileExt = (name) => { const m = /\.([a-z0-9]+)$/i.exec(name || ''); return m ? m[1].toUpperCase().slice(0, 4) : 'FILE'; };
const fmtBytes = (n) => !n && n !== 0 ? '' : n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
const FILE_VIEWS = [{id:'added', name:'Added files'}, {id:'received', name:'Received'}];

function fileFilterSchema(team){
  return {
    properties:[], noun:'file', searchKeys:['text'], boards:false, selectable:false, cardSettings:false, associated:false,
    filterProps:[
      {key:'kind', label:'File Type', type:'select', ops:['is', 'isNot', 'isAnyOf']},
      {key:'date', label:'Date Added', type:'date', ops:['is', 'isNot', 'isBefore', 'isAfter', 'isBetween']},
      {key:'by', label:'Added By', type:'select', ops:['is', 'isNot', 'isAnyOf']},
    ],
    selectValues:{kind:[...FILE_KINDS.map(k => k.kind), 'Other'], by:['You', 'Customer', ...(team || [])]},
  };
}
const fileRow = (a) => ({id:a.id, _act:a, kind:fileKindOf(a), date:activityDateValue(a.at),
  by: a.source === 'you' ? 'You' : a.source === 'client' ? 'Customer' : a.by || '', text:[a.name, a.description, a.emailSubject].filter(Boolean).join(' ')});

// The extension on a small tile — the file's icon in lists.
function FileTile({a, size = 34}){
  const k = fileKindOf(a);
  const tone = {PDF:'#D92D20', Image:'#0E9F6E', Document:'#1869EC', Spreadsheet:'#16A34A'}[k] || T.gray600;
  if(k === 'Image' && a.dataUrl) return <span style={{width:size, height:size, borderRadius:8, overflow:'hidden', flexShrink:0, border:`1px solid ${T.attioLine}`}}><img src={a.dataUrl} alt="" style={{width:'100%', height:'100%', objectFit:'cover'}}/></span>;
  return <span style={{width:size, height:size, borderRadius:8, flexShrink:0, background:T.headerBg, border:`1px solid ${T.attioLine}`, color:tone,
    fontSize:9.5, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', letterSpacing:.3}}>{fileExt(a.name)}</span>;
}
function FileNavItem({a, selected, onSelect}){
  const [h, setH] = React.useState(false);
  const who = a.origin === 'received' ? (a.emailFrom || 'Customer') : a.source === 'you' ? 'You' : a.by;
  return (
    <div onClick={onSelect} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{display:'flex', alignItems:'center', gap:10, padding:'10px 20px', cursor:'pointer', background: selected ? '#F4F5F7' : h ? T.headerBg : 'transparent'}}>
      <FileTile a={a}/>
      <div style={{minWidth:0, flex:1}}>
        <div title={a.name} style={{fontSize:13, fontWeight:500, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{a.name}</div>
        <div style={{fontSize:12, color:T.attioMuted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
          {[fmtBytes(a.size), fmtActDate(new Date(a.at)), who].filter(Boolean).join(' · ')}
        </div>
      </div>
    </div>
  );
}

// Download a file kept with the record (a data URL); sample files have no content to download.
const downloadFile = (a) => { if(!a.dataUrl) return false; const l = document.createElement('a'); l.href = a.dataUrl; l.download = a.name; document.body.appendChild(l); l.click(); l.remove(); return true; };

function FileDetail({a, contact, canEdit, canDelete, onUpdate, onDelete, onStub}){
  const [editing, setEditing] = React.useState(false);
  const [d, setD] = React.useState({name:a.name, description:a.description || ''});
  const [confirm, setConfirm] = React.useState(false);
  React.useEffect(() => { setEditing(false); setD({name:a.name, description:a.description || ''}); }, [a.id]);
  const dirty = d.name.trim() !== a.name || d.description.trim() !== (a.description || '');
  const save = () => { onUpdate(a.id, {name:d.name.trim(), description:d.description.trim()}); setEditing(false); };
  const menu = [
    {label:'Download File', icon:'export', onClick:()=>{ if(!downloadFile(a)) onStub('Download · this sample file has no content'); }},
    ...(canDelete ? [{label:'Delete File', icon:'trash', danger:true, onClick:()=>setConfirm(true)}] : []),
  ];
  const isImage = fileKindOf(a) === 'Image' && a.dataUrl;
  return (
    <DetailFrame head={activityHead(a, contact)} actions={editing ? saveBar(()=>{ setD({name:a.name, description:a.description || ''}); setEditing(false); }, save, !!d.name.trim() && dirty)
      : <>{canEdit && headerBtn('Edit', ()=>setEditing(true))}<DetailMoreMenu items={menu}/></>}>
      <div style={{display:'flex', flexDirection:'column', gap:16}}>
        {!editing && (
          <div style={{border:`1px solid ${T.attioLine}`, borderRadius:10, background:T.headerBg, minHeight:140, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden'}}>
            {isImage ? <img src={a.dataUrl} alt={a.name} style={{maxWidth:'100%', maxHeight:320, display:'block'}}/>
              : <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:24}}><FileTile a={a} size={48}/>
                  <span style={{fontSize:12.5, color:T.attioMuted}}>{fileKindOf(a)}{a.size ? ` · ${fmtBytes(a.size)}` : ''}</span></div>}
          </div>
        )}
        {stack(<>
          <Field label="File Name">{editing ? <input autoFocus value={d.name} onChange={e=>setD(x => ({...x, name:e.target.value}))} style={fieldText}/> : <ReadValue>{a.name}</ReadValue>}</Field>
          <Field label="Description">{editing
            ? <textarea value={d.description} onChange={e=>setD(x => ({...x, description:e.target.value}))} rows={3} placeholder="What this file is" style={{...fieldText, resize:'vertical', lineHeight:1.5}}/>
            : <ReadValue>{a.description}</ReadValue>}</Field>
          {!editing && <>
            <Field label="Type"><ReadValue>{fileKindOf(a)}</ReadValue></Field>
            <Field label="Size"><ReadValue>{fmtBytes(a.size)}</ReadValue></Field>
            {a.origin === 'received'
              ? <><Field label="Received from"><ReadValue>{a.emailFrom || 'Customer'}</ReadValue></Field>
                  <Field label="With Email"><ReadValue>{a.emailSubject}</ReadValue></Field></>
              : <Field label="Added by"><PersonValue person={activityActor(a, contact)}/></Field>}
            <Field label={a.origin === 'received' ? 'Received' : 'Added'}><ReadValue>{fmtActStamp(new Date(a.at))}</ReadValue></Field>
          </>}
        </>)}
      </div>
      {confirm && <StModal title="Delete File" primary="Delete File" danger onCancel={()=>setConfirm(false)} onSubmit={()=>{ setConfirm(false); onDelete(a); }}>
        <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>{a.name} will be removed from this record. Its activity will show that it was deleted. This can't be undone.</div>
      </StModal>}
    </DetailFrame>
  );
}

/* The Files tab. `acts`: the record's own activity (as shown on it); `contact`: the record as
   the activity rows read it (owner); `team`: names for Added By. Writes go through the hub. */
function FilesTab({acts, contact, team, onStub}){
  const hub = useRecordHub();
  const ra = useRecordAccess();
  const object = ra ? ra.object : 'contacts', record = ra ? ra.record : contact;
  const can = (action) => !ra || toolCan(object, record, 'files', action);
  const [view, setView] = React.useState('added');
  const [byView, setByView] = React.useState({});
  const st = byView[view] || {search:'', filters:EMPTY_FILTERS()};
  const patch = (p) => setByView(m => ({...m, [view]:{...(m[view] || {search:'', filters:EMPTY_FILTERS()}), ...p}}));
  const [selectedId, setSelectedId] = React.useState(null);
  const [error, setError] = React.useState('');
  const input = React.useRef(null);
  const schema = React.useMemo(() => fileFilterSchema(team), [team]);

  const files = (acts || []).filter(a => a.type === 'file' && (a.origin === 'received' ? 'received' : 'added') === view);
  const q = st.search.trim().toLowerCase();
  const rows = files.map(fileRow).filter(r => !q || r.text.toLowerCase().includes(q));
  const shown = applyFilters(rows, st.filters, schema.filterProps).map(r => r._act).sort((a, b) => new Date(b.at) - new Date(a.at));
  const selected = shown.find(a => a.id === selectedId) || shown[0] || null;

  const upload = (e) => {
    const list = Array.from(e.target.files || []);
    e.target.value = '';
    const big = list.find(f => f.size > FILE_MAX_BYTES);
    if(big){ setError(`${big.name} is over ${fmtBytes(FILE_MAX_BYTES)} — choose a smaller file.`); return; }
    setError('');
    list.forEach(f => {
      const r = new FileReader();
      r.onload = () => {
        const a = hub.add(object, record.id, {type:'file', origin:'added', source:'you', by:null, name:f.name, size:f.size, mime:f.type, dataUrl:r.result, description:''});
        if(a) setSelectedId(a.id);
      };
      r.readAsDataURL(f);
    });
  };
  const remove = (a) => {
    hub.remove(object, record.id, a.id);
    hub.add(object, record.id, {type:'fileChange', action:'deleted', fileName:a.name, source:'you', by:null});
    setSelectedId(null);
  };
  const empty = files.length ? 'No files match these filters' : view === 'added' ? 'No files added yet' : 'No files received yet';
  return (
    <RecordSchema.Provider value={schema}>
      <div style={{flex:1, minHeight:0, display:'flex', flexDirection:'column'}}>
        <RecordToolbar inset="settings" views={FILE_VIEWS} activeViewId={view} onSelectView={(id)=>{ setView(id); setSelectedId(null); }}
          controls={view === 'added' && can('create') && <>
            <input ref={input} type="file" multiple onChange={upload} style={{display:'none'}}/>
            <button onClick={()=>input.current && input.current.click()} style={{...btnPrimarySm(), display:'inline-flex', alignItems:'center', gap:6}}>
              <Icon name="plus" size={13} color="#fff"/> Upload File
            </button>
          </>}
          search={st.search} onSearch={(v)=>patch({search:v})}
          filters={st.filters} setFilters={(f)=>patch({filters:typeof f === 'function' ? f(st.filters) : f})}
          appliedFilterCount={countAppliedFilters(st.filters, schema.filterProps)}/>
        {error && <div style={{padding:'8px 20px', fontSize:12.5, color:T.red, borderBottom:`1px solid ${T.attioLine}`}}>{error}</div>}
        <div style={{flex:1, minHeight:0, display:'flex', overflow:'hidden'}}>
          <div style={{width:380, flexShrink:0, overflowY:'auto', borderRight:`1px solid ${T.border}`, padding:'8px 0'}}>
            {shown.map(a => <FileNavItem key={a.id} a={a} selected={selected && selected.id === a.id} onSelect={()=>setSelectedId(a.id)}/>)}
            {!shown.length && <EmptyState compact title={empty}/>}
          </div>
          <div style={{flex:1, minWidth:0, minHeight:0, display:'flex', flexDirection:'column'}}>
            {selected && <FileDetail key={selected.id} a={selected} contact={contact} canEdit={can('edit')} canDelete={can('delete')} onStub={onStub}
              onUpdate={(id, p)=>hub.update(object, record.id, id, p)} onDelete={remove}/>}
          </div>
        </div>
      </div>
    </RecordSchema.Provider>
  );
}

// A file opened from the Activity feed: the same detail, with the record's permissions.
function FileActivityDetail({a, contact, onStub}){
  const hub = useRecordHub(), ra = useRecordAccess();
  const object = ra ? ra.object : 'contacts', record = ra ? ra.record : contact;
  const can = (action) => !ra || toolCan(object, record, 'files', action);
  return <FileDetail a={a} contact={contact} canEdit={can('edit')} canDelete={can('delete')} onStub={onStub}
    onUpdate={(id, p)=>hub.update(object, record.id, id, p)}
    onDelete={(f)=>{ hub.remove(object, record.id, f.id); hub.add(object, record.id, {type:'fileChange', action:'deleted', fileName:f.name, source:'you', by:null}); }}/>;
}
// A "File deleted" activity, as it reads on its own.
function FileChangeDetail({a, contact}){
  return (
    <DetailFrame head={activityHead(a, contact)}>
      {stack(<>
        <Field label="File"><ReadValue>{a.fileName}</ReadValue></Field>
        <Field label="Deleted"><ReadValue>{fmtActStamp(new Date(a.at))}</ReadValue></Field>
      </>)}
    </DetailFrame>
  );
}

/* Sample attachments received with the sample records' emails: a few received emails per record
   carry a document, as a client's emails do (passport scans, test results, payslips). */
const SAMPLE_ATTACHMENTS = [
  ['Passport_scan.pdf', 482000, 'application/pdf'], ['IELTS_TRF.pdf', 236000, 'application/pdf'], ['Degree_transcript.pdf', 918000, 'application/pdf'],
  ['Employment_letter.docx', 64000, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], ['Bank_statement_Sep.pdf', 352000, 'application/pdf'],
  ['CNIC_front.jpg', 188000, 'image/jpeg'], ['Payslips_Q3.xlsx', 41000, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
];
function withSampleAttachments(actsByRecord){
  let n = 0;
  return Object.fromEntries(Object.entries(actsByRecord || {}).map(([rid, list]) => {
    const received = (list || []).filter(a => a.type === 'email' && a.direction === 'received').slice(0, 2);
    // Once per email: lists that already carry its attachments keep them as they are.
    const files = received.map((e, i) => {
      const [name, size, mime] = SAMPLE_ATTACHMENTS[(n++) % SAMPLE_ATTACHMENTS.length];
      return {id:`${e.id}-att${i}`, type:'file', origin:'received', at:new Date(new Date(e.at).getTime() + 1000), source:'client', by:null,
        name, size, mime, dataUrl:null, description:'', emailId:e.id, emailSubject:e.title, emailFrom:'Customer'};
    }).filter(f => !(list || []).some(x => x.id === f.id));
    return [rid, [...files, ...(list || [])].sort((x, y) => new Date(y.at) - new Date(x.at))];
  }));
}

/* Sample upcoming meetings: a few records have a meeting booked in the coming days. */
const SAMPLE_UPCOMING = [
  ['Document review call', 'Google Meet', 1, 11, 30], ['Eligibility assessment', 'Zoom', 2, 15, 45], ['Petition walkthrough', 'Google Meet', 3, 10, 60],
  ['IELTS results discussion', 'Zoom', 5, 16, 30], ['Fee proposal review', 'Google Meet', 6, 12, 30],
];
function withUpcomingMeetings(actsByRecord, every = 7){
  let i = 0;
  return Object.fromEntries(Object.entries(actsByRecord || {}).map(([rid, list], n) => {
    if(n % every !== 0 || i >= SAMPLE_UPCOMING.length) return [rid, list];
    const [title, platform, days, h, mins] = SAMPLE_UPCOMING[i++];
    const owner = ((list || []).find(a => a.source === 'team' && a.by) || {}).by || null;
    const at = new Date(); at.setDate(at.getDate() + days); at.setHours(h, 0, 0, 0);
    return [rid, [{id:`${rid}-upcoming-${i}`, type:'meeting', logged:false, status:'scheduled', at, scheduledFor:at, title, platform, durationMin:mins,
      description:'', organizer:owner, source:'team', by:owner}, ...(list || [])]];
  }));
}
Object.assign(window, {withUpcomingMeetings, FileActivityDetail, FilesTab, FileDetail, FileChangeDetail, FileTile, fileKindOf, fmtBytes, withSampleAttachments, downloadFile});
