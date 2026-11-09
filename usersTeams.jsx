/* HOF Pulse ERP — Settings → Users & Teams, and the Edit Permissions drawer.

   Follows the established Figma reference (HOF CRM Redesign → Claude Feeder → Design):
     Users & Teams  — node 40:36842 (Save View open: 140:1977). Title + Add user; tabs Users /
                      Seats / Teams / Permission Presets; status pills that filter the table
                      (Active Users / Pending / Bounced Invites / Deactivated Users); All Views,
                      Save View, Export, table settings; search + Filters; the Users table
                      (User, Seat, Team, Permission Preset, Last Active, Created, Actions) and
                      pagination.
     Edit Permissions — node 64:4132, a drawer opened from a row: Select Seat, Choose how to
                      access (Manually assign permission / Make super Admin), Choose a Permission
                      Preset, and the two-pane permission editor (category list on the left
                      swaps the right-hand content — not a scroll anchor). Cancel / Save.

   The Users tab is built on the Contacts design system (UsersModule): the four statuses are
   default views in the Contacts view system, with its View Settings, Save View, Filters, Table
   Settings and grid. Edit Permissions (row ⋯) writes the seat, preset and permissions back to
   the user. Edit User (row ⋯) opens the Edit User panel, as Edit contact: the User Properties,
   saved with Save changes, and Edit User in HRMS (placeholder until HRMS exists). A
   user's name opens their profile panel: the same properties, then their statistics. Not
   defined yet (placeholder): Export, and the Seats, Teams and Permission Presets tabs.
   Edit Permissions follows the seat model (SEAT_TYPES): seat first (with remaining seats), then
   the seat's access options, then — for manual access — the preset and the permission editor
   (PERMISSION_CATEGORIES). */

/* User status (a select property) and the default views built on it — the Contacts view
   system: each view is a saved filter on Status, managed like any Contacts view. */
const USER_STATUSES = ['Activated', 'Deactivated'];
const USER_DEFAULT_VIEWS = [
  {id:'uv-activated',   name:'Activated Users',   status:'Activated'},
  {id:'uv-deactivated', name:'Deactivated Users', status:'Deactivated'},
];
/* Seat types (product definition, for now): Full Seat and View Seat. The seat is the first
   choice when setting up a user's permissions and decides which permissions can be granted at
   all; within a seat, what the user can actually do comes from their Permission Preset (and any
   changes to its matrix). Availability is what's left — the total minus the seats held by
   activated users (deactivated users hold none). Full Seats are the former Core and Sales
   Professional seats (4 + 60). */
const SUPER_ADMIN = 'Super Admin';
const SEAT_TYPES = [
  {key:'Full Seat', total:64, description:'Full access, shaped by the Permission Preset.',
   manualTitle:'Manually assign permission', manualDescription:'Customise access based on current permissions',
   allTitle:'Make super Admin', allDescription:'Super admin has all permissions', allPreset:SUPER_ADMIN,
   contactStandard:['create', 'view', 'edit', 'delete', 'merge'], contactAdmin:['assign', 'createAssociated'], extended:'all'},   // what the seat can grant, on every Object
  {key:'View Seat', total:Infinity, description:'Restricted, view-only access.',
   manualTitle:'Manually assign view permissions', manualDescription:'Choose view access on records and tools below',
   allTitle:'Grant all view permissions', allDescription:'View access to every record and tool', allPreset:'Viewer',
   contactStandard:['view'], contactAdmin:[], extended:'view'},
];
const USER_SEATS = SEAT_TYPES.map(st => st.key);
const seatDef = (key) => SEAT_TYPES.find(st => st.key === key) || SEAT_TYPES[0];
const SEAT_HOLDING_STATUSES = ['Activated'];
const SEAT_PREFIX = {'Full Seat':'F', 'View Seat':'V'};

/* Seats are records (seat ID, type, assignee) — the one source of truth for who holds which
   seat; a user's seat type in Users is read from here. Full Seats have a fixed count, so their
   unassigned seats always exist; View Seats are unlimited, so a View Seat is created when
   someone is given one. Availability = unassigned seats of the type (plus the user's own, when
   asking for the user being edited). */
const seatOfUser = (seats, uid) => seats.find(st => st.assigneeId === uid) || null;
const seatsAvailable = (seats, type, exceptId) => {
  if(seatDef(type).total === Infinity) return Infinity;
  return seats.filter(st => st.type === type && (!st.assigneeId || st.assigneeId === exceptId)).length;
};
/* Put a user on a seat: a given seat, or the first free one of the type (a new one for View Seats).
   Their previous seat becomes unassigned; the seat's previous holder is left without a seat. */
const assignSeat = (seats, uid, type, seatId) => {
  let next = seats.map(st => st.assigneeId === uid ? {...st, assigneeId:null} : st);
  let target = seatId ? next.find(st => st.id === seatId) : next.find(st => st.type === type && !st.assigneeId);
  if(!target && seatDef(type).total === Infinity){
    const n = next.filter(st => st.type === type).length + 1;
    target = {id:`${SEAT_PREFIX[type]}${n}`, type, assigneeId:null};
    next = [...next, target];
  }
  if(!target) return seats;
  return next.map(st => st.id === target.id ? {...st, assigneeId:uid} : st);
};
const availableLabel = (n) => n === Infinity ? 'Unlimited' : `${Math.max(0, n)} available`;
const PERMISSION_PRESETS = [SUPER_ADMIN, 'Admin', 'Team Lead', 'Sales Professional', 'Case Manager', 'Petition Writer', 'Compliance', 'Viewer'];

/* Permission categories (left list), each with its horizontal tabs:
     Records                     — Contacts / Deals / Customers: what's done on records (their
                                   tools — Calls, Call Logs, Meetings, Notes, Tasks, Files, Quotes —
                                   and Accounting: Payment Terms, by the record's owner), and under
                                   Edit: moving between stages, which property values may be edited.
     Customer Profile Properties — which Customer Profile answers may be edited, on every record.
     Templates                   — Email Templates, Email Sequences, Quote Templates, Playbooks,
                                   Services, Customer Profile templates (by who created each).
     Workflows                   — View, Create, Edit, Delete, Revert — on / off, every workflow.
     Settings & Administration   — Settings → Records, Properties and Pipelines (by creator),
                                   Tools Settings, Company Defaults, Users & Teams and Permission
                                   Management (Their Team / All users). */
const PERMISSION_CATEGORIES = ['Records', 'Customer Profile Properties', 'Templates', 'Workflows', 'Settings & Administration'];
const PERMISSION_TEMPLATES = [
  {key:'emailTemplates', tab:'Email Templates', noun:'Email Template', plural:'Email Templates'},
  {key:'emailSequences', tab:'Email Sequences', noun:'Email Sequence', plural:'Email Sequences'},
  {key:'quoteTemplates', tab:'Quote Templates', noun:'Quote Template', plural:'Quote Templates'},
  {key:'playbooks',      tab:'Playbooks',       noun:'Playbook',       plural:'Playbooks'},
  {key:'services',       tab:'Services',        noun:'Service',        plural:'Services'},
  // Customer Profile templates (Settings → Customer Profile forms): Create, Edit form fields, Delete.
  {key:'profileForms',   tab:'Customer Profile', noun:'Customer Profile Template', plural:'Customer Profile Templates', rows:['create', 'edit', 'delete']},
];
const ADMIN_TABS = ['Records', 'Properties', 'Pipelines', 'Tools Settings', 'Company Defaults', 'Users & Teams', 'Goals', 'Permission Management'];
const PERMISSION_TABS = {
  // The workspace's record types, by their names (HOF Partners: Leads, Customers).
  get Records(){ return PERMISSION_OBJECTS.filter(o => workspaceHasType(o.key)).map(o => o.tab); },
  Templates: PERMISSION_TEMPLATES.map(t => t.tab),
  'Settings & Administration': ADMIN_TABS,
};
// Tools Settings (Settings → Tools): connecting each tool.
const ADMIN_TOOL_SETTINGS = [{key:'email', label:'Email'}, {key:'calls', label:'Calls'}, {key:'meetings', label:'Meetings'}, {key:'calendar', label:'Calendar'}, {key:'tasks', label:'Tasks'}];
const ADMIN_RECORD_OBJECTS = ['contacts', 'deals', 'customers'];
/* ── Object permissions ── per Object (Contacts, Deals; Customers later), one shape:
     {enabled, create:{on}, view|edit|delete|merge|assign|createAssociated:{on, scope, life}}
   Standard permissions: Create (on / off), then View, Edit, Delete and Merge. Administrative
   (Full Seats only): Assign <Object> Owner and Create Associated Object. A scoped permission has a
   Type — Their <records>, Their Team <records>, All <records> — and, for Their / Their Team, a
   Permission Life: until the record is reassigned (the permission goes with the owner), or until
   the record is removed (it stays after the record is reassigned to someone else). All <records>
   needs no Permission Life (`life` null). */
const permissionObject = (key, one, many) => ({key, get tab(){ return typePlural(key, many); }, get noun(){ return typeSingular(key, one); }, get plural(){ return typePlural(key, many); }});
const PERMISSION_OBJECTS = [permissionObject('contacts', 'Contact', 'Contacts'), permissionObject('deals', 'Deal', 'Deals'), permissionObject('customers', 'Customer', 'Customers')];
/* Tools, per Object: the activity a record carries. Each its own table — Create, View, Edit,
   Delete (Calls: Create only — placing a call; the calls themselves are Call Logs). Type and
   Permission Life go by the record the activity is on (its owner). The Tools switch turns every
   tool off for the Object; the tools' own settings stay, and come back when it's on again. */
const PERMISSION_TOOLS = [
  {key:'calls',    label:'Calls', createOnly:true},
  {key:'callLogs', label:'Call Logs'},
  {key:'meetings', label:'Meetings'},
  {key:'notes',    label:'Notes'},
  {key:'tasks',    label:'Tasks'},
  {key:'files',    label:'Files'},
  {key:'quotes',   label:'Quotes'},
];
const TOOL_ACTIONS = [
  {key:'create', label:() => 'Create', unscoped:true},
  {key:'view',   label:() => 'View'},
  {key:'edit',   label:() => 'Edit'},
  {key:'delete', label:() => 'Delete'},
];
const toolActionsOf = (tool) => tool.createOnly ? TOOL_ACTIONS.filter(a => a.unscoped) : TOOL_ACTIONS;
const permissionObjectOf = (tab) => PERMISSION_OBJECTS.find(o => o.tab === tab) || null;
const PERMISSION_SCOPES = ['own', 'team', 'all'];
const scopeLabel = (obj, sc) => sc === 'own' ? `Their ${obj.plural}` : sc === 'team' ? `Their Team ${obj.plural}` : `All ${obj.plural}`;
const PERMISSION_LIVES = ['reassigned', 'removed'];
const lifeLabel = (obj, l) => l === 'reassigned' ? `Until the ${obj.noun} Is Reassigned` : `Until the ${obj.noun} Is Removed`;
const STANDARD_PERMISSIONS = [
  {key:'create', label:() => 'Create', unscoped:true},
  {key:'view',   label:() => 'View'},
  {key:'edit',   label:() => 'Edit'},
  {key:'delete', label:() => 'Delete'},
  {key:'merge',  label:() => 'Merge'},
];
const ADMIN_PERMISSIONS = [
  {key:'assign',           label:(obj) => `Assign ${obj.noun} Owner`},
  {key:'createAssociated', label:() => 'Create Associated Record'},
];
const SCOPED_PERMISSION_KEYS = [...STANDARD_PERMISSIONS.filter(a => !a.unscoped), ...ADMIN_PERMISSIONS].map(a => a.key);
// A scoped permission, always complete: on, a Type, and a Permission Life only where it applies.
const scopedPermission = (on, scope = 'own', life = 'reassigned') => ({on:!!on, scope, life: scope === 'all' ? null : (life || 'reassigned')});
const objectPermissions = ({create = false, view = null, edit = null, del = null, merge = null, assign = null, createAssociated = null, life = 'reassigned'} = {}) => ({
  enabled:true, create:{on:!!create},
  view:scopedPermission(!!view, view || 'own', life), edit:scopedPermission(!!edit, edit || 'own', life),
  delete:scopedPermission(!!del, del || 'own', life), merge:scopedPermission(!!merge, merge || 'own', life),
  assign:scopedPermission(!!assign, assign || 'own', life), createAssociated:scopedPermission(!!createAssociated, createAssociated || 'own', life),
});
// The permissions for every defined Object; Deals start as a copy of Contacts (a decision: mirror).
// Records only — the rest is filled in by the holder's level when loaded (normalizePermissions).
const recordsOnly = (m) => ({contacts:m.contacts, deals:m.deals, customers:m.customers});
const permissionMatrix = (contacts, level = 'view') => normalizePermissions({contacts}, level);   // Deals and Customers mirror Contacts
const DEFAULT_CONTACT_PERMISSIONS = () => recordsOnly(permissionMatrix(objectPermissions({create:true, view:'own', edit:'own', del:'own', merge:'own', assign:'all', createAssociated:'all'})));
/* Permissions saved before (Contacts only, flat): scope names → Type, "also for contacts assigned
   to someone else in the future" → Until the <record> Is Removed, None → off; the on / off admin
   actions become All <records> (they had no scope). Deals mirror Contacts when missing. */
const OLD_SCOPES = {'Their Contacts':'own', "Their Team's Contacts":'team', 'All Contacts':'all'};
function normalizeObjectPermissions(o){
  if(!o) return null;
  const fromOld = (v) => typeof v === 'boolean' ? scopedPermission(v, 'all') : v && 'future' in v
    ? scopedPermission(OLD_SCOPES[v.scope] !== undefined, OLD_SCOPES[v.scope] || 'own', v.future ? 'removed' : 'reassigned')
    : v ? scopedPermission(v.on, v.scope || 'own', v.life) : scopedPermission(false);
  const std = {enabled:o.enabled !== false, create:{on: typeof o.create === 'boolean' ? o.create : !!(o.create && o.create.on)},
    ...Object.fromEntries(SCOPED_PERMISSION_KEYS.map(k => [k, fromOld(o[k])]))};
  return {...std, tools:normalizeToolPermissions(o.tools, std), accounting:normalizeAccountingPermissions(o.accounting, std)};
}
/* Payment Terms (the record's Accounting tab), per Object: Create, View, Edit, Delete — by the
   record's owner, as the Object's own. None saved yet → mirroring the Object's (as Payment Terms
   followed the record's Edit before). Without View the record's payment terms and every
   accounting figure from them (Accounting properties, cash KPIs and statistics) don't show. */
function normalizeAccountingPermissions(a, std){
  const scoped = (v, fallback) => v ? scopedPermission(v.on, v.scope || 'own', v.life) : scopedPermission(fallback.on, fallback.scope, fallback.life);
  const cur = a || {};
  return {create:{on: cur.create ? !!cur.create.on : std.edit.on}, view:scoped(cur.view, std.view), edit:scoped(cur.edit, std.edit), delete:scoped(cur.delete, std.edit)};
}
/* An Object's Tools: saved ones as they are; none yet → mirroring the Object's own Create / View /
   Edit / Delete (Tools on). Calls: Create only. */
