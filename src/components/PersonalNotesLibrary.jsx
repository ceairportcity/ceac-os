import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Sheet } from "./bits";
import { Button } from "../experience-v2/components";

const columns = "id,note_kind,note_date,title,body,created_at,updated_at,reminder_at";
const noteDate = value => value ? new Date(value + "T12:00:00Z").toLocaleDateString("en-GB", {
  timeZone: "Africa/Accra", day: "numeric", month: "short", year: "numeric",
}) : null;

// Reads only when the private library is opened; search and pagination happen on the server.
export default function PersonalNotesLibrary({ me, revision = 0, onClose, onNew, onOpenNote }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [limit, setLimit] = useState(50);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(handle);
  }, [search]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    // PostgREST OR grammar: strip operators rather than inserting arbitrary user text.
    const term = debounced.trim().replace(/[^\p{L}\p{N} -]/gu, " ").trim().slice(0, 80);
    let query = supabase.from("personal_day_notes").select(columns).eq("profile_id", me.id);
    if (filter === "dated") query = query.not("note_date", "is", null);
    if (filter === "standalone") query = query.is("note_date", null);
    if (term) query = query.or("title.ilike.%" + term + "%,body.ilike.%" + term + "%");
    query.order("updated_at", { ascending: false }).range(0, limit - 1)
      .then(({ data, error: readError }) => {
        if (!active) return;
        if (readError) { setRows([]); setError("Notes could not be loaded. Retry without changing your saved notes."); }
        else setRows(data || []);
        setLoading(false);
      }).catch(() => {
        if (active) { setRows([]); setError("Notes could not be loaded. Retry."); setLoading(false); }
      });
    return () => { active = false; };
  }, [me.id, filter, debounced, limit, revision]);

  const chooseFilter = value => { setFilter(value); setLimit(50); };
  return <Sheet onClose={onClose}>
    <div className="phase6-planning-composer" aria-label="Private Notes library">
      <div>
        <span className="eyebrow">My Calendar · Private</span>
        <h2>Notes</h2>
        <p className="screen-note">Find any saved note by date or content. Only you can read these notes.</p>
      </div>
      <div className="phase6-day-note-actions">
        <label>Search notes
          <input className="field" type="search" aria-label="Search private notes" value={search}
            placeholder="Search title or text" onChange={event => { setSearch(event.target.value); setLimit(50); }} />
        </label>
        <Button onClick={onNew}>New note</Button>
      </div>
      <div className="phase6-composer-tabs" role="tablist" aria-label="Notes library filter">
        {[["all","All"],["dated","Dated"],["standalone","Standalone"]].map(([value,label]) =>
          <button key={value} type="button" role="tab" aria-selected={filter === value}
            className={filter === value ? "is-selected" : ""} onClick={() => chooseFilter(value)}>{label}</button>
        )}
      </div>
      {loading ? <p role="status">Loading notes…</p> : error ? <p role="alert">{error}</p> :
        rows.length ? <div className="phase6-day-note-view" aria-label="Saved private notes">
          {rows.map(note => <button type="button" key={note.id} className="phase6-note-card"
            onClick={() => onOpenNote(note)}>
            <span className="phase6-note-card-head">
              <span>{note.note_kind === "daily" ? "Journal" : note.note_date ? "Dated" : "Note"}</span>
              <span>
                <strong>{note.note_kind === "daily" ? "Daily journal" : note.title || "Untitled note"}</strong>
                <small>{note.note_date ? "For " + noteDate(note.note_date) : "Standalone"} · Edited {new Date(note.updated_at).toLocaleDateString("en-GB", { timeZone: "Africa/Accra", day: "numeric", month: "short" })}</small>
              </span>
            </span>
            <p>{note.body.slice(0, 180)}{note.body.length > 180 ? "…" : ""}</p>
          </button>)}
          {rows.length === limit ? <Button variant="secondary" onClick={() => setLimit(n => n + 50)}>Show older notes</Button> : null}
        </div> : <p className="phase6-day-empty">No saved notes match this view.</p>}
      <div className="phase6-composer-actions"><Button variant="secondary" onClick={onClose}>Close</Button></div>
    </div>
  </Sheet>;
}
