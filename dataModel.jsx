/* HOF Pulse ERP — Data Management: Objects, Associations, Properties (initial infrastructure).

   Object      — a CRM business entity (a table with its own CRUD): Contacts, Deals and Customers
                 for now (Forms and Services were removed; Leads isn't an Object). Settings / system entities (Users, Seats, Teams, Permission
                 Presets) are not Objects. Each Object belongs to a navigation GROUP (Marketing,
                 Pre-Sales, Sales, Automation), which decides where it appears in the main CRM
                 navigation (navWithObjects, nav.jsx).
   Association — a relationship between two Objects, typed One-to-many / Many-to-one /
                 Many-to-many. Stored once ({a, b, type}, the type read from a's side); b sees the
                 inverse. Any Object can be associated with any other.
   Property    — a field with a type that decides its input control, belonging to exactly ONE
                 Object: each Object has its own property instances (Contact Status and Deal Status
                 are separate properties with their own values / configuration). A property carries
                 its Object's settings: AVAILABLE DURING CREATION (shown on the creation form) and
                 MANDATORY (required there). A property can exist without being available during
                 creation — for values that come from forms, enrichment, integrations or automation
                 (sources not defined yet). Name and Contact Owner on Contacts are locked on.

   Pipeline    — a configurable lifecycle belonging to ONE Object, with ordered stages. Deals
                 reference a pipeline and a stage of it (Pipeline → Stages → Deal), so each
                 pipeline can later carry its own stages, requirements, rules and automation
                 without restructuring the Deal. Only US NIW exists; stage logic is not defined.

   Contacts and Deals have properties; each Object's creation form is built from them
   (ContactFormModal, contactActions.jsx). Not defined yet: what the Associated Objects count
   opens, editing an Object, group management, and the enrichment / integration sources. */

/* The property types (propertyTypes.jsx — each type's input, value, display, validation and
   operators): the ones a property can be created with, the ones with options to configure, and
   the system-only ones (a record's pipeline and its stage). */
const PROPERTY_TYPES = CREATABLE_PROPERTY_TYPES;
const CHOICE_TYPES = ['Single Selection', 'Multi-Selection'];
const SYSTEM_PROPERTY_TYPES = ['Pipeline', 'Pipeline stage'];
const RELATIONSHIP_TYPES = ['One-to-many', 'Many-to-one', 'Many-to-many'];
const inverseRelationship = (t) => t === 'One-to-many' ? 'Many-to-one' : t === 'Many-to-one' ? 'One-to-many' : t;
const OBJECT_GROUPS = ['Marketing', 'Pre-Sales', 'Sales', 'Tools', 'Automation'];

const DEFAULT_OBJECTS = [
  {id:'contacts',  name:'Contacts',  group:'Pre-Sales'},
  {id:'deals',     name:'Deals',     group:'Pre-Sales'},
  {id:'customers', name:'Customers', group:'Sales'},
];
// Objects that were defaults before and are removed from saved settings (they never had records).
const REMOVED_DEFAULT_OBJECTS = ['forms', 'service'];
/* Every link is optional — each record exists on its own:
     Contacts → Deals      One-to-many: a contact has many deals, a deal at most one contact (deal.contactId).
     Contacts → Customers  One-to-many: a contact has many customers, a customer at most one contact (customer.contactId).
     Deals → Customers     One-to-many: a deal has many customers, a customer at most one deal (customer.dealIds: none or one). */
const DEFAULT_ASSOCIATIONS = [
  {id:'as-contacts-deals',     a:'contacts',  b:'deals',     type:'One-to-many'},
  {id:'as-contacts-customers', a:'contacts',  b:'customers', type:'One-to-many'},
  {id:'as-deals-customers',    a:'deals',     b:'customers', type:'One-to-many'},
];
// The relationship types as defined (settings saved earlier are brought in line).
const DEFINED_ASSOCIATION_TYPES = {'as-contacts-deals':'One-to-many', 'as-contacts-customers':'One-to-many', 'as-deals-customers':'One-to-many'};

/* The defined properties of Contacts, Deals and Customers. Some are entered by people (available
   during creation where marked); the rest are system-generated (`auto`): set by the system, never
   on a form, not editable. `derived`: a system-generated value worked out from other records or
   the record's history each time it's shown (Associated Deal, Last Activity Date…) — not stored.
   `archived`: a property that isn't one of the defined ones any more — hidden everywhere, its
   values kept (Settings → Properties can restore it).

   Contacts. Full Name and Contact Owner are mandatory and locked. Contact Owner is a User (stored
   as the user's ID). Contact Type drives the Types of Contact pipeline (its options are that
   pipeline's stages). Lead Source is set when the contact comes in (Manual, Meta Form). */
const CONTACT_PROPERTY_SETUP = {
  name:          {type:'Single-Line Text', onCreate:true, mandatory:true, locked:true, formLabel:'Full Name', placeholder:'Full name'},
  email:         {type:'Email',            onCreate:true, half:true, placeholder:'name@company.com'},
  phone:         {type:'Phone Number',     onCreate:true, half:true},
  country:       {type:'Country'},
  city:          {type:'Single-Line Text'},
  contactType:   {type:'Single Selection', onCreate:true, placeholder:'No stage', options:CONTACT_TYPE_STAGES.map(s => s.value)},
  jobTitle:      {type:'Single-Line Text'},
  company:       {type:'Single-Line Text'},
  industry:      {type:'Single Selection', options:CONTACT_INDUSTRIES},
  source:        {type:'Single Selection', options:CONTACT_SOURCES, locked:true, auto:true},
  leadStatus:    {type:'Single Selection', options:LEAD_STATUSES},
  owner:         {type:'User',             onCreate:true, mandatory:true, locked:true, placeholder:'Select owner'},
  ownerAssigned: {type:'Date', locked:true, auto:true, derived:true},
  deals:         {type:'Single-Line Text', locked:true, auto:true, derived:true},
  customers:     {type:'Single-Line Text', locked:true, auto:true, derived:true},
  created:       {type:'Date', locked:true, auto:true},
  lastActivity:  {type:'Date', locked:true, auto:true},
  lastContacted: {type:'Date', locked:true, auto:true},
  lifecycle:     {type:'Single Selection', options:[...new Set(SAMPLE_CONTACTS.map(c => c.lifecycle).filter(Boolean))], archived:true},
};
/* Deals. Deal Name, Deal Pipeline, Deal Stage and Deal Owner are mandatory and locked. Deal
   Pipeline is the deal's one manual pipeline; Deal Stage, its stage there. Actual Close Date is set
   when the deal reaches Deal Won or Deal Lost and cleared if it moves back out. Currency is
   archived: every deal is in AED (DEAL_CURRENCY, deals.jsx). */
const DEAL_TYPES = ['New Business', 'Existing Business'];
const DEAL_PROPERTY_SETUP = [
  {key:'name',      label:'Deal Name',     type:'Single-Line Text', onCreate:true, mandatory:true, locked:true, placeholder:'e.g. Ali Khan', width:220},
  // Email and Phone Number: filled in from the contact a deal is created from (editable).
  {key:'email',     label:'Email',         type:'Email',            onCreate:true, placeholder:'name@company.com', width:240},
  {key:'phone',     label:'Phone Number',  type:'Phone Number',     onCreate:true, width:170},
  {key:'pipeline',  label:'Deal Pipeline', type:'Pipeline',         onCreate:true, mandatory:true, locked:true, half:true, width:170},
  {key:'stage',     label:'Deal Stage',    type:'Pipeline stage',   onCreate:true, mandatory:true, locked:true, half:true, width:190},
  {key:'dealType',  label:'Deal Type',     type:'Single Selection', options:DEAL_TYPES, width:160},
  {key:'owner',     label:'Deal Owner',    type:'User',             onCreate:true, mandatory:true, locked:true, width:190},
  {key:'source',    label:'Deal Source',   type:'Single Selection', options:CONTACT_SOURCES, locked:true, auto:true, width:150},
  {key:'closeDate', label:'Expected Close Date', type:'Timestamp',  onCreate:true, half:true, width:200},
  {key:'actualCloseDate', label:'Actual Close Date', type:'Timestamp', locked:true, auto:true, width:200},
  {key:'created',   label:'Created Date',  type:'Timestamp',        locked:true, auto:true, width:200},
  {key:'lastActivity', label:'Last Activity Date', type:'Date',     locked:true, auto:true, derived:true, width:170},
  {key:'amount',    label:'Deal Amount',   type:'Number',           onCreate:true, half:true, width:150},
  {key:'contact',   label:'Associated Contact',  type:'Single-Line Text', locked:true, auto:true, derived:true, width:190},
  {key:'customers', label:'Associated Customer', type:'Single-Line Text', locked:true, auto:true, derived:true, width:200},
  // Currency on its own beside Deal Amount (a Number): a currency-only Currency property.
  {key:'currency',  label:'Currency',      type:'Currency', currencyOnly:true, locked:true, auto:true, archived:true, width:120},
];
/* Customers. Customer Name, Customer Pipeline, Customer Stage and Customer Owner are mandatory and
   locked. Customer Pipeline is the customer's one manual pipeline (Settings → Pipelines); Customer
   Stage, its stage there. Customer Source (how it came in: a Deal, a Contact, Manual, Meta Form)
   and Customer Since (the day it became a customer) are set when the customer is created. */
const CUSTOMER_STATUSES = ['Active', 'On Hold', 'Closed'];
const CUSTOMER_SOURCES = ['Deal', 'Contact', 'Manual', 'Meta Form', 'Website Form'];
/* Form Name and Form Submission Date: the form submission that created the record (Marketing →
   Forms; each submission creates its record) — worked out from that submission, on Contacts,
   Deals and Customers alike. */
const FORM_RECORD_PROPERTIES = [
  {key:'formName',        label:'Form Name',            type:'Single-Line Text', locked:true, auto:true, derived:true, width:200},
  {key:'formSubmittedAt', label:'Form Submission Date', type:'Timestamp',        locked:true, auto:true, derived:true, width:200},
];
const formRecordProperties = (objectId) => FORM_RECORD_PROPERTIES.map(p => ({...p, system:true, objectId, onCreate:false, mandatory:false}));
const CUSTOMER_PROPERTY_SETUP = [
  {key:'name',    label:'Customer Name',  type:'Single-Line Text', onCreate:true, mandatory:true, locked:true, formLabel:'Customer Name', placeholder:'Full name', width:220},
  {key:'pipeline', label:'Customer Pipeline', type:'Pipeline',     onCreate:true, mandatory:true, locked:true, half:true, width:190},
  {key:'stage',   label:'Customer Stage', type:'Pipeline stage',   onCreate:true, mandatory:true, locked:true, half:true, width:190},
  {key:'status',  label:'Customer Status', type:'Single Selection', options:CUSTOMER_STATUSES, width:160},
  {key:'owner',   label:'Customer Owner', type:'User',             onCreate:true, mandatory:true, locked:true, placeholder:'Select owner', width:190},
  {key:'source',  label:'Customer Source', type:'Single Selection', options:CUSTOMER_SOURCES, locked:true, auto:true, width:160},
  {key:'customerSince', label:'Customer Since', type:'Date',       locked:true, auto:true, width:160},
  {key:'contact', label:'Associated Contact', type:'Single-Line Text', locked:true, auto:true, derived:true, width:190},
  {key:'deals',   label:'Associated Deal', type:'Single-Line Text', locked:true, auto:true, derived:true, width:200},
  {key:'company', label:'Associated Company', type:'Single-Line Text', width:200},
  {key:'created', label:'Created Date',   type:'Timestamp',        locked:true, auto:true, width:200},
  {key:'lastActivity', label:'Last Activity Date', type:'Date',    locked:true, auto:true, derived:true, width:170},
  {key:'nextActivity', label:'Next Activity Date', type:'Date',    locked:true, auto:true, derived:true, width:170},
  // Email and Phone Number: carried over from the contact or deal a customer is created from.
  {key:'email',   label:'Email',          type:'Email',            onCreate:true, placeholder:'name@company.com', width:240},
  {key:'phone',   label:'Phone Number',   type:'Phone Number',     onCreate:true, width:170},
];
/* Users: the user-managed properties every user has (Settings → Users & Teams → a user) — more
   can be added in Settings → Properties. The metrics beside them are system-generated. */
