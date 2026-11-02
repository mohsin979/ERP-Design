/* HOF Pulse ERP — Settings → Customer Profile: the assessment template builder.

   Templates are data (`data.assessmentTemplates`, schema in assessmentEngine.jsx); this page only
   edits that data. Nothing here knows about a framework, country or business.

     AssessmentTemplatesSettings — the template list (the Settings → Pipelines table pattern) and,
                                   once a template is opened, its editor in the same content area.
     Template editor             — header (name, category, "Available in Customer Profiles"), a
                                   version switcher (Draft / In effect / Scheduled / Superseded),
                                   the validation strip and six tabs: Details, Questions,
                                   Calculated values, Scoring, Requirements, Test.
       · Only the draft is editable. A published version is read-only; changes go into a new draft
         ("New draft from this version"). Publishing sets the version's effective date; earlier
         results keep the version they were calculated with (assessmentUI.jsx).
       · Template-level details (name, description, category) are editable at any time.
       · Add / edit forms open in side panels (CreatePanelFrame), as elsewhere in Settings.
     AsmConditionBuilder         — the reusable All of / Any of condition editor (nested groups).

   Not defined (so not offered): deleting a template; anything beyond the actions listed. */

/* ── Small pieces ──────────────────────────────────────────────────────────────────────────── */

const AB_AMBER = '#8A4B08';
const abInput = {width:'100%', boxSizing:'border-box', border:`1px solid ${T.borderStrong}`, borderRadius:8, padding:'8px 10px', fontSize:13, fontFamily:'inherit', color:T.attioText, background:'#fff'};
const abCellInput = {...abInput, padding:'7px 9px'};
const abLabelStyle = {fontSize:12.5, color:T.gray600, marginBottom:6, display:'block'};
const abHint = {fontSize:12, color:T.attioMuted, marginTop:5, lineHeight:1.45};
const abTitle = {fontSize:13, fontWeight:600, color:T.attioText};
const abMono = {fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize:11.5, color:T.attioMuted};
const abEllipsis = {whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'};

const abTemplatesOf = (data) => (data && data.assessmentTemplates) || [];
const abEmptyDraft = () => ({id:aUid('ver'), label:'1', status:'draft', effectiveFrom:null, publishedAt:null, source:'', notes:[], scoreLabel:'Score',
  max:null, threshold:null, thresholdNote:'', groups:[{id:'general', label:'General'}], inputs:[], calcs:[], sections:[], gates:[]});
const abBlank = (v) => v === '' || v == null;
const abBound = (v) => abBlank(v) ? '' : Number(v);
// A typed value: a number when it reads as one, else the text.
const abParseVal = (s) => { if(typeof s !== 'string') return s; const t = s.trim(); return t !== '' && !isNaN(Number(t)) ? Number(t) : s; };
const abStrip = (o) => { const n = {...o}; Object.keys(n).forEach(k => { if(n[k] === undefined || n[k] === null) delete n[k]; }); return n; };
const abClone = (x) => JSON.parse(JSON.stringify(x));
const abMove = (list, i, d) => { const j = i + d; if(j < 0 || j >= list.length) return list; const n = list.slice(); const [x] = n.splice(i, 1); n.splice(j, 0, x); return n; };
const abJoin = (xs, n = 3) => xs.length <= n ? xs.join(', ') : `${xs.slice(0, n).join(', ')} +${xs.length - n} more`;
const abPlural = (n, one, many) => `${n.toLocaleString('en-US')} ${n === 1 ? one : (many || `${one}s`)}`;
// A key from a label: "Date of birth" → dateOfBirth.
const abKeyFrom = (label) => {
  const w = String(label || '').replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if(!w.length) return '';
  let k = w.map((x, i) => i ? x[0].toUpperCase() + x.slice(1).toLowerCase() : x.toLowerCase()).join('');
  if(/^\d/.test(k)) k = `_${k}`;
  return k.slice(0, 40);
};
const abUniqueKey = (base, taken) => { if(!base) return base; let k = base, n = 2; while(taken.has(k)) k = `${base}${n++}`; return k; };
const AB_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
// The next version label: 2026.10 → 2026.11, 1 → 2 (skipping labels in use).
const abNextLabel = (label, t) => {
  const taken = new Set((t.versions || []).map(v => String(v.label)));
  const m = /^(.*?)(\d+)$/.exec(String(label || ''));
  if(!m) { let n = 2, next = `${label || 'Version'} (2)`; while(taken.has(next)) next = `${label || 'Version'} (${++n})`; return next; }
  let n = Number(m[2]) + 1, next = `${m[1]}${n}`;
  while(taken.has(next)) next = `${m[1]}${++n}`;
  return next;
};

// A version's state in its template: Draft · In effect · Scheduled (from a date) · Superseded.
function abVersionState(t, v, today = aTodayYmd()){
  if(!v) return {label:'—', tone:'muted'};
  if(v.status === 'draft') return {label:'Draft', tone:'warn'};
  const eff = effectiveVersion(t, today);
  if(eff && eff.id === v.id) return {label:'In effect', tone:'ok'};
  if(v.effectiveFrom && v.effectiveFrom > today) return {label:`Scheduled · ${aFmtYmd(v.effectiveFrom)}`, tone:'info'};
  return {label:'Superseded', tone:'muted'};
}
function AbChip({tone, children, title}){
  if(tone === 'info') return <span title={title} style={{fontSize:11, fontWeight:600, color:T.attioBlue, background:T.blueLight, borderRadius:9999, padding:'2px 8px', whiteSpace:'nowrap', flexShrink:0}}>{children}</span>;
  return <AsmChip tone={tone} title={title}>{children}</AsmChip>;
}

const abIconBtn = (icon, title, onClick, disabled) => (
  <button type="button" title={title} aria-label={title} disabled={disabled} onClick={(e)=>{ e.stopPropagation(); if(!disabled) onClick(); }}
    style={{border:'none', background:'transparent', cursor: disabled ? 'default' : 'pointer', display:'flex', padding:4, opacity: disabled ? .35 : 1, flexShrink:0}}>
    <Icon name={icon} size={13} color={T.gray600}/>
  </button>
);
const abAddLink = (label, onClick) => (
  <button type="button" onClick={onClick} style={{display:'inline-flex', alignItems:'center', gap:6, border:'none', background:'transparent', padding:'4px 0', cursor:'pointer',
    fontFamily:'inherit', fontSize:13, color:T.attioBlue, alignSelf:'flex-start'}}>
    <Icon name="plus" size={13} color={T.attioBlue}/>{label}
  </button>
);
const abAddBtn = (label, onClick) => <StSecondary label={<span style={{display:'inline-flex', alignItems:'center', gap:6}}><Icon name="plus" size={12} color={T.gray800}/>{label}</span>} onClick={onClick}/>;

function AbField({label, hint, error, children}){
  return (
    <div style={{minWidth:0}}>
      {label && <label style={abLabelStyle}>{label}</label>}
      {children}
      {hint && <div style={abHint}>{hint}</div>}
      {error && <div style={{fontSize:12, color:T.red, marginTop:4}}>{error}</div>}
    </div>
  );
}
function AbCheck({checked, onChange, label, hint}){
  return (
    <div>
      <label onClick={()=>onChange(!checked)} style={{display:'inline-flex', alignItems:'center', gap:8, fontSize:13, color:T.attioText, cursor:'pointer'}}>
        <RowCheckbox checked={!!checked} onChange={()=>onChange(!checked)}/>{label}
      </label>
      {hint && <div style={{...abHint, paddingLeft:24, marginTop:3}}>{hint}</div>}
    </div>
  );
}
// Read-only: everything inside is disabled (a published version).
function AbLock({on, children}){
  if(!on) return <>{children}</>;
  return <fieldset disabled style={{border:'none', margin:0, padding:0, minWidth:0, pointerEvents:'none'}}>{children}</fieldset>;
}
function AbSegmented({value, options, onChange, disabled}){
  return (
    <div role="radiogroup" style={{display:'inline-flex', border:`1px solid ${T.borderStrong}`, borderRadius:8, overflow:'hidden', flexShrink:0}}>
      {options.map((o, i) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} disabled={disabled} onClick={()=>onChange(o.value)}
          style={{height:28, padding:'0 12px', border:'none', borderLeft: i ? `1px solid ${T.borderStrong}` : 'none', fontFamily:'inherit', fontSize:12.5, fontWeight:500,
            cursor: disabled ? 'default' : 'pointer', background: value === o.value ? T.black : '#fff', color: value === o.value ? '#fff' : T.attioText, whiteSpace:'nowrap'}}>{o.label}</button>
      ))}
    </div>
  );
}
function AbNumInput({value, onChange, placeholder, style, ariaLabel}){
  return <input type="number" value={value ?? ''} placeholder={placeholder} aria-label={ariaLabel} step="any"
    onChange={e=>onChange(e.target.value === '' ? '' : Number(e.target.value))} style={{...abCellInput, ...style}}/>;
}
// Text that becomes a number when it reads as one (keeps what's typed, e.g. "1.").
function AbLooseInput({value, onChange, placeholder, style, ariaLabel}){
  const show = (v) => v == null ? '' : String(v);
  const [text, setText] = React.useState(show(value));
  React.useEffect(() => { if(abParseVal(text) !== (value == null ? '' : value)) setText(show(value)); }, [value]);
  return <input value={text} placeholder={placeholder} aria-label={ariaLabel} onChange={e=>{ setText(e.target.value); onChange(abParseVal(e.target.value)); }} style={{...abCellInput, ...style}}/>;
}
function AbListInput({value, onChange}){
  const [text, setText] = React.useState((value || []).join(', '));
  return <input value={text} placeholder="Values, separated by commas" onChange={e=>{ setText(e.target.value); onChange(e.target.value.split(',').map(s => s.trim()).filter(Boolean).map(abParseVal)); }} style={abCellInput}/>;
}
function AbTextarea({value, onChange, rows = 3, placeholder, mono}){
  return <textarea value={value || ''} rows={rows} placeholder={placeholder} onChange={e=>onChange(e.target.value)}
    style={{...abInput, resize:'vertical', lineHeight:1.5, ...(mono ? {fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize:12.5} : {})}}/>;
}

/* Fields (versionFields entries) as select options: questions, then calculated values. A field
   that's referred to but no longer exists is still shown, so the reference can be seen and fixed. */
const abFieldOptions = (fields, current) => {
  const opt = (f) => ({value:f.key, label:f.label || f.key});
  const ins = fields.filter(f => f.source === 'input').map(opt), calcs = fields.filter(f => f.source === 'calc').map(opt);
  const missing = current && !fields.some(f => f.key === current) ? [{value:current, label:`${current} (not available)`}] : [];
  return [...missing, ...(ins.length ? [{group:'Questions', options:ins}] : []), ...(calcs.length ? [{group:'Calculated values', options:calcs}] : [])];
};
function AbFieldSelect({value, fields, onChange, placeholder = 'Select a value'}){
  return <FormSelect value={value || ''} placeholder={placeholder} options={abFieldOptions(fields, value)} onChange={(v)=>onChange(v || '')}/>;
}
// An ordered pick of several fields (order matters for "First available").
function AbFieldList({value, fields, onChange, addLabel = 'Add a value', readOnly}){
  const list = (value || []).filter(Boolean);
  const lbl = (k) => { const f = fields.find(x => x.key === k); return f ? f.label : `${k} (not available)`; };
  return (
    <div style={{display:'flex', flexDirection:'column', gap:6}}>
      {list.map((k, i) => (
        <div key={`${k}-${i}`} style={{display:'flex', alignItems:'center', gap:6, border:`1px solid ${T.attioLine}`, borderRadius:8, padding:'4px 6px 4px 10px', minHeight:34}}>
          <span style={{flex:1, minWidth:0, fontSize:13, color:T.attioText, ...abEllipsis}}>{lbl(k)}</span>
          <span style={{...abMono, flexShrink:0}}>{k}</span>
          {!readOnly && <>
            {abIconBtn('arrowUp', 'Move up', ()=>onChange(abMove(list, i, -1)), i === 0)}
            {abIconBtn('arrowDown', 'Move down', ()=>onChange(abMove(list, i, 1)), i === list.length - 1)}
            {abIconBtn('close', 'Remove', ()=>onChange(list.filter((_, j) => j !== i)))}
          </>}
        </div>
      ))}
      {!readOnly && <FormSelect value="" placeholder={addLabel} options={abFieldOptions(fields.filter(f => !list.includes(f.key)))} onChange={v=>v && onChange([...list, v])}/>}
    </div>
  );
}

/* ── Conditions ── {match:'all'|'any', items:[Cond | {field, op, value}]} ────────────────────── */

const abCondNorm = (c) => !c ? {match:'all', items:[]} : c.items ? c : {match:'all', items:[c]};
// Drops unfinished rows and empty groups; nothing left → null (always holds).
function abCondClean(c){
  if(!c) return null;
  if(c.items){
    const items = c.items.map(abCondClean).filter(Boolean);
    return items.length ? {match: c.match === 'any' ? 'any' : 'all', items} : null;
  }
  if(!c.field || !c.op) return null;
  const op = CONDITION_OPS[c.op], out = {field:c.field, op:c.op};
  if(op && op.arity !== 0 && c.value !== undefined) out.value = c.value;
  return out;
}
const abKindOps = (kind) => kind === 'scores' ? ['isSet', 'isEmpty'] : (OPS_FOR_KIND[kind] || OPS_FOR_KIND.any);
const abDefaultCondValue = (op) => { const a = (CONDITION_OPS[op] || {}).arity; return a === 'list' ? {value:[]} : a === 2 ? {value:['', '']} : a === 0 ? {} : {value:''}; };

