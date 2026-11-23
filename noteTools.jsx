/* HOF Pulse ERP — Dictation and @mentions (defined 2026-11-19).

   Dictation: every open text area — a textarea, or a rich text editor (notes, replies, documents,
   quotes, emails, services …), never a one-line field — shows a microphone at its bottom right
   while it's being written in. Clicking it starts listening (the browser's Web Speech API, as the
   call panel's transcript); what's said is typed in where the cursor is, until it's clicked again
   or the field is left. "Voice note" is the same thing (Mohsin: no recording is kept).
   One DictationHost, mounted once, serves every field.

   @mentions: in a note or a reply (any field inside `data-mentions`), typing @ lists the CRM's
   active users; picking one writes "@Full Name". When the note or reply is saved, each person
   newly tagged gets a bell notification that opens the record, and an email (`mentions` on the
   note or reply keeps who was tagged and emailed, and when). Tagged names show in blue.
   One MentionsHost, mounted once, serves every field. */

/* ── @mentions ─────────────────────────────────────────────────────────────────────────── */

// The people who can be tagged: the CRM's users who are signed up (not pending or deactivated).
const mentionUsers = (data) => ((data && data.users) || []).filter(u => u && u.name && (!u.status || u.status === 'Activated'));
const mentionEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// One pattern for every tag: the longest names first, so "@Ali Raza" isn't read as "@Ali".
const mentionPattern = (users) => { const names = [...new Set(users.map(u => u.name))].sort((a, b) => b.length - a.length);
  return names.length ? new RegExp(`@(${names.map(mentionEsc).join('|')})(?![A-Za-z0-9])`, 'g') : null; };
// The users a text (plain or a note's HTML) tags.
function mentionedIn(text, users){
  const re = mentionPattern(users); if(!re) return [];
  const plain = richTextPlain(text || ''), names = new Set();
  let m; while((m = re.exec(plain))) names.add(m[1]);
  return users.filter(u => names.has(u.name));
}
// A note's HTML with its tags in blue (after it's sanitized: the spans are added for showing only).
function highlightMentionsHtml(html, users){
  const re = mentionPattern(users); if(!re || !html || html.indexOf('@') < 0) return html;
  const box = document.createElement('div'); box.innerHTML = html;
  const walk = (node) => [...node.childNodes].forEach(n => {
    if(n.nodeType === 1) return walk(n);
    if(n.nodeType !== 3 || n.textContent.indexOf('@') < 0) return;
    const t = n.textContent, frag = document.createDocumentFragment(); let last = 0, m; re.lastIndex = 0;
    while((m = re.exec(t))){ frag.append(t.slice(last, m.index)); const s = document.createElement('span');
      s.setAttribute('style', `color:${T.attioBlue};font-weight:500`); s.textContent = m[0]; frag.append(s); last = m.index + m[0].length; }
    if(last){ frag.append(t.slice(last)); n.replaceWith(frag); }
  });
  walk(box); return box.innerHTML;
}
// A plain text (a reply) with its tags in blue.
function MentionText({text, users}){
  const re = mentionPattern(users || []);
  if(!re || !text || text.indexOf('@') < 0) return text || null;
  const out = []; let last = 0, m;
  while((m = re.exec(text))){ out.push(text.slice(last, m.index)); out.push(<span key={m.index} style={{color:T.attioBlue, fontWeight:500}}>{m[0]}</span>); last = m.index + m[0].length; }
  out.push(text.slice(last)); return out;
}
/* After a note or reply is saved: (text before, text now, 'a note' | 'a reply') → the newly tagged
   people, notified in their bell (opening the record on its Notes) and emailed; returns the
   `mentions` entries to keep on it (null: nobody new). Tagging yourself notifies no one. */
