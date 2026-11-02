/* HOF Pulse ERP — Contacts Board view.

   Card layout and information hierarchy come from Figma node 6320:12760 ("contact-card");
   the styling is the product's own design system, not the Figma pixels.

   ── Pipeline model ────────────────────────────────────────────────────────────────────────
   The product will support two kinds of pipeline. Only one is mocked here, but both are
   representable, so the Board does not have to be rewritten when the Pipeline CRUD arrives:

     source:'property' — the stages ARE the values of a single-select property on the object.
                         Types of Contact works this way, off the `contactType` property.
                         Lead Status / Canada Application / US Application would be the same
                         shape with a different propertyKey.
     source:'manual'   — the stages belong to the pipeline itself and have no backing property.
                         The record stores its stage id per pipeline, so one record can sit in
                         several manual pipelines at once.
     source:'record'   — the record references ONE pipeline and a stage of it ({pipeline, stage},
                         ids). Deals work this way (Pipeline → Stages → Deal): a deal's stage
                         always belongs to its own pipeline, never a global status.

   Everything reads and writes a record's stage through `stageIdOf` / `withStage` and never
   touches the property directly. That is also the seam future automation plugs into: a rule
   that moves a record on a property change ends up calling `withStage`, so it cannot diverge
   from what the Board does by hand. No automation is implemented here.

   Pipeline CRUD is explicitly out of scope — this list is a mock, not an editable store. */

const CONTACT_TYPE_STAGES = [
  {id:'subscriber',  label:'Subscriber',               value:'Subscriber'},
  {id:'opportunity', label:'Opportunity',              value:'Opportunity'},
  {id:'customer',    label:'Customer',                 value:'Customer'},
  {id:'evangelist',  label:'Evangelist',               value:'Evangelist'},
  {id:'others',      label:'Others',                   value:'Others'},
];

/* Lead, Marketing Qualified Lead and Sales Qualified Lead were removed (Lead isn't part of the
   object model). A contact still in one of them moves to the first stage, Subscriber — the record
   and its other values are untouched. */
const REMOVED_CONTACT_STAGES = ['Lead', 'Marketing Qualified Lead', 'Sales Qualified Lead'];
const withoutRemovedStage = (c) => REMOVED_CONTACT_STAGES.includes(c.contactType) ? {...c, contactType:CONTACT_TYPE_STAGES[0].value} : c;
const PIPELINES = [
  {id:'typesOfContact', object:'contact', label:'Types of Contact',
   source:'property', propertyKey:'contactType', stages:CONTACT_TYPE_STAGES},
];

/* The Contacts pipelines in use: Settings → Pipelines' (app.jsx sets them, so one added there
   shows on the Contacts board); PIPELINES until then. */
let CONTACT_PIPELINES = PIPELINES;
const setContactPipelines = (list) => { CONTACT_PIPELINES = list && list.length ? list : PIPELINES; };
const pipelineById = (id) => CONTACT_PIPELINES.find(p => p.id === id) || CONTACT_PIPELINES[0];

function stageIdOf(pipeline, record){
  if(pipeline.source === 'property'){
    const v = record[pipeline.propertyKey];
    const stage = pipeline.stages.find(s => s.value === v);
    return stage ? stage.id : null;
  }
  if(pipeline.source === 'record') return record.pipeline === pipeline.id ? (record.stage || null) : null;
  return (record.pipelineStage || {})[pipeline.id] || null;
}

function withStage(pipeline, record, stageId){
  const stage = pipeline.stages.find(s => s.id === stageId);
  if(!stage) return record;
  if(pipeline.source === 'property') return {...record, [pipeline.propertyKey]: stage.value};
  if(pipeline.source === 'record') return {...record, pipeline:pipeline.id, stage:stage.id};
  return {...record, pipelineStage: {...(record.pipelineStage||{}), [pipeline.id]: stage.id}};
}

/* ── Contact card ───────────────────────────────────────────────────────────────────────── */

