/** A suggested template, not an authorised or saved employee schedule.
 * Uses only existing active configured day type IDs. */
const DAYS=["mon","tue","wed","thu","fri","sat","sun"];
export function approvedOfficeWeekTemplate(dayTypes = []) {
  const office = dayTypes.filter(type => type.active && type.session_expected
    && String(type.name).trim().toLowerCase() === "office");
  const rest = dayTypes.filter(type => type.active && !type.session_expected
    && ["weekly off","off day","rest day"].includes(String(type.name).trim().toLowerCase()));
  if (office.length !== 1 || rest.length !== 1) return null;
  return Object.fromEntries(DAYS.map(day => [day,
    ["sat","sun"].includes(day)
      ? { type:rest[0].id,start:"",end:"" }
      : { type:office[0].id,start:"10:00",end:"17:00" }
  ]));
}
