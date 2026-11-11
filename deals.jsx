/* HOF Pulse ERP — Deals (CRM → Pre-Sales → Deals).

   The Deal object on the same infrastructure as Contacts: its columns, filters and creation form
   are built from the Deal properties (Settings → Properties), the page is the Contacts view
   system (RecordViewsModule: views, View Settings, Save View, search, Filters, Table Settings,
   grid) with the Contacts Board, grouped by the selected pipeline's stages.

   A Deal references a Pipeline and a stage of it — {pipeline, stage} ids, the board's
   source:'record' pipeline model (board.jsx) — so a deal's stage always belongs to its own
   pipeline and every pipeline can bring its own stages. Dragging a card writes the stage through
   `withStage`, the same path pipeline logic would use later. No stage logic (requirements,
   entry / exit / backward rules, automation) is implemented.

   The Deal card is the Contact card's structure on the Deal object: Name on top, then the
   configurable sections Quick Actions, Tags (Deal Health, Deal Score), Properties, Smart Features
   (Smart Summary, Smart Actions), Dropdowns and Related Properties — configured per view through
   the shared Card Settings modal (DEAL_CARD_KIND). Nothing on it is specific to a pipeline: stage
   and pipeline come from the deal's own pipeline, and the card's property list is the Deal
   object's properties, so new pipelines and properties need no card changes.

   Deal Owner is a user (Users & Teams), stored by id and changeable on its own (Change Deal
   Owner); each change is recorded as an owner-change activity, as for Contacts, which is also
   where Deal Assignment Date comes from. Deal Amount is entered with its currency (the default
   one to start with — Settings → Defaults); the sample deals are in AED (DEAL_CURRENCY).
   A deal opens its record (DealDetail, dealDetail.jsx — the Contact Detail experience) and is
   linked to the contact it was created from (`contactId`); Contact → Deal is CreateDealModal.
   Deals ↔ Customers is Many-to-many: Create Customer makes a customer linked to the deal; deleting a
   deal keeps its customers, unlinked. Export downloads the current view as CSV. Not defined yet (placeholder): Enrich, calling,
   email and meetings from a deal, what Smart Actions recommend, how Deal Health and Deal Score are calculated (sample
   values only). */

const DEAL_CURRENCY = 'AED';
const formatAmount = (n) => (n === '' || n == null || isNaN(n)) ? '' : Number(n).toLocaleString('en-US', {maximumFractionDigits:2});
const dealStamp = (d) => storePropertyValue('Date & time', d);

/* Deal Health — a mocked value on the record, like Contact Temperature: nothing computes it yet.
   At Risk and Needs Attention render as tags; Healthy (or no value) renders nothing. */
const DEAL_HEALTH = {'At Risk':T.hot, 'Needs Attention':T.warm};

/* Sample US NIW deals (the one demo pipeline), spread across the stages, owned by existing users.
   Each came from a sample contact: it carries that contact's id (`contactId`, the Contact → Deal
   association) and, like a deal created from a contact by default, the contact's name. */
const SAMPLE_DEALS = () => {
  const at = (m, d, h = 10) => dealStamp(new Date(2026, m - 1, d, h, 15));
  /* `closed`: when a Won / Lost deal closed (its Actual Close Date). Mocked: Expected Close Date
     (five weeks after it was created), Deal Type, Deal Source (its contact's Lead Source), and the
     contact's email and phone. */
  const deal = (id, contact, stage, owner, amount, health, created, closed = '', pipeline = 'us-niw') => {
    const c = SAMPLE_CONTACTS.find(x => x.name === contact) || null;
    const expected = new Date(created); expected.setDate(expected.getDate() + 35);
    return {id:`deal-${id}`, name:contact, contactId:c ? c.id : null, email:c ? c.email : '', phone:c ? c.phone : '',
      pipeline, stage, dealType:DEAL_TYPES[id % 3 === 0 ? 1 : 0], owner, amount, currency:DEAL_CURRENCY, health, created,
      source:c ? c.source : 'Manual', closeDate:dealStamp(expected), actualCloseDate:closed};
  };
  const ac = (id, contact, stage, owner, amount, health, created, closeDate = '') => deal(id, contact, stage, owner, amount, health, created, closeDate, 'australia-canada');
  return [
    deal(1,  'Ali Khan',       'qualified-client', 'anaya-malik',      45000, 'Healthy',         at(9, 2)),
    deal(2,  'Fatima Noor',    'qualified-client', 'arwa-zafar',       38000, 'Needs Attention', at(9, 4, 14)),
    deal(3,  'Ahmed Raza',     'ccl-sent',                'asim-ali',         52500, 'Healthy',         at(9, 6)),
    deal(4,  'Sara Malik',     'ccl-sent',                'ali-noor',         45000, 'At Risk',         at(9, 9, 11)),
    deal(5,  'Bilal Ahmed',    'last-month-rollover',     'anaya-malik',      46000, 'At Risk',         at(8, 21)),
    deal(6,  'Zainab Hussain', 'expected-sale',           'hamza-siddiqui',   45000, 'Healthy',         at(9, 12, 16)),
    deal(7,  'Hassan Raza',    'expected-sale',           'arwa-zafar',       36000, 'Needs Attention', at(9, 14)),
    deal(8,  'Imran Sheikh',   'payment-made',            'asim-ali',         61500, 'Healthy',         at(8, 28, 12)),
    deal(9,  'Mahnoor Aziz',   'deal-won',                'waleed-bin-zaman', 45000, 'Healthy',         at(8, 11), at(9, 30, 17)),
    deal(10, 'Rabia Farooq',   'deal-won',                'ali-noor',         41000, 'Healthy',         at(8, 15), at(10, 3, 15)),
    deal(11, 'Kamran Iqbal',   'postponed',               'hamza-siddiqui',   39000, 'Needs Attention', at(9, 1)),
    deal(12, 'Tariq Mehmood',  'deal-lost',               'anaya-malik',      46000, 'At Risk',         at(8, 5), at(9, 20, 13)),
    // Australia and Canada (one pipeline): Canada clients, then Australia clients
    ac(13, 'Usman Tariq',      'qualified-client',    'asim-ali',         32000, 'Healthy',         at(9, 22)),
    ac(14, 'Noor Fatima',      'ccl-sent',            'arwa-zafar',       35500, 'Healthy',         at(9, 10, 11)),
    ac(15, 'Mehak Riaz',       'last-month-rollover', 'ali-noor',         38000, 'At Risk',         at(8, 19)),
    ac(16, 'Danish Aslam',     'expected-sale',       'hamza-siddiqui',   41000, 'Healthy',         at(8, 27, 15)),
    ac(17, 'Hamid Latif',      'payment-made',        'ali-noor',         44500, 'Healthy',         at(8, 18)),
    ac(18, 'Ali Raza Shah',    'deal-won',            'asim-ali',         39000, 'Healthy',         at(7, 30), at(9, 26, 16)),
    ac(19, 'Usama Qadir',      'postponed',           'hamza-siddiqui',   29500, 'Needs Attention', at(7, 22)),
    ac(20, 'Zain Ul Abideen',  'qualified-client',    'ali-noor',         36000, 'Healthy',         at(9, 27)),
    ac(21, 'Laiba Hashmi',     'deal-lost',           'waleed-bin-zaman', 33500, 'At Risk',         at(7, 14), at(9, 8, 12)),
    ac(22, 'Talha Mirza',      'ccl-sent',            'anaya-malik',      37500, 'Needs Attention', at(9, 15)),
    ac(23, 'Sana Yousaf',      'qualified-client',    'arwa-zafar',       48000, 'Healthy',         at(9, 25)),
    ac(24, 'Zeeshan Haider',   'ccl-sent',            'asim-ali',         52500, 'Healthy',         at(9, 5, 14)),
    ac(25, 'Maryam Rizvi',     'expected-sale',       'waleed-bin-zaman', 55000, 'Healthy',         at(8, 30)),
    ac(26, 'Sana Mir',         'last-month-rollover', 'arwa-zafar',       44000, 'At Risk',         at(8, 21)),
    ac(27, 'Mariam Khalid',    'payment-made',        'anaya-malik',      58500, 'Healthy',         at(8, 9, 10)),
    ac(28, 'Shahzaib Gillani', 'deal-won',            'ali-noor',         51000, 'Healthy',         at(7, 18), at(9, 29, 11)),
    ac(29, 'Hafsa Imtiaz',     'postponed',           'waleed-bin-zaman', 33500, 'Needs Attention', at(7, 25)),
    ac(30, 'Areej Fatima',     'qualified-client',    'arwa-zafar',       42000, 'Healthy',         at(10, 2)),
    ac(31, 'Hira Saleem',      'deal-lost',           'hamza-siddiqui',   39500, 'At Risk',         at(7, 8), at(9, 18, 15)),
    ac(32, 'Hamza Baig',       'expected-sale',       'asim-ali',         46500, 'Needs Attention', at(9, 2)),
  ];
};

