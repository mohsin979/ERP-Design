/* HOF Pulse ERP — Settings → CRM Settings → Ads (2026-11-24).

   Lead ads are connected here, not on Marketing forms (Mohsin, 2026-11-24: "connection to Meta is a
   completely different feature"; Marketing forms keep their link and the Website RFQ). One row of
   navigation: the tabs, and at its right "+ Connect Account" — a menu of ad platforms: Meta, and
   Google Ads greyed (not available yet). Under it one row: search and Filters. Accounts show their
   platform. Three levels, as Meta has them, each a tab:
     Accounts — the Meta ad accounts connected: Account Name, Ad Account ID, Pages, Forms,
                Connected By, Connected On. Connect Account (the account's name and Ad Account ID —
                there's no real Meta sign-in in the prototype); ⋯ View Pages, Disconnect Account
                (asked first: its pages and forms leave the CRM; leads already made stay).
     Pages    — every page of those accounts: Page Name, Account, Forms. A page belongs to one
                account.
     Forms    — every lead form of those pages: Form Name, Page, Account, Questions, Matched,
                Status (Matched / Needs Matching), Leads. A form belongs to one page.
   An account's or a page's name opens the next level narrowed to it (a chip above the table,
   × to clear it). A form's name opens Match Properties, a side panel: Creates — the record type
   the form's leads become, any of the workspace's (Lead, Deal, Customer — Mohsin: "any object and
   its properties, not just leads"; a Lead to start with) — then each of the form's questions
   beside a property of that record to fill in, only the properties its answer can go into; one
   property per question; the record's name must be matched before Save. Kept in the branch's settings data, `metaAds` — {accounts:[{id, name, adAccountId,
   connectedBy, connectedAt}], pages:[{id, accountId, name}], forms:[{id, pageId, name, leads, object,
   questions:[{id, label, type}], mapping:{questionId:propertyKey}}]}. The sample CRM gets three
   accounts, five pages and four forms once. Nothing reaches Meta: there's no backend. */

// Meta's mark (the blue loop), for the platform: the Connect Account menu and the Accounts table.
const MetaLogo = ({size = 16}) => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{display:'block', flexShrink:0}}>
  <path d="M3 12c0-3.2 1.9-5.2 4.3-5.2 3.6 0 5.8 10.4 9.4 10.4 2.4 0 4.3-2 4.3-5.2s-1.9-5.2-4.3-5.2c-3.6 0-5.8 10.4-9.4 10.4C4.9 17.2 3 15.2 3 12Z" fill="none" stroke="#0866FF" strokeWidth={2.4} strokeLinejoin="round"/></svg>;
const AD_PLATFORMS = [{id:'meta', label:'Meta', Logo:MetaLogo}, {id:'google', label:'Google Ads', Logo:() => <Icon name="googleLogo" size={15} color={T.gray400}/>, soon:true}];
/* + Connect Account: the ad platforms to connect — Meta; Google Ads not available yet. */
function ConnectAccountButton({onPick}){
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{position:'relative'}}>
      <NewButton label="Connect Account" onClick={()=>setOpen(o => !o)}/>
      <MenuShell open={open} onClose={()=>setOpen(false)} anchorRight width={200}>
        {AD_PLATFORMS.map(p => <MenuItem key={p.id} icon={<p.Logo/>} label={p.label} disabled={p.soon} onClick={()=>{ setOpen(false); onPick(p.id); }}/>)}
      </MenuShell>
    </div>
  );
}
const META_QUESTION_TYPES = {text:'Single-Line Text', email:'Email', phone:'Phone Number', choice:'Single Selection'};
const META_QUESTION_LABEL = {text:'Short answer', email:'Email', phone:'Phone number', choice:'Multiple choice'};
const metaAdsOf = (data) => (data && data.metaAds) || {accounts:[], pages:[], forms:[]};
// The properties of `object` a question's answer can go into.
const metaMatchable = (data, q, object = 'contacts') => {
  // A short answer can go into any property that holds a typed value; an email, phone or choice
  // into its own type or a text one.
  const NOT_TEXT = ['File Upload', 'Location', 'Date Range', 'Custom Range', 'Boolean', 'User', 'Date', 'Timestamp', 'Number', 'Currency', 'Percentage'];
  const TEXT = ['Single-Line Text', 'Multi-Line Text', 'Avatar'];
  return objectFormProperties(data, object).filter(p => !p.auto && !p.archived && p.key !== 'owner').filter(p => { const t = propertyTypeId(p.type);
    if(q.type === 'email') return t === 'Email' || TEXT.includes(t);
    if(q.type === 'phone') return t === 'Phone Number' || TEXT.includes(t);
    if(q.type === 'choice') return ['Single Selection', 'Multi-Selection', 'Country', 'Language'].includes(t) || TEXT.includes(t);
    return !NOT_TEXT.includes(t); });
};
const metaMatchedCount = (f) => (f.questions || []).filter(q => f.mapping && f.mapping[q.id]).length;
const metaFormReady = (f) => Object.values(f.mapping || {}).includes('name');

