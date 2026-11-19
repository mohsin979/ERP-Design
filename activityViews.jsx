/* HOF Pulse ERP — Activity feeds (Contact, Deal and Customer records).

   Every activity tab on a record (Activity, Calls, Email, Notes, Tasks, Meetings) shows three
   feeds as pills — Contacts, Deals, Customers (e.g. Contact calls, Deal calls, Customer calls,
   as on Tools → Calls). The record's own type is its own activity, as it always was; the other
   two are the activity of its associated records of that type (a contact's deals and customers;
   a deal's contact and customers; a customer's contact and deals), each row naming the record
   it's on. The record's own feed opens first. Each feed has search and two filters, Activity Type (on the
   Activity tab — the others are one type) and Activity Date, in the record lists' toolbar and
   filter popover. No saved views, View settings or associated-object filters: simple over
   systematic. The chosen feed is kept per tab for the session; search and filters are per feed
   while the record is open.

   On a record (2026-11-19, Mohsin) the feeds aren't pills: they're the record's journey —
   Lead → Deal → Customer (RecordJourney), each step its label and the day its record was made
   ("Landed <date>" on the Lead step), an arrow between; a step
   picked shows its activity below, in place, and on another record's step the Add becomes
   "Go to <Deal>" (JourneyGoTo) — the activity there names and links no record. A step the record
   hasn't reached is greyed and can't be picked. On a contact the Deal step is all its deals
   ("Deals (2)", their activity together) and the Customer step all its customers; on a deal the
   Deal step is that deal alone, the Contact step its contact and the Customer step its customers;
   on a customer, its contact, its deals, and itself. The Tools pages keep the pills. */

const ACTIVITY_TAB_NOUNS = {activity:'activity', calls:'calls', email:'emails', notes:'notes', supportNotes:'support notes', tasks:'tasks', meetings:'meetings'};
const ACTIVITY_FEED_OBJECTS = ['contacts', 'deals', 'customers'];
// The feeds of a tab, one per record type of the workspace (HOF Partners: Lead and Customer).
// Title Case: "Contact Calls", "Deal Activity".
const activityFeeds = (tabId) => ACTIVITY_FEED_OBJECTS.filter(workspaceHasType).map(o => ({id:o, name:`${HUB_NOUN[o]} ${ACTIVITY_TAB_NOUNS[tabId].replace(/^./, c => c.toUpperCase())}`}));
/* A record's associated records of each type (its own type: none — that feed is its own activity). */
function associatedRecords(hub, object, record){
  const all = (o) => (hub && hub.records[o]) || [];
  const byId = (o, id) => id == null ? null : all(o).find(r => String(r.id) === String(id)) || null;
  const self = byId(object, record.id) || record;
  const listsMe = (r) => contactIdsOf(r).some(id => sameId(id, self.id)), contactsOf = (r) => contactIdsOf(r).map(id => byId('contacts', id)).filter(Boolean);
  if(object === 'contacts') return {contacts:[], deals:all('deals').filter(listsMe), customers:all('customers').filter(listsMe)};
  if(object === 'deals') return {contacts:contactsOf(self), deals:[],
    customers:all('customers').filter(c => (c.dealIds || []).some(id => String(id) === String(self.id)))};
  return {contacts:contactsOf(self), deals:(self.dealIds || []).map(id => byId('deals', id)).filter(Boolean), customers:[]};
}
/* The journey's steps: each record type with the records at it — the record itself at its own.
   A step names no one (Mohsin, 2026-11-19): its label, then the day its record was made (the
   earliest, when there are several) — "Landed <date>" on the Lead step only, when the lead came
   into the CRM; a Deal or Customer step just its date. The records' names are the step's tooltip. */
