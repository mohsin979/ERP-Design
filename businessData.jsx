/* HOF Pulse ERP — the business data the sample workspace runs on (≈1,000 contacts).

   Generated once (seeded, reproducible), then added to the workspace's own records like the
   other sample records: by id, never over a record that exists, never twice (App records that it
   was added: settings `seededBusiness`). Everything follows the data model as it is:

     Contact  → its Deal (Contact → Deal, one-to-many; most people have one)  → its Customer (a won
     deal becomes a customer the way Create Customer makes one: the service pipeline for the deal's
     pipeline, linked to the deal and the contact).

   Each deal is simulated through its pipeline (US NIW, or Australia and Canada) day by day, so its
   history is consistent with where it is now:
     Qualified Client  → the CCL (a quotation) is drafted, sent and signed before CCL Sent;
     CCL Sent          → Last Month Rollover when it sat there over a month, then Expected Sale
                         (its Expected Close Date set on entry);
     Expected Sale     → Payment Made once the first installment is paid in Accounting;
     Payment Made      → Deal Won, its customer created;
     Deal Lost         → only after at least four calls;   Postponed — set aside.
   Accounting: the signed CCL's payment terms (pulled from the quote), each installment invoiced
   (`invoicedAt`) when it falls due and paid (payments) as the client paid. Calls, emails, notes,
   meetings and tasks are dated along the way. Dates are relative to the day it's generated. */

const BUSINESS_DATA_VERSION = 'b1';
const BIZ_DAY = 864e5;

