import { useMemo } from "react";
import { attendanceDate, startEvidence } from "../lib/attendance";
import AdminWorkforceToday from "./AdminWorkforceToday";
import { EmptyState, FieldGroup, LoadingState, ProductNotice } from "./bits";
import { WorkforceFactGrid, WorkforceRecordRow, WorkforceSection } from "../experience-v2/workforce-family/WorkforceFamilyV2";

const KINDS = {
  late_arrival: "Late-arrival notice",
  temporary_permission: "Temporary permission",
  emergency_absence: "Emergency notice",
  medical_absence: "Medical absence",
};

function time(value) {
  return value ? new Date(value).toLocaleTimeString("en-GB", { timeZone: "Africa/Accra", hour: "2-digit", minute: "2-digit" }) : "Not recorded";
}

function stamp(value) {
  return value ? new Date(value).toLocaleString("en-GB", { timeZone: "Africa/Accra", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Not recorded";
}

function noticeOnDate(notice, date) {
  const start = attendanceDate(new Date(notice.starts_at));
  const end = notice.expected_return_at ? attendanceDate(new Date(notice.expected_return_at)) : start;
  return start <= date && end >= date;
}

function rowState(row, date) {
  const currentLeave = (row.approved_leave || []).some((leave) => leave.state === "current" && leave.start_date <= date && leave.end_date >= date);
  const permission = (row.notices || []).find((notice) => notice.kind === "temporary_permission" && notice.request_state === "fulfilled" && noticeOnDate(notice, date) && !notice.returned_at);
  if (currentLeave) return ["Approved leave", "action"];
  if (permission) return ["Permission recorded", "warning"];
  if ((row.sessions || []).some((session) => !session.ended_at)) return ["Recorded present", "success"];
  if ((row.sessions || []).length) return ["Session ended", "neutral"];
  if (row.expected_today === true) return ["No session recorded", "warning"];
  if (row.expected_today === false) return [row.day_type || "No session expected", "neutral"];
  return ["Schedule not configured", "neutral"];
}

export default function ComplianceOverview({
  date,
  onDateChange,
  onRefresh,
  rows,
  units = [],
  loading,
  error,
  activePolicies,
  requirements,
  acknowledgements,
  evidenceLatest,
  exceptionLatest,
  openWork,
  openAnnouncements,
}) {
  const facts = useMemo(() => {
    const starts = rows.map((row) => startEvidence(row, date));
    const notices = rows.flatMap((row) => (row.notices || []).filter((notice) => noticeOnDate(notice, date)));
    return {
      expected: rows.filter((row) => row.expected_today === true).length,
      verified: starts.filter((item) => item.verified).length,
      present: rows.filter((row) => (row.sessions || []).some((session) => !session.ended_at)).length,
      late: starts.filter((item) => item.label === "Late against recorded working pattern").length,
      leave: rows.filter((row) => (row.approved_leave || []).some((leave) => leave.state === "current" && leave.start_date <= date && leave.end_date >= date)).length,
      upcomingLeave: rows.filter((row) => (row.approved_leave || []).some((leave) => leave.state === "upcoming")).length,
      permissions: notices.filter((notice) => notice.kind === "temporary_permission" && notice.request_state === "fulfilled" && !notice.returned_at).length,
      noSession: rows.filter((row) => row.expected_today === true && !(row.sessions || []).length).length,
    };
  }, [rows, date]);

  // Read ONLY the existing sanitised, role-scoped attendance response. The new
  // start coordinate fields remain null without the protected Stage 2 migration.
  const workforceMapRows = useMemo(() => {
    const unitNames = new Map(units.map(unit => [unit.id, unit.name]));
    return {
      roster: rows.map(row => ({ id:row.employee_id || ("profile:" + row.profile_id),
        profile_id:row.profile_id || null, full_name:row.name,
        units:row.unit_id ? [{name:unitNames.get(row.unit_id) || "Unit not named"}] : [] })),
      sessions: rows.flatMap(row => (row.profile_id ? (row.sessions || []).map(session => ({
        id:session.id, profile_id:row.profile_id, started_at:session.started_at, ended_at:session.ended_at,
        lat:session.start_lat, lng:session.start_lng, place:session.place,
        location_captured_at:session.location_captured_at,
        location_accuracy_m:session.start_location_accuracy_m,
      })) : [])),
    };
  }, [rows, units]);

  const acknowledgementPolicies = activePolicies.filter((policy) =>
    requirements.some((requirement) => requirement.policy_version_id === policy.id && requirement.acknowledgement_required)
  ).length;
  const submittedEvidence = evidenceLatest.filter((row) => row.state === "submitted").length;
  const expiredEvidence = evidenceLatest.filter((row) => row.expires_on && row.expires_on < date).length;
  const requestedExceptions = exceptionLatest.filter((row) => row.state === "requested").length;

  return <>
    <section className="compliance-overview-lead" aria-labelledby="compliance-overview-title">
      <div>
        <span className="eyebrow">Recorded facts · no automatic findings</span>
        <h2 id="compliance-overview-title">Operational picture</h2>
        <p>Attendance evidence and policy attention remain separate. “No session recorded” is not an absence or misconduct finding.</p>
      </div>
      <div className="compliance-overview-actions">
        {openWork && <button className="btn btn-ghost btn-sm" onClick={openWork}>Open authorised work</button>}
        {openAnnouncements && <button className="btn btn-sm" onClick={openAnnouncements}>Publish policy instruction</button>}
      </div>
    </section>

    <div className="compliance-overview-facts" aria-label="Compliance overview facts">
      <span><b>{facts.expected}</b>Expected today</span>
      <span><b>{facts.verified}</b>Verified starts</span>
      <span><b>{facts.present}</b>Recorded present</span>
      <span><b>{facts.late}</b>Verified late starts</span>
      <span><b>{facts.leave}</b>Approved leave</span>
      <span><b>{facts.permissions}</b>Active permissions</span>
    </div>

    {!loading && !error && <AdminWorkforceToday
      roleLabel="Compliance" dateLabel={date} roster={workforceMapRows.roster} sessions={workforceMapRows.sessions} />}

    <div className="compliance-overview-layout">
      <WorkforceSection
        title="Attendance evidence"
        description="Expected time, recorded sessions, verified office starts, leave and notices are shown as separate facts."
        meta={`${rows.length} people in scope`}
      >
        <div className="workforce-setup-actions compliance-overview-controls">
          <FieldGroup label="Evidence date"><input aria-label="Compliance overview date" className="field" type="date" value={date} onChange={(event) => onDateChange(event.target.value)} /></FieldGroup>
          <button className="btn btn-ghost btn-sm" onClick={onRefresh} disabled={loading}>Refresh evidence</button>
        </div>
        {error && <ProductNotice tone="error" title="Attendance evidence unavailable">{error}</ProductNotice>}
        {loading ? <LoadingState label="Loading compliance overview…" /> : rows.map((row) => {
          const start = startEvidence(row, date);
          const [statusLabel, statusTone] = rowState(row, date);
          const notices = (row.notices || []).filter((notice) => noticeOnDate(notice, date));
          const upcoming = (row.approved_leave || []).filter((leave) => leave.state === "upcoming");
          const noteParts = [
            row.last_activity_at ? `Last CEAC activity ${stamp(row.last_activity_at)}` : "Last CEAC activity not recorded",
            ...notices.map((notice) => `${KINDS[notice.kind] || "Attendance notice"}: ${String(notice.request_state || "waiting").replaceAll("_", " ")}`),
            ...(upcoming.length ? [`Upcoming approved leave ${upcoming.map((leave) => `${leave.start_date}–${leave.end_date}`).join(", ")}`] : []),
          ];
          return <div className="compliance-overview-person" key={row.employee_id || row.profile_id}>
            <WorkforceRecordRow
              icon="person"
              title={row.name}
              meta={start.label}
              note={noteParts.join(" · ")}
              statusLabel={statusLabel}
              statusTone={statusTone}
            />
            <WorkforceFactGrid items={[
              { label: "Expected", value: row.expected_today === true ? (row.expected_start && row.expected_end ? `${row.expected_start.slice(0, 5)}–${row.expected_end.slice(0, 5)}` : "Session expected") : row.expected_today === false ? (row.day_type || "No session expected") : "Not configured" },
              { label: "First recorded start", value: time(row.sessions?.[0]?.started_at) },
              { label: "Verified office start", value: time(start.verified) },
              { label: "Latest verification", value: row.latest_location?.captured_at ? stamp(row.latest_location.captured_at) : "Not recorded" },
            ]} />
          </div>;
        })}
        {!loading && !rows.length && <EmptyState compact title="No attendance evidence in scope">The overview remains empty until authorised employee records are available.</EmptyState>}
      </WorkforceSection>

      <aside className="compliance-attention" aria-label="Policy attention">
        <div className="sec"><span>Policy attention</span><span>Factual queues</span></div>
        <div className="compliance-attention-row"><span>Current policies requiring acknowledgement</span><b>{acknowledgementPolicies}</b></div>
        <div className="compliance-attention-row"><span>Acknowledgements recorded</span><b>{acknowledgements.length}</b></div>
        <div className="compliance-attention-row"><span>Submitted evidence awaiting review</span><b>{submittedEvidence}</b></div>
        <div className="compliance-attention-row"><span>Evidence with a recorded past expiry</span><b>{expiredEvidence}</b></div>
        <div className="compliance-attention-row"><span>Exception requests awaiting decision</span><b>{requestedExceptions}</b></div>
        <div className="compliance-attention-row"><span>People with upcoming approved leave</span><b>{facts.upcomingLeave}</b></div>
        <div className="compliance-attention-row"><span>Expected people with no session recorded</span><b>{facts.noSession}</b></div>
        <p className="screen-note">These counts organise recorded attention only. They do not calculate compliance, guilt, performance or disciplinary outcomes.</p>
      </aside>
    </div>
  </>;
}
