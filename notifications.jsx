/* HOF Pulse ERP — Notification Presets (2026-11-23).

   Admins define notification presets that decide which notifications each user receives, on
   which channels, and which of those the user may change. A user is on exactly one preset and
   changes only what it leaves unlocked. Modelled on the Permission Presets (usersTeams.jsx) and
   built from its parts — the drawer, the categories at the left, the tabs, the tables — but kept
   apart: nothing of this is stored in a permission preset, and (unlike a permission preset, whose
   matrix is copied into the user) a notification preset is never copied.

   The grid — one event list, the same on every record type (NOTIF_GROUPS):
     Left list   the record types the Permission Presets cover (Leads, Deals, Customers), and Direct.
     Tabs        Personal (the record is the person's own), Team (its owner is in their team),
                 All Users (anyone else's). Direct has none: it's what is addressed to the person
                 by name (tagged in a note, a task given to them, an office meeting, a report
                 shared, a large export).
     Rows        the events; columns In-App, Push, Email. A cell is on or off, and locked or not:
                 locked on — mandatory; locked off — the user can't turn it on; unlocked — the
                 preset's value is only where the user starts.

   Kept (with the Users & Teams data — one set per CRM branch):
     data.notificationPresets  [{id, name, isDefault, cells:{'<scope>.<record type>.<event>' |
                               'direct.<event>': {inApp|push|email: {on, locked}}}}] — a cell not
                               kept is off and unlocked, so an event added later needs nothing.
     user.notifPresetId        the preset they're on; none: the default preset.
     user.notifOverrides       {'<cell>.<channel>': on} — only what they changed themselves.
   The setting that applies is worked out when a notification is sent (notifEffective): a locked
   cell is the preset's; otherwise the user's own choice where they made one; otherwise the
   preset's. So a preset edited or a cell locked later applies to everyone on it at once.

   Delivery (NotificationHost): everything notable is already kept as an activity on its record,
   with who did it — so the host watches the records' activity and the records themselves, and
   turns what's new into notifications (notifFound → notifDeliver):
     • never about a record the person may not view (or a note, invoice, payment plan … they may
       not view on it) — the Permission Presets' own checks, asked for that user (accessAs);
     • never to the person who did it (a workflow, a form or the client is no one);
     • the closest scope decides: the owner reads Personal, the owner's team mates Team, everyone
       else All Users — one event is one notification per person;
     • an owner change is one change: Assigned is read against the new owner, Owner changed against
       the previous one, and a person gets one of the two;
     • a bulk action is one notification ("… assigned 24 leads to you"); several properties changed
       on a record in one save are one too.
   Direct notifications go through the engine's notifyUsers(…, event) → notifDirectRecipients.
   A workflow's Notify action and workflow violations are not the presets': they stay as they were.

   Channels: In-App is the bell (workflowEngine.jsx WorkflowBell — unread until clicked). Push and
   Email aren't really delivered by the prototype: a notification clicked in the bell opens its
   panel (NotificationPanel), which shows the push (a title and one line) and the HTML email (the
   Default HTML Template, on the brand) for the channels it went out on.

   Actions: Open <Record>; Reassign (Assigned / Owner changed, with Assign Owner); Undo — on Assigned
   and Owner changed (the previous owner), Stage changed (the previous stage), Updated (the old
   values) and Merged (Split) — for 24 hours, offered only to someone who may make that change
   (checked again as it's done) and only while the value is still what the notification says:
   changed again since, it reads "Changed since". Not on Deleted (a deleted record can't be brought
   back) or on activity. An Undo is a normal change by the person who undid it; the notifications
   it causes carry no Undo.

   Permissions (Settings & Administration → Notifications): Manage notification presets, Assign
   notification presets (Their Team Users / All Users), Edit own notification settings.

   The sample CRM gets a few sample notifications once, for its three personas (sampleNotifications).

   Owner handover (HandoverPanel): a record that has an owner goes to a new one only once they
   accept — it reaches them in the bell, with the Handover Note and the record's whole activity.

   The sale moment (SaleMoment, further down) is a special notification outside the presets: the
   first payment on a record shows everyone a five-second full screen — a bell, who made the sale,
   a dance. */

const NOTIF_CHANNELS = [{key:'inApp', label:'In-App', letter:'i'}, {key:'push', label:'Push', letter:'p'}, {key:'email', label:'Email', letter:'e'}];
const NOTIF_SCOPES = [{key:'personal', tab:'Personal'}, {key:'team', tab:'Team'}, {key:'all', tab:'All Users'}];
/* The events — one list for every record type. `tool`: the record tool whose View the person needs
   (`accounting`: Payment Plans' View); `tab`: the record tab the notification opens. */
const NOTIF_GROUPS = [
  {title:'Record', events:[
    {key:'created',      label:'Created'},
    {key:'assigned',     label:'Assigned'},
    {key:'ownerChanged', label:'Owner changed'},
    {key:'stageChanged', label:'Stage changed'},
    {key:'updated',      label:'Updated'},
    {key:'deleted',      label:'Deleted'},
    {key:'merged',       label:'Merged or split'},
    {key:'duplicate',    label:'Duplicate found'},
    {key:'associated',   label:'Associated record created'},
    {key:'form',         label:'Form submitted or refilled'},
  ]},
  {title:'Activity', events:[
    {key:'callLogged',    label:'Call logged',    tool:'callLogs', tab:'calls'},
    {key:'emailReceived', label:'Email received', tab:'emails'},
    {key:'emailSent',     label:'Email sent',     tab:'emails'},
    {key:'meeting',       label:'Meeting scheduled or rescheduled', tool:'meetings', tab:'meetings'},
    {key:'taskCreated',   label:'Task created',   tool:'tasks', tab:'tasks'},
    {key:'taskCompleted', label:'Task completed', tool:'tasks', tab:'tasks'},
    {key:'taskOverdue',   label:'Task overdue',   tool:'tasks', tab:'tasks'},
    {key:'noteAdded',     label:'Note added',     tool:'notes', tab:'notes'},
    {key:'fileAdded',     label:'File added',     tool:'files', tab:'files'},
  ]},
  {title:'Sales', events:[
    {key:'quoteSent',      label:'Quote sent',      tool:'quotes', tab:'quotes'},
    {key:'quoteViewed',    label:'Quote viewed',    tool:'quotes', tab:'quotes'},
    {key:'quoteSigned',    label:'Quote signed',    tool:'quotes', tab:'quotes'},
    {key:'quoteExpired',   label:'Quote expired',   tool:'quotes', tab:'quotes'},
    {key:'documentSent',   label:'Document sent',   tool:'documents', tab:'documents'},
    {key:'documentViewed', label:'Document viewed', tool:'documents', tab:'documents'},
    {key:'documentSigned', label:'Document signed', tool:'documents', tab:'documents'},
  ]},
  {title:'Accounting', events:[
    {key:'paymentPlan',     label:'Payment plan created or changed', tool:'accounting', tab:'accounting'},
    {key:'invoiceIssued',   label:'Invoice issued',   tool:'invoices', tab:'accounting'},
    {key:'paymentReceived', label:'Payment received', tool:'accounting', tab:'accounting'},
  ]},
  {title:'Sequences', events:[
    {key:'sequence', label:'Enrolled, exited or unsubscribed', tab:'emails'},
  ]},
];
const NOTIF_EVENTS = NOTIF_GROUPS.flatMap(g => g.events);
// Direct: addressed to the person by name — no Personal / Team / All Users.
const NOTIF_DIRECT = [
  {key:'mention',       label:'Tagged in a note or reply', tool:'notes', tab:'notes'},
  {key:'taskAssigned',  label:'Task assigned to you',      tool:'tasks', tab:'tasks'},
  {key:'officeRequest', label:'Office meeting request',    tab:'meetings'},
  {key:'officeAnswer',  label:'Office meeting approved or declined', tab:'meetings'},
  {key:'reportShared',  label:'Report shared with you'},
  {key:'largeExport',   label:'Large export'},
];
const notifEventDef = (object, key) => (object === 'direct' ? NOTIF_DIRECT : NOTIF_EVENTS).find(e => e.key === key) || null;
const NOTIF_UNDO_MS = 24 * 3600000;

/* ── The preset model ───────────────────────────────────────────────────────────────────── */

const notifCellKey = (scope, object, event) => object === 'direct' ? `direct.${event}` : `${scope}.${object}.${event}`;
const notifCell = (preset, key, ch) => { const c = ((preset && preset.cells && preset.cells[key]) || {})[ch]; return {on:!!(c && c.on), locked:!!(c && c.locked)}; };
// What applies, at send time: a locked cell is the preset's; else the user's own choice; else the preset's.
const notifEffective = (preset, overrides, key, ch) => { const c = notifCell(preset, key, ch), o = (overrides || {})[`${key}.${ch}`];
  return c.locked || typeof o !== 'boolean' ? c.on : o; };
const notifChannelsOf = (preset, overrides, key) => Object.fromEntries(NOTIF_CHANNELS.map(c => [c.key, notifEffective(preset, overrides, key, c.key)]));
const notifAny = (ch) => NOTIF_CHANNELS.some(c => ch[c.key]);
// One cell of a preset changed (the editor): the cell is kept only while something in it is on or locked.
const withNotifCell = (cells, key, ch, patch) => { const cur = notifCell({cells}, key, ch), cell = {...((cells || {})[key] || {}), [ch]:{...cur, ...patch}};
  const next = {...(cells || {})};
  if(NOTIF_CHANNELS.some(c => cell[c.key] && (cell[c.key].on || cell[c.key].locked))) next[key] = cell; else delete next[key];
  return next; };

/* The seeded presets. A cell is written as letters — i (In-App), p (Push), e (Email): there, the
   channel is on; a capital, it's on and locked. `lockOff`: scopes whose every cell is locked off.
   The same on every record type. */
const seedNotifCell = (str) => Object.fromEntries(NOTIF_CHANNELS.map(c => [c.key, {on:str.toLowerCase().includes(c.letter), locked:str.includes(c.letter.toUpperCase())}]));
function seedNotifCells({personal = {}, team = {}, all = {}, direct = {}, lockOff = []}){
  const cells = {}, off = Object.fromEntries(NOTIF_CHANNELS.map(c => [c.key, {on:false, locked:true}]));
  HUB_OBJECTS.forEach(o => NOTIF_SCOPES.forEach(sc => { const spec = ({personal, team, all})[sc.key] || {};
    NOTIF_EVENTS.forEach(ev => { const key = notifCellKey(sc.key, o, ev.key);
      if(lockOff.includes(sc.key)) cells[key] = off; else if(spec[ev.key]) cells[key] = seedNotifCell(spec[ev.key]); }); }));
  NOTIF_DIRECT.forEach(ev => { if(direct[ev.key]) cells[notifCellKey(null, 'direct', ev.key)] = seedNotifCell(direct[ev.key]); });
  return cells;
}
// Tagged in a note keeps its email (it was always sent with one); the rest of Direct is in-app.
const NOTIF_SEED_DIRECT = {mention:'ie', taskAssigned:'i', officeRequest:'i', officeAnswer:'i', reportShared:'i', largeExport:'i'};
// A person's own records: in-app for nearly everything; push where time matters; email when one is given to them.
const NOTIF_SEED_OWN = {created:'i', assigned:'Ipe', ownerChanged:'i', stageChanged:'i', updated:'i', deleted:'i', merged:'i', duplicate:'i', associated:'i', form:'ip',
  callLogged:'i', emailReceived:'ip', meeting:'i', taskCreated:'i', taskCompleted:'i', taskOverdue:'ip', noteAdded:'i', fileAdded:'i',
  quoteSent:'i', quoteViewed:'ip', quoteSigned:'ip', quoteExpired:'i', documentSent:'i', documentViewed:'i', documentSigned:'ip',
  paymentPlan:'i', invoiceIssued:'i', paymentReceived:'ip', sequence:'i'};