function normalizeToolPermissions(t, std){
  const scoped = (v, fallback) => v ? scopedPermission(v.on, v.scope || 'own', v.life) : scopedPermission(fallback.on, fallback.scope, fallback.life);
  return {enabled: t ? t.enabled !== false : true,
    ...Object.fromEntries(PERMISSION_TOOLS.map(tool => {
      const cur = (t || {})[tool.key] || {};
      const create = {on: cur.create ? !!cur.create.on : std.create.on};
      return [tool.key, tool.createOnly ? {create} : {create, view:scoped(cur.view, std.view), edit:scoped(cur.edit, std.edit), delete:scoped(cur.delete, std.delete)}];
    }))};
}
/* ── Beyond Records ── one shape for everything with Create / View / Edit / Delete: Create on /
   off; the others with a Type (by owner — the record's for Customer Profile, the creator's for
   Templates, Workflows, Settings → Records, Properties and Pipelines (these two per record type)
   and Customer Profile forms). Tools Settings, Company Defaults and Goals (View / Edit) are on / off. Users & Teams and Permission
   Management go by the user's team: Their Team Users or All Users. `level`: what a matrix saved
   before these existed starts with — 'all' (Super Admin, Admin), else 'view' (View on Customer
   Profile, Templates and Workflows; nothing in Settings & Administration). */
const flag = (on) => ({on:!!on});
const crud = (on, viewOn = on) => ({create:flag(on), view:scopedPermission(viewOn, 'all'), edit:scopedPermission(on, 'all'), delete:scopedPermission(on, 'all')});
function extendedPermissions(level){
  const all = level === 'all', view = all || level === 'view';
  const perObject = (f) => Object.fromEntries(ADMIN_RECORD_OBJECTS.map(o => [o, f(o)]));
  return {
    // Customer Profile Properties: which answers may be edited, on every record — 'all' or ['<form>:<field>'].
    profileProps: 'all',
    templates: Object.fromEntries(PERMISSION_TEMPLATES.map(t => [t.key, crud(all, view)])),
    // Workflows: on / off for every workflow (not by who created it); Revert restores an earlier version.
    workflows: {view:flag(view), create:flag(all), edit:flag(all), delete:flag(all), revert:flag(all)},
    admin: {
      records: crud(all),
      properties: perObject(() => ({add:flag(all), edit:scopedPermission(all, 'all'), delete:scopedPermission(all, 'all')})),
      pipelines: perObject(() => crud(all)),
      tools: Object.fromEntries(ADMIN_TOOL_SETTINGS.map(t => [t.key, flag(all)])),
      defaults: {edit:flag(all)},
      users: {add:flag(all), edit:scopedPermission(all, 'all'), deactivate:scopedPermission(all, 'all'), delete:scopedPermission(all, 'all')},
      goals: {view:flag(all), edit:flag(all)},
      permissions: {edit:scopedPermission(all, 'all'), assign:scopedPermission(all, 'all')},
    },
  };
}
const ADMIN_LEVEL_PRESETS = [SUPER_ADMIN, 'Admin'];
const levelOfPreset = (name) => ADMIN_LEVEL_PRESETS.includes(name) ? 'all' : 'view';
// Saved sections kept as they are; a missing one (or part) from `base` — the level's defaults.
const fillFrom = (base, saved) => {
  if(saved == null) return base;
  if(Array.isArray(base) || typeof base !== 'object' || base === null || typeof saved !== 'object' || Array.isArray(saved)) return saved;
  return Object.fromEntries([...new Set([...Object.keys(base), ...Object.keys(saved)])].map(k => [k, fillFrom(base[k], saved[k])]));
};
/* Records → Edit: moving between pipeline stages (on unless switched off), and which property
   values may be edited — 'all' or a list of property keys. */
const withEditOptions = (o) => o && ({...o, editStages: o.editStages !== false, editProps: Array.isArray(o.editProps) ? o.editProps : 'all'});
/* Settings & Administration saved in the earlier shape — Records per record type, a property list,
   Pipelines on / off — take the Type shape: on wherever it was on anywhere, for All. */
const scopedFromOld = (v) => v && typeof v === 'object' && 'scope' in v ? v : scopedPermission(v === 'all' || (Array.isArray(v) && v.length > 0) || !!(v && v.on), 'all');
function migrateAdmin(a){
  if(!a) return a;
  const out = {...a};
  if(a.records && !a.records.view){
    const objs = ADMIN_RECORD_OBJECTS.map(o => a.records[o] || {});
    const any = (k) => objs.some(o => o[k] && o[k].on);
    out.records = {create:a.records.create || flag(false), view:scopedPermission(any('view'), 'all'), edit:scopedPermission(any('edit'), 'all'), delete:scopedPermission(any('delete'), 'all')};
  }
  if(a.properties) out.properties = Object.fromEntries(Object.entries(a.properties).map(([o, v]) => [o, {add:v.add || flag(false), edit:scopedFromOld(v.edit), delete:scopedFromOld(v.delete)}]));
  if(a.pipelines) out.pipelines = Object.fromEntries(Object.entries(a.pipelines).map(([o, v]) => [o, {create:v.create || flag(false), view:scopedFromOld(v.view), edit:scopedFromOld(v.edit), delete:scopedFromOld(v.delete)}]));
  return out;
}
function normalizePermissions(p, level = 'view'){
  const base = extendedPermissions(level);
  if(!p) return {...DEFAULT_CONTACT_PERMISSIONS(), ...base};
  const contacts = withEditOptions(normalizeObjectPermissions(p.contacts || p));
  // Deals and Customers mirror Contacts until they're set.
  const copy = () => JSON.parse(JSON.stringify(contacts));
  return {contacts, deals: p.deals ? withEditOptions(normalizeObjectPermissions(p.deals)) : copy(), customers: p.customers ? withEditOptions(normalizeObjectPermissions(p.customers)) : copy(),
    profileProps: Array.isArray(p.profileProps) ? p.profileProps : 'all',
    // Customer Profile forms moved from Settings & Administration to Templates.
    templates:fillFrom(base.templates, {...(p.admin && p.admin.profileForms && !(p.templates || {}).profileForms ? {profileForms:p.admin.profileForms} : {}), ...(p.templates || {})}),
    workflows:fillFrom(base.workflows, p.workflows && !('revert' in p.workflows) ? {...p.workflows, revert:{on:!!(p.workflows.edit || {}).on}} : p.workflows),
    admin:(({profileForms, ...rest}) => rest)(fillFrom(base.admin, migrateAdmin(p.admin)))};
}

// The record a page is showing, for its permission checks: {object, record} (ContactDetail, DealDetail).
const RecordAccessCtx = React.createContext(null);
const useRecordAccess = () => React.useContext(RecordAccessCtx);

/* ── Access: what the acting user (the signed-in user) may do ──
   App registers the acting user, the users (for teams) and each record's owner history. A tool
   permission on a record: off when the Object or its Tools are off; Create needs only to be on;
   View / Edit / Delete by Type — All; Their (the record's owner is the user); Their Team (the
   owner is in the user's team) — and Permission Life: Until the <record> Is Reassigned counts
   the current owner only; Until the <record> Is Removed also counts its earlier owners. No acting
   user (nothing registered): everything is allowed. */
let ACCESS = {user:null, perms:null, users:[], history:() => []};
const setAccessContext = ({user, users, history, data}) => { ACCESS = {user, data, users:users || [], history:history || (() => []), perms:user ? normalizePermissions(user.permissions, levelOfPreset(user.preset)) : null}; };
const accessUser = () => ACCESS.user;
function recordOwners(object, record, withHistory){
  const owner = userIdOf(record.ownerId || record.owner, ACCESS.users);
  if(!withHistory) return [owner].filter(Boolean);
  const past = (ACCESS.history(object, record.id) || []).filter(a => a.type === 'ownerChange').flatMap(a => [a.from, a.to]).map(v => userIdOf(v, ACCESS.users));
  return [...new Set([owner, ...past].filter(Boolean))];
}
function permissionCovers(p, object, record){
  const u = ACCESS.user;
  if(!p || !p.on) return false;
  if(p.scope === 'all') return true;
  const owners = recordOwners(object, record, p.life === 'removed');
  if(p.scope === 'own') return owners.includes(u.id);
  const team = (id) => (ACCESS.users.find(x => x.id === id) || {}).teamId;
  return !!u.teamId && owners.some(o => team(o) === u.teamId);
}
function toolCan(object, record, tool, action){
  if(!ACCESS.user || !record) return true;
  const o = ACCESS.perms && ACCESS.perms[object];
  if(!o || !o.enabled || !o.tools || !o.tools.enabled) return false;
  const p = (o.tools[tool] || {})[action];
  if(!p) return false;
  return action === 'create' ? !!p.on : permissionCovers(p, object, record);
}
/* ── Access beyond tools ── each check: no acting user (nothing registered) → allowed. Create needs
   only to be on; a check without the item ("may they view any?") needs only the permission on;
   with the item, its Type is checked against its owner — the record's owner, or the item's
   creator (`createdBy`, a user's name or ID; "System" and nobody count as no one's, so only All
   covers them). Creator-owned items aren't reassigned, so their Permission Life doesn't apply. */
const ACCESS_ON = () => !!(ACCESS.user && ACCESS.perms);
/* Who created an item — a user's name. Items from before creators were recorded (and the shipped
   ones, "System") are the workspace creator's: who created the workspace, else its first Super Admin. */
function workspaceCreatorName(){
  const users = ACCESS.users && ACCESS.users.length ? ACCESS.users : USER_DIRECTORY;
  const ws = typeof workspaceBrand === 'function' ? workspaceBrand() : {};
  const byEmail = ws.createdBy && users.find(u => String(u.email || '').toLowerCase() === String(ws.createdBy).toLowerCase());
  return (byEmail || users.find(u => u.preset === SUPER_ADMIN) || {}).name || '';
}
const creatorOf = (item) => item && item.createdBy && item.createdBy !== 'System' ? (userLabel(item.createdBy) || item.createdBy) : workspaceCreatorName();
const ownedCan = (p, object, owner, action, life) => {
  if(!p) return false;
  if(action === 'create' || owner === undefined) return !!p.on;
  return permissionCovers(life ? p : {...p, life:'reassigned'}, object, {owner:owner || ''});
};
// Records → Edit: moving between stages, and editing a property's value.
const stageMoveCan = (object, record) => !ACCESS_ON() || (recordEditable(object, record) && (ACCESS.perms[object] || {}).editStages !== false);
const propValueCan = (object, record, key) => {
  if(!ACCESS_ON()) return true;
  if(!recordEditable(object, record)) return false;
  const list = (ACCESS.perms[object] || {}).editProps;
  return !Array.isArray(list) || list.includes(key);
};
// A property's value as a stage: a pipeline / stage property, or the property a pipeline follows (a contact's Types of Contact).
const isStageProperty = (object, p) => !!p && (['Pipeline', 'Pipeline stage'].includes(propertyTypeId(p.type))
  || objectPipelines((ACCESS.data || {}), object).some(pl => pl.source === 'property' && pl.propertyKey === p.key));
// The field may be edited on this record (its edit form, its side panel): a stage, or a property's value.
const fieldEditCan = (object, record, p) => !ACCESS_ON() || !record ? true : isStageProperty(object, p) ? stageMoveCan(object, record) : propValueCan(object, record, p.key);
// The property is among those whose values may be edited (bulk edit: whatever the record).
const propKeyCan = (object, key) => { if(!ACCESS_ON()) return true; const list = (ACCESS.perms[object] || {}).editProps; return !Array.isArray(list) || list.includes(key); };
// Payment Terms on a record (Records → <Object> → Payment Terms), by the record's owner.
const paymentTermsCan = (action, object, record) => {
  if(!ACCESS_ON()) return true;
  const o = ACCESS.perms[object];
  const p = o && o.enabled && o.accounting && o.accounting[action];
  if(!p) return false;
  return action === 'create' || !record ? !!p.on : permissionCovers(p, object, record);
};
// May see accounting figures at all (any record): cash KPIs and statistics show only then.
const accountingViewAny = () => !ACCESS_ON() || ADMIN_RECORD_OBJECTS.filter(workspaceHasType).some(o => paymentTermsCan('view', o));
/* Customer Profile Properties — universal, on every record: an answer may be edited (given,
   changed or cleared) when its property is allowed ('all', or '<form>:<field>' in the list). */
const profilePropCan = (formId, fieldId) => { if(!ACCESS_ON()) return true; const l = ACCESS.perms.profileProps; return !Array.isArray(l) || l.includes(`${formId}:${fieldId}`); };
const profilePropsAll = () => !ACCESS_ON() || !Array.isArray(ACCESS.perms.profileProps);
const profileEditAny = () => { if(!ACCESS_ON()) return true; const l = ACCESS.perms.profileProps; return !Array.isArray(l) || l.length > 0; };
// Templates (`kind`: emailTemplates, emailSequences, quoteTemplates, playbooks, services) and Workflows, by creator.
const templateCan = (kind, action, item) => !ACCESS_ON() || ownedCan(((ACCESS.perms.templates || {})[kind] || {})[action], kind, item ? creatorOf(item) : undefined, action);
const workflowCan = (action) => !ACCESS_ON() || !!((ACCESS.perms.workflows || {})[action] || {}).on;
// Settings & Administration.
const adminOf = () => ACCESS.perms.admin || {};
// Settings → Records (`obj`: a record type), Properties and Pipelines (per record type), by who created each item.
const adminRecordsCan = (action, obj) => !ACCESS_ON() || ownedCan((adminOf().records || {})[action], 'recordTypes', obj ? creatorOf(obj) : undefined, action);
const adminPropertyCan = (object, action, prop) => !ACCESS_ON() || ownedCan(((adminOf().properties || {})[object] || {})[action === 'add' ? 'add' : action], 'properties', prop ? creatorOf(prop) : undefined, action === 'add' ? 'create' : action);
const pipelineAdminCan = (object, action, pipeline) => !ACCESS_ON() || ownedCan(((adminOf().pipelines || {})[object] || {})[action], 'pipelines', pipeline ? creatorOf(pipeline) : undefined, action);
// Customer Profile templates (Templates → Customer Profile): Create, Edit form fields, Delete — by creator; anyone may view them.
const profileFormCan = (action, form) => action === 'view' || templateCan('profileForms', action, form);
const toolSettingCan = (tool) => !ACCESS_ON() || !!((adminOf().tools || {})[tool] || {}).on;
const defaultsCan = () => !ACCESS_ON() || !!((adminOf().defaults || {}).edit || {}).on;
// Settings → Goals (goals.jsx): View (the page shows) and Edit (targets can be set).
const goalsCan = (action) => !ACCESS_ON() || !!((adminOf().goals || {})[action] || {}).on;
// Users & Teams, Permission Management: Their Team Users (the user is in the actor's team) or All Users.
const userAdminCan = (section, action, target) => {
  if(!ACCESS_ON()) return true;
  const p = ((adminOf()[section] || {})[action]);
  if(!p || !p.on) return false;
  if(!target || action === 'add' || p.scope === 'all') return true;
  return !!ACCESS.user.teamId && target.teamId === ACCESS.user.teamId;
};

// Which tool an activity belongs to (emails, owner changes and workflow entries aren't tools).
const ACTIVITY_TOOL = {call:'callLogs', meeting:'meetings', note:'notes', task:'tasks', file:'files', fileChange:'files', quote:'quotes'};
const activityVisible = (object, record, a) => { const t = ACTIVITY_TOOL[a.type]; return !t || toolCan(object, record, t, 'view'); };
const visibleActivities = (object, record, acts) => ACCESS.user ? (acts || []).filter(a => activityVisible(object, record, a)) : (acts || []);
const activityCan = (object, record, a, action) => { const t = ACTIVITY_TOOL[a.type]; return !t || toolCan(object, record, t, action); };
// Adding from an activity tab / quick action: the tool each creates.
const ADD_TOOL = {'Note':'notes', 'Call':'calls', 'Log Call':'callLogs', 'Start Meeting':'meetings', 'Schedule Meeting':'meetings', 'Log Meeting':'meetings', 'Task':'tasks',
  call:'calls', task:'tasks', note:'notes', meeting:'meetings', 'Meeting':'meetings', 'Create task':'tasks', 'Add note':'notes', file:'files', quote:'quotes'};
