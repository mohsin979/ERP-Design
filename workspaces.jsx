/* HOF Pulse ERP — Sign-in, workspaces and brand.

   Sign-in (the first screen): Continue with Google, mocked — any address on the HOF Migration
   or HOF Global domains is accepted, with no real Google account behind it. Signing in opens
   the last workspace; inside it the person is the user with that email, or joins its Users.

   Workspaces: the top-left switcher in the ERP header. Each workspace is a separate account
   environment — its own users, records and configuration (its own saved store, store.jsx).
   Creating one asks for its name and, optionally, a logo; it starts empty, with its creator as
   Super Admin.

   Brand (CRM → Marketing → Brand): workspace administrators set the workspace logo, brand
   colours (used on the workspace's mark and its quotations), the company email signature and
   the digital letterhead. */

const ALLOWED_EMAIL_DOMAINS = ['hofmigration.com', 'hof-global.com'];
const emailDomain = (email) => String(email || '').trim().toLowerCase().split('@')[1] || '';
const signInAllowed = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim()) && ALLOWED_EMAIL_DOMAINS.includes(emailDomain(email));
// Administrators of the open workspace (their Permission Preset).
const WORKSPACE_ADMIN_PRESETS = ['Super Admin', 'Admin'];
const isWorkspaceAdmin = () => WORKSPACE_ADMIN_PRESETS.includes(CURRENT_USER.role);
function signOut(){ reloadInto({session:null}); }

/* The registry as React state: Brand edits and Create workspace update it, and every mark on
   screen follows. */
const WS_EVENT = 'hof-workspaces-changed';
function useWorkspaces(){
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => { window.addEventListener(WS_EVENT, force); return () => window.removeEventListener(WS_EVENT, force); }, []);
  const update = (patch) => { saveWorkspaceRegistry(patch); window.dispatchEvent(new Event(WS_EVENT)); };
  const active = WORKSPACE_REGISTRY.workspaces.find(w => w.id === WORKSPACE_REGISTRY.activeId) || ACTIVE_WORKSPACE;
  return {workspaces:WORKSPACE_REGISTRY.workspaces, active, update};
}
const updateWorkspace = (update, id, patch) => update({workspaces:WORKSPACE_REGISTRY.workspaces.map(w => w.id === id ? {...w, ...patch} : w)});

