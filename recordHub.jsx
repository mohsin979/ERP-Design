/* HOF Pulse ERP — The record hub: every record's activity, in one place.

   Contacts, Deals and Customers each keep their own activity (App). The hub is the one way the
   workspace-wide pages (Tools → Calls, Tasks, Emails, Meetings, Notes, Quotes, Documents), the
   email composer, files, quotations and documents read and change it — so a call logged from Tools → Calls is the
   same activity a contact's Calls tab shows, and the other way round. Deal and Customer activity
   goes through the workflow engine (App), so workflows see it as they see any other.

   `hub` (App): {data, records:{contacts, deals, customers}, activities:{…}, add, update, remove,
   openRecord, quotes, setQuotes, documents, setDocuments, services, setServices}. The provider adds the overlays every
   page shares: the email composer, the call window and the quotation builder. */

const RecordHubCtx = React.createContext(null);
const useRecordHub = () => React.useContext(RecordHubCtx);

const HUB_OBJECTS = ['contacts', 'deals', 'customers'];
// The open workspace's record types (HOF Partners: Leads and Customers — no Contacts), each by its name there.
const hubObjects = () => HUB_OBJECTS.filter(workspaceHasType);
const HUB_NOUN = {get contacts(){ return typeSingular('contacts', 'Contact'); }, get deals(){ return typeSingular('deals', 'Deal'); }, get customers(){ return typeSingular('customers', 'Customer'); }};

const hubRecord = (hub, object, id) => hub && ((hub.records[object] || []).find(r => r.id === id) || null);
// Who a record's email and calls reach: the contact itself; a deal's person (its first contact), else its own details; a customer's own details, else its person's.
function hubRecordPerson(hub, object, id){
  const r = hubRecord(hub, object, id);
  if(!r) return null;
  const contactOf = (cid) => cid != null ? hubRecord(hub, 'contacts', cid) : null;
  if(object === 'contacts') return {name:r.name, email:r.email || '', phone:r.phone || ''};
  const c = contactOf(personIdOf(r));
  if(object === 'customers') return {name:r.name, email:r.email || (c && c.email) || '', phone:r.phone || (c && c.phone) || ''};
  return {name: c ? c.name : r.name, email:(c && c.email) || r.email || '', phone:(c && c.phone) || r.phone || ''};
}
// Every activity of the workspace (of one type), with the record it's on.
const hubActivities = (hub, type) => HUB_OBJECTS.flatMap(object => Object.entries((hub && hub.activities[object]) || {}).flatMap(([rid, list]) => {
  const record = (hub.records[object] || []).find(r => String(r.id) === String(rid));
  if(!record) return [];
  return (list || []).filter(a => !type || a.type === type).map(act => ({object, recordId:record.id, record, act}));
}));
// Where an activity lives: {object, recordId} (it may be on another record than the one shown — an associated feed).
const hubFindActivity = (hub, actId) => {
  for(const object of HUB_OBJECTS){
    const hit = Object.entries((hub && hub.activities[object]) || {}).find(([, list]) => (list || []).some(a => a.id === actId));
    if(hit){ const r = (hub.records[object] || []).find(x => String(x.id) === String(hit[0])); return {object, recordId: r ? r.id : hit[0]}; }
  }
  return null;
};
/* Deleting an activity from wherever it's shown (a record's tabs, Tools pages): ⋯ → Delete asks
   first, then removes it from its record (DetailMoreMenu). */
const ActivityDeleteCtx = React.createContext(null);
const useActivityDelete = () => React.useContext(ActivityDeleteCtx);
const hubRecordOptions = (hub, object) => ((hub && hub.records[object]) || []).map(r => ({value:r.id, label:r.name}));

/* A record to attach something to: the Object (Contact / Deal / Customer — the workspace's), then
   the record. `value`: {object, id}. */
function RecordPicker({value, onChange, objects: given}){
  const hub = useRecordHub();
  const objects = (given || HUB_OBJECTS).filter(workspaceHasType);
  const v = value && objects.includes(value.object) ? value : {object:objects[0], id:null};
  const seg = (o) => (
    <button key={o} type="button" role="radio" aria-checked={v.object === o} onClick={()=>onChange({object:o, id:null})}
      style={{border:'none', cursor:'pointer', padding:'5px 12px', fontSize:12.5, fontWeight:500, fontFamily:'inherit',
        background: v.object === o ? T.black : 'transparent', color: v.object === o ? '#fff' : T.gray600}}>{HUB_NOUN[o]}</button>
  );
  return (
    <div style={{display:'flex', flexDirection:'column', gap:8}}>
      <div role="radiogroup" aria-label="Record type" style={{display:'inline-flex', alignSelf:'flex-start', border:`1px solid ${T.borderStrong}`, borderRadius:8, overflow:'hidden'}}>
        {objects.map(seg)}
      </div>
      <SearchableSelect value={v.id ?? ''} options={hubRecordOptions(hub, v.object)} onChange={(id)=>onChange({object:v.object, id})}
        placeholder={`Select ${HUB_NOUN[v.object].toLowerCase()}`} searchPlaceholder={`Search ${HUB_NOUN[v.object].toLowerCase()}s`}/>
    </div>
  );
}

