/* HOF Pulse ERP — a record's Layout Settings (Contacts, Deals, Customers).

   Layout Settings sits in a record's full-page top bar, beside Back to side panel. Tab Settings: the
   workspace tabs' order and which show (drag, untick); Overview is always first and always shown.
   Highlight Settings: exactly
   four properties pinned to Highlights, picked from a grouped, searchable pool — Record Properties
   (the record type's own), Customer Profile Properties (every profile template's fields, by
   template) and Accounting Properties (system-generated, read-only). (Snapshots were removed: the
   Overview shows the record's activity under the Highlights.)
   Settings are per record type and apply to every record of that type (hub.overviewSettings).
   Highlights collapse and expand from a chevron beside their title (2026-11-18; per browser).

   Values: record properties as the side panel shows them, editable in place where the side panel
   allows it (panelEditSpec). Cards show only the property's name (no template); profile answers from the person's Customer Profile (a deal's or
   customer's is its contact's), editable in place; accounting read from the record's own payment
   terms. */

const HIGHLIGHT_COUNT = 4;

// Customer Profile and Accounting Properties: the shared definitions (extendedProps.jsx).

/* Pinned ids: 'rec:<property key>', 'pf:<template id>:<field id>', 'acc:<accounting key>'. */
const OVERVIEW_DEFAULT_PINNED = {
  contacts:  ['rec:lastActivity', 'pf:pf-canada-crs:crs-score', 'rec:jobTitle', 'pf:pf-customer-strength:cs-willing'],
  deals:     ['rec:closeDate', 'rec:amount', 'pf:pf-canada-crs:crs-score', 'acc:nextInstallmentDueDate'],
  customers: ['rec:stage', 'rec:status', 'acc:nextInstallmentDueDate', 'acc:outstanding'],
};
// Pins saved before the one Accounting list: Next Installment is Next Installment Due Date.
const HIGHLIGHT_RENAMED = {'acc:nextInstallment':'acc:nextInstallmentDueDate'};
// A record type's Overview settings: saved pins, else the defaults — those the workspace has
// (HOF Partners has no Canada CRS form and no Customer Status).
function overviewSettingsOf(hub, object){
  const saved = ((hub && hub.overviewSettings) || {})[object] || {};
  const tabs = saved.tabs || null;
  const smartSummary = saved.smartSummary !== false;   // Smart Summary on the Overview: on unless switched off (2026-11-23)
  if(saved.pinned) return {pinned:saved.pinned.map(id => HIGHLIGHT_RENAMED[id] || id), tabs, smartSummary};
  const have = new Set(highlightPool(hub, null, object).flatMap(c => c.groups.flatMap(g => g.items.map(it => it.id))));
  return {pinned:(OVERVIEW_DEFAULT_PINNED[object] || []).filter(id => have.has(id)), tabs, smartSummary};
}

/* A record type's workspace tabs (contactDetail.jsx CONTACT_TABS, dealDetail.jsx DEAL_TABS,
   customers.jsx CUSTOMER_TABS — each in its default order), only those of record types this CRM has. */
function recordWorkspaceTabs(object){
  if(object === 'deals') return DEAL_TABS.filter(t => workspaceHasType('contacts') || t.id !== 'contacts');
  if(object === 'customers') return CUSTOMER_TABS.filter(t => workspaceHasType(t.id === 'contacts' ? 'contacts' : t.id === 'deals' ? 'deals' : 'customers'))
    .map(t => t.id === 'deals' ? {...t, label:typePlural('deals', 'Deals')} : t);
  return CONTACT_TABS;
}
/* Tab Settings: the saved order and which tabs show ([{id, enabled}]), applied to `tabs`.
   Overview is always first and always shown; a tab the setting doesn't name yet keeps its
   default place after the named ones. */
