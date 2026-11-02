/* HOF Pulse ERP — the assessment templates that ship with the system (Settings → Customer Profile).

   Pure configuration for the generic engine (assessmentEngine.jsx). Administrators edit,
   duplicate, version and publish them in Settings; nothing here is read by the engine as code.

   ── Canada Express Entry CRS ─────────────────────────────────────────────────────────────────
   Verified on 2026-10-28 against canada.ca:
     • "Comprehensive Ranking System (CRS) criteria" — page modified 2026-10-16.
     • "Language test equivalency" (CELPIP-General, IELTS General Training, PTE Core, TEF Canada
       — the "Équivalence ancien score" column the Express Entry grids use — and TCF Canada) —
       page modified 2026-10-16.
     • "2026 changes to points for Canadian work experience and job offers" (effective
       2026-11-03) — the Labour Market Integration factor.
   Version 2026.10 is published (in effect since job-offer points were removed on 2025-03-25).
   Version 2026.11 (effective 2026-11-03) is a DRAFT: canada.ca does not yet state whether the
   high-wage and job-offer points differ with a spouse, how the core maximum changes, or whether
   the overall maximum stays 1,200 — it must be confirmed before it is published.

   ── FSWP and Australia ── the predefined Customer Profile templates (profileTemplates.jsx,
   verified September 2026) carried into the new format unchanged by `legacyToVersion`, so their
   scores are exactly what they were. */

const ASSESSMENT_CATEGORIES = ['Points test', 'Eligibility check', 'Customer qualification', 'Service suitability', 'Other'];

/* ── Condition shorthands (configuration only) ─────────────────────────────────────────────── */
const cAll = (...items) => ({match:'all', items});
const cAny = (...items) => ({match:'any', items});
const cIs = (field, op, value) => ({field, op, ...(value !== undefined ? {value} : {})});
const aRule = (id, label, method, fields) => ({kind:'rule', id, label, method, priority:0, ...fields});
const aSection = (id, label, items, extra = {}) => ({kind:'section', id, label, combine:'sum', caps:[], items, ...extra});

/* ── Official language tests → CLB / NCLC (canada.ca equivalency charts) ────────────────────
   Explicit inclusive boundaries per ability; "below 4" converts to level 3 (scores no points). */
const LANG_PARTS = [{key:'reading', label:'Reading'}, {key:'writing', label:'Writing'}, {key:'listening', label:'Listening'}, {key:'speaking', label:'Speaking'}];
// [level, min, max] rows, high → low; the last row is "below 4".
const LANG_TABLES = {
  celpip: {
    reading:   [[10,10,12],[9,9,9],[8,8,8],[7,7,7],[6,6,6],[5,5,5],[4,4,4],[3,0,3]],
    writing:   [[10,10,12],[9,9,9],[8,8,8],[7,7,7],[6,6,6],[5,5,5],[4,4,4],[3,0,3]],
    listening: [[10,10,12],[9,9,9],[8,8,8],[7,7,7],[6,6,6],[5,5,5],[4,4,4],[3,0,3]],
    speaking:  [[10,10,12],[9,9,9],[8,8,8],[7,7,7],[6,6,6],[5,5,5],[4,4,4],[3,0,3]],
  },
  ielts: {
    reading:   [[10,8,9],[9,7,7.5],[8,6.5,6.5],[7,6,6],[6,5,5.5],[5,4,4.5],[4,3.5,3.5],[3,0,3]],
    writing:   [[10,7.5,9],[9,7,7],[8,6.5,6.5],[7,6,6],[6,5.5,5.5],[5,5,5],[4,4,4.5],[3,0,3.5]],
    listening: [[10,8.5,9],[9,8,8],[8,7.5,7.5],[7,6,7],[6,5.5,5.5],[5,5,5],[4,4.5,4.5],[3,0,4]],
    speaking:  [[10,7.5,9],[9,7,7],[8,6.5,6.5],[7,6,6],[6,5.5,5.5],[5,5,5],[4,4,4.5],[3,0,3.5]],
  },
  pteCore: {
    reading:   [[10,88,90],[9,78,87],[8,69,77],[7,60,68],[6,51,59],[5,42,50],[4,33,41],[3,10,32]],
    writing:   [[10,90,90],[9,88,89],[8,79,87],[7,69,78],[6,60,68],[5,51,59],[4,41,50],[3,10,40]],
    listening: [[10,89,90],[9,82,88],[8,71,81],[7,60,70],[6,50,59],[5,39,49],[4,28,38],[3,10,27]],
    speaking:  [[10,89,90],[9,84,88],[8,76,83],[7,68,75],[6,59,67],[5,51,58],[4,42,50],[3,10,41]],
  },
  tef: {
    reading:   [[10,263,300],[9,248,262],[8,233,247],[7,207,232],[6,181,206],[5,151,180],[4,121,150],[3,0,120]],
    writing:   [[10,393,450],[9,371,392],[8,349,370],[7,310,348],[6,271,309],[5,226,270],[4,181,225],[3,0,180]],
    listening: [[10,316,360],[9,298,315],[8,280,297],[7,249,279],[6,217,248],[5,181,216],[4,145,180],[3,0,144]],
    speaking:  [[10,393,450],[9,371,392],[8,349,370],[7,310,348],[6,271,309],[5,226,270],[4,181,225],[3,0,180]],
  },
  tcf: {
    reading:   [[10,549,699],[9,524,548],[8,499,523],[7,453,498],[6,406,452],[5,375,405],[4,342,374],[3,0,341]],
    writing:   [[10,16,20],[9,14,15],[8,12,13],[7,10,11],[6,7,9],[5,6,6],[4,4,5],[3,0,3]],
    listening: [[10,549,699],[9,523,548],[8,503,522],[7,458,502],[6,398,457],[5,369,397],[4,331,368],[3,0,330]],
    speaking:  [[10,16,20],[9,14,15],[8,12,13],[7,10,11],[6,7,9],[5,6,6],[4,4,5],[3,0,3]],
  },
};
const ENGLISH_TESTS = [{value:'celpip', label:'CELPIP-General'}, {value:'ielts', label:'IELTS General Training'}, {value:'pteCore', label:'PTE Core'}];
const FRENCH_TESTS = [{value:'tef', label:'TEF Canada'}, {value:'tcf', label:'TCF Canada'}];
// One conversion calc per ability: the score, through the table of the test taken.
const aLevelCalcs = (prefix, scoresKey, testKey, what) => [
  ...LANG_PARTS.map(p => ({key:`${prefix}_${p.key}`, label:`${what} — ${p.label} level`, op:'convert', input:`${scoresKey}.${p.key}`, tableBy:testKey,
    tables:Object.fromEntries(Object.entries(LANG_TABLES).map(([test, t]) => [test, t[p.key].map(([out, min, max]) => ({min, max, out}))]))})),
  {key:`${prefix}Min`, label:`${what} — lowest level`, op:'min', inputs:LANG_PARTS.map(p => `${prefix}_${p.key}`)},
];
const aLevelKeys = (prefix) => LANG_PARTS.map(p => `${prefix}_${p.key}`);

