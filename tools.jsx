/* HOF Pulse ERP — Tools: Calls, Tasks, Emails, Meetings and Notes across the workspace.

   Each page lists every activity of its kind, whatever Contact, Deal or Customer it's on — the
   record views every CRM page has (views, search, Filters, Table Settings), with the record it
   belongs to (a link that opens it). Opening one shows it in a side panel with its usual detail
   (Edit, ⋯ Delete, comments, Reply …) — the same component the record's own tab uses, so a change
   here is the record's change, and the other way round (recordHub.jsx). New items are created
   against a record chosen first: Log Call or a live Call, Task, Schedule / Log Meeting, Note; New
   email opens the composer. Quotes have their own page (quotes.jsx). */

const dateKey = (d) => { if(!d) return ''; const x = new Date(d); return `${ymdOf(x)}T${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`; };
// Who did it: the person who added it (their stamped name), the client (named as the record's person), or the team member.
const byName = (a, record) => a.source === 'you' ? a.by || CURRENT_USER.name : a.source === 'client' ? (record && record.name) || 'Client' : a.by || '';
const viewFilter = (id, name, prop, value) => ({id, name, filters:{nodes:[{id:`f-${id}`, kind:'row', joinOp:'AND', prop, op:'is', value, value2:'', values:[]}]}, sort:{key:'date', dir:'desc'}});
const isUpcoming = (a) => a.status === 'scheduled' && new Date(a.scheduledFor || a.at).getTime() > Date.now();

/* What each page lists: its activity type, columns (after the first, which opens the item, and
   Record / Record Type), filters, default views and what it creates. */
const TOOL_PAGES = {
  calls: {type:'call', noun:'call', label:'Call', first:{key:'subject', label:'Call', width:220},
    row:(a) => ({subject:`${a.logged ? 'Call log' : 'Call'} · ${a.outcome || 'No outcome'}`, callType:a.logged ? 'Call log' : 'Call', outcome:a.outcome || '',
      duration:a.durationMin ? `${a.durationMin} min` : '', direction:a.direction === 'inbound' ? 'Inbound' : 'Outbound'}),
    columns:[{key:'callType', label:'Call Type', width:120, filter:'select'}, {key:'outcome', label:'Outcome', width:150, filter:'select'},
      {key:'direction', label:'Direction', width:120, filter:'select'}, {key:'duration', label:'Duration', width:110}],
    views:[{id:'tcall-all', name:'All Calls', sort:{key:'date', dir:'desc'}}, viewFilter('tcall-logs', 'Call Logs', 'callType', 'Call log'), viewFilter('tcall-calls', 'Calls', 'callType', 'Call')],
    create:['Call', 'Log Call']},
  tasks: {type:'task', noun:'task', label:'Task', first:{key:'subject', label:'Task', width:240},
    row:(a) => ({subject:a.title || 'Task', status:taskStatusLabel(a.status) || '', open:isTaskOpen(a) ? 'Open' : 'Completed', overdue:isOverdue(a) ? 'Yes' : 'No',
      taskType:a.taskType || '', assignee:a.assignee || '', due:a.due ? dateKey(a.due) : ''}),
    columns:[{key:'status', label:'Status', width:130, filter:'select'}, {key:'due', label:'Due', width:150, filter:'date', date:'due'}, {key:'overdue', label:'Overdue', width:100, filter:'select'},
      {key:'taskType', label:'Task Type', width:120, filter:'select'}, {key:'assignee', label:'Assigned To', width:160, filter:'select'}],
    filterOnly:[{key:'open', label:'Task State', type:'select'}],
    views:[viewFilter('ttask-open', 'Open Tasks', 'open', 'Open'), viewFilter('ttask-overdue', 'Overdue', 'overdue', 'Yes'), viewFilter('ttask-done', 'Completed', 'open', 'Completed'),
      {id:'ttask-all', name:'All Tasks', sort:{key:'date', dir:'desc'}}],
    create:['Task']},
  emails: {type:'email', noun:'email', label:'Email', first:{key:'subject', label:'Subject', width:260},
    row:(a) => ({subject:a.title || '(No subject)', folder: a.status === 'scheduled' ? 'Scheduled' : a.direction === 'received' ? 'Inbox' : 'Sent',
      to:(a.to || []).join(', '), template:a.templateId ? 'Template' : ''}),
    columns:[{key:'folder', label:'Folder', width:110, filter:'select'}, {key:'to', label:'To', width:200}],
    views:[viewFilter('temail-inbox', 'Inbox', 'folder', 'Inbox'), viewFilter('temail-sent', 'Sent', 'folder', 'Sent'), viewFilter('temail-scheduled', 'Scheduled', 'folder', 'Scheduled')],
    create:['Email']},
  meetings: {type:'meeting', noun:'meeting', label:'Meeting', first:{key:'subject', label:'Meeting', width:240},
    row:(a) => ({subject:a.title || 'Meeting', meetingType:a.logged ? 'Meeting log' : 'Meeting', platform:a.platform || '', when: isUpcoming(a) ? 'Upcoming' : 'Past',
      organiser:a.organizer || a.by || ''}),
    columns:[{key:'when', label:'When', width:110, filter:'select'}, {key:'meetingType', label:'Meeting Type', width:140, filter:'select'},
      {key:'platform', label:'Platform', width:130, filter:'select'}, {key:'organiser', label:'Organiser', width:160, filter:'select'}],
    views:[viewFilter('tmeet-up', 'Upcoming', 'when', 'Upcoming'), viewFilter('tmeet-past', 'Past', 'when', 'Past'), {id:'tmeet-all', name:'All Meetings', sort:{key:'date', dir:'desc'}}],
    create:['Schedule Meeting', 'Log Meeting']},
  notes: {type:'note', noun:'note', label:'Note', first:{key:'subject', label:'Note', width:320},
    row:(a) => ({subject:richTextPlain(a.body).slice(0, 90) || 'Note', linked:a.callId ? 'Call' : a.meetingId ? 'Meeting' : ''}),
    columns:[{key:'linked', label:'Linked To', width:120, filter:'select'}],
    views:[{id:'tnote-all', name:'All Notes', sort:{key:'date', dir:'desc'}}],
    create:['Note']},
};

/* The side panel: an activity's detail on its own record (permissions, comments, delete), or a
   new item's form once its record is chosen. */
