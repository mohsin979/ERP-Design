/* HOF Pulse ERP — Saved state, the Organization and its instances, record IDs and the user directory.

   One store per CRM instance for everything that should survive a reload: records (contacts,
   deals, their activity, Customer Profiles), everything in Settings, the CRM navigation, saved
   views and layout settings (card / panel settings) and the workflow engine's state. Each owner
   keeps its own slice (persistSlice / usePersistedState); every change rewrites the whole store
   at once (one key, one JSON), so slices saved together always belong together. Where it's saved:
   DB below — SQLite through serve.py on localhost, else the browser's localStorage.

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
      if(x.status === 200){ cache[k] = x.responseText; return cache[k]; } if(x.status === 204 || x.status === 404){ delete cache[k]; return null; } } catch(e){} return Object.prototype.hasOwnProperty.call(cache, k) ? cache[k] : null; },
  };
})();

/* ── The Organization ── one Organization (HOF Global) with module instances: the CRM instances
   (Migration, Partners, Pack — each with a CRM store of its own, everything below) and the People
   instances (Pakistan, Dubai — each with its own employees). The registry (ORG_KEY) is what they share:
     org     — its name and logo (the ERP's own mark — white label) and its brand (CRM → Marketing →
               Brand: the company logo, colours, email signature and letterhead — one for every CRM
               instance: quotations, documents, emails);
     crm     — the CRM branches (instances) [{id, name, sample, template, createdAt}]: `sample` the one with
               the sample data (Migration), `template` a CRM setup to start from (Partners:
               WORKSPACE_TEMPLATES, workspaces.jsx); any other starts empty, with the standard
               record types;
     people  — the People branches [{id, name, createdAt}];
     branches — the other modules' branches, by module id ({accounting:[{id, name, createdAt}], …}):
               Accounting, Analytics and Complience start with one (HOF Global), Academy with the
               CRM's three (DEFAULT_MODULE_BRANCHES — a module with nothing saved takes its default);
               nothing reads them yet but ERP Settings → Branches;
     users   — one identity per person: {id, name, email, role, peopleId, peopleAccess, crm,
               branches} — their
               Organization role (ORG_ROLES: Super Admin — ERP Settings, users and instances — or
               Member), the one People instance they belong to, a Super Admin's People instances,
               the CRM instances they can open, and their branches of the other modules (by
               module id). What they are in a CRM instance (preset, seat, team, permissions) is in
               that instance's store: its Users & Teams.
   Which CRM and People branches are open, who is signed in (mocked email sign-in,
   workspaces.jsx) and the accounts offered at sign-in are this browser's own (BROWSER_KEY,
   localStorage — with SQLite every browser and tab reads one registry). */
const ORG_KEY = 'hof-erp-org-v1';
const BROWSER_KEY = 'hof-erp-browser-v1';
const BROWSER_FIELDS = ['crmId', 'peopleId', 'openCrm', 'session', 'accounts'];   // `openCrm`: the page starts in the CRM (a switch from inside it)
const browserState = (() => { try { return JSON.parse(window.localStorage.getItem(BROWSER_KEY) || 'null'); } catch(e){ return null; } })();
const DEFAULT_BRAND = () => ({primary:'#15141B', secondary:'#FF0004'});
// HOF's brand colours: black primary, blue secondary.
const HOF_BRAND = () => ({primary:'#000000', secondary:'#1869EC'});
const CRM_MIGRATION = 'crm-migration', CRM_PARTNERS = 'crm-partners', CRM_PACK = 'crm-pack';
const PEOPLE_PAKISTAN = 'people-pakistan', PEOPLE_DUBAI = 'people-dubai';
const ORG_ROLES = ['Super Admin', 'Member'];
const DEFAULT_ORG = () => ({id:'hof-global', name:'HOF Global', logo:null, brand:{logo:null, colors:HOF_BRAND()}});
const DEFAULT_CRM_INSTANCES = () => [
  {id:CRM_MIGRATION, name:'Migration', sample:true, createdAt:'2026-08-01'},
  {id:CRM_PACK,      name:'Pack',      createdAt:'2026-11-09'},
  {id:CRM_PARTNERS,  name:'Partners',  template:'accounting', createdAt:'2026-11-06'},
];
const DEFAULT_PEOPLE_INSTANCES = () => [{id:PEOPLE_PAKISTAN, name:'Pakistan', createdAt:'2026-11-09'}, {id:PEOPLE_DUBAI, name:'Dubai', createdAt:'2026-11-09'}];
/* The other modules' branches at first: one company-wide branch each, named after the
   Organization (confirmed 2026-11-10), Academy the CRM's three. */
