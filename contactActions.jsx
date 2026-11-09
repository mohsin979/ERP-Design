/* HOF Pulse ERP — Contact record actions, shared by the Contacts Table and Board.

   One menu, one form and one copy helper, so the table row and the board card can't drift
   apart: both call ContactActionsMenu with the same callbacks, and add/edit both go through
   ContactFormModal. */

/* ── Copy ───────────────────────────────────────────────────────────────────────────────── */

/* The async Clipboard API needs a secure context and focus; the textarea fallback covers a
   plain-http localhost preview and older browsers. */
function copyText(text){
  if(navigator.clipboard && window.isSecureContext){
    return navigator.clipboard.writeText(text).then(()=>true, ()=>fallbackCopy(text));
  }
  return Promise.resolve(fallbackCopy(text));
}
function fallbackCopy(text){
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch(e) { ok = false; }
  document.body.removeChild(ta);
  return ok;
}

/* "Copy contact" = name, phone number and email, one per line, in that order. Missing values
   are skipped rather than copied as blank lines. */
const contactCopyText = (c) => [c.name, c.phone, c.email].filter(Boolean).join('\n');

/* Brief confirmation after a copy — the only feedback the action has, since nothing on screen
   changes when the clipboard does. */
/* `action`: an optional link after the message ({label, onClick}), e.g. Open deal. */
function CopyToast({message, action}){
  if(!message) return null;
  return (
    <div style={{
      position:'fixed', left:'50%', bottom:28, transform:'translateX(-50%)', zIndex:120,
      background:T.attioText, color:'#fff', fontSize:12.5, padding:'8px 14px', borderRadius:8,
      boxShadow:'0 8px 20px rgba(16,24,40,.2)', pointerEvents: action ? 'auto' : 'none',
      display:'flex', alignItems:'center', gap:12,
    }}>{message}
      {action && <button onClick={action.onClick} style={{border:'none', background:'transparent', padding:0, cursor:'pointer', fontSize:12.5, fontWeight:600, color:'#fff', textDecoration:'underline', textUnderlineOffset:2, fontFamily:'inherit'}}>{action.label}</button>}
    </div>
  );
}

/* ── Menu ───────────────────────────────────────────────────────────────────────────────── */

const MENU_W = 196;

/* Rendered position:fixed from the trigger's rect instead of MenuShell's absolute placement:
   both hosts are scroll containers (the grid body, each board column), and an absolute menu
   inside them is clipped at their edge — the bottom rows' menus would be cut off. It flips
   above the trigger when there isn't room below, and closes on scroll since a fixed menu
   would otherwise float away from its row. */
/* The record ⋯ menu, one pattern for Contacts, Deals and Customers: groups of actions set
   apart by dividers — activity actions, related records, the record itself and copying, View
   settings (only where the menu opens from the record), then Delete. `groups`: arrays of
   {label, onClick, danger?, disabled?, icon?}; empty groups and falsy items are left out. */
function RecordActionsMenu({title, groups, visible = true}){
  const gs = groups.map(g => g.filter(Boolean)).filter(g => g.length);
  const height = gs.reduce((n, g) => n + g.length, 0) * 34 + (gs.length - 1) * 9 + 12;
  return (
    <ActionsMenu title={title} width={MENU_W} height={height} visible={visible}>
      {(close) => gs.map((g, i) => (
        <React.Fragment key={i}>
          {i > 0 && <div style={{height:1, background:T.border, margin:'4px 2px'}}/>}
          {g.map(it => <MenuItem key={it.label} icon={it.icon} label={it.label} danger={it.danger} disabled={it.disabled}
            onClick={(e)=>{ e && e.stopPropagation(); close(); it.onClick(); }}/>)}
        </React.Fragment>
      ))}
    </ActionsMenu>
  );
}
/* Copy a value, confirmed by the toast (`onCopied`); nothing to copy says so. */
const copyAction = (text, label, onCopied) => () => {
  if(!text){ onCopied && onCopied(`No ${label} to copy`); return; }
  copyText(text).then(ok => onCopied && onCopied(ok ? `${label[0].toUpperCase()+label.slice(1)} copied` : 'Copy failed'));
};
const viewSettingsItem = (onViewSettings) => onViewSettings && {label:'View settings', icon:<Icon name="settingsGear" size={13} color={T.gray600}/>, onClick:onViewSettings};