/* Workflow sample data (US NIW → Return lost deals over AED 5,000 to Postponed): Kamran Iqbal's deal has had four
   unanswered calls, so it can be moved to Deal Lost; the other deals have fewer and are held back.
   Added to saved activity too (by id, once). */
const WORKFLOW_SAMPLE_CALL_DAYS = [3, 9, 15, 22];
function withWorkflowSampleCalls(acts, users){
  if(!ACTIVE_CRM.sample) return acts;   // the sample CRM instance's deal only
  const list = acts['deal-11'];
  if(!list || list.some(a => a.id === 'deal-11-wf-na-1')) return acts;
  const by = (users.find(u => u.id === 'hamza-siddiqui') || {}).name || '';
  const calls = WORKFLOW_SAMPLE_CALL_DAYS.map((d, i) => ({id:`deal-11-wf-na-${i + 1}`, dealId:'deal-11', type:'call', at:new Date(2026, 8, d, 11, 30),
    direction:'outbound', outcome:'No answer', logged:true, durationMin:0, body:'', source:'team', by}));
  return {...acts, 'deal-11':[...list, ...calls].sort((a, b) => new Date(b.at) - new Date(a.at))};
}

/* Sample activity per deal (keyed by deal id), from the same mock generator as Contacts: the
   last touchpoint falls on the close date, or a few days after the deal was created. Owner names
   come from Users. */
const SAMPLE_DEAL_ACTIVITIES = (deals, users) => {
  const nameOf = (id) => (users.find(u => u.id === id) || {}).name || '';
  const today = new Date(2026, 9, 7);
  const day = (d) => d.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric', timeZone:LOCAL_TZ});
  const seeds = deals.map((d, i) => {
    const created = new Date(d.created);
    const touch = d.closeDate ? new Date(d.closeDate) : new Date(Math.min(today, created.getTime() + (6 + (i * 5) % 20) * 86400000));
    return {id:500 + i, created:day(created), lastContacted:day(touch), owner:nameOf(d.owner)};
  });
  const gen = generateActivities(seeds);
  return Object.fromEntries(deals.map((d, i) => [d.id, (gen[500 + i] || []).map(a => ({...a, id:`${d.id}-${a.id}`, contactId:undefined, dealId:d.id}))]));
};

/* The Deal properties as the grid's columns, filters and select values. Custom Deal properties
   join automatically, since everything is read from the Object's properties. */
const dealFilterType = (t) => propertyFilterType(t);   // the one mapping (dataModel.jsx)
function dealSchema(props, pipelines, users){
  return {
    // Money (Deal Amount, a Currency property) reads right-aligned.
    properties:props.map(p => ({key:p.key, label:p.label, width:p.width || 170, money:p.key === 'amount' || (propertyTypeId(p.type) === 'Currency' && !p.currencyOnly)})),
    filterProps:props.map(propertyFilterMeta),
    selectValues:{
      // The Pipeline property's values: the record's own (manual) pipelines.
      pipeline:pipelines.filter(p => p.source !== 'property').map(p => p.label),
      stage:[...new Set(pipelines.filter(p => p.source !== 'property').flatMap(p => p.stages.map(s => s.label)))],
      owner:users.map(u => u.name),
      currency:CURRENCY_LIST.map(c => c.code),
      ...Object.fromEntries(props.filter(p => p.options).map(p => [p.key, p.options])),
    },
    noun:typeNoun('deals', 'deal'), searchKeys:['name', 'owner'],
  };
}

