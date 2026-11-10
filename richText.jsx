/* HOF Pulse ERP — Rich text: one editor for every rich-text area (quote descriptions, terms and
   conditions, service descriptions), and its read-only view.

   The editor supports bold, italic and underline; numbered, bulleted and alphabetical lists;
   and links. The value is HTML, kept to those few tags (sanitizeRichText) — anything pasted in
   is reduced to them. Plain text saved before (no tags) shows as paragraphs.
   `ctas` (the Default HTML Template email, emails.jsx) adds Primary CTA and Secondary CTA: a
   link on its own line, marked data-cta="primary" | "secondary", drawn as a button. */

const RICH_TAGS = ['B', 'STRONG', 'I', 'EM', 'U', 'OL', 'UL', 'LI', 'A', 'P', 'BR', 'DIV'];
// Plain text (saved before rich text) → paragraphs; HTML is kept as it is.
const richHtmlOf = (v) => {
  const s = String(v || '');
  if(/<[a-z][\s\S]*>/i.test(s)) return s;
  return s.split(/\n{2,}/).map(p => p.trim()).filter(Boolean).map(p => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br/>')}</p>`).join('');
};
// Only the editor's tags survive; links keep an http(s) or mailto href and open in a new tab.
function sanitizeRichText(html){
  const box = document.createElement('div');
  box.innerHTML = html || '';
  const walk = (node) => {
    [...node.childNodes].forEach(n => {
      if(n.nodeType === 3) return;
      if(n.nodeType !== 1 || !RICH_TAGS.includes(n.tagName)){
        if(n.nodeType === 1){ walk(n); n.replaceWith(...n.childNodes); } else n.remove();
        return;
      }
      const keep = {};
      if(n.tagName === 'A'){ const href = n.getAttribute('href') || ''; if(/^(https?:|mailto:)/i.test(href)) keep.href = href;
        const cta = n.getAttribute('data-cta'); if(cta === 'primary' || cta === 'secondary') keep['data-cta'] = cta; }
      if(n.tagName === 'OL' && (n.getAttribute('type') === 'a' || /lower-alpha/.test(n.getAttribute('style') || ''))) keep.type = 'a';
      [...n.attributes].forEach(a => n.removeAttribute(a.name));
      Object.entries(keep).forEach(([k, v]) => n.setAttribute(k, v));
      if(n.tagName === 'A'){ n.setAttribute('target', '_blank'); n.setAttribute('rel', 'noopener noreferrer'); }
      walk(n);
    });
  };
  walk(box);
  // Empty paragraphs the editor leaves behind (e.g. before a list) go.
  box.querySelectorAll('p, div').forEach(n => { if(!n.textContent.trim() && !n.querySelector('br, li')) n.remove(); });
  return box.innerHTML;
}
const richIsEmpty = (html) => { const d = document.createElement('div'); d.innerHTML = html || ''; return !d.textContent.trim(); };
/* Rich text as one line of plain text (a note's row in a timeline, a list, a search): its words,
   each paragraph and list item apart. Plain text is returned as it is. */
const richTextPlain = (v) => {
  const s = String(v || '');
  if(!/<[a-z][\s\S]*>/i.test(s)) return s;
  const d = document.createElement('div');
  d.innerHTML = sanitizeRichText(s).replace(/<\/(p|li|div)>|<br\s*\/?>/gi, (m) => `${m} `);
  return d.textContent.replace(/\s+/g, ' ').trim();
};
const RICH_CSS = `.hof-rich p{margin:0 0 8px}.hof-rich p:last-child{margin-bottom:0}.hof-rich ol,.hof-rich ul{margin:0 0 8px;padding-left:22px}
.hof-rich ol[type="a"]{list-style-type:lower-alpha}.hof-rich li{margin:2px 0}.hof-rich a{color:${T.attioBlue};text-decoration:underline}
.hof-rich a[data-cta]{display:inline-block;margin:4px 0;padding:6px 16px;border-radius:980px;text-decoration:none;font-weight:500;font-size:12.5px;border:1px solid ${T.black}}
.hof-rich a[data-cta="primary"]{background:${T.black};color:#fff}.hof-rich a[data-cta="secondary"]{background:#fff;color:${T.black}}`;
function RichTextStyles(){ return <style>{RICH_CSS}</style>; }

// The read-only view, wherever rich text is shown (the quote, a service's detail).
function RichTextView({html, style}){
  const clean = React.useMemo(() => sanitizeRichText(richHtmlOf(html)), [html]);
  if(richIsEmpty(clean)) return null;
  return <><RichTextStyles/><div className="hof-rich" style={{fontSize:13, color:T.attioText, lineHeight:1.55, ...style}} dangerouslySetInnerHTML={{__html:clean}}/></>;
}

const RICH_TOOLS = [
  {id:'bold', title:'Bold', label:<b>B</b>},
  {id:'italic', title:'Italic', label:<i style={{fontFamily:'Georgia, serif'}}>I</i>},
  {id:'underline', title:'Underline', label:<u>U</u>},
  {id:'ol', title:'Numbered list', label:'1.'},
  {id:'ul', title:'Bulleted list', label:'•'},
  {id:'alpha', title:'Alphabetical list', label:'a.'},
  {id:'link', title:'Link', label:<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>},
];
/* The editor. `value` / `onChange`: HTML. The toolbar acts on the selection; Link asks for the
   address in the toolbar itself (the selected text becomes the link). `ctas`: Primary CTA and
   Secondary CTA ask for the button's label and address, then put it on its own line where the
   cursor is. */
const RICH_CTA_TOOLS = [{id:'primary', label:'Primary CTA'}, {id:'secondary', label:'Secondary CTA'}];
function RichTextEditor({value, onChange, placeholder, minHeight = 110, ariaLabel, ctas}){
  const ref = React.useRef(null);
  const saved = React.useRef(null);   // the selection while the link address is typed
  const [linking, setLinking] = React.useState(false);
  const [url, setUrl] = React.useState('https://');
  const [cta, setCta] = React.useState(null);   // {kind, label, url} while a CTA is being added
  const [empty, setEmpty] = React.useState(() => richIsEmpty(richHtmlOf(value)));
  // The editor owns its content while it's in use; a new value from outside replaces it.
  React.useEffect(() => {
    const el = ref.current; if(!el) return;
    const next = sanitizeRichText(richHtmlOf(value));
    if(sanitizeRichText(el.innerHTML) !== next) el.innerHTML = next;
    setEmpty(richIsEmpty(next));
  }, [value]);
  const emit = () => { const html = sanitizeRichText(ref.current.innerHTML); setEmpty(richIsEmpty(html)); onChange(html); };
  const keepSelection = () => { const sel = window.getSelection(); saved.current = sel && sel.rangeCount && ref.current.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null; };
  const restore = () => { const sel = window.getSelection(); if(saved.current){ sel.removeAllRanges(); sel.addRange(saved.current); } else ref.current.focus(); };
  const run = (id) => {
    ref.current.focus();
    if(['bold', 'italic', 'underline'].includes(id)) document.execCommand(id);
    if(id === 'ul') document.execCommand('insertUnorderedList');
    if(id === 'ol' || id === 'alpha'){
      document.execCommand('insertOrderedList');
      const sel = window.getSelection();
      let n = sel && sel.anchorNode; while(n && n !== ref.current && n.nodeName !== 'OL') n = n.parentNode;
      if(n && n.nodeName === 'OL'){ if(id === 'alpha') n.setAttribute('type', 'a'); else n.removeAttribute('type'); }
    }
    if(id === 'link'){ keepSelection(); setUrl('https://'); setLinking(true); return; }
    emit();
  };
  const addLink = () => {
    const href = url.trim();
    if(!/^(https?:\/\/.+|mailto:.+)/i.test(href)) return;
    restore();
    const sel = window.getSelection();
    if(sel && sel.isCollapsed) document.execCommand('insertHTML', false, `<a href="${href.replace(/"/g, '&quot;')}">${href.replace(/</g, '&lt;')}</a>`);
    else document.execCommand('createLink', false, href);
    setLinking(false); emit();
  };
  const ctaReady = cta && !!cta.label.trim() && /^(https?:\/\/.+|mailto:.+)/i.test(cta.url.trim());
  // A CTA is its own line: a paragraph after the one the cursor is in (at the end without one).
  const addCta = () => {
    if(!ctaReady) return;
    const el = ref.current, p = document.createElement('p'), a = document.createElement('a');
    a.setAttribute('data-cta', cta.kind); a.setAttribute('href', cta.url.trim()); a.textContent = cta.label.trim(); p.appendChild(a);
    let n = saved.current ? saved.current.startContainer : null;
    while(n && n !== el && n.parentNode !== el) n = n.parentNode;
    if(n && n !== el) n.after(p); else el.appendChild(p);
    setCta(null); emit();
  };
  const btn = {width:28, height:26, border:'none', borderRadius:6, background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:13, color:T.attioText, fontFamily:'inherit'};
  return (
    <div style={{border:`1px solid ${T.borderStrong}`, borderRadius:8, background:'#fff', overflow:'hidden'}}>
      <RichTextStyles/>
      <div style={{display:'flex', alignItems:'center', gap:2, padding:'4px 6px', borderBottom:`1px solid ${T.attioLine}`, background:T.headerBg, flexWrap:'wrap'}}>
        {RICH_TOOLS.map((t, i) => (
          <React.Fragment key={t.id}>
            {(i === 3 || i === 6) && <span style={{width:1, height:16, background:T.borderStrong, margin:'0 4px'}}/>}
            <button type="button" title={t.title} aria-label={t.title} onMouseDown={e=>e.preventDefault()} onClick={()=>run(t.id)} style={btn}
              onMouseEnter={e=>e.currentTarget.style.background = '#E9EAEE'} onMouseLeave={e=>e.currentTarget.style.background = 'transparent'}>{t.label}</button>
          </React.Fragment>
        ))}
        {ctas && <>
          <span style={{width:1, height:16, background:T.borderStrong, margin:'0 4px'}}/>
          {RICH_CTA_TOOLS.map(t => (
            <button key={t.id} type="button" title={`Add ${t.label}`} onMouseDown={e=>e.preventDefault()}
              onClick={()=>{ ref.current.focus(); keepSelection(); setLinking(false); setCta({kind:t.id, label:'', url:'https://'}); }}
              style={{...btn, width:'auto', padding:'0 8px', fontSize:12, background: cta && cta.kind === t.id ? '#E9EAEE' : 'transparent'}}
              onMouseEnter={e=>e.currentTarget.style.background = '#E9EAEE'} onMouseLeave={e=>e.currentTarget.style.background = cta && cta.kind === t.id ? '#E9EAEE' : 'transparent'}>{t.label}</button>
          ))}
        </>}
        {linking && (
          <div style={{display:'flex', alignItems:'center', gap:6, marginLeft:6, flex:'1 1 200px', minWidth:0}}>
            <input autoFocus value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>{ if(e.key === 'Enter'){ e.preventDefault(); addLink(); } if(e.key === 'Escape') setLinking(false); }}
              aria-label="Link address" style={{...fieldText, padding:'4px 8px', flex:1, minWidth:0}}/>
            <button type="button" onClick={addLink} style={{...btnSecondarySm, padding:'4px 10px'}}>Add</button>
            <button type="button" onClick={()=>setLinking(false)} title="Cancel" style={btn}><Icon name="close" size={11} color={T.gray600}/></button>
          </div>
        )}
        {cta && (
          <div style={{display:'flex', alignItems:'center', gap:6, flex:'1 1 100%', minWidth:0, padding:'4px 0 2px'}}>
            <input autoFocus value={cta.label} onChange={e=>setCta(c => ({...c, label:e.target.value}))} placeholder="Button label" aria-label="Button label"
              onKeyDown={e=>{ if(e.key === 'Enter'){ e.preventDefault(); addCta(); } if(e.key === 'Escape') setCta(null); }}
              style={{...fieldText, padding:'4px 8px', flex:'0 1 140px', minWidth:0}}/>
            <input value={cta.url} onChange={e=>setCta(c => ({...c, url:e.target.value}))} aria-label="Button link"
              onKeyDown={e=>{ if(e.key === 'Enter'){ e.preventDefault(); addCta(); } if(e.key === 'Escape') setCta(null); }}
              style={{...fieldText, padding:'4px 8px', flex:1, minWidth:0}}/>
            <button type="button" onClick={addCta} disabled={!ctaReady} style={{...btnSecondarySm, padding:'4px 10px', opacity: ctaReady ? 1 : .5}}>Add</button>
            <button type="button" onClick={()=>setCta(null)} title="Cancel" style={btn}><Icon name="close" size={11} color={T.gray600}/></button>
          </div>
        )}
      </div>
      <div style={{position:'relative'}}>
        {empty && placeholder && <div style={{position:'absolute', top:9, left:12, fontSize:13, color:T.gray400, pointerEvents:'none'}}>{placeholder}</div>}
        <div ref={ref} className="hof-rich" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={ariaLabel}
          onInput={emit} onBlur={emit}
          onPaste={e=>{ e.preventDefault(); const html = e.clipboardData.getData('text/html'); const text = e.clipboardData.getData('text/plain');
            document.execCommand('insertHTML', false, html ? sanitizeRichText(html) : richHtmlOf(text) || text); emit(); }}
          style={{minHeight, height:minHeight, padding:'8px 12px', fontSize:13, color:T.attioText, lineHeight:1.55, outline:'none',
            /* Drag the corner to make it taller (or back down to its starting height). */
            resize:'vertical', overflowY:'auto', boxSizing:'border-box'}}/>
      </div>
    </div>
  );
}

Object.assign(window, {richTextPlain, RichTextEditor, RichTextView, sanitizeRichText, richHtmlOf, richIsEmpty});