// What changes hands or can't be taken back, for whoever oversees others.
const NOTIF_SEED_OVERSEE = {deleted:'Ie', merged:'i', ownerChanged:'i', stageChanged:'i', paymentReceived:'i'};
const NOTIF_SEED_MONEY = {paymentReceived:'Ie', invoiceIssued:'i', paymentPlan:'i', quoteSigned:'i', documentSigned:'i'};
const NOTIF_DEFAULT_PRESET = 'np-salesperson';
const SEEDED_NOTIFICATION_PRESETS = () => [
  // The Salesperson: their own records. Team is theirs to switch on; All Users is locked off (no following every colleague's records).
  {id:'np-salesperson', name:'Salesperson', isDefault:true, createdBy:'System', cells:seedNotifCells({personal:NOTIF_SEED_OWN, lockOff:['all'], direct:NOTIF_SEED_DIRECT})},
  // The Team Lead: as the Salesperson on their own; on their team's, what a lead has to know — a deletion and an owner change always.
  {id:'np-team-lead', name:'Team Lead', createdBy:'System', cells:seedNotifCells({personal:NOTIF_SEED_OWN,
    team:{assigned:'i', ownerChanged:'I', stageChanged:'i', deleted:'Ip', merged:'i', quoteSigned:'i', paymentReceived:'i', taskOverdue:'i'}, direct:NOTIF_SEED_DIRECT})},
  // The Accounting person: the money, on every record; none of the sales activity.
  {id:'np-accounting', name:'Accounting person', createdBy:'System', cells:seedNotifCells({personal:NOTIF_SEED_MONEY, team:NOTIF_SEED_MONEY, all:NOTIF_SEED_MONEY, direct:NOTIF_SEED_DIRECT})},
  // The Super Admin: oversight of every record; their own as a Salesperson's.
  {id:'np-super-admin', name:'Super Admin', createdBy:'System', cells:seedNotifCells({personal:{...NOTIF_SEED_OWN, ...NOTIF_SEED_OVERSEE}, team:NOTIF_SEED_OVERSEE, all:NOTIF_SEED_OVERSEE,
    direct:{...NOTIF_SEED_DIRECT, largeExport:'Ie'}})},
];
const notificationPresetsOf = (data) => (data && Array.isArray(data.notificationPresets) && data.notificationPresets.length ? data.notificationPresets : SEEDED_NOTIFICATION_PRESETS());
const defaultNotifPreset = (data) => { const l = notificationPresetsOf(data); return l.find(p => p.isDefault) || l[0]; };
// The preset a user is on: theirs, else the default (a new user, or one whose preset is gone).
const notifPresetOfUser = (data, user) => (user && notificationPresetsOf(data).find(p => p.id === user.notifPresetId)) || defaultNotifPreset(data);
// The first time (a CRM saved before the presets): each user's preset from their Permission Preset.
const notifPresetForPermissionPreset = (name) => [SUPER_ADMIN, 'Admin'].includes(name) ? 'np-super-admin' : name === 'Team Lead' ? 'np-team-lead' : NOTIF_DEFAULT_PRESET;
const notifUsersOn = (data, preset) => (data.users || []).filter(u => notifPresetOfUser(data, u).id === preset.id);

/* ── Who gets a notification ────────────────────────────────────────────────────────────── */

const notifNoun = (object) => HUB_NOUN[object] || 'Record';
const notifPlural = (object, n) => n === 1 ? notifNoun(object).toLowerCase() : String(typePlural(object, {contacts:'Leads', deals:'Deals', customers:'Customers'}[object]) || 'records').toLowerCase();
// A person's place beside a record's owner: their own, their team's, anyone else's.
function notifScopeOf(data, user, ownerId){
  if(ownerId && user.id === ownerId) return 'personal';
  const owner = ownerId && (data.users || []).find(u => u.id === ownerId);
  return owner && owner.teamId && user.teamId === owner.teamId ? 'team' : 'all';
}
// May this user see it: the record, and the tool the event belongs to — the Permission Presets' own checks.
const notifVisibleTo = (user, object, record, def) => accessAs(user, () => recordCan(object, record, 'view')
  && (!def || !def.tool || (def.tool === 'accounting' ? paymentTermsCan('view', object, record) : toolCan(object, record, def.tool, 'view'))));
/* Direct notifications (the engine's notifyUsers): of the people named, those whose preset and
   own settings have a channel on for `event` — and, about a record, who may view it. An office
   meeting request reaches its approver whatever the record (they're asked to join it). */
function notifDirectRecipients(data, userIds, event, record){
  const def = notifEventDef('direct', event), object = record ? recordObjectOf(record.id) : null;
  return [...new Set(userIds)].map(id => (data.users || []).find(u => u.id === id)).filter(u => u && u.status !== 'Deactivated').map(u => {
    const channels = notifChannelsOf(notifPresetOfUser(data, u), u.notifOverrides, notifCellKey(null, 'direct', event));
    if(!notifAny(channels)) return null;
    if(record && !event.startsWith('office') && !notifVisibleTo(u, object, record, def)) return null;
    return {userId:u.id, channels};
  }).filter(Boolean);
}

/* ── From activity to notifications ─────────────────────────────────────────────────────── */

const NOTIF_QUOTE = {sent:'quoteSent', viewed:'quoteViewed', signed:'quoteSigned', expired:'quoteExpired'};
const NOTIF_DOCUMENT = {sent:'documentSent', viewed:'documentViewed', signed:'documentSigned'};
// What an activity that is new (`b` none) or has changed (`b`: as it was) means: [{event} | {direct, to}].
function notifEventsOf(a, b){
  if(b){
    if(a.type === 'task') return [...(a.status === 'completed' && b.status !== 'completed' ? [{event:'taskCompleted'}] : []), ...(a.overdueNotified && !b.overdueNotified ? [{event:'taskOverdue', system:true}] : [])];
    if(a.type === 'meeting' && b.status === 'requested' && a.status === 'scheduled') return [{event:'meeting'}];
    if(a.type === 'email' && b.status === 'scheduled' && a.status === 'sent') return [{event:'emailSent', system:true}];
    return [];
  }
  switch(a.type){
    case 'recordCreated':  return [{event:'created'}];
    case 'ownerChange':    return a.handover ? [] : [{event:'owner'}];   // an accepted handover tells its people itself
    case 'stageChange':    return [{event:'stageChanged'}];
    case 'propertyChange': return [{event:'updated'}];
    case 'recordsMerged': case 'recordsSplit': return [{event:'merged'}];
    case 'duplicateFound': return [{event: /refill/i.test(a.status || '') ? 'form' : 'duplicate'}];
    case 'dealCreated': case 'customerCreated': return [{event:'associated'}];
    case 'formSubmitted':  return [{event:'form'}];
    case 'call':           return [{event:'callLogged'}];
    case 'email':          return a.direction === 'received' ? [{event:'emailReceived'}] : a.status === 'scheduled' ? [] : [{event:'emailSent'}];
    case 'meeting':        return ['requested', 'cancelled'].includes(a.status) ? [] : [{event:'meeting'}];
    case 'meetingRescheduled': return [{event:'meeting'}];
    case 'task':           return [{event:'taskCreated'}, ...(a.assignee ? [{direct:'taskAssigned', to:a.assignee}] : [])];
    case 'taskReassigned': return a.to ? [{direct:'taskAssigned', to:a.to}] : [];
    case 'note':           return [{event:'noteAdded'}];
    case 'file':           return [{event:'fileAdded'}];
    case 'quote':          return NOTIF_QUOTE[a.status] ? [{event:NOTIF_QUOTE[a.status]}] : [];
    case 'document':       return NOTIF_DOCUMENT[a.status] ? [{event:NOTIF_DOCUMENT[a.status]}] : [];
    case 'payment':        return [{event: a.action === 'Payment received' ? 'paymentReceived' : 'paymentPlan'}];
    case 'invoice':        return [{event:'invoiceIssued'}];
    case 'sequence':       return [{event:'sequence'}];
    default:               return [];
  }
}
/* What's new between two looks at the records and their activity: [{event | direct, object, record,
   a}]. An activity that only moved to another record (a merge, a split) isn't new; a record gone
   because it was merged into another isn't deleted. */
function notifFound(prev, next, mergeHistory){
  const out = []; let seen = null;
  const known = (id) => { if(!seen){ seen = new Set(); HUB_OBJECTS.forEach(o => Object.values(prev.acts[o] || {}).forEach(l => (l || []).forEach(x => seen.add(x.id)))); } return seen.has(id); };
  HUB_OBJECTS.forEach(object => {
    const pm = prev.acts[object] || {}, nm = next.acts[object] || {};
    if(pm !== nm) Object.keys(nm).forEach(rid => { const pl = pm[rid], nl = nm[rid];
      if(pl === nl || !nl || !nl.length) return;
      const record = (next.records[object] || []).find(r => String(r.id) === String(rid));
      if(!record) return;
      const old = new Map((pl || []).map(x => [x.id, x]));
      nl.forEach(a => { const b = old.get(a.id);
        if(b === a || (!b && known(a.id))) return;
        notifEventsOf(a, b).forEach(e => out.push({...e, object, record, a}));
      });
    });
    const pr = prev.records[object] || [], nr = next.records[object] || [];
    if(pr !== nr && nr.length < pr.length + 1){ const ids = new Set(nr.map(r => String(r.id)));
      const merged = (id) => (mergeHistory || []).some(h => h.object === object && !h.split && !sameId(h.keptId, id) && (h.records || []).some(r => sameId(r.id, id)));
      pr.filter(r => !ids.has(String(r.id)) && !merged(r.id)).forEach(r => out.push({event:'deleted', object, record:r, a:{source:'you', by:CURRENT_USER.name}}));
    }
  });
  return out;
}

const notifList = (items) => items.length <= 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
/* The one sentence: who did what to which record. `v`: {A — who did it ('' when no person did),
   you — the reader is the owner the event is about, labels — the properties (Updated)}. */
