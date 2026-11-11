/* HOF Pulse ERP — Property types: the one definition of every property type.

   Every property (on Contacts, Deals, Customers, Users — and every form field, which fills one
   in) has a type, and its type alone decides, everywhere:
     · its INPUT — the control on record forms, side panels, workflow values and form fields;
     · its VALUE — how it's kept on the record (plain text / number / true-false / a list / a
       group of related fields — Location, Currency, the ranges keep each part);
     · its DISPLAY — the one line tables, cards and panels show;
     · its VALIDATION — what's accepted (an email's format, a range's order, …); a required
       property must be filled in;
     · its OPERATORS — the conditions filters and workflows offer for it (Changed / Did not
       change: workflows only — they compare the value across the evaluation period).

   Types saved before (Single checkbox, Radio / Dropdown select, Multi-checkbox, Date & time,
   Upload file, Phone number, Single- / Multi-line text) are read as their new type
   (LEGACY_PROPERTY_TYPES); their values are kept as they were. */

/* ── Reference lists: countries (with dialling codes and currencies), currencies, languages ── */
const flagOf = (iso) => iso && /^[A-Z]{2}$/.test(iso) ? String.fromCodePoint(...[...iso].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)) : '';
const COUNTRY_LIST = [
  ['AF','Afghanistan','93','AFN'], ['AU','Australia','61','AUD'], ['BH','Bahrain','973','BHD'], ['BD','Bangladesh','880','BDT'], ['BR','Brazil','55','BRL'],
  ['CA','Canada','1','CAD'], ['CN','China','86','CNY'], ['DK','Denmark','45','DKK'], ['EG','Egypt','20','EGP'], ['FR','France','33','EUR'],
  ['DE','Germany','49','EUR'], ['HK','Hong Kong','852','HKD'], ['IN','India','91','INR'], ['ID','Indonesia','62','IDR'], ['IR','Iran','98','IRR'],
  ['IQ','Iraq','964','IQD'], ['IE','Ireland','353','EUR'], ['IT','Italy','39','EUR'], ['JP','Japan','81','JPY'], ['JO','Jordan','962','JOD'],
  ['KE','Kenya','254','KES'], ['KW','Kuwait','965','KWD'], ['LB','Lebanon','961','LBP'], ['MY','Malaysia','60','MYR'], ['MX','Mexico','52','MXN'],
  ['MA','Morocco','212','MAD'], ['NP','Nepal','977','NPR'], ['NL','Netherlands','31','EUR'], ['NZ','New Zealand','64','NZD'], ['NG','Nigeria','234','NGN'],
  ['NO','Norway','47','NOK'], ['OM','Oman','968','OMR'], ['PK','Pakistan','92','PKR'], ['PH','Philippines','63','PHP'], ['PT','Portugal','351','EUR'],
  ['QA','Qatar','974','QAR'], ['RU','Russia','7','RUB'], ['SA','Saudi Arabia','966','SAR'], ['SG','Singapore','65','SGD'], ['ZA','South Africa','27','ZAR'],
  ['KR','South Korea','82','KRW'], ['ES','Spain','34','EUR'], ['LK','Sri Lanka','94','LKR'], ['SE','Sweden','46','SEK'], ['CH','Switzerland','41','CHF'],
  ['TH','Thailand','66','THB'], ['TR','Türkiye','90','TRY'], ['AE','United Arab Emirates','971','AED'], ['GB','United Kingdom','44','GBP'],
  ['US','United States','1','USD'], ['VN','Vietnam','84','VND'],
].map(([code, name, dial, currency]) => ({code, name, dial, currency, flag:flagOf(code)}));
const CURRENCY_LIST = [
  ['AED','UAE Dirham','AE'], ['USD','US Dollar','US'], ['EUR','Euro','EU'], ['GBP','British Pound','GB'], ['CAD','Canadian Dollar','CA'],
  ['AUD','Australian Dollar','AU'], ['PKR','Pakistani Rupee','PK'], ['INR','Indian Rupee','IN'], ['SAR','Saudi Riyal','SA'], ['QAR','Qatari Riyal','QA'],
  ['OMR','Omani Rial','OM'], ['KWD','Kuwaiti Dinar','KW'], ['BHD','Bahraini Dinar','BH'], ['BDT','Bangladeshi Taka','BD'], ['CNY','Chinese Yuan','CN'],
  ['JPY','Japanese Yen','JP'], ['CHF','Swiss Franc','CH'], ['NZD','New Zealand Dollar','NZ'], ['SGD','Singapore Dollar','SG'], ['MYR','Malaysian Ringgit','MY'],
  ['TRY','Turkish Lira','TR'], ['EGP','Egyptian Pound','EG'], ['ZAR','South African Rand','ZA'], ['HKD','Hong Kong Dollar','HK'], ['LKR','Sri Lankan Rupee','LK'],
  ['NPR','Nepalese Rupee','NP'], ['MAD','Moroccan Dirham','MA'], ['SEK','Swedish Krona','SE'], ['NOK','Norwegian Krone','NO'], ['DKK','Danish Krone','DK'],
].map(([code, name, iso]) => ({code, name, flag:flagOf(iso)}));
const LANGUAGE_LIST = ['Arabic', 'Bengali', 'Chinese (Mandarin)', 'Dutch', 'English', 'Farsi', 'French', 'German', 'Gujarati', 'Hindi', 'Indonesian', 'Italian',
  'Japanese', 'Korean', 'Malay', 'Nepali', 'Pashto', 'Portuguese', 'Punjabi', 'Russian', 'Sindhi', 'Spanish', 'Swahili', 'Tagalog', 'Tamil', 'Thai',
  'Turkish', 'Urdu', 'Vietnamese'];
