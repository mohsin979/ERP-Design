/* HOF Pulse ERP — Sign-in, workspaces and brand.

   Sign-in (the first screen): Continue with Google, mocked — any address on the HOF Migration
   or HOF Global domains is accepted, with no real Google account behind it. Signing in opens
   the last workspace; inside it the person is the user with that email, or joins its Users.

   Workspaces: the organizations — HOF Global, HOF Migration (Pakistan), HOF Migration Dubai, HOF
   Pack, HOF Partners (Pakistan) — in the top-left switcher of the ERP header, every one; those
   the signed-in person has no access to are greyed out ("No access"). Each is a separate account environment — its own records, CRM and CRM roles
   (its own saved store, store.jsx); only HOF Migration and HOF Partners are defined, the others
   open empty. People are shared: one identity each, with each organization's access set on its
   own. Each organization has the modules set in Module Settings; any module's data can be shared
   between the organizations of one of its linkage groups (moduleLinks.jsx). A workspace can start from a template
   (WORKSPACE_TEMPLATES: HOF Partners' CRM). Creating a workspace (name and optional logo; it
   starts empty, its creator Super Admin) is kept but not offered for now (WORKSPACE_CREATION_ENABLED).

   ERP Settings (the ERP home's Setting tile; workspace Super Admin and Admin):
     Workspace       — the open workspace's name and logo (HOF Migration keeps its own mark until a
                       logo is uploaded).
     Users           — search, Add user and everyone, one line each; ⋯ Access to Workspaces
                       (which organizations they can open).
     Module Settings — two tabs over the modules: Status (each module's availability per
                       organization — Enable) and Linkage (its linkage groups, moduleLinks.jsx —
                       Link Modules, Add organizations, Unlink).
   Design-system pattern (ERP Settings): a settings page carries no title or explanation that
   repeats the menu it's opened from — only its controls (search, actions, the table).

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
  // Every organization; those the signed-in person has no access to are greyed out.
  const workspaces = visibleWorkspaces(), open_ = new Set(switchableWorkspaces().map(w => w.id));
  const [open, setOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  return (
    <div style={{position:'relative', flexShrink:0}}>
      <div onClick={()=>setOpen(v=>!v)} title="Switch workspace" style={{display:'flex', alignItems:'center', gap:6, cursor:'pointer'}}>
        <WorkspaceLockup ws={active}/>
        <Icon name="chevDown" size={T.chevronSize} color={T.gray600} style={{transform: open ? 'rotate(180deg)' : 'none'}}/>
      </div>
      <MenuShell open={open} onClose={()=>setOpen(false)} width={260}>
        {workspaces.map(w => { const can = open_.has(w.id);
          return (
          <div key={w.id} aria-disabled={!can} onClick={()=>{ if(!can) return; setOpen(false); if(w.id !== active.id) reloadInto({activeId:w.id}); }}
            style={{display:'flex', alignItems:'center', gap:10, padding:'7px 10px', borderRadius:6, cursor: can ? 'pointer' : 'default', opacity: can ? 1 : .5,
              background: w.id === active.id ? T.headerBg : 'transparent'}}
            onMouseEnter={e=>{ if(can) e.currentTarget.style.background = T.headerBg; }} onMouseLeave={e=>e.currentTarget.style.background = w.id === active.id ? T.headerBg : 'transparent'}>
            <WorkspaceTile ws={w} size={22}/>
            <span style={{flex:1, minWidth:0, fontSize:13, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{w.name}</span>
            {w.id === active.id && <Icon name="check" size={12} color={T.blue}/>}
            {!can && <span style={{fontSize:11.5, color:T.attioMuted, whiteSpace:'nowrap'}}>No access</span>}
          </div>
        ); })}
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

/* ── Shared people, access and modules ── one identity per person (the registry's `users`); who
   can access each organization (`members`); and which organizations have each module (`modules`,
   Module Settings). Everyone with access to an organization opens the modules it has; Setting (ERP
   Settings) is for its administrators. Each module has its own linkage groups (moduleLinks.jsx):
   the organizations in one share that module's data, an unlinked one keeps its own; linking one
   module never links another. A person's CRM role (seat, team, permissions) is set in that
   organization's CRM (Users & Teams) — one for a CRM linkage group. */
