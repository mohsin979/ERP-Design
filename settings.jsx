/* HOF Pulse ERP — CRM Settings pages.

   Every page follows one shape, taken from the Figma Settings → Users & Teams frame (Claude
   Feeder, node 40:36842): a 15px Medium title at the top-left of the canvas, a one-line
   description under it, the page's actions on the right, then the content. Fields use that
   frame's Dropdown (14px Medium label, 30px control, 310 wide). Every list is the Contacts grid
   (ContactsDataGrid through RecordSchema — RecordGrid here, the full Contacts view system on
   Users & Teams → Users).
   Email, Meetings and Calendar: one button per provider (logo + name) top-right, each opening
   that provider's connection flow. Calls: Connect Phone Number.

   Ownership (product decision):
     Tools (Email, Calls, Meetings, Calendar, Tasks) — personal: each user connects and manages
       their own accounts, numbers and task defaults; the signed-in user only sees their own.
     Defaults (time zone, language, currency) — company-wide.
   Connecting is simulated (no real Google / Microsoft sign-in in the prototype): pick the
   provider, enter the account, Connect. A connected item's only action is Disconnect (row ⋯,
   with a confirmation). Forms save through Cancel / Save, Save disabled until something changes.

   Not defined yet — placeholder pages: Notifications, Objects, Properties,
   Pipelines, Customer Profile, Templates, Import & Export. */

/* ── Data ──────────────────────────────────────────────────────────────────────────────── */

/* Provider logos: assets/providers/*.svg (simplified brand marks — swap for the official
   artwork when the design system has it). */
const PROVIDER_LOGO = (name) => `assets/providers/${name}.svg`;
const EMAIL_PROVIDERS    = [
  {key:'gmail',   label:'Gmail',      logo:PROVIDER_LOGO('gmail')},
  {key:'outlook', label:'Outlook',    logo:PROVIDER_LOGO('outlook')},
  {key:'apple',   label:'Apple Mail', logo:PROVIDER_LOGO('apple-mail')},
];
const MEETING_PROVIDERS  = [
  {key:'meet',  label:'Google Meet',     logo:PROVIDER_LOGO('google-meet')},
  {key:'zoom',  label:'Zoom',            logo:PROVIDER_LOGO('zoom')},
  {key:'teams', label:'Microsoft Teams', logo:PROVIDER_LOGO('teams')},
];
const CALENDAR_PROVIDERS = [
  {key:'google',  label:'Google Calendar',  logo:PROVIDER_LOGO('google-calendar')},
  {key:'outlook', label:'Outlook Calendar', logo:PROVIDER_LOGO('outlook')},
];

const TASK_DUE_DATES = [
  {value:'none', label:'No due date'}, {value:'today', label:'Today'}, {value:'tomorrow', label:'Tomorrow'},
  {value:'2d', label:'In 2 days'}, {value:'3d', label:'In 3 days'}, {value:'1w', label:'In 1 week'}, {value:'2w', label:'In 2 weeks'},
];
const TASK_REMINDERS = [
  {value:'10m', label:'10 minutes before'}, {value:'30m', label:'30 minutes before'}, {value:'1h', label:'1 hour before'},
  {value:'3h', label:'3 hours before'}, {value:'1d', label:'1 day before'}, {value:'1w', label:'1 week before'},
  {value:'custom', label:'Custom'},
];
const REMINDER_UNITS = ['Minutes', 'Hours', 'Days', 'Weeks', 'Months'];

const TIME_ZONES = [
  '(GMT+05:00) Pakistan — Karachi', '(GMT+04:00) UAE — Dubai', '(GMT+03:00) Saudi Arabia — Riyadh',
  '(GMT+05:30) India — Kolkata', '(GMT+00:00) United Kingdom — London', '(GMT+01:00) Central Europe — Berlin',
  '(GMT−05:00) Canada — Toronto', '(GMT−08:00) Canada — Vancouver', '(GMT−05:00) US — New York',
  '(GMT−08:00) US — Los Angeles', '(GMT+10:00) Australia — Sydney', '(GMT+08:00) Australia — Perth',
];
const LANGUAGES  = ['English'];
const CURRENCIES = [
  'PKR — Pakistani Rupee', 'USD — US Dollar', 'AED — UAE Dirham', 'GBP — British Pound',
  'CAD — Canadian Dollar', 'EUR — Euro', 'AUD — Australian Dollar',
];

const DEFAULT_SETTINGS_DATA = () => ({
  emails: [], phones: [], meetings: [], calendars: [],
  tasks: {dueDate:'tomorrow', dueTime:'09:00', reminder:'1h', customAmount:1, customUnit:'Hours'},
  defaults: {timeZone:TIME_ZONES[0], language:LANGUAGES[0], currency:CURRENCIES[0]},
  ...SAMPLE_PEOPLE_DATA(),   // users, seats, teams, presets (usersTeams.jsx)
  ...DEFAULT_DATA_MODEL(),   // objects, associations, properties (dataModel.jsx)
});

