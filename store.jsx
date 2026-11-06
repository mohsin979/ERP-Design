/* HOF Pulse ERP — Saved state, record IDs and the user directory.

   One store for everything that should survive a reload: records (contacts, deals, their
   activity, Customer Profiles), everything in Settings, the CRM navigation, saved views and
   layout settings (card / panel settings) and the workflow engine's state. Each owner keeps its
   own slice (persistSlice / usePersistedState); every change rewrites the whole store at once
   (one key, one JSON), so slices saved together always belong together.

   Record IDs come from a counter per object that only goes up and is saved with the store, so an
   ID is never handed out twice — not after a delete, not after a reload.

   Owners (and anyone else a record points at) are stored as user IDs from Users; the directory
   turns an ID back into a name wherever one is shown. */

/* ── Workspaces ── each workspace is its own account environment: its own saved store (records,
   CRM settings and its users' CRM roles — everything below). The registry (its own key) is what
   they share: the workspaces — name, logo, brand colours, `template`, `hidden` — which one is
   open, who is signed in (mocked Google sign-in, workspaces.jsx), and the people:
     users    — one identity per person ({id, name, email}), whichever workspaces they belong to;
     members  — per workspace, who belongs to it and the modules each may open
                ({[workspaceId]: [{userId, modules}]}); a workspace with no list yet takes its own
                Users once (app.jsx).
   HOF Migration keeps the store it always had and starts with the sample data; a workspace made
   from a template (WORKSPACE_TEMPLATES, workspaces.jsx) starts with that template's setup; any
   other starts empty. Hidden workspaces keep their data but aren't offered. */
const WORKSPACES_KEY = 'hof-erp-workspaces-v1';
const HOF_MIGRATION_WS = 'ws-hof-migration';
const DEFAULT_BRAND = () => ({primary:'#15141B', secondary:'#FF0004'});
// HOF Migration's brand: black primary, blue secondary.
const HOF_MIGRATION_BRAND = () => ({primary:'#000000', secondary:'#1869EC'});
const ACCOUNTING_WS = 'ws-accounting';
const DEFAULT_WORKSPACES = () => [
  {id:HOF_MIGRATION_WS, name:'HOF Migration', logo:null, colors:HOF_MIGRATION_BRAND(), sample:true, createdAt:'2026-08-01'},
  {id:'ws-hof-global',  name:'HOF Global',    logo:null, colors:DEFAULT_BRAND(), sample:false, createdAt:'2026-10-16', hidden:true},
  {id:ACCOUNTING_WS,    name:'Accounting',    logo:null, colors:DEFAULT_BRAND(), sample:false, createdAt:'2026-11-06', template:'accounting'},
];
// The Accounting workspace's first member: the Super Admin, with CRM and People (HRMS).
const DEFAULT_MEMBERS = () => ({[ACCOUNTING_WS]:[{userId:'waleed-bin-zaman', modules:['crm', 'people']}]});
// Registry layout 2: Accounting added; HOF Global and created workspaces hidden from the switcher (data kept).
const REGISTRY_LAYOUT = 2;
const WORKSPACE_REGISTRY = (() => {
  let r = null;
  try { const raw = window.localStorage.getItem(WORKSPACES_KEY); r = raw ? JSON.parse(raw) : null; } catch(e){}
  let workspaces = r && Array.isArray(r.workspaces) && r.workspaces.length ? r.workspaces : DEFAULT_WORKSPACES();
  // HOF Migration saved before it had its own colours (still the untouched default) takes them.
  const old = DEFAULT_BRAND();
  workspaces = workspaces.map(w => w.id === HOF_MIGRATION_WS && (!w.colors || (w.colors.primary === old.primary && w.colors.secondary === old.secondary)) ? {...w, colors:HOF_MIGRATION_BRAND()} : w);
  if(!r || (r.layout || 0) < REGISTRY_LAYOUT){
    const acc = DEFAULT_WORKSPACES().find(w => w.id === ACCOUNTING_WS);
    workspaces = [...workspaces.map(w => w.id === HOF_MIGRATION_WS || w.id === ACCOUNTING_WS ? w : {...w, hidden:true}), ...(workspaces.some(w => w.id === ACCOUNTING_WS) ? [] : [acc])];
  }
  const shown = workspaces.filter(w => !w.hidden);
  const activeId = r && shown.some(w => w.id === r.activeId) ? r.activeId : shown[0].id;
  return {workspaces, activeId, session: (r && r.session) || null, accounts:(r && r.accounts) || [], layout:REGISTRY_LAYOUT,
    users:(r && r.users) || [], members:{...DEFAULT_MEMBERS(), ...((r && r.members) || {})}};
})();
const ACTIVE_WORKSPACE = WORKSPACE_REGISTRY.workspaces.find(w => w.id === WORKSPACE_REGISTRY.activeId);
// The open workspace's template (its CRM setup when it starts), if it was made from one.
const WORKSPACE_TEMPLATE = ACTIVE_WORKSPACE.template || null;
function saveWorkspaceRegistry(patch){
  Object.assign(WORKSPACE_REGISTRY, patch);
  try { window.localStorage.setItem(WORKSPACES_KEY, JSON.stringify(WORKSPACE_REGISTRY)); } catch(e){ console.warn('HOF ERP: could not save workspaces', e); }
}
// Opening another workspace (or signing in or out) loads its own store: the page starts over.
function reloadInto(patch){ if(appStoreTimer) writeAppStore(); saveWorkspaceRegistry(patch); window.location.reload(); }
const APP_STORE_KEY = ACTIVE_WORKSPACE.id === HOF_MIGRATION_WS ? 'hof-erp-store-v2' : `hof-erp-store-v2:${ACTIVE_WORKSPACE.id}`;
// Dates are saved as ISO strings (JSON) and come back as Dates.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const APP_SAVED = (() => {
  try {
    const raw = window.localStorage.getItem(APP_STORE_KEY);
    return raw ? JSON.parse(raw, (k, v) => typeof v === 'string' && ISO_DATE_RE.test(v) ? new Date(v) : v) : null;
  } catch(e){ return null; }
})();
const appStore = {...(APP_SAVED || {})};
let appStoreTimer = null, appStoreCleared = false;
function writeAppStore(){
  clearTimeout(appStoreTimer); appStoreTimer = null;
  if(appStoreCleared) return;
  try { window.localStorage.setItem(APP_STORE_KEY, JSON.stringify({...appStore, version:2, savedAt:Date.now()})); }
  catch(e){ console.warn('HOF ERP: could not save', e); }
}
function persistSlice(name, value){
  appStore[name] = value;
  if(!appStoreTimer) appStoreTimer = setTimeout(writeAppStore, 120);
}
// Anything not yet written goes out before the page closes.
window.addEventListener('beforeunload', () => { if(appStoreTimer) writeAppStore(); });
// Start over with the sample data (testing): forget the saved store, and don't save it back.
function resetAppStore(){ appStoreCleared = true; try { window.localStorage.removeItem(APP_STORE_KEY); if(ACTIVE_WORKSPACE.sample) window.localStorage.removeItem('hof-erp-workflow-engine-v1'); } catch(e){} }
const savedSlice = (name) => APP_SAVED && Object.prototype.hasOwnProperty.call(APP_SAVED, name) ? APP_SAVED[name] : undefined;
/* useState that's saved: starts from the saved slice when there is one (else `init`), and saves
   every change. `name` is the slice — one per piece of state. */