function notifText(event, f, v){
  const a = f.a, R = f.record.name || notifNoun(f.object), A = v.A, noun = notifNoun(f.object).toLowerCase();
  const did = (active, passive) => `${A ? `${A} ${active}` : passive}.`;
  const what = a.title || a.subject || a.name || '', named = (kind) => what ? `the ${kind} ${what}` : `a ${kind}`;
  const when = (t) => fmtWhen(new Date(t || a.at).getTime());
  switch(event){
    case 'created': return a.formName ? `${R} was created from ${a.formName}.` : did(`created ${R}`, `${R} was created`);
    case 'assigned': { const to = v.you ? 'you' : userLabel(a.to) || 'a new owner'; return did(`assigned ${R} to ${to}`, `${R} was assigned to ${to}`); }
    case 'ownerChanged': { const from = v.you ? 'you' : userLabel(a.from) || 'its owner', to = userLabel(a.to);
      // Whoever passes on their own record: no "from" (it's them).
      return to ? did(A && A === userLabel(a.from) ? `reassigned ${R} to ${to}` : `reassigned ${R} from ${from} to ${to}`, `${R} was reassigned from ${from} to ${to}`) : did(`removed ${from} as the owner of ${R}`, `${R} has no owner any more`); }
    case 'stageChanged': { const from = (a.from || {}).label, to = (a.to || {}).label || 'another stage';
      return did(`moved ${R}${from ? ` from ${from}` : ''} to ${to}`, `${R} moved${from ? ` from ${from}` : ''} to ${to}`); }
    case 'updated': { const labels = v.labels && v.labels.length ? v.labels : [a.label || 'a property'], shown = labels.length > 3 ? `${labels.length} properties` : notifList(labels);
      return did(`updated ${shown} on ${R}`, `${shown} changed on ${R}`); }
    case 'deleted': return did(`deleted ${R}`, `${R} was deleted`);
    case 'merged': { if(a.type === 'recordsSplit') return did(`split ${R}`, `${R} was split`);
      const names = (Array.isArray(a.merged) ? a.merged : []).map(x => (x && x.name) || x).filter(x => typeof x === 'string' && x);
      return did(`merged ${names.length ? notifList(names) : `another ${noun}`} into ${R}`, `${names.length ? notifList(names) : `Another ${noun}`} was merged into ${R}`); }
    case 'duplicate': return `${R} was found to be a duplicate.`;
    case 'associated': { const made = a.dealName || a.customerName || 'a record'; return did(`created ${made} from ${R}`, `${made} was created from ${R}`); }
    case 'form': return a.type === 'formSubmitted' ? `${R} submitted ${a.formName || 'a form'}.` : `${R} submitted a form again.`;
    case 'callLogged': return did(`logged a call with ${R}${a.outcome ? `: ${a.outcome}` : ''}`, `A call with ${R} was logged${a.outcome ? `: ${a.outcome}` : ''}`);
    case 'emailReceived': return `${R} sent an email${what ? `: ${what}` : ''}.`;
    case 'emailSent': return did(`emailed ${R}${what ? `: ${what}` : ''}`, `An email went out to ${R}${what ? `: ${what}` : ''}`);
    case 'meeting': return a.type === 'meetingRescheduled' ? did(`moved the meeting with ${R} to ${when(a.to)}`, `The meeting with ${R} moved to ${when(a.to)}`)
      : did(`scheduled a meeting with ${R} for ${when(a.scheduledFor)}`, `A meeting with ${R} is scheduled for ${when(a.scheduledFor)}`);
    case 'taskCreated': return did(`added ${named('task')} on ${R}`, `${what ? `The task ${what}` : 'A task'} was added on ${R}`);
    case 'taskCompleted': return did(`completed ${named('task')} on ${R}`, `${what ? `The task ${what}` : 'A task'} on ${R} was completed`);
    case 'taskOverdue': return `${what ? `The task ${what}` : 'A task'} on ${R} is overdue.`;
    case 'taskAssigned': return did(`gave you ${named('task')} on ${R}`, `${what || a.taskTitle ? `The task ${what || a.taskTitle}` : 'A task'} on ${R} is yours`);
    case 'noteAdded': return did(`added a note on ${R}`, `A note was added on ${R}`);
    case 'fileAdded': return did(`added ${what || 'a file'} to ${R}`, `${what || 'A file'} was added to ${R}`);
    case 'quoteSent': return did(`sent the quote ${what} to ${R}`, `The quote ${what} was sent to ${R}`);
    case 'quoteViewed': return `${R} viewed the quote ${what}.`;
    case 'quoteSigned': return `${R} signed the quote ${String(what).replace(/ signed$/, '')}.`;
    case 'quoteExpired': return `The quote ${what} for ${R} expired.`;
    case 'documentSent': return did(`sent the document ${what} to ${R}`, `The document ${what} was sent to ${R}`);
    case 'documentViewed': return `The document ${what} for ${R} was viewed.`.replace(/ viewed by (.+?) for /, ' for ').replace(/\.$/, '.');
    case 'documentSigned': return `The document ${String(what).replace(/ signed by .+$/, '')} for ${R} was signed.`;
    case 'paymentPlan': return did(`changed a payment plan on ${R}: ${a.action || 'Payment plan'}`, `${a.action || 'Payment plan changed'} on ${R}`);
    case 'invoiceIssued': return `Invoice ${a.number || ''} for ${a.amountText || ''} was issued to ${R}.`.replace(/\s+/g, ' ');
    case 'paymentReceived': return `Payment received from ${R}${a.detail ? `: ${String(a.detail).split(' · ')[0]}` : ''}.`;
    case 'sequence': { const seq = a.sequenceName || 'a sequence';
      return a.action === 'unsubscribed' ? `${R} unsubscribed from ${seq}.` : /exit/i.test(a.action || '') ? `${R} left the sequence ${seq}.` : `${R} was enrolled in ${seq}.`; }
    default: return `${(notifEventDef(f.object, event) || {}).label || 'Something changed'} on ${R}.`;
  }
}
// One notification for a bulk action: the same event, by the same person, on several records.
function notifBulkText(event, object, entries, A){
  const n = new Set(entries.map(e => String(e.recordId))).size, many = `${n} ${notifPlural(object, n)}`, a0 = entries[0].f.a;
  const did = (active, passive) => `${A ? `${A} ${active}` : passive}.`;
  const same = (get) => entries.every(e => get(e.f.a) === get(a0)) ? get(a0) : null;
  switch(event){
    case 'created': return did(`created ${many}`, `${many} were created`);
    case 'assigned': { const to = entries[0].you ? 'you' : userLabel(same(a => a.to)); return did(`assigned ${many}${to ? ` to ${to}` : ''}`, `${many} were assigned${to ? ` to ${to}` : ''}`); }
    case 'ownerChanged': return did(`reassigned ${many}${entries[0].you ? ' from you' : ''}`, `${many} were reassigned${entries[0].you ? ' from you' : ''}`);
    case 'stageChanged': { const to = same(a => (a.to || {}).label); return did(`moved ${many} to ${to || 'another stage'}`, `${many} moved to ${to || 'another stage'}`); }
    case 'updated': return did(`updated ${many}`, `${many} were updated`);
    case 'deleted': return did(`deleted ${many}`, `${many} were deleted`);
    default: return `${(notifEventDef(object, event) || {}).label || 'Changed'} on ${many}.`;
  }
}
// What Undo would put back, from the activity that recorded the change (none: nothing to undo).
function notifUndoChange(f, event, mergeHistory){
  const a = f.a, base = {object:f.object, id:f.record.id};
  if(a.type === 'ownerChange' && a.from) return {...base, kind:'owner', from:a.from, to:a.to || ''};
  if(a.type === 'stageChange' && a.from && a.to && a.from.stage) return {...base, kind:'stage', from:{pipeline:a.from.pipeline, stage:a.from.stage}, to:{pipeline:a.to.pipeline, stage:a.to.stage}};
  if(a.type === 'propertyChange' && a.raw) return {...base, kind:'property', key:a.property, label:a.label, from:a.raw.from, to:a.raw.to};
  if(a.type === 'recordsMerged'){ const h = (mergeHistory || []).filter(x => x.object === f.object && sameId(x.keptId, f.record.id) && !x.split).pop(); return h ? {...base, kind:'merge', entryId:h.id} : null; }
  return null;
}
/* The notifications for what was found: each person's, grouped (a bulk action, a record's several
   properties). `undo` false: none of them carries an Undo (they come from an Undo). */
function notifDeliver(hub, found, {undo = true} = {}){
  const data = hub.data, users = (data.users || []).filter(u => u.status === 'Activated'), history = (hub.merge || {}).history || [];
  const entries = [], direct = [];
  found.forEach(f => {
    const a = f.a, actorId = f.system || a.source === 'client' ? '' : userIdOf(a.by, data.users);
    const A = f.system || a.source === 'client' ? '' : actorId ? userLabel(actorId) : (a.by || '');
    if(f.direct){
      // A task given to someone else than whoever gave it.
      const to = userIdOf(f.to, data.users);
      if(to && to !== actorId) notifDirectRecipients(data, [to], f.direct, f.record).forEach(r => direct.push({userId:r.userId, kind:f.direct, object:'direct', recordId:f.record.id, tab:'tasks',
        dealName:f.record.name || '', text:notifText(f.direct, f, {A}), by:A, channels:r.channels, actId:a.id}));
      return;
    }
    const owner = userIdOf(f.record.owner, data.users), change = undo ? notifUndoChange(f, f.event, history) : null;
    users.forEach(u => {
      if(u.id === actorId) return;
      const preset = notifPresetOfUser(data, u), cell = (scope, event) => notifChannelsOf(preset, u.notifOverrides, notifCellKey(scope, f.object, event));
      let event = f.event, scope, channels;
      if(event === 'owner'){
        // One change: Assigned beside the new owner, else Owner changed beside the previous one.
        const to = userIdOf(a.to, data.users), from = userIdOf(a.from, data.users);
        const tries = [...(to ? [['assigned', notifScopeOf(data, u, to)]] : []), ...(from ? [['ownerChanged', notifScopeOf(data, u, from)]] : [])];
        const hit = tries.map(([e, sc]) => ({e, sc, ch:cell(sc, e)})).find(x => notifAny(x.ch));
        if(!hit) return;
        event = hit.e; scope = hit.sc; channels = hit.ch;
      } else { scope = notifScopeOf(data, u, owner); channels = cell(scope, event); if(!notifAny(channels)) return; }
      const def = notifEventDef(f.object, event);
      if(!notifVisibleTo(u, f.object, f.record, def)) return;
      entries.push({userId:u.id, event, object:f.object, recordId:f.record.id, recordName:f.record.name || '', A, scope, you:scope === 'personal', channels, change, def, f});
    });
  });
  // Grouped per person: the same event by the same person in the same place.
  const groups = new Map();
  // A task given to someone is one notification for them: Task assigned to you, not Task created as well.
  const given = new Set(direct.map(d => `${d.userId}|${d.actId}`));
  entries.filter(e => !(e.event === 'taskCreated' && given.has(`${e.userId}|${e.f.a.id}`))).forEach(e => { const k = [e.userId, e.event, e.object, e.A, e.scope].join('|'); groups.set(k, [...(groups.get(k) || []), e]); });
  const out = direct.map(({actId, ...d}) => d);
  const make = (list, text) => { const e = list[0], ids = [...new Set(list.map(x => String(x.recordId)))], changes = list.map(x => x.change).filter(Boolean);
    out.push({userId:e.userId, kind:e.event, object:e.object, scope:e.scope, by:e.A, text:text.replace(/\.\.$/, '.'), channels:e.channels, tab:(e.def || {}).tab || null,
      ...(ids.length === 1 && e.event !== 'deleted' ? {recordId:e.recordId} : {}), ...(ids.length > 1 ? {count:ids.length} : {}),
      dealName: ids.length === 1 ? e.recordName : `${ids.length} ${notifPlural(e.object, ids.length)}`,
      ...(changes.length ? {undo:{until:Date.now() + NOTIF_UNDO_MS, changes}} : {})}); };
  groups.forEach(list => {
    const records = new Set(list.map(e => String(e.recordId)));
    if(records.size > 1) return make(list, notifBulkText(list[0].event, list[0].object, list, list[0].A));
    if(list[0].event === 'updated') return make(list, notifText('updated', list[0].f, {A:list[0].A, you:list[0].you, labels:list.map(e => e.f.a.label).filter(Boolean)}));
    list.forEach(e => make([e], notifText(e.event, e.f, {A:e.A, you:e.you})));
  });
  return out;
}

/* ── Undo ───────────────────────────────────────────────────────────────────────────────── */

// A record as the engine sees it now (a lead with its stage), by record type and id.
const notifLiveRecord = (ctx, c) => ((ctx && ctx.deals) || []).find(r => recordObjectOf(r.id) === c.object && String(r.id) === String(c.id)) || null;
// Is the value still what the notification says it became?
function notifStill(hub, ctx, c){
  if(c.kind === 'merge') return ((hub.merge || {}).history || []).some(h => h.id === c.entryId && !h.split);
  const r = notifLiveRecord(ctx, c);
  if(!r) return false;
  if(c.kind === 'owner') return userIdOf(r.owner, hub.data.users) === userIdOf(c.to, hub.data.users);
  if(c.kind === 'stage') return r.pipeline === c.to.pipeline && r.stage === c.to.stage;
  return (isBlank(r[c.key]) && isBlank(c.to)) || samePropertyValue(r[c.key], c.to);
}
// May the signed-in person make that change themselves?
function notifUndoCan(hub, c){
  const r = (hub.records[c.object] || []).find(x => String(x.id) === String(c.id));
  if(!r) return false;
  return c.kind === 'owner' ? recordCan(c.object, r, 'assign') : c.kind === 'stage' ? stageMoveCan(c.object, r) : c.kind === 'merge' ? recordCan(c.object, r, 'merge') : propValueCan(c.object, r, c.key);
}
/* A notification's Undo: {state: 'available' (with `changes`: what can be put back), 'changed' (the
   value moved on since), 'done', or null — nothing to undo, out of time, or not theirs to change}. */
