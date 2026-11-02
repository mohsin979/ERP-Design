/* HOF Pulse ERP — Contact activity tabs (Activity, Calls, Email, Tasks, Notes).

   Two panes, the same in every tab: on the left a plain full-height navigation column (one
   vertical divider, no cards), each row the Overview → Snapshots row (ActivityRow, compact),
   which identifies the activity; click one and the right
   pane shows its content only — nothing from the row is repeated there. The add
   action sits at the right of the tab toolbar and opens its form in the right pane.

   Every detail has the same minimal header (DetailFrame): the activity's first line on the left
   ("Meeting by [Person]", …), Edit and ⋯ on the right; Edit → Cancel / Save in the same place.
     Call   — "Call by [Person]" (made through the system: only comments editable) or "Call log
              by [Person]" (entered by hand: call type, point of contact, outcome and comments
              editable). Details: call type (Inbound / Outbound), point of contact (the internal
              representative), outcome, comment. A new comment is saved as a Note linked to the
              call (callId).
     Email  — subject and content; the header has Reply, ⋯ has Forward (UI only; not defined yet).
     Task   — name, description, status (radios), task type, assigned to, assigned by.
     Note   — readable text; Edit makes it a field.
     Owner change — previous and new owner; Edit reassigns the owner (through the normal owner
              update, so it records its own Owner change).

     Meeting — "Meeting" (start / schedule — not defined yet) or "Meeting log" (an online
              meeting logged by hand: organiser, platform, title, comments). Read-only: title,
              platform, transcript (Read / Add transcript), comment, time stamp (the organiser is in the header).
   Every ⋯ menu follows one arrangement (detailMenu). Edits and new items go through onUpdate / onAdd
   (ContactsModule) — the one activity store the Overview, cards and side panel also read. */

const actFieldLabel = {width:120, flexShrink:0, fontSize:12.5, color:T.attioMuted, paddingTop:7};
const fieldControl = {
  appearance:'none', WebkitAppearance:'none', width:'100%', fontSize:13, fontFamily:'inherit', color:T.attioText,
  border:`1px solid ${T.borderStrong}`, borderRadius:8, padding:'7px 28px 7px 10px', background:'#fff', cursor:'pointer',
};
const fieldText = {...fieldControl, padding:'7px 10px', cursor:'text'};
const btnPrimarySm = (on = true) => ({border:'none', background: on ? T.black : T.gray400, color:'#fff', borderRadius:8,
  padding:'7px 14px', fontSize:12.5, fontWeight:600, cursor: on ? 'pointer' : 'default', fontFamily:'inherit'});
const btnSecondarySm = {border:`1px solid ${T.borderStrong}`, background:'#fff', color:T.attioText, borderRadius:8,
  padding:'7px 12px', fontSize:12.5, cursor:'pointer', fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:6};