function useMentionNotify(){
  const hub = useRecordHub(), engineCtx = useWorkflowEngineCtx(), ra = useRecordAccess();
  return (before, after, what = 'a note') => {
    if(!hub) return null;
    const users = mentionUsers(hub.data);
    const had = new Set(mentionedIn(before, users).map(u => u.id));
    const fresh = mentionedIn(after, users).filter(u => !had.has(u.id) && u.name !== CURRENT_USER.name);
    if(!fresh.length) return null;
    const recordName = ra && ra.record ? ra.record.name : '';
    const snippet = richTextPlain(after || '').replace(/\s+/g, ' ').trim().slice(0, 140);
    const text = `${CURRENT_USER.name} tagged you in ${what}${recordName ? ` on ${recordName}` : ''}: "${snippet}"`;
    if(engineCtx && engineCtx.api && engineCtx.api.notifyUsers)
      engineCtx.api.notifyUsers(fresh.map(u => u.id), recordName || 'Tagged', text, ra && ra.record ? ra.record.id : null, 'notes', 'mention');
    const at = new Date().toISOString();
    return fresh.map(u => ({userId:u.id, name:u.name, email:u.email || '', by:CURRENT_USER.name, at, emailed:true}));
  };
}
const withMentions = (item, entries) => entries ? {mentions:[...((item && item.mentions) || []), ...entries]} : {};

// What's being typed after an @ at the cursor in a textarea or a rich text editor, if anything.
const MENTION_AT = /(^|[\s(])@([^\s@]{0,30})$/;
function mentionQueryAt(el){
  if(el.tagName === 'TEXTAREA'){
    const pos = el.selectionStart; if(pos == null || pos !== el.selectionEnd) return null;
    const m = MENTION_AT.exec(el.value.slice(0, pos)); if(!m) return null;
    const r = el.getBoundingClientRect();
    return {kind:'textarea', from:pos - m[2].length - 1, to:pos, query:m[2], x:r.left + 8, top:r.top, bottom:r.bottom};
  }
  const sel = window.getSelection(); if(!sel || !sel.rangeCount || !sel.isCollapsed) return null;
  const node = sel.anchorNode, off = sel.anchorOffset;
  if(!node || node.nodeType !== 3 || !el.contains(node)) return null;
  const m = MENTION_AT.exec(node.textContent.slice(0, off)); if(!m) return null;
  const range = document.createRange(); range.setStart(node, off - m[2].length - 1); range.setEnd(node, off);
  const rr = range.getBoundingClientRect();
  return {kind:'rich', node, from:off - m[2].length - 1, to:off, query:m[2], x:rr.left, top:rr.top, bottom:rr.bottom};
}
function MentionsHost(){
  const hub = useRecordHub();
  const [st, setSt] = React.useState(null);
  const [hi, setHi] = React.useState(0);
  const users = hub ? mentionUsers(hub.data) : [];
  const q = st ? st.query.toLowerCase() : '';
  const matches = st ? users.filter(u => u.name.toLowerCase().includes(q))
    .sort((a, b) => (b.name.toLowerCase().startsWith(q) - a.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name)).slice(0, 8) : [];
  const ref = React.useRef({}); ref.current = {st, matches, hi};
  const pick = (u) => {
    const s = ref.current.st; if(!s || !u) return;
    const el = s.el; el.focus();
    if(s.kind === 'textarea') el.setSelectionRange(s.from, s.to);
    else { const r = document.createRange(); r.setStart(s.node, s.from); r.setEnd(s.node, s.to); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); }
    document.execCommand('insertText', false, `@${u.name} `);
    setSt(null);
  };
  ref.current.pick = pick;
  React.useEffect(() => {
    const check = () => {
      const el = document.activeElement;
      if(!el || !el.closest || !el.closest('[data-mentions]') || !(el.tagName === 'TEXTAREA' || el.isContentEditable)) return setSt(null);
      const found = mentionQueryAt(el); setSt(found ? {...found, el} : null); setHi(0);
    };
    const onKey = (e) => {
      const {st:s, matches:list, hi:h} = ref.current; if(!s || !list.length) return;
      const stop = () => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); };
      if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){ stop(); setHi((h + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length); }
      else if(e.key === 'Enter' || e.key === 'Tab'){ stop(); ref.current.pick(list[Math.min(h, list.length - 1)]); }
      else if(e.key === 'Escape'){ stop(); setSt(null); }
    };
    const onDown = (e) => { if(!(e.target.closest && e.target.closest('[data-mention-menu]'))) setSt(null); };
    document.addEventListener('input', check, true);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown, true);
    return () => { document.removeEventListener('input', check, true); document.removeEventListener('keydown', onKey, true); document.removeEventListener('mousedown', onDown, true); };
  }, []);
  if(!st || !matches.length) return null;
  const H = Math.min(matches.length, 8) * 36 + 8, below = st.bottom + 4 + H < window.innerHeight;
  return ReactDOM.createPortal(
    <div data-mention-menu="1" role="listbox" aria-label="People to tag" style={{position:'fixed', left:Math.max(8, Math.min(st.x, window.innerWidth - 248)),
      ...(below ? {top:st.bottom + 4} : {bottom:window.innerHeight - st.top + 4}), width:240, zIndex:2500, background:'#fff',
      border:`1px solid ${T.borderStrong}`, borderRadius:10, boxShadow:'0 12px 28px rgba(16,24,40,.16)', padding:4}}>
      {matches.map((u, i) => (
        <div key={u.id} role="option" aria-selected={i === hi} onMouseDown={e=>{ e.preventDefault(); pick(u); }} onMouseEnter={()=>setHi(i)}
          style={{display:'flex', alignItems:'center', gap:8, height:36, padding:'0 8px', borderRadius:6, cursor:'pointer', background: i === hi ? T.headerBg : 'transparent', fontSize:13, color:T.attioText}}>
          <PersonAvatar kind="team" name={u.name}/>
          <span style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{u.name}</span>
        </div>
      ))}
    </div>, document.body);
}

