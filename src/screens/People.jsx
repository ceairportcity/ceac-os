import { useEffect, useState } from "react";
import "../final-product/fpg7-people-workforce.css";
import { supabase } from "../lib/supabase";
import { dateOnly, dueLabel } from "../lib/time";
import { statusPill, ProductNotice, LoadingState, FieldGroup, EmptyState, Avatar, ProgressMeter, Sheet } from "../components/bits";
import { humanError } from "../lib/productLanguage";
import {
  PeopleAdminPersonRow,
  PeopleBackButton,
  PeopleEmpty,
  PeopleEvidenceSummary,
  PeopleFactRow,
  PeoplePageHeader,
  PeoplePersonHeader,
  PeopleSection,
  PeopleWorkspaceSection,
} from "../experience-v2/people-family/PeopleFamilyV2";

const FILTERS = [["all","Everyone"],["active","Active"],["on_leave","On leave"],["quiet","No submissions in 14 days"],["no_unit","No unit"]];
const EMPLOYMENT_CHANGES = [
  ["employment_details_changed","Employment details changed"],
  ["transferred","Transfer"],
  ["promoted","Promotion / title change"],
  ["manager_changed","Manager changed"],
  ["role_changed","Role changed"],
  ["working_pattern_changed","Working pattern changed"],
  ["status_changed","Status changed"],
  ["exit_recorded","Exit recorded"],
  ["correction","Correction"],
];

function employmentChangeLabel(value) {
  return EMPLOYMENT_CHANGES.find(([key]) => key === value)?.[1]
    || (value === "joined" ? "Joined" : value === "baseline_import" ? "Baseline record" : value);
}

function avgStartLabel(minutes) {
  if (minutes == null || Number.isNaN(Number(minutes))) return "—";
  const value = Number(minutes);
  return String(Math.floor(value / 60)).padStart(2, "0") + ":" + String(value % 60).padStart(2, "0");
}

function protectedMoney(minor, currency = "GHS") {
  if (minor == null) return "Not recorded";
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    maximumFractionDigits: 2,
  }).format(Number(minor) / 100);
}