const countryOptions = () => COUNTRY_LIST.map(c => ({value:c.name, label:`${c.flag} ${c.name}`}));
const currencyOptions = () => CURRENCY_LIST.map(c => ({value:c.code, label:`${c.flag} ${c.code} — ${c.name}`}));
/* Money. An amount is entered in any currency, starting at the default one (Settings → Defaults,
   AED until changed); totals convert to the default at Settings' exchange rates. `rates[code]`:
   what one unit of `code` is worth in the default currency. An amount saved without a currency is
   AED (every amount was, before currencies could be chosen). The starting rates are sample values,
   changed in Settings → Defaults. */
const LEGACY_CURRENCY = 'AED';
const SAMPLE_RATES_AED = {AED:1, USD:3.6725, EUR:4, GBP:4.65, CAD:2.65, AUD:2.4, PKR:0.0131, INR:0.0418, SAR:0.979, QAR:1.0089,
  OMR:9.55, KWD:11.95, BHD:9.74, BDT:0.0301, CNY:0.505, JPY:0.0242, CHF:4.15, NZD:2.17, SGD:2.78, MYR:0.82,
  TRY:0.089, EGP:0.0745, ZAR:0.2, HKD:0.472, LKR:0.0122, NPR:0.0262, MAD:0.37, SEK:0.35, NOK:0.34, DKK:0.536};
// The sample rates against another default currency (each rounded to 6 significant digits).
const sampleRatesIn = (cur) => Object.fromEntries(CURRENCY_LIST.map(c => [c.code, Number((SAMPLE_RATES_AED[c.code] / (SAMPLE_RATES_AED[cur] || 1)).toPrecision(6))]));
let MONEY = {currency:LEGACY_CURRENCY, rates:null};
const setMoneyDefaults = (defaults) => { MONEY = {currency:(defaults && defaults.currency) || LEGACY_CURRENCY, rates:(defaults && defaults.rates) || null}; };
const defaultCurrency = () => MONEY.currency;
const currencyRate = (code) => { const c = code || LEGACY_CURRENCY; if(c === MONEY.currency) return 1;
  const r = Number((MONEY.rates || {})[c]); return r > 0 ? r : sampleRatesIn(MONEY.currency)[c] || 1; };
// An amount in the default currency (a total adds these up).
const toDefaultCurrency = (amount, code) => Math.round((Number(amount) || 0) * currencyRate(code) * 100) / 100;
// One currency's amount in another (a service priced in USD, added to a quote in AED).
const convertAmount = (amount, from, to) => (from || LEGACY_CURRENCY) === (to || LEGACY_CURRENCY) ? Number(amount) || 0
  : Math.round((Number(amount) || 0) * currencyRate(from) / currencyRate(to) * 100) / 100;
const moneyText = (amount, code) => amount === '' || amount == null || isNaN(amount) ? ''
  : `${code || LEGACY_CURRENCY} ${Number(amount).toLocaleString('en-US', {maximumFractionDigits:2})}`;
/* A Number property entered with its currency, stored on its own (Deal Amount → the deal's
   Currency): the form shows the two together, as a Currency property's input. */
const amountCurrencyKey = (p) => p && (p.currencyKey || (p.objectId === 'deals' && p.key === 'amount' ? 'currency' : null));
const dialOptions = () => [...new Map(COUNTRY_LIST.map(c => [c.dial, c])).values()].sort((a, b) => Number(a.dial) - Number(b.dial))
  .map(c => ({value:c.dial, label:`${c.flag} +${c.dial}`}));