const canAdd = (object, record, what) => { const t = ADD_TOOL[what]; return !t || toolCan(object, record, t, 'create'); };

/* Sample users — the CRM's team (the contact owners) from the Figma rows, the signed-in user,
   and a few more. The former Core and Sales Professional holders are all on Full Seats now;
   what each can do comes from their preset. */
const SAMPLE_USERS = () => {
  const u = (name, seat, team, preset, status, lastActive, created) => ({
    id: name.toLowerCase().replace(/[^a-z]+/g, '-'), name,
    email: `${name.toLowerCase().replace(/ bin /, '.bin').replace(/\s+/g, '.')}@hof-global.com`,
    seat, team, preset, access: preset === SUPER_ADMIN ? 'all' : 'manual',
    status, lastActive, created, permissions: DEFAULT_CONTACT_PERMISSIONS(),
  });
  return [
    u('Waleed bin Zaman', 'Full Seat', 'Sales Team Global - Waleed',    SUPER_ADMIN,          'Activated',   'Oct 2, 2026, 9:05 AM',  'Aug 1, 2026'),
    u('Abdullah Saith',   'Full Seat', 'Case Manager',                  SUPER_ADMIN,          'Activated',   'Sep 7, 2026, 4:40 PM',  'Sep 7, 2026'),
    u('Hamza Siddiqui',   'Full Seat', 'Sales Team Global - Hamza',     'Admin',              'Activated',   'Oct 1, 2026, 6:10 PM',  'Aug 3, 2026'),
    u('Abeera Rahim',     'Full Seat', 'Compliance Team',               'Compliance',         'Activated',   'Sep 5, 2026, 1:40 PM',  'Sep 5, 2026'),
    u('Aaliyah Khan',     'View Seat', "Khurram's Team",                'Viewer',             'Activated',   'Sep 8, 2026, 10:30 AM', 'Sep 6, 2026'),
    u('Ali Noor',         'Full Seat', 'Lady Warriors - Jully',         'Team Lead',          'Activated',   'Sep 9, 2026, 2:15 PM',  'Sep 8, 2026'),
    u('Anaya Malik',      'Full Seat', "Mingle Masters - Wahab's Team", 'Sales Professional', 'Activated',   'Sep 10, 2026, 8:45 AM', 'Sep 9, 2026'),
    u('Aamir Shah',       'View Seat', 'Paterica Team',                 'Viewer',             'Activated',   'Sep 11, 2026, 4:00 PM', 'Sep 10, 2026'),
    u('Arwa Zafar',       'Full Seat', 'Sales Team Global - Hamza',     'Sales Professional', 'Activated',   'Sep 12, 2026, 11:20 AM','Sep 11, 2026'),
    u('Asim Ali',         'Full Seat', 'Sales Team Global - Waleed',    'Sales Professional', 'Activated',   'Sep 13, 2026, 3:50 PM', 'Sep 12, 2026'),
    u('Ayesha Bhat',      'Full Seat', "Spartans - Rahul's",            'Petition Writer',    'Activated',   'Sep 14, 2026, 9:00 AM', 'Sep 13, 2026'),
    u('Ahsan Iqbal',      'Full Seat', "Spartans - Rahul's",            'Case Manager',       'Activated',   null, 'Sep 28, 2026'),
    u('Hira Javed',       'Full Seat', 'Compliance Team',               'Compliance',         'Activated',   null, 'Sep 30, 2026'),
    u('Usman Tariq',      'View Seat', 'Paterica Team',                 'Viewer',             'Deactivated', null, 'Sep 25, 2026'),
    u('Sana Mirza',       'Full Seat', 'Case Manager',                  'Case Manager',       'Deactivated', 'Aug 20, 2026, 5:30 PM', 'Jun 3, 2026'),
    u('Bilal Ahmed',      'Full Seat', 'Sales Team Global - Hamza',     'Sales Professional', 'Deactivated', 'Jul 14, 2026, 12:10 PM', 'May 12, 2026'),
  ];
};

/* Sample teams — one per team lead; members spread across them. */
const SAMPLE_TEAMS = [
  {id:'team-waleed',   name:"Waleed's Team",   leadId:'waleed-bin-zaman', members:['asim-ali', 'abeera-rahim', 'ahsan-iqbal']},
  {id:'team-abdullah', name:"Abdullah's Team", leadId:'abdullah-saith',   members:['aaliyah-khan', 'hira-javed', 'sana-mirza']},
  {id:'team-ali',      name:"Ali's Team",      leadId:'ali-noor',         members:['anaya-malik', 'aamir-shah', 'usman-tariq']},
  {id:'team-hamza',    name:"Hamza's Team",    leadId:'hamza-siddiqui',   members:['arwa-zafar', 'ayesha-bhat', 'bilal-ahmed']},
];

/* Permission presets — a named, saved permission matrix for one seat type. The predefined
   presets below are starting points; their matrices can be edited (Permission Presets → Edit
   preset). Only the Contacts matrix is defined, so that's all a preset holds for now; Case and
   Petition permissions (Case Manager, Petition Writer, Compliance) are not defined yet. */
const ALL_CONTACTS = 'all', TEAM_CONTACTS = 'team';
// A preset's matrix: Contacts as given; Deals mirror them. `future` → Until the <record> Is Removed.
const presetMatrix = ({create, view, edit = null, del = null, merge = null, future = false, assign = false, createAssociated = false, level = 'view'}) =>
  permissionMatrix(objectPermissions({create, view, edit, del, merge, assign: assign ? 'all' : null, createAssociated: createAssociated ? 'all' : null, life: future ? 'removed' : 'reassigned'}), level);
const DEFAULT_PRESETS = () => [
  {id:'pp-super-admin',  name:SUPER_ADMIN,          seat:'Full Seat', permissions:presetMatrix({create:true, view:ALL_CONTACTS, edit:ALL_CONTACTS, del:ALL_CONTACTS, merge:ALL_CONTACTS, future:true, assign:true, createAssociated:true, level:'all'})},
  {id:'pp-admin',        name:'Admin',              seat:'Full Seat', permissions:presetMatrix({create:true, view:ALL_CONTACTS, edit:ALL_CONTACTS, del:ALL_CONTACTS, merge:ALL_CONTACTS, future:true, createAssociated:true, level:'all'})},
  {id:'pp-team-lead',    name:'Team Lead',          seat:'Full Seat', permissions:presetMatrix({create:true, view:TEAM_CONTACTS, edit:TEAM_CONTACTS, merge:TEAM_CONTACTS})},
  {id:'pp-sales-pro',    name:'Sales Professional', seat:'Full Seat', permissions:presetMatrix({create:true, view:TEAM_CONTACTS, edit:TEAM_CONTACTS, del:TEAM_CONTACTS})},
  {id:'pp-case-manager', name:'Case Manager',       seat:'Full Seat', permissions:presetMatrix({create:true, view:TEAM_CONTACTS, edit:TEAM_CONTACTS, del:TEAM_CONTACTS})},
  {id:'pp-petition',     name:'Petition Writer',    seat:'Full Seat', permissions:presetMatrix({create:false, view:TEAM_CONTACTS})},
  {id:'pp-compliance',   name:'Compliance',         seat:'Full Seat', permissions:presetMatrix({create:false, view:ALL_CONTACTS})},
  {id:'pp-viewer',       name:'Viewer',             seat:'View Seat', permissions:presetMatrix({create:false, view:ALL_CONTACTS})},
];

/* Employees — stand-in for HRMS (the prototype has no HRMS module yet): everyone already a user,
   plus employees who aren't users yet. Users are added only from here (Add User). */
const PEOPLE_NOT_USERS = [
  ['Zara Hussain', 'Operations'], ['Omar Farooq', 'Finance'], ['Nadia Karim', 'Case Management'],
  ['Faisal Mehmood', 'Marketing'], ['Mehreen Ali', 'Sales'], ['Kamran Akhtar', 'Case Management'],
];
const personEmail = (name) => `${name.toLowerCase().replace(/ bin /, '.bin').replace(/\s+/g, '.')}@hof-global.com`;

/* People data for Settings: users (team by id), teams, seats (built from who holds what) and
   presets. Deactivated users hold no seat. */
const SAMPLE_PEOPLE_DATA = () => {
  const raw = SAMPLE_USERS();
  const teamOf = (uid) => (SAMPLE_TEAMS.find(t => t.leadId === uid || t.members.includes(uid)) || {}).id || null;
  const presets = DEFAULT_PRESETS();
  // Each user starts on their preset's permission matrix (a copy of it).
  const matrixOf = (name) => { const p = presets.find(x => x.name === name); return p ? JSON.parse(JSON.stringify(p.permissions)) : DEFAULT_CONTACT_PERMISSIONS(); };   // {contacts, deals}
  const users = raw.map(({seat, team, ...u}) => ({...u, teamId:teamOf(u.id), permissions:matrixOf(u.preset)}));
  const seats = [];
  SEAT_TYPES.forEach(st => {
    const holders = raw.filter(u => u.seat === st.key && SEAT_HOLDING_STATUSES.includes(u.status));
    const count = st.total === Infinity ? holders.length : st.total;
    for(let i = 0; i < count; i++) seats.push({id:`${SEAT_PREFIX[st.key]}${i + 1}`, type:st.key, assigneeId: holders[i] ? holders[i].id : null});
  });
  const people = [
    ...users.map(u => ({id:`p-${u.id}`, name:u.name, email:u.email})),
    ...PEOPLE_NOT_USERS.map(([name, department]) => ({id:`p-${name.toLowerCase().replace(/\s+/g, '-')}`, name, email:personEmail(name), department})),
  ];
  return {users, seats, teams:SAMPLE_TEAMS.map(({members, ...t}) => t), presets, people};
};

/* ── Workspace members (mocked Google sign-in, workspaces.jsx) ── the person signed in, as a user
   of the open workspace. Someone not yet in its Users joins as an activated user on a Full Seat;
   `preset` is their Permission Preset (Super Admin for whoever starts a workspace). */
const nameFromEmail = (email) => String(email || '').split('@')[0].split(/[._-]+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
function memberFromSession(session, presets, preset = SUPER_ADMIN){
  const name = session.name || nameFromEmail(session.email);
  const p = (presets || []).find(x => x.name === preset);
  return {id: name.toLowerCase().replace(/[^a-z]+/g, '-') || 'user', name, email:session.email, preset, access: preset === SUPER_ADMIN ? 'all' : 'manual',
    status:'Activated', lastActive:null, created:new Date().toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}), teamId:null,
    permissions: p ? JSON.parse(JSON.stringify(p.permissions)) : DEFAULT_CONTACT_PERMISSIONS()};
}
// The signed-in person is in `people`'s Users; added (on a free Full Seat) when they aren't.
function withSessionMember(people, session, preset = SUPER_ADMIN){
  if(!session || !session.email) return people;
  const email = session.email.toLowerCase();
  if(people.users.some(u => String(u.email || '').toLowerCase() === email)) return people;
  let u = memberFromSession(session, people.presets, preset);
  if(people.users.some(x => x.id === u.id)) u = {...u, id:`${u.id}-${Date.now().toString(36)}`};
  const free = people.seats.findIndex(st => st.type === 'Full Seat' && !st.assigneeId);
  const seats = free >= 0 ? people.seats.map((st, i) => i === free ? {...st, assigneeId:u.id} : st) : [...people.seats, {id:`F${people.seats.length + 1}`, type:'Full Seat', assigneeId:u.id}];
  return {...people, users:[...people.users, u], seats, people:[...(people.people || []), {id:`p-${u.id}`, name:u.name, email:u.email}]};
}
/* An empty workspace's people: no users, teams or employees yet — only its seats and the
   predefined presets (the signed-in person joins through withSessionMember). */
const EMPTY_PEOPLE_DATA = () => {
  const seats = [];
  SEAT_TYPES.forEach(st => { const count = st.total === Infinity ? 0 : st.total; for(let i = 0; i < count; i++) seats.push({id:`${SEAT_PREFIX[st.key]}${i + 1}`, type:st.key, assigneeId:null}); });
  return {users:[], seats, teams:[], presets:DEFAULT_PRESETS(), people:[]};
};

const utInitials = (name) => name.split(' ').filter(w => w && w[0] === w[0].toUpperCase()).slice(0, 2).map(w => w[0]).join('');

/* ── Small pieces ─────────────────────────────────────────────────────────────────────── */

function UtTab({icon, label, active, onClick}){
  return (
    <div onClick={onClick} style={{display:'flex', flexDirection:'column', gap:8, cursor:'pointer'}}>
      <div style={{display:'flex', alignItems:'center', gap:8, height:30, padding:'4px 12px', borderRadius:8, background: active ? T.headerBg : 'transparent'}}>
        {icon && <Icon name={icon} size={14} color={active ? T.black : T.gray600}/>}
        <span style={{fontSize:13, color: active ? T.black : T.gray600, whiteSpace:'nowrap'}}>{label}</span>
      </div>
      <div style={{height:1, background: active ? T.black : 'transparent'}}/>
    </div>
  );
}

function UtToggle({on, onChange}){
  return (
    <span role="switch" aria-checked={on} onClick={()=>onChange(!on)} style={{width:24, height:14, borderRadius:14, padding:1.75, boxSizing:'border-box', flexShrink:0,
      background: on ? '#0A77FF' : T.borderStrong, display:'flex', justifyContent: on ? 'flex-end' : 'flex-start', cursor:'pointer', transition:'background 120ms'}}>
      <span style={{width:10.5, height:10.5, borderRadius:112, background:'#fff', boxShadow:'0 0.7px 2.1px rgba(16,24,40,.1)'}}/>
    </span>
  );
}

/* ── Users & Teams page ───────────────────────────────────────────────────────────────── */

const USER_PROPERTIES = [
  {key:'name',       label:'Name',              width:220},
  {key:'email',      label:'Email',             width:260},
  {key:'status',     label:'Status',            width:140},
  {key:'seat',       label:'Seat',              width:140},
  {key:'team',       label:'Team',              width:230},
  {key:'preset',     label:'Permission Preset', width:170},
  {key:'lastActive', label:'Last Active',       width:190},
  {key:'created',    label:'Created',           width:150},
];
const USER_FILTER_PROPS = [
  {key:'name',       label:'Name',              type:'text'},
  {key:'email',      label:'Email',             type:'text'},
  {key:'status',     label:'Status',            type:'select'},
  {key:'seat',       label:'Seat',              type:'select'},
  {key:'team',       label:'Team',              type:'text'},
  {key:'preset',     label:'Permission Preset', type:'select'},
  {key:'lastActive', label:'Last Active',       type:'date'},
  {key:'created',    label:'Created',           type:'date'},
];
const USER_SELECT_VALUES = {status:USER_STATUSES, seat:USER_SEATS, preset:PERMISSION_PRESETS};
const USER_COLUMNS = ['name', 'email', 'seat', 'team', 'preset', 'lastActive', 'created'];