/* ── The record ⋯ menu ── one structure for Contacts, Deals and Customers, named for the record:
     Tools          Call, Email, Meeting, Task, Note, File, Quote (by tool permission)
     Create         Create Deal, Create Customer (only where the Object can create them)
     Record         Copy Email, Edit <Record>, Edit <Record> Owner, Copy Phone Number, Copy <Record>, Enrich <Record>
     View Settings  (only where the menu opens from the record)
     Delete         Delete <Record>
   `onTool(key)`: what a tool does is the Object's (the record's tab, its form, the call window…).
   `email` / `phone`: what Copy Email / Copy Phone Number copy (a deal's are its contact's). */
const RECORD_TOOLS = [['call', 'Call'], ['email', 'Email'], ['meeting', 'Meeting'], ['task', 'Task'], ['note', 'Note'], ['file', 'File'], ['quote', 'Quote']];
function StandardRecordMenu({object, record, noun, email, phone, copyText:copied, onTool, onCreateDeal, createDealDisabled, onCreateCustomer, onGoToDeal,
                             onEdit, onOwner, onEnrich, onDelete, onCopied, onViewSettings, visible = true}){
  return (
    <RecordActionsMenu title={`${noun} actions`} visible={visible} groups={[
      onTool ? RECORD_TOOLS.filter(([k]) => canAdd(object, record, k)).map(([k, label]) => ({label, onClick:()=>onTool(k)})) : [],
      [onCreateDeal && workspaceHasType('deals') && {label:quickActionLabel(object, 'createDeal'), disabled:!!createDealDisabled, onClick:onCreateDeal},
       onCreateCustomer && workspaceHasType('customers') && {label:quickActionLabel(object, 'createCustomer'), onClick:onCreateCustomer},
       onGoToDeal && workspaceHasType('deals') && {label:quickActionLabel(object, 'goToDeal'), onClick:onGoToDeal}],
      [{label:'Copy Email', onClick:copyAction(email, 'email', onCopied)},
       onEdit && {label:`Edit ${noun}`, onClick:onEdit},
       onOwner && {label:`Edit ${noun} Owner`, onClick:onOwner},
       {label:'Copy Phone Number', onClick:copyAction(phone, 'phone number', onCopied)},
       {label:`Copy ${noun}`, onClick:copyAction(copied, noun.toLowerCase(), onCopied)},
       onEnrich && {label:`Enrich ${noun}`, onClick:onEnrich}],
      [viewSettingsItem(onViewSettings)],
      [onDelete && {label:`Delete ${noun}`, danger:true, onClick:onDelete}],
    ]}/>
  );
}
function ContactActionsMenu({contact, onEdit, onDelete, onEnrich, onCopied, onTool, onOwner, onCreateRecord, onViewSettings, visible=true}){
  return (
    <StandardRecordMenu object="contacts" record={contact} noun="Contact" email={contact.email} phone={contact.phone} copyText={contactCopyText(contact)}
      onTool={onTool && ((k) => onTool(k, contact))}
      onCreateDeal={onCreateRecord && (() => onCreateRecord('Create deal', contact))}
      onCreateCustomer={onCreateRecord && (() => onCreateRecord('Create customer', contact))}
      onEdit={onEdit && (() => onEdit(contact))} onOwner={onOwner && (() => onOwner(contact))} onEnrich={onEnrich && (() => onEnrich(contact))}
      onDelete={onDelete && (() => onDelete(contact))} onCopied={onCopied} onViewSettings={onViewSettings} visible={visible}/>
  );
}

/* ── Quick actions ── one set for Contacts, Deals and Customers, named as in the ⋯ menu: the tools,
   then the owner, then what the Object creates (Create Deal, Create Customer) or opens (a deal's
   Go to Contact). Which ones a card or panel shows, and their order, are set in Card Settings /
   View Settings. `runQuickAction` sends each to the same handler its menu item uses. */
