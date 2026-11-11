/* HOF Pulse ERP — Contact Side Panel View Settings.

   Same pattern as Board Card Settings (shared SettingsModalShell, settingsKit.jsx): four
   sections whose left-nav order IS their order in the panel, each configured in the middle,
   with a live preview of the panel body on the right. The profile (name, email, phone) always
   stays at the top and is not a section.

   One setting for every contact, in both the side panel and the full page's left column —
   they are the same component, so they never differ. Opened from View Settings in the
   contact's ⋯ menu; applies on Apply. */

const PANEL_SECTIONS = {
  avatarSubtitle:    'Avatar subtitle',   // fixed: what shows under the name (not a place in the layout)
  quickActions:      'Quick Actions',
  smartSummary:      'Smart Summary',
  dropdowns:         'Dropdowns',
  contactProperties: 'Contact Properties',
};

// The shared quick actions (contactActions.jsx) — the same set and labels as the card and the ⋯ menu.
const PANEL_QUICK_ACTIONS = quickActionLabels('contacts');

/* The side panel's Contact Properties, in their existing order. Contact Owner and Associated
   Deals are clickable (relationship) properties — see CLICKABLE_PROPERTIES. */
const PANEL_PROPERTIES = [
  {key:'owner',         label:'Contact Owner'},
  {key:'ownerAssigned', label:'Owner Assignment Date'},
  {key:'ownerChanged',  label:'Owner Change Date'},
  {key:'contactType',   label:'Type of Contact'},
  {key:'profileType',   label:'Customer Profile Type'},
  {key:'created',       label:'Created Date'},
  {key:'lastContacted', label:'Last Contacted'},
  {key:'lastActivity',  label:'Last Activity Date'},
  {key:'source',        label:'Source'},
  {key:'jobTitle',      label:'Job Title'},
  {key:'city',          label:'City'},
  {key:'country',       label:'Country'},
  {key:'deals',         label:'Associated Deals'},
  {key:'customers',     label:'Associated Customers'},
];

/* The panel's Contact Properties from Settings: the list above (labels from Settings; the worked-out
   ones — owner dates, Associated Deals — keep theirs), then every other Contact property (name,
   email and phone are the panel's header). Like Deals: a property added since the settings were
   saved joins the end — a custom one shown, a built-in one hidden (the default panel is unchanged). */
const CONTACT_PANEL_DERIVED = {ownerAssigned:'Owner Assignment Date', ownerChanged:'Owner Change Date', deals:'Associated Deals', customers:'Associated Customers', profileType:'Customer Profile Type'};
const contactPanelProperties = (props) => {
  const prop = (k) => (props || []).find(p => p.key === k);
  const base = PANEL_PROPERTIES.filter(p => CONTACT_PANEL_DERIVED[p.key] || !props || prop(p.key))
    .map(p => ({key:p.key, label:(prop(p.key) || {}).label || CONTACT_PANEL_DERIVED[p.key] || p.label}));
  const extra = (props || []).filter(p => !['name', 'email', 'phone'].includes(p.key) && !base.some(b => b.key === p.key))
    .map(p => ({key:p.key, label:p.label, system:!!p.system}));
  return [...base, ...extra];
};
const withContactPanelProperties = (settings, props) => {
  const known = settings.contactProperties.map(p => p.key);
  const added = contactPanelProperties(props).filter(p => !known.includes(p.key)).map(p => ({key:p.key, enabled:!p.system}));
  return added.length ? {...settings, contactProperties:[...settings.contactProperties, ...added]} : settings;
};

/* Defaults reproduce today's panel: the four quick actions, the summary, View Activity (now a
   dropdown showing the latest 10), and every Contact Property in its existing order. */
/* `subtitle`: the property shown under the contact's name ('' = none); Job Title by default. */
const DEFAULT_PANEL_SETTINGS = () => ({
  subtitle: 'jobTitle',
  order: ['quickActions', 'smartSummary', 'dropdowns', 'contactProperties'],
  quickActions: defaultQuickActions('contacts'),
  smartSummary: {enabled:true},
  dropdowns: [{id:'d-all', type:'all', enabled:true, count:10}],
  contactProperties: PANEL_PROPERTIES.map(p => ({key:p.key, enabled:true})),
});

/* A draggable checkbox list — Quick Actions, Dropdowns and Contact Properties all use it. */
/* onChange receives an updater (list => next list), so quick successive changes never overwrite
   each other. */
function DragCheckList({items, labelOf, onChange, right}){
  const drag = useDragReorder((from, to) => onChange(list => moveItem(list, from, to)));
  const idOf = (x) => x.id || x.key;
  return items.map((it, i) => (
    <SettingsCheckRow key={idOf(it)} label={labelOf(it)} checked={it.enabled}
      onToggle={()=>onChange(list => list.map(x => idOf(x) === idOf(it) ? {...x, enabled:!x.enabled} : x))}
      drag={drag.props(i)} dragOver={drag.over === i} right={right && right(it)}/>
  ));
}

/* `kind`: another record's panel (Deals) — its sections, quick action labels, dropdowns, its
   properties section (`propertiesKey` and `properties`) and preview. The Contact panel's by default. */