const DEFAULT_MODULE_BRANCHES = () => ({
  accounting:[{id:'accounting-hof-global', name:'HOF Global', createdAt:'2026-11-10'}],
  analytics: [{id:'analytics-hof-global',  name:'HOF Global', createdAt:'2026-11-10'}],
  academy:   [{id:'academy-migration', name:'Migration', createdAt:'2026-11-10'}, {id:'academy-pack', name:'Pack', createdAt:'2026-11-10'}, {id:'academy-partners', name:'Partners', createdAt:'2026-11-10'}],
  complience:[{id:'complience-hof-global', name:'HOF Global', createdAt:'2026-11-10'}],
});
// Who is there at first: the Super Admin, in Pakistan with both People branches and every CRM (Migration's sample users join when its CRM first opens — syncOrgUsers, workspaces.jsx).
const DEFAULT_ORG_USERS = () => [{id:'waleed-bin-zaman', name:'Waleed bin Zaman', email:'waleed.binzaman@hof-global.com', role:'Super Admin',
  peopleId:PEOPLE_PAKISTAN, peopleAccess:[PEOPLE_PAKISTAN, PEOPLE_DUBAI], crm:[CRM_MIGRATION, CRM_PACK, CRM_PARTNERS]}];
// A CRM branch's store, and a People branch's employees.
const crmStoreKey = (crmId) => `hof-erp-crm:${crmId}`;
const peopleStoreKey = (peopleId) => `hof-erp-people:${peopleId}`;
// A saved JSON value (other instances' stores, People), and saving one.
const readStore = (key) => { try { const raw = DB.getItem(key); return raw ? JSON.parse(raw) : null; } catch(e){ return null; } };
const writeStore = (key, value) => DB.setItem(key, JSON.stringify(value));

/* Saved before the Organization (hof-erp-workspaces-v1: five organizations — HOF Global, HOF
   Migration, HOF Migration Dubai, HOF Pack, HOF Partners — and module linkage groups sharing a
   module's data between them): HOF Migration's CRM (its group's store when linked) becomes the
   Migration branch's, HOF Partners' the Partners branch's; HOF Migration's People become
   Pakistan's (each person once); every user starts in Pakistan as the Organization's Super Admin
   with both People branches and every CRM branch (for now everyone is — workspaces.jsx
   EVERYONE_SUPER_ADMIN); HOF Migration's brand becomes the Organization's. The other
   organizations' stores (empty) and the old keys go. The browser's open organization becomes its
   CRM instance (LEGACY_CRM_OF — public form links from before open the same way, forms.jsx). */
