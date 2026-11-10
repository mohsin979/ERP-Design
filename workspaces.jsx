/* HOF Pulse ERP — Sign-in, the Organization, its instances and brand.

   Sign-in (the first screen): Continue with Google, mocked — any address on the HOF Migration
   or HOF Global domains (and the allow-listed addresses, ALLOWED_EMAIL_ADDRESSES) is accepted,
   with no real Google account behind it. Signing in opens
   the ERP home; the person is one of the Organization's users, or joins them (a Member of the
   first People instance, with the open CRM instance — whose Users they join as anyone signing in
   always has, usersTeams.jsx withSessionMember).

   The Organization (store.jsx ORG_REGISTRY): HOF Global, the one workspace — its lockup top left
   of the ERP header (its logo, else the HOF mark), nothing to switch. Its modules have branches
   (instances; "Branches" in the product):
     CRM     — Migration, Pack, Partners: each its own CRM store — records, settings and Users &
               Teams (a person's preset, seat and team per branch). The CRM sidebar's head reads
               "← Migration | CRM" — a switcher for someone with more than one CRM branch (nav.jsx).
     People  — Pakistan, Dubai: each its own employees (CRM Add User searches every branch's). A
               person belongs to one; a Super Admin may hold several. The People sidebar's head is
               the same ("← Pakistan | People", a switcher with more than one); the People module's
               pages aren't defined yet (nav.jsx PEOPLE_NAV: the navigation only).
   Everyone with a CRM branch opens the CRM (this browser's last one, else their first); Setting
   (ERP Settings) is for the Organization's Super Admins.

   ERP Settings (the ERP home's Setting tile):
     Organization — the Organization's name and logo (its own mark — white label).
     Users        — the CRM's record list and Filters (as CRM → Users & Teams → Users): Add user
                    (+), Find or Ask, Filters, and everyone (Name, Email, People, CRM) — opened from
                    a branch's Members link, filtered to that branch; ⋯ Access:
                    Organization role, People branch (a Super Admin's People branches), CRM
                    branches — each with the person's role there, read-only (set in that CRM's
                    Users & Teams).
     Branches     — its own menu, a second column beside the Settings menu (as CRM → Settings):
                    "← Branches" (collapses it), then (no group header) one entry per module with branches: CRM, People,
                    Accounting, Analytics, Academy, Complience (Marketing has none). A module's page: one line of copy with Add on its right
                    (a name; a new CRM branch starts empty, with the standard record types), then
                    its branches — name, members (a link: Users showing them), created — with
                    ⋯ Rename. A new branch goes to everyone for now (else to the one adding it).
   For now everyone is a Super Admin with every branch (EVERYONE_SUPER_ADMIN): the product is
   designed from that view; narrower access comes later.
   Design-system pattern (ERP Settings): a settings page carries no title or explanation that
   repeats the menu it's opened from — only its controls (search, actions, the table).

   Brand (CRM → Marketing → Brand): the Organization's — one for every CRM instance — set by CRM
   administrators: the company logo, brand colours (used on quotations and documents), the company
   email signature and the digital letterhead. */

const ALLOWED_EMAIL_DOMAINS = ['hofmigration.com', 'hof-global.com'];
// Addresses on other domains that may sign in (the product designer's Google account).
const ALLOWED_EMAIL_ADDRESSES = ['mohsin979@gmail.com'];
const emailDomain = (email) => String(email || '').trim().toLowerCase().split('@')[1] || '';
const signInAllowed = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim())
  && (ALLOWED_EMAIL_DOMAINS.includes(emailDomain(email)) || ALLOWED_EMAIL_ADDRESSES.includes(String(email).trim().toLowerCase()));
// Administrators of the open CRM instance (their Permission Preset) — Brand.
const CRM_ADMIN_PRESETS = ['Super Admin', 'Admin'];
const isCrmAdmin = () => CRM_ADMIN_PRESETS.includes(CURRENT_USER.role);
function signOut(){ reloadInto({session:null}); }

/* The registry as React state: a change (ERP Settings, Brand, the People switcher) re-renders
   whatever reads it. */
const ORG_EVENT = 'hof-org-changed';
function useOrg(){
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => { window.addEventListener(ORG_EVENT, force); return () => window.removeEventListener(ORG_EVENT, force); }, []);
  return ORG_REGISTRY;
}
function setOrg(patch){ saveOrgRegistry(patch); window.dispatchEvent(new Event(ORG_EVENT)); }
const updateOrg = (patch) => setOrg({org:{...ORG_REGISTRY.org, ...patch}});
const updateBrand = (patch) => updateOrg({brand:{...(ORG_REGISTRY.org.brand || {}), ...patch}});

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

/* A square mark: a logo, else the HOF mark — the Organization's own (the ERP header) or the
   brand's (quotations). */
