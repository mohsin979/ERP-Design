/* HOF Pulse ERP — Emails: the composer and Tools → Emails.

   Emails are record activity (type 'email'): sent from a Contact, Deal or Customer, received
   from them, or scheduled to go later. The composer writes one against any record: the record,
   who it goes to (the record's email, editable; Cc and Bcc — addresses typed in, separated by
   commas), an existing template (Settings → Templates) or
   a new email — subject, Email Format and its content (below), with a live preview; Send now, or
   Schedule for a date and time. It's also how Reply and Forward work from an email. Sent and
   scheduled emails appear on the record at once, and its workflows see them (Email Events).
   Scheduled emails go out when their time comes. For several records at once (the Board's Email
   All / Email Selected) the email is written once and sent to each record on its own —
   {{first_name}} and its fetched properties filled in for each; a record without an email
   address is skipped.

   Email formats — one model for every email the CRM writes: a template (and so a sequence's
   emails, which use their templates), a workflow's template email and the composer:
     Simple Text Body       rich text and attachments, then the signature;
     Default HTML Template  rich text, with Primary / Secondary CTA buttons between paragraphs,
                            set in the default branded layout (a quiet card: the company logo, the
                            text, then the signature) — the text is edited on its own;
     Custom HTML Template   an uploaded HTML file is the body; "Include email signature in body"
                            adds the signature at its end — never twice: an upload that already
                            has it starts with the box off, and it's never added again.
   Content {format, body, attachments, html, fileName, includeSignature}; emailHtmlOf() is the
   email as sent and previewed. Templates saved before formats keep the HTML they had: they read
   as Custom HTML.

   The signature (2026-11-16): always personal. Every email ends with its sender's own signature,
   as they set it in Settings → Brand → Email Signature (kept on their user, `signature`; since
   2026-11-17 also their profile photo, the name, designation, address and additional info in a secondary
   language of their choice beside the first, a WhatsApp button and one CTA button (always black), both after the additional info; email, phone
   and website are links): name,
   designation, email, phone, website, company address — each contact line with its icon — then
   additional info, and the company logo, shown or not. Until they set it, it's their name,
   Designation and email. It's added as the email is shown or sent, never kept in the text, so a
   template assigned to five people ends with each one's own; a template's preview shows that of
   the person looking at it. Include Email Signature (every format; on to start with) leaves it
   out — on a template, on a sequence's email, or as an email is written.

   Fetch Property (2026-11-16): a record's value written into the text — a Contact, Deal or
   Customer property, an Accounting property or a Customer Profile property (extendedProps.jsx).
   In the body it's a chip (SPAN data-token="<record type>:<property>" | "acc:<key>" |
   "pf:<form>:<field>", richText.jsx); as the email goes out it's the value on the record the
   email is on — a property of another record type reads its first linked record of that type —
   and nothing where the record has no value. A template's own preview shows the chip.

   Tools → Emails is every email in the workspace: Inbox (received), Sent and Scheduled, with
   the record each belongs to (tools.jsx). Nothing is really sent: there is no mailbox behind
   the prototype. */

const emailFirstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';
// {{first_name}} filled in for the person an email goes to.
const fillFirstName = (s, person) => String(s || '').replace(/\{\{\s*first_name\s*\}\}/g, emailFirstName(person && person.name) || 'there');

/* ── Fetch Property ── (see the header) */
const EMAIL_TOKEN_OBJECTS = {contacts:'Contact', deals:'Deal', customers:'Customer'};
// Where a property is fetched from: the workspace's record types, then Accounting and Customer Profile.
const emailTokenSources = () => [...hubObjects().map(o => ({value:o, label:typeSingular(o, EMAIL_TOKEN_OBJECTS[o])})), {value:'acc', label:'Accounting'}, {value:'pf', label:'Customer Profile'}];
// A source's properties: [{value: the token's key, label, section}] — a Customer Profile property under its form.
function emailTokenOptions(data, source){
  if(EMAIL_TOKEN_OBJECTS[source]) return objectProperties(data, source).filter(p => !p.archived).map(p => ({value:`${source}:${p.key}`, label:p.label}));
  const group = extendedPropertyGroups().find(g => g.id === (source === 'acc' ? 'accounting' : 'profile'));
  return ((group && group.groups) || []).flatMap(g => g.items.map(it => ({value:it.key, label:it.label, ...(g.label ? {section:g.label} : {})})));
}
// The chip that goes into the text: "Contact · Full Name" (the editor makes it one piece once it's in).
const emailTokenHtml = (key, label) => `<span data-token="${emailEsc(key)}">${emailEsc(label)}</span>`;
/* A fetched property's value on a record, as the record shows it. `ctx` {object, record, records
   {contacts, deals, customers}, data}: the record the email is on. */
