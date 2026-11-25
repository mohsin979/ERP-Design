/* HOF Pulse ERP — Spring, full screen (2026-11-24).

   Spring is the AI assistant. Its prompt boxes (the dashboard's Ask Spring, Workflows' "Ask Spring
   to create a workflow" — dashboard.jsx SpringAsk) have three controls: Attach, Voice and Send
   (Auto and / were taken off everywhere, 2026-11-24). Sending opens Spring full screen in the CRM's
   content area — the CRM navigation stays — with:
     · on the left, New Chat — a text button with the collapse button beside it (no "Spring" title
       above it), a line under them — and the person's chats (2026-11-24, as
       a chat app's sidebar): their titles only, no times — Pinned on top, then the rest newest
       first, and Archived folded at the bottom; each has a ⋯ menu (on hover or while open): Pin /
       Unpin, Rename, Archive / Unarchive, Delete (asked first). A chat's title is its first
       message until renamed; a chat picked opens in the middle. The collapse button hides the
       list; an expand button then sits left of the chat's name in the conversation's header;
     · in the middle, the conversation: the person's messages on the right, Spring's on the left
       with its mark; a short "thinking" moment before each reply; at the bottom the same composer
       (Attach, Voice, Send — Enter sends, Shift+Enter breaks the line);
     · at the top right, Exit Spring, back to the page it was opened from. Picking another page in
       the navigation leaves Spring too.
   Chats are kept per person in the CRM branch's settings data (`springChats`: {id, userId, title,
   pinned, archived, createdAt, updatedAt, messages:[{id, role 'user' | 'spring', text, files:[{name, size}], at}]}).
   The sample CRM gives each person seven sample chats once (withSampleSpringChats, `springSampled`).
   Attachments: their names and sizes travel with the message (the file itself isn't stored).
   Voice: the browser's speech recognition types what's said into the box (as dictation does —
   noteTools.jsx), until clicked again.
   Spring is mocked: springReply reads the request's words and answers in a few words and a CRM
   piece (SpringBlock) read live from the records — a stand-in for the model. */

let SPRING_HOST = null;   // the mounted SpringHost's open({text, files})
const openSpring = (text, files) => { if(SPRING_HOST) SPRING_HOST({text, files:files || []}); };
const springNewId = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const springChatsOf = (data, userId) => ((data && data.springChats) || []).filter(c => c.userId === userId).sort((a, b) => b.updatedAt - a.updatedAt);
const springTitle = (text) => { const t = String(text || '').replace(/\s+/g, ' ').trim(); return t.length > 48 ? `${t.slice(0, 46).trimEnd()}…` : t || 'New chat'; };
const springFileSize = (n) => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

/* Voice: speech typed into a textarea while on (Web Speech API). → {on, toggle} */
function useSpringVoice(ref, onText){
  const hub = useRecordHub();
  const [on, setOn] = React.useState(false);
  const rec = React.useRef(null);
  React.useEffect(() => () => { try { rec.current && rec.current.stop(); } catch(e){} }, []);
  const toggle = () => {
    if(rec.current){ try { rec.current.stop(); } catch(e){} return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR) return hub && hub.toast("Voice isn't available in this browser");
    const r = new SR(); r.lang = navigator.language || 'en-US'; r.continuous = true; r.interimResults = false;
    r.onresult = (e) => { for(let i = e.resultIndex; i < e.results.length; i++) if(e.results[i].isFinal) onText(e.results[i][0].transcript); };
    r.onerror = (e) => { if(e.error === 'not-allowed' || e.error === 'service-not-allowed') hub && hub.toast('Microphone access is blocked'); };
    r.onend = () => { rec.current = null; setOn(false); };
    try { r.start(); rec.current = r; setOn(true); if(ref.current) ref.current.focus(); } catch(err){ hub && hub.toast("Voice couldn't start"); }
  };
  return {on, toggle};
}
const springAppend = (prev, said) => { const t = String(said || '').trim(); if(!t) return prev; return prev && !/\s$/.test(prev) ? `${prev} ${t}` : `${prev}${t}`; };

/* The composer's controls — Attach, Voice, Send — and the chips of the files attached. Shared by
   SpringAsk (dashboard.jsx) and the full screen. `files` / `setFiles`: [{name, size}]. */
