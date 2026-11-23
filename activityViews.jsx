/* HOF Pulse ERP — Activity feeds (Contact, Deal and Customer records).

   Every activity tab on a record (Activity, Calls, Email, Notes, Tasks, Meetings) shows three
   feeds as pills — Contacts, Deals, Customers (e.g. Contact calls, Deal calls, Customer calls,
   as on Tools → Calls). The record's own type is its own activity, as it always was; the other
   two are the activity of its associated records of that type (a contact's deals and customers;
   a deal's contact and customers; a customer's contact and deals), each row naming the record
   it's on. The record's own feed opens first. Each feed has search and two filters, Activity Type (on the
   Activity tab — the others are one type) and Activity Date, in the record lists' toolbar and
   filter popover. No saved views, Layout Settings or associated-object filters: simple over
   systematic. The chosen feed is kept per tab for the session; search and filters are per feed
   while the record is open.

   On a record (2026-11-19, Mohsin) the feeds aren't pills: they're the record's journey —
   Lead → Deal → Customer (RecordJourney), each step its label only, folded to one text action,
   "Show Full Journey", that opens every step; a step picked shows its activity below, in place. Under it one row: Search and Filters on the left;
   on the right "Go to <Deal>" (JourneyGoTo, on another record's step only) and Add — always there,
   adding to the record that's open, whichever step is shown. The activity of another record's
   step names and links no record. A step the record
   hasn't reached is greyed and can't be picked. On a contact the Deal step is all its deals
   ("Deals (2)", their activity together) and the Customer step all its customers; on a deal the
   Deal step is that deal alone, the Contact step its contact and the Customer step its customers;
   on a customer, its contact, its deals, and itself. The Tools pages keep the pills. */

