/* HOF Pulse ERP — Bulk actions in tables and on the Board.

   Rows ticked in a table (the grid's selection) get a Bulk Actions dropdown beside the selection
   readout at the bottom of the table. A table offers only what it already does for one row:
     Contacts, Deals, Customers — Enroll in Email Sequence, Edit Properties, Delete.
     Other tables — Delete, where they delete a row today (Forms, Quotes, Services, Email
                    Templates and Sequences, Customer Profile forms).
   Each table passes `bulkActions(ids, clear)` in its schema (RecordSchema); the grid shows the
   dropdown while rows are ticked.

   Edit Properties: a side panel with the record type's editable properties (not its name, and not
   Pipeline / Stage — those move with Move to Stage / Move to Pipeline on the Board). A
   property the selected records share shows its value; one they differ on shows "Mixed values".
   Only the properties changed are written — to every selected record the person may edit (the
   others are skipped and counted). Delete: confirmed by typing Delete; records the person may not
   delete, and records with payments recorded, are skipped and counted. Enroll in Email Sequence: the sequence's emails are scheduled for
   each record from now (as the workflow action does); records without an email address are skipped.
   Cc and Bcc typed there go on every email of the sequence, for each record enrolled.

   The Board (Contacts, Deals — board.jsx) uses the same windows for a stage's records (its ⋯
   menu) and for the cards ticked (its Bulk Actions), through `board(pipeline)`: only what the
   record type supports is returned. On top of the table's three:
     Add Workflow      the workflow builder, its context the board's pipeline and the stage.
     Email             one email written once in the composer, sent to each record (emails.jsx).
     Move to Stage     a stage of the board's pipeline; records already there stay.
     Move to Pipeline  another pipeline of the record type (records that reference a pipeline:
                       Deals), into its first open stage — as the workflow action does.
   Moves are written in one change through the page's `move` (the workflow engine): a record a
   Block Entry workflow keeps out stays where it was, and is counted; records the person may not
   move between stages are skipped and counted. */

// The signed-in person's permission on a record (Settings → Users & Teams); none set up: allowed.
const recordCan = (object, record, action) => {
  if(!ACCESS.user || !ACCESS.perms) return true;
  const p = ACCESS.perms[object];
  return !!(p && p.enabled && permissionCovers(p[action], object, record));
};
const bulkPlural = (n, noun, plural) => `${n} ${n === 1 ? noun : (plural || `${noun}s`)}`;

/* The Bulk Actions dropdown: the filled button beside the selection count (a table's bottom bar,
   the Board's selection bar), opening upward. `width` fits the longest action on one line. */
