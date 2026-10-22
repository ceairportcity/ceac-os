import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { PeopleEmpty, PeopleWorkspaceSection } from "../experience-v2/people-family/PeopleFamilyV2";

/**
 * Existing-source HR dossier. No separate Learning, Assets or appraisal records
 * are created here. Every source is filtered by the selected linked profile,
 * and independently protected by its own existing database permissions.
 */
export default function EmployeeDossierRecords({ me, employeeId, profileId, section }) {
  const scope = `${me.org_id}:${me.id}:${employeeId}:${profileId || "unlinked"}:${section}`;
  const [result, setResult] = useState({ scope:"", loading:true, rows:[], names:{}, error:"" });
  useEffect(() => {
    let current = true;
    setResult({ scope:"", loading:Boolean(profileId), rows:[], names:{}, error:"" });
    if (!profileId) return () => { current = false; };
    const complete = (response) => {
      if (response.error || !Array.isArray(response.data)
        || typeof response.count !== "number" || response.count !== response.data.length
        || response.count > 500) throw new Error("The authorised source history is incomplete.");
      return response.data;
    };
    (async () => {
      try {
        let rows = [], names = {};
        if (section === "development") {
          // Filter independently released human ratings on the protected
          // server side; raw unpublished appraisal versions never arrive
          // in this employee's ordinary People/HR dossier browser payload.
          const response = await supabase.rpc("admin_employee_published_development", {
            p_profile_id:profileId,
          });
          if (response.error || !Array.isArray(response.data) || response.data.length > 500) {
            throw new Error("The HR-published development source is unavailable.");
          }
          rows = response.data;
        } else if (section === "learning") {
          rows = complete(await supabase.from("learning_assignments")
            .select("id,course_id,state,assigned_at,due_on,completed_at,assignment_reason", { count:"exact" })
            .eq("org_id", me.org_id).eq("profile_id", profileId)
            .order("assigned_at", { ascending:false }).limit(500));
          const ids = [...new Set(rows.map(row => row.course_id).filter(Boolean))];
          if (ids.length) {
            const courses = complete(await supabase.from("learning_courses")
              .select("id,title", { count:"exact" }).eq("org_id", me.org_id).in("id", ids).limit(500));
            names = Object.fromEntries(courses.map(course => [course.id, course.title]));
          }
        } else if (section === "equipment") {
          const [assigned, events] = await Promise.all([
            supabase.from("asset_items")
              .select("id,asset_code,category,model,current_status,current_condition_note", { count:"exact" })
              .eq("org_id",me.org_id).eq("current_assignee_profile_id",profileId).limit(500),
            supabase.from("asset_assignment_events")
              .select("id,asset_id,action,occurred_at,expected_return_on,condition_note,reason,from_profile_id,to_profile_id", { count:"exact" })
              .eq("org_id",me.org_id)
              .or(`to_profile_id.eq.${profileId},from_profile_id.eq.${profileId}`)
              .order("occurred_at",{ascending:false}).limit(500),
          ]);
          rows = [{ current: complete(assigned), history: complete(events) }];
          const ids = [...new Set(rows[0].history.map(event => event.asset_id).filter(Boolean))];
          if (ids.length) {
            const assets = complete(await supabase.from("asset_items")
              .select("id,asset_code", { count:"exact" }).eq("org_id",me.org_id).in("id",ids).limit(500));
            names = Object.fromEntries(assets.map(asset => [asset.id, asset.asset_code]));
          }
        }
        if (current) setResult({ scope, loading:false, rows, names, error:"" });
      } catch {
        if (current) setResult({ scope, loading:false, rows:[], names:{},
          error:"This employee's authorised records could not be verified. No empty or complete history is being inferred." });
      }
    })();
    return () => { current = false; };
  }, [scope]);

  const active = result.scope === scope && !result.loading && !result.error && Boolean(profileId);
  const { rows, names } = active ? result : { rows:[], names:{} };
  const title = section === "development" ? "Development"
    : section === "learning" ? "Learning" : "Equipment";
  const subtitle = {
    development:"Published human assessments and recorded development actions, not automatically calculated KPI scores.",
    learning:"Assignments and completions from the existing CEAC Learning register.",
    equipment:"Assigned equipment and historical custody events from the existing Assets register.",
  }[section];
  const date = (value) => value ? String(value).slice(0,10) : "Not recorded";
  return <PeopleWorkspaceSection title={title} description={subtitle}>
    {!profileId && <PeopleEmpty title="No application profile linked"
      description="This employee has a canonical HR record but no verified linked application account. Learning, appraisal and equipment assignments keyed to a profile cannot be attributed to this person until HR confirms the existing identity link." />}
    {profileId && !active && !result.error && <p role="status">Verifying the authorised {title.toLowerCase()} records…</p>}
    {profileId && result.scope === scope && result.error && <p role="alert">{result.error}</p>}
    {active && section === "development" && (rows.length
      ? <div className="ev2p-admin-history-list">{rows.map(record => <article className="ev2p-admin-history-row" key={record.id}>
        <div><strong>{record.cadence || "Published assessment"} · {record.overall_rating || "No overall rating recorded"}</strong>
          <span>Human-entered assessment · published source · recorded {date(record.created_at)}</span>
          {record.overall_narrative && <p>{record.overall_narrative}</p>}
          {record.strengths && <p><b>Strengths:</b> {record.strengths}</p>}
          {record.challenges && <p><b>Development needs:</b> {record.challenges}</p>}
          {record.next_actions && <p><b>Agreed next actions:</b> {record.next_actions}</p>}
        </div>
      </article>)}</div>
      : <PeopleEmpty title="No authorised published assessments"
        description="Unpublished ratings and protected review drafts are not shown. No score or development judgment is inferred." />)}
    {active && section === "learning" && (rows.length
      ? <div className="ev2p-admin-history-list">{rows.map(item => <article className="ev2p-admin-history-row" key={item.id}>
        <div><strong>{names[item.course_id] || "Course title not available within current access"}</strong>
          <span>{String(item.state || "not_recorded").replaceAll("_"," ")} · assigned {date(item.assigned_at)} · due {date(item.due_on)}</span>
          {item.completed_at && <p>Recorded completion {date(item.completed_at)}</p>}
          {item.assignment_reason && <p>{item.assignment_reason}</p>}
        </div>
      </article>)}</div>
      : <PeopleEmpty title="No authorised learning assignments"
        description="An empty assignment register does not establish a lack of training or certifications outside CEAC." />)}
    {active && section === "equipment" && <>
      {rows[0].current.length ? <div className="ev2p-admin-history-list">{rows[0].current.map(item =>
        <article className="ev2p-admin-history-row" key={item.id}><div>
          <strong>{item.asset_code || "Asset reference not recorded"}</strong>
          <span>{item.category || "Equipment"} · {item.model || "Model not recorded"} · {item.current_status || "Status not recorded"}</span>
          {item.current_condition_note && <p>Recorded condition: {item.current_condition_note}</p>}
        </div></article>)}</div>
        : <PeopleEmpty title="No current equipment assigned"
          description="No asset currently appears assigned to this linked account under the authorised Assets source." />}
      <h3>Custody history</h3>
      {rows[0].history.length ? <div className="ev2p-admin-history-list">{rows[0].history.map(event =>
        <article className="ev2p-admin-history-row" key={event.id}><div>
          <strong>{names[event.asset_id] || "Asset reference not available"} · {String(event.action || "recorded").replaceAll("_"," ")}</strong>
          <span>{date(event.occurred_at)} · return expected {date(event.expected_return_on)}</span>
          {event.condition_note && <p>Condition: {event.condition_note}</p>}
          {event.reason && <p>Recorded reason: {event.reason}</p>}
        </div></article>)}</div> : <p>No attributable custody events are visible in the authorised history.</p>}
    </>}
    <p className="screen-note">Records remain under their original Learning, Assets and protected appraisal permissions. This dossier does not create assignments, publish reviews or grant access.</p>
  </PeopleWorkspaceSection>;
}