/* Contact temperature is a MOCKED value on the record (`contact.temperature`: Hot / Warm / Low).
   Nothing here computes it — how a contact's temperature is decided is not defined yet — so
   the card only renders what it is handed. It is a tag: Hot red-bordered, Warm orange-bordered,
   Normal (Low) or no value renders nothing. Same structure as the Lead Score tag. */
const cardTag = {
  height:24, minWidth:24, borderRadius:9999, flexShrink:0, boxSizing:'border-box',
  display:'inline-flex', alignItems:'center', justifyContent:'center',
  fontSize:11, fontWeight:600, fontVariantNumeric:'tabular-nums',
};
function TemperatureTag({value}){
  const c = value === 'Hot' ? T.hot : value === 'Warm' ? T.warm : null;
  if(!c) return null;
  return <span title={`Contact temperature: ${value}`} style={{...cardTag, padding:'0 9px', border:`1.5px solid ${c}`, color:c}}>{value}</span>;
}
function LeadScoreTag({value, title = 'Lead Score'}){
  return <span title={title} style={{...cardTag, width:24, border:`1.5px solid ${T.borderStrong}`, color:T.attioText}}>{value ?? 0}</span>;
}

/* Contact name — the primary-record treatment used in both the Table and on cards: underlined
   in #D7D6DA, darkening on hover. Clicking it opens the Contact Detail panel. */
function ContactName({name, onOpen, style}){
  const [h, setH] = React.useState(false);
  return (
    <span onClick={onOpen ? (e)=>{ e.stopPropagation(); onOpen(); } : undefined}
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} style={{
      fontSize:13.5, fontWeight:600, color:T.attioText, cursor:'pointer', minWidth:0,
      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
      textDecoration:'underline', textUnderlineOffset:2,
      textDecorationColor: h ? T.attioMuted : '#D7D6DA',
      transition:'text-decoration-color 120ms ease',
      ...style,
    }}>{name}</span>
  );
}

const cardIconBtnBase = {
  width:28, height:28, borderRadius:8, border:'none', background:'transparent',
  display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0,
};

function CardIconButton({icon, title, onClick}){
  const [h, setH] = React.useState(false);
  return (
    <button title={title} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      onMouseDown={e=>e.stopPropagation()}
      onClick={e=>{ e.stopPropagation(); onClick && onClick(); }}
      style={{...cardIconBtnBase, background: h ? T.headerBg : 'transparent'}}>
      <Icon name={icon} size={15} color={T.attioMuted}/>
    </button>
  );
}

const initialsOf = (name) => name.split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();

