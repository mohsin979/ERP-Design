/* HOF Pulse ERP — Contact activity tabs (Activity, Calls, Email, Tasks, Notes).

   Two panes, the same in every tab: on the left a plain full-height navigation column (one
   vertical divider, no cards), each row the Overview → Snapshots row (ActivityRow, compact),
   which identifies the activity; click one and the right
   pane shows its content only — nothing from the row is repeated there. The add
   action sits at the right of the tab toolbar and opens its form in the right pane.

   Every detail has the same minimal header (DetailFrame): the activity's first line on the left
   ("Meeting by [Person]", …), Edit and ⋯ on the right; Edit → Cancel / Save in the same place.
     Call   — "Call by [Person]" (made through the system: nothing to edit) or "Call log by
              [Person]" (entered by hand: call type, point of contact and outcome editable).
              Details: call type (Inbound / Outbound), point of contact (the internal
              representative), outcome; then its Notes (ActivityNotes: Notes linked to the call).
              Connected, not qualified (2026-11-20) asks its Not Qualified Reason
              (NotQualifiedReasonField) — kept on the call, shown under its outcome, and set on
              the lead (setLeadNotQualified).
     Email  — subject and content; the header has Reply, ⋯ has Forward. Or "Email log …" (Log
              Email — an email outside the CRM, entered by hand, as a call log): email type (Sent /
              Received), point of contact, subject and content, all editable.
     Task   — its type first, as a tag (2026-11-23; "Due date passed" beside it once overdue), then
              name, description, status, assigned to, due, assigned by; Edit: Task Type as radios
              (To-do, Email, Call, Colleague follow-up), Status as radios, a Due Date (required) and
              an optional Due Time. A new task has no Status field: it starts Not Started. Then its
              Notes (ActivityNotes: Notes linked to the task). Its header moves it on: Start (Not
              Started → In Progress), Put on Hold, Resume (On Hold → In Progress), Complete.
              Time Allowed (2026-11-20, optional, after Due Time on the new and edit forms —
              TaskTimeAllowedField): once the task is In Progress, how it stands against it shows
              beside its Status (TaskTimeLeft; activities.jsx taskTimeState, withTaskStart).
     Note   — readable text; Edit makes it a field. Its Note Type (2026-11-23: General, Client
              Request, Support — radios, first on the form; noteTools.jsx) shows as a tag; @tags notify and email the
              people tagged; replies are one level deep (noteTools.jsx, NoteReplies).
     Owner change — previous and new owner; Edit reassigns the owner (through the normal owner
              update, so it records its own Owner change).

     Meeting — "Meeting" (start / schedule — not defined yet) or "Meeting log" (an online
              meeting logged by hand: organiser, platform, title, link). Read-only: title,
              platform, transcript (Read / Add transcript), time stamp, link (the organiser is in
              the header); then its Notes (ActivityNotes: Notes linked to the meeting).
   Overview, Calls, Notes, Emails and Meetings (2026-11-18): the activity is a time trail
   (ActivityTrail) — Upcoming, then each month; time and date left of a rail; its one action on the
   right (trailAction — the stakeholder's rules of 2026-11-23: only the latest call and emails carry
   one, tasks by their type, notes by their author). Tasks keep their Table / Board.
   Required fields (2026-11-23): `Field required` shows the red asterisk — on the create forms, and
   on a detail only while it's being edited; Save waits for them.
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
// `required`: an asterisk after the label (as the record forms).
function Field({label, children, wide, required}){
  return (
    <div style={{display:'flex', alignItems:'flex-start', gap:12, minHeight:34}}>
      <span style={actFieldLabel}>{label}{required && <span style={{color:T.red}}> *</span>}</span>
      <div style={{flex:1, minWidth:0, maxWidth: wide ? 'none' : 420}}>{children}</div>
    </div>
  );
}
function ReadValue({children}){
  return <div style={{fontSize:13, color:T.attioText, paddingTop:7, lineHeight:1.5, whiteSpace:'pre-line'}}>{children || '—'}</div>;
}
// The activity forms' dropdown (Dropdown, shared.jsx); nothing picked is null.
function Select({value, options, onChange, placeholder, ariaLabel}){
  return <Dropdown value={value || ''} options={options} onChange={(v)=>onChange(v || null)} placeholder={placeholder} ariaLabel={ariaLabel} controlStyle={fieldControl}/>;
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
/* An email log — an email sent or received outside the CRM, entered by hand (Log Email), as a
   call log is. Sent: the point of contact sent it; Received: the customer did, to them. */
const EMAIL_TYPES = ['Sent', 'Received'];
const emailTypeOf = (a) => a.direction === 'received' ? 'Received' : 'Sent';
const emailPatch = (type, poc) => type === 'Received' ? {direction:'received', source:'client', by:null, pointOfContact:poc} : {direction:'sent', source:'team', by:poc, pointOfContact:poc};
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

/* In an activity's own side panel (a record's activity, 2026-11-18) the actions — Edit
   and ⋯, or Cancel and Save while editing — sit in a footer at the bottom right, not in the header. */
const DetailFooterCtx = React.createContext(false);
/* What an activity was opened to do from Overview's time trail: 'note' starts a new note under it (ActivityNotes). */
const DetailIntentCtx = React.createContext(null);
/* The activity's trail action (Overview's time trail — trailAction), given by ActivityTab to the
   side panel: {what, el} — its filled button, last in the footer, beside Edit / ⋯; the detail
   leaves out what it would repeat (an email's Reply under Follow Up, Reply or Edit). */
const DetailPrimaryCtx = React.createContext(null);
function DetailFrame({head, children, actions, editing}){
  const footer = React.useContext(DetailFooterCtx);
  const primary = React.useContext(DetailPrimaryCtx), main = footer && !editing && primary ? primary.el : null;
  return (
    <div style={{flex:1, minHeight:0, display:'flex', flexDirection:'column'}}>
      <div style={{flexShrink:0, display:'flex', alignItems:'center', gap:12, minHeight:50, boxSizing:'border-box',
                   padding:'9px 24px', borderBottom:`1px solid ${T.border}`, background:'#fff'}}>
        <div style={{flex:1, minWidth:0, display:'flex'}}>{head}</div>
        {!footer && <div style={{flexShrink:0, display:'flex', alignItems:'center', gap:8}}>{actions}</div>}
      </div>
      <div style={{flex:1, minHeight:0, overflowY:'auto', padding:'20px 24px'}}>{children}</div>
      {footer && (actions || main) && <div style={{flexShrink:0, display:'flex', alignItems:'center', justifyContent:'flex-end', gap:8, padding:'12px 20px', borderTop:`1px solid ${T.border}`, background:'#fff'}}>{actions}{main}</div>}
    </div>
  );
}
/* The header's left side for an activity: its first line in the All Activity wording. */
const activityHead = (a, contact) => <ActivityLead a={a} lead={activityLines(a, contact, 'all').lead} style={{fontSize:13, color:T.attioMuted}}/>;
/* Tools → Calls, Emails, Meetings, Notes show activities across records, from the current user's
   side: the record leads, not the employee. `acrossLead`: the words before the record's name. */
// Calls: an inbound call came from the record ("Call by [Record]"); an outbound one went to it.
const acrossLead = (a) => a.type === 'call' ? (isInboundCall(a) ? (a.logged ? 'Call log by' : 'Call by') : (a.logged ? 'Call log to' : 'Call to'))
  : a.type === 'email' ? (a.status === 'scheduled' ? 'Scheduled to' : a.logged ? (a.direction === 'received' ? 'Email log from' : 'Email log to') : a.direction === 'received' ? 'Received from' : 'Sent to')
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
  <Field label="Record Name"><div style={{paddingTop:7, fontSize:13, display:'flex'}}><HubRecordLink object={across.object} id={across.record.id} name={across.record.name}/></div></Field>
  <Field label="Record Type"><ReadValue>{HUB_NOUN[across.object]}</ReadValue></Field>
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
  const footer = React.useContext(DetailFooterCtx);   // in the panel's footer: the menu opens upwards
  const del = useActivityDelete();
  const [confirm, setConfirm] = React.useState(null);   // the Delete item being confirmed
  const run = (it) => { if(it.deleteAct && del) return setConfirm(it); it.onClick(); };
  return (<>
    {confirm && <StModal title={confirm.label} primary={confirm.label} danger onCancel={()=>setConfirm(null)}
      onSubmit={()=>{ const it = confirm; setConfirm(null); del(it.deleteAct); }}>
      <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>It will be removed from the record. This can't be undone.</div>
    </StModal>}
    <div style={{position:'relative'}}>
      {/* The ⋯ every other menu uses: a plain 28px trigger, items without icons. */}
      <button title="Activity Actions" onClick={()=>setOpen(o=>!o)} style={{width:28, height:28, borderRadius:8, border:'none', cursor:'pointer',
        display:'flex', alignItems:'center', justifyContent:'center', background: open ? T.headerBg : 'transparent'}}>
        <Icon name="moreDots" size={15} color={T.gray600}/>
      </button>
      <MenuShell open={open} onClose={()=>setOpen(false)} anchorRight up={footer} width={210}>
        {items.map(it => <MenuItem key={it.label} label={it.label} danger={it.danger} onClick={()=>{ setOpen(false); run(it); }}/>)}
      </MenuShell>
    </div>
  </>);
}
const pinItem = (a, onUpdate) => a.pinned
  ? {label:'Unpin Activity', onClick:()=>onUpdate(a.id, {pinned:false})}
  : {label:'Pin Activity',   onClick:()=>onUpdate(a.id, {pinned:true})};
const stubItem = (label, onStub, icon, danger) => ({label, icon, danger, onClick:()=>onStub(label)});
/* One arrangement for every activity's ⋯ menu: the type's own actions, then
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
    {canEdit && onEdit && headerBtn('Edit', onEdit)}
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
// Task Type as radios (2026-11-23): To-do, Email, Call, Colleague follow-up.
function TaskTypeRadios({value, onChange, name}){
  return (
    <div role="radiogroup" aria-label="Task type" style={{display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 160px))', gap:'10px 16px', paddingTop:7}}>
      {TASK_TYPES.map(t => (
        <label key={t} style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:T.attioText, cursor:'pointer', lineHeight:'16px'}}>
          <input type="radio" name={name} checked={value === t} onChange={()=>onChange(t)}
            style={{margin:0, width:15, height:15, flexShrink:0, accentColor:T.black, cursor:'pointer'}}/>
          {t}
        </label>
      ))}
    </div>
  );
}
// The task pipeline dropdown; picking another pipeline puts the task at its first stage.
const taskPipelineOptions = () => TASK_PIPELINES.map(p => ({value:p.id, label:p.name}));
const firstStageOf = (pipelineId) => { const pl = TASK_PIPELINES.find(p => p.id === pipelineId) || TASK_PIPELINES[0]; return pl && pl.stages[0] ? pl.stages[0].id : ''; };

/* ── Details (right pane) ────────────────────────────────────────────────────────────────── */

/* A note's edit history and replies (2026-11-18). Each edit keeps the text it replaced — with who
   wrote that text and when (`history`) — and the note shows "Edited by … · when" with View History,
   every version newest first. Replies (`replies`): a thread under the note, each its text, any
   attachments, who and when; adding one follows the record's Notes permissions (Add), removing
   one its Delete. A note under a call, meeting or task keeps its history the same way. */
const noteAuthor = (n, contact) => { const p = activityActor(n, contact); return p ? p.name : (n.by || ''); };
const noteEditPatch = (n, body, contact) => ({body, editedBy:CURRENT_USER.name, editedAt:new Date().toISOString(),
  history:[...(n.history || []), {body:n.body || '', by:n.editedBy || noteAuthor(n, contact), at:n.editedAt || n.at}]});
