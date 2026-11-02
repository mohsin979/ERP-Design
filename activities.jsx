/* HOF Pulse ERP — Contact activity: types, mock history, the rule-based summary, and the
   components the Board card uses to show them.

   Activity types are the ones that already exist in the product — Email, Call, Meeting, Task,
   Note (the Table menu actions / card quick actions) — plus Owner change. An activity belongs
   to one Contact record by `contactId`; nothing is duplicated per module.

   The history is MOCK data, generated deterministically per contact so it is stable across
   reloads and consistent with the record it belongs to:
     • the newest Email/Call/Meeting falls exactly on the contact's `lastContacted` date, so
       the card's "Last contacted" and its activity never disagree;
     • if the owner changed, the latest change ends on the current owner.

   Attribution — every activity carries who performed or originated it:
     source:'team'   + by:<name>  a team member. Usually whoever owned the contact at the time,
                                  but not always — colleagues also log notes, tasks and calls.
     source:'client'              the contact initiated it: a received email, an inbound call,
                                  a meeting they booked.
     source:'you'                 done in this prototype session (e.g. reassigning the owner via
                                  Edit). There is no signed-in user, so no name is invented. */

const ACTIVITY_TYPES = {
  email:       {label:'Email',        icon:'envelope'},
  call:        {label:'Call',         icon:'call'},
  meeting:     {label:'Meeting',      icon:'calendar'},
  task:        {label:'Task',         icon:'tasks'},
  note:        {label:'Note',         icon:'notepad'},
  ownerChange: {label:'Owner change', icon:'userSwitch'},
  workflow:    {label:'Workflow',     icon:'workflows'},   // a workflow run on the record (workflowEngine.jsx)
  file:        {label:'File',         icon:'paperclip'},   // a file added to the record, or received with its email (files.jsx)
  fileChange:  {label:'File deleted', icon:'trash'},       // a file removed from the record — the record keeps that it was
  quote:       {label:'Quote',        icon:'quote'},       // a quotation created or sent for the record (quotes.jsx)
};
/* The contact-facing types, used to seed each contact's mock history. */
const CARD_ACTIVITY_ORDER = ['email', 'call', 'meeting', 'task', 'note'];
const TOUCH_TYPES = ['email', 'call', 'meeting'];   // what "contacted" means

/* ── Mock history ───────────────────────────────────────────────────────────────────────── */

