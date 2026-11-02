/* HOF Pulse ERP — prototype extractor.

   PROTOTYPE STAND-IN FOR AI EXTRACTION. It runs in the browser on the real transcript text and
   uses each field's `hints` from the shared field library — no field or country is special-
   cased here. In production this step would be an AI model (server-side) returning the same
   shape; the review wizard and scoring don't change.

   Output per field:
     {status:'found', value, evidence:[{quote, at}], confidence:'high'|'medium'|'low', note?}
     {status:'conflict', candidates:[{value, evidence}], …}   different values were mentioned
     {status:'notFound'}                                       nothing relevant was said
*/

/* ── Normalising speech ──────────────────────────────────────────────────────────────────── */

const NUM_WORDS = {zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, eleven:11,
  twelve:12, thirteen:13, fourteen:14, fifteen:15, sixteen:16, seventeen:17, eighteen:18, nineteen:19};
const TENS = {twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90};

/* Speech engines often write numbers as words ("seven point five", "twenty nine"). */
function normaliseNumbers(text){
  let t = ' ' + text.toLowerCase().replace(/[’`]/g, "'") + ' ';
  t = t.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-]+(one|two|three|four|five|six|seven|eight|nine)\b/g,
                (m, a, b) => String(TENS[a] + NUM_WORDS[b]));
  t = t.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/g, (m, a) => String(TENS[a]));
  t = t.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\b/g,
                (m, a) => String(NUM_WORDS[a]));
  t = t.replace(/\b(\d+)\s+(?:point|dot)\s+(\d)\b/g, '$1.$2');
  t = t.replace(/\b(\d+)\s+and a half\b/g, (m, a) => String(Number(a) + 0.5));
  t = t.replace(/\b(\d+)\s*\+\s*/g, '$1 ');
  return normaliseUrdu(t).replace(/\s+/g, ' ').trim();
}

/* Romanised Urdu / mixed speech → the English forms the field hints look for. Only phrase
   shapes are rewritten; nothing is added that was not said. Urdu number words are converted
   only next to a unit or score word ("paanch saal", "saadhe saat"), because some of them are
   also English words ("do"). */
const URDU_NUM = {ek:1, do:2, teen:3, char:4, chaar:4, paanch:5, panch:5, chay:6, chhe:6, che:6, saat:7, aath:8, nau:9, das:10};
const URDU_NUM_RX = '(ek|do|teen|chaa?r|paa?nch|chh?a?y|chhe|che|saat|aath|nau|das)';
function normaliseUrdu(t){
  const n = (w) => URDU_NUM[w] ?? URDU_NUM[w.replace('aa','a')] ?? w;
  t = t.replace(new RegExp(`\\bsaa?dhe\\s+${URDU_NUM_RX}\\b`, 'g'), (m, w) => String(Number(n(w)) + 0.5));
  t = t.replace(/\bsaa?dhe\s+(\d+)\b/g, (m, d) => String(Number(d) + 0.5));
  t = t.replace(new RegExp(`\\b${URDU_NUM_RX}\\s+(saal|years?|point)\\b`, 'g'), (m, w, u) => `${n(w)} ${u}`);
  t = t.replace(/\b(\d+(?:\.\d+)?)\s+saal\s+(?:ka|ki|ke)\s+(?:tajurb[a-z]*|tajrub[a-z]*|experience|kaam)\b/g, '$1 years of experience');
  t = t.replace(/\b(\d{2})\s+saal\s+(?:ka|ki|ke)\s+(?:hoon|hun|hu|hai|hain|hoo)\b/g, '$1 years old');
  t = t.replace(/\b(?:tajurb[a-z]*|tajrub[a-z]*)\b/g, 'experience');
  t = t.replace(/\b(?:umar|umr|umer)\b/g, 'age');
  t = t.replace(/\bsaal\b/g, 'years');
  t = t.replace(/\b(?:naukri)\b/g, 'job');
  t = t.replace(/\bkaam\s+(?:kar|kiya|karta|karti|karte)\b/g, 'worked');
  return t;
}

const SPOUSE_WORDS = /\b(wife|husband|spouse|partner|biwi|bivi|begum|shohar|shauhar|gharwali)\b/i;
const SPOUSE_PRONOUN = /\b(she|her|hers|he|his|him|unki|unka|uski|uska|inki|inka|woh|wo)\b/i;
/* Statements of intent are not facts: "I want to do a master's", "I plan to work in Canada". */
const INTENT = /\b(want|wants|wanted to|plan|plans|planning|hope|hoping|will|would like|going to|looking (?:for|to)|intend|intends|chahta|chahti|chahte|karunga|karungi|karenge)\b/;

/* Transcript segments → matchable units. Spoken answers mix people in one breath ("I'm 29 and
   I'm married, my wife will come with me"), so each sentence is split into clauses and each
   clause decides whether it is about the applicant or the spouse/partner:
     • a clause naming the spouse ("my wife…") is about the spouse;
     • a clause with "I / my / me" is about the applicant;
     • otherwise it inherits from the previous clause, and a sentence that only says
       "she/her/he/his" right after a spouse clause is about the spouse ("Her IELTS is 7").
   `raw` is always the whole sentence, so evidence quotes read naturally. */
const FIRST_PERSON = /\b(i|i'm|im|i've|my|me|mine|main|mai|mera|meri|mere|mujhe)\b/i;
function transcriptSentences(segments){
  const out = [];
  let lastSentenceSpouse = false;      // did the previous sentence talk about the spouse at all
  segments.forEach(seg => {
    seg.text.split(/(?<=[.?!])\s+/).forEach(part => {
      const raw = part.trim(); if(!raw) return;
      const sentNorm = normaliseNumbers(raw);
      if(isQuestion(raw, sentNorm)) return;                    // "Are you married?" is not a fact
      let prevClause = false, anySpouse = false;
      sentNorm.split(/\s*(?:,|;|\band\b|\bbut\b|\bwhile\b)\s*/).filter(Boolean).forEach((clause, i) => {
        let spouse;
        if(SPOUSE_WORDS.test(clause)) spouse = true;
        else if(FIRST_PERSON.test(clause)) spouse = false;
        else if(SPOUSE_PRONOUN.test(clause)) spouse = i === 0 ? lastSentenceSpouse : prevClause || lastSentenceSpouse;
        else spouse = i === 0 ? false : prevClause;
        out.push({raw, norm:clause, sentNorm, spouse, at:seg.offsetMs, source:seg.source});   // at = ms into the call
        prevClause = spouse; anySpouse = anySpouse || spouse;
      });
      lastSentenceSpouse = anySpouse;
    });
  });
  return out;
}

/* Questions — typical of the consultant's side of a pasted transcript — carry no facts. */
const QUESTION_START = /^(?:are you|are your|do you|did you|have you|has your|is your|was your|were you|what|what's|how|when|where|which|can you|could you|would you|will you|kya)\b/;
const isQuestion = (raw, norm) => /\?\s*$/.test(raw) || QUESTION_START.test(norm);

/* Pasted transcript (any calling or meeting tool) → transcript segments. Handles one line per
   utterance with optional timestamps ("[00:01:23]", "0:42 -") and speaker labels ("Ali:",
   "Customer -"); a single block of text works too. */
function parseTranscriptText(text){
  return (text || '').split(/\r?\n/).map(line => {
    let t = line.trim(); if(!t) return null;
    let offsetMs = null;
    const ts = t.match(/^[\[(]?\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,]\d+)?\s*[\])]?\s*[-–—]?\s*/);
    if(ts){ offsetMs = ((Number(ts[1] || 0) * 60 + Number(ts[2])) * 60 + Number(ts[3])) * 1000; t = t.slice(ts[0].length); }
    let speaker = null;
    const sp = t.match(/^([A-Za-z][A-Za-z .'-]{0,38}?)\s*[:\-–]\s+(?=\S)/);
    if(sp && !/\d/.test(sp[1])){ speaker = sp[1].trim(); t = t.slice(sp[0].length); }
    return t ? {text:t, offsetMs, speaker, source:'pasted'} : null;
  }).filter(Boolean);
}

const rx = (p) => new RegExp(p, 'i');

/* ── Per-type extractors ─────────────────────────────────────────────────────────────────── */

function extractNumber(field, sentences){
  const hits = [];
  sentences.forEach(s => {
    if(field.hints.exclude && (s.spouse || field.hints.exclude.some(w => new RegExp(`\\b${w}\\b`).test(s.norm)))) return;
    for(const p of field.hints.patterns){
      const m = s.norm.match(rx(p));
      if(m){ const v = Number(m[1]); if(!isNaN(v) && v >= (field.min ?? -Infinity) && v <= (field.max ?? Infinity)){ hits.push({value:v, s}); break; } }
    }
  });
  return hits;
}

/* Work experience by location: the sentence's mention of Canada/Australia decides which
   field a "N years" belongs to. Spouse sentences only feed spouse fields. */
function extractExperience(field, sentences){
  const where = field.hints.experience, spouse = !!field.hints.spouse, hits = [];
  sentences.forEach(s => {
    if(!/\b(experience|exp|worked|working|work|job|employed|employment)\b/.test(s.sentNorm)) return;
    if(s.spouse !== spouse) return;
    const inCanada = /\bcanad/.test(s.norm), inAus = /\baustrali/.test(s.norm);
    const loc = inCanada ? 'canada' : inAus ? 'australia' : 'other';
    if(loc !== where) return;
    if(INTENT.test(s.norm) || /\b(?:old|age)\b/.test(s.norm)) return;       // plans, or an age
    const y = s.norm.match(/\b(\d+(?:\.\d+)?)\s*(?:years?|yrs?|y)\b(?!\s*old)/);
    const mo = !y && s.norm.match(/\b(\d+)\s*months?\b/);
    const v = y ? Number(y[1]) : mo ? Math.round(Number(mo[1]) / 12 * 10) / 10 : null;
    if(v != null && v <= (field.max ?? 40)) hits.push({value:v, s});
  });
  return hits;
}

function extractSelect(field, sentences, library){
  const hints = field.hints || {}, hits = [], seenSent = new Set();
  const options = field.options.filter(o => o.say && o.say.length);
  const src = hints.like ? library[hints.like].options : null;
  sentences.forEach(s => {
    if(hints.spouse && !s.spouse) return;
    if(hints.exclude && !hints.spouse && (s.spouse || hints.exclude.some(w => new RegExp(`\\b${w}\\b`).test(s.norm)))) return;
    if(hints.excludeWords && hints.excludeWords.some(w => new RegExp(`\\b${w}\\b`).test(s.norm))) return;
    const likeHints = hints.like ? (library[hints.like].hints || {}) : {};
    if((hints.ignoreIntent || likeHints.ignoreIntent) && INTENT.test(s.norm)) return;
    const personal = !!(hints.exclude || hints.spouse || hints.clause);
    const text = personal ? s.norm : s.sentNorm;       // person-specific facts per clause, others per sentence
    if(!personal){ if(seenSent.has(s.raw)) return; seenSent.add(s.raw); }
    const opts = src ? src.filter(o => o.say && o.say.length) : options;
    // Within one sentence the first matching option wins (options are listed so that
    // negations like "not married" come before the plain term).
    for(const o of opts){ if(o.say.some(p => rx(p).test(text))){ hits.push({value:o.value, s}); break; } }
  });
  if(field.pickHighest && hits.length){
    const order = field.options.map(o => o.value);
    const top = hits.reduce((a, b) => order.indexOf(b.value) > order.indexOf(a.value) ? b : a);
    const others = [...new Set(hits.map(h => h.value))].filter(v => v !== top.value);
    return [{...top, note: others.length ? 'Highest level mentioned; lower levels were also mentioned.' : null, forceSingle:true, all:hits}];
  }
  return hits;
}

/* Yes/no factors read the whole sentence ("my wife and kids will join me" must not be split). */
function extractBoolean(field, sentences){
  const hits = [], seen = new Set();
  sentences.forEach(s => {
    if(seen.has(s.raw)) return; seen.add(s.raw);
    if(field.hints.no && field.hints.no.some(p => rx(p).test(s.sentNorm))){ hits.push({value:false, s}); return; }
    if(field.hints.yes && field.hints.yes.some(p => rx(p).test(s.sentNorm))) hits.push({value:true, s});
  });
  return hits;
}

function extractText(field, sentences){
  const hits = [];
  sentences.forEach(s => {
    for(const p of field.hints.patterns){
      const m = s.norm.match(rx(p));
      if(m){
        const v = m[1].trim().replace(/\s+/g, ' ');
        if(!v || (field.hints.reject || []).some(r => v.startsWith(r))) continue;
        const acc = field.hints.accept;
        if(acc){
          const last = v.split(' ').pop();
          const ok = acc.words.includes(last) || (new RegExp(acc.endings).test(last) && !acc.notWords.includes(last));
          if(!ok) continue;
        }
        hits.push({value:v.replace(/\b\w/g, c => c.toUpperCase()), s}); break;
      }
    }
  });
  return hits;
}

/* Test scores with parts (e.g. listening/reading/writing/speaking). Accepts conversational
   forms — "listening 8", "my listening score was 7.5", "mera speaking score 6.5 hai",
   "7 in writing", "listening mein 7". Only valid band values (0–9 in steps of 0.5) count. */
const isBand = (v) => v >= 0 && v <= 9 && Math.round(v * 2) === v * 2;
/* Shorthand used in notes ("L 7.5, R 7.5, W 7.5, S 6.5"); only counted inside an IELTS/band
   sentence and only when a band follows immediately. */
const SCORE_ALIASES = {listening:'l|lis|lstn', reading:'r|rd|read', writing:'w|wr|wrt', speaking:'s|sp|spk'};
function extractScores(field, sentences, library){
  const spouse = !!field.hints.spouse;
  const ctx = (field.hints.context || library[field.hints.like]?.hints.context || []);
  const notCtx = (field.hints.notContext || library[field.hints.like]?.hints.notContext || []);
  // Valid values: band scores (0–9 in halves), or whole levels within the field's range (CLB).
  const ok = field.hints.integer ? (v) => Number.isInteger(v) && v >= (field.min ?? 0) && v <= (field.max ?? 12) : isBand;
  const found = {};
  sentences.forEach(s => {
    if(s.spouse !== spouse) return;
    if(!ctx.some(p => rx(p).test(s.sentNorm))) return;
    if(notCtx.some(p => rx(p).test(s.sentNorm))) return;
    // One level for every part ("CLB 9 in all four abilities").
    const all = field.hints.all && s.sentNorm.match(rx(field.hints.all));
    if(all && ok(Number(all[1]))){ field.parts.forEach(pt => (found[pt.key] = found[pt.key] || []).push({value:Number(all[1]), s})); return; }
    field.parts.forEach(pt => {
      const short = SCORE_ALIASES[pt.key];
      const c = short && s.norm.match(new RegExp(`(?:^|[^a-z'])(?:${short})\\s*[:=\\-]?\\s*(\\d{1,2}(?:\\.\\d)?)\\b`));
      const a = s.norm.match(new RegExp(`\\b${pt.key}\\b(?:\\s+(?:score|band|result|marks?|level))?(?:\\s+(?:was|is|were|of|mein|me|main|pe|par|:))?\\D{0,12}?(\\d{1,2}(?:\\.\\d)?)\\b`));
      const b = s.norm.match(new RegExp(`\\b(\\d{1,2}(?:\\.\\d)?)\\s*(?:band\\s*)?(?:in|for|on|mein)\\s+(?:the\\s+)?${pt.key}\\b`));
      const m = a || b || c;
      if(m){ const v = Number(m[1]); if(ok(v)) (found[pt.key] = found[pt.key] || []).push({value:v, s}); }
    });
  });
  return {found};
}