function notifUndoState(hub, ctx, n){
  if(!n || !n.undo) return {state:null};
  if(n.undone) return {state:'done'};
  if(Date.now() > n.undo.until) return {state:null};
  const still = n.undo.changes.filter(c => notifStill(hub, ctx, c));
  if(!still.length) return {state:'changed'};
  const changes = still.filter(c => notifUndoCan(hub, c));
  return changes.length ? {state:'available', changes} : {state:null};
}
let NOTIF_UNDOING = false;   // the changes being written are an Undo: what they cause carries no Undo of its own
// Puts back what can still be put back (checked again, here). → how many changes were undone.
function notifUndo(hub, ctx, n){
  const s = notifUndoState(hub, ctx, n);
  if(s.state !== 'available') return 0;
  NOTIF_UNDOING = true;
  const byRecord = new Map();
  s.changes.forEach(c => {
    if(c.kind === 'merge') return hub.merge.splitRecords(c.entryId);
    const k = `${c.object}:${c.id}`, patch = byRecord.get(k) || {object:c.object, id:c.id, patch:{}};
    if(c.kind === 'owner'){ allowDirectOwner(String(c.id), userIdOf(c.from, hub.data.users)); patch.patch.owner = c.from; }   // an Undo isn't a handover
    else if(c.kind === 'property') patch.patch[c.key] = c.from;
    // A lead's stage is its Type of Lead: the stage's value there; a deal's and a customer's, the stage itself.
    else if(c.object === 'contacts'){ const pl = contactEnginePipeline(hub.data), v = contactValueFor(pl, c.from.stage); if(pl && v !== undefined) patch.patch[pl.propertyKey] = v; }
    else Object.assign(patch.patch, {pipeline:c.from.pipeline, stage:c.from.stage});
    byRecord.set(k, patch);
  });
  byRecord.forEach(({object, id, patch}) => { const r = (hub.records[object] || []).find(x => String(x.id) === String(id)); if(r && Object.keys(patch).length) hub.updateRecord(object, r.id, patch); });
  ctx.api.patchNotification(n.id, {undone:{at:Date.now(), by:CURRENT_USER.name}});
  return s.changes.length;
}

/* ── The host: seeding, and the watcher ─────────────────────────────────────────────────── */

/* Once per CRM: the seeded presets are kept, each user is put on the preset their Permission
   Preset suggests (Super Admin and Admin: Super Admin; Team Lead: Team Lead; everyone else:
   Salesperson), and the Team Lead preset and its users may assign presets to their team. */
function withNotificationPresets(d){
  if(Array.isArray(d.notificationPresets)) return d;
  const lead = (perms) => perms ? {...perms, admin:{...(perms.admin || {}), notifications:{manage:{on:false}, ...((perms.admin || {}).notifications || {}), assign:teamScope(), own:{on:true}}}} : perms;
  return {...d, notificationPresets:SEEDED_NOTIFICATION_PRESETS(),
    users:(d.users || []).map(u => ({...u, ...(u.notifPresetId ? {} : {notifPresetId:notifPresetForPermissionPreset(u.preset)}), ...(u.preset === 'Team Lead' ? {permissions:lead(u.permissions)} : {})})),
    presets:(d.presets || []).map(p => p.id === 'pp-team-lead' ? {...p, permissions:lead(p.permissions)} : p)};
}
/* ── The sale moment (2026-11-23) ───────────────────────────────────────────────────────────
   A special notification, apart from the presets: when the first payment on a record is recorded —
   any amount, in full or in part, of a One-Time, Installment or Recurring plan — everyone who isn't
   on a call or in a meeting sees one full white screen for five seconds: a hand-drawn bell rings
   (with its sound), "Sale made by <the record's owner>", then a hand-drawn person dances, quick and
   funny, and it's gone. Orange is its accent (2026-11-23): the name, the bell's ringing marks and a
   scatter of faint orange doodles around the screen. Every activated user also gets "<name> made a
   sale" in their bell, which sits on an orange ground until its panel is opened (WorkflowBell). First on the record: no payment before it on any plan the record shows —
   its own and those of the records above and below it (accounting.jsx planScopeOf). Without an
   owner, the name is whoever recorded the payment. A click or Escape ends it early; several in a
   row follow one another. With reduced motion it's the still bell and the name. */
const SALE_ORANGE = '#F07B1A';
const SALE_MS = 5000, SALE_DANCE_AT = 2400;   // five seconds (it was three): the bell, then the dance from 2.4 s
let SALE_SHOW = null;   // the mounted SaleMoment's `show(name)`
// Is this "Payment received" the first on its record (as the record's Accounting tab counts them)?
function saleIsFirstPayment(hub, acts, object, record){
  const scope = planScopeOf(object, record, hub.records);
  const logged = scope.reduce((n, k) => { const [o, id] = k.split('|'); return n + (((acts[o] || {})[id]) || []).filter(a => a.type === 'payment' && a.action === 'Payment received').length; }, 0);
  const kept = recordPlansOf(hub.accounting || [], object, record, hub.records).reduce((n, s) => n + (s.installments || []).reduce((m, x) => m + (x.payments || []).length, 0), 0);
  return logged <= 1 && kept <= 1;   // this one alone — whether or not the plan has taken it yet
}
// On a call (the call window is open) or in a meeting of theirs that's going on now.
const saleBusy = (hub) => !!hub.onCall || hubActivities(hub, 'meeting').some(e => isOngoing(e.act) && e.act.by === CURRENT_USER.name);
/* A bell: struck three times. Made here (Web Audio) — a strike is a handful of partials dying away. */
function saleBellSound(){
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext; if(!Ctx) return;
    const ctx = new Ctx(); if(ctx.state === 'suspended') ctx.resume();
    const strike = (at, base, level) => [[1, 1], [2, .5], [2.76, .32], [4.07, .18], [5.4, .1]].forEach(([ratio, amp]) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain(), t = ctx.currentTime + at, life = 1.5 / Math.sqrt(ratio);
      osc.type = 'sine'; osc.frequency.value = base * ratio;
      gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(level * amp, t + 0.006); gain.gain.exponentialRampToValueAtTime(0.0001, t + life);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(t); osc.stop(t + life + 0.05);
    });
    strike(0.12, 1245, 0.2); strike(0.75, 1245, 0.17); strike(1.4, 1245, 0.14);
    setTimeout(() => { try { ctx.close(); } catch(e){} }, SALE_MS + 400);
  } catch(e){}
}
/* The drawings — thick black line, white inside, drawn as strokes laid over one another so each
   figure reads as one outline. A dancer is a spine, two arms and two legs; its poses are flipped
   through like a flip book. */
const SALE_POSES = [
  {spine:'M150 96 L150 188', arms:['M134 132 Q82 124 88 58', 'M166 132 Q218 124 212 58'], legs:['M138 196 L124 272', 'M162 196 L176 272'], face:[150, 100, 0]},
  {spine:'M138 98 Q164 142 144 188', arms:['M126 134 Q72 150 56 104', 'M160 132 Q224 138 244 182'], legs:['M134 196 L118 272', 'M156 194 Q214 202 232 250'], face:[138, 102, -12]},
  {spine:'M162 98 Q136 142 156 188', arms:['M174 134 Q228 150 244 104', 'M140 132 Q76 138 56 182'], legs:['M166 196 L182 272', 'M144 194 Q86 202 68 250'], face:[162, 102, 12]},
  {spine:'M150 112 Q150 150 150 196', arms:['M136 144 Q84 176 60 138', 'M164 144 Q216 176 240 138'], legs:['M136 204 Q96 226 110 272', 'M164 204 Q204 226 190 272'], face:[150, 116, 0]},
  // The handstand.
  {spine:'M150 206 L150 112', arms:['M136 172 Q94 200 100 272', 'M164 172 Q206 200 200 272'], legs:['M140 108 Q108 62 76 54', 'M160 108 Q202 72 218 30'], face:[150, 204, 180]},
];
const SALE_DANCE = [0, 1, 2, 1, 2, 3, 4, 4, 3, 0, 1, 2, 1, 2, 3, 4, 4, 0];   // one pose every 125 ms: the routine, twice
function SaleDancer({pose, seed}){
  const p = SALE_POSES[pose], [fx, fy, turn] = p.face;
  const limbs = [...p.arms, ...p.legs];
  return (
    <svg viewBox="0 0 300 300" width="100%" height="100%" aria-hidden="true" style={{overflow:'visible'}}>
      <defs><filter id="sale-rough" filterUnits="userSpaceOnUse" x="-60" y="-60" width="420" height="420"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="1" seed={seed} result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="9"/></filter></defs>
      <g filter="url(#sale-rough)" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={p.spine} stroke="#000" strokeWidth={90}/>
        {limbs.map((d, i) => <path key={`o${i}`} d={d} stroke="#000" strokeWidth={46}/>)}
        <path d={p.spine} stroke="#fff" strokeWidth={76}/>
        {limbs.map((d, i) => <path key={`i${i}`} d={d} stroke="#fff" strokeWidth={32}/>)}
        {/* Eyes shut, grinning. */}
        <g transform={`translate(${fx} ${fy}) rotate(${turn})`} stroke="#000" strokeWidth={4}>
          <path d="M-17 -4 q6 7 12 0"/><path d="M5 -4 q6 7 12 0"/><path d="M-9 12 q9 9 18 0"/>
        </g>
      </g>
    </svg>
  );
}
/* The doodles: stars, squiggles, rings, crosses and dashes in faint orange, hand-drawn like the
   rest, around the edges of the screen — the middle is the bell's and the dancer's. */
function SaleDoodles(){
  const star = (x, y, r) => { const pts = Array.from({length:10}, (_, i) => { const a = Math.PI / 5 * i - Math.PI / 2, d = i % 2 ? r * .45 : r; return `${(x + Math.cos(a) * d).toFixed(1)} ${(y + Math.sin(a) * d).toFixed(1)}`; }); return `M${pts.join(' L')} Z`; };
  const cross = (x, y, r) => `M${x - r} ${y} L${x + r} ${y} M${x} ${y - r} L${x} ${y + r}`;
  const squiggle = (x, y) => `M${x} ${y} q14 -22 28 0 t28 0 t28 0`;
  const swirl = (x, y) => `M${x} ${y} c0 -26 36 -26 36 0 c0 20 -26 20 -26 2 c0 -10 14 -10 14 -1`;
  return (
    <svg aria-hidden="true" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" style={{position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none'}}>
      <defs><filter id="sale-rough-doodle" filterUnits="userSpaceOnUse" x="0" y="0" width="1200" height="800"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="1" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5"/></filter></defs>
      <g filter="url(#sale-rough-doodle)" fill="none" stroke={SALE_ORANGE} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" opacity={.38}>
        <path d={star(120, 130, 30)}/><path d={star(1050, 180, 24)}/><path d={star(220, 640, 22)}/><path d={star(980, 660, 32)}/><path d={star(620, 70, 16)}/>
        <path d={squiggle(260, 250)}/><path d={squiggle(860, 90)}/><path d={squiggle(90, 430)}/><path d={squiggle(1010, 420)}/><path d={squiggle(560, 730)}/>
        <path d={swirl(380, 110)}/><path d={swirl(1090, 560)}/><path d={swirl(110, 720)}/><path d={swirl(800, 690)}/>
        <path d={cross(450, 660, 13)}/><path d={cross(930, 290, 12)}/><path d={cross(190, 330, 11)}/><path d={cross(730, 150, 10)}/><path d={cross(1130, 330, 12)}/>
        <circle cx="330" cy="520" r="14"/><circle cx="870" cy="540" r="11"/><circle cx="1140" cy="90" r="13"/><circle cx="60" cy="250" r="9"/><circle cx="700" cy="640" r="9"/>
        <path d="M300 60 l26 -14 M320 86 l30 -6 M880 760 l28 -12 M40 560 l24 16 M1150 700 l-26 12 M520 150 l-10 -26"/>
      </g>
    </svg>
  );
}
function SaleBell({still}){
  return (
    <svg viewBox="0 0 300 300" width="100%" height="100%" aria-hidden="true" style={{overflow:'visible'}}>
      <defs><filter id="sale-rough-bell" filterUnits="userSpaceOnUse" x="-60" y="-60" width="420" height="420"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="1" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="7"/></filter></defs>
      <g filter="url(#sale-rough-bell)" fill="none" stroke="#000" strokeLinecap="round" strokeLinejoin="round">
        {!still && <g className="hof-sale-marks" stroke={SALE_ORANGE} strokeWidth={7}><path d="M52 112 q-22 30 -6 66"/><path d="M28 96 q-30 46 -8 98"/><path d="M248 112 q22 30 6 66"/><path d="M272 96 q30 46 8 98"/></g>}
        <g className={still ? undefined : 'hof-sale-ring'} style={{transformOrigin:'150px 52px'}}>
          <g className={still ? undefined : 'hof-sale-clapper'} style={{transformOrigin:'150px 120px'}}><path d="M128 228 a22 22 0 0 0 44 0 Z" fill="#fff" strokeWidth={9}/></g>
          <path d="M150 74 C104 74 96 126 92 172 C90 198 70 206 60 228 L240 228 C230 206 210 198 208 172 C204 126 196 74 150 74 Z" fill="#fff" strokeWidth={9}/>
          <rect x="141" y="34" width="18" height="40" rx="9" fill="#fff" strokeWidth={9}/>
          <path d="M118 112 q-12 34 -12 70" strokeWidth={6}/>
        </g>
      </g>
    </svg>
  );
}
const SALE_CSS = '@keyframes hof-sale-ring{0%{transform:rotate(0)}7%{transform:rotate(-20deg)}16%{transform:rotate(18deg)}25%{transform:rotate(-16deg)}34%{transform:rotate(15deg)}43%{transform:rotate(-13deg)}52%{transform:rotate(12deg)}61%{transform:rotate(-10deg)}70%{transform:rotate(8deg)}80%{transform:rotate(-5deg)}90%{transform:rotate(3deg)}100%{transform:rotate(0)}}'
  + '@keyframes hof-sale-clapper{0%,100%{transform:rotate(0)}7%{transform:rotate(16deg)}16%{transform:rotate(-16deg)}25%{transform:rotate(14deg)}34%{transform:rotate(-13deg)}43%{transform:rotate(11deg)}52%{transform:rotate(-10deg)}61%{transform:rotate(8deg)}70%{transform:rotate(-6deg)}80%{transform:rotate(4deg)}90%{transform:rotate(-2deg)}}'
  + '@keyframes hof-sale-marks{0%,100%{opacity:0}8%,26%,44%,62%{opacity:1}17%,35%,53%,74%{opacity:.15}}'
  + '@keyframes hof-sale-pop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.08);opacity:1}100%{transform:scale(1);opacity:1}}'
  + '@keyframes hof-sale-hop{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}'
  + '@keyframes hof-sale-name{0%{transform:translateY(10px);opacity:0}100%{transform:translateY(0);opacity:1}}'
  + '@keyframes hof-sale-out{0%{opacity:1}100%{opacity:0}}'
  + '.hof-sale-ring{animation:hof-sale-ring 2.1s ease-in-out .1s both}.hof-sale-clapper{animation:hof-sale-clapper 2.1s ease-in-out .1s both}.hof-sale-marks{animation:hof-sale-marks 2.1s linear .1s both}'
  + '.hof-sale-pop{animation:hof-sale-pop .22s ease-out both}.hof-sale-hop{animation:hof-sale-hop .25s ease-in-out infinite}';
