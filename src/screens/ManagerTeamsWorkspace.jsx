import { useEffect, useRef, useState } from "react";
import { Archive, ArrowDown, ArrowLeft, ArrowUp, ChevronRight, ClipboardList, MessageCircle, Plus, Search, Users } from "lucide-react";
import { Avatar, LoadingState, ProductNotice, Sheet } from "../components/bits";
import { supabase } from "../lib/supabase";
import { dueLabel, isWorkOverdue } from "../lib/time";
import "./manager-teams.css";

const CLOSED = new Set(["completed", "self_certified", "cancelled"]);
const STATUS = {
  assigned: "Assigned", not_started: "Not started", in_progress: "In progress",
  waiting_on: "Waiting on someone", waiting: "Waiting", blocked: "Blocked",
  in_review: "In review", returned: "Changes requested", completed: "Completed",
  self_certified: "Completed", cancelled: "Cancelled",
};
const ARCHIVED = "archived";
const PEOPLE = "people";

async function readRows(makeQuery) {
  const rows = [];
  const pageSize = 500;
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await makeQuery().range(start, start + pageSize - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

function WorkRow({ item, onOpen }) {
  const overdue = isWorkOverdue(item);
  return <button type="button" className="mt-work-row" onClick={() => onOpen(item.id)}>
    <span className="mt-row-icon"><ClipboardList size={17} aria-hidden="true" /></span>
    <span className="mt-row-main">
      <strong>{item.title}</strong>
      <small>{[item.ref, item.owner?.full_name || (item.assignee_id ? "Owner unavailable" : "No owner"), item.due_at && dueLabel(item.due_at, item.status)].filter(Boolean).join(" · ")}</small>
    </span>
    <span className={overdue ? "mt-work-status is-overdue" : "mt-work-status"}>{overdue ? "Past due" : STATUS[item.status] || "Status unavailable"}</span>
    <ChevronRight size={16} className="mt-chevron" aria-hidden="true" />
  </button>;
}

function EmptyTeamSection({ icon: Icon, title, children }) {
  return <div className="mt-empty">
    <span className="mt-row-icon"><Icon size={19} aria-hidden="true" /></span>
    <div><strong>{title}</strong>{children && <p>{children}</p>}</div>
  </div>;
}

export default function ManagerTeamsWorkspace({ me, canManage, selection, onSelect, openPerson, openItem, goAssign, openRoom, renderPeople }) {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [filter, setFilter] = useState("");
  const [chosen, setChosen] = useState([]);
  const [name, setName] = useState("");
  const [lead, setLead] = useState("");
  const [workTab, setWorkTab] = useState("open");
  const detailHeading = useRef(null);
  const listHeading = useRef(null);

  useEffect(() => {
    if (!me.unit_id) return;
    let current = true;
    async function load() {
      setError("");
      try {
        const [teams, roster, work] = await Promise.all([
          readRows(() => supabase.from("sub_teams")
            .select("id,name,code,position,active,lead_id,profiles!sub_teams_lead_fk(full_name)")
            .eq("unit_id", me.unit_id).eq("org_id", me.org_id).order("position").order("id")),
          readRows(() => supabase.from("unit_memberships")
            .select("profile_id,role,profiles!unit_memberships_profile_id_fkey!inner(id,full_name,job_title,active)")
            .eq("unit_id", me.unit_id).eq("org_id", me.org_id).eq("profiles.active", true).order("profile_id")),
          readRows(() => supabase.from("work_items")
            .select("id,ref,title,status,due_at,assignee_id,sub_team_id,owner:profiles!work_items_assignee_id_fkey(full_name)")
            .eq("unit_id", me.unit_id).eq("org_id", me.org_id).neq("visibility", "private")
            .not("sub_team_id", "is", null).order("due_at", { nullsFirst: false }).order("id")),
        ]);
        const memberships = teams.length ? await readRows(() => supabase.from("sub_team_members")
          .select("sub_team_id,profile_id,sub_teams!inner(unit_id,org_id)")
          .eq("sub_teams.unit_id", me.unit_id).eq("sub_teams.org_id", me.org_id)
          .order("sub_team_id").order("profile_id")) : [];
        if (current) setSnapshot({
          teams: teams.map(team => ({ ...team, members: memberships.filter(row => row.sub_team_id === team.id).map(row => row.profile_id) })),
          people: roster.sort((a, b) => a.profiles.full_name.localeCompare(b.profiles.full_name)),
          work,
        });
      } catch {
        if (current) setError("Teams couldn’t be loaded. Try again to see your unit’s teams.");
      }
    }
    load();
    return () => { current = false; };
  }, [me.unit_id, me.org_id, attempt]);

  const active = snapshot?.teams.filter(team => team.active) || [];
  const archived = snapshot?.teams.filter(team => !team.active) || [];
  const team = snapshot?.teams.find(entry => entry.id === selection) || (!selection ? active[0] : null);
  const teamPeople = team ? snapshot.people.filter(person => team.members.includes(person.profile_id)) : [];
  const teamWork = team ? snapshot.work.filter(item => item.sub_team_id === team.id) : [];
  const openWork = teamWork.filter(item => !CLOSED.has(item.status));
  const closedWork = teamWork.filter(item => CLOSED.has(item.status));
  const candidates = team ? snapshot.people.filter(person => !team.members.includes(person.profile_id)) : [];
  const visibleCandidates = candidates.filter(person => person.profiles.full_name.toLowerCase().includes(filter.trim().toLowerCase()));

  function select(id) {
    onSelect(id);
    setWorkTab("open");
    setNotice("");
    requestAnimationFrame(() => (id ? detailHeading : listHeading).current?.focus());
  }

  function start(type, person = null) {
    setName(type === "rename" ? team.name : "");
    setLead(team?.lead_id || "");
    setFilter("");
    setChosen([]);
    setSaveError("");
    setDialog({ type, person });
  }

  async function save(action, args, confirmation) {
    setBusy(true);
    setError("");
    setSaveError("");
    try {
      const { data, error: failure } = await supabase.rpc("manage_unit_team", {
        p_unit_id: me.unit_id, p_action: action, p_team_id: team?.id || null, ...args,
      });
      if (failure) throw failure;
      if (!data?.id) throw new Error("The save could not be confirmed. Try again.");
      setSnapshot(previous => {
        const previousTeam = previous.teams.find(entry => entry.id === data.id);
        const teams = previous.teams.filter(entry => entry.id !== data.id)
          .map(entry => action === "reorder" && entry.id === args.p_other_team_id ? { ...entry, position: previousTeam.position } : entry);
        const leadProfile = previous.people.find(person => person.profile_id === data.lead_id)?.profiles;
        teams.push({ ...data, profiles: leadProfile || (data.lead_id === previousTeam?.lead_id ? previousTeam?.profiles : null) });
        teams.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
        return { ...previous, teams };
      });
      onSelect(action === "archive" ? ARCHIVED : data.id);
      setDialog(null);
      setNotice(confirmation(data));
      if (["create", "archive", "restore"].includes(action)) requestAnimationFrame(() => detailHeading.current?.focus());
    } catch (failure) {
      const message = failure.code === "PGRST202" ? "Team changes are temporarily unavailable. Please try again shortly."
        : failure.message || "The change could not be saved. Try again.";
      if (dialog) setSaveError(message);
      else setError(message);
    } finally {
      setBusy(false);
    }
  }

  function saveName(event) {
    event.preventDefault();
    const create = dialog.type === "create";
    save(dialog.type, { p_name: name },
      data => create ? `${data.name} created.` : `Team renamed to ${data.name}.`);
  }

  const personName = dialog?.person?.profiles.full_name;
  const remainingWork = dialog?.type === "remove_member" ? openWork.filter(item => item.assignee_id === dialog.person.profile_id) : [];
  const dialogTitle = {
    create: "New team", rename: "Rename team", add_members: "Add people",
    set_lead: "Choose team lead", remove_member: `Remove ${personName || "member"}?`,
    archive: `Archive ${team?.name || "team"}?`,
  }[dialog?.type];

  return <div className="body ev2-people-page ev2-people-manager mt-page">
    <header className="mt-header">
      <div><p>{me.unit_name || "Your unit"}</p><h1>Team</h1></div>
      {canManage && snapshot && <button className="mt-button mt-primary" onClick={() => start("create")}><Plus size={18} aria-hidden="true" /> New team</button>}
    </header>
    {!me.unit_id && <EmptyTeamSection icon={Users} title="No unit selected">Select a unit to see its teams.</EmptyTeamSection>}
    {error && <ProductNotice tone="error" title={error} action={<button className="mt-button" onClick={() => setAttempt(value => value + 1)}>Try again</button>} />}
    {me.unit_id && !snapshot && !error && <LoadingState label="Loading teams…" />}
    {snapshot && <div className={selection ? "mt-split has-selection" : "mt-split"}>
      <nav className="mt-sidebar" aria-label="Unit teams">
        <h2 tabIndex={-1} ref={listHeading}>Teams <span>{active.length}</span></h2>
        {active.map(entry => {
          const count = snapshot.people.filter(person => entry.members.includes(person.profile_id)).length;
          return <button key={entry.id} type="button" aria-current={team?.id === entry.id ? "true" : undefined}
            className="mt-team-link" onClick={() => select(entry.id)}>
            <span className="mt-row-icon"><Users size={17} aria-hidden="true" /></span>
            <span className="mt-row-main"><strong>{entry.name}</strong><small>{count} {count === 1 ? "member" : "members"}</small></span>
            <ChevronRight size={15} className="mt-chevron" aria-hidden="true" />
          </button>;
        })}
        {!active.length && <p className="mt-sidebar-empty">No active teams</p>}
        <div className="mt-sidebar-tools">
          <button type="button" className="mt-team-link" aria-current={selection === PEOPLE ? "true" : undefined} onClick={() => select(PEOPLE)}>
            <Users size={17} aria-hidden="true" /><span className="mt-row-main">Unit people</span><ChevronRight size={15} className="mt-chevron" aria-hidden="true" />
          </button>
          {openRoom && <button type="button" aria-label="Open room · Unit Room" className="mt-team-link" onClick={openRoom}>
            <MessageCircle size={17} aria-hidden="true" /><span className="mt-row-main">Unit Room</span><ChevronRight size={15} className="mt-chevron" aria-hidden="true" />
          </button>}
          {archived.length > 0 && <button type="button" className="mt-team-link" aria-current={selection === ARCHIVED || team?.active === false ? "true" : undefined} onClick={() => select(ARCHIVED)}>
            <Archive size={17} aria-hidden="true" /><span className="mt-row-main">Archived teams</span><ChevronRight size={15} className="mt-chevron" aria-hidden="true" />
          </button>}
        </div>
      </nav>
      <section className="mt-detail" aria-label={team?.name || (selection === PEOPLE ? "Unit people" : "Team details")}>
        <button type="button" className="mt-back" onClick={() => select(team?.active === false ? ARCHIVED : null)}><ArrowLeft size={18} aria-hidden="true" />{team?.active === false ? "Archived teams" : "Teams"}</button>
        {notice && <p className="mt-feedback" role="status">{notice}</p>}
        {selection === PEOPLE ? <>
          <h2 className="mt-title" ref={detailHeading} tabIndex={-1}>Unit people</h2>
          {renderPeople()}
        </> : selection === ARCHIVED ? <>
          <h2 className="mt-title" ref={detailHeading} tabIndex={-1}>Archived teams</h2>
          <div className="mt-rows">{archived.map(entry => <button key={entry.id} type="button" className="mt-team-link" onClick={() => select(entry.id)}>
            <span className="mt-row-icon"><Archive size={17} aria-hidden="true" /></span><span className="mt-row-main">{entry.name}</span><ChevronRight size={16} className="mt-chevron" aria-hidden="true" />
          </button>)}</div>
        </> : team ? <>
          <div className="mt-detail-head">
            <div>
              <h2 className="mt-title" ref={detailHeading} tabIndex={-1}>{team.name}</h2>
              <p>{team.active ? (team.profiles?.full_name ? `Led by ${team.profiles.full_name}` : "No team lead") : "Archived team"}</p>
            </div>
            {canManage && (team.active
              ? <div className="mt-detail-actions">
                {teamPeople.length > 0 && <button type="button" className="mt-button mt-primary" onClick={() => goAssign({ subTeamId: team.id })}>Assign work</button>}
                <button type="button" className={teamPeople.length ? "mt-button" : "mt-button mt-primary"} onClick={() => start("add_members")}><Plus size={17} aria-hidden="true" /> Add people</button>
              </div>
              : <button type="button" className="mt-button mt-primary" disabled={busy} onClick={() => save("restore", {}, data => `${data.name} restored.`)}>Restore team</button>)}
          </div>
          <section className="mt-section" aria-labelledby="mt-members-title">
            <div className="mt-section-head">
              <h3 id="mt-members-title">Members <span>{teamPeople.length}</span></h3>
              {canManage && team.active && (teamPeople.length > 0 || team.lead_id) && <button type="button" className="mt-text-button" onClick={() => start("set_lead")}>{team.lead_id ? "Change lead" : "Choose lead"}</button>}
            </div>
            {teamPeople.length ? <div className="mt-rows">{teamPeople.map(person => <div className="mt-member-row" key={person.profile_id}>
              {person.profile_id === me.id ? <div className="mt-person">
                <Avatar name={person.profiles.full_name} /><span className="mt-row-main"><strong>{person.profiles.full_name}</strong><small>{team.lead_id === person.profile_id ? "Team lead · You" : "You"}</small></span>
              </div> : <button type="button" className="mt-person" onClick={() => openPerson(person.profile_id, "current")}>
                <Avatar name={person.profiles.full_name} /><span className="mt-row-main"><strong>{person.profiles.full_name}</strong><small>{team.lead_id === person.profile_id ? "Team lead" : person.profiles.job_title || "Member"}</small></span>
                <ChevronRight size={16} className="mt-chevron" aria-hidden="true" />
              </button>}
              {canManage && team.active && <button type="button" className="mt-text-button" aria-label={`Remove ${person.profiles.full_name} from ${team.name}`} onClick={() => start("remove_member", person)}>Remove</button>}
            </div>)}</div> : <EmptyTeamSection icon={Users} title="No members yet">{canManage && team.active && "Add someone from your unit to start assigning work from this team."}</EmptyTeamSection>}
          </section>
          <section className="mt-section" aria-labelledby="mt-work-title">
            <div className="mt-section-head">
              <h3 id="mt-work-title">Work <span>{teamWork.length}</span></h3>
              {closedWork.length > 0 && <div className="mt-segments" role="group" aria-label="Work filter">
                <button type="button" aria-pressed={workTab === "open"} onClick={() => setWorkTab("open")}>Open {openWork.length}</button>
                <button type="button" aria-pressed={workTab === "closed"} onClick={() => setWorkTab("closed")}>Closed {closedWork.length}</button>
              </div>}
            </div>
            {teamWork.length ? <div className="mt-rows">{(workTab === "closed" ? closedWork : openWork)
              .map(item => <WorkRow key={item.id} item={item} onOpen={openItem} />)}
              {workTab === "open" && !openWork.length && <EmptyTeamSection icon={ClipboardList} title="No open work">See Closed for this team’s work history.</EmptyTeamSection>}
            </div> : <EmptyTeamSection icon={ClipboardList} title="No work linked to this team yet" />}
          </section>
          {canManage && team.active && <details className="mt-settings">
            <summary>Team settings</summary>
            <div>
              <button type="button" className="mt-button" onClick={() => start("rename")}>Rename team</button>
              {[-1, 1].map(direction => {
                const other = active[active.findIndex(entry => entry.id === team.id) + direction];
                const Icon = direction < 0 ? ArrowUp : ArrowDown;
                return <button type="button" key={direction} className="mt-button" disabled={busy || !other} onClick={() => save("reorder", { p_other_team_id: other.id }, data => `${data.name} moved.`)}>
                  <Icon size={16} aria-hidden="true" /> {direction < 0 ? "Move up" : "Move down"}
                </button>;
              })}
              <button type="button" className="mt-text-button mt-danger" onClick={() => start("archive")}>Archive team</button>
            </div>
          </details>}
        </> : <>
          <h2 className="mt-title" ref={detailHeading} tabIndex={-1}>Your teams</h2>
          <EmptyTeamSection icon={Users} title="No team selected">{canManage ? "Create a team to bring its people and work together." : "Teams in this unit will appear here."}</EmptyTeamSection>
        </>}
      </section>
    </div>}
    {dialog && <Sheet className="mt-sheet" ariaLabel={dialogTitle} dismissDisabled={busy} onClose={() => setDialog(null)}>
      <h2>{dialogTitle}</h2>
      {dialog.type === "add_members" && <p>Choose people from {me.unit_name || "this unit"} to add to {team.name}.</p>}
      {saveError && <p className="mt-save-error" role="alert">{saveError}</p>}
      {["create", "rename"].includes(dialog.type) && <form onSubmit={saveName}>
        <label className="mt-field">Team name<input className="field" value={name} onChange={event => setName(event.target.value)} maxLength={100} required /></label>
        <button className="mt-button mt-primary mt-sheet-action" disabled={busy || !name.trim()}>{busy ? "Saving…" : dialog.type === "create" ? "Create team" : "Save name"}</button>
      </form>}
      {dialog.type === "add_members" && <>
        {candidates.length > 0 && <label className="mt-search"><Search size={18} aria-hidden="true" /><input type="search" aria-label="Search unit people" placeholder="Search by name" value={filter} onChange={event => setFilter(event.target.value)} /></label>}
        <div className="mt-picker">
          {visibleCandidates.map(person => <label key={person.profile_id}>
            <Avatar name={person.profiles.full_name} />
            <span className="mt-row-main">{person.profiles.full_name}{person.profile_id === me.id ? " (you)" : ""}
              {person.profiles.job_title && <small>{person.profiles.job_title}</small>}</span>
            <input type="checkbox" checked={chosen.includes(person.profile_id)} disabled={busy}
              onChange={event => setChosen(current => event.target.checked ? [...current, person.profile_id] : current.filter(id => id !== person.profile_id))} />
          </label>)}
          {!visibleCandidates.length && <p>{candidates.length ? "No people match your search." : "Everyone available in this unit is already on this team."}</p>}
        </div>
        {candidates.length > 0 && <button className="mt-button mt-primary mt-sheet-action" disabled={busy || !chosen.length}
          onClick={() => save("add_members", { p_member_ids: chosen }, data => data.changed === 1 && chosen.length === 1
            ? `${candidates.find(person => chosen.includes(person.profile_id))?.profiles.full_name || "One person"} added to ${data.name}.`
            : data.changed ? `${data.changed} people added to ${data.name}.` : `The selected people are already on ${data.name}.`)}>
          {busy ? "Adding…" : chosen.length ? `Add ${chosen.length} ${chosen.length === 1 ? "person" : "people"}` : "Add people"}
        </button>}
      </>}
      {dialog.type === "set_lead" && <form onSubmit={event => {
        event.preventDefault();
        save("set_lead", { p_lead_id: lead || null }, data => data.lead_id ? `${teamPeople.find(person => person.profile_id === data.lead_id).profiles.full_name} is now the lead for ${data.name}.` : `Team lead cleared for ${data.name}.`);
      }}>
        <label className="mt-field">Team lead<select className="field" value={lead} onChange={event => setLead(event.target.value)}><option value="">No team lead</option>
          {teamPeople.map(person => <option key={person.profile_id} value={person.profile_id}>{person.profiles.full_name}</option>)}
        </select></label>
        <button className="mt-button mt-primary mt-sheet-action" disabled={busy || lead === (team.lead_id || "")}>{busy ? "Saving…" : "Save lead"}</button>
      </form>}
      {dialog.type === "remove_member" && <>
        <p>{personName} will leave {team.name}. {team.lead_id === dialog.person.profile_id && "The team lead will also be cleared."}</p>
        {remainingWork.length > 0 && <><p>These open items will stay assigned to {personName}. Open an item to review its handover.</p>
          <div className="mt-picker">{remainingWork.map(item => <WorkRow key={item.id} item={item} onOpen={openItem} />)}</div></>}
        <button className="mt-button mt-danger mt-sheet-action" disabled={busy} onClick={() => save("remove_member", { p_member_ids: [dialog.person.profile_id] }, data => `${personName} removed from ${data.name}.`)}>{busy ? "Removing…" : "Remove from team"}</button>
      </>}
      {dialog.type === "archive" && <>
        <p>The team moves to Archived teams. Its members and linked work stay with it, and you can restore it later.</p>
        <button className="mt-button mt-danger mt-sheet-action" disabled={busy} onClick={() => save("archive", {}, data => `${data.name} archived.`)}>{busy ? "Archiving…" : "Archive team"}</button>
      </>}
    </Sheet>}
  </div>;
}