/* ── Run ─────────────────────────────────────────────────────────────────────────────────── */

function summarise(hits, forceSingle){
  if(!hits.length) return {status:'notFound'};
  const distinct = [...new Set(hits.map(h => JSON.stringify(h.value)))];
  const ev = (hs) => hs.map(h => ({quote:h.s.raw, at:h.s.at})).filter((e, i, arr) => arr.findIndex(x => x.quote === e.quote) === i);
  if(distinct.length > 1 && !forceSingle){
    return {status:'conflict', candidates: distinct.map(d => {
      const hs = hits.filter(h => JSON.stringify(h.value) === d);
      return {value:JSON.parse(d), evidence:ev(hs)};
    })};
  }
  const first = hits[0];
  return {status:'found', value:first.value, evidence:ev(first.all || hits),
          confidence: hits.length > 1 || forceSingle ? 'high' : 'medium', note:first.note || null};
}

function extractField(key, sentences, library = PROFILE_FIELDS){
  const f = library[key];
  const hints = f.hints || {};
  if(f.type === 'scores'){
    const {found} = extractScores(f, sentences, library);
    const value = {}, evidence = [], conflictParts = {}, missing = [];
    f.parts.forEach(pt => {
      const hs = found[pt.key] || [];
      const distinct = [...new Set(hs.map(h => h.value))];
      hs.forEach(h => evidence.push({quote:h.s.raw, at:h.s.at}));
      if(distinct.length === 1) value[pt.key] = distinct[0];
      else if(distinct.length > 1) conflictParts[pt.key] = distinct;      // contradictory → left unresolved
      else missing.push(pt.label);                                          // not stated → left empty, never guessed
    });
    const uniqEv = evidence.filter((e, i) => evidence.findIndex(x => x.quote === e.quote) === i);
    if(!Object.keys(value).length && !Object.keys(conflictParts).length) return {status:'notFound'};
    return {status:'found', value, evidence:uniqEv, conflictParts,
            confidence: missing.length || Object.keys(conflictParts).length ? 'low' : 'high'};
  }
  let hits = [];
  if(hints.experience) hits = extractExperience(f, sentences);
  else if(f.type === 'number') hits = hints.patterns ? extractNumber(f, sentences) : [];
  else if(f.type === 'select') hits = extractSelect(f, sentences, library);
  else if(f.type === 'boolean') hits = hints.yes || hints.no ? extractBoolean(f, sentences) : [];
  else if(f.type === 'text') hits = hints.patterns ? extractText(f, sentences) : [];
  return summarise(hits, hits[0] && hits[0].forceSingle);
}