function withSampleMetaAds(d){
  if(d.metaAds) return d;
  const at = (days) => new Date(Date.now() - days * 86400000).toISOString();
  const q = (id, label, type) => ({id, label, type});
  const base = [q('full_name', 'Full name', 'text'), q('email', 'Email', 'email'), q('phone_number', 'Phone number', 'phone')];
  return {...d, metaAds:{
    accounts:[
      {id:'ma-1', name:'HOF Migration', adAccountId:'act_284019553317', connectedBy:'Waleed bin Zaman', connectedAt:at(48)},
      {id:'ma-2', name:'HOF Canada Desk', adAccountId:'act_517702198844', connectedBy:'Waleed bin Zaman', connectedAt:at(31)},
      {id:'ma-3', name:'HOF Global', adAccountId:'act_903156620471', connectedBy:'Ali Noor', connectedAt:at(12)}],
    pages:[
      {id:'mp-1', accountId:'ma-1', name:'HOF Migration'},
      {id:'mp-2', accountId:'ma-1', name:'HOF Migration UAE'},
      {id:'mp-3', accountId:'ma-2', name:'Study & Settle in Canada'},
      {id:'mp-4', accountId:'ma-3', name:'HOF Global'},
      {id:'mp-5', accountId:'ma-3', name:'US NIW Pathways'}],
    forms:[
      {id:'mf-1', pageId:'mp-1', name:'Free Eligibility Check', leads:412, questions:[...base, q('country', 'Country of residence', 'text'), q('programme', 'Which programme interests you?', 'choice')],
        mapping:{full_name:'name', email:'email', phone_number:'phone', country:'country'}},
      {id:'mf-2', pageId:'mp-2', name:'UAE Golden Visa Enquiry', leads:96, questions:[...base, q('city', 'City', 'text')], mapping:{full_name:'name', email:'email', phone_number:'phone', city:'city'}},
      {id:'mf-3', pageId:'mp-3', name:'Canada PR Assessment', leads:238, questions:[...base, q('job_title', 'Current job title', 'text'), q('ielts', 'Have you taken IELTS?', 'choice')], mapping:{}},
      {id:'mf-4', pageId:'mp-5', name:'NIW Profile Review', leads:57, object:'deals', questions:[...base, q('job_title', 'Field of work', 'text')], mapping:{full_name:'name', email:'email'}}]}};
}

function MetaConnectModal({onCancel, onConnect}){
  const [name, setName] = React.useState(''), [id, setId] = React.useState('');
  const ok = !!name.trim() && /^act_\d{6,}$/.test(id.trim());
  return <StModal title="Connect Meta Account" primary="Connect" canSubmit={ok} onCancel={onCancel} onSubmit={()=>ok && onConnect(name.trim(), id.trim())}>
    <div style={{display:'flex', flexDirection:'column', gap:12}}>
      <div><label style={fieldLabel}>Account Name<Req/></label><input autoFocus value={name} onChange={e=>setName(e.target.value)} style={fieldInput}/></div>
      <div><label style={fieldLabel}>Ad Account ID<Req/></label><input value={id} onChange={e=>setId(e.target.value)} placeholder="act_" style={fieldInput}/>
        {id.trim() && !/^act_\d{6,}$/.test(id.trim()) && <div style={{fontSize:12, color:T.red, marginTop:4}}>An Ad Account ID starts with act_ and its number.</div>}</div>
    </div>
  </StModal>;
}

