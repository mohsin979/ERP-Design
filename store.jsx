/* HOF Pulse ERP — Saved state, record IDs and the user directory.

   One store for everything that should survive a reload: records (contacts, deals, their
   activity, Customer Profiles), everything in Settings, the CRM navigation, saved views and
   layout settings (card / panel settings) and the workflow engine's state. Each owner keeps its
   own slice (persistSlice / usePersistedState); every change rewrites the whole store at once
   (one key, one JSON), so slices saved together always belong together. Where it's saved: DB
   below — SQLite through serve.py on localhost, else the browser's localStorage.

   Record IDs come from a counter per object that only goes up and is saved with the store, so an
   ID is never handed out twice — not after a delete, not after a reload.

   Owners (and anyone else a record points at) are stored as user IDs from Users; the directory
   turns an ID back into a name wherever one is shown. */

/* ── Where it's saved (DB) ── on this prototype's own server (serve.py, localhost) everything is
   kept in its SQLite database (data/hof-erp.sqlite) through /api/kv; anywhere else (the hosted
   copy) in the browser's localStorage. One interface, synchronous like localStorage — getItem,
   setItem, removeItem, keys: the server's data is read once when the page loads, every write goes
   out at once in the background, each with a version so an older write arriving late never
   replaces a newer one; `flush()` sends what's still on its way before the page reloads, and
   `fresh(key)` reads one value again (something another tab saved). On its first run with SQLite,
   what this browser had saved comes along (localStorage is left as it was). */
const DB = (() => {
  const ls = window.localStorage;
  const http = (method, url, body, async) => { const x = new XMLHttpRequest(); x.open(method, url, async); x.setRequestHeader('Content-Type', 'text/plain;charset=utf-8'); return [x, () => x.send(body == null ? null : body)]; };
  let cache = null;
  try {
    const [x, go] = http('GET', '/api/kv', null, false); go();
    if(x.status === 200 && /json/.test(x.getResponseHeader('Content-Type') || '')) cache = JSON.parse(x.responseText);
  } catch(e){}
  if(!cache) return {sqlite:false, getItem:(k) => ls.getItem(k), setItem:(k, v) => ls.setItem(k, v), removeItem:(k) => ls.removeItem(k), keys:() => Object.keys(ls), flush(){}, fresh:(k) => ls.getItem(k)};
  const IMPORTED = 'meta:imported-localstorage';
  if(!(IMPORTED in cache)){
    const take = {};
    try { Object.keys(ls).filter(k => /^hof-erp/.test(k) && !(k in cache)).forEach(k => { take[k] = ls.getItem(k); }); } catch(e){}
    take[IMPORTED] = new Date().toISOString();
    try { const [, go] = http('POST', '/api/kv', JSON.stringify(take), false); go(); Object.assign(cache, take); } catch(e){ console.warn('HOF ERP: could not bring saved data into SQLite', e); }
  }
  let ver = Date.now() * 1000;
  const pending = new Map();   // key → the version still on its way
  const send = (method, k, value, sync) => {
    const v = ++ver; pending.set(k, v);
    const [x, go] = http(method, `/api/kv/${encodeURIComponent(k)}`, value, !sync);
    x.setRequestHeader('X-Ver', String(v));
    if(!sync) x.onloadend = () => { if(pending.get(k) === v && x.status >= 200 && x.status < 300) pending.delete(k); };
    go();
    if(sync && x.status >= 200 && x.status < 300 && pending.get(k) === v) pending.delete(k);
  };
  return {
    sqlite:true,
    getItem:(k) => Object.prototype.hasOwnProperty.call(cache, k) ? cache[k] : null,
    setItem:(k, v) => { cache[k] = String(v); send('PUT', k, cache[k]); },
    removeItem:(k) => { delete cache[k]; send('DELETE', k, null); },
    keys:() => Object.keys(cache),
    // Before a reload: anything not confirmed yet goes again, and waits.
    flush:() => { [...pending.keys()].forEach(k => { try { if(k in cache) send('PUT', k, cache[k], true); else send('DELETE', k, null, true); } catch(e){} }); },
    fresh:(k) => { try { const [x, go] = http('GET', `/api/kv/${encodeURIComponent(k)}`, null, false); go();
      if(x.status === 200){ cache[k] = x.responseText; return cache[k]; } if(x.status === 404){ delete cache[k]; return null; } } catch(e){} return Object.prototype.hasOwnProperty.call(cache, k) ? cache[k] : null; },
  };
})();

