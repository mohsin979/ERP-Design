/* HOF Pulse ERP — Settings → Templates: Email Templates, Email Sequences, Quote Templates,
   Playbooks (playbooks.jsx) and Services (services.jsx — the service catalog, moved here from the
   CRM navigation).

   Foundational for now (to be refined later):
     Email Templates — reusable emails: Email Template Name, Subject and Email Format — Simple
       Text Body, Default HTML Template or Custom HTML Template (emails.jsx: the formats, the
       sender's signature, Fetch Property, the preview) — with a live preview beside the fields;
       an attachment clicked there opens beside it in the built-in file viewer (files.jsx), the
       panel wider
       ({{first_name}} and the fetched properties are filled in for the recipient). Used by the
       email composer (emails.jsx), sequences and workflows. Assign Template (2026-11-16; the
       shared picker, usersTeams.jsx AssignPeopleModal — offered as a template is created, and in
       its menus after): the teams and users who may pick it when writing an email, with whoever
       made it; one assigned to no one is everyone's (templateUsable).
     Email Sequences — a named, ordered list of templates, each sent a set time after the one
       before, as its template is (subject, format, content, signature). Used by workflows'
       Enroll in Email Sequence ("Choose email sequence template"). Its panel is the wide email
       panel, opened straight from its name in the list: each email has its template, Edit
       Email (an icon button) — the sequence's own copy of that email,
       the template untouched — and When: After Days (days, weeks or months after the email
       before it) or Specific Date (a record enrolled after that date isn't sent that email).
       Clone Sequence (its menus) copies one. Enrolled (2026-11-16): the
       records with emails of the sequence still scheduled — each with a bar of how many have
       been sent, View and Exit. View opens that record's enrollment (EnrollmentPanel): the
       emails sent, a line, the ones still scheduled — edited or removed for this record only —
       and Exit Sequence, which cancels the ones left (as Exit Email Sequence).
     Quote Templates — a configured quote (quotes.jsx): its title and description, services and
       milestones, payment terms, discount and VAT, terms and e-signature; each has a code
       (QT-001…). Created and edited here in the quote builder's own six steps (Basics without
       a recipient or validity; Preview with sample details) or made from a quote (Save as
       Template); listed, viewed, renamed and deleted here.
     Every tab opens an item in its editor when its name is clicked (2026-11-17) — the full
       panel where it's edited and seen together; View stays in its menu, and a person who can't
       edit it gets the details panel.
   Email templates and sequences are created, viewed, edited and deleted here; a template or sequence a workflow (or a
   sequence) uses can't be deleted until it's no longer used, so nothing that runs loses its email.
   One shape for every tab: the tabs row (as Users & Teams), the list with its icon-only Add
   (StCta) opening the creation side panel (CreatePanelFrame, Field rows), and a detail panel
   (DetailPanel: title, separator, label | value fields, the content). */

/* Each tab is a kind of template with its own permissions (Edit Permissions → Templates): a tab
   shows to those who may view some of its items, and each item's actions follow View / Create /
   Edit / Delete by who created it (items made before creators were recorded are no one's). */
const TEMPLATE_TABS = [{id:'templates', label:'Email Templates', icon:'envelope', kind:'emailTemplates'}, {id:'sequences', label:'Email Sequences', icon:'listBullets', kind:'emailSequences'},
  {id:'quoteTemplates', label:'Quote Templates', icon:'quote', kind:'quoteTemplates'}, {id:'playbooks', label:'Playbooks', icon:'playbook', kind:'playbooks'},
  {id:'services', label:'Services', icon:'services', kind:'services'}];
const SEQUENCE_UNITS = ['Days', 'Weeks', 'Months'];
const SEQUENCE_WHEN = [{value:'after', label:'After Days'}, {value:'date', label:'Specific Date'}];
// Where a template or sequence is used: workflows (any of their settings) and, for templates, sequences.
// A workflow's current version only — one it was used in before (its version history) doesn't count.
const usedInWorkflows = (data, id) => (data.workflows || []).filter(w => { const {history, ...now} = w; return JSON.stringify(now).includes(`"${id}"`); });

/* Who may pick an email template when writing an email (decided 2026-11-16): everyone while it's
   assigned to no one; once assigned, the people it's assigned to and whoever made it. */
const templateUsable = (t, data) => { if(assignmentEmpty(t.assignedTo)) return true;
  const me = (data.users || []).find(u => u.name === CURRENT_USER.name);
  return creatorOf(t) === CURRENT_USER.name || (!!me && assignedUserIds(t.assignedTo, data).includes(me.id)); };
/* Every sequence's active enrollments, by sequence: the records with emails of it still scheduled
   — {object, record, sent, left, emails}. Sent: the enrollment's own emails that have gone (`enrollId`,
   workflowEngine.jsx sendEmails); for one made before enrollments were marked, the sequence's
   length less what's left. */
function sequenceEnrollments(hub, sequences){
  const out = {};
  if(!hub) return out;
  hubObjects().forEach(object => Object.entries((hub.activities || {})[object] || {}).forEach(([rid, acts]) => {
    const bySeq = {};
    (acts || []).forEach(a => { if(a.type === 'email' && a.sequenceId) (bySeq[a.sequenceId] = bySeq[a.sequenceId] || []).push(a); });
    Object.entries(bySeq).forEach(([sid, mine]) => {
      const left = mine.filter(a => a.status === 'scheduled');
      const seq = left.length && sequences.find(q => q.id === sid), record = seq && (hub.records[object] || []).find(r => String(r.id) === String(rid));
      if(!record) return;
      const eid = left[0].enrollId, gone = eid ? mine.filter(a => a.enrollId === eid && a.status !== 'scheduled') : [];
      const sent = eid ? gone.length : Math.max(0, seq.emails.length - left.length), when = (a) => new Date(a.scheduledFor || a.at).getTime();
      // `emails`: the enrollment's own, in the order they go — the ones sent, then the ones still to come.
      (out[sid] = out[sid] || []).push({object, record, sent, left:left.length, emails:[...gone, ...left].sort((a, b) => when(a) - when(b))});
    });
  }));
  return out;
}
/* The Enrolled cell: how many, opening the list — each record (its name opens it), how far its
   enrollment has got (a bar, "2 of 4 emails sent"), and its icon buttons: View Enrollment (the
   eye — the enrollment, below) and Exit Sequence (the bin). */
function EnrolledMenu({list, onOpen, onView, onExit}){
  const width = 400;
  const [pos, setPos] = React.useState(null);
  const z = useFloatZ(!!pos);
  const btnRef = React.useRef(null), menuRef = React.useRef(null);
  const close = () => setPos(null);
  const open = () => { const r = btnRef.current.getBoundingClientRect(), height = Math.min(list.length, 5) * 66 + 14;
    setPos({top: window.innerHeight - r.bottom < height + 8 ? Math.max(8, r.top - height - 4) : r.bottom + 4, left:Math.max(8, Math.min(r.left, window.innerWidth - width - 8))}); };
  React.useEffect(() => {
    if(!pos) return;
    const onDown = (e) => { if(menuRef.current && !menuRef.current.contains(e.target) && !btnRef.current.contains(e.target)) close(); };
    const onKey = (e) => { if(e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey); window.addEventListener('resize', close);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); window.removeEventListener('resize', close); };
  }, [pos]);
  if(!list.length) return <span style={{color:T.attioMuted, fontVariantNumeric:'tabular-nums'}}>0</span>;
  return (
    <div onMouseDown={e=>e.stopPropagation()} style={{display:'flex'}}>
      <button ref={btnRef} type="button" title="Enrolled" aria-expanded={!!pos} onClick={e=>{ e.stopPropagation(); pos ? close() : open(); }}
        style={{display:'inline-flex', alignItems:'center', gap:6, height:26, padding:'0 8px', borderRadius:8, border:`1px solid ${T.borderStrong}`, background: pos ? T.headerBg : '#fff',
          fontSize:13, color:T.attioText, cursor:'pointer', fontFamily:'inherit', fontVariantNumeric:'tabular-nums'}}>
        {list.length}<Icon name="chevDown" size={T.chevronSize} color={T.gray600} style={{transform: pos ? 'rotate(180deg)' : 'none'}}/>
      </button>
      {pos && ReactDOM.createPortal(
        <div ref={menuRef} onMouseDown={e=>e.stopPropagation()} style={{position:'fixed', top:pos.top, left:pos.left, width, zIndex:z, maxHeight:344, overflowY:'auto',
          background:'#fff', border:`1px solid ${T.border}`, borderRadius:10, padding:6, boxShadow:'0 4px 16px rgba(16,24,40,.12)', fontWeight:400, textAlign:'left'}}>
          {list.map(e => { const total = e.sent + e.left; return (
            <div key={`${e.object}:${e.record.id}`} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 8px', borderRadius:6}}>
              <div style={{flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:5}}>
                <span><ContactName name={e.record.name || '—'} onOpen={()=>{ close(); onOpen(e); }} style={{fontSize:13, fontWeight:500}}/></span>
                <div style={{display:'flex', alignItems:'center', gap:8}}>
                  <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={e.sent} style={{flex:1, minWidth:0, height:6, borderRadius:9999, background:'#ECEDF0', overflow:'hidden'}}>
                    <div style={{width:`${total ? e.sent / total * 100 : 0}%`, height:'100%', borderRadius:9999, background:T.black}}/></div>
                  <span style={{fontSize:12, color:T.attioMuted, whiteSpace:'nowrap', fontVariantNumeric:'tabular-nums'}}>{e.sent} of {total} emails sent</span>
                </div>
              </div>
              <SeqIconButton icon="eye" title="View Enrollment" onClick={()=>{ close(); onView(e); }}/>
              <SeqIconButton icon="trash" title="Exit Sequence" onClick={()=>{ close(); onExit(e); }}/>
            </div>
          ); })}
        </div>, document.body)}
    </div>
  );
}
/* ── The sequence panels' pattern ── (2026-11-17) one layout for a sequence, a running instance of
   it and one record's enrollment: columns, left to right. For an instance, who's enrolled first:
   its own column, with its search. Then the emails — the navigation: each a card with its icon
   buttons, View Email (the eye), Edit Email (the pencil) and Remove Email (the bin), none of
   them filled; an enrolled record's row has the same: View Enrollment (the eye) and Exit
   Sequence (the bin). The
   email's preview is a column of its own too, on the right, there only while an email is being
   viewed (View Email opens it, the same button or Close closes it); the panel is as wide as the
   columns it shows. The footer: Cancel, Exit Sequence (where a sequence is running), Save
   Changes — in that order, on the right. */