const stToday = () => new Date().toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
const stId = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const stValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/* ── Primitives (Figma Users & Teams frame) ────────────────────────────────────────────── */

const stTextB = {fontSize:13, color:T.gray600, lineHeight:1.4};

// Without a label: the icon-only filled button (Add on the Templates tabs), named by `title`.
function StCta({icon, label, title, onClick, disabled}){
  return (
    <button onClick={onClick} disabled={disabled} title={title} aria-label={title} style={{
      display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, height:29, padding: label ? '0 12px' : 0, width: label ? undefined : 29,
      borderRadius:8, border:'none', background: disabled ? T.gray400 : T.black, color:'#fff',
      fontSize:14, fontWeight:500, fontFamily:'inherit', cursor: disabled ? 'default' : 'pointer', flexShrink:0,
    }}>
      {icon && <Icon name={icon} size={16} color="#fff"/>}{label}
    </button>
  );
}
function StSecondary({label, onClick, disabled}){
  return (
    <button onClick={onClick} disabled={disabled} style={{height:29, padding:'0 12px', borderRadius:8, border:`1px solid ${T.borderStrong}`,
      background:'#fff', color: disabled ? T.gray400 : T.gray800, fontSize:13, fontFamily:'inherit', cursor: disabled ? 'default' : 'pointer', flexShrink:0}}>{label}</button>
  );
}
/* Quiet text action, as the Figma table's "Edit". */
function StTextAction({label, onClick, danger}){
  const [h, setH] = React.useState(false);
  return (
    <button onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} style={{
      border:'none', background:'transparent', padding:0, cursor:'pointer', fontFamily:'inherit', fontSize:13,
      color: danger && h ? T.red : T.gray600, textDecoration: h ? 'underline' : 'none', textUnderlineOffset:2,
    }}>{label}</button>
  );
}

/* The page frame: title + description on the left, actions on the right, content below. */
/* The page frame: title (optional) + description on the left, actions on the right, content
   below. A page with none of these goes straight to its content. */
/* `fill` makes the content take the page's full height (the Users table: its rows scroll and its
   pagination stays at the bottom, as in Contacts). */
function SettingsPage({title, description, actions, fill, children}){
  const header = title || description || actions;
  return (
    <div style={{flex:1, minHeight:0, overflowY: fill ? 'hidden' : 'auto', background:'#fff', display: fill ? 'flex' : 'block', flexDirection:'column'}}>
      <div style={fill ? {padding:'12px 16px 16px', flex:1, minHeight:0, display:'flex', flexDirection:'column'} : {padding:'12px 16px 24px'}}>
        {header && (
          <div style={{display:'flex', alignItems: title ? 'flex-start' : 'center', justifyContent:'space-between', gap:16, minHeight:29}}>
            <div style={{minWidth:0, paddingTop: title ? 4 : 0}}>
              {title && <div style={{fontSize:15, fontWeight:500, color:T.black, lineHeight:1.4}}>{title}</div>}
              {description && <div style={{...stTextB, marginTop: title ? 2 : 0}}>{description}</div>}
            </div>
            {actions && <div style={{display:'flex', alignItems:'center', gap:8, flexShrink:0}}>{actions}</div>}
          </div>
        )}
        <div style={{marginTop: header ? 20 : 0, ...(fill ? {flex:1, minHeight:0, display:'flex', flexDirection:'column'} : {})}}>{children}</div>
      </div>
    </div>
  );
}