function arrangeRecordTabs(tabs, saved){
  const overview = tabs.filter(t => t.id === 'overview'), rest = tabs.filter(t => t.id !== 'overview');
  if(!saved || !saved.length) return [...overview, ...rest];
  const at = (id) => { const i = saved.findIndex(s => s.id === id); return i < 0 ? saved.length : i; };
  const off = new Set(saved.filter(s => s.enabled === false).map(s => s.id));
  return [...overview, ...rest.map((t, i) => ({t, i})).sort((x, y) => at(x.t.id) - at(y.t.id) || x.i - y.i).map(x => x.t).filter(t => !off.has(t.id))];
}
/* The default tab order of 2026-11-18: Overview, Calls, Notes, Emails, Tasks, Meetings,
   Customer Profile, Accounting, then the rest. Tab Settings saved before it take that order once
   (`tabOrderV2`), each tab still shown or hidden as it was. */
const TAB_ORDER_V2 = ['calls', 'notes', 'email', 'tasks', 'meetings', 'profile', 'accounting', 'quotes', 'files', 'documents'];
const withTabOrderV2 = (all) => { if(!all || typeof all !== 'object' || all.tabOrderV2) return all;
  const rank = (id) => { const i = TAB_ORDER_V2.indexOf(id); return i < 0 ? TAB_ORDER_V2.length : i; };
  const next = {...all, tabOrderV2:true};
  Object.keys(all).forEach(k => { const o = all[k]; if(o && Array.isArray(o.tabs)) next[k] = {...o, tabs:o.tabs.map((t, i) => ({t, i})).sort((a, b) => rank(a.t.id) - rank(b.t.id) || a.i - b.i).map(x => x.t)}; });
  return next; };
// The Tab Settings list: every tab but Overview, in its arranged order, with whether it shows.
const tabSettingsList = (tabs, saved) => {
  const shown = new Set(arrangeRecordTabs(tabs, saved).map(t => t.id));
  const order = arrangeRecordTabs(tabs, (saved || []).map(s => ({...s, enabled:true})));
  return order.filter(t => t.id !== 'overview').map(t => ({id:t.id, enabled:shown.has(t.id)}));
};

// The pool, grouped: [{id, label, groups:[{label?, items:[{id, label}]}]}].
function highlightPool(hub, forms, object){
  const props = hub && hub.data ? objectProperties(hub.data, object).filter(p => p.key !== 'name') : [];
  return [
    {id:'record', label:'Record Properties', groups:[{items:props.map(p => ({id:`rec:${p.key}`, label:p.label}))}]},
    ...extendedPropertyGroups().map(c => ({...c, groups:c.groups.map(g => ({label:g.label, items:g.items.map(it => ({id:it.key, label:it.label}))}))})),
  ];
}
const poolItem = (pool, id) => { for(const c of pool) for(const g of c.groups){ const it = g.items.find(x => x.id === id); if(it) return {...it, group:g.label}; } return null; };

