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

/* ── The built-in file viewer (2026-11-17) ── a file shown inside the CRM: a PDF page by page
   (pdf.js), an image (JPG, PNG…), a Word document as its text and formatting (.docx — mammoth).
   Anything else, the old .doc format included, can't be shown: its tile, with Download on the
   viewer's header. The libraries load the first time they're needed (cdnjs). Sample files carry
   no content, so a sample page stands in for them (fileSourceOf). Used where an email is
   edited — the email template editor and a sequence's Edit Email: in the Preview pane, in the
   email's place (emails.jsx EmailSplit). */
const PDF_JS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', PDF_WORKER_JS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const MAMMOTH_JS = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
const FILE_SCRIPTS = {};
const loadFileScript = (src) => FILE_SCRIPTS[src] || (FILE_SCRIPTS[src] = new Promise((resolve, reject) => {
  const el = document.createElement('script'); el.src = src; el.crossOrigin = 'anonymous'; el.onload = resolve;
  el.onerror = () => { delete FILE_SCRIPTS[src]; reject(new Error(`Could not load ${src}`)); }; document.head.appendChild(el); }));
const dataUrlBytes = (url) => { const b = atob(String(url).slice(String(url).indexOf(',') + 1)), out = new Uint8Array(b.length); for(let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i); return out; };
const fileTitle = (name) => String(name || 'File').replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim();
const SAMPLE_FILE_LINES = ['Sample file.', 'It stands in for the document a client or the team attaches here:', 'the prototype keeps no content for its sample files.'];
// A one-page PDF with a title and a few lines (Helvetica) — the sample PDFs' content.
function samplePdfUrl(title, lines){
  const esc = (t) => String(t).replace(/[^\x20-\x7E]/g, ' ').replace(/([\\()])/g, '\\$1');
  const text = `BT /F2 20 Tf 56 760 Td (${esc(title)}) Tj ET\n` + lines.map((l, i) => `BT /F1 11 Tf 56 ${724 - i * 18} Td (${esc(l)}) Tj ET`).join('\n')
    + `\n0.85 0.85 0.87 RG 56 742 m 539 742 l S`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'];
  let pdf = '%PDF-1.4\n'; const at = [];
  objects.forEach((o, i) => { at.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + at.map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')
    + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return `data:application/pdf;base64,${btoa(pdf)}`;
}
// A sample picture: a plain card with the file's name.
function sampleImageUrl(title){
  const c = document.createElement('canvas'); c.width = 960; c.height = 600;
  const g = c.getContext('2d'); g.fillStyle = '#F4F5F7'; g.fillRect(0, 0, 960, 600); g.fillStyle = '#fff'; g.fillRect(60, 60, 840, 480);
  g.strokeStyle = '#DDDFE4'; g.lineWidth = 2; g.strokeRect(60, 60, 840, 480);
  g.fillStyle = '#15141B'; g.font = '600 34px system-ui, sans-serif'; g.fillText(title, 100, 140);
  g.fillStyle = '#6E6E73'; g.font = '22px system-ui, sans-serif'; SAMPLE_FILE_LINES.forEach((l, i) => g.fillText(l, 100, 200 + i * 36));
  return c.toDataURL('image/jpeg', .9);
}
/* What the viewer shows for a file: {kind:'pdf' | 'image', url} | {kind:'docx', url} |
   {kind:'html', html} (a sample Word document) | {kind:'none'}. */
function fileSourceOf(a){
  const kind = fileKindOf(a), title = fileTitle(a.name);
  if(a.dataUrl) return kind === 'PDF' ? {kind:'pdf', url:a.dataUrl} : kind === 'Image' ? {kind:'image', url:a.dataUrl} : /\.docx$/i.test(a.name || '') ? {kind:'docx', url:a.dataUrl} : {kind:'none'};
  if(kind === 'PDF') return {kind:'pdf', url:samplePdfUrl(title, SAMPLE_FILE_LINES)};
  if(kind === 'Image') return {kind:'image', url:sampleImageUrl(title)};
  if(/\.docx?$/i.test(a.name || '')) return {kind:'html', html:`<h1>${escHtml(title)}</h1>${SAMPLE_FILE_LINES.map(l => `<p>${l}</p>`).join('')}`};
  return {kind:'none'};
}
const FILE_PAGE = {background:'#fff', border:`1px solid ${T.attioLine}`, borderRadius:6, boxShadow:'0 1px 3px rgba(16,24,40,.08)'};
// A PDF, each page drawn at the viewer's width.
function PdfPages({url}){
  const ref = React.useRef(null);
  const [state, setState] = React.useState('loading');
  React.useEffect(() => {
    let off = false; setState('loading');
    (async () => {
      try {
        // The worker script is loaded here too, so the pages are read on the page itself (no separate worker to start).
        await loadFileScript(PDF_JS); await loadFileScript(PDF_WORKER_JS);
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_JS;
        const doc = await window.pdfjsLib.getDocument({data:dataUrlBytes(url)}).promise;
        if(off || !ref.current) return;
        const box = ref.current, width = box.clientWidth || 480, ratio = Math.min(2, window.devicePixelRatio || 1);
        box.innerHTML = '';
        for(let n = 1; n <= doc.numPages; n++){
          const page = await doc.getPage(n), vp = page.getViewport({scale:width / page.getViewport({scale:1}).width * ratio});
          const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
          c.style.cssText = `display:block;width:100%;background:#fff;border:1px solid ${T.attioLine};border-radius:6px;box-shadow:0 1px 3px rgba(16,24,40,.08)`;
          if(off) return; box.appendChild(c);
          await page.render({canvasContext:c.getContext('2d'), viewport:vp}).promise;
        }
        if(!off) setState('ready');
      } catch(e){ if(!off) setState('error'); }
    })();
    return () => { off = true; };
  }, [url]);
  return <>
    {state !== 'ready' && <div style={{fontSize:12.5, color:T.attioMuted, padding:'8px 2px'}}>{state === 'error' ? 'This PDF can’t be shown' : 'Opening…'}</div>}
    <div ref={ref} style={{display:'flex', flexDirection:'column', gap:12}}/>
  </>;
}
// A Word document (.docx), as its text and formatting.
function DocxPage({url}){
  const [doc, setDoc] = React.useState(null);   // {html} | {error}
  React.useEffect(() => {
    let off = false; setDoc(null);
    loadFileScript(MAMMOTH_JS).then(() => window.mammoth.convertToHtml({arrayBuffer:dataUrlBytes(url).buffer}))
      .then(r => { if(!off) setDoc({html:r.value}); }).catch(() => { if(!off) setDoc({error:true}); });
    return () => { off = true; };
  }, [url]);
  if(!doc) return <div style={{fontSize:12.5, color:T.attioMuted, padding:'8px 2px'}}>Opening…</div>;
  return doc.error ? <div style={{fontSize:12.5, color:T.attioMuted, padding:'8px 2px'}}>This document can’t be shown</div> : <DocHtmlPage html={doc.html}/>;
}
// A document's HTML on a page (no scripts run; links open in a new tab).
function DocHtmlPage({html}){
  const page = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{margin:0;padding:36px 40px;font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.6;color:#15141B}`
    + `h1{font-size:22px;margin:0 0 14px}h2{font-size:18px}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #DDDFE4;padding:4px 8px}</style></head><body>${String(html || '').replace(/<script[\s\S]*?<\/script>/gi, '')}</body></html>`;
  return <iframe title="Document" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={page} style={{...FILE_PAGE, width:'100%', height:640, display:'block'}}/>;
}
function FileViewer({a}){
  const src = React.useMemo(() => fileSourceOf(a), [a.id, a.dataUrl, a.name]);
  if(src.kind === 'pdf') return <PdfPages url={src.url}/>;
  if(src.kind === 'image') return <img src={src.url} alt={a.name} style={{...FILE_PAGE, display:'block', maxWidth:'100%', alignSelf:'flex-start'}}/>;
  if(src.kind === 'docx') return <DocxPage url={src.url}/>;
  if(src.kind === 'html') return <DocHtmlPage html={src.html}/>;
  return (
    <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'48px 24px'}}><FileTile a={a} size={48}/>
      <span style={{fontSize:12.5, color:T.attioMuted}}>{fileKindOf(a)}{a.size ? ` · ${fmtBytes(a.size)}` : ''}</span></div>
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