const ACTIVITY_TAB_NOUNS = {activity:'activity', calls:'calls', email:'emails', notes:'notes', tasks:'tasks', meetings:'meetings'};
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
   A step is its label only — Lead, Deal, "Deals (2)" — no names or dates; the records' names are
   its tooltip. Folded, it's the record's own step and a text action, "Show Full Journey" (Mohsin,
   2026-11-19 — his "lifetime activity", worded by us), shown only when the record has related records; it opens
   every step the record has, Lead → Deal → Customer, with an × at the right that folds it back
   (to the record's own activity if another step was picked). Every record starts folded. */
function RecordJourney({hub, object, record, active, onSelect}){
  const assoc = associatedRecords(hub, object, record);
  const steps = ACTIVITY_FEED_OBJECTS.filter(workspaceHasType).map(o => {
    const recs = o === object ? [record] : (assoc[o] || []);
    return {o, recs, label: recs.length > 1 ? `${typePlural(o, o.charAt(0).toUpperCase() + o.slice(1))} (${recs.length})` : HUB_NOUN[o]};
  }).filter(x => x.recs.length);
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => { setOpen(false); }, [object, record && record.id]);
  if(steps.length < 2) return null;
  const fold = () => { setOpen(false); if(active !== object) onSelect(object); };
  const textBtn = {display:'inline-flex', alignItems:'center', gap:6, border:'none', background:'transparent', padding:'6px 2px', cursor:'pointer',
    fontFamily:'inherit', fontSize:13, color:T.attioText, whiteSpace:'nowrap', flexShrink:0};
  const chip = (x) => { const on = x.o === active;
    return <button type="button" role="tab" aria-selected={on} onClick={()=>onSelect(x.o)} title={x.recs.map(r => r.name).join(', ')}
      style={{height:34, padding:'0 14px', borderRadius:10, fontFamily:'inherit', fontSize:13, fontWeight:600, color:T.attioText, cursor:'pointer', whiteSpace:'nowrap',
        border:`1px solid ${on ? T.black : T.borderStrong}`, background: on ? '#F4F5F7' : '#fff', flexShrink:0}}>{x.label}</button>; };
  // Folded: the record's own step, then "Show Full Journey".
  if(!open) return (
    <div role="tablist" aria-label="Record journey" style={{display:'flex', alignItems:'center', flexWrap:'wrap', gap:12, padding:'12px 16px 0'}}>
      {chip(steps.find(x => x.o === object) || steps[0])}
      <button type="button" onClick={()=>setOpen(true)} className={LINK_CLASS} style={textBtn}><Icon name="clock" size={13} color={T.attioText}/>Show Full Journey</button>
    </div>
  );
  return (
    <div role="tablist" aria-label="Record journey" style={{display:'flex', alignItems:'center', flexWrap:'wrap', gap:8, padding:'12px 16px 0'}}>
      {steps.map((x, i) => (
        <React.Fragment key={x.o}>
          {i > 0 && <span aria-hidden="true" style={{display:'flex', flexShrink:0}}><Icon name="arrowRight" size={14} color={T.gray600}/></span>}
          {chip(x)}
        </React.Fragment>
      ))}
      <button type="button" onClick={fold} title="Hide Journey" aria-label="Hide journey" style={{...textBtn, padding:4, marginLeft:4}}><Icon name="close" size={12} color={T.gray600}/></button>
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
// `right`: what sits at the right end of the strip (the Tools pages' "+ New …" — 2026-11-23).
function PrimaryTabs({items, active, onSelect, inset = 'page', right}){
  return (
    <div role="tablist" style={{display:'flex', alignItems:'center', gap:4, padding: inset === 'settings' ? '8px 16px 0' : '12px 20px 0', borderBottom:`1px solid ${T.border}`}}>
      {items.map(it => <UtTab key={it.id} icon={it.icon} label={it.name} active={it.id === active} onClick={()=>onSelect(it.id)}/>)}
      {right && <><div style={{flex:1}}/><div style={{display:'flex', alignItems:'center', gap:8, flexShrink:0, paddingBottom:9}}>{right}</div></>}
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
  /* On a record these sit under its own tab bar, so they're its secondary tabs — the filled pills
     (as Accounting's Active / Paid / Frozen), not a second strip of underlined tabs (2026-11-23). */
  email:    {views:EMAIL_FOLDER_TABS, in:(a, level) => emailInFolder(a, level), tabs:false},
  meetings: {views:MEETING_TIME_TABS, in:(a, level) => meetingWhen(a) === level, soonestFirst:'upcoming', tabs:false},
  // Calls (2026-11-23): All Calls, and Call Reviews — Spring AI's, a placeholder until the dev team defines it.
  // Notes (2026-11-23): by note type — All, Client Request, Support, General (noteTools.jsx).
  notes:    {views:NOTE_TYPE_TABS, in:(a, level) => noteInTab(a, level), tabs:false},
  calls:    {views:[{id:'all', name:'All Calls'}, {id:'reviews', name:'Call Reviews'}], in:() => true, tabs:false, placeholder:{reviews:'Call Reviews'}},
};
// A record tab's secondary tabs: filled pills on their own row, under the search and Filters (2026-11-23).
// `inset` 'page': the Tools pages' wider side padding.
function SecondaryPills({items, active, onSelect, inset}){
  // Clear of the toolbar's line above them (Mohsin 2026-11-23: they stuck to it).
  return <div role="tablist" style={{display:'flex', flexWrap:'wrap', gap:8, padding: inset === 'page' ? '12px 20px 12px' : '12px 16px 4px'}}>
    {items.map(it => <button key={it.id} role="tab" aria-selected={it.id === active} onClick={()=>onSelect(it.id)} style={viewPillStyle(it.id === active)}>{it.name}</button>)}
  </div>;
}
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
  const base = ((own ? sources.own : related) || []).filter(r => (!tabType || r._act.type === tabType) && (!primary || primary.in(r._act, level)));
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
        {heading && !ra && <div style={{padding:'16px 16px 0'}}><ToolbarSearch search={st.search} onSearch={(v)=>patch({search:v})} width={280} placeholder={searchLabel}/></div>}
        {primary && primary.tabs && <PrimaryTabs inset="settings" items={primary.views} active={level} onSelect={setLevel}/>}
        {/* On a record: its journey in place of the feed pills (2026-11-19). */}
        {ra && <RecordJourney hub={hub} object={ownObject} record={ra.record} active={feedId} onSelect={setFeed}/>}
        <RecordToolbar inset="settings" views={primary && !primary.tabs && !ra ? primary.views : ra ? [] : feeds} activeViewId={primary && !primary.tabs && !ra ? level : feedId}
          onSelectView={primary && !primary.tabs && !ra ? setLevel : setFeed} oneRow={!!heading || !!ra} searchInRow={!!ra} searchPlaceholder={searchLabel}
          controls={<div style={{display:'flex', alignItems:'center', gap:12}}>{viewSwitch}{ra && !own && <JourneyGoTo hub={hub} object={feedId} records={associatedRecords(hub, ownObject, ra.record)[feedId] || []}/>}{controls}</div>}
          search={st.search} onSearch={(v)=>patch({search:v})}
          filters={st.filters} setFilters={(f)=>patch({filters:typeof f === 'function' ? f(st.filters) : f})}
          appliedFilterCount={countAppliedFilters(st.filters, schema.filterProps)}/>
        {primary && !primary.tabs && !ra && <SubPills items={feeds} active={feedId} onSelect={setFeed}/>}
        {primary && !primary.tabs && ra && <SecondaryPills items={primary.views} active={level} onSelect={setLevel}/>}
        {/* On a record, its activity names no record and links to none (`all`: every record name plain). */}
        {primary && primary.placeholder && primary.placeholder[level] ? <SpringPlaceholder title={primary.placeholder[level]}/>
          : ra ? <OpenRecordCtx.Provider value={{all:true}}>{render(shown, base.length && !shown.length ? 'No activity matches these filters' : null, own ? null : (a) => recOf.get(a.id) || null)}</OpenRecordCtx.Provider>
          : render(shown, base.length && !shown.length ? 'No activity matches these filters' : null, own ? null : (a) => recOf.get(a.id) || null)}
      </div>
    </RecordSchema.Provider>
  );
}

Object.assign(window, {RecordJourney, JourneyGoTo, SubPills, SecondaryPills, PrimaryTabs, MEETING_TIME_TABS, EMAIL_FOLDER_TABS, ActivityViewsArea, activityFilterSchema, activityFilterRows, activityFeeds, associatedRecords});