function NoteEdited({n, contact}){
  const [open, setOpen] = React.useState(false);
  if(!n.editedAt) return null;
  const versions = [{body:n.body, by:n.editedBy, at:n.editedAt, current:true}, ...[...(n.history || [])].reverse()];
  return (<>
    <div style={{fontSize:12, color:T.attioMuted, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap'}}>
      <span>Edited by {n.editedBy} · {fmtActStamp(new Date(n.editedAt))}</span>
      <button type="button" onClick={()=>setOpen(true)} className={LINK_CLASS} style={{border:'none', background:'transparent', padding:0, cursor:'pointer', fontFamily:'inherit', fontSize:12, color:T.attioText}}>View History</button>
    </div>
    {open && <StModal title="Note History" primary={null} onCancel={()=>setOpen(false)} width={560}>
      <div style={{display:'flex', flexDirection:'column', gap:14, maxHeight:'60vh', overflowY:'auto'}}>
        {versions.map((v, i) => (
          <div key={i} style={{display:'flex', flexDirection:'column', gap:6, paddingBottom:12, borderBottom: i < versions.length - 1 ? `1px solid ${T.border}` : 'none'}}>
            <div style={{fontSize:12, color:T.attioMuted}}>{v.current ? 'Current · ' : ''}{v.by || noteAuthor(n, contact)} · {fmtActStamp(new Date(v.at))}</div>
            <RichTextView html={v.body} style={{fontSize:13, lineHeight:1.55, color:T.attioText}}/>
          </div>
        ))}
      </div>
    </StModal>}
  </>);
}
/* Replies are one level deep (2026-11-19): a reply can be answered — the answer sits under it,
   indented (`parentId`); answering an answer adds to the same thread under its reply. @tags in a
   reply notify and email the people tagged (noteTools.jsx). Deleting a reply deletes its answers. */
function NoteReplies({a, onUpdate, canReply, canRemove}){
  const hub = useRecordHub(), tagged = useMentionNotify();
  const users = React.useMemo(() => hub ? mentionUsers(hub.data) : [], [hub && hub.data.users]);
  const [text, setText] = React.useState('');
  const [files, setFiles] = React.useState([]);
  // Opened to reply (the trail's Reply icon — DetailIntentCtx 'reply'): the reply box is open from the start.
  const [writing, setWriting] = React.useState(React.useContext(DetailIntentCtx) === 'reply' ? 'top' : null);   // null, 'top' (a new reply) or the id of the reply being answered
  const [removing, setRemoving] = React.useState(null);
  const replies = a.replies || [];
  const top = replies.filter(r => !r.parentId || !replies.some(p => p.id === r.parentId));
  const answersOf = (id) => replies.filter(r => r.parentId === id);
  const ok = !!text.trim() || files.length > 0;
  const close = () => { setText(''); setFiles([]); setWriting(null); };
  const add = () => { if(!ok) return; const body = text.trim();
    onUpdate(a.id, {replies:[...replies, {id:`rp-${Date.now().toString(36)}`, body, by:CURRENT_USER.name, at:new Date().toISOString(),
      ...(writing !== 'top' ? {parentId:writing} : {}), ...(files.length ? {attachments:files} : {}), ...withMentions(null, tagged('', body, 'a reply'))}]});
    close(); };
  const box = (
    <div data-mentions="1" style={{display:'flex', flexDirection:'column', gap:8}}>
      <textarea autoFocus value={text} onChange={e=>setText(e.target.value)} rows={3} placeholder="Write a reply" aria-label="Reply" style={{...fieldText, resize:'vertical', lineHeight:1.5}}/>
      <EmailAttachmentsField list={files} update={setFiles}/>
      <div style={{display:'flex', justifyContent:'flex-end', gap:8}}>
        <button onClick={close} style={btnSecondarySm}>Cancel</button>
        <button onClick={add} disabled={!ok} style={btnPrimarySm(ok)}>Reply</button>
      </div>
    </div>
  );
  // An answer is answered in its reply's thread (one level).
  const item = (r, threadId) => (
    <div key={r.id} style={{display:'flex', flexDirection:'column', gap:6}}>
      <div style={{display:'flex', alignItems:'center', gap:8, minHeight:28}}>
        <div style={{flex:1, minWidth:0, display:'flex', alignItems:'center', gap:6, fontSize:13, color:T.attioMuted}}>
          <PersonAvatar kind="team" name={r.by}/><PersonName kind="team" name={r.by}/>
          <span style={{fontSize:11.5, whiteSpace:'nowrap'}}>{fmtActStamp(new Date(r.at))}</span>
        </div>
        {canRemove && <DetailMoreMenu items={[{label:'Delete Reply', icon:'trash', danger:true, onClick:()=>setRemoving(r)}]}/>}
      </div>
      {r.body && <div style={{fontSize:13, lineHeight:1.55, color:T.attioText, whiteSpace:'pre-wrap'}}><MentionText text={r.body} users={users}/></div>}
      {(r.attachments || []).length > 0 && <EmailAttachmentList list={r.attachments}/>}
      {canReply && writing !== threadId && <button type="button" onClick={()=>{ setText(''); setFiles([]); setWriting(threadId); }} className={LINK_CLASS}
        style={{alignSelf:'flex-start', border:'none', background:'transparent', padding:0, cursor:'pointer', fontFamily:'inherit', fontSize:12.5, color:T.attioText}}>Reply</button>}
    </div>
  );
  return (
    <div style={{marginTop:8, paddingTop:16, borderTop:`1px solid ${T.border}`, display:'flex', flexDirection:'column', gap:12}}>
      <div style={{display:'flex', alignItems:'center', gap:8}}>
        <span style={{fontSize:14, fontWeight:600, color:T.attioText}}>Replies ({replies.length})</span>
        {canReply && writing !== 'top' && <button title="Reply" aria-label="Reply" onClick={()=>{ setText(''); setFiles([]); setWriting('top'); }} style={{...btnSecondarySm, padding:'5px 7px'}}><Icon name="plus" size={13} color={T.attioText}/></button>}
      </div>
      {writing === 'top' && box}
      {top.map(r => { const answers = answersOf(r.id);
        return (
          <div key={r.id} style={{display:'flex', flexDirection:'column', gap:10}}>
            {item(r, r.id)}
            {(answers.length > 0 || writing === r.id) && <div style={{marginLeft:12, paddingLeft:16, borderLeft:`2px solid ${T.border}`, display:'flex', flexDirection:'column', gap:10}}>
              {answers.map(x => item(x, r.id))}
              {writing === r.id && box}
            </div>}
          </div>
        ); })}
      {!replies.length && !writing && <div style={{fontSize:13, color:T.attioMuted}}>No replies yet</div>}
      {removing && <StModal title="Delete Reply" primary="Delete Reply" danger onCancel={()=>setRemoving(null)}
        onSubmit={()=>{ onUpdate(a.id, {replies:replies.filter(x => x.id !== removing.id && x.parentId !== removing.id)}); setRemoving(null); }}>
        <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>{answersOf(removing.id).length ? 'This removes the reply, its attachments and the replies under it.' : 'This removes the reply and its attachments.'} It can't be undone.</div>
      </StModal>}
    </div>
  );
}

function NoteDetail({a, contact, calls, onUpdate, onStub, across}){
  const ra = useRecordAccess();
  const canNote = (action) => !ra || activityCan(ra.object, ra.record, a, action);
  const [editing, setEditing] = React.useState(false);
  // Edited in the rich text editor (a plain note saved before opens as paragraphs).
  const [text, setText] = React.useState(richHtmlOf(a.body || ''));
  const [noteType, setNoteType] = React.useState(noteTypeOf(a));
  const hub = useRecordHub(), tagged = useMentionNotify();
  const users = React.useMemo(() => hub ? mentionUsers(hub.data) : [], [hub && hub.data.users]);
  const call = a.callId && calls.find(c => c.id === a.callId);
  const meeting = a.meetingId && calls.find(c => c.id === a.meetingId);
  const task = a.taskId && calls.find(c => c.id === a.taskId);
  const cancel = () => { setText(richHtmlOf(a.body || '')); setNoteType(noteTypeOf(a)); setEditing(false); };
  const save = () => { const body = sanitizeRichText(text), changed = body !== sanitizeRichText(richHtmlOf(a.body || ''));
    onUpdate(a.id, {...(changed ? noteEditPatch(a, body, contact) : {}), ...noteTypePatch(noteType), ...withMentions(a, tagged(a.body, body))}); setEditing(false); };
  const dirty = !richIsEmpty(text) && (sanitizeRichText(text) !== sanitizeRichText(richHtmlOf(a.body || '')) || noteType !== noteTypeOf(a));
  return (
    <DetailFrame editing={editing} head={detailHead(a, contact, across)} actions={editing ? saveBar(cancel, save, dirty)
      : activityEditBar(a, ()=>setEditing(true), detailMenu({a, onUpdate, onStub, own:[stubItem('Copy Note', onStub, 'copy')], runProfile:true, deleteLabel:'Delete Note'}))}>
      <div style={{display:'flex', flexDirection:'column', gap:12}}>
        {!editing && <NoteTypeTag a={a}/>}
        {/* A HubSpot note keeps its type. */}
        {editing && noteTypeOf(a) !== 'hubspot' && <Field label="Note Type" required><NoteTypeRadios name={`note-type-${a.id}`} value={noteType} onChange={setNoteType}/></Field>}
        {!editing && recordFirst(across)}
        {/* A note saved from a call keeps that context. */}
        {!editing && a.callId && <div style={{fontSize:12, color:T.attioMuted}}>Linked to call{call ? ` · ${fmtActStamp(call.at)}` : ''}</div>}
        {!editing && a.meetingId && <div style={{fontSize:12, color:T.attioMuted}}>Linked to meeting{meeting ? ` · ${fmtActStamp(meeting.at)}` : ''}</div>}
        {!editing && a.taskId && <div style={{fontSize:12, color:T.attioMuted}}>Linked to task{task && task.title ? ` · ${task.title}` : ''}</div>}
        {editing
          ? <><div data-mentions="1"><RichTextEditor value={text} onChange={setText} minHeight={180} ariaLabel="Note"/></div></>
          : <RichTextView html={a.body} mentions={users} style={{fontSize:13.5, lineHeight:1.65}}/>}
        {!editing && <NoteEdited n={a} contact={contact}/>}
        {!editing && personLed(across) && stack(recordFields(across))}
        {!editing && across && timeStampField(a.at)}
        {!editing && <NoteReplies a={a} onUpdate={onUpdate} canReply={!ra || canAdd(ra.object, ra.record, 'Note')} canRemove={canNote('delete')}/>}
      </div>
    </DetailFrame>
  );
}

/* A call's, meeting's or task's Notes (Notes (n) under its details): every note linked to it
   (callId / meetingId / taskId), oldest first, each with its author, time and its own ⋯ (Edit Note,
   Delete Note). + opens a box to add one. They're ordinary Notes, so the Notes tab shows them
   too; logging a call or meeting, or adding a task, doesn't ask for one. Adding, editing and deleting follow the
   record's Notes permissions. `own`: an older call's own notes (its `body`), shown first and
   following the call's permissions. */
const fmtNoteStamp = (at) => fmtActStamp(new Date(at));
function ActivityNoteItem({n, contact, canEdit, canDelete, onSave, onDelete}){
  const hub = useRecordHub();
  const users = React.useMemo(() => hub ? mentionUsers(hub.data) : [], [hub && hub.data.users]);
  const [editing, setEditing] = React.useState(false);
  const [text, setText] = React.useState('');
  const [confirm, setConfirm] = React.useState(false);
  const person = activityActor(n, contact);
  const menu = [
    ...(canEdit ? [{label:'Edit Note', icon:'edit', onClick:()=>{ setText(n.body || ''); setEditing(true); }}] : []),
    ...(canDelete ? [{label:'Delete Note', icon:'trash', danger:true, onClick:()=>setConfirm(true)}] : []),
  ];
  return (
    <div style={{display:'flex', flexDirection:'column', gap:6}}>
      {confirm && <StModal title="Delete Note" primary="Delete Note" danger onCancel={()=>setConfirm(false)}
        onSubmit={()=>{ setConfirm(false); onDelete(); }}>
        <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>This removes it from the record. It can't be undone.</div>
      </StModal>}
      <div style={{display:'flex', alignItems:'center', gap:8, minHeight:30}}>
        <div style={{flex:1, minWidth:0, display:'flex', alignItems:'center', gap:6, fontSize:13, color:T.attioMuted}}>
          {person && <PersonAvatar kind={person.kind} name={person.name}/>}
          {person && <PersonName kind={person.kind} name={person.name}/>}
          <span style={{fontSize:11.5, whiteSpace:'nowrap'}}>{fmtNoteStamp(n.at)}</span>
        </div>
        {!editing && menu.length > 0 && <DetailMoreMenu items={menu}/>}
      </div>
      {editing
        ? <div style={{display:'flex', flexDirection:'column', gap:8}}>
            {/* Edited as written — its formatting kept (a rich-text note, as on the Notes tab). */}
            <div data-mentions="1"><RichTextEditor value={text} onChange={setText} minHeight={90} ariaLabel="Note"/></div>
            <div style={{display:'flex', justifyContent:'flex-end', gap:8}}>
              {saveBar(()=>setEditing(false), ()=>{ onSave(sanitizeRichText(text)); setEditing(false); }, !richIsEmpty(text) && text !== (n.body || ''))}
            </div>
          </div>
        : <><RichTextView html={n.body} mentions={users} style={{fontSize:13, lineHeight:1.55, color:T.attioText}}/><NoteEdited n={n} contact={contact}/></>}
    </div>
  );
}
function ActivityNotes({a, contact, notes, link, onUpdate, onAdd, own}){
  const ra = useRecordAccess(), del = useActivityDelete();
  const intent = React.useContext(DetailIntentCtx);
  const [adding, setAdding] = React.useState(intent === 'note');
  const [text, setText] = React.useState('');
  const can = (x, action) => !ra || activityCan(ra.object, ra.record, x, action);
  const canAddNote = !ra || canAdd(ra.object, ra.record, 'Note');
  const list = [...(own ? [own] : []), ...[...notes].sort((x, y) => new Date(x.at) - new Date(y.at))];
  const tagged = useMentionNotify();
  const add = () => { const body = text.trim(); onAdd({id:newId('note'), type:'note', source:'you', by:null, body, [link]:a.id, ...withMentions(null, tagged('', body))}); setText(''); setAdding(false); };
  return (
    <div style={{marginTop:20, paddingTop:20, borderTop:`1px solid ${T.border}`, display:'flex', flexDirection:'column', gap:14}}>
      <div style={{display:'flex', alignItems:'center', gap:8}}>
        <span style={{fontSize:14, fontWeight:600, color:T.attioText}}>Notes ({list.length})</span>
        {canAddNote && <button title="Add note" aria-label="Add note" onClick={()=>setAdding(true)} style={{...btnSecondarySm, padding:'5px 7px'}}>
          <Icon name="plus" size={13} color={T.attioText}/>
        </button>}
      </div>
      {adding && <div data-mentions="1" style={{display:'flex', flexDirection:'column', gap:8}}>
        <textarea autoFocus value={text} onChange={e=>setText(e.target.value)} rows={3} placeholder="Add a note" aria-label="Note" style={{...fieldText, resize:'vertical', lineHeight:1.5}}/>
        <div style={{display:'flex', justifyContent:'flex-end', gap:8}}>
          <button onClick={()=>{ setText(''); setAdding(false); }} style={btnSecondarySm}>Cancel</button>
          <button onClick={add} disabled={!text.trim()} style={btnPrimarySm(!!text.trim())}>Add Note</button>
        </div>
      </div>}
      {list.map(n => n === own
        ? <ActivityNoteItem key="own" n={{...a, body:a.body}} contact={contact} canEdit={can(a, 'edit')} canDelete={can(a, 'delete')}
            onSave={body=>onUpdate(a.id, {body})} onDelete={()=>onUpdate(a.id, {body:''})}/>
        : <ActivityNoteItem key={n.id} n={n} contact={contact} canEdit={can(n, 'edit')} canDelete={can(n, 'delete')}
            onSave={body=>onUpdate(n.id, {...noteEditPatch(n, body, contact), ...withMentions(n, tagged(n.body, body))})} onDelete={()=>del && del(n)}/>)}
      {!list.length && !adding && <div style={{fontSize:13, color:T.attioMuted}}>No notes yet</div>}
    </div>
  );
}
// A meeting's link, opened in a new tab.
const meetingHref = (url) => /^https?:\/\//i.test(url) ? url : `https://${url}`;

/* A Call back request's date and time (Log Call, a call log's edit, a workflow's Log Call): both asked, and still to come. */
function CallBackFields({value, onChange}){
  const set = (p) => onChange({...value, ...p});
  return (<>
    <Field label="Call Back Date" required><DateField required value={value.date} onChange={v=>set({date:v})} ariaLabel="Call back date"/></Field>
    <Field label="Call Back Time" required><TimeField required value={value.time} onChange={v=>set({time:v})} ariaLabel="Call back time"/></Field>
    {value.date && value.time && !callBackReady(value) && <div style={{fontSize:12, color:T.red}}>Choose a date and time that haven't passed.</div>}
  </>);
}
/* Connected, not qualified (2026-11-20): its Not Qualified Reason (Log Call, a call log's edit, a
   workflow's Log Call) — the Lead property's options as Settings → Properties has them
   (dataModel.jsx `notQualifiedReason`). `data`: the settings, where the record hub isn't at hand. */
const notQualifiedReasonOptions = (data) => { const p = ((data && data.properties) || []).find(x => x.objectId === 'contacts' && x.key === 'notQualifiedReason');
  return p && (p.options || []).length ? p.options : NOT_QUALIFIED_REASONS; };
function NotQualifiedReasonField({value, onChange, data}){
  const hub = useRecordHub();
  return <Field label="Not Qualified Reason" required><Select value={value} options={notQualifiedReasonOptions(data || (hub && hub.data))} placeholder="Select reason" onChange={onChange} ariaLabel="Not Qualified Reason"/></Field>;
}
/* The reason goes on the lead — the record the call is on (`on`: {object, record}), or a deal's or
   customer's person (its first lead); none: nothing. Through the record's own update
   (hub.updateRecord), so it's kept as a Property change. */
const setLeadNotQualified = (hub, on, reason) => {
  if(!hub || !hub.updateRecord || !on || !on.record || !reason) return;
  const leadId = on.object === 'contacts' ? on.record.id : personIdOf(on.record);
  const lead = leadId == null ? null : ((hub.records && hub.records.contacts) || []).find(c => String(c.id) === String(leadId));
  if(lead && lead.notQualifiedReason !== reason) hub.updateRecord('contacts', lead.id, {notQualifiedReason:reason});
};
/* A call: "Call" (made through the system — its person and outcome are the real record and
   stay fixed) or "Call log" (entered by hand — person and outcome editable). Its Notes follow
   the details (ActivityNotes). */
/* `across`: {object, record} when calls from different records are shown together (Tools →
   Calls) — the record leads: "Call to [Record]", and the details add its name and type. */
function CallDetail({a, contact, team, comments, onUpdate, onAdd, onStub, across}){
  const hub = useRecordHub(), ra = useRecordAccess();
  const blank = () => ({type:callTypeOf(a), poc:callPocValue(a, contact), outcome:a.outcome, reason:a.notQualifiedReason || null});
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
      // Connected, not qualified: its reason, on the call; under another outcome the call keeps none.
      if(notQualified ? reasonChanged : a.notQualifiedReason) patch.notQualifiedReason = notQualified ? d.reason : null;
    }
    if(Object.keys(patch).length) onUpdate(a.id, patch);
    // …and on the lead (setLeadNotQualified).
    if(notQualified && (reasonChanged || d.outcome !== a.outcome)) setLeadNotQualified(hub, ra, d.reason);
    // Changed to Call back request: its task, for when they said (activities.jsx callBackTask).
    if(asksBack) onAdd({id:newId('task'), source:'you', by:null, ...callBackTask(contact && contact.name, d.poc || callPocValue(a, contact), back, a.id)});
    setBack({date:'', time:''}); setEditing(false);
  };
  const [back, setBack] = React.useState({date:'', time:''});
  const asksBack = a.logged && d.outcome === CALL_BACK_OUTCOME && a.outcome !== CALL_BACK_OUTCOME;
  // Connected, not qualified: its Not Qualified Reason is asked (the call's own, to start with).
  const notQualified = a.logged && d.outcome === CALL_NOT_QUALIFIED_OUTCOME;
  const reasonChanged = notQualified && (d.reason || null) !== (a.notQualifiedReason || null);
  // Save only once something has actually changed — the same rule for every detail.
  const dirty = a.logged && !!d.outcome && ((d.poc && placed(d)) || d.outcome !== a.outcome || reasonChanged) && (!asksBack || callBackReady(back)) && (!notQualified || !!d.reason);
  const record = across && across.record;
  const head = detailHead(a, contact, across);
  return (
    // A call made through the system has nothing to edit (its notes have their own ⋯).
    <DetailFrame editing={editing} head={head} actions={editing ? saveBar(cancel, save, dirty)
      : activityEditBar(a, a.logged ? ()=>{ setD(blank()); setEditing(true); } : null, detailMenu({a, onUpdate, onStub, deleteLabel: a.logged ? 'Delete Call Log' : 'Delete Call'}))}>
      {stack(<>
        {!editing && recordFirst(across)}
        {/* Edit mode shows only what can be edited: call type, point of contact and outcome on
            a call log. */}
        {editing ? (a.logged && <Field label="Call Type" required><Select value={d.type} options={CALL_TYPES} onChange={v=>v && set({type:v})}/></Field>)
                 : <Field label="Call Type"><ReadValue>{callTypeOf(a)}</ReadValue></Field>}
        {/* Tools → Calls is the current user's view: no point of contact there. */}
        {(!across || personLed(across)) && (editing ? (a.logged && <Field label="Point of Contact" required><Select value={d.poc} options={pocOptions(team, contact)} placeholder="Select person" onChange={v=>v && set({poc:v})}/></Field>)
                 : <Field label="Point of Contact"><PersonValue person={callPointOfContact(a, contact)}/></Field>)}
        {!editing && across && !across.hideType && <>
          <Field label="Record Name"><div style={{paddingTop:7, fontSize:13, display:'flex'}}>{record ? <HubRecordLink object={across.object} id={record.id} name={record.name}/> : '—'}</div></Field>
          {!across.hideType && <Field label="Record Type"><ReadValue>{HUB_NOUN[across.object]}</ReadValue></Field>}
        </>}
        {editing ? (a.logged && <Field label="Call Outcome" required><Select value={d.outcome} options={LOG_CALL_OUTCOMES} placeholder="Select outcome" onChange={v=>set({outcome:v})}/></Field>)
                 : <Field label="Call Outcome"><ReadValue>{a.outcome}</ReadValue></Field>}
        {editing && asksBack && <CallBackFields value={back} onChange={setBack}/>}
        {editing ? (notQualified && <NotQualifiedReasonField value={d.reason} onChange={v=>set({reason:v})}/>)
                 : (a.notQualifiedReason && <Field label="Not Qualified Reason"><ReadValue>{a.notQualifiedReason}</ReadValue></Field>)}
        {!editing && across && timeStampField(a.at)}
      </>)}
      {!editing && <ActivityNotes a={a} contact={contact} notes={comments} link="callId" onUpdate={onUpdate} onAdd={onAdd}
        own={ownNotes && String(a.body || '').trim() ? a : null}/>}
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
  const inFooter = React.useContext(DetailFooterCtx), given = React.useContext(DetailPrimaryCtx);
  const primary = inFooter ? given : null, scheduledEdit = !!(primary && primary.what === 'edit');
  const compose = (kind) => !(hub && where) ? onStub(kind === 'replyTo' ? 'Reply' : 'Forward')
    : host ? host.compose({object:where.object, id:where.recordId, [kind]:a}) : hub.composeEmail({object:where.object, id:where.recordId, [kind]:a});
  return (
    // Emails stay read-only; Reply and Forward open the composer.
    <DetailFrame head={detailHead(a, contact, across)} actions={<>
      {/* Under the trail's Follow Up, Reply or Edit (the footer's filled button) no Reply of its own; a scheduled email, not sent yet, isn't forwarded. */}
      {!(primary && ['reply', 'followUp', 'edit'].includes(primary.what)) && headerBtn('Reply', ()=>compose('replyTo'))}
      <DetailMoreMenu items={detailMenu({a, onUpdate, onStub, own: scheduledEdit ? [] : [{label:'Forward Email', icon:'forward', onClick:()=>compose('forward')}], runProfile:true, deleteLabel:'Delete Email'})}/>
    </>}>
      {stack(<>
        {recordFirst(across)}
        {a.status === 'scheduled' && <Field label="Scheduled"><ReadValue>{fmtActStamp(new Date(a.scheduledFor || a.at))}</ReadValue></Field>}
        {thread.length < 2 && a.to && a.to.length > 0 && <Field label="To"><ReadValue>{a.to.join(', ')}</ReadValue></Field>}
        {thread.length < 2 && a.cc && a.cc.length > 0 && <Field label="Cc"><ReadValue>{a.cc.join(', ')}</ReadValue></Field>}
        {thread.length < 2 && a.bcc && a.bcc.length > 0 && <Field label="Bcc"><ReadValue>{a.bcc.join(', ')}</ReadValue></Field>}
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

/* An email log (Log Email): an email outside the CRM, entered by hand — so, as a call log, its
   email type, point of contact, subject and content are editable (an email through the CRM stays
   read-only, with Reply and Forward). */
function EmailLogDetail({a, contact, team, onUpdate, onStub, across}){
  const blank = () => ({type:emailTypeOf(a), poc:callPocValue(a, contact), title:a.title || '', body:a.body || ''});
  const [editing, setEditing] = React.useState(false);
  const [d, setD] = React.useState(blank);
  const set = (p) => setD(x => ({...x, ...p}));
  const cancel = () => { setD(blank()); setEditing(false); };
  const orig = blank(), placed = d.type !== orig.type || d.poc !== orig.poc;
  const save = () => { onUpdate(a.id, {...(d.poc && placed ? emailPatch(d.type, d.poc) : {}), title:d.title.trim(), body:d.body.trim()}); setEditing(false); };
  // Save only once something has actually changed — the same rule for every detail.
  const dirty = !!d.title.trim() && !!d.body.trim() && ((d.poc && placed) || d.title.trim() !== orig.title || d.body.trim() !== orig.body);
  return (
    <DetailFrame editing={editing} head={detailHead(a, contact, across)} actions={editing ? saveBar(cancel, save, dirty)
      : activityEditBar(a, ()=>{ setD(blank()); setEditing(true); }, detailMenu({a, onUpdate, onStub, runProfile:true, deleteLabel:'Delete Email Log'}))}>
      {stack(<>
        {!editing && recordFirst(across)}
        <Field label="Email Type" required={editing}>{editing ? <Select value={d.type} options={EMAIL_TYPES} onChange={v=>v && set({type:v})}/> : <ReadValue>{emailTypeOf(a)}</ReadValue>}</Field>
        {/* A Tools page from the current user's side: no point of contact there (as a call log). */}
        {(!across || personLed(across)) && <Field label="Point of Contact" required={editing}>{editing
          ? <Select value={d.poc} options={pocOptions(team, contact)} placeholder="Select person" onChange={v=>v && set({poc:v})}/>
          : <PersonValue person={callPointOfContact(a, contact)}/>}</Field>}
        <Field label="Subject" required={editing}>{editing ? <input value={d.title} onChange={e=>set({title:e.target.value})} style={fieldText}/> : <ReadValue>{a.title}</ReadValue>}</Field>
        <Field label="Content" required={editing}>{editing
          ? <textarea value={d.body} onChange={e=>set({body:e.target.value})} rows={8} style={{...fieldText, resize:'vertical', lineHeight:1.5}}/>
          : <ReadValue>{a.body}</ReadValue>}</Field>
        {!editing && personLed(across) && recordFields(across)}
        {!editing && across && timeStampField(a.at)}
      </>)}
    </DetailFrame>
  );
}

// Its Notes (linked by taskId) follow the details (ActivityNotes), as a call's and a meeting's.
function TaskDetail({a, contact, team, comments = [], onUpdate, onAdd, onStub, across}){
  const hub = useRecordHub();
  const blank = () => ({title:a.title || '', description:a.description || '', pipelineId:taskPipelineIdOf(a), status:a.status, taskType:taskTypeOf(a), assignee:a.assignee, dueDate:taskDueParts(a).date, dueTimeOfDay:taskDueParts(a).time, allowedMin:a.allowedMin || null});
  const [editing, setEditing] = React.useState(false);
  const [d, setD] = React.useState(blank);
  const set = (p) => setD(x => ({...x, ...p}));
  const cancel = () => { setD(blank()); setEditing(false); };
  const save = () => { const {dueDate, dueTimeOfDay, allowedMin, ...rest} = d;
    onUpdate(a.id, withTaskStart(a, {...rest, ...taskDueValue(dueDate, dueTimeOfDay), allowedMin:allowedMin || undefined, title:d.title.trim(), description:d.description.trim()}));
    // A new assignee is kept in the record's history (Task reassigned: from → to).
    if(hub && d.assignee !== a.assignee){ const [object, id] = a.customerId != null ? ['customers', a.customerId] : a.dealId != null ? ['deals', a.dealId] : ['contacts', a.contactId];
      hub.add(object, id, {type:'taskReassigned', taskId:a.id, taskTitle:d.title.trim(), from:a.assignee || null, to:d.assignee || null, source:'you', by:CURRENT_USER.name}); }
    setEditing(false); };
  const orig = blank();
  const dirty = Object.keys(d).some(k => (typeof d[k] === 'string' ? d[k].trim() : d[k]) !== orig[k]);
  // The next steps for an open task, by its status (Overdue is its date, not a status: the steps stay).
  const ra = useRecordAccess(), canEdit = !ra || activityCan(ra.object, ra.record, a, 'edit');
  const steps = !canEdit || !isTaskOpen(a) ? [] : [
    ...(a.status === 'notStarted' ? [['Start', 'inProgress']] : []),
    ...(a.status === 'onHold' ? [['Resume', 'inProgress']] : [['Put on Hold', 'onHold']]),
    ['Complete', 'completed']];
  return (
    <DetailFrame editing={editing} head={activityHead(a, contact)} actions={editing ? saveBar(cancel, save, !!d.title.trim() && !!d.dueDate && dirty)
      : <>{steps.map(([label, status]) => <React.Fragment key={label}>{headerBtn(label, ()=>onUpdate(a.id, withTaskStart(a, {status})))}</React.Fragment>)}
        {activityEditBar(a, ()=>{ setD(blank()); setEditing(true); }, detailMenu({a, onUpdate, onStub, own:[stubItem('Reassign Task', onStub, 'userSwitch'), stubItem('Copy Task Description', onStub, 'copy')], deleteLabel:'Delete Task'}))}</>}>
      {stack(<>
        {!editing && recordFirst(across)}
        {/* Its type first, as its tag (2026-11-23). */}
        {!editing && <Field label="Task Type"><div style={{paddingTop:6, display:'flex', gap:8}}><TaskTypeTag a={a}/>{isOverdue(a) && <TaskDueTag/>}</div></Field>}
        <Field label="Task Name" required={editing}>{editing ? <input value={d.title} onChange={e=>set({title:e.target.value})} style={fieldText}/> : <ReadValue>{a.title}</ReadValue>}</Field>
        <Field label="Description">{editing
          ? <textarea value={d.description} onChange={e=>set({description:e.target.value})} rows={3} style={{...fieldText, resize:'vertical', lineHeight:1.5}}/>
          : <ReadValue>{a.description}</ReadValue>}</Field>
        <Field label="Status" required={editing}>{editing ? <TaskStatusRadios name={`status-${a.id}`} pipelineId={d.pipelineId} value={d.status} overdue={d.status !== 'completed' && isPastDue(taskDueValue(d.dueDate, d.dueTimeOfDay))} onChange={v=>set({status:v})}/>
          : <span style={{fontSize:13, paddingTop:7, display:'block', color: taskState(a) === 'overdue' ? T.red : T.attioText}}>{taskStateLabel(a)}<TaskTimeLeft a={a} style={{marginLeft:10}}/></span>}</Field>
        {editing && <Field label="Task Type" required><TaskTypeRadios name={`type-${a.id}`} value={d.taskType} onChange={v=>set({taskType:v})}/></Field>}
        <Field label="Assigned to" required={editing}>{editing ? <Select value={d.assignee} options={team} placeholder="Select person" onChange={v=>v && set({assignee:v})}/> : <ReadValue>{a.assignee}</ReadValue>}</Field>
        {editing ? <TaskDueFields date={d.dueDate} time={d.dueTimeOfDay} onChange={(date, time)=>set({dueDate:date, dueTimeOfDay:time})}/>
          : <Field label="Due">{a.due ? <ReadValue>{fmtTaskDue(a)}{isOverdue(a) ? ' · Due date passed' : ''}</ReadValue> : <ReadValue>No due date</ReadValue>}</Field>}
        {editing ? <TaskTimeAllowedField value={d.allowedMin} onChange={(v)=>set({allowedMin:v})}/>
          : a.allowedMin > 0 && <Field label="Time Allowed"><ReadValue>{taskTimeLabel(a.allowedMin)}</ReadValue></Field>}
        {!editing && <Field label="Assigned by"><PersonValue person={activityActor(a, contact)}/></Field>}
      </>)}
      {!editing && onAdd && <ActivityNotes a={a} contact={contact} notes={comments} link="taskId" onUpdate={onUpdate} onAdd={onAdd}/>}
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
const linkBtn = {border:'none', background:'transparent', padding:'7px 0 0', fontSize:13, fontFamily:'inherit', color:T.attioText, cursor:'pointer'};   // with LINK_CLASS
// Read transcript (with its times) or Add transcript (a text box, saved as the meeting's transcript).
function MeetingTranscript({a, onUpdate}){
  const [open, setOpen] = React.useState(null);   // 'read' | 'add'
  const [text, setText] = React.useState('');
  const has = !!String(a.transcript || '').trim();
  const close = () => { setOpen(null); setText(''); };
  const lines = open === 'read' ? parseTranscript(a.transcript) : [];
  return (<>
    <button onClick={()=>setOpen(has ? 'read' : 'add')} className={LINK_CLASS} style={linkBtn}>{has ? 'Read Transcript' : 'Add Transcript'}</button>
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
      <StModal title="Add Transcript" width={600} primary="Save" canSubmit={!!text.trim()} onCancel={close}
        onSubmit={()=>{ onUpdate(a.id, {transcript:text.trim()}); close(); }}>
        <textarea autoFocus value={text} onChange={e=>setText(e.target.value)} rows={12} aria-label="Transcript"
          placeholder={'00:00 Name: What was said\n00:42 Name: …'} style={{...fieldText, resize:'vertical', lineHeight:1.55}}/>
      </StModal>, document.body)}
  </>);
}

/* A meeting: "Meeting" (started / scheduled through the system — not defined yet; only its link
   editable) or "Meeting log" (an online meeting — Google Meet, Zoom, … — logged by hand:
   organiser, platform, title and link editable). Always organised by an internal team member.
   Its Notes (linked by meetingId) follow the details (ActivityNotes). */
function MeetingDetail({a, contact, team, comments, onUpdate, onAdd, onStub, across}){
  const blank = () => ({organiser:a.by || null, platform:a.platform || null, title:a.title || '', link:a.link || ''});
  const [editing, setEditing] = React.useState(false);
  const [d, setD] = React.useState(blank);
  const set = (p) => setD(x => ({...x, ...p}));
  const orig = blank();
  // A logged meeting keeps its platform and title (required).
  const dirty = (!a.logged || (!!d.platform && !!d.title.trim())) && ((a.logged && (d.organiser !== orig.organiser || d.platform !== orig.platform || d.title.trim() !== orig.title))
    || d.link.trim() !== orig.link);
  const cancel = () => { setD(blank()); setEditing(false); };
  const save = () => {
    const patch = {};
    if(a.logged){
      if(d.organiser && d.organiser !== a.by) Object.assign(patch, {source:'team', by:d.organiser});
      if(d.platform !== a.platform) patch.platform = d.platform;
      if(d.title.trim() && d.title.trim() !== a.title) patch.title = d.title.trim();
    }
    if(d.link.trim() !== (a.link || '')) patch.link = d.link.trim();
    if(Object.keys(patch).length) onUpdate(a.id, patch);
    setEditing(false);
  };
  const teamOptions = team.map(n => ({value:n, label: n === contact.owner ? `${n} (Owner)` : n}));
  /* Reschedule (2026-11-18): a scheduled meeting still to come moves to another date and
     time — "Meeting rescheduled" on the record's trail keeps where it was. */
  const ra = useRecordAccess();
  const canMove = !a.logged && a.status === 'scheduled' && new Date(a.scheduledFor || a.at).getTime() > Date.now() && (!ra || activityCan(ra.object, ra.record, a, 'edit'));
  const whenParts = () => { const z = zonedParts(new Date(a.scheduledFor || a.at)), p = (n) => String(n).padStart(2, '0'); return {date:`${z.y}-${p(z.m + 1)}-${p(z.d)}`, time:`${p(z.h)}:${p(z.mi)}`}; };
  const [moving, setMoving] = React.useState(null);   // {date, time} while rescheduling
  const movedTo = moving && moving.date && moving.time ? taskDueValue(moving.date, moving.time).due : null;
  const moveOk = !!movedTo && new Date(movedTo).getTime() > Date.now() && new Date(movedTo).getTime() !== new Date(a.scheduledFor || a.at).getTime();
  const saveMove = () => {
    const from = new Date(a.scheduledFor || a.at);
    onUpdate(a.id, {at:movedTo, scheduledFor:movedTo, completedNotified:false});
    onAdd({id:newId('resched'), type:'meetingRescheduled', meetingId:a.id, title:a.title || 'Meeting', from, to:movedTo, source:'you', by:CURRENT_USER.name});
    setMoving(null);
  };
  return (
    <DetailFrame editing={editing || !!moving} head={detailHead(a, contact, across)} actions={editing ? saveBar(cancel, save, dirty)
      : moving ? saveBar(()=>setMoving(null), saveMove, moveOk)
      : <>{canMove && headerBtn('Reschedule', ()=>setMoving(whenParts()))}{activityEditBar(a, ()=>{ setD(blank()); setEditing(true); }, detailMenu({a, onUpdate, onStub, deleteLabel: a.logged ? 'Delete Meeting Log' : 'Delete Meeting'}))}</>}>
      {!editing && !moving && a.officeRequest && <OfficeRequestBlock a={a} onUpdate={onUpdate}/>}
      {moving && stack(<>
        <Field label="Date" required><DateField required value={moving.date} onChange={v=>setMoving(m => ({...m, date:v}))} ariaLabel="New meeting date"/></Field>
        <Field label="Time" required><TimeField required value={moving.time} onChange={v=>setMoving(m => ({...m, time:v}))} ariaLabel="New meeting time"/></Field>
      </>)}
      {!moving && stack(<>
        {!editing && recordFirst(across)}
        {!editing && a.location && <Field label="Location"><ReadValue>{a.location}</ReadValue></Field>}
        {/* Read-only: Title, Platform, Transcript, Time Stamp, Link — the organiser is in the
            header; Notes follow. Edit: organiser, platform, title (logs only) and link. */}
        {!editing && <Field label="Title"><ReadValue>{a.title}</ReadValue></Field>}
        {!editing && (a.attendees || []).length > 0 && <Field label="Attendees"><ReadValue>{attendeesText(a.attendees)}</ReadValue></Field>}
        {editing && a.logged && <Field label="Organizer" required><Select value={d.organiser} options={teamOptions} onChange={v=>v && set({organiser:v})}/></Field>}
        {editing ? (a.logged && <Field label="Platform" required><Select value={d.platform} options={MEETING_PLATFORMS} placeholder="Select platform" onChange={v=>set({platform:v})}/></Field>)
                 : <Field label="Platform"><ReadValue>{a.platform}</ReadValue></Field>}
        {!editing && <Field label="Transcript"><MeetingTranscript a={a} onUpdate={onUpdate}/></Field>}
        {editing && a.logged && <Field label="Title" required><input value={d.title} onChange={e=>set({title:e.target.value})} style={fieldText}/></Field>}
        {editing && <Field label="Link"><input value={d.link} onChange={e=>set({link:e.target.value})} placeholder="Meeting link" style={fieldText}/></Field>}
        {!editing && personLed(across) && recordFields(across)}
        {!editing && <Field label="Time Stamp"><ReadValue>{fmtActStamp(a.at)}</ReadValue></Field>}
        {!editing && a.durationMin > 0 && <Field label="Duration"><ReadValue>{`${a.durationMin} min`}</ReadValue></Field>}
        {!editing && a.description && <Field label="Description"><ReadValue>{a.description}</ReadValue></Field>}
        {!editing && <Field label="Link">{a.link
          ? <div style={{paddingTop:7, fontSize:13, minWidth:0, overflowWrap:'anywhere'}}><a href={meetingHref(a.link)} target="_blank" rel="noopener noreferrer"
              className={LINK_CLASS} style={{color:T.attioText}}>{a.link}</a></div>
          : <ReadValue/>}</Field>}
      </>)}
      {!editing && !moving && <ActivityNotes a={a} contact={contact} notes={comments} link="meetingId" onUpdate={onUpdate} onAdd={onAdd}/>}
    </DetailFrame>
  );
}

/* ── Office meeting requests (2026-11-18) ── a consultant asks a colleague to meet a client at the
   office: Request Office Meeting (a record's Add Meeting) — the colleague (any user), the date,
   time and length, a note. It's a meeting on the record, awaiting approval (`status:'requested'`,
   `officeRequest`), with the office's address (Settings → Meetings → Office Meetings) and no online
   link; the colleague is notified in their bell, which opens it. They Approve or Decline here.
   Approved: the meeting is scheduled; they become a collaborator on the record (view and edit, not
   delete or reassign — usersTeams.jsx permissionCovers); the client is sent an invite with the
   address; the "client is coming" email goes to the people Office Meetings names; the requester is
   notified. Declined: the meeting is cancelled and the requester notified. */
const OFFICE_DURATIONS = [{value:'30', label:'30 min'}, {value:'60', label:'1 hour'}, {value:'90', label:'1 hour 30 min'}, {value:'120', label:'2 hours'}];
const officeWhen = (a) => `${fmtActStamp(new Date(a.scheduledFor || a.at))} (${a.durationMin || 30} min)`;
function OfficeMeetingRequestModal({object, record, onClose}){
  const hub = useRecordHub(), engineCtx = useWorkflowEngineCtx();
  const office = officeMeetingsOf(hub.data);
  const users = (hub.data.users || []).filter(u => u.status === 'Activated' && u.name !== CURRENT_USER.name);
  const [approver, setApprover] = React.useState('');
  const [date, setDate] = React.useState('');
  const [time, setTime] = React.useState('11:00');
  const [duration, setDuration] = React.useState('60');
  const [note, setNote] = React.useState('');
  const at = date ? new Date(`${date}T${time || '09:00'}:00`) : null;
  const ok = !!approver && !!at && at.getTime() > Date.now() && !!office.address.trim();
  const send = () => {
    if(!ok) return;
    const who = users.find(u => u.id === approver);
    const a = hub.add(object, record.id, {type:'meeting', title:`Office meeting · ${record.name}`, at, scheduledFor:at, durationMin:Number(duration), platform:'Office', location:office.address.trim(),
      status:'requested', source:'you', by:CURRENT_USER.name, officeRequest:{approverId:approver, approverName:who ? who.name : '', requestedBy:CURRENT_USER.name, requestedAt:new Date().toISOString(), note:note.trim(), status:'pending'}});
    if(engineCtx && engineCtx.api.notifyUsers) engineCtx.api.notifyUsers([approver], record.name, `${CURRENT_USER.name} asks you to meet ${record.name} at the office on ${fmtActStamp(at)}.${note.trim() ? `\n${note.trim()}` : ''}`, record.id, 'meetings', 'officeRequest');
    hub.toast(`Request sent to ${who ? who.name : 'the approver'}`);
    onClose(a && a.id);
  };
  return ReactDOM.createPortal(
    <StModal title="Request Office Meeting" primary="Send Request" canSubmit={ok} onCancel={()=>onClose()} onSubmit={send} width={520}>
      <div style={{display:'flex', flexDirection:'column', gap:14}}>
        <div><label style={fieldLabel}>Meets the Client<Req/></label>
          <SearchableSelect value={approver} options={users.map(u => ({value:u.id, label:u.name, sub:u.email, search:u.email}))} placeholder="Select a colleague" searchPlaceholder="Search users" onChange={setApprover}/></div>
        <div style={{display:'flex', gap:12}}>
          <div style={{flex:1}}><label style={fieldLabel}>Date<Req/></label><DateField required value={date} onChange={setDate} ariaLabel="Meeting date"/></div>
          <div style={{flex:1}}><label style={fieldLabel}>Time<Req/></label><TimeField required value={time} onChange={setTime} ariaLabel="Meeting time"/></div>
          <div style={{flex:1}}><label style={fieldLabel}>Duration<Req/></label><FormSelect value={duration} options={OFFICE_DURATIONS} onChange={(v)=>v && setDuration(v)}/></div>
        </div>
        <div><label style={fieldLabel}>Office</label>
          <div style={{fontSize:13, color: office.address.trim() ? T.attioText : T.red, lineHeight:1.5}}>{office.address.trim() || 'No office address yet: set it in Settings → Meetings.'}</div></div>
        <div><label style={fieldLabel}>Note</label>
          <textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} placeholder="Anything they should know" style={{...fieldText, resize:'vertical', lineHeight:1.5}}/></div>
        {at && at.getTime() <= Date.now() && <div style={{fontSize:12, color:T.red}}>Choose a date and time that haven't passed.</div>}
      </div>
    </StModal>, document.body);
}
function OfficeRequestBlock({a, onUpdate}){
  const hub = useRecordHub(), engineCtx = useWorkflowEngineCtx(), ra = useRecordAccess();
  const r = a.officeRequest, me = (hub.data.users || []).find(u => u.name === CURRENT_USER.name);
  const mine = !!me && me.id === r.approverId && r.status === 'pending';
  const notify = (ids, text) => engineCtx && engineCtx.api.notifyUsers && engineCtx.api.notifyUsers(ids, ra ? ra.record.name : 'Office meeting', text, ra ? ra.record.id : null, 'meetings', 'officeAnswer');
  const requesterId = ((hub.data.users || []).find(u => u.name === r.requestedBy) || {}).id;
  const approve = () => {
    if(!ra) return;
    const {object, record} = ra, now = new Date().toISOString(), office = officeMeetingsOf(hub.data);
    onUpdate(a.id, {status:'scheduled', officeRequest:{...r, status:'approved', decidedAt:now}});
    // The colleague works the record from now on: a collaborator (view and edit).
    hub.updateRecord(object, record.id, {collaborators:[...new Set([...(record.collaborators || []), r.approverId])]});
    const when = officeWhen(a), esc = (t) => String(t).replace(/[&<>]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;'})[c]);
    // The client's invite: the office's address, no online link.
    if(String(record.email || '').trim()){
      const body = `Dear ${emailFirstName(record.name) || record.name},\n\nWe look forward to meeting you at our office on ${when}.\n\nAddress: ${a.location}\n\n${r.approverName} will meet you there.`;
      hub.add(object, record.id, {type:'email', direction:'sent', status:'sent', title:'Your meeting at our office', body, html:body.split('\n\n').map(p => `<p>${esc(p)}</p>`).join(''),
        to:[String(record.email).trim()], source:'team', by:r.requestedBy, officeMeetingId:a.id});
    }
    // "The client is coming": the people Office Meetings names, by email (and the users in their bell).
    const to = [...(office.notifyUserIds || []).map(id => ((hub.data.users || []).find(u => u.id === id) || {}).email).filter(Boolean),
      ...String(office.notifyEmails || '').split(',').map(x => x.trim()).filter(Boolean)];
    if(to.length){
      const body = `${record.name} is coming to the office on ${when} to meet ${r.approverName}, requested by ${r.requestedBy}.\n\nAddress: ${a.location}${r.note ? `\n\nNote: ${r.note}` : ''}`;
      hub.add(object, record.id, {type:'email', direction:'sent', status:'sent', title:`Client visit: ${record.name} · ${when}`, body, html:body.split('\n\n').map(p => `<p>${esc(p)}</p>`).join(''),
        to, source:'team', by:'System', officeMeetingId:a.id});
      notify(office.notifyUserIds || [], `${record.name} is coming to the office on ${when} to meet ${r.approverName}.`);
    }
    if(requesterId) notify([requesterId], `${r.approverName} approved the office meeting with ${record.name} on ${when}.`);
    hub.toast('Office meeting approved');
  };
  const decline = () => {
    onUpdate(a.id, {status:'cancelled', officeRequest:{...r, status:'declined', decidedAt:new Date().toISOString()}});
    if(requesterId) notify([requesterId], `${r.approverName} declined the office meeting with ${ra ? ra.record.name : 'the client'} on ${officeWhen(a)}.`);
    hub.toast('Office meeting declined');
  };
  const label = r.status === 'pending' ? `Awaiting approval by ${r.approverName}` : r.status === 'approved' ? `Approved by ${r.approverName}` : `Declined by ${r.approverName}`;
  const tone = r.status === 'pending' ? T.attioText : r.status === 'approved' ? T.good : T.red;
  return (
    <div style={{display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', padding:'10px 12px', marginBottom:14, border:`1px solid ${T.border}`, borderRadius:10, background:T.headerBg}}>
      <div style={{flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:2}}>
        <span style={{fontSize:13, fontWeight:500, color:tone}}>Office meeting request · {label}</span>
        <span style={{fontSize:12, color:T.attioMuted}}>Requested by {r.requestedBy}{r.note ? ` · ${r.note}` : ''}</span>
      </div>
      {mine && <><button onClick={decline} style={btnSecondarySm}>Decline</button><button onClick={approve} style={btnPrimarySm(true)}>Approve</button></>}
    </div>
  );
}

/* A stage move, a property change, a customer created from the record, a task reassigned, a payment change or records
   merged into it (each value replaced, before → after): what changed, read-only. */
function HistoryChangeDetail({a, contact}){
  const rows = a.type === 'stageChange' ? [...(isPipelineChange(a) ? [['Previous pipeline', (a.from || {}).pipelineLabel], ['New pipeline', (a.to || {}).pipelineLabel]] : []), ['Previous stage', (a.from || {}).label], ['New stage', (a.to || {}).label]]
    : a.type === 'propertyChange' ? [['Property', a.label], ['Previous value', a.from], ['New value', a.to]]
    : a.type === 'recordsMerged' ? [['Merged records', activityHeadline(a)], ...(a.changes || []).map(c => [c.label, `${c.from || '—'} → ${c.to || '—'}`])]
    : a.type === 'recordsSplit' ? [['Split from', activityHeadline(a)]]
    : a.type === 'customerCreated' ? [['Customer', a.customerName]]
    : a.type === 'payment' ? [['Change', a.action], ...(a.from || a.to ? [['Previous', a.from], ['New', a.to]] : [['Payment', a.detail]])]
    : [['Task', a.taskTitle], ['Previous assignee', a.from], ['New assignee', a.to]];
  return (
    <DetailFrame head={activityHead(a, contact)}>
      {stack(<>{rows.map(([label, value]) => <Field key={label} label={label}><ReadValue>{value || '—'}</ReadValue></Field>)}</>)}
    </DetailFrame>
  );
}
/* The record's story (2026-11-18): what each new activity says when it's opened. */
const FORM_VIA_LABEL = {meta:'Meta Lead Ad', website:'Website', link:'Form link'};
const SEQUENCE_ACTION_LABEL = {enrolled:'Enrolled', exited:'Exited', unsubscribed:'Unsubscribed'};
function StoryDetail({a, contact, acts}){
  const fieldRows = (rows) => rows.filter(([, v]) => v !== undefined).map(([label, value], i) => <Field key={`${label}-${i}`} label={label}><ReadValue>{value === '' || value == null ? '—' : String(value)}</ReadValue></Field>);
  let rows = [], extra = null;
  if(a.type === 'formSubmitted'){
    // Every answer as it was submitted, in the form's order.
    rows = [['Form', a.formName], ['Submitted Through', FORM_VIA_LABEL[a.via] || 'Form'], ...(a.answers || []).map(x => [x.label, x.value])];
  } else if(a.type === 'recordCreated'){
    rows = [['Record', a.name], ['Created Through', a.formName ? `Form · ${a.formName}` : a.viaWorkflow ? 'Workflow' : 'By hand'], ['Created By', a.by || (a.source === 'client' ? 'Client' : '')]];
    // What workflows changed as it was created (within a couple of minutes).
    const t = new Date(a.at).getTime();
    const after = (acts || []).filter(x => x.id !== a.id && (x.type === 'propertyChange' || x.type === 'ownerChange' || x.type === 'stageChange') && x.viaWorkflow
      && new Date(x.at).getTime() >= t && new Date(x.at).getTime() - t <= 2 * 60000).sort((x, y) => new Date(x.at) - new Date(y.at));
    if(after.length) extra = (<>
      <div style={{fontSize:13, fontWeight:600, color:T.attioText, paddingTop:8}}>Changed by Workflows</div>
      {fieldRows(after.map(x => x.type === 'propertyChange' ? [x.label, `${x.from || '—'} → ${x.to || '—'}`]
        : x.type === 'ownerChange' ? ['Owner', `${userLabel(x.from) || 'No owner'} → ${userLabel(x.to) || 'No owner'}`]
        : ['Stage', `${(x.from || {}).label || '—'} → ${(x.to || {}).label || '—'}`]))}
      <div style={{fontSize:12, color:T.attioMuted}}>{[...new Set(after.map(x => x.by).filter(Boolean))].join(', ')}</div>
    </>);
  } else if(a.type === 'dealCreated') rows = [[typeSingular('deals', 'Deal'), a.dealName]];
  else if(a.type === 'duplicateFound') rows = [['Merge Status', a.status], ['Matches', activityHeadline(a)], ['Matched On', (a.on || []).join(', ')]];
  else if(a.type === 'sequence') rows = [['Sequence', a.sequenceName], ['Status', SEQUENCE_ACTION_LABEL[a.action] || a.action], ...(a.reason ? [['Reason', a.reason]] : []), ...(a.emails != null ? [['Emails Scheduled', a.emails]] : [])];
  else if(a.type === 'meetingRescheduled') rows = [['Meeting', a.title], ['Was', a.from ? fmtActStamp(new Date(a.from)) : ''], ['Now', a.to ? fmtActStamp(new Date(a.to)) : '']];
  else if(a.type === 'profile') rows = [['Template', a.formName], ...(a.field ? [['Property', a.field]] : []), ...(a.value !== undefined ? [['Value', a.value]] : [])];
  else if(a.type === 'invoice') rows = [['Invoice', a.number], ['Amount', a.amountText], ['Payment', a.payment], ['Plan', a.planNumber]];
  else if(a.type === 'workflow') rows = [['Workflow', a.title], ...String(a.body || '').split('\n').filter(Boolean).map((l, i) => [i ? '' : 'Steps', l])];
  return (
    <DetailFrame head={activityHead(a, contact)}>
      {stack(<>{fieldRows(rows)}{extra}</>)}
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
    <DetailFrame editing={editing} head={activityHead(a, contact)} actions={editing ? saveBar(cancel, save, !!owner && owner !== contact.owner) : editBar(()=>{ setOwner(contact.owner || null); setEditing(true); })}>
      {stack(<>
        {editing
          ? <Field label="Reassign Owner" required><Select value={owner} options={team} placeholder="Select owner" onChange={setOwner}/></Field>
          : <>
              <Field label="Previous Owner"><ReadValue>{userLabel(a.from)}</ReadValue></Field>
              <Field label="New Owner"><ReadValue>{userLabel(a.to)}</ReadValue></Field>
            </>}
      </>)}
    </DetailFrame>
  );
}

function ActivityDetail({a, contact, team, acts, onUpdate, onAdd, onStub, onReassign, across}){
  if(a.type === 'call') return <CallDetail a={a} contact={contact} team={team} comments={acts.filter(n => n.type === 'note' && n.callId === a.id)} onUpdate={onUpdate} onAdd={onAdd} onStub={onStub} across={across}/>;
  if(a.type === 'meeting') return <MeetingDetail a={a} contact={contact} team={team} comments={acts.filter(n => n.type === 'note' && n.meetingId === a.id)} onUpdate={onUpdate} onAdd={onAdd} onStub={onStub} across={across}/>;
  if(a.type === 'email') return a.logged ? <EmailLogDetail a={a} contact={contact} team={team} onUpdate={onUpdate} onStub={onStub} across={across}/>
    : <EmailDetail a={a} contact={contact} acts={acts} onStub={onStub} onUpdate={onUpdate} across={across}/>;
  if(a.type === 'task') return <TaskDetail a={a} contact={contact} team={team} comments={acts.filter(n => n.type === 'note' && n.taskId === a.id)} onUpdate={onUpdate} onAdd={onAdd} onStub={onStub} across={across && across.hideType ? across : undefined}/>;
  if(a.type === 'note') return <NoteDetail a={a} contact={contact} calls={acts.filter(x => x.type === 'call' || x.type === 'meeting' || x.type === 'task')} onUpdate={onUpdate} onStub={onStub} across={across}/>;
  if(a.type === 'ownerChange') return <OwnerChangeDetail a={a} contact={contact} team={team} onReassign={onReassign}/>;
  if(['stageChange', 'propertyChange', 'customerCreated', 'taskReassigned', 'payment', 'recordsMerged', 'recordsSplit'].includes(a.type)) return <HistoryChangeDetail a={a} contact={contact}/>;
  if(a.type === 'file') return <FileActivityDetail a={a} contact={contact} onStub={onStub}/>;
  if(a.type === 'fileChange') return <FileChangeDetail a={a} contact={contact}/>;
  if(a.type === 'quote') return <QuoteActivityDetail a={a} contact={contact}/>;
  if(a.type === 'document') return <DocumentActivityDetail a={a} contact={contact}/>;
  if(['formSubmitted', 'recordCreated', 'dealCreated', 'duplicateFound', 'sequence', 'meetingRescheduled', 'profile', 'invoice', 'workflow'].includes(a.type)) return <StoryDetail a={a} contact={contact} acts={acts}/>;
  return null;
}

/* A task's due date (required, 2026-11-23) and, optionally, a time on it. */
function TaskDueFields({date, time, onChange}){
  return (<>
    <Field label="Due Date" required><DateField value={date} onChange={(v)=>onChange(v, v ? time : '')} ariaLabel="Due date"/></Field>
    <Field label="Due Time"><div style={{opacity: date ? 1 : .5, pointerEvents: date ? 'auto' : 'none'}}>
      <TimeField value={time} onChange={(v)=>onChange(date, v)} ariaLabel="Due time"/></div></Field>
  </>);
}
/* A task's Time Allowed (`allowedMin`, minutes; null when not set) — after Due Time on the new
   task's form and the task's edit form. */
function TaskTimeAllowedField({value, onChange}){
  return <Field label="Time Allowed"><Select value={value} options={TASK_TIME_OPTIONS} placeholder="Select time" onChange={onChange} ariaLabel="Time allowed"/></Field>;
}
// Re-renders once a minute while `on` (something that counts minutes is showing).
function useMinuteTick(on){
  const [, setTick] = React.useState(0);
  React.useEffect(() => { if(!on) return; const t = setInterval(() => setTick(n => n + 1), 60000); return () => clearInterval(t); }, [on]);
}
// How an In Progress task stands against its Time Allowed: "25 min left" (muted), "Over time · 10 min" (red); else nothing.
function TaskTimeLeft({a, style}){
  const st = taskTimeState(a);
  useMinuteTick(!!st);
  return st ? <span style={{color: st.over ? T.red : T.attioMuted, ...style}}>{st.label}</span> : null;
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
/* Every creation panel opens in the same place (ContentSidePanel); `placement` and `more` are
   kept for their callers but no longer change it (the footer's ⋯ stub is gone). Escape closes it.
   `headerActions`: controls beside the close button (a Payment Plan's Freeze Plan). */
function CreatePanelFrame({title, onClose, top, children, actions, placement, width = CREATE_PANEL_W, flush = false, more, zIndex, headerActions}){
  useEscapeClose(onClose);
  return (
    <ContentSidePanel width={width} zIndex={zIndex} style={{background:'#fff', borderLeft:`1px solid ${T.border}`, boxShadow:'-8px 0 24px rgba(16,24,40,.08)', display:'flex', flexDirection:'column'}}>
      <div style={{display:'flex', alignItems:'center', gap:10, padding:'16px 20px', borderBottom:`1px solid ${T.border}`, flexShrink:0}}>
        <span style={{flex:1, minWidth:0, fontSize:15, fontWeight:600, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{title}</span>
        {headerActions}
        <button title="Close" onClick={onClose} style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:4}}><Icon name="close" size={14} color={T.gray600}/></button>
      </div>
      {top && <div style={{padding:'16px 20px', borderBottom:`1px solid ${T.border}`, flexShrink:0}}>{top}</div>}
      {flush ? <div style={{flex:1, minHeight:0, display:'flex'}}>{children}</div>
        : <div style={{flex:1, minHeight:0, overflowY:'auto', padding:'20px'}}>{children}</div>}
      <div style={{display:'flex', alignItems:'center', justifyContent:'flex-end', gap:8, padding:'12px 20px', borderTop:`1px solid ${T.border}`, flexShrink:0}}>
        {actions}
      </div>
    </ContentSidePanel>
  );
}
// The record a new activity is for (Tools pages): Record Type, then the record.
function CreateRecordField({value, onChange}){
  return (
    <Field label="Record Type" wide required><RecordPicker value={value} onChange={onChange}/></Field>
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
/* Note Type first (2026-11-23): General to start with, Client Request or Support — radios.
   @tags in it notify and email the people tagged (noteTools.jsx). */
function NewNote({onAdd, onDone}){
  const [html, setHtml] = React.useState('');
  const [noteType, setNoteType] = React.useState('general');
  const tagged = useMentionNotify();
  return (
    <NewItemPanel title="Add Note" primary="Add Note" canSave={!richIsEmpty(html)} onCancel={()=>onDone(null)}
      onSave={()=>{ const id = newId('note'), body = sanitizeRichText(html);
        onAdd({id, type:'note', source:'you', by:null, body, ...noteTypePatch(noteType), ...withMentions(null, tagged('', body, 'a note'))}); onDone(id); }}>
      <Field label="Note Type" required><NoteTypeRadios name="note-type-new" value={noteType} onChange={setNoteType}/></Field>
      <Field label="Note" required><div data-mentions="1"><RichTextEditor value={html} onChange={setHtml} placeholder="Write a note" minHeight={180} ariaLabel="Note"/></div></Field>
    </NewItemPanel>
  );
}

/* `fixedPoc`: the point of contact, not asked for (Tools → Calls logs the current user's calls). */
function NewLogCall({contact, team, onAdd, onDone, fixedPoc}){
  const [type, setType] = React.useState(null);
  // The point of contact (the call's responsible person): the record owner unless another is picked.
  const [poc, setPoc] = useOwnerDefault(contact, team, fixedPoc);
  const [outcome, setOutcome] = React.useState(null);
  const [back, setBack] = React.useState({date:'', time:''});   // Call back request: when to call back
  const asksBack = outcome === CALL_BACK_OUTCOME;
  const [reason, setReason] = React.useState(null);   // Connected, not qualified: its Not Qualified Reason
  const notQualified = outcome === CALL_NOT_QUALIFIED_OUTCOME;
  const hub = useRecordHub(), ra = useRecordAccess();
  const ok = !!type && !!poc && !!outcome && (!asksBack || callBackReady(back)) && (!notQualified || !!reason);
  const save = () => {
    const id = newId('call');
    onAdd({id, type:'call', logged:true, outcome, ...(notQualified ? {notQualifiedReason:reason} : {}), durationMin:0, body:'', ...callPatch(type, poc)});
    if(asksBack) onAdd({id:newId('task'), source:'you', by:null, ...callBackTask(contact && contact.name, poc, back, id)});
    // The reason goes on the lead too (setLeadNotQualified).
    if(notQualified) setLeadNotQualified(hub, ra, reason);
    onDone(id);
  };
  return (
    <NewItemPanel title="Log Call" canSave={ok} onSave={save} onCancel={()=>onDone(null)}>
      <Field label="Call Type" required><Select value={type} options={CALL_TYPES} placeholder="Select call type" onChange={setType}/></Field>
      {!fixedPoc && <Field label="Point of Contact" required><PersonPicker value={poc} team={team} contact={contact} onChange={setPoc}/></Field>}
      <Field label="Call Outcome" required><Select value={outcome} options={LOG_CALL_OUTCOMES} placeholder="Select outcome" onChange={setOutcome}/></Field>
      {asksBack && <CallBackFields value={back} onChange={setBack}/>}
      {notQualified && <NotQualifiedReasonField value={reason} onChange={setReason}/>}
    </NewItemPanel>
  );
}

/* Log Email — an email sent or received outside the CRM, recorded by hand (as Log Call): its
   type, point of contact, subject and content. Its time is when it's logged. */
function NewLogEmail({contact, team, onAdd, onDone}){
  const [type, setType] = React.useState(null);
  // The point of contact (the email's internal representative): the record owner unless another is picked.
  const [poc, setPoc] = useOwnerDefault(contact, team);
  const [m, setM] = React.useState({title:'', body:''});
  const set = (p) => setM(x => ({...x, ...p}));
  const ok = !!type && !!poc && !!m.title.trim() && !!m.body.trim();
  const save = () => {
    const id = newId('email');
    onAdd({id, type:'email', logged:true, title:m.title.trim(), body:m.body.trim(), ...emailPatch(type, poc)});
    onDone(id);
  };
  return (
    <NewItemPanel title="Log Email" canSave={ok} onSave={save} onCancel={()=>onDone(null)}>
      <Field label="Email Type" required><Select value={type} options={EMAIL_TYPES} placeholder="Select email type" onChange={setType}/></Field>
      <Field label="Point of Contact" required><PersonPicker value={poc} team={team} contact={contact} onChange={setPoc}/></Field>
      <Field label="Subject" required><input value={m.title} onChange={e=>set({title:e.target.value})} placeholder="Email subject" style={fieldText}/></Field>
      <Field label="Content" required><textarea value={m.body} onChange={e=>set({body:e.target.value})} rows={8} placeholder="What the email said" aria-label="Content" style={{...fieldText, resize:'vertical', lineHeight:1.5}}/></Field>
    </NewItemPanel>
  );
}

function NewLogMeeting({contact, team, onAdd, onDone}){
  const [m, setM] = React.useState({platform:null, title:'', link:'', attendees:[]});
  const [organiser, setOrganiser] = useOwnerDefault(contact, team);
  const set = (p) => setM(x => ({...x, ...p}));
  const ok = !!organiser && !!m.platform && !!m.title.trim();
  const save = () => {
    const id = newId('meeting');
    onAdd({id, type:'meeting', logged:true, source:'team', by:organiser, platform:m.platform, title:m.title.trim(), attendees:m.attendees, ...(m.link.trim() ? {link:m.link.trim()} : {})});
    onDone(id);
  };
  return (
    <NewItemPanel title="Log Meeting" canSave={ok} onSave={save} onCancel={()=>onDone(null)}>
      <Field label="Organizer" required><PersonPicker value={organiser} team={team} contact={contact} placeholder="Select organizer" onChange={setOrganiser}/></Field>
      <Field label="Attendees"><AttendeesField value={m.attendees} team={team} contact={contact} onChange={v=>set({attendees:v})}/></Field>
      <Field label="Platform" required><Select value={m.platform} options={MEETING_PLATFORMS} placeholder="Select platform" onChange={v=>set({platform:v})}/></Field>
      <Field label="Title" required><input value={m.title} onChange={e=>set({title:e.target.value})} placeholder="Meeting title" style={fieldText}/></Field>
      <Field label="Link"><input value={m.link} onChange={e=>set({link:e.target.value})} placeholder="Meeting link (optional)" style={fieldText}/></Field>
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
  // A scheduled meeting is in the future (one that has happened is a Log Meeting).
  const when = m.date && m.time ? taskDueValue(m.date, m.time).due : null, future = !!when && new Date(when).getTime() > Date.now();
  const ok = !!m.title.trim() && !!m.platform && !!m.date && !!m.time && !!organiser && future;
  const save = () => {
    const at = taskDueValue(m.date, m.time).due, id = newId('meeting');
    onAdd({id, type:'meeting', logged:false, status:'scheduled', at, scheduledFor:at, title:m.title.trim(), platform:m.platform,
      durationMin:(SCHEDULE_DURATIONS.find(d => d[0] === m.duration) || [0, 30])[1], description:m.description.trim(), organizer:organiser, source:'team', by:organiser, attendees:m.attendees});
    onDone(id);
  };
  return (
    <NewItemPanel title="Schedule Meeting" canSave={ok} onSave={save} onCancel={()=>onDone(null)}>
      <Field label="Title" required><input autoFocus value={m.title} onChange={e=>set({title:e.target.value})} placeholder="Meeting title" style={fieldText}/></Field>
      <Field label="Platform" required><Select value={m.platform} options={MEETING_PLATFORMS} placeholder="Select platform" onChange={v=>set({platform:v})}/></Field>
      <Field label="Date" required><DateField required value={m.date} onChange={v=>set({date:v})} ariaLabel="Meeting date"/></Field>
      <Field label="Time" required><TimeField required value={m.time} onChange={v=>set({time:v})} ariaLabel="Meeting time"/>
        {when && !future && <div style={{fontSize:12, color:T.red, marginTop:4}}>Choose a time in the future.</div>}</Field>
      <Field label="Duration" required><Select value={m.duration} options={SCHEDULE_DURATIONS.map(d => d[0])} onChange={v=>v && set({duration:v})}/></Field>
      <Field label="Organizer" required><PersonPicker value={organiser} team={team} contact={contact} placeholder="Select organizer" onChange={setOrganiser}/></Field>
      <Field label="Attendees"><AttendeesField value={m.attendees} team={team} contact={contact} onChange={v=>set({attendees:v})}/></Field>
      <Field label="Description"><textarea value={m.description} onChange={e=>set({description:e.target.value})} rows={3} style={{...fieldText, resize:'vertical', lineHeight:1.5}}/></Field>
    </NewItemPanel>
  );
}

// `contact`: the record the task is for — its owner is the default assignee.
function NewTask({team, contact, onAdd, onDone, initial}){
  const hub = useRecordHub();
  // The due date and time start from the signed-in user's Settings → Tasks defaults.
  const [t, setT] = React.useState(() => { const pipelineId = (initial && initial.pipelineId) || DEFAULT_TASK_PIPELINE_ID;
    const {assignee:_a, ...given} = initial || {};
    return {title:'', description:'', pipelineId, status:firstStageOf(pipelineId), taskType:'To-do', ...taskDueDefaults(hub && hub.data), ...given}; });
  const [assignee, setAssignee] = useOwnerDefault(contact, team, initial && initial.assignee);
  const set = (p) => setT(x => ({...x, ...p}));
  // No Status here (2026-11-23): a new task is Not Started — its status changes in Edit, or by dragging it on the board.
  const ok = !!t.title.trim() && !!assignee && !!t.dueDate;
  return (
    <NewItemPanel title="Add Task" primary="Add Task" canSave={ok} onCancel={()=>onDone(null)}
      onSave={()=>{ const id = newId('task'); const {dueDate, dueTimeOfDay, allowedMin, ...rest} = t;
        // A task added as In Progress is started now (withTaskStart).
        onAdd(withTaskStart(null, {id, type:'task', source:'you', by:null, ...rest, assignee, ...taskDueValue(dueDate, dueTimeOfDay), ...(allowedMin ? {allowedMin} : {}), title:t.title.trim(), description:t.description.trim()})); onDone(id); }}>
      <Field label="Task Name" required><input autoFocus value={t.title} onChange={e=>set({title:e.target.value})} placeholder="What needs doing" style={fieldText}/></Field>
      <Field label="Description">
        <textarea value={t.description} onChange={e=>set({description:e.target.value})} rows={3} style={{...fieldText, resize:'vertical', lineHeight:1.5}}/>
      </Field>
      <Field label="Task Type" required><TaskTypeRadios name="type-new" value={t.taskType} onChange={v=>set({taskType:v})}/></Field>
      <Field label="Assigned to" required><PersonPicker value={assignee} team={team} contact={contact} onChange={setAssignee}/></Field>
      <TaskDueFields date={t.dueDate} time={t.dueTimeOfDay} onChange={(date, time)=>set({dueDate:date, dueTimeOfDay:time})}/>
      <TaskTimeAllowedField value={t.allowedMin} onChange={(v)=>set({allowedMin:v})}/>
    </NewItemPanel>
  );
}

/* ── Tab ─────────────────────────────────────────────────────────────────────────────────── */

const ACTIVITY_TAB_TYPES = {activity:null, calls:'call', email:'email', tasks:'task', notes:'note', meetings:'meeting'};   // Meetings: the Deal tabs

/* The tab's add action, at the right of the toolbar: a primary button. Where a tab offers more
   than one type, it still opens the list of types. */
const ACTIVITY_ADD = {
  activity: {label:'Add',       menu:['Note', 'Call', 'Log Call', 'Start Meeting', 'Schedule Meeting', 'Log Meeting', 'Task', 'Email', 'Log Email']},
  calls:    {label:'Add Call',  menu:['Call', 'Log Call']},
  notes:    {label:'Add Note',  pick:'Note'},
  email:    {label:'Add Email', menu:['Email', 'Log Email']},
  tasks:    {label:'Add Task',  pick:'Task'},
  meetings: {label:'Add Meeting', menu:['Start Meeting', 'Schedule Meeting', 'Log Meeting', 'Request Office Meeting']},
};
/* `iconOnly`: just the + (the toolbar icon button, its name as the tooltip) — the Tools pages. */
function ActivityAddButton({tabId, onPick, iconOnly}){
  const [open, setOpen] = React.useState(false);
  const ra = useRecordAccess();
  const cfg0 = ACTIVITY_ADD[tabId];
  if(!cfg0) return null;
  // Only what the acting user may create on this record (its Object's Tools permissions).
  // Request Office Meeting is a record's (it's about that client) — not on the Tools pages.
  const allowed = (o) => (o !== 'Request Office Meeting' || !!ra) && (!ra || canAdd(ra.object, ra.record, o));
  const cfg = cfg0.pick ? (allowed(cfg0.pick) ? cfg0 : null) : {...cfg0, menu:cfg0.menu.filter(allowed)};
  if(!cfg || (cfg.menu && !cfg.menu.length)) return null;
  const style = {...btnPrimarySm(), display:'inline-flex', alignItems:'center', gap:6};
  const face = <><Icon name="plus" size={13} color="#fff"/> {cfg.label}</>;
  // `iconOnly` (the Tools pages): the list's "+ New <thing>" (NewButton, 2026-11-18).
  const newLabel = cfg.label.replace(/^Add /, 'New ');
  if(cfg.pick) return iconOnly ? <NewButton label={newLabel} onClick={()=>onPick(cfg.pick)}/> : <button onClick={()=>onPick(cfg.pick)} style={style}>{face}</button>;
  return (
    <div style={{position:'relative'}}>
      {iconOnly ? <NewButton label={newLabel} onClick={()=>setOpen(o=>!o)}/> : <button onClick={()=>setOpen(o=>!o)} style={style}>{face}</button>}
      <MenuShell open={open} onClose={()=>setOpen(false)} anchorRight width={210}>
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

/* A record's activity as a time trail (2026-11-18): Overview, Calls, Notes, Emails and
   Meetings (Tasks keeps its Table / Board): Upcoming first, then each month, newest first. Each activity has its time and date
   on the left of a rail, its row as before (ActivityRow, without the date), and on the right one
   action where it has one (the stakeholder's list, 2026-11-23 — it replaced Mohsin's of 2026-11-18;
   on a record's pages only: the Tools pages show no row action, `actions={false}`):
     Call — the record's latest call only: No answer, Left voicemail, Disconnected, Call back
       request → Call Again; Connected → none
     Email — the record's latest sent email only → Follow Up (the composer, in its thread); its
       latest received email only → Reply; scheduled → Edit; an email log → none
     Note by someone else → Reply (an icon); one's own → none
     Task, still open: Email → Send Email (the composer, to the record); Call → Call; To-do, also an
       overdue one → Mark as Complete; Colleague follow-up → Remind a Colleague (a bell notification
       to its assignee — Mohsin 2026-11-23; the assignee themself: Mark as Complete)
     Meeting that has happened → View Details  ·  Workflow → Revert (the Workflows · Revert
       permission, while it can still be undone)  ·  everything else → none.
   A row opens the activity in its side panel; the panel's filled button is detailAction. */
const CALL_UNANSWERED = /no answer|voicemail|disconnected|call back request/i;
/* A record's latest call, latest email sent and latest email received (through the CRM; a log and a
   scheduled email aren't counted): the only call and emails whose row carries the action. */
const trailLatest = (acts) => {
  const pick = (keep) => { let best = null; (acts || []).forEach(a => { if(keep(a) && (!best || new Date(a.at) > new Date(best.at))) best = a; }); return best ? best.id : null; };
  const sent = (a) => a.type === 'email' && !a.logged && a.status !== 'scheduled';
  return {call:pick(a => a.type === 'call'), sent:pick(a => sent(a) && a.direction !== 'received'), received:pick(a => sent(a) && a.direction === 'received')};
};
// A meeting that has happened: a logged one, or a scheduled one whose time is over.
const meetingHappened = (a) => !!a.logged || (!['requested', 'cancelled', 'declined'].includes(a.status)
  && new Date(a.scheduledFor || a.at).getTime() + (Number(a.durationMin) || 30) * 60000 <= Date.now());
/* The row's action on a record's trail (2026-11-23, the stakeholder's list). `env`: {me — the
   signed-in person's name, latest — trailLatest of the record's whole activity}. */
const trailAction = (a, env = {}) => {
  const latest = env.latest || {};
  if(a.type === 'email') return a.status === 'scheduled' ? 'edit' : a.logged ? null
    : a.direction === 'received' ? (latest.received === a.id ? 'reply' : null) : latest.sent === a.id ? 'followUp' : null;
  if(a.type === 'call') return latest.call === a.id && CALL_UNANSWERED.test(a.outcome || '') ? 'callAgain' : null;
  if(a.type === 'note') return ((activityActor(a) || {}).name || '') !== env.me ? 'replyNote' : null;
  if(a.type === 'task'){ if(!isTaskOpen(a)) return null; const type = taskTypeOf(a);
    return type === 'Email' ? 'sendEmail' : type === 'Call' ? 'call' : type === COLLEAGUE_TASK && a.assignee && a.assignee !== env.me ? 'remind' : 'completeTask'; }
  if(a.type === 'meeting') return meetingHappened(a) ? 'viewDetails' : null;
  if(a.type === 'workflow') return a.runId ? 'revert' : null;
  return null;
};
/* The filled button of an activity's own panel: its row's action — and, where the row no longer
   carries one (an earlier email, a connected call, a meeting, one's own note), what the panel
   had before: Follow Up / Reply, Schedule Meeting / Call Again, Add Note, Reply. A task keeps its
   Complete button, so Mark as Complete isn't repeated. */
const detailAction = (a, env = {}) => {
  const row = trailAction(a, env);
  if(row && row !== 'viewDetails' && row !== 'completeTask') return row;
  if(a.type === 'email') return a.logged || a.status === 'scheduled' ? null : a.direction === 'received' ? 'reply' : 'followUp';
  if(a.type === 'call') return a.outcome === CALL_NOT_QUALIFIED_OUTCOME ? null : /^connected/i.test(a.outcome || '') ? 'meeting' : CALL_UNANSWERED.test(a.outcome || '') ? 'callAgain' : null;
  return a.type === 'meeting' ? 'note' : a.type === 'note' ? 'replyNote' : null;
};
const TRAIL_ACTION_LABEL = {reply:'Reply', followUp:'Follow Up', edit:'Edit', meeting:'Schedule Meeting', callAgain:'Call Again', note:'Add Note', replyNote:'Reply', revert:'Revert',
  sendEmail:'Send Email', call:'Call', completeTask:'Mark as Complete', remind:'Remind a Colleague', viewDetails:'View Details'};
const TRAIL_ACTION_ICON = {replyNote:'reply'};   // shown as its icon alone
// What each action needs the person to be allowed to do on the record.
const TRAIL_ACTION_TOOL = {reply:'Email', followUp:'Email', meeting:'Schedule Meeting', callAgain:'Call', note:'Note', replyNote:'Note', sendEmail:'Email', call:'Call'};
const TRAIL_TIME_W = 84;
// `context`: how the rows read (the tab's, as its list read them); `countOf(a)`: an email thread's size (Emails).
// `contactOf(a)`: each row's own record, where the list runs across records (the Tools pages).
// `envOf(a)`: what trailAction reads for the row (who is signed in, the record's latest call and emails);
// `actions` false: no row action (the Tools pages, whose detail is beside the trail).
// `pick` {can(a), has(a), toggle(a)}: a tick before each row that can be picked (Notes: for Spring — noteTools.jsx).
function ActivityTrail({list, contact, contactOf, recordOf, selectedId, onOpen, onAction, canDo, empty, context = 'all', countOf, envOf, actions = true, pick}){
  const now = Date.now();
  const groups = new Map();
  list.forEach(a => { const d = new Date(a.at);
    const key = d.getTime() > now ? 'Upcoming' : d.toLocaleDateString('en-US', {month:'long', year:'numeric'});
    if(!groups.has(key)) groups.set(key, []); groups.get(key).push(a); });
  if(!list.length) return <EmptyState compact title={empty}/>;
  return [...groups].map(([key, items]) => (
    <section key={key} style={{paddingBottom:8}}>
      <div style={{padding:'14px 20px 6px', fontSize:13, fontWeight:600, color:T.attioText}}>{key}</div>
      {items.map((a, i) => <TrailRow key={a.id} a={a} contact={contactOf ? contactOf(a) : contact} upcoming={key === 'Upcoming'} first={i === 0} last={i === items.length - 1} context={context}
        count={countOf ? countOf(a) : 1} record={recordOf && recordOf(a)} selected={selectedId === a.id} onOpen={onOpen} onAction={onAction} canDo={canDo} env={envOf ? envOf(a) : undefined} actions={actions} pick={pick}/>)}
    </section>
  ));
}
function TrailRow({a, contact, upcoming, first, last, record, selected, onOpen, onAction, canDo, context = 'all', count = 1, env, actions = true, pick}){
  const [h, setH] = React.useState(false);
  const plainRecords = !!(React.useContext(OpenRecordCtx) || {}).all;
  const d = new Date(a.at);
  const action = actions ? trailAction(a, env) : null, shownAction = action && canDo(a, action) ? action : null;
  return (
    <div data-act-id={a.id} onClick={()=>onOpen(a)} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{display:'flex', alignItems:'stretch', padding:'0 20px', cursor:'pointer', background: selected ? '#F4F5F7' : h ? T.headerBg : 'transparent', transition:'background 120ms ease'}}>
      {pick && <div style={{width:20, flexShrink:0, paddingTop:15}}>{pick.can(a) && <RowCheckbox checked={pick.has(a)} onChange={()=>pick.toggle(a)}/>}</div>}
      <div style={{width: pick ? TRAIL_TIME_W - 12 : TRAIL_TIME_W, flexShrink:0, textAlign:'right', padding:'14px 0 10px', whiteSpace:'nowrap'}}>
        <div style={{fontSize:12.5, fontWeight:600, color:T.attioText, lineHeight:'17px'}}>{fmtActTime(d)}</div>
        <div style={{fontSize:11.5, color:T.attioMuted, marginTop:1}}>{fmtActDate(d)}</div>
      </div>
      {/* The rail: one line through the month, a dot at each activity — hollow while it's still to come. */}
      <div style={{width:36, flexShrink:0, position:'relative', display:'flex', justifyContent:'center'}}>
        <span style={{position:'absolute', left:'50%', width:1, marginLeft:-0.5, top: first ? 19 : 0, bottom: last ? 'calc(100% - 19px)' : 0, background:T.border}}/>
        <span style={{position:'relative', marginTop:14, width:9, height:9, borderRadius:9, boxSizing:'border-box',
          background: upcoming ? '#fff' : T.gray600, border:`1.5px solid ${upcoming ? T.gray400 : T.gray600}`}}/>
      </div>
      <div style={{flex:1, minWidth:0, padding:'6px 0'}}>
        {/* On a record's journey (`all`) the row names no record (2026-11-19). */}
        <ActivityRow a={a} contact={contact} context={context} first hideWhen record={record && !plainRecords ? {object:record.object, id:record.record.id, name:record.record.name} : null}/>
      </div>
      <div style={{flexShrink:0, minWidth: actions ? 72 : 0, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, paddingTop:13}}>
        {shownAction && (TRAIL_ACTION_ICON[shownAction]
          ? <button onClick={e=>{ e.stopPropagation(); onAction(a, shownAction); }} title={TRAIL_ACTION_LABEL[shownAction]} aria-label={TRAIL_ACTION_LABEL[shownAction]}
              style={{border:'none', background:'transparent', padding:2, height:18, cursor:'pointer', display:'flex', alignItems:'center'}}><Icon name={TRAIL_ACTION_ICON[shownAction]} size={14} color={T.gray600}/></button>
          : <button onClick={e=>{ e.stopPropagation(); onAction(a, shownAction); }} className={LINK_CLASS}
          style={{border:'none', background:'transparent', padding:0, height:18, cursor:'pointer', fontSize:12.5, fontFamily:'inherit', color:T.attioText, whiteSpace:'nowrap'}}>
          {TRAIL_ACTION_LABEL[shownAction]}</button>)}
        {count > 1 && <span title={`${count} emails in this thread`} style={{fontSize:11, fontWeight:600, color:T.gray600, background:T.headerBg, borderRadius:9999, padding:'1px 7px'}}>{count}</span>}
      </div>
    </div>
  );
}

/* Remind a Colleague (2026-11-23): the task's assignee is told in their bell by whoever asks —
   it opens the record on its Tasks. Always in-app; no Notification Preset switches it off. */
function remindColleague(hub, wfCtx, task, where){
  const to = (hub.data.users || []).find(u => u.name === task.assignee && u.status !== 'Deactivated');
  const record = hubRecord(hub, where.object, where.recordId);
  if(!to || !wfCtx || !wfCtx.api.addNotifications) return hub.toast('No colleague to remind');
  wfCtx.api.addNotifications([{userId:to.id, kind:'taskReminder', object:'direct', recordId:where.recordId, tab:'tasks', dealId:null, dealName:record ? record.name : '', by:CURRENT_USER.name, channels:{inApp:true},
    text:`${CURRENT_USER.name} reminded you about the task ${task.title || 'Task'}${record ? ` on ${record.name}` : ''}.`}]);
  hub.toast(`Reminder sent to ${to.name}`);
}
// `emptyText`: replaces the tab's empty message (e.g. when a view's search or filters hide everything).
// `prefill`: what a new item's form starts with (a task's name and type).
/* `recordOf(act)` → {object, record}: an associated feed — each item names the record it's on,
   and opens on that record (its details, edits and comments go to it). */
/* `acts`: what the tab lists (its filters and search applied); `allActs`: the record's whole activity —
   what an opened item reads (a call's notes, an email's thread), so a filter can't hide them. */
// A record's activity opens in a side panel a little wider than other detail panels (640, not 560 — Mohsin 2026-11-19).
const ACTIVITY_SIDE_W = 640;
function ActivityTab({tabId, taskView = 'board', contact, acts, allActs, team, adding, setAdding, prefill, onUpdate, onAdd, onStub, onReassign, emptyText, recordOf}){
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
  const [intent, setIntent] = React.useState(null);     // Overview's trail: what the opened activity is for ('note')
  const open = (a, why = null) => { setSelectedId(a.id); setIntent(why); };
  const [meetingFor, setMeetingFor] = React.useState(null);   // Schedule Meeting from the trail for an associated record's call: {object, record}
  // The trail's actions — the same in the trail and as the side panel's filled button (DetailPrimaryCtx).
  const wfCtx = useWorkflowEngineCtx();
  const runOf = (a) => wfCtx && a.runId ? (wfCtx.state.runs || []).find(r => r.id === a.runId) || null : null;
  /* What a row's action reads (trailAction): the signed-in person, and the latest call and emails of
     the record the activity is on — its whole activity, whatever the tab lists. */
  const latestByRecord = React.useRef(new Map()); latestByRecord.current = new Map();
  const envOf = (a) => { const on = recordOf && recordOf(a), key = on ? `${on.object}:${on.record.id}` : 'own';
    if(!latestByRecord.current.has(key)) latestByRecord.current.set(key, trailLatest(on ? (hub.activities[on.object] || {})[on.record.id] || [] : allActs || acts));
    return {me:CURRENT_USER.name, latest:latestByRecord.current.get(key)}; };
  const canTrail = (a, what) => { const on = recordOf && recordOf(a), o = on ? on.object : ra && ra.object, r = on ? on.record : ra && ra.record;
    if(what === 'viewDetails' || what === 'remind') return true;
    // Revert: the run is still kept, not reverted, has something to undo, and the person may revert.
    if(what === 'revert'){ const run = runOf(a); return !!run && !run.reverted && automationRevertible(run) && workflowCan('revert'); }
    if(!o) return true;
    return what === 'edit' || what === 'completeTask' ? activityCan(o, r, a, 'edit') : canAdd(o, r, TRAIL_ACTION_TOOL[what]); };
  const runTrail = (a, what) => {
    if(what === 'viewDetails') return open(a);
    if(what === 'note') return open(a, 'note');
    if(what === 'replyNote') return open(a, 'reply');
    if(what === 'revert'){ wfCtx.api.revertRun(a.runId); return hub && hub.toast('Workflow reverted'); }
    // The record the activity is on (an associated feed's is another record).
    const where = (hub && hubFindActivity(hub, a.id)) || (ra && {object:ra.object, recordId:ra.record.id});
    if(!where) return onStub(TRAIL_ACTION_LABEL[what]);
    // A task's actions (2026-11-23): complete it, write the email or make the call it's for, remind its colleague.
    if(what === 'completeTask'){ hub.update(where.object, where.recordId, a.id, {status:'completed'}); return hub.toast('Task completed'); }
    if(what === 'sendEmail') return setCompose({object:where.object, id:where.recordId});
    if(what === 'call') return hub.startCall({object:where.object, id:where.recordId});
    if(what === 'remind') return remindColleague(hub, wfCtx, a, where);
    if(what === 'reply' || what === 'followUp') return setCompose({object:where.object, id:where.recordId, replyTo:a, ...(what === 'followUp' ? {title:'Follow Up'} : {})});
    if(what === 'callAgain') return hub.startCall({object:where.object, id:where.recordId});
    if(what === 'edit') return setCompose({object:where.object, id:where.recordId, edit:a, title:'Edit Email'});
    if(what === 'meeting'){ const on = recordOf && recordOf(a); setSelectedId(null); setMeetingFor(on ? {object:on.object, record:on.record} : null); setAdding('Schedule Meeting'); }
  };
  const primaryOf = (a) => { const what = a && detailAction(a, envOf(a));
    return what && canTrail(a, what) ? {what, el:<button key="primary" onClick={()=>runTrail(a, what)} style={btnPrimarySm()}>{TRAIL_ACTION_LABEL[what]}</button>} : null; };
  /* Notes (2026-11-23): tick notes — or Select All — and Ask Spring (noteTools.jsx). General and
     Client Request notes only; Spring's suggested actions open the usual forms, on the note's record. */
  const noteMode = tabId === 'notes';
  const [picked, setPicked] = React.useState(() => new Set());
  const [spring, setSpring] = React.useState(false), [springTask, setSpringTask] = React.useState(null);
  const pickable = noteMode ? list.filter(a => noteTypeOf(a) !== 'support') : [], pickedList = pickable.filter(a => picked.has(a.id));
  const togglePick = (a) => setPicked(s => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; });
  const springItems = pickedList.map(a => { const on = recordOf && recordOf(a); return {act:a, object:on ? on.object : ra ? ra.object : 'contacts', record:on ? on.record : ra ? ra.record : contact, on}; });
  const runSpring = (action) => { const it = action.item, target = {object:it.object, id:it.record.id};
    setSpring(false);
    if(action.kind === 'call') return hub.startCall(target);
    if(action.kind === 'email') return setCompose({...target, draft:{subject:action.subject, body:action.body}});
    setSelectedId(null); setMeetingFor(it.on ? {object:it.on.object, record:it.on.record} : null);
    if(action.kind === 'meeting') return setAdding('Schedule Meeting');
    setSpringTask({title:action.title, taskType:'To-do'}); setAdding('Task'); };
  /* An activity asked for from elsewhere on the page (a Smart Summary insight — overviewSettings.jsx
     openActivityFromInsight): the list scrolls to its row, lit for a moment. One the list isn't
     showing (filtered out, or inside an email thread's row) opens in its side panel instead. */
  const pageVisible = React.useContext(PageVisibleCtx), everyAct = allActs || acts;
  const wrapRef = React.useRef(null), [flashId, setFlashId] = React.useState(null);
  React.useEffect(() => {
    const on = (e) => { const id = e.detail && e.detail.id; if(!pageVisible || tabId === 'tasks') return;
      const row = wrapRef.current && [...wrapRef.current.querySelectorAll('[data-act-id]')].find(el => el.getAttribute('data-act-id') === String(id));
      if(row){ row.scrollIntoView({block:'center', behavior:'smooth'}); setFlashId(id); setTimeout(() => setFlashId(f => f === id ? null : f), 2400); }
      else if(everyAct.some(a => a.id === id)){ setSelectedId(id); setIntent(null); } };
    window.addEventListener('hof-open-activity', on);
    return () => window.removeEventListener('hof-open-activity', on);
  }, [pageVisible, tabId, everyAct]);
  // Nothing is open until an activity is picked: it opens in its own side panel (below).
  const selected = list.find(a => a.id === selectedId) || (selectedId && everyAct.find(a => a.id === selectedId)) || null;
  const done = (id) => { setAdding(null); if(id) setSelectedId(id); };
  const empty = emptyText || {activity:'No activity yet', calls:'No calls yet', email:'No emails yet', tasks:'No tasks yet', notes:'No notes yet', meetings:'No meetings yet'}[tabId];
  // A new email from this record, or a reply / forward of one shown here.
  const emailOpts = adding === 'Email' && ra ? {object:ra.object, id:ra.record.id} : compose;
  const closeEmail = (result, id) => { setAdding(a => a === 'Email' ? null : a); setCompose(null); if(id) setSelectedId(id); };
  return (
    <ComposeHostCtx.Provider value={{compose:setCompose}}>
    <div ref={wrapRef} style={{display:'flex', flex:1, minWidth:0, minHeight:0, height:'100%', position:'relative'}}>
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
          {taskView === 'table' ? <TaskTable entries={entries} onOpen={(e)=>setSelectedId(e.act.id)}/>
            : <TaskStatusBoard entries={entries} onUpdate={update} onOpen={(e)=>setSelectedId(e.act.id)} showAssignee/>}
          {open && <PageSidePanel width={ACTIVITY_SIDE_W} title={open.act.title || 'Task'} onClose={()=>setSelectedId(null)}>
            <DetailFooterCtx.Provider value={true}>
            <div style={{flex:1, minHeight:0, display:'flex', flexDirection:'column'}}>
              {own(open) ? <ActivityDetail key={open.act.id} a={open.act} contact={contact} team={team} acts={allActs || acts} onUpdate={onUpdate} onAdd={onAdd} onStub={onStub} onReassign={onReassign}/>
                : <RecordAccessCtx.Provider value={{object:open.object, record:open.record}}>
                    <ActivityDetail key={open.act.id} a={open.act} contact={view(open.record)} team={team} acts={(hub.activities[open.object] || {})[open.recordId] || []}
                      onUpdate={(id, patch)=>hub.update(open.object, open.recordId, id, patch)} onAdd={(x)=>hub.add(open.object, open.recordId, x)}
                      onStub={onStub} onReassign={()=>{}} across={{object:open.object, record:open.record, perspective:'person', hideType:true}}/>
                  </RecordAccessCtx.Provider>}
            </div>
            </DetailFooterCtx.Provider>
          </PageSidePanel>}
        </>;
      })() : <>
      {/* The activity list, full width (2026-11-18); an activity picked opens in its own
          side panel — its details, with Edit and ⋯ at the bottom right (DetailFooterCtx). */}
      <div style={{flex:1, minWidth:0, overflowY:'auto', padding:'8px 0'}}>
        {noteMode && <NoteSelectBar total={pickable.length} count={pickedList.length} onAsk={()=>{ setSelectedId(null); setSpring(true); }}
          onToggleAll={()=>setPicked(pickedList.length === pickable.length ? new Set() : new Set(pickable.map(a => a.id)))}/>}
        {/* The time trail, on Overview and on Calls, Notes, Emails and Meetings (2026-11-18). */}
        <ActivityTrail pick={noteMode && pickable.length ? {can:(a) => noteTypeOf(a) !== 'support', has:(a) => picked.has(a.id), toggle:togglePick} : undefined} list={list} contact={contact} recordOf={recordOf} selectedId={(selected && selected.id) || flashId} empty={empty}
          context={context} countOf={threads ? threadCount : undefined}
          onOpen={(a)=>open(a)} canDo={canTrail} onAction={runTrail} envOf={envOf}/>
      </div>
      {selected && (() => {
        const on = recordOf && recordOf(selected);
        const title = (ACTIVITY_TYPES[selected.type] || {}).label || 'Activity';
        const view = on && {...on.record, owner:userLabel(on.record.owner) || on.record.owner};
        return (
          <PageSidePanel width={ACTIVITY_SIDE_W} title={title} onClose={()=>{ setSelectedId(null); setIntent(null); }}>
            <DetailFooterCtx.Provider value={true}><DetailIntentCtx.Provider value={intent}><DetailPrimaryCtx.Provider value={primaryOf(selected)}>
              <div key={`${selected.id}:${intent || ''}`} style={{flex:1, minHeight:0, display:'flex', flexDirection:'column'}}>
                {!on ? <ActivityDetail key={selected.id} a={selected} contact={contact} team={team} acts={allActs || acts}
                    onUpdate={onUpdate} onAdd={onAdd} onStub={onStub} onReassign={onReassign}/>
                  // On an associated record: as on the Tools pages, with the record named in the details.
                  : <RecordAccessCtx.Provider value={{object:on.object, record:on.record}}>
                      <ActivityDetail key={selected.id} a={selected} contact={view} team={team} acts={(hub.activities[on.object] || {})[on.record.id] || []}
                        onUpdate={(id, patch)=>hub.update(on.object, on.record.id, id, patch)} onAdd={(x)=>hub.add(on.object, on.record.id, x)}
                        onStub={onStub} onReassign={()=>{}} across={{object:on.object, record:on.record, perspective:'person', hideType:true}}/>
                    </RecordAccessCtx.Provider>}
              </div>
            </DetailPrimaryCtx.Provider></DetailIntentCtx.Provider></DetailFooterCtx.Provider>
          </PageSidePanel>
        );
      })()}
      </>}

      {/* A new item: the creation side panel over this area, without the record section — the
          record is this one. */}
      {adding === 'Note' && <NewNote onAdd={onAdd} onDone={done}/>}
      {adding === 'Log Call' && <NewLogCall contact={contact} team={team} onAdd={onAdd} onDone={done}/>}
      {adding === 'Log Meeting' && <NewLogMeeting contact={contact} team={team} onAdd={onAdd} onDone={done}/>}
      {adding === 'Log Email' && <NewLogEmail contact={contact} team={team} onAdd={onAdd} onDone={done}/>}
      {adding === 'Schedule Meeting' && (meetingFor
        ? <NewScheduleMeeting contact={{...meetingFor.record, owner:userLabel(meetingFor.record.owner) || meetingFor.record.owner}} team={team}
            onAdd={(x)=>hub.add(meetingFor.object, meetingFor.record.id, x)} onDone={()=>{ setMeetingFor(null); setAdding(null); }}/>
        : <NewScheduleMeeting contact={contact} team={team} onAdd={onAdd} onDone={done}/>)}
      {adding === 'Task' && (springTask && meetingFor
        ? <NewTask team={team} contact={{...meetingFor.record, owner:userLabel(meetingFor.record.owner) || meetingFor.record.owner}} initial={springTask}
            onAdd={(x)=>hub.add(meetingFor.object, meetingFor.record.id, x)} onDone={()=>{ setMeetingFor(null); setSpringTask(null); setAdding(null); }}/>
        : <NewTask team={team} contact={contact} initial={springTask || prefill} onAdd={onAdd} onDone={(id)=>{ setSpringTask(null); done(id); }}/>)}
      {spring && springItems.length > 0 && <SpringNotesPanel items={springItems} onClose={()=>setSpring(false)} onRun={runSpring}
        onSource={(act)=>window.dispatchEvent(new CustomEvent('hof-open-activity', {detail:{id:act.id}}))}/>}
      {emailOpts && <EmailComposer key={adding === 'Email' ? 'new' : emailOpts.edit ? `edit:${emailOpts.edit.id}` : 'reply'} {...emailOpts} onClose={closeEmail}/>}
    </div>
    </ComposeHostCtx.Provider>
  );
}

Object.assign(window, {trailAction, detailAction, trailLatest, remindColleague, TRAIL_ACTION_LABEL, TRAIL_ACTION_TOOL, ActivityTrail, ACTIVITY_SIDE_W, DetailIntentCtx, DetailPrimaryCtx, TaskTimeLeft, useMinuteTick, CallBackFields, NotQualifiedReasonField, notQualifiedReasonOptions, setLeadNotQualified, DetailFooterCtx, OfficeMeetingRequestModal, CreatePanelFrame, ContentSidePanel, APP_HEADER_H, PageVisibleCtx, CreatePanelCtx, CreateRecordField, ComposeHostCtx, ActivityDetail, NewNote, NewLogCall, NewLogEmail, NewLogMeeting, NewScheduleMeeting, NewTask, SCHEDULE_DURATIONS, ActivityTab, ActivityAddButton, ACTIVITY_TAB_TYPES});