function bizRng(seed){ let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const BIZ_FIRST_M = ['Ahmed', 'Ali', 'Usman', 'Hassan', 'Bilal', 'Hamza', 'Faisal', 'Imran', 'Kamran', 'Omar', 'Saad', 'Zain', 'Fahad', 'Rizwan', 'Adnan', 'Waqas', 'Junaid', 'Asad', 'Shahid', 'Tariq',
  'Rohan', 'Arjun', 'Vikram', 'Rahul', 'Karan', 'Mohammed', 'Khalid', 'Youssef', 'Karim', 'Tarek', 'Mahmoud', 'Samir', 'Chinedu', 'Emeka', 'Tunde', 'Jose', 'Mark', 'Reza', 'Amir', 'Danish'];
const BIZ_FIRST_F = ['Ayesha', 'Fatima', 'Sana', 'Hira', 'Mahnoor', 'Zainab', 'Maryam', 'Amna', 'Rabia', 'Nida', 'Areeba', 'Iqra', 'Sadia', 'Mehwish', 'Kiran', 'Anam', 'Laiba', 'Hafsa', 'Saba', 'Noor',
  'Priya', 'Ananya', 'Sneha', 'Pooja', 'Layla', 'Nour', 'Salma', 'Dina', 'Rania', 'Ngozi', 'Aisha', 'Maria', 'Grace', 'Sara', 'Shirin', 'Neha', 'Alina', 'Yasmin', 'Huma', 'Farah'];
const BIZ_LAST = ['Khan', 'Ahmed', 'Malik', 'Hussain', 'Raza', 'Sheikh', 'Qureshi', 'Siddiqui', 'Chaudhry', 'Butt', 'Iqbal', 'Farooq', 'Javed', 'Aslam', 'Mirza', 'Abbasi', 'Hashmi', 'Rizvi', 'Bhatti', 'Anwar',
  'Sharma', 'Patel', 'Mehta', 'Nair', 'Reddy', 'Iyer', 'Haddad', 'Mansour', 'Saleh', 'Nasser', 'Hamdan', 'Okafor', 'Adeyemi', 'Okonkwo', 'Santos', 'Reyes', 'Karimi', 'Tehrani', 'Rahman', 'Hossain'];
// Where people are: [country (the Country property's name), dialing code, cities].
const BIZ_PLACES = [
  ['Pakistan', '92', ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad'], 30],
  ['United Arab Emirates', '971', ['Dubai', 'Abu Dhabi', 'Sharjah'], 22],
  ['India', '91', ['Mumbai', 'Bengaluru', 'Hyderabad', 'Delhi', 'Chennai'], 14],
  ['Saudi Arabia', '966', ['Riyadh', 'Jeddah', 'Dammam'], 8],
  ['Egypt', '20', ['Cairo', 'Alexandria'], 6],
  ['Nigeria', '234', ['Lagos', 'Abuja'], 6],
  ['Philippines', '63', ['Manila', 'Cebu'], 5],
  ['Bangladesh', '880', ['Dhaka', 'Chattogram'], 5],
  ['Jordan', '962', ['Amman'], 2],
  ['Iran', '98', ['Tehran', 'Isfahan'], 2],
];
// Profession → [job titles, industry (an Industry option), employers].
const BIZ_WORK = [
  [['Software Engineer', 'Senior Software Engineer', 'Data Scientist', 'DevOps Engineer', 'Product Manager'], 'Technology', ['Systems Ltd', 'Careem', 'Infosys', 'Netsol', 'Emirates NBD Tech', 'Wipro', 'Andela']],
  [['Physician', 'Nurse', 'Pharmacist', 'Dentist', 'Medical Researcher'], 'Healthcare', ['Aga Khan University Hospital', 'Cleveland Clinic Abu Dhabi', 'Shaukat Khanum', 'Apollo Hospitals', 'Mediclinic']],
  [['Civil Engineer', 'Mechanical Engineer', 'Electrical Engineer', 'Project Engineer', 'Quality Manager'], 'Manufacturing', ['Engro', 'Larsen & Toubro', 'ADNOC', 'Siemens', 'Descon']],
  [['Supply Chain Manager', 'Logistics Coordinator', 'Procurement Lead'], 'Logistics & Freight', ['Aramex', 'DP World', 'Maersk', 'TCS Logistics']],
  [['Merchandiser', 'Production Manager', 'Textile Engineer'], 'Textiles & Apparel', ['Interloop', 'Nishat Mills', 'Gul Ahmed', 'Arvind']],
  [['Packaging Engineer', 'Operations Manager'], 'Packaging', ['Packages Ltd', 'Tetra Pak', 'Huhtamaki']],
];
const BIZ_DOMAINS = ['gmail.com', 'gmail.com', 'gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'icloud.com'];
// What each pipeline sells (Services): [label, service ids, deal amount (the services' prices)].
const BIZ_OFFERS = {
  'us-niw':           [['US NIW Petition', ['svc-1'], 45000], ['US NIW Petition and RFE cover', ['svc-1', 'svc-5'], 54000]],
  'australia-canada': [['Canada Express Entry', ['svc-2'], 32000], ['Canada Express Entry with spouse', ['svc-2', 'svc-4'], 50500],
                       ['Australia Skilled Migration', ['svc-3'], 38000], ['Australia Skilled Migration with IELTS support', ['svc-3', 'svc-6'], 41500]],
};
// Payment terms by pipeline (the CCL's installments): percent and days after it's sent.
const BIZ_TERMS = {
  'us-niw':           [['On signing the agreement', 40, 0], ['On filing', 40, 60], ['On the decision', 20, 180]],
  'australia-canada': [['On signing the agreement', 50, 0], ['On the ITA / invitation', 30, 45], ['On the visa decision', 20, 120]],
};
const BIZ_RESPONSES = [
  ['Re: Documents for your assessment', 'Thank you — I have attached my degree transcripts and passport copy. Please let me know if anything else is needed.'],
  ['Re: Your CCL', 'I have reviewed the agreement and have a couple of questions about the payment schedule before I sign.'],
  ['Re: Next steps', 'Thanks for the update. I can join a call on Thursday afternoon.'],
  ['Re: IELTS booking', 'I have booked my IELTS for next month and will share the result as soon as I have it.'],
  ['Re: Employment letters', 'My HR team will issue the experience letters this week.'],
];
const BIZ_SENT = [
  ['Your eligibility assessment', 'Following our consultation, here is a summary of your eligibility and the documents we need to start.'],
  ['Your Client Care Letter (CCL)', 'Please find your Client Care Letter attached. It sets out our services, fees and payment terms. Sign it to get started.'],
  ['Invoice for your first installment', 'Your first installment invoice is attached. Work on your file starts as soon as it is received.'],
  ['Document checklist', 'Here is the checklist of documents for the next phase of your application.'],
  ['Checking in', 'Just checking in to see whether you had a chance to review what we sent last week.'],
];
const BIZ_CALL_NOTES = ['Discussed eligibility and the overall timeline.', 'Walked the client through the CCL and payment terms.', 'Client confirmed they are gathering documents.',
  'Reviewed IELTS strategy and target scores.', 'Client asked about spouse inclusion and fees.', 'Followed up on the signed agreement.', 'Confirmed the first installment payment.'];
const BIZ_NOTES = ['Strong profile — good education and work experience. Prioritise.', 'Client is price-sensitive; offer the installment plan.', 'Spouse has a relevant degree; consider adding spouse points.',
  'Waiting for experience letters from the previous employer.', 'Client prefers WhatsApp for quick updates, evenings only.', 'Referred by an existing client.'];
const BIZ_TASKS = [['Follow up on signed CCL', 'Call'], ['Collect experience letters', 'To-do'], ['Send document checklist', 'Email'], ['Book IELTS consultation', 'Call'],
  ['Review ECA submission', 'To-do'], ['Chase first installment', 'Call'], ['Prepare petition outline', 'To-do'], ['Schedule strategy call', 'Call']];

/* `users`: the workspace's users (owners: its active sales people); `services`: the catalogue (the
   CCL's items); `now`: the day it's generated (everything is dated before or around it);
   `takenNames`: names already in use (the workspace's contacts). */
function generateBusinessData({users, services, now = new Date(), takenNames = []}){
  const r = bizRng(20261030);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const between = (a, b) => a + r() * (b - a);
  const chance = (p) => r() < p;
  const NOW = now.getTime(), today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const atHour = (t) => { const d = new Date(t); d.setHours(9 + Math.floor(r() * 9), [0, 10, 20, 30, 40, 50][Math.floor(r() * 6)], 0, 0); return Math.min(d.getTime(), NOW - 60000); };
  const ymd = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const dayLabel = (t) => new Date(t).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
  const stamp = (t) => storePropertyValue('Date & time', new Date(t));
  const day = (t) => { const x = new Date(t); return storePropertyValue('Date', `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`); };
  const SALES = ['Waleed bin Zaman', 'Hamza Siddiqui', 'Ali Noor', 'Anaya Malik', 'Arwa Zafar', 'Asim Ali'];
  const owners = (users || []).filter(u => SALES.includes(u.name) && u.status !== 'Deactivated');
  const ownerPool = owners.length ? owners : (users || []).slice(0, 4);
  const weights = ownerPool.map((u, i) => [1.1, 1.05, 1, 0.95, 0.9, 0.85][i % 6]);
  const pickOwner = () => { let x = r() * weights.reduce((s, w) => s + w, 0); for(let i = 0; i < ownerPool.length; i++){ x -= weights[i]; if(x <= 0) return ownerPool[i]; } return ownerPool[0]; };
  const svc = (id) => (services || []).find(s => s.id === id);
  const placeTotal = BIZ_PLACES.reduce((s, p) => s + p[3], 0);
  const pickPlace = () => { let x = r() * placeTotal; for(const p of BIZ_PLACES){ x -= p[3]; if(x <= 0) return p; } return BIZ_PLACES[0]; };

  const contacts = [], deals = [], customers = [], quotes = [], accounting = [];
  const dealActivities = {}, contactActivities = {}, customerActivities = {};
  // No one shares a name with a contact already in the workspace (so nothing reads as a duplicate).
  const usedNames = new Set(takenNames);
  let quoteNo = 100, actNo = 0;
  const actId = (rec) => `${rec}-b${++actNo}`;

  for(let i = 0; i < 1000; i++){
    const id = 1001 + i;
    // A unique name.
    let name;
    do { name = `${chance(.55) ? pick(BIZ_FIRST_M) : pick(BIZ_FIRST_F)} ${pick(BIZ_LAST)}`; } while(usedNames.has(name) && usedNames.size < 1500);
    if(usedNames.has(name)) name = `${name} ${String.fromCharCode(65 + (i % 26))}.`;
    usedNames.add(name);
    const [country, dial, cities] = pickPlace();
    const [titles, industry, employers] = pick(BIZ_WORK);
    const owner = pickOwner();
    // Arrived over the last year, more of them recently.
    const ageDays = Math.floor(Math.pow(r(), 2.1) * 360) + 1;
    const created = atHour(today0 - ageDays * BIZ_DAY);
    const handle = name.toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '.');
    const contact = {id, name, email:`${handle}${chance(.4) ? Math.floor(between(1, 99)) : ''}@${pick(BIZ_DOMAINS)}`,
      phone:`+${dial} ${Math.floor(between(300, 399))} ${Math.floor(between(1000000, 9999999))}`, owner:owner.id, company:pick(employers), jobTitle:pick(titles), industry,
      city:pick(cities), country, source: chance(.62) ? 'Meta Form' : 'Manual', created:dayLabel(created), createdAt:created};
    contacts.push(contact);
    const cActs = [];
    cActs.push({id:actId(`c${id}`), contactId:id, type:'note', at:new Date(atHour(created + BIZ_DAY * .1)), source:'team', by:owner.name, body: contact.source === 'Meta Form' ? 'Enquiry came in through the Meta lead form.' : 'Added after an inbound phone enquiry.'});

    // Most enquiries become a deal within a few weeks; the newest may not have yet.
    const dealAt = created + between(1, 18) * BIZ_DAY;
    const hasDeal = dealAt < NOW - BIZ_DAY && chance(.5);
    if(!hasDeal){
      contact.contactType = chance(.8) ? 'Subscriber' : 'Others';
      contact.leadStatus = ageDays < 10 ? 'New' : 'Contacted';
      cActs.push({id:actId(`c${id}`), contactId:id, type:'email', at:new Date(atHour(created + BIZ_DAY)), source:'team', by:owner.name, direction:'sent', title:BIZ_SENT[0][0], body:BIZ_SENT[0][1]});
      if(chance(.5)) cActs.push({id:actId(`c${id}`), contactId:id, type:'call', at:new Date(atHour(created + between(2, 6) * BIZ_DAY)), source:'team', by:owner.name, direction:'outbound',
        outcome:pick(['Connected', 'No answer', 'Left voicemail']), logged:true, durationMin:0, body:''});
      contactActivities[id] = cActs.map(a => ({...a, at: new Date(Math.min(a.at.getTime(), NOW - 60000))}));
      const last = Math.max(...cActs.map(a => a.at.getTime()));
      contact.lastActivity = dayLabel(last); contact.lastContacted = dayLabel(last);
      continue;
    }
    contactActivities[id] = cActs;

    /* ── The deal, through its pipeline ── each stage entered at a time; the last one entered
       before now is where it is. */
    const pipeline = chance(.36) ? 'us-niw' : 'australia-canada';
    const [offerLabel, offerSvcs, amount] = pick(BIZ_OFFERS[pipeline]);
    const dealId = `deal-${1000 + deals.length + 1}`;
    const path = [['qualified-client', dealAt]];
    let t = dealAt, quote = null, closeDate = dealAt + between(30, 60) * BIZ_DAY;
    const qcDays = between(4, 26), q1 = r();
    const end = (stage, at) => { path.push([stage, at]); };
    // Qualified Client: CCL drafted, sent and — on the way to CCL Sent — signed.
    const cclPath = q1 < .3, lostEarly = q1 >= .3 && q1 < .52, postponedEarly = q1 >= .52 && q1 < .68;
    const qcEnd = t + qcDays * BIZ_DAY;
    if(cclPath || (q1 >= .68 && chance(.5))){
      const sentAt = t + between(1, Math.max(1.5, qcDays - 1)) * BIZ_DAY;
      quote = {draftAt:t + between(.2, 1) * BIZ_DAY, sentAt, signedAt: cclPath ? qcEnd - between(.1, 1) * BIZ_DAY : null};
    }
    if(cclPath){
      end('ccl-sent', qcEnd); t = qcEnd;
      const cclDays = between(6, 48);
      let next = t + cclDays * BIZ_DAY;
      const roll = cclDays > 30 && chance(.6);
      if(roll){ const rollAt = t + between(30, 33) * BIZ_DAY; end('last-month-rollover', rollAt); next = rollAt + between(4, 24) * BIZ_DAY; }
      const d2 = r();
      if(d2 < .8){
        end('expected-sale', next); t = next; closeDate = t + between(10, 35) * BIZ_DAY;
        const esDays = between(8, 58), d3 = r(), esEnd = t + esDays * BIZ_DAY;
        if(d3 < .74){
          end('payment-made', esEnd);
          end('deal-won', esEnd + between(2, 9) * BIZ_DAY);
        } else end(d3 < .9 ? 'postponed' : 'deal-lost', esEnd);
      } else end(d2 < .9 ? 'deal-lost' : 'postponed', next);
    } else if(lostEarly) end('deal-lost', qcEnd + between(5, 30) * BIZ_DAY);
    else if(postponedEarly) end('postponed', qcEnd + between(3, 20) * BIZ_DAY);
    // A deal left in Qualified Client goes quiet: after six weeks or so it's set aside or lost.
    else if(qcEnd + 40 * BIZ_DAY < NOW) end(chance(.55) ? 'postponed' : 'deal-lost', qcEnd + between(20, 45) * BIZ_DAY);
    // Where it is now: the last stage entered before now.
    const reached = path.filter(([, at]) => at <= NOW - 30 * 60000);
    const [stage, stageEnteredAt] = reached[reached.length - 1];
    const enteredOf = (s) => (path.find(p => p[0] === s && p[1] <= NOW) || [])[1];
    const won = stage === 'deal-won', lost = stage === 'deal-lost';
    // Every closed stage (Won, Lost) has its Actual Close Date; Postponed is open.
    const closedAt = won || lost ? stageEnteredAt : null;
    const lastPastAt = stageEnteredAt;
    // The quote only as far as it had got by now.
    const qs = quote && quote.draftAt <= NOW ? {status: quote.signedAt && quote.signedAt <= NOW ? 'signed' : quote.sentAt <= NOW ? 'sent' : 'draft'} : null;

    const deal = {id:dealId, name, contactIds:[id], email:contact.email, phone:contact.phone, pipeline, stage, dealType: chance(.12) ? 'Existing Business' : 'New Business',
      owner:owner.id, amount, currency:DEAL_CURRENCY, health: lost ? 'At Risk' : chance(.2) ? 'Needs Attention' : 'Healthy', created:stamp(dealAt), createdAt:dealAt,
      source:contact.source, closeDate:day(Math.max(closeDate, dealAt + BIZ_DAY)), actualCloseDate: closedAt ? stamp(closedAt) : '', stageEnteredAt, pipelineEnteredAt:dealAt};
    deals.push(deal);
    contact.contactType = won ? (chance(.12) ? 'Evangelist' : 'Customer') : lost ? 'Others' : stage === 'postponed' ? 'Subscriber' : 'Opportunity';
    contact.leadStatus = 'Qualified';

    /* ── Activity along the way ── a consultation, calls every few days while it's live (at least
       four before it's lost), the CCL and invoice emails, the client's replies, notes, tasks. */
    const acts = [];
    const by = owner.name;
    const add = (a) => { if(a.at <= NOW - 60000) acts.push({id:actId(dealId), dealId, ...a, at:new Date(a.at)}); };
    add({type:'meeting', at:atHour(dealAt + between(.2, 2) * BIZ_DAY), source:'team', by, title:pick(MEETING_TITLES), durationMin:pick([30, 45, 60]), logged:true, platform:pick(MEETING_PLATFORMS)});
    // Calls while the deal is live: until it's won, lost or set aside — at most ten.
    const callUntil = Math.min(stage === 'postponed' || won || lost ? stageEnteredAt : NOW, NOW);
    let calls = 0;
    for(let ct = dealAt + between(1, 4) * BIZ_DAY; ct < callUntil - BIZ_DAY * .5 && calls < 7; ct += between(6, 14) * BIZ_DAY){
      const outcome = chance(.55) ? 'Connected' : chance(.6) ? 'No answer' : 'Left voicemail';
      add({type:'call', at:atHour(ct), source:'team', by, direction:'outbound', outcome, logged:true, durationMin: outcome === 'Connected' ? Math.floor(between(4, 26)) : 0,
        body: outcome === 'Connected' ? pick(BIZ_CALL_NOTES) : ''});
      calls++;
      if(chance(.07)) add({type:'call', at:atHour(ct + between(.3, 2) * BIZ_DAY), source:'client', by:null, direction:'inbound', pointOfContact:by, outcome:'Connected', logged:false,
        durationMin:Math.floor(between(3, 15)), body:pick(BIZ_CALL_NOTES)});
    }
    // Deal Lost only after four calls or more.
    if(lost) for(let k = calls; k < 4 + Math.floor(r() * 3); k++){
      add({type:'call', at:atHour(closedAt - (k + 1) * between(1, 3) * BIZ_DAY), source:'team', by, direction:'outbound', outcome: chance(.6) ? 'No answer' : 'Left voicemail', logged:true, durationMin:0, body:''});
    }
    add({type:'email', at:atHour(dealAt + between(.3, 1.5) * BIZ_DAY), source:'team', by, direction:'sent', title:BIZ_SENT[0][0], body:BIZ_SENT[0][1]});
    // The client replies some hours to a few days later.
    const replyAfter = (t0) => t0 + Math.pow(r(), 2) * between(2, 70) * 36e5 + 1800000;
    if(chance(.7)){ const [title, body] = pick(BIZ_RESPONSES); add({type:'email', at:replyAfter(dealAt + BIZ_DAY), source:'client', by:null, direction:'received', title, body}); }
    if(chance(.4)) add({type:'note', at:atHour(dealAt + between(1, 6) * BIZ_DAY), source:'team', by, body:pick(BIZ_NOTES)});

    // The CCL — a quotation for the deal's services, sent from Qualified Client and signed before CCL Sent.
    let quoteRec = null;
    if(qs){
      const qid = `q-b${++quoteNo}`;
      const year = new Date(quote.draftAt).getFullYear();
      const terms = BIZ_TERMS[pipeline].map(([description, percent, days], k) => ({id:`${qid}-in${k + 1}`, description, percent, due:{type:'days', days}}));
      quoteRec = {id:qid, number:`Q-${year}-${String(quoteNo).padStart(4, '0')}`, title:offerLabel, object:'deals', recordId:dealId, recipient:{name, email:contact.email},
        items:offerSvcs.map(s => quoteItemOf(svc(s))).filter(Boolean), installments:terms, discount:{type:'percent', value:0}, vatRate:QUOTE_VAT_RATE, terms:SAMPLE_QUOTE_TERMS,
        eSignature:true, validUntil:ymd(quote.draftAt + 30 * BIZ_DAY), description:'', status:qs.status, createdAt:new Date(quote.draftAt), createdBy:by,
        ...(qs.status !== 'draft' ? {sentAt:new Date(quote.sentAt)} : {}), ...(qs.status === 'signed' ? {signedAt:ymd(quote.signedAt), signedCopy:null} : {})};
      quotes.push(quoteRec);
      if(qs.status !== 'draft'){
        add({type:'quote', at:quote.sentAt, source:'team', by, status:'sent', title:`${quoteRec.number} · ${offerLabel} sent`, quoteId:qid, total:quoteTotal(quoteRec)});
        add({type:'email', at:quote.sentAt, source:'team', by, direction:'sent', title:BIZ_SENT[1][0], body:BIZ_SENT[1][1]});
        if(chance(.6)){ const [title, body] = BIZ_RESPONSES[1]; add({type:'email', at:replyAfter(quote.sentAt), source:'client', by:null, direction:'received', title, body}); }
      }
      if(qs.status === 'signed') add({type:'quote', at:quote.signedAt, source:'team', by, status:'signed', title:`${quoteRec.number} · ${offerLabel} signed`, quoteId:qid, total:quoteTotal(quoteRec)});
    }

    /* Accounting — the signed CCL's payment terms (pulled when it was signed). The first installment
       is invoiced on signing and paid as the deal reaches Payment Made; later ones are invoiced a
       week before they fall due and mostly paid around then. */
    if(quoteRec && quoteRec.status === 'signed'){
      const sched = {...scheduleFromQuote(quoteRec, 'deals', deal), createdAt:new Date(quote.signedAt + 3600000), createdBy:by};
      const paidFirstAt = enteredOf('payment-made');
      sched.installments = sched.installments.map((inst, k) => {
        const due = new Date(`${inst.dueDate}T09:00:00`).getTime();
        // Later installments are invoiced only once the client is paying (the deal reached Payment Made).
        const invoicedAt = k === 0 ? quote.signedAt + 7200000 : paidFirstAt ? Math.max(paidFirstAt, due - 7 * BIZ_DAY) : Infinity;
        const out = {...inst, ...(invoicedAt <= NOW ? {invoicedAt:ymd(invoicedAt)} : {}), payments:[]};
        let paidAt = null;
        if(k === 0 && paidFirstAt) paidAt = paidFirstAt - between(.05, .5) * BIZ_DAY;
        else if(k > 0 && won && invoicedAt <= NOW && chance(.85)){ const p = due + between(-3, 10) * BIZ_DAY; if(p <= NOW - 3600000) paidAt = p; }
        if(paidAt) out.payments = [{id:`${inst.id}-pay`, amount:inst.amount, paidOn:ymd(paidAt), recordedAt:new Date(paidAt), recordedBy:by, evidence:null}];
        return out;
      });
      accounting.push(sched);
      if(paidFirstAt) add({type:'email', at:quote.signedAt + 7200000, source:'team', by, direction:'sent', title:BIZ_SENT[2][0], body:BIZ_SENT[2][1]});
    }

    // Open work: a task due around now on a live deal.
    if(!won && !lost && stage !== 'postponed' && chance(.55)){
      const [title, taskType] = pick(BIZ_TASKS);
      const due = today0 + Math.floor(between(-3, 9)) * BIZ_DAY + (10 + Math.floor(r() * 7)) * 36e5;
      const created = Math.min(NOW - 3600000, due - between(1, 6) * BIZ_DAY);
      add({type:'task', at:created, source:'team', by, title, description:(typeof TASK_DESCRIPTIONS !== 'undefined' && TASK_DESCRIPTIONS[title]) || '', taskType,
        status: due < NOW && chance(.4) ? 'completed' : 'inProgress', assignee:by, due:new Date(due)});
    }
    acts.sort((a, b) => b.at - a.at);
    dealActivities[dealId] = acts;
    const lastAct = acts.length ? acts[0].at.getTime() : dealAt;
    contact.lastActivity = dayLabel(lastAct); contact.lastContacted = dayLabel(lastAct);

    /* ── The customer — a won deal becomes one the way Create Customer makes it: the service
       pipeline for the deal's pipeline, linked to the deal and its contact; it has moved through
       the service since. */
    if(won){
      const pl = CUSTOMER_PIPELINE_FOR_DEAL[pipeline];
      const plDef = DEFAULT_PIPELINES().find(p => p.id === pl);
      const open = plDef.stages.filter(s => !isClosedStage(s)), outcomes = plDef.stages.filter(isClosedStage);
      const since = (NOW - closedAt) / BIZ_DAY;
      const closedOut = since > 200 && chance(.25);
      const cst = closedOut ? outcomes[outcomes.length - 1] : open[Math.min(open.length - 1, Math.floor(since / between(14, 24)))];
      const custId = `cust-${1000 + customers.length + 1}`;
      customers.push({id:custId, name, email:contact.email, phone:contact.phone, owner:owner.id, pipeline:pl, stage:cst.id,
        status: closedOut ? 'Closed' : chance(.08) ? 'On Hold' : 'Active', source:'Deal', customerSince:dayLabel(closedAt), company:contact.company,
        contactIds:[id], dealIds:[dealId], created:stamp(closedAt + 3600000), stageEnteredAt:closedAt + 3600000 + since * .7 * BIZ_DAY});
      customerActivities[custId] = [
        {id:actId(custId), customerId:custId, type:'call', at:new Date(atHour(closedAt + between(1, 4) * BIZ_DAY)), source:'team', by, direction:'outbound', outcome:'Connected', logged:true,
          durationMin:Math.floor(between(15, 40)), body:'Welcome call — introduced the case team and the next steps.'},
        {id:actId(custId), customerId:custId, type:'note', at:new Date(atHour(closedAt + between(2, 8) * BIZ_DAY)), source:'team', by, body:'File opened; document collection started.'},
      ].filter(a => a.at.getTime() <= NOW - 60000);
    }
  }
  contacts.forEach(c => { delete c.createdAt; });
  return {version:BUSINESS_DATA_VERSION, contacts, deals, customers, quotes, accounting, dealActivities, contactActivities, customerActivities};
}

Object.assign(window, {generateBusinessData, BUSINESS_DATA_VERSION});