/* ── CRS points tables (canada.ca, 2026-10-16) ─────────────────────────────────────────────── */
const CRS_EDUCATION = [
  {value:'none',      label:'Less than secondary school'},
  {value:'secondary', label:'Secondary diploma (high school graduation)'},
  {value:'oneYear',   label:'One-year post-secondary credential'},
  {value:'twoYear',   label:'Two-year post-secondary credential'},
  {value:'bachelors', label:"Bachelor's degree or a program of three or more years"},
  {value:'twoOrMore', label:'Two or more credentials, one from a program of three or more years'},
  {value:'masters',   label:"Master's degree or licensed professional degree"},
  {value:'doctoral',  label:'Doctoral degree (PhD)'},
];
// [value, with spouse, without spouse]
const CRS_EDU_POINTS = [['none',0,0],['secondary',28,30],['oneYear',84,90],['twoYear',91,98],['bachelors',112,120],['twoOrMore',119,128],['masters',126,135],['doctoral',140,150]];
// [min age, max age, with, without]
const CRS_AGE_ROWS = [[null,17,0,0],[18,18,90,99],[19,19,95,105],[20,29,100,110],[30,30,95,105],[31,31,90,99],[32,32,85,94],[33,33,80,88],[34,34,75,83],
  [35,35,70,77],[36,36,65,72],[37,37,60,66],[38,38,55,61],[39,39,50,55],[40,40,45,50],[41,41,35,39],[42,42,25,28],[43,43,15,17],[44,44,5,6],[45,null,0,0]];
// First official language per ability: [min level, max level, with, without]
const CRS_LANG1_ROWS = [[null,3,0,0],[4,5,6,6],[6,6,8,9],[7,7,16,17],[8,8,22,23],[9,9,29,31],[10,null,32,34]];
// Canadian work experience (complete years): [min, max, with, without]
const CRS_CWE_ROWS = [[0,0,0,0],[1,1,35,40],[2,2,46,53],[3,3,56,64],[4,4,63,72],[5,null,70,80]];
const aRows3 = (rs, col) => rs.map(r => ({min:r[0] ?? '', max:r[1] ?? '', points:r[col]}));

const CRS_WITH_SPOUSE = cIs('withSpouse', 'isYes'), CRS_WITHOUT_SPOUSE = cIs('withSpouse', 'isNo');

