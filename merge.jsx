/* HOF Pulse ERP — Merge and Duplicate Detection (decided 2026-11-12).

   The system checks each record type's records against each other — Contacts against Contacts,
   Deals against Deals, Customers against Customers — for a shared email (any case) or phone
   number (its digits). Records linked that way are one MERGE CASE. Records of different types are
   never matched: a deal carries its contact's email, and it's the same person, not a duplicate.
   One switch per record type (Settings → Records → the record type, 2026-11-13): Enable Merge Cases
   Reporting. On, its records get Merge Status and its cases show; off, neither (Contacts on to
   start with, every other record type off — dataModel.jsx mergeReportingOn).
     Merge Status — a system property (dataModel.jsx), worked out here: in a case, the oldest
                    record is Unique and each newer one Form Refill (a form submission created it)
                    or Duplicate (added any other way); a record with no match is Unique.
     Merge cases  — a Merge Cases button beside Workflow Violations on the record type's page, with
                    the count, opening a dropdown of the cases: each expands to its records, and
                    Review Merge opens the merge review. A case shows to a person whose Merge
                    permission (Settings → Users & Teams → Records) covers every record in it.
     Merge review — a side panel: one column per record, oldest first (the one kept), then Final
                    Value; only the properties whose values differ, system ones included (Created
                    Date, the owner). Clicking a value makes it the final one — the kept record's to
                    start with, else the first record's that has one. A pipeline and its stage are
                    picked together; an amount brings its currency.
                    A link the kept record may have only one of (the link's type — by default a
                    deal's or customer's contact, a customer's deal) is a row too, when they differ.
     Merge        — the oldest record is kept with the chosen values; its links as their types allow
                    (all of the merged records' where it may have many, the picked one where only
                    one — the others unlinked); the others' activity (files and
                    emails included), quotes, documents, payment plans, invoices,
                    Customer Profile answers and form submissions move to it, and they're deleted. A
                    "Records merged" activity on it keeps what was merged and the values replaced
                    (App's mergeRecords).
     Keep Separate — closes the case: its records aren't matched with each other again
                    (`mergeSeparate`, the CRM's store); each stays Unique unless it matches another. */

const MERGE_STATUS_TONE = {'Form Refill':'info', Duplicate:'warn', Unique:'neutral'};
// What makes two records a match: the same email, ignoring case; the same phone number, by its digits.
const mergeEmailKey = (v) => String(v || '').trim().toLowerCase();
const mergePhoneKey = (v) => { const d = String(v || '').replace(/\D/g, ''); return d.length >= 6 ? d : ''; };
// Oldest first: by Created Date, then by ID (IDs only go up).
const mergeCreatedAt = (r) => { const t = Date.parse(r.created || ''); return isNaN(t) ? Infinity : t; };
const mergeIdNumber = (id) => { const m = /(\d+)$/.exec(String(id)); return m ? Number(m[1]) : 0; };
const mergeOldestFirst = (a, b) => (mergeCreatedAt(a) - mergeCreatedAt(b)) || (mergeIdNumber(a.id) - mergeIdNumber(b.id));
const mergePairKey = (a, b) => [String(a), String(b)].sort().join('|');

/* One record type's merge cases and each record's Merge Status: {cases:[{id, object, ids, records,
   on:{email, phone}}], status:Map(id → status)}. `separate`: the cases closed with Keep Separate
   ({object, ids}); `formIndex`: the submission that created each record (formSubmissionIndex). */
