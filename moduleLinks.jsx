/* HOF Pulse ERP — Module linkage: organizations sharing a module's data.

   Three things stay independent (store.jsx registry, ERP Settings): Workspace Access (who can open
   an organization), Module Availability (the organizations that have a module) and Module Linkage
   (a module's groups — the organizations in a group share that module's data). Every module has
   its own groups, any number of them, an organization in at most one per module; linking one
   module never links another, and disabling a module keeps its data and its groups.

   Data spaces: a module's data for an organization lives in its own space, or — linked — its
   group's. A module with data has an adapter (MODULE_DATA); the others keep their groups only,
   until they have data of their own. Records and configuration carry their organization (`org`,
   stamped when saved — store.jsx) so they can go back with it:
     Link    — each organization's own data moves into the group's space; nothing is merged or
               deleted (the same person in two organizations stays two records). Record IDs that
               clash are renumbered (and every reference to them follows).
     Unlink  — what came from the organization, or was created in it while linked, moves back to
               its own space; the rest stays with the group. Associations between the two sides are
               removed (each record noted), the records kept. A group left with one organization
               ends: its data becomes that organization's own.
   People — the HRMS people (`people`), per organization or group.
   CRM    — the whole CRM store: records, activity, quotes, accounting, Customer Profiles,
            workflow runs, and its configuration, combined (every pipeline, workflow and form from
            each organization; a custom property of the same key but a different definition stays
            a separate copy); one Users & Teams for the group. An organization's own CRM roles
            (users, seats, teams, presets) and page settings stay in its own store while linked
            and are its own again when it unlinks. */

const readSpace = (key) => { try { const raw = DB.getItem(key); return raw ? JSON.parse(raw) : null; } catch(e){ return null; } };
const writeSpace = (key, value) => DB.setItem(key, JSON.stringify(value));
const dropSpace = (key) => { try { DB.removeItem(key); } catch(e){} };
const orgSlug = (ws) => String(ws).replace(/^ws-/, '').replace(/[^a-z0-9]+/gi, '_');

/* ── People ── a list of people ({id, name, email, org}). */
const peopleSpaceKey = (wsId) => { const g = moduleGroupOf('people', wsId); return g ? `hof-erp-space:people:${g.id}` : `hof-erp-space:people:org:${wsId}`; };
const PEOPLE_DATA = {
  groupKey:(gid) => `hof-erp-space:people:${gid}`,
  ownKey:(ws) => `hof-erp-space:people:org:${ws}`,
  // An organization's own People before its space existed: those in its own store.
  readOwn:(ws) => { const own = readSpace(`hof-erp-space:people:org:${ws}`); if(own) return own; const st = readSpace(ownStoreKey(ws)); return st && st.settings && st.settings.people || []; },
  merge:(parts) => {
    const out = [], ids = new Set();
    parts.forEach(({org, data}) => stampOrg(data || [], org).forEach(p => {
      const id = ids.has(p.id) ? `${p.id}--${orgSlug(org)}` : p.id;
      ids.add(id); out.push(id === p.id ? p : {...p, id});
    }));
    return out;
  },
  split:(data, org) => ({part:(data || []).filter(p => p.org === org), rest:(data || []).filter(p => p.org !== org)}),
  writeOwn:(ws, part) => writeSpace(`hof-erp-space:people:org:${ws}`, part),
};