/* A deal as a list / filter row: names and labels for its pipeline, stage and owner (the deal
   keeps ids). The Deals table and Contacts' Deal filters read the same row. */
const dealRowOf = (data, d) => {
  const pl = objectPipelines(data, 'deals').find(p => p.id === d.pipeline);
  return {...d, pipeline:(pl || {}).label || '', stage:((pl && pl.stages.find(s => s.id === d.stage)) || {}).label || '',
    owner:((data.users || []).find(u => u.id === d.owner) || {}).name || ''};
};
/* The Deal form's choices and rules — the Deals page's Add / Edit deal, and a new deal created
   through a contact. A stage belongs to its pipeline: changing the pipeline clears a stage that
   isn't in it. */
// The same choices and rule for any Object with pipelines (Deals, Customers).
const pipelineFormOptions = (data, object) => (p, v) => {
  const pipelines = recordPipelines(data, object);
  return ({
    pipeline:pipelines.map(pl => ({value:pl.id, label:pl.label})),
    stage:((pipelines.find(pl => pl.id === v.pipeline) || {}).stages || []).map(s => ({value:s.id, label:s.label})),
    owner:ownerUserOptions(data.users),
  })[p.key];
};
const pipelineFormAdjust = (data, object) => (next, key) => key === 'pipeline' && !((recordPipelines(data, object).find(pl => pl.id === next.pipeline) || {}).stages || []).some(s => s.id === next.stage) ? {...next, stage:''} : next;
const dealFormOptions = (data) => pipelineFormOptions(data, 'deals');
const dealFormAdjust = (data) => pipelineFormAdjust(data, 'deals');
// The Deals filters (properties, select values) — Deals' own, and Contacts' Deal filters.
const dealFilterSchema = (data) => dealSchema(objectFormProperties(data, 'deals'), objectPipelines(data, 'deals'), data.users.filter(u => u.status === 'Activated'));

/* ── Deal card: sections and Card Settings ───────────────────────────────────────────────── */

const DEAL_CARD_SECTIONS = {
  quickActions:      'Quick Actions',
  tags:              'Tags',
  properties:        'Properties',
  smartFeatures:     'Smart Features',
  dropdowns:         'Dropdowns',
  relatedProperties: 'Related Properties',
};
// A deal's quick actions: the shared set (contactActions.jsx) — Go to Contact in place of Create Deal.
const DEAL_QUICK_ACTIONS = Object.fromEntries(OBJECT_QUICK_ACTIONS.deals.map(k => [k, {label:quickActionLabel('deals', k), icon:QUICK_ACTION_DEFS[k].icon}]));
const DEAL_TAGS = [
  {key:'health',    get label(){ return `${typeSingular('deals', 'Deal')} Health`; }, hint:'At Risk · Needs Attention · Healthy'},
  {key:'dealScore', get label(){ return `${typeSingular('deals', 'Deal')} Score`; }},
];
const DEAL_DROPDOWNS = [
  ...CARD_DROPDOWNS,
  {key:'meeting', setting:'Meetings', label:'Meetings', icon:'calendar', type:'meeting', link:'View all meetings', empty:'No meetings yet'},
];
const DEAL_RELATED_FIELDS = [
  {key:'owner',         get label(){ return `${typeSingular('deals', 'Deal')} Owner`; }},
  {key:'ownerAssigned', label:'Owner Assignment Date'},
];
// Card properties: every Deal property but Deal Name (always on top) and Currency (always AED).
const DEAL_CARD_EXCLUDED = ['name', 'currency'];
const dealCardProperties = (props) => props.filter(p => !DEAL_CARD_EXCLUDED.includes(p.key)).map(p => ({key:p.key, label:p.label}));

/* Defaults: available is not shown. The default Deal card shows Call, Email, Task, Note, every
   Deal property, the All Activity dropdown and the owner row; tags, smart features and the other
   actions and dropdowns are off until someone switches them on in Card Settings. */
const DEFAULT_DEAL_CARD_SETTINGS = () => ({
  order: ['quickActions', 'tags', 'properties', 'smartFeatures', 'dropdowns', 'relatedProperties'],
  quickActions: defaultQuickActions('deals'),
  tags: {health:false, dealScore:false},
  // Ordered: card properties reorder by drag on Deals.
  properties: ['pipeline', 'stage', 'owner', 'amount', 'closeDate', 'created'].map(key => ({key, enabled:true})),
  smartFeatures: {summary:false, actions:false},
  // Ordered: dropdowns reorder by drag on Deals.
  dropdowns: DEAL_DROPDOWNS.map(dd => ({key:dd.key, enabled:dd.key === 'all', count:5})),
  relatedProperties: {rows:[{id:'r1', left:'owner', right:'ownerAssigned'}]},
});

/* What a card shows for a deal: names and labels instead of ids, the amount with its currency. */
const dealCardRow = (row) => ({...row, amount: row.amount === '' || row.amount == null ? '' : `${row.currency || DEAL_CURRENCY} ${formatAmount(row.amount)}`});

/* ── The record card ── one card for Deals and Customers, on the Contact card's structure (name
   row, then the sections in the order set in Card Settings — the same structure for every Object,
   normalizeCardSettings). `kind`: what differs per Object — its quick actions (the shared set),
   tags, dropdowns, display row, Smart Summary lead and the marker beside the name. */
