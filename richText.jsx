/* HOF Pulse ERP — Rich text: one editor for every rich-text area (quote descriptions, terms and
   conditions, service descriptions), and its read-only view.

   The editor supports bold, italic and underline; numbered, bulleted and alphabetical lists;
   and links. The value is HTML, kept to those few tags (sanitizeRichText) — anything pasted in
   is reduced to them. Plain text saved before (no tags) shows as paragraphs.
   `ctas` (the Default HTML Template email, emails.jsx) adds Primary CTA and Secondary CTA: a
   link on its own line, marked data-cta="primary" | "secondary", drawn as a button.
   The document editor (documents.jsx) turns on more, each kept by the sanitizer only when asked
   (RICH_DOC): `sizes` — text size in points (10 to 36: SPAN data-size; the toolbar shows the size
   at the cursor); `images` —
   pictures in the text (IMG with a data: image source, ≤1 MB); `embeds` — elements placed in the
   text (DIV data-embed="payment" | "signature" | "record" with data-id), saved empty: what they show is drawn
   from their data where they're shown, and clicking one in the editor opens it. `tools` adds the
   caller's own toolbar buttons (they insert at the cursor); `toolbarTarget` puts the toolbar
   elsewhere (above the page); `page` drops the editor's box, for a page that is the editor. */