/* Match Properties: each question of the form beside the Lead property it fills in. */
function MetaMatchPanel({form, data, onClose, onSave}){
  const [object, setObject] = React.useState(form.object || 'contacts');
  const [mapping, setMapping] = React.useState(() => ({...(form.mapping || {})}));
  // Another record type: the questions keep only matches its properties have.
  const pickObject = (o) => { setObject(o); setMapping(m => Object.fromEntries(Object.entries(m).filter(([qid, key]) => { const q = form.questions.find(x => x.id === qid); return q && metaMatchable(data, q, o).some(p => p.key === key); }))); };
  const used = (key, qid) => Object.entries(mapping).some(([k, v]) => v === key && k !== qid);
  const ready = Object.values(mapping).includes('name');
  const dirty = object !== (form.object || 'contacts') || JSON.stringify(mapping) !== JSON.stringify(form.mapping || {});
  return (
    <PageSidePanel width={640} title={form.name} onClose={onClose}>
      <div style={{flex:1, minHeight:0, overflowY:'auto', padding:'8px 20px 20px'}}>
        {/* Creates: the record type, as a Marketing form's (forms.jsx). */}
        <div style={{display:'flex', alignItems:'center', gap:12, padding:'6px 0 14px'}}>
          <span style={{fontSize:12.5, color:T.gray600}}>Creates<Req/></span>
          <div role="radiogroup" aria-label="Record type" style={{display:'inline-flex', border:`1px solid ${T.borderStrong}`, borderRadius:8, overflow:'hidden'}}>
            {hubObjects().map(o => <button key={o} type="button" role="radio" aria-checked={object === o} onClick={()=>pickObject(o)}
              style={{border:'none', cursor:'pointer', padding:'5px 12px', fontSize:12.5, fontWeight:500, fontFamily:'inherit', background: object === o ? T.black : 'transparent', color: object === o ? '#fff' : T.gray600}}>{HUB_NOUN[o]}</button>)}
          </div>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'minmax(0, 1fr) 260px', gap:12, padding:'8px 0', fontSize:12.5, fontWeight:500, color:T.gray600, borderBottom:`1px solid ${T.attioLine}`}}>
          <span>Form Question</span><span>{HUB_NOUN[object]} Property</span>
        </div>
        {form.questions.map(q => (
          <div key={q.id} style={{display:'grid', gridTemplateColumns:'minmax(0, 1fr) 260px', gap:12, alignItems:'center', padding:'10px 0', borderBottom:`1px solid ${T.attioLine}`}}>
            <div style={{minWidth:0}}>
              <div style={{fontSize:13, color:T.attioText, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{q.label}</div>
              <div style={{fontSize:12, color:T.attioMuted}}>{META_QUESTION_LABEL[q.type] || 'Short answer'}</div>
            </div>
            <FormSelect value={mapping[q.id] || 'skip'} options={[{value:'skip', label:"Don't Match"}, ...metaMatchable(data, q, object).map(p => ({value:p.key, label:p.label, disabled:used(p.key, q.id)}))]}
              onChange={(v)=>setMapping(m => { const n = {...m}; if(v && v !== 'skip') n[q.id] = v; else delete n[q.id]; return n; })}/>
          </div>
        ))}
      </div>
      <div style={{display:'flex', justifyContent:'flex-end', gap:8, padding:'12px 20px', borderTop:`1px solid ${T.border}`, flexShrink:0}}>
        <StSecondary label="Cancel" onClick={onClose}/>
        <StCta label="Save" disabled={!ready || !dirty} onClick={()=>onSave(mapping, object)}/>
      </div>
    </PageSidePanel>
  );
}

