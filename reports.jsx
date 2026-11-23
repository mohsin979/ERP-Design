/* HOF Pulse ERP — Reports (defined 2026-11-20, Mohsin).

   Reports opens on its landing page (ReportsHome — Mohsin, 2026-11-20; the side menu he first
   asked for was dropped the same day): "Ask Spring to generate reports" — the dashboard's Ask
   Spring box; a request opens the existing report closest to its words (reportForRequest; none
   close: it says so) — and, under it, See Existing Reports: a window (ReportPickerModal) with a
   search and every report by group — Leads, Deals, Activities — then Shared with Me. A report
   opens as its headline figure, a chart and a grouped table (ReportPage): search and filters
   suited to its records (a lead report filters by Created Date, Owner, Lead Source, Type of Lead,
   Lead Status; a deal report by its dates, Owner, Pipeline, Deal Stage, Lost Reason; an activity
   report by Activity Date, Rep, Activity Type, Record Type); time reports group by Day, Week or
   Month. A row's name opens the records behind its number (the report's name returns to the
   groups); a record's name opens it. Its title row: a back arrow to the landing page and, on the
   right, Open Report (the same window). Its actions: Download PDF (the report as shown — title,
   figure, chart, table), Export CSV, Send (an email to any addresses with the report as CSV and /
   or PDF — kept in `reportSends`), Share (with users and teams — AssignPeopleModal; it shows under
   their Shared with Me with its search and filters, and they're told in their bell — kept in
   `reportShares`). The email composer's attachments also offer Attach Report (CSV and / or PDF).

   Counted from what the viewer may see (each record's View permission, each activity's
   visibility). His definitions: Lead Conversion Rate = leads that became a customer ÷ leads
   created; Win / Loss Rate = Won (or Lost) ÷ Won + Lost, by close date; Activity Completion Rate =
   tasks completed ÷ tasks due, per rep; "without recent activity" = no call, email, meeting, task
   or note for 30 days or more (by how long). Emails: sent only (opens and clicks aren't tracked
   yet). Deals Created vs Goal reads Settings → Goals' Deals Created targets (goals.jsx) for the
   goal period now running. Lost Reasons read the deal's Lost Reason. "Leads by Contact Type" was
   dropped (it's Type of Lead, the lead's stage). */

/* ── Rows: one per record or activity, with the values reports group and filter by ─────────── */

const RPT_DAY = 86400000;
const rptDate = (v) => { if(v == null || v === '') return null; const d = v instanceof Date ? v : new Date(typeof v === 'number' ? v : String(v)); return isNaN(d) ? null : d; };
const rptDay = (d) => d ? activityDateValue(d) : '';
const RPT_TYPES = ['call', 'email', 'meeting', 'task', 'note'];
const RPT_TYPE_LABEL = {call:'Call', email:'Email', meeting:'Meeting', task:'Task', note:'Note'};
// The record's last call, email, meeting, task or note that has happened.
function rptLastActivity(acts){
  const now = Date.now(); let last = null;
  (acts || []).forEach(a => { if(!RPT_TYPES.includes(a.type)) return; const d = rptDate(a.at); if(d && d.getTime() <= now && (!last || d > last)) last = d; });
  return last;
}
const rptOwner = (r) => userLabel(r.owner) || '';
function rptRecordRows(hub, object){
  const data = hub.data, acts = (hub.activities || {})[object] || {};
  const customersOf = (cid) => (hub.records.customers || []).some(x => contactIdsOf(x).some(i => sameId(i, cid)));
  return (hub.records[object] || []).filter(r => recordCan(object, r, 'view')).map(r => {
    const created = rptDate(r.createdAt || r.created), last = rptLastActivity(acts[r.id]);
    const base = {id:r.id, _rec:{object, record:r}, name:r.name || '—', owner:rptOwner(r), createdAt:created, created:rptDay(created), lastAt:last};
    if(object === 'contacts') return {...base, source:r.source || '', stage:r.contactType || '', status:r.leadStatus || '', jobTitle:String(r.jobTitle || '').trim(), customer:customersOf(r.id)};
    if(object === 'deals'){
      const type = recordStageType('deals', r), closed = rptDate(r.actualCloseDate), close = rptDate(r.closeDate);
      const pl = (data.pipelines || []).find(p => p.id === r.pipeline);
      return {...base, pipeline:(pl && pl.label) || '', stage:stageLabelOf(data, r.pipeline, r.stage) || '', stageType:type || 'open',
        open:!type || type === 'open', amount:toDefaultCurrency(r.amount, r.currency), lostReason:r.lostReason || '',
        closedAt:closed, closed:rptDay(closed), closeAt:close, close:rptDay(close)};
    }
    return base;
  });
}
// Every call, email, meeting, task and note the viewer may see, with the record it's on and who did it.
function rptActivityRows(hub){
  return hubActivities(hub).filter(e => RPT_TYPES.includes(e.act.type) && visibleActivities(e.object, e.record, [e.act]).length).map(e => {
    const a = e.act, at = rptDate(a.at), view = {...e.record, owner:rptOwner(e.record)};
    const actor = activityActor(a, view);
    const rep = a.type === 'task' ? (a.assignee || (actor && actor.name) || '') : actor && actor.kind !== 'customer' ? actor.name : '';
    const due = a.type === 'task' ? rptDate(a.due) : null;
    return {id:a.id, _act:{object:e.object, record:e.record, act:a}, name:a.title || RPT_TYPE_LABEL[a.type], type:RPT_TYPE_LABEL[a.type], rep,
      recordName:e.record.name || '—', object:HUB_NOUN[e.object], at, date:rptDay(at),
      outcome:a.type === 'call' ? (a.outcome || 'No outcome') : '', direction:a.direction || '',
      sent:a.type === 'email' && a.direction === 'sent' && a.status !== 'scheduled' && !a.logged,
      dueAt:due, due:rptDay(due), completed:a.type === 'task' && !isTaskOpen(a), overdue:a.type === 'task' && isOverdue(a),
      held:a.type === 'meeting' && a.status !== 'cancelled' && a.status !== 'requested'};
  });
}

/* ── Filters, by the kind of records a report counts ─────────────────────────────────────── */

const RPT_DATE_OPS = ['is', 'isNot', 'isBefore', 'isAfter', 'isBetween'], RPT_SELECT_OPS = ['is', 'isNot', 'isAnyOf'];
const rptSelect = (key, label) => ({key, label, type:'select', ops:RPT_SELECT_OPS});
const rptDateProp = (key, label) => ({key, label, type:'date', ops:RPT_DATE_OPS});
const RPT_FILTERS = {
  contacts:() => [rptDateProp('created', 'Created Date'), rptSelect('owner', `${HUB_NOUN.contacts} Owner`), rptSelect('source', 'Lead Source'), rptSelect('stage', 'Type of Lead'), rptSelect('status', 'Lead Status')],
  deals:() => [rptDateProp('created', 'Created Date'), rptDateProp('close', 'Expected Close Date'), rptDateProp('closed', 'Actual Close Date'), rptSelect('owner', 'Deal Owner'),
    rptSelect('pipeline', 'Deal Pipeline'), rptSelect('stage', 'Deal Stage'), rptSelect('lostReason', 'Lost Reason')],
  customers:() => [rptDateProp('created', 'Created Date'), rptSelect('owner', 'Customer Owner')],
  activities:() => [rptDateProp('date', 'Activity Date'), rptSelect('rep', 'Rep'), rptSelect('type', 'Activity Type'), rptSelect('object', 'Record Type')],
  tasks:() => [rptDateProp('due', 'Due Date'), rptSelect('rep', 'Assigned To')],
};
const rptSelectValues = (rows, props) => Object.fromEntries(props.filter(p => p.type === 'select').map(p => [p.key, [...new Set(rows.map(r => r[p.key]).filter(Boolean))].sort()]));