/* An image file as a data URL (logos), at most `max` bytes. */
const LOGO_MAX_BYTES = 400 * 1024;
const readImageFile = (file, max = LOGO_MAX_BYTES) => new Promise((resolve, reject) => {
  if(!file || !/^image\//.test(file.type)) return reject(new Error('Choose an image file (PNG, JPG or SVG).'));
  if(file.size > max) return reject(new Error(`Choose an image under ${Math.round(max / 1024)} KB.`));
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(new Error('That file could not be read.'));
  r.readAsDataURL(file);
});

const wsInitials = (name) => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'W';
/* A workspace's square mark: its logo, or its initials on its primary colour. */
function WorkspaceTile({ws, size = 20}){
  const box = {width:size, height:size, borderRadius:Math.round(size / 4), flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center'};
  if(ws.logo) return <span style={{...box, background:'#fff', border:`1px solid ${T.attioLine}`}}><img src={ws.logo} alt="" style={{width:'100%', height:'100%', objectFit:'contain'}}/></span>;
  return <span style={{...box, background:(ws.colors || DEFAULT_BRAND()).primary, color:'#fff', fontSize:Math.round(size * .42), fontWeight:700, letterSpacing:.2}}>{wsInitials(ws.name)}</span>;
}
/* The header lockup: HOF Migration's own lockup until it has a logo; any other workspace, its
   logo (or initials) and its name. */
function WorkspaceLockup({ws}){
  if(!ws.logo && ws.id === HOF_MIGRATION_WS) return <Logo variant="main" height={16}/>;
  return (
    <span style={{display:'inline-flex', alignItems:'center', gap:8, minWidth:0}}>
      <WorkspaceTile ws={ws} size={22}/>
      <span style={{fontSize:14, fontWeight:600, color:T.attioText, whiteSpace:'nowrap'}}>{ws.name}</span>
    </span>
  );
}

/* ── Workspace switcher (ERP header, top left) ── */
function WorkspaceSwitcher(){
  const {workspaces, active, update} = useWorkspaces();
  const [open, setOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  return (
    <div style={{position:'relative', flexShrink:0}}>
      <div onClick={()=>setOpen(v=>!v)} title="Switch workspace" style={{display:'flex', alignItems:'center', gap:6, cursor:'pointer'}}>
        <WorkspaceLockup ws={active}/>
        <Icon name="chevDown" size={T.chevronSize} color={T.gray600} style={{transform: open ? 'rotate(180deg)' : 'none'}}/>
      </div>
      <MenuShell open={open} onClose={()=>setOpen(false)} width={260}>
        <div style={{padding:'4px 10px 6px', fontSize:11.5, color:T.gray400}}>Workspaces</div>
        {workspaces.map(w => (
          <div key={w.id} onClick={()=>{ setOpen(false); if(w.id !== active.id) reloadInto({activeId:w.id}); }}
            style={{display:'flex', alignItems:'center', gap:10, padding:'7px 10px', borderRadius:6, cursor:'pointer', background: w.id === active.id ? T.headerBg : 'transparent'}}
            onMouseEnter={e=>e.currentTarget.style.background = T.headerBg} onMouseLeave={e=>e.currentTarget.style.background = w.id === active.id ? T.headerBg : 'transparent'}>
            <WorkspaceTile ws={w} size={22}/>
            <span style={{flex:1, minWidth:0, fontSize:13, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{w.name}</span>
            {w.id === active.id && <Icon name="check" size={12} color={T.blue}/>}
          </div>
        ))}
        <div style={{height:1, background:T.border, margin:'4px 2px'}}/>
        <MenuItem icon={<Icon name="plus" size={13} color={T.gray600}/>} label="Create workspace" onClick={()=>{ setOpen(false); setCreating(true); }}/>
      </MenuShell>
      {creating && <CreateWorkspaceModal onClose={()=>setCreating(false)} onCreate={(ws)=>{
        update({workspaces:[...workspaces, ws]});
        reloadInto({activeId:ws.id});
      }}/>}
    </div>
  );
}

/* A logo field: preview, Upload / Replace and Remove. */
function LogoField({value, onChange, disabled}){
  const input = React.useRef(null);
  const [error, setError] = React.useState('');
  const pick = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if(!f) return;
    readImageFile(f).then(url => { setError(''); onChange(url); }).catch(err => setError(err.message));
  };
  return (
    <div style={{display:'flex', flexDirection:'column', gap:6}}>
      <div style={{display:'flex', alignItems:'center', gap:12}}>
        <div style={{width:56, height:56, borderRadius:10, border:`1px dashed ${T.borderStrong}`, background:T.headerBg, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0}}>
          {value ? <img src={value} alt="Logo" style={{width:'100%', height:'100%', objectFit:'contain', background:'#fff'}}/> : <Icon name="brand" size={20} color={T.gray400}/>}
        </div>
        {!disabled && <>
          <input ref={input} type="file" accept="image/*" onChange={pick} style={{display:'none'}}/>
          <StSecondary label={value ? 'Replace' : 'Upload logo'} onClick={()=>input.current && input.current.click()}/>
          {value && <StTextAction label="Remove" onClick={()=>onChange(null)}/>}
        </>}
      </div>
      {error && <div style={{fontSize:12, color:T.red}}>{error}</div>}
    </div>
  );
}

function CreateWorkspaceModal({onClose, onCreate}){
  const [name, setName] = React.useState('');
  const [logo, setLogo] = React.useState(null);
  const taken = WORKSPACE_REGISTRY.workspaces.some(w => w.name.trim().toLowerCase() === name.trim().toLowerCase());
  const ok = !!name.trim() && !taken;
  const create = () => {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
    onCreate({id:`ws-${slug}-${Date.now().toString(36)}`, name:name.trim(), logo, colors:DEFAULT_BRAND(), sample:false,
      createdAt:new Date().toISOString().slice(0, 10), createdBy:SESSION && SESSION.email});
  };
  return (
    <StModal title="Create workspace" primary="Create workspace" canSubmit={ok} onSubmit={create} onCancel={onClose}>
      <div>
        <label style={fieldLabel}>Workspace name</label>
        <input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. HOF Canada" style={fieldInput}/>
        {taken && <div style={{fontSize:12, color:T.red, marginTop:4}}>A workspace with this name already exists.</div>}
      </div>
      <div>
        <label style={fieldLabel}>Logo</label>
        <LogoField value={logo} onChange={setLogo}/>
      </div>
    </StModal>
  );
}

/* ── Sign-in ── the first screen, on the workflow canvas's dotted ground. */
const GOOGLE_COLORS = ['#4285F4', '#EA4335', '#FBBC05', '#34A853'];
function LoginScreen(){
  const [step, setStep] = React.useState('start');   // start | google
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState('');
  const known = (WORKSPACE_REGISTRY.accounts || []).filter(signInAllowed);
  const signIn = (address) => {
    const a = String(address || '').trim().toLowerCase();
    if(!signInAllowed(a)){ setError('Use your hofmigration.com or hof-global.com account.'); return; }
    reloadInto({session:{email:a, signedInAt:Date.now()}, accounts:[a, ...known.filter(x => x !== a)].slice(0, 5)});
  };
  const card = {width:380, maxWidth:'100%', background:'#fff', border:`1px solid ${T.border}`, borderRadius:14, boxShadow:'0 12px 32px rgba(16,24,40,.08)',
    padding:'32px 28px', display:'flex', flexDirection:'column', gap:20};
  const googleBtn = {display:'flex', alignItems:'center', justifyContent:'center', gap:10, height:42, borderRadius:10, border:`1px solid ${T.borderStrong}`,
    background:'#fff', fontSize:14, fontWeight:500, color:T.attioText, cursor:'pointer', fontFamily:'inherit', width:'100%'};
  return (
    <div style={{...WORKFLOW_CANVAS, minHeight:'100%', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px 16px', boxSizing:'border-box'}}>
      <div style={card}>
        <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:14}}>
          <img src="assets/brand/pulse-logo.svg" alt="Pulse" height={28} style={{display:'block', height:28}}/>
          <div style={{fontSize:18, fontWeight:600, color:T.attioText}}>{step === 'start' ? 'Sign in to Pulse' : 'Sign in with Google'}</div>
        </div>
        {step === 'start' ? (
          <button onClick={()=>{ setStep('google'); setError(''); }} style={googleBtn}>
            <Icon name="googleLogo" size={16} color={GOOGLE_COLORS[0]}/> Continue with Google
          </button>
        ) : (
          <div style={{display:'flex', flexDirection:'column', gap:12}}>
            {known.map(a => (
              <button key={a} onClick={()=>signIn(a)} style={{...googleBtn, justifyContent:'flex-start', padding:'0 12px', fontWeight:400}}>
                <span style={{width:24, height:24, borderRadius:9999, background:T.attioText, color:'#fff', fontSize:11, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center'}}>{a[0].toUpperCase()}</span>
                <span style={{minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{a}</span>
              </button>
            ))}
            <form onSubmit={e=>{ e.preventDefault(); signIn(email); }} style={{display:'flex', flexDirection:'column', gap:10}}>
              <input id="login-email" autoFocus type="email" value={email} onChange={e=>{ setEmail(e.target.value); setError(''); }} placeholder="Email" aria-label="Email"
                style={{...fieldInput, height:42, borderColor: error ? T.red : T.borderStrong}}/>
              {error && <div style={{fontSize:12.5, color:T.red}}>{error}</div>}
              <button type="submit" disabled={!email.trim()} style={{height:42, borderRadius:10, border:'none', background: email.trim() ? T.black : T.gray400, color:'#fff',
                fontSize:14, fontWeight:500, cursor: email.trim() ? 'pointer' : 'default', fontFamily:'inherit'}}>Next</button>
            </form>
            <button onClick={()=>{ setStep('start'); setError(''); }} style={{alignSelf:'center', border:'none', background:'transparent', fontSize:13, color:T.gray600, cursor:'pointer', fontFamily:'inherit'}}>Back</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Brand (CRM → Marketing → Brand) ── four sections, switched with the Settings tabs (as in
   Users & Teams): Logo, Color System, Email Signature, Digital Letterhead. Each is saved on the
   workspace; administrators edit, everyone else sees them. */
const BRAND_SECTIONS = [
  // Color System (BrandColorsSection) is hidden for now; its saved colours still apply.
  {id:'logo', label:'Logo', icon:'profile'},
  {id:'signature', label:'Email Signature', icon:'envelope'}, {id:'letterhead', label:'Digital Letterhead', icon:'files'},
];
const BRAND_COLOR_FIELDS = [{key:'primary', label:'Primary color'}, {key:'secondary', label:'Secondary color'}];
const validHex = (v) => /^#[0-9a-f]{6}$/i.test(v);
const brandRow = (label, content) => (
  <div key={label} style={{display:'flex', alignItems:'flex-start', gap:24, padding:'16px 0', borderBottom:`1px solid ${T.attioLine}`}}>
    <div style={{width:180, flexShrink:0, fontSize:13, color:T.attioText, paddingTop:6}}>{label}</div>
    <div style={{flex:1, minWidth:0}}>{content}</div>
  </div>
);
// A section's Cancel / Save (administrators), enabled once something changed.
const BrandActions = ({admin, dirty, valid = true, onCancel, onSave}) => !admin ? null : (
  <><StSecondary label="Cancel" disabled={!dirty} onClick={onCancel}/><StCta label="Save" disabled={!dirty || !valid} onClick={onSave}/></>
);

/* Logo: the uploaded logo, or HOF Migration's own lockup until one is uploaded; Upload /
   Replace and Remove (back to the lockup). */
function BrandLogoSection({active, update, admin, toast, setActions}){
  const saved = active.logo || null;
  const [draft, setDraft] = React.useState(saved);
  const [error, setError] = React.useState('');
  const input = React.useRef(null);
  const dirty = draft !== saved;
  const pick = (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if(!f) return;
    readImageFile(f).then(url => { setError(''); setDraft(url); }).catch(err => setError(err.message)); };
  React.useEffect(() => setActions(<BrandActions admin={admin} dirty={dirty} onCancel={()=>setDraft(saved)}
    onSave={()=>{ updateWorkspace(update, active.id, {logo:draft}); toast('Logo saved'); }}/>), [draft, saved, admin]);
  return brandRow('Company logo', (
    <div style={{display:'flex', flexDirection:'column', gap:10}}>
      <div style={{width:260, height:104, borderRadius:10, border:`1px dashed ${T.borderStrong}`, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', padding:12}}>
        {draft ? <img src={draft} alt="Company logo" style={{maxWidth:'100%', maxHeight:'100%', objectFit:'contain'}}/>
          : active.id === HOF_MIGRATION_WS ? <Logo variant="main" height={30}/>
          : <Icon name="brand" size={22} color={T.gray400}/>}
      </div>
      {admin && <div style={{display:'flex', alignItems:'center', gap:10}}>
        <input ref={input} type="file" accept="image/*" onChange={pick} style={{display:'none'}}/>
        <StSecondary label={draft || active.id === HOF_MIGRATION_WS ? 'Replace' : 'Upload logo'} onClick={()=>input.current && input.current.click()}/>
        {draft && <StTextAction label="Remove" onClick={()=>setDraft(null)}/>}
      </div>}
      {error && <div style={{fontSize:12, color:T.red}}>{error}</div>}
    </div>
  ));
}

/* Color System: any number of named brand colours — Add Color, rename, recolour, delete. The
   first two also stand in for the primary and secondary colours the rest of the ERP reads
   (the workspace mark, quotations), so those keep working. */
const brandPalette = (ws) => Array.isArray(ws.palette) ? ws.palette : (() => {
  const c = {...DEFAULT_BRAND(), ...(ws.colors || {})};
  return [{id:'bc-primary', name:'Primary', value:c.primary}, {id:'bc-secondary', name:'Secondary', value:c.secondary}];
})();
const colorsFromPalette = (palette) => {
  const d = DEFAULT_BRAND(), ok = palette.filter(c => validHex(c.value));
  return {primary: ok[0] ? ok[0].value : d.primary, secondary: (ok[1] || ok[0] || {}).value || d.secondary};
};
function BrandColorsSection({active, update, admin, toast, setActions}){
  const saved = brandPalette(active);
  const [draft, setDraft] = React.useState(saved);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const valid = draft.every(c => c.name.trim() && validHex(c.value));
  const set = (id, p) => setDraft(list => list.map(c => c.id === id ? {...c, ...p} : c));
  const add = () => setDraft(list => [...list, {id:`bc-${Date.now().toString(36)}`, name:'', value:'#000000'}]);
  React.useEffect(() => setActions(<BrandActions admin={admin} dirty={dirty} valid={valid} onCancel={()=>setDraft(saved)}
    onSave={()=>{ const palette = draft.map(c => ({...c, name:c.name.trim()})); updateWorkspace(update, active.id, {palette, colors:colorsFromPalette(palette)}); toast('Colors saved'); }}/>),
    [JSON.stringify(draft), JSON.stringify(saved), admin]);
  const mono = {fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace'};
  return (
    <div style={{display:'flex', flexDirection:'column'}}>
      {draft.map((c, i) => (
        <div key={c.id} style={{display:'flex', alignItems:'center', gap:10, padding:'12px 0', borderBottom:`1px solid ${T.attioLine}`}}>
          <input type="color" aria-label={`${c.name || `Color ${i + 1}`} value`} value={validHex(c.value) ? c.value : '#000000'} disabled={!admin}
            onChange={e=>set(c.id, {value:e.target.value.toUpperCase()})}
            style={{width:36, height:32, padding:2, border:`1px solid ${T.borderStrong}`, borderRadius:8, background:'#fff', cursor: admin ? 'pointer' : 'default', flexShrink:0}}/>
          <input value={c.name} disabled={!admin} onChange={e=>set(c.id, {name:e.target.value})} placeholder="Color name" aria-label={`Color ${i + 1} name`}
            style={{...fieldInput, width:220, borderColor: c.name.trim() ? T.borderStrong : T.red}}/>
          <input value={c.value} disabled={!admin} onChange={e=>set(c.id, {value:e.target.value.trim()})} aria-label={`Color ${i + 1} hex`}
            style={{...fieldInput, ...mono, width:120, borderColor: validHex(c.value) ? T.borderStrong : T.red}}/>
          {i < 2 && <span style={{fontSize:12, color:T.attioMuted}}>{i === 0 ? 'Used as primary' : 'Used as secondary'}</span>}
          <span style={{flex:1}}/>
          {admin && <button type="button" title="Delete color" onClick={()=>setDraft(list => list.filter(x => x.id !== c.id))}
            style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:6, borderRadius:6}}><Icon name="trash" size={14} color={T.gray600}/></button>}
        </div>
      ))}
      {!draft.length && <div style={{padding:'16px 0', fontSize:13, color:T.attioMuted}}>No brand colors yet.</div>}
      {admin && <div style={{paddingTop:14}}><StSecondary label={<span style={{display:'inline-flex', alignItems:'center', gap:6}}><Icon name="plus" size={12} color={T.gray800}/>Add Color</span>} onClick={add}/></div>}
    </div>
  );
}

/* The company logo, as set in Logo: the uploaded one, HOF Migration's lockup, or the initials. */
function BrandLogoMark({ws, height = 28}){
  if(ws.logo) return <img src={ws.logo} alt="" style={{display:'block', height, maxWidth:height * 5, objectFit:'contain'}}/>;
  if(ws.id === HOF_MIGRATION_WS) return <Logo variant="main" height={height * .7}/>;
  return <WorkspaceTile ws={ws} size={height}/>;
}
/* Email Signature and Digital Letterhead share the call interface's split: the form on the
   left, a second pane on the right (here, the live preview) behind a divider. */
function BrandSplit({form, preview}){
  return (
    <div style={{display:'flex', minHeight:520, marginTop:16, border:`1px solid ${T.border}`, borderRadius:12, overflow:'hidden', background:'#fff'}}>
      <div style={{flex:'0 0 440px', minWidth:0, padding:20, display:'flex', flexDirection:'column', gap:10}}>{form}</div>
      <div style={{flex:1, minWidth:0, borderLeft:`1px solid ${T.border}`, background:T.headerBg, padding:20, display:'flex', flexDirection:'column', gap:12}}>
        <span style={{fontSize:11, fontWeight:600, color:T.attioFaint, textTransform:'uppercase', letterSpacing:.4}}>Preview</span>
        {preview}
      </div>
    </div>
  );
}
const brandTextField = (value, onChange, placeholder, opts = {}) => opts.multiline
  ? <textarea value={value} onChange={e=>onChange(e.target.value)} rows={3} disabled={opts.disabled} placeholder={placeholder} style={{...fieldText, resize:'vertical', lineHeight:1.5}}/>
  : <input value={value} onChange={e=>onChange(e.target.value)} disabled={opts.disabled} placeholder={placeholder}
      style={{...fieldText, borderColor: opts.invalid ? T.red : undefined}}/>;
const brandEmailOk = (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
// A section's saved configuration vs. its draft, with Cancel / Save in the tab row.
function useBrandDraft({active, update, admin, toast, setActions, key, blank, label, valid = () => true}){
  const saved = {...blank, ...(active[key] && !active[key].dataUrl ? active[key] : {})};
  const [draft, setDraft] = React.useState(saved);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  React.useEffect(() => setActions(<BrandActions admin={admin} dirty={dirty} valid={valid(draft)} onCancel={()=>setDraft(saved)}
    onSave={()=>{ updateWorkspace(update, active.id, {[key]:Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]))}); toast(`${label} saved`); }}/>),
    [JSON.stringify(draft), JSON.stringify(saved), admin]);
  return [draft, (k, v) => setDraft(d => ({...d, [k]:v}))];
}

/* Email Signature: the company's reusable signature — the form, and the signature as it will
   read at the end of an email. The logo is the company logo (Logo), shown or not. */
const SIGNATURE_FIELDS = [
  {key:'name', label:'Name', placeholder:'e.g. Asim Ali'}, {key:'designation', label:'Designation', placeholder:'e.g. Senior Migration Consultant'},
  {key:'email', label:'Email', placeholder:'name@hofmigration.com'}, {key:'phone', label:'Phone', placeholder:'+971 4 000 0000'},
  {key:'website', label:'Website', placeholder:'https://hofmigration.com'}, {key:'address', label:'Company address', multiline:true},
];
const SIGNATURE_BLANK = {includeLogo:true, name:'', designation:'', email:'', phone:'', website:'', address:''};
function EmailSignatureBlock({sig, ws}){
  const line = {fontSize:13, color:T.attioText, lineHeight:1.5};
  const contact = [sig.email, sig.phone, sig.website].filter(Boolean);
  const logo = sig.includeLogo;
  return (
    <div style={{display:'flex', gap:16, alignItems:'center'}}>
      {logo && <div style={{flexShrink:0}}><BrandLogoMark ws={ws} height={40}/></div>}
      <div style={{minWidth:0, paddingLeft: logo ? 16 : 0, borderLeft: logo ? `2px solid ${T.attioLine}` : 'none'}}>
        <div style={{...line, fontWeight:600, color: sig.name ? T.attioText : T.attioFaint}}>{sig.name || 'Name'}</div>
        {sig.designation && <div style={{...line, color:T.attioMuted}}>{sig.designation}</div>}
        {contact.length > 0 && <div style={{...line, marginTop:6}}>{contact.join('  ·  ')}</div>}
        {sig.address && <div style={{...line, color:T.attioMuted, whiteSpace:'pre-line'}}>{sig.address}</div>}
      </div>
    </div>
  );
}
function BrandSignatureSection(props){
  const {active, admin} = props;
  const [sig, set] = useBrandDraft({...props, key:'signature', blank:SIGNATURE_BLANK, label:'Email signature', valid:(d) => !!d.name.trim() && brandEmailOk(d.email)});
  return (
    <BrandSplit
      form={<>
        <Field label="Logo">
          <label style={{display:'flex', alignItems:'center', gap:8, paddingTop:7, fontSize:13, color:T.attioText, cursor: admin ? 'pointer' : 'default'}}>
            <UtToggle on={sig.includeLogo} onChange={(v)=>admin && set('includeLogo', v)}/> Show the company logo
          </label>
        </Field>
        {SIGNATURE_FIELDS.map(f => (
          <Field key={f.key} label={f.label}>{brandTextField(sig[f.key], (v)=>set(f.key, v), f.placeholder, {multiline:f.multiline, disabled:!admin, invalid: f.key === 'email' && !brandEmailOk(sig.email)})}</Field>
        ))}
      </>}
      preview={
        <div style={{background:'#fff', border:`1px solid ${T.attioLine}`, borderRadius:10, padding:'18px 20px', maxWidth:560}}>
          <div style={{fontSize:13, color:T.attioMuted, lineHeight:1.6, marginBottom:16}}>Kind regards,</div>
          <EmailSignatureBlock sig={sig} ws={active}/>
        </div>
      }/>
  );
}

/* Digital Letterhead: the company information on the letterhead, with the company logo (Logo);
   the preview is a page with that header and footer. */
const LETTERHEAD_FIELDS = [
  {key:'companyName', label:'Company name', placeholder:'e.g. HOF Migration'}, {key:'address', label:'Address', multiline:true},
  {key:'phone', label:'Phone', placeholder:'+971 4 000 0000'}, {key:'email', label:'Email', placeholder:'info@hofmigration.com'},
  {key:'website', label:'Website', placeholder:'https://hofmigration.com'}, {key:'footer', label:'Footer note', placeholder:'e.g. Licensed immigration consultants'},
];
function BrandLetterheadSection(props){
  const {active, admin} = props;
  const [lh, set] = useBrandDraft({...props, key:'letterhead', blank:{companyName:active.name, address:'', phone:'', email:'', website:'', footer:''}, label:'Letterhead',
    valid:(d) => !!d.companyName.trim() && brandEmailOk(d.email)});
  const accent = colorsFromPalette(brandPalette(active)).primary;
  const small = {fontSize:10.5, color:T.gray600, lineHeight:1.5};
  const contact = [lh.phone, lh.email, lh.website].filter(Boolean);
  return (
    <BrandSplit
      form={LETTERHEAD_FIELDS.map(f => (
        <Field key={f.key} label={f.label}>{brandTextField(lh[f.key], (v)=>set(f.key, v), f.placeholder, {multiline:f.multiline, disabled:!admin, invalid: f.key === 'email' && !brandEmailOk(lh.email)})}</Field>
      ))}
      preview={
        <div style={{background:'#fff', border:`1px solid ${T.attioLine}`, borderRadius:4, width:'100%', maxWidth:460, aspectRatio:'1 / 1.414', alignSelf:'center',
          boxShadow:'0 4px 16px rgba(16,24,40,.08)', display:'flex', flexDirection:'column', padding:'26px 28px'}}>
          <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16}}>
            <BrandLogoMark ws={active} height={32}/>
            <div style={{textAlign:'right', minWidth:0}}>
              <div style={{fontSize:12, fontWeight:600, color:T.attioText}}>{lh.companyName || 'Company name'}</div>
              {lh.address && <div style={{...small, whiteSpace:'pre-line'}}>{lh.address}</div>}
              {contact.map(x => <div key={x} style={small}>{x}</div>)}
            </div>
          </div>
          <div style={{height:2, background:accent, margin:'16px 0 18px'}}/>
          {/* The letter's body goes here. */}
          <div style={{flex:1, display:'flex', flexDirection:'column', gap:7}}>
            {[92, 100, 96, 70, 0, 100, 88, 94, 60].map((w, i) => <div key={i} style={{height:5, width:`${w}%`, borderRadius:3, background: w ? '#EEEEF0' : 'transparent'}}/>)}
          </div>
          <div style={{borderTop:`1px solid ${T.attioLine}`, paddingTop:8, ...small, textAlign:'center'}}>
            {lh.footer || [lh.companyName, lh.website].filter(Boolean).join(' · ')}
          </div>
        </div>
      }/>
  );
}

function BrandPage(){
  const {active, update} = useWorkspaces();
  const admin = isWorkspaceAdmin();
  const [section, setSection] = React.useState('logo');
  const [actions, setActions] = React.useState(null);
  const [message, setMessage] = React.useState(null);
  const toast = (m) => { setMessage(m); setTimeout(()=>setMessage(null), 1800); };
  const Section = {logo:BrandLogoSection, colors:BrandColorsSection, signature:BrandSignatureSection, letterhead:BrandLetterheadSection}[section];
  return (
    <SettingsPage>
      <div style={{display:'flex', alignItems:'flex-end', gap:8, borderBottom:`1px solid ${T.borderStrong}`}}>
        {BRAND_SECTIONS.map(t => <UtTab key={t.id} icon={t.icon} label={t.label} active={section === t.id} onClick={()=>{ setActions(null); setSection(t.id); }}/>)}
        <div style={{flex:1}}/>
        {actions && <div style={{display:'flex', alignItems:'center', gap:8, paddingBottom:8}}>{actions}</div>}
      </div>
      <div style={{maxWidth: section === 'signature' || section === 'letterhead' ? 'none' : 820, marginTop:4}}>
        <Section key={`${section}-${active.id}`} active={active} update={update} admin={admin} toast={toast} setActions={setActions}/>
        {!admin && <div style={{...stTextB, marginTop:12}}>Only workspace administrators can change the brand.</div>}
      </div>
      <CopyToast message={message}/>
    </SettingsPage>
  );
}

// The open workspace's brand (quotations, documents).
const workspaceBrand = () => { const w = WORKSPACE_REGISTRY.workspaces.find(x => x.id === WORKSPACE_REGISTRY.activeId) || ACTIVE_WORKSPACE; return {...w, colors:{...DEFAULT_BRAND(), ...(w.colors || {})}}; };

Object.assign(window, {ALLOWED_EMAIL_DOMAINS, signInAllowed, isWorkspaceAdmin, signOut, useWorkspaces, WorkspaceTile, WorkspaceLockup, WorkspaceSwitcher,
  CreateWorkspaceModal, LoginScreen, BrandPage, LogoField, readImageFile, workspaceBrand});