/* ── Dictation ─────────────────────────────────────────────────────────────────────────── */

const dictationTarget = (t) => !!t && !(t.closest && t.closest('[data-no-dictation]'))
  && ((t.tagName === 'TEXTAREA' && !t.readOnly && !t.disabled) || (t.isContentEditable && t.getAttribute('contenteditable') === 'true'));
// Types what was said where the cursor is, with a space before it when it follows a word.
function typeDictated(el, said){
  let t = String(said || '').trim(); if(!el || !t || !document.contains(el)) return;
  if(document.activeElement !== el) el.focus();
  let before = '';
  if(el.tagName === 'TEXTAREA') before = el.value.slice(0, el.selectionStart);
  else { const s = window.getSelection(); if(s && s.anchorNode && s.anchorNode.nodeType === 3) before = s.anchorNode.textContent.slice(0, s.anchorOffset); }
  if(before && !/\s$/.test(before)) t = ' ' + t;
  document.execCommand('insertText', false, t);
}
function DictationHost(){
  const hub = useRecordHub();
  const [el, setEl] = React.useState(null);
  const [box, setBox] = React.useState(null);
  const [on, setOn] = React.useState(false);
  const live = React.useRef({el:null, rec:null, on:false});
  const stop = () => { const r = live.current.rec; if(r) try { r.stop(); } catch(e){} };
  React.useEffect(() => {
    const onIn = (e) => { if(dictationTarget(e.target)){ if(live.current.on && live.current.el !== e.target) stop(); live.current.el = e.target; setEl(e.target); } };
    const onOut = () => setTimeout(() => {
      const a = document.activeElement;
      if(a === live.current.el) return;
      if(live.current.on) stop();   // leaving the field ends the dictation
      if(!dictationTarget(a)){ live.current.el = null; setEl(null); }
    }, 0);
    document.addEventListener('focusin', onIn); document.addEventListener('focusout', onOut);
    return () => { document.removeEventListener('focusin', onIn); document.removeEventListener('focusout', onOut); stop(); };
  }, []);
  // Kept at the field's bottom right as it moves, grows or scrolls.
  React.useEffect(() => {
    if(!el) return setBox(null);
    const place = () => { if(!document.contains(el)){ live.current.el = null; setEl(null); return; }
      const r = el.getBoundingClientRect(); setBox(r.width && r.height ? {x:Math.min(r.right, window.innerWidth) - 32, y:Math.min(r.bottom, window.innerHeight) - 32, top:r.top} : null); };
    place(); const t = setInterval(place, 150); return () => clearInterval(t);
  }, [el]);
  const toggle = () => {
    if(live.current.on) return stop();
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR) return hub && hub.toast("Dictation isn't available in this browser");
    const rec = new SR();
    rec.lang = navigator.language || 'en-US'; rec.continuous = true; rec.interimResults = false;
    rec.onresult = (e) => { for(let i = e.resultIndex; i < e.results.length; i++) if(e.results[i].isFinal) typeDictated(live.current.el, e.results[i][0].transcript); };
    rec.onerror = (e) => { if(e.error === 'not-allowed' || e.error === 'service-not-allowed') hub && hub.toast('Microphone access is blocked'); };
    rec.onend = () => { live.current.on = false; live.current.rec = null; setOn(false); };
    try { rec.start(); live.current.rec = rec; live.current.on = true; setOn(true); }
    catch(err){ hub && hub.toast("Dictation couldn't start"); }
  };
  if(!el || !box || box.y < box.top) return null;
  return ReactDOM.createPortal(
    <button type="button" data-no-dictation="1" title={on ? 'Stop Dictation' : 'Dictate'} aria-label={on ? 'Stop dictation' : 'Dictate'} aria-pressed={on}
      onMouseDown={e=>e.preventDefault()} onClick={toggle}
      style={{position:'fixed', left:box.x, top:box.y, width:26, height:26, borderRadius:9999, zIndex:2400, cursor:'pointer', padding:0,
        display:'flex', alignItems:'center', justifyContent:'center', border:`1px solid ${on ? T.red : T.borderStrong}`, background: on ? T.red : '#fff',
        boxShadow: on ? `0 0 0 4px ${T.red}22` : '0 1px 2px rgba(16,24,40,.08)', transition:'background 120ms, box-shadow 120ms'}}>
      <Icon name="mic" size={13} color={on ? '#fff' : T.gray600}/>
    </button>, document.body);
}

