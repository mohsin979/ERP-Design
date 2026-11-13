/* HOF Pulse ERP — Workflows (generic).

   A workflow is built around three separate ideas, then its actions:
     Context   — where it operates: Company-wide (nothing set), narrowed level by level to an
                 Object, then optionally its Property and / or one of its Pipelines, then that
                 pipeline's Stage ({object?, property?, pipeline?, stage?}). Pre-filled from where
                 the builder is opened (a pipeline's stage row, or the pipeline itself); levels are
                 added and removed in the Context panel, under Started from — the CRM branch it's
                 built in (e.g. Migration CRM). It stays as set whatever triggers or
                 actions are chosen: a context change never rewrites them — a trigger or action it
                 no longer fits is flagged "Needs attention" (triggerIssue / actionIssue) until it's
                 fixed. A Stage in the context scopes every trigger to records currently in that
                 stage; a Property is the one Property Update triggers watch.
     Triggers  — the events that start a run, added in the Trigger node from a nested menu (the
                 Add Action pattern): Property Events, Stage Events, Record Events, Activity
                 Events; one or more, each configured on its own in the Trigger panel. Each
                 trigger carries its own settings in `triggerConfig` (a property and its
                 condition; a stage — unless the context has one — and Stay at Stage's duration;
                 an activity property), adapted to the trigger and the context. With two or more,
                 `triggerMatch` relates them: 'all' — every trigger has fired for the record (in
                 any order; the run starts on the last one, then they're needed again) — or
                 'any' — any one of them fires.
     Trigger Scope — which records the triggers apply to (`triggerScope`, one per workflow): New
                 Records — only records new to the context since the workflow was configured
                 (`scopeSince`, stamped when it's saved with New Records); All Records — existing
                 ones too. "New" follows the context: an Object (or Property, or Company-wide)
                 context — created since; a Pipeline — entered that pipeline since; a Stage —
                 entered that stage since (not necessarily a new record). The engine enforces it.
   (Additional conditions are off for now: not shown, not evaluated.)
   On the canvas: CONTEXT (Record in: the branch → Object → Pipeline → Stage) → TRIGGER (each trigger's type
   and summary) → ACTION (the actions, by name only).
   Selecting a block opens its configuration on the right. Each action can wait before it runs
   (the clock beside its delete icon; not Enroll in Email Sequence, whose emails carry their own schedule).

   Type (the first step): Enforce Rules — the actions run automatically, and Block Stage Entry
   keeps records out of a stage — or Track Violations — the triggers are the violation conditions,
   and the actions are what resolves the Workflow Violation raised on the record (WORKFLOW_TYPES).
   Each action runs its workflow type's way (its `config.behavior`, from ACTION_BEHAVIORS: automatic
   / required); an action that can't run that way isn't offered, and is flagged if it's there.

   Actions are offered by category (WORKFLOW_ACTIONS, as the workflow document names them):
   Property-Based (Set Property Value, Prompt to Update Property, Clear Property Value), Pipeline
   and Stage (Move Stage Forward / Backward, Move to Specific Stage, Block Stage Entry), Activity-
   Based (Create Task, Enroll in Email Sequence, Exit Email Sequence, Schedule Meeting), Record Management (Create
   Associated Record) and Administrative (Notify). Add Note was removed. Each plugs its
   configuration in through WORKFLOW_ACTION_CONFIGS; most hold one or more entries. Runs, events
   and Workflow Violations: workflowEngine.jsx.

   Email Sequences are reusable resources (they'll live in Settings → Templates → Email Sequences,
   not built yet; DEFAULT_EMAIL_SEQUENCES until then): a named, ordered list of emails, each a
   template and a delay, with no recipients.

   Workflow Control (the last step, a node on the right): the Trigger Scope and Applies To. Who may
   view, create, edit and delete workflows is the Workflows permissions (Edit Permissions). No
   workflow can be overridden.

   A workflow is {id, type:'enforce'|'track', context:{object, pipeline, stage}, triggers:[{id, trigger, triggerConfig}],
   triggerMatch, triggerScope:'new'|'all', scopeSince, actions:[{id, type, config:{…, behavior?}, wait}], createdBy,
   active, version, origin}, saved to
   settingsData.workflows. Email templates are settingsData.emailTemplates. */

/* ── Triggers ── a registry: each trigger declares its settings; the engine (workflowEngine.jsx)
   declares how each one matches an event. New triggers are added here and there. */
// A task still open after its due date (activities.jsx's Overdue, for saved or live activity).
const isOverdueTask = (a) => a.type === 'task' && !!a.due && isOverdue({...a, due:new Date(a.due)});
/* Activity Events: one trigger per activity type. Its parameter select picks what to watch: a
   specific email being sent / scheduled (with its template), or a count of the record's
   activities, compared (Is more than / Equals / Is less than) or — with Repeat — every increase.
   `event`: the engine event that changes it; `counts`: which of the record's activities count;
   `noun`: the count in the summary ("Number of sent emails = 4"). */
const COUNT_OPERATORS = [{value:'gt', label:'Is more than', symbol:'>'}, {value:'equals', label:'Equals', symbol:'='}, {value:'lt', label:'Is less than', symbol:'<'}];
const meetingTime = (a) => new Date(a.scheduledFor || a.at).getTime();
/* Call Events: the dialer's calls (Number of Calls — with Repeat, every call made), third-party
   Call Logs, both together, and a count per outcome (the app's call outcome values). Calls made
   through the dialer and calls logged from elsewhere are kept apart. */
const CALL_LOG_PROPERTIES = [
  {value:'all', label:'Number of Calls', noun:'calls', event:'callLogged', match:(ev) => !ev.attrs.logged, counts:(a) => a.type === 'call' && !a.logged},
  {value:'callLogs', label:'Number of Call Logs', noun:'call logs', event:'callLogged', match:(ev) => !!ev.attrs.logged, counts:(a) => a.type === 'call' && !!a.logged},
  // Every call — dialer and logged — on the record and, for a deal or customer, with its contact (the person's call history).
  {value:'totalCalls', label:'Number of Total Calls (Logs+Actual)', noun:'total calls', event:'callLogged', withContact:true, counts:(a) => a.type === 'call'},
  {value:'Left voicemail', label:'Number of Calls With Voicemail', noun:'calls with voicemail'},
  {value:'Connected', label:'Number of Connected Calls', noun:'connected calls'},
  {value:'Wrong number', label:'Number of Wrong Numbers', noun:'wrong-number calls'},
  {value:'Cancelled', label:'Number of Cancelled Calls', noun:'cancelled calls'},
  {value:'Disconnected', label:'Number of Disconnected Calls', noun:'disconnected calls'},
  {value:'No answer', label:'Number of Unanswered Calls', noun:'unanswered calls'},
];
const ACTIVITY_TRIGGER_TYPES = {
  // Email Sent / Scheduled: any email, or one template's. Email Sent Ago: the set time after it was sent.
  emailEvents:   {label:'Email Parameter', placeholder:'Select email parameter', properties:[
    {value:'emailSent',      label:'Email Sent',      event:'emailSent',      template:'sent'},
    {value:'emailSentAgo',   label:'Email Sent Ago',  event:'emailSent',      template:'sent', ago:true},
    {value:'emailScheduled', label:'Email Scheduled', event:'emailScheduled', template:'scheduled'},
    {value:'sentEmails',     label:'Number of Emails Sent',     event:'emailSent',     noun:'sent emails',     counts:(a) => a.type === 'email' && a.direction === 'sent' && a.status !== 'scheduled'},
    {value:'scheduledEmails', label:'Number of Scheduled Emails', event:'emailScheduled', noun:'scheduled emails', counts:(a) => a.type === 'email' && a.status === 'scheduled'},
    {value:'receivedEmails', label:'Number of Emails Received', event:'emailReceived', noun:'received emails', counts:(a) => a.type === 'email' && a.direction === 'received'},
  ]},
  callEvents:    {label:'Call Parameters', placeholder:'Select call parameter', properties:CALL_LOG_PROPERTIES.map(p => p.each || p.counts ? p
    : {...p, event:'callLogged', outcome:p.outcomeIs || p.value, repeatSubject:`the number of ${p.noun}`, counts:(a) => a.type === 'call' && a.outcome === (p.outcomeIs || p.value)})},
  // Meeting Scheduled: each one booked; the counts: every meeting booked on the record, or past ones.
  meetingEvents: {label:'Meeting Parameter', placeholder:'Select meeting parameter', properties:[
    {value:'meetingScheduled', label:'Meeting Scheduled', each:true, event:'meetingScheduled'},
    {value:'scheduledMeetings', label:'Number of Scheduled Meetings', event:'meetingScheduled', noun:'scheduled meetings', counts:(a) => a.type === 'meeting'},
    {value:'completedMeetings', label:'Number of Completed Meetings', event:'meetingCompleted', noun:'completed meetings', counts:(a) => a.type === 'meeting' && meetingTime(a) <= Date.now()},
  ]},
  taskEvents:    {label:'Task Parameter', placeholder:'Select task parameter', properties:[
    {value:'taskCreated',    label:'Task Created', each:true, event:'taskCreated'},
    {value:'createdTasks',   label:'Number of Created Tasks',   event:'taskCreated',   noun:'created tasks',   counts:(a) => a.type === 'task'},
    {value:'completedTasks', label:'Number of Completed Tasks', event:'taskCompleted', noun:'completed tasks', counts:(a) => a.type === 'task' && a.status === 'completed'},
    // Overdue: still open after its due date (the scheduler notices each task once — taskOverdue).
    {value:'overdueTasks',   label:'Number of Overdue Tasks',   event:'taskOverdue',   noun:'overdue tasks',   counts:(a) => isOverdueTask(a)},
  ]},
  noteEvents:    {label:'Note Parameter', placeholder:'Select note parameter', properties:[
    {value:'noteAdded', label:'Note Added', each:true, event:'noteAdded'},
    {value:'notes', label:'Number of Notes', event:'noteAdded', noun:'notes', counts:(a) => a.type === 'note'},
  ]},
  /* The record's quotations (Quotes), by their status: sent (a signed one was sent too) and signed —
     compared as a count (e.g. no signed CCL before CCL Sent) or, with Repeat, each one sent / signed. */
  quoteEvents:   {label:'Quote Parameter', placeholder:'Select quote parameter', properties:[
    {value:'quoteSent',   label:'Quote Sent',   noun:'sent quotes',   event:'quoteSent',   quotes:true, counts:(q) => q.status === 'sent' || q.status === 'signed'},
    {value:'quoteSigned', label:'Quote Signed', noun:'signed quotes', event:'quoteSigned', quotes:true, counts:(q) => q.status === 'signed'},
  ]},
  // Files: received from the client; sent (added by the team).
  fileEvents:    {label:'File Parameter', placeholder:'Select file parameter', properties:[
    {value:'filesReceived', label:'No of Files Received', event:'fileAdded', noun:'files received', match:(ev) => ev.attrs.direction === 'received', counts:(a) => a.type === 'file' && a.origin === 'received'},
    {value:'filesSent',     label:'No of Files Sent',     event:'fileAdded', noun:'files sent',     match:(ev) => ev.attrs.direction !== 'received', counts:(a) => a.type === 'file' && a.origin !== 'received'},
  ]},
};
/* Property-trigger scopes and kinds (workflowEngine.jsx reads them too). */
const WORKFLOW_SCOPES = {
  record:{label:'Property', prefix:''}, profile:{label:'Customer Profile', prefix:'Customer Profile '},
  accounting:{label:'Accounting', prefix:'Accounting '}, owner:{label:'User Property', prefix:'User '}, form:{label:'Form', prefix:'Form '},
};
const scopeOf = (c) => WORKFLOW_SCOPES[(c || {}).scope] ? c.scope : 'record';
/* A property trigger's conditions — chosen after its property — are its type's (propertyTypes.jsx:
   the same for Record, Customer Profile, Accounting and User Properties, and the same as the
   filters'); Changed / Did not change take a duration (or In this stage). */
// Where a property trigger's changes are kept: the record's own key, else "<scope>:<key>".
const scopedPropertyKey = (c) => scopeOf(c) === 'record' ? c.property : `${scopeOf(c)}:${c.property}`;
const activityTriggerProperty = (triggerKey, value) => ((ACTIVITY_TRIGGER_TYPES[triggerKey] || {}).properties || []).find(p => p.value === value) || null;
/* `settings`: property · stage (pipeline and stage, unless the context has them) · duration ·
   activityProperty (with its template, or Repeat and the count condition — see
   triggerSettingFields). `disabled`: listed, not available yet. */
/* Where a group is offered (the document's context rules): `company` — Company-wide too (User
   Property triggers only); `inProperty` — in a Property context (property triggers only);
   `needsStage` — a Stage in the context (stage triggers); `noStage` — not at a Stage (pipeline
   events). Everything else needs a Record in the context. Property Events: one item, its four
   categories in a submenu — the record's own properties, its Customer Profile, its Accounting, its
   owner's User Properties — one trigger (propertyUpdate) with `scope`; the property is chosen
   first, then its condition. In a Property context only Record Property; Company-wide only User
   Property. */
const PROPERTY_TRIGGER_SCOPES = [
  {key:'property', scope:'record', label:'Record Property', icon:'edit', inProperty:true},
  {key:'profile', scope:'profile', label:'Customer Profile Property', icon:'profile'},
  {key:'accounting', scope:'accounting', label:'Accounting Property', icon:'coins'},
  // The form submission that created the record: Form Name, Submission Date and Source, its answers.
  {key:'form', scope:'form', label:'Form Property', icon:'forms'},
  {key:'owner', scope:'owner', label:'User Property', icon:'user', company:true},
];
const propertyScopeOf = (scope) => PROPERTY_TRIGGER_SCOPES.find(s => s.scope === scope) || PROPERTY_TRIGGER_SCOPES[0];
const propertyScopeAvailable = (scope, context) => { const ctx = context || {}, s = propertyScopeOf(scope);
  return !ctx.object ? !!s.company : ctx.property ? !!s.inProperty : true; };
const WORKFLOW_TRIGGER_GROUPS = [
  // Property Events: the four categories; each adds Property Update in its scope.
  {key:'property', label:'Property Events', icon:'edit', inProperty:true, company:true,
    menu:PROPERTY_TRIGGER_SCOPES.map(s => ({key:`propertyUpdate|${s.scope}`, label:s.label, icon:s.icon})),
    triggers:[{key:'propertyUpdate', label:'Property Update', icon:'edit', settings:['property'], requiresCondition:true}]},
  // Stage triggers: only with a Stage in the context.
  {key:'stage', label:'Stage Events', icon:'kanbanView', needsStage:true, triggers:[
    {key:'stageEntryForward',  label:'Stage Entry Moving Forward',  icon:'forward',   settings:['stage']},
    {key:'stageEntryBackward', label:'Stage Entry Moving Backward', icon:'arrowLeft', settings:['stage']},
    {key:'stageExit',          label:'Stage Exit',                  icon:'export',    settings:['stage']},
    {key:'stayAtStage',        label:'Stay at Stage',               icon:'clock',     settings:['stage', 'duration']},
  ]},
  // Pipeline events: Record and Record + Pipeline contexts.
  {key:'pipeline', label:'Pipeline Events', icon:'kanbanView', noStage:true, triggers:[
    {key:'pipelineEntry',  label:'Pipeline Entry',   icon:'forward', settings:['pipelineOnly']},
    {key:'pipelineExit',   label:'Pipeline Exit',    icon:'export',  settings:['pipelineOnly']},
    {key:'stayInPipeline', label:'Stay in Pipeline', icon:'clock',   settings:['pipelineOnly', 'duration']},
  ]},
  {key:'record', label:'Record Events', icon:'cube', triggers:[
    {key:'recordCreated', label:'New Record', icon:'plus'},
    /* An associated record of the chosen Object (a contact's deals or customers…) and its parameter:
       Is created, Is not created, Is changed, Is not changed (ASSOCIATED_RECORD_PARAMS). */
    {key:'associatedRecord', label:'Associated Record', icon:'openRecord', settings:['associatedObject']},
    {key:'recordUpdated', label:'Record Is Changed', icon:'edit'},
    // None of the record's properties (its stage too) changed for the duration — once per quiet period.
    {key:'recordNotChanged', label:'Record Is Not Changed', icon:'clock', settings:['duration']},
    {key:'formSubmitted', label:'Form Submitted',   icon:'forms', settings:['form']},
  ]},
  {key:'activity', label:'Activity Events', icon:'activity', triggers:[
    {key:'emailEvents',   label:'Email Events',   icon:'envelope', settings:['activityProperty']},
    {key:'callEvents',    label:'Call Events',    icon:'call',     settings:['activityProperty']},
    {key:'meetingEvents', label:'Meeting Events', icon:'calendar', settings:['activityProperty']},
    {key:'taskEvents',    label:'Task Events',    icon:'tasks',    settings:['activityProperty']},
    {key:'noteEvents',    label:'Note Events',    icon:'notepad',  settings:['activityProperty']},
    {key:'quoteEvents',   label:'Quote Events',   icon:'quote',    settings:['activityProperty']},
    {key:'fileEvents',    label:'File Events',    icon:'files',    settings:['activityProperty']},
  ]},
];
// A group in a context: Company-wide, Property, Stage — the document's rules (see above).
const triggerGroupAvailable = (g, context) => {
  const ctx = context || {};
  if(!g) return false;
  if(!ctx.object) return !!g.company;
  if(ctx.property) return !!g.inProperty;
  if(g.needsStage && !ctx.stage) return false;
  if(g.noStage && ctx.stage) return false;
  return true;
};
// The group a trigger belongs to.
const triggerGroupOf = (trigger) => WORKFLOW_TRIGGER_GROUPS.find(g => g.triggers.some(t => t.key === trigger));
// Whether a trigger fits the context: its group's, and for a property trigger its category's.
const triggerAvailableIn = (trigger, config, context) => triggerGroupAvailable(triggerGroupOf(trigger), context)
  && (trigger !== 'propertyUpdate' || propertyScopeAvailable(scopeOf(config), context));
// A trigger's name as the builder shows it (a property trigger: its category, e.g. "Customer Profile Property").
const triggerLabelOf = (v) => v && v.trigger === 'propertyUpdate' ? propertyScopeOf(scopeOf(v.triggerConfig)).label : ((workflowTrigger(v && v.trigger) || {}).label || (v && v.trigger) || '');
const workflowTrigger = (key) => {
  for(const g of WORKFLOW_TRIGGER_GROUPS){ const t = g.triggers.find(x => x.key === key); if(t) return {...t, group:g.key}; }
  return null;
};
/* The trigger's own settings, given the context: a stage trigger asks for the pipeline and stage
   only when the context doesn't already hold them (never twice). An activity property adds its
   template (a specific email), or Repeat and the count condition (a count) — shown from the start
   where every property is a count (Calls, Meetings, Tasks, Notes). */
const triggerSettingFields = (trig, context, config) => {
  const ctx = context || {}, out = [];
  ((trig && trig.settings) || []).forEach(s => {
    if(s === 'stage'){ if(!ctx.pipeline) out.push('pipeline'); if(!ctx.stage) out.push('stage'); }
    else if(s === 'pipelineOnly'){ if(!ctx.pipeline) out.push('pipeline'); }
    // The associated Object, its parameter, and — Is not created / Is not changed — when it's checked.
    else if(s === 'associatedObject'){ out.push('associatedObject', 'assocParam'); if(associatedParamTimed((config || {}).assocParam)) out.push('assocTiming'); }
    else if(s === 'activityProperty'){
      out.push(s);
      const at = ACTIVITY_TRIGGER_TYPES[trig.key], p = activityTriggerProperty(trig.key, (config || {}).activityProperty);
      if(p && p.ago) out.push('template', 'agoDuration');
      else if(p && p.template) out.push('template');
      else if(p && p.each){ if(p.outcomeFilter) out.push('callOutcome'); }
      else if(p || at.properties.every(x => !x.template && !x.each)) out.push('countCondition', 'repeat');
    }
    else out.push(s);
  });
  return out;
};
// Where a workflow's stage triggers point: its context, else its trigger settings.
const workflowPipeline = (w) => (w.context && w.context.pipeline) || (w.triggerConfig || {}).pipeline || null;
const workflowStage = (w) => (w.context && w.context.stage) || (w.triggerConfig || {}).stage || null;
/* Older drafts: the property lived in the context (it's trigger configuration now); property
   triggers were split into Created / Updated / Cleared (one Property Update now); Stage Entry and
   Stage Movement are Stage Entry Moving Forward / Backward now; activity triggers picked an event
   (and Call Logs a call property) where they pick an activity property now. */
const OLD_STAGE_TRIGGERS = {stageEntry:'stageEntryForward', stageForward:'stageEntryForward', stageBackward:'stageEntryBackward'};
const OLD_ACTIVITY_EVENTS = {emailSent:'emailSent', emailScheduled:'emailScheduled', meetingScheduled:'scheduledMeetings', taskCreated:'createdTasks', taskCompleted:'completedTasks', noteAdded:'notes'};
const normalizeTriggerEntry = (t) => {
  let out = ['propertyCreated', 'propertyUpdated', 'propertyCleared'].includes(t.trigger) ? {...t, trigger:'propertyUpdate'} : t;
  if(OLD_STAGE_TRIGGERS[out.trigger]) out = {...out, trigger:OLD_STAGE_TRIGGERS[out.trigger]};
  const oc = out.triggerConfig || {};
  if(ACTIVITY_TRIGGER_TYPES[out.trigger] && !oc.activityProperty && (oc.callProperty || oc.event)){
    const {callProperty, event, filter, ...rest} = oc;
    const activityProperty = callProperty || OLD_ACTIVITY_EVENTS[event] || '';
    out = {...out, triggerConfig:{...rest, activityProperty, ...(['emailSent', 'emailScheduled'].includes(activityProperty) && filter ? {template:filter} : {})}};
  }
  // Associated Record Created became Associated Record · Is created.
  if(out.trigger === 'associatedRecordCreated') out = {...out, trigger:'associatedRecord', triggerConfig:{...(out.triggerConfig || {}), assocParam:'created'}};
  // When (CONDITION_WHEN): saved before it, In this stage stays; a duration is Within a time period.
  const wc = out.triggerConfig || {};
  if(!wc.when && ((out.trigger === 'propertyUpdate' && ['changed', 'notChanged'].includes(wc.op)) || (out.trigger === 'associatedRecord' && associatedParamTimed(wc.assocParam)))
    && (wc.inStage || Number(wc.changeAmount) > 0)) out = {...out, triggerConfig:{...wc, when: wc.inStage ? 'stage' : 'period'}};
  // Property triggers: their scope (the record's own unless set).
  if(out.trigger === 'propertyUpdate'){ const c = out.triggerConfig || {}; if(!c.scope) out = {...out, triggerConfig:{...c, scope:scopeOf(c)}}; }
  /* Merged parameters: Call Made is Number of Calls (with an outcome, that outcome's count) with
     Repeat; Number of Answered Calls is Connected Calls; Number of Signed Quotes is Quote Signed;
     Quote Accepted was Quote Signed (each one: Repeat). */
  const mc = out.triggerConfig || {}, ap = mc.activityProperty;
  if(out.trigger === 'callEvents' && ap === 'callMade'){ const {outcome, ...r} = mc; out = {...out, triggerConfig:{...r, activityProperty:outcome || 'all', repeat:true}}; }
  else if(out.trigger === 'callEvents' && ap === 'answered') out = {...out, triggerConfig:{...mc, activityProperty:'Connected'}};
  else if(out.trigger === 'quoteEvents' && ap === 'signedQuotes') out = {...out, triggerConfig:{...mc, activityProperty:'quoteSigned'}};
  else if(out.trigger === 'quoteEvents' && ap === 'quoteAccepted') out = {...out, triggerConfig:{...mc, activityProperty:'quoteSigned', repeat:true}};
  return {...out, triggerConfig:out.triggerConfig || {}};
};
/* ── Workflows: where they can run, and saving them ── Workflows run on Contacts, Deals and
   Customers (the engine's events come from their records; a contact's stages are its Types of
   Contact); other Objects don't offer workflows until they're supported. */
const WORKFLOW_OBJECTS = ['contacts', 'deals', 'customers'];
const workflowsAvailableFor = (objectId) => WORKFLOW_OBJECTS.includes(objectId);
// Associated Record: the Objects whose records can be associated with this Object's (the workspace's others).
const associatedObjectsOf = (objectId) => WORKFLOW_OBJECTS.filter(o => o !== objectId && workspaceHasType(o));
/* Its parameters. Is not created: the record still has none of them (one created earlier counts).
   Is changed: any property or stage change on any of them. Is not changed: none of them changed.
   The two "not" ones are checked after a duration — or In this stage (a Stage context), as for a
   property that's not changed. */
