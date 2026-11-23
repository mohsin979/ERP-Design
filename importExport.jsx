/* HOF Pulse ERP — Settings → Import & Export (defined 2026-11-18).

   Import: a record type (Contacts, Deals, Customers — the workspace's), then a CSV file. Each of
   its columns is matched to a property (by name to start with; any can be changed or left out) —
   the properties a person can fill (not the ones the system sets, nor pipeline, stage or links).
   A row whose email or phone is already on a record of that type, or on a row above it in the
   file, is skipped; the rest become records (hub.createRecord — as a form makes them; an owner
   column gives each its owner). Name is required.
   Export: a record type and the properties to include — every record of it as CSV, each value as
   the record shows it.
   History: every import and export — from here or a table's Export (useRecordExportLog) — with who,
   when, how many, and for an import how many were skipped.
   Large exports (decided 2026-11-18): an export of more than 50,000 contacts, 10,000 deals or
   1,000 customers goes ahead, and every Super Admin is emailed — who exported what, how many,
   from where, when — and notified in their bell; the email is kept on the export in History. */

const EXPORT_ALERT_LIMITS = {contacts:50000, deals:10000, customers:1000};
const importExportLogOf = (data) => (data && data.importExportLog) || [];
const ieNoun = (object, n) => (n === 1 ? typeSingular(object, HUB_NOUN[object] || object) : typePlural(object, object.charAt(0).toUpperCase() + object.slice(1))).toLowerCase();

/* Logs an export (and alerts the Super Admins when it's large): (object, count, from) → the entry. */
function useRecordExportLog(){
  const hub = useRecordHub(), engineCtx = useWorkflowEngineCtx();
  return (object, count, from) => {
    if(!hub) return null;
    const data = hub.data, at = new Date().toISOString();
    let alert = null;
    if(count > (EXPORT_ALERT_LIMITS[object] || Infinity)){
      const admins = (data.users || []).filter(u => u.status === 'Activated' && u.preset === SUPER_ADMIN);
      const subject = `Large export: ${count.toLocaleString('en-US')} ${ieNoun(object, count)}`;
      const body = `${CURRENT_USER.name} exported ${count.toLocaleString('en-US')} ${ieNoun(object, count)} from ${from} on ${fmtActStamp(new Date(at))}.`;
      alert = {to:admins.map(u => ({name:u.name, email:u.email})), subject, body};
      if(engineCtx && engineCtx.api && engineCtx.api.notifyUsers) engineCtx.api.notifyUsers(admins.map(u => u.id), subject, body, null, null, 'largeExport');
    }
    const entry = {id:`ie-${Date.now().toString(36)}`, kind:'Export', object, count, from, by:CURRENT_USER.name, at, ...(alert ? {alert} : {})};
    hub.setData(d => ({...d, importExportLog:[entry, ...importExportLogOf(d)].slice(0, 500)}));
    return entry;
  };
}

