/* HOF Pulse ERP — Customer Profile flow (prototype).

   Transcript → select template(s) → extraction → confirm each item → calculate → confirm
   score → save to the Contact's Customer Profile.

   Facts are shared across templates: if Canada CRS and Australia are both selected, "Age" is
   extracted and confirmed once and scored by both. Only confirmed (or user-entered) values
   are scored. Values confirmed on an earlier run are never overwritten silently — a
   different value from this call is shown side by side for the user to choose. */

const fmtAt = (ms) => { if(ms == null) return ''; const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* Answer statuses — how each value came to be in the profile. */
const ANSWER_STATUS = {
  confirmed: {label:'Found in conversation · confirmed', fg:'#0B7A55', bg:'#E8F7F1'},
  edited:    {label:'Edited by you',                      fg:'#1F4FB8', bg:T.blueLight},
  entered:   {label:'Entered by you (not in conversation)', fg:'#1F4FB8', bg:T.blueLight},
  kept:      {label:'Kept from earlier profile',          fg:T.attioText, bg:T.headerBg},
  notFound:  {label:'Not found — left empty',             fg:T.attioMuted, bg:T.headerBg},
};

function StatusChip({status}){
  const s = ANSWER_STATUS[status]; if(!s) return null;
  return <span style={{fontSize:11.5, fontWeight:600, color:s.fg, background:s.bg, borderRadius:9999, padding:'2px 8px', whiteSpace:'nowrap'}}>{s.label}</span>;
}



/* ── Value display / editors ───────────────────────────────────────────────────────────── */

function ValueDisplay({fieldKey, value}){
  const f = PROFILE_FIELDS[fieldKey];
  if(value == null || value === '') return <div style={{fontSize:20, fontWeight:600, color:T.attioMuted}}>—</div>;
  if(f.type === 'scores') return (
    <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8}}>
      {f.parts.map(p => (
        <div key={p.key} style={{border:`1px solid ${T.attioLine}`, borderRadius:8, padding:'8px 10px'}}>
          <div style={{fontSize:11.5, color:T.attioMuted}}>{p.label}</div>
          <div style={{fontSize:20, fontWeight:600, color: value[p.key] == null ? T.attioMuted : T.attioText}}>{value[p.key] ?? '—'}</div>
        </div>
      ))}
    </div>
  );
  return <div style={{fontSize:20, fontWeight:600, color:T.attioText}}>{formatFieldValue(fieldKey, value)}</div>;
}

const inputStyle = {padding:'8px 10px', fontSize:13.5, border:`1px solid ${T.borderStrong}`, borderRadius:8, fontFamily:'inherit', color:T.attioText, background:'#fff'};

function ValueEditor({fieldKey, value, onChange}){
  const f = PROFILE_FIELDS[fieldKey];
  if(f.type === 'select') return (
    <select value={value ?? ''} onChange={e=>onChange(e.target.value || undefined)} style={{...inputStyle, width:'100%'}}>
      <option value="">Select…</option>
      {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
  if(f.type === 'boolean') return (
    <div style={{display:'flex', gap:8}}>
      {[[true,'Yes'],[false,'No']].map(([v, l]) => (
        <button key={l} onClick={()=>onChange(v)} style={{...inputStyle, cursor:'pointer', minWidth:70, fontWeight:600,
          borderColor: value === v ? T.attioText : T.borderStrong, background: value === v ? T.attioText : '#fff', color: value === v ? '#fff' : T.attioText}}>{l}</button>
      ))}
    </div>
  );
  if(f.type === 'scores') return (
    <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8}}>
      {f.parts.map(p => (
        <label key={p.key} style={{display:'flex', flexDirection:'column', gap:4, fontSize:11.5, color:T.attioMuted}}>
          {p.label}
          <input type="number" min={f.min} max={f.max} step={f.step} value={value?.[p.key] ?? ''}
            onChange={e=>onChange({...(value || {}), [p.key]: e.target.value === '' ? undefined : Number(e.target.value)})} style={inputStyle}/>
        </label>
      ))}
    </div>
  );
  if(f.type === 'number') return (
    <div style={{display:'flex', alignItems:'center', gap:8}}>
      <input type="number" autoFocus min={f.min} max={f.max} step={f.step || 1} value={value ?? ''}
        onChange={e=>onChange(e.target.value === '' ? undefined : Number(e.target.value))} style={{...inputStyle, width:140}}/>
      {f.unit && <span style={{fontSize:13, color:T.attioMuted}}>{f.unit}</span>}
    </div>
  );
  return <input autoFocus value={value ?? ''} onChange={e=>onChange(e.target.value)} style={{...inputStyle, width:'100%'}}/>;
}

