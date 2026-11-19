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
      engineCtx.api.notifyUsers(fresh.map(u => u.id), recordName || 'Tagged', text, ra && ra.record ? ra.record.id : null, 'notes');
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
// The note form's switch: Support Note (off to start with).
function SupportNoteSwitch({on, onChange}){
  return (
    <label style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:T.attioText, cursor:'pointer', alignSelf:'flex-start'}} onClick={(e)=>{ e.preventDefault(); onChange(!on); }}>
      <UtToggle on={on} onChange={()=>{}}/> Support Note
    </label>
  );
}

Object.assign(window, {mentionUsers, mentionedIn, highlightMentionsHtml, MentionText, useMentionNotify, withMentions, MentionsHost, DictationHost, SupportNoteTag, SupportNoteSwitch});
