/* HOF Pulse ERP — Assessments in the Customer Profile, and the pieces Settings reuses.

   An assessment belongs to the person (the contact) and is reachable from their contact, deal and
   customer records. Each one keeps the template version it was calculated with, its answers,
   which answers were verified, its full result and when it was calculated — calculating again
   adds a new result and never rewrites an earlier one. Drafts can be saved and continued.

   Shared with Settings → Customer Profile (the template builder's Test tab):
     AssessmentForm   — a version's questions, follow-ups shown only when they apply.
     AssessmentResult — the total and how it was reached: every rule, its points or why none,
                        section caps, missing answers, problems, unverified answers.
   The answers are the assessment's own: a Contact property changes only through an input that
   is explicitly configured to copy its answer there (`writeBack`). */

/* ── Store ── App provides the templates and every contact's assessments. ─────────────────── */
const AssessmentCtx = React.createContext(null);
const useAssessments = () => React.useContext(AssessmentCtx);
// The templates in use (App keeps this current, so the call flow and workflows read the same list).
let ASSESSMENT_TEMPLATES_LIVE = [];
const setAssessmentTemplatesLive = (list) => { ASSESSMENT_TEMPLATES_LIVE = list || []; };

const assessmentRecord = (patch) => ({id:aUid('asm'), status:'draft', answers:{}, verified:{}, prefilled:{}, createdAt:new Date().toISOString(), ...patch});
// The newest calculated assessment of each template for a person (workflows, the profile summary).
const latestCalculated = (list, templateId) => (list || []).filter(a => a.templateId === templateId && a.status === 'calculated')
  .sort((a, b) => String(b.calculatedAt).localeCompare(String(a.calculatedAt)))[0] || null;

/* ── Small pieces ──────────────────────────────────────────────────────────────────────────── */
const asmLabel = {fontSize:12.5, color:T.gray600, marginBottom:6, display:'block'};
const asmInput = {width:'100%', boxSizing:'border-box', border:`1px solid ${T.borderStrong}`, borderRadius:8, padding:'8px 10px', fontSize:13, fontFamily:'inherit', color:T.attioText, background:'#fff'};
const ASM_STATUS = {
  awarded:       {label:null},
  none:          {label:'No points', tone:'muted'},
  notApplicable: {label:'Not applicable', tone:'muted'},
  missing:       {label:'Missing', tone:'warn'},
  unverified:    {label:'Not verified', tone:'warn'},
  invalid:       {label:'Problem', tone:'danger'},
  excluded:      {label:'Excluded', tone:'muted'},
};
const asmTone = {muted:{fg:T.attioMuted, bg:T.headerBg}, warn:{fg:'#8A4B08', bg:'#FFF6E5'}, danger:{fg:T.red, bg:'#FDECEC'}, ok:{fg:'#0B7A55', bg:'#E8F7F1'}};
function AsmChip({tone = 'muted', children, title}){
  const t = asmTone[tone] || asmTone.muted;
  return <span title={title} style={{fontSize:11, fontWeight:600, color:t.fg, background:t.bg, borderRadius:9999, padding:'2px 8px', whiteSpace:'nowrap', flexShrink:0}}>{children}</span>;
}

// Yes / No as two choices — an assessment question can also be unanswered, which a toggle can't show.
function YesNo({value, onChange, invalid}){
  const opt = (v, label) => (
    <button type="button" role="radio" aria-checked={value === v} onClick={()=>onChange(value === v ? '' : v)} style={{flex:1, height:34, border:'none', cursor:'pointer', fontFamily:'inherit',
      fontSize:13, fontWeight:500, background: value === v ? T.black : '#fff', color: value === v ? '#fff' : T.attioText}}>{label}</button>
  );
  return (
    <div role="radiogroup" style={{display:'flex', width:180, border:`1px solid ${invalid ? T.red : T.borderStrong}`, borderRadius:8, overflow:'hidden'}}>
      {opt(true, 'Yes')}<span style={{width:1, background:T.borderStrong}}/>{opt(false, 'No')}
    </div>
  );
}

