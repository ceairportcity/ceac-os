function ghanaDay(value) {
  const date=value instanceof Date?value:new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Accra",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const map=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
const onlyDate=value=>typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value);
function dateOverdue(value,now) {
  if(!value)return false;
  if(onlyDate(value))return ghanaDay(now)>value;
  const timestamp=new Date(value).getTime();
  return Number.isFinite(timestamp)&&timestamp<now.getTime();
}

export function since(iso) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  return h > 0 ? h + "h " + (mins % 60) + "m" : mins + "m";
}
export function dueLabel(iso,status=null) {
  if(!iso)return "No date";
  const d=new Date(iso),now=new Date();
  if(!Number.isFinite(d.getTime()))return "Date unavailable";
  const dateText=d.toLocaleDateString("en-GB",{timeZone:"Africa/Accra",day:"numeric",month:"short",year:"numeric"});
  if(status&&!["not_started","in_progress","assigned"].includes(status))return "Due "+dateText;
  const nowDay=ghanaDay(now), dueDay=onlyDate(iso)?iso:ghanaDay(d);
  const time=onlyDate(iso)?"":", "+d.toLocaleTimeString("en-GB",{timeZone:"Africa/Accra",hour:"numeric",minute:"2-digit"}).toLowerCase();
  if(dueDay===nowDay)return dateOverdue(iso,now)?"Past due today":"Due today"+time;
  const nextDay=ghanaDay(new Date(now.getTime()+86400000));
  if(dueDay===nextDay)return "Due tomorrow"+time;
  if(dateOverdue(iso,now))return "Past due · "+dateText;
  return "Due "+dateText;
}
export const isOverdue=iso=>dateOverdue(iso,new Date());
export function dateOnly(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Only unfinished, actionable work is overdue; review and dependencies have
 * their own owners and queues. Recurring series are assessed per occurrence. */
export function isWorkOverdue(work, now = Date.now()) {
  if (!work || !["not_started", "in_progress", "assigned"].includes(work.status) || work.kind === "routine") return false;
  return dateOverdue(work.due_at,new Date(now));
}