const QUICK_ACTION_DEFS = {
  call:{label:'Call', icon:'call'}, email:{label:'Email', icon:'envelope'}, meeting:{label:'Meeting', icon:'calendar'},
  task:{label:'Task', icon:'tasks'}, note:{label:'Note', icon:'notepad'}, file:{label:'File', icon:'folder'}, quote:{label:'Quote', icon:'quote'},
  owner:{label:(noun) => `Edit ${noun} Owner`, icon:'userSwitch'},
  // Named by the workspace's record types (HOF Partners: Create Lead, Go to Lead).
  createDeal:{get label(){ return `Create ${typeSingular('deals', 'Deal')}`; }, icon:'deals', needs:'deals'},
  createCustomer:{get label(){ return `Create ${typeSingular('customers', 'Customer')}`; }, icon:'customers', needs:'customers'},
  goToContact:{get label(){ return `Go to ${typeSingular('contacts', 'Contact')}`; }, icon:'contacts', needs:'contacts'},
  // A customer's parent deal; it takes Create Deal's place once the customer has one (switched on as Create Deal is).
  goToDeal:{get label(){ return `Go to ${typeSingular('deals', 'Deal')}`; }, icon:'deals', inherits:'createDeal', needs:'deals'},
};
const QUICK_TOOL_KEYS = ['call', 'email', 'meeting', 'task', 'note', 'file', 'quote'];
const OBJECT_QUICK_ACTIONS = {
  contacts:  [...QUICK_TOOL_KEYS, 'owner', 'createDeal', 'createCustomer'],
  deals:     [...QUICK_TOOL_KEYS, 'owner', 'goToContact', 'createCustomer'],
  customers: [...QUICK_TOOL_KEYS, 'owner', 'createDeal', 'goToDeal'],
};
/* Deals → Customers is a parent–child relation: a customer has one deal. Create Deal shows only
   while it has none; then Go to Deal (its parent deal) shows instead. */
const customerHasDeal = (c) => !!(c && (c.dealIds || []).length);
const QUICK_ACTION_AVAILABLE = {customers:{createDeal:(r) => !customerHasDeal(r), goToDeal:(r) => customerHasDeal(r)}};
const quickActionAvailable = (object, key, record) => { const f = (QUICK_ACTION_AVAILABLE[object] || {})[key]; return !f || !record || f(record); };
const OBJECT_NOUNS = {get contacts(){ return typeSingular('contacts', 'Contact'); }, get deals(){ return typeSingular('deals', 'Deal'); }, get customers(){ return typeSingular('customers', 'Customer'); }};
// The Object's quick actions in the open workspace: none that goes to or creates a record type it doesn't have.
const objectQuickActions = (object) => (OBJECT_QUICK_ACTIONS[object] || []).filter(k => !(QUICK_ACTION_DEFS[k] || {}).needs || workspaceHasType(QUICK_ACTION_DEFS[k].needs));
const quickActionLabel = (object, key) => { const d = QUICK_ACTION_DEFS[key]; return !d ? key : typeof d.label === 'function' ? d.label(OBJECT_NOUNS[object]) : d.label; };
const quickActionLabels = (object) => Object.fromEntries(objectQuickActions(object).map(k => [k, quickActionLabel(object, k)]));
// Saved before Quote replaced Send Quote.
const QUICK_ACTION_RENAMES = {sendQuote:'quote'};
const DEFAULT_QUICK_ON = ['call', 'email', 'task', 'note'];
/* The Object's quick actions in the saved order ({key, enabled}): renamed ones mapped, unknown ones
   dropped, new ones added at the end — switched on only for a fresh list (`enabled` defaults). */