function AssessmentInput({input, value, onChange, invalid}){
  const box = {...asmInput, ...(invalid ? {borderColor:T.red} : {})};
  switch(input.type){
    case 'number': return (
      <div style={{display:'flex', alignItems:'center', gap:8, maxWidth:240}}>
        <input type="number" aria-label={input.label} value={value ?? ''} min={input.min} max={input.max} step={input.increment || 'any'} onChange={e=>onChange(e.target.value === '' ? '' : Number(e.target.value))} style={box}/>
        {input.unit && <span style={{fontSize:12.5, color:T.attioMuted, flexShrink:0}}>{input.unit}</span>}
      </div>
    );
    case 'date': return <div style={{maxWidth:240}}><DateField value={value || ''} onChange={onChange} inputStyle={box} ariaLabel={input.label}/></div>;
    case 'select': return <FormSelect value={value ?? ''} placeholder="Select" options={(input.options || []).map(o => ({value:o.value, label:o.label}))} onChange={(v)=>onChange(v === '' ? '' : (input.options || []).find(o => String(o.value) === v)?.value ?? v)} invalid={invalid}/>;
    case 'multi': return <MultiSelectMenu value={value || []} options={input.options || []} onChange={onChange} invalid={invalid}/>;
    case 'boolean': return <YesNo value={value} onChange={onChange} invalid={invalid}/>;
    case 'scores': {
      const v = value || {};
      return (
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(110px, 1fr))', gap:8}}>
          {(input.parts || []).map(p => (
            <label key={p.key} style={{display:'flex', flexDirection:'column', gap:4, fontSize:11.5, color:T.attioMuted}}>
              {p.label}
              <input type="number" value={v[p.key] ?? ''} step={input.increment || 'any'} aria-label={`${input.label} — ${p.label}`}
                onChange={e=>onChange({...v, [p.key]: e.target.value === '' ? '' : Number(e.target.value)})} style={box}/>
            </label>
          ))}
        </div>
      );
    }
    default: return <input aria-label={input.label} value={value ?? ''} onChange={e=>onChange(e.target.value)} style={box}/>;
  }
}

/* A version's questions, grouped as the template groups them. Only questions that apply are
   shown (follow-ups appear as earlier answers make them relevant). `showErrors`: show problems
   and missing required answers inline. `prefilled`: answers taken from the person's facts. */
