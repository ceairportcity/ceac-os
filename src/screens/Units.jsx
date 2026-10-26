import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { dateOnly, dueLabel } from "../lib/time";
import { statusPill, ProductNotice, LoadingState, EmptyState, SectionHeader, FieldGroup, StatusDistribution, ProgressMeter, Avatar } from "../components/bits";
import { humanError } from "../lib/productLanguage";
import { ComposerDrawer, StatusBadge } from "../experience-v2/components";

function money(minor, currency = "GHS") {
  const value = Number(minor || 0) / 100;
  try {
    return new Intl.NumberFormat("en-GH", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;
  }
}

function sumByCurrency(rows) {
  const totals = {};
  rows.forEach((row) => {
    const currency = row.currency || "GHS";
    totals[currency] = (totals[currency] || 0) + Number(row.amount_minor || 0);
  });
  return totals;
}

export default function Units({ me, openItem, openPeopleAccess }) {
  const [units, setUnits] = useState([]);
  const [openUnitId, setOpenUnitId] = useState(null);
  const [area, setArea] = useState("overview");
  const [headChoice, setHeadChoice] = useState({});
  const [savingHead, setSavingHead] = useState(null);
  const [unitSheet, setUnitSheet] = useState(null);
  const [unitForm, setUnitForm] = useState({ name:"", code:"", parent_id:"", handles_finance:false, owns_calendar:false });
  const [savingUnit, setSavingUnit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, [me.id]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const year = new Date().getFullYear();
      const monthStart = new Date(year, new Date().getMonth(), 1);
      const monthIso = monthStart.toISOString();
      const dayStart = new Date(); dayStart.setHours(0,0,0,0);
      const todayStr = new Date().toISOString().slice(0,10);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5).toISOString();

      const results = await Promise.all([
        supabase.from("units").select("id,name,code,parent_id,handles_finance,owns_calendar,active").eq("active",true).order("name"),
        supabase.from("unit_memberships").select("unit_id,role,profile_id,profiles(id,full_name,job_title,active)"),
        supabase.from("work_items").select("id,ref,title,kind,unit_id,assignee_id,status,due_at,completed_at,visibility").neq("visibility","private"),
        supabase.from("projects").select("id,name,status,lead_unit_id,starts_on,ends_on"),
        supabase.from("objectives").select("id,name,status,unit_id,project_id,target_value,target_unit,achieved_value"),
        supabase.from("budgets").select("id,unit_id,project_id,year,amount_minor,currency").eq("year",year),
        supabase.from("spend_lines").select("id,unit_id,spent_on,description,amount_minor,currency").gte("spent_on",`${year}-01-01`),
        supabase.from("report_periods").select("id,label,status,starts_on,ends_on").eq("status","open").order("starts_on",{ascending:false}).limit(1).maybeSingle(),
        supabase.from("reports").select("id,unit_id,period_id,status,version,submitted_at").eq("scope","unit"),
        supabase.from("work_sessions").select("profile_id,started_at,ended_at,place").gte("started_at",thirtyDaysAgo),
        supabase.from("leave_requests").select("profile_id,start_date,end_date,status").eq("status","approved").gte("end_date",todayStr),
      ]);
      const failed = results.find((result) => result.error);
      if (failed) throw failed.error;

      const [unitRows,membershipRows,workRows,projectRows,objectiveRows,budgetRows,spendRows,periodResult,reportRows,sessionRows,leaveRows] = results.map((result) => result.data);
      const currentPeriod = periodResult || null;

      const built = (unitRows || []).map((unit) => {
        const people = (membershipRows || []).filter((row) => row.unit_id === unit.id);
        const profileIds = new Set(people.map((row) => row.profile_id));
        const work = (workRows || []).filter((row) => row.unit_id === unit.id);
        const completed = work.filter((row) => ["task","deliverable"].includes(row.kind) && ["completed","self_certified"].includes(row.status));
        const objectives = (objectiveRows || []).filter((row) => row.unit_id === unit.id);
        const projects = (projectRows || []).filter((row) => row.lead_unit_id === unit.id);
        const budget = (budgetRows || []).filter((row) => row.unit_id === unit.id && !row.project_id);
        const spend = (spendRows || []).filter((row) => row.unit_id === unit.id);
        const sessions = (sessionRows || []).filter((row) => profileIds.has(row.profile_id));
        const todaySessions = sessions.filter((row) => new Date(row.started_at) >= dayStart);
        const startedIds = new Set(todaySessions.map((row) => row.profile_id));
        const leave = (leaveRows || []).filter((row) => profileIds.has(row.profile_id) && row.start_date <= todayStr && row.end_date >= todayStr);
        const awayIds = new Set(leave.map((row) => row.profile_id));

        let report = null;
        if (currentPeriod) {
          const candidates = (reportRows || []).filter((row) => row.unit_id === unit.id && row.period_id === currentPeriod.id);
          report = candidates.sort((a,b) => Number(b.version || 0)-Number(a.version || 0))[0] || null;
        }

        return {
          ...unit,
          people,
          head: people.find((row) => row.role === "manager") || null,
          work,
          openWork: work.filter((row) => !["completed","self_certified","cancelled"].includes(row.status)),
          completedThisMonth: completed.filter((row) => row.completed_at && new Date(row.completed_at) >= monthStart),
          projects,
          activeProjects: projects.filter((row) => row.status === "active"),
          objectives,
          objectivesOnTrack: objectives.filter((row) => ["on_track","met"].includes(row.status)),
          budget,
          spend,
          report,
          currentPeriod,
          sessions,
          todayStarted: startedIds.size,
          onLeaveToday: awayIds.size,
          noSessionToday: people.filter((row) => !startedIds.has(row.profile_id) && !awayIds.has(row.profile_id)).length,
        };
      });
      setUnits(built);
    } catch (e) {
      setError(humanError(e, "The Units workspace could not load."));
    } finally {
      setLoading(false);
    }
  }

  function openUnitSetup(unit = null) {
    setError(null);
    setUnitSheet(unit || { id:null });
    setUnitForm({
      name: unit?.name || "",
      code: unit?.code || "",
      parent_id: unit?.parent_id || "",
      handles_finance: Boolean(unit?.handles_finance),
      owns_calendar: Boolean(unit?.owns_calendar),
    });
  }

  async function saveUnitSetup() {
    setSavingUnit(true);
    setError(null);
    try {
      const name = unitForm.name.trim();
      const code = unitForm.code.trim().toUpperCase();
      if (!name) throw new Error("Enter the unit name.");
      if (!code) throw new Error("Enter the short unit code.");
      const payload = {
        name,
        code,
        parent_id: unitForm.parent_id || null,
        handles_finance: Boolean(unitForm.handles_finance),
        owns_calendar: Boolean(unitForm.owns_calendar),
      };
      const result = unitSheet?.id
        ? await supabase.from("units").update(payload).eq("id", unitSheet.id).eq("org_id",me.org_id).select("id,name,code,parent_id,handles_finance,owns_calendar").single()
        : await supabase.from("units").insert({ ...payload, org_id: me.org_id, active:true }).select("id,name,code,parent_id,handles_finance,owns_calendar").single();
      if (result.error) throw result.error;
      if (!result.data?.id || (unitSheet?.id && result.data.id !== unitSheet.id)
          || Object.entries(payload).some(([key,value]) => result.data[key] !== value))
        throw new Error("The unit setup could not be confirmed. Review the current organisation structure before trying again.");
      setUnitSheet(null);
      await load();
    } catch (e) {
      setError(humanError(e, "The unit setup could not be saved."));
    } finally {
      setSavingUnit(false);
    }
  }

  async function assignHead(unit) {
    const profileId = headChoice[unit.id];
    if (!profileId) return;
    setSavingHead(unit.id);
    setError(null);
    try {
      const result = await supabase.rpc("assign_unit_head", { p_unit_id: unit.id, p_profile_id: profileId });
      if (result.error) throw result.error;
      setHeadChoice((current) => ({ ...current, [unit.id]: "" }));
      await load();
    } catch (e) {
      setError(humanError(e, "The Unit Head could not be assigned."));
    } finally {
      setSavingHead(null);
    }
  }

  const openUnit = units.find((unit) => unit.id === openUnitId) || null;

  useEffect(() => {
    if (!openUnitId) { setArea("overview"); return; }
    const saved = sessionStorage.getItem(`ceac-admin-unit-area:${openUnitId}`);
    setArea(saved || "overview");
  }, [openUnitId]);

  useEffect(() => {
    if (openUnitId) sessionStorage.setItem(`ceac-admin-unit-area:${openUnitId}`, area);
  }, [openUnitId, area]);

  if (loading) return <div className="body"><LoadingState label="Loading Units…" /></div>;

  if (openUnit) {
    const budgetTotals = sumByCurrency(openUnit.budget);
    const spendTotals = sumByCurrency(openUnit.spend);
    const currencies = [...new Set([...Object.keys(budgetTotals), ...Object.keys(spendTotals)])];
    const reportingLabel = !openUnit.currentPeriod ? "No open period"
      : ["submitted","confirmed"].includes(openUnit.report?.status) ? "Submitted"
      : openUnit.report ? "Draft" : "Missing";

    return <div className="body admin-unit-detail">
      <button className="back" onClick={() => setOpenUnitId(null)}>← All units</button>
      <div className="admin-unit-identity"><div><div className="eyebrow">{openUnit.code || "Unit"}</div>
      <h1 className="h1">{openUnit.name}</h1></div><StatusBadge tone={openUnit.head ? "success" : "warning"} icon={false}>{openUnit.head ? "Unit Head recorded" : "Unit Head needed"}</StatusBadge></div>
      <div className="admin-unit-title-row">
        <p className="screen-note">{openUnit.head ? `Led by ${openUnit.head.profiles?.full_name || "Unit Head"}` : "No Unit Head assigned"} · {openUnit.people.length} {openUnit.people.length === 1 ? "person" : "people"}.</p>
        <button className="btn btn-ghost btn-sm" onClick={() => openUnitSetup(openUnit)}>Edit setup</button>
      </div>

      {!openUnit.head && <ProductNotice tone="attention" title="Unit Head not assigned">Administration should assign an existing member as Unit Head after their account is active.</ProductNotice>}

      <nav className="admin-workspace-nav" aria-label="Unit workspace">
        {[
          ["overview","Overview"],["people","People"],["work","Work"],["objectives","Objectives"],["projects","Projects"],["reporting","Reporting"],["attendance","Attendance"],["cost","Cost"],
        ].map(([key,label]) => <button key={key} className={area === key ? "on" : ""} onClick={() => setArea(key)}>{label}</button>)}
      </nav>

      {area === "overview" && <section className="admin-workspace-area">
        <div className="admin-unit-overview-grid">
          <article className="admin-unit-overview-card">
            <span>Objectives</span>
            <strong>{openUnit.objectives.length} recorded</strong>
            <StatusDistribution label="Unit objective status" segments={[
              { key:"track", label:"On track / met", value:openUnit.objectivesOnTrack.length, tone:"success" },
              { key:"risk", label:"At risk", value:openUnit.objectives.filter((row) => row.status === "at_risk").length, tone:"attention" },
              { key:"not-met", label:"Not met", value:openUnit.objectives.filter((row) => row.status === "not_met").length, tone:"danger" },
              { key:"other", label:"Other", value:Math.max(0, openUnit.objectives.length - openUnit.objectivesOnTrack.length - openUnit.objectives.filter((row) => row.status === "at_risk").length - openUnit.objectives.filter((row) => row.status === "not_met").length), tone:"neutral" },
            ]} />
          </article>
          <article className="admin-unit-overview-card">
            <span>Delivery</span>
            <strong>{openUnit.activeProjects.length} active project{openUnit.activeProjects.length === 1 ? "" : "s"}</strong>
            <div className="admin-unit-overview-pair"><div><b>{openUnit.openWork.length}</b><small>open work</small></div><div><b>{openUnit.completedThisMonth.length}</b><small>completed this month</small></div></div>
          </article>
          <article className="admin-unit-overview-card">
            <span>Reporting</span>
            <strong>{reportingLabel}</strong>
            <small>{openUnit.currentPeriod?.label || "No open reporting period"}</small>
          </article>
          <article className="admin-unit-overview-card">
            <span>People</span>
            <strong>{openUnit.people.length} on record</strong>
            <small>{openUnit.head ? `Led by ${openUnit.head.profiles?.full_name || "Unit Head"}` : "No Unit Head assigned"}</small>
          </article>
        </div>
        <SectionHeader eyebrow="Today" title="Operational context" />
        <p className="screen-note">Session and leave facts are context only. They do not measure output.</p>
        <div className="admin-unit-facts">
          <div><strong>{openUnit.todayStarted}</strong><span>started a session</span></div>
          <div><strong>{openUnit.onLeaveToday}</strong><span>on approved leave</span></div>
          <div><strong>{openUnit.noSessionToday}</strong><span>no session recorded</span></div>
        </div>
      </section>}

      {area === "people" && <section className="admin-workspace-area">
        <div className="admin-unit-title-row">
          <SectionHeader eyebrow="Unit" title="People" count={openUnit.people.length} />
          <button className="btn btn-sm" onClick={() => openPeopleAccess?.({ unitId: openUnit.id, mode: "invite" })}>Manage people & access</button>
        </div>
        <p className="screen-note">Employee invitations, transfers and additional responsibilities are managed in People & Access so CEAC keeps one authoritative people workflow. Unit Head replacement remains a specialised unit authority action.</p>
        {openUnit.people.map((member) => <div key={member.profile_id} className="admin-unit-person-row">
          <Avatar name={member.profiles?.full_name || "—"} size="sm" />
          <div><strong>{member.profiles?.full_name || "—"}</strong><span>{member.role === "manager" ? "Unit Head" : member.role === "sub_team_lead" ? "Sub-team lead" : "Staff"}{member.profiles?.job_title ? ` · ${member.profiles.job_title}` : ""}</span></div>
          {!member.profiles?.active && <span className="pill p-grey">Inactive</span>}
        </div>)}
        {!openUnit.head && openUnit.people.length > 0 && <div className="admin-head-assignment">
          <label className="field-label" htmlFor={`head-${openUnit.id}`}>Assign Unit Head</label>
          <select id={`head-${openUnit.id}`} className="field" value={headChoice[openUnit.id] || ""} onChange={(event) => setHeadChoice((current) => ({ ...current, [openUnit.id]: event.target.value }))}>
            <option value="">Choose an existing unit member</option>
            {openUnit.people.map((member) => <option key={member.profile_id} value={member.profile_id}>{member.profiles?.full_name || member.profile_id}</option>)}
          </select>
          <button className="btn btn-sm" disabled={!headChoice[openUnit.id] || savingHead === openUnit.id} onClick={() => assignHead(openUnit)}>{savingHead === openUnit.id ? "Assigning…" : "Make Unit Head"}</button>
        </div>}
      </section>}

      {area === "work" && <section className="admin-workspace-area">
        <SectionHeader eyebrow="Evidence" title="Work" count={openUnit.work.length} />
        <p className="screen-note">Administration can inspect the record but does not enter the Manager’s review queue.</p>
        {openUnit.work.map((item) => <button key={item.id} className="admin-evidence-row admin-action-button" onClick={() => openItem(item.id)}>
          <div><strong>{item.title}</strong><span>{item.ref} · {item.completed_at ? `finished ${dateOnly(item.completed_at)}` : dueLabel(item.due_at)}</span></div>
          {statusPill(item.status)}
        </button>)}
        {openUnit.work.length === 0 && <EmptyState compact title="No work recorded">Unit work will appear here as normal operation generates it.</EmptyState>}
      </section>}

      {area === "objectives" && <section className="admin-workspace-area">
        <SectionHeader eyebrow="Outcome" title="Objectives" count={openUnit.objectives.length} />
        {openUnit.objectives.map((objective) => <div key={objective.id} className="admin-evidence-row">
          <div><strong>{objective.name}</strong><span>{String(objective.status || "not set").replaceAll("_"," ")}{objective.target_value !== null ? ` · target ${objective.target_value} ${objective.target_unit || ""} · result ${objective.achieved_value ?? "not recorded"} ${objective.target_unit || ""}` : ""}</span></div>
        </div>)}
        {openUnit.objectives.length === 0 && <EmptyState compact title="No objectives recorded">Objectives linked to this unit will appear here.</EmptyState>}
      </section>}

      {area === "projects" && <section className="admin-workspace-area">
        <SectionHeader eyebrow="Delivery" title="Projects led by this unit" count={openUnit.projects.length} />
        {openUnit.projects.map((project) => <div key={project.id} className="admin-evidence-row">
          <div><strong>{project.name}</strong><span>{project.status}{project.ends_on ? ` · ends ${dateOnly(project.ends_on)}` : ""}</span></div>
        </div>)}
        {openUnit.projects.length === 0 && <EmptyState compact title="No projects led by this unit">Cross-unit participation remains visible through the underlying project records.</EmptyState>}
      </section>}

      {area === "reporting" && <section className="admin-workspace-area">
        <SectionHeader eyebrow="Reporting" title={openUnit.currentPeriod?.label || "No open period"} />
        {!openUnit.currentPeriod && <EmptyState compact title="No reporting period is open">Administration manages periods from Reporting.</EmptyState>}
        {openUnit.currentPeriod && <div className="admin-reporting-card">
          <div><strong>{reportingLabel}</strong><span>{openUnit.report?.submitted_at ? `Submitted ${dateOnly(openUnit.report.submitted_at)}` : "No submitted report for this unit yet."}</span></div>
        </div>}
      </section>}

      {area === "attendance" && <section className="admin-workspace-area">
        <SectionHeader eyebrow="Factual context" title="Attendance & leave" />
        <p className="screen-note">This records when sessions were opened and approved leave. It does not determine productivity.</p>
        <div className="admin-unit-facts">
          <div><strong>{openUnit.todayStarted}</strong><span>started today</span></div>
          <div><strong>{openUnit.onLeaveToday}</strong><span>on leave today</span></div>
          <div><strong>{openUnit.noSessionToday}</strong><span>no session today</span></div>
          <div><strong>{openUnit.sessions.length}</strong><span>sessions in last 30 days</span></div>
        </div>
      </section>}

      {area === "cost" && <section className="admin-workspace-area">
        <SectionHeader eyebrow="Cost" title="Budget & recorded spending" />
        <p className="screen-note">Currencies remain separate; CEAC OS does not invent exchange rates.</p>
        {currencies.length === 0 && <EmptyState compact title="No unit cost recorded">Budgets and spend lines entered in Cost will appear here.</EmptyState>}
        {currencies.map((currency) => <div key={currency} className="admin-evidence-row">
          <div><strong>{currency}</strong><span>{money(spendTotals[currency] || 0,currency)} spent · {budgetTotals[currency] ? `${money(budgetTotals[currency],currency)} budget` : "no budget set"}</span></div>
        </div>)}
      </section>}
    </div>;
  }

  return <div className="body admin-units">
    <div className="office-page-intro admin-page-title-row">
      <div>
        <div className="eyebrow">Organisation structure</div>
        <h1 className="h1">Units</h1>
        <p className="screen-note">Each unit combines people, delivery, reporting, attendance context and cost without creating a second reporting system.</p>
      </div>
      <button className="btn btn-sm" onClick={() => openUnitSetup(null)}>Add unit</button>
    </div>
    {error && <ProductNotice tone="error" title="Units need attention" action={<button className="btn btn-ghost btn-sm" onClick={load}>Try again</button>}>{error}</ProductNotice>}
    <div className="admin-unit-list">
      {units.map((unit) => {
        const objectiveAttention = unit.objectives.filter((row) => ["at_risk","not_met"].includes(row.status)).length;
        const reportState = unit.currentPeriod ? (["submitted","confirmed"].includes(unit.report?.status) ? "Report in" : unit.report ? "Report draft" : "Report missing") : "No open reporting period";
        return <button key={unit.id} className="admin-unit-card" onClick={() => setOpenUnitId(unit.id)}>
          <div className="admin-unit-card-head">
            <div><strong>{unit.name}</strong><span>{unit.head ? unit.head.profiles?.full_name : "No Unit Head"}</span></div>
            {unit.people.length === 1 && <span className="pill p-grey">Unit of one</span>}
          </div>
          <div className="admin-unit-card-status">
            <span><b>{unit.people.length}</b><small>people</small></span>
            <span><b>{unit.activeProjects.length}</b><small>active projects</small></span>
            <span><b>{unit.openWork.length}</b><small>open work</small></span>
            <span><b>{objectiveAttention}</b><small>objectives needing attention</small></span>
          </div>
          {unit.objectives.length > 0 && <StatusDistribution label={unit.name + " objective status"} segments={[
            { key:"track", label:"On track / met", value:unit.objectivesOnTrack.length, tone:"success" },
            { key:"attention", label:"Attention", value:objectiveAttention, tone:"attention" },
            { key:"other", label:"Other", value:Math.max(0,unit.objectives.length-unit.objectivesOnTrack.length-objectiveAttention), tone:"neutral" },
          ]} />}
          <div className="admin-unit-card-foot">
            <span>{reportState}</span>
            <b aria-hidden="true">→</b>
          </div>
        </button>;
      })}
    </div>
    {units.length === 0 && !error && <EmptyState title="No active units">Create an organisation unit before assigning people or work.</EmptyState>}

    {unitSheet && <ComposerDrawer open title={unitSheet.id ? "Edit unit" : "Add unit"}
      onClose={() => { if (!savingUnit) setUnitSheet(null); }}
      description="Renaming a unit preserves its work and history because the record keeps the same identity.">
      <FieldGroup label="Unit name"><input className="field" value={unitForm.name} onChange={(event) => setUnitForm((current) => ({ ...current, name:event.target.value }))} /></FieldGroup>
      <FieldGroup label="Short code" hint="Used in short work references and spoken identifiers."><input className="field" value={unitForm.code} onChange={(event) => setUnitForm((current) => ({ ...current, code:event.target.value }))} /></FieldGroup>
      <FieldGroup label="Parent unit" hint="Optional. Use only where CEAC actually has a parent-child unit relationship.">
        <select className="field" value={unitForm.parent_id} onChange={(event) => setUnitForm((current) => ({ ...current, parent_id:event.target.value }))}>
          <option value="">No parent unit</option>
          {units.filter((unit) => unit.id !== unitSheet.id).map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
        </select>
      </FieldGroup>
      <label className="office-check-row"><input type="checkbox" checked={unitForm.handles_finance} onChange={(event) => setUnitForm((current) => ({ ...current, handles_finance:event.target.checked }))} /><span><strong>Handles finance</strong><small>This unit may receive finance-entry capabilities where the product explicitly allows them.</small></span></label>
      <label className="office-check-row"><input type="checkbox" checked={unitForm.owns_calendar} onChange={(event) => setUnitForm((current) => ({ ...current, owns_calendar:event.target.checked }))} /><span><strong>Owns ministry calendar</strong><small>Marks the unit responsible for organisation calendar administration.</small></span></label>
      {error && <ProductNotice tone="error" title="Unit setup could not be saved">{error}</ProductNotice>}
      <button className="btn" disabled={savingUnit || !unitForm.name.trim() || !unitForm.code.trim()} onClick={saveUnitSetup}>{savingUnit ? "Saving…" : unitSheet.id ? "Save unit setup" : "Create unit"}</button>
    </ComposerDrawer>}
  </div>;
}