const USER_PROPERTY_SETUP = [
  {key:'country',     label:'Country',     type:'Country'},
  {key:'language',    label:'Language',    type:'Language'},
  {key:'designation', label:'Designation', type:'Single-Line Text'},
];
const userDefaultProperties = () => USER_PROPERTY_SETUP.map(p => ({...p, system:true, objectId:'users', onCreate:false, mandatory:false, locked:false}));
const customerDefaultProperties = () => CUSTOMER_PROPERTY_SETUP.map(({onCreate = false, mandatory = false, locked = false, ...p}) => ({...p, system:true, objectId:'customers', onCreate, mandatory, locked}));
const DEFAULT_PROPERTIES = () => [
  ...CONTACT_PROPERTIES.map(p => {
    const {type, onCreate = false, mandatory = false, locked = false, ...display} = CONTACT_PROPERTY_SETUP[p.key] || {type:'Single-Line Text'};
    return {key:p.key, label:p.label, type, system:true, ...display, objectId:'contacts', onCreate, mandatory, locked};
  }),
  ...DEAL_PROPERTY_SETUP.map(({onCreate = false, mandatory = false, locked = false, ...p}) => ({...p, system:true, objectId:'deals', onCreate, mandatory, locked})),
  ...customerDefaultProperties(),
  ...['contacts', 'deals', 'customers'].flatMap(formRecordProperties),
  ...userDefaultProperties(),
];
/* Settings saved before: Forms and Services go (with anything of theirs); the Deals–Customers
   association is Deals ↔ Customers (Many-to-many), Contacts → Customers One-to-many; Customers
   gets its properties; the Lead stages and Lead Status go; Customer Lifecycle gives way to the
   two service pipelines (added as new sample pipelines). Nothing
   that still exists is removed, and an Object deleted since isn't brought back. */
// The version of the defined Contact, Deal and Customer properties (migrateDataModel applies it once).
const PROPERTY_SET_VERSION = 2;
const migrateDataModel = (d) => {
  const objects = (d.objects || []).filter(o => !REMOVED_DEFAULT_OBJECTS.includes(o.id));
  const has = (id) => objects.some(o => o.id === id);
  const associations = (d.associations || [])
    .map(a => a.id === 'as-customers-deals' ? {id:'as-deals-customers', a:'deals', b:'customers', type:'Many-to-many'} : a)
    .map(a => DEFINED_ASSOCIATION_TYPES[a.id] && a.type !== DEFINED_ASSOCIATION_TYPES[a.id] ? {...a, type:DEFINED_ASSOCIATION_TYPES[a.id]} : a)
    .filter(a => has(a.a) && has(a.b));
  /* The Types of Contact pipeline and property lose the Lead stages (Lead isn't part of the object
     model). Lead Status is a defined Contact property again (contacts kept their values). */
  /* Properties saved without a key were damaged by an earlier build (its default properties lost
     their keys): they're dropped, and that Object's default properties come back. */
  const damaged = new Set((d.properties || []).filter(p => !p.key).map(p => p.objectId));
  const restored = DEFAULT_PROPERTIES().filter(dp => damaged.has(dp.objectId) && !(d.properties || []).some(p => p.key && p.objectId === dp.objectId && p.key === dp.key));
  let properties = [...(d.properties || []).filter(p => p.key), ...restored].filter(p => has(p.objectId) || p.objectId === 'users')
    .map(p => p.objectId === 'contacts' && p.key === 'contactType' && p.options ? {...p, options:p.options.filter(o => !REMOVED_CONTACT_STAGES.includes(o))} : p)
    // Owner Assignment Date is one name across Contacts, Deals and Customers (was Contact Owner / Deal / Customer Assignment Date).
    .map(p => p.key === 'ownerAssigned' && ['Contact Owner Assignment Date', 'Deal Assignment Date', 'Customer Assignment Date'].includes(p.label) ? {...p, label:'Owner Assignment Date'} : p);
  /* Once, for settings saved before the defined Contact, Deal and Customer properties: each record
     type's defined properties in their order — a saved one keeps its values and settings but takes
     its defined name, and becomes system-generated or archived where defined — then any custom
     ones. Later renames, restores and changes are kept. */
  if((d.propertySet || 0) < PROPERTY_SET_VERSION){
    const defs = DEFAULT_PROPERTIES();
    ['contacts', 'deals', 'customers'].filter(has).forEach(obj => {
      const saved = properties.filter(p => p.objectId === obj), mine = defs.filter(p => p.objectId === obj);
      const merged = [...mine.map(dp => {
        const s = saved.find(x => x.key === dp.key);
        if(!s) return dp;
        return {...s, label:dp.label, ...(dp.formLabel ? {formLabel:dp.formLabel} : {}), locked:dp.locked || s.locked, ...(dp.auto ? {auto:true, onCreate:false, mandatory:false} : {}),
          ...(dp.derived ? {derived:true} : {}), ...(dp.archived ? {archived:true} : {}), ...(dp.options && !(s.options || []).length ? {options:dp.options} : {})};
      }), ...saved.filter(x => !mine.some(dp => dp.key === x.key))];
      properties = [...properties.filter(p => p.objectId !== obj), ...merged];
    });
  }
  // Users' properties: the defined ones (saved ones as saved), then any added.
  properties = [...properties, ...userDefaultProperties().filter(up => !properties.some(p => p.objectId === 'users' && p.key === up.key))];
  // Form Name and Form Submission Date, on each record type that doesn't have them yet.
  properties = [...properties, ...['contacts', 'deals', 'customers'].filter(has).flatMap(formRecordProperties).filter(fp => !properties.some(p => p.objectId === fp.objectId && p.key === fp.key))];
  // The sources gained Website Form (a Website RFQ or public-link submission).
  properties = properties.map(p => p.key === 'source' && ['contacts', 'deals', 'customers'].includes(p.objectId) && (p.options || []).length && !p.options.includes('Website Form') ? {...p, options:[...p.options, 'Website Form']} : p);
  /* Property types saved before are their new types (propertyTypes.jsx); the system properties
     take their defined type (Email, Phone Number, Country, Timestamp, a currency-only Currency). */
  const defined = DEFAULT_PROPERTIES();
  properties = properties.map(p => {
    // Only a type saved before the new types takes its defined one (a type changed since is kept).
    const legacy = p.type in LEGACY_PROPERTY_TYPES || p.inputType;
    const def = legacy && p.system && defined.find(x => x.objectId === p.objectId && x.key === p.key);
    const type = def ? def.type : propertyTypeId(p.type === 'Single-line text' && p.inputType === 'email' ? 'Email' : p.type);
    const {inputType, ...rest} = p;
    const currencyOnly = p.currencyOnly || (p.system && p.objectId === 'deals' && p.key === 'currency' && propertyTypeId(type) === 'Currency');
    return {...rest, type, ...(currencyOnly ? {currencyOnly:true} : {})};
  });
  const pipelines = (d.pipelines || []).filter(p => has(p.objectId) && !REMOVED_PIPELINE_IDS.includes(p.id))
    .map(p => p.objectId === 'contacts' && p.source === 'property' ? {...p, stages:p.stages.filter(st => !REMOVED_CONTACT_STAGES.includes(st.value))} : p)
    // Every stage has a Stage Type; an "Outcome stage" saved before takes its type from its name.
    .map(p => ({...p, stages:(p.stages || []).map(withStageType)}));
  // Customer Profile forms (Settings → Customer Profile): saved ones as saved, shipped ones added.
  // The assessment templates of the discarded scoring system go.
  const profileForms = withSeedProfileForms(d.profileForms);
  const {assessmentTemplates, ...rest} = d;
  return {...rest, objects, associations, properties, pipelines, profileForms, propertySet:PROPERTY_SET_VERSION, propertiesObjectId: has(d.propertiesObjectId) ? d.propertiesObjectId : null};
};

/* Pipelines — one store for every Object's pipelines. Contacts' Types of Contact is the existing
   property-driven pipeline (board.jsx); US NIW is the first Deal pipeline, then Australia and
   Canada — one pipeline — with the same stages (its own copy; no workflows yet). Stage names are kept exactly
   as given; entering / leaving / skipping / reversing stages is not defined yet. */
const stageList = (labels) => labels.map(label => ({id:label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label}));
// Each stage's Stage Type (board.jsx): Open unless given. Closed stages sit outside the ordered stages.
const typed = (types) => (s) => ({...s, type:types[s.id] || 'open'});
// Deal Won, Postponed and Deal Lost close a deal: Won, Undecided, Lost.
const US_NIW_STAGES = stageList(['Qualified Client', 'CCL Sent', 'Last Month Rollover', 'Expected Sale', 'Payment Made', 'Deal Won', 'Postponed', 'Deal Lost'])
  .map(typed({'deal-won':'won', 'postponed':'undecided', 'deal-lost':'lost'}));
/* Customer service pipelines, stage names exactly as given. The closing stages are closed types,
   as Deal Won / Deal Lost on deals. */
const CANADA_AUS_SERVICE_STAGES = stageList(['Initial Welcome Call', 'ECA', 'IELTS', 'Spouse Sponsorship', 'Express Entry & PNP', 'NOI/ITA',
  'Waiting for Nomination', 'COPR', 'Resubmission', 'Completely Closed', 'Visa Granted - Completely Closed'])
  .map(typed({'completely-closed':'undecided', 'visa-granted-completely-closed':'won'}));
const USA_NIW_SERVICE_STAGES = stageList(['Welcome Call', 'Phase 1 Document Collection', 'IEE', 'Phase 2 Document Collection', 'Brainstorming',
  'Petition Preparation', 'Petition Review', 'Forms Filing', 'Merging', 'Petition Filed', 'Tracking Notice', 'RFE Received', 'Re-Send Petition',
  'Waiting for Appointment', 'Appointment Received', 'Visa Granted', 'Visa Denied'])
  .map(typed({'visa-granted':'won', 'visa-denied':'lost'}));
const DEFAULT_PIPELINES = () => [
  ...PIPELINES.map(p => ({...p, objectId:'contacts'})),
  {id:'us-niw', label:'US NIW', objectId:'deals', source:'record', stages:US_NIW_STAGES},
  {id:'australia-canada', label:'Australia and Canada', objectId:'deals', source:'record', stages:US_NIW_STAGES.map(s => ({...s}))},
  // Customers: the service each customer receives after the sale — one pipeline per service.
  {id:'canada-aus-service', label:'Canada & AUS Service', objectId:'customers', source:'record', stages:CANADA_AUS_SERVICE_STAGES},
  {id:'usa-niw-service', label:'USA NIW - Service', objectId:'customers', source:'record', stages:USA_NIW_SERVICE_STAGES},
];
// Customer Lifecycle was the first Customer pipeline; the two service pipelines replace it.
const REMOVED_PIPELINE_IDS = ['customer-lifecycle'];
/* The deal pipeline a customer's service follows from (a customer saved in a removed pipeline, or
   placed by its deal): US NIW → USA NIW - Service; Australia and Canada → Canada & AUS Service. */
const CUSTOMER_PIPELINE_FOR_DEAL = {'us-niw':'usa-niw-service', 'australia-canada':'canada-aus-service'};
const objectPipelines = (data, objectId) => (data.pipelines || []).filter(p => p.objectId === objectId);
/* A record's own (manual) pipelines — the Pipeline property's choices: a deal or customer is in
   exactly one of them (its Pipeline and Stage). Property-based pipelines are views of a property,
   so a record shows in every one of them; Contacts have only property-based pipelines. */
const recordPipelines = (data, objectId) => objectPipelines(data, objectId).filter(p => p.source !== 'property');
const recordInPipeline = (pipeline, record) => pipeline.source === 'property' || record.pipeline === pipeline.id;
const DEFAULT_DATA_MODEL = () => ({
  objects:DEFAULT_OBJECTS.map(o => ({...o})), associations:DEFAULT_ASSOCIATIONS.map(a => ({...a})),
  properties:DEFAULT_PROPERTIES(), propertiesObjectId:null, pipelines:DEFAULT_PIPELINES(),
});

const objectAssociations = (data, objectId) => data.associations.filter(a => a.a === objectId || a.b === objectId);
/* Objects a record can be created through (Create through associated object): the Objects it's
   associated with in Settings that have records today. */
