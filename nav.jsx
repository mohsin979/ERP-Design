/* HOF Pulse ERP — CRM navigation.

   Default structure (product definition): Dashboard, five expandable/collapsible groups —
   Marketing, Pre-Sales, Sales, Tools, Automation — then Settings. In Marketing only Forms and
   Brand show by default (Campaigns, SEO, Socials and Ads are hidden until an
   admin shows them — Edit Nav, or Settings → Navigation). Groups are set apart by
   generous negative space so the sidebar reads as calm, distinct sections. Edit Nav, pinned at the
   bottom, opens Navigation Management: hide / unhide any entry or item, and reorder the
   top-level entries and the items inside each group (items stay in their group, so the
   hierarchy holds). Changes apply on Apply. The collapsed sidebar is the standard icons-only
   rail with tooltips.

   Every item navigates; pages whose content isn't specified say so on the canvas. */

const CRM_NAV_DEFAULT = () => ([
  {id:'dashboard', label:'Dashboard', icon:'dashboard', hidden:false},
  {id:'marketing', label:'Marketing', group:true, hidden:false, items:[
    {id:'campaigns',   label:'Campaigns',    icon:'campaigns', hidden:true},
    {id:'seo',         label:'SEO',          icon:'seo',       hidden:true},
    {id:'socials',     label:'Socials',      icon:'socials',   hidden:true},
    {id:'ads',         label:'Ads',          icon:'ads',       hidden:true},
    {id:'forms',       label:'Forms',        icon:'forms',     hidden:false},
    {id:'brand',       label:'Brand',        icon:'brand',     hidden:false},
  ]},
  {id:'preSales', label:'Pre-Sales', group:true, hidden:false, items:[
    {id:'contacts', label:'Contacts', icon:'contacts', hidden:false},
    {id:'deals',    label:'Deals',    icon:'deals',    hidden:false},
  ]},
  {id:'sales', label:'Sales', group:true, hidden:false, items:[
    {id:'customers', label:'Customers', icon:'customers', hidden:false},
  ]},
  {id:'tools', label:'Tools', group:true, hidden:false, items:[
    {id:'calls',    label:'Calls',    icon:'call',        hidden:false},
    {id:'tasks',    label:'Tasks',    icon:'tasks',       hidden:false},
    {id:'emails',   label:'Emails',   icon:'envelope',    hidden:false},
    {id:'meetings', label:'Meetings', icon:'videoCamera', hidden:false},
    {id:'notes',    label:'Notes',    icon:'notepad',     hidden:false},
    {id:'quotes',   label:'Quotes',   icon:'quote',       hidden:false},
    {id:'services', label:'Services', icon:'services',    hidden:false},   // the service catalog quotations are built from (services.jsx)
  ]},
  {id:'automation', label:'Automation', group:true, hidden:false, items:[
    {id:'reports',   label:'Reports',   icon:'analytical', hidden:false},
    {id:'workflows', label:'Workflows', icon:'workflows',  hidden:false},
  ]},
  {id:'settings', label:'Settings', icon:'settingsGear', hidden:false},
]);

/* Settings' secondary navigation (product definition): three collapsible groups, in this
   order. Ids are prefixed so they never collide with main-nav ids (Tasks, Calls, …). */
const CRM_SETTINGS_NAV = [
  {id:'settings.tools', label:'Tools', group:true, items:[
    {id:'settings.email',    label:'Email',    icon:'envelope'},
    {id:'settings.calls',    label:'Calls',    icon:'call'},
    {id:'settings.meetings', label:'Meetings', icon:'videoCamera'},
    {id:'settings.calendar', label:'Calendar', icon:'calendar'},
    {id:'settings.tasks',    label:'Tasks',    icon:'tasks'},
  ]},
  {id:'settings.crm', label:'CRM Settings', group:true, items:[
    {id:'settings.defaults',      label:'Defaults',      icon:'sliders'},
    {id:'settings.usersTeams',    label:'Users & Teams', icon:'usersThree'},
    {id:'settings.notifications', label:'Notifications', icon:'notification'},
    {id:'settings.navigation',    label:'Navigation',    icon:'listBullets'},
  ]},
  {id:'settings.data', label:'Data Management', group:true, items:[
    {id:'settings.objects',         label:'Records',          icon:'cube'},
    {id:'settings.properties',      label:'Properties',       icon:'listBullets'},
    {id:'settings.pipelines',       label:'Pipelines',        icon:'kanbanView'},
    {id:'settings.customerProfile', label:'Customer Profile', icon:'profile'},
    {id:'settings.templates',       label:'Templates',        icon:'files'},
    {id:'settings.importExport',    label:'Import & Export',  icon:'arrowsDownUp'},
  ]},
];
/* Default pages — where a module or section opens, with no in-between "Select an item" screen:
   CRM opens on its Dashboard (or, if that's hidden in Edit Nav, the first page shown); Settings
   opens on its first page, Email. */