/* The screen itself: mounted once (NotificationHost); `SALE_SHOW(name)` queues one. */
function SaleMoment(){
  const [queue, setQueue] = React.useState([]);   // [{id, name}]
  const cur = queue[0] || null;
  const [frame, setFrame] = React.useState(-1);   // -1: the bell; then the dance's poses
  const still = React.useMemo(() => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches), []);
  React.useEffect(() => { SALE_SHOW = (name) => setQueue(q => [...q, {id:`${Date.now()}-${Math.random()}`, name}]); return () => { SALE_SHOW = null; }; }, []);
  const done = () => setQueue(q => q.slice(1));
  React.useEffect(() => {
    if(!cur) return;
    setFrame(-1);
    saleBellSound();
    const timers = [setTimeout(done, SALE_MS)];
    let tick = null;
    if(!still) timers.push(setTimeout(() => { let i = 0; setFrame(0); tick = setInterval(() => { i += 1; if(i < SALE_DANCE.length) setFrame(i); }, 125); }, SALE_DANCE_AT));
    const key = (e) => { if(e.key === 'Escape') done(); };
    window.addEventListener('keydown', key);
    return () => { timers.forEach(clearTimeout); clearInterval(tick); window.removeEventListener('keydown', key); };
  }, [cur && cur.id]);
  if(!cur) return null;
  return ReactDOM.createPortal(
    <div onClick={done} style={{position:'fixed', inset:0, zIndex:9999, background:'#fff', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:28,
      animation:`hof-sale-out .22s ease-in ${SALE_MS - 240}ms both`}}>
      <style>{SALE_CSS}</style>
      <SaleDoodles/>
      <div style={{position:'relative', width:'min(300px, 46vh)', height:'min(300px, 46vh)'}}>
        {frame < 0 ? <div key="bell" className={still ? undefined : 'hof-sale-pop'} style={{width:'100%', height:'100%'}}><SaleBell still={still}/></div>
          : <div key="dance" className="hof-sale-pop" style={{width:'100%', height:'100%'}}><div className="hof-sale-hop" style={{width:'100%', height:'100%'}}><SaleDancer pose={SALE_DANCE[frame]} seed={frame % 3 + 1}/></div></div>}
      </div>
      <div role="status" aria-live="polite" style={{position:'relative', fontSize:34, fontWeight:600, color:'#000', letterSpacing:'-0.01em', textAlign:'center', padding:'0 24px', animation: still ? undefined : 'hof-sale-name .3s ease-out .25s both'}}>Sale made by <span style={{color:SALE_ORANGE}}>{cur.name}</span></div>
    </div>, document.body);
}

/* Sample notifications, once, in the sample CRM (`mockNotifications`, 2026-11-23) — so the bell can
   be reviewed as each persona before anything has happened: for Mustafa the Employee, Ali the Team
   Lead and Waleed the Manager, about Mustafa's own records, worded as the real ones (notifText) and
   on the channels each one's preset gives them. They record no change, so none carries an Undo. */
function sampleNotifications(hub){
  const data = hub.data, users = data.users || [], user = (id) => users.find(x => x.id === id && x.status === 'Activated') || null;
  const mustafa = user('mustafa'), ali = user('ali-noor'), waleed = user('waleed-bin-zaman');
  const own = (object) => (hub.records[object] || []).filter(r => userIdOf(r.owner, users) === 'mustafa');
  const leads = own('contacts'), deals = own('deals'), customers = own('customers');
  const now = Date.now(), H = 3600000, out = [], name = (u) => (u || {}).name || '';
  const add = (to, scope, object, record, event, a, hoursAgo, read) => {
    if(!to || !record) return;
    const channels = notifChannelsOf(notifPresetOfUser(data, to), to.notifOverrides, notifCellKey(scope, object, event));
    if(!notifAny(channels)) return;
    const direct = object === 'direct', A = a.source === 'client' ? '' : a.by || '';
    out.push({userId:to.id, kind:event, object, ...(direct ? {} : {scope}), recordId:record.id, dealName:record.name || '', by:A, channels, tab:(notifEventDef(object, event) || {}).tab || null,
      text:(a.text || notifText(event, {object: direct ? recordObjectOf(record.id) : object, record, a}, {A, you:scope === 'personal'})).replace(/\.\.$/, '.'), at:now - hoursAgo * H, read:!!read});
  };
  // A deal's move into the stage it's in, from the stage before it.
  const moved = (d) => { const pl = (data.pipelines || []).find(p => p.id === d.pipeline), i = pl ? pl.stages.findIndex(st => st.id === d.stage) : -1;
    return i > 0 ? {type:'stageChange', from:{label:pl.stages[i - 1].label}, to:{label:pl.stages[i].label}, source:'team', by:name(mustafa), plain:!['won', 'lost'].includes(pl.stages[i - 1].type)} : null; };
  // A deal still open that came from an open stage, where there is one.
  const stepped = deals.find(d => (moved(d) || {}).plain && (recordStageType('deals', d) || 'open') === 'open') || deals.find(d => moved(d));
  const quote = {type:'quote', title:'Q-2026-0042 · Canada Express Entry', source:'client', by:''};
  const paid = {type:'payment', action:'Payment received', detail:'AED 4,500 · Deposit', source:'team', by:name(mustafa)};
  // Mustafa: his own records.
  add(mustafa, 'personal', 'deals', deals[0], 'quoteViewed', {...quote, status:'viewed'}, 1);
  add(mustafa, 'personal', 'contacts', leads[0], 'assigned', {type:'ownerChange', to:'mustafa', source:'team', by:name(ali)}, 3);
  add(mustafa, 'personal', 'contacts', leads[1], 'emailReceived', {type:'email', direction:'received', subject:'Re: Document checklist', source:'client', by:''}, 5);
  add(mustafa, null, 'direct', leads[2], 'mention', {text:`${name(ali)} tagged you in a note on ${(leads[2] || {}).name}: "Can you call them before Thursday?"`, source:'team', by:name(ali)}, 26, true);
  add(mustafa, 'personal', 'customers', customers[0], 'paymentReceived', {...paid, by:name(waleed)}, 30, true);
  // Ali: his team's records.
  add(ali, 'team', 'deals', stepped, 'stageChanged', stepped ? moved(stepped) : {}, 2);
  add(ali, 'team', 'deals', deals[1], 'quoteSigned', {...quote, status:'signed', title:'Q-2026-0039 · UK Skilled Worker'}, 6);
  add(ali, 'team', 'customers', customers[0], 'paymentReceived', paid, 30, true);
  // Waleed: every record.
  add(waleed, 'all', 'deals', stepped, 'stageChanged', stepped ? moved(stepped) : {}, 2);
  add(waleed, 'all', 'customers', customers[0], 'paymentReceived', paid, 30);
  add(waleed, 'all', 'contacts', leads[3], 'ownerChanged', {type:'ownerChange', from:'ali-noor', to:'mustafa', source:'team', by:name(ali)}, 48, true);
  return out;
}
/* Sample handovers, once, in the sample CRM (`mockHandovers`, 2026-11-23): two records of Ali's —
   a lead and a deal — handed over to Mustafa, each with a Handover Note, waiting in his bell for
   him to read and accept. */
function sampleHandovers(hub){
  const users = hub.data.users || [], has = (id) => users.some(u => u.id === id && u.status === 'Activated');
  if(!has('mustafa') || !has('ali-noor')) return [];
  const busiest = (object) => (hub.records[object] || []).filter(r => userIdOf(r.owner, users) === 'ali-noor')
    .sort((x, y) => ((hub.activities[object] || {})[y.id] || []).length - ((hub.activities[object] || {})[x.id] || []).length)[0];
  const now = Date.now(), H = 3600000;
  return [['contacts', 'Spoke twice, keen on Canada. Waiting on the IELTS result before the next call.', 2], ['deals', 'Quote is with the client. They asked for the instalment option, please follow up this week.', 26]]
    .map(([object, note, hoursAgo], i) => { const r = busiest(object); return r && {id:`ho-sample-${i + 1}`, recordId:object === 'contacts' ? String(r.id) : r.id, object, recordName:r.name || '',
      from:'ali-noor', to:'mustafa', by:userLabel('ali-noor'), byId:'ali-noor', note, at:now - hoursAgo * H, status:'pending'}; }).filter(Boolean);
}
function NotificationHost(){
  const hub = useRecordHub(), ctx = useWorkflowEngineCtx();
  React.useEffect(() => { if(hub && hub.setData && !Array.isArray(hub.data.notificationPresets)) hub.setData(withNotificationPresets); }, []);
  // The sample CRM's sample notifications, once — when the presets and Mustafa's records are there.
  const sampled = React.useRef(false), ownsDeals = !!hub && (hub.records.deals || []).some(d => d.owner === 'mustafa');
  React.useEffect(() => {
    if(!hub || !ctx || !SEED || sampled.current || hub.data.mockNotifications || !Array.isArray(hub.data.notificationPresets) || !ownsDeals) return;
    sampled.current = true;
    const notes = sampleNotifications(hub);
    if(notes.length) ctx.api.addNotifications(notes);
    hub.setData(d => ({...d, mockNotifications:1}));
  }, [hub && hub.data.notificationPresets, ownsDeals]);
  // The sample CRM's sample handovers for Mustafa, once.
  const handed = React.useRef(false);
  React.useEffect(() => {
    if(!hub || !ctx || !SEED || handed.current || hub.data.mockHandovers || !ownsDeals) return;
    handed.current = true;
    const list = sampleHandovers(hub);
    if(list.length) ctx.api.addHandovers(list);
    hub.setData(d => ({...d, mockHandovers:1}));
  }, [ownsDeals]);
  /* What's on the records when the CRM opens is where it starts: nothing from before is notified,
     and neither is the sample data a CRM lays out in its first moments. */
  const seen = React.useRef(null), ready = React.useRef(false);
  React.useEffect(() => { const t = setTimeout(() => { ready.current = true; }, 4000); return () => clearTimeout(t); }, []);
  // A handover I just started: said once, as it's sent.
  const handovers = (ctx && ctx.state.handovers) || [], knownHandovers = React.useRef(null);
  React.useEffect(() => {
    const was = knownHandovers.current; knownHandovers.current = new Set(handovers.map(h => h.id));
    if(!was || !hub) return;
    const mine = handovers.filter(h => !was.has(h.id) && h.status === 'pending' && h.by === CURRENT_USER.name);
    if(mine.length) hub.toast(mine.length === 1 ? `Handover sent to ${userLabel(mine[0].to)}` : `${mine.length} handovers sent`);
  }, [handovers]);
  const acts = (hub && hub.activities) || {}, recs = (hub && hub.records) || {};
  React.useEffect(() => {
    if(!hub || !ctx) return;
    const prev = seen.current, next = {acts:{...acts}, records:{...recs}};
    seen.current = next;
    if(!prev || !ready.current) return;
    const found = notifFound(prev, next, (hub.merge || {}).history);
    if(!found.length) return;
    // The sale moment: the first payment on a record — for everyone not on a call or in a meeting.
    const sale = found.find(f => f.event === 'paymentReceived' && saleIsFirstPayment(hub, next.acts, f.object, f.record));
    if(sale){ const name = userLabel(userIdOf(sale.record.owner, hub.data.users)) || sale.a.by || CURRENT_USER.name;
      if(SALE_SHOW && !saleBusy(hub)) SALE_SHOW(name);
      // …and "<name> made a sale" in everyone's bell (always in-app, outside the presets).
      ctx.api.addNotifications((hub.data.users || []).filter(u => u.status === 'Activated').map(u => ({userId:u.id, kind:'sale', object:'direct', recordId:sale.record.id, dealId:null, dealName:sale.record.name,
        by:name, channels:{inApp:true}, text:`${name} made a sale`}))); }
    const undo = !NOTIF_UNDOING; NOTIF_UNDOING = false;
    const notes = notifDeliver(hub, found, {undo});
    if(notes.length) ctx.api.addNotifications(notes);
  }, [acts.contacts, acts.deals, acts.customers, recs.contacts, recs.deals, recs.customers]);
  return <SaleMoment/>;
}