/* ── Workspaces ── each workspace is one of the organizations, its own account environment: its
   own saved store (records, CRM settings and its users' CRM roles — everything below). The
   registry (its own key) is what they share: the workspaces — name, `region` (shown in
   organization lists: "HOF Migration (Pakistan)"), logo, brand colours, `template`, `hidden` —
   which one is open, who is signed in (mocked Google sign-in, workspaces.jsx), and:
     users    — one identity per person ({id, name, email}), whichever workspaces they belong to;
     members  — per workspace, who can access it ({[workspaceId]: [{userId}]}); a workspace with no
                list yet takes its own Users once (app.jsx);
     modules  — per ERP module, the organizations that have it (`orgs`) and its linkage groups
                (`groups`: [{id, orgs}] — the organizations in a group share that module's data;
                any number of groups per module, an organization in at most one) — ERP Settings
                → Module Settings. Availability, linkage and access are independent.
   A module's data for an organization lives in its own space or its group's (moduleLinks.jsx):
   CRM — this whole store (APP_STORE_KEY: the organization's own, or its CRM group's).
   HOF Migration keeps the store it always had and starts with the sample data; a workspace made
   from a template (WORKSPACE_TEMPLATES, workspaces.jsx) starts with that template's setup; any
   other starts empty. Hidden workspaces keep their data but aren't offered. */
const WORKSPACES_KEY = 'hof-erp-workspaces-v1';
const HOF_MIGRATION_WS = 'ws-hof-migration';
const DEFAULT_BRAND = () => ({primary:'#15141B', secondary:'#FF0004'});
// HOF Migration's brand: black primary, blue secondary.
const HOF_MIGRATION_BRAND = () => ({primary:'#000000', secondary:'#1869EC'});
/* The organizations, in this order. HOF Migration (Pakistan) and HOF Partners (Pakistan — the
   former Accounting workspace, its id kept) are defined; HOF Global, HOF Migration Dubai and HOF
   Pack open empty until they're defined. */
const HOF_PARTNERS_WS = 'ws-accounting';
const DEFAULT_WORKSPACES = () => [
  {id:'ws-hof-global',          name:'HOF Global',          logo:null, colors:DEFAULT_BRAND(), sample:false, createdAt:'2026-10-16'},
  {id:HOF_MIGRATION_WS,         name:'HOF Migration',       region:'Pakistan', logo:null, colors:HOF_MIGRATION_BRAND(), sample:true, createdAt:'2026-08-01'},
  {id:'ws-hof-migration-dubai', name:'HOF Migration Dubai', logo:null, colors:DEFAULT_BRAND(), sample:false, createdAt:'2026-11-06'},
  {id:'ws-hof-pack',            name:'HOF Pack',            logo:null, colors:DEFAULT_BRAND(), sample:false, createdAt:'2026-11-06'},
  {id:HOF_PARTNERS_WS,          name:'HOF Partners',        region:'Pakistan', logo:null, colors:DEFAULT_BRAND(), sample:false, createdAt:'2026-11-06', template:'accounting'},
];
// Who can access an organization at first: the Super Admin (HOF Migration takes its own Users, app.jsx).
const DEFAULT_MEMBERS = () => Object.fromEntries(DEFAULT_WORKSPACES().filter(w => w.id !== HOF_MIGRATION_WS).map(w => [w.id, [{userId:'waleed-bin-zaman'}]]));
/* Which organizations have each module at first: HOF Migration every one; HOF Partners CRM and
   People; People linked between the two (one group). The undefined ones none. */