const normalizeQuickActions = (list, object, enabledByDefault = DEFAULT_QUICK_ON) => {
  const keys = objectQuickActions(object), out = [];
  (list || []).forEach(it => { const key = QUICK_ACTION_RENAMES[it.key] || it.key; if(keys.includes(key) && !out.some(x => x.key === key)) out.push({key, enabled:!!it.enabled}); });
  // A new one that takes another's place (Go to Deal for Create Deal) is switched on as that one is.
  keys.forEach(k => { if(!out.some(x => x.key === k)){ const twin = list && (QUICK_ACTION_DEFS[k] || {}).inherits && out.find(x => x.key === QUICK_ACTION_DEFS[k].inherits);
    out.push({key:k, enabled: twin ? twin.enabled : !list && enabledByDefault.includes(k)}); } });
  return out;
};
const defaultQuickActions = (object, enabled) => normalizeQuickActions(null, object, enabled);
// The enabled quick actions a record shows, with their labels and icons (tools by permission).
const shownQuickActions = (list, object, record) => normalizeQuickActions(list, object)
  .filter(q => q.enabled && (!QUICK_TOOL_KEYS.includes(q.key) || canAdd(object, record, q.key)) && quickActionAvailable(object, q.key, record))
  .map(q => ({key:q.key, label:quickActionLabel(object, q.key), icon:QUICK_ACTION_DEFS[q.key].icon}));
/* `h`: the record's handlers — onTool(key), onOwner, onCreateDeal, onCreateCustomer, onGoToContact, onGoToDeal;
   one that's missing falls back to `onStub(label)`. */
const runQuickAction = (key, h, label) => {
  const run = QUICK_TOOL_KEYS.includes(key) ? h.onTool && (() => h.onTool(key))
    : ({owner:h.onOwner, createDeal:h.onCreateDeal, createCustomer:h.onCreateCustomer, goToContact:h.onGoToContact, goToDeal:h.onGoToDeal})[key];
  return run ? run() : h.onStub && h.onStub(label || key);
};

/* What a delete confirmation says about the record's associated records: they stay, unlinked.
   `counts`: [[singular, plural, n]]. Nothing associated: nothing to say. */
const associatedNote = (counts, noun) => {
  const parts = counts.filter(([, , n]) => n > 0).map(([one, many, n]) => `${n} ${n === 1 ? one : many}`);
  return parts.length ? `Its ${parts.join(' and ')} will stay, no longer linked to this ${noun}.` : null;
};

/* Edit <Record> Owner — any activated user; only the owner changes (each change is recorded as an
   owner-change activity by the Object). `noun`: Contact, Deal, Customer. */
function ChangeOwnerModal({record, noun, users, ownerName, onClose, onSave}){
  const [owner, setOwner] = React.useState(record.owner || '');
  return (
    <StModal title={`Edit ${noun} Owner`} primary="Change owner" canSubmit={!!owner && owner !== record.owner} onCancel={onClose} onSubmit={()=>onSave(owner)}>
      <div style={stTextB}>{record.name} · {record.owner ? `Currently ${ownerName(record.owner)}` : 'No owner'}</div>
      <div>
        <label style={fieldLabel}>{noun} Owner</label>
        <SearchableSelect value={owner} options={users.map(u => ({value:u.id, label:u.name}))} onChange={setOwner}
          placeholder="Select user" searchPlaceholder="Search users"/>
      </div>
    </StModal>
  );
}

/* ── Add / Edit form ─────────────────────────────────────────────────────────────────────── */

const todayLabel = () => new Date().toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});

const fieldLabel = {fontSize:12.5, color:T.gray600, marginBottom:6, display:'block'};
const fieldInput = {
  width:'100%', border:`1px solid ${T.borderStrong}`, borderRadius:8, padding:'8px 10px',
  fontSize:13, fontFamily:'inherit', color:T.attioText, background:'#fff',
};

