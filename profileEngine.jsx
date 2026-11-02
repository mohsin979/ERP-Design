/* HOF Pulse ERP — Customer Profile fact library.

   PROFILE_FIELDS — facts about a person (age, education, language test scores, work
   experience…) that the system can recognise in calls, Sales Notes and emails
   (profileExtractor.jsx). A Customer Profile form field can be linked to one of these facts
   (Settings → Customer Profile → Fill from) so it fills in from those sources; nothing here
   scores or qualifies anyone. */

/* ── Field library ────────────────────────────────────────────────────────────────────────── */

const EDUCATION_OPTIONS = [
  {value:'none',        label:'Less than secondary school'},
  {value:'secondary',   label:'Secondary school (high school)'},
  {value:'oneYear',     label:'One-year post-secondary diploma/certificate'},
  {value:'twoYear',     label:'Two-year post-secondary diploma'},
  {value:'bachelors',   label:"Bachelor's degree (3+ years)"},
  {value:'twoOrMore',   label:'Two or more credentials (one 3+ years)'},
  {value:'masters',     label:"Master's or professional degree"},
  {value:'doctoral',    label:'Doctoral degree (PhD)'},
];

const LANGUAGE_SKILLS = [
  {key:'listening', label:'Listening'},
  {key:'reading',   label:'Reading'},
  {key:'writing',   label:'Writing'},
  {key:'speaking',  label:'Speaking'},
];

/* `hints` drive the prototype extractor (profileExtractor.jsx). In production an AI model
   would do the extraction; the hints double as guidance for it. Patterns run on a normalised
   sentence (lower case, number words turned into digits). */