const RECORD_OBJECTS = ['contacts', 'deals', 'customers'];
/* What each Object's records can create, through their associations: a contact — a deal or a
   customer; a deal — a customer (and its contact, as before); a customer — a deal. */
const CREATION_PATHS = {contacts:['deals', 'customers'], deals:['contacts', 'customers'], customers:['deals']};
const creationAssociations = (data, objectId) => objectAssociations(data, objectId).map(a => a.a === objectId ? a.b : a.a)
  .filter(o => RECORD_OBJECTS.includes(o) && (CREATION_PATHS[objectId] || []).includes(o));
// A record type's properties in use — archived ones are hidden everywhere but Settings (allObjectProperties).
const allObjectProperties = (data, objectId) => data.properties.filter(p => p.objectId === objectId);
const objectProperties = (data, objectId) => allObjectProperties(data, objectId).filter(p => !p.archived);
// What a creation form reads: the Object's properties, required = available && mandatory.
const objectFormProperties = (data, objectId) => objectProperties(data, objectId).map(p => ({...p, required:p.onCreate && p.mandatory}));
// Users hold properties too (not an Object: no pipelines, no records of their own here).
const objectName = (data, id) => id === 'users' ? 'Users' : (data.objects.find(o => o.id === id) || {}).name || id;
const PROPERTY_HOLDERS = (data) => [...data.objects, {id:'users', name:'Users'}];
// Keys are unique per Object, so two Objects can each have a "Status".
const propertyKey = (objectId, label) => `cp_${objectId}_` + label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/* ── Property values: one input per type, and how a value is stored on the record ─────────── */

/* Stored values read like the rest of the record ("Oct 6, 2026", "Oct 6, 2026, 3:00 PM"); grouped
   values (Currency, Location, the ranges) keep their parts. `p`: the property (or its type). */
const storePropertyValue = (p, v) => storePropertyValueOf(p, v);
const inputPropertyValue = (p, stored) => loadPropertyValueOf(p, stored);
// Empty in any shape: blank text, no list items, a group with no part filled in.
const isEmptyValue = (v) => v === undefined || v === null || v === false || (Array.isArray(v) ? !v.length
  : typeof v === 'object' ? Object.values(v).every(x => x === undefined || x === null || String(x).trim() === '') : !String(v).trim());

/* The control a property's type generates on a form (propertyTypes.jsx). */
function PropertyInput(props){ return <TypedPropertyInput {...props}/>; }

/* Contacts' custom properties as grid columns, filters and select values (merged into the
   Contacts table's RecordSchema). */
/* A property as a filter — one shape for every Object (Contacts, Deals, Customers, and the
   associated-object filters): its type's operators (all but Changed / Did not change, which
   workflows evaluate over time), its value control and matching (propertyTypes.jsx). `type` is
   the value control's kind for the filter row; `ptype` / `prop` drive the rest. */
const propertyFilterType = (t) => ({date:'date', number:'number', amount:'number', choice:'select', multi:'select'})[propertyCompare(t)] || 'text';
const propertyFilterMeta = (p) => ({key:p.key, label:p.label, type:propertyFilterType(p), ptype:propertyTypeId(p.type), prop:p,
  operators:propertyOperators(p, {withChange:false}).map(o => ({...o, values: o.noValue ? 0 : o.multi ? 'multi' : 1}))});
/* The Contacts table, filters and select values, from the Contact properties in Settings (system
   and custom alike, in their order). Rows show the owner's name, so Contact Owner filters by
   the users' names. */
const customContactSchema = (props) => {
  const all = props || [];
  const width = (k) => (CONTACT_PROPERTIES.find(p => p.key === k) || {}).width || 170;
  return {
    properties:all.map(p => ({key:p.key, label:p.label, width:width(p.key)})),
    filterProps:all.map(propertyFilterMeta),
    selectValues:{...Object.fromEntries(all.filter(p => p.options).map(p => [p.key, p.options])),
      ...Object.fromEntries(all.filter(p => p.type === 'User').map(p => [p.key, USER_DIRECTORY.map(u => u.name)]))},
  };
};

/* Type-specific configuration, shared by Add Property and the Create Record / record details
   panels: named options (add / remove) for the selection types — Single Selection shows radio
   buttons under three options, a dropdown from three; Custom Range's label and optional bounds. */
function PropertyTypeConfig({type, options, setOptions, range, setRange}){
  if(propertyTypeId(type) === 'Custom Range'){
    const r = range || {}, set = (patch) => setRange && setRange({...r, ...patch});
    return (
      <div style={{display:'flex', gap:8}}>
        <div style={{flex:2, minWidth:0}}><label style={fieldLabel}>Range label</label><input value={r.label || ''} onChange={e=>set({label:e.target.value})} placeholder="e.g. Budget (AED)" style={fieldInput}/></div>
        <div style={{flex:1, minWidth:0}}><label style={fieldLabel}>Minimum</label><input type="number" value={r.min ?? ''} onChange={e=>set({min:e.target.value})} placeholder="Any" style={fieldInput}/></div>
        <div style={{flex:1, minWidth:0}}><label style={fieldLabel}>Maximum</label><input type="number" value={r.max ?? ''} onChange={e=>set({max:e.target.value})} placeholder="Any" style={fieldInput}/></div>
      </div>
    );
  }
  if(CHOICE_TYPES.includes(propertyTypeId(type))) return (
    <div>
      <label style={fieldLabel}>Options</label>
      <div style={{display:'flex', flexDirection:'column', gap:6}}>
        {options.map((o, i) => (
          <div key={i} style={{display:'flex', alignItems:'center', gap:6}}>
            <input value={o} onChange={e=>setOptions(options.map((x, j) => j === i ? e.target.value : x))} placeholder={`Option ${i + 1}`} style={fieldInput}/>
            <button title="Remove option" disabled={options.length === 1} onClick={()=>setOptions(options.filter((x, j) => j !== i))}
              style={{border:'none', background:'transparent', cursor: options.length === 1 ? 'default' : 'pointer', display:'flex', padding:4, opacity: options.length === 1 ? .35 : 1}}>
              <Icon name="close" size={13} color={T.gray600}/>
            </button>
          </div>
        ))}
      </div>
      <button onClick={()=>setOptions([...options, ''])} style={{marginTop:6, display:'inline-flex', alignItems:'center', gap:6, border:'none', background:'transparent', padding:'4px 0', cursor:'pointer', fontFamily:'inherit', fontSize:13, color:T.attioBlue}}>
        <Icon name="plus" size={13} color={T.attioBlue}/> Add option
      </button>
    </div>
  );
  return null;
}
// A Custom Range's bounds, if set, in order.
const rangeConfigOk = (range) => { const a = ptNumberOrNull((range || {}).min), b = ptNumberOrNull((range || {}).max); return a === null || b === null || a <= b; };
const ptNumberOrNull = (v) => v === '' || v == null || isNaN(Number(v)) ? null : Number(v);
const typeConfigOk = (type, options, range) => CHOICE_TYPES.includes(propertyTypeId(type)) ? (options || []).some(o => o.trim())
  : propertyTypeId(type) === 'Custom Range' ? rangeConfigOk(range) : true;
// A property's type settings as saved: options (selection types), range (Custom Range).
const typeSettings = (type, options, range) => ({
  options: CHOICE_TYPES.includes(propertyTypeId(type)) ? cleanOptions(options || []) : undefined,
  range: propertyTypeId(type) === 'Custom Range' ? {label:((range || {}).label || '').trim(), min:ptNumberOrNull((range || {}).min), max:ptNumberOrNull((range || {}).max)} : undefined,
});
const cleanOptions = (options) => options.map(o => o.trim()).filter(Boolean);

/* ── Shared by Settings → Records, Properties and Pipelines ── */
/* Show in Creation Form, and — only while it's on — Mandatory (required on that form). `locked`:
   a property the system keeps as it is (Name, Owner; ones set automatically). */
function CreationFormToggles({onCreate, mandatory, onChange, locked, lockedTitle}){
  const item = {display:'inline-flex', alignItems:'center', gap:8, fontSize:12.5, color:T.gray600};
  return (
    <div title={locked ? lockedTitle : undefined} style={{display:'flex', alignItems:'center', gap:20, whiteSpace:'nowrap', opacity: locked ? .6 : 1, pointerEvents: locked ? 'none' : 'auto'}}>
      <span style={item}><UtToggle on={!!onCreate} onChange={v=>onChange({onCreate:v, mandatory: v ? !!mandatory : false})}/> Show in Creation Form</span>
      {onCreate && <span style={item}><UtToggle on={!!mandatory} onChange={v=>onChange({onCreate:true, mandatory:v})}/> Mandatory</span>}
    </div>
  );
}
const lockedPropertyTitle = (p) => p && p.auto ? 'Set automatically by the system' : 'Required — always shown and mandatory';
/* A property in the record type panel (Create Record, a record type's details): label, type, its
   type's settings, the creation-form toggles. An existing system property keeps its label and type
   (and its options); a locked one keeps its toggles. `onRemove`: a property being added. */
function DraftPropertyFields({p, duplicate, setProp, onRemove, onArchive}){
  // The record's name, owner, pipeline and stage keep their type (the record relies on them); every other part is editable.
  const fixed = !!p.locked, readOnly = {background:T.pageBg, color:T.gray600};
  return (<>
    <div style={{display:'flex', alignItems:'flex-end', gap:12}}>
      <div style={{flex:1, minWidth:0}}>
        <label style={fieldLabel}>Property Label</label>
        <input autoFocus={!p.existing} value={p.label} onChange={e=>setProp({label:e.target.value})} placeholder="e.g. Status" style={fieldInput}/>
      </div>
      <div style={{flex:1, minWidth:0}}>
        <label style={fieldLabel}>Property Type</label>
        {fixed ? <div style={{...fieldInput, ...readOnly}}>{propertyTypeId(p.type)}</div>
          : <FormSelect value={propertyTypeId(p.type)} placeholder="Select type" options={PROPERTY_TYPES} onChange={v=>v && setProp({type:v})}/>}
      </div>
      {onRemove ? <button title="Remove property" onClick={onRemove} style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:'0 2px 9px'}}>
        <Icon name="trash" size={14} color={T.gray600}/>
      </button> : onArchive && !fixed ? <button title="Archive property" aria-label={`Archive ${p.label}`} onClick={onArchive} style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:'0 2px 9px'}}>
        <Icon name="archive" size={14} color={T.gray600}/>
      </button> : <span style={{width:18, flexShrink:0}}/>}
    </div>
    {duplicate && <div style={{fontSize:12, color:T.red, marginTop:-4}}>Another property here already has this label.</div>}
    {<PropertyTypeConfig type={p.type} options={p.options} setOptions={v=>setProp({options:v})} range={p.range} setRange={v=>setProp({range:v})}/>}
    <CreationFormToggles onCreate={p.onCreate} mandatory={p.mandatory} onChange={setProp} locked={p.locked} lockedTitle={lockedPropertyTitle(p)}/>
  </>);
}
const draftToProperty = (objectId, p) => ({key:propertyKey(objectId, p.label), label:p.label.trim(), type:p.type, system:false, objectId,
  onCreate:p.onCreate !== false, mandatory:p.onCreate !== false && !!p.mandatory, locked:false, ...typeSettings(p.type, p.options, p.range)});
/* The workflow quick action (as on a pipeline's stages): the icon opens a new workflow in that
   context — the builder over the page, as from a pipeline. */
const workflowQuickAction = (onClick) => <button title="Add Workflow" aria-label="Add Workflow" onClick={onClick} style={stageWorkflowBtn}><Icon name="workflows" size={15} color={T.attioMuted}/></button>;
// The shared builder (workflows.jsx) over the Settings page; the Settings menu collapses meanwhile.
function SettingsWorkflow({data, setData, initial, onClose, onStub, onWorkflowOpen}){
  React.useEffect(() => { if(!onWorkflowOpen) return; onWorkflowOpen(true); return () => onWorkflowOpen(false); }, []);
  return <WorkflowEditorOverlay data={data} setData={setData} workflow={initial} onClose={onClose} onStub={onStub}/>;
}
const actionsWithWorkflow = (canWorkflow, onWorkflow, menu) => (
  // Where there's no workflow, its space stays, so the ⋯ menus line up.
  <div style={{display:'flex', alignItems:'center', gap:2}}>{canWorkflow ? workflowQuickAction(onWorkflow) : <span aria-hidden="true" style={{width:28, flexShrink:0}}/>}{menu}</div>
);


