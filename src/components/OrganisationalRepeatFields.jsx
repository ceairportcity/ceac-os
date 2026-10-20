import { FieldGroup } from "./bits";
import { ghanaCalendarDate } from "../lib/dailyLandscape";

export const initialOrganisationalRepeat = () => ({ enabled: false, frequency: "weekly", weekday: "6", monthDay: "1", start: ghanaCalendarDate(), end: "" });
const validCivilDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export function organisationalRepeatDetails(repeat, steps) {
  if (!["daily", "weekly", "monthly"].includes(repeat?.frequency))
    throw new Error("Choose a supported repeat frequency.");
  if (!validCivilDate(repeat.start) || (repeat.end && !validCivilDate(repeat.end)) ||
      (repeat.end && repeat.end < repeat.start))
    throw new Error("Choose a valid start date and an end date after it.");
  const weekday = Number(repeat.weekday);
  const monthDay = Number(repeat.monthDay);
  if (repeat.frequency === "weekly" && (!Number.isInteger(weekday) || weekday < 1 || weekday > 7))
    throw new Error("Choose a weekday from Monday to Sunday.");
  if (repeat.frequency === "monthly" && (!Number.isInteger(monthDay) || monthDay < 1 || monthDay > 31))
    throw new Error("Choose a day of month from 1 to 31.");
  return {
    origin: "self_created", schedule_kind: repeat.frequency, starts_on: repeat.start,
    ...(repeat.end ? { ends_on: repeat.end } : {}),
    ...(repeat.frequency === "weekly" ? { weekdays: [weekday] } : {}),
    ...(repeat.frequency === "monthly" ? { day_of_month: monthDay } : {}),
    steps,
  };
}

/** Shared organisational schedule fields. Private Calendar remains a separate flow. */
export default function OrganisationalRepeatFields({ value, onChange, disabled = false }) {
  const update = (key, next) => onChange({ ...value, [key]: next });
  return <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: "12px 0" }}>
    <label><input type="checkbox" checked={value.enabled} onChange={event => update("enabled", event.target.checked)} /> Repeat this responsibility</label>
    {value.enabled && <>
      <FieldGroup label="Repeat frequency"><select className="field" aria-label="Repeat frequency" value={value.frequency} onChange={event => update("frequency", event.target.value)}>
        <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
      </select></FieldGroup>
      {value.frequency === "weekly" && <FieldGroup label="Repeat weekday"><select className="field" aria-label="Repeat weekday" value={value.weekday} onChange={event => update("weekday", event.target.value)}>
        {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map((day, index) => <option value={index+1} key={day}>{day}</option>)}
      </select></FieldGroup>}
      {value.frequency === "monthly" && <FieldGroup label="Day of month"><input className="field" aria-label="Repeat month day" type="number" min="1" max="31" required value={value.monthDay} onChange={event => update("monthDay", event.target.value)} /><p className="small">Months without this date are skipped.</p></FieldGroup>}
      <FieldGroup label="Starts"><input className="field" aria-label="Repeat starts" type="date" required value={value.start} onChange={event => update("start", event.target.value)} /></FieldGroup>
      <FieldGroup label="Ends (optional)"><input className="field" aria-label="Repeat ends" type="date" min={value.start} value={value.end} onChange={event => update("end", event.target.value)} /></FieldGroup>
      <p className="small">Each scheduled date has its own outcome record. Recording one date does not finish the repeating responsibility.</p>
    </>}
  </fieldset>;
}
