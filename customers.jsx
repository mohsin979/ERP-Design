/* HOF Pulse ERP — Customers (CRM → Sales → Customers).

   The Customer object at parity with Deals, on the same infrastructure: columns, filters and the
   creation form are built from the Customer properties (Settings → Properties); the page is the
   record view system (RecordViewsModule: views, View Settings, Save View, search, Filters with
   the associated Contacts and Deals, Table Settings, the grid) with the Board, grouped by the
   selected Customer pipeline's stages (Canada & AUS Service, USA NIW - Service). The card is the shared
   record card (RecordCard, Card Settings), the record is the Deal record's shell (side panel ⇄
   full screen, View Settings, workspace tabs with activity views).

   Relationships (Settings → Objects) — every link optional, each record exists on its own:
     Contacts → Customers One-to-many: a customer has at most one contact (`contactId`).
     Deals → Customers    One-to-many: a customer's deal (`dealIds`, none or one); a deal can have many customers.
   Create Customer on a contact or a deal makes a customer linked to it (CustomerFormModal, App);
   Create Deal on a customer without a deal makes its deal (then Go to Deal opens it), with the customer's
   contact. The Add / Edit form picks the contact and deals from existing records.

   Customer Owner is a user (stored by ID); each change is recorded as an owner-change activity
   (App). Export downloads the current view as CSV. Not defined yet (placeholder): Enrich, calling, email and meetings, what Smart
   Actions recommend. */

/* ── Sample customers ── people (and one company) a sale turned into customers, each in the
   service pipeline of its deal (US NIW → USA NIW - Service; Australia and Canada → Canada & AUS
   Service; no deal → Canada & AUS Service), at a stage of that service. Each is linked to the sample contact it came from (Contacts → Customers,
   one-to-many: Mahnoor Aziz and Ali Raza Shah each have two) and to their deal (Deals →
   Customers, one-to-many: deals 9, 18 and 8 have several customers). Areeba Qureshi has no deal; the Holdings company has no contact. */
const SAMPLE_CUSTOMERS = () => {
  const at = (m, d, h = 10) => storePropertyValue('Date & time', new Date(2026, m - 1, d, h, 30));
  const contact = (name) => SAMPLE_CONTACTS.find(c => c.name === name) || null;
  const cust = (n, name, contactName, dealIds, pipeline, stage, owner, created, own = {}) => {
    const c = contactName ? contact(contactName) : null;
    /* Mocked: Customer Status (Closed once the service closed, Active otherwise), Customer Source
       (the deal or contact it came from), Customer Since and Associated Company (its contact's). */
    const pl = DEFAULT_PIPELINES().find(x => x.id === pipeline), st = pl && pl.stages.find(x => x.id === stage);
    return {id:`cust-${n}`, name, email:own.email ?? (c && name === c.name ? c.email : ''), phone:own.phone ?? (c && name === c.name ? c.phone : ''),
      owner, pipeline, stage, status:own.status || (st && isClosedStage(st) ? 'Closed' : 'Active'), source:dealIds.length ? 'Deal' : 'Contact',
      customerSince:dateOnly(created), company:own.company ?? (c ? c.company || '' : ''), contactId:c ? c.id : null, dealIds, created};
  };
  const NIW = 'usa-niw-service', CA = 'canada-aus-service';
  return [
    cust(1,  'Mahnoor Aziz',            'Mahnoor Aziz',     ['deal-9'],            NIW, 'phase-1-document-collection', 'waleed-bin-zaman', at(9, 30)),
    cust(2,  'Usman Aziz',              'Mahnoor Aziz',     ['deal-9'],            NIW, 'iee',                         'waleed-bin-zaman', at(9, 30, 11), {email:'usman.aziz@gmail.com', phone:'+92 300 6677112'}),
    cust(3,  'Rabia Farooq',            'Rabia Farooq',     ['deal-10'],           NIW, 'welcome-call',                'ali-noor',         at(10, 3)),
    cust(4,  'Ali Raza Shah',           'Ali Raza Shah',    ['deal-18'],           CA,  'ielts',                       'asim-ali',         at(9, 26)),
    cust(5,  'Ayesha Raza Shah',        'Ali Raza Shah',    ['deal-18'],           CA,  'spouse-sponsorship',          'asim-ali',         at(9, 26, 12), {email:'ayesha.razashah@gmail.com', phone:'+92 333 7720199'}),
    cust(6,  'Shahzaib Gillani',        'Shahzaib Gillani', ['deal-28'],           CA,  'eca',                         'ali-noor',         at(9, 29)),
    cust(7,  'Imran Sheikh',            'Imran Sheikh',     ['deal-8'],            NIW, 'brainstorming',               'asim-ali',         at(9, 2)),
    cust(8,  'Hamid Latif',             'Hamid Latif',      ['deal-17'],           CA,  'express-entry-pnp',           'ali-noor',         at(9, 4), {status:'On Hold'}),
    cust(9,  'Sheikh & Latif Holdings', null,               ['deal-8'],            NIW, 'forms-filing',                'asim-ali',         at(9, 6), {email:'accounts@sheikhlatif.com', phone:'+92 42 3571 8800', company:'Sheikh & Latif Holdings'}),
    cust(10, 'Mariam Khalid',           'Mariam Khalid',    ['deal-27'],           CA,  'initial-welcome-call',        'anaya-malik',      at(9, 12)),
    cust(11, 'Areeba Qureshi',          'Areeba Qureshi',   [],                    CA,  'completely-closed',           'aaliyah-khan',     at(6, 12)),
  ];
};
// Sample activity per customer, from the same mock generator as Contacts and Deals.
const SAMPLE_CUSTOMER_ACTIVITIES = (customers, users) => {
  const nameOf = (id) => (users.find(u => u.id === id) || {}).name || '';
  const day = (d) => d.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric', timeZone:LOCAL_TZ});
  const seeds = customers.map((c, i) => {
    const created = new Date(c.created), touch = new Date(Math.min(new Date(2026, 9, 7), created.getTime() + (4 + (i * 3) % 12) * 86400000));
    return {id:900 + i, created:day(created), lastContacted:day(touch), owner:nameOf(c.owner)};
  });
  const gen = generateActivities(seeds);
  return Object.fromEntries(customers.map((c, i) => [c.id, (gen[900 + i] || []).map(a => ({...a, id:`${c.id}-${a.id}`, contactId:undefined, customerId:c.id}))]));
};
/* A customer saved in an earlier shape: one deal (`dealId`) becomes `dealIds` (several: the first), several contacts
   (`contactIds`) become one (`contactId`, the first — Contacts → Customers is one-to-many), and a
   customer without a pipeline (or in one that was removed, Customer Lifecycle) joins the service
   pipeline of its first deal (CUSTOMER_PIPELINE_FOR_DEAL), else the first Customer pipeline — at
   its first stage. `deals`: the deal records. */
