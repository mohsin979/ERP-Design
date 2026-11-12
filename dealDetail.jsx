/* HOF Pulse ERP — Deal Detail, and Create Deal from a contact.

   Contacts and Deals are the CRM's two core objects; a Deal record works exactly like a Contact
   record (contactDetail.jsx is the reference and the shell — ContactDetail is reused, so side
   panel ⇄ full screen, the breadcrumb and the workspace behave the same):
     • Side panel / left column — name row (round avatar, deal name, the Avatar subtitle set in
       View settings — Deal Stage by default), the deal's contact's email and phone (as on the
       contact), then the sections in the order set in View settings: Quick Actions (Go to
       contact in place of the contact's Create deal), Smart Summary, Dropdowns, Deal Properties
       (PanelSettingsModal with the Deal kind).
     • ⋯ menu — the one record menu (DealActionsMenu → StandardRecordMenu), as on Contacts and
       Customers.
     • Workspace tabs — the Contact's, with Deals → Contacts and a Meetings tab. Activity tabs
       hold the deal's own history; Customer Profile is the associated contact's profile (one
       profile per person, shared with every deal of theirs — without Contacts, HOF Partners, the
       lead's own, shared with its customer); Contacts lists the contact.

   A deal belongs to the contact it was created from (`contactId`). Records link to each other:
   the contact on a deal, and a contact's deals, open the other record (App switches page).

   Create Deal (from a contact): the deal name is the contact's name or a different one; the
   pipeline, stage, close date and the other Deal properties available on creation; the deal
   owner is the contact's owner or another user. After it's saved, a contact without a Customer
   Profile is offered one (ProfilePromptModal). */

/* Workspace tabs, in order. */
const DEAL_TABS = [
  {id:'overview', label:'Overview',         icon:'overview',    list:false},
  {id:'profile',  label:'Customer Profile', icon:'profile',     list:false},
  {id:'calls',    label:'Calls',            icon:'call',        list:true},
  {id:'notes',    label:'Notes',            icon:'notepad',     list:true},
  {id:'email',    label:'Emails',            icon:'envelope',    list:true},
  {id:'tasks',    label:'Tasks',            icon:'tasks',       list:true},
  {id:'meetings', label:'Meetings',         icon:'videoCamera', list:true},
  {id:'files',    label:'Files',            icon:'folder',      list:true},
  {id:'quotes',   label:'Quotes',           icon:'quote',       list:true},
  {id:'documents', label:'Documents',       icon:'files',    list:true},
  {id:'accounting', label:'Accounting',     icon:'coins',       list:false},
  {id:'contacts', label:'Contacts',         icon:'contacts',    list:true},
  {id:'customers', label:'Customers',       icon:'customers',   list:true},
];

/* ── Side panel sections and View Settings ─────────────────────────────────────────────── */

const DEAL_PANEL_SECTIONS = {
  avatarSubtitle: 'Avatar subtitle',
  quickActions:   'Quick Actions',
  smartSummary:   'Smart Summary',
  dropdowns:      'Dropdowns',
  get dealProperties(){ return `${typeSingular('deals', 'Deal')} Properties`; },
};
/* Deal Properties: the Deal's own, plus the ones the record works out (owner dates, last
   activity) and its contact — the Contact Properties' counterparts. Custom Deal properties join
   at the end. */