const LEGACY_WORKSPACES_KEY = 'hof-erp-workspaces-v1';
const LEGACY_CRM_OF = {'ws-hof-migration':CRM_MIGRATION, 'ws-hof-migration-dubai':CRM_MIGRATION, 'ws-hof-global':CRM_MIGRATION, 'ws-accounting':CRM_PARTNERS, 'ws-hof-pack':CRM_PACK};
function migrateWorkspacesToOrg(){
  const old = readStore(LEGACY_WORKSPACES_KEY);
  if(!old) return null;
  const groupOf = (mod, ws) => ((((old.modules || {})[mod] || {}).groups) || []).find(g => (g.orgs || []).includes(ws)) || null;
  const ownKey = (ws) => ws === 'ws-hof-migration' ? 'hof-erp-store-v2' : `hof-erp-store-v2:${ws}`;
  const crmKey = (ws) => { const g = groupOf('crm', ws); return g ? `hof-erp-space:crm:${g.id}` : ownKey(ws); };
  // Each store moves (not copied: the browser's storage may not hold two of the largest).
  const move = (from, to) => { const v = DB.getItem(from); if(v == null) return; DB.removeItem(from); DB.setItem(to, v); };
  move(crmKey('ws-hof-migration'), crmStoreKey(CRM_MIGRATION));
  move(crmKey('ws-accounting'), crmStoreKey(CRM_PARTNERS));
  const pg = groupOf('people', 'ws-hof-migration');
  const peopleRaw = readStore(pg ? `hof-erp-space:people:${pg.id}` : 'hof-erp-space:people:org:ws-hof-migration') || (((readStore(ownKey('ws-hof-migration')) || {}).settings || {}).people) || [];
  const seen = new Set(), people = [];
  peopleRaw.forEach(p => { const em = String(p.email || '').toLowerCase(); if(!p || seen.has(em)) return; seen.add(em); const {org, ...x} = p; people.push({...x, id:String(x.id).split('--')[0], peopleId:PEOPLE_PAKISTAN}); });
  writeStore(peopleStoreKey(PEOPLE_PAKISTAN), people);
  const users = (old.users || []).map(u => ({id:u.id, name:u.name, email:u.email, role:'Super Admin', peopleId:PEOPLE_PAKISTAN, peopleAccess:[PEOPLE_PAKISTAN, PEOPLE_DUBAI], crm:[CRM_MIGRATION, CRM_PACK, CRM_PARTNERS]}));
  const mig = (old.workspaces || []).find(w => w.id === 'ws-hof-migration') || {};
  const brand = {logo:mig.logo || null, colors:mig.colors || HOF_BRAND(), ...Object.fromEntries(['palette', 'signature', 'letterhead'].filter(k => mig[k]).map(k => [k, mig[k]]))};
  // Responses left for an organization's forms go to its CRM instance's inbox (forms.jsx).
  Object.entries(LEGACY_CRM_OF).forEach(([ws, crmId]) => { const k = `hof-erp-form-inbox:${ws}`, v = readStore(k); if(v == null) return;
    writeStore(`hof-erp-form-inbox:${crmId}`, [...(readStore(`hof-erp-form-inbox:${crmId}`) || []), ...(Array.isArray(v) ? v : [])]); DB.removeItem(k); });
  DB.keys().filter(k => k === LEGACY_WORKSPACES_KEY || /^hof-erp-store-v2(:|$)|^hof-erp-space:|^hof-erp-people-shared-v1$/.test(k)).forEach(k => DB.removeItem(k));
  return {org:{...DEFAULT_ORG(), brand}, crm:DEFAULT_CRM_INSTANCES(), people:DEFAULT_PEOPLE_INSTANCES(), users, browser:{activeId:old.activeId, session:old.session, accounts:old.accounts}};
}
const ORG_LAYOUT = 1;
const ORG_REGISTRY = (() => {
  let r = readStore(ORG_KEY), legacy = null;
  if(!r){ const m = migrateWorkspacesToOrg(); if(m){ ({browser:legacy, ...r} = m); } }
  const reg = {org:{...DEFAULT_ORG(), ...((r && r.org) || {})}, crm: r && Array.isArray(r.crm) && r.crm.length ? r.crm : DEFAULT_CRM_INSTANCES(),
    people: r && Array.isArray(r.people) && r.people.length ? r.people : DEFAULT_PEOPLE_INSTANCES(), branches:{...DEFAULT_MODULE_BRANCHES(), ...((r && r.branches) || {})}, users:(r && r.users) || DEFAULT_ORG_USERS(), layout:ORG_LAYOUT};
  const b = browserState || legacy || {}, crmOf = (id) => reg.crm.some(c => c.id === id) ? id : reg.crm.some(c => c.id === LEGACY_CRM_OF[id]) ? LEGACY_CRM_OF[id] : null;
  const crmId = crmOf(b.crmId) || crmOf(b.activeId) || reg.crm[0].id;
  const peopleId = reg.people.some(p => p.id === b.peopleId) ? b.peopleId : reg.people[0].id;   // the open People branch
  const out = {...reg, crmId, peopleId, openCrm:!!b.openCrm, session:b.session || null, accounts:b.accounts || []};
  // Migrated (or nothing saved yet): saved now, so every browser and tab reads the same.
  if(!readStore(ORG_KEY)){ try { DB.setItem(ORG_KEY, JSON.stringify(Object.fromEntries(Object.entries(out).filter(([k]) => !BROWSER_FIELDS.includes(k))))); DB.flush(); } catch(e){ console.warn('HOF ERP: could not save the organization', e); } }
  return out;
})();
const ACTIVE_CRM = ORG_REGISTRY.crm.find(c => c.id === ORG_REGISTRY.crmId) || ORG_REGISTRY.crm[0];
// The open CRM branch's template (its CRM setup when it starts), if it was made from one.
const CRM_TEMPLATE = ACTIVE_CRM.template || null;
/* This browser's choices (BROWSER_KEY) in its localStorage; false when they couldn't be saved.
   With SQLite (localhost), what the browser kept in localStorage before (brought into SQLite once,
   never read again) can leave no room: when a save fails it's cleared and the save tried again.
   Elsewhere (the hosted copy) localStorage is where the data lives, so it's left as it is. */