/* ── The bell's rows and the notification's panel ───────────────────────────────────────── */

const notifLinkStyle = {border:'none', background:'transparent', padding:0, fontSize:12.5, fontFamily:'inherit', cursor:'pointer'};
// The record a notification opens, when it's still there and the signed-in person may view it.
const notifRecordOf = (hub, n) => { if(n.recordId == null) return null;
  const object = n.object && n.object !== 'direct' ? n.object : recordObjectOf(n.recordId), r = (hub.records[object] || []).find(x => String(x.id) === String(n.recordId));
  return r && (String(n.kind).startsWith('office') || recordCan(object, r, 'view')) ? {object, record:r} : null; };   // an office meeting's people open it whatever the record
function useNotificationActions(n, after){
  const hub = useRecordHub(), ctx = useWorkflowEngineCtx();
  const target = n.kind ? notifRecordOf(hub, n) : null, undo = notifUndoState(hub, ctx, n);
  return {hub, ctx, target, undo,
    open: target ? () => { after && after(); hub.openRecord(target.object, target.record.id, undefined, n.tab || undefined); } : null,
    doUndo: () => { const done = notifUndo(hub, ctx, n); hub.toast(done ? 'Undone' : "This can't be undone any more"); },
    canReassign: !!target && ['assigned', 'ownerChanged'].includes(n.kind) && recordCan(target.object, target.record, 'assign')};
}
/* One notification in the bell: unread until clicked. One from the presets (`kind`) opens its
   panel and has its actions as text actions under it; an earlier kind opens what it always did
   (an Automatic Action's card, the record). */
/* What kind of thing a notification is about — its icon and colour in the bell (2026-11-23), the
   coloured mark the dashboard's widgets carry: who owns a record (blue), a handover (violet; its
   answer green or red), a stage (indigo), a record's own changes (slate; a deletion red, a merge
   or duplicate amber), calls (green), emails (purple), meetings (blue), tasks (orange; overdue
   red), notes and tags (amber), quotes and documents (teal), money (green), reports and exports
   and anything from a workflow (grey). */
const NOTIF_MARKS = {
  assigned:['userSwitch', '#2F6BFF'], ownerChanged:['userSwitch', '#2F6BFF'],
  handover:['forward', '#7C5CFC'], handoverAccepted:['check', '#12A150'], handoverDeclined:['close', '#E5484D'], handoverCancelled:['close', '#8B8D98'],
  stageChanged:['kanbanView', '#4F46E5'],
  created:['plus', '#12A150'], updated:['edit', '#64748B'], deleted:['trash', '#E5484D'], merged:['merge', '#D97706'], duplicate:['merge', '#D97706'], associated:['openRecord', '#64748B'], form:['forms', '#0EA5A4'],
  callLogged:['call', '#12A150'], emailReceived:['envelope', '#7C5CFC'], emailSent:['envelope', '#7C5CFC'], sequence:['envelope', '#7C5CFC'],
  meeting:['calendar', '#2F6BFF'], officeRequest:['calendar', '#2F6BFF'], officeAnswer:['calendar', '#2F6BFF'],
  taskCreated:['tasks', '#E8912D'], taskCompleted:['check', '#12A150'], taskOverdue:['warning', '#E5484D'], taskAssigned:['tasks', '#E8912D'], taskReminder:['notification', '#E8912D'],
  sale:['notification', '#F07B1A'],
  noteAdded:['notepad', '#D97706'], mention:['notepad', '#D97706'],
  quoteSent:['quote', '#0EA5A4'], quoteViewed:['eye', '#0EA5A4'], quoteSigned:['check', '#12A150'], quoteExpired:['clock', '#8B8D98'],
  documentSent:['files', '#0EA5A4'], documentViewed:['eye', '#0EA5A4'], documentSigned:['check', '#12A150'],
  paymentPlan:['coins', '#12A150'], invoiceIssued:['files', '#12A150'], paymentReceived:['coins', '#12A150'],
  reportShared:['analytical', '#8B8D98'], largeExport:['export', '#8B8D98'],
};
const notifMark = (n) => { const key = n.kind === 'handoverAnswer' ? (/accepted/.test(n.text) ? 'handoverAccepted' : /declined/.test(n.text) ? 'handoverDeclined' : 'handoverCancelled') : n.kind;
  const [name, color] = NOTIF_MARKS[key] || [n.event ? 'workflows' : 'notification', '#8B8D98']; return {name, color}; };
function NotifMark({n}){
  const m = notifMark(n);
  return <span aria-hidden="true" style={{width:30, height:30, borderRadius:10, flexShrink:0, display:'inline-flex', alignItems:'center', justifyContent:'center',
    background:`linear-gradient(140deg, ${m.color}26, ${m.color}12)`, boxShadow:`inset 0 0 0 1px ${m.color}1F`}}><Icon name={m.name} size={15} color={m.color}/></span>;
}
/* One notification in the bell (redone 2026-11-23): its mark, one line saying what happened, then
   the time and its actions on one line — the record isn't named a second time. Unread until
   clicked (bolder, a blue dot). One from the presets (`kind`) opens its panel; a handover still
   open offers Review Handover; an earlier kind opens what it always did. */
function NotificationRow({n, close, onDetail}){
  const {hub, ctx, target, undo, open, doUndo} = useNotificationActions(n, close);
  const legacy = !n.kind ? (n.event ? () => { close(); ctx.openEvent(n.event); } : n.recordId != null && ctx.openRecord ? () => { close(); ctx.openRecord(n.recordId, n.tab ? {id:n.tab} : null, true); } : null) : null;
  const click = n.kind ? onDetail : legacy;
  const stop = (fn) => (e) => { e.stopPropagation(); ctx.api.markRead(n.userId, n.id); fn(); };
  const handover = n.kind === 'handover' ? ((ctx.state.handovers) || []).find(h => h.id === n.handoverId) : null;
  const link = (label, fn) => <button key={label} className={LINK_CLASS} onClick={stop(fn)} style={notifLinkStyle}>{label}</button>;
  const quiet = (label) => <span key={label} style={{fontSize:12.5, color:T.gray400}}>{label}</span>;
  const actions = !n.kind ? [] : [
    handover ? (handover.status === 'pending' ? link('Review Handover', onDetail) : quiet({accepted:'Accepted', declined:'Declined', cancelled:'No longer open'}[handover.status])) : open && link(`Open ${notifNoun(target.object)}`, open),
    undo.state === 'available' && link('Undo', doUndo), undo.state === 'changed' && quiet('Changed since'), undo.state === 'done' && quiet('Undone'),
  ].filter(Boolean);
  return (
    <div onClick={()=>{ ctx.api.markRead(n.userId, n.id); click && click(); }} style={{display:'flex', alignItems:'flex-start', gap:12, padding:'12px 10px', borderRadius:10, cursor: click ? 'pointer' : 'default'}}
      onMouseEnter={e=>{ if(click) e.currentTarget.style.background = T.headerBg; }} onMouseLeave={e=>e.currentTarget.style.background = 'transparent'}>
      <NotifMark n={n}/>
      <div style={{minWidth:0, flex:1, display:'flex', flexDirection:'column', gap:6}}>
        <div style={{fontSize:13, lineHeight:1.45, color:T.attioText, whiteSpace:'pre-line', fontWeight: n.read ? 400 : 500}}>{n.text}</div>
        <div style={{display:'flex', alignItems:'center', flexWrap:'wrap', columnGap:12, rowGap:2}}>
          {/* An earlier kind's subject, when its line doesn't already say it. */}
          <span style={{fontSize:12.5, color:T.gray600}}>{!n.kind && n.dealName && !String(n.text || '').includes(n.dealName) ? `${n.dealName} · ` : ''}{fmtWhen(n.at)}</span>
          {actions}
        </div>
      </div>
      {!n.read && <span aria-label="Unread" style={{width:7, height:7, borderRadius:9999, background:T.attioBlue, flexShrink:0, marginTop:6}}/>}
    </div>
  );
}
// How a notification goes out as a push and as an email — the same sentence, a title, and a link to the record.
const notifTitle = (n) => { if(String(n.kind).startsWith('handover')) return 'Handover';
  if(n.kind === 'sale') return 'Sale'; if(n.kind === 'taskReminder') return 'Task reminder';
  const def = notifEventDef(n.object, n.kind), noun = n.object && n.object !== 'direct' ? notifNoun(n.object) : '';
  return !def ? 'Notification' : ['created', 'assigned', 'updated', 'deleted'].includes(n.kind) ? `${noun} ${def.label.toLowerCase()}` : def.label; };
const notifEscape = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const notifEmailHtml = (n, link) => emailHtmlOf({format:'html', includeSignature:false,
  body:`<p>${notifEscape(n.text)}</p>${link ? `<p><a data-cta="primary" href="#">${notifEscape(link)}</a></p>` : ''}`}, orgBrand());
/* A notification opened from the bell: its sentence, then how it went out on the channels that
   were on for the person — the push (a title and one line) and the email. Its actions are at the
   bottom right, the main one last. */
function NotificationPanel({id, onClose}){
  const ctx = useWorkflowEngineCtx();
  const n = ((ctx && ctx.state.notifications) || []).find(x => x.id === id);
  useEscapeClose(onClose);
  if(!n) return null;
  return n.kind === 'handover' && n.handoverId ? <HandoverPanel n={n} onClose={onClose}/> : <NotificationPanelBody n={n} onClose={onClose}/>;
}
/* ── Owner handover (2026-11-23) ── a record that has an owner is given to someone else only once
   they accept (workflowEngine.jsx — the change is held, `handovers`). The new owner finds it in
   their bell; it opens here: who hands over what, the Handover Note, then the record's whole
   activity (ActivityTrail). Accept Handover comes on once they've scrolled to the end of it — the
   record is theirs from then; Decline asks a reason and leaves the record where it is. Both tell
   whoever handed it over and the owner it was with. */
