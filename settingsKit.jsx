/* HOF Pulse ERP — shared pieces for configurable-layout settings modals (Board Card Settings,
   Contact Side Panel View Settings). One pattern, so the two can't drift apart:

     SettingsModalShell — Table Settings' box (900 × the height that modal settles at, 88vh
                          cap), header, draggable section nav on the left (its order IS the
                          layout order), the selected section in the middle, an optional live
                          preview on the right, and the Apply footer.
     SettingsCheckRow   — checkbox + label (+ hint, + right-hand control), optionally draggable.
     useDragReorder     — HTML5 drag-to-reorder for a list, like Table Settings' columns. */

const moveItem = (list, from, to) => {
  if(from == null || to == null || from === to) return list;
  const next = list.slice(); const [m] = next.splice(from, 1); next.splice(to, 0, m); return next;
};

function useDragReorder(onMove){
  const from = React.useRef(null);
  const [over, setOver] = React.useState(null);
  return {
    over,
    props: (i) => ({
      draggable:true,
      onDragStart: () => { from.current = i; },
      onDragOver:  (e) => { e.preventDefault(); setOver(i); },
      onDragLeave: () => setOver(null),
      onDrop:      () => { onMove(from.current, i); from.current = null; setOver(null); },
      onDragEnd:   () => { from.current = null; setOver(null); },
    }),
  };
}

const settingsSectionLabel = {fontSize:11.5, fontWeight:600, letterSpacing:.4, color:T.gray400, textTransform:'uppercase'};

function SettingsCheckRow({label, checked, onToggle, hint, right, drag, dragOver}){
  return (
    <div {...(drag || {})} style={{display:'flex', alignItems:'center', gap:10, padding:'7px 6px', borderRadius:6, fontSize:13, color:T.attioText,
                                   cursor: drag ? 'grab' : 'default', background:'#fff',
                                   outline: dragOver ? `2px solid ${T.attioBlue}` : 'none', outlineOffset:-2}}>
      {drag && <Icon name="dragHandle" size={14} color={T.gray400}/>}
      <div onClick={onToggle} style={{display:'flex', alignItems:'center', gap:10, cursor:'pointer', flex:1, minWidth:0}}>
        <RowCheckbox checked={checked} onChange={onToggle}/>
        <span>{label}</span>
        {hint && <span style={{fontSize:12, color:T.gray400}}>{hint}</span>}
      </div>
      {right}
    </div>
  );
}

/* `fixed`: section ids listed first, not reorderable (settings that aren't a place in the layout,
   e.g. the avatar subtitle). Their labels come from `sections` too. */
