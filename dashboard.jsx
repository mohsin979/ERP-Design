/* HOF Pulse ERP — CRM Dashboard.

   Layout (each section its own component, so more can be added later):
     Greeting            — the time of day and the signed-in person; View Settings and the KPIs /
                           Graph switcher; under it, Ask Spring (the AI prompt box).
     KPIs                — Total Cash Invoiced (prominent), Received, Forecasted, Deals Closed — or
                           (Graph) a line graph of the three cash KPIs over the period.
     Key Indicators      — tabs: Revenue, Volume, Compliance, Speed (sales professionals ranked, a
                           table with column menus and pagination), Business Velocity, Deal Won, Deal Lost.
     Today's Tasks       — the signed-in person's tasks due today; each opens the task.
   One date filter (Today / This Week / This Month / Custom range) drives the KPIs, trends and Key
   Indicators.
   The same records give each user's statistics (USER_STATS): their profile panel's figures and
   trends, and workflows' User Properties (all-time).

   Data: the CRM's own records (dashBusinessData) — deals, their contacts and customers, their
   activity, Accounting and the workflow violations; each attributed to the deal's owner.
     Cash Received    payments recorded in Accounting, by payment date.
     Cash Invoiced    installments invoiced (their invoice date) — issuing isn't payment.
     Forecasted Cash  installments due in the period — expected, paid or not.
     Volume           deals that reached an outcome stage (Deal Won, Deal Lost — Actual Close Date —
                      or Postponed) in the period; Won and Lost of them.
     Compliance       the open workflow violations, by the owner of the violation's record, when raised.
     Speed            per deal closed in the period: Contact → Deal Closed (ranks; lowest first),
                      Contact → Deal, Contact → Customer (its customer created), Qualified Client →
                      Deal Won (days; deals start in Qualified Client).
     Velocity         deals created (Contact → Deal), deals won (Qualified Client → Deal Won), the
                      client's replies (an email received / call in, after the team's last email /
                      call out — Client Response Time), payments (Invoice to Cash: invoiced → paid). */

const DASH_PERIODS = [{id:'today', label:'Today'}, {id:'week', label:'This Week'}, {id:'month', label:'This Month'}];
const DASH_DAY = 864e5;

// The period's span: today; Monday to Sunday; the calendar month.
function dashPeriodRange(period, now = new Date()){
  const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if(period === 'today') return [d0.getTime(), d0.getTime() + DASH_DAY];
  if(period === 'week'){ const m = new Date(d0); m.setDate(d0.getDate() - ((d0.getDay() + 6) % 7)); return [m.getTime(), m.getTime() + 7 * DASH_DAY]; }
  return [new Date(now.getFullYear(), now.getMonth(), 1).getTime(), new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()];
}
const dashIn = (t, [a, b]) => t >= a && t < b;

/* ── The CRM's records, as the dashboard reads them ── per sales professional (a deal's owner):
   invoices, installments (due), payments, closed deals, deals created, the client's replies. */
const dashTime = (v) => { if(v == null || v === '') return null; if(typeof v === 'number') return v; const t = new Date(v).getTime(); return isNaN(t) ? null : t; };
const dashDayTime = (ymd, hour) => ymd ? dashTime(`${ymd}T${String(hour).padStart(2, '0')}:00:00`) : null;
function dashBusinessData({deals = [], customers = [], contacts = [], accounting = [], activities = {}, users = [], now = new Date()}){
  const people = new Map();
  const person = (ownerId) => {
    if(ownerId == null || ownerId === '') return null;
    if(!people.has(ownerId)){ const u = users.find(x => x.id === ownerId || x.name === ownerId); people.set(ownerId, {id:String(ownerId), name:u ? u.name : String(ownerId), ev:{invoices:[], installments:[], payments:[], closed:[], created:[], responses:[]}}); }
    return people.get(ownerId);
  };
  const contactById = new Map(contacts.map(c => [String(c.id), c]));
  const customerOfDeal = new Map(); customers.forEach(c => (c.dealIds || []).forEach(id => customerOfDeal.set(id, c)));
  const ownerOf = new Map([...deals, ...customers, ...contacts].map(r => [String(r.id), r.owner]));
  deals.forEach(d => {
    const p = person(d.owner); if(!p) return;
    const dc = d.createdAt || dashTime(d.created), c = contactById.get(String(d.contactId)), cc = c ? dashTime(c.created) : null;
    const days = (a, b) => a != null && b != null ? Math.max(0, (a - b) / DASH_DAY) : null;
    if(dc) p.ev.created.push({at:dc, contactToDeal:days(dc, cc)});
    const outcome = d.stage === 'deal-won' ? 'won' : d.stage === 'deal-lost' ? 'lost' : d.stage === 'postponed' ? 'postponed' : null;
    if(outcome){
      const at = dashTime(d.actualCloseDate) || d.stageEnteredAt || dc, cust = customerOfDeal.get(d.id);
      p.ev.closed.push({at, outcome, deal:{id:d.id, name:d.name}, contactToDeal:days(dc, cc), contactToClosed:days(at, cc),
        contactToCustomer: cust ? days(dashTime(cust.created), cc) : null, qualifiedToWon: outcome === 'won' ? days(at, dc) : null});
    }
    // The client's replies: an email received or a call in, after the team's last email or call out.
    let lastOut = null;
    [...((activities.deals || {})[d.id] || [])].sort((a, b) => dashTime(a.at) - dashTime(b.at)).forEach(a => {
      const t = dashTime(a.at);
      const out = (a.type === 'email' && a.direction === 'sent') || (a.type === 'call' && a.direction === 'outbound');
      const reply = (a.type === 'email' && a.direction === 'received') || (a.type === 'call' && a.direction === 'inbound');
      if(reply && lastOut != null && t > lastOut && t - lastOut < 14 * DASH_DAY){ p.ev.responses.push({at:t, hours:(t - lastOut) / 36e5}); lastOut = null; }
      if(out) lastOut = t;
    });
  });
  // Accounting: each installment invoiced, due and paid — the record's owner's.
  accounting.forEach(sched => {
    const p = person(ownerOf.get(String(sched.recordId))); if(!p) return;
    (sched.installments || []).forEach(i => {
      const invoicedAt = dashDayTime(i.invoicedAt, 10), due = dashDayTime(i.dueDate, 9);
      if(due != null) p.ev.installments.push({amount:i.amount, due});
      if(invoicedAt != null) p.ev.invoices.push({at:invoicedAt, amount:i.amount});
      (i.payments || []).forEach(pay => { const at = dashDayTime(pay.paidOn, 12); if(at != null) p.ev.payments.push({amount:Number(pay.amount) || 0, at, sent:invoicedAt}); });
    });
  });
  return {people:[...people.values()], now:now.getTime()};
}

