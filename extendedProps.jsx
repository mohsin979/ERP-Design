/* HOF Pulse ERP — Customer Profile Properties and Accounting Properties wherever a record's
   properties are picked: filters, table columns, cards and the Overview's Highlights.

   One definition of each — no copies:
     Customer Profile Properties  the Customer Profile forms' fields (customerProfile.jsx),
                                  grouped by form (Canada CRS Score, Australia Points System…);
                                  a record's value is its person's answer (a deal's or customer's
                                  is its contact's).
     Accounting Properties        ACCOUNTING_TRIGGER_FIELDS (workflowEngine.jsx — the workflows'
                                  and filters' list), read from the record's own payment terms.
   Keys: 'pf:<form id>:<field id>', 'acc:<accounting key>'. Values are read-only here (profile
   answers are edited in the Customer Profile tab or Highlights).

   Picking: dropdowns (Filter by) open each group as a submenu; settings lists (Table settings,
   Card settings, Highlights) show each group as an accordion, a profile form a sub-group. */

const EXT_PROFILE_LABEL = 'Customer Profile Properties', EXT_ACCOUNTING_LABEL = 'Accounting Properties';
const isExtendedKey = (k) => typeof k === 'string' && /^(pf|acc):/.test(k);

// The groups: [{id, label, groups:[{id, label, items:[{key, label, group}]}]}].
function extendedPropertyGroups(){
  const forms = PROFILE_FORMS_LIVE || [];
  return [
    {id:'profile', label:EXT_PROFILE_LABEL, groups:forms.map(f => ({id:f.id, label:f.name,
      items:(f.fields || []).filter(x => x.label).map(x => ({key:`pf:${f.id}:${x.id}`, label:x.label, group:f.name}))})).filter(g => g.items.length)},
    {id:'accounting', label:EXT_ACCOUNTING_LABEL, groups:[{id:'accounting', label:null,
      items:ACCOUNTING_TRIGGER_FIELDS.map(a => ({key:`acc:${a.key}`, label:a.label, group:null}))}]},
  ];
}
const extendedItems = () => extendedPropertyGroups().flatMap(c => c.groups.flatMap(g => g.items.map(it => ({...it, category:c.id}))));
// As a property (a table column, a card property): read-only, its group kept for naming it.
const extendedPropOf = (key) => {
  if(!isExtendedKey(key)) return null;
  const it = extendedItems().find(x => x.key === key);
  return it ? {key, label:it.label, group:it.group, category:it.category, extended:true, width:180} : null;
};
const extendedProps = () => extendedItems().map(it => ({key:it.key, label:it.label, group:it.group, category:it.category, extended:true, width:180}));
// "Canada CRS Score · Age" — where the property is named on its own (a selected column, a picked filter).
const extendedFullLabel = (p) => p && p.group ? `${p.group} · ${p.label}` : (p && p.label) || '';

const extendedFormField = (key) => {
  const [, formId, fieldId] = key.split(':');
  const form = (PROFILE_FORMS_LIVE || []).find(f => f.id === formId);
  return form ? (form.fields || []).find(f => f.id === fieldId) || null : null;
};
// A record's value (raw: a number where it's a number — tables sort by it).
function extendedValue(key, record){
  if(!record || !isExtendedKey(key)) return '';
  const object = recordObjectOf(record.id);
  if(key.startsWith('acc:')){
    const f = ACCOUNTING_TRIGGER_FIELDS.find(a => a.key === key.slice(4));
    if(!f) return '';
    const terms = (WF_LIVE.accounting || []).filter(s => s.object === object && String(s.recordId) === String(record.id));
    const v = f.level === 'installments' ? f.readAll(terms) : f.readRecord(terms);
    return Array.isArray(v) ? [...new Set(v)].join(', ') : (v ?? '');
  }
  const [, formId, fieldId] = key.split(':');
  const cid = object === 'contacts' ? record.id : record.contactId;
  if(cid == null) return '';
  const v = ((((WF_LIVE.profiles || {})[cid] || {})[formId] || {}).values || {})[fieldId];
  return v == null ? '' : v;
}
// As shown: money in AED, dates as dates, profile answers as the Customer Profile shows them.
function extendedValueText(key, record){
  const v = extendedValue(key, record);
  if(v === '' || v == null) return '';
  if(key.startsWith('acc:')){
    const f = ACCOUNTING_TRIGGER_FIELDS.find(a => a.key === key.slice(4)) || {};
    if(f.kind === 'number') return fmtMoney(Number(v));
    if(f.kind === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? pfDay(`${v}T00:00:00`) : String(v);
    return String(v);
  }
  const field = extendedFormField(key);
  const t = field ? pfFormat(field, v) : String(v);
  return t === '—' ? '' : t;
}

/* The settings lists' groups — each an accordion (closed until opened, open while searching); a
   profile form a sub-group. `renderItem(item)` draws one property's row (each list its own: a
   checkbox to pin it). `keep(item)`: which properties to offer (default: all). */
function ExtendedPropertyGroups({query, renderItem, keep}){
  const [open, setOpen] = React.useState({});
  const q = (query || '').trim().toLowerCase();
  const toggle = (id) => setOpen(o => ({...o, [id]:!o[id]}));
  const chevron = (on) => <Icon name="chevDown" size={12} color={T.gray600} style={{transform: on ? 'none' : 'rotate(-90deg)', transition:'transform 120ms ease', flexShrink:0}}/>;
  const head = (id, label, count, on, sub) => (
    <button type="button" onClick={()=>toggle(id)} aria-expanded={on}
      style={{display:'flex', alignItems:'center', gap:8, width:'100%', border:'none', background:'transparent', cursor:'pointer', fontFamily:'inherit', textAlign:'left',
        padding: sub ? '6px 6px 6px 22px' : '9px 6px', fontSize: sub ? 12.5 : 13, fontWeight: sub ? 500 : 600, color:T.attioText, borderRadius:6}}>
      {chevron(on)}<span style={{flex:1, minWidth:0}}>{label}</span><span style={{fontSize:12, color:T.gray400, fontWeight:400}}>{count}</span>
    </button>
  );
  return extendedPropertyGroups().map(c => {
    const groups = c.groups.map(g => ({...g, items:g.items.filter(it => (!keep || keep(it))
      && (!q || [it.label, g.label, c.label].some(s => s && s.toLowerCase().includes(q))))})).filter(g => g.items.length);
    if(!groups.length) return null;
    const count = groups.reduce((n, g) => n + g.items.length, 0), on = !!q || !!open[c.id];
    return (
      <div key={c.id} style={{borderTop:`1px solid ${T.border}`, marginTop:6, paddingTop:2}}>
        {head(c.id, c.label, count, on)}
        {on && groups.map(g => {
          if(!g.label) return <div key={g.id} style={{paddingLeft:16}}>{g.items.map(renderItem)}</div>;
          const sid = `${c.id}:${g.id}`, gOn = !!q || !!open[sid];
          return (
            <div key={g.id}>
              {head(sid, g.label, g.items.length, gOn, true)}
              {gOn && <div style={{paddingLeft:30}}>{g.items.map(renderItem)}</div>}
            </div>
          );
        })}
      </div>
    );
  });
}

Object.assign(window, {EXT_PROFILE_LABEL, EXT_ACCOUNTING_LABEL, isExtendedKey, extendedPropertyGroups, extendedItems, extendedPropOf, extendedProps, extendedFullLabel,
  extendedValue, extendedValueText, ExtendedPropertyGroups});
