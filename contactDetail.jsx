/* HOF Pulse ERP — Contact Detail.

   One Contact record, two presentations of the same content:
     • Side panel  — opens over the Table/Board from any contact entry point (name in the
                     Table, name on a card, the card's open icon).
     • Full screen — fills the Contacts content area (CRM sidebar and header stay). The panel's
                     content moves to a left column; the Contact workspace tabs sit on the right.

   The body (header, quick actions, Summary/activity section, Contact Properties) is a single
   component rendered in both, so the two can't drift apart. Layout follows the Attio record
   page; styling is the product's own. */

/* ── Header: name, email, phone, quick actions ──────────────────────────────────────────── */

const nameInitials = (name) => (name || '').split(/\s+/).slice(0,2).map(w => w[0] || '').join('').toUpperCase();

function CopyButton({text, label, onCopied}){
  const [h, setH] = React.useState(false);
  return (
    <button title={`Copy ${label}`} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      onClick={e=>{ e.stopPropagation(); copyText(text).then(ok => onCopied(ok ? `${label[0].toUpperCase()+label.slice(1)} copied` : 'Copy failed')); }}
      style={{border:'none', background: h ? T.headerBg : 'transparent', borderRadius:6, width:24, height:24,
              display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0}}>
      <Icon name="copy" size={13} color={T.attioMuted}/>
    </button>
  );
}

/* Email and phone are link-style: clicking opens the product's own Email / Call action (not a
   mailto:/tel: link), so the touchpoint stays inside the CRM. Copy is a separate icon. */