const springCtl = {width:32, height:32, borderRadius:8, border:'none', background:T.pageBg, display:'inline-flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, padding:0};
// `blue`: the send button in the dashboard's blue (SpringAsk), else black (the full screen).
function SpringControls({voice, files, setFiles, ready, onSend, blue}){
  const input = React.useRef(null);
  return (
    <div onClick={e=>e.stopPropagation()} style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
      <div style={{flex:1, minWidth:0, display:'flex', flexWrap:'wrap', gap:6}}>
        {files.map((f, i) => (
          <span key={i} style={{display:'inline-flex', alignItems:'center', gap:6, height:26, padding:'0 6px 0 10px', borderRadius:8, background:T.headerBg, border:`1px solid ${T.attioLine}`, fontSize:12.5, color:T.attioText, maxWidth:220}}>
            <Icon name="paperclip" size={11} color={T.gray600}/>
            <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{f.name}</span>
            <button type="button" title="Remove" aria-label={`Remove ${f.name}`} onClick={()=>setFiles(fs => fs.filter((_, k) => k !== i))}
              style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:2}}><Icon name="close" size={10} color={T.gray600}/></button>
          </span>
        ))}
      </div>
      <input ref={input} type="file" multiple style={{display:'none'}} onChange={e=>{ const picked = [...(e.target.files || [])].map(f => ({name:f.name, size:f.size})); e.target.value = ''; if(picked.length) setFiles(fs => [...fs, ...picked]); }}/>
      <button type="button" title="Attach" aria-label="Attach" onClick={()=>input.current.click()} style={springCtl}><Icon name="paperclip" size={16} color={T.gray600}/></button>
      <button type="button" title={voice.on ? 'Stop Voice' : 'Voice'} aria-label={voice.on ? 'Stop voice' : 'Voice'} aria-pressed={voice.on} onMouseDown={e=>e.preventDefault()} onClick={voice.toggle}
        style={{...springCtl, background: voice.on ? T.red : T.pageBg, boxShadow: voice.on ? `0 0 0 4px ${T.red}22` : 'none'}}><Icon name="mic" size={15} color={voice.on ? '#fff' : T.gray600}/></button>
      <button type="button" title="Send" aria-label="Send" onClick={onSend} disabled={!ready}
        style={{...springCtl, background: ready ? (blue ? DASH_BLUE : T.black) : (blue ? T.blueLight : T.headerBg), cursor: ready ? 'pointer' : 'default', transition:'background 140ms'}}>
        <Icon name="arrowUp" size={14} color={ready ? '#fff' : blue ? T.blue : T.gray400}/>
      </button>
    </div>
  );
}

/* Spring's answer (a stand-in for the model): a few words and, where it fits, a CRM piece. → {text, block} */
function springReply(text){
  const q = String(text || '').toLowerCase();
  /* The Lost story (2026-11-24, the product video): why deals are lost — the lost deals and how
     hard they were tried; then a rule keeping deals out of Lost until they've really been tried. */
  if(/(don.?t|do not|stop|never)\b.*\blost\b|\bbefore\b.*\blost\b|\blost\b.*\b(rule|until)\b/.test(q)) return {text:"Here's the workflow. It's off until you turn it on.", block:{kind:'workflow', context:'Deals',
    triggers:[['call', 'Calls Not Answered', 'fewer than 3'], ['envelope', 'Emails Received', 'at least 1'], ['envelope', 'Email Sequence', 'still running']], triggerMode:'any',
    actions:[['lock', 'Block Stage Entry', 'Lost']]}};
  if(/^(please )?(turn|switch) it on\b|^enable it\b/.test(q.trim())) return {text:'Done. It’s on.'};
  if(/\b(why|reason)\b.*\blos(e|ing|t)\b|\blosing\b/.test(q)) return {text:'Most lost deals were dropped early:', block:{kind:'lostPattern'}};
  if(/workflow|automat|trigger/.test(q)) return {text:'I can draft that in the workflow builder. Which record and stage does it start from?'};
  if(/report|source/.test(q)) return {text:'Leads by Source', block:{kind:'leadsBySource'}};
  if(/win|lost|rate/.test(q)) return {text:'Across all deals:', block:{kind:'winLoss'}};
  if(/\blead/.test(q)) return {text:'Your leads not contacted yet:', block:{kind:'leadsToCall'}};
  if(/\bdeal|pipeline/.test(q)) return {text:'Your deals:', block:{kind:'myDeals'}};
  if(/\btask|todo|to-do|overdue/.test(q)) return {text:'Your open tasks:', block:{kind:'tasks', overdue:/overdue/.test(q), team:/team/.test(q)}};
  return {text:'I can build workflows, run reports, and find your leads, deals and tasks.'};
}
/* What Spring shows in a reply (2026-11-24, Mohsin: "pick the actual UI from the CRM … clean
   chat"): the CRM's own pieces, read live from the records — a workflow as the builder's cards,
   tables as the CRM's tables, KPI tiles as the dashboard's, a deal as its side panel's rows, an
   email draft that opens in the composer. A message's `block` names one: {kind, …}. */