// The emails column: narrower where it's a list of cards (a running sequence), wider where it's the sequence's own fields (its editor: `fields`).
const SEQ_EMAILS_W = 400, SEQ_FIELDS_W = 620, SEQ_ENROLLED_W = 400, SEQ_PREVIEW_W = 520;
const sequencePanelWidth = (enrolled, preview, fields) => (fields ? SEQ_FIELDS_W : SEQ_EMAILS_W) + (enrolled ? SEQ_ENROLLED_W : 0) + (preview ? SEQ_PREVIEW_W : 0);
const SEQ_LABEL = {fontSize:11, fontWeight:600, color:T.attioFaint, textTransform:'uppercase', letterSpacing:.4};
// An icon-only button of a sequence's email card (`on`: its preview is open).
function SeqIconButton({icon, title, onClick, disabled, on}){
  return <button type="button" title={title} aria-label={title} aria-pressed={on === undefined ? undefined : !!on} disabled={disabled} onClick={onClick}
    style={{width:28, height:28, borderRadius:8, border:'none', background: on ? '#ECEDF0' : 'transparent', cursor: disabled ? 'default' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, opacity: disabled ? .35 : 1}}>
    <Icon name={icon} size={14} color={on ? T.attioText : T.gray600}/></button>;
}
function SequenceColumns({emails, enrolled, preview, onClosePreview, fields}){
  const emailsW = fields ? SEQ_FIELDS_W : SEQ_EMAILS_W;
  return (
    <div style={{flex:1, minWidth:0, display:'flex'}}>
      {/* Who's enrolled comes first, on the left; then the emails; then the preview. */}
      {enrolled && <div style={{flex:`0 0 ${SEQ_ENROLLED_W}px`, maxWidth:'34%', minWidth:0, overflowY:'auto', borderRight:`1px solid ${T.border}`, padding:20, display:'flex', flexDirection:'column', gap:10}}>
        <span style={SEQ_LABEL}>Enrolled</span>{enrolled}</div>}
      <div style={{flex:`${preview ? 0 : 1} 1 ${emailsW}px`, minWidth:0, overflowY:'auto', padding:20}}>{emails}</div>
      {preview && <div style={{flex:`1 1 ${SEQ_PREVIEW_W}px`, minWidth:0, overflowY:'auto', borderLeft:`1px solid ${T.border}`, background:T.headerBg, padding:20, display:'flex', flexDirection:'column', gap:12}}>
        <div style={{display:'flex', alignItems:'center', gap:8}}><span style={{...SEQ_LABEL, flex:1}}>Preview</span><SeqIconButton icon="close" title="Close Preview" onClick={onClosePreview}/></div>
        <div style={{display:'flex', flexDirection:'column', gap:12, flexShrink:0}}>{preview}</div>
      </div>}
    </div>
  );
}
// An email as sent or scheduled (its subject, the email, its attachments) — a preview column's content.
const sentEmailPreview = (a) => <>
  <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}><span style={{color:T.attioMuted}}>Subject&nbsp;&nbsp;</span>{a.title || '—'}</div>
  <EmailHtmlFrame html={a.html || ''}/>
  <EmailAttachmentList list={a.attachments}/>
</>;
const SENT_ABOVE = <div style={{display:'flex', alignItems:'center', gap:10, padding:'4px 0'}}>
  <span style={{flex:1, height:1, background:T.borderStrong}}/><span style={SEQ_LABEL}>Sent above</span><span style={{flex:1, height:1, background:T.borderStrong}}/></div>;
const seqCard = (on) => ({border:`1px solid ${on ? T.gray400 : T.attioLine}`, borderRadius:10, padding:'10px 12px', display:'flex', alignItems:'center', gap:6});

/* An enrollment (2026-11-17): one record's run through a sequence — View on an Enrolled list. Not
   the sequence itself: what's changed here changes this record's emails only. Its emails in the
   order they go — the ones sent (greyed: nothing can be done to them), a line, then the ones
   still scheduled, each of which can be viewed, edited (its text — View Email, workflows.jsx) or
   removed. Save Changes keeps the edits and takes the removed emails out of the record's
   activity; Exit Sequence cancels all that's left. */