const PROFILE_FIELDS = {
  age: {label:'Age', type:'number', unit:'years', min:14, max:80,
        hints:{patterns:[
          '\\b(\\d{2})\\s*(?:years?|yrs?)\\s*old\\b',
          '\\bage\\s*(?:is|of|:)?\\s*(\\d{2})\\b',
          "\\b(?:i am|i'm|im)\\s+(\\d{2})\\b(?!\\s*(?:years? of|%|percent|hours?))",
        ], exclude:['wife','husband','spouse','partner','son','daughter','brother','sister','bhai','behan','beta','beti','biwi','shohar']}},

  maritalStatus: {label:'Marital status', type:'select', options:[
      {value:'single',     label:'Single / never married', say:["\\bnot married\\b","\\bnever (?:been )?married\\b","\\bunmarried\\b","\\bsingle\\b",
                                                            "\\bsha+di nahi?n?\\b","\\bsha+di (?:abhi )?nahi?n? hu[ie]\\b","\\bkunwar[ai]\\b"]},
      {value:'married',    label:'Married',                say:["\\bmarried\\b","\\bmy (?:wife|husband|spouse)\\b","\\bi have a (?:wife|husband)\\b",
                                                            "\\bmeri (?:biwi|bivi|begum|wife)\\b","\\bmera (?:shohar|shauhar|husband)\\b","\\bsha+di (?:ho (?:gayi|gai|chuki)|shuda)\\b"]},
      {value:'commonLaw',  label:'Common-law partner',     say:["\\bcommon[- ]?law\\b"]},
      {value:'divorced',   label:'Divorced / separated',   say:["\\bdivorced\\b","\\bseparated\\b","\\btala+q\\b"]},
      {value:'widowed',    label:'Widowed',                say:["\\bwidow(?:ed|er)?\\b"]},
    ], hints:{clause:true, excludeWords:['brother','sister','friend','cousin','son','daughter','father','mother','parents','bhai','behan','dost','beta','beti']}},

  spouseAccompanying: {label:'Spouse / partner accompanying', type:'boolean',
      showIf:{field:'maritalStatus', in:['married','commonLaw']},
      hints:{yes:["\\b(?:wife|husband|spouse|partner|biwi|bivi|begum|shohar|shauhar)\\b[^.]{0,50}\\b(?:will|would|is going to|also|plans? to|wants? to|bhi)\\b[^.]{0,25}\\b(?:come|join|accompany|move|immigrate|migrate|relocate|apply|saath|sath|aaye?gi|jaye?gi|aaye?ga|jaye?ga|chale?gi)",
                  "\\b(?:with|along with|bring)\\s+my\\s+(?:wife|husband|spouse|partner)\\b",
                  "\\b(?:wife|husband|biwi|shohar)\\b[^.]{0,30}\\b(?:saath|sath)\\b(?![^.]{0,10}\\bnahi)",
                  "\\b(?:spouse|wife|husband|partner)\\b[^.]{0,20}\\b(?:accompanying|coming|joining)\\b(?![^.]{0,6}\\b(?:no|not)\\b)"],
             no:["\\b(?:wife|husband|spouse|partner|biwi|shohar)\\b[^.]{0,50}\\b(?:won't|will not|not going to|isn't|is not|doesn't|does not|nahi|nahin)\\b[^.]{0,25}\\b(?:come|join|accompany|move|immigrate|migrate|saath|sath|aaye?gi|jaye?gi)",
                 "\\b(?:wife|husband|biwi|shohar)\\b[^.]{0,30}\\b(?:saath|sath) nahi",
                 "\\b(?:wife|husband|spouse|partner|biwi|shohar)\\b[^.]{0,20}\\b(?:not|no|nahi|nahin)\\b[^.]{0,10}\\b(?:accompanying|coming|joining)\\b"]}},

  education: {label:'Education level', type:'select', pickHighest:true, options:EDUCATION_OPTIONS.map(o => ({...o, say:{
      none:[],
      secondary:["\\bhigh school\\b","\\bsecondary school\\b","\\bmatric(?:ulation)?\\b","\\bintermediate\\b","\\bf\\.?sc\\b","\\ba levels?\\b"],
      oneYear:["\\bone[- ]year (?:diploma|certificate|program)\\b","\\b1[- ]year (?:diploma|certificate|program)\\b"],
      twoYear:["\\btwo[- ]year (?:diploma|program)\\b","\\b2[- ]year (?:diploma|program)\\b","\\bassociate(?:'s)? degree\\b"],
      bachelors:["\\bbachelor'?s?\\b","\\bundergraduate degree\\b","\\buniversity degree\\b","\\bgraduation\\b","\\bb\\.?\\s?com\\b","\\bbba\\b","\\bbscs\\b","\\bbs\\b","\\bb\\.?\\s?sc\\b","\\bbs (?:in|degree)\\b","\\bbe (?:in|degree)\\b","\\bengineering degree\\b","\\bfour[- ]year degree\\b","\\b4[- ]year degree\\b"],
      twoOrMore:["\\btwo degrees\\b","\\b2 degrees\\b","\\btwo post[- ]secondary\\b"],
      masters:["\\bmaster'?s?\\b","\\bmba\\b","\\bm\\.?\\s?phil\\b","\\bmcs\\b","\\bm\\.?\\s?sc\\b","\\bms (?:in|degree)\\b","\\bprofessional degree\\b","\\bmbbs\\b"],
      doctoral:["\\bph\\.?\\s?d\\b","\\bdoctorate\\b","\\bdoctoral\\b"],
    }[o.value]})),
    hints:{exclude:['wife','husband','spouse','partner','son','daughter','biwi','shohar','beta','beti'], ignoreIntent:true}},

  occupation: {label:'Profession / occupation', type:'text', scored:false,
      hints:{patterns:[
               "\\b(?:i work as|i'm working as|i am working as|working as|i am employed as|my (?:job|profession|occupation|role|designation) is|by profession (?:i am|i'm)|i am an?|i'm an?)\\s+(?:an?\\s+)?([a-z][a-z ]{2,40}?)(?=\\s+(?:at|in|for|with|and|since|from|by|hoon|hun|hu)\\b|[.,]|$)",
               "\\b(?:main|mai|mein)\\s+(?:ek\\s+)?([a-z][a-z ]{2,40}?)\\s+(?:hoon|hun|hu|hoo)\\b",
               "\\bmera (?:kaam|profession|pesha|job)\\s+([a-z][a-z ]{2,40}?)\\s+(?:ka|hai)\\b",
               "^(?:profession|occupation|job|role|designation|job title|work)\\s*[:\\-–]\\s*(?:an?\\s+)?([a-z][a-z ]{2,40}?)\\s*$",
               "^(?:profession|occupation|designation|job title)\\s+(?:an?\\s+)?([a-z][a-z ]{2,40}?)\\s*$",
             ],
             reject:['married','single','years','interested','looking','planning','applying','citizen','fresh'],
             /* Accept only values that read as an occupation — known titles, or typical
                occupation word endings — so "main canada jana chahta hoon" is not an occupation. */
             accept:{words:['designer','engineer','developer','manager','accountant','doctor','nurse','teacher','lecturer','professor','analyst',
                            'consultant','architect','pharmacist','dentist','lawyer','advocate','chef','cook','driver','electrician','plumber',
                            'technician','officer','specialist','scientist','programmer','administrator','executive','banker','auditor','surgeon',
                            'physician','therapist','researcher','writer','journalist','marketer','agent','assistant','clerk','supervisor',
                            'entrepreneur','businessman','student','owner','founder','director','coordinator','representative','mechanic','welder'],
                     endings:'(?:er|or|ist|ian|ant|ent|ect|yst|eer)$',
                     notWords:['never','other','over','after','better','under','number','later','either','rather','whether','together','ever','per']}}},

  ielts: {label:'IELTS scores', type:'scores', parts:LANGUAGE_SKILLS, min:0, max:9, step:0.5,
      hints:{context:["\\bielts\\b","\\bband\\b","\\blistening\\b","\\breading\\b","\\bwriting\\b","\\bspeaking\\b","\\benglish test\\b"],
             notContext:["\\bclb\\b","\\bnclc\\b","\\bcelpip\\b","\\bpte\\b","\\btef\\b","\\btcf\\b"],
             exclude:['wife','husband','spouse','partner']}},

  // Canadian Language Benchmark levels — as stated in a conversation or a record, never worked out.
  clb: {label:'CLB levels', type:'scores', parts:LANGUAGE_SKILLS, min:1, max:12, step:1,
      hints:{context:["\\bclb\\b","\\bcanadian language benchmark"], integer:true,
             all:"\\bclb\\s*(\\d{1,2})\\s*(?:in|across|for|on)?\\s*(?:all|every|each)\\b"}},

  expOtherYears: {label:'Years of work experience', sub:'Skilled work outside Canada and Australia', type:'number', unit:'years', min:0, max:40, step:0.5,
      hints:{experience:'other'}},
  expCanadaYears: {label:'Canadian work experience', type:'number', unit:'years', min:0, max:40, step:0.5,
      hints:{experience:'canada'}},
  expAustraliaYears: {label:'Australian work experience', type:'number', unit:'years', min:0, max:40, step:0.5,
      hints:{experience:'australia'}},

  // Spouse / partner — only asked when a spouse or partner is accompanying.
  spouseEducation: {label:'Spouse education level', type:'select', options:EDUCATION_OPTIONS,
      showIf:{field:'spouseAccompanying', eq:true}, hints:{spouse:true, like:'education'}},
  spouseIelts: {label:'Spouse IELTS scores', type:'scores', parts:LANGUAGE_SKILLS, min:0, max:9, step:0.5,
      showIf:{field:'spouseAccompanying', eq:true}, hints:{spouse:true, like:'ielts'}},
  spouseExpCanadaYears: {label:'Spouse Canadian work experience', type:'number', unit:'years', min:0, max:40, step:0.5,
      showIf:{field:'spouseAccompanying', eq:true}, hints:{spouse:true, experience:'canada'}},
  partnerSkillsAU: {label:'Partner skills (Australia)', type:'select', options:[
      {value:'skilled',    label:'Skilled partner (age, English, skills assessment)'},
      {value:'competent',  label:'Partner has competent English'},
      {value:'none',       label:'Partner has neither'},
    ], showIf:{field:'spouseAccompanying', eq:true}},

  // Additional factors — yes/no-style, confirmed together on one card.
  canadaStudy: {label:'Post-secondary study in Canada', type:'select', options:[
      {value:'none',    label:'None',               say:["\\b(?:never|haven't|have not|didn't|did not)\\s+studied in canada\\b"]},
      {value:'short',   label:'1–2 year credential', say:["\\bstudied in canada\\b[^.]{0,40}\\b(?:1|2|one|two)[- ]years?\\b","\\b(?:1|2|one|two)[- ]year (?:diploma|certificate|program|programme|course|degree|college)[^.]{0,30}\\bin canada\\b"]},
      {value:'long',    label:'3+ year credential',  say:["\\bstudied in canada\\b[^.]{0,40}\\b(?:[3-9]|three|four|five)[- ]years?\\b","\\bdegree from (?:a )?canadian\\b"]},
    ]},
  relativeInCanada: {label:'Relative in Canada', type:'select', options:[
      {value:'none',    label:'None',                                 say:["\\bno (?:family|relatives?) in canada\\b","\\bdon't have (?:any )?(?:family|relatives?) in canada\\b"]},
      {value:'sibling', label:'Brother or sister (citizen/PR)',       say:["\\b(?:brother|sister|sibling|bhai|behan|bahen|bhen)\\b[^.]{0,40}\\bcanada\\b","\\bcanada\\b[^.]{0,40}\\b(?:brother|sister|sibling|bhai|behan|bahen)\\b"]},
      {value:'other',   label:'Other close relative (citizen/PR)',    say:["\\b(?:uncle|aunt|parents?|mother|father|niece|nephew|grand(?:mother|father|parents?)|chacha|chachi|mamu|mamoo|khala|phuppo|phupho|taya|tayi)\\b[^.]{0,40}\\bcanada\\b"]},
    ]},
  frenchNclc7: {label:'French at NCLC 7 or higher', type:'boolean',
      hints:{yes:["\\b(?:speak|fluent in|good|strong|know)\\b[^.]{0,20}\\bfrench\\b","\\bfrench\\b[^.]{0,30}\\b(?:nclc|clb)\\s*(?:[7-9]|1[0-2])\\b"],
             no:["\\b(?:don't|do not|can't|cannot|no)\\b[^.]{0,15}\\bfrench\\b"]}},
  provincialNomination: {label:'Provincial nomination (PNP)', type:'boolean',
      hints:{yes:["\\bprovincial nomination\\b(?!\\s*[:\\-–]\\s*(?:no|none)\\b)","\\bpnp\\b(?!\\s*[:\\-–]\\s*(?:no|none)\\b)","\\bnominated by (?:the )?province\\b"],
             no:["\\b(?:no|not|don't have|do not have)\\b[^.]{0,20}\\b(?:provincial nomination|pnp)\\b","\\b(?:provincial nomination|pnp)\\s*[:\\-–]\\s*(?:no|none)\\b"]}},
  jobOfferCanada: {label:'Valid job offer in Canada', type:'boolean',
      hints:{yes:["\\bjob offer\\b[^.]{0,40}\\bcanad","\\bcanad[a-z]*\\b[^.]{0,40}\\bjob offer\\b","\\b(?:have|got|received) (?:a )?job offer\\b"],
             no:["\\b(?:no|don't have|do not have|haven't got|without) (?:a |any )?job offer\\b","\\bjob offer nahi","\\bkoi job offer\\b","\\bjob offer\\s*[:\\-–]\\s*(?:no|none|nahi|n)\\b"]}},
  stateNominationAU: {label:'Australian state/territory nomination', type:'select', options:[
      {value:'none',  label:'None',                                  say:["\\bno (?:state|territory) nomination\\b"]},
      {value:'sc190', label:'State/territory nomination (subclass 190)', say:["\\b(?:state|territory) nomination\\b","\\bsubclass 190\\b","\\b190 visa\\b"]},
      {value:'sc491', label:'Regional nomination/sponsorship (subclass 491)', say:["\\bsubclass 491\\b","\\b491 visa\\b","\\bregional (?:visa|nomination|sponsorship)\\b"]},
    ]},
  australianStudy: {label:'Australian study requirement', type:'boolean', hints:{yes:["\\bstudied in australia\\b","\\baustralian (?:degree|diploma|university)\\b"]}},
  regionalStudyAU: {label:'Study in regional Australia', type:'boolean', hints:{yes:["\\bregional australia\\b[^.]{0,30}\\bstud","\\bstud[a-z]*\\b[^.]{0,30}\\bregional australia\\b"]}},
  specialistEducationAU: {label:'Specialist education (STEM research degree, Australia)', type:'boolean', hints:{yes:["\\b(?:masters? by research|ph\\.?\\s?d|doctorate)\\b[^.]{0,40}\\baustralia"]}},
  professionalYearAU: {label:'Professional Year in Australia', type:'boolean', hints:{yes:["\\bprofessional year\\b"]}},
  communityLanguageAU: {label:'Credentialled community language (NAATI)', type:'boolean', hints:{yes:["\\bnaati\\b","\\bcommunity language\\b"]}},
};

