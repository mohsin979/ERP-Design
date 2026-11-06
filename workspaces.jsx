/* HOF Pulse ERP — Sign-in, workspaces and brand.

   Sign-in (the first screen): Continue with Google, mocked — any address on the HOF Migration
   or HOF Global domains is accepted, with no real Google account behind it. Signing in opens
   the last workspace; inside it the person is the user with that email, or joins its Users.

   Workspaces: the top-left switcher in the ERP header — the workspaces the signed-in person is a
   member of. Each workspace is a separate account environment — its own records, CRM configuration
   and CRM roles (its own saved store, store.jsx) — while people are shared: one identity each,
   with each workspace's membership and module access set on its own (ERP Settings → Users). A
   workspace can start from a template (WORKSPACE_TEMPLATES: the Accounting workspace's CRM).
   Creating a workspace (name and optional logo; it starts empty, its creator Super Admin) is kept
   but not offered for now (WORKSPACE_CREATION_ENABLED).

   ERP Settings (the ERP home's Setting tile; workspace Super Admin and Admin):
     Workspace — the open workspace's name and logo (HOF Migration keeps its own mark until a logo
                 is uploaded).
     Users     — everyone in the directory, the modules each opens in each workspace; Add user /
                 Edit access / Assign access (several people at once).

   Brand (CRM → Marketing → Brand): workspace administrators set the workspace logo, brand
   colours (used on the workspace's mark and its quotations), the company email signature and
   the digital letterhead. */

const ALLOWED_EMAIL_DOMAINS = ['hofmigration.com', 'hof-global.com'];
const emailDomain = (email) => String(email || '').trim().toLowerCase().split('@')[1] || '';
const signInAllowed = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim()) && ALLOWED_EMAIL_DOMAINS.includes(emailDomain(email));
// Administrators of the open workspace (their Permission Preset).
const WORKSPACE_ADMIN_PRESETS = ['Super Admin', 'Admin'];
const isWorkspaceAdmin = () => WORKSPACE_ADMIN_PRESETS.includes(CURRENT_USER.role);
function signOut(){ reloadInto({session:null}); }

/* The registry as React state: Brand edits and Create workspace update it, and every mark on
   screen follows. */
const WS_EVENT = 'hof-workspaces-changed';
function useWorkspaces(){
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => { window.addEventListener(WS_EVENT, force); return () => window.removeEventListener(WS_EVENT, force); }, []);
  const update = (patch) => { saveWorkspaceRegistry(patch); window.dispatchEvent(new Event(WS_EVENT)); };
  const active = WORKSPACE_REGISTRY.workspaces.find(w => w.id === WORKSPACE_REGISTRY.activeId) || ACTIVE_WORKSPACE;
  return {workspaces:WORKSPACE_REGISTRY.workspaces, active, update};
}
const updateWorkspace = (update, id, patch) => update({workspaces:WORKSPACE_REGISTRY.workspaces.map(w => w.id === id ? {...w, ...patch} : w)});