function ToolPanel({page, entry, creating, onClose, onCreated}){
  const hub = useRecordHub();
  const team = (hub.data.users || []).filter(u => u.status === 'Activated').map(u => u.name);
  const [target, setTarget] = React.useState({object:hubObjects()[0], id:null});
  const object = entry ? entry.object : target.object, recordId = entry ? entry.recordId : target.id;
  const record = recordId != null ? hubRecord(hub, object, recordId) : null;
  const view = record && {...record, owner:userLabel(record.owner) || record.owner};
  const acts = record ? ((hub.activities[object] || {})[recordId] || []) : [];
  const act = entry && acts.find(a => a.id === entry.act.id);
  const onAdd = (a) => hub.add(object, recordId, a);
  const onUpdate = (id, patch) => hub.update(object, recordId, id, patch);
  const title = entry ? `${page.label} · ${record ? record.name : ''}` : creating;
  return (
    <PageSidePanel width={560} title={title} subtitle={record ? `${HUB_NOUN[object]} · ${record.name}` : `Choose the ${page.noun}'s record`} onClose={onClose}
      menuItems={record ? [{label:`Open ${HUB_NOUN[object].toLowerCase()}`, onClick:()=>hub.openRecord(object, recordId, 'panel')}] : undefined}>
      {!entry && (
        <div style={{padding:'4px 20px 16px', borderBottom:`1px solid ${T.border}`}}>
          <RecordPicker value={target} onChange={setTarget}/>
        </div>
      )}
      <div style={{flex:1, minHeight:0, display:'flex', flexDirection:'column'}}>
        {record && <RecordAccessCtx.Provider value={{object, record}}>
          {entry ? (act ? <ActivityDetail key={act.id} a={act} contact={view} team={team} acts={acts} onUpdate={onUpdate} onAdd={onAdd} onStub={hub.toast} onReassign={()=>{}}/>
              : <div style={{padding:24, fontSize:13, color:T.attioMuted}}>This {page.noun} was deleted.</div>)
            : creating === 'Note' ? <NewNote onAdd={onAdd} onDone={(id)=>onCreated(id, object, recordId)}/>
            : creating === 'Log Call' ? <NewLogCall contact={view} team={team} onAdd={onAdd} onDone={(id)=>onCreated(id, object, recordId)}/>
            : creating === 'Task' ? <NewTask team={team} contact={view} onAdd={onAdd} onDone={(id)=>onCreated(id, object, recordId)}/>
            : creating === 'Log Meeting' ? <NewLogMeeting contact={view} team={team} onAdd={onAdd} onDone={(id)=>onCreated(id, object, recordId)}/>
            : creating === 'Schedule Meeting' ? <NewScheduleMeeting contact={view} team={team} onAdd={onAdd} onDone={(id)=>onCreated(id, object, recordId)}/>
            : creating === 'Call' ? (
              <div style={{padding:20, display:'flex', flexDirection:'column', gap:12}}>
                <div style={{fontSize:13, color:T.attioText}}>{(hubRecordPerson(hub, object, recordId) || {}).phone || 'No phone number on this record.'}</div>
                <div><StCta icon="call" label="Start call" disabled={!(hubRecordPerson(hub, object, recordId) || {}).phone} onClick={()=>{ hub.startCall({object, id:recordId}); onClose(); }}/></div>
              </div>) : null}
        </RecordAccessCtx.Provider>}
      </div>
    </PageSidePanel>
  );
}

/* One Tools page (`pageId`: calls, tasks, emails, meetings, notes). */
function ToolActivityPage({pageId}){
  const hub = useRecordHub();
  const page = TOOL_PAGES[pageId];
  const [panel, setPanel] = React.useState(null);   // {ref:{object, recordId, actId}} | {creating}
  const [menu, setMenu] = React.useState(false);
  const entries = hubActivities(hub, page.type);
  const refOf = (e) => ({object:e.object, recordId:e.recordId, actId:e.act.id});
  // The open item, read fresh from its record each time (so edits and new items show at once).
  const openEntry = panel && panel.ref ? {object:panel.ref.object, recordId:panel.ref.recordId, act:{id:panel.ref.actId}} : null;
  const rows = entries.map(e => ({id:e.act.id, ...page.row(e.act), _e:e, record:e.record.name, object:HUB_NOUN[e.object], by:byName(e.act, e.record), date:dateKey(e.act.at)}));
  const columns = [page.first, {key:'record', label:'Record', width:200}, {key:'object', label:'Record Type', width:130}, ...page.columns,
    {key:'by', label:'By', width:160}, {key:'date', label:'Date', width:160}];
  const uniq = (k) => [...new Set(rows.map(r => r[k]).filter(Boolean))].sort();
  const schema = {
    properties:columns.map(c => ({key:c.key, label:c.label, width:c.width})), noun:page.noun, searchKeys:['subject', 'record', 'by'], canCreateProperty:false,
    filterProps:[{key:'object', label:'Record Type', type:'select'}, ...page.columns.filter(c => c.filter).map(c => ({key:c.key, label:c.label, type:c.filter})), ...(page.filterOnly || []),
      {key:'by', label:'By', type:'select'}, {key:'date', label:'Date', type:'date'}],
    selectValues:{object:['Contact', 'Deal', 'Customer'], by:uniq('by'), ...Object.fromEntries([...page.columns, ...(page.filterOnly || [])].filter(c => (c.filter || c.type) === 'select').map(c => [c.key, uniq(c.key)]))},
    renderCell:(key, r) => key === page.first.key ? <ContactName name={r[key]} onOpen={()=>setPanel({ref:refOf(r._e)})} style={{fontSize:'inherit', fontWeight:500}}/>
      : key === 'record' ? <HubRecordLink object={r._e.object} id={r._e.recordId} name={r.record}/>
      : (key === 'date' || (key === 'due' && r.due)) && r[key] ? <span>{key === 'due' ? fmtTaskDue(r._e.act) : fmtActStamp(new Date(r._e.act.at))}</span>
      : undefined,
    renderActions:(r) => <RowActionsMenu title={`${page.label} actions`} width={MENU_W} items={[
      {label:`View ${page.noun}`, onClick:()=>setPanel({ref:refOf(r._e)})},
      {label:`Open ${r.object.toLowerCase()}`, onClick:()=>hub.openRecord(r._e.object, r._e.recordId, 'panel')}]}/>,
  };
  const create = (what) => { setMenu(false); if(what === 'Email') return hub.composeEmail({}); setPanel({creating:what}); };
  const addLabel = {Call:'Call', 'Log Call':'Log call', Task:'New task', 'Schedule Meeting':'Schedule meeting', 'Log Meeting':'Log meeting', Note:'New note', Email:'New email'};
  return (
    <div style={{flex:1, minWidth:0, minHeight:0, display:'flex', flexDirection:'column', position:'relative', overflow:'hidden'}}>
      <RecordViewsModule inset="page" schema={schema} rows={rows} columns={columns.map(c => c.key)} defaultViews={page.views} storeKey={`views:tools-${pageId}`}
        actions={() => page.create.length === 1
          ? <button onClick={()=>create(page.create[0])} title={addLabel[page.create[0]]} style={toolbarIconButton}><Icon name="plus" size={14} color={T.gray800}/></button>
          : <div style={{position:'relative'}}>
              <button onClick={()=>setMenu(m => !m)} title={`New ${page.noun}`} style={toolbarIconButton}><Icon name="plus" size={14} color={T.gray800}/></button>
              <MenuShell open={menu} onClose={()=>setMenu(false)} anchorRight width={190}>
                {page.create.map(o => <MenuItem key={o} label={addLabel[o]} onClick={()=>create(o)}/>)}
              </MenuShell>
            </div>}
        overlay={panel && <ToolPanel key={panel.ref ? panel.ref.actId : panel.creating} page={page} entry={openEntry} creating={panel.creating}
          onClose={()=>setPanel(null)}
          onCreated={(id, object, recordId)=>{
            if(!id) return setPanel(null);
            setPanel({ref:{object, recordId, actId:id}});
            hub.toast(`${page.label} added`);
          }}/>}/>
    </div>
  );
}

