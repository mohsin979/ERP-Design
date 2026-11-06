/* HOF Pulse ERP — Marketing → Forms.

   Forms collect leads. Each form has its details (name, description, who created it and when),
   the record type it creates (Contact, Deal or Customer), its fields and the sources it's
   connected to.

     New / Edit form — one full-height side panel (CreatePanelFrame, fixed): Form details (Form
                  name, Description), then the form builder — what the form creates, its fields
                  — each a property type (propertyTypes.jsx: its input, validation and value) —
                  with its label, whether it's required, its options and the property of the same
                  type it fills in (Maps to); one field must map to Name — with the form's preview
                  beside it. Save and Connect (once the form is valid) saves it and opens
                  its connections.
     Connections — Meta and Website RFQ. Mocked: Connect / Disconnect, and Simulate lead, which
                  fills in the form as that source; the website shows its embed snippet.
     Submission — a test submission (or a simulated lead) creates the record from the mapped
                  fields (hub.createRecord) and is kept on the form with the record it created.

   Nothing reaches a real Meta account or website: there is no backend behind the prototype. */

// A field's type is a property type (every type a property can be created with).
const FORM_FIELD_TYPES = CREATABLE_PROPERTY_TYPES.map(t => ({type:t, label:t}));
// Field types saved before: their property types.
const LEGACY_FORM_FIELD_TYPES = {text:'Single-Line Text', paragraph:'Multi-Line Text', radio:'Single Selection', checkbox:'Multi-Selection'};
const formFieldType = (t) => LEGACY_FORM_FIELD_TYPES[t] || propertyTypeId(t);
// A field as a property (for its input, validation and value).
const formFieldProperty = (f) => ({key:f.id, label:f.label || 'This field', type:formFieldType(f.type), options:(f.options || []).filter(o => String(o).trim()), range:f.range});
const fieldHasOptions = (t) => CHOICE_TYPES.includes(formFieldType(t));
/* Where leads come from. Meta: its mark; Website RFQ: a globe. */
function MetaMark({size = 18}){
  return <span aria-hidden="true" style={{fontSize:size * .62, fontWeight:700, color:'#0866FF', letterSpacing:-.2}}>Meta</span>;
}
function GlobeMark({size = 18, color = T.attioText}){
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3.5 9h17M3.5 15h17"/>
    </svg>
  );
}
const FORM_CONNECTIONS = [
  {id:'meta',    name:'Meta',        Mark:MetaMark},
  {id:'website', name:'Website RFQ', Mark:GlobeMark},
];
// Sources a form was connected to before (kept so their submissions still say where they came from).
const FORM_SOURCE_NAMES = {meta:'Meta', website:'Website RFQ', link:'Public link', instagram:'Instagram', whatsapp:'WhatsApp'};
const FORM_TARGETS = ['contacts', 'deals', 'customers'];
const formFieldId = () => `ff-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const formNoun = (object) => HUB_NOUN[object] || 'Record';
// The properties a field can fill in: the record type's own, editable ones of the same type.
const formMappable = (data, object, fieldType) => objectFormProperties(data, object).filter(p => !p.auto && propertyTypeId(p.type) === formFieldType(fieldType));
const formConnectedNames = (f) => FORM_CONNECTIONS.filter(c => f.connections && f.connections[c.id]).map(c => c.name);
// The link a connection asks for, kept on it (connections[id].link).
const FORM_CONNECTION_LINKS = {meta:'Meta form link', website:'Website RFQ page link'};
const isFormUrl = (v) => /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(String(v || '').trim());
/* A form's links (the Link column): each connected source's saved link; with none, the form's own
   share link. */
const formLinks = (f) => {
  const links = FORM_CONNECTIONS.filter(c => f.connections && f.connections[c.id] && f.connections[c.id].link)
    .map(c => ({id:c.id, source:c.name, url:f.connections[c.id].link}));
  return links.length ? links : [{id:'share', source:'Share link', url:formLink(f)}];
};
const openFormUrl = (url) => { try { window.open(url, '_blank', 'noopener'); } catch(e){} };
/* The records a form's submissions created (the ones that still exist), for the submissions count:
   one opens it; several, a list (the associated-records dropdown). */
const formSubmissionRecords = (hub, f) => {
  const seen = new Set();
  return (f.submissions || []).map(s => {
    const rec = ((hub.records || {})[s.object] || []).find(r => String(r.id) === String(s.recordId));
    if(!rec || seen.has(`${s.object}:${rec.id}`)) return null;
    seen.add(`${s.object}:${rec.id}`);
    return {id:`${s.object}:${rec.id}`, object:s.object, recordId:rec.id, name:rec.name || `${formNoun(s.object)} ${rec.id}`};
  }).filter(Boolean);
};
/* ── Status ── Draft (being set up, not public), Published (its public link takes responses) and
   Connected (a source — Meta, Website RFQ — is connected). Publishing and connecting are separate:
   the column shows one status, Connected over Published over Draft. A Draft form still takes
   leads from its connected sources and test submissions; only the public link is closed. */
const SAMPLE_FORM_IDS = ['form-1', 'form-2'];
const formPublished = (f) => !!f && (f.published ?? SAMPLE_FORM_IDS.includes(f.id));   // samples saved before statuses: published
const formStatus = (f) => formConnectedNames(f).length ? 'connected' : formPublished(f) ? 'published' : 'draft';
const FORM_STATUS = {draft:{label:'Draft', tone:'neutral'}, published:{label:'Published', tone:'success'}, connected:{label:'Connected', tone:'info'}};
/* A submission, however it came (Test submission, a simulated lead, the public link): the mapped
   answers become the new record's values; Form Submitted reaches its workflows; the submission is
   kept on the form with the record it created. Returns the new record's id and its values. */
function submitFormValues(hub, engineCtx, form, via, values){
  const vals = {};
  const props = objectProperties(hub.data, form.target);
  form.fields.forEach(f => { if(!f.mapTo) return; const p = props.find(x => x.key === f.mapTo) || formFieldProperty(f); vals[f.mapTo] = storePropertyValue(p, values[f.id] ?? ''); });
  // The answers are kept with the submission (each field's value, as its property type stores it).
  const answers = Object.fromEntries(form.fields.map(f => [f.id, storePropertyValue(formFieldProperty(f), values[f.id] ?? '')]));
  const sub = {id:`sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, at:new Date(), via:via || null, object:form.target, answers};
  /* Workflows see the submission as the record is created (New Record, entering its pipeline or
     stage) and on Form Submitted — before the form's list is saved. */
  if(engineCtx) engineCtx.api.beginFormSubmission(form, sub);
  const id = hub.createRecord(form.target, vals, {via});
  if(engineCtx && id != null) engineCtx.api.formSubmitted(form.target, id, form.id, {...sub, recordId:id});
  hub.setForms(fs => fs.map(f => f.id === form.id ? {...f, submissions:[...(f.submissions || []), {...sub, recordId:id}], updatedAt:new Date()} : f));
  return {id, vals};
}
/* The submission that created each record ("<object>:<id>" → {form, submission}): Form Name and
   Form Submission Date on the record, and the Form properties in workflows. */
