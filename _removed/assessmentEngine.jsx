/* HOF Pulse ERP — Assessment Formula System: the generic engine.

   Nothing here knows about any framework, country or business. An assessment template is DATA
   (Settings → Customer Profile); this file only reads it. A new scoring system — a points test,
   a customer-qualification score, an eligibility check — is a new template, never new code.

   ── Template ────────────────────────────────────────────────────────────────────────────────
     {id, name, description, category, enabled, versions:[Version]}
   ── Version ── one set of rules; a published version never changes (edits go into a new draft)
     {id, label, status:'draft'|'published', effectiveFrom:'YYYY-MM-DD'|null, publishedAt,
      source, notes:[…], scoreLabel, max (overall cap) | null, threshold (pass mark) | null,
      thresholdNote, groups:[{id, label}] (how inputs are grouped on the form),
      inputs:[Input], calcs:[Calc], sections:[Section], gates:[{id, label, when:Cond}]}
   ── Input ── a question
     {key, label, help, group, type:'number'|'date'|'select'|'multi'|'boolean'|'text'|'scores',
      options:[{value, label}] (select / multi), parts:[{key, label}] (scores: one number per part),
      min, max, increment, unit, required, showIf:Cond (asked only when it holds; inputs only),
      needsVerification (its answer scores only once marked verified),
      fact / factMap / factSet (filled from the person's shared facts, e.g. after a call),
      writeBack (a Contact property the answer is copied to — only when configured)}
   ── Calc ── a calculated value (inputs and other calcs; evaluated in dependency order)
     {key, label, op, …}  op: age · years · convert · min · max · sum · count · map · if · formula ·
     coalesce · condition (see CALC_OPS)
   ── Section ── a scoring section; sections nest
     {kind:'section', id, label, when:Cond, combine:'sum'|'best', caps:[{when?, value}], items:[Section | Rule]}
     `combine` 'best' is non-additive: only the highest-scoring item counts. `caps`: the first
     whose condition holds limits the section (a cap without a condition always applies).
   ── Rule ── one scoring rule
     {kind:'rule', id, label, method, priority, when:Cond, max, excludes:[ruleId], …method fields}
     methods (RULE_METHODS): exact · range · date · option · boolean · perOption · combination ·
     conditional · formula. `range` / `exact` / `option` take `inputs` (several) with `each:true`
     to apply the same table to each and add the points.
   ── Cond ── {match:'all'|'any', items:[Cond | {field, op, value}]}; a field is an input key,
     a calc key or 'scoresKey.part'. Operators: CONDITION_OPS. */

/* ── Reference data for the builder ────────────────────────────────────────────────────────── */

const INPUT_TYPES = [
  {id:'number',  label:'Number'},
  {id:'date',    label:'Date'},
  {id:'select',  label:'Single select'},
  {id:'multi',   label:'Multi-select'},
  {id:'boolean', label:'Yes / No'},
  {id:'scores',  label:'Score set (one number per part)'},
  {id:'text',    label:'Text (not scored)'},
];

/* Scoring methods, and the input types each one reads (the builder only offers what fits). */
const RULE_METHODS = [
  {id:'exact',       label:'Exact value',             inputTypes:['number', 'calc'],          desc:'Points when the value equals a number.'},
  {id:'range',       label:'Numeric range',           inputTypes:['number', 'calc', 'scores'], desc:'Points when the value falls within explicit boundaries.'},
  {id:'date',        label:'Age or date-based',       inputTypes:['date'],                    desc:'Works out an age or years since a date, then applies ranges.'},
  {id:'option',      label:'Option-based',            inputTypes:['select', 'calc'],          desc:'Points for each option.'},
  {id:'boolean',     label:'Yes / No',                inputTypes:['boolean', 'calc'],         desc:'Points for Yes and for No.'},
  {id:'perOption',   label:'Per selected option',     inputTypes:['multi'],                   desc:'Points for each option selected — added together, or the highest.'},
  {id:'combination', label:'Option combination',      inputTypes:['multi'],                   desc:'Points when a set of options is selected together.'},
  {id:'conditional', label:'Conditional',             inputTypes:null,                        desc:'Points when conditions hold (AND / OR) — first match or highest.'},
  {id:'formula',     label:'Formula',                 inputTypes:null,                        desc:'Points calculated from several values.'},
];

const CALC_OPS = [
  {id:'age',       label:'Age from a date',             desc:'Whole years from a date to the calculation date.'},
  {id:'years',     label:'Years since a date',          desc:'Whole years from a date to the calculation date.'},
  {id:'convert',   label:'Conversion table',            desc:'A number converted through ranges (optionally a table per option of another input).'},
  {id:'min',       label:'Lowest of',                   desc:'The lowest of several values.'},
  {id:'max',       label:'Highest of',                  desc:'The highest of several values.'},
  {id:'sum',       label:'Sum of',                      desc:'The values added together.'},
  {id:'count',     label:'Count of',                    desc:'How many of the values are filled in (Yes counts; No does not).'},
  {id:'map',       label:'Map options',                 desc:'Each option of an input mapped to a value.'},
  {id:'if',        label:'If / then / else',            desc:'One value when a condition holds, another when it does not.'},
  {id:'formula',   label:'Formula',                     desc:'Arithmetic over other values (+ − × ÷, min, max, round…).'},
  {id:'coalesce',  label:'First available',             desc:'The first of several values that is filled in.'},
  {id:'condition', label:'Condition (Yes / No)',        desc:'Yes when a condition holds.'},
];

