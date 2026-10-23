export const WORKFORCE_DAYS = [
  ["mon","Monday"],["tue","Tuesday"],["wed","Wednesday"],
  ["thu","Thursday"],["fri","Friday"],["sat","Saturday"],["sun","Sunday"],
];

// Presentation only: never fill missing evidence, infer attendance, or
// substitute for the historical, HR-approved workforce schedule source.
export function workforceRecordedWeek(version,dayTypes=[]) {
  if(!version) return [];
  const names=new Map(dayTypes.map(type=>[type.id,type]));
  return WORKFORCE_DAYS.map(([key,label])=>{
    const typeId=version.day_map?.[key]||null;
    const dayType=names.get(typeId);
    const clock=version.clock_map?.[key]||{};
    const start=typeof clock.start==="string"&&/^\d{2}:\d{2}/.test(clock.start)
      ?clock.start.slice(0,5):null;
    const end=typeof clock.end==="string"&&/^\d{2}:\d{2}/.test(clock.end)
      ?clock.end.slice(0,5):null;
    return {
      key,label,
      typeName:typeId?(dayType?.name||"Recorded day type not available"):"Day type not recorded",
      hours:dayType?.session_expected
        ?(start&&end?`${start}–${end}`:"Expected session hours not recorded")
        :dayType?"No expected session hours":"Expected hours cannot be confirmed",
      configured:Boolean(typeId),
    };
  });
}