const recordDateOf = (r) => { const d = new Date((r && (r.createdAt || r.created)) || NaN); return isNaN(d) ? null : d; };
const fmtJourneyDate = (d) => d ? d.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}) : '';
function RecordJourney({hub, object, record, active, onSelect}){
  const assoc = associatedRecords(hub, object, record);
  const objs = ACTIVITY_FEED_OBJECTS.filter(workspaceHasType);
  const recsOf = (o) => o === object ? [record] : (assoc[o] || []);
  const steps = objs.map(o => {
    const recs = recsOf(o), landed = recs.map(recordDateOf).filter(Boolean).sort((a, b) => a - b)[0] || null;
    return {o, recs, landed, label: recs.length > 1 ? `${typePlural(o, o.charAt(0).toUpperCase() + o.slice(1))} (${recs.length})` : HUB_NOUN[o]};
  });
  return (
    <div role="tablist" aria-label="Record journey" style={{display:'flex', alignItems:'stretch', gap:6, padding:'12px 16px 0', overflowX:'auto'}}>
      {steps.map((s, i) => { const on = s.o === active, reached = s.recs.length > 0;
        return (
          <React.Fragment key={s.o}>
            {i > 0 && <span aria-hidden="true" style={{display:'flex', alignItems:'center', flexShrink:0, opacity: reached ? 1 : .45}}><Icon name="arrowRight" size={14} color={T.gray600}/></span>}
            <button type="button" role="tab" aria-selected={on} disabled={!reached} onClick={()=>reached && onSelect(s.o)}
              title={reached ? s.recs.map(r => r.name).join(', ') : undefined}
              style={{flex:'1 1 0', minWidth:0, textAlign:'left', padding:'8px 12px', borderRadius:10, fontFamily:'inherit',
                border:`1px solid ${on ? T.black : T.borderStrong}`, background: on ? '#F4F5F7' : '#fff', opacity: reached ? 1 : .45,
                cursor: reached ? 'pointer' : 'default', display:'flex', flexDirection:'column', gap:4}}>
              <span style={{fontSize:11, fontWeight:600, letterSpacing:.4, textTransform:'uppercase', color:T.attioMuted}}>{s.label}</span>
              <span style={{fontSize:13, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'100%'}}>{s.landed ? `${s.o === 'contacts' ? 'Landed ' : ''}${fmtJourneyDate(s.landed)}` : '—'}</span>
            </button>
          </React.Fragment>
        ); })}
    </div>
  );
}
/* On another step than the record's own, the toolbar's Add gives way to "Go to <Deal>" — a text
   action that opens that record (several: a menu of them). Its activity names no record and has
   no record links (Mohsin, 2026-11-19): going there is this one action. */
function JourneyGoTo({hub, object, records}){
  const [open, setOpen] = React.useState(false);
  if(!records.length) return null;
  const go = (r) => { setOpen(false); hub.openRecord(object, r.id); };
  return (
    <div style={{position:'relative'}}>
      <button type="button" className={LINK_CLASS} onClick={()=>records.length === 1 ? go(records[0]) : setOpen(o => !o)}
        style={{border:'none', background:'transparent', padding:'6px 0', cursor:'pointer', fontFamily:'inherit', fontSize:13, color:T.attioText, whiteSpace:'nowrap'}}>
        Go to {HUB_NOUN[object]}</button>
      {records.length > 1 && <MenuShell open={open} onClose={()=>setOpen(false)} anchorRight width={220}>
        {records.map(r => <MenuItem key={r.id} label={r.name || '—'} onClick={()=>go(r)}/>)}
      </MenuShell>}
    </div>
  );
}

/* Rows for an associated feed: each record's activity (what the user may see), with the record. */
const associatedFeedRows = (hub, object, records) => records.flatMap(r =>
  activityFilterRows([{acts:visibleActivities(object, r, ((hub && hub.activities[object]) || {})[r.id])}]).map(row => ({...row, _rec:{object, record:r}})));

/* ── Filter fields ─────────────────────────────────────────────────────────────────────── */

const activityDateValue = (d) => d ? new Date(d).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}) : '';
// Activity types (File change: listed for when file activity exists).
const ACTIVITY_TYPE_VALUES = ['Email', 'Call', 'Meeting', 'Task', 'Note', 'File', 'File deleted', 'Quote', 'Owner change', 'Property change', 'Workflow'];
const ACTIVITY_TYPE_LABEL = {email:'Email', call:'Call', meeting:'Meeting', task:'Task', note:'Note', file:'File', fileChange:'File deleted', quote:'Quote', document:'Document', ownerChange:'Owner change', propertyChange:'Property change', stageChange:'Stage change', customerCreated:'Customer created', taskReassigned:'Task reassigned', payment:'Payment', recordsMerged:'Records merged', recordsSplit:'Records split', workflow:'Workflow', formSubmitted:'Form submitted', recordCreated:'Record created', dealCreated:'Deal created', duplicateFound:'Duplicate found', sequence:'Sequence', meetingRescheduled:'Meeting rescheduled', profile:'Customer Profile', invoice:'Invoice issued'};
// An activity always has a type and a date, so no Is empty / Is not empty.
const ACTIVITY_TYPE_OPS = ['is', 'isNot', 'isAnyOf'], ACTIVITY_DATE_OPS = ['is', 'isNot', 'isBefore', 'isAfter', 'isBetween'];
/* The filters a tab offers: Activity Type (Activity tab) and Activity Date. */
function activityFilterSchema(tabId){
  return {
    properties:[], noun:'activity', searchKeys:['text'], boards:false, selectable:false, cardSettings:false, associated:false,
    filterProps:[
      ...(!ACTIVITY_TAB_TYPES[tabId] ? [{key:'type', label:'Activity Type', type:'select', ops:ACTIVITY_TYPE_OPS}] : []),
      {key:'date', label:'Activity Date', type:'date', ops:ACTIVITY_DATE_OPS},
    ],
    selectValues:{type:ACTIVITY_TYPE_VALUES},
  };
}

