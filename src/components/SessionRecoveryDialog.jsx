import { useId, useState } from "react";
import { Sheet } from "./bits";
import { workDialogLayout as layout } from "./StartWorkDialog";

const day = value => new Date(value).toISOString().slice(0,10); // Accra is UTC, with no daylight saving.

/** One correction form for every role; the caller verifies the saved server row. */
export default function SessionRecoveryDialog({session, endedAt, onEndChange, note, onNoteChange,
  busy, verified, error, onSave, onContinue, onRecheck, onClose}) {
  const id = useId();
  const [date, setDate] = useState(() => endedAt ? day(endedAt) : day(session.started_at));
  const [time, setTime] = useState(() => endedAt ? endedAt.slice(11,16) : "");
  const [attempted, setAttempted] = useState(false);
  const selected = date && time ? `${date}T${time}:00.000Z` : "";
  const invalid = !selected ? "Choose the date and time you stopped working."
    : !Number.isFinite(Date.parse(selected)) ? "Enter a valid end date and time."
    : Date.parse(selected) < Date.parse(session.started_at) ? "End time must be after this session started."
    : Date.parse(selected) > Date.now() ? "End time cannot be in the future." : "";
  function change(nextDate,nextTime) {
    setDate(nextDate);setTime(nextTime);
    onEndChange(nextDate && nextTime ? `${nextDate}T${nextTime}:00.000Z` : "");
  }
  const description = new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Accra",day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(session.started_at));
  return <Sheet className="ceac-start-work-sheet" ariaLabel="Correct earlier session" dismissDisabled={busy} onClose={onClose}>
    <form noValidate style={{display:"flex",flexDirection:"column",maxHeight:"calc(100dvh - 32px)"}} onSubmit={event=>{event.preventDefault();setAttempted(true);if(!busy&&verified&&!invalid)onSave();}}>
      <header style={layout.head}><h2 style={layout.heading}>Correct earlier session</h2></header>
      <div style={{...layout.body,overflowY:"auto",minHeight:0}}>
        <p style={{...layout.help,margin:"0 0 6px",fontSize:14}}>Started {description} · Accra time</p>
        <p style={{...layout.help,margin:"0 0 22px"}}>Record when you stopped working. Your original start and correction stay in the history.</p>
        <fieldset style={layout.fieldset} disabled={busy}>
          <legend style={layout.legend}>When did you finish?</legend>
          <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)",gap:12}}>
            <label style={layout.label} htmlFor={`${id}-date`}>End date
              <input style={{...layout.field,marginTop:8,minWidth:0}} id={`${id}-date`} type="date" required min={day(session.started_at)} max={day(Date.now())} value={date} onChange={e=>change(e.target.value,time)} aria-describedby={`${id}-validation`} />
            </label>
            <label style={layout.label} htmlFor={`${id}-time`}>End time
              <input style={{...layout.field,marginTop:8,minWidth:0}} id={`${id}-time`} type="time" required value={time} onChange={e=>change(date,e.target.value)} aria-describedby={`${id}-validation`} />
            </label>
          </div>
          <p style={layout.help}>Use Accra time (GMT).</p>
          <label style={{...layout.label,marginTop:18}} htmlFor={`${id}-note`}>Correction note <span style={layout.optionalWord}>(optional)</span></label>
          <textarea style={{...layout.field,resize:"vertical"}} id={`${id}-note`} rows={3} maxLength={2000} value={note} onChange={e=>onNoteChange(e.target.value)} placeholder="For example, I forgot to clock out before leaving." />
        </fieldset>
        <div id={`${id}-validation`}>{attempted&&invalid&&<p role="alert" style={layout.error}>{invalid}</p>}</div>
        {error&&<p role="alert" style={layout.error}>{error}</p>}
        {!verified&&<button type="button" style={layout.reload} disabled={busy} onClick={onRecheck}>Recheck saved session</button>}
        <details style={layout.optional}>
          <summary style={layout.summary}>Need to start work today instead?</summary>
          <p style={layout.help}>Start a new session at the previous working location. The earlier session closes at its last confirmed point; overnight work is not assumed.</p>
          <button className="btn btn-sm" type="button" style={{marginTop:12}} disabled={busy||!verified} onClick={onContinue}>Start today's session</button>
        </details>
      </div>
      <footer style={{...layout.footer,flexShrink:0}}>
        <button type="button" style={layout.cancel} disabled={busy} onClick={onClose}>Cancel</button>
        <button className="btn" type="submit" style={layout.start} disabled={busy||!verified}>{busy?"Saving…":"Save end time"}</button>
      </footer>
    </form>
  </Sheet>;
}