/* Related Properties — one card row per configured pair; either side resolves a related field. */
function relatedValue(key, contact, acts){
  if(key === 'owner') return contact.owner || null;
  if(key === 'company') return contact.company || null;
  if(key === 'ownerAssigned' || key === 'ownerChanged'){
    const d = ownerDates(contact, acts);
    return (key === 'ownerAssigned' ? d.assigned : d.changed) || null;
  }
  if(key === 'deals') return contact.dealCount ? String(contact.dealCount) : null;
  return contact[key] || null;   // any other contact property
}
function RelatedValue({field, contact, acts, right}){
  if(!field) return <span/>;
  const v = relatedValue(field, contact, acts);
  const text = {fontSize:12.5, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', minWidth:0};
  if(field === 'owner'){
    if(!v) return <span style={{fontSize:12.5, color:T.attioFaint, flexShrink:0}}>No owner</span>;
    return (
      <span style={{display:'flex', alignItems:'center', gap:8, minWidth:0, justifyContent: right ? 'flex-end' : 'flex-start'}}>
        <span style={{
          width:20, height:20, borderRadius:9999, background:T.attioText, color:'#fff', flexShrink:0,
          fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center',
        }}>{initialsOf(v)}</span>
        <span style={text}>{v}</span>
      </span>
    );
  }
  return <span style={{...text, color: v ? T.attioText : T.attioFaint, flexShrink: right ? 0 : 1}}>{v || '—'}</span>;
}

/* What the card shows, and in what order, is set per view in Card Settings (cardSettings.jsx).
   The name row always leads; each section below draws the rule above it, so hiding or moving
   any of them never leaves a doubled or dangling border. */
function ContactCard({contact, acts, dragging, onStub, onDragStart, actions, selectable, checked, onToggleSelect, onOpen, settings, properties}){
  // The one Card Settings structure (normalizeCardSettings), whatever shape the view saved.
  const cs = normalizeCardSettings(settings || DEFAULT_CARD_SETTINGS(), 'contacts', properties);
  const rule = {borderTop:`1px solid ${T.attioLine}`};
  const stop = {onMouseDown:e=>e.stopPropagation()};

  const sections = {
    // The shared quick actions, in the order set in Card Settings; each runs its ⋯ menu item's handler.
    quickActions: () => {
      const quick = shownQuickActions(cs.quickActions, 'contacts', contact);
      if(!quick.length) return null;
      const h = contactQuickHandlers(contact, actions, onStub);
      return (
        <div style={{display:'flex', alignItems:'center', gap:4, padding:'8px 12px', ...rule}}>
          {quick.map(q => <CardIconButton key={q.key} icon={q.icon} title={q.label} onClick={()=>runQuickAction(q.key, h, q.label)}/>)}
        </div>
      );
    },

    /* One tag area: tags sit together and wrap onto a new row as more are added. */
    tags: () => {
      const tags = [
        cs.tags.temperature && (contact.temperature === 'Hot' || contact.temperature === 'Warm') && <TemperatureTag key="t" value={contact.temperature}/>,
        cs.tags.leadScore && <LeadScoreTag key="s" value={contact.leadScore}/>,   // not calculated yet: 0
      ].filter(Boolean);
      if(!tags.length) return null;
      return <div style={{display:'flex', flexWrap:'wrap', alignItems:'center', gap:6, padding:'8px 16px', ...rule}}>{tags}</div>;
    },

    properties: () => {
      // In the order set in Card Settings; Associated Deals shows only when the contact has deals (as before).
      const props = cs.properties.filter(x => x.enabled).map(x => (properties || []).find(p => p.key === x.key)).filter(p => p && (p.key !== 'deals' || contact.dealCount > 0));
      if(!props.length) return null;
      return (
        <div style={{padding:'14px 16px', display:'flex', flexDirection:'column', gap:10, ...rule}}>
          {props.map(p => {
            /* Clickable (relationship) properties open their record: Associated Deals opens the
               contact's deals; the others aren't defined yet (standard placeholder). See CLICKABLE_PROPERTIES. */
            const link = CLICKABLE_PROPERTIES[p.key];
            const value = link && link.value ? link.value(contact) : p.extended ? (extendedValueText(p.key, contact) || '—') : formatValue(contact[p.key]);
            return (
              <div key={p.key} style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12}}>
                <span style={{fontSize:12.5, color:T.attioMuted, flexShrink:0}}>{p.label}</span>
                {link && link.show(contact) ? (
                  <button {...stop} onClick={e=>{ e.stopPropagation(); p.key === 'deals' && actions.onOpenDeals ? actions.onOpenDeals(contact) : onStub(link.open(contact)); }}
                    style={{border:'none', background:'transparent', padding:0, cursor:'pointer', fontSize:12.5, fontWeight:500, color:T.attioBlue,
                            minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{value}</button>
                ) : (
                  <span style={{fontSize:12.5, color:T.attioText, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{value || '—'}</span>
                )}
              </div>
            );
          })}
        </div>
      );
    },

    relatedProperties: () => {
      const rows = cs.relatedProperties.rows.filter(r => r.left || r.right);
      if(!rows.length) return null;
      return (
        <div style={{padding:'12px 16px', display:'flex', flexDirection:'column', gap:10, ...rule}}>
          {rows.map(r => (
            <div key={r.id} style={{display:'flex', alignItems:'center', gap:8, minWidth:0}}>
              <RelatedValue field={r.left} contact={contact} acts={acts}/>
              <div style={{flex:1}}/>
              <RelatedValue field={r.right} contact={contact} acts={acts} right/>
            </div>
          ))}
        </div>
      );
    },

    /* Smart Features: Smart Summary and Smart Actions, each switched on its own (both off by default). */
    smartFeatures: () => {
      const sf = cs.smartFeatures || {};
      if(!sf.summary && !sf.actions) return null;
      return (
        <div {...stop} style={{padding:'12px 16px', display:'flex', flexDirection:'column', gap:8, ...rule}}>
          {sf.summary && <div style={activityBox}><SummaryBlock contact={contact} acts={acts} source="From activity"/></div>}
          {sf.actions && <SmartActionsBox noun="contact"/>}
        </div>
      );
    },

    /* One dropdown per enabled activity type; each expands in place to its latest N items. */
    dropdowns: () => {
      const on = cs.dropdowns.filter(x => x.enabled).map(x => ({...CARD_DROPDOWNS.find(dd => dd.key === x.key), count:x.count})).filter(dd => dd.key);
      if(!on.length) return null;
      return (
        <div style={{padding:'12px 16px', ...rule}}>
          <div {...stop} style={activityBox}>
            {on.map((dd, i) => (
              <ActivityDropdown key={dd.key} first={i === 0} icon={dd.icon} label={dd.label} contact={contact}
                context={dd.type ? 'type' : 'all'}
                items={dd.type ? acts.filter(a => a.type === dd.type) : listedActivities(acts)} count={dd.count}
                emptyText={dd.empty} linkLabel={dd.link} onLink={()=>onStub(dd.link)}/>
            ))}
          </div>
        </div>
      );
    },
  };

  // A violation card chose this contact (Violations panel): it's pointed out here.
  const [focused, focusRef] = useRecordFocus(contact.id);
  return (
    <div ref={focusRef} onMouseDown={onDragStart}
      style={{
        background:'#fff', border:`1px solid ${checked ? T.attioBlue : T.borderStrong}`, borderRadius:10,
        boxShadow: dragging ? '0 10px 24px rgba(16,24,40,.16)' : '0 1px 2px rgba(16,24,40,.05)',
        opacity: dragging ? .5 : 1, cursor:'grab', userSelect:'none', ...(focused ? RECORD_FOCUS_RING : {}),
      }}>

      {/* Header — name, open record, record menu. Always first. */}
      <div style={{display:'flex', alignItems:'center', gap:8, padding:'12px 12px 12px 16px'}}>
        {/* Checkbox appears only while the column is in selection (see BoardColumn). */}
        {selectable && (
          <div {...stop} style={{display:'flex'}}>
            <RowCheckbox checked={checked} onChange={onToggleSelect}/>
          </div>
        )}
        <ContactName name={contact.name} onOpen={()=>onOpen(contact)}/>
        <div style={{flex:1}}/>
        {/* Opens the Contact Detail panel. */}
        <CardIconButton icon="openRecord" title="Open contact" onClick={()=>onOpen(contact)}/>
        {/* Same contact actions as the table's row menu. */}
        <ContactActionsMenu contact={contact} {...actions}/>
      </div>

      {cs.order.map(id => sections[id] ? <React.Fragment key={id}>{sections[id]()}</React.Fragment> : null)}
    </div>
  );
}

/* Smart Actions — its own Smart Feature on Contact and Deal cards. What it suggests or does is
   not defined yet, so it only shows that it's there. */
function SmartActionsBox({noun}){
  return (
    <div style={{...activityBox, padding:'10px 12px'}}>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4}}>
        <span style={{fontSize:11.5, fontWeight:600, color:T.attioText, letterSpacing:.2}}>Smart Actions</span>
        <span style={{fontSize:11, color:T.attioFaint}}>Not defined yet</span>
      </div>
      <div style={{fontSize:12.5, lineHeight:1.5, color:T.attioMuted}}>Smart Actions for this {noun} will appear here.</div>
    </div>
  );
}

/* ── Board ──────────────────────────────────────────────────────────────────────────────── */

const COLUMN_WIDTH = 320;
/* Column container fill — a step darker than the page so column bounds read without borders. */
const COLUMN_BG = '#F3F4F6';

/* Another object's board (Deals) passes `renderCard`, its `searchKeys` and `noun`; `bulkActions`
   false leaves only Select All in the column menu (bulk actions are Contact actions). */
function BoardColumn({stage, contacts, activities, isDropTarget, columnRef, onStub, onCardDragStart, draggingId, actions, onAddToStage, cardSettings, cardProperties,
                      selected, selectionOn, onSelectAll, onDeselectAll, onToggleSelect, onOpenContact,
                      renderCard, searchKeys = ['name', 'email'], noun = 'contact', bulkActions = true}){
  const [menuOpen, setMenuOpen] = React.useState(false);

  /* Column search — narrows this column only, on top of the page search and filters. Same
     fields as the page search (name, email). Closing the field clears it. */
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const toggleSearch = () => { if(searchOpen) setQ(''); setSearchOpen(o => !o); };
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? contacts.filter(c => searchKeys.some(k => String(c[k] || '').toLowerCase().includes(needle)))
    : contacts;

  /* Selection starts with Select All. The column checkbox reflects the cards on screen:
     checked = all, minus = some, empty = none (reachable by unchecking cards one by one).
     Clicking it selects all; clicking it when all are selected clears the column and leaves
     selection, which hides the checkboxes. A column also counts as selecting if a selected
     card was dragged into it. */
  const ids = shown.map(c => c.id);
  const shownSelected = ids.filter(id => selected.has(id)).length;
  const columnSelected = contacts.filter(c => selected.has(c.id)).length;   // incl. cards hidden by column search
  const selecting = selectionOn || columnSelected > 0;
  const allSelected = ids.length > 0 && shownSelected === ids.length;
  const someSelected = shownSelected > 0 && !allSelected;
  const hasSelection = columnSelected > 0;
  const pick = (fn) => () => { setMenuOpen(false); fn(); };
  const forSelected = (label) => `${label} · ${columnSelected} ${noun}${columnSelected === 1 ? '' : 's'}`;

  return (
    <div ref={columnRef} style={{
      width:COLUMN_WIDTH, flexShrink:0, display:'flex', flexDirection:'column', minHeight:0,
      background: isDropTarget ? T.blueLight : COLUMN_BG,
      border:`1px solid ${isDropTarget ? T.attioBlue : 'transparent'}`,
      borderRadius:14, transition:'background 120ms ease, border-color 120ms ease',
    }}>
      <div style={{display:'flex', alignItems:'center', gap:8, padding:'14px 12px 12px 16px', flexShrink:0}}>
        {selecting && (
          <RowCheckbox checked={allSelected} indeterminate={someSelected}
            onChange={() => allSelected ? onDeselectAll(contacts.map(c => c.id)) : onSelectAll(ids)}/>
        )}
        {/* One line always: a long stage name truncates rather than wrapping the header. */}
        <span title={stage.label} style={{fontSize:13, fontWeight:600, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', minWidth:0}}>{stage.label}</span>
        <span style={{
          fontSize:11.5, color:T.attioMuted, background:'#fff', borderRadius:9999,
          padding:'1px 7px', minWidth:22, textAlign:'center', flexShrink:0,
        }}>{shown.length}</span>
        {/* Adds a contact directly into this stage. Not offered on the unmapped bucket, which
            is not a stage a record can be placed in. */}
        {/* + and Search sit together as one small group, so the added icon doesn't push long
            stage names onto a second line. */}
        <div style={{display:'flex', alignItems:'center', gap:2, flexShrink:0}}>
          {stage.id !== '__unmapped' && (
            <button title={`Add ${noun} to ${stage.label}`} onClick={()=>onAddToStage(stage.id)}
              style={{...cardIconBtnBase, width:24, height:24, borderRadius:6}}>
              <Icon name="plus" size={13} color={T.attioMuted}/>
            </button>
          )}
          <button title={`Search ${stage.label}`} onClick={toggleSearch}
            style={{...cardIconBtnBase, width:24, height:24, borderRadius:6, background: searchOpen ? '#fff' : 'transparent'}}>
            <Icon name="search" size={13} color={searchOpen ? T.attioText : T.attioMuted}/>
          </button>
        </div>
        <div style={{flex:1}}/>
        <div style={{position:'relative'}}>
          <button title="Column options" onClick={()=>setMenuOpen(o=>!o)} style={cardIconBtnBase}>
            <Icon name="moreDots" size={15} color={T.attioMuted}/>
          </button>
          <MenuShell open={menuOpen} onClose={()=>setMenuOpen(false)} anchorRight width={210}>
            {/* Bulk actions act on the selection when there is one, otherwise on the whole
                column. None of them is defined yet. */}
            {!bulkActions ? null : hasSelection ? (
              <>
                <MenuItem label="Email Selected"           onClick={pick(()=>onStub(forSelected('Email Selected')))}/>
                <MenuItem label="Enrich Selected"          onClick={pick(()=>onStub(forSelected('Enrich Selected')))}/>
                <MenuItem label="Add Selected to Workflow" onClick={pick(()=>onStub(forSelected('Add Selected to Workflow')))}/>
              </>
            ) : (
              <>
                <MenuItem label="Email All"    onClick={pick(()=>onStub('Email All'))}/>
                <MenuItem label="Enrich All"   onClick={pick(()=>onStub('Enrich All'))}/>
                <MenuItem label="Add Workflow" onClick={pick(()=>onStub('Add Workflow'))}/>
              </>
            )}
            {bulkActions && <div style={{height:1, background:T.border, margin:'4px 2px'}}/>}
            {/* Disabled once every card on screen in the column is already selected. */}
            <MenuItem label="Select All" disabled={allSelected} onClick={pick(()=>onSelectAll(ids))}/>
          </MenuShell>
        </div>
      </div>

      {searchOpen && (
        <div style={{padding:'0 10px 12px', flexShrink:0}}>
          <div style={{position:'relative'}}>
            <div style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', display:'flex'}}>
              <Icon name="search" size={12} color={T.gray400}/>
            </div>
            <input autoFocus value={q} onChange={e=>setQ(e.target.value)}
              onKeyDown={e=>{ if(e.key === 'Escape') toggleSearch(); }}
              placeholder={`Search ${stage.label}`}
              style={{width:'100%', padding:'7px 10px 7px 28px', fontSize:12.5, border:`1px solid ${T.borderStrong}`,
                      borderRadius:8, fontFamily:'inherit', color:T.attioText, background:'#fff'}}/>
          </div>
        </div>
      )}

      {/* Each column scrolls on its own vertical axis. */}
      <div style={{flex:1, minHeight:0, overflowY:'auto', overflowX:'hidden', padding:'0 10px 14px', display:'flex', flexDirection:'column', gap:12}}>
        {shown.map(c => renderCard ? <React.Fragment key={c.id}>{renderCard(c, {
            dragging:draggingId===c.id, selectable:selecting, checked:selected.has(c.id), onToggleSelect:()=>onToggleSelect(c.id), onDragStart:(e)=>onCardDragStart(e, c)})}</React.Fragment> : (
          <ContactCard key={c.id} contact={c} acts={activities[c.id] || []} dragging={draggingId===c.id} actions={actions}
            selectable={selecting} checked={selected.has(c.id)} onToggleSelect={()=>onToggleSelect(c.id)} onOpen={onOpenContact}
            settings={cardSettings} properties={cardProperties}
            onStub={onStub} onDragStart={(e)=>onCardDragStart(e, c)}/>
        ))}
        {shown.length === 0 && (
          <div style={{
            border:`1px dashed #DCDDE1`, borderRadius:10, padding:'18px 12px',
            fontSize:12.5, color:T.attioFaint, textAlign:'center',
          }}>{needle ? `No ${noun}s match "${q.trim()}"` : `No ${noun}s`}</div>
        )}
      </div>
    </div>
  );
}

function ContactBoard({rows, search, pipelineId, onChangeStage, actions, onAddToStage, activities, onOpenContact, cardSettings, cardProperties,
                       pipeline: pipelineProp, renderCard, searchKeys = ['name', 'email'], noun, bulkActions}){
  const pipeline = pipelineProp || pipelineById(pipelineId);
  const [stub, setStub] = React.useState(null);
  /* Selected contact ids across the Board. Select All in a column adds that column's
     (currently visible) cards; each card's checkbox toggles itself. */
  const [selected, setSelected] = React.useState(()=>new Set());
  const [selectingStages, setSelectingStages] = React.useState(()=>new Set());   // columns with selection on
  const setStageOn = (stageId, on) => setSelectingStages(s => { const n = new Set(s); on ? n.add(stageId) : n.delete(stageId); return n; });
  const selectAll = (stageId, ids) => {
    setStageOn(stageId, true);
    setSelected(s => { const n = new Set(s); ids.forEach(id => n.add(id)); return n; });
  };
  /* Clearing a column from its checkbox also leaves selection for that column. */
  const deselectAll = (stageId, ids) => {
    setStageOn(stageId, false);
    setSelected(s => { const n = new Set(s); ids.forEach(id => n.delete(id)); return n; });
  };
  const toggleSelect = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  /* Card drag between columns. Built on plain mouse events for the same reason the table's
     column reorder is: listeners are attached synchronously on mousedown, so a fast gesture
     can't start before React has committed the drag state. Dragging writes the stage through
     `withStage` (via onChangeStage) — it is the same write path automation would use later. */
  const [drag, setDrag] = React.useState(null); // {id, x, y, overStageId}
  const colRefs = React.useRef({});
  const dragRef = React.useRef(null);

  const searched = React.useMemo(()=>{
    const q = (search || '').trim().toLowerCase();
    if(!q) return rows;
    return rows.filter(r => searchKeys.some(k => String(r[k] || '').toLowerCase().includes(q)));
  }, [rows, search]);

  /* Records whose property value matches no stage would otherwise vanish from the board. They
     get a trailing bucket, and only when such records actually exist — it is a safety net for
     unmapped data, not a stage of the pipeline. */
  const buckets = React.useMemo(()=>{
    const m = new Map(pipeline.stages.map(s => [s.id, []]));
    const orphans = [];
    searched.forEach(c => {
      const sid = stageIdOf(pipeline, c);
      if(sid && m.has(sid)) m.get(sid).push(c); else orphans.push(c);
    });
    return {m, orphans};
  }, [searched, pipeline]);

  const beginDrag = (e, contact) => {
    if(e.button !== 0) return;
    const startX = e.clientX, startY = e.clientY;
    let started = false;

    const move = (ev) => {
      if(!started && Math.hypot(ev.clientX-startX, ev.clientY-startY) < 4) return;
      started = true;
      let over = null;
      for(const [sid, el] of Object.entries(colRefs.current)){
        if(!el) continue;
        const r = el.getBoundingClientRect();
        if(ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom){ over = sid; break; }
      }
      const next = {id:contact.id, name:contact.name, x:ev.clientX, y:ev.clientY, overStageId:over};
      dragRef.current = next;
      setDrag(next);
    };

    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      const d = dragRef.current;
      if(d && d.overStageId && d.overStageId !== stageIdOf(pipeline, contact)){
        onChangeStage(contact.id, d.overStageId);
      }
      dragRef.current = null;
      setDrag(null);
    };

    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  const columns = pipeline.stages.map(s => ({stage:s, contacts:buckets.m.get(s.id) || []}));
  if(buckets.orphans.length) columns.push({stage:{id:'__unmapped', label:'No stage'}, contacts:buckets.orphans});

  return (
    <div style={{flex:1, minHeight:0, display:'flex', flexDirection:'column', overflow:'hidden'}}>
      <div style={{flex:1, minHeight:0, display:'flex', gap:16, alignItems:'stretch', overflowX:'auto', overflowY:'hidden', padding:'20px 24px'}}>
        {columns.map(({stage, contacts}) => (
          <BoardColumn key={stage.id} stage={stage} contacts={contacts} activities={activities || {}}
            columnRef={el => { colRefs.current[stage.id] = el; }}
            isDropTarget={!!drag && drag.overStageId === stage.id && stage.id !== '__unmapped'}
            draggingId={drag ? drag.id : null}
            onStub={setStub} actions={actions}
            selected={selected} selectionOn={selectingStages.has(stage.id)}
            onSelectAll={(ids)=>selectAll(stage.id, ids)}
            onDeselectAll={(ids)=>deselectAll(stage.id, ids)}
            onToggleSelect={toggleSelect}
            onOpenContact={onOpenContact}
            cardSettings={cardSettings} cardProperties={cardProperties}
            onAddToStage={(stageId)=>onAddToStage(pipeline, stageId)}
            onCardDragStart={beginDrag}
            renderCard={renderCard} searchKeys={searchKeys} noun={noun} bulkActions={bulkActions}/>
        ))}
      </div>

      {/* Cursor-following label while dragging — cheaper and steadier than cloning the card. */}
      {drag && (
        <div style={{
          position:'fixed', left:drag.x + 14, top:drag.y + 12, zIndex:95, pointerEvents:'none',
          background:'#fff', border:`1px solid ${T.attioBlue}`, borderRadius:8, padding:'6px 10px',
          fontSize:12.5, color:T.attioText, boxShadow:'0 8px 20px rgba(16,24,40,.18)',
        }}>{drag.name}</div>
      )}

      {stub && <StubPanel title={stub} onClose={()=>setStub(null)}/>}
    </div>
  );
}

/* Pipeline selector — sits beside the view switcher in Board mode. Only Types of Contact is
   mocked; the list comes from PIPELINES so adding pipelines later needs no change here. */
/* The toolbar dropdown button (pipeline, whose activities, people): one size wherever they sit together. */
const toolbarDropdownBtn = (open) => ({display:'inline-flex', alignItems:'center', gap:6, height:32, boxSizing:'border-box', border:`1px solid ${T.borderStrong}`,
  background: open ? T.headerBg : '#fff', borderRadius:8, padding:'0 10px 0 12px', fontSize:13, fontFamily:'inherit', color:T.gray800, cursor:'pointer', maxWidth:220, whiteSpace:'nowrap'});
function PipelineSelector({pipelineId, onChange, pipelines = CONTACT_PIPELINES}){
  const [open, setOpen] = React.useState(false);
  const current = pipelines.find(p => p.id === pipelineId) || pipelines[0];
  return (
    <div style={{position:'relative', flexShrink:0}}>
      <button onClick={()=>setOpen(o=>!o)} title="Pipeline" style={toolbarDropdownBtn(open)}>
        <span style={{minWidth:0, overflow:'hidden', textOverflow:'ellipsis'}}>{current.label}</span>
        <Icon name="chevDown" size={T.chevronSize} color={T.gray600} style={{transform: open ? 'rotate(180deg)' : 'none'}}/>
      </button>
      <MenuShell open={open} onClose={()=>setOpen(false)} width={220}>
        {pipelines.map(p => (
          <MenuItem key={p.id} label={p.label} onClick={()=>{ onChange(p.id); setOpen(false); }}/>
        ))}
      </MenuShell>
    </div>
  );
}

Object.assign(window, {REMOVED_CONTACT_STAGES, withoutRemovedStage, 
  CONTACT_TYPE_STAGES, PIPELINES, pipelineById, setContactPipelines, stageIdOf, withStage,
  ContactBoard, PipelineSelector, toolbarDropdownBtn, ContactName, ContactCard, COLUMN_BG,
});