const WORKSPACE_CREATION_ENABLED = false;
const visibleWorkspaces = () => WORKSPACE_REGISTRY.workspaces.filter(w => !w.hidden);
// An organization's name in organization lists: with its region — "HOF Migration (Pakistan)".
const orgLabel = (w) => w.region ? `${w.name} (${w.region})` : w.name;
// The modules Module Settings sets per organization (the ERP tiles but Setting).
const orgModules = () => MODULE_TILES.filter(t => t.assignable !== false);
const moduleLabel = (id) => { const t = MODULE_TILES.find(x => x.id === id); return t ? t.label : id; };
const moduleConfig = (id) => (WORKSPACE_REGISTRY.modules || {})[id] || {orgs:[], groups:[]};
const moduleEnabled = (id, wsId = ACTIVE_WORKSPACE.id) => (moduleConfig(id).orgs || []).includes(wsId);
// A shareable module's data is shared by the organization (it has the module and is linked).
// Whether the organization is in one of the module's linkage groups (moduleLinks.jsx).
const moduleLinked = (id, wsId = ACTIVE_WORKSPACE.id) => !!moduleGroupOf(id, wsId);
const directoryUsers = () => WORKSPACE_REGISTRY.users || [];
const sameEmail = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
const directoryUserByEmail = (email) => directoryUsers().find(u => sameEmail(u.email, email)) || null;
const workspaceMembers = (wsId) => (WORKSPACE_REGISTRY.members || {})[wsId] || null;   // null: not set up yet
const membershipOf = (wsId, userId) => (workspaceMembers(wsId) || []).find(m => m.userId === userId) || null;
const signedInUserId = () => { const u = SESSION && directoryUserByEmail(SESSION.email); return u ? u.id : null; };
// A Super Admin of any organization (`superAdminIn`, kept by syncWorkspacePeople) can open every organization.
const isSuperAdminUser = (userId) => { const u = directoryUsers().find(x => x.id === userId); return !!(u && (u.superAdminIn || []).length); };
// Whether a person can open an organization: given access to it, a Super Admin, or it isn't set up yet.
const canAccess = (wsId, userId) => !userId || !workspaceMembers(wsId) || !!membershipOf(wsId, userId) || isSuperAdminUser(userId);
// The workspaces the signed-in person can open (the switcher greys the others out).
const switchableWorkspaces = () => { const me = signedInUserId(); return visibleWorkspaces().filter(w => canAccess(w.id, me)); };
// The modules the signed-in person opens here: the organization's — when they can access it.
const myModules = () => {
  const mods = orgModules().filter(t => moduleEnabled(t.id)).map(t => t.id);
  return canAccess(ACTIVE_WORKSPACE.id, signedInUserId()) ? mods : [];
};
function setRegistry(patch){ saveWorkspaceRegistry(patch); window.dispatchEvent(new Event(WS_EVENT)); }
// Access to organizations, all at once: [{wsId, userId, member}].
function setMemberships(changes, users = directoryUsers()){
  const members = {...WORKSPACE_REGISTRY.members};
  changes.forEach(({wsId, userId, member}) => {
    const list = (members[wsId] || []).filter(m => m.userId !== userId);
    members[wsId] = member ? [...list, {userId}] : list;
  });
  setRegistry({users, members});
}
// A module available in an organization or not (its data and linkage groups are kept either way).
function setModuleOrg(id, wsId, enabled){
  const c = moduleConfig(id), orgs = c.orgs || [];
  setRegistry({modules:{...WORKSPACE_REGISTRY.modules, [id]:{...c, orgs: enabled ? [...new Set([...orgs, wsId])] : orgs.filter(x => x !== wsId)}}});
}
// A person into the directory (once) with access to an organization — CRM's Add User.
function joinWorkspaceDirectory(person, wsId = ACTIVE_WORKSPACE.id){
  const known = directoryUsers().find(u => u.id === person.id || sameEmail(u.email, person.email));
  const users = known ? directoryUsers() : [...directoryUsers(), {id:person.id, name:person.name, email:person.email}];
  setMemberships([{wsId, userId: known ? known.id : person.id, member:true}], users);
}
/* Opening a workspace (app.jsx): its Users join the directory; a workspace with no access list
   yet takes its Users; and the signed-in person, with access nowhere the switcher offers, joins it
   as anyone signing in always has. */