/* ── Changing a property or a relationship: what it does to the records ──
   Before a change is saved, its consequences are worked out on the records it touches and shown
   for confirmation (ConsequencesModal); then they're applied to the records (useRecordEffects).
     · A property's type, options or range change: each value is converted where it still fits and
       cleared where it doesn't (convertPropertyValue) — the counts are shown.
     · Archiving: the property is hidden from forms, tables, cards, filters and workflows; its values
       are kept and come back when it's restored.
     · Deleting (Properties table only): the property and its values on every record go for good.
     · Removing a relationship: the linked records are unlinked (the records stay), and Customer
       Profile and Accounting are no longer shared between them.
   Workflows that use the property are named (they'll need attention), and a property a pipeline
   follows can't change type, be archived or be deleted until the pipeline changes. */
// The holders' records: a record type's, or the users (their values: what's set, else generated).
const holderRecords = (data, records, objectId) => objectId === 'users'
  ? (data.users || []).map(u => ({id:u.id, ...(typeof userPropertiesOf === 'function' ? userPropertiesOf(data, u.id) || {} : u.profile || {})})) : (records[objectId] || []);
const holderNoun = (data, objectId, n) => { const one = objectName(data, objectId).replace(/s$/, '').toLowerCase(); return `${n.toLocaleString('en-US')} ${n === 1 ? one : `${one}s`}`; };
const workflowsUsingProperty = (data, p) => (data.workflows || []).filter(w => (p.objectId === 'users' || (w.context || {}).object === p.objectId) && JSON.stringify(w).includes(`"${p.key}"`));
const pipelinesFollowing = (data, p) => (data.pipelines || []).filter(pl => pl.objectId === p.objectId && pl.source === 'property' && pl.propertyKey === p.key);
const typeShapeChanged = (a, b) => propertyTypeId(a.type) !== propertyTypeId(b.type) || JSON.stringify(a.options || []) !== JSON.stringify(b.options || [])
  || JSON.stringify(a.range || null) !== JSON.stringify(b.range || null) || !!a.currencyOnly !== !!b.currencyOnly;
/* One change's consequences: {lines, blockers}. `change`: {kind:'edit', before, after} |
   {kind:'archive' | 'delete', before} | {kind:'unlink', association}. */
function changeConsequences(data, records, change){
  const lines = [], blockers = [];
  if(change.kind === 'unlink'){
    const a = change.association, n = associationLinkCount(records, a);
    lines.push(`${objectName(data, a.a)} ↔ ${objectName(data, a.b)} removed — ${n ? `${n.toLocaleString('en-US')} linked ${n === 1 ? 'record' : 'records'} will be unlinked (the records stay)` : 'no records are linked'}; Customer Profile and Accounting won't be shared between them.`);
    return {lines, blockers};
  }
  const p = change.before, recs = holderRecords(data, records, p.objectId), withValue = recs.filter(r => !propertyIsEmpty(p, r[p.key]));
  const flows = workflowsUsingProperty(data, p), pipes = pipelinesFollowing(data, p);
  const usedIn = flows.length ? ` Used in ${flows.length === 1 ? 'the workflow' : `${flows.length} workflows`} ${flows.map(w => `“${w.name || 'Untitled workflow'}”`).join(', ')} — ${flows.length === 1 ? 'it' : 'they'} will need attention.` : '';
  if(change.kind === 'archive'){
    if(pipes.length) blockers.push(`${p.label} drives the pipeline ${pipes.map(x => `“${x.label}”`).join(', ')} — change the pipeline first.`);
    lines.push(`${p.label} will be archived: hidden from forms, tables, cards, filters and workflows. The values on ${holderNoun(data, p.objectId, withValue.length)} are kept and come back if it's restored.${usedIn}`);
  } else if(change.kind === 'delete'){
    if(pipes.length) blockers.push(`${p.label} drives the pipeline ${pipes.map(x => `“${x.label}”`).join(', ')} — change the pipeline first.`);
    lines.push(`${p.label} and its values on ${holderNoun(data, p.objectId, withValue.length)} will be deleted permanently. This can't be undone.${usedIn}`);
  } else if(change.kind === 'edit' && typeShapeChanged(p, change.after)){
    const a = change.after, typeChanged = propertyTypeId(p.type) !== propertyTypeId(a.type);
    if(typeChanged && pipes.length && propertyTypeId(a.type) !== 'Single Selection') blockers.push(`${p.label} drives the pipeline ${pipes.map(x => `“${x.label}”`).join(', ')} — its type can't change while it does.`);
    const results = withValue.map(r => convertPropertyValue(p, a, r[p.key])), cleared = results.filter(x => x.cleared).length;
    const what = typeChanged ? `${p.label}: ${propertyTypeId(p.type)} → ${propertyTypeId(a.type)}.` : `${p.label}: its ${CHOICE_TYPES.includes(propertyTypeId(a.type)) ? 'options' : 'settings'} change.`;
    const kept = withValue.length - cleared, fit = cleared === 1 ? 'it doesn’t' : 'they don’t';
    const outcome = !cleared ? `all ${typeChanged ? 'will be converted' : 'stay'}` : !kept ? `${withValue.length === 1 ? 'it' : `all ${withValue.length.toLocaleString('en-US')}`} will be cleared because ${fit} fit the new ${typeChanged ? 'type' : 'options'}`
      : `${kept.toLocaleString('en-US')} will be ${typeChanged ? 'converted' : 'kept'}, ${cleared.toLocaleString('en-US')} cleared because ${fit} fit`;
    if(withValue.length) lines.push(`${what} ${holderNoun(data, p.objectId, withValue.length)} ${withValue.length === 1 ? 'has' : 'have'} a value — ${outcome}.${usedIn}`);
    else if(flows.length) lines.push(`${what}${usedIn}`);
    if(pipes.length && JSON.stringify(p.options || []) !== JSON.stringify(a.options || [])) lines.push(`The pipeline ${pipes.map(x => `“${x.label}”`).join(', ')} keeps its stages — edit them in Pipelines.`);
  }
  return {lines, blockers};
}
// How many links a relationship holds now (the defined ones store them on the records; others hold none yet).
const ASSOCIATION_LINKS = {
  'contacts|deals':     {count:(r) => (r.deals || []).filter(d => d.contactId != null).length,      unlink:[['deals', (d) => d.contactId != null ? {...d, contactId:null} : d]]},
  'contacts|customers': {count:(r) => (r.customers || []).filter(c => c.contactId != null).length,  unlink:[['customers', (c) => c.contactId != null ? {...c, contactId:null} : c]]},
  'customers|deals':    {count:(r) => (r.customers || []).reduce((n, c) => n + (c.dealIds || []).length, 0), unlink:[['customers', (c) => (c.dealIds || []).length ? {...c, dealIds:[]} : c]]},
};
const associationPair = (a) => [a.a, a.b].sort().join('|');
const associationLinkCount = (records, a) => { const l = ASSOCIATION_LINKS[associationPair(a)]; return l ? l.count(records || {}) : 0; };
/* Applies the changes' effects to the records: `updateRecords(objectId, fn)` (App's record stores);
   a user's values are on the user (settings data). */
function useRecordEffects(setData, updateRecords){
  return (changes) => (changes || []).forEach(ch => {
    if(ch.kind === 'unlink'){ const l = ASSOCIATION_LINKS[associationPair(ch.association)]; if(l && updateRecords) l.unlink.forEach(([object, fn]) => updateRecords(object, rs => rs.map(fn))); return; }
    if(ch.kind === 'archive') return;   // values stay
    const p = ch.before, rewrite = ch.kind === 'delete' ? () => undefined
      : (v) => { const c = convertPropertyValue(p, ch.after, v); return c.cleared ? '' : c.value; };
    if(ch.kind === 'edit' && !typeShapeChanged(p, ch.after)) return;
    const apply = (r) => { if(!(p.key in r)) return r; const v = rewrite(r[p.key]); if(v === undefined){ const {[p.key]:_, ...rest} = r; return rest; } return samePropertyValue(v, r[p.key]) ? r : {...r, [p.key]:v}; };
    if(p.objectId === 'users') setData(d => ({...d, users:d.users.map(u => { const cur = (holderRecords(d, {}, 'users').find(x => x.id === u.id) || {});
      if(propertyIsEmpty(p, cur[p.key])) return u; const v = rewrite(cur[p.key]); const profile = {...(u.profile || {})};
      if(v === undefined) delete profile[p.key]; else profile[p.key] = v; return {...u, profile}; })}));
    else if(updateRecords) updateRecords(p.objectId, rs => rs.map(apply));
  });
}
// The confirmation: what the changes will do; blocked ones can't be saved.
function ConsequencesModal({title = 'Review changes', lines, blockers, confirmLabel = 'Save changes', danger, onCancel, onConfirm}){
  const blocked = (blockers || []).length > 0;
  return (
    <StModal title={title} primary={blocked ? undefined : confirmLabel} danger={danger} canSubmit={!blocked} onCancel={onCancel} onSubmit={onConfirm} width={520}>
      <div style={{display:'flex', flexDirection:'column', gap:10}}>
        {(blockers || []).map((b, i) => <div key={`b${i}`} style={{fontSize:13, color:T.red, lineHeight:1.5}}>{b}</div>)}
        {lines.map((l, i) => <div key={i} style={{fontSize:13, color:T.attioText, lineHeight:1.5, paddingLeft:12, borderLeft:`2px solid ${T.attioLine}`}}>{l}</div>)}
      </div>
    </StModal>
  );
}

/* ── Settings → Objects ─────────────────────────────────────────────────────────────────── */

const OBJECT_COLS = [
  {key:'name', label:'Record Name', width:240}, {key:'records', label:'Total Entries', width:120}, {key:'assoc', label:'Associated Records', width:180},
  {key:'props', label:'Properties', width:160}, {key:'group', label:'Group', width:160}, {key:'createdBy', label:'Created By', width:170},
];
/* `records`: each Object's records ({contacts, deals, customers}); an Object without a records
   store has none. The Records count is information only (not a link). */