function emailTokenValue(key, ctx){
  const {object, record, records, data} = ctx || {};
  if(!record) return '';
  if(/^(acc|pf):/.test(key)) return String(extendedValueText(key, record) ?? '');
  const [source, prop] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
  const rec = source === object ? record : linkedOf(records, object, record, source)[0];
  if(!rec) return '';
  if(prop === 'owner') return userLabel(rec.owner);
  return (recordInfoFields({data}, source, rec).find(f => f.key === prop) || {}).value || '';
}
const EMAIL_TOKEN_SPAN = /<span[^>]*\sdata-token="([^"]+)"[^>]*>[\s\S]*?<\/span>/g;
// The email with its fetched properties filled in for the record (nothing where it has no value).
const fillEmailTokens = (html, ctx) => !ctx || !ctx.record ? html : String(html || '').replace(EMAIL_TOKEN_SPAN, (_, key) => emailEsc(emailTokenValue(key.replace(/&amp;/g, '&'), ctx)));
/* Fetch Property: where the property is from, then the property. */
function FetchPropertyModal({data, onCancel, onPick}){
  const sources = emailTokenSources();
  const [source, setSource] = React.useState(sources[0].value);
  const [key, setKey] = React.useState('');
  const options = React.useMemo(() => emailTokenOptions(data, source), [source]);
  const picked = options.find(o => o.value === key);
  const from = (sources.find(x => x.value === source) || {}).label;
  return ReactDOM.createPortal(
    <StModal title="Fetch Property" primary="Fetch Property" canSubmit={!!picked} onCancel={onCancel}
      onSubmit={()=>picked && onPick(key, `${picked.section || from} · ${picked.label}`)}>
      <div><label style={fieldLabel}>Property Of</label>
        <FormSelect value={source} options={sources} onChange={(v)=>{ if(v){ setSource(v); setKey(''); } }} ariaLabel="Property of"/></div>
      <div><label style={fieldLabel}>Property</label>
        <SearchableSelect value={key} options={options} placeholder="Select property" searchPlaceholder="Search properties" onChange={setKey}/></div>
    </StModal>, document.body);
}

/* ── Email formats ── (see the header) */
const EMAIL_FORMATS = [{value:'simple', label:'Simple Text Body'}, {value:'html', label:'Default HTML Template'}, {value:'custom', label:'Custom HTML Template'}];
const emailFormatLabel = (f) => (EMAIL_FORMATS.find(x => x.value === f) || {}).label || '';
const EMAIL_FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif";
// The email editor's text colours (2026-11-17): black and grey, then the brand's colours (Settings → Brand → Color System).
const emailTextColors = () => { const b = orgBrand(), list = Array.isArray(b.palette) ? b.palette.map(c => c.value) : [b.colors.primary, b.colors.secondary];
  return [...new Set(['#1D1D1F', '#6E6E73', ...list.map(richHex).filter(Boolean)])]; };
const emailEsc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const emailLines = (t) => emailEsc(t).replace(/\n/g, '<br>');
// The signature Brand kept before signatures were personal (its phone, website, address and additional info start each person's off).
const brandSignatureOf = () => { const s = orgBrand().signature; return s && !s.dataUrl ? {...SIGNATURE_BLANK, ...s} : null; };
/* The signature an email ends with (see the header): its sender's own, as they saved it — else
   their name, Designation and email. `who`: the sender — a user's ID or name; the person signed
   in without one. */
const emailSignatureOf = (who) => {
  const find = (v) => v ? USER_DIRECTORY.find(u => !u.deleted && (u.id === v || u.name === v)) : null;
  const u = find(who) || find(CURRENT_USER.name) || {name:CURRENT_USER.name, email:CURRENT_USER.email, preset:CURRENT_USER.role};
  if(u.signature) return signatureNormal(u.signature);
  // A CRM with a sample signature of its own (workspaces.jsx CRM_SIGNATURES): everyone's, until they save theirs.
  if(CRM_SIGNATURES[ACTIVE_CRM.id]) return signatureNormal(CRM_SIGNATURES[ACTIVE_CRM.id]);
  const was = brandSignatureOf() || {};
  return {...SIGNATURE_BLANK, includeLogo:was.includeLogo !== false, name:u.name, designation:ownerProfileMock(u.name, u).designation || u.preset || '', email:u.email || '',
    phone:was.phone || '', website:was.website || '', address:was.address || '', additional:was.additional || ''};
};
// A signature as rich text: how a Simple Text Body kept the Brand's (it had a name then) before 2026-11-16 — taken out where it's found.
const signatureRichHtml = (sig) => !sig || !String(sig.name || '').trim() ? '' : sanitizeRichText(
  `<p><b>${emailEsc(sig.name)}</b>${sig.designation ? `<br>${emailLines(sig.designation)}` : ''}</p>`
  + ([sig.email, sig.phone, sig.website].some(Boolean) ? `<p>${[sig.email, sig.phone, sig.website].filter(Boolean).map(emailEsc).join(' · ')}</p>` : '')
  + (sig.address || sig.additional ? `<p>${[sig.address, sig.additional].filter(Boolean).map(emailLines).join('<br>')}</p>` : ''));
// The company logo (Brand → Logo) as an image in an email; the HOF lockup until one is uploaded.
const emailLogoImg = (brand, height) => `<img src="${brand.logo || `data:image/svg+xml;charset=utf-8,${encodeURIComponent(logoSvgString('main', height, '#1D1D1F'))}`}" alt="${emailEsc(brand.name || '')}"`
  + ` height="${height}" style="display:block;height:${height}px;width:auto;max-width:${height * 7}px;border:0">`;