const acrsInputs = () => [
  // Applicant information
  {key:'dob', label:'Date of birth', type:'date', group:'applicant', required:true, help:'Age is worked out on the calculation date.'},
  {key:'ageStated', label:'Age (only when the date of birth is not known)', type:'number', group:'applicant', min:0, max:120, increment:1, unit:'years',
   showIf:cIs('dob', 'isEmpty'), fact:'age', help:'Used only until a date of birth is entered.'},
  {key:'maritalStatus', label:'Marital status', type:'select', group:'applicant', required:true, fact:'maritalStatus', options:[
    {value:'single', label:'Never married / single'}, {value:'married', label:'Married'}, {value:'commonLaw', label:'Common-law'},
    {value:'divorced', label:'Divorced / separated'}, {value:'widowed', label:'Widowed'}]},
  {key:'spouseCanadian', label:'Is your spouse or common-law partner a Canadian citizen or permanent resident?', type:'boolean', group:'applicant', required:true,
   showIf:cIs('maritalStatus', 'in', ['married', 'commonLaw'])},
  {key:'spouseAccompanying', label:'Is your spouse or common-law partner coming with you to Canada?', type:'boolean', group:'applicant', required:true, fact:'spouseAccompanying',
   showIf:cAll(cIs('maritalStatus', 'in', ['married', 'commonLaw']), cIs('spouseCanadian', 'isNo'))},
  // Education
  {key:'education', label:'Highest completed education', type:'select', group:'education', required:true, fact:'education', options:CRS_EDUCATION},
  {key:'educationEvidence', label:'Education credential assessment status', type:'select', group:'education', required:true,
   showIf:cIs('education', 'neq', 'none'), help:'Foreign education counts only with an Educational Credential Assessment (ECA).', options:[
    {value:'canadian', label:'Canadian credential (no ECA needed)'}, {value:'ecaComplete', label:'Foreign credential — ECA completed'},
    {value:'ecaPending', label:'Foreign credential — no ECA yet'}]},
  // First official language
  {key:'firstLang', label:'First official language', type:'select', group:'language1', required:true,
   options:[{value:'english', label:'English'}, {value:'french', label:'French'}]},
  {key:'firstTestEnglish', label:'Language test', type:'select', group:'language1', required:true, showIf:cIs('firstLang', 'eq', 'english'), options:ENGLISH_TESTS},
  {key:'firstTestFrench', label:'Language test', type:'select', group:'language1', required:true, showIf:cIs('firstLang', 'eq', 'french'), options:FRENCH_TESTS},
  {key:'firstScores', label:'Test results', type:'scores', group:'language1', required:true, parts:LANG_PARTS, min:0, max:699, increment:0.5,
   showIf:cIs('firstLang', 'isSet'), fact:'ielts', factSet:{firstLang:'english', firstTestEnglish:'ielts'}, help:'Enter the score for each ability exactly as reported.'},
  // Second official language
  {key:'hasSecondLang', label:'Do you have test results in the other official language?', type:'boolean', group:'language2', showIf:cIs('firstLang', 'isSet')},
  {key:'secondTestEnglish', label:'Language test', type:'select', group:'language2', required:true, showIf:cAll(cIs('hasSecondLang', 'isYes'), cIs('firstLang', 'eq', 'french')), options:ENGLISH_TESTS},
  {key:'secondTestFrench', label:'Language test', type:'select', group:'language2', required:true, showIf:cAll(cIs('hasSecondLang', 'isYes'), cIs('firstLang', 'eq', 'english')), options:FRENCH_TESTS},
  {key:'secondScores', label:'Test results', type:'scores', group:'language2', required:true, parts:LANG_PARTS, min:0, max:699, increment:0.5, showIf:cIs('hasSecondLang', 'isYes')},
  // Work experience
  {key:'cweYears', label:'Canadian skilled work experience (TEER 0–3, last 10 years)', type:'number', group:'work', required:true, min:0, max:50, increment:0.5, unit:'years',
   fact:'expCanadaYears', help:'Paid, full-time (or equal part-time) work while physically in Canada. Only complete years count.'},
  {key:'foreignYears', label:'Foreign skilled work experience (TEER 0–3, last 10 years)', type:'number', group:'work', required:true, min:0, max:50, increment:0.5, unit:'years',
   fact:['expOtherYears', 'expAustraliaYears'], help:'Only complete years count.'},
  {key:'tradeCertificate', label:'Certificate of qualification in a trade, issued by a Canadian province or territory', type:'boolean', group:'work'},
  // Spouse or common-law partner — only when the spouse is scored with you.
  {key:'spouseEducation', label:'Spouse — highest completed education', type:'select', group:'spouse', required:true, fact:'spouseEducation', options:CRS_EDUCATION,
   showIf:cAll(cIs('maritalStatus', 'in', ['married', 'commonLaw']), cIs('spouseCanadian', 'isNo'), cIs('spouseAccompanying', 'isYes'))},
  {key:'spouseTest', label:'Spouse — language test (first official language)', type:'select', group:'spouse', options:[...ENGLISH_TESTS, ...FRENCH_TESTS],
   showIf:cAll(cIs('maritalStatus', 'in', ['married', 'commonLaw']), cIs('spouseCanadian', 'isNo'), cIs('spouseAccompanying', 'isYes'))},
  {key:'spouseScores', label:'Spouse — test results', type:'scores', group:'spouse', parts:LANG_PARTS, min:0, max:699, increment:0.5, fact:'spouseIelts', factSet:{spouseTest:'ielts'},
   showIf:cAll(cIs('maritalStatus', 'in', ['married', 'commonLaw']), cIs('spouseCanadian', 'isNo'), cIs('spouseAccompanying', 'isYes'), cIs('spouseTest', 'isSet'))},
  {key:'spouseCweYears', label:'Spouse — Canadian skilled work experience', type:'number', group:'spouse', min:0, max:50, increment:0.5, unit:'years', fact:'spouseExpCanadaYears',
   showIf:cAll(cIs('maritalStatus', 'in', ['married', 'commonLaw']), cIs('spouseCanadian', 'isNo'), cIs('spouseAccompanying', 'isYes'))},
  // Additional points
  {key:'nomination', label:'Provincial or territorial nomination', type:'boolean', group:'additional', fact:'provincialNomination', needsVerification:true,
   help:'Scores only once the nomination certificate is verified.'},
  {key:'nominationEnhanced', label:'The nomination is through an Express Entry-aligned (enhanced) stream', type:'boolean', group:'additional', required:true, showIf:cIs('nomination', 'isYes')},
  {key:'sibling', label:'Brother or sister living in Canada (yours or your spouse’s)', type:'boolean', group:'additional', fact:'relativeInCanada', factMap:{sibling:true, none:false, other:false}},
  {key:'siblingEligible', label:'The sibling is 18 or older, a citizen or permanent resident, lives in Canada, and shares a parent (by blood, marriage, common-law or adoption)', type:'boolean',
   group:'additional', required:true, showIf:cIs('sibling', 'isYes')},
  {key:'canadaCredential', label:'Post-secondary credential earned in Canada', type:'boolean', group:'additional', fact:'canadaStudy', factMap:{none:false, short:true, long:true}},
  {key:'canadaCredentialLength', label:'Length of the Canadian credential', type:'select', group:'additional', required:true, showIf:cIs('canadaCredential', 'isYes'),
   fact:'canadaStudy', factMap:{short:'oneTwo', long:'threePlus'}, options:[{value:'oneTwo', label:'One- or two-year credential'}, {value:'threePlus', label:'Three years or longer (degree, diploma or certificate)'}]},
  {key:'canadaCredentialQualifies', label:'Studied in Canada at least 8 months, full-time, physically in Canada, and not mainly ESL/FSL or on a scholarship requiring return home', type:'boolean',
   group:'additional', required:true, showIf:cIs('canadaCredential', 'isYes')},
];