function BulkActionsMenu({items, width = 220}){
  const [open, setOpen] = React.useState(false);
  return (
    <span style={{position:'relative', display:'inline-flex'}}>
      <button onClick={()=>setOpen(o => !o)} aria-expanded={open}
        style={{display:'inline-flex', alignItems:'center', gap:6, height:28, padding:'0 10px', borderRadius:8, border:'none', background:T.black,
          fontSize:13, fontWeight:500, color:'#fff', cursor:'pointer', fontFamily:'inherit'}}>
        Bulk Actions<Icon name="chevDown" size={T.chevronSize} color="#fff"/>
      </button>
      <MenuShell open={open} onClose={()=>setOpen(false)} up width={width}>
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

/* Move to Pipeline / Move to Stage — choose where; `note(to)`: a line under the choice. */
function BulkMoveModal({title, label, placeholder, options, primary, note, onMove, onCancel}){
  const [to, setTo] = React.useState('');
  const line = note && note(to);
  return ReactDOM.createPortal(
    <StModal title={title} primary={primary} canSubmit={!!to} onCancel={onCancel} onSubmit={()=>onMove(to)}>
      <div style={{display:'flex', flexDirection:'column', gap:12}}>
        <div><label style={fieldLabel}>{label}</label>
          <FormSelect value={to} placeholder={placeholder} options={options} onChange={setTo}/></div>
        {line && <div style={{fontSize:12.5, color:T.attioMuted, lineHeight:1.5}}>{line}</div>}
      </div>
    </StModal>, document.body);
}

/* A record table's bulk actions and their windows. `records`: the table's records; `update(ids,
   patch)` / `remove(ids)`: the table's own edit and delete (each record as it's edited or deleted
   today: owner history, unlinking, its activity). `move(ids, fn)`: the page's stage write for
   several records in one change (through the workflow engine) — the Board's moves. */
function useRecordBulk({object, data, records, update, remove, move}){
  const hub = useRecordHub(), engineCtx = useWorkflowEngineCtx();
  // {kind:'edit'|'delete'|'enroll'|'moveStage'|'movePipeline', ids, clear, pipeline?} | {kind:'workflow', workflow}
  const [bulk, setBulk] = React.useState(null);
  const [stub, setStub] = React.useState(null);
  const noun = (HUB_NOUN[object] || 'Record').toLowerCase();
  const pick = (ids) => records.filter(r => ids.some(id => String(id) === String(r.id)));
  const bulkActions = (ids, clear) => [
    {label:'Enroll in Email Sequence', onClick:()=>setBulk({kind:'enroll', ids, clear})},
    {label:'Edit Properties', onClick:()=>setBulk({kind:'edit', ids, clear})},
    {label:'Delete', danger:true, onClick:()=>setBulk({kind:'delete', ids, clear})},
  ];
  /* The Board's actions on the pipeline it shows (see the header): each takes the records' ids
     and `clear` (the selection to empty once done); one the record type doesn't support is null. */
  const otherPipelines = (pipeline) => recordPipelines(data, object).filter(p => p.id !== pipeline.id);
  const board = (pipeline) => {
    const open = (kind) => (ids, clear) => setBulk({kind, ids, clear, pipeline});
    return {
      workflow: hub && workflowsAvailableFor(object) && workflowCan('create')
        ? (stage) => setBulk({kind:'workflow', workflow:newWorkflowDraft({object, pipeline:pipeline.id, stage:stage.id}, {type:'pipelineStage', pipelineId:pipeline.id, stageId:stage.id})}) : null,
      enroll: open('enroll'),
      email: hub ? (ids, clear) => hub.composeEmail({recipients:ids.map(id => ({object, id})), onSent:clear}) : null,
      edit: open('edit'),
      movePipeline: move && pipeline.source !== 'property' && otherPipelines(pipeline).length ? open('movePipeline') : null,
      moveStage: move ? open('moveStage') : null,
      remove: open('delete'),
    };
  };
  const toast = (m) => hub && hub.toast && hub.toast(m);
  const done = () => { if(bulk && bulk.clear) bulk.clear(); setBulk(null); };
  let modal = null;
  if(bulk && bulk.kind === 'workflow') modal = <WorkflowEditorOverlay data={hub.data} setData={hub.setData} workflow={bulk.workflow} onClose={()=>setBulk(null)} onStub={setStub}/>;
  else if(bulk && (bulk.kind === 'moveStage' || bulk.kind === 'movePipeline')){
    const pl = bulk.pipeline, toPipeline = bulk.kind === 'movePipeline', chosen = pick(bulk.ids);
    const may = chosen.filter(r => stageMoveCan(object, r)), skipped = chosen.length - may.length;
    // The stage every record is already in isn't somewhere to move them.
    const here = new Set(chosen.map(r => stageIdOf(pl, r)));
    const entryStage = (p) => p && (p.stages.find(s => !isClosedStage(s)) || p.stages[0]);
    const destOf = (to) => { const p = toPipeline ? otherPipelines(pl).find(x => x.id === to) : pl; return {p, stage: toPipeline ? entryStage(p) : p.stages.find(s => s.id === to)}; };
    modal = <BulkMoveModal title={toPipeline ? 'Move to Pipeline' : 'Move to Stage'} label={toPipeline ? 'Pipeline' : 'Stage'} placeholder={toPipeline ? 'Select pipeline' : 'Select stage'}
      options={toPipeline ? otherPipelines(pl).map(p => ({value:p.id, label:p.label})) : pl.stages.filter(s => !(here.size === 1 && here.has(s.id))).map(s => ({value:s.id, label:s.label}))}
      primary={`Move ${bulkPlural(may.length, noun)}`} onCancel={()=>setBulk(null)}
      note={(to) => [toPipeline && to && destOf(to).stage ? `They enter ${destOf(to).stage.label}.` : '', skipped ? `${bulkPlural(skipped, noun)} skipped (no permission).` : ''].filter(Boolean).join(' ')}
      onMove={(to)=>{
        const {p, stage} = destOf(to);
        if(!p || !stage) return setBulk(null);
        const list = may.filter(r => toPipeline || stageIdOf(pl, r) !== stage.id);
        const res = list.length ? move(list.map(r => r.id), r => withStage(p, r, stage.id)) : null;
        const blocked = res && res.blocked ? res.blocked.length : 0;
        toast(`${bulkPlural(list.length - blocked, noun)} moved to ${toPipeline ? p.label : stage.label}${blocked ? ` · ${blocked} blocked by a workflow` : ''}${skipped ? ` · ${skipped} skipped (no permission)` : ''}`);
        done();
      }}/>;
  }
  else if(bulk){
    const chosen = pick(bulk.ids);
    if(bulk.kind === 'edit') modal = <BulkEditPanel data={data} object={object} records={chosen} onClose={()=>setBulk(null)}
      onSave={(patch)=>{ const ok = chosen.filter(r => recordCan(object, r, 'edit')), skipped = chosen.length - ok.length;
        if(ok.length) update(ok.map(r => r.id), patch);
        toast(`${bulkPlural(ok.length, noun)} updated${skipped ? ` · ${skipped} skipped (no permission)` : ''}`); done(); }}/>;
    // Delete: records with payments recorded are kept (they can't be deleted), as are those without permission.
    if(bulk.kind === 'delete'){ const may = chosen.filter(r => recordCan(object, r, 'delete')), ok = may.filter(r => !recordHasPayments(object, r.id));
      const noPerm = chosen.length - may.length, paid = may.length - ok.length;
      modal = <BulkDeleteModal count={ok.length} noun={noun} skipped={noPerm} note={paid ? `${bulkPlural(paid, noun)} with payments recorded will be kept.` : ''} onCancel={()=>setBulk(null)}
        onConfirm={()=>{ if(ok.length) remove(ok.map(r => r.id));
          toast(`${bulkPlural(ok.length, noun)} deleted${noPerm ? ` · ${noPerm} skipped (no permission)` : ''}${paid ? ` · ${paid} kept (payments recorded)` : ''}`); done(); }}/>; }
    if(bulk.kind === 'enroll') modal = <BulkEnrollModal data={data} records={chosen} onCancel={()=>setBulk(null)}
      onEnroll={(seqId, copies)=>{ const withEmail = chosen.filter(r => String(r.email || '').trim());
        const results = engineCtx ? withEmail.map(r => engineCtx.api.enrollInSequence(object === 'contacts' ? String(r.id) : r.id, seqId, copies)) : [];
        const n = results.filter(x => x === 'enrolled').length, already = results.filter(x => x === 'already').length, noEmail = chosen.length - withEmail.length;
        const seq = emailSequencesOf(data).find(q => q.id === seqId);
        // Records already in the sequence are skipped (their emails aren't scheduled twice).
        toast(`${bulkPlural(n, noun)} enrolled in ${seq ? seq.name : 'the sequence'}${already ? ` · ${already} already enrolled` : ''}${noEmail ? ` · ${noEmail} skipped (no email)` : ''}`); done(); }}/>;
  }
  return {bulkActions, board, bulkModal:<>{modal}{stub && <StubPanel title={stub} onClose={()=>setStub(null)}/>}</>};
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

Object.assign(window, {bulkPlural, recordCan, BulkActionsMenu, BulkDeleteModal, BulkEditPanel, BulkEnrollModal, BulkMoveModal, useRecordBulk, useTableBulkDelete});
