import { useId } from "react";
import { ArrowRight, Building2, ChevronDown, LocateFixed, MapPin } from "lucide-react";
import { Sheet } from "./bits";
import "./StartWorkDialog.css";

// Static layout values stay local to this dialog; all colour values reuse CEAC tokens.
const muted = "var(--ev2-text-secondary,var(--ceac-muted))";
const line = "1px solid var(--ev2-line,var(--ceac-line))";
const gutter = "clamp(18px, 4.8vw, 24px)";
const layout = {
  head: {padding:`20px 66px 20px ${gutter}`,borderBottom:line},
  heading: {margin:0,fontSize:20,fontWeight:600,letterSpacing:"-.025em",lineHeight:1.3},
  body: {padding:`22px ${gutter} 20px`},
  fieldset: {border:0,padding:0,margin:"0 0 22px",display:"block",minWidth:0},
  legend: {fontSize:14,fontWeight:500,marginBottom:12,padding:0},
  choices: {display:"grid",gridTemplateColumns:"1fr 1fr",gap:10},
  choice: {display:"flex",flexDirection:"column",alignItems:"stretch",gap:12,border:line,borderRadius:10,padding:"14px 12px",minWidth:0,cursor:"pointer"},
  selected: {borderColor:"var(--ev2-action,var(--ceac-action-blue))",background:"var(--ev2-action-soft,var(--ceac-surface-soft))"},
  choiceTop: {display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,color:muted,minHeight:20},
  radio: {width:17,height:17,accentColor:"var(--ev2-action,var(--ceac-action-blue))",margin:0},
  title: {display:"block",fontSize:14,fontWeight:600},
  description: {display:"block",fontSize:12,color:muted,marginTop:3,lineHeight:1.4},
  label: {display:"block",fontSize:14,fontWeight:500,marginBottom:8},
  field: {display:"block",width:"100%",minHeight:48,background:"var(--ev2-surface,var(--ceac-surface))",color:"inherit",border:line,borderRadius:8,padding:"11px 12px",font:"inherit",fontSize:16,boxSizing:"border-box"},
  help: {fontSize:12,color:muted,margin:"7px 0 0",lineHeight:1.5},
  optional: {marginTop:18,borderTop:line,paddingTop:6},
  summary: {display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,minHeight:48,listStyle:"none",cursor:"pointer",fontSize:14},
  optionalWord: {color:muted,fontSize:12,marginLeft:5},
  note: {display:"flex",alignItems:"flex-start",gap:10,background:"var(--ev2-surface-soft,var(--ceac-surface-soft))",borderRadius:8,padding:12,marginTop:20,color:muted,fontSize:12,lineHeight:1.5},
  noteIcon: {flex:"none",marginTop:2},
  noteTitle: {display:"block",color:"var(--ev2-text,var(--ceac-text))",fontWeight:500,marginBottom:2},
  footer: {display:"flex",gap:12,alignItems:"center",justifyContent:"space-between",padding:`16px ${gutter} calc(16px + env(safe-area-inset-bottom))`,borderTop:line},
  cancel: {minHeight:44,padding:"10px 0",color:muted,fontSize:14},
  start: {display:"flex",width:"auto",alignItems:"center",justifyContent:"center",gap:9,minHeight:46,minWidth:146,padding:"11px 20px",fontSize:14,fontWeight:600,margin:0},
  error: {margin:"14px 0 0",color:"var(--ev2-danger,var(--brick))",fontSize:13,lineHeight:1.5,overflowWrap:"anywhere"},
  reload: {minHeight:44,marginTop:8,textDecoration:"underline",color:"var(--ev2-action,var(--ceac-action-blue))",fontSize:13},
};