// The contact lines' icons (email, phone, website, address), drawn into the email itself.
const SIGNATURE_ICONS = {
  email:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7.5 8.5 6 8.5-6"/>',
  phone:'<path d="M21 16.5v2.6a1.9 1.9 0 0 1-2.1 1.9 18.6 18.6 0 0 1-8.1-2.9 18.3 18.3 0 0 1-5.6-5.6A18.6 18.6 0 0 1 2.3 4.3 1.9 1.9 0 0 1 4.2 2.3h2.6a1.9 1.9 0 0 1 1.9 1.6c.1.9.3 1.8.7 2.6a1.9 1.9 0 0 1-.4 2L7.9 9.6a15 15 0 0 0 5.6 5.6l1.1-1.1a1.9 1.9 0 0 1 2-.4c.8.3 1.7.6 2.6.7a1.9 1.9 0 0 1 1.8 2.1z"/>',
  website:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  address:'<path d="M12 21.5s7-6.3 7-11.5a7 7 0 1 0-14 0c0 5.2 7 11.5 7 11.5z"/><circle cx="12" cy="10" r="2.6"/>',
};
const signatureIcon = (kind) => `<img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6E6E73" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${SIGNATURE_ICONS[kind]}</svg>`)}"`
  + ` width="13" height="13" alt="" style="display:block;width:13px;height:13px;border:0">`;
// The WhatsApp button's mark: WhatsApp's own, in one flat colour (white on the button).
const WHATSAPP_MARK = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z';
const whatsappIcon = (fill = '#FFFFFF') => `<img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="${fill}" d="${WHATSAPP_MARK}"/></svg>`)}"`
  + ` width="14" height="14" alt="" style="display:block;width:14px;height:14px;border:0">`;
// Where a contact line goes when clicked: the email, the phone and the website are links (the address isn't).
const signatureHref = (kind, value) => { const v = String(value || '').trim();
  return kind === 'email' ? `mailto:${v}` : kind === 'phone' ? `tel:${v.replace(/[^\d+]/g, '')}` : kind === 'website' ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : ''; };
const whatsappHref = (number) => `https://wa.me/${String(number || '').replace(/\D/g, '')}`;
// The buttons' colours: the CTA is always black, WhatsApp its green — white text (and mark) on both.
const SIGNATURE_WHATSAPP = '#1DAA61', SIGNATURE_CTA = '#000000';
/* The signature as it ends an email (marked, so it's never added twice): on the left the
   person's photo and the logo, each shown or not; the name and the designation — in the secondary
   language too, at the right of the same line, where given; the email, phone and website (links)
   and the address (then in the secondary language), each with its icon; the additional info (then
   in the secondary language); and last the CTA and WhatsApp buttons. */
function signatureEmailHtml(sig, brand){
  if(!sig) return '';
  const has = (v) => !!String(v || '').trim();
  const muted = 'color:#6E6E73', font = `font-family:${EMAIL_FONT};font-size:13px;line-height:1.5;color:#1D1D1F`, cell = `${font};vertical-align:middle`;
  /* The secondary language (the person's choice; none: its fields aren't shown): beside the first
     on the name's and designation's lines, under it for the address and the additional info. A
     language written right to left reads so, at the right, in a plain face for its script (the
     email font has no Arabic letters of its own). */
  const second = has(sig.language2), rtl = second && signatureRtl(sig.language2);
  const otherCss = rtl ? `text-align:right;font-family:${SIGNATURE_RTL_FONT}` : '', otherDir = rtl ? ' dir="rtl"' : '';
  const other = (value, style = '') => `<div${otherDir} style="${otherCss};${style}">${emailLines(String(value).trim())}</div>`;
  const link = (kind, value) => { const href = signatureHref(kind, value), text = emailLines(String(value).trim());
    return href ? `<a href="${emailEsc(href)}" target="_blank" rel="noopener" style="color:#1D1D1F;text-decoration:none">${text}</a>` : text; };
  const line = (kind, value, ar) => !has(value) && !has(ar) ? '' : `<tr><td style="padding:2px 8px 2px 0;vertical-align:top"><div style="padding-top:3px">${signatureIcon(kind)}</div></td>`
    + `<td style="padding:2px 0;${font};word-break:break-word">${has(value) ? link(kind, value) : ''}${has(ar) ? other(ar) : ''}</td></tr>`;
  const lines = line('email', sig.email) + line('phone', sig.phone) + line('website', sig.website) + line('address', sig.address, second && sig.address2);
  // The name and the designation: alone, or — with the secondary language's — the first at the left and the second at the right of one line.
  const pair = (en, ar, style) => `<tr><td style="${font};${style};vertical-align:top">${has(en) ? emailLines(String(en).trim()) : ''}</td>`
    + `<td${otherDir} style="${font};${style};vertical-align:top;text-align:right;padding-left:28px;${rtl ? `font-family:${SIGNATURE_RTL_FONT}` : ''}">${has(ar) ? emailLines(String(ar).trim()) : ''}</td></tr>`;
  const head = second && (has(sig.name2) || has(sig.designation2))
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${pair(sig.name, sig.name2, 'font-weight:600')}`
      + (has(sig.designation) || has(sig.designation2) ? pair(sig.designation, sig.designation2, muted) : '') + `</table>`
    : `<div style="font-weight:600">${emailEsc(sig.name)}</div>` + (sig.designation ? `<div style="${muted}">${emailLines(sig.designation)}</div>` : '');
  const button = (href, label, bg, icon = '') => `<td style="padding:0 8px 0 0"><a href="${emailEsc(href)}" target="_blank" rel="noopener" style="display:inline-block;background:${bg};color:#FFFFFF;`
    + `font-family:${EMAIL_FONT};font-size:12.5px;font-weight:600;line-height:1;padding:9px 14px;border-radius:6px;text-decoration:none;white-space:nowrap">`
    + (icon ? `<span style="display:inline-block;vertical-align:middle;margin-right:6px">${icon}</span>` : '') + `<span style="vertical-align:middle">${emailEsc(label)}</span></a></td>`;
  const cta = has(sig.ctaLabel) && has(sig.ctaUrl) ? button(signatureHref('website', sig.ctaUrl), String(sig.ctaLabel).trim(), SIGNATURE_CTA) : '';
  const whatsapp = has(sig.whatsapp) ? button(whatsappHref(sig.whatsapp), 'WhatsApp', SIGNATURE_WHATSAPP, whatsappIcon()) : '';
  const text = head
    + (lines ? `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:6px">${lines}</table>` : '')
    + (has(sig.additional) ? `<div style="${muted};margin-top:6px">${emailLines(String(sig.additional).trim())}</div>` : '')
    + (second && has(sig.additional2) ? other(sig.additional2, `${muted};margin-top:${has(sig.additional) ? 2 : 6}px`) : '')
    + (cta || whatsapp ? `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:12px"><tr>${cta}${whatsapp}</tr></table>` : '');
  const photo = sig.photo ? `<img src="${sig.photo}" alt="${emailEsc(sig.name || '')}" width="64" height="64" style="display:block;width:64px;height:64px;border-radius:8px;object-fit:cover;border:0">` : '';
  const logo = sig.includeLogo ? emailLogoImg(brand, 24) : '';
  const side = photo && logo ? `${photo}<div style="height:12px;line-height:12px;font-size:0">&nbsp;</div>${logo}` : photo || logo;
  return `<table data-hof-signature="1" role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>`
    + (side ? `<td style="padding:0 16px 0 0;border-right:2px solid #E8E8ED;vertical-align:${photo ? 'top' : 'middle'}">${side}</td><td style="padding:0 0 0 16px;${cell}">` : `<td style="${cell}">`)
    + text + `</td></tr><!--/hof-signature--></table>`;
}
// A Simple Text Body saved with the Brand's signature in its text (before 2026-11-16), without it.
const withoutKeptSignature = (body) => { const kept = signatureRichHtml(brandSignatureOf()), html = String(body || '');
  return kept && html.includes(kept) ? html.replace(kept, '').replace(/(<p><br><\/p>)+$/i, '') : html; };