const migrateCustomer = (c, pipelines, deals = []) => {
  const {dealId, contactIds, ...rest} = c;
  // Deals → Customers is One-to-many: a customer on several deals keeps the first.
  const dealIds = (c.dealIds || (dealId != null ? [dealId] : [])).slice(0, 1);
  const contactId = c.contactId !== undefined ? c.contactId : (contactIds && contactIds.length ? contactIds[0] : null);
  const firstDeal = deals.find(d => dealIds.includes(d.id));
  const byDeal = firstDeal && (pipelines || []).find(p => p.id === CUSTOMER_PIPELINE_FOR_DEAL[firstDeal.pipeline]);
  const pl = (pipelines || []).find(p => p.id === c.pipeline) || byDeal || (pipelines || [])[0];
  const stage = pl && pl.stages.some(st => st.id === c.stage) ? c.stage : (pl && pl.stages[0] ? pl.stages[0].id : '');
  return {...rest, dealIds, contactId, pipeline: pl ? pl.id : '', stage};
};

const CUSTOMER_TABS = [
  {id:'overview', label:'Overview',         icon:'overview',    list:false},
  {id:'profile',  label:'Customer Profile', icon:'profile',     list:false},
  {id:'calls',    label:'Calls',            icon:'call',        list:true},
  {id:'notes',    label:'Notes',            icon:'notepad',     list:true},
  {id:'email',    label:'Emails',            icon:'envelope',    list:true},
  {id:'tasks',    label:'Tasks',            icon:'tasks',       list:true},
  {id:'meetings', label:'Meetings',         icon:'videoCamera', list:true},
  {id:'files',    label:'Files',            icon:'folder',      list:true},
  {id:'quotes',   label:'Quotes',           icon:'quote',       list:true},
  {id:'accounting', label:'Accounting',     icon:'coins',       list:false},
  {id:'contacts', label:'Contacts',         icon:'contacts',    list:true},
  {id:'deals',    label:'Deals',            icon:'deals',       list:true},
];

/* A customer as a list / filter row: names and labels for its pipeline, stage and owner (the
   customer keeps ids), its contact's name and its deals' names. */
const customerRowOf = (data, c, contacts = [], deals = []) => {
  const pl = objectPipelines(data, 'customers').find(p => p.id === c.pipeline);
  const contact = c.contactId != null ? contacts.find(x => x.id === c.contactId) : null;
  return {...c, pipeline:(pl || {}).label || '', stage:((pl && pl.stages.find(st => st.id === c.stage)) || {}).label || '', owner:userLabel(c.owner),
    contact:contact ? contact.name : '', deals:(c.dealIds || []).map(id => (deals.find(d => d.id === id) || {}).name).filter(Boolean).join(', ')};
};
// A customer as a row in a contact's or deal's Customers tab.
const customerListRow = (c, data) => {
  const pl = data && objectPipelines(data, 'customers').find(p => p.id === c.pipeline);
  return {...c, owner:userLabel(c.owner), stage:pl ? ((pl.stages.find(st => st.id === c.stage)) || {}).label || '' : c.stage};
};
const ASSOCIATED_CUSTOMER_COLUMNS = [
  {key:'name', label:'Customer Name', width:'1.2fr'}, {key:'stage', label:'Customer Stage'}, {key:'email', label:'Email', width:'1.4fr'}, {key:'owner', label:'Customer Owner'},
];
const customerCopyText = (c) => [c.name, c.phone, c.email].filter(Boolean).join('\n');
function customerSchema(props, pipelines, users){
  return {
    // Money (Deal Amount, a Currency property) reads right-aligned.
    properties:props.map(p => ({key:p.key, label:p.label, width:p.width || 170, money:p.key === 'amount' || (propertyTypeId(p.type) === 'Currency' && !p.currencyOnly)})),
    filterProps:props.map(propertyFilterMeta),
    selectValues:{
      // The Pipeline property's values: the record's own (manual) pipelines.
      pipeline:pipelines.filter(p => p.source !== 'property').map(p => p.label),
      stage:[...new Set(pipelines.filter(p => p.source !== 'property').flatMap(p => p.stages.map(st => st.label)))],
      owner:users.map(u => u.name),
      ...Object.fromEntries(props.filter(p => p.options).map(p => [p.key, p.options])),
    },
    noun:'customer', searchKeys:['name', 'email', 'owner'],
  };
}
// The Customers filters — Customers' own, and the Customer filters on Contacts and Deals.
const customerFilterSchema = (data) => customerSchema(objectFormProperties(data, 'customers'), objectPipelines(data, 'customers'), data.users.filter(u => u.status === 'Activated'));

/* ── Customer card ── the shared record card (RecordCard) with the Customer's sections: no tags
   are defined for Customers. */
const CUSTOMER_CARD_SECTIONS = {
  quickActions:      'Quick Actions',
  properties:        'Properties',
  smartFeatures:     'Smart Features',
  dropdowns:         'Dropdowns',
  relatedProperties: 'Related Properties',
};
const CUSTOMER_RELATED_FIELDS = [
  {key:'owner',         label:'Customer Owner'},
  {key:'ownerAssigned', label:'Owner Assignment Date'},
];
// Card properties: every Customer property but Customer Name (always on top), and its associated contact and deals.
const customerCardProperties = (props) => [...props.filter(p => p.key !== 'name').map(p => ({key:p.key, label:p.label})),
  ...(workspaceHasType('contacts') ? [{key:'contact', label:'Associated Contact'}] : []), {key:'deals', label:`Associated ${typePlural('deals', 'Deals')}`}];