const SETTINGS_DEFAULT_PAGE = 'settings.email';
const crmDefaultPage = (nav) => {
  const shown = (list) => (list || []).filter(x => !x.hidden).flatMap(x => x.group ? shown(x.items) : [x.id]);
  const ids = shown(nav).filter(id => id !== 'settings');
  return ids.includes('dashboard') ? 'dashboard' : ids[0] || 'dashboard';
};
const isSettingsPage = (id) => id === 'settings' || (typeof id === 'string' && id.startsWith('settings.'));

/* Objects (Settings → Objects) appear in the navigation group they're assigned to: an Object's
   entry moves into its group (keeping its icon and visibility), takes the Object's name, and a
   new Object is added at the end of its group. Everything else in the nav is unchanged. */
const NAV_GROUP_IDS = {'Marketing':'marketing', 'Pre-Sales':'preSales', 'Sales':'sales', 'Tools':'tools', 'Automation':'automation'};
// Forms is a Marketing page (forms.jsx), not a record type, so it isn't listed here.
const OBJECT_NAV_ICONS = {contacts:'contacts', deals:'deals', customers:'customers', service:'services'};
/* Items of record types that no longer exist (deleted, or removed defaults such as Services)
   leave the navigation; the other items are untouched. */
const isObjectNavItem = (id) => !!OBJECT_NAV_ICONS[id] || String(id).startsWith('obj-');
// Entries removed from the product (saved navigation may still list them): Lead Scoring.
const REMOVED_NAV_IDS = ['leadScoring'];
// Entries added to the product since a navigation was saved join their group, after `after`.
const ADDED_NAV_ITEMS = [{group:'tools', after:'quotes', item:{id:'services', label:'Services', icon:'services', hidden:false}},
  {group:'marketing', after:'ads', item:{id:'forms', label:'Forms', icon:'forms', hidden:false}}];
function navWithObjects(nav, objects){
  const ids = new Set((objects || []).map(o => o.id));
  const next = nav.map(e => e.group ? {...e, items:e.items.filter(x => !REMOVED_NAV_IDS.includes(x.id) && (!isObjectNavItem(x.id) || ids.has(x.id)))} : e)
    .filter(e => e.group || !isObjectNavItem(e.id) || ids.has(e.id));
  ADDED_NAV_ITEMS.forEach(({group, after, item}) => {
    const g = next.find(e => e.id === group);
    if(!g || next.some(e => e.group && e.items.some(x => x.id === item.id))) return;
    const i = g.items.findIndex(x => x.id === after);
    g.items = i >= 0 ? [...g.items.slice(0, i + 1), {...item}, ...g.items.slice(i + 1)] : [...g.items, {...item}];
  });
  (objects || []).forEach(o => {
    const group = next.find(e => e.id === NAV_GROUP_IDS[o.group]);
    if(!group) return;
    let item = null;
    next.forEach(e => { if(!e.group) return; const i = e.items.findIndex(x => x.id === o.id); if(i >= 0){ item = e.items[i]; if(e !== group) e.items.splice(i, 1); } });
    if(item && group.items.some(x => x.id === o.id)){ group.items = group.items.map(x => x.id === o.id ? {...x, label:o.name} : x); return; }
    group.items.push({icon:OBJECT_NAV_ICONS[o.id] || 'cube', hidden:false, ...(item || {}), id:o.id, label:o.name});
  });
  return next;
}

/* Page titles for the canvas, from the default structure. */
const CRM_NAV_LABELS = (() => {
  const m = {editNav:'Edit Nav'};
  [...CRM_NAV_DEFAULT(), ...CRM_SETTINGS_NAV].forEach(e => { if(e.group) e.items.forEach(i => { m[i.id] = i.label; }); else m[e.id] = e.label; });
  return m;
})();