function ObjectsSettings({data, setData, navigate, records = {}, updateRecords, onWorkflowOpen, target, onTargetDone}){
  const applyEffects = useRecordEffects(setData, updateRecords);
  const [creating, setCreating] = React.useState(false);
  const [stub, setStub] = React.useState(null);
  const [deleting, setDeleting] = React.useState(null);   // the Object being deleted
  const [details, setDetails] = React.useState(null);     // the record type whose details are open
  const [workflow, setWorkflow] = React.useState(null);   // a new workflow for a record type
  // Quick Search: open the record type's details.
  React.useEffect(() => { if(!target) return; if(target.kind === 'record') setDetails(target.id); onTargetDone && onTargetDone(); }, [target && target.nonce]);
  const recordCount = (id) => (records[id] || []).length;
  // Settings & Administration → Records: each record type shows to those who may view it.
  const rows = React.useMemo(()=>data.objects.filter(o => adminRecordsCan('view', o)).map(o => {
    const a = objectAssociations(data, o.id).length, p = objectProperties(data, o.id).length;
    return {...o, assocCount:a, propCount:p, assoc:String(a), props:String(p), records:String(recordCount(o.id)), createdBy:creatorOf(o)};
  }), [data.objects, data.associations, data.properties, records]);
  const schema = {
    properties:OBJECT_COLS, filterProps:[{key:'name', label:'Record Name', type:'text'}, {key:'group', label:'Group', type:'select'}],
    selectValues:{group:OBJECT_GROUPS}, noun:'record', searchKeys:['name', 'group'], fillWidth:true,
    /* Counts are underlined numbers. Properties opens the Properties view filtered to this Object;
       what Associated Objects opens is not defined yet. */
    renderCell: (key, r) => key === 'props'
      ? countLink(r.propCount, ()=>{ setData(d => ({...d, propertiesObjectId:r.id})); navigate('settings.properties'); })
      : key === 'assoc' ? countLink(r.assocCount, ()=>setStub(`${r.name} · Associated Records`))
      // The name opens the record type's details.
      : key === 'name' ? <ContactName name={r.name} onOpen={()=>setDetails(r.id)} style={{fontSize:'inherit', fontWeight:500}}/>
      : undefined,
    // Actions: the workflow quick action (record types workflows run on), then ⋯.
    renderActions: (r) => { const o = data.objects.find(x => x.id === r.id); const items = [
        ...(adminRecordsCan('edit', o) ? [{label:'Edit Record', onClick:()=>setStub(`Edit ${r.name}`)}] : []),
        ...(adminRecordsCan('delete', o) ? [{label:'Delete Record', danger:true, onClick:()=>setDeleting(data.objects.find(o => o.id === r.id))}] : []),
      ];
      return actionsWithWorkflow(workflowsAvailableFor(r.id) && workflowCan('create'), ()=>setWorkflow(newWorkflowDraft({object:r.id}, {type:'record', objectId:r.id})),
        items.length ? <RowActionsMenu title="Record actions" items={items}/> : null); },
  };
  return (
    <div style={{position:'relative', flex:1, minHeight:0, display:'flex', flexDirection:'column', overflow:'hidden'}}>
    <SettingsPage fill>
      <div style={{display:'flex', flexDirection:'column', flex:1, minHeight:0}}>
        {/* Its own store: views saved before the rename were called All Objects, without Total Entries. */}
        <RecordViewsModule flushTop storeKey="views:ov-all-v2" schema={schema} rows={rows} columns={OBJECT_COLS.map(c => c.key)} defaultViews={[{id:'ov-all', name:'All Records'}]}
          actions={() => adminRecordsCan('create') && <button onClick={()=>setCreating(true)} title="Create Record" style={iconBtn}><Icon name="plus" size={14} color={T.gray800}/></button>}/>
      </div>
      {creating && <CreateObjectPanel data={data} onClose={()=>setCreating(false)}
        onCreate={(obj, assocs, props) => {
          // A new record type and its properties are their creator's.
          const by = CURRENT_USER.name;
          setData(d => ({...d, objects:[...d.objects, {...obj, createdBy:by}], associations:[...d.associations, ...assocs], properties:[...d.properties, ...props.map(p => ({...p, createdBy:by}))]}));
          setCreating(false);
        }}/>}
      {deleting && <DeleteObjectModal data={data} object={deleting} recordCount={recordCount(deleting.id)} onClose={()=>setDeleting(null)}
        onDelete={() => { setData(d => deleteObjectFrom(d, deleting.id)); setDeleting(null); }}/>}
      {details && <RecordDetailsPanel data={data} objectId={details} records={records} onClose={()=>setDetails(null)}
        onSave={({object, associations, properties}, changes) => {
          applyEffects(changes);
          setData(d => ({...d, objects:d.objects.map(o => o.id === object.id ? object : o),
            associations:[...d.associations.filter(a => a.a !== object.id && a.b !== object.id), ...associations],
            // Each property where it was (its order across Settings kept); new ones after.
            properties:[...d.properties.map(p => p.objectId === object.id ? properties.find(x => x.key === p.key) || null : p).filter(Boolean),
              ...properties.filter(x => !d.properties.some(p => p.objectId === object.id && p.key === x.key))]}));
          setDetails(null);
        }}/>}
      {stub && <StubPanel title={stub} onClose={()=>setStub(null)} zIndex={110}/>}
    </SettingsPage>
    {workflow && <SettingsWorkflow data={data} setData={setData} initial={workflow} onClose={()=>setWorkflow(null)} onStub={setStub} onWorkflowOpen={onWorkflowOpen}/>}
    </div>
  );
}

/* A record type's details: the Create Record panel (RecordTypePanel), filled in and editable. */
const RecordDetailsPanel = ({data, objectId, onClose, onSave, records}) => <RecordTypePanel data={data} objectId={objectId} onClose={onClose} onSave={onSave} records={records}/>;


/* Deleting an Object: only when it has no records. Everything that belongs to it goes with it —
   its properties, pipelines, associations, workflows that run on it, and its navigation item —
   listed in the confirmation first, so nothing is removed silently and nothing is left pointing
   at an Object that's gone. */
const objectDependents = (d, id) => ({
  properties:(d.properties || []).filter(p => p.objectId === id),
  pipelines:(d.pipelines || []).filter(p => p.objectId === id),
  associations:objectAssociations(d, id),
  workflows:(d.workflows || []).filter(w => (w.context || {}).object === id),
});
const deleteObjectFrom = (d, id) => {
  const dep = objectDependents(d, id), pipeIds = dep.pipelines.map(p => p.id);
  return {...d,
    objects:d.objects.filter(o => o.id !== id),
    properties:d.properties.filter(p => p.objectId !== id),
    pipelines:(d.pipelines || []).filter(p => !pipeIds.includes(p.id)),
    associations:d.associations.filter(a => a.a !== id && a.b !== id),
    workflows:(d.workflows || []).filter(w => (w.context || {}).object !== id),
    propertiesObjectId: d.propertiesObjectId === id ? null : d.propertiesObjectId};
};
function DeleteObjectModal({data, object, recordCount, onClose, onDelete}){
  const dep = objectDependents(data, object.id);
  const other = (a) => objectName(data, a.a === object.id ? a.b : a.a);
  if(recordCount > 0) return (
    <StModal title={`Delete ${object.name}`} onCancel={onClose}>
      <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>
        {object.name} has {recordCount} {recordCount === 1 ? 'record' : 'records'}. Delete its records first; a record type can be deleted only when it has none.
      </div>
    </StModal>
  );
  const lines = [
    dep.properties.length && `${dep.properties.length} ${dep.properties.length === 1 ? 'property' : 'properties'}`,
    dep.pipelines.length && `${dep.pipelines.length} ${dep.pipelines.length === 1 ? 'pipeline' : 'pipelines'}: ${dep.pipelines.map(p => p.label).join(', ')}`,
    dep.associations.length && `${dep.associations.length} ${dep.associations.length === 1 ? 'association' : 'associations'}: with ${dep.associations.map(other).join(', ')}`,
    dep.workflows.length && `${dep.workflows.length} ${dep.workflows.length === 1 ? 'workflow' : 'workflows'}: ${dep.workflows.map(w => w.name || 'Untitled workflow').join(', ')}`,
    'Its item in the CRM navigation',
  ].filter(Boolean);
  return (
    <StModal title={`Delete ${object.name}`} primary="Delete Record" danger onCancel={onClose} onSubmit={onDelete}>
      <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>{object.name} has no records. Deleting it also deletes:</div>
      <ul style={{margin:0, paddingLeft:18, display:'flex', flexDirection:'column', gap:4}}>
        {lines.map(l => <li key={l} style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>{l}</li>)}
      </ul>
      <div style={stTextB}>This can't be undone.</div>
    </StModal>
  );
}

/* The relationship as plain text + chevron; clicking opens the options. */
const RELATIONSHIP_MENU = ['Many-to-many', 'Many-to-one', 'One-to-many'];
function RelationshipPicker({value, onChange}){
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{position:'relative', flexShrink:0}}>
      <button onClick={()=>setOpen(o => !o)} style={{display:'inline-flex', alignItems:'center', gap:4, border:'none', background:'transparent', padding:0,
        cursor:'pointer', fontFamily:'inherit', fontSize:13, color:T.gray800, whiteSpace:'nowrap'}}>
        {value}<Icon name="chevDown" size={T.chevronSize} color={T.gray600}/>
      </button>
      <MenuShell open={open} onClose={()=>setOpen(false)} anchorRight width={170}>
        {RELATIONSHIP_MENU.map(t => <MenuItem key={t} label={t} icon={t === value ? <Icon name="check" size={11} color={T.blue}/> : <span style={{width:11}}/>}
          onClick={()=>{ onChange(t); setOpen(false); }}/>)}
      </MenuShell>
    </div>
  );
}

/* Create Record — and a record type's details — one right-side panel (the Edit Permissions drawer
   pattern) in two sections. Left: Record Name, Group, Associated Records (fixed-height rows;
   relationship as text + chevron). Right: Properties — each one's label, type and settings, and
   its creation-form toggles; Add Property adds one.
   `objectId`: the record type being edited (else a new one). Everything is editable; what a change
   does to the records is shown before it's saved (ConsequencesModal) — values converted or cleared,
   workflows that use a property, records unlinked. Properties are archived here (restored from
   Archived properties, below a separator) — deleted only in the Properties table. A property keeps
   its key (its records' values stay with it); the record's name, owner, pipeline and stage keep their
   type. The links stored on the records (Contacts → Deals, Contacts → Customers, Deals ↔ Customers)
   keep their relationship type; they can be removed.
   `onSave({object, associations, properties}, changes)`: the record type, its associations and
   properties, and the changes whose effects reach the records. */