const isFilter = (prop, value) => ({nodes:[{id:`f-${prop}-${value}`, kind:'row', joinOp:'AND', prop, op:'is', value, value2:'', values:[]}]});
const VIEW_STATE = ['columnOrder', 'sort', 'search', 'filters', 'frozenLeft', 'frozenRight', 'actionsFrozen', 'rowsPerPage', 'viewMode', 'pipelineId', 'cardSettings'];
const makeRecordView = (id, name, columns, opts = {}) => ({
  id, name, hidden:false, columnOrder:columns, frozenLeft:1, frozenRight:0, actionsFrozen:true, rowsPerPage:25,
  sort:null, viewMode:'table', search:'', filters:{nodes:[]}, ...opts,
});
const iconBtn = {width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center',
  border:`1px solid ${T.borderStrong}`, background:'#fff', borderRadius:8, cursor:'pointer', flexShrink:0};

function UsersTeamsSettings({data, setData}){
  const [tab, setTab] = React.useState('users');
  const [stub, setStub] = React.useState(null);
  const TABS = [
    {id:'users', label:'Users', icon:'user'}, {id:'seats', label:'Seats', icon:'seat'},
    {id:'teams', label:'Teams', icon:'usersThree'}, {id:'presets', label:'Permission Presets', icon:'lock'},
  ];
  /* All four tabs stay mounted (only the active one shows), so views made on a tab are still there
     when you come back. `usersFocus` opens Users filtered by a team's or a preset's user count. */
  const [usersFocus, setUsersFocus] = React.useState(null);
  const openUsers = (f) => { setUsersFocus({...f, nonce:Date.now()}); setTab('users'); };
  const MODULES = {users:UsersModule, seats:SeatsModule, teams:TeamsModule, presets:PresetsModule};
  return (
    <SettingsPage fill>
      {/* No gap under the tabs: the view row's own padding sets the space, so the views sit as
          far below the tabs as above the row's bottom border. */}
      <div style={{display:'flex', flexDirection:'column', flex:1, minHeight:0}}>
        <div style={{display:'flex', gap:8, borderBottom:`1px solid ${T.borderStrong}`}}>
          {TABS.map(t => <UtTab key={t.id} icon={t.icon} label={t.label} active={tab === t.id} onClick={()=>setTab(t.id)}/>)}
        </div>
        {TABS.map(t => {
          const Module = MODULES[t.id];
          return (
            <div key={t.id} style={{display: tab === t.id ? 'flex' : 'none', flexDirection:'column', flex:1, minHeight:0}}>
              <Module data={data} setData={setData} onStub={setStub} openUsers={openUsers} focus={t.id === 'users' ? usersFocus : null}/>
            </div>
          );
        })}
      </div>
      {stub && <StubPanel title={stub} onClose={()=>setStub(null)} zIndex={110}/>}
    </SettingsPage>
  );
}

/* One record list for every Users & Teams tab — the Contacts module's view system, table,
   filters and column patterns: view pills; (savedViews) View Settings — reorder / rename /
   clone / hide / delete, rows per page, Table settings — and Save View (copy / existing);
   search, Filters, and the grid with column menus, drag-reorder, freezing, selection and
   pagination. `actions` sits at the far right of the view row (Export, the icon-only +). */
/* `board` {pipelines, defaultPipelineId, render(rows, {search, pipelineId, cardSettings}),
   cardSettings?: {defaults(), renderModal({draft, setDraft, onApply, onClose})}} adds the Contacts
   Table / Board switcher and pipeline selector: each view remembers its mode, pipeline and — as
   in Contacts — its Card settings (View Settings → Card settings, kept with Save View). */
/* `filterControls` and `overlay` may be functions of what's in view ({mode, pipelineId, rows}). */
/* `inset` — 'settings' (default): a table inside a Settings page, cancelling the page's padding;
   'page': a CRM page (Deals), laid out exactly like Contacts. */
/* Saved views (and their card settings) are saved with everything else (store.jsx), one list per
   table — `storeKey`, by default the table's first default view. */
/* `saveView:false` leaves out Save View (View Settings stays) — e.g. Settings → Pipelines. */
/* `flushTop`: the page's top padding is cancelled too (a table that opens the page, with nothing
   above it), so the views row has the same space above and below. */
function RecordViewsModule({schema, rows, defaultViews, columns, savedViews = true, saveView = true, actions, filterControls, overlay, initialFilters, initialViewId, focus, board, inset = 'settings', storeKey, flushTop, children}){
  const [views, setViews] = usePersistedState(storeKey || `views:${defaultViews[0].id}`, ()=>defaultViews.map((v, i) => makeRecordView(v.id, v.name, columns, {filters:v.filters || {nodes:[]}, sort:v.sort || null, isDefault:i === 0,
    ...(board ? {pipelineId:v.pipelineId || board.defaultPipelineId, ...(board.cardSettings ? {cardSettings:board.cardSettings.defaults()} : {})} : {})})));
  const [activeViewId, setActiveViewId] = React.useState(initialViewId || defaultViews[0].id);
  const activeView = views.find(v => v.id === activeViewId) || views[0];
  // `initialFilters` opens the first view already filtered (an unsaved change, as in Contacts).
  const [st, setSt] = React.useState(()=>({...Object.fromEntries(VIEW_STATE.map(k => [k, activeView[k]])), ...(initialFilters ? {filters:initialFilters} : {})}));
  const firstRun = React.useRef(true);
  const pendingFilters = React.useRef(null);   // a count's filter waiting for the default view to open
  React.useEffect(()=>{
    if(firstRun.current){ firstRun.current = false; return; }
    const f = pendingFilters.current; pendingFilters.current = null;
    setSt({...Object.fromEntries(VIEW_STATE.map(k => [k, activeView[k]])), ...(f ? {filters:f} : {})});
  }, [activeViewId]);
  /* `focus` {prop, op, value, nonce} — a linked count was clicked: if a view already holds exactly
     that filter, open it; otherwise apply the filter to the default view as an unsaved change.
     No view is created. */
  React.useEffect(()=>{
    if(!focus) return;
    const match = views.find(v => { const n = (v.filters && v.filters.nodes) || []; return n.length === 1 && n[0].prop === focus.prop && n[0].value === focus.value; });
    if(match){ setActiveViewId(match.id); return; }
    const filters = {nodes:[{id:`f-${focus.nonce}`, kind:'row', joinOp:'AND', prop:focus.prop, op:focus.op, value:focus.value, value2:'', values:[]}]};
    const def = views[0];
    if(activeViewId === def.id) setSt(x => ({...Object.fromEntries(VIEW_STATE.map(k => [k, def[k]])), ...x, filters}));
    else { pendingFilters.current = filters; setActiveViewId(def.id); }
  }, [focus && focus.nonce]);
  const set = (k) => (v) => setSt(x => ({...x, [k]: typeof v === 'function' ? v(x[k]) : v}));
  const dirty = VIEW_STATE.some(k => JSON.stringify(st[k]) !== JSON.stringify(activeView[k]));

  const [allViewsOpen, setAllViewsOpen] = React.useState(false);
  const [tableSettingsDraft, setTableSettingsDraft] = React.useState(null);
  const [confirmOverwrite, setConfirmOverwrite] = React.useState(false);
  const [showSaveAsCopy, setShowSaveAsCopy] = React.useState(false);
  const [cardDraft, setCardDraft] = React.useState(null);

  const persist = (id, patch) => setViews(vs => vs.map(v => v.id === id ? {...v, ...patch} : v));
  const filtered = React.useMemo(()=>applyFilters(rows, st.filters, schema.filterProps), [rows, st.filters]);
  const appliedFilterCount = countAppliedFilters(st.filters, schema.filterProps);
  const visibleViews = views.filter(v => !v.hidden);
  const btn = toolbarButton;
  /* What's in view, for `filterControls` / `overlay` given as functions: the Board's pipeline, or
     (Table) the listed rows. */
  const viewInfo = {mode: board && st.viewMode === 'board' ? 'board' : 'table', pipelineId: board ? st.pipelineId || board.defaultPipelineId : null, rows:filtered};

  return (
    <RecordSchema.Provider value={{boards:!!board, selectable:true, ...schema}}>
      {/* Edge to edge like the Contacts table: no outer border, and the page's side / bottom
          padding is cancelled so the toolbar and grid run flush to the Settings navigation. */}
      <div style={{display:'flex', flexDirection:'column', position:'relative', flex:1, minHeight:0, ...(inset === 'settings' ? {margin:`${flushTop ? -12 : 0}px -16px -16px`} : {minWidth:0, overflow:'hidden'})}}>
        {/* The one record toolbar (contacts.jsx), as on Contacts. */}
        <RecordToolbar inset={inset} views={visibleViews} activeViewId={activeViewId} onSelectView={setActiveViewId}
          viewControls={savedViews && <>
            <ViewSettingsButton onClick={()=>setAllViewsOpen(true)}/>
            {saveView && <SaveViewMenu dirty={dirty} onSaveCopy={()=>setShowSaveAsCopy(true)} onSaveExisting={()=>setConfirmOverwrite(true)}/>}
          </>}
          controls={(actions || board) && <>
            {/* The Contacts board controls: pipeline selector (Board only), then Table / Board. */}
            {board && st.viewMode === 'board' && <PipelineSelector pipelines={board.pipelines} pipelineId={st.pipelineId} onChange={set('pipelineId')}/>}
            {board && <TableBoardSwitch mode={st.viewMode} onChange={set('viewMode')}/>}
            {actions && actions(btn)}
          </>}
          search={st.search} onSearch={set('search')} filters={st.filters} setFilters={set('filters')} appliedFilterCount={appliedFilterCount}
          filterControls={typeof filterControls === 'function' ? filterControls(viewInfo) : filterControls}/>

        {/* `overlay`: floats over the records, under the toolbar (e.g. Deals → Violations). */}
        <div style={{overflow:'hidden', flex:1, minHeight:0, display:'flex', flexDirection:'column', position:'relative'}}>
          {typeof overlay === 'function' ? overlay(viewInfo) : overlay}
          {board && st.viewMode === 'board' ? board.render(filtered, {search:st.search, pipelineId:st.pipelineId, cardSettings:st.cardSettings}) : <ContactsDataGrid rows={filtered} columnOrder={st.columnOrder} setColumnOrder={set('columnOrder')} sort={st.sort} setSort={set('sort')} search={st.search}
            frozenLeft={st.frozenLeft} frozenRight={st.frozenRight} actionsFrozen={st.actionsFrozen} rowsPerPage={st.rowsPerPage} onOpenContact={()=>{}}/>}
        </div>
      </div>

      {allViewsOpen && (
        <ViewSettingsDrawer views={views} activeViewId={activeViewId} setActiveViewId={setActiveViewId}
          onClose={()=>setAllViewsOpen(false)}
          onReorder={(from, to)=>setViews(vs => { const n = vs.slice(); const [m] = n.splice(from, 1); n.splice(to, 0, m); return n; })}
          onToggleHide={(id)=>persist(id, {hidden:!views.find(v => v.id === id).hidden})}
          onClone={(id)=>{ const v = views.find(x => x.id === id); setViews(vs => [...vs, makeRecordView('rv' + Date.now(), `${v.name} copy`, columns, Object.fromEntries(VIEW_STATE.map(k => [k, v[k]])))]); }}
          onDelete={(id)=>{
            const next = views.filter(v => v.id !== id);
            const finalViews = next.length ? next : [makeRecordView('rv1', 'All', columns)];
            setViews(finalViews);
            if(activeViewId === id) setActiveViewId(finalViews[0].id);
          }}
          onRename={(id, name)=>persist(id, {name})}
          onPatchView={(id, patch)=>{ persist(id, patch); if(id === activeViewId){
            if(patch.rowsPerPage !== undefined) set('rowsPerPage')(patch.rowsPerPage);
            if(patch.viewMode !== undefined) set('viewMode')(patch.viewMode);
          }}}
          onOpenTableSettings={(id)=>{ setActiveViewId(id); setTableSettingsDraft({columnOrder:st.columnOrder, frozenLeft:st.frozenLeft, frozenRight:st.frozenRight, actionsFrozen:st.actionsFrozen}); }}
          onOpenCardSettings={(id)=>{
            if(!board || !board.cardSettings) return;
            const v = views.find(x => x.id === id);
            setActiveViewId(id);
            setCardDraft(JSON.parse(JSON.stringify((id === activeViewId ? st.cardSettings : v && v.cardSettings) || board.cardSettings.defaults())));
          }} liveViewMode={st.viewMode || 'table'} livePipelineId={st.pipelineId}/>
      )}
      {tableSettingsDraft && (
        <TableSettingsModal draft={tableSettingsDraft} setDraft={setTableSettingsDraft} onClose={()=>setTableSettingsDraft(null)}
          onApply={()=>{ setSt(x => ({...x, ...tableSettingsDraft})); setTableSettingsDraft(null); }}/>
      )}
      {cardDraft && board && board.cardSettings && board.cardSettings.renderModal({draft:cardDraft, setDraft:setCardDraft,
        onClose:()=>setCardDraft(null), onApply:()=>{ set('cardSettings')(cardDraft); setCardDraft(null); }})}
      {confirmOverwrite && <ConfirmOverwriteModal viewName={activeView.name} isDefault={!!activeView.isDefault} onCancel={()=>setConfirmOverwrite(false)}
        onConfirm={()=>{ persist(activeView.id, {...st}); setConfirmOverwrite(false); }}/>}
      {showSaveAsCopy && <SaveAsCopyModal defaultName={`${activeView.name} copy`} onCancel={()=>setShowSaveAsCopy(false)}
        onConfirm={(name)=>{ const id = 'rv' + Date.now(); setViews(vs => [...vs, makeRecordView(id, name, columns, {...st})]); setActiveViewId(id); setShowSaveAsCopy(false); }}/>}
      {children}
    </RecordSchema.Provider>
  );
}

const personName = (users, uid) => (users.find(u => u.id === uid) || {}).name || '';
const teamName = (teams, tid) => (teams.find(t => t.id === tid) || {}).name || '';

/* ── Users ── the four status views; seat type and team are read from the seat and team records. */
/* ── Edit User ── Users & Teams → a user's ⋯ → Edit User: the Edit contact panel (CreatePanelFrame +
   RecordFields) with the User Properties (Country, Language, Designation and any added). Footer:
   Cancel, Edit User in HRMS (placeholder until HRMS exists), Save changes. */
const saveUserProfileIn = (setData, id, patch) => setData(d => ({...d, users:d.users.map(u => u.id === id ? {...u, profile:{...(u.profile || {}), ...patch}} : u)}));
function UserEditPanel({data, setData, user, onClose, onStub}){
  const fields = (data.properties || []).filter(p => p.objectId === 'users' && !p.archived).map(p => ({...p, required:!!p.mandatory}));
  const current = ownerProfileMock(user.name, user).raw;
  const initial = Object.fromEntries(fields.map(p => [p.key, p.key in current ? current[p.key] : (user.profile || {})[p.key]]));
  const [v, setV] = React.useState(() => emptyValues(fields, initial));
  const [tried, setTried] = React.useState(false);
  const set = (patch) => setV(x => ({...x, ...patch}));
  const submit = () => {
    setTried(true);
    if(Object.keys(formErrors(fields, v)).length) return;
    saveUserProfileIn(setData, user.id, storedValues(fields, v));
    onClose();
  };
  return (
    <CreatePanelFrame title="Edit user" onClose={onClose} more={false} zIndex={130} actions={<>
      <StSecondary label="Cancel" onClick={onClose}/>
      <StSecondary label={<span style={{display:'inline-flex', alignItems:'center', gap:6}}>Edit User in HRMS <Icon name="externalLink" size={13} color={T.gray600}/></span>}
        onClick={()=>onStub(`Edit User in HRMS · ${user.name}`)}/>
      <StCta label="Save changes" onClick={submit}/>
    </>}>
      <div style={{display:'grid', gridTemplateColumns:'minmax(0, 1fr)', gap:16}}>
        <RecordFields fields={fields} values={v} set={set} optionsFor={(p)=>p.options || []} tried={tried}/>
      </div>
    </CreatePanelFrame>
  );
}