// A record property as its side panel shows it.
function recordHighlightText(object, key, {record, view, acts, contact, hub}){
  const prop = objectProperties(hub.data, object).find(p => p.key === key);
  const nameOf = (list) => list.map(x => x.name).filter(Boolean).join(', ');
  if(key === 'ownerAssigned' || key === 'ownerChanged' || key === 'ownerAssignedBy'){
    const o = object === 'contacts' ? ownerDates(record, acts) : ownerDates({owner:view.owner, created:dateOnly(record.created), ownerSetBy:record.ownerSetBy}, acts);
    return key === 'ownerAssigned' ? o.assigned : key === 'ownerAssignedBy' ? o.assignedBy : o.changed;
  }
  if(object !== 'contacts'){
    if(key === 'owner') return view.owner || '';
    if(key === 'pipeline') return view.pipeline || '';
    if(key === 'stage') return view.stage || '';
    if(key === 'amount') return view.amountText || '';
    if(key === 'lastActivity') return latestActivityDate(acts);
    if(key === 'nextActivity') return nextActivityDate(acts);
    // Every contact it has (the first is `contact`, its person).
    if(key === 'contact') return nameOf(contactIdsOf(record).map(id => ((hub.records || {}).contacts || []).find(c => sameId(c.id, id))).filter(Boolean)) || (contact ? contact.name : '');
  }
  const records = (hub.records || {});
  if(key === 'deals') return nameOf(object === 'customers' ? (record.dealIds || []).map(id => (records.deals || []).find(d => d.id === id)).filter(Boolean)
    : (records.deals || []).filter(d => contactIdsOf(d).some(id => sameId(id, record.id))));
  if(key === 'customers') return nameOf((records.customers || []).filter(c => object === 'deals' ? (c.dealIds || []).includes(record.id) : contactIdsOf(c).some(id => sameId(id, record.id))));
  const v = record[key];
  if(v == null || v === '') return '';
  if(prop && propertyTypeId(prop.type) === 'Timestamp') return dateOnly(v);
  return prop ? String(formatPropertyValueOf(prop, v) || '') : String(formatValue(v));
}

const kpiText = (text) => text ? <div style={{...kpiValue, color:T.attioText}}>{text}</div> : notSet();
const KPI_EDIT_STYLE = {fontSize:17, fontWeight:500, lineHeight:1.25};

/* One pinned property as a Highlights card: its label, its value — edited in place (edit icon)
   wherever the side panel or the Customer Profile allows it. */
function HighlightCard({id, item, object, ctx}){
  const hub = useRecordHub();
  const store = useProfileForms();
  const label = item ? item.label : 'Property removed';
  if(!item) return <KpiCard label={label} value={notSet()}/>;
  const [kind, a, b] = id.split(':');
  if(kind === 'acc') return <KpiCard label={label} value={kpiText(extendedValueText(id, ctx.record))}/>;
  if(kind === 'pf'){
    const form = (store.forms || []).find(f => f.id === a), field = form && (form.fields || []).find(f => f.id === b);
    const cid = profileHolderId(object, ctx.record);
    if(!field) return <KpiCard label={label} value={notSet()}/>;
    const v = cid != null ? ((((store.data || {})[cid] || {})[a] || {}).values || {})[b] : undefined;
    if(cid == null) return <KpiCard label={label} value={notSet()}/>;
    const p = pfProp(field);
    // Edited in place where the property may be edited (Customer Profile Properties).
    if(!profilePropCan(a, b)) return <KpiCard label={label} value={kpiText(pfBlank(v) ? '' : pfFormat(field, v))}/>;
    return <KpiCard label={label} value={
      <OwnerEditableValue prop={p} value={pfBlank(v) ? '' : storePropertyValueOf(p, v)} display={pfBlank(v) ? '' : pfFormat(field, v)} pencil="always" valueStyle={KPI_EDIT_STYLE}
        onSave={(stored)=>{ const nv = pfBlank(stored) ? '' : loadPropertyValueOf(p, stored);
          store.saveField(cid, form.id, field.id, formFieldType(field.type) === 'Number' && !pfBlank(nv) ? Number(nv) : nv); }}/>}/>;
  }
  const text = recordHighlightText(object, a, {...ctx, hub});
  const spec = panelEditSpec(hub, object, ctx.record, a);
  return <KpiCard label={label} value={spec
    ? <OwnerEditableValue prop={spec.prop} value={spec.value} options={spec.options} display={text} pencil="always" valueStyle={KPI_EDIT_STYLE} onSave={spec.save}/>
    : kpiText(text)}/>;
}

/* Highlights on a record's Overview: the record type's four pinned properties. The chevron beside
   the title collapses and expands them (2026-11-18) — kept per browser, for every record. */
