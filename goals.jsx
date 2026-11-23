/* HOF Pulse ERP — Goals (Settings → CRM Settings → Goals): three goals — Cash Received, Deals
   Created and Daily Activity (2026-11-20) — each with targets for the company, each team and each
   user; the first two per period, Daily Activity per day.

   One Goals system, not target fields on users or teams: settings data `goals` —
     {period, company:{<period>: amount}, teams:{<teamId>: {<period>: amount}}, users:{<userId>: {<period>: amount}},
      deals:{company:{<period>: n}, teams:{<teamId>: {<period>: n}}, users:{<userId>: {<period>: n}}},
      activity:{company:{<metric>: n}, teams:{<teamId>: {<metric>: n}}, users:{<userId>: {<metric>: n}}}}
   The top-level company / teams / users are Cash Received (as saved before Deals Created came);
   `deals` holds the Deals Created targets in the same shape — a number of deals to create (owned
   by the team's or user's people, by created date) in the period, no currency. Both goals share
   `period` and the same inheritance (goalTargetsFrom). The page switches between them (UtTab strip).
   `period` is the one being viewed and reported (Daily, Weekly, Monthly, Quarterly, Yearly) —
   kept, so the page, the dashboard and each user's profile show the same period. A target is a
   Cash Received figure (payments recorded in Accounting, by payment date) for the current period
   of that kind (goalPeriodRange).
   Inheritance (goalTargets): a team with no target of its own is suggested an equal share of the
   company's (company ÷ teams); a user with none, an equal share of their team's (team ÷ its
   members). The suggestion fills the field (as its placeholder) until a figure is typed; a typed
   figure is that level's own and stays whatever the level above becomes; cleared, the suggestion
   returns. A team's users needn't add up to the team's target (over or under is allowed) — the
   page shows what is allocated. Higher levels never overwrite lower ones.
   Reporting: the dashboard's Target KPI and Goals widget (dashboard.jsx, with Cash Received: View
   Payment Terms) — by the dashboard's level: the company's, a team's or the person's own target —
   and each user's own target in their profile panel (UserGoalRow): Cash Received only. Deals
   Created is read through dealsGoalTargets(data, period) (goalTargets' structure) and
   dealsGoalTarget(data, {level:'company'|'team'|'user', id, period}) → the number or null (Reports).
   Daily Activity (`activity`, 2026-11-20): how many of each of five activities a person is to do
   in a day (DAY_ACTIVITY_METRICS: Calls only, since later the same day — it was five) — no
   period. Every figure is one person's for one day, at every level, so nothing is divided: a user
   with no figure of their own for a metric reads their team's, a team with none the company's (a
   user without a team: the company's), metric by metric (activityGoalTargets). Read through
   activityGoalTarget(data, {level:'company'|'team'|'user', id}) → {calls, connected, qualified,
   quotes, won}, each a number or null. The page shows the five figures in a row per level, the
   inherited one as the field's placeholder. Sample figures for the sample Employee:
   withSampleActivityGoals(data) (pure; the caller keeps the once-only flag).
   Access: Settings & Administration → Goals — View shows the page, Edit lets targets be set
   (usersTeams.jsx goalsCan). */