const CONDITION_OPS = {
  eq:          {label:'is',                 arity:1},
  neq:         {label:'is not',             arity:1},
  in:          {label:'is any of',          arity:'list'},
  notIn:       {label:'is none of',         arity:'list'},
  gt:          {label:'is greater than',    arity:1},
  gte:         {label:'is at least',        arity:1},
  lt:          {label:'is less than',       arity:1},
  lte:         {label:'is at most',         arity:1},
  between:     {label:'is between',         arity:2},
  isYes:       {label:'is Yes',             arity:0},
  isNo:        {label:'is No',              arity:0},
  isSet:       {label:'is filled in',       arity:0},
  isEmpty:     {label:'is empty',           arity:0},
  includes:    {label:'includes',           arity:1},
  includesAll: {label:'includes all of',    arity:'list'},
  includesAny: {label:'includes any of',    arity:'list'},
};
// The operators that make sense for a kind of value.
const OPS_FOR_KIND = {
  number:  ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'in', 'isSet', 'isEmpty'],
  select:  ['eq', 'neq', 'in', 'notIn', 'isSet', 'isEmpty'],
  boolean: ['isYes', 'isNo', 'isSet', 'isEmpty'],
  multi:   ['includes', 'includesAll', 'includesAny', 'isSet', 'isEmpty'],
  text:    ['eq', 'neq', 'isSet', 'isEmpty'],
  date:    ['isSet', 'isEmpty'],
  any:     ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'in', 'notIn', 'isYes', 'isNo', 'isSet', 'isEmpty'],
};

/* ── Small helpers ─────────────────────────────────────────────────────────────────────────── */

const aIsBlank = (v) => v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'number' && isNaN(v));
const aNum = (v) => v === '' || v == null || typeof v === 'boolean' ? null : (isNaN(Number(v)) ? null : Number(v));
const aUid = (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const aTodayYmd = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const aYmdOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const aFmtYmd = (s) => { if(!s) return ''; const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}); };
const aFmtPoints = (n) => Number(n || 0).toLocaleString('en-US');

// A value by path: 'key' or 'scoresKey.part'.
function aRead(values, path){
  if(!path) return undefined;
  const [head, ...rest] = String(path).split('.');
  let v = values[head];
  for(const r of rest){ if(v == null || typeof v !== 'object') return undefined; v = v[r]; }
  return v;
}

// Whole years between a 'YYYY-MM-DD' date and the calculation date (also 'YYYY-MM-DD').
function aWholeYears(from, at){
  if(!from) return undefined;
  const [y1, m1, d1] = String(from).split('-').map(Number), [y2, m2, d2] = String(at).split('-').map(Number);
  if(!y1 || !m1 || !d1) return undefined;
  let n = y2 - y1;
  if(m2 < m1 || (m2 === m1 && d2 < d1)) n--;
  return n;
}

/* Every field a version's conditions and rules can read: its inputs (and each part of a score
   set) and its calculated values — with the kind of value (for operators) and the options. */
const FIELDS_CACHE = new WeakMap();
function versionFields(version){
  if(version && typeof version === 'object' && FIELDS_CACHE.has(version)) return FIELDS_CACHE.get(version);
  const out = [], kinds = {}, opts = {};
  (version.inputs || []).forEach(i => {
    if(i.type === 'scores') (i.parts || []).forEach(p => { out.push({key:`${i.key}.${p.key}`, label:`${i.label} — ${p.label}`, kind:'number', source:'input', input:i}); kinds[`${i.key}.${p.key}`] = 'number'; });
    const kind = i.type === 'scores' ? 'scores' : i.type;
    out.push({key:i.key, label:i.label, kind, options:i.options, source:'input', input:i});
    kinds[i.key] = kind; opts[i.key] = i.options;
  });
  // One pass in dependency order: a value that passes another through takes its kind and options.
  const {ordered} = orderCalcs(version.calcs);
  const byOrder = ordered.length === (version.calcs || []).length ? ordered : (version.calcs || []);
  byOrder.forEach(c => {
    let kind = 'number', options;
    if(c.op === 'condition') kind = 'boolean';
    else if(c.op === 'map'){
      const outs = [...new Set(Object.values(c.map || {}).concat(c.otherwise != null ? [c.otherwise] : []))];
      if(!(outs.length && outs.every(o => typeof o === 'number'))){ kind = 'select'; options = outs.map(o => ({value:o, label:String(o)})); }
    } else if(c.op === 'coalesce' || c.op === 'if'){
      const ref = c.op === 'if' ? (c.then && c.then.ref) : (c.inputs || [])[0];
      kind = (ref && kinds[ref]) || 'any'; options = ref ? opts[ref] : undefined;
    }
    kinds[c.key] = kind; opts[c.key] = options;
  });
  (version.calcs || []).forEach(c => out.push({key:c.key, label:c.label, kind:kinds[c.key] || 'number', options:opts[c.key], source:'calc', calc:c}));
  if(version && typeof version === 'object') FIELDS_CACHE.set(version, out);
  return out;
}
const fieldLabelIn = (version, key) => { const f = versionFields(version).find(x => x.key === key); return f ? f.label : key; };
const optionLabelIn = (version, key, value) => {
  const f = versionFields(version).find(x => x.key === key), o = f && (f.options || []).find(x => x.value === value);
  return o ? o.label : value === true ? 'Yes' : value === false ? 'No' : String(value);
};

/* ── Conditions ────────────────────────────────────────────────────────────────────────────── */