function AssessmentForm({version, answers, onAnswer, verified = {}, onVerify, showErrors, prefilled = {}, readOnly}){
  const visible = visibleInputs(version, answers);
  const groups = [...(version.groups || []), {id:'__other', label:'Other questions'}];
  return (
    <div style={{display:'flex', flexDirection:'column', gap:24}}>
      {groups.map(g => {
        const list = visible.filter(i => (i.group || '__other') === g.id || (g.id === '__other' && !(version.groups || []).some(x => x.id === i.group)));
        if(!list.length) return null;
        return (
          <section key={g.id} style={{display:'flex', flexDirection:'column', gap:16}}>
            <div style={{fontSize:13, fontWeight:600, color:T.attioText, paddingBottom:6, borderBottom:`1px solid ${T.attioLine}`}}>{g.label}</div>
            {list.map(i => {
              const v = answers[i.key];
              const err = showErrors && (inputError(i, v) || (i.required && !inputFilled(i, v) ? 'Required' : null));
              return (
                <div key={i.key} style={{minWidth:0}}>
                  <div style={{display:'flex', alignItems:'flex-start', gap:8, marginBottom:6}}>
                    <span style={{flex:1, minWidth:0, fontSize:12.5, color:T.gray600, lineHeight:1.4}}>{i.label}{i.required && <span style={{color:T.red}}> *</span>}</span>
                    {prefilled[i.key] && <AsmChip title="Taken from what's already known about this person (e.g. a call). Check it.">From profile</AsmChip>}
                  </div>
                  {readOnly ? <div style={{fontSize:13, color:T.attioText}}>{formatAnswer(i, v)}</div>
                    : <AssessmentInput input={i} value={v} onChange={(x)=>onAnswer(i.key, x)} invalid={!!err}/>}
                  {i.help && <div style={{fontSize:12, color:T.attioMuted, marginTop:5, lineHeight:1.4}}>{i.help}</div>}
                  {i.needsVerification && !aIsBlank(v) && (
                    <label style={{display:'inline-flex', alignItems:'center', gap:8, marginTop:8, fontSize:12.5, color:T.attioText, cursor: readOnly ? 'default' : 'pointer'}}>
                      <RowCheckbox checked={!!verified[i.key]} onChange={()=>!readOnly && onVerify && onVerify(i.key, !verified[i.key])}/>
                      Verified{!verified[i.key] && <span style={{color:'#8A4B08'}}> — scores only once verified</span>}
                    </label>
                  )}
                  {err && <div style={{fontSize:12, color:T.red, marginTop:4}}>{err}</div>}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
function formatAnswer(input, v){
  if(aIsBlank(v) || (input.type === 'scores' && !Object.values(v || {}).some(x => !aIsBlank(x)))) return '—';
  switch(input.type){
    case 'select': return ((input.options || []).find(o => o.value === v) || {}).label || String(v);
    case 'multi': return (v || []).map(x => ((input.options || []).find(o => o.value === x) || {}).label || x).join(', ');
    case 'boolean': return v ? 'Yes' : 'No';
    case 'date': return aFmtYmd(v);
    case 'number': return `${v}${input.unit ? ` ${input.unit}` : ''}`;
    case 'scores': return (input.parts || []).map(p => `${p.label} ${v[p.key] ?? '—'}`).join(' · ');
    default: return String(v);
  }
}

/* ── Result ────────────────────────────────────────────────────────────────────────────────── */
function ResultRuleRow({line, depth}){
  const st = ASM_STATUS[line.status] || {};
  const why = line.notBest ? line.reasonBest : line.reason;
  return (
    <div style={{display:'flex', alignItems:'flex-start', gap:10, padding:'6px 0', paddingLeft:depth * 14, borderTop:`1px solid ${T.attioLine}`}}>
      <div style={{flex:1, minWidth:0}}>
        <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
          <span style={{fontSize:12.5, color: line.status === 'awarded' && !line.notBest ? T.attioText : T.attioMuted}}>{line.label}</span>
          {st.label && <AsmChip tone={st.tone}>{st.label}</AsmChip>}
          {line.notBest && <AsmChip>Not counted</AsmChip>}
          {line.capped && <AsmChip tone="warn">Rule maximum applied</AsmChip>}
        </div>
        {line.detail && <div style={{fontSize:11.5, color:T.attioMuted, marginTop:2, lineHeight:1.4}}>{line.detail}</div>}
        {why && <div style={{fontSize:11.5, color: line.status === 'missing' || line.status === 'unverified' ? '#8A4B08' : line.status === 'invalid' ? T.red : T.attioMuted, marginTop:2, lineHeight:1.4}}>{why}</div>}
      </div>
      <span style={{fontSize:12.5, fontWeight:600, fontVariantNumeric:'tabular-nums', color: line.points && !line.notBest ? T.attioText : T.attioMuted}}>
        {line.status === 'excluded' ? <s>{line.excludedPoints}</s> : line.points}
      </span>
    </div>
  );
}
function ResultSectionRow({s, depth = 0, showAll}){
  const [open, setOpen] = React.useState(depth > 0);
  if(s.status === 'notApplicable' && !showAll) return null;
  const items = (s.items || []).filter(x => showAll || x.status !== 'notApplicable');
  return (
    <div style={{borderTop: depth ? `1px solid ${T.attioLine}` : 'none'}}>
      <div onClick={()=>setOpen(o => !o)} style={{display:'flex', alignItems:'center', gap:8, padding: depth ? '7px 0' : '10px 0', paddingLeft:depth * 14, cursor:'pointer'}}>
        <Icon name="chevDown" size={12} color={T.attioMuted} style={{transform: open ? 'none' : 'rotate(-90deg)', flexShrink:0}}/>
        <span style={{flex:1, minWidth:0, fontSize: depth ? 12.5 : 13, fontWeight: depth ? 500 : 600, color: s.status === 'notApplicable' ? T.attioMuted : T.attioText}}>{s.label}</span>
        {s.status === 'notApplicable' && <AsmChip>Not applicable</AsmChip>}
        {s.capped && <AsmChip tone="warn" title={`Raw total ${s.raw}`}>Capped at {aFmtPoints(s.cap)}</AsmChip>}
        {s.combine === 'best' && s.status !== 'notApplicable' && <AsmChip title="Only the highest item counts">Highest counts</AsmChip>}
        <span style={{fontSize:13, fontWeight:600, color:T.attioText, fontVariantNumeric:'tabular-nums'}}>
          {aFmtPoints(s.points)}{s.cap != null && <span style={{color:T.attioMuted, fontWeight:500}}> / {aFmtPoints(s.cap)}</span>}
        </span>
      </div>
      {open && (
        <div style={{paddingBottom: depth ? 0 : 6}}>
          {s.status === 'notApplicable' && <div style={{fontSize:11.5, color:T.attioMuted, padding:'0 0 6px', paddingLeft:(depth + 1) * 14}}>{s.reason}</div>}
          {items.map((x, i) => x.kind === 'section' ? <ResultSectionRow key={x.id || i} s={x} depth={depth + 1} showAll={showAll}/> : <ResultRuleRow key={x.id || i} line={x} depth={depth + 1}/>)}
        </div>
      )}
    </div>
  );
}
/* The total, then what needs attention (missing, problems, unverified), then the scoring
   sections with every rule's points — or why it gave none. */
function AssessmentResult({version, result, meta, compact}){
  const [showAll, setShowAll] = React.useState(false);
  // An earlier profile's result carries its own maximum (its version's rules aren't kept).
  const max = (version.sections || []).length ? versionMaxPoints(version) : result.max;
  const attention = [
    ...result.errors.map(e => ({tone:'danger', text:`${e.label}: ${e.message}`})),
    ...result.missing.map(m => ({tone:'warn', text:`${m.label} — missing`})),
    ...result.unverified.map(u => ({tone:'warn', text:`${u.label} — not verified, so it scores nothing yet`})),
  ];
  return (
    <div style={{display:'flex', flexDirection:'column', gap: compact ? 12 : 18}}>
      <div style={{display:'flex', alignItems:'flex-end', gap:16, flexWrap:'wrap'}}>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:12, color:T.attioMuted}}>{version.scoreLabel || 'Score'}</div>
          <div style={{display:'flex', alignItems:'baseline', gap:6, marginTop:2}}>
            <span style={{fontSize: compact ? 28 : 34, fontWeight:700, color:T.attioText, letterSpacing:-.5, lineHeight:1, fontVariantNumeric:'tabular-nums'}}>{aFmtPoints(result.total)}</span>
            {max != null && <span style={{fontSize:15, color:T.attioMuted, fontWeight:500}}>/ {aFmtPoints(max)}</span>}
          </div>
          {result.capped && <div style={{fontSize:12, color:'#8A4B08', marginTop:4}}>Capped at the overall maximum (raw {aFmtPoints(result.raw)}).</div>}
        </div>
        {result.threshold != null && (
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:12, color:T.attioMuted}}>Required</div>
            <div style={{display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end', marginTop:2}}>
              <span style={{fontSize:15, fontWeight:600, color:T.attioText}}>{aFmtPoints(result.threshold)}</span>
              <AsmChip tone={result.passesThreshold ? 'ok' : 'danger'}>{result.passesThreshold ? 'Met' : 'Not met'}</AsmChip>
            </div>
          </div>
        )}
      </div>
      {version.thresholdNote && <div style={{fontSize:12, color:T.attioMuted, marginTop:-8}}>{version.thresholdNote}</div>}
      {result.gates.length > 0 && (
        <div style={{display:'flex', flexDirection:'column', gap:4}}>
          {result.gates.map(g => <div key={g.id || g.label} style={{fontSize:12.5, display:'flex', gap:6, color:T.attioText}}>
            <span style={{fontWeight:700, color: g.met ? '#0B7A55' : T.red}}>{g.met ? '✓' : '✗'}</span>{g.label}</div>)}
        </div>
      )}
      {attention.length > 0 && (
        <div style={{border:`1px solid #F5D9A8`, background:'#FFFBF2', borderRadius:8, padding:'10px 12px', display:'flex', flexDirection:'column', gap:4}}>
          <div style={{fontSize:12.5, fontWeight:600, color:'#8A4B08'}}>Needs attention</div>
          {attention.map((a, i) => <div key={i} style={{fontSize:12, color: a.tone === 'danger' ? T.red : T.attioText}}>• {a.text}</div>)}
        </div>
      )}
      <div>
        <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:2}}>
          <span style={{flex:1, fontSize:13, fontWeight:600, color:T.attioText}}>Breakdown</span>
          <button type="button" onClick={()=>setShowAll(x => !x)} style={{border:'none', background:'transparent', padding:0, cursor:'pointer', fontSize:12, color:T.attioBlue, fontFamily:'inherit'}}>
            {showAll ? 'Hide rules that don’t apply' : 'Show rules that don’t apply'}
          </button>
        </div>
        {result.sections.map(s => <ResultSectionRow key={s.id} s={s} showAll={showAll}/>)}
      </div>
      {meta && <div style={{fontSize:12, color:T.attioMuted}}>{meta}</div>}
    </div>
  );
}
const assessmentMeta = (template, version, at) => [template && template.name, version && `version ${version.label}`, at && `calculated ${aFmtYmd(at)}`].filter(Boolean).join(' · ');

/* ── Editor: complete an assessment (side panel) ───────────────────────────────────────────── */
/* `record`: a draft being continued, or a calculated one being recalculated (its answers start a
   new assessment). Always on the version in effect today. onSave(record, {calculate}). */
function AssessmentEditor({template, contact, record, facts, onCancel, onSave}){
  const version = effectiveVersion(template);
  const startAnswers = () => {
    if(record) return {...record.answers};
    return answersFromFacts(version, facts || {});
  };
  const [answers, setAnswers] = React.useState(startAnswers);
  const [verified, setVerified] = React.useState(() => ({...((record && record.verified) || {})}));
  const [prefilled] = React.useState(() => record ? (record.prefilled || {}) : Object.fromEntries(Object.keys(answersFromFacts(version, facts || {})).map(k => [k, true])));
  const [tried, setTried] = React.useState(false);
  const result = React.useMemo(() => evaluateAssessment(version, answers, {verified}), [version, answers, verified]);
  const set = (k, v) => setAnswers(a => ({...a, [k]:v}));
  const save = (calculate) => {
    if(calculate){ setTried(true); if(!result.complete) return; }
    // Hidden follow-ups' answers aren't kept (they no longer apply).
    const shown = new Set(visibleInputs(version, answers).map(i => i.key));
    const kept = Object.fromEntries(Object.entries(answers).filter(([k, v]) => shown.has(k) && !aIsBlank(v)));
    const base = record && record.status === 'draft' ? record : assessmentRecord({templateId:template.id, source:'manual'});
    onSave({...base, templateId:template.id, templateName:template.name, versionId:version.id, versionLabel:version.label, answers:kept,
      verified:Object.fromEntries(Object.entries(verified).filter(([k, v]) => v && shown.has(k))), prefilled,
      updatedAt:new Date().toISOString(),
      ...(calculate ? {status:'calculated', result, calculatedAt:new Date().toISOString(), calculationDate:result.at} : {status:'draft', result:null})}, {calculate});
  };
  return (
    <CreatePanelFrame width={980} flush more={false} title={`${template.name} · ${contact.name}`} onClose={onCancel} actions={<>
      <span style={{flex:1, fontSize:12, color:T.attioMuted}}>Version {version.label} · in effect {version.effectiveFrom ? `since ${aFmtYmd(version.effectiveFrom)}` : ''}</span>
      <StSecondary label="Cancel" onClick={onCancel}/>
      <StSecondary label="Save draft" onClick={()=>save(false)}/>
      <StCta label={record && record.status === 'calculated' ? 'Recalculate' : 'Calculate'} onClick={()=>save(true)}/>
    </>}>
      <div style={{flex:1, minWidth:0, display:'flex'}}>
        <div style={{flex:'1 1 55%', minWidth:0, overflowY:'auto', padding:'20px 24px'}}>
          {tried && !result.complete && <div style={{fontSize:12.5, color:T.red, marginBottom:14}}>Answer the missing questions and fix the problems marked below to calculate. You can save a draft meanwhile.</div>}
          <AssessmentForm version={version} answers={answers} onAnswer={set} verified={verified} onVerify={(k, on)=>setVerified(v => ({...v, [k]:on}))} showErrors={tried} prefilled={prefilled}/>
        </div>
        <div style={{flex:'1 1 45%', minWidth:0, overflowY:'auto', padding:'20px 24px', borderLeft:`1px solid ${T.border}`, background:T.pageBg || '#FAFBFC'}}>
          <div style={{fontSize:11, fontWeight:600, color:T.attioFaint, textTransform:'uppercase', letterSpacing:.4, marginBottom:10}}>Live result</div>
          <AssessmentResult version={version} result={result} compact/>
        </div>
      </div>
    </CreatePanelFrame>
  );
}

/* ── Customer Profile → Assessments ────────────────────────────────────────────────────────── */
function NewAssessmentMenu({templates, onPick, onFromCall}){
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{position:'relative', display:'inline-block', textAlign:'left'}}>
      <button onClick={()=>setOpen(o => !o)} style={{height:32, boxSizing:'border-box', padding:'0 14px 0 16px', borderRadius:8, border:'none', background:T.black, color:'#fff',
        fontSize:13, fontWeight:600, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:8, fontFamily:'inherit'}}>
        New assessment <Icon name="chevDown" size={T.chevronSize} color="#fff" style={{transform: open ? 'rotate(180deg)' : 'none'}}/>
      </button>
      <MenuShell open={open} onClose={()=>setOpen(false)} width={280} anchorRight>
        {templates.map(t => <MenuItem key={t.id} label={t.name} onClick={()=>{ setOpen(false); onPick(t); }}/>)}
        {!templates.length && <div style={{padding:'8px 10px', fontSize:12.5, color:T.attioMuted}}>No templates are available. Enable one in Settings → Customer Profile.</div>}
        {onFromCall && <>
          <div style={{height:1, background:T.border, margin:'4px 2px'}}/>
          <MenuItem label="Fill from a call or notes…" onClick={()=>{ setOpen(false); onFromCall(); }}/>
        </>}
      </MenuShell>
    </div>
  );
}

function AssessmentHistoryRow({a, template, selected, onSelect}){
  const draft = a.status === 'draft';
  const max = a.result && (a.result.max ?? null);
  return (
    <button onClick={onSelect} style={{width:'100%', display:'flex', alignItems:'center', gap:10, padding:'9px 10px', border:'none', borderRadius:8, cursor:'pointer', textAlign:'left', fontFamily:'inherit',
      background: selected ? T.headerBg : 'transparent'}}>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize:13, fontWeight:500, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{(template && template.name) || a.templateName || a.templateId}</div>
        <div style={{fontSize:11.5, color:T.attioMuted, marginTop:1}}>
          {draft ? `Draft · saved ${aFmtYmd((a.updatedAt || a.createdAt || '').slice(0, 10))}` : `${aFmtYmd(a.calculationDate || (a.calculatedAt || '').slice(0, 10))} · v${a.versionLabel}`}
          {a.source === 'legacy' ? ' · earlier profile' : a.source === 'call' ? ' · from a call' : ''}
        </div>
      </div>
      {draft ? <AsmChip tone="warn">Draft</AsmChip>
        : <span style={{fontSize:14, fontWeight:700, color:T.attioText, fontVariantNumeric:'tabular-nums'}}>{aFmtPoints(a.result.total)}{max != null && <span style={{fontSize:11.5, fontWeight:500, color:T.attioMuted}}> / {aFmtPoints(max)}</span>}</span>}
    </button>
  );
}

/* The person's assessments: the newest first; the selected one's result and answers beside.
   `onFromCall`: the call / notes flow (fills answers from what was said). */
function AssessmentsPanel({contact, onFromCall}){
  const store = useAssessments();
  const [editing, setEditing] = React.useState(null);   // {template, record?}
  const [selectedId, setSelectedId] = React.useState(null);
  const [confirmDelete, setConfirmDelete] = React.useState(null);
  if(!store) return null;
  const list = [...((store.assessments || {})[contact.id] || [])].sort((a, b) => String(b.calculatedAt || b.updatedAt || b.createdAt).localeCompare(String(a.calculatedAt || a.updatedAt || a.createdAt)));
  const templates = store.templates || [];
  const usable = usableTemplates(templates);
  const tplOf = (id) => templates.find(t => t.id === id);
  const selected = list.find(a => a.id === selectedId) || list[0] || null;
  const facts = (store.facts || {})[contact.id] || {};
  const start = (t) => setEditing({template:t});
  const editor = editing && (
    <AssessmentEditor template={editing.template} contact={contact} record={editing.record} facts={facts} onCancel={()=>setEditing(null)}
      onSave={(rec, {calculate})=>{ store.save(contact.id, rec, {calculate}); setEditing(null); setSelectedId(rec.id); }}/>
  );
  if(!list.length) return (
    <>
      <EmptyState illustration="profile" title="No assessments yet" description="Assess this person with a template from Settings → Customer Profile."
        action={<NewAssessmentMenu templates={usable} onPick={start} onFromCall={onFromCall}/>}/>
      {editor}
    </>
  );
  const sel = selected, t = sel && tplOf(sel.templateId);
  const version = sel && (versionById(templates, sel.templateId, sel.versionId) || (sel.legacyVersion));
  const canRecalc = t && t.enabled && effectiveVersion(t);
  const newer = sel && sel.status === 'calculated' && canRecalc && effectiveVersion(t).id !== sel.versionId;
  return (
    <div style={{padding:'20px 24px 32px', display:'grid', gridTemplateColumns:'minmax(220px, 300px) minmax(0, 1fr)', gap:24, alignItems:'start'}}>
      <div style={{display:'flex', flexDirection:'column', gap:10, minWidth:0}}>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <span style={{flex:1, fontSize:13, fontWeight:600, color:T.attioText}}>Assessments</span>
          <NewAssessmentMenu templates={usable} onPick={start} onFromCall={onFromCall}/>
        </div>
        <div style={{display:'flex', flexDirection:'column', gap:2}}>
          {list.map(a => <AssessmentHistoryRow key={a.id} a={a} template={tplOf(a.templateId)} selected={sel && sel.id === a.id} onSelect={()=>setSelectedId(a.id)}/>)}
        </div>
      </div>
      {sel && (
        <div style={{minWidth:0, display:'flex', flexDirection:'column', gap:18}}>
          <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
            <span style={{flex:1, minWidth:0, fontSize:15, fontWeight:600, color:T.attioText}}>{(t && t.name) || sel.templateName}</span>
            {sel.status === 'draft' && canRecalc && <StCta label="Continue" onClick={()=>setEditing({template:t, record:sel})}/>}
            {sel.status === 'draft' && <StSecondary label="Delete draft" onClick={()=>setConfirmDelete(sel)}/>}
            {sel.status === 'calculated' && canRecalc && <StSecondary label="Recalculate" onClick={()=>setEditing({template:t, record:sel})}/>}
          </div>
          {newer && <div style={{fontSize:12.5, color:T.attioText, background:T.blueLight, borderRadius:8, padding:'8px 12px'}}>
            Version {effectiveVersion(t).label} is now in effect. Recalculating adds a new result on it; this one stays as it was.</div>}
          {sel.status === 'draft' ? (
            <div style={{fontSize:13, color:T.attioMuted}}>Not calculated yet. Continue to answer the remaining questions and calculate.</div>
          ) : version ? (
            <AssessmentResult version={version} result={sel.result} meta={assessmentMeta(t || {name:sel.templateName}, version, sel.calculationDate)}/>
          ) : <div style={{fontSize:13, color:T.attioMuted}}>Score {aFmtPoints(sel.result.total)} — the template version it used is no longer available.</div>}
          {version && (
            <div>
              <div style={{fontSize:13, fontWeight:600, color:T.attioText, marginBottom:8}}>Answers</div>
              {visibleInputs(version, sel.answers).filter(i => !aIsBlank(sel.answers[i.key])).map(i => (
                <div key={i.key} style={{display:'flex', gap:12, padding:'8px 0', borderTop:`1px solid ${T.attioLine}`, alignItems:'baseline'}}>
                  <span style={{width:'46%', flexShrink:0, fontSize:12.5, color:T.attioMuted, lineHeight:1.4}}>{i.label}</span>
                  <span style={{flex:1, minWidth:0, fontSize:13, color:T.attioText}}>{formatAnswer(i, sel.answers[i.key])}</span>
                  {i.needsVerification && <AsmChip tone={(sel.verified || {})[i.key] ? 'ok' : 'warn'}>{(sel.verified || {})[i.key] ? 'Verified' : 'Not verified'}</AsmChip>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {editor}
      {confirmDelete && <StModal title="Delete draft" primary="Delete" danger onCancel={()=>setConfirmDelete(null)} canSubmit
        onSubmit={()=>{ store.remove(contact.id, confirmDelete.id); setConfirmDelete(null); setSelectedId(null); }}>
        <div style={stTextB}>This draft of {(tplOf(confirmDelete.templateId) || {}).name || confirmDelete.templateName} will be deleted. Calculated results are kept.</div>
      </StModal>}
    </div>
  );
}

/* ── The call flow's templates: usable templates, as the call flow reads them ─────────────── */
// Facts confirmed together on one card after a call (the library's low-frequency yes/no factors).
const FACTOR_FACT_KEYS = () => [...new Set((typeof PROFILE_TEMPLATES !== 'undefined' ? PROFILE_TEMPLATES : []).flatMap(t => t.factorFields || []))];
function runnerTemplates(){
  const factors = FACTOR_FACT_KEYS();
  return usableTemplates(ASSESSMENT_TEMPLATES_LIVE).map(t => {
    const v = effectiveVersion(t), keys = versionFactKeys(v).filter(k => PROFILE_FIELDS[k]);
    return {id:t.id, name:t.name, createLabel:t.name, framework:t.description, version:v, scoreLabel:v.scoreLabel, max:versionMaxPoints(v),
      threshold:v.threshold ?? null, requiredLabel:'—', fields:keys.filter(k => !factors.includes(k)), factorFields:keys.filter(k => factors.includes(k))};
  }).filter(t => t.fields.length || t.factorFields.length);
}
// A call's confirmed answers → each chosen template's result.
const runnerResult = (t, answerValues) => {
  const facts = Object.fromEntries(Object.entries(answerValues).map(([k, v]) => [k, {value:v, status:'confirmed'}]));
  return evaluateAssessment(t.version, answersFromFacts(t.version, facts));
};

/* After a call: the confirmed facts are kept (as before) and each chosen template gets an
   assessment from them — calculated when nothing required is missing, otherwise a draft to finish. */
function recordAssessmentRun(setFacts, saveAssessment, facts, contactId, {answers, results, callId, origin}, call){
  const at = new Date();
  const merged = {...(facts[contactId] || {})};
  Object.entries(answers).forEach(([k, a]) => { merged[k] = {...a, callId, at, origin: a.origin || origin}; });
  setFacts(m => ({...m, [contactId]: merged}));
  results.forEach(({template, result}) => {
    const v = template.version;
    const ans = answersFromFacts(v, merged);
    const res = evaluateAssessment(v, ans);
    saveAssessment(contactId, assessmentRecord({templateId:template.id, templateName:template.name, versionId:v.id, versionLabel:v.label, source:'call', callId,
      answers:ans, prefilled:Object.fromEntries(Object.keys(ans).map(k => [k, true])), updatedAt:at.toISOString(),
      ...(res.complete ? {status:'calculated', result:res, calculatedAt:at.toISOString(), calculationDate:res.at} : {status:'draft', result:null})}), {calculate:res.complete});
  });
}

/* Customer Profile results saved before assessments → calculated assessments (history). Their
   breakdown is kept in the shape the result view reads. */
function legacyProfilesToAssessments(profiles, templates){
  const out = {};
  Object.entries(profiles || {}).forEach(([cid, byTemplate]) => {
    out[cid] = Object.values(byTemplate || {}).filter(p => p && p.result).map(p => {
      const t = (templates || []).find(x => x.id === p.templateId);
      const r = p.result;
      const sections = (r.groups || []).map(g => ({kind:'section', id:g.id, label:g.label, cap:g.cap ?? null, raw:g.raw, points:g.points, capped:!!g.capped, combine:'sum', status:'scored',
        items:(g.lines || []).map((l, i) => l.sub
          ? {kind:'section', id:`${g.id}-${i}`, label:l.label, cap:l.cap ?? null, raw:l.raw, points:l.points, capped:!!l.capped, status:'scored', combine:'sum',
             items:l.sub.map((x, j) => ({kind:'rule', id:`${g.id}-${i}-${j}`, label:x.label, points:x.points, status: x.points ? 'awarded' : 'none', detail:x.note}))}
          : {kind:'rule', id:`${g.id}-${i}`, label:l.label, points:l.points, status: l.missing ? 'none' : l.points ? 'awarded' : 'none', detail:l.note, reason: l.missing ? 'No value' : undefined})}));
      const savedAt = p.savedAt ? new Date(p.savedAt) : new Date();
      const legacyVersion = {id:`legacy-${p.templateId}-${p.version}`, label:p.version, scoreLabel:'Score', max:r.max ?? null, threshold:r.threshold ?? null, groups:[], inputs:[], calcs:[], sections:[]};
      return {id:`legacy-${cid}-${p.templateId}`, templateId:p.templateId, templateName:t ? t.name : p.templateId, versionId:legacyVersion.id, versionLabel:p.version, legacyVersion,
        status:'calculated', source:'legacy', answers:{}, verified:{}, createdAt:savedAt.toISOString(), calculatedAt:savedAt.toISOString(), calculationDate:aYmdOf(savedAt),
        result:{total:r.total, raw:r.total, max:r.max ?? null, capped:false, threshold:r.threshold ?? null, passesThreshold:r.passesThreshold ?? null,
                gates:r.gates || [], sections, errors:[], missing:[], unverified:[], complete:true}};
    });
  });
  return out;
}

Object.assign(window, {AssessmentCtx, useAssessments, setAssessmentTemplatesLive, assessmentRecord, latestCalculated, AssessmentForm, AssessmentInput, AssessmentResult,
  AssessmentEditor, AssessmentsPanel, NewAssessmentMenu, formatAnswer, assessmentMeta, runnerTemplates, runnerResult, recordAssessmentRun, legacyProfilesToAssessments, YesNo, AsmChip});
