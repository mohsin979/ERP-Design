/* HOF Pulse ERP — My Day (defined 2026-11-20, Mohsin): the dashboard's Personal widget for one
   sales professional — what to do today, from their own leads, deals and tasks. Three tabs, each
   with its count:

     To Contact  — their leads not contacted yet (no connected call, sent email or meeting — the
                   Last Contacted rule, activities.jsx isRealTouch — and no deal or customer), in
                   Spring's order: whom to contact first. Spring learns the ideal customer from the
                   leads that became customers (springProfile: a country, lead source, job title or
                   industry that converts clearly better than average) and ranks each lead by how
                   much of it they share — Strong fit (two or more), Good fit (one), then the rest,
                   newest first; a lead whose form came in incomplete (leadFormIncomplete) goes
                   under them. One quiet line says why ("Strong fit · UAE, Operations Manager",
                   "Form incomplete"). Last, under "Not answered": leads called twice or more with
                   no answer — the lowest priority.
     Follow-ups  — their tasks due today, then the overdue ones (latest first), then Spring's reminders: a contacted lead or
                   an open deal of theirs with nothing since for 3 days or more (up to 30 — older
                   isn't today's work) and no open task. A reminder has Call and Add Task (a task
                   "Follow up with …", due today — then it's a task, not a reminder).
     Contacted   — every contacted lead and open deal they own, latest contact first; a person
                   shows once — as their deal when they have one, else as the lead.

   A row: the person's avatar, the name (opens the record), one quiet line — in Contacted, what last
   happened and when, with the stage (a deal's amount under it) on the right — and its round
   actions (Call; a reminder's Add Task). Ten at a time, with a search and the pager once a list is
   longer (dashboard.jsx useDashList). Two columns wide, beside the Time Clock.
   Type of Lead follows reach (app.jsx, as it follows the owner): a lead's first contact moves it
   from Assigned or Not Responded to Contacted; two unanswered calls with no contact yet move it
   from Assigned to Not Responded (leadStageByReach) — from then on, not for what's already there.
   On the dashboard My Day stands in for My Tasks: showing one hides the other (dashboard.jsx
   DASH_ALTERNATES); a Personal-only dashboard shows My Day to start with.

   Later the same day (Mohsin's answers to the stakeholder's concept and the sales team's feedback):
   My Day is also the employee's first page (MyDayPage — nav.jsx, dashboard.jsx): the day's numbers
   against the Daily Activity targets, the Time Clock, these three tabs, Commission, Meetings Today
   and Payments Due. Follow-ups gained Spring's signals (quote opened, replied, passed on, quote not
   answered), and a row its Brief with a drafted email — both mocked from the record's own values:
   Spring is not a model yet.
   Second pass: Call Next Lead beside the greeting (MyDayCallNext), the numbers and widgets chosen in
   the page's own Layout Settings (myDayConfig), Today — the daily calendar (MyDayCalendar) — and No
   Response (myDayNoResponse); each widget has its coloured mark (MYDAY_ICONS). */

const MYDAY_TRIES = 2, MYDAY_QUIET_DAYS = 3, MYDAY_STALE_DAYS = 30, MYDAY_DAY = 86400000;
const MYDAY_UNANSWERED = /no answer|voicemail|disconnected/i;
const MYDAY_SIGNAL_DAYS = 7, MYDAY_REPLY_DAYS = 3;   // a signal's window; a reply is fresh for three days
const leadTries = (acts) => (acts || []).filter(a => a.type === 'call' && MYDAY_UNANSWERED.test(a.outcome || '')).length;
/* The Type of Lead a lead's reach gives it, or null to leave it: contacted → Contacted (from
   Assigned or Not Responded); never contacted and called twice or more with no answer → Not
   Responded (from Assigned). */
function leadStageByReach(lead, acts){
  if(!lead || !lead.owner) return null;
  if(latestTouch(acts)) return ['Assigned', 'Not Responded'].includes(lead.contactType) ? 'Contacted' : null;
  return lead.contactType === 'Assigned' && leadTries(acts) >= MYDAY_TRIES ? 'Not Responded' : null;
}

/* ── Spring: the ideal customer, learned from the leads that became customers ─────────────── */

const SPRING_TRAITS = [{key:'country', of:(l) => l.country}, {key:'source', of:(l) => l.source}, {key:'jobTitle', of:(l) => l.jobTitle}, {key:'industry', of:(l) => l.industry}];
// {traits:{<key>: Map(value → how much better than average it converts)}} — a value counts once 5 leads have it and 2 became customers.
function springProfile(leads, customers){
  const won = new Set((customers || []).flatMap(c => contactIdsOf(c).map(String)));
  const all = leads || [], base = all.length ? all.filter(l => won.has(String(l.id))).length / all.length : 0;
  const traits = {};
  SPRING_TRAITS.forEach(t => {
    const seen = new Map();
    all.forEach(l => { const v = String(t.of(l) || '').trim(); if(!v) return; const e = seen.get(v) || {n:0, won:0}; e.n++; if(won.has(String(l.id))) e.won++; seen.set(v, e); });
    traits[t.key] = new Map([...seen].filter(([, e]) => base > 0 && e.n >= 5 && e.won >= 2 && e.won / e.n >= base * 1.25).map(([v, e]) => [v, e.won / e.n / base]));
  });
  return {traits};
}
// A lead against the profile: {level:'strong' | 'good' | null, score, why:[the values that fit, strongest first]}.
function springFit(profile, lead){
  const hits = SPRING_TRAITS.map(t => { const v = String(t.of(lead) || '').trim(), lift = profile.traits[t.key].get(v); return lift ? {v, lift} : null; }).filter(Boolean).sort((a, b) => b.lift - a.lift);
  return {level: hits.length >= 2 ? 'strong' : hits.length === 1 ? 'good' : null, score:hits.reduce((s, h) => s + h.lift, 0), why:hits.slice(0, 2).map(h => h.v)};
}
/* A lead whose form came in incomplete: its submission left a question unanswered — or, from a form
   with no submission kept (the sample leads), it has no email or no phone number. */
function leadFormIncomplete(lead){
  const s = typeof recordFormSubmission === 'function' ? recordFormSubmission(lead) : null;
  if(s && s.form && (s.form.fields || []).length) return s.form.fields.some(f => { const v = (s.submission.answers || {})[f.id]; return v == null || v === '' || (Array.isArray(v) && !v.length); });
  return /form/i.test(lead.source || '') && (!String(lead.email || '').trim() || !String(lead.phone || '').trim());
}

/* Sample leads for the sample CRM (app.jsx, once — `mockMyDayLeads`): new leads nobody has contacted
   yet, for the three test personas — some a clear fit, some with the form's phone number missing,
   two each already called twice with no answer — and, for Mustafa (the Employee), leads reached a
   few days ago and two with a task due today. [{owner, daysAgo, tries, touchDaysAgo?, task?, values}] */
