/* HOF Pulse ERP — Board Card Settings.

   Built on the shared SettingsModalShell (settingsKit.jsx). Left: the card's sections — their
   order here IS the order on the card, and they reorder by drag like Table Settings' columns.
   Middle: the selected section's settings. Right: a live preview — the Board's own ContactCard
   rendered with the draft, so it can never drift from the real cards.

   Settings belong to the view, like Table Settings' columns: the draft applies on Apply and is
   kept with Save View. The contact name, the open-record icon and the ⋯ menu are not sections:
   they always sit on top. Nothing else about the card is configurable.

   The modal serves every object's card through a `kind` (Contacts by default): its sections,
   quick-action labels, tags, dropdowns, related-property options, smart features and preview.
   A kind whose `dropdowns` / `properties` settings are ordered lists of {key, enabled} (Deals)
   also reorders its dropdowns and card properties by drag. */

const CARD_SECTIONS = {
  quickActions:      'Quick Actions',
  tags:              'Tags',
  properties:        'Properties',
  relatedProperties: 'Related Properties',
  smartFeatures:     'Smart Features',
  dropdowns:         'Dropdowns',
};

/* Related Properties — context from a related entity or relationship. Each one is a card row
   with a left and a right value. These relationship fields lead the selector; every other
   contact property is offered after them (relatedFieldOptions). */
const RELATED_FIELDS = [
  {key:'owner',         label:'Contact Owner'},
  {key:'ownerAssigned', label:'Owner Assignment Date'},
  {key:'ownerChanged',  label:'Owner Change Date'},
  {key:'company',       label:'Primary Company'},
];

const relatedFieldOptions = (properties) => [
  ...RELATED_FIELDS,
  ...(properties || []).filter(p => !p.extended && !RELATED_FIELDS.some(r => r.key === p.key)),
];

/* Clickable (relationship) properties — values that open another record. They stay available
   wherever properties are configured (Card Settings, Side Panel View Settings); add more here. */
const CLICKABLE_PROPERTIES = {
  owner: {open:(c) => `Contact Owner · ${c.owner}`, show:(c) => !!c.owner},
  deals: {open:(c) => `Associated Deals · ${c.name}`, show:(c) => c.dealCount > 0, value:(c) => String(c.dealCount)},
};

/* Activity dropdowns, in card order. `type` null = every kind of activity. */
const CARD_DROPDOWNS = [
  {key:'all',   setting:'All Activity', label:'View Activity', icon:'archive',  type:null,    link:'View all activity', empty:'No activity yet.'},
  {key:'email', setting:'Emails',       label:'Emails',        icon:'envelope', type:'email', link:'View all emails',   empty:'No emails yet.'},
  {key:'task',  setting:'Tasks',        label:'Tasks',         icon:'tasks',    type:'task',  link:'View all tasks',    empty:'No tasks yet.'},
  {key:'note',  setting:'Notes',        label:'Notes',         icon:'notepad',  type:'note',  link:'View all notes',    empty:'No notes yet.'},
  {key:'call',  setting:'Calls',        label:'Calls',         icon:'call',     type:'call',  link:'View all calls',    empty:'No calls yet.'},
];

/* Defaults: available in Card Settings is not the same as shown. The default card shows Call,
   Email, Task, Note, Last Contacted, the All Activity dropdown and the owner row; tags, smart
   features and the other actions and dropdowns are off until someone switches them on. */
/* The one Card Settings structure for Contacts, Deals and Customers — every list ordered (drag to
   reorder; the card shows them in this order): quick actions, properties and dropdowns as
   [{key, enabled(, count)}]. */
const DEFAULT_CARD_SETTINGS = () => ({
  order:        ['quickActions', 'tags', 'properties', 'smartFeatures', 'dropdowns', 'relatedProperties'],
  quickActions: defaultQuickActions('contacts'),
  tags:         {temperature:false, leadScore:false},
  // Associated Deals shows only when there are deals; the other properties join switched off (normalizeCardSettings).
  properties:   [{key:'lastContacted', enabled:true}],
  relatedProperties: {rows:[{id:'r1', left:'owner', right:'ownerAssigned'}]},
  smartFeatures: {summary:false, actions:false},
  dropdowns: CARD_DROPDOWNS.map(dd => ({key:dd.key, enabled:dd.key === 'all', count:5})),
});
/* Card settings as the one structure, whatever shape they were saved in: Contacts' earlier
   property-key list and dropdown map become ordered lists; quick actions are the Object's
   (normalizeQuickActions); properties and dropdowns added since join the end, switched off. */