const DEFAULT_CUSTOMER_CARD_SETTINGS = () => ({
  order: ['quickActions', 'properties', 'smartFeatures', 'dropdowns', 'relatedProperties'],
  quickActions: defaultQuickActions('customers'),
  tags: {},
  properties: ['stage', 'owner', 'contact', 'deals', 'created'].filter(key => key !== 'contact' || workspaceHasType('contacts')).map(key => ({key, enabled:true})),
  smartFeatures: {summary:false, actions:false},
  dropdowns: DEAL_DROPDOWNS.map(dd => ({key:dd.key, enabled:dd.key === 'all', count:5})),
  relatedProperties: {rows:[{id:'r1', left:'owner', right:'ownerAssigned'}]},
});
const CUSTOMER_RECORD_KIND = {object:'customers', noun:'customer', dataAttr:'data-customer-id', defaults:() => DEFAULT_CUSTOMER_CARD_SETTINGS(), dropdowns:DEAL_DROPDOWNS, cardRow:(row) => row};

/* ── Side panel sections and View Settings ── as on a deal. */
const CUSTOMER_PANEL_SECTIONS = {
  avatarSubtitle:     'Avatar subtitle',
  quickActions:       'Quick Actions',
  smartSummary:       'Smart Summary',
  dropdowns:          'Dropdowns',
  customerProperties: 'Customer Properties',
};
/* Customer Properties: the owner and its dates, pipeline and stage, the system dates, the
   associated contact and deals (each opens its record), then the custom Customer properties.
   Email and Phone Number lead the panel. */
const CUSTOMER_PANEL_BASE_PROPERTIES = [
  {key:'owner',         label:'Customer Owner'},
  {key:'ownerAssigned', label:'Owner Assignment Date'},
  {key:'ownerChanged',  label:'Owner Change Date'},
  {key:'pipeline',      label:'Pipeline'},
  {key:'stage',         label:'Customer Stage'},
  {key:'profileType',   label:'Customer Profile Type'},
  {key:'created',       label:'Created Date'},
  {key:'lastActivity',  label:'Last Activity Date'},
  {key:'contact',       label:'Associated Contact'},
  {key:'deals',         label:'Associated Deals'},
];
// Labels from Settings; every other Customer property follows (name, email and phone head the panel).
const customerPanelProperties = (props) => {
  const prop = (k) => (props || []).find(p => p.key === k);
  // Without Contacts in the workspace, no Associated Contact.
  const base = CUSTOMER_PANEL_BASE_PROPERTIES.filter(p => workspaceHasType('contacts') || p.key !== 'contact').map(p => ({key:p.key, label:(prop(p.key) || p).label}));
  return [...base, ...(props || []).filter(p => !['name', 'email', 'phone'].includes(p.key) && !base.some(b => b.key === p.key)).map(p => ({key:p.key, label:p.label}))];
};
const customerSubtitleOptions = (props) => customerPanelProperties(props).filter(p => !['ownerAssigned', 'ownerChanged', 'lastActivity', 'nextActivity'].includes(p.key)).map(p => ({value:p.key, label:p.label}));
const customerSubtitle = (customer, view, settings) => {
  const k = settings.subtitle;
  if(!k) return '';
  const v = ['owner', 'pipeline', 'stage', 'contact', 'deals'].includes(k) ? view[k] : customer[k];
  return v == null ? '' : String(v);
};
const defaultCustomerPanelSettings = (props) => ({
  subtitle: 'stage',
  order: ['quickActions', 'smartSummary', 'dropdowns', 'customerProperties'],
  quickActions: defaultQuickActions('customers'),
  smartSummary: {enabled:true},
  dropdowns: [{id:'d-all', type:'all', enabled:true, count:10}],
  customerProperties: customerPanelProperties(props).map(p => ({key:p.key, enabled:true})),
});
// A custom property added since the settings were saved joins the end, shown.
const withCustomerPanelProperties = (settings, props) => {
  const known = settings.customerProperties.map(p => p.key);
  const added = customerPanelProperties(props).filter(p => !known.includes(p.key)).map(p => ({key:p.key, enabled:true}));
  return added.length ? {...settings, customerProperties:[...settings.customerProperties, ...added]} : settings;
};
const customerPanelKind = (props, renderPreview) => ({
  object:'customers', sections:CUSTOMER_PANEL_SECTIONS, quickActionLabels:quickActionLabels('customers'),
  subtitleOptions:customerSubtitleOptions(props),
  dropdowns:DEAL_DROPDOWNS, propertiesKey:'customerProperties', properties:customerPanelProperties(props), renderPreview,
});

/* Add / Edit Customer — the Object's form, with its associated records picked from existing ones:
   Associated Contact and Associated Deal — any contact, any deal (each has many customers); one of
   each, or none. `links` ({contactId,
   dealIds}): where it starts — Create Customer on a contact or deal starts linked to it.
   onSave(values, {contactId, dealIds}). */
function CustomerFormModal({data, mode = 'add', initial, links, contacts = [], deals = [], onCancel, onSave}){
  const pipelines = recordPipelines(data, 'customers');
  // One Customer pipeline: it's the one a new customer joins.
  const start = mode === 'add' && pipelines.length === 1 && !(initial && initial.pipeline) ? {...(initial || {}), pipeline:pipelines[0].id} : initial;
  // The workspace's record types only, by their names (HOF Partners: no Contacts; its Deals are Leads).
  const linkFields = [
    ...(workspaceHasType('contacts') ? [{key:'contactId', noun:'contact', options:contacts.map(c => ({value:c.id, label:c.email ? `${c.name} · ${c.email}` : c.name}))}] : []),
    ...(workspaceHasType('deals') ? [{key:'dealId', noun:typeNoun('deals', 'deal'), options:deals.map(d => ({value:d.id, label:d.name}))}] : []),
  ];
  return <ContactFormModal mode={mode} initial={start} properties={objectFormProperties(data, 'customers')} noun="customer"
    canEditField={mode === 'edit' ? (p)=>fieldEditCan('customers', initial, p) : undefined}
    optionsFor={pipelineFormOptions(data, 'customers')} adjust={pipelineFormAdjust(data, 'customers')}
    links={linkFields} initialLinks={{contactId:(links && links.contactId) ?? null, dealId:((links && links.dealIds) || [])[0] ?? null}}
    onCancel={onCancel} onSave={(vals, _assoc, l) => onSave(vals, {contactId:l.contactId ?? null, dealIds:l.dealId != null ? [l.dealId] : []})}/>;
}