/* Deactivate user: they lose access and their seat is freed; the records they own keep them as owner. */
function DeactivateUserModal({user, onCancel, onConfirm}){
  return (
    <StModal title="Deactivate user" primary="Deactivate user" danger onCancel={onCancel} onSubmit={onConfirm}>
      <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>{user.name} will lose access to the CRM and their seat will be freed. The records they own stay theirs.</div>
    </StModal>
  );
}
/* Delete user: someone takes over the records they own first (each a recorded owner change); their
   past activity keeps their name. The user and their seat go. */
function DeleteUserModal({user, owned, users, onCancel, onConfirm}){
  const [to, setTo] = React.useState('');
  const n = owned.length, needs = n > 0;
  return (
    <StModal title="Delete user" primary="Delete user" danger canSubmit={!needs || !!to} onCancel={onCancel} onSubmit={()=>onConfirm(to || null)}>
      <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>
        {needs ? `${user.name} owns ${n} record${n === 1 ? '' : 's'}. Choose who takes them over, then delete ${user.name}.` : `${user.name} will be deleted.`} Their past activity keeps their name.
      </div>
      {needs && <StField label="Reassign their records to">
        <PersonSelect value={to} people={users.filter(u => u.id !== user.id && u.status === 'Activated')} labelOf={(u)=>u.name} onChange={setTo} placeholder="Select user"/>
      </StField>}
    </StModal>
  );
}

function UsersModule({data, setData, onStub, focus}){
  const hub = useRecordHub();
  const [editing, setEditing] = React.useState(null);
  const [deactivating, setDeactivating] = React.useState(null);
  const [deleting, setDeleting] = React.useState(null);
  const [editingUser, setEditingUser] = React.useState(null);   // the user open in Edit User (id)
  const [addingUser, setAddingUser] = React.useState(false);
  const [changingSeat, setChangingSeat] = React.useState(null);
  const [changingTeam, setChangingTeam] = React.useState(null);
  const [viewingId, setViewingId] = React.useState(null);   // an active user whose details are open
  const viewing = viewingId && data.users.find(u => u.id === viewingId);
  // A user's Country / Language / Designation — read wherever user properties are (owner panel, workflows).
  const saveProfile = (id, patch) => saveUserProfileIn(setData, id, patch);
  const rows = React.useMemo(()=>data.users.map(u => ({...u, seat:(seatOfUser(data.seats, u.id) || {}).type || '', team:teamName(data.teams, u.teamId)})),
    [data.users, data.seats, data.teams]);
  const schema = {
    properties:USER_PROPERTIES, filterProps:USER_FILTER_PROPS, selectValues:{...USER_SELECT_VALUES, preset:[...new Set(data.presets.map(p => p.name))]},
    noun:'user', searchKeys:['name', 'email'], canCreateProperty:false,
    renderCell: (key, u) => key === 'name'
      // An active user opens their details (the Record Owner profile, editable here).
      ? <ContactName name={u.name} onOpen={()=>u.status === 'Activated' ? setViewingId(u.id) : onStub(u.name)} style={{fontSize:'inherit', fontWeight:500}}/>
      : undefined,
    /* Settings & Administration: Edit Permissions with Permission Management (Assign or Edit);
       Edit User, Change Seat and Change Team with Users & Teams → Edit; Deactivate and Delete with
       their own — each for Their Team users or All users. */
    renderActions: (u) => { const can = (action) => userAdminCan('users', action, u);
      return <RowActionsMenu title="User actions" items={[
        ...(userAdminCan('permissions', 'assign', u) || userAdminCan('permissions', 'edit', u) ? [{label:'Edit Permissions', onClick:()=>setEditing(u)}] : []),
        ...(can('edit') ? [{label:'Edit User', onClick:()=>setEditingUser(u.id)}, {label:'Change Seat', onClick:()=>setChangingSeat(u)}, {label:'Change Team', onClick:()=>setChangingTeam(u)}] : []),
        ...(can('deactivate') && u.status === 'Activated' ? [{label:'Deactivate user', onClick:()=>setDeactivating(u)}] : []),
        ...(can('delete') ? [{label:'Delete user', danger:true, onClick:()=>setDeleting(u)}] : []),
      ]}/>; },
  };
  const ownedBy = (uid) => ['contacts', 'deals', 'customers'].flatMap(o => (((hub && hub.records) || {})[o] || []).filter(r => r.owner === uid).map(r => ({object:o, id:r.id})));
  return (
    <RecordViewsModule schema={schema} rows={rows} columns={USER_COLUMNS} focus={focus}
      defaultViews={USER_DEFAULT_VIEWS.map(v => ({id:v.id, name:v.name, filters:isFilter('status', v.status), sort:{key:'name', dir:'asc'}}))}
      actions={(btn) => <>
        <button onClick={()=>onStub('Export')} style={btn}><Icon name="export" size={13} color={T.gray600}/> Export</button>
        {/* Add user — the Contacts toolbar's icon-only + after Export (Users & Teams → Add users). */}
        {userAdminCan('users', 'add') && <button onClick={()=>setAddingUser(true)} title="Add user" style={iconBtn}><Icon name="plus" size={14} color={T.gray800}/></button>}
      </>}>
      {viewing && <OwnerProfilePanel key={viewing.id} name={viewing.id} user={viewing} editable fixed properties={data.properties.filter(p => p.objectId === 'users' && !p.archived)} onClose={()=>setViewingId(null)} onSaveProfile={(patch)=>saveProfile(viewing.id, patch)}/>}
      {editingUser && data.users.some(u => u.id === editingUser) && <UserEditPanel data={data} setData={setData} user={data.users.find(u => u.id === editingUser)}
        onStub={onStub} onClose={()=>setEditingUser(null)}/>}
      {changingSeat && <ChangeSeatModal data={data} user={changingSeat} onClose={()=>setChangingSeat(null)}
        onSave={(type) => { setData(d => ({...d, seats:assignSeat(d.seats, changingSeat.id, type)})); setChangingSeat(null); }}/>}
      {changingTeam && <ChangeTeamModal data={data} user={changingTeam} onClose={()=>setChangingTeam(null)}
        onSave={(teamId) => { setData(d => ({...d, users:d.users.map(u => u.id === changingTeam.id ? {...u, teamId} : u)})); setChangingTeam(null); }}/>}
      {addingUser && <AddUserModal data={data} onStub={onStub} onClose={()=>setAddingUser(false)}
        onAdd={(u, setPermissions) => {
          setData(d => ({...d, users:[...d.users, u]}));
          // A CRM user has access to this organization (shared people, workspaces.jsx).
          joinWorkspaceDirectory(u);
          setAddingUser(false);
          // Save and Set Permission: straight into Edit Permissions for the new user.
          if(setPermissions) setEditing({...u, seat:'', team:teamName(data.teams, u.teamId)});
        }}/>}
      {deactivating && <DeactivateUserModal user={deactivating} onCancel={()=>setDeactivating(null)}
        onConfirm={() => { const id = deactivating.id;
          setData(d => ({...d, users:d.users.map(u => u.id === id ? {...u, status:'Deactivated'} : u), seats:d.seats.map(st => st.assigneeId === id ? {...st, assigneeId:null} : st)}));
          setDeactivating(null); }}/>}
      {deleting && <DeleteUserModal user={deleting} owned={ownedBy(deleting.id)} users={data.users} onCancel={()=>setDeleting(null)}
        onConfirm={(to) => { const id = deleting.id;
          if(to) ownedBy(id).forEach(r => hub.updateRecord(r.object, r.id, {owner:to}));
          setData(d => ({...d, users:d.users.filter(u => u.id !== id), seats:d.seats.map(st => st.assigneeId === id ? {...st, assigneeId:null} : st)}));
          setDeleting(null); }}/>}
      {editing && <EditPermissionsDrawer user={editing} seats={data.seats} presets={data.presets} onStub={onStub} onClose={()=>setEditing(null)}
        onCreatePreset={(p) => setData(d => ({...d, presets:[...d.presets, p]}))}
        onSave={({seat, ...patch}) => {
          setData(d => ({...d,
            seats: seat && seat !== editing.seat ? assignSeat(d.seats, editing.id, seat) : d.seats,
            users: d.users.map(u => u.id === editing.id ? {...u, ...patch} : u)}));
          setEditing(null);
        }}/>}
    </RecordViewsModule>
  );
}

/* Add User — users come only from HRMS: search an employee and pick them (their name and email
   carry over), set the initial status. An employee who isn't in HRMS yet has to be added there
   first ("Add employee first" — not defined yet). The new user starts with no seat, team or
   preset. The Employee ↔ User relationship beyond this is not defined yet. */
const USER_INITIAL_STATUSES = USER_STATUSES;
function AddUserModal({data, onClose, onAdd, onStub}){
  const [query, setQuery] = React.useState('');
  const [picked, setPicked] = React.useState(null);
  const [status, setStatus] = React.useState('Activated');
  const [teamId, setTeamId] = React.useState('');
  const isUser = (em) => data.users.some(u => u.email.toLowerCase() === em.trim().toLowerCase());
  const q = query.trim().toLowerCase();
  const results = q ? data.people.filter(p => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)).slice(0, 6) : [];
  const ok = !!status && !!picked && !isUser(picked.email);
  const add = (setPermissions) => onAdd({
    id:`u-${Date.now()}`, name:picked.name, email:picked.email, personId:picked.id,
    status, teamId:teamId || null, preset:'', access:'manual', lastActive:null, created:stToday(), permissions:DEFAULT_CONTACT_PERMISSIONS(),
  }, setPermissions);
  return (
    <StModal title="Add User" primary="Add User" canSubmit={ok} onCancel={onClose} onSubmit={()=>add(false)} width={820}
      textAction={{label:'Save and Set Permission', disabled:!ok, onClick:()=>add(true)}}>
      {/* The Add Property structure: two columns, one vertical separator, no boxes. */}
      <div style={{display:'grid', gridTemplateColumns:'minmax(0, 1fr) minmax(0, 1fr)', alignItems:'stretch'}}>
        <div style={{display:'flex', flexDirection:'column', gap:14, minWidth:0, paddingRight:24}}>
          <div>
            <label style={fieldLabel} htmlFor="add-user-search">Search employees in HRMS</label>
            <div style={{position:'relative'}}>
              <div style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', display:'flex'}}><Icon name="search" size={13} color={T.gray400}/></div>
              <input id="add-user-search" autoFocus value={query} onChange={e=>{ setQuery(e.target.value); setPicked(null); }} placeholder="Name or email" style={{...fieldInput, paddingLeft:30}}/>
            </div>
            {q && (
              /* Results as plain rows with a single divider between them — no box. */
              <div style={{marginTop:8, maxHeight:280, overflowY:'auto'}}>
                {results.map((p, i) => {
                  const already = isUser(p.email), on = picked && picked.id === p.id;
                  return (
                    <div key={p.id} onClick={()=>!already && setPicked(p)} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 6px', cursor: already ? 'default' : 'pointer',
                      background: on ? T.blueLight : 'transparent', borderRadius: on ? 6 : 0, borderTop: i ? `1px solid ${T.border}` : 'none', opacity: already ? .55 : 1}}>
                      <Avatar name={p.name} size={24}/>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{fontSize:13, fontWeight:500, color:T.attioText}}>{p.name}</div>
                        <div style={{fontSize:12, color:T.gray600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{p.email}</div>
                      </div>
                      {already ? <span style={{fontSize:12, color:T.gray600}}>Already a user</span> : on && <Icon name="check" size={12} color={T.blue}/>}
                    </div>
                  );
                })}
                {!results.length && <div style={{padding:'10px 0', fontSize:12.5, color:T.gray400}}>No employee matches "{query.trim()}".</div>}
              </div>
            )}
          </div>
          <div>
            <label style={fieldLabel}>Status</label>
            <FormSelect value={status} placeholder="Select status" options={USER_INITIAL_STATUSES} onChange={setStatus}/>
          </div>
          {/* The login / create-account prompt pattern. */}
          <div style={{fontSize:13, color:T.gray600, paddingTop:2}}>
            Don't have an employee right now?{' '}
            <button onClick={()=>onStub('Add employee first')} style={{border:'none', background:'transparent', padding:0, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:500, color:T.attioBlue}}>Add employee first</button>
          </div>
        </div>

        {/* Right — Team: single-select, searchable (as Add Property → Object). */}
        <div style={{minWidth:0, paddingLeft:24, borderLeft:`1px solid ${T.border}`, display:'flex', flexDirection:'column', gap:14}}>
          <div>
            <label style={fieldLabel}>Team</label>
            <SearchableSelect value={teamId} options={data.teams.map(t => ({value:t.id, label:t.name}))} onChange={setTeamId}
              placeholder="Select team" searchPlaceholder="Search teams"/>
          </div>
        </div>
      </div>
    </StModal>
  );
}

/* Change Seat: pick a seat type (with what's left); the user moves to a free seat of it. */
function ChangeSeatModal({data, user, onClose, onSave}){
  const current = (seatOfUser(data.seats, user.id) || {}).type || '';
  const [type, setType] = React.useState(current || SEAT_TYPES[0].key);
  const n = seatsAvailable(data.seats, type, user.id);
  return (
    <StModal title="Change Seat" primary="Change seat" canSubmit={type !== current && n > 0} onCancel={onClose} onSubmit={()=>onSave(type)}>
      <div style={stTextB}>{user.name} · {current ? `Currently ${current}` : 'No seat'}</div>
      <div>
        <label style={fieldLabel}>Seat type</label>
        <StSelect value={type} onChange={setType} options={SEAT_TYPES.map(st => {
          const left = seatsAvailable(data.seats, st.key, user.id);
          return {value:st.key, label:`${st.key}: ${availableLabel(left)}`, disabled: left <= 0 && st.key !== current};
        })}/>
      </div>
    </StModal>
  );
}

/* Change Team: pick the team the user belongs to. */
function ChangeTeamModal({data, user, onClose, onSave}){
  const [teamId, setTeamId] = React.useState(user.teamId || '');
  return (
    <StModal title="Change Team" primary="Change team" canSubmit={!!teamId && teamId !== user.teamId} onCancel={onClose} onSubmit={()=>onSave(teamId)}>
      <div style={stTextB}>{user.name} · {user.teamId ? `Currently ${teamName(data.teams, user.teamId)}` : 'No team'}</div>
      <div>
        <label style={fieldLabel}>Team</label>
        <PersonSelect value={teamId} people={data.teams} labelOf={t => t.name} onChange={setTeamId} placeholder="Select team"/>
      </div>
    </StModal>
  );
}

/* ── Seats ── every seat, assigned or not. Views: one per seat type, then Empty (unassigned). */
const SEAT_PROPERTIES = [
  {key:'id', label:'Seat ID', width:140}, {key:'type', label:'Seat type', width:200},
  {key:'person', label:'Assigned User', width:240}, {key:'status', label:'Status', width:160},
];
const SEAT_FILTER_PROPS = [
  {key:'id', label:'Seat ID', type:'text'}, {key:'type', label:'Seat type', type:'select'},
  {key:'person', label:'Assigned User', type:'text'}, {key:'status', label:'Status', type:'select'},
];
const SEAT_VIEWS = [
  ...SEAT_TYPES.map(st => ({id:`sv-${SEAT_PREFIX[st.key]}`, name:st.key, filters:isFilter('type', st.key)})),
  {id:'sv-empty', name:'Empty', filters:isFilter('status', 'Unassigned')},
];
// People who can be given a seat: any activated user (assigning moves them).
const assignablePeople = (data) => data.users.filter(u => SEAT_HOLDING_STATUSES.includes(u.status));
const personOptionLabel = (data, u) => { const s = seatOfUser(data.seats, u.id); return s ? `${u.name} · ${s.type} (${s.id})` : `${u.name} · No seat`; };