function seeded(seed){
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const DAY = 86400000;
const parseDay = (s) => { const d = s ? new Date(s) : null; return d && !isNaN(d) ? d : null; };

const EMAILS = [
  ['Canada PR eligibility — next steps',     'Outlined the Express Entry route and what the eligibility assessment covers.'],
  ['Document checklist for Express Entry',   'Shared the checklist and the timeline for biometrics.'],
  ['IELTS score requirements',               'Explained the CLB bands needed and how they affect the CRS score.'],
  ['Consultation booking confirmation',      'Confirmed the consultation slot and sent the preparation notes.'],
  ['Study visa options for the Fall intake', 'Compared intake deadlines and the proof-of-funds requirement.'],
  ['Re: Fee structure and payment plan',     'Explained the instalment option for the consultancy fee.'],
  ['UK Skilled Worker visa enquiry',         'Asked whether the employer already holds a sponsor licence.'],
  ['Australia 189 points assessment',        'Asked for passport and education transcripts before the assessment.'],
];
const THIRD_PARTIES = ['Sana Mirza', 'Omar Farooq', 'Hina Qureshi', 'Daniyal Khan'];
const CALL_NOTES = [
  'Discussed family sponsorship timeline.', 'Walked through the CRS score estimate.',
  'Answered questions on proof of funds.', 'Reviewed which documents are still missing.',
];
const CALL_OUTCOMES = ['Connected', 'Connected', 'No answer', 'Left voicemail'];   // sample generation only

/* Call outcomes — two lists for now: a logged call (entered by hand) and a call made through
   the system. Older values map onto them (Missed → No answer, Left live message / Meeting
   booked → Connected), so every call shows a current value. */
const LOG_CALL_OUTCOMES = ['Disconnected', 'No answer', 'Left voicemail', 'Connected', 'Wrong number'];
const SYSTEM_CALL_OUTCOMES = ['No answer', 'Left voicemail', 'Connected', 'Wrong number', 'Cancelled'];
const LEGACY_OUTCOME = {Missed:'No answer', 'Left live message':'Connected', 'Meeting booked':'Connected'};
const outcomeOf = (raw) => LEGACY_OUTCOME[raw] || raw;

/* Tasks — type and status. A task is In Progress or Completed (`status`); Overdue is worked out —
   an In Progress task past its due date — and never set by hand (taskState). The same three states
   everywhere: the Tasks board, a record's Tasks tab, Settings → Tasks. */
const TASK_TYPES = ['Email', 'Call', 'To-do'];
const TASK_STATUSES = [
  {key:'inProgress', label:'In Progress'},
  {key:'completed',  label:'Completed'},
];
const TASK_STATES = [...TASK_STATUSES.slice(0, 1), {key:'overdue', label:'Overdue'}, ...TASK_STATUSES.slice(1)];
const TASK_PIPELINE_STAGES = () => TASK_STATUSES.map(s => ({id:s.key, label:s.label}));
/* Task pipelines (Settings → Tasks): a task sits in one pipeline (`pipelineId`, the default when
   none) at its status. Every pipeline has the same stages — In Progress, Completed (Overdue is
   worked out). App keeps TASK_PIPELINES current (setTaskPipelines) for the helpers below. */
const DEFAULT_TASK_PIPELINE_ID = 'tp-general';
const DEFAULT_TASK_PIPELINES = () => [{id:DEFAULT_TASK_PIPELINE_ID, name:'General', isDefault:true, stages:TASK_PIPELINE_STAGES()}];
// Pipelines saved with their own stages take the fixed ones (their tasks: withTaskStatuses).
const withTaskStages = (list) => list.map(p => ({...p, stages:TASK_PIPELINE_STAGES()}));
let TASK_PIPELINES = DEFAULT_TASK_PIPELINES();
const setTaskPipelines = (list) => { TASK_PIPELINES = list && list.length ? withTaskStages(list) : DEFAULT_TASK_PIPELINES(); };
const taskPipelinesOf = (data) => (data && data.taskPipelines && data.taskPipelines.length ? withTaskStages(data.taskPipelines) : DEFAULT_TASK_PIPELINES());
/* Tasks saved with a pipeline's own stages: Completed when done (Completed, or its pipeline's last
   stage then), else In Progress (Not started, Waiting, …). `oldPipelines`: the pipelines as saved
   before. Running it again changes nothing. */
const taskStatusFrom = (t, oldPipelines) => {
  if(t.status === 'completed' || t.status === 'inProgress') return t.status;
  const pl = (oldPipelines || []).find(p => p.id === (t.pipelineId || DEFAULT_TASK_PIPELINE_ID)), last = pl && pl.stages && pl.stages[pl.stages.length - 1];
  return last && last.id === t.status ? 'completed' : 'inProgress';
};
const withTaskStatuses = (map, oldPipelines) => {
  let changed = false;
  const out = Object.fromEntries(Object.entries(map || {}).map(([id, list]) => [id, (list || []).map(a => {
    if(a.type !== 'task') return a;
    const status = taskStatusFrom(a, oldPipelines);
    if(status === a.status) return a;
    changed = true; return {...a, status};
  })]));
  return changed ? out : map;
};
const taskPipelineIdOf = (t) => t.pipelineId || DEFAULT_TASK_PIPELINE_ID;
const taskPipelineOf = (t) => TASK_PIPELINES.find(p => p.id === taskPipelineIdOf(t)) || TASK_PIPELINES[0];
const taskStageLabel = (t) => { const pl = taskPipelineOf(t); const st = pl && pl.stages.find(x => x.id === t.status);
  return st ? st.label : (TASK_STATUSES.find(x => x.key === t.status) || {}).label || ''; };
const isTaskOpen = (t) => t.status !== 'completed';

/* Meetings — "Meeting" (start / schedule — not defined yet) or "Meeting log": an online meeting
   (Google Meet, Zoom, …) logged by hand. Distinct from calls. */
const MEETING_PLATFORMS = ['Google Meet', 'Zoom', 'Other'];
const MEETING_TITLES = ['Initial consultation', 'Eligibility assessment', 'Document review session', 'Case strategy meeting'];
const TASK_TITLES = ['Send retainer agreement', 'Collect passport copies', 'Follow up on IELTS results',
                     'Share fee proposal', 'Schedule eligibility assessment', 'Verify education credentials'];
// Each sample task's description, by its name.
const TASK_DESCRIPTIONS = {
  'Send retainer agreement':          'Email the signed-off retainer and confirm the payment schedule with the client.',
  'Collect passport copies':          'Request clear colour scans of every page with stamps or visas.',
  'Follow up on IELTS results':       'Check whether the TRF has arrived and update the points estimate.',
  'Share fee proposal':               'Send the fee breakdown for the selected service and answer any questions.',
  'Schedule eligibility assessment':  'Agree a time with the client and book the assessment call.',
  'Verify education credentials':     'Document the verification process for each degree and transcript.',
};
const NOTE_BODIES = [
  'Interested in Canada Express Entry; CRS estimate around 470.',
  'Prefers WhatsApp for updates, evenings only.',
  'Spouse also applying — will need dependant documents.',
  'Raised a budget concern about the consultancy fee.',
  'Came in through the Meta form; asked about study-to-PR routes.',
];

function generateActivities(contacts){
  const owners = [...new Set(contacts.map(c => c.owner).filter(Boolean))].sort();
  const out = {};
  contacts.forEach(c => {
    const end = parseDay(c.lastContacted);
    if(!end){ out[c.id] = []; return; }
    let start = parseDay(c.created) || new Date(end.getTime() - 60*DAY);
    if(start >= end) start = new Date(end.getTime() - 45*DAY);
    const r = seeded(c.id * 7919);
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    /* Same single draw as `pick`, but without repeats inside one contact's history — two
       identical notes on one record read as fake. Falls back to the full list once exhausted. */
    const used = new Map();
    const pickUnique = (arr) => {
      let u = used.get(arr); if(!u){ u = new Set(); used.set(arr, u); }
      let pool = arr.filter(x => !u.has(x)); if(!pool.length){ u.clear(); pool = arr; }
      const x = pool[Math.floor(r() * pool.length)]; u.add(x); return x;
    };
    const at = (d) => { const x = new Date(d); x.setHours(9 + Math.floor(r()*8), [0,15,30,45][Math.floor(r()*4)], 0, 0); return x; };
    const between = () => at(start.getTime() + r() * (end.getTime() - start.getTime() - DAY));

    const list = [];
    // The anchoring touchpoint on the last-contacted date.
    const anchorType = pick(TOUCH_TYPES);
    list.push({type:anchorType, at:at(end)});
    // Some contacts have every type, others only a few.
    const types = CARD_ACTIVITY_ORDER.filter(() => r() < 0.72);
    types.forEach(t => list.push({type:t, at:between()}));
    const extra = Math.floor(r() * 4);
    for(let k=0; k<extra; k++) list.push({type:pick(CARD_ACTIVITY_ORDER), at:between()});

    // Optional owner change, ending on the current owner.
    let change = null;
    if(c.owner && r() < 0.35 && owners.length > 1){
      const from = pick(owners.filter(o => o !== c.owner));
      change = {type:'ownerChange', at:between(), from, to:c.owner};
      list.push(change);
    }

    list.sort((a,b) => b.at - a.at);
    const ownerAt = (a) => change && a.at < change.at ? change.from : c.owner;
    // A team member other than the owner of the day does roughly one in four team activities.
    const performer = (a) => {
      const own = ownerAt(a);
      if(!own) return pick(owners);                       // no owner: any team member
      const others = owners.filter(o => o !== own);
      return r() < 0.25 && others.length ? pick(others) : own;
    };
    const team = (a) => ({source:'team', by:performer(a)});
    const client = {source:'client', by:null};

    out[c.id] = list.map((a, i) => {
      const base = {id:`a${c.id}-${i}`, contactId:c.id, type:a.type, at:a.at};
      switch(a.type){
        case 'email': {
          const [title, body] = pickUnique(EMAILS);
          /* Some threads involve other people: someone CC'd on a sent email, or a third party
             (family member, employer) replying. Chosen by position, not by a random draw, so
             the rest of the sample history is unchanged. */
          const other = THIRD_PARTIES[(c.id + i) % THIRD_PARTIES.length];
          if(r() < 0.6){
            const e = {...base, ...team(a), direction:'sent', title, body};
            return (c.id + i) % 6 === 0 ? {...e, cc:[other]} : e;
          }
          return (c.id + i) % 5 === 0 ? {...base, source:'other', by:other, direction:'received', title, body}
                                      : {...base, ...client, direction:'received', title, body};
        }
        case 'call': {
          if(r() < 0.3){
            // Inbound: the client called in. Missed if nobody picked up.
            const outcome = r() < 0.8 ? 'Connected' : 'Missed';
            return {...base, ...client, direction:'inbound', pointOfContact: ownerAt(a) || owners[(c.id + i) % owners.length], outcome:outcomeOf(outcome), logged:false,
                    durationMin: outcome === 'Connected' ? 3 + Math.floor(r()*18) : 0,
                    body: outcome === 'Connected' ? pickUnique(CALL_NOTES) : ''};
          }
          const outcome = pick(CALL_OUTCOMES);
          // Sample data: the customer's inbound calls came through the phone system (live, read-only);
          // the team's outbound sample calls were logged by hand (editable).
          return {...base, ...team(a), direction:'outbound', outcome:outcomeOf(outcome), logged:true,
                  durationMin: outcome === 'Connected' ? 4 + Math.floor(r()*22) : 0,
                  body: outcome === 'Connected' ? pickUnique(CALL_NOTES) : ''};
        }
        case 'meeting': {
          /* Meetings are always logged by an internal team member. The draw that used to split
             client-booked from team meetings is kept (so the rest of the sample history doesn't
             shift); those meetings are now attributed to the owner of the day instead. Sample
             meetings are Meeting Logs (online meetings logged by hand). */
          const wasClient = r() < 0.3;
          const who = wasClient ? {source:'team', by: ownerAt(a) || owners[(c.id + i) % owners.length]} : team(a);
          return {...base, ...who, title:pickUnique(MEETING_TITLES), durationMin:[30,45,60][Math.floor(r()*3)],
                  logged:true, platform: MEETING_PLATFORMS[(c.id + i) % 2]};
        }
        case 'task': {
          const due = new Date(a.at.getTime() + (3 + Math.floor(r()*14)) * DAY);
          const title = pickUnique(TASK_TITLES);
          const t = {...base, ...team(a), title, description:TASK_DESCRIPTIONS[title] || '', due, status: due < end ? 'completed' : 'inProgress', taskType:'To-do'};
          return {...t, assignee: t.by};
        }
        case 'note': return {...base, ...team(a), body:pickUnique(NOTE_BODIES)};
        case 'ownerChange': return {...base, ...team(a), from:a.from, to:a.to};
      }
      return base;
    });
  });
  return out;
}

/* Sample tasks saved before they had descriptions get theirs (by task name). Only tasks with no
   description at all — a task added in the app always has one, even if empty. `byRecord`:
   {recordId: [activity]}; returned unchanged when nothing needs it. */
function withSampleTaskDescriptions(byRecord){
  const fill = (a) => a.type === 'task' && a.description === undefined && TASK_DESCRIPTIONS[a.title];
  if(!Object.values(byRecord || {}).some(list => (list || []).some(fill))) return byRecord;
  return Object.fromEntries(Object.entries(byRecord).map(([id, list]) => [id, (list || []).map(a => fill(a) ? {...a, description:TASK_DESCRIPTIONS[a.title]} : a)]));
}

/* ── Derivations ────────────────────────────────────────────────────────────────────────── */

const startOfToday = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
/* A task's due date, with a time when one was set (`dueTime`): overdue once that moment passes; a
   date alone is overdue from the next day. */
const isPastDue = (t) => !!t.due && (t.dueTime ? new Date(t.due) < new Date() : new Date(t.due) < startOfToday());
const isOverdue = (t) => t.type === 'task' && isTaskOpen(t) && isPastDue(t);
// A task's state: Completed, Overdue (worked out) or In Progress — and its label.
const taskState = (t) => !isTaskOpen(t) ? 'completed' : isPastDue(t) ? 'overdue' : 'inProgress';
const taskStateLabel = (t) => (TASK_STATES.find(s => s.key === taskState(t)) || {}).label || '';
const ymdOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// The task form's values (date 'YYYY-MM-DD', time 'HH:MM') ⇄ the task's `due` / `dueTime`.
const taskDueParts = (a) => { if(!a || !a.due) return {date:'', time:''}; const d = new Date(a.due); return {date:ymdOf(d), time: a.dueTime ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : ''}; };
const taskDueValue = (date, time) => {
  if(!date) return {due:null, dueTime:false};
  const [y, m, dd] = date.split('-').map(Number), d = new Date(y, m - 1, dd);
  if(time){ const [h, mi] = time.split(':').map(Number); d.setHours(h, mi, 0, 0); }
  return {due:d, dueTime:!!time};
};

const fmtActDate = (d) => {
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-US', sameYear ? {month:'short', day:'numeric'} : {month:'short', day:'numeric', year:'numeric'});
};
const fmtActTime = (d) => d.toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'});
// "Oct 20" or, with a due time, "Oct 20, 3:00 PM".
const fmtTaskDue = (a) => { if(!a.due) return ''; const d = new Date(a.due); return a.dueTime ? `${fmtActDate(d)}, ${fmtActTime(d)}` : fmtActDate(d); };
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

/* Summary — assembled by fixed rules from the record and its activity, NOT generated by AI.
   It states stage and deals, the last touchpoint, and where the open tasks stand. Because it
   is computed from the same list the history renders, the two can't contradict each other. */
/* `lead` replaces the opening sentence for another object (a Deal states its stage and pipeline). */
function buildActivitySummary(contact, acts, lead){
  const parts = [];
  parts.push(lead || `${contact.contactType || 'No stage'}${contact.dealCount ? ` with ${plural(contact.dealCount, 'associated deal')}` : ''}.`);
  const touch = acts.find(a => TOUCH_TYPES.includes(a.type));
  if(touch){
    const how = touch.type === 'call' ? `${touch.direction === 'inbound' ? 'a call from them' : 'a call'} (${touch.outcome.toLowerCase()})`
              : touch.type === 'email' ? (touch.direction === 'received' ? 'an email from them' : 'email')
              : 'a meeting';
    parts.push(`Last contacted ${fmtActDate(touch.at)} by ${how}.`);
  } else {
    parts.push('Not contacted yet.');
  }
  const open = acts.filter(a => a.type === 'task' && isTaskOpen(a));
  const overdue = open.filter(isOverdue);
  if(overdue.length) parts.push(`${plural(overdue.length, 'task')} overdue: ${overdue[0].title}.`);
  else if(open.length) parts.push(`Next task: ${open[0].title}${open[0].due ? `, due ${fmtActDate(open[0].due)}` : ''}.`);
  else if(acts.length) parts.push('No open tasks.');
  return parts.join(' ');
}

/* ── Activity text helpers ──────────────────────────────────────────────────────────────── */

function activityHeadline(a){
  switch(a.type){
    case 'email':   return a.title;
    case 'call':    return (a.direction === 'inbound' ? 'Inbound · ' : '') + a.outcome + (a.durationMin ? ` · ${a.durationMin} min` : '');
    case 'meeting': return a.title;
    case 'task':    return a.title;
    case 'note':    return richTextPlain(a.body);   // a rich-text note, as one line
    case 'ownerChange': return `${userLabel(a.from) || 'No owner'} → ${userLabel(a.to) || 'No owner'}`;   // user IDs (older history: names)
    case 'workflow':    return a.title;
  }
  return '';
}

function activityWhen(a){
  if(a.type === 'task'){
    if(a.status === 'completed') return {text:'Done', tone:'muted'};
    if(!a.due) return {text:'No due date', tone:'muted'};
    return isOverdue(a) ? {text:`Overdue ${fmtTaskDue(a)}`, tone:'danger'} : {text:`Due ${fmtTaskDue(a)}`, tone:'muted'};
  }
  return {text:fmtActDate(a.at), tone:'muted'};
}

/* ── Activity row: one information hierarchy everywhere it is summarised ─────────────────
   Used by Overview → Snapshots and by the Board card's activity dropdowns (and so the Card
   Settings preview). Three lines, always:
     1 — a natural action + the person
     2 — the most meaningful information:  subject / name / result / content
     3 — date · time, never the year:      "Sep 29 · 2:30 PM"
   Line 1 depends on context:
     'all'  — a mixed list (All Activity, Overview → Activities): name the type —
              "Email sent by …", "Email received from Customer", "Note by …",
              "Task assigned by …" / "Task done by …", "Call by …"
     'type' — a single-type list (the Emails / Tasks / Notes / Calls dropdowns and Overview
              groups): the section already says what these are, so don't repeat it —
              "Sent by …", "Received from Customer", "By …", "Assigned by …" / "Done by …"
   Person: internal users by their real name, "(Owner)" after the contact's current owner; the
   contact is always "Customer" (not a system user); anyone else in a thread by name. "You" is
   this session — there is no signed-in user whose name could be shown. CC'd people follow. */
/* → {name, owner, kind}: `owner` marks the contact's current owner, shown as "(Owner)";
   `kind` is 'team' | 'you' (internal people), 'customer', or 'other' (a third party). */
function activityActor(a, contact){
  if(a.source === 'client') return {name:'Customer', owner:false, kind:'customer'};
  // Added in the app: the person who added it (stamped since; before, the signed-in person).
  if(a.source === 'you'){ const name = a.by || CURRENT_USER.name; return {name, owner: !!contact && name === contact.owner, kind:'you'}; }
  if(!a.by) return null;
  if(a.source === 'other') return {name:a.by, owner:false, kind:'other'};
  return {name:a.by, owner: !!contact && a.by === contact.owner, kind:'team'};
}

/* Every activity kind that summarised lists show (meetings included). */
const listedActivities = (acts) => acts;
const fmtActStamp = (d) => `${d.toLocaleDateString('en-US', {month:'short', day:'numeric'})} · ${fmtActTime(d)}`;

/* A call's type: Inbound (the customer called in) or Outbound. Older calls without a direction
   are inbound when the customer made them. */
const isInboundCall = (a) => a.direction ? a.direction === 'inbound' : a.source === 'client';

function callResult(a){
  const mins = a.durationMin ? ` · ${a.durationMin} min` : '';
  return `${a.outcome || 'No outcome'}${mins}`;
}

/* Line 1 is returned in parts so it can truncate by priority: the action is kept, the
   person's name gives way first, "(Owner)" is never cut, and CC'd names go before anything. */
function activityLines(a, contact, context = 'all'){
  const who = activityActor(a, contact);
  const all = context === 'all';
  const cc = a.cc && a.cc.length ? `· cc ${a.cc.join(', ')}` : '';
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const act = (what, rel) => {
    const prefix = who ? (what ? `${what} ${rel} ` : `${rel} `) : (what || '');
    return {prefix: cap(prefix), name: who ? who.name : '', owner: !!(who && who.owner), kind: who ? who.kind : null, cc};
  };
  const when = fmtActStamp(a.at);
  switch(a.type){
    case 'email': {
      const received = a.direction === 'received';
      // A workflow's email that hasn't gone yet reads "Scheduled".
      const what = a.status === 'scheduled' ? (all ? 'Email scheduled' : 'Scheduled') : all ? `Email ${received ? 'received' : 'sent'}` : (received ? 'Received' : 'Sent');
      return {lead:act(what, received ? 'from' : 'by'), detail:a.title, when};
    }
    case 'note': return {lead: all ? act('Note', 'by') : (who ? act('', 'by') : act('Note')), detail:richTextPlain(a.body), when};
    // Only two task states for now: assigned and done.
    case 'task': {
      const state = a.status === 'completed' ? 'done' : 'assigned';
      return {lead:act(all ? `Task ${state}` : cap(state), 'by'), detail:a.title, when};
    }
    /* "Call by [Person]" / "Call log by [Person]" — who made the call. In a record's Calls tab
       ('calls') the row is the call icon and the person alone. */
    case 'call': return {lead: context === 'calls' ? {prefix:'', name: who ? who.name : '', owner: !!(who && who.owner), kind: who ? who.kind : null, cc:''}
      : all ? act(a.logged ? 'Call log' : 'Call', 'by') : (who ? act('', 'by') : act('Call')), detail:callResult(a), when};
    // Always an internal team member: "Meeting by [name]".
    case 'meeting': return {lead: all ? act('Meeting', 'by') : (who ? act('', 'by') : act('Meeting')), detail:a.title, when};
    case 'ownerChange': return {lead:act('Owner changed', 'by'), detail:`${userLabel(a.from) || 'No owner'} → ${userLabel(a.to) || 'No owner'}`, when};
    case 'workflow': return {lead:act('Workflow ran'), detail:a.title, when};
    case 'file': return a.origin === 'received'
      ? {lead:act(all ? 'File received' : 'Received', 'from'), detail:a.name, when}
      : {lead:act(all ? 'File added' : 'Added', 'by'), detail:a.name, when};
    case 'fileChange': return {lead:act('File deleted', 'by'), detail:a.fileName, when};
    case 'quote': return {lead:act(a.status === 'signed' ? 'Quote signed' : a.status === 'sent' ? 'Quote sent' : 'Quote created', 'by'), detail:a.title, when};
  }
  return {lead:{prefix: ACTIVITY_TYPES[a.type] ? ACTIVITY_TYPES[a.type].label : '', name:'', owner:false, cc:''}, detail:'', when};
}
const leadText = (l) => `${l.prefix}${l.name}${l.owner ? ' (Owner)' : ''}${l.cc ? ` ${l.cc}` : ''}`;

/* Person chip (Figma, HOF CRM Redesign 6352:5948): an 18px avatar, then the name. Internal
   people get a stable colour of their own with their initial, an underlined name that shows the
   usual hover affordance (what it opens is not defined yet), and "(Owner)" when they own the
   contact. The Customer gets a black avatar with a person icon and a plain name — not
   interactive. Anyone else in a thread gets a neutral avatar and a plain name. */
const PERSON_COLORS = ['#FF0004', '#0C6FFF', '#7A3FF2', '#0E9F6E', '#D97706', '#DB2777', '#0891B2', '#4B5563'];
const personColor = (name) => { let h = 0; for(const ch of name || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0; return PERSON_COLORS[h % PERSON_COLORS.length]; };

function PersonAvatar({kind, name}){
  const base = {width:18, height:18, borderRadius:100, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center'};
  if(kind === 'customer') return <span style={{...base, background:'#000'}}><img src="assets/activity/customer.svg" width={12} height={12} alt="" style={{display:'block'}}/></span>;
  const internal = kind === 'team' || kind === 'you';
  return <span style={{...base, background: internal ? personColor(name) : T.gray400, color:'#fff', fontSize:10, fontWeight:500, lineHeight:'16px'}}>{(name || '?').charAt(0).toUpperCase()}</span>;
}

function PersonName({kind, name}){
  const [h, setH] = React.useState(false);
  const internal = kind === 'team' || kind === 'you';
  // An internal person's name opens their profile — the Record Owner link's panel — inside a record.
  const profile = React.useContext(OwnerProfileCtx);
  const open = internal && profile ? (e) => { e.stopPropagation(); profile.open(name); } : undefined;
  return (
    <span onClick={open} role={open ? 'button' : undefined} onMouseEnter={internal ? ()=>setH(true) : undefined} onMouseLeave={internal ? ()=>setH(false) : undefined}
      style={{minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', flexShrink:1000,
              color: internal && h ? T.attioText : T.attioMuted, cursor: internal ? 'pointer' : 'default',
              // Same underline as record names (ContactName): light grey, darker on hover.
              textDecorationLine: internal ? 'underline' : 'none', textUnderlineOffset:2,
              textDecorationColor: internal && h ? T.attioMuted : '#D7D6DA', transition:'color 120ms ease, text-decoration-color 120ms ease'}}>{name}</span>
  );
}

/* Call direction: an internal person's call → green arrow out; the Customer's → red arrow in.
   Same Figma asset; the incoming one is recoloured through a mask and turned around. */
function CallDirection({incoming}){
  if(!incoming) return <img src="assets/activity/call-arrow.svg" width={14} height={14} alt="Outgoing call" title="Outgoing call" style={{display:'block', flexShrink:0}}/>;
  return <span title="Incoming call" aria-label="Incoming call" style={{width:14, height:14, flexShrink:0, background:T.red, transform:'rotate(180deg)',
    WebkitMask:'url(assets/activity/call-arrow.svg) center / contain no-repeat', mask:'url(assets/activity/call-arrow.svg) center / contain no-repeat'}}/>;
}

/* Hierarchy: line 2 (what it is about / its result) is the focal point; lines 1 and 3 share one
   quieter treatment. `compact` (Overview → Snapshots, activity lists) merges lines 1 and 3 into
   one row — action + person on the left, date · time on the right. Type icons show only in
   mixed lists (All Activity); single-type lists already say what they are. */
/* An activity's first line — "[Type] by [avatar] [Name] (Owner)", plus the call arrow and CC'd
   names. Used by the activity rows and, as the header, by every activity detail. */
function ActivityLead({a, lead, style}){
  const cut = {whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', minWidth:0};
  const internal = lead.kind === 'team' || lead.kind === 'you';
  return (
    /* One visible line. Only the name truncates — avatar, "(Owner)" and the call arrow never
       do; CC'd names are all-or-nothing (they wrap onto the hidden second line). */
    <div title={leadText(lead)} style={{...style, display:'flex', flexWrap:'wrap', columnGap:6, height:18, lineHeight:'18px', overflow:'hidden', minWidth:0, flex:1}}>
      <span style={{display:'flex', alignItems:'center', gap:6, minWidth:0, maxWidth:'100%', flex:'0 1 auto', whiteSpace:'nowrap', height:18}}>
        {lead.prefix && <span style={{...cut, flexShrink: lead.owner ? 1 : 0, whiteSpace:'pre'}}>{lead.prefix.trimEnd()}</span>}
        {lead.name && (
          <span style={{display:'flex', alignItems:'center', gap:4, minWidth:0, flexShrink:1000}}>
            <PersonAvatar kind={lead.kind} name={lead.name}/>
            <PersonName kind={lead.kind} name={lead.name}/>
            {lead.owner && <span style={{flexShrink:0}}>(Owner)</span>}
          </span>
        )}
        {a.type === 'call' && lead.kind && <CallDirection incoming={isInboundCall(a)}/>}
      </span>
      {lead.cc && <span style={{flexShrink:0, whiteSpace:'nowrap'}}>{lead.cc}</span>}
    </div>
  );
}

/* `record` ({object, id, name}): the associated record the activity is on (a record's Deal /
   Customer / Contact feeds) — named after the lead, as on Tools' person-led rows, and opens it. */
function ActivityRow({a, contact, first, context = 'all', compact = false, record}){
  const l = activityLines(a, contact, context);
  const meta = ACTIVITY_TYPES[a.type];
  const one = {whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'};
  const quiet = {fontSize:12, color:T.attioMuted};
  const showIcon = context === 'all' || context === 'calls';
  const lead = l.lead;
  return (
    <div style={{display:'flex', gap:10, padding:'8px 0', borderTop: first ? 'none' : `1px solid ${T.attioLine}`, minWidth:0}}>
      {showIcon && <Icon name={meta ? meta.icon : 'activity'} size={13} color={T.attioMuted} style={{marginTop:3, flexShrink:0}}/>}
      <div style={{minWidth:0, flex:1}}>
        <div style={{display:'flex', alignItems:'center', gap:8, minWidth:0}}>
        {record ? (
          <span style={{...quiet, flex:1, minWidth:0, display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap'}}>
            {/* The record's name is what matters here: the lead gives way first. */}
            <span style={{minWidth:0, flex:'0 1000 auto', overflow:'hidden', display:'flex'}}><ActivityLead a={a} lead={lead} style={quiet}/></span>
            <span style={{flexShrink:0}}>·</span>
            <span onClick={ev=>ev.stopPropagation()} style={{minWidth:0, flex:'0 1 auto', overflow:'hidden', display:'flex'}}>
              <HubRecordLink object={record.object} id={record.id} name={record.name}/>
            </span>
          </span>
        ) : <ActivityLead a={a} lead={lead} style={quiet}/>}
        {compact && <span style={{...quiet, flexShrink:0, whiteSpace:'nowrap'}}>{l.when}</span>}
        </div>
        {l.detail && <div title={l.detail} style={{...one, fontSize:13, fontWeight:500, color:T.attioText, marginTop:4}}>{l.detail}</div>}
        {!compact && <div style={{...one, ...quiet, marginTop:2}}>{l.when}</div>}
      </div>
    </div>
  );
}

/* ── Card: expanded View Activity ───────────────────────────────────────────────────────── */

/* Summary + full activity trail as ONE section: a single neutral container holding the
   summary, a hairline, and the View All Activity row; opening it reveals the trail inside the
   same container rather than as a separate block. Black / white / light-gray only — the
   summary is not visually set apart from the activity it summarises. */
/* The summary text block — used by ActivitySection and by the Board card's Smart Summary. */
function SummaryBlock({contact, acts, source='From the activity below', lead}){
  return (
    <div style={{padding:'10px 12px'}}>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4}}>
        <span style={{fontSize:11.5, fontWeight:600, color:T.attioText, letterSpacing:.2}}>Summary</span>
        <span style={{fontSize:11, color:T.attioFaint}}>{source}</span>
      </div>
      <div style={{fontSize:12.5, lineHeight:1.5, color:T.attioText}}>{buildActivitySummary(contact, acts, lead)}</div>
    </div>
  );
}

/* Shared inset surface for the summary and activity dropdowns. */
const activityBox = {
  background:T.headerBg, border:`1px solid ${T.attioLine}`, borderRadius:8,
  cursor:'auto', userSelect:'text',
};

function ActivitySection({contact, acts}){
  const [open, setOpen] = React.useState(false);
  return (
    <div onMouseDown={e=>e.stopPropagation()} style={{...activityBox, marginTop:2}}>
      <SummaryBlock contact={contact} acts={acts}/>

      <div onClick={()=>setOpen(o=>!o)} style={{
        display:'flex', alignItems:'center', gap:8, padding:'8px 12px',
        borderTop:`1px solid ${T.attioLine}`, cursor:'pointer', userSelect:'none',
      }}>
        <Icon name="archive" size={14} color={T.attioMuted}/>
        <span style={{fontSize:12.5, color:T.attioText}}>View All Activity</span>
        {acts.length > 0 && <span style={{fontSize:12, color:T.attioFaint}}>{acts.length}</span>}
        <div style={{flex:1}}/>
        <Icon name="chevDown" size={T.chevronSize} color={T.attioMuted}
          style={{transform: open ? 'rotate(180deg)' : 'none'}}/>
      </div>

      {open && (
        <div style={{padding:'12px 12px 14px', borderTop:`1px solid ${T.attioLine}`}}>
          <ActivityHistory acts={acts}/>
        </div>
      )}
    </div>
  );
}

/* One expandable activity dropdown on a Board card (View Activity, Emails, Tasks…): collapsed to
   a row; expanded, the latest `count` items of that kind in the same card section, then a link
   to the full view of that kind (the page is not defined yet). No count beside the label. */
function ActivityDropdown({icon, label, items, count, emptyText, linkLabel, onLink, first, contact, context = 'all'}){
  const [open, setOpen] = React.useState(false);
  const shown = items.slice(0, count);
  return (
    /* pointerEvents:auto keeps dropdowns expandable inside the (otherwise inert) Card Settings preview. */
    <div style={{borderTop: first ? 'none' : `1px solid ${T.attioLine}`, pointerEvents:'auto'}}>
      <div onClick={()=>setOpen(o=>!o)} style={{
        display:'flex', alignItems:'center', gap:8, padding:'8px 12px', cursor:'pointer', userSelect:'none',
      }}>
        <Icon name={icon} size={14} color={T.attioMuted}/>
        <span style={{fontSize:12.5, color:T.attioText}}>{label}</span>
        <div style={{flex:1}}/>
        <Icon name="chevDown" size={T.chevronSize} color={T.attioMuted} style={{transform: open ? 'rotate(180deg)' : 'none'}}/>
      </div>
      {open && (
        <div style={{padding:'4px 12px 12px', borderTop:`1px solid ${T.attioLine}`}}>
          {/* Same activity rows as Overview → Snapshots. */}
          {shown.length
            ? shown.map((a, i) => <ActivityRow key={a.id} a={a} contact={contact} context={context} first={i === 0}/>)
            : <div style={{fontSize:12.5, color:T.attioFaint, paddingTop:8}}>{emptyText}</div>}
          <button onClick={onLink} style={{marginTop:8, border:'none', background:'transparent', padding:0, cursor:'pointer',
            fontSize:12.5, color:T.attioBlue, fontFamily:'inherit'}}>{linkLabel}</button>
        </div>
      )}
    </div>
  );
}

/* Who performed or originated the activity, from its `source` — never defaulted to the owner. */
function Attribution({a}){
  const who = a.source === 'client' ? 'Client' : a.source === 'you' ? (a.by || CURRENT_USER.name) : a.by;
  if(!who) return null;
  return (
    <div style={{fontSize:11.5, color:T.attioFaint, marginTop:3}}>
      By <span style={{color: a.source === 'client' ? T.attioBlue : T.attioMuted, fontWeight:500}}>{who}</span>
    </div>
  );
}

function HistoryItem({a, last}){
  const meta = ACTIVITY_TYPES[a.type];
  let title = null, body = null, extra = null;
  switch(a.type){
    case 'email':   title = a.title; body = a.body; extra = a.status === 'scheduled' ? 'Scheduled' : a.direction === 'received' ? 'Received' : 'Sent'; break;
    case 'call':    title = activityHeadline(a); body = a.body; break;
    case 'meeting': title = a.title; extra = `${a.durationMin} min`; break;
    case 'task':    title = a.title; extra = activityWhen(a).text; break;
    case 'note':    body = richTextPlain(a.body); break;
    case 'ownerChange': title = `${userLabel(a.from) || 'No owner'} → ${userLabel(a.to) || 'No owner'}`; break;
    case 'workflow':    title = a.title; body = a.body; break;
  }
  const overdue = isOverdue(a);
  return (
    <div style={{display:'flex', gap:10}}>
      {/* Timeline rail: icon dot plus a hairline down to the next item. */}
      <div style={{display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0}}>
        <span style={{width:24, height:24, borderRadius:9999, background:'#fff', border:`1px solid ${T.attioLine}`, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <Icon name={meta.icon} size={12} color={T.attioMuted}/>
        </span>
        {!last && <span style={{flex:1, width:1, background:T.attioLine, marginTop:2}}/>}
      </div>
      <div style={{flex:1, minWidth:0, paddingBottom: last ? 0 : 14}}>
        <div style={{display:'flex', alignItems:'baseline', gap:6}}>
          <span style={{fontSize:12, fontWeight:600, color:T.attioText}}>{meta.label}</span>
          {extra && <span style={{fontSize:11.5, color: overdue ? T.red : T.attioMuted}}>· {extra}</span>}
          <div style={{flex:1}}/>
          <span style={{fontSize:11.5, color:T.attioFaint, flexShrink:0}}>{fmtActDate(a.at)}, {fmtActTime(a.at)}</span>
        </div>
        {title && <div style={{fontSize:12.5, color:T.attioText, marginTop:2}}>{title}</div>}
        {body && <div style={{fontSize:12.5, color:T.attioMuted, marginTop:2, lineHeight:1.45, whiteSpace: a.type === 'note' ? 'pre-line' : undefined}}>{body}</div>}
        <Attribution a={a}/>
      </div>
    </div>
  );
}


/* Complete history, newest first, grouped by month. */
function ActivityHistory({acts}){
  if(!acts.length) return <div style={{fontSize:12.5, color:T.attioFaint}}>No activity yet.</div>;
  const groups = [];
  acts.forEach(a => {
    const key = a.at.toLocaleDateString('en-US', {month:'long', year:'numeric'});
    if(!groups.length || groups[groups.length-1].key !== key) groups.push({key, items:[]});
    groups[groups.length-1].items.push(a);
  });
  return (
    <div style={{display:'flex', flexDirection:'column', gap:12}}>
      {groups.map(g => (
        <div key={g.key}>
          <div style={{fontSize:11, fontWeight:600, color:T.attioFaint, textTransform:'uppercase', letterSpacing:.4, marginBottom:8}}>{g.key}</div>
          {g.items.map((a, i) => <HistoryItem key={a.id} a={a} last={i === g.items.length-1}/>)}
        </div>
      ))}
    </div>
  );
}

Object.assign(window, {isOverdue, taskDueParts, taskDueValue, fmtTaskDue, ymdOf, 
  ACTIVITY_TYPES, generateActivities, withSampleTaskDescriptions, buildActivitySummary,
  ActivitySection, ActivityHistory, SummaryBlock, ActivityDropdown, HistoryItem, activityBox,
  ActivityRow, ActivityLead, activityLines, activityActor, listedActivities, leadText,
  LOG_CALL_OUTCOMES, SYSTEM_CALL_OUTCOMES, MEETING_PLATFORMS, TASK_TYPES, TASK_STATUSES, TASK_STATES, taskState, taskStateLabel, isPastDue, withTaskStatuses, isTaskOpen, DEFAULT_TASK_PIPELINE_ID, DEFAULT_TASK_PIPELINES, setTaskPipelines, taskPipelinesOf, taskPipelineIdOf, taskPipelineOf, taskStageLabel, outcomeOf, fmtActStamp,
  PersonAvatar, PersonName, CallDirection,
  fmtActDate, isOverdue, activityHeadline, activityWhen,
});
