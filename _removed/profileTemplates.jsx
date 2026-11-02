/* HOF Pulse ERP — predefined Customer Profile Templates (prototype).

   These are DATA consumed by the generic engine in profileEngine.jsx. Nothing here is code
   the engine depends on; a future template builder would produce objects of this same shape
   and they would be scored identically. Out of scope for the prototype: creating/editing
   templates in the UI, and storing template versions server-side.

   Criteria verified against official sources (September 2026):
     • Canada CRS — canada.ca "Comprehensive Ranking System (CRS) criteria" (page dated
       2026-06-22). Job-offer points were REMOVED on 25 March 2025, so none are awarded here.
     • FSWP — canada.ca "Six selection factors – Federal Skilled Worker Program" (67/100 pass
       mark; minimum CLB 7 in all four abilities; at least 1 year of skilled work).
     • IELTS → CLB — canada.ca Express Entry language test equivalency (IELTS General Training).
     • Australia — immi.homeaffairs.gov.au points tables for subclasses 189/190/491 (updated
       11/06/2026); English levels from the Competent/Proficient/Superior English pages;
       pass mark 65.

   Simplifications for the demo (noted in each template's `notes`): no second-official-language
   points beyond French, no certificate-of-qualification factor, experience counted as whole
   years, and eligibility beyond points (e.g. skills assessments, NOC/ANZSCO occupation lists)
   is out of scope. */

/* IELTS General Training → CLB, per ability (IRCC equivalency). Shared by both Canadian
   templates as data; rows are "at least this band → this CLB". */
const IELTS_CLB = {
  listening: [[8.5,10],[8,9],[7.5,8],[6,7],[5.5,6],[5,5],[4.5,4]],
  reading:   [[8,10],[7,9],[6.5,8],[6,7],[5,6],[4,5],[3.5,4]],
  writing:   [[7.5,10],[7,9],[6.5,8],[6,7],[5.5,6],[5,5],[4,4]],
  speaking:  [[7.5,10],[7,9],[6.5,8],[6,7],[5.5,6],[5,5],[4,4]],
};
const clbDerived = (prefix, source) => [
  ...Object.keys(IELTS_CLB).map(skill => ({key:`${prefix}_${skill}`, op:'threshold', input:`${source}.${skill}`,
    rows: IELTS_CLB[skill].map(([min, out]) => ({min, out})), otherwise:3})),
  {key:`${prefix}Min`, op:'min', inputs:Object.keys(IELTS_CLB).map(s => `${prefix}_${s}`)},
];
const CLB_KEYS = (prefix) => Object.keys(IELTS_CLB).map(s => `${prefix}_${s}`);

/* Scored as having a spouse only when the spouse/partner is coming too (CRS rule). */
const WITH_SPOUSE = {all:[{field:'maritalStatus', in:['married','commonLaw']}, {field:'spouseAccompanying', eq:true}]};
const NO_SPOUSE = {not:WITH_SPOUSE};

/* Ages as [age, withSpouse, withoutSpouse] — CRS age table. */
const CRS_AGE = [[18,90,99],[19,95,105],[20,100,110],[21,100,110],[22,100,110],[23,100,110],[24,100,110],[25,100,110],
  [26,100,110],[27,100,110],[28,100,110],[29,100,110],[30,95,105],[31,90,99],[32,85,94],[33,80,88],[34,75,83],[35,70,77],
  [36,65,72],[37,60,66],[38,55,61],[39,50,55],[40,45,50],[41,35,39],[42,25,28],[43,15,17],[44,5,6]];
const CRS_EDU = {none:[0,0], secondary:[28,30], oneYear:[84,90], twoYear:[91,98], bachelors:[112,120], twoOrMore:[119,128], masters:[126,135], doctoral:[140,150]};
const CRS_LANG = [[10,32,34],[9,29,31],[8,22,23],[7,16,17],[6,8,9],[4,6,6]];   // [min CLB, with, without]
const CRS_CWE = [[5,70,80],[4,63,72],[3,56,64],[2,46,53],[1,35,40]];

