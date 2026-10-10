import { useEffect, useState } from "react";
import { supabase, inviteByEmail } from "../lib/supabase";
import { authRedirect } from "../lib/authRedirect";
import { isOverdue } from "../lib/time";
import { LoadingState, ProductNotice, Sheet } from "../components/bits";
import {
  PeopleEmpty,
  PeopleEvidencePerson,
  PeoplePageHeader,
  PeoplePersonRow,
  PeopleRoomCard,
  PeopleSection,
} from "../experience-v2/people-family/PeopleFamilyV2";

function weekStart() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  return value;
}

function dayKey(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function requireResult(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data || [];
}

function PersonRow({ person, openPerson, laneNames = [] }) {
  const name = person.profiles?.full_name || "—";
  const currentSummary = person.current.length
    ? `Currently: ${person.current.slice(0, 2).map((item) => item.title).join(" · ")}${person.current.length > 2 ? ` · ${person.current.length - 2} more` : ""}`
    : laneNames.length
      ? `Part of ${laneNames.join(" · ")}`
      : null;
  return <PeopleEvidencePerson
    name={name}
    subtitle={person.employment_type === "volunteer" ? "Volunteer" : (person.profiles?.job_title || person.role)}
    context={currentSummary}
    status={person.presence}
    statusTone={person.presence === "Present" ? "success" : person.presence === "On leave" ? "warning" : "neutral"}
    onOpen={() => openPerson(person.profile_id, "current")}
    facts={[
      { label: person.presenceDays === 1 ? "recorded day" : "recorded days", value: person.presenceDays, onClick: () => openPerson(person.profile_id, "sessions") },
      { label: "completed outcomes", value: person.completed, onClick: () => openPerson(person.profile_id, "completed") },
      { label: "overdue", value: person.overdue, onClick: () => openPerson(person.profile_id, "overdue") },
      { label: "awaiting review", value: person.awaiting, onClick: () => openPerson(person.profile_id, "review") },
      { label: "submitted", value: person.submitted, onClick: () => openPerson(person.profile_id, "submitted") },
    ]}
  />;
}

export default function Team({ me, openPerson, goAssign, openRoom }) {
  const [people, setPeople] = useState([]);
  const [subTeams, setSubTeams] = useState([]);
  const [members, setMembers] = useState({});
  const [pending, setPending] = useState([]);
  const [resources, setResources] = useState([]);
  const [showSetup, setShowSetup] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [peopleView, setPeopleView] = useState("all");
  const [volunteerPattern, setVolunteerPattern] = useState("no_attendance");
  const [volunteerDays, setVolunteerDays] = useState(["sat"]);
  const [volunteerStart, setVolunteerStart] = useState("");
  const [volunteerEnd, setVolunteerEnd] = useState("");
  const [editName, setEditName] = useState("");
  const [moveWorkTo, setMoveWorkTo] = useState("");
  const [removeWorkCount, setRemoveWorkCount] = useState(0);
  const [resourceForm, setResourceForm] = useState({ id: null, title: "", category: "reference", reference_url: "", description: "", pinned: false, sort_order: 0 });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, [me.id, me.unit_id]);

  async function load() {
    if (!me.unit_id) {
      setPeople([]);
      setSubTeams([]);
      setMembers({});
      setPending([]);
      setResources([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const start = weekStart();
      const today = dayKey();
      const [membershipResult, employmentResult, subTeamResult, workResult, sessionResult,
        submissionResult, leaveResult, pendingResult, resourceResult] = await Promise.all([
        supabase.from("unit_memberships")
          .select("id, role, profile_id, profiles!unit_memberships_profile_id_fkey(id, full_name, email, job_title)")
          .eq("unit_id", me.unit_id),
        supabase.from("employment_records")
          .select("profile_id,employment_type,working_pattern,manager_profile_id")
          .eq("unit_id", me.unit_id).eq("employment_status", "active"),
        supabase.from("sub_teams")
          .select("id, name, code, position, lead_id, profiles!sub_teams_lead_fk(full_name)")
          .eq("unit_id", me.unit_id).eq("active", true).order("position"),
        supabase.from("work_items")
          .select("id, ref, title, kind, assignee_id, status, due_at, completed_at")
          .eq("unit_id", me.unit_id).neq("visibility", "private"),
        supabase.from("work_sessions").select("id, profile_id, started_at")
          .gte("started_at", start.toISOString()),
        supabase.from("submissions").select("id, profile_id, submitted_at, work_items!inner(unit_id)")
          .eq("work_items.unit_id", me.unit_id).gte("submitted_at", start.toISOString()),
        supabase.from("leave_requests").select("profile_id, start_date, end_date, status")
          .eq("status", "approved").lte("start_date", today).gte("end_date", today),
        supabase.from("pending_invitations").select("email, full_name, invited_at, engagement_type, engagement_working_pattern")
          .eq("unit_id", me.unit_id).is("resolved_at", null),
        supabase.from("unit_resources").select("*").eq("unit_id", me.unit_id)
          .order("active", { ascending: false }).order("pinned", { ascending: false }).order("sort_order").order("title"),
      ]);

      const memberships = requireResult(membershipResult, "Team members");
      const employment = requireResult(employmentResult, "Engagement records");
      const employmentByProfile = new Map(employment.map((row) => [row.profile_id, row]));
      const staff = memberships.filter((membership) => membership.profile_id !== me.id);
      const staffIds = new Set(staff.map((membership) => membership.profile_id));
      const work = requireResult(workResult, "Team work").filter((item) => staffIds.has(item.assignee_id));
      const sessions = requireResult(sessionResult, "Team attendance").filter((session) => staffIds.has(session.profile_id));
      const submissions = requireResult(submissionResult, "Team submissions").filter((submission) => staffIds.has(submission.profile_id));
      const leaveIds = new Set(requireResult(leaveResult, "Team leave").filter((request) => staffIds.has(request.profile_id)).map((request) => request.profile_id));

      setPeople(staff.map((membership) => {
        const personWork = work.filter((item) => item.assignee_id === membership.profile_id);
        const personSessions = sessions.filter((session) => session.profile_id === membership.profile_id);
        const presenceDays = new Set(personSessions.map((session) => dayKey(new Date(session.started_at)))).size;
        const submitted = submissions.filter((submission) => submission.profile_id === membership.profile_id).length;
        const current = personWork.filter((item) => !["completed", "self_certified", "cancelled"].includes(item.status));
        const engagement = employmentByProfile.get(membership.profile_id) || {};
        const patternKind = engagement.working_pattern?.kind || "not_recorded";
        const volunteerContext = engagement.employment_type === "volunteer"
          ? patternKind === "no_attendance"
            ? "No attendance tracking"
            : patternKind === "event_based"
              ? "Event-based"
              : null
          : null;
        return {
          ...membership,
          employment_type: engagement.employment_type || "not_recorded",
          working_pattern: engagement.working_pattern || { kind: "not_recorded" },
          manager_profile_id: engagement.manager_profile_id || null,
          presence: volunteerContext || (leaveIds.has(membership.profile_id) ? "On leave" : personSessions.some((session) => dayKey(new Date(session.started_at)) === today) ? "Present" : "Not started"),
          presenceDays,
          submitted,
          completed: personWork.filter((item) => ["task", "deliverable"].includes(item.kind) && ["completed", "self_certified"].includes(item.status) && item.completed_at && new Date(item.completed_at) >= start).length,
          overdue: current.filter((item) => isOverdue(item.due_at) && item.status !== "waiting_on").length,
          awaiting: current.filter((item) => item.status === "in_review").length,
          current,
        };
      }));

      const teams = requireResult(subTeamResult, "Parts of the team");
      setSubTeams(teams);
      if (teams.length) {
        const memberResult = await supabase.from("sub_team_members")
          .select("sub_team_id, profile_id").in("sub_team_id", teams.map((team) => team.id));
        const map = {};
        requireResult(memberResult, "Team assignments").forEach((row) => {
          if (!map[row.profile_id]) map[row.profile_id] = [];
          map[row.profile_id].push(row.sub_team_id);
        });
        setMembers(map);
      } else setMembers({});
      setPending(requireResult(pendingResult, "Pending invitations"));
      setResources(requireResult(resourceResult, "Unit resources"));
    } catch (err) { setError(err.message || "The team could not be loaded."); }
    finally { setLoading(false); }
  }

  async function addSubTeam() {
    setBusy(true); setMsg(null);
    try {
      const { error: insertError } = await supabase.from("sub_teams").insert({
        org_id: me.org_id, unit_id: me.unit_id, name: name.trim(),
        code: (code.trim() || name.trim().slice(0, 3)).toUpperCase(), position: subTeams.length + 1,
      });
      if (insertError) throw insertError;
      setSheet(null); setName(""); setCode(""); await load();
    } catch (err) { setMsg(err.message || "That part of the team could not be added."); }
    finally { setBusy(false); }
  }

  async function renameSubTeam(team) {
    if (!editName.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const { error: updateError } = await supabase.from("sub_teams")
        .update({ name: editName.trim() }).eq("id", team.id).eq("unit_id", me.unit_id);
      if (updateError) throw updateError;
      setSheet(null); setEditName(""); await load();
    } catch (err) { setMsg(err.message || "That part could not be renamed."); }
    finally { setBusy(false); }
  }

  async function moveSubTeam(team, direction) {
    const index = subTeams.findIndex((row) => row.id === team.id);
    const other = subTeams[index + direction];
    if (!other) return;
    setError(null);
    const result = await supabase.rpc("swap_sub_team_positions", {
      p_first_id: team.id,
      p_second_id: other.id,
    });
    if (result.error) { setError(result.error.message); return; }
    await load();
  }

  async function openRemoveSubTeam(team) {
    setMsg(null); setMoveWorkTo("");
    const result = await supabase.from("work_items").select("id", { count: "exact", head: true }).eq("sub_team_id", team.id);
    if (result.error) { setError(result.error.message); return; }
    setRemoveWorkCount(result.count || 0);
    setSheet({ type: "remove-subteam", team });
  }

  async function removeSubTeam(team) {
    setBusy(true); setMsg(null);
    try {
      if (removeWorkCount > 0) {
        const { error: workError } = await supabase.from("work_items")
          .update({ sub_team_id: moveWorkTo || null })
          .eq("sub_team_id", team.id);
        if (workError) throw new Error(`Work could not be moved: ${workError.message}`);
      }
      const { error: deleteError } = await supabase.from("sub_teams").delete().eq("id", team.id).eq("unit_id", me.unit_id);
      if (deleteError) throw deleteError;
      setSheet(null); setMoveWorkTo(""); setRemoveWorkCount(0); await load();
    } catch (err) { setMsg(err.message || "That part could not be removed."); }
    finally { setBusy(false); }
  }

  async function invite() {
    setBusy(true); setMsg(null);
    try {
      await inviteByEmail({ orgId: me.org_id, invitedBy: me.id, email, fullName, unitId: me.unit_id, role: "staff" });
      setMsg("Staff invitation sent. They appear here once they activate.");
      setEmail(""); setFullName(""); await load();
    } catch (err) { setMsg(err.message || "The invitation could not be sent."); }
    finally { setBusy(false); }
  }

  async function inviteVolunteer() {
    setBusy(true); setMsg(null);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = fullName.trim();
      const pattern = {
        kind: volunteerPattern,
        ...(volunteerPattern === "specific_days" || volunteerPattern === "custom"
          ? { days: volunteerDays, start: volunteerStart || null, end: volunteerEnd || null }
          : {}),
      };

      const { error: inviteError } = await supabase.rpc("create_pending_invitation", {
        p_email: cleanEmail,
        p_full_name: cleanName,
        p_unit_id: me.unit_id,
        p_role: "staff",
      });
      if (inviteError) throw inviteError;

      const { data: classified, error: classifyError } = await supabase.from("pending_invitations")
        .update({ engagement_type: "volunteer", engagement_working_pattern: pattern })
        .eq("org_id", me.org_id)
        .eq("unit_id", me.unit_id)
        .eq("email", cleanEmail)
        .is("resolved_at", null)
        .select("id")
        .single();
      if (classifyError || !classified?.id) throw classifyError || new Error("Volunteer engagement could not be recorded.");

      const { error: authError } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: { shouldCreateUser: true, emailRedirectTo: authRedirect("/activate") },
      });
      if (authError) throw authError;

      setMsg("Volunteer invitation sent. Their account will still activate as Staff; volunteer is their engagement type.");
      setEmail(""); setFullName(""); setVolunteerPattern("no_attendance"); setVolunteerDays(["sat"]);
      setVolunteerStart(""); setVolunteerEnd("");
      await load();
    } catch (err) { setMsg(err.message || "The volunteer invitation could not be sent."); }
    finally { setBusy(false); }
  }

  function openResource(resource = null) {
    setMsg(null);
    setResourceForm(resource ? {
      id: resource.id, title: resource.title, category: resource.category,
      reference_url: resource.reference_url, description: resource.description || "",
      pinned: resource.pinned, sort_order: resource.sort_order,
    } : { id: null, title: "", category: "reference", reference_url: "", description: "", pinned: false, sort_order: resources.length });
    setSheet("resource");
  }

  async function saveResource() {
    setBusy(true); setMsg(null);
    try {
      const { error: saveError } = await supabase.rpc("save_unit_resource", {
        p_resource_id: resourceForm.id, p_unit_id: me.unit_id, p_title: resourceForm.title.trim(),
        p_category: resourceForm.category, p_reference_url: resourceForm.reference_url.trim(),
        p_description: resourceForm.description.trim() || null, p_visibility: "unit",
        p_pinned: resourceForm.pinned, p_sort_order: Number(resourceForm.sort_order) || 0,
      });
      if (saveError) throw saveError;
      setSheet(null); await load();
    } catch (err) { setMsg(err.message || "That resource could not be saved."); }
    finally { setBusy(false); }
  }

  async function setResourceActive(resource, active) {
    setError(null);
    const { error: updateError } = await supabase.rpc("set_unit_resource_active", { p_resource_id: resource.id, p_active: active });
    if (updateError) { setError(updateError.message); return; }
    await load();
  }

  const visiblePeople = people.filter((person) =>
    peopleView === "all" ? true : peopleView === "volunteers" ? person.employment_type === "volunteer" : person.employment_type !== "volunteer"
  );
  const volunteerCount = people.filter((person) => person.employment_type === "volunteer").length;
  const staffCount = people.length - volunteerCount;

  const groupedPeople = subTeams.map((team) => ({
    ...team,
    people: people.filter((person) => (members[person.profile_id] || []).includes(team.id)),
  }));
  const unassignedPeople = people.filter((person) => !(members[person.profile_id] || []).length);

  return (
    <div className="body manager-team ev2-people-page ev2-people-manager">
      <PeoplePageHeader
        eyebrow={me.unit_name || "Your unit"}
        title="People & volunteers"
        description="One team workspace for Staff and volunteers. Volunteer is an engagement type, not a new CEAC role or authority level."
        count={people.length + 1}
        countLabel={people.length ? "people including you" : "person"}
      />

      {openRoom && <PeopleRoomCard
        title="Unit Room"
        description="Coordinate with the unit without leaving CEAC OS."
        onClick={openRoom}
      />}

      <section className="phase6-manager-people-toolbar" aria-label="People and volunteer controls">
        <div className="phase6-manager-people-tabs" role="tablist" aria-label="People type">
          {[
            ["all", `All ${people.length}`],
            ["staff", `Staff ${staffCount}`],
            ["volunteers", `Volunteers ${volunteerCount}`],
          ].map(([value,label]) => <button
            key={value}
            type="button"
            role="tab"
            aria-selected={peopleView === value}
            className={peopleView === value ? "is-selected" : ""}
            onClick={() => setPeopleView(value)}
          >{label}</button>)}
        </div>
        <button className="btn phase6-add-volunteer" onClick={() => { setSheet("volunteer"); setMsg(null); }}>
          + Add volunteer
        </button>
      </section>

      {error && <ProductNotice tone="error" title="Could not complete that">{error}</ProductNotice>}
      {loading && <LoadingState label="Loading your team…" />}

      {!loading && !me.unit_id && <PeopleEmpty
        title="No unit context"
        description="Manager Team requires an authorised unit membership."
      />}

      {!loading && me.unit_id && <>
        <div className="ev2p-stack">
          <PeopleSection
            title="People & volunteers"
            meta={`${visiblePeople.length + (peopleView === "volunteers" ? 0 : 1)} shown`}
            description="Open a person for unit-scoped work, activity and visible feedback context."
          >
            <PeoplePersonRow
              name={me.full_name || "—"}
              subtitle="Unit head"
              context="Your own work remains under My work."
              status="You"
              statusTone="neutral"
            />
            {visiblePeople.map((person) => {
              const laneNames = subTeams
                .filter((team) => (members[person.profile_id] || []).includes(team.id))
                .map((team) => team.name);
              return <PersonRow
                key={person.id}
                person={person}
                openPerson={openPerson}
                laneNames={laneNames}
              />;
            })}
            {visiblePeople.length === 0 && <PeopleEmpty
              title={peopleView === "volunteers" ? "No volunteers in this unit yet" : peopleView === "staff" ? "No other Staff in this unit yet" : "No other people yet"}
              description="Invited or authorised unit members will appear here. Your own work remains under My work."
            />}
          </PeopleSection>

          <PeopleSection
            title="Work lanes"
            meta={`${subTeams.length} ${subTeams.length === 1 ? "part" : "parts"}`}
            description="Current unit work lanes. This does not change official employment or role authority."
          >
            {groupedPeople.map((team) => <div key={team.id} className="ev2p-manager-resource-row">
              <strong>{team.name}</strong>
              <span>
                {team.code} · {team.people.length} {team.people.length === 1 ? "person" : "people"}
                {team.profiles?.full_name ? ` · led by ${team.profiles.full_name}` : " · no lead yet"}
              </span>
              {goAssign && <div className="ev2p-manager-setup-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => goAssign({ subTeamId: team.id })}>Assign work to this part</button>
              </div>}
            </div>)}
            {unassignedPeople.length > 0 && <div className="ev2p-manager-resource-row">
              <strong>Not assigned to a part yet</strong>
              <span>{unassignedPeople.length} {unassignedPeople.length === 1 ? "person" : "people"} · unit membership remains unchanged</span>
            </div>}
            {subTeams.length === 0 && <PeopleEmpty
              title="No work lanes set up"
              description="Empty parts are allowed. Use Team setup only if this unit needs work lanes."
            />}
          </PeopleSection>
        </div>

        <section className="ev2p-manager-setup">
          <div className="ev2p-manager-setup-head">
            <div>
              <h2>Team setup</h2>
              <p>Invitations, work-lane structure and unit resources are secondary administration. Official role and membership changes remain with Administration & HR; leave decisions remain on Home.</p>
            </div>
            <button className="btn btn-ghost wide-auto" onClick={() => setShowSetup((value) => !value)}>
              {showSetup ? "Hide team setup" : "Open team setup"}
            </button>
          </div>

          {showSetup && <>
            <div className="ev2p-manager-setup-grid">
              <PeopleSection title="People and invitations" meta={String(people.length + pending.length)}>
                {people.map((person) => {
                  const laneNames = subTeams
                    .filter((team) => (members[person.profile_id] || []).includes(team.id))
                    .map((team) => team.name);
                  return <div key={person.id} className="ev2p-manager-resource-row">
                    <strong>{person.profiles?.full_name || "—"}</strong>
                    <span>{person.employment_type === "volunteer" ? "Volunteer" : person.role === "manager" ? "Unit head" : person.role === "sub_team_lead" ? "Team lead" : "Staff"}</span>
                    <small>{laneNames.length ? laneNames.join(" · ") : "Not assigned to a part yet"}</small>
                  </div>;
                })}
                {pending.map((person) => <div key={person.email} className="ev2p-manager-resource-row">
                  <strong>{person.full_name || person.email}</strong>
                  <span>{person.engagement_type === "volunteer" ? "Volunteer invitation" : "Staff invitation"} — waiting for activation</span>
                </div>)}
                <div className="ev2p-manager-setup-actions">
                  <button className="btn btn-ghost wide-auto" onClick={() => { setSheet("invite"); setMsg(null); }}>Add Staff</button>
                  <button className="btn btn-ghost wide-auto" onClick={() => { setSheet("volunteer"); setMsg(null); }}>Add volunteer</button>
                </div>
              </PeopleSection>

              <PeopleSection title="Parts of the team" meta={String(subTeams.length)}>
                {subTeams.map((team, index) => <div key={team.id} className="ev2p-manager-resource-row">
                  <strong>{team.name}</strong>
                  <span>{team.code} · {Object.values(members).filter((value) => value.includes(team.id)).length} people{team.profiles?.full_name ? ` · led by ${team.profiles.full_name}` : " · no lead yet"}</span>
                  <div className="ev2p-manager-setup-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditName(team.name); setMsg(null); setSheet({ type: "rename-subteam", team }); }}>Rename</button>
                    <button className="btn btn-ghost btn-sm" disabled={index === 0} onClick={() => moveSubTeam(team, -1)}>Move up</button>
                    <button className="btn btn-ghost btn-sm" disabled={index === subTeams.length - 1} onClick={() => moveSubTeam(team, 1)}>Move down</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => openRemoveSubTeam(team)}>Remove</button>
                  </div>
                </div>)}
                {subTeams.length === 0 && <PeopleEmpty title="No parts have been set up" description="Empty parts are allowed." />}
                <div className="ev2p-manager-setup-actions">
                  <button className="btn btn-ghost wide-auto" onClick={() => { setSheet("subteam"); setMsg(null); }}>Add a part</button>
                </div>
              </PeopleSection>
            </div>

            <PeopleSection
              title="Unit resources"
              meta={`${resources.filter((resource) => resource.active).length} active`}
              description="Approved links and references for this unit. Files remain in their authorised source."
            >
              {resources.map((resource) => <div key={resource.id} className="ev2p-manager-resource-row">
                <strong>{resource.pinned ? "Pinned · " : ""}{resource.title}</strong>
                <span>{resource.category.replace("_", " ")} · {resource.active ? "Active" : "Archived"}</span>
                <small>{resource.reference_url}</small>
                <div className="ev2p-manager-setup-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => openResource(resource)}>Edit</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setResourceActive(resource, !resource.active)}>{resource.active ? "Archive" : "Restore"}</button>
                </div>
              </div>)}
              {resources.length === 0 && <PeopleEmpty title="No unit resources" description="Add an approved guide, template or shared link when needed." />}
              <div className="ev2p-manager-setup-actions">
                <button className="btn btn-ghost wide-auto" onClick={() => openResource()}>Add a resource</button>
              </div>
            </PeopleSection>
          </>}
        </section>

      {sheet === "subteam" && <Sheet onClose={() => setSheet(null)}>
        <div className="h2">Add a part of the team</div>
        <p className="screen-note">It can exist before anybody is placed in it.</p>
        <input className="field" placeholder="What it is called" value={name} onChange={(event) => setName(event.target.value)} />
        <input className="field" placeholder="Short code, e.g. GFX" value={code} onChange={(event) => setCode(event.target.value)} maxLength={4} />
        {msg && <div className="flag flag-brick" style={{ marginTop: 12 }}>{msg}</div>}
        <button className="btn" style={{ marginTop: 14 }} onClick={addSubTeam} disabled={busy || !name.trim()}>{busy ? "Saving..." : "Add it"}</button>
      </Sheet>}
      {sheet?.type === "rename-subteam" && <Sheet onClose={() => !busy && setSheet(null)}>
        <div className="h2">Rename this part</div>
        <p className="screen-note">Existing work references stay unchanged. New work will use the same short code unless you set up a different part.</p>
        <input className="field" value={editName} onChange={(event) => setEditName(event.target.value)} />
        {msg && <div className="flag flag-brick" style={{ marginTop: 12 }}>{msg}</div>}
        <button className="btn" style={{ marginTop: 14 }} disabled={busy || !editName.trim()} onClick={() => renameSubTeam(sheet.team)}>{busy ? "Saving..." : "Rename"}</button>
      </Sheet>}
      {sheet?.type === "remove-subteam" && <Sheet onClose={() => !busy && setSheet(null)}>
        <div className="h2">Remove {sheet.team.name}?</div>
        <p className="screen-note">{removeWorkCount > 0 ? `${removeWorkCount} work item${removeWorkCount === 1 ? "" : "s"} currently sit in this part. Choose where that work should go before removing it.` : "No work is currently attached to this part."}</p>
        {removeWorkCount > 0 && <select className="field" value={moveWorkTo} onChange={(event) => setMoveWorkTo(event.target.value)}>
          <option value="">General unit work — no part</option>
          {subTeams.filter((team) => team.id !== sheet.team.id).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select>}
        <div className="hint">Removing the part does not delete its work. Existing work references are kept.</div>
        {msg && <div className="flag flag-brick" style={{ marginTop: 12 }}>{msg}</div>}
        <button className="btn" style={{ marginTop: 14 }} disabled={busy} onClick={() => removeSubTeam(sheet.team)}>{busy ? "Moving work..." : "Move work and remove part"}</button>
      </Sheet>}
      {sheet === "invite" && <Sheet onClose={() => { setSheet(null); setMsg(null); }}>
        <div className="h2">Add Staff</div>
        <p className="screen-note">This creates a Staff invitation for the current unit. Formal authority remains separate.</p>
        <input className="field" placeholder="Their full name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
        <input className="field" placeholder="Their work email" type="email" autoCapitalize="none" value={email} onChange={(event) => setEmail(event.target.value)} />
        {msg && <div className="flag flag-amber" style={{ marginTop: 12 }}>{msg}</div>}
        <button className="btn" style={{ marginTop: 14 }} onClick={invite} disabled={busy || !email.trim() || !fullName.trim()}>{busy ? "Sending..." : "Send Staff invitation"}</button>
      </Sheet>}
      {sheet === "volunteer" && <Sheet onClose={() => { if (!busy) { setSheet(null); setMsg(null); } }}>
        <div className="phase6-volunteer-sheet">
          <div>
            <span className="eyebrow">People & volunteers</span>
            <div className="h2">Add volunteer</div>
            <p className="screen-note">Volunteers use the Staff experience. This invitation does not grant Unit Head, HR, Compliance, Administration or Executive authority.</p>
          </div>

          <div className="phase6-volunteer-identity-grid">
            <label>
              <span>Full name</span>
              <input className="field" aria-label="Volunteer full name" placeholder="Full name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </label>
            <label>
              <span>Email</span>
              <input className="field" aria-label="Volunteer email" placeholder="name@example.com" type="email" autoCapitalize="none" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>
              <span>Team / Unit</span>
              <input className="field" aria-label="Volunteer unit" value={me.unit_name || "Current unit"} disabled />
            </label>
          </div>

          <fieldset className="phase6-working-pattern">
            <legend>Working pattern</legend>
            <p>Choose what attendance expectation actually applies. No configured obligation means CEAC will not infer employee-style absence or lateness.</p>
            {[
              ["no_attendance","No attendance tracking","Use work, meetings and outcomes without attendance expectations."],
              ["event_based","Event-based","Attendance applies only to explicitly assigned events or ministry activities."],
              ["specific_days","Specific days","Use selected recurring days with optional start/end times."],
              ["custom","Custom schedule","Use a custom recurring arrangement for this volunteer."],
            ].map(([value,title,description]) => <label key={value} className={volunteerPattern === value ? "phase6-pattern-choice is-selected" : "phase6-pattern-choice"}>
              <input type="radio" name="volunteer-pattern" value={value} checked={volunteerPattern === value} onChange={() => setVolunteerPattern(value)} />
              <span><strong>{title}</strong><small>{description}</small></span>
            </label>)}
          </fieldset>

          {(volunteerPattern === "specific_days" || volunteerPattern === "custom") && <div className="phase6-pattern-detail">
            <span className="field-label">Days</span>
            <div className="phase6-day-pills">
              {[["mon","Mon"],["tue","Tue"],["wed","Wed"],["thu","Thu"],["fri","Fri"],["sat","Sat"],["sun","Sun"]].map(([key,label]) => <label key={key}>
                <input type="checkbox" checked={volunteerDays.includes(key)} onChange={(event) => setVolunteerDays((days) => event.target.checked ? [...new Set([...days,key])] : days.filter((day) => day !== key))} />
                <span>{label}</span>
              </label>)}
            </div>
            <div className="phase6-time-grid">
              <label><span>Start</span><input className="field" type="time" aria-label="Volunteer start time" value={volunteerStart} onChange={(event) => setVolunteerStart(event.target.value)} /></label>
              <label><span>End</span><input className="field" type="time" aria-label="Volunteer end time" value={volunteerEnd} onChange={(event) => setVolunteerEnd(event.target.value)} /></label>
            </div>
          </div>}

          {msg && <div className="flag flag-amber">{msg}</div>}
          <div className="phase6-volunteer-actions">
            <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => setSheet(null)}>Cancel</button>
            <button className="btn" type="button" onClick={inviteVolunteer}
              disabled={busy || !email.trim() || !fullName.trim() || ((volunteerPattern === "specific_days" || volunteerPattern === "custom") && volunteerDays.length === 0)}>
              {busy ? "Sending…" : "Send volunteer invitation"}
            </button>
          </div>
        </div>
      </Sheet>}
      {sheet === "resource" && <Sheet onClose={() => !busy && setSheet(null)}>
        <div className="h2">{resourceForm.id ? "Edit unit resource" : "Add unit resource"}</div>
        <p className="screen-note">Use a secure link to an approved guide, template or shared document.</p>
        <label className="field-label">Title</label>
        <input className="field" value={resourceForm.title} onChange={(event) => setResourceForm((value) => ({ ...value, title: event.target.value }))} />
        <label className="field-label">Category</label>
        <select className="field" value={resourceForm.category} onChange={(event) => setResourceForm((value) => ({ ...value, category: event.target.value }))}>
          <option value="reference">Reference</option><option value="guide">Operating guide</option>
          <option value="template">Approved template</option><option value="run_sheet">Run sheet</option>
          <option value="brand">Brand resource</option><option value="other">Other</option>
        </select>
        <label className="field-label">Secure link</label>
        <input className="field" type="url" placeholder="https://" value={resourceForm.reference_url} onChange={(event) => setResourceForm((value) => ({ ...value, reference_url: event.target.value }))} />
        <label className="field-label">Description (optional)</label>
        <textarea className="field" rows="3" value={resourceForm.description} onChange={(event) => setResourceForm((value) => ({ ...value, description: event.target.value }))} />
        <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
          <input type="checkbox" checked={resourceForm.pinned} onChange={(event) => setResourceForm((value) => ({ ...value, pinned: event.target.checked }))} /> Pin for the unit
        </label>
        {msg && <div className="flag flag-brick" style={{ marginTop: 12 }}>{msg}</div>}
        <button className="btn" style={{ marginTop: 14 }} onClick={saveResource} disabled={busy || !resourceForm.title.trim() || !resourceForm.reference_url.trim()}>{busy ? "Saving..." : "Save resource"}</button>
      </Sheet>}
      </>}
    </div>
  );
}
