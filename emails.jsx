/* HOF Pulse ERP — Emails: the composer and Tools → Emails.

   Emails are record activity (type 'email'): sent from a Contact, Deal or Customer, received
   from them, or scheduled to go later. The composer writes one against any record: the record,
   who it goes to (the record's email, editable), an optional template (Settings → Templates),
   subject and message; Send now, or Schedule for a date and time. It's also how Reply and
   Forward work from an email. Sent and scheduled emails appear on the record at once, and its
   workflows see them (Email Events). Scheduled emails go out when their time comes.

   Tools → Emails is every email in the workspace: Inbox (received), Sent and Scheduled, with
   the record each belongs to (tools.jsx). Nothing is really sent: there is no mailbox behind
   the prototype. */

const emailFirstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';
// A template's message as plain text, its placeholders filled in for the person.
const templateText = (tpl, person) => templateBodyOf(tpl).replace(/\{\{\s*first_name\s*\}\}/g, emailFirstName(person && person.name) || 'there');

/* The composer — the creation side panel (CreatePanelFrame). `object` / `id`: the record (chosen
   here, under Record Type, when not given). `replyTo` / `forward`: the email it answers or passes
   on. `placement`: 'inline' over the area it's opened from, or 'fixed' at the CRM's right edge.
   `onClose(result, id, target)`: 'sent' / 'scheduled', the new email's id and its record, or nothing (cancelled). */
function EmailComposer({object, id, replyTo, forward, onClose, placement = 'inline'}){
  const hub = useRecordHub();
  const [target, setTarget] = React.useState(() => object && id != null ? {object, id} : {object:object || hubObjects()[0], id:null});
  const fixed = !!(object && id != null);
  const person = target.id != null ? hubRecordPerson(hub, target.object, target.id) : null;
  const templates = emailTemplatesOf(hub.data);
  const base = replyTo || forward;
  const [to, setTo] = React.useState(() => forward ? '' : (person && person.email) || '');
  const [templateId, setTemplateId] = React.useState('');
  const [subject, setSubject] = React.useState(() => base ? `${forward ? 'Fwd' : 'Re'}: ${String(base.title || '').replace(/^(Re|Fwd):\s*/i, '')}` : '');
  const [body, setBody] = React.useState(() => forward ? `\n\n---------- Forwarded message ----------\n${forward.body || ''}` : '');
  const [scheduling, setScheduling] = React.useState(false);
  const [date, setDate] = React.useState(() => ymdOf(new Date(Date.now() + 86400000)));
  const [time, setTime] = React.useState('09:00');
  const [error, setError] = React.useState('');
  // A record picked here fills in its email.
  React.useEffect(() => { if(!fixed && !forward) setTo((person && person.email) || ''); }, [target.object, target.id]);
  const pickTemplate = (tid) => {
    setTemplateId(tid || '');
    const tpl = templates.find(t => t.id === tid);
    if(tpl){ setSubject(tpl.subject || tpl.name); setBody(templateText(tpl, person)); }
  };
  const validTo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim());
  const ready = target.id != null && validTo && !!subject.trim() && !!body.trim();
  const send = (later) => {
    if(!ready) return;
    let when = null;
    if(later){
      when = taskDueValue(date, time).due;
      if(!when || when.getTime() <= Date.now()){ setError('Choose a date and time in the future.'); return; }
    }
    const newIdOf = `email-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    hub.add(target.object, target.id, {id:newIdOf, type:'email', direction:'sent', title:subject.trim(), body:body.trim(), to:[to.trim()], source:'you', by:null,
      status: later ? 'scheduled' : 'sent', ...(later ? {at:when, scheduledFor:when} : {}), ...(templateId ? {templateId} : {}),
      ...(replyTo ? {replyToId:replyTo.id} : {}), ...(forward ? {forwardOfId:forward.id} : {})});
    hub.toast(later ? 'Email scheduled' : 'Email sent');
    onClose(later ? 'scheduled' : 'sent', newIdOf, target);
  };
  return (
    <CreatePanelFrame title={replyTo ? 'Reply' : forward ? 'Forward' : 'New Email'} onClose={()=>onClose()} placement={placement}
      top={!fixed && <CreateRecordField value={target} onChange={setTarget}/>}
      actions={<>
        <StSecondary label="Cancel" onClick={()=>onClose()}/>
        <StSecondary label={scheduling ? 'Send now instead' : 'Schedule'} onClick={()=>{ setScheduling(s => !s); setError(''); }}/>
        <StCta label={scheduling ? 'Schedule send' : 'Send'} disabled={!ready} onClick={()=>send(scheduling)}/>
      </>}>
      {stack(<>
        <Field label="To"><input value={to} onChange={e=>setTo(e.target.value)} placeholder="name@email.com" aria-label="To"
          style={{...fieldText, borderColor: to && !validTo ? T.red : T.borderStrong}}/></Field>
        <Field label="Template"><FormSelect value={templateId} placeholder="Select email template" options={templates.map(t => ({value:t.id, label:t.name}))} onChange={pickTemplate}/></Field>
        <Field label="Subject"><input value={subject} onChange={e=>setSubject(e.target.value)} aria-label="Subject" style={fieldText}/></Field>
        <Field label="Body"><textarea value={body} onChange={e=>setBody(e.target.value)} rows={12} aria-label="Body" style={{...fieldText, resize:'vertical', lineHeight:1.55}}/></Field>
        {scheduling && <>
          <Field label="Send on"><DateField required value={date} onChange={(v)=>{ setDate(v); setError(''); }}/></Field>
          <Field label="At"><TimeField required value={time} onChange={(v)=>{ setTime(v); setError(''); }}/></Field>
        </>}
        {error && <div style={{fontSize:12.5, color:T.red}}>{error}</div>}
      </>)}
    </CreatePanelFrame>
  );
}

/* ── Email threads ── a record's emails grouped into conversations: the same subject (Re: / Fw: /
   Fwd: ignored) on the same record, and a reply joins the email it answers (replyToId). Emails
   carry no mailbox thread ids, so this is how they're grouped. Oldest first within a thread. */
const emailSubjectKey = (t) => String(t || '').replace(/^\s*((re|fw|fwd)\s*:\s*)+/i, '').trim().toLowerCase();
const emailTime = (a) => new Date(a.status === 'scheduled' ? (a.scheduledFor || a.at) : a.at).getTime();
function emailThreadsOf(emails){
  const parent = new Map(emails.map(e => [e.id, e.id]));
  const find = (x) => { let r = x; while(parent.get(r) !== r) r = parent.get(r); parent.set(x, r); return r; };
  const join = (a, b) => { if(parent.has(a) && parent.has(b)) parent.set(find(a), find(b)); };
  const bySubject = new Map();
  emails.forEach(e => {
    const k = emailSubjectKey(e.title);
    if(k){ if(bySubject.has(k)) join(e.id, bySubject.get(k)); else bySubject.set(k, e.id); }
    if(e.replyToId) join(e.id, e.replyToId);
  });
  const groups = new Map();
  emails.forEach(e => { const r = find(e.id); groups.set(r, [...(groups.get(r) || []), e]); });
  return [...groups.values()].map(g => g.sort((a, b) => emailTime(a) - emailTime(b)));
}
// The thread an email is in, among its record's activity.
const emailThreadOf = (a, acts) => emailThreadsOf((acts || []).filter(x => x.type === 'email')).find(g => g.some(x => x.id === a.id)) || [a];
/* A list of emails (each with its record) as one row per thread: its latest email, with how many
   the thread has. `recordKey(item)` and `actsOf(item)`: the email's record and its activity. */
function threadedEmailRows(items, actOf, recordKeyOf, actsOf){
  const seen = new Map(), out = [];
  items.forEach(it => {
    const a = actOf(it), thread = emailThreadOf(a, actsOf(it)), key = `${recordKeyOf(it)}:${thread[0].id}`;
    if(seen.has(key)) return;
    seen.set(key, true);
    out.push({item:it, count:thread.length});
  });
  return out;
}
/* An email's content: HTML (a template's, a workflow's) shown as written, in a sandboxed frame —
   no scripts run, links open in a new tab; plain text as plain text. */
function EmailHtmlFrame({html}){
  const ref = React.useRef(null);
  const [h, setH] = React.useState(160);
  const doc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{margin:0;padding:12px;font-family:system-ui,-apple-system,sans-serif;font-size:14px;color:#15141B}img{max-width:100%}</style></head><body>${String(html || '').replace(/<script[\s\S]*?<\/script>/gi, '')}</body></html>`;
  const fit = () => { try { const d = ref.current.contentDocument; setH(Math.max(60, Math.min(2400, d.documentElement.scrollHeight))); } catch(e){} };
  return <iframe ref={ref} title="Email content" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" srcDoc={doc} onLoad={fit}
    style={{width:'100%', height:h, border:`1px solid ${T.border}`, borderRadius:8, background:'#fff', display:'block'}}/>;
}
function EmailBody({a}){ return a.html ? <EmailHtmlFrame html={a.html}/> : <ReadValue>{a.body}</ReadValue>; }
/* A thread: every message, oldest first — each opens to its content; the latest (and the one
   chosen) start open. */