/* `applyDisabled` / `footerNote`: Apply held back until the settings are complete, with a note why. */
function SettingsModalShell({title, sections, order, onReorder, section, onSection, toolbar, children, preview, onApply, onClose, fixed = [], applyDisabled, footerNote}){
  const drag = useDragReorder(onReorder);
  useEscapeClose(onClose);
  return (
    <div style={{position:'fixed', inset:0, zIndex:120, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div onClick={onClose} style={{position:'absolute', inset:0, background:'rgba(16,24,40,.35)'}}/>
      <div style={{
        // Same box as Table Settings: 900 wide, and the height that modal settles at (its
        // property list sets it), within the same 88vh cap.
        position:'relative', width:900, maxWidth:'94vw', height:'min(716px, 88vh)', background:'#fff',
        borderRadius:12, boxShadow:'0 16px 40px rgba(16,24,40,.24)', display:'flex', flexDirection:'column',
      }}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:`1px solid ${T.border}`}}>
          <span style={{fontSize:15, fontWeight:600, color:T.attioText}}>{title}</span>
          <button onClick={onClose} style={{border:'none', background:'transparent', cursor:'pointer', display:'flex'}}>
            <Icon name="close" size={16} color={T.gray600}/>
          </button>
        </div>

        <div style={{display:'flex', flex:1, minHeight:0}}>
          {/* Left — sections in layout order; drag to reorder. */}
          <div style={{width:200, borderRight:`1px solid ${T.border}`, padding:'14px 10px', display:'flex', flexDirection:'column', gap:2, flexShrink:0}}>
            {fixed.map(id => (
              <div key={id} onClick={()=>onSection(id)}
                style={{display:'flex', alignItems:'center', gap:6, borderRadius:6, padding:'8px 8px 8px 28px', cursor:'pointer',
                        fontSize:13, fontWeight: id === section ? 600 : 400, color:T.attioText, background: id === section ? T.headerBg : 'transparent'}}>
                {sections[id]}
              </div>
            ))}
            {fixed.length > 0 && order.length > 0 && <div style={{height:1, background:T.border, margin:'4px 2px'}}/>}
            {order.map((id, i) => {
              const on = id === section;
              return (
                <div key={id} {...drag.props(i)} onClick={()=>onSection(id)}
                  style={{display:'flex', alignItems:'center', gap:6, borderRadius:6, padding:'8px 8px', cursor:'grab',
                          fontSize:13, fontWeight: on ? 600 : 400, color:T.attioText, background: on ? T.headerBg : 'transparent',
                          outline: drag.over === i ? `2px solid ${T.attioBlue}` : 'none', outlineOffset:-2}}>
                  <Icon name="dragHandle" size={14} color={T.gray400}/>
                  {sections[id]}
                </div>
              );
            })}
          </div>

          {/* Middle — the selected section */}
          <div style={{flex:1, minWidth:0, display:'flex', flexDirection:'column', minHeight:0}}>
            <div style={{padding:'14px 20px 8px'}}><span style={settingsSectionLabel}>{sections[section]}</span></div>
            {toolbar}
            <div style={{flex:1, overflowY:'auto', padding:'0 14px 16px', display:'flex', flexDirection:'column', gap:2}}>
              {children}
            </div>
          </div>

          {/* Right — live preview on the Board column fill. Display only — except activity
              dropdowns, which expand so their rows can be previewed. */}
          {preview && (
            <div style={{width:340, flexShrink:0, borderLeft:`1px solid ${T.border}`, background:COLUMN_BG, display:'flex', flexDirection:'column', minHeight:0}}>
              <div style={{padding:'14px 20px 8px'}}><span style={settingsSectionLabel}>Preview</span></div>
              <div style={{flex:1, minHeight:0, overflowY:'auto', overflowX:'hidden', padding:'0 20px 16px'}}>
                <div aria-hidden="true" style={{pointerEvents:'none', width:298}}>{preview}</div>
              </div>
            </div>
          )}
        </div>

        {/* As every modal: a note at the left, then Cancel and Apply at the right. */}
        <div style={{display:'flex', alignItems:'center', justifyContent:'flex-end', gap:8, padding:'14px 20px', borderTop:`1px solid ${T.border}`}}>
          {footerNote && <span style={{marginRight:'auto', fontSize:12.5, color:T.attioMuted}}>{footerNote}</span>}
          <StSecondary label="Cancel" onClick={onClose}/>
          <StCta label="Apply" disabled={!!applyDisabled} onClick={onApply}/>
        </div>
      </div>
    </div>
  );
}

/* Number of items a dropdown shows — shared by both settings modals. */
const DROPDOWN_MAX = 20;
function ItemsInput({value, disabled, onChange}){
  return (
    <label style={{display:'flex', alignItems:'center', gap:8, fontSize:12.5, color: disabled ? T.gray400 : T.attioMuted, flexShrink:0}}>
      Items
      <input type="number" min={1} max={DROPDOWN_MAX} value={value} disabled={disabled}
        onChange={e=>{ const n = Math.round(Number(e.target.value)); if(n >= 1 && n <= DROPDOWN_MAX) onChange(n); }}
        style={{width:56, padding:'6px 8px', fontSize:13, fontFamily:'inherit', color:T.attioText,
                border:`1px solid ${T.borderStrong}`, borderRadius:8, background: disabled ? T.pageBg : '#fff'}}/>
    </label>
  );
}

Object.assign(window, {moveItem, useDragReorder, SettingsCheckRow, SettingsModalShell, ItemsInput, settingsSectionLabel, DROPDOWN_MAX});