/* ── List-and-detail pages (Calls, Emails, Meetings, Notes) ── the record Calls tab's layout across
   every record: pills over the list with the page's add button on the right, then search and
   Filters; the items on the left, each identified by its Contact, Deal or Customer; the selected
   item on the right in its usual detail (Edit, comments, Reply, ⋯ Delete). Adding asks for the
   record first, then opens the item's usual form (Email: the composer). */
// The workspace's record types only, by their names (HOF Partners: Lead calls, Customer calls).
const RECORD_FEEDS = (noun) => [{id:'all', name:`All ${noun}s`}, ...hubObjects().map(o => ({id:o, name:`${HUB_NOUN[o]} ${noun}s`}))];
const byRecordFeed = (e, feed) => feed === 'all' || e.object === feed;
// Emails' and Meetings' second level: by the record each is on.
const SECOND_LEVEL = (plural) => [{id:'all', name:`All ${plural}`}, ...hubObjects().map(o => ({id:o, name:`${HUB_NOUN[o]} ${plural}`}))];
const emailFolder = (a) => a.status === 'scheduled' ? 'scheduled' : a.direction === 'received' ? 'inbox' : 'sent';
const meetingWhen = (a) => isUpcoming(a) ? 'upcoming' : 'past';
const LIST_PAGES = {
  calls: {type:'call', noun:'call', addTab:'calls', get feeds(){ return RECORD_FEEDS('call'); }, inFeed:byRecordFeed, showDirection:true,
    line:(a) => callResult(a), added:'Call logged', search:(a) => [a.outcome, byName(a), a.body],
        fields:(a) => ({callType:isInboundCall(a) ? 'Inbound' : 'Outbound', logged:a.logged ? 'Call log' : 'Call', outcome:a.outcome || ''}),
    filters:[{key:'callType', label:'Call Type', type:'select', ops:['is', 'isNot'], values:['Inbound', 'Outbound']},
      {key:'logged', label:'Call or Call Log', type:'select', ops:['is', 'isNot'], values:['Call', 'Call log']},
      {key:'outcome', label:'Call Outcome', type:'select', ops:['is', 'isNot', 'isAnyOf']}],
    byLabel:'Call By', dateLabel:'Call Date'},
  // `tabs`: Inbox / Sent / Scheduled as the tab strip, the record types as the pills (as Meetings).
  emails: {type:'email', noun:'email', addTab:'email', feeds:EMAIL_FOLDER_TABS, get secondary(){ return SECOND_LEVEL('Emails'); }, tabs:true,
    inFeed:(e, feed) => emailFolder(e.act) === feed, line:(a) => a.title || '(No subject)',
    when:(a) => a.status === 'scheduled' ? new Date(a.scheduledFor || a.at) : new Date(a.at),
    fields:() => ({}), filters:[], byRecordType:true, search:(a) => [a.title, byName(a), a.body, ...(a.to || [])], byLabel:'From / By', dateLabel:'Email Date'},
  // `tabs`: Upcoming / Past as the tab strip (Settings → Templates'), the record types as the pills.
  meetings: {type:'meeting', noun:'meeting', addTab:'meetings', feeds:MEETING_TIME_TABS, get secondary(){ return SECOND_LEVEL('Meetings'); }, tabs:true,
    inFeed:(e, feed) => meetingWhen(e.act) === feed, line:(a) => a.title || 'Meeting',
    when:(a) => new Date(a.scheduledFor || a.at), added:'Meeting added', byRecordType:true, search:(a) => [a.title, byName(a), a.body, a.platform],
    fields:(a) => ({meetingType:a.logged ? 'Meeting log' : 'Meeting', platform:a.platform || ''}),
    filters:[{key:'meetingType', label:'Meeting Type', type:'select', ops:['is', 'isNot'], values:['Meeting', 'Meeting log']}, {key:'platform', label:'Platform', type:'select', ops:['is', 'isNot', 'isAnyOf']}],
    byLabel:'Organiser', dateLabel:'Meeting Date'},
  notes: {type:'note', noun:'note', addTab:'notes', get feeds(){ return RECORD_FEEDS('note'); }, inFeed:byRecordFeed, line:(a) => richTextPlain(a.body) || 'Note',
    added:'Note added', search:(a) => [byName(a), richTextPlain(a.body)], fields:(a) => ({linked:a.callId ? 'Call' : a.meetingId ? 'Meeting' : 'None'}),
    filters:[{key:'linked', label:'Linked To', type:'select', ops:['is', 'isNot'], values:['Call', 'Meeting', 'None']}], byLabel:'Note By', dateLabel:'Note Date'},
};
function listFilterSchema(page, rows){
  const uniq = (k) => [...new Set(rows.map(r => r[k]).filter(Boolean))].sort();
  return {
    properties:[], noun:page.noun, searchKeys:['text'], boards:false, selectable:false, cardSettings:false, associated:false,
    filterProps:[...page.filters.map(({values, ...f}) => f),
      ...(page.byRecordType ? [{key:'recordType', label:'Record Type', type:'select', ops:['is', 'isNot', 'isAnyOf']}] : []),
      {key:'by', label:page.byLabel, type:'select', ops:['is', 'isNot', 'isAnyOf']},
      {key:'date', label:page.dateLabel, type:'date', ops:['is', 'isNot', 'isBefore', 'isAfter', 'isBetween']}],
    selectValues:{...Object.fromEntries(page.filters.map(f => [f.key, f.values || uniq(f.key)])), recordType:['Contact', 'Deal', 'Customer'], by:uniq('by')},
  };
}
/* ── Whose activities (Calls, Tasks, Emails, Meetings, Notes) ── a compact selector beside the Add
   button: My [Activities] · My Team · Specific User · All, offered by the module's View permission
   (the broadest the user has across Contacts, Deals and Customers): their own only → no selector;
   their team → My, My Team, Specific User (team members); all → every option, Specific User
   from the whole workspace. An activity is someone's by the person on it: a call's point of
   contact, a task's assignee, an email's sender (a received one: its record's owner), a meeting's
   organiser, a note's author. "My" keeps the current user's view; the others lead with the
   person, as on record pages, with the record beside it. */