/* ── Values: reading any stored value in its type's shape ── */
const ptText = (v) => v == null ? '' : String(v);
const ptBlank = (v) => v === undefined || v === null || String(v).trim() === '';
const ptBool = (v) => v === true || v === 'Yes' || v === 'True' || v === 'true' ? true : v === false || v === 'No' || v === 'False' || v === 'false' ? false : null;
const ptList = (v) => Array.isArray(v) ? v.filter(x => !ptBlank(x)) : ptBlank(v) ? [] : String(v).split(',').map(s => s.trim()).filter(Boolean);
const ptNumber = (v) => ptBlank(v) || isNaN(Number(String(v).replace(/,/g, ''))) ? null : Number(String(v).replace(/,/g, ''));
// A phone number keeps its country code: "+92 300 1234567" → {dial:'92', number:'300 1234567'}.
const ptPhone = (v) => { const s = ptText(v).trim(), m = /^\+(\d{1,4})\s*(.*)$/.exec(s); return m ? {dial:m[1], number:m[2].trim()} : {dial:'', number:s}; };
const ptMoney = (v) => {
  if(v && typeof v === 'object') return {currency:v.currency || '', amount: ptBlank(v.amount) ? '' : v.amount};
  if(typeof v === 'number') return {currency:'', amount:v};
  const m = /^([A-Z]{3})?\s*([\d.,-]+)?$/.exec(ptText(v).trim());
  return m ? {currency:m[1] || '', amount:m[2] ? Number(m[2].replace(/,/g, '')) : ''} : {currency:'', amount:''};
};
const LOCATION_FIELDS = [{key:'country', label:'Country'}, {key:'street', label:'Street Address'}, {key:'city', label:'City'}, {key:'state', label:'State or Province'}];
const ptLocation = (v) => Object.fromEntries(LOCATION_FIELDS.map(f => [f.key, (v && typeof v === 'object' ? v[f.key] : '') || '']));
const ptDateRange = (v) => ({start:(v && v.start) || '', end:(v && v.end) || ''});
const ptCustomRange = (v) => ({min: v && !ptBlank(v.min) ? v.min : '', max: v && !ptBlank(v.max) ? v.max : ''});
// A calendar day from any stored date ("Oct 6, 2026", "2026-10-06", a timestamp).
const ptDay = (v) => {
  if(ptBlank(v)) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  const d = iso ? new Date(+iso[1], +iso[2] - 1, +iso[3]) : new Date(v);
  return isNaN(d.getTime()) ? null : d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
};
const ptFmtDay = (iso) => { const d = ptDay(iso); if(d === null) return ''; const y = Math.floor(d / 10000), m = Math.floor(d / 100) % 100, dd = d % 100;
  return new Date(y, m, dd).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric', timeZone:LOCAL_TZ}); };
/* A stored date as shown: the year is left out in the current year ("Nov 10, 3:00 PM"), kept
   otherwise ("Nov 10, 2025"). Stored values, filters and exports keep the full date. Anything
   that isn't a stored date ("Nov 10, 2026" or "Nov 10, 2026, 3:00 PM") is returned as it is. */
const STORED_DATE_RE = /^([A-Z][a-z]{2} \d{1,2}), (\d{4})(, \d{1,2}:\d{2} [AP]M)?$/;
const dateShown = (v) => { if(typeof v !== 'string') return v; const m = STORED_DATE_RE.exec(v);
  return m && Number(m[2]) === new Date().getFullYear() ? `${m[1]}${m[3] || ''}` : v; };
const ptMoneyText = (m) => ptBlank(m.amount) ? (m.currency || '') : `${m.currency ? m.currency + ' ' : ''}${Number(m.amount).toLocaleString('en-US')}`;

/* ── Operators — one catalogue; each type offers its own (in the document's order) ── */
const PT_OPS = {
  equals:{id:'equals', label:'Equals'}, notEquals:{id:'notEquals', label:'Does not equal'},
  is:{id:'equals', label:'Is'}, isNot:{id:'notEquals', label:'Is not'},
  contains:{id:'contains', label:'Contains'}, notContains:{id:'notContains', label:'Does not contain'},
  gt:{id:'gt', label:'Greater than'}, lt:{id:'lt', label:'Less than'}, gte:{id:'gte', label:'Greater than or equal to'}, lte:{id:'lte', label:'Less than or equal to'},
  after:{id:'gt', label:'Is after'}, before:{id:'lt', label:'Is before'},
  isTrue:{id:'isTrue', label:'Is true', noValue:true}, isFalse:{id:'isFalse', label:'Is false', noValue:true},
  containsAny:{id:'containsAny', label:'Contains any of', multi:true}, containsAll:{id:'containsAll', label:'Contains all of', multi:true},
  notContainsAny:{id:'notContainsAny', label:'Does not contain', multi:true},
  isEmpty:{id:'isEmpty', label:'Is empty', noValue:true}, isNotEmpty:{id:'isNotEmpty', label:'Is not empty', noValue:true},
  changed:{id:'changed', label:'Changed', noValue:true, change:true}, notChanged:{id:'notChanged', label:'Did not change', noValue:true, change:true},
};
const ptOps = (...keys) => keys.map(k => PT_OPS[k]);
const TEXT_OPS = ptOps('equals', 'notEquals', 'isEmpty', 'isNotEmpty', 'contains', 'notContains', 'changed', 'notChanged');
const NUMBER_OPS = ptOps('equals', 'notEquals', 'gt', 'lt', 'gte', 'lte', 'isEmpty', 'isNotEmpty', 'changed', 'notChanged');
const CHOICE_OPS = ptOps('is', 'isNot', 'isEmpty', 'isNotEmpty', 'changed', 'notChanged');
const DATE_OPS = ptOps('is', 'before', 'after', 'isEmpty', 'isNotEmpty', 'changed', 'notChanged');
const GROUP_OPS = ptOps('isEmpty', 'isNotEmpty', 'changed', 'notChanged');

/* ── The types ──
   `compare`: what a condition compares the value as (text, number, amount, date, choice — one of
   the options —, multi, none). `options(prop, ctx)`: a choice type's options. */
const PT = (def) => ({creatable:true, store:(v) => v, load:(v) => v ?? '', format:(v) => ptText(v), validate:() => null, ...def});
const textValue = {store:(v) => ptText(v).trim(), load:(v) => ptText(v), empty:ptBlank};
const choiceValue = {compare:'choice', ops:CHOICE_OPS, store:(v) => ptText(v), load:(v) => ptText(v), empty:ptBlank};
const PROPERTY_TYPE_DEFS = [
  PT({id:'Single-Line Text', ...textValue, compare:'text', ops:TEXT_OPS}),
  PT({id:'Multi-Line Text', ...textValue, compare:'text', ops:TEXT_OPS}),
  PT({id:'Number', compare:'number', ops:NUMBER_OPS, empty:(v) => ptNumber(v) === null,
    store:(v) => ptNumber(v) ?? '', load:(v) => ptBlank(v) ? '' : String(v), format:(v) => ptNumber(v) === null ? ptText(v) : ptNumber(v).toLocaleString('en-US'),
    validate:(v) => !ptBlank(v) && ptNumber(v) === null ? 'Enter a number' : null}),
  PT({id:'Phone Number', compare:'text', ops:ptOps('equals', 'notEquals', 'isEmpty', 'isNotEmpty', 'changed', 'notChanged'),
    empty:(v) => !ptPhone(v).number, store:(v) => ptText(v).trim(), load:(v) => ptText(v),
    validate:(v) => { const p = ptPhone(v); if(!p.number) return null; if(!p.dial) return 'Choose a country code';
      const digits = p.number.replace(/\D/g, ''); return /^[\d\s()-]+$/.test(p.number) && digits.length >= 6 && digits.length <= 14 ? null : 'Enter a valid phone number'; }}),
  /* Currency: the currency (flag, code, name) and the amount — or, for a currency-only property
     (`currencyOnly`, as Deals' Currency beside its Total Amount), just the currency. */
  PT({id:'Currency', compare:'amount', ops:NUMBER_OPS,
    opsFor:(p) => p && p.currencyOnly ? CHOICE_OPS : NUMBER_OPS, compareFor:(p) => p && p.currencyOnly ? 'choice' : 'amount',
    options:() => currencyOptions(),
    empty:(v, p) => p && p.currencyOnly ? ptBlank(v) : ptBlank(ptMoney(v).amount),
    store:(v, p) => p && p.currencyOnly ? ptText(v) : (() => { const m = ptMoney(v); return ptBlank(m.amount) && !m.currency ? '' : {currency:m.currency, amount: ptBlank(m.amount) ? '' : Number(m.amount)}; })(),
    load:(v, p) => p && p.currencyOnly ? ptText(v) : ptMoney(v),
    format:(v, p) => p && p.currencyOnly ? ptText(v) : ptMoneyText(ptMoney(v)),
    validate:(v, p) => { if(p && p.currencyOnly) return null; const m = ptMoney(v); if(ptBlank(m.amount) && !m.currency) return null;
      if(ptBlank(m.amount) || isNaN(Number(m.amount))) return 'Enter an amount'; return m.currency ? null : 'Choose a currency'; }}),
  // Location: one property, four fields, each kept on its own.
  PT({id:'Location', compare:'none', ops:GROUP_OPS, empty:(v) => LOCATION_FIELDS.every(f => ptBlank(ptLocation(v)[f.key])),
    store:(v) => { const l = ptLocation(v); return LOCATION_FIELDS.every(f => ptBlank(l[f.key])) ? '' : Object.fromEntries(LOCATION_FIELDS.map(f => [f.key, ptText(l[f.key]).trim()])); },
    load:(v) => ptLocation(v), format:(v) => { const l = ptLocation(v); return [l.street, l.city, l.state, l.country].filter(x => !ptBlank(x)).join(', '); }}),
  PT({id:'Email', ...textValue, compare:'text', ops:TEXT_OPS,
    validate:(v) => ptBlank(v) || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(ptText(v).trim()) ? null : 'Enter a valid email address'}),
  PT({id:'URL', ...textValue, compare:'text', ops:TEXT_OPS,
    validate:(v) => ptBlank(v) || /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(ptText(v).trim()) ? null : 'Enter a valid URL'}),
  // Boolean: True or False (a record that's never been set reads False).
  PT({id:'Boolean', compare:'none', ops:ptOps('isTrue', 'isFalse', 'changed', 'notChanged'), empty:(v) => ptBool(v) === null,
    store:(v) => ptBool(v) === true, load:(v) => ptBool(v) === true, format:(v) => ptBool(v) === null ? '' : ptBool(v) ? 'True' : 'False'}),
  // Date and Timestamp keep the record's readable form ("Oct 6, 2026", "Oct 6, 2026, 3:00 PM").
  PT({id:'Date', compare:'date', ops:DATE_OPS, empty:ptBlank,
    store:(v) => { if(ptBlank(v)) return ''; const [y, m, d] = String(v).split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric', timeZone:LOCAL_TZ}); },
    load:(v) => { const d = ptDay(v); if(d === null) return ''; return `${Math.floor(d / 10000)}-${String(Math.floor(d / 100) % 100 + 1).padStart(2, '0')}-${String(d % 100).padStart(2, '0')}`; },
    format:(v) => dateShown(ptText(v)),
    validate:(v) => ptBlank(v) || ptDay(v) !== null ? null : 'Enter a valid date'}),
  PT({id:'Timestamp', compare:'date', ops:DATE_OPS, empty:ptBlank,
    // Kept as the wall clock: one typed in ("YYYY-MM-DDTHH:mm") as typed; a moment (a Date) in the app's time zone.
    store:(v) => { if(ptBlank(v)) return ''; const d = new Date(v), tz = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? {timeZone:LOCAL_TZ} : {};
      return `${d.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric', ...tz})}, ${d.toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit', ...tz})}`; },
    load:(v) => { if(ptBlank(v)) return ''; const d = new Date(String(v).replace(/, (\d{1,2}:\d{2} [AP]M)$/, ' $1')); if(isNaN(d)) return '';
      const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; },
    format:(v) => dateShown(ptText(v)),
    validate:(v) => ptBlank(v) || !isNaN(new Date(v).getTime()) ? null : 'Enter a valid date and time'}),
  PT({id:'Date Range', compare:'none', ops:GROUP_OPS, empty:(v) => { const r = ptDateRange(v); return !r.start && !r.end; },
    store:(v) => { const r = ptDateRange(v); return !r.start && !r.end ? '' : r; }, load:(v) => ptDateRange(v),
    format:(v) => { const r = ptDateRange(v); return r.start || r.end ? `${ptFmtDay(r.start)} – ${ptFmtDay(r.end)}` : ''; },
    validate:(v) => { const r = ptDateRange(v); if(!r.start && !r.end) return null; if(!r.start || !r.end) return 'Enter both the start and end dates';
      return ptDay(r.start) <= ptDay(r.end) ? null : 'The start date must be on or before the end date'; }}),
  /* Custom Range: the range's label (the property's — not a value), the lower and upper values;
     `range.min` / `range.max` (optional) bound both. */
  PT({id:'Custom Range', compare:'none', ops:GROUP_OPS, empty:(v) => { const r = ptCustomRange(v); return ptBlank(r.min) && ptBlank(r.max); },
    store:(v) => { const r = ptCustomRange(v); return ptBlank(r.min) && ptBlank(r.max) ? '' : {min:ptNumber(r.min) ?? r.min, max:ptNumber(r.max) ?? r.max}; },
    load:(v) => ptCustomRange(v),
    format:(v) => { const r = ptCustomRange(v); return ptBlank(r.min) && ptBlank(r.max) ? '' : `${ptNumber(r.min)?.toLocaleString('en-US') ?? r.min} – ${ptNumber(r.max)?.toLocaleString('en-US') ?? r.max}`; },
    validate:(v, p) => { const r = ptCustomRange(v), a = ptNumber(r.min), b = ptNumber(r.max), cfg = (p && p.range) || {};
      if(ptBlank(r.min) && ptBlank(r.max)) return null;
      if(a === null || b === null) return 'Enter both values as numbers';
      if(a > b) return 'The lower value can’t exceed the upper value';
      const lo = ptNumber(cfg.min), hi = ptNumber(cfg.max);
      if((lo !== null && a < lo) || (hi !== null && b > hi)) return `Values must be between ${lo ?? '…'} and ${hi ?? '…'}`;
      return null; }}),
  // Single Selection: radio buttons with fewer than three options, a dropdown otherwise.
  PT({id:'Single Selection', ...choiceValue, options:(p) => (p && p.options) || [],
    validate:(v, p) => ptBlank(v) || !p || !(p.options || []).length || p.options.includes(v) ? null : 'Choose one of the options'}),
  PT({id:'Multi-Selection', compare:'multi', ops:ptOps('containsAny', 'containsAll', 'notContainsAny', 'isEmpty', 'isNotEmpty', 'changed', 'notChanged'),
    options:(p) => (p && p.options) || [], empty:(v) => !ptList(v).length, store:(v) => ptList(v), load:(v) => ptList(v), format:(v) => ptList(v).join(', '),
    validate:(v, p) => !p || !(p.options || []).length || ptList(v).every(x => p.options.includes(x)) ? null : 'Choose from the options'}),
  PT({id:'File Upload', compare:'none', ops:GROUP_OPS, empty:ptBlank, store:(v) => ptText(v), load:(v) => ptText(v)}),
  PT({id:'User', ...choiceValue, format:(v) => typeof userLabel === 'function' ? userLabel(v) || ptText(v) : ptText(v)}),
  PT({id:'Country', ...choiceValue, options:() => countryOptions(),
    validate:(v) => ptBlank(v) || COUNTRY_LIST.some(c => c.name === v) ? null : 'Choose a country'}),
  PT({id:'Language', ...choiceValue, options:() => LANGUAGE_LIST,
    validate:(v) => ptBlank(v) || LANGUAGE_LIST.includes(v) ? null : 'Choose a language'}),
  // System types: a record's pipeline and its stage (picked from the record type's pipelines).
  PT({id:'Pipeline', ...choiceValue, creatable:false}),
  PT({id:'Pipeline stage', ...choiceValue, creatable:false}),
];
const LEGACY_PROPERTY_TYPES = {'Single-line text':'Single-Line Text', 'Multi-line text':'Multi-Line Text', 'Single checkbox':'Boolean', 'Multi-checkbox':'Multi-Selection',
  'Radio select':'Single Selection', 'Dropdown select':'Single Selection', 'Phone number':'Phone Number', 'Date & time':'Timestamp', 'Upload file':'File Upload'};
const propertyTypeId = (t) => LEGACY_PROPERTY_TYPES[t] || t;
const propertyTypeDef = (t) => PROPERTY_TYPE_DEFS.find(d => d.id === propertyTypeId(t)) || PROPERTY_TYPE_DEFS[0];
const CREATABLE_PROPERTY_TYPES = PROPERTY_TYPE_DEFS.filter(d => d.creatable).map(d => d.id);
// A property's type — from a property ({type, …}) or a type name.
const defOf = (p) => propertyTypeDef(typeof p === 'string' ? p : p && p.type);
const propOf = (p) => typeof p === 'string' ? {type:p} : p || {};

/* The API every screen uses — by property (its type, and its settings: options, range, …). */
const propertyOperators = (p, {withChange = true} = {}) => { const d = defOf(p), ops = d.opsFor ? d.opsFor(propOf(p)) : d.ops; return withChange ? ops : ops.filter(o => !o.change); };
const propertyCompare = (p) => { const d = defOf(p); return d.compareFor ? d.compareFor(propOf(p)) : d.compare; };
const propertyIsEmpty = (p, v) => { const d = defOf(p); return d.empty ? d.empty(v, propOf(p)) : ptBlank(v); };
const storePropertyValueOf = (p, v) => defOf(p).store(v, propOf(p));
const loadPropertyValueOf = (p, v) => defOf(p).load(v, propOf(p));
const formatPropertyValueOf = (p, v) => propertyIsEmpty(p, v) && propertyTypeId(propOf(p).type) !== 'Boolean' ? '' : defOf(p).format(v, propOf(p));
const validatePropertyValue = (p, v) => defOf(p).validate(v, propOf(p));
// Required (mandatory) and valid: the error to show, or null.
const propertyValueError = (p, v, required) => required && propertyIsEmpty(p, v) && propertyTypeId(propOf(p).type) !== 'Boolean' ? `${p.formLabel || p.label || 'This field'} is required` : validatePropertyValue(p, v);
// The same value? (Changed / Did not change — grouped values compare every part.)
const samePropertyValue = (a, b) => {
  const norm = (v) => v && typeof v === 'object' ? JSON.stringify(Array.isArray(v) ? v : Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]]))) : ptBlank(v) ? '' : String(v);
  return norm(a) === norm(b);
};
/* Any stored value in one line, whatever its type (tables, cards and panels that show a value
   by its key): text and numbers as they are; True / False; lists; a grouped value by its shape. */
