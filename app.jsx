/* HOF Pulse ERP — app shell only (Header + Main Screen). No module content yet —
   module requirements will be provided separately. */

/* The ERP's modules — the Organization's (workspaces.jsx). CRM and People have instances; CRM
   opens for anyone with a CRM instance, Setting (the ERP Settings) for the Organization's Super
   Admins (`assignable:false`); the rest aren't built yet. */
const MODULE_TILES = [
  {id:'crm', label:'CRM', icon:'crm', color:'#1869EC'},
  {id:'people', label:'People', icon:'people', color:'#7C3AED'},
  {id:'marketing', label:'Marketing', icon:'marketing', color:'#EC4899'},
  {id:'accounting', label:'Accounting', icon:'accounting', color:'#16A34A'},
  {id:'analytics', label:'Analytics', icon:'analytics', color:'#F59E0B'},
  {id:'academy', label:'Academy', icon:'academy', color:'#0D9488'},
  {id:'complience', label:'Complience', icon:'complience', color:'#DC2626'},
  {id:'setting', label:'Setting', icon:'setting', color:'#64748B', assignable:false},
];
Object.assign(window, {MODULE_TILES});   // ERP Settings → Branches lists the modules (workspaces.jsx)

/* ── Header (ERP and CRM) ─────────────────────────────────────────────────────────────────
   One header pattern in both contexts; only the relevant controls change:
     ERP — the workspace switcher (workspaces.jsx), Find or Ask,
           Notifications, Profile ▾.
     CRM — Find or Ask, Spring (the AI assistant lives in CRM), Notifications, Profile ▾.
   The profile and work-session state belong to the app, so both headers show the same. */

/* The signed-in person (mocked email sign-in, workspaces.jsx): the session's email; their name
   and role come from the open CRM instance's Users once it has loaded (App). */
const CURRENT_USER = {
  name:'Waleed bin Zaman', email:'waleed.binzaman@hof-global.com',
  orgRole:'CEO', role:'Super Admin', clockIn:'9:00 AM', shift:'9:00 AM–5:00 PM',
};
const SESSION = ORG_REGISTRY.session;
// Sample data only in the CRM instance that has it (Migration); every other instance starts empty.
const SEED = !!ACTIVE_CRM.sample;
const seedList = (f) => SEED ? f() : [];
/* Work session (Time Clock) — a chronological trail of events; the status and the worked time
   are derived from it, so new event kinds slot in without reshaping the widget.
     arrival   {expected:'HH:MM'}  "I'm on my way"
     clockIn / clockOut
     breakStart / breakEnd
     note      {text}
   Default: not clocked in. Several breaks, notes at any point, and clocking in again after a
   clock-out are all allowed — the trail keeps everything. */
