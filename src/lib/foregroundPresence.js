import { supabase } from './supabase';
import { getForegroundPosition } from './locationEvidence';
import { presenceCheckpoint } from './attendance';

// Foreground only, one discrete hourly sample plus one pattern-derived pre-close
// attempt. No service worker, watchPosition, hidden-page or background collector.
export function startForegroundPresence(me, session) {
    let stopped=false, busy=false, row=null, loadedAt=0;
    const attempted=new Set();
    async function tick() {
      if (stopped || busy || document.visibilityState!=='visible' || !document.hasFocus()) return;
      busy=true;
      try {
        if (!row || Date.now()-loadedAt>300000) {
          const {data,error}=await supabase.rpc('attendance_day_evidence');
          if (error || stopped) return;
          row=(data||[]).find(r=>r.profile_id===me.id); loadedAt=Date.now();
          // The open session may have started yesterday. The server validates
          // that it remains yours and open; today's read supplies today's pattern.
          if (!row) return;
        }
        const checkpoint=presenceCheckpoint(row,session);
        if (!checkpoint) return;
        const key=`${checkpoint.type}:${checkpoint.slot}`;
        if (attempted.has(key)) return;
        attempted.add(key);
        const position=await getForegroundPosition();
        if (stopped || document.visibilityState!=='visible' || !document.hasFocus()) {attempted.delete(key);return;}
        await supabase.rpc('record_work_checkpoint', {
          p_session_id:session.id,p_type:checkpoint.type,p_lat:position.lat??null,p_lng:position.lng??null,
          p_accuracy_m:position.accuracy??null,p_captured_at:position.capturedAt??null,
          p_device_time:new Date().toISOString(),p_failure:position.failure??null,
        });
      } finally { busy=false; }
    }
    const run=()=>{tick().catch(()=>{});}; // Intermediate failure never blocks work.
    const timer=setInterval(run,60000);
    document.addEventListener('visibilitychange',run); window.addEventListener('focus',run); run();
    return ()=>{stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',run);window.removeEventListener('focus',run);};
}