const ASSOCIATED_RECORD_PARAMS = [
  {value:'created', label:'Is created'}, {value:'notCreated', label:'Is not created', timed:true},
  {value:'changed', label:'Is changed'}, {value:'notChanged', label:'Is not changed', timed:true},
];
const associatedParamTimed = (v) => !!(ASSOCIATED_RECORD_PARAMS.find(x => x.value === v) || {}).timed;
const objectSingular = (data, objectId) => objectName(data, objectId).replace(/s$/, '');
// "Associated Deal is created", "No associated Customer is created within 7 days", "Associated Deal is not changed in this stage".
const associatedRecordSummary = (data, w) => {
  const c = w.triggerConfig || {};
  if(!c.associatedObject || !c.assocParam) return '';
  const x = objectSingular(data, c.associatedObject);
  if(associatedParamTimed(c.assocParam)){
    const when = whenPhrase(c, w.context, c.assocParam === 'notChanged' ? 'for' : 'within');
    return when ? `${x} is ${c.assocParam === 'notCreated' ? 'not created' : 'not changed'} ${when}` : '';
  }
  return `${x} is ${c.assocParam === 'changed' ? 'changed' : 'created'}`;
};
const associatedParamHelp = (data, ctx, c) => {
  const x = c.associatedObject ? objectSingular(data, c.associatedObject).toLowerCase() : 'record', me = objectSingular(data, ctx.object).toLowerCase();
  return ({
    created:`A new ${x} is linked to this ${me}.`,
    notCreated:`This ${me} has no ${x}.`,
    changed:`A linked ${x} changes.`,
    notChanged:`No linked ${x} changes`,
  })[c.assocParam] || '';
};
/* Each save is a new version of the workflow (runs record the version they ran); a new workflow
   is active unless it was switched off before saving. Shared by the pipeline panel and the
   Workflows page. */
/* Each saved version is kept (`history`, oldest first, without their own history) with when and by
   whom it was saved — what Revert restores. */
const workflowSnapshot = ({history, ...w}) => w;
const nextWorkflowVersion = (prev, w) => {
  /* New Records counts from when the workflow is configured with it: the save that sets it (a
     new workflow, or one switched from All Records) stamps `scopeSince`; later edits keep it. */
  const wasNew = prev && normalizeWorkflow(prev).triggerScope === 'new' && prev.scopeSince;
  const scopeSince = w.triggerScope === 'new' ? (wasNew ? prev.scopeSince : Date.now()) : null;
  return {...w, scopeSince, active: w.active !== false, version:((prev && prev.version) || 0) + 1, savedAt:Date.now(), savedBy:CURRENT_USER.name,
    history: prev ? [...(prev.history || []), workflowSnapshot(prev)] : []};
};
const saveWorkflowIn = (setData, w, newTemplates = []) => setData(d => {
  const list = d.workflows || [];
  const prev = list.find(x => x.id === w.id);
  // A new workflow is its creator's (Workflows permissions go by who created it).
  const next = nextWorkflowVersion(prev, {...w, restoredFrom:null, createdBy:(prev && prev.createdBy) || w.createdBy || CURRENT_USER.name});
  return {...d, workflows: prev ? list.map(x => x.id === w.id ? next : x) : [...list, next],
    ...(newTemplates.length ? {emailTemplates:[...emailTemplatesOf(d), ...newTemplates]} : {})};
});
/* Revert: an earlier version's configuration becomes the next version (the current one joins the
   history). The name, permissions and on / off stay as they are now — they aren't the version's
   configuration. */
const WORKFLOW_KEPT_ON_RESTORE = ['id', 'name', 'createdBy', 'active', 'excludedUsers'];
const restoreWorkflowVersionIn = (setData, id, version) => setData(d => ({...d, workflows:(d.workflows || []).map(w => {
  const snap = w.id === id && (w.history || []).find(h => h.version === version);
  if(!snap) return w;
  const config = Object.fromEntries(Object.entries(snap).filter(([k]) => !WORKFLOW_KEPT_ON_RESTORE.includes(k) && !['version', 'savedAt', 'savedBy', 'restoredFrom', 'scopeSince'].includes(k)));
  const kept = Object.fromEntries(WORKFLOW_KEPT_ON_RESTORE.map(k => [k, w[k]]));
  const restored = {...nextWorkflowVersion(w, {...config, ...kept}), restoredFrom:version};
  // A version that no longer fits (a stage, template or person gone) comes back turned off, to be fixed — as Save requires.
  return workflowReady(normalizeWorkflow(restored), d) ? restored : {...restored, active:false};
})}));
// Turning on needs the workflow ready, as Save does (one that needs attention stays off).
const setWorkflowActiveIn = (setData, id, v) => setData(d => ({...d, workflows:(d.workflows || []).map(w => w.id === id && (!v || workflowReady(normalizeWorkflow(w), d)) ? {...w, active:v} : w)}));
const deleteWorkflowIn = (setData, id) => setData(d => ({...d, workflows:(d.workflows || []).filter(w => w.id !== id)}));

/* Workflow types — chosen first in the builder; every action of the workflow runs the type's way:
     Enforce Rules     — its actions run automatically when the triggers are met, and Block Stage
                         Entry keeps records out of a stage (a blocked person is shown what's
                         blocking them — the triggers — and what they can do about it).
     Track Violations  — its triggers are the violation conditions: when they're met, a Workflow
                         Violation is raised on the record, naming the requirement and the action
                         that resolves it (doing it resolves the violation).
   No workflow can be overridden or bypassed. */
const WORKFLOW_TYPES = [
  {key:'enforce', label:'Enforce Rules', behavior:'automatic', icon:'shield',
   description:'Automatically enforce business rules and apply configured actions.'},
  {key:'track', label:'Track Violations', behavior:'required', icon:'warning',
   description:'Detect rule violations and record them for tracking and resolution.'},
];
const workflowTypeOf = (key) => WORKFLOW_TYPES.find(t => t.key === key) || null;
// An action fits a type when it can run that type's way (Block Stage Entry: Enforce Rules only).
const actionFitsType = (typeKey, a) => { const t = workflowTypeOf(typeKey), opts = behaviorOptions(a.type, a.config); return !t || !opts || opts.includes(t.behavior); };
// Each action takes its workflow type's behavior (where it can run that way).
const withTypeBehavior = (actions, typeKey) => { const t = workflowTypeOf(typeKey); return !t ? actions
  : (actions || []).map(a => behaviorOptions(a.type, a.config) && actionFitsType(typeKey, a) ? {...a, config:{...(a.config || {}), behavior:t.behavior}} : a); };
/* Workflow permissions — the signed-in user's Workflows permissions (Edit Permissions → Workflows,
   workflowCan): View, Create, Edit, Delete, by who created the workflow. Edit covers changing its
   configuration, renaming it, turning it on and off and restoring a version; without it the builder
   is view-only. (The per-workflow Edit / Stop / Revert lists were replaced by these.) */
const canWorkflow = (data, w, key) => workflowCan(key === 'stop' ? 'edit' : key);
/* ── Identical workflows targeting the same people ── two workflows are identical when everything
   but their name, Applies To and saved details matches: type, context, triggers (and how they
   relate), Trigger Scope and actions. Saving one whose people overlap an identical saved one asks
   who each overlapping person follows; the other workflow excludes them from then on (a new
   version; its past runs stay in the history, and its steps still scheduled for them are cancelled).
   The exclusion lasts only while that other workflow is on, still identical and still applies to
   them (workflowEngine.jsx appliesToOwner): otherwise this one applies to them again. */
const stableJson = (v) => Array.isArray(v) ? `[${v.map(stableJson).join(',')}]`
  : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stableJson(v[k])}`).join(',')}}` : JSON.stringify(v);
// The ids every entry gets (each email, task, rule…) aren't part of what a workflow does.
const withoutIds = (v) => Array.isArray(v) ? v.map(withoutIds) : v && typeof v === 'object' && !(v instanceof Date)
  ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'id').map(([k, x]) => [k, withoutIds(x)])) : v;
const workflowSignature = (w) => { const n = normalizeWorkflow(w);
  return stableJson(withoutIds({type:n.type, context:n.context, triggerMatch:n.triggerMatch, triggerScope:n.triggerScope,
    triggers:(n.triggers || []).map(t => ({trigger:t.trigger, config:t.triggerConfig || {}})), actions:n.actions || []})); };
// The people a workflow applies to (activated users).
const workflowTargets = (data, w) => (data.users || []).filter(u => u.status === 'Activated' && appliesToOwner(w, u.id)).map(u => u.id);
const workflowOverlaps = (data, w) => {
  const mine = new Set(workflowTargets(data, w)), sig = workflowSignature(w);
  // Only one that's on: a turned-off workflow runs for no one.
  return (data.workflows || []).filter(o => o.id !== w.id && o.active !== false && workflowSignature(o) === sig)
    .map(o => ({workflow:o, users:workflowTargets(data, o).filter(id => mine.has(id))})).filter(x => x.users.length);
};
/* Who follows which workflow, for each overlapping person; Continue once every one is chosen.
   Choosing this workflow changes the other one — that needs Workflows → Edit. */
function WorkflowOverlapModal({data, name, overlaps, onCancel, onResolve}){
  const [pick, setPick] = React.useState({});   // '<workflowId>:<userId>' → 'this' | 'other'
  const keyOf = (o, uid) => `${o.workflow.id}:${uid}`;
  const all = overlaps.flatMap(o => o.users.map(uid => keyOf(o, uid)));
  const mayChangeOther = workflowCan('edit');
  const radio = (k, v, label, disabled) => (
    <label style={{display:'flex', alignItems:'center', gap:6, fontSize:13, color: disabled ? T.gray400 : T.attioText, cursor: disabled ? 'default' : 'pointer'}}>
      <input type="radio" name={k} checked={pick[k] === v} disabled={disabled} onChange={()=>setPick(p => ({...p, [k]:v}))} style={{margin:0, accentColor:T.black}}/>{label}
    </label>
  );
  return (
    <StModal title="People in Two Identical Workflows" primary="Continue" width={560} canSubmit={all.every(k => pick[k])} onCancel={onCancel} onSubmit={()=>onResolve(pick)}>
      <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>
        This workflow matches another one, and some people are in both. Choose which workflow applies to each of them. The other one stops applying to them from now on; its run history is kept.
      </div>
      {overlaps.map(o => (
        <div key={o.workflow.id} style={{display:'flex', flexDirection:'column', gap:8}}>
          <span style={{fontSize:12.5, fontWeight:600, color:T.gray600}}>{o.workflow.name || workflowTitle(data, o.workflow) || 'Workflow'}</span>
          {o.users.map(uid => { const k = keyOf(o, uid);
            return (
              <div key={uid} style={{display:'grid', gridTemplateColumns:'1fr auto auto', alignItems:'center', gap:16, padding:'6px 0', borderTop:`1px solid ${T.attioLine}`}}>
                <span style={{fontSize:13, color:T.attioText}}>{userName(data, uid)}</span>
                {radio(k, 'this', name || 'This workflow', !mayChangeOther)}
                {radio(k, 'other', o.workflow.name || 'The other workflow')}
              </div>
            ); })}
        </div>
      ))}
      {!mayChangeOther && <div style={stTextB}>Keeping someone in this workflow changes the other one, which needs Workflows → Edit.</div>}
    </StModal>
  );
}
// Renaming changes the name only — not the configuration, and not the version.
const renameWorkflowIn = (setData, id, name) => setData(d => ({...d, workflows:(d.workflows || []).map(w => w.id === id ? {...w, name} : w)}));
/* One trigger (`trigger`, `triggerConfig`) became a list (`triggers`); the old one is its first. */
const LEGACY_TRIGGER_ID = 'tr-1';
const normalizeWorkflow = (w) => {
  if(!w) return w;
  const {trigger, triggerConfig, ...rest} = w;
  const triggers = (w.triggers || (trigger ? [{id:LEGACY_TRIGGER_ID, trigger, triggerConfig:triggerConfig || {}}] : [])).map(normalizeTriggerEntry);
  /* Behavior moved from the workflow (Workflow Type, and before it each action's mode) onto each
     action: an action saved without one keeps how it ran. */
  const {workflowType:oldType, ...kept} = rest;
  /* Only saved workflows carry the old setting; a new action without a Behavior takes its default.
     Saved actions that had no setting keep how they ran: Move Stage and Create Task automatically,
     Add Note as its prompt toggle / predefined note said, meetings by asking. */
  const ranAs = {moveStageForward:'automatic', moveStageBackward:'automatic', moveToStage:'automatic', createTask:'automatic', scheduleEmail:'automatic',
    addNote:(c) => c.prompt ? 'required' : c.specific ? 'automatic' : 'required'};
  const legacy = (a) => {
    const c = a.config || {};
    if(['setPropertyValue', 'clearProperty', 'promptUpdateProperty', 'createAssociatedObject'].includes(a.type)) return oldType || ({prompt:'required', auto:'automatic'})[c.mode] || null;
    if(!w.version) return null;   // not saved yet
    const r = ranAs[a.type];
    return typeof r === 'function' ? r(c) : r || null;
  };
  /* Suggestive is no longer a Behavior: an action saved as Suggestive (it waited for a person) is
     Required now. */
  const actions = (w.actions || []).map(a0 => {
    const a = a0.config && a0.config.behavior === 'suggestive' ? {...a0, config:{...a0.config, behavior:'required'}} : a0;
    const opts = behaviorOptions(a.type, a.config);
    const was = opts && !(a.config || {}).behavior && legacy(a);
    return was ? {...a, config:{...(a.config || {}), behavior: opts.includes(was) ? was : opts[0]}} : a;
  });
  // Per-workflow permission lists and Override no longer exist — dropped (Workflows permissions apply).
  const {overrides:oldOverrides, permissions:oldPermissions, ...rest2} = kept;
  /* Trigger Scope: a new workflow starts on New Records; one saved before the setting existed
     keeps applying to all records, as it did. */
  const triggerScope = TRIGGER_SCOPES.some(s => s.key === w.triggerScope) ? w.triggerScope : w.version ? 'all' : 'new';
  /* Workflow type: a workflow saved before types existed takes the one its actions ran as — Enforce
     Rules when it blocks a stage or runs only automatic actions, else Track Violations. A new draft
     has none until it's chosen. */
  const type = workflowTypeOf(w.type) ? w.type
    : (w.version || actions.length) ? (actions.some(a => a.type === 'blockEntry') || (actions.length && actions.every(a => actionBehavior(a) === 'automatic')) ? 'enforce' : 'track')
    : null;
  const name = w.name;
  return {...rest2, ...(name !== undefined ? {name} : {}), type, context:w.context || {}, triggers, triggerMatch: w.triggerMatch || 'all', triggerScope, actions:withTypeBehavior(actions, type),
    appliesTo:Array.isArray(w.appliesTo) ? w.appliesTo : []};
};
/* Trigger Scope options (what a "new" record is in each context: see the header). */
const TRIGGER_SCOPES = [{key:'new', label:'New Record'}, {key:'all', label:'All Records'}];
/* Each trigger as a single-trigger view of its workflow ({...workflow, trigger, triggerConfig,
   triggerId}) — what the per-trigger helpers (settings, summary, matching) read. */
const workflowTriggerViews = (w) => { const n = normalizeWorkflow(w); return n.triggers.map(t => ({...n, trigger:t.trigger, triggerConfig:t.triggerConfig || {}, triggerId:t.id})); };
// 'all' relates the triggers only when there are two or more.
const triggersMatchAll = (w) => w.triggerMatch === 'all' && (w.triggers || []).length > 1;
// Properties a property trigger can watch: Deal Stage and Pipeline belong to Stage Events. Of the
// automatic ones, only the association properties the engine reads (associatedNames: a deal's
// Associated Customer, a customer's Associated Deal, a contact's deals and customers).
const TRIGGER_ASSOCIATION_KEYS = {deals:['customers'], customers:['deals'], contacts:['deals', 'customers']};
const triggerProperties = (data, objectId) => objectProperties(data, objectId).filter(p => (!p.auto || (TRIGGER_ASSOCIATION_KEYS[objectId] || []).includes(p.key)) && !['stage', 'pipeline'].includes(p.key));

/* Context levels, in order: label, what they need (`after`), options (from the level above), and
   the levels that depend on them (removed with them; kept on a change only while still valid). */
const WORKFLOW_CONTEXT_LEVELS = ['object', 'property', 'pipeline', 'stage'];
const WORKFLOW_CONTEXT_FIELDS = {
  // The Objects workflows run on.
  object:   {label:'Record', clears:['property', 'pipeline', 'stage'], options:(data) => data.objects.filter(o => WORKFLOW_OBJECTS.includes(o.id)).map(o => ({value:o.id, label:o.name}))},
  property: {label:'Property', after:'object', options:(data, ctx) => triggerProperties(data, ctx.object).map(p => ({value:p.key, label:p.label}))},
  pipeline: {label:'Pipeline', after:'object', clears:['stage'], options:(data, ctx) => objectPipelines(data, ctx.object).map(p => ({value:p.id, label:p.label}))},
  stage:    {label:'Stage', after:'pipeline', options:(data, ctx) => (((data.pipelines || []).find(p => p.id === ctx.pipeline) || {}).stages || []).map(s => ({value:s.id, label:s.label}))},
};
// The display name of a context value (e.g. 'us-niw' → 'US NIW').
const workflowContextLabel = (data, key, ctx) => ((WORKFLOW_CONTEXT_FIELDS[key].options(data, ctx) || []).find(o => o.value === ctx[key]) || {}).label || '';
// "Migration CRM → Deals → Total Amount → US NIW → CCL Sent": the branch first (levels added but not chosen yet are left out).
const contextPathOf = (data, ctx) => [`${ACTIVE_CRM.name} CRM`, ...WORKFLOW_CONTEXT_LEVELS.filter(k => ctx && ctx[k]).map(k => workflowContextLabel(data, k, ctx))].join(' → ');
// A stage's name, in whichever pipeline it's in.
const anyStageLabel = (data, id) => (((data.pipelines || []).flatMap(p => p.stages || [])).find(s => s.id === id) || {}).label || '';

/* Needs attention — a trigger or action the context no longer fits: {message, fix?}, else null.
   Nothing is changed for the user; a `fix` is offered where one choice puts it right (it returns
   the corrected config). */
const triggerIssue = (data, w) => {
  const t = workflowTrigger(w.trigger);
  if(!t) return null;
  const ctx = w.context || {}, c = w.triggerConfig || {}, g = triggerGroupOf(w.trigger);
  if(t.key === 'propertyUpdate' && !propertyScopeAvailable(scopeOf(c), ctx)) return {message: !ctx.object
    ? `${propertyScopeOf(scopeOf(c)).label} needs a Record in the context — Company-wide workflows use User Property triggers.` : 'A Property context offers Record Property triggers only.'};
  if(!triggerGroupAvailable(g, ctx)) return {message: !ctx.object ? `${g.label} need a Record in the context — Company-wide workflows use User Property triggers.`
    : ctx.property ? `A Property context offers property triggers only.` : g.needsStage ? `${g.label} need a Stage in the context.`
    : g.noStage ? `${g.label} aren't available at a Stage — use the Record or Pipeline context.` : `${g.label} aren't available here.`};
  const objName = objectName(data, ctx.object);
  if(t.key === 'associatedRecord' && c.associatedObject && !associatedObjectsOf(ctx.object).includes(c.associatedObject))
    return {message:`${objName} records don’t have an associated ${objectSingular(data, c.associatedObject)}. Choose the associated object.`};
  const timed = (t.key === 'associatedRecord' && associatedParamTimed(c.assocParam)) || (t.key === 'propertyUpdate' && isChangeOp(c.op));
  if(timed && c.when === 'stage' && !ctx.stage)
    return {message:'In this stage needs a Stage in the context.', fix:{label:'Use a time period instead', apply:(cfg) => ({...cfg, when:'period', inStage:false})}};
  /* Block Stage Entry decides as the record enters — a time period has no deadline yet then. */
  if(timed && c.when === 'period' && (w.actions || []).some(a => a.type === 'blockEntry'))
    return {message:'Block Stage Entry checks this as the record enters the stage. Choose In this stage or Throughout the record’s lifecycle.',
      ...(ctx.stage ? {fix:{label:'Use In this stage', apply:(cfg) => ({...cfg, when:'stage', inStage:true})}} : {})};
  if(t.key === 'propertyUpdate' && scopeOf(c) !== 'record'){
    if(c.property && !(scopeFields(data, scopeOf(c)) || []).some(f => f.key === `prop:${c.property}`)) return {message:'That property is no longer available. Choose a property.'};
    if(isChangeOp(c.op) && c.when === 'stage' && !ctx.stage) return {message:'In this stage needs a Stage in the context.', fix:{label:'Use a time period instead', apply:(cfg) => ({...cfg, when:'period', inStage:false})}};
  }
  if(t.key === 'propertyUpdate' && scopeOf(c) === 'record'){
    const props = objectProperties(data, ctx.object), label = (k) => (props.find(p => p.key === k) || {}).label || k;
    if(ctx.property && c.property && c.property !== ctx.property) return {message:`Watches ${label(c.property)}, but the context property is ${label(ctx.property)}.`,
      fix:{label:`Use ${label(ctx.property)}`, apply:(cfg) => ({...cfg, ...adaptPropertyCondition(data, w, ctx.property)})}};
    if(c.property && !triggerProperties(data, ctx.object).some(p => p.key === c.property)) return {message:`${label(c.property)} isn't a property of ${objName}. Choose a property.`};
    if(isChangeOp(c.op) && c.when === 'stage' && !ctx.stage) return {message:'In this stage needs a Stage in the context.',
      fix:{label:'Use a time period instead', apply:(cfg) => ({...cfg, when:'period', inStage:false})}};
  }
  if(t.group === 'stage'){
    const pipeLabel = (id) => workflowContextLabel(data, 'pipeline', {object:ctx.object, pipeline:id}) || id;
    if(ctx.pipeline && c.pipeline && c.pipeline !== ctx.pipeline) return {message:`Set for pipeline \u201c${pipeLabel(c.pipeline)}\u201d, but the context pipeline is \u201c${pipeLabel(ctx.pipeline)}\u201d.`,
      fix:{label:`Use \u201c${pipeLabel(ctx.pipeline)}\u201d`, apply:(cfg) => {
        const n = {...cfg}; delete n.pipeline;
        if(!ctx.stage && n.stage && !WORKFLOW_CONTEXT_FIELDS.stage.options(data, ctx).some(o => o.value === n.stage)) delete n.stage;
        return n;
      }}};
    if(ctx.stage && c.stage && c.stage !== ctx.stage) return {message:`Set for stage \u201c${anyStageLabel(data, c.stage)}\u201d, but the context stage is \u201c${anyStageLabel(data, ctx.stage)}\u201d.`,
      fix:{label:`Use \u201c${anyStageLabel(data, ctx.stage)}\u201d`, apply:(cfg) => { const n = {...cfg}; delete n.stage; return n; }}};
    const pipe = workflowPipeline(w), stage = workflowStage(w);
    if(pipe && !objectPipelines(data, ctx.object).some(p => p.id === pipe)) return {message:`That pipeline isn't one of ${objName}'s. Choose a pipeline.`};
    if(pipe && stage && !WORKFLOW_CONTEXT_FIELDS.stage.options(data, {pipeline:pipe}).some(o => o.value === stage))
      return {message:`\u201c${anyStageLabel(data, stage)}\u201d isn't a stage of ${pipeLabel(pipe)}. Choose a stage.`};
  }
  return null;
};
const PROPERTY_ACTIONS = ['setPropertyValue', 'clearProperty', 'promptUpdateProperty', 'promptClearProperty'], MOVE_STAGE_ACTIONS = ['moveStageForward', 'moveStageBackward', 'moveToStage'];
const actionIssue = (data, a, context, typeKey) => {
  const ctx = context || {}, c = a.config || {};
  // Add Note isn't a workflow action any more; one saved before stays until it's removed.
  if(a.type === 'addNote') return {message:'Add Note is no longer a workflow action. Remove it.'};
  if(typeKey && !actionFitsType(typeKey, a)){
    const label = (workflowAction(a.type) || {}).label || a.type;
    return {message: typeKey === 'enforce' ? `${label} needs someone's input, so it can't run automatically. Change the workflow type to Track Violations, or choose another action.`
      : `${label} runs automatically, so it can't be tracked as a violation. Change the workflow type to Enforce Rules, or choose another action.`};
  }
  // Company-wide (no record): only Notify.
  if(!ctx.object && a.type !== 'notify') return {message:'Needs a Record in the context — Company-wide workflows can only notify.'};
  if(a.type === 'moveToPipeline' && !c.pipeline) return {message:'Choose the pipeline to move to.', explained:true};
  /* Move to Specific Pipeline: a pipeline of the context's Record, and a destination stage still in it
     (a deleted stage isn't silently swapped for the first one). */
  if(a.type === 'moveToPipeline'){
    const pl = (data.pipelines || []).find(p => p.id === c.pipeline);
    if(!pl || (ctx.object && pl.objectId !== ctx.object)) return {message:`That pipeline isn't one of ${objectName(data, ctx.object || '') || 'the Record'}'s. Choose a pipeline.`};
    if(c.stage && !pl.stages.some(s => s.id === c.stage)) return {message:`The destination stage isn't in ${pl.label} any more. Choose a stage.`};
  }
  // Every action needs what it acts with — none saves empty (it would only ever be skipped).
  if(a.type === 'notify' && !((c.recipients || []).length || (c.users || []).length)) return {message:'Choose who to notify.', explained:true};
  if(a.type === 'moveToStage' && !c.stage) return {message:'Choose the stage to move to.', explained:true};
  if(PROPERTY_ACTIONS.includes(a.type) && !(c.properties || []).some(e => e.property)) return {message:'Choose a property.', explained:true};
  if(a.type === 'createTask' && !(c.tasks || []).some(t => (t.name || '').trim())) return {message:'Name the task.', explained:true};
  if(a.type === 'scheduleEmail' && !(c.emails || []).some(e => e.templateId)) return {message:'Choose an email template.', explained:true};
  if(a.type === 'createEmailActivity' && !(c.email || {}).templateId) return {message:'Choose an email template.', explained:true};
  // An email needs someone to go to.
  if(a.type === 'scheduleEmail' && (c.emails || []).some(e => e.templateId && !(e.recipients || []).length)) return {message:'Choose the recipients of each email.', explained:true};
  if(a.type === 'createEmailActivity' && !((c.email || {}).recipients || []).length) return {message:'Choose the recipients.', explained:true};
  if(a.type === 'exitEmailSequence' && !c.sequenceId) return {message:'Choose the email sequence.', explained:true};
  if(a.type === 'createAssociatedObject' && !associatedToCreate(c).length) return {message:'Choose the record to create.', explained:true};
  if(a.type === 'updateAssociatedRecord' && !(c.properties || []).some(e => e.property)) return {message:'Choose the properties to update.', explained:true};
  if(a.type === 'addCallLog' && actionBehavior(a) === 'automatic' && !c.outcome) return {message:'Choose the call outcome.', explained:true};
  // A person chosen who has since been deleted.
  const userIds = new Set((data.users || []).map(u => u.id));
  if(a.type === 'assignOwner' && c.method === 'person' && c.user && !userIds.has(c.user)) return {message:'The chosen owner was deleted. Choose another.', explained:true};
  if(a.type === 'updateAssociatedRecord' && !c.object) return {message:'Choose the associated record to update.', explained:true};
  if(a.type === 'classifyRecord' && !c.property) return {message:'Choose the property to classify.', explained:true};
  if(a.type === 'assignOwner' && !assignOwnerReady(c)) return {message:'Finish choosing how the owner is assigned.', explained:true};
  // An email's Cc and Bcc are email addresses (the field shows which isn't, as in the composer).
  if(actionEmails(a).some(e => !emailListValid(e.cc) || !emailListValid(e.bcc))) return {message:'Enter valid Cc and Bcc email addresses.', explained:true};
  if(PROPERTY_ACTIONS.includes(a.type) || a.type === 'createAssociatedObject'){
    if(!ctx.object) return {message:'Needs a Record in the context.', explained:true};   // the action's panel says so
    if(PROPERTY_ACTIONS.includes(a.type)){
      const props = objectProperties(data, ctx.object).filter(p => !p.auto);
      if((c.properties || []).some(e => e.property && !props.some(p => p.key === e.property))) return {message:`A chosen property isn't a property of ${objectName(data, ctx.object)}. Choose another.`};
    }
  }
  if(MOVE_STAGE_ACTIONS.includes(a.type)){
    const pipeline = (data.pipelines || []).find(p => p.id === ctx.pipeline);
    if(!pipeline) return {message:'Needs a Pipeline in the context.', explained:true};
    if(a.type === 'moveToStage' && c.stage && !pipeline.stages.some(s => s.id === c.stage)) return {message:`\u201c${anyStageLabel(data, c.stage)}\u201d isn't a stage of ${pipeline.label}. Choose a stage.`};
  }
  // Block Entry keeps records out of the context's stage, so it needs one.
  if(a.type === 'blockEntry' && !ctx.stage) return {message:'Needs a Stage in the context.', explained:true};
  return null;
};

