import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import ExecutiveOverviewV2 from "../experience-v2/executive-overview/ExecutiveOverviewV2";

function dateKey(date) {
  return new Date(date).toLocaleDateString("en-CA", { timeZone: "Africa/Accra" });
}

export default function ExecutiveHome({ me, openMeeting, scheduleMeeting, go }) {
  const [x, setX] = useState({ doneWeek: 0, donePreviousWeek: 0, objectives: 0, objectiveAttention: 0, projects: 0, blocked: 0, review: 0, activeUnits: 0, activeTeams: null, activeVolunteers: null, activeStaff: null });
  const [loading, setLoading] = useState(true);
  const [meetings, setMeetings] = useState([]);
  const [objectiveMix, setObjectiveMix] = useState({ onTrack:0, met:0, atRisk:0, notMet:0, other:0 });
  const [ministryStrategyRows, setMinistryStrategyRows] = useState([]);
  const [reporting, setReporting] = useState(null);
  const [ministryOperations, setMinistryOperations] = useState([]);
  const [ministryOccurrences, setMinistryOccurrences] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, [me.org_id]);

  async function count(table, fn) {
    let query = supabase.from(table).select("id", { count: "exact", head: true }).eq("org_id", me.org_id);
    if (fn) query = fn(query);
    const result = await query;
    if (result.error) throw new Error(`${table}: ${result.error.message}`);
    return result.count ?? 0;
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
      const previousMonday = new Date(monday); previousMonday.setUTCDate(previousMonday.getUTCDate() - 7);
      const ministryStart = new Date(now); ministryStart.setDate(ministryStart.getDate() - 90);

      const [doneWeek, donePreviousWeek, objectives, objectiveAttention, projects, blocked, review, meetingRows, objectiveRows, strategyRows, periodRows, unitRows, operationRows, volunteerRows, staffRows, teamRows, activityResult] = await Promise.all([
        count("work_items", (query) => query.in("kind", ["task", "deliverable"]).in("status", ["completed", "self_certified"]).gte("completed_at", monday.toISOString())),
        count("work_items", (query) => query.in("kind", ["task", "deliverable"]).in("status", ["completed", "self_certified"]).gte("completed_at", previousMonday.toISOString()).lt("completed_at", monday.toISOString())),
        count("objectives"),
        count("objectives", (query) => query.in("status", ["at_risk", "not_met"])),
        count("projects", (query) => query.eq("status", "active")),
        count("blockers", (query) => query.neq("state", "resolved")),
        count("work_items", (query) => query.eq("status", "in_review")),
        supabase.from("meeting_sessions")
          .select("id,title,starts_at,status,provider")
          .gte("starts_at",now.toISOString())
          .lte("starts_at",new Date(Date.now()+14*864e5).toISOString())
          .neq("status","cancelled").order("starts_at").limit(5),
        supabase.from("objectives").select("status").eq("org_id",me.org_id),
        supabase.from("strategy_nodes")
          .select("id,node_type,name,status,measurement_kind,current_value,target_value,target_unit,created_at")
          .eq("org_id",me.org_id)
          .in("node_type",["ministry_direction","ministry_objective"])
          .neq("status","closed")
          .order("created_at",{ascending:false}),
        supabase.from("report_periods").select("id,label,status,starts_on").eq("status","open").order("starts_on",{ascending:false}).limit(1),
        supabase.from("units").select("id").eq("active",true),
        supabase.from("recurring_operations")
          .select("id,name,value_label,unit_id,units(name)")
          .eq("org_id",me.org_id).eq("active",true).eq("records_value",true)
          .order("name"),
        supabase.from("employment_records").select("id", { count: "exact", head: true }).eq("org_id", me.org_id).eq("employment_status", "active").eq("employment_type", "volunteer"),
        supabase.from("employment_records").select("id", { count: "exact", head: true }).eq("org_id", me.org_id).eq("employment_status", "active").neq("employment_type", "volunteer"),
        supabase.from("sub_teams").select("id", { count: "exact", head: true }).eq("org_id", me.org_id).eq("active", true),
        supabase.from("activity_events")
          .select("id,actor_id,verb,object_type,object_id,at")
          .eq("org_id", me.org_id)
          .order("at", { ascending: false })
          .limit(12),
      ]);

      const firstError = [meetingRows.error, objectiveRows.error, strategyRows.error, periodRows.error, unitRows.error, operationRows.error].find(Boolean);
      if (firstError) throw new Error(firstError.message);

      const operations = operationRows.data || [];
      let occurrenceRows = [];
      if (operations.length) {
        const occurrenceResult = await supabase.from("operation_occurrences")
          .select("id,operation_id,occurred_on,value,note,created_at,recorded_by")
          .in("operation_id",operations.map((row)=>row.id))
          .gte("occurred_on",dateKey(ministryStart))
          .order("occurred_on",{ascending:true})
          .order("created_at",{ascending:true});
        if (occurrenceResult.error) throw new Error(`operation_occurrences: ${occurrenceResult.error.message}`);
        occurrenceRows = occurrenceResult.data || [];
      }
      setMinistryOperations(operations);
      setMinistryOccurrences(occurrenceRows);

      const visibleActivity = activityResult.error ? [] : (activityResult.data || []);
      const actorIds = [...new Set(visibleActivity.map((row) => row.actor_id).filter(Boolean))];
      let actorNames = {};
      if (actorIds.length) {
        const actorResult = await supabase.from("profiles").select("id,full_name").in("id", actorIds);
        if (!actorResult.error) actorNames = Object.fromEntries((actorResult.data || []).map((row) => [row.id, row.full_name]));
      }
      setRecentActivity(visibleActivity.map((row) => ({ ...row, actor_name: actorNames[row.actor_id] || null })));

      setMinistryStrategyRows(strategyRows.data || []);

      const mixRows=objectiveRows.data||[];
      const onTrack=mixRows.filter((row)=>row.status==="on_track").length;
      const met=mixRows.filter((row)=>row.status==="met").length;
      const atRisk=mixRows.filter((row)=>row.status==="at_risk").length;
      const notMet=mixRows.filter((row)=>row.status==="not_met").length;
      setObjectiveMix({onTrack,met,atRisk,notMet,other:Math.max(0,mixRows.length-onTrack-met-atRisk-notMet)});

      const openPeriod=(periodRows.data||[])[0]||null;
      if(openPeriod){
        const reportRows=await supabase.from("reports").select("unit_id,status,version").eq("period_id",openPeriod.id).eq("scope","unit");
        if(reportRows.error) throw new Error(`reports: ${reportRows.error.message}`);
        const latest={};
        (reportRows.data||[]).forEach((row)=>{if(!latest[row.unit_id]||Number(row.version)>Number(latest[row.unit_id].version))latest[row.unit_id]=row;});
        const filed=Object.values(latest).filter((row)=>row.status!=="draft").length;
        setReporting({label:openPeriod.label,filed,total:(unitRows.data||[]).length});
      }else setReporting(null);

      setX({
        doneWeek,
        donePreviousWeek,
        objectives,
        objectiveAttention,
        projects,
        blocked,
        review,
        activeUnits: (unitRows.data || []).length,
        ministryObjectives: (strategyRows.data || []).filter((row) => row.node_type === "ministry_objective").length,
        activeTeams: teamRows.error ? null : (teamRows.count ?? 0),
        activeVolunteers: volunteerRows.error ? null : (volunteerRows.count ?? 0),
        activeStaff: staffRows.error ? null : (staffRows.count ?? 0),
      });
      setMeetings(meetingRows.data || []);
    } catch (loadError) {
      setError(loadError.message || "The ministry overview could not load.");
    } finally {
      setLoading(false);
    }
  }

  const executiveDate = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const mondayKey = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return dateKey(monday);
  }, []);

  const operationById = useMemo(
    () => new Map(ministryOperations.map((operation) => [operation.id, operation])),
    [ministryOperations],
  );

  const occurrencesThisWeek = ministryOccurrences.filter((row) => row.occurred_on >= mondayKey);
  const unitsThisWeek = new Set(occurrencesThisWeek.map((row) => operationById.get(row.operation_id)?.unit_id).filter(Boolean)).size;

  const ministryLatestRows = useMemo(() => {
    const latest = new Map();
    ministryOccurrences.forEach((row) => {
      const current = latest.get(row.operation_id);
      if (!current || row.occurred_on > current.occurred_on || (row.occurred_on === current.occurred_on && row.created_at > current.created_at)) latest.set(row.operation_id,row);
    });
    return ministryOperations.map((operation) => {
      const row = latest.get(operation.id);
      return {
        id: operation.id,
        unit: operation.units?.name || "Unit",
        name: operation.name,
        value_label: operation.value_label || "Value",
        occurred_on: row?.occurred_on || null,
        value: row?.value ?? null,
        note: row?.note || null,
      };
    }).sort((a,b)=>String(b.occurred_on||"").localeCompare(String(a.occurred_on||"")));
  }, [ministryOperations, ministryOccurrences]);

  const ministryCharts = useMemo(() => {
    return ministryOperations.map((operation) => {
      const rows = ministryOccurrences
        .filter((row) => row.operation_id === operation.id)
        .map((row) => ({ label: row.occurred_on.slice(5), value: Number(row.value) || 0, occurred_on: row.occurred_on }));
      return { operation, rows };
    }).filter((entry) => entry.rows.length >= 2)
      .sort((a,b)=>String(b.rows[b.rows.length-1]?.occurred_on||"").localeCompare(String(a.rows[a.rows.length-1]?.occurred_on||"")))
      .slice(0,6);
  }, [ministryOperations,ministryOccurrences]);

  return <ExecutiveOverviewV2
    executiveName={me.full_name || "Group Pastor"}
    executiveDate={executiveDate}
    loading={loading}
    error={error}
    summary={x}
    objectiveMix={objectiveMix}
    ministryStrategyRows={ministryStrategyRows}
    reporting={reporting}
    ministryOperations={ministryOperations}
    ministryOccurrences={ministryOccurrences}
    occurrencesThisWeek={occurrencesThisWeek}
    unitsThisWeek={unitsThisWeek}
    ministryLatestRows={ministryLatestRows}
    ministryCharts={ministryCharts}
    recentActivity={recentActivity}
    meetings={meetings}
    onRetry={load}
    onOpenWork={() => go?.("work")}
    onOpenMinistry={() => go?.("strategy")}
    onOpenPortfolio={() => go?.("delivery")}
    onOpenOrganisation={() => go?.("exec-organisation")}
    onOpenFinance={() => go?.("exec-finance")}
    onOpenReports={() => go?.("exec-reports")}
    onOpenCalendar={() => go?.("exec-calendar")}
    onOpenMeeting={openMeeting}
    onScheduleMeeting={() => scheduleMeeting?.({ scope:"organisation", organisation:true })}
  />;
}
