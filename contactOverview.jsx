/* HOF Pulse ERP — Contact workspace: Overview tab.

   A quick read of the contact without opening every tab. Two sections, same card language:
     1. Highlights — four KPI cards: a label and one large value. Which four is set in View
                     Settings (overviewSettings.jsx), per record type.
     2. Activity   — the record's activity (what the Activity tab held), below the Highlights
                     (ContactWorkspace, contactDetail.jsx). There are no Snapshots any more.
   Structure follows Attio's record Overview (highlights grid, then summarised activity with
   "View all"); styling is the product's own.

   Text uses the stronger greys (attioText / attioMuted) throughout — no faint grey — since
   this is information people scan and read. */

const sectionTitle = {fontSize:13, fontWeight:600, color:T.attioText};
const overviewCard = {background:'#fff', border:`1px solid ${T.attioLine}`, borderRadius:10};

function SectionHeader({title, inline, right}){
  return (
    <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:10, minHeight:24}}>
      <span style={sectionTitle}>{title}</span>
      {inline}
      <div style={{flex:1}}/>
      {right}
    </div>
  );
}

/* ── Highlights ─────────────────────────────────────────────────────────────────────────── */

function KpiCard({label, value, caption}){
  return (
    <div style={{...overviewCard, padding:'10px 12px', display:'flex', flexDirection:'column', gap:8, minHeight:76}}>
      {/* A long label wraps; cards in a row take the tallest card's height (grid stretch). */}
      <span style={{fontSize:12, color:T.attioMuted, fontWeight:400, lineHeight:1.35, overflowWrap:'anywhere'}}>{label}</span>
      <div style={{marginTop:'auto'}}>
        {value}
        {caption && <div style={{fontSize:12, color:T.attioMuted, marginTop:2}}>{caption}</div>}
      </div>
    </div>
  );
}

/* Compact value treatment, shared by all four highlights. */
const kpiValue = {fontSize:17, fontWeight:500, lineHeight:1.25, display:'flex', alignItems:'center', gap:5};
const notSet = () => <div style={{...kpiValue, color:T.attioMuted, fontWeight:500}}>—</div>;

Object.assign(window, {SectionHeader, KpiCard, kpiValue, notSet});