const crsCore = (spouse) => {
  const c = spouse ? 1 : 2, when = spouse ? WITH_SPOUSE : NO_SPOUSE;
  return {id: spouse ? 'core-spouse' : 'core', label:`Core / human capital (${spouse ? 'with' : 'without'} spouse)`,
    cap: spouse ? 460 : 500, when, rules:[
      {type:'table', label:'Age', input:'age', rows:CRS_AGE.map(r => ({eq:r[0], points:r[c]}))},
      {type:'table', label:'Level of education', input:'education', rows:Object.entries(CRS_EDU).map(([k, v]) => ({eq:k, points:v[c-1]}))},
      {type:'each', label:'First official language (per ability)', inputs:CLB_KEYS('clb'), rows:CRS_LANG.map(r => ({min:r[0], points:r[c]}))},
      {type:'table', label:'Canadian work experience', input:'cweYears', rows:CRS_CWE.map(r => ({min:r[0], points:r[c]}))},
    ]};
};

const TPL_CRS = {
  id:'canada-crs', version:'2026.09', name:'Canada CRS', createLabel:'Canada CRS Score', framework:'Express Entry — Comprehensive Ranking System',
  scoreLabel:'CRS score', max:1200, threshold:null,
  thresholdNote:'No fixed pass mark — invitation cut-offs vary by draw.',
  requiredLabel:'Varies by draw',
  source:'canada.ca — CRS criteria (page dated 2026-06-22)',
  notes:['Job-offer points removed from CRS on 25 March 2025.', 'Second-language points other than French, and certificate of qualification, are not included in this demo.'],
  fields:['age','maritalStatus','spouseAccompanying','education','occupation','ielts','expOtherYears','expCanadaYears','expAustraliaYears',
          'spouseEducation','spouseIelts','spouseExpCanadaYears'],
  factorFields:['canadaStudy','relativeInCanada','frenchNclc7','provincialNomination'],
  derived:[
    ...clbDerived('clb', 'ielts'),
    ...clbDerived('sclb', 'spouseIelts'),
    {key:'cweYears', op:'sum', inputs:['expCanadaYears']},
    {key:'foreignYears', op:'sum', inputs:['expOtherYears','expAustraliaYears']},        // outside Canada
    {key:'eduTier', op:'map', input:'education', map:{oneYear:'one', twoYear:'one', bachelors:'one', twoOrMore:'two', masters:'two', doctoral:'two'}, otherwise:'none'},
  ],
  groups:[
    crsCore(false),
    crsCore(true),
    {id:'spouse', label:'Spouse / partner factors', cap:40, when:WITH_SPOUSE, rules:[
      {type:'table', label:'Spouse education', input:'spouseEducation', rows:[
        {eq:'secondary',points:2},{eq:'oneYear',points:6},{eq:'twoYear',points:7},{eq:'bachelors',points:8},{eq:'twoOrMore',points:9},{eq:'masters',points:10},{eq:'doctoral',points:10}]},
      {type:'each', label:'Spouse first official language (per ability)', inputs:CLB_KEYS('sclb'), rows:[{min:9,points:5},{min:7,points:3},{min:5,points:1}]},
      {type:'table', label:'Spouse Canadian work experience', input:'spouseExpCanadaYears', rows:[{min:5,points:10},{min:4,points:9},{min:3,points:8},{min:2,points:7},{min:1,points:5}]},
    ]},
    {id:'transfer', label:'Skill transferability', cap:100, parts:[
      {label:'Education', cap:50, rules:[
        {type:'cases', label:'Education + language', pick:'first', cases:[
          {when:{all:[{field:'clbMin',gte:9},{field:'eduTier',eq:'two'}]}, points:50},
          {when:{all:[{field:'clbMin',gte:9},{field:'eduTier',eq:'one'}]}, points:25},
          {when:{all:[{field:'clbMin',gte:7},{field:'eduTier',eq:'two'}]}, points:25},
          {when:{all:[{field:'clbMin',gte:7},{field:'eduTier',eq:'one'}]}, points:13}]},
        {type:'cases', label:'Education + Canadian work experience', pick:'first', cases:[
          {when:{all:[{field:'cweYears',gte:2},{field:'eduTier',eq:'two'}]}, points:50},
          {when:{all:[{field:'cweYears',gte:2},{field:'eduTier',eq:'one'}]}, points:25},
          {when:{all:[{field:'cweYears',gte:1},{field:'eduTier',eq:'two'}]}, points:25},
          {when:{all:[{field:'cweYears',gte:1},{field:'eduTier',eq:'one'}]}, points:13}]},
      ]},
      {label:'Foreign work experience', cap:50, rules:[
        {type:'cases', label:'Foreign work experience + language', pick:'first', cases:[
          {when:{all:[{field:'clbMin',gte:9},{field:'foreignYears',gte:3}]}, points:50},
          {when:{all:[{field:'clbMin',gte:9},{field:'foreignYears',gte:1}]}, points:25},
          {when:{all:[{field:'clbMin',gte:7},{field:'foreignYears',gte:3}]}, points:25},
          {when:{all:[{field:'clbMin',gte:7},{field:'foreignYears',gte:1}]}, points:13}]},
        {type:'cases', label:'Foreign + Canadian work experience', pick:'first', cases:[
          {when:{all:[{field:'cweYears',gte:2},{field:'foreignYears',gte:3}]}, points:50},
          {when:{all:[{field:'cweYears',gte:2},{field:'foreignYears',gte:1}]}, points:25},
          {when:{all:[{field:'cweYears',gte:1},{field:'foreignYears',gte:3}]}, points:25},
          {when:{all:[{field:'cweYears',gte:1},{field:'foreignYears',gte:1}]}, points:13}]},
      ]},
    ]},
    {id:'additional', label:'Additional points', cap:600, rules:[
      {type:'table', label:'Provincial or territorial nomination', input:'provincialNomination', rows:[{eq:true, points:600}]},
      {type:'table', label:'Brother or sister in Canada', input:'relativeInCanada', rows:[{eq:'sibling', points:15}]},
      {type:'cases', label:'French language skills (NCLC 7+)', pick:'first', cases:[
        {when:{all:[{field:'frenchNclc7',eq:true},{field:'clbMin',gte:5}]}, points:50},
        {when:{field:'frenchNclc7',eq:true}, points:25}]},
      {type:'table', label:'Post-secondary education in Canada', input:'canadaStudy', rows:[{eq:'long', points:30},{eq:'short', points:15}]},
    ]},
  ],
};