function EmailThreadView({thread, open: openId, contact}){
  const [open, setOpen] = React.useState(() => new Set([thread[thread.length - 1].id, openId]));
  return (
    <div style={{display:'flex', flexDirection:'column', gap:8}}>
      {thread.map(m => {
        const on = open.has(m.id), actor = activityActor(m, contact);
        const who = m.direction === 'received' ? (actor ? actor.name : 'Customer') : (actor ? actor.name : '');
        return (
          <div key={m.id} style={{border:`1px solid ${T.border}`, borderRadius:10, overflow:'hidden'}}>
            <button onClick={()=>setOpen(s => { const n = new Set(s); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n; })} aria-expanded={on}
              style={{width:'100%', display:'flex', alignItems:'baseline', gap:8, padding:'10px 12px', border:'none', background: on ? '#fff' : T.headerBg, cursor:'pointer', fontFamily:'inherit', textAlign:'left'}}>
              <span style={{fontSize:13, fontWeight:600, color:T.attioText, flexShrink:0}}>{who || (m.direction === 'received' ? 'Received' : 'Sent')}</span>
              <span style={{flex:1, minWidth:0, fontSize:12.5, color:T.attioMuted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                {on ? (m.to && m.to.length ? `to ${m.to.join(', ')}` : '') : (m.html ? m.title : String(m.body || '').replace(/\s+/g, ' '))}
              </span>
              <span style={{fontSize:12, color:T.attioMuted, flexShrink:0}}>{m.status === 'scheduled' ? `Scheduled · ${fmtActStamp(new Date(m.scheduledFor || m.at))}` : fmtActStamp(new Date(m.at))}</span>
            </button>
            {on && <div style={{padding:'4px 12px 12px'}}><EmailBody a={m}/></div>}
          </div>
        );
      })}
    </div>
  );
}

Object.assign(window, {EmailComposer, templateText, emailFirstName, emailSubjectKey, emailThreadsOf, emailThreadOf, threadedEmailRows, EmailHtmlFrame, EmailBody, EmailThreadView});