function CrmNavItem({icon, label, active, collapsed, onClick}){
  const [hover, setHover] = React.useState(false);
  const state = active ? 'active' : hover ? 'hover' : 'default';
  const bg = state==='active' ? T.black : state==='hover' ? T.headerBg : 'transparent';
  const color = state==='active' ? '#fff' : T.gray600;
  return (
    <div onClick={()=> onClick && onClick()}
      onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      title={collapsed ? label : undefined}
      style={{
        display:'flex', alignItems:'center', gap: collapsed ? 0 : 8,
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '8px 0' : '7px 10px', borderRadius:6,
        background:bg, cursor:'pointer',
        fontSize:13, marginBottom:2,
      }}>
      <Icon name={icon} size={15} color={color}/>
      {!collapsed && <span style={{color, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{label}</span>}
    </div>
  );
}

/* A group: a small header that expands / collapses its items (always shown in the icon rail). */
function CrmNavGroup({group, active, collapsed, setActive, first}){
  const [open, setOpen] = React.useState(true);
  const items = group.items.filter(i => !i.hidden);
  if(!items.length) return null;
  return (
    <div style={{marginTop: first ? 0 : collapsed ? 10 : 18}}>
      {!collapsed && (
        <div onClick={()=>setOpen(o=>!o)} style={{display:'flex', alignItems:'center', gap:4, padding:'2px 2px 6px', color:T.gray400, fontSize:11.5, cursor:'pointer', userSelect:'none'}}>
          <Icon name="chevDown" size={T.chevronSize} color={T.gray400} style={{transform: open ? 'none' : 'rotate(-90deg)'}}/>
          <span>{group.label}</span>
        </div>
      )}
      {(collapsed || open) && items.map(n => (
        <CrmNavItem key={n.id} icon={n.icon} label={n.label} active={active===n.id} collapsed={collapsed} onClick={()=>setActive(n.id)}/>
      ))}
    </div>
  );
}

function CrmSidebar({active, setActive, onBack, nav, setNav}){
  const [collapsed, setCollapsed] = React.useState(false);
  const [managing, setManaging] = React.useState(null);   // draft while Navigation Management is open
  const entries = (nav || CRM_NAV_DEFAULT()).filter(e => !e.hidden);
  const width = collapsed ? 56 : 200;

  return (
    <div style={{width, height:'100%', background:'#fff', borderRight:`1px solid ${T.border}`, display:'flex', flexDirection:'column', flexShrink:0, padding: collapsed ? '16px 8px' : '16px 12px', transition:'width 160ms ease'}}>
      <div style={{display:'flex', alignItems:'center', justifyContent: collapsed ? 'center' : 'space-between', marginBottom:16, padding:'0 2px'}}>
        {!collapsed && (
          <div onClick={onBack} title="Back to main navigation" style={{display:'flex', alignItems:'center', gap:6, cursor:'pointer'}}>
            <Icon name="arrowLeft" size={14} color={T.gray600}/>
            <Logo variant="crm" height={16}/>
          </div>
        )}
        {/* One supplied panel glyph serves both directions (as in Attio): it is asymmetric, so
            the previous 180° flip would put the rail on the right with its rows upside-down at
            the bottom. Direction is carried by the tooltip and by the sidebar itself. */}
        <div onClick={()=>setCollapsed(c=>!c)} title={collapsed ? 'Expand' : 'Collapse'} style={{cursor:'pointer', display:'flex'}}>
          <Icon name="sidebarCollapse" size={18} color={T.gray600}/>
        </div>
      </div>

      {/* The entries scroll on their own when taller than the window; Edit Nav stays in view.
          A standalone entry that follows a group gets the same space above it as a group does. */}
      <div style={{flex:1, minHeight:0, overflowY:'auto', margin: collapsed ? '0 -8px' : '0 -12px', padding: collapsed ? '0 8px 8px' : '0 12px 8px'}}>
      {entries.map((e, i) => e.group
        ? <CrmNavGroup key={e.id} group={e} active={active} collapsed={collapsed} setActive={setActive}/>
        : <div key={e.id} style={{marginTop: i > 0 && entries[i-1].group ? (collapsed ? 10 : 18) : 0}}>
            <CrmNavItem icon={e.icon} label={e.label} active={active===e.id} collapsed={collapsed} onClick={()=>setActive(e.id)}/>
          </div>)}
      </div>

      <div style={{height:1, background:T.border, margin:'0 0 8px', flexShrink:0}}/>
      <CrmNavItem icon="edit" label="Edit Nav" active={false} collapsed={collapsed}
        onClick={()=>setManaging(JSON.parse(JSON.stringify(nav || CRM_NAV_DEFAULT())))}/>

      {managing && (
        <NavManagementModal draft={managing} setDraft={setManaging}
          onClose={()=>setManaging(null)} onApply={()=>{ setNav && setNav(managing); setManaging(null); }}/>
      )}
    </div>
  );
}

/* Settings' secondary navigation: opens beside the main nav when Settings is selected. Top row:
   a back arrow and the title (as in the Figma Settings frame). The arrow collapses this menu —
   the page stays, and Settings stays selected in the main nav, which opens the menu again. */
/* ── Quick Search (the CRM Settings menu's first item) ── records, properties, pipelines and
   stages by name. Each result: its name and a short type ("Property · Deals", "Stage · US NIW" —
   the record type or pipeline it belongs to, so like-named ones are told apart). Picking one opens
   its page, and its panel there (a stage: its pipeline). While there's a query, the results take
   the menu's place; Esc or × clears it. */
const SETTINGS_SEARCH_KINDS = ['record', 'pipeline', 'property', 'stage'];
const settingsSearchIndex = (data) => [
  ...(data.objects || []).map(o => ({kind:'record', id:o.id, name:o.name, meta:'Record', icon:'cube', page:'settings.objects'})),
  ...(data.pipelines || []).map(p => ({kind:'pipeline', id:p.id, name:p.label, meta:`Pipeline · ${objectName(data, p.objectId)}`, icon:'kanbanView', page:'settings.pipelines'})),
  ...(data.properties || []).map(p => ({kind:'property', id:`${p.objectId}:${p.key}`, objectId:p.objectId, key:p.key, name:p.label, meta:`Property · ${objectName(data, p.objectId)}`, icon:'listBullets', page:'settings.properties'})),
  ...(data.pipelines || []).flatMap(p => (p.stages || []).map(s => ({kind:'stage', id:`${p.id}:${s.id}`, pipelineId:p.id, stageId:s.id, name:s.label, meta:`Stage · ${p.label}`, icon:'forward', page:'settings.pipelines'}))),
];
// Best first: the name exactly, then starting with the query, a word in it starting with it, containing it; then a match with its type ("deal stage").
function settingsSearch(data, query){
  const q = query.trim().toLowerCase();
  if(!q) return [];
  const words = q.split(/\s+/);
  const scored = settingsSearchIndex(data).map(it => {
    const n = it.name.toLowerCase(), all = `${n} ${it.meta.toLowerCase()}`;
    const score = n === q ? 0 : n.startsWith(q) ? 1 : n.split(/[^a-z0-9]+/).some(w => w.startsWith(q)) ? 2 : n.includes(q) ? 3 : words.every(w => all.includes(w)) ? 4 : null;
    return score === null ? null : {...it, score};
  }).filter(Boolean);
  return scored.sort((a, b) => a.score - b.score || SETTINGS_SEARCH_KINDS.indexOf(a.kind) - SETTINGS_SEARCH_KINDS.indexOf(b.kind) || a.name.localeCompare(b.name)).slice(0, 40);
}
function SettingsQuickSearch({query, setQuery, onKey}){
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{display:'flex', alignItems:'center', gap:8, padding:'0 8px 0 10px', height:32, borderRadius:6, marginBottom:12,
      border:`1px solid ${focus ? T.attioBlue : T.borderStrong}`, background:'#fff'}}>
      <Icon name="search" size={14} color={T.gray600}/>
      <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={onKey} onFocus={()=>setFocus(true)} onBlur={()=>setFocus(false)}
        placeholder="Quick Search" aria-label="Quick Search settings"
        style={{flex:1, minWidth:0, border:'none', outline:'none', background:'transparent', fontSize:13, fontFamily:'inherit', color:T.attioText, padding:0}}/>
      {query && <button title="Clear" aria-label="Clear search" onClick={()=>setQuery('')} style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:2}}>
        <Icon name="close" size={11} color={T.gray600}/></button>}
    </div>
  );
}
function SettingsSearchResults({results, cursor, setCursor, onOpen}){
  if(!results.length) return <div style={{fontSize:12.5, color:T.gray400, padding:'6px 10px'}}>No results</div>;
  return results.map((r, i) => (
    <div key={`${r.kind}:${r.id}`} role="option" aria-selected={i === cursor} onMouseEnter={()=>setCursor(i)} onMouseDown={e=>e.preventDefault()} onClick={()=>onOpen(r)}
      style={{display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:6, cursor:'pointer', marginBottom:2, background: i === cursor ? T.headerBg : 'transparent'}}>
      <Icon name={r.icon} size={14} color={T.gray600} style={{flexShrink:0}}/>
      <div style={{minWidth:0, flex:1}}>
        <div style={{fontSize:13, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{r.name}</div>
        <div style={{fontSize:11.5, color:T.attioMuted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{r.meta}</div>
      </div>
    </div>
  ));
}

function CrmSettingsNav({active, setActive, onClose, data, onOpenEntity}){
  const [query, setQuery] = React.useState('');
  const [cursor, setCursor] = React.useState(0);
  const results = React.useMemo(() => data ? settingsSearch(data, query) : [], [data, query]);
  React.useEffect(() => setCursor(0), [query]);
  const open = (r) => r && onOpenEntity && onOpenEntity(r);
  const onKey = (e) => {
    if(e.key === 'Escape'){ setQuery(''); return; }
    if(!results.length) return;
    if(e.key === 'ArrowDown'){ e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)); }
    if(e.key === 'ArrowUp'){ e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    if(e.key === 'Enter'){ e.preventDefault(); open(results[cursor]); }
  };
  return (
    <div style={{width:200, height:'100%', background:'#fff', borderRight:`1px solid ${T.border}`, display:'flex', flexDirection:'column', flexShrink:0, padding:'16px 12px'}}>
      <div onClick={onClose} title="Collapse Settings menu" style={{display:'flex', alignItems:'center', gap:8, marginBottom:16, padding:'0 2px', minHeight:18, cursor:'pointer', alignSelf:'flex-start'}}>
        <Icon name="arrowLeft" size={14} color={T.gray600}/>
        <span style={{fontSize:13, fontWeight:600, color:T.attioText}}>Settings</span>
      </div>
      {data && <SettingsQuickSearch query={query} setQuery={setQuery} onKey={onKey}/>}
      <div role={query.trim() ? 'listbox' : undefined} style={{flex:1, minHeight:0, overflowY:'auto', margin:'0 -12px', padding:'0 12px 8px'}}>
        {query.trim() ? <SettingsSearchResults results={results} cursor={cursor} setCursor={setCursor} onOpen={open}/>
          : CRM_SETTINGS_NAV.map((g, i) => <CrmNavGroup key={g.id} group={g} active={active} setActive={setActive} first={i === 0}/>)}
      </div>
    </div>
  );
}

/* ── Navigation Management ───────────────────────────────────────────────────────────────── */

/* One row: drag handle, icon, label, and the eye toggle (the same hide / unhide control the
   View Settings drawer uses). Hidden rows read muted. */
function NavManageRow({label, icon, hidden, onToggle, drag, dragOver, group, indent}){
  return (
    <div {...drag} style={{display:'flex', alignItems:'center', gap:8, padding:'7px 8px', paddingLeft: indent ? 34 : 8, borderRadius:6, cursor:'grab',
                           background:'#fff', outline: dragOver ? `2px solid ${T.attioBlue}` : 'none', outlineOffset:-2}}>
      <Icon name="dragHandle" size={14} color={T.gray400}/>
      {icon && <Icon name={icon} size={14} color={hidden ? T.gray400 : T.gray600}/>}
      <span style={{flex:1, minWidth:0, fontSize: group ? 12.5 : 13, fontWeight: group ? 600 : 400, color: hidden ? T.gray400 : T.attioText,
                    textTransform: group ? 'uppercase' : 'none', letterSpacing: group ? .3 : 0}}>{label}</span>
      <button title={hidden ? 'Show' : 'Hide'} onClick={onToggle}
        style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:4, borderRadius:4}}>
        <Icon name={hidden ? 'eyeOff' : 'eye'} size={15} color={hidden ? T.gray400 : T.gray600}/>
      </button>
    </div>
  );
}

/* A group's items reorder among themselves only — they never leave their group. */
function NavGroupItems({group, onChange}){
  const drag = useDragReorder((from, to) => onChange({...group, items: moveItem(group.items, from, to)}));
  return group.items.map((it, i) => (
    <NavManageRow key={it.id} label={it.label} icon={it.icon} hidden={it.hidden || group.hidden} indent
      drag={{...drag.props(i), onDragStart:(e)=>{ e.stopPropagation(); drag.props(i).onDragStart(); }, onDrop:(e)=>{ e.stopPropagation(); drag.props(i).onDrop(); }}}
      dragOver={drag.over === i}
      onToggle={()=>onChange({...group, items: group.items.map(x => x.id === it.id ? {...x, hidden:!x.hidden} : x)})}/>
  ));
}

/* The entries with their items: reorder, hide / show. Edit Nav's modal and Settings → Navigation. */
function NavManagementList({draft, setDraft}){
  const drag = useDragReorder((from, to) => setDraft(d => moveItem(d, from, to)));
  const setEntry = (id, next) => setDraft(d => d.map(e => e.id === id ? next : e));
  return draft.map((e, i) => (
    <div key={e.id} style={{marginBottom: e.group ? 6 : 2}}>
      <NavManageRow label={e.label} icon={e.group ? null : e.icon} group={e.group} hidden={e.hidden}
        drag={drag.props(i)} dragOver={drag.over === i}
        onToggle={()=>setEntry(e.id, {...e, hidden:!e.hidden})}/>
      {e.group && <NavGroupItems group={e} onChange={(g)=>setEntry(e.id, g)}/>}
    </div>
  ));
}

/* Settings → Navigation: the same setup as Edit Nav (one navigation, either place changes it),
   saved with the Settings pages' Cancel / Save. */
function NavigationSettings({nav, setNav}){
  const [draft, setDraft] = React.useState(nav);
  const dirty = JSON.stringify(draft) !== JSON.stringify(nav);
  // Changed elsewhere (Edit Nav) while nothing's being edited here: show it.
  const shown = React.useRef(nav);
  React.useEffect(() => {
    if(JSON.stringify(draft) === JSON.stringify(shown.current)) setDraft(nav);
    shown.current = nav;
  }, [nav]);
  const actions = <>
    {dirty && <StSecondary label="Cancel" onClick={()=>setDraft(nav)}/>}
    <StCta label="Save" disabled={!dirty} onClick={()=>setNav(draft)}/>
  </>;
  return (
    <SettingsPage description="The CRM navigation for everyone: drag to reorder, hide what isn't needed." actions={actions}>
      <div style={{maxWidth:460}}><NavManagementList draft={draft} setDraft={setDraft}/></div>
    </SettingsPage>
  );
}

function NavManagementModal({draft, setDraft, onApply, onClose}){
  return (
    <div style={{position:'fixed', inset:0, zIndex:120, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div onClick={onClose} style={{position:'absolute', inset:0, background:'rgba(16,24,40,.35)'}}/>
      <div style={{position:'relative', width:460, maxWidth:'94vw', maxHeight:'88vh', background:'#fff', borderRadius:12,
                   boxShadow:'0 16px 40px rgba(16,24,40,.24)', display:'flex', flexDirection:'column'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:`1px solid ${T.border}`}}>
          <div>
            <div style={{fontSize:16, fontWeight:600, color:T.attioText}}>Edit navigation</div>
            <div style={{fontSize:12.5, color:T.attioMuted, marginTop:2}}>Drag to reorder. Hide what you don't need.</div>
          </div>
          <button onClick={onClose} style={{border:'none', background:'transparent', cursor:'pointer', display:'flex'}}>
            <Icon name="close" size={16} color={T.gray600}/>
          </button>
        </div>
        <div style={{flex:1, minHeight:0, overflowY:'auto', padding:'10px 12px'}}>
          <NavManagementList draft={draft} setDraft={setDraft}/>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:10, padding:'14px 20px', borderTop:`1px solid ${T.border}`}}>
          <button onClick={onApply} style={{border:'none', background:T.black, color:'#fff', borderRadius:8, padding:'9px 20px', fontSize:13, fontWeight:600, cursor:'pointer'}}>Apply</button>
          <button onClick={onClose} style={{border:`1px solid ${T.borderStrong}`, background:'#fff', color:T.attioText, borderRadius:8, padding:'9px 16px', fontSize:13, cursor:'pointer'}}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {SETTINGS_DEFAULT_PAGE, crmDefaultPage, NavigationSettings, NavManagementList, navWithObjects, CrmSettingsNav, CRM_SETTINGS_NAV, isSettingsPage, CrmSidebar, CRM_NAV_LABELS, CRM_NAV_DEFAULT});
