import LearningDraftEditor from "../components/LearningDraftEditor";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { Avatar, EmptyState, FieldGroup, LoadingState, Pill, ProductNotice, Sheet } from "../components/bits";
import { humanError } from "../lib/productLanguage";
import { PersonalPageHeader } from "../experience-v2/personal-family/PersonalFamilyV2";
import { ComposerDrawer } from "../experience-v2/components";
import { WorkPageHeader } from "../experience-v2/work-family/WorkFamilyV2";

function day(value) {
  if (!value) return "No date";
  const raw = String(value);
  const date = new Date(raw.length === 10 ? raw + "T00:00:00" : raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function sentence(value = "") {
  return String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function stateTone(state) {
  if (state === "completed" || state === "published") return "green";
  if (state === "in_progress" || state === "assigned") return "amber";
  if (state === "withdrawn" || state === "archived") return "brick";
  return "grey";
}

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function LearningForm({ admin, error, resetError, children, ...props }) {
  useEffect(() => { if (admin) resetError(null); }, [admin, resetError]);
  const Dialog = admin ? ComposerDrawer : Sheet;
  return <Dialog {...props}>
    {admin && error && <ProductNotice tone="error" title="Learning change not recorded">{error}</ProductNotice>}
    {children}
  </Dialog>;
}

export default function Learning(props) {
  return <LearningWorkspace key={`${props.me.org_id}:${props.me.id}`} {...props}/>;
}

function LearningWorkspace({ me }) {
  const learningAdmin = (me.capability_grants || []).some((grant) =>
    grant.capability === "learning.manage" && !grant.scope_unit_id
  );
  const isManager = !me.is_admin && !me.is_exec && me.role === "manager";

  const defaultMode = learningAdmin ? "catalogue" : "mine";
  const [mode, setMode] = useState(defaultMode);
  const [courses, setCourses] = useState([]);
  const [modules, setModules] = useState([]);
  const [resources, setResources] = useState([]);
  const [rules, setRules] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [progress, setProgress] = useState([]);
  const [training, setTraining] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [draftEdit,setDraftEdit]=useState(null);
  const [builderView, setBuilderView] = useState("outline");
  const [catalogueOpen,setCatalogueOpen]=useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");

  const [courseFlow, setCourseFlow] = useState(false);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseSummary, setCourseSummary] = useState("");
  const [courseMinutes, setCourseMinutes] = useState("");

  const [moduleFlow, setModuleFlow] = useState(false);
  const [moduleCourseId, setModuleCourseId] = useState("");
  const [moduleTitle, setModuleTitle] = useState("");
  const [moduleSummary, setModuleSummary] = useState("");
  const [moduleMinutes, setModuleMinutes] = useState("");
  const [moduleRequired, setModuleRequired] = useState(true);

  const [resourceFlow, setResourceFlow] = useState(false);
  const [resourceModuleId, setResourceModuleId] = useState("");
  const [resourceType, setResourceType] = useState("link");
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceText, setResourceText] = useState("");

  const [ruleFlow, setRuleFlow] = useState(false);
  const [ruleCourseId, setRuleCourseId] = useState("");
  const [targetKind, setTargetKind] = useState("person");
  const [targetProfileId, setTargetProfileId] = useState("");
  const [targetUnitId, setTargetUnitId] = useState("");
  const [targetRole, setTargetRole] = useState("staff");
  const [dueDays, setDueDays] = useState("");
  const [ruleReason, setRuleReason] = useState("");

  const [historyFlow, setHistoryFlow] = useState(false);
  const [historyProfileId, setHistoryProfileId] = useState("");
  const [historyName, setHistoryName] = useState("");
  const [historyDate, setHistoryDate] = useState("");
  const [historyNote, setHistoryNote] = useState("");

  const [adminAction, setAdminAction] = useState(null);
  const [adminReason, setAdminReason] = useState("");

  useEffect(() => { load(); }, [me.id]);
  useEffect(() => { setBuilderView("outline"); }, [me.id, me.org_id, selectedCourseId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const requests = [
        supabase.from("learning_courses").select("*").eq("org_id", me.org_id).order("created_at", { ascending:false }),
        supabase.from("learning_modules").select("*").eq("org_id", me.org_id).order("position"),
        supabase.from("learning_resources").select("*").eq("org_id", me.org_id).order("position"),
        supabase.from("learning_assignments").select("*").eq("org_id", me.org_id).order("assigned_at", { ascending:false }),
        supabase.from("learning_module_progress").select("*").eq("org_id", me.org_id),
        supabase.from("training_records").select("*").eq("org_id", me.org_id).order("created_at", { ascending:false }),
      ];
      if (learningAdmin) {
        requests.push(
          supabase.from("learning_assignment_rules").select("*").eq("org_id", me.org_id).order("created_at", { ascending:false }),
          supabase.from("profiles").select("id,full_name,email,job_title,is_admin,is_exec,active").eq("org_id", me.org_id).eq("active", true).order("full_name"),
          supabase.from("units").select("id,name,code").eq("org_id", me.org_id).order("name")
        );
      } else if (isManager) {
        requests.push(
          supabase.from("profiles").select("id,full_name,email,job_title,is_admin,is_exec,active").eq("org_id", me.org_id).eq("active", true).order("full_name")
        );
      }

      const results = await Promise.all(requests);
      const failed = results.find((result) => result.error);
      if (failed) throw failed.error;

      const courseRows = results[0].data || [];
      const assignmentRows = results[3].data || [];
      setCourses(courseRows);
      setModules(results[1].data || []);
      setResources(results[2].data || []);
      setAssignments(assignmentRows);
      setProgress(results[4].data || []);
      setTraining(results[5].data || []);

      if (learningAdmin) {
        setRules(results[6].data || []);
        setProfiles(results[7].data || []);
        setUnits(results[8].data || []);
      } else if (isManager) {
        setProfiles(results[6].data || []);
      }

      setSelectedCourseId((current) =>
        current && courseRows.some((row) => row.id === current) ? current : courseRows[0]?.id || ""
      );
      const own = assignmentRows.find((row) => row.profile_id === me.id);
      setSelectedAssignmentId((current) =>
        current && assignmentRows.some((row) => row.id === current)
          ? current
          : (learningAdmin ? assignmentRows[0]?.id : own?.id || assignmentRows[0]?.id) || ""
      );
    } catch (err) {
      setError(humanError(err, "Learning could not finish loading."));
    } finally {
      setLoading(false);
    }
  }

  const courseById = useMemo(() => Object.fromEntries(courses.map((row) => [row.id,row])), [courses]);
  const profileById = useMemo(() => Object.fromEntries(profiles.map((row) => [row.id,row])), [profiles]);
  const unitById = useMemo(() => Object.fromEntries(units.map((row) => [row.id,row])), [units]);

  function courseModules(courseId) {
    return modules.filter((row) => row.course_id === courseId).sort((a,b) => a.position-b.position);
  }

  function moduleResources(moduleId) {
    return resources.filter((row) => row.module_id === moduleId).sort((a,b) => a.position-b.position);
  }

  function assignmentProgress(assignment) {
    const required = courseModules(assignment.course_id).filter((row) => row.required);
    const completedIds = new Set(progress
      .filter((row) => row.assignment_id === assignment.id && row.state === "completed")
      .map((row) => row.module_id));
    return {
      required,
      requiredCompleted: required.filter((row) => completedIds.has(row.id)).length,
      completedIds,
    };
  }

  const selectedCourse = courseById[selectedCourseId] || null;
  const selectedAssignment = assignments.find((row) => row.id === selectedAssignmentId) || null;
  const selectedAssignmentCourse = selectedAssignment ? courseById[selectedAssignment.course_id] : null;
  const selectedAssignmentProgress = selectedAssignment ? assignmentProgress(selectedAssignment) : null;

  const mine = assignments.filter((row) => row.profile_id === me.id);
  const teamAssignments = isManager ? assignments.filter((row) => row.profile_id !== me.id) : [];
  const activeTraining = training.filter((row) => !row.voided_at);
  const modes = learningAdmin
    ? [["catalogue","Catalogue"],["assignments","Assignment rules"],["progress","Progress"],["history","Completed learning"]]
    : isManager
      ? [["mine","My learning"],["team","Team learning"],["catalogue","Catalogue"],["history","Completed learning"]]
      : [["mine","My learning"],["catalogue","Catalogue"],["history","Completed learning"]];

  async function run(operation, success) {
    setBusy(true); setError(null); setNotice(null);
    try {
      await operation();
      setNotice(success);
      await load();
      return true;
    } catch (err) {
      setError(humanError(err, "That learning change could not be recorded."));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createCourse() {
    const ok = await run(async () => {
      const { data, error: insertError } = await supabase.from("learning_courses").insert({
        org_id: me.org_id,
        title: courseTitle.trim(),
        summary: courseSummary.trim(),
        estimated_minutes: numberOrNull(courseMinutes),
        state: "draft",
        created_by: me.id,
        updated_by: me.id,
      }).select("id").single();
      if (insertError) throw insertError;
      setSelectedCourseId(data.id); setCatalogueOpen(true);
    }, "Draft course created.");
    if (ok) {
      setCourseFlow(false); setCourseTitle(""); setCourseSummary(""); setCourseMinutes("");
    }
  }

  async function addModule() {
    const existing = courseModules(moduleCourseId);
    const ok = await run(async () => {
      const { error: insertError } = await supabase.from("learning_modules").insert({
        org_id: me.org_id,
        course_id: moduleCourseId,
        position: existing.length ? Math.max(...existing.map((row) => row.position))+1 : 1,
        title: moduleTitle.trim(),
        summary: moduleSummary.trim() || null,
        required: moduleRequired,
        estimated_minutes: numberOrNull(moduleMinutes),
        created_by: me.id,
        updated_by: me.id,
      });
      if (insertError) throw insertError;
    }, "Course module added.");
    if (ok) {
      setModuleFlow(false); setModuleTitle(""); setModuleSummary(""); setModuleMinutes(""); setModuleRequired(true);
    }
  }

  async function addResource() {
    const existing = moduleResources(resourceModuleId);
    const ok = await run(async () => {
      const payload = {
        org_id: me.org_id,
        module_id: resourceModuleId,
        position: existing.length ? Math.max(...existing.map((row) => row.position))+1 : 1,
        resource_type: resourceType,
        title: resourceTitle.trim(),
        resource_url: resourceType === "text" ? null : resourceUrl.trim(),
        body_text: resourceType === "text" ? resourceText.trim() : null,
        created_by: me.id,
        updated_by: me.id,
      };
      const { error: insertError } = await supabase.from("learning_resources").insert(payload);
      if (insertError) throw insertError;
    }, "Learning resource added.");
    if (ok) {
      setResourceFlow(false); setResourceTitle(""); setResourceUrl(""); setResourceText(""); setResourceType("link");
    }
  }

  async function changeCourseState(course, state) {
    await run(async () => {
      const { error: updateError } = await supabase.from("learning_courses")
        .update({ state, updated_by: me.id })
        .eq("id", course.id);
      if (updateError) throw updateError;
    }, state === "published" ? "Course published." : "Course archived.");
  }

  async function createRule() {
    const payload = {
      org_id: me.org_id,
      course_id: ruleCourseId,
      target_kind: targetKind,
      target_profile_id: targetKind === "person" ? targetProfileId : null,
      target_unit_id: targetKind === "unit" ? targetUnitId : null,
      target_role: targetKind === "role" ? targetRole : null,
      due_days_after_assignment: numberOrNull(dueDays),
      reason: ruleReason.trim(),
      active: true,
      assigned_by: me.id,
      updated_by: me.id,
    };
    const ok = await run(async () => {
      const { error: insertError } = await supabase.from("learning_assignment_rules").insert(payload);
      if (insertError) throw insertError;
    }, "Learning assignment rule created.");
    if (ok) {
      setRuleFlow(false); setRuleReason(""); setDueDays(""); setTargetProfileId(""); setTargetUnitId(""); setTargetRole("staff");
    }
  }

  async function toggleRule(rule) {
    await run(async () => {
      const { error: updateError } = await supabase.from("learning_assignment_rules")
        .update({ active: !rule.active, updated_by: me.id })
        .eq("id", rule.id);
      if (updateError) throw updateError;
    }, rule.active ? "Assignment rule deactivated. Existing assignments remain on record." : "Assignment rule reactivated.");
  }

  async function completeModule(moduleId) {
    if (!selectedAssignment) return;
    await run(async () => {
      const { error: rpcError } = await supabase.rpc("learning_complete_module", {
        p_assignment_id: selectedAssignment.id,
        p_module_id: moduleId,
      });
      if (rpcError) throw rpcError;
    }, "Module completion recorded.");
  }

  async function recordHistorical() {
    const ok = await run(async () => {
      const { error: insertError } = await supabase.from("training_records").insert({
        org_id: me.org_id,
        profile_id: historyProfileId,
        name: historyName.trim(),
        completed_on: historyDate,
        note: historyNote.trim() || null,
        source: "historical",
        learning_assignment_id: null,
        recorded_by: me.id,
      });
      if (insertError) throw insertError;
    }, "Historical learning completion recorded.");
    if (ok) {
      setHistoryFlow(false); setHistoryName(""); setHistoryDate(""); setHistoryNote(""); setHistoryProfileId("");
    }
  }

  async function submitAdminAction() {
    if (!adminAction) return;
    const ok = await run(async () => {
      const { error: rpcError } = await supabase.rpc("learning_admin_action", {
        p_assignment_id: adminAction.assignmentId,
        p_action: adminAction.action,
        p_module_id: adminAction.moduleId || null,
        p_reason: adminReason.trim(),
      });
      if (rpcError) throw rpcError;
    }, adminAction.action === "reopen_module"
      ? "Module completion corrected and history preserved."
      : adminAction.action === "withdraw"
        ? "Learning assignment withdrawn."
        : "Learning assignment restored.");
    if (ok) { setAdminAction(null); setAdminReason(""); }
  }

  function openRule(courseId) {
    setRuleCourseId(courseId);
    setTargetKind("person");
    setTargetProfileId("");
    setTargetUnitId("");
    setTargetRole("staff");
    setDueDays("");
    setRuleReason("");
    setRuleFlow(true);
  }

  function AssignmentCard({ assignment, showPerson = false }) {
    const course = courseById[assignment.course_id];
    const facts = assignmentProgress(assignment);
    const profile = profileById[assignment.profile_id];
    return <button type="button" className={"learning-assignment-card"+(selectedAssignmentId === assignment.id ? " on" : "")} onClick={() => setSelectedAssignmentId(assignment.id)}>
      <div className="learning-card-head">
        {showPerson && <Avatar name={profile?.full_name || "Employee"} size="sm" />}
        <span>
          <strong>{showPerson ? profile?.full_name || "Employee" : course?.title || "Learning course"}</strong>
          <small>{showPerson ? course?.title || "Learning course" : assignment.assignment_reason}</small>
        </span>
        <Pill tone={stateTone(assignment.state)}>{sentence(assignment.state)}</Pill>
      </div>
      <div className="learning-facts">
        <span><b>{facts.requiredCompleted}</b> of {facts.required.length} required modules</span>
        <span>{assignment.due_on ? "Due " + day(assignment.due_on) : "No due date"}</span>
      </div>
    </button>;
  }

  function CourseDetail({ course, assignment = null, preview = false }) {
    if (!course) return null;
    const rows = courseModules(course.id);
    const facts = assignment ? assignmentProgress(assignment) : null;
    const selfAssignment = assignment?.profile_id === me.id;
    return <section className="learning-course-detail">
      <header>
        <div>
          <div className="eyebrow">{course.state === "draft" ? "Draft course" : course.state === "archived" ? "Archived learning" : "Published learning"}</div>
          <h2>{course.title}</h2>
          <p>{course.summary}</p>
        </div>
        <Pill tone={stateTone(course.state)}>{sentence(course.state)}</Pill>
      </header>

      {assignment && <div className="learning-assignment-context">
        <span><strong>{facts.requiredCompleted}</strong> of {facts.required.length} required modules complete</span>
        <span>{assignment.due_on ? "Due " + day(assignment.due_on) : "No due date"}</span>
        <span>{assignment.assignment_reason}</span>
      </div>}

      {rows.map((module) => {
        const moduleDone = facts?.completedIds.has(module.id);
        return <article className="learning-module" key={module.id}>
          <div className="learning-module-head">
            <div><span>Module {module.position}{module.required ? " · Required" : " · Optional"}</span><h3>{module.title}</h3>{module.summary && <p>{module.summary}</p>}</div>
            {assignment && <Pill tone={moduleDone ? "green" : "grey"}>{moduleDone ? "Completed" : "Not completed"}</Pill>}
          </div>

          <div className="learning-resources">
            {moduleResources(module.id).map((resource) => <div className="learning-resource" key={resource.id}>
              <div><strong>{resource.title}</strong><span>{sentence(resource.resource_type)}</span></div>
              {resource.resource_type === "text"
                ? <p>{resource.body_text}</p>
                : <a href={resource.resource_url} target="_blank" rel="noreferrer">Open resource</a>}
              {me.is_admin && learningAdmin && !preview && course.state === "draft" && <button type="button" className="text-action" aria-label={`Edit resource ${resource.title}`} onClick={()=>setDraftEdit({kind:"resource",row:resource})}>Edit resource</button>}
            </div>)}
            {!moduleResources(module.id).length && <div className="small">No learning resource has been added yet.</div>}
          </div>

          {selfAssignment && assignment.state !== "withdrawn" && !moduleDone && <button className="btn btn-sm learning-complete" disabled={busy} onClick={() => completeModule(module.id)}>Complete module</button>}
          {me.is_admin && learningAdmin && !preview && course.state === "draft" && <button type="button" className="text-action" aria-label={`Edit module ${module.title}`} onClick={()=>setDraftEdit({kind:"module",row:module})}>Edit module</button>}
          {learningAdmin && !preview && course.state === "draft" && <button className="text-action" onClick={() => { setResourceModuleId(module.id); setResourceFlow(true); }}>Add resource</button>}
          {learningAdmin && !preview && assignment && moduleDone && <button className="text-action" onClick={() => { setAdminReason(""); setAdminAction({ action:"reopen_module", assignmentId:assignment.id, moduleId:module.id, label:module.title }); }}>Correct completion</button>}
        </article>;
      })}

      {!rows.length && <EmptyState compact title="No modules yet">Add the first module before publishing this course.</EmptyState>}

      {learningAdmin && !preview && course.state === "draft" && <div className="learning-author-actions">
        {me.is_admin && <button type="button" className="btn btn-ghost btn-sm" onClick={()=>setDraftEdit({kind:"course",row:course})}>Edit course details</button>}
        <button className="btn btn-ghost btn-sm" onClick={() => { setModuleCourseId(course.id); setModuleFlow(true); }}>Add module</button>
        <button className="btn btn-sm" disabled={busy || (me.is_admin && (!rows.some(module => module.required) || rows.some(module => !moduleResources(module.id).length)))} onClick={() => changeCourseState(course,"published")}>Publish course</button>
        {me.is_admin && (!rows.some(module => module.required) || rows.some(module => !moduleResources(module.id).length)) && <p className="screen-note">Before publishing, add at least one required module and a resource to every module.</p>}
      </div>}
      {learningAdmin && !preview && course.state === "published" && <div className="learning-author-actions">
        <button className="btn btn-ghost btn-sm" onClick={() => openRule(course.id)}>Create assignment rule</button>
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => changeCourseState(course,"archived")}>Archive course</button>
      </div>}
    </section>;
  }

  if (loading) return <div className="body"><LoadingState label="Loading learning…" /></div>;

  const personalLearning = !learningAdmin && !me.is_admin;
  return <div className={`body learning-page ${personalLearning ? "ev2-personal-page ev2-personal-learning" : ""}`.trim()}>
    {personalLearning ? <PersonalPageHeader
      eyebrow="My Hub"
      title="Learning"
      description="Your assigned learning, catalogue access and factual completion history. Learning activity is not converted into a skill, performance or potential score."
      statusLabel="Personal learning"
    /> : me.is_admin ? <WorkPageHeader
      eyebrow="People development"
      title="Learning"
      description="Structured courses, resources and factual completion. CEAC OS does not turn learning activity into a skill, performance or potential score."
    /> : <div style={{ paddingTop:26 }}>
      <div className="eyebrow">Learning</div>
      <h1 className="h1">Learning</h1>
      <p className="screen-note">Structured courses, resources and factual completion. CEAC OS does not turn learning activity into a skill, performance or potential score.</p>
    </div>}

    {error && <ProductNotice tone="error" title="Learning">{error}</ProductNotice>}
    {notice && <ProductNotice tone="success" title="Recorded">{notice}</ProductNotice>}

    <div className="learning-mode-tabs" aria-label="Learning views">
      {modes.map(([key,label]) => <button key={key} className={mode === key ? "on" : ""} onClick={() => setMode(key)}>{label}</button>)}
    </div>

    {mode === "mine" && <>
      <div className="sec"><span>My assigned learning</span><span>{mine.length}</span></div>
      <div className="learning-two-col">
        <div>
          {mine.map((assignment) => <AssignmentCard key={assignment.id} assignment={assignment} />)}
          {!mine.length && <EmptyState title="No learning assigned">Published catalogue courses remain available to browse.</EmptyState>}
        </div>
        <div>{selectedAssignment?.profile_id === me.id && <CourseDetail course={selectedAssignmentCourse} assignment={selectedAssignment} />}</div>
      </div>
    </>}

    {mode === "team" && isManager && <>
      <div className="sec"><span>Team learning</span><span>{teamAssignments.length} assignments</span></div>
      <p className="screen-note">This is assignment and completion evidence only. It is not a team score or ranking.</p>
      <div className="learning-two-col">
        <div>
          {teamAssignments.map((assignment) => <AssignmentCard key={assignment.id} assignment={assignment} showPerson />)}
          {!teamAssignments.length && <EmptyState title="No team learning assigned">Learning assigned to people in units you manage will appear here.</EmptyState>}
        </div>
        <div>{selectedAssignment && selectedAssignment.profile_id !== me.id && <CourseDetail course={selectedAssignmentCourse} assignment={selectedAssignment} />}</div>
      </div>
    </>}

    {mode === "catalogue" && <>
      <div className="learning-section-title">
        <div><span className="eyebrow">Catalogue</span><h2>Courses</h2></div>
        {learningAdmin && <button className="btn btn-sm" onClick={() => setCourseFlow(true)}>Create course</button>}
      </div>
      <div className={me.is_admin?"owner-learning-workspace":"learning-two-col"}>
        <div className={me.is_admin?"learning-catalogue-list owner-learning-catalogue":"learning-catalogue-list"} hidden={me.is_admin&&catalogueOpen}>
          {courses.map((course) => <button type="button" className={"learning-course-row"+(selectedCourseId === course.id ? " on" : "")} key={course.id} onClick={() => {setSelectedCourseId(course.id);setCatalogueOpen(true);}}>
            {me.is_admin&&<span className="owner-course-cover" aria-hidden="true">CEAC · Learning</span>}
            <span><strong>{course.title}</strong><small>{course.summary}</small></span>
            <Pill tone={stateTone(course.state)}>{sentence(course.state)}</Pill>
            {me.is_admin&&<small>{courseModules(course.id).length} modules · {courseModules(course.id).reduce((count,module)=>count+moduleResources(module.id).length,0)} resources</small>}
            {me.is_admin&&<span>{course.state==="draft"?"Continue building":"View course"} →</span>}
          </button>)}
          {!courses.length && <EmptyState title="No learning in the catalogue">{learningAdmin ? "Create the first draft course." : "Published learning will appear here when Administration makes it available."}</EmptyState>}
        </div>
        <div hidden={me.is_admin&&!catalogueOpen}>
          {me.is_admin&&<button type="button" className="btn btn-ghost btn-sm" onClick={()=>setCatalogueOpen(false)}>Back to course catalogue</button>}
          {learningAdmin && selectedCourse && <section aria-label="Course builder">
            <div className="learning-section-title"><div><span className="eyebrow">Course builder</span><h2>{selectedCourse.state === "draft" ? "Prepare your course" : "Course and learner preview"}</h2></div></div>
            <div className="learning-mode-tabs" role="group" aria-label="Course builder views">
              <button type="button" className={builderView === "outline" ? "on" : ""} aria-pressed={builderView === "outline"} onClick={() => setBuilderView("outline")}>Course outline</button>
              <button type="button" className={builderView === "preview" ? "on" : ""} aria-pressed={builderView === "preview"} onClick={() => setBuilderView("preview")}>Learner preview</button>
            </div>
            {builderView === "outline" && <div className="learning-assignment-context" aria-label="Course preparation">
              <span><strong>Details</strong> · {selectedCourse.title}</span>
              <span><strong>Modules</strong> · {courseModules(selectedCourse.id).length} prepared</span>
              <span><strong>Resources</strong> · {courseModules(selectedCourse.id).reduce((count, module) => count + moduleResources(module.id).length, 0)} added</span>
              <span><strong>Audience</strong> · {selectedCourse.state === "published" ? "Use an assignment rule" : "Choose after publishing"}</span>
            </div>}
          </section>}
          {builderView === "preview" && learningAdmin && <p className="screen-note">Learner preview · Review the course content before publishing.</p>}
          <CourseDetail course={selectedCourse} preview={learningAdmin && builderView === "preview"} />
        </div>
      </div>
    </>}

    {mode === "assignments" && learningAdmin && <>
      <div className="learning-section-title">
        <div><span className="eyebrow">Assignment rules</span><h2>Who receives learning</h2></div>
        <button className="btn btn-sm" disabled={!courses.some((course) => course.state === "published")} onClick={() => {
          const first = courses.find((course) => course.state === "published");
          if (first) openRule(first.id);
        }}>Create assignment rule</button>
      </div>
      <p className="screen-note">Rules may target a person, unit, employment role or the onboarding template. Overlapping rules do not duplicate the same person/course assignment.</p>
      <div className="learning-rule-list">
        {rules.map((rule) => <div className="card learning-rule-row" key={rule.id}>
          <div>
            <strong>{courseById[rule.course_id]?.title || "Course"}</strong>
            <span>{rule.target_kind === "person" ? profileById[rule.target_profile_id]?.full_name || "Person"
              : rule.target_kind === "unit" ? unitById[rule.target_unit_id]?.name || "Unit"
              : rule.target_kind === "role" ? sentence(rule.target_role)
              : "Onboarding template"}</span>
            <small>{rule.reason}{rule.due_days_after_assignment ? " · due " + rule.due_days_after_assignment + " days after assignment" : ""}</small>
          </div>
          <div><Pill tone={rule.active ? "green" : "grey"}>{rule.active ? "Active" : "Inactive"}</Pill><button className="text-action" disabled={busy} onClick={() => toggleRule(rule)}>{rule.active ? "Deactivate" : "Reactivate"}</button></div>
        </div>)}
        {!rules.length && <EmptyState title="No assignment rules">Create a rule from a published course.</EmptyState>}
      </div>
    </>}

    {mode === "progress" && learningAdmin && <>
      <div className="sec"><span>Organisation learning progress</span><span>{assignments.length}</span></div>
      <p className="screen-note">Shows factual assignment state and required-module completion only. No employee learning score is calculated.</p>
      <div className="learning-two-col">
        <div>
          {assignments.map((assignment) => <AssignmentCard key={assignment.id} assignment={assignment} showPerson />)}
          {!assignments.length && <EmptyState title="No assignments yet">Published course assignment rules will create person-level assignments here.</EmptyState>}
        </div>
        <div>
          {selectedAssignment && <>
            <CourseDetail course={selectedAssignmentCourse} assignment={selectedAssignment} />
            <div className="learning-admin-assignment-actions">
              {selectedAssignment.state === "withdrawn"
                ? <button className="btn btn-ghost btn-sm" onClick={() => { setAdminReason(""); setAdminAction({ action:"restore", assignmentId:selectedAssignment.id, label:selectedAssignmentCourse?.title }); }}>Restore assignment</button>
                : <button className="btn btn-ghost btn-sm" onClick={() => { setAdminReason(""); setAdminAction({ action:"withdraw", assignmentId:selectedAssignment.id, label:selectedAssignmentCourse?.title }); }}>Withdraw assignment</button>}
            </div>
          </>}
        </div>
      </div>
    </>}

    {mode === "history" && <>
      <div className="learning-section-title">
        <div><span className="eyebrow">Completed learning</span><h2>Training history</h2></div>
        {learningAdmin && <button className="btn btn-sm" onClick={() => { setHistoryProfileId(""); setHistoryFlow(true); }}>Record historical completion</button>}
      </div>
      <div className="learning-history-list">
        {activeTraining
          .filter((row) => learningAdmin || isManager || row.profile_id === me.id)
          .map((row) => <div className="card learning-history-row" key={row.id}>
            {(learningAdmin || isManager) && <Avatar name={profileById[row.profile_id]?.full_name || (row.profile_id === me.id ? me.full_name : "Employee")} size="sm" />}
            <div><strong>{row.name}</strong><span>{row.completed_on ? "Completed " + day(row.completed_on) : "Completion date not recorded"}</span>{row.note && <small>{row.note}</small>}</div>
            <Pill tone={row.completed_on ? "green" : "grey"}>{row.source === "learning_course" ? "CEAC OS course" : "Historical"}</Pill>
          </div>)}
        {!activeTraining.filter((row) => learningAdmin || isManager || row.profile_id === me.id).length && <EmptyState title="No completed learning recorded">Completed course and historical training records will appear here.</EmptyState>}
      </div>
    </>}

    {draftEdit && me.is_admin && learningAdmin && <LearningDraftEditor key={`${me.org_id}:${me.id}:${draftEdit.kind}:${draftEdit.row.id}`} me={me} edit={draftEdit} onClose={()=>setDraftEdit(null)} onSaved={async()=>{setDraftEdit(null);await load();setNotice("Draft content updated.");}}/>}

    {courseFlow && <LearningForm admin={me.is_admin} error={error} resetError={setError} open title="Create a draft course" onClose={() => !busy && setCourseFlow(false)}>
      <div className="eyebrow">New learning course</div>
      {!me.is_admin && <div className="h2">Create a draft course</div>}
      <p className="screen-note">Draft learning is visible only to authorised Learning Administration until it is published.</p>
      <FieldGroup label="Course title"><input className="field" aria-label="Learning course title" value={courseTitle} onChange={(event) => setCourseTitle(event.target.value)} /></FieldGroup>
      <FieldGroup label="What this course is for"><textarea className="field" aria-label="Learning course summary" rows="4" value={courseSummary} onChange={(event) => setCourseSummary(event.target.value)} /></FieldGroup>
      <FieldGroup label="Estimated minutes" hint="Optional factual estimate."><input className="field" aria-label="Learning course minutes" type="number" min="1" value={courseMinutes} onChange={(event) => setCourseMinutes(event.target.value)} /></FieldGroup>
      <button className="btn" style={{ marginTop:14 }} disabled={busy || courseTitle.trim().length < 3 || courseSummary.trim().length < 3} onClick={createCourse}>{busy ? "Creating…" : "Create draft course"}</button>
    </LearningForm>}

    {moduleFlow && <LearningForm admin={me.is_admin} error={error} resetError={setError} open title="Add a module" onClose={() => !busy && setModuleFlow(false)}>
      <div className="eyebrow">Course module</div>
      {!me.is_admin && <div className="h2">Add a module</div>}
      <FieldGroup label="Module title"><input className="field" aria-label="Learning module title" value={moduleTitle} onChange={(event) => setModuleTitle(event.target.value)} /></FieldGroup>
      <FieldGroup label="Module summary"><textarea className="field" aria-label="Learning module summary" rows="3" value={moduleSummary} onChange={(event) => setModuleSummary(event.target.value)} /></FieldGroup>
      <FieldGroup label="Estimated minutes"><input className="field" aria-label="Learning module minutes" type="number" min="1" value={moduleMinutes} onChange={(event) => setModuleMinutes(event.target.value)} /></FieldGroup>
      <label className="check"><input aria-label="Required learning module" type="checkbox" checked={moduleRequired} onChange={(event) => setModuleRequired(event.target.checked)} /><span>Required for course completion</span></label>
      <button className="btn" style={{ marginTop:14 }} disabled={busy || moduleTitle.trim().length < 2} onClick={addModule}>Add module</button>
    </LearningForm>}

    {resourceFlow && <LearningForm admin={me.is_admin} error={error} resetError={setError} open title="Add a resource" onClose={() => !busy && setResourceFlow(false)}>
      <div className="eyebrow">Learning resource</div>
      {!me.is_admin && <div className="h2">Add a resource</div>}
      <FieldGroup label="Resource type"><select className="field" aria-label="Learning resource type" value={resourceType} onChange={(event) => setResourceType(event.target.value)}><option value="link">Link</option><option value="video">Video link</option><option value="document">Document link</option><option value="text">Text</option></select></FieldGroup>
      <FieldGroup label="Title"><input className="field" aria-label="Learning resource title" value={resourceTitle} onChange={(event) => setResourceTitle(event.target.value)} /></FieldGroup>
      {resourceType === "text"
        ? <FieldGroup label="Text"><textarea className="field" aria-label="Learning resource text" rows="5" value={resourceText} onChange={(event) => setResourceText(event.target.value)} /></FieldGroup>
        : <FieldGroup label="Secure URL" hint="Use an HTTPS link."><input className="field" aria-label="Learning resource URL" type="url" placeholder="https://…" value={resourceUrl} onChange={(event) => setResourceUrl(event.target.value)} /></FieldGroup>}
      <button className="btn" style={{ marginTop:14 }} disabled={busy || resourceTitle.trim().length < 2 || (resourceType === "text" ? !resourceText.trim() : !resourceUrl.trim().startsWith("https://"))} onClick={addResource}>Add resource</button>
    </LearningForm>}

    {ruleFlow && <LearningForm admin={me.is_admin} error={error} resetError={setError} open title="Create an assignment rule" onClose={() => !busy && setRuleFlow(false)}>
      <div className="eyebrow">Learning assignment</div>
      {!me.is_admin && <div className="h2">Create an assignment rule</div>}
      <FieldGroup label="Course"><select className="field" aria-label="Learning rule course" value={ruleCourseId} onChange={(event) => setRuleCourseId(event.target.value)}>{courses.filter((course) => course.state === "published").map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></FieldGroup>
      <FieldGroup label="Assign by"><select className="field" aria-label="Learning target kind" value={targetKind} onChange={(event) => setTargetKind(event.target.value)}><option value="person">Person</option><option value="unit">Unit</option><option value="role">Employment role</option><option value="onboarding">Onboarding template</option></select></FieldGroup>
      {targetKind === "person" && <FieldGroup label="Person"><select className="field" aria-label="Learning target person" value={targetProfileId} onChange={(event) => setTargetProfileId(event.target.value)}><option value="">Choose person</option>{profiles.filter((profile) => !profile.is_exec).map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select></FieldGroup>}
      {targetKind === "unit" && <FieldGroup label="Unit"><select className="field" aria-label="Learning target unit" value={targetUnitId} onChange={(event) => setTargetUnitId(event.target.value)}><option value="">Choose unit</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></FieldGroup>}
      {targetKind === "role" && <FieldGroup label="Employment role"><select className="field" aria-label="Learning target role" value={targetRole} onChange={(event) => setTargetRole(event.target.value)}><option value="staff">Staff</option><option value="manager">Manager</option><option value="sub_team_lead">Sub-team lead</option></select></FieldGroup>}
      {targetKind === "onboarding" && <div className="card small">This rule applies when an active onboarding lifecycle case is opened. CEAC OS currently has one canonical onboarding template.</div>}
      <FieldGroup label="Due days after assignment" hint="Optional."><input className="field" aria-label="Learning due days" type="number" min="1" value={dueDays} onChange={(event) => setDueDays(event.target.value)} /></FieldGroup>
      <FieldGroup label="Reason"><textarea className="field" aria-label="Learning assignment reason" rows="3" value={ruleReason} onChange={(event) => setRuleReason(event.target.value)} placeholder="Why this learning should be assigned to this group" /></FieldGroup>
      <button className="btn" style={{ marginTop:14 }} disabled={busy || !ruleCourseId || ruleReason.trim().length < 3 || (targetKind === "person" && !targetProfileId) || (targetKind === "unit" && !targetUnitId)} onClick={createRule}>Create assignment rule</button>
    </LearningForm>}

    {historyFlow && <LearningForm admin={me.is_admin} error={error} resetError={setError} open title="Record historical completion" onClose={() => !busy && setHistoryFlow(false)}>
      <div className="eyebrow">Completed learning</div>
      {!me.is_admin && <div className="h2">Record historical completion</div>}
      <p className="screen-note">Use this for learning completed before the structured CEAC OS catalogue. Do not use it to manufacture a course completion.</p>
      <FieldGroup label="Person"><select className="field" aria-label="Historical learning person" value={historyProfileId} onChange={(event) => setHistoryProfileId(event.target.value)}><option value="">Choose person</option>{profiles.filter((profile) => !profile.is_exec).map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select></FieldGroup>
      <FieldGroup label="Training name"><input className="field" aria-label="Historical learning name" value={historyName} onChange={(event) => setHistoryName(event.target.value)} /></FieldGroup>
      <FieldGroup label="Completed on"><input className="field" aria-label="Historical learning date" type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} /></FieldGroup>
      <FieldGroup label="Note"><textarea className="field" aria-label="Historical learning note" rows="3" value={historyNote} onChange={(event) => setHistoryNote(event.target.value)} /></FieldGroup>
      <button className="btn" style={{ marginTop:14 }} disabled={busy || !historyProfileId || historyName.trim().length < 2 || !historyDate} onClick={recordHistorical}>Record completion</button>
    </LearningForm>}

    {adminAction && <LearningForm admin={me.is_admin} error={error} resetError={setError} open title="Learning record correction" onClose={() => !busy && setAdminAction(null)}>
      <div className="eyebrow">Learning record correction</div>
      <div className="h2">{adminAction.action === "reopen_module" ? "Correct module completion" : adminAction.action === "withdraw" ? "Withdraw assignment" : "Restore assignment"}</div>
      <p className="screen-note">{adminAction.label || "Learning assignment"}. This change is attributable and the history is preserved.</p>
      <FieldGroup label="Reason"><textarea className="field" aria-label="Learning administration reason" rows="3" value={adminReason} onChange={(event) => setAdminReason(event.target.value)} /></FieldGroup>
      <button className="btn" style={{ marginTop:14 }} disabled={busy || adminReason.trim().length < 3} onClick={submitAdminAction}>Record change</button>
    </LearningForm>}
  </div>;
}