const TPL_FSWP = {
  id:'fswp', version:'2026.09', name:'Federal Skilled Worker Program', createLabel:'Federal Skilled Worker Program', framework:'FSWP — six selection factors',
  scoreLabel:'Selection points', max:100, threshold:67,
  thresholdNote:'67 points or higher may qualify.',
  source:'canada.ca — FSWP six selection factors',
  notes:['Language uses the first official language (IELTS); French counts as the second official language.', 'Skilled work experience = all skilled work in the last 10 years, in Canada or abroad.'],
  fields:['age','maritalStatus','spouseAccompanying','education','occupation','ielts','expOtherYears','expCanadaYears','expAustraliaYears',
          'spouseIelts','spouseExpCanadaYears'],
  factorFields:['jobOfferCanada','canadaStudy','relativeInCanada','frenchNclc7'],
  derived:[
    ...clbDerived('clb', 'ielts'),
    ...clbDerived('sclb', 'spouseIelts'),
    {key:'workYears', op:'sum', inputs:['expOtherYears','expCanadaYears','expAustraliaYears']},
    {key:'studiedInCanada', op:'cond', when:{field:'canadaStudy', in:['short','long']}},
  ],
  gates:[
    {label:'Minimum CLB 7 in all four language abilities', when:{field:'clbMin', gte:7}},
    {label:'At least 1 year of continuous skilled work experience', when:{field:'workYears', gte:1}},
  ],
  groups:[
    {id:'language', label:'Language skills', cap:28, rules:[
      {type:'each', label:'First official language (per ability)', inputs:CLB_KEYS('clb'), rows:[{min:9,points:6},{min:8,points:5},{min:7,points:4}]},
      {type:'table', label:'Second official language (French, CLB 5+ in all)', input:'frenchNclc7', rows:[{eq:true, points:4}]},
    ]},
    {id:'education', label:'Education', cap:25, rules:[
      {type:'table', label:'Level of education', input:'education', rows:[
        {eq:'doctoral',points:25},{eq:'masters',points:23},{eq:'twoOrMore',points:22},{eq:'bachelors',points:21},{eq:'twoYear',points:19},{eq:'oneYear',points:15},{eq:'secondary',points:5}]},
    ]},
    {id:'experience', label:'Work experience', cap:15, rules:[
      {type:'table', label:'Years of skilled work experience', input:'workYears', rows:[{min:6,points:15},{min:4,points:13},{min:2,points:11},{min:1,points:9}]},
    ]},
    {id:'age', label:'Age', cap:12, rules:[
      {type:'table', label:'Age', input:'age', rows:[{min:18,max:35,points:12},{eq:36,points:11},{eq:37,points:10},{eq:38,points:9},{eq:39,points:8},
        {eq:40,points:7},{eq:41,points:6},{eq:42,points:5},{eq:43,points:4},{eq:44,points:3},{eq:45,points:2},{eq:46,points:1}]},
    ]},
    {id:'employment', label:'Arranged employment in Canada', cap:10, rules:[
      {type:'table', label:'Valid job offer (1+ year, TEER 0–3)', input:'jobOfferCanada', rows:[{eq:true, points:10}]},
    ]},
    {id:'adaptability', label:'Adaptability', cap:10, rules:[
      {type:'cases', label:'Spouse language CLB 4+ in all abilities', cases:[{when:{all:[WITH_SPOUSE,{field:'sclbMin',gte:4}]}, points:5}]},
      {type:'table', label:'Your past studies in Canada', input:'studiedInCanada', rows:[{eq:true, points:5}]},
      {type:'table', label:'Your past work in Canada (1+ year)', input:'expCanadaYears', rows:[{min:1, points:10}]},
      {type:'cases', label:'Spouse past work in Canada (1+ year)', cases:[{when:{all:[WITH_SPOUSE,{field:'spouseExpCanadaYears',gte:1}]}, points:5}]},
      {type:'table', label:'Arranged employment', input:'jobOfferCanada', rows:[{eq:true, points:5}]},
      {type:'table', label:'Relative in Canada', input:'relativeInCanada', rows:[{in:['sibling','other'], points:5}]},
    ]},
  ],
};

