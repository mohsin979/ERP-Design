/* HOF Pulse ERP — reusable empty state.

   One pattern for "nothing here yet" across modules, per Figma (HOF CRM Redesign, node 6342:4352):
   a 131×131 hand-drawn illustration standing on its own (no tile or border), an 18px gap, a
   14px Medium title, an 18px gap, then the primary action. 64px top/bottom, 24px side padding.
   An optional one-line description sits under the title when a screen needs one.

   Illustration style (for future empty states): near-black freehand line work (#020202,
   ~3.3px round strokes at 131px), blue accent fills (#0C6FFF solid, and at 14% opacity for an
   offset "shadow" shape behind the drawing), and a small four-point blue spark top-right.
   Each illustration is an exported SVG in assets/empty-states/, registered by name below. */

const EMPTY_ILLUSTRATIONS = {
  profile: 'assets/empty-states/customer-profile.svg',
  list:    'assets/empty-states/empty-list.svg',   // every other empty list, table, tab and page
};

// `illustration`: a registered name; the list one when none is given. `compact`: less padding (inside a tab or table).
function EmptyState({illustration = 'list', title, description, action, compact}){
  const src = illustration && EMPTY_ILLUSTRATIONS[illustration];
  return (
    <div style={{padding: compact ? '32px 24px' : '64px 24px', display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center'}}>
      {src && <img src={src} width={131} height={131} alt="" style={{display:'block', flexShrink:0}}/>}
      <div style={{fontSize:14, fontWeight:500, color:T.attioText, marginTop: src ? 18 : 0}}>{title}</div>
      {description && <div style={{fontSize:13, color:T.attioMuted, marginTop:4}}>{description}</div>}
      {action && <div style={{marginTop:18}}>{action}</div>}
    </div>
  );
}

Object.assign(window, {EmptyState, EMPTY_ILLUSTRATIONS});