const GOAL_PERIODS = [
  {id:'daily', label:'Daily', now:'Today'}, {id:'weekly', label:'Weekly', now:'This week'}, {id:'monthly', label:'Monthly', now:'This month'},
  {id:'quarterly', label:'Quarterly', now:'This quarter'}, {id:'yearly', label:'Yearly', now:'This year'},
];
const goalPeriod = (id) => GOAL_PERIODS.find(p => p.id === id) || GOAL_PERIODS[2];
const goalsOf = (data) => ({period:'monthly', company:{}, teams:{}, users:{}, ...((data && data.goals) || {})});
// The Deals Created targets (goals.deals), in the same {company, teams, users} shape.
const goalDealsOf = (g) => ({company:{}, teams:{}, users:{}, ...((g && g.deals) || {})});
// The current period of a kind: today, this week (Monday to Sunday), this month, this quarter, this year.
function goalPeriodRange(period, now = new Date()){
  if(period === 'daily') return dashPeriodRange('today', now);
  if(period === 'weekly') return dashPeriodRange('week', now);
  if(period === 'quarterly'){ const q = Math.floor(now.getMonth() / 3) * 3; return [new Date(now.getFullYear(), q, 1).getTime(), new Date(now.getFullYear(), q + 3, 1).getTime()]; }
  if(period === 'yearly') return [new Date(now.getFullYear(), 0, 1).getTime(), new Date(now.getFullYear() + 1, 0, 1).getTime()];
  return dashPeriodRange('month', now);
}
const goalNum = (v) => v == null || v === '' || isNaN(v) ? null : Number(v);
const goalShare = (total, n) => total == null || !n ? null : Math.round(total / n * 100) / 100;
/* Every target for a period (the saved one unless given): the company's; each team's — its own
   ({own:true}), else its suggested share; each user's — their own, else their share of their
   team's (a user with no team has no suggestion). */
function goalTargets(data, period){
  const g = goalsOf(data);
  return goalTargetsFrom(g, data, period || g.period);
}
// The same for Deals Created (goals.deals): a number of deals per level, inherited the same way.
function dealsGoalTargets(data, period){
  const g = goalsOf(data);
  return goalTargetsFrom(goalDealsOf(g), data, period || g.period);
}
// One Deals Created target after inheritance — the company's, a team's or a user's — or null.
function dealsGoalTarget(data, {level, id, period} = {}){
  const t = dealsGoalTargets(data, period);
  if(level === 'team') return id == null ? null : t.teamTarget(id).value;
  if(level === 'user') return id == null ? null : t.userTarget(id).value;
  return t.company;
}
/* Daily Activity (goals.activity): a person's figures for a day, per metric. */
// One daily target since later on 2026-11-20: Calls. The day's other numbers are read out of the step before them
// (connected of the calls made, qualified of the connected … — myDay.jsx), so they have no target; ones saved earlier are left unread.
const DAY_ACTIVITY_METRICS = [{id:'calls', label:'Calls'}];
const goalActivityOf = (g) => ({company:{}, teams:{}, users:{}, ...((g && g.activity) || {})});
/* Every Daily Activity target, by metric id: the company's; a team's — its own ({own:true}), else
   the company's; a user's — their own, else their team's (without a team, the company's). Each is
   one person's figure for a day, so a level with none reads the level above as it is. */
function activityGoalTargets(data){
  const a = goalActivityOf(goalsOf(data)), users = ((data && data.users) || []).filter(u => u.status !== 'Deactivated');
  const own = (o, m) => goalNum((o || {})[m]);
  const companyTarget = (m) => { const v = own(a.company, m); return {value:v, own:v != null}; };
  const teamTarget = (tid, m) => { const v = own((a.teams || {})[tid], m); return v != null ? {value:v, own:true} : {value:companyTarget(m).value, own:false}; };
  const userTarget = (uid, m) => {
    const v = own((a.users || {})[uid], m);
    if(v != null) return {value:v, own:true};
    const u = users.find(x => x.id === uid);
    return {value: u && u.teamId ? teamTarget(u.teamId, m).value : companyTarget(m).value, own:false};
  };
  return {companyTarget, teamTarget, userTarget};
}
// One level's Daily Activity targets after inheritance: {calls, connected, qualified, quotes, won}, each a number or null.
function activityGoalTarget(data, {level, id} = {}){
  const t = activityGoalTargets(data);
  const read = (m) => level === 'team' ? (id == null ? null : t.teamTarget(id, m).value) : level === 'user' ? (id == null ? null : t.userTarget(id, m).value) : t.companyTarget(m).value;
  return Object.fromEntries(DAY_ACTIVITY_METRICS.map(m => [m.id, read(m.id)]));
}
/* The sample Employee's Daily Activity figures (Mustafa — usersTeams.jsx PERSONAS): added where he
   has none of his own; data without him is returned as it is. Pure — the caller runs it once. */