// A condition is empty when it has nothing to check — it always holds.
const condEmpty = (c) => !c || (c.items ? !c.items.length : !c.field);
function aCheck(cond, values){
  if(condEmpty(cond)) return true;
  if(cond.items) return cond.match === 'any' ? cond.items.some(c => condEmpty(c) || aCheck(c, values)) : cond.items.every(c => aCheck(c, values));
  const v = aRead(values, cond.field), x = cond.value;
  switch(cond.op){
    case 'isSet':   return !aIsBlank(v);
    case 'isEmpty': return aIsBlank(v);
    case 'isYes':   return v === true;
    case 'isNo':    return v === false;
  }
  if(aIsBlank(v)) return false;
  const n = aNum(v);
  switch(cond.op){
    case 'eq':    return aNum(x) != null && n != null ? n === aNum(x) : v === x;
    case 'neq':   return aNum(x) != null && n != null ? n !== aNum(x) : v !== x;
    case 'in':    return (x || []).some(o => o === v || (aNum(o) != null && aNum(o) === n));
    case 'notIn': return !(x || []).some(o => o === v || (aNum(o) != null && aNum(o) === n));
    case 'gt':    return n != null && n > aNum(x);
    case 'gte':   return n != null && n >= aNum(x);
    case 'lt':    return n != null && n < aNum(x);
    case 'lte':   return n != null && n <= aNum(x);
    case 'between': return n != null && n >= aNum((x || [])[0]) && n <= aNum((x || [])[1]);
    case 'includes':    return Array.isArray(v) && v.includes(x);
    case 'includesAll': return Array.isArray(v) && (x || []).every(o => v.includes(o));
    case 'includesAny': return Array.isArray(v) && (x || []).some(o => v.includes(o));
  }
  return false;
}
// Fields a condition reads.
const condFields = (c) => condEmpty(c) ? [] : c.items ? c.items.flatMap(condFields) : [c.field];
// A condition in words (breakdowns, "why not awarded").
function describeCond(cond, version){
  if(condEmpty(cond)) return 'Always';
  if(cond.items) return cond.items.map(c => c.items && c.items.length > 1 ? `(${describeCond(c, version)})` : describeCond(c, version)).join(cond.match === 'any' ? ' OR ' : ' AND ');
  const op = CONDITION_OPS[cond.op] || {label:cond.op};
  const val = (v) => optionLabelIn(version, cond.field, v);
  const rhs = op.arity === 0 ? '' : op.arity === 2 ? ` ${val((cond.value || [])[0])} and ${val((cond.value || [])[1])}` : op.arity === 'list' ? ` ${(cond.value || []).map(val).join(', ')}` : ` ${val(cond.value)}`;
  return `${fieldLabelIn(version, cond.field)} ${op.label}${rhs}`;
}

/* ── Formulas ── + − * / ( ) and min, max, round, floor, ceil, abs; names are field keys. ── */

function parseFormula(src){
  const toks = [];
  for(let p = 0; p < src.length;){
    const ch = src[p], rest = src.slice(p);
    if(/\s/.test(ch)){ p++; continue; }
    let m;
    if((m = /^\d+(?:\.\d+)?/.exec(rest))){ toks.push({t:'num', v:Number(m[0])}); p += m[0].length; continue; }
    if((m = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)?/.exec(rest))){ toks.push({t:'id', v:m[0]}); p += m[0].length; continue; }
    if('+-*/(),'.includes(ch)){ toks.push({t:'op', v:ch}); p++; continue; }
    throw new Error(`Unexpected “${ch}”`);
  }
  if(!toks.length) throw new Error('The formula is empty');
  let i = 0;
  const peek = () => toks[i], eat = (v) => { if(toks[i] && toks[i].v === v){ i++; return true; } return false; };
  const FN = ['min', 'max', 'round', 'floor', 'ceil', 'abs'];
  function expr(){ let n = term(); while(peek() && (peek().v === '+' || peek().v === '-')){ const op = toks[i++].v; n = {op, a:n, b:term()}; } return n; }
  function term(){ let n = unary(); while(peek() && (peek().v === '*' || peek().v === '/')){ const op = toks[i++].v; n = {op, a:n, b:unary()}; } return n; }
  function unary(){ if(eat('-')) return {op:'neg', a:unary()}; return atom(); }
  function atom(){
    const t = toks[i++];
    if(!t) throw new Error('The formula ends too early');
    if(t.t === 'num') return {num:t.v};
    if(t.t === 'id'){
      if(FN.includes(t.v) && eat('(')){ const args = []; if(!eat(')')){ do args.push(expr()); while(eat(',')); if(!eat(')')) throw new Error(`Missing ) after ${t.v}(`); } return {fn:t.v, args}; }
      return {ref:t.v};
    }
    if(t.v === '('){ const n = expr(); if(!eat(')')) throw new Error('Missing )'); return n; }
    throw new Error(`Unexpected “${t.v}”`);
  }
  const ast = expr();
  if(i < toks.length) throw new Error(`Unexpected “${toks[i].v}”`);
  return ast;
}
const formulaRefs = (ast) => !ast ? [] : ast.ref ? [ast.ref] : ast.fn ? ast.args.flatMap(formulaRefs) : [...formulaRefs(ast.a), ...formulaRefs(ast.b)];
// The value, or undefined when a value it needs is missing.
function evalFormula(ast, values){
  if(ast.num != null) return ast.num;
  if(ast.ref){ const v = aRead(values, ast.ref); return typeof v === 'boolean' ? (v ? 1 : 0) : aNum(v) ?? undefined; }
  if(ast.fn){
    const xs = ast.args.map(a => evalFormula(a, values));
    if(xs.some(x => x === undefined)) return undefined;
    return {min:Math.min, max:Math.max, round:Math.round, floor:Math.floor, ceil:Math.ceil, abs:Math.abs}[ast.fn](...xs);
  }
  const a = evalFormula(ast.a, values);
  if(ast.op === 'neg') return a === undefined ? undefined : -a;
  const b = evalFormula(ast.b, values);
  if(a === undefined || b === undefined) return undefined;
  return ast.op === '+' ? a + b : ast.op === '-' ? a - b : ast.op === '*' ? a * b : b === 0 ? undefined : a / b;
}
const safeFormula = (src) => { try { return {ast:parseFormula(String(src || ''))}; } catch(e){ return {error:e.message}; } };

/* ── Calculated values ─────────────────────────────────────────────────────────────────────── */

// Ranges: [{min?, max?, out|points}] — inclusive boundaries; a missing bound is open.
const inRange = (row, x) => (row.min == null || row.min === '' || x >= Number(row.min)) && (row.max == null || row.max === '' || x <= Number(row.max));