function syncWorkspacePeople(users){
  const wsId = ACTIVE_WORKSPACE.id;
  let dir = directoryUsers(), changed = false;
  const members = {...WORKSPACE_REGISTRY.members};
  users.forEach(u => { if(!dir.some(d => d.id === u.id || sameEmail(d.email, u.email))){ dir = [...dir, {id:u.id, name:u.name, email:u.email}]; changed = true; } });
  const idOf = (u) => (dir.find(d => d.id === u.id || sameEmail(d.email, u.email)) || u).id;
  if(!members[wsId]){ members[wsId] = users.map(u => ({userId:idOf(u)})); changed = true; }
  const me = SESSION && dir.find(d => sameEmail(d.email, SESSION.email));
  if(me && !members[wsId].some(m => m.userId === me.id) && !visibleWorkspaces().some(w => (members[w.id] || []).some(m => m.userId === me.id))){
    members[wsId] = [...members[wsId], {userId:me.id}]; changed = true;
  }
  // Who is a Super Admin here (their CRM preset), for opening every organization.
  dir = dir.map(d => {
    const u = users.find(x => x.id === d.id || sameEmail(x.email, d.email)), was = (d.superAdminIn || []).includes(wsId), is = !!u && u.preset === SUPER_ADMIN;
    if(was === is) return d;
    changed = true;
    return {...d, superAdminIn: is ? [...(d.superAdminIn || []), wsId] : (d.superAdminIn || []).filter(x => x !== wsId)};
  });
  if(changed) setRegistry({users:dir, members});
}
// The CRM users the open organization still needs (it has CRM): those with access not in its Users yet — as CRM's Add User makes them (no seat, team or preset).
function crmUsersToAdd(users){
  if(!moduleEnabled('crm')) return [];
  const created = new Date().toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
  return (workspaceMembers(ACTIVE_WORKSPACE.id) || []).map(m => directoryUsers().find(d => d.id === m.userId)).filter(Boolean)
    .filter(d => !users.some(u => u.id === d.id || sameEmail(u.email, d.email)))
    .map(d => ({id:d.id, name:d.name, email:d.email, status:'Activated', teamId:null, preset:'', access:'manual', lastActive:null, created,
      permissions:normalizePermissions(DEFAULT_CONTACT_PERMISSIONS(), levelOfPreset(''))}));
}
// Where the signed-in person belongs instead of the open workspace (no access to it), or null.
function workspaceRedirect(){
  const me = signedInUserId();
  if(canAccess(ACTIVE_WORKSPACE.id, me)) return null;
  const other = switchableWorkspaces().find(w => w.id !== ACTIVE_WORKSPACE.id);
  return other ? other.id : null;
}
/* ── Workspace templates ── a workspace's CRM setup when it starts (store.jsx `template`). HOF
   Partners' (the template `accounting`, as it was first named): two record types — Leads (the Deals record type, named Leads) and
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
  {id:'erp.workspace', label:'Workspace', icon:'brand'}, {id:'erp.users', label:'Users', icon:'usersThree'},
  {id:'erp.modules', label:'Module Settings', icon:'dashboard'}]};
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
        {page === 'erp.workspace' ? <WorkspaceSettingsPage/> : page === 'erp.users' ? <ErpUsersPage data={data} setData={setData}/> : <ModuleSettingsPage/>}
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
    <SettingsPage title="Workspace"
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

/* Users: everyone, one line each, in the record tables' grid (ContactsDataGrid) — Name and Email,
   sortable and searchable; ⋯ Access to Workspaces. Add user for someone new. A person given access
   to the open organization joins its CRM Users at once when it has CRM (other organizations: when
   they're next opened), with no seat, team or preset — set in that CRM's Users & Teams. */