const isEmpty = (key, v) => v == null || v === '' || (PROFILE_FIELDS[key].type === 'scores' && !Object.values(v).some(x => x != null));

/* ── Score display (also used by the Customer Profile tab) ─────────────────────────────── */

function ScoreSummary({template, result, compact}){
  const meets = result.passesThreshold;
  return (
    <div>
      <div style={{fontSize:12.5, color:T.attioMuted, fontWeight:500}}>{template.scoreLabel}</div>
      <div style={{display:'flex', alignItems:'baseline', gap:10, flexWrap:'wrap', marginTop:2}}>
        <span style={{fontSize: compact ? 26 : 34, fontWeight:700, color:T.attioText, letterSpacing:-.5}}>{Number(result.total).toLocaleString('en-US')}</span>
        {template.max && <span style={{fontSize:16, fontWeight:500, color:T.attioMuted}}>/ {Number(template.max).toLocaleString('en-US')}</span>}
        {!template.max && <span style={{fontSize:16, fontWeight:500, color:T.attioMuted}}>points</span>}
        {template.threshold != null && (
          <span style={{fontSize:12.5, fontWeight:600, color: meets ? '#0B7A55' : T.red, background: meets ? '#E8F7F1' : '#FDECEC', borderRadius:9999, padding:'3px 9px'}}>
            {meets ? 'Meets' : 'Below'} threshold {template.threshold}
          </span>
        )}
      </div>
      <div style={{fontSize:12.5, color:T.attioMuted, marginTop:4}}>{template.thresholdNote}</div>
      {result.gates.length > 0 && (
        <div style={{display:'flex', flexDirection:'column', gap:4, marginTop:10}}>
          {result.gates.map(g => (
            <div key={g.label} style={{fontSize:12.5, color: g.met ? '#0B7A55' : T.red, display:'flex', gap:6}}>
              <span style={{fontWeight:700}}>{g.met ? '✓' : '✗'}</span><span style={{color:T.attioText}}>{g.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreBreakdown({result}){
  const row = (label, points, extra, indent) => (
    <div style={{display:'flex', gap:10, padding:'5px 0', paddingLeft: indent ? 14 : 0, fontSize:12.5}}>
      <span style={{flex:1, color:T.attioText}}>{label}{extra && <span style={{color:T.attioMuted}}> · {extra}</span>}</span>
      <span style={{fontVariantNumeric:'tabular-nums', color: points ? T.attioText : T.attioMuted, fontWeight:500}}>{points}</span>
    </div>
  );
  return (
    <div style={{display:'flex', flexDirection:'column', gap:10}}>
      {result.groups.map(g => (
        <div key={g.id} style={{border:`1px solid ${T.attioLine}`, borderRadius:8, padding:'8px 12px'}}>
          <div style={{display:'flex', gap:10, fontSize:13, fontWeight:600, color:T.attioText, paddingBottom:4, borderBottom:`1px solid ${T.attioLine}`}}>
            <span style={{flex:1}}>{g.label}</span>
            <span style={{fontVariantNumeric:'tabular-nums'}}>{g.points}{g.cap != null && <span style={{color:T.attioMuted, fontWeight:500}}> / {g.cap}</span>}</span>
          </div>
          {g.capped && <div style={{fontSize:11.5, color:'#8A4B08', paddingTop:4}}>Capped at {g.cap} (raw {g.raw}).</div>}
          {g.lines.map((l, i) => l.sub ? (
            <div key={i}>
              {row(l.label, l.points, l.cap != null ? `max ${l.cap}${l.capped ? `, raw ${l.raw}` : ''}` : null)}
              {l.sub.map((s, j) => <React.Fragment key={j}>{row(s.label, s.points, s.note, true)}</React.Fragment>)}
            </div>
          ) : <React.Fragment key={i}>{row(l.label, l.points, l.missing ? 'no value' : l.note)}</React.Fragment>)}
        </div>
      ))}
    </div>
  );
}

/* ── Flow pieces ────────────────────────────────────────────────────────────────────────── */

/* The whole flow lives in ONE modal of fixed size: only the body and footer change between
   template selection, extraction, confirmation and the result. */
const RUN_MODAL = {width:600, height:'min(600px, calc(100vh - 48px))'};

const btnPrimary = (on = true) => ({padding:'9px 18px', borderRadius:8, border:'none', background: on ? T.black : '#C9C9CE', color:'#fff',
  fontSize:13, fontWeight:600, cursor: on ? 'pointer' : 'default'});
const btnSecondary = {padding:'9px 16px', borderRadius:8, border:`1px solid ${T.borderStrong}`, background:'#fff', color:T.attioText, fontSize:13, cursor:'pointer'};

/* Minimal progress: current ━━━━━━ total. */
function RunProgress({current, total, onBack}){
  return (
    <div style={{display:'flex', alignItems:'center', gap:12}}>
      <button onClick={onBack} disabled={!onBack} title="Previous"
        style={{border:'none', background:'transparent', padding:2, cursor: onBack ? 'pointer' : 'default', display:'flex', opacity: onBack ? 1 : .3}}>
        <Icon name="arrowLeft" size={14} color={T.attioText}/>
      </button>
      <span style={{fontSize:13, fontWeight:600, color:T.attioText, fontVariantNumeric:'tabular-nums', minWidth:14}}>{current}</span>
      <div style={{flex:1, height:3, borderRadius:9999, background:T.attioLine, overflow:'hidden'}}>
        <div style={{height:3, width:`${(current / Math.max(1, total)) * 100}%`, background:T.attioText, transition:'width 220ms ease'}}/>
      </div>
      <span style={{fontSize:13, color:T.attioMuted, fontVariantNumeric:'tabular-nums', minWidth:14, textAlign:'right'}}>{total}</span>
    </div>
  );
}

/* Tiny source marker beside the field name — the only status text on a step. */
const FOUND_LABEL = {notes:'From notes', call:'From call', pasted:'From transcript'};
function SourceTag({res, fromPrevious, foundLabel='From call'}){
  if(res.origin && FOUND_LABEL[res.origin]) foundLabel = FOUND_LABEL[res.origin];
  const partConflict = res.conflictParts && Object.keys(res.conflictParts).length > 0;
  const t = res.status === 'conflict' || partConflict ? {l:'Conflict', fg:'#8A4B08', bg:'#FCF1E4'}
          : res.status === 'found' ? {l:foundLabel, fg:'#1F4FB8', bg:T.blueLight}
          : fromPrevious ? {l:'Previous', fg:T.attioText, bg:T.headerBg}
          : {l:'Not found', fg:T.attioMuted, bg:T.headerBg};
  return <span style={{fontSize:11, fontWeight:600, color:t.fg, background:t.bg, borderRadius:9999, padding:'2px 8px'}}>{t.l}</span>;
}

/* Starting value for a step: what the call said, else the value confirmed on an earlier run.
   A contradicted field starts EMPTY — the user picks one of the mentioned values or types
   one; nothing is chosen for them. */
const initialDraft = (res, previous) => res.status === 'found' ? res.value
  : res.status === 'conflict' ? undefined
  : previous ? previous.value : undefined;

/* Status recorded for a confirmed value — how it got into the profile. */
function decisionFor(res, previous, draft){
  if(isEmpty(res.key, draft)) return {status:'notFound'};
  if(res.status === 'found' && sameValue(draft, res.value)) return {value:draft, status:'confirmed', evidence:res.evidence, origin:res.origin};
  // Sales Notes and the transcript disagreed and the user took the transcript's value.
  if(res.alt && sameValue(draft, res.alt.value)) return {value:draft, status:'confirmed', evidence:res.alt.evidence, origin:res.alt.origin};
  if(res.status === 'conflict'){
    const hit = res.candidates.find(c => sameValue(c.value, draft));
    return hit ? {value:draft, status:'confirmed', evidence:hit.evidence} : {value:draft, status:'edited'};
  }
  if(previous && sameValue(previous.value, draft)) return {value:draft, status:'kept'};
  return {value:draft, status: res.status === 'found' ? 'edited' : 'entered'};
}

/* Sales Notes take priority; when the transcript said something different it is shown as one
   line with a way to take it instead. The field itself stays editable for the right value. */
function AltNotice({fieldKey, res, draft, setDraft}){
  if(!res || !res.alt) return null;
  const onAlt = sameValue(draft, res.alt.value);
  const f = PROFILE_FIELDS[fieldKey];
  const say = (v) => f.type === 'scores' && res.alt.parts
    ? Object.keys(res.alt.parts).map(p => `${f.parts.find(x => x.key === p).label} ${v[p]}`).join(', ')
    : formatFieldValue(fieldKey, v);
  const [label, value, cta] = onAlt ? ['Notes say', res.value, 'Use notes'] : ['Transcript says', res.alt.value, 'Use transcript'];
  return (
    <div style={{display:'flex', alignItems:'center', gap:8, marginTop:10, fontSize:12.5, color:'#8A4B08', minWidth:0}}>
      <span style={{minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{label} {say(value)}.</span>
      <button onClick={()=>setDraft(value)} style={{border:'none', background:'transparent', padding:0, cursor:'pointer', fontSize:12.5, color:T.attioBlue, flexShrink:0}}>{cta}</button>
    </div>
  );
}

function FieldStep({fieldKey, res, previous, draft, setDraft, showSource=true, foundLabel}){
  const f = PROFILE_FIELDS[fieldKey];
  const quote = res.status === 'found' && res.evidence && res.evidence[0];
  return (
    <div>
      <div style={{display:'flex', alignItems:'center', gap:8}}>
        <span style={{fontSize:15, fontWeight:600, color:T.attioText}}>{f.label}</span>
        {(showSource || (previous && res.status === 'notFound')) && <SourceTag res={res} fromPrevious={!!previous && res.status === 'notFound'} foundLabel={foundLabel}/>}
      </div>
      <div style={{marginTop:14}}>
        <ValueEditor fieldKey={fieldKey} value={draft} onChange={setDraft}/>
      </div>
      <AltNotice fieldKey={fieldKey} res={res} draft={draft} setDraft={setDraft}/>
      {res.status === 'conflict' && (
        <div style={{display:'flex', gap:6, flexWrap:'wrap', marginTop:10}}>
          {res.candidates.map((c, i) => (
            <button key={i} onClick={()=>setDraft(c.value)}
              style={{fontSize:12, borderRadius:9999, padding:'4px 10px', cursor:'pointer',
                      border:`1px solid ${sameValue(c.value, draft) ? T.attioText : T.borderStrong}`, background:'#fff', color:T.attioText}}>
              {formatFieldValue(fieldKey, c.value)}
            </button>
          ))}
        </div>
      )}
      {/* Composite values (e.g. IELTS) whose parts were contradicted: offer each mentioned value. */}
      {res.conflictParts && Object.keys(res.conflictParts).map(pk => {
        const part = f.parts.find(p => p.key === pk);
        return (
          <div key={pk} style={{display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginTop:10}}>
            <span style={{fontSize:12, color:T.attioMuted, minWidth:64}}>{part.label}</span>
            {res.conflictParts[pk].map(v => (
              <button key={v} onClick={()=>setDraft({...(draft || {}), [pk]: v})}
                style={{fontSize:12, borderRadius:9999, padding:'3px 10px', cursor:'pointer', background:'#fff', color:T.attioText,
                        border:`1px solid ${draft && draft[pk] === v ? T.attioText : T.borderStrong}`}}>{v}</button>
            ))}
          </div>
        );
      })}
      {previous && res.status === 'found' && !sameValue(previous.value, res.value) && (
        <button onClick={()=>setDraft(previous.value)}
          style={{marginTop:10, fontSize:12, border:'none', background:'transparent', padding:0, cursor:'pointer', color:T.attioMuted}}>
          Previous: <span style={{color:T.attioText, textDecoration:'underline'}}>{formatFieldValue(fieldKey, previous.value)}</span>
        </button>
      )}
      {quote && (
        <div title={quote.quote} style={{marginTop:14, fontSize:12, color:T.attioMuted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
          {quote.at != null ? `${fmtAt(quote.at)} · ` : ''}“{quote.quote}”
        </div>
      )}
    </div>
  );
}

/* Low-frequency factors (nominations, relatives, study…) share one step. */
function FactorsStep({keys, results, drafts, setDrafts, showSource=true, foundLabel}){
  return (
    <div>
      <span style={{fontSize:15, fontWeight:600, color:T.attioText}}>Additional factors</span>
      <div style={{display:'flex', flexDirection:'column', marginTop:10}}>
        {keys.map(k => {
          const f = PROFILE_FIELDS[k], r = results[k], v = drafts[k];
          const set = (x) => setDrafts(d => ({...d, [k]: x}));
          return (
            <div key={k} style={{padding:'9px 0', borderTop:`1px solid ${T.attioLine}`}}>
            <div style={{display:'flex', alignItems:'center', gap:12}}>
              <span style={{flex:1, minWidth:0, fontSize:13, color:T.attioText}}>{f.label}</span>
              {showSource && <SourceTag res={r} foundLabel={foundLabel}/>}
              <div style={{width:190, flexShrink:0}}>
                {f.type === 'boolean' ? (
                  <select value={v == null ? '' : v ? 'yes' : 'no'} onChange={e=>set(e.target.value === '' ? undefined : e.target.value === 'yes')} style={{...inputStyle, width:'100%', fontSize:13, padding:'6px 8px'}}>
                    <option value="">—</option><option value="yes">Yes</option><option value="no">No</option>
                  </select>
                ) : (
                  <select value={v ?? ''} onChange={e=>set(e.target.value || undefined)} style={{...inputStyle, width:'100%', fontSize:13, padding:'6px 8px'}}>
                    <option value="">—</option>
                    {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                )}
              </div>
            </div>
            <AltNotice fieldKey={k} res={r} draft={v} setDraft={set}/>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Final result for one template: the total first, the requirement beside it. */
// One template's result after a call — the same explained result as the Customer Profile.
function ResultBlock({template, result}){
  return (
    <div style={{padding:'16px 0', borderTop:`1px solid ${T.attioLine}`}}>
      <div style={{fontSize:13, color:T.attioMuted, fontWeight:500, marginBottom:8}}>{template.name}</div>
      <AssessmentResult version={template.version} result={result} compact/>
      {!result.complete && <div style={{fontSize:12, color:'#8A4B08', marginTop:8}}>Saved as a draft — finish the missing answers in the Customer Profile to calculate.</div>}
    </div>
  );
}

/* ── Runner ─────────────────────────────────────────────────────────────────────────────── */

/* Opened after a call (transcript → pick templates), or from the Customer Profile tab with a
   template already chosen (`initialTemplateIds`) — then it starts at review. With no call
   transcript the fields simply start empty for the user to fill; no source tags are shown. */
function ProfileRunner({contact, call, previousFacts, onCancel, onSave, initialTemplateIds}){
  /* The transcript used for this run: the call's, or one the user pastes (which replaces it
     for this run only — storing pasted transcripts is not defined yet). */
  const [segments, setSegments] = React.useState(call ? call.segments : []);
  const [origin, setOrigin] = React.useState(call && call.segments.length ? 'call' : null);   // 'call' | 'pasted' | null
  const [editorText, setEditorText] = React.useState('');
  const [returnTo, setReturnTo] = React.useState(null);
  const [usedSource, setUsedSource] = React.useState(false);                                 // did extraction read notes or a transcript
  const hasTranscript = segments.length > 0;
  // Sales Notes taken during the call — read first; the transcript fills what they don't cover.
  const noteLines = React.useMemo(() => parseNotesText(call && call.notes), [call]);
  const hasNotes = noteLines.length > 0;
  const foundLabel = origin === 'pasted' ? 'From transcript' : 'From call';
  // From the Customer Profile tab (template already chosen) the modal opens on the transcript
  // status; after a call it opens on template selection.
  const [step, setStep] = React.useState(initialTemplateIds ? 'source' : 'select');
  const [selected, setSelected] = React.useState(() => new Set(initialTemplateIds || []));
  const [extraction, setExtraction] = React.useState(null);
  const [answers, setAnswers] = React.useState({});
  const [pos, setPos] = React.useState(0);
  const [draft, setDraft] = React.useState(undefined);
  const [factorDrafts, setFactorDrafts] = React.useState({});
  const [addTemplate, setAddTemplate] = React.useState(false);
  const prev = previousFacts || {};
  const prevOf = (k) => prev[k] && prev[k].status !== 'notFound' ? prev[k] : null;

  // The templates in use (Settings → Customer Profile) that a call can fill.
  const allTemplates = React.useMemo(() => runnerTemplates(), []);
  const templates = allTemplates.filter(t => selected.has(t.id));
  const factorKeys = [...new Set(templates.flatMap(t => t.factorFields || []))];

  /* Extract from the Sales Notes and `segs` (the current transcript) and start review.
     Fill manually reads neither. */
  const run = (segs = segments, segOrigin = origin, manual = false) => {
    const notes = manual ? [] : noteLines, transcript = manual ? [] : segs;
    const withText = notes.length > 0 || transcript.length > 0;
    setStep('extracting');
    // Extraction is instant; the short pause keeps the step readable in a demo.
    setTimeout(()=>{ setExtraction(runProfileExtraction({notes, transcript}, templates, segOrigin || 'call')); setUsedSource(withText); setAnswers({}); setPos(0); setStep('review'); }, withText ? 1200 : 0);
  };
  const fillManually = () => run([], null, true);

  const openEditor = () => {
    setEditorText(segments.map(s => s.text).join('\n'));
    setReturnTo(step); setStep('transcript');
  };
  const useTranscript = () => {
    const segs = parseTranscriptText(editorText);
    setSegments(segs); setOrigin(segs.length ? 'pasted' : null);
    // Changing the transcript mid-flow re-extracts; otherwise go back to where the user was.
    if(returnTo === 'review' || returnTo === 'score') run(segs, segs.length ? 'pasted' : null); else setStep(returnTo || 'source');
  };

  // Decided values drive conditional steps (spouse questions only when relevant).
  const answerValues = {};
  Object.entries(answers).forEach(([k, a]) => { if(a.status !== 'notFound') answerValues[k] = a.value; });
  const primaryKeys = extraction ? extraction.keys.filter(k => !factorKeys.includes(k)) : [];
  const visibleKeys = primaryKeys.filter(k => { const c = PROFILE_FIELDS[k].showIf; return !c || checkCond(c, answerValues); });
  const steps = [...visibleKeys, ...(factorKeys.length ? ['__factors'] : [])];
  const current = steps[pos];
  const res = current && current !== '__factors' ? {...extraction.results[current], key:current} : null;

  // Prefill each step: an already-decided answer, else the extracted / previous value.
  React.useEffect(()=>{
    if(step !== 'review' || !current) return;
    if(current === '__factors'){
      const d = {};
      factorKeys.forEach(k => { const a = answers[k]; d[k] = a ? (a.status === 'notFound' ? undefined : a.value) : initialDraft(extraction.results[k], prevOf(k)); });
      setFactorDrafts(d);
    } else {
      const a = answers[current];
      setDraft(a ? (a.status === 'notFound' ? undefined : a.value) : initialDraft(extraction.results[current], prevOf(current)));
    }
  }, [step, current]);

  const commit = (next) => {
    setAnswers(a => {
      const merged = {...a, ...next};
      const vals = {}; Object.entries(merged).forEach(([k, x]) => { if(x.status !== 'notFound') vals[k] = x.value; });
      Object.keys(merged).forEach(k => { const c = PROFILE_FIELDS[k]?.showIf; if(c && !checkCond(c, vals)) delete merged[k]; });
      return merged;
    });
    setPos(p => p + 1);
  };
  const confirmStep = () => {
    if(current === '__factors'){
      const out = {};
      factorKeys.forEach(k => { out[k] = decisionFor({...extraction.results[k], key:k}, prevOf(k), factorDrafts[k]); });
      commit(out);
    } else commit({[current]: decisionFor(res, prevOf(current), draft)});
  };
  const leaveEmpty = () => {
    if(current === '__factors'){ const out = {}; factorKeys.forEach(k => { out[k] = {status:'notFound'}; }); commit(out); }
    else commit({[current]: {status:'notFound'}});
  };

  React.useEffect(()=>{ if(step === 'review' && extraction && pos >= steps.length) setStep('score'); }, [pos, steps.length, step]);

  const results = step === 'score' ? templates.map(t => ({template:t, result:runnerResult(t, answerValues)})) : [];
  const canConfirm = current === '__factors' || (current && !isEmpty(current, draft));

  return (
    <div style={{position:'fixed', inset:0, zIndex:106, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div style={{position:'absolute', inset:0, background:'rgba(16,24,40,.40)'}} onClick={onCancel}/>
      <div style={{position:'relative', width:RUN_MODAL.width, maxWidth:'calc(100vw - 32px)', height:RUN_MODAL.height, background:'#fff', borderRadius:14,
                   boxShadow:'0 24px 60px rgba(16,24,40,.28)', display:'flex', flexDirection:'column', overflow:'hidden'}}>

        {/* Constant header — the same through every step. */}
        <div style={{display:'flex', alignItems:'center', gap:10, padding:'18px 24px 14px'}}>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:16, fontWeight:600, color:T.attioText}}>Customer Profile</div>
            {/* Metadata: the transcript when there is one, otherwise the chosen template(s).
                The transcript action lives here except on the transcript-status step, which
                has its own. */}
            <div style={{display:'flex', alignItems:'center', gap:8, fontSize:12.5, color:T.attioMuted, marginTop:2, minHeight:18}}>
              <span>{hasNotes || hasTranscript
                       ? [hasNotes && 'Notes', hasTranscript && `Transcript: ${segments.length} line${segments.length === 1 ? '' : 's'}${origin === 'pasted' ? ' · pasted' : ''}`].filter(Boolean).join(' · ')
                       : templates.map(t => t.name).join(', ')}</span>
              {['select', 'review', 'score'].includes(step) && (
                <button onClick={openEditor} style={{border:'none', background:'transparent', padding:0, cursor:'pointer', fontSize:12.5, color:T.attioBlue}}>
                  {hasTranscript ? 'Edit Transcript' : 'Add Transcript'}
                </button>
              )}
            </div>
          </div>
          <button title="Close" onClick={onCancel} style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:4}}><Icon name="close" size={13} color={T.gray600}/></button>
        </div>

        <div style={{flex:1, minHeight:0, overflowY:'auto', padding:'8px 24px 20px'}}>
          {step === 'select' && (
            <div style={{display:'flex', flexDirection:'column', gap:10}}>
              {allTemplates.map(t => {
                const on = selected.has(t.id);
                return (
                  <div key={t.id} onClick={()=>setSelected(s => { const n = new Set(s); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; })}
                    style={{display:'flex', gap:14, alignItems:'center', padding:'14px 16px', borderRadius:10, cursor:'pointer',
                            border:`1px solid ${on ? T.attioText : T.borderStrong}`, background: on ? T.headerBg : '#fff'}}>
                    <RowCheckbox checked={on} onChange={()=>{}}/>
                    <div style={{flex:1, minWidth:0, fontSize:14, fontWeight:600, color:T.attioText}}>{t.name}</div>
                    <div style={{display:'flex', gap:20, flexShrink:0}}>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:11.5, color:T.attioMuted}}>Total Points</div>
                        <div style={{fontSize:13.5, fontWeight:600, color:T.attioText}}>{Number(t.max).toLocaleString('en-US')}</div>
                      </div>
                      <div style={{textAlign:'right', minWidth:92}}>
                        <div style={{fontSize:11.5, color:T.attioMuted}}>Required</div>
                        <div style={{fontSize:13.5, fontWeight:600, color:T.attioText}}>{t.threshold != null ? t.threshold : (t.requiredLabel || '—')}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Entry point only — template creation is designed separately. */}
              <button onClick={()=>setAddTemplate(true)}
                style={{display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'13px 16px', borderRadius:10, cursor:'pointer',
                        border:`1px dashed ${T.borderStrong}`, background:'#fff', fontSize:13, color:T.attioText}}>
                <Icon name="plus" size={13} color={T.attioText}/> Add Template
              </button>
            </div>
          )}

          {/* Transcript status — the first step when opened from the Customer Profile tab. */}
          {step === 'source' && (
            <div style={{display:'flex', flexDirection:'column', gap:16}}>
              <div style={{fontSize:15, fontWeight:600, color:T.attioText}}>
                {hasNotes && hasTranscript ? 'From notes and transcript' : hasNotes ? 'From notes' : hasTranscript ? 'From transcript' : 'Fill manually'}
              </div>
              {hasNotes && (
                <div style={{display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderRadius:10, border:`1px solid ${T.borderStrong}`}}>
                  <Icon name="notepad" size={16} color={T.attioText}/>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:13, fontWeight:500, color:T.attioText}}>Notes</div>
                    <div style={{fontSize:12, color:T.attioMuted, marginTop:1}}>{noteLines.length} line{noteLines.length === 1 ? '' : 's'}</div>
                  </div>
                </div>
              )}
              <div style={{display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderRadius:10, border:`1px solid ${T.borderStrong}`, background: hasTranscript ? '#fff' : T.headerBg}}>
                <Icon name="notepad" size={16} color={hasTranscript ? T.attioText : T.attioMuted}/>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:13, fontWeight:500, color: hasTranscript ? T.attioText : T.attioMuted}}>{hasTranscript ? 'Transcript' : 'No transcript'}</div>
                  {hasTranscript && <div style={{fontSize:12, color:T.attioMuted, marginTop:1}}>{segments.length} line{segments.length === 1 ? '' : 's'}{origin === 'pasted' ? ' · pasted' : ''}</div>}
                </div>
                <button onClick={openEditor} style={{...btnSecondary, padding:'7px 12px'}}>{hasTranscript ? 'Edit Transcript' : 'Add Transcript'}</button>
              </div>
            </div>
          )}

          {/* Paste / edit a transcript from any calling or meeting tool. */}
          {step === 'transcript' && (
            <div style={{height:'100%', display:'flex', flexDirection:'column', gap:10}}>
              <div style={{fontSize:15, fontWeight:600, color:T.attioText}}>Transcript</div>
              <textarea autoFocus value={editorText} onChange={e=>setEditorText(e.target.value)}
                placeholder="Paste a transcript from any calling or meeting tool"
                style={{flex:1, minHeight:0, resize:'none', padding:'12px 14px', fontSize:13, lineHeight:1.55, fontFamily:'inherit', color:T.attioText,
                        border:`1px solid ${T.borderStrong}`, borderRadius:10, outline:'none'}}/>
            </div>
          )}

          {step === 'extracting' && (
            <div style={{height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14}}>
              <div style={{fontSize:14, fontWeight:600, color:T.attioText}}>Extracting information</div>
              <div style={{width:180, height:3, borderRadius:9999, background:T.attioLine, overflow:'hidden'}}>
                <div style={{height:3, width:'40%', background:T.attioText, borderRadius:9999, animation:'profileScan 1.1s ease-in-out infinite'}}/>
              </div>
              <style>{'@keyframes profileScan{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}'}</style>
            </div>
          )}

          {step === 'review' && current && (
            <div style={{display:'flex', flexDirection:'column', gap:28}}>
              <RunProgress current={pos + 1} total={steps.length} onBack={pos > 0 ? ()=>setPos(p => p - 1) : null}/>
              {current === '__factors'
                ? <FactorsStep keys={factorKeys} results={extraction.results} drafts={factorDrafts} setDrafts={setFactorDrafts} showSource={usedSource} foundLabel={foundLabel}/>
                : <FieldStep key={current} fieldKey={current} res={res} previous={prevOf(current)} draft={draft} setDraft={setDraft} showSource={usedSource} foundLabel={foundLabel}/>}
            </div>
          )}

          {step === 'score' && (
            <div>{results.map(({template, result}) => <ResultBlock key={template.id} template={template} result={result}/>)}</div>
          )}
        </div>

        {/* Footer — two actions per step, always in the same place. */}
        <div style={{display:'flex', justifyContent:'flex-end', gap:8, padding:'14px 24px', borderTop:`1px solid ${T.border}`, minHeight:63}}>
          {step === 'source' && (hasTranscript || hasNotes ? (<>
            <button onClick={fillManually} style={btnSecondary}>Fill Manually</button>
            <button onClick={()=>run()} style={btnPrimary()}>Run Customer Profile</button>
          </>) : (<>
            <button onClick={onCancel} style={btnSecondary}>Cancel</button>
            <button onClick={fillManually} style={btnPrimary()}>Fill Manually</button>
          </>))}
          {step === 'transcript' && (<>
            <button onClick={()=>setStep(returnTo || 'source')} style={btnSecondary}>Cancel</button>
            <button onClick={useTranscript} disabled={!editorText.trim()} style={btnPrimary(!!editorText.trim())}>Use Transcript</button>
          </>)}
          {step === 'select' && (<>
            <button onClick={onCancel} style={btnSecondary}>Cancel</button>
            <button onClick={()=>run()} disabled={!selected.size} style={btnPrimary(!!selected.size)}>Run</button>
          </>)}
          {step === 'review' && (<>
            <button onClick={leaveEmpty} style={btnSecondary}>Leave Empty</button>
            <button onClick={confirmStep} disabled={!canConfirm} style={btnPrimary(canConfirm)}>Confirm</button>
          </>)}
          {step === 'score' && (<>
            <button onClick={()=>{ setPos(Math.max(0, steps.length - 1)); setStep('review'); }} style={btnSecondary}>Back</button>
            <button onClick={()=>onSave({answers, results, callId: call && (origin === 'call' || hasNotes) ? call.id : null, origin: usedSource ? origin : null})} style={btnPrimary()}>Save to Customer Profile</button>
          </>)}
        </div>
      </div>
      {addTemplate && <StubPanel title="Add Template" zIndex={110} onClose={()=>setAddTemplate(false)}/>}
    </div>
  );
}

Object.assign(window, {ProfileRunner, ScoreSummary, ScoreBreakdown, StatusChip, ANSWER_STATUS, ValueDisplay});