const VISIBILITY_TOOL = {call:'callLogs', task:'tasks', meeting:'meetings', note:'notes', email:null};
const SCOPE_RANK = {own:0, team:1, all:2};
function visibilityScope(type){
  if(!ACCESS.user || !ACCESS.perms) return 'all';
  const tool = VISIBILITY_TOOL[type];
  let best = -1;
  hubObjects().forEach(o => {
    const p = ACCESS.perms[o];
    if(!p || !p.enabled) return;
    const v = tool ? (p.tools && p.tools.enabled && p.tools[tool] && p.tools[tool].view) : p.view;
    if(v && v.on) best = Math.max(best, SCOPE_RANK[v.scope] ?? 0);
  });
  return ['own', 'team', 'all'][Math.max(best, 0)];
}
// The person an activity belongs to (a user's name).
function activityPerson(e){
  const a = e.act, view = {...e.record, owner:userLabel(e.record.owner) || e.record.owner};
  if(a.type === 'call'){ const p = callPointOfContact(a, view); return !p ? '' : p.kind === 'you' ? CURRENT_USER.name : p.name; }
  if(a.type === 'task') return a.assignee || '';
  if(a.type === 'email') return a.direction === 'received' ? view.owner || '' : byName(a);
  if(a.type === 'meeting') return a.organizer || byName(a);
  return byName(a);
}
// What the selector offers and filters by. `value`: {mode:'my'|'team'|'specific'|'all', people:[names]}.
function useVisibility(hub, type){
  const scope = visibilityScope(type);
  const users = (hub.data.users || []).filter(u => u.status === 'Activated');
  const me = users.find(u => u.name === CURRENT_USER.name) || null;
  const team = me && me.teamId ? users.filter(u => u.teamId === me.teamId).map(u => u.name) : [CURRENT_USER.name];
  const people = scope === 'all' ? users.map(u => u.name) : team;
  const [value, setValue] = React.useState({mode:'my', people:[]});
  const v = scope === 'own' ? {mode:'my', people:[]} : value;
  const keep = (e) => {
    const who = activityPerson(e);
    return v.mode === 'my' ? who === CURRENT_USER.name : v.mode === 'team' ? team.includes(who)
      : v.mode === 'specific' ? v.people.includes(who) : true;
  };
  return {scope, value:v, setValue, people, keep, personLed:v.mode !== 'my'};
}
function VisibilityOption({icon, label, active, onClick}){
  const [h, setH] = React.useState(false);
  return (
    <div onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{display:'flex', alignItems:'center', gap:10, padding:'8px 12px', cursor:'pointer', fontSize:13, color:T.attioText, background: h ? T.headerBg : 'transparent'}}>
      <Icon name={icon} size={14} color={T.gray600}/>
      <span style={{flex:1, minWidth:0, fontWeight: active ? 600 : 400}}>{label}</span>
      {active && <Icon name="check" size={13} color={T.attioText}/>}
    </div>
  );
}
/* Specific User: its own dropdown, beside the selector on its left — search the people the
   permission covers and pick one or more. The button shows who's picked. */
