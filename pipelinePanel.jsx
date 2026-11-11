/* HOF Pulse ERP — Settings → Pipelines → a pipeline, in a side panel.

   Pipeline → Pipeline side panel → Stages → Add Workflow → Workflow (in the same panel).

   The panel opens over the Pipelines table from the right, wide, leaving the pipeline names in
   view. Header: the pipeline's name, its Object under it, Close and ⋯ (Edit / Delete pipeline —
   not defined yet). Stages: the Contacts / Deals table (ContactsDataGrid) with each stage's
   record count and workflows; rows drag to reorder; ⋯ per stage: Add Workflow, Delete Stage;
   Add Stage top right. A stage with deals in it can't be deleted until it's empty; deleting a
   stage deletes its workflows. Stage order, new stages and deletions are the pipeline's own
   (settingsData.pipelines), so the Deals board follows them.

   Only a pipeline whose stages belong to it (source:'record' — Deals) can have its stages
   edited; a property-driven pipeline's stages are its property's values (Types of Contact), so
   they're shown, with workflows, but not reordered, added or deleted here. Every pipeline's
   stages show their Stage Type; Edit (⋯) changes it, on property-driven pipelines too.

   Workflows open in this same panel through the generic WorkflowEditor (workflows.jsx). Opened
   from a stage, a new workflow's context is prefilled (Object, Pipeline, Stage) and its origin
   is that stage. A stage lists the workflows whose context is that stage, plus those opened from
   it whose trigger needs no stage (e.g. Record Created). */

const PIPELINE_PANEL_LEFT = 40;    // wide enough for two columns; the table's edge stays in view
const PIPELINE_INFO_W = 280;       // the left (pipeline information) column
// Both column headers: the same height and alignment, each closed by a divider; titles use the
// Add User modal's header label (15/600, attioText).
const pipelineColumnHeader = {display:'flex', alignItems:'center', gap:8, height:56, padding:'0 14px 0 20px', borderBottom:`1px solid ${T.border}`, flexShrink:0, minWidth:0};
// The stage row's Workflow action — the ⋯ trigger's size and look.
const stageWorkflowBtn = {width:28, height:28, borderRadius:8, border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0};

/* `startWorkflow`: open straight into a new workflow for this pipeline (the Pipelines table's
   Workflow action); closing it closes the panel. A workflow opens the panel wider, so the canvas
   and its configuration area have room. */