const DEAL_PANEL_BASE_PROPERTIES = [
  {key:'owner',         label:'Deal Owner'},
  {key:'ownerAssigned', label:'Owner Assignment Date'},
  {key:'ownerChanged',  label:'Owner Change Date'},
  {key:'pipeline',      label:'Pipeline'},
  {key:'stage',         label:'Deal Stage'},
  {key:'profileType',   label:'Customer Profile Type'},
  {key:'amount',        label:'Total Amount'},
  {key:'closeDate',     label:'Close Date'},
  {key:'created',       label:'Created Date'},
  {key:'lastActivity',  label:'Last Activity Date'},
  {key:'contact',       label:'Associated Contact'},
  {key:'customers',     label:'Associated Customers'},
];
// Labels from Settings; every other Deal property follows (Deal Name heads the panel).
const dealPanelProperties = (props) => {
  const prop = (k) => (props || []).find(p => p.key === k);
  // Without Contacts in the workspace, no Associated Contact (the lead holds its own Customer Profile).
  const base = DEAL_PANEL_BASE_PROPERTIES.filter(p => workspaceHasType('contacts') || p.key !== 'contact').map(p => ({key:p.key, label:(prop(p.key) || p).label}));
  return [...base, ...(props || []).filter(p => !['name', 'currency'].includes(p.key) && !base.some(b => b.key === p.key)).map(p => ({key:p.key, label:p.label}))];
};
// Avatar subtitle: any Deal property but the worked-out dates.
const dealSubtitleOptions = (props) => dealPanelProperties(props).filter(p => !['ownerAssigned', 'ownerChanged', 'lastActivity'].includes(p.key)).map(p => ({value:p.key, label:p.label}));
const dealSubtitle = (deal, view, contact, settings) => {
  const k = settings.subtitle;
  if(!k) return '';
  const v = k === 'contact' ? contact && contact.name : k === 'amount' ? view.amountText : ['owner', 'pipeline', 'stage'].includes(k) ? view[k] : deal[k];
  return v == null ? '' : String(v);
};
const defaultDealPanelSettings = (props) => ({
  subtitle: 'stage',
  order: ['quickActions', 'smartSummary', 'dropdowns', 'dealProperties'],
  quickActions: defaultQuickActions('deals', [...DEFAULT_QUICK_ON, 'goToContact']),
  smartSummary: {enabled:true},
  dropdowns: [{id:'d-all', type:'all', enabled:true, count:10}],
  dealProperties: dealPanelProperties(props).map(p => ({key:p.key, enabled:true})),
});
// A custom property added since the settings were saved joins the end, shown.
const withDealPanelProperties = (settings, props) => {
  const known = settings.dealProperties.map(p => p.key);
  const added = dealPanelProperties(props).filter(p => !known.includes(p.key)).map(p => ({key:p.key, enabled:true}));
  return added.length ? {...settings, dealProperties:[...settings.dealProperties, ...added]} : settings;
};
const dealPanelKind = (props, renderPreview) => ({
  object:'deals', sections:DEAL_PANEL_SECTIONS, quickActionLabels:quickActionLabels('deals'),
  subtitleOptions:dealSubtitleOptions(props),
  dropdowns:DEAL_DROPDOWNS, propertiesKey:'dealProperties', properties:dealPanelProperties(props), renderPreview,
});

/* ── Name row and body ─────────────────────────────────────────────────────────────────── */

/* The Contact name row on a deal: a round avatar with the Deals icon in place of initials, the
   Avatar subtitle under the name. */
