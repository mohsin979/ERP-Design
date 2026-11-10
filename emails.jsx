/* HOF Pulse ERP — Emails: the composer and Tools → Emails.

   Emails are record activity (type 'email'): sent from a Contact, Deal or Customer, received
   from them, or scheduled to go later. The composer writes one against any record: the record,
   who it goes to (the record's email, editable), an existing template (Settings → Templates) or
   a new email — subject, Email Format and its content (below), with a live preview; Send now, or
   Schedule for a date and time. It's also how Reply and Forward work from an email. Sent and
   scheduled emails appear on the record at once, and its workflows see them (Email Events).
   Scheduled emails go out when their time comes.

   Email formats — one model for every email the CRM writes: a template (and so a sequence's
   emails, which use their templates), a workflow's template email and the composer:
     Simple Text Body       rich text and attachments; the email signature (Brand → Email
                            Signature) is put beneath the text when it starts — part of the text,
                            so any of it can be erased;
     Default HTML Template  rich text, with Primary / Secondary CTA buttons between paragraphs,
                            set in the default branded layout (a quiet card: the company logo, the
                            text, then the signature) — the text is edited on its own;
     Custom HTML Template   an uploaded HTML file is the body; "Include email signature in body"
                            adds the signature at its end — never twice: an upload that already
                            has it starts with the box off, and it's never added again.
   Content {format, body, attachments, html, fileName, includeSignature}; emailHtmlOf() is the
   email as sent and previewed. Templates saved before formats keep the HTML they had: they read
   as Custom HTML, with no signature added.

   Tools → Emails is every email in the workspace: Inbox (received), Sent and Scheduled, with
   the record each belongs to (tools.jsx). Nothing is really sent: there is no mailbox behind
   the prototype. */

const emailFirstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';
// {{first_name}} filled in for the person an email goes to.
const fillFirstName = (s, person) => String(s || '').replace(/\{\{\s*first_name\s*\}\}/g, emailFirstName(person && person.name) || 'there');

/* ── Email formats ── (see the header) */
const EMAIL_FORMATS = [{value:'simple', label:'Simple Text Body'}, {value:'html', label:'Default HTML Template'}, {value:'custom', label:'Custom HTML Template'}];
const emailFormatLabel = (f) => (EMAIL_FORMATS.find(x => x.value === f) || {}).label || '';
const EMAIL_FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif";
const emailEsc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const emailLines = (t) => emailEsc(t).replace(/\n/g, '<br>');
// The configured email signature (Brand → Email Signature), or none while it has no name.
const emailSignatureOf = () => { const s = orgBrand().signature; return s && !s.dataUrl && String(s.name || '').trim() ? {...SIGNATURE_BLANK, ...s} : null; };
// The signature as rich text — what a Simple Text Body starts with, beneath the text.
const signatureRichHtml = (sig) => !sig ? '' : sanitizeRichText(
  `<p><b>${emailEsc(sig.name)}</b>${sig.designation ? `<br>${emailLines(sig.designation)}` : ''}</p>`
  + ([sig.email, sig.phone, sig.website].some(Boolean) ? `<p>${[sig.email, sig.phone, sig.website].filter(Boolean).map(emailEsc).join(' · ')}</p>` : '')
  + (sig.address || sig.additional ? `<p>${[sig.address, sig.additional].filter(Boolean).map(emailLines).join('<br>')}</p>` : ''));
// The company logo (Brand → Logo) as an image in an email; the HOF lockup until one is uploaded.
const emailLogoImg = (brand, height) => `<img src="${brand.logo || `data:image/svg+xml;charset=utf-8,${encodeURIComponent(logoSvgString('main', height, '#1D1D1F'))}`}" alt="${emailEsc(brand.name || '')}"`
  + ` height="${height}" style="display:block;height:${height}px;width:auto;max-width:${height * 7}px;border:0">`;