/** Presentation only: callers retain employee/tenant validation and write recovery. */
export default function StartWorkDialog({
  place, onPlaceChange, locationName, onLocationNameChange,
  locationId, onLocationChange, locations, locationStatus,
  workId, onWorkChange, workItems, workStatus,
  busy, canStart, error, onReload, onStart, onClose,
}) {
  const id = useId();
  const offsite = place === "elsewhere";
  return <Sheet className="ceac-start-work-sheet" ariaLabel="Start work" onClose={onClose} dismissDisabled={busy}>
    <form className="ceac-start-work-form" onSubmit={event => { event.preventDefault(); if (!busy && canStart) onStart(); }}>
      <header className="cw-head" style={layout.head}><h2 style={layout.heading}>Start work</h2></header>
      <div className="cw-body" style={layout.body}>
        <fieldset className="cw-location-choices" style={layout.fieldset} disabled={busy}>
          <legend style={layout.legend}>Where are you working today?</legend>
          <div className="cw-choices" style={layout.choices}>
            {[
              { value: "office", title: "CEAC location", description: "Office or programme venue", Icon: Building2 },
              { value: "elsewhere", title: "Off-site", description: "Home, fieldwork or elsewhere", Icon: MapPin },
            ].map(({ value, title, description, Icon }) => <label className="cw-choice" style={place === value ? {...layout.choice,...layout.selected} : layout.choice} key={value}>
              <span className="cw-choice-top" style={layout.choiceTop}><Icon size={20} aria-hidden="true" /><input style={layout.radio} type="radio" name={`${id}-place`} value={value} checked={place === value} onChange={() => onPlaceChange(value)} aria-label={title} /></span>
              <span><strong style={layout.title}>{title}</strong><small style={layout.description}>{description}</small></span>
            </label>)}
          </div>
        </fieldset>
        {offsite ? <>
          <label className="cw-field-label" style={layout.label} htmlFor={`${id}-place-name`}>Place name</label>
          <input className="cw-field" style={layout.field} id={`${id}-place-name`} name="offsite_location_name" required maxLength={200} value={locationName} disabled={busy}
            onChange={event => onLocationNameChange(event.target.value)} placeholder="Where are you working from?" aria-describedby={`${id}-place-help`} />
          <p className="cw-help" style={layout.help} id={`${id}-place-help`}>For example, Home or a client’s office.</p>
          <details className="cw-optional" style={layout.optional}>
            <summary style={layout.summary}><span>Link a responsibility <span className="cw-optional-word" style={layout.optionalWord}>Optional</span></span><ChevronDown className="cw-chevron" size={16} aria-hidden="true" /></summary>
            <label className="cw-field-label" style={layout.label} htmlFor={`${id}-work`}>Your responsibility</label>
            <select className="cw-field" style={layout.field} id={`${id}-work`} value={workId} disabled={busy || workStatus !== "ready"} onChange={event => onWorkChange(event.target.value)}>
              <option value="">Continue without linking work</option>
              {workItems.map(item => <option key={item.id} value={item.id}>{item.ref} · {item.title}</option>)}
            </select>
            {workStatus === "loading" && <p className="cw-help" style={layout.help} role="status">Loading your responsibilities…</p>}
            {workStatus === "error" && <p className="cw-help" style={layout.help} role="status">Responsibilities could not be loaded. You can still start without linking one.</p>}
            {workStatus === "ready" && workItems.length === 0 && <p className="cw-help" style={layout.help} role="status">No responsibility is required to start off-site.</p>}
          </details>
        </> : <>
          <label className="cw-field-label" style={layout.label} htmlFor={`${id}-office`}>CEAC location</label>
          <select className="cw-field" style={layout.field} id={`${id}-office`} aria-label="Authorised duty location" required value={locationId} disabled={busy || locationStatus !== "ready"} onChange={event => onLocationChange(event.target.value)}>
            <option value="">Choose your location</option>
            {locations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}
          </select>
          {locationStatus === "loading" && <p className="cw-help" style={layout.help} role="status">Loading CEAC locations…</p>}
          {locationStatus === "error" && <p className="cw-help" style={layout.help} role="alert">Approved locations could not be loaded.</p>}
          {locationStatus === "ready" && locations.length === 0 && <p className="cw-help" style={layout.help} role="status">No CEAC location has been set up. Ask Administration to add it.</p>}
          <p className="cw-help" style={layout.help}>Your device location must be within the selected venue.</p>
        </>}
        <div className="cw-location-note" style={layout.note}><LocateFixed style={layout.noteIcon} size={17} aria-hidden="true" /><p style={{margin:0}}><strong style={layout.noteTitle}>Allow location access when prompted</strong>Your location is captured when you start. No continuous tracking.</p></div>
        {error && <p className="cw-error" style={layout.error} role="alert">{error}</p>}
        {(error || locationStatus === "error" || (offsite && workStatus === "error")) && <button className="cw-reload" style={layout.reload} type="button" disabled={busy} onClick={onReload}>Reload start options</button>}
      </div>
      <footer className="cw-footer" style={layout.footer}><button className="cw-cancel" style={layout.cancel} type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="btn cw-start" style={layout.start} type="submit" disabled={busy || !canStart}>
        {busy ? "Checking location…" : "Start work"}<ArrowRight size={17} aria-hidden="true" />
      </button></footer>
    </form>
  </Sheet>;
}