/* Rows to filter: one per activity, with its type and date. `entries`: [{acts}]. */
function activityFilterRows(entries){
  return entries.flatMap(({acts}) => (acts || []).map(a => ({id:a.id, _act:a,
    type:ACTIVITY_TYPE_LABEL[a.type] || (ACTIVITY_TYPES[a.type] || {}).label || a.type, date:activityDateValue(a.at),
    // Searched as the words shown (a rich note's or email's markup isn't matched).
    text:[a.title, a.body && richTextPlain(a.body), a.outcome, a.notes && richTextPlain(a.notes), a.name, a.fileName].filter(Boolean).join(' ')})));
}

/* The second navigation level (Emails, Meetings): smaller pills under the toolbar — what the
   first level shows, by record type. */
function SubPills({items, active, onSelect}){
  return (
    <div role="tablist" style={{display:'flex', flexWrap:'wrap', gap:6, padding:'0 24px 10px'}}>
      {items.map(it => { const on = it.id === active;
        return <button key={it.id} role="tab" aria-selected={on} onClick={()=>onSelect(it.id)}
          style={{height:26, padding:'0 10px', borderRadius:9999, border:`1px solid ${on ? T.black : T.borderStrong}`, background: on ? T.black : '#fff',
            color: on ? '#fff' : T.gray800, fontSize:12.5, fontWeight:500, cursor:'pointer', fontFamily:'inherit'}}>{it.name}</button>; })}
    </div>
  );
}
/* The first level as tabs — Settings → Templates' tab strip (UtTab: icon, label, underline) —
   over the toolbar, whose pills are then the second level (Meetings). */
function PrimaryTabs({items, active, onSelect, inset = 'page'}){
  return (
    <div role="tablist" style={{display:'flex', alignItems:'center', gap:4, padding: inset === 'settings' ? '8px 16px 0' : '12px 20px 0', borderBottom:`1px solid ${T.border}`}}>
      {items.map(it => <UtTab key={it.id} icon={it.icon} label={it.name} active={it.id === active} onClick={()=>onSelect(it.id)}/>)}
    </div>
  );
}
/* The first level of a record's Email and Meetings tabs (the modules' own): Threads / Sent /
   Received / Scheduled (2026-11-18 — Threads: every sent and received email, one row
   per conversation; Received was Inbox and keeps its id); Upcoming / Ongoing / Past. The tab's record feeds (Contact / Deal / Customer) are the second.
   `tabs`: the first level is a tab strip with the feeds as the toolbar's pills (Email, Meetings). */
const MEETING_TIME_TABS = [{id:'upcoming', name:'Upcoming', icon:'calendar'}, {id:'ongoing', name:'Ongoing', icon:'videoCamera'}, {id:'past', name:'Past', icon:'clock'}];
const EMAIL_FOLDER_TABS = [{id:'threads', name:'Threads', icon:'envelope'}, {id:'sent', name:'Sent', icon:'forward'}, {id:'inbox', name:'Received', icon:'reply'}, {id:'scheduled', name:'Scheduled', icon:'clock'}];
const RECORD_TAB_PRIMARY = {
  email:    {views:EMAIL_FOLDER_TABS, in:(a, level) => emailInFolder(a, level), tabs:true},
  meetings: {views:MEETING_TIME_TABS, in:(a, level) => meetingWhen(a) === level, soonestFirst:'upcoming', tabs:true},
};
/* ── Feeds area ─────────────────────────────────────────────────────────────────────────── */

/* The toolbar (the three feed pills, the tab's add button; search, Filters) over the tab's list.
   `store`: {state, setState} — the module's chosen feed per tab; `sources.own`: the record's own
   rows; `render(acts, emptyText, recordOf)`: the activity list — `recordOf(act)` ({object,
   record}) on an associated feed, naming the record each activity is on. */