const formatValue = (v) => {
  if(v === true || v === false) return v ? 'True' : 'False';
  if(Array.isArray(v)) return v.filter(x => !ptBlank(x)).join(', ');
  if(v && typeof v === 'object'){
    if('amount' in v || 'currency' in v) return ptMoneyText(ptMoney(v));
    if('start' in v || 'end' in v) return defOf('Date Range').format(v);
    if('min' in v || 'max' in v) return defOf('Custom Range').format(v);
    if(LOCATION_FIELDS.some(f => f.key in v)) return defOf('Location').format(v);
    return '';
  }
  return v == null ? '' : v;
};

/* A value when its property changes (type, options, range): kept where it still fits — the same
   type and still valid, or read into the new type (text "5000" → Number 5000, "Pakistan" →
   Country, "Yes" → Boolean, a list's options that remain) — else cleared. → {value, cleared}. */
function convertPropertyValue(fromP, toP, v){
  if(propertyIsEmpty(fromP, v)) return {value:v, cleared:false};
  const to = propertyTypeId(propOf(toP).type), same = propertyTypeId(propOf(fromP).type) === to;
  const fits = (x) => x !== null && x !== undefined && x !== '' && !propertyIsEmpty(toP, x) && !validatePropertyValue(toP, x);
  const keep = (x) => fits(x) ? {value:x, cleared:false} : {value:'', cleared:true};
  if(same) return keep(v);
  // A date converts from its stored text (the display leaves the current year out).
  const fromType = propertyTypeId(propOf(fromP).type), text = (['Date', 'Timestamp'].includes(fromType) ? ptText(v) : String(formatPropertyValueOf(fromP, v) ?? '')).trim();
  const opts = (d) => (d.options ? d.options(propOf(toP)) : propOf(toP).options || []).map(o => typeof o === 'string' ? o : o.value);
  const pick = (list) => list.find(o => String(o).toLowerCase() === text.toLowerCase());
  switch(to){
    case 'Number': return keep(fromType === 'Currency' ? ptNumber(ptMoney(v).amount) : ptNumber(text));
    case 'Currency': return propOf(toP).currencyOnly ? keep(pick(CURRENCY_LIST.map(c => c.code)) || null) : keep(null);
    case 'Date': return keep(ptDay(text) !== null ? defOf('Date').store(defOf('Date').load(text)) : null);
    case 'Timestamp': return keep(!isNaN(new Date(text).getTime()) ? defOf('Timestamp').store(new Date(text)) : null);
    case 'Boolean': return ptBool(text) === null ? {value:'', cleared:true} : {value:ptBool(text), cleared:false};
    case 'Multi-Selection': { const all = opts(defOf(to)), list = ptList(fromType === 'Multi-Selection' ? v : text).filter(x => all.includes(x)); return keep(list.length ? list : null); }
    case 'Single Selection': case 'Country': case 'Language': return keep(pick(opts(defOf(to))) || null);
    case 'User': { const u = (typeof USER_DIRECTORY !== 'undefined' ? USER_DIRECTORY : []).find(x => !x.deleted && (x.id === v || x.name.toLowerCase() === text.toLowerCase())); return keep(u ? u.id : null); }
    case 'Location': case 'Date Range': case 'Custom Range': case 'File Upload': return {value:'', cleared:true};
    default: return keep(text);   // the text types (Single- / Multi-Line Text, Email, URL, Phone Number) — if valid
  }
}

