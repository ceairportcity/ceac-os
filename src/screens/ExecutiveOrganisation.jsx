import { Table } from "../components/primitives";
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
const emptyDirectory = { units: [], people: [], memberships: [], teams: [], teamMembers: [], employment: [] };
const peopleViewFor = (directory) => directory === "staff" || directory === "volunteers" ? "people" : directory;
const peopleGroupFor = (directory) => directory === "staff" || directory === "volunteers" ? directory : "all";

export default function ExecutiveOrganisation({ me, initialDirectory = null, goAssign, openItem, openRoom }) {
  const [directory, setDirectory] = useState(emptyDirectory);
  const storageKey = `ceac-executive-directory:${me.org_id}:${me.id}`;
  function savedDirectory() {
    try { const value = JSON.parse(sessionStorage.getItem(storageKey) || "{}"); return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
    catch { return {}; }
  }
  const [view, setView] = useState(() => peopleViewFor(initialDirectory) || (["departments","teams","people"].includes(savedDirectory().view) ? savedDirectory().view : "departments"));
  const [peopleGroup, setPeopleGroup] = useState(() => peopleGroupFor(initialDirectory));
  const [path, setPath] = useState(() => (Array.isArray(savedDirectory().path) ? savedDirectory().path : []).filter(row => row && ["department","team","person"].includes(row.kind) && typeof row.id === "string").slice(-20));
  useEffect(() => { try { sessionStorage.setItem(storageKey, JSON.stringify({view,path})); } catch { /* Navigation still works without storage. */ } }, [storageKey,view,path]);
  useEffect(() => { if (initialDirectory) { setView(peopleViewFor(initialDirectory)); setPeopleGroup(peopleGroupFor(initialDirectory)); setPath([]); setQuery(""); } }, [initialDirectory]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reload, setReload] = useState(0);
  const [loadedScope, setLoadedScope] = useState("");
  const [work, setWork] = useState([]);
  const [expandedWorkScope, setExpandedWorkScope] = useState("");
  const [personTab, setPersonTab] = useState("overview");
  const [selectedActionUnitId, setSelectedActionUnitId] = useState("");
  const [timeRecords, setTimeRecords] = useState({scope:"",loading:false,sessions:[],leave:[],sessionError:null,leaveError:null});
  const [scheduleRead, setScheduleRead] = useState({scope:"",loading:false,days:[],error:null});
  const [workState, setWorkState] = useState({ scope: "", loading: false, error: null });
  const heading = useRef(null);
  const scope = `${me.org_id}:${me.id}`;
  const selected = path.at(-1);
  const personId = selected?.kind === "person" ? selected.id : null;
  const personScope = `${scope}:${personId || ""}`;
  const showAssignedWork = Boolean(personId && expandedWorkScope === personScope && personTab === "work");
  useEffect(() => { setPersonTab("overview"); setSelectedActionUnitId(""); }, [personId]);
  useEffect(() => {
    let current=true;
    setTimeRecords({scope:personScope,loading:personTab==="time" && Boolean(personId),sessions:[],leave:[],sessionError:null,leaveError:null});
    if (personTab === "time" && personId) {
      (async () => {
        const results = await Promise.allSettled([
          supabase.from("work_sessions")
            .select("id,started_at,ended_at,place,end_reason")
            .eq("org_id",me.org_id).eq("profile_id",personId)
            .order("started_at",{ascending:false}).limit(14),
          supabase.rpc("executive_personnel_leave", { p_profile_id:personId }),
        ]);
        if(!current)return;
        const [sessions, leave] = results.map((item)=>item.status==="fulfilled" ? item.value : {error:item.reason});
        setTimeRecords({
          scope:personScope,loading:false,
          sessions:sessions.error?[]:sessions.data||[],
          leave:leave.error?[]:leave.data||[],
          sessionError:sessions.error?"Attendance records are not available to this view.":null,
          leaveError:leave.error?"Leave records are not available to this view.":null,
        });
      })();
    }
    return ()=>{current=false;};
  },[personScope,personTab,personId,me.org_id]);
  useEffect(() => {
    let current = true;
    setLoading(true); setError(null); setLoadedScope(""); setDirectory(emptyDirectory);
    (async () => {
      try {
        const [units, people, memberships, teams, employment] = await Promise.all([
          supabase.from("units").select("id,name,code,active", { count: "exact" }).eq("org_id", me.org_id).eq("active", true).order("name"),
          supabase.from("profiles").select("id,full_name,job_title,active", { count: "exact" }).eq("org_id", me.org_id).eq("active", true).order("full_name"),
          supabase.from("unit_memberships").select("unit_id,profile_id,role", { count: "exact" }).eq("org_id", me.org_id),
          supabase.from("sub_teams").select("id,name,unit_id,active", { count: "exact" }).eq("org_id", me.org_id).eq("active", true).order("name"),
          supabase.rpc("executive_personnel_directory", {}, { count: "exact" }),
        ]);
        const next = { units: complete(units, "Departments"), people: complete(people, "People"), memberships: complete(memberships, "Department memberships"), teams: complete(teams, "Teams"), teamMembers: [], employment: complete(employment, "Active employment roster") };
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
    setScheduleRead({scope:personScope,loading:personTab==="employment"&&Boolean(personId),days:[],error:null});
    if(personTab==="employment" && personId){
      supabase.rpc("executive_personnel_schedule",{p_profile_id:personId}).then(({data,error})=>{
        if(!current)return;
        setScheduleRead({scope:personScope,loading:false,days:error?[]:data||[],
          error:error?"This person's current schedule is not available to the Executive view.":null});
      }).catch(()=>{if(current)setScheduleRead({scope:personScope,loading:false,days:[],
        error:"This person's current schedule could not be verified."});});
    }
    return ()=>{current=false;};
  },[personScope,personTab,personId]);
  useEffect(() => {
    let current = true;
    setWork([]); setWorkState({ scope: personScope, loading: showAssignedWork, error: null });
    if (showAssignedWork) (async () => {
      try {
        const result = await supabase.from("work_items").select("id,ref,title,status,due_at,unit_id,project_id", { count: "exact" }).eq("org_id", me.org_id).eq("assignee_id", personId).neq("visibility", "private").order("due_at", { ascending: true, nullsFirst: false });
        const rows = complete(result, "Assigned work");
        if (current) { setWork(rows); setWorkState({ scope: personScope, loading: false, error: null }); }
      } catch (e) { if (current) setWorkState({ scope: personScope, loading: false, error: humanError(e, "Assigned work could not be loaded.") }); }
    })();
    return () => { current = false; };
  }, [showAssignedWork, personId, personScope, me.org_id]);
  useEffect(() => { if (path.length) heading.current?.focus(); }, [path]);

  const ready = loadedScope === scope && !loading && !error;
  const { units, people, memberships, teams, teamMembers, employment } = ready ? directory : emptyDirectory;
  const employedIds = new Set(employment.filter((row) => row.employment_type !== "volunteer").map((row) => row.profile_id));
  const volunteerIds = new Set(employment.filter((row) => row.employment_type === "volunteer").map((row) => row.profile_id));
  const peopleForView = peopleGroup === "staff" ? people.filter((row) => employedIds.has(row.id)) : peopleGroup === "volunteers" ? people.filter((row) => volunteerIds.has(row.id)) : people;
  const unitName = id => units.find(row => row.id === id)?.name || "Department not recorded";
  const membersOf = id => people.filter(person => memberships.some(row => row.unit_id === id && row.profile_id === person.id));
  const headNames = id => people.filter(person => memberships.some(row => row.unit_id === id && row.profile_id === person.id && row.role === "manager")).map(person => person.full_name).join(", ");
  const missingLeaders = units.filter(unit => !headNames(unit.id));
  const department = selected?.kind === "department" ? units.find(row => row.id === selected.id) : null;
  const team = selected?.kind === "team" ? teams.find(row => row.id === selected.id) : null;
  const person = people.find(row => row.id === personId);
  const placements = person ? memberships.filter(row => row.profile_id === person.id && units.some(unit => unit.id === row.unit_id)) : [];
  const employmentRows = employment.filter(row => row.profile_id === personId);
  const currentEmployment = employmentRows[0] || null;
  const actionUnitId = placements.some(row=>row.unit_id===selectedActionUnitId) ? selectedActionUnitId : placements[0]?.unit_id || null;
  const selectedWorkingPattern = currentEmployment?.working_pattern;
  const scheduleText = selectedWorkingPattern?.days?.length
    ? selectedWorkingPattern.days.join(", ").toUpperCase() + (selectedWorkingPattern.start ? " · " + selectedWorkingPattern.start : "") + (selectedWorkingPattern.end ? "–" + selectedWorkingPattern.end : "")
    : selectedWorkingPattern?.kind ? String(selectedWorkingPattern.kind).replaceAll("_"," ") : "Not recorded";
  const employmentLabel = currentEmployment?.employment_type === "volunteer" ? "Volunteer" : currentEmployment ? "Employee" : "Not recorded";
  const enter = (kind, id) => { setExpandedWorkScope(""); setPersonTab("overview"); setPath(current => [...current, { kind, id }].slice(-20)); setQuery(""); };
  const back = () => { setExpandedWorkScope(""); setPath(current => current.slice(0, -1)); setQuery(""); };
  const matches = row => !query.trim() || `${row.name || row.full_name || ""} ${row.job_title || ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const peopleRows = rows => rows.filter(matches).map(row => <DirectoryRow key={row.id} kind="person" title={row.full_name || "Recorded person"} description={row.job_title || "Role not recorded"} onClick={() => enter("person", row.id)} />);
  const list = (label, children) => <section aria-label={label} className="exec-redesign-list">{children.length ? children : <p className="exec-redesign-empty">No {label.toLowerCase()} match this view.</p>}</section>;

  return <div className="body ev2-exec-organisation exec-redesign-page">
    {selected && <button type="button" className="exec-directory-back" onClick={back}><CeacIcon name="arrowLeft" size="row" decorative /> Back to {path.length > 1 ? "previous view" : "Organisation"}</button>}
    <header className="exec-redesign-head"><div>
      <span>{person ? "Person" : team ? unitName(team.unit_id) : department ? "Department" : "Across CEAC"}</span>
      <h1 ref={heading} tabIndex={-1}>{person?.full_name || team?.name || department?.name || "Organisation"}</h1>
      <p>{person ? person.job_title || "Role not recorded" : team ? "People in this team and their recorded responsibilities." : department ? `Head: ${headNames(department.id) || "Not recorded"}` : view === "people" && peopleGroup !== "all" ? `Currently ${peopleGroup === "staff" ? "employed staff" : "active volunteers"} linked to their CEAC employee accounts.` : "Explore departments, teams and people, then open the work behind them."}</p>
    </div>{!selected && ready && <StatusBadge tone={missingLeaders.length ? "warning" : "neutral"} icon={false}>{missingLeaders.length ? `${missingLeaders.length} leadership gap${missingLeaders.length === 1 ? "" : "s"}` : "Department heads recorded"}</StatusBadge>}{department && <button type="button" className="btn" onClick={() => goAssign?.({ unitId: department.id })}>Give out work</button>}</header>
    {!selected && <div className="exec-redesign-tabs" role="group" aria-label="Organisation views">{[["departments", "Departments"], ["teams", "Teams"], ["people", "People"]].map(([key, label]) => <button key={key} type="button" aria-pressed={view === key} className={view === key ? "is-active" : ""} onClick={() => { setView(key); setPeopleGroup("all"); setQuery(""); }}>{label}</button>)}</div>}
    {loading && <LoadingState label="Loading organisation…" />}
    {error && <ProductNotice tone="error" title="Could not load Organisation" action={<button type="button" className="btn btn-ghost" onClick={() => setReload(n => n + 1)}>Try again</button>}>{error}</ProductNotice>}
    {ready && <>
      {!selected && view === "departments" && missingLeaders.length > 0 && <ProductNotice tone="attention" title="Needs attention">{missingLeaders.map(unit => unit.name).join(", ")} {missingLeaders.length === 1 ? "has" : "have"} no active department head recorded.</ProductNotice>}
      {!selected && view === "people" && <div className="exec-redesign-tabs" role="group" aria-label="Filter people by employment">{[["all", "All people"], ["staff", "Employed staff"], ["volunteers", "Volunteers"]].map(([key, label]) => <button type="button" key={key} className={peopleGroup === key ? "is-active" : ""} aria-pressed={peopleGroup === key} onClick={() => { setPeopleGroup(key); setQuery(""); }}>{label}</button>)}</div>}
      {!person && <label className="exec-directory-search">Find {department || team ? "a person or team" : view}<input className="field" type="search" value={query} onChange={e => setQuery(e.target.value)} /></label>}
      {!selected && view === "departments" && <section aria-label="Departments"><Table caption="Departments" rows={units.filter(matches).map(row=>({...row,head:headNames(row.id)||"Head not recorded",people:membersOf(row.id).length}))} empty="No departments match this view." columns={[
        {key:"name",label:"Department"},{key:"head",label:"Head"},
        {key:"people",label:"People"},
        {key:"open",label:"Open",render:row=><button type="button" className="btn btn-ghost btn-sm" aria-label={`Open ${row.name}`} onClick={()=>enter("department",row.id)}>Open</button>}
      ]}/></section>}
      {!selected && view === "teams" && list("Teams", teams.filter(matches).map(row => <DirectoryRow key={row.id} kind="team" title={row.name} description={unitName(row.unit_id)} onClick={() => enter("team", row.id)} />))}
      {!selected && view === "people" && list(peopleGroup === "staff" ? "Employed staff" : peopleGroup === "volunteers" ? "Volunteers" : "People", peopleRows(peopleForView))}
      {department && <><h2>People</h2>{list("People", peopleRows(membersOf(department.id)))}<h2>Teams</h2>{list("Teams", teams.filter(row => row.unit_id === department.id).filter(matches).map(row => <DirectoryRow key={row.id} kind="team" title={row.name} description={unitName(row.unit_id)} onClick={() => enter("team", row.id)} />))}<button type="button" className="btn btn-ghost" onClick={() => openRoom?.({ kind: "unit", unitId: department.id })}>Open department room</button></>}
      {team && list("People", peopleRows(people.filter(row => teamMembers.some(member => member.sub_team_id === team.id && member.profile_id === row.id))))}
      {person && <>
        <div className="exec-redesign-tabs" role="tablist" aria-label={`${person.full_name} employee information`}>
          {[
            ["overview","Profile"],
            ["employment","Employment & schedule"],
            ["time","Attendance & leave"],
            ["work","Contributions"],
          ].map(([key,label])=><button key={key} type="button" role="tab" aria-selected={personTab===key}
            className={personTab===key?"is-active":""} onClick={()=>setPersonTab(key)}>{label}</button>)}
        </div>
        {personTab==="overview" && <section className="exec-directory-profile" aria-label="Employee profile">
          <h2>About this person</h2>
          <p className="screen-note">Employment information is separate from project responsibilities. Select another tab to see their schedule, attendance or recorded work.</p>
          <div className="ev2p-summary">
            <div><strong>{employmentLabel}</strong><span>Engagement</span></div>
            <div><strong>{currentEmployment?.employment_status?.replaceAll("_"," ")||"Not recorded"}</strong><span>Employment status</span></div>
            <div><strong>{placements.length}</strong><span>Department placements</span></div>
          </div>
          <h3>Department placements</h3>
          {list("Departments",placements.map(row => <DirectoryRow key={row.unit_id} kind="department" title={unitName(row.unit_id)}
            description={row.role==="manager"?"Department head":"Department member"} onClick={()=>enter("department",row.unit_id)} />))}
          {placements.length > 0 && <div className="exec-directory-actions">
            <label>Choose department
              <select className="field" aria-label="Employee department for action" value={actionUnitId||""} onChange={e=>setSelectedActionUnitId(e.target.value)}>
                {placements.map(row=><option key={row.unit_id} value={row.unit_id}>{unitName(row.unit_id)}</option>)}
              </select>
            </label>
            <button type="button" className="btn btn-sm" onClick={()=>goAssign?.({unitId:actionUnitId,assigneeId:person.id})}>Assign work</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={()=>openRoom?.({kind:"unit",unitId:actionUnitId,mentionProfileId:person.id})}>Message in department</button>
          </div>}
          <p className="screen-note">Department messages are visible to authorised room members, not a private direct message.</p>
        </section>}
        {personTab==="employment" && <section aria-label="Employment and working schedule">
          <h2>Employment & working arrangement</h2>
          <div className="ev2p-summary">
            <div><strong>{employmentLabel}</strong><span>Engagement</span></div>
            <div><strong>{currentEmployment?.employment_status?.replaceAll("_"," ")||"Not recorded"}</strong><span>Status</span></div>
            <div><strong>{scheduleText}</strong><span>Recorded working pattern</span></div>
          </div>
          <h3>Recorded weekly schedule</h3>
          {scheduleRead.scope!==personScope||scheduleRead.loading ? <LoadingState label="Loading authorised schedule…" />
            : scheduleRead.error ? <ProductNotice tone="attention" title="Schedule unavailable">{scheduleRead.error}</ProductNotice>
            : scheduleRead.days.length ? <div className="exec-redesign-list" aria-label="Seven-day recorded work schedule">
              {scheduleRead.days.map(row=><div className="exec-redesign-list-row" key={row.day_code}>
                <span className="exec-redesign-row-copy">
                  <strong>{row.day_label}</strong>
                  <small>{row.day_type||"Day arrangement not recorded"}{row.expected_start&&row.expected_end?` · ${row.expected_start.slice(0,5)}–${row.expected_end.slice(0,5)}`:""}</small>
                </span>
              </div>)}
            </div> : <p className="screen-note">No current authorised weekly schedule has been recorded for this person. This does not mean they are expected to be absent.</p>}
          <p className="screen-note">Employment and scheduling facts are read-only. Compensation, bank details, identity documents and protected HR records remain private.</p>
          {employmentRows.length > 1 && <p className="screen-note">This person has employment records across {employmentRows.length} placements. Contact HR for formal employment history.</p>}
        </section>}
        {personTab==="time" && <section aria-label="Recorded attendance and leave">
          <h2>Attendance & leave</h2>
          <p className="screen-note">Recent attendance and up to 14 planning-relevant leave requests. Private leave reasons, medical categories and full HR records are not shown.</p>
          {timeRecords.scope!==personScope||timeRecords.loading ? <LoadingState label="Opening authorised time records…" /> : <>
            <h3>Recent work sessions</h3>
            {timeRecords.sessionError ? <ProductNotice tone="attention" title="Attendance unavailable">{timeRecords.sessionError}</ProductNotice>
              : list("Work sessions",timeRecords.sessions.map(row=><div key={row.id} className="exec-redesign-list-row">
                <span className="exec-redesign-row-copy"><strong>{new Date(row.started_at).toLocaleDateString("en-GB",{timeZone:"Africa/Accra",day:"numeric",month:"short",year:"numeric"})}</strong>
                <small>{new Date(row.started_at).toLocaleTimeString("en-GB",{timeZone:"Africa/Accra",hour:"2-digit",minute:"2-digit"})} · {row.ended_at?"Ended":"Still open"} · {row.place||"Work location not recorded"}</small></span>
              </div>))}
            <h3>Leave affecting workforce planning</h3>
            {timeRecords.leaveError ? <ProductNotice tone="attention" title="Leave unavailable">{timeRecords.leaveError}</ProductNotice>
              : list("Leave requests",timeRecords.leave.map(row=><div key={row.id} className="exec-redesign-list-row">
                <span className="exec-redesign-row-copy"><strong>Leave request</strong>
                <small>{row.start_date||"Date not recorded"} – {row.end_date||"Date not recorded"} · {String(row.status||"Recorded").replaceAll("_"," ")}</small></span>
              </div>))}
          </>}
        </section>}
        {personTab==="work" && <section aria-label="Work contributions">
          <h2>Recorded work contributions</h2>
          <p className="screen-note">Shared assignments and their actual work states. Private work and confidential HR records remain separate.</p>
          <button type="button" className="btn btn-ghost btn-sm" aria-expanded={showAssignedWork} aria-controls="directory-assigned-work"
            onClick={()=>setExpandedWorkScope(showAssignedWork?"":personScope)}>{showAssignedWork?"Hide assigned work":"Load assigned work"}</button>
          {showAssignedWork && <div id="directory-assigned-work">
            {workState.scope!==personScope||workState.loading ? <LoadingState label="Loading assigned work…" /> : workState.error
              ? <ProductNotice tone="error" title="Assigned work unavailable">{workState.error}</ProductNotice>
              : list("Assigned work",work.map(row=><DirectoryRow key={row.id} kind="work" title={`${row.ref} · ${row.title}`}
                  description={unitName(row.unit_id)} meta={row.status.replaceAll("_"," ")} onClick={()=>openItem?.(row.id)} />))}
          </div>}
        </section>}
      </>}
    </>}
  </div>;
}