/* ── CRM ── the store (store.jsx). */
const CRM_OBJECTS = [['contacts', 'contacts', 'contactActivities', null], ['deals', 'deals', 'dealActivities', 'deal'], ['customers', 'customers', 'customerActivities', 'cust']];
const PROFILE_SLICES = ['profileFormData', 'profiles', 'profileFacts'];
// Kept in an organization's own store while its CRM is linked (its roles and its own page settings).
const CRM_OWN_SETTINGS = ['users', 'seats', 'teams', 'presets', 'people'];
const isRecordSlice = (k) => CRM_OBJECTS.some(([, slice, acts]) => k === slice || k === acts) || PROFILE_SLICES.includes(k) || ['quotes', 'accounting', 'engine', 'forms', 'services'].includes(k);
const idNum = (id) => Number(String(id).split('-').pop()) || 0;
const objectOfId = (id) => /^deal-/.test(String(id)) ? 'deals' : /^cust-/.test(String(id)) ? 'customers' : 'contacts';
// Items appended by id: an id already there gets a new one (`rename`) or the item is skipped.
function unionById(a, b, slug, rename){
  const out = [...(a || [])], ids = new Set(out.map(x => x && x.id)), map = {};
  (b || []).forEach(x => {
    if(!x || x.id == null || !ids.has(x.id)){ out.push(x); if(x) ids.add(x.id); return; }
    if(!rename) return;
    const id = `${x.id}--${slug}`; map[x.id] = id; ids.add(id); out.push({...x, id});
  });
  return {out, map};
}
const replaceIds = (value, map) => Object.keys(map).length ? JSON.parse(Object.entries(map).reduce((j, [o, n]) => j.split(`"${o}"`).join(`"${n}"`), JSON.stringify(value))) : value;