/* `wide`: the control takes the full width (no 420px cap), e.g. the form editor's details. */
function Field({label, children, wide}){
  return (
    <div style={{display:'flex', alignItems:'flex-start', gap:12, minHeight:34}}>
      <span style={actFieldLabel}>{label}</span>
      <div style={{flex:1, minWidth:0, maxWidth: wide ? 'none' : 420}}>{children}</div>
    </div>
  );
}
function ReadValue({children}){
  return <div style={{fontSize:13, color:T.attioText, paddingTop:7, lineHeight:1.5, whiteSpace:'pre-line'}}>{children || '—'}</div>;
}
function Select({value, options, onChange, placeholder}){
  return (
    <div style={{position:'relative'}}>
      <select value={value || ''} onChange={e=>onChange(e.target.value || null)} style={{...fieldControl, color: value ? T.attioText : T.gray400}}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => typeof o === 'string'
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <div style={{position:'absolute', right:9, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', display:'flex'}}>
        <Icon name="chevDown" size={12} color={T.gray600}/>
      </div>
    </div>
  );
}
/* A person as the activity rows show them: avatar, name, "(Owner)". */
function PersonValue({person}){
  if(!person) return <ReadValue/>;
  return (
    <div style={{display:'flex', alignItems:'center', gap:4, paddingTop:6, fontSize:13, color:T.attioText}}>
      <PersonAvatar kind={person.kind} name={person.name}/>
      <span>{person.name}</span>
      {person.owner && <span style={{color:T.attioMuted}}>(Owner)</span>}
    </div>
  );
}

/* A call's point of contact: the internal company representative on it. Inbound calls without
   one recorded were taken by the record's owner; otherwise it's the team member who made the call. */
const CALL_TYPES = ['Inbound', 'Outbound'];
const callTypeOf = (a) => isInboundCall(a) ? 'Inbound' : 'Outbound';
const ownerName = (contact) => contact ? (userLabel(contact.owner) || contact.owner || '') : '';
function callPointOfContact(a, contact){
  const owner = ownerName(contact);
  if(a.pointOfContact) return {name:a.pointOfContact, kind:'team', owner: a.pointOfContact === owner};
  if(isInboundCall(a)) return owner ? {name:owner, kind:'team', owner:true} : null;
  return activityActor(a, contact);
}
// As a select value: a team member's name.
const callPocValue = (a, contact) => { const p = callPointOfContact(a, contact); return !p ? '' : p.kind === 'you' ? CURRENT_USER.name : p.name; };
// Inbound: the customer made the call; outbound: the point of contact did.
const callPatch = (type, poc) => type === 'Inbound' ? {direction:'inbound', source:'client', by:null, pointOfContact:poc} : {direction:'outbound', source:'team', by:poc, pointOfContact:poc};
const pocOptions = (team, contact) => team.map(n => ({value:n, label: n === ownerName(contact) ? `${n} (Owner)` : n}));
/* The record owner as the default person on a new call, task or meeting (Point of contact,
   Assigned to, Organiser) — until another is picked; it follows the record while none is picked
   (a Tools page chooses the record in the form). `initial`: a value given to the form instead. */
function useOwnerDefault(contact, team, initial){
  const owner = ownerName(contact), def = initial || (owner && team.includes(owner) ? owner : null);
  const [v, setV] = React.useState(def), touched = React.useRef(false);
  React.useEffect(() => { if(!touched.current) setV(def); }, [def]);
  return [v, (x) => { touched.current = true; setV(x); }];
}
// Who it is on these forms: the searchable user list (Edit Owner's), the record owner marked.
function PersonPicker({value, team, contact, placeholder = 'Select person', onChange}){
  return <SearchableSelect value={value || ''} options={pocOptions(team, contact)} placeholder={placeholder} searchPlaceholder="Search users" onChange={onChange}/>;
}
/* Attendees: company users (first) and outside people by email address, in one dropdown — type to
   find a user, or a full email address to add someone from outside. Several; outside people are
   marked External and keep their address. Kept on the meeting as {kind:'user', name} /
   {kind:'external', email} — an outside person is never made a user. */
const ATTENDEE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function AttendeesField({value = [], team, contact, onChange}){
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const text = q.trim(), lower = text.toLowerCase();
  const users = team.filter(n => !value.some(x => x.kind === 'user' && x.name === n) && n.toLowerCase().includes(lower));
  const email = ATTENDEE_EMAIL_RE.test(text) && !value.some(x => x.kind === 'external' && x.email.toLowerCase() === lower) ? text : null;
  const add = (a) => { onChange([...value, a]); setQ(''); };
  const remove = (i) => onChange(value.filter((_, j) => j !== i));
  return (
    <div style={{display:'flex', flexDirection:'column', gap:8}}>
      {value.length > 0 && <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
        {value.map((x, i) => (
          <span key={`${x.kind}:${x.name || x.email}`} style={{display:'inline-flex', alignItems:'center', gap:6, padding:'3px 6px 3px 8px', borderRadius:9999, border:`1px solid ${T.border}`, fontSize:12.5, color:T.attioText, maxWidth:'100%'}}>
            <span style={{minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={x.email || x.name}>{x.kind === 'user' ? x.name : x.email}</span>
            {x.kind === 'user' && contact && x.name === ownerName(contact) && <span style={{fontSize:11, color:T.attioMuted}}>Owner</span>}
            {x.kind === 'external' && <span style={{fontSize:11, color:'#B54708', background:'#FFFAEB', borderRadius:9999, padding:'0 6px'}}>External</span>}
            <button onClick={()=>remove(i)} title="Remove" aria-label={`Remove ${x.name || x.email}`} style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:2}}>
              <Icon name="close" size={10} color={T.gray600}/>
            </button>
          </span>
        ))}
      </div>}
      <div style={{position:'relative'}}>
        <input value={q} onChange={e=>{ setQ(e.target.value); setOpen(true); }} onFocus={()=>setOpen(true)} placeholder="Add a user or an email address" aria-label="Add attendee"
          onKeyDown={e=>{ if(e.key === 'Enter'){ e.preventDefault(); if(email) add({kind:'external', email}); else if(users.length && text) add({kind:'user', name:users[0]}); } if(e.key === 'Escape') setOpen(false); }}
          style={fieldText}/>
        <MenuShell open={open} onClose={()=>setOpen(false)} width="100%">
          <div style={{maxHeight:240, overflowY:'auto'}}>
            {users.length > 0 && <div style={{padding:'4px 10px 2px', fontSize:11.5, color:T.gray400}}>Users</div>}
            {users.map(n => <MenuItem key={n} label={contact && n === ownerName(contact) ? `${n} (Owner)` : n} onClick={()=>add({kind:'user', name:n})}/>)}
            {email && <>
              <div style={{padding:'6px 10px 2px', fontSize:11.5, color:T.gray400}}>External</div>
              <MenuItem label={`Add ${email}`} onClick={()=>add({kind:'external', email})}/>
            </>}
            {!users.length && !email && <div style={{padding:'8px 10px', fontSize:12.5, color:T.gray400, lineHeight:1.5}}>{text ? 'No user matches. Type a full email address to add someone from outside.' : 'Every user is added.'}</div>}
          </div>
        </MenuShell>
      </div>
    </div>
  );
}
// Attendees as read (meeting detail): users by name, outside people by address, marked External.
const attendeesText = (list) => (list || []).map(x => x.kind === 'external' ? `${x.email} (External)` : x.name).join(', ');
const newId = (type) => `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

/* ── Detail frame: header + content ─────────────────────────────────────────────────────────
   Every activity detail (and every new-item form) is the same frame: a minimal header with a
   bottom border — on the left the activity's first line, the same copy as its row in All
   Activity ("Meeting by [Person]", "Email received from [Person]", …), or the form's title; on
   the right Edit (where applicable) and ⋯ — and the content scrolling below. Activities open
   read-only; Edit switches the header to Cancel / Save; Save returns to read-only. Read-only
   and Edit are separate states: Edit shows only the editable fields. Emails stay read-only
   with Reply in Edit's place. */

function DetailFrame({head, children, actions}){
  return (
    <div style={{flex:1, minHeight:0, display:'flex', flexDirection:'column'}}>
      <div style={{flexShrink:0, display:'flex', alignItems:'center', gap:12, minHeight:50, boxSizing:'border-box',
                   padding:'9px 24px', borderBottom:`1px solid ${T.border}`, background:'#fff'}}>
        <div style={{flex:1, minWidth:0, display:'flex'}}>{head}</div>
        <div style={{flexShrink:0, display:'flex', alignItems:'center', gap:8}}>{actions}</div>
      </div>
      <div style={{flex:1, minHeight:0, overflowY:'auto', padding:'20px 24px'}}>{children}</div>
    </div>
  );
}
/* The header's left side for an activity: its first line in the All Activity wording. */
const activityHead = (a, contact) => <ActivityLead a={a} lead={activityLines(a, contact, 'all').lead} style={{fontSize:13, color:T.attioMuted}}/>;
/* Tools → Calls, Emails, Meetings, Notes show activities across records, from the current user's
   side: the record leads, not the employee. `acrossLead`: the words before the record's name. */
// Calls: an inbound call came from the record ("Call by [Record]"); an outbound one went to it.
const acrossLead = (a) => a.type === 'call' ? (isInboundCall(a) ? (a.logged ? 'Call log by' : 'Call by') : (a.logged ? 'Call log to' : 'Call to'))
  : a.type === 'email' ? (a.status === 'scheduled' ? 'Scheduled to' : a.direction === 'received' ? 'Received from' : 'Sent to')
  : a.type === 'meeting' ? 'Meeting with' : a.type === 'note' ? 'Note added to' : '';
const acrossHead = (a, across) => (
  <div style={{display:'flex', alignItems:'center', gap:6, minWidth:0, fontSize:13, color:T.attioMuted, height:18}}>
    <span style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', minWidth:0}}>{acrossLead(a)} {across.record ? across.record.name : ''}</span>
    {a.type === 'call' && <CallDirection incoming={isInboundCall(a)}/>}
  </div>
);
/* `across.perspective` 'person' (Tools pages showing a team's / anyone's activities): the record
   pages' person-led header ("Call by [Person]"), with the record's name and type in the details. */
const personLed = (across) => !!(across && across.perspective === 'person');
const detailHead = (a, contact, across) => across && !personLed(across) ? acrossHead(a, across) : activityHead(a, contact);
/* `across.hideType` (a record's Contact / Deal / Customer feed, whose tab already gives the type):
   the record is the first detail, as "Record" (recordFirst), and isn't repeated below. */
const recordFields = (across) => across && across.record && !across.hideType && <>
  <Field label="Record name"><div style={{paddingTop:7, fontSize:13, display:'flex'}}><HubRecordLink object={across.object} id={across.record.id} name={across.record.name}/></div></Field>
  <Field label="Record type"><ReadValue>{HUB_NOUN[across.object]}</ReadValue></Field>
</>;
const recordFirst = (across) => across && across.hideType && across.record &&
  <Field label="Record"><div style={{paddingTop:7, fontSize:13, display:'flex'}}><HubRecordLink object={across.object} id={across.record.id} name={across.record.name}/></div></Field>;
// The Time Stamp row (as on Meetings), for the across-record details.
const timeStampField = (at) => <Field label="Time Stamp"><ReadValue>{fmtActStamp(new Date(at))}</ReadValue></Field>;
/* The header's ⋯ menu (activity actions), after Edit. Only Pin / Unpin does anything yet — it
   marks the activity pinned; the rest open the "not defined yet" placeholder until their
   behaviour is defined. */
function DetailMoreMenu({items}){
  const [open, setOpen] = React.useState(false);
  const del = useActivityDelete();
  const [confirm, setConfirm] = React.useState(null);   // the Delete item being confirmed
  const run = (it) => { if(it.deleteAct && del) return setConfirm(it); it.onClick(); };
  return (<>
    {confirm && <StModal title={confirm.label} primary={confirm.label} danger onCancel={()=>setConfirm(null)}
      onSubmit={()=>{ const it = confirm; setConfirm(null); del(it.deleteAct); }}>
      <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>This removes it from the record. It can't be undone.</div>
    </StModal>}
    <div style={{position:'relative'}}>
      <button title="More actions" onClick={()=>setOpen(o=>!o)} style={{...btnSecondarySm, padding:'7px 9px', background: open ? T.headerBg : '#fff'}}>
        <Icon name="moreDots" size={14} color={T.attioText}/>
      </button>
      <MenuShell open={open} onClose={()=>setOpen(false)} anchorRight width={210}>
        {items.map(it => <MenuItem key={it.label} label={it.label} danger={it.danger}
          icon={it.icon && <Icon name={it.icon} size={13} color={it.danger ? T.red : T.gray600}/>}
          onClick={()=>{ setOpen(false); run(it); }}/>)}
      </MenuShell>
    </div>
  </>);
}
const pinItem = (a, onUpdate) => a.pinned
  ? {label:'Unpin', icon:'unfreeze', onClick:()=>onUpdate(a.id, {pinned:false})}
  : {label:'Pin',   icon:'freeze',   onClick:()=>onUpdate(a.id, {pinned:true})};
const stubItem = (label, onStub, icon, danger) => ({label, icon, danger, onClick:()=>onStub(label)});
/* One arrangement for every activity's ⋯ menu, all with icons: the type's own actions, then
   Run Customer Profile (where offered), Pin / Unpin, and Delete last. Only Pin works yet. */
const detailMenu = ({a, onUpdate, onStub, own = [], runProfile = false, deleteLabel = null}) => [
  ...own,
  ...(runProfile ? [stubItem('Run Customer Profile', onStub, 'profile')] : []),
  pinItem(a, onUpdate),
  // Delete asks first, then removes the activity from its record (ActivityDeleteCtx).
  ...(deleteLabel ? [{...stubItem(deleteLabel, onStub, 'trash', true), deleteAct:a}] : []),
];
const headerBtn = (label, onClick) => <button onClick={onClick} style={btnSecondarySm}>{label}</button>;
const editBar = (onEdit, menu) => (<>
  {headerBtn('Edit', onEdit)}
  {menu && menu.length > 0 && <DetailMoreMenu items={menu}/>}
</>);
/* A tool activity's Edit and ⋯ menu, by the acting user's permission on the record it's on
   (Settings → Edit Permissions → the Object's Tools): no Edit without Edit permission, no Delete
   without Delete permission. Outside a record page (no access context) both stay. */
function ActivityEditBar({a, onEdit, menu}){
  const ra = useRecordAccess();
  const canEdit = !ra || activityCan(ra.object, ra.record, a, 'edit'), canDelete = !ra || activityCan(ra.object, ra.record, a, 'delete');
  const items = (menu || []).filter(it => canDelete || !/^Delete/.test(it.label));
  return (<>
    {canEdit && headerBtn('Edit', onEdit)}
    {items.length > 0 && <DetailMoreMenu items={items}/>}
  </>);
}
const activityEditBar = (a, onEdit, menu) => <ActivityEditBar a={a} onEdit={onEdit} menu={menu}/>;
const saveBar = (onCancel, onSave, canSave = true) => (<>
  <button onClick={onCancel} style={btnSecondarySm}>Cancel</button>
  <button onClick={onSave} disabled={!canSave} style={btnPrimarySm(canSave)}>Save</button>
</>);
const stack = (children) => <div style={{display:'flex', flexDirection:'column', gap:10}}>{children}</div>;
const taskStatusLabel = (k, pipelineId) => taskStageLabel({status:k, pipelineId});

/* A task's status as radios — In Progress or Completed (Overdue is worked out from the due date:
   `overdue` notes it). Type and assignee are dropdowns. */
function TaskStatusRadios({value, onChange, name, pipelineId, overdue}){
  const pl = TASK_PIPELINES.find(p => p.id === (pipelineId || DEFAULT_TASK_PIPELINE_ID)) || TASK_PIPELINES[0];
  return (
    <div style={{display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 160px))', gap:'10px 16px', paddingTop:7}}>
      {overdue && <div style={{gridColumn:'1 / -1', fontSize:12, color:T.red}}>Overdue — past its due date. Change the due date, or mark it Completed.</div>}
      {(pl ? pl.stages : []).map(s => (
        <label key={s.id} style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:T.attioText, cursor:'pointer', lineHeight:'16px'}}>
          <input type="radio" name={name} checked={value === s.id} onChange={()=>onChange(s.id)}
            style={{margin:0, width:15, height:15, flexShrink:0, accentColor:T.black, cursor:'pointer'}}/>
          {s.label}
        </label>
      ))}
    </div>
  );
}
// The task pipeline dropdown; picking another pipeline puts the task at its first stage.
const taskPipelineOptions = () => TASK_PIPELINES.map(p => ({value:p.id, label:p.name}));
const firstStageOf = (pipelineId) => { const pl = TASK_PIPELINES.find(p => p.id === pipelineId) || TASK_PIPELINES[0]; return pl && pl.stages[0] ? pl.stages[0].id : ''; };

/* ── Details (right pane) ────────────────────────────────────────────────────────────────── */

function NoteDetail({a, contact, calls, onUpdate, onStub, across}){
  const [editing, setEditing] = React.useState(false);
  // Edited in the rich text editor (a plain note saved before opens as paragraphs).
  const [text, setText] = React.useState(richHtmlOf(a.body || ''));
  const call = a.callId && calls.find(c => c.id === a.callId);
  const meeting = a.meetingId && calls.find(c => c.id === a.meetingId);
  const cancel = () => { setText(richHtmlOf(a.body || '')); setEditing(false); };
  const save = () => { onUpdate(a.id, {body:sanitizeRichText(text)}); setEditing(false); };
  return (
    <DetailFrame head={detailHead(a, contact, across)} actions={editing ? saveBar(cancel, save, !richIsEmpty(text) && sanitizeRichText(text) !== sanitizeRichText(richHtmlOf(a.body || '')))
      : activityEditBar(a, ()=>setEditing(true), detailMenu({a, onUpdate, onStub, own:[stubItem('Copy Note', onStub, 'copy')], runProfile:true, deleteLabel:'Delete Note'}))}>
      <div style={{display:'flex', flexDirection:'column', gap:12}}>
        {!editing && recordFirst(across)}
        {/* A note saved from a call keeps that context. */}
        {!editing && a.callId && <div style={{fontSize:12, color:T.attioMuted}}>Linked to call{call ? ` · ${fmtActStamp(call.at)}` : ''}</div>}
        {!editing && a.meetingId && <div style={{fontSize:12, color:T.attioMuted}}>Linked to meeting{meeting ? ` · ${fmtActStamp(meeting.at)}` : ''}</div>}
        {editing
          ? <RichTextEditor value={text} onChange={setText} minHeight={180} ariaLabel="Note"/>
          : <RichTextView html={a.body} style={{fontSize:13.5, lineHeight:1.65}}/>}
        {!editing && personLed(across) && stack(recordFields(across))}
        {!editing && across && timeStampField(a.at)}
      </div>
    </DetailFrame>
  );
}

/* A call: "Call" (made through the system — its person and outcome are the real record and
   stay fixed; comments can still be added and edited) or "Call log" (entered by hand — person,
   outcome and comments all editable). Comments are Notes linked to the call. */
/* `across`: {object, record} when calls from different records are shown together (Tools →
   Calls) — the record leads: "Call to [Record]", and the details add its name and type. */
function CallDetail({a, contact, team, comments, onUpdate, onAdd, onStub, across}){
  const blank = () => ({type:callTypeOf(a), poc:callPocValue(a, contact), outcome:a.outcome, own:a.body || '', edits:{}, added:''});
  const [editing, setEditing] = React.useState(false);
  const [d, setD] = React.useState(blank);
  const set = (p) => setD(x => ({...x, ...p}));
  const ownNotes = !a.transcript;   // an in-app call keeps only a system label in `body`
  const cancel = () => { setD(blank()); setEditing(false); };
  const placed = (x) => x.type !== callTypeOf(a) || x.poc !== callPocValue(a, contact);
  const save = () => {
    const patch = {};
    if(a.logged){
      if(d.poc && placed(d)) Object.assign(patch, callPatch(d.type, d.poc));
      if(d.outcome !== a.outcome) patch.outcome = d.outcome;
    }
    if(ownNotes && d.own.trim() !== (a.body || '').trim()) patch.body = d.own.trim();
    if(Object.keys(patch).length) onUpdate(a.id, patch);
    Object.entries(d.edits).forEach(([id, body]) => {
      const n = comments.find(c => c.id === id);
      if(n && body.trim() && body.trim() !== n.body) onUpdate(id, {body:body.trim()});
    });
    if(d.added.trim()) onAdd({id:newId('note'), type:'note', source:'you', by:null, body:d.added.trim(), callId:a.id});
    setEditing(false);
  };
  // Save only once something has actually changed — the same rule for every detail.
  const dirty = (a.logged && ((d.poc && placed(d)) || d.outcome !== a.outcome))
    || (ownNotes && d.own.trim() !== (a.body || '').trim())
    || Object.entries(d.edits).some(([id, body]) => { const n = comments.find(c => c.id === id); return n && body.trim() && body.trim() !== n.body; })
    || !!d.added.trim();
  const area = (value, onChange, placeholder, rows = 2) =>
    <textarea value={value} onChange={e=>onChange(e.target.value)} rows={rows} placeholder={placeholder} style={{...fieldText, resize:'vertical', lineHeight:1.5}}/>;
  const record = across && across.record;
  const head = detailHead(a, contact, across);
  return (
    <DetailFrame head={head} actions={editing ? saveBar(cancel, save, dirty)
      : activityEditBar(a, ()=>{ setD(blank()); setEditing(true); }, detailMenu({a, onUpdate, onStub, deleteLabel: a.logged ? 'Delete Call Log' : 'Delete Call'}))}>
      {stack(<>
        {!editing && recordFirst(across)}
        {/* Edit mode shows only what can be edited: call type, point of contact and outcome on
            a call log, and the comments on any call. */}
        {editing ? (a.logged && <Field label="Call type"><Select value={d.type} options={CALL_TYPES} onChange={v=>v && set({type:v})}/></Field>)
                 : <Field label="Call type"><ReadValue>{callTypeOf(a)}</ReadValue></Field>}
        {/* Tools → Calls is the current user's view: no point of contact there. */}
        {(!across || personLed(across)) && (editing ? (a.logged && <Field label="Point of contact"><Select value={d.poc} options={pocOptions(team, contact)} placeholder="Select person" onChange={v=>v && set({poc:v})}/></Field>)
                 : <Field label="Point of contact"><PersonValue person={callPointOfContact(a, contact)}/></Field>)}
        {!editing && across && !across.hideType && <>
          <Field label="Record name"><div style={{paddingTop:7, fontSize:13, display:'flex'}}>{record ? <HubRecordLink object={across.object} id={record.id} name={record.name}/> : '—'}</div></Field>
          {!across.hideType && <Field label="Record type"><ReadValue>{HUB_NOUN[across.object]}</ReadValue></Field>}
        </>}
        {editing ? (a.logged && <Field label="Call outcome"><Select value={d.outcome} options={LOG_CALL_OUTCOMES} placeholder="Select outcome" onChange={v=>set({outcome:v})}/></Field>)
                 : <Field label="Call outcome"><ReadValue>{a.outcome}</ReadValue></Field>}
        <Field label="Comment">
          <div style={{display:'flex', flexDirection:'column', gap:10, paddingTop: editing ? 0 : 7}}>
            {ownNotes && (editing ? (a.body ? area(d.own, v=>set({own:v})) : null)
                                  : a.body && <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>{a.body}</div>)}
            {comments.map(n => editing
              ? <div key={n.id}>{area(d.edits[n.id] ?? n.body, v=>set({edits:{...d.edits, [n.id]:v}}))}</div>
              : <div key={n.id} style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>
                  {n.body}
                  <div style={{fontSize:11.5, color:T.attioMuted, marginTop:2}}>Saved as a note · {fmtActStamp(n.at)}</div>
                </div>)}
            {editing && area(d.added, v=>set({added:v}), 'Add a comment — saved as a note linked to this call')}
            {!editing && !(ownNotes && a.body) && !comments.length && <div style={{fontSize:13, color:T.attioMuted}}>No comments yet.</div>}
          </div>
        </Field>
        {!editing && across && timeStampField(a.at)}
      </>)}
    </DetailFrame>
  );
}

/* An email, in its thread (emails.jsx): with others in the conversation, every message in order
   (each opens to its content); alone, its fields. HTML content shows as written. */
function EmailDetail({a, contact, acts, onStub, onUpdate, across}){
  const hub = useRecordHub(), ra = useRecordAccess();
  const thread = emailThreadOf(a, acts && acts.length ? acts : [a]);
  // The email's own record (it may be shown on an associated record's feed).
  const where = (hub && hubFindActivity(hub, a.id)) || (ra && {object:ra.object, recordId:ra.record.id});
  const host = React.useContext(ComposeHostCtx);
  const compose = (kind) => !(hub && where) ? onStub(kind === 'replyTo' ? 'Reply' : 'Forward')
    : host ? host.compose({object:where.object, id:where.recordId, [kind]:a}) : hub.composeEmail({object:where.object, id:where.recordId, [kind]:a});
  return (
    // Emails stay read-only; Reply and Forward open the composer.
    <DetailFrame head={detailHead(a, contact, across)} actions={<>
      {headerBtn('Reply', ()=>compose('replyTo'))}
      <DetailMoreMenu items={detailMenu({a, onUpdate, onStub, own:[{label:'Forward', icon:'forward', onClick:()=>compose('forward')}], runProfile:true, deleteLabel:'Delete Email'})}/>
    </>}>
      {stack(<>
        {recordFirst(across)}
        {a.status === 'scheduled' && <Field label="Scheduled"><ReadValue>{fmtActStamp(new Date(a.scheduledFor || a.at))}</ReadValue></Field>}
        {thread.length < 2 && a.to && a.to.length > 0 && <Field label="To"><ReadValue>{a.to.join(', ')}</ReadValue></Field>}
        <Field label="Subject"><ReadValue>{a.title}</ReadValue></Field>
        {thread.length > 1
          ? <Field label={`Thread · ${thread.length} emails`}><EmailThreadView key={a.id} thread={thread} open={a.id} contact={contact}/></Field>
          : <Field label="Content"><EmailBody a={a}/></Field>}
        {/* A scheduled email's time is already its Scheduled row. */}
        {personLed(across) && recordFields(across)}
        {across && a.status !== 'scheduled' && timeStampField(a.at)}
      </>)}
    </DetailFrame>
  );
}

function TaskDetail({a, contact, team, onUpdate, onStub, across}){
  const blank = () => ({title:a.title || '', description:a.description || '', pipelineId:taskPipelineIdOf(a), status:a.status, taskType:a.taskType, assignee:a.assignee, dueDate:taskDueParts(a).date, dueTimeOfDay:taskDueParts(a).time});
  const [editing, setEditing] = React.useState(false);
  const [d, setD] = React.useState(blank);
  const set = (p) => setD(x => ({...x, ...p}));
  const cancel = () => { setD(blank()); setEditing(false); };
  const save = () => { const {dueDate, dueTimeOfDay, ...rest} = d; onUpdate(a.id, {...rest, ...taskDueValue(dueDate, dueTimeOfDay), title:d.title.trim(), description:d.description.trim()}); setEditing(false); };
  const orig = blank();
  const dirty = Object.keys(d).some(k => (typeof d[k] === 'string' ? d[k].trim() : d[k]) !== orig[k]);
  return (
    <DetailFrame head={activityHead(a, contact)} actions={editing ? saveBar(cancel, save, !!d.title.trim() && dirty)
      : activityEditBar(a, ()=>{ setD(blank()); setEditing(true); }, detailMenu({a, onUpdate, onStub, own:[stubItem('Reassign Task', onStub, 'userSwitch'), stubItem('Copy Task Description', onStub, 'copy')], deleteLabel:'Delete Task'}))}>
      {stack(<>
        {!editing && recordFirst(across)}
        <Field label="Task name">{editing ? <input value={d.title} onChange={e=>set({title:e.target.value})} style={fieldText}/> : <ReadValue>{a.title}</ReadValue>}</Field>
        <Field label="Description">{editing
          ? <textarea value={d.description} onChange={e=>set({description:e.target.value})} rows={3} style={{...fieldText, resize:'vertical', lineHeight:1.5}}/>
          : <ReadValue>{a.description}</ReadValue>}</Field>
        <Field label="Pipeline">{editing ? <Select value={d.pipelineId} options={taskPipelineOptions()} onChange={v=>v && set({pipelineId:v, status:firstStageOf(v)})}/>
          : <ReadValue>{(taskPipelineOf(a) || {}).name}</ReadValue>}</Field>
        <Field label="Status">{editing ? <TaskStatusRadios name={`status-${a.id}`} pipelineId={d.pipelineId} value={d.status} overdue={d.status !== 'completed' && isPastDue(taskDueValue(d.dueDate, d.dueTimeOfDay))} onChange={v=>set({status:v})}/>
          : <span style={{fontSize:13, paddingTop:7, display:'block', color: taskState(a) === 'overdue' ? T.red : T.attioText}}>{taskStateLabel(a)}</span>}</Field>
        <Field label="Task type">{editing ? <Select value={d.taskType} options={TASK_TYPES} onChange={v=>v && set({taskType:v})}/> : <ReadValue>{a.taskType}</ReadValue>}</Field>
        <Field label="Assigned to">{editing ? <Select value={d.assignee} options={team} placeholder="Select person" onChange={v=>v && set({assignee:v})}/> : <ReadValue>{a.assignee}</ReadValue>}</Field>
        {editing ? <TaskDueFields date={d.dueDate} time={d.dueTimeOfDay} onChange={(date, time)=>set({dueDate:date, dueTimeOfDay:time})}/>
          : <Field label="Due">{a.due ? <ReadValue>{fmtTaskDue(a)}{isOverdue(a) ? ' · Overdue' : ''}</ReadValue> : <ReadValue>No due date</ReadValue>}</Field>}
        {!editing && <Field label="Assigned by"><PersonValue person={activityActor(a, contact)}/></Field>}
      </>)}
    </DetailFrame>
  );
}

/* A meeting's transcript is the text entered for it (`transcript`). Lines that start with a time
   ("00:02", "[1:05:10]") begin a new entry with that time, and an optional "Name:" after it; other
   lines continue the entry before them. */
const TRANSCRIPT_LINE = /^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*[-–—]?\s*(.*)$/;
function parseTranscript(text){
  const out = [];
  String(text || '').split('\n').forEach(line => {
    const l = line.trim(); if(!l) return;
    const m = l.match(TRANSCRIPT_LINE);
    if(m){ const sp = m[2].match(/^([^:]{1,40}):\s+(.*)$/); out.push({time:m[1], speaker: sp ? sp[1] : '', text: sp ? sp[2] : m[2]}); }
    else if(out.length) out[out.length - 1].text += ` ${l}`;
    else out.push({time:'', speaker:'', text:l});
  });
  return out;
}
const linkBtn = {border:'none', background:'transparent', padding:'7px 0 0', fontSize:13, fontFamily:'inherit', color:T.attioText, cursor:'pointer',
  textDecorationLine:'underline', textUnderlineOffset:2, textDecorationColor:'#D7D6DA'};
// Read transcript (with its times) or Add transcript (a text box, saved as the meeting's transcript).
function MeetingTranscript({a, onUpdate}){
  const [open, setOpen] = React.useState(null);   // 'read' | 'add'
  const [text, setText] = React.useState('');
  const has = !!String(a.transcript || '').trim();
  const close = () => { setOpen(null); setText(''); };
  const lines = open === 'read' ? parseTranscript(a.transcript) : [];
  return (<>
    <button onClick={()=>setOpen(has ? 'read' : 'add')} style={linkBtn}>{has ? 'Read transcript' : 'Add transcript'}</button>
    {open === 'read' && ReactDOM.createPortal(
      <StModal title="Transcript" width={600} onCancel={close}>
        <div style={{maxHeight:'60vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:12}}>
          {lines.map((l, i) => (
            <div key={i} style={{display:'flex', gap:12, fontSize:13, lineHeight:1.55}}>
              <span style={{width:56, flexShrink:0, color:T.attioMuted, fontVariantNumeric:'tabular-nums'}}>{l.time || '—'}</span>
              <span style={{minWidth:0, color:T.attioText}}>{l.speaker && <span style={{fontWeight:600}}>{l.speaker}: </span>}{l.text}</span>
            </div>
          ))}
        </div>
      </StModal>, document.body)}
    {open === 'add' && ReactDOM.createPortal(
      <StModal title="Add transcript" width={600} primary="Save" canSubmit={!!text.trim()} onCancel={close}
        onSubmit={()=>{ onUpdate(a.id, {transcript:text.trim()}); close(); }}>
        <textarea autoFocus value={text} onChange={e=>setText(e.target.value)} rows={12} aria-label="Transcript"
          placeholder={'00:00 Name: What was said\n00:42 Name: …'} style={{...fieldText, resize:'vertical', lineHeight:1.55}}/>
      </StModal>, document.body)}
  </>);
}

/* A meeting: "Meeting" (started / scheduled through the system — not defined yet; only comments
   editable) or "Meeting log" (an online meeting — Google Meet, Zoom, … — logged by hand:
   organiser, platform, title and comments editable). Always organised by an internal team
   member. Comments are Notes linked to the meeting (meetingId). */
function MeetingDetail({a, contact, team, comments, onUpdate, onAdd, onStub, across}){
  const blank = () => ({organiser:a.by || null, platform:a.platform || null, title:a.title || '', edits:{}, added:''});
  const [editing, setEditing] = React.useState(false);
  const [d, setD] = React.useState(blank);
  const set = (p) => setD(x => ({...x, ...p}));
  const orig = blank();
  const dirty = (a.logged && (d.organiser !== orig.organiser || d.platform !== orig.platform || d.title.trim() !== orig.title))
    || Object.entries(d.edits).some(([id, body]) => { const n = comments.find(c => c.id === id); return n && body.trim() && body.trim() !== n.body; })
    || !!d.added.trim();
  const cancel = () => { setD(blank()); setEditing(false); };
  const save = () => {
    if(a.logged){
      const patch = {};
      if(d.organiser && d.organiser !== a.by) Object.assign(patch, {source:'team', by:d.organiser});
      if(d.platform !== a.platform) patch.platform = d.platform;
      if(d.title.trim() && d.title.trim() !== a.title) patch.title = d.title.trim();
      if(Object.keys(patch).length) onUpdate(a.id, patch);
    }
    Object.entries(d.edits).forEach(([id, body]) => {
      const n = comments.find(c => c.id === id);
      if(n && body.trim() && body.trim() !== n.body) onUpdate(id, {body:body.trim()});
    });
    if(d.added.trim()) onAdd({id:newId('note'), type:'note', source:'you', by:null, body:d.added.trim(), meetingId:a.id});
    setEditing(false);
  };
  const area = (value, onChange, placeholder, rows = 2) =>
    <textarea value={value} onChange={e=>onChange(e.target.value)} rows={rows} placeholder={placeholder} style={{...fieldText, resize:'vertical', lineHeight:1.5}}/>;
  const teamOptions = team.map(n => ({value:n, label: n === contact.owner ? `${n} (Owner)` : n}));
  return (
    <DetailFrame head={detailHead(a, contact, across)} actions={editing ? saveBar(cancel, save, dirty)
      : activityEditBar(a, ()=>{ setD(blank()); setEditing(true); }, detailMenu({a, onUpdate, onStub, deleteLabel: a.logged ? 'Delete Meeting Log' : 'Delete Meeting'}))}>
      {stack(<>
        {!editing && recordFirst(across)}
        {/* Read-only: Title, Platform, Transcript, Comment, Time Stamp — the organiser is in
            the header. Edit: organiser, platform, title (logs only) and comments. */}
        {!editing && <Field label="Title"><ReadValue>{a.title}</ReadValue></Field>}
        {!editing && (a.attendees || []).length > 0 && <Field label="Attendees"><ReadValue>{attendeesText(a.attendees)}</ReadValue></Field>}
        {editing && a.logged && <Field label="Organiser"><Select value={d.organiser} options={teamOptions} onChange={v=>v && set({organiser:v})}/></Field>}
        {editing ? (a.logged && <Field label="Platform"><Select value={d.platform} options={MEETING_PLATFORMS} placeholder="Select platform" onChange={v=>set({platform:v})}/></Field>)
                 : <Field label="Platform"><ReadValue>{a.platform}</ReadValue></Field>}
        {!editing && <Field label="Transcript"><MeetingTranscript a={a} onUpdate={onUpdate}/></Field>}
        {editing && a.logged && <Field label="Title"><input value={d.title} onChange={e=>set({title:e.target.value})} style={fieldText}/></Field>}
        <Field label="Comment">
          <div style={{display:'flex', flexDirection:'column', gap:10, paddingTop: editing ? 0 : 7}}>
            {comments.map(n => editing
              ? <div key={n.id}>{area(d.edits[n.id] ?? n.body, v=>set({edits:{...d.edits, [n.id]:v}}))}</div>
              : <div key={n.id} style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>
                  {n.body}
                  <div style={{fontSize:11.5, color:T.attioMuted, marginTop:2}}>Saved as a note · {fmtActStamp(n.at)}</div>
                </div>)}
            {editing && area(d.added, v=>set({added:v}), 'Add a comment — saved as a note linked to this meeting')}
            {!editing && !comments.length && <div style={{fontSize:13, color:T.attioMuted}}>No comments yet.</div>}
          </div>
        </Field>
        {!editing && personLed(across) && recordFields(across)}
        {!editing && <Field label="Time Stamp"><ReadValue>{fmtActStamp(a.at)}</ReadValue></Field>}
      </>)}
    </DetailFrame>
  );
}

function OwnerChangeDetail({a, contact, team, onReassign}){
  const [editing, setEditing] = React.useState(false);
  const [owner, setOwner] = React.useState(contact.owner || null);
  const cancel = () => { setOwner(contact.owner || null); setEditing(false); };
  // Reassigning goes through the normal owner update, which records its own Owner change.
  const save = () => { if(owner && owner !== contact.owner && onReassign) onReassign(owner); setEditing(false); };
  return (
    <DetailFrame head={activityHead(a, contact)} actions={editing ? saveBar(cancel, save, !!owner && owner !== contact.owner) : editBar(()=>{ setOwner(contact.owner || null); setEditing(true); })}>
      {stack(<>
        {editing
          ? <Field label="Reassign owner"><Select value={owner} options={team} placeholder="Select owner" onChange={setOwner}/></Field>
          : <>
              <Field label="Previous owner"><ReadValue>{userLabel(a.from)}</ReadValue></Field>
              <Field label="New owner"><ReadValue>{userLabel(a.to)}</ReadValue></Field>
            </>}
      </>)}
    </DetailFrame>
  );
}

function ActivityDetail({a, contact, team, acts, onUpdate, onAdd, onStub, onReassign, across}){
  if(a.type === 'call') return <CallDetail a={a} contact={contact} team={team} comments={acts.filter(n => n.type === 'note' && n.callId === a.id)} onUpdate={onUpdate} onAdd={onAdd} onStub={onStub} across={across}/>;
  if(a.type === 'meeting') return <MeetingDetail a={a} contact={contact} team={team} comments={acts.filter(n => n.type === 'note' && n.meetingId === a.id)} onUpdate={onUpdate} onAdd={onAdd} onStub={onStub} across={across}/>;
  if(a.type === 'email') return <EmailDetail a={a} contact={contact} acts={acts} onStub={onStub} onUpdate={onUpdate} across={across}/>;
  if(a.type === 'task') return <TaskDetail a={a} contact={contact} team={team} onUpdate={onUpdate} onStub={onStub} across={across && across.hideType ? across : undefined}/>;
  if(a.type === 'note') return <NoteDetail a={a} contact={contact} calls={acts.filter(x => x.type === 'call' || x.type === 'meeting')} onUpdate={onUpdate} onStub={onStub} across={across}/>;
  if(a.type === 'ownerChange') return <OwnerChangeDetail a={a} contact={contact} team={team} onReassign={onReassign}/>;
  if(a.type === 'file') return <FileActivityDetail a={a} contact={contact} onStub={onStub}/>;
  if(a.type === 'fileChange') return <FileChangeDetail a={a} contact={contact}/>;
  if(a.type === 'quote') return <QuoteActivityDetail a={a} contact={contact}/>;
  return null;
}

/* A task's due date and, optionally, a time on it (the time needs a date). */
function TaskDueFields({date, time, onChange}){
  return (<>
    <Field label="Due date"><DateField value={date} onChange={(v)=>onChange(v, v ? time : '')} ariaLabel="Due date"/></Field>
    <Field label="Due time"><div style={{opacity: date ? 1 : .5, pointerEvents: date ? 'auto' : 'none'}}>
      <TimeField value={time} onChange={(v)=>onChange(date, v)} ariaLabel="Due time"/></div></Field>
  </>);
}

/* ── New items (right pane) — same frame: the form's title and Cancel / Save in the header ── */

/* ── Creation side panel ── one pattern for every new activity (Call, Task, Email, Meeting, Note),
   from a record's tabs and from the Tools pages: a right-hand panel with its title and close; on
   Tools pages, the record it's for first (Record Type, then the record — CreatePanelCtx), left out
   on a record's own page, where the record is known; the activity's fields (label on the left);
   and ⋯, Cancel and the activity's action(s) at the bottom. `placement`: 'inline' sits over the
   area it's opened from (that area is position:relative); 'fixed' sits at the right of the CRM,
   under its header (opened from a list's quick actions). */
const CreatePanelCtx = React.createContext(null);   // {record: the Record Type section, ready: a record is chosen}
// Where Reply / Forward open the composer: the area the email is shown in (else the CRM's right edge).
const ComposeHostCtx = React.createContext(null);   // {compose(opts)}
const CREATE_PANEL_W = 560;
/* Where every side panel in the content area opens — creation forms and detail views alike:
   directly beneath the app header (the one with the Spring clock), down to the bottom of the
   window, at the right edge, over the page's own toolbar (search, filters, views). Rendered into
   the page body, so no container (a record page, a toolbar) offsets or clips it. Creation panels
   sit above detail panels (a form opened from a detail covers it).
   A page that stays mounted while hidden (Contacts, Deals, Customers; the CRM behind the ERP
   home) hides its panels with it (PageVisibleCtx), so they never show over another page. */
const APP_HEADER_H = 45;
const PageVisibleCtx = React.createContext(true);
function ContentSidePanel({width, zIndex = 80, style, children}){
  const visible = React.useContext(PageVisibleCtx);
  return ReactDOM.createPortal(
    <div onMouseDown={e=>e.stopPropagation()} style={{position:'fixed', top:APP_HEADER_H, right:0, bottom:0, width, maxWidth:'100%', zIndex, ...style, ...(visible ? {} : {display:'none'})}}>{children}</div>,
    document.body);
}
/* `width`: wider for a builder with a stepper (Quotes); `flush`: the body lays itself out (its own columns and scrolling). */
/* `more:false` leaves out the ⋯ button. Every creation panel opens in the same place
   (ContentSidePanel); `placement` is kept for its callers but no longer moves it. */
function CreatePanelFrame({title, onClose, top, children, actions, placement, width = CREATE_PANEL_W, flush = false, more = true, zIndex}){
  const [stub, setStub] = React.useState(null);
  return (
    <ContentSidePanel width={width} zIndex={zIndex} style={{background:'#fff', borderLeft:`1px solid ${T.border}`, boxShadow:'-8px 0 24px rgba(16,24,40,.08)', display:'flex', flexDirection:'column'}}>
      <div style={{display:'flex', alignItems:'center', gap:10, padding:'16px 20px', borderBottom:`1px solid ${T.border}`, flexShrink:0}}>
        <span style={{flex:1, minWidth:0, fontSize:15, fontWeight:600, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{title}</span>
        <button title="Close" onClick={onClose} style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:4}}><Icon name="close" size={14} color={T.gray600}/></button>
      </div>
      {top && <div style={{padding:'16px 20px', borderBottom:`1px solid ${T.border}`, flexShrink:0}}>{top}</div>}
      {flush ? <div style={{flex:1, minHeight:0, display:'flex'}}>{children}</div>
        : <div style={{flex:1, minHeight:0, overflowY:'auto', padding:'20px'}}>{children}</div>}
      <div style={{display:'flex', alignItems:'center', justifyContent:'flex-end', gap:8, padding:'12px 20px', borderTop:`1px solid ${T.border}`, flexShrink:0}}>
        {/* ⋯ — what it holds isn't defined yet. */}
        {more && <button title="More actions" onClick={()=>setStub('More actions')} style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:6}}>
          <Icon name="moreDots" size={14} color={T.gray600}/></button>}
        {actions}
      </div>
      {stub && <StubPanel title={stub} onClose={()=>setStub(null)} zIndex={120}/>}
    </ContentSidePanel>
  );
}
// The record a new activity is for (Tools pages): Record Type, then the record.
function CreateRecordField({value, onChange}){
  return (
    <div style={{display:'flex', flexDirection:'column', gap:8}}>
      <span style={{fontSize:12.5, color:T.attioMuted}}>Record Type</span>
      <RecordPicker value={value} onChange={onChange}/>
    </div>
  );
}
function NewItemPanel({title, children, canSave, onSave, onCancel, primary = 'Save'}){
  const ctx = React.useContext(CreatePanelCtx) || {};
  const ok = canSave && ctx.ready !== false;
  return (
    <CreatePanelFrame title={title} onClose={onCancel} top={ctx.record} actions={<>
      <StSecondary label="Cancel" onClick={onCancel}/>
      <StCta label={primary} disabled={!ok} onClick={()=>ok && onSave()}/>
    </>}>
      {stack(children)}
    </CreatePanelFrame>
  );
}

/* A note is rich text (richText.jsx — the Quotes and Services editor): bold, italic, underline,
   numbered / bulleted / alphabetical lists and links, kept as HTML in `body`. */
function NewNote({onAdd, onDone}){
  const [html, setHtml] = React.useState('');
  return (
    <NewItemPanel title="New Note" canSave={!richIsEmpty(html)} onCancel={()=>onDone(null)}
      onSave={()=>{ const id = newId('note'); onAdd({id, type:'note', source:'you', by:null, body:sanitizeRichText(html)}); onDone(id); }}>
      <Field label="Note"><RichTextEditor value={html} onChange={setHtml} placeholder="Write a note" minHeight={180} ariaLabel="Note"/></Field>
    </NewItemPanel>
  );
}

/* `fixedPoc`: the point of contact, not asked for (Tools → Calls logs the current user's calls). */
function NewLogCall({contact, team, onAdd, onDone, fixedPoc}){
  const [type, setType] = React.useState(null);
  // The point of contact (the call's responsible person): the record owner unless another is picked.
  const [poc, setPoc] = useOwnerDefault(contact, team, fixedPoc);
  const [outcome, setOutcome] = React.useState(null);
  const [comment, setComment] = React.useState('');
  const ok = !!type && !!poc && !!outcome;
  const save = () => {
    const id = newId('call');
    onAdd({id, type:'call', logged:true, outcome, durationMin:0, body:'', ...callPatch(type, poc)});
    if(comment.trim()) onAdd({id:newId('note'), type:'note', source:'you', by:null, body:comment.trim(), callId:id});
    onDone(id);
  };
  return (
    <NewItemPanel title="Log Call" canSave={ok} onSave={save} onCancel={()=>onDone(null)}>
      <Field label="Call type"><Select value={type} options={CALL_TYPES} placeholder="Select call type" onChange={setType}/></Field>
      {!fixedPoc && <Field label="Point of contact"><PersonPicker value={poc} team={team} contact={contact} onChange={setPoc}/></Field>}
      <Field label="Call outcome"><Select value={outcome} options={LOG_CALL_OUTCOMES} placeholder="Select outcome" onChange={setOutcome}/></Field>
      <Field label="Comment">
        <textarea value={comment} onChange={e=>setComment(e.target.value)} rows={3} placeholder="Optional — saved as a note linked to this call"
          style={{...fieldText, resize:'vertical', lineHeight:1.5}}/>
      </Field>
    </NewItemPanel>
  );
}

function NewLogMeeting({contact, team, onAdd, onDone}){
  const [m, setM] = React.useState({platform:null, title:'', comment:'', attendees:[]});
  const [organiser, setOrganiser] = useOwnerDefault(contact, team);
  const set = (p) => setM(x => ({...x, ...p}));
  const ok = !!organiser && !!m.platform && !!m.title.trim();
  const save = () => {
    const id = newId('meeting');
    onAdd({id, type:'meeting', logged:true, source:'team', by:organiser, platform:m.platform, title:m.title.trim(), attendees:m.attendees});
    if(m.comment.trim()) onAdd({id:newId('note'), type:'note', source:'you', by:null, body:m.comment.trim(), meetingId:id});
    onDone(id);
  };
  return (
    <NewItemPanel title="Log Meeting" canSave={ok} onSave={save} onCancel={()=>onDone(null)}>
      <Field label="Organiser"><PersonPicker value={organiser} team={team} contact={contact} placeholder="Select organiser" onChange={setOrganiser}/></Field>
      <Field label="Attendees"><AttendeesField value={m.attendees} team={team} contact={contact} onChange={v=>set({attendees:v})}/></Field>
      <Field label="Platform"><Select value={m.platform} options={MEETING_PLATFORMS} placeholder="Select platform" onChange={v=>set({platform:v})}/></Field>
      <Field label="Title"><input value={m.title} onChange={e=>set({title:e.target.value})} placeholder="Meeting title" style={fieldText}/></Field>
      <Field label="Comment">
        <textarea value={m.comment} onChange={e=>set({comment:e.target.value})} rows={3} placeholder="Optional — saved as a note linked to this meeting"
          style={{...fieldText, resize:'vertical', lineHeight:1.5}}/>
      </Field>
    </NewItemPanel>
  );
}

/* Schedule a meeting with the record: title, platform, date, time, duration, organiser. It's a
   scheduled meeting until its time passes (then Meeting Completed, for workflows). */
const SCHEDULE_DURATIONS = [['15 minutes', 15], ['30 minutes', 30], ['45 minutes', 45], ['1 hour', 60], ['1 hour 30 minutes', 90], ['2 hours', 120]];
function NewScheduleMeeting({contact, team, onAdd, onDone}){
  const [m, setM] = React.useState({title:'', platform:null, date:ymdOf(new Date(Date.now() + 86400000)), time:'10:00', duration:'30 minutes', description:'', attendees:[]});
  const [organiser, setOrganiser] = useOwnerDefault(contact, team);
  const set = (p) => setM(x => ({...x, ...p}));
  const ok = !!m.title.trim() && !!m.platform && !!m.date && !!m.time && !!organiser;
  const save = () => {
    const at = taskDueValue(m.date, m.time).due, id = newId('meeting');
    onAdd({id, type:'meeting', logged:false, status:'scheduled', at, scheduledFor:at, title:m.title.trim(), platform:m.platform,
      durationMin:(SCHEDULE_DURATIONS.find(d => d[0] === m.duration) || [0, 30])[1], description:m.description.trim(), organizer:organiser, source:'team', by:organiser, attendees:m.attendees});
    onDone(id);
  };
  return (
    <NewItemPanel title="Schedule Meeting" canSave={ok} onSave={save} onCancel={()=>onDone(null)}>
      <Field label="Title"><input autoFocus value={m.title} onChange={e=>set({title:e.target.value})} placeholder="Meeting title" style={fieldText}/></Field>
      <Field label="Platform"><Select value={m.platform} options={MEETING_PLATFORMS} placeholder="Select platform" onChange={v=>set({platform:v})}/></Field>
      <Field label="Date"><DateField required value={m.date} onChange={v=>set({date:v})} ariaLabel="Meeting date"/></Field>
      <Field label="Time"><TimeField required value={m.time} onChange={v=>set({time:v})} ariaLabel="Meeting time"/></Field>
      <Field label="Duration"><Select value={m.duration} options={SCHEDULE_DURATIONS.map(d => d[0])} onChange={v=>v && set({duration:v})}/></Field>
      <Field label="Organiser"><PersonPicker value={organiser} team={team} contact={contact} placeholder="Select organiser" onChange={setOrganiser}/></Field>
      <Field label="Attendees"><AttendeesField value={m.attendees} team={team} contact={contact} onChange={v=>set({attendees:v})}/></Field>
      <Field label="Description"><textarea value={m.description} onChange={e=>set({description:e.target.value})} rows={3} style={{...fieldText, resize:'vertical', lineHeight:1.5}}/></Field>
    </NewItemPanel>
  );
}

// `contact`: the record the task is for — its owner is the default assignee.
function NewTask({team, contact, onAdd, onDone, initial}){
  const [t, setT] = React.useState(() => { const pipelineId = (initial && initial.pipelineId) || DEFAULT_TASK_PIPELINE_ID;
    const {assignee:_a, ...given} = initial || {};
    return {title:'', description:'', pipelineId, status:firstStageOf(pipelineId), taskType:'To-do', dueDate:'', dueTimeOfDay:'', ...given}; });
  const [assignee, setAssignee] = useOwnerDefault(contact, team, initial && initial.assignee);
  const set = (p) => setT(x => ({...x, ...p}));
  const ok = !!t.title.trim() && !!assignee;
  return (
    <NewItemPanel title="New Task" canSave={ok} onCancel={()=>onDone(null)}
      onSave={()=>{ const id = newId('task'); const {dueDate, dueTimeOfDay, ...rest} = t;
        onAdd({id, type:'task', source:'you', by:null, ...rest, assignee, ...taskDueValue(dueDate, dueTimeOfDay), title:t.title.trim(), description:t.description.trim()}); onDone(id); }}>
      <Field label="Task name"><input autoFocus value={t.title} onChange={e=>set({title:e.target.value})} placeholder="What needs doing" style={fieldText}/></Field>
      <Field label="Description">
        <textarea value={t.description} onChange={e=>set({description:e.target.value})} rows={3} style={{...fieldText, resize:'vertical', lineHeight:1.5}}/>
      </Field>
      <Field label="Pipeline"><Select value={t.pipelineId} options={taskPipelineOptions()} onChange={v=>v && set({pipelineId:v, status:firstStageOf(v)})}/></Field>
      <Field label="Status"><TaskStatusRadios name="status-new" pipelineId={t.pipelineId} value={t.status} onChange={v=>set({status:v})}/></Field>
      <Field label="Task type"><Select value={t.taskType} options={TASK_TYPES} onChange={v=>v && set({taskType:v})}/></Field>
      <Field label="Assigned to"><PersonPicker value={assignee} team={team} contact={contact} onChange={setAssignee}/></Field>
      <TaskDueFields date={t.dueDate} time={t.dueTimeOfDay} onChange={(date, time)=>set({dueDate:date, dueTimeOfDay:time})}/>
    </NewItemPanel>
  );
}

/* ── Tab ─────────────────────────────────────────────────────────────────────────────────── */

const ACTIVITY_TAB_TYPES = {activity:null, calls:'call', email:'email', tasks:'task', notes:'note', meetings:'meeting'};   // Meetings: the Deal tabs

/* The tab's add action, at the right of the toolbar: a primary button. Where a tab offers more
   than one type, it still opens the list of types. */
const ACTIVITY_ADD = {
  activity: {label:'Add',       menu:['Note', 'Call', 'Log Call', 'Start Meeting', 'Schedule Meeting', 'Log Meeting', 'Task', 'Email']},
  calls:    {label:'Add call',  menu:['Call', 'Log Call']},
  notes:    {label:'Add note',  pick:'Note'},
  email:    {label:'Add email', pick:'Email'},
  tasks:    {label:'Add task',  pick:'Task'},
  meetings: {label:'Add meeting', menu:['Start Meeting', 'Schedule Meeting', 'Log Meeting']},
};
/* `iconOnly`: just the + (the toolbar icon button, its name as the tooltip) — the Tools pages. */
function ActivityAddButton({tabId, onPick, iconOnly}){
  const [open, setOpen] = React.useState(false);
  const ra = useRecordAccess();
  const cfg0 = ACTIVITY_ADD[tabId];
  if(!cfg0) return null;
  // Only what the acting user may create on this record (its Object's Tools permissions).
  const allowed = (o) => !ra || canAdd(ra.object, ra.record, o);
  const cfg = cfg0.pick ? (allowed(cfg0.pick) ? cfg0 : null) : {...cfg0, menu:cfg0.menu.filter(allowed)};
  if(!cfg || (cfg.menu && !cfg.menu.length)) return null;
  const style = {...btnPrimarySm(), display:'inline-flex', alignItems:'center', gap:6};
  const face = iconOnly ? <Icon name="plus" size={14} color={T.gray800}/> : <><Icon name="plus" size={13} color="#fff"/> {cfg.label}</>;
  const btnProps = iconOnly ? {style:toolbarIconButton, title:cfg.label, 'aria-label':cfg.label} : {style};
  if(cfg.pick) return <button onClick={()=>onPick(cfg.pick)} {...btnProps}>{face}</button>;
  return (
    <div style={{position:'relative'}}>
      <button onClick={()=>setOpen(o=>!o)} {...btnProps}>{face}</button>
      <MenuShell open={open} onClose={()=>setOpen(false)} anchorRight width={170}>
        {cfg.menu.map(o => <MenuItem key={o} label={o} onClick={()=>{ setOpen(false); onPick(o); }}/>)}
      </MenuShell>
    </div>
  );
}

/* Left pane: a plain navigation column — rows only, no cards, borders or rounding. Selected:
   light-grey background. Hover: a subtler one. */
// `count`: an email thread's size, shown beside its latest email.
function ActivityNavItem({a, contact, context, selected, onSelect, record, count = 1}){
  const [h, setH] = React.useState(false);
  return (
    <div onClick={onSelect} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{background: selected ? '#F4F5F7' : h ? T.headerBg : 'transparent', position:'relative',
              padding:'4px 20px', cursor:'pointer', transition:'background 120ms ease'}}>
      <ActivityRow a={a} contact={contact} context={context} compact first record={record}/>
      {count > 1 && <span title={`${count} emails in this thread`} style={{position:'absolute', right:20, bottom:10, fontSize:11, fontWeight:600, color:T.gray600, background:T.headerBg, borderRadius:9999, padding:'1px 7px'}}>{count}</span>}
    </div>
  );
}

// `emptyText`: replaces the tab's empty message (e.g. when a view's search or filters hide everything).
// `prefill`: what a new item's form starts with (a task's name and type).
/* `recordOf(act)` → {object, record}: an associated feed — each item names the record it's on,
   and opens on that record (its details, edits and comments go to it). */
function ActivityTab({tabId, contact, acts, team, adding, setAdding, prefill, onUpdate, onAdd, onStub, onReassign, emptyText, recordOf}){
  const hub = useRecordHub();
  const type = ACTIVITY_TAB_TYPES[tabId];
  const all = type ? acts.filter(a => a.type === type) : listedActivities(acts);
  /* Emails: one row per thread — its latest email, with how many it has (emails.jsx). A row's
     record (an associated record's feed) keeps threads apart per record. */
  const threads = type === 'email' ? threadedEmailRows([...all].sort((x, y) => emailTime(y) - emailTime(x)), (a) => a,
    (a) => { const on = recordOf && recordOf(a); return on ? `${on.object}:${on.record.id}` : 'own'; }, (a) => { const on = recordOf && recordOf(a); return on ? (hub.activities[on.object] || {})[on.record.id] || [] : acts; }) : null;
  const list = threads ? threads.map(t => t.item) : all;
  const threadCount = (a) => threads ? (threads.find(t => t.item === a) || {}).count || 1 : 1;
  const context = tabId === 'calls' ? 'calls' : type ? 'type' : 'all';
  const ra = useRecordAccess();
  const [selectedId, setSelectedId] = React.useState(null);
  const [compose, setCompose] = React.useState(null);   // Reply / Forward: the composer's options
  const selected = list.find(a => a.id === selectedId) || list[0] || null;
  const done = (id) => { setAdding(null); if(id) setSelectedId(id); };
  const empty = emptyText || {activity:'No activity yet.', calls:'No calls yet.', email:'No emails yet.', tasks:'No tasks yet.', notes:'No notes yet.', meetings:'No meetings yet.'}[tabId];
  // A new email from this record, or a reply / forward of one shown here.
  const emailOpts = adding === 'Email' && ra ? {object:ra.object, id:ra.record.id} : compose;
  const closeEmail = (result, id) => { setAdding(a => a === 'Email' ? null : a); setCompose(null); if(id) setSelectedId(id); };
  return (
    <ComposeHostCtx.Provider value={{compose:setCompose}}>
    <div style={{display:'flex', flex:1, minHeight:0, height:'100%', position:'relative'}}>
      {/* Tasks: the Tasks module's board — In Progress, Overdue, Completed — for this record's tasks
          (and its associated records' on their feeds); a task opens in a side panel. */}
      {tabId === 'tasks' ? (() => {
        const entryOf = (a) => { const on = recordOf && recordOf(a);
          return on ? {act:a, object:on.object, recordId:on.record.id, record:on.record}
            : {act:a, object: ra ? ra.object : 'contacts', recordId: ra ? ra.record.id : contact.id, record: ra ? ra.record : contact}; };
        const entries = list.map(entryOf), open = selectedId && entries.find(e => e.act.id === selectedId);
        const own = (e) => !(recordOf && recordOf(e.act));
        const update = (e, patch) => own(e) ? onUpdate(e.act.id, patch) : hub.update(e.object, e.recordId, e.act.id, patch);
        const view = (r) => r && {...r, owner:userLabel(r.owner) || r.owner};
        return <>
          <TaskStatusBoard entries={entries} onUpdate={update} onOpen={(e)=>setSelectedId(e.act.id)} showAssignee/>
          {open && <PageSidePanel width={560} title={open.act.title || 'Task'} subtitle={`${HUB_NOUN[open.object]} · ${open.record.name}`} onClose={()=>setSelectedId(null)}>
            <div style={{flex:1, minHeight:0, display:'flex', flexDirection:'column'}}>
              {own(open) ? <ActivityDetail key={open.act.id} a={open.act} contact={contact} team={team} acts={acts} onUpdate={onUpdate} onAdd={onAdd} onStub={onStub} onReassign={onReassign}/>
                : <RecordAccessCtx.Provider value={{object:open.object, record:open.record}}>
                    <ActivityDetail key={open.act.id} a={open.act} contact={view(open.record)} team={team} acts={(hub.activities[open.object] || {})[open.recordId] || []}
                      onUpdate={(id, patch)=>hub.update(open.object, open.recordId, id, patch)} onAdd={(x)=>hub.add(open.object, open.recordId, x)}
                      onStub={onStub} onReassign={()=>{}} across={{object:open.object, record:open.record, perspective:'person', hideType:true}}/>
                  </RecordAccessCtx.Provider>}
            </div>
          </PageSidePanel>}
        </>;
      })() : <>
      {/* Left — the navigation column, full height, divided from the detail by one vertical
          line (the same treatment as main nav | page and side panel | content). */}
      <div style={{width:380, flexShrink:0, overflowY:'auto', borderRight:`1px solid ${T.border}`, padding:'8px 0'}}>
        {list.map(a => (
          <ActivityNavItem key={a.id} a={a} contact={contact} context={context} count={threadCount(a)}
            record={recordOf && recordOf(a) && (({object, record}) => ({object, id:record.id, name:record.name}))(recordOf(a))}
            selected={selected && selected.id === a.id} onSelect={()=>setSelectedId(a.id)}/>
        ))}
        {!list.length && <div style={{fontSize:13, color:T.attioMuted, padding:'24px 20px', textAlign:'center'}}>{empty}</div>}
      </div>

      {/* Right — the selected item's content (DetailFrame). */}
      <div style={{flex:1, minWidth:0, minHeight:0, display:'flex', flexDirection:'column'}}>
        {selected && (() => {
          const on = recordOf && recordOf(selected);
          if(!on) return <ActivityDetail key={selected.id} a={selected} contact={contact} team={team} acts={acts}
            onUpdate={onUpdate} onAdd={onAdd} onStub={onStub} onReassign={onReassign}/>;
          // On an associated record: as on the Tools pages, with the record named in the details.
          const view = {...on.record, owner:userLabel(on.record.owner) || on.record.owner};
          return (
            <RecordAccessCtx.Provider value={{object:on.object, record:on.record}}>
              <ActivityDetail key={selected.id} a={selected} contact={view} team={team} acts={(hub.activities[on.object] || {})[on.record.id] || []}
                onUpdate={(id, patch)=>hub.update(on.object, on.record.id, id, patch)} onAdd={(x)=>hub.add(on.object, on.record.id, x)}
                onStub={onStub} onReassign={()=>{}} across={{object:on.object, record:on.record, perspective:'person', hideType:true}}/>
            </RecordAccessCtx.Provider>
          );
        })()}
      </div>
      </>}

      {/* A new item: the creation side panel over this area, without the record section — the
          record is this one. */}
      {adding === 'Note' && <NewNote onAdd={onAdd} onDone={done}/>}
      {adding === 'Log Call' && <NewLogCall contact={contact} team={team} onAdd={onAdd} onDone={done}/>}
      {adding === 'Log Meeting' && <NewLogMeeting contact={contact} team={team} onAdd={onAdd} onDone={done}/>}
      {adding === 'Schedule Meeting' && <NewScheduleMeeting contact={contact} team={team} onAdd={onAdd} onDone={done}/>}
      {adding === 'Task' && <NewTask team={team} contact={contact} initial={prefill} onAdd={onAdd} onDone={done}/>}
      {emailOpts && <EmailComposer key={adding === 'Email' ? 'new' : 'reply'} {...emailOpts} onClose={closeEmail}/>}
    </div>
    </ComposeHostCtx.Provider>
  );
}

Object.assign(window, {CreatePanelFrame, ContentSidePanel, APP_HEADER_H, PageVisibleCtx, CreatePanelCtx, CreateRecordField, ComposeHostCtx, ActivityDetail, NewNote, NewLogCall, NewLogMeeting, NewScheduleMeeting, NewTask, SCHEDULE_DURATIONS, ActivityTab, ActivityAddButton, ACTIVITY_TAB_TYPES});