function HandoverPanel({n, onClose}){
  const hub = useRecordHub(), ctx = useWorkflowEngineCtx();
  const h = ((ctx.state.handovers) || []).find(x => x.id === n.handoverId) || null;
  const record = h ? (hub.records[h.object] || []).find(r => String(r.id) === String(h.recordId)) || null : null;
  const acts = React.useMemo(() => (record ? [...(((hub.activities[h.object] || {})[record.id]) || [])] : []).sort((a, b) => new Date(b.at) - new Date(a.at)), [hub.activities, record && record.id]);
  const [read, setRead] = React.useState(false), [declining, setDeclining] = React.useState(false), [reason, setReason] = React.useState('');
  const body = React.useRef(null);
  // Read to the end: the bottom of the activity has been reached (at once when it all fits).
  const check = () => { const el = body.current; if(el && el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setRead(true); };
  React.useEffect(() => { check(); }, [acts.length]);
  if(!h) return null;
  const pending = h.status === 'pending', noun = notifNoun(h.object);
  const status = {accepted:'Accepted', declined:`Declined${h.reason ? `: ${h.reason}` : ''}`, cancelled:'No longer open'}[h.status];
  const line = (label, value) => <div style={{display:'flex', alignItems:'baseline', gap:12, padding:'8px 0', borderBottom:`1px solid ${T.attioLine}`}}>
    <span style={{width:110, flexShrink:0, fontSize:12.5, color:T.attioMuted}}>{label}</span><span style={{fontSize:13, color:T.attioText, minWidth:0}}>{value}</span></div>;
  return (
    <ContentSidePanel width={640} zIndex={120} style={{background:'#fff', borderLeft:`1px solid ${T.border}`, boxShadow:'-8px 0 24px rgba(16,24,40,.08)', display:'flex', flexDirection:'column'}}>
      <div style={{display:'flex', alignItems:'center', gap:10, padding:'16px 20px', borderBottom:`1px solid ${T.border}`, flexShrink:0}}>
        <span style={{flex:1, minWidth:0, fontSize:15, fontWeight:600, color:T.attioText}}>Handover</span>
        <button onClick={onClose} title="Close" style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:4}}><Icon name="close" size={14} color={T.gray600}/></button>
      </div>
      <div ref={body} onScroll={check} style={{flex:1, minHeight:0, overflowY:'auto'}}>
        <div style={{padding:'16px 20px 4px'}}>
          {line(noun, h.recordName)}
          {line('From', userLabel(h.from))}
          {line('Handed Over By', h.by)}
          {line('Date', fmtWhen(h.at))}
          {!pending && line('Status', status)}
          {h.note && <div style={{padding:'14px 0 0'}}>
            <div style={{fontSize:12.5, fontWeight:500, color:T.gray600, marginBottom:6}}>Handover Note</div>
            <div style={{fontSize:13.5, color:T.attioText, lineHeight:1.55, whiteSpace:'pre-wrap'}}>{h.note}</div>
          </div>}
        </div>
        <div style={{padding:'18px 20px 0', fontSize:14, fontWeight:600, color:T.attioText}}>Activity</div>
        {record ? <ActivityTrail list={acts} contact={record} empty="No activity yet" onOpen={()=>{}} onAction={()=>{}} canDo={()=>false}/> : <EmptyState compact title={`This ${noun.toLowerCase()} is gone`}/>}
      </div>
      {pending && <div style={{display:'flex', alignItems:'center', justifyContent:'flex-end', gap:8, padding:'12px 20px', borderTop:`1px solid ${T.border}`, flexShrink:0}}>
        <StSecondary label="Decline" onClick={()=>setDeclining(true)}/>
        <StCta label="Accept Handover" disabled={!read || !record} title={read ? undefined : 'Read the activity to the end first'}
          onClick={()=>{ const ok = ctx.api.answerHandover(h.id, 'accept'); hub.toast(ok ? `${h.recordName} is yours` : 'This handover is no longer open'); onClose(); }}/>
      </div>}
      {declining && <StModal title="Decline Handover" primary="Decline" danger canSubmit={!!reason.trim()} onCancel={()=>setDeclining(false)}
        onSubmit={()=>{ ctx.api.answerHandover(h.id, 'decline', reason.trim()); setDeclining(false); onClose(); }}>
        <div>
          <label style={fieldLabel} htmlFor="handover-reason">Reason<Req/></label>
          <textarea id="handover-reason" autoFocus value={reason} onChange={e=>setReason(e.target.value)} rows={3} style={{...fieldInput, height:'auto', padding:'8px 10px', resize:'vertical'}}/>
        </div>
      </StModal>}
    </ContentSidePanel>
  );
}
function NotificationPanelBody({n, onClose}){
  const {hub, target, undo, open, doUndo, canReassign} = useNotificationActions(n, onClose);
  const [reassigning, setReassigning] = React.useState(false);
  const ch = n.channels || {inApp:true}, title = notifTitle(n), link = target ? `Open ${notifNoun(target.object)}` : '';
  const label = (text) => <span style={{fontSize:12.5, fontWeight:500, color:T.gray600}}>{text}</span>;
  return (
    <ContentSidePanel width={520} zIndex={120} style={{background:'#fff', borderLeft:`1px solid ${T.border}`, boxShadow:'-8px 0 24px rgba(16,24,40,.08)', display:'flex', flexDirection:'column'}}>
      <div style={{display:'flex', alignItems:'center', gap:10, padding:'16px 20px', borderBottom:`1px solid ${T.border}`, flexShrink:0}}>
        <span style={{flex:1, minWidth:0, fontSize:15, fontWeight:600, color:T.attioText}}>{title}</span>
        <button onClick={onClose} title="Close" style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:4}}><Icon name="close" size={14} color={T.gray600}/></button>
      </div>
      <div style={{flex:1, minHeight:0, overflowY:'auto', padding:20, display:'flex', flexDirection:'column', gap:24}}>
        <div style={{display:'flex', flexDirection:'column', gap:6}}>
          <div style={{fontSize:15, color:T.attioText, lineHeight:1.5}}>{n.text}</div>
          <div style={{fontSize:12.5, color:T.gray600}}>{fmtWhen(n.at)}{undo.state === 'changed' ? ' · Changed since' : undo.state === 'done' ? ' · Undone' : ''}</div>
        </div>
        {ch.push && <div style={{display:'flex', flexDirection:'column', gap:8}}>
          {label('Push')}
          <div style={{border:`1px solid ${T.borderStrong}`, borderRadius:12, padding:'12px 14px', display:'flex', flexDirection:'column', gap:2, background:T.headerBg}}>
            <span style={{fontSize:13.5, fontWeight:600, color:T.attioText}}>{title}</span>
            <span style={{fontSize:13, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{n.text}</span>
          </div>
        </div>}
        {ch.email && <div style={{display:'flex', flexDirection:'column', gap:8}}>
          {label('Email')}
          <div style={{fontSize:13, color:T.attioText}}><span style={{color:T.gray600}}>Subject </span>{title}</div>
          <EmailHtmlFrame html={notifEmailHtml(n, link)}/>
        </div>}
      </div>
      {(open || canReassign || undo.state === 'available') && <div style={{display:'flex', alignItems:'center', justifyContent:'flex-end', gap:8, padding:'12px 20px', borderTop:`1px solid ${T.border}`, flexShrink:0}}>
        {canReassign && <StSecondary label="Reassign" onClick={()=>setReassigning(true)}/>}
        {undo.state === 'available' && <StSecondary label="Undo" onClick={doUndo}/>}
        {open && <StCta label={link} onClick={open}/>}
      </div>}
      {reassigning && target && <ChangeOwnerModal record={target.record} noun={notifNoun(target.object)} users={(hub.data.users || []).filter(u => u.status === 'Activated')} ownerName={userLabel}
        onClose={()=>setReassigning(false)} onSave={(owner)=>{ hub.updateRecord(target.object, target.record.id, {owner}); setReassigning(false); }}/>}
    </ContentSidePanel>
  );
}

/* ── The grid ───────────────────────────────────────────────────────────────────────────── */

const NOTIF_TABLE_COLS = 'minmax(240px, 1fr) 150px 150px 150px';
/* One table of events: Event | In-App | Push | Email. `mode` 'preset' — each cell's tick (on / off)
   and its lock (locked: users can't change it); 'user' — the tick alone, a locked cell shown as it
   is, greyed, with its lock. `cellOf(event, channel)` → {on, locked}; `onCell(event, channel, patch)`. */
function NotificationTable({title, rows, cellOf, onCell, mode, readOnly}){
  const cell = {padding:'10px 12px', minWidth:0, display:'flex', alignItems:'center'};
  const header = {...cell, padding:'8px 12px', fontSize:12.5, fontWeight:500, color:T.gray600};
  const line = {borderLeft:`1px solid ${T.attioLine}`};
  return (
    <div style={{display:'flex', flexDirection:'column', gap:8}}>
      {title && <span style={{fontSize:13, fontWeight:500, color:T.gray600}}>{title}</span>}
      <div role="table" aria-label={title || 'Notifications'} style={{border:`1px solid ${T.attioLine}`, borderRadius:8, overflow:'hidden'}}>
        <div role="row" style={{display:'grid', gridTemplateColumns:NOTIF_TABLE_COLS, background:T.headerBg, borderBottom:`1px solid ${T.attioLine}`}}>
          <div role="columnheader" style={header}>Event</div>
          {NOTIF_CHANNELS.map(c => <div key={c.key} role="columnheader" style={{...header, ...line}}>{c.label}</div>)}
        </div>
        {rows.map((r, i) => (
          <div key={r.key} role="row" style={{display:'grid', gridTemplateColumns:NOTIF_TABLE_COLS, borderTop: i ? `1px solid ${T.attioLine}` : 'none'}}>
            <div role="cell" style={{...cell, fontSize:13.5, fontWeight:500, color:T.black}}>{r.label}</div>
            {NOTIF_CHANNELS.map(c => { const v = cellOf(r.key, c.key), fixed = readOnly || (mode === 'user' && v.locked);
              return (
                <div key={c.key} role="cell" style={{...cell, ...line, gap:12}}>
                  <span aria-disabled={fixed || undefined} title={mode === 'user' && v.locked ? 'Set by your administrator' : undefined} style={{display:'flex', ...(fixed ? {opacity:.5, pointerEvents: readOnly ? 'none' : 'auto'} : {})}}>
                    <RowCheckbox checked={v.on} onChange={()=>!fixed && onCell(r.key, c.key, {on:!v.on})}/>
                  </span>
                  {mode === 'preset' ? (
                    <button type="button" aria-pressed={v.locked} aria-label={`${r.label} · ${c.label} · ${v.locked ? 'Locked' : 'Unlocked'}`} title={v.locked ? 'Locked: users can\'t change it' : 'Unlocked: users can change it'}
                      onClick={()=>!readOnly && onCell(r.key, c.key, {locked:!v.locked})} style={{border:'none', background:'transparent', padding:2, display:'flex', cursor: readOnly ? 'default' : 'pointer'}}>
                      <Icon name="lock" size={13} color={v.locked ? T.black : '#D4D4D4'}/>
                    </button>
                  ) : v.locked && <Icon name="lock" size={13} color={T.gray400}/>}
                </div>
              ); })}
          </div>
        ))}
      </div>
    </div>
  );
}
/* The two panes, as the permission matrix: the record types and Direct at the left; at the right
   the Personal / Team / All Users tabs (none for Direct) and the events in their tables. The
   search finds events by name. `cellOf(key, channel)` / `onCell(key, channel, patch)`: one cell,
   by its key (notifCellKey). */