/* `onWorkflowOpen(open)`: told when a workflow opens and closes (the Settings menu collapses meanwhile). */
function PipelinePanel({data, setData, pipelineId, deals = [], onClose, onStub, startWorkflow, onWorkflowOpen}){
  const pipeline = (data.pipelines || []).find(p => p.id === pipelineId);
  const [entered, setEntered] = React.useState(false);
  // Slide in once the off-screen start has painted; the timer covers a frame that never comes (a throttled tab).
  React.useEffect(()=>{ let r2; const r1 = requestAnimationFrame(()=>{ r2 = requestAnimationFrame(()=>setEntered(true)); }); const t = setTimeout(()=>setEntered(true), 60);
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); clearTimeout(t); }; }, []);
  const [editing, setEditing] = React.useState(() => {         // {stage, workflow}
    if(!startWorkflow || !pipeline) return null;
    // Opened from the pipeline: an Object + Pipeline context (editable in the builder).
    return {stage:null, workflow:newWorkflowDraft({object:pipeline.objectId, pipeline:pipeline.id}, {type:'pipeline', pipelineId:pipeline.id})};
  });
  React.useEffect(() => {
    if(!editing || !onWorkflowOpen) return;
    onWorkflowOpen(true);
    return () => onWorkflowOpen(false);
  }, [!!editing]);
  const [editingPipeline, setEditingPipeline] = React.useState(false);
  const [deletingPipeline, setDeletingPipeline] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [deleting, setDeleting] = React.useState(null);      // stage
  const [columnOrder, setColumnOrder] = React.useState(null);
  const [sort, setSort] = React.useState(null);
  React.useEffect(()=>{
    const onKey = (e) => { if(e.key === 'Escape' && !editing && !adding && !deleting && !editingPipeline && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editing, adding, deleting, editingPipeline]);
  if(!pipeline) return null;

  const objName = objectName(data, pipeline.objectId);
  // Stages are added, reordered and deleted with Pipelines → Edit for the pipeline's record type.
  const editable = pipeline.source === 'record' && pipelineAdminCan(pipeline.objectId, 'edit', pipeline);
  // Stages count the records in them (a deal's, a customer's pipeline).
  const countsDeals = ['deals', 'customers'].includes(pipeline.objectId);
  const recNoun = objName.replace(/s$/, '').toLowerCase();
  // Workflows here: where the Object supports them; adding one needs Workflows → Create, seeing one → View.
  const canWorkflow = workflowsAvailableFor(pipeline.objectId) && workflowCan('create');
  const showsWorkflows = workflowsAvailableFor(pipeline.objectId) && workflowCan('view');
  const dealsIn = (stageId) => deals.filter(d => d.pipeline === pipeline.id && d.stage === stageId).length;
  /* The stage a workflow belongs to here — only while its context is this pipeline: its context
     stage, else its first stage trigger's stage, else (a pipeline-level workflow whose triggers need
     no stage) the stage it was opened from. One moved to another pipeline or Record isn't here. */
  const triggerStage = (w) => (workflowTriggerViews(w).find(v => v.triggerConfig.stage) || {triggerConfig:{}}).triggerConfig.stage;
  const stageOfWorkflow = (w) => !w.context || w.context.pipeline !== pipeline.id ? null
    : w.context.stage ? w.context.stage : triggerStage(w) ? triggerStage(w)
    : w.origin && w.origin.type === 'pipelineStage' && w.origin.pipelineId === pipeline.id ? w.origin.stageId : null;
  const workflows = (data.workflows || []).filter(w => stageOfWorkflow(w) && workflowCan('view', w));
  const setStages = (fn) => setData(d => ({...d, pipelines:d.pipelines.map(p => p.id === pipeline.id ? {...p, stages:fn(p.stages)} : p)}));
  // Object + Pipeline + Stage (editable in the builder).
  const newWorkflow = (stage) => newWorkflowDraft({object:pipeline.objectId, pipeline:pipeline.id, stage:stage.id}, {type:'pipelineStage', pipelineId:pipeline.id, stageId:stage.id});

  const columns = [
    // Minimum widths that fit the panel's stage column (gutter 44 + these + Actions 120 ≤ ~520px,
    // so nothing is cropped on the right); fillWidth stretches them to its width.
    {key:'name', label:'Stage Name', width:150},
    {key:'stageType', label:'Stage Type', width:96},
    ...(countsDeals ? [{key:'records', label:objName, width:64}] : []),
    // Workflows only where the pipeline's Object supports them (Deals); Contacts' pipelines have none.
    ...(showsWorkflows ? [{key:'workflows', label:'Workflows', width:140}] : []),
  ];
  const rows = pipeline.stages.map(st => ({id:st.id, name:st.label, stageType:stageTypeLabel(stageTypeOf(st)), records: countsDeals ? String(dealsIn(st.id)) : '', stage:st,
    stageWorkflows: workflows.filter(w => stageOfWorkflow(w) === st.id)}));
  const schema = {
    properties:columns, filterProps:[], selectValues:{}, noun:'stage', searchKeys:['name'], selectable:false, boards:false,
    fillWidth:true, canCreateProperty:false,
    // Lightweight in the side panel: nothing pinned, no pagination — the panel scrolls.
    pinGutter:false, paginate:false,
    // Stage order IS the pipeline's progression: no sorting or column reordering, only row drag.
    ordered:true,
    // Stages reorder by drag, on pipelines that own their stages.
    onRowReorder: editable ? (fromId, toId) => setStages(list => moveItem(list, list.findIndex(s => s.id === fromId), list.findIndex(s => s.id === toId))) : undefined,
    renderCell: (key, r) => key === 'name' ? <span style={{fontWeight:500, color:T.attioText}}>{r.name}</span>
      /* The associated-records dropdown (a deal's customers): one workflow shows its name; several,
         "N workflows ▾" listing them. Choosing one opens its configuration. */
      : key === 'workflows' ? (r.stageWorkflows.length
        ? <AssociatedRecordsValue noun="workflow" width={340} inTable records={r.stageWorkflows.map(w => {
            // Its name; unnamed, its trigger — with several, the first and how many more ("Stage Exit +1").
            const views = workflowTriggerViews(w), t = views[0] && workflowTrigger(views[0].trigger);
            return {id:w.id, w, name:w.name || (t ? `${t.label}${views.length > 1 ? ` +${views.length - 1}` : ''}` : 'Workflow')};
          })} onOpen={(x)=>setEditing({stage:r.stage, workflow:x.w})}/>
        : '—')
      : undefined,
    // Actions: the stage's Workflow action (a new workflow for this stage), then ⋯.
    renderActions: (r) => {
      const n = countsDeals ? dealsIn(r.id) : 0;
      const items = [
        // A stage with records can't be deleted (shown disabled).
        ...(editable ? [{label:'Delete Stage', danger:!n, disabled:!!n, onClick:()=>setDeleting(r.stage)}] : []),
      ];
      return <div style={{display:'flex', alignItems:'center', gap:2}}>
        {canWorkflow && <button title="Add Workflow" onClick={()=>setEditing({stage:r.stage, workflow:newWorkflow(r.stage)})} style={stageWorkflowBtn}>
          <Icon name="workflows" size={15} color={T.attioMuted}/>
        </button>}
        {items.length > 0 && <RowActionsMenu title="Stage Actions" width={MENU_W} items={items}/>}
      </div>;
    },
  };

  // Leaving a workflow returns to the stages — or closes the panel when it was opened for a workflow.
  const closeWorkflow = () => startWorkflow ? onClose() : setEditing(null);

  return (<>
    {/* A workflow is a full section (the whole content area, no panel edge or shadow); the stages are a side panel. */}
    <div style={{position:'absolute', top:0, right:0, bottom:0, left: editing ? 0 : PIPELINE_PANEL_LEFT, zIndex:70, overflow:'hidden', background:'#fff',
      borderLeft: editing ? 'none' : `1px solid ${T.border}`, boxShadow: editing ? 'none' : '-12px 0 32px rgba(16,24,40,.10)', display:'flex', flexDirection:'column',
      transform: entered ? 'none' : 'translateX(100%)', transition:'transform 220ms cubic-bezier(.2,.8,.2,1), left 220ms cubic-bezier(.2,.8,.2,1)'}}>
      {editing ? (
        <WorkflowEditorHost data={data} setData={setData} workflow={editing.workflow} onClose={closeWorkflow} onStub={onStub}/>
      ) : (<>
        {/* Two columns, like the Contact detail page: pipeline information | stages. */}
        <div style={{flex:1, minHeight:0, display:'flex'}}>
          {/* Left — the pipeline: its name (⋯ at the top right of this column) and its
              information in the Contact Properties pattern. */}
          <div style={{width:PIPELINE_INFO_W, flexShrink:0, display:'flex', flexDirection:'column', borderRight:`1px solid ${T.border}`, minHeight:0}}>
            <div style={pipelineColumnHeader}>
              <span style={{flex:1, minWidth:0, fontSize:15, fontWeight:600, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{pipeline.label}</span>
              <RowActionsMenu title="Pipeline Actions" width={MENU_W} items={pipelineMenuItems(pipeline, deals, ()=>setEditingPipeline(true), undefined, data, ()=>setDeletingPipeline(true))}/>
            </div>
            <div style={{flex:1, minHeight:0, overflowY:'auto', padding:'16px 20px 24px'}}>
              <div style={{marginBottom:6}}>
                <span style={{fontSize:11, fontWeight:600, color:T.attioFaint, textTransform:'uppercase', letterSpacing:.4}}>Pipeline Information</span>
              </div>
              {[['Record', objName], ['Stages', String(pipeline.stages.length)], ['Type', pipeline.source === 'property' ? 'Property-Based' : 'Manual']].map(([k, v]) => (
                <div key={k} style={{display:'flex', alignItems:'baseline', gap:12, padding:'7px 0', borderBottom:`1px solid ${T.attioLine}`, minHeight:32}}>
                  <span style={{width:90, flexShrink:0, fontSize:12.5, color:T.attioMuted, whiteSpace:'nowrap'}}>{k}</span>
                  <span style={{fontSize:13, color:T.attioText, minWidth:0, overflowWrap:'anywhere'}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Right — the stages: the Stages header with Add Stage (icon only) and Close at its top
              right, then the ordered stage list. */}
          <div style={{flex:1, minWidth:0, display:'flex', flexDirection:'column', minHeight:0}}>
            <div style={pipelineColumnHeader}>
              <span style={{fontSize:15, fontWeight:600, color:T.attioText}}>Stages</span>
              <div style={{flex:1}}/>
              {editable && (
                <button onClick={()=>setAdding(true)} title="Add Stage" style={{...toolbarIconButton, width:30, height:30}}>
                  <Icon name="plus" size={14} color={T.gray800}/>
                </button>
              )}
              <button title="Close" onClick={onClose} style={{width:30, height:30, borderRadius:8, border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                <Icon name="close" size={13} color={T.gray600}/>
              </button>
            </div>
            {/* The Contacts / Deals table, edge to edge. */}
            <div style={{flex:1, minHeight:0, display:'flex', flexDirection:'column'}}>
              <RecordSchema.Provider value={schema}>
                <ContactsDataGrid rows={rows} columnOrder={columnOrder || columns.map(c => c.key)} setColumnOrder={setColumnOrder} sort={sort} setSort={setSort}
                  search="" frozenLeft={0} frozenRight={0} actionsFrozen={false} rowsPerPage={25} onOpenContact={()=>{}}/>
              </RecordSchema.Provider>
            </div>
          </div>
        </div>
      </>)}
    </div>
    {editingPipeline && <EditPipelineModal pipeline={pipeline} setData={setData} onClose={()=>setEditingPipeline(false)}
      taken={(data.pipelines || []).filter(p => p.objectId === pipeline.objectId && p.id !== pipeline.id).map(p => p.label.toLowerCase())}/>}
    {deletingPipeline && <DeletePipelineModal pipeline={pipeline} setData={setData} onCancel={()=>setDeletingPipeline(false)} onDeleted={onClose}/>}
    {adding && <AddStageModal stages={pipeline.stages} onCancel={()=>setAdding(false)}
      onAdd={(label, type) => { setStages(list => [...list, {id:`${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`, label, type}]); setAdding(false); }}/>}
    {deleting && (() => {
      // Its workflows (shown here, and that the person may delete) go with it; others pointing at it are flagged in the builder.
      const gone = workflows.filter(w => stageOfWorkflow(w) === deleting.id && workflowCan('delete', w)).map(w => w.id), n = gone.length;
      return (
        <StModal title="Delete Stage" primary="Delete Stage" danger onCancel={()=>setDeleting(null)}
          onSubmit={()=>{
            setStages(list => list.filter(s => s.id !== deleting.id));
            setData(d => ({...d, workflows:(d.workflows || []).filter(w => !gone.includes(w.id))}));
            setDeleting(null);
          }}>
          <div style={stTextB}>Delete "{deleting.label}" from {pipeline.label}?{n ? ` Its ${n} workflow${n === 1 ? '' : 's'} will be deleted too.` : ''} This can't be undone.</div>
        </StModal>
      );
    })()}
  </>);
}

/* Pipeline ⋯ menu (Pipelines table and the panel): Edit, and Delete — only for a pipeline of its own
   stages (not a property's values) with no records in it, no workflow in its context, and another
   pipeline for its Record to keep; asked first (DeletePipelineModal). */
const pipelineDealCount = (pipeline, deals) => (deals || []).filter(d => d.pipeline === pipeline.id).length;
const pipelineDeletable = (pipeline, deals, data) => pipeline.source === 'record' && !pipelineDealCount(pipeline, deals)
  && !!data && !(data.workflows || []).some(w => w.context && w.context.pipeline === pipeline.id)
  && (data.pipelines || []).some(p => p.objectId === pipeline.objectId && p.id !== pipeline.id);
const pipelineMenuItems = (pipeline, deals, onEdit, noun = typeNoun('deals', 'deal'), data, onDelete) => {
  const n = pipelineDealCount(pipeline, deals), can = !!onDelete && pipelineDeletable(pipeline, deals, data);
  // Settings & Administration → Pipelines: Edit and Delete, for the pipeline's record type.
  return [
    ...(pipelineAdminCan(pipeline.objectId, 'edit', pipeline) ? [{label:'Edit Pipeline', onClick:onEdit}] : []),
    ...(pipelineAdminCan(pipeline.objectId, 'delete', pipeline) ? [{label:'Delete Pipeline', danger:can, disabled:!can, onClick:can ? onDelete : ()=>{}}] : []),
  ];
};

/* Edit pipeline: its name, its stages' names and each stage's Stage Type (Open, Won, Lost,
   Undecided — board.jsx). A renamed stage is the same stage (same id), so every record in it shows
   the new name; nothing moves. Closed stages (Won, Lost, Undecided) sit outside the ordered stages
   that Stage Movement Forward / Backward and Move Stage Forward / Backward follow. A
   property-driven pipeline's stage names are its property's values: only their types change here. */
// `taken`: the other pipelines' names for the same Record (lower case) — a name is used once, as New Pipeline requires.
function EditPipelineModal({pipeline, setData, onClose, taken = []}){
  const [label, setLabel] = React.useState(pipeline.label);
  const [names, setNames] = React.useState(() => Object.fromEntries(pipeline.stages.map(s => [s.id, s.label])));
  const [types, setTypes] = React.useState(() => Object.fromEntries(pipeline.stages.map(s => [s.id, stageTypeOf(s)])));
  const ownNames = pipeline.source === 'record';
  const trimmed = pipeline.stages.map(s => (names[s.id] || '').trim());
  const dupes = trimmed.some((n, i) => n && trimmed.findIndex(x => x.toLowerCase() === n.toLowerCase()) !== i);
  const nameTaken = taken.includes(label.trim().toLowerCase());
  const ok = !!label.trim() && !nameTaken && trimmed.every(Boolean) && !dupes;
  const save = () => {
    setData(d => ({...d, pipelines:d.pipelines.map(p => p.id !== pipeline.id ? p
      : {...p, label:label.trim(), stages:p.stages.map(s => ({...withStageType(s), ...(ownNames ? {label:(names[s.id] || s.label).trim()} : {}), type:types[s.id] || 'open'}))})}));
    onClose();
  };
  // A side panel, as Add Pipeline (labels beside the fields).
  return (
    <CreatePanelFrame title="Edit Pipeline" onClose={onClose} zIndex={110} actions={<>
      <StSecondary label="Cancel" onClick={onClose}/>
      <StCta label="Save Changes" disabled={!ok} onClick={()=>ok && save()}/>
    </>}>
      <div style={{display:'flex', flexDirection:'column', gap:16}}>
      <Field label="Pipeline Name" wide>
        <input id="pipeline-name" value={label} onChange={e=>setLabel(e.target.value)} style={fieldInput}/>
        {nameTaken && <div style={{fontSize:12, color:T.red, marginTop:6}}>Another pipeline has this name.</div>}
      </Field>
      <Field label="Stages" wide>
        <div>
        <div style={{display:'flex', alignItems:'baseline'}}>
          <span style={{flex:1}}/>
          <span style={{...fieldLabel, width:130, flexShrink:0}}>Stage Type</span>
        </div>
        {/* Plain rows, in pipeline order. */}
        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          {pipeline.stages.map((s, i) => (
            <div key={s.id} style={{display:'flex', alignItems:'center', gap:10}}>
              <span style={{width:18, fontSize:12.5, color:T.gray400, fontVariantNumeric:'tabular-nums', flexShrink:0}}>{i + 1}</span>
              <input value={names[s.id]} disabled={!ownNames} onChange={e=>setNames(m => ({...m, [s.id]:e.target.value}))}
                style={{...fieldInput, ...(ownNames ? {} : {background:T.headerBg, color:T.attioMuted})}}/>
              <div style={{width:130, flexShrink:0}}><StageTypeSelect value={types[s.id]} onChange={v=>setTypes(m => ({...m, [s.id]:v}))}/></div>
            </div>
          ))}
        </div>
        {dupes && <div style={{fontSize:12, color:T.red, marginTop:6}}>Two stages can't have the same name.</div>}
        </div>
      </Field>
      </div>
    </CreatePanelFrame>
  );
}

function DeletePipelineModal({pipeline, setData, onCancel, onDeleted}){
  return (
    <StModal title="Delete Pipeline" primary="Delete Pipeline" danger onCancel={onCancel}
      onSubmit={()=>{ setData(d => ({...d, pipelines:(d.pipelines || []).filter(p => p.id !== pipeline.id)})); onDeleted && onDeleted(); }}>
      <div style={stTextB}>"{pipeline.label}" will be deleted. This can't be undone.</div>
    </StModal>
  );
}
function AddStageModal({stages, onCancel, onAdd}){
  const [label, setLabel] = React.useState('');
  const [type, setType] = React.useState('open');
  const l = label.trim();
  const taken = stages.some(s => s.label.toLowerCase() === l.toLowerCase());
  return (
    <StModal title="Add Stage" primary="Add Stage" canSubmit={!!l && !taken} onCancel={onCancel} onSubmit={()=>onAdd(l, type)}>
      <div>
        <label style={fieldLabel} htmlFor="stage-name">Stage Name</label>
        <input id="stage-name" autoFocus value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Documents Received" style={fieldInput}
          onKeyDown={e=>{ if(e.key === 'Enter' && l && !taken) onAdd(l, type); }}/>
        {taken && <div style={{fontSize:12, color:T.red, marginTop:4}}>This pipeline already has a stage with this name.</div>}
      </div>
      <div>
        <label style={fieldLabel}>Stage Type</label>
        <StageTypeSelect value={type} onChange={setType}/>
      </div>
    </StModal>
  );
}

Object.assign(window, {PipelinePanel, PIPELINE_PANEL_LEFT, EditPipelineModal, DeletePipelineModal, pipelineMenuItems});