/* Whether a value meets a condition (filters and workflows alike). Changed / Did not change are
   the workflow engine's (they look at when the value last changed). */
function propertyValueMatches(p, opId, actual, value){
  if(opId === 'isEmpty') return propertyIsEmpty(p, actual);
  if(opId === 'isNotEmpty') return !propertyIsEmpty(p, actual);
  if(opId === 'isTrue') return ptBool(actual) === true;
  if(opId === 'isFalse') return ptBool(actual) !== true;
  const compare = propertyCompare(p);
  if(compare === 'multi'){
    const have = ptList(actual), want = Array.isArray(value) ? value : ptList(value);
    if(!want.length) return true;
    if(opId === 'containsAny') return want.some(w => have.includes(w));
    if(opId === 'containsAll') return want.every(w => have.includes(w));
    if(opId === 'notContainsAny') return !want.some(w => have.includes(w));
    return false;
  }
  if(compare === 'number' || compare === 'amount'){
    const a = compare === 'amount' ? ptNumber(ptMoney(actual).amount) : ptNumber(actual), b = ptNumber(value);
    // An empty value isn't the one asked for (Does not equal includes it, as for text); it's no comparison otherwise.
    if(a === null && b !== null) return opId === 'notEquals';
    if(a === null || b === null) return false;
    return {equals:a === b, notEquals:a !== b, gt:a > b, lt:a < b, gte:a >= b, lte:a <= b}[opId] ?? false;
  }
  if(compare === 'date'){
    const a = ptDay(actual), b = ptDay(value);
    if(a === null && b !== null) return opId === 'notEquals';
    if(a === null || b === null) return false;
    return {equals:a === b, notEquals:a !== b, gt:a > b, lt:a < b}[opId] ?? false;
  }
  const a = ptText(actual).trim().toLowerCase(), b = ptText(value).trim().toLowerCase();
  if(opId === 'contains') return a.includes(b);
  if(opId === 'notContains') return !a.includes(b);
  if(opId === 'equals') return a === b;
  if(opId === 'notEquals') return a !== b;
  return false;
}