const RICH_TAGS = ['B', 'STRONG', 'I', 'EM', 'U', 'OL', 'UL', 'LI', 'A', 'P', 'BR', 'DIV'];
// Plain text (saved before rich text) → paragraphs; HTML is kept as it is.
const richHtmlOf = (v) => {
  const s = String(v || '');
  if(/<[a-z][\s\S]*>/i.test(s)) return s;
  return s.split(/\n{2,}/).map(p => p.trim()).filter(Boolean).map(p => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br/>')}</p>`).join('');
};
// Text sizes (data-size, in px), from the browser's font sizes (1–7, pasted) and the named sizes saved before.
const RICH_SIZES = ['10', '11', '12', '13', '14', '16', '18', '20', '24', '28', '32', '36'];
const RICH_FONT_SIZE = {'1':'10', '2':'12', '3':'14', '4':'16', '5':'18', '6':'24', '7':'32'};
const RICH_OLD_SIZES = {sm:'12', md:'14', lg:'18', xl:'24'};
const RICH_EMBEDS = ['payment', 'signature', 'record'];
const RICH_DOC = {sizes:true, images:true, embeds:true};   // what the document editor keeps
// Only the editor's tags survive; links keep an http(s) or mailto href and open in a new tab. `opts`: see the header.
function sanitizeRichText(html, opts = {}){
  const box = document.createElement('div');
  box.innerHTML = html || '';
  const extra = (n) => (opts.sizes && n.tagName === 'SPAN' && (RICH_SIZES.includes(n.getAttribute('data-size')) || !!RICH_OLD_SIZES[n.getAttribute('data-size')]))
    || (opts.images && n.tagName === 'IMG' && /^data:image\//.test(n.getAttribute('src') || ''))
    || (opts.embeds && n.tagName === 'DIV' && RICH_EMBEDS.includes(n.getAttribute('data-embed')) && /^[\w-]+$/.test(n.getAttribute('data-id') || ''));
  const walk = (node) => {
    [...node.childNodes].forEach(n => {
      if(n.nodeType === 3) return;
      // The browser's font sizes become text sizes.
      if(opts.sizes && n.nodeType === 1 && n.tagName === 'FONT' && RICH_FONT_SIZE[n.getAttribute('size')]){
        const span = document.createElement('span'); span.setAttribute('data-size', RICH_FONT_SIZE[n.getAttribute('size')]); span.append(...n.childNodes); n.replaceWith(span); walk(span); return;
      }
      if(n.nodeType === 1 && extra(n)){
        const keep = n.tagName === 'SPAN' ? ['data-size'] : n.tagName === 'IMG' ? ['src'] : ['data-embed', 'data-id'];
        if(n.tagName === 'SPAN' && RICH_OLD_SIZES[n.getAttribute('data-size')]) n.setAttribute('data-size', RICH_OLD_SIZES[n.getAttribute('data-size')]);
        [...n.attributes].forEach(a => { if(!keep.includes(a.name)) n.removeAttribute(a.name); });
        if(n.tagName === 'DIV'){ n.innerHTML = ''; return; }   // an embed is saved empty
        walk(n); return;
      }
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
  box.querySelectorAll('p, div').forEach(n => { if(!n.textContent.trim() && !n.matches('[data-embed]') && !n.querySelector('br, li, img, [data-embed]')) n.remove(); });
  return box.innerHTML;
}
const richIsEmpty = (html) => { const d = document.createElement('div'); d.innerHTML = html || ''; return !d.textContent.trim() && !d.querySelector('img, [data-embed]'); };
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
.hof-rich a[data-cta="primary"]{background:${T.black};color:#fff}.hof-rich a[data-cta="secondary"]{background:#fff;color:${T.black}}
${RICH_SIZES.map(n => `.hof-rich span[data-size="${n}"]{font-size:${n}px}`).join('')}
.hof-rich img{display:block;max-width:100%;height:auto;margin:8px 0;border-radius:6px}.hof-rich [data-embed]{margin:14px 0;position:relative}
.hof-rich-edit [data-embed]{cursor:pointer;border-radius:10px}.hof-rich-edit [data-embed]:hover{box-shadow:0 0 0 2px ${T.blueLight}}
.hof-rich-edit [data-embed-remove]{position:absolute;top:6px;right:6px;width:22px;height:22px;border:none;border-radius:6px;background:#fff;box-shadow:0 0 0 1px ${T.borderStrong};cursor:pointer;display:none;align-items:center;justify-content:center;font-size:14px;line-height:1;color:${T.gray600}}
.hof-rich-edit [data-embed]:hover [data-embed-remove]{display:flex}`;
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
const RICH_SIZE_TOOLS = RICH_SIZES;
const RICH_IMAGE_MAX = 1024 * 1024;
/* `embeds` {render(kind, id) → its HTML, onOpen(kind, id), key (changes when their data does)};
   `tools({insert, keep})` → the caller's toolbar buttons: `keep()` on press remembers the cursor,
   `insert(html)` puts the HTML there later (at the end without one). */
function RichTextEditor({value, onChange, placeholder, minHeight = 110, ariaLabel, ctas, sizes, images, embeds, tools, toolbarTarget, page}){
  const opts = {sizes:!!sizes, images:!!images, embeds:!!embeds};
  const ref = React.useRef(null);
  const fileRef = React.useRef(null);
  const [sizing, setSizing] = React.useState(false);
  const [curSize, setCurSize] = React.useState(null);   // the text size at the cursor (px), shown on Text Size
  const [imageError, setImageError] = React.useState('');
  const saved = React.useRef(null);   // the selection while the link address is typed
  const [linking, setLinking] = React.useState(false);
  const [url, setUrl] = React.useState('https://');
  const [cta, setCta] = React.useState(null);   // {kind, label, url} while a CTA is being added
  const [empty, setEmpty] = React.useState(() => richIsEmpty(richHtmlOf(value)));
  // Embeds show what their data says, and can't be typed into.
  const embedsRef = React.useRef(embeds); embedsRef.current = embeds;   // the latest, for an insert made after their data changed
  const hydrate = () => { const em = embedsRef.current, el = ref.current; if(!em || !el) return; el.querySelectorAll('[data-embed]').forEach(n => {
    n.setAttribute('contenteditable', 'false'); n.innerHTML = em.render(n.getAttribute('data-embed'), n.getAttribute('data-id')) || ''; });
    // Room to write after an element that ends the text.
    if(el.lastElementChild && el.lastElementChild.matches('[data-embed]')){ const p = document.createElement('p'); p.innerHTML = '<br>'; el.appendChild(p); } };
  // The editor owns its content while it's in use; a new value from outside replaces it.
  React.useEffect(() => {
    const el = ref.current; if(!el) return;
    const next = sanitizeRichText(richHtmlOf(value), opts);
    if(sanitizeRichText(el.innerHTML, opts) !== next){ el.innerHTML = next; hydrate(); }
    setEmpty(richIsEmpty(next));
  }, [value]);
  React.useEffect(() => { hydrate(); }, [embeds && embeds.key]);
  const emit = () => { const html = sanitizeRichText(ref.current.innerHTML, opts); setEmpty(richIsEmpty(html)); onChange(html); };
  // Insert HTML where the cursor was (kept with `keepSelection`), else at the end.
  const insert = (html) => {
    const el = ref.current; el.focus();
    if(saved.current && el.contains(saved.current.startContainer)){ const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(saved.current); }
    else { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); }
    document.execCommand('insertHTML', false, html);
    saved.current = null; hydrate(); emit();
  };
  // Text size: the selection marked with the browser's font size, then given the size chosen (an inner size wins over an outer one).
  const setSize = (n) => {
    restore(); document.execCommand('styleWithCSS', false, false); document.execCommand('fontSize', false, '7');
    ref.current.querySelectorAll('font[size]').forEach(f => { f.querySelectorAll('span[data-size]').forEach(x => x.replaceWith(...x.childNodes));
      const span = document.createElement('span'); span.setAttribute('data-size', f.getAttribute('size') === '7' ? n : RICH_FONT_SIZE[f.getAttribute('size')] || '14'); span.append(...f.childNodes); f.replaceWith(span); });
    setSizing(false); setCurSize(Number(n)); emit();
  };
  // The size at the cursor, for the Text Size button.
  const readSize = () => { const sel = window.getSelection(), n = sel && sel.anchorNode; if(!n || !ref.current || !ref.current.contains(n)) return;
    const el = n.nodeType === 3 ? n.parentElement : n; setCurSize(Math.round(parseFloat(getComputedStyle(el).fontSize))); };
  const pickImage = (f) => {
    if(!f) return;
    if(!/^image\//.test(f.type)) return setImageError('Choose an image file (PNG, JPG or SVG).');
    if(f.size > RICH_IMAGE_MAX) return setImageError('Choose an image under 1 MB.');
    const r = new FileReader(); r.onload = () => { setImageError(''); insert(`<p><img src="${r.result}"></p>`); }; r.readAsDataURL(f);
  };
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
  const toolbar = (
      <div style={page ? {display:'flex', alignItems:'center', gap:2, flexWrap:'wrap'} : {display:'flex', alignItems:'center', gap:2, padding:'4px 6px', borderBottom:`1px solid ${T.attioLine}`, background:T.headerBg, flexWrap:'wrap'}}>
        {RICH_TOOLS.map((t, i) => (
          <React.Fragment key={t.id}>
            {(i === 3 || i === 6) && <span style={{width:1, height:16, background:T.borderStrong, margin:'0 4px'}}/>}
            <button type="button" title={t.title} aria-label={t.title} onMouseDown={e=>e.preventDefault()} onClick={()=>run(t.id)} style={btn}
              onMouseEnter={e=>e.currentTarget.style.background = '#E9EAEE'} onMouseLeave={e=>e.currentTarget.style.background = 'transparent'}>{t.label}</button>
          </React.Fragment>
        ))}
        {sizes && <>
          <span style={{width:1, height:16, background:T.borderStrong, margin:'0 4px'}}/>
          <div style={{position:'relative'}}>
            <button type="button" title="Text Size" aria-label="Text Size" onMouseDown={e=>{ e.preventDefault(); keepSelection(); }} onClick={()=>setSizing(v => !v)}
              style={{...btn, width:52, justifyContent:'space-between', padding:'0 6px', gap:4, fontSize:12.5, border:`1px solid ${T.borderStrong}`, background:'#fff', fontVariantNumeric:'tabular-nums'}}>
              {curSize || (page ? 14 : 13)} <Icon name="chevDown" size={10} color={T.gray600}/></button>
            <MenuShell open={sizing} onClose={()=>setSizing(false)} width={90}>
              {RICH_SIZE_TOOLS.map(n => <MenuItem key={n} label={n} onClick={()=>setSize(n)}/>)}
            </MenuShell>
          </div>
        </>}
        {images && <>
          <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{ pickImage(e.target.files[0]); e.target.value = ''; }}/>
          <button type="button" title="Insert Image" aria-label="Insert Image" onMouseDown={e=>{ e.preventDefault(); keepSelection(); }} onClick={()=>fileRef.current.click()}
            style={{...btn, width:'auto', padding:'0 6px', gap:4, fontSize:12.5}}><Icon name="paperclip" size={12} color={T.gray600}/> Image</button>
        </>}
        {tools && <><span style={{flex:1}}/>{tools({insert, keep:keepSelection})}</>}
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
        {imageError && <span style={{flex:'1 1 100%', fontSize:12, color:T.red, padding:'2px 4px'}}>{imageError}</span>}
      </div>
  );
  return (
    <div style={page ? {} : {border:`1px solid ${T.borderStrong}`, borderRadius:8, background:'#fff', overflow:'hidden'}}>
      <RichTextStyles/>
      {toolbarTarget ? ReactDOM.createPortal(toolbar, toolbarTarget) : page ? null : toolbar}
      <div style={{position:'relative'}}>
        {empty && placeholder && <div style={{position:'absolute', top: page ? 0 : 9, left: page ? 0 : 12, fontSize:13, color:T.gray400, pointerEvents:'none'}}>{placeholder}</div>}
        <div ref={ref} className={embeds ? 'hof-rich hof-rich-edit' : 'hof-rich'} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={ariaLabel}
          onInput={emit} onBlur={emit} onKeyUp={()=>{ keepSelection(); if(sizes) readSize(); }} onMouseUp={()=>{ keepSelection(); if(sizes) readSize(); }}
          // An embed opens when clicked; its × takes it out.
          onClick={e=>{ if(!embeds) return; const n = e.target.closest && e.target.closest('[data-embed]'); if(!n || !ref.current.contains(n)) return;
            e.preventDefault(); if(e.target.closest('[data-embed-remove]')){ n.remove(); emit(); } else embeds.onOpen(n.getAttribute('data-embed'), n.getAttribute('data-id')); }}
          onPaste={e=>{ e.preventDefault(); const html = e.clipboardData.getData('text/html'); const text = e.clipboardData.getData('text/plain');
            document.execCommand('insertHTML', false, html ? sanitizeRichText(html, {sizes:opts.sizes}) : richHtmlOf(text) || text); emit(); }}
          style={page ? {minHeight, padding:0, fontSize:14, color:T.attioText, lineHeight:1.6, outline:'none'}
            : {minHeight, height:minHeight, padding:'8px 12px', fontSize:13, color:T.attioText, lineHeight:1.55, outline:'none',
            /* Drag the corner to make it taller (or back down to its starting height). */
            resize:'vertical', overflowY:'auto', boxSizing:'border-box'}}/>
      </div>
    </div>
  );
}

Object.assign(window, {richTextPlain, RichTextEditor, RichTextView, RichTextStyles, sanitizeRichText, richHtmlOf, richIsEmpty, RICH_DOC});