// A CSV file's rows (quoted fields, commas and line breaks inside quotes, "" for a quote).
function parseCsv(text){
  const rows = []; let row = [], cell = '', q = false;
  const s = String(text || '').replace(/^﻿/, '');
  for(let i = 0; i < s.length; i++){
    const ch = s[i];
    if(q){ if(ch === '"'){ if(s[i + 1] === '"'){ cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if(ch === '"') q = true;
    else if(ch === ',') { row.push(cell); cell = ''; }
    else if(ch === '\n' || ch === '\r'){ if(ch === '\r' && s[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if(cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}
function downloadCsv(lines, fileName){
  const esc = (v) => { const t = String(v ?? ''); return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const blob = new Blob(['﻿' + lines.map(l => l.map(esc).join(',')).join('\r\n')], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${fileName}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const IE_SKIP_KEYS = ['pipeline', 'stage', 'contact', 'deals', 'customers', 'mergeStatus'];
const importableProps = (data, object) => objectProperties(data, object).filter(p => !p.auto && !p.archived && !IE_SKIP_KEYS.includes(p.key)
  && !['File Upload', 'Location', 'Date Range', 'Custom Range'].includes(propertyTypeId(p.type)));
const phoneDigits = (v) => String(v || '').replace(/\D/g, '');

function ImportTab({hub, onDone}){
  const objects = hubObjects();
  const [object, setObject] = React.useState(objects[0]);
  const [file, setFile] = React.useState(null);        // {name, header, rows}
  const [mapping, setMapping] = React.useState({});    // column index → property key ('' = left out)
  const [error, setError] = React.useState('');
  const [result, setResult] = React.useState(null);
  const input = React.useRef(null);
  const props = importableProps(hub.data, object);
  const pick = (e) => {
    const f = (e.target.files || [])[0]; e.target.value = '';
    if(!f) return;
    if(!/\.csv$/i.test(f.name)) return setError('Choose a .csv file.');
    const r = new FileReader();
    r.onload = () => { const all = parseCsv(r.result); if(all.length < 2) return setError('The file has no rows to import.');
      const header = all[0].map(h => String(h).trim()), norm = (x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, '');
      setMapping(Object.fromEntries(header.map((h, i) => { const p = props.find(x => norm(x.label) === norm(h) || norm(x.key) === norm(h)); return [i, p ? p.key : '']; })));
      setFile({name:f.name, header, rows:all.slice(1)}); setError(''); setResult(null); };
    r.readAsText(f);
  };
  const keyCol = (k) => Object.keys(mapping).find(i => mapping[i] === k);
  // Rows already in the CRM (their email or phone on a record of this type) or repeated in the file.
  const plan = React.useMemo(() => {
    if(!file) return null;
    const existing = (hub.records[object] || []), emails = new Set(existing.map(r => String(r.email || '').trim().toLowerCase()).filter(Boolean));
    const phones = new Set(existing.map(r => phoneDigits(r.phone)).filter(d => d.length >= 7));
    const ec = keyCol('email'), pc = keyCol('phone'), nc = keyCol('name');
    const keep = [], skipped = [];
    file.rows.forEach((row, i) => {
      const em = ec != null ? String(row[ec] || '').trim().toLowerCase() : '', ph = pc != null ? phoneDigits(row[pc]) : '';
      const name = nc != null ? String(row[nc] || '').trim() : '';
      if(!name) return skipped.push({i, why:'No name'});
      if((em && emails.has(em)) || (ph.length >= 7 && phones.has(ph))) return skipped.push({i, why:'Already in the CRM'});
      if(em) emails.add(em); if(ph.length >= 7) phones.add(ph);
      keep.push(row);
    });
    return {keep, skipped};
  }, [file, mapping, object, hub.records]);
  const ready = !!file && keyCol('name') != null && plan && plan.keep.length > 0;
  const run = () => {
    if(!ready) return;
    const map = Object.entries(mapping).filter(([, k]) => k);
    plan.keep.forEach(row => {
      const vals = {}; let owner = '';
      map.forEach(([i, k]) => { const p = props.find(x => x.key === k), text = String(row[i] ?? '').trim(); if(!p || !text) return;
        const v = convertPropertyValue({type:'Single-Line Text'}, p, text).value; if(v === '' || v == null) return;
        if(k === 'owner') owner = v; else vals[k] = v; });
      const id = hub.createRecord(object, vals);
      if(owner && id != null) hub.updateRecord(object, id, {owner});
    });
    const entry = {id:`ie-${Date.now().toString(36)}`, kind:'Import', object, count:plan.keep.length, skipped:plan.skipped.length, from:file.name, by:CURRENT_USER.name, at:new Date().toISOString()};
    hub.setData(d => ({...d, importExportLog:[entry, ...importExportLogOf(d)].slice(0, 500)}));
    setResult(entry); setFile(null);
    hub.toast(`${bulkPlural(entry.count, ieNoun(object, 1))} imported${entry.skipped ? ` · ${entry.skipped} skipped` : ''}`);
  };
  const label = {fontSize:12.5, color:T.gray600, width:140, flexShrink:0};
  return (
    <div style={{display:'flex', flexDirection:'column', gap:16, maxWidth:880}}>
      <div style={{display:'flex', alignItems:'center', gap:12}}>
        <span style={label}>Record Type<Req/></span>
        <div style={{width:240}}><FormSelect value={object} options={objects.map(o => ({value:o, label:typePlural(o, o)}))} onChange={(v)=>{ if(v){ setObject(v); setFile(null); setResult(null); } }}/></div>
      </div>
      <div style={{display:'flex', alignItems:'center', gap:12}}>
        <span style={label}>File<Req/></span>
        <input ref={input} type="file" accept=".csv,text/csv" onChange={pick} style={{display:'none'}}/>
        <StSecondary label={<span style={{display:'inline-flex', alignItems:'center', gap:6}}><Icon name="paperclip" size={13} color={T.gray800}/>{file ? file.name : 'Choose CSV File'}</span>} onClick={()=>input.current.click()}/>
        {file && <span style={{fontSize:12.5, color:T.attioMuted}}>{bulkPlural(file.rows.length, 'row')}</span>}
      </div>
      {error && <div style={{fontSize:12.5, color:T.red}}>{error}</div>}
      {file && <>
        <div style={{border:`1px solid ${T.border}`, borderRadius:10, overflow:'hidden'}}>
          <div style={{display:'grid', gridTemplateColumns:'minmax(0, 1fr) minmax(0, 1fr) 260px', gap:12, padding:'10px 14px', background:T.headerBg, fontSize:12.5, fontWeight:500, color:T.gray600}}>
            <span>Column</span><span>First Value</span><span>Property</span>
          </div>
          {file.header.map((h, i) => (
            <div key={i} style={{display:'grid', gridTemplateColumns:'minmax(0, 1fr) minmax(0, 1fr) 260px', gap:12, padding:'8px 14px', alignItems:'center', borderTop:`1px solid ${T.border}`}}>
              <span style={{fontSize:13, color:T.attioText, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{h || `Column ${i + 1}`}</span>
              <span style={{fontSize:13, color:T.attioMuted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{(file.rows[0] || [])[i] || '—'}</span>
              <FormSelect value={mapping[i] || 'skip'} options={[{value:'skip', label:"Don't Import"}, ...props.map(p => ({value:p.key, label:p.label, disabled:Object.entries(mapping).some(([j, k]) => k === p.key && Number(j) !== i)}))]}
                onChange={(v)=>setMapping(m => ({...m, [i]: v && v !== 'skip' ? v : ''}))}/>
            </div>
          ))}
        </div>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <span style={{flex:1, fontSize:13, color:T.attioText}}>
            {keyCol('name') == null ? 'Match a column to Name to import.' : `${bulkPlural(plan.keep.length, ieNoun(object, 1))} to import${plan.skipped.length ? ` · ${plan.skipped.length} skipped (already in the CRM, repeated or without a name)` : ''}`}
          </span>
          <StSecondary label="Cancel" onClick={()=>setFile(null)}/>
          <StCta label={`Import ${plan.keep.length ? plan.keep.length.toLocaleString('en-US') : ''} ${typePlural(object, object)}`.replace(/\s+/g, ' ')} disabled={!ready} onClick={run}/>
        </div>
      </>}
      {result && <div style={{fontSize:13, color:T.attioText}}>{bulkPlural(result.count, ieNoun(object, 1))} imported{result.skipped ? ` · ${result.skipped} skipped` : ''}. <button type="button" onClick={onDone} className={LINK_CLASS} style={{border:'none', background:'transparent', padding:0, cursor:'pointer', fontFamily:'inherit', fontSize:13, color:T.attioText}}>View History</button></div>}
    </div>
  );
}

function ExportTab({hub}){
  const objects = hubObjects();
  const logExport = useRecordExportLog();
  const [object, setObject] = React.useState(objects[0]);
  const all = objectProperties(hub.data, object).filter(p => !p.archived);
  const [picked, setPicked] = React.useState(null);   // property keys (null: all)
  const chosen = picked || all.map(p => p.key);
  const records = hub.records[object] || [];
  const run = () => {
    const props = all.filter(p => chosen.includes(p.key));
    const text = (p, r) => { const v = r[p.key]; if(v == null || v === '') return ''; const f = formatPropertyValueOf(p, v); return f == null ? '' : String(f); };
    downloadCsv([props.map(p => p.label), ...records.map(r => props.map(p => text(p, r)))], `${typePlural(object, object)} export`);
    logExport(object, records.length, 'Import & Export');
    hub.toast(`${bulkPlural(records.length, ieNoun(object, 1))} exported`);
  };
  return (
    <div style={{display:'flex', flexDirection:'column', gap:16, maxWidth:640}}>
      <div style={{display:'flex', alignItems:'center', gap:12}}>
        <span style={{fontSize:12.5, color:T.gray600, width:140, flexShrink:0}}>Record Type<Req/></span>
        <div style={{width:240}}><FormSelect value={object} options={objects.map(o => ({value:o, label:typePlural(o, o)}))} onChange={(v)=>{ if(v){ setObject(v); setPicked(null); } }}/></div>
      </div>
      <div style={{display:'flex', flexDirection:'column', gap:2}}>
        <div style={{display:'flex', alignItems:'center', gap:8, paddingBottom:4}}>
          <span style={{fontSize:12.5, color:T.gray600, flex:1}}>Properties ({chosen.length} of {all.length})<Req/></span>
          <button type="button" onClick={()=>setPicked(chosen.length === all.length ? [] : all.map(p => p.key))} className={LINK_CLASS}
            style={{border:'none', background:'transparent', padding:0, cursor:'pointer', fontFamily:'inherit', fontSize:12.5, color:T.attioText}}>{chosen.length === all.length ? 'Clear All' : 'Select All'}</button>
        </div>
        <div style={{maxHeight:360, overflowY:'auto', border:`1px solid ${T.border}`, borderRadius:10, padding:'4px 8px'}}>
          {all.map(p => <SettingsCheckRow key={p.key} label={p.label} checked={chosen.includes(p.key)}
            onToggle={()=>setPicked(chosen.includes(p.key) ? chosen.filter(k => k !== p.key) : [...chosen, p.key])}/>)}
        </div>
      </div>
      <div style={{display:'flex', justifyContent:'flex-end'}}>
        <StCta label={`Export ${records.length.toLocaleString('en-US')} ${typePlural(object, object)}`} disabled={!chosen.length || !records.length} onClick={run}/>
      </div>
    </div>
  );
}

const IE_HISTORY_COLUMNS = [{key:'kind', label:'Type', width:110}, {key:'objectLabel', label:'Record Type', width:140}, {key:'count', label:'Records', width:110},
  {key:'skipped', label:'Skipped', width:100}, {key:'from', label:'File / From', width:220}, {key:'by', label:'By', width:170}, {key:'date', label:'Date', width:170}, {key:'alertLabel', label:'Alert', width:220}];
function HistoryTab({hub}){
  const [columnOrder, setColumnOrder] = React.useState(() => IE_HISTORY_COLUMNS.map(c => c.key));
  const [columnWidths, setColumnWidths] = React.useState({});
  const [sort, setSort] = React.useState({key:'date', dir:'desc'});
  const [viewing, setViewing] = React.useState(null);   // an export's alert email
  const rows = importExportLogOf(hub.data).map(e => ({...e, objectLabel:typePlural(e.object, e.object), skipped:e.kind === 'Import' ? (e.skipped || 0) : '',
    date:e.at, alertLabel:e.alert ? `Emailed ${bulkPlural(e.alert.to.length, 'Super Admin')}` : ''}));
  const schema = {properties:IE_HISTORY_COLUMNS, noun:'entry', nounPlural:'entries', searchKeys:['from', 'by'], selectable:false, boards:false, canCreateProperty:false,
    renderCell:(key, r) => key === 'date' ? <span>{fmtActStamp(new Date(r.at))}</span>
      : key === 'count' ? <span>{Number(r.count || 0).toLocaleString('en-US')}</span>
      : key === 'alertLabel' && r.alert ? <ContactName name={r.alertLabel} onOpen={()=>setViewing(r)} style={{fontSize:'inherit', fontWeight:400}}/> : undefined,
    renderActions:(r) => r.alert ? <RowActionsMenu title="Entry Actions" items={[{label:'View Alert Email', onClick:()=>setViewing(r)}]}/> : null};
  return (
    <RecordSchema.Provider value={schema}>
      <div style={{flex:1, minHeight:0, display:'flex', flexDirection:'column', border:`1px solid ${T.border}`, borderRadius:8, overflow:'hidden'}}>
        {rows.length ? <ContactsDataGrid rows={rows} columnOrder={columnOrder} setColumnOrder={setColumnOrder} columnWidths={columnWidths} setColumnWidths={setColumnWidths}
          sort={sort} setSort={setSort} search="" frozenLeft={0} frozenRight={0} actionsFrozen rowsPerPage={25} onOpenContact={()=>{}}/> : <EmptyState title="No imports or exports yet"/>}
      </div>
      {viewing && <StModal title="Alert Email" primary={null} onCancel={()=>setViewing(null)} width={540}>
        <div style={{display:'flex', flexDirection:'column', gap:10, fontSize:13, color:T.attioText, lineHeight:1.5}}>
          <div><span style={{color:T.attioMuted}}>To&nbsp;&nbsp;</span>{viewing.alert.to.map(t => `${t.name} <${t.email}>`).join(', ') || '—'}</div>
          <div><span style={{color:T.attioMuted}}>Subject&nbsp;&nbsp;</span>{viewing.alert.subject}</div>
          <div style={{padding:'12px 14px', background:T.headerBg, borderRadius:8}}>{viewing.alert.body}</div>
        </div>
      </StModal>}
    </RecordSchema.Provider>
  );
}

const IE_TABS = [{id:'import', label:'Import', icon:'arrowsDownUp'}, {id:'export', label:'Export', icon:'export'}, {id:'history', label:'History', icon:'clock'}];
function ImportExportSettings(){
  const hub = useRecordHub();
  const [tab, setTab] = React.useState('import');
  if(!hub) return null;
  return (
    <SettingsPage fill>
      <div style={{display:'flex', gap:8, borderBottom:`1px solid ${T.borderStrong}`, flexShrink:0, marginBottom:20}}>
        {IE_TABS.map(t => <UtTab key={t.id} icon={t.icon} label={t.label} active={tab === t.id} onClick={()=>setTab(t.id)}/>)}
      </div>
      {tab === 'import' ? <ImportTab hub={hub} onDone={()=>setTab('history')}/> : tab === 'export' ? <ExportTab hub={hub}/> : <HistoryTab hub={hub}/>}
    </SettingsPage>
  );
}
SETTINGS_PAGES['settings.importExport'] = ImportExportSettings;

Object.assign(window, {EXPORT_ALERT_LIMITS, useRecordExportLog, parseCsv, ImportExportSettings});