/* ── Inputs ── */
const ptInputStyle = (invalid) => ({...fieldInput, borderColor: invalid ? T.red : T.borderStrong});
// Multi-Selection: a menu of the options, each ticked on or off; the chosen ones show on the control.
function MultiSelectMenu({value, options, onChange, invalid, placeholder = 'Select options'}){
  const [open, setOpen] = React.useState(false);
  const chosen = ptList(value), opts = (options || []).map(o => typeof o === 'string' ? {value:o, label:o} : o);
  const toggle = (v) => onChange(chosen.includes(v) ? chosen.filter(x => x !== v) : [...chosen, v]);
  return (
    <div style={{position:'relative'}}>
      <button type="button" onMouseDown={e=>e.stopPropagation()} onClick={()=>setOpen(o => !o)}
        style={{...ptInputStyle(invalid), display:'flex', alignItems:'center', gap:6, textAlign:'left', cursor:'pointer', minHeight:36, flexWrap:'wrap'}}>
        {chosen.length ? chosen.map(v => <span key={v} style={{fontSize:12.5, padding:'1px 8px', borderRadius:9999, background:T.headerBg, color:T.attioText}}>{(opts.find(o => o.value === v) || {}).label || v}</span>)
          : <span style={{color:T.gray400}}>{placeholder}</span>}
        <span style={{flex:1}}/><Icon name="chevDown" size={T.chevronSize || 12} color={T.gray600}/>
      </button>
      <MenuShell open={open} onClose={()=>setOpen(false)} width={260}>
        {!opts.length && <div style={{padding:'8px 10px', fontSize:12.5, color:T.gray400}}>No options</div>}
        {opts.map(o => (
          <label key={o.value} onClick={()=>toggle(o.value)} style={{display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:6, fontSize:13, color:T.attioText, cursor:'pointer'}}>
            <RowCheckbox checked={chosen.includes(o.value)} onChange={()=>toggle(o.value)}/>{o.label}
          </label>
        ))}
      </MenuShell>
    </div>
  );
}
/* Phone Number: the country code and the number; the code is kept while the number is still
   empty (the value is "+<code> <number>" once there's a number). */