const CALC_EVAL = {
  age:   (c, v, at) => aWholeYears(aRead(v, c.input), at),
  years: (c, v, at) => aWholeYears(aRead(v, c.input), at),
  convert: (c, v) => {
    const x = aNum(aRead(v, c.input));
    if(x == null) return undefined;
    const key = c.tableBy ? aRead(v, c.tableBy) : '*';
    const rows = (c.tables || {})[key];
    if(!rows) return undefined;
    const row = rows.find(r => inRange(r, x));
    return row ? row.out : (c.otherwise ?? undefined);
  },
  min:   (c, v) => { const xs = (c.inputs || []).map(i => aNum(aRead(v, i))); return xs.some(x => x == null) ? undefined : Math.min(...xs); },
  max:   (c, v) => { const xs = (c.inputs || []).map(i => aNum(aRead(v, i))).filter(x => x != null); return xs.length ? Math.max(...xs) : undefined; },
  sum:   (c, v) => { const xs = (c.inputs || []).map(i => aNum(aRead(v, i))).filter(x => x != null); return xs.length ? xs.reduce((a, b) => a + b, 0) : undefined; },
  count: (c, v) => (c.inputs || []).filter(i => { const x = aRead(v, i); return x !== false && !aIsBlank(x); }).length,
  map:   (c, v) => { const x = aRead(v, c.input); return aIsBlank(x) ? undefined : ((c.map || {})[x] ?? c.otherwise ?? undefined); },
  if:    (c, v) => { const side = aCheck(c.when, v) ? c.then : c.else; return !side ? undefined : side.ref ? aRead(v, side.ref) : side.value; },
  formula: (c, v) => { const p = safeFormula(c.expression); return p.ast ? evalFormula(p.ast, v) : undefined; },
  coalesce: (c, v) => { for(const i of c.inputs || []){ const x = aRead(v, i); if(!aIsBlank(x)) return x; } return undefined; },
  condition: (c, v) => aCheck(c.when, v),
};
// What a calc reads.
function calcRefs(c){
  const base = (x) => String(x || '').split('.')[0];
  switch(c.op){
    case 'age': case 'years': case 'map': return [base(c.input)];
    case 'convert': return [base(c.input), ...(c.tableBy ? [c.tableBy] : [])];
    case 'if': return [...condFields(c.when).map(base), ...[c.then, c.else].filter(s => s && s.ref).map(s => base(s.ref))];
    case 'formula': { const p = safeFormula(c.expression); return p.ast ? formulaRefs(p.ast).map(base) : []; }
    case 'condition': return condFields(c.when).map(base);
    default: return (c.inputs || []).map(base);
  }
}
/* Calcs in dependency order; `cycle`: the keys of a circular dependency (none → null). */
function orderCalcs(calcs){
  const byKey = Object.fromEntries((calcs || []).map(c => [c.key, c]));
  const out = [], state = {};
  let cycle = null;
  const visit = (k, path) => {
    if(state[k] === 2 || cycle) return;
    if(state[k] === 1){ cycle = [...path.slice(path.indexOf(k)), k]; return; }
    state[k] = 1;
    calcRefs(byKey[k]).filter(r => byKey[r]).forEach(r => visit(r, [...path, k]));
    state[k] = 2; out.push(byKey[k]);
  };
  (calcs || []).forEach(c => visit(c.key, []));
  return {ordered:out, cycle};
}

/* ── Answers: which inputs are asked, their problems, and what may be scored ───────────────── */

// Inputs asked for these answers (follow-up questions only when their condition holds).
function visibleInputs(version, answers){
  const shown = {};
  return (version.inputs || []).filter(i => {
    const ok = condEmpty(i.showIf) || aCheck(i.showIf, shown);
    if(ok && !aIsBlank(answers[i.key])) shown[i.key] = answers[i.key];
    return ok;
  });
}
// A problem with one answer (null: fine). Required + empty is reported as missing, not here.
function inputError(input, value){
  if(aIsBlank(value)) return null;
  const range = (x, what) => {
    if(aNum(x) == null) return `${what} must be a number`;
    if(input.min != null && input.min !== '' && Number(x) < Number(input.min)) return `${what} must be at least ${input.min}`;
    if(input.max != null && input.max !== '' && Number(x) > Number(input.max)) return `${what} must be at most ${input.max}`;
    if(input.increment && Number(input.increment) > 0){
      const k = (Number(x) - Number(input.min || 0)) / Number(input.increment);
      if(Math.abs(k - Math.round(k)) > 1e-9) return `${what} must be in steps of ${input.increment}`;
    }
    return null;
  };
  switch(input.type){
    case 'number': return range(value, input.label);
    case 'scores': { for(const p of input.parts || []){ const x = value[p.key]; if(!aIsBlank(x)){ const e = range(x, `${p.label}`); if(e) return e; } } return null; }
    case 'date': { if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return 'Enter a valid date'; if(String(value) > aTodayYmd()) return 'The date cannot be in the future'; return null; }
    case 'select': return (input.options || []).some(o => o.value === value) ? null : 'Choose one of the options';
    case 'multi': return Array.isArray(value) && value.every(x => (input.options || []).some(o => o.value === x)) ? null : 'Choose from the options';
    case 'boolean': return typeof value === 'boolean' ? null : 'Answer Yes or No';
    default: return null;
  }
}
const inputFilled = (input, value) => input.type === 'scores' ? (input.parts || []).every(p => !aIsBlank((value || {})[p.key])) : !aIsBlank(value);

/* ── Rules ─────────────────────────────────────────────────────────────────────────────────── */

const ruleInputs = (r) => {
  const base = (x) => String(x || '').split('.')[0];
  switch(r.method){
    case 'conditional': return [...new Set((r.cases || []).flatMap(c => condFields(c.when)).map(base))];
    case 'formula': { const p = safeFormula(r.expression); return p.ast ? [...new Set(formulaRefs(p.ast).map(base))] : []; }
    default: return [...new Set((r.inputs && r.inputs.length ? r.inputs : [r.input]).filter(Boolean).map(base))];
  }
};
const ruleTargets = (r) => (r.inputs && r.inputs.length ? r.inputs : [r.input]).filter(Boolean);

/* One rule against the values → {points, status, reason, detail}. status: awarded · none (applies,
   0 points) · missing · unverified · invalid · notApplicable. */
