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
   while the record is open. */

const ACTIVITY_TAB_NOUNS = {activity:'activity', calls:'calls', email:'emails', notes:'notes', tasks:'tasks', meetings:'meetings'};
const ACTIVITY_FEED_OBJECTS = ['contacts', 'deals', 'customers'];
// The feeds of a tab, one per record type of the workspace (HOF Partners: Lead and Customer).
const activityFeeds = (tabId) => ACTIVITY_FEED_OBJECTS.filter(workspaceHasType).map(o => ({id:o, name:`${HUB_NOUN[o]} ${ACTIVITY_TAB_NOUNS[tabId]}`}));
/* A record's associated records of each type (its own type: none — that feed is its own activity). */
function associatedRecords(hub, object, record){
  const all = (o) => (hub && hub.records[o]) || [];
  const byId = (o, id) => id == null ? null : all(o).find(r => String(r.id) === String(id)) || null;
  const self = byId(object, record.id) || record;
  if(object === 'contacts') return {contacts:[], deals:all('deals').filter(d => String(d.contactId) === String(self.id)),
    customers:all('customers').filter(c => String(c.contactId) === String(self.id))};
  if(object === 'deals') return {contacts:[byId('contacts', self.contactId)].filter(Boolean), deals:[],
    customers:all('customers').filter(c => (c.dealIds || []).some(id => String(id) === String(self.id)))};
  return {contacts:[byId('contacts', self.contactId)].filter(Boolean), deals:(self.dealIds || []).map(id => byId('deals', id)).filter(Boolean), customers:[]};
}
/* Rows for an associated feed: each record's activity (what the user may see), with the record. */
const associatedFeedRows = (hub, object, records) => records.flatMap(r =>
  activityFilterRows([{acts:visibleActivities(object, r, ((hub && hub.activities[object]) || {})[r.id])}]).map(row => ({...row, _rec:{object, record:r}})));

/* ── Filter fields ─────────────────────────────────────────────────────────────────────── */

const activityDateValue = (d) => d ? new Date(d).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}) : '';
// Activity types (File change: listed for when file activity exists).
const ACTIVITY_TYPE_VALUES = ['Email', 'Call', 'Meeting', 'Task', 'Note', 'File', 'File deleted', 'Quote', 'Owner change', 'Workflow'];
const ACTIVITY_TYPE_LABEL = {email:'Email', call:'Call', meeting:'Meeting', task:'Task', note:'Note', file:'File', fileChange:'File deleted', quote:'Quote', ownerChange:'Owner change', workflow:'Workflow'};
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
    text:[a.title, a.body, a.outcome, a.notes, a.name, a.fileName].filter(Boolean).join(' ')})));
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
/* The first level of a record's Email and Meetings tabs (the modules' own): Inbox / Sent /
   Scheduled; Upcoming / Past. The tab's record feeds (Contact / Deal / Customer) are the second.
   `tabs`: the first level is a tab strip with the feeds as the toolbar's pills (Email, Meetings). */
const MEETING_TIME_TABS = [{id:'upcoming', name:'Upcoming', icon:'calendar'}, {id:'past', name:'Past', icon:'clock'}];
const EMAIL_FOLDER_TABS = [{id:'inbox', name:'Inbox', icon:'envelope'}, {id:'sent', name:'Sent', icon:'forward'}, {id:'scheduled', name:'Scheduled', icon:'clock'}];
const RECORD_TAB_PRIMARY = {
  email:    {views:EMAIL_FOLDER_TABS, of:(a) => emailFolder(a), tabs:true},
  meetings: {views:MEETING_TIME_TABS, of:(a) => meetingWhen(a), soonestFirst:'upcoming', tabs:true},
};
/* ── Feeds area ─────────────────────────────────────────────────────────────────────────── */

/* The toolbar (the three feed pills, the tab's add button; search, Filters) over the tab's list.
   `store`: {state, setState} — the module's chosen feed per tab; `sources.own`: the record's own
   rows; `render(acts, emptyText, recordOf)`: the activity list — `recordOf(act)` ({object,
   record}) on an associated feed, naming the record each activity is on. */
function ActivityViewsArea({tabId, store, sources, schema, controls, render}){
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
  // The first level (Email, Meetings tabs): which folder / time it lists — remembered per tab.
  const primary = RECORD_TAB_PRIMARY[tabId];
  const level = primary ? ((store.state[tabId] || {}).level || primary.views[0].id) : null;
  const setLevel = (id) => store.setState(s => ({...s, [tabId]:{...(s[tabId] || {}), level:id}}));
  const base = ((own ? sources.own : related) || []).filter(r => (!tabType || r._act.type === tabType) && (!primary || primary.of(r._act) === level));
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
        {primary && primary.tabs && <PrimaryTabs inset="settings" items={primary.views} active={level} onSelect={setLevel}/>}
        <RecordToolbar inset="settings" views={primary && !primary.tabs ? primary.views : feeds} activeViewId={primary && !primary.tabs ? level : feedId}
          onSelectView={primary && !primary.tabs ? setLevel : setFeed} controls={controls}
          search={st.search} onSearch={(v)=>patch({search:v})}
          filters={st.filters} setFilters={(f)=>patch({filters:typeof f === 'function' ? f(st.filters) : f})}
          appliedFilterCount={countAppliedFilters(st.filters, schema.filterProps)}/>
        {primary && !primary.tabs && <SubPills items={feeds} active={feedId} onSelect={setFeed}/>}
        {render(shown, base.length && !shown.length ? 'No activity matches these filters.' : null, own ? null : (a) => recOf.get(a.id) || null)}
      </div>
    </RecordSchema.Provider>
  );
}

Object.assign(window, {SubPills, PrimaryTabs, MEETING_TIME_TABS, EMAIL_FOLDER_TABS, ActivityViewsArea, activityFilterSchema, activityFilterRows, activityFeeds, associatedRecords});