function saveBrowserState(){
  const ls = window.localStorage, value = JSON.stringify(Object.fromEntries(BROWSER_FIELDS.map(k => [k, ORG_REGISTRY[k]])));
  try { ls.setItem(BROWSER_KEY, value); return true; }
  catch(e){
    if(DB.sqlite){ try { Object.keys(ls).filter(k => /^hof-erp/.test(k) && k !== BROWSER_KEY).forEach(k => ls.removeItem(k)); ls.setItem(BROWSER_KEY, value); return true; } catch(e2){} }
    console.warn('HOF ERP: could not save this browser’s choices', e);
    return false;
  }
}
// Returns whether this browser's choices were saved (sign-in checks it).
function saveOrgRegistry(patch){
  Object.assign(ORG_REGISTRY, patch);
  const saved = saveBrowserState();
  try { DB.setItem(ORG_KEY, JSON.stringify(Object.fromEntries(Object.entries(ORG_REGISTRY).filter(([k]) => !BROWSER_FIELDS.includes(k))))); } catch(e){ console.warn('HOF ERP: could not save the organization', e); }
  return saved;
}
// Opening another CRM branch (or signing in or out) loads its own store: the page starts over.
function reloadInto(patch){ if(appStoreTimer) writeAppStore(); saveOrgRegistry(patch); DB.flush(); window.location.reload(); }
// The Organization's brand (CRM → Marketing → Brand), its colours filled in — quotations, documents, emails.
const orgBrand = () => { const b = ORG_REGISTRY.org.brand || {}; return {...b, name:ORG_REGISTRY.org.name, colors:{...DEFAULT_BRAND(), ...(b.colors || {})}}; };
const APP_STORE_KEY = crmStoreKey(ACTIVE_CRM.id);
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
function writeAppStore(){
  clearTimeout(appStoreTimer); appStoreTimer = null;
  if(appStoreCleared) return;
  try { DB.setItem(APP_STORE_KEY, JSON.stringify({...appStore, version:2, savedAt:Date.now()})); }
  catch(e){ console.warn('HOF ERP: could not save', e); }
}
function persistSlice(name, value){
  appStore[name] = value;
  if(!appStoreTimer) appStoreTimer = setTimeout(writeAppStore, 120);
}
// Anything not yet written goes out before the page closes.
window.addEventListener('beforeunload', () => { if(appStoreTimer) writeAppStore(); });
// Stop saving (before the page reloads into a store rewritten outside the app).
function freezeAppStore(){ if(appStoreTimer) writeAppStore(); appStoreCleared = true; DB.flush(); }
// Start over with the sample data (testing): forget the saved store, and don't save it back.
function resetAppStore(){ appStoreCleared = true; try { DB.removeItem(APP_STORE_KEY); if(ACTIVE_CRM.sample) DB.removeItem('hof-erp-workflow-engine-v1'); } catch(e){} }
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

Object.assign(window, {DB, crmStoreKey, peopleStoreKey, readStore, writeStore, APP_STORE_KEY, freezeAppStore, CRM_TEMPLATE, ORG_REGISTRY, ACTIVE_CRM, ORG_ROLES, CRM_MIGRATION, CRM_PARTNERS, CRM_PACK, PEOPLE_PAKISTAN, PEOPLE_DUBAI, LEGACY_CRM_OF,
  DEFAULT_BRAND, HOF_BRAND, saveOrgRegistry, reloadInto, orgBrand, APP_SAVED, persistSlice, usePersistedState, savedSlice, resetAppStore, newRecordId, ensureIdFloor, idFloorOf, setUserDirectory, userLabel, userIdOf, writeAppStore});
