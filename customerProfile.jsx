/* HOF Pulse ERP — Customer Profile forms.

   Settings → Customer Profile: forms that define what we collect about a customer, built with the
   same builder as Marketing → Forms (FormFieldsList, FormPreview — forms.jsx): fields of any field
   type, their labels and options, in order — plus, per field, Show only when (asked only when an
   earlier field has one of chosen answers: spouse questions only when there's a spouse coming).
   Nothing is scored or calculated (Canada CRS Assessment's CRS Score is recorded from an external
   calculator).

   Customer Profile tab: one filled form per person per form (the contact — shown on their deals
   and customers too). Fill from sources runs the person's calls, notes and emails against the form,
   with nothing to set up: a field is filled when its label names a fact the system recognises in
   conversation (profileEngine.jsx PROFILE_FIELD_NAMES — "Highest completed education"), or when a
   source has a "Label: value" line for it ("Date of birth: 14 March 1994"). The user reviews,
   corrects and completes; each answer keeps where it came from. A person's Customer Profile is off
   until templates (Canada CRS Score, Australia Points System, US NIW, Customer Strength…) are
   enabled for them — one or more, more later (Enable More); the tab moves between the enabled
   ones, the one shown being the person's Customer Profile Type. */

/* ── Store ─────────────────────────────────────────────────────────────────────────────────── */
const ProfileFormsCtx = React.createContext(null);
const useProfileForms = () => React.useContext(ProfileFormsCtx);
let PROFILE_FORMS_LIVE = [];   // the forms in use (workflows read their fields)
const setProfileFormsLive = (forms) => { PROFILE_FORMS_LIVE = forms || []; };

const PF_SOURCE = {
  call:   {label:'Call'},
  notes:  {label:'Notes'},
  email:  {label:'Email'},
  note:   {label:'Note'},
  transcript:{label:'Transcript'},
  manual: {label:'Manual'},
};

/* ── The Canada CRS Assessment form ────────────────────────────────────────────────────────── */
const PF_TESTS = ['CELPIP-General', 'IELTS General Training', 'PTE Core', 'TEF Canada', 'TCF Canada'];
const PF_EDUCATION = ['Less than secondary school', 'Secondary diploma (high school)', 'One-year post-secondary credential', 'Two-year post-secondary credential',
  "Bachelor's degree or a program of three or more years", 'Two or more credentials, one of three or more years', "Master's or licensed professional degree", 'Doctoral degree (PhD)'];
const pfField = (id, label, type, extra = {}) => ({id, label, type, required:false, options:[], mapTo:'', ...extra});
const PF_ABILITIES = [['reading', 'Reading'], ['writing', 'Writing'], ['listening', 'Listening'], ['speaking', 'Speaking']];
const pfScores = (prefix, who, showIf) => PF_ABILITIES.map(([part, name]) => pfField(`${prefix}-${part}`, `${who} — ${name} score`, 'Number', {showIf}));
// Canadian Language Benchmark levels — recorded as stated or confirmed, never worked out here.
const pfClb = (prefix, who) => PF_ABILITIES.map(([part, name]) => pfField(`${prefix}-clb-${part}`, `${who} — ${name} CLB level`, 'Number'));
const SEED_PROFILE_FORMS = () => {
  const married = {fieldId:'crs-marital', values:['Married', 'Common-law']};
  const spouseComing = {fieldId:'crs-spouse-coming', values:['Yes']};
  return [{
    id:'pf-canada-crs', name:'Canada CRS Score', createdBy:'System', createdAt:'2026-10-28T09:00:00.000Z',
    description:'What we need for an Express Entry (CRS) assessment. The CRS score itself is calculated in an external tool and recorded here.',
    fields:[
      pfField('crs-age', 'Age', 'Number'),
      pfField('crs-marital', 'Marital status', 'Single Selection', {options:['Never married / single', 'Married', 'Common-law', 'Divorced / separated', 'Widowed']}),
      pfField('crs-spouse-pr', 'Spouse or partner is a Canadian citizen or permanent resident', 'Boolean', {showIf:married}),
      pfField('crs-spouse-coming', 'Spouse or partner will come with you to Canada', 'Single Selection', {options:['Yes', 'No'], showIf:married}),
      pfField('crs-education', 'Highest completed education', 'Single Selection', {options:PF_EDUCATION}),
      pfField('crs-first-lang', 'First official language', 'Single Selection', {options:['English', 'French']}),
      pfField('crs-first-test', 'First official language — test', 'Single Selection', {options:PF_TESTS}),
      ...pfScores('crs-first', 'First official language', null),
      ...pfClb('crs-first', 'First official language'),
      pfField('crs-second-test', 'Second official language — test', 'Single Selection', {options:['No second language test', ...PF_TESTS]}),
      ...pfScores('crs-second', 'Second official language', {fieldId:'crs-second-test', values:PF_TESTS}),
      pfField('crs-cwe', 'Canadian work experience (years, skilled, last 10 years)', 'Number'),
      pfField('crs-fwe', 'Foreign work experience (years, skilled, last 10 years)', 'Number'),
      pfField('crs-spouse-education', 'Spouse — highest completed education', 'Single Selection', {options:PF_EDUCATION, showIf:spouseComing}),
      pfField('crs-spouse-test', 'Spouse — language test', 'Single Selection', {options:['No language test', ...PF_TESTS], showIf:spouseComing}),
      ...pfScores('crs-spouse', 'Spouse', {fieldId:'crs-spouse-test', values:PF_TESTS}),
      pfField('crs-spouse-cwe', 'Spouse — Canadian work experience (years)', 'Number', {showIf:spouseComing}),
      pfField('crs-canada-study', 'Canadian post-secondary education', 'Single Selection', {options:['None', 'One- or two-year credential', 'Three years or longer']}),
      pfField('crs-french', 'French-language proficiency', 'Single Selection', {options:['NCLC 7 or higher in all four abilities', 'Below NCLC 7', 'No French test']}),
      pfField('crs-sibling', 'Brother or sister in Canada (citizen or permanent resident, 18 or older)', 'Boolean'),
      pfField('crs-nomination', 'Provincial or territorial nomination', 'Boolean'),
      pfField('crs-score', 'CRS Score', 'Number'),
    ],
  }, {
    id:'pf-australia-points', name:'Australia Points System', createdBy:'System', createdAt:'2026-10-29T09:00:00.000Z',
    description:'What we need for an Australian skilled migration points assessment. The points score is calculated in an external tool and recorded here.',
    fields:[
      pfField('au-age', 'Age', 'Number'),
      pfField('au-marital', 'Marital status', 'Single Selection', {options:['Single', 'Married', 'De facto', 'Divorced / separated', 'Widowed']}),
      pfField('au-partner-coming', 'Partner will come with you to Australia', 'Single Selection', {options:['Yes', 'No'], showIf:{fieldId:'au-marital', values:['Married', 'De facto']}}),
      pfField('au-test', 'English test', 'Single Selection', {options:['IELTS', 'PTE Academic', 'TOEFL iBT', 'Cambridge C1 Advanced', 'OET']}),
      ...PF_ABILITIES.map(([part, name]) => pfField(`au-${part}`, `English test — ${name} score`, 'Number')),
      pfField('au-english-level', 'English level', 'Single Selection', {options:['Superior', 'Proficient', 'Competent', 'Below competent']}),
      pfField('au-qualification', 'Highest qualification', 'Single Selection', {options:['Doctorate', "Bachelor's or Master's degree", 'Diploma or trade qualification', 'Other recognised qualification', 'None']}),
      pfField('au-overseas-work', 'Overseas work experience (years, skilled, last 10 years)', 'Number'),
      pfField('au-australian-work', 'Australian work experience (years, skilled, last 10 years)', 'Number'),
      pfField('au-australian-study', 'Australian study requirement met', 'Boolean'),
      pfField('au-specialist', 'Specialist education qualification (STEM, Australian)', 'Boolean'),
      pfField('au-professional-year', 'Professional Year completed in Australia', 'Boolean'),
      pfField('au-community-language', 'Credentialled community language (NAATI)', 'Boolean'),
      pfField('au-regional', 'Study in regional Australia', 'Boolean'),
      pfField('au-nomination', 'State or territory nomination', 'Single Selection', {options:['None', 'Subclass 190', 'Subclass 491']}),
      pfField('au-points', 'Points score', 'Number'),
    ],
  }, {
    /* Canada's Federal Skilled Worker Program (Express Entry): eligibility is scored on six selection
       factors out of 100 — language, education, work experience, age, arranged employment,
       adaptability (pass mark 67) — on top of the minimums (skilled experience, CLB 7, funds). */
    id:'pf-fsw', name:'Federal Skilled Worker Program', createdBy:'System', createdAt:'2026-10-30T09:00:00.000Z',
    description:'What we need for a Federal Skilled Worker Program eligibility assessment (six selection factors, out of 100 points; pass mark 67). The points are calculated in an external tool and recorded here.',
    fields:[
      pfField('fsw-age', 'Age', 'Number'),
      pfField('fsw-marital', 'Marital status', 'Single Selection', {options:['Never married / single', 'Married', 'Common-law', 'Divorced / separated', 'Widowed']}),
      pfField('fsw-spouse-coming', 'Spouse or partner will come with you to Canada', 'Single Selection', {options:['Yes', 'No'], showIf:{fieldId:'fsw-marital', values:['Married', 'Common-law']}}),
      pfField('fsw-family-size', 'Family size (including you)', 'Number'),
      pfField('fsw-education', 'Highest completed education', 'Single Selection', {options:PF_EDUCATION}),
      pfField('fsw-eca', 'Educational Credential Assessment (ECA) completed', 'Boolean'),
      pfField('fsw-first-lang', 'First official language', 'Single Selection', {options:['English', 'French']}),
      pfField('fsw-first-test', 'First official language — test', 'Single Selection', {options:PF_TESTS}),
      ...pfScores('fsw-first', 'First official language', null),
      ...pfClb('fsw-first', 'First official language'),
      pfField('fsw-second-test', 'Second official language — test', 'Single Selection', {options:['No second language test', ...PF_TESTS]}),
      ...pfScores('fsw-second', 'Second official language', {fieldId:'fsw-second-test', values:PF_TESTS}),
      pfField('fsw-occupation', 'Primary occupation (NOC, TEER 0–3)', 'Single-Line Text'),
      pfField('fsw-work', 'Skilled work experience (years, TEER 0–3, last 10 years)', 'Number'),
      pfField('fsw-job-offer', 'Arranged employment — valid job offer in Canada', 'Boolean'),
      pfField('fsw-spouse-language', 'Spouse — CLB 4 or higher in all four abilities', 'Boolean', {showIf:{fieldId:'fsw-spouse-coming', values:['Yes']}}),
      pfField('fsw-canada-study', 'Studied in Canada (2+ years, full-time)', 'Boolean'),
      pfField('fsw-canada-work', 'Worked in Canada (1+ year, full-time, skilled)', 'Boolean'),
      pfField('fsw-spouse-canada', 'Spouse — studied or worked in Canada', 'Boolean', {showIf:{fieldId:'fsw-spouse-coming', values:['Yes']}}),
      pfField('fsw-relative', 'Relative in Canada (18 or older, citizen or permanent resident)', 'Boolean'),
      pfField('fsw-funds', 'Settlement funds available (CAD)', 'Number'),
      pfField('fsw-points', 'FSW Points (out of 100)', 'Number'),
    ],
  }, {
    id:'pf-us-niw', name:'US NIW', createdBy:'System', createdAt:'2026-10-29T09:00:00.000Z',
    description:'What we need to prepare a US National Interest Waiver (EB-2 NIW) case.',
    fields:[
      pfField('niw-age', 'Age', 'Number'),
      pfField('niw-profession', 'Profession or field of endeavor', 'Single-Line Text'),
      pfField('niw-degree', 'Highest degree', 'Single Selection', {options:['Doctorate (PhD)', "Master's degree", "Bachelor's degree plus 5 years' progressive experience", "Bachelor's degree", 'Other']}),
      pfField('niw-experience', 'Years of experience in the field', 'Number'),
      pfField('niw-endeavor', 'Proposed endeavor in the US', 'Multi-Line Text'),
      pfField('niw-publications', 'Publications', 'Number'),
      pfField('niw-citations', 'Citations', 'Number'),
      pfField('niw-patents', 'Patents', 'Number'),
      pfField('niw-awards', 'Awards or recognition', 'Multi-Line Text'),
      pfField('niw-letters', 'Recommendation letters available', 'Number'),
      pfField('niw-employer', 'Current employer and role', 'Single-Line Text'),
    ],
  }, {
    id:'pf-customer-strength', name:'Customer Strength', createdBy:'System', createdAt:'2026-10-29T09:00:00.000Z',
    description:'How ready the customer is to pay.',
    fields:[
      pfField('cs-willing', 'Is the customer willing to pay?', 'Single Selection', {options:['Yes', 'No', 'Undecided']}),
      pfField('cs-when', 'When does the customer expect to pay?', 'Single Selection', {options:['This month', 'Next month', 'This year']}),
      pfField('cs-rating', 'How would you rate the customer financially?', 'Single Selection', {options:['Good', 'Average', 'Poor']}),
    ],
  }];
};
// Fields of shipped forms taken out since (Date of birth: Age is asked instead, for now).
const PF_REMOVED_SEED_FIELDS = ['crs-dob'];
// Shipped forms renamed since, from their old name.
const PF_RENAMED_FORMS = {'pf-canada-crs':{from:'Canada CRS Assessment', to:'Canada CRS Score'}};
// Forms saved before stay as saved; forms shipped since are added.
/* Fields saved with Required or a Fill from link (since removed) lose them. A shipped form saved
   before gets the fields shipped since (Age, the CLB levels), each after the field it follows. */