const SAMPLE_ACTIVITY_GOALS = {calls:40};
function withSampleActivityGoals(data){
  if(!((data && data.users) || []).some(u => u.id === 'mustafa')) return data;
  const g = data.goals || {}, a = g.activity || {}, users = a.users || {};
  const mine = Object.fromEntries(Object.entries(users.mustafa || {}).filter(([, v]) => goalNum(v) != null));
  return {...data, goals:{...g, activity:{...a, users:{...users, mustafa:{...SAMPLE_ACTIVITY_GOALS, ...mine}}}}};
}
// The targets in one goal's {company, teams, users} for period p.
function goalTargetsFrom(g, data, p){
  const teams = (data && data.teams) || [], users = ((data && data.users) || []).filter(u => u.status !== 'Deactivated');
  const company = goalNum((g.company || {})[p]);
  const members = (tid) => users.filter(u => u.teamId === tid);
  const teamTarget = (tid) => { const own = goalNum(((g.teams || {})[tid] || {})[p]); return own != null ? {value:own, own:true} : {value:goalShare(company, teams.length), own:false}; };
  const userTarget = (uid) => {
    const u = users.find(x => x.id === uid), own = goalNum(((g.users || {})[uid] || {})[p]);
    if(own != null) return {value:own, own:true};
    return {value: u && u.teamId ? goalShare(teamTarget(u.teamId).value, members(u.teamId).length) : null, own:false};
  };
  return {period:p, company, teams, users, members, teamTarget, userTarget};
}
// Cash Received in a range (the dashboard's records): everyone's, or the given users'.
const goalReceived = (dash, range, userIds) => ((dash && dash.people) || []).filter(p => !userIds || userIds.includes(p.id))
  .reduce((s, p) => s + p.ev.payments.filter(x => dashIn(x.at, range)).reduce((a, x) => a + (Number(x.amount) || 0), 0), 0);
// Deals Created in a range: the deals created by everyone, or by the given users (the deal's owner).
const goalDealsCreated = (dash, range, userIds) => ((dash && dash.people) || []).filter(p => !userIds || userIds.includes(p.id))
  .reduce((s, p) => s + p.ev.created.filter(x => dashIn(x.at, range)).length, 0);
const goalPct = (received, target) => target ? Math.round(received / target * 100) : null;
const fmtGoalPct = (pct) => pct == null ? '—' : `${pct}%`;
/* Whose target a dashboard level reads (dashboard.jsx levels): Personal — the person's own; Team —
   their team's (none without a team); else the company's. */
const goalLevel = ({level, userId, teamId}) => !userId || !level || level === 'company' ? 'company' : level;
const goalLevelTarget = (t, at) => { const l = goalLevel(at); return l === 'personal' ? t.userTarget(at.userId).value : l === 'team' ? (at.teamId ? t.teamTarget(at.teamId).value : null) : t.company; };
/* The target and progress for the dashboard's Target KPI (ctx: the dashboard's data — its level's
   records — and the settings data): the company's, the team's or the person's own, by level. */
function goalKpi(ctx){
  const t = goalTargets(ctx.settings), range = goalPeriodRange(t.period, new Date(ctx.data.now));
  const target = goalLevelTarget(t, ctx), received = goalReceived(ctx.data, range), pct = goalPct(received, target);
  return {target, received, pct, sub: target == null ? 'No target set' : `${fmtGoalPct(pct)} reached · ${goalPeriod(t.period).now}`};
}

/* ── Settings → Goals ── the goal (Cash Received / Deals Created / Daily Activity), the period
   (not for Daily Activity: its figures are per day), then the company's target, each team's with
   its users'. */