const NEW_WORK_SESSION = () => ({trail:[]});
const tcStatus = (trail) => {
  let st = 'notClockedIn';
  trail.forEach(e => {
    if(e.type === 'clockIn') st = 'clockedIn';
    else if(e.type === 'breakStart') st = 'onBreak';
    else if(e.type === 'breakEnd') st = 'clockedIn';
    else if(e.type === 'clockOut') st = 'clockedOut';
  });
  return st;
};
/* Worked time = every clocked-in interval, minus breaks. */
function workedMs(trail, now){
  let total = 0, inAt = null, breakAt = null;
  trail.forEach(e => {
    if(e.type === 'clockIn'){ inAt = e.at; }
    else if(e.type === 'breakStart' && inAt){ total += e.at - inAt; inAt = null; breakAt = e.at; }
    else if(e.type === 'breakEnd'){ inAt = e.at; breakAt = null; }
    else if(e.type === 'clockOut'){ if(inAt) total += e.at - inAt; inAt = null; breakAt = null; }
  });
  if(inAt) total += now - inAt;
  return Math.max(0, total);
}
const tcClock = (d) => d.toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'});
const fmtHour = (d) => zonedParts(d).mi ? tcClock(d) : d.toLocaleTimeString('en-US', {hour:'numeric'});   // "2 PM", "3:14 PM"
const fmtHMS = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 3600)}h ${Math.floor(s % 3600 / 60)}m ${s % 60}s`; };
const fmtMS = (ms) => { const s = Math.max(0, Math.floor(ms / 1000));   // never negative (a break can start a moment after the last tick)
  const h = Math.floor(s / 3600); return h ? `${h}h ${Math.floor(s % 3600 / 60)}m ${s % 60}s` : `${Math.floor(s / 60)}m ${s % 60}s`; };
const arrivalLabel = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return tcClock(d); };

/* Time Clock — a header control (Figma, HOF CRM Redesign 6377:7657) that opens the Time Clock
   panel (flow 6370:7343, card 6372:7369). The control and the panel's time area take the colour
   of the current state: white when not clocked in / clocked out, light green when clocked in,
   light orange on a break. The worked time is set in Fira Sans Extra Condensed; the trail is a
   light timeline (markers on one rail); action buttons keep their own colours in every state.
   Inputs and the note interaction keep the design-system styling. */
const TC = {
  bg:'#fff', border:'#E4E4E4', line:'#E4E4E4', rail:'#D7D6DA', text:'#000', sub:'#5B5B5B',
  green:'#0ACC8B', red:'#E5484D', orange:'#FF6600', blue:T.attioBlue,
  greyBg:'#FAFAFA',
};
const TC_STATE_BG = {notClockedIn:'#fff', clockedOut:'#fff', clockedIn:'#E4FFC5', onBreak:'#FFE8D4'};
const tcBtn = {height:28, borderRadius:6, fontSize:12, fontWeight:500, fontFamily:'inherit', cursor:'pointer',
               display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'0 14px', boxSizing:'border-box'};

/* Every trail row shares one marker column, so the rail runs through each marker's centre the
   same way — dots and the note icon alike. Markers sit on top of the rail. */
const TC_MARK_Y = 20;   // marker centre: 12px row padding + half a 16px line
function TcRail({up, down}){
  return (<>
    {up && <span style={{position:'absolute', left:15, top:0, height:TC_MARK_Y, width:1, background:TC.rail}}/>}
    {down && <span style={{position:'absolute', left:15, top:TC_MARK_Y, bottom:0, width:1, background:TC.rail}}/>}
  </>);
}
const tcMarkCol = (children) => (
  <span style={{width:19, height:16, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', position:'relative', zIndex:1}}>{children}</span>
);
const tcDot = (c) => tcMarkCol(<span style={{width:7, height:7, borderRadius:12, background:c, boxShadow:`0 0 0 3px ${TC.bg}`}}/>);

function TcRow({color, label, right, sub, railUp, railDown}){
  return (
    <div style={{position:'relative', display:'flex', alignItems:'flex-start', gap:6, padding:'12px 12px 12px 6px'}}>
      <TcRail up={railUp} down={railDown}/>
      {tcDot(color)}
      <span style={{flex:1, minWidth:0, fontSize:12.5, lineHeight:'16px', color:TC.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{label}</span>
      <div style={{flexShrink:0}}>
        <div style={{fontSize:12.5, lineHeight:'16px', color:TC.sub, whiteSpace:'nowrap'}}>{right}</div>
        {sub && <div style={{fontSize:12, fontWeight:600, color:TC.text, letterSpacing:-.3, whiteSpace:'nowrap'}}>{sub}</div>}
      </div>
    </div>
  );
}

/* A note on the trail: the note icon in a small container on the rail, the text on the left
   and its time on the right. The expand control appears only when the text doesn't fit on one
   line; expanding shows the rest. */
function TcNoteRow({e, railUp, railDown}){
  const [open, setOpen] = React.useState(false);
  const [overflows, setOverflows] = React.useState(false);
  const textRef = React.useRef(null);
  React.useLayoutEffect(()=>{
    const el = textRef.current;
    if(!el || open) return;
    const check = () => setOverflows(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = window.ResizeObserver ? new ResizeObserver(check) : null;
    ro && ro.observe(el);
    return () => ro && ro.disconnect();
  }, [e.text, open]);
  return (
    <div style={{position:'relative', padding:'12px 12px 12px 6px'}}>
      <TcRail up={railUp} down={railDown}/>
      <div onClick={overflows ? ()=>setOpen(o=>!o) : undefined} style={{display:'flex', alignItems:'flex-start', gap:6, cursor: overflows ? 'pointer' : 'default'}}>
        {tcMarkCol(
          <span style={{width:18, height:18, borderRadius:5, background:'#fff', border:`1px solid ${TC.border}`, boxSizing:'border-box',
                        display:'flex', alignItems:'center', justifyContent:'center'}}>
            <Icon name="notepad" size={11} color={TC.sub}/>
          </span>
        )}
        <span ref={textRef} style={{flex:1, minWidth:0, fontSize:12.5, lineHeight:'16px', color:TC.text, whiteSpace: open ? 'normal' : 'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{e.text}</span>
        <span style={{flexShrink:0, fontSize:12.5, lineHeight:'16px', color:TC.sub, whiteSpace:'nowrap'}}>{tcClock(e.at)}</span>
        {overflows && <Icon name="chevDown" size={14} color={TC.sub} style={{flexShrink:0, marginTop:1, transform: open ? 'rotate(180deg)' : 'none'}}/>}
      </div>
    </div>
  );
}

/* The trail, in time order: arrival, clock-in/out, breaks (start…finish as one row once
   finished), notes. */
function tcRows(trail, now){
  const rows = [];
  trail.forEach((e, i) => {
    if(e.type === 'arrival') rows.push({key:i, kind:'dot', color:TC.blue, label:'Expected Arrival', right:arrivalLabel(e.expected)});
    else if(e.type === 'clockIn') rows.push({key:i, kind:'dot', color:TC.green, label:'Clocked In', right:tcClock(e.at)});
    else if(e.type === 'clockOut') rows.push({key:i, kind:'dot', color:TC.red, label:'Clocked Out', right:fmtHour(e.at)});
    else if(e.type === 'breakStart'){
      const end = trail.slice(i + 1).find(x => x.type === 'breakEnd' || x.type === 'clockOut');
      rows.push(end
        ? {key:i, kind:'dot', color:TC.orange, label:'Break', right:`${fmtHour(e.at)} – ${fmtHour(end.at)}`}
        : {key:i, kind:'dot', color:TC.orange, label:'Break Started', right:fmtHour(e.at), sub:fmtMS(now - e.at)});
    }
    else if(e.type === 'note') rows.push({key:i, kind:'note', e});
  });
  return rows;
}

function TimeClockWidget({session, setSession}){
  const [now, setNow] = React.useState(()=>new Date());
  React.useEffect(()=>{ const t = setInterval(()=>setNow(new Date()), 1000); return ()=>clearInterval(t); }, []);
  const [mode, setMode] = React.useState(null);        // null | 'arrival' | 'note'
  const [arrival, setArrival] = React.useState('10:00');
  const [note, setNote] = React.useState('');
  const trail = session.trail;
  const status = tcStatus(trail);
  const add = (e) => setSession(s => ({...s, trail:[...s.trail, {at:new Date(), ...e}]}));
  const worked = workedMs(trail, now);
  const rows = tcRows(trail, now);
  const hasArrival = trail.some(e => e.type === 'arrival');

  const ghost = (label, icon, onClick) => (
    <button onClick={onClick} style={{...tcBtn, width:'100%', background:TC.greyBg, border:`1px solid ${TC.border}`, color:TC.sub}}>
      {icon && <Icon name={icon} size={13} color={TC.sub}/>}{label}
    </button>
  );
  const primary = (label, icon, onClick, kind) => (
    <button onClick={onClick} style={{...tcBtn, flex:1, minWidth:0, border:'none', background: kind === 'out' ? TC.red : TC.green, color:'#fff'}}>
      <Icon name={icon} size={13} color="#fff"/>{label}
    </button>
  );
  /* Note — opens the note input, available in every state. (A ⋯ menu can return once there are
     more Time Clock actions.) */
  const more = (
    <button title="Add note" onClick={()=>{ setNote(''); setMode('note'); }}
      style={{...tcBtn, width:28, padding:0, borderRadius:8, border:`1px solid ${TC.border}`, background:TC.greyBg, flexShrink:0}}>
      <Icon name="notepad" size={14} color={TC.sub}/>
    </button>
  );
  const inputStyle = {flex:1, minWidth:0, height:28, borderRadius:6, border:`1px solid ${T.borderStrong}`, background:'#fff', color:TC.text,
                      padding:'0 8px', fontSize:12, fontFamily:'inherit', boxSizing:'border-box'};
  const tick = (onClick, disabled) => (
    <button title="Save" onClick={onClick} disabled={disabled} style={{...tcBtn, width:28, padding:0, border:'none', background: disabled ? T.gray400 : T.black, cursor: disabled ? 'default' : 'pointer'}}>
      <Icon name="check" size={13} color="#fff"/>
    </button>
  );

  let actions;
  if(mode === 'arrival'){
    // "I'm on my way" becomes an inline input in the same place.
    actions = (<>
      <div style={{fontSize:11.5, color:TC.sub}}>Expected arrival</div>
      <div style={{display:'flex', gap:6}}>
        <TimeField required autoFocus value={arrival} onChange={setArrival} ariaLabel="Expected arrival" inputStyle={{...inputStyle, padding:'0 8px'}}/>
        {tick(()=>{ add({type:'arrival', expected:arrival}); setMode(null); }, !arrival)}
      </div>
      <button onClick={()=>setMode(null)} style={{...tcBtn, height:22, background:'transparent', border:'none', color:TC.sub, alignSelf:'center'}}>Cancel</button>
    </>);
  } else if(mode === 'note'){
    actions = (<>
      <textarea autoFocus value={note} onChange={e=>setNote(e.target.value)} rows={3} placeholder="Add a note"
        style={{...inputStyle, height:'auto', padding:'6px 8px', resize:'none', lineHeight:1.45}}/>
      <div style={{display:'flex', gap:6}}>
        <button onClick={()=>setMode(null)} style={{...tcBtn, flex:1, background:'#fff', border:`1px solid ${T.borderStrong}`, color:TC.text}}>Cancel</button>
        <button onClick={()=>{ add({type:'note', text:note.trim()}); setMode(null); }} disabled={!note.trim()}
          style={{...tcBtn, flex:1, border:'none', background: note.trim() ? T.black : T.gray400, color:'#fff'}}>Save</button>
      </div>
    </>);
  } else if(status === 'notClockedIn'){
    actions = (<>
      {!hasArrival && ghost('I’m on my way', null, ()=>setMode('arrival'))}
      <div style={{display:'flex', gap:6}}>{primary('Clock In', 'clockIn', ()=>add({type:'clockIn'}))}{more}</div>
    </>);
  } else if(status === 'clockedIn'){
    actions = (<>
      {ghost('Add Break', 'breakStart', ()=>add({type:'breakStart'}))}
      <div style={{display:'flex', gap:6}}>{primary('Clock Out', 'clockOut', ()=>add({type:'clockOut'}), 'out')}{more}</div>
    </>);
  } else if(status === 'onBreak'){
    actions = (<>
      {ghost('Finish Break', 'breakEnd', ()=>add({type:'breakEnd'}))}
      <div style={{display:'flex', gap:6}}>{primary('Clock Out', 'clockOut', ()=>add({type:'clockOut'}), 'out')}{more}</div>
    </>);
  } else {   // clocked out — a new shift can start
    actions = <div style={{display:'flex', gap:6}}>{primary('Clock In', 'clockIn', ()=>add({type:'clockIn'}))}{more}</div>;
  }

  return (
    <div style={{background:TC.bg, border:`1px solid ${TC.border}`, borderRadius:10, color:TC.text, overflow:'hidden'}}>
      <div style={{height:181, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8,
                   background:TC_STATE_BG[status], color:TC.text, transition:'background 160ms ease',
                   borderBottom: TC_STATE_BG[status] === '#fff' ? `1px solid ${TC.line}` : 'none'}}>
        <span style={{fontSize:13}}>Time Clock</span>
        <span style={{fontFamily:"'Fira Sans Extra Condensed', 'DM Sans', sans-serif", fontWeight:700, fontSize:48, lineHeight:1,
                      letterSpacing:-.9, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap'}}>{trail.some(e => e.type === 'clockIn') ? fmtHMS(worked) : '00:00'}</span>
      </div>
      {rows.length > 0 && (
        <div style={{padding:'0 16px'}}>
          {/* Long days scroll inside the card rather than stretching the menu. */}
          <div style={{maxHeight:240, overflowY:'auto'}}>
            {rows.map((r, i) => {
              const railUp = i > 0, railDown = i < rows.length - 1;
              return r.kind === 'note'
                ? <TcNoteRow key={r.key} e={r.e} railUp={railUp} railDown={railDown}/>
                : <TcRow key={r.key} color={r.color} label={r.label} right={r.right} sub={r.sub} railUp={railUp} railDown={railDown}/>;
            })}
          </div>
          <div style={{height:1, background:TC.line}}/>
        </div>
      )}
      <div style={{padding:16, display:'flex', flexDirection:'column', gap:6}}>{actions}</div>
    </div>
  );
}

/* Header control: the clock in the state colour; opens the Time Clock panel beneath it. */
function TimeClockControl({session, setSession}){
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(()=>{
    if(!open) return;
    // The time picker's panel floats outside the popover (data-hof-floating) — clicks there stay inside.
    const h = (e) => { if(ref.current && !ref.current.contains(e.target) && !(e.target.closest && e.target.closest('[data-hof-floating]'))) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const status = tcStatus(session.trail);
  const bg = TC_STATE_BG[status];
  const label = {notClockedIn:'Not clocked in', clockedIn:'Clocked in', onBreak:'On break', clockedOut:'Clocked out'}[status];
  return (
    <div ref={ref} style={{position:'relative', display:'flex'}}>
      <button title={`Time Clock · ${label}`} aria-label={`Time Clock — ${label}`} onClick={()=>setOpen(o=>!o)}
        style={{width:24, height:24, borderRadius:8, border: bg === '#fff' ? `1px solid ${TC.border}` : 'none', background:bg, boxSizing:'border-box',
                display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', padding:0, transition:'background 160ms ease'}}>
        <Icon name="clock" size={14} color="#000"/>
      </button>
      {open && (
        <div style={{position:'absolute', top:'calc(100% + 8px)', right:-8, width:258, zIndex:60,
                     boxShadow:'0 8px 24px rgba(16,24,40,.14)', borderRadius:10}}>
          <TimeClockWidget session={session} setSession={setSession}/>
        </div>
      )}
    </div>
  );
}

function HeaderSearch(){
  return (
    <div style={{position:'relative', width:320, flexShrink:1, minWidth:180}}>
      <div style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none'}}>
        <Icon name="search" size={13} color={T.gray400}/>
      </div>
      <input placeholder="Find or Ask" style={{width:'100%', padding:'7px 10px 7px 30px', fontSize:13, border:`1px solid ${T.borderStrong}`, borderRadius:8, fontFamily:'inherit'}}/>
    </div>
  );
}

/* Profile ▾ — shortened name in the header, full details inside. Three clear sections: the
   profile (name, email, Organization / Role, the Time Zone the CRM shows times in), then the menu. ⋯ → Go to Profile leads to the
   person's ERP / HRMS profile (the header is ERP-scoped; not defined yet). The entries are not
   defined yet and open the standard placeholder. (The Time Clock lives in the header.) */
// `inCrm`: opened from the CRM's header — a time zone change reloads back into the CRM.
function ProfileMenu({onStub, inCrm}){
  const [open, setOpen] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const u = CURRENT_USER;
  // Header shows a shortened, title-cased name ("Waleed Bi…"); the menu shows it in full.
  const titled = u.name.replace(/\b\w/g, c => c.toUpperCase());
  const short = titled.length > 9 ? `${titled.slice(0, 9)}…` : titled;
  const initials = u.name.split(/\s+/).filter(Boolean).map(w => w[0]).filter((c, i, a) => i === 0 || i === a.length - 1).join('').toUpperCase();
  const go = (label) => { setOpen(false); setMoreOpen(false); onStub(label); };
  const prop = (label, value, last) => (
    <div style={{display:'flex', alignItems:'baseline', gap:12, padding:'8px 0', borderBottom: last ? 'none' : `1px solid ${T.attioLine}`}}>
      <span style={{width:96, flexShrink:0, fontSize:12.5, color:T.attioMuted}}>{label}</span>
      <span style={{fontSize:13, color:T.attioText}}>{value}</span>
    </div>
  );
  const section = {padding:'4px 8px 12px'};
  return (
    <div style={{position:'relative'}}>
      <div onClick={()=>setOpen(o=>!o)} title={u.name} style={{display:'flex', alignItems:'center', gap:6, cursor:'pointer'}}>
        <span style={{width:22, height:22, borderRadius:9999, background:T.attioText, color:'#fff', fontSize:9.5, fontWeight:700,
                      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>{initials}</span>
        <span style={{fontSize:13, color:T.gray600, whiteSpace:'nowrap'}}>{short}</span>
        <Icon name="chevDown" size={T.chevronSize} color={T.gray600} style={{transform: open ? 'rotate(180deg)' : 'none'}}/>
      </div>
      <MenuShell open={open} onClose={()=>{ setOpen(false); setMoreOpen(false); }} anchorRight width={310}>
        {/* Profile — name and email styled like the Contact side panel. */}
        <div style={{...section, paddingTop:8}}>
          <div style={{display:'flex', alignItems:'flex-start', gap:8}}>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:17, fontWeight:600, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{u.name}</div>
              <div style={{display:'flex', alignItems:'center', gap:8, marginTop:6, minWidth:0}}>
                <Icon name="envelope" size={14} color={T.attioMuted}/>
                <span style={{fontSize:13, color:T.attioBlue, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{u.email}</span>
              </div>
            </div>
            <div style={{position:'relative', flexShrink:0}}>
              <button title="Profile actions" onClick={()=>setMoreOpen(o=>!o)}
                style={{width:28, height:28, borderRadius:8, border:'none', background: moreOpen ? T.headerBg : 'transparent', cursor:'pointer',
                        display:'flex', alignItems:'center', justifyContent:'center'}}>
                <Icon name="moreDots" size={15} color={T.attioMuted}/>
              </button>
              <MenuShell open={moreOpen} onClose={()=>setMoreOpen(false)} anchorRight width={180}>
                <MenuItem label="Go to Profile" onClick={()=>go('Go to Profile')}/>
              </MenuShell>
            </div>
          </div>
          <div style={{marginTop:10}}>
            {prop('Organization', u.orgRole)}
            {prop('Role', u.role)}
            {/* The time zone the CRM shows times in for this person (Settings → Defaults' until changed). */}
            <div style={{display:'flex', alignItems:'center', gap:12, padding:'8px 0 0'}}>
              <span style={{width:96, flexShrink:0, fontSize:12.5, color:T.attioMuted}}>Time Zone</span>
              <div style={{flex:1, minWidth:0}}><FormSelect value={myTimeZone()} options={TIME_ZONES.map(z => ({value:z, label:z}))} onChange={(z)=>z && chooseTimeZone(z, inCrm)}/></div>
            </div>
          </div>
        </div>
        <div style={{height:1, background:T.border, margin:'0 2px 4px'}}/>
        {['Training', 'Privacy Policy', 'Settings'].map(l => <MenuItem key={l} label={l} onClick={()=>go(l)}/>)}
        <div style={{height:1, background:T.border, margin:'4px 2px'}}/>
        <MenuItem label="Sign Out" onClick={()=>{ setOpen(false); signOut(); }}/>
      </MenuShell>
    </div>
  );
}

/* Right-hand cluster, shared by both headers. Spring shows only in CRM. */
function HeaderRightIcons({context, session, setSession}){
  const [stub, setStub] = React.useState(null);
  return (
    <>
      <div style={{flex:1}}/>
      <div style={{display:'flex', alignItems:'center', gap:16, flexShrink:0}}>
        {context === 'crm' && (
          /* Spring, the AI assistant: its logo (designer-supplied, assets/brand/spring-logo.svg)
             and name in a bordered chip, the height of the Time Clock control beside it. */
          <div style={{display:'flex', alignItems:'center', gap:6, height:24, padding:'0 8px', boxSizing:'border-box',
                       border:`1px solid ${T.borderStrong}`, borderRadius:8, background:'#fff'}}>
            <img src="assets/brand/spring-logo.svg" alt="" width={20} height={10} style={{display:'block'}}/>
            <span style={{fontSize:12, color:T.gray600}}>Spring</span>
          </div>
        )}
        <TimeClockControl session={session} setSession={setSession}/>
        {/* The signed-in user's workflow violations and notifications (workflowEngine.jsx). */}
        <WorkflowBell/>
        <ProfileMenu onStub={setStub} inCrm={context === 'crm'}/>
      </div>
      {stub && <StubPanel title={stub} zIndex={130} onClose={()=>setStub(null)}/>}
    </>
  );
}

/* ERP header — the Organization's lockup (workspaces.jsx), then the global Find or Ask search. */
function Header({session, setSession}){
  return (
    <div style={{
      // Its own stacking layer above the page (the contact side panel is z70) and below modals (z90+),
      // so the Profile and Time Clock dropdowns open on top of the interface.
      position:'relative', zIndex:85,
      height:45, background:T.surface, borderBottom:`1px solid ${T.border}`,
      display:'flex', alignItems:'center', gap:24,
      padding:'0 16px', flexShrink:0,
    }}>
      <OrgLockup/>
      <HeaderSearch/>
      <HeaderRightIcons context="erp" session={session} setSession={setSession}/>
    </div>
  );
}

/* Module header (CRM, People) — scoped to the right-hand content pane only (the module's sidebar on
   the left names the open branch and module, so this header carries no logo or title). */
function CrmHeader({session, setSession, context = 'crm'}){
  return (
    <div style={{
      // Its own stacking layer above the page (the contact side panel is z70) and below modals (z90+),
      // so the Profile and Time Clock dropdowns open on top of the interface.
      position:'relative', zIndex:85,
      height:45, background:T.surface, borderBottom:`1px solid ${T.border}`,
      display:'flex', alignItems:'center', gap:16,
      padding:'0 16px', flexShrink:0,
    }}>
      <HeaderSearch/>
      <HeaderRightIcons context={context} session={session} setSession={setSession}/>
    </div>
  );
}

const iconBtnStyle = {width:32, height:32, borderRadius:8, border:'none', background:T.pageBg, display:'inline-flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:T.gray600};

/* App-icon style: a neutral square holds just the icon (kept in its original blue + black
   artwork colors); the module name sits as separate text below/outside the square, not
   inside it. Hover adds a blue stroke plus a soft shadow lift, so it still reads clearly as
   interactive/openable. */
function ModuleTile({tile, onClick}){
  const [hover, setHover] = React.useState(false);
  return (
    <div onClick={()=>onClick(tile)}
      onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{
        display:'flex', flexDirection:'column', alignItems:'center', gap:8,
        cursor:'pointer', width:76,
      }}>
      <div style={{
        width:56, height:56, borderRadius:14, background:T.pageBg,
        border: hover ? `1.5px solid ${T.blue}` : `1.5px solid ${T.border}`,
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow: hover ? '0 8px 16px rgba(24,105,236,.18)' : '0 1px 2px rgba(16,24,40,.08)',
        transform: hover ? 'translateY(-2px) scale(1.05)' : 'none',
        transition:'all 140ms ease',
      }}>
        <ModuleIcon id={tile.icon} size={26}/>
      </div>
      <span style={{fontSize:13, color:T.gray600, textAlign:'center'}}>{tile.label}</span>
    </div>
  );
}

/* Main Screen — greeting, module tiles, AI command bar. The tiles are the Organization's modules:
   CRM for anyone with a CRM branch, Setting for its Super Admins (workspaces.jsx). CRM opens the
   CRM (the open branch), People the People module (its navigation; pages not defined yet), Setting
   the ERP Settings; every other tile just surfaces a lightweight "not built yet" note instead of
   navigating anywhere or inventing module behavior. */
function MainScreen({onOpenCrm, onOpenPeople, onOpenSettings}){
  const [notice, setNotice] = React.useState(null);
  useOrg();   // follows access changes
  const tiles = MODULE_TILES.filter(t => t.assignable === false ? isOrgAdmin() : t.id !== 'crm' || myCrmInstances().length > 0);

  return (
    <div style={{flex:1, overflow:'auto', background:T.pageBg, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div style={{maxWidth:968, width:'100%', margin:'0 auto', padding:'0 24px'}}>
        <div style={{fontSize:14, fontWeight:500, color:T.black, marginBottom:20}}>Good Morning {CURRENT_USER.name.split(' ')[0]},</div>

        {/* All 8 module tiles fit on one row at this width (8*100 + 7*16 gaps = 912, plus
            the 48px of horizontal padding above = 960 minimum); nowrap keeps them from
            ever wrapping to a second row at this container width. */}
        <div style={{display:'flex', gap:16, flexWrap:'nowrap', marginBottom:12}}>
          {tiles.map(t => (
            <ModuleTile key={t.id} tile={t} onClick={(tile)=> tile.id==='crm' ? onOpenCrm() : tile.id === 'people' ? onOpenPeople() : tile.id === 'setting' ? onOpenSettings()
              : setNotice(`${tile.label} hasn't been built yet — module requirements haven't been provided.`)}/>
          ))}
        </div>
        {notice && (
          <div style={{fontSize:12.5, color:T.gray600, marginBottom:16}}>{notice}</div>
        )}

        <div style={{
          border:`1px solid ${T.borderStrong}`, borderRadius:12, background:'#fff',
          padding:'18px 20px 12px', marginTop: notice ? 0 : 16,
        }}>
          <div style={{fontSize:14, color:'#9A9A9A', minHeight:80}}>What do you want to find or do?</div>
          <div style={{display:'flex', alignItems:'center', justifyContent:'flex-end', gap:8, paddingTop:12, borderTop:`1px solid ${T.border}`}}>
            <button style={iconBtnStyle}><Icon name="paperclip" size={16} color={T.gray600}/></button>
            <button style={{...iconBtnStyle, width:64, gap:4, fontSize:13, color:T.gray800}}>Auto <Icon name="chevDown" size={T.chevronSize} color={T.gray600}/></button>
            <button style={iconBtnStyle}>/</button>
            <button style={iconBtnStyle}><Icon name="mic" size={15} color={T.gray600}/></button>
            <button style={{...iconBtnStyle, background:T.blueLight}}><Icon name="arrowUp" size={14} color={T.blue} strokeWidth={2.2}/></button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* CRM canvas for anything other than Contacts. Nothing selected shows the blank state (the
   Figma CRM nav concept likewise starts with nothing selected); a selected item shows its own
   page, which just states that the module hasn't been specified yet. No behaviour is implied
   beyond that — these pages are placeholders until their requirements arrive. */
function EmptyCrmCanvas({activeId, label:objectLabel}){
  // Settings itself is a section, not a page: like the CRM root, it asks for a selection.
  const label = activeId && activeId !== 'settings' ? (objectLabel || CRM_NAV_LABELS[activeId] || activeId) : null;
  // A page that isn't defined yet (Reports, Notifications, Import & Export): the illustrated empty state.
  return (
    <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <EmptyState title={label ? `${label} isn't defined yet` : activeId === 'settings' ? 'Select an item from Settings' : 'Select an item from the CRM navigation'}/>
    </div>
  );
}