const withSeedProfileForms = (saved) => {
  // A CRM instance made from a template has its template's forms instead (workspaces.jsx).
  const tpl = crmTemplate();
  const seeds = tpl ? (tpl.profileForms ? tpl.profileForms() : []) : SEED_PROFILE_FORMS();
  if(!saved) return seeds;
  const clean = saved.map(f => {
    let fields = (f.fields || []).filter(x => !PF_REMOVED_SEED_FIELDS.includes(x.id)).map(({fill, ...x}) => ({...x, required:false}));
    const seed = seeds.find(x => x.id === f.id);
    const ren = PF_RENAMED_FORMS[f.id];
    if(ren && f.name === ren.from) f = {...f, name:ren.to};
    if(seed) seed.fields.forEach((sf, i) => {
      if(fields.some(x => x.id === sf.id)) return;
      const after = i ? fields.findIndex(x => x.id === seed.fields[i - 1].id) : -1;
      fields = [...fields.slice(0, after + 1), sf, ...fields.slice(after + 1)];
    });
    // Every template is chosen on its own (none is asked with the others any more).
    const {separate, ...rest} = f;
    return {...rest, fields};
  });
  return [...clean, ...seeds.filter(s => !saved.some(f => f.id === s.id))];
};

/* Sample records to show Run Customer Profile at work: calls, emails and notes on a few sample
   contacts (some are customers) that mention their age, marital status, education, test results,
   CLB levels, Canadian work experience and CRS score. Added once (by id). */
const PF_SAMPLE_SOURCES = {
  'Ali Khan': [
    {kind:'call', at:[2026, 10, 14, 11, 5], lines:["I'm 29 years old.", "I'm married and my wife will come with me to Canada.", "I have a master's degree in civil engineering.",
      "My IELTS scores were listening 8.5, reading 8, writing 7 and speaking 7.5.", "I have been working in Canada for 2 years as a site engineer."]},
    {kind:'email', at:[2026, 10, 18, 9, 40], title:'My language results', body:"Hi,\nAttached are my test results.\nCLB: Reading 10, Writing 9, Listening 10, Speaking 10.\nThanks, Ali"},
    {kind:'note', at:[2026, 10, 21, 16, 0], body:"First official language: English\nFirst official language test: IELTS General Training\nCRS Score: 497"},
  ],
  'Mahnoor Aziz': [
    {kind:'email', at:[2026, 10, 9, 10, 20], title:'Details for my profile', body:"Hello,\nI am 34 and married. My husband will come with me to Canada.\nI have a bachelor's degree in commerce.\nI took CELPIP and got CLB 9 in all four abilities.\nI have 3 years of work experience in Canada."},
    {kind:'note', at:[2026, 10, 12, 15, 30], body:"Date of birth: 2 June 1992\nFirst official language: English\nFirst official language test: CELPIP-General\nCRS Score: 468"},
  ],
  'Rabia Farooq': [
    {kind:'call', at:[2026, 10, 6, 14, 10], lines:["I'm 31 and married but my husband won't come with me.", "I did a two-year diploma in nursing.",
      "My IELTS was listening 7, reading 6.5, writing 6.5 and speaking 7.", "I have 1 year of work experience in Canada."]},
    {kind:'email', at:[2026, 10, 8, 18, 45], title:'CLB levels', body:"Hi,\nMy CLB levels are Reading 8, Writing 8, Listening 9, Speaking 9.\nRegards, Rabia"},
    {kind:'note', at:[2026, 10, 10, 11, 0], body:"CRS Score: 431\nWilling to pay: Yes\nExpect to pay: Next month\nRate financially: Good"},
  ],
  'Imran Sheikh': [
    {kind:'note', at:[2026, 10, 3, 12, 15], body:"Age: 38\nMarital status: Divorced / separated\nHighest completed education: Doctoral degree (PhD)\nCLB: Reading 9, Writing 9, Listening 9, Speaking 9\nCRS Score: 452"},
  ],
};
function withSampleProfileSources(acts, contacts){
  let next = acts;
  Object.entries(PF_SAMPLE_SOURCES).forEach(([name, items]) => {
    const c = (contacts || []).find(x => x.name === name);
    if(!c) return;
    const list = next[c.id] || [];
    const add = items.map((it, i) => {
      const id = `pf-sample-${c.id}-${i + 1}`;
      if(list.some(a => a.id === id)) return null;
      const [y, m, d, h, mi] = it.at, at = new Date(y, m - 1, d, h, mi);
      if(it.kind === 'call') return {id, contactId:c.id, type:'call', at, source:'team', by:null, direction:'inbound', outcome:'Connected', logged:true, durationMin:12,
        body:`Call transcript · ${it.lines.length} lines`, transcript:it.lines.map((text, j) => ({text, offsetMs:(j + 1) * 45000, speaker:name})), notes:''};
      if(it.kind === 'email') return {id, contactId:c.id, type:'email', at, source:'team', by:null, direction:'received', title:it.title, body:it.body};
      return {id, contactId:c.id, type:'note', at, source:'team', by:null, body:it.body};
    }).filter(Boolean);
    if(add.length) next = {...next, [c.id]: [...add, ...list].sort((a, b) => new Date(b.at) - new Date(a.at))};
  });
  return next;
}

/* ── Fields: visibility, values ────────────────────────────────────────────────────────────── */
const pfProp = (f) => formFieldProperty(f);
// An answer as words a "Show only when" rule compares (Yes / No for Boolean fields).
const pfAnswerWords = (f, v) => {
  if(v == null || v === '') return [];
  if(formFieldType(f.type) === 'Boolean') return v === true || v === 'true' ? ['Yes'] : v === false || v === 'false' ? ['No'] : [];
  return Array.isArray(v) ? v.map(String) : [String(v)];
};
// The fields asked for these answers: a field with "Show only when" is asked only while the field
// it depends on is asked and has one of the chosen answers.
/* A rule that no longer fits its field (the field removed or changed type, or none of its answers
   still one of the field's options) is ignored: the field is asked, so its answers are never hidden
   — or cleared on the next save — by a broken rule (the form editor flags it to fix). */