function NotificationGrid({mode, cellOf, onCell, readOnly, note}){
  const types = PERMISSION_OBJECTS.filter(o => workspaceHasType(o.key));
  const [category, setCategory] = React.useState(types[0] ? types[0].key : 'direct');
  const [scope, setScope] = React.useState(NOTIF_SCOPES[0].key);
  const [find, setFind] = React.useState('');
  const f = find.trim().toLowerCase(), match = (e) => !f || e.label.toLowerCase().includes(f);
  const table = (title, events) => events.filter(match).length > 0 && (
    <NotificationTable key={`${category}-${scope}-${title}`} title={title} mode={mode} readOnly={readOnly} rows={events.filter(match)}
      cellOf={(event, ch) => cellOf(notifCellKey(scope, category, event), ch)} onCell={(event, ch, patch) => onCell(notifCellKey(scope, category, event), ch, patch)}/>
  );
  const tables = category === 'direct' ? [table(null, NOTIF_DIRECT)] : NOTIF_GROUPS.map(g => table(g.title, g.events));
  const item = (key, label) => (
    <div key={key} onClick={()=>setCategory(key)} style={{minHeight:29, display:'flex', alignItems:'center', padding:'4px 8px', borderRadius:6, cursor:'pointer',
      fontSize:13, color: category === key ? '#fff' : T.black, background: category === key ? T.black : 'transparent'}}>{label}</div>
  );
  return (
    <div style={{display:'flex', borderTop:`1px solid ${T.borderStrong}`, minHeight:480}}>
      <div style={{width:200, flexShrink:0, borderRight:'1px solid #EFEFEF', padding:12, display:'flex', flexDirection:'column', gap:14}}>
        <span style={{fontSize:14, fontWeight:500, color:T.black}}>Notifications</span>
        <ToolbarSearch search={find} onSearch={setFind} width="100%" placeholder="Search Events"
          inputStyle={{height:28, boxSizing:'border-box', padding:'0 10px 0 30px', border:'1px solid #EFEFEF', background:'#FDFDFD'}}/>
        <div style={{display:'flex', flexDirection:'column', gap:6}}>{types.map(o => item(o.key, o.plural))}{item('direct', 'Direct')}</div>
      </div>
      <div style={{flex:1, minWidth:0, padding:12, display:'flex', flexDirection:'column', gap:16}}>
        {category !== 'direct' && (
          <div style={{display:'flex', gap:8, borderBottom:`1px solid ${T.borderStrong}`, flexShrink:0}}>
            {NOTIF_SCOPES.map(s => <UtTab key={s.key} label={s.tab} active={scope === s.key} onClick={()=>setScope(s.key)}/>)}
          </div>
        )}
        {note && <div style={stTextB}>{note}</div>}
        {tables.some(Boolean) ? tables : <div style={stTextB}>No matches</div>}
      </div>
    </div>
  );
}

/* ── Users & Teams → Notification Presets ───────────────────────────────────────────────── */

const notifNameTaken = (presets, name, exceptId) => presets.some(p => p.id !== exceptId && p.name.toLowerCase() === name.trim().toLowerCase());
// Edit Notification Preset: its name and its grid — the Edit Permission Preset drawer.
function EditNotificationPresetDrawer({preset, presets, onClose, onSave}){
  const [name, setName] = React.useState(preset.name);
  const [cells, setCells] = React.useState(() => JSON.parse(JSON.stringify(preset.cells || {})));
  const taken = notifNameTaken(presets, name, preset.id), ok = !!name.trim() && !taken;
  return (
    <PermissionsDrawerFrame title="Edit Notification Preset" onClose={onClose} onSave={()=>onSave({name:name.trim(), cells})} canSave={ok} note={taken ? 'A preset with this name already exists.' : null}>
      <div style={{width:310}}>
        <label style={fieldLabel} htmlFor="notif-preset-name">Preset Name</label>
        <input id="notif-preset-name" value={name} onChange={e=>setName(e.target.value)} style={fieldInput}/>
      </div>
      <NotificationGrid mode="preset" cellOf={(key, ch) => notifCell({cells}, key, ch)} onCell={(key, ch, patch) => setCells(c => withNotifCell(c, key, ch, patch))}/>
    </PermissionsDrawerFrame>
  );
}
function NameNotificationPresetModal({presets, onCancel, onSave}){
  const [name, setName] = React.useState('');
  const n = name.trim(), taken = notifNameTaken(presets, n);
  return (
    <StModal title="New Notification Preset" primary="Create Preset" canSubmit={!!n && !taken} onCancel={onCancel} onSubmit={()=>onSave(n)}>
      <div>
        <label style={fieldLabel} htmlFor="new-notif-preset">Preset Name<Req/></label>
        <input id="new-notif-preset" autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Case Manager" style={fieldInput}
          onKeyDown={e=>{ if(e.key === 'Enter' && n && !taken) onSave(n); }}/>
        {taken && <div style={{fontSize:12, color:T.red, marginTop:4}}>A preset with this name already exists.</div>}
      </div>
    </StModal>
  );
}
// Delete a preset: the people on it move to another first (Move Users To — as Hand Over To); their own choices stay.
function DeleteNotificationPresetModal({data, preset, onCancel, onConfirm}){
  const users = (data.users || []).filter(u => u.notifPresetId === preset.id), others = notificationPresetsOf(data).filter(p => p.id !== preset.id);
  const [to, setTo] = React.useState('');
  return (
    <StModal title="Delete Notification Preset" primary="Delete Preset" danger canSubmit={!users.length || !!to} onCancel={onCancel} onSubmit={()=>onConfirm(to || null)}>
      <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>{preset.name} will be deleted. This can't be undone.</div>
      {users.length > 0 && <div>
        <label style={fieldLabel}>Move {users.length} {users.length === 1 ? 'User' : 'Users'} To<Req/></label>
        <PersonSelect value={to} people={others} labelOf={p => p.name} onChange={setTo} placeholder="Select preset"/>
      </div>}
    </StModal>
  );
}
// A user's preset, chosen from the Users table (Notification Preset).
function AssignNotificationPresetModal({data, user, onClose, onSave}){
  const cur = notifPresetOfUser(data, user);
  const [id, setId] = React.useState(cur.id);
  return (
    <StModal title="Notification Preset" primary="Save" canSubmit={!!id && id !== cur.id} onCancel={onClose} onSubmit={()=>onSave(id)}>
      <div style={stTextB}>{user.name} · Currently {cur.name}</div>
      <div>
        <label style={fieldLabel}>Notification Preset<Req/></label>
        <PersonSelect value={id} people={notificationPresetsOf(data)} labelOf={p => p.name} onChange={setId} placeholder="Select preset"/>
      </div>
    </StModal>
  );
}
const NOTIF_PRESET_PROPERTIES = [{key:'name', label:'Preset Name', width:260}, {key:'default', label:'Default', width:140}, {key:'assigned', label:'Assigned Users', width:180}];
const NOTIF_PRESET_FILTER_PROPS = [{key:'name', label:'Preset Name', type:'text'}];
/* The tab: every preset with how many users are on it (the count opens Users filtered to it).
   Notifications → Manage: New, Edit, Duplicate, Set as Default (the preset new users get) and
   Delete — never the default. */
function NotificationPresetsModule({data, setData, openUsers}){
  const hub = useRecordHub();
  const presets = notificationPresetsOf(data), manage = userAdminCan('notifications', 'manage');
  const [editing, setEditing] = React.useState(null), [naming, setNaming] = React.useState(false), [deleting, setDeleting] = React.useState(null);
  const save = (fn) => setData(d => ({...d, notificationPresets:fn(notificationPresetsOf(d))}));
  const rows = React.useMemo(() => presets.map(p => { const count = notifUsersOn(data, p).length;
    return {...p, default: p.id === defaultNotifPreset(data).id ? 'Default' : '', count, assigned:`${count} user${count === 1 ? '' : 's'}`}; }), [data.notificationPresets, data.users]);
  const duplicate = (p) => { let name = `${p.name} Copy`, i = 2; while(notifNameTaken(presets, name)) name = `${p.name} Copy ${i++}`;
    save(l => [...l, {id:`np-${Date.now()}`, name, createdBy:CURRENT_USER.name, cells:JSON.parse(JSON.stringify(p.cells || {}))}]); hub && hub.toast(`${name} created`); };
  const schema = {
    properties:NOTIF_PRESET_PROPERTIES, filterProps:NOTIF_PRESET_FILTER_PROPS, selectValues:{}, noun:'preset', searchKeys:['name'], fillWidth:true,
    renderCell: (key, r) => key === 'assigned' ? countLink(r.count, ()=>openUsers({prop:'notifPreset', op:'is', value:r.name})) : undefined,
    renderActions: (r) => { const p = presets.find(x => x.id === r.id), isDefault = r.default === 'Default';
      return <RowActionsMenu title="Preset Actions" items={manage && p ? [
        {label:'Edit Preset', onClick:()=>setEditing(p)},
        {label:'Duplicate Preset', onClick:()=>duplicate(p)},
        ...(isDefault ? [] : [{label:'Set as Default', onClick:()=>save(l => l.map(x => ({...x, isDefault:x.id === p.id})))}]),
        {label:'Delete Preset', danger:!isDefault, disabled:isDefault || presets.length < 2, onClick:()=>!isDefault && presets.length > 1 && setDeleting(p)},
      ] : []}/>; },
  };
  return <RecordViewsModule schema={schema} rows={rows} columns={NOTIF_PRESET_PROPERTIES.map(p => p.key)}
    defaultViews={[{id:'npv-all', name:'All Presets'}]}
    actions={() => manage && <NewButton label="New Notification Preset" onClick={()=>setNaming(true)}/>}>
    {naming && <NameNotificationPresetModal presets={presets} onCancel={()=>setNaming(false)}
      onSave={(name) => { const p = {id:`np-${Date.now()}`, name, createdBy:CURRENT_USER.name, cells:{}}; save(l => [...l, p]); setNaming(false); setEditing(p); }}/>}
    {editing && <EditNotificationPresetDrawer preset={editing} presets={presets} onClose={()=>setEditing(null)}
      onSave={(patch) => { save(l => l.map(p => p.id === editing.id ? {...p, ...patch} : p)); setEditing(null); }}/>}
    {deleting && <DeleteNotificationPresetModal data={data} preset={deleting} onCancel={()=>setDeleting(null)}
      onConfirm={(to) => { const id = deleting.id;
        setData(d => ({...d, notificationPresets:notificationPresetsOf(d).filter(p => p.id !== id), users:(d.users || []).map(u => u.notifPresetId === id ? {...u, notifPresetId:to} : u)}));
        setDeleting(null); }}/>}
  </RecordViewsModule>;
}

/* ── Settings → Notifications: the person's own settings ────────────────────────────────── */

/* The same grid as their preset: every cell as it applies to them; a locked one can't be changed
   (greyed, with its lock). Only what differs from the preset is kept (`notifOverrides`), so a
   cell set back to the preset's value follows the preset again. */
function NotificationSettingsPage({data, setData}){
  const me = (data.users || []).find(u => u.id === currentUserId(data)) || null;
  const preset = notifPresetOfUser(data, me), can = userAdminCan('notifications', 'own');
  const {draft, set, actions} = useSettingsForm({overrides:(me && me.notifOverrides) || {}}, (v) => me && setData(d => ({...d, users:d.users.map(u => u.id === me.id ? {...u, notifOverrides:v.overrides} : u)})));
  const onCell = (key, ch, patch) => { const c = notifCell(preset, key, ch), next = {...draft.overrides};
    if(c.locked) return;
    if(patch.on === c.on) delete next[`${key}.${ch}`]; else next[`${key}.${ch}`] = patch.on;
    set({overrides:next}); };
  return (
    <SettingsPage actions={can ? actions : null}>
      <div style={{display:'flex', flexDirection:'column', gap:20}}>
        <StField label="Notification Preset"><span style={{fontSize:13, color:T.attioText}}>{preset.name}</span></StField>
        <NotificationGrid mode="user" readOnly={!can} note={can ? null : 'You can view these settings but not change them.'}
          cellOf={(key, ch) => ({on:notifEffective(preset, draft.overrides, key, ch), locked:notifCell(preset, key, ch).locked})} onCell={onCell}/>
      </div>
    </SettingsPage>
  );
}
SETTINGS_PAGES['settings.notifications'] = NotificationSettingsPage;

Object.assign(window, {NOTIF_CHANNELS, NOTIF_SCOPES, NOTIF_GROUPS, NOTIF_EVENTS, NOTIF_DIRECT, notifCellKey, notifCell, notifEffective, notifChannelsOf, SEEDED_NOTIFICATION_PRESETS, notificationPresetsOf,
  defaultNotifPreset, notifPresetOfUser, notifDirectRecipients, notifFound, notifDeliver, notifText, notifUndoState, notifUndo, withNotificationPresets, NotificationHost, NotificationRow, NotificationPanel,
  NotificationGrid, NotificationPresetsModule, AssignNotificationPresetModal, NotificationSettingsPage, SaleMoment, saleIsFirstPayment, HandoverPanel});
