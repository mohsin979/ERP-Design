/* HOF Pulse ERP — Merge and Duplicate Detection (decided 2026-11-12), workflow merges and Split
   (2026-11-13).

   The system checks each record type's records against each other — Contacts against Contacts,
   Deals against Deals, Customers against Customers — for a shared email (any case) or phone
   number (its digits). Records linked that way are one MERGE CASE. Records of different types are
   never matched: a deal carries its contact's email, and it's the same person, not a duplicate.
   One switch per record type (Settings → Records → the record type): Enable Merge Cases
   Reporting. On, its records get Merge Status and its cases show; off, neither (Contacts on to
   start with, every other record type off — dataModel.jsx mergeReportingOn).
     Merge Status — a system property (dataModel.jsx), worked out here: in a case, each newer
                    record is Form Refill (a form submission created it) or Duplicate (added any
                    other way); the oldest, and a record with no match, is Unique — or Merged,
                    once other records were merged into it (until it's split again).
     Merge cases  — a Merge Cases button beside Workflow Violations on the record type's page, with
                    the count, opening a dropdown of the cases: clicking one opens its merge
                    review. A case shows to a person whose Merge permission (Settings → Users &
                    Teams → Records) covers every record in it.
     Merge review — a side panel: one column per record, oldest first — its name and a grey chip
                    (First, Second, Third…) —, then Final Value; only the properties whose values
                    differ, system ones included (Created Date, the owner). Clicking a value makes
                    it the final one — the first record's to start with, else the first record's
                    that has one. A pipeline and its stage are picked together; an amount brings
                    its currency. A link the merged record may have only one of (the link's type —
                    by default a deal's or customer's contact, a customer's deal) is a row too,
                    when they differ.
     Merge        — the first (oldest) record stays with the chosen values; its links as their
                    types allow (all of the merged records' where it may have many, the picked one
                    where only one — the others unlinked); the others' activity (files and emails
                    included), quotes, documents, payment plans, invoices, Customer Profile
                    answers and form submissions move to it, and they're deleted. A "Records
                    merged" activity on it keeps what was merged and the values replaced, and the
                    merge is kept whole (`mergeHistory`, App's mergeRecords) so it can be split.
     Keep Separate — closes the case: its records aren't matched with each other again
                    (`mergeSeparate`, the CRM's store); each stays Unique unless it matches another.
     Workflows    — the trigger Record Is Duplicated (a record marked Form Refill or Duplicate) and
                    the action Merge Record (workflows.jsx, workflowEngine.jsx): the action's rules
                    say, per property, which record's value the merged record takes — First (the
                    oldest) or Latest (the newest), however many records match (the same grid,
                    without records' values); where that record has no value, the nearest one that
                    has: the next oldest for First, the next newest for Latest. No approval per case.
     Split        — a merged record's ⋯ menu → Split: the records it was merged from come back as
                    they were (their values, links, activity, quotes, documents, payment plans,
                    invoices, form submissions, Customer Profile answers). What's new since the
                    merge — a property changed, an activity added (emails, calls, meetings, tasks,
                    notes, files), a quote, document, payment plan or form submission, a record
                    linked — is listed, and each goes to the record chosen for it (the first to
                    start with); invoices follow their plan, and the record's history entries
                    (owner and stage changes, workflow runs) stay on the first. The records are
                    then kept separate (not matched again), and each gets a "Records split"
                    activity. The latest merge is split first. No workflow runs on a split. */

// What makes two records a match: the same email, ignoring case; the same phone number, by its digits.
const mergeEmailKey = (v) => String(v || '').trim().toLowerCase();
const mergePhoneKey = (v) => { const d = String(v || '').replace(/\D/g, ''); return d.length >= 6 ? d : ''; };
// Oldest first: by Created Date, then by ID (IDs only go up).
const mergeCreatedAt = (r) => { const t = Date.parse(r.created || ''); return isNaN(t) ? Infinity : t; };
const mergeIdNumber = (id) => { const m = /(\d+)$/.exec(String(id)); return m ? Number(m[1]) : 0; };
const mergeOldestFirst = (a, b) => (mergeCreatedAt(a) - mergeCreatedAt(b)) || (mergeIdNumber(a.id) - mergeIdNumber(b.id));
const mergePairKey = (a, b) => [String(a), String(b)].sort().join('|');