/* An image file as a data URL (logos), at most `max` bytes. */
const LOGO_MAX_BYTES = 400 * 1024;
const readImageFile = (file, max = LOGO_MAX_BYTES) => new Promise((resolve, reject) => {
  if(!file || !/^image\//.test(file.type)) return reject(new Error('Choose an image file (PNG, JPG or SVG).'));
  if(file.size > max) return reject(new Error(`Choose an image under ${Math.round(max / 1024)} KB.`));
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(new Error('That file could not be read.'));
  r.readAsDataURL(file);
});

const wsInitials = (name) => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'W';
/* A workspace's square mark: its logo, or its initials on its primary colour. */
function WorkspaceTile({ws, size = 20}){
  const box = {width:size, height:size, borderRadius:Math.round(size / 4), flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center'};
  // HOF Migration keeps its own mark until a logo is uploaded.
  if(!ws.logo && ws.id === HOF_MIGRATION_WS) return <span style={{...box, background:'#fff', border:`1px solid ${T.attioLine}`}}><Logo variant="mark" height={Math.round(size * .72)}/></span>;
  if(ws.logo) return <span style={{...box, background:'#fff', border:`1px solid ${T.attioLine}`}}><img src={ws.logo} alt="" style={{width:'100%', height:'100%', objectFit:'contain'}}/></span>;
  return <span style={{...box, background:(ws.colors || DEFAULT_BRAND()).primary, color:'#fff', fontSize:Math.round(size * .42), fontWeight:700, letterSpacing:.2}}>{wsInitials(ws.name)}</span>;
}
/* The header lockup: the workspace's tile (its logo; HOF Migration's mark; or initials) and its
   name — the name each workspace edits in ERP Settings → Workspace. */
function WorkspaceLockup({ws}){
  return (
    <span style={{display:'inline-flex', alignItems:'center', gap:8, minWidth:0}}>
      <WorkspaceTile ws={ws} size={22}/>
      <span style={{fontSize:14, fontWeight:600, color:T.attioText, whiteSpace:'nowrap'}}>{ws.name}</span>
    </span>
  );
}

/* ── Workspace switcher (ERP header, top left) ── */
function WorkspaceSwitcher(){
  const {workspaces:allWorkspaces, active, update} = useWorkspaces();
  const workspaces = switchableWorkspaces();
  const [open, setOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  return (
    <div style={{position:'relative', flexShrink:0}}>
      <div onClick={()=>setOpen(v=>!v)} title="Switch workspace" style={{display:'flex', alignItems:'center', gap:6, cursor:'pointer'}}>
        <WorkspaceLockup ws={active}/>
        <Icon name="chevDown" size={T.chevronSize} color={T.gray600} style={{transform: open ? 'rotate(180deg)' : 'none'}}/>
      </div>
      <MenuShell open={open} onClose={()=>setOpen(false)} width={260}>
        <div style={{padding:'4px 10px 6px', fontSize:11.5, color:T.gray400}}>Workspaces</div>
        {workspaces.map(w => (
          <div key={w.id} onClick={()=>{ setOpen(false); if(w.id !== active.id) reloadInto({activeId:w.id}); }}
            style={{display:'flex', alignItems:'center', gap:10, padding:'7px 10px', borderRadius:6, cursor:'pointer', background: w.id === active.id ? T.headerBg : 'transparent'}}
            onMouseEnter={e=>e.currentTarget.style.background = T.headerBg} onMouseLeave={e=>e.currentTarget.style.background = w.id === active.id ? T.headerBg : 'transparent'}>
            <WorkspaceTile ws={w} size={22}/>
            <span style={{flex:1, minWidth:0, fontSize:13, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{w.name}</span>
            {w.id === active.id && <Icon name="check" size={12} color={T.blue}/>}
          </div>
        ))}
        {WORKSPACE_CREATION_ENABLED && <>
          <div style={{height:1, background:T.border, margin:'4px 2px'}}/>
          <MenuItem icon={<Icon name="plus" size={13} color={T.gray600}/>} label="Create workspace" onClick={()=>{ setOpen(false); setCreating(true); }}/>
        </>}
      </MenuShell>
      {creating && <CreateWorkspaceModal onClose={()=>setCreating(false)} onCreate={(ws)=>{
        update({workspaces:[...allWorkspaces, ws]});
        reloadInto({activeId:ws.id});
      }}/>}
    </div>
  );
}

/* A logo field: preview, Upload / Replace and Remove. */
// `fallback`: what the preview shows without a logo (HOF Migration: its mark).
function LogoField({value, onChange, disabled, fallback}){
  const input = React.useRef(null);
  const [error, setError] = React.useState('');
  const pick = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if(!f) return;
    readImageFile(f).then(url => { setError(''); onChange(url); }).catch(err => setError(err.message));
  };
  return (
    <div style={{display:'flex', flexDirection:'column', gap:6}}>
      <div style={{display:'flex', alignItems:'center', gap:12}}>
        <div style={{width:56, height:56, borderRadius:10, border:`1px dashed ${T.borderStrong}`, background:T.headerBg, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0}}>
          {value ? <img src={value} alt="Logo" style={{width:'100%', height:'100%', objectFit:'contain', background:'#fff'}}/> : fallback || <Icon name="brand" size={20} color={T.gray400}/>}
        </div>
        {!disabled && <>
          <input ref={input} type="file" accept="image/*" onChange={pick} style={{display:'none'}}/>
          <StSecondary label={value ? 'Replace' : 'Upload logo'} onClick={()=>input.current && input.current.click()}/>
          {value && <StTextAction label="Remove" onClick={()=>onChange(null)}/>}
        </>}
      </div>
      {error && <div style={{fontSize:12, color:T.red}}>{error}</div>}
    </div>
  );
}

function CreateWorkspaceModal({onClose, onCreate}){
  const [name, setName] = React.useState('');
  const [logo, setLogo] = React.useState(null);
  const taken = WORKSPACE_REGISTRY.workspaces.some(w => w.name.trim().toLowerCase() === name.trim().toLowerCase());
  const ok = !!name.trim() && !taken;
  const create = () => {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
    onCreate({id:`ws-${slug}-${Date.now().toString(36)}`, name:name.trim(), logo, colors:DEFAULT_BRAND(), sample:false,
      createdAt:new Date().toISOString().slice(0, 10), createdBy:SESSION && SESSION.email});
  };
  return (
    <StModal title="Create workspace" primary="Create workspace" canSubmit={ok} onSubmit={create} onCancel={onClose}>
      <div>
        <label style={fieldLabel}>Workspace name</label>
        <input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. HOF Canada" style={fieldInput}/>
        {taken && <div style={{fontSize:12, color:T.red, marginTop:4}}>A workspace with this name already exists.</div>}
      </div>
      <div>
        <label style={fieldLabel}>Logo</label>
        <LogoField value={logo} onChange={setLogo}/>
      </div>
    </StModal>
  );
}

/* ── Shared people and module access ── one identity per person (the registry's `users`); each
   workspace's members and the modules each may open there (`members`). The modules are the ERP's
   tiles (MODULE_TILES, app.jsx): each can be assigned per workspace except Setting (administrators
   only); People (HRMS) is one module shared by the workspaces that have it, CRM is each
   workspace's own. A person's CRM role (seat, team, permissions) is set in that workspace's CRM
   (Users & Teams). */
const WORKSPACE_CREATION_ENABLED = false;
const visibleWorkspaces = () => WORKSPACE_REGISTRY.workspaces.filter(w => !w.hidden);
const assignableModules = () => MODULE_TILES.filter(t => t.assignable !== false);
const moduleLabel = (id) => { const t = MODULE_TILES.find(x => x.id === id); return t ? t.label : id; };
const directoryUsers = () => WORKSPACE_REGISTRY.users || [];
const sameEmail = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
const directoryUserByEmail = (email) => directoryUsers().find(u => sameEmail(u.email, email)) || null;
const workspaceMembers = (wsId) => (WORKSPACE_REGISTRY.members || {})[wsId] || null;   // null: not set up yet
const membershipOf = (wsId, userId) => (workspaceMembers(wsId) || []).find(m => m.userId === userId) || null;
const signedInUserId = () => { const u = SESSION && directoryUserByEmail(SESSION.email); return u ? u.id : null; };
// The workspaces the switcher offers: those the signed-in person belongs to (any not set up yet, too).
const switchableWorkspaces = () => { const me = signedInUserId(); return visibleWorkspaces().filter(w => !me || !workspaceMembers(w.id) || membershipOf(w.id, me)); };
// The modules the signed-in person opens in the open workspace (every one until its members are set up).
const myModules = () => {
  const list = workspaceMembers(ACTIVE_WORKSPACE.id), me = signedInUserId();
  if(!list || !me) return assignableModules().map(t => t.id);
  const m = list.find(x => x.userId === me); return m ? m.modules : [];
};
function setRegistry(patch){ saveWorkspaceRegistry(patch); window.dispatchEvent(new Event(WS_EVENT)); }
// People's modules in workspaces, all at once: [{wsId, userId, modules}] — no modules, not a member.
function setMemberships(changes, users = directoryUsers()){
  const members = {...WORKSPACE_REGISTRY.members};
  changes.forEach(({wsId, userId, modules}) => {
    const list = (members[wsId] || []).filter(m => m.userId !== userId);
    members[wsId] = modules.length ? [...list, {userId, modules}] : list;
  });
  setRegistry({users, members});
}
// A person into the directory (once) and into a workspace with these modules (added to theirs) — CRM's Add User.
function joinWorkspaceDirectory(person, modules, wsId = ACTIVE_WORKSPACE.id){
  const known = directoryUsers().find(u => u.id === person.id || sameEmail(u.email, person.email));
  const users = known ? directoryUsers() : [...directoryUsers(), {id:person.id, name:person.name, email:person.email}];
  const id = known ? known.id : person.id, cur = membershipOf(wsId, id);
  setMemberships([{wsId, userId:id, modules:[...new Set([...(cur ? cur.modules : []), ...modules])]}], users);
}
/* Opening a workspace (app.jsx): its Users join the directory; a workspace with no members yet
   takes its Users, each with every module; and the signed-in person, a member nowhere the switcher
   offers, joins it as anyone signing in always has. */
function syncWorkspacePeople(users){
  const wsId = ACTIVE_WORKSPACE.id;
  let dir = directoryUsers(), changed = false;
  const members = {...WORKSPACE_REGISTRY.members};
  users.forEach(u => { if(!dir.some(d => d.id === u.id || sameEmail(d.email, u.email))){ dir = [...dir, {id:u.id, name:u.name, email:u.email}]; changed = true; } });
  const idOf = (u) => (dir.find(d => d.id === u.id || sameEmail(d.email, u.email)) || u).id;
  const all = assignableModules().map(t => t.id);
  if(!members[wsId]){ members[wsId] = users.map(u => ({userId:idOf(u), modules:all})); changed = true; }
  const me = SESSION && dir.find(d => sameEmail(d.email, SESSION.email));
  if(me && !members[wsId].some(m => m.userId === me.id) && !visibleWorkspaces().some(w => (members[w.id] || []).some(m => m.userId === me.id))){
    members[wsId] = [...members[wsId], {userId:me.id, modules:all}]; changed = true;
  }
  if(changed) setRegistry({users:dir, members});
}
// The CRM users the open workspace still needs: members with CRM not in its Users yet — as CRM's Add User makes them (no seat, team or preset).
function crmUsersToAdd(users){
  const created = new Date().toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
  return (workspaceMembers(ACTIVE_WORKSPACE.id) || []).filter(m => m.modules.includes('crm'))
    .map(m => directoryUsers().find(d => d.id === m.userId)).filter(Boolean)
    .filter(d => !users.some(u => u.id === d.id || sameEmail(u.email, d.email)))
    .map(d => ({id:d.id, name:d.name, email:d.email, status:'Activated', teamId:null, preset:'', access:'manual', lastActive:null, created,
      permissions:normalizePermissions(DEFAULT_CONTACT_PERMISSIONS(), levelOfPreset(''))}));
}
// Where the signed-in person belongs instead of the open workspace (not a member of it), or null.
function workspaceRedirect(){
  const me = signedInUserId();
  if(!me || !workspaceMembers(ACTIVE_WORKSPACE.id) || membershipOf(ACTIVE_WORKSPACE.id, me)) return null;
  const other = switchableWorkspaces().find(w => w.id !== ACTIVE_WORKSPACE.id && membershipOf(w.id, me));
  return other ? other.id : null;
}

/* ── Workspace templates ── a workspace's CRM setup when it starts (store.jsx `template`). The
   Accounting workspace's: two record types — Leads (the Deals record type, named Leads) and
   Customers — linked Leads → Customers (one-to-many), their properties, the Lead Pipeline and the
   customers' Service pipeline, and the Customer Profile form. No sample records. */
const typedStages = (list) => list.map(([label, type]) => ({id:label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label, type}));
const LEAD_OUTCOMES = ['Have Discussion', 'Need Some Time', 'Needs Follow-up', 'Documents Collected', 'Asking for Qualification', 'Asking for a Discount',
  'Wants to Visit Office', 'Busy', 'Driving', 'Ghosting', 'Not interested'];
const templateProp = (objectId, def, label, extra = {}) => { const {onCreate = false, mandatory = false, locked = false, ...p} = def;
  return {...p, ...(label ? {label} : {}), system:true, objectId, onCreate, mandatory, locked, ...extra}; };
const WORKSPACE_TEMPLATES = {
  accounting: {
    settings: () => {
      const deal = (k) => DEAL_PROPERTY_SETUP.find(p => p.key === k), cust = (k) => CUSTOMER_PROPERTY_SETUP.find(p => p.key === k);
      const company = (objectId) => ({key:'company', label:'Company Name', type:'Single-Line Text', system:false, objectId, onCreate:true, mandatory:false, locked:false, width:200});
      return {
        objects:[{id:'deals', name:'Leads', group:'Pre-Sales'}, {id:'customers', name:'Customers', group:'Sales'}],
        associations:[{id:'as-deals-customers', a:'deals', b:'customers', type:'One-to-many'}],
        properties:[
          templateProp('deals', deal('name'), 'Lead Name'), templateProp('deals', deal('email')), company('deals'), templateProp('deals', deal('phone')),
          templateProp('deals', deal('pipeline'), 'Lead Pipeline'), templateProp('deals', deal('stage'), 'Lead Stage'), templateProp('deals', deal('owner'), 'Lead Owner'),
          {key:'outcomes', label:'Outcomes', type:'Multi-Selection', options:LEAD_OUTCOMES, system:false, objectId:'deals', onCreate:true, mandatory:false, locked:false, width:240},
          templateProp('deals', deal('amount'), 'Amount'), templateProp('deals', deal('closeDate')), templateProp('deals', deal('actualCloseDate')),
          templateProp('deals', deal('created')), templateProp('deals', deal('lastActivity')), templateProp('deals', deal('customers')), templateProp('deals', deal('currency')),
          templateProp('customers', cust('name')), templateProp('customers', cust('email')), company('customers'), templateProp('customers', cust('phone')),
          templateProp('customers', cust('pipeline')), templateProp('customers', cust('stage')), templateProp('customers', cust('owner')),
          templateProp('customers', cust('customerSince')), templateProp('customers', cust('created')), templateProp('customers', cust('lastActivity')),
          templateProp('customers', cust('nextActivity')), templateProp('customers', cust('deals'), 'Associated Lead'),
        ],
        pipelines:[
          {id:'lead-pipeline', label:'Lead Pipeline', objectId:'deals', source:'record',
            stages:typedStages([['Qualified', 'open'], ['Contacted', 'open'], ['Expected Sales', 'open'], ['Won', 'won'], ['Postponed', 'undecided'], ['Lost', 'lost']])},
          {id:'service', label:'Service', objectId:'customers', source:'record', stages:typedStages([['In Service', 'open'], ['Needs Attention', 'open'], ['Close', 'undecided']])},
        ],
        propertySet:PROPERTY_SET_VERSION, noFormProperties:true,
      };
    },
    // Customer Profile: the customer's business; each location only for its Business Location Type.
    profileForms: () => [{id:'pf-acc-customer-profile', name:'Customer Profile', createdBy:'System', createdAt:'2026-11-06T09:00:00.000Z',
      description:'The customer’s business: its revenue and where it’s licensed.', fields:[
        pfField('acc-total-revenue', 'Total Revenue', 'Currency'),
        pfField('acc-location-type', 'Business Location Type', 'Single Selection', {options:['Mainland', 'Free Zone']}),
        pfField('acc-mainland-location', 'Mainland Location', 'Single-Line Text', {showIf:{fieldId:'acc-location-type', values:['Mainland']}}),
        pfField('acc-freezone-location', 'Free Zone Location', 'Single-Line Text', {showIf:{fieldId:'acc-location-type', values:['Free Zone']}}),
      ]}],
  },
};
const workspaceTemplate = () => (WORKSPACE_TEMPLATE && WORKSPACE_TEMPLATES[WORKSPACE_TEMPLATE]) || null;

/* ── ERP Settings ── the ERP home's Setting tile, for the open workspace's Super Admin and Admin:
   the CRM settings' look — a Settings menu on the left (back arrow to the ERP home), the page on
   the right. */
const ERP_SETTINGS_NAV = {id:'erp.settings', label:'ERP Settings', group:true, items:[
  {id:'erp.workspace', label:'Workspace', icon:'brand'}, {id:'erp.users', label:'Users', icon:'usersThree'}]};
function ErpSettingsScreen({onBack, data, setData}){
  const [page, setPage] = React.useState('erp.workspace');
  return (
    <div style={{flex:1, minHeight:0, display:'flex', background:'#fff', borderTop:`1px solid ${T.border}`}}>
      <div style={{width:200, background:'#fff', borderRight:`1px solid ${T.border}`, display:'flex', flexDirection:'column', flexShrink:0, padding:'16px 12px'}}>
        <div onClick={onBack} title="Back to the ERP home" style={{display:'flex', alignItems:'center', gap:8, marginBottom:16, padding:'0 2px', minHeight:18, cursor:'pointer', alignSelf:'flex-start'}}>
          <Icon name="arrowLeft" size={14} color={T.gray600}/>
          <span style={{fontSize:13, fontWeight:600, color:T.attioText}}>Settings</span>
        </div>
        <CrmNavGroup group={ERP_SETTINGS_NAV} active={page} setActive={setPage} first/>
      </div>
      <div style={{flex:1, minWidth:0, minHeight:0, display:'flex', flexDirection:'column', position:'relative'}}>
        {page === 'erp.workspace' ? <WorkspaceSettingsPage/> : <ErpUsersPage data={data} setData={setData}/>}
      </div>
    </div>
  );
}

// Workspace: the open workspace's name and logo.
function WorkspaceSettingsPage(){
  const {active, update} = useWorkspaces();
  const [name, setName] = React.useState(active.name);
  const [logo, setLogo] = React.useState(active.logo || null);
  const [saved, setSaved] = React.useState(false);
  const taken = WORKSPACE_REGISTRY.workspaces.some(w => w.id !== active.id && w.name.trim().toLowerCase() === name.trim().toLowerCase());
  const dirty = name.trim() !== active.name || (logo || null) !== (active.logo || null);
  const ok = !!name.trim() && !taken;
  const save = () => { if(!ok) return; updateWorkspace(update, active.id, {name:name.trim(), logo}); setSaved(true); };
  React.useEffect(() => { if(dirty) setSaved(false); }, [dirty]);
  return (
    <SettingsPage title="Workspace" description="The open workspace’s name and logo, as the workspace switcher and the header show them."
      actions={dirty ? <><StSecondary label="Cancel" onClick={()=>{ setName(active.name); setLogo(active.logo || null); }}/><StCta label="Save changes" disabled={!ok} onClick={save}/></>
        : saved ? <span style={{fontSize:12.5, color:T.attioMuted}}>Saved</span> : null}>
      <div style={{maxWidth:560, display:'flex', flexDirection:'column', gap:20}}>
        <div>
          <label style={fieldLabel} htmlFor="ws-name">Workspace name</label>
          <input id="ws-name" value={name} onChange={e=>setName(e.target.value)} style={{...fieldInput, borderColor: taken ? T.red : undefined}}/>
          {taken && <div style={{fontSize:12, color:T.red, marginTop:4}}>A workspace with this name already exists.</div>}
        </div>
        <div>
          <label style={fieldLabel}>Logo</label>
          <LogoField value={logo} onChange={setLogo} fallback={active.id === HOF_MIGRATION_WS ? <Logo variant="mark" height={34}/> : <WorkspaceTile ws={{...active, name:name || active.name}} size={40}/>}/>
        </div>
      </div>
    </SettingsPage>
  );
}

/* Users: everyone in the directory with the modules they open in each workspace ("—": not a
   member). Select people for Assign access, or a row's Edit access; Add user for someone new. A
   person given CRM in the open workspace joins its CRM Users at once (other workspaces: when
   they're next opened), with no seat, team or preset — set in that CRM's Users & Teams. */
function ErpUsersPage({data, setData}){
  useWorkspaces();   // follows directory and membership changes
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState([]);
  const [panel, setPanel] = React.useState(null);   // {userIds} — [] adds someone new
  const wss = visibleWorkspaces();
  const q = query.trim().toLowerCase();
  const users = directoryUsers().filter(u => !q || u.name.toLowerCase().includes(q) || String(u.email).toLowerCase().includes(q))
    .slice().sort((a, b) => a.name.localeCompare(b.name));
  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const allOn = users.length > 0 && users.every(u => selected.includes(u.id));
  const cols = `36px minmax(260px, 1.2fr) ${wss.map(() => 'minmax(240px, 1fr)').join(' ')} 120px`;
  const head = {fontSize:12, fontWeight:500, color:T.attioMuted, padding:'0 12px', display:'flex', alignItems:'center', height:36, whiteSpace:'nowrap'};
  const cell = {fontSize:13, color:T.attioText, padding:'0 12px', display:'flex', alignItems:'center', minHeight:48, minWidth:0};
  const saved = (crmUsers) => { if(crmUsers.length) setData(d => ({...d, users:[...d.users, ...crmUsers.filter(u => !d.users.some(x => x.id === u.id))]})); setPanel(null); setSelected([]); };
  return (
    <SettingsPage fill title="Users" description="People are shared across workspaces; choose which modules each can open in each workspace."
      actions={<>
        {selected.length > 0 && <StSecondary label={`Assign access (${selected.length})`} onClick={()=>setPanel({userIds:selected})}/>}
        <StCta label="Add user" onClick={()=>setPanel({userIds:[]})}/>
      </>}>
      <div style={{position:'relative', width:280, marginBottom:12}}>
        <div style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', display:'flex'}}><Icon name="search" size={13} color={T.gray400}/></div>
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search users" aria-label="Search users" style={{...fieldInput, paddingLeft:30}}/>
      </div>
      <div style={{flex:1, minHeight:0, overflow:'auto', border:`1px solid ${T.attioLine}`, borderRadius:8}}>
        {/* Wide enough for every workspace column; module chips wrap inside theirs. */}
        <div style={{minWidth:36 + 260 + wss.length * 240 + 120}}>
          <div style={{display:'grid', gridTemplateColumns:cols, background:T.headerBg, borderBottom:`1px solid ${T.attioLine}`, position:'sticky', top:0, zIndex:1}}>
            <span style={{...head, justifyContent:'center'}}><RowCheckbox checked={allOn} onChange={()=>setSelected(allOn ? [] : users.map(u => u.id))}/></span>
            <span style={head}>User</span>
            {wss.map(w => <span key={w.id} style={{...head, gap:8}}><WorkspaceTile ws={w} size={16}/>{w.name}</span>)}
            <span style={head}/>
          </div>
          {users.map(u => (
            <div key={u.id} style={{display:'grid', gridTemplateColumns:cols, borderBottom:`1px solid ${T.attioLine}`, background: selected.includes(u.id) ? T.blueLight : '#fff'}}>
              <span style={{...cell, justifyContent:'center'}}><RowCheckbox checked={selected.includes(u.id)} onChange={()=>toggle(u.id)}/></span>
              <span style={{...cell, gap:10}}>
                <Avatar name={u.name} size={26}/>
                <span style={{minWidth:0, display:'flex', flexDirection:'column'}}>
                  <span style={{fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{u.name}</span>
                  <span style={{fontSize:12, color:T.attioMuted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{u.email}</span>
                </span>
              </span>
              {wss.map(w => { const m = membershipOf(w.id, u.id);
                return <span key={w.id} style={{...cell, flexWrap:'wrap', gap:4, padding:'8px 12px'}}>
                  {m ? m.modules.map(id => <span key={id} style={{fontSize:11.5, padding:'1px 8px', borderRadius:9999, background:T.headerBg, color:T.gray800, whiteSpace:'nowrap'}}>{moduleLabel(id)}</span>)
                    : <span style={{color:T.attioFaint}}>—</span>}
                </span>; })}
              <span style={{...cell, justifyContent:'flex-end'}}><StTextAction label="Edit access" onClick={()=>setPanel({userIds:[u.id]})}/></span>
            </div>
          ))}
          {!users.length && <div style={{padding:'24px 16px', fontSize:13, color:T.attioMuted}}>No users match “{query.trim()}”.</div>}
        </div>
      </div>
      {panel && <UserAccessPanel userIds={panel.userIds} onClose={()=>setPanel(null)} onSaved={saved} crmUsers={data.users}/>}
    </SettingsPage>
  );
}

/* Add user / Edit access / Assign access — the creation side panel: the people (someone new —
   name and email on the sign-in domains — or those chosen), then per workspace the modules they
   open there (none: not a member). For several people it starts from what they all have, and
   saving gives each exactly what's ticked. */
function UserAccessPanel({userIds, onClose, onSaved, crmUsers}){
  const isNew = !userIds.length;
  const wss = visibleWorkspaces(), mods = assignableModules();
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [access, setAccess] = React.useState(() => Object.fromEntries(wss.map(w => {
    const sets = userIds.map(id => (membershipOf(w.id, id) || {modules:[]}).modules);
    return [w.id, isNew ? [] : mods.map(t => t.id).filter(id => sets.every(s => s.includes(id)))];
  })));
  const people = userIds.map(id => directoryUsers().find(u => u.id === id)).filter(Boolean);
  const emailTaken = isNew && !!directoryUserByEmail(email);
  const ok = isNew ? !!name.trim() && signInAllowed(email) && !emailTaken : people.length > 0;
  const flip = (wsId, mod) => setAccess(a => ({...a, [wsId]:a[wsId].includes(mod) ? a[wsId].filter(x => x !== mod) : [...a[wsId], mod]}));
  const save = () => {
    if(!ok) return;
    let dir = directoryUsers(), targets = people;
    if(isNew){
      const base = name.trim().toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '') || 'user';
      const person = {id: dir.some(u => u.id === base) ? `${base}-${Date.now().toString(36)}` : base, name:name.trim(), email:email.trim().toLowerCase()};
      dir = [...dir, person]; targets = [person];
    }
    setMemberships(targets.flatMap(p => wss.map(w => ({wsId:w.id, userId:p.id, modules:mods.map(t => t.id).filter(id => access[w.id].includes(id))}))), dir);
    // CRM in the open workspace: into its CRM Users now (no seat, team or preset).
    onSaved(access[ACTIVE_WORKSPACE.id].includes('crm') ? crmUsersToAdd(crmUsers) : []);
  };
  const title = isNew ? 'Add user' : people.length === 1 ? 'Edit access' : `Assign access · ${people.length} users`;
  return (
    <CreatePanelFrame title={title} onClose={onClose} more={false} placement="fixed" width={520} actions={<>
      <StSecondary label="Cancel" onClick={onClose}/>
      <StCta label={isNew ? 'Add user' : 'Save changes'} disabled={!ok} onClick={save}/>
    </>}>
      {stack(<>
        {isNew ? <>
          <Field label="Name"><input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" style={fieldText}/></Field>
          <Field label="Email"><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@hof-global.com" style={{...fieldText, borderColor: emailTaken ? T.red : undefined}}/>
            {emailTaken && <div style={{fontSize:12, color:T.red, marginTop:4}}>This person is already a user.</div>}
            {email.trim() && !emailTaken && !signInAllowed(email) && <div style={{fontSize:12, color:T.red, marginTop:4}}>Use a hofmigration.com or hof-global.com address.</div>}
          </Field>
        </> : (
          <Field label={people.length === 1 ? 'User' : 'Users'}>
            <div style={{display:'flex', flexWrap:'wrap', gap:6, paddingTop:4}}>
              {people.map(p => <span key={p.id} style={{display:'inline-flex', alignItems:'center', gap:6, fontSize:12.5, padding:'3px 10px 3px 4px', borderRadius:9999, background:T.headerBg, color:T.attioText}}>
                <Avatar name={p.name} size={20}/>{p.name}</span>)}
            </div>
            {people.length > 1 && <div style={{fontSize:12, color:T.attioMuted, marginTop:6}}>Each of them gets exactly the modules ticked below.</div>}
          </Field>
        )}
      </>)}
      <div style={{borderTop:`1px solid ${T.border}`, margin:'18px -20px 14px'}}/>
      <div style={{display:'flex', flexDirection:'column', gap:18}}>
        {wss.map(w => (
          <div key={w.id} style={{display:'flex', flexDirection:'column', gap:8}}>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <WorkspaceTile ws={w} size={18}/>
              <span style={{fontSize:13, fontWeight:600, color:T.attioText, flex:1}}>{w.name}</span>
              <span style={{fontSize:12, color:T.attioMuted}}>{access[w.id].length ? 'Member' : 'Not a member'}</span>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:'4px 16px', paddingLeft:26}}>
              {mods.map(t => (
                <label key={t.id} style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:T.attioText, cursor:'pointer', padding:'4px 0'}}>
                  <RowCheckbox checked={access[w.id].includes(t.id)} onChange={()=>flip(w.id, t.id)}/>
                  {t.label}{t.shared && <span style={{fontSize:11.5, color:T.attioMuted}}>· {t.note || 'Shared'}</span>}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </CreatePanelFrame>
  );
}

/* ── Sign-in ── the first screen, on the workflow canvas's dotted ground. */
const GOOGLE_COLORS = ['#4285F4', '#EA4335', '#FBBC05', '#34A853'];
function LoginScreen(){
  const [step, setStep] = React.useState('start');   // start | google
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState('');
  const known = (WORKSPACE_REGISTRY.accounts || []).filter(signInAllowed);
  const signIn = (address) => {
    const a = String(address || '').trim().toLowerCase();
    if(!signInAllowed(a)){ setError('Use your hofmigration.com or hof-global.com account.'); return; }
    reloadInto({session:{email:a, signedInAt:Date.now()}, accounts:[a, ...known.filter(x => x !== a)].slice(0, 5)});
  };
  const card = {width:380, maxWidth:'100%', background:'#fff', border:`1px solid ${T.border}`, borderRadius:14, boxShadow:'0 12px 32px rgba(16,24,40,.08)',
    padding:'32px 28px', display:'flex', flexDirection:'column', gap:20};
  const googleBtn = {display:'flex', alignItems:'center', justifyContent:'center', gap:10, height:42, borderRadius:10, border:`1px solid ${T.borderStrong}`,
    background:'#fff', fontSize:14, fontWeight:500, color:T.attioText, cursor:'pointer', fontFamily:'inherit', width:'100%'};
  return (
    <div style={{...WORKFLOW_CANVAS, minHeight:'100%', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px 16px', boxSizing:'border-box'}}>
      <div style={card}>
        <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:14}}>
          <img src="assets/brand/pulse-logo.svg" alt="Pulse" height={28} style={{display:'block', height:28}}/>
          <div style={{fontSize:18, fontWeight:600, color:T.attioText}}>{step === 'start' ? 'Sign in to Pulse' : 'Sign in with Google'}</div>
        </div>
        {step === 'start' ? (
          <button onClick={()=>{ setStep('google'); setError(''); }} style={googleBtn}>
            <Icon name="googleLogo" size={16} color={GOOGLE_COLORS[0]}/> Continue with Google
          </button>
        ) : (
          <div style={{display:'flex', flexDirection:'column', gap:12}}>
            {known.map(a => (
              <button key={a} onClick={()=>signIn(a)} style={{...googleBtn, justifyContent:'flex-start', padding:'0 12px', fontWeight:400}}>
                <span style={{width:24, height:24, borderRadius:9999, background:T.attioText, color:'#fff', fontSize:11, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center'}}>{a[0].toUpperCase()}</span>
                <span style={{minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{a}</span>
              </button>
            ))}
            <form onSubmit={e=>{ e.preventDefault(); signIn(email); }} style={{display:'flex', flexDirection:'column', gap:10}}>
              <input id="login-email" autoFocus type="email" value={email} onChange={e=>{ setEmail(e.target.value); setError(''); }} placeholder="Email" aria-label="Email"
                style={{...fieldInput, height:42, borderColor: error ? T.red : T.borderStrong}}/>
              {error && <div style={{fontSize:12.5, color:T.red}}>{error}</div>}
              <button type="submit" disabled={!email.trim()} style={{height:42, borderRadius:10, border:'none', background: email.trim() ? T.black : T.gray400, color:'#fff',
                fontSize:14, fontWeight:500, cursor: email.trim() ? 'pointer' : 'default', fontFamily:'inherit'}}>Next</button>
            </form>
            <button onClick={()=>{ setStep('start'); setError(''); }} style={{alignSelf:'center', border:'none', background:'transparent', fontSize:13, color:T.gray600, cursor:'pointer', fontFamily:'inherit'}}>Back</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Brand (CRM → Marketing → Brand) ── four sections, switched with the Settings tabs (as in
   Users & Teams): Logo, Color System, Email Signature, Digital Letterhead. Each is saved on the
   workspace; administrators edit, everyone else sees them. */
const BRAND_SECTIONS = [
  // Color System (BrandColorsSection) is hidden for now; its saved colours still apply.
  {id:'logo', label:'Logo', icon:'profile'},
  {id:'signature', label:'Email Signature', icon:'envelope'}, {id:'letterhead', label:'Digital Letterhead', icon:'files'},
];
const BRAND_COLOR_FIELDS = [{key:'primary', label:'Primary color'}, {key:'secondary', label:'Secondary color'}];
const validHex = (v) => /^#[0-9a-f]{6}$/i.test(v);
const brandRow = (label, content) => (
  <div key={label} style={{display:'flex', alignItems:'flex-start', gap:24, padding:'16px 0', borderBottom:`1px solid ${T.attioLine}`}}>
    <div style={{width:180, flexShrink:0, fontSize:13, color:T.attioText, paddingTop:6}}>{label}</div>
    <div style={{flex:1, minWidth:0}}>{content}</div>
  </div>
);
// A section's Cancel / Save (administrators), enabled once something changed.
const BrandActions = ({admin, dirty, valid = true, onCancel, onSave}) => !admin ? null : (
  <><StSecondary label="Cancel" disabled={!dirty} onClick={onCancel}/><StCta label="Save" disabled={!dirty || !valid} onClick={onSave}/></>
);

/* Logo: the uploaded logo, or HOF Migration's own lockup until one is uploaded; Upload /
   Replace and Remove (back to the lockup). */
function BrandLogoSection({active, update, admin, toast, setActions}){
  const saved = active.logo || null;
  const [draft, setDraft] = React.useState(saved);
  const [error, setError] = React.useState('');
  const input = React.useRef(null);
  const dirty = draft !== saved;
  const pick = (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if(!f) return;
    readImageFile(f).then(url => { setError(''); setDraft(url); }).catch(err => setError(err.message)); };
  React.useEffect(() => setActions(<BrandActions admin={admin} dirty={dirty} onCancel={()=>setDraft(saved)}
    onSave={()=>{ updateWorkspace(update, active.id, {logo:draft}); toast('Logo saved'); }}/>), [draft, saved, admin]);
  return brandRow('Company logo', (
    <div style={{display:'flex', flexDirection:'column', gap:10}}>
      <div style={{width:260, height:104, borderRadius:10, border:`1px dashed ${T.borderStrong}`, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', padding:12}}>
        {draft ? <img src={draft} alt="Company logo" style={{maxWidth:'100%', maxHeight:'100%', objectFit:'contain'}}/>
          : active.id === HOF_MIGRATION_WS ? <Logo variant="main" height={30}/>
          : <Icon name="brand" size={22} color={T.gray400}/>}
      </div>
      {admin && <div style={{display:'flex', alignItems:'center', gap:10}}>
        <input ref={input} type="file" accept="image/*" onChange={pick} style={{display:'none'}}/>
        <StSecondary label={draft || active.id === HOF_MIGRATION_WS ? 'Replace' : 'Upload logo'} onClick={()=>input.current && input.current.click()}/>
        {draft && <StTextAction label="Remove" onClick={()=>setDraft(null)}/>}
      </div>}
      {error && <div style={{fontSize:12, color:T.red}}>{error}</div>}
    </div>
  ));
}

/* Color System: any number of named brand colours — Add Color, rename, recolour, delete. The
   first two also stand in for the primary and secondary colours the rest of the ERP reads
   (the workspace mark, quotations), so those keep working. */
const brandPalette = (ws) => Array.isArray(ws.palette) ? ws.palette : (() => {
  const c = {...DEFAULT_BRAND(), ...(ws.colors || {})};
  return [{id:'bc-primary', name:'Primary', value:c.primary}, {id:'bc-secondary', name:'Secondary', value:c.secondary}];
})();
const colorsFromPalette = (palette) => {
  const d = DEFAULT_BRAND(), ok = palette.filter(c => validHex(c.value));
  return {primary: ok[0] ? ok[0].value : d.primary, secondary: (ok[1] || ok[0] || {}).value || d.secondary};
};
function BrandColorsSection({active, update, admin, toast, setActions}){
  const saved = brandPalette(active);
  const [draft, setDraft] = React.useState(saved);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const valid = draft.every(c => c.name.trim() && validHex(c.value));
  const set = (id, p) => setDraft(list => list.map(c => c.id === id ? {...c, ...p} : c));
  const add = () => setDraft(list => [...list, {id:`bc-${Date.now().toString(36)}`, name:'', value:'#000000'}]);
  React.useEffect(() => setActions(<BrandActions admin={admin} dirty={dirty} valid={valid} onCancel={()=>setDraft(saved)}
    onSave={()=>{ const palette = draft.map(c => ({...c, name:c.name.trim()})); updateWorkspace(update, active.id, {palette, colors:colorsFromPalette(palette)}); toast('Colors saved'); }}/>),
    [JSON.stringify(draft), JSON.stringify(saved), admin]);
  const mono = {fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace'};
  return (
    <div style={{display:'flex', flexDirection:'column'}}>
      {draft.map((c, i) => (
        <div key={c.id} style={{display:'flex', alignItems:'center', gap:10, padding:'12px 0', borderBottom:`1px solid ${T.attioLine}`}}>
          <input type="color" aria-label={`${c.name || `Color ${i + 1}`} value`} value={validHex(c.value) ? c.value : '#000000'} disabled={!admin}
            onChange={e=>set(c.id, {value:e.target.value.toUpperCase()})}
            style={{width:36, height:32, padding:2, border:`1px solid ${T.borderStrong}`, borderRadius:8, background:'#fff', cursor: admin ? 'pointer' : 'default', flexShrink:0}}/>
          <input value={c.name} disabled={!admin} onChange={e=>set(c.id, {name:e.target.value})} placeholder="Color name" aria-label={`Color ${i + 1} name`}
            style={{...fieldInput, width:220, borderColor: c.name.trim() ? T.borderStrong : T.red}}/>
          <input value={c.value} disabled={!admin} onChange={e=>set(c.id, {value:e.target.value.trim()})} aria-label={`Color ${i + 1} hex`}
            style={{...fieldInput, ...mono, width:120, borderColor: validHex(c.value) ? T.borderStrong : T.red}}/>
          {i < 2 && <span style={{fontSize:12, color:T.attioMuted}}>{i === 0 ? 'Used as primary' : 'Used as secondary'}</span>}
          <span style={{flex:1}}/>
          {admin && <button type="button" title="Delete color" onClick={()=>setDraft(list => list.filter(x => x.id !== c.id))}
            style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:6, borderRadius:6}}><Icon name="trash" size={14} color={T.gray600}/></button>}
        </div>
      ))}
      {!draft.length && <div style={{padding:'16px 0', fontSize:13, color:T.attioMuted}}>No brand colors yet.</div>}
      {admin && <div style={{paddingTop:14}}><StSecondary label={<span style={{display:'inline-flex', alignItems:'center', gap:6}}><Icon name="plus" size={12} color={T.gray800}/>Add Color</span>} onClick={add}/></div>}
    </div>
  );
}

/* The company logo, as set in Logo: the uploaded one, HOF Migration's lockup, or the initials. */
function BrandLogoMark({ws, height = 28}){
  if(ws.logo) return <img src={ws.logo} alt="" style={{display:'block', height, maxWidth:height * 5, objectFit:'contain'}}/>;
  if(ws.id === HOF_MIGRATION_WS) return <Logo variant="main" height={height * .7}/>;
  return <WorkspaceTile ws={ws} size={height}/>;
}
/* Email Signature and Digital Letterhead share the call interface's split: the form on the
   left, a second pane on the right (here, the live preview) behind a divider. */
function BrandSplit({form, preview}){
  return (
    <div style={{display:'flex', minHeight:520, marginTop:16, border:`1px solid ${T.border}`, borderRadius:12, overflow:'hidden', background:'#fff'}}>
      <div style={{flex:'0 0 440px', minWidth:0, padding:20, display:'flex', flexDirection:'column', gap:10}}>{form}</div>
      <div style={{flex:1, minWidth:0, borderLeft:`1px solid ${T.border}`, background:T.headerBg, padding:20, display:'flex', flexDirection:'column', gap:12}}>
        <span style={{fontSize:11, fontWeight:600, color:T.attioFaint, textTransform:'uppercase', letterSpacing:.4}}>Preview</span>
        {preview}
      </div>
    </div>
  );
}
const brandTextField = (value, onChange, placeholder, opts = {}) => opts.multiline
  ? <textarea value={value} onChange={e=>onChange(e.target.value)} rows={3} disabled={opts.disabled} placeholder={placeholder} style={{...fieldText, resize:'vertical', lineHeight:1.5}}/>
  : <input value={value} onChange={e=>onChange(e.target.value)} disabled={opts.disabled} placeholder={placeholder}
      style={{...fieldText, borderColor: opts.invalid ? T.red : undefined}}/>;
const brandEmailOk = (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
// A section's saved configuration vs. its draft, with Cancel / Save in the tab row.
function useBrandDraft({active, update, admin, toast, setActions, key, blank, label, valid = () => true}){
  const saved = {...blank, ...(active[key] && !active[key].dataUrl ? active[key] : {})};
  const [draft, setDraft] = React.useState(saved);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  React.useEffect(() => setActions(<BrandActions admin={admin} dirty={dirty} valid={valid(draft)} onCancel={()=>setDraft(saved)}
    onSave={()=>{ updateWorkspace(update, active.id, {[key]:Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]))}); toast(`${label} saved`); }}/>),
    [JSON.stringify(draft), JSON.stringify(saved), admin]);
  return [draft, (k, v) => setDraft(d => ({...d, [k]:v}))];
}

/* Email Signature: the company's reusable signature — the form, and the signature as it will
   read at the end of an email. The logo is the company logo (Logo), shown or not. */
const SIGNATURE_FIELDS = [
  {key:'name', label:'Name', placeholder:'e.g. Asim Ali'}, {key:'designation', label:'Designation', placeholder:'e.g. Senior Migration Consultant'},
  {key:'email', label:'Email', placeholder:'name@hofmigration.com'}, {key:'phone', label:'Phone', placeholder:'+971 4 000 0000'},
  {key:'website', label:'Website', placeholder:'https://hofmigration.com'}, {key:'address', label:'Company address', multiline:true},
];
const SIGNATURE_BLANK = {includeLogo:true, name:'', designation:'', email:'', phone:'', website:'', address:''};
function EmailSignatureBlock({sig, ws}){
  const line = {fontSize:13, color:T.attioText, lineHeight:1.5};
  const contact = [sig.email, sig.phone, sig.website].filter(Boolean);
  const logo = sig.includeLogo;
  return (
    <div style={{display:'flex', gap:16, alignItems:'center'}}>
      {logo && <div style={{flexShrink:0}}><BrandLogoMark ws={ws} height={40}/></div>}
      <div style={{minWidth:0, paddingLeft: logo ? 16 : 0, borderLeft: logo ? `2px solid ${T.attioLine}` : 'none'}}>
        <div style={{...line, fontWeight:600, color: sig.name ? T.attioText : T.attioFaint}}>{sig.name || 'Name'}</div>
        {sig.designation && <div style={{...line, color:T.attioMuted}}>{sig.designation}</div>}
        {contact.length > 0 && <div style={{...line, marginTop:6}}>{contact.join('  ·  ')}</div>}
        {sig.address && <div style={{...line, color:T.attioMuted, whiteSpace:'pre-line'}}>{sig.address}</div>}
      </div>
    </div>
  );
}
function BrandSignatureSection(props){
  const {active, admin} = props;
  const [sig, set] = useBrandDraft({...props, key:'signature', blank:SIGNATURE_BLANK, label:'Email signature', valid:(d) => !!d.name.trim() && brandEmailOk(d.email)});
  return (
    <BrandSplit
      form={<>
        <Field label="Logo">
          <label style={{display:'flex', alignItems:'center', gap:8, paddingTop:7, fontSize:13, color:T.attioText, cursor: admin ? 'pointer' : 'default'}}>
            <UtToggle on={sig.includeLogo} onChange={(v)=>admin && set('includeLogo', v)}/> Show the company logo
          </label>
        </Field>
        {SIGNATURE_FIELDS.map(f => (
          <Field key={f.key} label={f.label}>{brandTextField(sig[f.key], (v)=>set(f.key, v), f.placeholder, {multiline:f.multiline, disabled:!admin, invalid: f.key === 'email' && !brandEmailOk(sig.email)})}</Field>
        ))}
      </>}
      preview={
        <div style={{background:'#fff', border:`1px solid ${T.attioLine}`, borderRadius:10, padding:'18px 20px', maxWidth:560}}>
          <div style={{fontSize:13, color:T.attioMuted, lineHeight:1.6, marginBottom:16}}>Kind regards,</div>
          <EmailSignatureBlock sig={sig} ws={active}/>
        </div>
      }/>
  );
}

/* Digital Letterhead: the company information on the letterhead, with the company logo (Logo);
   the preview is a page with that header and footer. */
const LETTERHEAD_FIELDS = [
  {key:'companyName', label:'Company name', placeholder:'e.g. HOF Migration'}, {key:'address', label:'Address', multiline:true},
  {key:'phone', label:'Phone', placeholder:'+971 4 000 0000'}, {key:'email', label:'Email', placeholder:'info@hofmigration.com'},
  {key:'website', label:'Website', placeholder:'https://hofmigration.com'}, {key:'footer', label:'Footer note', placeholder:'e.g. Licensed immigration consultants'},
];
function BrandLetterheadSection(props){
  const {active, admin} = props;
  const [lh, set] = useBrandDraft({...props, key:'letterhead', blank:{companyName:active.name, address:'', phone:'', email:'', website:'', footer:''}, label:'Letterhead',
    valid:(d) => !!d.companyName.trim() && brandEmailOk(d.email)});
  const accent = colorsFromPalette(brandPalette(active)).primary;
  const small = {fontSize:10.5, color:T.gray600, lineHeight:1.5};
  const contact = [lh.phone, lh.email, lh.website].filter(Boolean);
  return (
    <BrandSplit
      form={LETTERHEAD_FIELDS.map(f => (
        <Field key={f.key} label={f.label}>{brandTextField(lh[f.key], (v)=>set(f.key, v), f.placeholder, {multiline:f.multiline, disabled:!admin, invalid: f.key === 'email' && !brandEmailOk(lh.email)})}</Field>
      ))}
      preview={
        <div style={{background:'#fff', border:`1px solid ${T.attioLine}`, borderRadius:4, width:'100%', maxWidth:460, aspectRatio:'1 / 1.414', alignSelf:'center',
          boxShadow:'0 4px 16px rgba(16,24,40,.08)', display:'flex', flexDirection:'column', padding:'26px 28px'}}>
          <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16}}>
            <BrandLogoMark ws={active} height={32}/>
            <div style={{textAlign:'right', minWidth:0}}>
              <div style={{fontSize:12, fontWeight:600, color:T.attioText}}>{lh.companyName || 'Company name'}</div>
              {lh.address && <div style={{...small, whiteSpace:'pre-line'}}>{lh.address}</div>}
              {contact.map(x => <div key={x} style={small}>{x}</div>)}
            </div>
          </div>
          <div style={{height:2, background:accent, margin:'16px 0 18px'}}/>
          {/* The letter's body goes here. */}
          <div style={{flex:1, display:'flex', flexDirection:'column', gap:7}}>
            {[92, 100, 96, 70, 0, 100, 88, 94, 60].map((w, i) => <div key={i} style={{height:5, width:`${w}%`, borderRadius:3, background: w ? '#EEEEF0' : 'transparent'}}/>)}
          </div>
          <div style={{borderTop:`1px solid ${T.attioLine}`, paddingTop:8, ...small, textAlign:'center'}}>
            {lh.footer || [lh.companyName, lh.website].filter(Boolean).join(' · ')}
          </div>
        </div>
      }/>
  );
}

function BrandPage(){
  const {active, update} = useWorkspaces();
  const admin = isWorkspaceAdmin();
  const [section, setSection] = React.useState('logo');
  const [actions, setActions] = React.useState(null);
  const [message, setMessage] = React.useState(null);
  const toast = (m) => { setMessage(m); setTimeout(()=>setMessage(null), 1800); };
  const Section = {logo:BrandLogoSection, colors:BrandColorsSection, signature:BrandSignatureSection, letterhead:BrandLetterheadSection}[section];
  return (
    <SettingsPage>
      <div style={{display:'flex', alignItems:'flex-end', gap:8, borderBottom:`1px solid ${T.borderStrong}`}}>
        {BRAND_SECTIONS.map(t => <UtTab key={t.id} icon={t.icon} label={t.label} active={section === t.id} onClick={()=>{ setActions(null); setSection(t.id); }}/>)}
        <div style={{flex:1}}/>
        {actions && <div style={{display:'flex', alignItems:'center', gap:8, paddingBottom:8}}>{actions}</div>}
      </div>
      <div style={{maxWidth: section === 'signature' || section === 'letterhead' ? 'none' : 820, marginTop:4}}>
        <Section key={`${section}-${active.id}`} active={active} update={update} admin={admin} toast={toast} setActions={setActions}/>
        {!admin && <div style={{...stTextB, marginTop:12}}>Only workspace administrators can change the brand.</div>}
      </div>
      <CopyToast message={message}/>
    </SettingsPage>
  );
}

// The open workspace's brand (quotations, documents).
const workspaceBrand = () => { const w = WORKSPACE_REGISTRY.workspaces.find(x => x.id === WORKSPACE_REGISTRY.activeId) || ACTIVE_WORKSPACE; return {...w, colors:{...DEFAULT_BRAND(), ...(w.colors || {})}}; };

Object.assign(window, {WORKSPACE_CREATION_ENABLED, visibleWorkspaces, assignableModules, directoryUsers, workspaceMembers, membershipOf, signedInUserId, switchableWorkspaces,
  myModules, setMemberships, joinWorkspaceDirectory, syncWorkspacePeople, crmUsersToAdd, workspaceRedirect, WORKSPACE_TEMPLATES, workspaceTemplate, LEAD_OUTCOMES,
  ErpSettingsScreen, WorkspaceSettingsPage, ErpUsersPage, UserAccessPanel, ALLOWED_EMAIL_DOMAINS, signInAllowed, isWorkspaceAdmin, signOut, useWorkspaces, WorkspaceTile, WorkspaceLockup, WorkspaceSwitcher,
  CreateWorkspaceModal, LoginScreen, BrandPage, LogoField, readImageFile, workspaceBrand});