/* ── Support notes ─────────────────────────────────────────────────────────────────────── */

// A note marked as a Support Note: a red tag wherever the note shows (its row, its details).
function SupportNoteTag(){
  return <span style={{display:'inline-flex', alignItems:'center', alignSelf:'flex-start', height:18, padding:'0 7px', borderRadius:9999, flexShrink:0,
    background:'#FEF3F2', border:`1px solid #FECDCA`, color:T.red, fontSize:11, fontWeight:600, whiteSpace:'nowrap'}}>Support Note</span>;
}
// The short line between a note's author and its Support Note tag.
const SupportNoteDivider = () => <span aria-hidden="true" style={{width:1, height:12, background:T.borderStrong, flexShrink:0}}/>;
// The note form's switch: Support Note (off to start with).
function SupportNoteSwitch({on, onChange}){
  return (
    <label style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:T.attioText, cursor:'pointer', alignSelf:'flex-start'}} onClick={(e)=>{ e.preventDefault(); onChange(!on); }}>
      <UtToggle on={on} onChange={()=>{}}/> Support Note
    </label>
  );
}

/* ── Note types (2026-11-23) ── a note is General (to start with), a Client Request or Support —
   asked first on the note form, as radios (the Support Note switch is gone, and so is the record's
   Support Notes tab). A Client Request and a Support note carry their tag wherever the note shows;
   the Notes tabs have filled pills: All, Client Request, Support, General. Saved as `noteType`
   (`support` is kept beside it for what read it before; a note saved with the switch reads Support). */