function scoreRule(r, values, ctx){
  const label = r.label || 'Rule';
  if(!condEmpty(r.when) && !aCheck(r.when, values)) return {status:'notApplicable', points:0, reason:`Applies only when ${describeCond(r.when, ctx.version)}`};
  const needs = ruleInputs(r);
  const unverified = needs.filter(k => ctx.unverified.has(k));
  const invalid = needs.filter(k => ctx.invalid.has(k));
  const missingOf = (keys) => keys.filter(k => aIsBlank(aRead(values, k)));
  /* Empty values only make a rule "missing" when a required question it depends on (directly or
     through calculated values) is unanswered; an optional question left empty just scores nothing. */
  const missingResult = (keys) => {
    const req = keys.filter(k => (ctx.dependsOn(k) || []).some(x => ctx.requiredMissing.has(x)));
    return req.length ? {status:'missing', points:0, reason:`Missing ${req.map(k => fieldLabelIn(ctx.version, k)).join(', ')}`}
      : {status:'none', points:0, reason:`Not answered — ${keys.map(k => fieldLabelIn(ctx.version, k)).join(', ')}`};
  };
  const fail = () => invalid.length ? {status:'invalid', points:0, reason:`Not scored — ${invalid.map(k => fieldLabelIn(ctx.version, k)).join(', ')} has a problem`}
    : unverified.length ? {status:'unverified', points:0, reason:`Not awarded — ${unverified.map(k => fieldLabelIn(ctx.version, k)).join(', ')} is not verified`} : null;
  const cap = (p) => r.max != null && r.max !== '' ? Math.min(p, Number(r.max)) : p;
  const out = (points, detail, reason) => { const p = cap(points); return {status: p > 0 ? 'awarded' : 'none', points:p, detail, reason, capped: p < points}; };

  switch(r.method){
    case 'exact': case 'range': case 'option': {
      const f = fail(); if(f) return f;
      const targets = ruleTargets(r), miss = missingOf(targets);
      if(miss.length === targets.length || (!r.each && miss.length)) return missingResult(miss);
      const one = (k) => {
        const x = aRead(values, k);
        if(aIsBlank(x)) return {key:k, points:0, missing:true};
        if(r.method === 'option') return {key:k, value:x, points:Number((r.points || {})[x] ?? 0)};
        const n = aNum(x);
        if(r.method === 'exact'){ const row = (r.rows || []).find(rw => aNum(rw.value) === n); return {key:k, value:x, points:row ? Number(row.points) : 0}; }
        const row = (r.rows || []).find(rw => inRange(rw, n));
        return {key:k, value:x, points:row ? Number(row.points) : 0, row};
      };
      const parts = targets.map(one), pts = parts.reduce((s, p) => s + p.points, 0);
      const detail = parts.map(p => `${fieldLabelIn(ctx.version, p.key)}: ${p.missing ? '—' : optionLabelIn(ctx.version, p.key, p.value)} → ${p.points}`).join(' · ');
      const partial = miss.length ? `${miss.length} value${miss.length === 1 ? '' : 's'} missing` : undefined;
      return {...out(pts, detail), ...(partial ? {reason:partial} : {})};
    }
    case 'date': {
      const f = fail(); if(f) return f;
      const raw = aRead(values, r.input);
      if(aIsBlank(raw)) return missingResult([r.input]);
      const n = aWholeYears(raw, ctx.at);
      const row = (r.rows || []).find(rw => inRange(rw, n));
      return out(row ? Number(row.points) : 0, `${r.measure === 'years' ? 'Years since' : 'Age'}: ${n} → ${row ? row.points : 0}`);
    }
    case 'boolean': {
      const f = fail(); if(f) return f;
      const x = aRead(values, r.input);
      if(aIsBlank(x)) return missingResult([r.input]);
      return out(Number(x === true ? r.yes || 0 : r.no || 0), `${fieldLabelIn(ctx.version, r.input)}: ${x === true ? 'Yes' : 'No'}`);
    }
    case 'perOption': {
      const f = fail(); if(f) return f;
      const x = aRead(values, r.input);
      if(aIsBlank(x)) return missingResult([r.input]);
      const each = (x || []).map(o => ({o, p:Number((r.points || {})[o] ?? 0)}));
      const pts = r.aggregate === 'max' ? Math.max(0, ...each.map(e => e.p)) : each.reduce((s, e) => s + e.p, 0);
      return out(pts, each.map(e => `${optionLabelIn(ctx.version, r.input, e.o)} → ${e.p}`).join(' · '));
    }
    case 'combination': {
      const f = fail(); if(f) return f;
      const x = aRead(values, r.input);
      if(aIsBlank(x)) return missingResult([r.input]);
      const hits = (r.combos || []).filter(cb => cb.match === 'exact'
        ? cb.options.length === x.length && cb.options.every(o => x.includes(o)) : cb.options.every(o => x.includes(o)));
      const hit = r.pick === 'max' ? [...hits].sort((a, b) => b.points - a.points)[0] : hits[0];
      return out(hit ? Number(hit.points) : 0, hit ? `Matched: ${hit.options.map(o => optionLabelIn(ctx.version, r.input, o)).join(' + ')}` : 'No combination matched');
    }
    case 'conditional': {
      const f = fail(); if(f) return f;
      const hits = (r.cases || []).filter(cs => aCheck(cs.when, values));
      const hit = r.pick === 'max' ? [...hits].sort((a, b) => b.points - a.points)[0] : hits[0];
      if(!hit){
        const miss = missingOf(needs);
        if(miss.length) return missingResult(miss);
        return {status:'none', points:0, reason:'No case matched'};
      }
      return out(Number(hit.points), hit.label || describeCond(hit.when, ctx.version));
    }
    case 'formula': {
      const f = fail(); if(f) return f;
      const p = safeFormula(r.expression);
      if(p.error) return {status:'invalid', points:0, reason:`Formula error — ${p.error}`};
      const x = evalFormula(p.ast, values);
      if(x === undefined) return missingResult(missingOf(needs).length ? missingOf(needs) : needs);
      return out(Math.max(0, Math.round(x)), `${r.expression} = ${Math.round(x * 100) / 100}`);
    }
  }
  return {status:'invalid', points:0, reason:'Unknown scoring method'};
}

/* ── Sections ──────────────────────────────────────────────────────────────────────────────── */

const capOf = (caps, values) => { const c = (caps || []).find(x => condEmpty(x.when) || aCheck(x.when, values)); return c && c.value !== '' && c.value != null ? Number(c.value) : null; };