const pfRuleBroken = (form, rule) => { const dep = (form.fields || []).find(x => x.id === rule.fieldId);
  return !dep || !pfCanControl(dep) || !(rule.values || []).some(v => pfControlOptions(dep).some(o => (o.value ?? o) === v)); };
function pfVisibleFields(form, values){
  const shown = new Set();
  return (form.fields || []).filter(f => {
    const rule = f.showIf;
    if(rule && rule.fieldId && !pfRuleBroken(form, rule)){
      const dep = (form.fields || []).find(x => x.id === rule.fieldId);
      if(!shown.has(dep.id) || !pfAnswerWords(dep, values[dep.id]).some(w => (rule.values || []).includes(w))) return false;
    }
    shown.add(f.id);
    return true;
  });
}
const pfFormat = (f, v) => { if(v == null || v === '') return '—'; if(formFieldType(f.type) === 'Boolean') return v === true || v === 'true' ? 'Yes' : 'No'; const p = pfProp(f), t = formatPropertyValueOf(p, storePropertyValueOf(p, v)); return t === '' || t == null ? '—' : String(t); };
// Fields that can hold an answer someone can choose from: the "Show only when" field list.
const pfCanControl = (f) => ['Single Selection', 'Multi-Selection', 'Boolean'].includes(formFieldType(f.type));
const pfControlOptions = (f) => formFieldType(f.type) === 'Boolean' ? ['Yes', 'No'] : (f.options || []).filter(o => String(o).trim());

/* ── Matching a form to what the sources say (nothing to set up) ──────────────────────────── */
const PF_STOP = ['a', 'an', 'the', 'of', 'or', 'and', 'in', 'to', 'is', 'are', 'your', 'you', 'with', 'for', 'on', 'at', 'by', 'any', 'all', 'last', 'years', 'year',
  'how', 'what', 'which', 'when', 'does', 'do', 'did', 'would', 'customer'];
const pfWords = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(w => w && !PF_STOP.includes(w));
const PF_SPOUSE = ['spouse', 'partner', 'husband', 'wife'];
const PF_PARTS = ['reading', 'writing', 'listening', 'speaking'];
const pfIsSpouseFact = (k) => /^(spouse|partner)/.test(k);
// Which facts a field of this type can take.
const pfFits = (type, fact) => { const t = formFieldType(type);
  return t === 'Number' ? fact.type === 'number' || fact.type === 'scores'
    : ['Single Selection', 'Multi-Selection', 'Boolean'].includes(t) ? ['select', 'boolean'].includes(fact.type)
    : ['Single-Line Text', 'Multi-Line Text'].includes(t) ? ['text', 'select'].includes(fact.type) : false; };
// The fact a field asks for, read from its label (null: none) — {fact, part?}.
function pfFactOf(field){
  const words = pfWords(field.label), has = (w) => words.includes(w);
  const spouse = PF_SPOUSE.some(has);
  let best = null, bestLen = 0;
  Object.entries(PROFILE_FIELD_NAMES).forEach(([key, n]) => {
    const fact = PROFILE_FIELDS[key];
    if(!fact || !pfFits(field.type, fact) || pfIsSpouseFact(key) !== spouse || (n.not || []).some(has)) return;
    const part = fact.type === 'scores' ? PF_PARTS.find(has) : null;
    if(fact.type === 'scores' && !part) return;
    n.names.forEach(name => { const nw = pfWords(name); if(nw.length && nw.every(has) && nw.length > bestLen){ best = {fact:key, ...(part ? {part} : {})}; bestLen = nw.length; } });
  });
  return best;
}
const pfFactValues = (factKey) => { const f = PROFILE_FIELDS[factKey]; if(!f) return []; return f.type === 'boolean' ? [{value:'true', label:'Yes'}, {value:'false', label:'No'}] : (f.options || []).map(o => ({value:o.value, label:o.label})); };
const pfOverlap = (a, b) => { const bw = pfWords(b); return pfWords(a).filter(w => bw.includes(w)).length; };
// The option sharing most words with a text (null: none shares any).
const pfBestOption = (options, text) => { let best = null, score = 0; options.forEach(o => { const x = pfOverlap(text, o) + (String(o).toLowerCase() === String(text).toLowerCase() ? 99 : 0); if(x > score){ score = x; best = o; } }); return best; };
// A found fact value → the value this field stores (undefined: it doesn't fit).
function pfFactToValue(field, link, factValue){
  const t = formFieldType(field.type), fact = PROFILE_FIELDS[link.fact];
  const v = link.part ? (factValue || {})[link.part] : factValue;
  if(v == null || v === '') return undefined;
  if(t === 'Number') return isNaN(Number(v)) ? undefined : Number(v);
  const opts = t === 'Boolean' ? ['Yes', 'No'] : (field.options || []).filter(o => String(o).trim());
  if(fact.type === 'boolean'){
    const yes = opts.find(o => /^yes$/i.test(o)), no = opts.find(o => /^no$/i.test(o));
    const pick = v === true ? (yes || pfBestOption(opts, fact.label)) : (no || null);
    return t === 'Boolean' ? (v === true || v === false ? v : undefined) : pick == null ? undefined : t === 'Multi-Selection' ? [pick] : pick;
  }
  const label = ((fact.options || []).find(o => o.value === v) || {}).label || String(v);
  if(t === 'Boolean'){
    // A choice fact on a Yes / No field: the answer the field's label names is Yes; "none" is No.
    if(v === 'none') return false;
    const scores = (fact.options || []).map(o => ({v:o.value, s:pfOverlap(field.label, o.label)}));
    const top = Math.max(0, ...scores.map(x => x.s));
    return top > 0 && (scores.find(x => x.v === v) || {}).s === top ? true : undefined;
  }
  if(['Single Selection', 'Multi-Selection'].includes(t)){ const o = pfBestOption(opts, label); return o == null ? undefined : t === 'Multi-Selection' ? [o] : o; }
  return label;
}
// "Label: value" lines → {fieldId: value}: the field whose label the line's label fits best.
function pfLineValues(form, lines){
  const out = {};
  lines.forEach(line => {
    const m = /^\s*([a-z][^:]{0,60}?)\s*:\s*(.+?)\s*$/i.exec(line.text || '');
    if(!m) return;
    const kw = pfWords(m[1]);
    if(!kw.length) return;
    // The field whose label holds every word of the line's label, closest in length; a spouse's field
    // only when the line mentions the spouse. Two fields fitting equally: ambiguous, skipped.
    const spouseLine = PF_SPOUSE.some(w => kw.includes(w));
    let best = null, score = 0, tie = false;
    (form.fields || []).forEach(f => {
      const lw = pfWords(f.label);
      if(!kw.every(w => lw.includes(w)) || PF_SPOUSE.some(w => lw.includes(w)) !== spouseLine) return;
      const x = kw.length / lw.length;
      if(x > score){ score = x; best = f; tie = false; } else if(x === score) tie = true;
    });
    if(!best || tie || score < .5) return;
    const t = formFieldType(best.type), raw = m[2];
    let v;
    if(t === 'Number'){ const n = /-?\d+(?:\.\d+)?/.exec(raw); v = n ? Number(n[0]) : undefined; }
    else if(t === 'Date') v = parseDate(raw) || undefined;
    else if(t === 'Boolean') v = /^(yes|y|true)\b/i.test(raw) ? true : /^(no|n|false|none)\b/i.test(raw) ? false : undefined;
    else if(t === 'Single Selection'){ const o = pfBestOption(best.options || [], raw); v = o || undefined; }
    else if(t === 'Multi-Selection'){ const os = (best.options || []).filter(o => raw.toLowerCase().includes(String(o).toLowerCase())); v = os.length ? os : undefined; }
    else if(['Single-Line Text', 'Multi-Line Text'].includes(t)) v = raw;
    if(v !== undefined && !(best.id in out)) out[best.id] = {value:v, quote:line.text};
  });
  return out;
}

/* ── Reading the sources ───────────────────────────────────────────────────────────────────── */
// The person's calls (transcript and Sales Notes), notes and emails, newest first.
function pfSourcesOf(acts){
  const day = (a) => a.at ? new Date(a.at) : null;
  return (acts || []).filter(a => (a.type === 'call' && ((a.transcript && a.transcript.length) || (a.notes && String(a.notes).trim())))
      || (a.type === 'email' && String(a.body || '').trim()) || (a.type === 'note' && String(a.body || '').trim()))
    .map(a => ({id:a.id, kind:a.type === 'call' ? 'call' : a.type, at:day(a), act:a,
      label: a.type === 'call' ? `Call${a.transcript && a.transcript.length ? '' : ' (notes)'}` : a.type === 'email' ? `Email${a.title ? ` · ${a.title}` : ''}` : 'Note'}))
    .sort((x, y) => (y.at ? y.at.getTime() : 0) - (x.at ? x.at.getTime() : 0));
}
/* The form run against the chosen sources: each field's value from the newest source that has
   it ("Label: value" lines first, then what was said); a different value from an older source is
   kept as `also`. */