// NOTE_TYPES, noteTypeOf, noteTypePatch, NOTE_TYPE_TABS and noteInTab live in activities.jsx (read as the tab lists load).
function NoteTypeTag({a}){
  const type = noteTypeOf(a);
  if(type === 'general') return null;
  const look = type === 'support' ? {background:'#FEF3F2', border:'1px solid #FECDCA', color:T.red}
    : type === 'hubspot' ? {background:'#FFF4F0', border:'1px solid #FFD9CC', color:'#B5472B'} : {background:'#EEF4FF', border:'1px solid #D5E2FB', color:'#1F55C7'};
  return <span style={{display:'inline-flex', alignItems:'center', gap:4, alignSelf:'flex-start', height:18, padding:'0 7px', borderRadius:9999, flexShrink:0, fontSize:11, fontWeight:600, whiteSpace:'nowrap', ...look}}>
    {type === 'hubspot' && <HubSpotMark size={11}/>}{(NOTE_TYPES.find(t => t.id === type) || {}).label}</span>;
}
function NoteTypeRadios({value, onChange, name}){
  return (
    <div role="radiogroup" aria-label="Note type" style={{display:'flex', flexWrap:'wrap', gap:'10px 20px', paddingTop:7}}>
      {/* HubSpot isn't a type to pick: such notes come from HubSpot. */}
      {NOTE_TYPES.filter(t => !t.imported).map(t => (
        <label key={t.id} style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:T.attioText, cursor:'pointer', lineHeight:'16px'}}>
          <input type="radio" name={name} checked={value === t.id} onChange={()=>onChange(t.id)} style={{margin:0, width:15, height:15, flexShrink:0, accentColor:T.black, cursor:'pointer'}}/>
          {t.label}
        </label>
      ))}
    </div>
  );
}

/* ── Spring on notes (2026-11-23) ── tick a note, or Select All, and Ask Spring appears: Spring
   reads the ticked notes and gives a summary, suggests actions (Add Task, Call, Schedule Meeting,
   Draft Email — each opens the usual form, filled in) and answers questions about them, naming the
   note each line comes from. General and Client Request notes only: a Support note has no tick.
   In the product Spring is a model; here a stand-in reads the notes' words (springNotesReview,
   springNotesAnswer). The stakeholder's reference (a Claude design, "Notes (all notes + AI
   assistant)") is the idea, not the layout. */
// The row above a notes list: Select All, how many are ticked, and Ask Spring once any is.
function NoteSelectBar({total, count, onToggleAll, onAsk}){
  if(!total) return null;
  return (
    <div style={{display:'flex', alignItems:'center', gap:10, padding:'4px 20px 0', minHeight:36}}>
      <RowCheckbox checked={count === total} indeterminate={count > 0 && count < total} onChange={onToggleAll}/>
      <span onClick={onToggleAll} style={{fontSize:13, color:T.attioText, cursor:'pointer', userSelect:'none'}}>{count ? `${count} selected` : 'Select All'}</span>
      <div style={{flex:1}}/>
      {count > 0 && <SpringButton onClick={onAsk}/>}
    </div>
  );
}
const springSentence = (text, max = 150) => { const s = String(text || '').replace(/\s+/g, ' ').trim(), m = s.match(/^.*?[.!?](\s|$)/), one = (m ? m[0] : s).trim();
  return one.length > max ? `${one.slice(0, max - 1).trimEnd()}…` : one; };
