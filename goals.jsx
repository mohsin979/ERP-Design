/* HOF Pulse ERP — Goals (Settings → CRM Settings → Goals): Cash Received targets for the company,
   each team and each user, per period.

   One Goals system, not target fields on users or teams: settings data `goals` —
     {period, company:{<period>: amount}, teams:{<teamId>: {<period>: amount}}, users:{<userId>: {<period>: amount}}}
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
   Reporting: the dashboard's Company Target KPI and Goals widget (dashboard.jsx, with Cash
   Received: View Payment Terms), and each user's own target in their profile panel (UserGoalRow).
   Access: Settings & Administration → Goals — View shows the page, Edit lets targets be set
   (usersTeams.jsx goalsCan). */

const GOAL_PERIODS = [
  {id:'daily', label:'Daily', now:'Today'}, {id:'weekly', label:'Weekly', now:'This week'}, {id:'monthly', label:'Monthly', now:'This month'},
  {id:'quarterly', label:'Quarterly', now:'This quarter'}, {id:'yearly', label:'Yearly', now:'This year'},
];
const goalPeriod = (id) => GOAL_PERIODS.find(p => p.id === id) || GOAL_PERIODS[2];
const goalsOf = (data) => ({period:'monthly', company:{}, teams:{}, users:{}, ...((data && data.goals) || {})});
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
  const g = goalsOf(data), p = period || g.period;
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
const goalPct = (received, target) => target ? Math.round(received / target * 100) : null;
const fmtGoalPct = (pct) => pct == null ? '—' : `${pct}%`;
/* The company's target and progress for the dashboard's Company Target KPI (ctx: the dashboard's
   data and the settings data). */
function goalKpi(ctx){
  const t = goalTargets(ctx.settings), range = goalPeriodRange(t.period, new Date(ctx.data.now));
  const received = goalReceived(ctx.data, range), pct = goalPct(received, t.company);
  return {target:t.company, received, pct, sub: t.company == null ? 'No target set' : `${fmtGoalPct(pct)} reached · ${goalPeriod(t.period).now}`};
}

/* ── Settings → Goals ── the period, then the company's target, each team's with its users'. */
const goalInput = {...stInput, width:160, textAlign:'right', fontVariantNumeric:'tabular-nums'};
/* A target's field, in the default currency (Settings → Defaults) — Cash Received counts every
   payment converted to it. What's typed shows as typed while the field has focus (so "2500." can
   become 2500.50); the target is stored as a number. */