function pfExtract(form, sources){
  const links = Object.fromEntries((form.fields || []).map(f => [f.id, pfFactOf(f)]).filter(([, l]) => l));
  const facts = [...new Set(Object.values(links).map(l => l.fact))];
  const spec = [{fields:facts, factorFields:[]}];
  const found = {};   // fieldId → {value, source, sourceLabel, at, quote, also:[…]}
  const add = (f, v, s, origin, quote) => {
    const hit = {value:v, source:origin, sourceLabel:s.label, at:s.at ? s.at.toISOString() : null, quote:quote || ''};
    if(!found[f.id]) found[f.id] = {...hit, also:[]};
    else if(JSON.stringify(found[f.id].value) !== JSON.stringify(v) && !found[f.id].also.some(x => JSON.stringify(x.value) === JSON.stringify(v))) found[f.id].also.push(hit);
  };
  sources.forEach(s => {
    // A call's transcript (with its Sales Notes), an uploaded transcript, or an email's / note's text.
    const spoken = s.kind === 'call' || s.kind === 'transcript';
    const notes = spoken ? parseNotesText(s.act.notes) : parseNotesText(s.act.body).map(x => ({...x, source:s.kind}));
    const transcript = spoken ? (s.act.transcript || []) : [];
    const lineHits = pfLineValues(form, [...notes, ...transcript]);
    const results = facts.length ? (spoken ? runProfileExtraction({notes, transcript}, spec, s.kind).results : runExtraction(notes, spec).results) : {};
    (form.fields || []).forEach(f => {
      const kindOf = (fromNotes) => spoken ? (fromNotes ? 'notes' : s.kind) : s.kind;
      if(lineHits[f.id]){ add(f, lineHits[f.id].value, s, kindOf(notes.some(n => n.text === lineHits[f.id].quote)), lineHits[f.id].quote); return; }
      const link = links[f.id], r = link && results[link.fact];
      if(!r || r.status === 'notFound' || r.value == null) return;
      const v = pfFactToValue(f, link, r.value);
      if(v !== undefined) add(f, v, s, kindOf(r.origin === 'notes' || !spoken), r.evidence && r.evidence[0] && r.evidence[0].quote);
    });
  });
  return found;
}

/* ── Small pieces ──────────────────────────────────────────────────────────────────────────── */
// One field to fill in, as on the record edit panels (Edit contact, Edit deal): its label, then its input.
function PfFieldInput({field, value, onChange, invalid, extra}){
  const p = pfProp(field);
  return (
    <div style={{display:'flex', flexDirection:'column', minWidth:0}}>
      <label style={fieldLabel}>{field.label}</label>
      <TypedPropertyInput prop={p} value={value ?? loadPropertyValueOf(p, '')} invalid={!!invalid} onChange={onChange}/>
      {invalid && <span style={{fontSize:12, color:T.red, marginTop:4}}>{invalid}</span>}
      {extra}
    </div>
  );
}

/* ── Fill in (by hand, or from sources): one side panel ────────────────────────────────────── */
/* `found`: values read from sources (pfExtract) — they fill empty fields; where a field already
   has a different answer, the found one is offered beside it. Saving keeps each answer's source. */
/* `title` / `primary`: Create customer profile · Create, or Edit customer profile · Save changes.
   `search`: a field search at the top (as Edit contact has). */
/* Only the properties the signed-in user may edit are offered (Customer Profile Properties); the
   others keep their answers. */
function ProfileFormFillPanel({contact, form, current, found = {}, sourcesRead, onBack, onCancel, onSave, top: topExtra, title, primary = 'Save', search}){
  const cur = (current && current.values) || {}, curMeta = (current && current.meta) || {};
  const blank = (x) => x == null || x === '';
  const [values, setValues] = React.useState(() => {
    const v = {...cur};
    Object.entries(found).forEach(([id, h]) => { if(blank(v[id])) v[id] = h.value; });
    return v;
  });
  const [meta, setMeta] = React.useState(() => {
    const m = {...curMeta};
    Object.entries(found).forEach(([id, h]) => { if(blank(cur[id])) m[id] = {source:h.source, sourceLabel:h.sourceLabel, at:h.at, quote:h.quote}; });
    return m;
  });
  const [tried, setTried] = React.useState(false);
  const set = (f, v, m) => { setValues(x => ({...x, [f.id]:v})); setMeta(x => ({...x, [f.id]: m || {source:'manual', at:new Date().toISOString()}})); };
  const [query, setQuery] = React.useState('');
  const visible = pfVisibleFields(form, values);
  const q = query.trim().toLowerCase();
  const editable = visible.filter(f => profilePropCan(form.id, f.id));
  const listed = q ? editable.filter(f => String(f.label).toLowerCase().includes(q)) : editable;
  const errorOf = (f) => propertyValueError(pfProp(f), values[f.id], false);
  const problems = visible.filter(f => errorOf(f));
  const foundCount = Object.keys(found).length;
  const save = () => {
    setTried(true);
    if(problems.length){ setQuery(''); return; }
    // Only fields that are asked keep their answers; a field hidden by an earlier answer is cleared.
    const keep = new Set(visible.map(f => f.id));
    const v = Object.fromEntries(Object.entries(values).filter(([id, x]) => keep.has(id) && !blank(x)));
    const m = Object.fromEntries(Object.entries(meta).filter(([id]) => id in v));
    onSave({values:v, meta:m});
  };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  return (
    <CreatePanelFrame title={title || `${form.name} · ${contact.name}`} onClose={onCancel} more={false} actions={<>
      {onBack && <StSecondary label="Back" onClick={onBack}/>}
      <StSecondary label="Cancel" onClick={onCancel}/>
      <StCta label={primary} onClick={save}/>
    </>} top={topExtra || search ? (
      <div style={{display:'flex', flexDirection:'column', gap:10}}>
        {topExtra}
        {search && (
          <div style={{position:'relative'}}>
            <div style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', display:'flex'}}><Icon name="search" size={13} color={T.gray400}/></div>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search fields" aria-label="Search fields" style={{...fieldInput, paddingLeft:30}}/>
          </div>
        )}
      </div>
    ) : (sourcesRead ? (
      <div style={{fontSize:12.5, color:T.attioText, lineHeight:1.5}}>
        {foundCount ? `Found ${foundCount} answer${foundCount === 1 ? '' : 's'} in ${sourcesRead} source${sourcesRead === 1 ? '' : 's'}. Review them, correct anything that's wrong and complete the rest.`
          : `Nothing for this form was found in ${sourcesRead} source${sourcesRead === 1 ? '' : 's'}. Fill it in by hand.`}
      </div>
    ) : null)}>
      <div style={{display:'flex', flexDirection:'column', gap:16}}>
        {tried && problems.length > 0 && <div style={{fontSize:12.5, color:T.red}}>Fix the answers marked below.</div>}
        {q && !listed.length && <div style={{fontSize:13, color:T.attioMuted}}>No fields match “{query.trim()}”</div>}
        {listed.map(f => {
          const h = found[f.id];
          const offers = h ? [h, ...(h.also || [])].filter(o => !same(o.value, values[f.id])) : [];
          return (
            <PfFieldInput key={f.id} field={f} value={values[f.id]} invalid={tried && errorOf(f)} onChange={(v)=>set(f, v)}
              extra={offers.map((o, i) => (
                <div key={i} style={{display:'flex', alignItems:'center', gap:8, fontSize:12, color:T.attioMuted}}>
                  <span style={{flex:1, minWidth:0}}>Found: <b style={{color:T.attioText, fontWeight:600}}>{pfFormat(f, o.value)}</b> · {o.sourceLabel}{o.quote ? ` — “${o.quote}”` : ''}</span>
                  <button type="button" onClick={()=>set(f, o.value, {source:o.source, sourceLabel:o.sourceLabel, at:o.at, quote:o.quote})}
                    style={{border:'none', background:'transparent', padding:0, cursor:'pointer', fontSize:12, color:T.attioBlue, fontFamily:'inherit'}}>Use this</button>
                </div>
              ))}/>
          );
        })}
      </div>
    </CreatePanelFrame>
  );
}

/* ── Run Customer Profile ── first what to read: a call's transcript, or one uploaded (a file or
   pasted), plus the person's emails and notes; then the guided review — one field per screen with
   the value found (and, in a quiet line, where it came from), to confirm or change — then a short
   summary to save. Nothing found: the field starts empty (never guessed). CLB levels saved before
   are removed first: they start empty, and only levels found now or entered are kept. */
const PF_FOUND_LABEL = {call:'From call', notes:'From notes', email:'From email', note:'From note', transcript:'From transcript'};
function PfRunProgress({current, total, onBack}){
  return (
    <div style={{display:'flex', alignItems:'center', gap:14}}>
      <button onClick={onBack} disabled={!onBack} title="Previous" style={{border:'none', background:'transparent', padding:2, cursor: onBack ? 'pointer' : 'default', display:'flex', opacity: onBack ? 1 : .35}}>
        <Icon name="arrowLeft" size={14} color={T.attioMuted}/>
      </button>
      <span style={{fontSize:14, fontWeight:600, color:T.attioText, fontVariantNumeric:'tabular-nums', minWidth:16}}>{current}</span>
      <div style={{flex:1, height:3, borderRadius:9999, background:T.attioLine, overflow:'hidden'}}>
        <div style={{height:3, width:`${(current / Math.max(1, total)) * 100}%`, background:T.attioText, borderRadius:9999, transition:'width 220ms ease'}}/>
      </div>
      <span style={{fontSize:14, color:T.attioMuted, fontVariantNumeric:'tabular-nums', minWidth:16, textAlign:'right'}}>{total}</span>
    </div>
  );
}
const pfBlank = (v) => v == null || v === '' || (Array.isArray(v) && !v.length);
const pfSame = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const pfDay = (d) => d ? new Date(d).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}) : '';
// The wizard's frame (the reference design): title, a divider, the body, a divider, the actions.
function PfRunModal({onClose, actions, children}){
  return ReactDOM.createPortal(
    <div style={{position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div onClick={onClose} style={{position:'absolute', inset:0, background:'rgba(16,24,40,.35)'}}/>
      <div role="dialog" aria-label="Customer Profile" style={{position:'relative', width:600, maxWidth:'calc(100vw - 32px)', height:'min(600px, calc(100vh - 48px))', background:'#fff',
        borderRadius:12, boxShadow:'0 16px 40px rgba(16,24,40,.2)', display:'flex', flexDirection:'column'}}>
        <div style={{display:'flex', alignItems:'center', gap:12, padding:'20px 24px', borderBottom:`1px solid ${T.border}`}}>
          <span style={{flex:1, fontSize:16, fontWeight:600, color:T.attioText}}>Customer Profile</span>
          <button title="Close" onClick={onClose} style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:4}}><Icon name="close" size={14} color={T.gray600}/></button>
        </div>
        <div style={{flex:1, minHeight:0, overflowY:'auto', padding:'24px'}}>{children}</div>
        <div style={{display:'flex', justifyContent:'flex-end', gap:8, padding:'16px 24px', borderTop:`1px solid ${T.border}`}}>{actions}</div>
      </div>
    </div>, document.body);
}
/* What to read: every call transcript the person has (always), the emails and notes chosen, and
   a transcript added here (a file or pasted). `profiles` / `profileId`: which profile to run. */