// `adapt` (optional): applied to the value it starts from — saved or initial (e.g. sample records added once).
// `pack` (optional): the form it's saved in (`adapt` reads it back).
function usePersistedState(name, init, adapt, pack){
  const [v, setV] = React.useState(() => { const s = savedSlice(name); const v0 = s !== undefined ? s : (typeof init === 'function' ? init() : init); return adapt ? adapt(v0) : v0; });
  React.useEffect(() => { persistSlice(name, pack ? pack(v) : v); }, [v]);
  return [v, setV];
}

/* ── Record IDs ── `floor`: the lowest ID still free (from the records that exist), so the counter
   never starts below an ID already in use. Contacts are numbered (1, 2, …); other objects are
   "<prefix>-<n>". */
const RECORD_ID_PREFIX = {deals:'deal', customers:'cust'};
function ensureIdFloor(object, floor){
  const ids = appStore.ids || {};
  if((ids[object] || 0) >= floor) return;
  persistSlice('ids', {...ids, [object]:floor});
}
function newRecordId(object){
  const ids = appStore.ids || {};
  const n = ids[object] || 1;
  persistSlice('ids', {...ids, [object]:n + 1});
  return RECORD_ID_PREFIX[object] ? `${RECORD_ID_PREFIX[object]}-${n}` : n;
}
// The next free number after the records' own IDs (numbers, or "<prefix>-<n>").
const idFloorOf = (records) => records.reduce((mx, r) => {
  const n = typeof r.id === 'number' ? r.id : Number(String(r.id).split('-').pop());
  return Number.isFinite(n) && n < 1e9 ? Math.max(mx, n) : mx;   // timestamp IDs from older saves don't move the counter
}, 0) + 1;

/* ── User directory ── App registers Users on every render; records hold user IDs. */
let USER_DIRECTORY = [];
const setUserDirectory = (users) => { USER_DIRECTORY = users || []; };
// The name for a stored user reference (an ID; older data may hold a name — shown as it is).
const userLabel = (v) => { if(!v) return ''; const u = USER_DIRECTORY.find(x => x.id === v); return u ? u.name : String(v); };
// A user reference as an ID: an ID stays, a name is looked up, anything else is no user.
const userIdOf = (v, users = USER_DIRECTORY) => { if(!v) return ''; if(users.some(u => u.id === v)) return v; const u = users.find(x => x.name === v); return u ? u.id : ''; };

Object.assign(window, {WORKSPACE_TEMPLATE, ACCOUNTING_WS, WORKSPACE_REGISTRY, ACTIVE_WORKSPACE, HOF_MIGRATION_WS, DEFAULT_BRAND, saveWorkspaceRegistry, reloadInto, APP_SAVED, persistSlice, usePersistedState, savedSlice, resetAppStore, newRecordId, ensureIdFloor, idFloorOf, setUserDirectory, userLabel, userIdOf, writeAppStore});