function normalizeCardSettings(cs, object, properties, dropdownDefs = CARD_DROPDOWNS){
  if(!cs) return cs;
  const props = properties || [];
  const ordered = Array.isArray(cs.properties) && cs.properties.length && typeof cs.properties[0] === 'object' ? cs.properties
    : props.map(p => ({key:p.key, enabled:(cs.properties || []).includes(p.key)}));
  const propList = [...ordered.filter(x => !props.length || props.some(p => p.key === x.key)),
    ...props.filter(p => !ordered.some(x => x.key === p.key)).map(p => ({key:p.key, enabled:false}))];
  const dd = Array.isArray(cs.dropdowns) ? cs.dropdowns
    : dropdownDefs.map(d => { const v = (cs.dropdowns || {})[d.key] || {}; return {key:d.key, enabled:!!v.enabled, count:v.count || 5}; });
  const ddList = [...dd.filter(x => dropdownDefs.some(d => d.key === x.key)), ...dropdownDefs.filter(d => !dd.some(x => x.key === d.key)).map(d => ({key:d.key, enabled:false, count:5}))];
  return {...cs, quickActions:normalizeQuickActions(cs.quickActions, object), properties:propList, dropdowns:ddList};
}
const CARD_TAGS = [
  {key:'temperature', label:'Contact Temperature', hint:'Hot · Warm · Normal'},
  {key:'leadScore',   label:'Lead Score'},
];

const settingsSelect = {
  appearance:'none', WebkitAppearance:'none', width:'100%', fontSize:13, fontFamily:'inherit', color:T.attioText,
  border:`1px solid ${T.borderStrong}`, borderRadius:8, padding:'7px 28px 7px 10px', background:'#fff', cursor:'pointer',
};

