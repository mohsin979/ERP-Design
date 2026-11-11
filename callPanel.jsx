/* HOF Pulse ERP — call interface with live transcription (prototype).

   What is real here:
     • The microphone (getUserMedia) and a live input-level meter.
     • Live speech-to-text via the browser's Web Speech API (SpeechRecognition). In Chrome/Edge
       the audio is recognised by the browser vendor's speech service (network required); in
       Safari by Apple's. Not supported in Firefox.
     • Interim words appear as they are recognised; final phrases become transcript lines.
   What is simulated: the telephony. There is no real phone line — "Calling…/Connected" is
   presentation only, and only this computer's microphone is transcribed. The customer's own
   audio (on their phone) would need telephony + server transcription later.

   If recognition is unavailable (unsupported browser, permission denied, no network) the
   panel says so explicitly; the Sales Notes panel is then the way to capture the call.

   Sales Notes: a freeform panel on the right, open by default and collapsible during the call.
   It is plain text — shorthand or sentences — not a form. When the call ends the notes are
   saved to the contact's Notes automatically, and Customer Profile extraction reads them first
   (the transcript fills gaps).

   Full screen. Before dialing, the playbook for the call is chosen (Settings → Templates →
   Playbooks; or none); during the call it is a reference panel on the left, collapsible like
   Notes. With no playbooks set up, the call dials straight away. Minimize shrinks the call to a bar
   at the bottom right while it continues — the rest of the CRM stays usable; the bar restores it.
   Rendered into <body>, so the call stays on screen whichever page is open. */

const SPEECH_LANGS = [
  {id:'en-US', label:'English (US)'},
  {id:'en-GB', label:'English (UK)'},
  {id:'en-IN', label:'English (India)'},
  {id:'en-PK', label:'English (Pakistan)'},
  {id:'ur-PK', label:'Urdu (Pakistan)'},
];

const SR_ERRORS = {
  'not-allowed':        'Microphone permission was blocked. Allow microphone access for this site and try again.',
  'service-not-allowed':'This browser does not allow speech recognition here. Use Chrome or Edge, opened directly on this page.',
  'audio-capture':      'No microphone was found.',
  'network':            'The speech service could not be reached (network required in Chrome/Edge).',
  'language-not-supported': 'This language is not supported by the speech service.',
};

const fmtClock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };


function CallPanel({contact, onEnded, onClose, onRunProfile}){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const hub = useRecordHub();
  const playbooks = playbooksOf(hub && hub.data);
  const [phase, setPhase] = React.useState(playbooks.length ? 'choose' : 'ringing');   // choose → ringing → live → ended
  const [playbookPick, setPlaybookPick] = React.useState(playbooks.length ? playbooks[0].id : '');   // '' = no playbook
  const [playbookOpen, setPlaybookOpen] = React.useState(true);
  const [minimized, setMinimized] = React.useState(false);   // a bar at the bottom right; the CRM stays usable and the call continues
  const playbook = phase !== 'choose' ? playbooks.find(p => p.id === playbookPick) || null : null;
  const [startedAt, setStartedAt] = React.useState(null);
  const [now, setNow] = React.useState(Date.now());
  const [segments, setSegments] = React.useState([]);        // {at, offsetMs, text, source:'speech'}
  const [interim, setInterim] = React.useState('');
  const [muted, setMuted] = React.useState(false);
  const [lang, setLang] = React.useState('en-US');
  const [error, setError] = React.useState(SR ? null : 'Live transcription is not supported in this browser. Use Chrome, Edge or Safari.');
  const [level, setLevel] = React.useState(0);
  const [notes, setNotes] = React.useState('');
  const [notesOpen, setNotesOpen] = React.useState(true);
  const [record, setRecord] = React.useState(null);           // the saved call, after it ends

  const recRef = React.useRef(null);
  const liveRef = React.useRef(false);                        // should recognition keep running
  const streamRef = React.useRef(null);
  const audioRef = React.useRef(null);
  const startRef = React.useRef(null);
  const listRef = React.useRef(null);

  // Ring briefly, then "connect".
  React.useEffect(()=>{
    if(phase !== 'ringing') return;
    const t = setTimeout(()=>{ const t0 = Date.now(); startRef.current = t0; setStartedAt(t0); setPhase('live'); }, 1400);
    return () => clearTimeout(t);
  }, [phase]);

  React.useEffect(()=>{
    if(phase !== 'live') return;
    const t = setInterval(()=>setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [phase]);

  // Keep the newest line in view.
  React.useEffect(()=>{ if(listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [segments, interim]);

  const addSegment = (text, source) => {
    const clean = text.trim(); if(!clean) return;
    setSegments(ss => [...ss, {at:new Date(), offsetMs: Date.now() - (startRef.current || Date.now()), text:clean.charAt(0).toUpperCase() + clean.slice(1), source}]);
  };

  /* Microphone level meter — also the point where the browser asks for mic permission. */
  const startMeter = async () => {
    try{
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      streamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream), an = ctx.createAnalyser();
      an.fftSize = 512; src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      let raf;
      const tick = () => { an.getByteTimeDomainData(buf); let sum = 0; for(const b of buf){ const x = (b - 128) / 128; sum += x * x; }
                           setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4)); raf = requestAnimationFrame(tick); };
      tick();
      audioRef.current = {ctx, stop:()=>{ cancelAnimationFrame(raf); ctx.close(); }};
      return true;
    }catch(e){
      setError(e && e.name === 'NotAllowedError' ? SR_ERRORS['not-allowed'] : e && e.name === 'NotFoundError' ? SR_ERRORS['audio-capture'] : `Microphone unavailable: ${e && e.message}`);
      return false;
    }
  };

  const startRecognition = () => {
    if(!SR) return;
    const rec = new SR();
    rec.lang = lang; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let interimText = '';
      for(let i = e.resultIndex; i < e.results.length; i++){
        const r = e.results[i];
        if(r.isFinal) addSegment(r[0].transcript, 'speech'); else interimText += r[0].transcript;
      }
      setInterim(interimText);
    };
    rec.onerror = (e) => { if(e.error === 'no-speech' || e.error === 'aborted') return; setError(SR_ERRORS[e.error] || `Speech recognition error: ${e.error}`); liveRef.current = false; };
    // The service ends sessions after silence or a time limit; restart while the call is live.
    rec.onend = () => { setInterim(''); if(liveRef.current){ try{ rec.start(); }catch(_){} } };
    recRef.current = rec;
    liveRef.current = true;
    try{ rec.start(); }catch(e){ setError(`Could not start speech recognition: ${e.message}`); }
  };

  const stopRecognition = () => { liveRef.current = false; try{ recRef.current && recRef.current.stop(); }catch(_){} };

  // Start mic + recognition when the call connects.
  React.useEffect(()=>{
    if(phase !== 'live') return;
    let cancelled = false;
    (async () => { const ok = await startMeter(); if(ok && !cancelled && !muted) startRecognition(); })();
    return () => { cancelled = true; };
  }, [phase]);

  // Language change or mute: restart / stop recognition.
  React.useEffect(()=>{
    if(phase !== 'live' || error) return;
    stopRecognition();
    if(!muted){ const t = setTimeout(startRecognition, 250); return () => clearTimeout(t); }
  }, [lang, muted]);

  const cleanup = () => {
    stopRecognition();
    audioRef.current && audioRef.current.stop();
    streamRef.current && streamRef.current.getTracks().forEach(t => t.stop());
  };
  React.useEffect(()=>cleanup, []);

  const endCall = () => {
    cleanup();
    const finalSegments = interim.trim() ? [...segments, {at:new Date(), offsetMs:Date.now() - (startRef.current || Date.now()), text:interim.trim(), source:'speech'}] : segments;
    setSegments(finalSegments); setInterim('');
    const durationMs = startedAt ? Date.now() - startedAt : 0;
    const rec = onEnded({startedAt: startedAt ? new Date(startedAt) : new Date(), durationMs, segments:finalSegments, lang, notes:notes.trim()});
    setRecord(rec);
    setPhase('ended');
  };


  const elapsed = phase === 'live' && startedAt ? now - startedAt : (record ? record.durationMs : 0);
  const listening = phase === 'live' && !muted && !error;
  const initials = contact.name.split(/\s+/).slice(0,2).map(w => w[0]).join('').toUpperCase();

  const who = (
    <>
      <span style={{width:42, height:42, borderRadius:9999, background:T.attioText, color:'#fff', fontWeight:700, fontSize:14,
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>{initials}</span>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize:15, fontWeight:600, color:T.attioText}}>{contact.name}</div>
        <div style={{fontSize:12.5, color:T.attioMuted}}>{contact.phone || 'No phone number'}</div>
      </div>
    </>
  );

  // Before dialing: the playbook for this call (or none).
  if(phase === 'choose') return ReactDOM.createPortal(
    <div style={{position:'fixed', inset:0, zIndex:105, background:'#fff', display:'flex', flexDirection:'column'}}>
      <div style={{display:'flex', alignItems:'center', gap:12, padding:'16px 20px', borderBottom:`1px solid ${T.border}`}}>{who}</div>
      <div style={{flex:1, minHeight:0, overflowY:'auto', display:'flex', justifyContent:'center', padding:'40px 20px'}}>
        <div style={{width:'100%', maxWidth:520, display:'flex', flexDirection:'column', gap:14}}>
          <div>
            <div style={{fontSize:16, fontWeight:600, color:T.attioText}}>Choose a playbook</div>
            <div style={{fontSize:13, color:T.attioMuted, marginTop:4}}>It stays open beside the call for reference.</div>
          </div>
          <div role="radiogroup" aria-label="Playbook" style={{display:'flex', flexDirection:'column', gap:8}}>
            {[...playbooks.map(p => ({id:p.id, name:p.name, sub:p.sections.map(s => s.header).join(' · ')})), {id:'', name:'No playbook', sub:'Call without a playbook'}].map(o => {
              const on = playbookPick === o.id;
              return (
                <button key={o.id || 'none'} type="button" role="radio" aria-checked={on} onClick={()=>setPlaybookPick(o.id)}
                  style={{display:'flex', alignItems:'flex-start', gap:10, textAlign:'left', padding:'12px 14px', borderRadius:10, cursor:'pointer', fontFamily:'inherit',
                          border:`1px solid ${on ? T.attioText : T.borderStrong}`, background: on ? T.headerBg : '#fff'}}>
                  <span style={{width:16, height:16, borderRadius:9999, flexShrink:0, marginTop:1, border:`1.5px solid ${on ? T.attioText : T.borderStrong}`,
                                display:'flex', alignItems:'center', justifyContent:'center'}}>
                    {on && <span style={{width:8, height:8, borderRadius:9999, background:T.attioText}}/>}
                  </span>
                  <span style={{minWidth:0}}>
                    <span style={{display:'block', fontSize:13.5, fontWeight:600, color:T.attioText}}>{o.name}</span>
                    <span style={{display:'block', fontSize:12.5, color:T.attioMuted, marginTop:2}}>{o.sub}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{display:'flex', alignItems:'center', gap:8, padding:'12px 20px', borderTop:`1px solid ${T.border}`}}>
        <button onClick={onClose} style={{padding:'8px 14px', borderRadius:8, border:`1px solid ${T.borderStrong}`, background:'#fff', fontSize:13, cursor:'pointer'}}>Cancel</button>
        <div style={{flex:1}}/>
        <button onClick={()=>setPhase('ringing')}
          style={{padding:'8px 16px', borderRadius:8, border:'none', background:T.black, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6}}>
          <Icon name="call" size={14} color="#fff"/> Call
        </button>
      </div>
    </div>, document.body
  );

  const status = phase === 'ringing' ? 'Calling…' : phase === 'live' ? 'Connected' : 'Call ended';
  const statusColor = phase === 'live' ? T.good : phase === 'ended' ? T.attioMuted : T.warm;
  // Minimized: who, status and time, Restore, and End call (Close once it has ended).
  const mini = minimized && (
    <div role="dialog" aria-label={`Call with ${contact.name}`} style={{position:'fixed', right:24, bottom:24, zIndex:105, width:340, background:'#fff',
      border:`1px solid ${T.border}`, borderRadius:12, boxShadow:'0 12px 32px rgba(16,24,40,.18)', display:'flex', alignItems:'center', gap:10, padding:'10px 12px'}}>
      <span style={{width:32, height:32, borderRadius:9999, background:T.attioText, color:'#fff', fontWeight:700, fontSize:12,
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>{initials}</span>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize:13, fontWeight:600, color:T.attioText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{contact.name}</div>
        <div style={{fontSize:12, color:statusColor, fontVariantNumeric:'tabular-nums'}}>{status} · {fmtClock(elapsed)}</div>
      </div>
      <button title="Open call" aria-label="Open call" onClick={()=>setMinimized(false)} style={barIconBtn}><Icon name="expand" size={14} color={T.gray600}/></button>
      {phase !== 'ended' ? (
        <button onClick={endCall} disabled={phase === 'ringing'} title="End call" aria-label="End call"
          style={{width:30, height:30, borderRadius:8, border:'none', background:T.red, cursor: phase === 'ringing' ? 'default' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, opacity: phase === 'ringing' ? .6 : 1}}>
          <Icon name="call" size={14} color="#fff"/>
        </button>
      ) : (
        <button title="Close" aria-label="Close call" onClick={onClose} style={barIconBtn}><Icon name="close" size={13} color={T.gray600}/></button>
      )}
    </div>
  );

  return ReactDOM.createPortal(<>
    {mini}
    <div style={{position:'fixed', inset:0, zIndex:105, background:'#fff', display: minimized ? 'none' : 'flex', overflow:'hidden'}}>

      {/* Playbook — the reference picked before dialing; collapsible, like Notes. */}
      {playbook && (playbookOpen ? (
        <div style={{width:'min(480px, 34vw)', flexShrink:0, borderRight:`1px solid ${T.border}`, display:'flex', flexDirection:'column', background:'#fff'}}>
          <div style={{display:'flex', alignItems:'center', gap:8, padding:'16px 14px 12px 16px', borderBottom:`1px solid ${T.border}`}}>
            <Icon name="playbook" size={15} color={T.attioText}/>
            <span style={{fontSize:14, fontWeight:600, color:T.attioText, flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{playbook.name}</span>
            <button title="Collapse playbook" aria-label="Collapse playbook" onClick={()=>setPlaybookOpen(false)}
              style={{border:'none', background:'transparent', cursor:'pointer', padding:4, display:'flex', borderRadius:6}}>
              <Icon name="chevDown" size={14} color={T.gray600} style={{transform:"rotate(90deg)"}}/>
            </button>
          </div>
          <div style={{flex:1, minHeight:0, overflowY:'auto', padding:'18px 22px 28px'}}><PlaybookSections playbook={playbook}/></div>
        </div>
      ) : (
        <div style={{width:44, flexShrink:0, borderRight:`1px solid ${T.border}`, display:'flex', flexDirection:'column', alignItems:'center', paddingTop:16}}>
          <button title={`Open playbook · ${playbook.name}`} aria-label="Open playbook" onClick={()=>setPlaybookOpen(true)}
            style={{border:'none', background:'transparent', cursor:'pointer', padding:6, display:'flex', borderRadius:6}}>
            <Icon name="playbook" size={16} color={T.attioText}/>
          </button>
        </div>
      ))}

      <div style={{flex:1, minWidth:0, display:'flex', flexDirection:'column'}}>

        {/* Header: who, status, timer */}
        <div style={{display:'flex', alignItems:'center', gap:12, padding:'16px 20px', borderBottom:`1px solid ${T.border}`}}>
          {who}
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:12.5, fontWeight:600, color:statusColor}}>{status}</div>
            <div style={{fontSize:12.5, color:T.attioText, fontVariantNumeric:'tabular-nums'}}>{fmtClock(elapsed)}</div>
          </div>
          {/* Minimize: keep the call going and use the rest of the CRM. */}
          <button title="Minimize call" aria-label="Minimize call" onClick={()=>setMinimized(true)} style={barIconBtn}>
            <Icon name="collapse" size={14} color={T.gray600}/>
          </button>
        </div>

        {/* Transcription status bar */}
        <div style={{display:'flex', alignItems:'center', gap:10, padding:'8px 20px', background:T.headerBg, borderBottom:`1px solid ${T.border}`, fontSize:12.5}}>
          {phase !== 'ended' ? (
            <>
              <span style={{width:8, height:8, borderRadius:9999, background: listening ? T.red : T.attioMuted,
                            boxShadow: listening ? `0 0 0 ${2 + level * 6}px rgba(217,45,32,.18)` : 'none', transition:'box-shadow 80ms'}}/>
              <span style={{color:T.attioText, fontWeight:500}}>
                {error ? 'Live transcription unavailable' : muted ? 'Muted — not transcribing' : phase === 'live' ? 'Live transcription' : 'Waiting to connect'}
              </span>
              {/* Input level from the real microphone. */}
              <div style={{display:'flex', alignItems:'flex-end', gap:2, height:14}}>
                {[0.15,0.35,0.55,0.75,0.9].map((t, i) => (
                  <span key={i} style={{width:3, height:4 + i * 2.5, borderRadius:1, background: level > t && listening ? T.good : '#D6D6DA'}}/>
                ))}
              </div>
              <div style={{flex:1}}/>
              <select value={lang} onChange={e=>setLang(e.target.value)} disabled={!!error}
                style={{fontSize:12, border:`1px solid ${T.borderStrong}`, borderRadius:6, padding:'3px 6px', background:'#fff', color:T.attioText, fontFamily:'inherit'}}>
                {SPEECH_LANGS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </>
          ) : (
            segments.length ? (
              <span style={{display:'flex', alignItems:'center', gap:8, color:T.attioText, fontWeight:500}}>
                <span style={{width:18, height:18, borderRadius:9999, background:T.black, display:'flex', alignItems:'center', justifyContent:'center'}}>
                  <Icon name="check" size={11} color="#fff"/>
                </span>
                Transcript saved to this contact’s activity
              </span>
            ) : <span style={{color:T.attioMuted}}>No transcript was captured.</span>
          )}
        </div>

        {error && phase !== 'ended' && (
          <div style={{margin:'12px 20px 0', padding:'10px 12px', borderRadius:8, background:'#FDF3E8', border:'1px solid #F3D9B8', fontSize:12.5, color:'#7A4A12'}}>
            {error} Use Notes to capture the conversation.
          </div>
        )}

        {/* Transcript */}
        <div ref={listRef} style={{flex:1, minHeight:0, overflowY:'auto', padding:'14px 20px'}}>
          {!segments.length && !interim && (
            <div style={{fontSize:13, color:T.attioMuted, textAlign:'center', marginTop:40}}>
              {phase === 'ringing' ? 'Connecting the call…' : phase === 'live' && !error ? 'Start speaking — your words will appear here as they are recognised.' : phase === 'ended' ? '' : 'No live transcript.'}
            </div>
          )}
          {segments.map((s, i) => (
            <div key={i} style={{display:'flex', gap:10, padding:'6px 0'}}>
              <span style={{fontSize:11.5, color:T.attioMuted, width:36, flexShrink:0, fontVariantNumeric:'tabular-nums', paddingTop:2}}>{fmtClock(s.offsetMs)}</span>
              <div style={{minWidth:0}}>
                <div style={{fontSize:11.5, fontWeight:600, color:T.attioMuted, marginBottom:1}}>You</div>
                <div style={{fontSize:13.5, color:T.attioText, lineHeight:1.5}}>{s.text}</div>
              </div>
            </div>
          ))}
          {interim && (
            <div style={{display:'flex', gap:10, padding:'6px 0'}}>
              <span style={{width:36, flexShrink:0}}/>
              <div style={{fontSize:13.5, color:T.attioMuted, fontStyle:'italic', lineHeight:1.5}}>{interim}</div>
            </div>
          )}
        </div>


        {/* Controls */}
        <div style={{display:'flex', alignItems:'center', gap:8, padding:'12px 20px', borderTop:`1px solid ${T.border}`}}>
          {phase !== 'ended' ? (
            <>
              <button onClick={()=>setMuted(m=>!m)} disabled={phase !== 'live' || !!error}
                style={{padding:'8px 12px', borderRadius:8, border:`1px solid ${T.borderStrong}`, background: muted ? T.headerBg : '#fff', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:6, color:T.attioText}}>
                <Icon name="mic" size={14} color={T.gray600}/>{muted ? 'Unmute' : 'Mute'}
              </button>
              <div style={{flex:1}}/>
              <button onClick={endCall} disabled={phase === 'ringing'}
                style={{padding:'8px 16px', borderRadius:8, border:'none', background:T.red, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6}}>
                <Icon name="call" size={14} color="#fff"/> End call
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} style={{padding:'8px 14px', borderRadius:8, border:`1px solid ${T.borderStrong}`, background:'#fff', fontSize:13, cursor:'pointer'}}>Close</button>
              <div style={{flex:1}}/>
              {onRunProfile && <button onClick={()=>onRunProfile(record)} disabled={!segments.length && !notes.trim()}
                style={{padding:'8px 16px', borderRadius:8, border:'none', background: segments.length || notes.trim() ? T.black : T.gray400, color:'#fff', fontSize:13, fontWeight:600, cursor: segments.length || notes.trim() ? 'pointer' : 'default'}}>
                Run Customer Profile
              </button>}
            </>
          )}
        </div>
      </div>

      {/* Sales Notes — freeform, collapsible, saved to the contact's Notes when the call ends. */}
      {notesOpen ? (
        <div style={{width:300, flexShrink:0, borderLeft:`1px solid ${T.border}`, display:'flex', flexDirection:'column', background:'#fff'}}>
          <div style={{display:'flex', alignItems:'center', gap:8, padding:'16px 14px 12px 16px'}}>
            <Icon name="notepad" size={15} color={T.attioText}/>
            <span style={{fontSize:14, fontWeight:600, color:T.attioText, flex:1}}>Notes</span>
            <button title="Collapse notes" onClick={()=>setNotesOpen(false)}
              style={{border:'none', background:'transparent', cursor:'pointer', padding:4, display:'flex', borderRadius:6}}>
              <Icon name="chevDown" size={14} color={T.gray600} style={{transform:"rotate(-90deg)"}}/>
            </button>
          </div>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} readOnly={phase === 'ended'} autoFocus
            placeholder={'Age: 32\nEducation: Bachelor\nIELTS: L 7.5, R 7, W 7, S 6.5'}
            style={{flex:1, minHeight:0, margin:'0 12px', padding:'10px 12px', resize:'none', fontSize:13, lineHeight:1.6,
                    fontFamily:'inherit', color:T.attioText, border:`1px solid ${T.borderStrong}`, borderRadius:10, outline:'none',
                    background: phase === 'ended' ? T.headerBg : '#fff'}}/>
          <div style={{padding:'10px 16px 14px', minHeight:44, display:'flex', alignItems:'center'}}>
            {phase === 'ended' && notes.trim() && (
              <span style={{display:'flex', alignItems:'center', gap:8, fontSize:12.5, color:T.attioText, fontWeight:500}}>
                <span style={{width:18, height:18, borderRadius:9999, background:T.black, display:'flex', alignItems:'center', justifyContent:'center'}}>
                  <Icon name="check" size={11} color="#fff"/>
                </span>
                Saved to Notes
              </span>
            )}
          </div>
        </div>
      ) : (
        <div style={{width:44, flexShrink:0, borderLeft:`1px solid ${T.border}`, display:'flex', flexDirection:'column', alignItems:'center', paddingTop:16}}>
          <button title="Open notes" onClick={()=>setNotesOpen(true)}
            style={{border:'none', background:'transparent', cursor:'pointer', padding:6, display:'flex', borderRadius:6, position:'relative'}}>
            <Icon name="notepad" size={16} color={T.attioText}/>
            {notes.trim() && <span style={{position:'absolute', top:3, right:3, width:6, height:6, borderRadius:9999, background:T.attioBlue}}/>}
          </button>
        </div>
      )}
    </div>
  </>, document.body);
}

Object.assign(window, {CallPanel});
