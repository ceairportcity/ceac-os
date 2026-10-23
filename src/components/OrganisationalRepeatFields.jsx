import { FieldGroup } from "./bits";
import RoutineScheduleOptions from "./RoutineScheduleOptions";
import { initialRoutineScheduleOptions } from "../lib/routineScheduleOptions";
import { ghanaCalendarDate } from "../lib/dailyLandscape";
import RoutineWeekdayPicker from "./RoutineWeekdayPicker";
export { organisationalRepeatDetails } from "../lib/organisationalRepeatRules.js";

export const initialOrganisationalRepeat = () => ({ enabled: false, frequency: "weekly", weekday: "6", weekdays: [6], monthDay: "1", start: ghanaCalendarDate(), end: "", ...initialRoutineScheduleOptions() });

/** Shared organisational schedule fields. Private Calendar remains a separate flow. */
export default function OrganisationalRepeatFields({ value, onChange, disabled = false }) {
  const update = (key, next) => onChange({ ...value, [key]: next });
  return <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: "12px 0" }}>
    <label><input type="checkbox" checked={value.enabled} onChange={event => update("enabled", event.target.checked)} /> Repeat this responsibility</label>
    {value.enabled && <>
      <FieldGroup label="Repeat frequency"><select className="field" aria-label="Repeat frequency" value={value.frequency} onChange={event => update("frequency", event.target.value)}>
        <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
      </select></FieldGroup>
      {value.frequency === "weekly" && <FieldGroup label="Repeat weekdays">
        <RoutineWeekdayPicker label="Repeat weekdays"
          value={value.weekdays ?? [value.weekday].map(Number)}
          onChange={(weekdays) => onChange({ ...value, weekdays, weekday: String(weekdays[0] ?? "") })} />
        <p className="small">Select each weekday this responsibility repeats. Each scheduled date is recorded separately.</p>
      </FieldGroup>}
      {value.frequency === "monthly" && <FieldGroup label="Day of month"><input className="field" aria-label="Repeat month day" type="number" min="1" max="31" required value={value.monthDay} onChange={event => update("monthDay", event.target.value)} /><p className="small">Months without this date are skipped.</p></FieldGroup>}
      <FieldGroup label="Starts"><input className="field" aria-label="Repeat starts" type="date" required value={value.start} onChange={event => update("start", event.target.value)} /></FieldGroup>
      <FieldGroup label="Ends (optional)"><input className="field" aria-label="Repeat ends" type="date" min={value.start} value={value.end} onChange={event => update("end", event.target.value)} /></FieldGroup>
      <RoutineScheduleOptions value={value} onChange={onChange} frequency={value.frequency} />
      <p className="small">Each scheduled date has its own outcome record. Recording one date does not finish the repeating responsibility.</p>
    </>}
  </fieldset>;
}