function EnrollmentPanel({entry, seq, onClose, onExit, onSave, zIndex}){
  const sent = entry.emails.filter(a => a.status !== 'scheduled'), scheduled = entry.emails.filter(a => a.status === 'scheduled');
  const [edits, setEdits] = React.useState({});          // {email id: {title, html}}
  const [removed, setRemoved] = React.useState([]);      // email ids taken out
  const [shownId, setShown] = React.useState(null);      // the scheduled email previewed (View Email)
  const [editing, setEditing] = React.useState(null);    // the scheduled email being edited (its id)
  const left = scheduled.filter(a => !removed.includes(a.id)).map(a => ({...a, ...(edits[a.id] || {})}));
  const shown = left.find(a => a.id === shownId) || null, edited = left.find(a => a.id === editing) || null;
  const dirty = removed.length > 0 || Object.keys(edits).length > 0;
  const stamp = (a) => fmtActStamp(new Date(a.scheduledFor || a.at));
  const text = (a, i, state) => (
    <div style={{flex:1, minWidth:0}}>
      <div style={{fontSize:12.5, fontWeight:600, color:T.attioText}}>Email {i + 1}</div>
      <div title={a.title} style={{fontSize:13, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{a.title}</div>
      <div style={{fontSize:12, color:T.attioMuted}}>{state} · {stamp(a)}</div>
    </div>
  );
  return (<>
    <CreatePanelFrame title={`${entry.record.name || 'Record'} · ${seq.name}`} onClose={onClose} width={sequencePanelWidth(false, !!shown)} flush zIndex={zIndex}
      actions={<><StSecondary label="Cancel" onClick={onClose}/><StSecondary label="Exit Sequence" onClick={onExit}/><StCta label="Save Changes" disabled={!dirty} onClick={()=>onSave({removed, edits})}/></>}>
      <SequenceColumns onClosePreview={()=>setShown(null)} preview={shown && sentEmailPreview(shown)}
        emails={<div style={{display:'flex', flexDirection:'column', gap:8}}>
          <span style={SEQ_LABEL}>Emails</span>
          {/* Sent: as they went — nothing to do to them. */}
          {sent.map((a, i) => <div key={a.id} aria-disabled="true" style={{...seqCard(false), background:T.headerBg, opacity:.6}}>{text(a, i, 'Sent')}</div>)}
          {sent.length > 0 && SENT_ABOVE}
          {left.map((a) => { const i = entry.emails.findIndex(x => x.id === a.id), on = !!shown && shown.id === a.id; return (
            <div key={a.id} style={seqCard(on)}>
              {text(a, i, 'Scheduled')}
              <SeqIconButton icon="eye" title="View Email" on={on} onClick={()=>setShown(on ? null : a.id)}/>
              <SeqIconButton icon="edit" title="Edit Email" onClick={()=>setEditing(a.id)}/>
              <SeqIconButton icon="trash" title="Remove Email" onClick={()=>setRemoved(r => [...r, a.id])}/>
            </div>); })}
          {!left.length && <div style={{fontSize:13, color:T.attioMuted, padding:'4px 0'}}>No emails left to send</div>}
        </div>}/>
    </CreatePanelFrame>
    {edited && <ViewEmailModal name={edited.title} email={{subject:edited.title, html:edited.html || ''}} onClose={()=>setEditing(null)}
      onSave={(email)=>{ setEdits(x => ({...x, [edited.id]:{title:email.subject, html:email.html}})); setEditing(null); }}/>}
  </>);
}
// One record leaves a sequence: its emails still scheduled are cancelled (the engine's exitSequence). → how many.
const exitEnrollmentOf = (engineCtx, entry, seq) => engineCtx ? engineCtx.api.exitSequence(entry.object === 'contacts' ? String(entry.record.id) : entry.record.id, seq.id) : 0;
// One record's enrollment, saved: its edited emails' text, and the removed ones out of its activity.
const saveEnrollmentOf = (hub, entry, {removed, edits}) => {
  Object.entries(edits).filter(([id]) => !removed.includes(id)).forEach(([id, e]) => hub.update(entry.object, entry.record.id, id, {title:e.title, html:e.html, body:emailTextOf({format:'custom', html:e.html})}));
  removed.forEach(id => hub.remove(entry.object, entry.record.id, id));
};

/* ── Sequence Control ── (Settings → CRM Settings, 2026-11-17; Mohsin's name for it) the sequences that are running.
   Not the templates (Settings → Templates → Email Sequences keeps those, with each one's Enrolled
   count): each row here is one running instance of a sequence — the records enrolled in it on
   the same day, who get the same emails on the same dates. A table: the sequence, how many are
   enrolled, a bar of how far it has got, when it started; View and Exit for the whole instance.
   View (SequenceInstancePanel): its emails — the ones sent, a line, the ones still scheduled,
   which can be edited (for everyone in it: the email is written again for each record) or
   removed — and who's enrolled, with a search: View opens one record's own enrollment
   (EnrollmentPanel) and Exit takes that one record out. Exit Sequence, bottom left, ends it for
   everyone. */
const enrollmentDay = (a) => ymdOf(new Date(a.scheduledFor || a.at));
// An instance's emails, as the group gets them: one per template and day — {key, at, templateId, title, sent, emails:[{person, email}]}.
function instanceSlots(people){
  const m = new Map();
  people.forEach(p => p.emails.forEach(a => { const key = `${a.templateId || ''}|${enrollmentDay(a)}`;
    const slot = m.get(key) || {key, at:new Date(a.scheduledFor || a.at), templateId:a.templateId, title:a.title, emails:[]};
    slot.emails.push({person:p, email:a}); m.set(key, slot); }));
  return [...m.values()].sort((a, b) => a.at - b.at).map(x => ({...x, sent:x.emails.every(y => y.email.status !== 'scheduled')}));
}
/* Every running instance: an enrollment's day is the one it was made (`instance`, stamped by the
   engine), else — enrolled before that was kept — the day of its first email; and its emails'
   templates and days must match the others' too. */
function sequenceInstances(hub, sequences){
  const by = sequenceEnrollments(hub, sequences), out = [];
  Object.entries(by).forEach(([sid, entries]) => { const seq = sequences.find(q => q.id === sid), groups = {};
    // One instance: enrolled the same day, with the same emails on the same dates (records whose emails differ are their own).
    entries.forEach(e => { const day = (e.emails.find(a => a.instance) || {}).instance || enrollmentDay(e.emails[0]);
      const key = `${day}|${e.emails.map(a => `${a.templateId || ''}@${enrollmentDay(a)}`).join(',')}`; (groups[key] = groups[key] || []).push(e); });
    Object.entries(groups).forEach(([key, people]) => { const slots = instanceSlots(people), day = key.split('|')[0];
      out.push({id:`${sid}:${key}`, seq, day, people, slots, sent:slots.filter(x => x.sent).length}); });
  });
  return out;
}
// "2 of 4 emails sent", with its bar.
function SentProgress({sent, total, width}){
  return (
    <div style={{display:'flex', alignItems:'center', gap:8, minWidth:0, width}}>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={sent} style={{flex:1, minWidth:40, height:6, borderRadius:9999, background:'#ECEDF0', overflow:'hidden'}}>
        <div style={{width:`${total ? sent / total * 100 : 0}%`, height:'100%', borderRadius:9999, background:T.black}}/></div>
      <span style={{fontSize:12, color:T.attioMuted, whiteSpace:'nowrap', fontVariantNumeric:'tabular-nums'}}>{sent} of {total} emails sent</span>
    </div>
  );
}
/* A scheduled email of an instance, to edit for everyone: the sequence's own (its step's copy or
   template) to start from — by its place, else by its template. */
const instanceEmailSource = (instance, slot, templates) => {
  const steps = instance.seq.emails || [], i = instance.slots.findIndex(x => x.key === slot.key);
  const step = steps[i] && steps[i].templateId === slot.templateId ? steps[i] : steps.find(x => x.templateId === slot.templateId);
  const src = (step && sequenceEmailOf(step, templates)) || templates.find(t => t.id === slot.templateId);
  return src ? {...src, subject:src.subject || src.name || slot.title} : {subject:slot.title, format:'custom', html:(slot.emails[0].email.html || ''), includeSignature:false};
};
function SequenceInstancePanel({instance, templates, onClose, onExitAll, onExitOne, onViewOne, onSave}){
  const hub = useRecordHub();
  const [edits, setEdits] = React.useState({});        // {slot key: the email as edited (subject and content)}
  const [removed, setRemoved] = React.useState([]);    // slot keys taken out
  const [shownKey, setShown] = React.useState(null);   // the scheduled email previewed (View Email)
  const [editing, setEditing] = React.useState(null);  // the scheduled email being edited (its slot key)
  const [q, setQ] = React.useState('');
  const sent = instance.slots.filter(x => x.sent), left = instance.slots.filter(x => !x.sent && !removed.includes(x.key));
  const shown = left.find(x => x.key === shownKey) || null, edited = left.find(x => x.key === editing) || null;
  const dirty = removed.length > 0 || Object.keys(edits).length > 0;
  const f = q.trim().toLowerCase(), people = instance.people.filter(p => !f || String(p.record.name || '').toLowerCase().includes(f) || String(p.record.email || '').toLowerCase().includes(f));
  const nameOf = (x) => (edits[x.key] && edits[x.key].subject) || (templates.find(t => t.id === x.templateId) || {}).name || x.title;
  const text = (x, state) => (
    <div style={{flex:1, minWidth:0}}>
      <div style={{fontSize:12.5, fontWeight:600, color:T.attioText}}>Email {instance.slots.findIndex(y => y.key === x.key) + 1}</div>
      <div title={nameOf(x)} style={{fontSize:13, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{nameOf(x)}</div>
      <div style={{fontSize:12, color:T.attioMuted}}>{state} · {fmtActStamp(x.at)}</div>
    </div>
  );
  return (<>
    <CreatePanelFrame title={instance.seq.name} onClose={onClose} width={sequencePanelWidth(true, !!shown)} flush
      actions={<><StSecondary label="Cancel" onClick={onClose}/><StSecondary label="Exit Sequence" onClick={onExitAll}/><StCta label="Save Changes" disabled={!dirty} onClick={()=>onSave({removed, edits})}/></>}>
      <SequenceColumns onClosePreview={()=>setShown(null)}
        preview={shown && (edits[shown.key] ? <EmailPreview content={templateContentOf(edits[shown.key])} subject={edits[shown.key].subject}/> : sentEmailPreview(shown.emails[0].email))}
        emails={<div style={{display:'flex', flexDirection:'column', gap:8}}>
          <span style={SEQ_LABEL}>Emails</span>
          {sent.map(x => <div key={x.key} aria-disabled="true" style={{...seqCard(false), background:T.headerBg, opacity:.6}}>{text(x, 'Sent')}</div>)}
          {sent.length > 0 && SENT_ABOVE}
          {left.map(x => { const on = !!shown && shown.key === x.key; return (
            <div key={x.key} style={seqCard(on)}>
              {text(x, 'Scheduled')}
              <SeqIconButton icon="eye" title="View Email" on={on} onClick={()=>setShown(on ? null : x.key)}/>
              <SeqIconButton icon="edit" title="Edit Email" onClick={()=>setEditing(x.key)}/>
              <SeqIconButton icon="trash" title="Remove Email" onClick={()=>setRemoved(r => [...r, x.key])}/>
            </div>); })}
          {!left.length && <div style={{fontSize:13, color:T.attioMuted, padding:'4px 0'}}>No emails left to send</div>}
        </div>}
        enrolled={<>
          <div style={{position:'relative', flexShrink:0}}>
            <div style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', display:'flex'}}><Icon name="search" size={13} color={T.gray400}/></div>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search enrolled records" aria-label="Search enrolled records" style={{...fieldText, paddingLeft:30}}/>
          </div>
          <div style={{display:'flex', flexDirection:'column'}}>
            {people.map(p => (
              <div key={`${p.object}:${p.record.id}`} style={{display:'flex', alignItems:'center', gap:8, padding:'8px 2px', borderBottom:`1px solid ${T.attioLine}`}}>
                <div style={{flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:4}}>
                  <span><ContactName name={p.record.name || '—'} onOpen={()=>hub.openRecord(p.object, p.record.id)} style={{fontSize:13, fontWeight:500}}/></span>
                  <SentProgress sent={p.sent} total={p.sent + p.left}/>
                </div>
                <SeqIconButton icon="eye" title="View Enrollment" onClick={()=>onViewOne(p)}/>
                <SeqIconButton icon="trash" title="Exit Sequence" onClick={()=>onExitOne(p)}/>
              </div>))}
            {!people.length && <div style={{fontSize:13, color:T.attioMuted, padding:'4px 0'}}>No enrolled records match</div>}
          </div>
        </>}/>
    </CreatePanelFrame>
    {edited && <SequenceEmailPanel key={edited.key} initial={edits[edited.key] || instanceEmailSource(instance, edited, templates)} onCancel={()=>setEditing(null)}
      onSave={(email)=>{ setEdits(x => ({...x, [edited.key]:email})); setEditing(null); }}/>}
  </>);
}
/* An instance, saved: a removed email leaves everyone's activity; an edited one is written again
   for each record still to get it — its own values where the email fetches them, its sender's signature. */
function saveInstanceOf(hub, instance, {removed, edits}){
  instance.slots.forEach(slot => {
    const due = slot.emails.filter(x => x.email.status === 'scheduled');
    if(removed.includes(slot.key)) return due.forEach(({person, email}) => hub.remove(person.object, person.record.id, email.id));
    const e = edits[slot.key]; if(!e) return;
    const content = templateContentOf(e);
    due.forEach(({person, email}) => { const who = {name:person.record.name || ''};
      const html = fillEmailTokens(fillFirstName(emailHtmlOf(content, undefined, userLabel(person.record.owner)), who), {object:person.object, record:person.record, records:hub.records, data:hub.data});
      hub.update(person.object, person.record.id, email.id, {title:fillFirstName(e.subject, who), html, body:emailTextOf({format:'custom', html}),
        attachments: content.format === 'simple' && (content.attachments || []).length ? content.attachments : undefined});
    });
  });
}
function SequenceEnrollmentsSettings({data}){
  const hub = useRecordHub(), engineCtx = useWorkflowEngineCtx();
  const sequences = emailSequencesOf(data), templates = emailTemplatesOf(data);
  const can = (action, seq) => templateCan('emailSequences', action, seq);
  const instances = React.useMemo(() => sequenceInstances(hub, sequences).filter(x => can('view', x.seq)), [hub && hub.activities, hub && hub.records, sequences]);
  const [openId, setOpenId] = React.useState(null);
  const [person, setPerson] = React.useState(null);     // {object, id}: one record's own enrollment, over the instance
  const [exiting, setExiting] = React.useState(null);   // {instance, entry?}: the whole instance, or one record of it
  const [toast, setToast] = React.useState(null);
  const say = (m) => { setToast(m); setTimeout(()=>setToast(null), TOAST_MS); };
  const open = instances.find(x => x.id === openId) || null;
  const one = open && person && open.people.find(p => p.object === person.object && String(p.record.id) === String(person.id));
  const cols = [{key:'name', label:'Sequence Name', width:260}, {key:'enrolled', label:'Enrolled', width:120}, {key:'progress', label:'Progress', width:300}, {key:'started', label:'Started', width:150}];
  const rows = instances.map(x => ({id:x.id, name:x.seq.name, enrolled:x.people.length, progress:x.slots.length ? x.sent / x.slots.length : 0, started:fmtQuoteDate(x.day), _x:x}));
  const schema = {
    properties:cols, noun:'enrollment', searchKeys:['name'], fillWidth:true, canCreateProperty:false, boards:false, selectable:false,
    filterProps:[{key:'name', label:'Sequence Name', type:'text'}, {key:'enrolled', label:'Enrolled', type:'number'}], selectValues:{},
    renderCell:(key, r) => key === 'name' ? <ContactName name={r.name} onOpen={()=>setOpenId(r.id)} style={{fontSize:'inherit', fontWeight:500}}/>
      : key === 'progress' ? <SentProgress sent={r._x.sent} total={r._x.slots.length} width={260}/> : undefined,
    renderActions:(r) => <RowActionsMenu title="Enrollment Actions" width={MENU_W} items={[{label:'View Enrollment', onClick:()=>setOpenId(r.id)},
      ...(can('edit', r._x.seq) ? [{label:'Exit Sequence', danger:true, onClick:()=>setExiting({instance:r._x})}] : [])]}/>,
  };
  const exit = () => {
    const {instance, entry} = exiting, list = entry ? [entry] : instance.people;
    const n = list.reduce((sum, p) => sum + exitEnrollmentOf(engineCtx, p, instance.seq), 0);
    setExiting(null); setPerson(null); if(!entry) setOpenId(null);
    say(`${entry ? entry.record.name || 'Record' : bulkPlural(list.length, 'record')} exited · ${bulkPlural(n, 'email')} cancelled`);
  };
  const leaving = exiting && (exiting.entry ? [exiting.entry] : exiting.instance.people);
  return (
    <div style={{position:'relative', flex:1, minHeight:0, display:'flex', flexDirection:'column', overflow:'hidden'}}>
      <SettingsPage fill>
        <div style={{display:'flex', flexDirection:'column', flex:1, minHeight:0}}>
          <RecordViewsModule schema={schema} rows={rows} columns={cols.map(c => c.key)} storeKey="views:sequence-enrollments"
            defaultViews={[{id:'sev-all', name:'All Enrollments', sort:{key:'started', dir:'desc'}}]}/>
        </div>
      </SettingsPage>
      {open && <SequenceInstancePanel key={open.id} instance={open} templates={templates} onClose={()=>setOpenId(null)}
        onExitAll={()=>setExiting({instance:open})} onExitOne={(p)=>setExiting({instance:open, entry:p})} onViewOne={(p)=>setPerson({object:p.object, id:p.record.id})}
        onSave={(changes)=>{ saveInstanceOf(hub, open, changes); setOpenId(null); say('Enrollment saved'); }}/>}
      {one && <EnrollmentPanel key={`${open.id}:${person.object}:${person.id}`} entry={one} seq={open.seq} zIndex={90} onClose={()=>setPerson(null)}
        onExit={()=>setExiting({instance:open, entry:one})} onSave={(changes)=>{ saveEnrollmentOf(hub, one, changes); setPerson(null); say('Enrollment saved'); }}/>}
      {exiting && <StModal title="Exit Sequence" primary="Exit Sequence" danger onCancel={()=>setExiting(null)} onSubmit={exit}>
        <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>{exiting.entry ? exiting.entry.record.name || 'This record' : bulkPlural(leaving.length, 'record')} {leaving.length === 1 ? 'leaves' : 'leave'} {exiting.instance.seq.name}. {bulkPlural(leaving.reduce((n, p) => n + p.left, 0), 'scheduled email')} won't be sent.</div>
      </StModal>}
      <CopyToast message={toast}/>
    </div>
  );
}
SETTINGS_PAGES['settings.sequenceEnrollments'] = SequenceEnrollmentsSettings;

/* A sample running instance (the sample CRM; added once — app.jsx `mockEnrollGroup`): twelve
   contacts enrolled together in US NIW Onboarding three days ago — its first email sent, the
   rest scheduled — so Sequence Control has a group to show. → {contact id: its emails}. */
function sampleGroupEnrollment(records, data){
  const seq = emailSequencesOf(data).find(q => q.id === 'es-onboarding'), out = {};
  if(!seq) return out;
  const DAY = 86400000, start = Date.now() - 3 * DAY, when = sequenceSchedules(seq), instance = ymdOf(new Date(start));
  (records.contacts || []).filter(r => EMAIL_ADDRESS.test(String(r.email || '').trim())).slice(10, 22).forEach((record, n) => {
    const owner = userLabel(record.owner), person = {name:record.name || ''}, enrollId = `en-group-${n}`;
    out[record.id] = seq.emails.map((e, i) => {
      const tpl = emailTemplatesOf(data).find(t => t.id === e.templateId);
      if(!tpl) return null;
      const content = templateContentOf(sequenceEmailOf(e, emailTemplatesOf(data)) || tpl), at = new Date(start + wfDurationMs(when[i])), sent = at.getTime() <= Date.now();
      const html = fillEmailTokens(fillFirstName(emailHtmlOf(content, undefined, owner), person), {object:'contacts', record, records, data});
      return {id:`${enrollId}-${i}`, contactId:record.id, type:'email', at, direction:'sent', title:fillFirstName(tpl.subject || tpl.name, person), body:emailTextOf({format:'custom', html}), html,
        ...(content.format === 'simple' && content.attachments.length ? {attachments:content.attachments} : {}), templateId:tpl.id, sequenceId:seq.id, enrollId, instance, to:[String(record.email).trim()],
        status: sent ? 'sent' : 'scheduled', scheduledFor:at, source:'team', by:owner};
    }).filter(Boolean);
  });
  return out;
}

/* Sample enrollments (the sample CRM; added once, with the sample sequences — app.jsx): a few
   records part-way through a sequence. Each is the sequence's emails as an enrollment makes them
   (workflowEngine.jsx sendEmails): the first ones sent, the rest scheduled ahead.
   → {contacts, deals, customers}: {record id: its emails}. */
function sampleSequenceEnrollments(records, data){
  const DAY = 86400000, now = Date.now();
  const pick = (object, i, ok) => (records[object] || []).filter(r => EMAIL_ADDRESS.test(String(r.email || '').trim()) && (!ok || ok(r)))[i];
  const owes = (r) => !!extendedValueText('acc:nextPaymentAmount', r);   // Payment Follow-up: records with a payment still to come
  // [sequence, record type, which record (among those with an email address), how many emails have gone]
  const plan = [['es-onboarding', 'customers', 0, 1], ['es-onboarding', 'customers', 1, 2], ['es-onboarding', 'customers', 2, 0], ['es-payment', 'deals', 0, 1, owes], ['es-payment', 'deals', 1, 0, owes],
    ['es-documents', 'contacts', 0, 2], ['es-documents', 'contacts', 1, 1], ['es-consultation', 'deals', 2, 1]];
  const out = {contacts:{}, deals:{}, customers:{}};
  plan.forEach(([seqId, object, index, gone, ok], n) => {
    const seq = emailSequencesOf(data).find(q => q.id === seqId), record = pick(object, index, ok);
    if(!seq || !record) return;
    const owner = userLabel(record.owner), person = {name:record.name || ''}, enrollId = `en-sample-${n}`, key = object === 'contacts' ? 'contactId' : object === 'deals' ? 'dealId' : 'customerId';
    out[object][record.id] = [...(out[object][record.id] || []), ...seq.emails.map((e, i) => {
      const tpl = emailTemplatesOf(data).find(t => t.id === e.templateId);
      if(!tpl) return null;
      const content = templateContentOf(tpl), sent = i < gone, at = new Date(sent ? now - (gone - i) * 2 * DAY : now + (i - gone + 1) * 3 * DAY);
      const html = fillEmailTokens(fillFirstName(emailHtmlOf(content, undefined, owner), person), {object, record, records, data});
      return {id:`${enrollId}-${i}`, [key]:record.id, type:'email', at, direction:'sent', title:fillFirstName(tpl.subject || tpl.name, person), body:emailTextOf({format:'custom', html}), html,
        ...(content.format === 'simple' && content.attachments.length ? {attachments:content.attachments} : {}), templateId:tpl.id, sequenceId:seq.id, enrollId, to:[String(record.email).trim()],
        status: sent ? 'sent' : 'scheduled', scheduledFor:at, source:'team', by:owner};
    }).filter(Boolean)];
  });
  return out;
}

// The creation panels' Cancel / Save pair.
const panelActions = (onCancel, label, ok, onSave) => <><StSecondary label="Cancel" onClick={onCancel}/><StCta label={label} disabled={!ok} onClick={()=>ok && onSave()}/></>;

/* New / Edit Email Template: Email Template Name, Subject, Email Format and its content on the
   left, the preview on the right (emails.jsx EmailSplit). */
function TemplateFormPanel({initial, onCancel, onSave}){
  const [name, setName] = React.useState((initial && initial.name) || '');
  const [subject, setSubject] = React.useState((initial && initial.subject) || '');
  const [content, setContent] = React.useState(() => initial ? templateContentOf(initial) : newEmailContent());
  const ok = !!name.trim() && !!subject.trim() && emailContentReady(content);
  const save = () => onSave({name:name.trim(), subject:subject.trim(), ...emailContentToSave(content)});
  const fileView = useFileView();   // an attachment opened beside the email (the built-in viewer)
  return (
    <CreatePanelFrame title={initial ? 'Edit Email Template' : 'Add Email Template'} onClose={onCancel} width={EMAIL_PANEL_W + fileView.extra} flush
      actions={panelActions(onCancel, initial ? 'Save Changes' : 'Add Email Template', ok, save)}>
      <EmailSplit fileView={fileView} form={<>
        <Field label="Email Template Name"><input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Document request" style={fieldText}/></Field>
        <Field label="Subject"><input value={subject} onChange={e=>setSubject(e.target.value)} style={fieldText}/></Field>
        <EmailContentFields value={content} setValue={setContent}/>
      </>} preview={<EmailPreview content={content} subject={subject}/>}/>
    </CreatePanelFrame>
  );
}

/* A sequence email's own copy (2026-11-16): Edit Email opens the email as the sequence will send
   it — its subject, format and content — and keeps the edit on that step only; the template
   stays as it is. The email panel's shape (TemplateFormPanel), without a name. */
function SequenceEmailPanel({initial, onCancel, onSave}){
  const [subject, setSubject] = React.useState(initial.subject || '');
  const [content, setContent] = React.useState(() => templateContentOf(initial));
  const ok = !!subject.trim() && emailContentReady(content);
  const fileView = useFileView();   // an attachment opened beside the email (the built-in viewer)
  return (
    <CreatePanelFrame title="Edit Email" onClose={onCancel} width={EMAIL_PANEL_W + fileView.extra} flush zIndex={90}
      actions={panelActions(onCancel, 'Save Changes', ok, ()=>onSave({subject:subject.trim(), ...emailContentToSave(content)}))}>
      <EmailSplit fileView={fileView} form={<>
        <Field label="Subject"><input autoFocus value={subject} onChange={e=>setSubject(e.target.value)} style={fieldText}/></Field>
        <EmailContentFields value={content} setValue={setContent}/>
      </>} preview={<EmailPreview content={content} subject={subject}/>}/>
    </CreatePanelFrame>
  );
}
/* A sequence's email as it goes out: its own copy where it has one (Edit Email), else its template. */
const sequenceEmailOf = (e, templates) => e.email || (templates || []).find(t => t.id === e.templateId) || null;
// When a sequence's email goes: "After 2 days" / "Then 1 week" / "On Nov 20, 2026".
const sequenceWhenLabel = (e, i) => e.when === 'date' ? `On ${fmtQuoteDate(e.date) || '—'}` : `${i === 0 ? 'After' : 'Then'} ${e.delay.amount} ${String(e.delay.unit).toLowerCase()}`;
/* Add / Edit Email Sequence — the sequence panels' pattern (SequenceColumns): the name and the
   emails; View Email opens that email as it reads, on the right. Each email: its template, View
   Email, Edit Email (its own copy, above), and When — After Days (a number of days, weeks or months after the email before
   it) or Specific Date. */
function SequenceFormPanel({initial, templates, onCancel, onSave}){
  const [s, setS] = React.useState(() => ({name:(initial && initial.name) || '',
    emails:((initial && initial.emails) || [{templateId:'', delay:{amount:'1', unit:'Days'}}]).map((e, i) => ({key:`se-${i}-${Math.random().toString(36).slice(2, 6)}`, ...e, delay:{amount:'1', unit:'Days', ...e.delay}}))}));
  const [shown, setShown] = React.useState(null);                    // the email previewed (View Email)
  const [editing, setEditing] = React.useState(null);                // the email being edited (its key)
  const setEmail = (i, p) => setS(x => ({...x, emails:x.emails.map((e, j) => j === i ? {...e, ...p} : e)}));
  const move = (i, d) => setS(x => { const n = x.emails.slice(); const [m] = n.splice(i, 1); n.splice(i + d, 0, m); return {...x, emails:n}; });
  const whenOk = (e) => e.when === 'date' ? /^\d{4}-\d{2}-\d{2}$/.test(e.date || '') : Number(e.delay.amount) >= 0 && e.delay.amount !== '';
  const ok = !!s.name.trim() && s.emails.length > 0 && s.emails.every(e => e.templateId && whenOk(e));
  const iconBtn = (icon, title, onClick, disabled) => <button type="button" title={title} disabled={disabled} onClick={onClick}
    style={{border:'none', background:'transparent', cursor: disabled ? 'default' : 'pointer', display:'flex', padding:4, opacity: disabled ? .35 : 1}}><Icon name={icon} size={13} color={T.gray600}/></button>;
  // Saved: an After Days email keeps no date, a Specific Date one its date (its delay stays, unused).
  const save = () => onSave({name:s.name.trim(), emails:s.emails.map(({key, date, when, ...e}) => when === 'date' ? {...e, when, date} : e)});
  const current = s.emails.find(e => e.key === shown) || null, email = current && sequenceEmailOf(current, templates);
  const edited = s.emails.find(e => e.key === editing), editedEmail = edited && sequenceEmailOf(edited, templates);
  return (<>
    <CreatePanelFrame title={initial ? 'Edit Email Sequence' : 'Add Email Sequence'} onClose={onCancel} width={sequencePanelWidth(false, !!email, true)} flush
      actions={panelActions(onCancel, initial ? 'Save Changes' : 'Add Email Sequence', ok, save)}>
      <SequenceColumns fields onClosePreview={()=>setShown(null)} emails={stack(<>
      <Field label="Name"><input autoFocus value={s.name} onChange={e=>setS(x => ({...x, name:e.target.value}))} placeholder="e.g. New client onboarding" style={fieldText}/></Field>
      <Field label="Emails"><div style={{display:'flex', flexDirection:'column', gap:8, paddingTop:2}}>
        {s.emails.map((e, i) => (
          <div key={e.key} style={{border:`1px solid ${current && e.key === current.key ? T.gray400 : T.attioLine}`, borderRadius:10, padding:10, display:'flex', flexDirection:'column', gap:8}}>
            <div style={{display:'flex', alignItems:'center', gap:6}}>
              <span style={{fontSize:12.5, fontWeight:600, color:T.attioText, flex:1}}>Email {i + 1}</span>
              {iconBtn('arrowUp', 'Move up', ()=>move(i, -1), i === 0)}
              {iconBtn('arrowDown', 'Move down', ()=>move(i, 1), i === s.emails.length - 1)}
              {iconBtn('trash', 'Remove email', ()=>setS(x => ({...x, emails:x.emails.filter((_, j) => j !== i)})), s.emails.length === 1)}
            </div>
            {/* Another template in its place: the email's own edits go with the old one. */}
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <div style={{flex:1, minWidth:0}}><FormSelect value={e.templateId} placeholder="Select email template" options={templates.map(t => ({value:t.id, label:t.name}))}
                onChange={(v)=>v !== e.templateId && setEmail(i, {templateId:v, email:undefined})}/></div>
              <SeqIconButton icon="eye" title="View Email" disabled={!sequenceEmailOf(e, templates)} on={!!current && current.key === e.key} onClick={()=>setShown(current && current.key === e.key ? null : e.key)}/>
              <SeqIconButton icon="edit" title="Edit Email" disabled={!sequenceEmailOf(e, templates)} onClick={()=>setEditing(e.key)}/>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <span style={{fontSize:12.5, color:T.gray600, whiteSpace:'nowrap'}}>When</span>
              <div style={{width:150}}><FormSelect value={e.when === 'date' ? 'date' : 'after'} options={SEQUENCE_WHEN} ariaLabel={`Email ${i + 1} when`}
                onChange={(v)=>v && setEmail(i, {when: v === 'date' ? 'date' : undefined})}/></div>
              {e.when === 'date' ? <div style={{width:180}}><DateField required value={e.date || ''} onChange={(v)=>setEmail(i, {date:v})} ariaLabel={`Email ${i + 1} date`}/></div> : <>
                <input value={e.delay.amount} onChange={ev=>setEmail(i, {delay:{...e.delay, amount:ev.target.value.replace(/[^0-9]/g, '')}})} inputMode="numeric" aria-label={`Email ${i + 1} delay`}
                  style={{...fieldText, width:80, fontVariantNumeric:'tabular-nums'}}/>
                {/* (A sequence saved in hours keeps them.) */}
                <div style={{width:130}}><FormSelect value={e.delay.unit} placeholder="Select unit" options={SEQUENCE_UNITS.includes(e.delay.unit) ? SEQUENCE_UNITS : [e.delay.unit, ...SEQUENCE_UNITS]}
                  onChange={(v)=>setEmail(i, {delay:{...e.delay, unit:v || 'Days'}})}/></div>
              </>}
            </div>
          </div>
        ))}
        <button type="button" onClick={()=>setS(x => ({...x, emails:[...x.emails, {key:`se-${Date.now().toString(36)}`, templateId:'', delay:{amount:'1', unit:'Days'}}]}))}
          style={{alignSelf:'flex-start', display:'inline-flex', alignItems:'center', gap:6, border:'none', background:'transparent', padding:'4px 0', fontSize:13, fontWeight:500, color:T.attioText, cursor:'pointer', fontFamily:'inherit'}}>
          <Icon name="plus" size={13} color={T.gray600}/> Add Email
        </button>
      </div></Field>
      </>)} preview={email ? <EmailPreview content={templateContentOf(email)} subject={email.subject || email.name || ''}/> : null}/>
    </CreatePanelFrame>
    {edited && editedEmail && <SequenceEmailPanel key={edited.key} initial={{...editedEmail, subject:editedEmail.subject || editedEmail.name || ''}} onCancel={()=>setEditing(null)}
      onSave={(email)=>{ setS(x => ({...x, emails:x.emails.map(e => e.key === edited.key ? {...e, email} : e)})); setEditing(null); }}/>}
  </>);
}

/* Quote Templates: code, name, what it holds; Add and Edit (the quote builder's six steps, quotes.jsx QuoteBuilder `template`), View (the quotation it makes, with sample details), Rename, Delete. */
function QuoteTemplatesTab({data, setData, say}){
  const can = (action, t) => templateCan('quoteTemplates', action, t);
  const all = quoteTemplatesOf(data), list = all.filter(t => can('view', t));
  const setList = (fn) => setData(d => ({...d, quoteTemplates:fn(quoteTemplatesOf(d))}));
  const [openId, setOpenId] = React.useState(null);
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState(null);     // the template being edited (its id)
  const [renaming, setRenaming] = React.useState(null);   // {id, name}
  const [deleting, setDeleting] = React.useState(null);
  const open = list.find(t => t.id === openId) || null, edited = list.find(t => t.id === editing) || null;
  const cols = [{key:'code', label:'Code', width:110}, {key:'name', label:'Template Name', width:240}, {key:'services', label:'Services', width:280},
    {key:'payment', label:'Payment Plan', width:180}, {key:'createdBy', label:'Created By', width:160}, {key:'created', label:'Created', width:150}];
  const rows = list.map(t => ({id:t.id, code:t.code, name:t.name, services:(t.items || []).map(it => it.name).join(', '), payment:PAYMENT_TYPE_LABEL[quotePlanOf(t).paymentType],
    createdBy:creatorOf(t), created:fmtQuoteDate(t.createdAt)}));
  const actions = (t) => [{label:'View Template', onClick:()=>setOpenId(t.id)},
    ...(can('edit', t) ? [{label:'Edit Template', onClick:()=>{ setOpenId(null); setEditing(t.id); }}, {label:'Rename Template', onClick:()=>setRenaming({id:t.id, name:t.name})}] : []),
    ...(can('delete', t) ? [{label:'Delete Template', danger:true, onClick:()=>setDeleting(t)}] : [])];
  // Bulk Actions → Delete, as the row's (the ones the person may delete).
  const qtBulk = useTableBulkDelete({rows, noun:'template', canDelete:(r) => can('delete', list.find(t => t.id === r.id)), skipNote:'not yours to delete',
    remove:(ids) => { setList(ts => ts.filter(t => !ids.includes(t.id))); if(ids.includes(openId)) setOpenId(null); }, onDone:(n) => say(`${bulkPlural(n, 'template')} deleted`)});
  const schema = {
    properties:cols, noun:'template', searchKeys:['code', 'name', 'services'], canCreateProperty:false, boards:false, bulkActions:qtBulk.bulkActions,
    filterProps:[{key:'name', label:'Name', type:'text'}, {key:'createdBy', label:'Created By', type:'select'}], selectValues:{createdBy:[...new Set(list.map(t => t.createdBy).filter(Boolean))]},
    // Its name opens it for editing straight away, the quotation beside it (a person who can't edit it sees its details).
    renderCell:(key, r) => key === 'name' ? <ContactName name={r.name} style={{fontSize:'inherit', fontWeight:500}}
        onOpen={()=>{ if(can('edit', list.find(t => t.id === r.id))){ setOpenId(null); setEditing(r.id); } else setOpenId(r.id); }}/>
      : undefined,
    renderActions:(r) => <RowActionsMenu title="Template Actions" width={MENU_W} items={actions(list.find(t => t.id === r.id))}/>,
  };
  const totals = open ? quoteTotals(open) : null;
  const create = (vals) => {
    const t = {id:`qt-${Date.now().toString(36)}`, code:nextTemplateCode(all), createdBy:CURRENT_USER.name, createdAt:new Date(), ...vals};
    setList(ts => [...ts, t]); setCreating(false); say(`Template ${t.code} created`);
  };
  return (
    <div style={{display:'flex', flexDirection:'column', flex:1, minHeight:0}}>
      <RecordViewsModule schema={schema} rows={rows} columns={cols.map(c => c.key)} storeKey="views:templates-quoteTemplates"
        defaultViews={[{id:'tv-quoteTemplates', name:'All Quote Templates', sort:{key:'code', dir:'asc'}}]}
        actions={() => can('create') && <button onClick={()=>{ setOpenId(null); setCreating(true); }} title="Add Quote Template" aria-label="Add Quote Template" style={toolbarIconButton}><Icon name="plus" size={14} color={T.gray800}/></button>}
        overlay={creating ? <QuoteBuilder template={{templates:all, onSave:create}} onClose={()=>setCreating(false)}/>
          : edited ? <QuoteBuilder key={edited.id} onClose={()=>setEditing(null)} template={{initial:edited, templates:all,
              onSave:(vals)=>{ setList(ts => ts.map(t => t.id === edited.id ? {...t, ...vals, installments:undefined} : t)); setEditing(null); say('Template saved'); }}}/>
          : open && <DetailPanel title={open.name} onClose={()=>setOpenId(null)} menuItems={actions(open).filter(it => !/^View/.test(it.label))}
          fields={[['Code', open.code], ['Services', String((open.items || []).length)], ['Total', fmtMoney(totals.total, quoteCurrency(open))], ['Created', fmtQuoteDate(open.createdAt)], ['Created By', creatorOf(open)]]}>
            <QuoteDocument quote={sampleQuoteOf(open)}/>
        </DetailPanel>}/>
      {renaming && <StModal title="Rename Template" primary="Rename Template" canSubmit={!!renaming.name.trim()} onCancel={()=>setRenaming(null)}
        onSubmit={()=>{ setList(ts => ts.map(t => t.id === renaming.id ? {...t, name:renaming.name.trim()} : t)); setRenaming(null); say('Template renamed'); }}>
        <div><label style={fieldLabel}>Template Name</label><input autoFocus value={renaming.name} onChange={e=>setRenaming(r => ({...r, name:e.target.value}))} style={fieldInput}/></div>
      </StModal>}
      {qtBulk.bulkModal}
      {deleting && <StModal title="Delete Template" primary="Delete Template" danger onCancel={()=>setDeleting(null)}
        onSubmit={()=>{ setList(ts => ts.filter(t => t.id !== deleting.id)); if(openId === deleting.id) setOpenId(null); setDeleting(null); say('Template deleted'); }}>
        <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>{deleting.code} · {deleting.name} will be deleted. Quotes made from it keep what they were given. This can't be undone.</div>
      </StModal>}
    </div>
  );
}

function TemplatesSettings({data, setData}){
  const tabs = TEMPLATE_TABS.filter(t => templateCan(t.kind, 'view'));
  const [tabPicked, setTab] = React.useState('templates');
  const tab = tabs.some(t => t.id === tabPicked) ? tabPicked : (tabs[0] || {}).id;
  const kind = (TEMPLATE_TABS.find(t => t.id === tab) || {}).kind;
  const can = (action, item) => templateCan(kind, action, item);
  const [form, setForm] = React.useState(null);        // {kind, initial?}
  const [openId, setOpenId] = React.useState(null);
  const [deleting, setDeleting] = React.useState(null);  // {kind, item}
  const [assigning, setAssigning] = React.useState(null);   // the email template being assigned (its id)
  const [exiting, setExiting] = React.useState(null);       // {seq, object, record, left}: an enrollment about to be exited
  const [viewing, setViewing] = React.useState(null);       // {seqId, object, recordId}: the enrollment open (EnrollmentPanel)
  const [toast, setToast] = React.useState(null);
  const say = (m) => { setToast(m); setTimeout(()=>setToast(null), TOAST_MS); };
  const templates = emailTemplatesOf(data), sequences = emailSequencesOf(data);
  const setTemplates = (fn) => setData(d => ({...d, emailTemplates:fn(emailTemplatesOf(d))}));
  const setSequences = (fn) => setData(d => ({...d, emailSequences:fn(emailSequencesOf(d))}));
  const templateName = (id) => (templates.find(t => t.id === id) || {}).name || 'Deleted template';
  /* A sequence is also in use while records are enrolled in it (its emails still scheduled for
     them): it can't be deleted until they've gone out or the records exit it. */
  const hub = useRecordHub(), engineCtx = useWorkflowEngineCtx();
  const enrollments = React.useMemo(() => sequenceEnrollments(hub, sequences), [hub && hub.activities, hub && hub.records, sequences]);
  const enrolledIn = (id) => (enrollments[id] || []).length;
  const usage = (kind, id) => {
    const ws = usedInWorkflows(data, id);
    const seqs = kind === 'templates' ? sequences.filter(s => s.emails.some(e => e.templateId === id)) : [];
    const enrolled = kind === 'sequences' ? enrolledIn(id) : 0;
    return [...ws.map(w => `${w.name || 'Workflow'} (workflow)`), ...seqs.map(s => `${s.name} (sequence)`), ...(enrolled ? [`${enrolled} enrolled record${enrolled === 1 ? '' : 's'}`] : [])];
  };
  const isT = tab === 'templates';
  const list = (isT ? templates : sequences).filter(x => can('view', x));
  const open = list.find(x => x.id === openId) || null;
  // Subject is a column again (2026-11-17).
  const cols = isT ? [{key:'name', label:'Template Name', width:240}, {key:'subject', label:'Subject', width:280}, {key:'usedBy', label:'Used By', width:120}, {key:'createdBy', label:'Created By', width:170}]
    : [{key:'name', label:'Sequence Name', width:240}, {key:'enrolled', label:'Enrolled', width:130}, {key:'usedBy', label:'Used By', width:120}, {key:'createdBy', label:'Created By', width:170}];
  const rows = list.map(x => isT ? {id:x.id, name:x.name, subject:x.subject, usedBy:usage('templates', x.id).length, createdBy:creatorOf(x)}
    : {id:x.id, name:x.name, enrolled:enrolledIn(x.id), usedBy:usage('sequences', x.id).length, createdBy:creatorOf(x)});
  const noun = isT ? 'template' : 'sequence', Noun = isT ? 'Template' : 'Sequence';
  // Bulk Actions: Delete — one in use (by a sequence or a workflow) is skipped, as its Delete refuses.
  const listBulk = useTableBulkDelete({rows:list, noun, canDelete:(x) => can('delete', x) && !usage(tab, x.id).length, skipNote:'in use or not yours to delete',
    remove:(ids) => { (isT ? setTemplates : setSequences)(xs => xs.filter(x => !ids.includes(x.id))); if(ids.includes(openId)) setOpenId(null); }, onDone:(n) => say(`${bulkPlural(n, noun)} deleted`)});
  const schema = {
    properties:cols, noun, searchKeys:['name', 'subject'], fillWidth:true, canCreateProperty:false, boards:false, bulkActions:listBulk.bulkActions,
    filterProps:[{key:'name', label:'Name', type:'text'}, {key:'usedBy', label:'Used By', type:'number'}, ...(isT ? [{key:'createdBy', label:'Created By', type:'select'}] : [])],
    selectValues: isT ? {createdBy:[...new Set(rows.map(r => r.createdBy).filter(Boolean))]} : {},
    // A template's or sequence's name opens it for editing straight away — the editor shows it too (a person who can't edit it sees its details).
    renderCell:(key, r) => key === 'name' ? <ContactName name={r.name} style={{fontSize:'inherit', fontWeight:500}}
        onOpen={()=>{ const x = list.find(y => y.id === r.id); if(can('edit', x)){ setOpenId(null); setForm({kind:tab, initial:x}); } else setOpenId(r.id); }}/>
      : key === 'enrolled' ? <EnrolledMenu list={enrollments[r.id] || []} onOpen={(e)=>hub.openRecord(e.object, e.record.id)} onView={(e)=>setViewing({seqId:r.id, object:e.object, recordId:e.record.id})}
          onExit={(e)=>setExiting({...e, seq:list.find(q => q.id === r.id)})}/> : undefined,
    renderActions:(r) => { const x = list.find(y => y.id === r.id);
      return <RowActionsMenu title={`${Noun} Actions`} width={MENU_W} items={[{label:`View ${Noun}`, onClick:()=>setOpenId(r.id)},
        ...(can('edit', x) ? [{label:`Edit ${Noun}`, onClick:()=>setForm({kind:tab, initial:x})}, ...(isT ? [{label:'Assign Template', onClick:()=>setAssigning(x.id)}] : [])] : []),
        ...(!isT && can('create') ? [{label:'Clone Sequence', onClick:()=>clone(x)}] : []),
        ...(can('delete', x) ? [{label:`Delete ${Noun}`, danger:true, onClick:()=>setDeleting({kind:tab, item:x})}] : [])]}/>; },
  };
  const save = (vals) => {
    const editing = form.initial;
    if(form.kind === 'templates'){
      const t = vals;
      if(editing) setTemplates(ts => ts.map(x => x.id === editing.id ? {...x, ...t} : x));
      // A new template: who it's for comes next (Assign Template).
      else { const id = `et-${Date.now().toString(36)}`; setTemplates(ts => [...ts, {id, createdBy:CURRENT_USER.name, ...t}]); setAssigning(id); }
    } else {
      if(editing) setSequences(ss => ss.map(x => x.id === editing.id ? {...x, ...vals} : x));
      else setSequences(ss => [...ss, {id:`es-${Date.now().toString(36)}`, createdBy:CURRENT_USER.name, ...vals}]);
    }
    say(editing ? 'Saved' : `${form.kind === 'templates' ? 'Template' : 'Sequence'} created`);
    setForm(null);
  };
  const used = deleting ? usage(deleting.kind, deleting.item.id) : [];
  // Clone Sequence: the same emails under "<name> copy" (as a cloned view is named), the person's own.
  const clone = (x) => { const id = `es-${Date.now().toString(36)}`;
    setSequences(ss => [...ss, {...JSON.parse(JSON.stringify(x)), id, name:`${x.name} copy`, createdBy:CURRENT_USER.name}]); setOpenId(null); say('Sequence cloned'); };
  const assigned = assigning && templates.find(t => t.id === assigning);
  const exit = () => {
    const {seq, record} = exiting;
    const n = exitEnrollmentOf(engineCtx, exiting, seq);
    setExiting(null); setViewing(null); say(`${record.name || 'Record'} exited · ${bulkPlural(n, 'email')} cancelled`);
  };
  // The enrollment open: its record's emails of the sequence as they are now (gone once nothing's left to send).
  const viewedSeq = viewing && sequences.find(q => q.id === viewing.seqId);
  const viewed = viewedSeq && (enrollments[viewing.seqId] || []).find(e => e.object === viewing.object && String(e.record.id) === String(viewing.recordId));
  const saveEnrollment = (changes) => { saveEnrollmentOf(hub, viewed, changes); setViewing(null); say('Enrollment saved'); };
  return (
    <div style={{position:'relative', flex:1, minHeight:0, display:'flex', flexDirection:'column', overflow:'hidden'}}>
      <SettingsPage fill>
        {/* The tabs row as Users & Teams: no gap under it — the view row's own padding sets the space. */}
        <div style={{display:'flex', gap:8, borderBottom:`1px solid ${T.borderStrong}`, flexShrink:0}}>
          {tabs.map(t => <UtTab key={t.id} icon={t.icon} label={t.label} active={tab === t.id} onClick={()=>{ setTab(t.id); setOpenId(null); }}/>)}
        </div>
        {!tab ? <div style={{...stTextB, padding:'24px 0'}}>You don't have access to any templates.</div> :
        tab === 'quoteTemplates' ? <QuoteTemplatesTab data={data} setData={setData} say={say}/> :
        tab === 'playbooks' ? <PlaybooksTab data={data} setData={setData} say={say}/> :
        tab === 'services' ? <ServicesPage/> :
        <div style={{display:'flex', flexDirection:'column', flex:1, minHeight:0}}>
          <RecordViewsModule key={tab} schema={schema} rows={rows} columns={cols.map(c => c.key)} storeKey={isT ? 'views:templates-templates-v2' : 'views:templates-sequences-v2' /* v2: Subject back (templates), Enrolled in place of Emails and Templates */}
            defaultViews={[{id:`tv-${tab}`, name: isT ? 'All Templates' : 'All Sequences', sort:{key:'name', dir:'asc'}}]}
            actions={() => can('create') && <button onClick={()=>{ setOpenId(null); setForm({kind:tab}); }} title={isT ? 'Add Email Template' : 'Add Email Sequence'} aria-label={isT ? 'Add Email Template' : 'Add Email Sequence'} style={toolbarIconButton}><Icon name="plus" size={14} color={T.gray800}/></button>}
            overlay={form ? (form.kind === 'templates'
                ? <TemplateFormPanel key={form.initial ? form.initial.id : 'new'} initial={form.initial} onCancel={()=>setForm(null)} onSave={save}/>
                : <SequenceFormPanel key={form.initial ? form.initial.id : 'new'} initial={form.initial} templates={templates} onCancel={()=>setForm(null)} onSave={save}/>)
              : open && <DetailPanel title={open.name} onClose={()=>setOpenId(null)}
              menuItems={[...(can('edit', open) ? [{label:`Edit ${Noun}`, onClick:()=>setForm({kind:tab, initial:open})}, ...(isT ? [{label:'Assign Template', onClick:()=>setAssigning(open.id)}] : [])] : []),
                ...(!isT && can('create') ? [{label:'Clone Sequence', onClick:()=>clone(open)}] : []),
                ...(can('delete', open) ? [{label:`Delete ${Noun}`, danger:true, onClick:()=>setDeleting({kind:tab, item:open})}] : [])]}
              fields={[...(isT ? [['Subject', open.subject], ['Email Format', emailFormatLabel(templateContentOf(open).format)], ['Assigned To', assignmentLabel(open.assignedTo, data)]] : [['Emails', String(open.emails.length)]]),
                ['Used By', usage(tab, open.id).length ? usage(tab, open.id).join(', ') : 'Not used'], ['Created By', creatorOf(open)]]}>
                {isT ? <div style={{display:'flex', flexDirection:'column', gap:8}}><EmailHtmlFrame html={emailHtmlOf(templateContentOf(open))}/>
                    {templateContentOf(open).format === 'simple' && <EmailAttachmentList list={templateContentOf(open).attachments}/>}</div>
                  : <ol style={{margin:0, padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:10}}>
                      {open.emails.map((e, i) => (
                        <li key={i} style={{display:'flex', gap:10, alignItems:'baseline'}}>
                          <span style={{fontSize:12, color:T.attioMuted, width:110, flexShrink:0}}>{sequenceWhenLabel(e, i)}</span>
                          <span style={{fontSize:13, color:T.attioText}}>{templateName(e.templateId)}</span>
                        </li>
                      ))}
                    </ol>}
            </DetailPanel>}/>
        </div>}
      </SettingsPage>
      {listBulk.bulkModal}
      {assigned && <AssignPeopleModal key={assigned.id} title="Assign Template" value={assigned.assignedTo} data={data} onCancel={()=>setAssigning(null)}
        onSave={(a)=>{ setTemplates(ts => ts.map(t => t.id === assigned.id ? {...t, assignedTo:a} : t)); setAssigning(null); say('Template assigned'); }}/>}
      {viewed && <EnrollmentPanel key={`${viewing.seqId}:${viewing.object}:${viewing.recordId}`} entry={viewed} seq={viewedSeq} onClose={()=>setViewing(null)}
        onExit={()=>setExiting({...viewed, seq:viewedSeq})} onSave={saveEnrollment}/>}
      {exiting && <StModal title="Exit Sequence" primary="Exit Sequence" danger onCancel={()=>setExiting(null)} onSubmit={exit}>
        <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>{exiting.record.name || 'This record'} leaves {exiting.seq.name}. {bulkPlural(exiting.left, 'scheduled email')} won't be sent.</div>
      </StModal>}
      {deleting && <StModal title={`Delete ${deleting.kind === 'templates' ? 'template' : 'sequence'}`} primary={used.length ? null : 'Delete'} danger onCancel={()=>setDeleting(null)}
        onSubmit={()=>{ (deleting.kind === 'templates' ? setTemplates : setSequences)(xs => xs.filter(x => x.id !== deleting.item.id)); if(openId === deleting.item.id) setOpenId(null); setDeleting(null); say(deleting.kind === 'templates' ? 'Email template deleted' : 'Sequence deleted'); }}>
        <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>
          {used.length ? `${deleting.item.name} is used by ${used.join(', ')}. Remove it there first, then delete it.` : `${deleting.item.name} will be deleted. This can't be undone.`}
        </div>
      </StModal>}
      <CopyToast message={toast}/>
    </div>
  );
}
SETTINGS_PAGES['settings.templates'] = TemplatesSettings;

Object.assign(window, {TemplatesSettings, SequenceEnrollmentsSettings, templateUsable, sequenceEnrollments, sequenceInstances, sampleSequenceEnrollments, sampleGroupEnrollment});