/* `heading`: a section title above the views (Overview: Activity, as Highlights above it). */
function ActivityViewsArea({tabId, store, sources, schema, controls, viewSwitch, render, heading}){
  const hub = useRecordHub(), ra = useRecordAccess();
  const ownObject = ra ? ra.object : 'contacts';
  const feeds = activityFeeds(tabId);
  const saved = (store.state[tabId] || {}).feed;
  const feedId = feeds.some(f => f.id === saved) ? saved : ownObject;
  const own = feedId === ownObject;
  const related = React.useMemo(() => !own && ra ? associatedFeedRows(hub, feedId, associatedRecords(hub, ownObject, ra.record)[feedId]) : null,
    [own, feedId, ownObject, ra && ra.record, hub && hub.records, hub && hub.activities]);
  const setFeed = (id) => store.setState(s => ({...s, [tabId]:{...(s[tabId] || {}), feed:id}}));
  const [byFeed, setByFeed] = React.useState({});   // {`${tabId}:${feed}`: {search, filters}}
  const key = `${tabId}:${feedId}`;
  const st = byFeed[key] || {search:'', filters:EMPTY_FILTERS()};
  const patch = (p) => setByFeed(m => ({...m, [key]:{...(m[key] || {search:'', filters:EMPTY_FILTERS()}), ...p}}));

  const tabType = ACTIVITY_TAB_TYPES[tabId];   // a type tab lists that type only
  // The search names what it searches: Search Activity (Overview), Search Calls, Search Notes …
  const searchLabel = `Search ${tabId === 'activity' ? 'Activity' : (CONTACT_TABS.find(t => t.id === tabId) || {}).label || 'Activity'}`;
  // The first level (Email, Meetings tabs): which folder / time it lists — remembered per tab.
  const primary = RECORD_TAB_PRIMARY[tabId];
  const level = primary ? ((store.state[tabId] || {}).level || primary.views[0].id) : null;
  const setLevel = (id) => store.setState(s => ({...s, [tabId]:{...(s[tabId] || {}), level:id}}));
  const base = ((own ? sources.own : related) || []).filter(r => (!tabType || r._act.type === tabType) && (tabId !== 'supportNotes' || r._act.support) && (!primary || primary.in(r._act, level)));
  const q = st.search.trim().toLowerCase();
  const rows = base.filter(r => !q || r.text.toLowerCase().includes(q) || String(r.type).toLowerCase().includes(q));
  const filtered = applyFilters(rows, st.filters, schema.filterProps);
  const when = (a) => new Date(a.scheduledFor || a.at).getTime();
  const shown = filtered.map(r => r._act).sort((a, b) => primary && primary.soonestFirst === level ? when(a) - when(b) : new Date(b.at) - new Date(a.at));
  const recOf = React.useMemo(() => new Map(filtered.filter(r => r._rec).map(r => [r._act.id, r._rec])), [filtered]);

  return (
    <RecordSchema.Provider value={schema}>
      <div style={{flex:1, minHeight:0, display:'flex', flexDirection:'column'}}>
        {/* Meetings: the first level as tabs, the record feeds as the toolbar's pills. Email: the
            first level as the pills, the record feeds as the second row. */}
        {/* The toolbar's own top padding stands in for the header's gap, as under Highlights. */}
        {/* Overview: the search in the title's place ("Search Activity"), Filters beside the record pills (one toolbar row). */}
        {heading && <div style={{padding:'16px 16px 0'}}><ToolbarSearch search={st.search} onSearch={(v)=>patch({search:v})} width={280} placeholder={searchLabel}/></div>}
        {primary && primary.tabs && <PrimaryTabs inset="settings" items={primary.views} active={level} onSelect={setLevel}/>}
        {/* On a record: its journey in place of the feed pills (2026-11-19). */}
        {ra && <RecordJourney hub={hub} object={ownObject} record={ra.record} active={feedId} onSelect={setFeed}/>}
        <RecordToolbar inset="settings" views={primary && !primary.tabs ? primary.views : ra ? [] : feeds} activeViewId={primary && !primary.tabs ? level : feedId}
          onSelectView={primary && !primary.tabs ? setLevel : setFeed} oneRow={!!heading} searchPlaceholder={searchLabel}
          controls={<div style={{display:'flex', alignItems:'center', gap:8}}>{viewSwitch}{ra && !own ? <JourneyGoTo hub={hub} object={feedId} records={associatedRecords(hub, ownObject, ra.record)[feedId] || []}/> : controls}</div>}
          search={st.search} onSearch={(v)=>patch({search:v})}
          filters={st.filters} setFilters={(f)=>patch({filters:typeof f === 'function' ? f(st.filters) : f})}
          appliedFilterCount={countAppliedFilters(st.filters, schema.filterProps)}/>
        {primary && !primary.tabs && !ra && <SubPills items={feeds} active={feedId} onSelect={setFeed}/>}
        {/* On a record, its activity names no record and links to none (`all`: every record name plain). */}
        {ra ? <OpenRecordCtx.Provider value={{all:true}}>{render(shown, base.length && !shown.length ? 'No activity matches these filters' : null, own ? null : (a) => recOf.get(a.id) || null)}</OpenRecordCtx.Provider>
          : render(shown, base.length && !shown.length ? 'No activity matches these filters' : null, own ? null : (a) => recOf.get(a.id) || null)}
      </div>
    </RecordSchema.Provider>
  );
}

Object.assign(window, {RecordJourney, JourneyGoTo, SubPills, PrimaryTabs, MEETING_TIME_TABS, EMAIL_FOLDER_TABS, ActivityViewsArea, activityFilterSchema, activityFilterRows, activityFeeds, associatedRecords});