const ERP_USER_COLUMNS = [{key:'name', label:'Name', width:280}, {key:'email', label:'Email', width:320}];
function ErpUsersPage({data, setData}){
  useWorkspaces();   // follows directory and access changes
  const [query, setQuery] = React.useState('');
  const [sort, setSort] = React.useState({key:'name', dir:'asc'});
  const [columnOrder, setColumnOrder] = React.useState(null);
  const [panel, setPanel] = React.useState(null);   // {userId} — null id adds someone new
  const rows = directoryUsers().map(u => ({id:u.id, name:u.name, email:u.email}));
  const schema = {
    properties:ERP_USER_COLUMNS, filterProps:[], selectValues:{}, noun:'user', searchKeys:['name', 'email'], selectable:false, boards:false,
    fillWidth:true, canCreateProperty:false, pinGutter:false,
    renderCell:(key, r) => key === 'name' ? <span style={{display:'flex', alignItems:'center', gap:8, minWidth:0}}>
        <Avatar name={r.name} size={22}/><span style={{fontWeight:500, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{r.name}</span></span>
      : undefined,
    renderActions:(r) => <RowActionsMenu title="User actions" width={MENU_W} items={[{label:'Access to Workspaces', onClick:()=>setPanel({userId:r.id})}]}/>,
  };
  const saved = (crmUsers) => { if(crmUsers.length) setData(d => ({...d, users:[...d.users, ...crmUsers.filter(u => !d.users.some(x => x.id === u.id))]})); setPanel(null); };
  return (
    <SettingsPage fill>
      <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:12}}>
        <div style={{position:'relative', width:280}}>
          <div style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', display:'flex'}}><Icon name="search" size={13} color={T.gray400}/></div>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search users" aria-label="Search users" style={{...fieldInput, paddingLeft:30}}/>
        </div>
        <div style={{flex:1}}/>
        <StCta label="Add user" onClick={()=>setPanel({userId:null})}/>
      </div>
      <div style={{flex:1, minHeight:0, display:'flex', flexDirection:'column', border:`1px solid ${T.attioLine}`, borderRadius:8, overflow:'hidden'}}>
        <RecordSchema.Provider value={schema}>
          <ContactsDataGrid rows={rows} columnOrder={columnOrder || ERP_USER_COLUMNS.map(c => c.key)} setColumnOrder={setColumnOrder} sort={sort} setSort={setSort}
            search={query} frozenLeft={0} frozenRight={0} actionsFrozen={false} rowsPerPage={25} onOpenContact={()=>{}}/>
        </RecordSchema.Provider>
      </div>
      {panel && <WorkspaceAccessPanel userId={panel.userId} onClose={()=>setPanel(null)} onSaved={saved} crmUsers={data.users}/>}
    </SettingsPage>
  );
}

/* Access to Workspaces — the creation side panel: the organizations as a checkbox list, ticked
   where the person can open them. Add user (no person yet) asks for their name and email (the
   sign-in domains) first. Access only — which modules an organization has is Module Settings'. */
function WorkspaceAccessPanel({userId, onClose, onSaved, crmUsers}){
  const isNew = !userId;
  const person = isNew ? null : directoryUsers().find(u => u.id === userId);
  const wss = visibleWorkspaces();
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [access, setAccess] = React.useState(() => wss.filter(w => !isNew && membershipOf(w.id, userId)).map(w => w.id));
  const superAdmin = !isNew && isSuperAdminUser(userId);   // opens every organization
  const emailTaken = isNew && !!directoryUserByEmail(email);
  const ok = isNew ? !!name.trim() && signInAllowed(email) && !emailTaken : !!person;
  const save = () => {
    if(!ok) return;
    let dir = directoryUsers(), target = person;
    if(isNew){
      const base = name.trim().toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '') || 'user';
      target = {id: dir.some(u => u.id === base) ? `${base}-${Date.now().toString(36)}` : base, name:name.trim(), email:email.trim().toLowerCase()};
      dir = [...dir, target];
    }
    setMemberships(wss.map(w => ({wsId:w.id, userId:target.id, member:access.includes(w.id)})), dir);
    // Access to the open organization (with CRM): into its CRM Users now (no seat, team or preset).
    onSaved(access.includes(ACTIVE_WORKSPACE.id) ? crmUsersToAdd(crmUsers) : []);
  };
  return (
    <CreatePanelFrame title={isNew ? 'Add user' : 'Access to Workspaces'} onClose={onClose} more={false} placement="fixed" width={480} actions={<>
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
        </> : person && (
          <Field label="User"><div style={{display:'flex', alignItems:'center', gap:8, paddingTop:5, fontSize:13, color:T.attioText, minWidth:0}}>
            <Avatar name={person.name} size={22}/><span style={{fontWeight:500, whiteSpace:'nowrap'}}>{person.name}</span>
            <span style={{color:T.attioMuted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{person.email}</span></div></Field>
        )}
        <Field label="Workspaces">
          <div style={{display:'flex', flexDirection:'column', paddingTop:2}}>
            {wss.map(w => (
              <div key={w.id} style={superAdmin ? {pointerEvents:'none'} : undefined}>
                <SettingsCheckRow checked={superAdmin || access.includes(w.id)} onToggle={()=>setAccess(a => a.includes(w.id) ? a.filter(x => x !== w.id) : [...a, w.id])}
                  hint={superAdmin ? 'Super Admin' : undefined}
                  label={<span style={{display:'inline-flex', alignItems:'center', gap:8}}><WorkspaceTile ws={w} size={18}/>{orgLabel(w)}</span>}/>
              </div>
            ))}
          </div>
        </Field>
      </>)}
    </CreatePanelFrame>
  );
}