// The signature as it ends an HTML email (marked, so it's never added twice).
function signatureEmailHtml(sig, brand){
  if(!sig) return '';
  const muted = 'color:#6E6E73', cell = `font-family:${EMAIL_FONT};font-size:13px;line-height:1.5;color:#1D1D1F;vertical-align:middle`;
  const contact = [sig.email, sig.phone, sig.website].filter(Boolean).map(emailEsc).join(' &middot; ');   // wraps on a narrow screen
  const text = `<div style="font-weight:600">${emailEsc(sig.name)}</div>`
    + (sig.designation ? `<div style="${muted}">${emailLines(sig.designation)}</div>` : '')
    + (contact ? `<div style="margin-top:6px">${contact}</div>` : '')
    + (sig.address ? `<div style="${muted}">${emailLines(sig.address)}</div>` : '')
    + (sig.additional ? `<div style="${muted}">${emailLines(sig.additional)}</div>` : '');
  return `<table data-hof-signature="1" role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>`
    + (sig.includeLogo ? `<td style="padding:0 16px 0 0;border-right:2px solid #E8E8ED;vertical-align:middle">${emailLogoImg(brand, 24)}</td><td style="padding:0 0 0 16px;${cell}">` : `<td style="${cell}">`)
    + text + `</td></tr></table>`;
}
// Whether an HTML email already ends with the signature: ours (marked), or its name and email written in.
const hasEmailSignature = (html, sig) => /data-hof-signature/i.test(html || '')
  || !!(sig && sig.email && html && html.toLowerCase().includes(sig.email.toLowerCase()) && html.includes(sig.name));
// Text on a colour: dark on light brand colours, white otherwise.
const emailInkOn = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if(!m) return '#FFFFFF'; const n = parseInt(m[1], 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 170 ? '#1D1D1F' : '#FFFFFF'; };
// Rich text with its styles written in (emails carry no stylesheet); CTAs become buttons in the brand's colour.
function emailStyledBody(html, brand, size){
  const box = document.createElement('div');
  box.innerHTML = sanitizeRichText(richHtmlOf(html));
  const gap = Math.round(size * .9), accent = brand.colors.primary;
  box.querySelectorAll('p, div').forEach(n => n.setAttribute('style', `margin:0 0 ${gap}px`));
  box.querySelectorAll('ul, ol').forEach(n => n.setAttribute('style', `margin:0 0 ${gap}px;padding-left:22px${n.getAttribute('type') === 'a' ? ';list-style-type:lower-alpha' : ''}`));
  box.querySelectorAll('li').forEach(n => n.setAttribute('style', 'margin:0 0 6px'));
  box.querySelectorAll('a').forEach(a => {
    const kind = a.getAttribute('data-cta');
    if(!kind){ a.setAttribute('style', `color:${brand.colors.secondary};text-decoration:underline`); return; }
    const button = `display:inline-block;text-decoration:none;font-size:15px;font-weight:500;line-height:1;padding:13px 24px;border-radius:980px;border:1px solid ${accent};`;
    a.setAttribute('style', button + (kind === 'primary' ? `background:${accent};color:${emailInkOn(accent)}` : `background:transparent;color:${accent}`));
    a.removeAttribute('data-cta');
    const p = a.parentElement;
    if(p && p !== box && p.textContent.trim() === a.textContent.trim()) p.setAttribute('style', 'margin:26px 0');   // a CTA on its own line: room around it
  });
  return box.innerHTML;
}
/* The email as sent and previewed. Default HTML Template: the card on a light ground — logo,
   text, a hairline, the signature. Nothing else is assumed of the layout. */