/* One record type's merge cases and each record's Merge Status: {cases:[{id, object, ids, records,
   on:{email, phone}}], status:Map(id → status), merged}. `separate`: the cases closed with Keep
   Separate ({object, ids}); `formIndex`: the submission that created each record
   (formSubmissionIndex); `merged`: the ids of the records others were merged into (a Set). */
function mergeIndexOf(object, records, {separate = [], formIndex, merged = new Set()} = {}){
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
    recs.forEach((r, i) => status.set(String(r.id), i === 0 ? (merged.has(String(r.id)) ? 'Merged' : 'Unique') : formIndex && formIndex.has(`${object}:${r.id}`) ? 'Form Refill' : 'Duplicate'));
    cases.push({id:`${object}:${recs.map(r => r.id).join(',')}`, object, ids:recs.map(r => r.id), records:recs, on:on.get(root) || {}});
  });
  cases.sort((a, b) => mergeOldestFirst(b.records[b.records.length - 1], a.records[a.records.length - 1]));   // the newest match first
  return {cases, status, merged};
}
const mergeStatusIn = (idx, id) => (idx && (idx.status.get(String(id)) || (idx.merged && idx.merged.has(String(id)) ? 'Merged' : ''))) || 'Unique';
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
// The properties a merge compares (and a split restores).
const mergeProps = (data, object) => objectProperties(data, object).filter(p => p.key !== 'mergeStatus' && !(MERGE_WORKED_OUT[object] || []).includes(p.key) && !p.derived);
// The record types a record of `object` may link to only one of, each with its row's label.
const mergeSingleLinks = (data, object) => RECORD_OBJECTS.filter(o => o !== object && workspaceHasType(o) && linkStoreOf(object, o) && (linkRule(object, o) || {}).perX === 1).map(o => {
  const prop = objectProperties(data, object).find(p => p.key === MERGE_LINK_PROPERTY[o]);
  return {key:`link:${o}`, linkTo:o, label:prop ? prop.label : `Associated ${typeSingular(o, o)}`, type:'Single-Line Text'};
});
// `records`: {contacts, deals, customers}.
function mergeRows(data, object, recs, records){
  const rows = mergeProps(data, object).map(p => ({...p, field:p.key}))
    .filter(p => {
      const same = (a, b) => samePropertyValue(a[p.field], b[p.field]) && (p.key !== 'amount' || samePropertyValue(a.currency, b.currency));
      return !recs.every(r => same(r, recs[0]));
    });
  const linkRows = mergeSingleLinks(data, object).map(row => ({...row, linkIds:Object.fromEntries(recs.map(r => [String(r.id), (linkedOf(records, object, r, row.linkTo)[0] || {}).id ?? null]))}))
    .filter(row => !recs.every(r => String(row.linkIds[String(r.id)] ?? '') === String(row.linkIds[String(recs[0].id)] ?? '')));
  return [...rows, ...linkRows];
}
const mergeBlank = (row, rec) => row.linkTo ? row.linkIds[String(rec.id)] == null : propertyIsEmpty(row, rec[row.field]);
// A record's value of a compared property, in one line.
function mergeValueText(hub, object, row, rec){
  if(row.linkTo) return ((hub.records[row.linkTo] || []).find(r => sameId(r.id, row.linkIds[String(rec.id)])) || {}).name || '';
  const v = rec[row.field];
  const t = propertyTypeId(row.type);
  if(t === 'Pipeline') return (recordPipelines(hub.data, object).find(x => x.id === v) || {}).label || '';
  if(t === 'Pipeline stage') return stageLabelOf(hub.data, rec.pipeline, v) || '';
  if(row.key === 'amount' && object === 'deals') return v === '' || v == null ? '' : moneyText(v, rec.currency || defaultCurrency());
  const text = formatPropertyValueOf(row, v);
  return text == null ? '' : String(dateShown(text));
}

/* What a merge does, from the record picked for each row (`pickOf(row)` → its place in `recs`):
   the values the first record takes (only where another record's was picked), the one linked
   record for each link it may have only one of, and the log of the values replaced. */