// Store B (organization `orgB`) into the group store G.
function mergeCrmInto(G, B, orgB){
  const slug = orgSlug(orgB), sA = G.settings || {}, sB = B.settings || {};
  // Record IDs: any that G already has is renumbered past every ID in use.
  const idMap = {contacts:{}, deals:{}, customers:{}}, ids = {...(G.ids || {})};
  CRM_OBJECTS.forEach(([o, slice, , prefix]) => {
    const taken = new Set((G[slice] || []).map(r => String(r.id)));
    let n = Math.max(0, ...(G[slice] || []).map(r => idNum(r.id)), ...(B[slice] || []).map(r => idNum(r.id)), ((G.ids || {})[o] || 1) - 1, ((B.ids || {})[o] || 1) - 1);
    (B[slice] || []).forEach(r => { if(taken.has(String(r.id))){ n++; idMap[o][r.id] = prefix ? `${prefix}-${n}` : n; } taken.add(String(idMap[o][r.id] ?? r.id)); });
    ids[o] = n + 1;
  });
  const mapId = (o, id) => id == null || id === '' ? id : (idMap[o][id] ?? id);
  const mapAny = (id) => mapId(objectOfId(id), id);
  // Configuration, combined: every pipeline, workflow and form of each; custom properties by key.
  const pipes = unionById(sA.pipelines, sB.pipelines, slug, true);
  const keyMap = {}, properties = [...(sA.properties || [])];
  (sB.properties || []).forEach(p => {
    const same = properties.find(x => x.objectId === p.objectId && x.key === p.key);
    if(!same){ properties.push(p); return; }
    if(p.system || same.system) return;
    const {org:_a, ...x} = same, {org:_b, ...y} = p;
    if(JSON.stringify(x) === JSON.stringify(y)) return;
    const key = `${p.key}_${slug}`; (keyMap[p.objectId] = keyMap[p.objectId] || {})[p.key] = key; properties.push({...p, key});
  });
  const flows = unionById(sA.workflows, (sB.workflows || []).map(w => replaceIds(w, pipes.map)), slug, true);
  const forms = unionById(sA.profileForms, sB.profileForms, slug, true);
  // One Users & Teams: a person once (by email; the group's role kept), B's seats and teams added.
  const userMap = {}, users = [...(sA.users || [])];
  (sB.users || []).forEach(u => {
    const same = users.find(x => String(x.email || '').toLowerCase() === String(u.email || '').toLowerCase());
    if(same){ userMap[u.id] = same.id; return; }
    const id = users.some(x => x.id === u.id) ? `${u.id}--${slug}` : u.id; if(id !== u.id) userMap[u.id] = id; users.push({...u, id});
  });
  const teams = unionById(sA.teams, sB.teams, slug, true);
  const seatsB = (sB.seats || []).map(st => ({...st, assigneeId: st.assigneeId && sA.users && (sA.users || []).some(x => x.id === userMap[st.assigneeId]) ? null : (userMap[st.assigneeId] || st.assigneeId)}));
  const seats = unionById(sA.seats, seatsB, slug, true).out;
  const usersOut = users.map(u => u.teamId && teams.map[u.teamId] && !(sA.users || []).includes(u) ? {...u, teamId:teams.map[u.teamId]} : u);
  const presets = [...(sA.presets || []), ...(sB.presets || []).filter(p => !(sA.presets || []).some(x => x.name === p.name))];
  const settings = {...sB, ...sA, pipelines:pipes.out, properties, workflows:flows.out, profileForms:forms.out, users:usersOut, seats, teams:teams.out.map(t => ({...t, leadId:userMap[t.leadId] || t.leadId})), presets,
    objects:unionById(sA.objects, sB.objects, slug, false).out, associations:unionById(sA.associations, sB.associations, slug, false).out};
  ['emails', 'phones', 'meetings', 'calendars'].forEach(k => { if(Array.isArray(sA[k]) || Array.isArray(sB[k])) settings[k] = unionById(sA[k], sB[k], slug, true).out; });
  // Records, with every reference following.
  const remap = (o, r) => {
    const x = {...r, id:mapId(o, r.id)};
    if(x.pipeline && pipes.map[x.pipeline]) x.pipeline = pipes.map[x.pipeline];
    if('contactId' in x) x.contactId = mapId('contacts', x.contactId);
    if(Array.isArray(x.dealIds)) x.dealIds = x.dealIds.map(d => mapId('deals', d));
    if(x.owner && userMap[x.owner]) x.owner = userMap[x.owner];
    Object.entries(keyMap[o] || {}).forEach(([k, nk]) => { if(k in x){ x[nk] = x[k]; delete x[k]; } });
    return x;
  };
  const out = {...B, ...G, settings, ids};
  CRM_OBJECTS.forEach(([o, slice, acts]) => {
    out[slice] = [...(G[slice] || []), ...(B[slice] || []).map(r => remap(o, r))];
    out[acts] = {...(G[acts] || {}), ...Object.fromEntries(Object.entries(B[acts] || {}).map(([k, v]) => [String(mapId(o, o === 'contacts' ? (isNaN(k) ? k : Number(k)) : k)), v]))};
  });
  PROFILE_SLICES.forEach(k => { out[k] = {...(G[k] || {}), ...Object.fromEntries(Object.entries(B[k] || {}).map(([id, v]) => [String(mapAny(isNaN(id) ? id : Number(id))), v]))}; });
  const quotes = unionById(G.quotes, (B.quotes || []).map(q => ({...q, recordId:mapId(q.object, q.recordId)})), slug, true);
  out.quotes = quotes.out;
  out.accounting = unionById(G.accounting, (B.accounting || []).map(s => ({...s, recordId:mapId(s.object, s.recordId), ...(s.quoteId && quotes.map[s.quoteId] ? {quoteId:quotes.map[s.quoteId]} : {})})), slug, true).out;
  out.forms = unionById(G.forms, B.forms, slug, true).out;
  out.services = unionById(G.services, B.services, slug, true).out;
  const eG = G.engine || {}, eB = B.engine || {};
  const remapEv = (x) => ({...x, ...(x.dealId != null ? {dealId:mapAny(x.dealId)} : {}), ...(x.recordId != null ? {recordId:mapAny(x.recordId)} : {})});
  out.engine = {...eB, ...eG, ...Object.fromEntries(['events', 'runs', 'prompts', 'notifications'].map(k => [k, [...(eG[k] || []), ...(eB[k] || []).map(remapEv)]]))};
  // Page settings (views, navigation, panels): the group's; any only B has are added.
  Object.keys(B).forEach(k => { if(!(k in out)) out[k] = B[k]; });
  return out;
}
// What goes back to `org` when it leaves: its records (and what hangs on them) and its configuration.
function splitCrm(G, org){
  const mine = (x) => x && x.org === org;
  const ids = {}, part = {}, rest = {...G};
  CRM_OBJECTS.forEach(([o, slice]) => { ids[o] = new Set((G[slice] || []).filter(mine).map(r => String(r.id))); });
  const inPart = (o, id) => id != null && ids[o].has(String(id));
  const note = (body) => ({id:`note-unlink-${Math.random().toString(36).slice(2, 9)}`, type:'note', source:'system', by:null, at:new Date().toISOString(), body});
  const orgName = (WORKSPACE_REGISTRY.workspaces.find(w => w.id === org) || {}).name || 'the organization';
  const cut = {};   // record id → note (an association removed)
  // An association across the two sides is removed; both records keep a note.
  const detach = (r, side) => {
    let x = r;
    if(x.contactId != null && inPart('contacts', x.contactId) !== side){ cut[x.id] = true; cut[x.contactId] = true; x = {...x, contactId:null}; }
    if(Array.isArray(x.dealIds)){ const keep = x.dealIds.filter(d => inPart('deals', d) === side); if(keep.length !== x.dealIds.length){ cut[x.id] = true; x.dealIds.filter(d => !keep.includes(d)).forEach(d => { cut[d] = true; }); x = {...x, dealIds:keep}; } }
    return x;
  };
  CRM_OBJECTS.forEach(([o, slice]) => {
    part[slice] = (G[slice] || []).filter(mine).map(r => detach(r, true));
    rest[slice] = (G[slice] || []).filter(r => !mine(r)).map(r => detach(r, false));
  });
  CRM_OBJECTS.forEach(([o, slice, acts]) => {
    const add = (map, id) => cut[id] ? [...(map[id] || []), note(`Association removed: ${orgName}'s CRM was unlinked.`)] : map[id];
    part[acts] = {}; rest[acts] = {};
    Object.keys(G[acts] || {}).forEach(k => { const target = inPart(o, k) ? part[acts] : rest[acts]; target[k] = add(G[acts], o === 'contacts' ? (isNaN(k) ? k : Number(k)) : k) || G[acts][k]; });
  });
  PROFILE_SLICES.forEach(k => { part[k] = {}; rest[k] = {}; Object.entries(G[k] || {}).forEach(([id, v]) => { (inPart(objectOfId(id), id) ? part[k] : rest[k])[id] = v; }); });
  ['quotes', 'accounting'].forEach(k => { part[k] = (G[k] || []).filter(x => inPart(x.object, x.recordId)); rest[k] = (G[k] || []).filter(x => !inPart(x.object, x.recordId)); });
  ['forms', 'services'].forEach(k => { part[k] = (G[k] || []).filter(x => mine(x) || !x.org); rest[k] = (G[k] || []).filter(x => !mine(x)); });
  const eG = G.engine || {}, onPart = (x) => inPart(objectOfId(x.dealId ?? x.recordId), x.dealId ?? x.recordId);
  part.engine = {...eG, triggerProgress:{}, ...Object.fromEntries(['events', 'runs', 'prompts', 'notifications'].map(k => [k, (eG[k] || []).filter(onPart)]))};
  rest.engine = {...eG, ...Object.fromEntries(['events', 'runs', 'prompts', 'notifications'].map(k => [k, (eG[k] || []).filter(x => !onPart(x))]))};
  // Configuration: its own goes with it; what belongs to no organization (system) stays with both.
  const sG = G.settings || {}, cfg = (list, side) => (list || []).filter(x => side ? (mine(x) || !x.org) : !mine(x));
  const cfgKeys = ['pipelines', 'workflows', 'profileForms'];
  part.settings = {...sG, ...Object.fromEntries(cfgKeys.map(k => [k, cfg(sG[k], true)])), properties:(sG.properties || []).filter(p => p.system || !p.org || mine(p))};
  rest.settings = {...sG, ...Object.fromEntries(cfgKeys.map(k => [k, cfg(sG[k], false)])), properties:(sG.properties || []).filter(p => p.system || !p.org || !mine(p))};
  part.ids = G.ids; rest.ids = G.ids;
  return {part, rest};
}
const CRM_DATA = {
  groupKey:(gid) => `hof-erp-space:crm:${gid}`,
  ownKey:(ws) => ownStoreKey(ws),
  readOwn:(ws) => readSpace(ownStoreKey(ws)),
  merge:(parts) => parts.filter(p => p.data).reduce((G, {org, data}) => G ? mergeCrmInto(G, stampStoreOrigins(data, org), org) : stampStoreOrigins(data, org), null),
  split:splitCrm,
  // Back in its own store: what goes back with it, over its own roles and page settings.
  writeOwn:(ws, part) => {
    const own = readSpace(ownStoreKey(ws)) || {};
    const settings = {...part.settings, ...Object.fromEntries(CRM_OWN_SETTINGS.filter(k => own.settings && own.settings[k]).map(k => [k, own.settings[k]]))};
    writeSpace(ownStoreKey(ws), {...own, ...part, settings});
  },
  // Its records moved into the group: its own store keeps only its roles and page settings.
  leaveOwn:(ws) => {
    const own = readSpace(ownStoreKey(ws)); if(!own) return;
    writeSpace(ownStoreKey(ws), Object.fromEntries(Object.entries(own).filter(([k]) => !isRecordSlice(k))));
  },
};
// The modules whose data is shared when linked (the others keep their groups until they have data).
const MODULE_DATA = {people:PEOPLE_DATA, crm:CRM_DATA};