function RecordCard({kind, record, row, acts = [], settings, properties, onQuick, menu, onOpen, onStub, dragging, selectable, checked, onToggleSelect, onDragStart}){
  const cs = normalizeCardSettings(settings || kind.defaults(), kind.object, properties, kind.dropdowns);
  const r = kind.cardRow(row);
  const rule = {borderTop:`1px solid ${T.attioLine}`};
  const stop = {onMouseDown:e=>e.stopPropagation()};
  const sections = {
    quickActions: () => {
      const quick = shownQuickActions(cs.quickActions, kind.object, record);
      if(!quick.length) return null;
      return (
        <div style={{display:'flex', alignItems:'center', gap:4, padding:'8px 12px', flexWrap:'wrap', ...rule}}>
          {quick.map(q => <CardIconButton key={q.key} icon={q.icon} title={q.label} onClick={()=>onQuick && onQuick(q.key, record)}/>)}
        </div>
      );
    },
    tags: () => {
      const tags = (kind.tags ? kind.tags(record, cs) : []).filter(Boolean);
      if(!tags.length) return null;
      return <div style={{display:'flex', flexWrap:'wrap', alignItems:'center', gap:6, padding:'8px 16px', ...rule}}>{tags}</div>;
    },
    properties: () => {
      const props = cs.properties.filter(x => x.enabled).map(x => (properties || []).find(p => p.key === x.key)).filter(Boolean);
      if(!props.length) return null;
      return (
        <div style={{padding:'14px 16px', display:'flex', flexDirection:'column', gap:10, ...rule}}>
          {props.map(p => (
            <div key={p.key} style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12}}>
              <span style={{fontSize:12.5, color:T.attioMuted, flexShrink:0}}>{p.label}</span>
              <span style={{fontSize:12.5, color:T.attioText, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{(p.extended ? extendedValueText(p.key, record) : formatPropertyValueOf(p, r[p.key])) || '—'}</span>
            </div>
          ))}
        </div>
      );
    },
    // Smart Summary opens with the record's stage and pipeline; what Smart Actions suggest is not defined yet.
    smartFeatures: () => {
      const sf = cs.smartFeatures || {};
      if(!sf.summary && !sf.actions) return null;
      return (
        <div {...stop} style={{padding:'12px 16px', display:'flex', flexDirection:'column', gap:8, ...rule}}>
          {sf.summary && <div style={activityBox}><SummaryBlock contact={r} acts={acts} source="From activity" lead={`${r.stage || 'No stage'} · ${r.pipeline || 'No pipeline'}.`}/></div>}
          {sf.actions && <SmartActionsBox noun={kind.noun}/>}
        </div>
      );
    },
    dropdowns: () => {
      const on = cs.dropdowns.filter(x => x.enabled).map(x => ({...kind.dropdowns.find(dd => dd.key === x.key), count:x.count})).filter(dd => dd.key);
      if(!on.length) return null;
      return (
        <div style={{padding:'12px 16px', ...rule}}>
          <div {...stop} style={activityBox}>
            {on.map((dd, i) => (
              <ActivityDropdown key={dd.key} first={i === 0} icon={dd.icon} label={dd.label} contact={r}
                context={dd.type ? 'type' : 'all'}
                items={dd.type ? acts.filter(a => a.type === dd.type) : listedActivities(acts)} count={dd.count}
                emptyText={dd.empty} linkLabel={dd.link} onLink={()=>onStub && onStub(dd.link)}/>
            ))}
          </div>
        </div>
      );
    },
    relatedProperties: () => {
      const rows = cs.relatedProperties.rows.filter(x => x.left || x.right);
      if(!rows.length) return null;
      // The owner's assignment date falls back to the Create Date: shown as a date, like every other assignment date.
      const rel = {...r, created: r.created ? String(r.created).split(', ').slice(0, 2).join(', ') : ''};
      return (
        <div style={{padding:'12px 16px', display:'flex', flexDirection:'column', gap:10, ...rule}}>
          {rows.map(x => (
            <div key={x.id} style={{display:'flex', alignItems:'center', gap:8, minWidth:0}}>
              <RelatedValue field={x.left} contact={rel} acts={acts}/>
              <div style={{flex:1}}/>
              <RelatedValue field={x.right} contact={rel} acts={acts} right/>
            </div>
          ))}
        </div>
      );
    },
  };
  // A violation card chose this record (Violations panel): it's pointed out here.
  const [focused, focusRef] = useRecordFocus(record.id);
  return (
    <div ref={focusRef} {...{[kind.dataAttr]:record.id}} onMouseDown={onDragStart} style={{background:'#fff', border:`1px solid ${checked ? T.attioBlue : T.borderStrong}`, borderRadius:10,
      boxShadow: dragging ? '0 10px 24px rgba(16,24,40,.16)' : '0 1px 2px rgba(16,24,40,.05)', opacity: dragging ? .5 : 1, cursor:'grab', userSelect:'none', ...(focused ? RECORD_FOCUS_RING : {})}}>
      {/* Header — the name, workflow violations, open record, record menu. Always first, not configurable. */}
      <div style={{display:'flex', alignItems:'center', gap:8, padding:'12px 12px 12px 16px'}}>
        {selectable && <div {...stop} style={{display:'flex'}}><RowCheckbox checked={checked} onChange={onToggleSelect}/></div>}
        <ContactName name={record.name} onOpen={onOpen}/>
        <DealPromptMarker dealId={record.id}/>
        <div style={{flex:1}}/>
        <CardIconButton icon="openRecord" title={`Open ${kind.noun}`} onClick={onOpen}/>
        {menu && <div {...stop}>{menu}</div>}
      </div>
      {cs.order.map(id => sections[id] ? <React.Fragment key={id}>{sections[id]()}</React.Fragment> : null)}
    </div>
  );
}
const DEAL_RECORD_KIND = {object:'deals', get noun(){ return typeNoun('deals', 'deal'); }, dataAttr:'data-deal-id', defaults:() => DEFAULT_DEAL_CARD_SETTINGS(), dropdowns:DEAL_DROPDOWNS, cardRow:(row) => dealCardRow(row),
  tags:(deal, cs) => {
    const hc = DEAL_HEALTH[deal.health];
    return [cs.tags.health && hc && <span key="h" title={`Deal Health: ${deal.health}`} style={{...cardTag, padding:'0 9px', border:`1.5px solid ${hc}`, color:hc}}>{deal.health}</span>,
      cs.tags.dealScore && <LeadScoreTag key="s" title="Deal Score" value={deal.dealScore}/>];   // not calculated yet: 0
  }};
function DealCard({deal, ...rest}){ return <RecordCard kind={DEAL_RECORD_KIND} record={deal} {...rest}/>; }

/* `contacts`, `contactActivities`, `profileStore`: the shared Contact records, their activity and
   Customer Profiles (App) — a deal shows its contact and the contact's profile. `openRequest`
   ({id, mode, tab, nonce}) opens a deal from elsewhere (a contact's deals); `onOpenContact(id,
   mode)` goes to the deal's contact. */
