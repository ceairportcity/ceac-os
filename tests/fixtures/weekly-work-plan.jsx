import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Stage2ProjectReader from "../../src/components/Stage2ProjectReader";
import WeeklyWorkPlan from "../../src/screens/WeeklyWorkPlan";
import { currentPlanWeek, shiftPlanDay } from "../../src/lib/weeklyWorkPlan";
import { supabase } from "../../src/lib/supabase";
import "../../src/styles.css";
import "../../src/experience-v2.css";
import "../../src/experience-v2/project-family/project-family.css";
import "../../src/experience-v2/ApprovedWorkspace.css";

const planId = "10000000-0000-4000-8000-000000000010";
const taskId = "20000000-0000-4000-8000-000000000011";
const projectId = "20000000-0000-4000-8000-000000000012";
const unitId = "20000000-0000-4000-8000-000000000013";
const person = "20000000-0000-4000-8000-000000000014";
const unitName = "Media & Technical";
const me = { id: person, org_id: "synthetic", full_name: "Media Lead", memberships: [{ role: "manager", unit_id: unitId, unit_name: unitName }] };
const executive = { ...me, memberships: [], is_exec: true, job_title: "Group Pastor" };
const params = new URLSearchParams(location.search);
const directExec = params.get("role") === "executive";
const week = currentPlanWeek();
const project = { id: projectId, org_id: me.org_id, kind: "project", name: "Jesus Sunday production", status: "active", lead_unit_id: unitId, units: { name: unitName } };
const task = { id: taskId, kind: "task", title: "Film Jesus Sunday testimonies", ref: "MEDIA-001", unit_id: unitId, status: "in_progress",
  due_at: shiftPlanDay(week, 6) + "T12:00:00Z", assignee_id: person, profiles: { full_name: "Media Lead" } };
const plan = { id: planId, unit_id: unitId, week_start: week, units: { name: unitName }, shared_at: directExec ? new Date().toISOString() : null, original_plan: [] };
const items = directExec ? [{ id: taskId, plan_id: planId, title: "Approve equipment request", owner_id: person, decision_requested: true, blocker: "Can we reserve the equipment?" }] : [];

supabase.from = table => {
  const sources = {
    projects: [project],
    work_items: [task],
    units: [{ id: unitId, name: unitName }],
    profiles: [{ id: person, full_name: "Media Lead" }],
    unit_memberships: [{ unit_id: unitId, profile_id: person, profiles: { full_name: "Media Lead", active: true } }],
    weekly_work_plans: [plan],
    weekly_work_plan_items: items,
    weekly_work_plan_changes: [],
  };
  let records = sources[table] || [];
  const results = () => ({ data: structuredClone(records), count: records.length });
  const query = {
    select: () => query, order: () => query, neq: () => query, not: () => query,
    eq: (key, value) => {
      if (table.startsWith("weekly_work_")) records = records.filter(row => row[key] === value);
      return query;
    },
    in: (key, values) => { records = records.filter(row => values.includes(row[key])); return query; },
    single: () => Promise.resolve({ data: structuredClone(records[0]) }),
    maybeSingle: () => Promise.resolve({ data: structuredClone(records[0] ?? null) }),
    range: () => Promise.resolve(results()),
    limit: () => Promise.resolve(results()),
    then: (resolve, reject) => Promise.resolve(results()).then(resolve, reject),
  };
  return query;
};
supabase.rpc = async (name, { p_action, p_item, p_values } = {}) => {
  if (name !== "update_weekly_work_plan") return { data: [], count: 0 };
  if (p_action === "save") items.push({ id: p_item, plan_id: planId, title: p_values.title, owner_id: p_values.owner,
    work_id: p_values.work, planned_on: p_values.day, updated_at: new Date().toISOString() });
  if (p_action === "tick") items.find(item => item.id === p_item).completed_at = p_values.done ? new Date().toISOString() : null;
  if (p_action === "answer") items.find(item => item.id === p_item).decision_response = p_values.note;
  if (p_action === "share") plan.shared_at = new Date().toISOString();
  return { data: planId };
};

function Fixture() {
  const [selection, setSelection] = useState("current");
  const [itemOpen, setItemOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  useEffect(() => {
    const onBack = () => setItemOpen(Boolean(history.state?.itemOpen));
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, []);

  return <main className="ceac-ws">
    {params.get("view") === "project"
      ? <div style={{ marginInlineStart: "min(205px, 18vw)" }}>
          {itemOpen ? <button onClick={() => history.back()}>Back to project</button> :
            <div className="executive-project-frame"><div className="executive-project-layout">
              <aside className="ceac-project-register">Other projects</aside>
              <div className="executive-project-content">
                <Stage2ProjectReader projectId={projectId} me={executive} onBack={() => {}} goAssign={() => setAssigning(true)}
                  openItem={() => { history.pushState({ itemOpen: true }, ""); setItemOpen(true); }} />
                {assigning && <p>Assignment opened</p>}
              </div>
            </div></div>}
        </div>
      : <WeeklyWorkPlan me={directExec ? executive : me} selection={selection} openPlan={setSelection}
          openItem={() => setItemOpen(true)} close={() => setSelection("current")} />}
    {itemOpen && params.get("view") !== "project" && <p>Linked work opened</p>}
  </main>;
}
createRoot(document.getElementById("root")).render(<Fixture />);