/* The customer ⋯ menu — the one record menu (StandardRecordMenu): the tools · Create Deal while
   the customer has no deal, then Go to Deal (its parent deal — a customer has one) · Copy Email, Edit Customer, Edit Customer Owner,
   Copy Phone Number, Copy Customer, Enrich Customer · View settings · Delete Customer. */
function CustomerActionsMenu({customer, onTool, onCreateDeal, onGoToDeal, onEdit, onOwner, onEnrich, onDelete, onCopied, onViewSettings, visible}){
  return (
    <StandardRecordMenu object="customers" record={customer} noun="Customer" email={customer.email} phone={customer.phone} copyText={customerCopyText(customer)}
      onTool={onTool} onCreateDeal={customerHasDeal(customer) ? undefined : onCreateDeal} onGoToDeal={customerHasDeal(customer) ? onGoToDeal : undefined} onEdit={onEdit} onOwner={onOwner} onEnrich={onEnrich}
      onDelete={onDelete} onCopied={onCopied} onViewSettings={onViewSettings} visible={visible}/>
  );
}

/* ── Record detail ─────────────────────────────────────────────────────────────────────── */

function CustomerNameRow({customer, subtitle, headerActions}){
  return (
    <div style={{display:'flex', alignItems:'center', gap:10, minWidth:0}}>
      <span style={{width:36, height:36, borderRadius:9999, background:T.attioText, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center'}}>
        <Icon name="customers" size={17} color="#fff"/>
      </span>
      <div style={{minWidth:0, flex:1}}>
        <div style={{fontSize:17, fontWeight:600, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{customer.name}</div>
        {subtitle && <div style={{fontSize:12.5, color:T.attioMuted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{subtitle}</div>}
      </div>
      {headerActions && <div style={{display:'flex', alignItems:'center', gap:2, flexShrink:0}}>{headerActions}</div>}
    </div>
  );
}
function CustomerInfo({customer, view, acts, contact, deals, keys, props, onOpenDeal, onOpenContact, onStub}){
  const owner = ownerDates({owner:view.owner, created:dateOnly(customer.created)}, acts);
  const hub = useRecordHub();
  const rows = {
    owner:         {value:view.owner, owner:true},
    ownerAssigned: {value:owner.assigned},
    ownerChanged:  {value:owner.changed},
    pipeline:      {value:view.pipeline},
    stage:         {value:view.stage},
    created:       {value:customer.created},
    lastActivity:  {value:latestActivityDate(acts)},
    nextActivity:  {value:nextActivityDate(acts)},
    contact:       {value:contact && contact.name, open:() => contact && onOpenContact(contact)},
    deals:         {value:deals.length ? deals : null, list:true},
  };
  const labels = Object.fromEntries(customerPanelProperties(props).map(p => [p.key, p.label]));
  const shown = keys.filter(k => labels[k]);
  if(!shown.length) return null;
  return (
    <div>
      <div style={{marginBottom:6}}>
        <span style={{fontSize:11, fontWeight:600, color:T.attioFaint, textTransform:'uppercase', letterSpacing:.4}}>Customer Properties</span>
      </div>
      {shown.map(k => {
        const r = rows[k] || {value:customer[k]};   // custom Customer properties: the stored value
        // Editable properties: in place (hover → edit icon); the worked-out rows keep their display.
        const spec = panelEditSpec(hub, 'customers', customer, k);
        return (
          <div key={k} style={{display:'flex', alignItems:'baseline', gap:12, padding:'7px 0', borderBottom:`1px solid ${T.attioLine}`, minHeight:32}}>
            <PropertyRowLabel k={k} label={labels[k]}/>
            {k === 'profileType' ? <ProfileTypeValue contactId={profileHolderId('customers', customer)}/>
              : spec ? <PanelEditableValue spec={spec} display={rows[k] ? (r.value == null ? '' : String(r.value)) : undefined}/>
              : r.owner ? <OwnerValue object="customers" record={customer} name={r.value}/>
              : !r.value ? <span style={{fontSize:13, color:T.attioFaint}}>—</span>
              : r.list ? <AssociatedRecordsValue records={r.value} noun="deal" onOpen={(d)=>onOpenDeal(d)}/>
              : r.open ? <button onClick={r.open} style={linkButton}>{r.value}</button>
              : <span style={{fontSize:13, color:T.attioText, minWidth:0, overflowWrap:'anywhere'}}>{dateShown(String(r.value))}</span>}
          </div>
        );
      })}
    </div>
  );
}
// The customer's own email and phone lead the body.
function CustomerDetailBody({customer, view, acts, contact, deals, settings, props, onQuick, onOpenDeal, onOpenContact, onStub, onCopied}){
  return <RecordDetailBody object="customers" record={customer} view={view} acts={acts} email={customer.email} phone={customer.phone}
    settings={settings} dropdowns={DEAL_DROPDOWNS} propertiesKey="customerProperties" onQuick={onQuick} onStub={onStub} onCopied={onCopied}
    info={(keys) => <CustomerInfo customer={customer} view={view} acts={acts} contact={contact} deals={deals} props={props} keys={keys}
      onOpenDeal={onOpenDeal} onOpenContact={onOpenContact} onStub={onStub}/>}/>;
}

/* The workspace tabs, as on a deal: Customer Profile is the associated contact's profile (one per
   person — without Contacts, HOF Partners, its lead's); Contacts and Deals list its associated records. */
function CustomerDetail({mode, customer, view, acts, contact, deals, data, profiles, props, settings, menu, requestedTab, team, activityViews,
                         onQuick, onOpenDeal, onOpenContact, onCreateProfile, onStub, onCopied, onClose, onExpand, onCollapse, onUpdateActivity, onAddActivity, onReassignOwner}){
  /* Whose profile: the associated contact's — or, without Contacts (HOF Partners), its lead's (the
     customer was made from it: one person), else the customer's own (board.jsx profileHolderId). */
  const holderId = profileHolderId('customers', customer);
  const profileOwner = contact || (holderId == null ? null : holderId === customer.id ? customer : deals.find(d => d.id === holderId) || customer);
  const renderTab = (tab, openTab, q) => {
    if(tab.id === 'profile') return profileOwner
      ? <CustomerProfileTab contact={profileOwner} profiles={profiles} onCall={()=>onStub('Call')}
          onCreate={(templateId)=>onCreateProfile(profileOwner, templateId)} onStub={onStub}/>
      : <div style={{padding:'40px 24px', textAlign:'center', fontSize:13, color:T.gray400}}>This customer has no contact, so it has no Customer Profile.</div>;
    if(tab.id === 'deals') return <AssociatedRecords columns={ASSOCIATED_DEAL_COLUMNS} rows={deals.map(d => dealListRow(data, d))} q={q}
      onOpen={(d)=>onOpenDeal(d)} empty={`No ${typePlural('deals', 'Deals').toLowerCase()} for this customer`}/>;
    if(tab.id === 'contacts') return <AssociatedRecords columns={ASSOCIATED_CONTACT_COLUMNS} rows={contact ? [contactView(contact)] : []} q={q}
      onOpen={(c)=>onOpenContact(c)} empty="No contacts for this customer"/>;
    return undefined;
  };
  return (
    <ContactDetail mode={mode} contact={view} acts={acts} onClose={onClose} onExpand={onExpand} onCollapse={onCollapse} onStub={onStub}
      backLabel="Customers"
      renderName={(headerActions) => <CustomerNameRow customer={customer} subtitle={customerSubtitle(customer, view, settings)} headerActions={headerActions}/>}
      menu={menu}
      body={<CustomerDetailBody customer={customer} view={view} acts={acts} contact={contact} deals={deals} settings={settings} props={props}
        onQuick={onQuick} onOpenDeal={onOpenDeal} onOpenContact={onOpenContact} onStub={onStub} onCopied={onCopied}/>}
      workspace={<ContactWorkspace contact={view} acts={acts} onStub={onStub} requestedTab={requestedTab}
        team={team} onUpdateActivity={onUpdateActivity} onAddActivity={onAddActivity} onReassignOwner={onReassignOwner}
        tabs={CUSTOMER_TABS.filter(t => workspaceHasType(t.id === 'contacts' ? 'contacts' : t.id === 'deals' ? 'deals' : 'customers'))
          .map(t => t.id === 'deals' ? {...t, label:typePlural('deals', 'Deals')} : t)} renderTab={renderTab} activityViews={activityViews}/>}/>
  );
}

/* ── Customers page ────────────────────────────────────────────────────────────────────── */

/* `deals`, `contacts`: the shared records (App); `contactActivities`, `profileStore`: the contact's
   activity and Customer Profiles. `onAddCustomer(values, links)`: saves a new customer (App).
   `onCreateDeal(vals, contactId)`: a new deal (App), which Create Deal links the customer to.
   `openRequest` ({id, mode, tab, nonce}) opens a customer from elsewhere. Owner changes are
   recorded by App's setCustomers; a customer's activity goes through `addActivity` /
   `updateActivity` (App) when given. */
function CustomersModule({data, customers, setCustomers, activities, setActivities, deals = [], contacts = [], contactActivities = {}, profileStore, openRequest,
                          onOpenDeal, onOpenContact, onAddCustomer, onCreateDeal, onRecordDeleted, updateContactActivity, addActivity:addActivityProp, updateActivity:updateActivityProp}){
  const props = React.useMemo(()=>objectFormProperties(data, 'customers'), [data.properties]);
  const pipelines = React.useMemo(()=>objectPipelines(data, 'customers'), [data.pipelines]);
  // Card properties: the Customer's own, then the Customer Profile and Accounting Properties (extendedProps.jsx).
  const cardProps = React.useMemo(()=>[...customerCardProperties(props), ...extendedProps()], [props]);
  const owners = data.users.filter(u => u.status === 'Activated');
  const pipelineOf = (id) => pipelines.find(p => p.id === id);
  const [detail, setDetail] = React.useState(null);   // {id, mode:'panel'|'full', tab?, returnTo?}
  const [form, setForm] = React.useState(null);       // {mode:'add'|'edit', id?, initial}
  const [changingOwner, setChangingOwner] = React.useState(null);
  const [pendingDelete, setPendingDelete] = React.useState(null);
  const [creatingDeal, setCreatingDeal] = React.useState(null);   // the customer a deal is being created for
  const [panelSettings, setPanelSettings] = usePersistedState('panel:customers', () => defaultCustomerPanelSettings(props));
  const [panelDraft, setPanelDraft] = React.useState(null);
  const [activityViewState, setActivityViewState] = React.useState({});
  const [profileRun, setProfileRun] = React.useState(null);   // {contactId, customerId, templateIds, call}
  const [stub, setStub] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const toastTimer = React.useRef(null);
  const showToast = (message, action) => { setToast({message, action}); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(()=>setToast(null), action ? TOAST_ACTION_MS : TOAST_MS); };
  // Violation Mode: the customers' violations list over the right side, as on Deals.
  const engineCtx = useWorkflowEngineCtx();
  const hub = useRecordHub();
  // The Object whose violations list is open (one at a time).
  const violationMode = !!engineCtx && engineCtx.violationMode === 'customers';
  const setViolationMode = (on) => engineCtx && engineCtx.setViolationMode(on ? 'customers' : false);
  React.useEffect(() => () => engineCtx && engineCtx.setViolationMode(m => m === 'customers' ? false : m), []);

  const byId = React.useMemo(()=>new Map(customers.map(c => [c.id, c])), [customers]);
  const contactOf = (c) => { const x = byId.get(c.id) || c; return x.contactId != null ? contacts.find(k => k.id === x.contactId) || null : null; };
  const dealsOf = (c) => ((byId.get(c.id) || c).dealIds || []).map(id => deals.find(d => d.id === id)).filter(Boolean);
  const actsFor = (c) => visibleActivities('customers', c, activities[c.id]);
  const toRow = (c) => customerRowOf(data, c, contacts, deals);
  /* Filter by associated object → Contacts (every Contact filter property, read from the
     customer's contact) and → Deals (whether it has deals, and every Deal filter property: a
     customer matches when any of its deals does). */
  const contactAssoc = React.useMemo(()=>assocFilterSchema('Contacts', 'Contact', customContactSchema(objectFormProperties(data, 'contacts'))), [data.properties]);
  // Named as the workspace names Deals (HOF Partners: Leads); the filter keys stay 'Deals'.
  const dealAssoc = React.useMemo(()=>assocFilterSchema('Deals', typeSingular('deals', 'Deal'), dealFilterSchema(data), `Has associated ${typePlural('deals', 'Deals').toLowerCase()}`, typePlural('deals', 'Deals')),
    [data.properties, data.pipelines, data.users, data.objects]);
  const rows = React.useMemo(()=>customers.map(c => {
    const k = contactOf(c);
    // With the worked-out Customer properties (Associated Contact / Deal come with the row).
    const row = {...toRow(c), lastActivity:latestActivityDate((activities || {})[c.id]), nextActivity:nextActivityDate((activities || {})[c.id])};
    return withAssocRecords(withAssocRecords(row, 'Contacts', k ? [contactView(k)] : []), 'Deals', dealsOf(c).map(d => dealRowOf(data, d)));
  }), [customers, pipelines, data.users, contacts, deals, activities]);
  const schema = React.useMemo(()=>withScopeFilters(withAssocFilters(withAssocFilters(customerSchema(props, pipelines, owners), contactAssoc), dealAssoc), data, 'customers'), [props, pipelines, data, contactAssoc, dealAssoc]);

  const openCustomer = (c) => setDetail(x => ({id:c.id, mode: x && x.mode === 'full' ? 'full' : 'panel', returnTo: x && x.returnTo}));
  React.useEffect(() => {
    if(openRequest && byId.has(openRequest.id)) setDetail({id:openRequest.id, mode:openRequest.mode || 'panel',
      tab: openRequest.tab ? {...(typeof openRequest.tab === 'string' ? {id:openRequest.tab} : openRequest.tab), nonce:openRequest.nonce} : undefined,
      returnTo: openRequest.onReturn || null});
  }, [openRequest && openRequest.nonce]);
  const closeDetail = () => { const back = detail && detail.returnTo; setDetail(null); if(back) back(); };

  const updateCustomer = (id, patch) => setCustomers(cs => cs.map(c => c.id === id ? {...c, ...patch} : c));
  /* Tools: Task and Note open the customer on that tab with its form; File and Quote, on the Files
     and Quotes tabs. Calling, Email and Meeting aren't defined yet (placeholder). */
  const toolAction = (key, c) => {
    // Call: the call window; Email: the composer; Quote: a new quotation (recordHub.jsx).
    if(hub && key === 'call') return hub.startCall({object:'customers', id:c.id});
    if(hub && key === 'email') return hub.composeEmail({object:'customers', id:c.id});
    if(hub && key === 'quote') return hub.newQuote({object:'customers', id:c.id});
    const tab = {task:{id:'tasks', adding:'Task'}, note:{id:'notes', adding:'Note'}, file:{id:'files'}, meeting:{id:'meetings', adding:'Schedule Meeting'}}[key];
    if(!tab) return setStub(`${({call:'Call', email:'Email', meeting:'Meeting', quote:'Quote'})[key]} · ${c.name}`);
    setDetail(x => ({id:c.id, mode:'full', tab:{...tab, nonce:Date.now()}, returnTo: x && x.returnTo}));
  };
  // Go to Deal: the customer's parent deal, opened in the mode the customer is open in.
  const goToDeal = (c) => { const id = (c.dealIds || [])[0]; if(id && onOpenDeal) onOpenDeal(id, detail && detail.id === c.id ? detail.mode : 'panel'); };
  const menu = (c, onViewSettings) => {
    const rec = byId.get(c.id) || c;
    return <CustomerActionsMenu customer={rec} onTool={(k)=>toolAction(k, rec)}
      onCreateDeal={onCreateDeal ? ()=>setCreatingDeal(rec) : undefined} onGoToDeal={()=>goToDeal(rec)}
      onEdit={()=>setForm({mode:'edit', id:rec.id, initial:rec})} onOwner={()=>setChangingOwner(rec)}
      onEnrich={()=>setStub(`Enrich customer · ${rec.name}`)} onDelete={()=>setPendingDelete(rec)} onCopied={showToast} onViewSettings={onViewSettings}/>;
  };
  // Quick actions run what their ⋯ menu items run.
  const onQuick = (key, c) => { const rec = byId.get(c.id) || c; return runQuickAction(key, {onTool:(k)=>toolAction(k, rec), onOwner:()=>setChangingOwner(rec),
    onCreateDeal: onCreateDeal && !customerHasDeal(rec) && (()=>setCreatingDeal(rec)), onGoToDeal:()=>goToDeal(rec), onStub:(l)=>setStub(`${l} · ${rec.name}`)}, quickActionLabel('customers', key)); };
  // The pipelines in view (Violations): the Board's, or those of the listed customers.
  const viewPipelines = (v) => v.mode === 'board' ? [v.pipelineId] : [...new Set(v.rows.map(r => (byId.get(r.id) || {}).pipeline).filter(Boolean))];
  /* Bulk Actions (bulkActions.jsx): edit as updateCustomer does; delete as the customer's Delete
     does (its activity goes; its contact and deals stay). */
  // The Board's stage and pipeline moves too (as on Deals): one change, as a card dragged between stages.
  const customerBulk = useRecordBulk({object:'customers', data, records:customers,
    update:(ids, patch) => setCustomers(cs => cs.map(c => ids.includes(c.id) ? {...c, ...patch} : c)),
    move:(ids, fn) => setCustomers(cs => cs.map(c => ids.includes(c.id) ? fn(c) : c)),
    remove:(ids) => {
      setCustomers(cs => cs.filter(c => !ids.includes(c.id)));
      setActivities(m => { const n = {...m}; ids.forEach(id => delete n[id]); return n; });
      ids.forEach(id => onRecordDeleted && onRecordDeleted('customers', id));
      if(detail && ids.includes(detail.id)) setDetail(null);
    }});
  const fullSchema = {...schema, pipelineLabel:(id) => (pipelineOf(id) || pipelines[0] || {}).label || '',
    renderCell:(key, r) => key === 'name' ? <span data-customer-id={r.id} style={{display:'inline-flex', alignItems:'center', gap:8, minWidth:0, maxWidth:'100%'}}>
        <ContactName name={r.name} onOpen={()=>openCustomer(r)} style={{fontSize:'inherit', fontWeight:500}}/><DealPromptMarker dealId={r.id}/></span>
      : key === 'status' && r.status ? <StatusPill status={r.status} map={STATUS_PILLS}/> : undefined,
    renderActions:(r) => menu(r),
    bulkActions: customerBulk.bulkActions,
  };
  const addActivity = (id, act) => addActivityProp ? addActivityProp(id, act)
    : setActivities(m => ({...m, [id]:[{id:`${act.type}-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, customerId:id, at:new Date(), ...act}, ...(m[id] || [])]}));
  const updateActivity = (id, actId, patch) => updateActivityProp ? updateActivityProp(actId, patch)
    : setActivities(m => ({...m, [id]:(m[id] || []).map(a => a.id === actId ? {...a, ...patch} : a)}));
  const save = (vals, links) => {
    if(form.mode === 'edit') updateCustomer(form.id, {...vals, contactId:links.contactId, dealIds:links.dealIds});
    else onAddCustomer && onAddCustomer(vals, links);
    showToast(form.mode === 'edit' ? 'Customer saved' : 'Customer added');
    setForm(null);
  };

  const card = (c, settings, ui = {}) => <RecordCard kind={CUSTOMER_RECORD_KIND} record={c} row={toRow(c)} acts={actsFor(c)} settings={settings} properties={cardProps}
    onQuick={onQuick} menu={menu(c)} onOpen={()=>openCustomer(c)} onStub={setStub} {...ui}/>;
  const sample = customers.find(c => (activities[c.id] || []).length && (c.dealIds || []).length) || customers[0];
  const customerCardKind = {object:'customers', sections:CUSTOMER_CARD_SECTIONS, quickActionLabels:quickActionLabels('customers'),
    tags:[], dropdowns:DEAL_DROPDOWNS, smartFeatures:CARD_SMART_FEATURES,
    relatedOptions:(ps) => [...CUSTOMER_RELATED_FIELDS, ...ps.filter(p => !p.extended && !CUSTOMER_RELATED_FIELDS.some(f => f.key === p.key))],
    renderPreview:(draft) => sample && <RecordCard kind={CUSTOMER_RECORD_KIND} record={sample} row={toRow(sample)} acts={actsFor(sample)} settings={draft} properties={cardProps}/>};

  return (
    <div style={{flex:1, minWidth:0, minHeight:0, display:'flex', flexDirection:'column', position:'relative', overflow:'hidden'}}>
      <RecordViewsModule inset="page" schema={fullSchema} rows={rows} columns={props.map(p => p.key)}
        defaultViews={[{id:'cv-all', name:'All Customers', sort:{key:'name', dir:'asc'}}]}
        board={pipelines.length ? {pipelines, defaultPipelineId:pipelines[0].id,
          cardSettings:{defaults:DEFAULT_CUSTOMER_CARD_SETTINGS,
            renderModal:({draft, setDraft, onApply, onClose}) => <CardSettingsModal kind={customerCardKind} draft={draft} setDraft={setDraft}
              properties={cardProps} onApply={onApply} onClose={onClose}/>},
          render:(filtered, {search, pipelineId, cardSettings}) => {
            const pipeline = pipelineOf(pipelineId) || pipelines[0];
            // The board shows the selected pipeline's customers; the filters and search still apply.
            const onBoard = filtered.map(r => byId.get(r.id)).filter(c => c && recordInPipeline(pipeline, c));
            return <ContactBoard rows={onBoard} search={search} pipeline={pipeline} searchKeys={['name', 'email']} noun="customer" bulk={customerBulk.board(pipeline)}
              onChangeStage={(id, stageId)=>{
                const c0 = customers.find(c => c.id === id);
                if(c0 && !stageMoveCan('customers', c0)) return hub && hub.toast("You can't move this customer between stages");
                setCustomers(cs => cs.map(c => c.id === id ? withStage(pipeline, c, stageId) : c));
              }}
              onAddToStage={(pl, stageId)=>setForm({mode:'add', initial:withStage(pl, {}, stageId)})}
              renderCard={(c, ui) => card(c, cardSettings, ui)}/>;
          }} : undefined}
        actions={(btn, view) => <>
          <button onClick={view.exportCsv} style={btn}><Icon name="export" size={13} color={T.gray600}/> Export</button>
          <button onClick={()=>setForm({mode:'add', initial:null})} title="Add Customer" style={toolbarIconButton}><Icon name="plus" size={14} color={T.gray800}/></button>
        </>}
        filterControls={(v) => <ViolationsButton object="customers" pipelines={viewPipelines(v)} active={violationMode} onClick={()=>setViolationMode(!violationMode)}/>}
        overlay={(v) => violationMode && <ViolationPanel object="customers" pipelines={viewPipelines(v)} onClose={()=>setViolationMode(false)}/>}/>
      {form && <CustomerFormModal data={data} mode={form.mode} initial={form.initial} contacts={contacts} deals={deals}
        links={form.mode === 'edit' ? {contactId:form.initial.contactId, dealIds:form.initial.dealIds} : null}
        onCancel={()=>setForm(null)} onSave={save}/>}
      {changingOwner && <ChangeOwnerModal record={changingOwner} noun="Customer" users={owners} ownerName={userLabel} onClose={()=>setChangingOwner(null)}
        onSave={(owner)=>{ updateCustomer(changingOwner.id, {owner}); setChangingOwner(null); }}/>}
      {customerBulk.bulkModal}
      {/* Delete Customer: its activity goes with it; its contact and deals stay as they are. */}
      {pendingDelete && <DeleteConfirmModal contactName={pendingDelete.name} noun="Customer" paid={recordHasPayments('customers', pendingDelete.id)}
        note={associatedNote([['contact', 'contacts', contactOf(pendingDelete) ? 1 : 0], ['deal', 'deals', dealsOf(pendingDelete).length]], 'customer')}
        onCancel={()=>setPendingDelete(null)}
        onConfirm={()=>{
          const id = pendingDelete.id;
          setCustomers(cs => cs.filter(c => c.id !== id));
          setActivities(m => { const n = {...m}; delete n[id]; return n; });
          onRecordDeleted && onRecordDeleted('customers', id);
          if(detail && detail.id === id) setDetail(null);
          setPendingDelete(null);
          showToast('Customer deleted');
        }}/>}
      {/* Create Deal: the Deal form, starting from the customer's name and owner, with the
          customer's contact (any existing contact, or none); the new deal joins the customer's deals. */}
      {creatingDeal && <ContactFormModal mode="add" initial={{name:creatingDeal.name, owner:creatingDeal.owner}} properties={objectFormProperties(data, 'deals')} noun={typeNoun('deals', 'deal')}
        optionsFor={dealFormOptions(data)} adjust={dealFormAdjust(data)} onCancel={()=>setCreatingDeal(null)}
        links={workspaceHasType('contacts') ? [{key:'contactId', noun:'contact', options:contacts.map(c => ({value:c.id, label:c.email ? `${c.name} · ${c.email}` : c.name}))}] : []}
        initialLinks={{contactId:creatingDeal.contactId ?? null}}
        onSave={(vals, _assoc, l)=>{
          // A customer has one deal (Deals → Customers is One-to-many): linked only when it has none yet.
          const c = creatingDeal, deal = onCreateDeal(vals, l.contactId ?? null), linked = !(c.dealIds || []).length;
          if(linked) setCustomers(cs => cs.map(x => x.id === c.id ? {...x, dealIds:[deal.id]} : x));
          setCreatingDeal(null);
          showToast(`${typeSingular('deals', 'Deal')} created · ${deal.name}${linked ? '' : ` · not linked (the customer already has a ${typeNoun('deals', 'deal')})`}`, {label:`Open ${typeNoun('deals', 'deal')}`, onClick:()=>{ setToast(null); onOpenDeal && onOpenDeal(deal.id, 'panel'); }});
        }}/>}
      {(() => {
        const dc = detail && byId.get(detail.id);
        if(!dc) return null;
        const acts = actsFor(dc), contact = contactOf(dc), cdeals = dealsOf(dc), view = toRow(dc);
        const settings = withCustomerPanelProperties(panelSettings, props);
        // Customer activity: the customer's own; Contact activity: its contact's.
        const activityViews = {
          store:{state:activityViewState, setState:setActivityViewState},
          sources:{own:activityFilterRows([{acts}], data)},
          schemaFor:(tabId) => activityFilterSchema(tabId, data),
        };
        return <RecordAccessCtx.Provider value={{object:'customers', record:dc}}><CustomerDetail key={dc.id} mode={detail.mode} customer={dc} view={view} acts={acts}
          contact={contact} deals={cdeals} data={data} profiles={profileStore ? profileStore.profiles[profileHolderId('customers', dc)] : undefined}
          props={props} settings={settings} menu={menu(dc, ()=>setPanelDraft(JSON.parse(JSON.stringify(settings))))} requestedTab={detail.tab}
          team={owners.map(u => u.name)} activityViews={activityViews}
          onQuick={(k)=>onQuick(k, dc)} onOpenDeal={(d)=>onOpenDeal && onOpenDeal(d.id, detail.mode)} onOpenContact={(c)=>onOpenContact && onOpenContact(c.id, detail.mode)}
          onCreateProfile={(c, templateId)=>{
            const lastCall = (contactActivities[c.id] || activities[c.id] || []).find(a => a.type === 'call' && ((a.transcript && a.transcript.length) || a.notes));
            setProfileRun({contactId:c.id, customerId:dc.id, templateIds: templateId ? [templateId] : undefined,
              call: lastCall ? {id:lastCall.id, segments:lastCall.transcript || [], notes:lastCall.notes || '', startedAt:lastCall.at} : null});
          }}
          onStub={setStub} onCopied={showToast} onClose={closeDetail}
          onExpand={()=>setDetail(x => ({id:dc.id, mode:'full', returnTo:x && x.returnTo}))} onCollapse={()=>setDetail(x => ({id:dc.id, mode:'panel', returnTo:x && x.returnTo}))}
          onUpdateActivity={(id, actId, patch)=> updateContactActivity && !acts.some(a => a.id === actId)
            ? updateContactActivity(actId, patch)   // the contact's activity (Contact activity view) is saved on the contact
            : updateActivity(id, actId, patch)}
          onAddActivity={addActivity}
          onReassignOwner={(id, name)=>{ const u = owners.find(x => x.name === name); if(u) updateCustomer(id, {owner:u.id}); }}/></RecordAccessCtx.Provider>;
      })()}
      {panelDraft && (() => {
        const dc = detail && byId.get(detail.id);
        const kind = customerPanelKind(props, (draft) => dc && (() => {
          const view = toRow(dc);
          return <div style={{display:'flex', flexDirection:'column', gap:12}}>
            <CustomerNameRow customer={dc} subtitle={customerSubtitle(dc, view, draft)}/>
            <CustomerDetailBody customer={dc} view={view} acts={actsFor(dc)} contact={contactOf(dc)} deals={dealsOf(dc)} settings={draft} props={props}
              onQuick={()=>{}} onOpenDeal={()=>{}} onOpenContact={()=>{}} onStub={()=>{}} onCopied={()=>{}}/>
          </div>;
        })());
        return <PanelSettingsModal kind={kind} draft={panelDraft} setDraft={setPanelDraft} onClose={()=>setPanelDraft(null)}
          onApply={()=>{ setPanelSettings(panelDraft); setPanelDraft(null); }}/>;
      })()}
      {(() => {
        // The profile's holder: a contact — or the customer itself (a workspace without Contacts).
        const rc = profileRun && (contacts.find(c => c.id === profileRun.contactId) || deals.find(d => d.id === profileRun.contactId) || customers.find(c => c.id === profileRun.contactId));
        if(!rc || !profileStore) return null;
        return <ProfileFormFill contact={rc} call={profileRun.call} formId={(profileRun.templateIds || [])[0]}
          onCancel={()=>setProfileRun(null)}
          onSave={(summary)=>{
            setDetail({id:profileRun.customerId, mode:'full', tab:{id:'profile', nonce:Date.now()}});
            setProfileRun(null);
            showToast(`Customer Profile saved · ${summary.formName}`);
          }}/>;
      })()}
      <CopyToast message={toast && toast.message} action={toast && toast.action}/>
      {stub && <StubPanel title={stub} onClose={()=>setStub(null)} zIndex={110}/>}
    </div>
  );
}

Object.assign(window, {SAMPLE_CUSTOMERS, SAMPLE_CUSTOMER_ACTIVITIES, migrateCustomer, CustomersModule, CustomerFormModal, CustomerActionsMenu, customerListRow, customerRowOf,
  customerFilterSchema, ASSOCIATED_CUSTOMER_COLUMNS, CUSTOMER_TABS, CUSTOMER_RECORD_KIND, DEFAULT_CUSTOMER_CARD_SETTINGS});