function mergeOutcome(view, object, recs, rows, pickOf){
  const chosen = rows.filter(r => pickOf(r) !== 0);
  const links = Object.fromEntries(rows.filter(r => r.linkTo).map(r => [r.linkTo, r.linkIds[String(recs[pickOf(r)].id)]]));
  const values = Object.assign({}, ...chosen.filter(r => !r.linkTo).map(r => { const src = recs[pickOf(r)];
    return {[r.field]:src[r.field], ...(r.key === 'amount' ? {currency:src.currency} : {})}; }));
  const changes = chosen.map(r => ({label:r.label, from:mergeValueText(view, object, r, recs[0]), to:mergeValueText(view, object, r, recs[pickOf(r)])}));
  return {values, links, changes};
}
/* A workflow's merge (Merge Record): `rules` {row key: 'latest'} — each property's value comes from
   the First record (the oldest) unless Latest (the newest) is set, whatever the number of records.
   Where that record has no value, the nearest one that has: the next oldest for First, the next
   newest for Latest. */
function mergeByRules(data, object, recs, records, rules){
  const view = {data, records}, rows = mergeRows(data, object, recs, records);
  const pickFor = (row) => { const order = recs.map((_, i) => i); if((rules || {})[row.key]) order.reverse();
    const hit = order.find(i => !mergeBlank(row, recs[i]));
    return hit === undefined ? 0 : hit; };
  // A stage comes from the record its pipeline comes from.
  const pipelineRow = rows.find(r => r.key === 'pipeline');
  const pickOf = (row) => row.key === 'stage' && pipelineRow ? pickFor(pipelineRow) : pickFor(row);
  return mergeOutcome(view, object, recs, rows, pickOf);
}
// A source record's place among the records being merged, oldest first.
const MERGE_ORDINALS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
const mergeOrdinal = (i) => MERGE_ORDINALS[i] || `No. ${i + 1}`;
const mergeChip = (label) => <span style={{display:'inline-flex', alignItems:'center', height:20, padding:'0 8px', borderRadius:9999, fontSize:11.5, fontWeight:500, whiteSpace:'nowrap',
  color:WF_TONES.neutral.color, background:WF_TONES.neutral.bg, flexShrink:0}}>{label}</span>;

/* ── Merge Cases ── a button beside Workflow Violations (far right of the filters), with the count;
   it opens the cases as a dropdown — clicking a case opens its merge review. Hidden when there are none. */
function MergeCasesButton({object}){
  const hub = useRecordHub();
  const cases = mergeCasesFor(hub, object);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [reviewing, setReviewing] = React.useState(null);   // a case id
  const current = reviewing && cases.find(c => c.id === reviewing);
  React.useEffect(() => { if(reviewing && !current) setReviewing(null); }, [reviewing, !!current]);
  React.useEffect(() => { if(menuOpen && !cases.length) setMenuOpen(false); }, [cases.length]);
  useEscapeClose(() => setMenuOpen(false), menuOpen);
  if(!cases.length && !current) return null;
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
            const first = hubRecord(hub, object, c.ids[0]) || c.records[0];
            return (
              <button key={c.id} role="menuitem" data-merge-case={c.id} onClick={()=>review(c.id)}
                onMouseEnter={e=>{ e.currentTarget.style.background = T.headerBg; }} onMouseLeave={e=>{ e.currentTarget.style.background = 'transparent'; }}
                style={{display:'flex', alignItems:'center', gap:8, width:'100%', padding:'8px 10px', border:'none', borderRadius:8, background:'transparent', cursor:'pointer', textAlign:'left', fontFamily:'inherit'}}>
                <Icon name="merge" size={13} color={T.gray600} style={{flexShrink:0}}/>
                <span style={{flex:1, minWidth:0, fontSize:13, fontWeight:500, color:T.attioText, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{first.name || `Unnamed ${noun}`}</span>
                <span style={{fontSize:12, color:T.attioMuted, whiteSpace:'nowrap'}}>{c.ids.length} {plural}</span>
              </button>
            );
          })}
        </div>
      </MenuShell>
      {current && <MergeReviewPanel object={object} mergeCase={current} onClose={()=>setReviewing(null)}/>}
    </span>
  );
}

/* ── Merge review ── the side panel: Property, a column per record (its name and First / Second / Third…), Final Value. */
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
  const {values, links, changes} = mergeOutcome(hub, object, recs, rows, pickOf);
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
              <span style={{maxWidth:'100%', fontSize:13, fontWeight:600, color:T.attioText, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{r.name || `Unnamed ${noun}`}</span>
              {mergeChip(mergeOrdinal(i))}
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
            {recs.length - 1 === 1 ? `The other ${typeSingular(object, 'record').toLowerCase()}` : `The other ${recs.length - 1} ${plural}`} will be merged into {kept.name || 'the first'}.
          </div>
        </StModal>
      )}
    </CreatePanelFrame>
  );
}