// Australia and Canada were briefly two pipelines; saved ones become the one pipeline.
const SPLIT_AC_PIPELINES = ['australia', 'canada'];
/* Sample records saved before a property was defined get its mocked value — only where they have
   none. A deal's Actual Close Date only while it's still in the sample's stage. Only in the sample
   workspace (another's records share the sample's IDs, not its data). */
const withSampleValues = (list, samples, keys) => {
  if(!SEED) return list;
  const byId = new Map(samples.map(x => [x.id, x]));
  return list.map(r => {
    const x = byId.get(r.id);
    if(!x) return r;
    const add = Object.fromEntries(keys.filter(k => r[k] === undefined && x[k] !== undefined && (k !== 'actualCloseDate' || (r.stage === x.stage && r.pipeline === x.pipeline))).map(k => [k, x[k]]));
    return Object.keys(add).length ? {...r, ...add} : r;
  });
};

function App(){
  // Starts in the CRM after a switch of CRM instance from inside it (workspaces.jsx CrmSwitcher), else on the ERP home.
  const [screen, setScreen] = React.useState(() => { if(!ORG_REGISTRY.openCrm) return 'main'; saveOrgRegistry({openCrm:false}); return 'crm'; }); // 'main' | 'crm' | 'people' | 'erpSettings'
  const [crmActive, setCrmActive] = React.useState(null);
  // The People module's open page (nav.jsx PEOPLE_NAV) — every page is the empty canvas for now.
  const [peopleActive, setPeopleActive] = React.useState(PEOPLE_DEFAULT_PAGE);
  // CRM navigation setup (Edit Nav) — kept here so it survives leaving and re-entering CRM, and saved.
  const [crmNav, setCrmNav] = usePersistedState('crmNav', CRM_NAV_DEFAULT);
  /* Settings opens its menu beside the main nav. The menu's back arrow collapses it (Settings stays
     selected); Settings in the main nav opens it again. Opening a workflow collapses it, so the
     workflow has the full width, and closing the workflow brings it back. */
  const [settingsNavOpen, setSettingsNavOpen] = React.useState(true);
  // Quick Search: the entity to open on its Settings page (cleared once opened).
  const [settingsTarget, setSettingsTarget] = React.useState(null);
  const openSettingsEntity = (r) => { setSettingsTarget({...r, nonce:Date.now()}); setCrmActive(r.page); };
  const inSettings = isSettingsPage(crmActive);
  const selectCrm = (id) => {
    // Settings opens straight on its first page (Email), not a "Select an item" screen.
    if(id === 'settings'){ setSettingsNavOpen(true); if(inSettings) return; setCrmActive(SETTINGS_DEFAULT_PAGE); return; }
    setCrmActive(id);
  };
  /* Everything is saved together in this browser (store.jsx): Settings, records, their activity
     and profiles, navigation, views. A browser that saved only the workflow store before
     (hof-erp-workflow-engine-v1: workflows, pipelines, templates, deals) starts from that once. */
  const [settingsData, setSettingsData] = React.useState(() => {
    // A CRM instance made from a template (Partners) starts from its CRM setup (workspaces.jsx).
    const tpl = crmTemplate();
    const d = {...DEFAULT_SETTINGS_DATA(), ...(tpl ? tpl.settings() : {})}, v2 = savedSlice('settings');
    const saved = v2 || WF_SAVED || {};
    // Sample pipelines and deals are added once; deleted ones stay deleted.
    // Contacts → Deals is One-to-many (decided); settings saved before say Many-to-many.
    const associations = ((v2 && v2.associations) || d.associations).map(a => a.id === 'as-contacts-deals' && a.type === 'Many-to-many' ? {...a, type:'One-to-many'} : a);
    // A new empty CRM instance: no users, workflows or email templates yet.
    const empty = !SEED && !v2 ? {...EMPTY_PEOPLE_DATA(), emailTemplates:[], emailSequences:[]} : {};
    const loaded = {...d, ...empty, ...(v2 || {})};
    /* Permissions saved in an earlier shape (Contacts only; Records only) are completed: per-Object
       permissions, then the other categories by the holder's preset (levelOfPreset). */
    const base = {...loaded, users:(loaded.users || []).map(u => ({...u, permissions:normalizePermissions(u.permissions, levelOfPreset(u.preset))})),
      presets:(loaded.presets || []).map(x => ({...x, permissions:normalizePermissions(x.permissions, levelOfPreset(x.name))}))};
    // The signed-in person is one of this CRM's users (added when they aren't yet).
    // One identity per person across the Organization: the signed-in person joins under their shared name.
    const shared = signedInOrgUser();
    // The employees (People): every People instance's, each with its instance; none saved yet — this CRM's (the sample ones), into the first instance.
    const people = hasEmployeeStores() ? allEmployees() : base.people;
    const withMember0 = withSessionMember({users:base.users, seats:base.seats, presets:base.presets, people}, SESSION && {...SESSION, ...(shared ? {name:shared.name} : {})});
    // The Organization's users given this CRM instance (ERP Settings → Users) who aren't in its Users yet join them; everyone keeps their shared name.
    const withMember = {...withMember0, users:[...withMember0.users, ...crmUsersToAdd(withMember0.users)].map(u => {
      const d = orgUserByEmail(u.email);
      return d && d.name !== u.name ? {...u, name:d.name} : u; })};
    return migrateDataModel({...base, ...withMember, associations,
      // Workflows were cleared once (WORKFLOWS_CLEARED): what's saved since is kept.
      workflows: saved.workflowsCleared === WORKFLOWS_CLEARED ? (saved.workflows || []) : [], workflowsCleared:WORKFLOWS_CLEARED,
      pipelines:withSeeded(saved.pipelines && saved.pipelines.filter(p => !SPLIT_AC_PIPELINES.includes(p.id)), d.pipelines, saved.seededPipelines), seededPipelines:d.pipelines.map(p => p.id),
      seededDeals:SAMPLE_DEALS().map(x => x.id), seededContacts:SAMPLE_CONTACTS.map(c => c.id), seededCustomers:SAMPLE_CUSTOMERS().map(c => c.id),
      ...(!v2 && saved.emailTemplates ? {emailTemplates:saved.emailTemplates} : {})});
  });
  // Times show in the signed-in person's time zone (theirs, else Settings → Defaults') — before anything is formatted.
  applyTimeZone(settingsData.defaults);
  React.useEffect(() => { persistSlice('settings', settingsData); }, [settingsData]);
  // One identity per person: this CRM's Users among the Organization's users, each with this instance (workspaces.jsx).
  React.useEffect(() => { syncOrgUsers(settingsData.users); }, [settingsData.users]);
  // The employees go back to their People instances' stores (workspaces.jsx).
  useOrg();   // ERP Settings changes apply at once
  React.useEffect(() => { try { saveEmployees(settingsData.people || []); } catch(e){ console.warn('HOF ERP: could not save People', e); } }, [settingsData.people]);
  setUserDirectory([...settingsData.users, ...(settingsData.deletedUsers || []).filter(x => !settingsData.users.some(u => u.id === x.id)).map(x => ({...x, deleted:true}))]);   // user IDs on records read as names — a deleted user's too, in their history
  // Who's signed in: the user with the session's email in this CRM instance.
  const sessionUser = SESSION && settingsData.users.find(u => String(u.email || '').toLowerCase() === String(SESSION.email).toLowerCase());
  // Their role is their Permission Preset here — none set is no role (not an administrator).
  if(sessionUser) Object.assign(CURRENT_USER, {name:sessionUser.name, email:sessionUser.email, role:sessionUser.preset || ''});
  const prevSettings = savedSlice('settings') || WF_SAVED || {};
  /* The business data (businessData.jsx, ≈1,000 contacts with their deals, customers, CCLs,
     payment terms and history) — added once to the sample workspace's records, by id: never over a
     record that exists, never twice (`seededBusiness`), so records deleted later stay deleted. */
  const [biz] = React.useState(() => SEED && prevSettings.seededBusiness !== BUSINESS_DATA_VERSION
    ? generateBusinessData({users:settingsData.users, services:savedSlice('services') || SAMPLE_SERVICES(),
        takenNames:(savedSlice('contacts') || SAMPLE_CONTACTS).map(c => c.name)}) : null);
  const withBiz = (list, key) => { if(!biz || !biz[key]) return list; const have = new Set((list || []).map(x => String(x.id))); return [...(list || []), ...biz[key].filter(x => !have.has(String(x.id)))]; };
  const withBizMap = (map, key) => { if(!biz || !biz[key]) return map; return {...Object.fromEntries(Object.entries(biz[key]).filter(([id]) => !(map || {})[id])), ...(map || {})}; };
  React.useEffect(() => { if(biz) setSettingsData(s => ({...s, seededBusiness:biz.version})); }, []);
  // Deal records — kept here so they survive leaving the Deals page (they read users / pipelines from Settings).
  const [deals, setDealsRaw] = React.useState(() => {
    const v2 = savedSlice('deals');
    const legacy = !v2 && WF_SAVED && WF_SAVED.deals ? WF_SAVED.deals.map(d => linkSavedDeal(SPLIT_AC_PIPELINES.includes(d.pipeline) ? {...d, pipeline:'australia-canada'} : d)) : null;
    // A deal's contact is optional (null: none); its owner is a user ID.
    return withBiz(withSampleValues(withStageEntry(withSeeded(v2 || legacy, seedList(SAMPLE_DEALS), prevSettings.seededDeals)), SAMPLE_DEALS(), ['email', 'phone', 'dealType', 'source', 'actualCloseDate']), 'deals')
      .map(x => ({...x, contactId:x.contactId ?? null, owner:userIdOf(x.owner, settingsData.users)}))
      // Postponed became an open stage (2026-11-11): deals saved in it lose the Actual Close Date it gave them, once.
      .map(x => savedSlice('postponedOpen') || x.stage !== 'postponed' || !x.actualCloseDate ? x : {...x, actualCloseDate:''});
  });
  React.useEffect(() => { persistSlice('postponedOpen', true); }, []);
  // Each deal's activity history (keyed by deal id), as Contacts keep theirs; sample deals added since get theirs.
  const [dealActivities, setDealActivities] = React.useState(() => {
    // Sample activity comes with the documents clients emailed (files.jsx).
    const sample = SEED ? withUpcomingMeetings(withSampleAttachments(SAMPLE_DEAL_ACTIVITIES(SAMPLE_DEALS(), settingsData.users)), 6) : {};
    const v2 = savedSlice('dealActivities');
    const saved = v2 || (WF_SAVED && WF_SAVED.dealActivities ? reviveActivities(WF_SAVED.dealActivities) : null);
    const merged = saved ? {...Object.fromEntries(Object.entries(sample).filter(([id]) => !(id in saved) && !(prevSettings.seededDeals || []).includes(id))), ...saved} : sample;
    return withTaskStatuses(withBizMap(withWorkflowSampleCalls(merged, settingsData.users), 'dealActivities'), prevSettings.taskPipelines);
  });
  /* Contact records — here (not inside Contacts) so a workflow prompt can create a contact, and
     Deals can show a deal's contact. Their activity and Customer Profiles are here for the same
     reason. Saved; the owner is a user ID (the sample data names the owner). */
  const [contacts, setContacts] = usePersistedState('contacts', () =>
    seedList(() => SAMPLE_CONTACTS).map(c => ({...c, owner:userIdOf(c.owner, settingsData.users)})), (cs) => withBiz(cs, 'contacts'));
  // Contacts saved in a Types of Contact stage that was removed (the Lead stages) move to the first stage.
  React.useEffect(() => { if(contacts.some(c => REMOVED_CONTACT_STAGES.includes(c.contactType))) setContacts(cs => cs.map(withoutRemovedStage)); }, []);
  // Sample contacts saved before Industry was defined get its mocked value.
  React.useEffect(() => { if(contacts.some(c => c.industry === undefined)) setContacts(cs => withSampleValues(cs, SAMPLE_CONTACTS, ['industry'])); }, []);
  const [contactActivities, setContactActivities] = usePersistedState('contactActivities', () => SEED ? withUpcomingMeetings(withSampleAttachments(generateActivities(SAMPLE_CONTACTS)), 9) : {},
    (m) => withTaskStatuses(withBizMap(m, 'contactActivities'), prevSettings.taskPipelines));
  // Sample calls, emails and notes for Run Customer Profile to read (a few sample contacts; added once).
  React.useEffect(() => { if(SEED) setContactActivities(m => withSampleProfileSources(m, contacts)); }, []);
  /* Customer records and their activity — here so contacts and deals can create customers and show
     theirs. A customer's contact (`contactId`) and deals (`dealIds`) are optional links. Sample
     customers are added once (deleted ones stay deleted); customers saved in the earlier shape are
     brought in line (migrateCustomer). */
  const [customers, setCustomersRaw] = React.useState(() => {
    const pipes = recordPipelines(settingsData, 'customers');
    return withBiz(withSampleValues(withStageEntry(withSeeded(savedSlice('customers'), seedList(SAMPLE_CUSTOMERS), prevSettings.seededCustomers)), SAMPLE_CUSTOMERS(), ['status', 'source', 'customerSince', 'company']), 'customers')
      .map(c => ({...migrateCustomer(c, pipes, deals), owner:userIdOf(c.owner, settingsData.users)}));
  });
  const [customerActivities, setCustomerActivities] = React.useState(() => {
    const sample = SEED ? withUpcomingMeetings(withSampleAttachments(SAMPLE_CUSTOMER_ACTIVITIES(SAMPLE_CUSTOMERS(), settingsData.users)), 3) : {};
    const saved = savedSlice('customerActivities');
    return withTaskStatuses(withBizMap(saved ? {...Object.fromEntries(Object.entries(sample).filter(([id]) => !(id in saved) && !(prevSettings.seededCustomers || []).includes(id))), ...saved} : sample, 'customerActivities'), prevSettings.taskPipelines);
  });
  // Sample tasks saved before they had descriptions get theirs (activities.jsx).
  React.useEffect(() => { setContactActivities(withSampleTaskDescriptions); setDealActivities(withSampleTaskDescriptions); setCustomerActivities(withSampleTaskDescriptions); }, []);
  React.useEffect(() => { persistSlice('customers', customers); }, [customers]);
  React.useEffect(() => { persistSlice('customerActivities', customerActivities); }, [customerActivities]);
  const [profileFacts, setProfileFacts] = usePersistedState('profileFacts', {});   // {contactId: {fieldKey: fact}}
  const [profiles, setProfiles] = usePersistedState('profiles', {});               // {contactId: {templateId: profile}} — one per person, shown on their deals too
  /* IDs are never reused: the counters start past every ID already in use — records, and the
     contacts deals or profiles still point at. */
  ensureIdFloor('contacts', idFloorOf([...contacts, ...deals.filter(x => x.contactId != null).map(x => ({id:x.contactId})), ...Object.keys(profiles).map(Number).map(id => ({id}))]));
  ensureIdFloor('deals', idFloorOf(deals));
  ensureIdFloor('customers', idFloorOf(customers));
  /* Customer Profile forms (Settings → Customer Profile) and what each person's say:
     {contactId: {formId: {values, meta:{fieldId:{source, at…}}, updatedAt}}} — one current set
     per form. */
  setProfileFormsLive(settingsData.profileForms);
  const [profileFormData, setProfileFormData] = usePersistedState('profileFormData', {});
  setProfileHolders(profileFormData);   // whose profile a record shows (board.jsx profileHolderId)
  /* Customer Profile is off for a person until templates are enabled for them (`_enabled`, in the
     order enabled — the first is what their profile shows to start with); `_type`: the one shown.
     Saved before this: the one chosen, then those with answers. Filling a template in enables it. */
  const formIds = (settingsData.profileForms || []).map(f => f.id);
  const enabledIn = (mine) => [...new Set(Array.isArray(mine._enabled) ? mine._enabled : [mine._type, ...formIds.filter(id => mine[id])].filter(Boolean))].filter(id => formIds.includes(id));
  const withEnabled = (mine, ids) => ({...mine, _enabled:[...new Set([...enabledIn(mine), ...ids])]});
  const saveProfileForm = (contactId, formId, {values, meta}) => setProfileFormData(m => ({...m, [contactId]:{...withEnabled(m[contactId] || {}, [formId]), [formId]:{values, meta, updatedAt:new Date().toISOString()}}}));
  // One answer edited in place (its source: Manual).
  const saveProfileField = (contactId, formId, fieldId, value) => setProfileFormData(m => {
    const mine = withEnabled(m[contactId] || {}, [formId]), cur = mine[formId] || {values:{}, meta:{}};
    const values = {...cur.values}, meta = {...(cur.meta || {})};
    if(value === '' || value == null){ delete values[fieldId]; delete meta[fieldId]; } else { values[fieldId] = value; meta[fieldId] = {source:'manual', at:new Date().toISOString()}; }
    return {...m, [contactId]:{...mine, [formId]:{values, meta, updatedAt:new Date().toISOString()}}};
  });
  // Customer Profile Type: the enabled template the person's profile shows (none while it's off).
  const profileEnabledOf = (cid) => enabledIn(profileFormData[cid] || {});
  const profileTypeOf = (cid) => { const on = profileEnabledOf(cid), own = (profileFormData[cid] || {})._type; return on.includes(own) ? own : on[0] || null; };
  // Showing a template enables it; enabling more shows the first of them when none was shown.
  const setProfileType = (cid, formId) => setProfileFormData(m => ({...m, [cid]:{...withEnabled(m[cid] || {}, [formId]), _type:formId}}));
  const enableProfiles = (cid, ids) => setProfileFormData(m => { const mine = m[cid] || {}, was = enabledIn(mine);
    return {...m, [cid]:{...withEnabled(mine, ids), _type: was.includes(mine._type) ? mine._type : was[0] || ids[0]}}; });
  /* The person's templates as ticked in Customer Profile settings: unticked ones are turned off
     (their answers are kept, back if ticked again), newly ticked ones added after the others. */
  const setEnabledProfiles = (cid, ids) => setProfileFormData(m => { const mine = m[cid] || {}, was = enabledIn(mine);
    const next = [...was.filter(id => ids.includes(id)), ...ids.filter(id => !was.includes(id))];
    return {...m, [cid]:{...mine, _enabled:next, _type: next.includes(mine._type) ? mine._type : next[0] || null}}; });
  // Sample profiles for a few sample people (added once).
  React.useEffect(() => { if(SEED) setProfileFormData(m => withSampleProfileData(m, contacts)); }, []);
  const profileFormsStore = {forms:settingsData.profileForms || [], data:profileFormData, save:saveProfileForm, saveField:saveProfileField, typeOf:profileTypeOf, setType:setProfileType, enabledOf:profileEnabledOf, enable:enableProfiles, setEnabled:setEnabledProfiles,
    // The profile holder's activity: a contact's — a lead's or customer's own where it holds the profile (HOF Partners).
    // What the person said anywhere: a contact's own activity and its deals' and customers' (a lead's or customer's own, without Contacts).
    activitiesOf:(cid) => contactActivities[cid] ? [...contactActivities[cid], ...deals.filter(d => d.contactId === cid).flatMap(d => dealActivities[d.id] || []),
      ...customers.filter(x => x.contactId === cid).flatMap(x => customerActivities[x.id] || [])] : dealActivities[cid] || customerActivities[cid] || []};
  // `profiles`: what each person has filled in (Create Deal offers a profile when there's none).
  const profileStore = {profiles:profileFormData, facts:profileFacts};
  /* Permissions apply to the signed-in user. Registered for every permission check (usersTeams.jsx)
     with the users (teams) and each record's owner history. */
  // Found by email (two people can share a name).
  const signedInUser = (sessionUser && settingsData.users.find(u => u.id === sessionUser.id)) || settingsData.users.find(u => sameEmail(u.email, CURRENT_USER.email)) || null;
  // Task pipelines (Settings → Tasks), for every task's stage (activities.jsx).
  setMoneyDefaults(settingsData.defaults);   // the default currency and exchange rates (Settings → Defaults)
  setTaskPipelines(taskPipelinesOf(settingsData));
  setContactPipelines(objectPipelines(settingsData, 'contacts'));
  setStagePipelines(settingsData.pipelines);
  setObjectNames(settingsData.objects);
  setOwnerLabels(settingsData.properties);   // owners named by each record type's owner property (board.jsx)
  setAccessContext({user:signedInUser, users:settingsData.users, data:settingsData,
    history:(object, id) => object === 'contacts' ? contactActivities[id] : object === 'deals' ? dealActivities[id] : object === 'customers' ? customerActivities[id] : []});
  /* The workflow engine: every deal and customer change goes through engine.setDeals /
     engine.setCustomers, which record stage entry times and owner history and emit the events
     workflows run on. */
  // Quotes, forms and payment terms (declared before the engine, which reads quotes and payment terms).
  const [quotes, setQuotes] = usePersistedState('quotes', () => SEED ? SAMPLE_QUOTES(SAMPLE_SERVICES()) : [], (qs) => withBiz(qs, 'quotes'));
  ensureIdFloor('quotes', quoteSeqFloor(quotes));   // quote numbers never fall back below one used (quotes.jsx)
  const [forms, setForms] = usePersistedState('forms', () => SEED ? SAMPLE_FORMS() : []);
  // Payment schedules pulled from signed quotes, and their payments (accounting.jsx).
  const [accounting, setAccounting] = usePersistedState('accounting', [], (list) => withBiz(unpackPaymentTerms(list), 'accounting'), packPaymentTerms);
  /* Every Contact, Deal and Customer has payment terms: the default ones (accounting.jsx) until it
     has its own — records already there, and each one created from now on. */
  React.useEffect(() => {
    const key = (o, id) => `${o}:${id}`, has = new Set(accounting.map(s => key(s.object, s.recordId)));
    const missing = [...contacts.map(r => ['contacts', r]), ...deals.map(r => ['deals', r]), ...customers.map(r => ['customers', r])].filter(([o, r]) => !has.has(key(o, r.id)));
    if(missing.length) setAccounting(list => { const h = new Set(list.map(s => key(s.object, s.recordId)));
      return [...list, ...missing.filter(([o, r]) => !h.has(key(o, r.id))).map(([o, r]) => defaultPaymentTerms(o, r))]; });
    /* A deal's default terms total the deal's amount, in its currency: while they're untouched
       (never edited or paid), they follow it when the amount or currency changes. */
    const amountOf = new Map(deals.map(d => [String(d.id), Math.round((Number(d.amount) || 0) * 100) / 100]));
    const currencyOf = new Map(deals.map(d => [String(d.id), d.currency || undefined]));
    const untouched = (s) => JSON.stringify(s) === JSON.stringify(defaultTermsOf(s.id, s.object, s.recordId, s.total, s.startDate, s.createdAt, s.currency));
    const follow = (s) => s.isDefault && s.object === 'deals' && amountOf.has(String(s.recordId)) && untouched(s)
      && (amountOf.get(String(s.recordId)) !== s.total || scheduleCurrency(s) !== (currencyOf.get(String(s.recordId)) || LEGACY_CURRENCY));
    if(accounting.some(follow)) setAccounting(list => list.map(s => follow(s) ? defaultTermsOf(s.id, s.object, s.recordId, amountOf.get(String(s.recordId)), s.startDate, s.createdAt, currencyOf.get(String(s.recordId))) : s));
  }, [contacts, deals, customers, accounting]);
  /* Last Contacted (a Contact's): its latest real touch — a connected call, a sent email or a held
     meeting, on the contact or on its deals and customers (activities.jsx isRealTouch) — kept in
     step with the activity. Written as a system value (no workflow event for each contact). */
  React.useEffect(() => {
    const now = Date.now(), latest = new Map();
    const note = (cid, acts) => { if(cid == null) return; const t = latestTouch(acts, now); if(t){ const ms = new Date(t.at).getTime(); if(ms > (latest.get(cid) || 0)) latest.set(cid, ms); } };
    contacts.forEach(c => note(c.id, contactActivities[c.id]));
    deals.forEach(d => note(d.contactId, dealActivities[d.id]));
    customers.forEach(x => note(x.contactId, customerActivities[x.id]));
    const day = (t) => new Date(t).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
    const label = (id) => latest.has(id) ? day(latest.get(id)) : '';
    // Last Activity Date is never before Last Contacted: the latest of its own activity and that touch.
    const lastAct = (c) => { const own = Math.max(0, ...(contactActivities[c.id] || []).map(a => new Date(a.at).getTime() || 0).filter(t => t <= now));
      const t = Math.max(own, latest.get(c.id) || 0), stored = Date.parse(c.lastActivity || '') || 0; return t > stored ? day(t) : c.lastActivity || ''; };
    const next = (c) => ({lastContacted:label(c.id), lastActivity:lastAct(c)});
    const differs = (c) => { const n = next(c); return (c.lastContacted || '') !== n.lastContacted || (c.lastActivity || '') !== n.lastActivity; };
    if(contacts.some(differs)) setContacts(cs => cs.map(c => differs(c) ? {...c, ...next(c)} : c));
  }, [contacts, deals, customers, contactActivities, dealActivities, customerActivities]);
  // Overview View Settings per record type — pinned Highlights and Snapshots (overviewSettings.jsx).
  const [overviewSettings, setOverviewSettings] = usePersistedState('overviewSettings', {});
  const engine = useWorkflowEngine({data:settingsData, setData:setSettingsData, deals, setDealsRaw, dealActivities, setDealActivities, setContacts,
    customers, setCustomersRaw, customerActivities, setCustomerActivities, contacts, contactActivities, setContactActivities,
    profiles:profileFormData, profileFacts, accounting, quotes, forms});
  // Customers change through the engine too: owner history, stage entry and Customer workflows.
  const setDeals = engine.setDeals, setCustomers = engine.setCustomers;
  /* Contacts ⇄ Deals. A contact's Associated Deals count is its deals (`contactId`), so the two
     never disagree. Opening a record on the other page switches page and opens it there. */
  /* The system-generated Contact properties worked out here: Associated Deal / Customer (the
     linked records' names) and Contact Owner Assignment Date (from the owner history). */
  // Form Name / Form Submission Date: from the form submission that created each record (forms.jsx).
  const formSubs = React.useMemo(() => formSubmissionIndex(forms), [forms]);
  const contactsWithDeals = React.useMemo(() => contacts.map(c => {
    const ds = deals.filter(d => d.contactId === c.id), cs = customers.filter(x => x.contactId === c.id);
    return {...c, dealCount:ds.length, customerCount:cs.length, deals:ds.map(d => d.name).join(', '), customers:cs.map(x => x.name).join(', '),
      ownerAssigned:ownerDates(c, contactActivities[c.id] || []).assigned, ...formRecordValues(formSubs, 'contacts', c.id)};
  }), [contacts, deals, customers, contactActivities, formSubs]);
  const dealsView = React.useMemo(() => formSubs.size ? deals.map(d => ({...d, ...formRecordValues(formSubs, 'deals', d.id)})) : deals, [deals, formSubs]);
  const customersView = React.useMemo(() => formSubs.size ? customers.map(c => ({...c, ...formRecordValues(formSubs, 'customers', c.id)})) : customers, [customers, formSubs]);
  const [recordLink, setRecordLink] = React.useState(null);   // {object:'contacts'|'deals', id, mode, tab, nonce}
  const openRecord = (object, id, mode, tab) => { setCrmActive(object); setRecordLink({object, id, mode, tab, nonce:Date.now()}); };
  /* A deal opened from a workflow event (its card, or the Violations panel): its side panel — or,
     on a tab with a form open ({id, adding, prefill}), the full record. `keepEvent`: the event's modal waits —
     hidden, not closed — and comes back when the panel closes. A new event shows straight away. */
  const [eventAway, setEventAway] = React.useState(false);
  const openWorkflowRecord = (dealId, tab, keepEvent) => {
    if(keepEvent) setEventAway(true);
    const object = recordObjectOf(dealId);   // a deal or a customer
    setCrmActive(object);
    // A tab with a form opens the full record (the side panel shows no tabs); the name alone, the side panel.
    setRecordLink({object, id:dealId, mode: tab ? 'full' : 'panel', tab, nonce:Date.now(), onReturn: keepEvent ? () => setEventAway(false) : null});
  };
  const dealsFor = (contactId) => deals.filter(d => d.contactId === contactId).map(d => dealListRow(settingsData, d));
  // Activity views: a contact's deals' activity, and edits to an activity made from the other record.
  const dealActivitiesFor = (contactId) => deals.filter(d => d.contactId === contactId).map(d => ({deal:d, acts:dealActivities[d.id] || []}));
  const patchActivityIn = (setter) => (id, patch) => setter(m => Object.fromEntries(Object.entries(m).map(([k, list]) => [k, (list || []).map(a => a.id === id ? {...a, ...patch} : a)])));
  // Create Deal from a contact: the deal is linked to the contact and starts with no activity.
  const createDeal = (contact, vals) => {
    const amount = vals.amount === '' || vals.amount == null ? '' : Number(vals.amount);
    const deal = {id:newRecordId('deals'), contactId:contact.id, ...vals, amount, currency:vals.currency || defaultCurrency(), created:dealStamp(new Date())};
    setDealActivities(m => ({...m, [deal.id]: []}));
    setDeals(ds => [...ds, deal]);
    return deal;
  };
  /* Create through associated object: a contact created with a new deal (the deal is linked to
     it), and an existing deal without a contact linked to a new contact. */
  const createContact = (values) => {
    const id = newRecordId('contacts');
    engine.setContacts(cs => [...cs, newContactRecord(id, values)]);   // through the engine: New Record Added
    setContactActivities(m => ({...m, [id]:[]}));
    return id;
  };
  // Create Deal on a customer: the deal has the customer's contact (or none).
  const createDealRecord = (vals, contactId) => createDeal({id:contactId ?? null}, vals);
  /* Create Customer — on a contact (Contacts ↔ Customers), on a deal (Deals → Customers), or on
     the Customers page (no link). The form starts from the source record: its name, email and phone
     (a deal's, else its contact's) and its owner — all editable. */
  const [customerForm, setCustomerForm] = React.useState(null);   // {initial, links:{contactId, dealIds}}
  const [appToast, setAppToast] = React.useState(null);
  const appToastTimer = React.useRef(null);
  const showAppToast = (message, action) => { setAppToast({message, action}); clearTimeout(appToastTimer.current); appToastTimer.current = setTimeout(()=>setAppToast(null), action ? TOAST_ACTION_MS : TOAST_MS); };
  /* Saving (store.jsx DB): data changed in another tab — this one stops saving and offers a reload;
     a failed save — said while it's tried again, then "Changes saved". Shown until resolved. */
  const [saveNotice, setSaveNotice] = React.useState(null);   // {kind:'stale'|'failed', message, action?}
  React.useEffect(() => {
    const stale = () => setSaveNotice({kind:'stale', message:'This CRM was changed in another tab', action:{label:'Reload', onClick:()=>window.location.reload()}});
    const failed = () => setSaveNotice(n => n && n.kind === 'stale' ? n : {kind:'failed', message:'Couldn’t save changes · Retrying'});
    const ok = () => { setSaveNotice(n => n && n.kind === 'failed' ? null : n); showAppToast('Changes saved'); };
    window.addEventListener('hof-erp-stale', stale); window.addEventListener('hof-erp-save-failed', failed); window.addEventListener('hof-erp-save-ok', ok);
    return () => { window.removeEventListener('hof-erp-stale', stale); window.removeEventListener('hof-erp-save-failed', failed); window.removeEventListener('hof-erp-save-ok', ok); };
  }, []);
  /* The links start from where it's created — on a deal: that deal, and the deal's contact; on a
     contact: that contact — and can be changed in the form (any contact or none, any deals or none). */
  const startCustomer = ({contact, deal} = {}) => {
    const src = deal || contact, person = contact || null;
    /* From a deal it starts as the workflow's Create Customer does: in the service pipeline for the
       deal's pipeline (CUSTOMER_PIPELINE_FOR_DEAL, its first open stage), Customer Status Active. */
    const service = deal && recordPipelines(settingsData, 'customers').find(p => p.id === CUSTOMER_PIPELINE_FOR_DEAL[deal.pipeline]);
    const serviceStage = service && (service.stages.find(st => !isClosedStage(st)) || service.stages[0]);
    const fromDeal = deal ? {...(service ? {pipeline:service.id, stage:serviceStage ? serviceStage.id : ''} : {}), status:'Active'} : {};
    // Email and phone: the deal's own, else its contact's — editable in the form.
    setCustomerForm({initial: src ? {name:src.name || '', email:(deal && deal.email) || (person && person.email) || '', phone:(deal && deal.phone) || (person && person.phone) || '', owner:src.owner || '', ...fromDeal} : null,
      links:{contactId: contact ? contact.id : null, dealIds: deal ? [deal.id] : []}});
  };
  const saveCustomer = (vals, links) => {
    const id = newRecordId('customers');
    // From a deal: Customer Status Active unless the form set one (as the workflow's Create Customer).
    const status = vals.status || ((links.dealIds || []).length ? 'Active' : vals.status);
    const c = {id, ...vals, ...(status ? {status} : {}), contactId:links.contactId ?? null, dealIds:links.dealIds || [], created:dealStamp(new Date())};
    setCustomerActivities(m => ({...m, [id]:[]}));
    setCustomers(cs => [...cs, c]);
    setCustomerForm(null);
    showAppToast(`Customer created · ${c.name}`, {label:'Open customer', onClick:()=>{ setAppToast(null); openRecord('customers', id, 'panel'); }});
  };
  /* A deleted record's associated records stay, unlinked: a contact's deals lose their contact and
     its customers drop it; a deal's customers lose their deal. */
  const unlinkDeleted = (object, id) => {
    if(object === 'contacts'){
      if(deals.some(d => d.contactId === id)) setDeals(ds => ds.map(d => d.contactId === id ? {...d, contactId:null} : d));
      if(customers.some(c => c.contactId === id)) setCustomers(cs => cs.map(c => c.contactId === id ? {...c, contactId:null} : c));
    }
    if(object === 'deals' && customers.some(c => (c.dealIds || []).includes(id))) setCustomers(cs => cs.map(c => (c.dealIds || []).includes(id) ? {...c, dealIds:c.dealIds.filter(x => x !== id)} : c));
  };
  /* Services (Tools → Services) and quotations (Quotes) — workspace records of their own. */
  const [services, setServices] = usePersistedState('services', () => SEED ? SAMPLE_SERVICES() : []);
  // Services saved before milestone prices: their price on the first milestone (services.jsx).
  React.useEffect(() => { if(services.some(x => withMilestonePrices(x) !== x)) setServices(ss => ss.map(withMilestonePrices)); }, []);
  /* The record hub (recordHub.jsx): every record's activity in one place, for the Tools pages,
     files, the email composer and quotes. Contacts' activity is kept here; deals' and customers'
     go through the workflow engine, as their pages' own changes do. */
  const hubAdd = (object, id, act) => {
    if(object !== 'contacts') return engine.value.api.addDealActivity(id, act);
    const a = {id:`${act.type}-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, contactId:id, at:new Date(), ...act, ...(act.source === 'you' && !act.by ? {by:CURRENT_USER.name} : {})};
    setContactActivities(m => ({...m, [id]:[a, ...(m[id] || [])]}));
    const today = todayLabel();
    setContacts(cs => cs.map(c => c.id === id ? {...c, lastActivity:today} : c));   // Last Contacted: kept in step with the activity (above)
    return a;
  };
  const hubUpdate = (object, id, actId, patch) => object !== 'contacts' ? engine.value.api.updateDealActivity(actId, patch)
    : setContactActivities(m => ({...m, [id]:(m[id] || []).map(a => a.id === actId ? {...a, ...patch} : a)}));
  const hubRemove = (object, id, actId) => object !== 'contacts' ? engine.value.api.deleteRecordActivity(actId)
    : setContactActivities(m => ({...m, [id]:(m[id] || []).filter(a => a.id !== actId)}));
  // Contacts' scheduled emails go out when their time comes (deals' and customers': the workflow engine).
  React.useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setContactActivities(m => {
        let changed = false;
        const next = Object.fromEntries(Object.entries(m).map(([k, list]) => [k, (list || []).map(a => {
          if(a.type === 'email' && a.status === 'scheduled' && a.scheduledFor && new Date(a.scheduledFor).getTime() <= now){ changed = true; return {...a, status:'sent', at:new Date()}; }
          return a;
        })]));
        return changed ? next : m;
      });
    }, 15000);
    return () => clearInterval(t);
  }, []);
  const customersFor = (contactId) => customers.filter(c => c.contactId === contactId).map(c => customerListRow(c, settingsData));
  /* An existing customer linked to a new contact or deal ({contactId} | {dealIds:[id]}) — only when
     it has none yet (a customer has one contact and one deal). */
  const linkCustomer = (customerId, patch) => setCustomers(cs => cs.map(c => c.id !== customerId ? c
    : 'contactId' in patch ? (c.contactId == null || !contacts.some(x => x.id === c.contactId) ? {...c, ...patch} : c)
    : !(c.dealIds || []).some(id => deals.some(d => d.id === id)) ? {...c, ...patch} : c));
  const linkDeal = (dealId, contactId) => setDeals(ds => ds.map(d => d.id === dealId && (d.contactId == null || !contacts.some(c => c.id === d.contactId)) ? {...d, contactId} : d));
  // Objects sit in the navigation group they're assigned to (Settings → Objects).
  const crmNavWithObjects = React.useMemo(()=>navWithObjects(crmNav, settingsData.objects), [crmNav, settingsData.objects]);
  // Entering CRM with nothing open goes straight to its default page (the Dashboard) — no "Select an item" screen.
  React.useEffect(() => { if(screen === 'crm' && !crmActive) setCrmActive(crmDefaultPage(crmNavWithObjects)); }, [screen, crmActive]);
  // The signed-in person's work session (Break widget), shared by the ERP and CRM headers.
  const [session, setSession] = React.useState(NEW_WORK_SESSION);
  /* Record pages keep their state while you're elsewhere: once opened, Contacts and Deals stay
     mounted (hidden when not active), so coming back restores exactly where you left off — view,
     Table / Board, filters, search, sort, columns, page and scroll. Each page keeps its own state;
     nothing is shared between them. The CRM itself stays mounted while the ERP home is shown. */
  const KEEP_ALIVE = ['contacts', 'deals', 'customers'];
  const [visited, setVisited] = React.useState(() => new Set());
  const [crmOpened, setCrmOpened] = React.useState(screen === 'crm');
  React.useEffect(() => { if(KEEP_ALIVE.includes(crmActive) && !visited.has(crmActive)) setVisited(v => new Set(v).add(crmActive)); }, [crmActive]);
  React.useEffect(() => { if(screen === 'crm') setCrmOpened(true); }, [screen]);
  const kept = KEEP_ALIVE.filter(id => visited.has(id) || id === crmActive);
  const keepAlivePane = (id, el) => kept.includes(id) && (
    <div key={id} style={{display: crmActive === id ? 'flex' : 'none', flex:1, flexDirection:'column', minWidth:0, minHeight:0}}>
      <PageVisibleCtx.Provider value={screen === 'crm' && crmActive === id}>{el}</PageVisibleCtx.Provider></div>
  );

  // The ERP home — or ERP Settings (its Setting tile), under the same header.
  const main = (screen === 'main' || screen === 'erpSettings') && (
    <div style={{display:'flex', flexDirection:'column', height:'100vh', width:'100vw', overflow:'hidden', background:T.pageBg}}>
      <Header session={session} setSession={setSession}/>
      {screen === 'erpSettings' && isOrgAdmin()
        ? <ErpSettingsScreen onBack={()=>setScreen('main')} data={settingsData} setData={setSettingsData}/>
        : <MainScreen onOpenCrm={()=>{ setCrmActive(a => a || crmDefaultPage(crmNavWithObjects)); setScreen('crm'); }} onOpenPeople={()=>setScreen('people')} onOpenSettings={()=>setScreen('erpSettings')}/>}
    </div>
  );
  // The People module: its sidebar (the open People branch, the navigation) and header; every page is the empty canvas until it's defined.
  const people = screen === 'people' && (
    <div style={{display:'flex', height:'100vh', width:'100vw', overflow:'hidden', background:T.pageBg}}>
      <PeopleSidebar active={peopleActive} setActive={setPeopleActive} onBack={()=>setScreen('main')}/>
      <div style={{flex:1, display:'flex', flexDirection:'column', minWidth:0, minHeight:0}}>
        <CrmHeader context="people" session={session} setSession={setSession}/>
        <EmptyCrmCanvas activeId={peopleActive} label={PEOPLE_NAV_LABELS[peopleActive]}/>
      </div>
    </div>
  );
  React.useEffect(() => { setEventAway(false); }, [engine.event, engine.openPromptId]);
  const engineValue = {...engine.value, openRecord:openWorkflowRecord};
  /* A record created from outside its own page (a form submission, forms.jsx): its values, starting
     in its type's first pipeline and stage where it has one. No owner — that's assigned in the CRM.
     `via` 'meta': the contact's Source is Meta Form. Returns the new record's ID. */
  const createRecord = (object, vals, {via} = {}) => {
    const firstStage = (obj) => { const pl = recordPipelines(settingsData, obj)[0]; return pl ? {pipeline:pl.id, stage:(pl.stages[0] || {}).id || ''} : {}; };
    // Its source: Meta Form; Website Form (Website RFQ or the form's public link); else as before.
    const formSource = via === 'meta' ? 'Meta Form' : via === 'website' || via === 'link' ? 'Website Form' : null;
    // No owner from a form: it's assigned by hand or by an Assign Owner workflow.
    if(object === 'contacts') return createContact({...vals, owner:'', source: formSource || ''});
    if(object === 'deals') return createDeal({id:null}, {amount:'', ...firstStage('deals'), ...vals, owner:'', source: formSource || ''}).id;
    const id = newRecordId('customers');
    setCustomerActivities(m => ({...m, [id]:[]}));
    setCustomers(cs => [...cs, {id, ...firstStage('customers'), ...vals, owner:'', source: formSource || 'Manual', contactId:null, dealIds:[], created:dealStamp(new Date())}]);
    return id;
  };
  // A record's property edited in place (record side panels).
  const updateRecord = (object, id, patch) => object === 'contacts' ? engine.setContacts(cs => cs.map(c => String(c.id) === String(id) ? {...c, ...patch} : c))
    : object === 'deals' ? setDeals(ds => ds.map(d => d.id === id ? {...d, ...patch} : d))
    : object === 'customers' ? setCustomers(cs => cs.map(c => c.id === id ? {...c, ...patch} : c)) : null;
  const hubValue = {data:settingsData, records:{contacts:contactsWithDeals, deals:dealsView, customers:customersView}, updateRecord,
    activities:{contacts:contactActivities, deals:dealActivities, customers:customerActivities},
    add:hubAdd, update:hubUpdate, remove:hubRemove, openRecord, quotes, setQuotes, services, setServices, forms, setForms, createRecord, setData:setSettingsData, accounting, setAccounting, overviewSettings, setOverviewSettings,
    // A workflow violation's details: its Object's page with Workflow Violations open and it selected.
    openViolation:(object, id) => { setCrmActive(object); engine.value.openViolation(object, id); }};
  const withEngine = (el) => (
    <WorkflowEngineCtx.Provider value={engineValue}>
      <RecordHubProvider value={hubValue}><ProfileFormsCtx.Provider value={profileFormsStore}>{el}</ProfileFormsCtx.Provider><PublicFormInbox/></RecordHubProvider>
      {engine.openPromptId && <WorkflowPromptModal key={engine.openPromptId} promptId={engine.openPromptId} direct={engine.promptDirect} onClose={engine.closePrompt} hidden={eventAway}/>}
      <WorkflowNotices notices={engine.notices} onDismiss={engine.dismissNotice} onView={engine.value.openEvent}/>
      {engine.event && <AutomaticActionModal key={engine.event.id} event={engine.event} onClose={engine.closeEvent} hidden={eventAway}/>}
    </WorkflowEngineCtx.Provider>
  );
  if(screen !== 'crm' && !crmOpened) return withEngine(<>{main}{people}{saveNotice && <CopyToast message={saveNotice.message} action={saveNotice.action}/>}</>);

  // CRM screen: the nav spans the full viewport height on the left; the header belongs only
  // to the right-hand content pane (not the sidebar), so it never duplicates the sidebar's
  // own branch label. Hidden (still mounted) while the ERP home or People is shown.
  return withEngine(<>
    {main}
    {people}
    <PageVisibleCtx.Provider value={screen === 'crm'}>
    <div style={{display: screen === 'crm' ? 'flex' : 'none', height:'100vh', width:'100vw', overflow:'hidden', background:T.pageBg}}>
      <CrmSidebar active={inSettings ? 'settings' : crmActive} setActive={selectCrm} onBack={()=>setScreen('main')} nav={crmNavWithObjects} setNav={setCrmNav}/>
      {inSettings && settingsNavOpen && <CrmSettingsNav active={crmActive} setActive={setCrmActive} onClose={()=>setSettingsNavOpen(false)} data={settingsData} onOpenEntity={openSettingsEntity}/>}
      <div style={{flex:1, display:'flex', flexDirection:'column', minWidth:0, minHeight:0}}>
        <CrmHeader session={session} setSession={setSession}/>
        {keepAlivePane('contacts', <ContactsModule contactProperties={objectFormProperties(settingsData, 'contacts')} contacts={contactsWithDeals} setContacts={engine.setContacts}
          activities={contactActivities} setActivities={setContactActivities} profileStore={profileStore}
          dealData={settingsData} deals={deals} dealsFor={dealsFor} onCreateDeal={createDeal} onLinkDeal={linkDeal} onOpenDeal={(id, mode)=>openRecord('deals', id, mode)}
          dealActivitiesFor={dealActivitiesFor} updateDealActivity={(id, patch) => engine.value.api.updateDealActivity(id, patch)}
          customers={customers} customersFor={customersFor} onCreateCustomer={startCustomer} onLinkCustomer={linkCustomer} onOpenCustomer={(id, mode)=>openRecord('customers', id, mode)} onRecordDeleted={unlinkDeleted}
          openRequest={recordLink && recordLink.object === 'contacts' ? recordLink : null}/>)}
        {keepAlivePane('deals', <DealsModule data={settingsData} deals={dealsView} setDeals={setDeals} activities={dealActivities} setActivities={setDealActivities}
          contacts={contactsWithDeals} contactActivities={contactActivities} profileStore={profileStore}
          openRequest={recordLink && recordLink.object === 'deals' ? recordLink : null}
          onOpenContact={(id, mode)=>openRecord('contacts', id, mode)} updateContactActivity={patchActivityIn(setContactActivities)} onCreateContact={createContact}
          customers={customers} onCreateCustomer={startCustomer} onLinkCustomer={linkCustomer} onOpenCustomer={(id, mode)=>openRecord('customers', id, mode)} onRecordDeleted={unlinkDeleted}/>)}
        {keepAlivePane('customers', <CustomersModule data={settingsData} customers={customersView} setCustomers={setCustomers} activities={customerActivities} setActivities={setCustomerActivities}
          deals={deals} contacts={contactsWithDeals} contactActivities={contactActivities} profileStore={profileStore}
          openRequest={recordLink && recordLink.object === 'customers' ? recordLink : null}
          onOpenDeal={(id, mode)=>openRecord('deals', id, mode)} onOpenContact={(id, mode)=>openRecord('contacts', id, mode)}
          onAddCustomer={saveCustomer} onCreateDeal={createDealRecord} onRecordDeleted={unlinkDeleted}
          updateContactActivity={patchActivityIn(setContactActivities)}
          addActivity={(id, act) => engine.value.api.addDealActivity(id, act)} updateActivity={(actId, patch) => engine.value.api.updateDealActivity(actId, patch)}/>)}
        {KEEP_ALIVE.includes(crmActive) ? null
          : SETTINGS_PAGES[crmActive] ? <CrmSettingsPage pageId={crmActive} data={settingsData} setData={setSettingsData} navigate={setCrmActive} records={{contacts, deals, customers}} nav={crmNavWithObjects}
              updateRecords={(object, fn) => object === 'contacts' ? setContacts(fn) : object === 'deals' ? setDealsRaw(fn) : object === 'customers' ? setCustomersRaw(fn) : null} setNav={setCrmNav}
              onWorkflowOpen={(open)=>setSettingsNavOpen(!open)} target={settingsTarget} onTargetDone={()=>setSettingsTarget(null)}/>
          // Automation → Workflows: every configured workflow (workflowsPage.jsx).
          : crmActive === 'workflows' ? (workflowCan('view') ? <WorkflowsPage data={settingsData} setData={setSettingsData}/>
            : <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, color:T.gray400}}>You don't have access to Workflows.</div>)
          // Marketing → Brand: the workspace logo and brand colours (workspaces.jsx).
          : crmActive === 'brand' ? <BrandPage/>
          // Marketing → Forms: lead forms, their builder and connections (forms.jsx).
          : crmActive === 'forms' ? <FormsPage/>
          // Tools: every call, task, email, meeting and note in the workspace (tools.jsx); quotations; the service catalog.
          // Calls: the record Calls tab's two-panel layout, across every record (tools.jsx).
          : crmActive === 'calls' ? <CallsToolPage/>
          // Emails, Meetings, Notes: the same list-and-detail layout as Calls; Tasks: a board by status (tools.jsx).
          : LIST_PAGES[crmActive] ? <ListToolPage key={crmActive} pageId={crmActive}/>
          : crmActive === 'tasks' ? <TasksBoardPage/>
          : TOOL_PAGES[crmActive] ? <ToolActivityPage key={crmActive} pageId={crmActive}/>
          : crmActive === 'quotes' ? <QuotesPage/>
          : crmActive === 'services' ? <ServicesPage/>
          // Dashboard: Financial KPIs, Wall of Fame, Business Velocity (dashboard.jsx).
          : crmActive === 'dashboard' ? <DashboardPage/>
          : <EmptyCrmCanvas activeId={crmActive} label={(settingsData.objects.find(o => o.id === crmActive) || {}).name}/>}
      </div>
      {customerForm && <CustomerFormModal data={settingsData} initial={customerForm.initial} links={customerForm.links} contacts={contactsWithDeals} deals={deals}
        onCancel={()=>setCustomerForm(null)} onSave={saveCustomer}/>}
      {!saveNotice && <CopyToast message={appToast && appToast.message} action={appToast && appToast.action}/>}
    </div>
    </PageVisibleCtx.Provider>
    {/* Saving trouble, on every screen, until it's resolved. */}
    {saveNotice && <CopyToast message={saveNotice.message} action={saveNotice.action}/>}
  </>);
}

/* A form's public link (#f~<CRM instance>~<form>, forms.jsx) opens the form alone, signed in or not.
   Otherwise — signed out: the sign-in screen first (workspaces.jsx); signed in: the ERP home, with
   the open CRM instance. Moving onto, off or between form links starts the page over. */
const PUBLIC_FORM_ROUTE = formPublicRoute(window.location.hash);
window.addEventListener('hashchange', () => { if(JSON.stringify(formPublicRoute(window.location.hash)) !== JSON.stringify(PUBLIC_FORM_ROUTE)) window.location.reload(); });
/* Signed in with a CRM instance open that isn't theirs (the last one opened in this browser): the
   first instance they have opens instead (workspaces.jsx). */
function CrmGate(){
  const to = React.useMemo(crmRedirect, []);
  React.useEffect(() => { if(to) reloadInto({crmId:to}); }, []);
  return to ? null : <App/>;
}
ReactDOM.createRoot(document.getElementById('root')).render(PUBLIC_FORM_ROUTE ? <PublicFormPage route={PUBLIC_FORM_ROUTE}/> : SESSION ? <CrmGate/> : <LoginScreen/>);