const CONTACT_PANEL_KIND = {
  object:'contacts', sections:PANEL_SECTIONS, quickActionLabels:PANEL_QUICK_ACTIONS, dropdowns:CARD_DROPDOWNS,
  // Read when the modal opens: the Contact properties are defined in contacts.jsx, loaded after this file.
  get subtitleOptions(){ return CONTACT_PROPERTIES.filter(p => p.key !== 'name').map(p => ({value:p.key, label:p.label})); },
  propertiesKey:'contactProperties', properties:PANEL_PROPERTIES,
  renderPreview:(draft, sample) => sample && sample.contact && <ContactDetailBody contact={sample.contact} acts={sample.acts || []} settings={draft} actions={{}}
    onStub={()=>{}} onCopied={()=>{}}/>,
};
// The Contact panel's kind, with its properties from Settings.
const contactPanelKind = (props) => {
  const list = contactPanelProperties(props);
  return {...CONTACT_PANEL_KIND, properties:list,
    subtitleOptions:(props || []).filter(p => p.key !== 'name').map(p => ({value:p.key, label:p.label})),
    renderPreview:(draft, sample) => sample && sample.contact && <ContactDetailBody contact={sample.contact} acts={sample.acts || []} settings={draft} actions={{}}
      panelProperties={list} onStub={()=>{}} onCopied={()=>{}}/>};
};
function PanelSettingsModal({draft, setDraft, sample, onApply, onClose, kind = CONTACT_PANEL_KIND}){
  const [section, setSection] = React.useState(draft.order[0]);
  const [addOpen, setAddOpen] = React.useState(false);
  const set = (key, value) => setDraft(d => ({...d, [key]: typeof value === 'function' ? value(d[key]) : value}));
  const dropdownOf = (type) => kind.dropdowns.find(d => d.key === type);
  const propLabel = (k) => (kind.properties.find(p => p.key === k) || {}).label || k;
  const missing = kind.dropdowns.filter(dd => !draft.dropdowns.some(x => x.type === dd.key));
  const preview = kind.renderPreview(draft, sample);

  return (
    <SettingsModalShell title="Side Panel Settings" sections={kind.sections} order={draft.order}
      onReorder={(from, to)=>set('order', o => moveItem(o, from, to))}
      section={section} onSection={setSection} onApply={onApply} onClose={onClose} fixed={['avatarSubtitle']}
      preview={preview && (
        <div style={{background:'#fff', border:`1px solid ${T.borderStrong}`, borderRadius:10, padding:'16px 14px'}}>{preview}</div>
      )}>

      {section === 'avatarSubtitle' && (
        <div style={{padding:'4px 6px', maxWidth:320}}>
          <label style={fieldLabel}>Subtitle</label>
          <FormSelect value={draft.subtitle ?? ''} placeholder="Select subtitle" options={kind.subtitleOptions} onChange={v=>set('subtitle', v)}/>
        </div>
      )}

      {section === 'quickActions' && (
        <DragCheckList items={normalizeQuickActions(draft.quickActions, kind.object || 'contacts')} labelOf={it => kind.quickActionLabels[it.key]}
          onChange={v=>set('quickActions', list => typeof v === 'function' ? v(normalizeQuickActions(list, kind.object || 'contacts')) : v)}/>
      )}

      {section === 'smartSummary' && (
        <SettingsCheckRow label="Show Smart Summary" hint="AI-generated" checked={draft.smartSummary.enabled}
          onToggle={()=>set('smartSummary', s => ({...s, enabled:!s.enabled}))}/>
      )}

      {section === 'dropdowns' && (<>
        <DragCheckList items={draft.dropdowns} labelOf={it => dropdownOf(it.type).setting} onChange={v=>set('dropdowns', v)}
          right={it => (<>
            <ItemsInput value={it.count} disabled={!it.enabled}
              onChange={n=>set('dropdowns', ds => ds.map(x => x.id === it.id ? {...x, count:n} : x))}/>
            <button title="Remove dropdown" onClick={()=>set('dropdowns', ds => ds.filter(x => x.id !== it.id))}
              style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:4, flexShrink:0}}>
              <Icon name="trash" size={15} color={T.gray600}/>
            </button>
          </>)}/>
        {draft.dropdowns.length === 0 && <div style={{fontSize:12.5, color:T.gray400, padding:'8px 6px'}}>No dropdowns yet</div>}
        {/* Add one of the dropdown types not already in the list. */}
        <div style={{position:'relative', alignSelf:'flex-start', padding:'4px 6px'}}>
          <button disabled={!missing.length} onClick={()=>setAddOpen(o=>!o)}
            style={{display:'flex', alignItems:'center', gap:6, border:'none', background:'transparent', padding:'4px 0',
                    cursor: missing.length ? 'pointer' : 'default', fontSize:13, fontFamily:'inherit',
                    color: missing.length ? T.attioBlue : T.gray400}}>
            <Icon name="plus" size={13} color={missing.length ? T.attioBlue : T.gray400}/> Add Dropdown
          </button>
          <MenuShell open={addOpen} onClose={()=>setAddOpen(false)} width={200}>
            {missing.map(dd => (
              <MenuItem key={dd.key} label={dd.setting} onClick={()=>{
                setAddOpen(false);
                set('dropdowns', ds => [...ds, {id:`d-${dd.key}`, type:dd.key, enabled:true, count:10}]);
              }}/>
            ))}
          </MenuShell>
        </div>
      </>)}

      {section === kind.propertiesKey && (
        <DragCheckList items={draft[kind.propertiesKey]} labelOf={it => propLabel(it.key)} onChange={v=>set(kind.propertiesKey, v)}/>
      )}
    </SettingsModalShell>
  );
}

Object.assign(window, {PanelSettingsModal, DEFAULT_PANEL_SETTINGS, PANEL_PROPERTIES, DragCheckList, contactPanelProperties, withContactPanelProperties, contactPanelKind});