// An email kept as HTML (a workflow's own copy of its email), with its sender's signature in place of the one it was saved with.
const withSenderSignature = (html, who, brand = orgBrand()) => String(html || '').replace(/<table data-hof-signature="1"(?:[\s\S]*?<!--\/hof-signature--><\/table>|[\s\S]*?<\/table>)/i, () => signatureEmailHtml(emailSignatureOf(who), brand));
// Whether an HTML email already ends with the signature: ours (marked), or its name and email written in.
const hasEmailSignature = (html, sig) => /data-hof-signature/i.test(html || '')
  || !!(sig && sig.email && html && html.toLowerCase().includes(sig.email.toLowerCase()) && html.includes(sig.name));
// Text on a colour: dark on light brand colours, white otherwise.
const emailInkOn = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if(!m) return '#FFFFFF'; const n = parseInt(m[1], 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 170 ? '#1D1D1F' : '#FFFFFF'; };
// Rich text with its styles written in (emails carry no stylesheet); CTAs become buttons in the brand's colour.
function emailStyledBody(html, brand, size){
  const box = document.createElement('div');
  box.innerHTML = sanitizeRichText(richHtmlOf(html), RICH_EMAIL);   // its text sizes and colours kept, as styles
  const gap = Math.round(size * .9), accent = brand.colors.primary;
  box.querySelectorAll('p, div').forEach(n => n.setAttribute('style', `margin:0 0 ${gap}px`));
  box.querySelectorAll('ul, ol').forEach(n => n.setAttribute('style', `margin:0 0 ${gap}px;padding-left:22px${n.getAttribute('type') === 'a' ? ';list-style-type:lower-alpha' : ''}`));
  box.querySelectorAll('li').forEach(n => n.setAttribute('style', 'margin:0 0 6px'));
  // A fetched property, until it's filled in (a template's own preview): a chip.
  box.querySelectorAll('span[data-token]').forEach(n => n.setAttribute('style', 'background:#EEF2FF;color:#3538CD;border-radius:5px;padding:1px 6px;white-space:nowrap'));
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
   text, a hairline, the signature. Nothing else is assumed of the layout. `who`: its sender (the
   signature is theirs). */
function emailHtmlOf(c, brand = orgBrand(), who){
  const sig = emailSignatureOf(who);
  if(c.format === 'custom'){
    const html = String(c.html || '');
    if(!c.includeSignature || !html || hasEmailSignature(html, sig)) return html;
    const block = `<div style="padding:24px 0 0">${signatureEmailHtml(sig, brand)}</div>`;
    return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${block}</body>`) : html + block;
  }
  const body = withoutKeptSignature(c.body), signed = c.includeSignature !== false;
  if(c.format === 'html') return `<div style="margin:0;padding:40px 16px;background:#F5F5F7;font-family:${EMAIL_FONT}">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:0 auto;background:#FFFFFF;border-radius:18px;border-collapse:separate;table-layout:fixed">`
    + `<tr><td style="padding:34px 44px 0">${emailLogoImg(brand, 22)}</td></tr>`
    + `<tr><td style="padding:30px 44px ${signed ? 14 : 34}px;font-family:${EMAIL_FONT};font-size:16px;line-height:1.65;color:#1D1D1F;letter-spacing:-0.01em;word-wrap:break-word;overflow-wrap:break-word">${emailStyledBody(body, brand, 16)}</td></tr>`
    + (signed ? `<tr><td style="padding:0 44px"><div style="height:1px;line-height:1px;font-size:0;background:#E8E8ED">&nbsp;</div></td></tr><tr><td style="padding:24px 44px 34px;word-wrap:break-word;overflow-wrap:break-word">${signatureEmailHtml(sig, brand)}</td></tr>` : '')
    + `</table></div>`;
  return `<div style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;color:#1D1D1F">${emailStyledBody(body, brand, 15)}${signed ? `<div style="padding:10px 0 0">${signatureEmailHtml(sig, brand)}</div>` : ''}</div>`;
}
// The email as one line of text (lists, search).
const emailTextOf = (c) => richTextPlain(c.format === 'custom' ? String(c.html || '').replace(/<(style|script|head|title)[\s\S]*?<\/\1>/gi, ' ') : c.body);
// A new email: Simple Text Body, an empty first line (what's typed is a paragraph from the start).
const newEmailContent = () => ({format:'simple', body:'<p><br></p>', attachments:[], html:'', fileName:'', includeSignature:true});
// Another format: the text stays — CTAs as plain links in a Simple Text Body (they're the Default HTML Template's).
function switchEmailFormat(c, format){
  let body = sanitizeRichText(richHtmlOf(c.body || ''), RICH_EMAIL);
  if(format === 'simple') body = body.replace(/\sdata-cta="(primary|secondary)"/g, '');
  return {...c, format, body};
}
const emailContentReady = (c) => c.format === 'custom' ? !!String(c.html || '').trim() : !richIsEmpty(c.body);
// What's kept of an email's content (a template): only what its format uses.
const emailContentToSave = (c) => ({format:c.format, body: c.format === 'custom' ? '' : c.body, attachments: c.format === 'simple' ? (c.attachments || []) : [],
  html: c.format === 'custom' ? c.html : '', fileName: c.format === 'custom' ? (c.fileName || '') : '', includeSignature:c.includeSignature !== false});
// A template's content; one saved before formats is its HTML as it was (Custom HTML).
const templateContentOf = (t) => t.format
  ? {format:t.format, body:withoutKeptSignature(t.body), attachments:t.attachments || [], html:t.html || '', fileName:t.fileName || '', includeSignature:t.includeSignature !== false}
  : {format:'custom', body:'', attachments:[], html:t.html || richHtmlOf(t.body || ''), fileName:'', includeSignature:t.includeSignature !== false};

/* A file opened where an email is edited (the email template editor, a sequence's Edit Email —
   2026-11-17): the built-in viewer (files.jsx FileViewer) in the Preview pane, in place of the
   email's subject and body until it's closed, the panel a little wider for it. `useFileView()` → {file, open(a) — again
   closes it —, close, extra: the width the panel gains}; EmailSplit takes it as `fileView`, and
   the attachment chips inside it open and show the chosen file. */
const FILE_VIEW_W = 240;
const FileViewCtx = React.createContext(null);
function useFileView(){
  const [file, setFile] = React.useState(null);
  return {file, open:(a) => setFile(f => f && f.id === a.id ? null : a), close:() => setFile(null), extra: file ? FILE_VIEW_W : 0};
}
// Attachments as chips; `onRemove` adds ×. Where a file can be viewed (FileViewCtx) a chip opens it and shows as chosen; elsewhere its name downloads it.
function EmailAttachmentList({list, onRemove}){
  const fv = React.useContext(FileViewCtx);
  if(!(list || []).length) return null;
  return (
    <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
      {list.map(a => { const on = !!(fv && fv.file && fv.file.id === a.id); return (
        <span key={a.id} onClick={fv ? ()=>fv.open(a) : undefined} aria-pressed={fv ? on : undefined}
          style={{display:'inline-flex', alignItems:'center', gap:8, maxWidth:'100%', padding:'4px 6px 4px 4px', border:`1px solid ${on ? T.black : T.border}`, borderRadius:8, background: on ? '#F4F5F7' : '#fff', cursor: fv ? 'pointer' : 'default'}}>
          <FileTile a={a} size={26}/>
          <span onClick={fv ? undefined : ()=>downloadFile(a)} title={a.name} style={{minWidth:0, fontSize:12.5, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', cursor: fv || a.dataUrl ? 'pointer' : 'default'}}>{a.name}</span>
          <span style={{fontSize:11.5, color:T.attioMuted, flexShrink:0}}>{fmtBytes(a.size)}</span>
          {onRemove && <button type="button" title="Remove" onClick={(e)=>{ e.stopPropagation(); if(on) fv.close(); onRemove(a.id); }} style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:2}}><Icon name="close" size={11} color={T.gray600}/></button>}
        </span>
      ); })}
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
   with Attachments (Simple Text Body), or the HTML file; then Include Email Signature. */
function EmailContentFields({value:c, setValue}){
  const toggleSig = () => setValue(x => ({...x, includeSignature:x.includeSignature === false}));
  const hub = useRecordHub();
  const [fetching, setFetching] = React.useState(false);
  const insertRef = React.useRef(null);   // the editor's insert, for the property picked in the modal
  const tools = ({insert, keep}) => <button type="button" onMouseDown={e=>{ e.preventDefault(); keep(); }} onClick={()=>{ insertRef.current = insert; setFetching(true); }}
    style={{...btnSecondarySm, height:26, padding:'0 10px'}}>Fetch Property</button>;
  const fetched = (key, label) => { const insert = insertRef.current; setFetching(false); if(insert) setTimeout(() => insert(`${emailTokenHtml(key, label)}&nbsp;`), 0); };
  return <>
    {fetching && <FetchPropertyModal data={(hub && hub.data) || {}} onCancel={()=>setFetching(false)} onPick={fetched}/>}
    <Field label="Email Format"><FormSelect value={c.format} options={EMAIL_FORMATS} onChange={(v)=>v && v !== c.format && setValue(x => switchEmailFormat(x, v))}/></Field>
    {c.format === 'custom' ? <Field label="HTML File"><EmailHtmlUpload c={c} setValue={setValue}/></Field> : <>
      <Field label="Body" wide><RichTextEditor value={c.body} onChange={(v)=>setValue(x => ({...x, body:v}))} minHeight={280} ctas={c.format === 'html'} sizes colors={emailTextColors()} tools={tools} ariaLabel="Email body"/></Field>
      {c.format === 'simple' && <Field label="Attachments"><EmailAttachmentsField list={c.attachments || []} update={(fn)=>setValue(x => ({...x, attachments:fn(x.attachments || [])}))}/></Field>}
    </>}
    <Field label="">
      <div onClick={toggleSig} style={{display:'inline-flex', alignItems:'center', gap:8, paddingTop:7, fontSize:13, color:T.attioText, cursor:'pointer', userSelect:'none'}}>
        <span onClick={e=>e.stopPropagation()} style={{display:'flex'}}><UtToggle on={c.includeSignature !== false} onChange={toggleSig}/></span> Include Email Signature
      </div>
    </Field>
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
   Email Signature split). `fileView` (useFileView, above): a file opened from its attachments
   shows in the Preview pane in the email's place — its name, Download, Close, then the file. */
const EMAIL_PANEL_W = 1080;
function EmailSplit({form, preview, fileView}){
  const file = fileView && fileView.file;
  const iconBtn = (icon, title, onClick) => <button type="button" title={title} aria-label={title} onClick={onClick}
    style={{width:28, height:28, borderRadius:8, border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}><Icon name={icon} size={14} color={T.gray600}/></button>;
  return (
    <FileViewCtx.Provider value={fileView || null}>
    <div style={{flex:1, minWidth:0, display:'flex'}}>
      <div style={{flex:'0 0 580px', maxWidth:'58%', minWidth:0, overflowY:'auto', padding:20}}>{stack(form)}</div>
      <div style={{flex:1, minWidth:0, overflowY:'auto', borderLeft:`1px solid ${T.border}`, background:T.headerBg, padding:20, display:'flex', flexDirection:'column', gap:12}}>
        <span style={{fontSize:11, fontWeight:600, color:T.attioFaint, textTransform:'uppercase', letterSpacing:.4}}>Preview</span>
        {/* An opened file takes the email's place in the pane (its subject and body); Close brings the email back. */}
        {file ? (
          <div style={{display:'flex', flexDirection:'column', gap:10, flexShrink:0}}>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <FileTile a={file} size={26}/>
              <span title={file.name} style={{flex:1, minWidth:0, fontSize:13, fontWeight:500, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{file.name}</span>
              <span style={{fontSize:12, color:T.attioMuted, flexShrink:0}}>{fmtBytes(file.size)}</span>
              {file.dataUrl && iconBtn('export', 'Download File', ()=>downloadFile(file))}
              {iconBtn('close', 'Close File', fileView.close)}
            </div>
            <FileViewer key={file.id} a={file}/>
          </div>
        ) : <div style={{display:'flex', flexDirection:'column', gap:12, flexShrink:0}}>{preview}</div>}
      </div>
    </div>
    </FileViewCtx.Provider>
  );
}

/* ── Cc / Bcc ── addresses typed in, separated by commas (spaces and semicolons too). An email keeps
   them as `cc` / `bcc` lists, each only when filled (emailCopiesOf takes them as typed or as lists).
   The composer, Enroll in Email Sequence (bulkActions.jsx) and the workflow email actions
   (workflows.jsx: Enroll in Email Sequence, Create Email Activity) share the input and its check. */
const EMAIL_ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emailListOf = (s) => String(s || '').split(/[\s,;]+/).filter(Boolean);
const emailListValid = (s) => emailListOf(s).every(x => EMAIL_ADDRESS.test(x));
const emailCopiesOf = (cc, bcc) => ({...(emailListOf(cc).length ? {cc:emailListOf(cc)} : {}), ...(emailListOf(bcc).length ? {bcc:emailListOf(bcc)} : {})});
function EmailListInput({label, value, onChange, style}){
  return <input value={value} onChange={e=>onChange(e.target.value)} placeholder="name@email.com, name@email.com" aria-label={label}
    style={{...fieldText, ...style, borderColor: emailListValid(value) ? T.borderStrong : T.red}}/>;
}
// Who an email went to, on one line: "to a@x.com · cc b@x.com · bcc c@x.com".
const emailRecipientsLine = (m) => [['to', m.to], ['cc', m.cc], ['bcc', m.bcc]].filter(([, l]) => l && l.length).map(([k, l]) => `${k} ${l.join(', ')}`).join(' · ');

/* The composer — the creation side panel (CreatePanelFrame). `object` / `id`: the record (chosen
   here, under Record Type, when not given). `replyTo` / `forward`: the email it answers or passes
   on. `placement`: 'inline' over the area it's opened from, or 'fixed' at the CRM's right edge.
   `onClose(result, id, target)`: 'sent' / 'scheduled', the new email's id and its record, or nothing (cancelled).
   `recipients` [{object, id}]: several records — one email each, to the record's own address;
   `onSent()` once they're sent or scheduled. */
function EmailComposer({object, id, replyTo, forward, recipients, onSent, onClose, placement = 'inline'}){
  const hub = useRecordHub();
  // Several records: who each one reaches; those without an email address are skipped.
  const many = recipients && recipients.length ? recipients.map(r => ({...r, person:hubRecordPerson(hub, r.object, r.id)})) : null;
  const reach = many ? many.filter(r => r.person && EMAIL_ADDRESS.test(String(r.person.email || '').trim())) : [];
  const manyNoun = many ? (HUB_NOUN[many[0].object] || 'Record').toLowerCase() : '';
  const [target, setTarget] = React.useState(() => object && id != null ? {object, id} : {object:object || hubObjects()[0], id:null});
  const fixed = !!(object && id != null);
  const person = target.id != null ? hubRecordPerson(hub, target.object, target.id) : null;
  // The templates the person may use: theirs, the ones assigned to them, and those assigned to no one (templates.jsx).
  const templates = emailTemplatesOf(hub.data).filter(t => templateUsable(t, hub.data));
  const base = replyTo || forward;
  /* A reply goes back to whoever wrote: an email the team sent is answered to its recipients (and
     its Cc), one received to the record's address; a forward starts with no one. */
  const replyAddress = replyTo && replyTo.direction === 'sent' && (replyTo.to || []).find(x => EMAIL_ADDRESS.test(String(x).trim()));
  const [to, setTo] = React.useState(() => forward ? '' : replyAddress || (person && person.email) || '');
  const [cc, setCc] = React.useState(() => replyTo && (replyTo.cc || []).length ? replyTo.cc.join(', ') : ''), [bcc, setBcc] = React.useState('');
  const [templateId, setTemplateId] = React.useState('');
  const [subject, setSubject] = React.useState(() => base ? `${forward ? 'Fwd' : 'Re'}: ${String(base.title || '').replace(/^(Re|Fwd):\s*/i, '')}` : '');
  /* A new email (Simple Text Body); a forward carries the message under it —
     who sent it, when, its subject, the message as written and its attachments. */
  const forwarded = React.useMemo(() => !forward ? '' : sanitizeRichText(`<p>---------- Forwarded message ----------</p>`
    + `<p>From: ${forward.direction === 'received' ? (person && (person.name || person.email)) || 'Client' : forward.by || CURRENT_USER.name}<br>`
    + `Date: ${fmtActStamp(new Date(forward.at))}<br>Subject: ${String(forward.title || '').replace(/[<>]/g, '')}</p>`
    + (forward.html ? forward.html : richHtmlOf(forward.body || ''))), []);
  const [content, setContent] = React.useState(() => {
    const c = newEmailContent();
    return forward ? {...c, body:c.body + forwarded, attachments:[...(c.attachments || []), ...(forward.attachments || [])]} : c;
  });
  const [scheduling, setScheduling] = React.useState(false);
  const [date, setDate] = React.useState(() => ymdOf(new Date(Date.now() + 86400000)));
  const [time, setTime] = React.useState('09:00');
  const [error, setError] = React.useState('');
  // A record picked here fills in its email.
  React.useEffect(() => { if(!fixed && !forward) setTo((person && person.email) || ''); }, [target.object, target.id]);
  /* A template brings its subject, format and content. {{first_name}} and its fetched properties
     stay as written until the email is sent, then they're the record's — so changing the record
     after picking the template still greets the right person (the preview shows them filled in).
     A forward keeps the forwarded message under the template. */
  const pickTemplate = (tid) => {
    setTemplateId(tid || '');
    const tpl = templates.find(t => t.id === tid);
    if(!tpl) return;
    const c = templateContentOf(tpl);
    setSubject(tpl.subject || tpl.name || '');
    setContent(forward ? {...c, body:(c.body || '') + forwarded, attachments:[...(c.attachments || []), ...(forward.attachments || [])]} : c);
  };
  // `v` as it reads for a record: its person's first name, its fetched properties.
  const filledFor = (v, t, p) => typeof v !== 'string' ? v : fillEmailTokens(p ? fillFirstName(v, p) : v, {object:t.object, record:hubRecord(hub, t.object, t.id), records:hub.records, data:hub.data});
  const named = (v) => target.id != null ? filledFor(v, target, person) : v;
  const validTo = EMAIL_ADDRESS.test(to.trim());
  const ready = (many ? reach.length > 0 : target.id != null && validTo) && emailListValid(cc) && emailListValid(bcc) && !!subject.trim() && emailContentReady(content);
  const send = (later) => {
    if(!ready) return;
    let when = null;
    if(later){
      when = taskDueValue(date, time).due;
      if(!when || when.getTime() <= Date.now()){ setError('Choose a date and time in the future.'); return; }
    }
    const newIdOf = `email-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const attachments = content.format === 'simple' ? (content.attachments || []) : [];
    // The email as it goes to one address; `t` / `p`: the record and the person it's filled in for.
    const emailOf = (newId, address, p, t) => {
      const named = (v) => filledFor(v, t, p);
      const c = {...content, body:named(content.body), html:named(content.html)};
      return {id:newId, type:'email', direction:'sent', title:named(subject).trim(), body:emailTextOf(c), html:emailHtmlOf(c), format:content.format,
        ...(attachments.length ? {attachments} : {}), to:[address], ...emailCopiesOf(cc, bcc), source:'you', by:CURRENT_USER.name,
        status: later ? 'scheduled' : 'sent', ...(later ? {at:when, scheduledFor:when} : {}), ...(templateId ? {templateId} : {}),
        ...(replyTo ? {replyToId:replyTo.id} : {}), ...(forward ? {forwardOfId:forward.id} : {})};
    };
    if(many){
      reach.forEach((r, i) => hub.add(r.object, r.id, emailOf(`${newIdOf}-${i}`, r.person.email.trim(), r.person, r)));
      const skipped = many.length - reach.length;
      hub.toast(`Email ${later ? 'scheduled for' : 'sent to'} ${bulkPlural(reach.length, manyNoun)}${skipped ? ` · ${skipped} skipped` : ''}`);
      if(onSent) onSent();
      return onClose(later ? 'scheduled' : 'sent');
    }
    hub.add(target.object, target.id, emailOf(newIdOf, to.trim(), person, target));
    hub.toast(later ? 'Email scheduled' : 'Email sent');
    onClose(later ? 'scheduled' : 'sent', newIdOf, target);
  };
  return (
    <CreatePanelFrame title={replyTo ? 'Reply' : forward ? 'Forward' : 'Add Email'} onClose={()=>onClose()} placement={placement} width={EMAIL_PANEL_W} flush
      top={!fixed && !many && <CreateRecordField value={target} onChange={setTarget}/>}
      actions={<>
        <StSecondary label="Cancel" onClick={()=>onClose()}/>
        <StSecondary label={scheduling ? 'Send Now Instead' : 'Schedule'} onClick={()=>{ setScheduling(s => !s); setError(''); }}/>
        <StCta label={scheduling ? 'Schedule Send' : 'Send'} disabled={!ready} onClick={()=>send(scheduling)}/>
      </>}>
      <EmailSplit form={<>
        <Field label="To">{many
          ? <div aria-label="To" style={{...fieldText, background:T.pageBg, color:T.gray600, cursor:'default'}}>
              {bulkPlural(reach.length, manyNoun)}{many.length - reach.length ? ` · ${many.length - reach.length} skipped` : ''}</div>
          : <input value={to} onChange={e=>setTo(e.target.value)} placeholder="name@email.com" aria-label="To"
              style={{...fieldText, borderColor: to && !validTo ? T.red : T.borderStrong}}/>}</Field>
        <Field label="Cc"><EmailListInput label="Cc" value={cc} onChange={setCc}/></Field>
        <Field label="Bcc"><EmailListInput label="Bcc" value={bcc} onChange={setBcc}/></Field>
        <Field label="Template"><FormSelect value={templateId} placeholder="Select email template" options={templates.map(t => ({value:t.id, label:t.name}))} onChange={pickTemplate}/></Field>
        <Field label="Subject"><input value={subject} onChange={e=>setSubject(e.target.value)} aria-label="Subject" style={fieldText}/></Field>
        <EmailContentFields value={content} setValue={setContent}/>
        {scheduling && <>
          <Field label="Send on"><DateField required value={date} onChange={(v)=>{ setDate(v); setError(''); }}/></Field>
          <Field label="At"><TimeField required value={time} onChange={(v)=>{ setTime(v); setError(''); }}/></Field>
        </>}
        {error && <div style={{fontSize:12.5, color:T.red}}>{error}</div>}
      </>} preview={<EmailPreview content={many ? content : {...content, body:named(content.body), html:named(content.html)}} subject={many ? subject : named(subject)}/>}/>
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
                {on ? emailRecipientsLine(m) : (m.html ? m.title : String(m.body || '').replace(/\s+/g, ' '))}
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

Object.assign(window, {useFileView, fillEmailTokens, emailTokenHtml, withSenderSignature, FetchPropertyModal, EmailComposer, emailListValid, emailCopiesOf, EmailListInput, fillFirstName, EMAIL_FORMATS, emailFormatLabel, emailSignatureOf, signatureEmailHtml, emailHtmlOf, emailTextOf, newEmailContent,
  switchEmailFormat, emailContentReady, emailContentToSave, templateContentOf, EmailAttachmentList, EmailContentFields, EmailPreview, EmailSplit, EMAIL_PANEL_W, emailFirstName, emailSubjectKey, emailThreadsOf, emailThreadOf, threadedEmailRows, EmailHtmlFrame, EmailBody, EmailThreadView});
