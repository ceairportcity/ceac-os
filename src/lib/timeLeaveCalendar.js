const liveStates=new Set(["pending","escalated","approved"]);
export function leaveCalendarDays(year,month){
 const first=new Date(Date.UTC(year,month,1)),offset=(first.getUTCDay()+6)%7;
 return Array.from({length:42},(_,index)=>{
  const day=new Date(Date.UTC(year,month,1-offset+index));
  return {date:day.toISOString().slice(0,10),number:day.getUTCDate(),inMonth:day.getUTCMonth()===month};
 });
}
export function leaveOnCalendarDay(rows,date){
 return rows.filter(row=>liveStates.has(row.status)&&row.start_date<=date&&row.end_date>=date);
}