function AbCondValue({cond, field, onChange}){
  const op = CONDITION_OPS[cond.op];
  if(!op || op.arity === 0) return null;
  const opts = field && (field.options || []).length ? field.options : null;
  const kind = field ? field.kind : 'any';
  if(op.arity === 'list') return opts
    ? <MultiSelectMenu value={Array.isArray(cond.value) ? cond.value : []} options={opts} onChange={onChange} placeholder="Choose options"/>
    : <AbListInput value={Array.isArray(cond.value) ? cond.value : []} onChange={onChange}/>;
  if(op.arity === 2){
    const v = Array.isArray(cond.value) ? cond.value : ['', ''];
    return (
      <div style={{display:'flex', alignItems:'center', gap:6}}>
        <AbNumInput value={v[0]} onChange={x=>onChange([x, v[1]])} ariaLabel="From"/>
        <span style={{fontSize:12.5, color:T.attioMuted}}>and</span>
        <AbNumInput value={v[1]} onChange={x=>onChange([v[0], x])} ariaLabel="To"/>
      </div>
    );
  }
  if(opts) return <FormSelect value={cond.value == null ? '' : String(cond.value)} placeholder="Choose" options={opts.map(o => ({value:String(o.value), label:o.label}))}
    onChange={s=>{ const o = opts.find(x => String(x.value) === s); onChange(s === '' ? '' : o ? o.value : s); }}/>;
  if(kind === 'number') return <AbNumInput value={cond.value} onChange={onChange} placeholder="Number"/>;
  if(kind === 'text') return <input value={cond.value ?? ''} onChange={e=>onChange(e.target.value)} style={abCellInput}/>;
  return <AbLooseInput value={cond.value} onChange={onChange} placeholder="Value"/>;
}
function AbCondRow({cond, fields, onChange, onRemove, readOnly}){
  const f = fields.find(x => x.key === cond.field);
  const ops = abKindOps(f ? f.kind : 'any');
  const opList = cond.op && !ops.includes(cond.op) ? [cond.op, ...ops] : ops;
  const pickField = (k) => {
    const nf = fields.find(x => x.key === k), nops = abKindOps(nf ? nf.kind : 'any');
    const op = nops.includes(cond.op) ? cond.op : nops[0];
    onChange({field:k, op, ...abDefaultCondValue(op)});
  };
  return (
    <div style={{display:'flex', alignItems:'flex-start', gap:6, flexWrap:'wrap'}}>
      <div style={{flex:'1.4 1 180px', minWidth:0}}><AbFieldSelect value={cond.field} fields={fields} onChange={pickField} placeholder="Choose a value"/></div>
      <div style={{flex:'1 1 130px', minWidth:0}}>
        <FormSelect value={cond.op || ''} placeholder={cond.field ? 'Choose' : '—'} options={cond.field ? opList.map(o => ({value:o, label:(CONDITION_OPS[o] || {label:o}).label})) : []}
          onChange={op=>onChange({field:cond.field, op, ...((CONDITION_OPS[op] || {}).arity === (CONDITION_OPS[cond.op] || {}).arity ? {value:cond.value} : abDefaultCondValue(op))})}/>
      </div>
      <div style={{flex:'1.2 1 150px', minWidth:0}}><AbCondValue cond={cond} field={f} onChange={(value)=>onChange({...cond, value})}/></div>
      {!readOnly && <div style={{paddingTop:6}}>{abIconBtn('close', 'Remove condition', onRemove)}</div>}
    </div>
  );
}
function AbCondGroup({group, onChange, fields, readOnly, depth, onRemove}){
  const items = group.items || [];
  const match = group.match === 'any' ? 'any' : 'all';
  const setItem = (i, x) => onChange({...group, match, items:items.map((y, j) => j === i ? x : y)});
  const removeItem = (i) => onChange({...group, match, items:items.filter((_, j) => j !== i)});
  return (
    <div style={{border: depth ? `1px solid ${T.attioLine}` : 'none', borderRadius:8, padding: depth ? 10 : 0, background: depth ? T.pageBg : 'transparent', display:'flex', flexDirection:'column', gap:8}}>
      {(items.length > 1 || depth > 0) && (
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <AbSegmented value={match} options={[{value:'all', label:'All of'}, {value:'any', label:'Any of'}]} onChange={(m)=>onChange({...group, match:m})} disabled={readOnly}/>
          <span style={{fontSize:12, color:T.attioMuted}}>{match === 'any' ? 'at least one must hold' : 'every one must hold'}</span>
          <span style={{flex:1}}/>
          {onRemove && !readOnly && abIconBtn('trash', 'Remove group', onRemove)}
        </div>
      )}
      {items.map((it, i) => it && it.items
        ? <AbCondGroup key={i} group={it} fields={fields} readOnly={readOnly} depth={depth + 1} onChange={(x)=>setItem(i, x)} onRemove={()=>removeItem(i)}/>
        : <AbCondRow key={i} cond={it || {}} fields={fields} readOnly={readOnly} onChange={(x)=>setItem(i, x)} onRemove={()=>removeItem(i)}/>)}
      {!readOnly && (
        <div style={{display:'flex', gap:16}}>
          {abAddLink('Add condition', ()=>onChange({...group, match, items:[...items, {field:'', op:''}]}))}
          {depth < 3 && abAddLink('Add group', ()=>onChange({...group, match, items:[...items, {match: match === 'any' ? 'all' : 'any', items:[{field:'', op:''}]}]}))}
        </div>
      )}
    </div>
  );
}
/* The condition editor. `fields`: what conditions may read (default: every field of the version).
   `onChange` receives the condition as edited (unfinished rows included); abCondClean tidies it
   when the form is saved. The summary reads it in words. */
function AsmConditionBuilder({value, onChange, version, fields, readOnly, emptyText = 'Always — no conditions'}){
  const fs = fields || versionFields(version);
  const clean = abCondClean(value);
  return (
    <div style={{display:'flex', flexDirection:'column', gap:8}}>
      {readOnly && !clean ? null : <AbCondGroup group={abCondNorm(value)} fields={fs} readOnly={readOnly} depth={0} onChange={(g)=>onChange(g.items.length ? g : null)}/>}
      <div style={{fontSize:12, color:T.attioMuted, lineHeight:1.45}}>{clean ? describeCond(clean, version) : emptyText}</div>
    </div>
  );
}

/* ── Tables of points / values ─────────────────────────────────────────────────────────────── */