function amountToMinor(value) {
  const number = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

export default function People({ me, openItem, initialEmployeeId = null, onInitialHandled }) {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [leavePolicy, setLeavePolicy] = useState(null);
  const [units, setUnits] = useState([]);
  const [person, setPerson] = useState(null);
  const [employmentEditor, setEmploymentEditor] = useState(false);
  const [employmentForm, setEmploymentForm] = useState(null);
  const [savingEmployment, setSavingEmployment] = useState(false);
  const [protectedHr, setProtectedHr] = useState(null);
  const [protectedHrLoading, setProtectedHrLoading] = useState(false);
  const [protectedEditor, setProtectedEditor] = useState(null);
  const [savingProtected, setSavingProtected] = useState(false);
  const [drill, setDrill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);

  const canManageProtectedHr = (me.capabilities || []).includes("hr_private.access");

  useEffect(() => { load(); }, [me.id]);
  useEffect(() => {
    if (!initialEmployeeId || !rows.length || person) return;
    const match = rows.find((row) => row.id === initialEmployeeId || row.profile_id === initialEmployeeId);
    if (!match) return;
    openPerson(match);
    onInitialHandled?.();
  }, [initialEmployeeId, rows, person]);

  async function load() {
    setLoading(true);
    setError(null);
    const [rosterResult, peopleResult, leaveResult, unitsResult] = await Promise.all([
      supabase.rpc("admin_employee_roster_summary"),
      supabase.rpc("admin_people_summary"),
      supabase.from("leave_settings").select("annual_days,sick_days,max_carryover,updated_by,updated_at").eq("org_id", me.org_id).maybeSingle(),
      supabase.from("units").select("id,name").eq("org_id", me.org_id).eq("active", true).order("name"),
    ]);
    if (rosterResult.error || peopleResult.error) {
      setError(humanError(rosterResult.error || peopleResult.error, "The People record could not load."));
      setLoading(false);
      return;
    }
    if (leaveResult.error) {
      setError(humanError(leaveResult.error, "Leave policy status could not load."));
      setLoading(false);
      return;
    }
    if (unitsResult.error) {
      setError(humanError(unitsResult.error, "Organisation units could not load."));
      setLoading(false);
      return;
    }
    const operationalByProfile = new Map((Array.isArray(peopleResult.data) ? peopleResult.data : []).map((entry) => [entry.id, entry]));
    const rosterRows = (Array.isArray(rosterResult.data) ? rosterResult.data : []).map((employee) => {
      const operational = employee.profile_id ? operationalByProfile.get(employee.profile_id) : null;
      const rosterUnits = Array.isArray(employee.units) ? employee.units : [];
      const primaryUnit = rosterUnits.find((unit) => unit.is_primary) || rosterUnits[0] || null;
      return {
        ...(operational || {}),
        id: employee.id,
        employee_id: employee.id,
        profile_id: employee.profile_id || null,
        full_name: employee.full_name,
        preferred_name: employee.preferred_name || null,
        source_display_name: employee.source_display_name || null,
        source_department_text: employee.source_department_text || null,
        source_position: employee.source_position || null,
        job_title: employee.job_title || operational?.job_title || null,
        employment_type: employee.employment_type || "not_recorded",
        employment_status: employee.employment_status || "active",
        identity_state: employee.identity_state,
        responsibility_context: Array.isArray(employee.responsibility_context) ? employee.responsibility_context : [],
        review_note: employee.review_note || null,
        roster_units: rosterUnits,
        email: employee.account_email || operational?.email || null,
        account_active: employee.account_active ?? operational?.active ?? false,
        active: employee.employment_status === "active",
        unit_id: operational?.unit_id || primaryUnit?.unit_id || null,
        unit_name: operational?.unit_name || primaryUnit?.unit_name || null,
        role: operational?.role || null,
        is_admin: employee.is_admin || operational?.is_admin || false,
        is_exec: employee.is_exec || operational?.is_exec || false,
        on_leave_now: operational?.on_leave_now || false,
        quiet: operational?.quiet || false,
        done_count: operational?.done_count || 0,
        assigned_done_count: operational?.assigned_done_count || 0,
        self_done_count: operational?.self_done_count || 0,
        on_time_count: operational?.on_time_count || 0,
        first_time_count: operational?.first_time_count || 0,
        open_count: operational?.open_count || 0,
        days_this_month: operational?.days_this_month || 0,
        avg_start_minutes: operational?.avg_start_minutes ?? null,
        annual_taken: operational?.annual_taken || 0,
        sick_taken: operational?.sick_taken || 0,
        carryover_from_last_year: operational?.carryover_from_last_year || 0,
        started_on: operational?.started_on || null,
        contract_type: operational?.contract_type || employee.employment_type || "not_recorded",
        birthday: operational?.birthday || null,
        phone: operational?.phone || null,
      };
    });
    setRows(rosterRows);
    setLeavePolicy(leaveResult.data?.updated_by ? leaveResult.data : null);
    setUnits(unitsResult.data || []);
    setLoading(false);
  }

  async function openPerson(summary) {
    setDetailLoading(true);
    setError(null);
    setDrill(null);

    const rosterDetailResult = await supabase.rpc("admin_employee_roster_detail", { p_employee_id: summary.id });
    if (rosterDetailResult.error) {
      setDetailLoading(false);
      setError(humanError(rosterDetailResult.error, "That employee record could not load."));
      return;
    }

    let detailResult = { data: { work: [], sessions: [], leave: [] }, error: null };
    let employmentResult = { data: { current: null, history: [] }, error: null };
    let protectedResult = { data: null, error: null };

    const linkedRequests = summary.profile_id
      ? Promise.all([
          supabase.rpc("admin_person_detail", { p_profile_id: summary.profile_id }),
          supabase.rpc("admin_employment_detail", { p_profile_id: summary.profile_id }),
        ])
      : Promise.resolve([{ data: { work: [], sessions: [], leave: [] }, error: null }, { data: { current: null, history: [] }, error: null }]);

    setProtectedHrLoading(canManageProtectedHr);
    const [linkedResults, protectedResponse] = await Promise.all([
      linkedRequests,
      canManageProtectedHr
        ? supabase.rpc("hr_employee_protected_summary", { p_employee_id: summary.id })
        : Promise.resolve({ data: null, error: null }),
    ]);

    [detailResult, employmentResult] = linkedResults;
    protectedResult = protectedResponse;
    setProtectedHrLoading(false);
    setDetailLoading(false);

    if (detailResult.error || employmentResult.error || protectedResult.error) {
      setError(humanError(detailResult.error || employmentResult.error || protectedResult.error, "That employee record could not load."));
      return;
    }

    setProtectedHr(protectedResult.data || null);

    const data = detailResult.data;
    const work = Array.isArray(data?.work) ? data.work.map((item) => ({
      ...item,
      projects: item.project_name ? { name: item.project_name } : null,
    })) : [];
    const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
    const leave = Array.isArray(data?.leave) ? data.leave : [];
    const done = work.filter((item) => ["completed","self_certified"].includes(item.status));
    const rosterDetail = rosterDetailResult.data || {};
    const rosterEmployee = rosterDetail.employee || {};
    const rosterUnits = Array.isArray(rosterDetail.units) ? rosterDetail.units : summary.roster_units || [];

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    setProtectedEditor(null);
    setPerson({
      ...summary,
      ...rosterEmployee,
      id: summary.id,
      employee_id: summary.id,
      profile_id: summary.profile_id || rosterEmployee.profile_id || null,
      roster_units: rosterUnits,
      email: rosterEmployee.account_email || summary.email || null,
      phone: rosterEmployee.account_phone || summary.phone || null,
      operational_data_available: Boolean(rosterDetail.operational_data_available),
      items: work,
      done,
      assigned: done.filter((item) => item.origin === "assigned"),
      self: done.filter((item) => item.origin === "self_created"),
      onTime: done.filter((item) => item.due_at && item.completed_at && new Date(item.completed_at) <= new Date(item.due_at)),
      openWork: work.filter((item) => !["completed","self_certified","cancelled"].includes(item.status)),
      sessions,
      leave,
      employment: employmentResult.data || { current: null, history: [] },
      balance: {
        annual_taken: summary.annual_taken || 0,
        sick_taken: summary.sick_taken || 0,
        carryover_from_last_year: summary.carryover_from_last_year || 0,
      },
    });
  }

  async function saveProtectedRecord(form) {
    if (!person?.employee_id) return;
    setSavingProtected(true);
    setError(null);
    const { error: saveError } = await supabase.rpc("hr_employee_protected_record", {
      p_employee_id: person.employee_id,
      p_record_type: form.recordType,
      p_payload: form.payload,
      p_replaces_id: null,
      p_reason: form.reason,
    });
    if (saveError) {
      setSavingProtected(false);
      setError(humanError(saveError, "Protected HR data could not be recorded."));
      return;
    }

    const { data, error: refreshError } = await supabase.rpc("hr_employee_protected_summary", {
      p_employee_id: person.employee_id,
    });
    setSavingProtected(false);
    if (refreshError) {
      setError(humanError(refreshError, "Protected HR data was recorded but could not be refreshed."));
      return;
    }
    setProtectedHr(data || null);
    setProtectedEditor(null);
  }

  function openEmploymentEditor() {
    if (!person) return;
    const current = person.employment?.current || {};
    setEmploymentForm({
      changeType: "employment_details_changed",
      effectiveOn: new Date().toISOString().slice(0, 10),
      employmentType: current.employment_type || person.contract_type || "not_recorded",
      jobTitle: current.job_title ?? person.job_title ?? "",
      unitId: current.unit_id || person.unit_id || "",
      managerId: current.manager_profile_id || "",
      role: current.membership_role || person.role || "staff",
      workingPattern: current.working_pattern?.kind || "not_recorded",
      status: current.employment_status || (person.active ? "active" : "inactive"),
      joinedOn: current.joined_on || person.started_on || "",
      exitedOn: current.exited_on || "",
      reason: "",
      correctionOf: "",
    });
    setEmploymentEditor(true);
  }

  async function saveEmployment() {
    if (!person || !employmentForm) return;
    setSavingEmployment(true);
    setError(null);
    const { data, error: saveError } = await supabase.rpc("admin_update_employment", {
      p_profile_id: person.profile_id,
      p_employment_type: employmentForm.employmentType,
      p_job_title: employmentForm.jobTitle || null,
      p_unit_id: employmentForm.unitId || null,
      p_manager_profile_id: employmentForm.managerId || null,
      p_membership_role: employmentForm.role,
      p_working_pattern: { kind: employmentForm.workingPattern || "not_recorded" },
      p_employment_status: employmentForm.status,
      p_joined_on: employmentForm.joinedOn || null,
      p_exited_on: employmentForm.status === "exited" ? (employmentForm.exitedOn || null) : null,
      p_change_type: employmentForm.changeType,
      p_effective_on: employmentForm.effectiveOn,
      p_reason: employmentForm.reason || null,
      p_correction_of: employmentForm.changeType === "correction" ? (employmentForm.correctionOf || null) : null,
    });
    setSavingEmployment(false);
    if (saveError) {
      setError(humanError(saveError, "The employment change could not be recorded."));
      return;
    }
    const current = data?.current || {};
    setPerson((value) => ({
      ...value,
      employment: data,
      unit_id: current.unit_id,
      unit_name: current.unit_name,
      role: current.membership_role,
      job_title: current.job_title,
      contract_type: current.employment_type,
      started_on: current.joined_on,
      active: current.employment_status === "active",
    }));
    setEmploymentEditor(false);
    setEmploymentForm(null);
    load();
  }

  if (loading) return <div className="body"><LoadingState label="Loading People…" /></div>;

  if (person && drill) {
    return <div className="body ev2-people-page ev2-person-workspace ev2-admin-person-workspace">
      <PeopleBackButton onClick={() => setDrill(null)} label={person.full_name} />
      <PeoplePersonHeader
        name={drill.label}
        eyebrow="Employee record"
        subtitle={person.full_name}
        context="Factual employee evidence only."
      />
      <PeopleWorkspaceSection
        title={drill.label}
        description="Authorised factual records connected to this employee."
        meta={`${drill.rows.length} recorded`}
      >
        {drill.rows.length === 0 && <PeopleEmpty title="Nothing recorded here yet" description="There is no authorised record in this group." />}
        {drill.kind === "work" && drill.rows.map((item) => <button key={item.id} className="ev2p-link-row" onClick={() => openItem(item.id)}>
          <span className="ev2p-link-row-main">
            <strong>{item.title}</strong>
            <span>{item.ref} · {item.completed_at ? "finished " + dateOnly(item.completed_at) : dueLabel(item.due_at)}{item.projects ? " · " + item.projects.name : ""}</span>
          </span>
          <span className="ev2p-link-row-tail">{statusPill(item.status)}</span>
        </button>)}
        {drill.kind === "sessions" && drill.rows.map((session) => <PeopleFactRow
          key={session.id}
          icon="time"
          title={new Date(session.started_at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
          subtitle={`Started ${new Date(session.started_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}${session.ended_at ? " · ended " + new Date(session.ended_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : " · still open"}${session.place === "office" ? " · at the office" : " · elsewhere"}`}
        />)}
        {drill.kind === "leave" && drill.rows.map((request) => <PeopleFactRow
          key={request.id}
          icon="calendar"
          title={`${request.days} day${request.days === 1 ? "" : "s"} ${request.kind}`}
          subtitle={`${dateOnly(request.start_date)} — ${dateOnly(request.end_date)}`}
          meta={request.status}
        />)}
      </PeopleWorkspaceSection>
    </div>;
  }

  if (person) {
    const hasLinkedProfile = Boolean(person.profile_id);
    const employmentCurrent = person.employment?.current || null;
    const employmentHistory = Array.isArray(person.employment?.history) ? person.employment.history : [];
    const taken = Number(person.balance?.annual_taken || 0);
    const entitlement = leavePolicy ? Number(leavePolicy.annual_days || 0) + Number(person.balance?.carryover_from_last_year || 0) : null;
    const employmentState = (employmentCurrent?.employment_status || person.employment_status || (person.active ? "active" : "inactive")).replaceAll("_", " ");
    const rosterUnitNames = (person.roster_units || []).map((unit) => unit.unit_name).filter(Boolean);
    const positionLabel = hasLinkedProfile
      ? (person.is_exec ? "Group Pastor" : person.is_admin ? "Administration & HR" : person.role === "manager" ? "Unit head" : person.role === "sub_team_lead" ? "Team lead" : "Staff")
      : (person.source_position || "Roster employee");
    const identityLabel = person.identity_state === "needs_review"
      ? "Identity review required"
      : hasLinkedProfile ? "Account linked" : "Roster only · no account linked";

    return <div className="body ev2-people-page ev2-person-workspace ev2-admin-person-workspace">
      <PeopleBackButton onClick={() => { setPerson(null); setDrill(null); }} label="All people" ariaLabel="← All people" />

      <div className="ev2p-admin-person-layout">
        <aside className="ev2p-admin-person-rail" aria-label="Employee context">
      <PeoplePersonHeader
        name={person.full_name}
        eyebrow={`${employmentCurrent?.unit_name || person.unit_name || "No unit"} · ${positionLabel}`}
        subtitle={employmentCurrent?.job_title || person.job_title || "No job title recorded"}
        context={[
          person.email || identityLabel,
          person.phone,
          person.source_department_text,
          `Employment ${employmentState}`,
        ].filter(Boolean).join(" · ")}
      />

      {error && <ProductNotice tone="error" title="Employee record">{error}</ProductNotice>}
      {person.on_leave_now && <ProductNotice tone="attention" title="On approved leave">This employee is currently away on approved leave.</ProductNotice>}
      {!person.active && <ProductNotice tone="error" title="Inactive employee">This employee is marked inactive and cannot sign in.</ProductNotice>}

      <PeopleWorkspaceSection
        title="Identity & employment state"
        description="Authorised identity context for this employee record."
        className="ev2p-admin-identity-section"
      >
        <div className="ev2p-admin-record-grid">
          <PeopleFactRow icon="people" title="Account" subtitle={person.email || identityLabel} />
          {person.phone && <PeopleFactRow icon="info" title="Phone" subtitle={person.phone} />}
          <PeopleFactRow icon="people" title={hasLinkedProfile ? "Authority context" : "Source position"} subtitle={positionLabel} />
          <PeopleFactRow icon="info" title="Employee status" subtitle={person.active ? "Active" : "Inactive"} />
          <PeopleFactRow icon="info" title="Identity state" subtitle={identityLabel} />
          {!hasLinkedProfile && person.source_department_text && <PeopleFactRow icon="people" title="Source department" subtitle={person.source_department_text} />}
          {!hasLinkedProfile && rosterUnitNames.length > 0 && <PeopleFactRow icon="people" title="Recorded units" subtitle={rosterUnitNames.join(" · ")} />}
          {!hasLinkedProfile && person.responsibility_context?.length > 0 && <PeopleFactRow icon="work" title="Programme / responsibility context" subtitle={person.responsibility_context.join(" · ")} />}
          {person.birthday && <PeopleFactRow icon="calendar" title="Birthday" subtitle={new Date(person.birthday).toLocaleDateString("en-GB", { day: "numeric", month: "long" })} />}
        </div>
      </PeopleWorkspaceSection>
        </aside>

        <div className="ev2p-admin-person-detail">
      <PeopleWorkspaceSection
        title="Employment record"
        description="The current authorised employment record. Recording a change creates a new historical snapshot rather than overwriting the past."
        meta={hasLinkedProfile ? <button type="button" className="ev2p-admin-record-change" onClick={openEmploymentEditor}>Record change</button> : "Roster context"}
      >
        <div className="ev2p-admin-record-grid">
          <PeopleFactRow icon="people" title="Employment type" subtitle={employmentCurrent?.employment_type || person.employment_type || person.contract_type || "Not recorded"} />
          <PeopleFactRow icon="work" title={hasLinkedProfile ? "Title" : "Source position"} subtitle={employmentCurrent?.job_title || person.job_title || person.source_position || "Not recorded"} />
          <PeopleFactRow icon="people" title={hasLinkedProfile ? "Primary unit" : "Recorded units"} subtitle={employmentCurrent?.unit_name || (rosterUnitNames.length ? rosterUnitNames.join(" · ") : "Not recorded")} />
          <PeopleFactRow icon="people" title="Manager" subtitle={hasLinkedProfile ? (employmentCurrent?.manager_name || "Not recorded") : "Not recorded · no authority inferred"} />
          <PeopleFactRow icon="people" title="Role / authority" subtitle={hasLinkedProfile ? (employmentCurrent?.membership_role || person.role || "staff").replaceAll("_", " ") : "Not inferred from workbook title"} />
          <PeopleFactRow icon="calendar" title="Working pattern" subtitle={hasLinkedProfile ? (employmentCurrent?.working_pattern?.kind || "not recorded").replaceAll("_", " ") : "Not recorded"} />
          <PeopleFactRow icon="calendar" title="Joined" subtitle={employmentCurrent?.joined_on ? dateOnly(employmentCurrent.joined_on) : "Not recorded"} />
          <PeopleFactRow icon="info" title="Employment status" subtitle={employmentState} />
          {employmentCurrent?.exited_on && <PeopleFactRow icon="calendar" title="Exit date" subtitle={dateOnly(employmentCurrent.exited_on)} />}
        </div>
      </PeopleWorkspaceSection>

      <PeopleWorkspaceSection
        title="Employment history"
        description={hasLinkedProfile ? "Audited employment snapshots in effective-date order." : "A roster-only employee has no linked account employment history yet."}
        meta={hasLinkedProfile ? `${employmentHistory.length} recorded` : "Not linked"}
      >
        {!hasLinkedProfile
          ? <PeopleEmpty title="No linked employment history" description="The employee remains fully represented in the roster. Account and employment-history linking can happen later without recreating this employee." />
          : employmentHistory.length === 0
            ? <PeopleEmpty title="No employment history yet" description="Employment changes recorded here will preserve their effective date, reason and audit context." />
            : <div className="ev2p-admin-history-list">{employmentHistory.slice(0, 12).map((event) => <article className="ev2p-admin-history-row" key={event.id}>
                <div>
                  <strong>{employmentChangeLabel(event.change_type)}</strong>
                  <span>
                    Effective {dateOnly(event.effective_on)}
                    {event.job_title ? " · " + event.job_title : ""}
                    {event.unit_name ? " · " + event.unit_name : ""}
                  </span>
                  {event.reason && <small>{event.reason}</small>}
                </div>
                <span>{event.actor_name ? `Recorded by ${event.actor_name}` : "System baseline"}</span>
              </article>)}</div>}
      </PeopleWorkspaceSection>

      <PeopleWorkspaceSection
        title="Work & activity context"
        description={hasLinkedProfile
          ? "Factual authorised work and session evidence only. These records are not a productivity score, ranking, pay input or disciplinary conclusion."
          : "Operational work and session evidence appears only when this employee is linked to a real CEAC account."}
      >
        {!hasLinkedProfile && <PeopleEmpty title="No linked operational account" description="The employee is present in the roster, but CEAC will not invent work, attendance or submission records for someone without a linked account." />}
        {hasLinkedProfile && <>
        <div className="ev2p-outcome-grid ev2p-admin-work-grid">
          <button type="button" onClick={() => setDrill({ label: "Finished work — given to them", kind: "work", rows: person.assigned })}>
            <b>{person.assigned.length}</b><span>finished — given to them</span>
          </button>
          <button type="button" onClick={() => setDrill({ label: "Finished work — added themselves", kind: "work", rows: person.self })}>
            <b>{person.self.length}</b><span>finished — added themselves</span>
          </button>
          <button type="button" onClick={() => setDrill({ label: "Completed on time", kind: "work", rows: person.onTime })}>
            <b>{person.onTime.length}</b><span>completed on time</span>
          </button>
          <button type="button" onClick={() => setDrill({ label: "Completed outcomes", kind: "work", rows: person.done })}>
            <b>{person.done.length}</b><span>completed outcomes</span>
          </button>
        </div>

        <button type="button" className="ev2p-link-row ev2p-admin-open-work" onClick={() => setDrill({ label: "Open work", kind: "work", rows: person.openWork })}>
          <span className="ev2p-link-row-main">
            <strong>{person.openWork.length} open job{person.openWork.length === 1 ? "" : "s"}</strong>
            <span>Open the authorised current work record.</span>
          </span>
          <span className="ev2p-link-row-tail">›</span>
        </button>

        <PeopleEvidenceSummary
          facts={[
            { value: person.days_this_month || 0, label: "days with a recorded session this month" },
            { value: avgStartLabel(person.avg_start_minutes), label: "average recorded start" },
          ]}
          note="Work-session context describes recorded activity only. It does not measure productivity or determine pay."
        />
        <button type="button" className="ev2p-link-row ev2p-admin-session-link" onClick={() => setDrill({ label: "Recorded work sessions", kind: "sessions", rows: person.sessions })}>
          <span className="ev2p-link-row-main">
            <strong>{person.sessions.length} session record{person.sessions.length === 1 ? "" : "s"}</strong>
            <span>Inspect the underlying factual session records.</span>
          </span>
          <span className="ev2p-link-row-tail">›</span>
        </button>
        </>}
      </PeopleWorkspaceSection>

      <PeopleWorkspaceSection
        title="Leave"
        description={hasLinkedProfile
          ? (leavePolicy ? "Recorded leave against the currently configured leave policy." : "Leave actually taken is shown, but entitlement is not calculated because Administration has not configured the policy.")
          : "Leave history appears only when this employee is linked to an operational CEAC account."}
      >
        {!hasLinkedProfile && <PeopleEmpty title="No linked leave record" description="The employee remains represented in the roster without fabricated leave or attendance data." />}
        {hasLinkedProfile && <>
        <div className="ev2p-admin-leave-card">
          {leavePolicy
            ? <ProgressMeter value={taken} max={entitlement} label="Annual leave used" detail={taken + " of " + entitlement + " configured days"} />
            : <PeopleFactRow icon="calendar" title="Annual leave taken" subtitle={taken + " days recorded · entitlement not configured"} />}
          <PeopleFactRow icon="calendar" title="Sick leave taken" subtitle={Number(person.balance?.sick_taken || 0) + " days recorded"} />
        </div>
        <button type="button" className="ev2p-link-row ev2p-admin-leave-link" onClick={() => setDrill({ label: "Leave history", kind: "leave", rows: person.leave })}>
          <span className="ev2p-link-row-main">
            <strong>{person.leave.length} request{person.leave.length === 1 ? "" : "s"} on record</strong>
            <span>Open the authorised leave history.</span>
          </span>
          <span className="ev2p-link-row-tail">›</span>
        </button>
        </>}
      </PeopleWorkspaceSection>

      <PeopleWorkspaceSection
        title="Protected HR"
        description="Salary, identifiers, payment details and documents stay behind the protected-HR capability boundary. Roster-only employees can hold these records without a login account."
        className="ev2p-admin-protected-section"
      >
        {protectedHrLoading && <LoadingState label="Loading protected HR…" />}
        {!canManageProtectedHr && <PeopleEmpty title="Protected HR unavailable" description="Your account does not hold protected-HR access." />}
        {canManageProtectedHr && !protectedHrLoading && (() => {
          const compensation = (protectedHr?.compensation || []).find((row) => row.status === "active") || null;
          const payment = (protectedHr?.payment_details || []).find((row) => row.status === "active") || null;
          const identifiers = (protectedHr?.identifiers || []).filter((row) => row.status === "active");
          const documents = (protectedHr?.documents || []).filter((row) => row.status === "active");
          return <>
            <div className="ev2p-admin-protected-grid">
              <div>
                <span>Salary & payroll</span>
                <strong>{compensation ? `${protectedMoney(compensation.amount_minor, compensation.currency)} · ${compensation.basis_label}` : "Not recorded"}</strong>
                <button type="button" className="ev2p-admin-record-change" onClick={() => setProtectedEditor("compensation")}>{compensation ? "Record change" : "Record salary"}</button>
              </div>
              <div>
                <span>Payment details</span>
                <strong>{payment ? `${payment.provider_name} · ${payment.account_name} · ${payment.account_reference}` : "Not recorded"}</strong>
                <button type="button" className="ev2p-admin-record-change" onClick={() => setProtectedEditor("payment_detail")}>{payment ? "Record change" : "Record payment details"}</button>
              </div>
              <div>
                <span>Protected identifiers</span>
                <strong>{identifiers.length ? `${identifiers.length} active record${identifiers.length === 1 ? "" : "s"}` : "Not recorded"}</strong>
                <button type="button" className="ev2p-admin-record-change" onClick={() => setProtectedEditor("identifier")}>Record identifier</button>
              </div>
              <div>
                <span>Contracts & documents</span>
                <strong>{documents.length ? `${documents.length} active document${documents.length === 1 ? "" : "s"}` : "No protected document recorded"}</strong>
              </div>
            </div>
            {identifiers.length > 0 && <div className="ev2p-admin-history-list">
              {identifiers.map((row) => <article className="ev2p-admin-history-row" key={row.id}>
                <div><strong>{row.identifier_type}</strong><span>{row.identifier_value}</span></div>
                <span>{row.expires_on ? `Expires ${dateOnly(row.expires_on)}` : "Active"}</span>
              </article>)}
            </div>}
            <p className="ev2p-admin-protected-note">No salary, bank, identifier or Payroll value is inferred from role, attendance, performance or work records. Missing data remains explicitly missing until Administration records an authoritative value.</p>
          </>;
        })()}
      </PeopleWorkspaceSection>
        </div>
      </div>

      {protectedEditor && <ProtectedHrSheet
        type={protectedEditor}
        employee={person}
        busy={savingProtected}
        onClose={() => { if (!savingProtected) setProtectedEditor(null); }}
        onSave={saveProtectedRecord}
      />}

      {hasLinkedProfile && employmentEditor && employmentForm && <Sheet onClose={() => { if (!savingEmployment) { setEmploymentEditor(false); setEmploymentForm(null); } }}>
        <div className="eyebrow">People & employment</div>
        <div className="h2">Record employment change</div>
        <p className="screen-note">This writes a new historical snapshot. Earlier employment history is not overwritten.</p>

        <FieldGroup label="Change">
          <select className="field" aria-label="Change" value={employmentForm.changeType} onChange={(event) => setEmploymentForm({ ...employmentForm, changeType: event.target.value })}>
            {EMPLOYMENT_CHANGES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </FieldGroup>
        {employmentForm.changeType === "correction" && <FieldGroup label="Event being corrected">
          <select className="field" aria-label="Event being corrected" value={employmentForm.correctionOf} onChange={(event) => setEmploymentForm({ ...employmentForm, correctionOf: event.target.value })}>
            <option value="">Choose history event</option>
            {employmentHistory.map((event) => <option key={event.id} value={event.id}>{dateOnly(event.effective_on)} · {employmentChangeLabel(event.change_type)}</option>)}
          </select>
        </FieldGroup>}
        <FieldGroup label="Effective date"><input className="field" aria-label="Effective date" type="date" value={employmentForm.effectiveOn} onChange={(event) => setEmploymentForm({ ...employmentForm, effectiveOn: event.target.value })} /></FieldGroup>
        <FieldGroup label="Employment type"><input className="field" aria-label="Employment type" value={employmentForm.employmentType} onChange={(event) => setEmploymentForm({ ...employmentForm, employmentType: event.target.value })} placeholder="Permanent, contract, volunteer…" /></FieldGroup>
        <FieldGroup label="Job title"><input className="field" aria-label="Job title" value={employmentForm.jobTitle} onChange={(event) => setEmploymentForm({ ...employmentForm, jobTitle: event.target.value })} /></FieldGroup>
        <FieldGroup label="Primary unit">
          <select className="field" aria-label="Primary unit" value={employmentForm.unitId} onChange={(event) => setEmploymentForm({ ...employmentForm, unitId: event.target.value, managerId: "" })}>
            <option value="">No primary unit</option>
            {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
          </select>
        </FieldGroup>
        <FieldGroup label="Role">
          <select className="field" aria-label="Role" value={employmentForm.role} onChange={(event) => setEmploymentForm({ ...employmentForm, role: event.target.value })}>
            <option value="staff">Staff</option>
            <option value="sub_team_lead">Team lead</option>
            <option value="manager">Unit head</option>
          </select>
        </FieldGroup>
        <FieldGroup label="Manager">
          <select className="field" aria-label="Manager" value={employmentForm.managerId} onChange={(event) => setEmploymentForm({ ...employmentForm, managerId: event.target.value })}>
            <option value="">No manager recorded</option>
            {rows.filter((entry) => entry.profile_id && entry.profile_id !== person.profile_id && entry.active && entry.unit_id === employmentForm.unitId)
              .map((entry) => <option key={entry.employee_id || entry.id} value={entry.profile_id}>{entry.full_name}</option>)}
          </select>
        </FieldGroup>
        <FieldGroup label="Working pattern">
          <select className="field" aria-label="Working pattern" value={employmentForm.workingPattern} onChange={(event) => setEmploymentForm({ ...employmentForm, workingPattern: event.target.value })}>
            <option value="not_recorded">Not recorded</option>
            <option value="full_time">Full time</option>
            <option value="part_time">Part time</option>
            <option value="flexible">Flexible</option>
          </select>
        </FieldGroup>
        <FieldGroup label="Employment status">
          <select className="field" aria-label="Employment status" value={employmentForm.status} onChange={(event) => setEmploymentForm({ ...employmentForm, status: event.target.value, exitedOn: event.target.value === "exited" ? employmentForm.exitedOn : "" })}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="exited">Exited</option>
          </select>
        </FieldGroup>
        <FieldGroup label="Joined"><input className="field" aria-label="Joined" type="date" value={employmentForm.joinedOn} onChange={(event) => setEmploymentForm({ ...employmentForm, joinedOn: event.target.value })} /></FieldGroup>
        {employmentForm.status === "exited" && <FieldGroup label="Exit date"><input className="field" aria-label="Exit date" type="date" value={employmentForm.exitedOn} onChange={(event) => setEmploymentForm({ ...employmentForm, exitedOn: event.target.value })} /></FieldGroup>}
        <FieldGroup label="Reason / context"><textarea className="field" aria-label="Reason / context" rows="3" value={employmentForm.reason} onChange={(event) => setEmploymentForm({ ...employmentForm, reason: event.target.value })} placeholder="Why this employment record changed" /></FieldGroup>

        {error && <ProductNotice tone="error" title="Employment change">{error}</ProductNotice>}
        <button className="btn" style={{ marginTop: 14 }} onClick={saveEmployment}
          disabled={savingEmployment || !employmentForm.effectiveOn || !employmentForm.employmentType.trim() || (employmentForm.status === "exited" && !employmentForm.exitedOn) || (employmentForm.changeType === "correction" && !employmentForm.correctionOf)}>
          {savingEmployment ? "Recording…" : "Record employment change"}
        </button>
      </Sheet>}
    </div>;
  }

  const cleanSearch = searchText.trim().toLowerCase();
  const shown = rows.filter((p) => {
    const matchesFilter =
      filter === "all" ? true :
      filter === "active" ? p.active :
      filter === "on_leave" ? p.on_leave_now :
      filter === "quiet" ? p.quiet :
      filter === "no_unit" ? !p.unit_id : true;
    const matchesSearch = !cleanSearch || [
      p.full_name,p.source_display_name,p.email,p.job_title,p.source_position,p.source_department_text,p.unit_name,
      ...(p.roster_units || []).map((unit) => unit.unit_name),
      ...(p.responsibility_context || []),
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(cleanSearch));
    return matchesFilter && matchesSearch;
  });

  function rank(p) {
    if (!p.profile_id) return 4;
    if (p.is_exec) return 0;
    if (p.is_admin) return 1;
    if (p.role === "manager") return 2;
    if (p.role === "sub_team_lead") return 3;
    return 4;
  }
  function rankLabel(p) {
    if (!p.profile_id) return p.source_position || "Roster employee";
    if (p.is_exec) return "Group Pastor";
    if (p.is_admin) return "Administration & HR";
    if (p.role === "manager") return "Unit head";
    if (p.role === "sub_team_lead") return "Team lead";
    return "Staff";
  }

  const byUnit = {};
  shown.forEach((p) => {
    const key = p.unit_name || "No unit yet";
    (byUnit[key] = byUnit[key] || []).push(p);
  });
  const groups = Object.keys(byUnit)
    .sort((a, b) => (a === "No unit yet" ? 1 : b === "No unit yet" ? -1 : a.localeCompare(b)))
    .map((name) => ({
      name,
      people: byUnit[name].sort((a, b) =>
        rank(a) - rank(b)
        || String(a.started_on || "9999").localeCompare(String(b.started_on || "9999"))
        || a.full_name.localeCompare(b.full_name)),
    }));
  const roster = groups.flatMap((group) => group.people);

  return <div className="body ev2-people-page ev2-people-admin">
    <PeoplePageHeader
      eyebrow="Employee records"
      title="People"
      description="Authorised employee records for identity, employment, work, leave and factual activity context. Protected HR remains behind a separate security boundary."
      count={rows.length}
      countLabel={rows.length === 1 ? "person" : "people"}
    />

    {error && <ProductNotice tone="error" title="People could not finish loading" action={<button className="btn btn-ghost btn-sm" onClick={load}>Try again</button>}>{error}</ProductNotice>}
    {detailLoading && <LoadingState label="Opening employee record…" />}
    {!leavePolicy && <ProductNotice tone="attention" title="Leave policy not configured">People records show leave actually taken, but CEAC OS will not calculate entitlement or remaining leave until Administration confirms the policy.</ProductNotice>}

    <div className="ev2p-admin-control-band">
    <div className="ev2p-admin-toolbar">
      <FieldGroup label="Find a person">
        <input
          className="field"
          type="search"
          placeholder="Name, email, job title or unit"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
        />
      </FieldGroup>
    </div>

    <div className="ev2p-admin-filters" role="tablist" aria-label="People filters">
      {FILTERS.map(([key, label]) => <button
        key={key}
        type="button"
        role="tab"
        aria-selected={filter === key}
        className={filter === key ? "is-selected" : ""}
        onClick={() => setFilter(key)}
      >{label}</button>)}
    </div>
    <p className="ev2p-admin-directory-note">
      Work and submission counts are factual operating context only. They are not a performance score, ranking or disciplinary conclusion.
    </p>
    </div>

    {roster.length > 0 && <section className="fpg-people-roster" aria-label="Employee roster">
      <header className="fpg-people-roster-head">
        <div><span>Employees</span><h2>Employee roster</h2></div>
        <div><b>{roster.length}</b><span>{filter === "all" ? "visible" : FILTERS.find(([key]) => key === filter)?.[1]}</span></div>
      </header>
      <div className="fpg-people-roster-columns" aria-hidden="true">
        <span>Employee</span><span>Unit</span><span>Status</span><span>Recorded context</span><span />
      </div>
      <div className="fpg-people-roster-list">
        {roster.map((p) => <button type="button" className="fpg-people-roster-row" key={p.id} onClick={() => openPerson(p)}>
          <span className="fpg-people-roster-person">
            <Avatar name={p.full_name} size="md" />
            <span><strong>{p.full_name}</strong><small>{rankLabel(p)}{p.job_title ? ` · ${p.job_title}` : ""}</small></span>
          </span>
          <span className="fpg-people-roster-unit">{p.unit_name || "No unit assigned"}</span>
          <span className={p.identity_state === "needs_review" ? "fpg-people-roster-status is-leave" : !p.active ? "fpg-people-roster-status is-inactive" : "fpg-people-roster-status is-active"}>
            {p.identity_state === "needs_review" ? "Identity review" : p.identity_state === "roster_only" ? "Roster only" : p.on_leave_now ? "On leave" : !p.active ? "Inactive" : "Active"}
          </span>
          <span className="fpg-people-roster-facts">
            <strong>{!p.profile_id ? "No account linked" : p.quiet ? "Review context" : `${p.open_count || 0} open`}</strong>
            <small>{!p.profile_id
              ? `${(p.roster_units || []).length} unit membership${(p.roster_units || []).length === 1 ? "" : "s"} recorded`
              : p.quiet ? "No submission recorded in 14 days" : `${p.done_count || 0} finished on record`}</small>
          </span>
          <span className="fpg-people-roster-open" aria-hidden="true">›</span>
        </button>)}
      </div>
    </section>}

    {shown.length === 0 && <div style={{ marginTop: "var(--ev2-space-5)" }}>
      <PeopleEmpty title="Nobody matches" description="Try a different filter or search term." />
    </div>}
  </div>;
}


function ProtectedHrSheet({ type, employee, busy, onClose, onSave }) {
  const [amount,setAmount]=useState("");
  const [currency,setCurrency]=useState("GHS");
  const [basisLabel,setBasisLabel]=useState("Monthly salary");
  const [effectiveOn,setEffectiveOn]=useState(new Date().toISOString().slice(0,10));
  const [providerName,setProviderName]=useState("");
  const [accountName,setAccountName]=useState("");
  const [accountReference,setAccountReference]=useState("");
  const [branchReference,setBranchReference]=useState("");
  const [identifierType,setIdentifierType]=useState("Ghana Card");
  const [identifierValue,setIdentifierValue]=useState("");
  const [issuedOn,setIssuedOn]=useState("");
  const [expiresOn,setExpiresOn]=useState("");
  const [reason,setReason]=useState("");

  const valid = reason.trim().length >= 3 && (
    type === "compensation" ? amountToMinor(amount) > 0 && basisLabel.trim() && effectiveOn :
    type === "payment_detail" ? providerName.trim() && accountName.trim() && accountReference.trim() :
    type === "identifier" ? identifierType.trim() && identifierValue.trim() :
    false
  );

  function submit() {
    if (!valid) return;
    if (type === "compensation") {
      onSave({
        recordType:"compensation",
        reason:reason.trim(),
        payload:{
          amount_minor:amountToMinor(amount),
          currency,
          basis_label:basisLabel.trim(),
          effective_on:effectiveOn,
        },
      });
      return;
    }
    if (type === "payment_detail") {
      onSave({
        recordType:"payment_detail",
        reason:reason.trim(),
        payload:{
          payment_type:"bank",
          provider_name:providerName.trim(),
          account_name:accountName.trim(),
          account_reference:accountReference.trim(),
          branch_reference:branchReference.trim() || null,
        },
      });
      return;
    }
    onSave({
      recordType:"identifier",
      reason:reason.trim(),
      payload:{
        identifier_type:identifierType.trim(),
        identifier_value:identifierValue.trim(),
        issued_on:issuedOn || null,
        expires_on:expiresOn || null,
      },
    });
  }

  return <Sheet onClose={onClose}>
    <div className="eyebrow">Protected HR · {employee.full_name}</div>
    <div className="h2">{type === "compensation" ? "Record salary / compensation" : type === "payment_detail" ? "Record payment details" : "Record protected identifier"}</div>
    <p className="screen-note">This writes an attributable protected-HR record. Existing history is not silently overwritten.</p>

    {type === "compensation" && <>
      <FieldGroup label="Amount"><input className="field" inputMode="decimal" value={amount} onChange={(e)=>setAmount(e.target.value)} placeholder="0.00" /></FieldGroup>
      <FieldGroup label="Currency"><select className="field" value={currency} onChange={(e)=>setCurrency(e.target.value)}>{["GHS","USD","GBP","EUR","NGN","ZAR","CAD"].map((value)=><option key={value}>{value}</option>)}</select></FieldGroup>
      <FieldGroup label="Basis"><input className="field" value={basisLabel} onChange={(e)=>setBasisLabel(e.target.value)} /></FieldGroup>
      <FieldGroup label="Effective date"><input className="field" type="date" value={effectiveOn} onChange={(e)=>setEffectiveOn(e.target.value)} /></FieldGroup>
    </>}

    {type === "payment_detail" && <>
      <FieldGroup label="Bank / provider"><input className="field" value={providerName} onChange={(e)=>setProviderName(e.target.value)} /></FieldGroup>
      <FieldGroup label="Account name"><input className="field" value={accountName} onChange={(e)=>setAccountName(e.target.value)} /></FieldGroup>
      <FieldGroup label="Account number / reference"><input className="field" value={accountReference} onChange={(e)=>setAccountReference(e.target.value)} /></FieldGroup>
      <FieldGroup label="Branch / routing reference" hint="Optional"><input className="field" value={branchReference} onChange={(e)=>setBranchReference(e.target.value)} /></FieldGroup>
    </>}

    {type === "identifier" && <>
      <FieldGroup label="Identifier type"><select className="field" value={identifierType} onChange={(e)=>setIdentifierType(e.target.value)}><option>Ghana Card</option><option>SSNIT</option><option>TIN</option><option>Other identifier</option></select></FieldGroup>
      <FieldGroup label="Identifier value"><input className="field" value={identifierValue} onChange={(e)=>setIdentifierValue(e.target.value)} /></FieldGroup>
      <FieldGroup label="Issued on" hint="Optional"><input className="field" type="date" value={issuedOn} onChange={(e)=>setIssuedOn(e.target.value)} /></FieldGroup>
      <FieldGroup label="Expires on" hint="Optional"><input className="field" type="date" value={expiresOn} onChange={(e)=>setExpiresOn(e.target.value)} /></FieldGroup>
    </>}

    <FieldGroup label="Reason / source"><textarea className="field" rows="3" value={reason} onChange={(e)=>setReason(e.target.value)} placeholder="Why this value is authoritative" /></FieldGroup>
    <button className="btn" disabled={busy || !valid} onClick={submit}>{busy ? "Recording…" : "Record protected HR"}</button>
  </Sheet>;
}