/* A record's name as a link that opens it on its own page. */
function HubRecordLink({object, id, name}){
  const hub = useRecordHub();
  return <ContactName name={name} onOpen={()=>hub && hub.openRecord(object, id, 'panel')} style={{fontSize:'inherit', fontWeight:400}}/>;
}

/* The provider: the hub plus the overlays every page shares. */
function RecordHubProvider({value, children}){
  const [composer, setComposer] = React.useState(null);   // {object, id, replyTo?, initial?} | {recipients, onSent?} — several records
  const [call, setCall] = React.useState(null);           // {object, id}
  const [quote, setQuote] = React.useState(null);         // {mode:'new', object, id} | {mode:'edit', id}
  const [toast, setToast] = React.useState(null);
  const toastTimer = React.useRef(null);
  const showToast = (m) => { setToast(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(()=>setToast(null), TOAST_MS); };
  const hub = {...value,
    composeEmail:(opts) => setComposer(opts || {}),
    // One call at a time: another can't start while a call's panel is open (it would be saved on the wrong record).
    // …and only to a record with a phone number (as Tools → Calls).
    startCall:(target) => { const person = target && hubRecordPerson(hub, target.object, target.id);
      if(!person || !String(person.phone || '').trim()) return showToast('No phone number to call');
      setCall(c => { if(c && (c.object !== target.object || String(c.id) !== String(target.id))){ showToast('Finish the current call first'); return c; } return target; }); },
    newQuote:(target) => setQuote({mode:'new', ...(target || {})}),
    editQuote:(id) => setQuote({mode:'edit', id}),
    toast:showToast,
    /* A deleted call or meeting keeps its notes: they stay on the record, no longer linked to it. */
    removeActivity:(actId) => { const f = hubFindActivity(value, actId); if(!f) return;
      ((value.activities[f.object] || {})[f.recordId] || []).filter(n => n.type === 'note' && (n.callId === actId || n.meetingId === actId))
        .forEach(n => value.update(f.object, f.recordId, n.id, n.callId === actId ? {callId:null} : {meetingId:null}));
      value.remove(f.object, f.recordId, actId); },
  };
  const callPerson = call && hubRecordPerson(hub, call.object, call.id);
  return (
    <RecordHubCtx.Provider value={hub}>
      <ActivityDeleteCtx.Provider value={(a)=>hub.removeActivity(a.id)}>{children}</ActivityDeleteCtx.Provider>
      {/* Opened from a list's quick actions: the creation panel at the CRM's right edge. */}
      {composer && <EmailComposer {...composer} placement="fixed" onClose={()=>setComposer(null)}/>}
      {call && callPerson && <CallPanel contact={{id:call.id, ...callPerson}} onClose={()=>setCall(null)}
        onEnded={({startedAt, durationMs, segments, lang, notes = ''})=>{
          const a = hub.add(call.object, call.id, {type:'call', at:startedAt, source:'you', by:CURRENT_USER.name, direction:'outbound', outcome:'Connected', logged:false,
            durationMin:Math.max(1, Math.round(durationMs / 60000)), body: segments.length ? `Live transcript · ${segments.length} lines` : 'No transcript captured',
            transcript:segments, notes, lang});
          if(notes) hub.add(call.object, call.id, {type:'note', at:new Date(startedAt.getTime() + durationMs), source:'you', by:CURRENT_USER.name, body:notes, callId:a && a.id});
          return {id:a && a.id, startedAt, durationMs, segments, notes};
        }}/>}
      {/* Opened from a list's quick actions: the creation panel at the CRM's right edge. */}
      {quote && <QuoteBuilder {...quote} placement="fixed" onClose={()=>setQuote(null)}/>}
      <CopyToast message={toast}/>
    </RecordHubCtx.Provider>
  );
}

Object.assign(window, {hubFindActivity, ActivityDeleteCtx, useActivityDelete, RecordHubCtx, useRecordHub, HUB_OBJECTS, hubObjects, HUB_NOUN, hubRecord, hubRecordPerson, hubActivities, hubRecordOptions, RecordPicker, HubRecordLink, RecordHubProvider});