function SeatsModule({data, setData, onStub}){
  const [reassigning, setReassigning] = React.useState(null);
  const rows = React.useMemo(()=>data.seats.map(st => ({...st, person:personName(data.users, st.assigneeId), status: st.assigneeId ? 'Assigned' : 'Unassigned'})),
    [data.seats, data.users]);
  const schema = {
    properties:SEAT_PROPERTIES, filterProps:SEAT_FILTER_PROPS, selectValues:{type:USER_SEATS, status:['Assigned', 'Unassigned']},
    noun:'seat', searchKeys:['id', 'person'], fillWidth:true, canCreateProperty:false,
    renderCell: (key, r) => key === 'person' && r.person
      ? <ContactName name={r.person} onOpen={()=>onStub(r.person)} style={{fontSize:'inherit', fontWeight:500}}/> : undefined,
    // One ⋯ menu on every seat: Assign seat when it's empty, Reassign seat when it's held.
    renderActions: (r) => <RowActionsMenu title="Seat actions" items={[{label: r.assigneeId ? 'Reassign seat' : 'Assign seat', onClick:()=>setReassigning(r)}]}/>,
  };
  return (
    <RecordViewsModule schema={schema} rows={rows} columns={SEAT_PROPERTIES.map(p => p.key)} defaultViews={SEAT_VIEWS}
      /* Seat counts are set by Sales, so seats are requested through Contact Sales (not defined yet). */
      actions={(btn) => <button onClick={()=>onStub('Contact Sales')} style={btn}>Contact Sales</button>}>
      {reassigning && <ReassignSeatModal data={data} seat={reassigning} onClose={()=>setReassigning(null)}
        onAssign={(uid) => { setData(d => ({...d, seats:assignSeat(d.seats, uid, reassigning.type, reassigning.id)})); setReassigning(null); }}/>}
    </RecordViewsModule>
  );
}