function mergeIndexOf(object, records, {separate = [], formIndex} = {}){
  const apart = new Set();
  separate.filter(s => s.object === object).forEach(s => s.ids.forEach((a, i) => s.ids.slice(i + 1).forEach(b => apart.add(mergePairKey(a, b)))));
  const buckets = new Map();
  (records || []).forEach(r => [['email', mergeEmailKey(r.email)], ['phone', mergePhoneKey(r.phone)]].forEach(([kind, v]) => {
    if(!v) return;
    const k = `${kind}:${v}`;
    if(!buckets.has(k)) buckets.set(k, {kind, list:[]});
    buckets.get(k).list.push(r);
  }));
  const parent = new Map(), find = (id) => { while(parent.get(id) !== id){ parent.set(id, parent.get(parent.get(id))); id = parent.get(id); } return id; };
  const on = new Map();   // root → {email, phone}: what matched
  const links = [];
  buckets.forEach(({kind, list}) => {
    for(let i = 0; i < list.length; i++) for(let j = i + 1; j < list.length; j++){
      const a = String(list[i].id), b = String(list[j].id);
      if(a !== b && !apart.has(mergePairKey(a, b))) links.push([a, b, kind]);
    }
  });
  links.forEach(([a, b]) => { [a, b].forEach(x => { if(!parent.has(x)) parent.set(x, x); }); const ra = find(a), rb = find(b); if(ra !== rb) parent.set(ra, rb); });
  links.forEach(([a, , kind]) => { const r = find(a); on.set(r, {...(on.get(r) || {}), [kind]:true}); });
  const groups = new Map(), byId = new Map((records || []).map(r => [String(r.id), r]));
  parent.forEach((_, id) => { const r = find(id); if(!groups.has(r)) groups.set(r, []); groups.get(r).push(byId.get(id)); });
  const status = new Map(), cases = [];
  groups.forEach((list, root) => {
    if(list.length < 2) return;
    const recs = list.filter(Boolean).sort(mergeOldestFirst);
    recs.forEach((r, i) => status.set(String(r.id), i === 0 ? 'Unique' : formIndex && formIndex.has(`${object}:${r.id}`) ? 'Form Refill' : 'Duplicate'));
    cases.push({id:`${object}:${recs.map(r => r.id).join(',')}`, object, ids:recs.map(r => r.id), records:recs, on:on.get(root) || {}});
  });
  cases.sort((a, b) => mergeOldestFirst(b.records[b.records.length - 1], a.records[a.records.length - 1]));   // the newest match first
  return {cases, status};
}
const mergeStatusIn = (idx, id) => (idx && idx.status.get(String(id))) || 'Unique';
// Merge Status in workflow conditions (workflowEngine.jsx conditionFields): undefined for any other property.
const mergeRecordValue = (key, rec) => key !== 'mergeStatus' || !rec ? undefined : mergeStatusIn(WF_LIVE.merge && WF_LIVE.merge[recordObjectOf(rec.id)], rec.id);
// The cases the signed-in person may act on: their Merge permission covers every record.
// A record type's cases show only with Enable Merge Cases Reporting on, and to people whose Merge permission covers every record in the case.
const mergeCasesFor = (hub, object) => !hub || !mergeReportingOn(hub.data, object) ? []
  : ((hub.merge && hub.merge[object] && hub.merge[object].cases) || []).filter(c => c.records.every(r => recordCan(object, r, 'merge')));

/* The properties a merge review compares: every stored one (system ones included), not the worked-out
   ones (Associated Deals, Last Activity Date, Form Name, Merge Status…). A contact's Last Activity
   Date and Last Contacted follow its activity, so they're worked out again after.
   Then the links (dataModel.jsx linkRule): where the kept record may have only one of a record type
   (by default a deal's or customer's contact, a customer's deal) and the records differ, a row picks
   it — the others are unlinked; where it may have many, it gets every merged record's. */
const MERGE_WORKED_OUT = {contacts:['lastActivity', 'lastContacted']};
// Picked together: a pipeline and its stage.
const MERGE_LINKED = {pipeline:['stage'], stage:['pipeline']};
// The Associated property of each record type a record links to (its label in the review).
const MERGE_LINK_PROPERTY = {contacts:'contact', deals:'deals', customers:'customers'};
// `records`: {contacts, deals, customers}.
function mergeRows(data, object, recs, records){
  const props = objectProperties(data, object).filter(p => p.key !== 'mergeStatus' && !(MERGE_WORKED_OUT[object] || []).includes(p.key) && !p.derived);
  const rows = props.map(p => ({...p, field:p.key}))
    .filter(p => {
      const same = (a, b) => samePropertyValue(a[p.field], b[p.field]) && (p.key !== 'amount' || samePropertyValue(a.currency, b.currency));
      return !recs.every(r => same(r, recs[0]));
    });
  const linkRows = RECORD_OBJECTS.filter(o => o !== object && workspaceHasType(o) && linkStoreOf(object, o) && (linkRule(object, o) || {}).perX === 1).map(o => {
    const prop = objectProperties(data, object).find(p => p.key === MERGE_LINK_PROPERTY[o]);
    const linkIds = Object.fromEntries(recs.map(r => [String(r.id), (linkedOf(records, object, r, o)[0] || {}).id ?? null]));
    return {key:`link:${o}`, linkTo:o, label:prop ? prop.label : `Associated ${typeSingular(o, o)}`, type:'Single-Line Text', linkIds};
  }).filter(row => !recs.every(r => String(row.linkIds[String(r.id)] ?? '') === String(row.linkIds[String(recs[0].id)] ?? '')));
  return [...rows, ...linkRows];
}
const mergeBlank = (row, rec) => row.linkTo ? row.linkIds[String(rec.id)] == null : propertyIsEmpty(row, rec[row.field]);
// A record's value of a compared property, in one line.
function mergeValueText(hub, object, row, rec){
  if(row.linkTo) return (hubRecord(hub, row.linkTo, row.linkIds[String(rec.id)]) || {}).name || '';
  const v = rec[row.field];
  const t = propertyTypeId(row.type);
  if(t === 'Pipeline') return (recordPipelines(hub.data, object).find(x => x.id === v) || {}).label || '';
  if(t === 'Pipeline stage') return stageLabelOf(hub.data, rec.pipeline, v) || '';
  if(row.key === 'amount' && object === 'deals') return v === '' || v == null ? '' : moneyText(v, rec.currency || defaultCurrency());
  const text = formatPropertyValueOf(row, v);
  return text == null ? '' : String(dateShown(text));
}