const acrsCalcs = () => [
  {key:'ageFromDob', label:'Age from date of birth', op:'age', input:'dob'},
  {key:'age', label:'Age', op:'coalesce', inputs:['ageFromDob', 'ageStated']},
  {key:'withSpouse', label:'Scored with a spouse or partner', op:'condition',
   when:cAll(cIs('maritalStatus', 'in', ['married', 'commonLaw']), cIs('spouseCanadian', 'isNo'), cIs('spouseAccompanying', 'isYes'))},
  {key:'educationRecognized', label:'Education is recognized (Canadian or with an ECA)', op:'condition',
   when:cAny(cIs('education', 'eq', 'none'), cIs('educationEvidence', 'in', ['canadian', 'ecaComplete']))},
  {key:'educationTier', label:'Education level for skill transferability', op:'map', input:'education',
   map:{oneYear:'postSecondary', twoYear:'postSecondary', bachelors:'postSecondary', twoOrMore:'advanced', masters:'advanced', doctoral:'advanced'}, otherwise:'secondaryOrLess'},
  {key:'firstTest', label:'First official language test', op:'coalesce', inputs:['firstTestEnglish', 'firstTestFrench']},
  ...aLevelCalcs('lang1', 'firstScores', 'firstTest', 'First language'),
  {key:'secondTest', label:'Second official language test', op:'coalesce', inputs:['secondTestEnglish', 'secondTestFrench']},
  ...aLevelCalcs('lang2', 'secondScores', 'secondTest', 'Second language'),
  ...aLevelCalcs('spouseLang', 'spouseScores', 'spouseTest', 'Spouse language'),
  {key:'frenchMin', label:'French — lowest NCLC level', op:'if', when:cIs('firstLang', 'eq', 'french'), then:{ref:'lang1Min'}, else:{ref:'lang2Min'}},
  {key:'englishMin', label:'English — lowest CLB level', op:'if', when:cIs('firstLang', 'eq', 'english'), then:{ref:'lang1Min'}, else:{ref:'lang2Min'}},
  {key:'cweFull', label:'Canadian work experience (complete years)', op:'formula', expression:'floor(cweYears)'},
  {key:'foreignFull', label:'Foreign work experience (complete years)', op:'formula', expression:'floor(foreignYears)'},
  {key:'spouseCweFull', label:'Spouse Canadian work experience (complete years)', op:'formula', expression:'floor(spouseCweYears)'},
];

// Skill transferability: CLB 7+ on all abilities (one or more under 9) → the lower value; CLB 9+ on all four → the higher.
const acrsTransferCases = (lhsKey, lhsTiers, rhs) => [
  {when:cAll(cIs(lhsKey, ...lhsTiers.top), rhs.high), points:50},
  {when:cAll(cIs(lhsKey, ...lhsTiers.mid), rhs.high), points:25},
  {when:cAll(cIs(lhsKey, ...lhsTiers.top), rhs.low), points:25},
  {when:cAll(cIs(lhsKey, ...lhsTiers.mid), rhs.low), points:13},
];
const EDU_TIERS = {top:['eq', 'advanced'], mid:['eq', 'postSecondary']};
const FOREIGN_TIERS = {top:['gte', 3], mid:['between', [1, 2]]};
const LANG_RHS = {high:cIs('lang1Min', 'gte', 9), low:cIs('lang1Min', 'between', [7, 8])};
const CWE_RHS = {high:cIs('cweFull', 'gte', 2), low:cIs('cweFull', 'eq', 1)};