function myDaySampleLeads(){
  const people = [
    ['Yusuf Rahman', 'Pakistan', 'Lahore', 'Senior Software Engineer', 'Technology'], ['Maryam Siddiqi', 'Saudi Arabia', 'Riyadh', 'Dentist', 'Healthcare'],
    ['Tunde Bakare', 'Nigeria', 'Lagos', 'DevOps Engineer', 'Technology'], ['Layla Haddad', 'United Arab Emirates', 'Dubai', 'Marketing Executive', 'Retail'],
    ['Imran Qadir', 'Pakistan', 'Karachi', 'Accountant', 'Finance'], ['Noor Fatima', 'India', 'Hyderabad', 'Project Engineer', 'Construction'],
    ['Chidi Okafor', 'Nigeria', 'Abuja', 'Sales Manager', 'Retail'], ['Sana Mirza', 'United Arab Emirates', 'Sharjah', 'Teacher', 'Education'],
    ['Faris Al-Amin', 'Saudi Arabia', 'Jeddah', 'Senior Software Engineer', 'Technology'], ['Hina Baig', 'Pakistan', 'Islamabad', 'Medical Researcher', 'Healthcare'],
    ['Daniyal Sheikh', 'Pakistan', 'Lahore', 'DevOps Engineer', 'Technology'], ['Amara Nwosu', 'Nigeria', 'Lagos', 'Dentist', 'Healthcare'],
    ['Rashid Al-Farsi', 'United Arab Emirates', 'Abu Dhabi', 'Operations Manager', 'Logistics'], ['Zoya Kazmi', 'Pakistan', 'Karachi', 'Graphic Designer', 'Media'],
    ['Kareem Mansour', 'Saudi Arabia', 'Dammam', 'Project Engineer', 'Construction'], ['Priya Menon', 'India', 'Kochi', 'Nurse', 'Healthcare'],
    ['Bashir Lawal', 'Nigeria', 'Kano', 'Accountant', 'Finance'], ['Mehwish Tariq', 'Pakistan', 'Faisalabad', 'Senior Software Engineer', 'Technology'],
    ['Omar Bakr', 'Saudi Arabia', 'Riyadh', 'Sales Manager', 'Retail'], ['Anjali Rao', 'India', 'Pune', 'Medical Researcher', 'Healthcare'],
    ['Salman Javed', 'Pakistan', 'Multan', 'Teacher', 'Education'], ['Ngozi Eze', 'Nigeria', 'Enugu', 'DevOps Engineer', 'Technology'],
    ['Hamdan Al-Suwaidi', 'United Arab Emirates', 'Dubai', 'Dentist', 'Healthcare'], ['Rabia Anwar', 'Pakistan', 'Lahore', 'Operations Manager', 'Logistics'],
  ];
  const owners = ['mustafa', 'ali-noor', 'waleed-bin-zaman'], per = people.length / owners.length;
  const values = ([name, country, city, jobTitle, industry], i, noPhone) => ({name, email:`${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
    phone: noPhone ? '' : `+92 3${String(10 + i).padStart(2, '0')} ${String(5550100 + i * 37)}`, country, city, jobTitle, industry, source:'Meta Form', leadStatus:'New'});
  const fresh = people.map((p, i) => { const k = i % per;
    return {owner:owners[Math.floor(i / per)], daysAgo: k % 4, tries: k >= per - 2 ? 2 + (k % 2) : 0, values:values(p, i, k === 3 || k === 5)}; });
  /* Mustafa's follow-ups: leads he reached some days ago and left since (`touchDaysAgo` — a connected
     call then; Spring's reminders), and two reached yesterday with a task due today (`task`). */
  const reached = [
    [['Adeel Farooqi', 'Pakistan', 'Lahore', 'Senior Software Engineer', 'Technology'], 3], [['Khadija Noor', 'Saudi Arabia', 'Riyadh', 'Dentist', 'Healthcare'], 4],
    [['Emeka Obi', 'Nigeria', 'Lagos', 'DevOps Engineer', 'Technology'], 6], [['Shazia Malik', 'Pakistan', 'Karachi', 'Project Engineer', 'Construction'], 9],
    [['Tariq Al-Hashimi', 'United Arab Emirates', 'Dubai', 'Medical Researcher', 'Healthcare'], 1, 'Send the document checklist'],
    [['Farah Qureshi', 'Pakistan', 'Islamabad', 'Accountant', 'Finance'], 1, 'Call back about the fee plan'],
  ].map(([p, touchDaysAgo, task], i) => ({owner:'mustafa', daysAgo:touchDaysAgo + 2, tries:0, touchDaysAgo, task:task || null, values:{...values(p, people.length + i), leadStatus:'Contacted'}}));
  return [...fresh, ...reached];
}

/* ── The day: the three lists for one person ──────────────────────────────────────────────── */

const myDayDate = (d) => d ? new Date(d).toLocaleDateString('en-US', {month:'short', day:'numeric'}) : '';
const myDayLast = (acts) => { const now = Date.now(); let last = 0;
  (acts || []).forEach(a => { if(!['call', 'email', 'meeting', 'task', 'note'].includes(a.type)) return; const t = new Date(a.at).getTime(); if(t && t <= now && t > last) last = t; }); return last || null; };
function myDayLists(hub, me){
  const R = hub.records, A = hub.activities || {};
  const actsOf = (object, id) => (A[object] || {})[id] || [];
  const mine = (r) => !!me && r.owner === me.id;
  const leads = (R.contacts || []).filter(mine), deals = (R.deals || []).filter(mine);
  const linked = (list, lead) => (list || []).some(x => contactIdsOf(x).some(i => sameId(i, lead.id)));
  const stageOf = (d) => stageLabelOf(hub.data, d.pipeline, d.stage) || '';
  const openDeal = (d) => { const t = recordStageType('deals', d); return !t || t === 'open'; };
  const now = Date.now(), days = (t) => Math.floor((now - t) / MYDAY_DAY);
  const hasOpenTask = (acts) => acts.some(a => a.type === 'task' && isTaskOpen(a));

  // To Contact
  const profile = springProfile(R.contacts, R.customers);
  const fresh = [], unanswered = [], reached = [];
  leads.forEach(l => {
    const acts = actsOf('contacts', l.id), touch = latestTouch(acts);
    if(touch || linked(R.deals, l) || linked(R.customers, l)) return reached.push({lead:l, acts, touch});
    const tries = leadTries(acts), created = new Date(l.createdAt || l.created).getTime() || 0;
    if(tries >= MYDAY_TRIES) return unanswered.push({key:`l${l.id}`, object:'contacts', record:l, group:'unanswered', sub:`${tries} tries`, created,
      lastTry:Math.max(0, ...acts.filter(a => a.type === 'call').map(a => new Date(a.at).getTime() || 0))});
    const incomplete = leadFormIncomplete(l), fit = springFit(profile, l);
    fresh.push({key:`l${l.id}`, object:'contacts', record:l, created, score:fit.score, rank: incomplete ? 3 : fit.level === 'strong' ? 0 : fit.level === 'good' ? 1 : 2,
      fit: incomplete ? null : fit.level, lead: incomplete || !fit.level ? '' : fit.level === 'strong' ? 'Strong fit' : 'Good fit', sub: incomplete ? 'Form incomplete' : fit.why.join(', ')});
  });
  fresh.sort((a, b) => a.rank - b.rank || b.score - a.score || b.created - a.created);
  unanswered.sort((a, b) => a.lastTry - b.lastTry);
  const toContact = [...fresh.map((x, i) => ({...x, order:i + 1})), ...unanswered];

  // Contacted: my open deals, then my contacted leads that none of those deals stands for.
  // What last happened with them: the last contact (a connected call, an email sent, a meeting), else their last activity.
  const happened = (acts, touch) => { if(touch) return touch.type === 'call' ? (touch.outcome === CALL_BACK_OUTCOME ? 'Call back requested' : 'Call connected') : touch.type === 'email' ? 'Email sent' : 'Meeting';
    const last = (acts || []).filter(a => ['call', 'email', 'meeting', 'task', 'note'].includes(a.type) && new Date(a.at).getTime() <= now).sort((a, b) => new Date(b.at) - new Date(a.at))[0];
    return last ? (ACTIVITY_TYPES[last.type] || {}).label || '' : ''; };
  const dealRows = deals.filter(openDeal).map(d => { const acts = actsOf('deals', d.id), touch = latestTouch(acts);
    return {key:`d${d.id}`, object:'deals', record:d, acts, touch, at:(touch && new Date(touch.at).getTime()) || myDayLast(acts) || new Date(d.createdAt || d.created).getTime() || 0,
      stage:stageOf(d), amount:d.amount ? moneyText(d.amount, d.currency) : ''}; });
  const leadRows = reached.filter(x => !dealRows.some(d => contactIdsOf(d.record).some(i => sameId(i, x.lead.id))))
    .map(x => ({key:`l${x.lead.id}`, object:'contacts', record:x.lead, acts:x.acts, touch:x.touch, at:(x.touch && new Date(x.touch.at).getTime()) || myDayLast(x.acts) || 0, stage:x.lead.contactType || '', amount:''}));
  const contacted = [...dealRows, ...leadRows].sort((a, b) => b.at - a.at)
    .map(x => ({...x, sub:[happened(x.acts, x.touch), x.at ? myDayDate(x.at) : ''].filter(Boolean).join(' · ')}));

  // Follow-ups: my tasks due by the end of today, then Spring's reminders.
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
  const tasks = hubActivities(hub, 'task').filter(e => e.act.assignee === me.name && isTaskOpen(e.act) && e.act.due && new Date(e.act.due) <= endOfToday)
    // Today's first, then the overdue ones — the latest first.
    .sort((x, y) => (isOverdue(x.act) - isOverdue(y.act)) || (isOverdue(x.act) ? new Date(y.act.due) - new Date(x.act.due) : new Date(x.act.due) - new Date(y.act.due)))
    .map(e => ({key:`t${e.act.id}`, kind:'task', entry:e, name:e.act.title || 'Task', overdue:isOverdue(e.act),
      lead:isOverdue(e.act) ? `Overdue · ${myDayDate(e.act.due)}` : 'Due today', sub:e.record.name || ''}));
  const reminders = contacted.map(x => { const last = myDayLast(x.acts) || x.at, quiet = last ? days(last) : 0;
    return quiet >= MYDAY_QUIET_DAYS && quiet <= MYDAY_STALE_DAYS && !hasOpenTask(x.acts) ? {key:`r${x.key}`, kind:'reminder', object:x.object, record:x.record, quiet, sub:`No contact for ${quiet} days`} : null; })
    .filter(Boolean).sort((a, b) => a.quiet - b.quiet);
  /* Spring's signals — something happened, or didn't, on one of my records that today's work should
     answer (not on a lead still in To Contact: it's there already). One per record, the first found:
     the client opened the quote; a reply after a silence; passed to me from a colleague; a quote sent
     and nothing since. Each stays until someone is in touch (a call that connects, an email sent, a meeting). */
  const waiting = new Set(toContact.map(x => x.key));
  const myRecord = (object, id) => { const r = (R[object] || []).find(x => sameId(x.id, id)); return r && mine(r) && !(object === 'contacts' && waiting.has(`l${r.id}`)) ? r : null; };
  const signals = new Map();
  const signal = (object, record, x) => { const k = `${object}:${record.id}`; if(!signals.has(k)) signals.set(k, {key:`s${k}`, kind:'signal', object, record, ...x}); };
  const timeOf = (a) => new Date(a.at).getTime() || 0;
  const touchedSince = (acts, t) => (acts || []).some(a => timeOf(a) > t && isRealTouch(a));
  const isMe = (v) => !!v && (v === me.id || v === me.name);
  (hub.quotes || []).forEach(q => { const r = q.viewedAt && q.status !== 'signed' && myRecord(q.object, q.recordId), t = r ? new Date(q.viewedAt).getTime() : 0;
    if(r && days(t) <= MYDAY_SIGNAL_DAYS && !touchedSince(actsOf(q.object, r.id), t)) signal(q.object, r, {signal:'quoteOpened', lead:'Opened your quote', sub:myDayDate(t), quote:q, at:t}); });
  [['contacts', leads], ['deals', deals.filter(openDeal)]].forEach(([object, list]) => list.forEach(rec => { const r = myRecord(object, rec.id); if(!r) return;
    const acts = actsOf(object, r.id), past = acts.filter(a => timeOf(a) && timeOf(a) <= now).sort((a, b) => timeOf(b) - timeOf(a));
    const reply = past.find(a => a.type === 'email' && a.direction === 'received'), rt = reply ? timeOf(reply) : 0;
    const before = rt ? Math.max(0, ...past.filter(a => timeOf(a) < rt && ['call', 'email', 'meeting'].includes(a.type)).map(timeOf)) : 0;
    if(rt && days(rt) <= MYDAY_REPLY_DAYS && before && rt - before >= MYDAY_SIGNAL_DAYS * MYDAY_DAY && !touchedSince(acts, rt))
      return signal(object, r, {signal:'replied', lead:'Replied', sub:myDayDate(rt), email:reply, at:rt});
    const pass = past.find(a => a.type === 'ownerChange' && a.from && isMe(a.to) && !isMe(a.from)), pt = pass ? timeOf(pass) : 0;
    if(pt && days(pt) <= MYDAY_SIGNAL_DAYS && !touchedSince(acts, pt)) signal(object, r, {signal:'passed', lead:`From ${userLabel(pass.from) || pass.from}`, sub:myDayDate(pt), from:userLabel(pass.from) || pass.from, at:pt});
  }));
  (hub.quotes || []).forEach(q => { const r = q.status === 'sent' && q.sentAt && !q.viewedAt && myRecord(q.object, q.recordId), t = r ? new Date(q.sentAt).getTime() : 0, d = r ? days(t) : 0;
    if(r && d >= MYDAY_SIGNAL_DAYS && d <= MYDAY_STALE_DAYS && (myDayLast(actsOf(q.object, r.id)) || 0) <= t + 3600000) signal(q.object, r, {signal:'quoteQuiet', lead:'Quote not answered', sub:`Sent ${d} days ago`, quote:q, at:t}); });
  const signalRows = [...signals.values()].sort((a, b) => b.at - a.at);
  // Today's tasks, then the signals (they're about now), then the overdue tasks, then the reminders.
  return {toContact, followUps:[...tasks.filter(x => !x.overdue), ...signalRows, ...tasks.filter(x => x.overdue), ...reminders.filter(x => !signals.has(`${x.object}:${x.record.id}`))], contacted};
}

/* ── The day's numbers (2026-11-20) ── what the person did today: Calls, Connected (a call that reached
   the person), Qualified (the outcome "Connected, qualified"), Quotes Sent, Deals Won. */
const MYDAY_METRICS = [{id:'calls', label:'Calls'}, {id:'connected', label:'Connected'}, {id:'qualified', label:'Qualified'}, {id:'quotes', label:'Quotes Sent'}, {id:'won', label:'Deals Won'}];
function myDayCounts(hub, me){
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const from = start.getTime(), today = (v) => { const t = v ? new Date(v).getTime() : 0; return t >= from && t < from + MYDAY_DAY; };
  const qualified = typeof CALL_QUALIFIED_OUTCOME === 'string' ? CALL_QUALIFIED_OUTCOME : 'Connected, qualified';
  const calls = hubActivities(hub, 'call').map(e => e.act).filter(a => today(a.at) && (a.by === me.name || a.pointOfContact === me.name));
  return {calls:calls.length, connected:calls.filter(callReached).length, qualified:calls.filter(a => a.outcome === qualified).length,
    quotes:(hub.quotes || []).filter(q => today(q.sentAt) && q.createdBy === me.name).length,
    won:((hub.records || {}).deals || []).filter(d => d.owner === me.id && recordStageType('deals', d) === 'won' && today(dashClosedAt('deals', d))).length};
}
/* The row of numbers (2026-11-20, as Mohsin read them back): the day's numbers are related, so each is
   read out of the one before it, in two groups in one row —
     Leads:  Calls, out of the day's target (Settings → Goals → Daily Activity); Connected, out of the
             calls made; Qualified, out of the connected.
     Deals:  Quotes Sent, out of the qualified; Deals Won, out of the quotes sent.
   A number with nothing before it yet stands alone. Then, where the person chose them (Layout
   Settings), any of their own dashboard KPIs read for today — up to MYDAY_KPI_MAX numbers in all. */
const MYDAY_KPI_MAX = 6;
const MYDAY_GROUPS = [{id:'leads', label:'Leads', ids:['calls', 'connected', 'qualified']}, {id:'deals', label:'Deals', ids:['quotes', 'won']}];
const MYDAY_OUT_OF = {connected:'calls', qualified:'connected', quotes:'qualified', won:'quotes'};   // each number's "of": the step before it
// Each number's mark (2026-11-23): its icon in its own colour — the coloured mark the widgets carry; a KPI of the person's own gets the grey gauge.
const MYDAY_METRIC_MARKS = {calls:{name:'call', color:'#2F6BFF'}, connected:{name:'user', color:'#0EA5A4'}, qualified:{name:'target', color:'#7C5CFC'}, quotes:{name:'quote', color:'#E8912D'}, won:{name:'deals', color:'#12A150'}};
const MYDAY_KPI_MARK = {name:'gauge', color:'#8B8D98'};
function MyDayCounts({hub, me, shown}){
  const counts = React.useMemo(() => myDayCounts(hub, me), [hub.activities, hub.quotes, hub.records, me.id]);
  const target = Number(((typeof activityGoalTarget === 'function' && activityGoalTarget(hub.data, {level:'user', id:me.id})) || {}).calls) || 0;
  // The person's own KPIs, for today (dashboard.jsx DASH_KPI_DEFS at the Personal level).
  const data = useDashBusinessData(hub, true), kpiIds = shown.filter(id => id.startsWith('kpi:'));
  const ctx = React.useMemo(() => { if(!kpiIds.length) return null; const records = hub.records || {}, users = hub.data.users || [];
    return {hub, range:dashPeriodRange('today', new Date(data.now)), rangeId:'today', users, settings:hub.data, ...dashLevelScope({data, records, deals:records.deals || [], users}, 'personal')}; },
    [kpiIds.length, data, hub.records, hub.data, me.id]);
  const day = (id) => { const m = MYDAY_METRICS.find(x => x.id === id), v = counts[id] || 0, of = id === 'calls' ? target : counts[MYDAY_OUT_OF[id]] || 0;
    return {id:`day:${id}`, label:m.label, value:v, of, goal:id === 'calls', mark:MYDAY_METRIC_MARKS[id]}; };
  const groups = [...MYDAY_GROUPS.map(g => ({id:g.id, label:g.label, items:g.ids.filter(id => shown.includes(`day:${id}`)).map(day)})),
    {id:'kpis', label:'My KPIs', items:kpiIds.map(id => { const def = dashKpiDef(id.slice(4)); return def && dashKpiVisible(def) && ctx ? {id, label:dashLabel(def, 'personal'), text:fmtKpiValue(def, def.read(ctx)), mark:MYDAY_KPI_MARK} : null; }).filter(Boolean)}]
    .filter(g => g.items.length);
  if(!groups.length) return null;
  return (
    <div style={{display:'flex', gap:DASH_GRID_GAP, alignItems:'stretch'}}>
      {groups.map(g => (
        <section key={g.id} aria-label={g.label} style={{...dashCard, borderRadius:22, flex:`${g.items.length} 1 0`, minWidth:0, display:'flex', flexDirection:'column'}}>
          <div style={{...settingsSectionLabel, padding:'16px 22px 0'}}>{g.label}</div>
          <div style={{display:'grid', gridTemplateColumns:`repeat(${g.items.length}, minmax(0, 1fr))`, flex:1}}>
            {g.items.map((m, i) => { const done = m.goal && m.of > 0 && m.value >= m.of;
              return (
                <div key={m.id} style={{padding:'12px 22px 22px', borderLeft: i ? `1px solid ${T.attioLine}` : 'none', display:'flex', flexDirection:'column', gap:10, minWidth:0}}>
                  <span style={{display:'flex', alignItems:'center', gap:8, minWidth:0}}>
                    {m.mark && <span aria-hidden="true" style={{width:26, height:26, borderRadius:9, flexShrink:0, display:'inline-flex', alignItems:'center', justifyContent:'center',
                      background:T.headerBg, boxShadow:`inset 0 0 0 1px ${T.attioLine}`}}><Icon name={m.mark.name} size={13} color={T.black}/></span>}
                    <span style={{fontSize:12.5, fontWeight:500, color:T.attioMuted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{m.label}</span>
                  </span>
                  {m.text != null ? <span style={{fontFamily:DASH_FIGURE_FONT, fontSize:30, lineHeight:'38px', fontWeight:600, color:T.attioText, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{m.text}</span>
                    : <span style={{display:'flex', alignItems:'baseline', gap:8, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap'}}>
                        <span style={{fontFamily:DASH_FIGURE_FONT, fontSize:38, lineHeight:1, fontWeight:600, color: done ? T.good : T.attioText}}>{m.value.toLocaleString('en-US')}</span>
                        {m.of > 0 && <span style={{fontSize:15, fontWeight:500, color:T.gray600}}>of {m.of.toLocaleString('en-US')}</span>}
                      </span>}
                  {m.text == null && m.of > 0 && <span role="progressbar" aria-valuemin={0} aria-valuemax={m.of} aria-valuenow={Math.min(m.value, m.of)} aria-label={`${m.label}: ${m.value} of ${m.of}`}
                    style={{height:6, borderRadius:9999, background:T.headerBg, overflow:'hidden'}}>
                    <span style={{display:'block', height:'100%', width:`${Math.min(100, Math.round(m.value / m.of * 100))}%`, minWidth: m.value > 0 ? 6 : 0, background: done ? T.good : T.black, borderRadius:9999, transition:'width 300ms'}}/></span>}
                </div>
              ); })}
          </div>
        </section>))}
    </div>
  );
}

/* ── Spring's brief and draft (2026-11-20; mocked — Spring isn't a model yet) ──
   The brief: what the record already says about the person, before a call — who they are, why they're
   on today's list, what was last said, their form answers, an open quote. The draft: an email started
   for the person from the same values (the composer's `draft`), theirs to change before it goes. */
const myDayFirst = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';
const myDayPara = (lines) => lines.filter(Boolean).map(l => `<p>${String(l).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`).join('');
function myDayDraft(x, me){
  const first = myDayFirst(x.record.name), mine = myDayFirst(me.name), q = x.quote, sign = `Best regards,`;
  const d = x.signal === 'quoteOpened' ? {subject:`Your quotation ${q.number}`, lines:[`Hi ${first},`, `I hope you had a chance to look through quotation ${q.number}. I am happy to walk you through it and answer any question about the services or the payment plan.`, `When is a good time for a short call?`]}
    : x.signal === 'quoteQuiet' ? {subject:`Following up on quotation ${q.number}`, lines:[`Hi ${first},`, `I am following up on quotation ${q.number}, which I sent on ${myDayDate(q.sentAt)}. Is there anything I can clarify, or a part of it you would like changed?`, `I can call you whenever suits you.`]}
    : x.signal === 'replied' ? {subject:'', lines:[`Hi ${first},`, `Thank you for your reply. I would like to go through it with you on a short call.`, `When would be a good time today or tomorrow?`]}
    : x.signal === 'passed' ? {subject:`Your enquiry with us`, lines:[`Hi ${first},`, `I am ${mine}, and I am taking over your enquiry from ${x.from}. I have read through your file, so you will not need to repeat anything.`, `When is a good time for a short call to agree the next step?`]}
    : x.kind === 'reminder' ? {subject:`Following up`, lines:[`Hi ${first},`, `I am following up on our last conversation. Is there anything you need from me to move ahead?`, `I can call you whenever suits you.`]}
    : {subject:`Your enquiry with us`, lines:[`Hi ${first},`, `Thank you for your enquiry. I am ${mine}, and I will be looking after it.`, `When is a good time for a short call to go through your profile?`]};
  return {subject:d.subject, body:myDayPara([...d.lines, sign])};   // the sender's signature follows it (emails.jsx)
}
function MyDayBrief({hub, me, row, onClose}){
  const {object, record} = row, acts = ((hub.activities || {})[object] || {})[record.id] || [];
  const fit = object === 'contacts' ? springFit(springProfile(hub.records.contacts, hub.records.customers), record) : null;
  const now = Date.now(), last = acts.filter(a => ['call', 'email', 'meeting', 'note'].includes(a.type) && new Date(a.at).getTime() <= now).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 3);
  const touch = latestTouch(acts), tries = leadTries(acts);
  const sub = typeof recordFormSubmission === 'function' ? recordFormSubmission(record) : null;
  const answers = sub && sub.form ? (sub.form.fields || []).map(f => [f.label || f.name || '', (sub.submission.answers || {})[f.id]]).filter(([l, v]) => l && v != null && v !== '' && !(Array.isArray(v) && !v.length)).slice(0, 6) : [];
  const quote = (hub.quotes || []).filter(q => q.object === object && sameId(q.recordId, record.id) && ['sent', 'signed'].includes(q.status)).sort((a, b) => new Date(b.sentAt || b.createdAt) - new Date(a.sentAt || a.createdAt))[0];
  const why = [row.lead, row.sub].filter(Boolean).join(' · ');
  const who = [record.jobTitle, [record.city, record.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
  const person = hubRecordPerson(hub, object, record.id), canEmail = !!(person && String(person.email || '').trim());
  const draft = () => { onClose(); hub.composeEmail({object, id:record.id, ...(row.signal === 'replied' && row.email ? {replyTo:row.email} : {}), draft:myDayDraft(row, me)}); };
  const section = (label, children) => <div style={{display:'flex', flexDirection:'column', gap:6}}><span style={settingsSectionLabel}>{label}</span>{children}</div>;
  return (
    <PageSidePanel title="Brief" onClose={onClose} divided>
      <div style={{flex:1, overflowY:'auto', padding:'18px 20px 24px', display:'flex', flexDirection:'column', gap:22}}>
        {/* Spring's brief: the person on Spring's slight orange ground, its mark at the right (2026-11-23). */}
        <div style={{display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:12, background:SPRING.tint, border:`1px solid ${SPRING.line}`}}>
          <RecordAvatar name={record.name} photo={record.photo} size={44}/>
          <div style={{flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:3}}>
            <ContactName name={record.name} onOpen={()=>{ onClose(); hub.openRecord(object, record.id); }} style={{fontSize:15, fontWeight:600}}/>
            {who && <span style={{fontSize:12.5, color:T.attioMuted}}>{who}</span>}
          </div>
          <SpringMark w={26}/>
        </div>
        {why && section('Today', <span style={{fontSize:13.5, color:T.attioText}}>{why}</span>)}
        {section('Profile', <PanelFields rows={[
          fit && fit.level && ['Spring', `${fit.level === 'strong' ? 'Strong fit' : 'Good fit'} · ${fit.why.join(', ')}`],
          object === 'contacts' ? ['Type of Lead', record.contactType] : ['Stage', stageLabelOf(hub.data, record.pipeline, record.stage)],
          record.amount ? ['Amount', moneyText(record.amount, record.currency)] : null,
          record.source ? ['Lead Source', record.source] : null,
          ['Last Contacted', touch ? fmtActStamp(new Date(touch.at)) : 'Not yet'],
          tries ? ['Unanswered Calls', String(tries)] : null,
          quote ? ['Quote', `${quote.number} · ${quote.status === 'signed' ? 'Signed' : quote.viewedAt ? 'Opened' : 'Sent'} · ${moneyText(quoteTotal(quote), quote.currency)}`] : null,
        ]}/>)}
        {answers.length > 0 && section('Form Answers', <PanelFields rows={answers.map(([l, v]) => [l, Array.isArray(v) ? v.join(', ') : String(v)])}/>)}
        {last.length > 0 && section('Last Activity', <div style={{display:'flex', flexDirection:'column'}}>{last.map(a => (
          <div key={a.id} style={{display:'flex', alignItems:'baseline', gap:12, padding:'7px 0', borderBottom:`1px solid ${T.attioLine}`}}>
            <span style={{width:120, flexShrink:0, fontSize:12.5, color:T.attioMuted, fontVariantNumeric:'tabular-nums'}}>{myDayDate(a.at)}</span>
            <span style={{fontSize:13, color:T.attioText, minWidth:0, overflowWrap:'anywhere'}}>{[(ACTIVITY_TYPES[a.type] || {}).label, a.type === 'call' ? a.outcome : a.title].filter(Boolean).join(' · ')}</span>
          </div>))}</div>)}
      </div>
      <div style={{display:'flex', justifyContent:'flex-end', gap:8, padding:'14px 20px', borderTop:`1px solid ${T.border}`, flexShrink:0}}>
        <StSecondary label="Draft Email" disabled={!canEmail} onClick={draft}/>
        <StCta label="Call" onClick={()=>{ onClose(); hub.startCall({object, id:record.id}); }}/>
      </div>
    </PageSidePanel>
  );
}

/* ── The widget ───────────────────────────────────────────────────────────────────────────── */

const MYDAY_TABS = [{id:'toContact', label:'To Contact'}, {id:'followUps', label:'Follow-ups'}, {id:'contacted', label:'Contacted'}];
const MYDAY_EMPTY = {toContact:'No leads to contact', followUps:'No follow-ups due', contacted:'No contacted leads yet'};
// A row's round action: its icon, named on hover.
// `spring`: a Spring action (Brief) — Spring's mark on its slight orange ground (shared.jsx SPRING, 2026-11-23).
function MyDayAction({icon, label, onClick, spring}){
  const [h, setH] = React.useState(false);
  if(spring) return <button type="button" title={label} aria-label={label} onClick={(e)=>{ e.stopPropagation(); onClick(); }} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
    style={{width:32, height:32, borderRadius:9999, border:`1px solid ${h ? SPRING.accent : SPRING.line}`, background:SPRING.tint, display:'inline-flex', alignItems:'center', justifyContent:'center',
      cursor:'pointer', flexShrink:0, transition:'border-color 120ms'}}><SpringMark w={18}/></button>;
  return <button type="button" title={label} aria-label={label} onClick={(e)=>{ e.stopPropagation(); onClick(); }} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
    style={{width:32, height:32, borderRadius:9999, border:`1px solid ${h ? T.black : T.borderStrong}`, background: h ? T.black : '#fff', display:'inline-flex', alignItems:'center', justifyContent:'center',
      cursor:'pointer', flexShrink:0, transition:'background 120ms, border-color 120ms'}}><Icon name={icon} size={14} color={h ? '#fff' : T.gray800}/></button>;
}
/* One row — a soft card that lifts on hover: its order (To Contact), the person's avatar (a task: its
   mark), the name and one quiet line (`lead`: its first words, in a tone — the fit, a due date),
   what's on the right (a deal's stage and amount), and its round actions. */
function MyDayRow({order, avatar, name, onOpen, lead, leadTone, sub, right, rightSub, actions}){
  const [h, setH] = React.useState(false);
  return (
    <div onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{display:'flex', alignItems:'center', gap:12, minHeight:56, padding:'8px 12px', borderRadius:14, background: h ? T.headerBg : 'transparent', transition:'background 140ms'}}>
      {order !== undefined && <span style={{width:16, flexShrink:0, fontSize:12, color:T.attioFaint, textAlign:'right', fontVariantNumeric:'tabular-nums'}}>{order || ''}</span>}
      {avatar}
      <div style={{flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:3}}>
        <span style={{minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}><ContactName name={name} onOpen={onOpen} style={{fontSize:13.5, fontWeight:600}}/></span>
        {(lead || sub) && <span style={{fontSize:12, color:T.attioMuted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
          {lead && <span style={{color:leadTone || T.attioText, fontWeight:500}}>{lead}</span>}{lead && sub ? ' · ' : ''}{sub}</span>}
      </div>
      {(right || rightSub) && <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:3, flexShrink:0, minWidth:0, maxWidth:'40%'}}>
        {right && <span style={{fontSize:12.5, fontWeight:500, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'100%'}}>{right}</span>}
        {rightSub && <span style={{fontSize:12, color:T.attioMuted, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap'}}>{rightSub}</span>}
      </div>}
      {(actions || []).map(a => <MyDayAction key={a.label} {...a}/>)}
    </div>
  );
}
function MyDayWidget({hub, title = 'My Day'}){
  const me = accessUser() || (hub.data.users || []).find(u => u.name === CURRENT_USER.name) || null;
  const [tab, setTab] = React.useState('toContact');
  const [task, setTask] = React.useState(null);   // the task open in its panel: {actId}
  const [brief, setBrief] = React.useState(null); // the row whose brief is open
  const lists = React.useMemo(() => me ? myDayLists(hub, me) : {toContact:[], followUps:[], contacted:[]}, [hub.records, hub.activities, hub.quotes, hub.data, me && me.id]);
  const items = lists[tab];
  const page = useDashList(items, (x) => x.kind === 'task' ? `${x.name} ${x.sub}` : `${x.name || (x.record && x.record.name) || ''} ${x.sub || ''}`, tab);
  const open = (x) => hub.openRecord(x.object, x.record.id);
  const call = (x) => ({icon:'call', label:'Call', onClick:() => hub.startCall({object:x.object, id:x.record.id})});
  const briefOf = (x) => ({spring:true, label:'Brief', onClick:() => setBrief(x)});   // Spring's brief, with its Draft Email
  const addTask = (x) => { hub.add(x.object, x.record.id, {type:'task', source:'you', by:CURRENT_USER.name, title:`Follow up with ${x.record.name}`, description:'', status:'notStarted', taskType:'To-do',
    assignee:me.name, ...taskDueValue(ymdOf(new Date()), '')}); hub.toast('Task added'); };
  const face = (x) => <RecordAvatar name={x.record.name} photo={x.record.photo} size={34}/>;
  const taskMark = (x) => <span aria-hidden="true" style={{width:34, height:34, borderRadius:9999, background: x.overdue ? '#FEF3F2' : T.headerBg, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
    <Icon name="tasks" size={15} color={x.overdue ? T.red : T.gray600}/></span>;
  const firstUnanswered = tab === 'toContact' ? page.rows.findIndex(x => x.group === 'unanswered') : -1;
  const row = (x, i) => (
    <React.Fragment key={x.key}>
      {i === firstUnanswered && <div style={{...settingsSectionLabel, padding:'14px 12px 6px'}}>Not answered</div>}
      {x.kind === 'task' ? <MyDayRow avatar={taskMark(x)} name={x.name} onOpen={()=>setTask({actId:x.entry.act.id})} lead={x.lead} leadTone={x.overdue ? T.red : undefined} sub={x.sub}/>
        : tab === 'toContact' ? <MyDayRow order={x.order || 0} avatar={face(x)} name={x.record.name} onOpen={()=>open(x)} lead={x.lead} leadTone={x.fit === 'strong' ? T.good : undefined} sub={x.sub} actions={[briefOf(x), call(x)]}/>
        : tab === 'followUps' ? <MyDayRow avatar={face(x)} name={x.record.name} onOpen={()=>open(x)} lead={x.lead} sub={x.sub}
            actions={[briefOf(x), call(x), ...(x.kind === 'reminder' ? [{icon:'tasks', label:'Add Task', onClick:()=>addTask(x)}] : [])]}/>
        : <MyDayRow avatar={face(x)} name={x.record.name} onOpen={()=>open(x)} sub={x.sub} right={x.stage} rightSub={x.amount} actions={[call(x)]}/>}
    </React.Fragment>
  );
  return (
    /* No Spring logo in the header (Mohsin 2026-11-23): each row's Brief carries it. */
    <DashWidgetCard title={title} icon={MYDAY_ICONS.myDay}>
      {/* The three lists: one segmented control, each with its count. */}
      <div role="radiogroup" aria-label="My Day" style={{display:'flex', gap:2, padding:3, borderRadius:12, background:T.headerBg, alignSelf:'flex-start', maxWidth:'100%', overflowX:'auto'}}>
        {MYDAY_TABS.map(t => { const on = t.id === tab;
          return <button key={t.id} type="button" role="radio" aria-checked={on} onClick={()=>setTab(t.id)}
            style={{height:30, padding:'0 12px', borderRadius:9, border:'none', background: on ? '#fff' : 'transparent', boxShadow: on ? '0 1px 2px rgba(16,24,40,.10)' : 'none', color: on ? T.attioText : T.gray600,
              fontSize:12.5, fontWeight: on ? 600 : 500, fontFamily:'inherit', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6, whiteSpace:'nowrap', transition:'background 140ms'}}>
            {t.label}<span style={{fontVariantNumeric:'tabular-nums', fontWeight:500, color: on ? T.attioMuted : T.attioFaint}}>{lists[t.id].length.toLocaleString('en-US')}</span></button>; })}
      </div>
      {page.long && <DashSearch value={page.query} onChange={page.setQuery} placeholder="Search"/>}
      {items.length ? <div style={{display:'flex', flexDirection:'column', gap:2, margin:'0 -12px'}}>{page.rows.map(row)}</div>
        : <div style={{fontSize:13, color:T.attioMuted}}>{MYDAY_EMPTY[tab]}</div>}
      {page.q && !page.found.length && dashNoMatch(page.query)}
      {page.pager}
      {task && <DashTaskPanel hub={hub} actId={task.actId} onClose={()=>setTask(null)}/>}
      {brief && <MyDayBrief hub={hub} me={me} row={brief} onClose={()=>setBrief(null)}/>}
    </DashWidgetCard>
  );
}

/* ── My Day, the page (2026-11-20) ── an employee's first nav item (dashboard.jsx DashboardPage, part
   'day'), under the greeting and Spring: the day's numbers, then — a fixed layout in the dashboard's
   grid — the Time Clock, My Day's lists, Commission, Meetings Today and Payments Due. Everything else
   of their dashboard is Analytics. */
// A plain list widget: rows of MyDayRow, ten at a time (a search and the pager when longer), or one quiet line.
function MyDayList({title, items, textOf, empty, row, icon, children}){
  const page = useDashList(items, textOf, title);
  return (
    <DashWidgetCard title={title} icon={icon}>
      {page.long && <DashSearch value={page.query} onChange={page.setQuery} placeholder="Search"/>}
      {items.length ? <div style={{display:'flex', flexDirection:'column', gap:2, margin:'0 -12px'}}>{page.rows.map(row)}</div> : <div style={{fontSize:13, color:T.attioMuted}}>{empty}</div>}
      {page.q && !page.found.length && dashNoMatch(page.query)}
      {page.pager}
      {children}
    </DashWidgetCard>
  );
}
// Each widget's mark (dashboard.jsx DashWidgetCard `icon`): its icon, in its own colour.
const MYDAY_ICONS = {taggedNotes:{name:'notepad', color:'#E8912D'}, myDay:{name:'home', color:'#7C5CFC'}, commission:{name:'coins', color:'#12A150'}, calendar:{name:'calendar', color:'#2F6BFF'}, meetings:{name:'videoCamera', color:'#2F6BFF'},
  payments:{name:'quote', color:'#E8912D'}, noResponse:{name:'envelope', color:'#E5486A'}};
// The person's meetings today: the ones they set up, and the ones on records they own — earliest first.
function MyDayMeetings({hub, me}){
  const start = new Date(); start.setHours(0, 0, 0, 0); const from = start.getTime();
  const items = hubActivities(hub, 'meeting').map(e => ({...e, at:new Date(e.act.scheduledFor || e.act.at).getTime() || 0}))
    .filter(e => e.at >= from && e.at < from + MYDAY_DAY && e.act.status !== 'cancelled' && (e.act.by === me.name || e.record.owner === me.id)).sort((a, b) => a.at - b.at);
  return <MyDayList title="Meetings Today" icon={MYDAY_ICONS.meetings} items={items} textOf={(e) => `${e.record.name} ${e.act.title || ''}`} empty="No meetings today"
    row={(e) => <MyDayRow key={e.act.id} avatar={<RecordAvatar name={e.record.name} photo={e.record.photo} size={34}/>} name={e.record.name} onOpen={()=>hub.openRecord(e.object, e.recordId)}
      sub={e.act.title || e.act.platform || ''} right={fmtActTime(new Date(e.at))}/>}/>;
}
/* Payments due: the unpaid payments of the plans on the person's own records (accounting.jsx), due by
   the end of this week or overdue — overdue first, then by date. A frozen plan asks for nothing.
   A payment opens its record on the Accounting tab, where its plan is. */
function myDayPayments(hub, me){
  const end = new Date(); end.setHours(0, 0, 0, 0); end.setDate(end.getDate() + (7 - end.getDay()) % 7);   // this week's Sunday
  const by = ymdOf(end), today = ymdOf(new Date());
  return (hub.accounting || []).filter(s => !s.frozen).flatMap(s => { const record = ((hub.records || {})[s.object] || []).find(r => sameId(r.id, s.recordId));
    if(!record || record.owner !== me.id || recordStageType(s.object, record) === 'lost') return [];   // a lost record isn't chased for payment here
    return livePayments(s).filter(i => i.dueDate && i.dueDate <= by && installmentState(s, i).status !== 'paid')
      .map(i => ({key:`${s.id}:${i.id}`, object:s.object, record, due:i.dueDate, overdue:i.dueDate < today, amount:installmentState(s, i).outstanding, currency:scheduleCurrency(s), description:i.description || ''})); })
    .sort((a, b) => (b.overdue - a.overdue) || a.due.localeCompare(b.due));
}
function MyDayPayments({hub, me}){
  const items = React.useMemo(() => myDayPayments(hub, me), [hub.accounting, hub.records, me.id]);
  // A date in another year says so (an overdue payment may be last year's).
  const day = (ymd) => { const d = new Date(`${ymd}T00:00:00`); return d.getFullYear() === new Date().getFullYear() ? myDayDate(d) : d.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}); };
  return <MyDayList title="Payments Due" icon={MYDAY_ICONS.payments} items={items} textOf={(x) => `${x.record.name} ${x.description}`} empty="No payments due this week"
    row={(x) => <MyDayRow key={x.key} avatar={<RecordAvatar name={x.record.name} photo={x.record.photo} size={34}/>} name={x.record.name} onOpen={()=>hub.openRecord(x.object, x.record.id, undefined, 'accounting')}
      lead={x.overdue ? `Overdue · ${day(x.due)}` : `Due ${day(x.due)}`} leadTone={x.overdue ? T.red : undefined} sub={x.description} right={moneyText(x.amount, x.currency)}/>}/>;
}
/* Commission this month (commission.jsx — Settings → Commission): the person's cash received this
   month, the rate of the slab it has reached and what that earns, with how far the next slab is. */
function MyDayCommission({hub, me}){
  const dash = useDashBusinessData(hub, true);
  const c = userCommission(hub.data, dash, me.id);
  if(!c) return null;
  const cur = defaultCurrency(), amt = (v) => `${cur} ${formatAmount(Math.round(v))}`;
  const slabs = commissionSlabs(hub.data), from = (slabs.filter(x => x.from <= c.cash).pop() || {from:0}).from;
  const part = c.next ? Math.max(0, Math.min(1, (c.cash - from) / Math.max(1, c.next.at - from))) : 1;
  return (
    <DashWidgetCard title="Commission" icon={MYDAY_ICONS.commission}>
      <span style={{fontFamily:DASH_FIGURE_FONT, fontSize:34, lineHeight:1, fontWeight:600, color:T.attioText, fontVariantNumeric:'tabular-nums'}}>{amt(c.amount)}</span>
      <span style={{fontSize:12.5, color:T.attioMuted}}>{c.rate}% of {amt(c.cash)} received this month</span>
      {c.next && <div style={{display:'flex', flexDirection:'column', gap:8, marginTop:4}}>
        <span role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(part * 100)} aria-label="To the next slab" style={{height:3, borderRadius:9999, background:T.headerBg, overflow:'hidden'}}>
          <span style={{display:'block', height:'100%', width:`${Math.round(part * 100)}%`, background:T.black, borderRadius:9999}}/></span>
        <span style={{fontSize:12.5, color:T.attioText}}>{amt(c.next.toGo)} to {c.next.rate}%</span>
      </div>}
    </DashWidgetCard>
  );
}
/* ── My Calendar (2026-11-20; it was Today for a few hours) ── the person's whole day down one rail,
   in time order — what is planned and what happened: their meetings and their tasks due today at a
   time (a call back is one); and the day's record — when they clocked in and out and each break
   (paid or unpaid, from the Time Clock), every call they made (with its outcome), every email and
   quote they sent — and the free slots between them (myDayFree). The time on the left, a dot in the
   kind's colour, the title and one quiet line.
   A meeting that's over is quiet, a task still open past its time is red, a line marks now. A task
   without a due time isn't a place in the day: it stays in Follow-ups. A task opens its panel,
   anything else its record. */
const MYDAY_KIND_COLOR = {meeting:'#2F6BFF', task:'#E8912D', call:'#12A150', email:'#7C5CFC', quote:'#16A3B8', clock:'#0ACC8B', out:'#E5484D', break:'#FF6600'};
const MYDAY_BREAK_LABEL = {paid:'Lunch Break', unpaid:'Tea / Bio Break'};
function myDayAgenda(hub, me){
  const start = new Date(); start.setHours(0, 0, 0, 0); const from = start.getTime(), today = (t) => t >= from && t < from + MYDAY_DAY, now = Date.now();
  // Mine: what I did or am the point of contact of — and what was done in this session while I'm the one signed in.
  const mine = (a) => a.by === me.name || a.pointOfContact === me.name || (a.source === 'you' && !a.by && CURRENT_USER.name === me.name);
  const meetings = hubActivities(hub, 'meeting').map(e => ({e, at:new Date(e.act.scheduledFor || e.act.at).getTime() || 0}))
    .filter(x => today(x.at) && x.e.act.status !== 'cancelled' && (x.e.act.by === me.name || x.e.record.owner === me.id))
    .map(x => ({key:`m${x.e.act.id}`, kind:'meeting', planned:true, at:x.at, len:Number(x.e.act.durationMin) || 30, title:x.e.act.title || 'Meeting', sub:[x.e.record.name, x.e.act.durationMin ? `${x.e.act.durationMin} min` : ''].filter(Boolean).join(' · '), entry:x.e}));
  const tasks = hubActivities(hub, 'task').map(e => ({e, at:e.act.due ? new Date(e.act.due).getTime() : 0}))
    .filter(x => x.e.act.assignee === me.name && x.e.act.dueTime && today(x.at))
    .map(x => ({key:`t${x.e.act.id}`, kind: x.e.act.taskType === 'Call' ? 'call' : 'task', planned:true, task:true, at:x.at, len:Number(x.e.act.allowedMin) || 0, title:x.e.act.title || 'Task', done:!isTaskOpen(x.e.act),
      sub:[x.e.record.name, x.e.act.allowedMin && typeof taskTimeLabel === 'function' ? taskTimeLabel(x.e.act.allowedMin) : ''].filter(Boolean).join(' · '), entry:x.e}));
  // What happened: calls made, emails and quotes sent.
  const did = (type, ok, sub) => hubActivities(hub, type).map(e => ({e, at:new Date(e.act.at).getTime() || 0})).filter(x => today(x.at) && x.at <= now && mine(x.e.act) && ok(x.e.act))
    .map(x => ({key:`${type[0]}a${x.e.act.id}`, kind:type, at:x.at, len: type === 'call' ? Number(x.e.act.durationMin) || 0 : 0, title:x.e.record.name, sub:sub(x.e.act), entry:x.e}));
  const calls = did('call', () => true, (a) => ['Call', a.outcome].filter(Boolean).join(' · '));
  const emails = did('email', (a) => a.direction !== 'received' && a.status !== 'scheduled', (a) => ['Email', a.title].filter(Boolean).join(' · '));
  const quotes = did('quote', (a) => a.status === 'sent', (a) => ['Quote sent', String(a.title || '').split(' · ')[0]].filter(Boolean).join(' · '));
  // The Time Clock's trail (app.jsx): clocking in and out, and each break with how long it ran.
  const trail = ((hub.workSession || {}).session || {}).trail || [], clock = [];
  trail.forEach((e, i) => { const at = new Date(e.at).getTime(); if(!today(at)) return;
    if(e.type === 'clockIn') clock.push({key:`c${i}`, kind:'clock', at, title:'Clocked In'});
    else if(e.type === 'clockOut') clock.push({key:`c${i}`, kind:'out', at, title:'Clocked Out'});
    else if(e.type === 'breakStart'){ const end = trail.slice(i + 1).find(x => x.type === 'breakEnd' || x.type === 'clockOut');
      clock.push({key:`c${i}`, kind:'break', at, len:Math.max(1, ((end ? new Date(end.at).getTime() : now) - at) / 60000), title:MYDAY_BREAK_LABEL[e.kind] || 'Break', sub: end ? `Until ${fmtActTime(new Date(end.at))}` : 'Running'}); } });
  const items = [...meetings, ...tasks, ...calls, ...emails, ...quotes, ...clock].sort((a, b) => a.at - b.at);
  const free = myDayFree(items, trail.filter(e => today(new Date(e.at).getTime())), now);
  return {items:[...items, ...free].sort((a, b) => a.at - b.at), freeMs:free.filter(f => !f.future).reduce((n, f) => n + (f.end - f.at), 0)};
}
/* Free slots (2026-11-20): the gaps of MYDAY_FREE_MIN minutes or more with nothing in them — no call
   (for as long as it lasted), meeting, break or task (for its Time Allowed). Behind now they are
   certain: counted inside the working day — from clocking in to clocking out, each time; without
   the Time Clock, from the day's first activity — up to now. Ahead of now they are only what's free
   so far: from now to the end of the last thing planned today, while the person is at work. */
const MYDAY_FREE_MIN = 15;
const myDaySpan = (ms) => { const m = Math.round(ms / 60000), h = Math.floor(m / 60); return h ? `${h} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`; };
function myDayFree(items, trail, now){
  const least = MYDAY_FREE_MIN * 60000;
  const busy = items.filter(x => x.kind !== 'clock' && x.kind !== 'out').map(x => [x.at, x.at + Math.max(1, x.len || 0) * 60000]).sort((a, b) => a[0] - b[0]);
  const wins = []; let inAt = null, clocked = false;
  trail.forEach(e => { const at = new Date(e.at).getTime();
    if(e.type === 'clockIn'){ clocked = true; if(inAt == null) inAt = at; } else if(e.type === 'clockOut' && inAt != null){ wins.push([inAt, at]); inAt = null; } });
  if(inAt != null) wins.push([inAt, now]);
  if(!clocked){ const first = items.find(x => x.at <= now); if(first) wins.push([first.at, now]); }
  const gaps = (from, to, future) => { let cur = from; const out = [];
    busy.filter(b => b[1] > from && b[0] < to).forEach(([a, b]) => { if(a - cur >= least) out.push({at:cur, end:a}); cur = Math.max(cur, b); });
    if(to - cur >= least) out.push({at:cur, end:to});
    return out.map(g => ({key:`f${future ? 'u' : 'p'}${g.at}`, kind:'free', future, at:future ? g.at + 1 : g.at, end:g.end, title:'Free', sub:myDaySpan(g.end - g.at)})); };
  const past = wins.flatMap(([a, b]) => gaps(a, Math.min(b, now), false));
  const atWork = inAt != null || !clocked, last = Math.max(0, ...items.filter(x => x.planned && x.at > now).map(x => x.at + (x.len || 0) * 60000));
  return [...past, ...(atWork && last > now ? gaps(now, last, true) : [])];
}
function MyDayCalendar({hub, me}){
  const [minute, tick] = React.useState(0);
  React.useEffect(() => { const t = setInterval(() => tick(n => n + 1), 60000); return () => clearInterval(t); }, []);
  const [task, setTask] = React.useState(null);
  const trail = ((hub.workSession || {}).session || {}).trail;
  const {items, freeMs} = React.useMemo(() => myDayAgenda(hub, me), [hub.activities, hub.records, trail, me.id, minute]);
  const now = Date.now(), next = items.findIndex(x => x.at > now);   // the line for now sits before the first one still to come
  // A long day scrolls inside the card, opened where now is.
  const box = React.useRef(null), nowRef = React.useRef(null);
  React.useLayoutEffect(() => { const b = box.current, n = nowRef.current; if(b && n && b.scrollHeight > b.clientHeight) b.scrollTop = Math.max(0, n.offsetTop - b.clientHeight / 2); }, [items.length]);
  const nowLine = <div key="now" ref={nowRef} aria-label="Now" style={{display:'flex', alignItems:'center', gap:10, padding:'4px 0'}}>
    <span style={{width:64, flexShrink:0, textAlign:'right', fontSize:11.5, fontWeight:600, color:T.red, fontVariantNumeric:'tabular-nums'}}>{fmtActTime(new Date(now))}</span>
    <span style={{width:7, height:7, borderRadius:9999, background:T.red, flexShrink:0}}/><span style={{flex:1, height:1, background:T.red, opacity:.35}}/></div>;
  const open = (x) => x.task ? setTask({actId:x.entry.act.id}) : hub.openRecord(x.entry.object, x.entry.recordId);
  return (
    <DashWidgetCard title="My Calendar" icon={MYDAY_ICONS.calendar} right={<span style={{fontSize:12.5, color:T.attioMuted, fontVariantNumeric:'tabular-nums'}}>
      {freeMs > 0 ? `Free so far · ${myDaySpan(freeMs)}` : new Date().toLocaleDateString('en-US', {weekday:'long', month:'short', day:'numeric'})}</span>}>
      {!items.length ? <div style={{fontSize:13, color:T.attioMuted}}>Nothing yet today</div> : (
        <div ref={box} style={{display:'flex', flexDirection:'column', maxHeight:420, overflowY:'auto', position:'relative', margin:'0 -8px', padding:'0 8px'}}>
          {items.map((x, i) => { const late = x.task && !x.done && x.at <= now, quiet = !late && x.planned && (x.at <= now || x.done);   // a task still open past its time is late; a meeting that's over is quiet
            /* A free slot: its start, a hollow dot, and a quiet band saying how long — plain behind now, dashed ahead of it (only free so far). */
            if(x.kind === 'free') return (<React.Fragment key={x.key}>
              {i === next && nowLine}
              <div style={{display:'flex', alignItems:'stretch', gap:10, minHeight:40}}>
                <span style={{width:64, flexShrink:0, textAlign:'right', paddingTop:8, fontSize:12.5, color:T.attioFaint, fontWeight:500, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap'}}>{fmtActTime(new Date(x.at))}</span>
                <span style={{width:7, flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center'}}>
                  <span style={{width:7, height:7, borderRadius:9999, marginTop:13, flexShrink:0, boxSizing:'border-box', border:`1.5px solid ${T.borderStrong}`, background:'#fff'}}/>
                  {i < items.length - 1 && <span style={{flex:1, width:1, background:T.attioLine, marginTop:4}}/>}
                </span>
                <div style={{flex:1, minWidth:0, padding:'3px 0 9px'}}>
                  <div style={{display:'flex', alignItems:'center', gap:8, height:28, padding:'0 10px', borderRadius:8, fontSize:12.5, color:T.attioMuted, boxSizing:'border-box',
                    background: x.future ? 'transparent' : T.headerBg, border: x.future ? `1px dashed ${T.borderStrong}` : '1px solid transparent'}}>
                    <span style={{flex:1, fontWeight:500}}>Free</span><span style={{fontVariantNumeric:'tabular-nums'}}>{x.sub}</span></div>
                </div>
              </div>
            </React.Fragment>);
            return (<React.Fragment key={x.key}>
              {i === next && nowLine}
              <div style={{display:'flex', alignItems:'stretch', gap:10, minHeight: x.sub ? 48 : 34}}>
                <span style={{width:64, flexShrink:0, textAlign:'right', paddingTop:6, fontSize:12.5, color: late ? T.red : quiet ? T.attioFaint : T.attioText, fontWeight:500, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap'}}>{fmtActTime(new Date(x.at))}</span>
                <span style={{width:7, flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center'}}>
                  <span style={{width:7, height:7, borderRadius:9999, marginTop:11, flexShrink:0, background: late ? T.red : quiet ? T.borderStrong : MYDAY_KIND_COLOR[x.kind]}}/>
                  {i < items.length - 1 && <span style={{flex:1, width:1, background:T.attioLine, marginTop:4}}/>}
                </span>
                <div style={{flex:1, minWidth:0, padding:'5px 0 12px', display:'flex', flexDirection:'column', gap:2}}>
                  <span style={{minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', opacity: quiet ? .55 : 1, textDecoration: x.done ? 'line-through' : 'none'}}>
                    {x.entry ? <ContactName name={x.title} onOpen={()=>open(x)} style={{fontSize:13.5, fontWeight:600}}/> : <span style={{fontSize:13.5, fontWeight:600, color:T.attioText}}>{x.title}</span>}</span>
                  {x.sub && <span style={{fontSize:12, color:T.attioMuted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{x.sub}</span>}
                </div>
              </div>
            </React.Fragment>); })}
          {next === -1 && nowLine}
        </div>)}
      {task && <DashTaskPanel hub={hub} actId={task.actId} onClose={()=>setTask(null)}/>}
    </DashWidgetCard>
  );
}

/* ── No Response (2026-11-20) ── the person's leads and open deals who haven't answered: the last
   thing between them was an email the team sent or a call they didn't pick up, and nothing has come
   back since — no reply, no call that connected, no meeting — for 2 days or more (up to 30: older
   isn't today's work). The most recent first; a person once, as their deal when they have one.
   Emails and calls only for now: WhatsApp and other channels join when they're connected. */
const MYDAY_SILENT_DAYS = 2;
function myDayNoResponse(hub, me){
  const R = hub.records || {}, A = hub.activities || {}, now = Date.now();
  const open = (R.deals || []).filter(d => d.owner === me.id && (recordStageType('deals', d) || 'open') === 'open');
  const leads = (R.contacts || []).filter(l => l.owner === me.id && !open.some(d => contactIdsOf(d).some(i => sameId(i, l.id))));
  const rows = [];
  [['deals', open], ['contacts', leads]].forEach(([object, list]) => list.forEach(record => {
    const last = ((A[object] || {})[record.id] || []).filter(a => ['email', 'call', 'meeting'].includes(a.type) && a.status !== 'scheduled' && new Date(a.at).getTime() <= now)
      .sort((a, b) => new Date(b.at) - new Date(a.at))[0];
    if(!last) return;
    const channel = last.type === 'email' && last.direction !== 'received' ? 'Email' : last.type === 'call' && MYDAY_UNANSWERED.test(last.outcome || '') ? 'Call' : null;
    const at = new Date(last.at).getTime(), days = Math.floor((now - at) / MYDAY_DAY);
    if(channel && days >= MYDAY_SILENT_DAYS && days <= MYDAY_STALE_DAYS) rows.push({key:`${object}:${record.id}`, object, record, channel, days, lead:channel === 'Email' ? 'Email not answered' : 'Call not answered', sub:`${days} days ago`});
  }));
  return rows.sort((a, b) => a.days - b.days);
}
function MyDayNoResponse({hub, me}){
  const [brief, setBrief] = React.useState(null);
  const items = React.useMemo(() => myDayNoResponse(hub, me), [hub.activities, hub.records, me.id]);
  return <MyDayList title="No Response" icon={MYDAY_ICONS.noResponse} items={items} textOf={(x) => `${x.record.name} ${x.lead}`} empty="Everyone has answered"
    row={(x) => <MyDayRow key={x.key} avatar={<RecordAvatar name={x.record.name} photo={x.record.photo} size={34}/>} name={x.record.name} onOpen={()=>hub.openRecord(x.object, x.record.id)}
      lead={x.lead} sub={x.sub} actions={[{spring:true, label:'Brief', onClick:()=>setBrief({...x, kind:'reminder'})}, {icon:'call', label:'Call', onClick:()=>hub.startCall({object:x.object, id:x.record.id})}]}/>}>
    {brief && <MyDayBrief hub={hub} me={me} row={brief} onClose={()=>setBrief(null)}/>}
  </MyDayList>;
}

/* ── Call Next Lead (2026-11-20) ── on the greeting's right: one press calls the next lead of To
   Contact — the first, in Spring's order, with a phone number. The button is its own, and quiet
   (third pass: the glass and the glossy orb read as dated): a flat near-black pill with a hairline
   edge that one small light travels around, the call in a plain white disc, the lead's name under
   the words, an arrow that moves a little on hover. No glow, no gloss. */
const MYDAY_CSS = `@keyframes hofCallRing{to{transform:rotate(360deg)}}
.hof-callnext{transition:transform 180ms cubic-bezier(.2,.8,.2,1), box-shadow 180ms ease}.hof-callnext:hover{transform:translateY(-1px);box-shadow:0 14px 30px rgba(16,24,40,.22), 0 2px 4px rgba(16,24,40,.16)}.hof-callnext:active{transform:scale(.985)}
.hof-callnext .hof-ring{animation:hofCallRing 5s linear infinite}.hof-callnext .hof-go{transition:transform 180ms cubic-bezier(.2,.8,.2,1), opacity 180ms ease;opacity:.5}.hof-callnext:hover .hof-go{transform:translateX(3px);opacity:1}
@media (prefers-reduced-motion: reduce){.hof-callnext .hof-ring{animation:none;opacity:0}.hof-callnext,.hof-callnext:hover,.hof-callnext .hof-go{transition:none;transform:none}}`;
if(typeof document !== 'undefined'){ let st = document.getElementById('hof-myday-css'); if(!st){ st = document.createElement('style'); st.id = 'hof-myday-css'; document.head.appendChild(st); } st.textContent = MYDAY_CSS; }
function MyDayCallNext({hub}){
  const me = accessUser() || (hub.data.users || []).find(u => u.name === CURRENT_USER.name) || null;
  const next = React.useMemo(() => { if(!me) return null; const hasPhone = (x) => { const p = hubRecordPerson(hub, x.object, x.record.id); return !!(p && String(p.phone || '').trim()); };
    return myDayLists(hub, me).toContact.find(hasPhone) || null; }, [hub.records, hub.activities, hub.quotes, hub.data, me && me.id]);
  if(!me) return null;
  return (
    <span className={next ? 'hof-callnext' : undefined} style={{position:'relative', display:'inline-flex', padding:1, borderRadius:16, overflow:'hidden', flexShrink:0,
      boxShadow: next ? '0 8px 22px rgba(16,24,40,.16), 0 1px 2px rgba(16,24,40,.18)' : 'none', background: next ? '#2A2A33' : T.borderStrong}}>
      {/* The edge: a hairline, and one small light going round it. */}
      {next && <span aria-hidden="true" className="hof-ring" style={{position:'absolute', inset:'-150%', background:'conic-gradient(from 0deg, rgba(255,255,255,0) 0deg, rgba(255,255,255,0) 300deg, #8FA3FF 338deg, #FFFFFF 352deg, rgba(255,255,255,0) 360deg)'}}/>}
      <button type="button" disabled={!next} onClick={()=>next && hub.startCall({object:next.object, id:next.record.id})} aria-label={next ? `Call next lead: ${next.record.name}` : 'No leads to call'}
        style={{position:'relative', display:'inline-flex', alignItems:'center', gap:12, height:54, padding:'0 16px 0 9px', borderRadius:15, border:'none', cursor: next ? 'pointer' : 'default', fontFamily:'inherit', textAlign:'left',
          background: next ? 'linear-gradient(180deg, #1B1B22 0%, #101014 100%)' : '#fff', boxShadow: next ? 'inset 0 1px 0 rgba(255,255,255,.07)' : 'none'}}>
        <span aria-hidden="true" style={{width:36, height:36, borderRadius:11, flexShrink:0, display:'inline-flex', alignItems:'center', justifyContent:'center', background: next ? '#fff' : T.headerBg}}>
          <Icon name="call" size={16} color={next ? '#101014' : T.gray400}/></span>
        <span style={{display:'flex', flexDirection:'column', gap:1, minWidth:0}}>
          <span style={{fontSize:14, fontWeight:600, letterSpacing:-.15, color: next ? '#fff' : T.gray400, whiteSpace:'nowrap'}}>{next ? 'Call Next Lead' : 'No Leads to Call'}</span>
          {next && <span style={{fontSize:12, color:'rgba(255,255,255,.56)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:180}}>{next.record.name}</span>}
        </span>
        {next && <span aria-hidden="true" className="hof-go" style={{display:'inline-flex', marginLeft:6}}><Icon name="arrowRight" size={14} color="#fff"/></span>}
      </button>
    </span>
  );
}

/* ── My Day, the page: its layout (2026-11-20) ── each person's own, set in Layout Settings (kept with
   their dashboard: overviewSettings.userMyDay[<user ID>]): which numbers show in the top row — the
   day numbers and any of their own KPIs, up to MYDAY_KPI_MAX — and which widgets, in what order
   (dragged in the list). My Calendar lists the meetings, so Meetings Today starts hidden. */
const MYDAY_WIDGETS = [{id:'timeClock', label:'Time Clock', width:1}, {id:'myDay', label:'My Day', width:2}, {id:'calendar', label:'My Calendar', width:1}, {id:'commission', label:'Commission', width:1, money:true},
  {id:'noResponse', label:'No Response', width:1}, {id:'payments', label:'Payments Due', width:1, money:true}, {id:'meetings', label:'Meetings Today', width:1, hidden:true},
  {id:'taggedNotes', label:'Tagged Notes', width:1, hidden:true}];   // Tagged Notes shows itself while there's a tag to open (MyDayPage)
const myDayKpiOffer = () => dashOffer().kpis.filter(sl => dashSlotOf(sl).level === 'personal').map(sl => `kpi:${dashSlotOf(sl).id}`);
function myDayConfig(raw, kpiOffer){
  const all = [...MYDAY_METRICS.map(m => `day:${m.id}`), ...kpiOffer];
  const kpis = raw && Array.isArray(raw.kpis) ? raw.kpis.filter((id, i, list) => all.includes(id) && list.indexOf(id) === i).slice(0, MYDAY_KPI_MAX) : MYDAY_METRICS.map(m => `day:${m.id}`);
  const saved = ((raw && raw.widgets) || []).filter(w => MYDAY_WIDGETS.some(d => d.id === w.id)).map(w => ({id:w.id, hidden:!!w.hidden, ...(w.hiddenAt ? {hiddenAt:w.hiddenAt} : {})}));
  return {kpis, widgets:[...saved, ...MYDAY_WIDGETS.filter(d => !saved.some(w => w.id === d.id)).map(d => ({id:d.id, hidden:!!d.hidden}))]};
}
function MyDaySettingsModal({config, kpiOffer, widgetOk, onApply, onClose}){
  const [section, setSection] = React.useState('kpis');
  const [draft, setDraft] = React.useState(config);
  const toggleKpi = (id) => setDraft(d => d.kpis.includes(id) ? {...d, kpis:d.kpis.filter(x => x !== id)} : d.kpis.length >= MYDAY_KPI_MAX ? d : {...d, kpis:[...d.kpis, id]});
  const widgets = draft.widgets.filter(w => widgetOk(w.id));
  const drag = useDragReorder((from, to) => setDraft(d => { const ids = moveItem(widgets.map(w => w.id), from, to); let k = 0;
    return {...d, widgets:d.widgets.map(w => widgetOk(w.id) ? d.widgets.find(x => x.id === ids[k++]) : w)}; }));
  const group = (label, ids, labelOf) => !!ids.length && (
    <div key={label} style={{display:'flex', flexDirection:'column', gap:2, marginTop:6}}>
      <div style={{...settingsSectionLabel, padding:'8px 6px 4px'}}>{label}</div>
      {ids.map(id => <SettingsCheckRow key={id} label={labelOf(id)} checked={draft.kpis.includes(id)} onToggle={()=>toggleKpi(id)}/>)}
    </div>);
  return (
    <SettingsModalShell title="Layout Settings" sections={{kpis:'KPIs', widgets:'Widgets'}} order={[]} onReorder={()=>{}} fixed={['kpis', 'widgets']} section={section} onSection={setSection}
      onClose={onClose} onApply={()=>onApply(draft)}
      toolbar={section === 'kpis' ? <div style={{padding:'0 20px 10px', fontSize:12.5, color:T.attioMuted}}>{draft.kpis.length} of {MYDAY_KPI_MAX} selected</div> : null}>
      {section === 'kpis' ? [group('Today', MYDAY_METRICS.map(m => `day:${m.id}`), (id) => MYDAY_METRICS.find(m => m.id === id.slice(4)).label),
          ...DASH_KPI_GROUPS.map(g => group(g, kpiOffer.filter(id => (dashKpiDef(id.slice(4)) || {}).group === g), (id) => dashLabel(dashKpiDef(id.slice(4)), 'personal')))]
        : widgets.map((w, i) => { const d = MYDAY_WIDGETS.find(x => x.id === w.id);
          return <SettingsCheckRow key={w.id} label={d.label} checked={!w.hidden} drag={drag.props(i)} dragOver={drag.over === i}
            onToggle={()=>setDraft(c => ({...c, widgets:c.widgets.map(x => x.id === w.id ? {...x, hidden:!x.hidden} : x)}))}
            right={<span style={{fontSize:12, color:T.attioMuted, flexShrink:0}}>{dashColumns(d.width)}</span>}/>; })}
    </SettingsModalShell>
  );
}
/* ── Tagged Notes (2026-11-23) ── the notes and replies that tag the person and that they haven't
   opened yet (`openedAt` on their own mention), newest first. Opening one (the record, on its
   Notes) takes it off. The widget is hidden to start with and shows itself while there's something
   in it; hidden in Layout Settings, it stays away until someone tags them again. */
function myTaggedNotes(hub, me){
  const out = [], mine = (list) => (list || []).find(m => m.userId === me.id && !m.openedAt), time = (m, a) => new Date(m.at || a.at).getTime() || 0;
  hubActivities(hub, 'note').forEach(({object, record, act:a}) => {
    if(!toolCan(object, record, 'notes', 'view')) return;
    const m = mine(a.mentions);
    if(m) out.push({key:a.id, object, record, note:a, by:m.by || a.by || '', at:time(m, a), text:richTextPlain(a.body)});
    (a.replies || []).forEach(r => { const rm = mine(r.mentions); if(rm) out.push({key:`${a.id}:${r.id}`, object, record, note:a, reply:r, by:rm.by || r.by || '', at:time(rm, r), text:richTextPlain(r.body)}); });
  });
  return out.sort((x, y) => y.at - x.at);
}
function openTaggedNote(hub, me, x){
  const stamp = (list) => (list || []).map(m => m.userId === me.id && !m.openedAt ? {...m, openedAt:new Date().toISOString()} : m);
  hub.update(x.object, x.record.id, x.note.id, x.reply ? {replies:(x.note.replies || []).map(r => r.id === x.reply.id ? {...r, mentions:stamp(r.mentions)} : r)} : {mentions:stamp(x.note.mentions)});
  hub.openRecord(x.object, x.record.id, undefined, 'notes');
}
function MyDayTaggedNotes({hub, me, items}){
  return <MyDayList title="Tagged Notes" icon={MYDAY_ICONS.taggedNotes} items={items} textOf={(x) => `${x.record.name} ${x.by} ${x.text}`} empty="No tagged notes"
    row={(x) => <MyDayRow key={x.key} avatar={<RecordAvatar name={x.by || x.record.name} size={34}/>} name={x.record.name} onOpen={()=>openTaggedNote(hub, me, x)}
      lead={`${x.by || 'Someone'} tagged you${x.reply ? ' in a reply' : ''}`} sub={x.text} actions={[{icon:'notepad', label:'Open', onClick:()=>openTaggedNote(hub, me, x)}]}/>}/>;
}
function MyDayPage({hub}){
  const me = accessUser() || (hub.data.users || []).find(u => u.name === CURRENT_USER.name) || null;
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  if(!me) return null;
  const money = typeof accountingViewAny !== 'function' || accountingViewAny();
  const hasCommission = typeof commissionSlabs === 'function' && commissionSlabs(hub.data).length > 0;
  const widgetOk = (id) => { const d = MYDAY_WIDGETS.find(x => x.id === id); return !!d && (!d.money || money) && (id !== 'commission' || hasCommission); };
  const kpiOffer = myDayKpiOffer(), key = dashUserKey(me);
  const saved = myDayConfig((((hub.overviewSettings || {}).userMyDay) || {})[key], kpiOffer);
  /* Tagged Notes shows itself: while there's a tag to open — unless the person hid it since the
     latest one (`hiddenAt`). Layout Settings sees it as it is on the page. */
  const tagged = React.useMemo(() => myTaggedNotes(hub, me), [hub.activities, hub.records, me.id]);
  const tagRow = saved.widgets.find(w => w.id === 'taggedNotes') || {}, tagShown = tagged.length > 0 && (!tagRow.hidden || tagged.some(t => t.at > (tagRow.hiddenAt || 0)));
  const config = {...saved, widgets:saved.widgets.map(w => w.id === 'taggedNotes' ? {...w, hidden:!tagShown} : w)};
  const save = (c) => hub.setOverviewSettings(st => ({...(st || {}), userMyDay:{...((st || {}).userMyDay || {}), [key]:{...c,
    widgets:c.widgets.map(w => w.id !== 'taggedNotes' ? w : w.hidden ? {...w, hiddenAt: tagShown ? Date.now() : (tagRow.hiddenAt || 0)} : {id:w.id, hidden:false})}}}));
  const render = {timeClock:() => <DashTimeClock hub={hub}/>, myDay:() => <MyDayWidget hub={hub}/>, calendar:() => <MyDayCalendar hub={hub} me={me}/>, commission:() => <MyDayCommission hub={hub} me={me}/>,
    noResponse:() => <MyDayNoResponse hub={hub} me={me}/>, payments:() => <MyDayPayments hub={hub} me={me}/>, meetings:() => <MyDayMeetings hub={hub} me={me}/>,
    taggedNotes:() => <MyDayTaggedNotes hub={hub} me={me} items={tagged}/>};
  const items = config.widgets.filter(w => !w.hidden && widgetOk(w.id)).map(w => { const d = MYDAY_WIDGETS.find(x => x.id === w.id); return {id:d.id, width:d.width, label:d.label, render:render[d.id]}; });
  return (<>
    <div style={{display:'flex', alignItems:'center', gap:10}}>
      <span style={{flex:1, fontSize:13, color:T.attioMuted}}>{new Date().toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric'})}</span>
      <ViewSettingsButton onClick={()=>setSettingsOpen(true)}/>
    </div>
    <MyDayCounts hub={hub} me={me} shown={config.kpis}/>
    <DashWidgetGrid items={items} ctx={{}}/>
    {settingsOpen && <MyDaySettingsModal config={config} kpiOffer={kpiOffer} widgetOk={widgetOk} onClose={()=>setSettingsOpen(false)} onApply={(c)=>{ save(c); setSettingsOpen(false); }}/>}
  </>);
}

Object.assign(window, {myDaySampleLeads, leadStageByReach, leadTries, springProfile, springFit, leadFormIncomplete, myDayLists, MyDayWidget, MyDayPage, MyDayCallNext, myTaggedNotes, myDayCounts, myDayPayments, myDayDraft, myDayAgenda, myDayNoResponse, myDayConfig});