const TPL_AU = {
  id:'australia-points', version:'2026.09', name:'Australian Skilled Migration', createLabel:'Australian Points System', framework:'Points test — subclasses 189 / 190 / 491',
  scoreLabel:'Points', max:null, threshold:65,
  thresholdNote:'Pass mark 65 points.',
  source:'immi.homeaffairs.gov.au — points tables (updated 11/06/2026)',
  notes:['Employment points are capped at 20 combined.', 'A skills assessment in a nominated occupation is also required (not scored here).'],
  fields:['age','maritalStatus','spouseAccompanying','education','occupation','ielts','expOtherYears','expCanadaYears','expAustraliaYears','partnerSkillsAU'],
  factorFields:['stateNominationAU','australianStudy','regionalStudyAU','specialistEducationAU','professionalYearAU','communityLanguageAU'],
  derived:[
    {key:'ieltsMin', op:'min', inputs:['ielts.listening','ielts.reading','ielts.writing','ielts.speaking']},
    {key:'englishLevel', op:'threshold', input:'ieltsMin', rows:[{min:8,out:'superior'},{min:7,out:'proficient'},{min:6,out:'competent'}], otherwise:'below'},
    {key:'overseasYears', op:'sum', inputs:['expOtherYears','expCanadaYears']},     // outside Australia
    {key:'singleOrNoPartner', op:'cond', when:{field:'maritalStatus', in:['single','divorced','widowed']}},
  ],
  gates:[
    {label:'Under 45 years of age', when:{field:'age', lt:45}},
    {label:'At least Competent English (IELTS 6 in each component)', when:{field:'englishLevel', in:['competent','proficient','superior']}},
  ],
  groups:[
    {id:'age', label:'Age', rules:[
      {type:'table', label:'Age', input:'age', rows:[{min:18,max:24,points:25},{min:25,max:32,points:30},{min:33,max:39,points:25},{min:40,max:44,points:15}]}]},
    {id:'english', label:'English language', rules:[
      {type:'table', label:'English level', input:'englishLevel', rows:[{eq:'superior',points:20},{eq:'proficient',points:10},{eq:'competent',points:0}]}]},
    {id:'employment', label:'Skilled employment (last 10 years)', cap:20, rules:[
      {type:'table', label:'Outside Australia', input:'overseasYears', rows:[{min:8,points:15},{min:5,points:10},{min:3,points:5}]},
      {type:'table', label:'In Australia', input:'expAustraliaYears', rows:[{min:8,points:20},{min:5,points:15},{min:3,points:10},{min:1,points:5}]}]},
    {id:'education', label:'Educational qualifications', rules:[
      {type:'table', label:'Highest qualification', input:'education', rows:[
        {eq:'doctoral',points:20},{in:['bachelors','twoOrMore','masters'],points:15},{in:['oneYear','twoYear'],points:10}]}]},
    {id:'other', label:'Other factors', rules:[
      {type:'table', label:'Specialist education (STEM research, Australia)', input:'specialistEducationAU', rows:[{eq:true,points:10}]},
      {type:'table', label:'Australian study requirement', input:'australianStudy', rows:[{eq:true,points:5}]},
      {type:'table', label:'Professional Year in Australia', input:'professionalYearAU', rows:[{eq:true,points:5}]},
      {type:'table', label:'Credentialled community language', input:'communityLanguageAU', rows:[{eq:true,points:5}]},
      {type:'table', label:'Study in regional Australia', input:'regionalStudyAU', rows:[{eq:true,points:5}]}]},
    {id:'partner', label:'Partner', rules:[
      {type:'cases', label:'Partner points', pick:'first', cases:[
        {when:{field:'singleOrNoPartner', eq:true}, points:10, note:'Single'},
        {when:{all:[WITH_SPOUSE,{field:'partnerSkillsAU', eq:'skilled'}]}, points:10, note:'Skilled partner'},
        {when:{all:[WITH_SPOUSE,{field:'partnerSkillsAU', eq:'competent'}]}, points:5, note:'Partner with competent English'}]}]},
    {id:'nomination', label:'Nomination', rules:[
      {type:'table', label:'State/territory nomination or sponsorship', input:'stateNominationAU', rows:[{eq:'sc491',points:15},{eq:'sc190',points:5}]}]},
  ],
};

const PROFILE_TEMPLATES = [TPL_CRS, TPL_FSWP, TPL_AU];
const templateById = (id) => PROFILE_TEMPLATES.find(t => t.id === id);

/* How a template's result reads: "X / 1,200", "X / 100 · threshold 67", "X points · pass mark 65". */
function scoreHeadline(template, result){
  const n = (x) => Number(x).toLocaleString('en-US');
  if(template.max && template.threshold != null) return `${n(result.total)} / ${n(template.max)}`;
  if(template.max) return `${n(result.total)} / ${n(template.max)}`;
  return `${n(result.total)} points`;
}

Object.assign(window, {PROFILE_TEMPLATES, templateById, scoreHeadline});