const acrsCore = ({withWork}) => aSection('core', 'Core / human capital factors', [
  aRule('age-with', 'Age (with spouse)', 'range', {input:'age', rows:aRows3(CRS_AGE_ROWS, 2), when:CRS_WITH_SPOUSE}),
  aRule('age-without', 'Age (without spouse)', 'range', {input:'age', rows:aRows3(CRS_AGE_ROWS, 3), when:CRS_WITHOUT_SPOUSE}),
  aRule('edu-with', 'Level of education (with spouse)', 'option', {input:'education', points:Object.fromEntries(CRS_EDU_POINTS.map(r => [r[0], r[1]])),
    when:cAll(CRS_WITH_SPOUSE, cIs('educationRecognized', 'isYes'))}),
  aRule('edu-without', 'Level of education (without spouse)', 'option', {input:'education', points:Object.fromEntries(CRS_EDU_POINTS.map(r => [r[0], r[2]])),
    when:cAll(CRS_WITHOUT_SPOUSE, cIs('educationRecognized', 'isYes'))}),
  aSection('lang1', 'First official language', [
    aRule('lang1-with', 'Each ability (with spouse)', 'range', {inputs:aLevelKeys('lang1'), each:true, rows:aRows3(CRS_LANG1_ROWS, 2), when:CRS_WITH_SPOUSE}),
    aRule('lang1-without', 'Each ability (without spouse)', 'range', {inputs:aLevelKeys('lang1'), each:true, rows:aRows3(CRS_LANG1_ROWS, 3), when:CRS_WITHOUT_SPOUSE}),
  ], {caps:[{when:CRS_WITH_SPOUSE, value:128}, {value:136}]}),
  aSection('lang2', 'Second official language', [
    aRule('lang2-each', 'Each ability', 'range', {inputs:aLevelKeys('lang2'), each:true, when:cIs('hasSecondLang', 'isYes'),
      rows:[{min:'', max:4, points:0}, {min:5, max:6, points:1}, {min:7, max:8, points:3}, {min:9, max:'', points:6}]}),
  ], {caps:[{when:CRS_WITH_SPOUSE, value:22}, {value:24}]}),
  ...(withWork ? [
    aRule('cwe-with', 'Canadian work experience (with spouse)', 'range', {input:'cweFull', rows:aRows3(CRS_CWE_ROWS, 2), when:CRS_WITH_SPOUSE}),
    aRule('cwe-without', 'Canadian work experience (without spouse)', 'range', {input:'cweFull', rows:aRows3(CRS_CWE_ROWS, 3), when:CRS_WITHOUT_SPOUSE}),
  ] : []),
], {caps:[{when:CRS_WITH_SPOUSE, value:460}, {value:500}]});

const acrsSpouse = () => aSection('spouse', 'Spouse or common-law partner factors', [
  aRule('spouse-edu', 'Spouse level of education', 'option', {input:'spouseEducation',
    points:{none:0, secondary:2, oneYear:6, twoYear:7, bachelors:8, twoOrMore:9, masters:10, doctoral:10}}),
  aSection('spouse-lang', 'Spouse first official language', [
    aRule('spouse-lang-each', 'Each ability', 'range', {inputs:aLevelKeys('spouseLang'), each:true,
      rows:[{min:'', max:4, points:0}, {min:5, max:6, points:1}, {min:7, max:8, points:3}, {min:9, max:'', points:5}]}),
  ], {caps:[{value:20}]}),
  aRule('spouse-cwe', 'Spouse Canadian work experience', 'range', {input:'spouseCweFull',
    rows:[{min:0, max:0, points:0}, {min:1, max:1, points:5}, {min:2, max:2, points:7}, {min:3, max:3, points:8}, {min:4, max:4, points:9}, {min:5, max:'', points:10}]}),
], {when:CRS_WITH_SPOUSE, caps:[{value:40}]});

const acrsTransfer = () => aSection('transfer', 'Skill transferability factors', [
  aSection('transfer-edu', 'Education', [
    aRule('edu-lang', 'Education + first official language', 'conditional', {pick:'first', when:cIs('educationRecognized', 'isYes'),
      cases:acrsTransferCases('educationTier', EDU_TIERS, LANG_RHS)}),
    aRule('edu-cwe', 'Education + Canadian work experience', 'conditional', {pick:'first', when:cIs('educationRecognized', 'isYes'),
      cases:acrsTransferCases('educationTier', EDU_TIERS, CWE_RHS)}),
  ], {caps:[{value:50}]}),
  aSection('transfer-foreign', 'Foreign work experience', [
    aRule('foreign-lang', 'Foreign work experience + first official language', 'conditional', {pick:'first', cases:acrsTransferCases('foreignFull', FOREIGN_TIERS, LANG_RHS)}),
    aRule('foreign-cwe', 'Foreign work experience + Canadian work experience', 'conditional', {pick:'first', cases:acrsTransferCases('foreignFull', FOREIGN_TIERS, CWE_RHS)}),
  ], {caps:[{value:50}]}),
  aSection('transfer-trade', 'Certificate of qualification', [
    aRule('trade-lang', 'Certificate of qualification + first official language', 'conditional', {pick:'first', cases:[
      {when:cAll(cIs('tradeCertificate', 'isYes'), cIs('lang1Min', 'gte', 7)), points:50},
      {when:cAll(cIs('tradeCertificate', 'isYes'), cIs('lang1Min', 'between', [5, 6])), points:25}]}),
  ], {caps:[{value:50}]}),
], {caps:[{value:100}]});