/* How a form field asking for a fact is usually labelled — so any form can be filled from what
   was said, without setting anything up: a field whose label holds every word of one of a fact's
   names is that fact ("Highest completed education" → education). Spouse facts are named without
   the word spouse / partner: they match only fields that mention one, other facts only fields
   that don't. `not`: words that rule a label out ("Second official language — Reading score" isn't
   the IELTS result). A scores fact also needs the part's name (Reading, Writing…). */
const PROFILE_FIELD_NAMES = {
  age:                  {names:['age']},
  maritalStatus:        {names:['marital status', 'married']},
  spouseAccompanying:   {names:['accompanying', 'coming', 'come with', 'join']},
  education:            {names:['education', 'qualification', 'degree']},
  occupation:           {names:['occupation', 'profession', 'job title']},
  ielts:                {names:['language score', 'language result', 'test score', 'ielts'], not:['second', 'french', 'clb']},
  clb:                  {names:['clb'], not:['second']},
  expOtherYears:        {names:['foreign work experience', 'work experience outside', 'overseas work experience']},
  expCanadaYears:       {names:['canadian work experience', 'work experience in canada']},
  expAustraliaYears:    {names:['australian work experience', 'work experience in australia']},
  spouseEducation:      {names:['education', 'qualification']},
  spouseIelts:          {names:['score', 'result', 'ielts']},
  spouseExpCanadaYears: {names:['canadian work experience', 'work experience in canada']},
  partnerSkillsAU:      {names:['partner skills']},
  canadaStudy:          {names:['canadian post secondary', 'post secondary in canada', 'studied in canada', 'study in canada', 'canadian education']},
  relativeInCanada:     {names:['brother sister', 'sibling', 'relative in canada']},
  frenchNclc7:          {names:['french']},
  provincialNomination: {names:['provincial nomination', 'territorial nomination', 'pnp']},
  jobOfferCanada:       {names:['job offer']},
  stateNominationAU:    {names:['state nomination', 'territory nomination']},
  australianStudy:      {names:['australian study']},
  regionalStudyAU:      {names:['regional study', 'study in regional australia']},
  specialistEducationAU:{names:['specialist education']},
  professionalYearAU:   {names:['professional year']},
  communityLanguageAU:  {names:['community language', 'naati']},
};