function PfRunSources({profiles, profileId, setProfileId, calls, emails, notes, choice, setChoice}){
  const fileRef = React.useRef(null);
  const readFile = (file) => { if(!file) return; const r = new FileReader(); r.onload = () => setChoice(c => ({...c, upload:String(r.result || ''), fileName:file.name})); r.readAsText(file); };
  const section = {fontSize:12.5, color:T.attioMuted, marginBottom:6};
  const row = (key, label, n, fixed) => (
    <label onClick={()=>!fixed && n && setChoice(c => ({...c, [key]:!c[key]}))} style={{display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderTop:`1px solid ${T.attioLine}`,
      cursor: fixed || !n ? 'default' : 'pointer', opacity: n ? 1 : .5}}>
      <RowCheckbox checked={fixed ? !!n : !!choice[key] && !!n} onChange={()=>{}}/>
      <span style={{flex:1, fontSize:13, color:T.attioText}}>{label}</span>
      <span style={{fontSize:12, color:T.attioMuted}}>{!n ? 'None yet' : fixed ? `${n} · always included` : `${n} found`}</span>
    </label>
  );
  return (
    <div style={{display:'flex', flexDirection:'column', gap:20}}>
      {profiles.length > 1 && (
        <div>
          <div style={section}>Profile</div>
          <Select value={profileId} options={profiles.map(f => ({value:f.id, label:f.name}))} onChange={(v)=>v && setProfileId(v)}/>
        </div>
      )}
      <div>
        <div style={section}>Sources</div>
        {row('calls', 'Call transcripts', calls.length, true)}
        {row('emails', 'Emails', emails.length)}
        {row('notes', 'Notes', notes.length)}
        <label onClick={()=>setChoice(c => ({...c, add:!c.add}))} style={{display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderTop:`1px solid ${T.attioLine}`, cursor:'pointer'}}>
          <RowCheckbox checked={!!choice.add} onChange={()=>{}}/>
          <span style={{flex:1, fontSize:13, color:T.attioText}}>Add a transcript</span>
          <span style={{fontSize:12, color:T.attioMuted}}>Upload or paste</span>
        </label>
        {choice.add && (
          <div style={{display:'flex', flexDirection:'column', gap:8, paddingLeft:28, paddingTop:4}}>
            <div style={{display:'flex', alignItems:'center', gap:10}}>
              <StSecondary label="Choose file" onClick={()=>fileRef.current && fileRef.current.click()}/>
              <span style={{fontSize:12.5, color:T.attioMuted, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{choice.fileName || '.txt, .vtt or .srt'}</span>
              <input ref={fileRef} type="file" accept=".txt,.vtt,.srt,.md,text/plain" style={{display:'none'}} onChange={e=>readFile(e.target.files && e.target.files[0])}/>
            </div>
            <textarea value={choice.upload || ''} onChange={e=>setChoice(c => ({...c, upload:e.target.value, fileName:''}))} rows={4} placeholder="Or paste the transcript here"
              aria-label="Transcript" style={{...fieldText, resize:'vertical', lineHeight:1.5}}/>
          </div>
        )}
      </div>
    </div>
  );
}
// The template being filled (its answers kept under it).
const pfWithAlways = (store, profile) => ({parts:[profile], form:profile});
const pfCurrentOf = (store, cid, parts) => {
  const mine = store.data[cid] || {}, cur = parts.map(p => mine[p.id]).filter(Boolean);
  return cur.length ? {values:Object.assign({}, ...cur.map(c => c.values || {})), meta:Object.assign({}, ...cur.map(c => c.meta || {}))} : null;
};
const pfSaveParts = (store, cid, parts, {values, meta}) => parts.forEach(p => {
  const ids = new Set(p.fields.map(f => f.id));
  const pick = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => ids.has(k)));
  store.save(cid, p.id, {values:pick(values), meta:pick(meta)});
});
function ProfileRunWizard({contact, form: startForm, call, onCancel, onSave}){
  const store = useProfileForms();
  // The person's enabled templates (all of them while their Customer Profile is off: the one run is enabled).
  const on = store.enabledOf(contact.id), profiles = on.length ? store.forms.filter(f => on.includes(f.id)) : store.forms;
  const [profileId, setProfileId] = React.useState(startForm ? startForm.id : store.typeOf(contact.id));
  const profile = store.forms.find(f => f.id === profileId) || profiles[0];
  const {parts, form} = React.useMemo(() => pfWithAlways(store, profile), [profile && profile.id, store.forms]);
  const current = pfCurrentOf(store, contact.id, parts);
  const prev = (current && current.values) || {}, prevMeta = (current && current.meta) || {};
  const clbIds = React.useMemo(() => new Set(form.fields.filter(f => { const l = pfFactOf(f); return l && l.fact === 'clb'; }).map(f => f.id)), [form]);
  const hadClb = [...clbIds].some(id => !pfBlank(prev[id]));
  // The person's records: calls with a transcript (a call just ended first), emails, notes.
  const all = React.useMemo(() => pfSourcesOf(store.activitiesOf(contact.id)), [contact.id]);
  const calls = React.useMemo(() => {
    // A call is read for its transcript or its Sales Notes (a call with notes only counts too).
    const list = all.filter(x => x.kind === 'call' && ((x.act.transcript && x.act.transcript.length) || String(x.act.notes || '').trim()));
    if(call && !list.some(x => x.id === call.id)) list.unshift({id:call.id || 'this-call', kind:'call', at:call.startedAt ? new Date(call.startedAt) : new Date(), label:'This call',
      act:{type:'call', transcript:call.segments || [], notes:call.notes || ''}});
    return list;
  }, [all, call]);
  const emails = all.filter(x => x.kind === 'email'), notes = all.filter(x => x.kind === 'note');
  const [choice, setChoice] = React.useState(() => ({add:false, upload:'', fileName:'', emails:!!emails.length, notes:!!notes.length}));
  const [found, setFound] = React.useState(null);     // null: not read yet
  const [reading, setReading] = React.useState(false);
  /* Every call (always), a transcript added here, and the emails and notes chosen — newest first, so
     a newer source's answer is the one found and an older one its alternative (as the fill panel reads them). */
  const chosen = () => [
    ...calls,
    ...(choice.add && String(choice.upload || '').trim() ? [{id:'upload', kind:'transcript', at:new Date(), label: choice.fileName ? `Transcript · ${choice.fileName}` : 'Added transcript',
          act:{type:'call', transcript:parseTranscriptText(choice.upload), notes:''}}] : []),
    ...(choice.emails ? emails : []), ...(choice.notes ? notes : []),
  ].sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());
  const analyze = () => { const list = chosen(); setReading(true); setTimeout(() => { setFound(pfExtract(form, list)); setReading(false); }, 1100); };
  const [answers, setAnswers] = React.useState({});   // fieldId → {value, meta}
  const [pos, setPos] = React.useState(0);
  const [draft, setDraft] = React.useState(undefined);
  const [summary, setSummary] = React.useState(false);
  // What a field starts with: what was found, else the saved answer (not for CLB levels — removed first).
  const initialOf = (f) => found && found[f.id] ? found[f.id].value : clbIds.has(f.id) ? undefined : prev[f.id];
  const startValues = Object.fromEntries(form.fields.map(f => [f.id, initialOf(f)]));
  const known = Object.fromEntries(Object.entries(answers).map(([k, a]) => [k, a.value]));
  const steps = found ? pfVisibleFields(form, {...startValues, ...known}) : [];
  const field = steps[pos];
  React.useEffect(() => { if(field) setDraft(answers[field.id] ? answers[field.id].value : initialOf(field)); }, [pos, found, field && field.id]);
  const hit = field && found && found[field.id];
  const err = field && !pfBlank(draft) ? propertyValueError(pfProp(field), draft, false) : null;
  const metaFor = (f, v) => {
    const h = found[f.id];
    if(h && pfSame(h.value, v)) return {source:h.source, sourceLabel:h.sourceLabel, at:h.at, quote:h.quote};
    const alt = h && (h.also || []).find(x => pfSame(x.value, v));
    if(alt) return {source:alt.source, sourceLabel:alt.sourceLabel, at:alt.at, quote:alt.quote};
    if(!clbIds.has(f.id) && pfSame(prev[f.id], v) && prevMeta[f.id]) return prevMeta[f.id];
    return {source:'manual', at:new Date().toISOString()};
  };
  const decide = (v) => {
    setAnswers(a => ({...a, [field.id]: {value: pfBlank(v) ? '' : v, meta: pfBlank(v) ? null : metaFor(field, v)}}));
    if(pos + 1 >= steps.length) setSummary(true); else setPos(p => p + 1);
  };
  const save = () => {
    const values = {}, meta = {};
    steps.forEach(f => { const a = answers[f.id]; if(a && !pfBlank(a.value)){ values[f.id] = a.value; meta[f.id] = a.meta; } });
    pfSaveParts(store, contact.id, parts, {values, meta});
    store.setType(contact.id, profile.id);
    onSave && onSave({formName:profile.name});
  };
  // Where the value on screen came from — one quiet line under the input.
  const sourceLine = !field ? null : hit && pfSame(hit.value, draft) ? `${PF_FOUND_LABEL[hit.source] || 'Found'} · ${pfDay(hit.at)}${hit.quote ? ` — “${hit.quote}”` : ''}`
    : !clbIds.has(field.id) && !pfBlank(prev[field.id]) && pfSame(prev[field.id], draft) ? 'Previous answer' : null;
  if(!found) return (
    <PfRunModal onClose={onCancel} actions={reading ? <StSecondary label="Cancel" onClick={onCancel}/> : <>
      <StSecondary label="Cancel" onClick={onCancel}/>
      <StCta label="Run Customer Profile" disabled={!chosen().length} onClick={analyze}/>
    </>}>
      {reading ? (
        <div style={{height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, textAlign:'center'}}>
          <div style={{fontSize:15, fontWeight:600, color:T.attioText}}>Reading {chosen().length} source{chosen().length === 1 ? '' : 's'}…</div>
          <div style={{fontSize:12.5, color:T.attioMuted}}>{profile.name} · {contact.name}</div>
        </div>
      ) : <PfRunSources profiles={profiles} profileId={profile.id} setProfileId={setProfileId} calls={calls} emails={emails} notes={notes} choice={choice} setChoice={setChoice}/>}
    </PfRunModal>
  );
  if(summary) return (
    <PfRunModal onClose={onCancel} actions={<><StSecondary label="Back" onClick={()=>setSummary(false)}/><StCta label="Save to Customer Profile" onClick={save}/></>}>
      <div style={{fontSize:16, fontWeight:600, color:T.attioText, marginBottom:10}}>Review</div>
      {steps.map(f => { const a = answers[f.id]; return (
        <div key={f.id} style={{display:'flex', alignItems:'baseline', gap:12, padding:'9px 0', borderTop:`1px solid ${T.attioLine}`}}>
          <span style={{width:'46%', flexShrink:0, fontSize:12.5, color:T.attioMuted, lineHeight:1.4}}>{f.label}</span>
          <span style={{flex:1, minWidth:0, fontSize:13, fontWeight:500, color: a && !pfBlank(a.value) ? T.attioText : T.attioFaint}}>{a ? pfFormat(f, a.value) : '—'}</span>
        </div>
      ); })}
    </PfRunModal>
  );
  return (
    <PfRunModal onClose={onCancel} actions={field ? <><StSecondary label="Leave empty" onClick={()=>decide('')}/><StCta label="Confirm" disabled={pfBlank(draft) || !!err} onClick={()=>decide(draft)}/></>
      : <StSecondary label="Close" onClick={onCancel}/>}>
      {field ? (
        <div style={{display:'flex', flexDirection:'column', gap:24}}>
          <PfRunProgress current={pos + 1} total={steps.length} onBack={pos > 0 ? ()=>setPos(p => p - 1) : null}/>
          <div style={{display:'flex', flexDirection:'column', gap:14}}>
            <span style={{fontSize:18, fontWeight:600, color:T.attioText, lineHeight:1.35}}>{field.label}</span>
            {clbIds.has(field.id) && hadClb && <div style={{fontSize:12.5, color:T.attioMuted, marginTop:-6}}>Previous CLB levels were removed. Confirm the levels found now, or enter them.</div>}
            <TypedPropertyInput prop={pfProp(field)} value={draft ?? loadPropertyValueOf(pfProp(field), '')} invalid={!!err} onChange={setDraft} autoFocus/>
            {err && <div style={{fontSize:12, color:T.red}}>{err}</div>}
            {sourceLine && <div title={sourceLine} style={{fontSize:12, color:T.attioMuted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{sourceLine}</div>}
            {hit && !pfSame(hit.value, draft) && (
              <button onClick={()=>setDraft(hit.value)} style={{alignSelf:'flex-start', fontSize:12, border:'none', background:'transparent', padding:0, cursor:'pointer', color:T.attioMuted, fontFamily:'inherit'}}>
                {PF_FOUND_LABEL[hit.source] || 'Found'}: <span style={{color:T.attioText, textDecoration:'underline'}}>{pfFormat(field, hit.value)}</span>
              </button>
            )}
            {hit && (hit.also || []).filter(o => !pfSame(o.value, draft)).map((o, i) => (
              <button key={i} onClick={()=>setDraft(o.value)} style={{alignSelf:'flex-start', fontSize:12, border:'none', background:'transparent', padding:0, cursor:'pointer', color:'#8A4B08', fontFamily:'inherit'}}>
                {o.sourceLabel} ({pfDay(o.at)}) says <span style={{textDecoration:'underline'}}>{pfFormat(field, o.value)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : <div style={{fontSize:13, color:T.attioMuted}}>This form has no fields yet.</div>}
    </PfRunModal>
  );
}

/* Run Customer Profile from outside the tab (after a call, after Create Deal): the person's
   profile type (Customer Profile Type), then the wizard. */
function ProfileFormFill({contact, formId, call, onCancel, onSave}){
  const store = useProfileForms();
  if(!store) return null;
  const profiles = store.forms;
  const form = profiles.find(f => f.id === formId) || profiles.find(f => f.id === store.typeOf(contact.id)) || profiles[0];
  if(!form) return null;
  return <ProfileRunWizard contact={contact} form={form} call={call} onCancel={onCancel} onSave={onSave}/>;
}

/* Create customer profile (the empty state's Create by Hand — the template can be picked at the
   top) and Edit customer profile (the edit icon — with a field search): one side panel, as the
   record edit panels (Edit contact, Edit deal). */
function ProfileByHand({contact, startForm, onCancel, onSave, editing}){
  const store = useProfileForms();
  const profiles = store.forms;
  const [profileId, setProfileId] = React.useState(startForm ? startForm.id : store.typeOf(contact.id));
  const profile = profiles.find(f => f.id === profileId) || profiles[0];
  const {parts, form} = pfWithAlways(store, profile);
  return <ProfileFormFillPanel key={profile.id} contact={contact} form={form} current={pfCurrentOf(store, contact.id, parts)} onCancel={onCancel}
    title={editing ? `Edit customer profile · ${profile.name}` : 'Create customer profile'} primary={editing ? 'Save changes' : 'Create'} search={editing}
    top={!editing && !startForm && profiles.length > 1 ? <Field label="Profile"><Select value={profile.id} options={profiles.map(f => ({value:f.id, label:f.name}))} onChange={(v)=>v && setProfileId(v)}/></Field> : null}
    onSave={(out)=>{ pfSaveParts(store, contact.id, parts, out); store.setType(contact.id, profile.id); onSave && onSave(); }}/>;
}

/* ── Customer Profile tab ──────────────────────────────────────────────────────────────────── */
// One profile's answers: property on the left, value with its edit icon at the far right.
// Answers are edited in place where the property may be edited (Customer Profile Properties).
function PfRows({contact, form, current}){
  const store = useProfileForms();
  const values = (current && current.values) || {};
  const visible = pfVisibleFields(form, values);
  return (
    <div>
      {visible.map(f => {
        const p = pfProp(f), v = values[f.id], canEdit = profilePropCan(form.id, f.id);
        return (
          <div key={f.id} style={{display:'grid', gridTemplateColumns:'minmax(0, 1fr) minmax(0, 1fr)', alignItems:'baseline', gap:16, padding:'9px 0', borderTop:`1px solid ${T.attioLine}`}}>
            <span style={{fontSize:12.5, color:T.attioMuted, lineHeight:1.4}}>{f.label}</span>
            {!canEdit ? <span style={{fontSize:13, color: pfBlank(v) ? T.attioFaint : T.attioText, textAlign:'right', overflowWrap:'anywhere'}}>{pfBlank(v) ? '—' : pfFormat(f, v)}</span> :
            <OwnerEditableValue prop={p} value={pfBlank(v) ? '' : storePropertyValueOf(p, v)} display={pfBlank(v) ? '' : pfFormat(f, v)} pencil="always" align="right"
              onSave={(stored)=>{ const v = pfBlank(stored) ? '' : loadPropertyValueOf(p, stored);
                store.saveField(contact.id, form.id, f.id, formFieldType(f.type) === 'Number' && !pfBlank(v) ? Number(v) : v); }}/>}
          </div>
        );
      })}
    </div>
  );
}
/* Enable Customer Profile: the templates not enabled for the person yet — one or more ticked. */
function EnableProfilesModal({forms, onCancel, onEnable}){
  const [picked, setPicked] = React.useState([]);
  const toggle = (id) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  return (
    <StModal title="Enable Customer Profile" primary="Enable" canSubmit={picked.length > 0} onCancel={onCancel}
      onSubmit={()=>picked.length && onEnable(forms.filter(f => picked.includes(f.id)).map(f => f.id))}>
      <div style={{display:'flex', flexDirection:'column'}}>
        {forms.map(f => (
          <div key={f.id} role="checkbox" aria-checked={picked.includes(f.id)} onClick={()=>toggle(f.id)}
            style={{display:'flex', alignItems:'center', gap:10, padding:'8px 2px', cursor:'pointer', fontSize:13, color:T.attioText}}>
            <RowCheckbox checked={picked.includes(f.id)} onChange={()=>toggle(f.id)}/>{f.name}
          </div>
        ))}
      </div>
    </StModal>
  );
}
/* A person's Customer Profile: off until templates are enabled for them (Enable Customer Profile:
   one or more). Their enabled templates are pills to move between — the first enabled shows to
   start with — and Enable More adds others. Each template is filled in on its own (Create by Hand,
   Run Customer Profile). */
function CustomerProfileTab({contact}){
  const store = useProfileForms();
  const [mode, setMode] = React.useState(null);   // 'run' | 'hand' (create) | 'edit'
  const [enabling, setEnabling] = React.useState(false);
  if(!store) return null;
  const enabled = store.enabledOf(contact.id).map(id => store.forms.find(f => f.id === id)).filter(Boolean);
  const rest = store.forms.filter(f => !enabled.includes(f));
  const form = enabled.find(f => f.id === store.typeOf(contact.id)) || enabled[0] || null;
  const current = form && (store.data[contact.id] || {})[form.id];
  /* Customer Profile Properties (on every record): filling in or editing needs at least one
     editable property; Run Customer Profile fills in any of them, so it needs All Properties. */
  const can = (action) => action === 'run' ? profilePropsAll() : profileEditAny();
  const panel = mode === 'run' ? <ProfileRunWizard contact={contact} form={form} onCancel={()=>setMode(null)} onSave={()=>setMode(null)}/>
    : mode === 'hand' || mode === 'edit' ? <ProfileByHand contact={contact} startForm={form} editing={mode === 'edit'} onCancel={()=>setMode(null)} onSave={()=>setMode(null)}/> : null;
  const enableModal = enabling && <EnableProfilesModal forms={rest} onCancel={()=>setEnabling(false)} onEnable={(ids)=>{ store.enable(contact.id, ids); setEnabling(false); }}/>;
  if(!form) return (
    <div style={{padding:'20px 24px 32px'}}>
      <EmptyState illustration="profile" title="Customer Profile is off" action={rest.length > 0 && can('create') && <StCta label="Enable Customer Profile" onClick={()=>setEnabling(true)}/>}/>
      {enableModal}
    </div>
  );
  return (
    <div style={{padding:'20px 24px 32px', display:'flex', flexDirection:'column', gap:12}}>
      <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
        {/* The enabled templates (Customer Profile Type: the one shown). */}
        <div role="tablist" style={{display:'flex', flexWrap:'wrap', gap:6}}>
          {enabled.map(f => { const on = f.id === form.id;
            return <button key={f.id} role="tab" aria-selected={on} onClick={()=>store.setType(contact.id, f.id)}
              style={{height:26, padding:'0 10px', borderRadius:9999, border:`1px solid ${on ? T.black : T.borderStrong}`, background: on ? T.black : '#fff',
                color: on ? '#fff' : T.gray800, fontSize:12.5, fontWeight:500, cursor:'pointer', fontFamily:'inherit'}}>{f.name}</button>; })}
        </div>
        {rest.length > 0 && can('create') && <StSecondary label="Enable More" onClick={()=>setEnabling(true)}/>}
        <span style={{flex:1}}/>
        {current && can('edit') && <button onClick={()=>setMode('edit')} title="Edit customer profile" aria-label="Edit customer profile" style={toolbarIconButton}><Icon name="edit" size={14} color={T.gray800}/></button>}
        {current && can('run') && <StCta label="Run Customer Profile" onClick={()=>setMode('run')}/>}
      </div>
      {current ? (
        <div>
          <PfRows contact={contact} form={form} current={current}/>
          <div style={{fontSize:12, color:T.attioMuted, paddingTop:10, borderTop:`1px solid ${T.attioLine}`}}>Updated {pfDay(current.updatedAt)}</div>
        </div>
      ) : (
        <EmptyState illustration="profile" title={`No ${form.name} yet`} action={can('create') && (
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <StSecondary label="Create by Hand" onClick={()=>setMode('hand')}/>
            {can('run') && <StCta label="Run Customer Profile" onClick={()=>setMode('run')}/>}
          </div>
        )}/>
      )}
      {panel}
      {enableModal}
    </div>
  );
}

/* Customer Profile Type in a record's side panel: the person's profile, editable in place (hover).
   A deal or customer without a contact has none. */
function ProfileTypeValue({contactId}){
  const store = useProfileForms();
  if(!store || contactId == null) return <span style={{fontSize:13, color:T.attioFaint}}>—</span>;
  // None while the person's Customer Profile is off; picking a template shows (and enables) it.
  const list = store.forms, id = store.typeOf(contactId), cur = list.find(f => f.id === id);
  if(!profileEditAny()) return <span style={{fontSize:13, color: cur ? T.attioText : T.attioFaint}}>{cur ? cur.name : '—'}</span>;
  return <OwnerEditableValue prop={{key:'profileType', label:'Customer Profile Type', type:'Single Selection', options:list.map(f => f.id)}} value={id || ''}
    options={list.map(f => ({value:f.id, label:f.name}))} display={cur ? cur.name : ''} pencil="always" onSave={(v)=>v && store.setType(contactId, v)}/>;
}

/* Sample profiles to show the tab filled in: answers (with where they came from) for a few sample
   people, and their Customer Profile Type. Added once (a person who has any profile keeps it). */
const PF_SAMPLE_PROFILES = {
  'Mahnoor Aziz': {type:'pf-canada-crs', forms:{
    'pf-canada-crs':{'crs-age':34, 'crs-marital':'Married', 'crs-spouse-pr':false, 'crs-spouse-coming':'Yes', 'crs-education':"Bachelor's degree or a program of three or more years",
      'crs-first-lang':'English', 'crs-first-test':'CELPIP-General', 'crs-first-clb-reading':9, 'crs-first-clb-writing':9, 'crs-first-clb-listening':9, 'crs-first-clb-speaking':9,
      'crs-second-test':'No second language test', 'crs-cwe':3, 'crs-fwe':2, 'crs-spouse-education':"Master's or licensed professional degree", 'crs-score':468},
    'pf-customer-strength':{'cs-willing':'Yes', 'cs-when':'This month', 'cs-rating':'Good'}}},
  'Ali Raza Shah': {type:'pf-australia-points', forms:{
    'pf-australia-points':{'au-age':33, 'au-marital':'Married', 'au-partner-coming':'Yes', 'au-test':'IELTS', 'au-reading':8, 'au-writing':7.5, 'au-listening':8.5, 'au-speaking':8,
      'au-english-level':'Proficient', 'au-qualification':"Bachelor's or Master's degree", 'au-overseas-work':6, 'au-australian-work':0, 'au-australian-study':false, 'au-nomination':'Subclass 190', 'au-points':85},
    'pf-customer-strength':{'cs-willing':'Undecided', 'cs-when':'This year', 'cs-rating':'Average'}}},
  'Imran Sheikh': {type:'pf-us-niw', forms:{
    'pf-us-niw':{'niw-age':38, 'niw-profession':'Biomedical researcher', 'niw-degree':'Doctorate (PhD)', 'niw-experience':12, 'niw-endeavor':'Developing low-cost diagnostic tests for infectious diseases.',
      'niw-publications':24, 'niw-citations':610, 'niw-patents':1, 'niw-letters':5, 'niw-employer':'Aga Khan University — Senior Research Scientist'},
    'pf-customer-strength':{'cs-willing':'Yes', 'cs-when':'Next month', 'cs-rating':'Good'}}},
};
function withSampleProfileData(data, contacts){
  let next = data || {};
  Object.entries(PF_SAMPLE_PROFILES).forEach(([name, sample]) => {
    const c = (contacts || []).find(x => x.name === name);
    if(!c || next[c.id]) return;
    const at = new Date(2026, 9, 20, 10, 0).toISOString();
    const rec = {_type:sample.type};
    Object.entries(sample.forms).forEach(([fid, values]) => {
      rec[fid] = {values, meta:Object.fromEntries(Object.keys(values).map(k => [k, {source:'note', sourceLabel:'Note', at}])), updatedAt:at};
    });
    next = {...next, [c.id]:rec};
  });
  return next;
}

/* ── Settings → Customer Profile ───────────────────────────────────────────────────────────── */
const PF_COLUMNS = [
  {key:'name', label:'Form Name', width:240}, {key:'description', label:'Description', width:320}, {key:'fieldCount', label:'Fields', width:90},
  {key:'customerCount', label:'Customers', width:110}, {key:'createdBy', label:'Created By', width:160}, {key:'createdText', label:'Created', width:150},
];
function ProfileFormsSettings({data, setData}){
  const store = useProfileForms();
  const forms = data.profileForms || [];
  const setForms = (fn) => setData(d => ({...d, profileForms: fn(d.profileForms || [])}));
  const [editor, setEditor] = React.useState(null);   // {} new | {id}
  const [previewId, setPreviewId] = React.useState(null);
  const [deleting, setDeleting] = React.useState(null);
  /* Who holds answers for a form: people (or leads, customers) still there, with at least one answer —
     a deleted record's or an emptied profile doesn't count (so the form can be deleted once none do). */
  const hub = useRecordHub();
  const holderExists = (k) => !hub || ['contacts', 'deals', 'customers'].some(o => ((hub.records || {})[o] || []).some(r => String(r.id) === String(k)));
  const usedBy = (id) => Object.entries((store && store.data) || {}).filter(([k, m]) => m && m[id] && Object.keys(m[id].values || {}).length && holderExists(k)).length;
  const byId = (id) => forms.find(f => f.id === id);
  // Templates → Customer Profile: Create, Edit form fields, Delete, by who created each form; everyone sees them.
  const can = (action, f) => profileFormCan(action, f);
  const shownForms = forms.filter(f => can('view', f));
  const rows = shownForms.map(f => ({...f, createdBy:creatorOf(f), fieldCount:f.fields.length, customerCount:usedBy(f.id),
    createdText: f.createdAt ? fmtActStamp(new Date(f.createdAt)) : ''}));
  const actionsFor = (f) => [
    ...(can('edit', f) ? [{label:'Edit form', onClick:()=>setEditor({id:f.id})}] : []),
    {label:'Preview form', onClick:()=>setPreviewId(f.id)},
    ...(can('delete', f) ? [{label:'Delete form', danger:true, onClick:()=>setDeleting(f.id)}] : []),
  ];
  // Bulk Actions: Delete — a form with customers' information is skipped, as its Delete refuses.
  const pfBulk = useTableBulkDelete({rows:shownForms, noun:'form', canDelete:(f) => can('delete', f) && !usedBy(f.id), skipNote:'with customers’ information or not yours to delete',
    remove:(ids) => setForms(fs => fs.filter(f => !ids.includes(f.id)))});
  const schema = {
    properties:PF_COLUMNS, noun:'form', searchKeys:['name', 'description', 'createdBy'], canCreateProperty:false, fillWidth:true, bulkActions:pfBulk.bulkActions,
    filterProps:[{key:'createdBy', label:'Created By', type:'select'}, {key:'customerCount', label:'Customers', type:'number'}],
    selectValues:{createdBy:[...new Set(forms.map(f => f.createdBy).filter(Boolean))]},
    renderCell:(key, r) => key === 'name' ? <ContactName name={r.name} onOpen={()=>can('edit', r) ? setEditor({id:r.id}) : setPreviewId(r.id)} style={{fontSize:'inherit', fontWeight:500}}/>
      : key === 'fieldCount' || key === 'customerCount' ? <span style={{fontVariantNumeric:'tabular-nums'}}>{r[key]}</span> : undefined,
    renderActions:(r) => <RowActionsMenu title="Form actions" width={MENU_W} items={actionsFor(byId(r.id))}/>,
  };
  const save = (v) => {
    if(editor && editor.id) setForms(fs => fs.map(f => f.id === editor.id ? {...f, ...v, updatedAt:new Date().toISOString()} : f));
    else setForms(fs => [...fs, {id:`pf-${Date.now().toString(36)}`, ...v, createdBy:CURRENT_USER.name, createdAt:new Date().toISOString()}]);
    setEditor(null);
  };
  const deletingForm = deleting && byId(deleting);
  return (
    <div style={{position:'relative', flex:1, minHeight:0, display:'flex', flexDirection:'column', overflow:'hidden'}}>
      <SettingsPage fill>
        <div style={{display:'flex', flexDirection:'column', flex:1, minHeight:0}}>
          <RecordViewsModule flushTop storeKey="views:profile-forms-v1" schema={schema} rows={rows} columns={PF_COLUMNS.map(c => c.key)} saveView={false}
            defaultViews={[{id:'pfv-all', name:'All Forms', sort:{key:'name', dir:'asc'}}]}
            actions={() => can('create') && <button onClick={()=>setEditor({})} title="New form" aria-label="New form" style={iconBtn}><Icon name="plus" size={14} color={T.gray800}/></button>}/>
        </div>
      </SettingsPage>
      {editor && <ProfileFormEditor key={editor.id || 'new'} form={editor.id ? byId(editor.id) : null} taken={forms.filter(f => f.id !== editor.id).map(f => f.name.trim().toLowerCase())}
        onCancel={()=>setEditor(null)} onSave={save}/>}
      {previewId && byId(previewId) && <FormPreviewModal form={byId(previewId)} onClose={()=>setPreviewId(null)}/>}
      {pfBulk.bulkModal}
      {deletingForm && (usedBy(deletingForm.id)
        ? <StModal title="Delete form" primary="OK" hideCancel onCancel={()=>setDeleting(null)} onSubmit={()=>setDeleting(null)}>
            <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>{deletingForm.name} has information for {usedBy(deletingForm.id)} customer{usedBy(deletingForm.id) === 1 ? '' : 's'}, so it can't be deleted.</div>
          </StModal>
        : <StModal title="Delete form" primary="Delete form" danger onCancel={()=>setDeleting(null)} onSubmit={()=>{ setForms(fs => fs.filter(f => f.id !== deletingForm.id)); setDeleting(null); }}>
            <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>{deletingForm.name} will be deleted.</div>
          </StModal>)}
    </div>
  );
}

/* New / Edit form — the Marketing form editor's layout: details, the builder (shared field
   cards), the preview beside it. Each card adds Show only when and Fill from. */
function ProfileFormEditor({form, taken = [], onCancel, onSave}){
  const [name, setName] = React.useState(form ? form.name : '');
  const [description, setDescription] = React.useState(form ? form.description || '' : '');
  const [fields, setFields] = React.useState(() => ((form && form.fields) || []).map(({fill, ...f}) => ({...f, required:false, type:formFieldType(f.type), options:[...(f.options || [])]})));
  const problems = [];
  if(!name.trim()) problems.push('Give the form a name.');
  if(taken.includes(name.trim().toLowerCase())) problems.push('Another form already has this name.');
  if(!fields.length) problems.push('Add at least one field.');
  if(fields.some(f => !f.label.trim())) problems.push('Every field needs a label.');
  if(fields.some(f => fieldHasOptions(f.type) && f.options.filter(o => o.trim()).length < 1)) problems.push('Selection fields need at least one option.');
  if(fields.some(f => !typeConfigOk(f.type, f.options, f.range))) problems.push('A Custom Range’s minimum can’t exceed its maximum.');
  if(fields.some((f, i) => f.showIf && f.showIf.fieldId && (!fields.slice(0, i).some(x => x.id === f.showIf.fieldId) || !(f.showIf.values || []).length)))
    problems.push('“Show only when” needs an earlier field and at least one answer.');
  // A rule whose field changed type, or whose answers aren't the field's options any more (renamed or removed).
  const broken = fields.filter(f => f.showIf && f.showIf.fieldId && fields.some(x => x.id === f.showIf.fieldId) && pfRuleBroken({fields}, f.showIf));
  if(broken.length) problems.push(`“Show only when” on ${broken.map(f => f.label || 'a field').join(', ')} refers to answers its field no longer has. Choose them again.`);
  const ok = !problems.length;
  const save = () => ok && onSave({name:name.trim(), description:description.trim(),
    fields:fields.map(f => ({...f, label:f.label.trim(), ...typeSettings(f.type, f.options, f.range), options:fieldHasOptions(f.type) ? f.options.map(o => o.trim()).filter(Boolean) : [],
      required:false, showIf: f.showIf && f.showIf.fieldId ? f.showIf : null}))});
  const label = {fontSize:12.5, color:T.attioMuted};
  const section = {fontSize:11, fontWeight:600, color:T.attioFaint, textTransform:'uppercase', letterSpacing:.4};
  // Show only when, under each card.
  const below = (f, i, setField) => {
    const earlier = fields.slice(0, i).filter(pfCanControl);
    // The rule's field as it stands — shown even when it can't control any more (so the rule can be seen and fixed).
    const dep = f.showIf && (earlier.find(x => x.id === f.showIf.fieldId) || fields.slice(0, i).find(x => x.id === f.showIf.fieldId));
    return (
      <div style={{display:'grid', gridTemplateColumns:'minmax(0, 1fr) minmax(0, 1fr)', gap:'10px 16px', alignItems:'start', borderTop:`1px solid ${T.attioLine}`, paddingTop:12}}>
        <div style={{display:'flex', flexDirection:'column', gap:6, minWidth:0}}>
          <span style={label}>Show only when</span>
          <Select value={dep ? dep.id : null} placeholder="Always shown" options={[{value:'', label:'Always shown'}, ...[...earlier, ...(dep && !earlier.includes(dep) ? [dep] : [])].map(x => ({value:x.id, label:x.label || 'Untitled field'}))]}
            onChange={(v)=>setField({showIf: v ? {fieldId:v, values:[]} : null})}/>
        </div>
        {dep && (
          <div style={{display:'flex', flexDirection:'column', gap:6, minWidth:0}}>
            <span style={label}>is any of</span>
            <MultiSelectMenu value={(f.showIf.values || []).filter(v => pfControlOptions(dep).some(o => (o.value ?? o) === v))} options={pfControlOptions(dep)} onChange={(vals)=>setField({showIf:{fieldId:dep.id, values:vals}})} placeholder="Choose answers"/>
          </div>
        )}
      </div>
    );
  };
  return (
    <CreatePanelFrame title={form ? 'Edit Form' : 'New Form'} onClose={onCancel} placement="fixed" width="min(1120px, calc(100vw - 72px))" flush more={false}
      actions={<>
        {!ok && <span style={{flex:1, fontSize:12, color:T.attioMuted}}>{problems[0]}</span>}
        <StSecondary label="Cancel" onClick={onCancel}/>
        <StCta label="Save" disabled={!ok} onClick={save}/>
      </>}>
      <div style={{flex:1, minWidth:0, overflowY:'auto', padding:20, display:'flex', flexDirection:'column', gap:16}}>
        <span style={section}>Form details</span>
        {stack(<>
          <Field label="Form name" wide><input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Canada CRS Assessment" style={fieldText}/></Field>
          <Field label="Description" wide><textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} style={{...fieldText, resize:'vertical', lineHeight:1.5}}/></Field>
        </>)}
        <div style={{borderTop:`1px solid ${T.border}`, margin:'4px -20px 0'}}/>
        <span style={section}>Form builder</span>
        <FormFieldsList fields={fields} setFields={setFields} below={below} required={false}/>
      </div>
      <div style={{width:420, flexShrink:0, overflowY:'auto', padding:20, borderLeft:`1px solid ${T.border}`, background:T.headerBg}}>
        <div style={{...section, marginBottom:10}}>Preview</div>
        <div style={{background:'#fff', border:`1px solid ${T.attioLine}`, borderRadius:10, padding:16}}>
          <FormPreview form={{id:(form && form.id) || 'new', name, description, fields}}/>
        </div>
      </div>
    </CreatePanelFrame>
  );
}

/* Workflows: each form field is a Customer Profile property (the person's current answer). */
const PROFILE_FORM_TRIGGER_FIELDS = () => PROFILE_FORMS_LIVE.flatMap(form => form.fields.filter(f => ['Number', 'Single Selection', 'Boolean', 'Single-Line Text', 'Date'].includes(formFieldType(f.type))).map(f => {
  const t = formFieldType(f.type);
  return {key:`form.${form.id}.${f.id}`, label:`${form.name} · ${f.label}`, kind: t === 'Number' ? 'number' : t === 'Single-Line Text' || t === 'Date' ? 'text' : 'select',
    options: t === 'Single Selection' ? f.options.map(o => ({value:o, label:o})) : t === 'Boolean' ? [{value:'true', label:'Yes'}, {value:'false', label:'No'}] : undefined,
    read:(cid) => { const v = ((((WF_LIVE.profiles || {})[cid] || {})[form.id] || {}).values || {})[f.id]; return v == null ? '' : t === 'Boolean' ? String(!!v) : v; }};
}));

Object.assign(window, {ProfileFormsCtx, useProfileForms, setProfileFormsLive, SEED_PROFILE_FORMS, withSeedProfileForms, pfVisibleFields, pfExtract, pfSourcesOf,
  ProfileFormFill, ProfileRunWizard, ProfileByHand, ProfileTypeValue, ProfileFormFillPanel, CustomerProfileTab, withSampleProfileSources, withSampleProfileData, pfFactOf, pfLineValues, ProfileFormsSettings, ProfileFormEditor, PROFILE_FORM_TRIGGER_FIELDS});