const formSubmissionIndex = (forms) => {
  const m = new Map();
  (forms || []).forEach(f => (f.submissions || []).forEach(s => { if(s.recordId != null) m.set(`${s.object}:${s.recordId}`, {form:f, submission:s}); }));
  return m;
};
const formRecordValues = (index, object, id) => {
  const hit = index.get(`${object}:${id}`);
  return hit ? {formName:hit.form.name, formSubmittedAt:storePropertyValue({type:'Timestamp'}, new Date(hit.submission.at))} : {formName:'', formSubmittedAt:''};
};
const FORM_SUBMISSION_SOURCES = [{value:'Meta', via:'meta'}, {value:'Website RFQ', via:'website'}, {value:'Public link', via:'link'}, {value:'Test submission', via:null}];
const formSubmissionSource = (sub) => (FORM_SUBMISSION_SOURCES.find(x => x.via === (sub.via || null)) || {}).value || FORM_SOURCE_NAMES[sub.via] || '';
// The submissions count: plain with no record to open; else the record, or the dropdown of them.
function FormSubmissionsValue({form, inTable}){
  const hub = useRecordHub();
  const count = (form.submissions || []).length, records = formSubmissionRecords(hub, form);
  if(!records.length) return <span style={{fontVariantNumeric:'tabular-nums'}}>{count}</span>;
  return <AssociatedRecordsValue records={records} noun="record" count={count} inTable={inTable} width={260} onOpen={(r)=>hub.openRecord(r.object, r.recordId)}/>;
}

/* Sample forms (HOF Migration): one connected to Meta, one on the website. */
const SAMPLE_FORMS = () => {
  const at = (m, d, h = 10) => new Date(2026, m - 1, d, h, 0);
  const f = (id, label, type, mapTo, extra = {}) => ({id, label, type, required:!!extra.required, options:extra.options || [], mapTo:mapTo || ''});
  return [
    {id:'form-1', name:'Canada PR Eligibility', description:'Lead form for the Canada Express Entry campaign.', target:'contacts',
      fields:[f('ff-1a', 'Full name', 'Single-Line Text', 'name', {required:true}), f('ff-1b', 'Email', 'Email', 'email', {required:true}), f('ff-1c', 'Phone', 'Phone Number', 'phone'),
        f('ff-1d', 'Highest education', 'Single Selection', '', {options:["Bachelor's", "Master's", 'PhD']}), f('ff-1e', 'Anything else we should know?', 'Multi-Line Text', '')],
      connections:{meta:{at:at(9, 2)}}, published:true, submissions:[], createdBy:'Waleed bin Zaman', createdAt:at(9, 1)},
    {id:'form-2', name:'Website RFQ', description:'Request for a quotation from the website.', target:'contacts',
      fields:[f('ff-2a', 'Name', 'Single-Line Text', 'name', {required:true}), f('ff-2b', 'Email', 'Email', 'email', {required:true}),
        f('ff-2c', 'Services of interest', 'Multi-Selection', '', {options:['US NIW', 'Canada Express Entry', 'Australia Skilled Migration']}), f('ff-2d', 'Message', 'Multi-Line Text', '')],
      connections:{website:{at:at(9, 10)}}, published:true, submissions:[], createdBy:'Ali Noor', createdAt:at(9, 9)},
  ];
};

/* A form as the person filling it in sees it. `values` / `onChange`: fillable (test submission);
   without them it's a read-only preview. */
function FormPreview({form, values, onChange, tried}){
  const live = !!onChange;
  return (
    <div style={{display:'flex', flexDirection:'column', gap:16}}>
      <div>
        <div style={{fontSize:16, fontWeight:600, color:T.attioText}}>{form.name || 'Untitled form'}</div>
        {form.description && <div style={{fontSize:13, color:T.attioMuted, lineHeight:1.5, marginTop:4}}>{form.description}</div>}
      </div>
      {form.fields.map(f => {
        const p = formFieldProperty(f), v = (values || {})[f.id], err = tried && propertyValueError(p, v, f.required);
        return (
          <div key={f.id} style={{display:'flex', flexDirection:'column', gap:6}}>
            <span style={{fontSize:13, fontWeight:500, color:T.attioText}}>{f.label || 'Untitled field'}{f.required && <span style={{color:T.red}}> *</span>}</span>
            {/* The preview shows the control; only a submission fills it in. */}
            <div aria-disabled={!live || undefined} {...(!live ? {inert:''} : {})} style={{pointerEvents: live ? 'auto' : 'none'}}>
              <TypedPropertyInput prop={p} value={v ?? loadPropertyValueOf(p, '')} invalid={!!err} onChange={(nv)=>live && onChange(f.id, nv)}/>
            </div>
            {err && <span style={{fontSize:12, color:T.red}}>{err}</span>}
          </div>
        );
      })}
      {!form.fields.length && <div style={{fontSize:13, color:T.attioMuted}}>No fields yet.</div>}
    </div>
  );
}