/* Time amounts, used by Stay at Stage, an action's wait and Enroll in Email Sequence. */
const WORKFLOW_TIME_UNITS = ['Days', 'Weeks', 'Months', 'Years'];
const durationLabel = (d) => d && Number(d.amount) > 0 ? `${d.amount} ${Number(d.amount) === 1 ? d.unit.replace(/s$/, '') : d.unit}` : '';
/* Ready to save: the triggers ready (triggersReady — what Move to Action needs) and no action
   needing attention. A trigger is ready when it fits the context (no triggerIssue), its required
   settings are set (Repeat is optional) and, for Property Update, its own condition is complete —
   i.e. its summary can be written. */
const countConditionComplete = (c) => !!c.op && c.value !== '' && c.value != null && Number(c.value) >= 0;
/* Repeat goes with Is more than / Is less than: the workflow runs at every step the count takes in
   that direction while it meets the condition — every increment above it (7, 8, 9… for > 6), every
   decrement below it (5, 4, 3… for < 6). Not with Equals. */
const countRepeatable = (c) => !!c && (c.op === 'gt' || c.op === 'lt');
const repeatStepLabel = (c) => (c || {}).op === 'lt' ? 'decrement' : 'increment';
const triggersReady = (w, data) => { const views = workflowTriggerViews(w); return views.length > 0 && views.every(v => triggerReady(v, data)); };
// Actions ready (what Go to Workflow Control needs): the triggers ready, and at least one action, none needing attention.
const actionsReady = (w, data) => triggersReady(w, data) && (w.actions || []).length > 0 && w.actions.every(a => !actionIssue(data, a, w.context, w.type));
// Save: the actions ready, and a workflow type (chosen in Workflow Control) that fits every one.
const workflowReady = (w, data) => !!workflowTypeOf(w.type) && actionsReady(w, data);
/* An action's Behavior, set beneath the action: the options each action offers (the first is
   its default). Other actions have none yet — they're defined one by one later. */
const BEHAVIOR_OPTIONS = {
  required:   {label:'Required',   description:'The user must resolve the workflow requirement.'},
  automatic:  {label:'Automatic',  description:'The system executes the action without requiring user intervention.'},
};
const ALL_BEHAVIORS = ['required', 'automatic'];
const ACTION_BEHAVIORS = {
  /* Set Property Value: Enforce Rules sets it; Track Violations names the value that resolves the
     violation (the owner updates it — nothing is set on its own). Clearing is automatic; the
     prompts need the owner. */
  setPropertyValue:       ALL_BEHAVIORS,
  clearProperty:          ['automatic'],
  promptUpdateProperty:   ['required'],
  promptClearProperty:    ['required'],
  moveToPipeline:         ALL_BEHAVIORS,
  createEmailActivity:    ALL_BEHAVIORS,
  exitEmailSequence:      ['automatic'],
  createMeeting:          ALL_BEHAVIORS,
  addCallLog:             ALL_BEHAVIORS,
  // A live call can't happen by itself: the owner makes it (Track Violations).
  initiateCall:           ['required'],
  // A workflow never deletes on its own: the owner deletes, with their own permission.
  deleteRecord:           ['required'],
  updateAssociatedRecord: ['automatic'],
  classifyRecord:         ['automatic'],
  assignOwner:            ['automatic'],
  moveStageForward:       ALL_BEHAVIORS,
  moveStageBackward:      ALL_BEHAVIORS,
  moveToStage:            ALL_BEHAVIORS,
  createTask:             ALL_BEHAVIORS,
  scheduleEmail:          ALL_BEHAVIORS,
  scheduleMeeting:        ALL_BEHAVIORS,
  // Add Note: Automatic only with a predefined note (it's added as written).
  addNote:                (c) => (c || {}).specific && ((c || {}).body || '').trim() ? ALL_BEHAVIORS : ['required'],
  notify:                 ['automatic'],
  // Enforce Rules creates it (named after the record); Track Violations asks the owner to.
  createAssociatedObject: ALL_BEHAVIORS,
  // Block Stage Entry: Enforce Rules only — the record is kept out while the triggers hold (no override).
  blockEntry:             ['automatic'],
};
const behaviorOptions = (type, config) => { const o = ACTION_BEHAVIORS[type]; return typeof o === 'function' ? o(config) : o; };
const actionBehavior = (a) => { const opts = behaviorOptions(a.type, a.config); const b = (a.config || {}).behavior; return opts ? (opts.includes(b) ? b : opts[0]) : b || 'automatic'; };
/* Beneath an action's settings: how it runs — set by the workflow's type (Enforce Rules:
   automatically; Track Violations: as the Workflow Violation's resolving action). */
const behaviorField = (type, config, setConfig, single) => {
  const opts = behaviorOptions(type, config);
  if(!opts) return null;
  const b = actionBehavior({type, config});
  return cfgPart('How it runs', cfgHelp(single && b === 'automatic' ? single
    : b === 'automatic' ? 'Enforce Rules: runs automatically when the triggers are met.'
    : 'Track Violations: when the triggers are met, a Workflow Violation is raised on the record — doing this resolves it.'));
};
const triggerReady = (w, data) => {
  const t = workflowTrigger(w.trigger), c = w.triggerConfig || {};
  if(!t || t.disabled || triggerIssue(data, w)) return false;
  // Optional: Repeat, an email's template (any email), Call Made's outcome (any), the form (any), a pipeline event's pipeline (any).
  const optional = ['repeat', 'template', 'callOutcome', 'form', ...(workflowTrigger(w.trigger) && workflowTrigger(w.trigger).group === 'pipeline' ? ['pipeline'] : [])];
  const settings = triggerSettingFields(t, w.context, c).every(f => optional.includes(f)
    || (f === 'duration' ? Number(c.amount) > 0
      : f === 'agoDuration' ? Number(c.agoAmount) > 0
      : f === 'countCondition' ? countConditionComplete(c)
      : f === 'assocTiming' ? conditionWhenReady(c, w.context)
      : !!c[f]));
  return settings && (!t.requiresCondition || (!!data && triggerConditionComplete(data, w)));
};
/* A new property keeps the condition only where it still fits: the operator if the new type has it,
   the value if the type is the same and (for a select) the value is still one of its options. */
const adaptPropertyCondition = (data, w, property) => {
  const c = w.triggerConfig || {};
  const fields = conditionFields(data, {...w, trigger:'propertyUpdate'}) || [];
  const before = fields.find(f => f.key === `prop:${c.property}`), after = fields.find(f => f.key === `prop:${property}`);
  if(!after) return {property, op:'', value:''};
  const op = fieldOperators(after).some(o => o.id === c.op) ? c.op : '';
  const sameType = before && propertyTypeId((fieldProperty(before) || {}).type) === propertyTypeId((fieldProperty(after) || {}).type);
  const valueOk = sameType && (!after.options || !after.options.length || after.options.some(o => o.value === c.value));
  return {property, op, value: valueOk ? (c.value ?? '') : ''};
};
/* The trigger's condition in one line, for the Trigger node (and run titles): the user's own
   selections in a fixed sentence — Deal Name = “US NIW”, Record enters stage “CCL Sent” moving
   forward, Number of sent emails > 2, Repeat this when the number of notes increases by 1 every
   single time, Email “Onboarding” is sent. Empty until the configuration is complete. */
