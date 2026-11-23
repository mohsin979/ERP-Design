/* HOF Pulse ERP — Commission (Settings → CRM Settings → Commission, 2026-11-20): one commission
   plan per CRM branch — slabs by the cash a person received in a calendar month, each slab with a
   percentage.

   Settings data `commission` — {slabs:[{from, rate}, …]}: `from` an amount of cash received in the
   month, in the default currency (Settings → Defaults); `rate` a percent. A branch with no slabs
   has no commission (the readers return null).
   The rule: the slab reached — the highest one whose `from` the month's cash has reached — gives
   its percentage on ALL of that month's cash, not only the part above the slab (not tax bands).
   The cash is the Cash Received goal's own figure for a user (goals.jsx goalReceived over the
   dashboard's records: payments recorded in Accounting, by payment date, on the plans of the
   records the user owns) for the calendar month — one cash calculation, not a second one here.
   Readers:
     commissionSlabs(data) → the slabs, sorted by `from` ([] when none).
     commissionFor(data, cash) → {rate, amount, next} — next: {at, rate, toGo} for the slab above,
       null at the top one; null when the branch has no plan.
     userMonthCash(dash, userId, now?) → the user's cash received this calendar month (`dash`: the
       dashboard's records — dashboard.jsx useDashBusinessData / a dashboard context's `data`).
     userCommission(data, dash, userId, now?) → {cash, rate, amount, next}, or null with no plan.
   The page: the slabs in a table — From (the goals' money field) and Rate (%) — Add Slab under it,
   a slab removed from its row. The first slab starts at 0 and stays; the others need a From of
   their own above 0 and a Rate from 0 to 100, else Save is disabled (a wrong figure is outlined
   in red). Rows keep their place while they're typed in and are sorted by From as they're saved.
   Cancel / Save as every settings form (useSettingsForm).
   Access: the Goals permission (Settings & Administration → Goals, usersTeams.jsx goalsCan) —
   View shows the page, Edit lets the slabs be changed; no permission of its own.
   Sample plan for the sample CRM: withSampleCommission(data) (pure; the caller keeps the
   once-only flag). */

// The slabs as saved, complete ones only, lowest first.
function commissionSlabs(data){
  const slabs = ((data && data.commission) || {}).slabs;
  return (Array.isArray(slabs) ? slabs : []).map(s => ({from:goalNum(s && s.from), rate:goalNum(s && s.rate)}))
    .filter(s => s.from != null && s.rate != null).sort((a, b) => a.from - b.from);
}
const commissionRound = (n) => Math.round(n * 100) / 100;
/* The commission on a month's cash: the slab reached gives its rate on all of it. `next`: the slab
   above — where it starts, its rate and how much cash is still to go. */
function commissionFor(data, cash){
  const slabs = commissionSlabs(data);
  if(!slabs.length) return null;
  const c = Number(cash) || 0, i = slabs.reduce((at, s, k) => c >= s.from ? k : at, -1);
  const rate = i < 0 ? 0 : slabs[i].rate, up = slabs[i + 1];
  return {rate, amount:commissionRound(c * rate / 100), next: up ? {at:up.from, rate:up.rate, toGo:commissionRound(up.from - c)} : null};
}
// A user's cash received in the calendar month of `now` (the dashboard's own "now" unless given) — the Cash Received goal's figure.
function userMonthCash(dash, userId, now){
  const at = now != null ? new Date(now) : new Date((dash && dash.now) || Date.now());
  return goalReceived(dash, goalPeriodRange('monthly', at), [String(userId)]);
}
function userCommission(data, dash, userId, now){
  const cash = userMonthCash(dash, userId, now), c = commissionFor(data, cash);
  return c && {cash, ...c};
}
// The sample CRM's plan: added to settings data that has no slabs; a plan already there is kept. Pure — the caller runs it once.
const SAMPLE_COMMISSION_SLABS = () => [{from:0, rate:4}, {from:50000, rate:6}, {from:100000, rate:8}, {from:150000, rate:10}];
function withSampleCommission(data){
  return commissionSlabs(data).length ? data : {...data, commission:{...((data && data.commission) || {}), slabs:SAMPLE_COMMISSION_SLABS()}};
}