/* The contact form's select, for people (value = user id). */
function PersonSelect({value, people, labelOf, onChange, placeholder = 'Select person'}){
  return (
    <div style={{position:'relative'}}>
      <select value={value} onChange={e=>onChange(e.target.value)} style={{...fieldInput, appearance:'none', WebkitAppearance:'none', paddingRight:32, cursor:'pointer', color: value ? T.attioText : T.gray400}}>
        <option value="">{placeholder}</option>
        {people.map(u => <option key={u.id} value={u.id}>{labelOf(u)}</option>)}
      </select>
      <div style={{position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', display:'flex'}}>
        <Icon name="chevDown" size={T.chevronSize} color={T.gray600}/>
      </div>
    </div>
  );
}

/* Assign / Reassign a seat: pick the person; assigning moves them off their current seat. */
function ReassignSeatModal({data, seat, onClose, onAssign}){
  const [person, setPerson] = React.useState('');
  const people = assignablePeople(data).filter(u => u.id !== seat.assigneeId);
  return (
    <StModal title={`${seat.assigneeId ? 'Reassign' : 'Assign'} ${seat.id}`} primary={seat.assigneeId ? 'Reassign seat' : 'Assign seat'} canSubmit={!!person} onCancel={onClose} onSubmit={()=>onAssign(person)}>
      <div style={stTextB}>{seat.type} · {seat.assigneeId ? `Currently ${personName(data.users, seat.assigneeId)}` : 'Unassigned'}</div>
      <div>
        <label style={fieldLabel}>Assign to</label>
        <PersonSelect value={person} people={people} labelOf={u => personOptionLabel(data, u)} onChange={setPerson}/>
      </div>
    </StModal>
  );
}

/* ── Teams ── starts with one All Teams view; View Settings and Save View as on Users. Team management is not defined yet. */
const TEAM_PROPERTIES = [
  {key:'name', label:'Team Name', width:240}, {key:'lead', label:'Team Lead', width:220}, {key:'users', label:'Users', width:160},
];
const TEAM_FILTER_PROPS = [
  {key:'name', label:'Team Name', type:'text'}, {key:'lead', label:'Team Lead', type:'text'},
];
/* A clickable count: just the number, underlined (the column header names what it counts). */
const countLink = (n, onClick) => (
  <button onClick={onClick} style={{border:'none', background:'transparent', padding:0, cursor:'pointer', fontFamily:'inherit', fontSize:'inherit', color:T.attioText,
    textDecoration:'underline', textUnderlineOffset:2, textDecorationColor:'#D7D6DA'}}>{n}</button>
);
function TeamsModule({data, setData, onStub, openUsers}){
  const [adding, setAdding] = React.useState(false);
  const rows = React.useMemo(()=>data.teams.map(t => {
    const count = data.users.filter(u => u.teamId === t.id).length;
    return {...t, lead:personName(data.users, t.leadId), users:`${count} user${count === 1 ? '' : 's'}`, count};
  }), [data.teams, data.users]);
  const schema = {
    properties:TEAM_PROPERTIES, filterProps:TEAM_FILTER_PROPS, selectValues:{}, noun:'team', searchKeys:['name', 'lead'], fillWidth:true, canCreateProperty:false,
    // The user count opens Users filtered to this team.
    renderCell: (key, r) => key === 'users' ? countLink(r.count, ()=>openUsers({prop:'team', op:'contains', value:r.name})) : undefined,
    renderActions: (r) => <RowActionsMenu title="Team actions" items={[{label:'Edit team', onClick:()=>onStub(`Edit ${r.name}`)}]}/>,
  };
  return (
    <RecordViewsModule schema={schema} rows={rows} columns={TEAM_PROPERTIES.map(p => p.key)}
      defaultViews={[{id:'tv-all', name:'All Teams', sort:{key:'name', dir:'asc'}}]}
      actions={() => <button onClick={()=>setAdding(true)} title="Add Team" style={iconBtn}><Icon name="plus" size={14} color={T.gray800}/></button>}>
      {adding && <AddTeamModal data={data} onClose={()=>setAdding(false)}
        onAdd={(team, memberIds) => {
          setData(d => ({...d, teams:[...d.teams, team], users:d.users.map(u => memberIds.includes(u.id) ? {...u, teamId:team.id} : u)}));
          setAdding(false);
        }}/>}
    </RecordViewsModule>
  );
}

/* Add Team: 1 Team Name → 2 Team Lead (any activated user) → 3 Add User. The lead joins the team
   too; members move from their current team. Detailed team management is not defined yet. */
function AddTeamModal({data, onClose, onAdd}){
  const [name, setName] = React.useState('');
  const [leadId, setLeadId] = React.useState('');
  const [members, setMembers] = React.useState([]);
  const n = name.trim();
  const taken = data.teams.some(t => t.name.toLowerCase() === n.toLowerCase());
  const activated = data.users.filter(u => u.status === 'Activated');
  const [find, setFind] = React.useState('');
  const f = find.trim().toLowerCase();
  const listed = activated.filter(u => u.id !== leadId && (!f || u.name.toLowerCase().includes(f) || u.email.toLowerCase().includes(f)));
  const toggle = (id) => setMembers(m => m.includes(id) ? m.filter(x => x !== id) : [...m, id]);
  return (
    <StModal title="Add Team" primary="Add team" canSubmit={!!n && !taken && !!leadId} onCancel={onClose} width={820}
      onSubmit={()=>{ const id = `team-${Date.now()}`; onAdd({id, name:n, leadId}, [...new Set([leadId, ...members])]); }}>
      {/* The Properties configuration pattern: two columns, one vertical separator, no boxes. */}
      <div style={{display:'grid', gridTemplateColumns:'minmax(0, 1fr) minmax(0, 1fr)', alignItems:'stretch'}}>
        <div style={{display:'flex', flexDirection:'column', gap:14, minWidth:0, paddingRight:24}}>
          <div>
            <label style={fieldLabel} htmlFor="team-name">Team Name</label>
            <input id="team-name" autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Canada Desk" style={fieldInput}/>
            {taken && <div style={{fontSize:12, color:T.red, marginTop:4}}>A team with this name already exists.</div>}
          </div>
          <div>
            <label style={fieldLabel}>Team Lead</label>
            <PersonSelect value={leadId} people={activated} labelOf={u => u.name} onChange={id=>{ setLeadId(id); setMembers(m => m.filter(x => x !== id)); }} placeholder="Select team lead"/>
          </div>
        </div>

        {/* Right — Add User: search, then every user with a checkbox (several at once). Plain rows
            with a single divider between them, scrolling; no box. */}
        <div style={{minWidth:0, paddingLeft:24, borderLeft:`1px solid ${T.border}`, display:'flex', flexDirection:'column'}}>
          <label style={fieldLabel} htmlFor="team-user-search">Add User</label>
          <div style={{position:'relative'}}>
            <div style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', display:'flex'}}><Icon name="search" size={13} color={T.gray400}/></div>
            <input id="team-user-search" value={find} onChange={e=>setFind(e.target.value)} placeholder="Search users" style={{...fieldInput, paddingLeft:30}}/>
          </div>
          <div style={{marginTop:8, maxHeight:280, overflowY:'auto'}}>
            {listed.map((u, i) => (
              <label key={u.id} onClick={()=>toggle(u.id)} style={{display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderTop: i ? `1px solid ${T.border}` : 'none', cursor:'pointer', fontSize:13, color:T.attioText}}>
                <RowCheckbox checked={members.includes(u.id)} onChange={()=>toggle(u.id)}/>
                <span style={{flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{u.name}</span>
                <span style={{fontSize:12, color:T.gray400, whiteSpace:'nowrap'}}>{teamName(data.teams, u.teamId) || 'No team'}</span>
              </label>
            ))}
            {!listed.length && <div style={{fontSize:12.5, color:T.gray400, padding:'10px 0'}}>No users match "{find.trim()}".</div>}
          </div>
          {members.length > 0 && <div style={{fontSize:12, color:T.gray600, marginTop:6}}>{members.length} selected</div>}
        </div>
      </div>
    </StModal>
  );
}

/* ── Permission Presets ── each a named, saved permission matrix for one seat type, to be applied
   to users later. Preset management is not defined yet. */
const PRESET_PROPERTIES = [
  {key:'name', label:'Preset Name', width:220}, {key:'seat', label:'Seat Type', width:220}, {key:'assigned', label:'Assigned Users', width:180},
];
const PRESET_FILTER_PROPS = [
  {key:'name', label:'Preset Name', type:'text'}, {key:'seat', label:'Seat Type', type:'select'},
];
function PresetsModule({data, setData, onStub, openUsers}){
  const [editingPreset, setEditingPreset] = React.useState(null);
  // Assigned users: users on this preset (manual access) holding a seat of the preset's type.
  const rows = React.useMemo(()=>data.presets.map(p => {
    const count = data.users.filter(u => u.preset === p.name && (seatOfUser(data.seats, u.id) || {}).type === p.seat).length;
    return {...p, count, assigned:`${count} user${count === 1 ? '' : 's'}`};
  }), [data.presets, data.users, data.seats]);
  const schema = {
    properties:PRESET_PROPERTIES, filterProps:PRESET_FILTER_PROPS, selectValues:{seat:USER_SEATS}, noun:'preset', searchKeys:['name', 'seat'], fillWidth:true,
    // The assigned-user count opens Users filtered to this preset.
    renderCell: (key, r) => key === 'assigned' ? countLink(r.count, ()=>openUsers({prop:'preset', op:'is', value:r.name})) : undefined,
    // Presets are changed with Permission Management → Edit.
    renderActions: (r) => <RowActionsMenu title="Preset actions" items={userAdminCan('permissions', 'edit') ? [{label:'Edit preset', onClick:()=>setEditingPreset(data.presets.find(p => p.id === r.id))}] : []}/>,
  };
  return <RecordViewsModule schema={schema} rows={rows} columns={PRESET_PROPERTIES.map(p => p.key)}
    defaultViews={[{id:'pv-all', name:'All Presets'}]}
    actions={() => userAdminCan('permissions', 'edit') && <button onClick={()=>onStub('Add Permission Preset')} title="Add Permission Preset" style={iconBtn}><Icon name="plus" size={14} color={T.gray800}/></button>}>
    {editingPreset && <EditPresetDrawer preset={editingPreset} onClose={()=>setEditingPreset(null)}
      onSave={(permissions) => { setData(d => ({...d, presets:d.presets.map(p => p.id === editingPreset.id ? {...p, permissions} : p)})); setEditingPreset(null); }}/>}
  </RecordViewsModule>;
}

/* ── Edit Permissions drawer (Figma 64:4132) ─────────────────────────────────────────── */

/* The drawer frame shared by Edit Permissions and Edit preset: header, scrolling body, Cancel / Save. */
function PermissionsDrawerFrame({title, subtitle, onClose, onSave, children}){
  return (
    <div style={{position:'fixed', inset:0, zIndex:100}}>
      <div onClick={onClose} style={{position:'absolute', inset:0, background:'rgba(16,24,40,.35)'}}/>
      {/* Wider than the Figma frame (958): the permission tables (Permission | Type | Permission Life) need the room. */}
      <div style={{position:'absolute', top:0, right:0, bottom:0, width:1180, maxWidth:'100vw', background:'#fff', display:'flex', flexDirection:'column',
                   boxShadow:'-8px 0 24px rgba(16,24,40,.12)'}}>
        <div style={{height:45, flexShrink:0, display:'flex', alignItems:'center', gap:12, padding:'0 12px', borderBottom:`1px solid ${T.borderStrong}`}}>
          <button onClick={onClose} title="Close" style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:0}}>
            <Icon name="close" size={14} color={T.gray600}/>
          </button>
          <span style={{fontSize:14, fontWeight:500, color:T.black}}>{title}</span>
          <span style={{...stTextB, marginLeft:4}}>{subtitle}</span>
        </div>
        <div style={{flex:1, minHeight:0, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:24}}>{children}</div>
        <div style={{height:46, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'flex-end', gap:12, padding:'0 12px', borderTop:`1px solid ${T.borderStrong}`}}>
          <button onClick={onClose} style={{height:29, padding:'0 12px', borderRadius:8, border:`1px solid ${T.borderStrong}`, background:T.headerBg, color:T.gray600, fontSize:14, fontFamily:'inherit', cursor:'pointer'}}>Cancel</button>
          <StCta icon="arrowDown" label="Save" onClick={onSave}/>
        </div>
      </div>
    </div>
  );
}

/* One Object's permissions (Contacts, Deals — Customers later): its switch, then the Standard
   and Administrative tables — Permission | Type | Permission Life. Ticking a permission turns it
   on (Create needs nothing else); View / Edit / Delete / Merge and the admin permissions then
   take a Type, and Their / Their Team records a Permission Life. Options that don't apply are
   shown disabled; a permission the seat can't grant is disabled. Every change applies at once. */
function ObjectPermissionsEditor({obj, seat, value, onChange, properties = []}){
  const v = withEditOptions(value || normalizeObjectPermissions({}));
  const set = (key, patch) => onChange(o => ({...o, [key]:applyPermission(o[key], key, patch)}));
  const tools = v.tools || normalizeToolPermissions(null, v);
  const accounting = v.accounting || normalizeAccountingPermissions(null, v);
  const setTool = (tool, key, patch) => onChange(o => ({...o, tools:{...o.tools, [tool]:{...o.tools[tool], [key]:applyPermission(o.tools[tool][key], key, patch)}}}));
  const standard = STANDARD_PERMISSIONS.map(a => ({...a, allowed:seat.contactStandard.includes(a.key)}));
  const admin = ADMIN_PERMISSIONS.filter(a => seat.contactAdmin.includes(a.key)).map(a => ({...a, allowed:true}));
  return (
    <div style={{display:'flex', flexDirection:'column', gap:16}}>
      <div style={{display:'flex', gap:12, alignItems:'center'}}>
        <span style={{display:'flex'}}><Icon name="chevDown" size={16} color={T.gray800}/></span>
        <span style={{fontSize:14, fontWeight:500, color:T.black}}>{obj.plural}</span>
        <UtToggle on={v.enabled} onChange={on=>onChange(o => ({...o, enabled:on}))}/>
      </div>
      {v.enabled && (<>
        <PermissionTable title="Standard permissions" obj={obj} rows={standard} value={v} set={set}/>
        {/* Under Edit: moving between stages, and which property values may be edited. */}
        {v.edit.on && seat.contactStandard.includes('edit') && (
          <EditOptions obj={obj} value={v} properties={properties} onChange={(patch)=>onChange(o => ({...o, ...patch}))}/>
        )}
        {/* Administrative permissions: Full Seats only. */}
        {admin.length > 0 && <PermissionTable title="Administrative permissions" obj={obj} rows={admin} value={v} set={set}/>}
        {/* Tools: one switch for all of them; on, a table per tool (the seat's limits apply). */}
        <div style={{height:1, background:T.borderStrong}}/>
        <div style={{display:'flex', gap:12, alignItems:'center'}}>
          <span style={{fontSize:14, fontWeight:500, color:T.black}}>Tools</span>
          <UtToggle on={tools.enabled} onChange={on=>onChange(o => ({...o, tools:{...(o.tools || tools), enabled:on}}))}/>
        </div>
        {tools.enabled && PERMISSION_TOOLS.map(tool => (
          <PermissionTable key={tool.key} title={tool.label} obj={obj} idKey={`${obj.key}-${tool.key}`}
            rows={toolActionsOf(tool).map(a => ({...a, allowed:seat.contactStandard.includes(a.key)}))}
            value={tools[tool.key]} set={(key, patch)=>setTool(tool.key, key, patch)}/>
        ))}
        {/* Accounting: the record's Payment Terms (its Accounting tab), by the record's owner. */}
        <div style={{height:1, background:T.borderStrong}}/>
        <span style={{fontSize:14, fontWeight:500, color:T.black}}>Accounting</span>
        <PermissionTable title="Payment Terms" obj={obj} idKey={`${obj.key}-accounting`}
          rows={[{key:'create', label:() => 'Create Payment Terms', unscoped:true}, {key:'view', label:() => 'View Payment Terms'},
            {key:'edit', label:() => 'Edit Payment Terms'}, {key:'delete', label:() => 'Delete Payment Terms'}].map(a => ({...a, allowed:seat.contactStandard.includes(a.key)}))}
          value={accounting} set={(key, patch)=>onChange(o => ({...o, accounting:{...(o.accounting || accounting), [key]:applyPermission((o.accounting || accounting)[key], key, patch)}}))}/>
        <div style={stTextB}>Without View Payment Terms, the record's payment terms and the accounting figures from them (Accounting properties, cash KPIs and statistics) don't show.</div>
      </>)}
    </div>
  );
}
/* Records → Edit options: Move between pipeline stages (on / off), and Edit property values — All
   properties, or Specific properties (ticked from the Object's properties). */
function EditOptions({obj, value, properties, onChange}){
  const specific = Array.isArray(value.editProps);
  const list = specific ? value.editProps : [];
  const radio = (checked, label, onPick) => (
    <label style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:T.attioText, cursor:'pointer', minHeight:22}}>
      <input type="radio" name={`${obj.key}-edit-props`} checked={checked} onChange={onPick} style={{margin:0, width:15, height:15, accentColor:T.black, cursor:'pointer'}}/>{label}
    </label>
  );
  return (
    <div style={{display:'flex', flexDirection:'column', gap:8}}>
      <span style={{fontSize:13, fontWeight:500, color:T.gray600}}>Edit options</span>
      <div style={{border:`1px solid ${T.attioLine}`, borderRadius:8, padding:'10px 12px', display:'flex', flexDirection:'column', gap:12}}>
        <label onClick={()=>onChange({editStages:!value.editStages})} style={{display:'flex', alignItems:'center', gap:10, fontSize:13.5, fontWeight:500, color:T.black, cursor:'pointer'}}>
          <RowCheckbox checked={value.editStages} onChange={()=>onChange({editStages:!value.editStages})}/>Move between pipeline stages
        </label>
        <div style={{display:'flex', flexDirection:'column', gap:6}}>
          <span style={{fontSize:13.5, fontWeight:500, color:T.black}}>Edit property values</span>
          {radio(!specific, 'All properties', ()=>onChange({editProps:'all'}))}
          {radio(specific, 'Specific properties', ()=>onChange({editProps:list.length ? list : []}))}
          {specific && (
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:4, paddingLeft:23}}>
              {properties.map(p => {
                const on = list.includes(p.key), toggle = () => onChange({editProps: on ? list.filter(k => k !== p.key) : [...list, p.key]});
                return <label key={p.key} onClick={toggle} style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:T.attioText, cursor:'pointer', minHeight:24}}>
                  <RowCheckbox checked={on} onChange={toggle}/>{p.label}</label>;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* Customer Profile Properties: All Properties (the default), or Specific Properties — every
   profile template's fields, one per row, ticked on the left. */
function ProfilePropsEditor({value, forms, disabled, onChange}){
  const specific = Array.isArray(value), list = specific ? value : [];
  const radio = (checked, label, onPick) => (
    <label style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:T.attioText, cursor: disabled ? 'default' : 'pointer', minHeight:22}}>
      <input type="radio" name="profile-props" checked={checked} disabled={disabled} onChange={onPick} style={{margin:0, width:15, height:15, accentColor:T.black}}/>{label}
    </label>
  );
  return (
    <div style={{display:'flex', flexDirection:'column', gap:10, opacity: disabled ? .5 : 1}}>
      <div style={{display:'flex', gap:20}}>
        {radio(!specific, 'All Properties', ()=>onChange('all'))}
        {radio(specific, 'Specific Properties', ()=>onChange(list))}
      </div>
      {specific && (
        <div style={{border:`1px solid ${T.attioLine}`, borderRadius:8, overflow:'hidden'}}>
          {forms.map(f => (
            <div key={f.id}>
              <div style={{padding:'8px 12px', background:T.headerBg, fontSize:12.5, fontWeight:500, color:T.gray600, borderTop:`1px solid ${T.attioLine}`}}>{f.name}</div>
              {(f.fields || []).map(fd => {
                const id = `${f.id}:${fd.id}`, on = list.includes(id), toggle = () => !disabled && onChange(on ? list.filter(x => x !== id) : [...list, id]);
                return (
                  <label key={id} onClick={toggle} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderTop:`1px solid ${T.attioLine}`, fontSize:13, color:T.attioText, cursor: disabled ? 'default' : 'pointer'}}>
                    <RowCheckbox checked={on} onChange={toggle}/>{fd.label}
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const PERMISSION_TABLE_COLS = '200px 1fr 1fr';
// One permission changed: Create is on / off; the others stay complete (a Type, and a Permission Life for Their / Their Team).
const applyPermission = (cur, key, patch) => {
  if(key === 'create') return {...cur, ...patch};
  const next = {...cur, ...patch};
  return scopedPermission(next.on, next.scope || 'own', next.scope === 'all' ? null : (next.life || 'reassigned'));
};
/* `idKey`: keeps each table's radio groups apart (a tool's table repeats the same permissions).
   A row's `scopes` replaces the Types offered (Their Team / All users); `noLife`: no Permission Life
   (items never reassigned — a creator's). `flat`: on / off permissions only — no Type or Life columns. */
function PermissionTable({title, obj, rows, value, set, idKey, flat}){
  const cell = {padding:'10px 12px', minWidth:0};
  const header = {...cell, padding:'8px 12px', fontSize:12.5, fontWeight:500, color:T.gray600};
  const empty = <span style={{fontSize:13, color:T.gray400}}>—</span>;
  // A radio option: disabled shows greyed and can't be picked.
  const radio = (checked, disabled, label, onPick, name) => (
    <label key={label} style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color: disabled ? T.gray400 : T.attioText, cursor: disabled ? 'default' : 'pointer', minHeight:22}}>
      <input type="radio" name={name} checked={checked} disabled={disabled} onChange={onPick} style={{margin:0, width:15, height:15, accentColor:T.black, cursor: disabled ? 'default' : 'pointer'}}/>
      {label}
    </label>
  );
  const cols = flat ? '1fr' : PERMISSION_TABLE_COLS;
  return (
    <div style={{display:'flex', flexDirection:'column', gap:8}}>
      {title && <span style={{fontSize:13, fontWeight:500, color:T.gray600}}>{title}</span>}
      <div role="table" aria-label={`${obj.plural} ${title || ''}`} style={{border:`1px solid ${T.attioLine}`, borderRadius:8, overflow:'hidden'}}>
        <div role="row" style={{display:'grid', gridTemplateColumns:cols, background:T.headerBg, borderBottom:`1px solid ${T.attioLine}`}}>
          <div role="columnheader" style={header}>Permission</div>
          {!flat && <div role="columnheader" style={{...header, borderLeft:`1px solid ${T.attioLine}`}}>Type</div>}
          {!flat && <div role="columnheader" style={{...header, borderLeft:`1px solid ${T.attioLine}`}}>Permission Life</div>}
        </div>
        {rows.map((a, i) => {
          const p = value[a.key] || {}, on = !!p.on, name = `${idKey || obj.key}-${a.key}`;
          const scoped = !a.unscoped, typeOff = !a.allowed || !on, lifeOff = typeOff || p.scope === 'all';
          const scopes = a.scopes || PERMISSION_SCOPES;
          return (
            <div key={a.key} role="row" style={{display:'grid', gridTemplateColumns:cols, borderTop: i ? `1px solid ${T.attioLine}` : 'none', opacity: a.allowed ? 1 : .5}}>
              <div role="cell" style={{...cell, display:'flex', alignItems:'flex-start'}}>
                <label onClick={()=>a.allowed && set(a.key, {on:!on})} style={{display:'flex', alignItems:'center', gap:10, fontSize:13.5, fontWeight:500, color:T.black, cursor: a.allowed ? 'pointer' : 'default', minHeight:22}}>
                  <RowCheckbox checked={on} onChange={()=>a.allowed && set(a.key, {on:!on})}/>{a.label(obj)}
                </label>
              </div>
              {!flat && <div role="cell" style={{...cell, borderLeft:`1px solid ${T.attioLine}`, display:'flex', flexDirection:'column', gap:6}}>
                {scoped ? scopes.map(sc => radio(on && p.scope === sc, typeOff, scopeLabel(obj, sc), ()=>set(a.key, {scope:sc}), `${name}-type`)) : empty}
              </div>}
              {!flat && <div role="cell" style={{...cell, borderLeft:`1px solid ${T.attioLine}`, display:'flex', flexDirection:'column', gap:6}}>
                {/* All <records> needs no Permission Life: shown disabled, nothing picked. */}
                {scoped && !a.noLife ? PERMISSION_LIVES.map(l => radio(on && p.scope !== 'all' && p.life === l, lifeOff, lifeLabel(obj, l), ()=>set(a.key, {life:l}), `${name}-life`)) : empty}
              </div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* The two-pane permission matrix for one seat type: categories on the left swap the right-hand
   content, each with its horizontal tabs. The search finds categories by their name or a tab's.
   A View Seat grants View only (the rest shown disabled), and nothing in Settings & Administration. */
const CRUD_ROWS = [
  {key:'create', label:() => 'Create', unscoped:true},
  {key:'view',   label:() => 'View'},
  {key:'edit',   label:() => 'Edit'},
  {key:'delete', label:() => 'Delete'},
];
const USERS_SCOPES = ['team', 'all'];
// `readOnly`: the categories can be browsed, nothing changes (Permission Management → Edit).
function PermissionMatrixEditor({seat, perms, setPerms, readOnly}){
  const hub = useRecordHub();
  const [category, setCategory] = React.useState('Records');
  const [tabs, setTabs] = React.useState({Records:PERMISSION_TABS.Records[0], Templates:PERMISSION_TEMPLATES[0].tab, 'Settings & Administration':ADMIN_TABS[0]});
  const [find, setFind] = React.useState('');
  const def = seatDef(seat);
  const viewOnly = def.extended === 'view';
  const f = find.trim().toLowerCase();
  const categories = PERMISSION_CATEGORIES.filter(c => !f || c.toLowerCase().includes(f) || (PERMISSION_TABS[c] || []).some(t => t.toLowerCase().includes(f)));
  const tab = tabs[category];
  const objectProps = (o) => hub && hub.data ? objectProperties(hub.data, o) : [];
  const profileForms = (hub && hub.data && hub.data.profileForms) || [];
  const nounOf = (o) => (PERMISSION_OBJECTS.find(x => x.key === o) || {}).noun || o;
  // Writing one part of the matrix: `path` into perms, a permission's key, its patch.
  const setAt = (path, key, patch) => setPerms(p => {
    const next = copyMatrix(p); let at = next;
    path.forEach(k => { at[k] = at[k] || {}; at = at[k]; });
    at[key] = patch === null || typeof patch !== 'object' || Array.isArray(patch) ? patch : applyPermission(at[key] || {}, key, patch);
    return next;
  });
  const getAt = (path) => path.reduce((at, k) => (at || {})[k], perms) || {};
  const rowsFor = (rows, extra = {}) => rows.map(a => ({...a, ...extra, allowed: viewOnly ? a.key === 'view' && !extra.adminOnly : true}));
  const crudTable = (path, obj, extra) => (
    <PermissionTable key={path.join('-')} obj={obj} idKey={path.join('-')} rows={rowsFor(CRUD_ROWS, extra)} value={getAt(path)} set={(key, patch)=>setAt(path, key, patch)}/>
  );
  const flatTable = (path, obj, rows, title) => (
    <PermissionTable key={path.join('-')} flat title={title} obj={obj} idKey={path.join('-')} rows={rows.map(a => ({...a, unscoped:true, allowed:!viewOnly || !!a.viewRow}))}
      value={getAt(path)} set={(key, patch)=>setAt(path, key, patch)}/>
  );
  const section = (title, body) => <div key={title} style={{display:'flex', flexDirection:'column', gap:10}}><span style={{fontSize:14, fontWeight:500, color:T.black}}>{title}</span>{body}</div>;
  const row = (key, label) => ({key, label:() => label});

  const body = () => {
    if(category === 'Records' && permissionObjectOf(tab)) return (
      <ObjectPermissionsEditor key={tab} obj={permissionObjectOf(tab)} seat={def} value={perms[permissionObjectOf(tab).key]} properties={objectProps(permissionObjectOf(tab).key)}
        onChange={(fn)=>setPerms(p => { const k = permissionObjectOf(tab).key; return {...p, [k]:fn(p[k])}; })}/>
    );
    // Which Customer Profile answers may be edited — on every record.
    if(category === 'Customer Profile Properties') return section('Edit Customer Profile properties',
      <ProfilePropsEditor value={perms.profileProps} forms={profileForms} disabled={viewOnly} onChange={(v)=>setPerms(p => ({...p, profileProps:v}))}/>);
    if(category === 'Templates'){ const t = PERMISSION_TEMPLATES.find(x => x.tab === tab); if(!t) return null;
      if(t.key === 'profileForms') return section(t.plural, <PermissionTable obj={t} idKey="templates-profileForms" value={getAt(['templates', 'profileForms'])}
        set={(key, patch)=>setAt(['templates', 'profileForms'], key, patch)}
        rows={[{key:'create', label:() => 'Create Customer Profile Templates', unscoped:true}, {key:'edit', label:() => 'Edit Form Fields'}, {key:'delete', label:() => 'Delete Customer Profiles'}]
          .map(a => ({...a, noLife:true, allowed:!viewOnly}))}/>);
      return section(t.plural, crudTable(['templates', t.key], t, {noLife:true})); }
    // Workflows: on / off for every workflow.
    if(category === 'Workflows') return flatTable(['workflows'], {key:'workflows', plural:'Workflows'},
      [row('view', 'View'), row('create', 'Create'), row('edit', 'Edit'), row('delete', 'Delete'), row('revert', 'Revert')].map(r => ({...r, viewRow:r.key === 'view'})), 'Workflows');
    if(category !== 'Settings & Administration') return null;
    const admin = ['admin'];
    // Records, Properties, Pipelines: by who created each (the shipped ones are the workspace creator's).
    if(tab === 'Records') return section('Settings → Records', crudTable([...admin, 'records'], {key:'recordTypes', noun:'Record', plural:'Records'}, {noLife:true, adminOnly:true}));
    if(tab === 'Properties') return ADMIN_RECORD_OBJECTS.filter(workspaceHasType).map(o => section(`${nounOf(o)} Properties`,
      <PermissionTable obj={{key:`${o}-properties`, noun:`${nounOf(o)} Property`, plural:`${nounOf(o)} Properties`}} idKey={`admin-properties-${o}`}
        value={getAt([...admin, 'properties', o])} set={(key, patch)=>setAt([...admin, 'properties', o], key, patch)}
        rows={[{key:'add', label:() => 'Add new properties', unscoped:true}, {key:'edit', label:() => 'Edit'}, {key:'delete', label:() => 'Delete'}].map(a => ({...a, noLife:true, allowed:!viewOnly}))}/>));
    if(tab === 'Pipelines') return ADMIN_RECORD_OBJECTS.filter(workspaceHasType).map(o => section(`${nounOf(o)} Pipelines`,
      crudTable([...admin, 'pipelines', o], {key:`${o}-pipelines`, noun:`${nounOf(o)} Pipeline`, plural:`${nounOf(o)} Pipelines`}, {noLife:true, adminOnly:true})));
    if(tab === 'Tools Settings') return flatTable([...admin, 'tools'], {key:'tools', plural:'Tools'}, ADMIN_TOOL_SETTINGS.map(t => row(t.key, `Connect ${t.label}`)), 'Settings → Tools');
    if(tab === 'Company Defaults') return flatTable([...admin, 'defaults'], {key:'defaults', plural:'Defaults'}, [row('edit', 'Edit company defaults')], 'Settings → Defaults');
    if(tab === 'Goals') return flatTable([...admin, 'goals'], {key:'goals', plural:'Goals'}, [row('view', 'View goals'), row('edit', 'Edit goals')], 'Settings → Goals');
    if(tab === 'Users & Teams') return (
      <PermissionTable title="Users" obj={{key:'users', noun:'User', plural:'Users'}} idKey="admin-users" value={getAt([...admin, 'users'])}
        set={(key, patch)=>setAt([...admin, 'users'], key, patch)}
        rows={[{key:'add', label:() => 'Add users', unscoped:true}, {key:'edit', label:() => 'Edit users'}, {key:'deactivate', label:() => 'Deactivate users'}, {key:'delete', label:() => 'Delete users'}]
          .map(a => ({...a, scopes:USERS_SCOPES, noLife:true, allowed:!viewOnly}))}/>
    );
    if(tab === 'Permission Management') return (
      <PermissionTable title="User permissions" obj={{key:'permissions', noun:'User', plural:'Users'}} idKey="admin-permissions" value={getAt([...admin, 'permissions'])}
        set={(key, patch)=>setAt([...admin, 'permissions'], key, patch)}
        rows={[{key:'assign', label:() => 'Assign permissions'}, {key:'edit', label:() => 'Edit permissions'}].map(a => ({...a, scopes:USERS_SCOPES, noLife:true, allowed:!viewOnly}))}/>
    );
    return null;
  };
  return (
    <div style={{display:'flex', borderTop:`1px solid ${T.borderStrong}`, minHeight:480}}>
      {/* Left — categories; selecting one swaps the right-hand content. */}
      <div style={{width:200, flexShrink:0, borderRight:'1px solid #EFEFEF', padding:12, display:'flex', flexDirection:'column', gap:14}}>
        <span style={{fontSize:14, fontWeight:500, color:T.black}}>Permissions</span>
        <div style={{position:'relative'}}>
          <div style={{position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', display:'flex'}}><Icon name="search" size={14} color={T.gray600}/></div>
          <input value={find} onChange={e=>setFind(e.target.value)} placeholder="Find or Ask"
            style={{width:'100%', height:28, boxSizing:'border-box', padding:'0 10px 0 32px', fontSize:13, border:'1px solid #EFEFEF', borderRadius:8, background:'#FDFDFD', fontFamily:'inherit'}}/>
        </div>
        <div style={{display:'flex', flexDirection:'column', gap:6}}>
          {categories.map(c => (
            <div key={c} onClick={()=>{ setCategory(c); const t = (PERMISSION_TABS[c] || []).find(x => f && x.toLowerCase().includes(f)); if(t) setTabs(x => ({...x, [c]:t})); }}
              style={{minHeight:29, display:'flex', alignItems:'center', padding:'4px 8px', borderRadius:6, cursor:'pointer',
              fontSize:13, color: category === c ? '#fff' : T.black, background: category === c ? T.black : 'transparent'}}>{c}</div>
          ))}
        </div>
      </div>

      {/* Right — the selected category, with its horizontal tabs. */}
      <div style={{flex:1, minWidth:0, padding:12, display:'flex', flexDirection:'column', gap:16}}>
        {PERMISSION_TABS[category] && (
          <div style={{display:'flex', gap:8, borderBottom:`1px solid ${T.borderStrong}`, overflowX:'auto', flexShrink:0}}>
            {PERMISSION_TABS[category].map(t => <UtTab key={t} label={t} active={tab === t} onClick={()=>setTabs(x => ({...x, [category]:t}))}/>)}
          </div>
        )}
        {viewOnly && category === 'Settings & Administration' && <div style={stTextB}>A View Seat can't be given Settings & Administration permissions.</div>}
        {readOnly && <div style={stTextB}>You can view these permissions but not change them.</div>}
        {readOnly ? <div aria-disabled="true" style={{pointerEvents:'none', display:'flex', flexDirection:'column', gap:16}}>{body()}</div> : body()}
      </div>
    </div>
  );
}

const copyMatrix = (m) => JSON.parse(JSON.stringify(m));

/* Edit Permissions for one user: Select Seat → Choose how to access → (manual) Permission
   Preset + matrix. The seat sets what can be granted; the preset sets what is granted. */
/* Permission Management: Assign — the seat, how access is given and the preset; Edit — the
   permission matrix (and saving it as a preset). What the signed-in user can't change shows locked. */
const Locked = ({on, note, children}) => on ? children : (
  <div style={{display:'flex', flexDirection:'column', gap:8}}>
    <div style={stTextB}>{note}</div>
    <div aria-disabled="true" style={{pointerEvents:'none', opacity:.6}}>{children}</div>
  </div>
);
function EditPermissionsDrawer({user, seats, presets, onClose, onSave, onStub, onCreatePreset}){
  const assignOk = userAdminCan('permissions', 'assign', user), editOk = userAdminCan('permissions', 'edit', user);
  const startSeat = user.seat || 'View Seat';
  const [seat, setSeat] = React.useState(startSeat);
  const [access, setAccess] = React.useState(user.access || 'manual');
  // Presets belong to a seat type: only the selected seat's presets are offered.
  const presetsFor = (type) => presets.filter(p => p.seat === type).map(p => p.name);
  const [preset, setPreset] = React.useState(presetsFor(startSeat).includes(user.preset) ? user.preset : (presetsFor(startSeat)[0] || ''));
  const matrixOfPreset = (name, type) => { const p = presets.find(x => x.name === name && x.seat === type); return p ? normalizePermissions(copyMatrix(p.permissions)) : null; };
  // A user on a real preset keeps their own permissions; otherwise start from the selected preset.
  const [perms, setPerms] = React.useState(() => normalizePermissions((presetsFor(startSeat).includes(user.preset) && user.permissions)
    || matrixOfPreset(preset, startSeat)));
  // Changing the seat switches to that seat's first preset and applies it.
  React.useEffect(()=>{
    const names = presetsFor(seat);
    if(!names.includes(preset)){ setPreset(names[0] || ''); const m = matrixOfPreset(names[0], seat); if(m) setPerms(m); }
  }, [seat]);
  /* Choosing a preset applies its matrix. Save Permission Preset is enabled only once the
     permissions deviate from the selected preset, and saves them as a new preset. */
  const presetDef = presets.find(p => p.name === preset && p.seat === seat);
  const choosePreset = (name) => {
    setPreset(name);
    const m = matrixOfPreset(name, seat);
    if(m) setPerms(m);
  };
  const deviates = !presetDef || JSON.stringify(perms) !== JSON.stringify(normalizePermissions(presetDef.permissions));
  const [namingPreset, setNamingPreset] = React.useState(false);
  const def = seatDef(seat);

  /* "Make super Admin" (Full Seat) / "Grant all view permissions" (View Seat) applies that seat's
     all-access preset — Super Admin / Viewer — with its matrix. */
  const save = () => access === 'all'
    ? onSave({seat, access, preset:def.allPreset, permissions:matrixOfPreset(def.allPreset, seat) || perms})
    : onSave({seat, access, preset, permissions:perms});

  return (<>
    <PermissionsDrawerFrame title="Edit Permissions" subtitle={user.name} onClose={onClose} onSave={save}>
      <Locked on={assignOk} note="You can't assign this user's seat, access or preset.">
      <div style={{display:'flex', flexDirection:'column', gap:24}}>
      {/* 1 — the seat type, with what's left of it; everything below follows from it. */}
      <div style={{display:'flex', flexDirection:'column', gap:12}}>
        <StField label="Select Seat">
          <StSelect value={seat} onChange={setSeat} options={SEAT_TYPES.map(st => {
            const n = seatsAvailable(seats, st.key, user.id);
            return {value:st.key, label:`${st.key}: ${availableLabel(n)}`, disabled: n <= 0 && st.key !== user.seat};
          })}/>
        </StField>
        <div style={stTextB}>
          <span style={{color:T.black, fontWeight:500}}>{availableLabel(seatsAvailable(seats, seat, user.id))}</span> · {def.description}
        </div>
      </div>

      {/* 2 — how access is given on this seat. */}
      <div style={{display:'flex', flexDirection:'column', gap:12}}>
        <span style={{fontSize:14, fontWeight:500, color:T.black}}>Choose how to access</span>
        <div style={{display:'flex', gap:12}}>
          <StRadioCard selected={access === 'manual'} title={def.manualTitle} description={def.manualDescription} onSelect={()=>setAccess('manual')}/>
          <StRadioCard selected={access === 'all'} title={def.allTitle} description={def.allDescription} onSelect={()=>setAccess('all')}/>
        </div>
      </div>
      </div>
      </Locked>

      {/* Granting everything on the seat leaves nothing to choose, so the preset and the
          editor apply only to manually assigned access. */}
      {access === 'manual' && (<>
        {/* The preset sits in its own bordered section, set apart from the permission matrix. */}
        <div style={{display:'flex', alignItems:'flex-end', gap:16, border:`1px solid ${T.borderStrong}`, borderRadius:12, padding:16}}>
          <div style={{display:'flex', flexDirection:'column', gap:8, minWidth:0}}>
            <StField label="Choose a Permission Preset"><Locked on={assignOk} note=""><StSelect value={preset} options={presetsFor(seat)} onChange={choosePreset}/></Locked></StField>
            <div style={stTextB}>Apply a ready-made permission matrix to this user with a preset.</div>
          </div>
          <div style={{marginLeft:'auto', paddingBottom:24}}>
            <StSecondary label="Save Permission Preset" disabled={!deviates || !editOk} onClick={()=>setNamingPreset(true)}/>
          </div>
        </div>
        <PermissionMatrixEditor seat={seat} perms={perms} setPerms={setPerms} readOnly={!editOk}/>
      </>)}
    </PermissionsDrawerFrame>
    {namingPreset && <SavePresetModal seat={seat} presets={presets} onCancel={()=>setNamingPreset(false)}
      onSave={(name) => {
        onCreatePreset({id:`pp-${Date.now()}`, name, seat, permissions:copyMatrix(perms)});
        setPreset(name); setNamingPreset(false);
      }}/>}
  </>);
}

/* Edit preset (Permission Presets → row ⋯): the preset's own matrix, for its seat type. Saving
   updates the preset; users already on it keep the permissions they were saved with. */
function EditPresetDrawer({preset, onClose, onSave}){
  const [perms, setPerms] = React.useState(() => normalizePermissions(copyMatrix(preset.permissions)));
  return (
    <PermissionsDrawerFrame title="Edit Permission Preset" subtitle={`${preset.name} · ${preset.seat}`} onClose={onClose} onSave={()=>onSave(perms)}>
      <PermissionMatrixEditor seat={preset.seat} perms={perms} setPerms={setPerms}/>
    </PermissionsDrawerFrame>
  );
}

/* Name the new preset: the current permissions are saved as a preset for this seat type. */
function SavePresetModal({seat, presets, onCancel, onSave}){
  const [name, setName] = React.useState('');
  const n = name.trim();
  const taken = presets.some(p => p.name.toLowerCase() === n.toLowerCase());
  return (
    <StModal title="Save Permission Preset" primary="Save preset" canSubmit={!!n && !taken} onCancel={onCancel} onSubmit={()=>onSave(n)}>
      <div style={stTextB}>Saves these permissions as a new {seat} preset, available in Permission Presets.</div>
      <div>
        <label style={fieldLabel} htmlFor="preset-name">Preset name</label>
        <input id="preset-name" autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Senior Consultant" style={fieldInput}
          onKeyDown={e=>{ if(e.key === 'Enter' && n && !taken) onSave(n); }}/>
        {taken && <div style={{fontSize:12, color:T.red, marginTop:4}}>A preset with this name already exists.</div>}
      </div>
    </StModal>
  );
}

Object.assign(window, {UserEditPanel, saveUserProfileIn, nameFromEmail, memberFromSession, withSessionMember, EMPTY_PEOPLE_DATA, RecordAccessCtx, useRecordAccess, normalizePermissions, setAccessContext, accessUser, toolCan, visibleActivities, activityCan, canAdd, PERMISSION_TOOLS, EditPresetDrawer, PermissionMatrixEditor, UsersTeamsSettings, UsersModule, SeatsModule, TeamsModule, PresetsModule, RecordViewsModule, SAMPLE_USERS, SAMPLE_PEOPLE_DATA, EditPermissionsDrawer});