const HIGHLIGHTS_OPEN_KEY = 'hof-erp-highlights-open';
function RecordHighlights({object, record, view, acts, contact}){
  const hub = useRecordHub();
  const store = useProfileForms();
  const settings = overviewSettingsOf(hub, object);
  const pool = highlightPool(hub, store.forms, object);
  const ctx = {record, view: view || record, acts: acts || [], contact};
  const [open, setOpen] = React.useState(() => { try { return localStorage.getItem(HIGHLIGHTS_OPEN_KEY) !== '0'; } catch(e){ return true; } });
  const toggle = () => setOpen(o => { try { localStorage.setItem(HIGHLIGHTS_OPEN_KEY, o ? '0' : '1'); } catch(e){} return !o; });
  return (
    <section>
      <div style={{marginBottom: open ? 0 : -10}}>
        <SectionHeader title="Highlights" inline={
          <button onClick={toggle} aria-expanded={open} aria-label={open ? 'Collapse Highlights' : 'Expand Highlights'} title={open ? 'Collapse' : 'Expand'}
            style={{border:'none', background:'transparent', cursor:'pointer', padding:2, display:'flex', borderRadius:4}}>
            <Icon name="chevDown" size={T.chevronSize} color={T.attioMuted} style={{transform: open ? 'none' : 'rotate(-90deg)', transition:'transform 150ms ease'}}/>
          </button>}/>
      </div>
      {open && <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(min(180px, 100%), 1fr))', gap:12}}>
        {settings.pinned.map(id => <HighlightCard key={id} id={id} item={poolItem(pool, id)} object={object} ctx={ctx}/>)}
      </div>}
    </section>
  );
}

/* ── Smart Summary on a record's Overview (2026-11-23) ── it was a side panel section; now it's
   here, under Highlights, switched off in Layout Settings → Smart Summary (per record type). In
   the product it is written entirely by AI; here a stand-in reads the record and its activity
   (`smartSummaryOf`), so the design can be judged. The title, then "Refreshed 2 minutes ago" and
   a refresh icon button; the summary in a sentence or two, always shown; under it Insights — the
   Insight Type / Insight Detail / Source table — an accordion, closed to start with (kept per browser). */
const SUMMARY_OPEN_KEY = 'hof-erp-summary-open';
/* Insights (2026-11-23, Mohsin): what is known about the person but is no property of the CRM —
   said in a note, an email or on a call, unstructured — given a structure by AI: an Insight Type
   and an Insight Detail, each with the activity it comes from. So nothing here repeats a record
   property, and every detail opens its activity. The stand-in below reads the notes, received
   emails and call notes and types each by its words; the product's AI does this properly. */
const INSIGHT_TYPES = [
  ['Objection',  /\b(concern|worried|confus|unsure|not sure|doubt|hesitat|too long|too expensive|delay|refus|not interested)\w*/i],
  ['Budget',     /\b(budget|fees?|price|cost|afford|instal?lments?|payment plan|discount|funds)\b/i],
  ['Timeline',   /\b(deadline|next (week|month|year)|by the end|intake|urgent|asap|timeline|before (january|february|march|april|may|june|july|august|september|october|november|december))\b/i],
  ['Target',     /\b(canada|australia|uk|usa|germany|express entry|study-to-pr|visa|route|program|province|nomination)\b/i],
  ['Profession', /\b(job|works?|working|experience|employer|profession|occupation|business|salary)\b/i],
  ['Education',  /\b(degree|bachelor|master|ielts|pte|education|university|study|studies|transcripts?)\b/i],
  ['Family',     /\b(spouse|wife|husband|child|children|kids|family|parents|dependents?)\b/i],
  ['Preference', /\b(prefers?|whatsapp|call (after|before)|best time|language|email only)\b/i],
];
const INSIGHT_ORDER = ['Needs attention', 'Last promise', ...INSIGHT_TYPES.map(t => t[0]), 'Asked about', 'Discussed', 'Context'];
const insightType = (text, fallback) => (INSIGHT_TYPES.find(([, re]) => re.test(text)) || [fallback])[0];
const firstSentence = (text) => { const t = String(text || '').replace(/\s+/g, ' ').trim(), cut = t.search(/[.!?](\s|$)/);
  const one = cut > 20 ? t.slice(0, cut + 1) : t; return one.length > 150 ? `${one.slice(0, 150)}…` : one; };
