/* HOF Pulse ERP — Overview View Settings (Contacts, Deals, Customers).

   The Overview tab's View Settings button (Highlights section) opens Highlight Settings: exactly
   four properties pinned to Highlights, picked from a grouped, searchable pool — Record Properties
   (the record type's own), Customer Profile Properties (every profile template's fields, by
   template) and Accounting Properties (system-generated, read-only). (Snapshots were removed: the
   Overview shows the record's activity under the Highlights.)
   Settings are per record type and apply to every record of that type (hub.overviewSettings).

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
  if(saved.pinned) return {pinned:saved.pinned.map(id => HIGHLIGHT_RENAMED[id] || id)};
  const have = new Set(highlightPool(hub, null, object).flatMap(c => c.groups.flatMap(g => g.items.map(it => it.id))));
  return {pinned:(OVERVIEW_DEFAULT_PINNED[object] || []).filter(id => have.has(id))};
}

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
  if(key === 'ownerAssigned' || key === 'ownerChanged'){
    const o = object === 'contacts' ? ownerDates(record, acts) : ownerDates({owner:view.owner, created:dateOnly(record.created)}, acts);
    return key === 'ownerAssigned' ? o.assigned : o.changed;
  }
  if(object !== 'contacts'){
    if(key === 'owner') return view.owner || '';
    if(key === 'pipeline') return view.pipeline || '';
    if(key === 'stage') return view.stage || '';
    if(key === 'amount') return view.amountText || '';
    if(key === 'lastActivity') return latestActivityDate(acts);
    if(key === 'nextActivity') return nextActivityDate(acts);
    if(key === 'contact') return contact ? contact.name : '';
  }
  const records = (hub.records || {});
  if(key === 'deals') return nameOf(object === 'customers' ? (record.dealIds || []).map(id => (records.deals || []).find(d => d.id === id)).filter(Boolean)
    : (records.deals || []).filter(d => d.contactId === record.id));
  if(key === 'customers') return nameOf((records.customers || []).filter(c => object === 'deals' ? (c.dealIds || []).includes(record.id) : c.contactId === record.id));
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

/* Highlights on a record's Overview: the record type's four pinned properties, and View Settings. */
function RecordHighlights({object, record, view, acts, contact}){
  const hub = useRecordHub();
  const store = useProfileForms();
  const [open, setOpen] = React.useState(false);
  const settings = overviewSettingsOf(hub, object);
  const pool = highlightPool(hub, store.forms, object);
  const ctx = {record, view: view || record, acts: acts || [], contact};
  return (
    <section>
      <SectionHeader title="Highlights" right={<ViewSettingsButton onClick={()=>setOpen(true)}/>}/>
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(min(180px, 100%), 1fr))', gap:12}}>
        {settings.pinned.map(id => <HighlightCard key={id} id={id} item={poolItem(pool, id)} object={object} ctx={ctx}/>)}
      </div>
      {open && <OverviewSettingsModal object={object} pool={pool} settings={settings} onClose={()=>setOpen(false)}
        onApply={(next)=>{ hub.setOverviewSettings(s => ({...(s || {}), [object]:next})); setOpen(false); }}/>}
    </section>
  );
}

const OVERVIEW_SETTINGS_SECTIONS = {highlights:'Highlight Settings'};
const poolGroupLabel = {fontSize:11, fontWeight:600, letterSpacing:.4, color:T.gray400, textTransform:'uppercase', padding:'14px 6px 4px'};

function OverviewSettingsModal({object, pool, settings, onApply, onClose}){
  const [section, setSection] = React.useState('highlights');
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
    <SettingsModalShell title="Highlight Settings" sections={OVERVIEW_SETTINGS_SECTIONS} order={[]} onReorder={()=>{}} fixed={['highlights']}
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

    </SettingsModalShell>
  );
}

Object.assign(window, {RecordHighlights, OverviewSettingsModal, overviewSettingsOf, HIGHLIGHT_COUNT});