function DealNameRow({deal, subtitle, headerActions}){
  return (
    <div style={{display:'flex', alignItems:'center', gap:10, minWidth:0}}>
      <span style={{width:36, height:36, borderRadius:9999, background:T.attioText, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center'}}>
        <Icon name="deals" size={17} color="#fff"/>
      </span>
      <div style={{minWidth:0, flex:1}}>
        <div style={{fontSize:17, fontWeight:600, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{deal.name}</div>
        {subtitle && <div style={{fontSize:12.5, color:T.attioMuted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{subtitle}</div>}
      </div>
      {headerActions && <div style={{display:'flex', alignItems:'center', gap:2, flexShrink:0}}>{headerActions}</div>}
    </div>
  );
}

const linkButton = {border:'none', background:'transparent', padding:0, cursor:'pointer', fontSize:13, color:T.attioBlue, textAlign:'left', fontFamily:'inherit',
  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', minWidth:0};
const dateOnly = (v) => v ? String(v).split(', ').slice(0, 2).join(', ') : '';
// Last Activity Date: the latest activity that has happened (a meeting still ahead is the next one, not the last).
const latestActivityDate = (acts) => { const now = Date.now(); const t = Math.max(0, ...(acts || []).map(a => new Date(a.at).getTime() || 0).filter(x => x <= now)); return t ? fmtInfoDate(new Date(t)) : ''; };
// Next Activity Date: the soonest scheduled meeting or open task still ahead.
const nextActivityDate = (acts) => {
  const now = Date.now();
  const ts = (acts || []).map(a => a.type === 'meeting' && a.status === 'scheduled' ? new Date(a.scheduledFor || a.at).getTime()
    : a.type === 'task' && a.due && isTaskOpen(a) ? new Date(a.due).getTime() : 0).filter(t => t > now);
  return ts.length ? fmtInfoDate(new Date(Math.min(...ts))) : '';
};

/* `view`: the deal as shown — owner, pipeline and stage as names, the amount with its currency. */
function DealInfo({deal, view, acts, contact, customers = [], keys, props, onOpenContact, onOpenCustomer, onStub}){
  const owner = ownerDates({owner:view.owner, created:dateOnly(deal.created)}, acts);
  const hub = useRecordHub();
  const rows = {
    owner:         {value:view.owner, owner:true},
    ownerAssigned: {value:owner.assigned},
    ownerChanged:  {value:owner.changed},
    pipeline:      {value:view.pipeline},
    stage:         {value:view.stage},
    amount:        {value:view.amountText},
    closeDate:     {value:deal.closeDate},
    created:       {value:deal.created},
    lastActivity:  {value:latestActivityDate(acts)},
    contact:       {value:contact && contact.name, open:() => contact && onOpenContact(contact)},
    customers:     {value:customers.length ? customers : null, list:true},
  };
  const labels = Object.fromEntries(dealPanelProperties(props).map(p => [p.key, p.label]));
  const shown = keys.filter(k => labels[k]);
  if(!shown.length) return null;
  return (
    <div>
      <div style={{marginBottom:6}}>
        <span style={{fontSize:11, fontWeight:600, color:T.attioFaint, textTransform:'uppercase', letterSpacing:.4}}>{typeSingular('deals', 'Deal')} Properties</span>
      </div>
      {shown.map(k => {
        const r = rows[k] || {value:deal[k]};   // custom Deal properties: the stored value
        // Editable properties: in place (hover → edit icon); the worked-out rows keep their display.
        const spec = panelEditSpec(hub, 'deals', deal, k);
        return (
          <div key={k} style={{display:'flex', alignItems:'baseline', gap:12, padding:'7px 0', borderBottom:`1px solid ${T.attioLine}`, minHeight:32}}>
            <PropertyRowLabel k={k} label={labels[k]}/>
            {k === 'profileType' ? <ProfileTypeValue contactId={profileHolderId('deals', deal)}/>
              : spec ? <PanelEditableValue spec={spec} display={rows[k] ? (r.value == null ? '' : String(r.value)) : undefined}/>
              : r.owner ? <OwnerValue object="deals" record={deal} name={r.value}/>
              : !r.value ? <span style={{fontSize:13, color:T.attioFaint}}>—</span>
              : r.list ? <AssociatedRecordsValue records={r.value} noun="customer" onOpen={(x)=>onOpenCustomer && onOpenCustomer(x)}/>
              : r.open ? <button onClick={r.open} style={linkButton}>{r.value}</button>
              : <span style={{fontSize:13, color:T.attioText, minWidth:0, overflowWrap:'anywhere'}}>{dateShown(r.value)}</span>}
          </div>
        );
      })}
    </div>
  );
}

/* The shared record body (side panel and the full page's left column) for Deals and Customers:
   the email and phone first (as on the contact), then the sections in the order set in View
   settings. `object`: the record's Object (its quick actions); `dropdowns`: its activity
   dropdowns; `propertiesKey` + `info(keys)`: its properties section. */
function RecordDetailBody({object, record, view, acts, email, phone, settings, dropdowns, propertiesKey, info, onQuick, onStub, onCopied}){
  const ps = settings;
  const sections = {
    quickActions: () => {
      const on = shownQuickActions(ps.quickActions, object, record);
      return on.length ? (
        <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          {on.map(q => <QuickAction key={q.key} icon={q.icon} label={q.label} onClick={()=>onQuick(q.key)}/>)}
        </div>
      ) : null;
    },
    // The card's Smart Summary: it opens with the record's stage and pipeline.
    smartSummary: () => !ps.smartSummary.enabled ? null : (
      <div style={activityBox}><SummaryBlock contact={view} acts={acts} source="From activity" lead={`${view.stage || 'No stage'} · ${view.pipeline || 'No pipeline'}.`}/></div>
    ),
    dropdowns: () => {
      const on = ps.dropdowns.filter(d => d.enabled && dropdowns.some(x => x.key === d.type));
      if(!on.length) return null;
      return (
        <div style={activityBox}>
          {on.map((d, i) => {
            const dd = dropdowns.find(x => x.key === d.type);
            return <ActivityDropdown key={d.id} first={i === 0} icon={dd.icon} label={dd.label} contact={view}
              context={dd.type ? 'type' : 'all'} items={dd.type ? acts.filter(a => a.type === dd.type) : listedActivities(acts)}
              count={d.count} emptyText={dd.empty} linkLabel={dd.link} onLink={()=>onStub(dd.link)}/>;
          })}
        </div>
      );
    },
    [propertiesKey]: () => info(ps[propertiesKey].filter(p => p.enabled).map(p => p.key)),
  };
  return (
    <div style={{display:'flex', flexDirection:'column', gap:18}}>
      <div>
        <ContactLine icon="envelope" label="email" value={email} onOpen={()=>onQuick('email')} onCopied={onCopied}/>
        <ContactLine icon="call" label="phone number" value={phone} onOpen={()=>onQuick('call')} onCopied={onCopied}/>
      </div>
      {ps.order.map(id => { const el = sections[id] && sections[id](); return el ? <React.Fragment key={id}>{el}</React.Fragment> : null; })}
    </div>
  );
}
// A deal shows its contact's email and phone — its own where it has no contact (HOF Partners' Leads have no Contacts).
const dealEmail = (deal, contact) => (contact && contact.email) || deal.email || '';
const dealPhone = (deal, contact) => (contact && contact.phone) || deal.phone || '';
function DealDetailBody({deal, view, acts, contact, customers, settings, props, onQuick, onOpenContact, onOpenCustomer, onStub, onCopied}){
  return <RecordDetailBody object="deals" record={deal} view={view} acts={acts} email={dealEmail(deal, contact)} phone={dealPhone(deal, contact)}
    settings={settings} dropdowns={DEAL_DROPDOWNS} propertiesKey="dealProperties" onQuick={onQuick} onStub={onStub} onCopied={onCopied}
    info={(keys) => <DealInfo deal={deal} view={view} acts={acts} contact={contact} customers={customers} props={props} onOpenContact={onOpenContact}
      onOpenCustomer={onOpenCustomer} onStub={onStub} keys={keys}/>}/>;
}

/* The deal ⋯ menu — the one record menu (StandardRecordMenu): the tools · Create Customer (a
   customer linked to this deal; a deal can't create a deal) · Copy Email and Copy Phone Number
   (its contact's, else its own), Edit Deal, Edit Deal Owner, Copy Deal, Enrich Deal · View settings · Delete Deal. */
const dealCopyText = (deal, contact) => [deal.name, contact && contact.name, dealPhone(deal, contact), dealEmail(deal, contact)].filter(Boolean).join('\n');
function DealActionsMenu({deal, contact, onTool, onCreateCustomer, onEdit, onOwner, onEnrich, onDelete, onCopied, onViewSettings, visible}){
  return (
    <StandardRecordMenu object="deals" record={deal} noun={typeSingular('deals', 'Deal')} email={dealEmail(deal, contact)} phone={dealPhone(deal, contact)} copyText={dealCopyText(deal, contact)}
      onTool={onTool} onCreateCustomer={onCreateCustomer} onEdit={onEdit} onOwner={onOwner} onEnrich={onEnrich} onDelete={onDelete}
      onCopied={onCopied} onViewSettings={onViewSettings} visible={visible}/>
  );
}

/* ── Workspace: Overview, associated records ───────────────────────────────────────────── */

/* A list of associated records (a deal's Contacts, a contact's Deals): the first column opens
   the record. `q` is the tab's search. */
function AssociatedRecords({columns, rows, q, onOpen, empty}){
  const shown = rows.filter(r => !q || String(r.name || '').toLowerCase().includes(q.toLowerCase()));
  if(!shown.length) return <div style={{padding:'40px 24px', textAlign:'center', fontSize:13, color:T.gray400}}>{rows.length ? 'No matches' : empty}</div>;
  const grid = {display:'grid', gridTemplateColumns:columns.map(c => c.width || '1fr').join(' '), gap:16, alignItems:'center', padding:'0 4px'};
  return (
    <div style={{padding:'12px 20px 24px'}}>
      <div style={{...grid, height:34, borderBottom:`1px solid ${T.border}`}}>
        {columns.map(c => <span key={c.key} style={{fontSize:12.5, color:T.attioMuted}}>{c.label}</span>)}
      </div>
      {shown.map(r => (
        <div key={r.id} style={{...grid, minHeight:42, borderBottom:`1px solid ${T.attioLine}`}}>
          {columns.map((c, i) => i === 0
            ? <ContactName key={c.key} name={r[c.key]} onOpen={()=>onOpen(r)} style={{fontSize:13, fontWeight:500}}/>
            // The owner column (Deal / Contact / Customer Owner) opens the owner's profile.
            : c.key === 'owner' && r[c.key] ? <span key={c.key} style={{minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}><OwnerLink name={r[c.key]}/></span>
            : <span key={c.key} style={{fontSize:13, color: r[c.key] ? T.attioText : T.attioFaint, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{formatValue(r[c.key]) || '—'}</span>)}
        </div>
      ))}
    </div>
  );
}
const ASSOCIATED_DEAL_COLUMNS = [
  {key:'name', label:'Deal Name', width:'1.4fr'}, {key:'stage', label:'Deal Stage'}, {key:'amountText', label:'Total Amount'}, {key:'owner', label:'Deal Owner'},
];
const ASSOCIATED_CONTACT_COLUMNS = [
  {key:'name', label:'Name', width:'1.2fr'}, {key:'email', label:'Email', width:'1.4fr'}, {key:'phone', label:'Phone Number'}, {key:'owner', label:'Contact Owner'},
];

/* ── Deal Detail ───────────────────────────────────────────────────────────────────────── */

function DealDetail({mode, deal, view, acts, contact, profiles, props, settings, menu, requestedTab, team, activityViews, customers = [], onOpenCustomer,
                     onQuick, onOpenContact, onCreateProfile, onStub, onCopied, onClose, onExpand, onCollapse, onUpdateActivity, onAddActivity, onReassignOwner}){
  // One Customer Profile per person: the deal shows (and creates) its contact's — without Contacts (HOF Partners), the lead's own.
  const holder = contact || (!workspaceHasType('contacts') ? deal : null);
  const renderTab = (tab, openTab, q) => {
    if(tab.id === 'profile') return holder
      ? <CustomerProfileTab contact={holder} profiles={profiles} onCall={()=>onStub('Call')}
          onCreate={(templateId)=>onCreateProfile(holder, templateId)} onStub={onStub}/>
      : <div style={{padding:'40px 24px', textAlign:'center', fontSize:13, color:T.gray400}}>This {typeNoun('deals', 'deal')} has no contact, so it has no Customer Profile.</div>;
    if(tab.id === 'contacts') return <AssociatedRecords columns={ASSOCIATED_CONTACT_COLUMNS} rows={contact ? [contactView(contact)] : []} q={q}
      onOpen={(c)=>onOpenContact(c)} empty={`No contacts on this ${typeNoun('deals', 'deal')}`}/>;
    // Deals → Customers: the deal's customers.
    if(tab.id === 'customers') return <AssociatedRecords columns={ASSOCIATED_CUSTOMER_COLUMNS} rows={customers} q={q}
      onOpen={(x)=>onOpenCustomer && onOpenCustomer(x)} empty={`No customers on this ${typeNoun('deals', 'deal')}`}/>;
    return undefined;
  };
  return (
    <ContactDetail mode={mode} contact={view} acts={acts} onClose={onClose} onExpand={onExpand} onCollapse={onCollapse} onStub={onStub}
      backLabel={typePlural('deals', 'Deals')}
      renderName={(headerActions) => <DealNameRow deal={deal} subtitle={dealSubtitle(deal, view, contact, settings)} headerActions={headerActions}/>}
      menu={menu}
      body={<DealDetailBody deal={deal} view={view} acts={acts} contact={contact} customers={customers} settings={settings} props={props}
        onQuick={onQuick} onOpenContact={onOpenContact} onOpenCustomer={onOpenCustomer} onStub={onStub} onCopied={onCopied}/>}
      workspace={<ContactWorkspace contact={view} acts={acts} onStub={onStub} requestedTab={requestedTab}
        team={team} onUpdateActivity={onUpdateActivity} onAddActivity={onAddActivity} onReassignOwner={onReassignOwner}
        tabs={DEAL_TABS.filter(t => workspaceHasType('contacts') || t.id !== 'contacts')} renderTab={renderTab} activityViews={activityViews}/>}/>
  );
}

/* A deal as a row in a contact's Deals list: names and labels, the amount with its currency. */
const dealListRow = (data, d) => {
  const pipeline = (data.pipelines || []).find(p => p.id === d.pipeline);
  return {id:d.id, name:d.name, stage:((pipeline && pipeline.stages.find(st => st.id === d.stage)) || {}).label || '',
    amountText: d.amount === '' || d.amount == null ? '' : `${d.currency || DEAL_CURRENCY} ${formatAmount(d.amount)}`,
    owner:((data.users || []).find(u => u.id === d.owner) || {}).name || ''};
};
/* Deals saved in this browser before deals were linked to contacts: only the original demo deals
   ("<contact> US NIW", ids deal-1…12) lose the suffix and point at that sample contact. Any other
   deal without a contact stays without one — an association is never guessed from a name. */
const linkSavedDeal = (d) => {
  if(d.contactId !== undefined) return d;
  const legacy = /^deal-([1-9]|1[0-2])$/.test(d.id) && / US NIW$/.test(String(d.name || ''));
  const name = legacy ? String(d.name).replace(/ US NIW$/, '') : d.name;
  const c = legacy && SAMPLE_CONTACTS.find(x => x.name === name);
  return {...d, name, contactId: c ? c.id : null};
};

/* ── Create Deal from a contact ────────────────────────────────────────────────────────── */

/* Deal Name: the contact's name, or a different one. Pipeline, Deal Stage, Close Date and the
   other Deal properties available on creation, as in Add deal. Deal Owner: the contact's owner
   (when they're an active user), or another user. */
function CreateDealModal({contact, data, onCancel, onSave}){
  const pipelines = recordPipelines(data, 'deals');
  const users = (data.users || []).filter(u => u.status === 'Activated');
  // The contact's owner (a user ID; a name on rows built for display).
  const contactOwner = users.find(u => u.id === contact.ownerId || u.id === contact.owner || u.name === contact.owner);
  // Starts from the contact: its name, email, phone and owner — every one editable.
  const initial = {name:contact.name || '', email:contact.email || '', phone:contact.phone || '', owner:contactOwner ? contactOwner.id : '',
    ...(pipelines.length === 1 ? {pipeline:pipelines[0].id} : {})};
  return <ContactFormModal mode="add" initial={initial} properties={objectFormProperties(data, 'deals')} noun={typeNoun('deals', 'deal')}
    optionsFor={pipelineFormOptions(data, 'deals')} adjust={pipelineFormAdjust(data, 'deals')} onCancel={onCancel} onSave={(vals)=>onSave(vals)}/>;
}

/* After Create Deal: the contact has no Customer Profile yet — one profile serves the contact and
   every deal of theirs, so it's offered here (the existing profile builder). */
function ProfilePromptModal({contact, onCancel, onCreate}){
  return (
    <StModal title="Create Customer Profile" primary="Create Customer Profile" onSubmit={onCreate} onCancel={onCancel}>
      <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>
        {contact.name} doesn't have a Customer Profile yet. It's shared by the contact and their deals, so the new deal will show it too.
      </div>
    </StModal>
  );
}

Object.assign(window, {DealNameRow, dealSubtitle, DealActionsMenu, dealListRow, linkSavedDeal, DealDetail, CreateDealModal, ProfilePromptModal, AssociatedRecords, ASSOCIATED_DEAL_COLUMNS, defaultDealPanelSettings,
  withDealPanelProperties, dealPanelKind, DealDetailBody, RecordDetailBody, DEAL_TABS, dateOnly, latestActivityDate, nextActivityDate, linkButton, ASSOCIATED_CONTACT_COLUMNS});