function PhoneNumberInput({prop, value, onChange, invalid, base}){
  const p = ptPhone(value);
  const [dial, setDial] = React.useState(p.dial);
  React.useEffect(() => { if(p.dial && p.dial !== dial) setDial(p.dial); }, [p.dial]);
  const set = (d, number) => onChange(number.trim() ? (d ? `+${d} ${number.trim()}` : number) : '');
  return (
    <div style={{display:'flex', gap:6}}>
      <div style={{width:128, flexShrink:0}}><FormSelect value={dial} placeholder="Select code" options={dialOptions()} onChange={(d)=>{ setDial(d); set(d, p.number); }} invalid={invalid}/></div>
      <input type="tel" value={p.number} onChange={e=>set(dial, e.target.value)} placeholder={prop.placeholder || '300 0000000'} style={{...base, flex:1, minWidth:0}}/>
    </div>
  );
}
/* The control a property's type generates. `value` is in the type's input shape (load);
   `options`: a choice property's options when they come from elsewhere (users, pipelines). */
/* `label`: a Boolean shows its toggle, then this label (as the creation-form toggles do); no True / False text. */
function TypedPropertyInput({prop, value, onChange, options, invalid, autoFocus, label}){
  const type = propertyTypeId(prop.type), base = ptInputStyle(invalid), d = defOf(prop);
  const opts = options && options.length ? options : d.options ? d.options(prop) : (prop.options || []);
  const radio = (checked, onPick, label) => (
    <label key={label} style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:T.attioText, cursor:'pointer'}}>
      <input type="radio" checked={checked} onChange={onPick} style={{margin:0, width:15, height:15, accentColor:T.black}}/>{label}
    </label>
  );
  const select = (v, set, placeholder) => <FormSelect value={v || ''} placeholder={placeholder} options={opts} onChange={set} invalid={invalid}/>;
  switch(type){
    case 'Multi-Line Text': return <textarea value={ptText(value)} onChange={e=>onChange(e.target.value)} rows={3} style={{...base, resize:'vertical', lineHeight:1.5}}/>;
    case 'Number': return <input type="number" value={ptText(value)} onChange={e=>onChange(e.target.value)} style={base}/>;
    case 'Email': return <input type="email" autoFocus={autoFocus} value={ptText(value)} onChange={e=>onChange(e.target.value)} placeholder={prop.placeholder || 'name@company.com'} style={base}/>;
    case 'URL': return <input type="url" autoFocus={autoFocus} value={ptText(value)} onChange={e=>onChange(e.target.value)} placeholder={prop.placeholder || 'https://'} style={base}/>;
    case 'Phone Number': return <PhoneNumberInput prop={prop} value={value} onChange={onChange} invalid={invalid} base={base}/>;
    case 'Currency': {
      if(prop.currencyOnly) return select(ptText(value), onChange, 'Select currency');
      // The currency starts at the default one (Settings → Defaults); any can be chosen.
      const m0 = ptMoney(value), m = {...m0, currency:m0.currency || defaultCurrency()};
      return (
        // The currency up to 168px wide; in a narrow column (a side panel) it gives way so the amount keeps 80px.
        <div style={{display:'grid', gridTemplateColumns:'minmax(0, 168px) minmax(80px, 1fr)', gap:6}}>
          <div style={{minWidth:0}}><FormSelect value={m.currency} placeholder="Select currency" options={currencyOptions()} onChange={(c)=>onChange({...m, currency:c})} invalid={invalid}/></div>
          <input type="number" value={ptText(m.amount)} onChange={e=>onChange({...m, amount:e.target.value})} placeholder="Amount" style={{...base, minWidth:0}}/>
        </div>
      );
    }
    case 'Location': {
      const l = ptLocation(value), set = (k, v) => onChange({...l, [k]:v});
      return (
        // Two per row where there's room (forms), one per row in narrow columns (side panels).
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(170px, 1fr))', gap:6}}>
          <div><FormSelect value={l.country} placeholder="Select country" options={countryOptions()} onChange={(v)=>set('country', v)} invalid={invalid}/></div>
          <input value={l.street} onChange={e=>set('street', e.target.value)} placeholder="Street Address" aria-label="Street Address" style={base}/>
          <input value={l.city} onChange={e=>set('city', e.target.value)} placeholder="City" aria-label="City" style={base}/>
          <input value={l.state} onChange={e=>set('state', e.target.value)} placeholder="State or Province" aria-label="State or Province" style={base}/>
        </div>
      );
    }
    case 'Boolean': return (
      <span style={{display:'inline-flex', alignItems:'center', gap:8, fontSize:13, color:T.attioText, paddingTop: label ? 0 : 4}}>
        <UtToggle on={ptBool(value) === true} onChange={(v)=>onChange(v)}/>{label}
      </span>
    );
    case 'Date': return <DateField value={value} onChange={onChange} inputStyle={base} ariaLabel={prop.label}/>;
    case 'Timestamp': return <DateTimeField value={value} onChange={onChange} inputStyle={base} ariaLabel={prop.label}/>;
    case 'Date Range': {
      const r = ptDateRange(value);
      return (
        <div style={{display:'flex', alignItems:'center', gap:6}}>
          <div style={{flex:1, minWidth:0}}><DateField value={r.start} onChange={(v)=>onChange({...r, start:v})} inputStyle={base} ariaLabel={`${prop.label} start`} placeholder="Start date"/></div>
          <span style={{color:T.gray400}}>–</span>
          <div style={{flex:1, minWidth:0}}><DateField value={r.end} onChange={(v)=>onChange({...r, end:v})} inputStyle={base} ariaLabel={`${prop.label} end`} placeholder="End date"/></div>
        </div>
      );
    }
    case 'Custom Range': {
      const r = ptCustomRange(value), cfg = prop.range || {};
      return (
        <div style={{display:'flex', alignItems:'center', gap:6}}>
          {cfg.label && <span style={{fontSize:13, color:T.attioMuted, whiteSpace:'nowrap'}}>{cfg.label}</span>}
          <input type="number" value={ptText(r.min)} min={cfg.min} max={cfg.max} onChange={e=>onChange({...r, min:e.target.value})} aria-label={`${prop.label} from`} placeholder="From" style={{...base, flex:1, minWidth:0}}/>
          <span style={{color:T.gray400}}>–</span>
          <input type="number" value={ptText(r.max)} min={cfg.min} max={cfg.max} onChange={e=>onChange({...r, max:e.target.value})} aria-label={`${prop.label} to`} placeholder="To" style={{...base, flex:1, minWidth:0}}/>
        </div>
      );
    }
    case 'Single Selection': return opts.length < 3
      ? <div style={{display:'flex', flexWrap:'wrap', gap:'8px 16px', paddingTop:6}}>{opts.map(o => { const v = typeof o === 'string' ? o : o.value, l = typeof o === 'string' ? o : o.label; return radio(value === v, ()=>onChange(v), l); })}</div>
      : select(value, onChange, prop.placeholder || `Select ${String(prop.label || '').toLowerCase()}`);
    case 'Multi-Selection': return <MultiSelectMenu value={value} options={opts} onChange={onChange} invalid={invalid}/>;
    case 'File Upload': return (
      <div style={{display:'flex', alignItems:'center', gap:8}}>
        <input type="file" onChange={e=>onChange(e.target.files[0] ? e.target.files[0].name : '')} style={{...base, padding:'6px 10px', flex:1, minWidth:0}}/>
        {!ptBlank(value) && <span style={{fontSize:12.5, color:T.attioMuted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:140}}>{value}</span>}
      </div>
    );
    case 'User': case 'Country': case 'Language': case 'Pipeline': case 'Pipeline stage':
      return select(value, onChange, prop.placeholder || `Select ${String(prop.label || type).toLowerCase()}`);
    default: return <input autoFocus={autoFocus} type="text" value={ptText(value)} onChange={e=>onChange(e.target.value)} placeholder={prop.placeholder || ''} style={base}/>;
  }
}
/* The value a condition compares against (filters, workflow triggers and conditions, Assign
   Owner rules) — by the property's type and the operator: none for Is empty / Is true / Changed. */
