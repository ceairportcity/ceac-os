import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { LoadingState, ProductNotice } from "../components/bits";
import { humanError } from "../lib/productLanguage";
import { CeacIcon } from "../experience-v2/icons";
import { StatusBadge } from "../experience-v2/components";

const ICONS = { department: ["organisation", "purple"], team: ["team", "green"], person: ["account", "blue"], work: ["work", "amber"] };
function DirectoryRow({ kind, title, description, meta, onClick }) {
  const [icon, tone] = ICONS[kind];
  return <button type="button" className="exec-redesign-list-row exec-directory-link" onClick={onClick}>
    <span className={`exec-redesign-icon is-${tone}`}><CeacIcon name={icon} size="row" decorative /></span>
    <span className="exec-redesign-row-copy"><strong>{title}</strong><small>{description}</small></span>
    <span className="exec-redesign-row-meta">{meta}</span><span aria-hidden="true">›</span>
  </button>;
}
function complete(result, label) {
  if (result.error) throw result.error;
  if (!Array.isArray(result.data) || result.count !== result.data.length) throw new Error(`${label} could not be completely loaded. Try again.`);
  return result.data;
}
const emptyDirectory = { units: [], people: [], memberships: [], teams: [], teamMembers: [] };

export default function ExecutiveOrganisation({ me, goAssign, openItem, openRoom }) {
  const [directory, setDirectory] = useState(emptyDirectory);
  const storageKey = `ceac-executive-directory:${me.org_id}:${me.id}`;
  function savedDirectory() {
    try { const value = JSON.parse(sessionStorage.getItem(storageKey) || "{}"); return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
    catch { return {}; }
  }
  const [view, setView] = useState(() => ["departments","teams","people"].includes(savedDirectory().view) ? savedDirectory().view : "departments");
  const [path, setPath] = useState(() => (Array.isArray(savedDirectory().path) ? savedDirectory().path : []).filter(row => row && ["department","team","person"].includes(row.kind) && typeof row.id === "string").slice(-20));
  useEffect(() => { try { sessionStorage.setItem(storageKey, JSON.stringify({view,path})); } catch { /* Navigation still works without storage. */ } }, [storageKey,view,path]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reload, setReload] = useState(0);
  const [loadedScope, setLoadedScope] = useState("");
  const [work, setWork] = useState([]);
  const [workState, setWorkState] = useState({ scope: "", loading: false, error: null });
  const heading = useRef(null);
  const scope = `${me.org_id}:${me.id}`;
  const selected = path.at(-1);
  const personId = selected?.kind === "person" ? selected.id : null;
  const personScope = `${scope}:${personId || ""}`;
  useEffect(() => {
    let current = true;
    setLoading(true); setError(null); setLoadedScope(""); setDirectory(emptyDirectory);
    (async () => {
      try {
        const [units, people, memberships, teams] = await Promise.all([
          supabase.from("units").select("id,name,code,active", { count: "exact" }).eq("org_id", me.org_id).eq("active", true).order("name"),
          supabase.from("profiles").select("id,full_name,job_title,active", { count: "exact" }).eq("org_id", me.org_id).eq("active", true).order("full_name"),
          supabase.from("unit_memberships").select("unit_id,profile_id,role", { count: "exact" }).eq("org_id", me.org_id),
          supabase.from("sub_teams").select("id,name,unit_id,active", { count: "exact" }).eq("org_id", me.org_id).eq("active", true).order("name"),
        ]);
        const next = { units: complete(units, "Departments"), people: complete(people, "People"), memberships: complete(memberships, "Department memberships"), teams: complete(teams, "Teams"), teamMembers: [] };
        if (next.teams.length) next.teamMembers = complete(await supabase.from("sub_team_members").select("sub_team_id,profile_id", { count: "exact" }).in("sub_team_id", next.teams.map(team => team.id)), "Team memberships");
        if (current) {
          setDirectory(next); setLoadedScope(scope);
          setPath(rows => rows.filter(row => (row.kind === "department" ? next.units : row.kind === "team" ? next.teams : next.people).some(record => record.id === row.id)));
        }
      } catch (e) { if (current) setError(humanError(e, "Organisation could not be loaded.")); }
      finally { if (current) setLoading(false); }
    })();
    return () => { current = false; };
  }, [me.org_id, me.id, reload]);
  useEffect(() => {
    let current = true;
    setWork([]); setWorkState({ scope: personScope, loading: Boolean(personId), error: null });
    if (personId) (async () => {
      try {
        const result = await supabase.from("work_items").select("id,ref,title,status,due_at,unit_id,project_id", { count: "exact" }).eq("org_id", me.org_id).eq("assignee_id", personId).neq("visibility", "private").order("due_at", { ascending: true, nullsFirst: false });
        const rows = complete(result, "Assigned work");
        if (current) { setWork(rows); setWorkState({ scope: personScope, loading: false, error: null }); }
      } catch (e) { if (current) setWorkState({ scope: personScope, loading: false, error: humanError(e, "Assigned work could not be loaded.") }); }
    })();
    return () => { current = false; };
  }, [personId, personScope, me.org_id]);
  useEffect(() => { if (path.length) heading.current?.focus(); }, [path]);

  const ready = loadedScope === scope && !loading && !error;
  const { units, people, memberships, teams, teamMembers } = ready ? directory : emptyDirectory;
  const unitName = id => units.find(row => row.id === id)?.name || "Department not recorded";
  const membersOf = id => people.filter(person => memberships.some(row => row.unit_id === id && row.profile_id === person.id));
  const headNames = id => people.filter(person => memberships.some(row => row.unit_id === id && row.profile_id === person.id && row.role === "manager")).map(person => person.full_name).join(", ");
  const missingLeaders = units.filter(unit => !headNames(unit.id));
  const department = selected?.kind === "department" ? units.find(row => row.id === selected.id) : null;
  const team = selected?.kind === "team" ? teams.find(row => row.id === selected.id) : null;
  const person = people.find(row => row.id === personId);
  const placements = person ? memberships.filter(row => row.profile_id === person.id && units.some(unit => unit.id === row.unit_id)) : [];
  const enter = (kind, id) => { setPath(current => [...current, { kind, id }].slice(-20)); setQuery(""); };
  const back = () => { setPath(current => current.slice(0, -1)); setQuery(""); };
  const matches = row => !query.trim() || `${row.name || row.full_name || ""} ${row.job_title || ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const peopleRows = rows => rows.filter(matches).map(row => <DirectoryRow key={row.id} kind="person" title={row.full_name || "Recorded person"} description={row.job_title || "Role not recorded"} onClick={() => enter("person", row.id)} />);
  const list = (label, children) => <section aria-label={label} className="exec-redesign-list">{children.length ? children : <p className="exec-redesign-empty">No {label.toLowerCase()} match this view.</p>}</section>;

  return <div className="body ev2-exec-organisation exec-redesign-page">
    {selected && <button type="button" className="exec-directory-back" onClick={back}><CeacIcon name="arrowLeft" size="row" decorative /> Back to {path.length > 1 ? "previous view" : "Organisation"}</button>}
    <header className="exec-redesign-head"><div>
      <span>{person ? "Person" : team ? unitName(team.unit_id) : department ? "Department" : "Across CEAC"}</span>
      <h1 ref={heading} tabIndex={-1}>{person?.full_name || team?.name || department?.name || "Organisation"}</h1>
      <p>{person ? person.job_title || "Role not recorded" : team ? "People in this team and their recorded responsibilities." : department ? `Head: ${headNames(department.id) || "Not recorded"}` : "Explore departments, teams and people, then open the work behind them."}</p>
    </div>{!selected && ready && <StatusBadge tone={missingLeaders.length ? "warning" : "neutral"} icon={false}>{missingLeaders.length ? `${missingLeaders.length} leadership gap${missingLeaders.length === 1 ? "" : "s"}` : "Department heads recorded"}</StatusBadge>}{department && <button type="button" className="btn" onClick={() => goAssign?.({ unitId: department.id })}>Give out work</button>}</header>
    {!selected && <div className="exec-redesign-tabs" role="group" aria-label="Organisation views">{[["departments", "Departments"], ["teams", "Teams"], ["people", "People"]].map(([key, label]) => <button key={key} type="button" aria-pressed={view === key} className={view === key ? "is-active" : ""} onClick={() => { setView(key); setQuery(""); }}>{label}</button>)}</div>}
    {loading && <LoadingState label="Loading organisation…" />}
    {error && <ProductNotice tone="error" title="Could not load Organisation" action={<button type="button" className="btn btn-ghost" onClick={() => setReload(n => n + 1)}>Try again</button>}>{error}</ProductNotice>}
    {ready && <>
      {!selected && view === "departments" && missingLeaders.length > 0 && <ProductNotice tone="attention" title="Needs attention">{missingLeaders.map(unit => unit.name).join(", ")} {missingLeaders.length === 1 ? "has" : "have"} no active department head recorded.</ProductNotice>}
      {!person && <label className="exec-directory-search">Find {department || team ? "a person or team" : view}<input className="field" type="search" value={query} onChange={e => setQuery(e.target.value)} /></label>}
      {!selected && view === "departments" && list("Departments", units.filter(matches).map(row => <DirectoryRow key={row.id} kind="department" title={row.name} description={headNames(row.id) || "Head not recorded"} meta={`${membersOf(row.id).length} people`} onClick={() => enter("department", row.id)} />))}
      {!selected && view === "teams" && list("Teams", teams.filter(matches).map(row => <DirectoryRow key={row.id} kind="team" title={row.name} description={unitName(row.unit_id)} onClick={() => enter("team", row.id)} />))}
      {!selected && view === "people" && list("People", peopleRows(people))}
      {department && <><h2>People</h2>{list("People", peopleRows(membersOf(department.id)))}<h2>Teams</h2>{list("Teams", teams.filter(row => row.unit_id === department.id).filter(matches).map(row => <DirectoryRow key={row.id} kind="team" title={row.name} description={unitName(row.unit_id)} onClick={() => enter("team", row.id)} />))}<button type="button" className="btn btn-ghost" onClick={() => openRoom?.({ kind: "unit", unitId: department.id })}>Open department room</button></>}
      {team && list("People", peopleRows(people.filter(row => teamMembers.some(member => member.sub_team_id === team.id && member.profile_id === row.id))))}
      {person && <><h2>Departments</h2>{list("Departments", placements.map(row => <DirectoryRow key={row.unit_id} kind="department" title={unitName(row.unit_id)} description={row.role === "manager" ? "Department head" : "Department member"} onClick={() => enter("department", row.unit_id)} />))}
        <div className="exec-directory-actions">{placements.map(row => <div key={row.unit_id}><button type="button" className="btn" onClick={() => goAssign?.({ unitId: row.unit_id, assigneeId: person.id })}>Give work in {unitName(row.unit_id)}</button><button type="button" className="btn btn-ghost" onClick={() => openRoom?.({ kind:"unit",unitId:row.unit_id,mentionProfileId:person.id })}>Message in {unitName(row.unit_id)} room</button></div>)}</div>
        {placements.length > 0 && <p className="screen-note">Room messages are shared with the department. The selected person is mentioned after their room access is verified.</p>}
        <h2>Assigned work</h2><p className="screen-note">Shared work visible to your account. Private planning and confidential HR records stay separate.</p>
        {(workState.scope !== personScope || workState.loading) ? <LoadingState label="Loading assigned work…" /> : workState.error ? <ProductNotice tone="error" title="Assigned work unavailable">{workState.error}</ProductNotice> : list("Assigned work", work.map(row => <DirectoryRow key={row.id} kind="work" title={`${row.ref} · ${row.title}`} description={unitName(row.unit_id)} meta={row.status.replaceAll("_", " ")} onClick={() => openItem?.(row.id)} />))}
      </>}
    </>}
  </div>;
}