const abGridRow = (cols) => ({display:'grid', gridTemplateColumns:cols, gap:8, alignItems:'center'});
// Ranges with explicit inclusive boundaries, and live overlap / gap feedback.
function AbRangeRows({rows, onChange, outKey = 'points', outLabel = 'Points', increment, looseOut, readOnly}){
  const list = rows || [];
  const setRow = (i, p) => onChange(list.map((r, j) => j === i ? {...r, ...p} : r));
  const probs = rangeProblems(list, increment);
  const cols = '24px minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 24px';
  return (
    <div style={{display:'flex', flexDirection:'column', gap:6}}>
      {list.length > 0 && <div style={{...abGridRow(cols), fontSize:12, color:T.attioMuted}}><span/><span>From (at least)</span><span>To (at most)</span><span>{outLabel}</span><span/></div>}
      {list.map((r, i) => (
        <div key={i} style={abGridRow(cols)}>
          <span style={{fontSize:12, color:T.attioFaint, textAlign:'right', fontVariantNumeric:'tabular-nums'}}>{i + 1}</span>
          <AbNumInput value={r.min} onChange={v=>setRow(i, {min:v})} placeholder="Any" ariaLabel={`Row ${i + 1} from`}/>
          <AbNumInput value={r.max} onChange={v=>setRow(i, {max:v})} placeholder="Any" ariaLabel={`Row ${i + 1} to`}/>
          {looseOut ? <AbLooseInput value={r[outKey]} onChange={v=>setRow(i, {[outKey]:v})} ariaLabel={`Row ${i + 1} ${outLabel}`}/>
            : <AbNumInput value={r[outKey]} onChange={v=>setRow(i, {[outKey]:v})} ariaLabel={`Row ${i + 1} ${outLabel}`}/>}
          {!readOnly ? abIconBtn('trash', 'Remove row', ()=>onChange(list.filter((_, j) => j !== i))) : <span/>}
        </div>
      ))}
      {!readOnly && abAddLink('Add row', ()=>onChange([...list, {min:'', max:'', [outKey]:''}]))}
      <div style={{...abHint, marginTop:0}}>Both boundaries are included. Leave one blank for no limit.</div>
      {probs.map((p, i) => <div key={i} style={{fontSize:12, color: p.error ? T.red : AB_AMBER, lineHeight:1.45}}>{p.error ? 'Problem' : 'Check'}: {p.text}</div>)}
    </div>
  );
}
function AbExactRows({rows, onChange, readOnly}){
  const list = rows || [];
  const setRow = (i, p) => onChange(list.map((r, j) => j === i ? {...r, ...p} : r));
  const cols = 'minmax(0,1fr) minmax(0,1fr) 24px';
  const dup = list.map(r => r.value).filter((v, i, a) => v !== '' && a.indexOf(v) !== i);
  return (
    <div style={{display:'flex', flexDirection:'column', gap:6}}>
      {list.length > 0 && <div style={{...abGridRow(cols), fontSize:12, color:T.attioMuted}}><span>When the value is</span><span>Points</span><span/></div>}
      {list.map((r, i) => (
        <div key={i} style={abGridRow(cols)}>
          <AbNumInput value={r.value} onChange={v=>setRow(i, {value:v})} ariaLabel={`Row ${i + 1} value`}/>
          <AbNumInput value={r.points} onChange={v=>setRow(i, {points:v})} ariaLabel={`Row ${i + 1} points`}/>
          {!readOnly ? abIconBtn('trash', 'Remove row', ()=>onChange(list.filter((_, j) => j !== i))) : <span/>}
        </div>
      ))}
      {!readOnly && abAddLink('Add row', ()=>onChange([...list, {value:'', points:''}]))}
      {dup.length > 0 && <div style={{fontSize:12, color:AB_AMBER}}>Check: {abJoin([...new Set(dup)].map(String))} is listed more than once — the first row counts.</div>}
    </div>
  );
}
// Points (or values) per option; blank = none.
function AbOptionValues({options, values, onChange, label = 'Points', placeholder = 'No points', loose}){
  if(!options || !options.length) return <div style={{fontSize:12.5, color:T.attioMuted}}>Choose a value with options first.</div>;
  const v = values || {};
  const cols = 'minmax(0,1.6fr) minmax(0,1fr)';
  const setOne = (k, x) => { const n = {...v}; if(abBlank(x)) delete n[k]; else n[k] = x; onChange(n); };
  return (
    <div style={{border:`1px solid ${T.attioLine}`, borderRadius:8, overflow:'hidden'}}>
      <div style={{...abGridRow(cols), padding:'7px 12px', fontSize:12, color:T.attioMuted, background:T.headerBg}}><span>Option</span><span>{label}</span></div>
      {options.map(o => { const k = String(o.value); return (
        <div key={k} style={{...abGridRow(cols), padding:'6px 12px', borderTop:`1px solid ${T.attioLine}`}}>
          <span style={{fontSize:13, color:T.attioText, lineHeight:1.35}}>{o.label}</span>
          {loose ? <AbLooseInput value={v[k]} onChange={x=>setOne(k, x)} placeholder={placeholder} ariaLabel={`${o.label} ${label}`}/>
            : <AbNumInput value={v[k]} onChange={x=>setOne(k, x)} placeholder={placeholder} ariaLabel={`${o.label} ${label}`}/>}
        </div>
      ); })}
    </div>
  );
}
// A fixed value or another field's value (the If / then / else calculation).
function AbValueOrField({value, onChange, fields}){
  const mode = value && value.ref !== undefined ? 'ref' : 'value';
  return (
    <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
      <div style={{width:170, flexShrink:0}}>
        <FormSelect value={mode} placeholder="Choose" options={[{value:'value', label:'A fixed value'}, {value:'ref', label:'Another value'}]}
          onChange={m=>onChange(m === 'ref' ? {ref:''} : {value:''})}/>
      </div>
      <div style={{flex:'1 1 200px', minWidth:0}}>
        {mode === 'ref' ? <AbFieldSelect value={value.ref} fields={fields} onChange={k=>onChange({ref:k})}/>
          : <AbLooseInput value={value && value.value} onChange={v=>onChange({value:v})} placeholder="Leave blank for no value"/>}
      </div>
    </div>
  );
}
// A formula with live parse feedback and the keys it can use.
function AbFormulaField({value, onChange, fields, readOnly}){
  const ref = React.useRef(null);
  const src = String(value || '');
  const p = src.trim() ? safeFormula(src) : null;
  const known = new Set(fields.map(f => f.key));
  const refs = p && p.ast ? [...new Set(formulaRefs(p.ast))] : [];
  const unknown = refs.filter(r => !known.has(r));
  const insert = (k) => {
    const el = ref.current, s = el ? el.selectionStart : src.length, e = el ? el.selectionEnd : src.length;
    const pad = s > 0 && !/[\s(,]$/.test(src.slice(0, s)) ? ' ' : '';
    onChange(src.slice(0, s) + pad + k + src.slice(e));
    requestAnimationFrame(() => { if(el){ el.focus(); const at = s + pad.length + k.length; el.setSelectionRange(at, at); } });
  };
  return (
    <div style={{display:'flex', flexDirection:'column', gap:6}}>
      <textarea ref={ref} value={src} rows={3} placeholder="e.g. min(a, b) * 2" onChange={e=>onChange(e.target.value)}
        style={{...abInput, resize:'vertical', fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize:12.5, lineHeight:1.5}}/>
      {p && p.error && <div style={{fontSize:12, color:T.red}}>Formula: {p.error}</div>}
      {unknown.length > 0 && <div style={{fontSize:12, color:T.red}}>Not found: {unknown.join(', ')}</div>}
      {p && p.ast && !unknown.length && <div style={{fontSize:12, color:T.attioMuted}}>Reads {refs.length ? abJoin(refs.map(r => (fields.find(f => f.key === r) || {}).label || r), 6) : 'no values'}.</div>}
      <div style={{...abHint, marginTop:0}}>Use + − * / ( ) and min, max, round, floor, ceil, abs. Names are keys of questions and calculated values (a part of a score set: key.part). Yes counts as 1, No as 0.</div>
      {!readOnly && fields.length > 0 && (
        <div>
          <div style={{fontSize:12, color:T.attioMuted, marginBottom:4}}>Insert</div>
          <div style={{display:'flex', flexWrap:'wrap', gap:4, maxHeight:120, overflowY:'auto'}}>
            {fields.map(f => (
              <button key={f.key} type="button" title={f.label} onClick={()=>insert(f.key)} style={{border:`1px solid ${T.attioLine}`, background:'#fff', borderRadius:6, padding:'2px 7px', cursor:'pointer', ...abMono, color:T.attioText}}>{f.key}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Panels and confirmations ──────────────────────────────────────────────────────────────── */

function AbPanel({title, width, readOnly, canSave = true, onCancel, onSave, saveLabel = 'Save', children}){
  return (
    <CreatePanelFrame title={title} width={width} more={false} onClose={onCancel} actions={readOnly ? <StSecondary label="Close" onClick={onCancel}/> : <>
      <StSecondary label="Cancel" onClick={onCancel}/>
      <StCta label={saveLabel} disabled={!canSave} onClick={()=>canSave && onSave()}/>
    </>}>
      {readOnly && <div style={{fontSize:12.5, color:T.attioMuted, marginBottom:14}}>This version is published, so it can't be changed.</div>}
      <AbLock on={readOnly}><div style={{display:'flex', flexDirection:'column', gap:18}}>{children}</div></AbLock>
    </CreatePanelFrame>
  );
}
const abPanelSection = (title, children, hint) => (
  <div style={{display:'flex', flexDirection:'column', gap:10, paddingTop:16, borderTop:`1px solid ${T.border}`}}>
    <div><div style={abTitle}>{title}</div>{hint && <div style={{...abHint, marginTop:2}}>{hint}</div>}</div>
    {children}
  </div>
);
// How many more problems a change leaves (things that referred to what's removed).
const abNewProblems = (before, after) => Math.max(0, validateVersion(after).errors.length - validateVersion(before).errors.length);
function AbConfirmDelete({title, text, problems, confirmLabel = 'Delete', onCancel, onConfirm}){
  return (
    <StModal title={title} primary={confirmLabel} danger onCancel={onCancel} onSubmit={onConfirm}>
      <div style={stTextB}>{text}</div>
      {problems > 0 && <div style={{fontSize:13, color:AB_AMBER, lineHeight:1.45}}>Needs a look: {abPlural(problems, 'thing refers', 'things refer')} to it and will show as {problems === 1 ? 'a problem' : 'problems'} to fix before publishing.</div>}
    </StModal>
  );
}

/* List rows (the tabs' lists): a header and clickable rows. */
const abListBox = {border:`1px solid ${T.attioLine}`, borderRadius:8, overflow:'hidden'};
function AbListHead({cols, children}){
  return <div style={{display:'grid', gridTemplateColumns:cols, alignItems:'center', gap:12, padding:'8px 12px', fontSize:12, color:T.attioMuted, background:T.headerBg}}>{children}</div>;
}
function AbListRow({cols, onClick, children}){
  const [h, setH] = React.useState(false);
  return (
    <div onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} style={{display:'grid', gridTemplateColumns:cols, alignItems:'center', gap:12, padding:'8px 12px',
      fontSize:13, color:T.attioText, borderTop:`1px solid ${T.attioLine}`, cursor:'pointer', background: h ? T.headerBg : '#fff'}}>{children}</div>
  );
}
function AbTabBar({title, hint, action}){
  return (
    <div style={{display:'flex', alignItems:'flex-end', gap:16, marginBottom:14}}>
      <div style={{flex:1, minWidth:0}}>
        <div style={abTitle}>{title}</div>
        {hint && <div style={{...abHint, marginTop:2}}>{hint}</div>}
      </div>
      {action}
    </div>
  );
}
const abEmpty = (title, description, action) => <div style={abListBox}><EmptyState title={title} description={description} action={action}/></div>;

/* ── Details ───────────────────────────────────────────────────────────────────────────────── */

function AbDetailsTab({template, version, readOnly, updT, patchV}){
  const groups = version.groups || [];
  const used = (id) => (version.inputs || []).filter(i => i.group === id).length;
  const two = {display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)', gap:14};
  const setGroups = (fn) => patchV(v => ({...v, groups:fn(v.groups || [])}));
  return (
    <div style={{display:'flex', flexDirection:'column', gap:28, maxWidth:760}}>
      <section style={{display:'flex', flexDirection:'column', gap:14}}>
        <div><div style={abTitle}>Template</div><div style={{...abHint, marginTop:2}}>Applies to every version, and can be changed at any time.</div></div>
        <AbField label="Name" error={!String(template.name || '').trim() ? 'A name is required.' : null}>
          <input value={template.name || ''} onChange={e=>updT(t => ({...t, name:e.target.value}))} style={abInput}/>
        </AbField>
        <AbField label="Description"><AbTextarea value={template.description} onChange={x=>updT(t => ({...t, description:x}))} rows={3}/></AbField>
        <AbField label="Category"><AbCategoryInput value={template.category} onChange={x=>updT(t => ({...t, category:x}))}/></AbField>
      </section>

      <section style={{display:'flex', flexDirection:'column', gap:14}}>
        <div><div style={abTitle}>Version {version.label}</div>
          <div style={{...abHint, marginTop:2}}>{readOnly ? 'Published — read-only.' : 'Draft — changes are saved as you make them.'}</div></div>
        <AbLock on={readOnly}>
          <div style={{display:'flex', flexDirection:'column', gap:14}}>
            <div style={two}>
              <AbField label="Version label"><input value={version.label || ''} onChange={e=>patchV({label:e.target.value})} style={abInput}/></AbField>
              <AbField label="Score label" hint="What the total is called on results."><input value={version.scoreLabel || ''} onChange={e=>patchV({scoreLabel:e.target.value})} placeholder="Score" style={abInput}/></AbField>
            </div>
            <div style={two}>
              <AbField label="Overall maximum (optional)" hint="The total never goes above it.">
                <AbNumInput value={version.max} onChange={v=>patchV({max: v === '' ? null : v})} placeholder="Not capped" style={abInput}/>
              </AbField>
              <AbField label="Pass mark (optional)" hint="Results show whether it's met.">
                <AbNumInput value={version.threshold} onChange={v=>patchV({threshold: v === '' ? null : v})} placeholder="None" style={abInput}/>
              </AbField>
            </div>
            <AbField label="Pass mark note (optional)"><input value={version.thresholdNote || ''} onChange={e=>patchV({thresholdNote:e.target.value})} style={abInput}/></AbField>
            <AbField label="Source / criteria reference"><input value={version.source || ''} onChange={e=>patchV({source:e.target.value})} placeholder="Where these rules come from" style={abInput}/></AbField>
            <AbField label="Notes" hint="One note per line.">
              <AbTextarea value={(version.notes || []).join('\n')} onChange={x=>patchV({notes:x.split('\n')})} rows={4}/>
            </AbField>
          </div>
        </AbLock>
      </section>

      <section style={{display:'flex', flexDirection:'column', gap:10}}>
        <div><div style={abTitle}>Question groups</div><div style={{...abHint, marginTop:2}}>How questions are grouped on the form, in this order. Questions without a group show last, under “Other questions”.</div></div>
        <AbLock on={readOnly}>
          <div style={{display:'flex', flexDirection:'column', gap:6}}>
            {groups.map((g, i) => { const n = used(g.id); return (
              <div key={g.id} style={{display:'flex', alignItems:'center', gap:6}}>
                <span style={{width:18, fontSize:12.5, color:T.gray400, fontVariantNumeric:'tabular-nums', flexShrink:0}}>{i + 1}</span>
                <input value={g.label} onChange={e=>setGroups(gs => gs.map(x => x.id === g.id ? {...x, label:e.target.value} : x))} aria-label={`Group ${i + 1} name`} style={{...abCellInput, flex:1, minWidth:0}}/>
                <span style={{fontSize:12, color:T.attioMuted, width:96, flexShrink:0, textAlign:'right'}}>{abPlural(n, 'question')}</span>
                {!readOnly && <>
                  {abIconBtn('arrowUp', 'Move up', ()=>setGroups(gs => abMove(gs, i, -1)), i === 0)}
                  {abIconBtn('arrowDown', 'Move down', ()=>setGroups(gs => abMove(gs, i, 1)), i === groups.length - 1)}
                  <span title={n ? 'Questions use this group — move them to another group first' : undefined} style={{display:'flex'}}>
                    {abIconBtn('trash', 'Remove group', ()=>setGroups(gs => gs.filter(x => x.id !== g.id)), n > 0)}
                  </span>
                </>}
              </div>
            ); })}
            {!groups.length && <div style={{fontSize:12.5, color:T.attioMuted}}>No groups — every question shows under “Other questions”.</div>}
            {!readOnly && abAddLink('Add group', ()=>setGroups(gs => [...gs, {id:aUid('grp'), label:`Group ${gs.length + 1}`}]))}
          </div>
        </AbLock>
      </section>
    </div>
  );
}
// Category: one of the suggestions, or any text.
function AbCategoryInput({value, onChange}){
  const id = React.useMemo(() => aUid('ab-cat'), []);
  return (<>
    <input list={id} value={value || ''} onChange={e=>onChange(e.target.value)} placeholder="Choose or type a category" style={abInput}/>
    <datalist id={id}>{(typeof ASSESSMENT_CATEGORIES !== 'undefined' ? ASSESSMENT_CATEGORIES : []).map(c => <option key={c} value={c}/>)}</datalist>
  </>);
}

/* ── Questions ─────────────────────────────────────────────────────────────────────────────── */

const abTypeLabel = (t) => (INPUT_TYPES.find(x => x.id === t) || {}).label || t || '—';
// Shared facts an input of a type can be filled from (the fact library, profileEngine.jsx).
const abFactOptions = (type) => typeof PROFILE_FIELDS === 'undefined' ? [] : Object.entries(PROFILE_FIELDS)
  .filter(([, f]) => f.type === type).map(([k, f]) => ({value:k, label:f.sub ? `${f.label} (${f.sub})` : f.label}));
const abFactLabel = (k) => typeof PROFILE_FIELDS !== 'undefined' && PROFILE_FIELDS[k] ? PROFILE_FIELDS[k].label : k;
// Contact property types an answer can be copied to.
const AB_WRITEBACK_TYPES = {number:['Number'], text:['Single-Line Text', 'Multi-Line Text'], select:['Single Selection', 'Single-Line Text'],
  multi:['Multi-Selection'], boolean:['Boolean'], date:['Date']};
const abWritebackOptions = (type, props) => (props || []).filter(p => (AB_WRITEBACK_TYPES[type] || []).includes(propertyTypeId(p.type))).map(p => ({value:p.key, label:p.label}));

// Option / part rows: a stored value (or key) and a label; the value follows the label until it's edited.
function AbPairRows({rows, onChange, valueKey, valueLabel, labelLabel, addLabel, readOnly}){
  const list = rows || [];
  const cols = 'minmax(0,1fr) minmax(0,1.6fr) 72px';
  const setRow = (i, patch) => onChange(list.map((r, j) => j === i ? {...r, ...patch} : r));
  const setLabel = (i, label) => { const r = list[i]; const auto = abBlank(r[valueKey]) || r[valueKey] === abKeyFrom(r.label); setRow(i, {label, ...(auto ? {[valueKey]:abKeyFrom(label)} : {})}); };
  return (
    <div style={{display:'flex', flexDirection:'column', gap:6}}>
      {list.length > 0 && <div style={{...abGridRow(cols), fontSize:12, color:T.attioMuted}}><span>{valueLabel}</span><span>{labelLabel}</span><span/></div>}
      {list.map((r, i) => (
        <div key={i} style={abGridRow(cols)}>
          <input value={r[valueKey] == null ? '' : String(r[valueKey])} onChange={e=>setRow(i, {[valueKey]:e.target.value})} aria-label={`${valueLabel} ${i + 1}`} style={{...abCellInput, fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize:12}}/>
          <input value={r.label || ''} onChange={e=>setLabel(i, e.target.value)} aria-label={`${labelLabel} ${i + 1}`} style={abCellInput}/>
          {!readOnly ? <div style={{display:'flex'}}>
            {abIconBtn('arrowUp', 'Move up', ()=>onChange(abMove(list, i, -1)), i === 0)}
            {abIconBtn('arrowDown', 'Move down', ()=>onChange(abMove(list, i, 1)), i === list.length - 1)}
            {abIconBtn('trash', 'Remove', ()=>onChange(list.filter((_, j) => j !== i)))}
          </div> : <span/>}
        </div>
      ))}
      {!readOnly && abAddLink(addLabel, ()=>onChange([...list, {[valueKey]:'', label:''}]))}
    </div>
  );
}

function AbInputPanel({version, input, contactProps, readOnly, onCancel, onSave}){
  const isNew = !input;
  const [d, setD] = React.useState(() => input ? abClone(input) : {key:'', label:'', help:'', group:((version.groups || [])[0] || {}).id || '', type:'number', required:false});
  const [keyTouched, setKeyTouched] = React.useState(!isNew);
  const set = (patch) => setD(x => ({...x, ...patch}));
  const taken = React.useMemo(() => new Set([...(version.inputs || []), ...(version.calcs || [])].map(x => x.key).filter(k => !input || k !== input.key)), [version, input]);
  const setLabel = (label) => setD(x => ({...x, label, ...(keyTouched ? {} : {key:abUniqueKey(abKeyFrom(label), taken)})}));
  const keyErr = !d.key ? 'A key is required.' : !AB_KEY_RE.test(d.key) ? 'Use letters, digits and _ only; it can’t start with a digit.' : taken.has(d.key) ? 'Another question or calculated value uses this key.' : null;
  const t = d.type, hasOptions = t === 'select' || t === 'multi', numeric = t === 'number' || t === 'scores';
  const idx = input ? (version.inputs || []).findIndex(i => i.key === input.key) : (version.inputs || []).length;
  const earlier = new Set((version.inputs || []).slice(0, idx).map(i => i.key));
  const showFields = versionFields(version).filter(f => f.source === 'input' && earlier.has(String(f.key).split('.')[0]));
  const rowsErr = (rows, k, what) => !(rows || []).length ? `Add at least one ${what}.` : (rows || []).some(r => abBlank(String(r[k] ?? '').trim())) ? `Every ${what} needs a value.`
    : new Set((rows || []).map(r => String(r[k]).trim())).size !== rows.length ? `Two ${what}s have the same value.` : null;
  const optionsErr = hasOptions ? rowsErr(d.options, 'value', 'option') : null;
  const partsErr = t === 'scores' ? rowsErr(d.parts, 'key', 'part') : null;
  const partKeyErr = t === 'scores' && (d.parts || []).some(p => p.key && !AB_KEY_RE.test(String(p.key))) ? 'Part keys may use letters, digits and _ only.' : null;
  const canSave = !!String(d.label || '').trim() && !keyErr && !optionsErr && !partsErr && !partKeyErr;
  const complexFact = Array.isArray(d.fact) || d.factMap || d.factSet;
  const factOpts = abFactOptions(t), wbOpts = abWritebackOptions(t, contactProps);
  const setType = (nt) => setD(x => {
    const n = {...x, type:nt};
    if((nt === 'select' || nt === 'multi') && !(n.options || []).length) n.options = [{value:'', label:''}];
    if(nt === 'scores' && !(n.parts || []).length) n.parts = [{key:'', label:''}];
    if(n.fact && !Array.isArray(n.fact) && !n.factMap && !abFactOptions(nt).some(o => o.value === n.fact)){ delete n.fact; delete n.factSet; }
    if(n.writeBack && !abWritebackOptions(nt, contactProps).some(o => o.value === n.writeBack)) delete n.writeBack;
    return n;
  });
  const clean = () => {
    const o = {...d, label:d.label.trim()};
    if(hasOptions) o.options = (d.options || []).map(x => ({value: typeof x.value === 'string' ? x.value.trim() : x.value, label:String(x.label || '').trim() || String(x.value)})); else delete o.options;
    if(t === 'scores') o.parts = (d.parts || []).map(x => ({key:String(x.key).trim(), label:String(x.label || '').trim() || String(x.key)})); else delete o.parts;
    if(!numeric){ delete o.min; delete o.max; delete o.increment; delete o.unit; }
    ['min', 'max', 'increment'].forEach(k => { if(abBlank(o[k])) delete o[k]; });
    if(!String(o.unit || '').trim()) delete o.unit;
    if(!String(o.help || '').trim()) delete o.help;
    const sc = abCondClean(o.showIf); if(sc) o.showIf = sc; else delete o.showIf;
    if(!o.required) delete o.required;
    if(!o.needsVerification) delete o.needsVerification;
    if(!o.writeBack) delete o.writeBack;
    if(!o.group) delete o.group;
    if(!o.fact || (Array.isArray(o.fact) && !o.fact.length)){ delete o.fact; delete o.factMap; delete o.factSet; }
    return abStrip(o);
  };
  return (
    <AbPanel title={isNew ? 'New question' : (input.label || 'Question')} width={620} readOnly={readOnly} canSave={canSave} onCancel={onCancel} onSave={()=>onSave(clean())}>
      <AbField label="Question"><input autoFocus={isNew} value={d.label} onChange={e=>setLabel(e.target.value)} placeholder="What is asked" style={abInput}/></AbField>
      <div style={{display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)', gap:14}}>
        <AbField label="Key" hint="How rules and calculations refer to it." error={keyErr}>
          <input value={d.key} onChange={e=>{ setKeyTouched(true); set({key:e.target.value.trim()}); }} style={{...abInput, fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize:12.5}}/>
          {!isNew && input.key !== d.key && <div style={{fontSize:12, color:AB_AMBER, marginTop:4}}>Check: anything that refers to “{input.key}” will need updating.</div>}
        </AbField>
        <AbField label="Group">
          <FormSelect value={d.group || ''} placeholder="Other questions" options={(version.groups || []).map(g => ({value:g.id, label:g.label}))} onChange={v=>set({group:v})}/>
        </AbField>
      </div>
      <AbField label="Help text (optional)"><AbTextarea value={d.help} onChange={x=>set({help:x})} rows={2}/></AbField>
      <AbField label="Answer type" hint={t === 'text' ? 'Text answers are kept with the assessment but not scored.' : t === 'scores' ? 'One number per part (e.g. several results entered together).' : null}>
        <FormSelect value={t} placeholder="Choose" options={INPUT_TYPES.map(x => ({value:x.id, label:x.label}))} onChange={v=>v && setType(v)}/>
      </AbField>

      {hasOptions && abPanelSection('Options', <>
        <AbPairRows rows={d.options} onChange={x=>set({options:x})} valueKey="value" valueLabel="Stored value" labelLabel="Label" addLabel="Add option" readOnly={readOnly}/>
        {optionsErr && <div style={{fontSize:12, color:T.red}}>{optionsErr}</div>}
      </>, 'Rules and conditions refer to the stored value; people see the label.')}
      {t === 'scores' && abPanelSection('Parts', <>
        <AbPairRows rows={d.parts} onChange={x=>set({parts:x})} valueKey="key" valueLabel="Key" labelLabel="Label" addLabel="Add part" readOnly={readOnly}/>
        {(partsErr || partKeyErr) && <div style={{fontSize:12, color:T.red}}>{partsErr || partKeyErr}</div>}
      </>, 'Each part can be read on its own as key.part.')}
      {numeric && abPanelSection(t === 'scores' ? 'Allowed numbers (each part)' : 'Allowed numbers', (
        <div style={{display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:10}}>
          <AbField label="Minimum"><AbNumInput value={d.min} onChange={v=>set({min:v})} placeholder="Any"/></AbField>
          <AbField label="Maximum"><AbNumInput value={d.max} onChange={v=>set({max:v})} placeholder="Any"/></AbField>
          <AbField label="Steps of"><AbNumInput value={d.increment} onChange={v=>set({increment:v})} placeholder="Any"/></AbField>
          <AbField label="Unit"><input value={d.unit || ''} onChange={e=>set({unit:e.target.value})} placeholder="e.g. years" style={abCellInput}/></AbField>
        </div>
      ))}

      {abPanelSection('Asking and scoring', <>
        <AbCheck checked={d.required} onChange={v=>set({required:v})} label="Required" hint="An assessment can't be calculated until it's answered."/>
        <AbCheck checked={d.needsVerification} onChange={v=>set({needsVerification:v})} label="Needs verification" hint="The answer scores only once it's marked verified."/>
        <AbField label="Show this question only when" hint="Conditions can use questions asked before this one.">
          <AsmConditionBuilder value={d.showIf} onChange={v=>set({showIf:v})} version={version} fields={showFields} readOnly={readOnly} emptyText="Always shown"/>
        </AbField>
      </>)}

      {abPanelSection('Links (optional)', <>
        <AbField label="Fill from the person's known facts" hint="Prefills the answer from what's already known about the person (e.g. after a call). It can still be changed.">
          {complexFact ? (
            <div style={{display:'flex', alignItems:'center', gap:10, flexWrap:'wrap'}}>
              <span style={{fontSize:13, color:T.attioText}}>{[].concat(d.fact || []).map(abFactLabel).join(' + ')}{d.factMap ? ' (with a value mapping)' : ''}</span>
              {!readOnly && <StTextAction label="Remove link" onClick={()=>setD(x => { const n = {...x}; delete n.fact; delete n.factMap; delete n.factSet; return n; })}/>}
            </div>
          ) : factOpts.length ? (
            <FormSelect value={d.fact || ''} placeholder="Not linked" options={factOpts} onChange={v=>setD(x => { const n = {...x, fact:v}; if(!v){ delete n.fact; delete n.factSet; } return n; })}/>
          ) : <div style={{fontSize:12.5, color:T.attioMuted}}>No known facts of this answer type.</div>}
        </AbField>
        <AbField label="Copy the answer to a Contact property" hint="The assessment never changes the contact unless set here.">
          {wbOpts.length || d.writeBack ? (
            <FormSelect value={d.writeBack || ''} placeholder="Don't copy" options={[...(d.writeBack && !wbOpts.some(o => o.value === d.writeBack) ? [{value:d.writeBack, label:`${d.writeBack} (not available)`}] : []), ...wbOpts]}
              onChange={v=>setD(x => { const n = {...x, writeBack:v}; if(!v) delete n.writeBack; return n; })}/>
          ) : <div style={{fontSize:12.5, color:T.attioMuted}}>No Contact properties of a matching type.</div>}
        </AbField>
      </>)}
    </AbPanel>
  );
}

function AbQuestionsTab({version, readOnly, patchV, contactProps}){
  const [panel, setPanel] = React.useState(null);     // {input} | {input:null}
  const [confirm, setConfirm] = React.useState(null);
  const inputs = version.inputs || [];
  const groupLabel = (id) => ((version.groups || []).find(g => g.id === id) || {}).label || 'Other questions';
  const propLabel = (k) => ((contactProps || []).find(p => p.key === k) || {}).label || k;
  const cols = '28px minmax(0,2.4fr) minmax(0,1fr) minmax(0,1fr) 96px';
  const save = (orig, next) => { patchV(v => ({...v, inputs: orig ? (v.inputs || []).map(i => i.key === orig.key ? next : i) : [...(v.inputs || []), next]})); setPanel(null); };
  return (
    <div>
      <AbTabBar title={abPlural(inputs.length, 'question')} hint="Asked in this order (by group on the form). Follow-up questions show only when their condition holds."
        action={!readOnly && abAddBtn('Add question', ()=>setPanel({input:null}))}/>
      {!inputs.length ? abEmpty('No questions yet', 'Questions are what the assessment asks.', !readOnly && abAddBtn('Add question', ()=>setPanel({input:null}))) : (
        <div style={abListBox}>
          <AbListHead cols={cols}><span>#</span><span>Question</span><span>Answer type</span><span>Group</span><span/></AbListHead>
          {inputs.map((i, n) => (
            <AbListRow key={`${i.key}-${n}`} cols={cols} onClick={()=>setPanel({input:i})}>
              <span style={{fontSize:12, color:T.attioFaint, fontVariantNumeric:'tabular-nums'}}>{n + 1}</span>
              <div style={{minWidth:0}}>
                <div style={{display:'flex', alignItems:'center', gap:8, minWidth:0}}>
                  <span style={{...abEllipsis, minWidth:0}}>{i.label || 'Untitled question'}</span>
                  {i.required && <AsmChip>Required</AsmChip>}
                  {i.needsVerification && <AsmChip>Needs verification</AsmChip>}
                </div>
                <div style={{display:'flex', gap:10, flexWrap:'wrap', marginTop:2}}>
                  <span style={abMono}>{i.key}</span>
                  {!condEmpty(i.showIf) && <span style={{fontSize:12, color:T.attioMuted}}>Shown when {describeCond(i.showIf, version)}</span>}
                  {i.fact && <span style={{fontSize:12, color:T.attioMuted}}>Filled from {[].concat(i.fact).map(abFactLabel).join(' + ')}</span>}
                  {i.writeBack && <span style={{fontSize:12, color:T.attioMuted}}>Copied to {propLabel(i.writeBack)}</span>}
                </div>
              </div>
              <span style={{fontSize:12.5, color:T.gray600}}>{abTypeLabel(i.type)}</span>
              <span style={{fontSize:12.5, color:T.gray600, ...abEllipsis}}>{groupLabel(i.group)}</span>
              <div style={{display:'flex', justifyContent:'flex-end'}}>
                {!readOnly && <>
                  {abIconBtn('arrowUp', 'Move up', ()=>patchV(v => ({...v, inputs:abMove(v.inputs || [], n, -1)})), n === 0)}
                  {abIconBtn('arrowDown', 'Move down', ()=>patchV(v => ({...v, inputs:abMove(v.inputs || [], n, 1)})), n === inputs.length - 1)}
                  {abIconBtn('trash', 'Delete question', ()=>setConfirm(i))}
                </>}
              </div>
            </AbListRow>
          ))}
        </div>
      )}
      {panel && <AbInputPanel key={panel.input ? panel.input.key : 'new'} version={version} input={panel.input} contactProps={contactProps} readOnly={readOnly}
        onCancel={()=>setPanel(null)} onSave={(next)=>save(panel.input, next)}/>}
      {confirm && <AbConfirmDelete title="Delete question" text={`“${confirm.label || confirm.key}” will be removed from this draft.`}
        problems={abNewProblems(version, {...version, inputs:inputs.filter(i => i !== confirm)})}
        onCancel={()=>setConfirm(null)} onConfirm={()=>{ const k = confirm.key; patchV(v => ({...v, inputs:(v.inputs || []).filter(i => i.key !== k)})); setConfirm(null); }}/>}
    </div>
  );
}

/* ── Calculated values ─────────────────────────────────────────────────────────────────────── */

const abOpLabel = (op) => (CALC_OPS.find(x => x.id === op) || {}).label || op || '—';
const abNumberFields = (fields) => fields.filter(f => f.kind === 'number' || f.kind === 'any');
const abSide = (s) => !s ? undefined : s.ref !== undefined ? (s.ref ? {ref:s.ref} : undefined) : abBlank(s.value) ? undefined : {value:abParseVal(s.value)};

function AbCalcPanel({version, calc, readOnly, onCancel, onSave}){
  const isNew = !calc;
  const [d, setD] = React.useState(() => calc ? abClone(calc) : {key:'', label:'', op:''});
  const [keyTouched, setKeyTouched] = React.useState(!isNew);
  const set = (patch) => setD(x => ({...x, ...patch}));
  const taken = React.useMemo(() => new Set([...(version.inputs || []), ...(version.calcs || [])].map(x => x.key).filter(k => !calc || k !== calc.key)), [version, calc]);
  const setLabel = (label) => setD(x => ({...x, label, ...(keyTouched ? {} : {key:abUniqueKey(abKeyFrom(label), taken)})}));
  const keyErr = !d.key ? 'A key is required.' : !AB_KEY_RE.test(d.key) ? 'Use letters, digits and _ only; it can’t start with a digit.' : taken.has(d.key) ? 'Another question or calculated value uses this key.' : null;
  const fields = versionFields(version).filter(f => String(f.key).split('.')[0] !== (calc ? calc.key : d.key));
  const opDef = CALC_OPS.find(x => x.id === d.op);
  const source = fields.find(f => f.key === d.input);
  const tableBy = fields.find(f => f.key === d.tableBy);
  /* One table per option of `tableBy`, plus any table already there for a value it doesn't list
     (e.g. a "first available" value takes its options from its first source only) — never dropped. */
  const optKeys = d.tableBy ? ((tableBy && tableBy.options) || []).map(o => String(o.value)) : ['*'];
  const tableKeys = [...optKeys, ...(d.tableBy ? Object.keys(d.tables || {}).filter(k => k !== '*' && !optKeys.includes(k)) : [])];
  const inc = source && source.input && source.input.increment ? Number(source.input.increment) : null;
  const clean = () => {
    const base = {key:d.key, label:d.label.trim(), op:d.op};
    switch(d.op){
      case 'age': case 'years': return {...base, input:d.input || ''};
      case 'convert': return abStrip({...base, input:d.input || '', tableBy:d.tableBy || undefined,
        tables:Object.fromEntries(tableKeys.map(k => [k, ((d.tables || {})[k] || []).map(r => ({min:abBound(r.min), max:abBound(r.max), out:abParseVal(r.out)}))])),
        otherwise: abBlank(d.otherwise) ? undefined : abParseVal(d.otherwise)});
      case 'min': case 'max': case 'sum': case 'count': case 'coalesce': return {...base, inputs:(d.inputs || []).filter(Boolean)};
      case 'map': return abStrip({...base, input:d.input || '', map:Object.fromEntries(Object.entries(d.map || {}).filter(([, v]) => !abBlank(v)).map(([k, v]) => [k, abParseVal(v)])),
        otherwise: abBlank(d.otherwise) ? undefined : abParseVal(d.otherwise)});
      case 'if': return abStrip({...base, when:abCondClean(d.when), then:abSide(d.then), else:abSide(d.else)});
      case 'formula': return {...base, expression:d.expression || ''};
      case 'condition': return abStrip({...base, when:abCondClean(d.when)});
    }
    return base;
  };
  const canSave = !!String(d.label || '').trim() && !keyErr && !!d.op;
  const uses = d.op ? [...new Set(calcRefs(clean()).filter(Boolean))] : [];
  const usedBy = calc ? (version.calcs || []).filter(c => c.key !== calc.key && calcRefs(c).includes(calc.key)).map(c => c.label || c.key) : [];
  return (
    <AbPanel title={isNew ? 'New calculated value' : (calc.label || 'Calculated value')} width={640} readOnly={readOnly} canSave={canSave} onCancel={onCancel} onSave={()=>onSave(clean())}>
      <div style={{display:'grid', gridTemplateColumns:'minmax(0,1.4fr) minmax(0,1fr)', gap:14}}>
        <AbField label="Name"><input autoFocus={isNew} value={d.label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Total experience" style={abInput}/></AbField>
        <AbField label="Key" error={keyErr}>
          <input value={d.key} onChange={e=>{ setKeyTouched(true); set({key:e.target.value.trim()}); }} style={{...abInput, fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize:12.5}}/>
        </AbField>
      </div>
      <AbField label="Calculation" hint={opDef ? opDef.desc : 'Choose how the value is worked out.'}>
        <FormSelect value={d.op || ''} placeholder="Choose" options={CALC_OPS.map(o => ({value:o.id, label:o.label}))} onChange={v=>set({op:v})}/>
      </AbField>

      {(d.op === 'age' || d.op === 'years') && <AbField label="Date" hint="Whole years up to the calculation date.">
        <AbFieldSelect value={d.input} fields={fields.filter(f => f.kind === 'date')} onChange={k=>set({input:k})} placeholder="Choose a date"/>
      </AbField>}

      {d.op === 'convert' && <>
        <AbField label="Number to convert"><AbFieldSelect value={d.input} fields={abNumberFields(fields)} onChange={k=>set({input:k})} placeholder="Choose a number"/></AbField>
        <AbField label="A separate table for each option of (optional)" hint="e.g. a different table for each kind of result.">
          <AbFieldSelect value={d.tableBy} fields={fields.filter(f => f.kind === 'select' && (f.options || []).length)} onChange={k=>set({tableBy:k})} placeholder="One table for every case"/>
        </AbField>
        {tableKeys.map(k => { const o = tableBy && (tableBy.options || []).find(x => String(x.value) === k); return (
          <div key={k}>{abPanelSection(k === '*' ? 'Conversion table' : `When ${tableBy ? tableBy.label : d.tableBy} is ${o ? o.label : k}`, (
            <AbRangeRows rows={(d.tables || {})[k]} onChange={rows=>set({tables:{...(d.tables || {}), [k]:rows}})} outKey="out" outLabel="Result" looseOut increment={inc} readOnly={readOnly}/>
          ))}</div>
        ); })}
        {d.tableBy && !tableKeys.length && <div style={{fontSize:12.5, color:T.attioMuted}}>The chosen value has no options.</div>}
        <AbField label="Result when no row matches (optional)"><AbLooseInput value={d.otherwise} onChange={v=>set({otherwise:v})} placeholder="No value" style={{maxWidth:220}}/></AbField>
      </>}

      {['min', 'max', 'sum', 'count', 'coalesce'].includes(d.op) && (
        <AbField label={d.op === 'coalesce' ? 'Values, in order' : 'Values'} hint={d.op === 'coalesce' ? 'The first one that is filled in is used.' : d.op === 'count' ? 'Counts the ones filled in (Yes counts; No does not).' : null}>
          <AbFieldList value={d.inputs} fields={['min', 'max', 'sum'].includes(d.op) ? abNumberFields(fields) : fields} onChange={x=>set({inputs:x})} readOnly={readOnly}/>
        </AbField>
      )}

      {d.op === 'map' && <>
        <AbField label="Question"><AbFieldSelect value={d.input} fields={fields.filter(f => (f.kind === 'select' || f.kind === 'any') && (f.options || []).length)} onChange={k=>set({input:k, map:{}})} placeholder="Choose a single-select value"/></AbField>
        {source && <AbField label="Value for each option" hint="Leave one blank to use the value below.">
          <AbOptionValues options={source.options} values={d.map} onChange={m=>set({map:m})} label="Value" placeholder="Use the value below" loose/>
        </AbField>}
        <AbField label="Otherwise (optional)"><AbLooseInput value={d.otherwise} onChange={v=>set({otherwise:v})} placeholder="No value" style={{maxWidth:220}}/></AbField>
      </>}

      {d.op === 'if' && <>
        <AbField label="When"><AsmConditionBuilder value={d.when} onChange={v=>set({when:v})} version={version} fields={fields} readOnly={readOnly}/></AbField>
        <AbField label="Then"><AbValueOrField value={d.then || {value:''}} onChange={v=>set({then:v})} fields={fields}/></AbField>
        <AbField label="Otherwise"><AbValueOrField value={d.else || {value:''}} onChange={v=>set({else:v})} fields={fields}/></AbField>
      </>}

      {d.op === 'formula' && <AbField label="Formula"><AbFormulaField value={d.expression} onChange={x=>set({expression:x})} fields={fields} readOnly={readOnly}/></AbField>}

      {d.op === 'condition' && <AbField label="Yes when"><AsmConditionBuilder value={d.when} onChange={v=>set({when:v})} version={version} fields={fields} readOnly={readOnly} emptyText="Always Yes — no conditions"/></AbField>}

      {d.op && abPanelSection('Depends on', (
        <div style={{display:'flex', flexDirection:'column', gap:4, fontSize:12.5, color:T.attioText}}>
          <div><span style={{color:T.attioMuted}}>Uses: </span>{uses.length ? uses.map(k => fieldLabelIn(version, k)).join(', ') : 'nothing yet'}</div>
          {usedBy.length > 0 && <div><span style={{color:T.attioMuted}}>Used by: </span>{usedBy.join(', ')}</div>}
        </div>
      ))}
    </AbPanel>
  );
}

function AbCalcsTab({version, readOnly, patchV}){
  const [panel, setPanel] = React.useState(null);
  const [confirm, setConfirm] = React.useState(null);
  const calcs = version.calcs || [];
  const cols = 'minmax(0,2fr) minmax(0,1fr) minmax(0,2fr) 40px';
  const save = (orig, next) => { patchV(v => ({...v, calcs: orig ? (v.calcs || []).map(c => c.key === orig.key ? next : c) : [...(v.calcs || []), next]})); setPanel(null); };
  return (
    <div>
      <AbTabBar title={abPlural(calcs.length, 'calculated value')} hint="Worked out from answers and other calculated values, in the order they depend on each other. Rules and conditions can use them like answers."
        action={!readOnly && abAddBtn('Add calculated value', ()=>setPanel({calc:null}))}/>
      {!calcs.length ? abEmpty('No calculated values yet', 'Use them for ages, conversions, totals and other values rules need.', !readOnly && abAddBtn('Add calculated value', ()=>setPanel({calc:null}))) : (
        <div style={abListBox}>
          <AbListHead cols={cols}><span>Calculated value</span><span>Calculation</span><span>Uses</span><span/></AbListHead>
          {calcs.map((c, n) => { const uses = [...new Set(calcRefs(c).filter(Boolean))]; return (
            <AbListRow key={`${c.key}-${n}`} cols={cols} onClick={()=>setPanel({calc:c})}>
              <div style={{minWidth:0}}>
                <div style={abEllipsis}>{c.label || 'Untitled'}</div>
                <div style={abMono}>{c.key}</div>
              </div>
              <span style={{fontSize:12.5, color:T.gray600}}>{abOpLabel(c.op)}</span>
              <span style={{fontSize:12.5, color:T.gray600, lineHeight:1.4}}>{uses.length ? abJoin(uses.map(k => fieldLabelIn(version, k))) : '—'}</span>
              <div style={{display:'flex', justifyContent:'flex-end'}}>{!readOnly && abIconBtn('trash', 'Delete calculated value', ()=>setConfirm(c))}</div>
            </AbListRow>
          ); })}
        </div>
      )}
      {panel && <AbCalcPanel key={panel.calc ? panel.calc.key : 'new'} version={version} calc={panel.calc} readOnly={readOnly} onCancel={()=>setPanel(null)} onSave={(next)=>save(panel.calc, next)}/>}
      {confirm && <AbConfirmDelete title="Delete calculated value" text={`“${confirm.label || confirm.key}” will be removed from this draft.`}
        problems={abNewProblems(version, {...version, calcs:calcs.filter(c => c !== confirm)})}
        onCancel={()=>setConfirm(null)} onConfirm={()=>{ const k = confirm.key; patchV(v => ({...v, calcs:(v.calcs || []).filter(c => c.key !== k)})); setConfirm(null); }}/>}
    </div>
  );
}

/* ── Scoring ── sections (nest any depth) and rules ────────────────────────────────────────── */

const abTreeMap = (items, id, fn) => (items || []).map(it => it.id === id ? fn(it) : it.kind === 'section' ? {...it, items:abTreeMap(it.items, id, fn)} : it);
const abTreeRemove = (items, id) => (items || []).filter(it => it.id !== id).map(it => it.kind === 'section' ? {...it, items:abTreeRemove(it.items, id)} : it);
const abTreeMove = (items, id, d) => { const i = (items || []).findIndex(it => it.id === id); return i >= 0 ? abMove(items, i, d) : (items || []).map(it => it.kind === 'section' ? {...it, items:abTreeMove(it.items, id, d)} : it); };
const abTreeAdd = (items, parentId, item) => parentId == null ? [...(items || []), item] : abTreeMap(items, parentId, s => ({...s, items:[...(s.items || []), item]}));
const abTreeCount = (items) => (items || []).reduce((n, it) => n + 1 + (it.kind === 'section' ? abTreeCount(it.items) : 0), 0);

// The values a scoring method can read: inputs of its types; calculated values of a kind that fits.
const AB_CALC_KINDS = {exact:['number', 'any'], range:['number', 'any'], option:['select', 'any'], boolean:['boolean', 'any']};
const abFieldsForMethod = (fields, method) => {
  const m = RULE_METHODS.find(x => x.id === method);
  if(!m || !m.inputTypes) return fields;
  return fields.filter(f => f.source === 'input' ? f.kind !== 'scores' && m.inputTypes.includes(f.kind)
    : m.inputTypes.includes('calc') && (AB_CALC_KINDS[method] || []).includes(f.kind));
};

function AbSectionPanel({version, section, readOnly, onCancel, onSave}){
  const isNew = !section;
  const [d, setD] = React.useState(() => section ? {label:section.label || '', combine:section.combine || 'sum', caps:abClone(section.caps || []), when:section.when ? abClone(section.when) : null}
    : {label:'', combine:'sum', caps:[], when:null});
  const set = (patch) => setD(x => ({...x, ...patch}));
  const fields = versionFields(version);
  const setCap = (i, patch) => set({caps:d.caps.map((c, j) => j === i ? {...c, ...patch} : c)});
  const capErr = d.caps.some(c => abBlank(c.value)) ? 'Every cap needs a number.' : null;
  const save = () => onSave({label:d.label.trim(), combine:d.combine === 'best' ? 'best' : 'sum',
    caps:d.caps.map(c => { const w = abCondClean(c.when); return {...(w ? {when:w} : {}), value:Number(c.value)}; }), when:abCondClean(d.when)});
  return (
    <AbPanel title={isNew ? 'New section' : (section.label || 'Section')} width={640} readOnly={readOnly} canSave={!!d.label.trim() && !capErr} onCancel={onCancel} onSave={save}>
      <AbField label="Section name"><input autoFocus={isNew} value={d.label} onChange={e=>set({label:e.target.value})} style={abInput}/></AbField>
      <AbField label="How its items count">
        <div role="radiogroup" style={{display:'flex', gap:8}}>
          <StRadioCard selected={d.combine !== 'best'} title="Add the items" description="Every item's points are added together." onSelect={()=>set({combine:'sum'})}/>
          <StRadioCard selected={d.combine === 'best'} title="Only the highest item counts" description="The other items are shown but not counted." onSelect={()=>set({combine:'best'})}/>
        </div>
      </AbField>
      {abPanelSection('Caps (optional)', <>
        {d.caps.map((c, i) => (
          <div key={i} style={{border:`1px solid ${T.attioLine}`, borderRadius:8, padding:12, display:'flex', flexDirection:'column', gap:10}}>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <span style={{fontSize:12.5, color:T.gray600}}>At most</span>
              <AbNumInput value={c.value} onChange={v=>setCap(i, {value:v})} style={{width:120}} ariaLabel={`Cap ${i + 1}`}/>
              <span style={{fontSize:12.5, color:T.gray600}}>points</span>
              <span style={{flex:1}}/>
              {!readOnly && <>
                {abIconBtn('arrowUp', 'Move up', ()=>set({caps:abMove(d.caps, i, -1)}), i === 0)}
                {abIconBtn('arrowDown', 'Move down', ()=>set({caps:abMove(d.caps, i, 1)}), i === d.caps.length - 1)}
                {abIconBtn('trash', 'Remove cap', ()=>set({caps:d.caps.filter((_, j) => j !== i)}))}
              </>}
            </div>
            <AsmConditionBuilder value={c.when} onChange={v=>setCap(i, {when:v})} version={version} fields={fields} readOnly={readOnly} emptyText="Always applies"/>
          </div>
        ))}
        {capErr && <div style={{fontSize:12, color:T.red}}>{capErr}</div>}
        {!readOnly && abAddLink('Add cap', ()=>set({caps:[...d.caps, {value:''}]}))}
      </>, 'The first cap whose condition holds limits the section. A cap without a condition always applies.')}
      {abPanelSection('Applies when', (
        <AsmConditionBuilder value={d.when} onChange={v=>set({when:v})} version={version} fields={fields} readOnly={readOnly} emptyText="Always applies"/>
      ), 'When it doesn’t hold, the whole section is shown as not applicable and scores nothing.')}
    </AbPanel>
  );
}

function AbRulePanel({version, rule, readOnly, onCancel, onSave}){
  const isNew = !rule;
  const [d, setD] = React.useState(() => rule ? abClone(rule) : {kind:'rule', id:aUid('rule'), label:'', method:'', priority:0});
  const set = (patch) => setD(x => ({...x, ...patch}));
  const fields = versionFields(version);
  const method = RULE_METHODS.find(m => m.id === d.method);
  const pick = abFieldsForMethod(fields, d.method);
  const several = ['exact', 'range', 'option'].includes(d.method) && (!!d.each || (d.inputs || []).length > 0);
  const targets = several ? (d.inputs || []) : [d.input].filter(Boolean);
  const first = fields.find(f => f.key === targets[0]);
  const inc = first && first.input && first.input.increment ? Number(first.input.increment) : 1;
  const single = fields.find(f => f.key === d.input);
  const others = allRules(version).filter(x => x.rule.id !== d.id).map(x => ({value:x.rule.id, label:`${x.rule.label || x.rule.id}${x.path.length ? ` (${x.path[x.path.length - 1]})` : ''}`}));
  const setSeveral = (on) => setD(x => { const n = {...x}; if(on){ n.inputs = x.input ? [x.input] : (x.inputs || []); n.each = true; delete n.input; } else { n.input = (x.inputs || [])[0] || x.input || ''; delete n.inputs; delete n.each; } return n; });
  const clean = () => {
    const base = {kind:'rule', id:d.id, label:d.label.trim(), method:d.method, priority:Number(d.priority) || 0};
    const w = abCondClean(d.when); if(w) base.when = w;
    if(!abBlank(d.max)) base.max = Number(d.max);
    if((d.excludes || []).length) base.excludes = d.excludes;
    const target = several ? {inputs:(d.inputs || []).filter(Boolean), each:true} : {input:d.input || ''};
    const rows = (rs) => (rs || []).map(r => ({min:abBound(r.min), max:abBound(r.max), points:Number(r.points) || 0}));
    const pts = (p) => Object.fromEntries(Object.entries(p || {}).filter(([, v]) => !abBlank(v)).map(([k, v]) => [k, Number(v)]));
    const pickOf = (p) => p === 'max' ? 'max' : 'first';
    switch(d.method){
      case 'exact': return {...base, ...target, rows:(d.rows || []).map(r => ({value:abBound(r.value), points:Number(r.points) || 0}))};
      case 'range': return {...base, ...target, rows:rows(d.rows)};
      case 'date': return {...base, input:d.input || '', measure:d.measure === 'years' ? 'years' : 'age', rows:rows(d.rows)};
      case 'option': return {...base, ...target, points:pts(d.points)};
      case 'boolean': return {...base, input:d.input || '', yes:Number(d.yes) || 0, no:Number(d.no) || 0};
      case 'perOption': return {...base, input:d.input || '', points:pts(d.points), aggregate:d.aggregate === 'max' ? 'max' : 'sum'};
      case 'combination': return {...base, input:d.input || '', pick:pickOf(d.pick),
        combos:(d.combos || []).map(c => ({options:c.options || [], match:c.match === 'exact' ? 'exact' : 'all', points:Number(c.points) || 0}))};
      case 'conditional': return {...base, pick:pickOf(d.pick), cases:(d.cases || []).map(c => { const cw = abCondClean(c.when);
        return {...(cw ? {when:cw} : {}), points:Number(c.points) || 0, ...(String(c.label || '').trim() ? {label:c.label.trim()} : {})}; })};
      case 'formula': return {...base, expression:d.expression || ''};
    }
    return base;
  };
  const pickToggle = (value, onChange) => <AbSegmented value={value === 'max' ? 'max' : 'first'} options={[{value:'first', label:'First match'}, {value:'max', label:'Highest'}]} onChange={onChange} disabled={readOnly}/>;
  const inputPicker = (label = 'Reads') => (
    <AbField label={label}>
      {several ? <AbFieldList value={d.inputs} fields={pick} onChange={x=>set({inputs:x})} readOnly={readOnly}/>
        : <AbFieldSelect value={d.input} fields={pick} onChange={k=>set({input:k})}/>}
      {!pick.length && <div style={{...abHint}}>No questions or calculated values of a type this method can read.</div>}
    </AbField>
  );
  const setCase = (i, patch) => set({cases:(d.cases || []).map((c, j) => j === i ? {...c, ...patch} : c)});
  const setCombo = (i, patch) => set({combos:(d.combos || []).map((c, j) => j === i ? {...c, ...patch} : c)});
  return (
    <AbPanel title={isNew ? 'New rule' : (rule.label || 'Rule')} width={720} readOnly={readOnly} canSave={!!d.method && !!String(d.label || '').trim()} onCancel={onCancel} onSave={()=>onSave(clean())}>
      {isNew ? (
        <AbField label="Scoring method">
          <div style={{display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)', gap:8}}>
            {RULE_METHODS.map(m => <StRadioCard key={m.id} selected={d.method === m.id} title={m.label} description={m.desc} onSelect={()=>set({method:m.id})}/>)}
          </div>
        </AbField>
      ) : (
        <AbField label="Scoring method" hint={method ? method.desc : null}>
          <FormSelect value={d.method || ''} placeholder="Choose" options={RULE_METHODS.map(m => ({value:m.id, label:m.label}))} onChange={v=>v && set({method:v})}/>
        </AbField>
      )}
      {d.method && <>
        <AbField label="Rule name" hint="Shown in results, with its points or why it gave none."><input value={d.label} onChange={e=>set({label:e.target.value})} style={abInput}/></AbField>

        {['exact', 'range', 'option'].includes(d.method) && abPanelSection('What it reads', <>
          <AbCheck checked={several} onChange={setSeveral} label="Several values, same table — add the points for each"/>
          {inputPicker(several ? 'Values' : 'Reads')}
        </>)}
        {d.method === 'range' && abPanelSection('Points', <AbRangeRows rows={d.rows} onChange={r=>set({rows:r})} increment={inc} readOnly={readOnly}/>)}
        {d.method === 'exact' && abPanelSection('Points', <AbExactRows rows={d.rows} onChange={r=>set({rows:r})} readOnly={readOnly}/>)}
        {d.method === 'option' && abPanelSection('Points', <AbOptionValues options={first && first.options} values={d.points} onChange={p=>set({points:p})}/>,
          'Options left blank give no points.')}

        {d.method === 'date' && <>
          {abPanelSection('What it reads', <>
            {inputPicker('Date')}
            <AbField label="Measure">
              <AbSegmented value={d.measure === 'years' ? 'years' : 'age'} options={[{value:'age', label:'Age'}, {value:'years', label:'Years since'}]} onChange={m=>set({measure:m})} disabled={readOnly}/>
            </AbField>
          </>, 'Whole years from the date to the calculation date.')}
          {abPanelSection('Points', <AbRangeRows rows={d.rows} onChange={r=>set({rows:r})} increment={1} readOnly={readOnly}/>)}
        </>}

        {d.method === 'boolean' && <>
          {abPanelSection('What it reads', inputPicker())}
          {abPanelSection('Points', (
            <div style={{display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)', gap:14, maxWidth:360}}>
              <AbField label="Yes"><AbNumInput value={d.yes} onChange={v=>set({yes:v})} placeholder="0"/></AbField>
              <AbField label="No"><AbNumInput value={d.no} onChange={v=>set({no:v})} placeholder="0"/></AbField>
            </div>
          ))}
        </>}

        {d.method === 'perOption' && <>
          {abPanelSection('What it reads', inputPicker())}
          {abPanelSection('Points', <>
            <AbOptionValues options={single && single.options} values={d.points} onChange={p=>set({points:p})}/>
            <AbField label="When several are selected">
              <AbSegmented value={d.aggregate === 'max' ? 'max' : 'sum'} options={[{value:'sum', label:'Add them together'}, {value:'max', label:'Only the highest'}]} onChange={a=>set({aggregate:a})} disabled={readOnly}/>
            </AbField>
          </>)}
        </>}

        {d.method === 'combination' && <>
          {abPanelSection('What it reads', inputPicker())}
          {abPanelSection('Combinations', <>
            {(d.combos || []).map((c, i) => (
              <div key={i} style={{display:'grid', gridTemplateColumns:'minmax(0,2fr) minmax(0,1.1fr) 90px 24px', gap:8, alignItems:'start'}}>
                <MultiSelectMenu value={c.options || []} options={(single && single.options) || []} onChange={v=>setCombo(i, {options:v})} placeholder="Choose options"/>
                <FormSelect value={c.match === 'exact' ? 'exact' : 'all'} placeholder="Match" options={[{value:'all', label:'All of these'}, {value:'exact', label:'Exactly these'}]} onChange={v=>setCombo(i, {match:v || 'all'})}/>
                <AbNumInput value={c.points} onChange={v=>setCombo(i, {points:v})} placeholder="Points" ariaLabel={`Combination ${i + 1} points`}/>
                <div style={{paddingTop:6}}>{!readOnly && abIconBtn('trash', 'Remove combination', ()=>set({combos:(d.combos || []).filter((_, j) => j !== i)}))}</div>
              </div>
            ))}
            {!readOnly && abAddLink('Add combination', ()=>set({combos:[...(d.combos || []), {options:[], match:'all', points:''}]}))}
            <AbField label="When several match">{pickToggle(d.pick, p=>set({pick:p}))}</AbField>
          </>, '“All of these”: those options are selected (others may be too). “Exactly these”: only those.')}
        </>}

        {d.method === 'conditional' && abPanelSection('Cases', <>
          {(d.cases || []).map((c, i) => (
            <div key={i} style={{border:`1px solid ${T.attioLine}`, borderRadius:8, padding:12, display:'flex', flexDirection:'column', gap:10}}>
              <div style={{display:'grid', gridTemplateColumns:'minmax(0,1fr) 110px auto', gap:8, alignItems:'center'}}>
                <input value={c.label || ''} onChange={e=>setCase(i, {label:e.target.value})} placeholder={`Case ${i + 1} name (optional)`} style={abCellInput}/>
                <AbNumInput value={c.points} onChange={v=>setCase(i, {points:v})} placeholder="Points" ariaLabel={`Case ${i + 1} points`}/>
                <div style={{display:'flex'}}>{!readOnly && <>
                  {abIconBtn('arrowUp', 'Move up', ()=>set({cases:abMove(d.cases || [], i, -1)}), i === 0)}
                  {abIconBtn('arrowDown', 'Move down', ()=>set({cases:abMove(d.cases || [], i, 1)}), i === (d.cases || []).length - 1)}
                  {abIconBtn('trash', 'Remove case', ()=>set({cases:(d.cases || []).filter((_, j) => j !== i)}))}
                </>}</div>
              </div>
              <AsmConditionBuilder value={c.when} onChange={v=>setCase(i, {when:v})} version={version} fields={fields} readOnly={readOnly} emptyText="Always matches"/>
            </div>
          ))}
          {!readOnly && abAddLink('Add case', ()=>set({cases:[...(d.cases || []), {when:null, points:''}]}))}
          <AbField label="When several match">{pickToggle(d.pick, p=>set({pick:p}))}</AbField>
        </>, 'Cases are checked in order.')}

        {d.method === 'formula' && abPanelSection('Formula', <AbFormulaField value={d.expression} onChange={x=>set({expression:x})} fields={fields} readOnly={readOnly}/>,
          'The points are the result rounded to a whole number; below 0 counts as 0.')}

        {abPanelSection('Applies when', <AsmConditionBuilder value={d.when} onChange={v=>set({when:v})} version={version} fields={fields} readOnly={readOnly} emptyText="Always applies"/>,
          'When it doesn’t hold, the rule is shown as not applicable.')}
        {abPanelSection('Limits and order', <>
          <div style={{display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)', gap:14}}>
            <AbField label="Rule maximum (optional)" hint="The rule never gives more."><AbNumInput value={d.max} onChange={v=>set({max:v})} placeholder="No maximum"/></AbField>
            <AbField label="Priority" hint="Higher numbers are checked first within the section."><AbNumInput value={d.priority} onChange={v=>set({priority:v})} placeholder="0"/></AbField>
          </div>
          <AbField label="Can't score together with" hint="If one of these already scored, this rule gives no points (checked in priority order).">
            {others.length ? <MultiSelectMenu value={d.excludes || []} options={others} onChange={v=>set({excludes:v})} placeholder="No other rules"/>
              : <div style={{fontSize:12.5, color:T.attioMuted}}>There are no other rules.</div>}
          </AbField>
        </>)}
      </>}
    </AbPanel>
  );
}

function AbTreeItems({items, depth, ctx}){
  return <>{(items || []).map((it, i) => it.kind === 'section'
    ? <AbSectionNode key={it.id || i} s={it} depth={depth} index={i} count={items.length} ctx={ctx}/>
    : <AbRuleNode key={it.id || i} r={it} depth={depth} index={i} count={items.length} ctx={ctx}/>)}</>;
}
function AbSectionNode({s, depth, index, count, ctx}){
  const closed = !!ctx.collapsed[s.id];
  const caps = (s.caps || []).map(c => condEmpty(c.when) ? `${c.value}` : `${c.value} when ${describeCond(c.when, ctx.version)}`);
  const meta = [s.combine === 'best' ? 'Only the highest item counts' : null, caps.length ? `At most ${caps.join('; otherwise ')}` : null,
    !condEmpty(s.when) ? `Applies when ${describeCond(s.when, ctx.version)}` : null].filter(Boolean);
  const pad = 12 + depth * 22;
  return (
    <div style={{borderTop: depth || index ? `1px solid ${T.attioLine}` : 'none'}}>
      <div style={{display:'flex', alignItems:'flex-start', gap:6, padding:'9px 12px', paddingLeft:pad, background: depth ? '#fff' : T.headerBg}}>
        <button type="button" onClick={()=>ctx.toggle(s.id)} title={closed ? 'Expand' : 'Collapse'} style={{border:'none', background:'transparent', padding:'3px 2px', cursor:'pointer', display:'flex'}}>
          <Icon name="chevDown" size={12} color={T.attioMuted} style={{transform: closed ? 'rotate(-90deg)' : 'none'}}/>
        </button>
        <div style={{flex:1, minWidth:0}}>
          <div style={{display:'flex', alignItems:'center', gap:8, minWidth:0}}>
            <ContactName name={s.label || 'Untitled section'} onOpen={()=>ctx.openSection(s)} style={{fontSize:13, fontWeight: depth ? 500 : 600}}/>
            <span style={{fontSize:12, color:T.attioFaint, flexShrink:0}}>{abPlural((s.items || []).length, 'item')}</span>
            {s.combine === 'best' && <AsmChip>Highest counts</AsmChip>}
          </div>
          {meta.map((m, k) => <div key={k} style={{fontSize:12, color:T.attioMuted, marginTop:2, lineHeight:1.4}}>{m}</div>)}
        </div>
        {!ctx.readOnly && <RowActionsMenu title="Section actions" items={[
          {label:'Edit section', onClick:()=>ctx.openSection(s)},
          {label:'Add rule', onClick:()=>ctx.addRule(s.id)},
          {label:'Add section inside', onClick:()=>ctx.addSection(s.id)},
          {label:'Move up', disabled:index === 0, onClick:()=>ctx.move(s.id, -1)},
          {label:'Move down', disabled:index === count - 1, onClick:()=>ctx.move(s.id, 1)},
          {label:'Delete section', danger:true, onClick:()=>ctx.remove(s)},
        ]}/>}
      </div>
      {!closed && <>
        <AbTreeItems items={s.items} depth={depth + 1} ctx={ctx}/>
        {!(s.items || []).length && (
          <div style={{display:'flex', alignItems:'center', gap:12, padding:'8px 12px', paddingLeft:pad + 26, borderTop:`1px solid ${T.attioLine}`, fontSize:12.5, color:T.attioMuted}}>
            No rules yet.{!ctx.readOnly && <>{abAddLink('Add rule', ()=>ctx.addRule(s.id))}{abAddLink('Add section', ()=>ctx.addSection(s.id))}</>}
          </div>
        )}
      </>}
    </div>
  );
}
function AbRuleNode({r, depth, index, count, ctx}){
  const m = RULE_METHODS.find(x => x.id === r.method);
  const reads = ruleInputs(r).filter(Boolean).map(k => fieldLabelIn(ctx.version, k));
  const meta = [m ? m.label : 'No scoring method', reads.length ? `reads ${abJoin(reads, 2)}` : null, !abBlank(r.max) ? `at most ${r.max}` : null,
    Number(r.priority) ? `priority ${r.priority}` : null, (r.excludes || []).length ? `can't score with ${abPlural(r.excludes.length, 'other rule')}` : null].filter(Boolean).join(' · ');
  return (
    <div style={{display:'flex', alignItems:'flex-start', gap:6, padding:'8px 12px', paddingLeft:12 + depth * 22 + 22, borderTop:`1px solid ${T.attioLine}`}}>
      <div style={{flex:1, minWidth:0}}>
        <ContactName name={r.label || 'Untitled rule'} onOpen={()=>ctx.openRule(r)} style={{fontSize:13, fontWeight:500}}/>
        <div style={{fontSize:12, color:T.attioMuted, marginTop:2, lineHeight:1.4}}>{meta}</div>
        {!condEmpty(r.when) && <div style={{fontSize:12, color:T.attioMuted, marginTop:1, lineHeight:1.4}}>Applies when {describeCond(r.when, ctx.version)}</div>}
      </div>
      {!ctx.readOnly && <RowActionsMenu title="Rule actions" items={[
        {label:'Edit rule', onClick:()=>ctx.openRule(r)},
        {label:'Move up', disabled:index === 0, onClick:()=>ctx.move(r.id, -1)},
        {label:'Move down', disabled:index === count - 1, onClick:()=>ctx.move(r.id, 1)},
        {label:'Delete rule', danger:true, onClick:()=>ctx.remove(r)},
      ]}/>}
    </div>
  );
}

function AbScoringTab({version, readOnly, patchV}){
  const [panel, setPanel] = React.useState(null);   // {kind:'section'|'rule', item?, parentId?}
  const [confirm, setConfirm] = React.useState(null);
  const [collapsed, setCollapsed] = React.useState({});
  const sections = version.sections || [];
  const setSections = (fn) => patchV(v => ({...v, sections:fn(v.sections || [])}));
  const ctx = {version, readOnly, collapsed, toggle:(id)=>setCollapsed(c => ({...c, [id]:!c[id]})),
    openSection:(s)=>setPanel({kind:'section', item:s}), openRule:(r)=>setPanel({kind:'rule', item:r}),
    addRule:(parentId)=>setPanel({kind:'rule', parentId}), addSection:(parentId)=>setPanel({kind:'section', parentId}),
    move:(id, dir)=>setSections(items => abTreeMove(items, id, dir)), remove:(it)=>setConfirm(it)};
  const saveSection = (fields) => {
    if(panel.item) setSections(items => abTreeMap(items, panel.item.id, s => abStrip({...s, ...fields})));
    else setSections(items => abTreeAdd(items, panel.parentId, abStrip({kind:'section', id:aUid('sec'), ...fields, items:[]})));
    setPanel(null);
  };
  const saveRule = (rule) => {
    if(panel.item) setSections(items => abTreeMap(items, panel.item.id, () => rule));
    else setSections(items => abTreeAdd(items, panel.parentId, rule));
    setPanel(null);
  };
  const max = versionMaxPoints(version);
  return (
    <div>
      <AbTabBar title="Scoring" hint={`Sections add up to the total; each holds rules and other sections. Highest possible total: ${aFmtPoints(max)}.`}
        action={!readOnly && abAddBtn('Add section', ()=>ctx.addSection(null))}/>
      {!sections.length ? abEmpty('No scoring yet', 'Start with a section, then add the rules that give points.', !readOnly && abAddBtn('Add section', ()=>ctx.addSection(null)))
        : <div style={abListBox}><AbTreeItems items={sections} depth={0} ctx={ctx}/></div>}
      {panel && panel.kind === 'section' && <AbSectionPanel key={panel.item ? panel.item.id : `new-${panel.parentId}`} version={version} section={panel.item} readOnly={readOnly}
        onCancel={()=>setPanel(null)} onSave={saveSection}/>}
      {panel && panel.kind === 'rule' && <AbRulePanel key={panel.item ? panel.item.id : `new-${panel.parentId}`} version={version} rule={panel.item} readOnly={readOnly}
        onCancel={()=>setPanel(null)} onSave={saveRule}/>}
      {confirm && (() => {
        const n = confirm.kind === 'section' ? abTreeCount(confirm.items) : 0;
        return <AbConfirmDelete title={confirm.kind === 'section' ? 'Delete section' : 'Delete rule'}
          text={`“${confirm.label || 'Untitled'}”${n ? ` and the ${abPlural(n, 'item')} in it` : ''} will be removed from this draft.`}
          problems={abNewProblems(version, {...version, sections:abTreeRemove(sections, confirm.id)})}
          onCancel={()=>setConfirm(null)} onConfirm={()=>{ const id = confirm.id; setSections(items => abTreeRemove(items, id)); setConfirm(null); }}/>;
      })()}
    </div>
  );
}

/* ── Requirements (pass / fail, not points) ────────────────────────────────────────────────── */

function AbGatePanel({version, gate, readOnly, onCancel, onSave}){
  const [label, setLabel] = React.useState(gate ? gate.label || '' : '');
  const [when, setWhen] = React.useState(gate && gate.when ? abClone(gate.when) : null);
  return (
    <AbPanel title={gate ? (gate.label || 'Requirement') : 'New requirement'} width={620} readOnly={readOnly} canSave={!!label.trim()} onCancel={onCancel}
      onSave={()=>onSave(abStrip({id:gate ? gate.id : aUid('gate'), label:label.trim(), when:abCondClean(when)}))}>
      <AbField label="Requirement" hint="Shown with the result as met or not met. It doesn't add points."><input autoFocus={!gate} value={label} onChange={e=>setLabel(e.target.value)} style={abInput}/></AbField>
      <AbField label="Met when"><AsmConditionBuilder value={when} onChange={setWhen} version={version} readOnly={readOnly} emptyText="Always met — no conditions"/></AbField>
    </AbPanel>
  );
}
function AbGatesTab({version, readOnly, patchV}){
  const [panel, setPanel] = React.useState(null);
  const [confirm, setConfirm] = React.useState(null);
  const gates = version.gates || [];
  const cols = 'minmax(0,1.4fr) minmax(0,2fr) 40px';
  const save = (orig, next) => { patchV(v => ({...v, gates: orig ? (v.gates || []).map(g => g.id === orig.id ? next : g) : [...(v.gates || []), next]})); setPanel(null); };
  return (
    <div>
      <AbTabBar title={abPlural(gates.length, 'requirement')} hint="Pass / fail checks shown with the result, apart from the points."
        action={!readOnly && abAddBtn('Add requirement', ()=>setPanel({gate:null}))}/>
      {!gates.length ? abEmpty('No requirements', 'Add one for anything that must hold regardless of the points.', !readOnly && abAddBtn('Add requirement', ()=>setPanel({gate:null}))) : (
        <div style={abListBox}>
          <AbListHead cols={cols}><span>Requirement</span><span>Met when</span><span/></AbListHead>
          {gates.map((g, n) => (
            <AbListRow key={g.id || n} cols={cols} onClick={()=>setPanel({gate:g})}>
              <span style={abEllipsis}>{g.label || 'Untitled'}</span>
              <span style={{fontSize:12.5, color:T.gray600, lineHeight:1.4}}>{describeCond(g.when, version)}</span>
              <div style={{display:'flex', justifyContent:'flex-end'}}>{!readOnly && abIconBtn('trash', 'Delete requirement', ()=>setConfirm(g))}</div>
            </AbListRow>
          ))}
        </div>
      )}
      {panel && <AbGatePanel key={panel.gate ? panel.gate.id : 'new'} version={version} gate={panel.gate} readOnly={readOnly} onCancel={()=>setPanel(null)} onSave={(next)=>save(panel.gate, next)}/>}
      {confirm && <AbConfirmDelete title="Delete requirement" text={`“${confirm.label || 'Untitled'}” will be removed from this draft.`}
        onCancel={()=>setConfirm(null)} onConfirm={()=>{ const id = confirm.id; patchV(v => ({...v, gates:(v.gates || []).filter(g => g.id !== id)})); setConfirm(null); }}/>}
    </div>
  );
}

/* ── Test ── the version's form and live result, with sample answers kept only here ─────────── */

function AbTestTab({version}){
  const [answers, setAnswers] = React.useState({});
  const [verified, setVerified] = React.useState({});
  const res = React.useMemo(() => {
    try { return {result:evaluateAssessment(version, answers, {verified})}; }
    catch(e){ return {error:String((e && e.message) || e)}; }
  }, [version, answers, verified]);
  return (
    <div style={{flex:1, minHeight:0, display:'flex', flexDirection:'column'}}>
      <div style={{display:'flex', alignItems:'center', gap:12, padding:'10px 24px', borderBottom:`1px solid ${T.border}`, flexShrink:0}}>
        <span style={{flex:1, fontSize:12.5, color:T.attioMuted}}>Answer as a person would; the result updates as you go. Test answers are not saved.</span>
        <StSecondary label="Clear" onClick={()=>{ setAnswers({}); setVerified({}); }}/>
      </div>
      <div style={{flex:1, minHeight:0, display:'flex'}}>
        <div style={{flex:'1 1 55%', minWidth:0, overflowY:'auto', padding:'20px 24px 32px'}}>
          {(version.inputs || []).length
            ? <AssessmentForm version={version} answers={answers} onAnswer={(k, v)=>setAnswers(a => ({...a, [k]:v}))} verified={verified} onVerify={(k, on)=>setVerified(v => ({...v, [k]:on}))}/>
            : <div style={{fontSize:13, color:T.attioMuted}}>This version has no questions yet.</div>}
        </div>
        <div style={{flex:'1 1 45%', minWidth:0, overflowY:'auto', padding:'20px 24px 32px', borderLeft:`1px solid ${T.border}`, background:T.pageBg}}>
          <div style={{fontSize:11, fontWeight:600, color:T.attioFaint, textTransform:'uppercase', letterSpacing:.4, marginBottom:10}}>Live result</div>
          {res.error ? <div style={{fontSize:13, color:T.red}}>Can't calculate: {res.error}</div> : <AssessmentResult version={version} result={res.result} compact/>}
        </div>
      </div>
    </div>
  );
}

/* ── Validation strip, version switcher, publish ───────────────────────────────────────────── */

function AbValidationStrip({check}){
  const [open, setOpen] = React.useState(false);
  const n = check.errors.length, m = check.warnings.length;
  if(!n && !m) return <div style={{display:'flex', alignItems:'center', gap:8, fontSize:12.5, color:'#0B7A55'}}><Icon name="check" size={13} color="#0B7A55"/>No problems found.</div>;
  return (
    <div style={{border:`1px solid ${n ? '#F4C7C3' : '#F5D9A8'}`, background: n ? '#FEF6F5' : '#FFFBF2', borderRadius:8}}>
      <button type="button" onClick={()=>setOpen(o => !o)} aria-expanded={open} style={{width:'100%', display:'flex', alignItems:'center', gap:8, padding:'7px 12px', border:'none',
        background:'transparent', cursor:'pointer', fontFamily:'inherit', fontSize:12.5, textAlign:'left'}}>
        <Icon name="warningCircle" size={14} color={n ? T.red : AB_AMBER}/>
        <span style={{color:T.attioText, fontWeight:500}}>{abPlural(n, 'problem')} · {m} to check</span>
        {n > 0 && <span style={{color:T.attioMuted}}>— problems must be fixed before publishing</span>}
        <span style={{flex:1}}/>
        <Icon name="chevDown" size={12} color={T.attioMuted} style={{transform: open ? 'rotate(180deg)' : 'none'}}/>
      </button>
      {open && (
        <div style={{maxHeight:200, overflowY:'auto', padding:'0 12px 10px 34px', display:'flex', flexDirection:'column', gap:4}}>
          {check.errors.map((e, i) => <div key={`e${i}`} style={{fontSize:12.5, color:T.red, lineHeight:1.45}}>{e.where} {e.message}</div>)}
          {check.warnings.map((w, i) => <div key={`w${i}`} style={{fontSize:12.5, color:AB_AMBER, lineHeight:1.45}}>{w.where} {w.message}</div>)}
        </div>
      )}
    </div>
  );
}
const abSortVersions = (vs) => [...(vs || [])].sort((a, b) => (a.status === 'draft' ? -1 : b.status === 'draft' ? 1 : String(b.effectiveFrom || '').localeCompare(String(a.effectiveFrom || ''))));
function AbVersionSwitcher({template, version, onPick}){
  const [open, setOpen] = React.useState(false);
  const st = abVersionState(template, version);
  return (
    <div style={{position:'relative', flexShrink:0}}>
      <button type="button" onClick={()=>setOpen(o => !o)} style={{display:'inline-flex', alignItems:'center', gap:8, height:29, padding:'0 10px 0 12px', border:`1px solid ${T.borderStrong}`,
        borderRadius:8, background:'#fff', cursor:'pointer', fontFamily:'inherit', fontSize:13, color:T.attioText}}>
        Version {version.label}<AbChip tone={st.tone}>{st.label}</AbChip><Icon name="chevDown" size={T.chevronSize} color={T.gray600}/>
      </button>
      <MenuShell open={open} onClose={()=>setOpen(false)} width={360}>
        {abSortVersions(template.versions).map(v => { const s = abVersionState(template, v); return (
          <MenuItem key={v.id} onClick={()=>{ onPick(v.id); setOpen(false); }}
            icon={v.id === version.id ? <Icon name="check" size={11} color={T.blue}/> : <span style={{width:11}}/>}
            label={<span style={{display:'inline-flex', alignItems:'center', gap:8}}>Version {v.label}<AbChip tone={s.tone}>{s.label}</AbChip>
              {v.status !== 'draft' && v.effectiveFrom && s.tone !== 'info' && <span style={{fontSize:12, color:T.attioMuted}}>from {aFmtYmd(v.effectiveFrom)}</span>}</span>}/>
        ); })}
      </MenuShell>
    </div>
  );
}
function AbPublishModal({template, version, onCancel, onPublish}){
  const [label, setLabel] = React.useState(version.label || '');
  const [from, setFrom] = React.useState(version.effectiveFrom || aTodayYmd());
  const check = React.useMemo(() => validateVersion(version), [version]);
  const clash = from && publishedVersions(template).find(x => x.id !== version.id && x.effectiveFrom === from);
  const labelTaken = (template.versions || []).some(x => x.id !== version.id && String(x.label).trim() === label.trim());
  const ok = !!label.trim() && !!from && check.ok && !clash;
  // What happens on that date, given the versions already published.
  const sim = {...template, versions:(template.versions || []).map(v => v.id === version.id ? {...v, status:'published', effectiveFrom:from} : v)};
  const today = aTodayYmd(), eff = from ? effectiveVersion(sim, today) : null, current = effectiveVersion(template, today);
  const outcome = !from ? null : from > today ? `It's scheduled: it takes effect on ${aFmtYmd(from)}${current ? `; until then version ${current.label} stays in effect` : ''}.`
    : eff && eff.id === version.id ? 'It takes effect now for new assessments.'
    : eff ? `Version ${eff.label} has a later effective date, so this version would not be in effect.` : null;
  return (
    <StModal title={`Publish version ${version.label}`} primary="Publish" canSubmit={ok} onCancel={onCancel} width={560}
      onSubmit={()=>ok && onPublish({label:label.trim(), effectiveFrom:from})}>
      <div style={{display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)', gap:14}}>
        <AbField label="Version label" error={!label.trim() ? 'A label is required.' : null}>
          <input value={label} onChange={e=>setLabel(e.target.value)} style={abInput}/>
          {labelTaken && <div style={{fontSize:12, color:AB_AMBER, marginTop:4}}>Check: another version already uses this label.</div>}
        </AbField>
        <AbField label="Effective from" error={clash ? `Version ${clash.label} already takes effect on this date.` : null}>
          <DateField value={from} onChange={setFrom} required ariaLabel="Effective from" inputStyle={abInput}/>
        </AbField>
      </div>
      {outcome && <div style={stTextB}>{outcome}</div>}
      <div style={stTextB}>Once published, this version can't be changed. Assessments already calculated keep the version they were calculated with.</div>
      {check.errors.length > 0 && (
        <div style={{display:'flex', flexDirection:'column', gap:4}}>
          <div style={{fontSize:13, fontWeight:600, color:T.red}}>Fix {check.errors.length === 1 ? 'this problem' : `these ${check.errors.length} problems`} to publish</div>
          <div style={{maxHeight:160, overflowY:'auto', display:'flex', flexDirection:'column', gap:3}}>
            {check.errors.map((e, i) => <div key={i} style={{fontSize:12.5, color:T.red, lineHeight:1.45}}>{e.where} {e.message}</div>)}
          </div>
        </div>
      )}
      {check.warnings.length > 0 && (
        <div style={{display:'flex', flexDirection:'column', gap:4}}>
          <div style={{fontSize:13, fontWeight:600, color:AB_AMBER}}>To check ({check.warnings.length})</div>
          <div style={{maxHeight:140, overflowY:'auto', display:'flex', flexDirection:'column', gap:3}}>
            {check.warnings.map((w, i) => <div key={i} style={{fontSize:12.5, color:AB_AMBER, lineHeight:1.45}}>{w.where} {w.message}</div>)}
          </div>
        </div>
      )}
    </StModal>
  );
}

/* ── The template editor ───────────────────────────────────────────────────────────────────── */

const AB_TABS = [{id:'details', label:'Details'}, {id:'questions', label:'Questions'}, {id:'calcs', label:'Calculated values'},
  {id:'scoring', label:'Scoring'}, {id:'gates', label:'Requirements'}, {id:'test', label:'Test'}];

function AbTemplateEditor({template, setTemplates, onBack, contactProps, assessmentCount}){
  const firstVersion = (t) => draftVersion(t) || effectiveVersion(t) || abSortVersions(t.versions)[0] || null;
  const [versionId, setVersionId] = React.useState(() => (firstVersion(template) || {}).id);
  const [tab, setTab] = React.useState('details');
  const [modal, setModal] = React.useState(null);   // 'publish' | 'discard'
  const version = (template.versions || []).find(v => v.id === versionId) || firstVersion(template);
  const readOnly = !version || version.status !== 'draft';
  const check = React.useMemo(() => version && !readOnly ? validateVersion(version) : null, [version, readOnly]);
  const updT = (fn) => setTemplates(ts => ts.map(t => t.id === template.id ? fn(t) : t));
  const patchV = (fn) => {
    if(readOnly) return;
    const vid = version.id;
    updT(t => ({...t, versions:(t.versions || []).map(v => v.id !== vid || v.status !== 'draft' ? v : (typeof fn === 'function' ? fn(v) : {...v, ...fn}))}));
  };
  const draft = draftVersion(template);
  const hasPublished = publishedVersions(template).length > 0;
  const inEffect = effectiveVersion(template), scheduled = scheduledVersion(template);
  const newDraft = () => {
    const nv = cloneVersion(version, {label:abNextLabel(version.label, template), effectiveFrom:null});
    updT(t => ({...t, versions:[...(t.versions || []), nv]}));
    setVersionId(nv.id);
  };
  const publish = ({label, effectiveFrom}) => {
    const vid = version.id;
    updT(t => ({...t, versions:(t.versions || []).map(v => v.id === vid ? {...v, label, effectiveFrom, status:'published', publishedAt:new Date().toISOString(),
      notes:(v.notes || []).map(x => String(x).trim()).filter(Boolean)} : v)}));
    setModal(null);
  };
  const discard = () => {
    const vid = version.id;
    updT(t => ({...t, versions:(t.versions || []).filter(v => v.id !== vid)}));
    setVersionId((inEffect || abSortVersions(publishedVersions(template))[0] || {}).id);
    setModal(null);
  };
  const st = abVersionState(template, version);
  const toggleOk = template.enabled || hasPublished;
  return (
    <div style={{flex:1, minHeight:0, display:'flex', flexDirection:'column', background:'#fff', overflow:'hidden'}}>
      <div style={{padding:'12px 24px 0', flexShrink:0, display:'flex', flexDirection:'column', gap:12}}>
        <button type="button" onClick={onBack} style={{alignSelf:'flex-start', display:'inline-flex', alignItems:'center', gap:6, border:'none', background:'transparent', padding:0,
          cursor:'pointer', fontFamily:'inherit', fontSize:13, color:T.gray600}}>
          <Icon name="arrowLeft" size={13} color={T.gray600}/>All templates
        </button>
        <div style={{display:'flex', alignItems:'flex-start', gap:16, flexWrap:'wrap'}}>
          <div style={{flex:1, minWidth:240}}>
            <div style={{fontSize:16, fontWeight:600, color:T.attioText, lineHeight:1.35}}>{template.name || 'Untitled template'}</div>
            <div style={{fontSize:12.5, color:T.attioMuted, marginTop:2}}>{[template.category || 'No category', abPlural(assessmentCount, 'assessment') + ' use it'].join(' · ')}</div>
          </div>
          <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4}}>
            <div title={!toggleOk ? 'Publish a version first' : undefined} style={{display:'flex', alignItems:'center', gap:8}}>
              <span style={{display:'flex', opacity: toggleOk ? 1 : .45, pointerEvents: toggleOk ? 'auto' : 'none'}}>
                <UtToggle on={!!template.enabled} onChange={v=>updT(t => ({...t, enabled:v}))}/>
              </span>
              <span style={{fontSize:12.5, color:T.gray600}}>Available in Customer Profiles</span>
            </div>
            {!hasPublished && <div style={{fontSize:12, color:T.attioMuted}}>Publish a version to make it available.</div>}
            {template.enabled && hasPublished && !inEffect && scheduled && <div style={{fontSize:12, color:T.attioMuted}}>No version is in effect yet — available from {aFmtYmd(scheduled.effectiveFrom)}.</div>}
          </div>
        </div>

        {!version ? (
          <div style={{display:'flex', alignItems:'center', gap:12, fontSize:13, color:T.attioMuted, paddingBottom:14}}>
            This template has no versions.
            <StCta label="Start a draft" onClick={()=>{ const nv = abEmptyDraft(); updT(t => ({...t, versions:[...(t.versions || []), nv]})); setVersionId(nv.id); }}/>
          </div>
        ) : <>
          <div style={{display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'}}>
            <AbVersionSwitcher template={template} version={version} onPick={setVersionId}/>
            <span style={{flex:1, minWidth:160, fontSize:12.5, color:T.attioMuted}}>
              {version.status === 'draft' ? 'Not used for assessments until it’s published.'
                : [version.effectiveFrom ? `Effective from ${aFmtYmd(version.effectiveFrom)}` : null, version.publishedAt ? `published ${aFmtYmd(String(version.publishedAt).slice(0, 10))}` : null].filter(Boolean).join(' · ')}
            </span>
            {version.status === 'draft' ? <>
              {/* A template's only version can't be discarded (it would have none). */}
              {(template.versions || []).length > 1 && <StSecondary label="Discard draft" onClick={()=>setModal('discard')}/>}
              <StCta label="Publish…" onClick={()=>setModal('publish')}/>
            </> : draft ? <StSecondary label="Open draft" onClick={()=>setVersionId(draft.id)}/>
              : <StSecondary label="New draft from this version" onClick={newDraft}/>}
          </div>
          {check ? <AbValidationStrip check={check}/>
            : <div style={{fontSize:12.5, color:T.attioMuted, background:T.headerBg, borderRadius:8, padding:'7px 12px'}}>
                This version is {st.label.toLowerCase().startsWith('scheduled') ? 'scheduled' : st.label.toLowerCase()} and read-only. {draft ? 'Changes go into the draft.' : 'Start a new draft from it to make changes.'}
              </div>}
          <div style={{display:'flex', gap:8, borderBottom:`1px solid ${T.borderStrong}`, overflowX:'auto'}}>
            {AB_TABS.map(t => {
              const n = t.id === 'questions' ? (version.inputs || []).length : t.id === 'calcs' ? (version.calcs || []).length : t.id === 'gates' ? (version.gates || []).length : null;
              return <UtTab key={t.id} label={<>{t.label}{n != null && <span style={{color:T.attioFaint, marginLeft:6}}>{n}</span>}</>} active={tab === t.id} onClick={()=>setTab(t.id)}/>;
            })}
          </div>
        </>}
      </div>

      {version && (tab === 'test' ? <AbTestTab key={version.id} version={version}/> : (
        <div style={{flex:1, minHeight:0, overflowY:'auto'}}>
          <div key={version.id} style={{padding:'20px 24px 40px'}}>
            {tab === 'details' && <AbDetailsTab template={template} version={version} readOnly={readOnly} updT={updT} patchV={patchV}/>}
            {tab === 'questions' && <AbQuestionsTab version={version} readOnly={readOnly} patchV={patchV} contactProps={contactProps}/>}
            {tab === 'calcs' && <AbCalcsTab version={version} readOnly={readOnly} patchV={patchV}/>}
            {tab === 'scoring' && <AbScoringTab version={version} readOnly={readOnly} patchV={patchV}/>}
            {tab === 'gates' && <AbGatesTab version={version} readOnly={readOnly} patchV={patchV}/>}
          </div>
        </div>
      ))}

      {modal === 'publish' && version && <AbPublishModal template={template} version={version} onCancel={()=>setModal(null)} onPublish={publish}/>}
      {modal === 'discard' && version && (
        <StModal title="Discard draft" primary="Discard draft" danger onCancel={()=>setModal(null)} onSubmit={discard}>
          <div style={stTextB}>Version {version.label} (draft) and its changes will be deleted. Published versions aren't affected.</div>
        </StModal>
      )}
    </div>
  );
}

/* ── New template ──────────────────────────────────────────────────────────────────────────── */

function AbNewTemplatePanel({templates, onCancel, onCreate}){
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [category, setCategory] = React.useState('');
  const n = name.trim();
  const taken = templates.some(t => String(t.name || '').trim().toLowerCase() === n.toLowerCase());
  const ok = !!n && !taken;
  const create = () => ok && onCreate({id:aUid('tpl'), name:n, description:description.trim(), category:category.trim(), enabled:false, versions:[abEmptyDraft()]});
  return (
    <CreatePanelFrame title="New template" onClose={onCancel} more={false} actions={<>
      <StSecondary label="Cancel" onClick={onCancel}/>
      <StCta label="Create" disabled={!ok} onClick={create}/>
    </>}>
      {stack(<>
        <Field label="Name">
          <input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Service suitability check" style={{...fieldText, borderColor: taken ? T.red : undefined}}/>
          {taken && <div style={{fontSize:12, color:T.red, marginTop:4}}>A template with this name already exists.</div>}
        </Field>
        <Field label="Description">
          <textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} placeholder="What it assesses" style={{...fieldText, resize:'vertical', lineHeight:1.5}}/>
        </Field>
        <Field label="Category"><AbCategoryInput value={category} onChange={setCategory}/></Field>
        <div style={{fontSize:12.5, color:T.attioMuted, lineHeight:1.45}}>It starts as a draft, not available in Customer Profiles until a version is published and it's enabled.</div>
      </>)}
    </CreatePanelFrame>
  );
}

/* ── Settings → Customer Profile ───────────────────────────────────────────────────────────── */

const AB_TPL_COLS = [
  {key:'name', label:'Template', width:280}, {key:'category', label:'Category', width:170}, {key:'inEffect', label:'In effect', width:210},
  {key:'scheduled', label:'Scheduled', width:210}, {key:'draft', label:'Draft', width:150}, {key:'availability', label:'Available in Customer Profiles', width:230},
  {key:'assessments', label:'Assessments', width:130},
];
// A copy to start from: its in-effect version (or else the latest) as a draft of a new, disabled template.
const abDuplicate = (t) => {
  const src = effectiveVersion(t) || abSortVersions(publishedVersions(t))[0] || draftVersion(t) || (t.versions || [])[0];
  return {id:aUid('tpl'), name:`Copy of ${t.name}`, description:t.description || '', category:t.category || '', enabled:false,
    versions:[src ? cloneVersion(src, {effectiveFrom:null}) : abEmptyDraft()]};
};

function AssessmentTemplatesSettings({data, setData}){
  const store = useAssessments();
  const templates = abTemplatesOf(data);
  const [openId, setOpenId] = React.useState(null);
  const [creating, setCreating] = React.useState(false);
  const setTemplates = (fn) => setData(d => ({...d, assessmentTemplates:fn(abTemplatesOf(d))}));
  const assessments = store && store.assessments;
  const counts = React.useMemo(() => {
    const c = {};
    Object.values(assessments || {}).forEach(list => (list || []).forEach(a => { c[a.templateId] = (c[a.templateId] || 0) + 1; }));
    return c;
  }, [assessments]);
  const contactProps = (data.properties || []).filter(p => p.objectId === 'contacts' && !p.archived && !p.auto);
  const open = openId ? templates.find(t => t.id === openId) : null;
  if(open) return <AbTemplateEditor key={open.id} template={open} setTemplates={setTemplates} onBack={()=>setOpenId(null)} contactProps={contactProps} assessmentCount={counts[open.id] || 0}/>;

  const rows = templates.map(t => {
    const eff = effectiveVersion(t), sch = scheduledVersion(t), dr = draftVersion(t);
    return {id:t.id, name:t.name || 'Untitled template', category:t.category || '—',
      inEffect: eff ? `${eff.label}${eff.effectiveFrom ? ` · since ${aFmtYmd(eff.effectiveFrom)}` : ''}` : 'None',
      scheduled: sch ? `${sch.label} · ${aFmtYmd(sch.effectiveFrom)}` : '—', draft: dr ? `Draft v${dr.label}` : '—',
      availability: t.enabled ? 'Enabled' : 'Disabled', assessments:String(counts[t.id] || 0)};
  });
  const schema = {
    properties:AB_TPL_COLS, noun:'template', searchKeys:['name', 'category'], fillWidth:true, canCreateProperty:false,
    filterProps:[{key:'name', label:'Template', type:'text'}, {key:'category', label:'Category', type:'select'}, {key:'availability', label:'Available in Customer Profiles', type:'select'}],
    selectValues:{category:[...new Set([...(typeof ASSESSMENT_CATEGORIES !== 'undefined' ? ASSESSMENT_CATEGORIES : []), ...templates.map(t => t.category).filter(Boolean)])], availability:['Enabled', 'Disabled']},
    renderCell: (key, r) => key === 'name' ? <ContactName name={r.name} onOpen={()=>setOpenId(r.id)} style={{fontSize:'inherit', fontWeight:500}}/>
      : key === 'inEffect' && r.inEffect === 'None' ? <span style={{color:T.attioMuted}}>None</span>
      : undefined,
    renderActions: (r) => { const t = templates.find(x => x.id === r.id); const canEnable = publishedVersions(t).length > 0; return (
      <RowActionsMenu title="Template actions" items={[
        {label:'Open', onClick:()=>setOpenId(r.id)},
        {label:'Duplicate', onClick:()=>setTemplates(ts => [...ts, abDuplicate(t)])},
        t.enabled ? {label:'Disable', onClick:()=>setTemplates(ts => ts.map(x => x.id === t.id ? {...x, enabled:false} : x))}
          : {label:'Enable', disabled:!canEnable, onClick:()=>setTemplates(ts => ts.map(x => x.id === t.id ? {...x, enabled:true} : x))},
      ]}/>
    ); },
  };
  return (
    <div style={{position:'relative', flex:1, minHeight:0, display:'flex', flexDirection:'column', overflow:'hidden'}}>
      <SettingsPage fill>
        <div style={{display:'flex', flexDirection:'column', flex:1, minHeight:0}}>
          <RecordViewsModule flushTop storeKey="views:asm-tpl-v1" schema={schema} rows={rows} columns={AB_TPL_COLS.map(c => c.key)} defaultViews={[{id:'asm-tpl-all', name:'All Templates'}]} saveView={false}
            actions={() => <button onClick={()=>setCreating(true)} title="New template" aria-label="New template" style={iconBtn}><Icon name="plus" size={14} color={T.gray800}/></button>}/>
        </div>
      </SettingsPage>
      {creating && <AbNewTemplatePanel templates={templates} onCancel={()=>setCreating(false)}
        onCreate={(t)=>{ setTemplates(ts => [...ts, t]); setCreating(false); setOpenId(t.id); }}/>}
    </div>
  );
}

Object.assign(window, {AssessmentTemplatesSettings, AsmConditionBuilder, abCondClean});