/* A field's label: type one, or pick one of the record type's property names (the chevron). */
function FieldLabelInput({value, onChange, suggestions, ariaLabel}){
  const [open, setOpen] = React.useState(false);
  const list = suggestions.filter(x => !value || x.toLowerCase().includes(value.toLowerCase()));
  return (
    <div style={{position:'relative'}} onBlur={()=>setTimeout(()=>setOpen(false), 120)}>
      <input value={value} onChange={e=>{ onChange(e.target.value); setOpen(true); }} onFocus={()=>setOpen(true)} placeholder="Field label" aria-label={ariaLabel}
        style={{...fieldText, paddingRight:30}}/>
      <button type="button" tabIndex={-1} onMouseDown={e=>e.preventDefault()} onClick={()=>setOpen(o => !o)} title="Choose a label"
        style={{position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:3}}>
        <Icon name="chevDown" size={12} color={T.gray600}/></button>
      {open && list.length > 0 && (
        <div style={{position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:5, background:'#fff', border:`1px solid ${T.border}`, borderRadius:8,
          boxShadow:'0 8px 24px rgba(16,24,40,.12)', maxHeight:200, overflowY:'auto', padding:'4px 0'}}>
          {list.map(x => (
            <div key={x} onMouseDown={e=>e.preventDefault()} onClick={()=>{ onChange(x); setOpen(false); }}
              style={{padding:'7px 10px', fontSize:13, color:T.attioText, cursor:'pointer'}}
              onMouseEnter={e=>e.currentTarget.style.background = T.headerBg} onMouseLeave={e=>e.currentTarget.style.background = 'transparent'}>{x}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/* The builder's fields, one card each — label, type, required, options (and a Custom Range's
   settings), moved up / down or removed, and "Add field" for any field type. Shared by Marketing
   forms and Customer Profile forms; each adds its own settings to a card:
     `cells(f, i)`    — more cells beside Label / Type (Marketing: Maps to)
     `below(f, i)`    — rows under the options (Customer Profile: Show only when, Fill from)
     `onType(f, type)` — the patch when a field's type changes (keeps what still fits)
     `suggestions(f)` — label suggestions
     `required`        — whether a field can be marked Required (Marketing: yes) */
function FormFieldsList({fields, setFields, cells, below, onType, suggestions, required = true}){
  const [adding, setAdding] = React.useState(false);   // the Add field menu
  const setField = (id, p) => setFields(fs => fs.map(f => f.id === id ? {...f, ...p} : f));
  const move = (i, d) => setFields(fs => { const n = fs.slice(); const [f] = n.splice(i, 1); n.splice(i + d, 0, f); return n; });
  const add = (type) => setFields(fs => [...fs, {id:formFieldId(), type, label:'', required:false, options: fieldHasOptions(type) ? ['', ''] : [], range:{label:'', min:'', max:''}, mapTo:''}]);
  const iconBtn = (icon, title, onClick, disabled) => <button type="button" title={title} disabled={disabled} onClick={onClick}
    style={{border:'none', background:'transparent', cursor: disabled ? 'default' : 'pointer', display:'flex', padding:4, opacity: disabled ? .35 : 1}}><Icon name={icon} size={13} color={T.gray600}/></button>;
  const label = {fontSize:12.5, color:T.attioMuted};
  return (<>
    {fields.map((f, i) => {
      const cell = (title, control) => <div style={{display:'flex', flexDirection:'column', gap:6, minWidth:0}}><span style={label}>{title}</span>{control}</div>;
      const extra = cells ? cells(f, i, cell) : null;
      return (
        <div key={f.id} style={{border:`1px solid ${T.attioLine}`, borderRadius:12, padding:16, display:'flex', flexDirection:'column', gap:14}}>
          <div style={{display:'flex', alignItems:'center', gap:6}}>
            <span style={{flex:1, fontSize:14, fontWeight:500, color:T.attioText, fontVariantNumeric:'tabular-nums'}}>Field # {i + 1}</span>
            {iconBtn('arrowUp', 'Move up', ()=>move(i, -1), i === 0)}
            {iconBtn('arrowDown', 'Move down', ()=>move(i, 1), i === fields.length - 1)}
            {iconBtn('trash', 'Remove field', ()=>setFields(fs => fs.filter(x => x.id !== f.id)))}
          </div>
          <div style={{display:'grid', gridTemplateColumns:'minmax(0, 1fr) minmax(0, 1fr)', gap:'14px 16px', alignItems:'end'}}>
            {cell('Label', <FieldLabelInput value={f.label} onChange={v=>setField(f.id, {label:v})} suggestions={suggestions ? suggestions(f) : []} ariaLabel={`Field ${i + 1} label`}/>)}
            {extra}
            {cell('Type', <Select value={f.type} options={FORM_FIELD_TYPES.map(t => ({value:t.type, label:t.label}))}
              onChange={v=>v && setField(f.id, {type:v, options: fieldHasOptions(v) && !f.options.length ? ['', ''] : f.options, ...(onType ? onType(f, v) : {})})}/>)}
            {required ? (
              <label onClick={()=>setField(f.id, {required:!f.required})} style={{display:'flex', alignItems:'center', gap:8, height:34, fontSize:13, color:T.attioText, cursor:'pointer', alignSelf:'end'}}>
                <RowCheckbox checked={f.required} onChange={()=>setField(f.id, {required:!f.required})}/> Required
              </label>
            ) : null}
          </div>
          {formFieldType(f.type) === 'Custom Range' && <PropertyTypeConfig type={f.type} range={f.range} setRange={(r)=>setField(f.id, {range:r})}/>}
          {fieldHasOptions(f.type) && (
            <div style={{display:'flex', flexDirection:'column', gap:6}}>
              <span style={label}>Options</span>
              {f.options.map((o, j) => (
                <div key={j} style={{display:'flex', alignItems:'center', gap:6}}>
                  <input value={o} onChange={e=>setField(f.id, {options:f.options.map((x, k) => k === j ? e.target.value : x)})} placeholder={`Option ${j + 1}`} style={{...fieldText, flex:1}}/>
                  {iconBtn('close', 'Remove option', ()=>setField(f.id, {options:f.options.filter((_, k) => k !== j)}), f.options.length <= 1)}
                </div>
              ))}
              <button type="button" onClick={()=>setField(f.id, {options:[...f.options, '']})}
                style={{alignSelf:'flex-start', display:'inline-flex', alignItems:'center', gap:6, border:'none', background:'transparent', padding:'2px 0', fontSize:13, color:T.attioText, cursor:'pointer', fontFamily:'inherit'}}>
                <Icon name="plus" size={12} color={T.gray600}/> Add option
              </button>
            </div>
          )}
          {below && below(f, i, (p) => setField(f.id, p))}
        </div>
      );
    })}
    {/* Add field: any field type. */}
    <div style={{position:'relative', alignSelf:'flex-start'}}>
      <button type="button" onMouseDown={e=>e.stopPropagation()} onClick={()=>setAdding(o => !o)} style={btnSecondarySm}><Icon name="plus" size={12} color={T.gray600}/> Add field</button>
      <MenuShell open={adding} onClose={()=>setAdding(false)} width={220}>
        {FORM_FIELD_TYPES.map(t => <MenuItem key={t.type} label={t.label} onClick={()=>{ setAdding(false); add(t.type); }}/>)}
      </MenuShell>
    </div>
  </>);
}

/* ── New / Edit form: one full-height side panel ── the details, the builder and the preview
   together; Save and Connect once the form is valid. `onSave(values)` returns the form's id. */
function FormEditorPanel({form, onCancel, onSave}){
  const hub = useRecordHub();
  const [name, setName] = React.useState(form ? form.name : '');
  const [description, setDescription] = React.useState(form ? form.description || '' : '');
  const [target, setTarget] = React.useState((form && form.target) || 'contacts');
  const [fields, setFields] = React.useState(() => ((form && form.fields) || []).map(f => ({...f, type:formFieldType(f.type), options:[...(f.options || [])]})));
  const setField = (id, p) => setFields(fs => fs.map(f => f.id === id ? {...f, ...p} : f));
  // Changing the record type clears mappings it doesn't have.
  const pickTarget = (t) => { setTarget(t); setFields(fs => fs.map(f => formMappable(hub.data, t, f.type).some(p => p.key === f.mapTo) ? f : {...f, mapTo:''})); };
  const problems = [];
  if(!name.trim()) problems.push('Give the form a name.');
  if(!fields.length) problems.push('Add at least one field.');
  if(fields.some(f => !f.label.trim())) problems.push('Every field needs a label.');
  if(fields.some(f => fieldHasOptions(f.type) && f.options.filter(o => o.trim()).length < 1)) problems.push('Selection fields need at least one option.');
  if(fields.some(f => !typeConfigOk(f.type, f.options, f.range))) problems.push('A Custom Range’s minimum can’t exceed its maximum.');
  if(fields.length && !fields.some(f => f.mapTo === 'name')) problems.push(`Map one field to Name — it names the ${formNoun(target).toLowerCase()}.`);
  const mapped = fields.map(f => f.mapTo).filter(Boolean);
  if(new Set(mapped).size !== mapped.length) problems.push('Each property can be filled in by one field only.');
  const ok = !problems.length;
  const save = () => ok && onSave({name:name.trim(), description:description.trim(), target,
    fields:fields.map(f => ({...f, label:f.label.trim(), ...typeSettings(f.type, f.options, f.range), options:fieldHasOptions(f.type) ? f.options.map(o => o.trim()).filter(Boolean) : []}))});
  const iconBtn = (icon, title, onClick, disabled) => <button type="button" title={title} disabled={disabled} onClick={onClick}
    style={{border:'none', background:'transparent', cursor: disabled ? 'default' : 'pointer', display:'flex', padding:4, opacity: disabled ? .35 : 1}}><Icon name={icon} size={13} color={T.gray600}/></button>;
  const label = {fontSize:12.5, color:T.attioMuted};
  const section = {fontSize:11, fontWeight:600, color:T.attioFaint, textTransform:'uppercase', letterSpacing:.4};
  return (
    <CreatePanelFrame title={form ? 'Edit Form' : 'New Form'} onClose={onCancel} placement="fixed" width="min(1120px, calc(100vw - 72px))" flush more={false}
      actions={<>
        <StSecondary label="Cancel" onClick={onCancel}/>
        <StCta label="Save and Connect" disabled={!ok} onClick={save}/>
      </>}>
      {/* Left — the form's details, then the builder. */}
      <div style={{flex:1, minWidth:0, overflowY:'auto', padding:20, display:'flex', flexDirection:'column', gap:16}}>
        <span style={section}>Form details</span>
        {stack(<>
          <Field label="Form name" wide><input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Canada PR Eligibility" style={fieldText}/></Field>
          <Field label="Description" wide><textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} style={{...fieldText, resize:'vertical', lineHeight:1.5}}/></Field>
        </>)}
        <div style={{borderTop:`1px solid ${T.border}`, margin:'4px -20px 0'}}/>
        <span style={section}>Form builder</span>
        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          <span style={label}>Creates</span>
          <div role="radiogroup" aria-label="Record type" style={{display:'inline-flex', alignSelf:'flex-start', border:`1px solid ${T.borderStrong}`, borderRadius:8, overflow:'hidden'}}>
            {FORM_TARGETS.map(o => <button key={o} type="button" role="radio" aria-checked={target === o} onClick={()=>pickTarget(o)}
              style={{border:'none', cursor:'pointer', padding:'5px 12px', fontSize:12.5, fontWeight:500, fontFamily:'inherit',
                background: target === o ? T.black : 'transparent', color: target === o ? '#fff' : T.gray600}}>{HUB_NOUN[o]}</button>)}
          </div>
        </div>
        <FormFieldsList fields={fields} setFields={setFields}
          suggestions={(f) => formMappable(hub.data, target, f.type).map(p => p.label)}
          onType={(f, v) => ({mapTo: formMappable(hub.data, target, v).some(p => p.key === f.mapTo) ? f.mapTo : ''})}
          cells={(f, i, cell) => {
            const props = formMappable(hub.data, target, f.type);
            const taken = (k) => fields.some(x => x.id !== f.id && x.mapTo === k);
            return cell('Maps to', <Select value={f.mapTo || null} placeholder="Not mapped" options={props.map(p => ({value:p.key, label: taken(p.key) ? `${p.label} (used)` : p.label}))}
              onChange={v=>setField(f.id, {mapTo: v && !taken(v) ? v : ''})}/>);
          }}/>
      </div>
      {/* Right — the form as it will look. */}
      <div style={{width:420, flexShrink:0, overflowY:'auto', padding:20, borderLeft:`1px solid ${T.border}`, background:T.headerBg}}>
        <div style={{...section, marginBottom:10}}>Preview</div>
        <div style={{background:'#fff', border:`1px solid ${T.attioLine}`, borderRadius:10, padding:16}}>
          <FormPreview form={{id:(form && form.id) || 'new', name, description, fields}}/>
        </div>
      </div>
    </CreatePanelFrame>
  );
}

/* ── Connections (mocked): Meta and Website RFQ ── */
/* The form's shareable link: this app's address with the form's public route (#f~<workspace>~<form>)
   — the public form page (no sign-in). A prototype has no server: it works in a browser that holds
   the workspace's data (formPublicRoute, PublicFormPage). */
const formLink = (form) => `${window.location.origin}${window.location.pathname}#f~${ACTIVE_WORKSPACE.id}~${form.id}`;
function LinkMark({size = 18, color = T.attioText}){
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>
    </svg>
  );
}
/* `saved`: opened right after Save and Connect — "Form saved", with the success message. */
/* Connect asks for the source's link (the Meta form URL, the website page with the RFQ); a
   connected source shows it, and it can be added or changed (Edit link). */
function FormConnectionsModal({form, saved, onClose, onToggle, onSetLink, onSimulate}){
  const [copied, setCopied] = React.useState(null);   // 'link' | 'snippet'
  const [linking, setLinking] = React.useState(null); // {id, value}: the link being entered
  const snippet = `<script src="https://forms.pulse.app/embed/${form.id}.js" async></script>`;
  const copy = (what, text) => { try { navigator.clipboard.writeText(text); } catch(e){} setCopied(what); setTimeout(()=>setCopied(null), 1500); };
  const tile = (mark) => <span style={{width:40, height:32, borderRadius:8, background:'#fff', border:`1px solid ${T.attioLine}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>{mark}</span>;
  const row = {display:'flex', alignItems:'center', gap:12};
  return ReactDOM.createPortal(
    <StModal title={saved ? 'Form saved' : `Connections · ${form.name}`} width={600} onCancel={onClose} hideCancel>
      {saved && (
        <div style={{display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:8, background:'#ECFDF3', border:'1px solid #ABEFC6'}}>
          <span style={{width:20, height:20, borderRadius:9999, background:T.good, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}><Icon name="check" size={12} color="#fff"/></span>
          <span style={{fontSize:13, color:T.attioText}}>{form.name} is successfully saved.</span>
        </div>
      )}
      <div style={{display:'flex', flexDirection:'column'}}>
        {/* Copy link: the form for anyone to fill in, in their browser. */}
        <div style={{...row, padding:'12px 0'}}>
          {tile(<LinkMark/>)}
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:13.5, fontWeight:500, color:T.attioText}}>Copy link</div>
            <div style={{fontSize:12, color:T.attioMuted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{formLink(form)}</div>
            {!formPublished(form) && <div style={{fontSize:12, color:T.attioMuted, marginTop:2}}>Draft · publish the form so the link takes responses</div>}
          </div>
          <StSecondary label={copied === 'link' ? 'Copied' : 'Copy link'} onClick={()=>copy('link', formLink(form))}/>
        </div>
        {FORM_CONNECTIONS.map(c => {
          const on = form.connections && form.connections[c.id];
          return (
            <div key={c.id} style={{display:'flex', flexDirection:'column', gap:10, padding:'12px 0', borderTop:`1px solid ${T.attioLine}`}}>
              <div style={row}>
                {tile(<c.Mark/>)}
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:13.5, fontWeight:500, color:T.attioText}}>{c.name}</div>
                  <div style={{fontSize:12, color: on ? T.good : T.attioMuted}}>{on ? `Connected · ${fmtActDate(new Date(on.at))}` : 'Not connected'}</div>
                  {on && (
                    <div style={{display:'flex', alignItems:'baseline', gap:8, marginTop:2, minWidth:0}}>
                      {on.link && <span title={on.link} style={{fontSize:12, color:T.attioMuted, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{on.link}</span>}
                      {!(linking && linking.id === c.id) && <button onClick={()=>setLinking({id:c.id, value:on.link || ''})} style={{...formTextAction, fontSize:12, flexShrink:0}}>{on.link ? 'Edit link' : 'Add link'}</button>}
                    </div>
                  )}
                </div>
                {on && <StSecondary label="Simulate lead" onClick={()=>onSimulate(c.id)}/>}
                <StSecondary label={on ? 'Disconnect' : 'Connect'} onClick={()=>{ if(on){ onToggle(c.id, false); setLinking(null); } else setLinking({id:c.id, value:''}); }}/>
              </div>
              {/* The link: asked for on Connect; added or changed for a connected source. */}
              {linking && linking.id === c.id && (() => {
                const valid = isFormUrl(linking.value), done = () => { if(on) onSetLink(c.id, linking.value.trim()); else onToggle(c.id, true, linking.value.trim()); setLinking(null); };
                return (
                  <div style={{display:'flex', flexDirection:'column', gap:6, marginLeft:52}}>
                    <label style={fieldLabel}>{FORM_CONNECTION_LINKS[c.id]}</label>
                    <div style={{display:'flex', alignItems:'center', gap:8}}>
                      <input autoFocus value={linking.value} onChange={e=>setLinking({...linking, value:e.target.value})} placeholder="https://"
                        onKeyDown={e=>{ if(e.key === 'Enter' && valid) done(); if(e.key === 'Escape') setLinking(null); }} style={{...fieldInput, flex:1, minWidth:0}}/>
                      <StSecondary label="Cancel" onClick={()=>setLinking(null)}/>
                      <StCta label={on ? 'Save' : 'Connect'} disabled={!valid} onClick={done}/>
                    </div>
                    {linking.value.trim() && !valid && <span style={{fontSize:12, color:T.red}}>Enter a full link, starting with https://</span>}
                  </div>
                );
              })()}
              {on && c.id === 'website' && (
                <div style={{display:'flex', alignItems:'center', gap:8, marginLeft:52}}>
                  <code style={{flex:1, minWidth:0, fontSize:12, background:T.headerBg, border:`1px solid ${T.attioLine}`, borderRadius:6, padding:'6px 8px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{snippet}</code>
                  <StSecondary label={copied === 'snippet' ? 'Copied' : 'Copy'} onClick={()=>copy('snippet', snippet)}/>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </StModal>, document.body);
}

/* ── A submission: the form filled in (test, or a simulated lead from a source) ── */
function FormSubmissionModal({form, via, onClose, onSubmit}){
  const [values, setValues] = React.useState({});
  const [tried, setTried] = React.useState(false);
  const missing = form.fields.some(f => propertyValueError(formFieldProperty(f), values[f.id], f.required));
  const source = FORM_CONNECTIONS.find(c => c.id === via);
  return ReactDOM.createPortal(
    <StModal title={source ? `Simulate lead · ${source.name}` : 'Test submission'} width={560} primary="Submit"
      onCancel={onClose} onSubmit={()=>{ setTried(true); if(!missing) onSubmit(values); }}>
      <div style={{maxHeight:'60vh', overflowY:'auto'}}>
        <FormPreview form={form} values={values} tried={tried} onChange={(id, v)=>setValues(x => ({...x, [id]:v}))}/>
      </div>
    </StModal>, document.body);
}

/* A form's detail — the record pages' detail pattern (as a Note or a Call log): the form's name
   and close, a separator, its properties (label on the left) — Description, Creates, Fields,
   Connections (Edit / Add connection), Created by, Created at, Total submissions — and at the
   bottom ⋯, Share (copies its link), Preview Form and Edit Form. */
function ShareMark({size = 14, color = T.gray600}){
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12"/><path d="M7.5 7.5 12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>
    </svg>
  );
}
// A text action, underlined (Edit connection, the submissions count).
const formTextAction = {border:'none', background:'transparent', padding:0, fontFamily:'inherit', fontSize:13, color:T.attioText, cursor:'pointer',
  textDecorationLine:'underline', textUnderlineOffset:2};
function FormDetailPanel({form, menuItems, onClose, onEdit, onConnections, onPreview, onPublish}){
  const hub = useRecordHub();
  const connected = formConnectedNames(form);
  const iconBtn = {width:30, height:30, borderRadius:8, border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center'};
  const share = () => { try { navigator.clipboard.writeText(formLink(form)); } catch(e){} hub.toast('Form link copied'); };
  return (
    <ContentSidePanel width={560} zIndex={75} style={{background:'#fff', borderLeft:`1px solid ${T.border}`, boxShadow:'-8px 0 24px rgba(16,24,40,.08)', display:'flex', flexDirection:'column'}}>
      <div style={{display:'flex', alignItems:'center', gap:10, padding:'16px 20px', borderBottom:`1px solid ${T.border}`, flexShrink:0}}>
        <span style={{flex:1, minWidth:0, fontSize:15, fontWeight:600, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{form.name}</span>
        {/* Published: the workflow builder's Active toggle — the public link takes responses while on. */}
        <label style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:T.gray800, marginRight:4, cursor:'pointer'}}>
          Published<UtToggle on={formPublished(form)} onChange={onPublish}/>
        </label>
        <button title="Close" onClick={onClose} style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:4}}><Icon name="close" size={14} color={T.gray600}/></button>
      </div>
      <div style={{flex:1, minHeight:0, overflowY:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:20}}>
        {stack(<>
          <Field label="Status"><div style={{paddingTop:6}}><StatusPill status={formStatus(form)} map={FORM_STATUS}/></div></Field>
          <Field label="Description"><ReadValue>{form.description}</ReadValue></Field>
          <Field label="Creates"><ReadValue>{formNoun(form.target)}</ReadValue></Field>
          <Field label="Fields"><ReadValue>{String(form.fields.length)}</ReadValue></Field>
          <Field label="Connections">
            <div style={{display:'flex', flexWrap:'wrap', alignItems:'baseline', gap:'4px 10px', paddingTop:7}}>
              {connected.length > 0 && <span style={{fontSize:13, color:T.attioText}}>{connected.join(', ')}</span>}
              <button onClick={onConnections} style={formTextAction}>{connected.length ? 'Edit connection' : 'Add connection'}</button>
            </div>
          </Field>
          <Field label="Created by"><ReadValue>{form.createdBy}</ReadValue></Field>
          <Field label="Created at"><ReadValue>{fmtActStamp(new Date(form.createdAt))}</ReadValue></Field>
          <Field label="Total submissions">
            <div style={{paddingTop:7}}><FormSubmissionsValue form={form}/></div>
          </Field>
        </>)}
      </div>
      <div style={{display:'flex', alignItems:'center', justifyContent:'flex-end', gap:8, padding:'12px 20px', borderTop:`1px solid ${T.border}`, flexShrink:0}}>
        <RowActionsMenu title="Form actions" width={MENU_W} items={menuItems}/>
        <button title="Share — copy the form's link" onClick={share} style={iconBtn}><ShareMark size={15}/></button>
        <StSecondary label="Preview Form" onClick={onPreview}/>
        <StCta label="Edit Form" onClick={onEdit}/>
      </div>
    </ContentSidePanel>
  );
}
// The form as it appears to the person filling it in — read-only: nothing can be entered or submitted.
function FormPreviewModal({form, onClose}){
  return ReactDOM.createPortal(
    <StModal title={`Preview · ${form.name}`} width={560} onCancel={onClose}>
      <div style={{maxHeight:'65vh', overflowY:'auto'}}><FormPreview form={form}/></div>
    </StModal>, document.body);
}

/* ── Marketing → Forms ── */
const FORM_COLUMNS = [
  {key:'name', label:'Form Name', width:240}, {key:'statusLabel', label:'Status', width:120}, {key:'description', label:'Description', width:280}, {key:'targetLabel', label:'Creates', width:120},
  {key:'fieldCount', label:'Fields', width:90}, {key:'connectionsText', label:'Connections', width:220}, {key:'submissionCount', label:'Submissions', width:120},
  {key:'link', label:'Link', width:260},
  {key:'createdBy', label:'Created By', width:160}, {key:'createdText', label:'Created', width:150},
];
function FormsPage(){
  const hub = useRecordHub();
  const forms = hub.forms, setForms = hub.setForms;
  const [editor, setEditor] = React.useState(null);      // {id?}: the New / Edit form side panel
  const [openId, setOpenId] = React.useState(null);
  const [connectId, setConnectId] = React.useState(null);
  const [justSaved, setJustSaved] = React.useState(false);   // the connections modal opened by Save and Connect
  const [submitting, setSubmitting] = React.useState(null); // {id, via}
  const [deleting, setDeleting] = React.useState(null);
  const [previewId, setPreviewId] = React.useState(null);
  const byId = (id) => forms.find(f => f.id === id) || null;
  const open = byId(openId), connecting = byId(connectId), deletingForm = byId(deleting);
  const update = (id, patch) => setForms(fs => fs.map(f => f.id === id ? {...f, ...patch, updatedAt:new Date()} : f));
  const rows = forms.map(f => ({...f, statusLabel:FORM_STATUS[formStatus(f)].label, targetLabel:formNoun(f.target), fieldCount:f.fields.length, connectionsText:formConnectedNames(f).join(', '),
    submissionCount:(f.submissions || []).length, link:formLinks(f).map(l => l.url).join(', '), createdText:fmtActStamp(new Date(f.createdAt))}));
  // Publish / Unpublish: the workflow list's Turn on / Turn off.
  const setPublished = (f, on) => { update(f.id, {published:on}); hub.toast(on ? 'Form published · its link takes responses' : 'Form unpublished · its link is closed'); };
  const actionsFor = (f) => [
    {label:'View form', onClick:()=>setOpenId(f.id)},
    {label:'Edit form', onClick:()=>setEditor({id:f.id})},
    {label: formPublished(f) ? 'Unpublish form' : 'Publish form', onClick:()=>setPublished(f, !formPublished(f))},
    ...(f.fields.length ? [{label:'Connections', onClick:()=>setConnectId(f.id)}, {label:'Test submission', onClick:()=>setSubmitting({id:f.id, via:null})}] : []),
    {label:'Delete form', danger:true, onClick:()=>setDeleting(f.id)},
  ];
  // Bulk Actions: Delete (as a form's Delete: the records they created stay).
  const formBulk = useTableBulkDelete({rows:forms, noun:'form', note:'Records they created stay.',
    remove:(ids) => { setForms(fs => fs.filter(f => !ids.includes(f.id))); if(ids.includes(openId)) setOpenId(null); }, onDone:(n) => hub.toast(`${bulkPlural(n, 'form')} deleted`)});
  const schema = {
    properties:FORM_COLUMNS, noun:'form', searchKeys:['name', 'description', 'createdBy'], canCreateProperty:false, bulkActions:formBulk.bulkActions,
    filterProps:[{key:'statusLabel', label:'Status', type:'select'}, {key:'targetLabel', label:'Creates', type:'select'}, {key:'createdBy', label:'Created By', type:'select'}, {key:'submissionCount', label:'Submissions', type:'number'}],
    selectValues:{statusLabel:Object.values(FORM_STATUS).map(x => x.label), targetLabel:['Contact', 'Deal', 'Customer'], createdBy:[...new Set(forms.map(f => f.createdBy).filter(Boolean))]},
    renderCell:(key, r) => key === 'name' ? <ContactName name={r.name} onOpen={()=>setOpenId(r.id)} style={{fontSize:'inherit', fontWeight:500}}/>
      : key === 'statusLabel' ? <StatusPill status={formStatus(byId(r.id))} map={FORM_STATUS}/>
      : key === 'submissionCount' ? <FormSubmissionsValue form={byId(r.id)} inTable/>
      // One link opens in a new tab; several: "N links ▾" (each labelled by its source).
      : key === 'link' ? (() => { const ls = formLinks(byId(r.id));
          return <AssociatedRecordsValue records={ls.map(l => ({id:l.id, url:l.url, name: ls.length > 1 ? `${l.source} · ${l.url}` : l.url}))} noun="link" inTable truncate width={360} onOpen={(l)=>openFormUrl(l.url)}/>; })()
      : key === 'fieldCount' ? <span style={{fontVariantNumeric:'tabular-nums'}}>{r[key]}</span> : undefined,
    renderActions:(r) => <RowActionsMenu title="Form actions" width={MENU_W} items={actionsFor(byId(r.id))}/>,
  };
  // Save and Connect: a new form is created (its creator and when), an existing one updated; then its connections.
  const saveForm = (v) => {
    let id = editor && editor.id;
    if(id) update(id, v);
    else { id = `form-${Date.now().toString(36)}`; setForms(fs => [...fs, {id, ...v, connections:{}, published:false, submissions:[], createdBy:CURRENT_USER.name, createdAt:new Date()}]); }
    setEditor(null); setOpenId(id); setConnectId(id); setJustSaved(true);
  };
  const engineCtx = useWorkflowEngineCtx();
  // A submission (test or simulated lead): the shared submission path (submitFormValues).
  const submit = (form, via, values) => {
    const {vals} = submitFormValues(hub, engineCtx, form, via, values);
    setSubmitting(null);
    hub.toast(`${formNoun(form.target)} created · ${vals.name || 'from form'}`);
  };
  return (
    <div style={{flex:1, minWidth:0, minHeight:0, display:'flex', flexDirection:'column', position:'relative', overflow:'hidden'}}>
      <RecordViewsModule inset="page" schema={schema} rows={rows} columns={FORM_COLUMNS.map(c => c.key)} storeKey="views:marketing-forms"
        defaultViews={[{id:'fv-all', name:'All Forms', sort:{key:'name', dir:'asc'}}]}
        actions={() => <button onClick={()=>setEditor({})} title="New form" style={toolbarIconButton}><Icon name="plus" size={14} color={T.gray800}/></button>}
        overlay={open && <FormDetailPanel key={open.id} form={open} menuItems={actionsFor(open).filter(it => it.label !== 'View form')} onClose={()=>setOpenId(null)}
            onEdit={()=>setEditor({id:open.id})} onConnections={()=>setConnectId(open.id)} onPreview={()=>setPreviewId(open.id)} onPublish={(on)=>setPublished(open, on)}/>}/>
      {previewId && byId(previewId) && <FormPreviewModal form={byId(previewId)} onClose={()=>setPreviewId(null)}/>}
      {editor && <FormEditorPanel key={editor.id || 'new'} form={editor.id ? byId(editor.id) : null} onCancel={()=>setEditor(null)} onSave={saveForm}/>}
      {connecting && <FormConnectionsModal form={connecting} saved={justSaved} onClose={()=>{ setConnectId(null); setJustSaved(false); }}
        onToggle={(cid, on, link)=>{ const c = {...(connecting.connections || {})}; if(on) c[cid] = {at:new Date(), link:link || ''}; else delete c[cid]; update(connecting.id, {connections:c});
          hub.toast(`${(FORM_CONNECTIONS.find(x => x.id === cid) || {}).name} ${on ? 'connected' : 'disconnected'}`); }}
        onSetLink={(cid, link)=>{ const c = {...(connecting.connections || {})}; c[cid] = {...c[cid], link}; update(connecting.id, {connections:c}); hub.toast('Link saved'); }}
        onSimulate={(cid)=>{ setConnectId(null); setJustSaved(false); setSubmitting({id:connecting.id, via:cid}); }}/>}
      {submitting && byId(submitting.id) && <FormSubmissionModal form={byId(submitting.id)} via={submitting.via} onClose={()=>setSubmitting(null)}
        onSubmit={(values)=>submit(byId(submitting.id), submitting.via, values)}/>}
      {formBulk.bulkModal}
      {deletingForm && <StModal title="Delete form" primary="Delete form" danger onCancel={()=>setDeleting(null)}
        onSubmit={()=>{ setForms(fs => fs.filter(f => f.id !== deletingForm.id)); if(openId === deletingForm.id) setOpenId(null); setDeleting(null); hub.toast('Form deleted'); }}>
        <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>{deletingForm.name} will be deleted and disconnected from its sources. Records it created stay.</div>
      </StModal>}
    </div>
  );
}

/* ── The public form (no sign-in) ── #f~<workspace>~<form>: the form alone, for anyone with its
   link. A prototype has no real backend, so a response is left in that workspace's form inbox where
   the prototype saves its data (store.jsx DB: SQLite on localhost, else localStorage); the
   workspace's app takes it in — while it's open (the storage event, or a check every few seconds
   with SQLite), else when it next opens — through the same submission path (submitFormValues). */
const FORM_INBOX_KEY = (wsId) => `hof-erp-form-inbox:${wsId}`;
const formPublicRoute = (hash) => { const m = /^#f~([A-Za-z0-9._-]+)~([A-Za-z0-9._-]+)$/.exec(hash || ''); return m ? {wsId:m[1], formId:m[2]} : null; };
const workspaceStoreKey = (wsId) => wsId === HOF_MIGRATION_WS ? 'hof-erp-store-v2' : `hof-erp-store-v2:${wsId}`;
const readFormInbox = (wsId) => { try { return JSON.parse(DB.fresh(FORM_INBOX_KEY(wsId)) || '[]', (k, v) => typeof v === 'string' && ISO_DATE_RE.test(v) ? new Date(v) : v) || []; } catch(e){ return []; } };
const writeFormInbox = (wsId, list) => { try { DB.setItem(FORM_INBOX_KEY(wsId), JSON.stringify(list)); DB.flush(); return true; } catch(e){ return false; } };
// The workspace's forms as last saved (the sample workspace before it saved any: its sample forms).
function publicWorkspaceForms(wsId){
  const ws = WORKSPACE_REGISTRY.workspaces.find(w => w.id === wsId);
  if(!ws) return null;
  try { const raw = DB.getItem(workspaceStoreKey(wsId)), saved = raw ? JSON.parse(raw) : null;
    if(saved && Array.isArray(saved.forms)) return {ws, forms:saved.forms}; } catch(e){}
  return {ws, forms: ws.sample ? SAMPLE_FORMS() : []};
}
function PublicFormPage({route}){
  const found = publicWorkspaceForms(route.wsId), form = found && found.forms.find(f => f.id === route.formId);
  const [values, setValues] = React.useState({});
  const [tried, setTried] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const open = !!form && formPublished(form);
  const missing = open && form.fields.some(f => propertyValueError(formFieldProperty(f), values[f.id], f.required));
  const submit = () => {
    setTried(true);
    if(missing) return;
    const ok = writeFormInbox(route.wsId, [...readFormInbox(route.wsId), {id:`in-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, formId:form.id, values, at:new Date()}]);
    if(ok) setDone(true); else setFailed(true);
  };
  const message = (title, text) => (
    <div style={{display:'flex', flexDirection:'column', gap:6, textAlign:'center', padding:'24px 8px'}}>
      <div style={{fontSize:16, fontWeight:600, color:T.attioText}}>{title}</div>
      <div style={{fontSize:13, color:T.attioMuted, lineHeight:1.5}}>{text}</div>
    </div>
  );
  return (
    <div style={{minHeight:'100%', background:T.headerBg, padding:'40px 16px', boxSizing:'border-box', overflowY:'auto'}}>
      <div style={{maxWidth:560, margin:'0 auto', display:'flex', flexDirection:'column', gap:12}}>
        {found && <div style={{fontSize:12.5, fontWeight:600, color:T.attioMuted, letterSpacing:.2}}>{found.ws.name}</div>}
        <div style={{background:'#fff', border:`1px solid ${T.border}`, borderRadius:12, padding:'24px 24px 20px', display:'flex', flexDirection:'column', gap:20}}>
          {!form ? message('This form isn’t available', 'The link may be wrong, or the form was deleted.')
            : !open ? message(form.name, 'This form isn’t accepting responses right now.')
            : done ? message('Thank you', 'Your response has been submitted.')
            : <>
                <FormPreview form={form} values={values} tried={tried} onChange={(id, v)=>setValues(x => ({...x, [id]:v}))}/>
                {failed && <div style={{fontSize:12.5, color:T.red}}>Your response couldn’t be saved. Please try again.</div>}
                <div style={{display:'flex', justifyContent:'flex-end'}}><StCta label="Submit" onClick={submit}/></div>
              </>}
        </div>
      </div>
    </div>
  );
}
/* The app's side of the inbox: responses left from the public link are taken in (once each) —
   mounted with the record hub, for the open workspace. */
function PublicFormInbox(){
  const hub = useRecordHub(), engineCtx = useWorkflowEngineCtx();
  const live = React.useRef({hub, engineCtx}); live.current = {hub, engineCtx};
  React.useEffect(() => {
    const wsId = ACTIVE_WORKSPACE.id;
    const take = () => {
      const pending = readFormInbox(wsId);
      if(!pending.length) return;
      writeFormInbox(wsId, []);   // taken: each response once
      const {hub, engineCtx} = live.current;
      pending.forEach(r => { const form = (hub.forms || []).find(f => f.id === r.formId);
        if(!form) return;
        const {vals} = submitFormValues(hub, engineCtx, form, 'link', r.values || {});
        if(hub.toast) hub.toast(`New response · ${form.name} · ${formNoun(form.target)} created${vals.name ? ` · ${vals.name}` : ''}`); });
    };
    take();
    const onStorage = (e) => { if(e.key === FORM_INBOX_KEY(wsId)) take(); };
    window.addEventListener('storage', onStorage);
    // Saved in SQLite (store.jsx DB) there's no storage event between tabs: the inbox is checked every few seconds.
    const poll = DB.sqlite ? setInterval(take, 4000) : null;
    return () => { window.removeEventListener('storage', onStorage); if(poll) clearInterval(poll); };
  }, []);
  return null;
}

Object.assign(window, {formSubmissionIndex, formRecordValues, FORM_SUBMISSION_SOURCES, formSubmissionSource, formFieldProperty, PublicFormPage, PublicFormInbox, formPublicRoute, FormsPage, SAMPLE_FORMS, FORM_CONNECTIONS, FormFieldsList, FormPreview, FieldLabelInput});