function smartSummaryOf(hub, object, record, view, acts){
  const list = acts || [], when = (a) => new Date(a.at).getTime() || 0, day = (d) => fmtActDate(d), newest = (l) => [...l].sort((x, y) => when(y) - when(x));
  const rows = [], seen = new Set();
  const add = (type, detail, a, label) => { if(!detail || !a || seen.has(a.id)) return; seen.add(a.id); rows.push({type, detail, actId:a.id, source:`${label} · ${day(a.at)}`}); };
  const open = list.filter(a => a.type === 'task' && isTaskOpen(a));
  open.filter(isOverdue).slice(0, 2).forEach(t => add('Needs attention', `Overdue: ${t.title || 'Task'}`, t, 'Task'));
  const emails = newest(list.filter(a => a.type === 'email' && a.status !== 'scheduled')), lastEmail = emails[0];
  if(lastEmail && lastEmail.direction === 'received') add('Needs attention', `Waiting for a reply: ${lastEmail.title || lastEmail.subject || 'Email'}`, lastEmail, 'Email');
  const lastQuote = newest(list.filter(a => a.type === 'quote'))[0];
  if(lastQuote && lastQuote.status === 'viewed') add('Needs attention', 'Viewed the quote, not signed yet', lastQuote, 'Quote');
  const next = [...open.filter(t => !isOverdue(t))].sort((x, y) => (x.due ? new Date(x.due).getTime() : Infinity) - (y.due ? new Date(y.due).getTime() : Infinity))[0];
  if(next) add('Last promise', `${next.title || 'Task'}${next.due ? ` · due ${day(next.due)}` : ''}`, next, 'Task');
  // What was said: notes, the emails they sent, the notes of calls.
  newest(list.filter(a => a.type === 'note')).slice(0, 4).forEach(a => { const t = richTextPlain(a.body || ''); add(insightType(t, 'Context'), firstSentence(t), a, 'Note'); });
  emails.filter(a => a.direction === 'received').slice(0, 3).forEach(a => { const subject = String(a.title || a.subject || '').replace(/^(re|fw|fwd):\s*/i, ''), t = `${subject} ${richTextPlain(a.body || '')}`;
    add(insightType(t, 'Asked about'), subject || firstSentence(richTextPlain(a.body || '')), a, 'Email'); });
  newest(list.filter(a => a.type === 'call' && richTextPlain(a.notes || '').trim())).slice(0, 2).forEach(a => { const t = richTextPlain(a.notes || ''); add(insightType(t, 'Discussed'), firstSentence(t), a, 'Call'); });
  const rank = (r) => { const i = INSIGHT_ORDER.indexOf(r.type); return i < 0 ? INSIGHT_ORDER.length : i; };
  const sorted = rows.map((r, i) => ({r, i})).sort((x, y) => rank(x.r) - rank(y.r) || x.i - y.i).map(x => x.r).slice(0, 10);
  // It opens with where the record stands: a lead's Type of Lead (the summary's own start); a deal's or customer's stage and pipeline.
  const stage = object !== 'contacts' && record.stage ? stageLabelIn(hub.data, record.pipeline, record.stage) : '';
  return {sentence:buildActivitySummary(view || record, list, stage ? `${stage}${record.pipeline ? ` in ${pipelineLabelIn(hub.data, record.pipeline)}` : ''}.` : undefined), rows:sorted};
}
// An insight's detail opens the activity it comes from, in the Overview's own side panel (activityCards.jsx ActivityTab listens).
const openActivityFromInsight = (actId) => window.dispatchEvent(new CustomEvent('hof-open-activity', {detail:{id:actId}}));
const agoText = (ms) => { const s = Math.max(1, Math.round(ms / 1000)), n = s < 60 ? [s, 'second'] : s < 3600 ? [Math.round(s / 60), 'minute'] : s < 86400 ? [Math.round(s / 3600), 'hour'] : [Math.round(s / 86400), 'day'];
  return `${n[0]} ${n[1]}${n[0] === 1 ? '' : 's'} ago`; };
