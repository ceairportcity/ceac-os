const escapeText=value=>String(value||'').replace(/\\/g,'\\\\').replace(/\r?\n|\r/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
const stamp=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
function fold(line){let result='',part='',bytes=0;const encoder=new TextEncoder();for(const char of line){const length=encoder.encode(char).length;if(bytes+length>75){result+=part+'\r\n';part=' ';bytes=1;}part+=char;bytes+=length;}return result+part;}
export function meetingCalendarFile(meeting,now=new Date()) {
  const end=meeting.ends_at||new Date(new Date(meeting.starts_at).getTime()+3600000);
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//CEAC OS//Meetings//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',`UID:${meeting.id}@ceac-os`,`DTSTAMP:${stamp(now)}`,`DTSTART:${stamp(meeting.starts_at)}`,`DTEND:${stamp(end)}`,`SUMMARY:${escapeText(meeting.title)}`,`LOCATION:${escapeText(meeting.location)}`,`DESCRIPTION:${escapeText([meeting.agenda,meeting.join_url,'Open CEAC OS for changes and meeting actions.'].filter(Boolean).join('\n'))}`,`STATUS:${meeting.status==='cancelled'?'CANCELLED':'CONFIRMED'}`,'END:VEVENT','END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
}
export function downloadMeetingCalendar(meeting) {
  const url=URL.createObjectURL(new Blob([meetingCalendarFile(meeting)],{type:'text/calendar;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='ceac-meeting.ics';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