function MergeStatusPill({status}){
  const t = WF_TONES[MERGE_STATUS_TONE[status] || 'neutral'];
  return <span style={{display:'inline-flex', alignItems:'center', height:20, padding:'0 8px', borderRadius:9999, fontSize:11.5, fontWeight:500, whiteSpace:'nowrap', color:t.color, background:t.bg, flexShrink:0}}>{status}</span>;
}
/* ── Merge Cases ── a button beside Workflow Violations (far right of the filters), with the count;
   it opens the cases as a dropdown — each case expands to its records (and what they share), and
   Review Merge opens the merge review. Hidden when there are none. */
function MergeCasesButton({object}){
  const hub = useRecordHub();
  const cases = mergeCasesFor(hub, object);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [open, setOpen] = React.useState(() => new Set());
  const [reviewing, setReviewing] = React.useState(null);   // a case id
  const current = reviewing && cases.find(c => c.id === reviewing);
  React.useEffect(() => { if(reviewing && !current) setReviewing(null); }, [reviewing, !!current]);
  React.useEffect(() => { if(menuOpen && !cases.length) setMenuOpen(false); }, [cases.length]);
  useEscapeClose(() => setMenuOpen(false), menuOpen);
  if(!cases.length && !current) return null;
  const toggle = (id) => setOpen(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const plural = typePlural(object, 'Records'), noun = typeSingular(object, 'Record');
  const review = (id) => { setMenuOpen(false); setReviewing(id); };
  return (
    <span style={{position:'relative', display:'inline-flex'}} onMouseDown={e=>e.stopPropagation()}>
      {cases.length > 0 && (
        <button onClick={()=>setMenuOpen(o => !o)} aria-expanded={menuOpen} aria-haspopup="menu"
          style={{...toolbarButton, background: menuOpen ? T.headerBg : '#fff', color:T.attioText, fontWeight:500}}>
          <Icon name="merge" size={13} color={T.attioText}/> Merge Cases
          <span style={{minWidth:18, height:18, padding:'0 5px', boxSizing:'border-box', borderRadius:9999, background:T.attioText, color:'#fff', fontSize:11, fontWeight:700,
            display:'inline-flex', alignItems:'center', justifyContent:'center'}}>{cases.length}</span>
        </button>
      )}
      <MenuShell open={menuOpen} onClose={()=>setMenuOpen(false)} anchorRight width={340}>
        <div role="menu" style={{maxHeight:420, overflowY:'auto', display:'flex', flexDirection:'column', gap:2}}>
          {cases.map(c => {
            const isOpen = open.has(c.id), recs = c.ids.map(id => hubRecord(hub, object, id)).filter(Boolean);
            return (
              <div key={c.id} data-merge-case={c.id} style={{borderRadius:8, background: isOpen ? T.headerBg : 'transparent'}}>
                <button onClick={()=>toggle(c.id)} aria-expanded={isOpen}
                  onMouseEnter={e=>{ if(!isOpen) e.currentTarget.style.background = T.headerBg; }} onMouseLeave={e=>{ e.currentTarget.style.background = 'transparent'; }}
                  style={{display:'flex', alignItems:'center', gap:8, width:'100%', padding:'8px 10px', border:'none', borderRadius:8, background:'transparent', cursor:'pointer', textAlign:'left', fontFamily:'inherit'}}>
                  <Icon name="merge" size={13} color={T.gray600} style={{flexShrink:0}}/>
                  <span style={{flex:1, minWidth:0, fontSize:13, fontWeight:500, color:T.attioText, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{(recs[0] || c.records[0]).name || `Unnamed ${noun}`}</span>
                  <span style={{fontSize:12, color:T.attioMuted, whiteSpace:'nowrap'}}>{c.ids.length} {plural}</span>
                  <Icon name="chevDown" size={11} color={T.gray600} style={{flexShrink:0, transform: isOpen ? 'rotate(180deg)' : 'none'}}/>
                </button>
                {isOpen && (
                  <div style={{display:'flex', flexDirection:'column', gap:8, padding:'0 10px 10px'}}>
                    <div style={{display:'flex', flexDirection:'column', background:'#fff', border:`1px solid ${T.border}`, borderRadius:8}}>
                      {recs.map((r, i) => (
                        <div key={r.id} style={{display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderTop: i ? `1px solid ${T.border}` : 'none'}}>
                          <span style={{flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:1}}>
                            <span style={{fontSize:13, color:T.attioText, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{r.name || `Unnamed ${noun}`}</span>
                            <span style={{fontSize:12, color:T.attioMuted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{c.on.email ? r.email : r.phone}</span>
                          </span>
                          <MergeStatusPill status={r.mergeStatus || mergeStatusIn(hub.merge[object], r.id)}/>
                        </div>
                      ))}
                    </div>
                    <button onClick={()=>review(c.id)} style={{...eventBtn(true), height:30}}>Review Merge</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </MenuShell>
      {current && <MergeReviewPanel object={object} mergeCase={current} onClose={()=>setReviewing(null)}/>}
    </span>
  );
}

/* ── Merge review ── the side panel: Property, a column per record (the first is kept), Final Value. */
function MergeReviewPanel({object, mergeCase, onClose}){
  const hub = useRecordHub();
  const recs = mergeCase.ids.map(id => hubRecord(hub, object, id)).filter(Boolean);
  const rows = mergeRows(hub.data, object, recs, hub.records);
  const defaultPick = (row) => { const i = recs.findIndex(r => !mergeBlank(row, r)); return mergeBlank(row, recs[0]) && i > 0 ? i : 0; };
  const [picks, setPicks] = React.useState(() => Object.fromEntries(rows.map(r => [r.key, defaultPick(r)])));
  const [confirming, setConfirming] = React.useState(false);
  const pickOf = (row) => picks[row.key] ?? defaultPick(row);
  const pick = (row, i) => setPicks(p => { const n = {...p, [row.key]:i}; (MERGE_LINKED[row.key] || []).forEach(k => { if(rows.some(r => r.key === k)) n[k] = i; }); return n; });
  if(recs.length < 2) return null;
  const plural = typePlural(object, 'Records').toLowerCase(), noun = typeSingular(object, 'Record');
  const kept = recs[0];
  // The values the kept record takes (only where another record's was chosen), and the log of them.
  const chosen = rows.filter(r => pickOf(r) !== 0);
  // The one linked record picked for each link the kept record may have only one of.
  const links = Object.fromEntries(rows.filter(r => r.linkTo).map(r => [r.linkTo, r.linkIds[String(recs[pickOf(r)].id)]]));
  const values = Object.assign({}, ...chosen.filter(r => !r.linkTo).map(r => { const src = recs[pickOf(r)];
    return {[r.field]:src[r.field], ...(r.key === 'amount' ? {currency:src.currency} : {})}; }));
  const changes = chosen.map(r => ({label:r.label, from:mergeValueText(hub, object, r, kept), to:mergeValueText(hub, object, r, recs[pickOf(r)])}));
  const merge = () => {
    hub.merge.mergeRecords(object, recs.map(r => r.id), values, changes, links);
    hub.toast(`${typePlural(object, 'Records')} merged · ${values.name ?? kept.name ?? noun}`);
    onClose();
  };
  const keepSeparate = () => { hub.merge.keepSeparate(object, recs.map(r => r.id)); hub.toast(`Kept separate · ${recs.length} ${plural}`); onClose(); };
  const cols = `180px repeat(${recs.length}, minmax(190px, 1fr)) minmax(190px, 1fr)`;
  const cell = {padding:'10px 12px', borderBottom:`1px solid ${T.border}`, minWidth:0, display:'flex', alignItems:'center'};
  return (
    <CreatePanelFrame title="Review Merge" onClose={onClose} placement="fixed" width={`min(${180 + (recs.length + 1) * 250 + 40}px, calc(100vw - 72px))`} zIndex={95}
      actions={<>
        <span style={{marginRight:'auto'}}><StSecondary label="Keep Separate" onClick={keepSeparate}/></span>
        <StSecondary label="Cancel" onClick={onClose}/>
        <StCta label="Merge Records" onClick={()=>setConfirming(true)}/>
      </>}>
      <div style={{overflowX:'auto'}}>
        <div style={{display:'grid', gridTemplateColumns:cols, minWidth:'min-content', border:`1px solid ${T.border}`, borderRadius:10, overflow:'hidden'}}>
          <div style={{...cell, background:T.headerBg, fontSize:12, fontWeight:600, color:T.attioMuted}}>Property</div>
          {recs.map((r, i) => (
            <div key={r.id} style={{...cell, background:T.headerBg, flexDirection:'column', alignItems:'flex-start', gap:4}}>
              <span style={{display:'flex', alignItems:'center', gap:6, maxWidth:'100%'}}>
                <span style={{fontSize:13, fontWeight:600, color:T.attioText, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{r.name || `Unnamed ${noun}`}</span>
                {i === 0 && <span style={{fontSize:11, fontWeight:600, color:T.attioText, border:`1px solid ${T.borderStrong}`, borderRadius:6, padding:'0 5px', lineHeight:'16px', flexShrink:0}}>Kept</span>}
              </span>
              <MergeStatusPill status={r.mergeStatus || 'Unique'}/>
            </div>
          ))}
          <div style={{...cell, background:T.headerBg, fontSize:12, fontWeight:600, color:T.attioMuted}}>Final Value</div>
          {rows.map(row => {
            const chosenAt = pickOf(row), finalText = mergeValueText(hub, object, row, recs[chosenAt]);
            return (
              <React.Fragment key={row.key}>
                <div style={{...cell, fontSize:13, color:T.attioMuted}}><span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={row.label}>{row.label}</span></div>
                {recs.map((r, i) => {
                  const on = chosenAt === i, text = mergeValueText(hub, object, row, r);
                  return (
                    <div key={r.id} style={cell}>
                      <button role="radio" aria-checked={on} onClick={()=>pick(row, i)} title={text || 'No value'}
                        style={{display:'flex', alignItems:'center', gap:8, width:'100%', minHeight:32, padding:'6px 10px', borderRadius:8, cursor:'pointer', textAlign:'left', fontFamily:'inherit',
                          border:`1px solid ${on ? T.blue : T.border}`, background: on ? T.blueLight : '#fff'}}>
                        <span style={{width:14, height:14, borderRadius:9999, flexShrink:0, boxSizing:'border-box', border: on ? `4px solid ${T.blue}` : `1.5px solid ${T.borderStrong}`, background:'#fff'}}/>
                        <span style={{fontSize:13, color: text ? T.attioText : T.gray400, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{text || '—'}</span>
                      </button>
                    </div>
                  );
                })}
                <div style={cell}><span style={{fontSize:13, fontWeight:500, color: finalText ? T.attioText : T.gray400, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={finalText}>{finalText || '—'}</span></div>
              </React.Fragment>
            );
          })}
        </div>
        {!rows.length && <EmptyState compact title="No Differences"/>}
      </div>
      {confirming && (
        <StModal title="Merge Records" primary="Merge Records" onCancel={()=>setConfirming(false)} onSubmit={merge}>
          <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>
            {recs.length - 1 === 1 ? `The other ${typeSingular(object, 'record').toLowerCase()}` : `The other ${recs.length - 1} ${plural}`} will be deleted. This can't be undone.
          </div>
        </StModal>
      )}
    </CreatePanelFrame>
  );
}

Object.assign(window, {MERGE_STATUS_TONE, mergeIndexOf, mergeStatusIn, mergeRecordValue, mergeCasesFor, mergeRows, mergeValueText, MergeStatusPill, MergeCasesButton, MergeReviewPanel});
