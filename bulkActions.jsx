/* HOF Pulse ERP — Bulk actions in tables.

   Rows ticked in a table (the grid's selection) get a Bulk Actions dropdown beside the selection
   readout at the bottom of the table. A table offers only what it already does for one row:
     Contacts, Deals, Customers — Enroll in Email Sequence, Edit Properties, Delete.
     Other tables — Delete, where they delete a row today (Forms, Quotes, Services, Email
                    Templates and Sequences, Customer Profile forms).
   Each table passes `bulkActions(ids, clear)` in its schema (RecordSchema); the grid shows the
   dropdown while rows are ticked.

   Edit Properties: a side panel with the record type's editable properties (not its name, and not
   Pipeline / Stage — a stage move has its workflow rules, so it stays one record at a time). A
   property the selected records share shows its value; one they differ on shows "Mixed values".
   Only the properties changed are written — to every selected record the person may edit (the
   others are skipped and counted). Delete: confirmed by typing Delete; records the person may not
   delete are skipped and counted. Enroll in Email Sequence: the sequence's emails are scheduled for
   each record from now (as the workflow action does); records without an email address are skipped.
   Cc and Bcc typed there go on every email of the sequence, for each record enrolled. */

// The signed-in person's permission on a record (Settings → Users & Teams); none set up: allowed.
const recordCan = (object, record, action) => {
  if(!ACCESS.user || !ACCESS.perms) return true;
  const p = ACCESS.perms[object];
  return !!(p && p.enabled && permissionCovers(p[action], object, record));
};
const bulkPlural = (n, noun, plural) => `${n} ${n === 1 ? noun : (plural || `${noun}s`)}`;

/* The Bulk Actions dropdown (opens upward: it sits in the table's bottom bar). */
function BulkActionsMenu({items}){
  const [open, setOpen] = React.useState(false);
  return (
    <span style={{position:'relative', display:'inline-flex'}}>
      <button onClick={()=>setOpen(o => !o)} aria-expanded={open}
        style={{display:'inline-flex', alignItems:'center', gap:6, height:28, padding:'0 10px', borderRadius:8, border:`1px solid ${T.borderStrong}`, background:'#fff',
          fontSize:13, fontWeight:500, color:T.gray800, cursor:'pointer', fontFamily:'inherit'}}>
        Bulk Actions<Icon name="chevDown" size={T.chevronSize} color={T.gray600}/>
      </button>
      <MenuShell open={open} onClose={()=>setOpen(false)} up width={220}>
        {items.map(it => <MenuItem key={it.label} label={it.label} danger={it.danger} disabled={it.disabled} onClick={()=>{ setOpen(false); it.onClick(); }}/>)}
      </MenuShell>
    </span>
  );
}

/* Delete confirmation for several rows (the record Delete's: type Delete). `skipped`: rows the
   person may not delete (or that can't be deleted), named in the note. */
function BulkDeleteModal({count, noun, plural, note, skipped = 0, skipNote, onCancel, onConfirm}){
  const extra = [note, skipped ? `${bulkPlural(skipped, noun, plural)} ${skipNote || 'you can’t delete'} will be skipped.` : ''].filter(Boolean).join(' ');
  return <DeleteConfirmModal contactName={bulkPlural(count, noun, plural)} noun={count === 1 ? noun.replace(/^./, c => c.toUpperCase()) : (plural || `${noun}s`).replace(/^./, c => c.toUpperCase())}
    note={extra} onCancel={onCancel} onConfirm={onConfirm}/>;
}