/* Module Settings: two tabs over the modules (left, every one, whichever organizations have it) —
   kept apart, as availability and linkage are (enabling a module never shares its data):
     Status  — the module in each organization with its Enable switch (availability).
     Linkage — the module's linkage groups (moduleLinks.jsx): each group's organizations marked as
               one, ⋯ Unlink per organization, and the group's ⋯ to add organizations or unlink it.
               Link Modules (top right) opens the side panel for a new group. Moving data asks first.
   No heading on either (the tab says where you are). */
const MODULE_SETTINGS_TABS = [{id:'status', name:'Status', icon:'sliders'}, {id:'linkage', name:'Linkage', icon:'arrowsDownUp'}];
const LINK_TONES = ['#3A5BF9', '#16A34A', '#D97706', '#DB2777', '#7C3AED', '#0D9488'];
const mtHead = {fontSize:12, fontWeight:500, color:T.attioMuted, whiteSpace:'nowrap'};
const mtRow = {display:'flex', alignItems:'center', gap:12, padding:'0 12px 0 16px', height:T.attioRowH, borderBottom:`1px solid ${T.attioLine}`, fontSize:13, color:T.attioText};
const mtTable = {border:`1px solid ${T.attioLine}`, borderRadius:8, overflow:'hidden'};
const mtHeadRow = {display:'flex', alignItems:'center', gap:12, padding:'0 12px 0 16px', height:36, background:T.headerBg, borderBottom:`1px solid ${T.attioLine}`};
const orgCell = (mod, w) => (
  <span style={{flex:1, minWidth:0, display:'flex', alignItems:'center', gap:8}}>
    <WorkspaceTile ws={w} size={18}/>
    <span style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{mod.label} <span style={{color:T.attioMuted}}>in</span> {orgLabel(w)}</span>
  </span>
);
function ModuleSettingsPage(){
  useWorkspaces();   // follows module changes
  const mods = orgModules();
  const [tab, setTab] = React.useState('status');
  const [modId, setModId] = React.useState(mods[0].id);
  const [panel, setPanel] = React.useState(null);     // {groupId?}: Link Modules
  const [confirm, setConfirm] = React.useState(null); // {title, primary, body, run, danger}
  const [error, setError] = React.useState('');
  const mod = mods.find(m => m.id === modId) || mods[0];
  const wss = visibleWorkspaces(), byId = Object.fromEntries(wss.map(w => [w.id, w]));
  const groups = moduleGroups(mod.id);
  const hasData = !!MODULE_DATA[mod.id];
  const names = (ids) => ids.map(id => byId[id] ? orgLabel(byId[id]) : id).join(', ');
  // Linking or unlinking moves the module's data: it asks first.
  const ask = (c) => hasData ? setConfirm(c) : c.run();
  const link = (moduleId, orgIds, groupId) => {
    const m = mods.find(x => x.id === moduleId);
    const run = () => { const err = linkOrgs(moduleId, orgIds, groupId); setError(err || ''); setPanel(null); setConfirm(null); };
    if(!MODULE_DATA[moduleId]) return run();
    setConfirm({title:`Link ${m.label}`, primary:'Link', body:<>{names(orgIds)}</>, run});
  };
  return (
    <div style={{flex:1, minHeight:0, display:'flex', flexDirection:'column', background:'#fff'}}>
      <PrimaryTabs inset="settings" items={MODULE_SETTINGS_TABS} active={tab} onSelect={(id)=>{ setTab(id); setError(''); }}/>
      <div style={{flex:1, minHeight:0, display:'flex'}}>
        <div style={{width:200, flexShrink:0, borderRight:`1px solid ${T.border}`, padding:'14px 12px', overflowY:'auto'}}>
          {mods.map(m => <CrmNavItem key={m.id} icon={null} label={m.label} active={m.id === mod.id} onClick={()=>{ setModId(m.id); setError(''); }}/>)}
        </div>
        <div style={{flex:1, minWidth:0, minHeight:0, overflowY:'auto', padding:'12px 16px 24px', display:'flex', flexDirection:'column', gap:16}}>
          {tab === 'status' && <div style={{...mtTable, maxWidth:720}}>
            <div style={mtHeadRow}><span style={{...mtHead, flex:1}}>Module</span><span style={{...mtHead, width:96}}>Status</span></div>
            {wss.map(w => { const on = moduleEnabled(mod.id, w.id);
              return (
                <div key={w.id} style={mtRow}>
                  {orgCell(mod, w)}
                  <span style={{width:96, display:'flex', alignItems:'center', gap:8}}>
                    <UtToggle on={on} onChange={(v)=>setModuleOrg(mod.id, w.id, v)}/>
                    <span style={{fontSize:12.5, color: on ? T.attioText : T.attioMuted}}>{on ? 'Enabled' : 'Disabled'}</span>
                  </span>
                </div>
              ); })}
          </div>}
          {tab === 'linkage' && <>
            <div style={{display:'flex', alignItems:'center', gap:12, minHeight:30, maxWidth:720}}>
              {error && <span style={{fontSize:12.5, color:T.red}}>{error}</span>}
              <div style={{flex:1}}/>
              <StCta label="Link Modules" onClick={()=>setPanel({})}/>
            </div>
            {groups.length > 0 ? (
              <div style={{...mtTable, maxWidth:720}}>
                <div style={mtHeadRow}><span style={{...mtHead, flex:1}}>Linked</span><span style={{width:28}}/></div>
                {groups.map((g, i) => { const tone = LINK_TONES[i % LINK_TONES.length];
                  return (
                    <div key={g.id} style={{position:'relative'}}>
                      {/* One group: a coloured bar down its rows. */}
                      <span aria-hidden="true" style={{position:'absolute', left:0, top:0, bottom:0, width:3, background:tone}}/>
                      <div style={{...mtRow, background:T.pageBg}}>
                        <span style={{flex:1, minWidth:0, display:'flex', alignItems:'center', gap:8, fontWeight:500}}>
                          <span style={{width:8, height:8, borderRadius:9999, background:tone, flexShrink:0}}/>Linkage {i + 1}
                          <span style={{fontWeight:400, color:T.attioMuted}}>· {g.orgs.length}</span>
                        </span>
                        <RowActionsMenu title="Linkage actions" width={MENU_W} items={[
                          {label:'Add organizations', onClick:()=>setPanel({groupId:g.id})},
                          {label:'Unlink all', danger:true, onClick:()=>ask({title:`Unlink ${mod.label}`, primary:'Unlink', danger:true, body:<>{names(g.orgs)}</>,
                            run:()=>{ setConfirm(null); unlinkGroup(mod.id, g.id); }})}]}/>
                      </div>
                      {g.orgs.map(id => byId[id] && (
                        <div key={id} style={{...mtRow, paddingLeft:32}}>
                          {orgCell(mod, byId[id])}
                          <RowActionsMenu title="Organization actions" width={MENU_W} items={[
                            {label:'Unlink', danger:true, onClick:()=>ask({title:`Unlink ${mod.label} in ${orgLabel(byId[id])}`, primary:'Unlink', danger:true, body:null,
                              run:()=>{ setConfirm(null); unlinkOrg(mod.id, g.id, id); }})}]}/>
                        </div>
                      ))}
                    </div>
                  ); })}
              </div>
            ) : <div style={{maxWidth:720}}><StEmpty title="No linkages yet"/></div>}
          </>}
        </div>
      </div>
      {panel && <LinkModulesPanel moduleId={mod.id} groupId={panel.groupId} onClose={()=>setPanel(null)} onLink={link}/>}
      {confirm && <StModal title={confirm.title} primary={confirm.primary} danger={confirm.danger} onCancel={()=>setConfirm(null)} onSubmit={confirm.run}>
        {confirm.body && <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>{confirm.body}</div>}
      </StModal>}
    </div>
  );
}