const springMine = (me) => (r) => !!me && (r.owner === me.id || r.owner === me.name);
const springAllTasks = (hub) => Object.entries(hub.activities || {}).flatMap(([object, byRec]) => Object.entries(byRec || {}).flatMap(([id, list]) => (list || []).filter(a => a && a.type === 'task').map(a => ({a, object, id}))));
const springRecord = (hub, object, id) => (hub.records[object] || []).find(r => String(r.id) === String(id)) || null;
function SpringTable({columns, rows, empty = 'Nothing here'}){
  const cell = {padding:'8px 12px', fontSize:13, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', borderTop:`1px solid ${T.attioLine}`};
  return (
    <div style={{border:`1px solid ${T.borderStrong}`, borderRadius:10, overflow:'hidden', background:'#fff', maxWidth:'100%', overflowX:'auto'}}>
      <table style={{borderCollapse:'collapse', width:'100%', minWidth:420}}>
        <thead><tr>{columns.map(c => <th key={c.key} style={{textAlign: c.num ? 'right' : 'left', padding:'8px 12px', fontSize:12.5, fontWeight:500, color:T.gray600, background:T.headerBg, whiteSpace:'nowrap'}}>{c.label}</th>)}</tr></thead>
        <tbody>{rows.length ? rows.map((r, i) => <tr key={i}>{columns.map(c => <td key={c.key} style={{...cell, textAlign: c.num ? 'right' : 'left', fontVariantNumeric: c.num ? 'tabular-nums' : undefined}}>{r[c.key] == null || r[c.key] === '' ? '—' : r[c.key]}</td>)}</tr>)
          : <tr><td colSpan={columns.length} style={{...cell, color:T.attioMuted}}>{empty}</td></tr>}</tbody>
      </table>
    </div>
  );
}
const springName = (object, r) => <span style={{display:'inline-flex', alignItems:'center', gap:8, minWidth:0}}><RecordAvatar name={r.name} photo={r.photo} size={22}/><HubRecordLink object={object} id={r.id} name={r.name}/></span>;
function SpringBlock({b, hub, me}){
  if(!b) return null;
  if(b.kind === 'workflow') return (
    <div style={{...WORKFLOW_CANVAS, border:`1px solid ${T.borderStrong}`, borderRadius:12, padding:'20px 16px', display:'flex', flexDirection:'column', alignItems:'center'}}>
      <WorkflowCard tab="CONTEXT" icon="cube"><span style={{fontSize:12.5, fontWeight:500, color:T.attioText}}><span style={{fontWeight:600}}>{branchLabel(ACTIVE_CRM.name, 'CRM')}</span> → {b.context}</span></WorkflowCard>
      <WorkflowConnector/>
      <WorkflowCard tab="TRIGGER" icon="workflows" accent>{b.triggers
        ? <div style={{display:'flex', flexDirection:'column', gap:10}}>
            {b.triggers.map((t, i) => <React.Fragment key={i}>{i > 0 && <div style={{fontSize:11, fontWeight:600, color:T.attioMuted, letterSpacing:.4}}>{b.triggerMode === 'any' ? 'OR' : 'AND'}</div>}{blockLine(t[0], t[1], t[2])}</React.Fragment>)}
          </div>
        : blockLine(b.trigger[0], b.trigger[1], b.trigger[2])}</WorkflowCard>
      <WorkflowConnector/>
      <WorkflowCard tab="ACTION" icon="listBullets">{b.actions.map((a, i) => <React.Fragment key={i}>{blockLine(a[0], a[1], a[2])}</React.Fragment>)}</WorkflowCard>
    </div>);
  if(b.kind === 'winLoss'){ const pls = hub.data.pipelines || [];
    const typeOf = (d) => { const pl = pls.find(p => p.id === d.pipeline), st = pl && (pl.stages || []).find(x => x.id === d.stage); return stageTypeOf(st); };
    const deals = hub.records.deals || [], won = deals.filter(d => typeOf(d) === 'won').length, lost = deals.filter(d => typeOf(d) === 'lost').length;
    const tile = (label, value) => <div style={{flex:'1 1 140px', border:`1px solid ${T.borderStrong}`, borderRadius:12, padding:'12px 14px', background:'#fff'}}>
      <div style={{fontSize:12.5, color:T.gray600}}>{label}</div><div style={{fontSize:24, fontWeight:600, color:T.attioText, marginTop:6, fontVariantNumeric:'tabular-nums'}}>{value}</div></div>;
    return <div style={{display:'flex', flexWrap:'wrap', gap:10}}>{tile('Deals Won', won)}{tile('Deals Lost', lost)}{tile('Win Rate', won + lost ? `${Math.round(won / (won + lost) * 100)}%` : '—')}</div>; }
  /* Lost deals and how hard each was tried (2026-11-24): tiles — Deals Lost, lost with fewer than 3
     unanswered calls, lost with no reply — then the latest lost deals with their unanswered calls, emails
     received and whether a sequence ran (the deal's own activity and its leads'). */
  if(b.kind === 'lostPattern'){ const pls = hub.data.pipelines || [];
    const lostOf = (d) => { const pl = pls.find(p => p.id === d.pipeline), st = pl && (pl.stages || []).find(x => x.id === d.stage); return stageTypeOf(st) === 'lost'; };
    const actsOf = (d) => [...((hub.activities.deals || {})[d.id] || []), ...contactIdsOf(d).flatMap(c => (hub.activities.contacts || {})[c] || [])];
    const lost = (hub.records.deals || []).filter(lostOf).map(d => { const acts = actsOf(d);
      return {d, calls:acts.filter(a => a.type === 'call' && !callReached(a)).length, received:acts.filter(a => a.type === 'email' && a.direction === 'received').length, seq:acts.some(a => a.sequenceId)}; });
    const early = lost.filter(x => x.calls < 3).length, noReply = lost.filter(x => !x.received).length;
    const tile = (label, value) => <div style={{flex:'1 1 140px', border:`1px solid ${T.borderStrong}`, borderRadius:12, padding:'12px 14px', background:'#fff'}}>
      <div style={{fontSize:12.5, color:T.gray600}}>{label}</div><div style={{fontSize:24, fontWeight:600, color:T.attioText, marginTop:6, fontVariantNumeric:'tabular-nums'}}>{value}</div></div>;
    const pct = (n) => lost.length ? `${Math.round(n / lost.length * 100)}%` : '—';
    return <div style={{display:'flex', flexDirection:'column', gap:10}}>
      <div style={{display:'flex', flexWrap:'wrap', gap:10}}>{tile('Deals Lost', lost.length)}{tile('Under 3 Unanswered Calls', pct(early))}{tile('No Reply Received', pct(noReply))}</div>
      <SpringTable columns={[{key:'name', label:'Deal'}, {key:'calls', label:'Unanswered Calls', num:true}, {key:'received', label:'Emails Received', num:true}, {key:'seq', label:'Sequence'}]}
        rows={lost.sort((x, y) => x.calls - y.calls).slice(0, 5).map(x => ({name:springName('deals', x.d), calls:x.calls, received:x.received, seq:x.seq ? 'Yes' : 'No'}))}/>
    </div>; }
  if(b.kind === 'leadsBySource'){ const custs = hub.records.customers || [], leads = hub.records.contacts || [];
    const by = new Map(); leads.forEach(r => { const k = r.source || 'Unknown'; by.set(k, [...(by.get(k) || []), r]); });
    const rows = [...by].map(([src, list]) => { const won = list.filter(r => custs.some(c => contactIdsOf(c).some(id => String(id) === String(r.id)))).length;
      return {src, n:list.length, won, rate:`${list.length ? Math.round(won / list.length * 100) : 0}%`}; }).sort((x, y) => y.n - x.n);
    return <SpringTable columns={[{key:'src', label:'Lead Source'}, {key:'n', label:'Leads', num:true}, {key:'won', label:'Became Customers', num:true}, {key:'rate', label:'Conversion', num:true}]} rows={rows}/>; }
  if(b.kind === 'leadsToCall'){ const leads = (hub.records.contacts || []).filter(springMine(me)).filter(r => !r.lastContacted).slice(0, 5);
    return <SpringTable empty="Every lead has been contacted" columns={[{key:'name', label:'Lead'}, {key:'source', label:'Lead Source'}, {key:'country', label:'Country'}, {key:'type', label:'Type of Lead'}]}
      rows={leads.map(r => ({name:springName('contacts', r), source:r.source, country:r.country, type:r.contactType}))}/>; }
  if(b.kind === 'myDeals'){ const deals = (hub.records.deals || []).filter(springMine(me)).slice(0, 6);
    return <SpringTable empty="No deals" columns={[{key:'name', label:'Deal'}, {key:'stage', label:'Deal Stage'}, {key:'amount', label:'Amount', num:true}]}
      rows={deals.map(d => ({name:springName('deals', d), stage:stageLabelOf(hub.data, d.pipeline, d.stage), amount: d.amount ? moneyText(d.amount, d.currency) : ''}))}/>; }
  if(b.kind === 'tasks'){ const users = hub.data.users || [], meUser = users.find(u => u.id === (me && me.id)), team = meUser && meUser.teamId ? users.filter(u => u.teamId === meUser.teamId).map(u => u.name) : [me && me.name];
    const list = springAllTasks(hub).filter(e => isTaskOpen(e.a) && (b.team ? team.includes(e.a.assignee) : e.a.assignee === (me && me.name)) && (!b.overdue || isOverdue(e.a))).slice(0, 6);
    return <SpringTable empty="No tasks" columns={[{key:'task', label:'Task'}, {key:'rec', label:'Record'}, {key:'who', label:'Assigned To'}, {key:'due', label:'Due Date'}]}
      rows={list.map(e => { const r = springRecord(hub, e.object, e.id); return {task:e.a.title || 'Task', rec: r ? <HubRecordLink object={e.object} id={r.id} name={r.name}/> : '', who:e.a.assignee,
        due: e.a.due ? <span style={{color: isOverdue(e.a) ? T.red : T.attioText}}>{fmtTaskDue(e.a)}</span> : ''}; })}/>; }
  if(b.kind === 'deal'){ const d = springRecord(hub, 'deals', b.id); if(!d) return null;
    const row = (label, value) => <div style={{display:'flex', alignItems:'baseline', gap:12, padding:'7px 0', borderTop:`1px solid ${T.attioLine}`}}><span style={{width:130, flexShrink:0, fontSize:12.5, color:T.attioMuted}}>{label}</span><span style={{fontSize:13, color:T.attioText, minWidth:0}}>{value || '—'}</span></div>;
    return <div style={{border:`1px solid ${T.borderStrong}`, borderRadius:12, padding:'12px 14px 6px', background:'#fff', maxWidth:460}}>
      <div style={{paddingBottom:10}}>{springName('deals', d)}</div>
      {row('Deal Stage', stageLabelOf(hub.data, d.pipeline, d.stage))}{row('Deal Amount', d.amount ? moneyText(d.amount, d.currency) : '')}{row('Deal Owner', userLabel(d.owner))}{row('Expected Close Date', d.closeDate ? fmtActDate(new Date(d.closeDate)) : '')}
    </div>; }
  if(b.kind === 'email'){ const r = springRecord(hub, b.object, b.id); if(!r) return null; const first = String(r.name || '').split(' ')[0];
    const subject = 'Your quotation', body = `<p>Hi ${first},</p><p>Checking that the quotation reached you. Happy to walk you through it on a short call this week.</p>`;
    return <div style={{border:`1px solid ${T.borderStrong}`, borderRadius:12, background:'#fff', maxWidth:560, overflow:'hidden'}}>
      <div style={{padding:'10px 14px', borderBottom:`1px solid ${T.attioLine}`, fontSize:13, color:T.attioText, display:'flex', gap:8}}><span style={{color:T.attioMuted}}>To</span><HubRecordLink object={b.object} id={r.id} name={r.name}/></div>
      <div style={{padding:'10px 14px', borderBottom:`1px solid ${T.attioLine}`, fontSize:13, color:T.attioText, display:'flex', gap:8}}><span style={{color:T.attioMuted}}>Subject</span>{subject}</div>
      <div style={{padding:'12px 14px', fontSize:13.5, lineHeight:1.6, color:T.attioText}} dangerouslySetInnerHTML={{__html:body}}/>
      <div style={{padding:'10px 14px', borderTop:`1px solid ${T.attioLine}`, display:'flex', justifyContent:'flex-end'}}><StSecondary label="Open in Composer" onClick={()=>hub.composeEmail({object:b.object, id:r.id, draft:{subject, body}})}/></div>
    </div>; }
  return null;
}
/* Sample chats (2026-11-24), once per person in the sample CRM — workflows, reports, leads, a
   deal, an email, tasks. Short words; the answer is the CRM piece (SpringBlock). */
const sampleSpringChats = (hub, me) => {
  const mine = springMine(me), deal = (hub.records.deals || []).find(mine) || (hub.records.deals || [])[0];
  const quoted = (hub.quotes || []).find(q => q.object === 'deals' && q.status === 'sent'), qDeal = quoted && springRecord(hub, 'deals', quoted.recordId) || deal;
  return [
    ['Auto-assign new Meta leads', 2, [['user', 'Create a workflow that gives new Meta leads to the sales team, round robin.'],
      ['spring', "Here's the workflow. It's off until you turn it on.", {kind:'workflow', context:'Leads', trigger:['forms', 'Form Submitted', 'Meta Lead Ad'],
        actions:[['userSwitch', 'Assign Record Owner', 'Round-Robin · Sales Team'], ['tasks', 'Create Task', 'Call · due in 1 hour']]}],
      ['user', 'Turn it on.'], ['spring', 'Done.']]],
    ['Win rate', 5, [['user', "What's our deal win rate?"], ['spring', 'Across all deals:', {kind:'winLoss'}]]],
    ['Leads by source report', 26, [['user', 'Generate a report of leads by source.'], ['spring', 'Leads by Source', {kind:'leadsBySource'}]]],
    ["Leads I haven't called", 49, [['user', "Which of my leads haven't I called?"], ['spring', 'Your leads not contacted yet:', {kind:'leadsToCall'}]]],
    ...(deal ? [[`Where ${deal.name}'s deal stands`, 74, [['user', `Sum up ${deal.name}'s deal.`], ['spring', '', {kind:'deal', id:deal.id}]]]] : []),
    ...(qDeal ? [[`Follow-up email to ${qDeal.name}`, 120, [['user', `Draft a follow-up email to ${qDeal.name} about the quotation.`], ['spring', 'Draft:', {kind:'email', object:'deals', id:qDeal.id}]]]] : []),
    ['Overdue tasks on my team', 170, [['user', 'Show overdue tasks on my team.'], ['spring', '', {kind:'tasks', team:true, overdue:true}]]],
  ];
};
const withSampleSpringChats = (d, userId, list) => {
  const now = Date.now(), H = 3600000;
  const chats = list.map(([title, hoursAgo, msgs], i) => { const at = now - hoursAgo * H;
    return {id:`sc-sample-${userId}-${i + 1}`, userId, title, pinned:i === 0, createdAt:at, updatedAt:at + msgs.length * 60000,
      messages:msgs.map(([role, text, block], k) => ({id:`sm-sample-${i + 1}-${k + 1}`, role, text, files:[], at:at + k * 60000, ...(block ? {block} : {})}))}; });
  return {...d, springChats:[...(d.springChats || []), ...chats], springSampled:[...(d.springSampled || []), userId]};
};
const SpringListLabel = ({children}) => <div style={{padding:'12px 10px 4px', fontSize:12, fontWeight:500, color:T.attioMuted}}>{children}</div>;
/* A chat in the list: its title, and its ⋯ menu on hover or while it's open. */
function SpringChatRow({c, on, onOpen, onPin, onRename, onArchive, onDelete, archivedRow}){
  const [h, setH] = React.useState(false);
  const items = [...(archivedRow ? [] : [{label: c.pinned ? 'Unpin Chat' : 'Pin Chat', onClick:onPin}]), {label:'Rename Chat', onClick:onRename},
    {label: archivedRow ? 'Unarchive Chat' : 'Archive Chat', onClick:onArchive}, {label:'Delete Chat', danger:true, onClick:onDelete}];
  return (
    <div onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} onClick={onOpen}
      style={{display:'flex', alignItems:'center', gap:6, minHeight:34, padding:'0 4px 0 10px', borderRadius:8, cursor:'pointer', background: on ? '#E6E7EB' : h ? '#EEEFF2' : 'transparent'}}>
      <span style={{flex:1, minWidth:0, fontSize:13.5, fontWeight: on ? 500 : 400, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{c.title}</span>
      <span onClick={e=>e.stopPropagation()} style={{display:'flex', flexShrink:0, opacity: h || on ? 1 : 0, transition:'opacity 120ms'}}><RowActionsMenu title="Chat Actions" width={170} items={items}/></span>
    </div>
  );
}
function SpringRenameModal({title, onCancel, onSave}){
  const [v, setV] = React.useState(title || ''), ok = !!v.trim();
  return <StModal title="Rename Chat" primary="Save" canSubmit={ok} onCancel={onCancel} onSubmit={()=>ok && onSave(v.trim())}>
    <div><label style={fieldLabel}>Chat Name<Req/></label>
      <input autoFocus value={v} onChange={e=>setV(e.target.value)} onKeyDown={e=>{ if(e.key === 'Enter' && ok) onSave(v.trim()); }} style={fieldInput}/></div>
  </StModal>;
}
/* Spring full screen: chats on the left, the conversation in the middle, Exit Spring at the top right. */
function SpringScreen({start, onExit}){
  const hub = useRecordHub();
  const me = (hub.data.users || []).find(u => u.name === CURRENT_USER.name) || {id:CURRENT_USER.name, name:CURRENT_USER.name};
  const chats = springChatsOf(hub.data, me.id);
  // The sample chats, once per person, in the sample CRM.
  React.useEffect(() => { if(ACTIVE_CRM.sample && !(hub.data.springSampled || []).includes(me.id)){ const list = sampleSpringChats(hub, me); hub.setData(d => (d.springSampled || []).includes(me.id) ? d : withSampleSpringChats(d, me.id, list)); } }, [me.id]);
  const [chatId, setChatId] = React.useState(null);
  const [thinking, setThinking] = React.useState(null);   // the chat Spring is answering
  const [text, setText] = React.useState(''), [files, setFiles] = React.useState([]);
  const box = React.useRef(null), scroller = React.useRef(null);
  const voice = useSpringVoice(box, (said) => setText(t => springAppend(t, said)));
  const chat = chats.find(c => c.id === chatId) || null;
  const saveChat = (id, fn) => hub.setData(d => { const list = d.springChats || [];
    return {...d, springChats: list.some(c => c.id === id) ? list.map(c => c.id === id ? fn(c) : c) : [fn(null), ...list]}; });
  // The chat menu's actions.
  const [renaming, setRenaming] = React.useState(null), [deleting, setDeleting] = React.useState(null), [showArchived, setShowArchived] = React.useState(false);
  const [listOpen, setListOpen] = React.useState(true);   // the chats list, collapsed with its button
  const sideBtn = (title, onClick) => <button type="button" title={title} aria-label={title} onClick={onClick}
    style={{width:36, height:36, flexShrink:0, border:'none', borderRadius:8, background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center'}}><Icon name="sidebarCollapse" size={18} color={T.gray600}/></button>;
  const patchChat = (id, patch) => saveChat(id, (c) => ({...c, ...patch}));
  const removeChat = (id) => { hub.setData(d => ({...d, springChats:(d.springChats || []).filter(c => c.id !== id)})); if(chatId === id) setChatId(null); };
  const pinned = chats.filter(c => c.pinned && !c.archived), recent = chats.filter(c => !c.pinned && !c.archived), archived = chats.filter(c => c.archived);
  const send = (body, attached) => {
    const t = String(body || '').trim(); if(!t && !(attached || []).length) return;
    const id = chatId || springNewId('sc'), now = Date.now();
    const msg = {id:springNewId('sm'), role:'user', text:t, files:attached || [], at:now};
    saveChat(id, (c) => c ? {...c, updatedAt:now, messages:[...c.messages, msg]} : {id, userId:me.id, title:springTitle(t || (attached[0] || {}).name), createdAt:now, updatedAt:now, messages:[msg]});
    setChatId(id); setText(''); setFiles([]); setThinking(id);
    setTimeout(() => { const r = springReply(t), reply = {id:springNewId('sm'), role:'spring', text:r.text, files:[], at:Date.now(), ...(r.block ? {block:r.block} : {})};
      saveChat(id, (c) => ({...c, updatedAt:reply.at, messages:[...((c && c.messages) || []), reply]})); setThinking(x => x === id ? null : x); }, 900);
  };
  // Opened with a question from a Spring box: a new chat that starts with it.
  const started = React.useRef(false);
  React.useEffect(() => { if(start && !started.current){ started.current = true; send(start.text, start.files); } }, []);
  React.useEffect(() => { const el = scroller.current; if(el) el.scrollTop = el.scrollHeight; }, [chat && chat.messages.length, thinking]);
  // The box grows with what's typed, up to 180px, and shrinks back when it's sent (whichever composer shows).
  React.useEffect(() => { const el = box.current; if(el){ el.style.height = 'auto'; el.style.height = Math.min(180, el.scrollHeight) + 'px'; } }, [text, chatId]);
  useEscapeClose(onExit);
  const ready = !!text.trim() || files.length > 0;
  const composer = (
    <div onClick={()=>box.current && box.current.focus()} data-no-dictation="1"
      style={{background:'#fff', borderRadius:18, border:`1px solid ${T.borderStrong}`, boxShadow:'0 2px 10px rgba(16,24,40,.05)', padding:'14px 16px 10px', cursor:'text', display:'flex', flexDirection:'column', gap:10}}>
      <textarea ref={box} rows={1} value={text} onChange={e=>setText(e.target.value)} placeholder="Ask Spring" aria-label="Ask Spring"
        onKeyDown={e=>{ if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); if(ready) send(text, files); } }}
        style={{border:'none', outline:'none', resize:'none', background:'transparent', fontFamily:'inherit', fontSize:15, lineHeight:1.55, color:T.attioText, minHeight:26, maxHeight:180, overflowY:'auto'}}/>
      <SpringControls voice={voice} files={files} setFiles={setFiles} ready={ready} onSend={()=>send(text, files)}/>
    </div>
  );
  return (
    <div style={{position:'absolute', left:0, right:0, bottom:0, top:APP_HEADER_H, zIndex:60, background:'#fff', display:'flex', borderTop:`1px solid ${T.border}`}}>
      {/* Chats */}
      {listOpen && <aside style={{width:260, flexShrink:0, borderRight:`1px solid ${T.border}`, background:T.pageBg, display:'flex', flexDirection:'column', minHeight:0}}>
        <div style={{padding:'12px 10px 10px', display:'flex', alignItems:'center', gap:4}}>
          <button type="button" onClick={()=>{ setChatId(null); setText(''); setFiles([]); setTimeout(() => box.current && box.current.focus(), 0); }}
            onMouseEnter={e=>e.currentTarget.style.background = '#EEEFF2'} onMouseLeave={e=>e.currentTarget.style.background = 'transparent'}
            style={{flex:1, minWidth:0, height:36, display:'flex', alignItems:'center', gap:8, padding:'0 10px', border:'none', borderRadius:8, background:'transparent', cursor:'pointer',
              fontFamily:'inherit', fontSize:13.5, fontWeight:500, color:T.attioText}}><Icon name="plus" size={14} color={T.attioText}/>New Chat</button>
          {sideBtn('Collapse Chats', ()=>setListOpen(false))}
        </div>
        <div style={{height:1, background:T.border, margin:'0 10px 6px'}}/>
        <div style={{flex:1, minHeight:0, overflowY:'auto', padding:'0 10px 12px', display:'flex', flexDirection:'column', gap:2}}>
          {pinned.length > 0 && <><SpringListLabel>Pinned</SpringListLabel>{pinned.map(c => <SpringChatRow key={c.id} c={c} on={c.id === chatId} onOpen={()=>setChatId(c.id)}
            onPin={()=>patchChat(c.id, {pinned:false})} onRename={()=>setRenaming(c)} onArchive={()=>{ patchChat(c.id, {archived:true, pinned:false}); if(chatId === c.id) setChatId(null); }} onDelete={()=>setDeleting(c)}/>)}</>}
          {pinned.length > 0 && recent.length > 0 && <SpringListLabel>Chats</SpringListLabel>}
          {recent.map(c => <SpringChatRow key={c.id} c={c} on={c.id === chatId} onOpen={()=>setChatId(c.id)}
            onPin={()=>patchChat(c.id, {pinned:true})} onRename={()=>setRenaming(c)} onArchive={()=>{ patchChat(c.id, {archived:true}); if(chatId === c.id) setChatId(null); }} onDelete={()=>setDeleting(c)}/>)}
          {!pinned.length && !recent.length && <div style={{fontSize:12.5, color:T.attioMuted, padding:'6px 10px'}}>No chats yet</div>}
          {archived.length > 0 && <>
            <button type="button" onClick={()=>setShowArchived(o => !o)} aria-expanded={showArchived}
              style={{display:'flex', alignItems:'center', gap:6, border:'none', background:'transparent', cursor:'pointer', fontFamily:'inherit', padding:'14px 10px 6px', fontSize:12, fontWeight:500, color:T.attioMuted}}>
              Archived <Icon name="chevDown" size={T.chevronSize} color={T.attioMuted} style={{transform: showArchived ? 'none' : 'rotate(-90deg)', transition:'transform 120ms'}}/></button>
            {showArchived && archived.map(c => <SpringChatRow key={c.id} c={c} on={c.id === chatId} onOpen={()=>setChatId(c.id)} archivedRow
              onRename={()=>setRenaming(c)} onArchive={()=>patchChat(c.id, {archived:false})} onDelete={()=>setDeleting(c)}/>)}
          </>}
        </div>
      </aside>}
      {/* The conversation */}
      <section style={{flex:1, minWidth:0, display:'flex', flexDirection:'column', minHeight:0}}>
        <div style={{display:'flex', alignItems:'center', gap:12, padding: listOpen ? '12px 20px' : '6px 20px 6px 10px', minHeight:61, boxSizing:'border-box', borderBottom:`1px solid ${T.border}`, flexShrink:0}}>
          {!listOpen && sideBtn('Expand Chats', ()=>setListOpen(true))}
          <span style={{flex:1, minWidth:0, fontSize:14, fontWeight:600, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{chat ? chat.title : 'New Chat'}</span>
          <StSecondary label="Exit Spring" onClick={onExit}/>
        </div>
        {chat ? <>
          <div ref={scroller} style={{flex:1, minHeight:0, overflowY:'auto'}}>
            <div style={{maxWidth:760, margin:'0 auto', padding:'28px 24px 12px', display:'flex', flexDirection:'column', gap:18}}>
              {chat.messages.map(m => m.role === 'user' ? (
                <div key={m.id} style={{alignSelf:'flex-end', maxWidth:'78%', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6}}>
                  {m.text && <div style={{background:T.headerBg, border:`1px solid ${T.attioLine}`, borderRadius:'16px 16px 4px 16px', padding:'10px 14px', fontSize:14, lineHeight:1.55, color:T.attioText, whiteSpace:'pre-wrap', overflowWrap:'anywhere'}}>{m.text}</div>}
                  {(m.files || []).length > 0 && <div style={{display:'flex', flexWrap:'wrap', gap:6, justifyContent:'flex-end'}}>{m.files.map((f, i) => (
                    <span key={i} style={{display:'inline-flex', alignItems:'center', gap:6, height:26, padding:'0 10px', borderRadius:8, background:'#fff', border:`1px solid ${T.attioLine}`, fontSize:12.5, color:T.attioText}}>
                      <Icon name="paperclip" size={11} color={T.gray600}/>{f.name}<span style={{color:T.attioMuted}}>{springFileSize(f.size || 0)}</span></span>))}</div>}
                </div>
              ) : (
                <div key={m.id} style={{display:'flex', gap:12, alignItems:'flex-start', width:'100%'}}>
                  <span style={{width:30, height:30, borderRadius:9, background:SPRING.tint, border:`1px solid ${SPRING.line}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}><SpringMark w={18}/></span>
                  <div style={{flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:10, paddingTop:4}}>
                    {m.text && <div style={{fontSize:14, lineHeight:1.65, color:T.attioText, whiteSpace:'pre-wrap', overflowWrap:'anywhere'}}>{m.text}</div>}
                    <SpringBlock b={m.block} hub={hub} me={me}/>
                  </div>
                </div>
              ))}
              {thinking === chat.id && (
                <div role="status" aria-label="Spring is thinking" style={{display:'flex', gap:12, alignItems:'center'}}>
                  <span style={{width:30, height:30, borderRadius:9, background:SPRING.tint, border:`1px solid ${SPRING.line}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}><SpringMark w={18}/></span>
                  <span style={{display:'inline-flex', gap:4}}>{[0, 1, 2].map(i => <span key={i} className="hof-spring-dot" style={{width:6, height:6, borderRadius:9, background:SPRING.accent, animationDelay:`${i * 0.15}s`}}/>)}</span>
                </div>
              )}
            </div>
          </div>
          <div style={{flexShrink:0, padding:'8px 24px 20px'}}><div style={{maxWidth:760, margin:'0 auto'}}>{composer}</div></div>
        </> : (
          <div style={{flex:1, minHeight:0, overflowY:'auto', display:'flex', alignItems:'center', justifyContent:'center', padding:24}}>
            <div style={{width:'100%', maxWidth:680, display:'flex', flexDirection:'column', alignItems:'center', gap:20}}>
              <SpringMark w={44}/>
              <span style={{fontSize:20, fontWeight:600, color:T.attioText}}>What can I help with?</span>
              <div style={{alignSelf:'stretch'}}>{composer}</div>
            </div>
          </div>
        )}
      </section>
      {renaming && <SpringRenameModal title={renaming.title} onCancel={()=>setRenaming(null)} onSave={(title)=>{ patchChat(renaming.id, {title}); setRenaming(null); }}/>}
      {deleting && <StModal title="Delete Chat" primary="Delete Chat" danger onCancel={()=>setDeleting(null)} onSubmit={()=>{ removeChat(deleting.id); setDeleting(null); }}>
        <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>{deleting.title} will be deleted. This can't be undone.</div>
      </StModal>}
      <style>{'@keyframes hof-spring-dot{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}.hof-spring-dot{animation:hof-spring-dot 1s ease-in-out infinite}@media (prefers-reduced-motion: reduce){.hof-spring-dot{animation:none}}'}</style>
    </div>
  );
}

/* Mounted once in the CRM's content area (app.jsx): opens Spring when a Spring box sends, closes it
   on Exit Spring or when another page is picked (`page` changes). */
function SpringHost({page}){
  const [open, setOpen] = React.useState(null);   // {key, start}
  React.useEffect(() => { SPRING_HOST = (start) => setOpen({key:Date.now(), start}); return () => { SPRING_HOST = null; }; }, []);
  const first = React.useRef(true);
  React.useEffect(() => { if(first.current){ first.current = false; return; } setOpen(null); }, [page]);
  // The CRM navigation folds while Spring is open (nav.jsx CrmSidebar listens).
  React.useEffect(() => { window.dispatchEvent(new CustomEvent('hof-spring', {detail:{open:!!open}})); }, [!!open]);
  return open ? <SpringScreen key={open.key} start={open.start} onExit={()=>setOpen(null)}/> : null;
}

Object.assign(window, {openSpring, SpringHost, SpringScreen, SpringControls, SpringBlock, useSpringVoice, springAppend, springReply, springChatsOf});