/* ── Merge Record (a workflow action) ── its rules: the merge review's grid without records — Property,
   First, Latest, Final Value (2026-11-13: a case may hold any number of records, so the choice is
   the oldest or the newest). Each property takes First's value unless Latest is set; a pipeline
   and its stage are picked together. `rules` {row key: 'latest'} (First isn't stored). */
const MERGE_RULE_SOURCES = ['First', 'Latest'];
const mergeRuleRows = (data, object) => [...mergeProps(data, object).map(p => ({key:p.key, label:p.label})), ...mergeSingleLinks(data, object).map(r => ({key:r.key, label:r.label}))];
function MergeRecordConfig({config, setConfig, data, context}){
  const [open, setOpen] = React.useState(false);
  const c = config || {}, object = (context || {}).object;
  if(!object) return needsRecord(context);
  return cfgPad(<>
    <div><StSecondary label="Configure Merge" onClick={()=>setOpen(true)}/></div>
    {open && <MergeRulesPanel data={data} object={object} rules={c.rules || {}} onSave={(rules)=>{ setConfig({...c, rules}); setOpen(false); }} onClose={()=>setOpen(false)}/>}
  </>);
}
function MergeRulesPanel({data, object, rules, onSave, onClose}){
  const rows = mergeRuleRows(data, object);
  const [picks, setPicks] = React.useState(() => ({...rules}));
  const pickOf = (row) => picks[row.key] ? 1 : 0;
  const pick = (row, i) => setPicks(p => { const n = {...p, [row.key]:i}; (MERGE_LINKED[row.key] || []).forEach(k => { if(rows.some(r => r.key === k)) n[k] = i; }); return n; });
  const save = () => onSave(Object.fromEntries(rows.filter(r => pickOf(r)).map(r => [r.key, 'latest'])));
  const sources = MERGE_RULE_SOURCES.map((_, i) => i);
  const cols = `minmax(180px, 1fr) repeat(${sources.length}, 96px) 120px`;
  const cell = {padding:'10px 12px', borderBottom:`1px solid ${T.border}`, minWidth:0, display:'flex', alignItems:'center'};
  const head = {...cell, background:T.headerBg, fontSize:12, fontWeight:600, color:T.attioMuted};
  return (
    <CreatePanelFrame title="Merge Record" onClose={onClose} placement="fixed" width="min(620px, calc(100vw - 72px))" zIndex={140}
      actions={<><StSecondary label="Cancel" onClick={onClose}/><StCta label="Save" onClick={save}/></>}>
      <div style={{display:'grid', gridTemplateColumns:cols, border:`1px solid ${T.border}`, borderRadius:10, overflow:'hidden'}}>
        <div style={head}>Property</div>
        {sources.map(i => <div key={i} style={{...head, justifyContent:'center'}}>{MERGE_RULE_SOURCES[i]}</div>)}
        <div style={head}>Final Value</div>
        {rows.map(row => (
          <React.Fragment key={row.key}>
            <div style={{...cell, fontSize:13, color:T.attioText}}><span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={row.label}>{row.label}</span></div>
            {sources.map(i => { const on = pickOf(row) === i; return (
              <div key={i} style={{...cell, justifyContent:'center'}}>
                <button role="radio" aria-checked={on} aria-label={`${row.label}: ${MERGE_RULE_SOURCES[i]}`} onClick={()=>pick(row, i)}
                  style={{width:28, height:28, borderRadius:8, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', border:`1px solid ${on ? T.blue : T.border}`, background: on ? T.blueLight : '#fff'}}>
                  <span style={{width:14, height:14, borderRadius:9999, boxSizing:'border-box', border: on ? `4px solid ${T.blue}` : `1.5px solid ${T.borderStrong}`, background:'#fff'}}/>
                </button>
              </div>
            ); })}
            <div style={{...cell, fontSize:13, fontWeight:500, color:T.attioText}}>{MERGE_RULE_SOURCES[pickOf(row)]}</div>
          </React.Fragment>
        ))}
      </div>
    </CreatePanelFrame>
  );
}

/* ── Split ── the latest merge into a record that hasn't been split (App's `mergeHistory`): {id,
   object, keptId, records (each as it was, the first one first), values, ownLinks, held,
   activityIds, owned, profiles, logId}. */
const mergeSplitEntry = (hub, object, id) => !hub || !hub.merge || id == null ? null
  : [...(hub.merge.history || [])].reverse().find(h => !h.split && h.object === object && sameId(h.keptId, id)) || null;
// The activity a split hands out: what people add. The record's own history (owner and stage changes, workflow runs…) stays on the first record.
const SPLIT_ACTIVITY_TYPES = ['email', 'call', 'meeting', 'task', 'note', 'file'];
/* What's new on the merged record since the merge — each one goes to the record chosen for it:
   [{key, type, label}]. Keys: prop:<property> (a value changed; a stage with its pipeline),
   link:<record type>:<id> (a record linked since), activity:<id>, quote:<id>, document:<id>,
   plan:<id>, submission:<id>. `view`: the hub ({data, records, activities, quotes, documents,
   accounting, forms}). Null when the merged record is gone. */
function mergeSplitItems(view, entry){
  const object = entry.object, keptId = entry.keptId;
  const cur = (view.records[object] || []).find(r => sameId(r.id, keptId));
  if(!cur) return null;
  const items = [], after = {...entry.records[0], ...(entry.values || {}), ...(entry.ownLinks || {})};
  const props = mergeProps(view.data, object);
  const differs = (p) => !samePropertyValue(cur[p.key], after[p.key]) || (p.key === 'amount' && !samePropertyValue(cur.currency, after.currency));
  props.filter(p => !['pipeline', 'stage'].includes(p.key) && differs(p)).forEach(p => items.push({key:`prop:${p.key}`, type:'Property', label:`${p.label} · ${mergeValueText(view, object, {...p, field:p.key}, cur) || 'Empty'}`}));
  const stage = props.find(p => p.key === 'stage');
  if(stage && (cur.stage !== after.stage || cur.pipeline !== after.pipeline)) items.push({key:'prop:stage', type:'Property', label:`${stage.label} · ${mergeValueText(view, object, {...stage, field:'stage'}, cur) || 'Empty'}`});
  // Records linked since: on the merged record's own lists, or holding it on theirs.
  RECORD_OBJECTS.filter(o => o !== object && linkStoreOf(object, o)).forEach(o => {
    const st = linkStoreOf(object, o), type = typeSingular(o, 'Record'), list = view.records[o] || [];
    if(st.holder === object){
      const before = entry.records.flatMap(r => r[st.field] || []);
      (cur[st.field] || []).filter(id => !before.some(x => sameId(x, id))).forEach(id => items.push({key:`link:${o}:${id}`, type, label:(list.find(r => sameId(r.id, id)) || {}).name || `Unnamed ${type}`}));
    } else {
      const held = (entry.held || []).filter(h => h.object === o);
      list.filter(r => (r[st.field] || []).some(id => sameId(id, keptId)) && !held.some(h => sameId(h.id, r.id))).forEach(r => items.push({key:`link:${o}:${r.id}`, type, label:r.name || `Unnamed ${type}`}));
    }
  });
  const known = (lists) => new Set(Object.values(lists || {}).flat().map(String));
  const acts = known(entry.activityIds);
  (((view.activities || {})[object] || {})[keptId] || []).filter(a => SPLIT_ACTIVITY_TYPES.includes(a.type) && !acts.has(String(a.id)))
    .forEach(a => items.push({key:`activity:${a.id}`, type:(ACTIVITY_TYPES[a.type] || {}).label || 'Activity', label:activityHeadline(a) || a.title || ''}));
  const mine = (x) => x && x.object === object && sameId(x.recordId, keptId);
  const fresh = (list, owned, type, label) => { const had = known(owned); (list || []).filter(x => mine(x) && !had.has(String(x.id))).forEach(x => items.push({key:`${type[0]}:${x.id}`, type:type[1], label:label(x)})); };
  const owned = entry.owned || {};
  fresh(view.quotes, owned.quotes, ['quote', 'Quote'], (q) => [q.number, q.title].filter(Boolean).join(' · '));
  fresh(view.documents, owned.documents, ['document', 'Document'], (d) => [d.number, d.title].filter(Boolean).join(' · '));
  fresh(view.accounting, owned.accounting, ['plan', 'Payment Plan'], (s) => s.number || 'Payment Plan');
  (view.forms || []).forEach(f => fresh(f.submissions, owned.submissions, ['submission', 'Form Submission'], () => f.name));
  return items;
}
/* Split, on a merged record's ⋯ menu: the records that come back (each with its place), then what's
   new since the merge — each with the record it goes to (the first to start with; Assign All sets
   every one). */
function SplitRecordPanel({object, entry, onClose}){
  const hub = useRecordHub();
  const items = mergeSplitItems(hub, entry) || [];
  const [assign, setAssign] = React.useState({});
  const noun = typeSingular(object, 'Record'), plural = typePlural(object, 'Records');
  const options = entry.records.map((r, i) => ({value:String(r.id), label:`${mergeOrdinal(i)} · ${r.name || `Unnamed ${noun}`}`}));
  const first = String(entry.keptId), toOf = (it) => assign[it.key] || first;
  const split = () => { hub.merge.splitRecords(entry.id, Object.fromEntries(items.map(it => [it.key, toOf(it)]))); hub.toast(`${plural} split · ${entry.records.length} ${plural.toLowerCase()}`); onClose(); };
  const cell = {padding:'10px 12px', borderBottom:`1px solid ${T.border}`, minWidth:0, display:'flex', alignItems:'center'};
  const head = {...cell, background:T.headerBg, fontSize:12, fontWeight:600, color:T.attioMuted};
  return (
    <CreatePanelFrame title={`Split ${noun}`} onClose={onClose} placement="fixed" width="min(720px, calc(100vw - 72px))" zIndex={95}
      actions={<><StSecondary label="Cancel" onClick={onClose}/><StCta label={`Split ${plural}`} onClick={split}/></>}>
      <div style={{display:'flex', flexDirection:'column', gap:16}}>
        <div style={{display:'flex', flexDirection:'column', border:`1px solid ${T.border}`, borderRadius:10}}>
          {entry.records.map((r, i) => (
            <div key={r.id} style={{display:'flex', alignItems:'center', gap:8, padding:'10px 12px', borderTop: i ? `1px solid ${T.border}` : 'none'}}>
              <span style={{flex:1, minWidth:0, fontSize:13, fontWeight:500, color:T.attioText, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{r.name || `Unnamed ${noun}`}</span>
              {mergeChip(mergeOrdinal(i))}
            </div>
          ))}
        </div>
        {items.length > 0 && (
          <div style={{display:'grid', gridTemplateColumns:'minmax(0, 1fr) 240px', border:`1px solid ${T.border}`, borderRadius:10}}>
            <div style={{...head, borderTopLeftRadius:10}}>New Since Merge</div>
            <div style={{...head, borderTopRightRadius:10, padding:'6px 12px'}}>
              <div style={{flex:1, minWidth:0}}><FormSelect value="" placeholder="Assign All" options={options} ariaLabel="Assign all" onChange={(v)=>v && setAssign(Object.fromEntries(items.map(it => [it.key, v])))}/></div>
            </div>
            {items.map((it, i) => { const last = i === items.length - 1 ? {borderBottom:'none'} : null; return (
              <React.Fragment key={it.key}>
                <div style={{...cell, ...last, gap:8}}>
                  {mergeChip(it.type)}
                  <span style={{flex:1, minWidth:0, fontSize:13, color:T.attioText, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={it.label}>{it.label}</span>
                </div>
                <div style={{...cell, ...last, padding:'6px 12px'}}>
                  <div style={{flex:1, minWidth:0}}><FormSelect value={toOf(it)} options={options} ariaLabel={`Assign ${it.label}`} onChange={(v)=>v && setAssign(a => ({...a, [it.key]:v}))}/></div>
                </div>
              </React.Fragment>
            ); })}
          </div>
        )}
      </div>
    </CreatePanelFrame>
  );
}

Object.assign(window, {mergeIndexOf, mergeStatusIn, mergeRecordValue, mergeCasesFor, mergeRows, mergeProps, mergeValueText, mergeByRules, mergeOrdinal, MergeCasesButton, MergeReviewPanel,
  MergeRecordConfig, mergeSplitEntry, mergeSplitItems, SPLIT_ACTIVITY_TYPES, SplitRecordPanel});
