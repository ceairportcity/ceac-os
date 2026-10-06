export const ACCRA_ZONE = 'Africa/Accra';
export function attendanceDate(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {timeZone: ACCRA_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(value);
}
export function dailyClocks(pattern, date) {
  const key = ['sun','mon','tue','wed','thu','fri','sat'][new Date(`${date}T00:00:00Z`).getUTCDay()];
  return pattern?.clock_map && Object.hasOwn(pattern.clock_map,key)
    ? {start:pattern.clock_map[key]?.start || null,end:pattern.clock_map[key]?.end || null}
    : {start:pattern?.expected_start || null,end:pattern?.expected_end || null};
}
export function startEvidence(row, date) {
  const sessions = row.sessions || [];
  const first = sessions[0];
  const verified = sessions.find(s => s.start_geofence === 'inside' && s.location_captured_at);
  const expected = row.expected_today && row.expected_start ? Date.parse(`${date}T${row.expected_start.slice(0,8).padEnd(8,':00')}Z`) : null;
  if (!first) return {label:'No session recorded',verified:null};
  if (!verified) return {label:'Session recorded · office start not verified',verified:null};
  return {label: expected != null && Date.parse(verified.started_at) > expected
    ? 'Late against recorded working pattern' : 'Office start verified',verified:verified.started_at};
}
export function presenceCheckpoint(row, session, now = new Date()) {
  if (!session || session.ended_at) return null;
  const today = attendanceDate(now);
  // Accra has no DST. Hours are read from the authoritative daily pattern.
  const close = row?.expected_today && row?.expected_end ? Date.parse(`${today}T${row.expected_end.slice(0,8).padEnd(8,':00')}Z`) : NaN;
  if (Number.isFinite(close) && now.getTime() >= close-3600000 && now.getTime() < close)
    return {type:'pre_close',slot:today};
  return {type:'periodic',slot:String(Math.floor(now.getTime()/3600000))};
}