function MarkTile({logo, size = 20}){
  const box = {width:size, height:size, borderRadius:Math.round(size / 4), flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', background:'#fff', border:`1px solid ${T.attioLine}`};
  return <span style={box}>{logo ? <img src={logo} alt="" style={{width:'100%', height:'100%', objectFit:'contain'}}/> : <Logo variant="mark" height={Math.round(size * .72)}/>}</span>;
}
const lockupName = {fontSize:14, fontWeight:600, color:T.attioText, whiteSpace:'nowrap'};
// The Organization's lockup (ERP header, top left): its logo or the HOF mark, and its name.
function OrgLockup(){
  const {org} = useOrg();
  return <span style={{display:'inline-flex', alignItems:'center', gap:8, minWidth:0, flexShrink:0}}><MarkTile logo={org.logo} size={22}/><span style={lockupName}>{org.name}</span></span>;
}
// The brand's lockup (quotations): the company logo or the HOF mark, and the Organization's name.
function BrandLockup({brand}){
  return <span style={{display:'inline-flex', alignItems:'center', gap:8, minWidth:0}}><MarkTile logo={brand.logo} size={22}/><span style={lockupName}>{brand.name}</span></span>;
}

/* ── Switchers ── the current choice with a chevron; a menu of the choices, a check on the
   current one (the ERP header's People switcher, the CRM sidebar's CRM switcher). */
function SwitcherMenu({label, title, icon, options, value, onPick, width = 220}){
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{position:'relative', flexShrink:0, minWidth:0}}>
      <div onClick={()=>setOpen(v=>!v)} title={title} style={{display:'flex', alignItems:'center', gap:6, cursor:'pointer', minWidth:0}}>
        {icon}
        <span style={{fontSize:13, fontWeight:600, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{label}</span>
        <Icon name="chevDown" size={T.chevronSize} color={T.gray600} style={{transform: open ? 'rotate(180deg)' : 'none'}}/>
      </div>
      <MenuShell open={open} onClose={()=>setOpen(false)} width={width}>
        {options.map(o => o.divider ? <div key={o.id} style={{height:1, background:T.border, margin:'4px 2px'}}/> : (
          <div key={o.id} onClick={()=>{ setOpen(false); if(o.id !== value) onPick(o.id); }}
            style={{display:'flex', alignItems:'center', gap:10, padding:'7px 10px', borderRadius:6, cursor:'pointer', background: o.id === value ? T.headerBg : 'transparent'}}
            onMouseEnter={e=>{ e.currentTarget.style.background = T.headerBg; }} onMouseLeave={e=>e.currentTarget.style.background = o.id === value ? T.headerBg : 'transparent'}>
            <span style={{flex:1, minWidth:0, fontSize:13, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{o.label}</span>
            {o.id === value && <Icon name="check" size={12} color={T.blue}/>}
          </div>
        ))}
      </MenuShell>
    </div>
  );
}
// A module sidebar's head label: the open branch and the module — "Migration | CRM".
const branchLabel = (name, module) => <>{name}<span style={{fontWeight:400, color:T.gray600}}> | {module}</span></>;
const branchPlain = (name, module) => <span style={{display:'block', fontSize:13, fontWeight:600, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{branchLabel(name, module)}</span>;
/* The CRM switcher (the CRM sidebar's head, nav.jsx): someone with more than one CRM branch picks
   the one to open — the page starts over in its store, in the CRM. One branch: its name alone. */
function CrmSwitcher(){
  useOrg();
  const mine = myCrmInstances();
  if(mine.length < 2) return branchPlain(ACTIVE_CRM.name, 'CRM');
  return <SwitcherMenu title="Switch CRM branch" label={branchLabel(ACTIVE_CRM.name, 'CRM')} options={mine.map(c => ({id:c.id, label:c.name}))} value={ACTIVE_CRM.id} onPick={(id)=>reloadInto({crmId:id, openCrm:true})}/>;
}
// The open People branch (this browser's choice, else the first of the person's).
const activePeople = () => { const mine = myPeopleInstances(); return mine.find(p => p.id === ORG_REGISTRY.peopleId) || mine[0] || ORG_REGISTRY.people[0]; };
/* The People switcher (the People sidebar's head, nav.jsx): the same as the CRM's — someone with
   more than one People branch picks the one open (no data to load: no reload). One branch: its name alone. */
function PeopleSwitcher(){
  useOrg();
  const mine = myPeopleInstances(), cur = activePeople();
  if(mine.length < 2) return branchPlain(cur.name, 'People');
  return <SwitcherMenu title="Switch People branch" label={branchLabel(cur.name, 'People')} options={mine.map(p => ({id:p.id, label:p.name}))} value={cur.id} onPick={(id)=>setOrg({peopleId:id})}/>;
}

/* A logo field: preview, Upload / Replace and Remove. */
// `fallback`: what the preview shows without a logo (the HOF mark).
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

/* ── The Organization's users and access ── one identity per person (ORG_REGISTRY.users): their
   Organization role, People instance(s) and CRM instances. What a person is in a CRM instance
   (preset, seat, team, permissions) is that instance's Users & Teams — one Users per CRM instance. */
const orgUsers = () => ORG_REGISTRY.users || [];
const sameEmail = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
const orgUserByEmail = (email) => orgUsers().find(u => sameEmail(u.email, email)) || null;
const signedInOrgUser = () => SESSION ? orgUserByEmail(SESSION.email) : null;
// The Organization's Super Admins: ERP Settings — its users and instances — and several People instances.
const isOrgAdmin = () => { const u = signedInOrgUser(); return !!u && u.role === 'Super Admin'; };
const peopleInstance = (id) => ORG_REGISTRY.people.find(p => p.id === id) || null;
const instanceName = (list, id) => { const x = (list || []).find(i => i.id === id); return x ? x.name : id; };
// The CRM instances the signed-in person can open (someone not yet a user: the open one, which they join).
const myCrmInstances = () => { const me = signedInOrgUser(); return ORG_REGISTRY.crm.filter(c => me ? (me.crm || []).includes(c.id) : c.id === ACTIVE_CRM.id); };
// A person's People instances: their own, and — a Super Admin — the others they hold (`peopleAccess`).
const peopleInstancesOf = (u) => !u ? [] : ORG_REGISTRY.people.filter(p => p.id === u.peopleId || (u.role === 'Super Admin' && (u.peopleAccess || []).includes(p.id)));
const myPeopleInstances = () => peopleInstancesOf(signedInOrgUser());
// Where the signed-in person's CRM opens instead of the open instance (no access to it), or null (none at all: the ERP home only).
function crmRedirect(){ const mine = myCrmInstances(); return !mine.length || mine.some(c => c.id === ACTIVE_CRM.id) ? null : mine[0].id; }
const setOrgUsers = (users) => setOrg({users});
/* For now everyone is a Super Admin with every instance — the product is designed from the Super
   Admin's view; narrower access comes later (then: off, and each user's role and instances set in
   ERP Settings → Users). Whoever joins or is added gets it, and a new instance goes to everyone. */
const EVERYONE_SUPER_ADMIN = true;
const fullAccess = () => ({role:'Super Admin', peopleAccess:ORG_REGISTRY.people.map(p => p.id), crm:ORG_REGISTRY.crm.map(c => c.id)});
// Someone new among the Organization's users: a Member of the People instance given (else the first), with CRM instances — or, for now, a Super Admin with every instance.
const newOrgUser = (person, crmIds = [], peopleId) => ({id:person.id, name:person.name, email:person.email, role:'Member',
  peopleId: peopleInstance(peopleId) ? peopleId : ORG_REGISTRY.people[0].id, peopleAccess:[], crm:[...new Set(crmIds)], ...(EVERYONE_SUPER_ADMIN ? fullAccess() : {})});
/* A person into the Organization's users (once, by id or email) with the open CRM instance — CRM's
   Add User (`peopleId`: their employee's People instance). */
function joinOrganization(person, crmId = ACTIVE_CRM.id){
  const known = orgUsers().find(u => u.id === person.id || sameEmail(u.email, person.email));
  if(!known){ setOrgUsers([...orgUsers(), newOrgUser(person, [crmId], person.peopleId)]); return; }
  if(!(known.crm || []).includes(crmId)) setOrgUsers(orgUsers().map(u => u === known ? {...u, crm:[...(u.crm || []), crmId]} : u));
}
/* The reverse — CRM's Delete user: the person no longer has the open CRM instance (else its Users
   would take them back when it next opens, crmUsersToAdd). They stay one of the Organization's
   users, with any other instances. */
function leaveCrm(person, crmId = ACTIVE_CRM.id){
  const known = orgUsers().find(u => u.id === person.id || sameEmail(u.email, person.email));
  if(known && (known.crm || []).includes(crmId)) setOrgUsers(orgUsers().map(u => u === known ? {...u, crm:u.crm.filter(x => x !== crmId)} : u));
}
/* Opening a CRM instance (app.jsx): anyone in its Users who isn't one of the Organization's users
   yet joins them, with this instance (the signed-in person, as anyone signing in always has;
   Migration's sample users). Someone already there keeps the CRM instances they have: one whose
   access to this instance was taken away (ERP Settings → Users → Access) stays in its Users — their
   preset, seat and team kept — but can't open it, and it isn't given back. */
function syncOrgUsers(users){
  const crmId = ACTIVE_CRM.id;
  let dir = orgUsers(), changed = false;
  users.forEach(u => {
    if(dir.some(x => x.id === u.id || sameEmail(x.email, u.email))) return;
    dir = [...dir, newOrgUser(u, [crmId], u.peopleId)]; changed = true;
  });
  if(changed) setOrgUsers(dir);
}
// The CRM users the open instance still needs: the Organization's users with it who aren't in its Users yet — as CRM's Add User makes them (no seat, team or preset).
function crmUsersToAdd(users){
  const created = new Date().toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
  return orgUsers().filter(d => (d.crm || []).includes(ACTIVE_CRM.id) && !users.some(u => u.id === d.id || sameEmail(u.email, d.email)))
    .map(d => ({id:d.id, name:d.name, email:d.email, status:'Activated', teamId:null, preset:'', access:'manual', lastActive:null, created,
      permissions:normalizePermissions(DEFAULT_CONTACT_PERMISSIONS(), levelOfPreset(''))}));
}
/* Every People instance's employees, each with its instance (`peopleId`) — CRM Add User's search;
   saved back each into its instance's store (one without an instance: the first). */
const allEmployees = () => ORG_REGISTRY.people.flatMap(p => (readStore(peopleStoreKey(p.id)) || []).map(e => ({...e, peopleId:p.id})));
const hasEmployeeStores = () => ORG_REGISTRY.people.some(p => readStore(peopleStoreKey(p.id)) != null);
function saveEmployees(list){
  const first = ORG_REGISTRY.people[0].id;
  ORG_REGISTRY.people.forEach(p => writeStore(peopleStoreKey(p.id), (list || []).filter(e => e && (e.peopleId || first) === p.id).map(({peopleId, ...e}) => e)));
}

/* ── CRM templates ── a CRM instance's setup when it starts (store.jsx `template`). Partners' (the
   template `accounting`, as it was first named): two record types — Leads (the Deals record type, named Leads) and
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
const crmTemplate = () => (CRM_TEMPLATE && WORKSPACE_TEMPLATES[CRM_TEMPLATE]) || null;

/* ── ERP Settings ── the ERP home's Setting tile, for the Organization's Super Admins: the CRM
   settings' look — a Settings menu on the left (back arrow to the ERP home), the page on the right. */
const ERP_SETTINGS_NAV = {id:'erp.settings', label:'ERP Settings', group:true, items:[
  {id:'erp.organization', label:'Organization', icon:'brand'}, {id:'erp.users', label:'Users', icon:'usersThree'},
  {id:'erp.branches', label:'Branches', icon:'dashboard'}]};
/* Branches has a menu of its own, beside the Settings menu — as the CRM's Settings menu opens
   beside its main navigation (nav.jsx CrmSettingsNav): Branches stays selected in the Settings
   menu, and a second column reads "← Branches" (the arrow collapses the column; Branches opens it
   again), then one entry per module with branches (the ERP home's tiles, app.jsx MODULE_TILES —
   but Setting, and Marketing, which has none) — each that module's branches. Menu icons from the
   shared set (the tiles' module artwork is for the home). */
const BRANCH_NAV_ICONS = {crm:'cube', people:'usersThree', accounting:'coins', analytics:'analytical', academy:'playbook', complience:'shield'};
const MODULES_WITHOUT_BRANCHES = ['marketing'];
const BRANCH_PAGE = 'erp.branches.';
const branchModules = () => MODULE_TILES.filter(t => t.assignable !== false && !MODULES_WITHOUT_BRANCHES.includes(t.id));
const moduleLabel = (id) => { const t = MODULE_TILES.find(x => x.id === id); return t ? t.label : id; };
// The modules, listed straight under "← Branches" (no group header).
const branchesNavItems = () => branchModules().map(t => ({id:BRANCH_PAGE + t.id, label:t.label, icon:BRANCH_NAV_ICONS[t.id] || 'cube'}));
// A settings menu's head: the back arrow and where you are (the CRM Settings menu's).
function SettingsMenuHead({label, title, onBack}){
  return (
    <div onClick={onBack} title={title} style={{display:'flex', alignItems:'center', gap:8, marginBottom:16, padding:'0 2px', minHeight:18, cursor:'pointer', alignSelf:'flex-start'}}>
      <Icon name="arrowLeft" size={14} color={T.gray600}/>
      <span style={{fontSize:13, fontWeight:600, color:T.attioText}}>{label}</span>
    </div>
  );
}
const settingsMenuScroll = {flex:1, minHeight:0, overflowY:'auto', margin:'0 -12px', padding:'0 12px 8px'};
const settingsMenuColumn = {width:200, background:'#fff', borderRight:`1px solid ${T.border}`, display:'flex', flexDirection:'column', flexShrink:0, padding:'16px 12px'};
function ErpSettingsScreen({onBack, data, setData}){
  const [page, setPage] = React.useState('erp.organization');
  const [branchesMenuOpen, setBranchesMenuOpen] = React.useState(true);   // the Branches column (its ← collapses it)
  const [usersFocus, setUsersFocus] = React.useState(null);               // Users opened filtered to a branch's members
  const branchModule = page.startsWith(BRANCH_PAGE) ? page.slice(BRANCH_PAGE.length) : null;
  const openSettingsPage = (id) => {
    if(id === 'erp.branches'){ setBranchesMenuOpen(true); if(!branchModule) setPage(BRANCH_PAGE + branchModules()[0].id); return; }
    if(id === 'erp.users') setUsersFocus(null);
    setPage(id);
  };
  const showMembers = (module, branch) => { setUsersFocus({...branchMembersFilter(module, branch), nonce:Date.now()}); setPage('erp.users'); };
  return (
    <div style={{flex:1, minHeight:0, display:'flex', background:'#fff', borderTop:`1px solid ${T.border}`}}>
      <div style={settingsMenuColumn}>
        <SettingsMenuHead label="Settings" title="Back to the ERP home" onBack={onBack}/>
        <div style={settingsMenuScroll}><CrmNavGroup group={ERP_SETTINGS_NAV} active={branchModule ? 'erp.branches' : page} setActive={openSettingsPage} first/></div>
      </div>
      {branchModule && branchesMenuOpen && (
        <div style={settingsMenuColumn}>
          <SettingsMenuHead label="Branches" title="Collapse Branches menu" onBack={()=>setBranchesMenuOpen(false)}/>
          <div style={settingsMenuScroll}>{branchesNavItems().map(n => <CrmNavItem key={n.id} icon={n.icon} label={n.label} active={page === n.id} onClick={()=>setPage(n.id)}/>)}</div>
        </div>
      )}
      <div style={{flex:1, minWidth:0, minHeight:0, display:'flex', flexDirection:'column', position:'relative'}}>
        {branchModule ? <BranchesPage key={branchModule} module={branchModule} onMembers={showMembers}/>
          : page === 'erp.users' ? <ErpUsersPage data={data} setData={setData} focus={usersFocus}/> : <OrganizationSettingsPage/>}
      </div>
    </div>
  );
}

// Organization: its name and logo (its own mark, white label — the ERP header).
function OrganizationSettingsPage(){
  const {org} = useOrg();
  const [name, setName] = React.useState(org.name);
  const [logo, setLogo] = React.useState(org.logo || null);
  const [saved, setSaved] = React.useState(false);
  const dirty = name.trim() !== org.name || (logo || null) !== (org.logo || null);
  const ok = !!name.trim();
  const save = () => { if(!ok) return; updateOrg({name:name.trim(), logo}); setSaved(true); };
  React.useEffect(() => { if(dirty) setSaved(false); }, [dirty]);
  return (
    <SettingsPage
      actions={dirty ? <><StSecondary label="Cancel" onClick={()=>{ setName(org.name); setLogo(org.logo || null); }}/><StCta label="Save changes" disabled={!ok} onClick={save}/></>
        : saved ? <span style={{fontSize:12.5, color:T.attioMuted}}>Saved</span> : null}>
      <div style={{maxWidth:560, display:'flex', flexDirection:'column', gap:20}}>
        <div>
          <label style={fieldLabel} htmlFor="org-name">Organization name</label>
          <input id="org-name" value={name} onChange={e=>setName(e.target.value)} style={fieldInput}/>
        </div>
        <div>
          <label style={fieldLabel}>Logo</label>
          <LogoField value={logo} onChange={setLogo} fallback={<Logo variant="mark" height={34}/>}/>
        </div>
      </div>
    </SettingsPage>
  );
}

/* Users: everyone, one line each, in the record tables' grid (ContactsDataGrid) — Name, Email,
   People and CRM, sortable and searchable; ⋯ Access. Add user for someone new. A person given the
   open CRM branch joins its Users at once (other branches: when they're next opened), with no
   seat, team or preset — set in that CRM's Users & Teams. */
const ERP_USER_COLUMNS = [{key:'name', label:'Name', width:240}, {key:'email', label:'Email', width:280}, {key:'people', label:'People', width:140}, {key:'crm', label:'CRM', width:220}];
/* Filters — the CRM's (contacts.jsx FilterModal: the same rows, operators and groups as CRM →
   Users & Teams → Users): Name and Email (text), People (one branch: a select), and each other
   module with branches (CRM, Accounting, …) as text over the person's branches there — "Contains",
   as the CRM filters a user's Team. Only Name, Email, People and CRM are columns. */
const ERP_USER_FILTER_PROPS = () => [{key:'name', label:'Name', type:'text'}, {key:'email', label:'Email', type:'text'}, {key:'people', label:'People', type:'select'},
  ...branchModules().filter(t => t.id !== 'people').map(t => ({key:t.id, label:t.label, type:'text'}))];
// A branch's Members link: Users filtered to it — People Is the branch, the other modules Contain it.
const branchMembersFilter = (module, branch) => ({prop:module, op: module === 'people' ? 'is' : 'contains', value:branch.name});
// `focus` {prop, op, value, nonce} (a branch's Members link) opens the list with that filter, as an unsaved change (RecordViewsModule).
function ErpUsersPage({data, setData, focus}){
  const reg = useOrg();   // follows users and access changes
  const [panel, setPanel] = React.useState(null);   // {userId} — null id adds someone new
  const names = (u, module) => userBranches(u, module).map(id => instanceName(branchesOf(reg, module), id)).join(', ');
  const rows = orgUsers().map(u => ({id:u.id, name:u.name, email:u.email, people:instanceName(reg.people, u.peopleId),
    ...Object.fromEntries(branchModules().filter(t => t.id !== 'people').map(t => [t.id, names(u, t.id)]))}));
  const schema = {
    properties:ERP_USER_COLUMNS, filterProps:ERP_USER_FILTER_PROPS(), selectValues:{people:reg.people.map(p => p.name)}, noun:'user', searchKeys:['name', 'email', 'people', 'crm'],
    selectable:false, boards:false, fillWidth:true, canCreateProperty:false, pinGutter:false,
    renderCell:(key, r) => key === 'name' ? <span style={{display:'flex', alignItems:'center', gap:8, minWidth:0}}>
        <Avatar name={r.name} size={22}/><span style={{fontWeight:500, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{r.name}</span></span>
      : undefined,
    renderActions:(r) => <RowActionsMenu title="User actions" width={MENU_W} items={[{label:'Access', onClick:()=>setPanel({userId:r.id})}]}/>,
  };
  const saved = (crmUsers) => { if(crmUsers.length) setData(d => ({...d, users:[...d.users, ...crmUsers.filter(u => !d.users.some(x => x.id === u.id))]})); setPanel(null); };
  /* The CRM's record list (usersTeams.jsx RecordViewsModule): its toolbar — the view, Add user
     (the CRM Users' icon-only +), Find or Ask, Filters, Clear all — and grid. No saved views: they
     would be kept in the open CRM branch's store, and this list is the Organization's. */
  return (
    <SettingsPage fill>
      <RecordViewsModule flushTop savedViews={false} storeKey="views:erp-users-v1" schema={schema} rows={rows} columns={ERP_USER_COLUMNS.map(c => c.key)}
        defaultViews={[{id:'erp-users-all', name:'All Users', sort:{key:'name', dir:'asc'}}]} focus={focus}
        actions={() => <button onClick={()=>setPanel({userId:null})} title="Add user" style={iconBtn}><Icon name="plus" size={14} color={T.gray800}/></button>}/>
      {panel && <UserAccessPanel userId={panel.userId} onClose={()=>setPanel(null)} onSaved={saved} crmUsers={data.users}/>}
    </SettingsPage>
  );
}

/* Access — the side panel from a user's ⋯ (and Add user, for someone new: their name and email,
   the sign-in domains, first): their Organization role; their People instance; a Super Admin's
   People instances; the CRM instances they can open, each with their role there — read-only, set in
   that CRM's Users & Teams. Access to the open CRM instance puts them in its Users now (no seat,
   team or preset); another instance's when it's next opened. */
const checkRows = (children) => <div style={{display:'flex', flexDirection:'column', paddingTop:2}}>{children}</div>;
function UserAccessPanel({userId, onClose, onSaved, crmUsers}){
  const reg = useOrg();
  const isNew = !userId;
  const person = isNew ? null : orgUsers().find(u => u.id === userId);
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const start = person || {peopleId:reg.people[0].id, role:'Member', peopleAccess:[], crm:[], ...(EVERYONE_SUPER_ADMIN ? fullAccess() : {})};   // someone new: the defaults
  const [role, setRole] = React.useState(start.role);
  const [peopleId, setPeopleId] = React.useState(peopleInstance(start.peopleId) ? start.peopleId : reg.people[0].id);
  const [peopleAccess, setPeopleAccess] = React.useState(start.peopleAccess || []);
  const [crm, setCrm] = React.useState(start.crm || []);
  const emailTaken = isNew && !!orgUserByEmail(email);
  const ok = isNew ? !!name.trim() && signInAllowed(email) && !emailTaken : !!person;
  // The person's role in a CRM instance: the open one's Users, else that instance's saved store.
  const roleIn = (crmId) => {
    if(!person) return undefined;
    const users = crmId === ACTIVE_CRM.id ? crmUsers : ((((readStore(crmStoreKey(crmId)) || {}).settings || {}).users) || []);
    const u = users.find(x => x.id === person.id || sameEmail(x.email, person.email));
    return u ? (u.preset || 'No preset') : undefined;
  };
  const toggle = (set) => (id) => set(list => list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  const save = () => {
    if(!ok) return;
    const access = role === 'Super Admin' ? [...new Set([peopleId, ...peopleAccess])] : [];
    if(isNew){
      const base = name.trim().toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '') || 'user';
      const id = orgUsers().some(u => u.id === base) ? `${base}-${Date.now().toString(36)}` : base;
      setOrgUsers([...orgUsers(), {id, name:name.trim(), email:email.trim().toLowerCase(), role, peopleId, peopleAccess:access, crm}]);
    } else setOrgUsers(orgUsers().map(u => u.id === person.id ? {...u, role, peopleId, peopleAccess:access, crm} : u));
    onSaved(crm.includes(ACTIVE_CRM.id) ? crmUsersToAdd(crmUsers) : []);
  };
  return (
    <CreatePanelFrame title={isNew ? 'Add user' : 'Access'} onClose={onClose} more={false} placement="fixed" width={480} actions={<>
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
        <Field label="Role"><Select value={role} options={ORG_ROLES.map(r => ({value:r, label:r}))} onChange={v=>v && setRole(v)}/></Field>
        <Field label="People"><Select value={peopleId} options={reg.people.map(p => ({value:p.id, label:p.name}))} onChange={v=>v && setPeopleId(v)}/></Field>
        {role === 'Super Admin' && <Field label="People access">
          {checkRows(reg.people.map(p => (
            <div key={p.id} style={p.id === peopleId ? {pointerEvents:'none'} : undefined}>
              <SettingsCheckRow checked={p.id === peopleId || peopleAccess.includes(p.id)} onToggle={()=>toggle(setPeopleAccess)(p.id)} label={p.name}/>
            </div>
          )))}
        </Field>}
        <Field label="CRM">
          {checkRows(reg.crm.map(c => (
            <SettingsCheckRow key={c.id} checked={crm.includes(c.id)} onToggle={()=>toggle(setCrm)(c.id)} label={c.name} hint={crm.includes(c.id) ? roleIn(c.id) : undefined}/>
          )))}
        </Field>
      </>)}
    </CreatePanelFrame>
  );
}

/* Branches: one page per module (the Branches menu): one line of copy with Add (icon) on its
   right, then a table, the page wide, of the module's branches — name, members (how many of the
   Organization's users have it: a link to Users showing them), created — with ⋯ Rename, or the
   empty state while it has none. Add's side panel asks for a name; a new CRM branch starts empty,
   with the standard record types, when first opened. A new branch goes to everyone for now (else
   to the one adding it: a CRM branch to open, a People branch among a Super Admin's, another
   module's among theirs). CRM and People branches are the registry's `crm` and `people` lists
   (store.jsx); the other modules' are `branches[module]`, and a user's are `branches[module]` on
   them — a user with no list for a module has every branch of it while everyone is a Super Admin. */
const branchesOf = (reg, module) => module === 'crm' || module === 'people' ? reg[module] || [] : (reg.branches || {})[module] || [];
// The user's branches of a module: CRM the ones they can open, People the one they belong to.
const userBranches = (u, module) => module === 'crm' ? u.crm || [] : module === 'people' ? [u.peopleId]
  : (u.branches || {})[module] || (EVERYONE_SUPER_ADMIN ? branchesOf(ORG_REGISTRY, module).map(b => b.id) : []);
const giveBranch = (u, module, id) => module === 'crm' ? {...u, crm:[...new Set([...(u.crm || []), id])]}
  : module === 'people' ? {...u, peopleAccess:[...new Set([...(u.peopleAccess || []), id])]}
  : {...u, branches:{...(u.branches || {}), [module]:[...new Set([...userBranches(u, module), id])]}};
const mtHead = {fontSize:12, fontWeight:500, color:T.attioMuted, whiteSpace:'nowrap'};
const mtRow = {display:'flex', alignItems:'center', gap:12, padding:'0 12px 0 16px', height:T.attioRowH, borderBottom:`1px solid ${T.attioLine}`, fontSize:13, color:T.attioText};
const mtTable = {border:`1px solid ${T.attioLine}`, borderRadius:8, overflow:'hidden'};
const mtHeadRow = {display:'flex', alignItems:'center', gap:12, padding:'0 12px 0 16px', height:36, background:T.headerBg, borderBottom:`1px solid ${T.attioLine}`};
const createdLabel = (iso) => iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}) : '';
function BranchesPage({module, onMembers}){
  const reg = useOrg();
  const [panel, setPanel] = React.useState(null);   // {branch?}: Add, or Rename
  const label = moduleLabel(module);
  const list = branchesOf(reg, module);
  const members = (br) => orgUsers().filter(u => userBranches(u, module).includes(br.id)).length;
  const saveList = (next, patch = {}) => setOrg(module === 'crm' || module === 'people' ? {[module]:next, ...patch} : {branches:{...(reg.branches || {}), [module]:next}, ...patch});
  const save = (name, br) => {
    if(br){ saveList(list.map(x => x.id === br.id ? {...x, name} : x)); setPanel(null); return; }
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'branch';
    const id = `${module}-${slug}-${Date.now().toString(36)}`, me = signedInOrgUser();
    // Who gets the new branch: everyone for now (EVERYONE_SUPER_ADMIN), else the one adding it.
    const gets = (u) => EVERYONE_SUPER_ADMIN || (me && u.id === me.id);
    saveList([...list, {id, name, createdAt:new Date().toISOString().slice(0, 10)}], {users:orgUsers().map(u => gets(u) ? giveBranch(u, module, id) : u)});
    setPanel(null);
  };
  return (<>
    <SettingsPage description={`Each ${label} branch has its own data, users and settings.`}
      actions={<StCta icon="plus" title={`New ${label} branch`} onClick={()=>setPanel({})}/>}>
      {list.length ? (
        <div style={mtTable}>
          <div style={mtHeadRow}><span style={{...mtHead, flex:1}}>Name</span><span style={{...mtHead, width:96}}>Members</span><span style={{...mtHead, width:120}}>Created</span><span style={{width:28}}/></div>
          {list.map(br => (
            <div key={br.id} style={mtRow}>
              <span style={{flex:1, minWidth:0, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{br.name}</span>
              <span style={{width:96, fontVariantNumeric:'tabular-nums'}}>{countLink(members(br), ()=>onMembers(module, br))}</span>
              <span style={{width:120, color:T.attioMuted, whiteSpace:'nowrap'}}>{createdLabel(br.createdAt)}</span>
              <RowActionsMenu title="Branch actions" width={MENU_W} items={[{label:'Rename', onClick:()=>setPanel({branch:br})}]}/>
            </div>
          ))}
        </div>
      ) : <StEmpty title={`No ${label} branches yet`}/>}
    </SettingsPage>
    {panel && <BranchPanel label={label} module={module} branch={panel.branch} others={list} onClose={()=>setPanel(null)} onSave={save}/>}
  </>);
}
// Add / Rename: the branch's name (unique within its module).
const BRANCH_NAME_HINTS = {crm:'e.g. Canada', people:'e.g. Karachi'};
function BranchPanel({label, module, branch, others, onClose, onSave}){
  const [name, setName] = React.useState(branch ? branch.name : '');
  const taken = others.some(x => (!branch || x.id !== branch.id) && x.name.trim().toLowerCase() === name.trim().toLowerCase());
  const ok = !!name.trim() && !taken && (!branch || name.trim() !== branch.name);
  return (
    <CreatePanelFrame title={branch ? `Rename ${label} branch` : `New ${label} branch`} onClose={onClose} more={false} placement="fixed" width={480} actions={<>
      <StSecondary label="Cancel" onClick={onClose}/>
      <StCta label={branch ? 'Save changes' : 'Add branch'} disabled={!ok} onClick={()=>onSave(name.trim(), branch)}/>
    </>}>
      {stack(<Field label="Name">
        <input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder={BRANCH_NAME_HINTS[module] || 'e.g. Dubai'} style={{...fieldText, borderColor: taken ? T.red : undefined}}/>
        {taken && <div style={{fontSize:12, color:T.red, marginTop:4}}>A branch with this name already exists.</div>}
      </Field>)}
    </CreatePanelFrame>
  );
}

/* ── Sign-in ── the first screen, on the workflow canvas's dotted ground. */
const GOOGLE_COLORS = ['#4285F4', '#EA4335', '#FBBC05', '#34A853'];
function LoginScreen(){
  const [step, setStep] = React.useState('start');   // start | google
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState('');
  const known = (ORG_REGISTRY.accounts || []).filter(signInAllowed);
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
   Organization's brand (every CRM instance's); CRM administrators edit, everyone else sees them. */
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

/* Logo: the uploaded company logo, or the HOF lockup until one is uploaded; Replace and Remove
   (back to the lockup). */
function BrandLogoSection({brand, admin, toast, setActions}){
  const saved = brand.logo || null;
  const [draft, setDraft] = React.useState(saved);
  const [error, setError] = React.useState('');
  const input = React.useRef(null);
  const dirty = draft !== saved;
  const pick = (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if(!f) return;
    readImageFile(f).then(url => { setError(''); setDraft(url); }).catch(err => setError(err.message)); };
  React.useEffect(() => setActions(<BrandActions admin={admin} dirty={dirty} onCancel={()=>setDraft(saved)}
    onSave={()=>{ updateBrand({logo:draft}); toast('Logo saved'); }}/>), [draft, saved, admin]);
  return brandRow('Company logo', (
    <div style={{display:'flex', flexDirection:'column', gap:10}}>
      <div style={{width:260, height:104, borderRadius:10, border:`1px dashed ${T.borderStrong}`, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', padding:12}}>
        {draft ? <img src={draft} alt="Company logo" style={{maxWidth:'100%', maxHeight:'100%', objectFit:'contain'}}/> : <Logo variant="main" height={30}/>}
      </div>
      {admin && <div style={{display:'flex', alignItems:'center', gap:10}}>
        <input ref={input} type="file" accept="image/*" onChange={pick} style={{display:'none'}}/>
        <StSecondary label="Replace" onClick={()=>input.current && input.current.click()}/>
        {draft && <StTextAction label="Remove" onClick={()=>setDraft(null)}/>}
      </div>}
      {error && <div style={{fontSize:12, color:T.red}}>{error}</div>}
    </div>
  ));
}

/* Color System: any number of named brand colours — Add Color, rename, recolour, delete. The
   first two also stand in for the primary and secondary colours the rest of the ERP reads
   (the brand's mark, quotations), so those keep working. */
const brandPalette = (brand) => Array.isArray(brand.palette) ? brand.palette : (() => {
  const c = {...DEFAULT_BRAND(), ...(brand.colors || {})};
  return [{id:'bc-primary', name:'Primary', value:c.primary}, {id:'bc-secondary', name:'Secondary', value:c.secondary}];
})();
const colorsFromPalette = (palette) => {
  const d = DEFAULT_BRAND(), ok = palette.filter(c => validHex(c.value));
  return {primary: ok[0] ? ok[0].value : d.primary, secondary: (ok[1] || ok[0] || {}).value || d.secondary};
};
function BrandColorsSection({brand, admin, toast, setActions}){
  const saved = brandPalette(brand);
  const [draft, setDraft] = React.useState(saved);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const valid = draft.every(c => c.name.trim() && validHex(c.value));
  const set = (id, p) => setDraft(list => list.map(c => c.id === id ? {...c, ...p} : c));
  const add = () => setDraft(list => [...list, {id:`bc-${Date.now().toString(36)}`, name:'', value:'#000000'}]);
  React.useEffect(() => setActions(<BrandActions admin={admin} dirty={dirty} valid={valid} onCancel={()=>setDraft(saved)}
    onSave={()=>{ const palette = draft.map(c => ({...c, name:c.name.trim()})); updateBrand({palette, colors:colorsFromPalette(palette)}); toast('Colors saved'); }}/>),
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

/* The company logo, as set in Logo: the uploaded one, else the HOF lockup. */
function BrandLogoMark({brand, height = 28}){
  if(brand.logo) return <img src={brand.logo} alt="" style={{display:'block', height, maxWidth:height * 5, objectFit:'contain'}}/>;
  return <Logo variant="main" height={height * .7}/>;
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
function useBrandDraft({brand, admin, toast, setActions, key, blank, label, valid = () => true}){
  const saved = {...blank, ...(brand[key] && !brand[key].dataUrl ? brand[key] : {})};
  const [draft, setDraft] = React.useState(saved);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  React.useEffect(() => setActions(<BrandActions admin={admin} dirty={dirty} valid={valid(draft)} onCancel={()=>setDraft(saved)}
    onSave={()=>{ updateBrand({[key]:Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]))}); toast(`${label} saved`); }}/>),
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
function EmailSignatureBlock({sig, brand}){
  const line = {fontSize:13, color:T.attioText, lineHeight:1.5};
  const contact = [sig.email, sig.phone, sig.website].filter(Boolean);
  const logo = sig.includeLogo;
  return (
    <div style={{display:'flex', gap:16, alignItems:'center'}}>
      {logo && <div style={{flexShrink:0}}><BrandLogoMark brand={brand} height={40}/></div>}
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
  const {brand, admin} = props;
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
          <EmailSignatureBlock sig={sig} brand={brand}/>
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
  const {brand, admin} = props;
  const [lh, set] = useBrandDraft({...props, key:'letterhead', blank:{companyName:brand.name, address:'', phone:'', email:'', website:'', footer:''}, label:'Letterhead',
    valid:(d) => !!d.companyName.trim() && brandEmailOk(d.email)});
  const accent = colorsFromPalette(brandPalette(brand)).primary;
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
            <BrandLogoMark brand={brand} height={32}/>
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
  useOrg();
  const brand = orgBrand();
  const admin = isCrmAdmin();
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
        <Section key={section} brand={brand} admin={admin} toast={toast} setActions={setActions}/>
        {!admin && <div style={{...stTextB, marginTop:12}}>Only CRM administrators can change the brand.</div>}
      </div>
      <CopyToast message={message}/>
    </SettingsPage>
  );
}

Object.assign(window, {useOrg, setOrg, updateOrg, updateBrand, orgUsers, orgUserByEmail, signedInOrgUser, isOrgAdmin, isCrmAdmin, instanceName, peopleInstance,
  myCrmInstances, myPeopleInstances, peopleInstancesOf, activePeople, crmRedirect, setOrgUsers, joinOrganization, leaveCrm, syncOrgUsers, crmUsersToAdd, allEmployees, hasEmployeeStores, saveEmployees,
  WORKSPACE_TEMPLATES, crmTemplate, LEAD_OUTCOMES, ErpSettingsScreen, OrganizationSettingsPage, ErpUsersPage, UserAccessPanel, BranchesPage, BranchPanel,
  ALLOWED_EMAIL_DOMAINS, signInAllowed, signOut, MarkTile, OrgLockup, BrandLockup, SwitcherMenu, PeopleSwitcher, CrmSwitcher, LoginScreen, BrandPage, LogoField, readImageFile});