function GoalTargetInput({target, ariaLabel, onChange}){
  const [text, setText] = React.useState(null);
  return (
    <div style={{position:'relative', width:160}}>
      <span style={{position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:12, color:T.gray400, pointerEvents:'none'}}>{defaultCurrency()}</span>
      <input value={text != null ? text : target.own ? target.value : ''} placeholder={target.value == null ? '0' : formatAmount(target.value)} inputMode="decimal" aria-label={ariaLabel}
        onFocus={()=>setText(target.own ? String(target.value) : '')} onBlur={()=>setText(null)}
        onChange={e=>{ const v = e.target.value.replace(/[^0-9.]/g, ''); setText(v); if(v === '' || Number.isFinite(Number(v))) onChange(v); }} style={{...goalInput, paddingLeft:44}}/>
    </div>
  );
}
function GoalsSettings({data, setData}){
  const can = goalsCan('edit');
  const hub = useRecordHub();
  const dash = useDashBusinessData(hub);
  const {draft:g, set, actions} = useSettingsForm(goalsOf(data), v => setData(x => ({...x, goals:v})));
  const t = goalTargets({...data, goals:g}, g.period), p = g.period;
  const range = goalPeriodRange(p, new Date(dash.now)), money = accountingViewAny();
  // One level's figure for the period: typed → its own; cleared → the suggestion again.
  const setAt = (level, id, v) => set({[level]: id == null ? {...(g[level] || {}), [p]:v === '' ? undefined : Number(v)}
    : {...(g[level] || {}), [id]:{...((g[level] || {})[id] || {}), [p]:v === '' ? undefined : Number(v)}}});
  const input = (level, id, target, ariaLabel) => (
    <GoalTargetInput key={`${level}:${id}:${p}`} target={target} ariaLabel={ariaLabel} onChange={(v)=>setAt(level, id, v)}/>
  );
  const progress = (target, ids) => { if(!money) return '—'; const r = goalReceived(dash, range, ids); return `${fmtMoney(r)} · ${fmtGoalPct(goalPct(r, target))}`; };
  const cols = `minmax(0, 1fr) 200px 200px 220px`;
  const cell = {padding:'8px 12px', minWidth:0, display:'flex', alignItems:'center', fontSize:13, color:T.attioText, minHeight:46};
  const header = {...cell, padding:'8px 12px', fontSize:12.5, fontWeight:500, color:T.gray600, minHeight:0};
  const num = {...cell, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap'};
  const row = (key, cells, style) => <div key={key} role="row" style={{display:'grid', gridTemplateColumns:cols, borderTop:`1px solid ${T.attioLine}`, ...style}}>{cells}</div>;
  const allocated = (ids, target) => { const sum = ids.reduce((s, uid) => s + (t.userTarget(uid).value || 0), 0); return target == null ? fmtMoney(sum) : `${fmtMoney(sum)} of ${fmtMoney(target)}`; };
  const table = (label, rows, key) => (
    <div key={key || label} role="table" aria-label={label} style={{border:`1px solid ${T.attioLine}`, borderRadius:8, overflow:'hidden'}}>
      <div role="row" style={{display:'grid', gridTemplateColumns:cols, background:T.headerBg}}>
        <div role="columnheader" style={header}>{label}</div><div role="columnheader" style={header}>Target · {goalPeriod(p).now}</div>
        <div role="columnheader" style={header}>Allocated to users</div><div role="columnheader" style={header}>Received</div>
      </div>
      {rows}
    </div>
  );
  const teamsWithUsers = [...t.teams.map(tm => ({id:tm.id, name:tm.name, users:t.members(tm.id)})), ...(t.users.some(u => !u.teamId) ? [{id:null, name:'No team', users:t.users.filter(u => !u.teamId)}] : [])];
  return (
    <SettingsPage description="Cash Received targets for the company, each team and each user." actions={can && actions}>
      <ReadOnlySettings on={can}>
      <div style={{display:'flex', flexDirection:'column', gap:20}}>
        <StField label="Period" width={200}><StSelect value={p} options={GOAL_PERIODS.map(x => ({value:x.id, label:x.label}))} onChange={v=>set({period:v})}/></StField>
        {table('Company', row('company', <>
          <div role="cell" style={{...cell, fontWeight:500}}>{ACTIVE_CRM.name}</div>
          <div role="cell" style={cell}>{input('company', null, {value:t.company, own:t.company != null}, 'Company target')}</div>
          <div role="cell" style={num}>{allocated(t.users.map(u => u.id), t.company)}</div>
          <div role="cell" style={num}>{progress(t.company)}</div>
        </>))}
        {teamsWithUsers.map(tm => table(tm.name, [
          ...(tm.id ? [row(tm.id, <>
            <div role="cell" style={{...cell, fontWeight:500}}>{tm.name}</div>
            <div role="cell" style={cell}>{input('teams', tm.id, t.teamTarget(tm.id), `${tm.name} target`)}</div>
            <div role="cell" style={num}>{allocated(tm.users.map(u => u.id), t.teamTarget(tm.id).value)}</div>
            <div role="cell" style={num}>{progress(t.teamTarget(tm.id).value, tm.users.map(u => u.id))}</div>
          </>, {background:T.headerBg})] : []),
          ...tm.users.map(u => row(u.id, <>
            <div role="cell" style={{...cell, paddingLeft: tm.id ? 28 : 12}}>{u.name}</div>
            <div role="cell" style={cell}>{input('users', u.id, t.userTarget(u.id), `${u.name} target`)}</div>
            <div role="cell" style={num}/>
            <div role="cell" style={num}>{progress(t.userTarget(u.id).value, [u.id])}</div>
          </>)),
          ...(!tm.users.length ? [row('none', <div role="cell" style={{...cell, color:T.attioMuted, gridColumn:'1 / -1'}}>No users in this team.</div>)] : []),
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
function GoalsWidget({data, settings, rangeId, onOpenUser}){
  const [tab, setTab] = React.useState('teams');
  const t = goalTargets(settings, GOAL_PERIOD_OF_RANGE[rangeId]), range = goalPeriodRange(t.period, new Date(data.now));
  const line = (target, ids) => { const r = goalReceived(data, range, ids); return {received:r, target, pct:goalPct(r, target)}; };
  const company = line(t.company);
  const rows = tab === 'teams'
    ? t.teams.map(tm => ({id:tm.id, name:tm.name, ...line(t.teamTarget(tm.id).value, t.members(tm.id).map(u => u.id))}))
    : t.users.map(u => ({id:u.id, name:u.name, user:true, ...line(t.userTarget(u.id).value, [u.id])}));
  const ranked = rows.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || a.name.localeCompare(b.name));
  return (
    <DashWidgetCard title="Goals" right={<span style={{fontSize:12.5, color:T.attioMuted}}>{goalPeriod(t.period).now}</span>}>
      <div style={{display:'flex', flexDirection:'column', gap:6, paddingBottom:8}}>
        <span style={{fontFamily:DASH_FIGURE_FONT, fontWeight:700, fontSize:44, lineHeight:1, color: company.target == null ? T.attioFaint : T.attioText, fontVariantNumeric:'tabular-nums'}}>{fmtGoalPct(company.pct)}</span>
        <span style={{fontSize:12.5, color:T.attioMuted, fontVariantNumeric:'tabular-nums'}}>{company.target == null ? 'No company target set' : `${fmtMoney(company.received)} of ${fmtMoney(company.target)}`}</span>
        <GoalBar pct={company.pct}/>
      </div>
      <div style={{display:'flex', gap:8, borderBottom:`1px solid ${T.borderStrong}`}}>
        {[['teams', 'Teams'], ['users', 'Users']].map(([id, label]) => <UtTab key={id} label={label} active={tab === id} onClick={()=>setTab(id)}/>)}
      </div>
      <div style={{display:'flex', flexDirection:'column'}}>
        {ranked.map(r => (
          <div key={r.id} style={{display:'flex', alignItems:'center', gap:10, minHeight:44, borderBottom:`1px solid ${T.attioLine}`}}>
            <span style={{width:120, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flexShrink:0}}>
              {r.user ? <ContactName name={r.name} onOpen={()=>onOpenUser && onOpenUser(r.id)} style={{fontSize:13, fontWeight:500}}/> : <span style={{fontSize:13, fontWeight:500, color:T.attioText}}>{r.name}</span>}
            </span>
            <GoalBar pct={r.pct}/>
            <span title={r.target == null ? 'No target' : `${fmtMoney(r.received)} of ${fmtMoney(r.target)}`} style={{width:44, textAlign:'right', fontSize:12.5, color: r.target == null ? T.attioFaint : T.attioText, fontVariantNumeric:'tabular-nums', flexShrink:0}}>{fmtGoalPct(r.pct)}</span>
          </div>
        ))}
        {!ranked.length && <div style={{fontSize:13, color:T.attioMuted, padding:'14px 0'}}>No {tab} yet.</div>}
      </div>
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

Object.assign(window, {GOAL_PERIODS, goalsOf, goalTargets, goalPeriodRange, goalReceived, goalKpi, GoalsSettings, GoalsWidget, UserGoalRow});