function DealsModule({data, deals, setDeals, activities, setActivities, contacts = [], contactActivities = {}, profileStore, openRequest, onOpenContact, updateContactActivity, onCreateContact,
                     customers = [], onCreateCustomer, onLinkCustomer, onOpenCustomer, onRecordDeleted}){
  const props = React.useMemo(()=>objectFormProperties(data, 'deals'), [data.properties]);
  const pipelines = React.useMemo(()=>objectPipelines(data, 'deals'), [data.pipelines]);
  // Card properties: the Deal's own, then the Customer Profile and Accounting Properties (extendedProps.jsx).
  const cardProps = React.useMemo(()=>[...dealCardProperties(props), ...extendedProps()], [props]);
  // Deal Owner: activated users (names still resolve for owners who were deactivated later).
  const owners = data.users.filter(u => u.status === 'Activated');
  const ownerName = (id) => (data.users.find(u => u.id === id) || {}).name || '';
  const pipelineOf = (id) => pipelines.find(p => p.id === id);

  const [form, setForm] = React.useState(null);           // {mode:'add'|'edit', initial, id?}
  const [changingOwner, setChangingOwner] = React.useState(null);
  const [stub, setStub] = React.useState(null);
  /* Deal Detail: which deal is open and how (side panel / full screen), by id like Contacts. */
  const [detail, setDetail] = React.useState(null);   // {id, mode:'panel'|'full', tab?}
  // Deal side panel layout (View Settings from the deal's ⋯ menu) — one setting for every deal.
  const [panelSettings, setPanelSettings] = usePersistedState('panel:deals', () => defaultDealPanelSettings(props));
  const [panelDraft, setPanelDraft] = React.useState(null);
  const [profileRun, setProfileRun] = React.useState(null);   // {contactId, dealId, templateIds, call}
  // Activity views on the deal's activity tabs (activityViews.jsx) — one set for every deal.
  const [activityViewState, setActivityViewState] = React.useState({});
  // Violation Mode: the violations list over the right side.
  const engineCtx = useWorkflowEngineCtx();
  const hub = useRecordHub();
  // The Object whose violations list is open (one at a time).
  const violationMode = !!engineCtx && engineCtx.violationMode === 'deals';
  const setViolationMode = (on) => engineCtx && engineCtx.setViolationMode(on ? 'deals' : false);
  React.useEffect(() => () => engineCtx && engineCtx.setViolationMode(m => m === 'deals' ? false : m), []);
  const [toast, setToast] = React.useState(null);
  const toastTimer = React.useRef(null);
  const showToast = (message) => { setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(()=>setToast(null), TOAST_MS); };

  // Rows show names and labels; the deal keeps ids (pipeline, stage, owner).
  const toRow = (d) => dealRowOf(data, d);
  /* Filter by associated object → Contacts: every Contact filter property (Contacts' own list),
     read from the deal's contact — each row carries it. */
  const contactAssoc = React.useMemo(()=>assocFilterSchema('Contacts', 'Contact', customContactSchema(objectFormProperties(data, 'contacts'))), [data.properties]);
  const contactOfDeal = (d) => contacts.find(c => c.id === d.contactId);
  // With the worked-out Deal properties: Associated Contact / Customer and Last Activity Date.
  const rows = React.useMemo(()=>deals.map(d => { const c = contactOfDeal(d);
    return withAssocRecords({...toRow(d), contact:c ? c.name : '', customers:customers.filter(x => (x.dealIds || []).includes(d.id)).map(x => x.name).join(', '), lastActivity:latestActivityDate((activities || {})[d.id])},
      'Contacts', c ? [contactView(c)] : []); }), [deals, pipelines, data.users, contacts, customers, activities]);
  const byId = React.useMemo(()=>new Map(deals.map(d => [d.id, d])), [deals]);
  const schema = React.useMemo(()=>withScopeFilters(withAssocFilters(dealSchema(props, pipelines, owners), contactAssoc), data, 'deals'), [props, pipelines, data, contactAssoc]);

  // `returnTo`: opened from a workflow event, which comes back when the deal closes.
  const openDeal = (d) => setDetail(x => ({id:d.id, mode: x && x.mode === 'full' ? 'full' : 'panel', returnTo: x && x.returnTo}));
  /* Opened from elsewhere (a contact's Associated Deals or Deals tab, a workflow event): in the mode
     it came from, on a tab if asked — a tab id, or {id, adding, prefill} with a form open. */
  React.useEffect(() => {
    if(openRequest && byId.has(openRequest.id)) setDetail({id:openRequest.id, mode:openRequest.mode || 'panel',
      tab: openRequest.tab ? {...(typeof openRequest.tab === 'string' ? {id:openRequest.tab} : openRequest.tab), nonce:openRequest.nonce} : undefined,
      returnTo: openRequest.onReturn || null});
  }, [openRequest && openRequest.nonce]);
  const closeDetail = () => { const back = detail && detail.returnTo; setDetail(null); if(back) back(); };
  const contactOf = (d) => contacts.find(c => c.id === (byId.get(d.id) || d).contactId) || null;
  // Go to contact: the Contacts page with the deal's contact open (in the mode the deal is open in).
  const goToContact = (d) => { const c = contactOf(d); if(c && onOpenContact) onOpenContact(c.id, detail && detail.id === d.id ? detail.mode : 'panel'); };
  /* The deal ⋯ menu — the one record menu (DealActionsMenu); View settings only on the
     deal itself. Same menu on the table row, the board card and the deal. */
  const dealMenu = (d, onViewSettings) => <DealActionsMenu deal={byId.get(d.id) || d} contact={contactOf(d)} onTool={(key)=>dealToolAction(key, d)}
    onCreateCustomer={onCreateCustomer && (()=>onCreateCustomer({deal:byId.get(d.id), contact:contactOf(d)}))}
    onEdit={()=>setForm({mode:'edit', id:d.id, initial:byId.get(d.id)})} onOwner={()=>setChangingOwner(byId.get(d.id))}
    onEnrich={()=>setStub(`Enrich deal · ${d.name}`)} onDelete={()=>setPendingDelete(byId.get(d.id))}
    onStub={(t)=>setStub(`${t} · ${d.name}`)} onCopied={showToast} onViewSettings={onViewSettings}/>;
  /* Tools in the ⋯ menu: Task and Note open the deal on that tab with its form; File and Quote, on
     the Files and Quotes tabs. Calling, Email and Meeting aren't defined for deals yet (placeholder). */
  const dealToolAction = (key, d) => {
    // Call: the call window; Email: the composer; Quote: a new quotation (recordHub.jsx).
    if(hub && key === 'call') return hub.startCall({object:'deals', id:d.id});
    if(hub && key === 'email') return hub.composeEmail({object:'deals', id:d.id});
    if(hub && key === 'quote') return hub.newQuote({object:'deals', id:d.id});
    const tab = {task:{id:'tasks', adding:'Task'}, note:{id:'notes', adding:'Note'}, file:{id:'files'}, meeting:{id:'meetings', adding:'Schedule Meeting'}}[key];
    if(!tab) return setStub(`${({call:'Call', email:'Email', meeting:'Meeting', quote:'Quote'})[key]} · ${d.name}`);
    setDetail(x => ({id:d.id, mode:'full', tab:{...tab, nonce:Date.now()}, returnTo: x && x.returnTo}));
  };
  const customersOf = (dealId) => customers.filter(c => (c.dealIds || []).includes(dealId));
  const [pendingDelete, setPendingDelete] = React.useState(null);   // the deal being deleted
  // Quick actions: Change Deal Owner and Go to contact work; the others aren't defined for Deals yet.
  // Quick actions run what their ⋯ menu items run.
  const onQuick = (key, d) => runQuickAction(key, {onTool:(k)=>dealToolAction(k, d), onOwner:()=>setChangingOwner(byId.get(d.id)), onGoToContact:()=>goToContact(d),
    onCreateCustomer: onCreateCustomer && (()=>onCreateCustomer({deal:byId.get(d.id), contact:contactOf(d)})), onStub:(l)=>setStub(`${l} · ${d.name}`)}, quickActionLabel('deals', key));
  // The pipelines in view (Violations): the Board's, or those of the listed deals.
  const viewPipelines = (v) => v.mode === 'board' ? [v.pipelineId] : [...new Set(v.rows.map(r => (byId.get(r.id) || {}).pipeline).filter(Boolean))];
  /* Bulk Actions (bulkActions.jsx): edit through setDeals (owner history, workflows); delete as the
     deal's Delete does (its activity goes; its customers stay, unlinked); the Board's stage and
     pipeline moves in one change, as a card dragged between stages is written. */
  const dealBulk = useRecordBulk({object:'deals', data, records:deals,
    update:(ids, patch) => setDeals(ds => ds.map(d => ids.includes(d.id) ? {...d, ...patch} : d)),
    move:(ids, fn) => setDeals(ds => ds.map(d => ids.includes(d.id) ? fn(d) : d)),
    remove:(ids) => {
      setDeals(ds => ds.filter(d => !ids.includes(d.id)));
      setActivities(m => { const n = {...m}; ids.forEach(id => delete n[id]); return n; });
      ids.forEach(id => onRecordDeleted && onRecordDeleted('deals', id));
      if(detail && ids.includes(detail.id)) setDetail(null);
    }});
  const fullSchema = {...schema, pipelineLabel:(id) => (pipelineOf(id) || pipelines[0] || {}).label || '',
    // The name with the deal's workflow violations beside it.
    renderCell: (key, r) => key === 'name' ? <span data-deal-id={r.id} style={{display:'inline-flex', alignItems:'center', gap:8, minWidth:0, maxWidth:'100%'}}>
        <ContactName name={r.name} onOpen={()=>openDeal(r)} style={{fontSize:'inherit', fontWeight:500}}/><DealPromptMarker dealId={r.id}/></span>
      : key === 'amount' ? moneyText(r.amount, r.currency) || '—' : undefined,
    renderActions: (r) => dealMenu(r),
    bulkActions: dealBulk.bulkActions,
  };

  /* Every owner change — here, the Edit deal form, the activity reassign, a workflow — is recorded
     as an Owner change activity (from, to: user IDs) by the one place deals change (setDeals, the
     workflow engine), so the history keeps every owner and Deal Assignment Date reads from it. */
  const changeOwner = (id, owner) => {
    const prev = deals.find(d => d.id === id);
    if(!prev || owner === prev.owner) return;
    setDeals(ds => ds.map(d => d.id === id ? {...d, owner} : d));
  };
  const save = (vals, assocList) => {
    const assoc = (assocList || []).find(a => a.object === 'contacts'), custLink = (assocList || []).find(a => a.object === 'customers');
    const amount = vals.amount === '' || vals.amount == null ? '' : Number(vals.amount);
    if(form.mode === 'edit'){
      setDeals(ds => ds.map(d => d.id === form.id ? {...d, ...vals, amount} : d));
    } else {
      const id = newRecordId('deals');   // never reused (store.jsx)
      // Its contact: none, the one chosen, or the one created with it — else, linked to a customer, that customer's contact.
      const linkedCustomer = custLink && custLink.existingId ? customers.find(c => c.id === custLink.existingId) : null;
      const contactId = !assoc ? (linkedCustomer ? linkedCustomer.contactId ?? null : null)
        : assoc.existingId != null && assoc.existingId !== '' ? assoc.existingId : onCreateContact ? onCreateContact(assoc.values) : null;
      setDeals(ds => [...ds, {id, contactId, ...vals, amount, currency:vals.currency || defaultCurrency(), created:dealStamp(new Date())}]);
      setActivities(m => ({...m, [id]: []}));
      // An existing customer without a deal: its deal (a customer has one deal).
      if(custLink && custLink.existingId && onLinkCustomer) onLinkCustomer(custLink.existingId, {dealIds:[id]});
    }
    showToast(`${typeSingular('deals', 'Deal')} ${form.mode === 'edit' ? 'saved' : 'added'}`);
    setForm(null);
  };
  const formOptions = dealFormOptions(data), adjust = dealFormAdjust(data);
  /* Add deal: Create through associated record → Contact — any existing contact (a contact has
     many deals), whose name, email and phone the deal takes, or a new one created with the deal;
     → Customer — an existing customer that has no deal yet (a customer has one deal). */
  const creatable = creationAssociations(data, 'deals');
  const hasDeal = (c) => (c.dealIds || []).some(id => deals.some(d => d.id === id));
  const association = [
    ...(creatable.includes('contacts') ? [{object:'contacts', noun:'contact',
      existing:contacts.map(c => ({value:c.id, label: c.email ? `${c.name} · ${c.email}` : c.name})),
      pull:(id) => { const c = contacts.find(x => x.id === id) || {}; return {name:c.name || '', email:c.email || '', phone:c.phone || ''}; },
      fields:objectFormProperties(data, 'contacts').filter(p => p.onCreate),
      optionsFor:(p) => ({owner:ownerUserOptions(data.users), contactType:CONTACT_TYPE_STAGES.map(s => s.value)})[p.key] || p.options || []}] : []),
    ...(creatable.includes('customers') ? [{object:'customers', noun:'customer', existingOnly:true,
      existing:customers.filter(c => !hasDeal(c)).map(c => ({value:c.id, label:c.email ? `${c.name} · ${c.email}` : c.name})),
      existingNote:'Customers that already have a deal aren’t listed — a customer has one deal.'}] : []),
  ];

  // A deal's activity as the acting user may see it (tool permissions on the deal).
  const actsFor = (d) => visibleActivities('deals', d, activities[d.id]);
  const card = (d, settings, ui = {}) => <DealCard deal={d} row={toRow(d)} acts={actsFor(d)} settings={settings} properties={cardProps}
    onQuick={onQuick} menu={dealMenu(d)} onOpen={()=>openDeal(d)} onStub={setStub} {...ui}/>;
  // Card Settings: the shared modal with the Deal card kind; the preview is a real deal's card.
  const sample = deals.find(d => d.health === 'At Risk' && (activities[d.id] || []).length) || deals[0];
  const dealCardKind = {object:'deals', sections:DEAL_CARD_SECTIONS, quickActionLabels:quickActionLabels('deals'),
    tags:DEAL_TAGS, dropdowns:DEAL_DROPDOWNS, smartFeatures:CARD_SMART_FEATURES,
    relatedOptions:(ps) => [...DEAL_RELATED_FIELDS, ...ps.filter(p => !p.extended && !DEAL_RELATED_FIELDS.some(f => f.key === p.key))],
    renderPreview:(draft) => sample && <DealCard deal={sample} row={toRow(sample)} acts={actsFor(sample)} settings={draft} properties={cardProps}/>};

  return (
    /* Laid out exactly as Contacts: no wrapper fill or padding, the page inset toolbar. */
    <div style={{flex:1, minWidth:0, minHeight:0, display:'flex', flexDirection:'column', position:'relative', overflow:'hidden'}}>
      <RecordViewsModule inset="page" schema={fullSchema} rows={rows} columns={props.map(p => p.key)}
        defaultViews={[{id:'dv-all', name:`All ${typePlural('deals', 'Deals')}`, sort:{key:'name', dir:'asc'}}]}
        board={{pipelines, defaultPipelineId:pipelines[0] && pipelines[0].id,
          cardSettings:{defaults:DEFAULT_DEAL_CARD_SETTINGS,
            renderModal:({draft, setDraft, onApply, onClose}) => <CardSettingsModal kind={dealCardKind} draft={draft} setDraft={setDraft}
              properties={cardProps} onApply={onApply} onClose={onClose}/>},
          render:(filtered, {search, pipelineId, cardSettings}) => {
            const pipeline = pipelineOf(pipelineId) || pipelines[0];
            // The board shows the selected pipeline's deals; the filters and search still apply.
            const onBoard = filtered.map(r => byId.get(r.id)).filter(d => d && recordInPipeline(pipeline, d));
            return <ContactBoard rows={onBoard} search={search} pipeline={pipeline} searchKeys={['name']} noun={typeNoun('deals', 'deal')} bulk={dealBulk.board(pipeline)}
              onChangeStage={(id, stageId)=>{
                const d0 = deals.find(d => d.id === id);
                if(d0 && !stageMoveCan('deals', d0)) return hub && hub.toast(`You can't move this ${typeNoun('deals', 'deal')} between stages`);
                setDeals(ds => ds.map(d => d.id === id ? withStage(pipeline, d, stageId) : d));
              }}
              onAddToStage={(pl, stageId)=>setForm({mode:'add', initial:withStage(pl, {}, stageId)})}
              renderCard={(d, ui) => card(d, cardSettings, ui)}/>;
          }}}
        actions={(btn, view) => <>
          <button onClick={view.exportCsv} style={btn}><Icon name="export" size={13} color={T.gray600}/> Export</button>
          <button onClick={()=>setForm({mode:'add', initial:null})} title={`Add ${typeNoun('deals', 'deal')}`} style={toolbarIconButton}><Icon name="plus" size={14} color={T.gray800}/></button>
        </>}
        filterControls={(v) => <ViolationsButton object="deals" pipelines={viewPipelines(v)} active={violationMode} onClick={()=>setViolationMode(!violationMode)}/>}
        overlay={(v) => violationMode && <ViolationPanel object="deals" pipelines={viewPipelines(v)} onClose={()=>setViolationMode(false)}/>}/>
      {form && <ContactFormModal mode={form.mode} initial={form.initial} properties={props} noun={typeNoun('deals', 'deal')}
        canEditField={form.mode === 'edit' ? (p)=>fieldEditCan('deals', form.initial, p) : undefined}
        optionsFor={formOptions} adjust={adjust} association={association} onCancel={()=>setForm(null)} onSave={save}/>}
      {changingOwner && <ChangeOwnerModal record={changingOwner} noun={typeSingular('deals', 'Deal')} users={owners} ownerName={ownerName} onClose={()=>setChangingOwner(null)}
        onSave={(owner) => { changeOwner(changingOwner.id, owner); setChangingOwner(null); }}/>}
      {dealBulk.bulkModal}
      {/* Delete Deal: its activity goes with it; its customers stay, no longer linked to it. */}
      {pendingDelete && <DeleteConfirmModal contactName={pendingDelete.name} noun={typeSingular('deals', 'Deal')} paid={recordHasPayments('deals', pendingDelete.id)}
        note={associatedNote([['customer', 'customers', customersOf(pendingDelete.id).length]], typeNoun('deals', 'deal'))}
        onCancel={()=>setPendingDelete(null)}
        onConfirm={()=>{
          const id = pendingDelete.id;
          setDeals(ds => ds.filter(d => d.id !== id));
          setActivities(m => { const n = {...m}; delete n[id]; return n; });
          onRecordDeleted && onRecordDeleted('deals', id);
          if(detail && detail.id === id) setDetail(null);
          setPendingDelete(null);
          showToast(`${typeSingular('deals', 'Deal')} deleted`);
        }}/>}
      {(() => {
        const dd = detail && byId.get(detail.id);
        if(!dd) return null;
        const row = toRow(dd), acts = actsFor(dd);
        const view = {...row, amountText:dealCardRow(row).amount};
        const contact = contacts.find(c => c.id === dd.contactId) || null;
        const settings = withDealPanelProperties(panelSettings, props);
        // Deal activity: the deal's own (with its contact); Contact activity: its contact's.
        const activityViews = {
          store:{state:activityViewState, setState:setActivityViewState},
          sources:{own:activityFilterRows([{acts, contact, deal:dd}], data)},
          schemaFor:(tabId) => activityFilterSchema(tabId, data),
        };
        return <RecordAccessCtx.Provider value={{object:'deals', record:dd}}><DealDetail key={dd.id} mode={detail.mode} deal={dd} view={view} acts={acts} contact={contact} activityViews={activityViews}
          profiles={profileStore ? profileStore.profiles[profileHolderId('deals', dd)] : undefined} props={props} settings={settings}
          menu={dealMenu(dd, ()=>setPanelDraft(JSON.parse(JSON.stringify(settings))))}
          requestedTab={detail.tab} team={owners.map(u => u.name)}
          customers={customersOf(dd.id).map(c => customerListRow(c, data))} onOpenCustomer={(x)=>onOpenCustomer && onOpenCustomer(x.id, detail.mode)}
          onQuick={(key)=>onQuick(key, dd)}
          onOpenContact={(c)=>onOpenContact ? onOpenContact(c.id, detail.mode) : setStub(c.name)} onCopied={showToast}
          onCreateProfile={(c, templateId)=>{
            // The holder's latest call (Sales Notes, transcript) feeds the profile: the contact's — a lead's own where it holds the profile.
            const lastCall = (contactActivities[c.id] || (c.id === dd.id ? acts : []) || []).find(a => a.type === 'call' && ((a.transcript && a.transcript.length) || a.notes));
            setProfileRun({contactId:c.id, dealId:dd.id, templateIds: templateId ? [templateId] : undefined,
              call: lastCall ? {id:lastCall.id, segments:lastCall.transcript || [], notes:lastCall.notes || '', startedAt:lastCall.at} : null});
          }}
          onStub={setStub} onClose={closeDetail}
          onExpand={()=>setDetail(x => ({id:dd.id, mode:'full', returnTo:x && x.returnTo}))} onCollapse={()=>setDetail(x => ({id:dd.id, mode:'panel', returnTo:x && x.returnTo}))}
          onUpdateActivity={(id, actId, patch)=> updateContactActivity && !acts.some(a => a.id === actId)
            ? updateContactActivity(actId, patch)   // the contact's activity (Contact activity view) is saved on the contact
            // A deal's activity goes through the workflow engine, so activity triggers see it.
            : engineCtx ? engineCtx.api.updateDealActivity(actId, patch) : setActivities(m => ({...m, [id]:(m[id] || []).map(a => a.id === actId ? {...a, ...patch} : a)}))}
          onAddActivity={(id, act)=> engineCtx ? engineCtx.api.addDealActivity(id, act)
            : setActivities(m => ({...m, [id]:[{id:`${act.type}-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, dealId:id, at:new Date(), ...act}, ...(m[id] || [])]}))}
          onReassignOwner={(id, name)=>{ const u = owners.find(x => x.name === name); if(u) changeOwner(id, u.id); }}/></RecordAccessCtx.Provider>;
      })()}
      {panelDraft && (() => {
        const dd = detail && byId.get(detail.id);
        const kind = dealPanelKind(props, (draft) => dd && (() => {
          const row = toRow(dd), view = {...row, amountText:dealCardRow(row).amount}, c = contacts.find(x => x.id === dd.contactId) || null;
          // The name row too, as in the Contact preview, so the Avatar subtitle shows.
          return <div style={{display:'flex', flexDirection:'column', gap:12}}>
            <DealNameRow deal={dd} subtitle={dealSubtitle(dd, view, c, draft)}/>
            <DealDetailBody deal={dd} view={view} acts={actsFor(dd)}
              contact={c} settings={draft} props={props} onQuick={()=>{}} onOpenContact={()=>{}} onStub={()=>{}} onCopied={()=>{}}/>
          </div>;
        })());
        return <PanelSettingsModal kind={kind} draft={panelDraft} setDraft={setPanelDraft} onClose={()=>setPanelDraft(null)}
          onApply={()=>{ setPanelSettings(panelDraft); setPanelDraft(null); }}/>;
      })()}
      {(() => {
        const rc = profileRun && (contacts.find(c => c.id === profileRun.contactId) || byId.get(profileRun.contactId));
        if(!rc || !profileStore) return null;
        return <ProfileFormFill contact={rc} call={profileRun.call} formId={(profileRun.templateIds || [])[0]}
          onCancel={()=>setProfileRun(null)}
          onSave={(summary)=>{
            setDetail({id:profileRun.dealId, mode:'full', tab:{id:'profile', nonce:Date.now()}});
            setProfileRun(null);
            showToast(`Customer Profile saved · ${summary.formName}`);
          }}/>;
      })()}
      <CopyToast message={toast}/>
      {stub && <StubPanel title={stub} onClose={()=>setStub(null)} zIndex={110}/>}
    </div>
  );
}

Object.assign(window, {pipelineFormOptions, pipelineFormAdjust, RecordCard, DealCard, DEAL_RECORD_KIND, dealCardRow, DEAL_DROPDOWNS, DEAL_CARD_SECTIONS, dealCardProperties, DEAL_TAGS, DEAL_RELATED_FIELDS, dealFormOptions, dealFormAdjust, dealRowOf, dealFilterSchema, withWorkflowSampleCalls, DealsModule, SAMPLE_DEALS, SAMPLE_DEAL_ACTIVITIES, DEFAULT_DEAL_CARD_SETTINGS, DEAL_CURRENCY});