function scoreSection(s, values, ctx){
  if(!condEmpty(s.when) && !aCheck(s.when, values))
    return {kind:'section', id:s.id, label:s.label, status:'notApplicable', points:0, raw:0, reason:`Applies only when ${describeCond(s.when, ctx.version)}`, items:[]};
  // Rules by priority (highest first); sections keep their place.
  const order = (s.items || []).map((it, i) => ({it, i})).sort((a, b) => (b.it.kind === 'rule' ? Number(b.it.priority || 0) : 0) - (a.it.kind === 'rule' ? Number(a.it.priority || 0) : 0) || a.i - b.i);
  const awarded = [], results = [];
  order.forEach(({it, i}) => {
    if(it.kind === 'section'){ results[i] = scoreSection(it, values, ctx); return; }
    let res = {kind:'rule', id:it.id, label:it.label, method:it.method, priority:it.priority, ...scoreRule(it, values, ctx)};
    if(res.points > 0){
      const by = awarded.find(a => (a.excludes || []).includes(it.id) || (it.excludes || []).includes(a.id));
      if(by) res = {...res, status:'excluded', excludedPoints:res.points, points:0, reason:`Not counted — “${by.label}” already applies (they can't both score)`};
      else awarded.push(it);
    }
    results[i] = res;
  });
  const items = results;
  const counted = items.filter(x => x.status !== 'notApplicable');
  let raw;
  if(s.combine === 'best'){
    const best = counted.reduce((b, x) => !b || x.points > b.points ? x : b, null);
    raw = best ? best.points : 0;
    items.forEach(x => { if(best && x !== best && x.points > 0){ x.notBest = true; x.reasonBest = `Not counted — only the highest item in “${s.label}” counts`; } });
  } else raw = counted.reduce((sum, x) => sum + x.points, 0);
  const cap = capOf(s.caps, values);
  const points = cap != null ? Math.min(raw, cap) : raw;
  return {kind:'section', id:s.id, label:s.label, combine:s.combine || 'sum', cap, raw, points, capped: cap != null && raw > cap, items, status:'scored'};
}

/* ── Evaluate ──────────────────────────────────────────────────────────────────────────────── */

/* An assessment: `answers` {inputKey: value}, `verified` {inputKey: true}, `at` the calculation
   date ('YYYY-MM-DD'). Returns the full, explainable result. Hidden follow-up questions, invalid
   answers and unverified answers never score. */
function evaluateAssessment(version, answers = {}, {verified = {}, at = aTodayYmd()} = {}){
  const visible = visibleInputs(version, answers);
  const errors = [], missing = [], unverified = new Set(), invalid = new Set();
  const values = {};
  visible.forEach(i => {
    const v = answers[i.key];
    const err = inputError(i, v);
    if(err){ errors.push({key:i.key, label:i.label, message:err}); invalid.add(i.key); return; }
    if(i.type === 'scores' && v && typeof v === 'object'){ const part = Object.fromEntries((i.parts || []).filter(p => !aIsBlank(v[p.key])).map(p => [p.key, Number(v[p.key])])); if(Object.keys(part).length) values[i.key] = part; }
    else if(!aIsBlank(v)) values[i.key] = i.type === 'number' ? Number(v) : v;
    if(i.required && !inputFilled(i, v)) missing.push({key:i.key, label:i.label});
    if(i.needsVerification && !aIsBlank(v) && !verified[i.key]) unverified.add(i.key);
  });
  // Unverified answers don't feed calculated values either (no unsupported points by another route).
  unverified.forEach(k => { delete values[k]; });
  const {ordered, cycle} = orderCalcs(version.calcs);
  if(cycle) errors.push({key:cycle[0], label:'Calculated values', message:`Circular calculation: ${cycle.join(' → ')}`});
  else ordered.forEach(c => { const fn = CALC_EVAL[c.op]; const x = fn ? fn(c, values, at) : undefined; if(x !== undefined && !(typeof x === 'number' && isNaN(x))) values[c.key] = x; });
  // Calcs that read an unverified / invalid input are themselves unverified / invalid.
  const taint = (set) => { let grew = true; while(grew){ grew = false; ordered.forEach(c => { if(!set.has(c.key) && calcRefs(c).some(r => set.has(r))){ set.add(c.key); grew = true; } }); } };
  taint(unverified); taint(invalid);
  // Which inputs each value comes from (calculated values: through what they read).
  const calcByKey = Object.fromEntries((version.calcs || []).map(c => [c.key, c]));
  const depMemo = {};
  const dependsOn = (k) => {
    const key = String(k).split('.')[0];
    if(depMemo[key]) return depMemo[key];
    depMemo[key] = [key];
    if(calcByKey[key]) depMemo[key] = [...new Set(calcRefs(calcByKey[key]).flatMap(dependsOn))];
    return depMemo[key];
  };
  const ctx = {version, at, unverified, invalid, dependsOn, requiredMissing:new Set(missing.map(m => m.key))};
  const sections = cycle ? [] : (version.sections || []).map(s => scoreSection(s, values, ctx));
  const raw = sections.reduce((s, x) => s + x.points, 0);
  const max = version.max != null && version.max !== '' ? Number(version.max) : null;
  const total = max != null ? Math.min(raw, max) : raw;
  const gates = (version.gates || []).map(g => ({id:g.id, label:g.label, met:aCheck(g.when, values)}));
  // Rules that couldn't score for missing values point at what to ask next.
  const ruleMissing = [];
  const walk = (s) => (s.items || []).forEach(x => x.kind === 'section' ? walk(x) : x.status === 'missing' && ruleMissing.push(x));
  sections.forEach(walk);
  return {total, raw, max, capped: max != null && raw > max, threshold:version.threshold ?? null,
          passesThreshold: version.threshold == null || version.threshold === '' ? null : total >= Number(version.threshold),
          gates, gatesMet:gates.every(g => g.met), sections, values, errors, missing, ruleMissing:ruleMissing.map(r => r.label),
          unverified:[...unverified].filter(k => (version.inputs || []).some(i => i.key === k)).map(k => ({key:k, label:fieldLabelIn(version, k)})),
          complete: !missing.length && !errors.length, at};
}