const DEFAULT_MODULES = () => ({
  crm:{orgs:[HOF_MIGRATION_WS, HOF_PARTNERS_WS], groups:[]},
  people:{orgs:[HOF_MIGRATION_WS, HOF_PARTNERS_WS], groups:[{id:'g-people-1', orgs:[HOF_MIGRATION_WS, HOF_PARTNERS_WS]}]},
  ...Object.fromEntries(['marketing', 'accounting', 'analytics', 'academy', 'complience'].map(id => [id, {orgs:[HOF_MIGRATION_WS], groups:[]}])),
});
// Modules saved with one `linked` list (before groups) have it as their one group.
const normalizeModules = (mods) => Object.fromEntries(Object.entries(mods || {}).map(([id, m]) => {
  const {linked, ...rest} = m || {};
  const groups = m && Array.isArray(m.groups) ? m.groups : linked && linked.length > 1 ? [{id:`g-${id}-1`, orgs:linked}] : [];
  return [id, {orgs:(m && m.orgs) || [], ...rest, groups}];
}));
/* Registry layout 2: Accounting added; HOF Global and created workspaces hidden from the switcher
   (data kept). Layout 3: the five organizations — HOF Global shown again, HOF Migration Dubai and
   HOF Pack added, Accounting renamed HOF Partners; regions. */
const REGISTRY_LAYOUT = 3;
const WORKSPACE_REGISTRY = (() => {
  let r = null;
  try { const raw = DB.getItem(WORKSPACES_KEY); r = raw ? JSON.parse(raw) : null; } catch(e){}
  let workspaces = r && Array.isArray(r.workspaces) && r.workspaces.length ? r.workspaces : DEFAULT_WORKSPACES();
  // HOF Migration saved before it had its own colours (still the untouched default) takes them.
  const old = DEFAULT_BRAND();
  workspaces = workspaces.map(w => w.id === HOF_MIGRATION_WS && (!w.colors || (w.colors.primary === old.primary && w.colors.secondary === old.secondary)) ? {...w, colors:HOF_MIGRATION_BRAND()} : w);
  if(!r || (r.layout || 0) < REGISTRY_LAYOUT){
    const defs = DEFAULT_WORKSPACES(), orgIds = defs.map(w => w.id);
    // The organizations in their order (each keeps what was saved for it), then any other — hidden.
    const org = (d) => { const w = workspaces.find(x => x.id === d.id); if(!w) return d;
      const {hidden, ...rest} = w; return {...rest, region:w.region || d.region, ...(w.id === HOF_PARTNERS_WS && w.name === 'Accounting' ? {name:d.name} : {})}; };
    workspaces = [...defs.map(org), ...workspaces.filter(w => !orgIds.includes(w.id)).map(w => ({...w, hidden:true}))];
  }
  const shown = workspaces.filter(w => !w.hidden);
  const activeId = r && shown.some(w => w.id === r.activeId) ? r.activeId : shown[0].id;
  return {workspaces, activeId, session: (r && r.session) || null, accounts:(r && r.accounts) || [], layout:REGISTRY_LAYOUT,
    users:(r && r.users) || [], members:{...DEFAULT_MEMBERS(), ...((r && r.members) || {})}, modules:normalizeModules((r && r.modules) || DEFAULT_MODULES())};
})();
const ACTIVE_WORKSPACE = WORKSPACE_REGISTRY.workspaces.find(w => w.id === WORKSPACE_REGISTRY.activeId);
// The open workspace's template (its CRM setup when it starts), if it was made from one.
const WORKSPACE_TEMPLATE = ACTIVE_WORKSPACE.template || null;
function saveWorkspaceRegistry(patch){
  Object.assign(WORKSPACE_REGISTRY, patch);
  try { DB.setItem(WORKSPACES_KEY, JSON.stringify(WORKSPACE_REGISTRY)); } catch(e){ console.warn('HOF ERP: could not save workspaces', e); }
}
// Opening another workspace (or signing in or out) loads its own store: the page starts over.
function reloadInto(patch){ if(appStoreTimer) writeAppStore(); saveWorkspaceRegistry(patch); DB.flush(); window.location.reload(); }
// A module's linkage group holding an organization, if any.
const moduleGroupOf = (moduleId, wsId) => ((((WORKSPACE_REGISTRY.modules || {})[moduleId] || {}).groups) || []).find(g => (g.orgs || []).includes(wsId)) || null;
// An organization's own store, and the store its CRM uses — its CRM group's when linked.
const ownStoreKey = (wsId) => wsId === HOF_MIGRATION_WS ? 'hof-erp-store-v2' : `hof-erp-store-v2:${wsId}`;
const crmStoreKey = (wsId) => { const g = moduleGroupOf('crm', wsId); return g ? `hof-erp-space:crm:${g.id}` : ownStoreKey(wsId); };
const APP_STORE_KEY = crmStoreKey(ACTIVE_WORKSPACE.id);
// Dates are saved as ISO strings (JSON) and come back as Dates.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const APP_SAVED = (() => {
  try {
    const raw = DB.getItem(APP_STORE_KEY);
    return raw ? JSON.parse(raw, (k, v) => typeof v === 'string' && ISO_DATE_RE.test(v) ? new Date(v) : v) : null;
  } catch(e){ return null; }
})();
const appStore = {...(APP_SAVED || {})};
let appStoreTimer = null, appStoreCleared = false;
/* Saved with each record and configuration item its organization (`org`) — the one open when it
   was saved without one — so a linked module's data can go back with its organization. */
