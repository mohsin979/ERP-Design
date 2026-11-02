/* HOF Pulse ERP — Workflow engine (pipelines first).

   Four separate, connected concepts:
     Triggers   — the workflow's WHEN (workflows.jsx). Stage triggers run in this build: Stage
                  Entry, Stage Exit, Stage Movement Forward / Backward, Stay at Stage.
     Conditions — secondary rules checked when the trigger fires (Stage Entry, Stage Exit and
                  Stay at Stage only): record properties, pipeline state, the deal's activity
                  counts and activity attributes. {match:'all'|'any', rules:[rule | group]} —
                  groups can nest later.
     Actions    — the workflow's THEN; each step runs Automatically or Prompts the record owner
                  (the same action, one setting).
     Events     — structured records of what happened: {id, type, at, objectId, recordId,
                  pipelineId, attrs, chain}. Stage changes from the board, the Edit deal form and
                  workflow actions all produce them; an action's event can trigger another
                  workflow (chain depth ≤ 5, a workflow never runs twice for the same deal in one
                  chain — "Loop prevented").

   Deal pipelines only. Forward / Backward compare the pipeline's ordered stages; outcome stages
   (Edit Pipeline → "Outcome stage") are outside that order. Every deal keeps when it entered its
   stage (stageEnteredAt), whether or not any workflow uses it.

   Runs are execution instances, separate from the workflow they came from (which can change):
   {id, workflowId, version, trigger, dealId, chain, status, steps:[{actionId, status, dueAt,
   result}]}. Delayed steps (an action's wait) and Stay at Stage checks are scheduled and run when
   due; "Run now" brings one forward. Either way the deal is re-checked first (still in the stage,
   conditions still true). A failed step is logged and the others continue; nothing retries on its
   own (Retry is manual). Turning a workflow off cancels its scheduled steps; editing keeps them,
   and they run against the new version.

   Prompts go to the record owner: shown on the deal's board card and in their notification bell;
   each opens a small modal (complete or dismiss). Everything here — workflows, pipelines, deals,
   their activities, events, runs, prompts, notifications — is saved in this browser. */

const WF_DAY = 86400000;
const WF_UNIT_MS = {Days:WF_DAY, Weeks:7 * WF_DAY, Months:30 * WF_DAY, Years:365 * WF_DAY};
const wfDurationMs = (d) => (Number(d && d.amount) || 0) * (WF_UNIT_MS[d && d.unit] || WF_DAY);
const wfNewId = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const WF_MAX_DEPTH = 5;
const WF_STAGE_EVENTS = ['stageEntry', 'stageExit', 'stageForward', 'stageBackward'];
const WF_PROPERTY_EVENTS = ['propertyCreated', 'propertyUpdated', 'propertyCleared'];

/* ── Pipelines: ordered stages and moves ── */
const pipelineById2 = (data, id) => (data.pipelines || []).find(p => p.id === id);
const orderedStages = (pipeline) => ((pipeline && pipeline.stages) || []).filter(s => !s.outcome);
const stageLabelOf = (data, pipelineId, stageId) => (((pipelineById2(data, pipelineId) || {}).stages || []).find(s => s.id === stageId) || {}).label || '';
// 'forward' | 'backward' | null (same stage, or either end outside the ordered stages). Entering an
// outcome stage (Deal Won, Postponed, Deal Lost) from any other stage moves forward.
const stageMoveDirection = (pipeline, from, to) => {
  if(from && to && from !== to && ((pipeline && pipeline.stages) || []).some(s => s.id === to && s.outcome)) return 'forward';
  const ids = orderedStages(pipeline).map(s => s.id);
  const a = ids.indexOf(from), b = ids.indexOf(to);
  if(a < 0 || b < 0 || a === b) return null;
  return b > a ? 'forward' : 'backward';
};
const adjacentStage = (pipeline, stageId, dir) => {
  const ids = orderedStages(pipeline).map(s => s.id);
  const i = ids.indexOf(stageId);
  if(i < 0) return null;
  return ids[dir === 'forward' ? i + 1 : i - 1] || null;
};
const workflowTitle = (data, w) => {
  // A whole workflow: its trigger's title, or its triggers' names when it has several.
  if(!w.trigger && w.triggers){
    const views = workflowTriggerViews(w);
    if(views.length === 1) return workflowTitle(data, views[0]);
    return views.map(v => (workflowTrigger(v.trigger) || {}).label).filter(Boolean).join(' + ') || 'Workflow';
  }
  const t = workflowTrigger(w.trigger);
  // Property triggers are named by their property, stage triggers by their stage.
  const what = !w.context ? '' : t && t.group === 'stage' ? stageLabelOf(data, workflowPipeline(w), workflowStage(w)) : triggerDetail(data, w);
  return [t ? t.label : 'Workflow', what].filter(Boolean).join(' · ');
};

/* ── People ── */
const userName = (data, id) => ((data.users || []).find(u => u.id === id) || {}).name || '';
const teamLeadOf = (data, userId) => {
  const u = (data.users || []).find(x => x.id === userId);
  const t = u && (data.teams || []).find(x => x.id === u.teamId);
  return t ? t.leadId : null;
};
// 'recordOwner' / 'ownerTeamLead' / a user id → a user id (or null).
const resolvePerson = (data, deal, v) => v === 'recordOwner' ? deal.owner : v === 'ownerTeamLead' ? teamLeadOf(data, deal.owner) : v || null;
const currentUserId = (data) => ((data.users || []).find(u => u.name === CURRENT_USER.name) || {}).id || null;

/* ── Conditions ── a reusable registry of fields. Each field has a kind (its operators) and reads
   its value from the evaluation env {data, deal, acts, previousStage, change}: `get(env)` → the
   value, or `has(env, v)` → whether any matching activity exists. Fields come from the workflow's
   object and context, and from its trigger (a property trigger adds Previous / New value).
   New fields are added here; the editor and the engine read the same list. */
const CONDITION_OPERATORS = {
  text:   [{id:'equals', label:'Is'}, {id:'notEquals', label:'Is not'}, {id:'contains', label:'Contains'}, {id:'notContains', label:'Does not contain'},
           {id:'isEmpty', label:'Is empty', noValue:true}, {id:'isNotEmpty', label:'Is not empty', noValue:true}],
  number: [{id:'equals', label:'Equals'}, {id:'notEquals', label:'Does not equal'}, {id:'gt', label:'Greater than'}, {id:'lt', label:'Less than'},
           {id:'isEmpty', label:'Is empty', noValue:true}, {id:'isNotEmpty', label:'Is not empty', noValue:true}],
  date:   [{id:'gt', label:'Is after'}, {id:'lt', label:'Is before'}, {id:'equals', label:'Is on'}, {id:'notEquals', label:'Is not on'},
           {id:'isEmpty', label:'Is empty', noValue:true}, {id:'isNotEmpty', label:'Is not empty', noValue:true}],
  select: [{id:'equals', label:'Is'}, {id:'notEquals', label:'Is not'}, {id:'isEmpty', label:'Is empty', noValue:true}, {id:'isNotEmpty', label:'Is not empty', noValue:true}],
  choice: [{id:'equals', label:'Is'}, {id:'notEquals', label:'Is not'}],
  count:  [{id:'gte', label:'Is at least'}, {id:'gt', label:'Is more than'}, {id:'equals', label:'Equals'}, {id:'lt', label:'Is less than'}],
  find:   [{id:'contains', label:'Contains'}, {id:'notContains', label:'Does not contain'}],
};
const CALL_OUTCOME_VALUES = [...new Set([...SYSTEM_CALL_OUTCOMES, ...LOG_CALL_OUTCOMES])];
// A property's kind for the condition's shape (its operators, matching and value come from its type — propertyTypes.jsx).
const conditionKind = (propType) => ({number:'number', amount:'number', date:'date', choice:'select', multi:'select'})[propertyCompare(propType)] || 'text';
/* A condition field as a property: the record's own carry theirs (`prop`); Customer Profile,
   Accounting and User metrics by their kind. Activity counts and template checks aren't
   properties — they keep their own operators (CONDITION_OPERATORS). */
const KIND_PROPERTY_TYPE = {number:'Number', text:'Single-Line Text', select:'Single Selection', date:'Date'};
const fieldProperty = (f) => !f ? null : f.prop ? f.prop : KIND_PROPERTY_TYPE[f.kind] ? {type:KIND_PROPERTY_TYPE[f.kind], label:f.label, options:f.options} : null;
const fieldOperators = (f, opts) => { const p = fieldProperty(f); return p ? propertyOperators(p, opts) : (f ? CONDITION_OPERATORS[f.kind] || [] : []); };
// A field's operator by id — its type's (no Changed here: those are the trigger's), else one saved before.
const fieldOperatorOf = (f, id) => f && (fieldOperators(f, {withChange:false}).find(o => o.id === id) || (CONDITION_OPERATORS[f.kind] || []).find(o => o.id === id)) || null;
const latest = (acts, test) => acts.find(test) || {};   // activities are newest first
const isSentEmail = (a) => a.type === 'email' && a.direction === 'sent' && a.status !== 'scheduled';
const opts = (list) => list.map(v => typeof v === 'string' ? {value:v, label:v} : v);
const countField = (key, group, label, test) => ({key:`count:${key}`, group, label, kind:'count', get:(env) => env.acts.filter(test).length});
/* Activity fields — on the record's own activities. */
const activityConditionFields = (data) => [
  // Emails
  countField('emailsSent', 'Emails', 'Emails Sent', isSentEmail),
  countField('emailsScheduled', 'Emails', 'Scheduled Emails', (a) => a.type === 'email' && a.status === 'scheduled'),
  {key:'emailTemplateSent', group:'Emails', label:'Email Template Sent', kind:'choice', options:emailTemplatesOf(data).map(t => ({value:t.id, label:t.name})),
   has:(env, v) => env.acts.some(a => isSentEmail(a) && a.templateId === v)},
  {key:'lastEmailTemplate', group:'Emails', label:'Last Email Template', kind:'choice', options:emailTemplatesOf(data).map(t => ({value:t.id, label:t.name})),
   get:(env) => latest(env.acts, isSentEmail).templateId || ''},
  // Calls
  countField('calls', 'Calls', 'Calls', (a) => a.type === 'call'),
  countField('callsNoAnswer', 'Calls', 'Calls · No answer', (a) => a.type === 'call' && a.outcome === 'No answer'),
  countField('callsConnected', 'Calls', 'Calls · Connected', (a) => a.type === 'call' && a.outcome === 'Connected'),
  {key:'lastCallOutcome', group:'Calls', label:'Last Call Outcome', kind:'choice', options:opts(CALL_OUTCOME_VALUES), get:(env) => latest(env.acts, a => a.type === 'call').outcome || ''},
  {key:'lastCallDirection', group:'Calls', label:'Last Call Direction', kind:'choice', options:[{value:'outbound', label:'Outbound'}, {value:'inbound', label:'Inbound'}],
   get:(env) => latest(env.acts, a => a.type === 'call').direction || ''},
  {key:'lastCallDuration', group:'Calls', label:'Last Call Duration (min)', kind:'number', get:(env) => { const c = latest(env.acts, a => a.type === 'call'); return c.type ? (c.durationMin || 0) : ''; }},
  // Meetings
  countField('meetings', 'Meetings', 'Meetings', (a) => a.type === 'meeting'),
  countField('meetingsUpcoming', 'Meetings', 'Upcoming Meetings', (a) => a.type === 'meeting' && new Date(a.scheduledFor || a.at).getTime() > Date.now()),
  {key:'lastMeetingPlatform', group:'Meetings', label:'Last Meeting Platform', kind:'choice', options:opts([...new Set([...MEETING_PROVIDERS.map(p => p.label), ...MEETING_PLATFORMS])]),
   get:(env) => latest(env.acts, a => a.type === 'meeting').platform || ''},
  // Tasks
  countField('tasksOpen', 'Tasks', 'Open Tasks', (a) => a.type === 'task' && isTaskOpen(a)),
  countField('tasksOverdue', 'Tasks', 'Overdue Tasks', (a) => isOverdue(a)),
  countField('tasksCompleted', 'Tasks', 'Completed Tasks', (a) => a.type === 'task' && !isTaskOpen(a)),
  {key:'openTaskType', group:'Tasks', label:'Open Task Type', kind:'choice', options:opts(TASK_TYPES), has:(env, v) => env.acts.some(a => a.type === 'task' && isTaskOpen(a) && a.taskType === v)},
  {key:'lastTaskStatus', group:'Tasks', label:'Last Task Status', kind:'choice', options:TASK_STATUSES.map(s => ({value:s.key, label:s.label})),
   get:(env) => latest(env.acts, a => a.type === 'task').status || ''},
  // Notes
  countField('notesAdded', 'Notes', 'Notes Added', (a) => a.type === 'note'),
  {key:'lastNote', group:'Notes', label:'Last Note', kind:'find', get:(env) => richTextPlain(latest(env.acts, a => a.type === 'note').body || '')},
];
/* Records the engine runs on — Contacts, Deals and Customers — are told apart by their id ('cust-…'
   is a customer, 'deal-…' a deal, a number a contact; store.jsx), so a run, violation or event names
   its record by id alone (a contact's as a string, '12'). An activity carries its record's key
   (`contactId` / `dealId` / `customerId`). */
const recordObjectOf = (id) => { const s = String(id ?? ''); return s.startsWith('cust-') ? 'customers' : /^\d+$/.test(s) ? 'contacts' : 'deals'; };
const recordKey = (id) => { const o = recordObjectOf(id); return o === 'customers' ? {customerId:id} : o === 'contacts' ? {contactId:Number(id)} : {dealId:id}; };
const recordNoun = (id) => ({customers:'customer', contacts:'contact', deals:'deal'})[recordObjectOf(id)];
// Objects whose records have activity (the activity conditions apply to them).
const ACTIVITY_RECORD_OBJECTS = ['contacts', 'deals', 'customers'];
/* ── Data scopes (property triggers) ── a property trigger reads one of four sets of properties:
     record     — the record's own properties;
     profile    — its Customer Profile (child data of the person: a contact's own; a deal's or a
                  customer's contact's) — each profile field, and each profile template's score;
     accounting — its Accounting (child data: every installment of its payment terms; a trigger
                  holds when ANY installment, or set of payment terms, matches);
     owner      — its owner's User Properties (the sales professional's profile — mock values until
                  HRMS provides them). Company-wide, a User Property trigger reads each user's.
   One property-trigger mechanism for all four; the scope says where the property belongs. The
   engine keeps the live profile and accounting data here (WF_LIVE). */
let WF_LIVE = {profiles:{}, facts:{}, accounting:[], users:[], forms:[]};
/* A form submission as workflows see it — the one that created the record. The form's saved list
   (WF_LIVE.forms), else the submission just made (before its list is saved): `WF_FORM_SUBS` once
   its record exists, `WF_FORM_PENDING` while the record is being created. */
const WF_FORM_SUBS = new Map();   // "<object>:<id>" → {form, submission}
let WF_FORM_PENDING = null;        // {form, submission} while its record is created
function recordFormSubmission(rec){
  if(!rec) return null;
  const object = recordObjectOf(rec.id), key = `${object}:${object === 'contacts' ? Number(rec.id) : rec.id}`;
  if(WF_FORM_SUBS.has(key)) return WF_FORM_SUBS.get(key);
  for(const f of (WF_LIVE.forms || [])){ const s = (f.submissions || []).find(x => x.object === object && String(x.recordId) === String(rec.id)); if(s) return {form:f, submission:s}; }
  return WF_FORM_PENDING && WF_FORM_PENDING.submission.object === object ? WF_FORM_PENDING : null;
}
/* The Form properties (Property Events → Form Property, and conditions): Form Name, Form
   Submission Date, Submission Source and each form's answers ("<Form> · <field>") — read from the
   submission that created the record. A record no form created has none (empty). */
const FORM_TRIGGER_FIELDS = () => {
  const sub = (env) => recordFormSubmission(env.deal);
  const answer = (f, fd) => (env) => { const s = sub(env); return s && s.form.id === f.id ? ((s.submission.answers || {})[fd.id] ?? '') : ''; };
  return [
    {key:'formName', label:'Form Name', kind:'select', options:(WF_LIVE.forms || []).map(f => ({value:f.name, label:f.name})), get:(env) => { const s = sub(env); return s ? s.form.name : ''; }},
    {key:'formSubmittedAt', label:'Form Submission Date', kind:'date', get:(env) => { const s = sub(env); return s ? s.submission.at : ''; }},
    {key:'formSource', label:'Submission Source', kind:'select', options:FORM_SUBMISSION_SOURCES.map(x => ({value:x.value, label:x.value})), get:(env) => { const s = sub(env); return s ? formSubmissionSource(s.submission) : ''; }},
    ...(WF_LIVE.forms || []).flatMap(f => (f.fields || []).map(fd => { const p = formFieldProperty(fd);
      return {key:`ans~${f.id}~${fd.id}`, label:`${f.name} · ${fd.label || 'Untitled field'}`, kind:conditionKind(p), prop:{...p, key:`ans~${f.id}~${fd.id}`}, options:(p.options || []).map(o => ({value:o, label:o})), get:answer(f, fd)}; })),
  ];
};
// A record's Form Name / Form Submission Date (derived record properties; undefined for any other).
const formRecordValue = (key, rec) => {
  if(key !== 'formName' && key !== 'formSubmittedAt') return undefined;
  const s = recordFormSubmission(rec);
  return !s ? '' : key === 'formName' ? s.form.name : storePropertyValue({type:'Timestamp'}, new Date(s.submission.at));
};
/* A user's User Properties: their own properties (Settings → Properties → Users — Country,
   Language, Designation and any added), each with its type; then the system-generated metrics. */
const userPropertyFields = (data) => [
  ...(((data && data.properties) || WF_LIVE.properties || []).filter(p => p.objectId === 'users' && !p.archived).map(p => ({key:p.key, label:p.label, kind:conditionKind(p.type), prop:p}))),
  ...USER_METRIC_FIELDS];
const USER_METRIC_FIELDS = [
  {key:'sales', label:'Total Number of Sales', kind:'number'}, {key:'invoiceCash', label:'Total Invoice Cash', kind:'number'},
  {key:'currentExpectedCash', label:'Current and Expected Cash', kind:'number'}, {key:'totalCash', label:'Total Cash', kind:'number'},
  {key:'serviceCash', label:'Total Service Cash', kind:'number'}, {key:'callTime', label:'Total Call Time (minutes)', kind:'number'},
  {key:'completedTasks', label:'Total Completed Tasks', kind:'number'}, {key:'dealsCreated', label:'Total Deals Created', kind:'number'},
  {key:'velocity', label:'Total Velocity (days)', kind:'number'}, {key:'contactToDeal', label:'Contact-to-Deal Velocity (days)', kind:'number'},
  {key:'contactToCustomer', label:'Contact-to-Customer Velocity (days)', kind:'number'}, {key:'assignments', label:'Total Assignments', kind:'number'},
  {key:'breakTime', label:'Total Break Time (minutes)', kind:'number'}, {key:'dials', label:'Total Dials', kind:'number'},
];
const USER_PROPERTY_FIELDS = USER_METRIC_FIELDS;   // the metrics (properties: userPropertyFields)
// A user's User Properties (by id or name): the generated values, with what's set on the user (`profile`).
const userPropertiesOf = (data, who) => { const u = (data.users || []).find(x => x.id === who || x.name === who); return u ? {...(u.profile || {}), ...ownerProfileMock(u.name, u).raw} : null; };
// The person whose Customer Profile a record has: a contact itself; a deal's or customer's contact.
const profileContactId = (rec) => !rec ? null : recordObjectOf(rec.id) === 'contacts' ? Number(rec.id) : (rec.contactId ?? null);
const PROFILE_TRIGGER_FIELDS = () => [
  // Each Customer Profile form field: the person's current answer (WF_LIVE.profiles: their filled forms).
  ...PROFILE_FORM_TRIGGER_FIELDS(),
];
/* Accounting properties — each read across the record's payment terms (Accounting), oldest first:
   totals summed; installments in schedule order. An installment whose rest moved to a balance
   installment counts through that balance (it carries what's left). `all`: the condition holds when
   every installment's value meets it. */
const PAYMENT_STATUS_OPTIONS = ['Unpaid', 'Partially Paid', 'Paid'].map(v => ({value:v, label:v}));
const termsInOrder = (terms) => [...terms].sort((a, b) => (toTime(a.createdAt) || 0) - (toTime(b.createdAt) || 0));
const termsTotals = (terms) => terms.reduce((t, s) => { const x = scheduleTotals(s); return {total:t.total + x.total, received:t.received + x.received, outstanding:t.outstanding + x.outstanding}; }, {total:0, received:0, outstanding:0});
const liveInstallments = (terms) => termsInOrder(terms).flatMap(s => (s.installments || []).filter(i => !(s.installments || []).some(x => x.parentId === i.id)).map(i => ({s, i})));
const installmentStatusLabel = (s, i) => (PAYMENT_STATUS[installmentState(s, i).status] || {}).label || '';
const nextInstallment = (terms) => liveInstallments(terms).find(({s, i}) => installmentState(s, i).status !== 'paid') || null;
const ACCOUNTING_TRIGGER_FIELDS = [
  {key:'totalAmount',   label:'Total Amount',      kind:'number', level:'record', readRecord:(terms) => terms.length ? termsTotals(terms).total : ''},
  {key:'totalReceived', label:'Total Received',    kind:'number', level:'record', readRecord:(terms) => terms.length ? termsTotals(terms).received : ''},
  {key:'outstanding',   label:'Total Outstanding', kind:'number', level:'record', readRecord:(terms) => terms.length ? termsTotals(terms).outstanding : ''},
  /* The record's first installment — the first one of its earliest payment terms (empty with none):
     the payment the client makes to start (e.g. before Payment Made). */
  {key:'firstInstallmentStatus', label:'First Installment Status', kind:'select', level:'record', options:PAYMENT_STATUS_OPTIONS,
   readRecord:(terms) => { const s = termsInOrder(terms)[0], i = s && (s.installments || []).find(x => !x.parentId);
     return i ? installmentStatusLabel(s, i) : ''; }},
  // The next installment still to be paid (in schedule order): its status, its due date.
  {key:'nextInstallmentStatus', label:'Next Installment Status', kind:'select', level:'record', options:PAYMENT_STATUS_OPTIONS,
   readRecord:(terms) => { const n = nextInstallment(terms); return n ? installmentStatusLabel(n.s, n.i) : ''; }},
  {key:'allInstallmentStatuses', label:'All Installment Statuses', kind:'select', level:'installments', all:true, options:PAYMENT_STATUS_OPTIONS,
   readAll:(terms) => liveInstallments(terms).map(({s, i}) => installmentStatusLabel(s, i))},
  {key:'nextInstallmentDueDate', label:'Next Installment Due Date', kind:'date', level:'record',
   readRecord:(terms) => { const n = nextInstallment(terms); return n ? n.i.dueDate || '' : ''; }},
  // The payment schedule's final installment.
  {key:'lastInstallmentDueDate', label:'Last Installment Due Date', kind:'date', level:'record',
   readRecord:(terms) => { const l = liveInstallments(terms).slice(-1)[0]; return l ? l.i.dueDate || '' : ''; }},
];
// A record's payment terms (Accounting), and one property's values across them (any may match).
const recordPaymentTerms = (rec) => !rec ? [] : (WF_LIVE.accounting || []).filter(s => s.object === recordObjectOf(rec.id) && String(s.recordId) === String(rec.id));
const accountingValues = (rec, f) => f.level === 'installments' ? f.readAll(recordPaymentTerms(rec))
  : [f.readRecord(recordPaymentTerms(rec))];
/* The fields a property trigger can watch in a scope (`prop:<key>`, as the record's own are). */
const scopeFields = (data, scope) => {
  if(scope === 'profile') return PROFILE_TRIGGER_FIELDS().map(f => ({key:`prop:${f.key}`, group:'Customer Profile', label:f.label, kind:f.kind, options:f.options, get:(env) => f.read(profileContactId(env.deal))}));
  if(scope === 'accounting') return ACCOUNTING_TRIGGER_FIELDS.map(f => ({key:`prop:${f.key}`, group:'Accounting', label:f.label, kind:f.kind, options:f.options, many:(env) => accountingValues(env.deal, f), all:!!f.all}));
  if(scope === 'form') return FORM_TRIGGER_FIELDS().map(f => ({...f, key:`prop:${f.key}`, group:'Form'}));
  if(scope === 'owner') return userPropertyFields(data).map(f => ({key:`prop:${f.key}`, group:'User Properties', label:f.label, kind:f.kind, prop:f.prop,
    get:(env) => { const r = userPropertiesOf(env.data || data, env.user || (env.deal && env.deal.owner)); return r ? r[f.key] : ''; }}));
  return null;
};
/* A contact's stage is its Types of Contact property (a property-based pipeline): the engine sees
   it as {pipeline, stage} like a deal's, and a move writes the property back. */
const contactEnginePipeline = (data) => objectPipelines(data, 'contacts').find(p => p.source === 'property') || null;
const contactStageFor = (pl, c) => pl ? stageIdOf(pl, c) : null;
const contactValueFor = (pl, stageId) => { const st = pl && pl.stages.find(x => x.id === stageId); return st ? st.value : undefined; };
/* The associated records a record's association property names (Associated Customer on a deal,
   Associated Deal on a customer or contact…): their names, as its side panel shows them — empty
   with none. Undefined for any other property. */
const associatedNames = (objectId, key, rec) => {
  if(!rec) return undefined;
  const recs = WF_LIVE.records || [], of = (o) => recs.filter(r => recordObjectOf(r.id) === o), names = (list) => list.map(r => r.name).join(', ');
  if(objectId === 'deals' && key === 'customers') return names(of('customers').filter(c => (c.dealIds || []).includes(rec.id)));
  if(objectId === 'customers' && key === 'deals') return names(of('deals').filter(d => (rec.dealIds || []).includes(d.id)));
  if(objectId === 'contacts' && key === 'deals') return names(of('deals').filter(d => String(d.contactId) === String(rec.id)));
  if(objectId === 'contacts' && key === 'customers') return names(of('customers').filter(c => String(c.contactId) === String(rec.id)));
  return undefined;
};
/* The fields a workflow's conditions can read: `w` = {context, trigger, triggerConfig}. */
function conditionFields(data, w){
  const ctx = (w && w.context) || {}, cfg = (w && w.triggerConfig) || {};
  // A property trigger on Customer Profile, Accounting or User Properties reads that scope.
  if(w && w.trigger === 'propertyUpdate' && scopeOf(cfg) !== 'record') return scopeFields(data, scopeOf(cfg));
  const objectId = ctx.object || 'deals';
  const t = w && workflowTrigger(w.trigger);
  const pipelineId = w ? workflowPipeline(w) : null;
  const pipeline = pipelineById2(data, pipelineId);
  const stages = ((pipeline && pipeline.stages) || []).map(s => ({value:s.id, label:s.label}));
  const users = (data.users || []).map(u => ({value:u.id, label:u.name}));
  const propOptions = (p) => p.type === 'User' ? users : p.type === 'Pipeline' ? recordPipelines(data, objectId).map(x => ({value:x.id, label:x.label}))
    : p.type === 'Pipeline stage' ? stages : (p.options || []).length ? p.options.map(o => ({value:o, label:o})) : (propertyTypeDef(p.type).options ? propertyTypeDef(p.type).options(p) : []);
  const props = objectProperties(data, objectId);
  const record = props.map(p => ({key:`prop:${p.key}`, group:`${objectName(data, objectId).replace(/s$/, '')} Properties`, label:p.label, kind:conditionKind(p),
    prop:{...p, options:propOptions(p)}, options:propOptions(p), get:(env) => { const a = associatedNames(objectId, p.key, env.deal) ?? formRecordValue(p.key, env.deal); return a !== undefined ? a : env.deal[p.key]; }}));
  const pipelineFields = objectPipelines(data, objectId).length ? [
    {key:'currentStage', group:'Pipeline', label:'Current Stage', kind:'choice', options:stages, get:(env) => env.deal.stage},
    ...(t && t.group === 'stage' && t.key !== 'stayAtStage' ? [{key:'previousStage', group:'Pipeline', label:'Previous Stage', kind:'choice', options:stages, get:(env) => env.previousStage || ''}] : []),
    {key:'daysInStage', group:'Pipeline', label:'Days in Current Stage', kind:'number', get:(env) => env.deal.stageEnteredAt ? Math.floor((Date.now() - env.deal.stageEnteredAt) / WF_DAY) : ''},
  ] : [];
  return [...record, ...pipelineFields, ...(ACTIVITY_RECORD_OBJECTS.includes(objectId) ? activityConditionFields(data) : [])];
}
// Blank in any shape (a list with nothing in it, a group with no part filled in).
const isBlank = (v) => v === undefined || v === null || (Array.isArray(v) ? !v.length : typeof v === 'object' ? Object.values(v).every(x => isBlank(x)) : String(v).trim() === '');
// An operator by kind (activity counts and the rest that aren't properties).
const conditionOperatorOf = (kind, id) => (CONDITION_OPERATORS[kind] || []).find(o => o.id === id) || null;
const toTime = (v) => { if(isBlank(v)) return null; const t = new Date(v).getTime(); return isNaN(t) ? null : t; };
/* A rule that isn't complete yet is ignored. */
function evalConditionRule(rule, env, fields){
  const f = fields.find(x => x.key === rule.field);
  if(!f) return null;
  // A property: its type's operator and matching (propertyTypes.jsx) — the same as the filters'.
  const p = !f.has && fieldProperty(f), pop = p && propertyOperators(p, {withChange:false}).find(o => o.id === rule.op);
  if(pop){
    if(!pop.noValue && isBlank(rule.value)) return null;
    const ptest = (actual) => propertyValueMatches(p, rule.op, actual, rule.value);
    if(f.many){ const vals = f.many(env); return vals.length ? (f.all ? vals.every(ptest) : vals.some(ptest)) : rule.op === 'isEmpty'; }
    return ptest(f.get(env));
  }
  const op = fieldOperatorOf(f, rule.op);
  if(!op || (!op.noValue && isBlank(rule.value))) return null;
  const v = rule.value;
  if(f.has){ const r = f.has(env, v); return op.id === 'notEquals' ? !r : r; }
  const test = (actual) => {
    switch(op.id){
      case 'isEmpty':    return isBlank(actual);
      case 'isNotEmpty': return !isBlank(actual);
      case 'contains':   return String(actual || '').toLowerCase().includes(String(v).toLowerCase());
      case 'notContains':return !String(actual || '').toLowerCase().includes(String(v).toLowerCase());
    }
    if(f.kind === 'date'){
      const a = toTime(actual), b = toTime(v);
      if(a === null || b === null) return false;
      const day = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
      return {gt:day(a) > day(b), lt:day(a) < day(b), equals:day(a) === day(b), notEquals:day(a) !== day(b)}[op.id];
    }
    if(f.kind === 'number' || f.kind === 'count'){
      const a = Number(actual), b = Number(v);
      if(isBlank(actual) || isNaN(a)) return false;
      return {equals:a === b, notEquals:a !== b, gt:a > b, lt:a < b, gte:a >= b, lte:a <= b}[op.id];
    }
    const same = String(actual ?? '').toLowerCase() === String(v).toLowerCase();
    return op.id === 'equals' ? same : !same;
  };
  // Several values: the condition holds when any one matches (`all`: every one); none at all is empty.
  if(f.many){ const vals = f.many(env); return vals.length ? (f.all ? vals.every(test) : vals.some(test)) : op.id === 'isEmpty'; }
  return test(f.get(env));
}
/* A rule is complete when it has a known field, an operator for it and (where the operator takes
   one) a value. Groups count their rules. */
const conditionRules = (cond) => ((cond && cond.rules) || []).flatMap(r => r.rules ? conditionRules(r) : [r]);
const ruleComplete = (r, fields) => {
  const f = fields.find(x => x.key === r.field);
  const op = fieldOperatorOf(f, r.op);
  return !!op && (op.noValue || !isBlank(r.value));
};
// Additional conditions: none, or every one complete.
const conditionsComplete = (data, w) => { const fields = conditionFields(data, w); return conditionRules(w.conditions).every(r => ruleComplete(r, fields)); };
/* Property Update's own condition — on the chosen property, with its type's operators — as a rule
   on that property's field (`prop:<key>`), read on the record after the change. */
/* Property Update also offers Is changed / Is not changed — about the property changing over time,
   not its value: for a duration (Days / Weeks / Months) or, when the context has a stage, In this
   stage. Is changed: the property changes within that time of the record entering the context
   (or while it's in the stage). Is not changed: the time passes since its last change (or since
   the record entered the context) with no change — or the record leaves the stage without it
   having changed there. Stored as op 'changed' | 'notChanged', changeAmount, changeUnit, inStage. */
const PROPERTY_CHANGE_OPERATORS = [{id:'changed', label:'Is changed', change:true}, {id:'notChanged', label:'Is not changed', change:true}];
const PROPERTY_CHANGE_UNITS = ['Days', 'Weeks', 'Months'];
/* When a condition over time is evaluated (a property's Is changed / Is not changed, an associated
   record's Is not created / Is not changed): In this stage — records already in it and records
   entering it; Within a time period — counted from when the record enters the context (its stage,
   if there is one); Throughout the record's lifecycle — at any point in its life, a violation staying
   open (across stages) until it's met. */
const CONDITION_WHEN = [{value:'stage', label:'In this stage'}, {value:'period', label:'Within a time period'}, {value:'lifecycle', label:'Throughout the record’s lifecycle'}];
const conditionWhen = (c) => (c && c.when) || (c && c.inStage ? 'stage' : c && Number(c.changeAmount) > 0 ? 'period' : '');
const conditionWhenReady = (c, ctx) => { const w = conditionWhen(c);
  return w === 'stage' ? !!(ctx && ctx.stage) : w === 'lifecycle' ? true : w === 'period' ? Number(c.changeAmount) > 0 : false; };
// "in this stage", "within 5 days" / "for 5 days", "during its lifecycle".
const whenPhrase = (c, ctx, periodWord = 'within') => {
  const w = conditionWhen(c), n = Number(c.changeAmount), unit = String(c.changeUnit || 'Days').toLowerCase().replace(/s$/, '');
  if(w === 'stage') return ctx && ctx.stage ? 'in this stage' : '';
  if(w === 'lifecycle') return 'during its lifecycle';
  return w === 'period' && n > 0 ? `${periodWord} ${n} ${unit}${n === 1 ? '' : 's'}` : '';
};
// The When control: In this stage (with a Stage in the context), Within a time period (its number and unit), Throughout the lifecycle.
function WhenField({config, context, onChange}){
  const c = config || {}, ctx = context || {}, hasStage = !!(ctx.pipeline && ctx.stage), when = conditionWhen(c);
  const options = CONDITION_WHEN.filter(o => o.value !== 'stage' || hasStage || when === 'stage');
  const help = {stage:'Checks records already in this stage and records entering it.',
    period:`Counted from when the record ${hasStage ? 'enters this stage' : ctx.pipeline ? 'enters this pipeline' : 'is created'}.`,
    lifecycle:'Checked across the record’s whole lifecycle until it’s met.'}[when];
  return (
    <div style={{display:'flex', flexDirection:'column', gap:10}}>
      {cfgField('When', <FormSelect value={when} placeholder="Select when" options={options}
        onChange={(v)=>onChange({when:v, inStage:v === 'stage', ...(v === 'period' ? {changeUnit:c.changeUnit || 'Days'} : {})})}/>)}
      {when === 'period' && <DurationInput units={PROPERTY_CHANGE_UNITS} value={{amount:c.changeAmount || '', unit:c.changeUnit || 'Days'}} onChange={(d)=>onChange({changeAmount:d.amount, changeUnit:d.unit})}/>}
      {help && cfgHelp(help)}
    </div>
  );
}
const triggerPropertyOperators = (kind) => [...(CONDITION_OPERATORS[kind] || []), ...PROPERTY_CHANGE_OPERATORS];
const isChangeOp = (op) => op === 'changed' || op === 'notChanged';
const changeDuration = (c) => ({amount:c.changeAmount, unit:c.changeUnit || 'Days'});
const triggerConditionRule = (w) => { const c = (w && w.triggerConfig) || {}; return {field:`prop:${c.property}`, op:c.op || '', value:c.value ?? ''}; };
const triggerConditionComplete = (data, w) => {
  const c = (w && w.triggerConfig) || {};
  if(!c.property) return false;
  if(isChangeOp(c.op)) return conditionWhenReady(c, w.context);
  return ruleComplete(triggerConditionRule(w), conditionFields(data, w));
};
const triggerConditionHolds = (data, w, deal) => evalConditionRule(triggerConditionRule(w), {data, deal, acts:[]}, conditionFields(data, w)) === true;
/* What Save needs from the conditions: the trigger's own condition when it requires one, and any
   additional conditions complete. */
const conditionsValid = (data, w) => (!(workflowTrigger(w.trigger) || {}).requiresCondition || triggerConditionComplete(data, w)) && conditionsComplete(data, w);
function evalConditions(cond, env, fields){
  const results = ((cond && cond.rules) || []).map(r => r.rules ? evalConditions(r, env, fields) : evalConditionRule(r, env, fields)).filter(x => x !== null);
  if(!results.length) return true;
  return cond.match === 'any' ? results.some(Boolean) : results.every(Boolean);
}
const hasConditions = (w) => !!(w.conditions && (w.conditions.rules || []).length);