const springNoteText = (it) => richTextPlain(it.act.body || '');
const SPRING_NOTE_RULES = [
  {kind:'task', test:/document|passport|certificate|transcript|ielts|statement|upload|\bcv\b|resume|form/i, label:(n) => `Collect the documents from ${n}`, cta:'Add Task', title:(n) => `Collect documents from ${n}`},
  {kind:'call', test:/call back|call (him|her|them|me)|phone|ring|speak|talk/i, label:(n) => `Call ${n}`, cta:'Call'},
  {kind:'meeting', test:/\bmeet|meeting|appointment|visit|consultation/i, label:(n) => `Schedule a meeting with ${n}`, cta:'Schedule Meeting'},
  {kind:'email', test:/email|send|quote|\bfee|price|cost|payment|invoice|detail/i, label:(n) => `Send ${n} a follow-up email`, cta:'Draft Email'},
];
// items: [{act, object, record}] → {summary, actions:[{kind, label, cta, item, title?, subject?, body?}]}
function springNotesReview(items){
  const list = [...items].sort((x, y) => new Date(y.act.at) - new Date(x.act.at));
  if(!list.length) return {summary:'', actions:[]};
  const reqs = list.filter(it => noteTypeOf(it.act) === 'clientRequest');
  const names = [...new Set(list.map(it => it.record && it.record.name).filter(Boolean))];
  const nameOf = (it) => (it.record && it.record.name) || 'the client', day = (it) => fmtActDate(new Date(it.act.at));
  const summary = list.length === 1
    ? `${noteTypeOf(list[0].act) === 'clientRequest' ? 'A client request' : 'A note'} from ${day(list[0])}. ${springSentence(springNoteText(list[0]), 240)}`
    : `${list.length} notes${names.length === 1 ? ` on ${names[0]}` : ` across ${names.length} records`}, the latest from ${day(list[0])}. `
      + (reqs.length ? `${reqs.length === 1 ? 'One is a client request' : `${reqs.length} are client requests`}: ${reqs.slice(0, 2).map(it => springSentence(springNoteText(it), 120)).join(' ')}`
        : `Latest: ${springSentence(springNoteText(list[0]), 180)}`);
  const actions = [], used = new Set();
  const push = (rule, it) => { if(used.has(rule.kind) || actions.length >= 4) return; used.add(rule.kind); const n = nameOf(it);
    actions.push({kind:rule.kind, label:rule.label(n), cta:rule.cta, item:it, ...(rule.kind === 'task' ? {title:rule.title(n)} : {}),
      ...(rule.kind === 'email' ? {subject:'Following up on our conversation', body:`<p>Hi ${String(n).split(' ')[0]},</p><p>Following up on what we discussed: ${springSentence(springNoteText(it), 200)}</p><p>Let me know if anything is missing.</p>`} : {})}); };
  list.forEach(it => { const text = springNoteText(it), hits = SPRING_NOTE_RULES.filter(r => r.test.test(text));
    hits.forEach(r => push(r, it));
    // A client request no rule read: a task to see it through.
    if(!hits.length && noteTypeOf(it.act) === 'clientRequest') push({kind:'task', label:() => 'See the client request through', cta:'Add Task', title:() => springSentence(text, 60)}, it); });
  if(!actions.length) push({kind:'task', label:(n) => `Follow up with ${n}`, cta:'Add Task', title:(n) => `Follow up with ${n}`}, list[0]);
  return {summary, actions};
}
const SPRING_NOTE_QUESTIONS = ['What did the client ask for?', 'What is still open?', 'What should I do next?'];
// → {text, sources:[item]}
function springNotesAnswer(items, question, review){
  const q = String(question || '').toLowerCase(), list = [...items].sort((x, y) => new Date(y.act.at) - new Date(x.act.at));
  const reqs = list.filter(it => noteTypeOf(it.act) === 'clientRequest');
  const lines = (its) => its.slice(0, 4).map(it => springSentence(springNoteText(it), 140)).join(' ');
  if(/next|should i|do now/.test(q)){ const a = review.actions[0]; return a ? {text:`${a.label}.`, sources:[a.item]} : {text:'Nothing in these notes needs an action.', sources:[]}; }
  if(/open|pending|outstanding|still|waiting/.test(q)){ const open = reqs.filter(it => !(it.act.replies || []).length);
    return open.length ? {text:`${open.length === 1 ? 'One client request has' : `${open.length} client requests have`} no reply yet. ${lines(open)}`, sources:open.slice(0, 4)}
      : {text: reqs.length ? 'Every client request in these notes has a reply.' : 'No client request in these notes.', sources:[]}; }
  if(/ask|request|want|need/.test(q)) return reqs.length ? {text:lines(reqs), sources:reqs.slice(0, 4)} : {text:'No client request in these notes.', sources:[]};
  const words = q.split(/[^a-z0-9]+/).filter(w => w.length > 3 && !['what', 'when', 'where', 'which', 'does', 'have', 'about', 'this', 'that', 'with', 'from', 'client', 'notes', 'note'].includes(w));
  const found = list.filter(it => { const t = springNoteText(it).toLowerCase(); return words.some(w => t.includes(w)); });
  return found.length ? {text:lines(found), sources:found.slice(0, 4)} : {text:"These notes don't say.", sources:[]};
}
const SPRING_NOTES_CSS = '@keyframes hof-spring-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}'
  + '@keyframes hof-spring-sheen{0%{background-position:-260px 0}100%{background-position:520px 0}}'
  + '@keyframes hof-spring-rise{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:none}}'
  + '.hof-spring-pulse{animation:hof-spring-pulse 1.1s ease-in-out infinite}.hof-spring-rise{animation:hof-spring-rise .32s ease-out both}'
  + '.hof-spring-sheen{background:linear-gradient(90deg,#FDEBDD 0,#FFF7F0 45%,#FDEBDD 90%);background-size:520px 100%;animation:hof-spring-sheen 1.2s linear infinite}'
  + '@media (prefers-reduced-motion: reduce){.hof-spring-pulse,.hof-spring-rise,.hof-spring-sheen{animation:none}}';
