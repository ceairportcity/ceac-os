import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import ExecutiveOutcomeBrief from "../components/ExecutiveOutcomeBrief";
import ExecutiveContributionDrilldown from "../components/ExecutiveContributionDrilldown";
import { isIssuedUnitReport, latestUnitReportStatus } from "../lib/ministryReportingFacts";
import QuarterlyReviewEventControl from "../components/QuarterlyReviewEventControl";
import { humanError } from "../lib/productLanguage";
import { Skeleton, StatePanel } from "../experience-v2/components";
import {
  ReportingEvidenceCard,
  ReportingEvidenceGrid,
  ReportingEmpty,
  ReportingFootnote,
  ReportingPageHeader,
  ReportingRecordRow,
  ReportingSection,
} from "../experience-v2/reporting-family/ReportingFamilyV2";

export default function ExecutiveReports({ me, openItem }) {
  const [period, setPeriod] = useState(null);
  const [periodOptions, setPeriodOptions] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [reports, setReports] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState("all");
  const [outcomeSources,setOutcomeSources] = useState({issued:[],objectives:[],milestones:[],targets:[],evidenceRefs:[],decisions:[]});
  const [outcomeError,setOutcomeError] = useState(null);

  // An old Executive report response must never populate a newly signed-in
  // actor's coverage/briefing after a cross-org or same-org identity change.
  const identity = me.org_id + ":" + me.id;
  const loadedActor = useRef(identity);
  loadedActor.current = identity;
  const requestSequence = useRef(0);
  const [readyActor, setReadyActor] = useState(null);
  const [failedActor, setFailedActor] = useState(null);
  // A failed CURRENT actor must see an error/retry, not perpetual loading.
  // An earlier actor's success OR error must not surface after identity change.
  const contextPending = loading || (readyActor !== identity && failedActor !== identity);
  const contextError = error && failedActor === identity;

  useEffect(() => {
    void load();
    return () => { requestSequence.current += 1; };
  }, [me.org_id, me.id, selectedPeriodId]);

  async function load() {
    const expected = identity;
    const request = ++requestSequence.current;
    const current = () => loadedActor.current === expected && requestSequence.current === request;
    setLoading(true); setReadyActor(null); setFailedActor(null); setError(null);
    setPeriod(null); setPeriodOptions([]); setUnits([]); setReports([]);
    setOutcomeError(null);
    setOutcomeSources({issued:[],objectives:[],milestones:[],targets:[],evidenceRefs:[],decisions:[]});
    try {
      const [periodResult, unitResult] = await Promise.all([
        supabase.from("report_periods")
          .select("id,label,status,starts_on,ends_on", { count:"exact" })
          .eq("org_id", me.org_id)
          .order("starts_on", { ascending: false })
          .limit(500),
        supabase.from("units")
          .select("id,name", { count: "exact" })
          .eq("org_id", me.org_id)
          .eq("active", true)
          .order("name"),
      ]);
      if (periodResult.error || unitResult.error) throw periodResult.error || unitResult.error;
      if (!Array.isArray(periodResult.data) || typeof periodResult.count !== "number"
        || periodResult.count !== periodResult.data.length || periodResult.count > 500) {
        throw new Error("Reporting periods could not be completely verified.");
      }
      const selectedPeriod = periodResult.data.find((item) => item.id === selectedPeriodId)
        || periodResult.data[0] || null;
      if (typeof unitResult.count !== "number"
        || unitResult.count !== (unitResult.data || []).length) {
        throw new Error("Active unit reporting context is incomplete. No filing totals can be verified.");
      }

      let nextReports = [];
      let nextOutcomeError = null;
      let nextSources = {issued:[],objectives:[],milestones:[],targets:[],evidenceRefs:[],decisions:[]};
      if (selectedPeriod) {
        const reportResult = await supabase.from("reports")
          .select("unit_id,status,version,submitted_at", { count: "exact" })
          .eq("period_id", selectedPeriod.id)
          .eq("scope", "unit");
        if (reportResult.error) throw reportResult.error;
        if (typeof reportResult.count !== "number"
          || reportResult.count !== (reportResult.data || []).length) {
          throw new Error("Period report history is incomplete. Filing totals are withheld.");
        }
        nextReports = Object.values(latestUnitReportStatus(reportResult.data || []));
        // Only issued organisational reports; no draft narrative or HR ratings.
        const [issued,objectives,milestones] = await Promise.all([
          supabase.from("reports").select("id,unit_id,version,status,submitted_at,narrative,challenges", { count: "exact" })
            .eq("period_id",selectedPeriod.id).eq("scope","unit").in("status",["submitted","confirmed"]).limit(501),
          supabase.from("objectives").select("id,name,status,project_id,unit_id,target_value,achieved_value,target_unit", { count: "exact" })
            .eq("org_id",me.org_id).limit(501),
          supabase.from("project_milestones").select("id,name,status,project_id,target_on,completed_at", { count: "exact" })
            .eq("org_id",me.org_id).limit(501),
        ]);
        // The API may silently apply its row cap even when our requested limit
        // is higher. An exact count is required before outcome coverage can
        // be described as complete; otherwise withhold the detailed brief.
        const detailsError=[issued,objectives,milestones].find(x=>
          x.error || typeof x.count !== "number"
          || x.count !== (x.data||[]).length || x.count>500);
        if (detailsError) {
          nextOutcomeError="Leadership evidence could not be verified completely. Detailed totals are withheld.";
        } else {
          // Only read the exact latest ISSUED revision per unit. A later draft
          // or superseded published revision must not become a new commitment
          // or double-count a previously filed target/evidence reference.
          const latestIssued = Object.values(latestUnitReportStatus(issued.data || []))
            .filter(isIssuedUnitReport);
          const issuedIds = latestIssued.map(row=>row.id);
          if (issuedIds.length) {
            const [targets,refs] = await Promise.all([
              supabase.from("report_targets")
                .select("id,report_id,name,target_value,target_unit,achieved_value,next_target_value,note,position",{count:"exact"})
                .in("report_id",issuedIds).order("position",{ascending:true}).limit(501),
              supabase.from("report_evidence_refs")
                .select("id,report_id,section,object_type,object_id,label",{count:"exact"})
                .in("report_id",issuedIds).limit(501),
            ]);
            const invalid=[targets,refs].some(response=>response.error || !Array.isArray(response.data)
              || !Number.isInteger(response.count) || response.count!==response.data.length || response.count>500);
            if (invalid) nextOutcomeError="Issued unit target and evidence references could not be verified completely. No detailed briefing will be shown.";
            else nextSources={issued:latestIssued,objectives:objectives.data||[],
              milestones:milestones.data||[],targets:targets.data||[],evidenceRefs:refs.data||[]};
          } else {
            nextSources={issued:[],objectives:objectives.data||[],
              milestones:milestones.data||[],targets:[],evidenceRefs:[]};
          }
        }
        if (!nextOutcomeError) {
          // Work decisions are already a canonical, RLS-protected source.
          // Restrict them to this reporting period. They are NOT a new
          // Executive quarterly approval or automatically generated finding.
          const exclusiveEnd = new Date(Date.parse(selectedPeriod.ends_on+"T00:00:00Z")+86400000).toISOString();
          const decisionRead = await supabase.from("work_decisions")
            .select("work_item_id,authority_profile_id,decision_text,rationale,decided_at,decided_by", {count:"exact"})
            .gte("decided_at",selectedPeriod.starts_on+"T00:00:00Z")
            .lt("decided_at",exclusiveEnd)
            .order("decided_at",{ascending:false}).limit(501);
          if (decisionRead.error || !Array.isArray(decisionRead.data)
            || !Number.isInteger(decisionRead.count) || decisionRead.count!==decisionRead.data.length
            || decisionRead.count>500) {
            nextOutcomeError="Recorded work decisions could not be verified for this period. Detailed briefing is withheld.";
          } else {
            const workIds=[...new Set(decisionRead.data.map(item=>item.work_item_id).filter(Boolean))];
            if (workIds.length) {
              const itemRead=await supabase.from("work_items")
                .select("id,title,unit_id,project_id",{count:"exact"})
                .eq("org_id",me.org_id).in("id",workIds).limit(501);
              if (itemRead.error || !Array.isArray(itemRead.data)
                || !Number.isInteger(itemRead.count) || itemRead.count!==workIds.length) {
                nextOutcomeError="Linked work decisions could not be reconciled to authorised work items.";
              } else {
                const byWorkId=new Map(itemRead.data.map(item=>[item.id,item]));
                nextSources={...nextSources,decisions:decisionRead.data.map(decision=>({
                  ...decision,work_title:byWorkId.get(decision.work_item_id).title,
                  unit_id:byWorkId.get(decision.work_item_id).unit_id,
                  project_id:byWorkId.get(decision.work_item_id).project_id,
                }))};
              }
            }
          }
        }
      }
      if (!current()) return;
      // Commit coherent reporting evidence only after every required read.
      setPeriod(selectedPeriod);
      setPeriodOptions(periodResult.data);
      setUnits(unitResult.data || []);
      setReports(nextReports);
      setOutcomeError(nextOutcomeError);
      setOutcomeSources(nextSources);
      setReadyActor(expected);
    } catch (loadError) {
      if (current()) {
        setError(humanError(loadError, "Reports could not be loaded."));
        setFailedActor(expected);
      }
    } finally {
      if (current()) setLoading(false);
    }
  }

  const filed = useMemo(() => reports.filter(isIssuedUnitReport), [reports]);
  const drafting = useMemo(() => reports.filter((report) => report.status === "draft"), [reports]);
  const waiting = useMemo(
    () => units.filter((unit) => !reports.some((report) => report.unit_id === unit.id && isIssuedUnitReport(report))),
    [units, reports],
  );
  const unitStatusRows = useMemo(
    () => units.map((unit) => {
      const report = reports.find((row) => row.unit_id === unit.id);
      const state = isIssuedUnitReport(report) ? "submitted" : report?.status === "draft" ? "draft" : "waiting";
      return { unit, report, state };
    }),
    [units, reports],
  );
  const visibleUnitRows = useMemo(
    () => unitStatusRows.filter((row) => view === "all" || row.state === view),
    [unitStatusRows, view],
  );

  const statusLabel = contextPending
    ? "Loading records"
    : contextError
      ? "Context unavailable"
      : period
        ? period.status === "open" ? "Latest period open" : "Latest period closed"
        : "No period recorded";

  return (
    <div className="body ev2-reporting-page ev2-reporting-executive">
      <ReportingPageHeader
        eyebrow="Executive insight"
        title="Reports"
        description="View submissions, reporting coverage and key recorded reports. Administration controls periods and report configuration; coverage is not a performance score."
        statusLabel={statusLabel}
        statusTone={contextError ? "danger" : "neutral"}
      />

      <QuarterlyReviewEventControl me={me} />

      {!contextPending && !contextError && periodOptions.length > 1 && <div className="ev2rep-period-picker">
        <label htmlFor="executive-report-period">Reporting period</label>
        <select id="executive-report-period" className="field" value={period?.id || ""}
          onChange={(event) => setSelectedPeriodId(event.target.value)}>
          {periodOptions.map((item) => <option key={item.id} value={item.id}>
            {item.label} ({item.starts_on} — {item.ends_on})
          </option>)}
        </select>
      </div>}

      {contextPending ? (
        <div className="ev2rep-loading" aria-label="Loading reports" aria-busy="true">
          <Skeleton variant="block" height="7rem" />
          <Skeleton variant="block" height="12rem" />
        </div>
      ) : contextError ? (
        <div className="ev2rep-state">
          <StatePanel
            state="error"
            title="Reporting context could not be loaded"
            description="No coverage or unit filing status is being shown because the current reporting records could not be retrieved."
            actionLabel="Try again"
            onAction={load}
            icon="reports"
          />
        </div>
      ) : !period ? (
        <div className="ev2rep-executive-empty-brief">
          <ReportingSection
            eyebrow="Latest period"
            title="No reporting period is recorded"
            description="Executive reporting remains empty until Administration records a reporting period."
          >
            <ReportingEmpty
              title="No leadership reporting context yet"
              description="CEAC OS will show factual unit filing status when a reporting period exists."
            />
          </ReportingSection>
          <aside className="ev2rep-executive-authority" aria-label="Reporting authority context">
            <span>Executive access</span>
            <strong>Read-only leadership context</strong>
            <p>Administration controls reporting periods and configuration. Filing coverage is evidence of reporting status only.</p>
          </aside>
        </div>
      ) : (
        <>
          <div className="exec-redesign-tabs ev2rep-status-tabs" role="tablist" aria-label="Report filters">
            {[
              ["all", "All", units.length],
              ["submitted", "Submitted", filed.length],
              ["draft", "Drafts", drafting.length],
              ["waiting", "Waiting", waiting.length],
            ].map(([key, label, count]) => <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              className={view === key ? "is-active" : ""}
              onClick={() => setView(key)}
            >{label}<span>{count}</span></button>)}
          </div>
          <div className="ev2rep-executive-brief">
            <ReportingSection
              eyebrow="Latest period"
              title={period.label}
              description={`${period.starts_on} — ${period.ends_on}. Administration controls period configuration.`}
              meta={period.status === "open" ? "Open" : "Closed"}
            >
              <ReportingEvidenceGrid>
                <ReportingEvidenceCard
                  value={String(filed.length)}
                  label="submitted units"
                  detail={`${filed.length} of ${units.length} units`}
                  tone="success"
                />
                <ReportingEvidenceCard
                  value={String(drafting.length)}
                  label="drafts"
                  detail="Started, not submitted"
                  tone="warning"
                />
                <ReportingEvidenceCard
                  value={String(waiting.length)}
                  label="waiting"
                  detail="No submitted report recorded"
                />
              </ReportingEvidenceGrid>
            </ReportingSection>

            <ReportingSection
              eyebrow="Named unit status"
              title="Who has filed"
              description="Named filing status remains visible for leadership context. It is not a ranking of units or people."
            >
              {visibleUnitRows.length === 0 ? (
                <ReportingEmpty
                  title={units.length ? "No reports in this view" : "No active units are visible"}
                  description={units.length ? "Choose another factual filing-state filter to see recorded units." : "Unit reporting status will appear when active organisation units are available."}
                />
              ) : (
                <div className="ev2rep-list">
                  {visibleUnitRows.map(({ unit, report, state }) => {
                    const isFiled = state === "submitted";
                    const isDraft = state === "draft";
                    return (
                      <ReportingRecordRow
                        key={unit.id}
                        eyebrow={isFiled ? "Submitted" : isDraft ? "Draft" : "No submitted report"}
                        title={unit.name}
                        meta={isFiled && report.submitted_at
                          ? `Submitted ${new Date(report.submitted_at).toLocaleDateString("en-GB")}`
                          : isDraft
                            ? "Draft exists but has not been submitted"
                            : "No submitted report recorded"}
                        statusLabel={isFiled ? "Filed" : isDraft ? "Started" : "Waiting"}
                        statusTone={isFiled ? "success" : isDraft ? "warning" : "neutral"}
                      />
                    );
                  })}
                </div>
              )}
            </ReportingSection>
          </div>

          <ExecutiveOutcomeBrief period={period} units={units}
            issuedReports={outcomeSources.issued} objectives={outcomeSources.objectives}
            milestones={outcomeSources.milestones} targets={outcomeSources.targets}
            evidenceRefs={outcomeSources.evidenceRefs} decisions={outcomeSources.decisions} readError={outcomeError} />

          <ExecutiveContributionDrilldown me={me} period={period} units={units} openItem={openItem} />

          <ReportingFootnote>
            Executive Reports is read-only. Filing coverage describes reporting status only; CEAC OS does not infer unit performance, staff performance, achievement, score or ranking from it.
          </ReportingFootnote>
        </>
      )}
    </div>
  );
}