function ConditionValueInput({prop, op, value, onChange, options, compact}){
  if(!op || op.noValue) return null;
  const d = defOf(prop), compare = propertyCompare(prop), style = {...fieldInput, ...(compact ? {padding:'7px 10px'} : {})};
  const opts = options && options.length ? options : d.options ? d.options(propOf(prop)) : (propOf(prop).options || []);
  if(op.multi || compare === 'multi') return <MultiSelectMenu value={Array.isArray(value) ? value : ptList(value)} options={opts} onChange={onChange}/>;
  if(compare === 'number' || compare === 'amount') return <input type="number" value={ptText(value)} onChange={e=>onChange(e.target.value)} placeholder={compare === 'amount' ? 'Amount' : 'Value'} style={style}/>;
  if(compare === 'date') return <DateField value={ptText(value)} onChange={onChange} inputStyle={style}/>;
  if(compare === 'choice') return <FormSelect value={ptText(value)} placeholder="Select value" options={opts} onChange={onChange}/>;
  return <input type="text" value={ptText(value)} onChange={e=>onChange(e.target.value)} placeholder="Value" style={style}/>;
}

Object.assign(window, {dateShown, LEGACY_CURRENCY, sampleRatesIn, setMoneyDefaults, defaultCurrency, currencyRate, toDefaultCurrency, convertAmount, moneyText, amountCurrencyKey, COUNTRY_LIST, CURRENCY_LIST, LANGUAGE_LIST, countryOptions, currencyOptions, dialOptions, flagOf, LOCATION_FIELDS,
  PT_OPS, PROPERTY_TYPE_DEFS, LEGACY_PROPERTY_TYPES, CREATABLE_PROPERTY_TYPES, propertyTypeId, propertyTypeDef, propertyOperators, propertyCompare, propertyIsEmpty,
  storePropertyValueOf, loadPropertyValueOf, formatPropertyValueOf, validatePropertyValue, propertyValueError, samePropertyValue, formatValue, propertyValueMatches,
  MultiSelectMenu, TypedPropertyInput, ConditionValueInput, convertPropertyValue, ptList, ptBool, ptMoney, ptPhone, ptDay});