const SUMMARY_COLS = '170px minmax(0, 1fr) 150px';
function RecordSmartSummary({object, record, view, acts}){
  const hub = useRecordHub();
  const on = overviewSettingsOf(hub, object).smartSummary;
  const [at, setAt] = React.useState(() => Date.now()), [, tick] = React.useState(0);
  const [open, setOpen] = React.useState(() => { try { return localStorage.getItem(SUMMARY_OPEN_KEY) === '1'; } catch(e){ return false; } });
  React.useEffect(() => { const t = setInterval(() => tick(n => n + 1), 10000); return () => clearInterval(t); }, []);
  // The summary as it was when last refreshed.
  const summary = React.useMemo(() => on ? smartSummaryOf(hub, object, record, view, acts) : null, [on, at, record && record.id]);
  if(!on || !summary) return null;
  const toggle = () => setOpen(o => { try { localStorage.setItem(SUMMARY_OPEN_KEY, o ? '0' : '1'); } catch(e){} return !o; });
  const cell = {padding:'9px 0', fontSize:13, lineHeight:1.45, minWidth:0};
  return (
    /* A Spring feature (2026-11-23): Spring's mark before the title; a white card (Mohsin, the same day: no orange ground here). */
    <section style={{marginTop:20, padding:'14px 16px 16px', borderRadius:12, background:'#fff', border:`1px solid ${T.border}`}}>
      <SectionHeader title={<span style={{display:'inline-flex', alignItems:'center', gap:8}}><SpringMark w={20}/>Smart Summary</span>} right={<span style={{display:'flex', alignItems:'center', gap:8}}>
        <span style={{fontSize:12.5, color:T.attioMuted}}>Refreshed {agoText(Date.now() - at)}</span>
        <button onClick={()=>setAt(Date.now())} title="Refresh" aria-label="Refresh" style={{...iconBtn, width:26, height:26, background:'#fff'}}><Icon name="refresh" size={13} color={T.gray600}/></button>
      </span>}/>
      <div style={{fontSize:14, lineHeight:1.55, color:T.attioText}}>{summary.sentence}</div>
      {summary.rows.length > 0 && <>
        <button onClick={toggle} aria-expanded={open} style={{display:'flex', alignItems:'center', gap:6, marginTop:12, padding:0, border:'none', background:'transparent', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:500, color:T.attioText}}>
          Insights<Icon name="chevDown" size={T.chevronSize} color={T.attioMuted} style={{transform: open ? 'none' : 'rotate(-90deg)', transition:'transform 150ms ease'}}/>
        </button>
        {open && <div role="table" aria-label="Insights" style={{marginTop:6, maxHeight:280, overflowY:'auto'}}>
          <div role="row" style={{display:'grid', gridTemplateColumns:SUMMARY_COLS, columnGap:16, borderBottom:`1px solid ${T.attioLine}`}}>
            {['Insight Type', 'Insight Detail', 'Source'].map(h => <div key={h} role="columnheader" style={{...cell, padding:'6px 0', fontSize:12.5, color:T.attioMuted}}>{h}</div>)}
          </div>
          {summary.rows.map((r, i) => (
            <div key={i} role="row" style={{display:'grid', gridTemplateColumns:SUMMARY_COLS, columnGap:16, borderBottom: i === summary.rows.length - 1 ? 'none' : `1px solid ${T.attioLine}`}}>
              <div role="cell" style={{...cell, color:T.attioMuted}}>{i && summary.rows[i - 1].type === r.type ? '' : r.type}</div>
              <div role="cell" style={cell}><button className={LINK_CLASS} onClick={()=>openActivityFromInsight(r.actId)}
                style={{border:'none', background:'transparent', padding:0, font:'inherit', color:T.attioText, cursor:'pointer', textAlign:'left'}}>{r.detail}</button></div>
              <div role="cell" style={{...cell, color:T.attioMuted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{r.source}</div>
            </div>
          ))}
        </div>}
      </>}
    </section>
  );
}

/* A record's full page, top bar (beside Back to side panel): Layout Settings — Highlight Settings
   and Tab Settings, per record type. */
function RecordViewSettings({object}){
  const hub = useRecordHub();
  const store = useProfileForms();
  const [open, setOpen] = React.useState(false);
  return <>
    <ViewSettingsButton onClick={()=>setOpen(true)}/>
    {open && <OverviewSettingsModal object={object} pool={highlightPool(hub, store.forms, object)} settings={overviewSettingsOf(hub, object)}
      tabs={recordWorkspaceTabs(object)} onClose={()=>setOpen(false)}
      onApply={(next)=>{ hub.setOverviewSettings(s => ({...(s || {}), [object]:next})); setOpen(false); }}/>}
  </>;
}

const OVERVIEW_SETTINGS_SECTIONS = {highlights:'Highlight Settings', summary:'Smart Summary', tabs:'Tab Settings'};
const poolGroupLabel = {fontSize:11, fontWeight:600, letterSpacing:.4, color:T.gray400, textTransform:'uppercase', padding:'14px 6px 4px'};

function OverviewSettingsModal({object, pool, settings, tabs = [], onApply, onClose}){
  const [section, setSection] = React.useState('highlights');
  // Tab Settings: every tab but Overview (always first, always shown) — drag to reorder, untick to hide.
  const tabList = (d) => tabSettingsList(tabs, d.tabs);
  const tabLabel = (id) => (tabs.find(t => t.id === id) || {}).label || id;
  const [query, setQuery] = React.useState('');
  const [draft, setDraft] = React.useState(() => JSON.parse(JSON.stringify(settings)));
  const q = query.trim().toLowerCase();
  const pinned = draft.pinned;
  const full = pinned.length >= HIGHLIGHT_COUNT;
  const toggle = (id) => setDraft(d => ({...d, pinned: d.pinned.includes(id) ? d.pinned.filter(x => x !== id) : d.pinned.length >= HIGHLIGHT_COUNT ? d.pinned : [...d.pinned, id]}));
  const labelOf = (id) => { const it = poolItem(pool, id); return it ? (it.group ? `${it.label} · ${it.group}` : it.label) : 'Property removed'; };
  const ready = pinned.length === HIGHLIGHT_COUNT;
  const matches = (it, g, c) => !q || [it.label, g.label, c.label].some(s => s && s.toLowerCase().includes(q));
  // Record Properties listed as before; Customer Profile and Accounting Properties as accordions (ExtendedPropertyGroups).
  const shown = pool.filter(c => c.id === 'record').map(c => ({...c, groups:c.groups.map(g => ({...g, items:g.items.filter(it => matches(it, g, c))})).filter(g => g.items.length)})).filter(c => c.groups.length);
  const extMatches = !q || extendedItems().some(it => [it.label, it.group].some(s => s && s.toLowerCase().includes(q)));
  const pinRow = (it) => { const on = pinned.includes(it.key), off = !on && full;
    return <div key={it.key} title={off ? `Unpin one to pin another (${HIGHLIGHT_COUNT} max)` : undefined} style={{opacity: off ? .45 : 1}}>
      <SettingsCheckRow label={it.label} checked={on} onToggle={()=>!off && toggle(it.key)}/></div>; };

  return (
    <SettingsModalShell title="Layout Settings" sections={OVERVIEW_SETTINGS_SECTIONS} order={[]} onReorder={()=>{}} fixed={['highlights', 'summary', 'tabs']}
      section={section} onSection={(id)=>{ setSection(id); setQuery(''); }} onClose={onClose}
      onApply={()=>ready && onApply(draft)} applyDisabled={!ready}
      footerNote={section === 'highlights' || !ready ? `${pinned.length} of ${HIGHLIGHT_COUNT} pinned${ready ? '' : ` · pin exactly ${HIGHLIGHT_COUNT} to apply`}` : null}
      toolbar={section === 'highlights' && (
        <div style={{padding:'0 20px 8px'}}>
          <div style={{position:'relative'}}>
            <div style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', display:'flex'}}>
              <Icon name="search" size={13} color={T.gray400}/>
            </div>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search properties"
              style={{width:'100%', padding:'8px 10px 8px 30px', fontSize:13, fontFamily:'inherit', border:`1px solid ${T.borderStrong}`, borderRadius:8}}/>
          </div>
        </div>
      )}>

      {section === 'highlights' && (<>
        {/* Pinned, in Highlights order: drag to reorder; unticking unpins. */}
        {!q && <>
          <div style={{...poolGroupLabel, paddingTop:4}}>Pinned to Highlights ({pinned.length}/{HIGHLIGHT_COUNT})</div>
          <DragCheckList items={pinned.map(id => ({id, enabled:true}))} labelOf={it => labelOf(it.id)}
            onChange={(fn)=>setDraft(d => { const next = fn(d.pinned.map(id => ({id, enabled:true}))); return {...d, pinned:next.filter(x => x.enabled).map(x => x.id)}; })}/>
          {!pinned.length && <div style={{fontSize:12.5, color:T.gray400, padding:'4px 6px'}}>Nothing pinned yet</div>}
        </>}
        {shown.map(c => (
          <div key={c.id}>
            <div style={poolGroupLabel}>{c.label}</div>
            {c.groups.map((g, i) => (
              <div key={g.label || i}>
                {g.label && <div style={{fontSize:12.5, fontWeight:600, color:T.attioText, padding:'8px 6px 2px'}}>{g.label}</div>}
                {g.items.map(it => {
                  const on = pinned.includes(it.id), off = !on && full;
                  return (
                    <div key={it.id} title={off ? `Unpin one to pin another (${HIGHLIGHT_COUNT} max)` : undefined} style={{opacity: off ? .45 : 1}}>
                      <SettingsCheckRow label={it.label} checked={on} onToggle={()=>!off && toggle(it.id)}/>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
        <ExtendedPropertyGroups query={query} renderItem={pinRow}/>
        {!shown.length && !extMatches && <div style={{fontSize:12.5, color:T.gray400, padding:'8px 6px'}}>No properties match "{query}"</div>}
      </>)}

      {section === 'summary' && <SettingsCheckRow label="Show Smart Summary" hint="AI-generated" checked={draft.smartSummary !== false}
        onToggle={()=>setDraft(d => ({...d, smartSummary:d.smartSummary === false}))}/>}

      {section === 'tabs' && (<>
        <div style={{opacity:.55, paddingLeft:24}}><SettingsCheckRow label={tabLabel('overview')} checked onToggle={()=>{}}/></div>
        <DragCheckList items={tabList(draft)} labelOf={it => tabLabel(it.id)}
          onChange={(fn)=>setDraft(d => ({...d, tabs:fn(tabList(d))}))}/>
      </>)}

    </SettingsModalShell>
  );
}

Object.assign(window, {RecordSmartSummary, smartSummaryOf, withTabOrderV2, RecordHighlights, RecordViewSettings, OverviewSettingsModal, overviewSettingsOf, recordWorkspaceTabs, arrangeRecordTabs, HIGHLIGHT_COUNT});