/* Link Modules — the side panel: the module being linked, a search, and the organizations as a
   checkbox list (several at once; one already in another group of this module can't be picked).
   From a group's ⋯ Add organizations: that group's organizations come ticked. */
function LinkModulesPanel({moduleId, groupId, onClose, onLink}){
  const mods = orgModules();
  const [mid, setMid] = React.useState(moduleId);
  const [q, setQ] = React.useState('');
  const groups = moduleGroups(mid), g = groupId ? groups.find(x => x.id === groupId) : null;
  const [picked, setPicked] = React.useState(() => g ? [...g.orgs] : []);
  React.useEffect(() => { if(!g) setPicked([]); }, [mid]);
  const linkedElsewhere = (id) => groups.some(x => x.id !== groupId && x.orgs.includes(id));
  const qq = q.trim().toLowerCase();
  const wss = visibleWorkspaces().filter(w => !qq || orgLabel(w).toLowerCase().includes(qq));
  const ok = g ? picked.length > g.orgs.length : picked.length >= 2;
  const toggle = (id) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const modLabel = (mods.find(m => m.id === mid) || {}).label;
  return (
    <CreatePanelFrame title={g ? `Link ${modLabel}` : 'Link Modules'} onClose={onClose} more={false} placement="fixed" width={460} actions={<>
      <StSecondary label="Cancel" onClick={onClose}/>
      <StCta label="Link" disabled={!ok} onClick={()=>onLink(mid, g ? picked.filter(id => !g.orgs.includes(id)) : picked, groupId)}/>
    </>}>
      {stack(<>
        <Field label="Module">{g ? <ReadValue>{modLabel}</ReadValue>
          : <Select value={mid} options={mods.map(m => ({value:m.id, label:m.label}))} onChange={v=>v && setMid(v)}/>}</Field>
        <Field label="Organizations">
          <div style={{display:'flex', flexDirection:'column', gap:6}}>
            <div style={{position:'relative'}}>
              <div style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', display:'flex'}}><Icon name="search" size={13} color={T.gray400}/></div>
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search organizations" aria-label="Search organizations" style={{...fieldText, paddingLeft:30}}/>
            </div>
            {wss.map(w => { const fixed = (g && g.orgs.includes(w.id)) || linkedElsewhere(w.id);
              return (
                <div key={w.id} style={{opacity: linkedElsewhere(w.id) ? .5 : 1, pointerEvents: fixed ? 'none' : 'auto'}}>
                  <SettingsCheckRow checked={picked.includes(w.id)} onToggle={()=>toggle(w.id)} hint={linkedElsewhere(w.id) ? 'Linked' : undefined}
                    label={<span style={{display:'inline-flex', alignItems:'center', gap:8}}><WorkspaceTile ws={w} size={18}/>{orgLabel(w)}</span>}/>
                </div>
              ); })}
          </div>
        </Field>
      </>)}
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

Object.assign(window, {WORKSPACE_CREATION_ENABLED, visibleWorkspaces, directoryUsers, workspaceMembers, membershipOf, signedInUserId, switchableWorkspaces,
  myModules, setMemberships, joinWorkspaceDirectory, syncWorkspacePeople, crmUsersToAdd, workspaceRedirect, WORKSPACE_TEMPLATES, workspaceTemplate, LEAD_OUTCOMES,
  orgLabel, orgModules, moduleEnabled, moduleLinked, setModuleOrg, canAccess, isSuperAdminUser,
  ErpSettingsScreen, WorkspaceSettingsPage, ErpUsersPage, WorkspaceAccessPanel, ModuleSettingsPage, LinkModulesPanel, ALLOWED_EMAIL_DOMAINS, signInAllowed, isWorkspaceAdmin, signOut, useWorkspaces, WorkspaceTile, WorkspaceLockup, WorkspaceSwitcher,
  CreateWorkspaceModal, LoginScreen, BrandPage, LogoField, readImageFile, workspaceBrand});