const acrsAdditional = () => aSection('additional', 'Additional points', [
  aRule('nomination', 'Provincial or territorial nomination', 'conditional', {pick:'first', cases:[
    {when:cAll(cIs('nomination', 'isYes'), cIs('nominationEnhanced', 'isYes')), points:600, label:'Verified enhanced nomination'}]}),
  aRule('sibling', 'Brother or sister in Canada', 'conditional', {pick:'first', cases:[
    {when:cAll(cIs('sibling', 'isYes'), cIs('siblingEligible', 'isYes')), points:15, label:'Eligible sibling in Canada'}]}),
  aRule('french', 'French-language skills', 'conditional', {pick:'first', cases:[
    {when:cAll(cIs('frenchMin', 'gte', 7), cIs('englishMin', 'gte', 5)), points:50, label:'NCLC 7+ in French and CLB 5+ in English'},
    {when:cIs('frenchMin', 'gte', 7), points:25, label:'NCLC 7+ in French, CLB 4 or lower (or no test) in English'}]}),
  aRule('canada-education', 'Post-secondary education in Canada', 'conditional', {pick:'first', cases:[
    {when:cAll(cIs('canadaCredential', 'isYes'), cIs('canadaCredentialQualifies', 'isYes'), cIs('canadaCredentialLength', 'eq', 'threePlus')), points:30, label:'Three years or longer'},
    {when:cAll(cIs('canadaCredential', 'isYes'), cIs('canadaCredentialQualifies', 'isYes'), cIs('canadaCredentialLength', 'eq', 'oneTwo')), points:15, label:'One- or two-year credential'}]}),
], {caps:[{value:600}]});

const CRS_GROUPS = [
  {id:'applicant', label:'Applicant information'}, {id:'education', label:'Education'}, {id:'language1', label:'First official language'},
  {id:'language2', label:'Second official language'}, {id:'work', label:'Work experience'}, {id:'spouse', label:'Spouse or common-law partner'},
  {id:'additional', label:'Additional factors'},
];

const CRS_2026_10 = () => ({
  id:'crs-2026-10', label:'2026.10', status:'published', effectiveFrom:'2025-03-25', publishedAt:'2026-10-28T09:00:00.000Z',
  source:'canada.ca — CRS criteria and language test equivalency (pages modified 2026-10-16)',
  notes:['Job-offer (arranged employment) points were removed on 25 March 2025 and are not configured.',
         'Program eligibility checks (e.g. job offers for FSWP / FSTP) are separate from CRS scoring.'],
  scoreLabel:'CRS score', max:1200, threshold:null, thresholdNote:'No fixed pass mark — invitation cut-offs vary by draw.',
  groups:CRS_GROUPS, inputs:acrsInputs(), calcs:acrsCalcs(),
  sections:[acrsCore({withWork:true}), acrsSpouse(), acrsTransfer(), acrsAdditional()], gates:[],
});

/* 2026.11 — the Labour Market Integration factor (canada.ca, effective 2026-11-03): Canadian work
   experience (work length + high-wage occupation points) OR a qualifying high-wage job offer —
   whichever is higher, never both; capped at 140 with a spouse, 150 without. */
const CRS_2026_11 = () => {
  const v = CRS_2026_10();
  const inputs = [...v.inputs];
  const at = inputs.findIndex(i => i.key === 'tradeCertificate');
  inputs.splice(at, 0,
    {key:'highWageExperience', label:'At least 12 months (1,560 hours) of Canadian work experience in high-wage occupations', type:'select', group:'work',
     help:'Occupation levels from IRCC’s high-wage occupation list.', options:[
      {value:'none', label:'No / under 12 months'}, {value:'x13', label:'At least 1.3× the average median wage'},
      {value:'x15', label:'At least 1.5× the average median wage'}, {value:'x20', label:'At least 2× the average median wage'}]},
    {key:'jobOffer', label:'Qualifying job offer in a high-wage occupation', type:'select', group:'work', needsVerification:true,
     help:'No LMIA is needed from 3 November 2026. Scores only once the offer is verified.', options:[
      {value:'none', label:'No qualifying job offer'}, {value:'x13', label:'At least 1.3× but under 1.5× the average median wage'},
      {value:'x15', label:'At least 1.5× but under 2× the average median wage'}, {value:'x20', label:'At least 2× the average median wage'}]});
  const lmi = aSection('lmi', 'Labour market integration', [
    aSection('lmi-work', 'Canadian work experience', [
      aRule('cwe-with', 'Work length (with spouse)', 'range', {input:'cweFull', rows:aRows3(CRS_CWE_ROWS, 2), when:CRS_WITH_SPOUSE}),
      aRule('cwe-without', 'Work length (without spouse)', 'range', {input:'cweFull', rows:aRows3(CRS_CWE_ROWS, 3), when:CRS_WITHOUT_SPOUSE}),
      aRule('high-wage', 'High-wage occupation experience', 'option', {input:'highWageExperience', points:{none:0, x13:20, x15:40, x20:70}}),
    ]),
    aRule('job-offer', 'Qualifying job offer', 'option', {input:'jobOffer', points:{none:0, x13:50, x15:70, x20:100}}),
  ], {combine:'best', caps:[{when:CRS_WITH_SPOUSE, value:140}, {value:150}]});
  return {...v, id:'crs-2026-11', label:'2026.11', status:'draft', effectiveFrom:'2026-11-03', publishedAt:null, max:null,
    source:'canada.ca — 2026 changes to points for Canadian work experience and job offers (modified 2026-10-16)',
    notes:['Draft — confirm before publishing: canada.ca does not yet say whether high-wage or job-offer points differ with a spouse, how the core maximum changes, or whether the overall maximum stays 1,200.',
           'Skill transferability still uses work length, not high-wage requirements (unchanged).'],
    inputs, sections:[acrsCore({withWork:false}), lmi, acrsSpouse(), acrsTransfer(), acrsAdditional()]};
};