const wfQuote = (v) => `\u201c${v}\u201d`;
// Numbers read as symbols ("Total Amount > 5000"); every other operator by its name ("Country is “Canada”", "Tags contains any of …").
const PROPERTY_SUMMARY_SYMBOLS = {equals:'=', notEquals:'\u2260', gt:'>', lt:'<', gte:'\u2265', lte:'\u2264'};
const propertyConditionSummary = (data, w) => {
  const c = w.triggerConfig || {};
  const f = conditionFields(data, w).find(x => x.key === `prop:${c.property}`);
  // Is changed / Is not changed: "Deal Name is not changed for 20 days", "… is changed in this stage".
  if(f && isChangeOp(c.op)){
    const verb = c.op === 'changed' ? 'is changed' : 'is not changed';
    const when = whenPhrase(c, w.context, c.op === 'changed' ? 'within' : 'for');
    return when ? `${f.label} ${verb} ${when}` : '';
  }
  const op = f && fieldOperatorOf(f, c.op);
  const blankValue = Array.isArray(c.value) ? !c.value.length : c.value === '' || c.value == null;
  if(!op || (!op.noValue && blankValue)) return '';
  const compare = propertyCompare(fieldProperty(f) || 'Single-Line Text'), numeric = compare === 'number' || compare === 'amount';
  if(op.noValue) return `${f.label} ${op.label.toLowerCase()}`;
  const sym = numeric && PROPERTY_SUMMARY_SYMBOLS[op.id] || op.label.toLowerCase();
  const label = (v) => f.options && f.options.length ? ((f.options.find(o => (typeof o === 'string' ? o : o.value) === v) || {}).label || v) : v;
  const shown = Array.isArray(c.value) ? c.value.map(label).join(', ') : compare === 'date' ? (ptDay(c.value) !== null ? new Date(`${c.value}T00:00`).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric', timeZone:LOCAL_TZ}) : c.value) : label(c.value);
  return `${f.label} ${sym} ${numeric ? shown : wfQuote(shown)}`;
};
const STAGE_SUMMARIES = {
  stageEntryForward:  (s) => `Record enters stage ${wfQuote(s)} moving forward`,
  stageEntryBackward: (s) => `Record enters stage ${wfQuote(s)} moving backward`,
  stageExit:          (s) => `Record exits stage ${wfQuote(s)}`,
  stayAtStage:        (s, c) => durationLabel(c) ? `Record stays in stage ${wfQuote(s)} for ${durationLabel(c).toLowerCase()}` : '',
};
const activitySummary = (data, w) => {
  const c = w.triggerConfig || {}, p = activityTriggerProperty(w.trigger, c.activityProperty);
  if(!p) return '';
  if(p.ago){
    const tpl = emailTemplatesOf(data).find(t => t.id === c.template), d = durationLabel({amount:c.agoAmount, unit:c.agoUnit || 'Days'});
    return d ? `${tpl ? `Email ${wfQuote(tpl.name)}` : 'An email'} sent ${d.toLowerCase()} ago` : '';
  }
  if(p.template){
    const tpl = emailTemplatesOf(data).find(t => t.id === c.template);
    return tpl ? `Email ${wfQuote(tpl.name)} is ${p.template}` : `Any email is ${p.template}`;
  }
  if(p.each) return c.outcome ? `${p.label} · ${c.outcome}` : p.label;
  // Saved before Repeat took the condition: every increase.
  if(c.repeat && !countConditionComplete(c)) return `Repeat this when ${p.repeatSubject || `the number of ${p.noun}`} increases by 1 every single time`;
  const op = COUNT_OPERATORS.find(o => o.value === c.op);
  return op && countConditionComplete(c) ? `Number of ${p.noun} ${op.symbol} ${Number(c.value)}${c.repeat && countRepeatable(c) ? `, every ${repeatStepLabel(c)}` : ''}` : '';
};
const triggerSummary = (data, w) => {
  const t = workflowTrigger(w.trigger);
  if(!t || !w.context) return '';
  if(t.key === 'propertyUpdate'){
    const base = propertyConditionSummary(data, w), sc = scopeOf(w.triggerConfig);
    if(!base) return '';
    // Whose: the owner's (a record's) or a user's (Company-wide); any installment / payment terms.
    return sc === 'owner' ? `${(w.context || {}).object ? 'Owner' : 'User'}'s ${base}` : sc === 'accounting' ? `Any ${base}` : base;
  }
  const c = w.triggerConfig || {};
  if(['pipelineEntry', 'pipelineExit', 'stayInPipeline'].includes(t.key)){
    const pipe = workflowPipeline(w), name = pipe ? wfQuote(workflowContextLabel(data, 'pipeline', {object:(w.context || {}).object, pipeline:pipe})) : 'any pipeline';
    if(t.key === 'stayInPipeline') return durationLabel(c) ? `Record stays in ${name} for ${durationLabel(c).toLowerCase()}` : '';
    return `Record ${t.key === 'pipelineEntry' ? 'enters' : 'exits'} ${name}`;
  }
  if(t.key === 'recordNotChanged') return durationLabel(c) ? `Record is not changed for ${durationLabel(c).toLowerCase()}` : '';
  if(t.key === 'formSubmitted') return c.form ? `Form ${wfQuote(c.formName || 'selected')} is submitted` : 'Any form is submitted';
  if(t.key === 'associatedRecord') return associatedRecordSummary(data, w);
  if(STAGE_SUMMARIES[t.key]){
    const stage = workflowStage(w);
    return stage ? STAGE_SUMMARIES[t.key](workflowContextLabel(data, 'stage', {pipeline:workflowPipeline(w), stage}), w.triggerConfig || {}) : '';
  }
  if(ACTIVITY_TRIGGER_TYPES[t.key]) return activitySummary(data, w);
  return '';
};
const triggerDetail = triggerSummary;

/* Actions, in four categories (the Add Action menu; each opens its actions in a submenu, like
   the trigger groups): Property-Based, Stage-Based (Move Stage Forward / Backward, Move to
   Specific Stage, Block Entry), Activity-Based, Administrative. `modes`: the action runs
   automatically or prompts the record owner. `scheduled`: the action's entries carry their own
   schedule, so it has no wait; `instant`: it applies at the moment something happens (Block Entry
   — as a record tries to enter the stage), so it has no wait either. */
const WORKFLOW_ACTIONS = [
  // Setting and clearing run on their own (Enforce Rules); prompts ask the owner (Track Violations).
  {key:'propertyActions', label:'Property Based Actions', icon:'edit', children:[
    {key:'setPropertyValue',     label:'Set Property Value',            icon:'edit'},
    {key:'promptUpdateProperty', label:'Prompt to Update Property',     icon:'edit'},
    {key:'promptClearProperty',  label:'Prompt to Clear Property Value', icon:'close'},
    {key:'clearProperty',        label:'Clear Property Value',          icon:'close'},
  ]},
  {key:'stageActions', label:'Stage Based Actions', icon:'kanbanView', children:[
    {key:'moveStageForward',     label:'Move Stage Forward',        icon:'forward',   modes:true},
    {key:'moveStageBackward',    label:'Move Stage Backward',       icon:'arrowLeft', modes:true},
    {key:'moveToStage',          label:'Move to Specific Stage',    icon:'kanbanView', modes:true},
    {key:'blockEntry',           label:'Block Stage Entry',         icon:'lock', instant:true},
  ]},
  {key:'pipelineActions', label:'Pipeline Based Actions', icon:'kanbanView', children:[
    {key:'moveToPipeline',       label:'Move to Specific Pipeline', icon:'kanbanView'},
  ]},
  {key:'recordActions', label:'Record Based Actions', icon:'cube', children:[
    {key:'createAssociatedObject', label:'Create Associated Record', icon:'cube'},
    {key:'updateAssociatedRecord', label:'Update Associated Record', icon:'edit'},
    {key:'deleteRecord',           label:'Delete Record',            icon:'trash'},
    {key:'classifyRecord',         label:'Classify Record (AI)',     icon:'sparkle'},
  ]},
  // Log vs live: Add Call Log / Create Meeting record what happened; Initiate Call / Schedule Meeting are live.
  {key:'activityActions', label:'Activity Based Actions', icon:'activity', children:[
    {key:'createTask',           label:'Create Task',               icon:'tasks'},
    {key:'createEmailActivity',  label:'Create Email Activity',     icon:'envelope'},
    {key:'scheduleEmail',        label:'Enroll in Email Sequence',  icon:'clock', scheduled:true},
    {key:'exitEmailSequence',    label:'Exit Email Sequence',       icon:'close'},
    {key:'createMeeting',        label:'Create Meeting',            icon:'videoCamera'},
    {key:'scheduleMeeting',      label:'Schedule Meeting',          icon:'calendar'},
    {key:'addCallLog',           label:'Add Call Log',              icon:'call'},
    {key:'initiateCall',         label:'Initiate Call',             icon:'call'},
  ]},
  {key:'adminActions', label:'Administrative Actions', icon:'settingsGear', children:[
    {key:'notify',                 label:'Notify',              icon:'notification'},
    {key:'assignOwner',            label:'Assign Record Owner', icon:'userSwitch'},
  ]},
];
// Add Note was removed from the catalogue; a saved one still shows its name.
const RETIRED_ACTIONS = [{key:'addNote', label:'Add Note', icon:'notepad'}];
const leafActions = (list) => list.flatMap(a => a.children ? leafActions(a.children) : [a]);
const workflowAction = (key) => [...leafActions(WORKFLOW_ACTIONS), ...RETIRED_ACTIONS].find(a => a.key === key);
// The Add Action menu for a type: only the actions that run its way.
const actionsForType = (typeKey) => WORKFLOW_ACTIONS.map(g => ({...g, children:g.children.filter(a => actionFitsType(typeKey, {type:a.key, config:{}}))})).filter(g => g.children.length);

/* An action in one line, from what's configured: "Move to Postponed", "Set Deal Name to Ali Khan",
   "Clear Deal Close Date", "Prompt to Update Deal Name". The builder's Action node and the event
   cards' Action box both use it; until there's enough to say, it's the action's name. `context`:
   the workflow's (its Object names the properties; its Pipeline and Stage, the stages). */
const actionSummary = (data, a, context) => {
  const ctx = context || {}, c = (a && a.config) || {};
  const label = (workflowAction(a && a.type) || {}).label || (a && a.type) || '';
  const objectId = ctx.object || 'deals';
  const noun = objectName(data, objectId).replace(/s$/, '');
  const props = objectProperties(data, objectId);
  // A property by its name with the object's in front, unless it already has it (Deal Name, Deal Close Date).
  const propName = (key) => { const p = props.find(x => x.key === key); if(!p) return ''; return p.label.toLowerCase().startsWith(noun.toLowerCase()) ? p.label : `${noun} ${p.label}`; };
  const valueText = (key, v) => {
    const p = props.find(x => x.key === key);
    if(!p || v === '' || v == null) return '';
    // Options may be grouped ({group, options} — users: Record Owner, …, then people).
    const opt = propertyOptions(data, objectId, p, {pipeline:ctx.pipeline}).flatMap(o => o && o.options ? o.options : [o]).find(o => (typeof o === 'string' ? o : o.value) === v);
    if(opt) return typeof opt === 'string' ? opt : opt.label;
    if(p.type === 'Number' && !isNaN(Number(v))) return Number(v).toLocaleString('en-US');
    if(propertyCompare(p) === 'date' && !isNaN(new Date(v).getTime())) return new Date(String(v).length === 10 ? `${v}T00:00` : v).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric', ...(String(v).length === 10 ? {timeZone:LOCAL_TZ} : {})});
    // Any other type: its own one-line display (Currency, Location, a range, a list, True / False).
    if(typeof v === 'object' || typeof v === 'boolean') return formatPropertyValueOf(p, storePropertyValue(p, v));
    return String(v);
  };
  const list = (xs) => xs.length <= 2 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
  const stageName = (id) => anyStageLabel(data, id);
  const pipeline = (data.pipelines || []).find(p => p.id === ctx.pipeline);
  const entries = (c.properties || []).filter(e => e.property && props.some(p => p.key === e.property));
  switch(a && a.type){
    case 'setPropertyValue': {
      const parts = entries.filter(e => valueText(e.property, e.value)).map(e => `${propName(e.property)} to ${valueText(e.property, e.value)}`);
      return parts.length ? `${actionBehavior(a) === 'required' ? 'Prompt to set' : 'Set'} ${list(parts)}` : label;
    }
    case 'clearProperty': return entries.length ? `Clear ${list(entries.map(e => propName(e.property)))}` : label;
    case 'promptUpdateProperty': return entries.length ? `Prompt to Update ${list(entries.map(e => propName(e.property)))}` : label;
    case 'moveToStage': return c.stage && stageName(c.stage) ? `Move to ${stageName(c.stage)}` : label;
    case 'moveStageForward':
    case 'moveStageBackward': {
      const dir = a.type === 'moveStageForward' ? 'forward' : 'backward';
      // From the context's stage the next one is known; otherwise it's whichever stage comes next.
      const order = pipeline ? pipeline.stages.filter(st => !isClosedStage(st)) : [];
      const i = order.findIndex(st => st.id === ctx.stage), next = i >= 0 ? order[i + (dir === 'forward' ? 1 : -1)] : null;
      return next ? `Move ${dir} to ${next.label}` : `Move to the ${dir === 'forward' ? 'next' : 'previous'} stage`;
    }
    case 'blockEntry': return ctx.stage && stageName(ctx.stage) ? `Block entry to ${stageName(ctx.stage)}` : label;
    case 'createTask': {
      const tasks = (c.tasks || []).filter(t => (t.name || '').trim());
      if(!tasks.length) return label;
      const who = tasks.length === 1 && tasks[0].assignee ? ` for ${assigneeLabel(data, tasks[0].assignee)}` : '';
      return tasks.length === 1 ? `Create task \u201c${tasks[0].name.trim()}\u201d${who}` : `Create ${tasks.length} tasks: ${list(tasks.map(t => `\u201c${t.name.trim()}\u201d`))}`;
    }
    case 'scheduleEmail': {
      const emails = (c.emails || []).filter(e => e.templateId || (e.email && e.email.subject));
      if(!emails.length) return label;
      // Enrolled in a sequence: its name.
      const seq = c.sequenceId && emailSequencesOf(data).find(q => q.id === c.sequenceId);
      if(seq && emails.some(e => e.sequenceId === seq.id)) return `Enroll in sequence \u201c${seq.name}\u201d`;
      const nameOf = (e) => (e.email && e.email.subject) || (emailTemplatesOf(data).find(t => t.id === e.templateId) || {}).name || 'email';
      if(emails.length > 1) return `Schedule ${emails.length} emails: ${list(emails.map(e => `\u201c${nameOf(e)}\u201d`))}`;
      const e = emails[0], when = e.immediate ? 'now' : durationLabel(e.schedule) ? `after ${durationLabel(e.schedule).toLowerCase()}` : '';
      return `${e.immediate ? 'Send' : 'Schedule'} \u201c${nameOf(e)}\u201d email${when ? ` ${when}` : ''}`;
    }
    case 'addNote': {
      const body = c.specific ? (c.body || '').trim().replace(/\s+/g, ' ') : '';
      return body ? `Add note \u201c${body.length > 40 ? `${body.slice(0, 40)}\u2026` : body}\u201d` : 'Add a note written by the record owner';
    }
    case 'scheduleMeeting': {
      const ms = c.meetings || [];
      if(!ms.length) return label;
      if(ms.length > 1) return `Schedule ${ms.length} meetings`;
      const m = ms[0], bits = [m.duration, m.platform].filter(Boolean);
      return `Schedule a meeting${bits.length ? ` (${bits.join(', ')})` : ''}${m.organizer ? ` with ${assigneeLabel(data, m.organizer)}` : ''}`;
    }
    case 'notify': {
      const who = [...(c.recipients || []).map(k => assigneeLabel(data, k)), ...(c.users || []).map(id => assigneeLabel(data, id))].filter(Boolean);
      return who.length ? `Notify ${list(who)}` : label;
    }
    case 'createAssociatedObject': {
      const objs = associatedToCreate(c).map(o => objectName(data, o).replace(/s$/, ''));
      return objs.length ? `Create associated ${list(objs)}` : label;
    }
    case 'promptClearProperty': return entries.length ? `Prompt to Clear ${list(entries.map(e => propName(e.property)))}` : label;
    case 'moveToPipeline': {
      const pl = (data.pipelines || []).find(p => p.id === c.pipeline);
      return pl ? `Move to ${pl.label}${c.stage ? ` · ${(pl.stages.find(s => s.id === c.stage) || {}).label || ''}` : ''}` : label;
    }
    case 'createEmailActivity': {
      const tpl = emailTemplatesOf(data).find(t => t.id === ((c.email || {}).templateId));
      return tpl ? `Email \u201c${(c.email.email && c.email.email.subject) || tpl.name}\u201d` : label;
    }
    case 'exitEmailSequence': { const q = emailSequencesOf(data).find(x => x.id === c.sequenceId); return q ? `Exit sequence \u201c${q.name}\u201d` : label; }
    case 'createMeeting': return c.title ? `Log meeting \u201c${c.title}\u201d` : 'Log a meeting';
    case 'addCallLog': return `Log a call${c.outcome ? ` · ${c.outcome}` : ''}`;
    case 'initiateCall': return `Call the ${noun.toLowerCase()}`;
    case 'deleteRecord': return `Delete the ${noun.toLowerCase()}`;
    case 'updateAssociatedRecord': {
      if(!c.object) return label;
      const tProps = objectProperties(data, c.object), on = objectName(data, c.object).replace(/s$/, '');
      const sets = (c.properties || []).filter(e => e.property).map(e => `${(tProps.find(p => p.key === e.property) || {}).label || e.property}${e.value !== '' && e.value != null ? ` to ${e.value}` : ''}`);
      return sets.length ? `Update associated ${on}: ${list(sets)}` : `Update associated ${on}`;
    }
    case 'classifyRecord': return c.property ? `Classify ${propName(c.property)} with AI` : label;
    case 'assignOwner': {
      if(c.method === 'person' && c.user) return `Assign owner: ${assigneeLabel(data, c.user)}`;
      if(c.method === 'team' && c.team) return `Assign owner in turn within ${((data.teams || []).find(t => t.id === c.team) || {}).name || 'the team'}`;
      if(c.method === 'roundRobin' && (c.users || []).length) return `Assign owner round-robin (${plural(c.users.length, 'person')})`;
      if(c.method === 'properties' && (c.rules || []).length) return 'Assign owner by User Properties';
      return label;
    }
  }
  return label;
};

/* Email templates until the Templates page exists (Settings → Templates is not defined yet).
   Each is a branded HTML email: {id, name, subject, html}. Text-bearing elements are h1, p, li
   and a (never nested), which is what "Edit text" makes editable. */
const EMAIL_LOGO_SVG = (() => {
  const v = LOGO_VARIANTS.main, h = 22;
  return `<svg height="${h}" width="${(h * v.width / LOGO_INK.height).toFixed(1)}" viewBox="${LOGO_INK.x} ${LOGO_INK.y} ${v.width} ${LOGO_INK.height}" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block">`
    + `<path d="${HOF_MARK_PATHS[0]}" fill="${T.black}"/><path d="${HOF_MARK_PATHS[1]}" fill="${T.black}" stroke="${T.black}" stroke-width="0.444"/>`
    + `<g transform="translate(0 ${v.wordmarkDy})"><path d="${v.wordmark}" fill="${T.black}"/></g></svg>`;
})();
const brandedEmail = ({title, paragraphs, list, cta}) => {
  const p = (t) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#2B2B2E">${t}</p>`;
  return `<div style="font-family:'DM Sans',Arial,sans-serif;background:#fff;color:#2B2B2E">`
    + `<div style="height:4px;background:${T.blue}"></div>`
    + `<div style="padding:26px 40px;border-bottom:1px solid #EDEDF0">${EMAIL_LOGO_SVG}</div>`
    + `<div style="padding:36px 40px 12px">`
    + `<h1 style="margin:0 0 18px;font-size:24px;line-height:1.3;font-weight:600;color:${T.black}">${title}</h1>`
    + p('Hi {{first_name}},') + paragraphs.map(p).join('')
    + (list ? `<ul style="margin:0 0 18px;padding-left:20px">${list.map(li => `<li style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#2B2B2E">${li}</li>`).join('')}</ul>` : '')
    + (cta ? `<div style="margin:26px 0 30px"><a href="#" style="display:inline-block;background:${T.black};color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:8px">${cta}</a></div>` : '')
    + p('Kind regards,') + `<p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:#2B2B2E;font-weight:600">The HOF Migration team</p>`
    + `</div>`
    + `<div style="padding:22px 40px 26px;background:#F6F6F7">`
    + `<p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:#6B6B72">HOF Migration · Global migration services</p>`
    + `<p style="margin:0 0 10px;font-size:12px;line-height:1.6;color:#6B6B72">You are receiving this email because you are a HOF Migration client.</p>`
    + `<a href="#" style="font-size:12px;color:#6B6B72;text-decoration:underline">Unsubscribe</a>`
    + `</div></div>`;
};
const DEFAULT_EMAIL_TEMPLATES = [
  {id:'et-welcome', name:'Welcome to US NIW', subject:'Welcome to your US NIW journey', html:brandedEmail({
    title:'Welcome to your US NIW journey',
    paragraphs:['Thank you for choosing HOF Migration for your US National Interest Waiver application. We are delighted to be part of this next step with you.',
      'Over the coming weeks your dedicated consultant will guide you through every stage of the process. Here is what happens next:'],
    list:['Your consultant will contact you within two working days.', 'You will receive your Client Care Letter to review and sign.', 'We will share a personalised document checklist for your petition.'],
    cta:'View Your Client Portal'})},
  {id:'et-ccl', name:'Client Care Letter', subject:'Your Client Care Letter', html:brandedEmail({
    title:'Your Client Care Letter is ready',
    paragraphs:['Your Client Care Letter sets out the scope of our services, the fees agreed and how we will work together on your case.',
      'Please read it carefully and sign it in your client portal. If anything is unclear, reply to this email and your consultant will be happy to help.'],
    cta:'Review and Sign'})},
  {id:'et-payment', name:'Payment Reminder', subject:'A reminder about your payment', html:brandedEmail({
    title:'Your next payment is due soon',
    paragraphs:['This is a friendly reminder that your next instalment is due soon. Keeping your payments up to date helps us keep your case moving without delays.',
      'You can review your payment schedule and pay securely from your client portal.'],
    cta:'View Payment Schedule'})},
  {id:'et-followup', name:'Consultation Follow-up', subject:'Following up on your consultation', html:brandedEmail({
    title:'Thank you for your consultation',
    paragraphs:['It was great speaking with you. As discussed, here is a short summary of the points we covered and the next steps for your application.'],
    list:['Your eligibility for the US National Interest Waiver.', 'The evidence we recommend gathering for your petition.', 'The expected timeline from filing to decision.'],
    cta:'Book Your Next Call'})},
];
// Saved templates, else the sample CRM instance's (another instance starts with none).
const emailTemplatesOf = (data) => data.emailTemplates || (ACTIVE_CRM.sample ? DEFAULT_EMAIL_TEMPLATES : []);
/* Email Sequences — reusable: an ordered list of {templateId, delay}; no recipients. */
const DEFAULT_EMAIL_SEQUENCES = [
  {id:'es-onboarding', name:'US NIW Onboarding', emails:[
    {templateId:'et-welcome',  delay:{amount:'1', unit:'Days'}},
    {templateId:'et-ccl',      delay:{amount:'1', unit:'Weeks'}},
    {templateId:'et-followup', delay:{amount:'2', unit:'Weeks'}},
  ]},
  {id:'es-payment', name:'Payment Follow-up', emails:[
    {templateId:'et-payment',  delay:{amount:'3', unit:'Days'}},
    {templateId:'et-payment',  delay:{amount:'1', unit:'Weeks'}},
  ]},
];
const emailSequencesOf = (data) => data.emailSequences || (ACTIVE_CRM.sample ? DEFAULT_EMAIL_SEQUENCES : []);

/* Side-panel header — the Contact side panel's name row: title (17/600), a muted line under it,
   and the header actions (Close, ⋯) on the right. */
const sidePanelIconBtn = {width:30, height:30, borderRadius:8, border:'none', background:'transparent', cursor:'pointer',
  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0};
/* `titleStyle` overrides the title's type (e.g. the pipeline panel's navigation-level heading);
   `subtitle` may be any node. */
// A panel's header: its title (15px, as every panel and modal — no subtitle), its ⋯, then × at the far right.
function SidePanelHeader({title, onClose, menuItems, titleStyle}){
  return (
    <div style={{display:'flex', alignItems:'center', gap:10, minWidth:0, padding:'16px 14px 12px 20px', flexShrink:0}}>
      <div style={{minWidth:0, flex:1}}>
        <div style={{fontSize:15, fontWeight:600, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', ...titleStyle}}>{title}</div>
      </div>
      <div style={{display:'flex', alignItems:'center', gap:2, flexShrink:0}}>
        {menuItems && menuItems.length > 0 && <RowActionsMenu title="More Actions" width={MENU_W} items={menuItems}/>}
        <button title="Close" onClick={onClose} style={sidePanelIconBtn}><Icon name="close" size={13} color={T.gray600}/></button>
      </div>
    </div>
  );
}

const WORKFLOW_CANVAS = {backgroundColor:'#fff', backgroundImage:`radial-gradient(${T.borderStrong} 1px, transparent 1px)`, backgroundSize:'16px 16px'};
const WORKFLOW_CARD_W = 300;   // close to the CRM's board cards

/* One block of the flow: a tab (TRIGGER in blue; CONTEXT and ACTION neutral) over a white card. A
   selected block takes the blue border. */
// `dark`: a black tab (the event cards' Current Parameters); `width`, `bodyRef`, `bodyStyle`: for the event trace.
function WorkflowCard({tab, icon, accent, dark, selected, onSelect, children, width = WORKFLOW_CARD_W, bodyRef, bodyStyle}){
  const solid = accent || dark, bg = dark ? T.black : T.blue;
  return (
    <div style={{width, maxWidth:'100%'}}>
      <div style={{display:'inline-flex', alignItems:'center', gap:5, height:WORKFLOW_TAB_H, padding:'0 8px', borderRadius:'6px 6px 0 0', fontSize:11, fontWeight:600, letterSpacing:.4,
        background: solid ? bg : T.headerBg, color: solid ? '#fff' : T.gray600, border: solid ? 'none' : `1px solid ${T.borderStrong}`, borderBottom:'none'}}>
        {icon && <Icon name={icon} size={11} color={solid ? '#fff' : T.gray600}/>}{tab}
      </div>
      <div ref={bodyRef} onClick={onSelect} style={{background:'#fff', border:`1.5px solid ${selected ? T.blue : T.borderStrong}`, borderRadius:'0 10px 10px 10px', padding:10,
        display:'flex', flexDirection:'column', gap:8, boxShadow:'0 1px 2px rgba(16,24,40,.05)', cursor: onSelect ? 'pointer' : 'default', transition:'border-color 200ms ease', ...(bodyStyle || {})}}>{children}</div>
    </div>
  );
}
/* The connection between nodes (the canvas reference): a plain line, no arrowhead, in the cards'
   border colour, from the bottom of one card down past the next card's tab to its top
   edge, about two-thirds across the cards (right of the tab). */
const WORKFLOW_LINK_GAP = 36;   // one card → the next card's tab
const WORKFLOW_TAB_H = 22;
const WORKFLOW_CONTROL_GAP = 128;   // the nodes → Workflow control
const WorkflowConnector = () => (
  <div style={{position:'relative', width:WORKFLOW_CARD_W, maxWidth:'100%', height:WORKFLOW_LINK_GAP}} aria-hidden="true">
    <div style={{position:'absolute', left:'65%', top:0, width:1.5, height:WORKFLOW_LINK_GAP + WORKFLOW_TAB_H, background:T.borderStrong}}/>
  </div>
);
/* A block's main line: icon tile and title (muted when not set yet), muted detail lines (one
   per string), and an optional trailing control (the node's trash icon). */
const blockLine = (icon, title, detail, trailing) => (
  <div style={{display:'flex', alignItems:'center', gap:8, minWidth:0}}>
    <span style={{width:24, height:24, borderRadius:6, background:T.blueLight, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
      <Icon name={icon} size={13} color={T.blue}/>
    </span>
    <div style={{minWidth:0, flex:1}}>
      <div style={{fontSize:13, fontWeight:500, lineHeight:1.4, color: title ? T.attioText : T.gray400, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{title || 'Select a trigger'}</div>
      {[].concat(detail || []).filter(Boolean).map(line => (
        <div key={line} style={{fontSize:12, lineHeight:1.4, color:T.attioMuted, overflowWrap:'anywhere'}}>{line}</div>
      ))}
    </div>
    {trailing}
  </div>
);
/* A node's delete control: the trash icon at the node's right edge (doesn't select the node). */
const nodeTrash = (label, onDelete) => (
  <button title={label} aria-label={label} onClick={e=>{ e.stopPropagation(); onDelete(); }}
    style={{width:24, height:24, borderRadius:6, border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
    <Icon name="trash" size={14} color={T.gray600}/>
  </button>
);

/* ── Configuration area pieces ── */
const cfgField = (label, control) => <div><label style={fieldLabel}>{label}</label>{control}</div>;
const cfgStep = (n, title, children, disabled) => (
  <div style={{display:'flex', flexDirection:'column', gap:10, padding:'16px 20px', borderTop:`1px solid ${T.border}`, opacity: disabled ? .5 : 1, pointerEvents: disabled ? 'none' : 'auto'}}>
    <span style={{fontSize:14, fontWeight:500, color:T.black}}>{n ? `${n}. ` : ''}{title}</span>
    {children}
  </div>
);
/* N + Days / Weeks / Months / Years. */
function DurationInput({value, onChange, units = WORKFLOW_TIME_UNITS}){
  const v = value || {amount:'', unit:'Days'};
  return (
    <div style={{display:'flex', gap:8}}>
      {/* The number and the unit share the row equally. */}
      <div style={{flex:'1 1 0', minWidth:0}}><input type="number" min="1" value={v.amount} onChange={e=>onChange({...v, amount:e.target.value})} placeholder="0" style={{...fieldInput, width:'100%'}}/></div>
      <div style={{flex:'1 1 0', minWidth:0}}><FormSelect value={v.unit} placeholder="Select unit" options={units} onChange={u=>onChange({...v, unit:u || 'Days'})}/></div>
    </div>
  );
}
/* ── Action configuration parts, shared by every action ──
   One system for all actions: a section (Details, Schedule, Due, Recipients, Email…) is a
   heading — the CRM side-panel section label (11/600 uppercase, as Contact Properties) — over its fields (12.5 gray600 labels);
   sections are told apart by spacing, not rules. Repeatable actions stack their entries
   (EntryStack): "N emails" and + on top, then Email 1, Email 2… below a rule, each with a trash
   icon when there's more than one. Schedules are After N Days / Weeks / Months, at a time —
   counted from the trigger. */
const cfgPart = (title, children, right) => (
  <div style={{display:'flex', flexDirection:'column', gap:10}}>
    {(title || right) && (
      <div style={{display:'flex', alignItems:'center', gap:8, minHeight:18}}>
        <span style={{flex:1, fontSize:11, fontWeight:600, color:T.attioFaint, textTransform:'uppercase', letterSpacing:.4}}>{title}</span>{right}
      </div>
    )}
    {children}
  </div>
);
const cfgRowLabel = (t) => <span style={{width:36, flexShrink:0, fontSize:13, color:T.attioText}}>{t}</span>;
const cfgHelp = (text) => <div style={stTextB}>{text}</div>;
const newEntryId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const SCHEDULE_EMAIL_UNITS = ['Hours', 'Days', 'Weeks', 'Months'];   // Hours: a sequence's steps can be hours apart
const newSchedule = () => ({amount:'', unit:'Days', time:''});

/* After N units + At a time. */
/* `disabled` (Send Immediately): the fields keep their values but are greyed out and can't be
   focused or changed. */
function ScheduleRows({value, onChange, disabled}){
  const v = {...newSchedule(), ...value};
  return (
    <div aria-disabled={disabled || undefined} {...(disabled ? {inert:''} : {})}
      style={{display:'flex', flexDirection:'column', gap:8, opacity: disabled ? .45 : 1, pointerEvents: disabled ? 'none' : 'auto', transition:'opacity 120ms'}}>
      <div style={{display:'flex', alignItems:'center', gap:8}}>
        {cfgRowLabel('After')}
        <div style={{flex:1, minWidth:0}}><DurationInput units={SCHEDULE_EMAIL_UNITS} value={v} onChange={(d)=>onChange({...v, amount:d.amount, unit:d.unit})}/></div>
      </div>
      <div style={{display:'flex', alignItems:'center', gap:8}}>
        {cfgRowLabel('At')}
        <TimeField value={v.time} onChange={(t)=>onChange({...v, time:t})}/>
      </div>
    </div>
  );
}
/* Checkbox list (recipients, attendees). */
function CheckList({options, value, onChange}){
  const list = value || [];
  const toggle = (k) => onChange(list.includes(k) ? list.filter(x => x !== k) : [...list, k]);
  return (
    <div style={{display:'flex', flexDirection:'column', gap:8}}>
      {options.map(r => (
        <label key={r.key} onClick={()=>toggle(r.key)} style={{display:'flex', alignItems:'center', gap:10, fontSize:13, color:T.attioText, cursor:'pointer'}}>
          <RowCheckbox checked={list.includes(r.key)} onChange={()=>toggle(r.key)}/>{r.label}
        </label>
      ))}
    </div>
  );
}
const cfgSection = (title, children) => cfgPart(title, children);
/* The entries of a repeatable action, kept in config[key]; always at least one. */
const entriesOf = (config, key, make) => (config && config[key] && config[key].length) ? config[key] : [{...make(), id:`${key}-1`}];
const entryHead = (title, onRemove) => (
  <div style={{display:'flex', alignItems:'center', gap:8}}>
    <span style={{flex:1, fontSize:13.5, fontWeight:600, color:T.attioText}}>{title}</span>
    {onRemove && <button title={`Remove ${title}`} onClick={onRemove} style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:4}}><Icon name="trash" size={14} color={T.gray600}/></button>}
  </div>
);
const addEntryBtn = (noun, onAdd) => (
  <button title={`Add ${noun}`} onClick={onAdd} style={{...toolbarIconButton, width:28, height:28}}><Icon name="plus" size={13} color={T.gray800}/></button>
);
function useEntries(config, setConfig, listKey, make){
  const items = entriesOf(config, listKey, make);
  const setItems = (list) => setConfig({...config, [listKey]:list});
  return {items, add:()=>setItems([...items, make()]), set:(id, next)=>setItems(items.map(x => x.id === id ? next : x)),
    remove: items.length > 1 ? (id)=>setItems(items.filter(x => x.id !== id)) : null};
}
function EntryStack({config, setConfig, listKey, make, noun, nounPlural, title, render}){
  const e = useEntries(config, setConfig, listKey, make);
  const n = e.items.length;
  return (
    <div style={{display:'flex', flexDirection:'column'}}>
      <div style={{display:'flex', alignItems:'center', gap:8, paddingBottom:12}}>
        <span style={{flex:1, fontSize:13, fontWeight:500, color:T.attioText}}>{nounPlural ? `${n} ${n === 1 ? noun : nounPlural}` : plural(n, noun)}</span>
        {addEntryBtn(noun, e.add)}
      </div>
      {e.items.map((it, i) => (
        <div key={it.id} style={{display:'flex', flexDirection:'column', gap:12, padding:'16px 0', borderTop:`1px solid ${T.borderStrong}`}}>
          {entryHead(`${title} ${i + 1}`, e.remove && (()=>e.remove(it.id)))}
          {/* Sections within an entry: spacing only. */}
          <div style={{display:'flex', flexDirection:'column', gap:20}}>{render(it, (next)=>e.set(it.id, next), e.items)}</div>
        </div>
      ))}
    </div>
  );
}

/* Who a workflow can address: the record's people, then the workspace's users. */
const RECORD_PEOPLE = [
  {key:'recordOwner',   label:'Record Owner'},
  {key:'ownerTeamLead', label:"Record Owner's Team Lead"},
];
const workflowUsers = (data) => (data.users || []).filter(u => !u.status || u.status === 'Activated');
const assigneeOptions = (data) => [
  {group:'Record', options:RECORD_PEOPLE.map(p => ({value:p.key, label:p.label}))},
  {group:'Users', options:workflowUsers(data).map(u => ({value:u.id, label:u.name}))},
];
const assigneeLabel = (data, v) => (RECORD_PEOPLE.find(p => p.key === v) || {}).label || ((data.users || []).find(u => u.id === v) || {}).name || '';

/* ── Email ── recipients, and the email as a compact row (View Email) or "Choose email template";
   Enroll in Email Sequence gives each email a Schedule and can fill its emails from a sequence.
   Under the recipients, Cc and Bcc: addresses typed in, as in the email composer (emails.jsx
   EmailListInput) — kept on the email as typed and listed on it when it is sent. */
const EMAIL_RECIPIENTS = [{key:'recordEmail', label:'Record Email'}, ...RECORD_PEOPLE];
const emailCopyFields = (e, set) => (<>
  {cfgField('Cc', <EmailListInput label="Cc" value={e.cc || ''} onChange={(v)=>set({...e, cc:v})} style={fieldInput}/>)}
  {cfgField('Bcc', <EmailListInput label="Bcc" value={e.bcc || ''} onChange={(v)=>set({...e, bcc:v})} style={fieldInput}/>)}
</>);
// The emails an action sends: Enroll in Email Sequence's entries, Create Email Activity's one.
const actionEmails = (a) => { const c = a.config || {}; return a.type === 'scheduleEmail' ? (c.emails || []) : a.type === 'createEmailActivity' && c.email ? [c.email] : []; };

/* A sequence's span: from its first email to its last (months as 30 days, weeks as 7), rounded
   to the largest whole unit — "5 emails | 3 months". */
const DELAY_DAYS = {Days:1, Weeks:7, Months:30, Years:365};
const delayDays = (d) => (Number(d && d.amount) || 0) * (DELAY_DAYS[d && d.unit] || 1);
const spanLabel = (days) => days >= 28 ? plural(Math.max(1, Math.round(days / 30)), 'month') : days >= 7 ? plural(Math.round(days / 7), 'week') : plural(days, 'day');
const sequenceSpan = (seq) => {
  const days = seq.emails.map(e => delayDays(e.delay));
  return days.length ? spanLabel(Math.max(...days) - Math.min(...days)) : spanLabel(0);
};

/* The underlined text control — the Contacts / Users table link: #D7D6DA underline, darker on hover. */
function UnderlineAction({label, onClick}){
  const [h, setH] = React.useState(false);
  return (
    <button onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} style={{border:'none', background:'transparent', padding:0, cursor:'pointer',
      fontFamily:'inherit', fontSize:13, fontWeight:500, color: h ? T.black : T.attioText, textDecoration:'underline', textUnderlineOffset:2,
      textDecorationColor: h ? T.attioMuted : '#D7D6DA', transition:'color 120ms ease, text-decoration-color 120ms ease', alignSelf:'flex-start'}}>{label}</button>
  );
}

/* Choosing a sequence or a template: the Add User modal — the Add User search field with an
   icon-only + beside it (creating one is not defined yet), then the options as radio cards;
   Choose applies the selected one. */
function EmailPickerModal({title, items, empty, searchPlaceholder, createLabel, onCreate, onClose, onPick}){
  const [sel, setSel] = React.useState(null);
  const [query, setQuery] = React.useState('');
  const q = query.trim().toLowerCase();
  const shown = q ? items.filter(it => `${it.title} ${it.detail}`.toLowerCase().includes(q)) : items;
  return ReactDOM.createPortal(
    <StModal title={title} primary="Choose" canSubmit={!!sel} onCancel={onClose} onSubmit={()=>onPick(sel)} width={640}>
      <div style={{display:'flex', gap:8}}>
        <div style={{position:'relative', flex:1, minWidth:0}}>
          <div style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', display:'flex'}}><Icon name="search" size={13} color={T.gray400}/></div>
          <input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} style={{...fieldInput, paddingLeft:30}}/>
        </div>
        <button title={createLabel} aria-label={createLabel} onClick={onCreate} style={{...toolbarIconButton, width:35, height:35}}>
          <Icon name="plus" size={14} color={T.gray800}/>
        </button>
      </div>
      {/* A steady height while searching, so the modal doesn't jump as results narrow. */}
      <div style={{minHeight:128, maxHeight:'calc(100vh - 300px)', overflowY:'auto'}}>
        {shown.length
          ? <div style={{display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', alignItems:'start', gap:12}}>
              {shown.map(it => <StRadioCard key={it.id} selected={sel === it.id} title={it.title} description={it.detail} onSelect={()=>setSel(it.id)}/>)}
            </div>
          : <div style={{...stTextB, padding:'6px 0'}}>{items.length ? `Nothing matches "${query.trim()}".` : empty}</div>}
      </div>
    </StModal>, document.body);
}

/* View Email — the Add User modal, much wider: the subject and the full HTML email on a quiet
   canvas, scrolling inside the modal. Edit Text makes only the text editable (no layout,
   images or links); saving keeps the edit as this email's own copy. */
const EMAIL_TEXT_SELECTOR = 'h1, h2, h3, p, li, a';
function ViewEmailModal({name, email, onClose, onSave}){
  const [editing, setEditing] = React.useState(false);
  const [subject, setSubject] = React.useState(email.subject);
  const ref = React.useRef(null);
  const html = React.useMemo(() => ({__html:email.html}), [email.html]);
  React.useEffect(() => {
    if(!ref.current) return;
    ref.current.querySelectorAll(EMAIL_TEXT_SELECTOR).forEach(el => {
      if(editing) el.setAttribute('contenteditable', 'plaintext-only'); else el.removeAttribute('contenteditable');
    });
  }, [editing]);
  const save = () => {
    const copy = ref.current.cloneNode(true);
    copy.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
    onSave({subject:subject.trim() || email.subject, html:copy.innerHTML});
  };
  return ReactDOM.createPortal(
    <StModal title="View Email" primary={editing ? 'Save Changes' : null} onCancel={onClose} onSubmit={save} width={960}
      textAction={editing ? null : {label:'Edit Text', onClick:()=>setEditing(true)}}>
      <style>{`.hof-email-edit [contenteditable]{outline:1px dashed ${T.borderStrong};outline-offset:3px;border-radius:2px;cursor:text}
        .hof-email-edit [contenteditable]:hover{outline-color:${T.attioMuted}}
        .hof-email-edit [contenteditable]:focus{outline:1.5px solid ${T.blue}}`}</style>
      <div>
        <label style={fieldLabel}>Subject</label>
        {editing ? <input value={subject} onChange={e=>setSubject(e.target.value)} style={fieldInput}/>
                 : <div style={{fontSize:14, fontWeight:500, color:T.attioText}}>{subject}</div>}
      </div>
      <div style={{background:T.headerBg, border:`1px solid ${T.border}`, borderRadius:10, padding:'28px 24px', maxHeight:'calc(100vh - 300px)', overflowY:'auto'}}>
        <div ref={ref} className={editing ? 'hof-email-edit' : ''} dangerouslySetInnerHTML={html}
          onClick={e=>{ if(e.target.closest('a')) e.preventDefault(); }}
          onKeyDown={e=>{ if(e.key === 'Enter') e.preventDefault(); }}
          style={{width:600, maxWidth:'100%', margin:'0 auto', borderRadius:8, overflow:'hidden', boxShadow:'0 1px 3px rgba(16,24,40,.08)'}}/>
      </div>
    </StModal>, document.body);
}

/* The Email part: {templateId, email} on `entry` — the compact row, or "Choose email template". */
function EmailChoice({entry, setEntry, data, onStub}){
  const [modal, setModal] = React.useState(null);   // 'choose' | 'view'
  const templates = emailTemplatesOf(data);
  const tpl = templates.find(t => t.id === entry.templateId);
  return (<>
    {tpl ? (
      /* Compact: the email's name and View Email — never the full email here. */
      <div style={{display:'flex', alignItems:'center', gap:10, minWidth:0, padding:'8px 10px', border:`1px solid ${T.border}`, borderRadius:8}}>
        <Icon name="envelope" size={14} color={T.gray600}/>
        <span style={{flex:1, minWidth:0, fontSize:13, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{tpl.name}</span>
        <UnderlineAction label="View Email" onClick={()=>setModal('view')}/>
        {/* Another template can be picked in its place (the email's own edits go with the old one). */}
        <UnderlineAction label="Change" onClick={()=>setModal('choose')}/>
      </div>
    ) : <UnderlineAction label="Choose email template" onClick={()=>setModal('choose')}/>}
    {modal === 'choose' && <EmailPickerModal title="Choose Email Template" empty="No email templates yet" searchPlaceholder="Search email templates"
      createLabel="Add Email Template" onCreate={()=>onStub('Add Email Template')} onClose={()=>setModal(null)}
      items={templates.map(t => ({id:t.id, title:t.name, detail:t.subject}))}
      onPick={(id)=>{ setEntry({...entry, templateId:id, email:null}); setModal(null); }}/>}
    {modal === 'view' && tpl && <ViewEmailModal name={tpl.name} email={entry.email || {subject:tpl.subject, html:tpl.html}} onClose={()=>setModal(null)}
      onSave={(email)=>{ setEntry({...entry, email}); setModal(null); }}/>}
  </>);
}

/* ── Enroll in Email Sequence ── Email 1, Email 2… each in sections: Schedule (or Send Immediately) →
   Recipients (with Cc and Bcc) → Email. "Choose email sequence
   template" fills the emails from a sequence (templates and schedules). */
const newScheduledEmail = () => ({id:newEntryId('se'), immediate:false, recipients:[], templateId:'', email:null, schedule:newSchedule()});
const scheduledEmailsOf = (config) => entriesOf(config, 'emails', newScheduledEmail);
function ScheduleEmailConfig({config, setConfig, data, onStub}){
  const [choosing, setChoosing] = React.useState(false);
  const emails = scheduledEmailsOf(config);
  const sequences = emailSequencesOf(data);
  /* Choosing a sequence adds its emails (template and schedule) — replacing the emails a previous
     sequence added and any still-empty email; emails added one by one stay. Recipients are set here. */
  const useSequence = (id) => {
    const seq = sequences.find(x => x.id === id);
    const kept = emails.filter(e => !e.sequenceId && e.templateId);
    // Each email's schedule counts from the workflow running: the sequence's delays added up (workflowEngine.jsx).
    const when = sequenceSchedules(seq);
    setConfig({...config, sequenceId:id, emails:[...seq.emails.map((e, i) => ({...newScheduledEmail(), sequenceId:id, templateId:e.templateId, schedule:{...newSchedule(), ...when[i]}})), ...kept]});
    setChoosing(false);
  };
  return (
    <div style={{padding:'4px 20px 20px', display:'flex', flexDirection:'column', gap:14}}>
      <UnderlineAction label="Choose email sequence template" onClick={()=>setChoosing(true)}/>
      <EntryStack config={config} setConfig={setConfig} listKey="emails" make={newScheduledEmail} noun="email" title="Email"
        render={(e, set) => (<>
          {/* Send Immediately (per email): the schedule doesn't apply while it's on. */}
          {cfgPart('Schedule', <ScheduleRows value={e.schedule} disabled={!!e.immediate} onChange={(s)=>set({...e, schedule:s})}/>, (
            <label style={{display:'flex', alignItems:'center', gap:8, fontSize:12.5, color:T.gray600, cursor:'pointer'}}>
              Send Immediately<UtToggle on={!!e.immediate} onChange={(v)=>set({...e, immediate:v})}/>
            </label>
          ))}
          {cfgPart('Recipients', <><CheckList options={EMAIL_RECIPIENTS} value={e.recipients} onChange={(r)=>set({...e, recipients:r})}/>{emailCopyFields(e, set)}</>)}
          {cfgPart('Email', <EmailChoice entry={e} setEntry={set} data={data} onStub={onStub}/>)}
        </>)}/>
      {behaviorField('scheduleEmail', config, setConfig)}
      {choosing && <EmailPickerModal title="Choose Email Sequence Template" empty="No email sequences yet" searchPlaceholder="Search email sequences"
        createLabel="Add Email Sequence" onCreate={()=>onStub('Add Email Sequence')} onClose={()=>setChoosing(false)}
        items={sequences.map(q => ({id:q.id, title:q.name, detail:`${plural(q.emails.length, 'email')} | ${sequenceSpan(q)}`}))} onPick={useSequence}/>}
    </div>
  );
}

/* ── Create Task ── Task 1, Task 2… each in two sections: Details (Task Name, Description, Task
   Type, Assign To — the New Task fields) and Due (After N units, At a time). */
const newWorkflowTask = () => ({id:newEntryId('wt'), name:'', description:'', taskType:'To-do', assignee:'', due:newSchedule()});
function CreateTaskConfig({config, setConfig, data}){
  return (
    <div style={{padding:'4px 20px 20px'}}>
      <EntryStack config={config} setConfig={setConfig} listKey="tasks" make={newWorkflowTask} noun="task" title="Task"
        render={(t, set) => (<>
          {cfgSection('Details', (<>
            {cfgField('Task Name', <input value={t.name} onChange={e=>set({...t, name:e.target.value})} placeholder="What needs doing" style={fieldInput}/>)}
            {cfgField('Description', <textarea rows={3} value={t.description} onChange={e=>set({...t, description:e.target.value})} style={{...fieldInput, resize:'vertical', lineHeight:1.5}}/>)}
            {cfgField('Task Type', <FormSelect value={t.taskType} placeholder="Select task type" options={TASK_TYPES} onChange={(v)=>set({...t, taskType:v || 'To-do'})}/>)}
            {cfgField('Assign To', <FormSelect value={t.assignee} placeholder="Select person" options={assigneeOptions(data)} onChange={(v)=>set({...t, assignee:v})}/>)}
          </>))}
          {cfgSection('Due', <ScheduleRows value={t.due} onChange={(d)=>set({...t, due:d})}/>)}
        </>)}/>
      <div style={{marginTop:20}}>{behaviorField('createTask', config, setConfig)}</div>
    </div>
  );
}

/* ── Schedule Meeting ── Meeting 1, Meeting 2… each with its Details (Organizer, Platform from
   Settings → Meetings, Duration, Description, Attendees). When the meeting is held is set when
   the action runs, not here. */
const MEETING_DURATIONS = ['15 minutes', '30 minutes', '45 minutes', '1 hour', '1 hour 30 minutes', '2 hours'];
const newWorkflowMeeting = () => ({id:newEntryId('wm'), organizer:'', platform:'', duration:'30 minutes', description:'', attendees:[]});
/* Automatic books each meeting at its When (After N units, at a time); otherwise the record owner
   picks the date and time when it runs. */
function ScheduleMeetingConfig({config, setConfig, data}){
  const automatic = actionBehavior({type:'scheduleMeeting', config}) === 'automatic';
  return (
    <div style={{padding:'4px 20px 20px'}}>
      <EntryStack config={config} setConfig={setConfig} listKey="meetings" make={newWorkflowMeeting} noun="meeting" title="Meeting"
        render={(m, set) => (<>{cfgSection('Details', (<>
          {cfgField('Organizer', <FormSelect value={m.organizer} placeholder="Select organizer" options={assigneeOptions(data)} onChange={(v)=>set({...m, organizer:v})}/>)}
          {cfgField('Platform', <FormSelect value={m.platform} placeholder="Select platform" options={MEETING_PROVIDERS.map(p => p.label)} onChange={(v)=>set({...m, platform:v})}/>)}
          {cfgField('Duration', <FormSelect value={m.duration} placeholder="Select duration" options={MEETING_DURATIONS} onChange={(v)=>set({...m, duration:v})}/>)}
          {cfgField('Description', <textarea rows={3} value={m.description} onChange={e=>set({...m, description:e.target.value})} style={{...fieldInput, resize:'vertical', lineHeight:1.5}}/>)}
          {cfgField('Attendees', <CheckList options={EMAIL_RECIPIENTS} value={m.attendees} onChange={(a)=>set({...m, attendees:a})}/>)}
        </>))}
        {automatic && cfgSection('When', <ScheduleRows value={m.when} onChange={(d)=>set({...m, when:d})}/>)}</>)}/>
      <div style={{marginTop:20}}>{behaviorField('scheduleMeeting', config, setConfig)}</div>
    </div>
  );
}

/* ── Add Note ── optionally a note written here in advance; then its Behavior. Without a
   predefined note the owner is asked to write one (Required); with one it's shown to them
   filled in (Required), or added straight to the record (Automatic). */
function AddNoteConfig({config, setConfig}){
  const c = {specific:false, body:'', ...config};
  return (
    <div style={{padding:'4px 20px 20px', display:'flex', flexDirection:'column', gap:20}}>
      <div style={{display:'flex', flexDirection:'column', gap:10}}>
        <label onClick={()=>setConfig({...c, specific:!c.specific})} style={{display:'flex', alignItems:'center', gap:10, fontSize:13, color:T.attioText, cursor:'pointer'}}>
          <span onClick={e=>e.stopPropagation()} style={{display:'flex'}}><UtToggle on={!!c.specific} onChange={()=>setConfig({...c, specific:!c.specific})}/></span>Add a Specific Note
        </label>
        {c.specific && <textarea rows={10} value={c.body} onChange={e=>setConfig({...c, body:e.target.value})} placeholder="Write a note" aria-label="Note"
          style={{...fieldInput, resize:'vertical', lineHeight:1.5}}/>}
      </div>
      {behaviorField('addNote', c, setConfig)}
    </div>
  );
}

/* ── Notify ── an in-app notification: Recipients (the record's people, and users added by name)
   → Message. */
function NotifyConfig({config, setConfig, data}){
  const c = {recipients:[], users:[], message:'', ...config};
  const users = workflowUsers(data);
  return (
    <div style={{padding:'4px 20px 20px', display:'flex', flexDirection:'column', gap:20}}>
      {cfgPart('Recipients', (<>
        <CheckList options={RECORD_PEOPLE} value={c.recipients} onChange={(r)=>setConfig({...c, recipients:r})}/>
        {c.users.map(id => (
          <div key={id} style={{display:'flex', alignItems:'center', gap:10, fontSize:13, color:T.attioText}}>
            <Avatar name={assigneeLabel(data, id)} size={20}/>
            <span style={{flex:1, minWidth:0}}>{assigneeLabel(data, id)}</span>
            <button title={`Remove ${assigneeLabel(data, id)}`} onClick={()=>setConfig({...c, users:c.users.filter(x => x !== id)})}
              style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:4}}><Icon name="close" size={12} color={T.gray600}/></button>
          </div>
        ))}
        <SearchableSelect value="" placeholder="Add a user" searchPlaceholder="Search users"
          options={users.filter(u => !c.users.includes(u.id)).map(u => ({value:u.id, label:u.name}))}
          onChange={(id)=>id && setConfig({...c, users:[...c.users, id]})}/>
      </>))}
      {cfgField('Message', <textarea rows={4} value={c.message} onChange={e=>setConfig({...c, message:e.target.value})} placeholder="What should they know?" style={{...fieldInput, resize:'vertical', lineHeight:1.5}}/>)}
      {behaviorField('notify', config, setConfig, 'The workflow automatically notifies the selected recipients.')}
    </div>
  );
}

/* ── Properties ── the trigger Object's properties; a select's options come from the property,
   the pipeline it drives, the Object's pipelines and stages, or (User) the record's people and
   the users. */
const propertyOptions = (data, objectId, prop, values = {}) => {
  if(!prop) return [];
  if(prop.type === 'User' || prop.key === 'owner') return assigneeOptions(data);   // Contact Owner is a dropdown of users
  if(prop.type === 'Pipeline') return recordPipelines(data, objectId).map(p => ({value:p.id, label:p.label}));
  if(prop.type === 'Pipeline stage') return (((data.pipelines || []).find(p => p.id === values.pipeline) || {}).stages || []).map(s => ({value:s.id, label:s.label}));
  if(prop.options && prop.options.length) return prop.options;
  const driven = (data.pipelines || []).find(p => p.objectId === objectId && p.source === 'property' && p.propertyKey === prop.key);
  if(driven) return driven.stages.map(s => s.label);
  // A type with its own list (Country, Language, a currency-only Currency).
  const d = propertyTypeDef(prop.type);
  return d.options ? d.options(prop) : [];
};
/* Prompt / Set / Clear Property: Property 1, Property 2… in the same stack. Each entry picks a
   property (one not already picked in this action) and, for Set Property Value, its value
   (the property's own input). */
const newPropertyEntry = () => ({id:newEntryId('wp'), property:'', value:''});
function PropertyEntries({config, setConfig, data, context, withValue}){
  const objectId = context && context.object;
  if(!objectId) return cfgHelp('Add a Record to the context first.');
  const props = objectProperties(data, objectId).filter(p => !p.auto);
  return (
    <EntryStack config={config} setConfig={setConfig} listKey="properties" make={newPropertyEntry} noun="property" nounPlural="properties" title="Property"
      render={(it, set, items) => {
        const taken = items.filter(x => x.id !== it.id).map(x => x.property);
        const prop = props.find(p => p.key === it.property);
        return (<>
          {cfgField('Property', <FormSelect value={it.property} placeholder="Select property"
            options={props.filter(p => !taken.includes(p.key)).map(p => ({value:p.key, label:p.label}))}
            onChange={(v)=>{ const p = props.find(x => x.key === v); set({...it, property:v, value: p ? inputPropertyValue(p.type, '') : ''}); }}/>)}
          {withValue && prop && cfgField('Value', <PropertyInput prop={prop} value={it.value} onChange={(v)=>set({...it, value:v})}
            options={propertyOptions(data, objectId, prop, {pipeline:context.pipeline})}/>)}
        </>);
      }}/>
  );
}
/* How these actions run (automatically, or as a prompt to the record owner) is the workflow's
   Workflow Type (Workflow Control), not a setting of each action. */
/* Set Property Value — each property with its value (when the workflow prompts, the values are filled in for the owner). */
function SetPropertyConfig(props){
  return (
    <div style={{padding:'4px 20px 20px', display:'flex', flexDirection:'column', gap:20}}>
      <PropertyEntries {...props} withValue/>
      {actionBehavior({type:'setPropertyValue', config:props.config}) === 'required' && cfgHelp('The value that resolves the violation. Nothing changes until the record owner updates it.')}
      {behaviorField('setPropertyValue', props.config, props.setConfig)}
    </div>
  );
}
/* Clear Property Value — the properties to clear. */
function ClearPropertyConfig(props){
  return (
    <div style={{padding:'4px 20px 20px', display:'flex', flexDirection:'column', gap:20}}>
      <PropertyEntries {...props}/>
      {behaviorField('clearProperty', props.config, props.setConfig)}
    </div>
  );
}

/* ── Move Stage ── within the trigger's pipeline. Forward / Backward go to the next / previous
   ordered stage (closed stages — Won, Lost, Undecided — are outside that order; at either end nothing moves). */
function MoveStageConfig({config, setConfig, data, context, type}){
  const pipeline = (data.pipelines || []).find(p => p.id === (context || {}).pipeline);
  return (
    <div style={{padding:'4px 20px 20px', display:'flex', flexDirection:'column', gap:20}}>
      {!pipeline ? cfgHelp('Add a Pipeline to the context first.')
        : type === 'moveToStage'
          ? cfgPart('Stage', <FormSelect value={(config || {}).stage || ''} placeholder="Select stage" options={pipeline.stages.map(s => ({value:s.id, label:s.label}))}
              onChange={(v)=>setConfig({...config, stage:v})}/>)
          : null}
      {pipeline && behaviorField(type, config, setConfig)}
    </div>
  );
}

/* ── Create Associated Object ── one row per Object associated with the context's Object
   (Settings → Objects associations): its name on the left, Prompt user to create on the right.
   Nothing is created on its own: when this runs, the user is prompted to create each object
   that's on (no values filled in), associated with the record that triggered the workflow.
   `config.create`: {objectId: true}. Older configs listed objects ({objects:[{object}]}): on. */
const associatedToCreate = (c) => [...Object.keys((c || {}).create || {}).filter(k => c.create[k]),
  ...(((c || {}).create ? [] : (c || {}).objects) || []).map(o => o.object).filter(Boolean)];
function CreateAssociatedConfig({config, setConfig, data, context}){
  const from = context && context.object;
  if(!from) return <div style={{padding:'4px 20px 20px'}}>{cfgHelp('Add a Record to the context first.')}</div>;
  // Only Objects whose records can be created today (creationAssociations — Contacts for a deal).
  const associated = creationAssociations(data, from);
  if(!associated.length) return <div style={{padding:'4px 20px 20px'}}>{cfgHelp(`${objectName(data, from)} has no associated records that can be created yet.`)}</div>;
  const on = associatedToCreate(config);
  const toggle = (id, v) => setConfig({...(config || {}), objects:undefined, create:Object.fromEntries([...new Set([...on, id])].map(k => [k, k === id ? v : true]))});
  return (
    <div style={{padding:'4px 20px 20px', display:'flex', flexDirection:'column', gap:12}}>
      {cfgPart('Records', (
        <div style={{display:'flex', flexDirection:'column'}}>
          {associated.map(id => (
            <div key={id} style={{display:'flex', alignItems:'center', gap:10, minHeight:40, borderBottom:`1px solid ${T.attioLine}`}}>
              <span style={{flex:1, minWidth:0, fontSize:13, fontWeight:500, color:T.attioText}}>{objectName(data, id).replace(/s$/, '')}</span>
              <span style={{fontSize:12.5, color:T.attioMuted}}>{actionBehavior({type:'createAssociatedObject', config}) === 'automatic' ? 'Create' : 'Prompt user to create'}</span>
              <UtToggle on={on.includes(id)} onChange={(v)=>toggle(id, v)}/>
            </div>
          ))}
        </div>
      ))}
      {behaviorField('createAssociatedObject', config, setConfig)}
    </div>
  );
}
/* Prompt Update Property — the properties the record owner is asked to fill in when it runs (Deal
   Stage and Pipeline among them); it runs as Required. */
function PromptUpdateConfig(props){
  return (
    <div style={{padding:'4px 20px 20px', display:'flex', flexDirection:'column', gap:20}}>
      <PropertyEntries {...props}/>
      {behaviorField('promptUpdateProperty', props.config, props.setConfig)}
    </div>
  );
}

/* Block Entry: keeps records out of the context's stage — the moment one tries to enter it (a
   person or another workflow moving it there) while this workflow's triggers hold. The stage is
   the context's; the only setting is the message shown to the person it stops. */
function BlockEntryConfig({config, setConfig, data, context}){
  const ctx = context || {};
  return (
    <div style={{padding:'4px 20px 20px', display:'flex', flexDirection:'column', gap:20}}>
      {/* The message only: the stage is the context's, and it always runs automatically. */}
      {!ctx.stage ? cfgHelp('Add a Stage to the context first.') : <>
        {/* What's missing, in words — shown to the person the block stops (optional). */}
        {cfgPart('Message', <textarea value={config.message || ''} onChange={e=>setConfig({...config, message:e.target.value})} rows={3}
          placeholder="What's missing and what to do, e.g. Send and sign the CCL first." style={{...fieldText, resize:'vertical', lineHeight:1.5}}/>)}
      </>}
    </div>
  );
}
const MoveForwardConfig = (p) => <MoveStageConfig {...p} type="moveStageForward"/>;
const MoveBackwardConfig = (p) => <MoveStageConfig {...p} type="moveStageBackward"/>;
const MoveToStageConfig = (p) => <MoveStageConfig {...p} type="moveToStage"/>;


/* ── The document's further actions ── */
// The records a record is associated with (Contacts ↔ Deals ↔ Customers).
const ASSOCIATED_OBJECTS = {contacts:['deals', 'customers'], deals:['contacts', 'customers'], customers:['contacts', 'deals']};
const cfgPad = (children) => <div style={{padding:'4px 20px 20px', display:'flex', flexDirection:'column', gap:20}}>{children}</div>;
const needsRecord = (ctx) => !(ctx || {}).object && cfgPad(cfgHelp('Add a Record to the context first.'));
/* Prompt to Clear Property Value — the properties the owner is asked to clear. */
function PromptClearConfig(props){ return cfgPad(<><PropertyEntries {...props}/>{behaviorField('promptClearProperty', props.config, props.setConfig)}</>); }
/* Move to Specific Pipeline — the pipeline, and the stage it lands in (else the pipeline's first). */
function MoveToPipelineConfig({config, setConfig, data, context}){
  const c = config || {}, ctx = context || {};
  if(!ctx.object) return needsRecord(ctx);
  const pipelines = objectPipelines(data, ctx.object).filter(p => p.source !== 'property'), pl = pipelines.find(p => p.id === c.pipeline);
  return cfgPad(<>
    {cfgField('Pipeline', <FormSelect value={c.pipeline || ''} placeholder="Select pipeline" options={pipelines.map(p => ({value:p.id, label:p.label}))} onChange={(v)=>setConfig({...c, pipeline:v, stage:''})}/>)}
    {pl && cfgField('Destination Stage', <FormSelect value={c.stage || ''} placeholder={`First stage (${(pl.stages.find(s => !isClosedStage(s)) || pl.stages[0] || {}).label || '—'})`}
      options={pl.stages.map(s => ({value:s.id, label:s.label}))} onChange={(v)=>setConfig({...c, stage:v})}/>)}
    {behaviorField('moveToPipeline', c, setConfig)}
  </>);
}
/* Create Email Activity — one email now (the established email: its template and recipients, with Cc and Bcc). */
function CreateEmailActivityConfig({config, setConfig, data, onStub}){
  const c = config || {}, e = c.email || {recipients:['recordEmail'], templateId:'', email:null};
  const set = (x) => setConfig({...c, email:x});
  return cfgPad(<>
    {cfgPart('Recipients', <><CheckList options={EMAIL_RECIPIENTS} value={e.recipients || []} onChange={(r)=>set({...e, recipients:r})}/>{emailCopyFields(e, set)}</>)}
    {cfgPart('Email', <EmailChoice entry={e} setEntry={set} data={data} onStub={onStub}/>)}
    {behaviorField('createEmailActivity', c, setConfig)}
  </>);
}
/* Exit Email Sequence — the record's emails still scheduled from the chosen sequence are cancelled. */
function ExitSequenceConfig({config, setConfig, data}){
  const c = config || {};
  return cfgPad(<>
    {cfgField('Email Sequence', <FormSelect value={c.sequenceId || ''} placeholder="Select sequence" options={emailSequencesOf(data).map(q => ({value:q.id, label:q.name}))} onChange={(v)=>setConfig({...c, sequenceId:v})}/>)}
    {cfgHelp('The record’s emails still scheduled from this sequence are cancelled.')}
    {behaviorField('exitEmailSequence', c, setConfig)}
  </>);
}
/* Create Meeting — a meeting that happened, recorded on the record (as Log Meeting). */
function CreateMeetingConfig({config, setConfig}){
  const c = {title:'', platform:'', duration:'30 minutes', notes:'', ...config};
  const set = (patch) => setConfig({...c, ...patch});
  return cfgPad(<>
    {cfgField('Title', <input value={c.title} onChange={e=>set({title:e.target.value})} placeholder="e.g. Initial consultation" style={fieldInput}/>)}
    {cfgField('Platform', <FormSelect value={c.platform} placeholder="Select platform" options={MEETING_PROVIDERS.map(p => p.label)} onChange={(v)=>set({platform:v})}/>)}
    {cfgField('Duration', <FormSelect value={c.duration} placeholder="Select duration" options={MEETING_DURATIONS} onChange={(v)=>set({duration:v})}/>)}
    {cfgField('Notes', <textarea rows={3} value={c.notes} onChange={e=>set({notes:e.target.value})} style={{...fieldInput, resize:'vertical', lineHeight:1.5}}/>)}
    {behaviorField('createMeeting', c, setConfig)}
  </>);
}
/* Add Call Log — a call made elsewhere, recorded on the record (as Log Call). */
function AddCallLogConfig({config, setConfig}){
  const c = {outcome:'', callType:'Outbound', comment:'', ...config};
  const set = (patch) => setConfig({...c, ...patch});
  return cfgPad(<>
    {cfgField('Call Type', <FormSelect value={c.callType} placeholder="Select call type" options={CALL_TYPES} onChange={(v)=>set({callType:v || 'Outbound'})}/>)}
    {cfgField('Call Outcome', <FormSelect value={c.outcome} placeholder="Select outcome" options={LOG_CALL_OUTCOMES} onChange={(v)=>set({outcome:v})}/>)}
    {cfgField('Note', <textarea rows={3} value={c.comment} onChange={e=>set({comment:e.target.value})} style={{...fieldInput, resize:'vertical', lineHeight:1.5}}/>)}
    {behaviorField('addCallLog', c, setConfig)}
  </>);
}
/* Initiate Call — a live call the owner makes (Track Violations): resolved when a call is made through the dialer. */
function InitiateCallConfig({config, setConfig}){
  return cfgPad(<>{cfgHelp('The record owner is asked to call the record. The Workflow Violation is resolved when a call is made through the dialer.')}{behaviorField('initiateCall', config, setConfig)}</>);
}
/* Delete Record — the owner is asked to delete the record (Track Violations), behind the usual confirmation and their delete permission. */
function DeleteRecordConfig({config, setConfig, context}){
  const ctx = context || {};
  if(!ctx.object) return needsRecord(ctx);
  return cfgPad(<>{cfgHelp('The record owner is asked to delete this record. They confirm it, and need permission to delete it — a workflow never deletes on its own.')}{behaviorField('deleteRecord', config, setConfig)}</>);
}
/* Update Associated Record — the associated records of a type (the contact, its deals, its customers), set to values. */
function UpdateAssociatedConfig({config, setConfig, data, context}){
  const c = config || {}, ctx = context || {};
  if(!ctx.object) return needsRecord(ctx);
  const targets = (ASSOCIATED_OBJECTS[ctx.object] || []).filter(workspaceHasType);
  return cfgPad(<>
    {cfgField('Associated Record', <FormSelect value={c.object || ''} placeholder="Select record" options={targets.map(o => ({value:o, label:objectName(data, o).replace(/s$/, '')}))}
      onChange={(v)=>setConfig({...c, object:v, properties:[]})}/>)}
    {c.object && <PropertyEntries config={c} setConfig={setConfig} data={data} context={{object:c.object}} withValue/>}
    {c.object && cfgHelp(`Every associated ${objectName(data, c.object).replace(/s$/, '').toLowerCase()} of the record is updated; the triggering record isn't.`)}
    {behaviorField('updateAssociatedRecord', c, setConfig)}
  </>);
}
/* Classify Record (AI) — a choice property the AI fills in from the record's data (mocked for now). */
function ClassifyConfig({config, setConfig, data, context}){
  const c = config || {}, ctx = context || {};
  if(!ctx.object) return needsRecord(ctx);
  const props = objectProperties(data, ctx.object).filter(p => propertyTypeId(p.type) === 'Single Selection' && (p.options || []).length);
  const prop = props.find(p => p.key === c.property);
  return cfgPad(<>
    {cfgField('Property', <FormSelect value={c.property || ''} placeholder="Select property" options={props.map(p => ({value:p.key, label:p.label}))} onChange={(v)=>setConfig({...c, property:v})}/>)}
    {prop && cfgPart('Possible values', cfgHelp((prop.options || []).join(' · ')))}
    {cfgHelp('The AI reads the record’s data and sets the property to the value that fits — then it can be used in filters. (Mocked until an AI is connected; marked as AI in the run.)')}
    {behaviorField('classifyRecord', c, setConfig)}
  </>);
}
/* Assign Record Owner — to a person; in turn within a team; round-robin over an ordered list; or to a
   user matching User Property conditions (several match: in turn among them; none: the owner stays). */
const ASSIGN_METHODS = [
  {key:'person', label:'Assign to a Person', description:'A specific sales professional.'},
  {key:'team', label:'Within a Team', description:'The team’s members in turn, each time it runs.'},
  {key:'roundRobin', label:'Round-Robin', description:'An ordered list, one after another, then back to the first.'},
  {key:'properties', label:'Based on Owner Properties', description:'A user matching the conditions; several: in turn; none: the owner stays.'},
];
const assignOwnerReady = (c) => { c = c || {};
  return c.method === 'person' ? !!c.user : c.method === 'team' ? !!c.team : c.method === 'roundRobin' ? (c.users || []).length > 0
    : c.method === 'properties' ? (c.rules || []).length > 0 && c.rules.every(r => { const op = r.property && fieldOperatorOf(userPropertyFields(null).find(f => f.key === r.property), r.op);
        return !!op && (op.noValue || (Array.isArray(r.value) ? r.value.length > 0 : String(r.value ?? '') !== '')); }) : false; };
function AssignOwnerConfig({config, setConfig, data, context}){
  const c = {method:'', users:[], rules:[], ...config};
  const set = (patch) => setConfig({...c, ...patch});
  const ctx = context || {};
  if(!ctx.object) return needsRecord(ctx);
  const users = workflowUsers(data);
  const iconBtn = (icon, title, onClick, disabled) => <button type="button" title={title} disabled={disabled} onClick={onClick}
    style={{border:'none', background:'transparent', cursor: disabled ? 'default' : 'pointer', display:'flex', padding:4, opacity: disabled ? .35 : 1}}><Icon name={icon} size={12} color={T.gray600}/></button>;
  const userFields = userPropertyFields(data), fieldOf = (key) => userFields.find(f => f.key === key);
  const opsFor = (f) => fieldOperators(f, {withChange:false}).map(o => ({value:o.id, label:o.label}));
  return cfgPad(<>
    {cfgPart('Method', <div role="radiogroup" aria-label="Assignment method" style={{display:'flex', flexDirection:'column', gap:8}}>
      {ASSIGN_METHODS.map(m => <StRadioCard key={m.key} selected={c.method === m.key} title={m.label} description={m.description} onSelect={()=>set({method:m.key})}/>)}
    </div>)}
    {c.method === 'person' && cfgField('Owner', <FormSelect value={c.user || ''} placeholder="Select person" options={users.map(u => ({value:u.id, label:u.name}))} onChange={(v)=>set({user:v})}/>)}
    {c.method === 'team' && cfgField('Team', <FormSelect value={c.team || ''} placeholder="Select team" options={(data.teams || []).map(t => ({value:t.id, label:t.name}))} onChange={(v)=>set({team:v})}/>)}
    {c.method === 'roundRobin' && cfgPart('Order', <div style={{display:'flex', flexDirection:'column', gap:6}}>
      {c.users.map((id, i) => (
        <div key={id} style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:T.attioText}}>
          <span style={{width:16, fontSize:12, color:T.gray400, fontVariantNumeric:'tabular-nums'}}>{i + 1}</span>
          <Avatar name={assigneeLabel(data, id)} size={20}/><span style={{flex:1, minWidth:0}}>{assigneeLabel(data, id)}</span>
          {iconBtn('arrowUp', 'Move up', ()=>{ const n = c.users.slice(); [n[i - 1], n[i]] = [n[i], n[i - 1]]; set({users:n}); }, i === 0)}
          {iconBtn('arrowDown', 'Move down', ()=>{ const n = c.users.slice(); [n[i + 1], n[i]] = [n[i], n[i + 1]]; set({users:n}); }, i === c.users.length - 1)}
          {iconBtn('close', 'Remove', ()=>set({users:c.users.filter(x => x !== id)}))}
        </div>
      ))}
      <SearchableSelect value="" placeholder="Add a person" searchPlaceholder="Search users" options={users.filter(u => !c.users.includes(u.id)).map(u => ({value:u.id, label:u.name}))}
        onChange={(id)=>id && set({users:[...c.users, id]})}/>
    </div>)}
    {c.method === 'properties' && cfgPart('Eligible owners', <div style={{display:'flex', flexDirection:'column', gap:8}}>
      {c.rules.map((r, i) => { const f = fieldOf(r.property); const setR = (patch) => set({rules:c.rules.map(x => x.id === r.id ? {...x, ...patch} : x)}); return (
        <div key={r.id} style={{display:'flex', flexDirection:'column', gap:6, padding:10, border:`1px solid ${T.attioLine}`, borderRadius:8}}>
          <div style={{display:'flex', gap:6, alignItems:'center'}}>
            <div style={{flex:1, minWidth:0}}><FormSelect value={r.property || ''} placeholder="Select user property" options={userFields.map(x => ({value:x.key, label:x.label}))} onChange={(v)=>setR({property:v, op:'', value:''})}/></div>
            {iconBtn('trash', 'Remove condition', ()=>set({rules:c.rules.filter(x => x.id !== r.id)}))}
          </div>
          {f && <div style={{display:'flex', gap:6}}>
            <div style={{flex:'1 1 0', minWidth:0}}><FormSelect value={r.op || ''} placeholder="Select condition" options={opsFor(f)} onChange={(v)=>setR({op:v, value:''})}/></div>
            <div style={{flex:'1 1 0', minWidth:0}}><ConditionValueInput compact prop={fieldProperty(f)} op={fieldOperatorOf(f, r.op)} value={r.value ?? ''} onChange={(v)=>setR({value:v})}/></div>
          </div>}
        </div>
      ); })}
      <div><UnderlineAction label="+ Add condition" onClick={()=>set({rules:[...c.rules, {id:newEntryId('ar'), property:'', op:'', value:''}]})}/></div>
      {cfgHelp('All conditions must hold. Several users match: assigned in turn among them. None match: the current owner stays (noted in the run).')}
    </div>)}
    {behaviorField('assignOwner', c, setConfig)}
  </>);
}

/* Action types with a configuration: {Config}. */
const WORKFLOW_ACTION_CONFIGS = {
  setPropertyValue:       {Config:SetPropertyConfig},
  clearProperty:          {Config:ClearPropertyConfig},
  promptUpdateProperty:   {Config:PromptUpdateConfig},
  moveStageForward:       {Config:MoveForwardConfig},
  moveStageBackward:      {Config:MoveBackwardConfig},
  moveToStage:            {Config:MoveToStageConfig},
  createTask:             {Config:CreateTaskConfig},
  scheduleEmail:          {Config:ScheduleEmailConfig},
  addNote:                {Config:AddNoteConfig},
  scheduleMeeting:        {Config:ScheduleMeetingConfig},
  notify:                 {Config:NotifyConfig},
  createAssociatedObject: {Config:CreateAssociatedConfig},
  blockEntry:             {Config:BlockEntryConfig},
  promptClearProperty:    {Config:PromptClearConfig},
  moveToPipeline:         {Config:MoveToPipelineConfig},
  createEmailActivity:    {Config:CreateEmailActivityConfig},
  exitEmailSequence:      {Config:ExitSequenceConfig},
  createMeeting:          {Config:CreateMeetingConfig},
  addCallLog:             {Config:AddCallLogConfig},
  initiateCall:           {Config:InitiateCallConfig},
  deleteRecord:           {Config:DeleteRecordConfig},
  updateAssociatedRecord: {Config:UpdateAssociatedConfig},
  classifyRecord:         {Config:ClassifyConfig},
  assignOwner:            {Config:AssignOwnerConfig},
};

/* A grouped action in the Add Action menu: the MenuItem with a chevron; hovering or clicking it
   opens its actions in a submenu beside it (the same menu shell) — on the right, or on the left
   when there's no room. The submenu floats (fixed, portalled) so the canvas can't clip it; a short
   delay lets the pointer travel from the item to the submenu. */
function ActionGroupItem({group, onPick, disabled, hold}){
  const [pos, setPos] = React.useState(null);
  const [h, setH] = React.useState(false);
  const ref = React.useRef(null), timer = React.useRef(null), subRef = React.useRef(null);
  const SUB_W = 260;   // room for the longest item on one line (e.g. Stage Entry Moving Backward)
  const open = () => {
    clearTimeout(timer.current);
    const r = ref.current.getBoundingClientRect();
    setPos({top:r.top - 7, left: r.right + 6 + SUB_W <= window.innerWidth - 8 ? r.right + 6 : Math.max(8, r.left - 6 - SUB_W)});
  };
  const closeSoon = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setPos(null), 160); };
  // A group inside this submenu (Move Stage in Stage-Based Actions) keeps this one open while it's in use.
  const keep = () => { clearTimeout(timer.current); if(hold) hold.keep(); };
  const childHold = {keep, release:() => { closeSoon(); if(hold) hold.release(); }};
  React.useEffect(() => () => clearTimeout(timer.current), []);
  /* Kept inside the window: a submenu that would run past the bottom moves up to fit (one taller
     than the window scrolls), so its last items stay reachable. */
  React.useLayoutEffect(() => {
    const el = subRef.current;
    if(!pos || !el) return;
    const room = window.innerHeight - 16, h = Math.min(el.scrollHeight, room);
    const top = Math.max(8, Math.min(pos.top, window.innerHeight - 8 - h));
    if(top !== pos.top || pos.maxH !== room) setPos(p => p && ({...p, top, maxH:room}));
  }, [pos]);
  // A disabled group (as a disabled MenuItem): muted, and its submenu doesn't open.
  if(disabled) return (
    <div aria-disabled="true" style={{display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:6, fontSize:13, color:T.gray400, cursor:'default'}}>
      <Icon name={group.icon} size={14} color={T.gray400}/><span style={{flex:1, whiteSpace:'nowrap'}}>{group.label}</span>
      <Icon name="chevDown" size={12} color={T.gray400} style={{transform:'rotate(-90deg)'}}/>
    </div>
  );
  return (
    <div ref={ref} onMouseEnter={()=>{ setH(true); open(); }} onMouseLeave={()=>{ setH(false); closeSoon(); }}>
      <div onClick={open} aria-haspopup="menu" aria-expanded={!!pos} style={{display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:6,
        fontSize:13, color:'#1A1A1A', cursor:'pointer', background: h || pos ? T.headerBg : 'transparent'}}>
        <Icon name={group.icon} size={14} color={T.gray600}/><span style={{flex:1, whiteSpace:'nowrap'}}>{group.label}</span>
        <Icon name="chevDown" size={12} color={T.gray600} style={{transform:'rotate(-90deg)'}}/>
      </div>
      {pos && ReactDOM.createPortal(
        <div ref={subRef} role="menu" onMouseDown={e=>e.stopPropagation()} onMouseEnter={keep} onMouseLeave={()=>{ closeSoon(); if(hold) hold.release(); }}
          style={{position:'fixed', top:pos.top, left:pos.left, width:SUB_W, zIndex:120, maxHeight:pos.maxH, overflowY:'auto', boxSizing:'border-box', background:'#fff', border:`1px solid ${T.border}`, borderRadius:10,
            boxShadow:'0 4px 16px rgba(16,24,40,.12)', padding:6, fontWeight:400, whiteSpace:'nowrap'}}>
          {group.children.map(c => c.children
            ? <ActionGroupItem key={c.key} group={c} onPick={(k)=>{ setPos(null); onPick(k); }} hold={childHold}/>
            : <MenuItem key={c.key} icon={<Icon name={c.icon} size={14} color={c.disabled ? T.gray400 : T.gray600}/>} label={c.label} disabled={c.disabled}
                onClick={()=>{ setPos(null); onPick(c.key); }}/>)}
        </div>, document.body)}
    </div>
  );
}

/* Context — where the workflow operates: the CRM branch it's built in (Started from), then the
   levels added here, each a select with a remove ×. "+ Object" first; with an Object, "+ Property" and "+ Pipeline"; with a
   Pipeline, "+ Stage". Removing a level removes the levels that depend on it; changing one keeps
   them while they're still valid. A level added but not chosen yet doesn't narrow anything. */
function ContextSection({data, context, onChange}){
  const ctx = context || {};
  const has = (k) => Object.prototype.hasOwnProperty.call(ctx, k);
  const dependents = (k) => WORKFLOW_CONTEXT_FIELDS[k].clears || [];
  const remove = (k) => { const next = {...ctx}; [k, ...dependents(k)].forEach(x => { delete next[x]; }); onChange(next); };
  const set = (k, v) => {
    const next = {...ctx, [k]:v};
    dependents(k).forEach(x => { if(has(x) && next[x] && !WORKFLOW_CONTEXT_FIELDS[x].options(data, next).some(o => o.value === next[x])) next[x] = ''; });
    onChange(next);
  };
  const canAdd = (k) => !has(k) && (!WORKFLOW_CONTEXT_FIELDS[k].after || !!ctx[WORKFLOW_CONTEXT_FIELDS[k].after])
    && (k !== 'pipeline' || objectPipelines(data, ctx.object).length > 0);
  const row = (label, control, trailing) => (
    <div key={label} style={{display:'flex', alignItems:'center', gap:8, minHeight:34}}>
      <span style={{width:80, flexShrink:0, fontSize:12.5, color:T.attioMuted, whiteSpace:'nowrap'}}>{label}</span>
      <div style={{flex:1, minWidth:0}}>{control}</div>
      {trailing}
    </div>
  );
  return cfgPart(null, (
    <div style={{display:'flex', flexDirection:'column', gap:8}}>
      {row('Started from', <span style={{fontSize:13, color:T.attioText}}>{ACTIVE_CRM.name} CRM</span>)}
      {WORKFLOW_CONTEXT_LEVELS.filter(has).map(k => {
        const f = WORKFLOW_CONTEXT_FIELDS[k];
        return row(f.label, <FormSelect value={ctx[k] || ''} placeholder={`Select ${f.label.toLowerCase()}`} options={f.options(data, ctx)} onChange={(v)=>set(k, v)}/>,
          <button title={`Remove ${f.label}`} aria-label={`Remove ${f.label}`} onClick={()=>remove(k)} style={sidePanelIconBtn}><Icon name="close" size={12} color={T.gray600}/></button>);
      })}
      {WORKFLOW_CONTEXT_LEVELS.some(canAdd) && (
        <div style={{display:'flex', flexWrap:'wrap', gap:8, marginTop:4}}>
          {WORKFLOW_CONTEXT_LEVELS.filter(canAdd).map(k => (
            <button key={k} onClick={()=>onChange({...ctx, [k]:''})} style={toolbarButton}>
              <Icon name="plus" size={13} color={T.gray600}/> {WORKFLOW_CONTEXT_FIELDS[k].label}
            </button>
          ))}
        </div>
      )}
    </div>
  ));
}
/* Needs attention: what to fix, and the fix when one choice puts it right. */
const attentionNote = (issue, onFix) => issue && (
  <div role="alert" style={{display:'flex', flexDirection:'column', alignItems:'flex-start', gap:6, padding:'10px 12px', borderRadius:8, border:`1px solid ${T.red}`, background:'#fff'}}>
    <span style={{fontSize:12.5, fontWeight:600, color:T.red}}>Needs attention</span>
    <span style={{fontSize:13, color:T.attioText, lineHeight:1.45}}>{issue.message}</span>
    {issue.fix && onFix && <button onClick={onFix} style={toolbarButton}>{issue.fix.label}</button>}
  </div>
);
// The flag on a node row.
const attentionFlag = <div style={{fontSize:12, fontWeight:500, color:T.red, margin:'4px 0 0 32px'}}>Needs attention</div>;

/* The selected trigger's own settings — adapted to the trigger and the context (see
   triggerSettingFields): never a second pipeline or stage when the context has one. */
// Form Submitted: any form, or one (the forms are Marketing's — the record hub's).
function TriggerFormField({value, onChange}){
  const hub = useRecordHub();
  const forms = ((hub && hub.forms) || []).filter(f => !f.deleted);
  return cfgField('Form', <FormSelect value={value} placeholder="Any form" options={[{value:'', label:'Any form'}, ...forms.map(f => ({value:f.id, label:f.name}))]}
    onChange={(v)=>onChange(v, (forms.find(f => f.id === v) || {}).name || '')}/>);
}
function TriggerSettings({data, trig, context, config, onChange}){
  const c = config || {}, ctx = context || {};
  const set = (patch) => onChange({...c, ...patch});
  const pipelineId = ctx.pipeline || c.pipeline;
  const at = ACTIVITY_TRIGGER_TYPES[trig.key];
  return triggerSettingFields(trig, ctx, c).map(f => {
    switch(f){
      /* The property — the context's when it has one (no select; the condition is then written for
         it) — and its mandatory condition, straight after (Property Update). */
      case 'property': {
        const sc = scopeOf(c), own = sc === 'record';
        const watched = ctx.property && own ? {...c, property:ctx.property} : c;
        const options = own ? triggerProperties(data, ctx.object).map(p => ({value:p.key, label:p.label})) : (scopeFields(data, sc) || []).map(x => ({value:x.key.slice(5), label:x.label}));
        // The property and its condition in one row (a Property context's property is already chosen).
        const pick = !(ctx.property && own) && {label:sc === 'owner' ? 'User Property' : sc === 'profile' ? 'Customer Profile Property' : sc === 'accounting' ? 'Accounting Property' : sc === 'form' ? 'Form Property' : 'Property',
          control:<FormSelect value={c.property || ''} placeholder="Select property" options={options}
            onChange={(v)=>onChange({...c, ...adaptPropertyCondition(data, {context:ctx, trigger:trig.key, triggerConfig:c}, v)})}/>};
        return <React.Fragment key={f}>
          {(pick || watched.property) && <TriggerPropertyCondition data={data} workflow={{context:ctx, trigger:trig.key, triggerConfig:watched}} property={pick || undefined}
            onChange={(patch)=>onChange({...watched, ...patch})}/>}
          {sc === 'accounting' && cfgHelp('Read from the record’s payment plans in Accounting.')}
          {sc === 'form' && cfgHelp('Read from the form submission that created the record (Marketing → Forms).')}
          {sc === 'owner' && cfgHelp(ctx.object ? 'Checks the record owner’s User Properties.' : 'Checked for each user: the workflow runs for every user it holds for.')}
        </React.Fragment>;
      }
      case 'pipeline': return <React.Fragment key={f}>{cfgField('Pipeline', <FormSelect value={c.pipeline || ''} placeholder="Select pipeline"
        options={objectPipelines(data, ctx.object).map(p => ({value:p.id, label:p.label}))} onChange={(v)=>set({pipeline:v, stage:''})}/>)}</React.Fragment>;
      case 'stage': return <React.Fragment key={f}>{cfgField('Stage', <FormSelect value={c.stage || ''} placeholder="Select stage"
        options={WORKFLOW_CONTEXT_FIELDS.stage.options(data, {pipeline:pipelineId})} onChange={(v)=>set({stage:v})}/>)}</React.Fragment>;
      case 'duration': return <React.Fragment key={f}>{cfgField(trig.key === 'recordNotChanged' ? 'For' : 'After', <DurationInput value={{amount:c.amount || '', unit:c.unit || 'Days'}} onChange={(d)=>set({amount:d.amount, unit:d.unit})}/>)}</React.Fragment>;
      // What to watch: a specific email (then its template) or a count (then Repeat and the condition).
      case 'activityProperty': return <React.Fragment key={f}>{cfgField(at.label, <FormSelect value={c.activityProperty || ''} placeholder={at.placeholder}
        options={at.properties.filter(p => !p.unavailable || p.value === c.activityProperty).map(p => ({value:p.value, label:p.label}))} onChange={(v)=>set({activityProperty:v})}/>)}</React.Fragment>;
      case 'template': return <React.Fragment key={f}>{cfgField('Email Template', <FormSelect value={c.template || ''} placeholder="Any email"
        options={[{value:'', label:'Any email'}, ...emailTemplatesOf(data).map(t => ({value:t.id, label:t.name}))]} onChange={(v)=>set({template:v})}/>)}</React.Fragment>;
      case 'agoDuration': return <React.Fragment key={f}>{cfgField('Sent', <DurationInput value={{amount:c.agoAmount || '', unit:c.agoUnit || 'Days'}} onChange={(d)=>set({agoAmount:d.amount, agoUnit:d.unit})}/>)}{cfgHelp('Fires that long after each email is sent.')}</React.Fragment>;
      case 'callOutcome': return <React.Fragment key={f}>{cfgField('Call Outcome', <FormSelect value={c.outcome || ''} placeholder="Any outcome"
        options={[{value:'', label:'Any outcome'}, ...['Connected', 'No answer', 'Left voicemail', 'Wrong number', 'Cancelled', 'Disconnected'].map(o => ({value:o, label:o}))]} onChange={(v)=>set({outcome:v})}/>)}</React.Fragment>;
      case 'form': return <TriggerFormField key={f} value={c.form || ''} onChange={(id, name)=>set({form:id, formName:name})}/>;
      // The associated Object, then its parameter — one row.
      case 'associatedObject': return <React.Fragment key={f}>
        <div style={{display:'flex', gap:8}}>
          <div style={{flex:'1 1 0', minWidth:0}}>{cfgField('Associated Object', <FormSelect value={c.associatedObject || ''} placeholder="Select object"
            options={associatedObjectsOf(ctx.object).map(o => ({value:o, label:objectSingular(data, o)}))} onChange={(v)=>set({associatedObject:v})}/>)}</div>
          <div style={{flex:'1 1 0', minWidth:0}}>{cfgField('Parameter', <FormSelect value={c.assocParam || ''} placeholder="Select parameter"
            options={ASSOCIATED_RECORD_PARAMS.map(x => ({value:x.value, label:x.label}))}
            onChange={(v)=>set({assocParam:v})}/>)}</div>
        </div>
        {c.assocParam && cfgHelp(associatedParamHelp(data, ctx, c))}</React.Fragment>;
      case 'assocParam': return null;
      // Is not created / Is not changed: When (the property trigger's control).
      case 'assocTiming': return <WhenField key={f} config={c} context={ctx} onChange={set}/>;
      // The count condition; Equals turns Repeat off (it goes with Is more than / Is less than).
      case 'countCondition': return <React.Fragment key={f}>{cfgField('Condition', (
        <div style={{display:'flex', gap:8}}>
          <div style={{flex:'1 1 0', minWidth:0}}><FormSelect value={c.op || ''} placeholder="Select operator" options={COUNT_OPERATORS.map(o => ({value:o.value, label:o.label}))}
            onChange={(v)=>set(countRepeatable({op:v}) ? {op:v} : {op:v, repeat:false})}/></div>
          <input type="number" min="0" value={c.value ?? ''} onChange={e=>set({value:e.target.value})} placeholder="0" aria-label="Count"
            style={{...fieldInput, flex:'1 1 0', width:0, minWidth:0}}/>
        </div>
      ))}</React.Fragment>;
      // Only with Is more than / Is less than: every increment above, or every decrement below.
      case 'repeat': { if(!countRepeatable(c)) return null;
        const n = countConditionComplete(c) ? Number(c.value) : null, step = repeatStepLabel(c);
        const eg = n === null ? '' : c.op === 'gt' ? `${n + 1}, ${n + 2}, ${n + 3}…` : n > 0 ? [n - 1, n - 2, n - 3].filter(x => x >= 0).join(', ') + (n > 3 ? '…' : '') : '';
        return (
          <div key={f} style={{display:'flex', flexDirection:'column', gap:4}}>
            <label style={{display:'flex', alignItems:'flex-start', gap:10, fontSize:13, color:T.attioText, lineHeight:1.45, cursor:'pointer'}}>
              <span style={{flex:1}}>Repeat this workflow with every {step}</span>
              <span style={{paddingTop:3}}><UtToggle on={!!c.repeat} onChange={(v)=>set({repeat:v})}/></span>
            </label>
            {c.repeat && eg && cfgHelp(`Runs each time the count ${c.op === 'gt' ? 'goes up' : 'goes down'} to ${eg}`)}
          </div>
        ); }
    }
    return null;
  });
}

/* The workflow builder, for any side panel: header; the canvas (CONTEXT → TRIGGER → ACTION, then
   Workflow control — its type, Trigger Scope and Applies To) with the configuration
   area on its right; Cancel / Save at the bottom. A new workflow opens on its Context; a saved one,
   on its first trigger. `onSave(workflow, newTemplates)`. */
/* Rename workflow — the Rename template modal: the name only (triggers, conditions, actions and
   version stay as they are). */
function RenameWorkflowModal({name, onSave, onCancel}){
  const [value, setValue] = React.useState(name || '');
  return (
    <StModal title="Rename Workflow" primary="Save" canSubmit={!!value.trim()} onCancel={onCancel} onSubmit={()=>onSave(value.trim())}>
      <div><label style={fieldLabel}>Workflow Name</label><input autoFocus value={value} onChange={e=>setValue(e.target.value)} style={fieldInput}/></div>
    </StModal>
  );
}
/* `canEdit` / `canStop` / `canRevert`: the signed-in person's workflow permissions (canWorkflow).
   Without Edit the builder is view-only: everything can be opened and read, nothing changes. */
function WorkflowEditor({data, initial, onCancel, onSave, onDelete, onRename, onStub, onSetActive, onRestore, canEdit = true, canStop = true, canRevert = true}){
  const [draft, setDraftRaw] = React.useState(() => normalizeWorkflow(JSON.parse(JSON.stringify(initial))));
  const readOnly = !canEdit;
  const setDraft = readOnly ? () => {} : setDraftRaw;
  // 'type' | 'context' | 'trigger' (the Trigger node, no trigger chosen) | a trigger id | an action id
  const [selected, setSelected] = React.useState(() => (draft.triggers[0] || {}).id || (draft.version ? 'trigger' : 'context'));
  const [timingOpen, setTimingOpen] = React.useState({});      // action id → its timing shown
  const [tab, setTab] = React.useState('builder');               // 'builder' | 'runs' | 'versions'
  const active = draft.active !== false;
  // A saved workflow turns on / off at once (on only when it's ready, as Save requires); a new one takes the setting when it's saved.
  const setActive = (v) => { if(!canStop || (v && onSetActive && !workflowReady(draft, data))) return; setDraftRaw(d => ({...d, active:v})); if(onSetActive) onSetActive(v); };
  /* Close / Cancel with changes not saved asks first (the name and on / off are saved at once, so
     they don't count). */
  const configOf = (w) => { const {name, active:_a, ...rest} = w; return JSON.stringify(rest); };
  const openedAs = React.useRef(configOf(draft)).current;
  const [discarding, setDiscarding] = React.useState(false);
  const requestClose = () => readOnly || configOf(draft) === openedAs ? onCancel() : setDiscarding(true);
  const [adding, setAdding] = React.useState(false);
  const [choosingTrigger, setChoosingTrigger] = React.useState(false);   // the Trigger node's trigger menu
  const [renaming, setRenaming] = React.useState(false);
  const set = (patch) => setDraft(d => ({...d, ...patch}));
  /* Triggers — added, configured and removed one by one (the Add Action pattern). A new trigger
     starts on its defaults: an activity trigger on its only property (Notes), else none, counts on
     Is more than; Stay at Stage in Days. */
  const views = workflowTriggerViews(draft);
  const selectedTrigger = views.find(v => v.triggerId === selected);
  const addTrigger = (pick) => {
    const [key, scope] = String(pick).split('|');
    const t = workflowTrigger(key), fields = triggerSettingFields(t, draft.context), at = ACTIVITY_TRIGGER_TYPES[key], cfg = scope ? {scope} : {};
    if(fields.includes('duration')){ cfg.amount = ''; cfg.unit = 'Days'; }
    if(at){ cfg.activityProperty = at.properties.length === 1 ? at.properties[0].value : ''; cfg.template = ''; cfg.op = 'gt'; cfg.value = ''; cfg.repeat = false; }
    // Property Update in a context with a Property watches it (its condition starts on the type's first operator).
    if(t.requiresCondition && (draft.context || {}).property && (scope || 'record') === 'record') Object.assign(cfg, adaptPropertyCondition(data, {context:draft.context, triggerConfig:cfg}, draft.context.property));
    const entry = {id:`tr-${Date.now()}`, trigger:key, triggerConfig:cfg};
    setDraft(d => ({...d, triggers:[...d.triggers, entry]}));
    setSelected(entry.id); setChoosingTrigger(false);
  };
  const setTriggerConfig = (id, cfg) => setDraft(d => ({...d, triggers:d.triggers.map(t => t.id === id ? {...t, triggerConfig:cfg} : t)}));
  // Removing a trigger leaves the others as they are; the selection moves to the first remaining one.
  const removeTrigger = (id) => {
    const rest = draft.triggers.filter(t => t.id !== id);
    setDraft(d => ({...d, triggers:d.triggers.filter(t => t.id !== id)}));
    if(selected === id) setSelected((rest[0] || {}).id || 'trigger');
  };
  // A context change leaves triggers and actions as they are; ones it no longer fits are flagged.
  const setContext = (ctx) => set({context:ctx});
  // The type: every action takes its behavior; one that can't run that way is flagged (Needs attention).
  const setType = (key) => setDraft(d => ({...d, type:key, actions:withTypeBehavior(d.actions, key)}));
  const typeInfo = workflowTypeOf(draft.type);
  const setAction = (id, patch) => setDraft(d => ({...d, actions:d.actions.map(a => a.id === id ? {...a, ...patch} : a)}));
  // Multi-entry actions start with their first entry (Email 1, Task 1, Meeting 1).
  const FIRST_ENTRY = {scheduleEmail:()=>({emails:[newScheduledEmail()]}), createTask:()=>({tasks:[newWorkflowTask()]}), scheduleMeeting:()=>({meetings:[newWorkflowMeeting()]})};
  const addAction = (type) => { const a = withTypeBehavior([{id:`wa-${Date.now()}`, type, config: FIRST_ENTRY[type] ? FIRST_ENTRY[type]() : {}}], draft.type)[0]; setDraft(d => ({...d, actions:[...d.actions, a]})); setSelected(a.id); setAdding(false); };
  const action = draft.actions.find(a => a.id === selected);
  const removeAction = (id) => { setDraft(x => ({...x, actions:x.actions.filter(y => y.id !== id)})); if(selected === id) setSelected((draft.triggers[0] || {}).id || 'trigger'); };
  /* Steps: Context and Triggers, then Actions. Move to Action (once every trigger is ready) goes
     to the first action, or to the Action node with its Add Action menu open. */
  const onActionStep = !!action || selected === 'actions';
  /* Workflow Control: the last step. Go to Workflow Control (once there's an action and none needs
     attention) opens it: the nodes move left and the Workflow control node joins them on the right. */
  // Shown from the start for a workflow that was saved (it got there through Workflow Control).
  const [controlShown, setControlShown] = React.useState(() => (initial.actions || []).length > 0);
  const onControlStep = selected === 'control';
  const goToControl = () => { setControlShown(true); setSelected('control'); };
  // The links: from each node's right edge (the middle of its card, below the tab) to the left
  // edge of Workflow control — measured after each render, updated when they move.
  const flowRef = React.useRef(null), controlRef = React.useRef(null), nodeRefs = React.useRef({});
  const [links, setLinks] = React.useState(null);
  React.useLayoutEffect(() => {
    if(!controlShown || !flowRef.current || !controlRef.current) return;
    const box = flowRef.current.getBoundingClientRect(), c = controlRef.current.getBoundingClientRect();
    const x2 = c.left - box.left, y2 = c.top - box.top + c.height / 2;
    const lines = ['context', 'trigger', 'action'].map(k => nodeRefs.current[k]).filter(Boolean).map(el => {
      const r = el.getBoundingClientRect();
      return {x1:Math.round(r.right - box.left), y1:Math.round(r.top - box.top + WORKFLOW_TAB_H + (r.height - WORKFLOW_TAB_H) / 2), x2:Math.round(x2), y2:Math.round(y2)};
    });
    const next = {w:Math.round(box.width), h:Math.round(box.height), lines};
    if(JSON.stringify(next) !== JSON.stringify(links)) setLinks(next);
  });
  const moveToAction = () => {
    if(draft.actions.length) setSelected(draft.actions[0].id);
    else { setSelected('actions'); setAdding(true); }
  };
  // The context as a path: Migration CRM → Deals → US NIW → Qualified Client.
  const contextPath = contextPathOf(data, draft.context);
  // An action's timing shows while its clock is on (on by default when it already waits);
  // turning the clock off removes the wait, so what's shown is what applies.
  const timingShown = (a) => timingOpen[a.id] ?? Number((a.wait || {}).amount) > 0;
  const toggleTiming = (a) => {
    const on = !timingShown(a);
    setTimingOpen(t => ({...t, [a.id]:on}));
    setAction(a.id, {wait: on ? (a.wait || {amount:'', unit:'Days'}) : null});
  };

  const save = () => {
    // An email marked "Save as reusable template" becomes a template, which the action then uses.
    const newTemplates = [];
    const keep = (entry) => {
      const e = entry.email;
      if(!e || !e.saveAsTemplate) return entry;
      const t = {id:`et-${Date.now()}-${newTemplates.length}`, name:(e.templateName || '').trim() || 'Untitled template', subject:e.subject, html:e.html};
      newTemplates.push(t);
      return {...entry, templateId:t.id, email:null};
    };
    const actions = draft.actions.map(a => a.config && a.config.emails ? {...a, config:{...a.config, emails:a.config.emails.map(keep)}} : a)
      // Each action is saved with its Behavior (the default when untouched), so it's never read as an older action.
      .map(a => behaviorOptions(a.type, a.config) ? {...a, config:{...(a.config || {}), behavior:actionBehavior(a)}} : a);
    // Context levels added but not chosen narrow nothing, so they aren't saved.
    const context = Object.fromEntries(Object.entries(draft.context || {}).filter(([, v]) => v));
    onSave({...draft, context, actions}, newTemplates);
  };

  /* Configuration area for the selected block. */
  const config = () => {
    // Context node: where the workflow operates (pre-filled from where it was opened; editable).
    if(selected === 'context') return (
      <div style={{padding:'18px 20px', display:'flex', flexDirection:'column', gap:16}}>
        <span style={{fontSize:15, fontWeight:600, color:T.attioText}}>Context</span>
        <ContextSection data={data} context={draft.context} onChange={setContext}/>
      </div>
    );
    // A trigger: its own settings (additional conditions are off for now).
    if(selected === 'trigger' || selectedTrigger){
      const trig = selectedTrigger && workflowTrigger(selectedTrigger.trigger);
      return (
        <div style={{padding:'18px 20px', display:'flex', flexDirection:'column', gap:16}}>
          <span style={{fontSize:15, fontWeight:600, color:T.attioText}}>Trigger</span>
          {/* Triggers are added in the Trigger node; the selected one's settings are here. */}
          {/* Its settings — not while its group isn't available in the context (the note says why;
              they're kept, and come back with the Object). */}
          {trig ? cfgPart(triggerLabelOf(selectedTrigger), triggerAvailableIn(selectedTrigger.trigger, selectedTrigger.triggerConfig, draft.context)
                    ? <TriggerSettings key={selectedTrigger.triggerId} data={data} trig={trig} context={draft.context} config={selectedTrigger.triggerConfig}
                        onChange={(c)=>setTriggerConfig(selectedTrigger.triggerId, c)}/> : null)
                : cfgHelp('Choose a trigger in the Trigger block.')}
          {/* A trigger the context no longer fits: what to fix (and the fix, where there's one). */}
          {selectedTrigger && attentionNote(triggerIssue(data, selectedTrigger),
            ()=>setTriggerConfig(selectedTrigger.triggerId, triggerIssue(data, selectedTrigger).fix.apply(selectedTrigger.triggerConfig)))}
        </div>
      );
    }
    if(onControlStep){
      const teams = data.teams || [], users = (data.users || []).filter(u => u.status === 'Activated');
      // Someone deleted since is named as such (not by their ID).
      const who = (v) => { const [kind, id] = v.split(':'); const x = (kind === 'team' ? teams : data.users || []).find(y => y.id === id); return {kind, name:x ? x.name : kind === 'team' ? 'Deleted team' : 'Deleted user'}; };
      // One people / teams list each (Applies To, every permission) — the same picker for each.
      const picker = (chosen, onPick, emptyLabel) => (
        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          {chosen.map(v => { const w = who(v); return (
            <div key={v} style={{display:'flex', alignItems:'center', gap:10, fontSize:13, color:T.attioText}}>
              {w.kind === 'team'
                ? <span style={{width:20, height:20, borderRadius:9999, background:T.headerBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}><Icon name="usersThree" size={12} color={T.gray600}/></span>
                : <Avatar name={w.name} size={20}/>}
              <span style={{flex:1, minWidth:0}}>{w.name}</span>
              <button title={`Remove ${w.name}`} onClick={()=>onPick(chosen.filter(x => x !== v))}
                style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:4}}><Icon name="close" size={12} color={T.gray600}/></button>
            </div>
          ); })}
          <SearchableSelect value="" placeholder={!chosen.length && emptyLabel ? emptyLabel : 'Add people or teams'} searchPlaceholder="Search people and teams"
            options={[...teams.map(t => ({value:`team:${t.id}`, label:t.name, section:'Teams'})), ...users.map(u => ({value:`user:${u.id}`, label:u.name, section:'Users'}))]
              .filter(o => !chosen.includes(o.value))}
            onChange={(v)=>v && onPick([...chosen, v])}/>
        </div>
      );
      // Actions the chosen type can't run, each with why and what to do.
      const misfits = typeInfo ? draft.actions.filter(a => !actionFitsType(draft.type, a)) : [];
      return (
        <div style={{padding:'18px 20px', display:'flex', flexDirection:'column', gap:16}}>
          <span style={{fontSize:15, fontWeight:600, color:T.attioText}}>Workflow control</span>
          {/* Workflow Type — checked against the actions as it's chosen (and as actions change). */}
          {cfgPart('Workflow Type', (
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              <div role="radiogroup" aria-label="Workflow Type" style={{display:'flex', flexDirection:'column', gap:8}}>
                {WORKFLOW_TYPES.map(t => <StRadioCard key={t.key} selected={draft.type === t.key} title={t.label} description={t.description} onSelect={()=>setType(t.key)}/>)}
              </div>
              {misfits.map(a => <React.Fragment key={a.id}>{attentionNote(actionIssue(data, a, draft.context, draft.type))}</React.Fragment>)}
            </div>
          ))}
          {/* Trigger Scope — set per workflow, for all its triggers: which records they apply to. */}
          {cfgPart('Trigger Scope', (
            <div role="radiogroup" aria-label="Trigger Scope" style={{display:'flex', flexDirection:'column', gap:8}}>
              {TRIGGER_SCOPES.map(o => <StRadioCard key={o.key} selected={draft.triggerScope === o.key} title={o.label} onSelect={()=>set({triggerScope:o.key})}/>)}
            </div>
          ))}
          {/* Applies To — the records of these owners (people, or members of teams); none: everyone's. */}
          {cfgPart('Applies To', <>
            {picker(draft.appliesTo || [], (list)=>set({appliesTo:list}), 'All people and teams')}
            {/* People an identical workflow applies to instead (settled when they overlapped). */}
            {(draft.excludedUsers || []).length > 0 && <div style={{...stTextB, fontSize:12.5, marginTop:8}}>
              Not applied to {(draft.excludedUsers || []).map(id => userName(data, id)).join(', ')} — an identical workflow applies to them.</div>}
          </>)}
        </div>
      );
    }
    if(selected === 'actions' && !action) return (
      <div style={{padding:'18px 20px', display:'flex', flexDirection:'column', gap:16}}>
        <span style={{fontSize:15, fontWeight:600, color:T.attioText}}>Action</span>
        {cfgHelp('Add an action in the Action block.')}
      </div>
    );
    if(action){
      const d = workflowAction(action.type) || {label:action.type, icon:'sparkle'};
      const C = WORKFLOW_ACTION_CONFIGS[action.type];
      return (<>
        <div style={{padding:'18px 14px 14px 20px', display:'flex', alignItems:'center', gap:10}}>
          <span style={{width:28, height:28, borderRadius:8, background:T.blueLight, display:'flex', alignItems:'center', justifyContent:'center'}}><Icon name={d.icon} size={15} color={T.blue}/></span>
          <span style={{flex:1, fontSize:13, fontWeight:600, color:T.attioText}}>{d.label}</span>
          {/* Clock: this action's timing (not for scheduled actions — their entries carry it). */}
          {!readOnly && !d.scheduled && !d.instant && (
            <button title="Timing" aria-pressed={timingShown(action)} onClick={()=>toggleTiming(action)}
              style={{...sidePanelIconBtn, background: timingShown(action) ? T.headerBg : 'transparent'}}>
              <Icon name="clock" size={14} color={timingShown(action) ? T.gray800 : T.gray600}/>
            </button>
          )}
          {/* Removing is the action's only other option, so a trash icon rather than a ⋯ menu. */}
          {!readOnly && <button title="Remove action" onClick={()=>removeAction(action.id)} style={sidePanelIconBtn}>
            <Icon name="trash" size={14} color={T.gray600}/>
          </button>}
        </div>
        {!d.scheduled && !d.instant && timingShown(action) && (
          <div style={{padding:'0 20px 16px', marginBottom:14, borderBottom:`1px solid ${T.border}`}}>
            {cfgField('After', <DurationInput value={action.wait || {amount:'', unit:'Days'}} onChange={(w)=>setAction(action.id, {wait:w})}/>)}
          </div>
        )}
        {(() => { const issue = actionIssue(data, action, draft.context, draft.type); return issue && !issue.explained && <div style={{padding:'0 20px 16px'}}>{attentionNote(issue)}</div>; })()}
        {C ? <C.Config key={action.id} config={action.config} setConfig={(c)=>setAction(action.id, {config:c})} data={data} context={draft.context || {}} onStub={onStub || (()=>{})}/>
           : <div style={{padding:'0 20px', ...stTextB}}>Configuration for this action is not defined yet.</div>}
      </>);
    }
    return null;
  };

  return (
    <div style={{flex:1, minHeight:0, display:'flex', flexDirection:'column'}}>
      {/* Header — the pipeline panel's: 56px, the title at the Add User label (15/600) with ⋯
          beside it, Close at the top right. */}
      <div style={{display:'flex', alignItems:'center', gap:8, height:56, padding:'0 14px 0 20px', borderBottom:`1px solid ${T.border}`, flexShrink:0}}>
        <span style={{fontSize:15, fontWeight:600, color:T.attioText}}>{draft.name || 'Workflow'}</span>
        {((onRename && canEdit) || onDelete) && <RowActionsMenu title="Workflow Actions" width={MENU_W} items={[
          ...(onRename && canEdit ? [{label:'Rename Workflow', onClick:()=>setRenaming(true)}] : []),
          ...(onDelete ? [{label:'Delete workflow', danger:true, onClick:onDelete}] : [])]}/>}
        {/* A saved workflow is renamed at once (the draft keeps the new name for its next save). */}
        {discarding && <StModal title="Discard Changes" primary="Discard" danger onCancel={()=>setDiscarding(false)} onSubmit={()=>{ setDiscarding(false); onCancel(); }}>
          <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>Changes to this workflow haven't been saved.</div>
        </StModal>}
        {renaming && <RenameWorkflowModal name={draft.name || ''} onCancel={()=>setRenaming(false)}
          onSave={(name)=>{ set({name}); onRename(name); setRenaming(false); }}/>}
        {/* Builder | Runs | Versions — the configured workflow, its execution history, its saved versions. */}
        <div style={{display:'flex', alignItems:'flex-end', gap:4, marginLeft:16, alignSelf:'flex-end'}}>
          <UtTab label="Builder" active={tab === 'builder'} onClick={()=>setTab('builder')}/>
          <UtTab label="Runs" active={tab === 'runs'} onClick={()=>setTab('runs')}/>
          {draft.version && <UtTab label="Versions" active={tab === 'versions'} onClick={()=>setTab('versions')}/>}
        </div>
        <div style={{flex:1}}/>
        {/* Turning on / off needs Stop (a new workflow takes it when it's saved). */}
        <label title={canStop ? undefined : 'You don’t have permission to stop or start this workflow'} {...(canStop ? {} : {inert:''})}
          style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:T.gray800, marginRight:8, cursor: canStop ? 'pointer' : 'default', opacity: canStop ? 1 : .5}}>
          Active<UtToggle on={active} onChange={setActive}/>
        </label>
        <button title="Close" onClick={requestClose} style={sidePanelIconBtn}><Icon name="close" size={13} color={T.gray600}/></button>
      </div>
      {tab === 'runs' && <div style={{flex:1, minHeight:0, overflowY:'auto'}}><WorkflowRuns workflowId={draft.id}/></div>}
      {tab === 'versions' && <div style={{flex:1, minHeight:0, overflowY:'auto'}}><WorkflowVersions workflow={initial} canRevert={canRevert && !!onRestore} onRestore={onRestore}/></div>}
      <div style={{flex:1, minHeight:0, display: tab === 'builder' ? 'flex' : 'none'}}>
        {/* Canvas — the structure only, centred. */}
        <div style={{flex:1, minWidth:0, overflow:'auto', ...WORKFLOW_CANVAS}}>
          {/* Centred while it fits; wider than the canvas, it scrolls both ways from its left edge
              (auto margins, not flex centring, which would push the left part out of reach). */}
          <div style={{minHeight:'100%', padding:'32px 24px 48px', boxSizing:'border-box', width:'max-content', minWidth:'100%', display:'flex'}}>
          <div ref={flowRef} style={{position:'relative', display:'flex', alignItems:'center', gap: controlShown ? WORKFLOW_CONTROL_GAP : 0, margin:'0 auto', alignSelf:'flex-start'}}>
          {/* Lines from Context, Trigger and Action to Workflow control (the reference's links). */}
          {controlShown && links && (
            <svg aria-hidden="true" width={links.w} height={links.h} style={{position:'absolute', left:0, top:0, pointerEvents:'none', overflow:'visible'}}>
              {links.lines.map((l, i) => <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={T.borderStrong} strokeWidth="1.5"/>)}
            </svg>
          )}
          <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
            {/* Context: where the workflow operates. */}
            <div ref={el => nodeRefs.current.context = el}>
            <WorkflowCard tab="CONTEXT" icon="cube" selected={selected === 'context'} onSelect={()=>setSelected('context')}>
              <div style={{display:'flex', flexDirection:'column', gap:2, minWidth:0}}>
                <span style={{fontSize:11.5, color:T.attioMuted}}>Record in</span>
                <span style={{fontSize:12.5, fontWeight:500, lineHeight:1.45, color: contextPath ? T.attioText : T.gray400}}>{contextPath || 'Select a context'}</span>
              </div>
            </WorkflowCard>
            </div>
            <WorkflowConnector/>
            <div ref={el => nodeRefs.current.trigger = el}>
            <WorkflowCard tab="TRIGGER" icon="workflows" accent selected={selected === 'trigger'} onSelect={views.length ? undefined : ()=>setSelected('trigger')}>
              {/* With two or more triggers: how they relate — All (every trigger) or Any (one of
                  them) — shared by the whole list, and repeated as AND / OR between them. */}
              {views.length > 1 && (
                <div style={{display:'flex', alignItems:'center', gap:8}} onClick={e=>e.stopPropagation()}>
                  <span style={{flex:1, fontSize:12.5, color:T.gray600}}>Run when</span>
                  <div style={{display:'inline-flex', border:`1px solid ${T.borderStrong}`, borderRadius:8, overflow:'hidden', background:'#fff'}} role="radiogroup" aria-label="Run when">
                    {[['all', 'All'], ['any', 'Any']].map(([k, l]) => (
                      <button key={k} role="radio" aria-checked={draft.triggerMatch === k} disabled={readOnly} title={k === 'all' ? 'Every trigger has happened (AND)' : 'Any one trigger happens (OR)'} onClick={()=>set({triggerMatch:k})}
                        style={{border:'none', cursor:'pointer', padding:'4px 12px', fontSize:12, fontWeight:600, fontFamily:'inherit',
                          background: draft.triggerMatch === k ? T.attioBlue : 'transparent', color: draft.triggerMatch === k ? '#fff' : T.gray600}}>{l}</button>
                    ))}
                  </div>
                </div>
              )}
              {views.map((v, i) => {
                const t0 = workflowTrigger(v.trigger) || {label:v.trigger, icon:'workflows'};
                const t = {...t0, label:triggerLabelOf(v), icon: v.trigger === 'propertyUpdate' ? propertyScopeOf(scopeOf(v.triggerConfig)).icon : t0.icon};
                const on = selected === v.triggerId;
                return (
                  <React.Fragment key={v.triggerId}>
                    {i > 0 && <span style={{alignSelf:'center', fontSize:11, fontWeight:600, letterSpacing:.4, color:T.attioMuted}}>{draft.triggerMatch === 'all' ? 'AND' : 'OR'}</span>}
                    <div onClick={(e)=>{ e.stopPropagation(); setSelected(v.triggerId); }} style={{border:`1.5px solid ${triggerIssue(data, v) ? T.red : on ? T.blue : T.border}`, borderRadius:10, padding:'8px 10px', cursor:'pointer', background:'#fff'}}>
                      {/* The trigger's type and its summary (kept in step with the panel). */}
                      {blockLine(t.icon, t.label, triggerSummary(data, v), readOnly ? null : nodeTrash(`Remove ${t.label}`, ()=>removeTrigger(v.triggerId)))}
                      {triggerIssue(data, v) && attentionFlag}
                    </div>
                  </React.Fragment>
                );
              })}
              {/* Clicks in the menu (portalled submenus too) stay here, not the card's own select. */}
              {!readOnly && <div onClick={e=>e.stopPropagation()} style={{position:'relative', alignSelf:'flex-start'}}>
                <button onMouseDown={e=>e.stopPropagation()} onClick={()=>setChoosingTrigger(o => !o)} style={toolbarButton}>
                  <Icon name="plus" size={13} color={T.gray600}/> Add Trigger
                </button>
                <MenuShell open={choosingTrigger} onClose={()=>setChoosingTrigger(false)} width={240}>
                  {WORKFLOW_TRIGGER_GROUPS.map(g => <ActionGroupItem key={g.key} disabled={!triggerGroupAvailable(g, draft.context)} onPick={addTrigger}
                    group={{...g, children:(g.menu || g.triggers).map(m => g.key === 'property' ? {...m, disabled:!propertyScopeAvailable(m.key.split('|')[1], draft.context)} : m)}}/>)}
                </MenuShell>
              </div>}
            </WorkflowCard>
            </div>
            <WorkflowConnector/>
            <div ref={el => nodeRefs.current.action = el}>
            <WorkflowCard tab="ACTION" icon="listBullets" selected={selected === 'actions'}>
              {draft.actions.map(a => {
                const d = workflowAction(a.type) || {label:a.type, icon:'sparkle'};
                const on = selected === a.id;
                return (
                  <div key={a.id} onClick={()=>setSelected(a.id)} style={{border:`1.5px solid ${actionIssue(data, a, draft.context, draft.type) ? T.red : on ? T.blue : T.border}`, borderRadius:10, padding:'8px 10px', cursor:'pointer', background:'#fff'}}>
                    {/* The action in one line (actionSummary), kept in step with the panel. */}
                    <div title={actionSummary(data, a, draft.context)}>{blockLine(d.icon, actionSummary(data, a, draft.context), null, readOnly ? null : nodeTrash(`Remove ${d.label}`, ()=>removeAction(a.id)))}</div>
                    {actionIssue(data, a, draft.context, draft.type) && attentionFlag}
                  </div>
                );
              })}
              {!readOnly && <div style={{position:'relative', alignSelf:'flex-start'}}>
                <button onMouseDown={e=>e.stopPropagation()} onClick={()=>setAdding(o => !o)} style={toolbarButton}>
                  <Icon name="plus" size={13} color={T.gray600}/> Add Action
                </button>
                {/* With a type chosen (Workflow Control), only the actions that run its way. */}
                <MenuShell open={adding} onClose={()=>setAdding(false)} width={240}>
                  {(typeInfo ? actionsForType(draft.type) : WORKFLOW_ACTIONS).map(a => a.children
                    ? <ActionGroupItem key={a.key} group={a} onPick={addAction}/>
                    : <MenuItem key={a.key} icon={<Icon name={a.icon} size={14} color={T.gray600}/>} label={a.label} onClick={()=>addAction(a.key)}/>)}
                </MenuShell>
              </div>}
            </WorkflowCard>
            </div>
          </div>
          {/* Workflow control — the reference's node on the right, linked to the three. */}
          {controlShown && (
            <div ref={controlRef} onClick={()=>setSelected('control')} style={{width:200, flexShrink:0, background:'#fff', borderRadius:10, padding:'10px 12px',
              border:`1.5px solid ${onControlStep ? T.blue : T.borderStrong}`, boxShadow:'0 1px 2px rgba(16,24,40,.05)', cursor:'pointer'}}>
              {/* The privacy (shield) icon in the nodes' icon tile — this node sets the workflow's scope and permissions. */}
              {blockLine('shield', 'Workflow control')}
            </div>
          )}
          </div>
          </div>
        </div>
        {/* Configuration area — the selected block's settings. */}
        {/* View-only: the settings read as set, but nothing in them can be changed. */}
        <div style={{width:400, flexShrink:0, borderLeft:`1px solid ${T.border}`, background:'#fff', overflowY:'auto'}}>
          <div {...(readOnly ? {inert:''} : {})}>{config()}</div>
        </div>
      </div>
      {/* Bottom action area — the Settings drawer footer. */}
      <div style={{height:46, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'flex-end', gap:12, padding:'0 12px', borderTop:`1px solid ${T.borderStrong}`}}>
        {readOnly && <span style={{flex:1, fontSize:12.5, color:T.gray600, paddingLeft:8}}>View only · you don’t have permission to edit this workflow</span>}
        <StSecondary label={readOnly ? 'Close' : 'Cancel'} onClick={requestClose}/>
        {/* Context and Triggers: Move to Action (once every trigger is ready). Actions: Go to Workflow
            Control (once there's an action and none needs attention). Workflow Control: Save. */}
        {readOnly ? null : onControlStep ? <StCta label="Save" disabled={!workflowReady(draft, data)} onClick={save}/>
          : onActionStep ? <StCta label="Go to Workflow Control" disabled={!actionsReady(draft, data)} onClick={goToControl}/>
          : <StCta label="Move to Action" disabled={!triggersReady(draft, data)} onClick={moveToAction}/>}
      </div>
    </div>
  );
}

/* ── Workflows start empty ── no sample workflows are added: every workflow is configured in the
   workspace. The ones added before (samples, deal pipeline rules) were cleared once from saved
   workspaces (`workflowsCleared`, app.jsx) — their runs and violations stay as history. */
const WORKFLOWS_CLEARED = 'w1';

/* ── Starting a workflow — the one way in, from every entry point ── the Workflows module's +,
   a record type, a property, a pipeline, a stage. Each makes the same draft (newWorkflowDraft):
   its context prefilled from where it was started (editable only in the builder's Context), and
   `origin` — where it was started, shown in the builder. Each opens the same builder with the
   same saving (WorkflowEditorHost): validation, versions, turning on / off, deleting. */
const newWorkflowDraft = (context, origin) => ({id:`wf-${Date.now()}`, trigger:null, actions:[], context:context || {}, origin:origin || {type:'workflows'}});
// Where a workflow was started, in a few words ("Stage · CCL Sent · US NIW").
const workflowOriginLabel = (data, origin) => {
  const o = origin || {}, pl = (data.pipelines || []).find(p => p.id === o.pipelineId);
  switch(o.type){
    case 'workflows': return 'Workflows';
    case 'record': return `Record · ${objectName(data, o.objectId)}`;
    case 'property': { const p = (data.properties || []).find(x => x.objectId === o.objectId && x.key === o.propertyKey);
      return `Property · ${p ? p.label : o.propertyKey} · ${objectName(data, o.objectId)}`; }
    case 'pipeline': return `Pipeline · ${pl ? pl.label : o.pipelineId}`;
    case 'pipelineStage': return `Stage · ${pl ? ((pl.stages.find(s => s.id === o.stageId) || {}).label || o.stageId) : o.stageId}${pl ? ` · ${pl.label}` : ''}`;
  }
  return '';
};
// The builder with its saving: each save a new version; on / off and delete for a saved workflow.
// Permissions apply to a saved workflow; a new one is its creator's to configure. A restored
// version opens as the builder's new starting point (keyed by version).
function WorkflowEditorHost({data, setData, workflow, onClose, onStub}){
  const live = (data.workflows || []).find(w => w.id === workflow.id);
  const [overlap, setOverlap] = React.useState(null);   // {w, newTemplates, overlaps}
  const finish = (w, newTemplates) => { saveWorkflowIn(setData, w, newTemplates); onClose(); };
  // Saving: people shared with an identical workflow are settled first.
  const save = (w, newTemplates) => { const overlaps = workflowOverlaps(data, w); if(overlaps.length) setOverlap({w, newTemplates, overlaps}); else finish(w, newTemplates); };
  const resolve = (pick) => {
    const {w, newTemplates, overlaps} = overlap;
    const mine = new Set((w.excludedUsers || []));
    overlaps.forEach(o => {
      const keepHere = o.users.filter(uid => pick[`${o.workflow.id}:${uid}`] === 'this');
      o.users.filter(uid => pick[`${o.workflow.id}:${uid}`] === 'other').forEach(uid => mine.add(uid));
      // The other workflow excludes the people kept here — a new version of it.
      if(keepHere.length) saveWorkflowIn(setData, {...o.workflow, excludedUsers:[...new Set([...(o.workflow.excludedUsers || []), ...keepHere])]});
    });
    setOverlap(null);
    finish({...w, excludedUsers:[...mine]}, newTemplates);
  };
  const isSaved = !!live, may = (key) => isSaved ? canWorkflow(data, live, key) : workflowCan('create');
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  return <>
    <WorkflowEditor key={`${workflow.id}:${isSaved ? live.version : 'new'}`} data={data} initial={live || workflow} onStub={onStub}
      canEdit={may('edit')} canStop={may('stop')} canRevert={may('revert')}
      onCancel={onClose} onSave={save}
      onSetActive={isSaved ? (v) => setWorkflowActiveIn(setData, workflow.id, v) : null}
      onDelete={isSaved && may('delete') ? () => setConfirmDelete(true) : null}
      onRename={isSaved ? (name) => renameWorkflowIn(setData, workflow.id, name) : null}
      onRestore={isSaved ? (version) => restoreWorkflowVersionIn(setData, workflow.id, version) : null}/>
    {overlap && <WorkflowOverlapModal data={data} name={overlap.w.name} overlaps={overlap.overlaps} onCancel={()=>setOverlap(null)} onResolve={resolve}/>}
    {/* Delete asks first, as it does from the Workflows list. */}
    {confirmDelete && <StModal title="Delete Workflow" primary="Delete Workflow" danger onCancel={()=>setConfirmDelete(false)}
      onSubmit={()=>{ setConfirmDelete(false); deleteWorkflowIn(setData, workflow.id); onClose(); }}>
      <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>Delete "{(live || workflow).name || 'this workflow'}"? It stops running; its run history stays. This can't be undone.</div>
    </StModal>}
  </>;
}
/* Versions — every saved version, newest first: when and by whom it was saved (and the version it
   restored). Revert: an earlier one's Restore makes its configuration the next version. */
function WorkflowVersions({workflow, canRevert, onRestore}){
  const [restoring, setRestoring] = React.useState(null);
  const list = [workflow, ...[...(workflow.history || [])].reverse()];
  return (
    <div style={{padding:'8px 24px 24px', maxWidth:880, margin:'0 auto'}}>
      {list.map((v, i) => (
        <div key={v.version || i} style={{display:'flex', alignItems:'center', gap:12, padding:'12px 4px', borderTop: i ? `1px solid ${T.border}` : 'none'}}>
          <span style={{fontSize:13.5, fontWeight:500, color:T.attioText, width:44}}>v{v.version || 1}</span>
          <span style={{flex:1, minWidth:0, fontSize:12.5, color:T.gray600}}>
            {[v.savedAt ? fmtWhen(v.savedAt) : null, v.savedBy, v.restoredFrom ? `Restored from v${v.restoredFrom}` : null].filter(Boolean).join(' · ') || '—'}
          </span>
          {i === 0 ? <span style={{fontSize:12, fontWeight:500, color:'#027A48', background:'#ECFDF3', borderRadius:9999, padding:'2px 8px'}}>Current</span>
            : canRevert && <StTextAction label="Restore" onClick={()=>setRestoring(v.version)}/>}
        </div>
      ))}
      {!canRevert && list.length > 1 && <div style={{...stTextB, padding:'8px 4px'}}>You don’t have permission to revert this workflow.</div>}
      {restoring && (
        <StModal title="Restore Version" primary="Restore Version" onCancel={()=>setRestoring(null)} onSubmit={()=>{ onRestore(restoring); setRestoring(null); }}>
          <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>Restore v{restoring}?</div>
        </StModal>
      )}
    </div>
  );
}
// … as a full section over a page (the Workflows module, Settings).
const WorkflowEditorOverlay = (props) => (
  <div style={{position:'absolute', inset:0, zIndex:70, background:'#fff', display:'flex', flexDirection:'column'}}><WorkflowEditorHost {...props}/></div>
);

Object.assign(window, {WORKFLOWS_CLEARED, canWorkflow, restoreWorkflowVersionIn, WorkflowVersions, renameWorkflowIn, RenameWorkflowModal, newWorkflowDraft, workflowOriginLabel, WorkflowEditorHost, WorkflowEditorOverlay, WORKFLOW_TYPES, workflowTypeOf, actionFitsType, WORKFLOW_OBJECTS, workflowsAvailableFor, saveWorkflowIn, setWorkflowActiveIn, deleteWorkflowIn, behaviorOptions, actionsReady, ACTION_BEHAVIORS, BEHAVIOR_OPTIONS, actionBehavior, triggersReady, triggerIssue, actionIssue, WORKFLOW_CONTEXT_LEVELS, workflowTriggerViews, triggersMatchAll, triggerReady, LEGACY_TRIGGER_ID, normalizeTriggerEntry, triggerSummary, activityTriggerProperty, COUNT_OPERATORS, triggerGroupAvailable, DEFAULT_EMAIL_SEQUENCES, emailSequencesOf, workflowContextLabel, ACTIVITY_TRIGGER_TYPES, workflowPipeline, workflowStage, normalizeWorkflow, triggerProperties, contextPathOf, triggerDetail, triggerSettingFields, WORKFLOW_TRIGGER_GROUPS, WORKFLOW_CONTEXT_FIELDS, WORKFLOW_ACTIONS, WORKFLOW_ACTION_CONFIGS, DEFAULT_EMAIL_TEMPLATES,
  workflowTrigger, workflowAction, actionSummary, workflowReady, emailTemplatesOf, SidePanelHeader, WorkflowCard, WorkflowEditor, ScheduleEmailConfig});