/* Extract every field any of the given templates needs. Facts are shared, so a field used by
   several templates is extracted — and later confirmed — once. */
function runExtraction(segments, templates){
  const sentences = transcriptSentences(segments);
  const keys = PROFILE_FIELD_ORDER.filter(k => templates.some(t => templateFieldKeys(t).includes(k)));
  const results = {};
  keys.forEach(k => { results[k] = extractField(k, sentences); });
  return {keys, results, sentenceCount:sentences.length};
}

/* Sales Notes → segments: one line per note line, no timestamps. Bullets are dropped and a
   dash / equals label separator ("Age - 32", "Exp = 3 yrs") is read as "Label: value", so it
   isn't mistaken for a minus sign. */
function parseNotesText(text){
  return (text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    .map(t => t.replace(/^[-–—•*]\s*/, '').replace(/^([a-z][a-z .'\/]{0,30}?)\s*[-–—=]\s+(?=\S)/i, '$1: '))
    .map(t => ({text:t, offsetMs:null, source:'notes'}));
}

/* Extract from Sales Notes and the transcript, then merge per field with NOTES FIRST:
     • notes only → notes value           • transcript only → transcript value (fills gaps)
     • both agree → notes value           • both differ → notes value, with the transcript's
                                            value attached as `alt` so the conflict is shown
   A value is never silently replaced by the transcript. Composite values (IELTS) merge per part. */
function runProfileExtraction({notes = [], transcript = []}, templates, transcriptOrigin = 'call'){
  const a = runExtraction(notes, templates), b = runExtraction(transcript, templates);
  const results = {};
  a.keys.forEach(k => {
    const n = a.results[k], t = b.results[k];
    const tag = (r, origin) => r.status === 'notFound' ? r : {...r, origin};
    if(n.status === 'notFound'){ results[k] = tag(t, transcriptOrigin); return; }
    if(n.status === 'conflict' || t.status !== 'found'){ results[k] = tag(n, 'notes'); return; }
    if(PROFILE_FIELDS[k].type === 'scores'){
      const value = {...t.value, ...n.value}, altParts = {};
      Object.keys(n.value).forEach(p => { if(t.value[p] != null && t.value[p] !== n.value[p]) altParts[p] = t.value[p]; });
      const conflictParts = {...(t.conflictParts || {}), ...(n.conflictParts || {})};
      Object.keys(n.value).forEach(p => { if(conflictParts[p] && n.value[p] != null) delete conflictParts[p]; });
      const filledFromTranscript = Object.keys(t.value).some(p => n.value[p] == null);
      results[k] = {...n, value, conflictParts, origin:'notes', evidence:[...n.evidence, ...(filledFromTranscript ? t.evidence : [])],
                    alt: Object.keys(altParts).length ? {value:{...value, ...altParts}, parts:altParts, evidence:t.evidence, origin:transcriptOrigin} : null};
      return;
    }
    const same = JSON.stringify(n.value) === JSON.stringify(t.value);
    results[k] = {...n, origin:'notes', alt: same ? null : {value:t.value, evidence:t.evidence, origin:transcriptOrigin}};
  });
  return {keys:a.keys, results};
}

Object.assign(window, {runExtraction, runProfileExtraction, normaliseNumbers, parseTranscriptText, parseNotesText});