function FormSelect({value, placeholder, options, onChange, invalid}){
  return (
    <div style={{position:'relative'}}>
      <select value={value} onChange={e=>onChange(e.target.value)}
        style={{...fieldInput, appearance:'none', WebkitAppearance:'none', MozAppearance:'none',
                paddingRight:32, cursor:'pointer', color: value ? T.attioText : T.gray400,
                borderColor: invalid ? T.red : T.borderStrong}}>
        <option value="">{placeholder}</option>
        {/* Options are plain strings, or {value, label} when the stored value is an id, or
            {group, options, disabled} for a labelled group of them (a disabled group shows but
            can't be picked). */}
        {options.map(function opt(o){
          if(typeof o === 'string') return <option key={o} value={o}>{o}</option>;
          if(o.group) return <optgroup key={o.group} label={o.group} disabled={!!o.disabled}>{o.options.map(opt)}</optgroup>;
          return <option key={o.value} value={o.value}>{o.label}</option>;
        })}
      </select>
      <div style={{position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', display:'flex'}}>
        <Icon name="chevDown" size={T.chevronSize} color={T.gray600}/>
      </div>
    </div>
  );
}

/* Built from the Contact object's properties (Settings → Properties): every property that's
   available during creation, in property order, with the control its type generates. By
   default that's today's form — Name, Email, Phone, Contact Owner, Types of Contact — with Name
   and Owner required (locked on). Owner has NO default — not the logged-in user, not the first
   in the list — the person creating the record picks it. `initial` pre-fills for Edit, and for
   Add from a board column it carries that column's stage. */
const sentenceCase = (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
/* Another Object's form (Deals) passes its `noun`, its own `optionsFor(property, values)` — options
   can depend on other fields (a Deal's stages follow its Pipeline) — and `adjust(next, key)` to
   keep dependent fields valid when one changes. */
/* One record's fields on a form: one field per row. Each value is checked by its type (an email's format, a range's order, …) and
   a required one must be filled in (propertyValueError); `tried`: the form was submitted, so the
   errors show — nothing invalid is saved. */
const formErrors = (fields, v) => Object.fromEntries(fields.map(p => [p.key, propertyValueError(p, v[p.key], p.required)]).filter(([, e]) => e));
const formMissing = formErrors;
const GROUPED_INPUT_TYPES = ['Phone Number', 'Currency', 'Location', 'Date Range', 'Custom Range'];
function RecordFields({fields, values, set, optionsFor, tried, autoFocus}){
  const errors = formErrors(fields, values);
  return fields.map((p, i) => {
    const label = p.formLabel || p.label, err = tried && errors[p.key];
    // A Boolean: its toggle, then its label, on one line.
    const toggle = propertyTypeId(p.type) === 'Boolean';
    return (
      // One field per row; a grouped input (a phone's country code and number, a timestamp's date and time, …) keeps its parts on it.
      <div key={p.key} style={{gridColumn:'1 / -1', minWidth:0}}>
        {!toggle && <label style={fieldLabel}>{label}{p.required && <span style={{color:T.red}}> *</span>}</label>}
        <PropertyInput prop={p} value={values[p.key]} onChange={val=>set({[p.key]:val})} options={optionsFor(p)} invalid={err} autoFocus={autoFocus && i === 0}
          label={toggle ? <span style={{fontSize:12.5, color:T.gray600}}>{label}</span> : undefined}/>
        {err && <div style={{fontSize:12, color:T.red, marginTop:4}}>{err}</div>}
      </div>
    );
  });
}
const emptyValues = (fields, initial) => Object.fromEntries(fields.map(p => [p.key, inputPropertyValue(p, initial ? initial[p.key] : '')]));
const storedValues = (fields, v) => Object.fromEntries(fields.map(p => [p.key, storePropertyValue(p, v[p.key])]));

/* ── Create through associated object (Add forms) ── one line; it opens the Objects this record
   can be associated with (Settings → Associations; Objects that have records). Each Object can be
   added once, and links one record: an existing one — only those the relationship allows are
   listed (`existing`) — or, unless `existingOnly`, a new one created with it (its own creation
   fields). Records don't need one another: leaving it empty is fine. `pull(id)`: values the form
   takes from a picked existing record (a deal's name, email and phone from its contact) → onPull.
   `association`: [{object, noun, existing:[{value, label}], existingNote?, existingOnly?, pull?, fields?, optionsFor?, adjust?}]
   `value`: [{object, mode:'existing'|'new', id, values}] — one per Object added. */
function AssociatedCreation({options, value, onChange, tried, onPull}){
  const [menu, setMenu] = React.useState(false);
  const list = value || [];
  const left = options.filter(o => !list.some(a => a.object === o.object));
  const update = (object, next) => onChange(list.map(a => a.object === object ? next : a));
  return (<>
    {list.map(a => {
      const opt = options.find(o => o.object === a.object);
      return opt && <AssociationEntry key={a.object} opt={opt} value={a} tried={tried} onChange={(next)=>{
        update(a.object, next);
        if(onPull && opt.pull && next.mode === 'existing' && next.id && next.id !== a.id) onPull(opt.pull(next.id));
      }} onRemove={()=>onChange(list.filter(x => x.object !== a.object))}/>;
    })}
    {left.length > 0 && (
      <div style={{gridColumn:'1 / -1', position:'relative'}}>
        <button type="button" onClick={()=>setMenu(m => !m)} style={{display:'inline-flex', alignItems:'center', gap:6, border:'none', background:'transparent', padding:'4px 0',
          fontSize:13, fontWeight:500, color:T.attioText, cursor:'pointer', fontFamily:'inherit'}}>
          <Icon name="plus" size={13} color={T.gray600}/>Create through associated record<Icon name="chevDown" size={T.chevronSize} color={T.gray600}/>
        </button>
        <MenuShell open={menu} onClose={()=>setMenu(false)} width={220}>
          {left.map(o => <MenuItem key={o.object} label={sentenceCase(o.noun)} onClick={()=>{ setMenu(false);
            onChange([...list, {object:o.object, mode: o.existingOnly || o.existing.length ? 'existing' : 'new', id:'', values:emptyValues(o.fields || [])}]); }}/>)}
        </MenuShell>
      </div>
    )}
  </>);
}
// One associated record on an Add form: Existing / New (unless existing only), then the picker or its fields.
function AssociationEntry({opt, value, onChange, onRemove, tried}){
  const set = (patch) => onChange({...value, values:(() => { const next = {...value.values, ...patch}; return opt.adjust ? opt.adjust(next, Object.keys(patch)[0]) : next; })()});
  const seg = (mode, label) => (
    <button type="button" role="radio" aria-checked={value.mode === mode} onClick={()=>onChange({...value, mode})} style={{border:'none', cursor:'pointer', padding:'5px 12px',
      fontSize:12.5, fontWeight:500, fontFamily:'inherit', background: value.mode === mode ? T.black : 'transparent', color: value.mode === mode ? '#fff' : T.gray600}}>{label}</button>
  );
  const noExisting = tried && value.mode === 'existing' && !value.id;
  return (
    <div style={{gridColumn:'1 / -1', border:`1px solid ${T.attioLine}`, borderRadius:10, padding:12, display:'flex', flexDirection:'column', gap:12}}>
      <div style={{display:'flex', alignItems:'center', gap:8}}>
        <span style={{flex:1, minWidth:0, fontSize:13, fontWeight:600, color:T.attioText, whiteSpace:'nowrap'}}>Associated {opt.noun}</span>
        {!opt.existingOnly && (
          <div role="radiogroup" aria-label={`Associated ${opt.noun}`} style={{display:'inline-flex', border:`1px solid ${T.borderStrong}`, borderRadius:8, overflow:'hidden'}}>
            {seg('existing', `Existing ${opt.noun}`)}{seg('new', `New ${opt.noun}`)}
          </div>
        )}
        <button type="button" title={`Remove associated ${opt.noun}`} onClick={onRemove} style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:4}}>
          <Icon name="close" size={13} color={T.gray600}/>
        </button>
      </div>
      {value.mode === 'existing' ? (
        <div>
          {opt.existing.length
            ? <SearchableSelect value={value.id} options={opt.existing} onChange={(id)=>onChange({...value, id})} placeholder={`Select ${opt.noun}`} searchPlaceholder={`Search ${opt.noun}s`}/>
            : <div style={{fontSize:13, color:T.attioMuted}}>No {opt.noun}s can be associated.</div>}
          {noExisting && <div style={{fontSize:12, color:T.red, marginTop:4}}>{opt.existingOnly ? `Choose a ${opt.noun}, or remove it` : `Choose a ${opt.noun}, or create a new one`}</div>}
          {opt.existingNote && <div style={{...stTextB, marginTop:6}}>{opt.existingNote}</div>}
        </div>
      ) : (
        <div style={{display:'grid', gridTemplateColumns:'minmax(0, 1fr)', gap:14}}>
          <RecordFields fields={opt.fields} values={value.values} set={set} optionsFor={(p)=>opt.optionsFor(p, value.values)} tried={tried}/>
        </div>
      )}
    </div>
  );
}
// The associations as the caller saves them: [{object, existingId} | {object, values} (stored values)].
const associationResult = (options, list) => (list || []).map(a => {
  const opt = options.find(o => o.object === a.object);
  if(!opt) return null;
  return a.mode === 'existing' ? {object:a.object, existingId:a.id} : {object:a.object, values:storedValues(opt.fields, a.values)};
}).filter(Boolean);
const associationMissing = (options, list) => (list || []).some(a => {
  const opt = options.find(o => o.object === a.object);
  if(!opt) return false;
  return a.mode === 'existing' ? !a.id : Object.values(formMissing(opt.fields, a.values)).some(Boolean);
});

/* Associated records chosen on the form, existing ones only (a customer's Contact and Deals; a
   deal's Contact when it's created from a customer). `link`: {key, noun, multiple, options:[{value,
   label}]}. Single: one record or none. Multiple: any number — each shown with a remove button,
   then a picker for one more. Every link is optional. */
function RecordLinkField({link, value, onChange}){
  const label = `Associated ${sentenceCase(link.noun)}${link.multiple ? 's' : ''}`;
  if(!link.multiple) return (
    <div style={{gridColumn:'1 / -1', minWidth:0}}>
      <label style={fieldLabel}>{label}</label>
      <div style={{display:'flex', alignItems:'center', gap:6}}>
        <div style={{flex:1, minWidth:0}}>
          <SearchableSelect value={value || ''} options={link.options} onChange={onChange} placeholder={`Select ${link.noun}`} searchPlaceholder={`Search ${link.noun}s`}/>
        </div>
        {value && <button type="button" title={`Remove ${link.noun}`} onClick={()=>onChange(null)} style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:4}}>
          <Icon name="close" size={13} color={T.gray600}/></button>}
      </div>
    </div>
  );
  const ids = value || [];
  const rest = link.options.filter(o => !ids.includes(o.value));
  return (
    <div style={{gridColumn:'1 / -1', minWidth:0}}>
      <label style={fieldLabel}>{label}</label>
      {ids.length > 0 && (
        <div style={{display:'flex', flexWrap:'wrap', gap:6, marginBottom:8}}>
          {ids.map(id => (
            <span key={id} style={{display:'inline-flex', alignItems:'center', gap:4, maxWidth:'100%', padding:'3px 4px 3px 9px', borderRadius:6, background:T.headerBg,
              border:`1px solid ${T.attioLine}`, fontSize:12.5, color:T.attioText}}>
              <span style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{(link.options.find(o => o.value === id) || {}).label || id}</span>
              <button type="button" title={`Remove ${link.noun}`} onClick={()=>onChange(ids.filter(x => x !== id))} style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:2}}>
                <Icon name="close" size={11} color={T.gray600}/></button>
            </span>
          ))}
        </div>
      )}
      {rest.length > 0 && <SearchableSelect value="" options={rest} onChange={(id)=>onChange([...ids, id])} placeholder={`Add ${link.noun}`} searchPlaceholder={`Search ${link.noun}s`}/>}
    </div>
  );
}