/* ── Legacy (predefined Customer Profile) templates → the new format, unchanged in scoring ──── */
// The smallest step a legacy value moves in: its library field's, or (a derived value) its inputs'.
const legacyStep = (path, t) => {
  const key = String(path).split('.')[0], f = PROFILE_FIELDS[key];
  if(f) return f.step ? Number(f.step) : 1;
  const d = ((t && t.derived) || []).find(x => x.key === key);
  if(!d) return 1;
  if(d.op === 'threshold' || d.op === 'map' || d.op === 'cond') return 1;
  const steps = (d.inputs || [d.input]).filter(Boolean).map(i => legacyStep(i, t));
  return steps.length ? Math.min(...steps) : 1;
};
// A legacy condition → the new shape; a missing value behaves exactly as before.
function legacyCond(c){
  if(!c) return null;
  if(c.all) return cAll(...c.all.map(legacyCond));
  if(c.any) return cAny(...c.any.map(legacyCond));
  if(c.not) return negateCond(legacyCond(c.not));
  const op = 'eq' in c ? (c.eq === true ? 'isYes' : c.eq === false ? 'isNo' : 'eq') : 'neq' in c ? 'neq' : 'in' in c ? 'in'
    : 'gte' in c ? 'gte' : 'lte' in c ? 'lte' : 'gt' in c ? 'gt' : 'lt' in c ? 'lt' : 'truthy' in c ? 'isYes' : 'falsy' in c ? 'isEmpty' : 'isSet';
  const value = c[op] !== undefined && !['isYes', 'isNo'].includes(op) ? c[op] : undefined;
  if('falsy' in c) return cAny(cIs(c.field, 'isEmpty'), cIs(c.field, 'isNo'));
  return cIs(c.field, op, value);
}
const INVERSE = {eq:'neq', neq:'eq', in:'notIn', notIn:'in', gte:'lt', lt:'gte', gt:'lte', lte:'gt', isYes:'isNo', isNo:'isYes', isSet:'isEmpty', isEmpty:'isSet'};
function negateCond(c){
  if(!c) return null;
  if(c.items) return {match: c.match === 'any' ? 'all' : 'any', items:c.items.map(negateCond)};
  const inv = INVERSE[c.op];
  // "not (x is …)" also holds when x is empty — as the legacy engine had it.
  return ['isSet', 'isEmpty'].includes(c.op) ? cIs(c.field, inv) : cAny(cIs(c.field, inv, c.value), cIs(c.field, 'isEmpty'));
}
// First-match legacy rows → explicit inclusive ranges.
function legacyRanges(rows, step, key = 'points'){
  const sorted = rows.map(r => ({...r})), out = [];
  let ceiling = null;
  sorted.forEach(r => {
    if('eq' in r) { out.push({min:r.eq, max:r.eq, [key]:r[key]}); return; }
    const max = r.max != null ? r.max : ceiling != null ? ceiling - step : '';
    out.push({min:r.min ?? '', max, [key]:r[key]});
    if(r.min != null) ceiling = r.min;
  });
  return out;
}
function legacyRule(r, i, prefix, t){
  const id = `${prefix}-${i + 1}`, when = legacyCond(r.when);
  const base = (extra) => ({kind:'rule', id, label:r.label, priority:0, ...(when ? {when} : {}), ...extra});
  if(r.type === 'cases') return base({method:'conditional', pick:r.pick || 'first', cases:r.cases.map(c => ({when:legacyCond(c.when), points:c.points, ...(c.note ? {label:c.note} : {})}))});
  const inputs = r.type === 'each' ? r.inputs : [r.input];
  const rows = r.rows;
  if(rows.every(x => 'eq' in x && typeof x.eq === 'boolean')) return base({method:'boolean', input:r.input, yes:(rows.find(x => x.eq === true) || {}).points || 0, no:(rows.find(x => x.eq === false) || {}).points || 0});
  if(rows.every(x => ('eq' in x && typeof x.eq === 'string') || 'in' in x)){
    const points = {};
    rows.forEach(x => (x.in || [x.eq]).forEach(o => { if(!(o in points)) points[o] = x.points; }));
    return base({method:'option', ...(r.type === 'each' ? {inputs, each:true} : {input:r.input}), points});
  }
  return base({method:'range', ...(r.type === 'each' ? {inputs, each:true} : {input:r.input}), rows:legacyRanges(rows, legacyStep(inputs[0], t))});
}
function legacyCalc(d, t){
  const label = d.key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
  switch(d.op){
    case 'threshold': {
      const step = legacyStep(d.input, t), rows = legacyRanges(d.rows.map(r => ({min:r.min, out:r.out})), step, 'out');
      const low = Math.min(...d.rows.map(r => r.min));
      return {key:d.key, label, op:'convert', input:d.input, tables:{'*':[...rows, ...(d.otherwise !== undefined ? [{min:'', max:low - step, out:d.otherwise}] : [])]}};
    }
    case 'cond': return {key:d.key, label, op:'condition', when:legacyCond(d.when)};
    case 'map': return {key:d.key, label, op:'map', input:d.input, map:d.map, otherwise:d.otherwise};
    default: return {key:d.key, label, op:d.op, inputs:d.inputs};
  }
}
function legacyInput(key, group){
  const f = PROFILE_FIELDS[key];
  const type = f.type === 'scores' ? 'scores' : f.type === 'select' ? 'select' : f.type === 'boolean' ? 'boolean' : f.type === 'number' ? 'number' : 'text';
  return {key, label:f.sub ? `${f.label} (${f.sub})` : f.label, type, group, fact:key,
    ...(f.options ? {options:f.options.map(o => ({value:o.value, label:o.label}))} : {}),
    ...(f.parts ? {parts:f.parts.map(p => ({key:p.key, label:p.label}))} : {}),
    ...(f.min != null ? {min:f.min} : {}), ...(f.max != null ? {max:f.max} : {}), ...(f.step ? {increment:f.step} : {}), ...(f.unit ? {unit:f.unit} : {}),
    ...(f.showIf ? {showIf:legacyCond(f.showIf)} : {})};
}
function legacyToVersion(t){
  const keys = [...new Set([...(t.fields || []), ...(t.factorFields || [])])].filter(k => PROFILE_FIELDS[k]);
  const ordered = PROFILE_FIELD_ORDER.filter(k => keys.includes(k));
  return {
    id:`${t.id}-${t.version}`, label:t.version, status:'published', effectiveFrom:null, publishedAt:'2026-09-30T09:00:00.000Z',
    source:t.source || '', notes:t.notes || [], scoreLabel:t.scoreLabel || 'Points', max:t.max ?? null, threshold:t.threshold ?? null,
    thresholdNote:t.thresholdNote || '', groups:[{id:'profile', label:'Profile'}, {id:'factors', label:'Additional factors'}],
    inputs:ordered.map(k => legacyInput(k, (t.factorFields || []).includes(k) ? 'factors' : 'profile')),
    calcs:(t.derived || []).map(d => legacyCalc(d, t)),
    sections:t.groups.map(g => ({kind:'section', id:g.id, label:g.label, combine:'sum', caps: g.cap != null ? [{value:g.cap}] : [],
      ...(g.when ? {when:legacyCond(g.when)} : {}),
      items: g.parts ? g.parts.map((p, pi) => ({kind:'section', id:`${g.id}-${pi + 1}`, label:p.label, combine:'sum', caps: p.cap != null ? [{value:p.cap}] : [],
                         items:p.rules.map((r, i) => legacyRule(r, i, `${g.id}-${pi + 1}`, t))}))
                     : g.rules.map((r, i) => legacyRule(r, i, g.id, t))})),
    gates:(t.gates || []).map((g, i) => ({id:`gate-${i + 1}`, label:g.label, when:legacyCond(g.when)})),
  };
}

