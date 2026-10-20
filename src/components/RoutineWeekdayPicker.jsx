import { toggleRoutineWeekday } from "../lib/routineWeekdaySelection.js";
import "./RoutineWeekdayPicker.css";

/** Clear, compact weekday checkboxes in the existing organisational Work forms. */
export default function RoutineWeekdayPicker({ value = [], onChange, label = "Repeat weekdays", disabled = false }) {
  const selected = Array.isArray(value) ? value.map(Number) : [];
  return <fieldset className="s2-routine-weekdays" aria-label={label} disabled={disabled}>
    <legend>{label}</legend>
    <div className="s2-routine-weekday-options">
      {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day, index) => {
        const number = index + 1;
        return <label key={day}>
          <input type="checkbox" aria-label={day} checked={selected.includes(number)}
            onChange={event => onChange?.(toggleRoutineWeekday(selected, number, event.target.checked))} />
          <span>{day}</span>
        </label>;
      })}
    </div>
  </fieldset>;
}