/* Library order = the order questions are asked in the confirmation wizard. */
const PROFILE_FIELD_ORDER = Object.keys(PROFILE_FIELDS);

const fieldLabelOf = (key) => PROFILE_FIELDS[key]?.label || key;

/* ── Value helpers ────────────────────────────────────────────────────────────────────────── */

/* Read 'ielts.listening' style paths from facts or derived values. */
function readValue(values, path){
  const [head, ...rest] = path.split('.');
  let v = values[head];
  for(const r of rest){ if(v == null) return undefined; v = v[r]; }
  return v;
}

function formatFieldValue(key, value){
  const f = PROFILE_FIELDS[key];
  if(value == null || value === '') return '—';
  if(!f) return String(value);
  if(f.type === 'select') return (f.options.find(o => o.value === value) || {}).label || String(value);
  if(f.type === 'boolean') return value ? 'Yes' : 'No';
  if(f.type === 'number') return `${value}${f.unit ? ' ' + (value === 1 && f.unit.endsWith('s') ? f.unit.slice(0, -1) : f.unit) : ''}`;
  if(f.type === 'scores') return f.parts.map(p => `${p.label[0]} ${value[p.key] ?? '—'}`).join(' · ');
  return String(value);
}

/* The fact keys a call is searched for: `fields` and `factorFields` of what's being filled. */
function templateFieldKeys(template){
  return [...new Set([...(template.fields || []), ...(template.factorFields || [])])];
}

Object.assign(window, {
  PROFILE_FIELDS, PROFILE_FIELD_ORDER, PROFILE_FIELD_NAMES, EDUCATION_OPTIONS, LANGUAGE_SKILLS,
  fieldLabelOf, formatFieldValue, readValue, templateFieldKeys,
});
