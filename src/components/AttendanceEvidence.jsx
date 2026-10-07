import {useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';
import {attendanceDate,startEvidence} from '../lib/attendance';
import {humanError} from '../lib/productLanguage';
import {FieldGroup,LoadingState,ProductNotice,Sheet} from './bits';
import {WorkforceSection,WorkforceEmpty,WorkforceRecordRow,WorkforceFactGrid} from '../experience-v2/workforce-family/WorkforceFamilyV2';

const KINDS={late_arrival:'Late arrival notice',temporary_permission:'Temporary permission to leave',emergency_absence:'Emergency absence notice',medical_absence:'Medical absence notice'};
const time=v=>v?new Date(v).toLocaleTimeString('en-GB',{timeZone:'Africa/Accra',hour:'2-digit',minute:'2-digit'}):'Not recorded';
const stamp=v=>v?new Date(v).toLocaleString('en-GB',{timeZone:'Africa/Accra'}):'Not recorded';
const state=(n)=>n.request_state==='fulfilled'?(n.kind==='temporary_permission'?'Approved':'Acknowledged'):n.request_state==='declined'?'Declined':n.request_state==='cancelled'?'Cancelled':'Waiting for response';

function LocationPlot({rows}) {
  const points=rows.filter(r=>r.latest_location?.lat!=null && r.latest_location?.lng!=null);
  if(!points.length) return null;
  const lat=points.map(r=>r.latest_location.lat),lng=points.map(r=>r.latest_location.lng);
  const centreLat=(Math.min(...lat)+Math.max(...lat))/2,centreLng=(Math.min(...lng)+Math.max(...lng))/2;
  const span=Math.max(.002,Math.max(...lat)-Math.min(...lat),Math.max(...lng)-Math.min(...lng));
  return <details><summary>Recorded location map · {points.length} people</summary>
    <p className="screen-note">Latest recorded points, with north at the top. This map has no street background and does not show live movement.</p>
    <svg viewBox="0 0 600 280" role="img" aria-label="Latest recorded work locations" style={{width:'100%',maxHeight:280,background:'var(--ev2-surface)',border:'1px solid var(--ev2-line)'}}>
      <text x="12" y="20" fontSize="13">North ↑</text>
      {points.map((r,i)=>{const x=300+(r.latest_location.lng-centreLng)/span*240,y=140-(r.latest_location.lat-centreLat)/span*240;
        return <g key={r.employee_id||r.profile_id}><circle cx={x} cy={y} r="7" fill="var(--ev2-action)"><title>{r.name+' · '+stamp(r.latest_location.captured_at)}</title></circle><text x={x+10} y={y+4+i%2*14} fontSize="12">{r.name}</text></g>;})}
    </svg>
  </details>;
}

export default function AttendanceEvidence({me}) {
  const [date,setDate]=useState(attendanceDate()),[rows,setRows]=useState([]),[corroboration,setCorroboration]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(null),[notice,setNotice]=useState(null),[busy,setBusy]=useState(false);
  const [sheet,setSheet]=useState(false),[kind,setKind]=useState('late_arrival'),[starts,setStarts]=useState(''),[returns,setReturns]=useState(''),[reason,setReason]=useState(''),[note,setNote]=useState('');
  const [decision,setDecision]=useState(null),[decisionNote,setDecisionNote]=useState('');
  const [codeSheet,setCodeSheet]=useState(false),[officeCode,setOfficeCode]=useState('');
  useEffect(()=>{let live=true;setLoading(true);Promise.all([
    supabase.rpc('attendance_day_evidence',{p_date:date}),
    supabase.rpc('attendance_corroboration_for_day',{p_date:date}),
  ]).then(([evidenceResult,corroborationResult])=>{if(!live)return;const e=evidenceResult.error||corroborationResult.error;setRows(evidenceResult.data||[]);setCorroboration(corroborationResult.data||[]);setError(e?humanError(e,'Attendance evidence could not load.'):null);setLoading(false);});return()=>{live=false;};},[me.id,date]);
  async function reload(){const [evidenceResult,corroborationResult]=await Promise.all([supabase.rpc('attendance_day_evidence',{p_date:date}),supabase.rpc('attendance_corroboration_for_day',{p_date:date})]);const e=evidenceResult.error||corroborationResult.error;if(e)throw e;setRows(evidenceResult.data||[]);setCorroboration(corroborationResult.data||[]);}
  async function mutate(name,args,message){
    setBusy(true);setError(null);setNotice(null);
    try {
      const {error:e}=await supabase.rpc(name,args);if(e)throw e;
      setSheet(false);setDecision(null);setNotice(message);
      try {await reload();} catch {setError('The change was recorded, but evidence could not refresh. Use Refresh evidence.');}
    } catch(e) {setError(humanError(e,'The attendance change could not be recorded.'));}
    finally {setBusy(false);}
  }
  async function verifyOfficeCode(){
    const openSession=mine?.sessions?.find(s=>!s.ended_at);
    if(!openSession)return;
    setBusy(true);setError(null);setNotice(null);
    try {
      const {data,error:e}=await supabase.rpc('attendance_verify_office_code',{p_code:officeCode.trim(),p_session_id:openSession.id});
      if(e)throw e;
      setCodeSheet(false);setOfficeCode('');
      if(data?.verified){
        setNotice(data.message||'Office corroboration recorded.');
        try {await reload();} catch {setError('Office corroboration was recorded, but evidence could not refresh.');}
      } else {
        setError(data?.message||'That code was not verified. No attendance conclusion was created.');
      }
    } catch(e) {setError(humanError(e,'Office corroboration could not be recorded.'));}
    finally {setBusy(false);}
  }
    function submit(){mutate('attendance_create_notice',{p_kind:kind,p_starts_at:starts?`${starts}:00Z`:null,p_expected_return_at:returns?`${returns}:00Z`:null,p_reason:kind==='medical_absence'?null:reason.trim(),p_note:kind==='medical_absence'?null:note.trim()},'Attendance notice recorded. Its response history is preserved.');}
  const mine=rows.find(r=>r.profile_id===me.id);
  const mineOpenSession=mine?.sessions?.find(s=>!s.ended_at)||null;
  return <WorkforceSection title="Today’s work location evidence" description="Expected hours, presence and authorised context are separate facts. Location checks happen only while CEAC is open in the foreground; they do not prove productivity.">
    <div className="workforce-setup-actions">
      <FieldGroup label="Evidence date"><input aria-label="Attendance evidence date" className="field" type="date" value={date} onChange={e=>setDate(e.target.value)}/></FieldGroup>
      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={()=>reload().catch(e=>setError(humanError(e,'Evidence could not refresh.')))}>Refresh evidence</button>
      {mine&&<button className="btn btn-sm" onClick={()=>{setKind('late_arrival');setStarts(attendanceDate()+'T'+new Date().toISOString().slice(11,16));setReturns('');setReason('');setNote('');setSheet(true);}}>Record attendance notice</button>}
      {mineOpenSession&&<button className="btn btn-ghost btn-sm" onClick={()=>{setOfficeCode('');setCodeSheet(true);}}>Verify office presence</button>}
    </div>
    {error&&<ProductNotice tone="error" title="Attendance evidence unavailable">{error}</ProductNotice>}
    {notice&&<ProductNotice tone="success" title="Attendance updated">{notice}</ProductNotice>}
    {loading?<LoadingState label="Loading attendance evidence…"/>:<>
      <LocationPlot rows={rows}/>
      {rows.map(row=>{const noAttendanceVolunteer=row.employment_type==='volunteer'&&['no_attendance','not_recorded'].includes(row.working_pattern?.kind||'not_recorded'),start=noAttendanceVolunteer?{label:'No attendance obligation',verified:null}:startEvidence(row,date),location=row.latest_location,currentLeave=row.approved_leave?.filter(l=>l.state==='current')||[],upcoming=row.approved_leave?.filter(l=>l.state==='upcoming')||[];
        const rowCorroboration=corroboration.filter(item=>item.profile_id===row.profile_id);
        const latestCorroboration=rowCorroboration[0]||null;
        return <div key={row.employee_id||row.profile_id}>
          <WorkforceRecordRow icon="person" title={row.name} meta={start.label} note={'Last verified location: '+(location?stamp(location.captured_at)+' · '+(location.geofence==='inside'?'inside office area':location.geofence==='outside'?'outside office area':'location recorded')+(location.accuracy_m!=null?' · accuracy ±'+Math.round(location.accuracy_m)+' m':''):'Not recorded')+' · Last CEAC activity: '+stamp(row.last_activity_at)+(row.sessions?.some(s=>s.end_location_status==='not_verified')?' · End location not verified':'')}/>
          <WorkforceFactGrid items={[
            {label:'Expected today',value:noAttendanceVolunteer?'No attendance obligation':row.expected_today===true?'Session expected':row.expected_today===false?(row.day_type||'No session expected'):'Schedule not configured'},
            {label:'Expected hours',value:noAttendanceVolunteer?'Not applicable':row.expected_start&&row.expected_end?row.expected_start.slice(0,5)+'–'+row.expected_end.slice(0,5):'Not recorded'},
            {label:'First recorded start',value:time(row.sessions?.[0]?.started_at)},
            {label:'Verified office start',value:noAttendanceVolunteer?'Not required':time(start.verified)},
            {label:'Session state',value:row.sessions?.some(s=>!s.ended_at)?'Open':row.sessions?.length?'Ended':'No session recorded'},
            {label:'Corroboration',value:latestCorroboration?(latestCorroboration.result==='verified'?'Recorded · '+latestCorroboration.source_label:'Not verified · '+latestCorroboration.source_label):'No additional signal recorded'},
          ]}/>
          {currentLeave.length>0&&<p className="screen-note">Approved leave · {currentLeave.map(l=>l.start_date+'–'+l.end_date).join(', ')}</p>}
          {upcoming.length>0&&<p className="screen-note">Upcoming approved leave · {upcoming.map(l=>l.start_date+'–'+l.end_date).join(', ')}</p>}
          {(row.notices||[]).map(n=><details key={n.id} className="row"><summary>{KINDS[n.kind]} · {attendanceDate(new Date(n.starts_at))>date?'Upcoming · ':''}{state(n)} · {stamp(n.starts_at)}</summary>
            <p className="screen-note">Communicated {stamp(n.created_at)}{n.expected_return_at?' · Expected return '+stamp(n.expected_return_at):''}{n.returned_at?' · Return reported '+stamp(n.returned_at)+' (self report)':''}</p>
            {n.kind==='temporary_permission'&&n.expected_return_at&&<p className="screen-note">Expected duration: {Math.round((Date.parse(n.expected_return_at)-Date.parse(n.starts_at))/60000)} minutes</p>}
            {n.reason&&<p>{n.reason}</p>}{n.note&&<p>{n.note}</p>}{n.response_note&&<p>{n.response_note}</p>}
            {(n.responses||[]).map((r,i)=><p className="screen-note" key={i}>{r.outcome==='fulfilled'?(n.kind==='temporary_permission'?'Approved':'Acknowledged'):r.outcome} · {stamp(r.created_at)} · Recorded decision actor</p>)}
            {n.can_respond&&n.request_state==='waiting'&&<div className="workforce-row-actions"><button className="btn btn-sm" disabled={busy} onClick={()=>{setDecision({id:n.id,kind:n.kind,outcome:'fulfilled'});setDecisionNote('');}}>{n.kind==='temporary_permission'?'Approve permission':'Acknowledge notice'}</button><button className="btn btn-ghost btn-sm" disabled={busy} onClick={()=>{setDecision({id:n.id,kind:n.kind,outcome:'declined'});setDecisionNote('');}}>Decline</button></div>}
            {row.profile_id===me.id&&n.request_state==='waiting'&&<button className="btn btn-ghost btn-sm" disabled={busy} onClick={()=>mutate('attendance_respond_notice',{p_work_item_id:n.id,p_outcome:'cancelled',p_note:n.kind==='medical_absence'?'Operational response recorded':'Requester cancelled notice'},'Notice cancelled; original notice and history preserved.')}>Cancel notice</button>}
            {row.profile_id===me.id&&n.kind==='temporary_permission'&&!n.returned_at&&Date.parse(n.starts_at)<=Date.now()&&<button className="btn btn-ghost btn-sm" disabled={busy} onClick={()=>mutate('attendance_record_return',{p_work_item_id:n.id},'Return recorded as a self report. It is separate from verified location.')}>Record my return</button>}
          </details>)}
          {!!row.checkpoints?.length&&<details className="row"><summary>Presence check history · {row.checkpoints.length}</summary>{row.checkpoints.map(c=><p className="screen-note" key={c.id}>{c.type==='pre_close'?'Before scheduled close':'Foreground check'} · {stamp(c.received_at)} · {c.captured_at?'Location recorded · '+c.geofence.replaceAll('_',' '):'Location not verified'}{c.failure?' · '+c.failure:''}</p>)}</details>}
          {!!rowCorroboration.length&&<details className="row"><summary>Corroborating evidence · {rowCorroboration.length}</summary><p className="screen-note">Additional signals support review only. They do not prove presence or create attendance, pay or disciplinary conclusions.</p>{rowCorroboration.map(item=><p className="screen-note" key={item.id}>{item.source_label} · {item.result==='verified'?'corroborated':'not verified'} · {stamp(item.received_at)}</p>)}</details>}
        </div>;})}
      {!rows.length&&<WorkforceEmpty compact title="No location records in scope" description="Only authorised employee evidence appears here."/>}
    </>}
    {codeSheet&&<Sheet onClose={()=>!busy&&setCodeSheet(false)}><div className="h2">Verify office presence</div>
      <p className="screen-note">Enter the current short-lived front-desk code. A match is corroborating evidence only and does not replace GPS/geofence evidence or create automatic attendance, pay or disciplinary effects.</p>
      {error&&<ProductNotice tone="error" title="Office verification">{error}</ProductNotice>}
      <FieldGroup label="Office presence code"><input className="field" aria-label="Office presence code" value={officeCode} maxLength={6} autoCapitalize="characters" onChange={e=>setOfficeCode(e.target.value.toUpperCase())} placeholder="6-character code"/></FieldGroup>
      <button className="btn" disabled={busy||officeCode.trim().length!==6} onClick={verifyOfficeCode}>{busy?'Verifying…':'Record corroboration'}</button>
    </Sheet>}
        {sheet&&<Sheet onClose={()=>!busy&&setSheet(false)}><div className="h2">Record attendance notice</div>
      {error&&<ProductNotice tone="error" title="Notice not recorded">{error}</ProductNotice>}
      <FieldGroup label="Notice type"><select aria-label="Attendance notice type" className="field" value={kind} onChange={e=>{setKind(e.target.value);setReason('');setNote('');setReturns('');}}>{Object.entries(KINDS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></FieldGroup>
      <p className="screen-note">{kind==='medical_absence'?'Record dates and operational status only. Send medical details through Protected HR.':kind==='emergency_absence'?'Communicate now, even if advance approval was impossible. This is an attributable notice.':'The recorded unit manager receives this request. Decisions remain attributable.'}</p>
      <FieldGroup label={kind==='temporary_permission'?'Departure (Accra time)':kind==='late_arrival'?'Expected arrival (Accra time)':'Absence begins (Accra time)'}><input aria-label="Attendance notice starts" className="field" type="datetime-local" value={starts} onChange={e=>setStarts(e.target.value)}/></FieldGroup>
      {kind!=='late_arrival'&&<FieldGroup label={kind==='temporary_permission'?'Expected return (Accra time)':'Expected return (optional, Accra time)'}><input aria-label="Attendance expected return" className="field" type="datetime-local" value={returns} min={starts} onChange={e=>setReturns(e.target.value)}/></FieldGroup>}
      {kind!=='medical_absence'&&<><FieldGroup label="Operational reason"><textarea aria-label="Attendance operational reason" className="field" maxLength={600} value={reason} onChange={e=>setReason(e.target.value)}/></FieldGroup><FieldGroup label="Note (optional)"><textarea aria-label="Attendance notice note" className="field" maxLength={1200} value={note} onChange={e=>setNote(e.target.value)}/></FieldGroup></>}
      <button className="btn" disabled={busy||!starts||(kind!=='medical_absence'&&reason.trim().length<3)||(kind==='temporary_permission'&&!returns)||(returns&&returns<=starts)} onClick={submit}>{busy?'Recording…':'Submit notice'}</button>
    </Sheet>}
    {decision&&<Sheet onClose={()=>!busy&&setDecision(null)}><div className="h2">{decision.outcome==='fulfilled'?'Record response':'Decline notice'}</div>
      {error&&<ProductNotice tone="error" title="Response not recorded">{error}</ProductNotice>}
      {decision.kind==='medical_absence'?<p className="screen-note">Only the operational response and its actor/time will be recorded.</p>:<FieldGroup label="Response reason"><textarea aria-label="Attendance response reason" className="field" value={decisionNote} maxLength={600} onChange={e=>setDecisionNote(e.target.value)}/></FieldGroup>}
      <button className="btn" disabled={busy||(decision.kind!=='medical_absence'&&decisionNote.trim().length<3)} onClick={()=>mutate('attendance_respond_notice',{p_work_item_id:decision.id,p_outcome:decision.outcome,p_note:decision.kind==='medical_absence'?'Operational response recorded':decisionNote.trim()},'Response recorded with its actor and time.')}>Confirm response</button>
    </Sheet>}
  </WorkforceSection>;
}