const stampOrg = (list, org) => Array.isArray(list) ? list.map(x => x && typeof x === 'object' && !x.org ? {...x, org} : x) : list;
function stampStoreOrigins(s, org){
  const st = s.settings;
  return {...s, contacts:stampOrg(s.contacts, org), deals:stampOrg(s.deals, org), customers:stampOrg(s.customers, org), services:stampOrg(s.services, org), forms:stampOrg(s.forms, org),
    ...(st ? {settings:{...st, pipelines:stampOrg(st.pipelines, org), workflows:stampOrg(st.workflows, org), profileForms:stampOrg(st.profileForms, org),
      properties:Array.isArray(st.properties) ? st.properties.map(p => p && !p.system && !p.org ? {...p, org} : p) : st.properties}} : {})};
}
function writeAppStore(){
  clearTimeout(appStoreTimer); appStoreTimer = null;
  if(appStoreCleared) return;
  try { DB.setItem(APP_STORE_KEY, JSON.stringify({...stampStoreOrigins(appStore, ACTIVE_WORKSPACE.id), version:2, savedAt:Date.now()})); }
  catch(e){ console.warn('HOF ERP: could not save', e); }
}
function persistSlice(name, value){
  appStore[name] = value;
  if(!appStoreTimer) appStoreTimer = setTimeout(writeAppStore, 120);
}
// Anything not yet written goes out before the page closes.
window.addEventListener('beforeunload', () => { if(appStoreTimer) writeAppStore(); });
// Stop saving (the page reloads into a store a link or unlink just rewrote — moduleLinks.jsx).
function freezeAppStore(){ if(appStoreTimer) writeAppStore(); appStoreCleared = true; DB.flush(); }
// Start over with the sample data (testing): forget the saved store, and don't save it back.
function resetAppStore(){ appStoreCleared = true; try { DB.removeItem(APP_STORE_KEY); if(ACTIVE_WORKSPACE.sample) DB.removeItem('hof-erp-workflow-engine-v1'); } catch(e){} }
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

Object.assign(window, {DB, moduleGroupOf, ownStoreKey, crmStoreKey, APP_STORE_KEY, stampStoreOrigins, stampOrg, freezeAppStore, WORKSPACE_TEMPLATE, HOF_PARTNERS_WS, WORKSPACE_REGISTRY, ACTIVE_WORKSPACE, HOF_MIGRATION_WS, DEFAULT_BRAND, saveWorkspaceRegistry, reloadInto, APP_SAVED, persistSlice, usePersistedState, savedSlice, resetAppStore, newRecordId, ensureIdFloor, idFloorOf, setUserDirectory, userLabel, userIdOf, writeAppStore});
