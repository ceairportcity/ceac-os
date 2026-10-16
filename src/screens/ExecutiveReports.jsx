import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import ExecutiveOutcomeBrief from "../components/ExecutiveOutcomeBrief";
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

export default function ExecutiveReports({ me }) {
  const [period, setPeriod] = useState(null);
  const [reports, setReports] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState("all");
  const [outcomeSources,setOutcomeSources] = useState({issued:[],objectives:[],milestones:[]});
  const [outcomeError,setOutcomeError] = useState(null);

  useEffect(() => { load(); }, [me.org_id]);

  async function load() {
    setLoading(true);
    setError(null);
    setOutcomeError(null);
    setOutcomeSources({issued:[],objectives:[],milestones:[]});
    try {
      const [periodResult, unitResult] = await Promise.all([
        supabase.from("report_periods")
          .select("id,label,status,starts_on,ends_on")
          .eq("org_id", me.org_id)
          .order("starts_on", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("units")
          .select("id,name")
          .eq("org_id", me.org_id)
          .eq("active", true)
          .order("name"),
      ]);
      if (periodResult.error || unitResult.error) throw periodResult.error || unitResult.error;

      setPeriod(periodResult.data || null);
      setUnits(unitResult.data || []);

      if (!periodResult.data) {
        setReports([]);
        return;
      }

      const reportResult = await supabase.from("reports")
        .select("unit_id,status,version,submitted_at")
        .eq("period_id", periodResult.data.id)
        .eq("scope", "unit");
      if (reportResult.error) throw reportResult.error;

      const latest = {};
      (reportResult.data || []).forEach((report) => {
        if (!latest[report.unit_id] || Number(report.version) > Number(latest[report.unit_id].version)) {
          latest[report.unit_id] = report;
        }
      });
      setReports(Object.values(latest));
      // Fetch only already issued organisational reports for Executive briefing.
      // Never retrieve draft narrative or employee HR assessment content.
      const [issued,objectives,milestones] = await Promise.all([
        supabase.from("reports").select("id,unit_id,version,status,submitted_at,narrative,challenges")
          .eq("period_id",periodResult.data.id).eq("scope","unit").neq("status","draft").limit(501),
        supabase.from("objectives").select("id,name,status,project_id,unit_id,target_value,achieved_value,target_unit")
          .eq("org_id",me.org_id).limit(501),
        supabase.from("project_milestones").select("id,name,status,project_id,target_on,completed_at")
          .eq("org_id",me.org_id).limit(501),
      ]);
      const detailsError=[issued,objectives,milestones].find(x=>x.error || (x.data||[]).length>500);
      if(detailsError) {
        setOutcomeError("Leadership evidence could not be verified completely. Detailed totals are withheld.");
      } else {
        setOutcomeSources({issued:issued.data||[],objectives:objectives.data||[],milestones:milestones.data||[]});
      }
    } catch (loadError) {
      setError(humanError(loadError, "Reports could not be loaded."));
    } finally {
      setLoading(false);
    }
  }

  const filed = useMemo(() => reports.filter((report) => report.status !== "draft"), [reports]);
  const drafting = useMemo(() => reports.filter((report) => report.status === "draft"), [reports]);
  const waiting = useMemo(
    () => units.filter((unit) => !reports.some((report) => report.unit_id === unit.id && report.status !== "draft")),
    [units, reports],
  );
  const unitStatusRows = useMemo(
    () => units.map((unit) => {
      const report = reports.find((row) => row.unit_id === unit.id);
      const state = report && report.status !== "draft" ? "submitted" : report?.status === "draft" ? "draft" : "waiting";
      return { unit, report, state };
    }),
    [units, reports],
  );
  const visibleUnitRows = useMemo(
    () => unitStatusRows.filter((row) => view === "all" || row.state === view),
    [unitStatusRows, view],
  );

  const statusLabel = loading
    ? "Loading records"
    : error
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
        statusTone={error ? "danger" : "neutral"}
      />

      <QuarterlyReviewEventControl me={me} />

      {loading ? (
        <div className="ev2rep-loading" aria-label="Loading reports" aria-busy="true">
          <Skeleton variant="block" height="7rem" />
          <Skeleton variant="block" height="12rem" />
        </div>
      ) : error ? (
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
            milestones={outcomeSources.milestones} readError={outcomeError} />

          <ReportingFootnote>
            Executive Reports is read-only. Filing coverage describes reporting status only; CEAC OS does not infer unit performance, staff performance, achievement, score or ranking from it.
          </ReportingFootnote>
        </>
      )}
    </div>
  );
}