/* ── The templates a new workspace starts with ─────────────────────────────────────────────── */
const SEED_ASSESSMENT_TEMPLATES = () => [
  {id:'canada-crs', name:'Canada Express Entry CRS', category:'Points test', enabled:true,
   description:'Comprehensive Ranking System score for Express Entry: core human capital, spouse, skill transferability and additional points.',
   versions:[CRS_2026_10(), CRS_2026_11()]},
  {id:'fswp', name:TPL_FSWP.name, category:'Eligibility check', enabled:true,
   description:'Federal Skilled Worker Program — six selection factors (67 points or higher may qualify).', versions:[legacyToVersion(TPL_FSWP)]},
  {id:'australia-points', name:TPL_AU.name, category:'Points test', enabled:true,
   description:'Australian points test for skilled visas (subclasses 189 / 190 / 491) — pass mark 65.', versions:[legacyToVersion(TPL_AU)]},
];
// Templates saved before keep their edits; ones shipped since are added; old drafts are never replaced.
const withSeedTemplates = (saved) => {
  const seeds = SEED_ASSESSMENT_TEMPLATES();
  if(!saved) return seeds;
  return [...saved, ...seeds.filter(s => !saved.some(t => t.id === s.id))];
};

Object.assign(window, {ASSESSMENT_CATEGORIES, LANG_TABLES, SEED_ASSESSMENT_TEMPLATES, withSeedTemplates, legacyToVersion, legacyCond, negateCond});