/* Add / Edit a record — Contacts, Deals and Customers alike — in the creation side panel
   (CreatePanelFrame): one field per row, label above its input; a field with two parts (a phone's
   country code and number, a timestamp's date and time) keeps them on its one row. Add shows the
   properties available during creation (required: mandatory ones); Edit shows every property a
   person can edit — all but the ones the system sets (`auto`) — so a property that isn't on the
   creation form can still be edited, with a search to find a field quickly. Mandatory ones stay
   required. `initial`: values it starts with (a record created from another carries its name,
   email and phone — all editable). `subtitle`: where it's created from. `association` (Add
   only): Create through associated object; onSave(values, [association]). `links` (Add and Edit):
   associated records picked from existing ones, starting at `initialLinks` ({key: id | ids});
   onSave(values, association, links). `zIndex`: over a modal it's opened from. */
/* `canEditField(p)`: editing, the fields the signed-in user may change (Records → Edit — its stage
   moves and property values); the others aren't offered, and keep their values. */
function ContactFormModal({mode, initial, properties, owners, stages, onCancel, onSave, noun = 'contact', optionsFor: optionsForProp, adjust, association, links, initialLinks, subtitle, zIndex, canEditField}){
  const fields = (properties || []).filter(p => mode === 'edit' ? !p.auto && (!canEditField || canEditField(p)) : p.onCreate)
    .map(p => mode === 'edit' ? {...p, required:!!p.mandatory} : p);
  const [v, setV] = React.useState(() => emptyValues(fields, initial));
  // Choices come from the property (Settings); owners (users, by ID) and the pipeline's stages from the caller.
  const optionsFor = (p) => optionsForProp ? optionsForProp(p, v) || p.options || [] : ({owner:owners, contactType:stages})[p.key] || p.options || [];
  const [tried, setTried] = React.useState(false);
  const [assoc, setAssoc] = React.useState([]);
  const [linked, setLinked] = React.useState(() => Object.fromEntries((links || []).map(l => [l.key, (initialLinks || {})[l.key] ?? (l.multiple ? [] : null)])));
  const [query, setQuery] = React.useState('');   // Edit: the field search
  const assocOptions = mode === 'add' && association && association.length ? association : null;
  const set = (patch) => setV(s => { const next = {...s, ...patch}; return adjust ? adjust(next, Object.keys(patch)[0]) : next; });
  const submit = () => {
    setTried(true);
    // A field with a problem is never hidden by the search.
    if(Object.keys(formErrors(fields, v)).length || (assocOptions && associationMissing(assocOptions, assoc))){ setQuery(''); return; }
    onSave(storedValues(fields, v), assocOptions ? associationResult(assocOptions, assoc) : null, links ? linked : undefined);
  };
  const q = query.trim().toLowerCase();
  const shown = q ? fields.filter(p => String(p.formLabel || p.label).toLowerCase().includes(q)) : fields;
  const linksShown = (links || []).filter(l => !q || `associated ${l.noun}`.includes(q));
  const title = mode === 'edit' ? `Edit ${noun}` : `Add ${noun}`;
  const top = mode === 'edit' || subtitle ? (
    <div style={{display:'flex', flexDirection:'column', gap:10}}>
      {subtitle && <div style={{fontSize:13, color:T.attioMuted}}>{subtitle}</div>}
      {mode === 'edit' && (
        <div style={{position:'relative'}}>
          <div style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', display:'flex'}}><Icon name="search" size={13} color={T.gray400}/></div>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search fields" aria-label="Search fields" style={{...fieldInput, paddingLeft:30}}/>
        </div>
      )}
    </div>
  ) : null;

  return (
    <CreatePanelFrame title={sentenceCase(title)} onClose={onCancel} top={top} more={false} zIndex={zIndex} actions={<>
      <StSecondary label="Cancel" onClick={onCancel}/>
      <StCta label={mode === 'edit' ? 'Save changes' : `Add ${noun}`} onClick={submit}/>
    </>}>
      <div style={{display:'grid', gridTemplateColumns:'minmax(0, 1fr)', gap:16}}>
        <RecordFields fields={shown} values={v} set={set} optionsFor={optionsFor} tried={tried} autoFocus={mode === 'add'}/>
        {assocOptions && <AssociatedCreation options={assocOptions} value={assoc} onChange={setAssoc} tried={tried} onPull={set}/>}
        {linksShown.map(l => <RecordLinkField key={l.key} link={l} value={linked[l.key]} onChange={(val)=>setLinked(s => ({...s, [l.key]:val}))}/>)}
        {q && !shown.length && !linksShown.length && <div style={{fontSize:13, color:T.attioMuted}}>No fields match “{query.trim()}”</div>}
      </div>
    </CreatePanelFrame>
  );
}

Object.assign(window, {customerHasDeal, quickActionAvailable, RecordFields, AssociatedCreation, RecordLinkField, RecordActionsMenu, StandardRecordMenu, RECORD_TOOLS, ChangeOwnerModal, associatedNote, QUICK_ACTION_DEFS, QUICK_TOOL_KEYS, OBJECT_QUICK_ACTIONS, objectQuickActions, OBJECT_NOUNS, quickActionLabel, quickActionLabels, normalizeQuickActions, defaultQuickActions, shownQuickActions, runQuickAction, copyAction, viewSettingsItem, contactCopyText, ContactActionsMenu, ContactFormModal, CopyToast, copyText, todayLabel});