/* ── Grouping ─────────────────────────────────────────────────────────────────────────────── */

const RPT_TIME_UNITS = [{value:'day', label:'Day'}, {value:'week', label:'Week'}, {value:'month', label:'Month'}];
function rptTimeKey(d, unit){
  if(!d) return null;
  if(unit === 'day') return {key:ymdOf(d), label:rptDay(d)};
  if(unit === 'week'){ const m = new Date(d); m.setHours(0, 0, 0, 0); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return {key:ymdOf(m), label:`Week of ${rptDay(m)}`}; }
  return {key:`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label:d.toLocaleDateString('en-US', {month:'short', year:'numeric'})};
}
const rptBlank = (label) => (v) => v || label;
const RPT_AGE_BUCKETS = [{key:'1', label:'30 – 59 days', min:30, max:59}, {key:'2', label:'60 – 89 days', min:60, max:89}, {key:'3', label:'90 days or more', min:90, max:Infinity}];
const rptAgeBucket = (r) => { if(!r.lastAt) return {key:'9', label:'No activity yet'};
  const days = Math.floor((Date.now() - r.lastAt.getTime()) / RPT_DAY); const b = RPT_AGE_BUCKETS.find(x => days >= x.min && days <= x.max); return b ? {key:b.key, label:b.label} : null; };

/* ── The reports ──────────────────────────────────────────────────────────────────────────────
   source: 'contacts' | 'deals' | 'customers' | 'activities' | 'tasks'; where: which rows count;
   by: the group of a row ('time' — by its `time` date, in the unit chosen); kind: 'count' (default),
   'amount', 'rate' ({num, den, numLabel, denLabel}), 'goal', 'pivot' ({colOf}), 'list' (the
   records themselves); headline: the figure above the chart. */
const REPORT_GROUPS = [{id:'leads', icon:'leads', get label(){ return typePlural('contacts', 'Leads'); }}, {id:'deals', icon:'deals', label:'Deals'}, {id:'activities', icon:'activity', label:'Activities'}];
const won = (r) => r.stageType === 'won', lost = (r) => r.stageType === 'lost';
const REPORTS = [
  // Leads
  {id:'leadsTotal', group:'leads', name:'Total Leads Created', source:'contacts', by:'time', time:'createdAt', unit:'month', headline:'total'},
  {id:'leadsByMonth', group:'leads', name:'Leads Created by Month', source:'contacts', by:'time', time:'createdAt', unit:'month'},
  {id:'leadsBySource', group:'leads', name:'Leads by Lead Source', source:'contacts', by:(r) => r.source || 'No Lead Source'},
  {id:'leadsByStage', group:'leads', name:'Leads by Lead Stage', source:'contacts', by:(r) => r.stage || 'No Type of Lead', order:() => LEAD_STAGE_VALUES},
  {id:'leadsByJobTitle', group:'leads', name:'Leads by Job Title', source:'contacts', by:(r) => r.jobTitle || 'No Job Title'},
  {id:'leadsAssigned', group:'leads', name:'New Leads Assigned vs Unassigned', source:'contacts', by:(r) => r.owner ? 'Assigned' : 'Unassigned', order:() => ['Assigned', 'Unassigned'], recent:30},
  {id:'leadsByOwner', group:'leads', name:'Leads by Owner', source:'contacts', by:(r) => r.owner || 'No Owner'},
  {id:'leadsByStatus', group:'leads', name:'Leads by Lead Status', source:'contacts', by:(r) => r.status || 'No Lead Status', order:() => LEAD_STATUSES},
  {id:'leadsConversion', group:'leads', name:'Lead Conversion Rate', source:'contacts', by:'time', time:'createdAt', unit:'month', kind:'rate', headline:'rate',
    rate:{den:() => true, num:(r) => r.customer, denLabel:'Leads Created', numLabel:'Became Customers'}},
  {id:'leadsNoOwner', group:'leads', name:'Leads Without an Owner', source:'contacts', where:(r) => !r.owner, kind:'list', headline:'total'},
  // Deals
  {id:'dealsGoal', group:'deals', name:'Deals Created vs Goal', source:'deals', kind:'goal', headline:'goal'},
  {id:'dealsWonByRep', group:'deals', name:'Deals Won by Rep', source:'deals', where:won, by:(r) => r.owner || 'No Owner', time:'closedAt'},
  {id:'dealsLostByRep', group:'deals', name:'Deals Lost by Rep', source:'deals', where:lost, by:(r) => r.owner || 'No Owner', time:'closedAt'},
  {id:'dealsOpenByClose', group:'deals', name:'Open Deals by Expected Close Date', source:'deals', where:(r) => r.open, by:'time', time:'closeAt', unit:'month', blank:'No Expected Close Date'},
  {id:'dealsOpenByStage', group:'deals', name:'Open Deals by Stage', source:'deals', where:(r) => r.open, by:(r) => r.pipeline ? `${r.pipeline} · ${r.stage || 'No stage'}` : (r.stage || 'No stage')},
  {id:'dealsAmountByRep', group:'deals', name:'Deal Amount Won by Rep', source:'deals', where:won, by:(r) => r.owner || 'No Owner', kind:'amount', headline:'amount', time:'closedAt'},
  {id:'dealsLostReasons', group:'deals', name:'Deal Lost Reasons', source:'deals', where:lost, by:(r) => r.lostReason || 'No Lost Reason'},
  {id:'dealsByMonth', group:'deals', name:'Deals Created by Month', source:'deals', by:'time', time:'createdAt', unit:'month'},
  {id:'dealsWinRate', group:'deals', name:'Deal Win Rate', source:'deals', where:(r) => won(r) || lost(r), by:(r) => r.owner || 'No Owner', kind:'rate', headline:'rate', time:'closedAt',
    rate:{den:() => true, num:won, denLabel:'Closed', numLabel:'Won'}},
  {id:'dealsLossRate', group:'deals', name:'Deal Loss Rate', source:'deals', where:(r) => won(r) || lost(r), by:(r) => r.owner || 'No Owner', kind:'rate', headline:'rate', time:'closedAt',
    rate:{den:() => true, num:lost, denLabel:'Closed', numLabel:'Lost'}},
  {id:'dealsOpenByPipeline', group:'deals', name:'Open Deals by Pipeline', source:'deals', where:(r) => r.open, by:(r) => r.pipeline || 'No Pipeline'},
  {id:'dealsByOwner', group:'deals', name:'Deals by Owner', source:'deals', by:(r) => r.owner || 'No Owner'},
  {id:'dealsNoClose', group:'deals', name:'Open Deals Without an Expected Close Date', source:'deals', where:(r) => r.open && !r.closeAt, kind:'list', headline:'total'},
  // Activities
  {id:'actByDate', group:'activities', name:'Team Activities by Activity Date', source:'activities', where:(r) => !!r.rep, by:'time', time:'at', unit:'day'},
  {id:'actByRep', group:'activities', name:'Activities by Rep', source:'activities', where:(r) => !!r.rep, by:(r) => r.rep},
  {id:'callsByRep', group:'activities', name:'Calls by Rep', source:'activities', where:(r) => r.type === 'Call' && !!r.rep, by:(r) => r.rep},
  {id:'callOutcomes', group:'activities', name:'Call Outcomes by Rep', source:'activities', where:(r) => r.type === 'Call' && !!r.rep, by:(r) => r.rep, kind:'pivot', colOf:(r) => r.outcome},
  {id:'tasksCompleted', group:'activities', name:'Tasks Completed', source:'tasks', where:(r) => r.completed, by:(r) => r.rep || 'Unassigned'},
  {id:'tasksOverdue', group:'activities', name:'Overdue Tasks', source:'tasks', where:(r) => r.overdue, by:(r) => r.rep || 'Unassigned'},
  {id:'meetingsByRep', group:'activities', name:'Meetings by Rep', source:'activities', where:(r) => r.type === 'Meeting' && !!r.rep, by:(r) => r.rep},
  {id:'actByType', group:'activities', name:'Activities by Type', source:'activities', by:(r) => r.type, order:() => RPT_TYPES.map(t => RPT_TYPE_LABEL[t])},
  {id:'taskCompletion', group:'activities', name:'Activity Completion Rate', source:'tasks', where:(r) => !!r.dueAt && r.dueAt.getTime() <= Date.now(), by:(r) => r.rep || 'Unassigned',
    kind:'rate', headline:'rate', rate:{den:() => true, num:(r) => r.completed, denLabel:'Tasks Due', numLabel:'Completed'}},
  {id:'leadsQuiet', group:'activities', get name(){ return `${typePlural('contacts', 'Leads')} Without Recent Activity`; }, source:'contacts', by:rptAgeBucket, order:() => [...RPT_AGE_BUCKETS.map(b => b.label), 'No activity yet']},
  {id:'dealsQuiet', group:'activities', name:'Deals Without Recent Activity', source:'deals', by:rptAgeBucket, order:() => [...RPT_AGE_BUCKETS.map(b => b.label), 'No activity yet']},
  {id:'customersQuiet', group:'activities', name:'Customers Without Recent Activity', source:'customers', by:rptAgeBucket, order:() => [...RPT_AGE_BUCKETS.map(b => b.label), 'No activity yet']},
  {id:'emailsSent', group:'activities', name:'Emails Sent by Send Date', source:'activities', where:(r) => r.sent, by:'time', time:'at', unit:'month'},
];
const reportById = (id) => REPORTS.find(r => r.id === id) || null;
// "1,089 leads", "1 lead".
const rptCount = (n, def) => `${n.toLocaleString('en-US')} ${rptNoun(def, n === 1 ? 1 : 2)}`;
const isReportsPage = (id) => id === 'reports' || (typeof id === 'string' && id.startsWith('reports.'));
const rptSourceObject = (src) => src === 'activities' || src === 'tasks' ? null : src;

/* Runs a report for the viewer: {rows (after search and filters), groups [{key, label, rows, …}],
   columns, headline}. `opt`: {search, filters, unit}. */
function runReport(def, hub, opt = {}){
  const src = def.source, raw = src === 'activities' ? rptActivityRows(hub) : src === 'tasks' ? rptActivityRows(hub).filter(r => r.type === 'Task') : rptRecordRows(hub, src);
  const filterProps = RPT_FILTERS[src]();
  let rows = raw.filter(r => !def.where || def.where(r));
  if(def.recent) rows = rows.filter(r => r.createdAt && Date.now() - r.createdAt.getTime() <= def.recent * RPT_DAY);
  const q = String(opt.search || '').trim().toLowerCase();
  if(q) rows = rows.filter(r => [r.name, r.owner, r.rep, r.recordName].some(v => v && String(v).toLowerCase().includes(q)));
  rows = applyFilters(rows, opt.filters || EMPTY_FILTERS(), filterProps);
  const unit = opt.unit || def.unit || 'month';
  const result = {rows, filterProps, selectValues:rptSelectValues(raw, filterProps), unit};
  if(def.kind === 'list') return {...result, groups:null, headline:{label:rptCount(rows.length, def)}};
  if(def.kind === 'goal') return {...result, ...rptGoal(def, hub, rows)};
  // Groups.
  const map = new Map();
  rows.forEach(r => {
    let g = def.by === 'time' ? rptTimeKey(r[def.time], unit) : def.by(r);
    if(g == null){ if(def.by === 'time' && def.blank) g = {key:'~', label:def.blank}; else return; }
    if(typeof g === 'string') g = {key:g, label:g};
    if(!map.has(g.key)) map.set(g.key, {key:g.key, label:g.label, rows:[]});
    map.get(g.key).rows.push(r);
  });
  let groups = [...map.values()];
  const order = def.order && def.order();
  if(def.by === 'time') groups.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  else if(order) groups.sort((a, b) => { const i = order.indexOf(a.label), j = order.indexOf(b.label); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j) || b.rows.length - a.rows.length; });
  else groups.sort((a, b) => b.rows.length - a.rows.length || a.label.localeCompare(b.label));
  const noun = rptNoun(def, 2);
  if(def.kind === 'amount'){
    groups = groups.map(g => ({...g, count:g.rows.length, value:g.rows.reduce((s, r) => s + (r.amount || 0), 0)}));
    const total = groups.reduce((s, g) => s + g.value, 0);
    return {...result, groups, columns:[{key:'count', label:'Deals'}, {key:'value', label:`Amount (${defaultCurrency()})`, money:true}], chart:'value',
      headline:{label:moneyText(total, defaultCurrency()), sub:`from ${bulkPlural(rows.length, 'deal')}`}};
  }
  if(def.kind === 'rate'){
    const rate = (n, d) => d ? Math.round(n / d * 1000) / 10 : 0;
    groups = groups.map(g => { const den = g.rows.filter(def.rate.den).length, num = g.rows.filter(def.rate.num).length; return {...g, den, num, value:rate(num, den), rows:g.rows}; });
    const den = rows.filter(def.rate.den).length, num = rows.filter(def.rate.num).length;
    return {...result, groups, columns:[{key:'den', label:def.rate.denLabel}, {key:'num', label:def.rate.numLabel}, {key:'value', label:'Rate', pct:true}], chart:'value', pct:true,
      headline:{label:`${rate(num, den)}%`, sub:`${num.toLocaleString('en-US')} of ${den.toLocaleString('en-US')}`}};
  }
  if(def.kind === 'pivot'){
    const cols = [...new Set(rows.map(def.colOf))].sort();
    groups = groups.map(g => ({...g, count:g.rows.length, ...Object.fromEntries(cols.map(c => [`c:${c}`, g.rows.filter(r => def.colOf(r) === c).length]))}));
    return {...result, groups, columns:[...cols.map(c => ({key:`c:${c}`, label:c})), {key:'count', label:'Total'}], chart:'count',
      headline:{label:rptCount(rows.length, def)}};
  }
  groups = groups.map(g => ({...g, count:g.rows.length}));
  return {...result, groups, columns:[{key:'count', label:noun.charAt(0).toUpperCase() + noun.slice(1)}], chart:'count',
    headline:{label:rptCount(rows.length, def)}};
}
// What a report counts: "lead" / "leads", "deal", "activity", "task", "customer".
function rptNoun(def, n){
  const one = def.source === 'activities' ? (def.id === 'callsByRep' || def.id === 'callOutcomes' ? 'call' : def.id === 'meetingsByRep' ? 'meeting' : def.id === 'emailsSent' ? 'email' : 'activity')
    : def.source === 'tasks' ? 'task' : String(HUB_NOUN[def.source] || def.source).toLowerCase();
  return n === 1 ? one : one === 'activity' ? 'activities' : `${one}s`;
}
// Deals Created vs Goal: the goal period now running (Settings → Goals); each user's created deals against their target.
function rptGoal(def, hub, rows){
  const data = hub.data, g = goalsOf(data), period = g.period || 'monthly', [from, to] = goalPeriodRange(period);   // [start, end) in ms
  const inPeriod = rows.filter(r => r.createdAt && r.createdAt.getTime() >= from && r.createdAt.getTime() < to);
  const users = (data.users || []).filter(u => u.status === 'Activated' || !u.status);
  const target = (level, id) => typeof dealsGoalTarget === 'function' ? dealsGoalTarget(data, {level, id, period}) : null;
  let groups = users.map(u => { const mine = inPeriod.filter(r => r.owner === u.name), goal = target('user', u.id);
    return {key:u.id, label:u.name, rows:mine, count:mine.length, goal:goal == null ? null : Math.round(goal), value:goal ? Math.round(mine.length / goal * 1000) / 10 : null}; })
    .filter(x => x.count || x.goal);
  groups.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const company = target('company');
  return {rows:inPeriod, groups, columns:[{key:'count', label:'Created'}, {key:'goal', label:'Goal'}, {key:'value', label:'Reached', pct:true}], chart:'count', goalBars:true,
    headline:{label:`${inPeriod.length.toLocaleString('en-US')}${company ? ` of ${Math.round(company).toLocaleString('en-US')}` : ''}`,
      sub:`${goalPeriod(period).now}${company ? ` · ${Math.round(inPeriod.length / company * 100)}% of the company goal` : ' · no company goal set'}`}};
}

/* ── Export: the table as shown ─────────────────────────────────────────────────────────────── */

const rptCell = (c, v) => v == null || v === '' ? '' : c.money ? Number(v).toLocaleString('en-US', {maximumFractionDigits:2}) : c.pct ? `${v}%` : String(v);
// The CSV lines of what's shown: the groups, or (drilled in, or a list report) the records.
function rptLines(def, res, drill){
  if(drill || def.kind === 'list'){
    const cols = rptRecordColumns(def);
    return [cols.map(c => c.label), ...(drill ? drill.rows : res.rows).map(r => cols.map(c => rptCell(c, c.text ? c.text(r) : r[c.key])))];
  }
  return [[rptGroupLabel(def, res), ...res.columns.map(c => c.label)], ...res.groups.map(g => [g.label, ...res.columns.map(c => rptCell(c, g[c.key]))])];
}
const rptGroupLabel = (def, res) => def.kind === 'goal' ? 'Rep' : def.by === 'time' ? ({day:'Day', week:'Week', month:'Month'})[res.unit] : def.source === 'activities' || def.source === 'tasks' ? (def.id === 'actByType' ? 'Activity Type' : 'Rep')
  : ({leadsBySource:'Lead Source', leadsByStage:'Type of Lead', leadsByJobTitle:'Job Title', leadsAssigned:'Owner', leadsByStatus:'Lead Status', dealsOpenByStage:'Deal Stage',
      dealsLostReasons:'Lost Reason', dealsOpenByPipeline:'Deal Pipeline', leadsQuiet:'Last Activity', dealsQuiet:'Last Activity', customersQuiet:'Last Activity'})[def.id] || 'Owner';
// The columns of a report's records (drilled in, or a list report).
function rptRecordColumns(def){
  const src = def.source;
  if(src === 'activities' || src === 'tasks') return [{key:'name', label:src === 'tasks' ? 'Task' : 'Activity', width:240}, {key:'type', label:'Type', width:110}, {key:'rep', label:src === 'tasks' ? 'Assigned To' : 'Rep', width:170},
    {key:src === 'tasks' ? 'due' : 'date', label:src === 'tasks' ? 'Due Date' : 'Activity Date', width:150}, ...(def.id === 'callOutcomes' ? [{key:'outcome', label:'Outcome', width:150}] : []),
    {key:'recordName', label:'Record', width:200}, {key:'object', label:'Record Type', width:130}];
  const last = {key:'last', label:'Last Activity', width:150, text:(r) => r.lastAt ? rptDay(r.lastAt) : ''};
  if(src === 'contacts') return [{key:'name', label:'Full Name', width:220}, {key:'owner', label:`${HUB_NOUN.contacts} Owner`, width:180}, {key:'source', label:'Lead Source', width:140},
    {key:'stage', label:'Type of Lead', width:150}, {key:'status', label:'Lead Status', width:130}, {key:'created', label:'Created Date', width:140}, last];
  if(src === 'deals') return [{key:'name', label:'Deal Name', width:220}, {key:'owner', label:'Deal Owner', width:170}, {key:'pipeline', label:'Deal Pipeline', width:160}, {key:'stage', label:'Deal Stage', width:160},
    {key:'amount', label:`Deal Amount (${defaultCurrency()})`, width:170, money:true}, {key:'close', label:'Expected Close Date', width:170}, {key:'created', label:'Created Date', width:140},
    ...(def.id === 'dealsLostReasons' || def.id === 'dealsLostByRep' ? [{key:'lostReason', label:'Lost Reason', width:180}] : []), last];
  return [{key:'name', label:'Customer Name', width:220}, {key:'owner', label:'Customer Owner', width:180}, {key:'created', label:'Created Date', width:140}, last];
}

/* ── PDF: the report as a document (title, headline, chart, table) ─────────────────────────── */

function ReportDocument({def, res, drill, filtersText}){
  const lines = rptLines(def, res, drill);
  return (
    <div style={{padding:'32px 40px', fontFamily:"'DM Sans', sans-serif", color:'#15141B', background:'#fff', width:760}}>
      <div style={{fontSize:20, fontWeight:700}}>{def.name}{drill ? ` · ${drill.label}` : ''}</div>
      <div style={{fontSize:12, color:'#6B7280', marginTop:4}}>{fmtActStamp(new Date())}{filtersText ? ` · ${filtersText}` : ''}</div>
      {res.headline && <div style={{fontSize:26, fontWeight:700, marginTop:18}}>{res.headline.label}{res.headline.sub && <span style={{fontSize:13, fontWeight:400, color:'#6B7280', marginLeft:8}}>{res.headline.sub}</span>}</div>}
      {!drill && res.groups && <div style={{marginTop:18}}><ReportChart def={def} res={res} still/></div>}
      <table style={{width:'100%', borderCollapse:'collapse', marginTop:20, fontSize:11.5}}>
        <thead><tr>{lines[0].map((h, i) => <th key={i} style={{textAlign:i ? 'right' : 'left', padding:'6px 8px', borderBottom:'1px solid #D1D5DB', fontWeight:600}}>{h}</th>)}</tr></thead>
        <tbody>{lines.slice(1).map((l, i) => <tr key={i} className="pdf-keep">{l.map((v, j) => <td key={j} style={{textAlign:j ? 'right' : 'left', padding:'5px 8px', borderBottom:'1px solid #EEF0F3'}}>{v}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
async function reportPdfBlob(def, res, drill, filtersText){
  await loadFileScript(HTML2PDF_JS);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-1200px;top:0;width:840px;background:#fff';
  document.body.appendChild(host);
  const root = ReactDOM.createRoot(host);
  try {
    root.render(<ReportDocument def={def} res={res} drill={drill} filtersText={filtersText}/>);
    await new Promise(r => setTimeout(r, 250));
    return await window.html2pdf().set({margin:[24, 20, 24, 20], image:{type:'jpeg', quality:.92}, html2canvas:{scale:1.6, backgroundColor:'#ffffff'},
      jsPDF:{unit:'pt', format:'a4', orientation:'portrait'}, pagebreak:{mode:['css', 'legacy'], avoid:'.pdf-keep'}}).from(host.firstChild).outputPdf('blob');
  } finally { root.unmount(); host.remove(); }
}
const rptCsvText = (lines) => '﻿' + lines.map(l => l.map(v => { const t = String(v ?? ''); return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; }).join(',')).join('\r\n');
const rptFileName = (def, drill) => `${def.name}${drill ? ` - ${drill.label}` : ''}`.replace(/[\\/:*?"<>|]/g, '');
// The report as email attachments ({id, name, size, mime, dataUrl} — as the composer's own).
async function reportAttachments(def, res, drill, {csv, pdf}, filtersText){
  const out = [], name = rptFileName(def, drill), id = () => `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  if(csv){ const text = rptCsvText(rptLines(def, res, drill)), blob = new Blob([text], {type:'text/csv;charset=utf-8'});
    out.push({id:id(), name:`${name}.csv`, size:blob.size, mime:'text/csv', dataUrl:await blobDataUrl(blob)}); }
  if(pdf){ const blob = await reportPdfBlob(def, res, drill, filtersText); out.push({id:id(), name:`${name}.pdf`, size:blob.size, mime:'application/pdf', dataUrl:await blobDataUrl(blob)}); }
  return out;
}

/* ── The chart: bars per group (columns over time, rows otherwise) ────────────────────────── */

function ReportChart({def, res, still}){
  const key = res.chart || 'count', groups = res.groups || [];
  if(!groups.length) return null;
  const val = (g) => Number(g[key]) || 0, fmt = (g) => res.pct ? `${val(g)}%` : key === 'value' && !res.pct && def.kind === 'amount' ? moneyText(val(g), defaultCurrency()) : val(g).toLocaleString('en-US');
  const max = Math.max(1, ...groups.map(g => Math.max(val(g), def.kind === 'goal' ? (g.goal || 0) : 0)));
  if(def.by === 'time'){
    const shown = groups.slice(-24);
    return (
      <div role="img" aria-label={`${def.name} chart`} style={{display:'flex', alignItems:'flex-end', gap:6, height:180, padding:'8px 4px 0', borderBottom:`1px solid ${T.border}`, overflowX:still ? 'visible' : 'auto'}}>
        {shown.map(g => (
          <div key={g.key} title={`${g.label}: ${fmt(g)}`} style={{flex:'1 0 18px', maxWidth:56, display:'flex', flexDirection:'column', alignItems:'center', gap:4, height:'100%', justifyContent:'flex-end'}}>
            <span style={{fontSize:10.5, color:T.attioMuted}}>{fmt(g)}</span>
            <div style={{width:'100%', height:`${Math.max(2, val(g) / max * 130)}px`, background:T.attioText, borderRadius:'4px 4px 0 0'}}/>
            <span style={{fontSize:10, color:T.attioMuted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'100%'}}>{g.label.replace(/^Week of /, '')}</span>
          </div>
        ))}
      </div>
    );
  }
  const shown = groups.slice(0, 12);
  return (
    <div role="img" aria-label={`${def.name} chart`} style={{display:'flex', flexDirection:'column', gap:6}}>
      {shown.map(g => (
        <div key={g.key} title={`${g.label}: ${fmt(g)}`} style={{display:'grid', gridTemplateColumns:'minmax(0, 180px) minmax(0, 1fr) 90px', alignItems:'center', gap:10, fontSize:12}}>
          <span style={{color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{g.label}</span>
          <div style={{position:'relative', height:12, background:T.headerBg, borderRadius:4}}>
            {def.kind === 'goal' && g.goal ? <div style={{position:'absolute', inset:0, width:`${Math.min(100, g.goal / max * 100)}%`, border:`1px dashed ${T.gray400}`, borderRadius:4}}/> : null}
            <div style={{position:'absolute', top:0, bottom:0, left:0, width:`${Math.max(1, val(g) / max * 100)}%`, background:T.attioText, borderRadius:4}}/>
          </div>
          <span style={{textAlign:'right', color:T.attioMuted, fontVariantNumeric:'tabular-nums'}}>{fmt(g)}{def.kind === 'goal' && g.goal ? ` / ${g.goal}` : ''}</span>
        </div>
      ))}
      {groups.length > shown.length && <span style={{fontSize:11.5, color:T.attioMuted}}>{groups.length - shown.length} more in the table</span>}
    </div>
  );
}

/* ── Choosing a report: the landing page and the reports' window ──────────────────────────── */

// The reports shared with the signed-in person (by someone else's share naming them).
const reportSharesOf = (data) => (data && data.reportShares) || [];
function sharedWithMe(data){
  const me = (data.users || []).find(u => u.name === CURRENT_USER.name);
  if(!me) return [];
  return reportSharesOf(data).filter(s => s.by !== me.name && assignedUserIds(s.to, data).includes(me.id));
}
/* The existing report closest to a request's words ("deals lost by each sales rep" → Deals Lost by
   Rep), or null when nothing is close. Words are compared without plurals; a contact is a lead, a
   representative or salesperson a rep. A report scores by how many of the request's words it has,
   then by how few of its own words the request left out. */
const RPT_STOP = ['a', 'an', 'the', 'of', 'for', 'to', 'in', 'on', 'and', 'or', 'me', 'my', 'our', 'show', 'give', 'get', 'see', 'generate', 'create', 'make', 'report', 'each', 'every', 'all',
  'by', 'with', 'that', 'have', 'has', 'is', 'are', 'how', 'many', 'much', 'what', 'which', 'i', 'want', 'need', 'please', 'total', 'number', 'count', 'list', 'vs'];
const RPT_ALIAS = {contact:'lead', representative:'rep', salesperson:'rep', sale:'rep', agent:'rep', consultant:'rep', user:'rep', owner:'rep', won:'win', closed:'close', lost:'loss', lose:'loss',
  monthly:'month', weekly:'week', daily:'day', date:'day', unassigned:'assigned', target:'goal', revenue:'amount', value:'amount', inactive:'recent', stale:'recent', source:'source', reason:'reason',
  completed:'complete', completion:'complete', done:'complete', late:'overdue', conversion:'conversion', convert:'conversion', converted:'conversion', mail:'email', call:'call', meeting:'meeting'};
const rptWords = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean)
  .map(w => w.length > 3 && w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)
  .map(w => RPT_ALIAS[w] || w).filter(w => !RPT_STOP.includes(w));
function reportForRequest(text){
  const ask = [...new Set(rptWords(text))];
  if(!ask.length) return null;
  let best = null;
  REPORTS.forEach(r => {
    const own = [...new Set(rptWords(r.name))];
    const hit = ask.filter(w => own.includes(w)).length;
    if(!hit) return;
    const score = hit * 10 - (own.length - hit);
    if(!best || score > best.score) best = {r, score, hit};
  });
  // One shared word that every report of its kind has ("leads", "deals") isn't close enough.
  return best && (best.hit > 1 || ask.length === 1) ? best.r : null;
}
/* See Existing Reports / Open Report: every report by group, with a search; picking one opens it. */
function ReportPickerModal({onPick, onClose}){
  const hub = useRecordHub();
  const [query, setQuery] = React.useState('');
  const q = query.trim().toLowerCase();
  const groups = [...REPORT_GROUPS.map(g => ({id:g.id, label:g.label, items:REPORTS.filter(r => r.group === g.id).map(r => ({page:`reports.${r.id}`, name:r.name}))})),
    {id:'shared', label:'Shared with Me', items:sharedWithMe(hub.data).map(x => ({page:`reports.shared.${x.id}`, name:x.name, sub:`Shared by ${x.by}`}))}]
    .map(g => ({...g, items:g.items.filter(it => !q || it.name.toLowerCase().includes(q))})).filter(g => g.items.length);
  return ReactDOM.createPortal(
    <StModal title="Existing Reports" primary={null} onCancel={onClose} width={560}>
      <div style={{display:'flex', flexDirection:'column', gap:12}}>
        <div style={{display:'flex', alignItems:'center', gap:8, padding:'0 10px', height:36, borderRadius:8, border:`1px solid ${T.borderStrong}`, background:'#fff'}}>
          <Icon name="search" size={14} color={T.gray600}/>
          <input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search Reports" aria-label="Search reports"
            style={{flex:1, minWidth:0, border:'none', outline:'none', background:'transparent', fontSize:13, fontFamily:'inherit', color:T.attioText, padding:0}}/>
        </div>
        <div style={{maxHeight:'56vh', overflowY:'auto', margin:'0 -8px', padding:'0 8px', display:'flex', flexDirection:'column', gap:14}}>
          {groups.map(g => (
            <div key={g.id} style={{display:'flex', flexDirection:'column', gap:2}}>
              <span style={{...settingsSectionLabel, padding:'0 8px 4px'}}>{g.label}</span>
              {g.items.map(it => <ReportPickerRow key={it.page} item={it} onPick={()=>onPick(it.page)}/>)}
            </div>
          ))}
          {!groups.length && <div style={{fontSize:13, color:T.attioMuted, padding:'8px'}}>No reports match</div>}
        </div>
      </div>
    </StModal>, document.body);
}
function ReportPickerRow({item, onPick}){
  const [h, setH] = React.useState(false);
  return (
    <button type="button" onClick={onPick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{display:'flex', alignItems:'center', gap:10, width:'100%', textAlign:'left', border:'none', borderRadius:6, padding:'8px', cursor:'pointer', fontFamily:'inherit',
        fontSize:13, color:T.attioText, background: h ? T.headerBg : 'transparent'}}>
      <span style={{flex:1, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{item.name}</span>
      {item.sub && <span style={{fontSize:12, color:T.attioMuted, flexShrink:0}}>{item.sub}</span>}
    </button>
  );
}
/* Reports' landing page: Ask Spring for a report, or see the existing ones. */
function ReportsHome({navigate}){
  const hub = useRecordHub();
  const [picking, setPicking] = React.useState(false);
  const [missed, setMissed] = React.useState('');
  const ask = (text) => {
    const r = reportForRequest(text);
    if(!r) return setMissed(text);
    setMissed(''); hub.toast(`Spring opened ${r.name}`); navigate(`reports.${r.id}`);
  };
  return (
    <div style={{flex:1, minWidth:0, minHeight:0, overflowY:'auto', background:T.pageBg}}>
      <div style={{maxWidth:760, margin:'0 auto', padding:'72px 24px 40px', display:'flex', flexDirection:'column', gap:20}}>
        <span style={{fontSize:22, fontWeight:600, color:T.attioText, textAlign:'center'}}>Reports</span>
        <SpringAsk onAsk={ask} placeholder="Ask Spring to generate reports"/>
        {missed && <div role="status" style={{fontSize:13, color:T.attioText, textAlign:'center'}}>Spring couldn't find a report for "{missed.length > 80 ? missed.slice(0, 77) + '…' : missed}".</div>}
        <div style={{display:'flex', justifyContent:'center'}}><StSecondary label="See Existing Reports" onClick={()=>setPicking(true)}/></div>
      </div>
      {picking && <ReportPickerModal onPick={(page)=>{ setPicking(false); navigate(page); }} onClose={()=>setPicking(false)}/>}
    </div>
  );
}

/* ── A report's page ──────────────────────────────────────────────────────────────────────── */

const rptFiltersText = (filters, props) => (filters && filters.nodes || []).filter(n => n.prop && n.op).map(n => {
  const p = props.find(x => x.key === n.prop); const v = n.values ? n.values.join(', ') : [n.value, n.value2].filter(Boolean).join(' – ');
  return p ? `${p.label} ${n.op.replace(/([A-Z])/g, ' $1').toLowerCase()} ${v}`.trim() : ''; }).filter(Boolean).join('; ');
function ReportPage({pageId, navigate}){
  const hub = useRecordHub(), engineCtx = useWorkflowEngineCtx(), logExport = useRecordExportLog();
  const shareId = pageId.startsWith('reports.shared.') ? pageId.slice('reports.shared.'.length) : null;
  const share = shareId ? reportSharesOf(hub.data).find(s => s.id === shareId) : null;
  const def = reportById(share ? share.reportId : pageId.replace(/^reports\./, '')) || REPORTS[0];
  const [search, setSearch] = React.useState(share ? share.search || '' : '');
  const [filters, setFilters] = React.useState(() => share && share.filters ? share.filters : EMPTY_FILTERS());
  const [unit, setUnit] = React.useState(share && share.unit || def.unit || 'month');
  const [drillKey, setDrillKey] = React.useState(null);
  const [sending, setSending] = React.useState(false);
  const [sharing, setSharing] = React.useState(false);
  const [picking, setPicking] = React.useState(false);
  const [pdfBusy, setPdfBusy] = React.useState(false);
  React.useEffect(() => { setSearch(share ? share.search || '' : ''); setFilters(share && share.filters ? share.filters : EMPTY_FILTERS()); setUnit(share && share.unit || def.unit || 'month'); setDrillKey(null); }, [pageId]);
  const res = React.useMemo(() => runReport(def, hub, {search, filters, unit}), [def, hub.records, hub.activities, hub.data, search, filters, unit]);
  const drill = drillKey != null && res.groups ? res.groups.find(g => g.key === drillKey) || null : null;
  const filtersText = rptFiltersText(filters, res.filterProps);
  const exportCsv = () => {
    downloadCsv(rptLines(def, res, drill), rptFileName(def, drill));
    const object = rptSourceObject(def.source);
    if(object) logExport(object, (drill ? drill.rows : res.rows).length, `Reports → ${def.name}`);
    hub.toast('Report exported');
  };
  const downloadPdf = async () => {
    if(pdfBusy) return;
    setPdfBusy(true);
    try {
      const blob = await reportPdfBlob(def, res, drill, filtersText);
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${rptFileName(def, drill)}.pdf`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      hub.toast('Report downloaded');
    } catch(e){ hub.toast("The PDF couldn't be made"); }
    setPdfBusy(false);
  };
  const controls = (
    <div style={{display:'flex', alignItems:'center', gap:8}}>
      {def.by === 'time' && !drill && <div style={{width:110}}><Dropdown value={res.unit} options={RPT_TIME_UNITS} onChange={(v)=>v && setUnit(v)} ariaLabel="Group by"/></div>}
      <button onClick={downloadPdf} disabled={pdfBusy} style={{...toolbarButton, ...(pdfBusy ? {cursor:'default', color:T.gray600} : {})}}>
        {pdfBusy ? <Spinner size={13} color={T.gray600}/> : <Icon name="files" size={13} color={T.gray600}/>} Download PDF</button>
      <button onClick={exportCsv} style={toolbarButton}><Icon name="export" size={13} color={T.gray600}/> Export CSV</button>
      <button onClick={()=>setSending(true)} style={toolbarButton}><Icon name="envelope" size={13} color={T.gray600}/> Send</button>
      <button onClick={()=>setSharing(true)} style={toolbarButton}><Icon name="usersThree" size={13} color={T.gray600}/> Share</button>
    </div>
  );
  const shareTo = (to) => {
    const ids = assignedUserIds(to, hub.data).filter(id => ((hub.data.users || []).find(u => u.id === id) || {}).name !== CURRENT_USER.name);
    if(!ids.length) return setSharing(false);
    const entry = {id:`rs-${Date.now().toString(36)}`, reportId:def.id, name:def.name, search, filters, unit, to, by:CURRENT_USER.name, at:new Date().toISOString()};
    hub.setData(d => ({...d, reportShares:[entry, ...reportSharesOf(d)]}));
    if(engineCtx && engineCtx.api && engineCtx.api.notifyUsers) engineCtx.api.notifyUsers(ids, def.name, `${CURRENT_USER.name} shared the report ${def.name} with you.`, null, null, 'reportShared');
    setSharing(false); hub.toast(`Shared with ${bulkPlural(ids.length, 'person', 'people')}`);
  };
  return (
    <div style={{flex:1, minWidth:0, minHeight:0, display:'flex', flexDirection:'column', background:'#fff'}}>
      <RecordSchema.Provider value={{properties:[], filterProps:res.filterProps, selectValues:res.selectValues, noun:'record', associated:false, boards:false, selectable:false}}>
        <div style={{padding:'16px 24px 0', display:'flex', alignItems:'center', gap:10}}>
          <button type="button" onClick={()=>navigate('reports')} title="Back to Reports" aria-label="Back to Reports"
            style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:4, flexShrink:0}}><Icon name="arrowLeft" size={15} color={T.gray600}/></button>
          <span style={{fontSize:18, fontWeight:600, color:T.attioText, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{def.name}</span>
          {share && <span style={{fontSize:12.5, color:T.attioMuted, whiteSpace:'nowrap'}}>Shared by {share.by} · {fmtActStamp(new Date(share.at))}</span>}
          <div style={{flex:1}}/>
          <button type="button" onClick={()=>setPicking(true)} style={{...toolbarButton, flexShrink:0}}><Icon name="plus" size={13} color={T.gray600}/> Open Report</button>
        </div>
        <RecordToolbar inset="page" views={[]} oneRow searchInRow searchPlaceholder={`Search ${rptNoun(def, 2).replace(/^./, c => c.toUpperCase())}`}
          search={search} onSearch={setSearch} filters={filters} setFilters={(f)=>setFilters(typeof f === 'function' ? f(filters) : f)}
          appliedFilterCount={countAppliedFilters(filters, res.filterProps)} controls={controls}/>
      </RecordSchema.Provider>
      <div style={{flex:1, minHeight:0, overflowY:'auto', padding:'16px 24px 24px', display:'flex', flexDirection:'column', gap:18}}>
        {drill ? (
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <button type="button" onClick={()=>setDrillKey(null)} className={LINK_CLASS}
              style={{display:'inline-flex', alignItems:'center', gap:6, border:'none', background:'transparent', padding:0, cursor:'pointer', fontFamily:'inherit', fontSize:13, color:T.attioText}}>
              <Icon name="arrowLeft" size={13} color={T.attioText}/>{def.name}</button>
            <span style={{fontSize:13, color:T.attioMuted}}>/ {drill.label} · {rptCount(drill.rows.length, def)}</span>
          </div>
        ) : res.headline && (
          <div style={{display:'flex', alignItems:'baseline', gap:10, flexWrap:'wrap'}}>
            <span style={{fontSize:28, fontWeight:700, color:T.attioText, fontVariantNumeric:'tabular-nums'}}>{res.headline.label}</span>
            {res.headline.sub && <span style={{fontSize:13, color:T.attioMuted}}>{res.headline.sub}</span>}
          </div>
        )}
        {!drill && res.groups && res.groups.length > 0 && <ReportChart def={def} res={res}/>}
        {drill || def.kind === 'list' ? <ReportRecordsTable def={def} rows={drill ? drill.rows : res.rows}/>
          : res.groups.length ? <ReportGroupsTable def={def} res={res} onDrill={(g)=>setDrillKey(g.key)}/>
          : <EmptyState title="Nothing to report yet"/>}
      </div>
      {sending && <SendReportModal def={def} res={res} drill={drill} filtersText={filtersText} onClose={()=>setSending(false)}/>}
      {picking && <ReportPickerModal onPick={(page)=>{ setPicking(false); navigate(page); }} onClose={()=>setPicking(false)}/>}
      {sharing && <AssignPeopleModal title="Share Report" data={hub.data} onCancel={()=>setSharing(false)} onSave={shareTo}/>}
    </div>
  );
}

// The grouped table: a group's name opens the records behind it.
function ReportGroupsTable({def, res, onDrill}){
  const cols = [{key:'name', label:rptGroupLabel(def, res), width:260}, ...res.columns.map(c => ({key:c.key, label:c.label, width:150}))];
  const rows = res.groups.map(g => ({...g, id:g.key, name:g.label}));
  const [columnOrder, setColumnOrder] = React.useState(() => cols.map(c => c.key));
  const [columnWidths, setColumnWidths] = React.useState({});
  const [sort, setSort] = React.useState(null);
  React.useEffect(() => setColumnOrder(cols.map(c => c.key)), [def.id, cols.length]);
  const schema = {properties:cols, noun:'row', searchKeys:['name'], selectable:false, boards:false, canCreateProperty:false, noActions:true, fillWidth:true, paginate:rows.length > 50,
    renderCell:(key, r) => { const c = res.columns.find(x => x.key === key); return c ? <span style={{fontVariantNumeric:'tabular-nums'}}>{rptCell(c, r[key]) || '—'}</span> : undefined; }};
  return (
    <RecordSchema.Provider value={schema}>
      <div style={{border:`1px solid ${T.border}`, borderRadius:8, overflow:'hidden', display:'flex', flexDirection:'column', minHeight:120}}>
        <ContactsDataGrid rows={sort ? rows : rows} columnOrder={columnOrder.filter(k => cols.some(c => c.key === k))} setColumnOrder={setColumnOrder} columnWidths={columnWidths} setColumnWidths={setColumnWidths}
          sort={sort} setSort={setSort} search="" frozenLeft={0} frozenRight={0} actionsFrozen={false} rowsPerPage={50} onOpenContact={(r)=>onDrill(r)}/>
      </div>
    </RecordSchema.Provider>
  );
}
// The records behind a number (or a list report): a record's name opens it.
function ReportRecordsTable({def, rows}){
  const hub = useRecordHub();
  const cols = rptRecordColumns(def);
  const [columnOrder, setColumnOrder] = React.useState(() => cols.map(c => c.key));
  const [columnWidths, setColumnWidths] = React.useState({});
  const [sort, setSort] = React.useState(null);
  const shown = rows.map(r => ({...r, ...(r._act ? {_open:{object:r._act.object, id:r._act.record.id}} : {_open:{object:r._rec.object, id:r._rec.record.id}})}));
  const schema = {properties:cols, noun:rptNoun(def, 1), nounPlural:rptNoun(def, 2), searchKeys:['name'], selectable:false, boards:false, canCreateProperty:false, noActions:true,
    renderCell:(key, r) => { const c = cols.find(x => x.key === key);
      if(key === 'recordName') return <ContactName name={r.recordName} onOpen={()=>hub.openRecord(r._open.object, r._open.id)} style={{fontSize:'inherit', fontWeight:400}}/>;
      if(c && (c.text || c.money)) return <span>{rptCell(c, c.text ? c.text(r) : r[key]) || '—'}</span>; return undefined; }};
  return (
    <RecordSchema.Provider value={schema}>
      <div style={{border:`1px solid ${T.border}`, borderRadius:8, overflow:'hidden', display:'flex', flexDirection:'column', minHeight:200, flex:1}}>
        {shown.length ? <ContactsDataGrid rows={shown} columnOrder={columnOrder} setColumnOrder={setColumnOrder} columnWidths={columnWidths} setColumnWidths={setColumnWidths}
          sort={sort} setSort={setSort} search="" frozenLeft={0} frozenRight={0} actionsFrozen={false} rowsPerPage={25}
          onOpenContact={(r)=>hub.openRecord(r._open.object, r._open.id)}/> : <EmptyState title={`No ${rptNoun(def, 2)} to show`}/>}
      </div>
    </RecordSchema.Provider>
  );
}

/* Send: to any email addresses, the report attached as CSV and / or PDF; kept in `reportSends`. */
function SendReportModal({def, res, drill, filtersText, onClose}){
  const hub = useRecordHub();
  const [to, setTo] = React.useState('');
  const [subject, setSubject] = React.useState(`Report: ${def.name}${drill ? ` · ${drill.label}` : ''}`);
  const [message, setMessage] = React.useState('');
  const [fmt, setFmt] = React.useState({csv:true, pdf:true});
  const [busy, setBusy] = React.useState(false);
  const addresses = to.split(/[,;\s]+/).map(x => x.trim()).filter(Boolean);
  const ok = addresses.length > 0 && addresses.every(a => EMAIL_ADDRESS.test(a)) && !!subject.trim() && (fmt.csv || fmt.pdf);
  const send = async () => {
    if(!ok || busy) return;
    setBusy(true);
    try {
      const files = await reportAttachments(def, res, drill, fmt, filtersText);
      const entry = {id:`rsend-${Date.now().toString(36)}`, reportId:def.id, to:addresses, subject:subject.trim(), message:message.trim(),
        attachments:files.map(f => ({name:f.name, size:f.size, mime:f.mime})), by:CURRENT_USER.name, at:new Date().toISOString()};
      hub.setData(d => ({...d, reportSends:[entry, ...((d.reportSends) || [])].slice(0, 200)}));
      hub.toast(`Report sent to ${bulkPlural(addresses.length, 'address', 'addresses')}`);
      onClose();
    } catch(e){ hub.toast("The report couldn't be attached"); setBusy(false); }
  };
  return ReactDOM.createPortal(
    <StModal title="Send Report" primary="Send" busy={busy} canSubmit={ok && !busy} onCancel={onClose} onSubmit={send} width={520}>
      <div style={{display:'flex', flexDirection:'column', gap:12}}>
        <div><label style={fieldLabel}>To<Req/></label><input autoFocus value={to} onChange={e=>setTo(e.target.value)} placeholder="name@company.com, …" style={fieldInput}/></div>
        <div><label style={fieldLabel}>Subject<Req/></label><input value={subject} onChange={e=>setSubject(e.target.value)} style={fieldInput}/></div>
        <div><label style={fieldLabel}>Message</label><textarea value={message} onChange={e=>setMessage(e.target.value)} rows={4} style={{...fieldInput, resize:'vertical', lineHeight:1.5}}/></div>
        <div style={{display:'flex', gap:16}}>
          <SettingsCheckRow label="CSV" checked={fmt.csv} onToggle={()=>setFmt(f => ({...f, csv:!f.csv}))}/>
          <SettingsCheckRow label="PDF" checked={fmt.pdf} onToggle={()=>setFmt(f => ({...f, pdf:!f.pdf}))}/>
        </div>
      </div>
    </StModal>, document.body);
}

/* Attach Report (the email composer's attachments): a report, as CSV and / or PDF, counted for the sender. */
function ReportAttachModal({onAttach, onClose}){
  const hub = useRecordHub();
  const [reportId, setReportId] = React.useState(REPORTS[0].id);
  const [fmt, setFmt] = React.useState({csv:true, pdf:false});
  const [busy, setBusy] = React.useState(false);
  const options = REPORTS.map(r => ({value:r.id, label:r.name, sub:(REPORT_GROUPS.find(g => g.id === r.group) || {}).label}));
  const attach = async () => {
    const def = reportById(reportId); if(!def || busy || !(fmt.csv || fmt.pdf)) return;
    setBusy(true);
    try { onAttach(await reportAttachments(def, runReport(def, hub), null, fmt, '')); onClose(); }
    catch(e){ hub.toast("The report couldn't be attached"); setBusy(false); }
  };
  return ReactDOM.createPortal(
    <StModal title="Attach Report" primary="Attach" busy={busy} canSubmit={!busy && (fmt.csv || fmt.pdf)} onCancel={onClose} onSubmit={attach} width={480}>
      <div style={{display:'flex', flexDirection:'column', gap:12}}>
        <div><label style={fieldLabel}>Report<Req/></label><Dropdown value={reportId} options={options} searchable onChange={(v)=>v && setReportId(v)} ariaLabel="Report"/></div>
        <div style={{display:'flex', gap:16}}>
          <SettingsCheckRow label="CSV" checked={fmt.csv} onToggle={()=>setFmt(f => ({...f, csv:!f.csv}))}/>
          <SettingsCheckRow label="PDF" checked={fmt.pdf} onToggle={()=>setFmt(f => ({...f, pdf:!f.pdf}))}/>
        </div>
      </div>
    </StModal>, document.body);
}

Object.assign(window, {REPORTS, REPORT_GROUPS, isReportsPage, runReport, reportForRequest, ReportsHome, ReportPage, ReportAttachModal, reportAttachments});