function FieldSelect({value, onChange, options = RELATED_FIELDS}){
  return (
    <div style={{position:'relative', flex:1, minWidth:0}}>
      <select value={value || ''} onChange={e=>onChange(e.target.value || null)} style={{...settingsSelect, color: value ? T.attioText : T.gray400}}>
        <option value="">Select property</option>
        {options.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
      </select>
      <div style={{position:'absolute', right:9, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', display:'flex'}}>
        <Icon name="chevDown" size={12} color={T.gray600}/>
      </div>
    </div>
  );
}

/* Related Properties editor — Add first; each row is a left/right pair that can be dragged to
   reorder or removed (all of them, if wanted). */
function RelatedPropertiesEditor({rows, setRows, options}){
  const drag = useDragReorder((from, to) => setRows(rs => moveItem(rs, from, to)));
  return (
    <div style={{display:'flex', flexDirection:'column', gap:8, padding:'0 6px'}}>
      <button onClick={()=>setRows(rs => [...rs, {id:'r' + Date.now(), left:null, right:null}])}
        style={{alignSelf:'flex-start', display:'flex', alignItems:'center', gap:6, border:'none', background:'transparent',
                padding:'4px 0', cursor:'pointer', fontSize:13, color:T.attioBlue, fontFamily:'inherit'}}>
        <Icon name="plus" size={13} color={T.attioBlue}/> Add Related Property
      </button>
      {rows.map((r, i) => (
        /* One related property = one card row: its left and right values, stacked here so full
           property names fit the settings column. */
        <div key={r.id} {...drag.props(i)} style={{display:'flex', alignItems:'flex-start', gap:6, cursor:'grab',
                                                   outline: drag.over === i ? `2px solid ${T.attioBlue}` : 'none', outlineOffset:2, borderRadius:10}}>
          <span style={{display:'flex', paddingTop:16}}><Icon name="dragHandle" size={14} color={T.gray400}/></span>
          <div style={{flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:6, padding:8,
                       border:`1px solid ${T.border}`, borderRadius:10, background:T.pageBg}}>
            <FieldSelect value={r.left}  options={options} onChange={v=>setRows(rs => rs.map(x => x.id === r.id ? {...x, left:v} : x))}/>
            <FieldSelect value={r.right} options={options} onChange={v=>setRows(rs => rs.map(x => x.id === r.id ? {...x, right:v} : x))}/>
          </div>
          <button title="Remove related property" onClick={()=>setRows(rs => rs.filter(x => x.id !== r.id))}
            style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:4, marginTop:8, flexShrink:0}}>
            <Icon name="trash" size={15} color={T.gray600}/>
          </button>
        </div>
      ))}
      {!rows.length && <div style={{fontSize:12.5, color:T.gray400}}>No related properties.</div>}
    </div>
  );
}

/* Smart Features, the same pair on every card: each is its own switch. */
const CARD_SMART_FEATURES = [
  {key:'summary', label:'Show Smart Summary', hint:'AI-generated'},
  {key:'actions', label:'Show Smart Actions', hint:'What it suggests is defined later'},
];
const CONTACT_CARD_KIND = {object:'contacts', sections:CARD_SECTIONS, quickActionLabels:quickActionLabels('contacts'), tags:CARD_TAGS, dropdowns:CARD_DROPDOWNS,
  relatedOptions:relatedFieldOptions, smartFeatures:CARD_SMART_FEATURES};

function CardSettingsModal({draft:draftRaw, setDraft:setDraftRaw, properties, sample, onApply, onClose, kind = CONTACT_CARD_KIND}){
  // Edited in the one structure (normalizeCardSettings), whatever shape the view saved.
  const object = kind.object || 'contacts';
  const draft = normalizeCardSettings(draftRaw, object, properties, kind.dropdowns);
  const setDraft = (u) => setDraftRaw(d => { const n = normalizeCardSettings(d, object, properties, kind.dropdowns); return typeof u === 'function' ? u(n) : u; });
  const [section, setSection] = React.useState(draft.order[0]);
  const [query, setQuery] = React.useState('');

  // Functional updates, so quick successive changes never overwrite each other.
  const patch = (group, p) => setDraft(d => ({...d, [group]: {...d[group], ...p}}));
  const flip = (group, key) => setDraft(d => ({...d, [group]: {...d[group], [key]: !d[group][key]}}));
  const flipProperty = (key) => setDraft(d => ({...d, properties: d.properties.includes(key)
    ? d.properties.filter(k => k !== key)
    : properties.map(p => p.key).filter(k => k === key || d.properties.includes(k))}));
  const setRows = (fn) => setDraft(d => ({...d, relatedProperties: {...d.relatedProperties, rows: fn(d.relatedProperties.rows)}}));
  const setDropdown = (key, p) => setDraft(d => ({...d, dropdowns: {...d.dropdowns, [key]: {...d.dropdowns[key], ...p}}}));
  const row = (key, label, checked, onToggle, hint, right) =>
    <SettingsCheckRow key={key} label={label} checked={checked} onToggle={onToggle} hint={hint} right={right}/>;

  /* Card properties: the record's own (listed, ordered); the Customer Profile and Accounting
     Properties (extendedProps.jsx) in their groups below — a pinned one joins the ordered list. */
  const shownProps = properties.filter(p => !p.extended && p.label.toLowerCase().includes(query.trim().toLowerCase()));
  const orderedAll = draft.properties.length && typeof draft.properties[0] === 'object'
    ? [...draft.properties.filter(x => properties.some(p => p.key === x.key)),
       ...properties.filter(p => !draft.properties.some(x => x.key === p.key)).map(p => ({key:p.key, enabled:false}))]
    : null;
  const orderedProps = orderedAll && orderedAll.filter(x => !isExtendedKey(x.key) || x.enabled);
  const pinnedExt = (key) => orderedAll ? !!(orderedAll.find(x => x.key === key) || {}).enabled : draft.properties.includes(key);
  const flipExt = (key) => orderedAll ? setDraft(d => ({...d, properties: orderedAll.map(x => x.key === key ? {...x, enabled:!x.enabled} : x)})) : flipProperty(key);
  const propLabel = (key) => { const p = properties.find(x => x.key === key) || {}; return p.extended ? extendedFullLabel(p) : p.label; };
  const rp = draft.relatedProperties;

  return (
    <SettingsModalShell title="Card settings" sections={kind.sections} order={draft.order}
      onReorder={(from, to)=>setDraft(d => ({...d, order: moveItem(d.order, from, to)}))}
      section={section} onSection={(id)=>{ setSection(id); setQuery(''); }}
      onApply={onApply} onClose={onClose}
      toolbar={section === 'properties' && (
        <div style={{padding:'0 20px 8px'}}>
          <div style={{position:'relative'}}>
            <div style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', display:'flex'}}>
              <Icon name="search" size={13} color={T.gray400}/>
            </div>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search properties…"
              style={{width:'100%', padding:'8px 10px 8px 30px', fontSize:13, fontFamily:'inherit',
                      border:`1px solid ${T.borderStrong}`, borderRadius:8}}/>
          </div>
        </div>
      )}
      preview={kind.renderPreview ? kind.renderPreview(draft) : sample && sample.contact && (
        <ContactCard contact={sample.contact} acts={sample.acts || []} settings={draft} properties={properties}
          actions={{}} onStub={()=>{}} onOpen={()=>{}} onDragStart={()=>{}}/>
      )}>
      {section === 'quickActions' && (
        <DragCheckList items={draft.quickActions} labelOf={it => kind.quickActionLabels[it.key]}
          onChange={v=>setDraft(d => ({...d, quickActions: typeof v === 'function' ? v(d.quickActions) : v}))}/>
      )}

      {section === 'tags' && kind.tags.map(t =>
        row(t.key, t.label, !!draft.tags[t.key], ()=>flip('tags', t.key), t.hint))}

      {/* Ordered card properties (Deals): drag to reorder; properties not in the list yet (new
          ones) are offered after it, switched off. While searching, the matches only toggle. */}
      {section === 'properties' && orderedProps && !query.trim() && (
        <DragCheckList items={orderedProps} labelOf={it => propLabel(it.key)}
          onChange={v=>setDraft(d => { const next = typeof v === 'function' ? v(orderedProps) : v;
            return {...d, properties:[...next, ...orderedAll.filter(x => !next.some(y => y.key === x.key))]}; })}/>
      )}
      {section === 'properties' && orderedProps && query.trim() && shownProps.map(p => {
        const it = orderedAll.find(x => x.key === p.key);
        return row(p.key, p.label, !!(it && it.enabled), ()=>setDraft(d => ({...d, properties: orderedAll.map(x => x.key === p.key ? {...x, enabled:!x.enabled} : x)})));
      })}
      {section === 'properties' && !orderedProps && shownProps.map(p =>
        row(p.key, p.label, draft.properties.includes(p.key), ()=>flipProperty(p.key)))}
      {section === 'properties' && properties.some(p => p.extended) && (
        <ExtendedPropertyGroups query={query} renderItem={(it) => row(it.key, it.label, pinnedExt(it.key), ()=>flipExt(it.key))}/>
      )}
      {section === 'properties' && shownProps.length === 0 && !(query.trim() && properties.some(p => p.extended && [p.label, p.group].some(x => x && x.toLowerCase().includes(query.trim().toLowerCase())))) && (
        <div style={{fontSize:12.5, color:T.gray400, padding:'8px 6px'}}>No properties match “{query}”.</div>
      )}

      {section === 'relatedProperties' && <RelatedPropertiesEditor rows={rp.rows} setRows={setRows} options={kind.relatedOptions(properties)}/>}


      {/* Smart Features (Deals): each feature switches on or off on its own. */}
      {section === 'smartFeatures' && kind.smartFeatures.map(f =>
        row(f.key, f.label, !!draft.smartFeatures[f.key], ()=>flip('smartFeatures', f.key), f.hint))}

      {/* Ordered dropdowns (Deals): enable, item count and drag to reorder. */}
      {section === 'dropdowns' && Array.isArray(draft.dropdowns) && (
        <DragCheckList items={draft.dropdowns} labelOf={it => (kind.dropdowns.find(dd => dd.key === it.key) || {}).setting}
          onChange={v=>setDraft(d => ({...d, dropdowns: typeof v === 'function' ? v(d.dropdowns) : v}))}
          right={it => <ItemsInput value={it.count} disabled={!it.enabled}
            onChange={n=>setDraft(d => ({...d, dropdowns: d.dropdowns.map(x => x.key === it.key ? {...x, count:n} : x)}))}/>}/>
      )}
      {section === 'dropdowns' && !Array.isArray(draft.dropdowns) && kind.dropdowns.map(dd => {
        const cfg = draft.dropdowns[dd.key];
        return row(dd.key, dd.setting, cfg.enabled, ()=>setDropdown(dd.key, {enabled:!cfg.enabled}), null,
          <ItemsInput value={cfg.count} disabled={!cfg.enabled} onChange={n=>setDropdown(dd.key, {count:n})}/>);
      })}
    </SettingsModalShell>
  );
}

Object.assign(window, {CARD_SMART_FEATURES, CONTACT_CARD_KIND, CardSettingsModal, DEFAULT_CARD_SETTINGS, normalizeCardSettings, RELATED_FIELDS, CARD_DROPDOWNS, CLICKABLE_PROPERTIES, relatedFieldOptions});