/* ── Maximum possible ── the declared overall maximum, else each section's best case. ───────── */
function versionMaxPoints(version){
  if(version.max != null && version.max !== '') return Number(version.max);
  const ruleMax = (r) => {
    const top = (xs) => Math.max(0, ...xs.map(Number).filter(x => !isNaN(x)));
    const n = (r.inputs && r.inputs.length) || 1;
    const v = r.method === 'range' || r.method === 'date' || r.method === 'exact' ? top((r.rows || []).map(x => x.points)) * (r.each ? n : 1)
      : r.method === 'option' ? top(Object.values(r.points || {})) * (r.each ? n : 1)
      : r.method === 'boolean' ? top([r.yes, r.no])
      : r.method === 'perOption' ? (r.aggregate === 'max' ? top(Object.values(r.points || {})) : Object.values(r.points || {}).reduce((s, x) => s + Math.max(0, Number(x) || 0), 0))
      : r.method === 'combination' ? top((r.combos || []).map(c => c.points))
      : r.method === 'conditional' ? top((r.cases || []).map(c => c.points)) : (r.max != null ? Number(r.max) : 0);
    return r.max != null && r.max !== '' ? Math.min(v, Number(r.max)) : v;
  };
  const secMax = (s) => {
    const xs = (s.items || []).map(it => it.kind === 'section' ? secMax(it) : ruleMax(it));
    const raw = s.combine === 'best' ? Math.max(0, ...xs) : xs.reduce((a, b) => a + b, 0);
    const caps = (s.caps || []).map(c => Number(c.value)).filter(x => !isNaN(x));
    return caps.length ? Math.min(raw, Math.max(...caps)) : raw;
  };
  return (version.sections || []).reduce((s, x) => s + secMax(x), 0);
}

/* ── Validation ── what keeps a version from being published (errors) or deserves a look
   (warnings): unknown references, duplicate keys, circular calculations, overlapping or gapped
   ranges, options that don't exist, formulas that don't parse. ────────────────────────────── */
function validateVersion(version){
  const errors = [], warnings = [];
  const add = (list, where, message) => list.push({where, message});
  const keys = new Set(), fieldKeys = new Set(versionFields(version).map(f => f.key));
  [...(version.inputs || []), ...(version.calcs || [])].forEach(x => {
    if(!x.key) add(errors, x.label || 'A field', 'has no key');
    else if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(x.key)) add(errors, x.label || x.key, `key “${x.key}” may use letters, digits and _ only`);
    if(keys.has(x.key)) add(errors, x.label || x.key, `key “${x.key}” is used twice`);
    keys.add(x.key);
  });
  const knownField = (k) => fieldKeys.has(k) || fieldKeys.has(String(k).split('.')[0]);
  const checkCondRefs = (c, where) => condFields(c).forEach(f => { if(!knownField(f)) add(errors, where, `refers to “${f}”, which doesn't exist`); });
  (version.inputs || []).forEach((i, idx) => {
    const where = `Input “${i.label || i.key}”`;
    if(['select', 'multi'].includes(i.type) && !(i.options || []).length) add(errors, where, 'has no options');
    if(i.type === 'scores' && !(i.parts || []).length) add(errors, where, 'has no parts');
    if(!condEmpty(i.showIf)){
      condFields(i.showIf).forEach(f => {
        const base = String(f).split('.')[0], at = (version.inputs || []).findIndex(x => x.key === base);
        if(at < 0) add(errors, where, `is shown based on “${f}”, which isn't an input`);
        else if(at >= idx) add(errors, where, `is shown based on “${f}”, which is asked later — move it after that question`);
      });
    }
  });
  const {cycle} = orderCalcs(version.calcs);
  if(cycle) add(errors, 'Calculated values', `circular calculation: ${cycle.join(' → ')}`);
  (version.calcs || []).forEach(c => {
    const where = `Calculated value “${c.label || c.key}”`;
    calcRefs(c).forEach(r => { if(r && !knownField(r)) add(errors, where, `refers to “${r}”, which doesn't exist`); });
    if(c.op === 'formula'){ const p = safeFormula(c.expression); if(p.error) add(errors, where, `formula: ${p.error}`); }
    if(c.op === 'convert') Object.entries(c.tables || {}).forEach(([k, rows]) => rangeProblems(rows, null).forEach(m => add(m.error ? errors : warnings, `${where} (${k})`, m.text)));
  });
  const ruleIds = new Set();
  const walk = (items, path) => (items || []).forEach(it => {
    if(it.kind === 'section'){
      const where = `Section “${path}${it.label}”`;
      checkCondRefs(it.when, where);
      (it.caps || []).forEach(c => { checkCondRefs(c.when, where); if(c.value === '' || isNaN(Number(c.value))) add(errors, where, 'has a cap without a number'); });
      if(!(it.items || []).length) add(warnings, where, 'has no rules');
      walk(it.items, `${path}${it.label} › `);
      return;
    }
    const where = `Rule “${path}${it.label || it.id}”`;
    if(ruleIds.has(it.id)) add(errors, where, 'has a duplicate id'); ruleIds.add(it.id);
    checkCondRefs(it.when, where);
    (it.excludes || []).forEach(x => { if(!allRuleIds(version).includes(x)) add(errors, where, `excludes a rule that doesn't exist (${x})`); });
    ruleInputs(it).forEach(r => { if(r && !knownField(r)) add(errors, where, `reads “${r}”, which doesn't exist`); });
    if(['exact', 'range', 'option', 'boolean', 'perOption', 'combination', 'date'].includes(it.method) && !ruleTargets(it).length) add(errors, where, 'has no input');
    const target = versionFields(version).find(f => f.key === ruleTargets(it)[0]);
    if(it.method === 'range' || it.method === 'date'){
      const inc = target && target.input && target.input.increment ? Number(target.input.increment) : 1;
      rangeProblems(it.rows, inc).forEach(m => add(m.error ? errors : warnings, where, m.text));
    }
    if(it.method === 'option' && target && target.options){
      Object.keys(it.points || {}).forEach(o => { if(!target.options.some(x => String(x.value) === o)) add(errors, where, `scores option “${o}”, which the input doesn't have`); });
      const unscored = target.options.filter(o => !(String(o.value) in (it.points || {})));
      if(unscored.length) add(warnings, where, `gives no points for ${unscored.map(o => o.label).join(', ')} — check that's intended`);
    }
    if(it.method === 'conditional'){ if(!(it.cases || []).length) add(errors, where, 'has no cases'); (it.cases || []).forEach(c => checkCondRefs(c.when, where)); }
    if(it.method === 'formula'){ const p = safeFormula(it.expression); if(p.error) add(errors, where, `formula: ${p.error}`); }
    if(it.method === 'combination' && !(it.combos || []).length) add(errors, where, 'has no combinations');
  });
  walk(version.sections, '');
  (version.gates || []).forEach(g => checkCondRefs(g.when, `Requirement “${g.label}”`));
  if(!(version.sections || []).length) add(errors, 'Scoring', 'has no sections');
  if(version.max == null || version.max === '') add(warnings, 'Overall maximum', 'is not set — the total is not capped');
  return {errors, warnings, ok:!errors.length};
}
const allRuleIds = (version) => { const ids = []; const walk = (items) => (items || []).forEach(it => it.kind === 'section' ? walk(it.items) : ids.push(it.id)); walk(version.sections); return ids; };
const allRules = (version) => { const out = []; const walk = (items, path) => (items || []).forEach(it => it.kind === 'section' ? walk(it.items, [...path, it.label]) : out.push({rule:it, path})); walk(version.sections, []); return out; };
/* Ranges: overlaps are errors; gaps (with the input's increment) and open-ended gaps are warnings. */
function rangeProblems(rows, increment){
  const out = [], rs = (rows || []).map((r, i) => ({i, min: r.min === '' || r.min == null ? -Infinity : Number(r.min), max: r.max === '' || r.max == null ? Infinity : Number(r.max)}));
  rs.forEach(r => { if(r.min > r.max) out.push({error:true, text:`row ${r.i + 1}: the lower boundary is above the upper boundary`}); });
  const sorted = [...rs].sort((a, b) => a.min - b.min);
  for(let k = 1; k < sorted.length; k++){
    const a = sorted[k - 1], b = sorted[k];
    if(b.min <= a.max) out.push({error:true, text:`rows ${a.i + 1} and ${b.i + 1} overlap`});
    else if(increment && b.min - a.max > increment + 1e-9) out.push({error:false, text:`gap between ${a.max} and ${b.min} — values there score nothing`});
  }
  return out;
}

