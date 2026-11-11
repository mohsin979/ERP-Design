/* HOF Pulse ERP — CRM → Automation → Workflows: every configured workflow in one list.

   Workflows are built from a pipeline stage (Settings → Pipelines) or a pipeline; this page is
   where all of them can be found and managed — including ones with no stage (a pipeline- or
   Object-level context), which no stage lists. + creates a workflow here (Company-wide until a
   context is chosen in the builder). The name opens the builder (full section, as from a
   pipeline); ⋯ turns a workflow on or off, renames it or deletes it. */

const WORKFLOW_LIST_COLS = [
  {key:'name', label:'Workflow', width:240}, {key:'typeName', label:'Type', width:150}, {key:'objectName', label:'Record', width:120}, {key:'pipelineName', label:'Pipeline', width:180},
  {key:'stageName', label:'Stage', width:160}, {key:'triggerText', label:'Triggers', width:280}, {key:'actionCount', label:'Actions', width:100},
  {key:'status', label:'Status', width:110}, {key:'version', label:'Version', width:100}, {key:'lastRun', label:'Last run', width:170}, {key:'createdBy', label:'Created By', width:170},
];

function WorkflowsPage({data, setData}){
  const ctx = useWorkflowEngineCtx();
  const [editing, setEditing] = React.useState(null);     // a workflow
  const [deleting, setDeleting] = React.useState(null);   // a workflow
  const [renaming, setRenaming] = React.useState(null);   // a workflow
  const [stub, setStub] = React.useState(null);
  const pipelineOf = (id) => (data.pipelines || []).find(p => p.id === id);
  const lastRunOf = (id) => ctx && ctx.state.runs.filter(r => r.workflowId === id && r.startedAt).sort((a, b) => b.startedAt - a.startedAt)[0];
  // Active (green), Needs attention (on, but a stage, template or person it uses is gone — fixed in the builder), Off.
  const WORKFLOW_LIST_STATUS = {'Active':{label:'Active', tone:'success'}, 'Needs attention':{label:'Needs attention', tone:'warn'}, 'Off':{label:'Off', tone:'neutral'}};
  const rows = (data.workflows || []).filter(raw => workflowCan('view', raw)).map(raw => {
    const w = normalizeWorkflow(raw), views = workflowTriggerViews(w);
    // Its context's pipeline and stage (else its stage trigger's stage) — not the place it was opened from.
    const pl = pipelineOf(workflowPipeline(w)), stage = workflowStage(w) || (pl ? (views.find(v => v.triggerConfig.stage) || {triggerConfig:{}}).triggerConfig.stage : null);
    const ready = workflowReady(w, data);
    const run = lastRunOf(w.id);
    return {id:w.id, raw, createdBy:creatorOf(w), name:w.name || workflowTitle(data, w) || 'Workflow', typeName:(workflowTypeOf(w.type) || {}).label || '—', objectName: w.context.object ? objectName(data, w.context.object) : 'Company-wide',
      pipelineName: pl ? pl.label : '—', stageName: stage && pl ? ((pl.stages.find(s => s.id === stage) || {}).label || '—') : '—',
      triggerText: views.map(v => triggerSummary(data, v) || (workflowTrigger(v.trigger) || {}).label).filter(Boolean).join(w.triggerMatch === 'any' ? ' · or · ' : ' · and · ') || '—',
      actionCount:(w.actions || []).length, status: w.active === false ? 'Off' : ready ? 'Active' : 'Needs attention', ready, version:`v${w.version || 1}`,
      lastRun: run ? new Date(run.startedAt).toLocaleString('en-US', {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}) : '—'};
  });
  const schema = {
    properties:WORKFLOW_LIST_COLS, noun:'workflow', searchKeys:['name', 'pipelineName', 'stageName'], fillWidth:true, canCreateProperty:false, selectable:false,
    filterProps:[{key:'name', label:'Workflow', type:'text'}, {key:'typeName', label:'Type', type:'select'}, {key:'pipelineName', label:'Pipeline', type:'select'}, {key:'stageName', label:'Stage', type:'select'}, {key:'status', label:'Status', type:'select'}],
    selectValues:{typeName:WORKFLOW_TYPES.map(t => t.label), pipelineName:(data.pipelines || []).map(p => p.label), stageName:[...new Set((data.pipelines || []).flatMap(p => p.stages.map(s => s.label)))], status:['Active', 'Needs attention', 'Off']},
    renderCell:(key, r) => key === 'name' ? <ContactName name={r.name} onOpen={()=>setEditing(r.raw)} style={{fontSize:'inherit', fontWeight:500}}/>
      : key === 'status' ? <StatusPill status={r.status} map={WORKFLOW_LIST_STATUS}/>
      : undefined,
    // Turn on / off needs Stop; Rename and Delete need Edit (workflow permissions).
    renderActions:(r) => <RowActionsMenu title="Workflow actions" width={MENU_W} items={[
      {label:'Open', onClick:()=>setEditing(r.raw)},
      // Turn on: only a workflow that's ready (one needing attention is opened and fixed first).
      ...(canWorkflow(data, r.raw, 'stop') ? [{label: r.status === 'Off' ? 'Turn on' : 'Turn off', disabled: r.status === 'Off' && !r.ready, onClick:()=>setWorkflowActiveIn(setData, r.id, r.status === 'Off')}] : []),
      ...(canWorkflow(data, r.raw, 'edit') ? [{label:'Rename workflow', onClick:()=>setRenaming(r)}] : []),
      ...(canWorkflow(data, r.raw, 'delete') ? [{label:'Delete workflow', danger:true, onClick:()=>setDeleting(r.raw)}] : []),
    ]}/>,
  };
  return (
    <div style={{position:'relative', flex:1, minHeight:0, display:'flex', flexDirection:'column', overflow:'hidden'}}>
      <RecordViewsModule inset="page" schema={schema} rows={rows} columns={WORKFLOW_LIST_COLS.map(c => c.key)} defaultViews={[{id:'wfl-all', name:'All Workflows'}]}
        actions={() => workflowCan('create') && <button onClick={()=>setEditing(newWorkflowDraft({}, {type:'workflows'}))} title="New workflow" aria-label="New workflow" style={toolbarIconButton}><Icon name="plus" size={14} color={T.gray800}/></button>}/>
      {/* The builder: a full section over the list, as from a pipeline stage. */}
      {editing && <WorkflowEditorOverlay data={data} setData={setData} workflow={editing} onClose={()=>setEditing(null)} onStub={setStub}/>}
      {renaming && <RenameWorkflowModal name={renaming.raw.name || renaming.name} onCancel={()=>setRenaming(null)}
        onSave={(name)=>{ renameWorkflowIn(setData, renaming.id, name); setRenaming(null); }}/>}
      {deleting && (
        <StModal title="Delete workflow" primary="Delete workflow" danger onCancel={()=>setDeleting(null)}
          onSubmit={()=>{ deleteWorkflowIn(setData, deleting.id); setDeleting(null); }}>
          <div style={{fontSize:13, color:T.attioText}}>Delete {deleting.name || 'this workflow'}? It stops running; its run history stays.</div>
        </StModal>
      )}
      {stub && <StubPanel title={stub} onClose={()=>setStub(null)} zIndex={110}/>}
    </div>
  );
}

Object.assign(window, {WorkflowsPage});