/* The panel. `items`: the ticked notes with their records; `onSource(act)`: show that note in the
   list; `onRun(action)`: do a suggested action (the host opens the form). Spring reads for a
   moment first — its mark beats, the lines shimmer in its orange — then the answer rises in. */
function SpringNotesPanel({items, onClose, onSource, onRun}){
  const ids = items.map(it => it.act.id).join(',');
  const review = React.useMemo(() => springNotesReview(items), [ids]);
  const [ready, setReady] = React.useState(false);
  const [q, setQ] = React.useState(''), [asked, setAsked] = React.useState(null);   // {q, answer} — answer null while Spring thinks
  React.useEffect(() => { setReady(false); setAsked(null); const t = setTimeout(() => setReady(true), 1100); return () => clearTimeout(t); }, [ids]);
  const timer = React.useRef(null);
  React.useEffect(() => () => clearTimeout(timer.current), []);
  const ask = (text) => { const t = String(text || '').trim(); if(!t) return; setQ(''); setAsked({q:t, answer:null});
    clearTimeout(timer.current); timer.current = setTimeout(() => setAsked({q:t, answer:springNotesAnswer(items, t, review)}), 800); };
  const scope = `${items.length} ${items.length === 1 ? 'note' : 'notes'}`;
  const head = {fontSize:12.5, fontWeight:500, color:T.attioMuted};
  const source = (it) => <button key={it.act.id} className={LINK_CLASS} onClick={()=>onSource(it.act)}
    style={{border:'none', background:'transparent', padding:0, fontFamily:'inherit', fontSize:12.5, color:T.attioText, cursor:'pointer'}}>Note · {fmtActDate(new Date(it.act.at))}</button>;
  const sheen = (w) => <div className="hof-spring-sheen" style={{height:12, borderRadius:6, width:w}}/>;
  return (
    <PageSidePanel width={520} title="Ask Spring" onClose={onClose}>
      <style>{SPRING_NOTES_CSS}</style>
      <div style={{flexShrink:0, display:'flex', alignItems:'center', gap:10, margin:'0 20px', padding:'10px 14px', borderRadius:10, background:SPRING.tint, border:`1px solid ${SPRING.line}`}}>
        <span className={ready ? undefined : 'hof-spring-pulse'} style={{display:'flex'}}><SpringMark w={24}/></span>
        <span role="status" style={{fontSize:13, color:T.attioText}}>{ready ? `Spring read ${scope}` : `Spring is reading ${scope}`}</span>
      </div>
      <div style={{flex:1, minHeight:0, overflowY:'auto', padding:'20px 20px 8px', display:'flex', flexDirection:'column', gap:24}}>
        {!ready ? <div style={{display:'flex', flexDirection:'column', gap:10}}>{sheen('92%')}{sheen('78%')}{sheen('60%')}</div> : <>
          <section className="hof-spring-rise" style={{display:'flex', flexDirection:'column', gap:8}}>
            <span style={head}>Summary</span>
            <div style={{fontSize:14, lineHeight:1.6, color:T.attioText}}>{review.summary}</div>
          </section>
          <section className="hof-spring-rise" style={{display:'flex', flexDirection:'column', gap:4, animationDelay:'.08s'}}>
            <span style={head}>Suggested Actions</span>
            {review.actions.map((a, i) => (
              <div key={i} style={{display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom: i === review.actions.length - 1 ? 'none' : `1px solid ${T.attioLine}`}}>
                <div style={{flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:3}}>
                  <span style={{fontSize:13.5, color:T.attioText}}>{a.label}</span>
                  <span style={{display:'flex'}}>{source(a.item)}</span>
                </div>
                <StSecondary label={a.cta} onClick={()=>onRun(a)}/>
              </div>
            ))}
          </section>
          {asked && <section className="hof-spring-rise" style={{display:'flex', flexDirection:'column', gap:8}}>
            <span style={{fontSize:13.5, fontWeight:600, color:T.attioText}}>{asked.q}</span>
            {!asked.answer ? <div style={{display:'flex', flexDirection:'column', gap:10}}>{sheen('84%')}{sheen('52%')}</div> : <div className="hof-spring-rise" style={{display:'flex', flexDirection:'column', gap:8}}>
              <div style={{fontSize:14, lineHeight:1.6, color:T.attioText}}>{asked.answer.text}</div>
              {asked.answer.sources.length > 0 && <div style={{display:'flex', flexWrap:'wrap', gap:'4px 14px'}}>{asked.answer.sources.map(source)}</div>}
            </div>}
          </section>}
        </>}
      </div>
      {/* Ask: three ready questions, or one's own. */}
      <div style={{flexShrink:0, borderTop:`1px solid ${T.border}`, padding:'12px 20px 16px', display:'flex', flexDirection:'column', gap:10, opacity: ready ? 1 : .5, pointerEvents: ready ? 'auto' : 'none'}}>
        <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
          {SPRING_NOTE_QUESTIONS.map(t => <button key={t} type="button" onClick={()=>ask(t)}
            style={{height:28, padding:'0 10px', borderRadius:9999, border:`1px solid ${SPRING.line}`, background:'#fff', color:T.attioText, fontSize:12.5, fontFamily:'inherit', cursor:'pointer', whiteSpace:'nowrap'}}>{t}</button>)}
        </div>
        <form onSubmit={(e)=>{ e.preventDefault(); ask(q); }} style={{display:'flex', alignItems:'center', gap:8}}>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Ask about these notes" aria-label="Ask Spring"
            style={{flex:1, minWidth:0, height:36, boxSizing:'border-box', border:`1px solid ${T.borderStrong}`, borderRadius:8, padding:'0 12px', fontSize:13, fontFamily:'inherit', color:T.attioText, outline:'none'}}/>
          <button type="submit" disabled={!q.trim()} title="Ask" aria-label="Ask" style={{width:36, height:36, borderRadius:8, border:'none', background: q.trim() ? T.black : T.gray400, cursor: q.trim() ? 'pointer' : 'default', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
            <Icon name="arrowUp" size={14} color="#fff"/></button>
        </form>
      </div>
    </PageSidePanel>
  );
}
Object.assign(window, {NoteTypeTag, NoteTypeRadios, NoteSelectBar, SpringNotesPanel, springNotesReview, springNotesAnswer, mentionUsers, mentionedIn, highlightMentionsHtml, MentionText, useMentionNotify, withMentions, MentionsHost, DictationHost, SupportNoteTag, SupportNoteDivider, SupportNoteSwitch});