const GOAL_KINDS = [{id:'cash', label:'Cash Received'}, {id:'deals', label:'Deals Created'}, {id:'activity', label:'Daily Activity'}];
const goalInput = {...stInput, width:160, textAlign:'right', fontVariantNumeric:'tabular-nums'};
/* A target's field, in the default currency (Settings → Defaults) — Cash Received counts every
   payment converted to it. What's typed shows as typed while the field has focus (so "2500." can
   become 2500.50); the target is stored as a number. `count` (Deals Created, Daily Activity): a
   whole number, no currency. `width`: a narrower field (Daily Activity's five in a row);
   `invalid`: a red border (commission.jsx: a slab that can't be saved). */
function GoalTargetInput({target, ariaLabel, onChange, count, width = 160, invalid}){
  const [text, setText] = React.useState(null);
  return (
    <div style={{position:'relative', width}}>
      {!count && <span style={{position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:12, color:T.gray400, pointerEvents:'none'}}>{defaultCurrency()}</span>}
      <input value={text != null ? text : target.own ? target.value : ''} placeholder={target.value == null ? '0' : formatAmount(target.value)} inputMode={count ? 'numeric' : 'decimal'} aria-label={ariaLabel}
        onFocus={()=>setText(target.own ? String(target.value) : '')} onBlur={()=>setText(null)}
        onChange={e=>{ const v = e.target.value.replace(count ? /[^0-9]/g : /[^0-9.]/g, ''); setText(v); if(v === '' || Number.isFinite(Number(v))) onChange(v); }} style={{...goalInput, width, ...(count ? {} : {paddingLeft:44}), ...(invalid ? {border:`1px solid ${T.red}`} : {})}}/>
    </div>
  );
}
function GoalsSettings({data, setData}){
  const can = goalsCan('edit');
  const hub = useRecordHub();
  const dash = useDashBusinessData(hub);
  const {draft:g, set, actions} = useSettingsForm(goalsOf(data), v => setData(x => ({...x, goals:v})));
  // The goal shown: Cash Received (goals' own company / teams / users), Deals Created (goals.deals) or Daily Activity (goals.activity).
  const [kind, setKind] = React.useState('cash'), deals = kind === 'deals', activity = kind === 'activity';
  const src = deals ? goalDealsOf(g) : g;
  const t = deals ? dealsGoalTargets({...data, goals:g}, g.period) : goalTargets({...data, goals:g}, g.period), p = g.period;
  const range = goalPeriodRange(p, new Date(dash.now)), money = accountingViewAny();
  // One level's figure for the period: typed → its own; cleared → the suggestion again.
  const setAt = (level, id, v) => {
    const at = {[level]: id == null ? {...(src[level] || {}), [p]:v === '' ? undefined : Number(v)}
      : {...(src[level] || {}), [id]:{...((src[level] || {})[id] || {}), [p]:v === '' ? undefined : Number(v)}}};
    set(deals ? {deals:{...src, ...at}} : at);
  };
  const input = (level, id, target, ariaLabel) => (
    <GoalTargetInput key={`${kind}:${level}:${id}:${p}`} target={target} ariaLabel={ariaLabel} count={deals} onChange={(v)=>setAt(level, id, v)}/>
  );
  const fmtTarget = (n) => deals ? formatAmount(n || 0) : fmtMoney(n);
  const progress = (target, ids) => {
    if(deals){ const n = goalDealsCreated(dash, range, ids); return `${formatAmount(n)} · ${fmtGoalPct(goalPct(n, target))}`; }
    if(!money) return '—'; const r = goalReceived(dash, range, ids); return `${fmtMoney(r)} · ${fmtGoalPct(goalPct(r, target))}`;
  };
  /* Daily Activity (goals.activity): a level's five figures in its row, each typed → its own,
     cleared → the level above's again (the placeholder). */
  const act = activityGoalTargets({...data, goals:g});
  const setActivityAt = (level, id, metric, v) => {
    const a = goalActivityOf(g), at = (o) => ({...(o || {}), [metric]:v === '' ? undefined : Number(v)});
    set({activity:{...a, [level]: id == null ? at(a[level]) : {...(a[level] || {}), [id]:at((a[level] || {})[id])}}});
  };
  const activityCells = (level, id, name) => DAY_ACTIVITY_METRICS.map(m => (
    <div key={m.id} role="cell" style={cell}>
      <GoalTargetInput count width={88} target={level === 'company' ? act.companyTarget(m.id) : level === 'teams' ? act.teamTarget(id, m.id) : act.userTarget(id, m.id)}
        ariaLabel={`${name} ${m.label} target`} onChange={(v)=>setActivityAt(level, id, m.id, v)}/>
    </div>
  ));
  const cols = activity ? `minmax(140px, 1fr) repeat(${DAY_ACTIVITY_METRICS.length}, 112px)` : `minmax(0, 1fr) 200px 200px 220px`;
  const cell = {padding:'8px 12px', minWidth:0, display:'flex', alignItems:'center', fontSize:13, color:T.attioText, minHeight:46};
  const header = {...cell, padding:'8px 12px', fontSize:12.5, fontWeight:500, color:T.gray600, minHeight:0};
  // Money reads right-aligned (as every table).
  const num = {...cell, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap', justifyContent:'flex-end', textAlign:'right'};
  const row = (key, cells, style) => <div key={key} role="row" style={{display:'grid', gridTemplateColumns:cols, borderTop:`1px solid ${T.attioLine}`, ...style}}>{cells}</div>;
  const allocated = (ids, target) => { const sum = ids.reduce((s, uid) => s + (t.userTarget(uid).value || 0), 0); return target == null ? fmtTarget(sum) : `${fmtTarget(sum)} of ${fmtTarget(target)}`; };
  const table = (label, rows, key) => (
    <div key={key || label} role="table" aria-label={label} style={{border:`1px solid ${T.attioLine}`, borderRadius:8, overflow:'hidden'}}>
      <div role="row" style={{display:'grid', gridTemplateColumns:cols, background:T.headerBg}}>
        <div role="columnheader" style={header}>{label}</div>
        {activity ? DAY_ACTIVITY_METRICS.map(m => <div key={m.id} role="columnheader" style={header}>{m.label}</div>) : <>
          <div role="columnheader" style={header}>Target · {goalPeriod(p).now}</div>
          <div role="columnheader" style={{...header, justifyContent:'flex-end'}}>Allocated to Users</div><div role="columnheader" style={{...header, justifyContent:'flex-end'}}>{deals ? 'Created' : 'Received'}</div>
        </>}
      </div>
      {rows}
    </div>
  );
  const teamsWithUsers = [...t.teams.map(tm => ({id:tm.id, name:tm.name, users:t.members(tm.id)})), ...(t.users.some(u => !u.teamId) ? [{id:null, name:'No team', users:t.users.filter(u => !u.teamId)}] : [])];
  return (
    <SettingsPage actions={can && actions}>
      <ReadOnlySettings on={can}>
      <div style={{display:'flex', flexDirection:'column', gap:20}}>
        <div style={{display:'flex', gap:8, borderBottom:`1px solid ${T.borderStrong}`}}>
          {GOAL_KINDS.map(k => <UtTab key={k.id} label={k.label} active={kind === k.id} onClick={()=>setKind(k.id)}/>)}
        </div>
        {!activity && <StField label="Period" width={200} required><StSelect value={p} options={GOAL_PERIODS.map(x => ({value:x.id, label:x.label}))} onChange={v=>set({period:v})}/></StField>}
        {table('Company', row('company', <>
          <div role="cell" style={{...cell, fontWeight:500}}>{ACTIVE_CRM.name}</div>
          {activity ? activityCells('company', null, 'Company') : <>
            <div role="cell" style={cell}>{input('company', null, {value:t.company, own:t.company != null}, 'Company target')}</div>
            <div role="cell" style={num}>{allocated(t.users.map(u => u.id), t.company)}</div>
            <div role="cell" style={num}>{progress(t.company)}</div>
          </>}
        </>))}
        {teamsWithUsers.map(tm => table(tm.name, [
          ...(tm.id ? [row(tm.id, <>
            <div role="cell" style={{...cell, fontWeight:500}}>{tm.name}</div>
            {activity ? activityCells('teams', tm.id, tm.name) : <>
              <div role="cell" style={cell}>{input('teams', tm.id, t.teamTarget(tm.id), `${tm.name} target`)}</div>
              <div role="cell" style={num}>{allocated(tm.users.map(u => u.id), t.teamTarget(tm.id).value)}</div>
              <div role="cell" style={num}>{progress(t.teamTarget(tm.id).value, tm.users.map(u => u.id))}</div>
            </>}
          </>, {background:T.headerBg})] : []),
          ...tm.users.map(u => row(u.id, <>
            <div role="cell" style={{...cell, paddingLeft: tm.id ? 28 : 12}}>{u.name}</div>
            {activity ? activityCells('users', u.id, u.name) : <>
              <div role="cell" style={cell}>{input('users', u.id, t.userTarget(u.id), `${u.name} target`)}</div>
              <div role="cell" style={{...num, color:T.attioFaint}}>—</div>
              <div role="cell" style={num}>{progress(t.userTarget(u.id).value, [u.id])}</div>
            </>}
          </>)),
          ...(!tm.users.length ? [row('none', <div role="cell" style={{...cell, color:T.attioMuted, gridColumn:'1 / -1'}}>No users in this team</div>)] : []),
        ], tm.id || 'no-team'))}
      </div>
      </ReadOnlySettings>
    </SettingsPage>
  );
}
SETTINGS_PAGES['settings.goals'] = GoalsSettings;

/* ── Dashboard ── Goals widget: the company's progress, then each team's or each user's. */
function GoalBar({pct}){
  return (
    <div style={{height:6, borderRadius:9999, background:T.headerBg, overflow:'hidden', flex:1, minWidth:60}}>
      <div style={{width:`${Math.min(100, Math.max(0, pct || 0))}%`, height:'100%', borderRadius:9999, background: pct == null ? 'transparent' : pct >= 100 ? T.good : DASH_BLUE}}/>
    </div>
  );
}
/* The dashboard's Goals widget: the targets for the dashboard's range — Today daily, This Week
   weekly, This Month monthly (a custom range keeps the period set in Settings → Goals). */
const GOAL_PERIOD_OF_RANGE = {today:'daily', week:'weekly', month:'monthly'};
function GoalsWidget({data, settings, rangeId, onOpenUser, title = 'Goals', level, userId, teamId}){
  const [tab, setTab] = React.useState('teams');
  const t = goalTargets(settings, GOAL_PERIOD_OF_RANGE[rangeId]), range = goalPeriodRange(t.period, new Date(data.now));
  const line = (target, ids) => { const r = goalReceived(data, range, ids); return {received:r, target, pct:goalPct(r, target)}; };
  /* By level (`data` is the level's records): the company's progress, then each team's or each
     user's; the team's, then each of its members'; the person's own, alone. */
  const at = goalLevel({level, userId, teamId}), company = line(goalLevelTarget(t, {level, userId, teamId}));
  const userRows = (list) => list.map(u => ({id:u.id, name:u.name, user:true, ...line(t.userTarget(u.id).value, [u.id])}));
  const rows = at === 'personal' ? [] : at === 'team' ? userRows(teamId ? t.members(teamId) : []) : tab === 'teams'
    ? t.teams.map(tm => ({id:tm.id, name:tm.name, ...line(t.teamTarget(tm.id).value, t.members(tm.id).map(u => u.id))}))
    : userRows(t.users);
  const ranked = rows.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || a.name.localeCompare(b.name));
  // Ten at a glance; more get a search and the pager (dashboard.jsx useDashList).
  const page = useDashList(ranked, r => r.name, `${at}:${tab}:${rangeId}`);
  const noun = at === 'company' && tab === 'teams' ? 'teams' : 'users';
  return (
    <DashWidgetCard title={title} right={<span style={{fontSize:12.5, color:T.attioMuted}}>{goalPeriod(t.period).now}</span>}>
      <div style={{display:'flex', flexDirection:'column', gap:6, paddingBottom:8}}>
        <span style={{fontFamily:DASH_FIGURE_FONT, fontWeight:700, fontSize:44, lineHeight:1, color: company.target == null ? T.attioFaint : T.attioText, fontVariantNumeric:'tabular-nums'}}>{fmtGoalPct(company.pct)}</span>
        <span style={{fontSize:12.5, color:T.attioMuted, fontVariantNumeric:'tabular-nums'}}>{company.target == null ? (at === 'company' ? 'No company target set' : 'No target set') : `${fmtMoney(company.received)} of ${fmtMoney(company.target)}`}</span>
        <GoalBar pct={company.pct}/>
      </div>
      {at === 'company' && <div style={{display:'flex', gap:8, borderBottom:`1px solid ${T.borderStrong}`}}>
        {[['teams', 'Teams'], ['users', 'Users']].map(([id, label]) => <UtTab key={id} label={label} active={tab === id} onClick={()=>setTab(id)}/>)}
      </div>}
      {at !== 'personal' && page.long && <DashSearch value={page.query} onChange={page.setQuery} placeholder={`Search ${noun}`}/>}
      {at !== 'personal' && <div style={{display:'flex', flexDirection:'column', ...(at === 'team' ? {borderTop:`1px solid ${T.attioLine}`} : {})}}>
        {page.rows.map(r => (
          <div key={r.id} style={{display:'flex', alignItems:'center', gap:10, minHeight:44, borderBottom:`1px solid ${T.attioLine}`}}>
            <span style={{width:120, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flexShrink:0}}>
              {r.user ? <ContactName name={r.name} onOpen={()=>onOpenUser && onOpenUser(r.id)} style={{fontSize:13, fontWeight:500}}/> : <span style={{fontSize:13, fontWeight:500, color:T.attioText}}>{r.name}</span>}
            </span>
            <GoalBar pct={r.pct}/>
            <span title={r.target == null ? 'No target' : `${fmtMoney(r.received)} of ${fmtMoney(r.target)}`} style={{width:44, textAlign:'right', fontSize:12.5, color: r.target == null ? T.attioFaint : T.attioText, fontVariantNumeric:'tabular-nums', flexShrink:0}}>{fmtGoalPct(r.pct)}</span>
          </div>
        ))}
        {!ranked.length && <div style={{fontSize:13, color:T.attioMuted, padding:'14px 0'}}>No {at === 'team' ? 'users' : tab} yet.</div>}
        {page.q && !page.found.length && dashNoMatch(page.query)}
      </div>}
      {at !== 'personal' && page.pager}
    </DashWidgetCard>
  );
}
/* A user's own target and progress for the goal period — their profile panel's Statistics. */
function UserGoalRow({userId}){
  const hub = useRecordHub();
  const data = useDashBusinessData(hub);
  const t = goalTargets(hub && hub.data), target = t.userTarget(userId).value;
  const range = goalPeriodRange(t.period, new Date(data.now)), received = goalReceived(data, range, [String(userId)]);
  return (
    <div style={{display:'flex', alignItems:'center', gap:12, padding:'4px 0', borderBottom:`1px solid ${T.attioLine}`, minHeight:34}}>
      <span style={{flex:1, minWidth:0, fontSize:12.5, color:T.attioMuted}}>Target · {goalPeriod(t.period).now}</span>
      <span style={{fontSize:13, color: target == null ? T.attioFaint : T.attioText, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap'}}>
        {target == null ? 'No target' : `${fmtMoney(target)} · ${fmtGoalPct(goalPct(received, target))} reached`}</span>
    </div>
  );
}

Object.assign(window, {DAY_ACTIVITY_METRICS, activityGoalTargets, activityGoalTarget, withSampleActivityGoals, GoalTargetInput, GOAL_PERIODS, goalsOf, goalTargets, dealsGoalTargets, dealsGoalTarget, goalPeriodRange, goalReceived, goalDealsCreated, goalKpi, GoalsSettings, GoalsWidget, UserGoalRow});