/* ── Trigger matching ── how each trigger matches an event (the builder's registry declares the
   triggers and their settings). A Stage in the context scopes every trigger to records currently
   in that stage; stage triggers point at their own stage (the context's, else their setting). */
const inContext = (w, deal) => !!deal && (!w.context.pipeline || deal.pipeline === w.context.pipeline) && (!w.context.stage || deal.stage === w.context.stage);
const atStage = (key) => (w, ev) => ev.type === key && ev.pipelineId === workflowPipeline(w) && (key === 'stageEntry' ? ev.attrs.toStage : ev.attrs.fromStage) === workflowStage(w);
// Stage Entry Moving Forward / Backward: the record enters the stage from an earlier / a later stage.
const entersMoving = (dir) => (w, ev) => ev.type === dir && ev.pipelineId === workflowPipeline(w) && ev.attrs.toStage === workflowStage(w);
// Property Update: any change to the chosen property (its value set, changed or cleared).
// The trigger fires only when its own condition holds on the record after the change.
// When the record entered the workflow's context: its stage entry, else its creation.
const contextEnteredAt = (w, deal) => (w.context || {}).stage ? (deal.stageEnteredAt || 0) : (toTime(deal.created) || 0);
/* Trigger Scope (workflows.jsx): New Records — the triggers apply only to records new to the
   context since the workflow was configured (`scopeSince`): ones that entered its stage (a Stage
   context — entering a stage, not necessarily a new record), entered its pipeline (a Pipeline
   context) or were created (an Object or Property context, or Company-wide). A Stage Exit counts
   the entry it ends. All Records — every record. */
const createdTime = (deal) => deal.createdAt || toTime(deal.created) || 0;
const scopeEnteredAt = (w, deal, ev) => {
  const ctx = w.context || {};
  if(ctx.stage) return ev && ev.type === 'stageExit' ? (ev.attrs.enteredAt || 0) : (deal.stageEnteredAt || 0);
  if(ctx.pipeline) return (ev && ev.type === 'stageExit' && ev.attrs.pipelineEnteredAt) || deal.pipelineEnteredAt || createdTime(deal);
  return createdTime(deal);
};
/* Applies To: the records of these owners — people, or members of teams (`appliesTo`: 'user:<id>' /
   'team:<id>'); none chosen: everyone's. */
const appliesToOwner = (w, ownerId) => {
  const list = (w && w.appliesTo) || [];
  if(!list.length) return true;
  if(!ownerId) return false;
  const team = ((WF_LIVE.users || []).find(u => u.id === ownerId) || {}).teamId;
  return list.includes(`user:${ownerId}`) || (!!team && list.includes(`team:${team}`));
};
const inTriggerScope = (w, deal, ev) => (!deal || appliesToOwner(w, deal.owner))
  && (w.triggerScope !== 'new' || !w.scopeSince || (!!deal && scopeEnteredAt(w, deal, ev) >= w.scopeSince));
const onPropertyUpdate = (w, ev, deal, data) => {
  const c = w.triggerConfig || {};
  // Is not changed: In this stage holds as the record enters the stage (entryStateHolds) and ends
  // when the property changes there; a duration is checked by the scheduler (checkQuietProperties).
  if(c.op === 'notChanged') return false;
  if(!WF_PROPERTY_EVENTS.includes(ev.type) || ev.attrs.property !== scopedPropertyKey(c) || !inContext(w, deal)) return false;
  // Is changed: any change in the stage, or within the time of entering the context.
  if(c.op === 'changed') return c.inStage || c.when === 'lifecycle' ? true : Date.now() - contextEnteredAt(w, deal) <= wfDurationMs(changeDuration(c));
  return triggerConditionHolds(data, w, deal);
};
/* Activity Events (ACTIVITY_TRIGGER_TYPES): a specific email — the chosen template sent or
   scheduled; or a count — on an event that adds to it (a call: only one with the chosen outcome),
   compare the record's count. Repeat: every increase. Otherwise once — when the count first meets
   the condition (or on the first counted activity when it already does, e.g. Is less than 3). */
const onActivityProperty = (w, ev, deal, data, acts) => {
  const c = w.triggerConfig || {}, p = activityTriggerProperty(w.trigger, c.activityProperty);
  if(!p || ev.type !== p.event || !inContext(w, deal)) return false;
  if(p.match && !p.match(ev)) return false;            // this event doesn't change it (e.g. a logged call for dialer calls)
  if(p.ago) return false;                               // Email Sent Ago: the scheduler fires it
  if(p.template) return !c.template || ev.attrs.templateId === c.template;   // any email, or the chosen template's
  if(p.each) return !c.outcome || ev.attrs.outcome === c.outcome;            // every event (Call Made: any outcome, or one)
  if(p.outcome && ev.attrs.outcome !== p.outcome) return false;   // this call didn't change the count
  /* Repeat · Is more than: every increment above the number — each event that adds to the count
     while it's over it (Is less than: every decrement — checkRepeatDecrements). Saved before
     Repeat took the condition: every increase. */
  if(c.repeat){
    if(!p.outcome && ev.attrs.added === false) return false;   // an existing activity changed: the count didn't go up
    if(!countConditionComplete(c)) return c.op !== 'lt' && c.op !== 'equals';
    return c.op === 'gt' && countedOf(p, deal, acts).length > Number(c.value);
  }
  const after = countedOf(p, deal, acts).length, before = Math.max(0, after - 1);
  const meets = (x) => countMeets(c, x);
  return meets(after) && (!meets(before) || before === 0);
};
const countMeets = (c, x) => { const n = Number(c.value); return c.op === 'gt' ? x > n : c.op === 'lt' ? x < n : x === n; };
/* What a count counts, for a record: its own activity — and, for `withContact` (Number of Calls ·
   All), a deal's or customer's contact's too (calls with the person); `quotes` (Number of Signed
   Quotes): the record's quotations in Quotes. */
const countedOf = (p, deal, acts) => {
  if(p.quotes) return deal ? (WF_LIVE.quotes || []).filter(q => q.object === recordObjectOf(deal.id) && String(q.recordId) === String(deal.id)).filter(p.counts) : [];
  const own = acts || [];
  const withContact = p.withContact && deal && recordObjectOf(deal.id) !== 'contacts' && deal.contactId != null ? ((WF_LIVE.acts || {})[String(deal.contactId)] || []) : [];
  return [...own, ...withContact].filter(p.counts);
};
/* A Stage context, as a record enters the stage: triggers about the record's state hold if they're
   already true — a property condition (Total Amount > 5,000), a count (Number of No Answer calls < 4),
   Is not changed · In this stage. Triggers that need something to happen (Is changed, Repeat, an
   email sent) wait for it. While the record stays in the stage, they fire on changes as usual. */
const entersContextStage = (w, ev, deal) => ev.type === 'stageEntry' && !!w.context.stage && ev.pipelineId === w.context.pipeline && ev.attrs.toStage === w.context.stage && inContext(w, deal);
/* The record entering the workflow's context: its stage (Stage context), its pipeline (Pipeline
   context — created in it or moved into it), else its creation. A state trigger already true then
   counts, as on a stage entry (a new deal created with Amount over 5,000). */
const entersContext = (w, ev, deal) => { const c = w.context || {};
  if(c.stage) return entersContextStage(w, ev, deal);
  if(c.pipeline) return ev.type === 'pipelineEntry' && ev.pipelineId === c.pipeline && inContext(w, deal);
  return ev.type === 'recordCreated' && inContext(w, deal); };
const entryStateHolds = (w, deal, data, acts) => {
  const c = w.triggerConfig || {};
  if(w.trigger === 'propertyUpdate') return c.op === 'notChanged' ? !!c.inStage : !isChangeOp(c.op) && triggerConditionHolds(data, w, deal);
  const p = activityTriggerProperty(w.trigger, c.activityProperty);
  return !!p && !!p.counts && !p.each && !c.repeat && countMeets(c, countedOf(p, deal, acts).length);
};
const isStageQuietTrigger = (v) => v.trigger === 'propertyUpdate' && v.triggerConfig.op === 'notChanged' && !!v.triggerConfig.inStage && !!v.context.stage;
/* Records associated with each other: a deal's or customer's contact (`contactId`), a customer's
   deals (`dealIds`). */
const recordsLinked = (a, b) => {
  const oa = recordObjectOf(a.id), ob = recordObjectOf(b.id);
  if(oa === ob) return false;
  const [x, y] = [a, b].sort((p, q) => recordObjectOf(p.id) < recordObjectOf(q.id) ? -1 : 1);   // contacts < customers < deals
  const ox = recordObjectOf(x.id), oy = recordObjectOf(y.id);
  if(ox === 'contacts') return y.contactId != null && String(y.contactId) === String(x.id);
  return ox === 'customers' && oy === 'deals' && (x.dealIds || []).some(id => String(id) === String(y.id));
};
const associatedRecordsOf = (rec, object, list) => list.filter(r => recordObjectOf(r.id) === object && recordsLinked(rec, r));
/* Existing records that can be associated with `rec` (Associate existing …): only ones free to link
   — a deal has one contact, a customer has one deal, a deal has one customer. */
const linkableRecords = (rec, object, list) => {
  const from = recordObjectOf(rec.id), live = (id, o) => list.some(r => recordObjectOf(r.id) === o && String(r.id) === String(id));
  return list.filter(r => recordObjectOf(r.id) === object && !recordsLinked(rec, r)).filter(r => {
    if(object === 'customers' && from === 'deals') return !(r.dealIds || []).some(id => live(id, 'deals'));
    if(object === 'deals' && from === 'customers') return !list.some(c => recordObjectOf(c.id) === 'customers' && (c.dealIds || []).some(id => String(id) === String(r.id)));
    if(from === 'contacts') return r.contactId == null || !live(r.contactId, 'contacts');
    return true;
  });
};
/* Whether a trigger keeps a record out of a stage as it tries to enter (Block Stage Entry): as the
   record would be — an associated record that isn't there (In this stage / Throughout the lifecycle);
   a property not updated (or confirmed the same) since the record entered the stage it's in now
   (In this stage), or ever (Throughout the lifecycle); else as the trigger holds on entry.
   `lastChanged(rec, config)`: when the watched property last changed (or was confirmed). */
const blockStateHolds = (v, rec, data, acts, list, lastChanged) => {
  const c = v.triggerConfig || {};
  if(v.trigger === 'associatedRecord') return c.assocParam === 'notCreated' && ['stage', 'lifecycle'].includes(conditionWhen(c)) && !!c.associatedObject
    && !associatedRecordsOf(rec, c.associatedObject, list).length;
  if(v.trigger === 'propertyUpdate' && c.op === 'notChanged' && ['stage', 'lifecycle'].includes(conditionWhen(c))){
    const at = lastChanged(rec, c) || 0;
    return conditionWhen(c) === 'lifecycle' ? !at : !(at && at >= (rec.stageEnteredAt || 0));
  }
  return entryStateHolds(v, rec, data, acts);
};
const TRIGGER_MATCHERS = {
  stageEntryForward:entersMoving('stageForward'), stageEntryBackward:entersMoving('stageBackward'), stageExit:atStage('stageExit'),
  stayAtStage:(w, ev) => atStage('stageEntry')(w, ev) && 'stay',
  propertyUpdate:onPropertyUpdate,
  recordCreated:(w, ev, deal) => ev.type === 'recordCreated' && inContext(w, deal),
  // Associated Record · Is created / Is changed (Is not created / Is not changed: the scheduler's — checkAssociatedQuiet).
  associatedRecord:(w, ev, deal) => { const c = w.triggerConfig || {};
    return ev.attrs && ev.attrs.object === c.associatedObject && inContext(w, deal)
      && ((c.assocParam === 'created' && ev.type === 'associatedRecordCreated') || (c.assocParam === 'changed' && ev.type === 'associatedRecordChanged')); },
  recordUpdated:(w, ev, deal) => ev.type === 'recordUpdated' && inContext(w, deal),
  recordNotChanged:() => false,   // the scheduler's (checkQuietRecords)
  formSubmitted:(w, ev, deal) => ev.type === 'formSubmitted' && (!(w.triggerConfig || {}).form || ev.attrs.formId === w.triggerConfig.form) && inContext(w, deal),
  // Pipeline Entry / Exit: into or out of the context's pipeline (or the trigger's own; else any).
  pipelineEntry:(w, ev) => ev.type === 'pipelineEntry' && (!workflowPipeline(w) || ev.pipelineId === workflowPipeline(w)),
  pipelineExit:(w, ev) => ev.type === 'pipelineExit' && (!workflowPipeline(w) || ev.pipelineId === workflowPipeline(w)),
  emailEvents:onActivityProperty, callEvents:onActivityProperty, meetingEvents:onActivityProperty, taskEvents:onActivityProperty, noteEvents:onActivityProperty,
  quoteEvents:onActivityProperty, fileEvents:onActivityProperty,
};

/* ── Saved state (this browser) ── */
const WF_STORE_KEY = 'hof-erp-workflow-engine-v1';
// The workflow-only store from before everything was saved together (store.jsx): read once, to start from.
// The store saved before v2 belongs to HOF Migration (the only workspace then).
const WF_SAVED = APP_SAVED || !ACTIVE_WORKSPACE.sample ? null : (() => { try { const raw = window.localStorage.getItem(WF_STORE_KEY); return raw ? JSON.parse(raw) : null; } catch(e){ return null; } })();
const reviveActivities = (map) => Object.fromEntries(Object.entries(map || {}).map(([k, list]) => [k, (list || []).map(a => ({...a,
  at: a.at ? new Date(a.at) : a.at, due: a.due ? new Date(a.due) : a.due, scheduledFor: a.scheduledFor ? new Date(a.scheduledFor) : a.scheduledFor}))]));
/* Sample records added after this browser saved its own (new pipelines, deals): the saved list
   plus each default not added before (by id) — deleted ones stay deleted (`seeded`). */
const withSeeded = (saved, defaults, seeded) => !saved ? defaults
  : [...saved, ...defaults.filter(x => !(seeded || []).includes(x.id) && !saved.some(s => s.id === x.id))];
// Deals start out "entered" their stage when they were created.
/* System-generated values, set on the one path records change (setDealsTracked): a deal's Actual
   Close Date — when it reaches a Won / Lost outcome stage (Deal Won, Deal Lost), cleared if it
   moves back out — and its Deal Source; a customer's Customer Source and Customer Since. */
const isWonLostStage = (data, pipelineId, stageId) => {
  const pl = (data.pipelines || []).find(x => x.id === pipelineId), st = pl && pl.stages.find(s => s.id === stageId);
  return !!(st && st.outcome && /\b(won|lost)\b/i.test(st.label));
};
function recordSystemValues(data, p, d, now){
  const obj = recordObjectOf(d.id);
  if(obj === 'deals'){
    let n = !p && d.source == null ? {...d, source:'Manual'} : d;
    const closed = isWonLostStage(data, n.pipeline, n.stage);
    if(closed && (!n.actualCloseDate || (p && (p.stage !== n.stage || p.pipeline !== n.pipeline)))) n = {...n, actualCloseDate:dealStamp(new Date(now))};
    else if(!closed && n.actualCloseDate) n = {...n, actualCloseDate:''};
    return n;
  }
  if(obj === 'customers' && !p){
    const source = d.source || ((d.dealIds || []).length ? 'Deal' : d.contactId != null ? 'Contact' : 'Manual');
    return {...d, source, customerSince:d.customerSince || dateOnly(d.created) || todayLabel()};
  }
  return d;
}
const withStageEntry = (deals) => deals.map(d => d.stageEnteredAt ? d : {...d, stageEnteredAt: toTime(d.created) || Date.now()});
/* `triggerProgress`: for All workflows, which triggers have fired per record ("<workflow>:<deal>"
   → trigger ids), until every one has and the run starts. */
const EMPTY_ENGINE = () => ({events:[], runs:[], prompts:[], notifications:[], triggerProgress:{}});
/* Suggestive is no longer a Behavior: Suggestive Actions still open from before are closed —
   Dismissed, kept in run history — and steps waiting only on them settle the same way. */
const SUGGESTIVE_REMOVED = 'Dismissed — Suggestive mode removed';
function withoutSuggestive(es){
  const closing = (es.prompts || []).filter(p => p.status === 'pending' && !p.required).map(p => p.id);
  if(!closing.length) return es;
  const prompts = es.prompts.map(p => closing.includes(p.id) ? {...p, status:'dismissed', resolvedAt:Date.now(), outcome:SUGGESTIVE_REMOVED} : p);
  const open = (id) => prompts.some(p => p.id === id && p.status === 'pending');
  const runs = (es.runs || []).map(r => {
    if(!(r.steps || []).some(st => (st.promptIds || []).some(id => closing.includes(id)))) return r;
    const steps = r.steps.map(st => st.status === 'prompted' && (st.promptIds || []).some(id => closing.includes(id)) && !(st.promptIds || []).some(open)
      ? {...st, status:'dismissed', result:'Suggestive mode removed'} : st);
    const sts = steps.map(st => st.status);
    return {...r, steps, status:runStatusOf(steps)};
  });
  return {...es, prompts, runs};
}
/* Violations are stage-specific: one left open when its record left the stage was kept as a
   violation before. It's no longer applicable — Not applicable (which isn't Completed) — and its
   step and run follow. */
function withoutLegacyViolationStatus(es){
  const ids = (es.prompts || []).filter(p => p.status === 'violation').map(p => p.id);
  const steps = (es.runs || []).some(r => (r.steps || []).some(st => st.status === 'violated'));
  if(!ids.length && !steps) return es;
  const prompts = es.prompts.map(p => ids.includes(p.id) ? {...p, status:'notApplicable', resolvedAt:p.violatedAt || Date.now(), resolvedBy:null,
    outcome:`No longer applicable · moved to ${p.movedTo || 'another stage'}`} : p);
  const runs = (es.runs || []).map(r => {
    if(!(r.steps || []).some(st => st.status === 'violated')) return r;
    const steps = r.steps.map(st => st.status === 'violated' ? {...st, status:'notApplicable'} : st);
    return {...r, steps, status: r.status === 'violated' ? runStatusOf(steps) : r.status};
  });
  return {...es, prompts, runs};
}
// A run's status from its steps' (settleRun).
const runStatusOf = (steps) => {
  const st = steps.map(s => s.status);
  return st.includes('scheduled') ? 'running' : st.includes('prompted') ? 'awaiting' : st.includes('failed') ? 'failed'
    : st.every(s => s === 'cancelled') && st.length ? 'cancelled' : st.includes('notApplicable') && !st.includes('done') ? 'notApplicable' : 'completed';
};
const htmlText = (html) => { const el = document.createElement('div'); el.innerHTML = html || ''; return (el.textContent || '').replace(/\s+/g, ' ').trim(); };

const WorkflowEngineCtx = React.createContext(null);
const useWorkflowEngineCtx = () => React.useContext(WorkflowEngineCtx);

/* ── The engine ── App owns the records; the engine reads them through refs (so chained runs in
   one call see each other's changes) and writes through the same setters. */
/* `contacts` / `deals` / `customers` and their activity: the records workflows run on (App keeps
   them); the engine works over them as one list, and writes each back to its own store. Contacts
   are seen with a string id and their Types of Contact stage ({pipeline, stage}); written back as
   they're stored (number id, the stage as contactType). */