const blankDraftProperty = () => ({id:`dp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, label:'', type:PROPERTY_TYPES[0], options:[''], range:{label:'', min:'', max:''}, onCreate:true, mandatory:false});
function RecordTypePanel({data, objectId, onClose, onSave, records = {}}){
  const obj = objectId ? data.objects.find(o => o.id === objectId) : null;
  const editing = !!obj;
  const initial = React.useMemo(() => ({
    name: obj ? obj.name : '', group: obj ? obj.group || '' : '',
    links: Object.fromEntries((obj ? objectAssociations(data, obj.id) : []).map(a => { const other = a.a === obj.id ? a.b : a.a;
      return [other, {type: a.a === obj.id ? a.type : inverseRelationship(a.type), id:a.id, defined:!!DEFINED_ASSOCIATION_TYPES[a.id]}]; })),
    props: (obj ? allObjectProperties(data, obj.id) : []).map(p => ({...p, id:`ex-${p.key}`, existing:true, type:propertyTypeId(p.type), archived:!!p.archived,
      options: p.options && p.options.length ? [...p.options] : [''], range:p.range || {label:'', min:'', max:''}})),
  }), [objectId]);
  const [name, setName] = React.useState(initial.name);
  const [group, setGroup] = React.useState(initial.group);
  const [links, setLinks] = React.useState(initial.links);   // objectId → {type, id?, defined?}
  const [props, setProps] = React.useState(initial.props);
  const [review, setReview] = React.useState(null);   // {lines, blockers, result, changes} before saving
  const n = name.trim();
  const taken = data.objects.some(o => o.id !== objectId && o.name.toLowerCase() === n.toLowerCase());
  const toggle = (id) => setLinks(l => { const x = {...l}; if(x[id]) delete x[id]; else x[id] = {type:'Many-to-many'}; return x; });
  const setProp = (id, patch) => setProps(ps => ps.map(p => p.id === id ? {...p, ...patch} : p));
  const dupLabel = (p) => props.some(x => x !== p && x.label.trim() && x.label.trim().toLowerCase() === p.label.trim().toLowerCase());
  const propsOk = props.every(p => p.label.trim() && !dupLabel(p) && (p.system || typeConfigOk(p.type, p.options, p.range)));
  const changed = !editing || JSON.stringify({name, group, links, props}) !== JSON.stringify(initial);
  const ok = !!n && !taken && !!group && propsOk && changed;
  const active = props.filter(p => !p.archived), archived = props.filter(p => p.archived);
  const build = () => {
    const id = obj ? obj.id : `obj-${n.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
    const associations = Object.entries(links).map(([b, l]) => {
      const before = obj && objectAssociations(data, obj.id).find(a => a.id === l.id);
      if(before && l.defined) return before;   // the defined ones stay as they are
      return before ? {...before, type: before.a === id ? l.type : inverseRelationship(l.type)} : {id:`as-${id}-${b}`, a:id, b, type:l.type};
    });
    const properties = props.map(p => {
      if(!p.existing) return draftToProperty(id, p);
      const {id:_, existing, ...orig} = p, base = allObjectProperties(data, id).find(x => x.key === p.key) || orig;
      const {archived:__, ...rest} = base;
      return {...rest, label:p.label.trim(), ...(p.locked ? {} : {type:p.type}), ...typeSettings(p.locked ? base.type : p.type, p.options, p.range),
        ...(p.locked ? {} : {onCreate:!!p.onCreate, mandatory:!!p.onCreate && !!p.mandatory}), ...(p.archived ? {archived:true} : {})};
    });
    // What reaches the records: a property's shape changing, archiving, a stored link removed.
    const before = (key) => obj && allObjectProperties(data, obj.id).find(x => x.key === key);
    const changes = !obj ? [] : [
      ...properties.filter(p => before(p.key) && !before(p.key).archived && p.archived).map(p => ({kind:'archive', before:before(p.key)})),
      ...properties.filter(p => before(p.key) && !p.archived && typeShapeChanged(before(p.key), p)).map(p => ({kind:'edit', before:before(p.key), after:p})),
      ...objectAssociations(data, obj.id).filter(a => !associations.some(x => x.id === a.id)).map(a => ({kind:'unlink', association:a})),
    ];
    return {result:{object:{...(obj || {}), id, name:n, group}, associations, properties}, changes};
  };
  const save = () => {
    const {result, changes} = build();
    const found = changes.map(ch => changeConsequences(data, records, ch));
    const lines = found.flatMap(f => f.lines), blockers = found.flatMap(f => f.blockers);
    if(lines.length || blockers.length) setReview({lines, blockers, result, changes});
    else onSave(result, changes);
  };
  const sectionLabel = {fontSize:13, fontWeight:500, color:T.attioText};
  return (
    <div style={{position:'fixed', inset:0, zIndex:100}}>
      <div onClick={onClose} style={{position:'absolute', inset:0, background:'rgba(16,24,40,.35)'}}/>
      <div style={{position:'absolute', top:0, right:0, bottom:0, width:960, maxWidth:'100vw', background:'#fff', display:'flex', flexDirection:'column', boxShadow:'-8px 0 24px rgba(16,24,40,.12)'}}>
        <div style={{height:45, flexShrink:0, display:'flex', alignItems:'center', gap:12, padding:'0 16px', borderBottom:`1px solid ${T.borderStrong}`}}>
          <button onClick={onClose} title="Close" style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:0}}><Icon name="close" size={14} color={T.gray600}/></button>
          <span style={{fontSize:14, fontWeight:500, color:T.black}}>{editing ? obj.name : 'Create Record'}</span>
        </div>

        {/* Two sections (the Add Property / Add User / Add Team pattern): one vertical separator,
            each side scrolling on its own, no boxes. */}
        <div style={{flex:1, minHeight:0, display:'flex'}}>
          {/* Left — Record Name, Group (stacked), Associated Records. */}
          <div style={{flex:1, minWidth:0, overflowY:'auto', padding:'16px 24px', display:'flex', flexDirection:'column', gap:14}}>
            <div>
              <label style={fieldLabel} htmlFor="object-name">Record Name</label>
              <input id="object-name" autoFocus={!editing} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Projects" style={fieldInput}/>
              {taken && <div style={{fontSize:12, color:T.red, marginTop:4}}>A record with this name already exists.</div>}
            </div>
            <div>
              <label style={fieldLabel}>Group</label>
              <FormSelect value={group} placeholder="Select group" options={OBJECT_GROUPS} onChange={setGroup}/>
            </div>
            <div>
              <label style={fieldLabel}>Associated Records</label>
              {/* Fixed-height rows (as the Add Team user list) — selecting doesn't change the height;
                  the relationship shows as text + chevron. A defined association stays as it is. */}
              {data.objects.filter(o => o.id !== objectId).map((o, i) => { const l = links[o.id], fixed = l && l.defined; return (
                <div key={o.id} style={{display:'flex', alignItems:'center', gap:10, height:38, boxSizing:'border-box', borderTop: i ? `1px solid ${T.border}` : 'none'}}>
                  <label onClick={()=>toggle(o.id)} style={{flex:1, minWidth:0, display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontSize:13, color:T.attioText, whiteSpace:'nowrap'}}>
                    <RowCheckbox checked={!!l} onChange={()=>toggle(o.id)}/>{o.name}
                  </label>
                  {/* A link stored on the records keeps its relationship type (it's how they're linked). */}
                  {l && (fixed ? <span title="How these records are linked" style={{fontSize:13, color:T.gray600, whiteSpace:'nowrap'}}>{l.type}</span>
                    : <RelationshipPicker value={l.type} onChange={v=>setLinks(x => ({...x, [o.id]:{...x[o.id], type:v}}))}/>)}
                </div>
              ); })}
            </div>
          </div>

          {/* Right — Properties: Add Property top-right; each property's Label and Type, its settings below. */}
          <div style={{flex:1, minWidth:0, overflowY:'auto', padding:'16px 24px', borderLeft:`1px solid ${T.border}`}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6}}>
              <span style={sectionLabel}>Properties</span>
              <button onClick={()=>setProps(ps => [...ps, blankDraftProperty()])} style={{display:'inline-flex', alignItems:'center', gap:6, border:'none', background:'transparent', padding:'4px 0', cursor:'pointer', fontFamily:'inherit', fontSize:13, color:T.attioBlue}}>
                <Icon name="plus" size={13} color={T.attioBlue}/> Add Property
              </button>
            </div>
            {!active.length && <div style={{fontSize:12.5, color:T.gray400, padding:'6px 0'}}>No properties yet.</div>}
            {active.map((p, i) => (
              <div key={p.id} style={{padding:'12px 0', borderTop: i ? `1px solid ${T.border}` : 'none', display:'flex', flexDirection:'column', gap:10}}>
                <DraftPropertyFields p={p} duplicate={dupLabel(p)} setProp={(patch)=>setProp(p.id, patch)}
                  onRemove={p.existing ? null : ()=>setProps(ps => ps.filter(x => x.id !== p.id))} onArchive={p.existing ? ()=>setProp(p.id, {archived:true}) : null}/>
              </div>
            ))}
            {/* Archived properties — below a separator: their values are kept; Restore brings one back. */}
            {archived.length > 0 && (
              <div style={{marginTop:16, paddingTop:12, borderTop:`1px solid ${T.borderStrong}`}}>
                <div style={{...sectionLabel, marginBottom:6}}>Archived properties</div>
                {archived.map(p => (
                  <div key={p.id} style={{display:'flex', alignItems:'center', gap:10, minHeight:38, borderTop:`1px solid ${T.border}`}}>
                    <span style={{flex:1, minWidth:0, fontSize:13, color:T.attioText}}>{p.label} <span style={{color:T.attioMuted}}>· {propertyTypeId(p.type)}</span></span>
                    <button onClick={()=>setProp(p.id, {archived:false})} style={{border:'none', background:'transparent', cursor:'pointer', fontFamily:'inherit', fontSize:13, color:T.attioBlue}}>Restore</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{height:52, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'flex-end', gap:8, padding:'0 16px', borderTop:`1px solid ${T.borderStrong}`}}>
          <button onClick={onClose} style={{padding:'8px 14px', borderRadius:8, border:`1px solid ${T.borderStrong}`, background:'#fff', fontSize:13, cursor:'pointer', fontFamily:'inherit'}}>Cancel</button>
          <button onClick={()=>ok && save()} disabled={!ok} style={{padding:'8px 14px', borderRadius:8, border:'none', fontSize:13, fontWeight:500, fontFamily:'inherit',
            background: ok ? T.black : T.gray400, color:'#fff', cursor: ok ? 'pointer' : 'default'}}>{editing ? 'Save changes' : 'Create record'}</button>
        </div>
      </div>
      {review && <ConsequencesModal lines={review.lines} blockers={review.blockers} onCancel={()=>setReview(null)}
        onConfirm={()=>{ const r = review; setReview(null); onSave(r.result, r.changes); }}/>}
    </div>
  );
}
const CreateObjectPanel = ({data, onClose, onCreate}) => <RecordTypePanel data={data} onClose={onClose} onSave={(r)=>onCreate(r.object, r.associations, r.properties)}/>;

/* ── Settings → Properties ── every property; each belongs to one Object. ─────────────────── */

const PROPERTY_COLS = [
  {key:'label', label:'Property Label', width:260}, {key:'type', label:'Property Type', width:200}, {key:'objectName', label:'Record', width:180}, {key:'createdBy', label:'Created By', width:170},
];
function PropertiesSettings({data, setData, records = {}, updateRecords, onWorkflowOpen, target, onTargetDone}){
  const [editing, setEditing] = React.useState(null);   // 'new' | property
  const [review, setReview] = React.useState(null);     // {title, lines, blockers, confirmLabel, danger, apply}
  const applyEffects = useRecordEffects(setData, updateRecords);
  const findProp = (r) => data.properties.find(p => p.key === r.key && p.objectId === r.objectId);
  const reviewThen = (change, title, confirmLabel, danger, apply) => {
    const c = changeConsequences(data, records, change);
    if(!c.lines.length && !c.blockers.length) return apply();
    setReview({title, ...c, confirmLabel, danger, apply});
  };
  const setArchived = (p, archived) => setData(d => ({...d, properties:d.properties.map(x => x.key === p.key && x.objectId === p.objectId ? (archived ? {...x, archived:true} : (({archived:_, ...rest}) => rest)(x)) : x)}));
  const archive = (p) => reviewThen({kind:'archive', before:p}, `Archive ${p.label}`, 'Archive property', false, () => setArchived(p, true));
  const remove = (p) => reviewThen({kind:'delete', before:p}, `Delete ${p.label}`, 'Delete property', true, () => {
    applyEffects([{kind:'delete', before:p}]);
    setData(d => ({...d, properties:d.properties.filter(x => !(x.key === p.key && x.objectId === p.objectId))}));
  });
  // Quick Search: open the property (Edit Property).
  React.useEffect(() => {
    if(!target) return;
    const p = target.kind === 'property' && data.properties.find(x => x.objectId === target.objectId && x.key === target.key);
    if(p) setEditing(p);
    onTargetDone && onTargetDone();
  }, [target && target.nonce]);
  const [workflow, setWorkflow] = React.useState(null);   // a new workflow for a property
  const [stub, setStub] = React.useState(null);
  const [fromObject] = React.useState(data.propertiesObjectId);
  React.useEffect(()=>{ if(data.propertiesObjectId) setData(d => ({...d, propertiesObjectId:null})); }, []);
  const rows = data.properties.map(p => ({...p, id:`${p.objectId}:${p.key}`, objectName:objectName(data, p.objectId), type:propertyTypeId(p.type), createdBy:creatorOf(p)}));
  // Users' properties have no Properties permissions; the record types' follow Settings & Administration → Properties (by who created each).
  const propCan = (objectId, action, prop) => !ADMIN_RECORD_OBJECTS.includes(objectId) || adminPropertyCan(objectId, action, prop);
  const addableHolders = PROPERTY_HOLDERS(data).filter(o => propCan(o.id, 'add'));
  const archivedTag = <span style={{marginLeft:8, fontSize:11.5, fontWeight:500, color:T.gray600, background:T.headerBg, borderRadius:9999, padding:'1px 8px'}}>Archived</span>;
  const schema = {
    properties:PROPERTY_COLS, noun:'property', nounPlural:'properties', searchKeys:['label', 'type', 'objectName'], fillWidth:true,
    filterProps:[{key:'label', label:'Property Label', type:'text'}, {key:'type', label:'Property Type', type:'select'}, {key:'objectName', label:'Record', type:'select'}],
    selectValues:{type:[...PROPERTY_TYPES, ...SYSTEM_PROPERTY_TYPES], objectName:PROPERTY_HOLDERS(data).map(o => o.name)},
    // Actions: the workflow quick action (a property workflows can watch — its Record and Property as the context), then ⋯.
    /* Settings & Administration → Properties (per record type): Edit (archiving and restoring
       included) and Delete, property by property. User Properties aren't covered by them. */
    renderActions: (r) => { const canEdit = propCan(r.objectId, 'edit', findProp(r)), canDelete = propCan(r.objectId, 'delete', findProp(r));
      const items = [
        ...(canEdit ? [{label:'Edit property', onClick:()=>setEditing(findProp(r))}] : []),
        // The record's name, owner, pipeline and stage stay (the record relies on them).
        ...(r.locked ? [] : [...(canEdit ? [r.archived ? {label:'Restore property', onClick:()=>setArchived(findProp(r), false)} : {label:'Archive property', onClick:()=>archive(findProp(r))}] : []),
          ...(canDelete ? [{label:'Delete property', danger:true, onClick:()=>remove(findProp(r))}] : [])]),
      ];
      return actionsWithWorkflow(workflowsAvailableFor(r.objectId) && workflowCan('create') && triggerProperties(data, r.objectId).some(p => p.key === r.key),
        ()=>setWorkflow(newWorkflowDraft({object:r.objectId, property:r.key}, {type:'property', objectId:r.objectId, propertyKey:r.key})),
        items.length ? <RowActionsMenu title="Property actions" items={items}/> : null); },
    renderCell: (key, r) => key === 'label' && r.archived ? <span style={{color:T.gray600}}>{r.label}{archivedTag}</span> : undefined,
  };
  /* Views: All Properties, Contact / Deal / Customer Properties (by default). From a record type's
     Properties count: its view opens; any other record type filters All Properties to it
     (unsaved) — no view is created. */
  const objectFilter = (name) => ({nodes:[{id:`f-obj-${name}`, kind:'row', joinOp:'AND', prop:'objectName', op:'is', value:name, value2:'', values:[]}]});
  const [focus] = React.useState(() => fromObject ? {prop:'objectName', op:'is', value:objectName(data, fromObject), nonce:Date.now()} : null);
  const same = (a, b) => a.key === b.key && a.objectId === b.objectId;
  return (
    <div style={{position:'relative', flex:1, minHeight:0, display:'flex', flexDirection:'column', overflow:'hidden'}}>
    <SettingsPage fill>
      <div style={{display:'flex', flexDirection:'column', flex:1, minHeight:0}}>
        {/* Its own store (views saved before these defaults keep theirs elsewhere). */}
        <RecordViewsModule flushTop storeKey="views:prv-all-v3" schema={schema} rows={rows} columns={PROPERTY_COLS.map(c => c.key)}
          defaultViews={[{id:'prv-all', name:'All Properties'}, {id:'prv-contacts', name:'Contact Properties', filters:objectFilter(objectName(data, 'contacts'))},
            {id:'prv-deals', name:'Deal Properties', filters:objectFilter(objectName(data, 'deals'))}, {id:'prv-customers', name:'Customer Properties', filters:objectFilter(objectName(data, 'customers'))},
            {id:'prv-users', name:'User Properties', filters:objectFilter('Users')}]} focus={focus}
          actions={() => addableHolders.length > 0 && <button onClick={()=>setEditing('new')} title="Add Property" style={iconBtn}><Icon name="plus" size={14} color={T.gray800}/></button>}/>
      </div>
      {editing && <PropertyModal data={data} property={editing === 'new' ? null : editing} holders={editing === 'new' ? addableHolders : null}
        defaultObjectId={editing === 'new' && !addableHolders.some(o => o.id === fromObject) ? (addableHolders[0] || {}).id : fromObject} onClose={()=>setEditing(null)}
        onSave={(p) => {
          const before = editing === 'new' ? null : editing;
          const apply = () => {
            if(before) applyEffects([{kind:'edit', before, after:p}]);
            // A new property is its creator's.
            setData(d => ({...d, properties: !before ? [...d.properties, {...p, createdBy:CURRENT_USER.name}] : d.properties.map(x => same(x, before) ? p : x)}));
            setEditing(null);
          };
          if(before) reviewThen({kind:'edit', before, after:p}, `Change ${before.label}`, 'Save changes', false, apply); else apply();
        }}/>}
      {review && <ConsequencesModal title={review.title} lines={review.lines} blockers={review.blockers} confirmLabel={review.confirmLabel} danger={review.danger}
        onCancel={()=>setReview(null)} onConfirm={()=>{ const r = review; setReview(null); r.apply(); }}/>}
      {stub && <StubPanel title={stub} onClose={()=>setStub(null)} zIndex={110}/>}
    </SettingsPage>
    {workflow && <SettingsWorkflow data={data} setData={setData} initial={workflow} onClose={()=>setWorkflow(null)} onStub={setStub} onWorkflowOpen={onWorkflowOpen}/>}
    </div>
  );
}

/* Add / Edit Property. Left: label, type and that type's configuration. Right: the one Object it
   belongs to, and that Object's settings — Available During Creation and Mandatory (only when
   available). An existing contact field keeps its label, type and Object; Name and Contact Owner
   stay locked on. */
// `holders`: the record types a new property can be added to (the signed-in user's Add permission).
function PropertyModal({data, property, defaultObjectId, onClose, onSave, holders}){
  const editing = !!property;
  const system = editing && property.system;
  const [label, setLabel] = React.useState(property ? property.label : '');
  const [type, setType] = React.useState(property ? propertyTypeId(property.type) : PROPERTY_TYPES[0]);
  const [options, setOptions] = React.useState(property && property.options ? property.options : ['']);
  const [range, setRange] = React.useState(property && property.range ? property.range : {label:'', min:'', max:''});
  const [objectId, setObjectId] = React.useState(property ? property.objectId : (defaultObjectId || data.objects[0].id));
  const [onCreate, setOnCreate] = React.useState(property ? property.onCreate : true);
  const [mandatory, setMandatory] = React.useState(property ? property.mandatory : false);
  const locked = editing && property.locked;
  const l = label.trim();
  // Labels are unique within an Object; different Objects can share one ("Status").
  const taken = data.properties.some(p => p.objectId === objectId && !(editing && p.key === property.key && p.objectId === property.objectId) && p.label.toLowerCase() === l.toLowerCase());
  const ok = !!l && !taken && typeConfigOk(type, options, range);
  const forUsers = objectId === 'users';
  const save = () => onSave({
    ...(property || {}), key: editing && property.objectId === objectId ? property.key : propertyKey(objectId, l),
    label:l, type, system:!!system, objectId, onCreate: !forUsers && onCreate, mandatory: !forUsers && onCreate && mandatory, locked:!!locked,
    ...typeSettings(type, options, range),
  });
  const colLabel = {fontSize:13, fontWeight:500, color:T.attioText, marginBottom:8, display:'block'};
  return (
    <StModal title={editing ? 'Edit Property' : 'Add Property'} primary={editing ? 'Save property' : 'Add property'} canSubmit={ok} onCancel={onClose} onSubmit={save} width={820}>
      {/* Two columns divided by a single vertical separator (no boxes). */}
      <div style={{display:'grid', gridTemplateColumns:'minmax(0, 1fr) minmax(0, 1fr)', alignItems:'stretch'}}>
        <div style={{display:'flex', flexDirection:'column', gap:14, minWidth:0, paddingRight:24}}>
          <div>
            <label style={fieldLabel} htmlFor="property-label">Property Label</label>
            <input id="property-label" autoFocus value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Passport Number" style={fieldInput}/>
            {taken && <div style={{fontSize:12, color:T.red, marginTop:4}}>{objectName(data, objectId)} already has a property with this label.</div>}
          </div>
          <div>
            <label style={fieldLabel}>Property Type</label>
            {locked
              ? <div title="The record relies on it" style={{...fieldInput, background:T.pageBg, color:T.gray600}}>{type}</div>
              : <FormSelect value={type} placeholder="Select type" options={PROPERTY_TYPES} onChange={v=>v && setType(v)}/>}
          </div>
          <PropertyTypeConfig type={type} options={options} setOptions={setOptions} range={range} setRange={setRange}/>
        </div>

        {/* Right — the Object this property belongs to, and its creation settings. */}
        <div style={{minWidth:0, paddingLeft:24, borderLeft:`1px solid ${T.border}`, display:'flex', flexDirection:'column', gap:14}}>
          <div>
            <label style={fieldLabel}>Record</label>
            {/* An existing property stays on its record (its values are there). */}
            {editing
              ? <div style={{...fieldInput, background:T.pageBg, color:T.gray600}}>{objectName(data, objectId)}</div>
              : <SearchableSelect value={objectId} options={(holders || PROPERTY_HOLDERS(data)).map(o => ({value:o.id, label:o.name}))} onChange={setObjectId}
                  placeholder="Select record" searchPlaceholder="Search records"/>}
          </div>
          {/* Users have no creation form here (they come from HRMS). */}
          {!forUsers && <CreationFormToggles onCreate={onCreate} mandatory={onCreate && mandatory} locked={locked} lockedTitle={lockedPropertyTitle(property)}
            onChange={(v)=>{ setOnCreate(v.onCreate); setMandatory(v.mandatory); }}/>}
        </div>
      </div>
    </StModal>
  );
}

/* ── Settings → Pipelines ── every pipeline with its Object and stage count; the name, the
   count and ⋯ View stages open the pipeline's side panel (pipelinePanel.jsx). Creating
   pipelines is not defined yet. */
const PIPELINE_COLS = [
  {key:'label', label:'Pipeline Name', width:260}, {key:'objectName', label:'Record', width:200}, {key:'entryCount', label:'Total Entries', width:140},
  {key:'stageCount', label:'Stages', width:140}, {key:'workflowCount', label:'Workflows', width:140}, {key:'createdBy', label:'Created By', width:170},
];

/* ── New Pipeline (Settings → Pipelines → +) ── the creation side panel, as for Calls, Notes and
   the other tools: the pipeline's name, the record it appears on, and its type —
     Manual:         its stages are defined here, in order, each with its Stage Type (Open by
                     default; Won, Lost, Undecided — as in Edit Pipeline).
     Property-based: its stages are the values of one of that record's single-choice properties
                     (Dropdown select / Radio select), and follow the property.
   Saved into the pipelines every board and record form reads. */
const PIPELINE_PROPERTY_TYPES = ['Single Selection'];
const pipelineStageId = (label) => label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'stage';
// Stage ids from their names, kept unique within the pipeline.
const pipelineStageIds = (labels) => { const seen = {}; return labels.map(l => { const b = pipelineStageId(l); seen[b] = (seen[b] || 0) + 1; return seen[b] > 1 ? `${b}-${seen[b]}` : b; }); };
// A stage's Stage Type picker (New Pipeline, Edit Pipeline, Add Stage): Open, Won, Lost, Undecided.
function StageTypeSelect({value, onChange}){
  return <Select value={value || 'open'} options={STAGE_TYPES.map(t => ({value:t.id, label:t.label}))} onChange={v=>v && onChange(v)}/>;
}
// `records`: each record type's records ({contacts, deals, customers}) — a property-based pipeline's stages show how many are in each.
function NewPipelinePanel({data, records = {}, onCancel, onSave}){
  const [name, setName] = React.useState('');
  const [objectId, setObjectId] = React.useState('');
  const [kind, setKind] = React.useState('manual');
  const [stages, setStages] = React.useState(() => [{id:`ns-${Date.now()}`, label:'', type:'open'}]);
  const [propertyKey, setPropertyKey] = React.useState('');
  const [valueTypes, setValueTypes] = React.useState({});   // a property-based pipeline's Stage Type per value
  const props = objectId ? objectProperties(data, objectId).filter(p => PIPELINE_PROPERTY_TYPES.includes(propertyTypeId(p.type)) && (p.options || []).some(o => String(o).trim())) : [];
  const property = props.find(p => p.key === propertyKey) || null;
  const values = property ? [...new Set(property.options.map(o => String(o).trim()).filter(Boolean))] : [];
  /* Each stage's entries: the record type's records in it, counted as the boards count them
     (stageIdOf on the pipeline this would create); a stage nobody is in shows 0. */
  const stageCounts = React.useMemo(() => {
    if(!property) return {};
    const draft = {source:'property', propertyKey, stages:values.map(v => ({id:v, value:v}))};
    const counts = Object.fromEntries(values.map(v => [v, 0]));
    (records[objectId] || []).forEach(r => { const st = stageIdOf(draft, r); if(st != null && st in counts) counts[st]++; });
    return counts;
  }, [property, propertyKey, objectId, records]);
  const trimmed = stages.map(s => s.label.trim());
  const dupes = trimmed.some((n, i) => n && trimmed.findIndex(x => x.toLowerCase() === n.toLowerCase()) !== i);
  const taken = (data.pipelines || []).some(p => p.objectId === objectId && p.label.trim().toLowerCase() === name.trim().toLowerCase());
  const ok = !!name.trim() && !!objectId && !taken && (kind === 'manual' ? stages.length > 0 && trimmed.every(Boolean) && !dupes : values.length > 0);
  const setStage = (id, p) => setStages(list => list.map(s => s.id === id ? {...s, ...p} : s));
  const move = (i, d) => setStages(list => { const n = list.slice(); const [x] = n.splice(i, 1); n.splice(i + d, 0, x); return n; });
  const save = () => {
    if(!ok) return;
    const base = {id:`pl-${Date.now().toString(36)}`, label:name.trim(), objectId};
    if(kind === 'property'){ const ids = pipelineStageIds(values); return onSave({...base, source:'property', propertyKey, stages:values.map((v, i) => ({id:ids[i], label:v, value:v, type:valueTypes[v] || 'open'}))}); }
    const ids = pipelineStageIds(stages.map(s => s.label));
    // A manual pipeline: a deal or customer is in one of them ('record'). Contacts have none.
    onSave({...base, source:'record',
      stages:stages.map((s, i) => ({id:ids[i], label:s.label.trim(), type:s.type || 'open'}))});
  };
  const iconBtn = (icon, title, onClick, disabled) => <button type="button" title={title} disabled={disabled} onClick={onClick}
    style={{border:'none', background:'transparent', cursor: disabled ? 'default' : 'pointer', display:'flex', padding:4, opacity: disabled ? .35 : 1}}>
    <Icon name={icon} size={13} color={T.gray600}/></button>;
  return (
    <CreatePanelFrame title="New Pipeline" onClose={onCancel} more={false} actions={<>
      <StSecondary label="Cancel" onClick={onCancel}/>
      <StCta label="Save" disabled={!ok} onClick={save}/>
    </>}>
      {stack(<>
        <Field label="Pipeline name">
          <input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Canada PR" style={{...fieldText, borderColor: taken ? T.red : undefined}}/>
          {taken && <div style={{fontSize:12, color:T.red, marginTop:4}}>This record already has a pipeline with this name.</div>}
        </Field>
        <Field label="Record">
          <Select value={objectId} placeholder="Select record" options={RECORD_OBJECTS.filter(id => pipelineAdminCan(id, 'create')).map(id => ({value:id, label:objectName(data, id)}))}
            onChange={v=>{ setObjectId(v || ''); setPropertyKey(''); if(v === 'contacts') setKind('property'); }}/>
        </Field>
        <Field label="Type">
          <div role="radiogroup" aria-label="Pipeline type" style={{display:'flex', gap:8}}>
            {/* Contacts have property-based pipelines only. */}
            {objectId !== 'contacts' && <StRadioCard selected={kind === 'manual'} title="Manual" onSelect={()=>setKind('manual')}/>}
            <StRadioCard selected={kind === 'property'} title="Property-Based" onSelect={()=>setKind('property')}/>
          </div>
        </Field>
        {kind === 'manual' ? (
          <Field label="Stages">
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              {stages.map((s, i) => (
                <div key={s.id} style={{display:'flex', alignItems:'center', gap:6}}>
                  <span style={{width:18, fontSize:12.5, color:T.gray400, fontVariantNumeric:'tabular-nums', flexShrink:0}}>{i + 1}</span>
                  <input value={s.label} onChange={e=>setStage(s.id, {label:e.target.value})} placeholder="Stage name" aria-label={`Stage ${i + 1} name`} style={{...fieldText, flex:1, minWidth:0}}/>
                  <div style={{width:118, flexShrink:0}}><StageTypeSelect value={s.type} onChange={v=>setStage(s.id, {type:v})} label={`Stage ${i + 1} type`}/></div>
                  {iconBtn('arrowUp', 'Move up', ()=>move(i, -1), i === 0)}
                  {iconBtn('arrowDown', 'Move down', ()=>move(i, 1), i === stages.length - 1)}
                  {iconBtn('trash', 'Remove stage', ()=>setStages(list => list.filter(x => x.id !== s.id)), stages.length === 1)}
                </div>
              ))}
              {dupes && <div style={{fontSize:12, color:T.red}}>Two stages can't have the same name.</div>}
              <div><StSecondary label={<span style={{display:'inline-flex', alignItems:'center', gap:6}}><Icon name="plus" size={12} color={T.gray800}/>Add stage</span>}
                onClick={()=>setStages(list => [...list, {id:`ns-${Date.now()}-${list.length}`, label:'', type:'open'}])}/></div>
            </div>
          </Field>
        ) : (<>
          <Field label="Property">
            <Select value={propertyKey} placeholder={objectId ? (props.length ? 'Select property' : 'No single-choice properties') : 'Select a record first'}
              options={props.map(p => ({value:p.key, label:p.label}))} onChange={v=>setPropertyKey(v || '')}/>
          </Field>
          {property && (
            <Field label="Stages">
              {/* The property's options, in order, as stages — with the records in each now. */}
              <div style={{border:`1px solid ${T.attioLine}`, borderRadius:8, overflow:'hidden'}}>
                <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
                  <thead>
                    <tr style={{background:T.headerBg}}>
                      <th style={{textAlign:'left', fontWeight:500, color:T.attioMuted, fontSize:12.5, padding:'7px 12px'}}>Stage</th>
                      <th style={{textAlign:'left', fontWeight:500, color:T.attioMuted, fontSize:12.5, padding:'7px 12px', width:140}}>Stage Type</th>
                      <th style={{textAlign:'right', fontWeight:500, color:T.attioMuted, fontSize:12.5, padding:'7px 12px', width:110}}>Total Entries</th>
                    </tr>
                  </thead>
                  <tbody>
                    {values.map(v => (
                      <tr key={v} style={{borderTop:`1px solid ${T.attioLine}`}}>
                        <td style={{padding:'7px 12px', color:T.attioText}}>{v}</td>
                        <td style={{padding:'4px 12px'}}><StageTypeSelect value={valueTypes[v]} onChange={t=>setValueTypes(m => ({...m, [v]:t}))} label={`${v} stage type`}/></td>
                        <td style={{padding:'7px 12px', color:T.attioText, textAlign:'right', fontVariantNumeric:'tabular-nums'}}>{stageCounts[v] || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Field>
          )}
        </>)}
      </>)}
    </CreatePanelFrame>
  );
}

function PipelinesSettings({data, setData, records = {}, onWorkflowOpen, target, onTargetDone}){
  /* The pipeline side panel (pipelinePanel.jsx) over this table: {id} opens its stages, {id,
     workflow:true} opens straight into a new workflow for it (the row's Workflow action). */
  const [open, setOpen] = React.useState(null);
  const setOpenId = (id) => setOpen({id});
  // Quick Search: open the pipeline — for a stage, the pipeline it's in.
  React.useEffect(() => {
    if(!target) return;
    const id = target.kind === 'stage' ? target.pipelineId : target.kind === 'pipeline' ? target.id : null;
    if(id && (data.pipelines || []).some(p => p.id === id)) setOpen({id});
    onTargetDone && onTargetDone();
  }, [target && target.nonce]);
  const [editingId, setEditingId] = React.useState(null);
  const [stub, setStub] = React.useState(null);
  const [creating, setCreating] = React.useState(false);
  const workflowsOf = (id) => (data.workflows || []).filter(w => (w.context && w.context.pipeline === id) || (w.origin && w.origin.pipelineId === id)).length;
  // Total Entries: the pipeline's record type's records that are in it (a stage of it — by their pipeline, or by the property it follows).
  const entriesOf = (p) => (records[p.objectId] || []).filter(r => stageIdOf(p, r)).length;
  // Settings & Administration → Pipelines (per record type): View shows its pipelines; Create, Edit, Delete.
  const rows = (data.pipelines || []).filter(p => pipelineAdminCan(p.objectId, 'view', p)).map(p => ({...p, createdBy:creatorOf(p), objectName:objectName(data, p.objectId), entryCount:String(entriesOf(p)), stageCount:p.stages.length, workflowCount:workflowsOf(p.id)}));
  const schema = {
    properties:PIPELINE_COLS, noun:'pipeline', searchKeys:['label', 'objectName'], fillWidth:true, canCreateProperty:false,
    filterProps:[{key:'label', label:'Pipeline Name', type:'text'}, {key:'objectName', label:'Record', type:'select'}],
    selectValues:{objectName:data.objects.map(o => o.name)},
    // The name, the stage count and the workflow count all open the one pipeline side panel.
    renderCell: (key, r) => key === 'stageCount' ? countLink(r.stageCount, ()=>setOpenId(r.id))
      : key === 'workflowCount' ? (workflowsAvailableFor(r.objectId) ? countLink(r.workflowCount, ()=>setOpenId(r.id)) : '—')   // no workflows on this Object yet
      : key === 'label' ? <ContactName name={r.label} onOpen={()=>setOpenId(r.id)} style={{fontSize:'inherit', fontWeight:500}}/>
      : undefined,
    // The workflow quick action, then ⋯ Add Workflow (a new workflow for this pipeline), Edit, Delete.
    renderActions: (r) => actionsWithWorkflow(workflowsAvailableFor(r.objectId) && workflowCan('create'), ()=>setOpen({id:r.id, workflow:true}), <RowActionsMenu title="Pipeline actions" width={MENU_W}
      items={[...(workflowsAvailableFor(r.objectId) && workflowCan('create') ? [{label:'Add Workflow', onClick:()=>setOpen({id:r.id, workflow:true})}] : []), ...pipelineMenuItems(r, records[r.objectId], ()=>setEditingId(r.id), r.objectName.replace(/s$/, '').toLowerCase())]}/>),
  };
  return (
    <div style={{position:'relative', flex:1, minHeight:0, display:'flex', flexDirection:'column', overflow:'hidden'}}>
    <SettingsPage fill>
      <div style={{display:'flex', flexDirection:'column', flex:1, minHeight:0}}>
        {/* New pipeline: the "+" beside View Settings (no Save View here), as Create Record on Records. */}
        <RecordViewsModule flushTop storeKey="views:plv-all-v2" schema={schema} rows={rows} columns={PIPELINE_COLS.map(c => c.key)} defaultViews={[{id:'plv-all', name:'All Pipelines'}]} saveView={false}
          actions={() => RECORD_OBJECTS.some(o => pipelineAdminCan(o, 'create')) && <button onClick={()=>setCreating(true)} title="New pipeline" aria-label="New pipeline" style={iconBtn}><Icon name="plus" size={14} color={T.gray800}/></button>}/>
      </div>
    </SettingsPage>
    {open && <PipelinePanel key={`${open.id}-${open.workflow ? 'wf' : 'stages'}`} data={data} setData={setData} pipelineId={open.id} deals={records[((data.pipelines || []).find(p => p.id === open.id) || {}).objectId] || []}
      startWorkflow={!!open.workflow} onClose={()=>setOpen(null)} onStub={setStub} onWorkflowOpen={onWorkflowOpen}/>}
    {creating && <NewPipelinePanel data={data} records={records} onCancel={()=>setCreating(false)}
      onSave={(p)=>{ setData(d => ({...d, pipelines:[...(d.pipelines || []), {...p, createdBy:CURRENT_USER.name}]})); setCreating(false); }}/>}
    {editingId && <EditPipelineModal pipeline={data.pipelines.find(p => p.id === editingId)} setData={setData} onClose={()=>setEditingId(null)}/>}
    {stub && <StubPanel title={stub} onClose={()=>setStub(null)} zIndex={110}/>}
    </div>
  );
}

Object.assign(window, {StageTypeSelect, CUSTOMER_PIPELINE_FOR_DEAL, REMOVED_PIPELINE_IDS, PipelinesSettings, DEFAULT_PIPELINES, objectPipelines, recordPipelines, recordInPipeline, DEAL_TYPES, PROPERTY_SET_VERSION, SYSTEM_PROPERTY_TYPES, PROPERTY_TYPES, RELATIONSHIP_TYPES, OBJECT_GROUPS, DEFAULT_DATA_MODEL, PropertyInput, storePropertyValue, inputPropertyValue,
  isEmptyValue, migrateDataModel, propertyFilterMeta, PROPERTY_HOLDERS, userDefaultProperties, customerDefaultProperties, customContactSchema, propertyFilterType, creationAssociations, RECORD_OBJECTS, objectFormProperties, ObjectsSettings, PropertiesSettings, inverseRelationship});