/* ── Metrics ───────────────────────────────────────────────────────────────────────────── */
const dashSum = (xs, f) => xs.reduce((s, x) => s + f(x), 0);
// The average of the values there are (a deal with no customer has no Contact → Customer).
const dashAvg = (xs, f) => { const v = xs.map(f).filter(x => x != null && !isNaN(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };

function personMetrics(p, range){
  const closed = p.ev.closed.filter(x => dashIn(x.at, range));
  return {
    invoiced: dashSum(p.ev.invoices.filter(x => dashIn(x.at, range)), x => x.amount),
    received: dashSum(p.ev.payments.filter(x => dashIn(x.at, range)), x => x.amount),
    closed: closed.length, closedDeals: closed.map(x => x.deal).filter(Boolean),
    won: closed.filter(x => x.outcome === 'won').length, wonDeals: closed.filter(x => x.outcome === 'won').map(x => x.deal).filter(Boolean),
    lost: closed.filter(x => x.outcome === 'lost').length, lostDeals: closed.filter(x => x.outcome === 'lost').map(x => x.deal).filter(Boolean),
    contactToClosed: dashAvg(closed, x => x.contactToClosed), contactToDeal: dashAvg(closed, x => x.contactToDeal),
    contactToCustomer: dashAvg(closed, x => x.contactToCustomer), qualifiedToWon: dashAvg(closed, x => x.qualifiedToWon),
  };
}
/* ── A user's statistics ── the same records and rules as the dashboard, for one person (the
   owner of the deals, customers and contacts), over any range. One source for the user profile
   panel (its figures and trends) and for workflows' User Properties (all-time). `kind`: 'money'
   (sums, AED), 'count', 'days' / 'hours' (averages — empty when there's nothing to average). */
const USER_STATS = [
  {key:'invoiceCash',      label:'Total Invoice Cash',           kind:'money', accounting:true, read:(p, r) => dashSum(p.ev.invoices.filter(x => dashIn(x.at, r)), x => x.amount)},
  {key:'cashReceived',     label:'Total Cash Received',          kind:'money', accounting:true, read:(p, r) => dashSum(p.ev.payments.filter(x => dashIn(x.at, r)), x => x.amount)},
  {key:'cashForecasted',   label:'Total Cash Forecasted',        kind:'money', accounting:true, read:(p, r) => dashSum(p.ev.installments.filter(x => dashIn(x.due, r)), x => x.amount)},
  {key:'dealsCreated',     label:'Total Deals Created',          kind:'count', read:(p, r) => p.ev.created.filter(x => dashIn(x.at, r)).length},
  {key:'dealsClosed',      label:'Deals Closed',                 kind:'count', read:(p, r) => p.ev.closed.filter(x => dashIn(x.at, r)).length},
  {key:'dealsWon',         label:'Deal Won',                     kind:'count', read:(p, r) => p.ev.closed.filter(x => x.outcome === 'won' && dashIn(x.at, r)).length},
  {key:'dealsLost',        label:'Deal Lost',                    kind:'count', read:(p, r) => p.ev.closed.filter(x => x.outcome === 'lost' && dashIn(x.at, r)).length},
  {key:'contactToClosed',  label:'Contact to Deal Closed',       kind:'days',  read:(p, r) => dashAvg(p.ev.closed.filter(x => dashIn(x.at, r)), x => x.contactToClosed)},
  {key:'contactToDeal',    label:'Contact to Deal',              kind:'days',  read:(p, r) => dashAvg(p.ev.closed.filter(x => dashIn(x.at, r)), x => x.contactToDeal)},
  {key:'contactToCustomer',label:'Contact to Customer',          kind:'days',  read:(p, r) => dashAvg(p.ev.closed.filter(x => dashIn(x.at, r)), x => x.contactToCustomer)},
  {key:'qualifiedToWon',   label:'Qualified Client to Deal Won', kind:'days',  read:(p, r) => dashAvg(p.ev.closed.filter(x => dashIn(x.at, r)), x => x.qualifiedToWon)},
  {key:'responseTime',     label:'Client Response Time',         kind:'hours', read:(p, r) => dashAvg(p.ev.responses.filter(x => dashIn(x.at, r)), x => x.hours)},
  {key:'invoiceToCash',    label:'Invoice to Cash',              kind:'hours', accounting:true, read:(p, r) => dashAvg(p.ev.payments.filter(x => x.sent != null && dashIn(x.at, r)), x => Math.max(0, x.at - x.sent) / 36e5)},
];
const userStat = (key) => USER_STATS.find(s => s.key === key) || null;
const USER_STAT_ALL_TIME = [-Infinity, Infinity];
const NO_PERSON = {ev:{invoices:[], installments:[], payments:[], closed:[], created:[], responses:[]}};
// The person's events (dashBusinessData) — someone who owns nothing has none.
const userStatPerson = (data, userId) => (data.people || []).find(p => p.id === String(userId)) || NO_PERSON;
const userStatValue = (person, key, range) => { const s = userStat(key); return s ? s.read(person, range) : null; };
const fmtUserStat = (key, v) => { const s = userStat(key); if(!s || v == null) return '—';
  return s.kind === 'money' ? fmtMoney(v) : s.kind === 'count' ? Number(v).toLocaleString('en-US') : s.kind === 'days' ? fmtDays(v) : fmtHours(v); };
/* The dashboard's records from the workflow engine's live view (WF_LIVE), cached while those
   records, payments and activities stay the same — workflows read User Properties often. */
let USER_STATS_CACHE = null;
function liveUserStatsData(){
  const recs = WF_LIVE.records || [], accounting = WF_LIVE.accounting || [], acts = WF_LIVE.acts || {};
  const c = USER_STATS_CACHE;
  if(c && c.recs === recs && c.accounting === accounting && c.acts === acts) return c.data;
  const of = (o) => recs.filter(r => recordObjectOf(r.id) === o);
  const data = dashBusinessData({deals:of('deals'), customers:of('customers'), contacts:of('contacts'), accounting, activities:{deals:acts}, users:WF_LIVE.users || []});
  USER_STATS_CACHE = {recs, accounting, acts, data};
  return data;
}
// A user's statistics, all-time, as numbers (workflows' User Properties).
const userStatsAllTime = (userId) => { const p = userStatPerson(liveUserStatsData(), userId);
  return Object.fromEntries(USER_STATS.map(s => [s.key, s.read(p, USER_STAT_ALL_TIME)])); };

function companyKpis(data, range){
  const all = (k) => data.people.flatMap(p => p.ev[k]);
  return {
    received: dashSum(all('payments').filter(x => dashIn(x.at, range)), x => x.amount),
    invoiced: dashSum(all('invoices').filter(x => dashIn(x.at, range)), x => x.amount),
    forecast: dashSum(all('installments').filter(x => dashIn(x.due, range)), x => x.amount),
    closed: all('closed').filter(x => dashIn(x.at, range)).length,
    won: all('closed').filter(x => x.outcome === 'won' && dashIn(x.at, range)).length,
    lost: all('closed').filter(x => x.outcome === 'lost' && dashIn(x.at, range)).length,
  };
}
function companyVelocity(data, range){
  const all = (k) => data.people.flatMap(p => p.ev[k]);
  const paid = all('payments').filter(x => x.sent != null && dashIn(x.at, range));
  return {
    contactToDeal: dashAvg(all('created').filter(x => dashIn(x.at, range)), x => x.contactToDeal == null ? null : x.contactToDeal * 24),
    qualifiedToWon: dashAvg(all('closed').filter(x => x.outcome === 'won' && dashIn(x.at, range)), x => x.qualifiedToWon * 24),
    response: dashAvg(all('responses').filter(x => dashIn(x.at, range)), x => x.hours),
    invoiceToCash: dashAvg(paid, x => Math.max(0, x.at - x.sent) / 36e5),
  };
}

/* ── Formatting ─────────────────────────────────────────────────────────────────────────── */
// A duration in hours: minutes under an hour, hours under two days, else days.
const fmtHours = (h) => h == null ? '—' : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${Math.round(h)} h` : `${(h / 24).toFixed(1)} days`;
const fmtDays = (d) => d == null ? '—' : `${d.toFixed(1)} d`;

/* ── Pieces ─────────────────────────────────────────────────────────────────────────────── */
const dashCard = {background:'#fff', border:`1px solid ${T.attioLine}`, borderRadius:12};
const dashTitle = {fontSize:14, fontWeight:600, color:T.attioText};

const DASH_FILTERS = [...DASH_PERIODS, {id:'custom', label:'Custom'}];
// The filter's span: a period, or a custom range (from–to, both days included).
const dashRangeOf = (filter, now) => filter.id === 'custom' && fromYmd(filter.from) && fromYmd(filter.to)
  ? [fromYmd(filter.from).getTime(), fromYmd(filter.to).getTime() + DASH_DAY] : dashPeriodRange(filter.id === 'custom' ? 'month' : filter.id, now);

/* Today / This Week / This Month / Custom — the Form editor's segmented control; Custom shows a
   From – To pair of the CRM's date fields beside it. */
function DateFilter({value, onChange}){
  const seg = (o) => (
    <button key={o.id} type="button" role="radio" aria-checked={value.id === o.id} onClick={()=>onChange({...value, id:o.id})}
      style={{border:'none', cursor:'pointer', padding:'6px 14px', fontSize:12.5, fontWeight:500, fontFamily:'inherit', whiteSpace:'nowrap',
        background: value.id === o.id ? T.black : 'transparent', color: value.id === o.id ? '#fff' : T.gray600}}>{o.label}</button>
  );
  return (
    <div style={{display:'flex', alignItems:'center', gap:10, flexWrap:'wrap'}}>
      <div role="radiogroup" aria-label="Date range" style={{display:'inline-flex', border:`1px solid ${T.borderStrong}`, borderRadius:8, overflow:'hidden', background:'#fff', flexShrink:0}}>
        {DASH_FILTERS.map(seg)}
      </div>
      {value.id === 'custom' && (
        <div style={{display:'flex', alignItems:'center', gap:6}}>
          <div style={{width:140}}><DateField compact value={value.from} ariaLabel="From" placeholder="From" onChange={v=>onChange({...value, from:v})}/></div>
          <span style={{fontSize:12.5, color:T.attioMuted}}>–</span>
          <div style={{width:140}}><DateField compact value={value.to} ariaLabel="To" placeholder="To" onChange={v=>onChange({...value, to:v})}/></div>
        </div>
      )}
    </div>
  );
}

/* The KPIs (Figma reference): Total Cash Invoiced the prominent card — blue, about twice as wide;
   then Received, Forecasted, Deals Closed and Win Rate as light-grey cards — all the same height.
   Each: an icon chip and the label at the top, the figure (the Time Clock's Fira Sans Extra
   Condensed) low in the card with its unit under it. The cash KPIs' `accent` draws their line in
   the Graph view. */
const DASH_KPIS = [
  {key:'invoiced', label:'Total Cash Invoiced',   icon:'quote',    accent:'#3A5BF9', unit:'AED', hint:'Invoices issued in the period'},
  {key:'received', label:'Total Cash Received',   icon:'coins',    accent:'#1C1C1F', unit:'AED', hint:'Payments received in the period'},
  {key:'forecast', label:'Total Cash Forecasted', icon:'calendar', accent:'#A6A6AD', unit:'AED', hint:'Installments due in the period'},
];
/* Deals Closed shows its outcome split (Won / Lost) under the figure; Win Rate = Won ÷ (Won + Lost) × 100,
   whole percent (— when nothing was won or lost). */
const dashWinRate = (k) => k.won + k.lost ? Math.round(k.won / (k.won + k.lost) * 100) : null;
const DASH_CARDS = [...DASH_KPIS,
  {key:'closed', label:'Total Deals Closed', icon:'deals', hint:'Deals that reached an outcome in the period', sub:(k) => `${k.won} Won / ${k.lost} Lost`},
  {key:'winRate', label:'Win Rate', icon:'gauge', hint:'Deals won ÷ (deals won + deals lost)', suffix:'%', sub:() => 'Won ÷ (Won + Lost)'}];
const DASH_FIGURE_FONT = "'Fira Sans Extra Condensed', 'DM Sans', sans-serif";
const DASH_BLUE = '#3A5BF9';
/* A KPI figure counting up from zero to its value — on load and whenever the range changes
   (`replay`). Quick and eased (ease-out, ~0.7s); every frame is a whole number in the figure's own
   format, so separators never jump. Reduced motion: the value at once. */
function CountUp({value, replay, suffix = '', duration = 700}){
  const [v, setV] = React.useState(0);
  React.useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reduce || !value){ setV(value || 0); return; }
    // A ~60fps timer, not requestAnimationFrame — that pauses in background tabs and some frames,
    // which would leave the figure at 0; the timer always lands on the value.
    const t0 = performance.now();
    let timer;
    const step = () => { const p = Math.min(1, (performance.now() - t0) / duration); setV(value * (1 - Math.pow(1 - p, 3))); if(p < 1) timer = setTimeout(step, 16); };
    setV(0); timer = setTimeout(step, 16);
    return () => clearTimeout(timer);
  }, [value, replay]);
  return <>{formatAmount(Math.round(v))}{suffix}</>;
}

/* The prominent card's finish: a clearly visible film grain (fine SVG fractal noise) and a coarser,
   blotchy noise that warps the tone, over a blue bent by uneven light — bright at the top right, a
   soft sheen across the middle, deep at the bottom left. Texture only; the type sits on top, crisp. */
// Grey fractal noise; `contrast` (slope) pushes it toward hard light / dark specks.
const dashNoise = (freq, octaves, size, contrast = 1) => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='${octaves}' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3CfeComponentTransfer%3E%3CfeFuncR type='linear' slope='${contrast}' intercept='${(1 - contrast) / 2}'/%3E%3CfeFuncG type='linear' slope='${contrast}' intercept='${(1 - contrast) / 2}'/%3E%3CfeFuncB type='linear' slope='${contrast}' intercept='${(1 - contrast) / 2}'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
const DASH_GRAIN = dashNoise(1.3, 3, 200, 2);      // the fine grain — even and clearly visible
const DASH_WARP = dashNoise(.22, 2, 600, 1.3);     // a gentle tonal warp
const DASH_HERO_BG = ['radial-gradient(85% 75% at 92% 4%, #8FA3FF 0%, rgba(143,163,255,0) 60%)',
  'radial-gradient(70% 38% at 38% 46%, rgba(255,255,255,.14) 0%, rgba(255,255,255,0) 70%)',
  'radial-gradient(90% 85% at 2% 102%, #1631C4 0%, rgba(22,49,196,0) 64%)',
  'linear-gradient(160deg, #4466FF 0%, #3A5BF9 45%, #2F4EEA 100%)'].join(', ');

/* The prominent figure in premium silver: a brushed-metal gradient through the type (bright highlight,
   cool mid-greys, a second glint), lifted off the blue by a soft shadow. */
const DASH_SILVER = {
  backgroundImage:'linear-gradient(180deg, #FFFFFF 0%, #F3F5F9 38%, #DCE0E8 68%, #C4CAD5 100%)',
  WebkitBackgroundClip:'text', backgroundClip:'text', WebkitTextFillColor:'transparent', color:'transparent',
  filter:'drop-shadow(0 1px 2px rgba(10,20,90,.22))',
};

// Five cards in one row, all the same height: the blue hero twice the width of the others; labels,
// figures and units on the same lines across them (one vertical padding).
function FinancialKpis({kpis, replay}){
  const all = {...kpis, winRate:dashWinRate(kpis)};
  // The cash cards need View Payment Terms; without it only the deal cards show.
  const cards = accountingViewAny() ? DASH_CARDS : DASH_CARDS.filter(c => !DASH_KPIS.includes(c));
  return (
    <div style={{display:'flex', alignItems:'stretch', gap:14}}>
      {cards.map((t, i) => {
        const hero = i === 0 && accountingViewAny(), ink = hero ? '#fff' : '#111113';
        return (
          <div key={t.key} title={t.hint} style={{flex: hero ? '2 1 0' : '1 1 0', minWidth:0, minHeight:240, borderRadius:22,
            background: hero ? DASH_HERO_BG : '#F2F2F3', border:`1px solid ${hero ? DASH_BLUE : '#E4E4E7'}`, padding: hero ? '20px 24px 22px' : '20px 18px 22px',
            display:'flex', flexDirection:'column', position:'relative', overflow:'hidden', isolation:'isolate'}}>
            {hero && <>
              <div aria-hidden="true" style={{position:'absolute', inset:0, backgroundImage:DASH_WARP, backgroundSize:'600px 600px', mixBlendMode:'soft-light', opacity:.35, zIndex:-1, pointerEvents:'none'}}/>
              <div aria-hidden="true" style={{position:'absolute', inset:0, backgroundImage:DASH_GRAIN, backgroundSize:'200px 200px', mixBlendMode:'overlay', opacity:.5, zIndex:-1, pointerEvents:'none'}}/>
            </>}
            <span style={{display:'flex', alignItems:'flex-start', gap:8, fontSize: hero ? 14 : 13, fontWeight:500, color:ink, minWidth:0, lineHeight:'20px'}}>
              <span style={{width:20, height:20, borderRadius:6, background: hero ? '#fff' : DASH_BLUE, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                <Icon name={t.icon} size={11} color={hero ? DASH_BLUE : '#fff'}/>
              </span>
              {/* A label that doesn't fit wraps (narrow windows) rather than being cut. */}
              <span style={{minWidth:0, overflowWrap:'anywhere'}}>{t.label}</span>
            </span>
            <div style={{marginTop:'auto', paddingTop:28}}>
              <div style={{fontFamily:DASH_FIGURE_FONT, fontWeight:700, fontSize: hero ? 56 : 42, lineHeight:.95, color:ink, fontVariantNumeric:'tabular-nums', letterSpacing: hero ? -1.5 : -1,
                whiteSpace:'nowrap', ...(hero ? DASH_SILVER : {})}}>
                {all[t.key] == null ? '—' : <CountUp value={all[t.key] || 0} replay={replay} suffix={t.suffix}/>}
              </div>
              <div style={{fontSize:10.5, fontWeight:800, color:ink, letterSpacing:.7, marginTop:9, textTransform:'uppercase', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{t.sub ? t.sub(kpis) : t.unit}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* Ask Spring — the ERP home's prompt box, as the dashboard's entry point to Spring (the AI
   assistant): Spring's mark, a growing text area, and the ERP box's controls (attach, Auto, /, mic,
   send). Enter sends, Shift+Enter breaks the line. What Spring does with a question isn't defined
   yet: sending opens the placeholder. */
function SpringAsk({onAsk}){
  const [text, setText] = React.useState('');
  const [focus, setFocus] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => { const el = ref.current; if(el){ el.style.height = 'auto'; el.style.height = Math.min(160, el.scrollHeight) + 'px'; } }, [text]);
  const send = () => { if(!text.trim()) return; onAsk(text.trim()); setText(''); };
  const ctl = {width:32, height:32, borderRadius:8, border:'none', background:T.pageBg, display:'inline-flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:T.gray600, fontFamily:'inherit', flexShrink:0};
  const ready = !!text.trim();
  return (
    <div onClick={()=>ref.current && ref.current.focus()} style={{background:'#fff', borderRadius:18, border:`1px solid ${focus ? '#C9CCD3' : T.borderStrong}`,
      boxShadow: focus ? '0 0 0 4px rgba(58,91,249,.08), 0 8px 24px rgba(16,24,40,.06)' : '0 2px 10px rgba(16,24,40,.04)', padding:'18px 20px 12px', cursor:'text',
      transition:'border-color 140ms, box-shadow 140ms'}}>
      <div style={{display:'flex', alignItems:'flex-start', gap:12}}>
        <span style={{width:28, height:28, borderRadius:8, border:`1px solid ${T.borderStrong}`, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1}}>
          <img src="assets/brand/spring-logo.svg" alt="Spring" width={18} height={9} style={{display:'block'}}/>
        </span>
        <textarea ref={ref} rows={2} value={text} onChange={e=>setText(e.target.value)} onFocus={()=>setFocus(true)} onBlur={()=>setFocus(false)}
          onKeyDown={e=>{ if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); send(); } }}
          placeholder="Ask Spring what’s wrong and what can be improved in your business." aria-label="Ask Spring"
          style={{flex:1, minWidth:0, border:'none', outline:'none', resize:'none', background:'transparent', fontFamily:'inherit', fontSize:15, lineHeight:1.55, color:T.attioText, padding:'4px 0', minHeight:52}}/>
      </div>
      <div onClick={e=>e.stopPropagation()} style={{display:'flex', alignItems:'center', justifyContent:'flex-end', gap:8, paddingTop:10, marginTop:8, borderTop:`1px solid ${T.border}`}}>
        <button type="button" title="Attach" style={ctl}><Icon name="paperclip" size={16} color={T.gray600}/></button>
        <button type="button" style={{...ctl, width:64, gap:4, fontSize:13, color:T.gray800}}>Auto <Icon name="chevDown" size={T.chevronSize} color={T.gray600}/></button>
        <button type="button" style={ctl}>/</button>
        <button type="button" title="Speak" style={ctl}><Icon name="mic" size={15} color={T.gray600}/></button>
        <button type="button" title="Ask Spring" aria-label="Ask Spring" onClick={send} disabled={!ready}
          style={{...ctl, background: ready ? DASH_BLUE : T.blueLight, cursor: ready ? 'pointer' : 'default', transition:'background 140ms'}}>
          <Icon name="arrowUp" size={14} color={ready ? '#fff' : T.blue}/>
        </button>
      </div>
    </div>
  );
}

/* KPIs / Graph — the view switcher (top right): icon segments, the active one filled. */
function DashViewSwitch({value, onChange}){
  const opts = [{id:'kpis', icon:'dashboard', label:'KPIs'}, {id:'graph', icon:'analytical', label:'Graph'}];
  return (
    <div role="radiogroup" aria-label="Dashboard view" style={{display:'inline-flex', border:`1px solid ${T.borderStrong}`, borderRadius:8, overflow:'hidden', background:'#fff', flexShrink:0}}>
      {opts.map(o => {
        const on = value === o.id;
        return (
          <button key={o.id} type="button" role="radio" aria-checked={on} aria-label={o.label} title={o.label} onClick={()=>onChange(o.id)}
            style={{width:36, height:32, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', background: on ? T.black : 'transparent'}}>
            <Icon name={o.icon} size={14} color={on ? '#fff' : T.gray600}/>
          </button>
        );
      })}
    </div>
  );
}

/* View Trends: the three KPIs over the selected range as lines — by hour for a single day, by
   day up to two months, else by week. Hover reads a point's three values. */
// The range in steps — hours for a day, days up to two months, else weeks: [{at, end}], and the step.
function dashBuckets(range){
  const [a, b] = range, span = b - a;
  const step = span <= DASH_DAY ? 36e5 : span <= 62 * DASH_DAY ? DASH_DAY : 7 * DASH_DAY;
  const n = Math.max(1, Math.ceil(span / step));
  return {step, buckets:Array.from({length:n}, (_, i) => ({at:a + i * step, end:Math.min(b, a + (i + 1) * step)}))};
}
function dashTrendSeries(data, range){
  const [a, b] = range, {step, buckets:steps} = dashBuckets(range), n = steps.length;
  const buckets = steps.map(x => ({at:x.at, received:0, invoiced:0, forecast:0}));
  const put = (t, key, amount) => { if(t >= a && t < b) buckets[Math.min(n - 1, Math.floor((t - a) / step))][key] += amount; };
  data.people.forEach(p => {
    p.ev.invoices.forEach(x => put(x.at, 'invoiced', x.amount));
    p.ev.installments.forEach(x => put(x.due, 'forecast', x.amount));
    p.ev.payments.forEach(x => put(x.at, 'received', x.amount));
  });
  return {buckets, step};
}
const dashNiceMax = (v, empty = 1000) => { if(v <= 0) return empty; const p = Math.pow(10, Math.floor(Math.log10(v))); return [1, 2, 2.5, 5, 10].map(m => m * p).find(m => m >= v); };
const dashShort = (n) => n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(Math.round(n));
function TrendChart({data, range}){
  const {buckets, step} = dashTrendSeries(data, range);
  return (
    <div style={{...dashCard, borderRadius:22, padding:'20px 24px 16px'}}>
      <div style={{display:'flex', alignItems:'center', gap:18, flexWrap:'wrap', marginBottom:12}}>
        {DASH_KPIS.map(k => (
          <span key={k.key} style={{display:'flex', alignItems:'center', gap:8, fontSize:12.5, color:T.gray800}}>
            <span style={{width:10, height:10, borderRadius:3, background:k.accent}}/>{k.label}
          </span>
        ))}
      </div>
      <LineTrend buckets={buckets} step={step} lines={DASH_KPIS} fmt={formatAmount} ariaLabel="Cash trends"/>
    </div>
  );
}
/* The line graph itself (the dashboard's Graph view, and a user's statistic over time): `lines`
   [{key, label, accent}] read from each bucket; `fmt` formats a value in the tooltip; `axis` the
   axis labels (short amounts by default). An empty value (nothing to average) breaks the line. */
function LineTrend({buckets, step, lines, fmt, axis = dashShort, empty = 1000, height = 260, ariaLabel}){
  const ref = React.useRef(null);
  const [w, setW] = React.useState(800);
  const [hover, setHover] = React.useState(null);
  React.useEffect(() => { const el = ref.current; if(!el) return; const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); setW(el.clientWidth); return () => ro.disconnect(); }, []);
  const H = height, L = 48, R = 12, Tp = 12, B = 28, iw = Math.max(10, w - L - R), ih = H - Tp - B;
  const max = dashNiceMax(Math.max(0, ...buckets.flatMap(x => lines.map(k => x[k.key] || 0))), empty);
  const x = (i) => L + (buckets.length === 1 ? iw / 2 : i * iw / (buckets.length - 1)), y = (v) => Tp + ih - v / max * ih;
  const label = (t) => { const d = new Date(t); return step < DASH_DAY ? `${d.getHours()}:00` : `${DATE_MONTHS[d.getMonth()]} ${d.getDate()}`; };
  const every = Math.max(1, Math.ceil(buckets.length / 8));
  const onMove = (e) => { const r = e.currentTarget.getBoundingClientRect(); const i = Math.round((e.clientX - r.left - L) / (iw / Math.max(1, buckets.length - 1))); setHover(Math.max(0, Math.min(buckets.length - 1, i))); };
  // Each line in runs of the buckets that have a value.
  const runs = (k) => buckets.reduce((acc, bk, i) => { if(bk[k.key] == null){ acc.push([]); return acc; } acc[acc.length - 1].push(`${x(i)},${y(bk[k.key])}`); return acc; }, [[]]).filter(r => r.length);
  return (
      <div ref={ref} style={{position:'relative'}}>
        <svg width={w} height={H} onMouseMove={onMove} onMouseLeave={()=>setHover(null)} style={{display:'block'}} role="img" aria-label={ariaLabel}>
          {[0, .25, .5, .75, 1].map(f => (
            <g key={f}>
              <line x1={L} x2={L + iw} y1={y(max * f)} y2={y(max * f)} stroke={T.attioLine}/>
              <text x={L - 8} y={y(max * f) + 4} textAnchor="end" fontSize="11" fill={T.attioMuted}>{axis(max * f)}</text>
            </g>
          ))}
          {buckets.map((bk, i) => i % every === 0 && <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill={T.attioMuted}>{label(bk.at)}</text>)}
          {lines.map(k => runs(k).map((pts, j) => pts.length === 1
            ? <circle key={`${k.key}-${j}`} cx={pts[0].split(',')[0]} cy={pts[0].split(',')[1]} r="2.5" fill={k.accent}/>
            : <polyline key={`${k.key}-${j}`} fill="none" stroke={k.accent} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" points={pts.join(' ')}/>))}
          {hover != null && <line x1={x(hover)} x2={x(hover)} y1={Tp} y2={Tp + ih} stroke={T.borderStrong} strokeDasharray="3 3"/>}
          {hover != null && lines.filter(k => buckets[hover][k.key] != null).map(k => <circle key={k.key} cx={x(hover)} cy={y(buckets[hover][k.key])} r="3.5" fill="#fff" stroke={k.accent} strokeWidth="2"/>)}
        </svg>
        {hover != null && (
          <div style={{position:'absolute', top:4, left:Math.max(0, Math.min(x(hover) + 12, w - 220)), width:208, background:'#fff', border:`1px solid ${T.border}`, borderRadius:10,
            boxShadow:'0 4px 16px rgba(16,24,40,.12)', padding:'10px 12px', pointerEvents:'none', display:'flex', flexDirection:'column', gap:6}}>
            <span style={{fontSize:12, fontWeight:600, color:T.attioText}}>{label(buckets[hover].at)}{step === 7 * DASH_DAY ? ' (week)' : ''}</span>
            {lines.map(k => (
              <span key={k.key} style={{display:'flex', alignItems:'center', gap:8, fontSize:12}}>
                <span style={{width:8, height:8, borderRadius:2, background:k.accent}}/><span style={{flex:1, color:T.attioMuted}}>{k.label}</span>
                <span style={{color:T.attioText, fontVariantNumeric:'tabular-nums'}}>{buckets[hover][k.key] == null ? '—' : fmt(buckets[hover][k.key])}</span>
              </span>
            ))}
          </div>
        )}
      </div>
  );
}

/* Key Indicators tabs: the columns and how the ranking reads. `best`: which end is first
   ('high' = most first, 'low' = least first). Rows without a value (no closed deals) sit last. */
const FAME_TABS = [
  {id:'revenue', label:'Revenue', rankBy:'invoiced', best:'high', columns:[
    {key:'invoiced', label:'Total Cash Invoiced', fmt:fmtMoney}, {key:'received', label:'Total Cash Received', fmt:fmtMoney}]},
  // Volume: deals closed (reached an outcome), and of them Won and Lost — each count opens its deals; any column sorts.
  {id:'volume', label:'Volume', rankBy:'closed', best:'high', columns:[
    {key:'closed', label:'Deals Closed', fmt:(n)=>String(n), render:(r, ctx) => <DealCountMenu deals={r.closedDeals} count={r.closed} onOpen={ctx.openDeal}/>},
    {key:'won', label:'Deal Won', fmt:(n)=>String(n), render:(r, ctx) => <DealCountMenu deals={r.wonDeals} count={r.won} onOpen={ctx.openDeal}/>},
    {key:'lost', label:'Deal Lost', fmt:(n)=>String(n), render:(r, ctx) => <DealCountMenu deals={r.lostDeals} count={r.lost} onOpen={ctx.openDeal}/>}]},
  {id:'compliance', label:'Compliance', rankBy:'violations', best:'low', columns:[{key:'violations', label:'Violations', fmt:(n)=>String(n),
    render:(r, ctx) => <ViolationsValue list={r.violationList} onOpen={ctx.openViolation}/>}]},
  {id:'speed', label:'Speed', rankBy:'contactToClosed', best:'low', wide:true, columns:[
    {key:'contactToClosed', label:'Contact to Deal Closed', fmt:fmtDays}, {key:'contactToDeal', label:'Contact to Deal', fmt:fmtDays},
    {key:'contactToCustomer', label:'Contact to Customer', fmt:fmtDays}, {key:'qualifiedToWon', label:'Qualified Client to Deal Won', fmt:fmtDays}]},
];

/* The tab's rows for the period, sorted by `sort` ({key, dir}); rows without a value in the sorted
   column (Speed: no closed deals) always sit last, unranked. # is the position in that order —
   the ranking follows whichever column is sorted. */
function fameRows(data, range, sort, violations = []){
  const rows = data.people.map(p => {
    const mine = violations.filter(v => v.owner === p.name && dashIn(v.at, range));
    return {id:p.id, name:p.name, ...personMetrics(p, range), violations:mine.length, violationList:mine};
  });
  const v = (r) => r[sort.key];
  const cmp = sort.key === 'name' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => v(a) - v(b);
  const valued = rows.filter(r => v(r) != null).sort((a, b) => (sort.dir === 'asc' ? cmp(a, b) : cmp(b, a)) || a.name.localeCompare(b.name));
  const none = rows.filter(r => v(r) == null).sort((a, b) => a.name.localeCompare(b.name));
  return [...valued.map((r, i) => ({...r, rank:i + 1})), ...none.map(r => ({...r, rank:null}))];
}
// The tab's ranking: its ranking column, best first.
const fameDefaultSort = (tab) => ({key:tab.rankBy, dir: tab.best === 'high' ? 'desc' : 'asc'});
const fameColumns = (tab) => [{key:'name', label:'Sales Professional', name:true}, ...tab.columns];

/* A count that opens a list — the association dropdown's menu (MenuShell / MenuItem), placed over
   the page so the table's scroll area doesn't clip it; picking an item opens it. `labelOf` / `icon`:
   each item's text and icon. */
function CountMenu({items, count, labelOf, icon, title, onOpen}){
  const [pos, setPos] = React.useState(null);   // {left, top, up}
  if(!count || !items.length) return <span>{count}</span>;
  const open = (e) => { const r = e.currentTarget.getBoundingClientRect(); const up = r.bottom + 16 + items.length * 34 > window.innerHeight;
    setPos(p => p ? null : {left:r.right, top: up ? r.top : r.bottom, up}); };
  return (<>
    <button type="button" onClick={open} aria-expanded={!!pos} title={title}
      style={{border:'none', background:'transparent', padding:0, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:'inherit', color:T.attioBlue,
              display:'inline-flex', alignItems:'center', gap:3, fontVariantNumeric:'tabular-nums'}}>
      {count}<Icon name="chevDown" size={T.chevronSize} color={T.attioBlue}/>
    </button>
    {pos && ReactDOM.createPortal(
      <div style={{position:'fixed', left:pos.left, top:pos.top, width:0, height:0, zIndex:110, textAlign:'left'}}>
        <MenuShell open onClose={()=>setPos(null)} anchorRight up={pos.up} width={300}>
          {items.map((x, i) => <MenuItem key={`${x.id}-${i}`} icon={icon} label={labelOf(x)} onClick={()=>{ setPos(null); onOpen(x); }}/>)}
        </MenuShell>
      </div>, document.body)}
  </>);
}
// Volume: the deals closed — picking one opens the deal.
const DealCountMenu = ({deals, count, onOpen}) => <CountMenu items={deals} count={count} title={`${count} deals`} labelOf={d => d.name}
  icon={<Icon name="deals" size={14} color={T.gray600}/>} onOpen={onOpen}/>;
/* Compliance: none — 0; one — the violation itself (workflow · record); more — the count, opening
   the list. Picking one opens it in Workflow Violations. */
const violationLabel = (v) => `${v.rule} · ${v.recordName}`;
function ViolationsValue({list, onOpen}){
  if(!list.length) return <span>0</span>;
  if(list.length === 1) return (
    <button type="button" onClick={()=>onOpen(list[0])} title={violationLabel(list[0])}
      style={{border:'none', background:'transparent', padding:0, cursor:'pointer', fontFamily:'inherit', fontSize:13, color:T.attioBlue, maxWidth:'100%',
              display:'inline-flex', alignItems:'center', gap:6, minWidth:0}}>
      <Icon name="warning" size={13} color={T.red}/>
      <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{violationLabel(list[0])}</span>
    </button>
  );
  return <CountMenu items={list} count={list.length} title={`${list.length} violations`} labelOf={violationLabel}
    icon={<Icon name="warning" size={14} color={T.red}/>} onOpen={onOpen}/>;
}

/* The Key Indicators table — the CRM table's header menu (Move column left / right, Sort ascending /
   descending) on every column, and its pagination. Ten rows a page in a fixed-height body, so
   paging never resizes the dashboard; Speed's columns scroll sideways inside the card. */
const FAME_PAGE = 10, FAME_ROW_H = 42;
function FameTable({tab, rows, order, sort, onSort, onMove, onOpenUser, onOpenDeal, onOpenViolation}){
  const [hover, setHover] = React.useState(null);
  const byKey = Object.fromEntries(fameColumns(tab).map(c => [c.key, c]));
  const cols = order.map(k => byKey[k]).filter(Boolean);
  const grid = `36px ${cols.map(c => c.name ? 'minmax(170px, 1.4fr)' : tab.wide ? 'minmax(160px, 1fr)' : 'minmax(130px, 1fr)').join(' ')}`;
  const right = (c) => !c.name;
  return (
    <div style={{overflowX:'auto'}}>
      <div style={{minWidth: tab.wide ? 860 : 0}}>
        <div style={{display:'grid', gridTemplateColumns:grid, gap:12, alignItems:'center', padding:'0 4px', height:34, borderBottom:`1px solid ${T.attioLine}`}}>
          <span style={{fontSize:12, color:T.attioMuted}}>#</span>
          {cols.map((c, i) => {
            const sorted = sort.key === c.key;
            return (
              <div key={c.key} onMouseEnter={()=>setHover(c.key)} onMouseLeave={()=>setHover(null)}
                style={{display:'flex', alignItems:'center', gap:4, minWidth:0, justifyContent: right(c) ? 'flex-end' : 'flex-start'}}>
                <span style={{fontSize:12, color: sorted ? T.attioText : T.attioMuted, fontWeight: sorted ? 600 : 400, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{c.label}</span>
                {sorted && <Icon name={sort.dir === 'asc' ? 'arrowUp' : 'arrowDown'} size={11} color={T.attioText}/>}
                <ThreeDotMenu visible={hover === c.key} align={i === cols.length - 1 ? 'right' : 'left'}
                  onMoveLeft={()=>onMove(c.key, -1)} onMoveRight={()=>onMove(c.key, 1)}
                  onSortAsc={()=>onSort({key:c.key, dir:'asc'})} onSortDesc={()=>onSort({key:c.key, dir:'desc'})}/>
              </div>
            );
          })}
        </div>
        <div style={{minHeight: FAME_PAGE * FAME_ROW_H}}>
          {rows.map(r => (
            <div key={r.id} style={{display:'grid', gridTemplateColumns:grid, gap:12, alignItems:'center', padding:'0 4px', height:FAME_ROW_H, borderBottom:`1px solid ${T.attioLine}`}}>
              <span style={{fontSize:12.5, fontWeight:600, color: r.rank && r.rank <= 3 ? T.attioText : T.attioMuted, fontVariantNumeric:'tabular-nums'}}>{r.rank || '—'}</span>
              {cols.map(c => c.name ? (
                <span key={c.key} style={{display:'flex', alignItems:'center', gap:8, minWidth:0}}>
                  <Avatar name={r.name} size={24}/>
                  <span style={{minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}><OwnerLink name={r.name} onOpen={()=>onOpenUser(r.name)}/></span>
                </span>
              ) : (
                <span key={c.key} style={{fontSize:13, fontVariantNumeric:'tabular-nums', textAlign:'right', whiteSpace:'nowrap',
                  fontWeight: sort.key === c.key ? 600 : 400, color: r[c.key] == null ? T.attioFaint : T.attioText}}>{c.render ? c.render(r, {openDeal:onOpenDeal, openViolation:onOpenViolation}) : c.fmt(r[c.key])}</span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Key Indicators: the ranking tabs (Revenue / Volume / Compliance / Speed — each keeps its own sort
   and column order, opening on its ranking), then Business Velocity, Deal Won and Deal Lost — all for
   the selected range. */
const KI_TABS = [...FAME_TABS.map(t => ({id:t.id, label:t.label})), {id:'velocity', label:'Business Velocity'}, {id:'won', label:'Deal Won'}, {id:'lost', label:'Deal Lost'}];
function KeyIndicators({data, range, rangeKey, deals, violations, onOpenUser, onOpenDeal, onOpenViolation}){
  // Revenue (cash) needs View Payment Terms; without it Volume leads.
  const [tabId, setTabId] = React.useState(() => accountingViewAny() ? 'revenue' : 'volume');
  const [query, setQuery] = React.useState('');
  const [sorts, setSorts] = React.useState({});
  const [orders, setOrders] = React.useState({});
  const [page, setPage] = React.useState(1);
  const tab = FAME_TABS.find(t => t.id === tabId) || null;   // a ranking tab, or null (Velocity / Won / Lost)
  const sort = tab ? sorts[tabId] || fameDefaultSort(tab) : {key:'', dir:''};
  const order = tab ? orders[tabId] || fameColumns(tab).map(c => c.key) : [];
  // Search narrows the list; each person keeps their rank.
  const q = query.trim().toLowerCase();
  const rows = tab ? fameRows(data, range, sort, violations).filter(r => !q || r.name.toLowerCase().includes(q)) : [];
  const pages = Math.max(1, Math.ceil(rows.length / FAME_PAGE));
  const at = Math.min(page, pages);
  React.useEffect(() => { setPage(1); }, [tabId, rangeKey, sort.key, sort.dir, q]);
  const move = (key, d) => setOrders(o => { const cur = o[tabId] || fameColumns(tab).map(c => c.key); const i = cur.indexOf(key);
    return i + d < 0 || i + d >= cur.length ? o : {...o, [tabId]:moveItem(cur, i, i + d)}; });
  const now = new Date(data.now);
  return (
    <section style={{...dashCard, borderRadius:22, display:'flex', flexDirection:'column', minWidth:0}}>
      <div style={{padding:'20px 24px 0', display:'flex', flexDirection:'column', gap:12}}>
        <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', minHeight:32}}>
          <span style={{...dashTitle, fontSize:15, flex:1}}>Key Indicators</span>
          {tab && <div style={{position:'relative', width:'min(240px, 100%)'}}>
            <div style={{position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', display:'flex'}}><Icon name="search" size={13} color={T.gray400}/></div>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search" aria-label="Search sales professionals"
              style={{width:'100%', height:32, padding:'0 10px 0 28px', fontSize:12.5, fontFamily:'inherit', color:T.attioText, border:`1px solid ${T.borderStrong}`, borderRadius:8, background:'#fff', outline:'none'}}/>
          </div>}
        </div>
        <div style={{display:'flex', alignItems:'flex-end', gap:4, flexWrap:'wrap', borderBottom:`1px solid ${T.attioLine}`}}>
          {KI_TABS.filter(t => t.id !== 'revenue' || accountingViewAny()).map(t => <UtTab key={t.id} label={t.label} active={t.id === tabId} onClick={()=>setTabId(t.id)}/>)}
        </div>
        {tab && <FameTable tab={tab} rows={rows.slice((at - 1) * FAME_PAGE, at * FAME_PAGE)} order={order} sort={sort}
          onSort={(s)=>setSorts(x => ({...x, [tabId]:s}))} onMove={move} onOpenUser={onOpenUser} onOpenDeal={onOpenDeal} onOpenViolation={onOpenViolation}/>}
        {tab && q && !rows.length && <div style={{fontSize:13, color:T.attioMuted, padding:'0 4px 12px'}}>No sales professional matches “{query.trim()}”.</div>}
        {tabId === 'velocity' && <VelocityList velocity={companyVelocity(data, range)}/>}
        {tabId === 'won' && <DealOutcomeList deals={deals} stage="deal-won" tone={T.good} range={range} now={now} onOpen={onOpenDeal}/>}
        {tabId === 'lost' && <DealOutcomeList deals={deals} stage="deal-lost" tone={T.red} range={range} now={now} onOpen={onOpenDeal}/>}
      </div>
      {tab ? <Pagination page={at} totalPages={pages} onChange={setPage} totalRows={rows.length} noun="sales professional"/> : <div style={{height:16}}/>}
    </section>
  );
}

// Business Velocity: company-wide average durations for the range.
function VelocityList({velocity}){
  const rows = [
    {key:'contactToDeal', label:'Contact to Deal', icon:'contacts', hint:'Average time from first contact to deal creation'},
    {key:'qualifiedToWon', label:'Qualified Client to Deal Won', icon:'deals', hint:'Average time from Qualified Client to the deal won'},
    {key:'response', label:'Client Response Time', icon:'envelope', hint:'Average time for a client to reply to a call or email'},
    {key:'invoiceToCash', label:'Invoice to Cash', icon:'coins', hint:'Average time from an installment sent to it paid'},
  ];
  return (
    <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap:12, padding:'4px 0 8px'}}>
      {rows.map(r => (
        <div key={r.key} title={r.hint} style={{border:`1px solid ${T.attioLine}`, borderRadius:12, padding:'16px 18px', display:'flex', flexDirection:'column', gap:14}}>
          <span style={{display:'flex', alignItems:'center', gap:10, fontSize:13, color:T.attioMuted}}>
            <span style={{width:28, height:28, borderRadius:8, background:T.headerBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
              <Icon name={r.icon} size={14} color={T.attioMuted}/>
            </span>{r.label}
          </span>
          <span style={{fontFamily:DASH_FIGURE_FONT, fontWeight:700, fontSize:30, lineHeight:1, color: velocity[r.key] == null ? T.attioFaint : T.attioText, fontVariantNumeric:'tabular-nums'}}>{fmtHours(velocity[r.key])}</span>
        </div>
      ))}
    </div>
  );
}

/* Deal Won / Deal Lost: the deals that reached that outcome in the range (Actual Close Date) — the
   count, then each deal by name; picking one opens it. */
function DealOutcomeList({deals, stage, tone, range, now, onOpen}){
  const list = deals.filter(d => d.stage === stage).map(d => ({...d, at:dashTime(d.actualCloseDate) || d.stageEnteredAt})).filter(d => d.at != null && dashIn(d.at, range))
    .sort((a, b) => b.at - a.at);
  return (
    <div style={{display:'flex', flexDirection:'column', paddingBottom:4}}>
      <span style={{fontFamily:DASH_FIGURE_FONT, fontWeight:700, fontSize:44, lineHeight:1, color: list.length ? tone : T.attioFaint, padding:'4px 0 14px', fontVariantNumeric:'tabular-nums'}}>{list.length}</span>
      {list.map(d => (
        <div key={d.id} style={{display:'flex', alignItems:'center', gap:10, minHeight:44, borderTop:`1px solid ${T.attioLine}`}}>
          <Icon name="deals" size={14} color={T.attioMuted}/>
          <span style={{minWidth:0, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
            <ContactName name={d.name} onOpen={()=>onOpen(d)} style={{fontSize:13, fontWeight:500}}/>
          </span>
          <span style={{fontSize:12.5, color:T.attioMuted, fontVariantNumeric:'tabular-nums'}}>{d.amount ? fmtMoney(d.amount) : ''}</span>
        </div>
      ))}
      {!list.length && <div style={{fontSize:13, color:T.attioMuted, borderTop:`1px solid ${T.attioLine}`, padding:'14px 0'}}>No deals in this range.</div>}
    </div>
  );
}

/* Today's Tasks: tasks assigned to the signed-in person, due today (any status); each opens the task
   (the Tasks page's task panel). */
function TodaysTasks({hub}){
  const [open, setOpen] = React.useState(null);   // {object, recordId, actId}
  const me = CURRENT_USER.name;
  const [a, b] = dashPeriodRange('today', new Date());
  const tasks = hubActivities(hub, 'task').filter(e => e.act.assignee === me && e.act.due && dashIn(new Date(e.act.due).getTime(), [a, b]))
    .sort((x, y) => new Date(x.act.due) - new Date(y.act.due));
  const entry = open ? hubActivities(hub, 'task').find(e => e.act.id === open.actId) || null : null;
  const team = (hub.data.users || []).filter(u => u.status === 'Activated').map(u => u.name);
  return (
    <section style={{...dashCard, borderRadius:22, padding:'20px 22px 22px', display:'flex', flexDirection:'column', gap:14, minWidth:0}}>
      <div style={{display:'flex', alignItems:'baseline', gap:8, minHeight:32}}>
        <span style={{...dashTitle, fontSize:15}}>Today's Tasks</span>
        <span style={{fontSize:12.5, color:T.attioMuted, fontVariantNumeric:'tabular-nums'}}>{tasks.length}</span>
      </div>
      {tasks.length ? (
        <div style={{display:'flex', flexDirection:'column', gap:10}}>
          {tasks.map(e => <TaskCard key={e.act.id} e={e} onDragStart={(ev)=>ev.preventDefault()} onOpen={()=>setOpen({object:e.object, recordId:e.recordId, actId:e.act.id})}/>)}
        </div>
      ) : <div style={{fontSize:13, color:T.attioMuted}}>No tasks due today.</div>}
      {open && (
        <PageSidePanel width={560} title={(entry && entry.act.title) || 'Task'} subtitle={entry ? `${HUB_NOUN[entry.object]} · ${entry.record.name}` : ''}
          onClose={()=>setOpen(null)} menuItems={entry ? [{label:`Open ${HUB_NOUN[entry.object].toLowerCase()}`, onClick:()=>hub.openRecord(entry.object, entry.recordId, 'panel')}] : undefined}>
          <div style={{flex:1, minHeight:0, display:'flex', flexDirection:'column'}}>
            {entry ? <RecordAccessCtx.Provider value={{object:entry.object, record:entry.record}}>
              <ActivityDetail key={entry.act.id} a={entry.act} contact={{...entry.record, owner:userLabel(entry.record.owner) || entry.record.owner}} team={team}
                acts={(hub.activities[entry.object] || {})[entry.recordId] || []}
                onUpdate={(id, patch)=>hub.update(entry.object, entry.recordId, id, patch)} onAdd={(x)=>hub.add(entry.object, entry.recordId, x)}
                onStub={hub.toast} onReassign={()=>{}}/>
            </RecordAccessCtx.Provider> : <div style={{padding:24, fontSize:13, color:T.attioMuted}}>This task was deleted.</div>}
          </div>
        </PageSidePanel>
      )}
    </section>
  );
}

/* The page, on the Workflow canvas's dot grid: the greeting (View Settings and the KPIs / Graph
   switcher top right), the date filter, the KPI cards or the Graph, then Key Indicators beside
   Today's Tasks; generous side margins. */
const dashGreeting = (d = new Date()) => d.getHours() < 12 ? 'Good Morning' : d.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';
// The dashboard's records from the record hub (the dashboard, and a user's profile panel).
function useDashBusinessData(hub){
  const deals = (hub && hub.records && hub.records.deals) || [];
  const records = (hub && hub.records) || {};
  // Only the payment terms the signed-in user may view (Payment Terms → View) count.
  return React.useMemo(() => { const byId = Object.fromEntries(['contacts', 'deals', 'customers'].map(o => [o, new Map((records[o] || []).map(r => [String(r.id), r]))]));
    const accounting = ((hub && hub.accounting) || []).filter(s => { const r = (byId[s.object] || new Map()).get(String(s.recordId)); return !r || paymentTermsCan('view', s.object, r); });
    return dashBusinessData({deals, customers:records.customers || [], contacts:records.contacts || [], accounting,
    activities:(hub && hub.activities) || {}, users:(hub && hub.data.users) || []}); }, [deals, records.customers, records.contacts, hub && hub.accounting, hub && hub.activities]);
}

/* ── A user's statistics in their profile panel ──────────────────────────────────────────
   The dashboard's date filter drives every figure. The pinned item (Total Invoice Cash by
   default) leads, larger; its ⋯ pins another User Property or statistic in its place — one
   setting for the workspace (hub.overviewSettings.users, as Highlights are per record type).
   Every statistic has a trend (chart icon): the panel's secondary section, the statistic over
   the filter's range. */
const USER_PIN_DEFAULT = 'stat:invoiceCash';
const userPinnedOf = (hub) => ((((hub && hub.overviewSettings) || {}).users || {}).pinned || [])[0] || USER_PIN_DEFAULT;
// The pool: the User Properties, then the statistics. Ids 'prop:<key>' / 'stat:<key>'.
const userPinPool = (properties) => [
  {id:'props', label:'User Properties', items:properties.map(p => ({id:`prop:${p.key}`, label:p.label}))},
  {id:'stats', label:'Statistics', items:USER_STATS.filter(st => !st.accounting || accountingViewAny()).map(st => ({id:`stat:${st.key}`, label:st.label}))},
];
const userPinLabel = (pool, id) => { for(const g of pool){ const it = g.items.find(x => x.id === id); if(it) return it.label; } return 'Property removed'; };
const userStatAxis = (kind) => kind === 'money' ? dashShort : (n) => String(Math.round(n * 10) / 10);
const userTrendBtn = {width:26, height:26, borderRadius:6, border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0};
function UserTrendButton({label, onClick}){
  return <button onClick={onClick} title={`${label} trend`} aria-label={`${label} trend`} style={userTrendBtn}><Icon name="analytical" size={14} color={T.gray600}/></button>;
}

/* `values`: the user's property values as shown ({key: text}); `onTrend(key)` opens a statistic's trend. */
function UserStatistics({person, filter, setFilter, properties, values, onTrend}){
  const hub = useRecordHub();
  const [pinning, setPinning] = React.useState(false);
  const range = dashRangeOf(filter, new Date());
  const pool = userPinPool(properties);
  // Accounting statistics (cash, Invoice to Cash) only with View Payment Terms somewhere.
  const stats = USER_STATS.filter(st => !st.accounting || accountingViewAny());
  const pinnedRaw = userPinnedOf(hub), pinned = pinnedRaw.startsWith('stat:') && !stats.some(st => `stat:${st.key}` === pinnedRaw) ? `stat:${stats[0].key}` : pinnedRaw;
  const [kind, key] = pinned.split(':');
  const stat = kind === 'stat' ? userStat(key) : null;
  const lead = kind === 'stat' ? (stat ? fmtUserStat(key, userStatValue(person, key, range)) : '—') : (values[key] || '—');
  return (
    <section style={{marginTop:24, display:'flex', flexDirection:'column', gap:12}}>
      <SectionHeader title="Statistics"/>
      <DateFilter value={filter} onChange={setFilter}/>
      {/* The pinned item, slightly more prominent. */}
      <div style={{...dashCard, padding:'12px 14px 14px', display:'flex', flexDirection:'column', gap:6}}>
        <div style={{display:'flex', alignItems:'center', gap:4}}>
          <span style={{flex:1, minWidth:0, fontSize:12.5, color:T.attioMuted}}>{userPinLabel(pool, pinned)}</span>
          {stat && <UserTrendButton label={stat.label} onClick={()=>onTrend(key)}/>}
          <ActionsMenu title="Pinned item" width={250} height={50}>
            {(close) => <MenuItem label="Pin another property or statistic" onClick={()=>{ close(); setPinning(true); }}/>}
          </ActionsMenu>
        </div>
        <div style={{fontFamily:DASH_FIGURE_FONT, fontSize:30, fontWeight:700, color:T.attioText, lineHeight:1.1, fontVariantNumeric:'tabular-nums', overflowWrap:'anywhere'}}>{lead}</div>
      </div>
      <div>
        {stats.filter(st => `stat:${st.key}` !== pinned).map(st => (
          <div key={st.key} style={{display:'flex', alignItems:'center', gap:12, padding:'4px 0', borderBottom:`1px solid ${T.attioLine}`, minHeight:34}}>
            <span style={{flex:1, minWidth:0, fontSize:12.5, color:T.attioMuted}}>{st.label}</span>
            <span style={{fontSize:13, color:T.attioText, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap'}}>{fmtUserStat(st.key, userStatValue(person, st.key, range))}</span>
            <UserTrendButton label={st.label} onClick={()=>onTrend(st.key)}/>
          </div>
        ))}
      </div>
      {pinning && <UserPinModal pool={pool} pinned={pinned} onClose={()=>setPinning(false)}
        onApply={(id)=>{ hub.setOverviewSettings(s => ({...(s || {}), users:{pinned:[id]}})); setPinning(false); }}/>}
    </section>
  );
}

// A statistic over time: back to the statistics, the date filter, the figure for the range, the line graph.
function UserStatTrend({person, statKey, filter, setFilter, onBack}){
  const st = userStat(statKey);
  if(!st) return null;
  const range = dashRangeOf(filter, new Date());
  const {buckets, step} = dashBuckets(range);
  const series = buckets.map(b => ({at:b.at, v:st.read(person, [b.at, b.end])}));
  return (
    <section style={{display:'flex', flexDirection:'column', gap:12}}>
      <div style={{display:'flex', alignItems:'center', gap:6}}>
        <button onClick={onBack} title="Back to statistics" aria-label="Back to statistics" style={userTrendBtn}><Icon name="arrowLeft" size={14} color={T.gray600}/></button>
        <span style={sectionTitle}>{st.label}</span>
      </div>
      <DateFilter value={filter} onChange={setFilter}/>
      <div style={{fontFamily:DASH_FIGURE_FONT, fontSize:30, fontWeight:700, color:T.attioText, lineHeight:1.1, fontVariantNumeric:'tabular-nums'}}>{fmtUserStat(statKey, st.read(person, range))}</div>
      <div style={{...dashCard, padding:'12px 8px 8px 0'}}>
        <LineTrend buckets={series} step={step} lines={[{key:'v', label:st.label, accent:DASH_BLUE}]} fmt={(v)=>fmtUserStat(statKey, v)}
          axis={userStatAxis(st.kind)} empty={st.kind === 'money' ? 1000 : 1} height={220} ariaLabel={`${st.label} trend`}/>
      </div>
    </section>
  );
}

/* Pin another User Property or statistic in the pinned item's place — the Highlights pinning
   modal (View settings), with one place to fill. */
function UserPinModal({pool, pinned, onApply, onClose}){
  const [query, setQuery] = React.useState('');
  const [draft, setDraft] = React.useState(pinned);
  const q = query.trim().toLowerCase();
  const shown = pool.map(g => ({...g, items:g.items.filter(it => !q || it.label.toLowerCase().includes(q) || g.label.toLowerCase().includes(q))})).filter(g => g.items.length);
  return (
    <SettingsModalShell title="View settings" sections={{pinned:'Pinned Item'}} order={[]} onReorder={()=>{}} fixed={['pinned']}
      section="pinned" onSection={()=>{}} onClose={onClose} onApply={()=>onApply(draft)}
      footerNote={`Pinned: ${userPinLabel(pool, draft)}`}
      toolbar={(
        <div style={{padding:'0 20px 8px'}}>
          <div style={{position:'relative'}}>
            <div style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', display:'flex'}}>
              <Icon name="search" size={13} color={T.gray400}/>
            </div>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search properties and statistics…"
              style={{width:'100%', padding:'8px 10px 8px 30px', fontSize:13, fontFamily:'inherit', border:`1px solid ${T.borderStrong}`, borderRadius:8}}/>
          </div>
        </div>
      )}>
      {shown.map(g => (
        <div key={g.id}>
          <div style={poolGroupLabel}>{g.label}</div>
          {g.items.map(it => <SettingsCheckRow key={it.id} label={it.label} checked={draft === it.id} onToggle={()=>setDraft(it.id)}/>)}
        </div>
      ))}
      {!shown.length && <div style={{fontSize:12.5, color:T.gray400, padding:'8px 6px'}}>Nothing matches “{query}”.</div>}
    </SettingsModalShell>
  );
}

function DashboardPage(){
  const today = new Date();
  const [filter, setFilter] = React.useState(() => ({id:'month', from:ymd(new Date(today.getFullYear(), today.getMonth(), 1)), to:ymd(today)}));
  const [view, setView] = React.useState('kpis');   // 'kpis' | 'graph'
  const [stub, setStub] = React.useState(null);
  const [user, setUser] = React.useState(null);     // the sales professional whose profile is open
  const hub = useRecordHub();
  const deals = (hub && hub.records && hub.records.deals) || [];
  const data = useDashBusinessData(hub);
  const openDeal = (d) => hub && hub.openRecord('deals', d.id, 'panel');
  // The CRM's open workflow violations, each with its record's owner (Compliance).
  const wf = useWorkflowEngineCtx();
  const violations = wf ? openViolations(wf, () => true).map(p => {
    const object = recordObjectOf(p.dealId), rec = (((hub && hub.records) || {})[object] || []).find(r => r.id === p.dealId);
    return {id:p.id, object, recordName: rec ? rec.name : p.dealName, rule:violationRule(wf.data, p), owner: rec ? userLabel(rec.owner) : '', at:new Date(p.createdAt).getTime()};
  }) : [];
  const openViolation = (v) => hub && hub.openViolation(v.object, v.id);
  const range = dashRangeOf(filter, new Date(data.now));
  const firstName = String(CURRENT_USER.name || '').split(/\s+/)[0];
  return (
    <div style={{flex:1, minHeight:0, overflowY:'auto', ...WORKFLOW_CANVAS}}>
      <div style={{maxWidth:1280, margin:'0 auto', padding:'36px 56px 56px', display:'flex', flexDirection:'column', gap:28}}>
        <div>
          <div style={{fontSize:15, color:T.gray600}}>{dashGreeting(today)},</div>
          <div style={{fontSize:32, fontWeight:600, color:T.attioText, letterSpacing:-.5, marginTop:4}}>{firstName}</div>
        </div>
        {/* Ask Spring under the greeting; a separator, 30px either side, before the dashboard's controls. */}
        <div style={{display:'flex', flexDirection:'column', gap:30}}>
          <SpringAsk onAsk={(q)=>setStub(`Spring · ${q.length > 60 ? q.slice(0, 57) + '…' : q}`)}/>
          <div role="separator" style={{height:1, background:T.borderStrong}}/>
        <div style={{display:'flex', flexDirection:'column', gap:16}}>
          {/* The date filter on the left; View Settings and the KPIs / Graph switcher on the right of the same row. */}
          <div style={{display:'flex', alignItems:'center', gap:10, flexWrap:'wrap'}}>
            <DateFilter value={filter} onChange={setFilter}/>
            <div style={{flex:1}}/>
            {/* Dashboard view settings — what they manage isn't defined yet. */}
            <ViewSettingsButton onClick={()=>setStub('View Settings')}/>
            {accountingViewAny() && <DashViewSwitch value={view} onChange={setView}/>}
          </div>
          {view === 'graph' && accountingViewAny() ? <TrendChart data={data} range={range}/> : <FinancialKpis kpis={companyKpis(data, range)} replay={range.join('-')}/>}
        </div>
        </div>
        {/* Key Indicators (wider) beside Today's Tasks; stacked when narrow. */}
        <div style={{display:'flex', flexWrap:'wrap', gap:20, alignItems:'flex-start'}}>
          <div style={{flex:'2 1 620px', minWidth:0}}>
            <KeyIndicators data={data} range={range} rangeKey={range.join('-')} deals={deals} violations={violations}
              onOpenUser={setUser} onOpenDeal={openDeal} onOpenViolation={openViolation}/>
          </div>
          <div style={{flex:'1 1 300px', minWidth:0}}><TodaysTasks hub={hub}/></div>
        </div>
      </div>
      {user && <OwnerProfilePanel key={user} name={user} fixed onClose={()=>setUser(null)}/>}
      {stub && <StubPanel title={stub} onClose={()=>setStub(null)}/>}
    </div>
  );
}

Object.assign(window, {DashboardPage, dashBusinessData, dashPeriodRange, USER_STATS, userStat, userStatsAllTime, userStatPerson, useDashBusinessData, UserStatistics, UserStatTrend, DASH_FILTERS});