/* Edit Properties — the selected records' editable properties; untouched ones stay as they are. */
const BULK_EXCLUDED_KEYS = ['name', 'pipeline', 'stage'];
function BulkEditPanel({data, object, records, onSave, onClose}){
  // A property-driven pipeline's property (a contact's Contact Type) is its stage: one record at a time too.
  const stageKeys = objectPipelines(data, object).filter(pl => pl.source === 'property').map(pl => pl.propertyKey);
  const props = objectFormProperties(data, object).filter(p => !p.auto && !p.derived && !p.archived && !BULK_EXCLUDED_KEYS.includes(p.key) && !stageKeys.includes(p.key)
    && !['Pipeline', 'Pipeline stage'].includes(p.type) && propKeyCan(object, p.key));
  // A property's shared value (stored), or `mixed`.
  const shared = (p) => { const vs = records.map(r => r[p.key] ?? ''); return vs.every(v => samePropertyValue(v, vs[0])) ? {value:vs[0]} : {mixed:true}; };
  const [edits, setEdits] = React.useState({});   // key → the value entered (input shape)
  const [search, setSearch] = React.useState('');
  const [tried, setTried] = React.useState(false);
  const shown = props.filter(p => !search.trim() || p.label.toLowerCase().includes(search.trim().toLowerCase()));
  const errors = Object.fromEntries(Object.entries(edits).map(([k, v]) => { const p = props.find(x => x.key === k); return [k, p && propertyValueError(p, v, p.mandatory)]; }).filter(([, e]) => e));
  const changed = Object.keys(edits).length;
  const save = () => {
    setTried(true);
    if(Object.keys(errors).length || !changed) return;
    onSave(Object.fromEntries(Object.entries(edits).map(([k, v]) => [k, storePropertyValue(props.find(x => x.key === k), v)])));
  };
  return (
    <CreatePanelFrame title={`Edit Properties · ${bulkPlural(records.length, HUB_NOUN[object] ? HUB_NOUN[object].toLowerCase() : 'record')}`} onClose={onClose} more={false} zIndex={90}
      top={<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search properties" aria-label="Search properties" style={fieldInput}/>}
      actions={<><StSecondary label="Cancel" onClick={onClose}/><StCta label={changed ? `Update ${bulkPlural(records.length, 'record')}` : 'Update'} disabled={!changed} onClick={save}/></>}>
      <div style={{display:'flex', flexDirection:'column', gap:16}}>
        <div style={{fontSize:12.5, color:T.attioMuted, lineHeight:1.5}}>Only the properties you change are updated, on every selected record.</div>
        {shown.map(p => {
          const s = shared(p), dirty = p.key in edits;
          const value = dirty ? edits[p.key] : s.mixed ? loadPropertyValueOf(p, '') : loadPropertyValueOf(p, s.value);
          return (
            <div key={p.key} style={{display:'flex', flexDirection:'column', gap:6}}>
              <div style={{display:'flex', alignItems:'baseline', gap:8}}>
                <span title={p.label} style={{flex:1, minWidth:0, fontSize:13, fontWeight:500, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{p.label}</span>
                {dirty ? <button onClick={()=>setEdits(e => { const n = {...e}; delete n[p.key]; return n; })} style={{border:'none', background:'transparent', padding:0, cursor:'pointer', fontSize:12, color:T.attioBlue, fontFamily:'inherit'}}>Undo</button>
                  : s.mixed && <span style={{fontSize:12, color:T.attioMuted}}>Mixed values</span>}
              </div>
              <TypedPropertyInput prop={p} value={value} invalid={tried && !!errors[p.key]} onChange={(v)=>setEdits(e => ({...e, [p.key]:v}))}/>
              {tried && errors[p.key] && <span style={{fontSize:12, color:T.red}}>{errors[p.key]}</span>}
            </div>
          );
        })}
        {!shown.length && <div style={{fontSize:13, color:T.attioMuted}}>No properties match.</div>}
      </div>
    </CreatePanelFrame>
  );
}

/* Enroll in Email Sequence — choose the sequence; the records with an email address are enrolled.
   Cc / Bcc (emails.jsx): copied on every email of the sequence. */
function BulkEnrollModal({data, records, onEnroll, onCancel}){
  const sequences = emailSequencesOf(data);
  const [seq, setSeq] = React.useState('');
  const [cc, setCc] = React.useState(''), [bcc, setBcc] = React.useState('');
  const withEmail = records.filter(r => String(r.email || '').trim()).length, without = records.length - withEmail;
  return ReactDOM.createPortal(
    <StModal title="Enroll in Email Sequence" primary={`Enroll ${bulkPlural(withEmail, 'record')}`} canSubmit={!!seq && withEmail > 0 && emailListValid(cc) && emailListValid(bcc)} onCancel={onCancel} onSubmit={()=>onEnroll(seq, emailCopiesOf(cc, bcc))}>
      <div style={{display:'flex', flexDirection:'column', gap:12}}>
        <div><label style={fieldLabel}>Email sequence</label>
          <FormSelect value={seq} placeholder="Select sequence" options={sequences.map(q => ({value:q.id, label:`${q.name} · ${bulkPlural(q.emails.length, 'email')}`}))} onChange={setSeq}/></div>
        <div><label style={fieldLabel}>Cc</label><EmailListInput label="Cc" value={cc} onChange={setCc} style={fieldInput}/></div>
        <div><label style={fieldLabel}>Bcc</label><EmailListInput label="Bcc" value={bcc} onChange={setBcc} style={fieldInput}/></div>
        <div style={{fontSize:12.5, color:T.attioMuted, lineHeight:1.5}}>
          The sequence’s emails are scheduled for each record from now.{without ? ` ${bulkPlural(without, 'record')} without an email address will be skipped.` : ''}
        </div>
      </div>
    </StModal>, document.body);
}

/* A record table's bulk actions and their windows. `records`: the table's records; `update(ids,
   patch)` / `remove(ids)`: the table's own edit and delete (each record as it's edited or deleted
   today: owner history, unlinking, its activity). */
function useRecordBulk({object, data, records, update, remove}){
  const hub = useRecordHub(), engineCtx = useWorkflowEngineCtx();
  const [bulk, setBulk] = React.useState(null);   // {kind:'edit'|'delete'|'enroll', ids, clear}
  const noun = (HUB_NOUN[object] || 'Record').toLowerCase();
  const pick = (ids) => records.filter(r => ids.some(id => String(id) === String(r.id)));
  const bulkActions = (ids, clear) => [
    {label:'Enroll in Email Sequence', onClick:()=>setBulk({kind:'enroll', ids, clear})},
    {label:'Edit Properties', onClick:()=>setBulk({kind:'edit', ids, clear})},
    {label:'Delete', danger:true, onClick:()=>setBulk({kind:'delete', ids, clear})},
  ];
  const toast = (m) => hub && hub.toast && hub.toast(m);
  const done = () => { if(bulk && bulk.clear) bulk.clear(); setBulk(null); };
  let modal = null;
  if(bulk){
    const chosen = pick(bulk.ids);
    if(bulk.kind === 'edit') modal = <BulkEditPanel data={data} object={object} records={chosen} onClose={()=>setBulk(null)}
      onSave={(patch)=>{ const ok = chosen.filter(r => recordCan(object, r, 'edit')), skipped = chosen.length - ok.length;
        if(ok.length) update(ok.map(r => r.id), patch);
        toast(`${bulkPlural(ok.length, noun)} updated${skipped ? ` · ${skipped} skipped (no permission)` : ''}`); done(); }}/>;
    if(bulk.kind === 'delete'){ const ok = chosen.filter(r => recordCan(object, r, 'delete'));
      modal = <BulkDeleteModal count={ok.length} noun={noun} skipped={chosen.length - ok.length} onCancel={()=>setBulk(null)}
        onConfirm={()=>{ if(ok.length) remove(ok.map(r => r.id)); toast(`${bulkPlural(ok.length, noun)} deleted${chosen.length - ok.length ? ` · ${chosen.length - ok.length} skipped (no permission)` : ''}`); done(); }}/>; }
    if(bulk.kind === 'enroll') modal = <BulkEnrollModal data={data} records={chosen} onCancel={()=>setBulk(null)}
      onEnroll={(seqId, copies)=>{ const withEmail = chosen.filter(r => String(r.email || '').trim());
        const n = engineCtx ? withEmail.filter(r => engineCtx.api.enrollInSequence(object === 'contacts' ? String(r.id) : r.id, seqId, copies)).length : 0;
        const seq = emailSequencesOf(data).find(q => q.id === seqId);
        toast(`${bulkPlural(n, noun)} enrolled in ${seq ? seq.name : 'the sequence'}${chosen.length - n ? ` · ${chosen.length - n} skipped` : ''}`); done(); }}/>;
  }
  return {bulkActions, bulkModal:modal};
}

/* A non-record table's bulk Delete: `remove(ids)` deletes; `canDelete(row)` (optional) keeps rows
   that can't be deleted (a template in use…) out, named by `skipNote`. */
function useTableBulkDelete({rows, noun, plural, remove, canDelete, skipNote, note, onDone}){
  const [bulk, setBulk] = React.useState(null);   // {ids, clear}
  const bulkActions = (ids, clear) => [{label:'Delete', danger:true, onClick:()=>setBulk({ids, clear})}];
  let bulkModal = null;
  if(bulk){
    const chosen = rows.filter(r => bulk.ids.includes(r.id)), ok = chosen.filter(r => !canDelete || canDelete(r));
    bulkModal = <BulkDeleteModal count={ok.length} noun={noun} plural={plural} note={note} skipped={chosen.length - ok.length} skipNote={skipNote} onCancel={()=>setBulk(null)}
      onConfirm={()=>{ if(ok.length) remove(ok.map(r => r.id)); if(bulk.clear) bulk.clear(); setBulk(null); onDone && onDone(ok.length, chosen.length - ok.length); }}/>;
  }
  return {bulkActions, bulkModal};
}

Object.assign(window, {bulkPlural, recordCan, BulkActionsMenu, BulkDeleteModal, BulkEditPanel, BulkEnrollModal, useRecordBulk, useTableBulkDelete});