/* ── Templates and versions ────────────────────────────────────────────────────────────────── */

const publishedVersions = (t) => (t.versions || []).filter(v => v.status === 'published');
// The published version in effect on a date: the latest effective date on or before it.
function effectiveVersion(t, at = aTodayYmd()){
  return publishedVersions(t).filter(v => !v.effectiveFrom || v.effectiveFrom <= at)
    .sort((a, b) => String(b.effectiveFrom || '').localeCompare(String(a.effectiveFrom || '')))[0] || null;
}
// The next published version that takes effect after the date (scheduled).
const scheduledVersion = (t, at = aTodayYmd()) => publishedVersions(t).filter(v => v.effectiveFrom && v.effectiveFrom > at).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0] || null;
const draftVersion = (t) => (t.versions || []).find(v => v.status === 'draft') || null;
const versionById = (templates, templateId, versionId) => { const t = (templates || []).find(x => x.id === templateId); return t && (t.versions || []).find(v => v.id === versionId); };
// Templates people can use in Customer Profiles today.
const usableTemplates = (templates, at = aTodayYmd()) => (templates || []).filter(t => t.enabled && effectiveVersion(t, at));
// A deep copy with fresh ids (duplicate template / new draft from a version).
const cloneVersion = (v, patch = {}) => ({...JSON.parse(JSON.stringify(v)), id:aUid('ver'), status:'draft', publishedAt:null, ...patch});

/* ── The person's shared facts → a version's answers (inputs linked to the fact library) ──── */
function answersFromFacts(version, facts = {}){
  const out = {};
  const factVal = (k) => { const f = facts[k]; if(!f || f.status === 'notFound') return undefined; return typeof f === 'object' && 'value' in f ? f.value : f; };
  (version.inputs || []).forEach(i => {
    if(!i.fact) return;
    const ks = Array.isArray(i.fact) ? i.fact : [i.fact];
    let v;
    if(ks.length > 1){ const xs = ks.map(factVal).filter(x => x != null && x !== ''); v = xs.length ? xs.reduce((a, b) => Number(a) + Number(b), 0) : undefined; }
    else v = factVal(ks[0]);
    if(v === undefined) return;
    if(i.factMap) v = i.factMap[String(v)];
    if(v === undefined) return;
    out[i.key] = v;
    Object.entries(i.factSet || {}).forEach(([k, x]) => { if(out[k] === undefined) out[k] = x; });
  });
  return out;
}
// The fact-library keys a version reads (what a call is searched for).
const versionFactKeys = (version) => [...new Set((version.inputs || []).flatMap(i => i.fact ? (Array.isArray(i.fact) ? i.fact : [i.fact]) : []))];

Object.assign(window, {
  INPUT_TYPES, RULE_METHODS, CALC_OPS, CONDITION_OPS, OPS_FOR_KIND,
  aIsBlank, aNum, aUid, aTodayYmd, aYmdOf, aFmtYmd, aFmtPoints, aRead, aWholeYears, aCheck, condEmpty, condFields, describeCond,
  parseFormula, safeFormula, evalFormula, formulaRefs, orderCalcs, calcRefs, versionFields, fieldLabelIn, optionLabelIn,
  visibleInputs, inputError, inputFilled, ruleInputs, ruleTargets, evaluateAssessment, versionMaxPoints, validateVersion, rangeProblems,
  allRuleIds, allRules, publishedVersions, effectiveVersion, scheduledVersion, draftVersion, versionById, usableTemplates, cloneVersion,
  answersFromFacts, versionFactKeys,
});