/* ── Settings → Commission ── */
const commissionFilled = (v) => v !== '' && v != null && Number.isFinite(Number(v));
// A slab's From can be saved: the first is 0; another is above 0 and no other slab's.
const commissionFromOk = (slabs, i) => i === 0 || (commissionFilled(slabs[i].from) && Number(slabs[i].from) > 0 && !slabs.some((s, k) => k !== i && commissionFilled(s.from) && Number(s.from) === Number(slabs[i].from)));
const commissionRateOk = (s) => commissionFilled(s.rate) && Number(s.rate) >= 0 && Number(s.rate) <= 100;
// A slab's rate, in percent: as the target field (what's typed shows as typed while the field has focus).
function CommissionRateInput({value, ariaLabel, onChange, invalid}){
  const [text, setText] = React.useState(null);
  const shown = commissionFilled(value) ? String(value) : '';
  return (
    <div style={{position:'relative', width:120}}>
      <input value={text != null ? text : shown} placeholder="0" inputMode="decimal" aria-label={ariaLabel}
        onFocus={()=>setText(shown)} onBlur={()=>setText(null)}
        onChange={e=>{ const v = e.target.value.replace(/[^0-9.]/g, ''); setText(v); if(v === '' || Number.isFinite(Number(v))) onChange(v === '' ? '' : Number(v)); }}
        style={{...goalInput, width:120, paddingRight:30, ...(invalid ? {border:`1px solid ${T.red}`} : {})}}/>
      <span style={{position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', fontSize:12, color:T.gray400, pointerEvents:'none'}}>%</span>
    </div>
  );
}
function CommissionSettings({data, setData}){
  const can = goalsCan('edit');
  const sorted = (slabs) => slabs.map(s => ({from:Number(s.from), rate:Number(s.rate)})).sort((a, b) => a.from - b.from);
  const valid = (d) => d.slabs.every((s, i) => commissionFromOk(d.slabs, i) && commissionRateOk(s));
  // Saved sorted by From; the rows on the page take that order too.
  const {draft, set, actions} = useSettingsForm({slabs:commissionSlabs(data)}, v => { const slabs = sorted(v.slabs);
    setData(x => ({...x, commission:{...(x.commission || {}), slabs}})); set({slabs}); }, valid);
  const slabs = draft.slabs;
  const setSlab = (i, patch) => set({slabs:slabs.map((s, k) => k === i ? {...s, ...patch} : s)});
  const add = () => set({slabs:[...slabs, {from: slabs.length ? '' : 0, rate:''}]});
  const cols = '200px 160px 44px';
  const cell = {padding:'8px 12px', minWidth:0, display:'flex', alignItems:'center', fontSize:13, color:T.attioText, minHeight:46};
  const header = {...cell, fontSize:12.5, fontWeight:500, color:T.gray600, minHeight:0};
  return (
    <SettingsPage actions={can && actions}>
      <ReadOnlySettings on={can}>
      {!slabs.length ? <EmptyState title="No commission plan" action={can && <StCta icon="plus" label="Add Slab" onClick={add}/>}/> : (
        <div style={{display:'flex', flexDirection:'column', alignItems:'flex-start', gap:12}}>
          <div role="table" aria-label="Commission slabs" style={{border:`1px solid ${T.attioLine}`, borderRadius:8, overflow:'hidden'}}>
            <div role="row" style={{display:'grid', gridTemplateColumns:cols, background:T.headerBg}}>
              <div role="columnheader" style={header}>From<Req/></div><div role="columnheader" style={header}>Rate<Req/></div><div role="columnheader" style={header}/>
            </div>
            {slabs.map((s, i) => { const fromBad = commissionFilled(s.from) && !commissionFromOk(slabs, i), rateBad = commissionFilled(s.rate) && !commissionRateOk(s);
              return (
                <div key={i} role="row" style={{display:'grid', gridTemplateColumns:cols, borderTop:`1px solid ${T.attioLine}`}}>
                  <div role="cell" style={cell}>
                    {i === 0 ? <span style={{fontVariantNumeric:'tabular-nums'}}>{fmtMoney(Number(s.from) || 0)}</span>
                      : <GoalTargetInput target={{value:commissionFilled(s.from) ? Number(s.from) : null, own:commissionFilled(s.from)}} ariaLabel={`Slab ${i + 1} from`} invalid={fromBad}
                          onChange={(v)=>setSlab(i, {from: v === '' ? '' : Number(v)})}/>}
                  </div>
                  <div role="cell" style={cell}><CommissionRateInput value={s.rate} ariaLabel={`Slab ${i + 1} rate`} invalid={rateBad} onChange={(v)=>setSlab(i, {rate:v})}/></div>
                  <div role="cell" style={{...cell, padding:'8px 8px', justifyContent:'center'}}>
                    {can && i > 0 && <button type="button" title="Remove Slab" aria-label={`Remove slab ${i + 1}`} onClick={()=>set({slabs:slabs.filter((x, k) => k !== i)})}
                      style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', justifyContent:'center', padding:4}}><Icon name="trash" size={14} color={T.gray600}/></button>}
                  </div>
                </div>
              ); })}
          </div>
          {can && <button type="button" onClick={add} className={LINK_CLASS} style={{border:'none', background:'transparent', padding:0, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:500, color:T.attioText}}>Add Slab</button>}
        </div>
      )}
      </ReadOnlySettings>
    </SettingsPage>
  );
}
SETTINGS_PAGES['settings.commission'] = CommissionSettings;

Object.assign(window, {commissionSlabs, commissionFor, userMonthCash, userCommission, withSampleCommission, CommissionSettings});