function ContactLine({icon, value, label, onOpen, onCopied}){
  if(!value) return (
    <div style={{display:'flex', alignItems:'center', gap:8, height:26}}>
      <Icon name={icon} size={14} color={T.attioFaint}/>
      <span style={{fontSize:13, color:T.attioFaint}}>No {label}</span>
    </div>
  );
  return (
    <div style={{display:'flex', alignItems:'center', gap:8, height:26, minWidth:0}}>
      <Icon name={icon} size={14} color={T.attioMuted}/>
      <button onClick={onOpen} title={label === 'email' ? 'Email' : 'Call'}
        style={{border:'none', background:'transparent', padding:0, cursor:'pointer', fontSize:13,
                color:T.attioBlue, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', minWidth:0}}>
        {value}
      </button>
      <CopyButton text={value} label={label} onCopied={onCopied}/>
    </div>
  );
}

/* Icon-only quick action; the label lives in the tooltip and accessible name. */
function QuickAction({icon, label, onClick}){
  const [h, setH] = React.useState(false);
  return (
    <button onClick={onClick} title={label} aria-label={label}
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{width:34, height:32, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
              border:`1px solid ${T.borderStrong}`, background: h ? T.headerBg : '#fff', borderRadius:8, cursor:'pointer'}}>
      <Icon name={icon} size={15} color={T.gray600}/>
    </button>
  );
}

/* Name row. In the side panel it also carries Close / Expand / menu (`headerActions`) and is
   rendered outside the scrolling body, so those controls never scroll away — the panel has no
   separate top bar. The full-screen view uses it without actions, inside its own column. */
/* `subtitle`: what View settings puts under the name (Avatar subtitle) — Job Title by default. */
const contactSubtitle = (contact, settings) => { const k = (settings || DEFAULT_PANEL_SETTINGS()).subtitle; return k ? (contact[k] == null ? '' : String(formatValue(contact[k]))) : ''; };
function NameRow({contact, subtitle, headerActions}){
  return (
    <div style={{display:'flex', alignItems:'center', gap:10, minWidth:0}}>
      <span style={{
        width:36, height:36, borderRadius:9999, background:T.attioText, color:'#fff', flexShrink:0,
        fontSize:13, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center',
      }}>{nameInitials(contact.name)}</span>
      <div style={{minWidth:0, flex:1}}>
        <div style={{fontSize:17, fontWeight:600, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{contact.name}</div>
        {subtitle && <div style={{fontSize:12.5, color:T.attioMuted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{subtitle}</div>}
      </div>
      {headerActions && <div style={{display:'flex', alignItems:'center', gap:2, flexShrink:0}}>{headerActions}</div>}
    </div>
  );
}

function DetailHeader({contact, onStub, onCopied, onCall, withName=true, subtitle}){
  return (
    <div style={{display:'flex', flexDirection:'column', gap:12}}>
      {withName && <NameRow contact={contact} subtitle={subtitle}/>}
      <div>
        <ContactLine icon="envelope" label="email" value={contact.email} onOpen={()=>onStub('Email')} onCopied={onCopied}/>
        <ContactLine icon="call" label="phone number" value={contact.phone} onOpen={()=>onCall ? onCall(contact) : onStub('Call')} onCopied={onCopied}/>
      </div>
    </div>
  );
}

/* Quick actions, in the order and selection set in View Settings — the shared set (contactActions.jsx),
   each running what its ⋯ menu item runs. */
const contactQuickHandlers = (contact, actions, onStub, onCall) => ({onStub,
  onTool: actions && actions.onTool ? (k) => actions.onTool(k, contact) : (k) => k === 'call' && onCall ? onCall(contact) : onStub(quickActionLabel('contacts', k)),
  onOwner: actions && actions.onOwner && (() => actions.onOwner(contact)),
  onCreateDeal: actions && actions.onCreateRecord && (() => actions.onCreateRecord('Create Deal', contact)),
  onCreateCustomer: actions && actions.onCreateRecord && (() => actions.onCreateRecord('Create Customer', contact))});
function PanelQuickActions({contact, items, actions, onStub, onCall}){
  const on = shownQuickActions(items, 'contacts', contact);
  if(!on.length) return null;
  const h = contactQuickHandlers(contact, actions, onStub, onCall);
  return (
    <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
      {on.map(q => <QuickAction key={q.key} icon={q.icon} label={q.label} onClick={()=>runQuickAction(q.key, h, q.label)}/>)}
    </div>
  );
}

/* ── Contact Properties ────────────────────────────────────────────────────────────────── */

/* Field order is fixed by the product spec. Name, email and phone are in the header; Primary
   Company appears under the name; Lifecycle Stage and Lead Status are deliberately not shown. */
const fmtInfoDate = (d) => d ? d.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}) : '';

/* Owner dates come from the contact's own history, not stored fields:
     Owner Change Date     — the most recent Owner change activity; blank if the owner never changed.
     Owner Assignment Date — when the current owner got the contact: the latest change *to* them,
                             or the Create Date if they have owned it since it was created. */
function ownerDates(contact, acts){
  const changes = acts.filter(a => a.type === 'ownerChange');   // acts are newest first
  const lastChange = changes[0];
  // History holds user IDs (older entries: names); `contact.owner` is the name shown.
  const toCurrent = changes.find(a => userLabel(a.to) === userLabel(contact.owner));
  return {
    assigned: !contact.owner ? '' : toCurrent ? fmtInfoDate(toCurrent.at) : (contact.created || ''),
    changed:  lastChange ? fmtInfoDate(lastChange.at) : '',
  };
}

/* Record Owner in a record's side panel: the owner's name opens their profile (OwnerLink); the
   edit icon — the one other properties have — reassigns it in the Edit Owner window (the searchable
   user list). The change goes through the record's own update (hub.updateRecord), so it's kept in
   the owner history. Shown to people who may edit the record. */
function OwnerValue({object, record, name}){
  const hub = useRecordHub();
  const [editing, setEditing] = React.useState(false);
  const raw = hub && ((hub.records || {})[object] || []).find(r => String(r.id) === String(record.id));
  const can = !!raw && recordCan(object, raw, 'edit');
  const noun = HUB_NOUN[object] || 'Record';
  return (
    <span style={{flex:1, minWidth:0, display:'flex', alignItems:'baseline', gap:6}}>
      {name ? <OwnerLink name={name}/> : <span style={{fontSize:13, color:T.attioFaint}}>—</span>}
      {can && <button onClick={()=>setEditing(true)} title={`Edit ${noun} Owner`} aria-label={`Edit ${noun} Owner`}
        style={{border:'none', background:'transparent', padding:2, cursor:'pointer', display:'flex', alignSelf:'center', flexShrink:0}}>
        <Icon name="edit" size={12} color={T.gray600}/>
      </button>}
      {editing && <ChangeOwnerModal record={raw} noun={noun} users={((hub.data || {}).users || []).filter(u => u.status === 'Activated')} ownerName={userLabel}
        onClose={()=>setEditing(false)} onSave={(owner)=>{ hub.updateRecord(object, raw.id, {owner}); setEditing(false); }}/>}
    </span>
  );
}
/* Record Owner value: blue link text that underlines on hover, so it reads as clickable. Inside
   a record detail (Contact, Deal, Customer) it opens the owner's profile panel over the record. */
const OwnerProfileCtx = React.createContext(null);
function OwnerLink({name, onOpen}){
  const [h, setH] = React.useState(false);
  const profile = React.useContext(OwnerProfileCtx);
  const open = profile ? () => profile.open(name) : onOpen;
  if(!open) return <span style={{fontSize:13, color:T.attioText}}>{name}</span>;
  return (
    <button onClick={open} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{border:'none', background:'transparent', padding:0, cursor:'pointer', fontSize:13, color:T.attioBlue, textAlign:'left',
              textDecoration: h ? 'underline' : 'none', textUnderlineOffset:2}}>
      {name}
    </button>
  );
}

/* A property's label in a record's properties list (one line, the full label on hover), with the
   red mark when an open workflow violation asks for it. */
function PropertyRowLabel({k, label}){
  return (
    <span title={label} style={{width:158, flexShrink:0, display:'inline-flex', alignItems:'center', gap:6, minWidth:0}}>
      <span style={{fontSize:12.5, color:T.attioMuted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', minWidth:0}}>{label}</span>
      <ViolationMark prop={k}/>
    </span>
  );
}
function ContactInfo({contact, acts, onStub, keys, onOpenDeals, onOpenCustomers, panelProperties}){
  const owner = ownerDates(contact, acts);
  const hub = useRecordHub();
  const contactDeals = ((hub && hub.records && hub.records.deals) || []).filter(d => d.contactId === contact.id);
  const openDeal = (d) => onOpenDeals ? onOpenDeals(contact, d.id) : onStub(`Deal · ${d.name}`);
  const contactCustomers = ((hub && hub.records && hub.records.customers) || []).filter(c => c.contactId === contact.id);
  const openCustomer = (c) => onOpenCustomers ? onOpenCustomers(contact, c.id) : onStub(`Customer · ${c.name}`);

  /* Values that point at another record open it. Neither a user profile nor Deal records are
     defined yet, so they open the standard placeholder named after the record. An editable
     property is also edited in place (hover → edit icon); the full form stays in the three-dot
     menu (Edit contact). Rows are the Contact properties from Settings (contactPanelProperties):
     the worked-out ones, then each property's stored value. */
  const special = {
    owner:         {value:contact.owner, open:(v)=>onStub(`Contact Owner · ${v}`), ownerLink:true},
    ownerAssigned: {value:owner.assigned},
    ownerChanged:  {value:owner.changed},
    deals:         {value: contactDeals.length ? String(contactDeals.length) : '', deals:contactDeals},
    customers:     {value: contactCustomers.length ? String(contactCustomers.length) : '', customers:contactCustomers},
  };
  const rows = (panelProperties || contactPanelProperties()).map(p => ({key:p.key, label:p.label,
    ...(special[p.key] || {value: contact[p.key] == null ? '' : String(formatValue(contact[p.key]))})}));
  // Which properties show, and in what order, is set in View Settings.
  const shown = keys ? keys.map(k => rows.find(r => r.key === k)).filter(Boolean) : rows;
  if(!shown.length) return null;

  return (
    <div>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6}}>
        <span style={{fontSize:11, fontWeight:600, color:T.attioFaint, textTransform:'uppercase', letterSpacing:.4}}>Contact Properties</span>
      </div>
      {shown.map(r => (
        <div key={r.key} style={{display:'flex', alignItems:'baseline', gap:12, padding:'7px 0', borderBottom:`1px solid ${T.attioLine}`, minHeight:32}}>
          {/* A label longer than the column truncates (full label on hover). */}
          <PropertyRowLabel k={r.key} label={r.label}/>
          {r.key === 'profileType' ? <ProfileTypeValue contactId={contact.id}/>
          : panelEditSpec(hub, 'contacts', contact, r.key) ? <PanelEditableValue spec={panelEditSpec(hub, 'contacts', contact, r.key)} display={r.value}/>
          : r.ownerLink ? <OwnerValue object="contacts" record={contact} name={r.value}/>
          : !r.value ? (
            <span style={{fontSize:13, color:T.attioFaint}}>—</span>
          ) : r.deals ? (
            <AssociatedRecordsValue records={r.deals} noun="deal" onOpen={openDeal}/>
          ) : r.customers ? (
            <AssociatedRecordsValue records={r.customers} noun="customer" onOpen={openCustomer}/>
          ) : r.ownerLink ? (
            <OwnerLink name={r.value} onOpen={()=>r.open(r.value)}/>
          ) : r.open ? (
            <button onClick={()=>r.open(r.value)} style={{border:'none', background:'transparent', padding:0, cursor:'pointer', fontSize:13, color:T.attioBlue, textAlign:'left'}}>{r.value}</button>
          ) : (
            <span style={{fontSize:13, color:T.attioText, minWidth:0, overflowWrap:'anywhere'}}>{r.value}</span>
          )}
        </div>
      ))}
    </div>
  );
}

/* An association in a record's side panel (Associated Deals / Customers): one record shows its
   name (opens it); several show "N deals" / "N customers" with a dropdown of their names —
   picking one opens that record. `noun`: 'deal' or 'customer'. */
/* `inTable`: inside a table cell (which clips), the list opens as a fixed layer over the page —
   the row ⋯ menu's way (ActionsMenu) — with the same look. `count`: shown in place of the name /
   "N records" (a form's submissions: the number only). `truncate`: one line, cut with an ellipsis
   (the full text on hover). */
function AssociatedRecordsValue({records, noun, onOpen, width=220, inTable=false, count, truncate=false}){
  const [open, setOpen] = React.useState(false);
  const [up, setUp] = React.useState(false);
  const [pos, setPos] = React.useState(null);
  const btnRef = React.useRef(null), menuRef = React.useRef(null);
  const z = useFloatZ(inTable && !!pos);
  // Opens above the trigger when there isn't room below (rows near the panel's bottom).
  const toggle = (e) => { const r = e.currentTarget.getBoundingClientRect(), h = records.length * 34 + 14;
    if(inTable){ setPos(pos ? null : {top: window.innerHeight - r.bottom < h + 8 ? Math.max(8, r.top - h - 4) : r.bottom + 4, left:Math.max(8, Math.min(r.left, window.innerWidth - width - 8))}); return; }
    setUp(r.bottom + 12 + records.length * 34 > window.innerHeight); setOpen(o => !o); };
  React.useEffect(() => {
    if(!pos) return;
    const close = () => setPos(null);
    const onDown = (e) => { if(menuRef.current && !menuRef.current.contains(e.target) && !btnRef.current.contains(e.target)) close(); };
    const onKey = (e) => { if(e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true); window.addEventListener('resize', close);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey);
                   window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [pos]);
  const link = {border:'none', background:'transparent', padding:0, cursor:'pointer', fontSize:13, color:T.attioBlue, textAlign:'left', fontFamily:'inherit'};
  if(records.length === 1) return <button onClick={()=>onOpen(records[0])} title={truncate ? records[0].name : undefined}
    style={{...link, minWidth:0, ...(count != null ? {fontVariantNumeric:'tabular-nums'} : truncate ? {maxWidth:'100%', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'} : {overflowWrap:'anywhere'})}}>{count != null ? count : records[0].name}</button>;
  const items = (close) => records.map(x => <MenuItem key={x.id} label={x.name} onClick={()=>{ close(); onOpen(x); }}/>);
  return (
    <span style={{position:'relative', minWidth:0}}>
      <button ref={btnRef} onClick={toggle} aria-expanded={inTable ? !!pos : open} style={{...link, display:'inline-flex', alignItems:'center', gap:4}}>
        {count != null ? <span style={{fontVariantNumeric:'tabular-nums'}}>{count}</span> : `${records.length} ${noun}s`}<Icon name="chevDown" size={T.chevronSize} color={T.attioBlue}/>
      </button>
      {inTable ? pos && ReactDOM.createPortal(
        <div ref={menuRef} style={{position:'fixed', top:pos.top, left:pos.left, width, zIndex:z, background:'#fff', border:`1px solid ${T.border}`, borderRadius:10, padding:6,
          boxShadow:'0 4px 16px rgba(16,24,40,.12)', fontWeight:400, textAlign:'left'}}>{items(() => setPos(null))}</div>, document.body)
      : <MenuShell open={open} onClose={()=>setOpen(false)} up={up} width={width}>{items(() => setOpen(false))}</MenuShell>}
    </span>
  );
}

/* The shared body: the profile (name, email, phone) always first, then the four sections in the
   order and form set in View Settings (panelSettings.jsx). Summary and activity dropdowns use
   the same treatment as the Board card. */
function ContactDetailBody({contact, acts, onStub, onCopied, onCall, withName=true, settings, actions, panelProperties}){
  const ps = settings || DEFAULT_PANEL_SETTINGS();
  const sections = {
    quickActions: () => <PanelQuickActions contact={contact} items={ps.quickActions} actions={actions} onStub={onStub} onCall={onCall}/>,
    smartSummary: () => !ps.smartSummary.enabled ? null : (
      <div style={activityBox}><SummaryBlock contact={contact} acts={acts} source="From activity"/></div>
    ),
    dropdowns: () => {
      const on = ps.dropdowns.filter(d => d.enabled && CARD_DROPDOWNS.some(x => x.key === d.type));
      if(!on.length) return null;
      return (
        <div style={activityBox}>
          {on.map((d, i) => {
            const dd = CARD_DROPDOWNS.find(x => x.key === d.type);
            return <ActivityDropdown key={d.id} first={i === 0} icon={dd.icon} label={dd.label} contact={contact}
              context={dd.type ? 'type' : 'all'} items={dd.type ? acts.filter(a => a.type === dd.type) : listedActivities(acts)}
              count={d.count} emptyText={dd.empty} linkLabel={dd.link} onLink={()=>onStub(dd.link)}/>;
          })}
        </div>
      );
    },
    contactProperties: () => <ContactInfo contact={contact} acts={acts} onStub={onStub} onOpenDeals={actions && actions.onOpenDeals} onOpenCustomers={actions && actions.onOpenCustomers} panelProperties={panelProperties}
      keys={ps.contactProperties.filter(p => p.enabled).map(p => p.key)}/>,
  };
  return (
    <div style={{display:'flex', flexDirection:'column', gap:18}}>
      <DetailHeader contact={contact} onStub={onStub} onCopied={onCopied} onCall={onCall} withName={withName} subtitle={contactSubtitle(contact, ps)}/>
      {ps.order.map(id => { const el = sections[id] && sections[id](); return el ? <React.Fragment key={id}>{el}</React.Fragment> : null; })}
    </div>
  );
}

const barIconBtn = {
  width:30, height:30, borderRadius:8, border:'none', background:'transparent', cursor:'pointer',
  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
};

/* ── Full screen ────────────────────────────────────────────────────────────────────────── */

/* Workspace tabs, in the specified order. `list` marks tabs that will hold lists of records;
   only those get Search and Filter. Tab content, search/filter behaviour, reordering and
   adding/removing tabs are all not defined yet. */
const CONTACT_TABS = [
  {id:'overview', label:'Overview',         icon:'overview', list:false},
  {id:'profile',  label:'Customer Profile', icon:'profile',  list:false},
  {id:'calls',    label:'Calls',            icon:'call',     list:true},
  {id:'notes',    label:'Notes',            icon:'notepad',  list:true},
  {id:'email',    label:'Email',            icon:'envelope', list:true},
  {id:'tasks',    label:'Tasks',            icon:'tasks',    list:true},
  {id:'meetings', label:'Meetings',         icon:'videoCamera', list:true},
  {id:'files',    label:'Files',            icon:'folder',   list:true},
  {id:'quotes',   label:'Quotes',           icon:'quote',    list:true},
  {id:'accounting', label:'Accounting',     icon:'coins',    list:false},
  {id:'deals',    label:'Deals',            icon:'deals',    list:true},
  {id:'customers', label:'Customers',       icon:'customers', list:true},
];

function WorkspaceTab({tab, active, onClick}){
  const [h, setH] = React.useState(false);
  return (
    <button onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{
        display:'flex', alignItems:'center', gap:6, padding:'12px 10px', border:'none', background:'transparent',
        cursor:'pointer', whiteSpace:'nowrap', fontSize:13, flexShrink:0, marginBottom:-1,
        color: active ? T.attioText : h ? T.gray800 : T.attioMuted, fontWeight: active ? 600 : 400,
        borderBottom:`2px solid ${active ? T.attioText : 'transparent'}`,
      }}>
      <Icon name={tab.icon} size={14} color={active ? T.attioText : T.attioMuted}/>{tab.label}
      {/* An open workflow violation resolved in this tab (workflowEngine.jsx). */}
      <ViolationMark tab={tab.id}/>
    </button>
  );
}

/* Right-hand workspace: tabs, Search/Filter under list-type tabs, placeholder content. Its tab
   state lives here, and the component stays mounted in both modes, so collapsing and
   re-expanding returns to the same tab. Another record (a Deal) passes its own `tabs` and
   `renderTab(tab, openTab, search)` for the tabs it fills itself (Overview, Customer Profile, Contacts);
   the activity tabs work the same for any record (`contact` is the record: id, name, owner). */
/* `activityViews` ({store, names, sources, schemaFor(tabId)}): the activity tabs get saved views,
   search and filters (ActivityViewsArea, activityViews.jsx) over the record's own and associated
   activity; without it they list the record's own activity, as before. */
function ContactWorkspace({contact, acts, onStub, onCall, onCreateProfile, profiles, requestedTab, team, onUpdateActivity, onAddActivity, onReassignOwner, tabs = CONTACT_TABS, renderTab, activityViews}){
  const [tabId, setTabId] = React.useState(requestedTab ? requestedTab.id : 'overview');
  const [q, setQ] = React.useState('');
  const tab = tabs.find(t => t.id === tabId) || tabs[0];
  // Activity tabs: the item being added (Note, Log Call, Task), if any, and what its form starts with.
  const [adding, setAdding] = React.useState(null);
  const [prefill, setPrefill] = React.useState(null);
  /* Overview: the record's Highlights, then its activity (what the Activity tab held — the full
     history, search, filters, views, Add). A request for the old Activity tab opens Overview. */
  const overview = tab.id === 'overview';
  const actTabId = overview ? 'activity' : tab.id;
  const isActivityTab = actTabId in ACTIVITY_TAB_TYPES;
  const actLabel = overview ? 'Activity' : tab.label;
  const hub = useRecordHub(), ra = useRecordAccess();
  const pickAdd = (o, start) => {
    if(o === 'Call') return onCall ? onCall(contact) : hub && ra && hub.startCall({object:ra.object, id:ra.record.id});   // the call window
    // Email: the composer as this tab's creation panel (emails.jsx); elsewhere at the CRM's right edge.
    if(o === 'Email' && !isActivityTab) return hub && ra ? hub.composeEmail({object:ra.object, id:ra.record.id}) : onStub('Email');
    if(o === 'Start Meeting') return onStub(o);   // a live meeting from the record: not defined yet
    setAdding(o); setPrefill(start || null);
  };
  /* Opening straight to a tab (e.g. Customer Profile right after saving one) — with a form open
     when asked (`adding`, `prefill`: e.g. a workflow event's "Create Call task"). */
  const pendingAdd = React.useRef(null);
  const flushAdd = () => { const r = pendingAdd.current; if(r && r.id === tabId){ pendingAdd.current = null; pickAdd(r.adding, r.prefill); } };
  React.useEffect(()=>{ setQ(''); setAdding(null); setPrefill(null); flushAdd(); }, [tabId]);
  React.useEffect(()=>{
    if(!requestedTab) return;
    pendingAdd.current = requestedTab.adding ? requestedTab : null;
    if(requestedTab.id !== tabId) setTabId(requestedTab.id); else flushAdd();
  }, [requestedTab && requestedTab.nonce]);
  return (
    <div style={{flex:1, minWidth:0, display:'flex', flexDirection:'column'}}>
      <div style={{display:'flex', gap:2, padding:'0 12px', borderBottom:`1px solid ${T.border}`, overflowX:'auto', flexShrink:0}}>
        {tabs.map(t => <WorkspaceTab key={t.id} tab={t} active={t.id === tab.id} onClick={()=>setTabId(t.id)}/>)}
      </div>
      {overview && (
        <div style={{padding:'20px 24px 16px', flexShrink:0, borderBottom:`1px solid ${T.border}`}}>
          <RecordHighlights object={ra ? ra.object : 'contacts'} record={ra ? ra.record : contact} view={contact} acts={acts}
            contact={ra && ra.object !== 'contacts' ? ((hub && hub.records.contacts) || []).find(c => c.id === ra.record.contactId) || null : contact}/>
        </div>
      )}
      {/* Files and Quotes bring their own toolbars (files.jsx, quotes.jsx). */}
      {(tab.list || overview) && !(isActivityTab && activityViews) && !['files', 'quotes'].includes(tab.id) && (
        <div style={{display:'flex', alignItems:'center', gap:10, padding:'12px 20px', borderBottom:`1px solid ${T.border}`, flexShrink:0}}>
          <div style={{position:'relative'}}>
            <div style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', display:'flex'}}>
              <Icon name="search" size={13} color={T.gray400}/>
            </div>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder={`Search ${actLabel.toLowerCase()}`}
              style={{padding:'7px 10px 7px 30px', fontSize:13, border:`1px solid ${T.borderStrong}`, borderRadius:8, width:220, fontFamily:'inherit'}}/>
          </div>
          <button onClick={()=>onStub(`Filter ${actLabel}`)} style={{display:'flex', alignItems:'center', gap:6, border:`1px solid ${T.borderStrong}`, background:'#fff', borderRadius:8, padding:'7px 12px', fontSize:13, color:T.gray800, cursor:'pointer'}}>
            <Icon name="filter" size={13} color={T.gray600}/> Filters
          </button>
          {isActivityTab && <><div style={{flex:1}}/><ActivityAddButton tabId={actTabId} onPick={pickAdd}/></>}
        </div>
      )}
      {renderTab && renderTab(tab, setTabId, q) !== undefined ? (
        <div style={{flex:1, minHeight:0, overflowY:'auto'}}>{renderTab(tab, setTabId, q)}</div>
      ) : tab.id === 'profile' ? (
        <div style={{flex:1, minHeight:0, overflowY:'auto'}}>
          <CustomerProfileTab contact={contact} profiles={profiles} onCall={()=>onCall && onCall(contact)}
            onCreate={(templateId)=>onCreateProfile && onCreateProfile(contact, templateId)} onStub={onStub}/>
        </div>
      ) : isActivityTab && activityViews ? (
        <ActivityViewsArea tabId={actTabId} store={activityViews.store} sources={activityViews.sources}
          schema={activityViews.schemaFor(actTabId)} controls={<ActivityAddButton tabId={actTabId} onPick={pickAdd}/>}
          render={(shown, emptyText, recordOf) => (
            <div style={{flex:1, minHeight:0, display:'flex', overflow:'hidden'}}>
              <ActivityTab tabId={actTabId} contact={contact} acts={shown} allActs={acts} emptyText={emptyText} recordOf={recordOf} team={team || []} adding={adding} setAdding={setAdding} prefill={prefill}
                onUpdate={(id, patch)=>onUpdateActivity && onUpdateActivity(contact.id, id, patch)}
                onAdd={(act)=>onAddActivity && onAddActivity(contact.id, act)} onStub={onStub}
                onReassign={(owner)=>onReassignOwner && onReassignOwner(contact.id, owner)}/>
            </div>
          )}/>
      ) : isActivityTab ? (
        /* The activity tab scrolls its two columns itself, so both run to the bottom. */
        <div style={{flex:1, minHeight:0, display:'flex', overflow:'hidden'}}>
          <ActivityTab tabId={actTabId} contact={contact} acts={acts} team={team || []} adding={adding} setAdding={setAdding} prefill={prefill}
            onUpdate={(id, patch)=>onUpdateActivity && onUpdateActivity(contact.id, id, patch)}
            onAdd={(act)=>onAddActivity && onAddActivity(contact.id, act)} onStub={onStub}
            onReassign={(owner)=>onReassignOwner && onReassignOwner(contact.id, owner)}/>
        </div>
      ) : tab.id === 'files' ? (
        <div style={{flex:1, minHeight:0, display:'flex', overflow:'hidden'}}><FilesTab acts={acts} contact={contact} team={team || []} onStub={onStub}/></div>
      ) : tab.id === 'quotes' ? (
        <div style={{flex:1, minHeight:0, display:'flex', overflow:'hidden'}}><RecordQuotesTab contact={contact} onStub={onStub}/></div>
      ) : tab.id === 'accounting' ? (
        /* Accounting: the record's payment structures (accounting.jsx). */
        <div style={{flex:1, minHeight:0, display:'flex', overflow:'hidden'}}><AccountingTab object={ra ? ra.object : 'contacts'} record={ra ? ra.record : contact}/></div>
      ) : (
        <div style={{flex:1, minHeight:0, overflowY:'auto', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:6, padding:24}}>
          <div style={{fontSize:15, fontWeight:600, color:T.gray800}}>{tab.label}</div>
          <div style={{fontSize:13, color:T.gray400}}>Content for this tab hasn't been defined yet.</div>
        </div>
      )}
    </div>
  );
}

/* ── Contact Detail: side panel ⇄ full screen ───────────────────────────────────────────────

   ONE element in both modes, so expanding reads as the same panel growing into the workspace
   rather than a page change. It is anchored to the right edge; only its width changes (460px ⇄
   the whole Contacts area), so it grows toward the left. Inside, the contact section is the
   same DOM node throughout — it only narrows from panel width to its 400px column — and the
   workspace is always mounted to its right, clipped to nothing in panel mode and revealed as
   the panel widens. The full-screen top bar opens/closes with the same timing.

   Opening slides the panel in from the right. */
const DETAIL_PANEL_W = 420;
const DETAIL_COLUMN_W = 400;
const DETAIL_EASE = 'cubic-bezier(.2,.8,.2,1)';
const DETAIL_MS = 320;

/* ── Record Owner profile ── opened from the Record Owner on a Contact, Deal or Customer; it
   slides in over the record (the record stays open behind it). Country, Language and Designation
   are the user's own (Settings → Users & Teams); a user who hasn't set one shows a value fixed per
   user (seeded from their name) until HRMS provides it. The statistics are calculated from the
   CRM's records (USER_STATS, dashboard.jsx). */
const OWNER_DESIGNATIONS = {'Super Admin':'Head of Sales', 'Admin':'Sales Manager', 'Team Lead':'Sales Team Lead', 'Sales Professional':'Sales Consultant',
  'Case Manager':'Case Manager', 'Petition Writer':'Petition Writer', 'Compliance':'Compliance Officer', 'Viewer':'Sales Associate'};
// One language each (a Language property's value), in the same five places so the draws don't move.
const OWNER_LANGUAGES = ['Urdu', 'Arabic', 'Punjabi', 'Hindi', 'English'];
const OWNER_COUNTRIES = ['Pakistan', 'United Arab Emirates', 'Pakistan', 'Canada', 'United Kingdom'];
function ownerProfileMock(name, user){
  let seed = 0; for(const ch of String(name)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = (min, max) => { seed = (seed * 1103515245 + 12345) >>> 0; return min + (seed % (max - min + 1)); };
  // Five draws come before the language, so each user keeps the values they always had.
  for(let i = 0; i < 5; i++) rnd(0, 1);
  /* Country, Language and Designation are the user's (Settings → Users & Teams → a user):
     what they set replaces the generated value — the draws still happen, in the same order. */
  const own = (user && user.profile) || {}, mine = (k, v) => own[k] != null ? own[k] : v;
  const language = mine('language', OWNER_LANGUAGES[rnd(0, OWNER_LANGUAGES.length - 1)]);
  const designation = mine('designation', (user && OWNER_DESIGNATIONS[user.preset]) || 'Sales Consultant');
  const country = mine('country', OWNER_COUNTRIES[rnd(0, OWNER_COUNTRIES.length - 1)]);
  return {language, designation, country, raw:{language, designation, country}};
}
// The user-managed properties (editable in Settings → Users); the rest are system-generated, read-only.
// The user-managed properties when none are passed (Settings → Properties → Users has them).
const OWNER_EDITABLE_PROPERTIES = [{key:'country', label:'Country', type:'Country'}, {key:'language', label:'Language', type:'Language'}, {key:'designation', label:'Designation', type:'Single-Line Text'}];
/* An editable value in the panel's row, by its property's type: click to edit with the type's own
   control; a pick (Country, Language, a selection, True / False) saves at once; the others save
   with Save or Enter (Esc cancels). An invalid value isn't saved — its error shows. */
const SAVES_ON_PICK = ['Country', 'Language', 'Single Selection', 'User', 'Boolean'];
/* `pencil`: an edit icon beside the value opens the editor — 'always' shown, or on 'hover' of the
   row (record side panels) — instead of clicking the value. `options`: labelled choices for the
   input ({value, label}; the property's `options` hold the values). `display`: the value as shown. */
function OwnerEditableValue({prop, value, onSave, options, display, pencil, align, valueStyle}){
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [hover, setHover] = React.useState(false);
  const [error, setError] = React.useState(null);
  const label = prop.label, shown = display !== undefined ? display : formatPropertyValueOf(prop, value);
  const commit = (v) => {
    const err = propertyValueError(prop, v, !!prop.mandatory);   // Mandatory holds here as in the Edit form
    if(err){ setError(err); return; }
    setEditing(false); setError(null);
    const stored = storePropertyValue(prop, v);
    if(!samePropertyValue(stored, value)) onSave(stored);
  };
  const cancel = () => { setEditing(false); setError(null); };
  // With an edit icon: the field, then a cross (discard) and a checkmark (save at once).
  if(editing && pencil) return (
    <div style={{flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:6}}
      onKeyDown={e=>{ if(e.key === 'Enter' && e.target.tagName === 'INPUT'){ e.preventDefault(); commit(draft); } if(e.key === 'Escape'){ e.stopPropagation(); cancel(); } }}>
      <div style={{display:'flex', alignItems:'center', gap:6}}>
        <div style={{flex:1, minWidth:0}}>
          <TypedPropertyInput prop={prop} value={draft} invalid={!!error} autoFocus options={options} onChange={(v)=>{ setDraft(v); setError(null); }}/>
        </div>
        {/* Secondary icon buttons: a cross (discard) and a checkmark (save). */}
        {[{icon:'close', title:'Cancel', aria:`Cancel editing ${label}`, on:cancel}, {icon:'check', title:'Save', aria:`Save ${label}`, on:()=>commit(draft)}].map(b => (
          <button key={b.icon} onClick={b.on} title={b.title} aria-label={b.aria}
            style={{width:26, height:26, borderRadius:6, border:`1px solid ${T.borderStrong}`, background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
            <Icon name={b.icon} size={12} color={T.gray600}/>
          </button>
        ))}
      </div>
      {error && <div style={{fontSize:12, color:T.red}}>{error}</div>}
    </div>
  );
  if(editing) return (
    <div style={{flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:6}}
      onKeyDown={e=>{ if(e.key === 'Enter' && e.target.tagName === 'INPUT'){ e.preventDefault(); commit(draft); } if(e.key === 'Escape'){ e.stopPropagation(); setEditing(false); setError(null); } }}>
      <TypedPropertyInput prop={prop} value={draft} invalid={!!error} autoFocus options={options}
        onChange={(v)=>{ setDraft(v); setError(null); if(SAVES_ON_PICK.includes(propertyTypeId(prop.type))) commit(v); }}/>
      {error && <div style={{fontSize:12, color:T.red}}>{error}</div>}
      {!SAVES_ON_PICK.includes(propertyTypeId(prop.type)) && (
        <div style={{display:'flex', gap:6}}>
          <button onClick={()=>commit(draft)} style={{padding:'4px 10px', borderRadius:6, border:'none', background:T.black, color:'#fff', fontSize:12.5, fontFamily:'inherit', cursor:'pointer'}}>Save</button>
          <button onClick={()=>{ setEditing(false); setError(null); }} style={{padding:'4px 10px', borderRadius:6, border:`1px solid ${T.borderStrong}`, background:'#fff', fontSize:12.5, fontFamily:'inherit', cursor:'pointer'}}>Cancel</button>
        </div>
      )}
    </div>
  );
  const open = () => { setDraft(inputPropertyValue(prop, value)); setEditing(true); };
  if(pencil) return (
    <span onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} style={{flex:1, minWidth:0, display:'flex', alignItems:'baseline', gap:6, justifyContent: align === 'right' ? 'flex-end' : 'flex-start'}}>
      <span style={{minWidth:0, fontSize:13, color: shown ? T.attioText : T.attioFaint, overflowWrap:'anywhere', textAlign: align === 'right' ? 'right' : 'left', ...(valueStyle || {})}}>{shown || '—'}</span>
      <button onClick={open} title={`Edit ${label}`} aria-label={`Edit ${label}`}
        style={{border:'none', background:'transparent', padding:2, cursor:'pointer', display:'flex', alignSelf:'center', flexShrink:0,
          opacity: pencil === 'always' || hover ? 1 : 0, transition:'opacity 120ms'}}>
        <Icon name="edit" size={12} color={T.gray600}/>
      </button>
    </span>
  );
  return (
    <button onClick={open} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} title={`Edit ${label}`}
      style={{flex:1, minWidth:0, textAlign:'left', border:'none', background: hover ? T.headerBg : 'transparent', borderRadius:6, padding:'2px 6px', margin:'-2px -6px',
        cursor:'text', fontFamily:'inherit', fontSize:13, color: shown ? T.attioText : T.attioFaint, overflowWrap:'anywhere'}}>{shown || '—'}</button>
  );
}
/* A record's property in its side panel: editable in place (hover → edit icon) when it's an
   editable property of the record type — not the name and owner (they have their own flows), not
   one the system sets, and only where the signed-in user may edit it (Records → Edit, its stage
   moves and property values). Pipeline and Stage pick from the record's pipelines and that pipeline's
   stages (a new pipeline starts at its first stage). Saves through the record hub. → {prop,
   options, value, save} or null. */
function panelEditSpec(hub, object, record, key){
  if(!hub || !hub.updateRecord || !record) return null;
  const prop = objectProperties(hub.data, object).find(p => p.key === key);
  if(!prop || prop.auto || prop.derived || ['name', 'owner'].includes(key)) return null;
  // The signed-in user's Records → Edit: the record, its stages, this property's value.
  if(!fieldEditCan(object, record, prop)) return null;
  const t = propertyTypeId(prop.type);
  const save = (patch) => hub.updateRecord(object, record.id, patch);
  if(t === 'Pipeline'){
    const pls = recordPipelines(hub.data, object);
    return {prop:{...prop, type:'Single Selection', options:pls.map(p => p.id)}, options:pls.map(p => ({value:p.id, label:p.label})), value:record.pipeline,
      save:(v) => { const pl = pls.find(p => p.id === v); save({pipeline:v, ...(pl && !pl.stages.some(st => st.id === record.stage) ? {stage:(pl.stages[0] || {}).id || ''} : {})}); }};
  }
  if(t === 'Pipeline stage'){
    const pl = recordPipelines(hub.data, object).find(p => p.id === record.pipeline), st = pl ? pl.stages : [];
    return {prop:{...prop, type:'Single Selection', options:st.map(x => x.id)}, options:st.map(x => ({value:x.id, label:x.label})), value:record.stage, save:(v) => save({stage:v})};
  }
  return {prop, value:record[key], save:(v) => save({[key]:v})};
}
// The row's value, editable in place when panelEditSpec allows it (`display`: as the panel shows it).
function PanelEditableValue({spec, display}){
  return <OwnerEditableValue prop={spec.prop} value={spec.value} options={spec.options} display={display} pencil="always" onSave={spec.save}/>;
}

/* A user's profile: over a record (its Record Owner), or — `editable`, Settings → Users — with the
   User Properties (Country, Language, Designation and any added) edited in place, one field at a
   time (`onSaveProfile(patch)`). Under them, the user's statistics; a statistic's trend opens in
   the same panel. `user`: the user record (else looked up by `name`); `fixed`: over the page
   rather than a record. */
function OwnerProfilePanel({name, onClose, user: userProp, editable, onSaveProfile, fixed, properties}){
  const hub = useRecordHub();
  const [entered, setEntered] = React.useState(false);
  const [trend, setTrend] = React.useState(null);     // the statistic whose trend is open
  const today = new Date();
  const [filter, setFilter] = React.useState(() => ({id:'month', from:ymd(new Date(today.getFullYear(), today.getMonth(), 1)), to:ymd(today)}));
  React.useEffect(()=>{
    let r2; const r1 = requestAnimationFrame(()=>{ r2 = requestAnimationFrame(()=>setEntered(true)); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, []);
  // Esc closes the trend first, then this panel (the record behind it stays open).
  React.useEffect(()=>{
    const onKey = (e) => { if(e.key === 'Escape' && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)){ e.stopPropagation(); trend ? setTrend(null) : onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, trend]);
  const users = (hub && hub.data && hub.data.users) || USER_DIRECTORY;
  const user = userProp || users.find(u => u.name === name || u.id === name) || USER_DIRECTORY.find(u => u.name === name || u.id === name) || null;
  const values = React.useMemo(() => ownerProfileMock(user ? user.name : name, user), [name, user]);
  const props = properties || (hub && hub.data ? (hub.data.properties || []).filter(p => p.objectId === 'users' && !p.archived) : null) || OWNER_EDITABLE_PROPERTIES;
  const valueOf = (p) => p.key in values.raw ? values.raw[p.key] : ((user && user.profile) || {})[p.key];
  const shown = Object.fromEntries(props.map(p => [p.key, formatPropertyValueOf(p, valueOf(p)) || '']));
  const data = useDashBusinessData(hub);
  const person = userStatPerson(data, user ? user.id : name);
  return (
    <div role="dialog" aria-label={`${name} profile`} style={{
      position: fixed ? 'fixed' : 'absolute', top:0, right:0, bottom:0, zIndex: fixed ? 90 : 5, width:DETAIL_PANEL_W, maxWidth:'100%',
      transform: entered ? 'none' : 'translateX(100%)', transition:`transform ${DETAIL_MS}ms ${DETAIL_EASE}`,
      background:'#fff', borderLeft:`1px solid ${T.border}`, boxShadow:'-12px 0 32px rgba(16,24,40,.10)', display:'flex', flexDirection:'column',
    }}>
      <div style={{padding:'16px 14px 12px 20px', flexShrink:0}}>
        <NameRow contact={{name: user ? user.name : name}} subtitle={values.language}
          headerActions={<button title="Close" onClick={onClose} style={barIconBtn}><Icon name="close" size={13} color={T.gray600}/></button>}/>
      </div>
      <div style={{flex:1, minHeight:0, overflowY:'auto', padding:'0 20px 24px'}}>
        {trend
          ? <UserStatTrend person={person} statKey={trend} filter={filter} setFilter={setFilter} onBack={()=>setTrend(null)}/>
          : <>
            {/* The User Properties — each edited on its own (edit icon), by its type; read-only over a record. */}
            {props.map(p => (
              <div key={p.key} style={{display:'flex', alignItems:'baseline', gap:12, padding:'7px 0', borderBottom:`1px solid ${T.attioLine}`, minHeight:32}}>
                <span style={{width:190, flexShrink:0, fontSize:12.5, color:T.attioMuted, whiteSpace:'nowrap'}}>{p.label}</span>
                {editable
                  ? <OwnerEditableValue prop={p} value={valueOf(p)} pencil="always" onSave={(v)=>onSaveProfile && onSaveProfile({[p.key]:v})}/>
                  : <span style={{fontSize:13, color: shown[p.key] ? T.attioText : T.attioFaint, minWidth:0, overflowWrap:'anywhere'}}>{shown[p.key] || '—'}</span>}
              </div>
            ))}
            <UserStatistics person={person} userId={user ? user.id : name} filter={filter} setFilter={setFilter} properties={props} values={shown} onTrend={setTrend}/>
          </>}
      </div>
    </div>
  );
}

/* Another record (a Deal) uses the same shell, passing `backLabel`, `renderName(headerActions)`,
   `menu`, `body` and `workspace` in place of the contact's. */
function ContactDetail({mode, contact, acts, properties, panelProperties, onClose, onExpand, onCollapse, onStub, onCopied, actions, profiles, requestedTab, panelSettings, onOpenPanelSettings, team, onUpdateActivity, onAddActivity, onReassignOwner,
                        backLabel = 'Contacts', renderName, menu, body, workspace, activityViews}){
  const full = mode === 'full';
  const [entered, setEntered] = React.useState(false);
  React.useEffect(()=>{
    // Two frames so the off-screen start position is painted before the slide begins.
    let r2; const r1 = requestAnimationFrame(()=>{ r2 = requestAnimationFrame(()=>setEntered(true)); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, []);

  React.useEffect(()=>{
    if(full) return;
    // Esc typed into a field (e.g. a column search) belongs to that field, not the panel.
    const onKey = (e) => { if(e.key === 'Escape' && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, full]);

  const t = (prop) => `${prop} ${DETAIL_MS}ms ${DETAIL_EASE}`;
  // The Record Owner whose profile is open over this record.
  const [ownerOpen, setOwnerOpen] = React.useState(null);
  const ownerProfile = React.useMemo(() => ({open:setOwnerOpen}), []);
  React.useEffect(()=>{ setOwnerOpen(null); }, [contact && contact.id]);

  return (
    <OwnerProfileCtx.Provider value={ownerProfile}>
    {/* The record's open workflow violations: the notice, and the marks on its properties, tabs and installments. */}
    <RecordViolationsProvider record={contact}>
    <div style={{
      position:'absolute', top:0, right:0, bottom:0, zIndex:70, overflow:'hidden',
      width: full ? '100%' : DETAIL_PANEL_W, maxWidth:'100%',
      transform: entered ? 'none' : 'translateX(100%)',
      transition: `${t('width')}, ${t('transform')}, ${t('box-shadow')}`,
      background:'#fff', borderLeft:`1px solid ${T.border}`,
      boxShadow: full ? 'none' : '-12px 0 32px rgba(16,24,40,.10)',
      display:'flex', flexDirection:'column',
    }}>
      {/* Full-screen top bar: breadcrumb, then Collapse and Close at the top right. Present in
          both modes, opening to its height as the panel expands. */}
      <div aria-hidden={!full} style={{
        height: full ? 49 : 0, opacity: full ? 1 : 0, overflow:'hidden', flexShrink:0,
        transition: `${t('height')}, ${t('opacity')}`, pointerEvents: full ? 'auto' : 'none',
        borderBottom:`1px solid ${full ? T.border : 'transparent'}`,
      }}>
        <div style={{display:'flex', alignItems:'center', gap:8, padding:'10px 16px'}}>
          <button onClick={onClose} style={{display:'flex', alignItems:'center', gap:6, border:'none', background:'transparent', cursor:'pointer', fontSize:13, color:T.gray600, padding:'4px 6px', borderRadius:6}}>
            <Icon name="arrowLeft" size={14} color={T.gray600}/> {backLabel}
          </button>
          <span style={{fontSize:13, color:T.attioFaint}}>/</span>
          <span style={{fontSize:13, color:T.attioText, fontWeight:500, flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{contact.name}</span>
          <button title="Back to side panel" onClick={onCollapse} style={barIconBtn}><Icon name="collapse" size={15} color={T.gray600}/></button>
          <button title="Close" onClick={onClose} style={barIconBtn}><Icon name="close" size={13} color={T.gray600}/></button>
        </div>
      </div>

      <div style={{flex:1, minHeight:0, display:'flex'}}>
        {/* Contact section — the same node in both modes. */}
        <div style={{
          width: full ? DETAIL_COLUMN_W : DETAIL_PANEL_W - 1, flexShrink:0, display:'flex', flexDirection:'column',
          borderRight:`1px solid ${full ? T.border : 'transparent'}`, transition: t('width'),
        }}>
          <div style={{padding:'16px 14px 12px 20px', flexShrink:0}}>
            {/* Side panel: Close, Expand and the menu sit right of the name. Full screen: only
                the menu — Close and Collapse live in the top bar, and nothing is duplicated. */}
            {(() => {
              const headerActions = <>
                {!full && <button title="Close" onClick={onClose} style={barIconBtn}><Icon name="close" size={13} color={T.gray600}/></button>}
                {!full && <button title="Open full screen" onClick={onExpand} style={barIconBtn}><Icon name="expand" size={15} color={T.gray600}/></button>}
                {menu || <ContactActionsMenu contact={contact} {...actions} onViewSettings={onOpenPanelSettings || (()=>onStub('View Settings'))}/>}
              </>;
              return renderName ? renderName(headerActions) : <NameRow contact={contact} subtitle={contactSubtitle(contact, panelSettings)} headerActions={headerActions}/>;
            })()}
          </div>
          <div style={{flex:1, minHeight:0, overflowY:'auto', padding:'0 20px 24px'}}>
            <ViolationNotice/>
            {body || <ContactDetailBody contact={contact} acts={acts} onStub={onStub} onCopied={onCopied}
              onCall={actions && actions.onCall} withName={false} settings={panelSettings} actions={actions} panelProperties={panelProperties}/>}
          </div>
        </div>

        {/* Workspace — always mounted; clipped away in panel mode, revealed as the panel widens. */}
        <div aria-hidden={!full} style={{flex:1, minWidth:0, display:'flex', overflow:'hidden',
             opacity: full ? 1 : 0, transition: t('opacity'), pointerEvents: full ? 'auto' : 'none'}}>
          {/* The minimum width only matters while collapsing (keeps content from squashing as it
              is clipped away); in full mode the workspace takes whatever width is available. */}
          <div style={{flex:1, minWidth: full ? 0 : 560, display:'flex'}}>
            {workspace || <ContactWorkspace contact={contact} acts={acts} onStub={onStub} onCall={actions && actions.onCall}
              onCreateProfile={actions && actions.onCreateProfile}
              profiles={profiles} requestedTab={requestedTab}
              team={team} onUpdateActivity={onUpdateActivity} onAddActivity={onAddActivity} onReassignOwner={onReassignOwner}
              renderTab={actions && actions.renderTab} activityViews={activityViews}/>}
          </div>
        </div>
      </div>
      {ownerOpen && <OwnerProfilePanel key={ownerOpen} name={ownerOpen} onClose={()=>setOwnerOpen(null)}/>}
    </div>
    </RecordViolationsProvider>
    </OwnerProfileCtx.Provider>
  );
}

Object.assign(window, {PropertyRowLabel, AssociatedRecordsValue, panelEditSpec, PanelEditableValue, ContactDetail, ContactDetailBody, ContactWorkspace, ownerDates, NameRow, ContactLine, QuickAction, OwnerLink, barIconBtn, CONTACT_TABS});