/* Field: label above a 30px control (the Figma Dropdown). */
const stControl = {
  appearance:'none', WebkitAppearance:'none', width:'100%', height:30, boxSizing:'border-box',
  border:`1px solid ${T.borderStrong}`, borderRadius:6, padding:'0 36px 0 14px', background:'#fff',
  fontSize:13, fontFamily:'inherit', color:T.black, cursor:'pointer',
};
function StField({label, width = 310, children}){
  return (
    <div style={{display:'flex', flexDirection:'column', gap:6, minWidth:0, ...(width === 'auto' ? {flex:1} : {width})}}>
      <span style={{fontSize:14, fontWeight:500, color:T.black, lineHeight:1.4}}>{label}</span>
      {children}
    </div>
  );
}
function StSelect({value, options, onChange}){
  return (
    <div style={{position:'relative'}}>
      <select value={value} onChange={e=>onChange(e.target.value)} style={stControl}>
        {options.map(o => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
      </select>
      <div style={{position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', display:'flex'}}>
        <Icon name="chevDown" size={T.chevronSize} color={T.gray600}/>
      </div>
    </div>
  );
}
const stInput = {...stControl, padding:'0 14px', cursor:'text'};

/* Radio card ("Choose how to access"): blue border and title when selected. */
function StRadioCard({selected, title, description, icon, onSelect}){
  return (
    <div onClick={onSelect} role="radio" aria-checked={selected} style={{
      flex:1, minWidth:0, display:'flex', gap:10, alignItems:'flex-start', padding:'12px 16px', borderRadius:12, cursor:'pointer',
      border:`1px solid ${selected ? T.blue : T.borderStrong}`, background:'#fff',
    }}>
      {selected
        ? <span style={{width:16, height:16, borderRadius:99, background:T.blue, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:2}}>
            <Icon name="check" size={10} color="#fff"/>
          </span>
        : <span style={{display:'flex', flexShrink:0, marginTop:2}}><Icon name="breakEnd" size={16} color={T.gray400}/></span>}
      <div style={{minWidth:0, display:'flex', flexDirection:'column', gap:2}}>
        <span style={{display:'flex', alignItems:'center', gap:6, fontSize:14, fontWeight:500, color: selected ? T.blue : T.black, lineHeight:1.4}}>
          {icon && <Icon name={icon} size={15} color={selected ? T.blue : T.gray800}/>}{title}
        </span>
        {description && <span style={stTextB}>{description}</span>}
      </div>
    </div>
  );
}

/* A provider's logo, at the size the Contacts toolbar uses for icons. */
const ProviderLogo = ({p, size = 16}) => <img src={p.logo} alt="" width={size} height={size} style={{display:'block', objectFit:'contain', flexShrink:0}}/>;

/* Connection button for the page's top-right: the provider's logo + name (or an icon), in the
   Contacts toolbar's bordered-button style. */
function ProviderButton({p, icon, label, onClick}){
  return (
    <button onClick={onClick} style={{display:'flex', alignItems:'center', gap:6, border:`1px solid ${T.borderStrong}`, background:'#fff', borderRadius:8,
      padding:'7px 12px', fontSize:13, color:T.gray800, cursor:'pointer', fontFamily:'inherit', flexShrink:0}}>
      {p ? <ProviderLogo p={p} size={15}/> : <Icon name={icon} size={14} color={T.gray600}/>}{label || p.label}
    </button>
  );
}

/* Connect Email: one CTA carrying the providers' logos; it opens a menu of the providers, each
   starting that provider's connection flow. */
function ConnectMenuButton({label, providers, onPick}){
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{position:'relative', flexShrink:0}}>
      <button onClick={()=>setOpen(o=>!o)} style={{display:'flex', alignItems:'center', gap:8, border:`1px solid ${T.borderStrong}`,
        background: open ? T.headerBg : '#fff', borderRadius:8, padding:'7px 12px', fontSize:13, color:T.gray800, cursor:'pointer', fontFamily:'inherit'}}>
        <span style={{display:'flex', alignItems:'center', gap:3}}>{providers.map(p => <ProviderLogo key={p.key} p={p} size={14}/>)}</span>
        {label}
        <Icon name="chevDown" size={T.chevronSize} color={T.gray600}/>
      </button>
      <MenuShell open={open} onClose={()=>setOpen(false)} anchorRight width={200}>
        {providers.map(p => <MenuItem key={p.key} icon={<ProviderLogo p={p} size={15}/>} label={p.label} onClick={()=>{ setOpen(false); onPick(p); }}/>)}
      </MenuShell>
    </div>
  );
}

/* Row ⋯ menu — the Contacts row-action trigger and menu, for a list of items. */
/* Row actions from a list of items {label, onClick, danger, disabled, external} — the shared ⋯
   ActionsMenu (Settings tables keep their 180px panel; record pages pass the Contacts width). */
function RowActionsMenu({items, title = 'Actions', width = 180}){
  // Nothing the signed-in user may do here (permissions): the menu's space stays, so rows line up.
  if(!items.length) return <span aria-hidden="true" style={{width:28, height:28, flexShrink:0}}/>;
  return (
    <ActionsMenu title={title} width={width} height={items.length * 34 + 14}>
      {(close) => items.map(it => <MenuItem key={it.label} danger={it.danger} disabled={it.disabled} onClick={()=>{ close(); it.onClick(); }}
        /* `external`: the action leaves this module (e.g. to HRMS) — marked with the external-arrow icon. */
        label={it.external ? <span style={{display:'inline-flex', alignItems:'center', gap:6}}>{it.label}<Icon name="externalLink" size={13} color={T.gray600}/></span> : it.label}/>)}
    </ActionsMenu>
  );
}

/* A table in the Contacts grid (ContactsDataGrid via RecordSchema): same rows, hairlines,
   header, column ⋯ menus, drag-reorder, frozen first column and pinned Actions, pagination.
   Connected-account lists have nothing to bulk-select, so no selection gutter. */
function RecordGrid({schema, rows, defaultSort}){
  const [columnOrder, setColumnOrder] = React.useState(()=>schema.properties.map(p => p.key));
  const [sort, setSort] = React.useState(defaultSort || null);
  return (
    <RecordSchema.Provider value={{selectable:false, boards:false, ...schema}}>
      <div style={{border:`1px solid ${T.border}`, borderRadius:8, overflow:'hidden', display:'flex', flexDirection:'column'}}>
        <ContactsDataGrid rows={rows} columnOrder={columnOrder} setColumnOrder={setColumnOrder} sort={sort} setSort={setSort}
          search="" frozenLeft={1} frozenRight={0} actionsFrozen rowsPerPage={25} onOpenContact={()=>{}}/>
      </div>
    </RecordSchema.Provider>
  );
}
const providerCell = (list) => (key, r) => key === 'provider'
  ? <span style={{display:'inline-flex', alignItems:'center', gap:8}}><ProviderLogo p={providerOf(list, r.provider)} size={14}/>{providerOf(list, r.provider).label}</span>
  : undefined;
function StEmpty({title, description}){
  return (
    <div style={{border:`1px solid ${T.border}`, borderRadius:8}}>
      <EmptyState title={title} description={description}/>
    </div>
  );
}

/* Modal shell — the same box as Add / Edit contact. */
/* `width` for wider forms; `textAction` {label, onClick, disabled} adds a text-only CTA to the footer. */
/* `secondary` ({label, icon, onClick}): an outlined action before the primary one; `hideCancel`: no
   Cancel button (the × still closes). */
function StModal({title, children, primary, canSubmit = true, onSubmit, onCancel, danger, width = 440, textAction, cancelLabel, secondary, hideCancel}){
  return (
    <div style={{position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center'}} onMouseDown={onCancel}>
      <div style={{position:'absolute', inset:0, background:'rgba(16,24,40,.35)'}}/>
      <div onMouseDown={e=>e.stopPropagation()} style={{position:'relative', width, maxWidth:'calc(100vw - 32px)', background:'#fff',
                                                        borderRadius:12, boxShadow:'0 16px 40px rgba(16,24,40,.2)'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:`1px solid ${T.border}`}}>
          <span style={{fontSize:15, fontWeight:600, color:T.attioText}}>{title}</span>
          <button onClick={onCancel} title="Close" style={{border:'none', background:'transparent', cursor:'pointer', display:'flex'}}>
            <Icon name="close" size={14} color={T.gray600}/>
          </button>
        </div>
        <div style={{padding:'18px 20px', display:'flex', flexDirection:'column', gap:14}}>{children}</div>
        {/* The text-only CTA sits apart on the left; Cancel and the primary action stay together on the right.
            A modal with nothing to put there (no actions, Cancel hidden) has no footer. */}
        {(primary || secondary || textAction || !hideCancel) && <div style={{display:'flex', justifyContent:'flex-end', alignItems:'center', gap:8, padding:'14px 20px', borderTop:`1px solid ${T.border}`}}>
          {textAction && (
            <button onClick={textAction.onClick} disabled={textAction.disabled} style={{marginRight:'auto', border:'none', background:'transparent', padding:'8px 0', fontSize:13, fontWeight:500, fontFamily:'inherit',
              color: textAction.disabled ? T.gray400 : T.attioText, cursor: textAction.disabled ? 'default' : 'pointer'}}>{textAction.label}</button>
          )}
          {/* A read-only modal (no primary action) only closes. */}
          {!hideCancel && <button onClick={onCancel} style={{padding:'8px 14px', borderRadius:8, border:`1px solid ${T.borderStrong}`, background:'#fff', fontSize:13, cursor:'pointer', fontFamily:'inherit'}}>{cancelLabel || (primary ? 'Cancel' : 'Close')}</button>}
          {secondary && <button onClick={secondary.onClick} style={{display:'inline-flex', alignItems:'center', gap:8, padding:'8px 14px', borderRadius:8, border:`1px solid ${T.borderStrong}`, background:'#fff', fontSize:13, fontWeight:500, color:T.attioText, cursor:'pointer', fontFamily:'inherit'}}>
            {secondary.icon && <Icon name={secondary.icon} size={14} color={T.attioText}/>}{secondary.label}</button>}
          {primary && <button onClick={onSubmit} disabled={!canSubmit} style={{padding:'8px 14px', borderRadius:8, border:'none', fontSize:13, fontWeight:500, fontFamily:'inherit',
            background: !canSubmit ? T.gray400 : danger ? T.red : T.black, color:'#fff', cursor: canSubmit ? 'pointer' : 'default'}}>{primary}</button>}
        </div>}
      </div>
    </div>
  );
}

/* Searchable single-select: a field like FormSelect that opens a list with a search box on top;
   typing filters the options, picking one selects it and closes. options: [{value, label}]. */
function SearchableSelect({value, options, onChange, placeholder = 'Select', searchPlaceholder = 'Search'}){
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const ref = React.useRef(null);
  React.useEffect(()=>{
    if(!open) return;
    const h = (e) => { if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const current = options.find(o => o.value === value);
  const f = q.trim().toLowerCase();
  const shown = options.filter(o => !f || o.label.toLowerCase().includes(f));
  return (
    <div ref={ref} style={{position:'relative'}}>
      <button type="button" onClick={()=>{ setOpen(o => !o); setQ(''); }} style={{...fieldInput, display:'flex', alignItems:'center', justifyContent:'space-between', gap:8,
        cursor:'pointer', textAlign:'left', color: current ? T.attioText : T.gray400}}>
        <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{current ? current.label : placeholder}</span>
        <Icon name="chevDown" size={T.chevronSize} color={T.gray600}/>
      </button>
      {open && (
        <div style={{position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:60, background:'#fff', border:`1px solid ${T.border}`, borderRadius:10,
          boxShadow:'0 4px 16px rgba(16,24,40,.12)', padding:6}}>
          <div style={{position:'relative', marginBottom:4}}>
            <div style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', display:'flex'}}><Icon name="search" size={13} color={T.gray400}/></div>
            <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder={searchPlaceholder} style={{...fieldInput, paddingLeft:30}}/>
          </div>
          <div style={{maxHeight:220, overflowY:'auto'}}>
            {/* An option's `section` (e.g. Teams, Users) heads its run of options. */}
            {shown.map((o, i) => (<React.Fragment key={o.value}>
              {o.section && (i === 0 || shown[i - 1].section !== o.section) && <div style={{padding:'6px 10px 2px', fontSize:11.5, color:T.gray400}}>{o.section}</div>}
              <div onClick={()=>{ onChange(o.value); setOpen(false); }}
                style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, padding:'7px 10px', borderRadius:6, fontSize:13, cursor:'pointer',
                  color:T.attioText, background: o.value === value ? T.headerBg : 'transparent'}}
                onMouseEnter={e=>e.currentTarget.style.background = T.headerBg} onMouseLeave={e=>e.currentTarget.style.background = o.value === value ? T.headerBg : 'transparent'}>
                <span>{o.label}</span>
                {o.value === value && <Icon name="check" size={11} color={T.blue}/>}
              </div>
            </React.Fragment>))}
            {!shown.length && <div style={{padding:'8px 10px', fontSize:12.5, color:T.gray400}}>No matches.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/* Connect an account: choose the provider (when there's a choice), enter the account. */
/* The connection flow for one provider (opened from that provider's button): enter the
   account, Connect. Simulated — no real provider sign-in in the prototype. */
function ConnectAccountModal({provider, onCancel, onConnect}){
  const [email, setEmail] = React.useState('');
  const ok = stValidEmail(email);
  return (
    <StModal title={<span style={{display:'inline-flex', alignItems:'center', gap:8}}><ProviderLogo p={provider} size={18}/>Connect {provider.label}</span>}
      primary="Connect" canSubmit={ok} onCancel={onCancel} onSubmit={()=>onConnect({provider:provider.key, email:email.trim()})}>
      <div>
        <label style={fieldLabel}>Account email</label>
        <input autoFocus type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@company.com" style={fieldInput}/>
      </div>
    </StModal>
  );
}

function DisconnectModal({what, onCancel, onConfirm}){
  return (
    <StModal title={`Disconnect ${what}?`} primary="Disconnect" danger onCancel={onCancel} onSubmit={onConfirm}>
      <div style={{fontSize:13, color:T.gray600, lineHeight:1.5}}>It will no longer be connected to your CRM. You can connect it again at any time.</div>
    </StModal>
  );
}

const providerOf = (list, key) => list.find(p => p.key === key) || list[0];

/* ── Connected accounts (Email, Meetings, Calendar) ─────────────────────────────────────
   One page shape: provider buttons top-right, each opening that provider's connection flow;
   connected accounts in the Contacts grid; Disconnect from the row's ⋯ menu. */

// Which Tools Settings permission each page's connections need (Settings & Administration → Tools Settings).
const TOOL_SETTING_OF = {emails:'email', meetings:'meetings', calendars:'calendar'};
function ConnectedAccountsPage({title, description, providers, connectLabel, listKey, noun, emptyTitle, emptyText, data, setData}){
  const can = toolSettingCan(TOOL_SETTING_OF[listKey]);
  const [connecting, setConnecting] = React.useState(null);
  const [removing, setRemoving] = React.useState(null);
  const rows = data[listKey];
  const schema = {
    noun, searchKeys:['email'],
    properties:[
      {key:'email', label:'Account', width:280}, {key:'provider', label:'Provider', width:200},
      {key:'status', label:'Status', width:150}, {key:'connected', label:'Connected on', width:170},
    ],
    renderCell: providerCell(providers),
    renderActions: (r) => <RowActionsMenu items={can ? [{label:'Disconnect', danger:true, onClick:()=>setRemoving(r)}] : []}/>,
  };
  return (
    <SettingsPage title={title} description={description}
      actions={!can ? null : connectLabel
        ? <ConnectMenuButton label={connectLabel} providers={providers} onPick={setConnecting}/>
        : providers.map(p => <ProviderButton key={p.key} p={p} onClick={()=>setConnecting(p)}/>)}>
      {rows.length ? <RecordGrid schema={schema} rows={rows}/> : <StEmpty title={emptyTitle} description={emptyText}/>}
      {connecting && <ConnectAccountModal provider={connecting} onCancel={()=>setConnecting(null)}
        onConnect={({provider, email}) => {
          setData(d => ({...d, [listKey]:[...d[listKey], {id:stId(listKey), provider, email, status:'Connected', connected:stToday()}]}));
          setConnecting(null);
        }}/>}
      {removing && <DisconnectModal what={removing.email} onCancel={()=>setRemoving(null)}
        onConfirm={()=>{ setData(d => ({...d, [listKey]:d[listKey].filter(x => x.id !== removing.id)})); setRemoving(null); }}/>}
    </SettingsPage>
  );
}

const EmailSettings = (props) => <ConnectedAccountsPage {...props} description="Connect your work email to send and log emails from the CRM."
  providers={EMAIL_PROVIDERS} connectLabel="Connect Email" listKey="emails" noun="email account" emptyTitle="No email connected" emptyText="Choose your email provider to connect it."/>;
const MeetingsSettings = (props) => <ConnectedAccountsPage {...props} description="Connect your meeting accounts to create meeting links from the CRM."
  providers={MEETING_PROVIDERS} connectLabel="Connect Meeting" listKey="meetings" noun="meeting account" emptyTitle="No meeting account connected" emptyText="Choose a meeting provider to connect it."/>;
const CalendarSettings = (props) => <ConnectedAccountsPage {...props} description="Connect your calendar to see and schedule meetings in the CRM."
  providers={CALENDAR_PROVIDERS} connectLabel="Connect Calendar" listKey="calendars" noun="calendar" emptyTitle="No calendar connected" emptyText="Choose your calendar provider to connect it."/>;

/* ── Tools → Calls ─────────────────────────────────────────────────────────────────────── */

function ConnectNumberModal({onCancel, onAdd}){
  const [number, setNumber] = React.useState('');
  const [label, setLabel] = React.useState('');
  const ok = number.replace(/\D/g, '').length >= 7 && number.trim().startsWith('+');
  return (
    <StModal title="Connect Phone Number" primary="Connect" canSubmit={ok} onCancel={onCancel} onSubmit={()=>onAdd({number:number.trim(), label:label.trim()})}>
      <div>
        <label style={fieldLabel}>Phone number</label>
        <input autoFocus value={number} onChange={e=>setNumber(e.target.value)} placeholder="+92 300 0000000" style={fieldInput}/>
        <div style={{fontSize:12, color:T.gray400, marginTop:4}}>Include the country code.</div>
      </div>
      <div>
        <label style={fieldLabel}>Label</label>
        <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Sales line" style={fieldInput}/>
      </div>
    </StModal>
  );
}

function CallsSettings({data, setData}){
  const can = toolSettingCan('calls');
  const [adding, setAdding] = React.useState(false);
  const [removing, setRemoving] = React.useState(null);
  const rows = data.phones;
  const schema = {
    noun:'number', searchKeys:['number', 'label'],
    properties:[
      {key:'number', label:'Number', width:220}, {key:'label', label:'Label', width:200},
      {key:'status', label:'Status', width:150}, {key:'added', label:'Connected on', width:170},
    ],
    renderActions: (r) => <RowActionsMenu items={can ? [{label:'Disconnect', danger:true, onClick:()=>setRemoving(r)}] : []}/>,
  };
  return (
    <SettingsPage description="Connect the phone number you call from in the CRM."
      actions={can && <ProviderButton icon="call" label="Connect Phone Number" onClick={()=>setAdding(true)}/>}>
      {rows.length ? <RecordGrid schema={schema} rows={rows}/> : <StEmpty title="No phone number connected" description="Connect your number to make and log calls from the CRM."/>}
      {adding && <ConnectNumberModal onCancel={()=>setAdding(false)}
        onAdd={({number, label}) => { setData(d => ({...d, phones:[...d.phones, {id:stId('phone'), number, label, status:'Connected', added:stToday()}]})); setAdding(false); }}/>}
      {removing && <DisconnectModal what={removing.number} onCancel={()=>setRemoving(null)}
        onConfirm={()=>{ setData(d => ({...d, phones:d.phones.filter(x => x.id !== removing.id)})); setRemoving(null); }}/>}
    </SettingsPage>
  );
}

/* ── Forms (Tasks, Defaults): Cancel / Save in the page header ──────────────────────────── */

function useSettingsForm(value, onSave){
  const [draft, setDraft] = React.useState(value);
  const dirty = JSON.stringify(draft) !== JSON.stringify(value);
  const set = (p) => setDraft(d => ({...d, ...p}));
  const actions = <>
    {dirty && <StSecondary label="Cancel" onClick={()=>setDraft(value)}/>}
    <StCta label="Save" disabled={!dirty} onClick={()=>onSave(draft)}/>
  </>;
  return {draft, set, actions};
}

/* ── Task pipelines (Settings → Tasks) ── each pipeline's name; the default "General" one comes
   first. Every pipeline has the same statuses — In Progress, Completed, and Overdue (worked out:
   past its due date and not completed) — the Tasks board's and a record's Tasks tab's. A pipeline
   can be deleted once no task uses it (never the default). */
function TaskPipelineModal({initial, onCancel, onSave}){
  const [name, setName] = React.useState(initial ? initial.name : '');
  const ok = !!name.trim();
  return (
    <StModal title={initial ? 'Edit task pipeline' : 'New task pipeline'} primary="Save" canSubmit={ok} width={520} onCancel={onCancel}
      onSubmit={()=>ok && onSave({name:name.trim(), stages:TASK_PIPELINE_STAGES()}, {})}>
      <div><label style={fieldLabel}>Pipeline name</label><input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Document collection" style={fieldInput}/></div>
      <div style={{display:'flex', flexDirection:'column', gap:8}}>
        <label style={{...fieldLabel, marginBottom:0}}>Statuses</label>
        <TaskStatesLine/>
        <div style={stTextB}>Overdue is set automatically: a task past its due date that isn't completed.</div>
      </div>
    </StModal>
  );
}
// The three statuses as the section shows them.
function TaskStatesLine(){
  return (
    <div style={{display:'flex', flexWrap:'wrap', alignItems:'center', gap:6}}>
      {TASK_STATES.map((st, i) => (
        <React.Fragment key={st.key}>
          {i > 0 && <Icon name="arrowLeft" size={11} color={T.gray400} style={{transform:'rotate(180deg)'}}/>}
          <span style={{fontSize:12.5, color: st.key === 'overdue' ? T.red : T.attioText, padding:'2px 8px', borderRadius:6, border:`1px solid ${T.attioLine}`}}>{st.label}{st.key === 'overdue' ? ' · automatic' : ''}</span>
        </React.Fragment>
      ))}
    </div>
  );
}
function TaskPipelinesSection({data, setData}){
  const hub = useRecordHub();
  const pipelines = taskPipelinesOf(data);
  const [form, setForm] = React.useState(null);       // {id?}
  const [deleting, setDeleting] = React.useState(null);
  const tasks = hub ? hubActivities(hub, 'task') : [];
  const total = (pid) => tasks.filter(e => taskPipelineIdOf(e.act) === pid).length;
  const setPipelines = (fn) => setData(d => ({...d, taskPipelines:fn(taskPipelinesOf(d))}));
  const save = (vals, removed) => {
    const id = form.id || `tp-${Date.now().toString(36)}`;
    setPipelines(ps => form.id ? ps.map(p => p.id === id ? {...p, ...vals} : p) : [...ps, {id, ...vals}]);
    // Tasks in removed stages move to the stage chosen for them.
    tasks.filter(e => taskPipelineIdOf(e.act) === id && removed[e.act.status]).forEach(e => hub.update(e.object, e.recordId, e.act.id, {status:removed[e.act.status], pipelineId:id}));
    setForm(null);
  };
  const editing = form && form.id ? pipelines.find(p => p.id === form.id) : null;
  return (
    <div style={{display:'flex', flexDirection:'column', gap:12, marginTop:32, paddingTop:24, borderTop:`1px solid ${T.border}`}}>
      <div style={{display:'flex', alignItems:'center', gap:12}}>
        <div style={{flex:1}}>
          <div style={{fontSize:14, fontWeight:600, color:T.attioText}}>Task pipelines</div>
          <div style={{...stTextB, marginTop:2}}>Every pipeline's tasks are In Progress, Completed or Overdue (automatic).</div>
        </div>
        <StCta icon="plus" label="New pipeline" onClick={()=>setForm({})}/>
      </div>
      {pipelines.map(p => (
        <div key={p.id} style={{border:`1px solid ${T.attioLine}`, borderRadius:10, padding:'12px 14px', display:'flex', alignItems:'center', gap:12}}>
          <div style={{flex:1, minWidth:0}}>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <span style={{fontSize:13.5, fontWeight:600, color:T.attioText}}>{p.name}</span>
              {p.isDefault && <span style={{fontSize:11.5, fontWeight:500, padding:'1px 8px', borderRadius:9999, background:T.headerBg, color:T.gray600}}>Default</span>}
              <span style={{fontSize:12, color:T.attioMuted}}>{plural(total(p.id), 'task')}</span>
            </div>
            <div style={{marginTop:6}}><TaskStatesLine/></div>
          </div>
          <StSecondary label="Edit" onClick={()=>setForm({id:p.id})}/>
          {!p.isDefault && <button type="button" title={total(p.id) ? 'Move its tasks to another pipeline first' : 'Delete pipeline'} disabled={total(p.id) > 0}
            onClick={()=>setDeleting(p)} style={{border:'none', background:'transparent', cursor: total(p.id) ? 'default' : 'pointer', display:'flex', padding:4, opacity: total(p.id) ? .35 : 1}}>
            <Icon name="trash" size={14} color={T.gray600}/></button>}
        </div>
      ))}
      {form && <TaskPipelineModal initial={editing} onCancel={()=>setForm(null)} onSave={save}/>}
      {deleting && <StModal title="Delete task pipeline" primary="Delete" danger onCancel={()=>setDeleting(null)}
        onSubmit={()=>{ setPipelines(ps => ps.filter(p => p.id !== deleting.id)); setDeleting(null); }}>
        <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>{deleting.name} will be deleted.</div>
      </StModal>}
    </div>
  );
}

/* Without the page's permission (Tools Settings → Tasks; Company Defaults) the settings show but
   can't be changed: the fields are disabled and there's nothing to save. */
const ReadOnlySettings = ({on, children}) => on ? children
  : <fieldset disabled style={{border:'none', padding:0, margin:0, minWidth:0}}>{children}</fieldset>;
function TasksSettings({data, setData}){
  const can = toolSettingCan('tasks');
  const {draft:d, set, actions} = useSettingsForm(data.tasks, v => setData(x => ({...x, tasks:v})));
  return (
    <SettingsPage description="Your defaults for new tasks." actions={can && actions}>
      <ReadOnlySettings on={can}>
      <div style={{display:'flex', flexDirection:'column', gap:20}}>
        <StField label="Default due date"><StSelect value={d.dueDate} options={TASK_DUE_DATES} onChange={v=>set({dueDate:v})}/></StField>
        <StField label="Default due time">
          <TimeField required value={d.dueTime} onChange={v=>set({dueTime:v})} ariaLabel="Default due time" inputStyle={stInput}/>
        </StField>
        <StField label="Default reminder"><StSelect value={d.reminder} options={TASK_REMINDERS} onChange={v=>set({reminder:v})}/></StField>
        {d.reminder === 'custom' && (
          <div style={{display:'flex', alignItems:'center', gap:8, width:310, marginTop:-8}}>
            <input type="number" min={1} value={d.customAmount} aria-label="Reminder amount"
              onChange={e=>{ const n = Math.round(Number(e.target.value)); if(n >= 1) set({customAmount:n}); }}
              style={{...stInput, width:80}}/>
            <div style={{flex:1}}><StSelect value={d.customUnit} options={REMINDER_UNITS} onChange={v=>set({customUnit:v})}/></div>
            <span style={{...stTextB, flexShrink:0}}>before</span>
          </div>
        )}
      </div>
      <TaskPipelinesSection data={data} setData={setData}/>
      </ReadOnlySettings>
    </SettingsPage>
  );
}

function DefaultsSettings({data, setData}){
  const can = defaultsCan();
  const {draft:d, set, actions} = useSettingsForm(data.defaults, v => setData(x => ({...x, defaults:v})));
  return (
    <SettingsPage description="Company-wide preferences for everyone in the CRM." actions={can && actions}>
      <ReadOnlySettings on={can}>
      <div style={{display:'flex', flexDirection:'column', gap:20}}>
        <StField label="Time Zone"><StSelect value={d.timeZone} options={TIME_ZONES} onChange={v=>set({timeZone:v})}/></StField>
        <StField label="Language"><StSelect value={d.language} options={LANGUAGES} onChange={v=>set({language:v})}/></StField>
        <StField label="Currency"><StSelect value={d.currency} options={CURRENCIES} onChange={v=>set({currency:v})}/></StField>
      </div>
      </ReadOnlySettings>
    </SettingsPage>
  );
}

/* ── Router ────────────────────────────────────────────────────────────────────────────── */

const SETTINGS_PAGES = {
  'settings.email':      EmailSettings,
  'settings.calls':      CallsSettings,
  'settings.meetings':   MeetingsSettings,
  'settings.calendar':   CalendarSettings,
  'settings.tasks':      TasksSettings,
  'settings.defaults':   DefaultsSettings,
  'settings.usersTeams': UsersTeamsSettings,
  'settings.navigation': NavigationSettings,
  'settings.objects':    ObjectsSettings,
  'settings.properties': PropertiesSettings,
  'settings.pipelines':  PipelinesSettings,
  // Customer Profile: the forms of what we collect about customers (customerProfile.jsx).
  'settings.customerProfile': ProfileFormsSettings,
};

// `records`: record data a Settings page reads (Pipelines counts each stage's deals); `nav` /
// `setNav`: the CRM navigation (Navigation).
// `onWorkflowOpen(open)`: a workflow opened or closed (Pipelines) — App collapses the Settings menu meanwhile.
// `target` / `onTargetDone`: an entity picked in Quick Search — the page opens it, then clears it.
// `updateRecords(objectId, fn)`: a settings change that reaches the records (a property's values, a link removed).
function CrmSettingsPage({pageId, data, setData, navigate, records, updateRecords, nav, setNav, onWorkflowOpen, target, onTargetDone}){
  const Page = SETTINGS_PAGES[pageId];
  return <Page key={pageId} data={data} setData={setData} navigate={navigate} records={records} updateRecords={updateRecords} nav={nav} setNav={setNav} onWorkflowOpen={onWorkflowOpen}
    target={target && target.page === pageId ? target : null} onTargetDone={onTargetDone}/>;
}

Object.assign(window, {SearchableSelect, SETTINGS_PAGES, CrmSettingsPage, DEFAULT_SETTINGS_DATA, SettingsPage, StCta, StSecondary, StTextAction,
  StField, StSelect, StRadioCard, StModal, stTextB, stControl});