const ADS_TABS = [{id:'accounts', label:'Accounts', icon:'user'}, {id:'pages', label:'Pages', icon:'files'}, {id:'forms', label:'Forms', icon:'forms'}];
function AdsSettings({data, setData}){
  const hub = useRecordHub();
  React.useEffect(() => { if(ACTIVE_CRM.sample && !data.metaAds) setData(withSampleMetaAds); }, []);
  const ads = metaAdsOf(data);
  const [tab, setTab] = React.useState('accounts');
  const [scope, setScope] = React.useState(null);   // {accountId} on Pages, {pageId} on Forms
  const [connecting, setConnecting] = React.useState(false), [disconnecting, setDisconnecting] = React.useState(null), [matching, setMatching] = React.useState(null);
  const setAds = (fn) => setData(d => ({...d, metaAds:fn(metaAdsOf(d))}));
  const accountOf = (id) => ads.accounts.find(a => a.id === id), pageOf = (id) => ads.pages.find(p => p.id === id);
  const pagesOf = (accountId) => ads.pages.filter(p => p.accountId === accountId), formsOfPage = (pageId) => ads.forms.filter(f => f.pageId === pageId);
  const formsOfAccount = (accountId) => ads.forms.filter(f => (pageOf(f.pageId) || {}).accountId === accountId);
  const go = (t, s) => { setTab(t); setScope(s || null); };
  const link = (label, onClick) => <ContactName name={label} onOpen={onClick} style={{fontSize:'inherit', fontWeight:500}}/>;
  const say = (m) => hub && hub.toast(m);
  let schema, rows, columns, storeKey, actions = null;
  if(tab === 'accounts'){
    columns = [{key:'name', label:'Account Name', width:220}, {key:'platform', label:'Platform', width:130}, {key:'adAccountId', label:'Ad Account ID', width:190}, {key:'pages', label:'Pages', width:100}, {key:'forms', label:'Forms', width:100},
      {key:'connectedBy', label:'Connected By', width:180}, {key:'connectedOn', label:'Connected On', width:150}];
    rows = ads.accounts.map(a => ({id:a.id, name:a.name, platform:'Meta', adAccountId:a.adAccountId, pages:pagesOf(a.id).length, forms:formsOfAccount(a.id).length, connectedBy:a.connectedBy, connectedOn:fmtActDate(new Date(a.connectedAt))}));
    schema = {properties:columns, noun:'account', searchKeys:['name', 'adAccountId'], selectable:false, boards:false, canCreateProperty:false,
      renderCell:(key, r) => key === 'name' ? link(r.name, ()=>go('pages', {accountId:r.id})) : key === 'platform' ? <span style={{display:'inline-flex', alignItems:'center', gap:8}}><MetaLogo size={15}/>Meta</span> : undefined,
      renderActions:(r) => <RowActionsMenu title="Account Actions" width={MENU_W} items={[{label:'View Pages', onClick:()=>go('pages', {accountId:r.id})}, {label:'Disconnect Account', danger:true, onClick:()=>setDisconnecting(accountOf(r.id))}]}/>};
    storeKey = 'views:ads-accounts-v2';   // v2: with the Platform column
  } else if(tab === 'pages'){
    columns = [{key:'name', label:'Page Name', width:260}, {key:'account', label:'Account', width:220}, {key:'forms', label:'Forms', width:100}];
    rows = ads.pages.filter(p => !scope || !scope.accountId || p.accountId === scope.accountId).map(p => ({id:p.id, name:p.name, account:(accountOf(p.accountId) || {}).name || '', forms:formsOfPage(p.id).length}));
    schema = {properties:columns, noun:'page', searchKeys:['name', 'account'], selectable:false, boards:false, canCreateProperty:false,
      renderCell:(key, r) => key === 'name' ? link(r.name, ()=>go('forms', {pageId:r.id})) : undefined,
      renderActions:(r) => <RowActionsMenu title="Page Actions" width={MENU_W} items={[{label:'View Forms', onClick:()=>go('forms', {pageId:r.id})}]}/>};
    storeKey = 'views:ads-pages';
  } else {
    columns = [{key:'name', label:'Form Name', width:240}, {key:'page', label:'Page', width:200}, {key:'account', label:'Account', width:180}, {key:'creates', label:'Creates', width:110}, {key:'questions', label:'Questions', width:110},
      {key:'matched', label:'Matched', width:110}, {key:'status', label:'Status', width:150}, {key:'leads', label:'Leads', width:100}];
    rows = ads.forms.filter(f => !scope || !scope.pageId || f.pageId === scope.pageId).map(f => { const p = pageOf(f.pageId) || {};
      return {id:f.id, name:f.name, page:p.name || '', account:(accountOf(p.accountId) || {}).name || '', creates:HUB_NOUN[f.object || 'contacts'], questions:f.questions.length, matched:`${metaMatchedCount(f)} of ${f.questions.length}`,
        status: metaFormReady(f) ? 'Matched' : 'Needs Matching', leads:(f.leads || 0).toLocaleString('en-US')}; });
    schema = {properties:columns, noun:'form', searchKeys:['name', 'page', 'account'], selectable:false, boards:false, canCreateProperty:false,
      renderCell:(key, r) => key === 'name' ? link(r.name, ()=>setMatching(r.id))
        : key === 'status' ? <StatusPill status={r.status === 'Matched' ? 'matched' : 'needs'} map={{matched:{label:'Matched', tone:'success'}, needs:{label:'Needs Matching', tone:'warn'}}}/> : undefined,
      renderActions:(r) => <RowActionsMenu title="Form Actions" width={MENU_W} items={[{label:'Match Properties', onClick:()=>setMatching(r.id)}]}/>};
    storeKey = 'views:ads-forms';
  }
  const scopeLabel = scope && (scope.accountId ? `Account: ${(accountOf(scope.accountId) || {}).name || ''}` : scope.pageId ? `Page: ${(pageOf(scope.pageId) || {}).name || ''}` : null);
  const matchForm = matching && ads.forms.find(f => f.id === matching);
  return (
    <SettingsPage fill>
      {/* One row: the tabs, and Connect Account at its right. */}
      <div style={{display:'flex', alignItems:'flex-end', gap:8, borderBottom:`1px solid ${T.borderStrong}`, flexShrink:0, marginBottom: scopeLabel ? 12 : 4}}>
        {ADS_TABS.map(t => <UtTab key={t.id} icon={t.icon} label={t.label} active={tab === t.id} onClick={()=>go(t.id)}/>)}
        <div style={{flex:1}}/>
        <div style={{paddingBottom:8}}><ConnectAccountButton onPick={()=>setConnecting(true)}/></div>
      </div>
      {scopeLabel && <div style={{display:'flex', marginBottom:4}}>
        <span style={{display:'inline-flex', alignItems:'center', gap:6, height:28, padding:'0 6px 0 10px', borderRadius:8, background:T.headerBg, border:`1px solid ${T.attioLine}`, fontSize:12.5, color:T.attioText}}>
          {scopeLabel}<button type="button" title="Clear" aria-label="Clear" onClick={()=>setScope(null)} style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:2}}><Icon name="close" size={10} color={T.gray600}/></button>
        </span></div>}
      {tab === 'accounts' && !ads.accounts.length
        ? <EmptyState title="No accounts connected"/>
        : <div style={{flex:1, minHeight:0, display:'flex', flexDirection:'column'}}>
            <RecordViewsModule key={`${tab}:${scope ? JSON.stringify(scope) : ''}`} schema={schema} rows={rows} columns={columns.map(c => c.key)} storeKey={storeKey} savedViews={false} saveView={false} searchOnly
              defaultViews={[{id:`${storeKey}-all`, name:`All ${tab.charAt(0).toUpperCase() + tab.slice(1)}`}]} actions={actions}/>
          </div>}
      {connecting && <MetaConnectModal onCancel={()=>setConnecting(false)} onConnect={(name, adAccountId)=>{
        setAds(a => ({...a, accounts:[...a.accounts, {id:`ma-${Date.now().toString(36)}`, name, adAccountId, connectedBy:CURRENT_USER.name, connectedAt:new Date().toISOString()}]}));
        setConnecting(false); say(`${name} connected`); }}/>}
      {disconnecting && <StModal title="Disconnect Account" primary="Disconnect" danger onCancel={()=>setDisconnecting(null)} onSubmit={()=>{ const id = disconnecting.id;
          setAds(a => { const pageIds = a.pages.filter(p => p.accountId === id).map(p => p.id);
            return {accounts:a.accounts.filter(x => x.id !== id), pages:a.pages.filter(p => p.accountId !== id), forms:a.forms.filter(f => !pageIds.includes(f.pageId))}; });
          setDisconnecting(null); say(`${disconnecting.name} disconnected`); }}>
        <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>{disconnecting.name}, its pages and forms leave the CRM. Leads already created stay.</div>
      </StModal>}
      {matchForm && <MetaMatchPanel key={matchForm.id} form={matchForm} data={data} onClose={()=>setMatching(null)}
        onSave={(mapping, object)=>{ setAds(a => ({...a, forms:a.forms.map(f => f.id === matchForm.id ? {...f, mapping, object} : f)})); setMatching(null); say('Properties matched'); }}/>}
    </SettingsPage>
  );
}
SETTINGS_PAGES['settings.ads'] = AdsSettings;

Object.assign(window, {AdsSettings, metaAdsOf, withSampleMetaAds, metaMatchable});