function PeoplePicker({vis, open, setOpen}){
  const [q, setQ] = React.useState('');
  const picked = vis.value.people;
  const togglePerson = (n) => vis.setValue(x => ({mode:'specific', people: x.people.includes(n) ? x.people.filter(p => p !== n) : [...x.people, n]}));
  const shown = vis.people.filter(n => n.toLowerCase().includes(q.trim().toLowerCase()));
  const label = picked.length === 1 ? picked[0] : picked.length ? `${picked.length} users` : 'Select people';
  return (
    <div style={{position:'relative'}}>
      <button onClick={()=>setOpen(o => !o)} title="People" style={toolbarDropdownBtn(open)}>
        {picked.length === 1 ? <PersonAvatar kind="team" name={picked[0]}/> : <Icon name="usersThree" size={13} color={T.gray600}/>}
        <span style={{minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color: picked.length ? T.attioText : T.attioMuted}}>{label}</span>
        <Icon name="chevDown" size={T.chevronSize} color={T.gray600} style={{transform: open ? 'rotate(180deg)' : 'none'}}/>
      </button>
      <MenuShell open={open} onClose={()=>setOpen(false)} anchorRight width={260}>
        <div style={{padding:'8px 10px', display:'flex', flexDirection:'column', gap:4}}>
          <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Search people" aria-label="Search people" style={{...fieldText, padding:'6px 8px'}}/>
          <div style={{maxHeight:260, overflowY:'auto', display:'flex', flexDirection:'column'}}>
            {shown.map(n => (
              <label key={n} onClick={()=>togglePerson(n)} style={{display:'flex', alignItems:'center', gap:8, padding:'5px 2px', fontSize:13, color:T.attioText, cursor:'pointer'}}>
                <RowCheckbox checked={picked.includes(n)} onChange={()=>togglePerson(n)}/>
                <PersonAvatar kind="team" name={n}/>
                <span style={{minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{n}</span>
              </label>
            ))}
            {!shown.length && <div style={{fontSize:12.5, color:T.attioMuted, padding:'6px 2px'}}>No one found.</div>}
          </div>
        </div>
      </MenuShell>
    </div>
  );
}
function VisibilitySelector({vis, noun}){
  const [open, setOpen] = React.useState(false);
  const [peopleOpen, setPeopleOpen] = React.useState(false);
  if(vis.scope === 'own') return null;
  const plural = `${noun}s`;
  const opts = [{mode:'my', label:`My ${plural}`, icon:'user'}, {mode:'team', label:'My Team', icon:'usersThree'},
    {mode:'specific', label:'Specific User', icon:'userSwitch'}, ...(vis.scope === 'all' ? [{mode:'all', label:`All ${plural}`, icon:'listBullets'}] : [])];
  const cur = opts.find(o => o.mode === vis.value.mode) || opts[0];
  return (
    <div style={{display:'flex', alignItems:'center', gap:8}}>
      {cur.mode === 'specific' && <PeoplePicker vis={vis} open={peopleOpen} setOpen={setPeopleOpen}/>}
      <div style={{position:'relative'}}>
        <button onClick={()=>setOpen(o => !o)} title="Whose activities" style={toolbarDropdownBtn(open)}>
          <Icon name={cur.icon} size={13} color={T.gray600}/>
          <span style={{minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{cur.label}</span>
          <Icon name="chevDown" size={T.chevronSize} color={T.gray600} style={{transform: open ? 'rotate(180deg)' : 'none'}}/>
        </button>
        <MenuShell open={open} onClose={()=>setOpen(false)} anchorRight width={220}>
          {opts.map(o => (
            <VisibilityOption key={o.mode} icon={o.icon} label={o.label} active={o.mode === cur.mode}
              onClick={()=>{ setOpen(false);
                if(o.mode === 'specific'){ if(cur.mode !== 'specific') vis.setValue({mode:'specific', people:[]}); setPeopleOpen(true); return; }
                vis.setValue({mode:o.mode, people:[]}); setPeopleOpen(false); }}/>
          ))}
        </MenuShell>
      </div>
    </div>
  );
}

// An item in the list, from the current user's side: "Call to / Received from / Meeting with /
// Note added to [Record] · Contact" (the name opens the record's side panel) and when, then its main line.
function ListToolItem({page, e, selected, onSelect, personLed}){
  const [h, setH] = React.useState(false);
  const quiet = {fontSize:12, color:T.attioMuted};
  const at = page.when ? page.when(e.act) : new Date(e.act.at);
  const view = {...e.record, owner:userLabel(e.record.owner) || e.record.owner};
  return (
    <div onClick={onSelect} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{background: selected ? '#F4F5F7' : h ? T.headerBg : 'transparent', padding:'10px 20px', cursor:'pointer', transition:'background 120ms ease'}}>
      <div style={{display:'flex', alignItems:'center', gap:8, minWidth:0}}>
        {personLed ? (
          /* A team's / anyone's: the record pages' person-led line, then the record. */
          <span style={{...quiet, flex:1, minWidth:0, display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap'}}>
            <span style={{minWidth:0, flex:'0 1 auto', display:'flex'}}><ActivityLead a={e.act} lead={activityLines(e.act, view, 'all').lead} style={quiet}/></span>
            <span style={{flexShrink:0}}>·</span>
            <span onClick={ev=>ev.stopPropagation()} style={{minWidth:0, flex:'0 1000 auto', overflow:'hidden', display:'flex'}}>
              <HubRecordLink object={e.object} id={e.recordId} name={e.record.name}/>
            </span>
            <span style={{flexShrink:0}}>· {HUB_NOUN[e.object]}</span>
          </span>
        ) : (
          <span style={{...quiet, flex:1, minWidth:0, display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap'}}>
            <span style={{flexShrink:0}}>{acrossLead(e.act)}</span>
            <span onClick={ev=>ev.stopPropagation()} style={{minWidth:0, overflow:'hidden', display:'flex'}}>
              <HubRecordLink object={e.object} id={e.recordId} name={e.record.name}/>
            </span>
            <span style={{flexShrink:0}}>· {HUB_NOUN[e.object]}</span>
            {page.showDirection && <CallDirection incoming={isInboundCall(e.act)}/>}
          </span>
        )}
        <span style={{...quiet, flexShrink:0, whiteSpace:'nowrap'}}>{fmtActStamp(at)}</span>
      </div>
      <div style={{display:'flex', alignItems:'center', gap:8, marginTop:4, minWidth:0}}>
        <span style={{flex:1, minWidth:0, fontSize:13, fontWeight:500, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{page.line(e.act)}</span>
        {e.threadCount > 1 && <span title={`${e.threadCount} emails in this thread`} style={{flexShrink:0, fontSize:11, fontWeight:600, color:T.gray600, background:T.headerBg, borderRadius:9999, padding:'1px 7px'}}>{e.threadCount}</span>}
      </div>
    </div>
  );
}
/* A new activity from a Tools page: the creation side panel with the record first (Record Type,
   then the record), then the activity's form. `what`: 'Call' (start a call), 'Log Call', 'Note',
   'Task', 'Schedule Meeting', 'Log Meeting'. `onDone(id, target)`. */
function NewActivityPanel({what, initialObject, team, prefill, onDone}){
  const hub = useRecordHub();
  const [target, setTarget] = React.useState({object:initialObject || hubObjects()[0], id:null});
  const record = target.id != null ? hubRecord(hub, target.object, target.id) : null;
  const view = record && {...record, owner:userLabel(record.owner) || record.owner};
  const onAdd = (a) => record && hub.add(target.object, target.id, a);
  const finish = (id) => onDone(id, target);
  const phone = record ? (hubRecordPerson(hub, target.object, target.id) || {}).phone : null;
  const recordField = <CreateRecordField value={target} onChange={setTarget}/>;
  const form = what === 'Call'
    ? <CreatePanelFrame title="Call" onClose={()=>finish(null)} top={recordField} actions={<>
        <StSecondary label="Cancel" onClick={()=>finish(null)}/>
        <StCta icon="call" label="Start call" disabled={!phone} onClick={()=>{ hub.startCall({object:target.object, id:target.id}); finish(null); }}/>
      </>}>
        {stack(<Field label="Phone"><ReadValue>{record ? phone || 'No phone number on this record.' : ''}</ReadValue></Field>)}
      </CreatePanelFrame>
    : what === 'Log Call' ? <NewLogCall contact={view} team={team} onAdd={onAdd} onDone={finish}/>
    : what === 'Note' ? <NewNote onAdd={onAdd} onDone={finish}/>
    : what === 'Task' ? <NewTask team={team} contact={view} initial={prefill} onAdd={onAdd} onDone={finish}/>
    : what === 'Schedule Meeting' ? <NewScheduleMeeting contact={view} team={team} onAdd={onAdd} onDone={finish}/>
    : what === 'Log Meeting' ? <NewLogMeeting contact={view} team={team} onAdd={onAdd} onDone={finish}/>
    : null;
  return (
    <CreatePanelCtx.Provider value={{record:recordField, ready:!!record}}>
      {record ? <RecordAccessCtx.Provider value={{object:target.object, record}}>{form}</RecordAccessCtx.Provider> : form}
    </CreatePanelCtx.Provider>
  );
}
function ListToolPage({pageId}){
  const hub = useRecordHub();
  const page = LIST_PAGES[pageId];
  const team = (hub.data.users || []).filter(u => u.status === 'Activated').map(u => u.name);
  const [feed, setFeed] = React.useState(page.feeds[0].id);
  const [scope, setScope] = React.useState('all');   // the second level (Emails, Meetings): the record type
  const [search, setSearch] = React.useState('');
  const [filters, setFilters] = React.useState(EMPTY_FILTERS);
  const [selected, setSelected] = React.useState(null);   // {object, recordId, actId}
  const [adding, setAdding] = React.useState(null);       // what's being added ('Log Call', 'Note', …)
  const [compose, setCompose] = React.useState(null);     // the email composer's options (new, reply, forward)
  const [stub, setStub] = React.useState(null);
  const vis = useVisibility(hub, page.type);
  const entries = hubActivities(hub, page.type).filter(vis.keep);
  const rows = entries.map(e => ({id:e.act.id, _e:e, ...page.fields(e.act), recordType:HUB_NOUN[e.object], by:byName(e.act, e.record),
    date:activityDateValue(page.when ? page.when(e.act) : e.act.at), text:[e.record.name, ...page.search(e.act)].filter(Boolean).join(' ')}));
  const schema = listFilterSchema(page, rows);
  const q = search.trim().toLowerCase();
  const when = (e) => (page.when ? page.when(e.act) : new Date(e.act.at)).getTime();
  // Upcoming meetings soonest first; everything else newest first.
  let shown = applyFilters(rows.filter(r => page.inFeed(r._e, feed) && (!page.secondary || byRecordFeed(r._e, scope)) && (!q || r.text.toLowerCase().includes(q))), filters, schema.filterProps)
    .map(r => r._e).sort((a, b) => pageId === 'meetings' && feed === 'upcoming' ? when(a) - when(b) : when(b) - when(a));
  /* Emails: one row per thread — its latest email in this folder, with how many the thread has
     (emails.jsx), threads kept apart per record. */
  const threadRows = page.type === 'email' ? threadedEmailRows(shown, (e) => e.act, (e) => `${e.object}:${e.recordId}`, (e) => (hub.activities[e.object] || {})[e.recordId] || []) : null;
  if(threadRows) shown = threadRows.map(t => ({...t.item, threadCount:t.count}));
  const current = (selected && shown.find(e => e.act.id === selected.actId)) || (!selected && shown[0]) || null;
  const sel = current || (selected && entries.find(e => e.act.id === selected.actId)) || null;
  const pick = (what) => {
    if(what === 'Start Meeting') return setStub('Start Meeting');   // a live meeting: not defined yet
    setCompose(null); setAdding(null);
    if(what === 'Email') return setCompose({object: hubObjects().includes(scope) ? scope : hubObjects().includes(feed) ? feed : undefined});
    setAdding(what);
  };
  const view = (r) => r && {...r, owner:userLabel(r.owner) || r.owner};
  const done = (id, target) => { setAdding(null); if(id){ setSelected({object:target.object, recordId:target.id, actId:id}); setFeed(page.feeds.find(f => f.id === 'all') ? 'all' : feed); setScope('all'); hub.toast(page.added); } };
  // A sent or scheduled email: shown in the folder it's in.
  const emailDone = (result, id, target) => { setCompose(null); if(id){ setFeed(result === 'scheduled' ? 'scheduled' : 'sent'); setSelected({object:target.object, recordId:target.id, actId:id}); } };
  const empty = entries.length ? `No ${page.noun}s match these filters.` : `No ${page.noun}s yet.`;
  return (
    <RecordSchema.Provider value={schema}>
      <div style={{flex:1, minWidth:0, minHeight:0, display:'flex', flexDirection:'column', overflow:'hidden', background:'#fff'}}>
        {page.tabs && <PrimaryTabs items={page.feeds} active={feed} onSelect={(id)=>{ setFeed(id); setSelected(null); }}/>}
        <RecordToolbar inset="page" views={page.tabs ? page.secondary : page.feeds} activeViewId={page.tabs ? scope : feed}
          onSelectView={(id)=>{ if(page.tabs) setScope(id); else setFeed(id); setSelected(null); }}
          controls={<div style={{display:'flex', alignItems:'center', gap:8}}><VisibilitySelector vis={vis} noun={sentenceCase(page.noun)}/><ActivityAddButton iconOnly tabId={page.addTab} onPick={pick}/></div>}
          search={search} onSearch={setSearch} filters={filters} setFilters={(f)=>setFilters(typeof f === 'function' ? f(filters) : f)}
          appliedFilterCount={countAppliedFilters(filters, schema.filterProps)}/>
        {page.secondary && !page.tabs && <SubPills items={page.secondary} active={scope} onSelect={(id)=>{ setScope(id); setSelected(null); }}/>}
        <ComposeHostCtx.Provider value={{compose:(o)=>{ setAdding(null); setCompose(o); }}}>
        <div style={{flex:1, minHeight:0, display:'flex', overflow:'hidden', borderTop:`1px solid ${T.border}`, position:'relative'}}>
          <div style={{width:460, flexShrink:0, overflowY:'auto', borderRight:`1px solid ${T.border}`, padding:'8px 0'}}>
            {shown.map(e => <ListToolItem key={e.act.id} page={page} e={e} personLed={vis.personLed} selected={current && current.act.id === e.act.id}
              onSelect={()=>setSelected({object:e.object, recordId:e.recordId, actId:e.act.id})}/>)}
            {!shown.length && <div style={{fontSize:13, color:T.attioMuted, padding:'24px 20px', textAlign:'center'}}>{empty}</div>}
          </div>
          <div style={{flex:1, minWidth:0, minHeight:0, display:'flex', flexDirection:'column'}}>
            {sel ? (
              <RecordAccessCtx.Provider value={{object:sel.object, record:sel.record}}>
                <ActivityDetail key={sel.act.id} a={sel.act} contact={view(sel.record)} team={team}
                  acts={(hub.activities[sel.object] || {})[sel.recordId] || []}
                  onUpdate={(id, patch)=>hub.update(sel.object, sel.recordId, id, patch)} onAdd={(a)=>hub.add(sel.object, sel.recordId, a)}
                  onStub={hub.toast} onReassign={()=>{}} across={{object:sel.object, record:sel.record, perspective: vis.personLed ? 'person' : 'mine'}}/>
              </RecordAccessCtx.Provider>
            ) : null}
          </div>
          {/* New items: the creation side panel over this area (record first). */}
          {adding && <NewActivityPanel key={adding} what={adding} initialObject={hubObjects().includes(scope) ? scope : hubObjects().includes(feed) ? feed : hubObjects()[0]} team={team} onDone={done}/>}
          {compose && <EmailComposer key={compose.replyTo ? `re-${compose.replyTo.id}` : compose.forward ? `fw-${compose.forward.id}` : 'new'} {...compose} onClose={emailDone}/>}
        </div>
        </ComposeHostCtx.Provider>
      </div>
      {stub && <StubPanel title={stub} onClose={()=>setStub(null)} zIndex={110}/>}
    </RecordSchema.Provider>
  );
}
const CallsToolPage = () => <ListToolPage pageId="calls"/>;

/* ── Tools → Tasks ── every task (Contacts, Deals, Customers) as a board by status: In Progress,
   Overdue, Completed. A card shows the task's name and description, its record and record type,
   due date, task type, who assigned it and when it was created. Dragging a card to Completed
   completes it; to In Progress reopens it — asking for a new due date when it's past due; nothing
   is dragged into Overdue (it's worked out). Opening a card shows the task's usual detail (Edit,
   assignment, due date, ⋯ Delete) and its record; Add task asks for the record, then the form. */
const TASK_FEEDS = () => RECORD_FEEDS('task');
function TaskCard({e, onOpen, onDragStart, dragging, showAssignee}){
  const a = e.act;
  // The board card's property rows: label on the left, value on the right.
  const row = (label, value, tone) => (
    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12}}>
      <span style={{fontSize:12.5, color:T.attioMuted, flexShrink:0}}>{label}</span>
      <span style={{fontSize:12.5, color: tone || T.attioText, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{value || '—'}</span>
    </div>
  );
  return (
    <div draggable onDragStart={onDragStart} onClick={onOpen}
      style={{background:'#fff', border:`1px solid ${T.borderStrong}`, borderRadius:10, cursor:'pointer', opacity: dragging ? .5 : 1,
        boxShadow:'0 1px 2px rgba(16,24,40,.05)', minWidth:0, flexShrink:0}}>
      <div style={{padding:'14px 16px 12px', display:'flex', flexDirection:'column', gap:6}}>
        <div style={{fontSize:13.5, fontWeight:500, color:T.attioText, lineHeight:1.35, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{a.title || 'Task'}</div>
        {a.description && <div style={{fontSize:13, color:T.attioMuted, lineHeight:1.4, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{a.description}</div>}
      </div>
      <div style={{padding:'14px 16px 16px', display:'flex', flexDirection:'column', gap:10, borderTop:`1px solid ${T.attioLine}`}}>
        {row('Record', e.record.name)}
        {row('Record Type', HUB_NOUN[e.object])}
        {row('Due Date', a.due ? fmtTaskDue(a) : '', isOverdue(a) ? T.red : null)}
        {row('Task Type', a.taskType)}
        {showAssignee && row('Assigned To', a.assignee)}
        {row('Assigned By', byName(a))}
        {row('Created Date', fmtActDate(new Date(a.at)))}
      </div>
    </div>
  );
}
/* The three-column board — the Tasks module's and a record's Tasks tab's. `entries`: tasks as
   {act, object, recordId, record}; `onUpdate(entry, patch)`; `onOpen(entry)`. */
function TaskStatusBoard({entries, onUpdate, onOpen, showAssignee}){
  const [drag, setDrag] = React.useState(null);     // the dragged task's id
  const [over, setOver] = React.useState(null);     // the column it's over
  const [rescheduling, setRescheduling] = React.useState(null);   // {e, date, time}: In Progress needs a new due date
  // Within a column: due soonest first, tasks without a due date after.
  const ordered = (list) => list.slice().sort((x, y) => (x.act.due ? new Date(x.act.due).getTime() : Infinity) - (y.act.due ? new Date(y.act.due).getTime() : Infinity));
  const drop = (state) => {
    const e = entries.find(x => x.act.id === drag);
    setDrag(null); setOver(null);
    if(!e || state === 'overdue' || taskState(e.act) === state) return;
    if(state === 'completed') return onUpdate(e, {status:'completed'});
    if(isPastDue(e.act)) return setRescheduling({e, date:'', time:''});
    onUpdate(e, {status:'inProgress'});
  };
  const rs = rescheduling, rsDue = rs && rs.date ? taskDueValue(rs.date, rs.time) : null, rsOk = !!rsDue && !isPastDue(rsDue);
  return (
    <div style={{flex:1, minWidth:0, overflowX:'auto', overflowY:'hidden', background:T.headerBg, display:'flex', gap:12, padding:16}}>
      {TASK_STATES.map(st => {
        const col = ordered(entries.filter(e => taskState(e.act) === st.key)), canDrop = st.key !== 'overdue';
        return (
          <div key={st.key} onDragOver={ev=>{ if(!canDrop) return; ev.preventDefault(); if(over !== st.key) setOver(st.key); }} onDragLeave={()=>setOver(o => o === st.key ? null : o)} onDrop={()=>drop(st.key)}
            style={{flex:'1 0 260px', minWidth:0, display:'flex', flexDirection:'column', minHeight:0, borderRadius:12, background: over === st.key ? '#EEF2FB' : '#F4F5F7',
              border:`1px solid ${over === st.key ? T.attioBlue : T.attioLine}`}}>
            <div style={{display:'flex', alignItems:'center', gap:8, padding:'12px 14px 8px'}}>
              <span style={{fontSize:13, fontWeight:600, color: st.key === 'overdue' ? T.red : T.attioText}}>{st.label}</span>
              <span style={{fontSize:12, color:T.attioMuted, fontVariantNumeric:'tabular-nums'}}>{col.length}</span>
              {st.key === 'overdue' && <span style={{fontSize:11.5, color:T.attioMuted, marginLeft:'auto'}}>Automatic</span>}
            </div>
            <div style={{flex:1, minHeight:0, overflowY:'auto', padding:'0 10px 12px', display:'flex', flexDirection:'column', gap:8}}>
              {col.map(e => <TaskCard key={e.act.id} e={e} showAssignee={showAssignee} dragging={drag === e.act.id}
                onDragStart={()=>setDrag(e.act.id)} onOpen={()=>onOpen(e)}/>)}
              {!col.length && <div style={{fontSize:12.5, color:T.attioMuted, padding:'12px 4px', textAlign:'center'}}>No tasks</div>}
            </div>
          </div>
        );
      })}
      {rs && <StModal title="New due date" primary="Move to In Progress" canSubmit={rsOk} onCancel={()=>setRescheduling(null)}
        onSubmit={()=>{ if(!rsOk) return; onUpdate(rs.e, {status:'inProgress', ...rsDue}); setRescheduling(null); }}>
        <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>{rs.e.act.title || 'This task'} is past its due date. Give it a new one to move it back to In Progress.</div>
        <div style={{display:'flex', gap:12}}>
          <div style={{flex:1}}><label style={fieldLabel}>Due date</label><DateField required value={rs.date} onChange={v=>setRescheduling(x => ({...x, date:v}))} ariaLabel="Due date"/></div>
          <div style={{flex:1}}><label style={fieldLabel}>Due time</label><TimeField value={rs.time} onChange={v=>setRescheduling(x => ({...x, time:v}))} ariaLabel="Due time"/></div>
        </div>
        {rs.date && !rsOk && <div style={{fontSize:12, color:T.red}}>Choose a date and time that haven't passed.</div>}
      </StModal>}
    </div>
  );
}
function TasksBoardPage(){
  const hub = useRecordHub();
  const team = (hub.data.users || []).filter(u => u.status === 'Activated').map(u => u.name);
  const [feed, setFeed] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [filters, setFilters] = React.useState(EMPTY_FILTERS);
  const [panel, setPanel] = React.useState(null);   // {ref:{object, recordId, actId}}: the open task
  const [adding, setAdding] = React.useState(false); // the creation panel is open
  const vis = useVisibility(hub, 'task');
  // The pipeline on the board: its stages are the columns (Settings → Tasks).
  const pipelines = taskPipelinesOf(hub.data);
  const [pipelineId, setPipelineId] = React.useState(DEFAULT_TASK_PIPELINE_ID);
  const pipeline = pipelines.find(p => p.id === pipelineId) || pipelines[0];
  const entries = hubActivities(hub, 'task').filter(vis.keep).filter(e => taskPipelineIdOf(e.act) === pipeline.id);
  const rows = entries.map(e => ({id:e.act.id, _e:e, taskType:e.act.taskType || '', assignee:e.act.assignee || '', by:byName(e.act, e.record),
    due:e.act.due ? activityDateValue(e.act.due) : '', date:activityDateValue(e.act.at), text:[e.act.title, e.act.description, e.record.name, e.act.assignee].filter(Boolean).join(' ')}));
  const uniq = (k) => [...new Set(rows.map(r => r[k]).filter(Boolean))].sort();
  const schema = {properties:[], noun:'task', searchKeys:['text'], boards:false, selectable:false, cardSettings:false, associated:false,
    filterProps:[{key:'taskType', label:'Task Type', type:'select', ops:['is', 'isNot', 'isAnyOf']}, {key:'assignee', label:'Assigned To', type:'select', ops:['is', 'isNot', 'isAnyOf']},
      {key:'by', label:'Assigned By', type:'select', ops:['is', 'isNot', 'isAnyOf']}, {key:'due', label:'Due Date', type:'date', ops:['is', 'isNot', 'isBefore', 'isAfter', 'isBetween']},
      {key:'date', label:'Created Date', type:'date', ops:['is', 'isNot', 'isBefore', 'isAfter', 'isBetween']}],
    selectValues:{taskType:TASK_TYPES, assignee:uniq('assignee'), by:uniq('by')}};
  const q = search.trim().toLowerCase();
  const shown = applyFilters(rows.filter(r => byRecordFeed(r._e, feed) && (!q || r.text.toLowerCase().includes(q))), filters, schema.filterProps).map(r => r._e);
  // The open task is looked up among all tasks: reassigned or moved to another pipeline, it's still there.
  const openEntry = panel && panel.ref ? hubActivities(hub, 'task').find(e => e.act.id === panel.ref.actId) || null : null;
  const view = (r) => r && {...r, owner:userLabel(r.owner) || r.owner};
  return (
    <RecordSchema.Provider value={schema}>
      <div style={{flex:1, minWidth:0, minHeight:0, display:'flex', flexDirection:'column', overflow:'hidden', background:'#fff', position:'relative'}}>
        <RecordToolbar inset="page" views={TASK_FEEDS()} activeViewId={feed} onSelectView={setFeed}
          controls={<div style={{display:'flex', alignItems:'center', gap:8}}>
            <PipelineSelector pipelines={pipelines.map(p => ({id:p.id, label:p.name}))} pipelineId={pipeline.id} onChange={setPipelineId}/>
            <VisibilitySelector vis={vis} noun="Task"/><ActivityAddButton iconOnly tabId="tasks" onPick={()=>{ setPanel(null); setAdding(true); }}/></div>}
          search={search} onSearch={setSearch} filters={filters} setFilters={(f)=>setFilters(typeof f === 'function' ? f(filters) : f)}
          appliedFilterCount={countAppliedFilters(filters, schema.filterProps)}/>
        <div style={{flex:1, minHeight:0, display:'flex', position:'relative', borderTop:`1px solid ${T.border}`}}>
        <TaskStatusBoard entries={shown} showAssignee={vis.personLed} onUpdate={(e, patch)=>hub.update(e.object, e.recordId, e.act.id, patch)}
          onOpen={(e)=>setPanel({ref:{object:e.object, recordId:e.recordId, actId:e.act.id}})}/>
        {/* New task: the creation side panel over the board (record first). */}
        {adding && <NewActivityPanel what="Task" initialObject={hubObjects().includes(feed) ? feed : hubObjects()[0]} team={team} prefill={{pipelineId:pipeline.id}}
          onDone={(id, target)=>{ setAdding(false); if(id){ setPanel({ref:{object:target.object, recordId:target.id, actId:id}}); hub.toast('Task added'); } }}/>}
        </div>
        {panel && (
          <PageSidePanel width={560} title={(openEntry && openEntry.act.title) || 'Task'} subtitle={openEntry ? `${HUB_NOUN[openEntry.object]} · ${openEntry.record.name}` : ''}
            onClose={()=>setPanel(null)} menuItems={openEntry ? [{label:`Open ${HUB_NOUN[openEntry.object].toLowerCase()}`, onClick:()=>hub.openRecord(openEntry.object, openEntry.recordId, 'panel')}] : undefined}>
            <div style={{flex:1, minHeight:0, display:'flex', flexDirection:'column'}}>
              {openEntry ? <RecordAccessCtx.Provider value={{object:openEntry.object, record:openEntry.record}}>
                <ActivityDetail key={openEntry.act.id} a={openEntry.act} contact={view(openEntry.record)} team={team}
                  acts={(hub.activities[openEntry.object] || {})[openEntry.recordId] || []}
                  onUpdate={(id, patch)=>hub.update(openEntry.object, openEntry.recordId, id, patch)} onAdd={(a)=>hub.add(openEntry.object, openEntry.recordId, a)}
                  onStub={hub.toast} onReassign={()=>{}}/>
              </RecordAccessCtx.Provider> : <div style={{padding:24, fontSize:13, color:T.attioMuted}}>This task was deleted.</div>}
            </div>
          </PageSidePanel>
        )}
      </div>
    </RecordSchema.Provider>
  );
}

const TOOL_PAGE_IDS = Object.keys(TOOL_PAGES);
Object.assign(window, {TaskStatusBoard, TaskCard, CallsToolPage, ListToolPage, LIST_PAGES, TasksBoardPage, TOOL_PAGES, TOOL_PAGE_IDS, ToolActivityPage});