/* ── Link and unlink ── each changes one module's groups (and moves its data); the page reloads
   when the open organization's data moved. */
const moduleGroups = (moduleId) => ((WORKSPACE_REGISTRY.modules || {})[moduleId] || {}).groups || [];
function saveGroups(moduleId, groups){
  const mods = WORKSPACE_REGISTRY.modules || {};
  saveWorkspaceRegistry({modules:{...mods, [moduleId]:{...(mods[moduleId] || {orgs:[]}), groups}}});
  window.dispatchEvent(new Event('hof-workspaces-changed'));
}
// Before reading spaces: what the open organization hasn't saved yet goes out.
const flushOpen = () => { if(typeof writeAppStore === 'function') writeAppStore(); };
const afterMove = (orgs) => { DB.flush(); if(orgs.includes(ACTIVE_WORKSPACE.id)){ freezeAppStore(); window.location.reload(); } };
/* Link `orgIds` (none already in a group of this module) as a new group — or, with `groupId`,
   into that group. Returns an error message when the data couldn't be moved (each organization's
   own data is then put back as it was). */
function linkOrgs(moduleId, orgIds, groupId){
  const adapter = MODULE_DATA[moduleId];
  const groups = moduleGroups(moduleId);
  const g = groupId ? groups.find(x => x.id === groupId) : {id:`g-${moduleId}-${Date.now().toString(36)}`, orgs:[]};
  const adding = orgIds.filter(o => !g.orgs.includes(o) && !groups.some(x => x.orgs.includes(o)));
  const orgs = [...g.orgs, ...adding];
  if(orgs.length < 2) return;
  if(adapter){
    flushOpen();
    const parts = [...(g.orgs.length ? [{org:null, data:readSpace(adapter.groupKey(g.id))}] : []), ...adding.map(org => ({org, data:adapter.readOwn(org)}))];
    // The group's own data (already stamped) first, then each organization's.
    const merged = g.orgs.length && moduleId === 'crm'
      ? adding.reduce((G, org) => { const d = adapter.readOwn(org); return d ? mergeCrmInto(G, stampStoreOrigins(d, org), org) : G; }, parts[0].data || {})
      : g.orgs.length ? adapter.merge([{org:'', data:parts[0].data}, ...parts.slice(1)]) : adapter.merge(parts);
    // Each organization's own data moves out before the group's is written (no copy left behind);
    // if the group's can't be written, everything goes back as it was.
    const backup = adding.map(org => [adapter.ownKey(org), DB.getItem(adapter.ownKey(org))]);
    try {
      adding.forEach(org => { if(adapter.leaveOwn) adapter.leaveOwn(org); else dropSpace(adapter.ownKey(org)); });
      writeSpace(adapter.groupKey(g.id), merged || (moduleId === 'people' ? [] : {}));
    } catch(e){
      backup.forEach(([k, v]) => { try { if(v == null) DB.removeItem(k); else DB.setItem(k, v); } catch(_){} });
      return 'The data couldn’t be linked: this browser’s storage is full.';
    }
  }
  saveGroups(moduleId, groupId ? groups.map(x => x.id === g.id ? {...x, orgs} : x) : [...groups, {id:g.id, orgs}]);
  if(adapter) afterMove(adding.concat(g.orgs));
  return null;
}
// One organization out of its group; a group left with one ends (its data that organization's own).
function unlinkOrg(moduleId, groupId, org){
  const adapter = MODULE_DATA[moduleId];
  const groups = moduleGroups(moduleId), g = groups.find(x => x.id === groupId);
  if(!g || !g.orgs.includes(org)) return;
  const left = g.orgs.filter(o => o !== org);
  if(adapter){
    flushOpen();
    const data = readSpace(adapter.groupKey(g.id));
    const {part, rest} = adapter.split(data || (moduleId === 'people' ? [] : {}), org);
    adapter.writeOwn(org, part);
    if(left.length === 1){ adapter.writeOwn(left[0], rest); dropSpace(adapter.groupKey(g.id)); }
    else writeSpace(adapter.groupKey(g.id), rest);
  }
  saveGroups(moduleId, left.length > 1 ? groups.map(x => x.id === g.id ? {...x, orgs:left} : x) : groups.filter(x => x.id !== g.id));
  if(adapter) afterMove(g.orgs);
}
// Unlink a whole group: each organization takes back its own.
function unlinkGroup(moduleId, groupId){
  const g = moduleGroups(moduleId).find(x => x.id === groupId); if(!g) return;
  const adapter = MODULE_DATA[moduleId];
  if(!adapter){ saveGroups(moduleId, moduleGroups(moduleId).filter(x => x.id !== groupId)); return; }
  flushOpen();
  let data = readSpace(adapter.groupKey(g.id)) || (moduleId === 'people' ? [] : {});
  g.orgs.forEach((org, i) => {
    if(i === g.orgs.length - 1){ adapter.writeOwn(org, data); return; }
    const {part, rest} = adapter.split(data, org); adapter.writeOwn(org, part); data = rest;
  });
  dropSpace(adapter.groupKey(g.id));
  saveGroups(moduleId, moduleGroups(moduleId).filter(x => x.id !== groupId));
  afterMove(g.orgs);
}

/* People saved under one key before linkage groups (People linked between HOF Migration and HOF
   Partners): that set becomes its group's, its records HOF Migration's (where they came from). */
(() => {
  const OLD = 'hof-erp-people-shared-v1', old = readSpace(OLD);
  if(!old) return;
  const g = moduleGroups('people')[0];
  if(g && !readSpace(PEOPLE_DATA.groupKey(g.id))) writeSpace(PEOPLE_DATA.groupKey(g.id), stampOrg(old, HOF_MIGRATION_WS));
  dropSpace(OLD);
})();

Object.assign(window, {readSpace, writeSpace, peopleSpaceKey, MODULE_DATA, mergeCrmInto, splitCrm, moduleGroups, linkOrgs, unlinkOrg, unlinkGroup});