function emailHtmlOf(c, brand = orgBrand()){
  const sig = emailSignatureOf();
  if(c.format === 'custom'){
    const html = String(c.html || '');
    if(!c.includeSignature || !sig || !html || hasEmailSignature(html, sig)) return html;
    const block = `<div style="padding:24px 0 0">${signatureEmailHtml(sig, brand)}</div>`;
    return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${block}</body>`) : html + block;
  }
  if(c.format === 'html') return `<div style="margin:0;padding:40px 16px;background:#F5F5F7;font-family:${EMAIL_FONT}">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:0 auto;background:#FFFFFF;border-radius:18px;border-collapse:separate;table-layout:fixed">`
    + `<tr><td style="padding:34px 44px 0">${emailLogoImg(brand, 22)}</td></tr>`
    + `<tr><td style="padding:30px 44px ${sig ? 14 : 34}px;font-family:${EMAIL_FONT};font-size:16px;line-height:1.65;color:#1D1D1F;letter-spacing:-0.01em;word-wrap:break-word;overflow-wrap:break-word">${emailStyledBody(c.body, brand, 16)}</td></tr>`
    + (sig ? `<tr><td style="padding:0 44px"><div style="height:1px;line-height:1px;font-size:0;background:#E8E8ED">&nbsp;</div></td></tr><tr><td style="padding:24px 44px 34px;word-wrap:break-word;overflow-wrap:break-word">${signatureEmailHtml(sig, brand)}</td></tr>` : '')
    + `</table></div>`;
  return `<div style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;color:#1D1D1F">${emailStyledBody(c.body, brand, 15)}</div>`;
}
// The email as one line of text (lists, search).
const emailTextOf = (c) => richTextPlain(c.format === 'custom' ? String(c.html || '').replace(/<(style|script|head|title)[\s\S]*?<\/\1>/gi, ' ') : c.body);
// A new email: Simple Text Body, the signature beneath an empty first line.
const newEmailContent = (sig = emailSignatureOf()) => ({format:'simple', body:'<p><br></p>' + signatureRichHtml(sig), attachments:[], html:'', fileName:'', includeSignature:true});
/* Another format: the signature goes into a Simple Text Body (if it isn't there) and out of the
   others, which add it themselves; the text stays — CTAs as plain links in a Simple Text Body
   (they're the Default HTML Template's). */
function switchEmailFormat(c, format, sig = emailSignatureOf()){
  const s = signatureRichHtml(sig);
  let body = sanitizeRichText(richHtmlOf(c.body || ''));
  if(format === 'simple') body = body.replace(/\sdata-cta="(primary|secondary)"/g, '');
  const has = !!s && body.includes(s);
  if(format === 'simple' && s && !has) body = (richIsEmpty(body) ? '<p><br></p>' : body) + s;
  if(format !== 'simple' && has) body = body.replace(s, '').replace(/(<p><br><\/p>)+$/i, '');
  return {...c, format, body};
}
const emailContentReady = (c) => c.format === 'custom' ? !!String(c.html || '').trim() : !richIsEmpty(c.body);
// What's kept of an email's content (a template): only what its format uses.
const emailContentToSave = (c) => ({format:c.format, body: c.format === 'custom' ? '' : c.body, attachments: c.format === 'simple' ? (c.attachments || []) : [],
  html: c.format === 'custom' ? c.html : '', fileName: c.format === 'custom' ? (c.fileName || '') : '', includeSignature: c.format === 'custom' ? !!c.includeSignature : true});
// A template's content; one saved before formats is its HTML as it was (Custom HTML, no signature added).
const templateContentOf = (t) => t.format
  ? {format:t.format, body:t.body || '', attachments:t.attachments || [], html:t.html || '', fileName:t.fileName || '', includeSignature:t.includeSignature !== false}
  : {format:'custom', body:'', attachments:[], html:t.html || richHtmlOf(t.body || ''), fileName:'', includeSignature:false};

// Attachments as chips (a file opens / downloads); `onRemove` adds ×.
function EmailAttachmentList({list, onRemove}){
  if(!(list || []).length) return null;
  return (
    <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
      {list.map(a => (
        <span key={a.id} style={{display:'inline-flex', alignItems:'center', gap:8, maxWidth:'100%', padding:'4px 6px 4px 4px', border:`1px solid ${T.border}`, borderRadius:8, background:'#fff'}}>
          <FileTile a={a} size={26}/>
          <span onClick={()=>downloadFile(a)} title={a.name} style={{minWidth:0, fontSize:12.5, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', cursor: a.dataUrl ? 'pointer' : 'default'}}>{a.name}</span>
          <span style={{fontSize:11.5, color:T.attioMuted, flexShrink:0}}>{fmtBytes(a.size)}</span>
          {onRemove && <button type="button" title="Remove" onClick={()=>onRemove(a.id)} style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:2}}><Icon name="close" size={11} color={T.gray600}/></button>}
        </span>
      ))}
    </div>
  );
}
function EmailAttachmentsField({list, update}){
  const input = React.useRef(null);
  const [error, setError] = React.useState('');
  const add = (e) => {
    const files = [...(e.target.files || [])]; e.target.value = '';
    const big = files.filter(f => f.size > FILE_MAX_BYTES);
    setError(big.length ? `Over ${fmtBytes(FILE_MAX_BYTES)}: ${big.map(f => f.name).join(', ')}` : '');
    files.filter(f => f.size <= FILE_MAX_BYTES).forEach(f => {
      const r = new FileReader();
      r.onload = () => update(l => [...l, {id:`att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, name:f.name, size:f.size, mime:f.type, dataUrl:r.result}]);
      r.readAsDataURL(f);
    });
  };
  return (
    <div style={{display:'flex', flexDirection:'column', gap:8, paddingTop:2}}>
      <EmailAttachmentList list={list} onRemove={(id)=>update(l => l.filter(a => a.id !== id))}/>
      <input ref={input} type="file" multiple onChange={add} style={{display:'none'}}/>
      <span><StSecondary label={<span style={{display:'inline-flex', alignItems:'center', gap:6}}><Icon name="paperclip" size={13} color={T.gray800}/>Attach files</span>} onClick={()=>input.current.click()}/></span>
      {error && <div style={{fontSize:12, color:T.red}}>{error}</div>}
    </div>
  );
}
function EmailHtmlUpload({c, setValue}){
  const input = React.useRef(null);
  const [error, setError] = React.useState('');
  const pick = (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if(!f) return;
    if(!/\.html?$/i.test(f.name) && f.type !== 'text/html'){ setError('Choose an .html file.'); return; }
    if(f.size > FILE_MAX_BYTES){ setError(`Over ${fmtBytes(FILE_MAX_BYTES)}.`); return; }
    const r = new FileReader();
    r.onload = () => { const html = String(r.result || ''); setError(''); setValue(x => ({...x, html, fileName:f.name, includeSignature:!hasEmailSignature(html, emailSignatureOf())})); };
    r.readAsText(f);
  };
  const upload = (label) => <StSecondary label={<span style={{display:'inline-flex', alignItems:'center', gap:6}}><Icon name="arrowUp" size={12} color={T.gray800}/>{label}</span>} onClick={()=>input.current.click()}/>;
  return (
    <div style={{display:'flex', flexDirection:'column', gap:8, paddingTop:2}}>
      <input ref={input} type="file" accept=".html,.htm,text/html" onChange={pick} style={{display:'none'}}/>
      {c.html ? (
        <div style={{display:'flex', alignItems:'center', gap:8, minWidth:0}}>
          <FileTile a={{name:c.fileName || 'email.html', mime:'text/html'}} size={26}/>
          <span style={{flex:1, minWidth:0, fontSize:13, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{c.fileName || 'Current HTML'}</span>
          {upload('Replace')}
          <StTextAction label="Remove" onClick={()=>setValue(x => ({...x, html:'', fileName:''}))}/>
        </div>
      ) : <span>{upload('Upload HTML file')}</span>}
      {error && <div style={{fontSize:12, color:T.red}}>{error}</div>}
    </div>
  );
}
/* The content fields, by format: Email Format, then the rich text (Default HTML adds the CTAs)
   with Attachments (Simple Text Body), or the HTML file with Include email signature in body. */
function EmailContentFields({value:c, setValue}){
  const toggleSig = () => setValue(x => ({...x, includeSignature:!x.includeSignature}));
  return <>
    <Field label="Email Format"><FormSelect value={c.format} options={EMAIL_FORMATS} onChange={(v)=>v && v !== c.format && setValue(x => switchEmailFormat(x, v))}/></Field>
    {c.format === 'custom' ? <>
      <Field label="HTML file"><EmailHtmlUpload c={c} setValue={setValue}/></Field>
      <Field label="">
        <div onClick={toggleSig} style={{display:'inline-flex', alignItems:'center', gap:8, paddingTop:7, fontSize:13, color:T.attioText, cursor:'pointer', userSelect:'none'}}>
          <RowCheckbox checked={!!c.includeSignature} onChange={toggleSig}/> Include email signature in body
        </div>
      </Field>
    </> : <>
      <Field label="Body" wide><RichTextEditor value={c.body} onChange={(v)=>setValue(x => ({...x, body:v}))} minHeight={280} ctas={c.format === 'html'} ariaLabel="Email body"/></Field>
      {c.format === 'simple' && <Field label="Attachments"><EmailAttachmentsField list={c.attachments || []} update={(fn)=>setValue(x => ({...x, attachments:fn(x.attachments || [])}))}/></Field>}
    </>}
  </>;
}
// The preview: the subject, the email as it will read (its format and signature), its attachments.
function EmailPreview({content, subject}){
  const html = emailHtmlOf(content);
  return <>
    {subject !== undefined && <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}><span style={{color:T.attioMuted}}>Subject&nbsp;&nbsp;</span>{subject || '—'}</div>}
    {html ? <EmailHtmlFrame html={html}/> : <div style={{fontSize:13, color:T.attioMuted, padding:'8px 0'}}>No HTML file yet</div>}
    {content.format === 'simple' && <EmailAttachmentList list={content.attachments}/>}
  </>;
}
/* An email's creation panel body: the fields on the left, the preview on the right (Brand's
   Email Signature split). */
const EMAIL_PANEL_W = 1080;
function EmailSplit({form, preview}){
  return (
    <div style={{flex:1, minWidth:0, display:'flex'}}>
      <div style={{flex:'0 0 580px', maxWidth:'58%', minWidth:0, overflowY:'auto', padding:20}}>{stack(form)}</div>
      <div style={{flex:1, minWidth:0, overflowY:'auto', borderLeft:`1px solid ${T.border}`, background:T.headerBg, padding:20, display:'flex', flexDirection:'column', gap:12}}>
        <span style={{fontSize:11, fontWeight:600, color:T.attioFaint, textTransform:'uppercase', letterSpacing:.4}}>Preview</span>
        {preview}
      </div>
    </div>
  );
}

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
  // A new email (Simple Text Body, the signature beneath); a forward carries the message under it.
  const [content, setContent] = React.useState(() => {
    const c = newEmailContent();
    return forward ? {...c, body:c.body + sanitizeRichText(`<p>---------- Forwarded message ----------</p>${richHtmlOf(forward.body || '')}`)} : c;
  });
  const [scheduling, setScheduling] = React.useState(false);
  const [date, setDate] = React.useState(() => ymdOf(new Date(Date.now() + 86400000)));
  const [time, setTime] = React.useState('09:00');
  const [error, setError] = React.useState('');
  // A record picked here fills in its email.
  React.useEffect(() => { if(!fixed && !forward) setTo((person && person.email) || ''); }, [target.object, target.id]);
  // A template brings its subject, format and content (its signature as it has it), {{first_name}} filled in.
  const pickTemplate = (tid) => {
    setTemplateId(tid || '');
    const tpl = templates.find(t => t.id === tid);
    if(!tpl) return;
    const c = templateContentOf(tpl);
    setSubject(fillFirstName(tpl.subject || tpl.name, person));
    setContent({...c, body:fillFirstName(c.body, person), html:fillFirstName(c.html, person)});
  };
  const validTo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim());
  const ready = target.id != null && validTo && !!subject.trim() && emailContentReady(content);
  const send = (later) => {
    if(!ready) return;
    let when = null;
    if(later){
      when = taskDueValue(date, time).due;
      if(!when || when.getTime() <= Date.now()){ setError('Choose a date and time in the future.'); return; }
    }
    const newIdOf = `email-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const attachments = content.format === 'simple' ? (content.attachments || []) : [];
    hub.add(target.object, target.id, {id:newIdOf, type:'email', direction:'sent', title:subject.trim(), body:emailTextOf(content), html:emailHtmlOf(content), format:content.format,
      ...(attachments.length ? {attachments} : {}), to:[to.trim()], source:'you', by:null,
      status: later ? 'scheduled' : 'sent', ...(later ? {at:when, scheduledFor:when} : {}), ...(templateId ? {templateId} : {}),
      ...(replyTo ? {replyToId:replyTo.id} : {}), ...(forward ? {forwardOfId:forward.id} : {})});
    hub.toast(later ? 'Email scheduled' : 'Email sent');
    onClose(later ? 'scheduled' : 'sent', newIdOf, target);
  };
  return (
    <CreatePanelFrame title={replyTo ? 'Reply' : forward ? 'Forward' : 'New Email'} onClose={()=>onClose()} placement={placement} width={EMAIL_PANEL_W} flush
      top={!fixed && <CreateRecordField value={target} onChange={setTarget}/>}
      actions={<>
        <StSecondary label="Cancel" onClick={()=>onClose()}/>
        <StSecondary label={scheduling ? 'Send now instead' : 'Schedule'} onClick={()=>{ setScheduling(s => !s); setError(''); }}/>
        <StCta label={scheduling ? 'Schedule send' : 'Send'} disabled={!ready} onClick={()=>send(scheduling)}/>
      </>}>
      <EmailSplit form={<>
        <Field label="To"><input value={to} onChange={e=>setTo(e.target.value)} placeholder="name@email.com" aria-label="To"
          style={{...fieldText, borderColor: to && !validTo ? T.red : T.borderStrong}}/></Field>
        <Field label="Template"><FormSelect value={templateId} placeholder="Select email template" options={templates.map(t => ({value:t.id, label:t.name}))} onChange={pickTemplate}/></Field>
        <Field label="Subject"><input value={subject} onChange={e=>setSubject(e.target.value)} aria-label="Subject" style={fieldText}/></Field>
        <EmailContentFields value={content} setValue={setContent}/>
        {scheduling && <>
          <Field label="Send on"><DateField required value={date} onChange={(v)=>{ setDate(v); setError(''); }}/></Field>
          <Field label="At"><TimeField required value={time} onChange={(v)=>{ setTime(v); setError(''); }}/></Field>
        </>}
        {error && <div style={{fontSize:12.5, color:T.red}}>{error}</div>}
      </>} preview={<EmailPreview content={content} subject={subject}/>}/>
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
function EmailBody({a}){
  return <>
    {a.html ? <EmailHtmlFrame html={a.html}/> : <ReadValue>{a.body}</ReadValue>}
    {(a.attachments || []).length > 0 && <div style={{marginTop:8}}><EmailAttachmentList list={a.attachments}/></div>}
  </>;
}
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

Object.assign(window, {EmailComposer, fillFirstName, EMAIL_FORMATS, emailFormatLabel, emailSignatureOf, signatureEmailHtml, emailHtmlOf, emailTextOf, newEmailContent,
  switchEmailFormat, emailContentReady, emailContentToSave, templateContentOf, EmailAttachmentList, EmailContentFields, EmailPreview, EmailSplit, EMAIL_PANEL_W, emailFirstName, emailSubjectKey, emailThreadsOf, emailThreadOf, threadedEmailRows, EmailHtmlFrame, EmailBody, EmailThreadView});
