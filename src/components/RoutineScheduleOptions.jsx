import { useId } from "react";
import { FieldGroup } from "./bits";

export default function RoutineScheduleOptions({ value, onChange, frequency = "weekly" }) {
  const zonesId = useId();
  const update = (key,next) => onChange({...value,[key]:next});
  return <div aria-label="Custom schedule options">
    <FieldGroup label="Repeat every">
      <input className="field" type="number" min="1" max="366" required aria-label="Repeat every" value={value.interval} onChange={e=>update("interval",e.target.value)} />
      <small>{frequency === "monthly" ? "months" : frequency === "daily" ? "days" : "weeks"} between scheduled dates.</small>
    </FieldGroup>
    <FieldGroup label="Time zone">
      <input className="field" list={zonesId} required aria-label="Schedule time zone" value={value.timezone} onChange={e=>update("timezone",e.target.value)} />
      <datalist id={zonesId}>{["Africa/Accra","Europe/Amsterdam","Europe/London","America/New_York","America/Los_Angeles","Asia/Dubai","UTC"].map(zone=><option key={zone} value={zone} />)}</datalist>
    </FieldGroup>
    <FieldGroup label="Due time (optional)"><input className="field" type="time" aria-label="Occurrence due time" value={value.dueTime} onChange={e=>update("dueTime",e.target.value)} /></FieldGroup>
    <FieldGroup label="End after (optional)"><input className="field" type="number" min="1" max="5000" aria-label="End after scheduled dates" value={value.limit} onChange={e=>update("limit",e.target.value)} /><small>Scheduled dates from this schedule's start, not completed work. Missing monthly dates are skipped.</small></FieldGroup>
    <p className="small">Dates follow this time zone. If a clock change repeats a time, the later time is used. If it skips a time, that due time moves forward by the clock change.</p>
  </div>;
}