function useWorkflowEngine({data, setData, deals, setDealsRaw, dealActivities, setDealActivities, setContacts,
                            customers = [], setCustomersRaw, customerActivities = {}, setCustomerActivities,
                            contacts = [], contactActivities = {}, setContactActivities,
                            profiles = {}, profileFacts = {}, accounting = [], quotes = [], forms = []}){
  WF_LIVE = {profiles, facts:profileFacts, accounting, users:data.users || [], properties:data.properties || [], forms};
  const [es, setEs] = React.useState(() => withoutLegacyViolationStatus(withoutSuggestive(savedSlice('engine') || (WF_SAVED && WF_SAVED.engine) || EMPTY_ENGINE())));
  const esRef = React.useRef(es);
  const dataRef = React.useRef(data); dataRef.current = data;
  const contactPipe = contactEnginePipeline(data);
  // A contact as the engine sees it (and back); each view remembers its stored contact.
  const viewRaw = React.useRef(new WeakMap());
  const contactView = (c) => { const v = {...c, id:String(c.id), pipeline:contactPipe ? contactPipe.id : null, stage:contactStageFor(contactPipe, c)}; viewRaw.current.set(v, c); return v; };
  const contactStored = (v) => {
    const raw = viewRaw.current.get(v);
    if(raw) return raw;
    const {pipeline, stage, ...rest} = v, value = contactValueFor(contactPipe, stage);
    return {...rest, id:Number(v.id), ...(value !== undefined ? {contactType:value} : {})};
  };
  const contactViews = React.useMemo(() => contacts.map(contactView), [contacts, contactPipe && contactPipe.id]);
  const records = React.useMemo(() => [...deals, ...customers, ...contactViews], [deals, customers, contactViews]);
  WF_LIVE.records = records; WF_LIVE.quotes = quotes;
  const recordActs = React.useMemo(() => ({...dealActivities, ...customerActivities, ...contactActivities}), [dealActivities, customerActivities, contactActivities]);
  const dealsRef = React.useRef(records); dealsRef.current = records;
  const actsRef = React.useRef(recordActs); actsRef.current = recordActs; WF_LIVE.acts = recordActs;
  const contactsRef = React.useRef(contacts); contactsRef.current = contacts;
  // Writes the records back to their stores — only a store whose records changed.
  const writeRecords = (prev, next) => {
    const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
    const split = (list, object) => list.filter(r => recordObjectOf(r.id) === object);
    if(!same(split(prev, 'deals'), split(next, 'deals'))) setDealsRaw(split(next, 'deals'));
    if(setCustomersRaw && !same(split(prev, 'customers'), split(next, 'customers'))) setCustomersRaw(split(next, 'customers'));
    if(setContacts && !same(split(prev, 'contacts'), split(next, 'contacts'))) setContacts(split(next, 'contacts').map(contactStored));
  };
  // One Object's records changed by `upd` (a list or list → list): the engine's one change path.
  // Contacts' own changes come as stored contacts (number ids); they're seen as views here.
  const setRecordsOf = (object) => (upd, chain) => setDealsTracked(all => {
    if(object === 'contacts'){
      const mine = contactsRef.current, next = typeof upd === 'function' ? upd(mine) : upd;
      // Changes in a row (a bulk edit, a chain of workflow actions) each start from the last one's result.
      contactsRef.current = next;
      const views = all.filter(r => recordObjectOf(r.id) === 'contacts');
      return [...all.filter(r => recordObjectOf(r.id) !== 'contacts'), ...next.map(c => {
        const prevRaw = mine.find(x => x === c);
        if(prevRaw){ const v = views.find(x => viewRaw.current.get(x) === prevRaw); if(v) return v; }
        return contactView(c);
      })];
    }
    const mine = all.filter(r => recordObjectOf(r.id) === object);
    return [...all.filter(r => recordObjectOf(r.id) !== object), ...(typeof upd === 'function' ? upd(mine) : upd)];
  }, chain);
  const [openPromptId, setOpenPromptId] = React.useState(null);
  // Opened from the Violations panel's card (`direct`): a violation that needs a form opens the form itself.
  const [promptDirect, setPromptDirect] = React.useState(false);
  const openPrompt = (id, opts) => { setPromptDirect(!!(opts && opts.direct)); setOpenPromptId(id); };
  /* What a workflow did that the user should know now: a move it blocked (a modal) or an action it
     ran on its own (a toast; the bell keeps it). Not saved. */
  const [notices, setNotices] = React.useState([]);
  const [violationMode, setViolationMode] = React.useState(false);   // Deals / Customers → Violations: the Object whose violations list is open
  const [violationFocus, setViolationFocus] = React.useState(null);  // {id, nonce}: a violation opened from elsewhere (Dashboard) — selected in the list
  const [recordFocus, setRecordFocus] = React.useState(null);        // {id, nonce}: the record a violation card points to — highlighted where it's shown

  const commit = (fn) => { esRef.current = fn(esRef.current); setEs(esRef.current); };
  const getRun = (id) => esRef.current.runs.find(r => r.id === id);
  const getDeal = (id) => dealsRef.current.find(d => d.id === id);
  const getWorkflow = (id) => normalizeWorkflow((dataRef.current.workflows || []).find(w => w.id === id));
  const actsOf = (dealId) => actsRef.current[dealId] || [];
  const patchRun = (id, fn) => commit(s => ({...s, runs:s.runs.map(r => r.id === id ? fn(r) : r)}));
  const addRun = (r) => commit(s => ({...s, runs:[r, ...s.runs].slice(0, 400)}));
  const patchStep = (runId, stepId, patch) => { patchRun(runId, r => ({...r, steps:r.steps.map(s => s.id === stepId ? {...s, ...patch} : s)})); settleRun(runId); };

  const pickActs = (m, object) => Object.fromEntries(Object.entries(m).filter(([k]) => recordObjectOf(k) === object));
  const editActivities = (fn) => {
    actsRef.current = fn(actsRef.current);
    contactActsSeen.current = pickActs(actsRef.current, 'contacts');   // the engine's own — not a person's
    setDealActivities(m => pickActs(fn(m), 'deals'));
    if(setCustomerActivities) setCustomerActivities(m => pickActs(fn(m), 'customers'));
    if(setContactActivities) setContactActivities(m => pickActs(fn(m), 'contacts'));
  };
  /* Contacts' activity is written by the Contacts page itself: what a person adds or changes there
     is noticed here and evaluated like any record's (the engine's own changes are already seen). */
  const contactActsSeen = React.useRef(contactActivities);
  /* Effects: what each workflow step changed — property / stage values (from → to), activities and
     records it created, notifications it sent — kept on the step (`effects`). Recorded while a step,
     or the prompt it raised, runs. They're what reverting a workflow would work from; reverting
     itself isn't defined yet. */
  const effectStep = React.useRef(null);   // {runId, stepId}
  const recordEffect = (e) => {
    const t = effectStep.current;
    if(!t) return;
    patchRun(t.runId, r => ({...r, steps:r.steps.map(st => st.id === t.stepId ? {...st, effects:[...(st.effects || []), {...e, at:Date.now()}]} : st)}));
  };
  const withEffects = (runId, stepId, fn) => { const prev = effectStep.current; effectStep.current = {runId, stepId}; try { return fn(); } finally { effectStep.current = prev; } };
  const addActivity = (dealId, act) => {
    editActivities(m => ({...m, [dealId]:[act, ...(m[dealId] || [])]}));
    recordEffect({kind:'activity', recordId:dealId, activityId:act.id, type:act.type, ...(act.status ? {status:act.status} : {})});
  };
  // A deleted record's activity isn't brought back by a late patch (its run's log).
  const patchActivity = (dealId, id, patch) => editActivities(m => m[dealId] ? {...m, [dealId]:m[dealId].map(a => a.id === id ? {...a, ...patch} : a)} : m);

  /* Every change to deals goes through here: a deal entering a stage (moved, or created in it)
     gets its entry time, and its stage events are emitted. `chain` comes from a workflow action. */
  /* Block Entry: the workflows keeping `next` (the deal as it would be) out of the stage it's
     moving into from `prev` — active, that stage is their context's, they have a Block Entry
     action and their triggers hold at this moment (All: every trigger; Any: one): Stage Entry
     Moving Forward / Backward by the move's direction, the others as the record is (entryStateHolds).
     An Enforce Rules block can't be overridden or bypassed: the record enters once the triggers no
     longer hold. */
  function entryBlockers(prev, next, chain){
    const data = dataRef.current, acts = actsOf(next.id);
    const dir = prev.pipeline === next.pipeline ? stageMoveDirection(pipelineById2(data, next.pipeline), prev.stage, next.stage) : null;
    return (data.workflows || []).map(normalizeWorkflow)
      .filter(w => w.active !== false && w.triggers.length && w.context.stage === next.stage && w.context.pipeline === next.pipeline
        && (w.actions || []).some(a => a.type === 'blockEntry') && appliesToOwner(w, next.owner))
      .map(w => {
        const views = workflowTriggerViews(w);
        const held = views.filter(v => ['stageEntryForward', 'stageEntryBackward'].includes(v.trigger)
          ? workflowStage(v) === next.stage && dir === (v.trigger === 'stageEntryForward' ? 'forward' : 'backward')
          : blockStateHolds(v, next, data, acts, dealsRef.current, lastChangedAt));
        return (triggersMatchAll(w) ? held.length === views.length : held.length > 0) ? {w, held} : null;
      }).filter(Boolean);
  }
  /* A blocked entry runs the workflow (its triggers held): Block Entry explains the block; the
     workflow's other actions run as usual. */
  function startBlockRun(b, w, held, chain){
    const deal = getDeal(b.dealId);
    if(!deal) return;
    const run = {...baseRun(held[held.length - 1], deal, {chain: chain || {id:wfNewId('ch'), depth:0, visited:[]}, previousStage:b.attempt.fromStage, change:null, entryAttempt:b.attempt}),
      reasons:runReasons(w, held, deal),
      trace:evaluationTrace(dataRef.current, w, deal, actsOf(deal.id), held.map(v => v.triggerId),
        {from:b.attempt.fromStage, to:b.attempt.toStage, pipeline:b.attempt.toPipeline, attempt:true})};
    if(!guardLoop(run, w, deal)) return;
    begin(w, run, deal, held[held.length - 1]);
  }

  /* Every change to deals goes through here: a deal entering a stage (moved, or created in it)
     gets its entry time (and, entering a pipeline, that time too), and its stage events are
     emitted — unless a Block Entry workflow keeps it out of that stage: then it stays where it
     was (its other changes are kept). Returns {blocked:[{dealId, attempt, workflows}]}. */
  /* Associated Record Created: a new record linked to another — as it's created, or in the same
     action (a contact created from a deal, then linked to it) — is the other record's event. Linking
     a record that already existed isn't a creation. Links: a deal's or customer's contact
     (`contactId`), a customer's deals (`dealIds`). `freshIds`: records created in this action. */
  const freshIds = React.useRef(new Set());
  const markFresh = (ids) => {
    if(!ids.length) return;
    if(!freshIds.current.size) setTimeout(() => freshIds.current.clear(), 0);
    ids.forEach(id => freshIds.current.add(String(id)));
  };
  const associationPairs = (list) => {
    const out = new Set();
    list.forEach(r => {
      const o = recordObjectOf(r.id);
      if((o === 'deals' || o === 'customers') && r.contactId != null) out.add(`${r.id}|${r.contactId}`);
      if(o === 'customers') (r.dealIds || []).forEach(d => out.add(`${r.id}|${d}`));
    });
    return out;
  };
  function emitAssociatedCreated(prev, next, created, chain){
    markFresh(created.map(d => d.id));
    const before = associationPairs(prev), fresh = freshIds.current, byId = (id) => next.find(r => String(r.id) === id);
    const fire = (onId, newId) => { const on = byId(onId), made = byId(newId);
      if(on && made) emit({type:'associatedRecordCreated', recordId:on.id, pipelineId:on.pipeline, attrs:{object:recordObjectOf(made.id), associatedId:made.id}}, chain); };
    associationPairs(next).forEach(k => {
      if(before.has(k)) return;
      const [a, b] = k.split('|');
      if(fresh.has(b)) fire(a, b);
      if(fresh.has(a)) fire(b, a);
    });
  }
  const setDealsTracked = (upd, chain) => {
    const prev = dealsRef.current;
    const blocks = [];
    const raw = (typeof upd === 'function' ? upd(prev) : upd).map(dIn => {
      const p = prev.find(x => x.id === dIn.id);
      /* A contact: its stage and its Types of Contact value are one — a move sets the value; a
         change of the value moves it. */
      let d0 = dIn;
      if(recordObjectOf(dIn.id) === 'contacts' && contactPipe){
        if(p && dIn.stage !== p.stage){ const v = contactValueFor(contactPipe, dIn.stage); if(v !== undefined && v !== dIn.contactType) d0 = {...dIn, contactType:v}; }
        else { const st = contactStageFor(contactPipe, dIn); if(st !== dIn.stage) d0 = {...dIn, stage:st, pipeline:contactPipe.id}; }
      }
      if(!p || !d0.stage || (p.stage === d0.stage && p.pipeline === d0.pipeline)) return d0;
      const by = entryBlockers(p, d0, chain);
      if(!by.length) return d0;
      blocks.push({dealId:d0.id, by, attempt:{fromStage:p.stage, fromPipeline:p.pipeline, toStage:d0.stage, toPipeline:d0.pipeline,
        byPerson: !chain || !chain.depth || !!chain.byPerson}});
      return {...d0, stage:p.stage, pipeline:p.pipeline};
    });
    const now = Date.now(), changes = [], propChanges = [];
    // Each record's own Object's properties.
    const propsCache = {}, allPropsOf = (d) => propsCache[recordObjectOf(d.id)] || (propsCache[recordObjectOf(d.id)] = objectProperties(dataRef.current, recordObjectOf(d.id)));
    const created = [], updated = [];
    const same = (a, b) => (isBlank(a) && isBlank(b)) || samePropertyValue(a, b);
    const next = raw.map(dRaw => {
      const p = prev.find(x => x.id === dRaw.id), d1 = recordSystemValues(dataRef.current, p, dRaw, now);
      const allProps = allPropsOf(d1), props = allProps.filter(pr => !['stage', 'pipeline'].includes(pr.key));
      // A new deal keeps its exact creation time (`created` is shown to the minute) — Trigger Scope counts from it.
      const d0 = p || d1.createdAt ? d1 : {...d1, createdAt:now};
      // Property changes on an existing deal (a new deal isn't a property change); each property's
      // last change time is kept on the deal (`changedAt`) for Is changed / Is not changed.
      const changedKeys = p ? props.filter(pr => !same(p[pr.key], d0[pr.key])).map(pr => pr.key) : [];
      const d = p && (changedKeys.length || (p.changedAt && !d0.changedAt))
        ? {...d0, changedAt:{...(p.changedAt || {}), ...(d0.changedAt || {}), ...Object.fromEntries(changedKeys.map(k => [k, now]))}} : d0;
      changedKeys.forEach(k => propChanges.push({deal:d, property:k, from:p[k], to:d[k]}));
      // Record events: a new deal; any change to an existing one (stage moves too) — one per save.
      if(!p) created.push(d); else if(allProps.some(pr => !same(p[pr.key], d[pr.key]))) updated.push(d);
      if(d.stage && (!p || p.stage !== d.stage || p.pipeline !== d.pipeline)){
        const n = {...d, stageEnteredAt:now, ...(!p || p.pipeline !== d.pipeline ? {pipelineEnteredAt:now} : {})};
        changes.push({prev:p || null, next:n});
        return n;
      }
      return d;
    });
    dealsRef.current = next;
    writeRecords(prev, next);
    // Every event from this one change carries its batch (so a workflow starts once per change).
    const outerBatch = batchRef.current;
    batchRef.current = wfNewId('b');
    changes.forEach(c => onStageChange(c.prev, c.next, chain));
    // A record that moved (the pending move completed, or moved elsewhere) has no pending move left.
    const movedPending = changes.filter(c => c.prev && (esRef.current.pendingMoves || {})[c.next.id]).map(c => c.next.id);
    if(movedPending.length) commit(s => ({...s, pendingMoves:Object.fromEntries(Object.entries(s.pendingMoves || {}).filter(([id]) => !movedPending.includes(id)))}));
    // Created / Updated / Cleared never overlap.
    propChanges.forEach(c => emit({type: isBlank(c.from) ? 'propertyCreated' : isBlank(c.to) ? 'propertyCleared' : 'propertyUpdated',
      recordId:c.deal.id, pipelineId:c.deal.pipeline, attrs:{property:c.property, from:c.from ?? '', to:c.to ?? ''}}, chain));
    /* Owner history, on every path that changes a deal's owner (a person, or a workflow — named). */
    propChanges.filter(c => c.property === 'owner').forEach(c => {
      // A new owner: the record's User Properties (its owner's) change with it.
      const before = userPropertiesOf(dataRef.current, c.from) || {}, after = userPropertiesOf(dataRef.current, c.to) || {};
      userPropertyFields(dataRef.current).filter(f => !samePropertyValue(before[f.key], after[f.key])).forEach(f => emitScoped(c.deal.id, 'owner', f.key, before[f.key], after[f.key], chain));
      const wf = chain && chain.workflowId && getWorkflow(chain.workflowId);
      addActivity(c.deal.id, {id:wfNewId('own'), ...recordKey(c.deal.id), type:'ownerChange', at:new Date(now), from:c.from || null, to:c.to || null,
        ...(wf ? {source:'team', by:`${wf.name || workflowTitle(dataRef.current, wf)} (workflow)`, viaWorkflow:wf.id} : {source:'you', by:null})});
    });
    created.forEach(d => emit({type:'recordCreated', recordId:d.id, pipelineId:d.pipeline, attrs:{}}, chain));
    updated.forEach(d => emit({type:'recordUpdated', recordId:d.id, pipelineId:d.pipeline, attrs:{}}, chain));
    emitAssociatedCreated(prev, next, created, chain);
    // Associated Record · Is changed: each record associated with one that changed.
    updated.forEach(d => next.filter(r => recordsLinked(d, r)).forEach(r =>
      emit({type:'associatedRecordChanged', recordId:r.id, pipelineId:r.pipeline, attrs:{object:recordObjectOf(d.id), associatedId:d.id}}, chain)));
    batchRef.current = outerBatch;
    blocks.forEach(b => b.by.forEach(({w, held}) => startBlockRun(b, w, held, chain)));
    return {blocked:blocks.map(b => ({dealId:b.dealId, attempt:b.attempt, workflows:b.by.map(x => x.w.name || workflowTitle(dataRef.current, x.w))}))};
  };

  /* A change in a record's Customer Profile, Accounting or owner's User Properties: its time is kept
     (Is changed / Is not changed) and it's evaluated like a change to the record's own property. */
  function emitScoped(recordId, scope, key, from, to, chain){
    const k = `${scope}:${key}`, rec = getDeal(recordId);
    commit(s => ({...s, scopeChangedAt:{...(s.scopeChangedAt || {}), [`${recordId}|${k}`]:Date.now()}}));
    emit({type: isBlank(from) ? 'propertyCreated' : isBlank(to) ? 'propertyCleared' : 'propertyUpdated', recordId, pipelineId:rec && rec.pipeline, attrs:{property:k, from:from ?? '', to:to ?? ''}}, chain);
  }
  // When a property last changed: a record's own (its changedAt), else its scope's.
  const lastChangedAt = (d, c) => scopeOf(c) === 'record' ? (d.changedAt || {})[c.property] || 0 : ((esRef.current.scopeChangedAt || {})[`${d.id}|${scopedPropertyKey(c)}`] || 0);
  const batchRef = React.useRef(null);
  const emit = (partial, chain) => {
    const ev = {id:wfNewId('ev'), at:Date.now(), objectId:recordObjectOf(partial.recordId), ...partial, batch:batchRef.current, chain: chain || {id:wfNewId('ch'), depth:0, visited:[]}};
    commit(s => ({...s, events:[ev, ...s.events].slice(0, 300)}));
    if(WF_PROPERTY_EVENTS.includes(ev.type)) endRequiredValueViolations(ev.recordId);
    if(ev.type === 'associatedRecordCreated' || ev.type === 'associatedRecordChanged') endAssociatedViolations(ev);
    if(ev.type === 'callMade') endViolations(p => p.kind === 'initiateCall' && p.dealId === ev.recordId, () => ['done', `Call made${ev.attrs && ev.attrs.outcome ? ` · ${ev.attrs.outcome}` : ''}`]);
    dispatch(ev);
    return ev;
  };

  function onStageChange(prev, next, chain){
    const data = dataRef.current;
    const pipeline = pipelineById2(data, next.pipeline);
    if(prev && prev.stage){
      // Leaving a stage ends its Stay at Stage timers.
      cancelWaiting(r => r.dealId === next.id && r.stage === prev.stage && r.pipeline === prev.pipeline, 'Left the stage before the time passed');
      /* Leaving a stage: its stage-based rules stop applying to the record —
           · Stay at Stage checks end (above) and delayed steps skip (executeStep);
           · All-trigger progress starts over on the next entry (below);
           · violations are stage-specific: an open one raised in a stage the record is no longer in
             (its workflow's stage — for Block Entry, the stage it kept the record out of), or in a
             pipeline it left, is resolved as Not applicable. That isn't Completed: the requirement
             simply no longer applies. A Move Stage violation whose stage the record moved to is
             Completed. The destination stage's workflows are evaluated on entry (the stage events
             below) and raise its own violations. */
      const toLabel = stageLabelOf(data, next.pipeline, next.stage);
      esRef.current.prompts.filter(p => p.status === 'pending' && p.required && p.dealId === next.id).forEach(p => {
        if(p.kind === 'moveStage' && p.payload.stage === next.stage && next.pipeline === (p.payload.pipeline || p.pipeline || prev.pipeline)) return resolvePrompt(p.id, 'done', `Moved to ${toLabel}`);
        // Throughout the lifecycle: it stays open across stages until it's met.
        const leftPipeline = !p.lifecycle && !!p.pipeline && p.pipeline !== next.pipeline;
        const leftStage = !p.lifecycle && !!p.stage && p.stage !== next.stage;
        if(p.kind === 'blockEntry' || leftPipeline || leftStage) resolvePrompt(p.id, 'notApplicable', `No longer applicable · moved to ${toLabel}`);
      });
      commit(s => ({...s, triggerProgress:Object.fromEntries(Object.entries(s.triggerProgress || {}).filter(([k]) => {
        const [wid, did] = k.split(':'), w = did === next.id && getWorkflow(wid);
        return !(w && w.context.stage === prev.stage && w.context.pipeline === prev.pipeline);
      }))}));
      const samePipeline = prev.pipeline === next.pipeline;
      emit({type:'stageExit', recordId:next.id, pipelineId:prev.pipeline, attrs:{fromStage:prev.stage, toStage: samePipeline ? next.stage : null, enteredAt:prev.stageEnteredAt || 0,
        pipelineEnteredAt:prev.pipelineEnteredAt || createdTime(prev)}}, chain);
      const dir = samePipeline && stageMoveDirection(pipeline, prev.stage, next.stage);
      if(dir) emit({type: dir === 'forward' ? 'stageForward' : 'stageBackward', recordId:next.id, pipelineId:next.pipeline, attrs:{fromStage:prev.stage, toStage:next.stage}}, chain);
      if(!samePipeline && prev.pipeline) emit({type:'pipelineExit', recordId:next.id, pipelineId:prev.pipeline, attrs:{toPipeline:next.pipeline}}, chain);
    }
    // Pipeline Entry: a record new in a pipeline (created in it, or moved into it).
    if(!prev || !prev.stage || prev.pipeline !== next.pipeline) emit({type:'pipelineEntry', recordId:next.id, pipelineId:next.pipeline, attrs:{fromPipeline: prev ? prev.pipeline || null : null}}, chain);
    emit({type:'stageEntry', recordId:next.id, pipelineId:next.pipeline, attrs:{fromStage: prev && prev.pipeline === next.pipeline ? prev.stage : null, toStage:next.stage}}, chain);
  }

  /* Which active workflows an event fires — in the workflow's object, or any (Company-wide): each trigger is matched on
     its own (TRIGGER_MATCHERS, on the trigger's view of the workflow). Any: one run per event,
     however many triggers it matches. All: the matched triggers are marked as fired. Stay at
     Stage schedules its check instead (it fires when the time has passed). */
  const firedBatches = React.useRef(new Set());
  function dispatch(ev){
    const deal = getDeal(ev.recordId);
    // Record events reach the record's workflows (Company-wide ones run per user — checkCompanyUsers).
    (dataRef.current.workflows || []).map(normalizeWorkflow).filter(w => w.active !== false && w.triggers.length && !!w.context.object && w.context.object === ev.objectId).forEach(w => {
      const fired = [];
      workflowTriggerViews(w).forEach(v => {
        if(deal && !inTriggerScope(v, deal, ev)) return;   // outside the Trigger Scope (New Records)
        const match = TRIGGER_MATCHERS[v.trigger];
        const r = match && match(v, ev, deal, dataRef.current, deal ? actsOf(deal.id) : []);
        if(r === 'stay'){ if(deal) scheduleStay(v, deal, ev.chain); }
        else if(r || (deal && entersContext(v, ev, deal) && entryStateHolds(v, deal, dataRef.current, actsOf(deal.id)))){
          fired.push(v);
          if(isStageQuietTrigger(v)) markStateFired(v, deal);
        }
        // Is not changed · In this stage: the property changed in the stage, so its violation ends.
        if(deal && WF_PROPERTY_EVENTS.includes(ev.type) && v.trigger === 'propertyUpdate' && v.triggerConfig.op === 'notChanged' && scopedPropertyKey(v.triggerConfig) === ev.attrs.property && (inContext(v, deal) || v.triggerConfig.when === 'lifecycle'))
          endViolations(p => p.dealId === deal.id && p.workflowId === w.id, () => ['cleared', `${(recordProps(deal).find(x => x.key === ev.attrs.property) || {}).label || 'Property'} changed`]);
      });
      if(!fired.length || !deal) return;
      const change = WF_PROPERTY_EVENTS.includes(ev.type) ? {property:ev.attrs.property, from:ev.attrs.from, to:ev.attrs.to} : null;
      // A stage move the user made (not a workflow): an automatic move straight back out of it is a block.
      const userMove = !ev.chain.depth && WF_STAGE_EVENTS.includes(ev.type) && ev.attrs.toStage ? {from:ev.attrs.fromStage || null, to:ev.attrs.toStage} : null;
      fire(w, fired, deal, () => baseRun(fired[fired.length - 1], deal, {eventId:ev.id, chain:ev.chain, previousStage:ev.attrs.fromStage || null, change, userMove}), ev.batch);
    });
  }
  /* Triggers fired for a deal: Any — the run starts; All — they're marked, and the run starts once
     every trigger has fired (then the marks clear, so all are needed again). Either way, at most
     one run per workflow and deal for one change (`batch`). */
  function fire(w, fired, deal, makeRun, batch){
    const batchKey = batch && `${w.id}:${deal.id}:${batch}`;
    if(batchKey && firedBatches.current.has(batchKey)) return;   // this change already started it
    if(triggersMatchAll(w)){
      const key = `${w.id}:${deal.id}`;
      /* A state trigger (a count, a property's value) that's true as another one fires counts too —
         e.g. Stay at Stage firing on a deal that already had its calls. */
      const acts = actsOf(deal.id);
      const holding = workflowTriggerViews(w).filter(v => !fired.some(f => f.triggerId === v.triggerId) && !(v.trigger === 'propertyUpdate' && isChangeOp((v.triggerConfig || {}).op))
        && entryStateHolds(v, deal, dataRef.current, acts)).map(v => v.triggerId);
      const ids = [...new Set([...(((esRef.current.triggerProgress || {})[key]) || []), ...fired.map(v => v.triggerId), ...holding])];
      const done = w.triggers.every(t => ids.includes(t.id));
      commit(s => { const tp = {...(s.triggerProgress || {})}; if(done) delete tp[key]; else tp[key] = ids; return {...s, triggerProgress:tp}; });
      if(!done) return;
    }
    // One change (e.g. a deal saved with several properties edited) starts a workflow once.
    if(batchKey) firedBatches.current.add(batchKey);
    /* The evaluation as it happened (kept on the run): each trigger's value and result, how they
       combine, and the stage move that started it — what the event cards show later. */
    const made = makeRun();
    const counted = triggersMatchAll(w) ? w.triggers.map(t => t.id) : fired.map(v => v.triggerId);
    const move = made.previousStage || made.userMove ? {from:made.previousStage || null, to:deal.stage, pipeline:deal.pipeline} : null;
    const run = {...made, reasons:runReasons(w, fired, deal), trace:evaluationTrace(dataRef.current, w, deal, actsOf(deal.id), counted, move)};
    if(!guardLoop(run, w, deal)) return;
    begin(w, run, deal, fired[fired.length - 1]);
  }
  /* Why a run started, for violations and blocks: each trigger that counted (All: every
     trigger) as its summary, with the record's actual value where there is one. */
  function runReasons(w, fired, deal){
    const data = dataRef.current, acts = actsOf(deal.id);
    return (triggersMatchAll(w) ? workflowTriggerViews(w) : fired).map(v => {
      const c = v.triggerConfig || {};
      const prop = v.trigger === 'propertyUpdate' && !isChangeOp(c.op) && scopeOf(c) === 'record' && recordProps(deal).find(x => x.key === c.property);
      const sf = v.trigger === 'propertyUpdate' && !isChangeOp(c.op) && scopeOf(c) !== 'record' && (scopeFields(data, scopeOf(c)) || []).find(x => x.key === `prop:${c.property}`);
      const p = activityTriggerProperty(v.trigger, c.activityProperty);
      const actual = prop ? showValue(deal, prop, deal[prop.key])
        : sf ? (sf.many ? sf.many({data, deal}).join(', ') : String(sf.get({data, deal}) ?? '')) || 'empty'
        : p && p.counts ? String(countedOf(p, deal, acts).length)
        : v.trigger === 'stayAtStage' && deal.stageEnteredAt ? plural(Math.floor((Date.now() - deal.stageEnteredAt) / WF_DAY), 'day') : null;
      return {text:triggerSummary(data, v), actual};
    }).filter(x => x.text);
  }
  // Is not changed · In this stage fires once per stage entry (on entry, or for a deal already there).
  const stateKey = (v, deal) => `${v.id}:${v.triggerId}:${deal.id}:${deal.stageEnteredAt || 0}`;
  const markStateFired = (v, deal) => commit(s => ({...s, quietFired:{...(s.quietFired || {}), [stateKey(v, deal)]:true}}));
  function checkStageStates(){
    (dataRef.current.workflows || []).map(normalizeWorkflow).filter(w => w.active !== false && w.context.stage).forEach(w => {
      workflowTriggerViews(w).filter(isStageQuietTrigger).forEach(v => {
        dealsRef.current.filter(d => inContext(v, d) && inTriggerScope(v, d)).forEach(d => {
          if(lastChangedAt(d, v.triggerConfig) >= (d.stageEnteredAt || 0)) return;   // changed in this stage
          if((esRef.current.quietFired || {})[stateKey(v, d)]) return;
          markStateFired(v, d);
          fire(w, [v], d, () => baseRun(v, d, {chain:{id:wfNewId('ch'), depth:0, visited:[]}, previousStage:null, change:null}));
        });
      });
    });
  }
  // `w`: the trigger's view of the workflow (the run records which trigger started it).
  const baseRun = (w, deal, extra) => ({id:wfNewId('run'), workflowId:w.id, version:w.version || 1, trigger:w.trigger, triggerId:w.triggerId, pipeline:workflowPipeline(w), stage:workflowStage(w),
    dealId:deal.id, dealName:deal.name, createdAt:Date.now(), steps:[], ...extra});

  function guardLoop(run, w, deal){
    const key = `${w.id}:${deal.id}`;
    if(run.chain.depth >= WF_MAX_DEPTH || run.chain.visited.includes(key)){
      addRun({...run, status:'loopPrevented', reason: run.chain.depth >= WF_MAX_DEPTH ? `Chain limit (${WF_MAX_DEPTH}) reached` : 'Already ran for this deal in this chain'});
      return false;
    }
    run.chain = {...run.chain, visited:[...run.chain.visited, key]};
    return true;
  }
  function begin(w, run, deal, view){
    const now = Date.now();
    // Each step keeps its action's one-line summary as configured when it ran (actionSummary).
    const steps = (w.actions || []).map(a => ({id:wfNewId('st'), actionId:a.id, type:a.type, label:(workflowAction(a.type) || {}).label || a.type, summary:actionSummary(dataRef.current, a, w.context),
      status:'scheduled', dueAt: now + wfDurationMs(a.wait), delayed: wfDurationMs(a.wait) > 0}));
    const r = {...run, status:'running', startedAt:now, steps, activityId:`wfa-${run.id}`};
    addRun(r);
    addActivity(deal.id, {id:r.activityId, ...recordKey(deal.id), type:'workflow', at:new Date(now), title:workflowTitle(dataRef.current, view || w), body:'', by:null, source:'system', runId:r.id});
    steps.filter(s => !s.delayed).forEach(s => executeStep(r.id, s.id, false));
    settleRun(r.id);
  }

  /* Stay at Stage: one waiting run per trigger, deal and stage entry, checked at entry + duration.
     `v`: the Stay at Stage trigger's view of its workflow. */
  const triggerIdOf = (run) => run.triggerId || LEGACY_TRIGGER_ID;   // runs from before multiple triggers
  function scheduleStay(v, deal, chain){
    const entryAt = deal.stageEnteredAt || Date.now();
    const checkAt = entryAt + wfDurationMs(v.triggerConfig);
    const same = (r) => r.workflowId === v.id && triggerIdOf(r) === v.triggerId && r.dealId === deal.id && r.entryAt === entryAt;
    if(esRef.current.runs.some(r => same(r) && r.status !== 'waiting' && !r.checkAt)) return;   // already fired for this stage entry
    const existing = esRef.current.runs.find(r => same(r) && r.status === 'waiting');
    if(existing){ patchRun(existing.id, r => ({...r, checkAt, version:v.version || 1})); return; }
    addRun(baseRun(v, deal, {status:'waiting', entryAt, checkAt, chain: chain || {id:wfNewId('ch'), depth:0, visited:[]}}));
  }
  function syncStay(raw){
    const w = normalizeWorkflow(raw);
    if(w.active === false) return;
    const stays = workflowTriggerViews(w).filter(v => v.trigger === 'stayAtStage' && wfDurationMs(v.triggerConfig));
    // Checks whose trigger was removed (or no longer waits), or now points at another stage, end.
    cancelWaiting(r => r.workflowId === w.id && !stays.some(v => v.triggerId === triggerIdOf(r)), 'Trigger changed');
    stays.forEach(v => {
      const pipeline = workflowPipeline(v), stage = workflowStage(v);
      cancelWaiting(r => r.workflowId === w.id && triggerIdOf(r) === v.triggerId && (r.stage !== stage || r.pipeline !== pipeline), 'Workflow changed to another stage');
      // Changed to New Records: checks for deals outside the scope end.
      cancelWaiting(r => r.workflowId === w.id && triggerIdOf(r) === v.triggerId && !inTriggerScope(v, getDeal(r.dealId)), 'Outside the trigger scope');
      dealsRef.current.filter(d => d.pipeline === pipeline && d.stage === stage && inTriggerScope(v, d)).forEach(d => scheduleStay(v, d));
    });
  }
  // The time has passed with the deal still in the stage: the Stay at Stage trigger fires.
  function checkStay(runId){
    const run = getRun(runId);
    const w = getWorkflow(run.workflowId), deal = getDeal(run.dealId);
    if(!w || w.active === false){ patchRun(runId, r => ({...r, status:'cancelled', reason:'Workflow turned off'})); return; }
    const v = workflowTriggerViews(w).find(x => x.triggerId === triggerIdOf(run) && x.trigger === 'stayAtStage');
    if(!v){ patchRun(runId, r => ({...r, status:'notRun', reason:'Trigger changed'})); return; }
    if(!deal || deal.stage !== run.stage || deal.stageEnteredAt !== run.entryAt){ patchRun(runId, r => ({...r, status:'notRun', reason:'Left the stage before the time passed'})); return; }
    if(!inTriggerScope(v, deal)){ patchRun(runId, r => ({...r, status:'notRun', reason:'Outside the trigger scope'})); return; }
    // The waiting run is replaced by the run that starts (or doesn't).
    commit(s => ({...s, runs:s.runs.filter(x => x.id !== runId)}));
    fire(w, [v], deal, () => ({...run, triggerId:v.triggerId, checkAt:null, version:w.version || 1}));
  }
  function cancelWaiting(match, reason){
    commit(s => ({...s, runs:s.runs.map(r => r.status === 'waiting' && match(r) ? {...r, status:'notRun', reason} : r)}));
  }

  /* One step. Delayed steps (and Run now) re-check the deal first. */
  function executeStep(runId, stepId, delayed){
    const run = getRun(runId);
    const step = run && run.steps.find(s => s.id === stepId);
    if(!step || step.status !== 'scheduled') return;
    const w = getWorkflow(run.workflowId);
    if(!w) return patchStep(runId, stepId, {status:'skipped', result:'Workflow deleted'});
    if(w.active === false) return patchStep(runId, stepId, {status:'cancelled', result:'Workflow turned off'});
    const action = (w.actions || []).find(a => a.id === step.actionId);
    if(!action) return patchStep(runId, stepId, {status:'skipped', result:'Removed from the workflow'});
    const deal = getDeal(run.dealId);
    if(!deal) return patchStep(runId, stepId, {status:'failed', result:'The deal no longer exists'});
    if(delayed){
      if(['stageEntryForward', 'stageEntryBackward', 'stayAtStage'].includes(run.trigger) && (deal.pipeline !== run.pipeline || deal.stage !== run.stage)) return patchStep(runId, stepId, {status:'skipped', result:'The deal left the stage'});
      // Other triggers stay within the workflow's context (a stage context: the deal is still in it).
      if((workflowTrigger(run.trigger) || {}).group !== 'stage' && !inContext(w, deal)) return patchStep(runId, stepId, {status:'skipped', result:"The deal left the workflow's context"});
    }
    let res;
    try { res = withEffects(runId, stepId, () => performAction(action, deal, run, step, w)); }
    catch(e){ res = {status:'failed', result: e.message || 'Something went wrong'}; }
    const {blocked, ...stepRes} = res;
    patchStep(runId, stepId, {...stepRes, ranAt:Date.now()});
    if(res.status === 'done' && actionBehavior(action) === 'automatic') noticeAutomation(w, run, deal, {...res, actionType:action.type, summary:step.summary || actionSummary(dataRef.current, action, w.context)}, blocked);
  }
  /* An automatic action: a move straight back out of the stage the user just moved the deal to is
     a block (explained in a modal); anything else is a toast and a notification for the user. */
  /* The Automatic Action card's event, as it was when the action ran: the record, workflow,
     context, expected / current (the deal as the workflow found it) and what was done. */
  function noticeAutomation(w, run, deal, res, blocked){
    const data = dataRef.current, rule = w.name || workflowTitle(data, w);
    const event = {id:wfNewId('ev'), kind:'automatic', rule, dealId:deal.id, name:deal.name, context:workflowContextPath(data, w), workflowId:w.id, runId:run.id,
      actionType:res.actionType || null, summary:res.summary || null, message:res.message || null, blocked:blocked || null, toStage:(getDeal(deal.id) || deal).stage, trace:run.trace || null, move:run.entryAttempt || (run.userMove ? {from:run.userMove.from, to:run.userMove.to} : null),
      exp:workflowExpectations(data, w, deal, actsOf(deal.id), !!run.entryAttempt) || {expected:[], current:(run.reasons || []).map(r => r.text), join:'And'}, result:res.result, at:Date.now()};
    // A move straight back out of the stage the user moved the deal to: shown now.
    if(blocked){
      /* A person's move kept out by Block Stage Entry: the move stays pending on the record — the
         block card guides what's needed, then completes it (resumeMove). */
      const mv = run.entryAttempt;
      if(res.actionType === 'blockEntry' && mv && mv.byPerson)
        commit(s => ({...s, pendingMoves:{...(s.pendingMoves || {}), [deal.id]:{toStage:mv.toStage, toPipeline:mv.toPipeline, fromStage:mv.fromStage, at:Date.now(), event}}}));
      return setOpenEvent(event);
    }
    const me = currentUserId(data);
    const text = `${rule} · ${res.result}`;
    if(me) commit(s => ({...s, notifications:[{id:wfNewId('nt'), userId:me, dealId:deal.id, dealName:deal.name, text, at:Date.now(), read:false, event}, ...s.notifications].slice(0, 300)}));
    setNotices(ns => [...ns.filter(n => n.kind !== 'auto'), {id:wfNewId('no'), kind:'auto', rule, dealName:deal.name, result:res.result, event}]);
  }
  const childChain = (run) => ({...run.chain, depth:run.chain.depth + 1});

  /* ── Actions ── each returns {status, result}. */
  // The record's Object's properties (a deal's, a customer's).
  const recordProps = (r) => objectProperties(dataRef.current, recordObjectOf(r && r.id));
  const toDealValue = (deal, prop, v) => {
    if(prop.type === 'User') return resolvePerson(dataRef.current, deal, v) || '';
    if(prop.type === 'Number') return isBlank(v) ? '' : Number(v);
    return storePropertyValue(prop, v);
  };
  const showValue = (deal, prop, v) => prop.type === 'Pipeline stage' ? stageLabelOf(dataRef.current, deal.pipeline, v)
    : prop.type === 'Pipeline' ? ((pipelineById2(dataRef.current, v) || {}).label || v) : prop.type === 'User' ? userName(dataRef.current, v)
    : (isBlank(v) ? 'empty' : String(formatPropertyValueOf(prop, v)));
  // `extra`: more on the chain — byPerson (a person completing a prompt).
  function applyPatch(deal, patch, run, extra){
    const before = getDeal(deal.id) || deal;
    // Its stage and property events (and any workflows they start) come from setDealsTracked; the
    // chain names the workflow (owner history is attributed to it).
    const res = setDealsTracked(ds => ds.map(d => d.id === deal.id ? {...d, ...patch} : d), {...childChain(run), workflowId:run.workflowId, ...(extra || {})});
    const after = getDeal(deal.id) || deal;
    // Only what changed is an effect (a blocked stage move isn't).
    Object.keys(patch).filter(k => String(after[k] ?? '') === String(patch[k] ?? ''))
      .forEach(k => recordEffect({kind:'property', recordId:deal.id, key:k, from:before[k] ?? '', to:after[k] ?? ''}));
    return res;
  }
  // "“Workflow A”, “Workflow B”" — the workflows that blocked a deal's move.
  const blockedBy = (res, dealId) => { const b = res && res.blocked.find(x => x.dealId === dealId); return b ? b.workflows.map(n => `\u201c${n}\u201d`).join(', ') : ''; };
  function moveTarget(action, deal){
    const pipeline = pipelineById2(dataRef.current, deal.pipeline);
    if(action.type === 'moveToStage'){
      const target = (action.config || {}).stage;
      if(!target) return {error:'No stage chosen'};
      if(!(pipeline.stages || []).some(s => s.id === target)) return {error:'That stage is in another pipeline'};
      if(target === deal.stage) return {error:'Already in that stage'};
      return {stage:target};
    }
    const dir = action.type === 'moveStageForward' ? 'forward' : 'backward';
    if((pipeline.stages || []).find(s => s.id === deal.stage && s.outcome)) return {error:'The deal is in an outcome stage'};
    const next = adjacentStage(pipeline, deal.stage, dir);
    return next ? {stage:next} : {error: dir === 'forward' ? 'Already at the last stage' : 'Already at the first stage'};
  }
  /* A prompt comes from a Required action: a violation (it can't be dismissed — it's resolved, or ends
     with what raised it). It carries the workflow's name and why. */
  function createPrompt(run, step, deal, kind, title, payload){
    const w = getWorkflow(run.workflowId);
    const p = {id:wfNewId('pr'), runId:run.id, stepId:step.id, actionId:step.actionId, dealId:deal.id, dealName:deal.name, userId:deal.owner, kind, title, payload, status:'pending', createdAt:Date.now(),
      required:true, workflowId:run.workflowId, rule: w ? (w.name || workflowTitle(dataRef.current, w)) : '',
      reasons:run.reasons || [], pipeline:run.pipeline, stage:run.stage, ...(run.lifecycle ? {lifecycle:true} : {})};
    commit(s => ({...s, prompts:[p, ...s.prompts]}));
    return p.id;
  }
  const prompted = (ids, who) => ({status:'prompted', promptIds:ids, result:`Waiting for ${who || 'the record owner'}`});

  /* Shared by an action that runs Automatically and the prompt the owner completes. */
  const taskDueAt = (t) => {
    const due = new Date(Date.now() + wfDurationMs(t.due));
    if(t.due && t.due.time){ const [h, m] = t.due.time.split(':').map(Number); due.setHours(h, m, 0, 0); }
    return due;
  };
  function createTasks(deal, tasks, run, workflowId){
    const owner = userName(dataRef.current, deal.owner);
    tasks.forEach(t => {
      const act = {id:wfNewId('wt'), ...recordKey(deal.id), type:'task', at:new Date(), title:t.name.trim(), description:t.description || '', taskType:t.taskType || 'To-do',
        status:'inProgress', assignee:t.assigneeName || owner, due:new Date(t.dueAt), dueTime:!!(t.due && t.due.time), source:'team', by:owner, viaWorkflow:workflowId};
      addActivity(deal.id, act);
      emit({type:'taskCreated', recordId:deal.id, pipelineId:deal.pipeline, attrs:{activityId:act.id, taskType:act.taskType, assignee:act.assignee}}, childChain(run));
    });
  }
  function addNoteTo(deal, body, run, workflowId){
    const act = {id:wfNewId('wn'), ...recordKey(deal.id), type:'note', at:new Date(), body, source:'team', by:userName(dataRef.current, deal.owner), viaWorkflow:workflowId};
    addActivity(deal.id, act);
    emit({type:'noteAdded', recordId:deal.id, pipelineId:deal.pipeline, attrs:{activityId:act.id}}, childChain(run));
  }
  function bookMeeting(deal, m, at, run){
    const data = dataRef.current, owner = userName(data, deal.owner);
    const mins = {'15 minutes':15, '30 minutes':30, '45 minutes':45, '1 hour':60, '1 hour 30 minutes':90, '2 hours':120}[m.duration] || 30;
    const act = {id:wfNewId('wm'), ...recordKey(deal.id), type:'meeting', at, scheduledFor:at, title:`Meeting${m.platform ? ` · ${m.platform}` : ''}`, durationMin:mins, platform:m.platform || 'Other',
      description:m.description || '', organizer:userName(data, resolvePerson(data, deal, m.organizer)) || owner, logged:false, status:'scheduled', source:'team', by:owner};
    addActivity(deal.id, act);
    emit({type:'meetingScheduled', recordId:deal.id, pipelineId:deal.pipeline, attrs:{activityId:act.id, at:at.getTime(), platform:act.platform}}, childChain(run));
    return act;
  }

  // Sends (or schedules) a workflow's emails on the deal; returns what happened.
  function sendEmails(deal, emails, run, workflowId){
    const data = dataRef.current, owner = userName(data, deal.owner);
    let sent = 0, scheduled = 0;
    emails.forEach(e => {
      const tpl = emailTemplatesOf(data).find(t => t.id === e.templateId) || {};
      const sendAt = new Date(Date.now() + (e.immediate ? 0 : wfDurationMs(e.schedule)));
      if(!e.immediate && e.schedule && e.schedule.time){ const [h, m] = e.schedule.time.split(':').map(Number); sendAt.setHours(h, m, 0, 0); }
      const now = !!e.immediate || sendAt.getTime() <= Date.now();
      const to = (e.recipients || []).map(r => r === 'recordEmail' ? 'Customer' : userName(data, resolvePerson(data, deal, r))).filter(Boolean);
      const subject = (e.email && e.email.subject) || tpl.subject || tpl.name;
      // The HTML is kept as written (shown in its frame); `body` is its text (lists, search).
      const act = {id:wfNewId('we'), ...recordKey(deal.id), type:'email', at: now ? new Date() : sendAt, direction:'sent', title:subject, body:htmlText((e.email && e.email.html) || tpl.html),
        html:(e.email && e.email.html) || tpl.html || null,
        templateId:e.templateId, sequenceId:e.sequenceId || null, to, status: now ? 'sent' : 'scheduled', scheduledFor:sendAt, source:'team', by:owner, viaWorkflow:workflowId};
      addActivity(deal.id, act);
      if(now){ sent++; emit({type:'emailSent', recordId:deal.id, pipelineId:deal.pipeline, attrs:{activityId:act.id, templateId:e.templateId}}, childChain(run)); }
      else { scheduled++; emit({type:'emailScheduled', recordId:deal.id, pipelineId:deal.pipeline, attrs:{activityId:act.id, templateId:e.templateId}}, childChain(run)); }
    });
    return [sent && `${plural(sent, 'email')} sent`, scheduled && `${plural(scheduled, 'email')} scheduled`].filter(Boolean).join(', ');
  }

  /* Log Meeting / Log Call by a workflow (Create Meeting, Add Call Log): what happened, recorded as a
     person logging it would — a comment is a note linked to it. */
  function logMeetingOn(rec, m, run, workflowId){
    const data = dataRef.current, owner = userName(data, rec.owner), at = new Date();
    const mins = {'15 minutes':15, '30 minutes':30, '45 minutes':45, '1 hour':60, '1 hour 30 minutes':90, '2 hours':120}[m.duration] || 30;
    const act = {id:wfNewId('wm'), ...recordKey(rec.id), type:'meeting', at, title:m.title || 'Meeting', platform:m.platform || 'Other', durationMin:mins, logged:true, source:'team', by:owner, viaWorkflow:workflowId};
    addActivity(rec.id, act);
    if((m.notes || '').trim()) addActivity(rec.id, {id:wfNewId('wn'), ...recordKey(rec.id), type:'note', at, body:m.notes.trim(), source:'team', by:owner, meetingId:act.id, viaWorkflow:workflowId});
    emit({type:'meetingScheduled', recordId:rec.id, pipelineId:rec.pipeline, attrs:{activityId:act.id, at:at.getTime(), platform:act.platform}}, childChain(run));
    return act;
  }
  function logCallOn(rec, call, run, workflowId){
    const data = dataRef.current, owner = userName(data, rec.owner), at = new Date();
    const inbound = call.callType === 'Inbound';
    const act = {id:wfNewId('wc'), ...recordKey(rec.id), type:'call', at, logged:true, outcome:call.outcome, durationMin:0, body:'', direction: inbound ? 'inbound' : 'outbound',
      source: inbound ? 'client' : 'team', by: inbound ? null : owner, pointOfContact:owner, viaWorkflow:workflowId};
    addActivity(rec.id, act);
    if((call.comment || '').trim()) addActivity(rec.id, {id:wfNewId('wn'), ...recordKey(rec.id), type:'note', at, body:call.comment.trim(), source:'team', by:owner, callId:act.id, viaWorkflow:workflowId});
    emit({type:'callLogged', recordId:rec.id, pipelineId:rec.pipeline, attrs:{activityId:act.id, outcome:act.outcome, logged:true}}, childChain(run));
    return act;
  }
  /* A record's associated records of an Object: a contact's deals and customers; a deal's contact and
     customers; a customer's contact and deals. */
  function associatedOf(rec, object){
    const all = dealsRef.current, from = recordObjectOf(rec.id);
    const contactOf = (r) => r.contactId == null ? [] : all.filter(x => recordObjectOf(x.id) === 'contacts' && x.id === String(r.contactId));
    if(from === 'contacts') return all.filter(x => recordObjectOf(x.id) === object && object !== 'contacts' && String(x.contactId) === rec.id);
    if(object === 'contacts') return contactOf(rec);
    if(from === 'deals' && object === 'customers') return all.filter(x => recordObjectOf(x.id) === 'customers' && (x.dealIds || []).includes(rec.id));
    if(from === 'customers' && object === 'deals') return all.filter(x => (rec.dealIds || []).includes(x.id));
    return [];
  }
  /* A record created through another (Create Associated Record — the form's values, or, run
     Automatically, named after it with its owner): linked to it, and to its contact. */
  // The customer a deal has (Deals → Customers), if any.
  /* The stage a record came from into `stage`: its last recorded entry (the engine's events), else
     the nearest earlier stage of the pipeline that isn't an outcome (Won / Lost…). */
  const previousStageOf = (rec, pipelineId, stage) => {
    const ev = esRef.current.events.find(e => e.type === 'stageEntry' && e.recordId === rec.id && e.attrs && e.attrs.toStage === stage && e.attrs.fromStage);
    if(ev) return ev.attrs.fromStage;
    const pl = pipelineById2(dataRef.current, pipelineId), stages = (pl && pl.stages) || [], i = stages.findIndex(st => st.id === stage);
    for(let j = i - 1; j >= 0; j--) if(!stages[j].outcome) return stages[j].id;
    return null;
  };
  const dealCustomer = (dealId) => dealsRef.current.find(r => recordObjectOf(r.id) === 'customers' && (r.dealIds || []).includes(dealId)) || null;
  function createLinkedRecord(rec, object, values, run){
    const data = dataRef.current, from = recordObjectOf(rec.id), fromNoun = recordNoun(rec.id);
    if(object === 'contacts'){
      const newContactId = newRecordId('contacts');   // never reused (store.jsx)
      setContacts(cs => [...cs, newContactRecord(newContactId, values)]);
      recordEffect({kind:'record', object:'contacts', recordId:newContactId});
      /* Linked to the record — a deal or customer has one contact, so one that already has one keeps it. */
      const linked = rec.contactId == null;
      if(linked) setDealsTracked(ds => ds.map(d => d.id === rec.id ? {...d, contactId:newContactId} : d), childChain(run));
      return `Contact created: ${values.name || ''}${linked ? ` · linked to this ${fromNoun}` : ` · not linked (the ${fromNoun} already has a contact)`}`;
    }
    if(!['customers', 'deals'].includes(object) || from === object) return `${objectName(data, object)}: not defined yet`;
    const pipes = recordPipelines(data, object), pl = pipes.find(x => x.id === values.pipeline) || pipes[0];
    const stage = values.stage || (pl ? ((pl.stages.find(st => !st.outcome) || pl.stages[0] || {}).id || '') : '');
    const contactId = from === 'contacts' ? Number(rec.id) : rec.contactId ?? null;
    const created = storePropertyValue('Date & time', new Date());
    if(object === 'customers'){
      // A deal has one customer: one that already has it isn't given a second (no duplicates).
      const existing = from === 'deals' && dealCustomer(rec.id);
      if(existing) return `Customer already exists: ${existing.name || ''} · linked to this deal (no duplicate created)`;
      /* Linked to the deal it came from (Deals ↔ Customers) and to the contact (Contacts → Customers),
         in the service pipeline for the deal's pipeline (CUSTOMER_PIPELINE_FOR_DEAL), with its details. */
      const forDeal = from === 'deals' && !values.pipeline ? pipes.find(x => x.id === CUSTOMER_PIPELINE_FOR_DEAL[rec.pipeline]) : null;
      const cpl = forDeal || pl, cstage = forDeal ? ((forDeal.stages.find(st => !st.outcome) || forDeal.stages[0] || {}).id || '') : stage;
      const fill = from === 'deals' ? {email:rec.email || '', phone:rec.phone || '', status:'Active'} : {};
      const cust = {id:newRecordId('customers'), ...fill, ...values, pipeline:values.pipeline || (cpl || {}).id || '', ...(cstage ? {stage:cstage} : {}), contactId, dealIds: from === 'deals' ? [rec.id] : [], created};
      editActivities(m => ({...m, [cust.id]:[]}));
      setDealsTracked(rs => [...rs, cust], childChain(run));
      recordEffect({kind:'record', object:'customers', recordId:cust.id});
      return `Customer created: ${cust.name || ''} · linked to this ${fromNoun}`;
    }
    /* A deal: the contact's deal, and — from a customer — the customer's deal, when it has none
       yet (a customer has one deal: Deals → Customers is One-to-many). */
    const amount = values.amount === '' || values.amount == null ? '' : Number(values.amount);
    const nd = {id:newRecordId('deals'), contactId, ...values, pipeline:values.pipeline || (pl || {}).id || '', ...(stage ? {stage} : {}), amount, currency:DEAL_CURRENCY, created};
    const linked = from !== 'customers' || !(rec.dealIds || []).length;
    editActivities(m => ({...m, [nd.id]:[]}));
    setDealsTracked(rs => [...rs.map(r => from === 'customers' && linked && r.id === rec.id ? {...r, dealIds:[nd.id]} : r), nd], childChain(run));
    recordEffect({kind:'record', object:'deals', recordId:nd.id});
    return `Deal created: ${nd.name || ''}${linked ? ` · linked to this ${fromNoun}` : ' · not linked (the customer already has a deal)'}`;
  }
  /* Delete Record: what deleting it on its page does — its activity goes with it; the records
     associated with it stay, no longer linked to it; its other open violations no longer apply. */
  function removeRecord(rec, run){
    const object = recordObjectOf(rec.id);
    setDealsTracked(rs => rs.filter(r => r.id !== rec.id).map(r => object === 'contacts' && r.contactId != null && String(r.contactId) === rec.id ? {...r, contactId:null}
      : object === 'deals' && (r.dealIds || []).includes(rec.id) ? {...r, dealIds:r.dealIds.filter(x => x !== rec.id)} : r), childChain(run));
    editActivities(m => { const n = {...m}; delete n[rec.id]; return n; });
    recordEffect({kind:'recordDeleted', object, recordId:rec.id, name:rec.name});
    esRef.current.prompts.filter(x => x.status === 'pending' && x.dealId === rec.id).forEach(x => resolvePrompt(x.id, 'notApplicable', `No longer applicable · the ${recordNoun(rec.id)} was deleted`));
  }
  /* Assign Record Owner: the next person in turn — after the last one this action assigned
     (`es.rotation`, per workflow action), so a changing list carries on from where it was. */
  function nextInTurn(key, pool){
    const last = (esRef.current.rotation || {})[key], i = pool.indexOf(last), pick = pool[(i + 1) % pool.length];
    commit(s => ({...s, rotation:{...(s.rotation || {}), [key]:pick}}));
    return pick;
  }
  const ownerRuleHolds = (data, userId, r) => {
    const f = userPropertyFields(data).find(x => x.key === r.property), v = (userPropertiesOf(data, userId) || {})[r.property];
    if(f && fieldProperty(f) && propertyOperators(fieldProperty(f), {withChange:false}).some(o => o.id === r.op)) return propertyValueMatches(fieldProperty(f), r.op, v, r.value);
    if(!f) return false;
    if(f.kind === 'number'){ const a = Number(v), b = Number(r.value); return !isNaN(a) && (r.op === 'gt' ? a > b : r.op === 'lt' ? a < b : a === b); }
    const same = String(v ?? '').trim().toLowerCase() === String(r.value ?? '').trim().toLowerCase();
    return r.op === 'notEquals' ? !same : same;
  };
  // Classify Record (AI) — mocked: a stable pick from the property's options, from the record's data.
  const mockClassify = (rec, options) => options[[...`${rec.id}|${rec.name || ''}`].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % options.length];

  // Set Property Value (Track Violations): its violation is resolved when the record has the required values.
  function endRequiredValueViolations(recordId){
    const rec = getDeal(recordId);
    if(!rec) return;
    const props = recordProps(rec);
    endViolations(p => p.dealId === recordId && p.kind === 'setProperty' && p.payload.required && (p.payload.entries || []).length > 0
      && p.payload.entries.every(e => { const pr = props.find(x => x.key === e.property); return pr && String(rec[pr.key] ?? '') === String(toDealValue(rec, pr, e.value) ?? ''); }),
      (p) => ['done', `${(p.payload.entries || []).map(e => (props.find(x => x.key === e.property) || {}).label).join(', ')} updated to the required value`]);
    // Prompt to Update Property Value: resolved once a property it asks about changes from what it was.
    endViolations(p => p.dealId === recordId && p.kind === 'setProperty' && !p.payload.required && (p.payload.entries || []).length > 0
      && p.payload.entries.some(e => { const pr = props.find(x => x.key === e.property); return pr && String(inputPropertyValue(pr, rec[pr.key]) ?? '') !== String(e.value ?? ''); }),
      (p) => ['done', `${(p.payload.entries || []).map(e => (props.find(x => x.key === e.property) || {}).label).join(', ')} updated`]);
  }

  function performAction(action, deal, run, step, w){
    const data = dataRef.current, c = action.config || {};
    /* The action's Behavior: Automatic runs it; Required raises a violation the record owner must
       resolve. */
    const prompt = actionBehavior(action) !== 'automatic';
    const owner = userName(data, deal.owner);
    switch(action.type){
      case 'setPropertyValue':
      case 'clearProperty': {
        const entries = (c.properties || []).filter(e => e.property);
        if(!entries.length) return {status:'skipped', result:'No properties chosen'};
        const props = recordProps(deal);
        if(action.type === 'clearProperty'){
          const blocked = entries.filter(e => (props.find(p => p.key === e.property) || {}).mandatory);
          const keys = entries.filter(e => !blocked.includes(e)).map(e => e.property);
          const note = blocked.length ? ` · ${blocked.map(e => (props.find(p => p.key === e.property) || {}).label).join(', ')} required, not cleared` : '';
          if(!keys.length) return {status:'failed', result:`Required properties can't be cleared${note}`};
          if(prompt) return prompted([createPrompt(run, step, deal, 'clearProperty', 'Clear properties', {keys})], owner);
          applyPatch(deal, Object.fromEntries(keys.map(k => [k, ''])), run);
          return {status:'done', result:`Cleared ${keys.map(k => (props.find(p => p.key === k) || {}).label).join(', ')}${note}`};
        }
        if(prompt){
          const named = entries.map(e => (props.find(p => p.key === e.property) || {}).label).filter(Boolean);
          // Already at the required values: nothing to resolve.
          if(entries.every(e => { const pr = props.find(x => x.key === e.property); return pr && String(deal[pr.key] ?? '') === String(toDealValue(deal, pr, e.value) ?? ''); }))
            return {status:'done', result:`${named.join(', ')} already at the required value`};
          return prompted([createPrompt(run, step, deal, 'setProperty', named.length === 1 ? `Update ${named[0]} value` : 'Update property values', {entries, required:true})], owner);
        }
        const patch = {};
        entries.forEach(e => { const p = props.find(x => x.key === e.property); if(p) patch[p.key] = toDealValue(deal, p, e.value); });
        applyPatch(deal, patch, run);
        return {status:'done', result: Object.keys(patch).map(k => `${(props.find(p => p.key === k) || {}).label} → ${showValue(deal, props.find(p => p.key === k), patch[k])}`).join(', ')};
      }
      case 'moveStageForward':
      case 'moveStageBackward':
      case 'moveToStage': {
        const t = moveTarget(action, deal);
        if(t.error) return {status:'skipped', result:t.error};
        const label = stageLabelOf(data, deal.pipeline, t.stage);
        if(prompt) return prompted([createPrompt(run, step, deal, 'moveStage', `Move to ${label}`, {stage:t.stage})], owner);
        const blocked = run.userMove && run.userMove.to === deal.stage ? {attempted:deal.stage} : null;
        const by = blockedBy(applyPatch(deal, {stage:t.stage}, run), deal.id);
        if(by) return {status:'skipped', result:`Entry to ${label} blocked by ${by}`};
        return {status:'done', result:`Moved to ${label}`, blocked};
      }
      /* Block Stage Entry (Enforce Rules): as a deal tries to enter the context's stage with the
         triggers holding (the run carries the attempt), it's kept out — the person who moved it sees
         at once what's blocking it and what to do (the triggers, as actions). No override. */
      case 'blockEntry': {
        const ctx = w.context || {}, label = stageLabelOf(data, ctx.pipeline, ctx.stage);
        /* A record already in the stage (All Records · Enforce Rules): moved back, automatically, to
           the stage it came from (its last recorded entry into this stage, else the nearest earlier
           working stage of the pipeline). If that move is blocked too, it stays, with a violation to
           change its values. */
        if(run.existingRecord && deal.stage === ctx.stage && deal.pipeline === ctx.pipeline){
          const back = previousStageOf(deal, ctx.pipeline, ctx.stage);
          if(back){
            const backLabel = stageLabelOf(data, ctx.pipeline, back);
            const by = blockedBy(applyPatch(deal, {stage:back}, run), deal.id);
            if(!by) return {status:'done', result:`Already in ${label} · moved back to ${backLabel}`};
          }
          const open = esRef.current.prompts.find(p => p.status === 'pending' && p.kind === 'blockEntry' && p.workflowId === w.id && p.dealId === deal.id);
          if(open) return {status:'skipped', result:`Already in ${label} · its values still need changing`};
          return {status:'prompted', promptIds:[createPrompt(run, step, deal, 'blockEntry', 'Change values', {existing:true})], result:`Already in ${label} · waiting for ${owner || 'the record owner'} to change values`};
        }
        if(!run.entryAttempt) return {status:'skipped', result:`Applies as a deal tries to enter ${label}`};
        const stays = stageLabelOf(data, deal.pipeline, deal.stage);
        return {status:'done', result:`Entry to ${label} blocked · stays in ${stays}`, message:(c.message || '').trim() || null, blocked: run.entryAttempt.byPerson ? {attempted:ctx.stage} : null};
      }
      // Create Task: Automatic creates the tasks; Required asks the owner to confirm them.
      case 'createTask': {
        const tasks = (c.tasks || []).filter(t => (t.name || '').trim()).map(t => ({...t, dueAt:taskDueAt(t).getTime(), assigneeName:userName(data, resolvePerson(data, deal, t.assignee)) || owner}));
        if(!tasks.length) return {status:'skipped', result:'No task named'};
        if(prompt) return prompted([createPrompt(run, step, deal, 'createTask', tasks.length > 1 ? 'Create tasks' : 'Create a task', {tasks})], owner);
        createTasks(deal, tasks, run, w.id);
        return {status:'done', result:`Created ${plural(tasks.length, 'task')}`};
      }
      /* Add Note: a predefined note is added straight away (Automatic) or shown to the owner,
         filled in; without one, the owner is asked to write it. */
      case 'addNote': {
        const body = c.specific ? (c.body || '').trim() : '';
        if(!prompt && body){ addNoteTo(deal, body, run, w.id); return {status:'done', result:'Note added'}; }
        return {status:'prompted', promptIds:[createPrompt(run, step, deal, 'addNote', 'Add a note', {body})], result:`Waiting for ${owner || 'the record owner'} to add a note`};
      }
      /* Enroll in Email Sequence: Automatic sends / schedules the emails; Required asks the owner
         to ("Enroll in Consultation Nurture", "Send Consultation Follow-up email now"). */
      case 'scheduleEmail': {
        const emails = (c.emails || []).filter(e => e.templateId);
        if(!emails.length) return {status:'skipped', result:'No email template chosen'};
        if(prompt){
          const e = emails[0], tpl = emailTemplatesOf(data).find(t => t.id === e.templateId) || {};
          const seq = c.sequenceId && emails.some(x => x.sequenceId === c.sequenceId) && emailSequencesOf(data).find(q => q.id === c.sequenceId);
          const title = seq ? `Enroll in ${seq.name}` : emails.length > 1 ? 'Send emails' : `${e.immediate ? 'Send' : 'Schedule'} ${tpl.name || 'the'} email${e.immediate ? ' now' : ''}`;
          return prompted([createPrompt(run, step, deal, 'sendEmail', title, {emails})], owner);
        }
        return {status:'done', result:sendEmails(deal, emails, run, w.id)};
      }
      /* Schedule Meeting: Automatic books each meeting at its When (After N units, at a time);
         Required asks the record owner for the date and time. */
      case 'scheduleMeeting': {
        const meetings = c.meetings || [];
        if(!meetings.length) return {status:'skipped', result:'No meeting set up'};
        if(!prompt){
          const acts = meetings.map(m => bookMeeting(deal, m, taskDueAt({due:m.when}), run));
          return {status:'done', result:`Scheduled ${plural(acts.length, 'meeting')}`};
        }
        const ids = meetings.map((m, i) => createPrompt(run, step, deal, 'scheduleMeeting', meetings.length > 1 ? `Schedule meeting ${i + 1}` : 'Schedule a meeting', {meeting:m}));
        return prompted(ids, owner);
      }
      case 'notify': {
        const ids = [...new Set([...(c.recipients || []).map(r => resolvePerson(data, deal, r)), ...(c.users || [])].filter(Boolean))];
        if(!ids.length) return {status:'skipped', result:'No recipients'};
        const text = (c.message || '').trim() || workflowTitle(data, w);
        const notes = ids.map(u => ({id:wfNewId('nt'), userId:u, dealId:deal.id, dealName:deal.name, text, at:Date.now(), read:false}));
        commit(s => ({...s, notifications:[...notes, ...s.notifications].slice(0, 300)}));
        recordEffect({kind:'notification', ids:notes.map(n => n.id), users:ids});
        return {status:'done', result:`Notified ${ids.map(u => userName(data, u)).join(', ')}`};
      }
      case 'createAssociatedObject': {
        // Objects whose records can be created today (a saved config may name others).
        const objects = associatedToCreate(c).filter(o => RECORD_OBJECTS.includes(o));
        if(!objects.length) return {status:'skipped', result: associatedToCreate(c).length ? 'Creating that record isn’t available yet' : 'No record to create'};
        // Enforce Rules: created at once, named after the record, with its owner; Track: the owner is asked to.
        if(!prompt) return {status:'done', result:objects.map(o => createLinkedRecord(deal, o, {name:deal.name || '', owner:deal.owner || ''}, run)).join(' · ')};
        // A deal that already has its customer isn't asked for another.
        const needed = objects.filter(o => !(o === 'customers' && recordObjectOf(deal.id) === 'deals' && dealCustomer(deal.id)));
        if(!needed.length) return {status:'done', result:`Customer already exists · ${dealCustomer(deal.id).name || ''}`};
        const ids = needed.map(o => createPrompt(run, step, deal, 'createRecord', `Create ${objectName(data, o).replace(/s$/, '')}`, {object:o, values:{}}));
        return prompted(ids, owner);
      }
      // Prompt to Clear Property Value (Track Violations): the owner is asked to clear them.
      case 'promptClearProperty': {
        const props = recordProps(deal);
        const keys = (c.properties || []).map(e => e.property).filter(k => k && props.some(p => p.key === k) && !(props.find(p => p.key === k) || {}).mandatory);
        if(!keys.length) return {status:'skipped', result:'No properties to clear'};
        return prompted([createPrompt(run, step, deal, 'clearProperty', 'Clear properties', {keys})], owner);
      }
      /* Move to Specific Pipeline: into the chosen stage of the pipeline, else its first stage. */
      case 'moveToPipeline': {
        if(recordObjectOf(deal.id) === 'contacts') return {status:'skipped', result:'A contact moves by its Types of Contact'};
        const pl = pipelineById2(data, c.pipeline);
        if(!pl) return {status:'skipped', result:'No pipeline chosen'};
        const stage = c.stage && pl.stages.some(st => st.id === c.stage) ? c.stage : ((pl.stages.find(st => !st.outcome) || pl.stages[0] || {}).id);
        if(!stage) return {status:'skipped', result:`${pl.label} has no stages`};
        if(deal.pipeline === pl.id && deal.stage === stage) return {status:'skipped', result:`Already in ${pl.label}`};
        const label = `${pl.label} · ${stageLabelOf(data, pl.id, stage)}`;
        if(prompt) return prompted([createPrompt(run, step, deal, 'moveStage', `Move to ${pl.label}`, {pipeline:pl.id, stage})], owner);
        const by = blockedBy(applyPatch(deal, {pipeline:pl.id, stage}, run), deal.id);
        if(by) return {status:'skipped', result:`Entry to ${label} blocked by ${by}`};
        return {status:'done', result:`Moved to ${label}`};
      }
      // Create Email Activity: one email, sent now (Track: the owner is asked to send it).
      case 'createEmailActivity': {
        const e = c.email || {};
        if(!e.templateId) return {status:'skipped', result:'No email template chosen'};
        const emails = [{...e, immediate:true}], tpl = emailTemplatesOf(data).find(t => t.id === e.templateId) || {};
        if(prompt) return prompted([createPrompt(run, step, deal, 'sendEmail', `Send ${tpl.name || 'the'} email now`, {emails})], owner);
        return {status:'done', result:sendEmails(deal, emails, run, w.id)};
      }
      /* Exit Email Sequence: the record's emails still scheduled from the sequence aren't sent — they
         leave its activity (the step's effects keep them). */
      case 'exitEmailSequence': {
        const seq = emailSequencesOf(data).find(q => q.id === c.sequenceId);
        if(!seq) return {status:'skipped', result:'No sequence chosen'};
        const pending = actsOf(deal.id).filter(a => a.type === 'email' && a.status === 'scheduled' && a.sequenceId === seq.id);
        if(!pending.length) return {status:'done', result:`No emails scheduled from \u201c${seq.name}\u201d`};
        editActivities(m => ({...m, [deal.id]:(m[deal.id] || []).filter(a => !pending.some(x => x.id === a.id))}));
        pending.forEach(a => recordEffect({kind:'activityRemoved', recordId:deal.id, activityId:a.id, type:'email', title:a.title, scheduledFor:a.scheduledFor}));
        return {status:'done', result:`Exited \u201c${seq.name}\u201d · ${plural(pending.length, 'scheduled email')} cancelled`};
      }
      // Create Meeting: a meeting that happened, logged (Track: the owner is asked to log it).
      case 'createMeeting': {
        const m = {title:(c.title || '').trim() || 'Meeting', platform:c.platform || '', duration:c.duration || '30 minutes', notes:c.notes || ''};
        if(prompt) return prompted([createPrompt(run, step, deal, 'logMeeting', 'Log a meeting', {meeting:m})], owner);
        logMeetingOn(deal, m, run, w.id);
        return {status:'done', result:`Meeting logged: ${m.title}`};
      }
      // Add Call Log: a call made elsewhere, logged (Track: the owner is asked to log it).
      case 'addCallLog': {
        const call = {outcome:c.outcome || '', callType:c.callType || 'Outbound', comment:c.comment || ''};
        if(prompt) return prompted([createPrompt(run, step, deal, 'logCall', 'Log a call', {call})], owner);
        if(!call.outcome) return {status:'skipped', result:'No call outcome chosen'};
        logCallOn(deal, call, run, w.id);
        return {status:'done', result:`Call logged · ${call.outcome}`};
      }
      // Initiate Call (Track Violations): the owner calls the record — resolved by a call through the dialer.
      case 'initiateCall': return prompted([createPrompt(run, step, deal, 'initiateCall', `Call ${deal.name || 'the record'}`, {})], owner);
      // Delete Record (Track Violations): the owner is asked to delete it — confirmed, with their delete permission.
      case 'deleteRecord': return prompted([createPrompt(run, step, deal, 'deleteRecord', `Delete ${objectName(data, recordObjectOf(deal.id)).replace(/s$/, '')}`, {})], owner);
      /* Update Associated Record: each associated record of the chosen Object, set to the values. */
      case 'updateAssociatedRecord': {
        const tProps = objectProperties(data, c.object || ''), entries = (c.properties || []).filter(e => e.property && tProps.some(p => p.key === e.property));
        if(!c.object || !entries.length) return {status:'skipped', result:'Nothing to update'};
        const on = objectName(data, c.object).replace(/s$/, '').toLowerCase(), targets = associatedOf(deal, c.object);
        if(!targets.length) return {status:'skipped', result:`No associated ${on}`};
        targets.forEach(r => applyPatch(r, Object.fromEntries(entries.map(e => { const p = tProps.find(x => x.key === e.property); return [p.key, toDealValue(r, p, e.value)]; })), run));
        return {status:'done', result:`Updated ${plural(targets.length, on)}: ${entries.map(e => { const p = tProps.find(x => x.key === e.property); return `${p.label} → ${showValue(targets[0], p, toDealValue(targets[0], p, e.value))}`; }).join(', ')}`};
      }
      /* Classify Record (AI): the property set to the value that fits the record — mocked until an AI
         is connected, and marked as AI. */
      case 'classifyRecord': {
        const p = recordProps(deal).find(x => x.key === c.property);
        const options = ((p && p.options) || []).map(o => typeof o === 'string' ? o : o.value).filter(Boolean);
        if(!options.length) return {status:'skipped', result:'No property to classify'};
        const v = mockClassify(deal, options);
        if(String(deal[p.key] ?? '') === v) return {status:'done', result:`AI (mock) · ${p.label} stays ${v}`};
        applyPatch(deal, {[p.key]:v}, run);
        return {status:'done', result:`AI (mock) · ${p.label} → ${v}`};
      }
      /* Assign Record Owner: a person; in turn within a team; round-robin over a list; or a user
         matching the owner conditions (several: in turn; none: the owner stays — noted). */
      case 'assignOwner': {
        const active = (data.users || []).filter(u => u.status === 'Activated').map(u => u.id), key = `${w.id}:${action.id}`;
        let to = null, how = '';
        if(c.method === 'person') to = active.includes(c.user) ? c.user : null;
        else if(c.method === 'team'){
          const team = (data.teams || []).find(t => t.id === c.team), pool = (data.users || []).filter(u => u.teamId === c.team && active.includes(u.id)).map(u => u.id);
          if(!team || !pool.length) return {status:'skipped', result:'No active members in the team'};
          to = nextInTurn(key, pool); how = ` · in turn within ${team.name}`;
        } else if(c.method === 'roundRobin'){
          const pool = (c.users || []).filter(id => active.includes(id));
          if(!pool.length) return {status:'skipped', result:'No active users in the list'};
          to = nextInTurn(key, pool); how = ' · round-robin';
        } else if(c.method === 'properties'){
          const pool = active.filter(id => (c.rules || []).every(r => ownerRuleHolds(data, id, r)));
          if(!pool.length) return {status:'done', result:`No user matches the owner conditions · ${owner || 'the owner'} stays the owner`};
          to = nextInTurn(key, pool); how = pool.length > 1 ? ` · in turn among ${pool.length} matching users` : ' · the matching user';
        }
        if(!to) return {status:'skipped', result:'No owner chosen'};
        if(to === deal.owner) return {status:'done', result:`${userName(data, to)} is already the owner${how}`};
        applyPatch(deal, {owner:to}, run);
        return {status:'done', result:`Owner → ${userName(data, to)}${how}`};
      }
      // Prompt Update Property: its toggle on always asks; off, the Workflow Type decides.
      case 'promptUpdateProperty': {
        const props = recordProps(deal);
        const entries = (c.properties || []).filter(e => e.property && props.some(p => p.key === e.property))
          .map(e => { const p = props.find(x => x.key === e.property); return {property:e.property, value: p.type === 'User' ? '' : inputPropertyValue(p, deal[e.property])}; });
        if(!entries.length) return {status:'skipped', result:'No properties chosen'};
        return prompted([createPrompt(run, step, deal, 'setProperty', 'Update properties', {entries})], owner);
      }
    }
    return {status:'skipped', result:'Not defined yet'};
  }

  /* A run's status follows its steps; its deal activity lists the results. */
  function settleRun(runId){
    const r = getRun(runId);
    if(!r || !r.steps.length && r.status !== 'running') return;
    const status = runStatusOf(r.steps);
    if(status !== r.status) patchRun(runId, x => ({...x, status}));
    if(r.activityId) patchActivity(r.dealId, r.activityId, {body:r.steps.map(s => `${s.label}: ${STEP_STATUS[s.status].label}${s.result ? ` — ${s.result}` : ''}`).join('\n')});
  }

  /* ── Prompts ── */
  function resolvePrompt(id, status, outcome){
    const p = esRef.current.prompts.find(x => x.id === id);
    if(!p || p.status !== 'pending') return;
    // Not applicable is the system's (the record left the stage); the rest, a person's.
    commit(s => ({...s, prompts:s.prompts.map(x => x.id === id ? {...x, status, resolvedAt:Date.now(), resolvedBy: status === 'notApplicable' ? null : CURRENT_USER.name, outcome} : x)}));
    const run = getRun(p.runId);
    const step = run && run.steps.find(s => s.id === p.stepId);
    if(!step) return;
    const all = esRef.current.prompts.filter(x => (step.promptIds || []).includes(x.id));
    if(all.every(x => x.status !== 'pending')){
      const anyDone = all.some(x => x.status === 'done');
      const lapsed = all.some(x => x.status === 'notApplicable');
      patchStep(run.id, step.id, {status: anyDone ? 'done' : lapsed ? 'notApplicable' : 'dismissed',
        result: all.map(x => x.outcome || (x.status === 'done' ? 'Completed' : x.status === 'notApplicable' ? 'No longer applicable' : 'Dismissed')).join(' · ')});
    }
  }
  /* Only Required actions are violations, so an open violation lasts only while its action still is
     one: its workflow deleted or turned off, its action removed or now Automatic — the violation is
     Not applicable (an Automatic action is only ever shown when it runs). Checked whenever the
     workflows change, and on load. */
  function violationLapse(p){
    const raw = (dataRef.current.workflows || []).find(x => x.id === p.workflowId);
    if(!raw) return 'its workflow was deleted';
    const w = normalizeWorkflow(raw);
    if(w.active === false) return 'its workflow is turned off';
    const run = getRun(p.runId), step = run && run.steps.find(st => st.id === p.stepId);
    const actionId = p.actionId || (step && step.actionId);
    if(!actionId) return null;   // a violation from before actions were recorded on it, whose run is gone: kept
    const a = (w.actions || []).find(x => x.id === actionId);
    if(!a) return 'its action was removed';
    return actionBehavior(a) === 'automatic' && a.type !== 'blockEntry' ? 'its workflow now enforces rules' : null;
  }
  function reconcileViolations(){
    esRef.current.prompts.filter(p => p.status === 'pending' && p.required).forEach(p => {
      const why = violationLapse(p);
      if(why) resolvePrompt(p.id, 'notApplicable', `No longer applicable · ${why}`);
    });
  }
  // Pending violations that end on their own: `outcomeFor(p)` → [status, outcome].
  function endViolations(match, outcomeFor){
    esRef.current.prompts.filter(p => p.status === 'pending' && p.required && match(p)).forEach(p => resolvePrompt(p.id, ...outcomeFor(p)));
  }
  // A prompt's effects belong to the step that raised it.
  function completePrompt(id, input){
    const p = esRef.current.prompts.find(x => x.id === id);
    if(!p) return;
    return withEffects(p.runId, p.stepId, () => completePromptNow(id, input));
  }
  function completePromptNow(id, input){
    const p = esRef.current.prompts.find(x => x.id === id);
    const deal = p && getDeal(p.dealId);
    if(!p || !deal) return;
    const run = getRun(p.runId) || {chain:{id:wfNewId('ch'), depth:0, visited:[]}};
    const data = dataRef.current, props = recordProps(deal), owner = userName(data, deal.owner);
    let outcome = 'Completed';
    switch(p.kind){
      case 'setProperty': {
        /* A violation confirmed with the client's value unchanged: the values stay as they are and
           the confirmation is the outcome (the deal's Workflow activity and the Runs tab show it). */
        if(input.sameValue){
          const labels = (p.payload.entries || []).map(e => (props.find(x => x.key === e.property) || {}).label).filter(Boolean).join(', ');
          outcome = `${labels} confirmed unchanged by client · ${CURRENT_USER.name}`;
          break;
        }
        const patch = {};
        Object.entries(input.values || {}).forEach(([k, v]) => { const pr = props.find(x => x.key === k); if(pr) patch[k] = toDealValue(deal, pr, v); });
        // Resolved first: the change would otherwise end it as a cleared violation (Is not changed).
        resolvePrompt(id, 'done', Object.keys(patch).map(k => `${(props.find(x => x.key === k) || {}).label} → ${showValue(deal, props.find(x => x.key === k), patch[k])}`).join(', ') || 'Nothing changed');
        applyPatch(deal, patch, run);
        return;
      }
      case 'clearProperty': applyPatch(deal, Object.fromEntries(p.payload.keys.map(k => [k, ''])), run); outcome = 'Cleared'; break;
      case 'moveStage': {
        // Move to Specific Pipeline carries its pipeline; the others stay in the record's.
        const pipe = p.payload.pipeline || deal.pipeline, patch = pipe !== deal.pipeline ? {pipeline:pipe, stage:p.payload.stage} : {stage:p.payload.stage};
        if(deal.stage === p.payload.stage && deal.pipeline === pipe){ outcome = 'Already in that stage'; break; }
        // A Block Entry workflow keeps the deal out: the attempt is explained, the prompt stays open.
        if(entryBlockers(deal, {...deal, ...patch}, run.chain).length){ applyPatch(deal, patch, run, {byPerson:true}); return; }
        // Resolved first: leaving the stage would otherwise end it as a cleared violation.
        const pl = pipelineById2(data, pipe);
        resolvePrompt(id, 'done', `Moved to ${pipe !== deal.pipeline && pl ? `${pl.label} · ` : ''}${stageLabelOf(data, pipe, p.payload.stage)}`);
        applyPatch(deal, patch, run);
        return;
      }
      // Block Entry is never overridden (Enforce Rules); an old Required one lapses on load.
      case 'blockEntry': return;
      case 'sendEmail': outcome = sendEmails(deal, p.payload.emails || [], run, run.workflowId); break;
      case 'addNote': {
        addNoteTo(deal, input.body.trim(), run, run.workflowId);
        outcome = 'Note added'; break;
      }
      case 'createTask': {
        createTasks(deal, p.payload.tasks || [], run, run.workflowId);
        outcome = `Created ${plural((p.payload.tasks || []).length, 'task')}`; break;
      }
      case 'scheduleMeeting': {
        const at = new Date(`${input.date}T${input.time || '09:00'}`);
        bookMeeting(deal, p.payload.meeting || {}, at, run);
        outcome = `Meeting scheduled for ${at.toLocaleString('en-US', {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'})}`; break;
      }
      case 'logMeeting': {
        logMeetingOn(deal, {...(p.payload.meeting || {}), notes:input.notes ?? (p.payload.meeting || {}).notes}, run, run.workflowId);
        outcome = `Meeting logged: ${(p.payload.meeting || {}).title || 'Meeting'}`; break;
      }
      case 'logCall': {
        logCallOn(deal, {...(p.payload.call || {}), outcome:input.outcome || (p.payload.call || {}).outcome, comment:input.comment ?? (p.payload.call || {}).comment}, run, run.workflowId);
        outcome = `Call logged · ${input.outcome || (p.payload.call || {}).outcome}`; break;
      }
      // Initiate Call ends with a call through the dialer (emit), not here.
      case 'initiateCall': return;
      // Delete Record: only with the person's own permission to delete it.
      case 'deleteRecord': {
        if(!canDeleteRecord(deal)) return;
        resolvePrompt(id, 'done', `${deal.name || 'Record'} deleted · ${CURRENT_USER.name}`);
        removeRecord(deal, run);
        return;
      }
      case 'createRecord': {
        if(['contacts', 'customers', 'deals'].includes(p.payload.object)){ outcome = createLinkedRecord(deal, p.payload.object, input.values || {}, run); break; }
        if(p.payload.object === 'contacts'){
          const newContactId = newRecordId('contacts');   // never reused (store.jsx)
          setContacts(cs => [...cs, newContactRecord(newContactId, input.values)]);
          recordEffect({kind:'record', object:'contacts', recordId:newContactId});
          /* Created through this deal: linked to it — a deal has one contact (Contacts → Deals is
             One-to-many), so a deal that already has one keeps it. */
          const linked = deal.contactId == null;
          if(linked) setDealsTracked(ds => ds.map(d => d.id === deal.id ? {...d, contactId:newContactId} : d), childChain(run));
          outcome = `Contact created: ${input.values.name || ''}${linked ? ' · linked to this deal' : ' · not linked (the deal already has a contact)'}`;
        } else if(p.payload.object === 'customers' && recordObjectOf(deal.id) === 'deals'){
          /* A customer created through this deal: linked to it (Deals ↔ Customers) and to the deal's
             contact (Contacts → Customers). */
          const pipes = recordPipelines(data, 'customers');
          const cust = {id:newRecordId('customers'), ...input.values, pipeline:input.values.pipeline || (pipes[0] || {}).id || '',
            contactId:deal.contactId ?? null, dealIds:[deal.id], created:storePropertyValue('Date & time', new Date())};
          editActivities(m => ({...m, [cust.id]:[]}));
          setDealsTracked(rs => [...rs, cust], childChain(run));
          recordEffect({kind:'record', object:'customers', recordId:cust.id});
          outcome = `Customer created: ${cust.name || ''} · linked to this deal`;
        } else if(p.payload.object === 'deals' && recordObjectOf(deal.id) === 'customers'){
          /* A deal created through this customer: the customer's contact's deal, and the customer's
             deal — a customer has one (Deals → Customers is One-to-many), so one that has a deal keeps it. */
          const amount = input.values.amount === '' || input.values.amount == null ? '' : Number(input.values.amount);
          const nd = {id:newRecordId('deals'), contactId:deal.contactId ?? null, ...input.values, amount, currency:DEAL_CURRENCY, created:storePropertyValue('Date & time', new Date())};
          const linked = !(deal.dealIds || []).length;
          editActivities(m => ({...m, [nd.id]:[]}));
          setDealsTracked(rs => [...rs.map(r => linked && r.id === deal.id ? {...r, dealIds:[nd.id]} : r), nd], childChain(run));
          recordEffect({kind:'record', object:'deals', recordId:nd.id});
          outcome = `Deal created: ${nd.name || ''}${linked ? ' · linked to this customer' : ' · not linked (the customer already has a deal)'}`;
        } else outcome = `${objectName(data, p.payload.object)}: not defined yet`;
        break;
      }
    }
    resolvePrompt(id, 'done', outcome);
  }

  /* ── Scheduler: due Stay at Stage checks, delayed steps, scheduled emails, and booked meetings
     whose time has passed (Meeting Completed — each once). ── */
  /* Is not changed for a duration: due once the time has passed since the property's last change
     (or the record entering the context, if later), with the record still in the context. Fires
     once per quiet period — `quietFired` remembers it until the property changes again. */
  function checkQuietProperties(now){
    (dataRef.current.workflows || []).map(normalizeWorkflow).filter(w => w.active !== false && w.context && ACTIVITY_RECORD_OBJECTS.includes(w.context.object)).forEach(w => {
      // Throughout the lifecycle: never changed — once per record, open until it changes.
      workflowTriggerViews(w).filter(v => v.trigger === 'propertyUpdate' && v.triggerConfig.op === 'notChanged' && v.triggerConfig.when === 'lifecycle').forEach(v => {
        dealsRef.current.filter(d => inContext(v, d) && inTriggerScope(v, d) && !lastChangedAt(d, v.triggerConfig)).forEach(d => {
          const key = `${w.id}:${v.triggerId}:${d.id}:life`;
          if((esRef.current.quietFired || {})[key]) return;
          commit(s => ({...s, quietFired:{...(s.quietFired || {}), [key]:true}}));
          fire(w, [v], d, () => baseRun(v, d, {chain:{id:wfNewId('ch'), depth:0, visited:[]}, previousStage:null, change:null, lifecycle:true}));
        });
      });
      workflowTriggerViews(w).filter(v => v.trigger === 'propertyUpdate' && v.triggerConfig.op === 'notChanged' && !v.triggerConfig.inStage && v.triggerConfig.when !== 'lifecycle' && Number(v.triggerConfig.changeAmount) > 0).forEach(v => {
        const c = v.triggerConfig, ms = wfDurationMs(changeDuration(c));
        dealsRef.current.filter(d => inContext(v, d) && inTriggerScope(v, d)).forEach(d => {
          const since = Math.max(lastChangedAt(d, c), contextEnteredAt(v, d));
          const key = `${w.id}:${v.triggerId}:${d.id}:${since}`;
          if(now < since + ms || (esRef.current.quietFired || {})[key]) return;
          commit(s => ({...s, quietFired:{...(s.quietFired || {}), [key]:true}}));
          fire(w, [v], d, () => baseRun(v, d, {chain:{id:wfNewId('ch'), depth:0, visited:[]}, previousStage:null, change:null}));
        });
      });
    });
  }
  /* Record Is Not Changed: due once the duration has passed since the record last changed (any
     property, its stage too — or since it was created / entered the context), with it still in the
     context. Once per quiet period: a change starts a new one. */
  const lastRecordChange = (d) => Math.max(createdTime(d), d.stageEnteredAt || 0, ...Object.values(d.changedAt || {}).map(Number).filter(Boolean));
  function checkQuietRecords(now){
    (dataRef.current.workflows || []).map(normalizeWorkflow).filter(w => w.active !== false && w.context && w.context.object).forEach(w => {
      workflowTriggerViews(w).filter(v => v.trigger === 'recordNotChanged' && wfDurationMs(v.triggerConfig)).forEach(v => {
        const ms = wfDurationMs(v.triggerConfig);
        dealsRef.current.filter(d => recordObjectOf(d.id) === w.context.object && inContext(v, d) && inTriggerScope(v, d)).forEach(d => {
          const since = Math.max(lastRecordChange(d), contextEnteredAt(v, d)), key = `${w.id}:${v.triggerId}:${d.id}:${since}`;
          if(!since || now < since + ms || (esRef.current.quietFired || {})[key]) return;
          commit(s => ({...s, quietFired:{...(s.quietFired || {}), [key]:true}}));
          fire(w, [v], d, () => baseRun(v, d, {chain:{id:wfNewId('ch'), depth:0, visited:[]}, previousStage:null, change:null}));
        });
      });
    });
  }
  /* Associated Record · Is not created / Is not changed — after a duration since the record entered
     the context (Is not changed: since an associated record last changed, if later), once per
     period; or In this stage: once per stage entry, as it's in the stage without one / with none of
     them changed since it entered (its violation ends when one is created / changes —
     endAssociatedViolations). Is not changed needs at least one associated record. */
  const associatedQuiet = (v) => v.trigger === 'associatedRecord' && associatedParamTimed((v.triggerConfig || {}).assocParam) && !!(v.triggerConfig || {}).associatedObject;
  function checkAssociatedQuiet(now){
    (dataRef.current.workflows || []).map(normalizeWorkflow).filter(w => w.active !== false && w.context && w.context.object).forEach(w => {
      workflowTriggerViews(w).filter(associatedQuiet).forEach(v => {
        const c = v.triggerConfig, life = c.when === 'lifecycle', inStage = !life && !!c.inStage && !!v.context.stage, ms = inStage || life ? 0 : wfDurationMs(changeDuration(c));
        if(!inStage && !life && !ms) return;
        dealsRef.current.filter(d => recordObjectOf(d.id) === w.context.object && inContext(v, d) && inTriggerScope(v, d)).forEach(d => {
          const linked = associatedRecordsOf(d, c.associatedObject, dealsRef.current), entered = inStage ? (d.stageEnteredAt || 0) : life ? createdTime(d) : contextEnteredAt(v, d);
          if(c.assocParam === 'notCreated' ? linked.length : !linked.length) return;
          const lastChange = c.assocParam === 'notChanged' ? Math.max(0, ...linked.map(lastRecordChange)) : 0;
          if(inStage && lastChange >= entered) return;   // one changed in this stage
          if(life && lastChange > entered) return;   // one changed during its life
          const since = inStage ? entered : Math.max(entered, lastChange), key = life ? `${w.id}:${v.triggerId}:${d.id}:life` : `${w.id}:${v.triggerId}:${d.id}:${since}`;
          if((!since && !life) || now < since + ms || (esRef.current.quietFired || {})[key]) return;
          commit(s => ({...s, quietFired:{...(s.quietFired || {}), [key]:true}}));
          fire(w, [v], d, () => baseRun(v, d, {chain:{id:wfNewId('ch'), depth:0, visited:[]}, previousStage:null, change:null, ...(life ? {lifecycle:true} : {})}));
        });
      });
    });
  }
  /* Its violation ends once the condition is met — an associated record created (or an existing one
     linked: settleAssociatedViolations) / one changing. */
  function endAssociatedViolations(ev){
    const param = ev.type === 'associatedRecordCreated' ? 'notCreated' : 'notChanged';
    const watching = (p) => { const w = getWorkflow(p.workflowId);
      return !!w && workflowTriggerViews(w).some(v => associatedQuiet(v) && v.triggerConfig.assocParam === param && v.triggerConfig.associatedObject === ev.attrs.object); };
    const noun = objectName(dataRef.current, ev.attrs.object).replace(/s$/, '');
    endViolations(p => p.dealId === ev.recordId && watching(p), () => ['cleared', `Associated ${noun} ${param === 'notCreated' ? 'created' : 'changed'}`]);
  }
  function settleAssociatedViolations(){
    esRef.current.prompts.filter(p => p.status === 'pending' && p.required).forEach(p => {
      const w = getWorkflow(p.workflowId), d = getDeal(p.dealId);
      if(!w || !d) return;
      const v = workflowTriggerViews(w).find(x => associatedQuiet(x) && x.triggerConfig.assocParam === 'notCreated');
      if(v && associatedRecordsOf(d, v.triggerConfig.associatedObject, dealsRef.current).length)
        resolvePrompt(p.id, 'cleared', `Associated ${objectName(dataRef.current, v.triggerConfig.associatedObject).replace(/s$/, '')} linked`);
    });
  }
  /* Stay in Pipeline: a record in the pipeline for the duration since it entered it (created in it,
     or moved into it) — once per entry. */
  function checkPipelineStays(now){
    (dataRef.current.workflows || []).map(normalizeWorkflow).filter(w => w.active !== false && w.context && w.context.object).forEach(w => {
      workflowTriggerViews(w).filter(v => v.trigger === 'stayInPipeline' && wfDurationMs(v.triggerConfig)).forEach(v => {
        const pipe = workflowPipeline(v), ms = wfDurationMs(v.triggerConfig);
        dealsRef.current.filter(d => recordObjectOf(d.id) === w.context.object && d.pipeline && (!pipe || d.pipeline === pipe) && inTriggerScope(v, d)).forEach(d => {
          const since = d.pipelineEnteredAt || createdTime(d), key = `${w.id}:${v.triggerId}:${d.id}:${since}`;
          if(!since || now < since + ms || (esRef.current.quietFired || {})[key]) return;
          commit(s => ({...s, quietFired:{...(s.quietFired || {}), [key]:true}}));
          fire(w, [v], d, () => baseRun(v, d, {chain:{id:wfNewId('ch'), depth:0, visited:[]}, previousStage:null, change:null}));
        });
      });
    });
  }
  /* Email Sent Ago: an email (any, or of the chosen template) sent the set time ago — once per email. */
  function checkEmailsAgo(now){
    (dataRef.current.workflows || []).map(normalizeWorkflow).filter(w => w.active !== false && w.context && w.context.object).forEach(w => {
      workflowTriggerViews(w).filter(v => v.trigger === 'emailEvents' && v.triggerConfig.activityProperty === 'emailSentAgo').forEach(v => {
        const c = v.triggerConfig, ms = wfDurationMs({amount:c.agoAmount, unit:c.agoUnit || 'Days'});
        if(!ms) return;
        dealsRef.current.filter(d => recordObjectOf(d.id) === w.context.object && inContext(v, d) && inTriggerScope(v, d)).forEach(d => {
          actsOf(d.id).filter(a => isSentEmail(a) && (!c.template || a.templateId === c.template)).forEach(a => {
            const key = `${w.id}:${v.triggerId}:${a.id}`, at = new Date(a.at).getTime();
            if(now < at + ms || (esRef.current.quietFired || {})[key]) return;
            commit(s => ({...s, quietFired:{...(s.quietFired || {}), [key]:true}}));
            fire(w, [v], d, () => baseRun(v, d, {chain:{id:wfNewId('ch'), depth:0, visited:[]}, previousStage:null, change:null}));
          });
        });
      });
    });
  }
  /* Company-wide workflows (User Property triggers only): each activated user is checked — when
     the triggers hold for them (All / Any), the workflow runs once for that user (again only after
     they stop holding); its actions are Notify ("the user" is the person it's about). */
  function checkCompanyUsers(){
    const data = dataRef.current;
    (data.workflows || []).map(normalizeWorkflow).filter(w => w.active !== false && w.triggers.length && !(w.context || {}).object).forEach(w => {
      const views = workflowTriggerViews(w);
      if(!views.every(v => v.trigger === 'propertyUpdate' && scopeOf(v.triggerConfig) === 'owner')) return;
      (data.users || []).filter(u => u.status === 'Activated' && appliesToOwner(w, u.id)).forEach(u => {
        const held = views.filter(v => !isChangeOp(v.triggerConfig.op) && evalConditionRule(triggerConditionRule(v), {data, user:u.id, deal:null, acts:[]}, scopeFields(data, 'owner')) === true);
        const ok = triggersMatchAll(w) ? held.length === views.length : held.length > 0;
        const key = `company:${w.id}:${u.id}`, fired = !!(esRef.current.quietFired || {})[key];
        if(!ok){ if(fired) commit(s => { const q = {...(s.quietFired || {})}; delete q[key]; return {...s, quietFired:q}; }); return; }
        if(fired) return;
        commit(s => ({...s, quietFired:{...(s.quietFired || {}), [key]:true}}));
        const subject = {id:null, owner:u.id, name:u.name};
        const steps = (w.actions || []).map(a => {
          const base = {id:wfNewId('st'), actionId:a.id, type:a.type, label:(workflowAction(a.type) || {}).label || a.type, summary:actionSummary(data, a, w.context), ranAt:Date.now()};
          if(a.type !== 'notify') return {...base, status:'skipped', result:'Needs a record — Company-wide workflows can only notify'};
          const c = a.config || {}, ids = [...new Set([...(c.recipients || []).map(r => resolvePerson(data, subject, r)), ...(c.users || [])].filter(Boolean))];
          if(!ids.length) return {...base, status:'skipped', result:'No recipients'};
          const text = `${(c.message || '').trim() || (w.name || workflowTitle(data, w))} · ${u.name}`;
          commit(s => ({...s, notifications:[...ids.map(uid => ({id:wfNewId('nt'), userId:uid, dealId:null, dealName:u.name, text, at:Date.now(), read:false})), ...s.notifications].slice(0, 300)}));
          return {...base, status:'done', result:`Notified ${ids.map(x => userName(data, x)).join(', ')}`};
        });
        addRun({id:wfNewId('run'), workflowId:w.id, version:w.version || 1, trigger:views[0].trigger, triggerId:views[0].triggerId, dealId:null, dealName:u.name, subject:'user',
          createdAt:Date.now(), startedAt:Date.now(), steps, status:runStatusOf(steps), reasons:held.map(v => ({text:triggerSummary(data, v), actual:null}))});
      });
    });
  }
  function tick(){
    const now = Date.now();
    checkStageStates();
    checkQuietProperties(now);
    checkPipelineStays(now);
    checkQuietRecords(now);
    checkAssociatedQuiet(now);
    checkEmailsAgo(now);
    checkCompanyUsers();
    settleEntryViolations();
    esRef.current.runs.filter(r => r.status === 'waiting' && r.checkAt && r.checkAt <= now).forEach(r => checkStay(r.id));
    esRef.current.runs.filter(r => r.status === 'running').forEach(r => r.steps.filter(s => s.status === 'scheduled' && s.dueAt <= now).forEach(s => executeStep(r.id, s.id, true)));
    Object.entries(actsRef.current).forEach(([dealId, list]) => list.filter(a => a.type === 'email' && a.status === 'scheduled' && a.scheduledFor && new Date(a.scheduledFor).getTime() <= now).forEach(a => {
      patchActivity(dealId, a.id, {status:'sent', at:new Date()});
      const deal = getDeal(dealId);
      emit({type:'emailSent', recordId:dealId, pipelineId:deal && deal.pipeline, attrs:{activityId:a.id, templateId:a.templateId}});
    }));
    // Tasks that have become overdue (Number of Overdue Tasks) — each once.
    Object.entries(actsRef.current).forEach(([dealId, list]) => list.filter(a => isOverdueTask(a) && !a.overdueNotified).forEach(a => {
      patchActivity(dealId, a.id, {overdueNotified:true});
      const deal = getDeal(dealId);
      emit({type:'taskOverdue', recordId:dealId, pipelineId:deal && deal.pipeline, attrs:{activityId:a.id}});
    }));
    Object.entries(actsRef.current).forEach(([dealId, list]) => list.filter(a => a.type === 'meeting' && a.status === 'scheduled' && !a.completedNotified && meetingTime(a) <= now).forEach(a => {
      patchActivity(dealId, a.id, {completedNotified:true});
      const deal = getDeal(dealId);
      emit({type:'meetingCompleted', recordId:dealId, pipelineId:deal && deal.pipeline, attrs:{activityId:a.id}});
    }));
  }
  const tickRef = React.useRef(tick); tickRef.current = tick;
  React.useEffect(() => { tickRef.current(); const t = setInterval(() => tickRef.current(), 15000); return () => clearInterval(t); }, []);

  /* Workflow lifecycle: turning off (or deleting) cancels what's scheduled; turning on or editing
     a Stay at Stage workflow (re)schedules its checks for the deals already in the stage. */
  const prevWorkflows = React.useRef(null);
  React.useEffect(() => {
    const prev = prevWorkflows.current, now = data.workflows || [];
    prevWorkflows.current = now;
    // Checks that are already due (e.g. deals long in the stage) run straight away.
    if(prev === null){
      // Workflows removed while the app was closed (e.g. cleared): what they still had scheduled ends.
      [...new Set(esRef.current.runs.map(r => r.workflowId))].filter(id => !now.some(w => w.id === id)
        && esRef.current.runs.some(r => r.workflowId === id && (r.status === 'waiting' || (r.steps || []).some(st => st.status === 'scheduled'))))
        .forEach(id => cancelWorkflow(id, 'Workflow deleted'));
      now.forEach(syncStay); now.forEach(n => backfillAllRecords(n)); reconcileViolations(); tickRef.current(); return;
    }
    prev.forEach(p => {
      const n = now.find(x => x.id === p.id);
      // Turned off: turning it on again checks the existing records again (All Records).
      if(n && p.active !== false && n.active === false) commit(s => { const b = {...(s.backfilled || {})}; delete b[n.id]; return {...s, backfilled:b}; });
      if(!n || (p.active !== false && n.active === false)) cancelWorkflow(p.id, n ? 'Workflow turned off' : 'Workflow deleted');
      else if(n !== p){
        const shape = (x) => { const w = normalizeWorkflow(x); return JSON.stringify([w.triggers, w.triggerMatch]); };
        if(shape(n) !== shape(p)) clearProgress(n.id);
      }
    });
    now.forEach(n => { const p = prev.find(x => x.id === n.id); if(!p || p !== n){ syncStay(n); backfillAllRecords(n); } });
    reconcileViolations();
    tickRef.current();
  }, [data.workflows]);
  /* Trigger Scope · All Records: when a workflow is saved (each version) or turned on, the records
     already in its context are checked, once each — those that already meet its state triggers (a
     property's value, a count of activity) run now, as they would the moment those became true; so
     do those already sitting where an entry trigger leads: in the stage (Stage Entry Moving Forward
     or Backward — how they got there isn't known, so both), in the pipeline (Pipeline Entry), or
     simply existing (New Record). Moments (a stage or pipeline exit, a change, a form submitted, a
     particular email sent, Repeat) apply from their next occurrence; time-based ones (Stay at
     Stage, not changed for…) are checked by the scheduler for every record. Block Stage Entry:
     records already in the stage it blocks aren't moved — each gets a violation to change the
     values that keep it out (resolved once they no longer hold, or as it leaves the stage).
     Once per version (`backfilled`). New Records: nothing already there is checked. */
  const isStateTrigger = (v) => { const c = v.triggerConfig || {};
    if(v.trigger === 'propertyUpdate') return !!c.property && !isChangeOp(c.op);
    const p = activityTriggerProperty(v.trigger, c.activityProperty);
    return !!p && !!p.counts && !p.each && !p.template && !c.repeat; };
  const ENTRY_TRIGGERS = ['stageEntryForward', 'stageEntryBackward', 'pipelineEntry', 'recordCreated'];
  const appliesToExisting = (v) => ENTRY_TRIGGERS.includes(v.trigger) || isStateTrigger(v);
  // The triggers that already hold for a record sitting in the workflow's context.
  const heldByExisting = (w, d, data, acts) => workflowTriggerViews(w).filter(v => {
    if(v.trigger === 'stageEntryForward' || v.trigger === 'stageEntryBackward') return d.pipeline === workflowPipeline(v) && d.stage === workflowStage(v);
    if(v.trigger === 'pipelineEntry') return !!d.pipeline && (!workflowPipeline(v) || d.pipeline === workflowPipeline(v));
    if(v.trigger === 'recordCreated') return inContext(v, d);
    return isStateTrigger(v) && entryStateHolds(v, d, data, acts);
  });
  function backfillAllRecords(raw){
    const w = normalizeWorkflow(raw), data = dataRef.current;
    if(w.active === false || w.triggerScope !== 'all' || !w.context.object || !w.triggers.length) return;
    const mark = String(w.version || 1);
    if((esRef.current.backfilled || {})[w.id] === mark) return;
    commit(s => ({...s, backfilled:{...(s.backfilled || {}), [w.id]:mark}}));
    /* Block Stage Entry: a record already in the stage is checked as it would be on entering (its
       Stage Entry triggers hold — it's there), then moved back (the action). */
    const blocks = (w.actions || []).some(a => a.type === 'blockEntry');
    const isEntry = (v) => v.trigger === 'stageEntryForward' || v.trigger === 'stageEntryBackward';
    const views = workflowTriggerViews(w), applicable = blocks ? views : views.filter(appliesToExisting), all = triggersMatchAll(w);
    if(!applicable.length || (all && applicable.length !== views.length)) return;   // All: a moment still has to happen
    const heldFor = (d) => !blocks ? heldByExisting(w, d, data, actsOf(d.id))
      : views.filter(v => isEntry(v) ? d.pipeline === workflowPipeline(v) && d.stage === workflowStage(v) : blockStateHolds(v, d, data, actsOf(d.id), dealsRef.current, lastChangedAt));
    dealsRef.current.filter(d => recordObjectOf(d.id) === w.context.object && inContext(w, d) && inTriggerScope(w, d)).forEach(d => {
      const holding = heldFor(d);
      if(!holding.length || (all && holding.length !== views.length)) return;
      fire(w, holding, d, () => ({...baseRun(holding[holding.length - 1], d, {chain:{id:wfNewId('ch'), depth:0, visited:[]}, previousStage:null, change:null}), existingRecord:true}));
    });
  }
  /* A record that was already in a blocked stage (All Records): its violation is resolved once the
     values that keep it out no longer hold (leaving the stage resolves it as Not applicable). */
  function settleEntryViolations(){
    const data = dataRef.current;
    esRef.current.prompts.filter(p => p.status === 'pending' && p.kind === 'blockEntry' && (p.payload || {}).existing).forEach(p => {
      const d = getDeal(p.dealId), w = getWorkflow(p.workflowId);
      if(!d || !w || !inContext(w, d)) return;
      const views = workflowTriggerViews(w), held = heldByExisting(w, d, data, actsOf(d.id));
      if(!(triggersMatchAll(w) ? held.length === views.length : held.length > 0)) resolvePrompt(p.id, 'done', 'Values changed · the block no longer applies');
    });
  }
  React.useEffect(() => { settleEntryViolations(); settleAssociatedViolations(); }, [deals, customers, contactViews]);
  function cancelWorkflow(workflowId, reason){
    commit(s => ({...s, runs:s.runs.map(r => r.workflowId !== workflowId ? r
      : r.status === 'waiting' ? {...r, status:'cancelled', reason}
      : {...r, steps:r.steps.map(st => st.status === 'scheduled' ? {...st, status:'cancelled', result:reason} : st)})}));
    esRef.current.runs.filter(r => r.workflowId === workflowId).forEach(r => settleRun(r.id));
    clearProgress(workflowId);
  }
  // All: triggers fired before the workflow was turned off, or before its triggers changed, don't count.
  function clearProgress(workflowId){
    commit(s => ({...s, triggerProgress:Object.fromEntries(Object.entries(s.triggerProgress || {}).filter(([k]) => !k.startsWith(`${workflowId}:`)))}));
  }

  React.useEffect(() => {
    const prev = contactActsSeen.current;
    contactActsSeen.current = contactActivities;
    if(!prev || prev === contactActivities) return;
    Object.entries(contactActivities).forEach(([cid, list]) => {
      const before = prev[cid] || [];
      (list || []).forEach(a => { const was = before.find(x => x.id === a.id); if(was !== a) emitActivity(cid, a, was || null); });
    });
  }, [contactActivities]);

  /* Customer Profile and Accounting change outside the engine (the profile wizard, the Accounting
     tab): each changed value is evaluated on its records — a person's profile on the contact and
     on that contact's deals and customers; payment terms on their record. */
  const liveSeen = React.useRef({profiles, facts:profileFacts, accounting});
  React.useEffect(() => {
    const prev = liveSeen.current;
    liveSeen.current = {profiles, facts:profileFacts, accounting};
    if(prev.profiles !== profiles || prev.facts !== profileFacts){
      const ids = [...new Set([...Object.keys(profiles || {}), ...Object.keys(profileFacts || {}), ...Object.keys(prev.profiles || {}), ...Object.keys(prev.facts || {})])]
        .filter(cid => (profiles || {})[cid] !== (prev.profiles || {})[cid] || (profileFacts || {})[cid] !== (prev.facts || {})[cid]);
      ids.forEach(cid => {
        const was = {profiles:prev.profiles, facts:prev.facts, accounting:prev.accounting};
        const read = (f, live) => { const keep = WF_LIVE; WF_LIVE = live; try { return f.read(Number(cid)); } finally { WF_LIVE = keep; } };
        const changed = PROFILE_TRIGGER_FIELDS().map(f => ({f, from:read(f, was), to:read(f, {profiles, facts:profileFacts, accounting})})).filter(x => String(x.from ?? '') !== String(x.to ?? ''));
        if(!changed.length) return;
        const recs = dealsRef.current.filter(r => String(profileContactId(r)) === String(cid));
        recs.forEach(r => changed.forEach(x => emitScoped(r.id, 'profile', x.f.key, x.from, x.to)));
      });
    }
    if(prev.accounting !== accounting){
      const keyOf = (t) => `${t.object}|${t.recordId}`;
      const keys = [...new Set([...(accounting || []), ...(prev.accounting || [])].map(keyOf))];
      keys.forEach(k => {
        const now = (accounting || []).filter(t => keyOf(t) === k), before = (prev.accounting || []).filter(t => keyOf(t) === k);
        if(now.length === before.length && now.every((t, i) => t === before[i])) return;
        const [object, rid] = k.split('|'), rec = dealsRef.current.find(r => recordObjectOf(r.id) === object && String(r.id) === String(rid));
        if(!rec) return;
        const vals = (list, f) => { const keep = WF_LIVE; WF_LIVE = {...WF_LIVE, accounting:list}; try { return accountingValues(rec, f).join(', '); } finally { WF_LIVE = keep; } };
        ACCOUNTING_TRIGGER_FIELDS.forEach(f => { const a = vals(before, f), b = vals(now, f); if(a !== b) emitScoped(rec.id, 'accounting', f.key, a, b); });
      });
    }
  }, [profiles, profileFacts, accounting]);
  /* Create Customer (a violation on a deal): done once the deal has its customer — created from the
     violation, from the deal's menu or anywhere else — so it's checked whenever records change. */
  React.useEffect(() => {
    esRef.current.prompts.filter(p => p.status === 'pending' && p.kind === 'createRecord' && (p.payload || {}).object === 'customers' && recordObjectOf(p.dealId) === 'deals')
      .forEach(p => { const c = dealCustomer(p.dealId); if(c) resolvePrompt(p.id, 'done', `Customer created · ${c.name || ''} linked to the deal`); });
  }, [records]);
  /* A user's own properties changed (Settings → Users: Country, Language, Designation): the
     records they own see their User Properties change — evaluated like any owner-scope change. */
  const usersSeen = React.useRef(data.users);
  React.useEffect(() => {
    const prev = usersSeen.current;
    usersSeen.current = data.users;
    if(!prev || prev === data.users) return;
    (data.users || []).forEach(u => {
      const was = prev.find(x => x.id === u.id);
      if(!was || was === u) return;
      const before = userPropertiesOf({users:prev}, u.id) || {}, after = userPropertiesOf({users:data.users}, u.id) || {};
      const changed = userPropertyFields(data).filter(f => !samePropertyValue(before[f.key], after[f.key]));
      if(!changed.length) return;
      dealsRef.current.filter(r => r.owner === u.id).forEach(r => changed.forEach(f => emitScoped(r.id, 'owner', f.key, before[f.key], after[f.key])));
    });
  }, [data.users]);
  /* Repeat · Is less than: every decrement below the number (5, 4, 3… for < 6). A count goes down
     when an activity is deleted or changes (a call's outcome, a scheduled email sent, a task done)
     or a quote's status changes — read from each record's activity and quotes before and after the
     change. Counts can't go below zero, so this can't loop. */
  const countAt = (p, deal, snap) => { const keep = WF_LIVE; WF_LIVE = {...WF_LIVE, acts:snap.acts, quotes:snap.quotes};
    try { return countedOf(p, deal, (snap.acts || {})[deal.id] || []).length; } finally { WF_LIVE = keep; } };
  function checkRepeatDecrements(ids, before, after){
    const views = (dataRef.current.workflows || []).map(normalizeWorkflow).filter(w => w.active !== false && w.context && w.context.object)
      .flatMap(w => workflowTriggerViews(w).map(v => ({w, v, c:v.triggerConfig || {}, p:activityTriggerProperty(v.trigger, (v.triggerConfig || {}).activityProperty)})))
      .filter(x => x.p && x.p.counts && !x.p.each && !x.p.template && x.c.repeat && x.c.op === 'lt' && countConditionComplete(x.c));
    if(!views.length) return;
    ids.forEach(id => {
      const deal = getDeal(id);
      if(!deal) return;
      views.forEach(({w, v, c, p}) => {
        if(recordObjectOf(deal.id) !== w.context.object || !inContext(v, deal) || !inTriggerScope(v, deal)) return;
        const n0 = countAt(p, deal, before), n1 = countAt(p, deal, after);
        if(n1 < n0 && n1 < Number(c.value)) fire(w, [v], deal, () => baseRun(v, deal, {chain:{id:wfNewId('ch'), depth:0, visited:[]}, previousStage:null, change:null}));
      });
    });
  }
  const repeatSeen = React.useRef({acts:recordActs, quotes});
  React.useEffect(() => {
    const prev = repeatSeen.current, next = {acts:recordActs, quotes};
    repeatSeen.current = next;
    if(prev.acts === next.acts && prev.quotes === next.quotes) return;
    const ids = new Set();
    if(prev.acts !== next.acts) new Set([...Object.keys(prev.acts || {}), ...Object.keys(next.acts || {})]).forEach(k => { if((prev.acts || {})[k] !== (next.acts || {})[k]) ids.add(k); });
    if(prev.quotes !== next.quotes){
      const was = new Map((prev.quotes || []).map(q => [q.id, q])), now = new Map((next.quotes || []).map(q => [q.id, q]));
      new Set([...was.keys(), ...now.keys()]).forEach(qid => { if(was.get(qid) !== now.get(qid)) ids.add(String((now.get(qid) || was.get(qid)).recordId)); });
    }
    // A contact's calls count on its deals and customers too (Number of Total Calls).
    if(ids.size) dealsRef.current.forEach(d => { if(d.contactId != null && ids.has(String(d.contactId))) ids.add(d.id); });
    if(ids.size) checkRepeatDecrements([...ids], prev, next);
  }, [recordActs, quotes]);
  /* Quote events (Quote Sent / Signed): from the quotes list. */
  const quotesSeen = React.useRef(quotes);
  React.useEffect(() => {
    const prev = quotesSeen.current;
    quotesSeen.current = quotes;
    if(!prev || prev === quotes) return;
    (quotes || []).forEach(q => {
      const was = prev.find(x => x.id === q.id);
      if(was === q) return;
      const rid = q.object === 'contacts' ? String(q.recordId) : q.recordId, rec = getDeal(rid);
      if(!rec) return;
      const fireQ = (type) => emit({type, recordId:rec.id, pipelineId:rec.pipeline, attrs:{quoteId:q.id}});
      // Sent: once it's sent (or signed without being sent first); Signed: once it's signed.
      const sentNow = (x) => !!x && (x.status === 'sent' || x.status === 'signed');
      if(sentNow(q) && !sentNow(was)) fireQ('quoteSent');
      if(q.status === 'signed' && (!was || was.status !== 'signed')) fireQ('quoteSigned');
    });
  }, [quotes]);

  // Saved with everything else (store.jsx). Workflows, pipelines and templates are Settings (App saves them).
  React.useEffect(() => { persistSlice('deals', deals); }, [deals]);
  React.useEffect(() => { persistSlice('dealActivities', dealActivities); }, [dealActivities]);
  React.useEffect(() => { persistSlice('engine', es); }, [es]);

  /* Activity a person adds or changes on a deal goes through here: saved, then evaluated by
     workflows exactly like the engine's own activity — the same events, per type. A deal workflow
     counts the deal's activity only (not its contact's). */
  const activityEvents = (a, prev) => {
    const ev = [];
    if(a.type === 'note' && !prev) ev.push({type:'noteAdded'});
    if(a.type === 'call' && (!prev || prev.outcome !== a.outcome)) ev.push({type:'callLogged', attrs:{outcome:a.outcome, logged:!!a.logged, added:!prev}});
    // Call Made: a call through the dialer (not a log of one made elsewhere).
    if(a.type === 'call' && !prev && !a.logged) ev.push({type:'callMade', attrs:{outcome:a.outcome}});
    if(a.type === 'file' && !prev) ev.push({type:'fileAdded', attrs:{direction: a.origin === 'received' ? 'received' : 'sent'}});
    if(a.type === 'task'){
      if(!prev) ev.push({type:'taskCreated', attrs:{taskType:a.taskType, assignee:a.assignee}});
      if(a.status === 'completed' && (!prev || prev.status !== 'completed')) ev.push({type:'taskCompleted'});
    }
    if(a.type === 'meeting' && !prev) ev.push({type:'meetingScheduled', attrs:{at:meetingTime(a), platform:a.platform}});
    if(a.type === 'email' && !prev) ev.push({type: a.direction === 'received' ? 'emailReceived' : a.status === 'scheduled' ? 'emailScheduled' : 'emailSent', attrs:{templateId:a.templateId || null}});
    return ev;
  };
  const emitActivity = (dealId, a, prev) => {
    const deal = getDeal(dealId);
    activityEvents(a, prev).forEach(e => emit({type:e.type, recordId:dealId, pipelineId:deal && deal.pipeline, attrs:{activityId:a.id, ...(e.attrs || {})}}));
  };
  function addDealActivity(dealId, act){
    // Added by a person in the app: who added it (the signed-in person).
    const a = {id:`${act.type}-${dealId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...recordKey(dealId), at:new Date(), ...act, ...(act.source === 'you' && !act.by ? {by:CURRENT_USER.name} : {})};
    editActivities(m => ({...m, [dealId]:[a, ...(m[dealId] || [])]}));
    emitActivity(dealId, a, null);
    return a;
  }
  function updateDealActivity(actId, patch){
    const entry = Object.entries(actsRef.current).find(([, list]) => (list || []).some(a => a.id === actId));
    if(!entry) return;
    const [dealId, list] = entry, prev = list.find(a => a.id === actId);
    patchActivity(dealId, actId, patch);
    emitActivity(dealId, {...prev, ...patch}, prev);
  }

  // Deleting a record's activity (Tools pages, a record's Files and Notes): it's gone from its record.
  function deleteRecordActivity(actId){
    const entry = Object.entries(actsRef.current).find(([, list]) => (list || []).some(a => a.id === actId));
    if(!entry) return;
    editActivities(m => ({...m, [entry[0]]:(m[entry[0]] || []).filter(a => a.id !== actId)}));
  }

  const api = {
    addDealActivity, updateDealActivity, deleteRecordActivity,
    /* Remedies (a workflow's guide): a new associated record, linked to the record — as Create
       Associated Record does, by a person; an existing one linked (a deal's or customer's contact, a
       customer's deal). The workflows then check their conditions again. */
    createAssociated: (recordId, object, values) => { const rec = getDeal(recordId); return rec ? createLinkedRecord(rec, object, values, {chain:{id:wfNewId('ch'), depth:0, visited:[], byPerson:true}}) : null; },
    associateExisting: (recordId, otherId) => {
      const a = getDeal(recordId), b = dealsRef.current.find(r => String(r.id) === String(otherId));
      if(!a || !b || recordsLinked(a, b)) return;
      const [x, y] = [a, b].sort((p, q) => recordObjectOf(p.id) < recordObjectOf(q.id) ? -1 : 1);   // contacts < customers < deals
      const target = recordObjectOf(x.id) === 'contacts' ? y : x;
      const patch = recordObjectOf(x.id) === 'contacts' ? {contactId:Number(x.id)} : {dealIds:[y.id]};
      setDealsTracked(rs => rs.map(r => r.id === target.id ? {...r, ...patch} : r));
    },
    /* A blocked move kept pending on the record: what still keeps it out (each workflow and its
       triggers that hold), completing it, or dropping it. */
    blockersFor: (recordId) => {
      const pm = (esRef.current.pendingMoves || {})[recordId], d = getDeal(recordId);
      if(!pm || !d) return null;
      return entryBlockers(d, {...d, stage:pm.toStage, pipeline:pm.toPipeline || d.pipeline}).map(b => ({workflowId:b.w.id, name:b.w.name || workflowTitle(dataRef.current, b.w), held:b.held.map(v => v.triggerId)}));
    },
    resumeMove: (recordId) => {
      const pm = (esRef.current.pendingMoves || {})[recordId];
      if(!pm) return null;
      return setDealsTracked(rs => rs.map(r => r.id === recordId ? {...r, stage:pm.toStage, ...(pm.toPipeline ? {pipeline:pm.toPipeline} : {})} : r));
    },
    dismissMove: (recordId) => commit(s => ({...s, pendingMoves:Object.fromEntries(Object.entries(s.pendingMoves || {}).filter(([id]) => id !== String(recordId)))})),
    // A form submission that created (or matched) a record: Form Submitted.
    /* Enroll in Email Sequence outside a workflow (a table's Bulk Actions): the sequence's emails
       scheduled for the record from now — as the workflow action does (same emails, same sequence,
       so Exit Email Sequence ends them). False without the record, the sequence or an email address. */
    enrollInSequence: (recordId, sequenceId) => {
      const deal = getDeal(recordId), seq = emailSequencesOf(dataRef.current).find(q => q.id === sequenceId);
      if(!deal || !seq || !String(deal.email || '').trim()) return false;
      const emails = seq.emails.map((e, i) => ({id:`se-${i}`, immediate:!(Number((e.delay || {}).amount) > 0), recipients:['recordEmail'], templateId:e.templateId, email:null,
        sequenceId:seq.id, schedule:{amount:'', unit:'Days', time:'', ...(e.delay || {})}}));
      sendEmails(deal, emails, {chain:{id:wfNewId('ch'), depth:0, visited:[]}}, null);
      return true;
    },
    // A form submission about to create its record (forms.jsx submitFormValues): seen by workflows as the record is created.
    beginFormSubmission: (form, submission) => { WF_FORM_PENDING = {form, submission}; },
    formSubmitted: (object, recordId, formId, submission) => {
      const pending = WF_FORM_PENDING; WF_FORM_PENDING = null;
      if(pending && submission) WF_FORM_SUBS.set(`${object}:${recordId}`, {form:pending.form, submission});
      const rid = object === 'contacts' ? String(recordId) : recordId, rec = getDeal(rid);
      if(rec) emit({type:'formSubmitted', recordId:rec.id, pipelineId:rec.pipeline, attrs:{formId, via:(submission || {}).via || null, submissionId:(submission || {}).id || null}});
    },
    runNow: (runId, stepId) => {
      const r = getRun(runId);
      if(!r) return;
      if(r.status === 'waiting') return checkStay(runId);
      patchRun(runId, x => ({...x, steps:x.steps.map(s => s.id === stepId ? {...s, dueAt:Date.now()} : s)}));
      executeStep(runId, stepId, true);
    },
    retry: (runId, stepId) => { patchRun(runId, x => ({...x, steps:x.steps.map(s => s.id === stepId ? {...s, status:'scheduled', result:null, dueAt:Date.now()} : s)})); executeStep(runId, stepId, true); },
    cancelRun: (runId) => {
      const r = getRun(runId);
      if(r && r.status === 'waiting') return patchRun(runId, x => ({...x, status:'cancelled', reason:'Cancelled by you'}));
      patchRun(runId, x => ({...x, steps:x.steps.map(s => s.status === 'scheduled' ? {...s, status:'cancelled', result:'Cancelled by you'} : s)}));
      settleRun(runId);
    },
    // A violation can't be dismissed: it's resolved, or ends when its record leaves its stage.
    completePrompt,
    /* A violation's watched property confirmed unchanged by the client: the value stays, and the
       violation is cleared — as changing the property would — with the confirmation recorded. */
    confirmUnchanged: (id, key) => {
      const p = esRef.current.prompts.find(x => x.id === id), deal = p && getDeal(p.dealId);
      if(!p || !deal) return;
      const label = (recordProps(deal).find(x => x.key === key) || {}).label || 'Value';
      withEffects(p.runId, p.stepId, () => resolvePrompt(id, 'cleared', `${label} confirmed unchanged by client · ${CURRENT_USER.name}`));
      api.confirmPropertySame(deal.id, key);
    },
    /* The client communicated the same value: an update of the property with its value unchanged —
       every workflow watching it sees it as changed (its last change is now; Property Update events),
       recorded on the record's activity. */
    confirmPropertySame: (recordId, key) => {
      const d = getDeal(recordId);
      if(!d) return;
      const now = Date.now(), label = (recordProps(d).find(x => x.key === key) || {}).label || 'Value';
      setDealsTracked(rs => rs.map(r => r.id === recordId ? {...r, changedAt:{...(r.changedAt || {}), [key]:now}} : r));
      const outer = batchRef.current; batchRef.current = wfNewId('b');
      emit({type: isBlank(d[key]) ? 'propertyCreated' : 'propertyUpdated', recordId, pipelineId:d.pipeline, attrs:{property:key, from:d[key] ?? '', to:d[key] ?? '', confirmed:true}});
      batchRef.current = outer;
      addActivity(recordId, {id:wfNewId('cf'), ...recordKey(recordId), type:'workflow', at:new Date(now), title:`${label} confirmed unchanged by client · ${CURRENT_USER.name}`, body:'', by:CURRENT_USER.name, source:'you'});
    },
    markRead: (userId) => commit(s => ({...s, notifications:s.notifications.map(n => n.userId === userId ? {...n, read:true} : n)})),
  };
  // `openEvent`: an Automatic Action card to show (a blocked move, or one opened from its toast / the bell).
  const [openEvent, setOpenEvent] = React.useState(null);
  // `deals`: every record workflows run on (contacts, deals and customers), by id.
  const value = {state:es, data, deals:records, activities:recordActs, api, openPrompt, openEvent:setOpenEvent, currentUserId:currentUserId(data), setDeals:setDealsTracked, violationMode, setViolationMode,
    violationFocus, openViolation:(object, id) => { setViolationMode(object); setViolationFocus({id, nonce:Date.now()}); },
    recordFocus, focusRecord:(id) => setRecordFocus(id == null ? null : {id:String(id), nonce:Date.now()})};
  return {value, setDeals:setRecordsOf('deals'), setCustomers:setRecordsOf('customers'), setContacts:setRecordsOf('contacts'), openPromptId, promptDirect, closePrompt:() => setOpenPromptId(null), notices, dismissNotice:(id) => setNotices(ns => ns.filter(n => n.id !== id)),
    event:openEvent, closeEvent:() => setOpenEvent(null)};
}

/* ── Status vocabulary ── */
const WF_TONES = {
  success:{color:'#027A48', bg:'#ECFDF3'}, danger:{color:T.red, bg:'#FEF3F2'}, info:{color:T.blue, bg:T.blueLight},
  warn:{color:'#B54708', bg:'#FFFAEB'}, neutral:{color:T.gray600, bg:T.headerBg},
};
const RUN_STATUS = {
  waiting:{label:'Waiting', tone:'info'}, running:{label:'Scheduled', tone:'info'}, awaiting:{label:'Awaiting user', tone:'warn'},
  completed:{label:'Completed', tone:'success'}, failed:{label:'Failed', tone:'danger'}, notRun:{label:'Not run', tone:'neutral'}, notApplicable:{label:'Not applicable', tone:'neutral'},
  loopPrevented:{label:'Loop prevented', tone:'warn'}, cancelled:{label:'Cancelled', tone:'neutral'},
};
const STEP_STATUS = {
  scheduled:{label:'Scheduled', tone:'info'}, done:{label:'Done', tone:'success'}, prompted:{label:'Prompted', tone:'warn'}, dismissed:{label:'Dismissed', tone:'neutral'},
  skipped:{label:'Skipped', tone:'neutral'}, failed:{label:'Failed', tone:'danger'}, cancelled:{label:'Cancelled', tone:'neutral'}, notApplicable:{label:'Not applicable', tone:'neutral'},
};
function StatusPill({status, map}){
  const s = map[status] || {label:status, tone:'neutral'}, t = WF_TONES[s.tone];
  return <span style={{display:'inline-flex', alignItems:'center', height:20, padding:'0 8px', borderRadius:9999, fontSize:11.5, fontWeight:500, whiteSpace:'nowrap', color:t.color, background:t.bg}}>{s.label}</span>;
}
const fmtWhen = (t) => new Date(t).toLocaleString('en-US', {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'});

/* ── Conditions editor (trigger side panel) ── Filters-style rows — [field] then [operator]
   [value] — with one All / Any switch for the whole list. */
/* The value control for a field and operator (none when the operator takes no value). */
function conditionValueControl(f, op, value, onChange){
  if(!f || !op || op.noValue) return null;
  // A property: the value its type and the operator call for (propertyTypes.jsx).
  const p = !f.has && fieldProperty(f);
  if(p && propertyOperators(p).some(o => o.id === op.id)) return <ConditionValueInput compact prop={p} op={op} value={value} onChange={onChange} options={f.options}/>;
  const smallInput = {...fieldInput, padding:'7px 10px'};
  if(f.kind === 'select' || f.kind === 'choice') return <FormSelect value={value || ''} placeholder="Select…" options={f.options} onChange={onChange}/>;
  if(f.kind === 'date') return <DateField value={value || ''} onChange={onChange} inputStyle={smallInput}/>;
  return <input type={['text', 'find'].includes(f.kind) ? 'text' : 'number'} value={value || ''} onChange={e=>onChange(e.target.value)} placeholder="Value" style={smallInput}/>;
}
/* Property Update's mandatory condition: the operators of the chosen property's type, then its value. */
/* Is changed / Is not changed take a duration instead of a value — For (not changed) / Within
   (changed) N Days, Weeks or Months — and, when the context has a stage, In this stage, which
   replaces the duration (it's disabled while ticked). */
/* `property` ({label, control}): the property's own field, in one row with the condition (the
   value, where the condition takes one, below them); before a property is chosen the condition
   shows, empty and unavailable. Without it (a Property context), the condition and value share the row. */
function TriggerPropertyCondition({data, workflow, onChange, property}){
  const c = workflow.triggerConfig || {};
  const f = conditionFields(data, workflow).find(x => x.key === `prop:${c.property}`);
  const pairRow = (condition) => (
    <div style={{display:'flex', gap:8}}>
      <div style={{flex:'1 1 0', minWidth:0}}>{cfgField(property.label, property.control)}</div>
      <div style={{flex:'1 1 0', minWidth:0}}>{cfgField('Condition', condition)}</div>
    </div>
  );
  if(!f) return property ? pairRow(
    <div aria-disabled="true" inert="" style={{opacity:.5, pointerEvents:'none'}}><FormSelect value="" placeholder="Operator" options={[]} onChange={()=>{}}/></div>) : null;
  const kindOps = fieldOperators(f);
  const legacy = !kindOps.some(o => o.id === c.op) && triggerPropertyOperators(f.kind).find(o => o.id === c.op);
  const ops = legacy ? [...kindOps, legacy] : kindOps;
  const op = ops.find(o => o.id === c.op);
  const hasStage = !!((workflow.context || {}).pipeline && (workflow.context || {}).stage);
  const inStage = hasStage && !!c.inStage;
  const operator = <FormSelect value={c.op || ''} placeholder="Operator" options={ops.map(o => ({value:o.id, label:o.label}))}
    onChange={(v)=>onChange({op:v, value: kindOps.some(o => o.id === v && !o.noValue && !o.change) && op && !op.noValue && !op.change ? c.value ?? '' : ''})}/>;
  const valueControl = op && !op.change && conditionValueControl(f, op, c.value, (v)=>onChange({value:v}));
  return (<>
    {property ? (<>
      {pairRow(operator)}
      {valueControl && cfgField('Value', valueControl)}
    </>) : cfgField('Condition', (
      <div style={{display:'flex', gap:8}}>
        <div style={{flex:'1 1 0', minWidth:0}}>{operator}</div>
        <div style={{flex:'1 1 0', minWidth:0}}>{valueControl}</div>
      </div>
    ))}
    {op && op.change && <WhenField config={c} context={workflow.context} onChange={onChange}/>}
  </>);
}
/* `embedded`: additional conditions inside the trigger section (Property Update) — no heading or helper. */
function ConditionsEditor({value, onChange, data, workflow, embedded}){
  const cond = {match:'all', rules:[], ...value};
  const fields = conditionFields(data, workflow);
  const groups = [...new Set(fields.map(f => f.group))].map(g => ({group:g, options:fields.filter(f => f.group === g).map(f => ({value:f.key, label:f.label}))}));
  const set = (patch) => onChange({...cond, ...patch});
  const setRule = (id, patch) => set({rules:cond.rules.map(r => r.id === id ? {...r, ...patch} : r)});
  const join = cond.match === 'any' ? 'OR' : 'AND';
  return (
    <div style={{display:'flex', flexDirection:'column', gap:10}}>
      <div style={{display:'flex', alignItems:'center', gap:8}}>
        <span style={{flex:1, fontSize:12.5, fontWeight: embedded ? 400 : 600, color: embedded ? T.gray600 : T.gray800}}>{embedded ? (cond.rules.length ? 'Additional conditions' : '') : 'Conditions'}</span>
        {cond.rules.length > 1 && (
          <div style={{display:'inline-flex', border:`1px solid ${T.borderStrong}`, borderRadius:8, overflow:'hidden', background:'#fff'}} role="radiogroup" aria-label="Match">
            {[['all', 'All'], ['any', 'Any']].map(([k, l]) => (
              <button key={k} role="radio" aria-checked={cond.match === k} onClick={()=>set({match:k})} style={{border:'none', cursor:'pointer', padding:'4px 12px', fontSize:12, fontWeight:600,
                fontFamily:'inherit', background: cond.match === k ? T.attioBlue : 'transparent', color: cond.match === k ? '#fff' : T.gray600}}>{l}</button>
            ))}
          </div>
        )}
      </div>
      {/* Property Update already has its own condition, so its Conditions are additional. */}
      {!cond.rules.length && !embedded && ((workflowTrigger(workflow && workflow.trigger) || {}).requiresCondition
        ? <div style={stTextB}>Add additional conditions to run this workflow only when those conditions are met.</div>
        : <div style={stTextB}>Additional conditions to run this workflow only when specific criteria are met.</div>)}
      {cond.rules.map((r, i) => {
        const f = fields.find(x => x.key === r.field);
        const ops = f ? fieldOperators(f, {withChange:false}) : [];
        const op = ops.find(o => o.id === r.op);
        const valueField = conditionValueControl(f, op, r.value, (v)=>setRule(r.id, {value:v}));
        return (
          <React.Fragment key={r.id}>
            {i > 0 && <span style={{fontSize:11.5, fontWeight:600, letterSpacing:.3, color:T.gray400}}>{join}</span>}
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              <div style={{display:'flex', alignItems:'center', gap:6}}>
                <div style={{flex:1, minWidth:0}}><FormSelect value={r.field || ''} placeholder="Select a field" options={groups}
                  onChange={(v)=>setRule(r.id, {field:v, op:(fieldOperators(fields.find(x => x.key === v), {withChange:false})[0] || {}).id || '', value:''})}/></div>
                <button title="Remove condition" onClick={()=>set({rules:cond.rules.filter(x => x.id !== r.id)})}
                  style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:4, flexShrink:0}}><Icon name="close" size={13} color={T.gray600}/></button>
              </div>
              {f && (
                <div style={{display:'flex', gap:8, paddingRight:26}}>
                  <div style={{flex:'1 1 0', minWidth:0}}><FormSelect value={r.op || ''} placeholder="Operator" options={ops.map(o => ({value:o.id, label:o.label}))} onChange={(v)=>setRule(r.id, {op:v, value:''})}/></div>
                  <div style={{flex:'1 1 0', minWidth:0}}>{valueField}</div>
                </div>
              )}
            </div>
          </React.Fragment>
        );
      })}
      <div>
        <button onClick={()=>set({rules:[...cond.rules, {id:wfNewId('cr'), field:'', op:'', value:''}]})} style={toolbarButton}>
          <Icon name="plus" size={13} color={T.gray600}/> Add Condition
        </button>
      </div>
    </div>
  );
}

/* ── Runs (workflow panel → Runs tab) ── */
function WorkflowRuns({workflowId}){
  const ctx = useWorkflowEngineCtx();
  const [open, setOpen] = React.useState(null);
  if(!ctx) return null;
  const runs = ctx.state.runs.filter(r => r.workflowId === workflowId);
  if(!runs.length) return <div style={{padding:'40px 24px', textAlign:'center', fontSize:13, color:T.gray400}}>No runs yet</div>;
  const btn = (label, onClick) => <StTextAction label={label} onClick={onClick}/>;
  return (
    <div style={{padding:'8px 24px 24px', maxWidth:880, margin:'0 auto'}}>
      {runs.map((r, i) => {
        const on = open === r.id;
        return (
          <div key={r.id} style={{borderTop: i ? `1px solid ${T.border}` : 'none'}}>
            <div onClick={()=>setOpen(on ? null : r.id)} style={{display:'flex', alignItems:'center', gap:12, padding:'12px 4px', cursor:'pointer'}}>
              <Icon name="chevDown" size={12} color={T.gray600} style={{transform: on ? 'none' : 'rotate(-90deg)', transition:'transform 120ms'}}/>
              <span style={{flex:1, minWidth:0, fontSize:13.5, fontWeight:500, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{r.dealName}</span>
              <span style={{fontSize:12, color:T.gray600, whiteSpace:'nowrap'}}>{r.status === 'waiting' ? `Checks ${fmtWhen(r.checkAt)}` : fmtWhen(r.startedAt || r.createdAt)}</span>
              <span style={{fontSize:12, color:T.gray400, whiteSpace:'nowrap'}}>v{r.version}</span>
              <StatusPill status={r.status} map={RUN_STATUS}/>
            </div>
            {on && (
              <div style={{padding:'0 4px 14px 28px', display:'flex', flexDirection:'column', gap:8}}>
                {r.reason && <div style={stTextB}>{r.reason}</div>}
                {r.status === 'waiting' && <div style={{display:'flex', gap:16}}>{btn('Run now', ()=>ctx.api.runNow(r.id))}{btn('Cancel', ()=>ctx.api.cancelRun(r.id))}</div>}
                {r.steps.map(s => (
                  <div key={s.id} style={{display:'flex', alignItems:'flex-start', gap:10, padding:'8px 10px', border:`1px solid ${T.border}`, borderRadius:8}}>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:13, fontWeight:500, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}} title={s.summary || s.label}>{s.summary || s.label}</div>
                      <div style={{fontSize:12, color:T.gray600, marginTop:2}}>{s.status === 'scheduled' ? `Due ${fmtWhen(s.dueAt)}` : s.result || ''}</div>
                    </div>
                    {s.status === 'scheduled' && btn('Run now', ()=>ctx.api.runNow(r.id, s.id))}
                    {s.status === 'failed' && btn('Retry', ()=>ctx.api.retry(r.id, s.id))}
                    <StatusPill status={s.status} map={STEP_STATUS}/>
                  </div>
                ))}
                {r.steps.some(s => s.status === 'scheduled') && <div>{btn('Cancel scheduled steps', ()=>ctx.api.cancelRun(r.id))}</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Workflow events: what a card shows (Violation, Automatic Action) ──
   For any workflow, from its definition — so workflows added later get the same cards:
     context  — where it applies: Object / Property / Pipeline / Stage ("Deals / US NIW / Expected Sale");
     expected — what keeps the workflow from triggering: each trigger's condition turned around
                (Close Date is not changed → "Change close date in this stage"; Stay at Stage 20 days
                → "Stay at stage < 20 days"). With All, any one of them is enough ("Or"); with Any,
                every one is needed ("And");
     current  — each trigger's state on the record now ("Stay at stage = 42 days"). */
const sentence = (t) => t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : '';
const workflowContextPath = (data, w) => {
  const ctx = (w && w.context) || {};
  const parts = WORKFLOW_CONTEXT_LEVELS.filter(k => ctx[k]).map(k => workflowContextLabel(data, k, ctx)).filter(Boolean);
  return parts.length ? parts.join(' / ') : 'Company-wide';
};
// A stored value as it reads on the record (stage and pipeline names, user names, numbers with separators).
const recordValueText = (data, deal, prop, v) => {
  if(v === undefined || v === null || String(v).trim() === '') return '';
  if(prop.type === 'Pipeline stage') return stageLabelOf(data, deal.pipeline, v);
  if(prop.type === 'Pipeline') return ((pipelineById2(data, v) || {}).label) || v;
  if(prop.type === 'User') return userName(data, v) || userLabel(v);
  if(prop.type === 'Number') return Number(v).toLocaleString('en-US');
  return String(v);
};
// A condition's turned-around operator: Greater than → ≤, Is → is not, Is after → is on or before, …
const NEGATED_OPS = {
  number:{equals:'≠', notEquals:'=', gt:'≤', lt:'≥', isEmpty:'is not empty', isNotEmpty:'is empty'},
  count:{equals:'≠', gt:'≤', lt:'≥', gte:'<'},
  date:{gt:'is on or before', lt:'is on or after', isEmpty:'is not empty', isNotEmpty:'is empty'},
  text:{equals:'is not', notEquals:'is', contains:'doesn’t contain', notContains:'contains', isEmpty:'is not empty', isNotEmpty:'is empty'},
  select:{equals:'is not', notEquals:'is', isEmpty:'is not empty', isNotEmpty:'is empty'},
  choice:{equals:'is not', notEquals:'is'},
};
const unitWord = (n, unit) => `${n} ${String(unit || 'Days').toLowerCase().replace(/s$/, '')}${Number(n) === 1 ? '' : 's'}`;
// `attempt`: the deal tried to enter the stage and was kept out (Block Entry).
function triggerExpectation(data, v, deal, acts, attempt){
  const c = v.triggerConfig || {}, now = Date.now();
  const stage = workflowStage(v), stageName = stage ? stageLabelOf(data, workflowPipeline(v), stage) : '';
  if(v.trigger === 'propertyUpdate'){
    const f = conditionFields(data, v).find(x => x.key === `prop:${c.property}`);
    const prop = objectProperties(data, recordObjectOf(deal.id)).find(x => x.key === c.property);
    if(!f || !prop) return null;
    const L = sentence(f.label), l = f.label.toLowerCase();
    const changedAt = (deal.changedAt || {})[c.property] || 0;
    const days = (since) => Math.max(0, Math.floor((now - since) / WF_DAY));
    if(c.when === 'lifecycle') return c.op === 'notChanged' ? {expected:`Change ${l} at some point`, current:`${L} has never been changed`} : {expected:'—', current:`${L} is changed`};
    if(c.op === 'notChanged') return c.inStage
      ? {expected:`Change ${l} in this stage`, current:`${L} is not changed yet`}
      : {expected:`Change ${l} within ${unitWord(c.changeAmount, c.changeUnit)}`, current:`${L} not changed for ${unitWord(days(Math.max(changedAt, contextEnteredAt(v, deal))), 'Days')}`};
    if(c.op === 'changed') return c.inStage
      ? {expected:`${L} stays unchanged in this stage`, current:`${L} is changed`}
      : {expected:`${L} not changed within ${unitWord(c.changeAmount, c.changeUnit)}`, current:`${L} is changed`};
    const op = (NEGATED_OPS[f.kind] || {})[c.op];
    const actual = recordValueText(data, deal, prop, deal[c.property]);
    const shown = f.options && f.options.length ? ((f.options.find(o => o.value === c.value) || {}).label || c.value)
      : f.kind === 'number' && c.value !== '' ? Number(c.value).toLocaleString('en-US')
      : f.kind === 'date' && c.value ? new Date(`${c.value}T00:00`).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}) : c.value;
    const opDef = fieldOperatorOf(f, c.op) || {};
    return {expected: op ? `${L} ${op}${opDef.noValue ? '' : ` ${shown}`}` : '',
      current: actual ? `${L} ${['number', 'count'].includes(f.kind) ? '=' : 'is'} ${actual}` : `${L} is empty`};
  }
  if(v.trigger === 'stayAtStage'){
    const unitMs = WF_UNIT_MS[c.unit] || WF_DAY;
    const inStage = deal.stage === stage && deal.stageEnteredAt ? Math.floor((now - deal.stageEnteredAt) / unitMs) : 0;
    return {expected:`Stay at stage < ${unitWord(c.amount, c.unit)}`, current:`Stay at stage = ${unitWord(inStage, c.unit)}`};
  }
  if(v.trigger === 'stageEntryForward' || v.trigger === 'stageEntryBackward'){
    const dir = v.trigger === 'stageEntryForward' ? 'forward' : 'backward';
    return {expected:`Not entering “${stageName}” moving ${dir}`, current:`${attempt ? 'Tried to enter' : 'Entered'} “${stageName}” moving ${dir}`};
  }
  if(v.trigger === 'stageExit') return {expected:`Stay in “${stageName}”`, current:`Left “${stageName}”`};
  if(v.trigger === 'recordCreated') return {expected:'—', current:'Record created'};
  if(v.trigger === 'associatedRecord'){
    const x = objectName(data, c.associatedObject || '').replace(/s$/, ''), when = whenPhrase(c, v.context) || '';
    if(c.assocParam === 'notCreated') return {expected:`Associated ${x} created ${when}`, current:`No associated ${x}`};
    if(c.assocParam === 'notChanged') return {expected:`Associated ${x} changed ${when}`, current:`Associated ${x} not changed`};
    return {expected:'—', current:`Associated ${x} ${c.assocParam === 'changed' ? 'changed' : 'created'}`};
  }
  if(v.trigger === 'recordUpdated') return {expected:'—', current:'Record updated'};
  const p = activityTriggerProperty(v.trigger, c.activityProperty);
  if(p){
    if(p.template){
      const tpl = emailTemplatesOf(data).find(t => t.id === c.template) || {};
      return {expected:`Email “${tpl.name || 'template'}” not ${p.template}`, current:`Email “${tpl.name || 'template'}” ${p.template}`};
    }
    const n = countedOf(p, deal, acts).length, noun = `Number of ${p.noun}`.toLowerCase();
    const N = sentence(noun);
    if(c.repeat && !countConditionComplete(c)) return {expected:`No new ${p.noun.toLowerCase()}`, current:`${N} = ${n}`};
    const op = NEGATED_OPS.count[c.op];
    return {expected: op ? `${N} ${op} ${Number(c.value)}` : '', current:`${N} = ${n}`};
  }
  return null;
}
/* ── Evaluation trace ── how a workflow evaluated a record when it ran, kept on the run (and its
   events) so a card explains what happened then, not what's true now: the context; each trigger
   with the value it was checked against (`param`), its result (`status`: 'true' | 'false' |
   'earlier' — All: counted when it fired, not true any more) and what a person could change about
   it (`remedies`); how they combine (`match`: 'all' AND / 'any' OR); the stage move involved.
   Trigger kinds that are events (a stage entry, an email sent) are true when they fired. */
const ACTIVITY_REMEDIES = {
  callEvents:{'*':['call', 'callTask', 'email']},
  emailEvents:{sentEmails:['email', 'emailTask']},
  meetingEvents:{scheduledMeetings:['meeting'], completedMeetings:['meeting']},
  taskEvents:{createdTasks:['task'], completedTasks:['completeTask']},
  noteEvents:{notes:['note']},
};
function traceCondition(data, v, deal, acts, counted, move){
  const t = workflowTrigger(v.trigger) || {label:v.trigger, icon:'workflows'};
  const c = v.triggerConfig || {}, now = Date.now();
  const stageName = (id) => stageLabelOf(data, (move && move.pipeline) || workflowPipeline(v) || deal.pipeline, id);
  let param = null, holds = null, remedies = [];
  if(v.trigger === 'propertyUpdate' && scopeOf(c) !== 'record'){
    const sf = (scopeFields(data, scopeOf(c)) || []).find(x => x.key === `prop:${c.property}`);
    if(sf){
      if(isChangeOp(c.op)){
        param = {key:`changed:${scopedPropertyKey(c)}`, label:`${sf.label} last changed`, value:'—'};
      } else {
        const val = sf.many ? sf.many({data, deal}).join(', ') : String(sf.get({data, deal}) ?? '');
        param = {key:`prop:${scopedPropertyKey(c)}`, label:sf.label, value:val || 'Empty'};
        holds = triggerConditionHolds(data, v, deal);
      }
    }
  } else if(v.trigger === 'propertyUpdate'){
    const prop = objectProperties(data, recordObjectOf(deal.id)).find(x => x.key === c.property);
    if(prop){
      if(isChangeOp(c.op)){
        const at = (deal.changedAt || {})[c.property] || 0;
        param = {key:`changed:${prop.key}`, label:`${prop.label} last changed`, value: at ? fmtWhen(at) : 'never'};
        const since = deal.stageEnteredAt || 0, ms = wfDurationMs(changeDuration(c)), life = c.when === 'lifecycle';
        holds = c.op === 'notChanged' ? (life ? !at : c.inStage ? at < since : now - Math.max(at, contextEnteredAt(v, deal)) >= ms)
          : (life ? at > 0 : c.inStage ? at >= since && at > 0 : at > 0 && now - at <= ms);
      } else {
        param = {key:`prop:${prop.key}`, label:prop.label, value:recordValueText(data, deal, prop, deal[prop.key]) || 'Empty'};
        holds = triggerConditionHolds(data, v, deal);
      }
      if(!prop.auto && !['Pipeline', 'Pipeline stage'].includes(prop.type)) remedies = [{kind:'property', property:prop.key, label:prop.label, confirmable:isChangeOp(c.op)}];
    }
  } else if(v.trigger === 'stayAtStage'){
    const stage = workflowStage(v), inIt = deal.stage === stage && !!deal.stageEnteredAt;
    const n = inIt ? Math.floor((now - deal.stageEnteredAt) / (WF_UNIT_MS[c.unit] || WF_DAY)) : 0;
    param = {key:`stay:${stage}`, label:`Time in \u201c${stageName(stage)}\u201d`, value: inIt ? unitWord(n, c.unit) : 'Not in this stage'};
    holds = inIt && now - deal.stageEnteredAt >= wfDurationMs(c);
    remedies = [{kind:'stage'}];
  } else if(v.trigger === 'associatedRecord' && c.associatedObject){
    const x = objectName(data, c.associatedObject).replace(/s$/, ''), linked = associatedRecordsOf(deal, c.associatedObject, WF_LIVE.records || []);
    param = {key:`assoc:${c.associatedObject}`, label:`Associated ${x}`, value: linked.length ? linked.map(r => r.name).filter(Boolean).join(', ') || String(linked.length) : 'None'};
    if(c.assocParam === 'notCreated'){
      holds = !linked.length;
      remedies = [{kind:'createAssociated', object:c.associatedObject, label:x}, {kind:'associateExisting', object:c.associatedObject, label:x}];
    } else if(c.assocParam === 'notChanged' && linked.length) remedies = [{kind:'openAssociated', object:c.associatedObject, label:x, recordId:linked[0].id}];
  } else if(['stageEntryForward', 'stageEntryBackward', 'stageExit'].includes(v.trigger)){
    if(move && move.to) param = {key:'move', label: move.attempt ? 'Tried to move' : 'Stage move', value: move.from ? `${stageName(move.from)} \u2192 ${stageName(move.to)}` : stageName(move.to)};
  } else {
    const p = activityTriggerProperty(v.trigger, c.activityProperty);
    if(p && p.template){
      const tpl = emailTemplatesOf(data).find(x => x.id === c.template) || {};
      const done = (acts || []).some(a => a.type === 'email' && a.templateId === c.template && (p.template === 'sent' ? a.status !== 'scheduled' : a.status === 'scheduled'));
      param = {key:`email:${c.template}:${p.template}`, label:`Email \u201c${tpl.name || 'template'}\u201d`, value: done ? sentence(p.template) : `Not ${p.template}`};
    } else if(p && p.counts){
      const n = countedOf(p, deal, acts).length;
      param = {key:`count:${v.trigger}:${c.activityProperty}`, label:`Number of ${p.noun}`, value:String(n)};
      if(!c.repeat){
        holds = countMeets(c, n);
        // Adding an activity changes a count that's below (or equal to) its threshold; one above it can't be undone.
        if(c.op !== 'gt'){ const r = ACTIVITY_REMEDIES[v.trigger] || {}; remedies = (r[c.activityProperty] || r['*'] || []).map(kind => ({kind})); }
      }
    }
  }
  const fired = counted.includes(v.triggerId);
  const status = holds === null ? (fired ? 'true' : 'false') : holds ? 'true' : fired ? 'earlier' : 'false';
  return {id:v.triggerId, trigger:v.trigger, title:triggerLabelOf(v), icon:t.icon, summary:triggerSummary(data, v), param, status, evaluated:holds !== null, remedies};
}
function evaluationTrace(data, w, deal, acts, counted, move){
  if(!w || !deal) return null;
  const conditions = workflowTriggerViews(w).map(v => traceCondition(data, v, deal, acts, counted || [], move));
  const params = [];
  conditions.forEach(c => { if(c.param && !params.some(x => x.key === c.param.key)) params.push(c.param); });
  const met = (c) => c.status !== 'false';
  return {at:Date.now(), match: triggersMatchAll(w) ? 'all' : 'any', context:contextPathOf(data, w.context), conditions, params, move:move || null,
    result: triggersMatchAll(w) ? conditions.every(met) : conditions.some(met)};
}
function workflowExpectations(data, w, deal, acts, attempt){
  if(!w || !deal) return null;
  const rows = workflowTriggerViews(w).map(v => triggerExpectation(data, v, deal, acts, attempt)).filter(Boolean);
  if(!rows.length) return null;
  return {expected:rows.map(r => r.expected).filter(Boolean), current:rows.map(r => r.current).filter(Boolean), join: triggersMatchAll(w) ? 'Or' : 'And'};
}
/* Deleting a record: the signed-in user's Delete permission on its Object, as its page checks it. */
const canDeleteRecord = (rec) => {
  if(!rec || !ACCESS.user || !ACCESS.perms) return true;
  const object = recordObjectOf(rec.id), p = ACCESS.perms[object];
  return !!(p && p.enabled && permissionCovers(p.delete, object, object === 'contacts' ? {...rec, id:Number(rec.id)} : rec));
};
/* ── Prompts ── */
const pendingPrompts = (ctx, match) => ctx ? ctx.state.prompts.filter(p => p.status === 'pending' && match(p)) : [];
const PROMPT_ICON = {blockEntry:'lock', setProperty:'edit', clearProperty:'close', moveStage:'forward', addNote:'notepad', scheduleMeeting:'calendar', createRecord:'cube', createTask:'tasks', sendEmail:'envelope',
  logMeeting:'calendar', logCall:'call', initiateCall:'call', deleteRecord:'trash'};

/* Violations (Required actions) are red. */
const VIOLATION_TONE = {color:T.red, bg:'#FEF3F2', border:'#FDA29B'};
// Violations in Violation Mode: the deals' pending Required prompts.
// Open violations: Required prompts still pending (one whose stage the record left is Not applicable).
const openViolations = (ctx, match) => ctx ? ctx.state.prompts.filter(p => p.required && p.status === 'pending' && match(p)) : [];
/* An Object's violations — on its records in `pipelines` when given (the pipelines in view). */
const dealViolations = (ctx, object = 'deals', pipelines) => openViolations(ctx, p => recordObjectOf(p.dealId) === object
  && ctx.deals.some(d => d.id === p.dealId && (!pipelines || pipelines.includes(d.pipeline))));
/* The enabled workflows that apply to an Object's records in `pipelines` (the pipelines in view):
   in that Object (or company-wide), with a trigger, and in one of those pipelines — or in none
   (then every pipeline of the Object). Objects workflows don't run on have none. */
const applicableWorkflows = (data, object, pipelines) => !WORKFLOW_OBJECTS.includes(object) ? []
  : (data.workflows || []).map(normalizeWorkflow).filter(w => w.active !== false && w.triggers.length
    && (!w.context.object || w.context.object === object) && (!w.context.pipeline || (pipelines || []).includes(w.context.pipeline)));
/* A Workflow Violation names its workflow as it's called now (it keeps the name it had when raised
   if the workflow is gone), and the requirement it violates: its conditions as they held then
   (the run's reasons — e.g. "Close Date is not changed in this stage"). */
const violationRule = (data, p) => { const raw = data && (data.workflows || []).find(x => x.id === p.workflowId), w = raw && normalizeWorkflow(raw); return (w && (w.name || workflowTitle(data, w))) || p.rule; };
/* A violation in one line, from its workflow: the condition that was violated (a property's value,
   a property not updated, a count), else what's required and where — "Expected Close Date was not
   updated at this stage.", "A customer must be created at the Payment Made stage." */
function violationExplanation(data, p){
  const raw = (data.workflows || []).find(x => x.id === p.workflowId), w = raw ? normalizeWorkflow(raw) : null;
  const object = recordObjectOf(p.dealId), single = (o) => objectName(data, o).replace(/s$/, '');
  const stage = p.stage ? stageLabelOf(data, p.pipeline, p.stage) : '', at = stage ? ` at the ${stage} stage` : '';
  const sentence = (t) => t ? t.charAt(0).toUpperCase() + t.slice(1) + (/[.!?]$/.test(t) ? '' : '.') : '';
  const propLabel = (scope, key) => scope === 'record' ? ((objectProperties(data, object).find(x => x.key === key) || {}).label || key)
    : (((scopeFields(data, scope) || []).find(x => x.key === `prop:${key}`)) || {}).label || key;
  if(w){
    const views = workflowTriggerViews(w), texts = (p.reasons || []).map(r => r.text);
    const fired = views.filter(v => texts.includes(triggerSummary(data, v)));
    const isCondition = (v) => (v.trigger === 'propertyUpdate' && !!(v.triggerConfig || {}).property)
      || !!(activityTriggerProperty(v.trigger, (v.triggerConfig || {}).activityProperty) || {}).counts;
    const assoc = (fired.length ? fired : views).find(v => v.trigger === 'associatedRecord' && ['notCreated', 'notChanged'].includes((v.triggerConfig || {}).assocParam));
    if(assoc){
      const c = assoc.triggerConfig, x = single(c.associatedObject || 'records').toLowerCase(), w = conditionWhen(c);
      if(w === 'lifecycle') return sentence(c.assocParam === 'notCreated' ? `No ${x} has been created yet` : `The associated ${x} has never been updated`);
      const when = w === 'stage' ? 'at this stage' : `within ${unitWord(c.changeAmount, c.changeUnit)}`;
      return sentence(c.assocParam === 'notCreated' ? `No ${x} was created ${when}` : `The associated ${x} was not updated ${when}`);
    }
    const cond = (fired.length ? fired : views).find(isCondition);
    if(cond){
      const c = cond.triggerConfig || {};
      if(cond.trigger === 'propertyUpdate' && (c.op === 'notChanged' || c.op === 'changed')){
        const label = propLabel(scopeOf(c), c.property);
        if(conditionWhen(c) === 'lifecycle') return sentence(c.op === 'notChanged' ? `${label} has never been updated` : `${label} was changed`);
        const when = conditionWhen(c) === 'stage' ? 'at this stage' : `within ${unitWord(c.changeAmount, c.changeUnit)}`;
        return sentence(`${label} was ${c.op === 'notChanged' ? 'not updated' : 'changed'} ${when}`);
      }
      const t = triggerSummary(data, cond);
      if(t) return sentence(t);
    }
  }
  const pay = p.payload || {}, labels = (keys) => keys.map(k => propLabel('record', k)).join(', ');
  const required = {
    createRecord: () => `A ${single(pay.object || 'records').toLowerCase()} must be created${at}`,
    setProperty: () => `${labels((pay.entries || []).map(e => e.property)) || 'Properties'} must be updated${at}`,
    clearProperty: () => `${labels(pay.keys || []) || 'Properties'} must be cleared${at}`,
    moveStage: () => `The ${single(object).toLowerCase()} must be moved to ${stageLabelOf(data, pay.pipeline || p.pipeline, pay.stage) || 'the next stage'}`,
    createTask: () => `${(pay.tasks || []).length > 1 ? 'Tasks' : 'A task'} must be created${at}`,
    addNote: () => `A note must be added${at}`,
    sendEmail: () => `${(pay.emails || []).length > 1 ? 'Emails' : 'An email'} must be sent${at}`,
    scheduleMeeting: () => `A meeting must be scheduled${at}`,
    logMeeting: () => `A meeting must be logged${at}`,
    logCall: () => `A call must be logged${at}`,
    initiateCall: () => `A call must be made${at}`,
    deleteRecord: () => `The ${single(object).toLowerCase()} must be deleted`,
    blockEntry: () => `Its values must change to stay${at.replace(' at the', ' in the')}`,
  }[p.kind];
  return sentence(required ? required() : p.title);
}
const ViolationExplanation = ({p}) => {
  const ctx = useWorkflowEngineCtx();
  return ctx ? <div style={{fontSize:13, color:T.attioText, lineHeight:1.45}}>{violationExplanation(ctx.data, p)}</div> : null;
};
/* A record a violation card points to (the Violations panel): highlighted where the page shows it
   — its Board card or table row — and brought into view beside the panel. */
function revealBesidePanel(el){
  el.scrollIntoView({block:'nearest', inline:'nearest'});
  const panel = document.querySelector('[data-violation-panel]');
  if(!panel) return;
  let sc = el.parentElement;
  while(sc && !(sc.scrollWidth > sc.clientWidth + 1 && /(auto|scroll)/.test(getComputedStyle(sc).overflowX))) sc = sc.parentElement;
  if(!sc) return;
  const r = el.getBoundingClientRect(), edge = panel.getBoundingClientRect().left - 24, start = sc.getBoundingClientRect().left + 24;
  if(r.right > edge) sc.scrollLeft += Math.min(r.right - edge, r.left - start);
}
function useRecordFocus(recordId){
  const ctx = useWorkflowEngineCtx(), f = ctx && ctx.recordFocus;
  const on = !!f && recordId != null && f.id === String(recordId);
  const ref = React.useRef(null);
  React.useEffect(() => { if(on && ref.current) revealBesidePanel(ref.current); }, [on, f && f.nonce]);
  return [on, ref];
}
const RECORD_FOCUS_RING = {border:`1px solid ${VIOLATION_TONE.color}`, boxShadow:`0 0 0 3px ${VIOLATION_TONE.bg}`};
function ViolatedRequirement({p}){
  const reasons = (p.reasons || []).filter(r => r.text);
  if(!reasons.length) return null;
  return (
    <div style={{display:'flex', flexDirection:'column', gap:6}}>
      <div style={{fontSize:12.5, color:T.attioMuted}}>Violated requirement</div>
      {reasons.map((r, i) => (
        <div key={i} style={{fontSize:13, color:T.attioText, lineHeight:1.45}}>{r.text}{r.actual != null && r.actual !== '' ? <span style={{color:T.attioMuted}}> · now {r.actual}</span> : null}</div>
      ))}
    </div>
  );
}
// Resolving one that needs input (a value, a note, a date) opens its modal; the others run as they are.
const PROMPT_NEEDS_INPUT = ['setProperty', 'addNote', 'scheduleMeeting', 'createRecord', 'logMeeting', 'logCall', 'deleteRecord'];
/* Initiate Call: the record's call window opens (the violation ends once the call is made). */
const startViolationCall = (ctx, p) => ctx && ctx.openRecord && ctx.openRecord(p.dealId, {id:'calls', adding:'Call'}, true);

/* ── Workflow event cards (Figma) ── one structure for every workflow-triggered event, now and
   for workflows added later: the record's name; "Workflow Triggered" with the workflow (a left
   line in the event's tone — red: Violation / Automatic Action); its Context; Expected | Current;
   then the event's section — Action Required (Violation) or Resolved (Automatic Action). `ev`: {name, rule, context, exp:{expected, current, join}}. */
const EVENT_TONES = {violation:VIOLATION_TONE, automatic:VIOLATION_TONE};
function WorkflowEventBody({tone, ev}){
  return (
    <div style={{display:'flex', flexDirection:'column', gap:14}}>
      <div style={{fontSize:15, fontWeight:600, color:T.attioText}}>{ev.name}</div>
      <WorkflowTriggeredLine tone={tone} rule={ev.rule}/>
    </div>
  );
}
// A card's section: its title, then its actions (stacked, left-aligned).
const EventSection = ({title, children}) => (
  <div style={{display:'flex', flexDirection:'column', gap:10}}>
    <div style={{fontSize:15, color:T.attioText}}>{title}</div>
    {children}
  </div>
);
const eventBtn = (primary) => ({alignSelf:'flex-start', display:'inline-flex', alignItems:'center', gap:8, height:32, padding:'0 14px', borderRadius:8, fontSize:13, fontWeight:500,
  fontFamily:'inherit', cursor:'pointer', whiteSpace:'nowrap', ...(primary ? {border:'none', background:T.black, color:'#fff'} : {border:`1px solid ${T.borderStrong}`, background:'#fff', color:T.attioText})});
const eventBtnDisabled = {background:T.gray400, cursor:'default'};
/* A violation's actions (Action Required): Edit <property> as the primary when the workflow watches
   one a person can edit, then the required action (its icon and name); alone, the required action
   is the primary. */
/* A violation whose workflow wants an associated record that isn't there (Is not created): its
   remedies sit beside the workflow's own action — Create … / Associate an existing …; the violation
   resolves once one is linked. */
const violationAssociatedRemedy = (ctx, p) => {
  const w = ctx && getWorkflowFrom(ctx.data, p.workflowId), d = ctx && ctx.deals.find(x => x.id === p.dealId);
  const v = w && d && workflowTriggerViews(w).find(x => x.trigger === 'associatedRecord' && x.triggerConfig.assocParam === 'notCreated' && x.triggerConfig.associatedObject);
  return v && !associatedRecordsOf(d, v.triggerConfig.associatedObject, ctx.deals).length ? {deal:d, object:v.triggerConfig.associatedObject} : null;
};
const getWorkflowFrom = (data, id) => { const raw = ((data && data.workflows) || []).find(w => w.id === id); return raw ? normalizeWorkflow(raw) : null; };
function AssociatedRemedyButtons({remedy, primary}){
  const ctx = useWorkflowEngineCtx();
  const [linking, setLinking] = React.useState(null);
  const noun = objectName(ctx.data, remedy.object).replace(/s$/, '');
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
  return (<>
    <button onClick={stop(()=>setLinking('create'))} style={eventBtn(primary)}><Icon name="plus" size={14} color={primary ? '#fff' : T.attioText}/>Create {noun.toLowerCase()}</button>
    <button onClick={stop(()=>setLinking('link'))} style={eventBtn(false)}><Icon name="openRecord" size={14} color={T.attioText}/>Associate an existing {noun.toLowerCase()}</button>
    {linking && <span onClick={e=>e.stopPropagation()}><AssociatedRecordForm deal={remedy.deal} object={remedy.object} link={linking === 'link'} onClose={()=>setLinking(null)}/></span>}
  </>);
}
function ViolationActions({p, editProp, onEdit, onResolve}){
  const ctx = useWorkflowEngineCtx();
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
  const assoc = violationAssociatedRemedy(ctx, p);
  const action = (primary) => (
    <button onClick={stop(onResolve)} style={eventBtn(primary)}><Icon name={PROMPT_ICON[p.kind] || 'forward'} size={14} color={primary ? '#fff' : T.attioText}/>{p.title}</button>
  );
  // Change values (a record already in a blocked stage): the edit is the action; it resolves once the block no longer applies.
  if(p.kind === 'blockEntry' && assoc) return <AssociatedRemedyButtons remedy={assoc} primary/>;
  if(p.kind === 'blockEntry') return editProp ? <button onClick={stop(()=>onEdit(editProp))} style={eventBtn(true)}>Edit {editProp.label}</button>
    : <div style={{fontSize:12.5, color:T.attioMuted, lineHeight:1.45}}>Change the values in this workflow’s triggers. It resolves once the block no longer applies, or when the record leaves the stage.</div>;
  if(assoc) return (<><AssociatedRemedyButtons remedy={assoc} primary/>{action(false)}</>);
  return editProp ? (<>
    <button onClick={stop(()=>onEdit(editProp))} style={eventBtn(true)}>Edit {editProp.label}</button>
    {action(false)}
  </>) : action(true);
}
// The card in a modal (Violations, Automatic Actions) — two columns, divided by a line. Left: the
// record (a link to its side panel — the event waits, and comes back when the panel closes) and the
// workflow; the event's section (Automation, Action Required); why the workflow applies. Right: how
// it evaluated the record (WorkflowTrace), with View workflow journey to replay it.
const EVENT_LEFT_W = 440;
const EventLeftSection = ({title, children, last}) => (
  <div style={{padding:'20px 24px', borderBottom: last ? 'none' : `1px solid ${T.border}`, display:'flex', flexDirection:'column', gap:12}}>
    {title && <div style={{fontSize:15, color:T.attioText}}>{title}</div>}
    {children}
  </div>
);
const WorkflowTriggeredLine = ({tone, rule}) => (
  <div style={{borderLeft:`2px solid ${tone.color}`, padding:'1px 0 1px 12px', display:'flex', flexDirection:'column', gap:4, minWidth:0}}>
    <div style={{fontSize:14, color:T.attioText}}>Workflow Triggered</div>
    <div style={{display:'flex', alignItems:'center', gap:6, fontSize:13, color:tone.color, minWidth:0}}>
      <Icon name="workflows" size={13} color={tone.color}/><span style={{minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{rule}</span>
    </div>
  </div>
);
// The record's name as a link to its side panel. `keepEvent`: the modal waits while it's open. `style`: placement in its row.
function EventRecordLink({dealId, name, keepEvent, style}){
  const ctx = useWorkflowEngineCtx();
  const [h, setH] = React.useState(false);
  const open = ctx && ctx.openRecord;
  return (
    <button onClick={open ? ()=>open(dealId, null, keepEvent) : undefined} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} title="Open record"
      style={{alignSelf:'flex-start', border:'none', background:'transparent', padding:0, fontFamily:'inherit', fontSize:15, fontWeight:600, textAlign:'left',
        color: h ? T.black : T.attioText, textDecoration:'underline', textUnderlineOffset:3, textDecorationColor: h ? T.attioMuted : '#D7D6DA', cursor: open ? 'pointer' : 'default', ...style}}>{name}</button>
  );
}
const journeyButton = (onClick) => (
  <button onClick={onClick} style={toolbarButton}><Icon name="workflows" size={13} color={T.gray600}/> View workflow journey</button>
);
// `sections`: more left-column sections after the event's own, each {key, title, body} (the Automatic Action card's).
// `lead`: under the workflow's name (a Workflow Violation's violated requirement).
function WorkflowEventModal({title, tone, facts, name, rule, sectionTitle, children, why, sections, restriction, hidden, onClose, overlays, lead}){
  const [replay, setReplay] = React.useState(0);
  return ReactDOM.createPortal(
    <div style={{position:'fixed', inset:0, zIndex:100, display: hidden ? 'none' : 'flex', alignItems:'center', justifyContent:'center'}} onMouseDown={onClose}>
      <div style={{position:'absolute', inset:0, background:'rgba(16,24,40,.35)'}}/>
      <div onMouseDown={e=>e.stopPropagation()} style={{position:'relative', width:1120, maxWidth:'calc(100vw - 32px)', height:780, maxHeight:'calc(100vh - 48px)', display:'flex', flexDirection:'column',
        background:'#fff', borderRadius:12, boxShadow:'0 16px 40px rgba(16,24,40,.2)', overflow:'hidden'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:`1px solid ${T.border}`, flexShrink:0}}>
          <span style={{fontSize:15, fontWeight:600, color:T.attioText}}>{title}</span>
          <button onClick={onClose} title="Close" style={{border:'none', background:'transparent', cursor:'pointer', display:'flex'}}><Icon name="close" size={14} color={T.gray600}/></button>
        </div>
        <div style={{flex:1, minHeight:0, display:'flex'}}>
          <div style={{width:EVENT_LEFT_W, flexShrink:0, overflowY:'auto'}}>
            <EventLeftSection>
              <EventRecordLink dealId={facts.deal ? facts.deal.id : null} name={name} keepEvent/>
              <WorkflowTriggeredLine tone={tone} rule={rule}/>
              {lead}
            </EventLeftSection>
            <EventLeftSection title={sectionTitle}>{children}</EventLeftSection>
            {(sections || []).map(x => <EventLeftSection key={x.key} title={x.title} last={x.last}>{x.body}</EventLeftSection>)}
            {why && <EventLeftSection title={why.title}>{why.body}</EventLeftSection>}
          </div>
          {/* The line between the explanation and the visualization. */}
          <div style={{width:1, flexShrink:0, background:T.border}}/>
          <div style={{flex:1, minWidth:0, overflow:'auto', display:'flex', flexDirection:'column'}}>
            <div style={{display:'flex', justifyContent:'flex-end', padding:'14px 16px 0'}}>{journeyButton(()=>setReplay(n => n + 1))}</div>
            <WorkflowTrace trace={facts.trace} now={facts.now} actions={facts.actions} restriction={restriction} replay={replay}/>
          </div>
        </div>
      </div>
      {/* Over the modal (a form, an edit): clicks there never close the modal. */}
      {overlays && <div onMouseDown={e=>e.stopPropagation()}>{overlays}</div>}
    </div>, document.body);
}

/* What an event card reads: the run it came from (its kept evaluation and step results), the
   workflow, the record, and the record's values now — to tell what has changed since. A run from
   before evaluations were kept shows today's values, saying so; triggers that are events then
   can't be told ('unknown'). */
function eventFacts(ctx, {dealId, workflowId, runId, trace, stepId, actionId}){
  const run = runId ? ctx.state.runs.find(r => r.id === runId) : null;
  const raw = (ctx.data.workflows || []).find(x => x.id === (workflowId || (run && run.workflowId)));
  const w = raw ? normalizeWorkflow(raw) : null;
  const deal = ctx.deals.find(d => d.id === dealId) || null;
  const acts = deal ? ((ctx.activities || {})[deal.id] || []) : [];
  let shown = trace || (run && run.trace) || null;
  if(!shown && w && deal){
    const t = evaluationTrace(ctx.data, w, deal, acts, [], null);
    shown = {...t, now:true, conditions:t.conditions.map(c => c.evaluated ? c : {...c, status:'unknown'})};
  }
  const nowTrace = w && deal && shown && !shown.now ? evaluationTrace(ctx.data, w, deal, acts, [], shown.move) : null;
  const now = nowTrace ? Object.fromEntries(nowTrace.params.map(p => [p.key, p.value])) : {};
  /* The actions in one line each (actionSummary — the builder's): as they ran (kept on the step), else
     from the workflow (steps from before summaries were kept). */
  const iconOf = (type) => (workflowAction(type) || {}).icon || 'sparkle';
  const configured = (st) => { const a = w && (w.actions || []).find(x => x.id === st.actionId); return a ? actionSummary(ctx.data, a, w.context) : st.label; };
  // `conflict`: the action a violation is waiting on (its step) — outlined in red in the diagram.
  const actions = run && run.steps.length ? run.steps.map(st => ({icon:iconOf(st.type), summary:st.summary || configured(st), result:st.result, status:st.status, conflict:!!stepId && st.id === stepId}))
    : ((w && w.actions) || []).map(a => ({icon:iconOf(a.type), summary:actionSummary(ctx.data, a, w.context), conflict:!!actionId && a.id === actionId}));
  return {run, w, deal, trace:shown, now, actions};
}

/* ── The visualization ── Context → Current Parameters → Trigger → Action, from the kept
   evaluation. A blue line runs through it as the modal opens, along the path the evaluation
   took: into the trigger, to each condition that held (AND: all of them; OR: the ones that did —
   the others are marked False and the line passes them by), then to the action — only when the
   combined result held. */
const TRACE_W = 360, TRACE_MS = 1600;
const TRACE_STATUS = {
  true:{label:'True', color:T.blue, bg:T.blueLight},
  false:{label:'False', color:T.gray600, bg:T.headerBg},
  earlier:{label:'Was true', color:T.gray600, bg:T.headerBg},
  unknown:{label:'Not recorded', color:T.gray600, bg:T.headerBg},
};
const traceStatusPill = (status) => { const s = TRACE_STATUS[status] || TRACE_STATUS.unknown; return (
  <span style={{flexShrink:0, height:20, padding:'0 8px', borderRadius:9999, background:s.bg, color:s.color, fontSize:11.5, fontWeight:600, display:'inline-flex', alignItems:'center'}}>{s.label}</span>
); };
function WorkflowTrace({trace, now, actions, restriction, replay}){
  const wrapRef = React.useRef(null), refs = React.useRef({rows:{}});
  const [geo, setGeo] = React.useState(null);
  const [reached, setReached] = React.useState({});
  const [drawn, setDrawn] = React.useState(false);
  const onPath = trace ? trace.conditions.filter(c => c.status === 'true' || c.status === 'earlier') : [];
  const measure = () => {
    const wrap = wrapRef.current, r = refs.current;
    if(!wrap || !r.context || !r.params || !r.trigger || !r.action) return;
    const box = wrap.getBoundingClientRect();
    const rel = (el) => { const b = el.getBoundingClientRect(); return {l:b.left - box.left, t:b.top - box.top, r:b.right - box.left, b:b.bottom - box.top, w:b.width, h:b.height}; };
    const C = rel(r.context), P = rel(r.params), G = rel(r.trigger), A = rel(r.action);
    const x0 = Math.round(C.l + C.w / 2), gx = Math.round(G.l + 11);
    const rows = onPath.map(c => r.rows[c.id] && {id:c.id, ...rel(r.rows[c.id])}).filter(Boolean);
    /* Segments, in order: between the cards (never through a card's content), and inside the
       trigger along its left margin — in along the top edge, down past the conditions, a stub into
       each that held, out along the bottom edge. Each draws after the one before. */
    const segs = [], marks = [];
    let len = 0;
    const seg = (pts, mark) => {
      const l = pts.slice(1).reduce((n, p, i) => n + Math.abs(p[0] - pts[i][0]) + Math.abs(p[1] - pts[i][1]), 0);
      segs.push({d:`M ${pts.map(p => p.map(Math.round).join(' ')).join(' L ')}`, start:len, len:Math.max(1, l)});
      len += l;
      if(mark) marks.push([mark, len]);
    };
    marks.push(['context', 0]);
    seg([[x0, C.b], [x0, P.t]], 'params');
    seg([[x0, P.b], [x0, G.t]], 'trigger');
    if(rows.length){
      seg([[x0, G.t], [gx, G.t], [gx, rows[0].t + rows[0].h / 2]], `row:${rows[0].id}`);
      rows.slice(1).forEach((rw, i) => seg([[gx, rows[i].t + rows[i].h / 2], [gx, rw.t + rw.h / 2]], `row:${rw.id}`));
    }
    if(trace && trace.result){
      const last = rows[rows.length - 1];
      if(last) seg([[gx, last.t + last.h / 2], [gx, G.b], [x0, G.b]]);
      seg([[x0, G.b], [x0, A.t]], 'action');
    }
    const stubs = rows.map(rw => ({id:rw.id, x1:gx, x2:rw.l, y:Math.round(rw.t + rw.h / 2)}));
    const base = [[x0, C.b, x0, P.t], [x0, P.b, x0, G.t], [x0, G.b, x0, A.t]];
    const next = {w:Math.round(box.width), h:Math.round(box.height), d:segs.map(x => x.d).join('|'), segs, len:Math.max(1, len), marks, stubs, base};
    setGeo(g => g && g.d === next.d && g.w === next.w && g.h === next.h ? g : next);
  };
  React.useLayoutEffect(measure);
  React.useEffect(() => {
    if(!wrapRef.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure()); ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);
  // Each run of the line: undrawn, then drawn over TRACE_MS; what it reaches lights up as it gets there.
  React.useEffect(() => {
    if(!geo) return;
    setDrawn(false); setReached({context:true});
    const timers = [];
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    geo.marks.forEach(([key, at]) => timers.push(setTimeout(() => setReached(m => ({...m, [key]:true})), (at / geo.len) * TRACE_MS)));
    return () => { cancelAnimationFrame(raf); timers.forEach(clearTimeout); };
  }, [geo && geo.d, replay]);
  if(!trace) return <div style={{padding:24, ...stTextB}}>How this workflow evaluated the record wasn’t recorded.</div>;
  const join = trace.match === 'all' ? 'AND' : 'OR';
  return (
    <div style={{display:'flex', justifyContent:'center', padding:'8px 24px 32px'}}>
      <div ref={wrapRef} style={{position:'relative', display:'flex', flexDirection:'column', alignItems:'center', gap:40}}>
        <WorkflowCard tab="CONTEXT" icon="cube" width={TRACE_W} selected={!!reached.context} bodyRef={el => refs.current.context = el}>
          <div style={{display:'flex', flexDirection:'column', gap:2}}>
            <span style={{fontSize:11.5, color:T.attioMuted}}>Record in</span>
            <span style={{fontSize:12.5, fontWeight:500, lineHeight:1.45, color:T.attioText}}>{trace.context}</span>
          </div>
        </WorkflowCard>
        <WorkflowCard tab="CURRENT PARAMETERS" dark width={TRACE_W} bodyRef={el => refs.current.params = el}>
          {/* Values as the workflow saw them; one that has changed since shows its value now too. */}
          <span style={{fontSize:11.5, color:T.attioMuted}}>{trace.now ? 'Values now — this run’s values weren’t recorded' : `At execution · ${fmtWhen(trace.at)}`}</span>
          {trace.params.length ? trace.params.map(p => (
            <div key={p.key} style={{display:'flex', alignItems:'baseline', gap:8, fontSize:13, color:T.attioText, lineHeight:1.45}}>
              <span style={{flex:1, minWidth:0}}>{p.label} = {p.value}</span>
              {now && now[p.key] !== undefined && now[p.key] !== p.value && <span style={{flexShrink:0, fontSize:12, color:T.attioMuted}}>Now {now[p.key]}</span>}
            </div>
          )) : <span style={{fontSize:12.5, color:T.attioMuted}}>These triggers don’t check any record values.</span>}
        </WorkflowCard>
        <WorkflowCard tab="TRIGGER" icon="workflows" accent width={TRACE_W} bodyRef={el => refs.current.trigger = el} bodyStyle={{paddingLeft:22}}>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <span style={{flex:1, fontSize:12.5, color:T.gray600}}>Run when</span>
            {trace.conditions.length > 1 && <span style={{fontSize:11.5, fontWeight:600, color:T.gray600}}>{trace.match === 'all' ? 'All conditions (AND)' : 'Any condition (OR)'}</span>}
          </div>
          {trace.conditions.map((c, i) => (
            <React.Fragment key={c.id}>
              {i > 0 && <span style={{alignSelf:'center', fontSize:11, fontWeight:600, letterSpacing:.4, color:T.attioMuted}}>{join}</span>}
              <div ref={el => refs.current.rows[c.id] = el} style={{border:`1.5px solid ${reached[`row:${c.id}`] ? T.blue : T.border}`, borderRadius:10, padding:'8px 10px', background:'#fff',
                opacity: c.status === 'false' ? .7 : 1, transition:'border-color 200ms ease'}}>
                {blockLine(c.icon, c.title, c.summary, traceStatusPill(c.status))}
              </div>
            </React.Fragment>
          ))}
        </WorkflowCard>
        <WorkflowCard tab="ACTION" icon="listBullets" width={TRACE_W} selected={!!reached.action} bodyRef={el => refs.current.action = el}>
          {restriction && (
            <div style={{display:'flex', alignItems:'flex-start', gap:8, fontSize:12.5, color:T.attioText, lineHeight:1.45}}>
              <Icon name="lock" size={13} color={T.gray600} style={{marginTop:2, flexShrink:0}}/>{restriction}
            </div>
          )}
          {/* Each action in one line — the builder's summary. */}
          {(actions || []).map((a, i) => (
            <div key={i} title={a.result ? `${a.summary} · ${a.result}` : a.summary} style={{border:`1.5px solid ${a.conflict ? VIOLATION_TONE.color : T.border}`, borderRadius:10, padding:'8px 10px',
              background: a.conflict ? VIOLATION_TONE.bg : '#fff', display:'flex', flexDirection:'column', gap:4}}>
              {blockLine(a.icon, a.summary)}
              {a.conflict && <div style={{display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, color:VIOLATION_TONE.color}}><Icon name="warning" size={12} color={VIOLATION_TONE.color}/>Action Required · not done yet</div>}
            </div>
          ))}
        </WorkflowCard>
        {geo && (
          <svg aria-hidden="true" width={geo.w} height={geo.h} style={{position:'absolute', left:0, top:0, pointerEvents:'none', overflow:'visible'}}>
            {geo.base.map((l, i) => <line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke={T.borderStrong} strokeWidth="1.5"/>)}
            {geo.segs.map((sg, i) => (
              <path key={i} d={sg.d} fill="none" stroke={T.blue} strokeWidth="2" strokeLinejoin="round"
                style={{strokeDasharray:sg.len, strokeDashoffset: drawn ? 0 : sg.len,
                  transition: drawn ? `stroke-dashoffset ${(sg.len / geo.len) * TRACE_MS}ms linear ${(sg.start / geo.len) * TRACE_MS}ms` : 'none'}}/>
            ))}
            {geo.stubs.map(st => <line key={st.id} x1={st.x1} y1={st.y} x2={reached[`row:${st.id}`] ? st.x2 : st.x1} y2={st.y} stroke={T.blue} strokeWidth="2" style={{transition:'x2 150ms ease'}}/>)}
          </svg>
        )}
      </div>
    </div>
  );
}

/* Why the workflow applies, from the kept evaluation: each condition with the value it was checked
   against and whether it held, then how they combine (AND: all must hold; OR: one is enough). */
const CONDITION_WORD = {true:'true', false:'false', earlier:'no longer true (it was when it was counted)', unknown:'not recorded'};
function EventWhy({trace, mode}){
  if(!trace) return <div style={stTextB}>How this workflow evaluated the record wasn’t recorded.</div>;
  const n = trace.conditions.length, met = trace.conditions.filter(c => c.status === 'true' || c.status === 'earlier').length;
  const outcome = mode === 'block' ? 'the restriction applies' : mode === 'violation' ? 'the requirement applies' : 'the workflow ran';
  const logic = n <= 1 ? `The condition is ${met ? 'true' : 'false'}, so ${outcome}.`
    : trace.match === 'all' ? `These conditions are joined by AND, so all of them must be true. ${met === n ? 'All of them are' : `${met} of ${n} are`} true, so ${outcome}.`
    : `These conditions are joined by OR, so one true condition is enough. ${met === 1 ? 'One is' : `${met} are`} true, so ${outcome}.`;
  return (
    <div style={{display:'flex', flexDirection:'column', gap:10}}>
      {trace.conditions.map(c => (
        <div key={c.id} style={{display:'flex', alignItems:'flex-start', gap:8, fontSize:13, color:T.attioText, lineHeight:1.5}}>
          <Icon name={c.status === 'true' ? 'check' : 'close'} size={13} color={c.status === 'true' ? T.blue : T.gray400} style={{marginTop:3, flexShrink:0}}/>
          <span>{c.param ? `${c.param.label} was ${c.param.value}: ` : ''}<b style={{fontWeight:500}}>{c.summary || c.title}</b> is {CONDITION_WORD[c.status] || c.status}.</span>
        </div>
      ))}
      <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>{logic}</div>
      {trace.now && <div style={stTextB}>This run’s values weren’t recorded, so these are the record’s values now.</div>}
    </div>
  );
}

/* What a person can do about a restriction: for each condition that made it apply, the change that
   would make it false — recommendations, not workflow actions. Each opens the existing way of doing
   it; the workflow then checks its conditions again on the record's new values and activity. A
   task is a reminder — it isn't the call (or email) itself, and doesn't count as one. */
// `include`: conditions keeping a pending move out now (live), shown even if they weren't recorded as true.
function eventRemedies(trace, include){
  const out = [];
  (trace ? trace.conditions : []).filter(c => c.status === 'true' || (include || []).includes(c.id)).forEach(c => (c.remedies || []).forEach(rm => {
    const key = `${rm.kind}:${rm.property || rm.object || ''}`;
    if(!out.some(x => x.key === key)) out.push({...rm, key, cond:c});
  }));
  return out;
}
function remedyLabel(rm, name){
  switch(rm.kind){
    case 'property': return `Edit ${rm.label}`;
    case 'stage': return `Move ${name} to another stage`;
    case 'call': return `Call ${name}`;
    case 'callTask': return `Create Call task for ${name}`;
    case 'email': return `Email ${name}`;
    case 'emailTask': return `Create Email task for ${name}`;
    case 'meeting': return `Schedule a meeting with ${name}`;
    case 'note': return 'Add a note';
    case 'task': return 'Create a task';
    case 'completeTask': return 'Complete an open task';
    case 'createAssociated': return `Create ${rm.label.toLowerCase()}`;
    case 'associateExisting': return `Associate an existing ${rm.label.toLowerCase()}`;
    case 'openAssociated': return `Update the associated ${rm.label.toLowerCase()}`;
  }
  return rm.kind;
}
/* Create … / Associate an existing … — the remedy for a missing associated record: a new one in its
   own form (linked to the record, as Create Associated Record does), or an existing one free to link. */
function AssociatedRecordForm({deal, object, link, onClose}){
  const ctx = useWorkflowEngineCtx();
  const [pick, setPick] = React.useState('');
  if(!ctx) return null;
  const data = ctx.data, noun = objectName(data, object).replace(/s$/, '');
  if(!link) return ReactDOM.createPortal(
    <ContactFormModal mode="add" initial={{name:deal.name || '', owner:deal.owner || ''}} properties={objectFormProperties(data, object)} owners={ownerUserOptions(data.users)}
      stages={CONTACT_TYPE_STAGES.map(s => s.value)} optionsFor={['deals', 'customers'].includes(object) ? pipelineFormOptions(data, object) : undefined}
      adjust={['deals', 'customers'].includes(object) ? pipelineFormAdjust(data, object) : undefined}
      noun={noun.toLowerCase()} zIndex={210} onCancel={onClose} onSave={(vals)=>{ ctx.api.createAssociated(deal.id, object, vals); onClose(); }}/>, document.body);
  const options = linkableRecords(deal, object, ctx.deals).map(r => ({value:String(r.id), label:r.name || String(r.id)}));
  return ReactDOM.createPortal(
    <div style={{position:'relative', zIndex:210}}>
      <StModal title={`Associate ${noun.toLowerCase()}`} primary="Associate" canSubmit={!!pick} onCancel={onClose} onSubmit={()=>{ ctx.api.associateExisting(deal.id, pick); onClose(); }}>
        {promptDealName(deal.name)}
        <div><label style={fieldLabel}>{noun}</label>
          <SearchableSelect value={pick} options={options} onChange={setPick} placeholder={`Select ${noun.toLowerCase()}`} searchPlaceholder={`Search ${objectName(data, object).toLowerCase()}`}/></div>
        {!options.length && <div style={{fontSize:12.5, color:T.attioMuted}}>No {objectName(data, object).toLowerCase()} are free to associate — each already has its own.</div>}
      </StModal>
    </div>, document.body);
}
/* The recommendations' actions: a property in its edit modal (over the event); a call, an email, a
   meeting, a task or a note in the record's side panel, on its tab with that form open (the call
   window, the email composer, Schedule Meeting… — the event waits). */
function useRemedies(ctx, deal, name){
  const [stub, setStub] = React.useState(null);
  const [editing, setEditing] = React.useState(null);
  const open = (tab) => ctx && ctx.openRecord && deal && ctx.openRecord(deal.id, tab, true);
  const pick = (rm) => {
    const props = objectProperties(ctx.data, recordObjectOf(deal && deal.id));
    switch(rm.kind){
      case 'property': { const prop = props.find(p => p.key === rm.property); return setEditing(prop ? {prop, confirmable:!!rm.confirmable} : null); }
      case 'stage': { const prop = props.find(p => p.key === 'stage'); return setEditing(prop ? {prop} : null); }
      case 'call': return open({id:'calls', adding:'Call'});
      case 'email': return open({id:'email', adding:'Email'});
      case 'meeting': return open({id:'meetings', adding:'Schedule Meeting'});
      case 'callTask': return open({id:'tasks', adding:'Task', prefill:{title:`Call ${name}`, taskType:'Call'}});
      case 'emailTask': return open({id:'tasks', adding:'Task', prefill:{title:`Email ${name}`, taskType:'Email'}});
      case 'note': return open({id:'notes', adding:'Note'});
      case 'task': return open({id:'tasks', adding:'Task'});
      case 'completeTask': return open({id:'tasks'});
      case 'createAssociated': case 'associateExisting': return setLinking({kind:rm.kind, object:rm.object});
      case 'openAssociated': return ctx.openRecord && ctx.openRecord(rm.recordId, null, true);
    }
  };
  const [linking, setLinking] = React.useState(null);   // {kind, object}: Create … / Associate an existing …
  const overlays = <>
    {stub && <StubPanel title={stub} zIndex={130} onClose={()=>setStub(null)}/>}
    {editing && deal && <EditPropertyModal deal={deal} prop={editing.prop} confirmable={editing.confirmable} onClose={()=>setEditing(null)}/>}
    {linking && deal && <AssociatedRecordForm deal={deal} object={linking.object} link={linking.kind === 'associateExisting'} onClose={()=>setLinking(null)}/>}
  </>;
  return {pick, overlays};
}
// An underlined action, at the left column's text size (the reference's links).
function EventLink({label, onClick}){
  const [h, setH] = React.useState(false);
  return (
    <button onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} style={{alignSelf:'flex-start', border:'none', background:'transparent', padding:0, cursor:'pointer',
      fontFamily:'inherit', fontSize:14, textAlign:'left', color: h ? T.black : T.attioText, textDecoration:'underline', textUnderlineOffset:3,
      textDecorationColor: h ? T.attioMuted : T.attioText, transition:'color 120ms ease, text-decoration-color 120ms ease'}}>{label}</button>
  );
}
/* Enforce Rules — the triggers as actions: each condition that's blocking (as the trigger says it),
   then what the person can do about it, one link per line. */
// `met`: trigger ids no longer keeping the record out (a pending move's guide) — ticked off, no remedies.
function EventRemedies({trace, name, onPick, met, include}){
  const list = eventRemedies(trace, include);
  if(!list.length) return null;
  const groups = [];
  list.forEach(rm => { const g = groups.find(x => x.cond.id === rm.cond.id); if(g) g.items.push(rm); else groups.push({cond:rm.cond, items:[rm]}); });
  return (
    <div style={{display:'flex', flexDirection:'column', gap:18}}>
      {groups.map(g => (
        <div key={g.cond.id} style={{display:'flex', flexDirection:'column', gap:10}}>
          {met && met.includes(g.cond.id) ? (
            <div style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:T.attioText, lineHeight:1.45}}>
              <Icon name="check" size={14} color={T.green || '#039855'}/><span style={{textDecoration:'line-through', color:T.attioMuted}}>{g.cond.summary || g.cond.title}</span> Done
            </div>
          ) : (<>
            <div style={{fontSize:12.5, color:T.attioMuted, lineHeight:1.45}}>{g.cond.summary || g.cond.title}</div>
            {g.items.map(rm => <EventLink key={rm.key} label={remedyLabel(rm, name)} onClick={()=>onPick(rm)}/>)}
          </>)}
        </div>
      ))}
    </div>
  );
}

/* "+ Explain this workflow": collapsed by default; open, why the action happened and how the
   conditions were evaluated. The left column's only explanation. */
function ExplainWorkflow({children}){
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{display:'flex', flexDirection:'column', gap:12}}>
      <button aria-expanded={open} onClick={()=>setOpen(o => !o)} style={{alignSelf:'flex-start', display:'inline-flex', alignItems:'center', gap:6, border:'none', background:'transparent',
        padding:0, cursor:'pointer', fontFamily:'inherit', fontSize:14, color:T.attioText}}>
        <Icon name="plus" size={13} color={T.attioText} style={{transform: open ? 'rotate(45deg)' : 'none', transition:'transform 120ms ease'}}/>Explain this workflow
      </button>
      {open && children}
    </div>
  );
}
/* An Automatic Action (the reference): the record and workflow; Automation — the action it ran, in
   one line; Is this workflow blocking you? — the suggested actions as underlined links; then
   Explain this workflow, collapsed. */
function AutomaticActionModal({event, onClose, hidden}){
  const ctx = useWorkflowEngineCtx();
  const facts = ctx ? eventFacts(ctx, event) : {trace:event.trace, now:{}, actions:[], deal:null};
  const data = ctx && ctx.data;
  const name = facts.deal ? facts.deal.name : event.name;
  const remedies = useRemedies(ctx, facts.deal, name);
  const mv = event.move, pipe = (mv && (mv.toPipeline || mv.pipeline)) || (facts.deal && facts.deal.pipeline);
  const stage = (id) => `\u201c${(data && stageLabelOf(data, pipe, id)) || id}\u201d`;
  // A block: Block Entry keeping the deal out of a stage, or an automatic move straight back out of the stage a person moved it to.
  const isBlock = !!event.blocked && !!mv;
  const entry = event.actionType === 'blockEntry';
  const from = mv && (mv.fromStage || mv.from), to = mv && (mv.toStage || mv.to);
  const restriction = !isBlock ? null : entry ? `Kept out of ${stage(to)} · stays in ${stage(from)}` : `Prevented staying in ${stage(to)}`;
  /* A person's move this block kept out, still pending: what's done now (live), and the move itself
     once nothing keeps the record out. */
  const pending = isBlock && entry && ctx && facts.deal ? (ctx.state.pendingMoves || {})[facts.deal.id] : null;
  const blockers = pending ? (ctx.api.blockersFor(facts.deal.id) || []) : null;
  const mine = blockers && blockers.find(b => b.workflowId === event.workflowId);
  const met = blockers ? (facts.trace ? facts.trace.conditions.map(c => c.id) : []).filter(id => !(mine && mine.held.includes(id))) : null;
  const others = blockers ? blockers.filter(b => b.workflowId !== event.workflowId) : [];
  const toLabel = pending ? stage(pending.toStage) : '';
  const resume = () => { onClose(); ctx.api.resumeMove(facts.deal.id); };
  const did = !isBlock ? `This workflow ran on its own because its conditions are met: ${event.result}.`
    : entry ? `This workflow kept ${name} out of ${stage(to)} because its conditions are met.`
    : `This workflow moved ${name} out of ${stage(to)}${event.toStage ? ` to ${stage(event.toStage)}` : ''} because its conditions apply there.`;
  return (
    <WorkflowEventModal title="Enforce Rules" tone={EVENT_TONES.automatic} facts={facts} name={name} rule={event.rule} sectionTitle="Automation"
      restriction={restriction} hidden={hidden} onClose={onClose} overlays={remedies.overlays}
      sections={[
        {key:'blocking', title:'Is this workflow blocking you?', body: isBlock
          ? <div style={{display:'flex', flexDirection:'column', gap:10}}>
              {/* What's missing, as the workflow's Block Entry says it. */}
              {event.message && <div style={{fontSize:13.5, color:T.attioText, lineHeight:1.5}}>{event.message}</div>}
              <EventRemedies trace={facts.trace} name={name} onPick={remedies.pick} met={met} include={mine ? mine.held : []}/>
              {pending && (
                <div style={{display:'flex', flexDirection:'column', gap:8, marginTop:6, paddingTop:14, borderTop:`1px solid ${T.border}`}}>
                  <div style={{fontSize:12.5, color:T.attioMuted, lineHeight:1.45}}>
                    {!blockers.length ? `All set — ${name} can move to ${toLabel} now.`
                      : !mine && others.length ? `Also kept out by ${others.map(b => `“${b.name}”`).join(', ')}.`
                      : `Once these are done, you can move ${name} to ${toLabel}.`}
                  </div>
                  <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                    <button onClick={blockers.length ? undefined : resume} disabled={!!blockers.length} style={{...eventBtn(true), ...(blockers.length ? eventBtnDisabled : {})}}>
                      <Icon name="forward" size={14} color="#fff"/>Move to {toLabel}</button>
                    <button onClick={()=>{ ctx.api.dismissMove(facts.deal.id); onClose(); }} style={eventBtn(false)}>Don’t move</button>
                  </div>
                </div>
              )}
            </div>
          : <span style={{fontSize:14, color:T.attioText}}>No</span>},
        {key:'explain', last:true, body:(
          <ExplainWorkflow>
            <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>{did}</div>
            <EventWhy trace={facts.trace} mode={isBlock ? 'block' : 'ran'}/>
          </ExplainWorkflow>
        )},
      ]}>
      {/* The action that ran, as the builder and the trace's Action box say it. */}
      <div style={{display:'flex', alignItems:'center', gap:10, fontSize:14, color:T.attioText}}>
        <Icon name="check" size={14} color={T.attioText}/>{event.summary || event.result}
      </div>
    </WorkflowEventModal>
  );
}
const promptDealName = (name) => <div style={{fontSize:15, fontWeight:600, color:T.attioText}}>{name}</div>;
/* A violation can also be settled by editing what its workflow watches (Close Date for "Close Date is
   not changed in this stage"): the watched property of its Property Update trigger, if a person can
   edit it here. */
const violationEditProperty = (data, p) => {
  const w = (data.workflows || []).find(x => x.id === p.workflowId);
  const v = w && workflowTriggerViews(w).find(x => x.trigger === 'propertyUpdate' && x.triggerConfig.property);
  const prop = v && objectProperties(data, recordObjectOf(p.dealId)).find(x => x.key === v.triggerConfig.property);
  return prop && !prop.auto && !['Pipeline', 'Pipeline stage'].includes(prop.type) ? prop : null;
};
// Edit one deal property (a violation's "Edit <property>"): saved as a person's change.
/* `violation`: the violation this edit settles (its workflow watches the property). As on a property
   violation, the client's value can be the same as now: ticked, the row is disabled, the value stays
   and the violation is cleared with the confirmation recorded. */
/* `confirmable`: the condition is about the property being updated (Is changed / Is not changed) —
   "the same" can be confirmed (a violation's: from its workflow). */
const watchesPropertyChange = (data, p, key) => { const raw = ((data && data.workflows) || []).find(w => w.id === p.workflowId);
  return !!raw && workflowTriggerViews(raw).some(v => v.trigger === 'propertyUpdate' && v.triggerConfig.property === key && isChangeOp(v.triggerConfig.op)); };
function EditPropertyModal({deal, prop, violation, onClose, confirmable: confirmableProp}){
  const ctx = useWorkflowEngineCtx();
  const confirmable = confirmableProp != null ? confirmableProp : !!violation && watchesPropertyChange(ctx.data, violation, prop.key);
  const current = prop.type === 'User' ? (deal[prop.key] || '') : inputPropertyValue(prop, deal[prop.key]);
  const [value, setValue] = React.useState(current);
  const [sameValue, setSameValue] = React.useState(false);
  const save = () => {
    if(sameValue){ if(violation) ctx.api.confirmUnchanged(violation.id, prop.key); else ctx.api.confirmPropertySame(deal.id, prop.key); onClose(); return; }
    const err = validatePropertyValue(prop, value);
    if(err) return;
    const v = prop.type === 'User' ? value : storePropertyValue(prop, value);
    ctx.setDeals(ds => ds.map(d => d.id === deal.id ? {...d, [prop.key]:v} : d));
    onClose();
  };
  return ReactDOM.createPortal(
    <StModal title={`Edit ${prop.label}`} primary="Save" onCancel={onClose} onSubmit={save}>
      {promptDealName(deal.name)}
      <div aria-disabled={sameValue || undefined} {...(sameValue ? {inert:''} : {})} style={{opacity: sameValue ? .5 : 1, pointerEvents: sameValue ? 'none' : 'auto'}}>
        <label style={fieldLabel}>{prop.label}</label>
        <PropertyInput prop={prop} value={sameValue ? current : value} onChange={setValue} options={propertyOptions(ctx.data, recordObjectOf(deal.id), prop, {pipeline:deal.pipeline})}/></div>
      {confirmable && (
        <label onClick={()=>setSameValue(v => !v)} style={{display:'flex', alignItems:'center', gap:10, fontSize:13, color:T.attioText, cursor:'pointer'}}>
          <RowCheckbox checked={sameValue} onChange={()=>setSameValue(v => !v)}/>The new value received from the client is the same.
        </label>
      )}
    </StModal>, document.body);
}
/* A deal's marker, on its board card and beside its name in the table: its violations (red), with
   their count. One opens its modal; several list first. The list floats (fixed, portalled — like ActionsMenu) so the board column can't clip it. */
function DealPromptMarker({dealId}){
  const ctx = useWorkflowEngineCtx();
  const [menu, setMenu] = React.useState(null);   // {top, left}
  const violationBtn = React.useRef(null), menuRef = React.useRef(null);
  const violations = openViolations(ctx, p => p.dealId === dealId);
  const list = menu ? violations : [];
  React.useEffect(() => {
    if(!menu) return;
    const close = () => setMenu(null);
    const onDown = (e) => { if(!(menuRef.current && menuRef.current.contains(e.target))) close(); };
    document.addEventListener('mousedown', onDown); window.addEventListener('scroll', close, true); window.addEventListener('resize', close);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [menu]);
  React.useEffect(() => { if(menu && !list.length) setMenu(null); }, [list.length]);
  const pending = ctx && (ctx.state.pendingMoves || {})[dealId];
  if(!violations.length && !pending) return null;
  const W = 300, t = VIOLATION_TONE;
  /* View: the violation's workflow diagram, its conflict highlighted (the Violations panel's diagram,
     the panel opening with it). Several: a list first — each by its workflow and one line. */
  const view = (p) => { setMenu(null); ctx.openViolation(recordObjectOf(p.dealId), p.id); };
  const open = (e) => {
    e.stopPropagation();
    if(violations.length === 1) return view(violations[0]);
    if(menu) return setMenu(null);
    const r = violationBtn.current.getBoundingClientRect();
    setMenu({top:r.bottom + 4, left:Math.max(8, Math.min(r.left, window.innerWidth - W - 8))});
  };
  return (
    <div onMouseDown={e=>e.stopPropagation()} style={{display:'flex', gap:4, flexShrink:0}}>
      {pending && <PendingMoveChip dealId={dealId} pending={pending}/>}
      {violations.length > 0 && <button ref={violationBtn} title={violations.length === 1 ? `View ${violationRule(ctx.data, violations[0])}` : `View ${plural(violations.length, 'workflow violation')}`} onClick={open}
        aria-haspopup={violations.length > 1 ? 'menu' : undefined} aria-expanded={violations.length > 1 ? !!menu : undefined}
        style={{display:'inline-flex', alignItems:'center', gap:4, height:22, padding:'0 7px', borderRadius:9999, border:`1px solid ${t.border}`, cursor:'pointer',
          background:t.bg, color:t.color, fontSize:11.5, fontWeight:600, fontFamily:'inherit', flexShrink:0}}>
        <Icon name="warning" size={12} color={t.color}/>{violations.length}
        <span style={{width:1, height:12, background:t.border, margin:'0 2px'}}/>View
        {violations.length > 1 && <Icon name="chevDown" size={11} color={t.color}/>}
      </button>}
      {menu && ReactDOM.createPortal(
        <div ref={menuRef} role="menu" onMouseDown={e=>e.stopPropagation()} style={{position:'fixed', top:menu.top, left:menu.left, width:W, zIndex:110, background:'#fff',
          border:`1px solid ${T.border}`, borderRadius:10, padding:6, boxShadow:'0 4px 16px rgba(16,24,40,.12)', fontWeight:400}}>
          <div style={{padding:'4px 10px 6px', fontSize:11.5, color:T.gray400}}>Workflow Violations</div>
          {list.map(p => (
            <button key={p.id} role="menuitem" onClick={(e)=>{ e.stopPropagation(); view(p); }}
              onMouseEnter={e=>{ e.currentTarget.style.background = T.headerBg; }} onMouseLeave={e=>{ e.currentTarget.style.background = 'transparent'; }}
              style={{display:'flex', alignItems:'flex-start', gap:8, width:'100%', padding:'8px 10px', border:'none', borderRadius:8, background:'transparent', cursor:'pointer', textAlign:'left', fontFamily:'inherit'}}>
              <Icon name="workflows" size={13} color={t.color} style={{marginTop:2, flexShrink:0}}/>
              <span style={{display:'flex', flexDirection:'column', gap:2, minWidth:0}}>
                <span style={{fontSize:13, fontWeight:500, color:T.attioText, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{violationRule(ctx.data, p)}</span>
                <span style={{fontSize:12, color:T.attioMuted, lineHeight:1.4}}>{violationExplanation(ctx.data, p)}</span>
              </span>
            </button>
          ))}
        </div>, document.body)}
    </div>
  );
}

/* A move a workflow kept out, still pending (Guide + kept on the record): reopens the block card
   (what's needed, then Move to …); × drops it. */
function PendingMoveChip({dealId, pending}){
  const ctx = useWorkflowEngineCtx();
  const label = stageLabelOf(ctx.data, pending.toPipeline, pending.toStage) || pending.toStage;
  return (
    <span style={{display:'inline-flex', alignItems:'center', height:22, borderRadius:9999, border:`1px solid ${T.borderStrong}`, background:'#fff', flexShrink:0, overflow:'hidden'}}>
      <button title={`Pending move to ${label} — see what's needed`} onClick={(e)=>{ e.stopPropagation(); ctx.openEvent(pending.event); }}
        style={{display:'inline-flex', alignItems:'center', gap:4, height:'100%', padding:'0 4px 0 7px', border:'none', background:'transparent', cursor:'pointer', fontFamily:'inherit', fontSize:11.5, fontWeight:600, color:T.attioText}}>
        <Icon name="forward" size={12} color={T.attioText}/>{label}
      </button>
      <button title="Don’t move" aria-label="Drop the pending move" onClick={(e)=>{ e.stopPropagation(); ctx.api.dismissMove(dealId); }}
        style={{display:'inline-flex', alignItems:'center', height:'100%', padding:'0 6px 0 2px', border:'none', background:'transparent', cursor:'pointer'}}>
        <Icon name="close" size={10} color={T.gray600}/>
      </button>
    </span>
  );
}
/* ── Violation Mode (Contacts, Deals, Customers) ── the red Violations button (far right of the
   filters) opens a compact list over the right side: each violation's record, workflow and required
   action, with Resolve. Violations can't be dismissed; closing the list dismisses nothing.
   The button, for the pipelines in view (`pipelines`): hidden when no enabled workflow applies;
   disabled when one does but there are no violations; otherwise enabled, with the count. */
const violationsAvailable = (ctx, object, pipelines) => !!ctx && applicableWorkflows(ctx.data, object, pipelines).length > 0;
function ViolationsButton({active, onClick, object = 'deals', pipelines}){
  const ctx = useWorkflowEngineCtx();
  if(!violationsAvailable(ctx, object, pipelines)) return null;
  const n = dealViolations(ctx, object, pipelines).length;
  if(!n) return (
    <button disabled aria-disabled="true" title="No workflow violations" style={{...toolbarButton, border:`1px solid ${T.border}`, background:'#fff', color:T.gray400, fontWeight:500, cursor:'default'}}>
      <Icon name="warning" size={13} color={T.gray400}/> Workflow Violations
    </button>
  );
  return (
    <button onClick={onClick} aria-pressed={active} style={{...toolbarButton, border:`1px solid ${VIOLATION_TONE.border}`, background: active ? VIOLATION_TONE.bg : '#fff', color:T.red, fontWeight:500}}>
      <Icon name="warning" size={13} color={T.red}/> Workflow Violations
      {n > 0 && <span style={{minWidth:18, height:18, padding:'0 5px', boxSizing:'border-box', borderRadius:9999, background:T.red, color:'#fff', fontSize:11, fontWeight:700,
        display:'inline-flex', alignItems:'center', justifyContent:'center'}}>{n}</span>}
    </button>
  );
}
/* Violation Mode: the Violations panel on the right — one compact card per violation (the record, the
   workflow, Action Required). Selecting a card shows how its workflow evaluated the record on the
   left, over the page (ViolationTracePane); selecting it again, or closing, returns to the page. */
function ViolationPanel({onClose, object = 'deals', pipelines}){
  const ctx = useWorkflowEngineCtx();
  const focus = ctx && ctx.violationFocus;
  /* `selected`: the card chosen — its record is highlighted where the page shows it (Board card or
     table row). `viewing`: the violation whose workflow diagram is open (View on the record's
     violations, or Dashboard → Compliance). */
  const [selected, setSelected] = React.useState(focus ? focus.id : null);
  const [viewing, setViewing] = React.useState(focus ? focus.id : null);
  React.useEffect(() => {
    if(!focus) return;
    setSelected(focus.id); setViewing(focus.id);
    // Its card is brought into view in the list.
    setTimeout(() => { const el = document.querySelector(`[data-violation-id="${focus.id}"]`); if(el) el.scrollIntoView({block:'nearest'}); }, 0);
  }, [focus && focus.nonce]);
  const focusRecord = ctx && ctx.focusRecord;
  React.useEffect(() => { const p = ctx && ctx.state.prompts.find(x => x.id === selected); if(focusRecord) focusRecord(p ? p.dealId : null); }, [selected]);
  React.useEffect(() => () => { if(focusRecord) focusRecord(null); }, []);
  const [editing, setEditing] = React.useState(null);   // {deal, prop}: a violation's Edit <property>
  if(!ctx) return null;
  if(!violationsAvailable(ctx, object, pipelines)) return null;
  const list = dealViolations(ctx, object, pipelines).sort((a, b) => b.createdAt - a.createdAt);
  const resolve = (p) => p.kind === 'initiateCall' ? startViolationCall(ctx, p) : PROMPT_NEEDS_INPUT.includes(p.kind) ? ctx.openPrompt(p.id, {direct:true}) : ctx.api.completePrompt(p.id, {});
  const current = list.find(p => p.id === viewing) || null;
  // Choosing a card: its record is pointed out on the page (the diagram, if open, closes so the page shows).
  const select = (id) => { setViewing(null); setSelected(s => s === id ? null : id); };
  return (<>
    {current && <ViolationTracePane p={current} onClose={()=>setViewing(null)}/>}
    <div data-violation-panel="" onMouseDown={e=>e.stopPropagation()} style={{position:'absolute', top:0, right:0, bottom:0, width:VIOLATION_PANEL_W, zIndex:30, background:'#fff',
      borderLeft:`1px solid ${T.border}`, boxShadow:'-8px 0 24px rgba(16,24,40,.08)', display:'flex', flexDirection:'column'}}>
      <div style={{display:'flex', alignItems:'center', gap:8, height:52, padding:'0 12px 0 16px', borderBottom:`1px solid ${T.border}`, flexShrink:0}}>
        <Icon name="warning" size={15} color={T.red}/>
        <span style={{fontSize:14, fontWeight:600, color:T.attioText}}>Workflow Violations</span>
        <span style={{fontSize:12.5, color:T.gray400}}>{list.length}</span>
        <div style={{flex:1}}/>
        <button title="Close" onClick={onClose} style={{width:28, height:28, borderRadius:8, border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center'}}>
          <Icon name="close" size={14} color={T.gray600}/>
        </button>
      </div>
      {editing && <EditPropertyModal deal={editing.deal} prop={editing.prop} violation={editing.violation} onClose={()=>setEditing(null)}/>}
      <div style={{flex:1, minHeight:0, overflowY:'auto', padding:12, display:'flex', flexDirection:'column', gap:8}}>
        {!list.length && <div style={{padding:'32px 8px', textAlign:'center', fontSize:13, color:T.gray400}}>No workflow violations</div>}
        {list.map(p => {
          const deal = ctx.deals.find(d => d.id === p.dealId);
          return (
            <ViolationCard key={p.id} p={p} ev={{name: deal ? deal.name : p.dealName, rule:violationRule(ctx.data, p)}} on={selected === p.id} onSelect={()=>select(p.id)}
              onResolve={()=>resolve(p)}
              editProp={deal && violationEditProperty(ctx.data, p)} onEdit={(prop)=>setEditing({deal, prop, violation:p})}/>
          );
        })}
      </div>
    </div>
  </>);
}
const VIOLATION_PANEL_W = 360;
/* The Violation Card (Violations panel): the record and the workflow, a divider, Action Required. */
function ViolationCard({p, ev, on, onSelect, onResolve, editProp, onEdit}){
  return (
    // Selected: the red border only — the fill stays white, for contrast inside the card.
    <div data-violation-id={p.id} onClick={onSelect} style={{border:`1px solid ${on ? T.red : T.border}`, background:'#fff', borderRadius:12,
      padding:16, cursor:'pointer', display:'flex', flexDirection:'column', gap:14}}>
      <WorkflowEventBody tone={EVENT_TONES.violation} ev={ev}/>
      <ViolationExplanation p={p}/>
      <div style={{height:1, background:T.border}}/>
      <EventSection title="Action Required">
        <ViolationActions p={p} editProp={editProp} onEdit={onEdit} onResolve={onResolve}/>
      </EventSection>
    </div>
  );
}
// The selected violation's evaluation, on the left of the Violations panel.
function ViolationTracePane({p, onClose}){
  const ctx = useWorkflowEngineCtx();
  const [replay, setReplay] = React.useState(0);
  const facts = eventFacts(ctx, {dealId:p.dealId, workflowId:p.workflowId, runId:p.runId, stepId:p.stepId, actionId:p.actionId});
  return (
    <div onMouseDown={e=>e.stopPropagation()} style={{position:'absolute', top:0, left:0, bottom:0, right:VIOLATION_PANEL_W, zIndex:29, background:'#fff', display:'flex', flexDirection:'column'}}>
      <div style={{display:'flex', alignItems:'center', gap:12, minHeight:52, padding:'8px 12px 8px 20px', borderBottom:`1px solid ${T.border}`, flexShrink:0}}>
        {/* Centred with the workflow name beside it (the modal stacks it, top-aligned). */}
        <EventRecordLink dealId={p.dealId} name={facts.deal ? facts.deal.name : p.dealName} style={{alignSelf:'center', flexShrink:0}}/>
        <span style={{display:'flex', alignItems:'center', gap:6, fontSize:13, color:T.red, minWidth:0}}>
          <Icon name="workflows" size={13} color={T.red}/><span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{violationRule(ctx.data, p)}</span>
        </span>
        <div style={{flex:1}}/>
        {journeyButton(()=>setReplay(n => n + 1))}
        <button title="Close" onClick={onClose} style={{width:28, height:28, borderRadius:8, border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center'}}>
          <Icon name="close" size={14} color={T.gray600}/>
        </button>
      </div>
      <div style={{flex:1, minHeight:0, overflow:'auto', paddingTop:16}}>
        <WorkflowTrace trace={facts.trace} now={facts.now} actions={facts.actions} replay={replay}/>
      </div>
    </div>
  );
}

/* A workflow's notices (App): an automatic action it ran, as a toast — View opens its Automatic
   Actions card (the bell keeps it too). A blocked move opens its card straight away (engine.event). */
function WorkflowNotices({notices, onDismiss, onView}){
  const auto = notices.find(n => n.kind === 'auto');
  React.useEffect(() => { if(!auto) return; const t = setTimeout(()=>onDismiss(auto.id), 6000); return () => clearTimeout(t); }, [auto && auto.id]);
  return auto ? <CopyToast message={`Workflow ${auto.rule}: ${auto.result} · ${auto.dealName}`}
    action={auto.event ? {label:'View', onClick:()=>{ onView(auto.event); onDismiss(auto.id); }} : undefined}/> : null;
}

/* One prompt, as its card in a modal: a Violation (Violations — Action Required). Inputs an action needs (a value, a note, a
   date) sit in the section above its button. */
/* `direct` (opened from a Violations panel card): a violation that needs a form (Create <Object>)
   opens the form itself — the card already shows the violation. Otherwise every violation opens in
   the shared modal (WorkflowEventModal), its form over it. */
function WorkflowPromptModal({promptId, onClose, hidden, direct}){
  const ctx = useWorkflowEngineCtx();
  const p = ctx && ctx.state.prompts.find(x => x.id === promptId);
  const deal = p && ctx.deals.find(d => d.id === p.dealId);
  const data = ctx && ctx.data;
  const [values, setValues] = React.useState(() => p && p.kind === 'setProperty' ? Object.fromEntries(p.payload.entries.map(e => [e.property, e.value ?? ''])) : {});
  const [sameValue, setSameValue] = React.useState(false);   // a property violation: the client's value is unchanged
  const [body, setBody] = React.useState(() => (p && p.kind === 'addNote' && p.payload.body) || '');   // a predefined note, filled in
  const [date, setDate] = React.useState(() => { const d = new Date(Date.now() + WF_DAY); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  const [time, setTime] = React.useState('');
  const [editingProp, setEditingProp] = React.useState(null);   // a violation's Edit <property>
  const [creating, setCreating] = React.useState(false);   // Create <Object>: its form, over the modal
  const [notes, setNotes] = React.useState(() => (p && p.kind === 'logMeeting' && (p.payload.meeting || {}).notes) || (p && p.kind === 'logCall' && (p.payload.call || {}).comment) || '');
  const [callOutcome, setCallOutcome] = React.useState(() => (p && p.kind === 'logCall' && (p.payload.call || {}).outcome) || '');
  const [deleting, setDeleting] = React.useState(false);   // Delete <record>: its confirmation, over the modal
  if(!p || !deal || p.status !== 'pending') return null;
  if(editingProp) return <EditPropertyModal deal={deal} prop={editingProp} violation={p} onClose={onClose}/>;
  const done = (input) => { ctx.api.completePrompt(p.id, input); onClose(); };
  const props = objectProperties(data, recordObjectOf(deal.id));
  const recordForm = () => {
    const objectId = p.payload.object;
    const owners = ownerUserOptions(data.users);   // owners are user IDs
    const initial = Object.fromEntries(Object.entries(p.payload.values || {}).map(([k, v]) => [k, ['recordOwner', 'ownerTeamLead'].includes(v) ? resolvePerson(data, deal, v) || '' : v]));
    return ReactDOM.createPortal(
      <ContactFormModal mode="add" initial={initial} properties={objectFormProperties(data, objectId)} owners={owners} stages={CONTACT_TYPE_STAGES.map(s => s.value)}
        optionsFor={['deals', 'customers'].includes(objectId) ? pipelineFormOptions(data, objectId) : undefined}
        adjust={['deals', 'customers'].includes(objectId) ? pipelineFormAdjust(data, objectId) : undefined}
        noun={objectName(data, objectId).replace(/s$/, '').toLowerCase()} zIndex={210} onCancel={direct ? onClose : ()=>setCreating(false)} onSave={(vals)=>done({values:vals})}/>, document.body);
  };
  if(p.kind === 'createRecord' && direct) return recordForm();
  const deletable = p.kind === 'deleteRecord' && canDeleteRecord(deal);
  const deleteConfirm = () => ReactDOM.createPortal(
    <div style={{position:'relative', zIndex:200}}>
      <DeleteConfirmModal contactName={deal.name} noun={objectName(data, recordObjectOf(deal.id)).replace(/s$/, '')} onCancel={direct ? onClose : ()=>setDeleting(false)} onConfirm={()=>done({})}/>
    </div>, document.body);
  if(p.kind === 'deleteRecord' && direct && deletable) return deleteConfirm();
  // The action's label and the inputs it needs.
  let primary = 'Save', can = true, content = null;
  if(p.kind === 'setProperty'){
    /* A violation resolves with a new value, or — ticked — with the client's value the same as now
       (the current values stay, and the confirmation is recorded). */
    const entryProps = p.payload.entries.map(e => props.find(x => x.key === e.property)).filter(Boolean);
    const current = (pr) => pr.type === 'User' ? (deal[pr.key] || '') : inputPropertyValue(pr, deal[pr.key]);
    const changed = entryProps.some(pr => String(values[pr.key] ?? '') !== String(current(pr) ?? ''));
    // Set Property Value (Track Violations): resolved at the required values — no "unchanged" confirmation.
    const requiredValue = !!p.payload.required;
    if(requiredValue) can = (p.payload.entries || []).every(e => String(values[e.property] ?? '') === String(e.value ?? ''));
    else if(p.required) can = sameValue || changed;
    const fields = entryProps.map(pr => (
      <div key={pr.key}><label style={fieldLabel}>{pr.label}</label>
        <PropertyInput prop={pr} value={sameValue ? current(pr) : (values[pr.key] ?? '')} onChange={(v)=>setValues(m => ({...m, [pr.key]:v, ...(pr.key === 'pipeline' && 'stage' in m ? {stage:''} : {})}))}
          options={propertyOptions(data, recordObjectOf(deal.id), pr, {pipeline:values.pipeline || deal.pipeline})}/></div>));   // a Deal Stage follows the Pipeline chosen here
    content = (<>
      <div aria-disabled={sameValue || undefined} {...(sameValue ? {inert:''} : {})} style={{display:'flex', flexDirection:'column', gap:14, opacity: sameValue ? .5 : 1, pointerEvents: sameValue ? 'none' : 'auto'}}>{fields}</div>
      {p.required && !requiredValue && (
        <label onClick={()=>setSameValue(v => !v)} style={{display:'flex', alignItems:'center', gap:10, fontSize:13, color:T.attioText, cursor:'pointer'}}>
          <RowCheckbox checked={sameValue} onChange={()=>setSameValue(v => !v)}/>The new value received from the client is the same.
        </label>
      )}
    </>);
  } else if(p.kind === 'clearProperty'){
    primary = `Clear ${p.payload.keys.map(k => (props.find(x => x.key === k) || {}).label).join(', ')}`;
  } else if(p.kind === 'moveStage'){
    primary = p.title;   // "Move to CCL Sent"
  } else if(p.kind === 'addNote'){
    primary = 'Add Note'; can = !!body.trim();
    content = <textarea autoFocus rows={6} value={body} onChange={e=>setBody(e.target.value)} placeholder="Write a note" aria-label="Note" style={{...fieldInput, resize:'vertical', lineHeight:1.5}}/>;
  } else if(p.kind === 'createTask'){
    primary = (p.payload.tasks || []).length > 1 ? 'Create tasks' : 'Create task';
    const due = (t) => new Date(t.dueAt).toLocaleString('en-US', {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'});
    content = (p.payload.tasks || []).map((t, i) => (
      <div key={t.id || i} style={{border:`1px solid ${T.attioLine}`, borderRadius:8, padding:'10px 12px', display:'flex', flexDirection:'column', gap:4}}>
        <div style={{fontSize:13.5, fontWeight:500, color:T.attioText}}>{t.name}</div>
        {t.description && <div style={{fontSize:12.5, color:T.attioText, lineHeight:1.45}}>{t.description}</div>}
        <div style={stTextB}>{[t.taskType || 'To-do', t.assigneeName && `Assigned to ${t.assigneeName}`, `Due ${due(t)}`].filter(Boolean).join(' · ')}</div>
      </div>
    ));
  } else if(p.kind === 'sendEmail'){
    primary = (p.payload.emails || []).some(e => !e.immediate) ? 'Schedule' : 'Send now';
  } else if(p.kind === 'scheduleMeeting'){
    const m = p.payload.meeting || {};
    primary = 'Schedule'; can = !!date && !!time;
    content = (<>
      <div style={{display:'flex', gap:8}}>
        <div style={{flex:'1 1 0', minWidth:0}}><label style={fieldLabel}>Date</label><DateField required value={date} onChange={setDate}/></div>
        <div style={{flex:'1 1 0', minWidth:0}}><label style={fieldLabel}>Time</label><TimeField value={time} onChange={setTime}/></div>
      </div>
      <div style={stTextB}>{[m.platform, m.duration, m.organizer && `Organizer: ${userName(data, resolvePerson(data, deal, m.organizer)) || assigneeLabel(data, m.organizer)}`].filter(Boolean).join(' · ')}</div>
    </>);
  }
  else if(p.kind === 'logMeeting'){
    const m = p.payload.meeting || {};
    primary = 'Log Meeting';
    content = (<>
      <div style={stTextB}>{[m.title, m.platform, m.duration].filter(Boolean).join(' · ')}</div>
      <div><label style={fieldLabel}>Notes</label><textarea rows={4} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional — saved as a note linked to this meeting" style={{...fieldInput, resize:'vertical', lineHeight:1.5}}/></div>
    </>);
  } else if(p.kind === 'logCall'){
    primary = 'Log Call'; can = !!callOutcome;
    content = (<>
      <div><label style={fieldLabel}>Call outcome</label><FormSelect value={callOutcome} placeholder="Select outcome" options={LOG_CALL_OUTCOMES} onChange={setCallOutcome}/></div>
      <div><label style={fieldLabel}>Comment</label><textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional — saved as a note linked to this call" style={{...fieldInput, resize:'vertical', lineHeight:1.5}}/></div>
    </>);
  } else if(p.kind === 'deleteRecord' && !deletable){
    can = false;
    content = <div style={{fontSize:13, color:T.attioMuted, lineHeight:1.5}}>You don’t have permission to delete this {recordNoun(deal.id)}. Ask someone who can delete it.</div>;
  }
  const submit = () => done(p.kind === 'setProperty' ? (sameValue ? {sameValue:true} : {values}) : p.kind === 'addNote' ? {body} : p.kind === 'scheduleMeeting' ? {date, time}
    : p.kind === 'logMeeting' ? {notes} : p.kind === 'logCall' ? {outcome:callOutcome, comment:notes} : {});
  const actionBtn = (label) => <button onClick={can ? submit : undefined} disabled={!can} style={{...eventBtn(true), ...(can ? {} : eventBtnDisabled)}}>{label}</button>;
  /* A Violation: Action Required — the Violation Card's actions; one that needs input shows its inputs
     and Resolve. */
  // Create <Object> has no inputs here: its button opens the form.
  const needsInput = PROMPT_NEEDS_INPUT.includes(p.kind) && !['createRecord', 'deleteRecord'].includes(p.kind);
  const facts = eventFacts(ctx, {dealId:p.dealId, workflowId:p.workflowId, runId:p.runId});
  /* The Automatic Actions modal's structure: the record and workflow; Action Required — what
     resolves it; then + Explain this workflow, collapsed — why it's blocking you. */
  return (
    <WorkflowEventModal title="Workflow Violation" tone={EVENT_TONES.violation} facts={facts} name={deal.name} rule={violationRule(data, p)} lead={<ViolatedRequirement p={p}/>}
      sectionTitle="Action Required" hidden={hidden} onClose={onClose} overlays={(creating && recordForm()) || (deleting && deleteConfirm())}
      restriction={null}
      sections={[{key:'explain', last:true, body:(
        <ExplainWorkflow><EventWhy trace={facts.trace} mode="violation"/></ExplainWorkflow>
      )}]}>
      {needsInput ? (<>{content}{actionBtn('Resolve')}</>) : p.kind === 'deleteRecord' && !deletable ? content : (
        <ViolationActions p={p} editProp={violationEditProperty(data, p)} onEdit={setEditingProp}
          onResolve={p.kind === 'createRecord' ? ()=>setCreating(true) : p.kind === 'deleteRecord' ? ()=>setDeleting(true) : p.kind === 'initiateCall' ? ()=>{ onClose(); startViolationCall(ctx, p); } : submit}/>
      )}
    </WorkflowEventModal>
  );
}

/* The header bell: the signed-in user's violations and notifications. */
function WorkflowBell(){
  const ctx = useWorkflowEngineCtx();
  const [open, setOpen] = React.useState(false);
  const me = ctx && ctx.currentUserId;
  const prompts = pendingPrompts(ctx, p => p.userId === me);
  const notes = ctx ? ctx.state.notifications.filter(n => n.userId === me) : [];
  const unread = prompts.length + notes.filter(n => !n.read).length;
  const toggle = () => { if(!open && ctx) ctx.api.markRead(me); setOpen(o => !o); };
  const items = [...prompts.map(p => ({kind:'prompt', at:p.createdAt, p})), ...notes.map(n => ({kind:'note', at:n.at, n}))].sort((a, b) => b.at - a.at).slice(0, 30);
  return (
    <div style={{position:'relative', display:'flex'}}>
      <button title="Notifications" aria-label="Notifications" onMouseDown={e=>e.stopPropagation()} onClick={toggle}
        style={{position:'relative', display:'flex', border:'none', background:'transparent', padding:0, cursor:'pointer'}}>
        <Icon name="notification" size={15} color={T.gray600}/>
        {unread > 0 && <div style={{position:'absolute', top:-5, right:-6, minWidth:13, height:13, padding:'0 3px', boxSizing:'border-box', borderRadius:9999, background:T.red, color:'#fff',
          fontSize:8, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center'}}>{unread}</div>}
      </button>
      <MenuShell open={open} onClose={()=>setOpen(false)} anchorRight width={340}>
        <div style={{padding:'6px 10px 8px', fontSize:13, fontWeight:600, color:T.attioText}}>Notifications</div>
        {!items.length && <div style={{padding:'14px 10px 16px', fontSize:12.5, color:T.gray400}}>No notifications yet</div>}
        <div style={{maxHeight:380, overflowY:'auto'}}>
          {items.map(it => it.kind === 'prompt' ? (
            <div key={it.p.id} onClick={()=>{ setOpen(false); ctx.openPrompt(it.p.id); }} style={{display:'flex', gap:10, padding:'8px 10px', borderRadius:6, cursor:'pointer'}}
              onMouseEnter={e=>e.currentTarget.style.background = T.headerBg} onMouseLeave={e=>e.currentTarget.style.background = 'transparent'}>
              <Icon name="warning" size={14} color={T.red} style={{marginTop:2, flexShrink:0}}/>
              <div style={{minWidth:0, flex:1}}>
                <div style={{fontSize:13, color:T.attioText}}>Workflow violation: {it.p.title}</div>
                <div style={{fontSize:12, color:T.gray600}}>{it.p.dealName} · {fmtWhen(it.at)}</div>
              </div>
            </div>
          ) : (
            <div key={it.n.id} onClick={it.n.event ? ()=>{ setOpen(false); ctx.openEvent(it.n.event); } : undefined}   // an Automatic Action opens its card
              style={{display:'flex', gap:10, padding:'8px 10px', borderRadius:6, cursor: it.n.event ? 'pointer' : 'default'}}
              onMouseEnter={e=>{ if(it.n.event) e.currentTarget.style.background = T.headerBg; }} onMouseLeave={e=>e.currentTarget.style.background = 'transparent'}>
              <Icon name="notification" size={14} color={T.gray600} style={{marginTop:2, flexShrink:0}}/>
              <div style={{minWidth:0, flex:1}}>
                <div style={{fontSize:13, color:T.attioText, whiteSpace:'pre-line'}}>{it.n.text}</div>
                <div style={{fontSize:12, color:T.gray600}}>{it.n.dealName} · {fmtWhen(it.at)}</div>
              </div>
            </div>
          ))}
        </div>
      </MenuShell>
    </div>
  );
}

Object.assign(window, {recordObjectOf, recordKey, recordNoun, ACTIVITY_RECORD_OBJECTS, withSeeded, PROPERTY_CHANGE_OPERATORS, PROPERTY_CHANGE_UNITS, triggerPropertyOperators, isChangeOp, conditionsValid, triggerConditionComplete, TriggerPropertyCondition, CONDITION_OPERATORS, conditionKind, useWorkflowEngine, WorkflowEngineCtx, useWorkflowEngineCtx, WF_SAVED, reviveActivities, withStageEntry, ConditionsEditor, WorkflowRuns,
  DealPromptMarker, WorkflowPromptModal, WorkflowBell, ViolationsButton, ViolationPanel, WorkflowNotices, AutomaticActionModal, workflowExpectations, workflowContextPath, orderedStages, stageMoveDirection, workflowTitle, conditionFields, evalConditions});
